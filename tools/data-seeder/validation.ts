import {
  isValidChassi,
  isValidCnpj,
  isValidCpf,
  isValidPlate,
  isValidRenavam,
} from '../scripts/lib/br.js';
import {
  CARROCERIAS,
  CATEGORIAS,
  CORES,
  COMBUSTIVEIS,
  ESPECIES,
  MARCAS_MODELOS,
  MUNICIPIOS,
  SITUACOES_CNH,
  TIPOS_PROPRIETARIO,
  TIPOS_VEICULO,
  type Code,
} from '../scripts/lib/refdata.js';
import type { CondutorCandidate, VeiculoCandidate } from './generators.js';
import { validateOpenApiPayload } from './openapi.js';

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`Validation failed: ${message}`);
};

const assertPair = (
  payload: Record<string, unknown>,
  codeField: string,
  descriptionField: string,
  values: readonly Code[],
): void => {
  const item = values.find(
    (candidate) => candidate.codigo === payload[codeField],
  );
  assert(item, `${codeField} is not curated`);
  assert(
    item.descricao === payload[descriptionField],
    `${codeField}/${descriptionField} mismatch`,
  );
};

const unique = (values: (string | undefined)[], label: string): void => {
  const present = values.filter(
    (value): value is string => value !== undefined,
  );
  assert(new Set(present).size === present.length, `${label} is not unique`);
};

export const validateCondutores = (
  candidates: readonly CondutorCandidate[],
): void => {
  unique(
    candidates.map((item) => item.cpf),
    'cpf',
  );
  unique(
    candidates.map((item) => item.numeroRegistro),
    'numeroRegistro',
  );
  unique(
    candidates.map((item) => item.numeroFormularioRenach),
    'numeroFormularioRenach',
  );
  unique(
    candidates.map((item) => item.numeroListaImpedimento),
    'numeroListaImpedimento',
  );
  unique(
    candidates.map((item) => item.numeroPgu),
    'numeroPgu',
  );
  unique(
    candidates.map((item) => item.numeroFormularioPid),
    'numeroFormularioPid',
  );
  for (const candidate of candidates) {
    const payload = candidate.payload;
    assert(isValidCpf(candidate.cpf), `invalid CPF ${candidate.cpf}`);
    assert(
      /^\d{11}$/.test(candidate.numeroRegistro),
      'invalid CNH registration',
    );
    assert(
      /^RN\d{10}$/.test(candidate.numeroFormularioRenach),
      'invalid RENACH',
    );
    assert(
      validateOpenApiPayload('Condutor', payload).length === 0,
      'Condutor payload/OpenAPI mismatch',
    );
    const anchors: [string, unknown][] = [
      ['cpf', candidate.cpf],
      ['numeroRegistro', candidate.numeroRegistro],
      ['numeroFormularioRenach', candidate.numeroFormularioRenach],
      ['numeroListaImpedimento', candidate.numeroListaImpedimento],
      ['numeroPgu', candidate.numeroPgu],
      ['numeroFormularioPid', candidate.numeroFormularioPid],
      ['nome', candidate.nome],
      ['dataNascimento', `${candidate.dataNascimento}T00:00:00.000Z`],
      ['nomeMae', candidate.nomeMae],
    ];
    for (const [field, expected] of anchors) {
      if (expected === undefined)
        assert(!(field in payload), `${field} must be omitted`);
      else assert(payload[field] === expected, `${field} anchor mismatch`);
    }
    const birth = new Date(String(payload.dataNascimento));
    const age =
      2025 -
      birth.getUTCFullYear() -
      (birth.getUTCMonth() > 0 || birth.getUTCDate() > 1 ? 1 : 0);
    assert(age >= 18 && age <= 80, 'driver age outside 18..80');
    assert(
      Date.parse(String(payload.dataPrimeiraHabilitacao)) > birth.getTime(),
      'first license before birth',
    );
    assert(
      Date.parse(String(payload.dataUltimaEmissaoHistorico)) >=
        Date.parse(String(payload.dataPrimeiraHabilitacao)),
      'issue before first license',
    );
    const municipality = MUNICIPIOS.find(
      (item) => item.codigo === payload.enderecoMunicipio,
    );
    assert(municipality?.uf === payload.enderecoUf, 'municipality/UF mismatch');
    const situation = SITUACOES_CNH.find(
      (item) => item.codigo === payload.situacaoCnh,
    );
    assert(
      situation?.descricao === payload.descricaoSituacaoCnh,
      'CNH situation mismatch',
    );
    const occurrences = payload.ocorrencias;
    assert(Array.isArray(occurrences), 'ocorrencias must be an array');
    assert(
      payload.quantidadeOcorrenciasImpedimentos === occurrences.length,
      'occurrence count mismatch',
    );
  }
  if (candidates.length === 10_000) {
    const counts = new Map<string, number>();
    for (const item of candidates)
      counts.set(
        String(item.payload.situacaoCnh),
        (counts.get(String(item.payload.situacaoCnh)) ?? 0) + 1,
      );
    assert(counts.get('A') === 8_000, 'active CNH distribution');
    assert(counts.get('V') === 1_000, 'expired CNH distribution');
    assert(
      (counts.get('B') ?? 0) + (counts.get('S') ?? 0) === 500,
      'blocked/suspended CNH distribution',
    );
    assert((counts.get('C') ?? 0) === 500, 'other CNH distribution');
  }
};

export const validateVeiculos = (
  candidates: readonly VeiculoCandidate[],
): void => {
  unique(
    candidates.map((item) => item.chassi),
    'chassi',
  );
  unique(
    candidates.map((item) => item.placa),
    'placa',
  );
  unique(
    candidates.map((item) => item.codigoRenavam),
    'RENAVAM',
  );
  unique(
    candidates.map((item) => item.numeroMotor),
    'numeroMotor',
  );
  unique(
    candidates.map((item) => item.numeroCambio),
    'numeroCambio',
  );
  for (const candidate of candidates) {
    const payload = candidate.payload;
    assert(isValidChassi(candidate.chassi), 'invalid chassi');
    assert(isValidPlate(candidate.placa), 'invalid plate');
    assert(isValidRenavam(candidate.codigoRenavam), 'invalid RENAVAM');
    assert(
      candidate.tipoProprietario === '1'
        ? isValidCpf(candidate.idProprietario)
        : isValidCnpj(candidate.idProprietario),
      'owner document/type mismatch',
    );
    assert(
      validateOpenApiPayload('Veiculo', payload).length === 0,
      'Veiculo payload/OpenAPI mismatch',
    );
    for (const [field, expected] of [
      ['chassi', candidate.chassi],
      ['placa', candidate.placa],
      ['codigoRenavam', candidate.codigoRenavam],
      ['numeroMotor', candidate.numeroMotor],
      ['numeroCambio', candidate.numeroCambio],
      ['numeroIdentificacaoProprietario', candidate.idProprietario],
      ['codigoTipoProprietario', candidate.tipoProprietario],
      ['indicadorAlarme', candidate.indicators.alarme],
      ['indicadorRouboFurto', false],
    ] as [string, unknown][]) {
      if (expected === undefined)
        assert(!(field in payload), `${field} must be omitted`);
      else assert(payload[field] === expected, `${field} anchor mismatch`);
    }
    assert(
      Number(payload.anoFabricacao) <= Number(payload.anoModelo),
      'model year before manufacture',
    );
    assert(
      Number(payload.anoModelo) <= Number(payload.anoFabricacao) + 1,
      'model year too late',
    );
    const municipality = MUNICIPIOS.find(
      (item) => item.codigo === payload.codigoMunicipioEmplacamento,
    );
    assert(
      municipality !== undefined &&
        municipality.uf === payload.ufJurisdicao &&
        municipality.descricao === payload.descricaoMunicipioEmplacamento,
      'vehicle municipality mismatch',
    );
    assertPair(
      payload,
      'codigoTipoVeiculo',
      'descricaoTipoVeiculo',
      TIPOS_VEICULO,
    );
    assertPair(
      payload,
      'codigoMarcaModelo',
      'descricaoMarcaModelo',
      MARCAS_MODELOS,
    );
    assertPair(
      payload,
      'codigoEspecieVeiculo',
      'descricaoEspecieVeiculo',
      ESPECIES,
    );
    assertPair(
      payload,
      'codigoTipoCarroceria',
      'descricaoTipoCarroceria',
      CARROCERIAS,
    );
    assertPair(payload, 'codigoCor', 'descricaoCor', CORES);
    assertPair(payload, 'codigoCategoria', 'descricaoCategoria', CATEGORIAS);
    assertPair(
      payload,
      'codigoCombustivel',
      'descricaoCombustivel',
      COMBUSTIVEIS,
    );
    assertPair(
      payload,
      'codigoTipoProprietario',
      'descricaoTipoProprietario',
      TIPOS_PROPRIETARIO,
    );
    assert(
      !candidate.indicators.rouboFurto &&
        !candidate.indicators.transferencia &&
        !candidate.indicators.licenciamento &&
        !candidate.indicators.circulacao &&
        !candidate.indicators.penhora,
      'out-of-scope indicator enabled',
    );
    assert(
      Number(candidate.indicators.mediaMonta) +
        Number(candidate.indicators.grandeMonta) +
        Number(candidate.indicators.recuperado) <=
        1,
      'contradictory damage profile',
    );
  }
  if (candidates.length === 10_000) {
    const mercosul = candidates.filter((item) =>
      /^[A-Z]{3}\d[A-Z]\d{2}$/.test(item.placa),
    ).length;
    assert(mercosul === 7_000, 'Mercosul distribution');
    assert(candidates.length - mercosul === 3_000, 'legacy plate distribution');
  }
};
