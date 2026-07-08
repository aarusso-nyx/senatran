import { Inject, Injectable } from '@nestjs/common';
import {
  Database,
  type Transaction,
} from '../../../shared/api/src/database/database.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import {
  badRequest,
  businessError,
  notFound,
  WsdenatranError,
} from '../../../shared/api/src/common/wsdenatran-error.js';

type Row = Record<string, unknown>;
const DOM = 'DETRAN';

/**
 * State-DETRAN national-base bridge service. Models a state DETRAN acting against
 * the national bases (RENAVAM/RENACH/RENAINF/RENAEST/SNE) — NOT UF-proprietary
 * APIs (national-extensions-mapping.md). Each bridge validates the UF integration
 * profile + layout, then mints a `protocoloDetran` linked to a national protocol.
 * Writes are idempotent and audited (INV-DETRAN-001, INV-IDEMP-001).
 */
@Injectable()
export class DetranService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  /** Resolve + validate the UF profile; throws the mapped DETRAN error. */
  private async perfil(trx: Transaction, uf: string): Promise<Row> {
    const r = await trx.query<Row>(
      'select * from detran.perfil where uf = $1',
      [uf],
    );
    if (!r.rows[0])
      throw notFound(
        `DETRAN.PROFILE.NOT_FOUND — perfil de integração da UF ${uf} não encontrado.`,
      );
    if (!r.rows[0].ativo)
      throw businessError(
        'DETRAN.PROFILE.INACTIVE',
        `Perfil de integração da UF ${uf} inativo/suspenso.`,
      );
    return r.rows[0];
  }

  private async forcedUf(uf: string): Promise<void> {
    const f = await this.scenario.forced('uf', uf);
    if (f) throw new WsdenatranError(f.status, f.message);
  }

  /** Shared bridge write: profile → layout → rejection → mint linked protocols. */
  private async bridge(
    uf: string,
    sistema: string,
    body: Row,
    idemKey: string | undefined,
    retorno: (perfil: Row) => Row,
  ): Promise<{ status: number; body: unknown }> {
    await this.forcedUf(uf);
    return this.tx.idempotent(
      `detran.bridge.${sistema}:${uf}`,
      idemKey,
      async (trx) => {
        const perfil = await this.perfil(trx, uf);
        const versao = body.versaoLeiaute as string | undefined;
        if (versao && versao !== perfil.versao_leiaute) {
          throw badRequest(
            `DETRAN.LAYOUT.INVALID — versão de leiaute "${versao}" incompatível com o perfil da UF (esperado ${perfil.versao_leiaute}).`,
          );
        }
        // A profile still in homologation rejects national bridge submissions.
        if (perfil.perfil_integracao === 'HOMOLOGACAO_PENDENTE') {
          throw businessError(
            'DETRAN.BRIDGE.REJECTED',
            'Bridge rejeitado: perfil de integração em homologação pendente.',
          );
        }
        const seq = await trx.query<{ n: string }>(
          "select lpad(nextval('detran.seq_bridge')::text, 11, '0') as n",
        );
        const protocoloDetran = `DTR-${uf}-${seq.rows[0].n}`;
        const protocoloNacional = `${sistema}-${seq.rows[0].n}`;
        const numeroAit = (body.numeroAit as string) ?? null;
        const resp = {
          protocoloDetran,
          protocoloNacional,
          sistemaNacional: sistema,
          uf,
          codigoOrgao: perfil.codigo_orgao,
          perfilIntegracao: perfil.perfil_integracao,
          versaoLeiaute: perfil.versao_leiaute,
          situacao: 'ACEITO',
          retorno: retorno(perfil),
        };
        await trx.query(
          `insert into detran.bridge
             (protocolo_detran, uf, sistema_nacional, protocolo_nacional, numero_ait, situacao, payload)
           values ($1,$2,$3,$4,$5,'ACEITO',$6::jsonb)`,
          [
            protocoloDetran,
            uf,
            sistema,
            protocoloNacional,
            numeroAit,
            JSON.stringify(resp),
          ],
        );
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'detran.bridge',
          entidadeId: protocoloDetran,
          tipoEvento: `bridge.${sistema.toLowerCase()}`,
          situacaoNova: 'ACEITO',
          payload: resp,
        });
        return { status: 201, body: resp };
      },
    );
  }

  consultarVeiculo(uf: string, body: Row, key?: string) {
    return this.bridge(uf, 'RENAVAM', body, key, () => ({
      placa: body.placa ?? null,
      renavam: body.renavam ?? null,
      consulta: 'RENAVAM',
    }));
  }

  consultarCondutor(uf: string, body: Row, key?: string) {
    return this.bridge(uf, 'RENACH', body, key, () => ({
      cpf: body.cpf ?? null,
      consulta: 'RENACH',
    }));
  }

  enviarAit(uf: string, body: Row, key?: string) {
    return this.bridge(uf, 'RENAINF', body, key, () => ({
      numeroAit: body.numeroAit ?? null,
    }));
  }

  enviarSinistro(uf: string, body: Row, key?: string) {
    return this.bridge(uf, 'RENAEST', body, key, () => ({
      recebido: true,
    }));
  }

  enviarNotificacao(uf: string, body: Row, key?: string) {
    return this.bridge(uf, 'SNE', body, key, () => ({
      numeroAit: body.numeroAit ?? null,
    }));
  }

  /** GET /v1/detrans/{uf}/renainf/autosInfracao/{numeroAit}. */
  async consultarAit(uf: string, numeroAit: string): Promise<unknown> {
    await this.forcedUf(uf);
    // Validate the profile (reuses the DETRAN error mapping) on a throwaway tx.
    const perfil = await this.db.tx((trx) => this.perfil(trx, uf));
    const br = await this.db.query<{ payload: unknown }>(
      "select payload from detran.bridge where uf = $1 and numero_ait = $2 and sistema_nacional = 'RENAINF' order by protocolo_detran desc limit 1",
      [uf, numeroAit],
    );
    if (br.rows[0]) return br.rows[0].payload;
    // Fall back to the national RENAINF record, wrapped in bridge metadata.
    const ait = await this.db.query<{ payload: Row }>(
      'select payload from contract.v_renainf_ait where numero_ait = $1',
      [numeroAit],
    );
    if (!ait.rows[0])
      throw notFound(
        'DETRAN.PROFILE.NOT_FOUND — auto de infração não encontrado na base nacional para a UF.',
      );
    return {
      uf,
      codigoOrgao: perfil.codigo_orgao,
      sistemaNacional: 'RENAINF',
      numeroAit,
      situacao: (ait.rows[0].payload as Row).situacao ?? null,
      retorno: ait.rows[0].payload,
    };
  }
}
