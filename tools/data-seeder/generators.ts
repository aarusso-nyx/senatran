import {
  chassi,
  cnpj,
  cpf,
  placaLegacy,
  placaMercosul,
  renavam,
} from '../scripts/lib/br.js';
import {
  CARROCERIAS,
  CATEGORIAS,
  CATEGORIAS_CNH,
  CORES,
  COMBUSTIVEIS,
  ESPECIES,
  MARCAS_MODELOS,
  MUNICIPIOS,
  SITUACOES_CNH,
  TIPOS_PROPRIETARIO,
  TIPOS_VEICULO,
} from '../scripts/lib/refdata.js';
import {
  createGenerationStream,
  syntheticName,
  syntheticStreet,
} from './deterministic.js';
import { buildCompletePayload } from './openapi.js';

export interface CondutorCandidate {
  cpf: string;
  numeroRegistro: string;
  numeroFormularioRenach: string;
  numeroListaImpedimento?: string;
  numeroPgu?: string;
  numeroFormularioPid?: string;
  nome: string;
  dataNascimento: string;
  nomeMae: string;
  payload: Record<string, unknown>;
}

export interface VeiculoCandidate {
  chassi: string;
  placa: string;
  codigoRenavam: string;
  numeroMotor?: string;
  numeroCambio?: string;
  idProprietario: string;
  tipoProprietario: '1' | '2';
  indicators: {
    alarme: boolean;
    rouboFurto: false;
    transferencia: false;
    licenciamento: false;
    circulacao: false;
    penhora: false;
    mediaMonta: boolean;
    grandeMonta: boolean;
    recuperado: boolean;
  };
  payload: Record<string, unknown>;
}

export interface GenerationResult<T> {
  candidates: T[];
  attempts: number;
}

const iso = (year: number, month = 1, day = 1): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;

const driverIdentity = (seed: number, index: number) => {
  const stream = createGenerationStream(seed, `condutor:identity:${index}`);
  return {
    cpf: cpf(stream.rng),
    numeroRegistro: stream.rng.digits(11),
    numeroFormularioRenach: `RN${stream.rng.digits(10)}`,
  };
};

const condutorSituation = (index: number) => {
  const slot = index % 20;
  if (slot < 16) return SITUACOES_CNH.find((item) => item.codigo === 'A')!;
  if (slot < 18) return SITUACOES_CNH.find((item) => item.codigo === 'V')!;
  if (slot === 18) return SITUACOES_CNH.find((item) => item.codigo === 'B')!;
  return SITUACOES_CNH.find((item) => item.codigo === 'C')!;
};

export const generateCondutores = (
  rows: number,
  seed: number,
): GenerationResult<CondutorCandidate> => {
  const candidates: CondutorCandidate[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  for (let index = 0; index < rows; index += 1) {
    for (let retry = 0; retry < 100; retry += 1) {
      attempts += 1;
      const identity = driverIdentity(seed + retry, index);
      const identityKey = Object.values(identity).join('|');
      if (seen.has(identityKey)) continue;
      seen.add(identityKey);
      const stream = createGenerationStream(seed, `condutor:content:${index}`);
      const birthYear = 1945 + stream.rng.int(0, 61);
      const birthMonth = stream.rng.int(1, 12);
      const birthDay = stream.rng.int(1, 28);
      const firstLicenseYear = Math.min(
        2024,
        birthYear + stream.rng.int(18, 35),
      );
      const issueYear = Math.max(firstLicenseYear, 2015 + stream.rng.int(0, 9));
      const situation = condutorSituation(index);
      const validityYear =
        situation.codigo === 'V' ? 2024 : 2025 + stream.rng.int(1, 8);
      const municipality = MUNICIPIOS[index % MUNICIPIOS.length];
      const category = CATEGORIAS_CNH[index % CATEGORIAS_CNH.length];
      const numeroListaImpedimento =
        index % 5 === 0 ? `IMP${String(index).padStart(7, '0')}` : undefined;
      const numeroPgu =
        index % 3 === 0 ? undefined : `PGU${String(index).padStart(7, '0')}`;
      const numeroFormularioPid =
        index % 4 === 0 ? `PID${String(index).padStart(7, '0')}` : undefined;
      const nome = syntheticName(stream);
      const nomeMae = syntheticName(stream);
      const dataNascimento = iso(birthYear, birthMonth, birthDay);
      const payload = buildCompletePayload('Condutor', stream, {
        mapeamentoAutomatico: true,
        ufDominio: municipality.uf,
        ...identity,
        numeroFormularioCnh: identity.numeroRegistro,
        numeroListaImpedimento,
        nome,
        dataNascimento,
        sexo: index % 2 === 0 ? 1 : 2,
        descricaoSexo: index % 2 === 0 ? 'MASCULINO' : 'FEMININO',
        nomeMae,
        cpf: identity.cpf,
        localidadeNascimento: municipality.codigo,
        descricaoLocalidadeNascimento: municipality.descricao,
        nacionalidade: 1,
        descricaoNacionalidade: 'BRASILEIRA',
        dataCadastramento: iso(issueYear),
        enderecoLogradouro: syntheticStreet(stream),
        enderecoMunicipio: municipality.codigo,
        descricaoEnderecoMunicipio: municipality.descricao,
        enderecoUf: municipality.uf,
        numeroPgu,
        dataPrimeiraHabilitacao: iso(firstLicenseYear),
        ufPrimeiraHabilitacao: municipality.uf,
        categoriaAtual: category,
        categoriaAutorizada: category,
        dataValidadeCnh: iso(validityYear),
        ufHabilitacaoAtual: municipality.uf,
        situacaoCnh: situation.codigo,
        descricaoSituacaoCnh: situation.descricao,
        dataUltimaEmissaoHistorico: iso(issueYear),
        dataTransacaoUltimaAtualizacao: iso(issueYear),
        numeroFormularioPid,
        dataValidadePid: numeroFormularioPid ? iso(validityYear) : undefined,
        ufExpedicaoPid: numeroFormularioPid ? municipality.uf : undefined,
        numeroFormularioCnhBasePid: numeroFormularioPid
          ? identity.numeroRegistro
          : undefined,
        restricoesMedicas:
          index % 2 === 0 ? undefined : 'USO DE LENTES CORRETIVAS',
        quantidadeOcorrenciasImpedimentos: numeroListaImpedimento ? 1 : 0,
        ocorrencias: numeroListaImpedimento
          ? [{ numero: numeroListaImpedimento }]
          : [],
      });
      for (const optional of [
        'numeroListaImpedimento',
        'numeroPgu',
        'numeroFormularioPid',
        'dataValidadePid',
        'ufExpedicaoPid',
        'numeroFormularioCnhBasePid',
        'restricoesMedicas',
      ]) {
        if (payload[optional] === undefined) delete payload[optional];
      }
      candidates.push({
        ...identity,
        numeroListaImpedimento,
        numeroPgu,
        numeroFormularioPid,
        nome,
        dataNascimento: dataNascimento.slice(0, 10),
        nomeMae,
        payload,
      });
      break;
    }
    if (candidates.length !== index + 1)
      throw new Error('Condutor collision retry limit reached');
  }
  return { candidates, attempts };
};

const vehicleOwner = (
  seed: number,
  index: number,
): { id: string; type: '1' | '2' } => {
  if (index % 4 !== 3)
    return { id: driverIdentity(seed, index % 50).cpf, type: '1' };
  const stream = createGenerationStream(seed, `veiculo:owner:${index}`);
  return { id: cnpj(stream.rng), type: '2' };
};

export const generateVeiculos = (
  rows: number,
  seed: number,
): GenerationResult<VeiculoCandidate> => {
  const candidates: VeiculoCandidate[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const mercosulCount = Math.floor(rows * 0.7);
  for (let index = 0; index < rows; index += 1) {
    for (let retry = 0; retry < 100; retry += 1) {
      attempts += 1;
      const stream = createGenerationStream(seed + retry, `veiculo:${index}`);
      const identity = {
        chassi: chassi(stream.rng),
        placa:
          index < mercosulCount
            ? placaMercosul(stream.rng)
            : placaLegacy(stream.rng),
        codigoRenavam: renavam(stream.rng),
      };
      const key = Object.values(identity).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const municipality = MUNICIPIOS[index % MUNICIPIOS.length];
      const type = TIPOS_VEICULO[index % TIPOS_VEICULO.length];
      const model = MARCAS_MODELOS[index % MARCAS_MODELOS.length];
      const species = ESPECIES[index % ESPECIES.length];
      const body = CARROCERIAS[index % CARROCERIAS.length];
      const color = CORES[index % CORES.length];
      const category = CATEGORIAS[index % CATEGORIAS.length];
      const fuel = COMBUSTIVEIS[index % COMBUSTIVEIS.length];
      const owner = vehicleOwner(seed, index);
      const ownerType = TIPOS_PROPRIETARIO.find(
        (item) => item.codigo === owner.type,
      )!;
      const year = 1990 + stream.rng.int(0, 34);
      const numeroMotor =
        index % 5 === 0 ? undefined : `MOT${String(index).padStart(7, '0')}`;
      const numeroCambio =
        index % 7 === 0 ? undefined : `CAM${String(index).padStart(7, '0')}`;
      const profile = index % 20;
      const mediaMonta = profile === 1;
      const grandeMonta = profile === 2;
      const recuperado = profile === 3;
      const indicators = {
        alarme: profile === 4,
        rouboFurto: false as const,
        transferencia: false as const,
        licenciamento: false as const,
        circulacao: false as const,
        penhora: false as const,
        mediaMonta,
        grandeMonta,
        recuperado,
      };
      const heavy = ['4', '14'].includes(type.codigo);
      const payload = buildCompletePayload('Veiculo', stream, {
        mapeamentoAutomatico: true,
        ...identity,
        situacao: index % 10 === 0 ? 'BAIXADO' : 'EM CIRCULACAO',
        codigoMunicipioEmplacamento: municipality.codigo,
        descricaoMunicipioEmplacamento: municipality.descricao,
        ufJurisdicao: municipality.uf,
        codigoTipoVeiculo: type.codigo,
        descricaoTipoVeiculo: type.descricao,
        codigoMarcaModelo: model.codigo,
        descricaoMarcaModelo: model.descricao,
        codigoEspecieVeiculo: species.codigo,
        descricaoEspecieVeiculo: species.descricao,
        codigoTipoCarroceria: body.codigo,
        descricaoTipoCarroceria: body.descricao,
        codigoCor: color.codigo,
        descricaoCor: color.descricao,
        codigoCategoria: category.codigo,
        descricaoCategoria: category.descricao,
        anoFabricacao: year,
        anoModelo: year + (index % 2),
        potencia: heavy ? 300 : type.codigo === '13' ? 25 : 110,
        cilindradas: heavy ? 6000 : type.codigo === '13' ? 250 : 1600,
        codigoCombustivel: fuel.codigo,
        descricaoCombustivel: fuel.descricao,
        numeroMotor,
        numeroCambio,
        codigoTipoProprietario: owner.type,
        descricaoTipoProprietario: ownerType.descricao,
        numeroIdentificacaoProprietario: owner.id,
        nomeProprietario: syntheticName(stream),
        qtdEixos: heavy ? 3 : 2,
        lotacao: type.codigo === '14' ? 42 : type.codigo === '4' ? 3 : 5,
        pbt: heavy ? 16_000 : 2_000,
        cmt: heavy ? 25_000 : 3_500,
        cmc: heavy ? 30_000 : 4_000,
        indicadorRouboFurto: false,
        indicadorAlarme: indicators.alarme,
        indicadorRestricaoRenajud: false,
      });
      if (numeroMotor === undefined) delete payload.numeroMotor;
      if (numeroCambio === undefined) delete payload.numeroCambio;
      candidates.push({
        ...identity,
        numeroMotor,
        numeroCambio,
        idProprietario: owner.id,
        tipoProprietario: owner.type,
        indicators,
        payload,
      });
      break;
    }
    if (candidates.length !== index + 1)
      throw new Error('Veiculo collision retry limit reached');
  }
  return { candidates, attempts };
};
