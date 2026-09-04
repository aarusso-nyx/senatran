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
  UFS,
  type Code,
} from '../scripts/lib/refdata.js';
import type { Queryable } from './database-types.js';

type CatalogRow = Record<string, string>;
interface CatalogDefinition {
  table: string;
  key: readonly string[];
  columns: readonly string[];
  rows: readonly CatalogRow[];
}

const pairs = (table: string, values: readonly Code[]): CatalogDefinition => ({
  table,
  key: ['codigo'],
  columns: ['codigo', 'descricao'],
  rows: values.map(({ codigo, descricao }) => ({ codigo, descricao })),
});

export const CORE_CATALOGS: readonly CatalogDefinition[] = [
  {
    table: 'ref_uf',
    key: ['uf'],
    columns: ['uf', 'nome'],
    rows: UFS.map((uf) => ({ uf, nome: uf })),
  },
  {
    table: 'ref_municipio',
    key: ['codigo'],
    columns: ['codigo', 'uf', 'nome'],
    rows: MUNICIPIOS.map(({ codigo, uf, descricao }) => ({
      codigo,
      uf,
      nome: descricao,
    })),
  },
  pairs('ref_marca_modelo', MARCAS_MODELOS),
  pairs('ref_cor', CORES),
  pairs('ref_especie', ESPECIES),
  pairs('ref_tipo_veiculo', TIPOS_VEICULO),
  pairs('ref_carroceria', CARROCERIAS),
  pairs('ref_categoria', CATEGORIAS),
  pairs('ref_combustivel', COMBUSTIVEIS),
  pairs('ref_tipo_proprietario', TIPOS_PROPRIETARIO),
  pairs('ref_situacao_cnh', SITUACOES_CNH),
];

export interface CatalogPreflightResult {
  missing: number;
  preserved: number;
  inserted: number;
}

export const preflightCatalogs = async (
  db: Queryable,
  write: boolean,
): Promise<CatalogPreflightResult> => {
  let missing = 0;
  let preserved = 0;
  let inserted = 0;
  for (const catalog of CORE_CATALOGS) {
    const result = await db.query<Record<string, string>>(
      `select ${catalog.columns.join(', ')} from senatran.${catalog.table}`,
    );
    const existing = new Map(
      result.rows.map((row) => [
        catalog.key.map((key) => row[key]).join('|'),
        row,
      ]),
    );
    for (const expected of catalog.rows) {
      const identity = catalog.key.map((key) => expected[key]).join('|');
      const current = existing.get(identity);
      if (current) {
        const drift = catalog.columns.some(
          (column) => String(current[column]) !== expected[column],
        );
        if (drift) {
          throw new Error(
            `Catalog drift in senatran.${catalog.table} for ${identity}`,
          );
        }
        preserved += 1;
        continue;
      }
      missing += 1;
      if (write) {
        const values = catalog.columns.map((column) => expected[column]);
        const placeholders = values.map((_, index) => `$${index + 1}`);
        await db.query(
          `insert into senatran.${catalog.table} (${catalog.columns.join(', ')}) values (${placeholders.join(', ')})`,
          values,
        );
        inserted += 1;
      }
    }
  }
  return { missing, preserved, inserted };
};
