import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Database,
  type Transaction,
} from '../../../shared/api/src/database/database.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import {
  badRequest,
  businessError,
  notFound,
} from '../../../shared/api/src/common/wsdenatran-error.js';

type Row = Record<string, unknown>;
const DOM = 'RENAINF';
const protocolo = (): string => 'RENAINF-' + randomUUID();
const ATOR_VALIDO = [
  'PROPRIETARIO',
  'CONDUTOR_IDENTIFICADO',
  'REPRESENTANTE_LEGAL',
];

// Statutory windows (days). The mock enforces these deterministically by
// comparing a date supplied in the request body against a deadline derived from
// stored dates — never against the wall clock — so results are reproducible.
const PRAZO_DIAS = { transmissao: 30, notificacao: 30, defesa: 30 };
const DIA_MS = 86_400_000;
const iso = (v: unknown): string => new Date(v as string).toISOString();
const addDias = (isoDate: string, dias: number): string =>
  new Date(new Date(isoDate).getTime() + dias * DIA_MS).toISOString();
/** True when `acao` (an ISO date) falls strictly after `prazo`. */
const foraDoPrazo = (acao: string, prazo: string): boolean =>
  new Date(acao).getTime() > new Date(prazo).getTime();

/** RENAINF transactional service — case state machine + defesa/penalidade/recurso ordering (INV-RENAINF-001). */
@Injectable()
export class RenainfService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
  ) {}

  // ---- talonário -----------------------------------------------------------
  async registrarDispositivo(
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    const id = (body.idDispositivo as string) ?? randomUUID();
    return this.tx.idempotent('renainf.dispositivo', key, async (trx) => {
      await trx.query(
        'insert into renainf.dispositivo (id_dispositivo, codigo_orgao_autuador, homologado, ativo, payload) values ($1,$2,true,true,$3::jsonb) on conflict (id_dispositivo) do nothing',
        [id, body.codigoOrgaoAutuador ?? null, JSON.stringify(body)],
      );
      return {
        status: 201,
        body: {
          idDispositivo: id,
          situacao: 'REGISTRADO',
          protocolo: protocolo(),
        },
      };
    });
  }

  async sincronizar(): Promise<unknown> {
    const org = await this.db.query<{ payload: unknown }>(
      "select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'uf', uf)), '[]'::jsonb) as payload from senatran.ref_orgao_autuador",
    );
    return {
      orgaosAutuadores: org.rows[0]?.payload ?? [],
      sincronizadoEm: new Date().toISOString(),
    };
  }

  async reservarFaixa(body: Row): Promise<{ status: number; body: unknown }> {
    const r = await this.db.query<{ id: number }>(
      'insert into renainf.faixa_ait (codigo_orgao_autuador, numero_inicial, numero_final, reservada) values ($1,$2,$3,true) returning id',
      [
        body.codigoOrgaoAutuador ?? null,
        body.numeroInicial ?? null,
        body.numeroFinal ?? null,
      ],
    );
    return {
      status: 201,
      body: {
        idFaixa: r.rows[0].id,
        situacao: 'RESERVADA',
        protocolo: protocolo(),
      },
    };
  }

  // ---- AIT -----------------------------------------------------------------
  async criarAit(
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    const numeroAit = body.numeroAit as string;
    if (!numeroAit)
      throw badRequest('RENAINF.AIT.INVALID_NUMBER — numeroAit obrigatório.');
    if (!body.infracao || !(body.infracao as Row).codigoInfracao)
      throw badRequest(
        'RENAINF.AIT.INVALID_INFRACTION_CODE — código de infração obrigatório.',
      );
    return this.tx.idempotent('renainf.ait', key, async (trx) => {
      const dup = await trx.query(
        'select 1 from renainf.ait where numero_ait = $1',
        [numeroAit],
      );
      if (dup.rows[0])
        throw businessError(
          'RENAINF.AIT.DUPLICATED',
          'AIT já lavrado (número duplicado).',
        );
      const querSne = body.canalNotificacao === 'SNE';
      const device = body.dispositivo as Row | undefined;
      if (device?.idDispositivo) {
        const d = await trx.query<Row>(
          'select homologado, ativo, sne_aderido from renainf.dispositivo where id_dispositivo = $1',
          [device.idDispositivo],
        );
        if (!d.rows[0] || !d.rows[0].homologado || !d.rows[0].ativo)
          throw businessError(
            'RENAINF.AIT.INVALID_DEVICE',
            'Dispositivo/talonário não homologado.',
          );
        if (querSne && !d.rows[0].sne_aderido)
          throw businessError(
            'RENAINF.SNE.NOT_ADHERED',
            'Órgão não aderente ao SNE para notificação eletrônica.',
          );
      }
      const inf = body.infracao as Row;
      // Transmission window: the AIT must reach RENAINF within N days of the
      // infraction. Fires only when the órgão states its dataTransmissao.
      const dataTransmissao = body.dataTransmissao as string | undefined;
      if (
        dataTransmissao &&
        inf.dataInfracao &&
        foraDoPrazo(
          iso(dataTransmissao),
          addDias(iso(inf.dataInfracao), PRAZO_DIAS.transmissao),
        )
      )
        throw businessError(
          'RENAINF.AIT.TRANSMISSION_EXPIRED',
          `Prazo de transmissão (${PRAZO_DIAS.transmissao} dias após a infração) expirado.`,
        );
      // Codes that mandate photographic evidence.
      const REQUIRES_EVIDENCE = new Set(['74550', '74630', '60503', '55414']);
      const evidencias = Array.isArray(body.evidencias) ? body.evidencias : [];
      if (
        REQUIRES_EVIDENCE.has(String(inf.codigoInfracao)) &&
        evidencias.length === 0
      ) {
        throw businessError(
          'RENAINF.AIT.EVIDENCE_REQUIRED',
          'Evidência obrigatória ausente para a infração.',
        );
      }
      // Numeric AITs must fall within a reserved range for the órgão, if any.
      if (/^\d+$/.test(numeroAit)) {
        const faixas = await trx.query<Row>(
          'select numero_inicial, numero_final from renainf.faixa_ait where codigo_orgao_autuador = $1 and reservada',
          [body.codigoOrgaoAutuador],
        );
        if (faixas.rows.length > 0) {
          const n = BigInt(numeroAit);
          const inRange = faixas.rows.some((f) => {
            try {
              return (
                BigInt(String(f.numero_inicial)) <= n &&
                n <= BigInt(String(f.numero_final))
              );
            } catch {
              return false;
            }
          });
          if (!inRange)
            throw businessError(
              'RENAINF.AIT.OUT_OF_RANGE',
              'Número de AIT fora da faixa reservada.',
            );
        }
      }
      const id = randomUUID();
      const veic = body.veiculo as Row | undefined;
      await trx.query(
        'insert into renainf.ait (id, numero_ait, codigo_orgao_autuador, situacao, placa, codigo_infracao, data_infracao, cpf_agente, id_dispositivo, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)',
        [
          id,
          numeroAit,
          body.codigoOrgaoAutuador ?? null,
          'VALIDADO',
          veic?.placa ?? null,
          inf.codigoInfracao,
          inf.dataInfracao ?? new Date().toISOString(),
          (body.agenteAutuador as Row)?.cpf ?? null,
          device?.idDispositivo ?? null,
          JSON.stringify({ ...body, situacao: 'VALIDADO' }),
        ],
      );
      const resp = { numeroAit, situacao: 'VALIDADO', protocolo: protocolo() };
      await this.tx.audit(trx, {
        dominio: DOM,
        entidade: 'renainf.ait',
        entidadeId: numeroAit,
        tipoEvento: 'ait.lavrar',
        situacaoNova: 'VALIDADO',
        payload: resp,
      });
      return { status: 201, body: resp };
    });
  }

  async transmitirLote(body: Row): Promise<{ status: number; body: unknown }> {
    const qtd = Array.isArray(body.autos)
      ? (body.autos as unknown[]).length
      : 0;
    return {
      status: 202,
      body: {
        protocolo: protocolo(),
        situacao: 'TRANSMISSAO_EM_PROCESSAMENTO',
        quantidade: qtd,
      },
    };
  }

  async getAit(numeroAit: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renainf_ait where numero_ait = $1',
      [numeroAit],
    );
    if (!r.rows[0])
      throw notFound('RENAINF.AIT.INVALID_NUMBER — AIT não encontrado.');
    return r.rows[0].payload;
  }

  async solicitarCancelamento(
    numeroAit: string,
    _body: Row,
  ): Promise<{ status: number; body: unknown }> {
    const r = await this.db.query(
      'select 1 from renainf.ait where numero_ait = $1',
      [numeroAit],
    );
    if (!r.rows[0])
      throw notFound('RENAINF.AIT.INVALID_NUMBER — AIT não encontrado.');
    return {
      status: 202,
      body: {
        numeroAit,
        situacao: 'CANCELAMENTO_SOLICITADO',
        protocolo: protocolo(),
      },
    };
  }

  // ---- processo administrativo --------------------------------------------
  private async processo(trx: Transaction, idProcesso: string): Promise<Row> {
    const r = await trx.query<Row>(
      'select * from renainf.processo where id = $1',
      [idProcesso],
    );
    if (!r.rows[0])
      throw notFound(
        'RENAINF.CASE.NOT_FOUND — processo administrativo não encontrado.',
      );
    return r.rows[0];
  }

  async abrirProcesso(
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    const numeroAit = body.numeroAit as string;
    return this.tx.idempotent('renainf.processo.abrir', key, async (trx) => {
      const ait = await trx.query<Row>(
        'select id from renainf.ait where numero_ait = $1',
        [numeroAit],
      );
      if (!ait.rows[0])
        throw notFound('RENAINF.AIT.INVALID_NUMBER — AIT não encontrado.');
      const id = randomUUID();
      await trx.query(
        "insert into renainf.processo (id, ait_id, situacao, payload) values ($1,$2,'AUTUACAO_ABERTA',$3::jsonb)",
        [
          id,
          ait.rows[0].id,
          JSON.stringify({
            idProcesso: id,
            numeroAit,
            situacao: 'AUTUACAO_ABERTA',
          }),
        ],
      );
      const resp = {
        idProcesso: id,
        numeroAit,
        situacao: 'AUTUACAO_ABERTA',
        protocolo: protocolo(),
      };
      await this.tx.audit(trx, {
        dominio: DOM,
        entidade: 'renainf.processo',
        entidadeId: id,
        tipoEvento: 'processo.abrir',
        situacaoNova: 'AUTUACAO_ABERTA',
        payload: resp,
      });
      return { status: 201, body: resp };
    });
  }

  async notificarAutuacao(
    idProcesso: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.notificacao.autuacao:${idProcesso}`,
      undefined,
      async (trx) => {
        const proc = await this.processo(trx, idProcesso);
        if (proc.situacao !== 'AUTUACAO_ABERTA')
          throw businessError(
            'RENAINF.CASE.INVALID_STATUS',
            `Transição inválida a partir de ${proc.situacao}.`,
          );
        // Notice window: autuação must be notified within N days of the
        // infraction. Enforced only when dataNotificacao is supplied; when it
        // is, it also anchors the defense deadline stored on the case.
        const dataNotificacao = body.dataNotificacao as string | undefined;
        let prazoDefesa: string | null = null;
        if (dataNotificacao) {
          const a = await trx.query<Row>(
            'select a.data_infracao from renainf.ait a join renainf.processo p on p.ait_id = a.id where p.id = $1',
            [idProcesso],
          );
          const dataInfracao = a.rows[0]?.data_infracao;
          if (
            dataInfracao &&
            foraDoPrazo(
              iso(dataNotificacao),
              addDias(iso(dataInfracao), PRAZO_DIAS.notificacao),
            )
          )
            throw businessError(
              'RENAINF.NOTICE.DEADLINE_EXPIRED',
              `Prazo de notificação (${PRAZO_DIAS.notificacao} dias após a infração) expirado.`,
            );
          prazoDefesa = addDias(iso(dataNotificacao), PRAZO_DIAS.defesa);
        }
        const resp = {
          idProcesso,
          tipoNotificacao: 'AUTUACAO',
          situacao: 'AGUARDANDO_DEFESA_PREVIA',
          protocolo: protocolo(),
        };
        await trx.query(
          "update renainf.processo set situacao = $2, prazo_defesa = coalesce($3, prazo_defesa), payload = jsonb_set(payload, '{situacao}', to_jsonb($2::text)) where id = $1",
          [idProcesso, 'AGUARDANDO_DEFESA_PREVIA', prazoDefesa],
        );
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'renainf.processo',
          entidadeId: idProcesso,
          tipoEvento: 'notificacao.autuacao',
          situacaoAnterior: 'AUTUACAO_ABERTA',
          situacaoNova: 'AGUARDANDO_DEFESA_PREVIA',
          payload: resp,
        });
        return { status: 201, body: resp };
      },
    );
  }

  async indicarCondutor(
    idProcesso: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.indicacao:${idProcesso}`,
      undefined,
      async (trx) => {
        await this.processo(trx, idProcesso);
        await trx.query(
          'insert into renainf.indicacao_condutor (processo_id, cpf_condutor, payload) values ($1,$2,$3::jsonb)',
          [
            idProcesso,
            (body.condutor as Row)?.cpf ?? body.cpfCondutor ?? null,
            JSON.stringify(body),
          ],
        );
        const resp = {
          idProcesso,
          situacao: 'CONDUTOR_INDICADO',
          protocolo: protocolo(),
        };
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'renainf.processo',
          entidadeId: idProcesso,
          tipoEvento: 'indicacao.condutor',
          situacaoNova: 'CONDUTOR_INDICADO',
          payload: resp,
        });
        return { status: 201, body: resp };
      },
    );
  }

  async protocolarDefesa(
    idProcesso: string,
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    const ator = (body.requerente as Row)?.tipoRequerente as string;
    if (ator && !ATOR_VALIDO.includes(ator))
      throw businessError(
        'RENAINF.DEFENSE.INVALID_ACTOR',
        'Requerente não legitimado.',
      );
    return this.tx.idempotent(
      `renainf.defesa:${idProcesso}`,
      key,
      async (trx) => {
        const proc = await this.processo(trx, idProcesso);
        if (
          ![
            'NOTIFICADO_AUTUACAO',
            'AGUARDANDO_DEFESA_PREVIA',
            'AGUARDANDO_INDICACAO_CONDUTOR',
            'CONDUTOR_INDICADO',
          ].includes(proc.situacao as string)
        ) {
          throw businessError(
            'RENAINF.DEFENSE.NOT_ALLOWED',
            `Defesa não cabível na situação ${proc.situacao}.`,
          );
        }
        // Timeliness: when the case carries a defense deadline, a defense
        // protocolled after it is intempestive.
        if (
          proc.prazo_defesa &&
          body.dataProtocolo &&
          foraDoPrazo(iso(body.dataProtocolo), iso(proc.prazo_defesa))
        )
          throw businessError(
            'RENAINF.DEFENSE.LATE_SUBMISSION',
            'Defesa prévia apresentada fora do prazo.',
          );
        await trx.query(
          'insert into renainf.defesa (processo_id, tipo_requerente, numero_documento, fundamentacao, payload) values ($1,$2,$3,$4,$5::jsonb)',
          [
            idProcesso,
            ator ?? null,
            (body.requerente as Row)?.numeroDocumento ?? null,
            body.fundamentacao ?? null,
            JSON.stringify(body),
          ],
        );
        const resp = {
          idProcesso,
          situacao: 'DEFESA_APRESENTADA',
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          idProcesso,
          proc.situacao as string,
          'DEFESA_APRESENTADA',
          'defesa.protocolar',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  async imporPenalidade(
    idProcesso: string,
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.penalidade:${idProcesso}`,
      key,
      async (trx) => {
        const proc = await this.processo(trx, idProcesso);
        const sit = proc.situacao as string;
        if (sit === 'PENALIDADE_IMPOSTA')
          throw businessError(
            'RENAINF.PENALTY.ALREADY_IMPOSED',
            'Penalidade já imposta.',
          );
        if (
          ![
            'AGUARDANDO_DEFESA_PREVIA',
            'DEFESA_APRESENTADA',
            'DEFESA_REJEITADA',
            'CONDUTOR_INDICADO',
          ].includes(sit)
        ) {
          throw businessError(
            'RENAINF.CASE.INVALID_STATUS',
            `Penalidade não pode ser imposta na situação ${sit} (exige tratamento da autuação/defesa).`,
          );
        }
        const valor = Number(body.valor ?? 195.23);
        await trx.query(
          'insert into renainf.penalidade (processo_id, valor, pontos, payload) values ($1,$2,$3,$4::jsonb)',
          [idProcesso, valor, body.pontos ?? 5, JSON.stringify(body)],
        );
        await trx.query(
          "insert into renainf.debito (processo_id, valor, situacao_pagamento, payload) values ($1,$2,'EM_ABERTO',$3::jsonb) on conflict (processo_id) do update set valor = excluded.valor",
          [
            idProcesso,
            valor,
            JSON.stringify({
              idProcesso,
              valor,
              situacaoPagamento: 'EM_ABERTO',
            }),
          ],
        );
        const resp = {
          idProcesso,
          situacao: 'PENALIDADE_IMPOSTA',
          valor,
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          idProcesso,
          sit,
          'PENALIDADE_IMPOSTA',
          'penalidade.impor',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  async notificarPenalidade(
    idProcesso: string,
    _body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.transition(
      idProcesso,
      ['PENALIDADE_IMPOSTA'],
      'NOTIFICADO_PENALIDADE',
      'notificacao.penalidade',
      201,
      () => ({ idProcesso, tipoNotificacao: 'PENALIDADE' }),
    );
  }

  async protocolarRecurso(
    idProcesso: string,
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    const instancia = body.instancia as string;
    return this.tx.idempotent(
      `renainf.recurso.${instancia}:${idProcesso}`,
      key,
      async (trx) => {
        const proc = await this.processo(trx, idProcesso);
        if (instancia === 'SEGUNDA_INSTANCIA') {
          const jari = await trx.query(
            'select 1 from renainf.recurso where processo_id = $1 and instancia = $2',
            [idProcesso, 'JARI'],
          );
          if (!jari.rows[0])
            throw businessError(
              'RENAINF.APPEAL.PREVIOUS_INSTANCE_REQUIRED',
              'Recurso JARI é exigido antes da segunda instância.',
            );
        } else if (instancia !== 'JARI') {
          throw businessError(
            'RENAINF.APPEAL.INVALID_INSTANCE',
            'Instância de recurso inválida.',
          );
        }
        const id = randomUUID();
        await trx.query(
          "insert into renainf.recurso (id, processo_id, instancia, situacao, payload) values ($1,$2,$3,'APRESENTADO',$4::jsonb)",
          [id, idProcesso, instancia, JSON.stringify(body)],
        );
        const nova =
          instancia === 'JARI'
            ? 'RECURSO_JARI_APRESENTADO'
            : 'SEGUNDA_INSTANCIA_APRESENTADA';
        const resp = {
          idRecurso: id,
          idProcesso,
          instancia,
          situacao: nova,
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          idProcesso,
          proc.situacao as string,
          nova,
          'recurso.protocolar',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  async julgarRecurso(
    idRecurso: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.julgamento:${idRecurso}`,
      undefined,
      async (trx) => {
        const rec = await trx.query<Row>(
          'select processo_id, instancia from renainf.recurso where id = $1',
          [idRecurso],
        );
        if (!rec.rows[0])
          throw notFound('RENAINF.CASE.NOT_FOUND — recurso não encontrado.');
        const provido = (body.resultado as string) === 'PROVIDO';
        await trx.query(
          'update renainf.recurso set situacao = $2, resultado = $3 where id = $1',
          [idRecurso, 'JULGADO', provido ? 'PROVIDO' : 'NEGADO'],
        );
        const inst = rec.rows[0].instancia as string;
        const nova =
          inst === 'JARI'
            ? provido
              ? 'JARI_PROVIDO'
              : 'JARI_NEGADO'
            : provido
              ? 'DECISAO_FINAL'
              : 'ARQUIVADO';
        const resp = {
          idRecurso,
          resultado: provido ? 'PROVIDO' : 'NEGADO',
          situacao: nova,
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          rec.rows[0].processo_id as string,
          '',
          nova,
          'recurso.julgar',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  async getDebito(idProcesso: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renainf_debito where id_processo = $1',
      [idProcesso],
    );
    if (!r.rows[0])
      throw notFound('RENAINF.CASE.NOT_FOUND — débito não encontrado.');
    return r.rows[0].payload;
  }

  async registrarPagamento(
    idProcesso: string,
    body: Row,
    key?: string,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.pagamento:${idProcesso}`,
      key,
      async (trx) => {
        await this.processo(trx, idProcesso);
        const deb = await trx.query<Row>(
          'select situacao_pagamento from renainf.debito where processo_id = $1',
          [idProcesso],
        );
        if (deb.rows[0]?.situacao_pagamento === 'QUITADO')
          throw businessError(
            'RENAINF.PAYMENT.ALREADY_SETTLED',
            'Débito já quitado.',
          );
        await trx.query(
          'insert into renainf.pagamento (processo_id, valor_pago, forma_pagamento, numero_comprovante, payload) values ($1,$2,$3,$4,$5::jsonb)',
          [
            idProcesso,
            body.valorPago ?? 0,
            body.formaPagamento ?? null,
            body.numeroComprovante ?? null,
            JSON.stringify(body),
          ],
        );
        await trx.query(
          "update renainf.debito set situacao_pagamento = 'QUITADO' where processo_id = $1",
          [idProcesso],
        );
        const resp = { idProcesso, situacao: 'PAGO', protocolo: protocolo() };
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'renainf.debito',
          entidadeId: idProcesso,
          tipoEvento: 'pagamento.registrar',
          situacaoNova: 'QUITADO',
          payload: resp,
        });
        return { status: 201, body: resp };
      },
    );
  }

  // ---- helpers -------------------------------------------------------------
  private async transition(
    idProcesso: string,
    from: string[],
    to: string,
    tipoEvento: string,
    status: number,
    bodyFn: () => Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renainf.${tipoEvento}:${idProcesso}`,
      undefined,
      async (trx) => {
        const proc = await this.processo(trx, idProcesso);
        if (!from.includes(proc.situacao as string))
          throw businessError(
            'RENAINF.CASE.INVALID_STATUS',
            `Transição inválida a partir de ${proc.situacao}.`,
          );
        const resp = { ...bodyFn(), situacao: to, protocolo: protocolo() };
        await this.advance(
          trx,
          idProcesso,
          proc.situacao as string,
          to,
          tipoEvento,
          resp,
        );
        return { status, body: resp };
      },
    );
  }

  private async advance(
    trx: Transaction,
    idProcesso: string,
    anterior: string,
    nova: string,
    tipoEvento: string,
    payload: unknown,
  ): Promise<void> {
    await trx.query(
      "update renainf.processo set situacao = $2, payload = jsonb_set(payload, '{situacao}', to_jsonb($2::text)) where id = $1",
      [idProcesso, nova],
    );
    await this.tx.audit(trx, {
      dominio: DOM,
      entidade: 'renainf.processo',
      entidadeId: idProcesso,
      tipoEvento,
      situacaoAnterior: anterior || null,
      situacaoNova: nova,
      payload,
    });
  }
}
