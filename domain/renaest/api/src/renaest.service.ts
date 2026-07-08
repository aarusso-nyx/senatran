import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
const DOM = 'RENAEST';
const protocolo = (): string => 'RENAEST-' + randomUUID();

// Supported transmission layout version. A body that declares any other
// `versaoLeiaute` is rejected with the coded 400 RENAEST.CRASH.INVALID_LAYOUT.
const LAYOUT_SUPORTADO = '1.0';
// Situações terminais do registro: não aceitam complemento nem correção.
const TERMINAIS = ['CONSOLIDADO', 'REJEITADO'];
// Gravidades que exigem dados de vítima (INV-RENAEST-001, regra E003).
const COM_VITIMA = ['COM_VITIMA_FERIDA', 'COM_VITIMA_FATAL'];

const iso = (v: unknown): string => new Date(v as string).toISOString();

/**
 * RENAEST transactional service — national crash/sinister base. Submissions are
 * idempotent + audited (INV-IDEMP-001); the record lifecycle (RECEBIDO →
 * EM_ANALISE → {CONSOLIDADO|REJEITADO}) and layout/completeness/duplicate rules
 * are enforced here (INV-RENAEST-001). A WSDenatran national extension ported
 * from the RENAEST national base — see national-extensions-mapping.md.
 */
@Injectable()
export class RenaestService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  /** Deterministic natural key: a crash is (uf, município, instante, órgão). */
  private chaveNatural(body: Row): string {
    return [
      body.uf,
      body.codigoMunicipio,
      iso(body.dataHoraSinistro),
      (body.orgaoResponsavel as string) ?? '',
    ].join('|');
  }

  /** Coded layout rule (400) — reserved for an unsupported leiaute version. */
  private assertLayout(body: Row): void {
    const versao = body.versaoLeiaute as string | undefined;
    if (versao && versao !== LAYOUT_SUPORTADO) {
      throw badRequest(
        `RENAEST.CRASH.INVALID_LAYOUT — versão de leiaute "${versao}" não suportada (esperado ${LAYOUT_SUPORTADO}).`,
      );
    }
  }

  /** Completeness rule (402) — victim/location data required by severity. */
  private assertCompleto(body: Row): void {
    if (!body.local) {
      throw businessError(
        'RENAEST.CRASH.INCOMPLETE_DATA',
        'Local do sinistro é obrigatório.',
      );
    }
    const vitimas = (body.vitimas as unknown[] | undefined) ?? [];
    if (COM_VITIMA.includes(body.gravidade as string) && vitimas.length === 0) {
      throw businessError(
        'RENAEST.CRASH.INCOMPLETE_DATA',
        'Dados de vítima obrigatórios para sinistro com vítima.',
      );
    }
  }

  /** Magic-key source failure (500) reserved on a codigoMunicipio (scenarios.md). */
  private async assertNaoForcado(body: Row): Promise<void> {
    const forced = await this.scenario.forced(
      'codigoMunicipio',
      body.codigoMunicipio as string,
    );
    if (forced) throw new WsdenatranError(forced.status, forced.message);
  }

  /** Build the stored/returned crash object from a validated body. */
  private montar(idSinistro: string, prot: string, body: Row): Row {
    const ref = (body.referencias as Row | undefined) ?? null;
    return {
      protocolo: prot,
      idSinistro,
      situacao: 'RECEBIDO',
      dataHoraSinistro: iso(body.dataHoraSinistro),
      uf: body.uf,
      codigoMunicipio: body.codigoMunicipio,
      gravidade: body.gravidade,
      local: body.local ?? null,
      orgaoResponsavel: body.orgaoResponsavel ?? null,
      codigoTipoSinistro: body.codigoTipoSinistro ?? null,
      condicoesVia: body.condicoesVia ?? null,
      condicoesMeteorologicas: body.condicoesMeteorologicas ?? null,
      veiculos: body.veiculos ?? [],
      pessoas: body.pessoas ?? [],
      vitimas: body.vitimas ?? [],
      referencias: ref,
      dataTransmissao: body.dataTransmissao ?? null,
    };
  }

  /** Insert one crash record + its audit event, on the caller's transaction. */
  private async inserir(trx: Transaction, body: Row): Promise<Row> {
    const gen = await trx.query<{ id: string }>(
      "select 'SN' || lpad(nextval('renaest.seq_sinistro')::text, 11, '0') as id",
    );
    const idSinistro = gen.rows[0].id;
    const prot = protocolo();
    const resp = this.montar(idSinistro, prot, body);
    const ref = (body.referencias as Row | undefined) ?? {};
    await trx.query(
      `insert into renaest.sinistro
         (id_sinistro, protocolo, chave_natural, situacao, uf, codigo_municipio,
          data_hora_sinistro, gravidade, orgao_responsavel, renavam, cpf_condutor, numero_ait, payload)
       values ($1,$2,$3,'RECEBIDO',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        idSinistro,
        prot,
        this.chaveNatural(body),
        body.uf,
        body.codigoMunicipio,
        iso(body.dataHoraSinistro),
        body.gravidade ?? null,
        body.orgaoResponsavel ?? null,
        ref.renavam ?? null,
        ref.cpfCondutor ?? null,
        ref.numeroAit ?? null,
        JSON.stringify(resp),
      ],
    );
    await this.tx.audit(trx, {
      dominio: DOM,
      entidade: 'renaest.sinistro',
      entidadeId: idSinistro,
      tipoEvento: 'sinistro.receber',
      situacaoNova: 'RECEBIDO',
      payload: resp,
    });
    return resp;
  }

  /** POST /v1/renaest/sinistros — submit a single crash record. */
  async submeterSinistro(
    body: Row,
    idemKey?: string,
  ): Promise<{ status: number; body: unknown }> {
    this.assertLayout(body);
    this.assertCompleto(body);
    await this.assertNaoForcado(body);
    return this.tx.idempotent('renaest.sinistro', idemKey, async (trx) => {
      // Natural dedup: a same-tuple resubmit without an Idempotency-Key is a
      // duplicate; with a key the replay is served from the idempotency ledger.
      const dup = await trx.query(
        'select 1 from renaest.sinistro where chave_natural = $1 limit 1',
        [this.chaveNatural(body)],
      );
      if (dup.rows[0]) {
        throw businessError(
          'RENAEST.CRASH.DUPLICATED',
          'Sinistro já registrado para o mesmo órgão, município e instante.',
        );
      }
      const resp = await this.inserir(trx, body);
      return { status: 201, body: resp };
    });
  }

  /** POST /v1/renaest/sinistros/lotes — submit a batch of crash records. */
  async submeterLote(
    body: Row,
    idemKey?: string,
  ): Promise<{ status: number; body: unknown }> {
    const itens = (body.sinistros as Row[] | undefined) ?? [];
    for (const s of itens) {
      this.assertLayout(s);
      this.assertCompleto(s);
      await this.assertNaoForcado(s);
    }
    return this.tx.idempotent('renaest.sinistro.lote', idemKey, async (trx) => {
      const protocoloLote = protocolo();
      const registros: unknown[] = [];
      for (const s of itens) {
        const resp = await this.inserir(trx, s);
        registros.push({
          idSinistro: resp.idSinistro,
          protocolo: resp.protocolo,
          situacao: resp.situacao,
        });
      }
      return {
        status: 201,
        body: {
          protocoloLote,
          quantidade: registros.length,
          situacao: 'RECEBIDO',
          itens: registros,
        },
      };
    });
  }

  /** GET /v1/renaest/sinistros/{idSinistro}. */
  async getSinistro(idSinistro: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renaest_sinistro where id_sinistro = $1',
      [idSinistro],
    );
    if (!r.rows[0])
      throw notFound(
        'RENAEST.CRASH.NOT_FOUND — registro de sinistro não encontrado.',
      );
    return r.rows[0].payload;
  }

  /** GET /v1/renaest/protocolos/{protocolo}. */
  async getProtocolo(prot: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renaest_sinistro where protocolo = $1',
      [prot],
    );
    if (!r.rows[0])
      throw notFound('RENAEST.CRASH.NOT_FOUND — protocolo não encontrado.');
    return r.rows[0].payload;
  }

  private async sinistro(trx: Transaction, idSinistro: string): Promise<Row> {
    const r = await trx.query<Row>(
      'select * from renaest.sinistro where id_sinistro = $1',
      [idSinistro],
    );
    if (!r.rows[0])
      throw notFound(
        'RENAEST.CRASH.NOT_FOUND — registro de sinistro não encontrado.',
      );
    return r.rows[0];
  }

  /**
   * Shared handler for complement (COMPLEMENTO) and correction (CORRECAO).
   * Both are rejected on a terminal record with RENAEST.CRASH.CORRECTION_NOT_ALLOWED
   * (402); the accepted submission is recorded and returns 202 (async analysis).
   */
  private async retificar(
    idSinistro: string,
    tipo: 'COMPLEMENTO' | 'CORRECAO',
    body: Row,
    tipoEvento: string,
  ): Promise<{ status: number; body: unknown }> {
    this.assertLayout(body);
    return this.tx.idempotent(
      `renaest.retificacao.${tipo}:${idSinistro}`,
      undefined,
      async (trx) => {
        const sin = await this.sinistro(trx, idSinistro);
        const situacao = sin.situacao as string;
        if (TERMINAIS.includes(situacao)) {
          throw businessError(
            'RENAEST.CRASH.CORRECTION_NOT_ALLOWED',
            `Registro em situação ${situacao} não aceita ${tipo === 'CORRECAO' ? 'correção' : 'complemento'}.`,
          );
        }
        const id = randomUUID();
        const prot = protocolo();
        const resp = {
          idRetificacao: id,
          idSinistro,
          tipo,
          protocolo: prot,
          situacao: 'RETIFICACAO_EM_ANALISE',
        };
        await trx.query(
          'insert into renaest.retificacao (id, id_sinistro, protocolo, tipo, situacao, payload) values ($1,$2,$3,$4,$5,$6::jsonb)',
          [id, idSinistro, prot, tipo, 'EM_ANALISE', JSON.stringify(body)],
        );
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'renaest.sinistro',
          entidadeId: idSinistro,
          tipoEvento,
          situacaoAnterior: situacao,
          situacaoNova: situacao,
          payload: resp,
        });
        return { status: 202, body: resp };
      },
    );
  }

  /** POST /v1/renaest/sinistros/{idSinistro}/complementos. */
  complementar(
    idSinistro: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.retificar(
      idSinistro,
      'COMPLEMENTO',
      body,
      'sinistro.complementar',
    );
  }

  /** POST /v1/renaest/sinistros/{idSinistro}/correcoes. */
  corrigir(
    idSinistro: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.retificar(idSinistro, 'CORRECAO', body, 'sinistro.corrigir');
  }
}
