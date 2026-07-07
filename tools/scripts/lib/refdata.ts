/**
 * Curated reference code/description lists. Single source of truth: the seed
 * generator seeds the senatran.ref_* tables from these AND draws from them when
 * building payloads, so codigo↔descricao pairs are always coherent (INV-DATA-001).
 * Values are plausible mock data, not an authoritative DENATRAN extract.
 */
export interface Code {
  codigo: string;
  descricao: string;
}

export const UFS: readonly string[] = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export const MUNICIPIOS: readonly (Code & { uf: string })[] = [
  { codigo: '3550308', uf: 'SP', descricao: 'São Paulo' },
  { codigo: '3304557', uf: 'RJ', descricao: 'Rio de Janeiro' },
  { codigo: '3106200', uf: 'MG', descricao: 'Belo Horizonte' },
  { codigo: '4314902', uf: 'RS', descricao: 'Porto Alegre' },
  { codigo: '4106902', uf: 'PR', descricao: 'Curitiba' },
  { codigo: '2927408', uf: 'BA', descricao: 'Salvador' },
  { codigo: '2304400', uf: 'CE', descricao: 'Fortaleza' },
  { codigo: '5300108', uf: 'DF', descricao: 'Brasília' },
];

export const MARCAS_MODELOS: readonly Code[] = [
  { codigo: '821001', descricao: 'VW/GOL 1.0' },
  { codigo: '815002', descricao: 'FIAT/UNO MILLE' },
  { codigo: '831003', descricao: 'GM/ONIX JOY' },
  { codigo: '844004', descricao: 'HYUNDAI/HB20' },
  { codigo: '852005', descricao: 'TOYOTA/COROLLA' },
  { codigo: '810006', descricao: 'FORD/KA SE' },
  { codigo: '868007', descricao: 'HONDA/CIVIC EXL' },
  { codigo: '877008', descricao: 'RENAULT/KWID ZEN' },
];

export const CORES: readonly Code[] = [
  { codigo: '1', descricao: 'AMARELO' },
  { codigo: '2', descricao: 'AZUL' },
  { codigo: '3', descricao: 'BRANCA' },
  { codigo: '4', descricao: 'CINZA' },
  { codigo: '5', descricao: 'PRETA' },
  { codigo: '6', descricao: 'PRATA' },
  { codigo: '7', descricao: 'VERDE' },
  { codigo: '8', descricao: 'VERMELHA' },
];

export const ESPECIES: readonly Code[] = [
  { codigo: '1', descricao: 'PASSAGEIRO' },
  { codigo: '2', descricao: 'CARGA' },
  { codigo: '3', descricao: 'MISTO' },
  { codigo: '4', descricao: 'ESPECIAL' },
  { codigo: '5', descricao: 'TRACAO' },
  { codigo: '6', descricao: 'CORRIDA' },
];

export const TIPOS_VEICULO: readonly Code[] = [
  { codigo: '6', descricao: 'AUTOMOVEL' },
  { codigo: '4', descricao: 'CAMINHAO' },
  { codigo: '13', descricao: 'MOTOCICLETA' },
  { codigo: '8', descricao: 'CAMINHONETE' },
  { codigo: '14', descricao: 'ONIBUS' },
  { codigo: '23', descricao: 'UTILITARIO' },
];

export const CARROCERIAS: readonly Code[] = [
  { codigo: '1', descricao: 'NAO APLICAVEL' },
  { codigo: '2', descricao: 'ABERTA' },
  { codigo: '3', descricao: 'FECHADA/BAU' },
  { codigo: '5', descricao: 'SEDAN' },
  { codigo: '6', descricao: 'HATCH' },
];

export const CATEGORIAS: readonly Code[] = [
  { codigo: '1', descricao: 'PARTICULAR' },
  { codigo: '2', descricao: 'ALUGUEL' },
  { codigo: '3', descricao: 'OFICIAL' },
  { codigo: '4', descricao: 'DIPLOMATICO' },
  { codigo: '5', descricao: 'APRENDIZAGEM' },
];

export const COMBUSTIVEIS: readonly Code[] = [
  { codigo: '1', descricao: 'ALCOOL' },
  { codigo: '2', descricao: 'GASOLINA' },
  { codigo: '3', descricao: 'DIESEL' },
  { codigo: '16', descricao: 'ALCOOL/GASOLINA' },
  { codigo: '17', descricao: 'GASOLINA/ELETRICO' },
];

export const TIPOS_PROPRIETARIO: readonly Code[] = [
  { codigo: '1', descricao: 'PESSOA FISICA' },
  { codigo: '2', descricao: 'PESSOA JURIDICA' },
];

export const ORGAOS_AUTUADOR: readonly (Code & { uf: string })[] = [
  { codigo: '204020', uf: 'SP', descricao: 'DER/SP' },
  { codigo: '380090', uf: 'RJ', descricao: 'DETRAN/RJ' },
  { codigo: '150070', uf: 'MG', descricao: 'PMMG' },
  { codigo: '447010', uf: 'RS', descricao: 'EPTC/POA' },
  { codigo: '999999', uf: 'DF', descricao: 'PRF' },
];

export const SITUACOES_CNH: readonly Code[] = [
  { codigo: 'A', descricao: 'ATIVA' },
  { codigo: 'S', descricao: 'SUSPENSA' },
  { codigo: 'C', descricao: 'CASSADA' },
  { codigo: 'B', descricao: 'BLOQUEADA' },
  { codigo: 'V', descricao: 'VENCIDA' },
];

export const TIPOS_ALTERACAO: readonly (Code & { codigoSistema: number })[] = [
  { codigo: 'COR', descricao: 'Alteração de cor', codigoSistema: 1 },
  { codigo: 'MOTOR', descricao: 'Troca de motor', codigoSistema: 2 },
  {
    codigo: 'COMBUSTIVEL',
    descricao: 'Alteração de combustível',
    codigoSistema: 3,
  },
  {
    codigo: 'CARROCERIA',
    descricao: 'Alteração de carroceria',
    codigoSistema: 4,
  },
  { codigo: 'CATEGORIA', descricao: 'Mudança de categoria', codigoSistema: 5 },
];

/** Map of code-group name (matching `codigo<Name>` fields) → list. */
export const CODE_GROUPS: Record<string, readonly Code[]> = {
  Cor: CORES,
  Especie: ESPECIES,
  EspecieVeiculo: ESPECIES,
  TipoVeiculo: TIPOS_VEICULO,
  Carroceria: CARROCERIAS,
  TipoCarroceria: CARROCERIAS,
  Categoria: CATEGORIAS,
  Combustivel: COMBUSTIVEIS,
  MarcaModelo: MARCAS_MODELOS,
  TipoProprietario: TIPOS_PROPRIETARIO,
};
