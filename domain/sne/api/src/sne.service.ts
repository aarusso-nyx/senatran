import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Database } from '../../../shared/api/src/database/database.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import {
  businessError,
  notFound,
  WsdenatranError,
} from '../../../shared/api/src/common/wsdenatran-error.js';

type Row = Record<string, unknown>;
const DOM = 'SNE';
const protocolo = (): string => 'SNE-' + randomUUID();

const DIA_MS = 86_400_000;
const PRAZO_NOTIFICACAO_DIAS = 30;
const iso = (v: unknown): string => new Date(v as string).toISOString();
const addDias = (d: string, n: number): string =>
  new Date(new Date(d).getTime() + n * DIA_MS).toISOString();
const foraDoPrazo = (acao: string, prazo: string): boolean =>
  new Date(acao).getTime() > new Date(prazo).getTime();

// Situações que já encerram a notificação: um cancelamento sobre elas é inválido.
const TERMINAIS = ['CANCELADA', 'EXPIRADA', 'REJEITADA'];

/**
 * SNE transactional service — electronic-notification adherence + delivery
 * (INV-SNE-001). Adherence (agency/vehicle/citizen), the legal deadline and the
 * channel decide whether a notice is ACEITA/PENDENTE; writes are idempotent and
 * audited (INV-IDEMP-001). A WSDenatran national extension — see
 * national-extensions-mapping.md.
 */
@Injectable()
export class SneService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  private async adesao(
    tipo: string,
    chave: string,
  ): Promise<{ aderido: boolean; canal: string | null } | null> {
    const r = await this.db.query<{ aderido: boolean; canal: string | null }>(
      'select aderido, canal from sne.adesao where tipo = $1 and chave = $2',
      [tipo, chave],
    );
    return r.rows[0] ?? null;
  }

  /** GET /v1/sne/adesoes/veiculos/{placa}. */
  async adesaoVeiculo(placa: string): Promise<unknown> {
    const forced = await this.scenario.forced('placa', placa);
    if (forced) throw new WsdenatranError(forced.status, forced.message);
    const a = await this.adesao('VEICULO', placa);
    return { placa, aderido: a?.aderido ?? false, canal: a?.canal ?? null };
  }

  /** GET /v1/sne/adesoes/cidadaos/{cpf}. */
  async adesaoCidadao(cpf: string): Promise<unknown> {
    const forced = await this.scenario.forced('cpf', cpf);
    if (forced) throw new WsdenatranError(forced.status, forced.message);
    const a = await this.adesao('CIDADAO', cpf);
    return { cpf, aderido: a?.aderido ?? false, canal: a?.canal ?? null };
  }

  /** GET /v1/sne/orgaos/{codigoOrgaoAutuador}/adesao. */
  async adesaoOrgao(codigo: string): Promise<unknown> {
    const forced = await this.scenario.forced('codigoOrgaoAutuador', codigo);
    if (forced) throw new WsdenatranError(forced.status, forced.message);
    const a = await this.adesao('ORGAO', codigo);
    return {
      codigoOrgaoAutuador: codigo,
      aderido: a?.aderido ?? false,
      canal: a?.canal ?? null,
    };
  }

  /** Shared submit for autuação / penalidade notifications. */
  private async notificar(
    tipo: 'AUTUACAO' | 'PENALIDADE',
    body: Row,
    idemKey?: string,
  ): Promise<{ status: number; body: unknown }> {
    const orgao = body.codigoOrgaoAutuador as string;
    const placa = body.placa as string | undefined;
    const cpf = body.cpfDestinatario as string | undefined;

    const forcedOrg = await this.scenario.forced('codigoOrgaoAutuador', orgao);
    if (forcedOrg)
      throw new WsdenatranError(forcedOrg.status, forcedOrg.message);
    if (placa) {
      const f = await this.scenario.forced('placa', placa);
      if (f) throw new WsdenatranError(f.status, f.message);
    }

    // Agency must adhere before it can deliver electronically.
    const org = await this.adesao('ORGAO', orgao);
    if (!org?.aderido) {
      throw businessError(
        'SNE.AGENCY.NOT_ADHERED',
        'Órgão autuador não aderente ao SNE.',
      );
    }
    // The recipient (vehicle or citizen) must adhere too.
    const alvoTipo = placa ? 'VEICULO' : 'CIDADAO';
    const alvoChave = placa ?? cpf ?? '';
    const alvo = await this.adesao(alvoTipo, alvoChave);
    if (!alvo?.aderido) {
      throw businessError(
        'SNE.NOT_ADHERED',
        'Destinatário (veículo/cidadão) não aderente ao SNE.',
      );
    }
    // Legal deadline: notify within 30 days of the infraction (deterministic;
    // body date vs a derived deadline, never the wall clock).
    if (body.dataInfracao && body.dataNotificacao) {
      const prazo = addDias(iso(body.dataInfracao), PRAZO_NOTIFICACAO_DIAS);
      if (foraDoPrazo(iso(body.dataNotificacao), prazo)) {
        throw businessError(
          'SNE.NOTICE.DEADLINE_EXPIRED',
          'Prazo legal da notificação expirado.',
        );
      }
    }

    return this.tx.idempotent(
      `sne.notificacao.${tipo}`,
      idemKey,
      async (trx) => {
        // Without an Idempotency-Key, a second notice for the same (AIT, tipo) is a
        // business-rule violation (already notified).
        const dup = await trx.query(
          'select 1 from sne.notificacao where numero_ait = $1 and tipo_notificacao = $2 limit 1',
          [body.numeroAit, tipo],
        );
        if (dup.rows[0]) {
          throw businessError(
            'SNE.NOTIFICATION.INVALID_STATUS',
            `Notificação de ${tipo} já emitida para o AIT informado.`,
          );
        }
        const prot = protocolo();
        const canal = (body.canal as string) ?? org.canal ?? 'APP_CDT';
        const situacao = canal === 'INDISPONIVEL' ? 'PENDENTE' : 'ACEITA';
        const dataNotificacao = body.dataNotificacao
          ? iso(body.dataNotificacao)
          : null;
        const resp = {
          protocolo: prot,
          numeroAit: body.numeroAit,
          idProcesso: body.idProcesso ?? null,
          tipoNotificacao: tipo,
          codigoOrgaoAutuador: orgao,
          placa: placa ?? null,
          cpfDestinatario: cpf ?? null,
          situacao,
          canal,
          dataNotificacao,
          dataDisponibilizacao: situacao === 'ACEITA' ? dataNotificacao : null,
          dataCiencia: null,
          prazoLegal: dataNotificacao
            ? addDias(dataNotificacao, PRAZO_NOTIFICACAO_DIAS)
            : null,
          mensagem: body.mensagem ?? null,
        };
        await trx.query(
          `insert into sne.notificacao
           (protocolo, numero_ait, id_processo, tipo_notificacao, codigo_orgao_autuador, placa, cpf_destinatario, situacao, canal, payload)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            prot,
            body.numeroAit,
            body.idProcesso ?? null,
            tipo,
            orgao,
            placa ?? null,
            cpf ?? null,
            situacao,
            canal,
            JSON.stringify(resp),
          ],
        );
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'sne.notificacao',
          entidadeId: prot,
          tipoEvento: `notificacao.${tipo.toLowerCase()}`,
          situacaoNova: situacao,
          payload: resp,
        });
        return { status: 201, body: resp };
      },
    );
  }

  notificarAutuacao(
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    return this.notificar('AUTUACAO', body, key);
  }

  notificarPenalidade(
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    return this.notificar('PENALIDADE', body, key);
  }

  /** GET /v1/sne/notificacoes/{protocolo}. */
  async getNotificacao(prot: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_sne_notificacao where protocolo = $1',
      [prot],
    );
    if (!r.rows[0])
      throw notFound(
        'SNE.NOTIFICATION.NOT_FOUND — notificação não encontrada.',
      );
    return r.rows[0].payload;
  }

  /** POST /v1/sne/notificacoes/{protocolo}/cancelamento. */
  async cancelar(
    prot: string,
    _body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `sne.cancelamento:${prot}`,
      undefined,
      async (trx) => {
        const r = await trx.query<Row>(
          'select situacao from sne.notificacao where protocolo = $1',
          [prot],
        );
        if (!r.rows[0])
          throw notFound(
            'SNE.NOTIFICATION.NOT_FOUND — notificação não encontrada.',
          );
        const situacao = r.rows[0].situacao as string;
        if (TERMINAIS.includes(situacao)) {
          throw businessError(
            'SNE.NOTIFICATION.INVALID_STATUS',
            `Notificação em ${situacao} não pode ser cancelada.`,
          );
        }
        await trx.query(
          "update sne.notificacao set situacao = 'CANCELADA' where protocolo = $1",
          [prot],
        );
        const resp = { protocolo: prot, situacao: 'CANCELADA' };
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'sne.notificacao',
          entidadeId: prot,
          tipoEvento: 'notificacao.cancelar',
          situacaoAnterior: situacao,
          situacaoNova: 'CANCELADA',
          payload: resp,
        });
        return { status: 200, body: resp };
      },
    );
  }
}
