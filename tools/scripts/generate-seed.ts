/**
 * generate-seed — deterministic sample data for the SENATRAN mock (INV-DATA-001).
 *
 * Emits SQL into database/seed/ (loaded by `apply.sh --sample`). Payloads are
 * built from the OpenAPI component schemas (D-0010), so field names match the
 * contract exactly. Everything is driven by a fixed-seed PRNG → byte-identical
 * across runs. Fixtures + magic keys are emitted first and never change.
 *
 * Run: pnpm seed:generate
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  Rng,
  cpf,
  cnpj,
  placaMercosul,
  placaLegacy,
  chassi,
  renavam,
  dateTime,
  dateOnly,
} from './lib/br.js';
import {
  UFS,
  MUNICIPIOS,
  MARCAS_MODELOS,
  CORES,
  ESPECIES,
  TIPOS_VEICULO,
  CARROCERIAS,
  CATEGORIAS,
  COMBUSTIVEIS,
  TIPOS_PROPRIETARIO,
  ORGAOS_AUTUADOR,
  SITUACOES_CNH,
  TIPOS_ALTERACAO,
  CODE_GROUPS,
  PRIMEIROS_NOMES,
  SOBRENOMES,
  TIPOS_LOGRADOURO,
  NOMES_LOGRADOURO,
  BAIRROS,
  CATEGORIAS_CNH,
  SEXOS,
  NACIONALIDADES,
  TIPOS_DOCUMENTO,
  PROCEDENCIAS,
  type Code,
} from './lib/refdata.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const seedDir = resolve(root, 'database/seed');
mkdirSync(seedDir, { recursive: true });

const MASTER_SEED = 0x5e17a; // fixed
const spec = parse(
  readFileSync(resolve(root, 'docs/framework/contracts/openapi.yaml'), 'utf8'),
) as {
  components: { schemas: Record<string, JsonSchema> };
};
const schemas = spec.components.schemas;

type JsonSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};
const deref = (s: JsonSchema): JsonSchema =>
  s.$ref ? schemas[s.$ref.split('/').pop() as string] : s;

// ---- SQL emit helpers ------------------------------------------------------
const sqlStr = (v: string | null): string =>
  v === null ? 'null' : `'${v.replace(/'/g, "''")}'`;
const sqlJson = (o: unknown): string =>
  `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
const sqlBool = (b: boolean): string => (b ? 'true' : 'false');

function insert(table: string, cols: string[], rows: string[][]): string {
  if (rows.length === 0) return `-- (no rows for ${table})\n`;
  const values = rows.map((r) => `  (${r.join(', ')})`).join(',\n');
  return `insert into ${table} (${cols.join(', ')}) values\n${values};\n`;
}

// ---- schema-driven payload builder ----------------------------------------
const uf = (rng: Rng): string => rng.pick(UFS);
const groupOf = (field: string): string | undefined => {
  const m = /^(?:codigo|descricao)([A-Z].*)$/.exec(field);
  if (!m) return undefined;
  return m[1] in CODE_GROUPS ? m[1] : undefined;
};

const fullName = (rng: Rng): string =>
  `${rng.pick(PRIMEIROS_NOMES)} ${rng.pick(SOBRENOMES)} ${rng.pick(SOBRENOMES)}`;

/** A readable UPPERCASE phrase from a field name (fallback for free-text). */
const humanize = (field: string): string =>
  field
    .replace(/^(codigo|descricao|numero|data|indicador|tipo)/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\d+$/, '')
    .trim()
    .toUpperCase() || 'REGULAR';

/** Plausible numeric range inferred from the field name. */
const numericFor = (field: string, rng: Rng): number => {
  if (/^ano/i.test(field)) return rng.int(2000, 2025);
  if (/potencia/i.test(field)) return rng.int(60, 400);
  if (/cilindrada/i.test(field)) return rng.int(1000, 4000);
  if (/^(cmt|pbt|cmc)/i.test(field)) return rng.int(800, 45000);
  if (/lotacao/i.test(field)) return rng.int(2, 46);
  if (/eixo/i.test(field)) return rng.int(2, 6);
  if (/(valor|limite|medicao)/i.test(field)) return rng.int(40, 2000);
  return rng.int(0, 999);
};

function buildField(
  field: string,
  schemaIn: JsonSchema,
  rng: Rng,
  ctx: Record<string, unknown>,
  cache: Record<string, Code>,
): unknown {
  const s = deref(schemaIn);
  if (Object.prototype.hasOwnProperty.call(ctx, field)) return ctx[field];

  if (s.type === 'array') {
    const n = rng.int(0, 2);
    const items = s.items ? deref(s.items) : { type: 'string' };
    return Array.from({ length: n }, () => buildValue(items, rng, ctx));
  }
  if (s.type === 'object' || s.properties) return buildValue(s, rng, ctx);
  if (s.type === 'boolean')
    return field.startsWith('indicador') ? rng.bool(0.12) : rng.bool(0.4);
  if (s.type === 'integer' || s.type === 'number') {
    const g = groupOf(field);
    if (g && field.startsWith('codigo')) {
      const c = cache[g] ?? (cache[g] = rng.pick(CODE_GROUPS[g]));
      return Number(c.codigo) || rng.int(1, 99);
    }
    return numericFor(field, rng);
  }
  // string
  if (s.format === 'date-time') return dateTime(rng, 2008, 2024);
  if (s.format === 'date') return dateOnly(rng, 2008, 2024);
  const g = groupOf(field);
  if (g) {
    const c = cache[g] ?? (cache[g] = rng.pick(CODE_GROUPS[g]));
    return field.startsWith('codigo') ? c.codigo : c.descricao;
  }
  if (/cep/i.test(field)) return rng.digits(8);
  if (/uf/i.test(field)) return uf(rng);
  if (/procedencia/i.test(field)) return rng.pick(PROCEDENCIAS);
  if (/nome/i.test(field) && !/(numero|formulario|codigo)/i.test(field))
    return fullName(rng);
  if (field.startsWith('descricao'))
    return rng.bool(0.85) ? humanize(field) : 'INDISPONÍVEL';
  if (field.startsWith('codigo') || field.startsWith('numero'))
    return rng.digits(rng.int(4, 8));
  return rng.bool(0.6) ? humanize(field) : '';
}

function buildValue(
  schemaIn: JsonSchema,
  rng: Rng,
  ctx: Record<string, unknown>,
): unknown {
  const s = deref(schemaIn);
  if (s.type === 'array') {
    const items = s.items ? deref(s.items) : { type: 'string' };
    return Array.from({ length: rng.int(0, 2) }, () =>
      buildValue(items, rng, ctx),
    );
  }
  if (s.properties) {
    const cache: Record<string, Code> = {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.properties))
      out[k] = buildField(k, v, rng, ctx, cache);
    return out;
  }
  if (s.type === 'boolean') return rng.bool(0.4);
  if (s.type === 'integer' || s.type === 'number') return rng.int(0, 999);
  if (s.format === 'date-time') return dateTime(rng, 2015, 2024);
  return '';
}

/** Build an entity payload of the named schema, with ctx overrides applied. */
const payloadOf = (
  schemaName: string,
  rng: Rng,
  ctx: Record<string, unknown>,
): unknown =>
  buildValue({ $ref: `#/components/schemas/${schemaName}` }, rng, ctx);

// ---- pools -----------------------------------------------------------------
const rng = new Rng(MASTER_SEED);

interface Vehicle {
  placa: string;
  chassi: string;
  renavam: string;
  motor: string;
  cambio: string;
  ownerId: string;
  ownerTipo: string;
  ind: Record<string, boolean>;
}
interface Driver {
  cpf: string;
  registro: string;
  renach: string;
  pgu: string;
  pid: string;
  impedimento: string;
  nome: string;
  dataNascimento: string;
  nomeMae: string;
}
type Muni = { codigo: string; uf: string; descricao: string };
type Org = { codigo: string; uf: string; descricao: string };

const endereco = (rng: Rng, m: Muni): Record<string, unknown> => ({
  enderecoLogradouro: `${rng.pick(TIPOS_LOGRADOURO)} ${rng.pick(NOMES_LOGRADOURO)}`,
  enderecoNumero: String(rng.int(1, 3000)),
  enderecoComplemento: rng.bool(0.4) ? `APTO ${rng.int(1, 300)}` : '',
  enderecoBairro: rng.pick(BAIRROS),
  enderecoCep: rng.digits(8),
  enderecoMunicipio: m.codigo,
  descricaoEnderecoMunicipio: m.descricao,
  enderecoUf: m.uf,
});

/** Coherent Condutor anchors: dates derived from birth, one municipio throughout. */
function condutorCtx(rng: Rng, d: Driver): Record<string, unknown> {
  const birthY = Number(d.dataNascimento.slice(0, 4));
  const habY = Math.min(2024, birthY + rng.int(18, 45));
  const muni = rng.pick(MUNICIPIOS);
  const sexo = rng.pick(SEXOS);
  const nac = NACIONALIDADES[rng.bool(0.9) ? 0 : rng.int(1, 2)];
  const doc = rng.pick(TIPOS_DOCUMENTO);
  const sit = rng.bool(0.85) ? SITUACOES_CNH[0] : rng.pick(SITUACOES_CNH);
  const cat = rng.pick(CATEGORIAS_CNH);
  const course = (): string => dateTime(rng, habY, 2024);
  return {
    cpf: d.cpf,
    numeroRegistro: d.registro,
    numeroFormularioRenach: d.renach,
    numeroListaImpedimento: d.impedimento,
    numeroPgu: d.pgu,
    numeroFormularioPid: d.pid,
    nome: d.nome,
    nomeMae: d.nomeMae,
    nomePai: fullName(rng),
    dataNascimento: `${d.dataNascimento}T00:00:00.000Z`,
    sexo: Number(sexo.codigo),
    descricaoSexo: sexo.descricao,
    nacionalidade: Number(nac.codigo),
    descricaoNacionalidade: nac.descricao,
    tipoDocumento: Number(doc.codigo),
    descricaoDocumento: doc.descricao,
    numeroDocumento: rng.digits(9),
    orgaoExpedidorDocumento: 'SSP',
    situacaoCnh: sit.codigo,
    descricaoSituacaoCnh: sit.descricao,
    situacaoCnhAnterior: sit.codigo,
    descricaoSituacaoCnhAnterior: sit.descricao,
    categoriaAtual: cat,
    categoriaAutorizada: cat,
    categoriaRebaixada: '',
    dataPrimeiraHabilitacao: dateTime(rng, habY, habY),
    dataValidadeCnh: dateTime(rng, 2024, 2029),
    dataCadastramento: dateTime(rng, habY, habY),
    dataUltimaEmissaoHistorico: dateTime(rng, 2018, 2024),
    dataTransacaoUltimaAtualizacao: dateTime(rng, 2018, 2024),
    dataValidadePid: dateTime(rng, 2024, 2028),
    ufDominio: muni.uf,
    ufPrimeiraHabilitacao: muni.uf,
    ufHabilitacaoAtual: muni.uf,
    ufExpedidorDocumento: muni.uf,
    ufSolicitanteTransferencia: muni.uf,
    ufExpedicaoPid: muni.uf,
    localidadeNascimento: muni.codigo,
    descricaoLocalidadeNascimento: muni.descricao,
    restricoesMedicas: rng.bool(0.3) ? 'USO DE LENTES CORRETIVAS' : '',
    dataCursoTpp: course(),
    dataCursoTe: course(),
    dataCursoTcp: course(),
    dataCursoTve: course(),
    dataCursoTci: course(),
    dataCursoTmt: course(),
    dataCursoTmf: course(),
    dataCursoReciclagemInfrator: course(),
    dataCursoAtualizacaoRenovacaoCnh: course(),
    // Course UFs pinned to the driver's jurisdiction (coherent with muni/uf).
    ufCursoTpp: muni.uf,
    ufCursoTe: muni.uf,
    ufCursoTcp: muni.uf,
    ufCursoTve: muni.uf,
    ufCursoTci: muni.uf,
    ufCursoTmt: muni.uf,
    ufCursoTmf: muni.uf,
    ufCursoReciclagemInfrator: muni.uf,
    ufCursoAtualizacaoRenovacaoCnh: muni.uf,
    ...endereco(rng, muni),
  };
}

/** Coherent Veiculo anchors: anoFabricacao<=anoModelo, one municipio, plausible specs. */
function veiculoCtx(rng: Rng, v: Vehicle): Record<string, unknown> {
  const anoFab = rng.int(2000, 2024);
  const anoModelo = Math.min(2025, anoFab + rng.int(0, 1));
  const muni = rng.pick(MUNICIPIOS);
  const tipoV = rng.pick(TIPOS_VEICULO);
  const lot =
    tipoV.descricao === 'ONIBUS'
      ? rng.int(20, 45)
      : tipoV.descricao === 'CAMINHAO'
        ? rng.int(2, 3)
        : rng.int(2, 7);
  return {
    chassi: v.chassi,
    placa: v.placa,
    codigoRenavam: v.renavam,
    numeroMotor: v.motor,
    numeroCambio: v.cambio,
    numeroIdentificacaoProprietario: v.ownerId,
    codigoTipoProprietario: v.ownerTipo,
    descricaoTipoProprietario:
      v.ownerTipo === '2' ? 'PESSOA JURIDICA' : 'PESSOA FISICA',
    nomeProprietario: fullName(rng),
    indicadorAlarme: v.ind.ind_alarme,
    indicadorRouboFurto: v.ind.ind_roubo_furto,
    codigoTipoVeiculo: tipoV.codigo,
    descricaoTipoVeiculo: tipoV.descricao,
    anoFabricacao: anoFab,
    anoModelo,
    potencia: rng.int(60, 400),
    cilindradas: rng.int(1000, 4000),
    cmt: rng.int(1000, 6000),
    pbt: rng.int(1000, 6000),
    cmc: rng.int(0, 3000),
    qtdEixos: 2,
    lotacao: lot,
    codigoMunicipioEmplacamento: muni.codigo,
    descricaoMunicipioEmplacamento: muni.descricao,
    ufJurisdicao: muni.uf,
    ufFaturado: muni.uf,
    dataEmissaoCrv: dateTime(rng, anoFab, 2025),
    situacao: rng.bool(0.9) ? 'CIRCULACAO' : 'BAIXADO',
    procedencia: rng.pick(PROCEDENCIAS),
  };
}

/** Coherent Infracao anchors: real órgão, one municipio, plausible fine + speed. */
function infracaoCtx(
  rng: Rng,
  v: Vehicle,
  org: Org,
  ait: string,
  codInf: string,
  renainf: string,
  d: Driver | undefined,
): Record<string, unknown> {
  const muni = rng.pick(MUNICIPIOS);
  const dataInf = dateTime(rng, 2022, 2025);
  return {
    placa: v.placa,
    codigoRenavam: v.renavam,
    autoInfracao: ait,
    numeroAutoInfracao: ait,
    codigoInfracao: codInf,
    codigoRenainf: renainf,
    codigoOrgaoAutuador: org.codigo,
    descricaoOrgaoAutuador: org.descricao,
    ufOrgaoAutuador: org.uf,
    dataCadastroInfracao: dataInf,
    dataInfracao: dataInf,
    codigoMunicipioInfracao: muni.codigo,
    descricaoMunicipioInfracao: muni.descricao,
    codigoMunicipioEmplacamento: muni.codigo,
    descricaoMunicipioEmplacamento: muni.descricao,
    // Secondary UFs anchored to the emplacamento município so the whole record
    // agrees (jurisdição, emplacamento informado, CNH expedition, pagamento).
    getufJurisdicaoVeiculo: muni.uf,
    getufEmplacamentoInformada: muni.uf,
    ufExpedicaoCnhCondutor: muni.uf,
    ufExpedicaoCnhRealCondutor: muni.uf,
    ufExpedicaoCnhPontuada: muni.uf,
    ufOrigemDesvinculacao: muni.uf,
    ufPagamento: muni.uf,
    valorIntegralInfracao: rng.pick([88.38, 130.16, 195.23, 293.47]),
    medicaoReal: rng.int(60, 140),
    limitePermitido: 60,
    medicaoConsiderada: rng.int(55, 135),
    nomePossuidor: fullName(rng),
    numeroRegistroCnhCondutor: d?.registro ?? '',
  };
}

const VEH = 120,
  DRV = 80,
  INFR = 250;
const vehicles: Vehicle[] = [];
const drivers: Driver[] = [];

// Stable fixtures captured during emit → published to database/seed/manifest.json
// so siblings (pec, teat) can rely on known-good keys without reading raw SQL.
let fixClinica: { codigoClinica: string; cnpj: string; uf: string } | undefined;
let fixExaminador: { cpf: string; conselho: string; uf: string } | undefined;
let fixRenachTipo = '';
let fixAit:
  | {
      numeroAit: string;
      situacao: string;
      situacaoProcesso: string;
      codigoOrgaoAutuador: string;
      placa: string;
      codigoInfracao: string;
    }
  | undefined;

// Forced-scenario magic keys — single source for both the SQL emit and the
// published manifest. [kind, keyValue, forcedStatus, meaning].
const SCENARIO_KEYS: readonly [string, string, number, string][] = [
  [
    'cpf_usuario',
    '00000000000',
    401,
    '401 → Não autorizado: CPF de usuário reservado.',
  ],
  [
    'placa',
    'ERR2A02',
    402,
    '402 → RENAINF.CASE.INVALID_STATUS — cenário de erro de negócio reservado.',
  ],
  ['chassi', 'ERR00000000000402', 402, '402 → erro de negócio reservado.'],
  ['cpf', '00000000402', 402, '402 → erro de negócio reservado.'],
  ['cnpj', '00000000000402', 402, '402 → erro de negócio reservado.'],
  ['renavam', '00000000402', 402, '402 → erro de negócio reservado.'],
  ['placa', 'ERR5A00', 500, '500 → erro interno reservado.'],
  ['chassi', 'ERR00000000000500', 500, '500 → erro interno reservado.'],
  ['cpf', '00000000500', 500, '500 → erro interno reservado.'],
  ['cnpj', '00000000000500', 500, '500 → erro interno reservado.'],
  ['renavam', '00000000500', 500, '500 → erro interno reservado.'],
];

const noInd = (): Record<string, boolean> => ({
  ind_alarme: false,
  ind_roubo_furto: false,
  ind_transferencia: false,
  ind_licenciamento: false,
  ind_circulacao: false,
  ind_penhora: false,
  ind_media_monta: false,
  ind_grande_monta: false,
  ind_recuperado: false,
});

// Fixtures (stable, emitted first).
const FIX_CPF = '52998224725'; // valid CPF (fixed)
const FIX_CNPJ = '11444777000161'; // valid CNPJ (fixed)
vehicles.push({
  placa: 'ABC1D23',
  chassi: '9BWZZZ377VT004251',
  renavam: '00123456780',
  motor: 'MOT0000001',
  cambio: 'CAM0000001',
  ownerId: FIX_CPF,
  ownerTipo: '1',
  ind: noInd(),
});
vehicles.push({
  placa: 'ABC1234',
  chassi: '9BWZZZ377VT004252',
  renavam: '00123456781',
  motor: 'MOT0000002',
  cambio: 'CAM0000002',
  ownerId: FIX_CNPJ,
  ownerTipo: '2',
  ind: noInd(),
});
vehicles.push({
  placa: 'IND1I01',
  chassi: '9BWZZZ377VT004253',
  renavam: '00123456782',
  motor: 'MOT0000003',
  cambio: 'CAM0000003',
  ownerId: FIX_CPF,
  ownerTipo: '1',
  ind: {
    ...noInd(),
    ind_alarme: true,
    ind_roubo_furto: true,
    ind_transferencia: true,
    ind_penhora: true,
  },
});

for (let i = vehicles.length; i < VEH; i++) {
  const legacy = rng.bool(0.3);
  const isCnpj = rng.bool(0.3);
  vehicles.push({
    placa: legacy ? placaLegacy(rng) : placaMercosul(rng),
    chassi: chassi(rng),
    renavam: renavam(rng),
    motor: 'MOT' + rng.digits(7),
    cambio: 'CAM' + rng.digits(7),
    ownerId: isCnpj ? cnpj(rng) : cpf(rng),
    ownerTipo: isCnpj ? '2' : '1',
    ind: (() => {
      const x = noInd();
      if (rng.bool(0.15)) x.ind_roubo_furto = true;
      if (rng.bool(0.1)) x.ind_alarme = true;
      if (rng.bool(0.08)) x.ind_penhora = true;
      if (rng.bool(0.06)) x.ind_media_monta = true;
      return x;
    })(),
  });
}

drivers.push({
  cpf: FIX_CPF,
  registro: '01234567890',
  renach: 'RN0000000001',
  pgu: 'PGU0000001',
  pid: 'PID0000001',
  impedimento: 'IMP0000001',
  nome: 'MARIA SILVA 01',
  dataNascimento: '1985-03-14',
  nomeMae: 'JOANA SILVA',
});
for (let i = drivers.length; i < DRV; i++) {
  drivers.push({
    cpf: cpf(rng),
    registro: rng.digits(11),
    renach: 'RN' + rng.digits(10),
    pgu: 'PGU' + rng.digits(7),
    pid: 'PID' + rng.digits(7),
    impedimento: 'IMP' + rng.digits(7),
    nome: fullName(rng),
    dataNascimento: dateOnly(rng, 1955, 2004),
    nomeMae: fullName(rng),
  });
}

// ---- emit: reference tables ------------------------------------------------
{
  const parts: string[] = [
    '-- SENATRAN mock seed — reference tables (generated).',
  ];
  parts.push(
    insert(
      'senatran.ref_uf',
      ['uf', 'nome'],
      UFS.map((u) => [sqlStr(u), sqlStr(u)]),
    ),
  );
  parts.push(
    insert(
      'senatran.ref_municipio',
      ['codigo', 'uf', 'nome'],
      MUNICIPIOS.map((m) => [
        sqlStr(m.codigo),
        sqlStr(m.uf),
        sqlStr(m.descricao),
      ]),
    ),
  );
  const refPairs: [string, readonly Code[]][] = [
    ['ref_marca_modelo', MARCAS_MODELOS],
    ['ref_cor', CORES],
    ['ref_especie', ESPECIES],
    ['ref_tipo_veiculo', TIPOS_VEICULO],
    ['ref_carroceria', CARROCERIAS],
    ['ref_categoria', CATEGORIAS],
    ['ref_combustivel', COMBUSTIVEIS],
    ['ref_tipo_proprietario', TIPOS_PROPRIETARIO],
    ['ref_situacao_cnh', SITUACOES_CNH],
  ];
  for (const [t, list] of refPairs)
    parts.push(
      insert(
        `senatran.${t}`,
        ['codigo', 'descricao'],
        list.map((c) => [sqlStr(c.codigo), sqlStr(c.descricao)]),
      ),
    );
  parts.push(
    insert(
      'senatran.ref_orgao_autuador',
      ['codigo', 'uf', 'nome'],
      ORGAOS_AUTUADOR.map((o) => [
        sqlStr(o.codigo),
        sqlStr(o.uf),
        sqlStr(o.descricao),
      ]),
    ),
  );
  parts.push(
    insert(
      'senatran.ref_tipo_alteracao',
      ['codigo', 'descricao', 'codigo_sistema'],
      TIPOS_ALTERACAO.map((t) => [
        sqlStr(t.codigo),
        sqlStr(t.descricao),
        String(t.codigoSistema),
      ]),
    ),
  );
  writeFileSync(resolve(seedDir, '10-ref.sql'), parts.join('\n') + '\n');
}

// ---- emit: read entities ---------------------------------------------------
{
  const parts: string[] = [
    '-- SENATRAN mock seed — read entities (generated).',
  ];

  // veiculo
  const vrows = vehicles.map((v) => {
    const ctx = veiculoCtx(rng, v);
    const payload = payloadOf('Veiculo', rng, ctx);
    return [
      sqlStr(v.chassi),
      sqlStr(v.placa),
      sqlStr(v.renavam),
      sqlStr(v.motor),
      sqlStr(v.cambio),
      sqlStr(v.ownerId),
      sqlStr(v.ownerTipo),
      sqlBool(v.ind.ind_alarme),
      sqlBool(v.ind.ind_roubo_furto),
      sqlBool(v.ind.ind_transferencia),
      sqlBool(v.ind.ind_licenciamento),
      sqlBool(v.ind.ind_circulacao),
      sqlBool(v.ind.ind_penhora),
      sqlBool(v.ind.ind_media_monta),
      sqlBool(v.ind.ind_grande_monta),
      sqlBool(v.ind.ind_recuperado),
      sqlJson(payload),
    ];
  });
  parts.push(
    insert(
      'senatran.veiculo',
      [
        'chassi',
        'placa',
        'codigo_renavam',
        'numero_motor',
        'numero_cambio',
        'id_proprietario',
        'tipo_proprietario',
        'ind_alarme',
        'ind_roubo_furto',
        'ind_transferencia',
        'ind_licenciamento',
        'ind_circulacao',
        'ind_penhora',
        'ind_media_monta',
        'ind_grande_monta',
        'ind_recuperado',
        'payload',
      ],
      vrows,
    ),
  );

  // condutor
  const crows = drivers.map((d) => {
    const ctx = condutorCtx(rng, d);
    const payload = payloadOf('Condutor', rng, ctx);
    return [
      sqlStr(d.cpf),
      sqlStr(d.registro),
      sqlStr(d.renach),
      sqlStr(d.impedimento),
      sqlStr(d.pgu),
      sqlStr(d.pid),
      sqlStr(d.nome),
      sqlStr(d.dataNascimento),
      sqlStr(d.nomeMae),
      sqlJson(payload),
    ];
  });
  parts.push(
    insert(
      'senatran.condutor',
      [
        'cpf',
        'numero_registro',
        'numero_formulario_renach',
        'numero_lista_impedimento',
        'numero_pgu',
        'numero_formulario_pid',
        'nome',
        'data_nascimento',
        'nome_mae',
        'payload',
      ],
      crows,
    ),
  );

  // condutor_imagem (subset of drivers)
  const imgRows = drivers.slice(0, 40).map((d) => {
    const seg = rng.digits(9);
    const ctx = {
      cpf: d.cpf,
      numeroRegistro: d.registro,
      numeroSeguranca: seg,
    } as Record<string, string>;
    return [
      sqlStr(d.cpf),
      sqlStr(d.registro),
      sqlStr(seg),
      sqlJson(payloadOf('CondutorImagem', rng, ctx)),
    ];
  });
  parts.push(
    insert(
      'senatran.condutor_imagem',
      ['cpf', 'numero_registro', 'numero_seguranca', 'payload'],
      imgRows,
    ),
  );

  // condutor_infracao_item (extrato items per driver subset)
  const extRows: string[][] = [];
  for (const d of drivers.slice(0, 30)) {
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++)
      extRows.push([
        sqlStr(d.registro),
        sqlJson(
          payloadOf('CondutorInfracaoExtratoItem', rng, {
            numeroRegistroCnh: d.registro,
          } as Record<string, string>),
        ),
      ]);
  }
  parts.push(
    insert(
      'senatran.condutor_infracao_item',
      ['numero_registro_cnh', 'payload'],
      extRows,
    ),
  );

  // infracao (linked to vehicles + optionally drivers) + ocorrencia/pagamento
  const irows: string[][] = [],
    iocor: string[][] = [],
    ipag: string[][] = [];
  for (let i = 0; i < INFR; i++) {
    const v = rng.pick(vehicles);
    const d = rng.bool(0.6) ? rng.pick(drivers) : undefined;
    const org = rng.pick(ORGAOS_AUTUADOR);
    const ait = rng.digits(10);
    const codInf = String(rng.int(50000, 79999));
    const renainf = rng.digits(12);
    const ctx = {
      ...infracaoCtx(rng, v, org, ait, codInf, renainf, d),
      numeroRegistroCnh: d?.registro ?? '',
      cpf: d?.cpf ?? '',
      uf: org.uf,
    };
    const situ = rng.pick(['1', '2', '3']);
    irows.push([
      sqlStr(ait),
      sqlStr(org.codigo),
      sqlStr(codInf),
      sqlStr(renainf),
      sqlStr(d?.cpf ?? null),
      sqlStr(v.ownerTipo === '2' ? v.ownerId : null),
      sqlStr(d?.registro ?? null),
      sqlStr(d?.pgu ?? null),
      sqlStr(org.uf),
      sqlStr(v.placa),
      sqlStr(situ),
      sqlStr(null),
      sqlJson(payloadOf('Infracao', rng, ctx)),
    ]);
    if (rng.bool(0.4))
      iocor.push([
        sqlStr(ait),
        sqlStr(org.codigo),
        sqlStr(codInf),
        sqlJson(payloadOf('InfracaoOcorrencia', rng, ctx)),
      ]);
    if (rng.bool(0.3))
      ipag.push([
        sqlStr(ait),
        sqlStr(org.codigo),
        sqlStr(codInf),
        sqlJson(payloadOf('InfracaoPagamento', rng, ctx)),
      ]);
  }
  parts.push(
    insert(
      'senatran.infracao',
      [
        'auto_infracao',
        'codigo_orgao_autuador',
        'codigo_infracao',
        'codigo_renainf',
        'cpf',
        'cnpj',
        'numero_registro_cnh',
        'numero_pgu',
        'uf',
        'placa',
        'situacao_exigibilidade',
        'identificacao_hab_estr',
        'payload',
      ],
      irows,
    ),
  );
  parts.push(
    insert(
      'senatran.infracao_ocorrencia',
      ['auto_infracao', 'codigo_orgao_autuador', 'codigo_infracao', 'payload'],
      iocor,
    ),
  );
  parts.push(
    insert(
      'senatran.infracao_pagamento',
      ['auto_infracao', 'codigo_orgao_autuador', 'codigo_infracao', 'payload'],
      ipag,
    ),
  );

  // vehicle-linked sub-resources
  const rjRows = vehicles
    .filter((v) => v.ind.ind_penhora || rng.bool(0.1))
    .map((v) => [
      sqlStr(v.placa),
      sqlStr(v.renavam),
      sqlJson(
        payloadOf('RestricaoJudicialProcesso', rng, {
          placa: v.placa,
          renavam: v.renavam,
        } as Record<string, string>),
      ),
    ]);
  parts.push(
    insert(
      'senatran.restricao_judicial_processo',
      ['placa', 'renavam', 'payload'],
      rjRows,
    ),
  );

  const rfRows = vehicles
    .filter((v) => v.ind.ind_roubo_furto)
    .map((v) => [
      sqlStr(v.placa),
      sqlStr(v.chassi),
      sqlJson(
        payloadOf('RouboFurtoOcorrencia', rng, {
          placa: v.placa,
          chassi: v.chassi,
        } as Record<string, string>),
      ),
    ]);
  parts.push(
    insert(
      'senatran.roubo_furto_ocorrencia',
      ['placa', 'chassi', 'payload'],
      rfRows,
    ),
  );

  const csvSegRows = vehicles.slice(0, 60).map((v) => {
    const cod = rng.digits(9);
    return [
      sqlStr(cod),
      sqlStr(v.ownerTipo === '1' ? v.ownerId : null),
      sqlStr(v.ownerTipo === '2' ? v.ownerId : null),
      sqlStr(v.renavam),
      sqlStr(v.placa),
      sqlJson(
        payloadOf('CodigoSegurancaCrv', rng, {
          placa: v.placa,
          chassi: v.chassi,
          codigoRenavam: v.renavam,
        } as Record<string, string>),
      ),
    ];
  });
  parts.push(
    insert(
      'senatran.csv_seguranca',
      ['codigo_seguranca_crv', 'cpf', 'cnpj', 'renavam', 'placa', 'payload'],
      csvSegRows,
    ),
  );

  const consCsvRows = vehicles.slice(0, 60).map((v) => [
    sqlStr(v.chassi),
    sqlStr(v.placa),
    sqlJson(
      payloadOf('ConsultaCsv', rng, {
        placa: v.placa,
        chassi: v.chassi,
      } as Record<string, string>),
    ),
  ]);
  parts.push(
    insert(
      'senatran.consulta_csv',
      ['chassi', 'placa', 'payload'],
      consCsvRows,
    ),
  );

  const cvRows = vehicles.slice(0, 50).map((v) => [
    sqlStr(v.ownerTipo === '1' ? v.ownerId : null),
    sqlStr(v.ownerTipo === '2' ? v.ownerId : null),
    sqlStr(v.renavam),
    sqlStr(v.placa),
    sqlJson(
      payloadOf('ComunicacaoVenda', rng, {
        placa: v.placa,
        codigoRenavam: v.renavam,
      } as Record<string, string>),
    ),
  ]);
  parts.push(
    insert(
      'senatran.comunicacao_venda',
      ['cpf', 'cnpj', 'renavam', 'placa', 'payload'],
      cvRows,
    ),
  );

  const epRows = vehicles.slice(0, 60).map((v) => [
    sqlStr(v.placa),
    sqlStr(v.renavam),
    sqlJson(
      payloadOf('EnderecoPossuidor', rng, {
        placa: v.placa,
        renavam: v.renavam,
      } as Record<string, string>),
    ),
  ]);
  parts.push(
    insert(
      'senatran.endereco_possuidor',
      ['placa', 'renavam', 'payload'],
      epRows,
    ),
  );

  const miRows = vehicles.slice(0, 40).map((v) => [
    sqlStr(v.ownerTipo === '1' ? v.ownerId : null),
    sqlStr(v.ownerTipo === '2' ? v.ownerId : null),
    sqlStr(v.renavam),
    sqlStr(v.placa),
    sqlJson(
      payloadOf('MultaInterestadualResponse', rng, {
        placa: v.placa,
        codigoRenavam: v.renavam,
      } as Record<string, string>),
    ),
  ]);
  parts.push(
    insert(
      'senatran.multa_interestadual',
      ['cpf', 'cnpj', 'renavam', 'placa', 'payload'],
      miRows,
    ),
  );

  const recRows = vehicles
    .slice(0, 40)
    .map((v) => [
      sqlStr(v.chassi),
      sqlJson(
        payloadOf('RecallResponse', rng, { chassi: v.chassi } as Record<
          string,
          string
        >),
      ),
    ]);
  parts.push(insert('senatran.recall', ['chassi', 'payload'], recRows));

  const apRows = TIPOS_ALTERACAO.map((t) => [
    sqlJson({
      mapeamentoAutomatico: false,
      codigoTipoAlteracao: t.codigo,
      codigoAlteracao: t.codigo,
      descricaoAlteracao: t.descricao,
      codigoSistema: t.codigoSistema,
    }),
  ]);
  parts.push(insert('senatran.alteracao_permitida', ['payload'], apRows));

  writeFileSync(resolve(seedDir, '20-read.sql'), parts.join('\n') + '\n');
}

// ---- emit: mock control plane ---------------------------------------------
{
  const parts: string[] = [
    '-- SENATRAN mock seed — control plane (generated).',
  ];
  parts.push(
    insert(
      'mock.usuario_autorizado',
      ['cpf', 'cert_cn', 'nome', 'ativo'],
      [
        [
          sqlStr('12345678909'),
          sqlStr('senatran-dev-client'),
          sqlStr('Usuário Dev'),
          'true',
        ],
        [
          sqlStr(FIX_CPF),
          sqlStr('senatran-dev-client'),
          sqlStr('Fixture'),
          'true',
        ],
      ],
    ),
  );
  parts.push(
    insert(
      'mock.scenario_key',
      ['kind', 'key_value', 'force_status', 'message'],
      SCENARIO_KEYS.map((r) => [
        sqlStr(r[0]),
        sqlStr(r[1]),
        String(r[2]),
        sqlStr(r[3]),
      ]),
    ),
  );
  writeFileSync(resolve(seedDir, '30-mock.sql'), parts.join('\n') + '\n');
}

// ---- emit: transactional (RENACH/RENAINF) + audit -------------------------
const uuid = (r: Rng): string => {
  const h = () => r.int(0, 15).toString(16);
  const s = (n: number) => Array.from({ length: n }, h).join('');
  return `${s(8)}-${s(4)}-4${s(3)}-${['8', '9', 'a', 'b'][r.int(0, 3)]}${s(3)}-${s(12)}`;
};
const audit: string[][] = [];
const auditEvt = (
  dominio: string,
  entidade: string,
  id: string,
  tipo: string,
  sit: string,
  payload: unknown,
): void => {
  audit.push([
    sqlStr(uuid(rng)),
    sqlStr(dominio),
    sqlStr(entidade),
    sqlStr(id),
    sqlStr(tipo),
    sqlStr(null),
    sqlStr(sit),
    sqlStr('12345678909'),
    sqlJson(payload),
    `audit.payload_hash(${sqlJson(payload)})`,
  ]);
};
{
  const parts: string[] = ['-- SENATRAN mock seed — RENACH (generated).'];
  const clinicas = Array.from({ length: 20 }, (_, i) => {
    const cod = 'RS-CLINIC-' + String(i + 1).padStart(4, '0');
    const cnj = cnpj(rng);
    const u = uf(rng);
    // Draw unconditionally to keep the PRNG stream stable; clinic[0] is a
    // guaranteed-credentialed fixture (published in manifest.json).
    const credRaw = rng.bool(0.85),
      ativaRaw = rng.bool(0.9);
    const cred = i === 0 ? true : credRaw,
      ativa = i === 0 ? true : ativaRaw;
    return { cod, cnj, u, cred, ativa };
  });
  fixClinica = {
    codigoClinica: clinicas[0].cod,
    cnpj: clinicas[0].cnj,
    uf: clinicas[0].u,
  };
  parts.push(
    insert(
      'renach.clinica',
      [
        'codigo_clinica',
        'cnpj',
        'nome',
        'uf',
        'credenciada',
        'ativa',
        'payload',
      ],
      clinicas.map((c) => [
        sqlStr(c.cod),
        sqlStr(c.cnj),
        sqlStr('CLINICA ' + c.cod),
        sqlStr(c.u),
        sqlBool(c.cred),
        sqlBool(c.ativa),
        sqlJson({
          codigoClinica: c.cod,
          cnpj: c.cnj,
          nome: 'CLINICA ' + c.cod,
          uf: c.u,
          credenciada: c.cred,
          ativa: c.ativa,
        }),
      ]),
    ),
  );
  const profs = Array.from({ length: 40 }, (_, i) => {
    const c = cpf(rng);
    const conselho = rng.bool(0.6) ? 'CRM' : 'CRP';
    const cl = rng.pick(clinicas);
    const credRaw = rng.bool(0.9);
    const ativoRaw = rng.bool(0.92);
    // prof[0] is a guaranteed credentialed CRM examiner on clinic[0] (manifest).
    if (i === 0)
      return {
        c,
        conselho: 'CRM',
        cl: clinicas[0].cod,
        u: clinicas[0].u,
        cred: true,
        ativo: true,
      };
    return { c, conselho, cl: cl.cod, u: cl.u, cred: credRaw, ativo: ativoRaw };
  });
  fixExaminador = { cpf: profs[0].c, conselho: 'CRM', uf: profs[0].u };
  parts.push(
    insert(
      'renach.profissional',
      [
        'cpf',
        'conselho',
        'numero_conselho',
        'uf',
        'codigo_clinica',
        'credenciado',
        'ativo',
        'payload',
      ],
      profs.map((p) => [
        sqlStr(p.c),
        sqlStr(p.conselho),
        sqlStr(rng.digits(5)),
        sqlStr(p.u),
        sqlStr(p.cl),
        sqlBool(p.cred),
        sqlBool(p.ativo),
        sqlJson({
          cpf: p.c,
          conselho: p.conselho,
          uf: p.u,
          codigoClinica: p.cl,
          credenciado: p.cred,
          ativo: p.ativo,
        }),
      ]),
    ),
  );
  const SIT_RENACH = [
    'ABERTO',
    'AGUARDANDO_MEDICO',
    'AGENDADO',
    'EXAME_REGISTRADO',
    'APROVADO',
    'REJEITADO',
  ];
  const procs = [
    { numero: 'RS123456789', cpf: FIX_CPF, sit: 'AGUARDANDO_MEDICO' },
    ...Array.from({ length: 40 }, () => ({
      numero: 'RN' + rng.digits(9),
      cpf: rng.pick(drivers).cpf,
      sit: rng.pick(SIT_RENACH),
    })),
  ];
  parts.push(
    insert(
      'renach.processo',
      [
        'numero_renach',
        'cpf',
        'tipo_processo',
        'situacao',
        'categoria_atual',
        'categoria_pretendida',
        'payload',
      ],
      procs.map((p) => {
        const tipo = rng.pick([
          'PRIMEIRA_HABILITACAO',
          'RENOVACAO',
          'MUDANCA_CATEGORIA',
          'ADICAO_CATEGORIA',
        ]);
        if (p.numero === 'RS123456789') fixRenachTipo = tipo;
        const payload = {
          numeroRenach: p.numero,
          cpf: p.cpf,
          tipoProcesso: tipo,
          situacao: p.sit,
          categoriaAtual: 'B',
          categoriaPretendida: 'B',
        };
        auditEvt(
          'RENACH',
          'renach.processo',
          p.numero,
          'processo.seed',
          p.sit,
          payload,
        );
        return [
          sqlStr(p.numero),
          sqlStr(p.cpf),
          sqlStr(tipo),
          sqlStr(p.sit),
          sqlStr('B'),
          sqlStr('B'),
          sqlJson(payload),
        ];
      }),
    ),
  );
  writeFileSync(resolve(seedDir, '40-renach.sql'), parts.join('\n') + '\n');
}
{
  const parts: string[] = ['-- SENATRAN mock seed — RENAINF (generated).'];
  const disp = Array.from({ length: 15 }, (_, i) => ({
    id: 'DEV-' + String(i + 1).padStart(4, '0'),
    org: rng.pick(ORGAOS_AUTUADOR).codigo,
    hom: rng.bool(0.85),
    ativo: rng.bool(0.9),
  }));
  parts.push(
    insert(
      'renainf.dispositivo',
      [
        'id_dispositivo',
        'codigo_orgao_autuador',
        'homologado',
        'ativo',
        'payload',
      ],
      disp.map((d) => [
        sqlStr(d.id),
        sqlStr(d.org),
        sqlBool(d.hom),
        sqlBool(d.ativo),
        sqlJson({
          idDispositivo: d.id,
          codigoOrgaoAutuador: d.org,
          homologado: d.hom,
          ativo: d.ativo,
        }),
      ]),
    ),
  );
  // AITs + processes at representative states, reusing vehicle plates.
  const SIT_CASE = [
    'AUTUACAO_ABERTA',
    'NOTIFICADO_AUTUACAO',
    'AGUARDANDO_DEFESA_PREVIA',
    'PENALIDADE_IMPOSTA',
    'RECURSO_JARI_APRESENTADO',
    'ARQUIVADO',
  ];
  const aitRows: string[][] = [],
    procRows: string[][] = [],
    debRows: string[][] = [];
  const fixtures = [
    { ait: 'A0001001', sit: 'NOTIFICADO_AUTUACAO', pid: uuid(rng) },
  ];
  const aits = [
    ...fixtures,
    ...Array.from({ length: 60 }, () => ({
      ait: 'A' + rng.digits(7),
      sit: rng.pick(SIT_CASE),
      pid: uuid(rng),
    })),
  ];
  for (const a of aits) {
    const v = rng.pick(vehicles);
    const org = rng.pick(ORGAOS_AUTUADOR);
    const codInf = String(rng.int(50000, 79999));
    const aid = uuid(rng);
    const aitPayload = {
      numeroAit: a.ait,
      codigoOrgaoAutuador: org.codigo,
      placa: v.placa,
      codigoInfracao: codInf,
      situacao: a.sit,
    };
    // The AIT-record status the read view exposes (v_renainf_ait overrides the
    // payload situacao with this column); distinct from the case lifecycle sit.
    const aitStatus =
      a.sit === 'AUTUACAO_ABERTA' ? 'VALIDADO' : 'AUTUACAO_ABERTA';
    if (a.ait === 'A0001001')
      fixAit = {
        numeroAit: a.ait,
        situacao: aitStatus,
        situacaoProcesso: a.sit,
        codigoOrgaoAutuador: org.codigo,
        placa: v.placa,
        codigoInfracao: codInf,
      };
    aitRows.push([
      sqlStr(aid),
      sqlStr(a.ait),
      sqlStr(org.codigo),
      sqlStr(aitStatus),
      sqlStr(v.placa),
      sqlStr(codInf),
      sqlStr(dateTime(rng, 2024, 2025)),
      sqlStr(cpf(rng)),
      sqlStr(rng.pick(disp).id),
      sqlJson(aitPayload),
    ]);
    const procPayload = {
      idProcesso: a.pid,
      numeroAit: a.ait,
      situacao: a.sit,
    };
    procRows.push([
      sqlStr(a.pid),
      sqlStr(aid),
      sqlStr(a.sit),
      sqlJson(procPayload),
    ]);
    auditEvt(
      'RENAINF',
      'renainf.processo',
      a.pid,
      'processo.seed',
      a.sit,
      procPayload,
    );
    if (
      ['PENALIDADE_IMPOSTA', 'RECURSO_JARI_APRESENTADO', 'ARQUIVADO'].includes(
        a.sit,
      )
    ) {
      debRows.push([
        sqlStr(a.pid),
        String(rng.int(100, 2000)) + '.00',
        sqlStr(rng.bool(0.5) ? 'EM_ABERTO' : 'QUITADO'),
        sqlStr(dateOnly(rng, 2025, 2026)),
        sqlJson({
          idProcesso: a.pid,
          valor: 195.23,
          situacaoPagamento: 'EM_ABERTO',
        }),
      ]);
    }
  }
  parts.push(
    insert(
      'renainf.ait',
      [
        'id',
        'numero_ait',
        'codigo_orgao_autuador',
        'situacao',
        'placa',
        'codigo_infracao',
        'data_infracao',
        'cpf_agente',
        'id_dispositivo',
        'payload',
      ],
      aitRows,
    ),
  );
  parts.push(
    insert(
      'renainf.processo',
      ['id', 'ait_id', 'situacao', 'payload'],
      procRows,
    ),
  );
  parts.push(
    insert(
      'renainf.debito',
      [
        'processo_id',
        'valor',
        'situacao_pagamento',
        'data_vencimento',
        'payload',
      ],
      debRows,
    ),
  );
  writeFileSync(resolve(seedDir, '50-renainf.sql'), parts.join('\n') + '\n');
}
{
  const parts: string[] = ['-- SENATRAN mock seed — audit trail (generated).'];
  parts.push(
    insert(
      'audit.evento',
      [
        'id',
        'dominio',
        'entidade',
        'entidade_id',
        'tipo_evento',
        'situacao_anterior',
        'situacao_nova',
        'cpf_usuario',
        'payload',
        'payload_hash',
      ],
      audit,
    ),
  );
  writeFileSync(resolve(seedDir, '60-audit.sql'), parts.join('\n') + '\n');
}

// ---- emit: fixtures manifest (machine-readable, for siblings) --------------
{
  const drv = drivers[0];
  const manifest = {
    $comment:
      'Deterministic fixtures for sibling integration (pec, teat). ' +
      'Generated by `pnpm seed:generate` — do not edit by hand. ' +
      'Every value below is guaranteed present after `apply.sh --sample`.',
    masterSeed: '0x' + MASTER_SEED.toString(16),
    auth: {
      cpfUsuario: '12345678909',
      certCn: 'senatran-dev-client',
      note: 'Send x-cpf-usuario on every request; x-client-cert-cn is only checked when AUTH_CERT_SIMULATION=on.',
    },
    magicKeys: SCENARIO_KEYS.map(([kind, value, status, meaning]) => ({
      kind,
      value,
      status,
      meaning,
    })),
    read: {
      veiculos: [
        {
          placa: 'ABC1D23',
          chassi: '9BWZZZ377VT004251',
          renavam: '00123456780',
          proprietario: { documento: FIX_CPF, tipo: '1' },
          indicadores: 'todos limpos (nenhuma restrição)',
        },
        {
          placa: 'ABC1234',
          chassi: '9BWZZZ377VT004252',
          renavam: '00123456781',
          proprietario: { documento: FIX_CNPJ, tipo: '2' },
          indicadores: 'todos limpos (nenhuma restrição)',
        },
        {
          placa: 'IND1I01',
          chassi: '9BWZZZ377VT004253',
          renavam: '00123456782',
          proprietario: { documento: FIX_CPF, tipo: '1' },
          indicadores: 'alarme, roubo/furto, transferência e penhora ativos',
        },
      ],
      condutor: {
        cpf: drv.cpf,
        registro: drv.registro,
        numeroRenach: drv.renach,
        nome: drv.nome,
        dataNascimento: drv.dataNascimento,
      },
    },
    renach: {
      processo: {
        numeroRenach: 'RS123456789',
        cpf: FIX_CPF,
        situacao: 'AGUARDANDO_MEDICO',
        tipoProcesso: fixRenachTipo,
      },
      clinicaCredenciada: fixClinica,
      examinadorCredenciado: fixExaminador,
    },
    renainf: {
      ait: fixAit,
      note: 'GET /v1/renainf/autosInfracao/{numeroAit} returns `situacao` (the AIT-record status); `situacaoProcesso` is the administrative-case lifecycle state.',
    },
    counts: {
      veiculos: vehicles.length,
      condutores: drivers.length,
      infracoes: INFR,
      clinicas: 20,
      profissionais: 40,
      processosRenach: 41,
      aitsRenainf: 61,
      dispositivos: 15,
    },
  };
  writeFileSync(
    resolve(seedDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}

console.log(
  'generate-seed: wrote database/seed/{10-ref,20-read,30-mock,40-renach,50-renainf,60-audit}.sql + manifest.json',
);
console.log(
  `  vehicles=${vehicles.length} drivers=${drivers.length} infracoes=${INFR} audit=${audit.length}`,
);
