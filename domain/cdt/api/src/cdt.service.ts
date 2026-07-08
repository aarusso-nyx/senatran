import { Inject, Injectable } from '@nestjs/common';
import { Database } from '../../../shared/api/src/database/database.js';
import { TransactionSupport } from '../../../shared/api/src/common/transaction-support.service.js';
import { ScenarioService } from '../../../shared/api/src/common/scenario.service.js';
import {
  businessError,
  notFound,
  WsdenatranError,
} from '../../../shared/api/src/common/wsdenatran-error.js';

type Row = Record<string, unknown>;
const DOM = 'CDT';

// Situações do débito que não admitem reconhecimento (já reconhecido/quitado).
const TERMINAIS = ['RECONHECIDA', 'PAGA'];

/**
 * CDT projection service — a deterministic citizen-channel view over national
 * data (SNE notifications, RENAINF/CDT infractions, vehicles, CNH). NOT an
 * identity provider (INV-CDT-001). The only write is `reconhecimento`, which
 * unlocks the recognition discount; it is audited (INV-IDEMP-001). A WSDenatran
 * national extension — see national-extensions-mapping.md.
 */
@Injectable()
export class CdtService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(TransactionSupport) private readonly tx: TransactionSupport,
    @Inject(ScenarioService) private readonly scenario: ScenarioService,
  ) {}

  private async forcedCpf(cpf: string): Promise<void> {
    const f = await this.scenario.forced('cpf', cpf);
    if (f) throw new WsdenatranError(f.status, f.message);
  }

  /** A citizen is "known" if they are a condutor, a proprietário, or have a débito. */
  private async assertCidadao(cpf: string): Promise<void> {
    const r = await this.db.query<{ ok: boolean }>(
      `select (
         exists(select 1 from senatran.condutor where cpf = $1)
         or exists(select 1 from senatran.veiculo where id_proprietario = $1)
         or exists(select 1 from cdt.infracao where cpf = $1)
       ) as ok`,
      [cpf],
    );
    if (!r.rows[0]?.ok)
      throw notFound('CDT.CITIZEN.NOT_FOUND — cidadão não encontrado.');
  }

  /** GET /v1/cdt/cidadaos/{cpf}/notificacoes — projection of SNE notices. */
  async notificacoes(cpf: string): Promise<unknown> {
    await this.forcedCpf(cpf);
    await this.assertCidadao(cpf);
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_sne_notificacao where cpf_destinatario = $1 order by protocolo',
      [cpf],
    );
    return { cpf, notificacoes: r.rows.map((x) => x.payload) };
  }

  /** GET /v1/cdt/cidadaos/{cpf}/infracoes — projection of the citizen's débitos. */
  async infracoes(cpf: string): Promise<unknown> {
    await this.forcedCpf(cpf);
    await this.assertCidadao(cpf);
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_cdt_infracao where cpf = $1 order by numero_ait',
      [cpf],
    );
    return { cpf, infracoes: r.rows.map((x) => x.payload) };
  }

  /** GET /v1/cdt/cidadaos/{cpf}/veiculos — projection of owned vehicles. */
  async veiculos(cpf: string): Promise<unknown> {
    await this.forcedCpf(cpf);
    await this.assertCidadao(cpf);
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from senatran.veiculo where id_proprietario = $1 order by placa',
      [cpf],
    );
    return { cpf, veiculos: r.rows.map((x) => x.payload) };
  }

  /** GET /v1/cdt/cidadaos/{cpf}/cnh — CNH summary from the condutor fixture. */
  async cnh(cpf: string): Promise<unknown> {
    await this.forcedCpf(cpf);
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from senatran.condutor where cpf = $1 limit 1',
      [cpf],
    );
    if (!r.rows[0])
      throw notFound('CDT.CITIZEN.NOT_FOUND — CNH não encontrada para o CPF.');
    return { cpf, cnh: r.rows[0].payload };
  }

  /** GET /v1/cdt/infracoes/{numeroAit}/pagamento — payment/discount projection. */
  async pagamento(numeroAit: string): Promise<unknown> {
    const f = await this.scenario.forced('numeroAit', numeroAit);
    if (f) throw new WsdenatranError(f.status, f.message);
    const r = await this.db.query<{ payload: unknown }>(
      'select payload from contract.v_cdt_infracao where numero_ait = $1',
      [numeroAit],
    );
    if (!r.rows[0])
      throw notFound('CDT.INFRACTION.NOT_FOUND — infração não encontrada.');
    return r.rows[0].payload;
  }

  /** POST /v1/cdt/infracoes/{numeroAit}/reconhecimento — recognize to unlock discount. */
  async reconhecer(
    numeroAit: string,
    _body: Row,
  ): Promise<{ status: number; body: unknown }> {
    const f = await this.scenario.forced('numeroAit', numeroAit);
    if (f) throw new WsdenatranError(f.status, f.message);
    return this.tx.idempotent(
      `cdt.reconhecimento:${numeroAit}`,
      undefined,
      async (trx) => {
        const r = await trx.query<Row>(
          'select * from cdt.infracao where numero_ait = $1',
          [numeroAit],
        );
        if (!r.rows[0])
          throw notFound('CDT.INFRACTION.NOT_FOUND — infração não encontrada.');
        const inf = r.rows[0];
        const situacao = inf.situacao as string;
        if (inf.reconhecida || TERMINAIS.includes(situacao)) {
          throw businessError(
            'CDT.RECOGNITION.NOT_ALLOWED',
            `Infração em ${situacao} não admite reconhecimento.`,
          );
        }
        const pct = Number(inf.percentual_desconto ?? 0);
        if (pct <= 0 || !inf.boleto_disponivel) {
          throw businessError(
            'CDT.DISCOUNT.NOT_AVAILABLE',
            'Desconto por reconhecimento indisponível para esta infração.',
          );
        }
        await trx.query(
          "update cdt.infracao set reconhecida = true, situacao = 'RECONHECIDA' where numero_ait = $1",
          [numeroAit],
        );
        const resp = {
          numeroAit,
          situacao: 'RECONHECIDA',
          percentualDesconto: pct,
          valorOriginal: Number(inf.valor_original),
          valorComDesconto:
            inf.valor_com_desconto != null
              ? Number(inf.valor_com_desconto)
              : null,
          boletoDisponivel: inf.boleto_disponivel as boolean,
          linhaDigitavel: (inf.linha_digitavel as string) ?? null,
        };
        await this.tx.audit(trx, {
          dominio: DOM,
          entidade: 'cdt.infracao',
          entidadeId: numeroAit,
          tipoEvento: 'infracao.reconhecer',
          situacaoAnterior: situacao,
          situacaoNova: 'RECONHECIDA',
          payload: resp,
        });
        return { status: 200, body: resp };
      },
    );
  }
}
