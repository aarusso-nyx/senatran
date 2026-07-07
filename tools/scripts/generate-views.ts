/**
 * generate-views — emits database/ddl/90-contract-read.sql: one `contract.v_*`
 * view per read (WSDenatran) endpoint, derived from the OpenAPI contract.
 *
 * Each view exposes the endpoint's key columns + a `payload jsonb` that is the
 * exact response body (D-0010). Services run `select payload from contract.v_<x>
 * where <key> = $1`. Wrappers (list envelope / bare object / boolean / indicator
 * / array) are applied per the response schema.
 *
 * Run: pnpm views:generate
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const spec = parse(
  readFileSync(resolve(root, 'docs/framework/contracts/openapi.yaml'), 'utf8'),
) as { paths: Record<string, Record<string, OpenApiOp>> };

interface OpenApiOp {
  operationId: string;
  parameters?: Array<{ name?: string; in?: string; $ref?: string }>;
  responses: Record<
    string,
    { content?: Record<string, { schema?: { $ref?: string; type?: string } }> }
  >;
}

const snake = (s: string): string =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const viewName = (opId: string): string =>
  'v_' + snake(opId.replace(/^get/, ''));

// response schema → { table, wrapper }
const RESP: Record<string, { table: string; wrap: string }> = {
  VeiculoListResponse: { table: 'veiculo', wrap: 'veiculoList' },
  Veiculo: { table: 'veiculo', wrap: 'object' },
  CodigoSegurancaCrv: { table: 'csv_seguranca', wrap: 'object' },
  CondutorListResponse: { table: 'condutor', wrap: 'condutorList' },
  CondutorImagem: { table: 'condutor_imagem', wrap: 'object' },
  CondutorInfracaoExtrato: { table: 'condutor_infracao_item', wrap: 'extrato' },
  InfracaoListResponse: { table: 'infracao', wrap: 'infracaoList' },
  InfracaoOcorrenciaResponse: {
    table: 'infracao_ocorrencia',
    wrap: 'infracaoOcor',
  },
  InfracaoPagamentoResponse: {
    table: 'infracao_pagamento',
    wrap: 'infracaoPag',
  },
  boolean: { table: 'veiculo', wrap: 'boolean' },
  IndicadorRestricaoJudicial: { table: 'veiculo', wrap: 'indRestricao' },
  IndicadorSinistro: { table: 'veiculo', wrap: 'indSinistro' },
  RestricaoJudicialResponse: {
    table: 'restricao_judicial_processo',
    wrap: 'restricaoList',
  },
  RouboFurtoResponse: { table: 'roubo_furto_ocorrencia', wrap: 'rfList' },
  ConsultaCsvList: { table: 'consulta_csv', wrap: 'array' },
  AlteracaoPermitidaList: { table: 'alteracao_permitida', wrap: 'arrayStatic' },
  ComunicacaoVenda: { table: 'comunicacao_venda', wrap: 'object' },
  EnderecoPossuidor: { table: 'endereco_possuidor', wrap: 'object' },
  MultaInterestadualResponse: { table: 'multa_interestadual', wrap: 'object' },
  RecallResponse: { table: 'recall', wrap: 'object' },
};

// path param name → column (context-sensitive on table)
const paramToCol = (param: string, table: string): string => {
  // On the veiculo table the owner identifier (cpf|cnpj|identificacao) is the
  // single id_proprietario column.
  if (
    table === 'veiculo' &&
    (param === 'cpf' || param === 'cnpj' || param === 'identificacao')
  ) {
    return 'id_proprietario';
  }
  const base: Record<string, string> = {
    placa: 'placa',
    chassi: 'chassi',
    cpf: 'cpf',
    cnpj: 'cnpj',
    motor: 'numero_motor',
    cambio: 'numero_cambio',
    pgu: 'numero_pgu',
    pid: 'numero_formulario_pid',
    formularioRenach: 'numero_formulario_renach',
    impedimento: 'numero_lista_impedimento',
    autoInfracao: 'auto_infracao',
    orgao: 'codigo_orgao_autuador',
    codigoInfracao: 'codigo_infracao',
    uf: 'uf',
    situacaoExigibilidade: 'situacao_exigibilidade',
    codigoSegurancaCrv: 'codigo_seguranca_crv',
    numeroSeguranca: 'numero_seguranca',
    numeroRenainf: 'codigo_renainf',
    nomeCondutor: 'nome',
    dataNascimento: 'data_nascimento',
    nomeMae: 'nome_mae',
  };
  if (param in base) return base[param];
  if (param === 'renavam')
    return table === 'veiculo' ? 'codigo_renavam' : 'renavam';
  if (param === 'numeroRegistroCnh' || param === 'cnh')
    return table === 'condutor' ? 'numero_registro' : 'numero_registro_cnh';
  if (param === 'numeroRegistro') return 'numero_registro';
  if (param === 'identificacao')
    return table === 'veiculo' ? 'id_proprietario' : 'identificacao_hab_estr';
  throw new Error(`unmapped path param "${param}" (table ${table})`);
};

const listEnvelope = (
  table: string,
  keys: string[],
  countA: string,
  countB: string,
  cursor: boolean,
  arrKey: string,
): string => {
  const obj = [
    `'${countA}', count(*)`,
    `'${countB}', count(*)`,
    ...(cursor ? [`'idUltimoRegistro', coalesce(max(id), 0)`] : []),
    `'${arrKey}', coalesce(jsonb_agg(payload order by id), '[]'::jsonb)`,
  ].join(', ');
  return `select ${keys.join(', ')}, jsonb_build_object(${obj}) as payload\n  from senatran.${table}\n  group by ${keys.join(', ')}`;
};

function buildSelect(op: OpenApiOp, path: string): string {
  const schema = op.responses['200']?.content?.['application/json']?.schema;
  const respKey =
    schema?.$ref?.split('/').pop() ??
    (schema?.type === 'boolean' ? 'boolean' : '');
  const spec2 = RESP[respKey];
  if (!spec2)
    throw new Error(`no wrapper for response "${respKey}" (${op.operationId})`);
  const { table, wrap } = spec2;
  const params = (op.parameters ?? [])
    .filter((p) => p.in === 'path')
    .map((p) => p.name as string);
  const keys = params.map((p) => paramToCol(p, table));

  switch (wrap) {
    case 'object':
      return `select ${keys.join(', ')}, payload\n  from senatran.${table}`;
    case 'veiculoList':
      return listEnvelope(
        table,
        keys,
        'quantidadeVeiculo',
        'quantidadeVeiculoReal',
        true,
        'veiculo',
      );
    case 'condutorList':
      return `select ${keys.join(', ')}, jsonb_build_object('condutores', coalesce(jsonb_agg(payload order by id), '[]'::jsonb)) as payload\n  from senatran.${table}\n  group by ${keys.join(', ')}`;
    case 'infracaoList':
      return listEnvelope(
        table,
        keys,
        'quantidadeInfracoes',
        'quantidadeInfracoesReal',
        true,
        'infracoes',
      );
    case 'infracaoOcor':
      return listEnvelope(
        table,
        keys,
        'quantidade',
        'quantidadeReal',
        false,
        'ocorrencias',
      );
    case 'infracaoPag':
      return listEnvelope(
        table,
        keys,
        'quantidade',
        'quantidadeReal',
        false,
        'pagamentos',
      );
    case 'extrato':
      return listEnvelope(
        table,
        keys,
        'quantidade',
        'quantidadeReal',
        false,
        'ocorrencias',
      );
    case 'restricaoList':
      return listEnvelope(
        table,
        keys,
        'quantidadeRetornada',
        'quantidadeReal',
        true,
        'processos',
      );
    case 'rfList':
      return listEnvelope(
        table,
        keys,
        'quantidadeRetornada',
        'quantidadeReal',
        true,
        'ocorrenciasRouboFurto',
      );
    case 'array':
      return `select ${keys.join(', ')}, coalesce(jsonb_agg(payload order by id), '[]'::jsonb) as payload\n  from senatran.${table}\n  group by ${keys.join(', ')}`;
    case 'arrayStatic':
      return `select coalesce(jsonb_agg(payload order by id), '[]'::jsonb) as payload\n  from senatran.${table}`;
    case 'boolean': {
      const col = /alarme/i.test(path) ? 'ind_alarme' : 'ind_roubo_furto';
      return `select ${keys.join(', ')}, to_jsonb(${col}) as payload\n  from senatran.${table}`;
    }
    case 'indRestricao':
      return `select ${keys.join(', ')}, jsonb_build_object('indicadorTransferencia', ind_transferencia, 'indicadorLicenciamento', ind_licenciamento, 'indicadorCirculacao', ind_circulacao, 'indicadorPenhora', ind_penhora) as payload\n  from senatran.${table}`;
    case 'indSinistro':
      return `select ${keys.join(', ')}, jsonb_build_object('indicadorMediaMonta', ind_media_monta, 'indicadorGrandeMonta', ind_grande_monta, 'indicadorRecuperado', ind_recuperado) as payload\n  from senatran.${table}`;
    default:
      throw new Error(`unknown wrapper "${wrap}"`);
  }
}

const out: string[] = [
  '-- SENATRAN mock — contract read views. GENERATED by tools/scripts/generate-views.ts.',
  '-- Do not edit by hand; run `pnpm views:generate`.',
  '',
];
let count = 0;
for (const [path, item] of Object.entries(spec.paths)) {
  const op = item.get;
  if (!op) continue;
  const name = viewName(op.operationId);
  out.push(`-- GET /v1${path}`);
  out.push(`create or replace view contract.${name} as`);
  out.push('  ' + buildSelect(op, path).trim() + ';');
  out.push('');
  count += 1;
}

writeFileSync(
  resolve(root, 'database/ddl/90-contract-read.sql'),
  out.join('\n'),
);
console.log(
  `generate-views: wrote ${count} contract read views to database/ddl/90-contract-read.sql`,
);
