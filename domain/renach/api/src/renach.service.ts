import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Database,
  type Transaction,
} from '../../../shared/api/src/database/database.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import {
  businessError,
  notFound,
} from '../../../shared/api/src/common/wsdenatran-error.js';

type Row = Record<string, unknown>;
const DOM = 'RENACH';
const protocolo = (): string => 'RENACH-' + randomUUID();

/** RENACH transactional service — process state machine + exam rules (INV-RENACH-001). */
@Injectable()
export class RenachService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
  ) {}

  private async processo(trx: Transaction, numeroRenach: string): Promise<Row> {
    const r = await trx.query<Row>(
      'select * from renach.processo where numero_renach = $1',
      [numeroRenach],
    );
    if (!r.rows[0])
      throw notFound(
        'RENACH.PROCESS.NOT_FOUND — processo RENACH não encontrado.',
      );
    return r.rows[0];
  }

  async getProcesso(numeroRenach: string): Promise<unknown> {
    const r = await this.db.query<{ payload: Row }>(
      "select jsonb_set(payload, '{situacao}', to_jsonb(situacao)) as payload from renach.processo where numero_renach = $1",
      [numeroRenach],
    );
    if (!r.rows[0])
      throw notFound(
        'RENACH.PROCESS.NOT_FOUND — processo RENACH não encontrado.',
      );
    return r.rows[0].payload;
  }

  async elegibilidade(numeroRenach: string): Promise<unknown> {
    const r = await this.db.query<Row>(
      'select situacao, tipo_processo from renach.processo where numero_renach = $1',
      [numeroRenach],
    );
    if (!r.rows[0])
      throw notFound(
        'RENACH.PROCESS.NOT_FOUND — processo RENACH não encontrado.',
      );
    const situacao = r.rows[0].situacao as string;
    const elegivel = ['ABERTO', 'AGUARDANDO_MEDICO', 'AGENDADO'].includes(
      situacao,
    );
    return {
      numeroRenach,
      tipoProcesso: r.rows[0].tipo_processo,
      elegivelExameMedico: elegivel,
      exigeAvaliacaoPsicologica:
        r.rows[0].tipo_processo === 'PRIMEIRA_HABILITACAO',
      motivos: elegivel
        ? []
        : [`Situação do processo (${situacao}) não permite novo exame.`],
    };
  }

  async listClinicas(): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renach_clinicas',
    );
    return r.rows[0]?.payload ?? [];
  }

  async listProfissionais(): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renach_profissionais',
    );
    return r.rows[0]?.payload ?? [];
  }

  async criarAgendamento(
    numeroRenach: string,
    body: Row,
    idemKey?: string,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renach.agendamento:${numeroRenach}`,
      idemKey,
      async (trx) => {
        const proc = await this.processo(trx, numeroRenach);
        const id = randomUUID();
        const resp = {
          idAgendamento: id,
          numeroRenach,
          dataHora: body.dataHora ?? null,
          codigoClinica: body.codigoClinica ?? null,
          situacao: 'AGENDADO',
          protocolo: protocolo(),
        };
        await trx.query(
          'insert into renach.agendamento (id, numero_renach, data_hora, codigo_clinica, situacao, payload) values ($1,$2,$3,$4,$5,$6::jsonb)',
          [
            id,
            numeroRenach,
            body.dataHora ?? null,
            body.codigoClinica ?? null,
            'AGENDADO',
            JSON.stringify(resp),
          ],
        );
        await this.advance(
          trx,
          numeroRenach,
          proc.situacao as string,
          'AGENDADO',
          'agendamento.criar',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  async patchAgendamento(id: string, body: Row): Promise<unknown> {
    const situacao = (body.situacao as string) ?? 'REMARCADO';
    const r = await this.db.query<Row>(
      'update renach.agendamento set situacao = $2, data_hora = coalesce($3, data_hora) where id = $1 returning numero_renach',
      [id, situacao, body.dataHora ?? null],
    );
    if (!r.rows[0])
      throw notFound('RENACH.PROCESS.NOT_FOUND — agendamento não encontrado.');
    return { idAgendamento: id, situacao, protocolo: protocolo() };
  }

  async checkin(id: string): Promise<unknown> {
    const r = await this.db.query<Row>(
      "update renach.agendamento set situacao = 'CHECKIN' where id = $1 returning numero_renach",
      [id],
    );
    if (!r.rows[0])
      throw notFound('RENACH.PROCESS.NOT_FOUND — agendamento não encontrado.');
    return { idAgendamento: id, situacao: 'CHECKIN', protocolo: protocolo() };
  }

  async registrarExame(
    numeroRenach: string,
    tipo: 'MEDICO' | 'PSICOLOGICO',
    body: Row,
    idemKey?: string,
  ): Promise<{ status: number; body: unknown }> {
    const escopo = `renach.exame.${tipo}:${numeroRenach}`;
    return this.tx.idempotent(escopo, idemKey, async (trx) => {
      const proc = await this.processo(trx, numeroRenach);
      const situacao = proc.situacao as string;
      if (['APROVADO', 'REJEITADO'].includes(situacao)) {
        throw businessError(
          'RENACH.PROCESS.INVALID_STATUS',
          `Processo em ${situacao} não aceita novo exame.`,
        );
      }
      const already = await trx.query(
        'select 1 from renach.exame where numero_renach = $1 and tipo_exame = $2',
        [numeroRenach, tipo],
      );
      if (already.rows[0]) {
        throw businessError(
          'RENACH.EXAM.ALREADY_RECORDED',
          `Exame ${tipo} já registrado para o processo.`,
        );
      }
      const exame = (body.exame ?? body.avaliacao ?? {}) as Row;
      await this.validateClinicaProfissional(trx, body, tipo);
      const resultado = (exame.resultado as string) ?? 'PENDENTE';
      const id = randomUUID();
      await trx.query(
        'insert into renach.exame (id, numero_renach, tipo_exame, resultado, codigo_clinica, cpf_examinador, data_realizacao, data_validade, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',
        [
          id,
          numeroRenach,
          tipo,
          resultado,
          (body.clinica as Row)?.codigoClinica ?? null,
          (body.examinador as Row)?.cpf ?? null,
          exame.dataRealizacao ?? null,
          exame.dataValidade ?? null,
          JSON.stringify(body),
        ],
      );
      // R008: INAPTO blocks; ENCAMINHADO_JUNTA branches; else advance.
      let nova = 'EXAME_REGISTRADO';
      if (resultado === 'INAPTO') nova = 'REJEITADO';
      else if (resultado === 'ENCAMINHADO_JUNTA') nova = 'EXAME_REGISTRADO';
      else if (tipo === 'PSICOLOGICO') nova = 'EM_ANALISE';
      const resp = {
        idExame: id,
        numeroRenach,
        tipoExame: tipo,
        resultado,
        situacao: nova,
        protocolo: protocolo(),
      };
      await this.advance(
        trx,
        numeroRenach,
        situacao,
        nova,
        `exame.${tipo.toLowerCase()}.registrar`,
        resp,
      );
      return { status: 201, body: resp };
    });
  }

  private async validateClinicaProfissional(
    trx: Transaction,
    body: Row,
    tipo: string,
  ): Promise<void> {
    const clinica = body.clinica as Row | undefined;
    if (clinica?.codigoClinica) {
      const c = await trx.query<Row>(
        'select credenciada, ativa from renach.clinica where codigo_clinica = $1',
        [clinica.codigoClinica],
      );
      if (!c.rows[0])
        throw businessError(
          'RENACH.CLINIC.NOT_ACCREDITED',
          'Clínica não credenciada.',
        );
      if (!c.rows[0].ativa)
        throw businessError('RENACH.CLINIC.INACTIVE', 'Clínica inativa.');
      if (!c.rows[0].credenciada)
        throw businessError(
          'RENACH.CLINIC.NOT_ACCREDITED',
          'Clínica não credenciada.',
        );
    }
    const examinador = body.examinador as Row | undefined;
    if (examinador?.cpf) {
      const p = await trx.query<Row>(
        'select credenciado, ativo, conselho from renach.profissional where cpf = $1',
        [examinador.cpf],
      );
      if (!p.rows[0] || !p.rows[0].credenciado || !p.rows[0].ativo) {
        throw businessError(
          'RENACH.EXAMINER.NOT_ACCREDITED',
          'Profissional não credenciado para o tipo de exame informado.',
        );
      }
      const expected = tipo === 'PSICOLOGICO' ? 'CRP' : 'CRM';
      if (p.rows[0].conselho !== expected) {
        throw businessError(
          'RENACH.EXAM.INVALID_TYPE',
          `Conselho do profissional incompatível com o exame ${tipo}.`,
        );
      }
    }
  }

  async listExames(numeroRenach: string): Promise<unknown> {
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_renach_exames where numero_renach = $1',
      [numeroRenach],
    );
    return r.rows[0]?.payload ?? { quantidade: 0, exames: [] };
  }

  async retificarExame(
    idExame: string,
    _body: Row,
  ): Promise<{ status: number; body: unknown }> {
    const r = await this.db.query<Row>(
      'select numero_renach from renach.exame where id = $1',
      [idExame],
    );
    if (!r.rows[0])
      throw notFound('RENACH.PROCESS.NOT_FOUND — exame não encontrado.');
    return {
      status: 202,
      body: {
        idExame,
        situacao: 'RETIFICACAO_EM_ANALISE',
        protocolo: protocolo(),
      },
    };
  }

  async encaminharJunta(
    numeroRenach: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renach.junta.encaminhar:${numeroRenach}`,
      undefined,
      async (trx) => {
        const proc = await this.processo(trx, numeroRenach);
        const id = randomUUID();
        await trx.query(
          "insert into renach.junta (id, numero_renach, tipo, situacao, payload) values ($1,$2,'ENCAMINHAMENTO','ABERTA',$3::jsonb)",
          [id, numeroRenach, JSON.stringify(body)],
        );
        const resp = {
          idJunta: id,
          numeroRenach,
          situacao: 'ENCAMINHADO_JUNTA',
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          numeroRenach,
          proc.situacao as string,
          'EM_ANALISE',
          'junta.encaminhar',
          resp,
        );
        return { status: 202, body: resp };
      },
    );
  }

  async registrarParecerJunta(
    numeroRenach: string,
    body: Row,
  ): Promise<{ status: number; body: unknown }> {
    return this.tx.idempotent(
      `renach.junta.parecer:${numeroRenach}`,
      undefined,
      async (trx) => {
        const proc = await this.processo(trx, numeroRenach);
        const id = randomUUID();
        const apto = (body.resultado as string) !== 'INAPTO';
        const nova = apto ? 'APROVADO' : 'REJEITADO';
        await trx.query(
          "insert into renach.junta (id, numero_renach, tipo, situacao, payload) values ($1,$2,'PARECER',$3,$4::jsonb)",
          [id, numeroRenach, nova, JSON.stringify(body)],
        );
        const resp = {
          idJunta: id,
          numeroRenach,
          situacao: nova,
          protocolo: protocolo(),
        };
        await this.advance(
          trx,
          numeroRenach,
          proc.situacao as string,
          nova,
          'junta.parecer',
          resp,
        );
        return { status: 201, body: resp };
      },
    );
  }

  private async advance(
    trx: Transaction,
    numeroRenach: string,
    anterior: string,
    nova: string,
    tipoEvento: string,
    payload: unknown,
  ): Promise<void> {
    await trx.query(
      'update renach.processo set situacao = $2 where numero_renach = $1',
      [numeroRenach, nova],
    );
    await this.tx.audit(trx, {
      dominio: DOM,
      entidade: 'renach.processo',
      entidadeId: numeroRenach,
      tipoEvento,
      situacaoAnterior: anterior,
      situacaoNova: nova,
      payload,
    });
  }
}
