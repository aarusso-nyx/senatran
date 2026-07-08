import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';
import {
  loadContract,
  success2xxSchema,
  validateAgainstSchema,
  type JsonSchema,
} from '../utils/schema-validate.js';

/**
 * Contract conformance for the TRANSACTIONAL surface (RENACH/RENAINF). The read
 * conformance spec covers the 57 GET endpoints; this one drives the stateful
 * write flows and validates every response body against the schema the contract
 * declares for that status — strictly (undeclared fields, type/enum/format
 * mismatches fail). 2xx bodies validate against the operation's success schema;
 * non-2xx against ErrorResponse. Sub-flows that would collide on process state
 * each open their own fresh process, so every endpoint is exercised at a 2xx.
 */
const T = loadContract('openapi-transactional.yaml');
const schemas = T.components.schemas;
const ERR: JsonSchema = { $ref: '#/components/schemas/ErrorResponse' };

let ctx: TestApp;
const violations: string[] = [];
let covered = 0;
let ok2xx = 0;

const seen = new Set<string>();
const nonOk: string[] = [];
/** Validate a response against the contract op for (method, template). */
function check(
  method: string,
  tmpl: string,
  res: { status: number; body: unknown; text: string },
): void {
  covered++;
  seen.add(`${method} ${tmpl}`);
  const op = T.paths[tmpl]?.[method];
  if (!op) {
    violations.push(`${method} ${tmpl}: no such operation in contract`);
    return;
  }
  const is2xx = res.status >= 200 && res.status < 300;
  if (is2xx) ok2xx++;
  else nonOk.push(`${res.status} ${method} ${tmpl}`);
  const schema = is2xx ? success2xxSchema(op) : ERR;
  if (!schema) {
    violations.push(`${method} ${tmpl}: no schema for status ${res.status}`);
    return;
  }
  const body = res.text && res.text.length ? JSON.parse(res.text) : res.body;
  validateAgainstSchema(
    body,
    schema,
    schemas,
    `${res.status} ${method} ${tmpl}`,
    violations,
  );
}

const post = (p: string, body: unknown) =>
  request(ctx.server)
    .post(p)
    .set(AUTH)
    .set('Content-Type', 'application/json')
    .send(body as object);
const patch = (p: string, body: unknown) =>
  request(ctx.server)
    .patch(p)
    .set(AUTH)
    .set('Content-Type', 'application/json')
    .send(body as object);
const get = (p: string) => request(ctx.server).get(p).set(AUTH);

let uniq = 0;
const freshCpf = () =>
  `9${Date.now().toString().slice(-9)}${uniq++}`.slice(0, 11);
const openProc = async (tipo = 'RENOVACAO'): Promise<string> => {
  const r = await post('/v1/renach/processos', {
    cpf: freshCpf(),
    tipoProcesso: tipo,
    categoriaAtual: 'B',
    categoriaPretendida: 'B',
  });
  return r.body.numeroRenach as string;
};

beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('transactional contract conformance', () => {
  it('RENACH: every response conforms to its declared schema', async () => {
    // credentialed clinic + CRM examiner from the live lists
    const clinicas = (await get('/v1/renach/clinicasCredenciadas'))
      .body as Array<{
      codigoClinica: string;
      cnpj: string;
    }>;
    const profs = (await get('/v1/renach/profissionaisCredenciados'))
      .body as Array<{ cpf: string; conselho: string; uf: string }>;
    const clinica = clinicas[0];
    const examinador = profs.find((p) => p.conselho === 'CRM')!;

    // --- main flow: open → read → eligibility → schedule → check-in → exam ---
    const cpf = freshCpf();
    const open = await post('/v1/renach/processos', {
      cpf,
      tipoProcesso: 'RENOVACAO',
      categoriaAtual: 'B',
      categoriaPretendida: 'B',
    });
    check('post', '/renach/processos', open);
    const numero = open.body.numeroRenach as string;

    check(
      'get',
      '/renach/processos',
      await get(`/v1/renach/processos?cpf=${cpf}&tipoProcesso=RENOVACAO`),
    );
    check(
      'get',
      '/renach/processos/{numeroRenach}',
      await get(`/v1/renach/processos/${numero}`),
    );
    check(
      'post',
      '/renach/processos/{numeroRenach}/elegibilidadeExame',
      await post(`/v1/renach/processos/${numero}/elegibilidadeExame`, {
        tipoProcesso: 'RENOVACAO',
      }),
    );
    check(
      'get',
      '/renach/clinicasCredenciadas',
      await get('/v1/renach/clinicasCredenciadas'),
    );
    check(
      'get',
      '/renach/profissionaisCredenciados',
      await get('/v1/renach/profissionaisCredenciados'),
    );

    const ag = await post(`/v1/renach/processos/${numero}/agendamentos`, {
      dataHora: '2026-08-01T09:00:00Z',
      codigoClinica: clinica.codigoClinica,
      cpfCondutor: cpf,
    });
    check('post', '/renach/processos/{numeroRenach}/agendamentos', ag);
    const idAg = ag.body.idAgendamento as string;

    check(
      'patch',
      '/renach/agendamentos/{idAgendamento}',
      await patch(`/v1/renach/agendamentos/${idAg}`, {
        dataHora: '2026-08-02T09:00:00Z',
      }),
    );
    check(
      'post',
      '/renach/agendamentos/{idAgendamento}/checkin',
      await post(`/v1/renach/agendamentos/${idAg}/checkin`, {
        cpfCondutor: cpf,
      }),
    );

    const exameBody = {
      idAgendamento: idAg,
      clinica: { codigoClinica: clinica.codigoClinica, cnpj: clinica.cnpj },
      examinador: {
        cpf: examinador.cpf,
        conselho: 'CRM',
        numeroConselho: '12345',
        uf: examinador.uf,
      },
      condutor: { cpf, nome: 'Fulano', dataNascimento: '1990-02-10' },
      processo: { numeroRenach: numero, tipoProcesso: 'RENOVACAO' },
      exame: { dataRealizacao: '2026-08-02T10:00:00Z', resultado: 'APTO' },
    };
    const ex = await post(
      `/v1/renach/processos/${numero}/examesMedicos`,
      exameBody,
    );
    check('post', '/renach/processos/{numeroRenach}/examesMedicos', ex);
    const idExame = ex.body.idExame as string;

    check(
      'get',
      '/renach/processos/{numeroRenach}/exames',
      await get(`/v1/renach/processos/${numero}/exames`),
    );
    check(
      'post',
      '/renach/exames/{idExame}/retificacoes',
      await post(`/v1/renach/exames/${idExame}/retificacoes`, {
        motivo: 'Correção de digitação.',
        resultado: 'APTO',
      }),
    );

    // --- junta sub-flow on a fresh process ---
    const numJunta = await openProc('PRIMEIRA_HABILITACAO');
    check(
      'post',
      '/renach/processos/{numeroRenach}/encaminhamentosJunta',
      await post(`/v1/renach/processos/${numJunta}/encaminhamentosJunta`, {
        motivo: 'Resultado inconclusivo.',
      }),
    );
    check(
      'post',
      '/renach/processos/{numeroRenach}/pareceresJunta',
      await post(`/v1/renach/processos/${numJunta}/pareceresJunta`, {
        resultado: 'APTO',
      }),
    );

    // --- psychological eval on a fresh first-license process ---
    const numPsi = await openProc('PRIMEIRA_HABILITACAO');
    const crp = profs.find((p) => p.conselho === 'CRP');
    check(
      'post',
      '/renach/processos/{numeroRenach}/avaliacoesPsicologicas',
      await post(`/v1/renach/processos/${numPsi}/avaliacoesPsicologicas`, {
        idAgendamento: 'appt-psi',
        clinica: { codigoClinica: clinica.codigoClinica, cnpj: clinica.cnpj },
        examinador: {
          cpf: crp?.cpf ?? examinador.cpf,
          conselho: 'CRP',
          numeroConselho: '54321',
          uf: crp?.uf ?? examinador.uf,
        },
        avaliacao: {
          dataRealizacao: '2026-08-03T10:00:00Z',
          resultado: 'APTO',
        },
      }),
    );
  });

  it('RENAINF: every response conforms to its declared schema', async () => {
    const org = '204020';
    check(
      'post',
      '/renainf/talonario/dispositivos',
      await post('/v1/renainf/talonario/dispositivos', {
        idDispositivo: `DEV-T${uniq++}`,
        codigoOrgaoAutuador: org,
        descricao: 'Talonário de teste',
      }),
    );
    check(
      'get',
      '/renainf/talonario/sincronizacao',
      await get('/v1/renainf/talonario/sincronizacao'),
    );
    check(
      'post',
      '/renainf/talonario/faixasNumeracaoAit',
      await post('/v1/renainf/talonario/faixasNumeracaoAit', {
        codigoOrgaoAutuador: org,
        numeroInicial: '900000',
        numeroFinal: '900100',
      }),
    );

    const ait = `C${Date.now().toString().slice(-7)}${uniq++}`;
    const validAit = {
      numeroAit: ait,
      codigoOrgaoAutuador: org,
      agenteAutuador: { cpf: '52998224725', matricula: 'AGT1' },
      infracao: {
        codigoInfracao: '74550',
        dataInfracao: '2026-01-01T10:00:00Z',
        codigoMunicipio: '3550308',
        local: { descricao: 'Av. Exemplo, 1000' },
      },
      veiculo: { placa: 'ABC1D23' },
      evidencias: [{ tipo: 'PHOTO', hash: 'sha256' }],
    };
    check(
      'post',
      '/renainf/autosInfracao',
      await post('/v1/renainf/autosInfracao', validAit),
    );
    check(
      'post',
      '/renainf/autosInfracao/lotes',
      await post('/v1/renainf/autosInfracao/lotes', {
        autos: [{ ...validAit, numeroAit: `${ait}L` }],
      }),
    );
    check(
      'get',
      '/renainf/autosInfracao/{numeroAit}',
      await get(`/v1/renainf/autosInfracao/${ait}`),
    );
    check(
      'post',
      '/renainf/autosInfracao/{numeroAit}/solicitacoesCancelamento',
      await post(`/v1/renainf/autosInfracao/${ait}/solicitacoesCancelamento`, {
        motivo: 'Erro material.',
      }),
    );

    const proc = await post('/v1/renainf/processosAdministrativos', {
      numeroAit: ait,
    });
    check('post', '/renainf/processosAdministrativos', proc);
    const id = proc.body.idProcesso as string;

    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/notificacoes/autuacao',
      await post(
        `/v1/renainf/processosAdministrativos/${id}/notificacoes/autuacao`,
        {
          dataNotificacao: '2026-01-10T10:00:00Z',
        },
      ),
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/indicacoesCondutor',
      await post(
        `/v1/renainf/processosAdministrativos/${id}/indicacoesCondutor`,
        {
          requerente: {
            tipoRequerente: 'PROPRIETARIO',
            numeroDocumento: '52998224725',
          },
          condutorIndicado: { cpf: '52998224725', nome: 'Fulano' },
          dataProtocolo: '2026-01-15T10:00:00Z',
        },
      ),
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/defesasPrevias',
      await post(`/v1/renainf/processosAdministrativos/${id}/defesasPrevias`, {
        requerente: {
          tipoRequerente: 'PROPRIETARIO',
          numeroDocumento: '52998224725',
        },
        fundamentacao: 'Defesa tempestiva.',
        dataProtocolo: '2026-01-20T10:00:00Z',
      }),
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/penalidades',
      await post(`/v1/renainf/processosAdministrativos/${id}/penalidades`, {
        valorMulta: 195.23,
      }),
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/notificacoes/penalidade',
      await post(
        `/v1/renainf/processosAdministrativos/${id}/notificacoes/penalidade`,
        {
          dataNotificacao: '2026-02-01T10:00:00Z',
        },
      ),
    );
    const rec = await post(
      `/v1/renainf/processosAdministrativos/${id}/recursos`,
      {
        instancia: 'JARI',
        requerente: {
          tipoRequerente: 'PROPRIETARIO',
          numeroDocumento: '52998224725',
        },
        fundamentacao: 'Recurso JARI.',
      },
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/recursos',
      rec,
    );
    const idRec = rec.body.idRecurso as string;

    check(
      'post',
      '/renainf/recursos/{idRecurso}/julgamento',
      await post(`/v1/renainf/recursos/${idRec}/julgamento`, {
        resultado: 'PROVIDO',
      }),
    );
    check(
      'get',
      '/renainf/processosAdministrativos/{idProcesso}/debito',
      await get(`/v1/renainf/processosAdministrativos/${id}/debito`),
    );
    check(
      'post',
      '/renainf/processosAdministrativos/{idProcesso}/pagamentos',
      await post(`/v1/renainf/processosAdministrativos/${id}/pagamentos`, {
        valorPago: 195.23,
        dataPagamento: '2026-02-10T10:00:00Z',
        formaPagamento: 'PIX',
        numeroComprovante: 'CMP-1',
      }),
    );
  });

  it('RENAEST: every response conforms to its declared schema', async () => {
    // Unique natural tuple per run so dedup never turns the submit into a 402.
    const org = `DETRAN-CONF-${uniq++}-${Date.now().toString().slice(-6)}`;
    const crash = {
      dataHoraSinistro: '2024-09-01T08:15:00.000Z',
      uf: 'SP',
      codigoMunicipio: '3550308',
      gravidade: 'COM_VITIMA_FERIDA',
      local: 'KM 55 - via urbana',
      orgaoResponsavel: org,
      condicoesVia: 'SECA',
      condicoesMeteorologicas: 'BOM',
      versaoLeiaute: '1.0',
      vitimas: [{ gravidadeLesao: 'LEVE', tipoEnvolvido: 'CONDUTOR' }],
      referencias: { renavam: '00123456780' },
    };
    const sub = await post('/v1/renaest/sinistros', crash);
    check('post', '/renaest/sinistros', sub);
    const idSinistro = sub.body.idSinistro as string;
    const protocolo = sub.body.protocolo as string;

    check(
      'get',
      '/renaest/sinistros/{idSinistro}',
      await get(`/v1/renaest/sinistros/${idSinistro}`),
    );
    check(
      'get',
      '/renaest/protocolos/{protocolo}',
      await get(`/v1/renaest/protocolos/${protocolo}`),
    );
    check(
      'post',
      '/renaest/sinistros/lotes',
      await post('/v1/renaest/sinistros/lotes', {
        sinistros: [
          { ...crash, orgaoResponsavel: `${org}-L1` },
          {
            ...crash,
            orgaoResponsavel: `${org}-L2`,
            uf: 'RJ',
            codigoMunicipio: '3304557',
          },
        ],
      }),
    );
    check(
      'post',
      '/renaest/sinistros/{idSinistro}/complementos',
      await post(`/v1/renaest/sinistros/${idSinistro}/complementos`, {
        motivo: 'Dado complementar.',
      }),
    );
    check(
      'post',
      '/renaest/sinistros/{idSinistro}/correcoes',
      await post(`/v1/renaest/sinistros/${idSinistro}/correcoes`, {
        motivo: 'Correção de gravidade.',
        gravidade: 'COM_VITIMA_FERIDA',
      }),
    );
  });

  it('SNE / CDT / DETRAN: every response conforms to its declared schema', async () => {
    const ait = () => `CF${Date.now().toString().slice(-8)}${uniq++}`;
    // --- SNE ---
    check(
      'get',
      '/sne/adesoes/veiculos/{placa}',
      await get('/v1/sne/adesoes/veiculos/ABC1D23'),
    );
    check(
      'get',
      '/sne/adesoes/cidadaos/{cpf}',
      await get('/v1/sne/adesoes/cidadaos/52998224725'),
    );
    check(
      'get',
      '/sne/orgaos/{codigoOrgaoAutuador}/adesao',
      await get('/v1/sne/orgaos/204020/adesao'),
    );
    const aut = await post('/v1/sne/notificacoes/autuacao', {
      numeroAit: ait(),
      codigoOrgaoAutuador: '204020',
      placa: 'ABC1D23',
      cpfDestinatario: '52998224725',
    });
    check('post', '/sne/notificacoes/autuacao', aut);
    check(
      'post',
      '/sne/notificacoes/penalidade',
      await post('/v1/sne/notificacoes/penalidade', {
        numeroAit: ait(),
        codigoOrgaoAutuador: '204020',
        placa: 'ABC1D23',
      }),
    );
    check(
      'get',
      '/sne/notificacoes/{protocolo}',
      await get(`/v1/sne/notificacoes/${aut.body.protocolo}`),
    );
    check(
      'post',
      '/sne/notificacoes/{protocolo}/cancelamento',
      await post(`/v1/sne/notificacoes/${aut.body.protocolo}/cancelamento`, {
        motivo: 'x',
      }),
    );

    // --- CDT (reconhecimento targets A0001002, disjoint from other e2e files) ---
    check(
      'get',
      '/cdt/cidadaos/{cpf}/notificacoes',
      await get('/v1/cdt/cidadaos/52998224725/notificacoes'),
    );
    check(
      'get',
      '/cdt/cidadaos/{cpf}/infracoes',
      await get('/v1/cdt/cidadaos/52998224725/infracoes'),
    );
    check(
      'get',
      '/cdt/cidadaos/{cpf}/veiculos',
      await get('/v1/cdt/cidadaos/52998224725/veiculos'),
    );
    check(
      'get',
      '/cdt/cidadaos/{cpf}/cnh',
      await get('/v1/cdt/cidadaos/52998224725/cnh'),
    );
    check(
      'get',
      '/cdt/infracoes/{numeroAit}/pagamento',
      await get('/v1/cdt/infracoes/A0001001/pagamento'),
    );
    check(
      'post',
      '/cdt/infracoes/{numeroAit}/reconhecimento',
      await post('/v1/cdt/infracoes/A0001002/reconhecimento', {}),
    );

    // --- DETRAN bridge (active UF SP) ---
    check(
      'post',
      '/detrans/{uf}/renavam/consultasVeiculo',
      await post('/v1/detrans/SP/renavam/consultasVeiculo', {
        placa: 'ABC1D23',
        versaoLeiaute: '1.0',
      }),
    );
    check(
      'post',
      '/detrans/{uf}/renach/consultasCondutor',
      await post('/v1/detrans/SP/renach/consultasCondutor', {
        cpf: '52998224725',
      }),
    );
    check(
      'post',
      '/detrans/{uf}/renainf/autosInfracao',
      await post('/v1/detrans/SP/renainf/autosInfracao', { numeroAit: ait() }),
    );
    check(
      'get',
      '/detrans/{uf}/renainf/autosInfracao/{numeroAit}',
      await get('/v1/detrans/SP/renainf/autosInfracao/A0001001'),
    );
    check(
      'post',
      '/detrans/{uf}/renaest/sinistros',
      await post('/v1/detrans/SP/renaest/sinistros', { dados: {} }),
    );
    check(
      'post',
      '/detrans/{uf}/sne/notificacoes',
      await post('/v1/detrans/SP/sne/notificacoes', { numeroAit: ait() }),
    );
  });

  it('validated every transactional operation with no schema drift', () => {
    // every transactional path in the contract should have been exercised
    const declared = Object.entries(T.paths).flatMap(([p, ops]) =>
      Object.keys(ops)
        .filter((m) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map((m) => `${m} ${p}`),
    );
    const missing = declared.filter((d) => !seen.has(d));
    if (missing.length)
      console.warn(
        `transactional ops not exercised:\n  ${missing.join('\n  ')}`,
      );
    if (violations.length)
      console.error(`conformance violations:\n  ${violations.join('\n  ')}`);
    console.info(
      `transactional conformance: ${covered} calls, ${ok2xx} at 2xx, ${violations.length} violations, ${declared.length - missing.length}/${declared.length} ops covered`,
    );

    if (nonOk.length)
      console.warn(`non-2xx (validated as errors):\n  ${nonOk.join('\n  ')}`);

    expect(violations).toEqual([]);
    expect(missing).toEqual([]);
    // most operations should reach a 2xx so their success schema is exercised
    expect(ok2xx).toBeGreaterThanOrEqual(28);
  });
});
