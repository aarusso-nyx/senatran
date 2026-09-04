import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { SupportedTable } from './cli.js';
import type { Queryable } from './database-types.js';
import { preflightCatalogs, type CatalogPreflightResult } from './catalogs.js';

interface ExpectedColumn {
  type: string;
  nullable: boolean;
  defaultPattern?: RegExp;
}

const COMMON_ID: ExpectedColumn = {
  type: 'bigint',
  nullable: false,
  defaultPattern: /nextval\(/,
};
const TEXT_NULLABLE: ExpectedColumn = { type: 'text', nullable: true };
const TEXT_REQUIRED: ExpectedColumn = { type: 'text', nullable: false };
const BOOLEAN_DEFAULT: ExpectedColumn = {
  type: 'boolean',
  nullable: false,
  defaultPattern: /false/,
};

const EXPECTED_COLUMNS: Record<
  SupportedTable,
  Record<string, ExpectedColumn>
> = {
  'senatran.condutor': {
    id: COMMON_ID,
    cpf: TEXT_REQUIRED,
    numero_registro: TEXT_NULLABLE,
    numero_formulario_renach: TEXT_NULLABLE,
    numero_lista_impedimento: TEXT_NULLABLE,
    numero_pgu: TEXT_NULLABLE,
    numero_formulario_pid: TEXT_NULLABLE,
    nome: TEXT_NULLABLE,
    data_nascimento: { type: 'date', nullable: true },
    nome_mae: TEXT_NULLABLE,
    payload: { type: 'jsonb', nullable: false },
  },
  'senatran.veiculo': {
    id: COMMON_ID,
    chassi: TEXT_REQUIRED,
    placa: TEXT_REQUIRED,
    codigo_renavam: TEXT_REQUIRED,
    numero_motor: TEXT_NULLABLE,
    numero_cambio: TEXT_NULLABLE,
    id_proprietario: TEXT_NULLABLE,
    tipo_proprietario: TEXT_NULLABLE,
    ind_alarme: BOOLEAN_DEFAULT,
    ind_roubo_furto: BOOLEAN_DEFAULT,
    ind_transferencia: BOOLEAN_DEFAULT,
    ind_licenciamento: BOOLEAN_DEFAULT,
    ind_circulacao: BOOLEAN_DEFAULT,
    ind_penhora: BOOLEAN_DEFAULT,
    ind_media_monta: BOOLEAN_DEFAULT,
    ind_grande_monta: BOOLEAN_DEFAULT,
    ind_recuperado: BOOLEAN_DEFAULT,
    payload: { type: 'jsonb', nullable: false },
  },
};

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_identity: 'YES' | 'NO';
}

interface IndexRow {
  primary: boolean;
  unique_index: boolean;
  columns: string[];
}

export interface PreflightResult {
  schema: 'ok';
  contract: 'ok';
  catalogs: CatalogPreflightResult;
}

const sameColumns = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length &&
  actual.every((column, index) => column === expected[index]);

export const preflightSchema = async (
  db: Queryable,
  table: SupportedTable,
): Promise<void> => {
  const [schema, name] = table.split('.');
  const columns = await db.query<ColumnRow>(
    `select column_name, data_type, is_nullable, column_default, is_identity
       from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position`,
    [schema, name],
  );
  const expected = EXPECTED_COLUMNS[table];
  if (columns.rows.length === 0) throw new Error(`Missing table ${table}`);
  for (const row of columns.rows) {
    const definition = expected[row.column_name];
    if (!definition) {
      if (row.is_nullable === 'NO' && row.column_default === null) {
        throw new Error(`Unknown mandatory column ${table}.${row.column_name}`);
      }
      throw new Error(`Unexpected column ${table}.${row.column_name}`);
    }
    if (
      row.data_type !== definition.type ||
      (row.is_nullable === 'YES') !== definition.nullable ||
      (definition.defaultPattern &&
        !definition.defaultPattern.test(row.column_default ?? ''))
    ) {
      throw new Error(`Schema drift in ${table}.${row.column_name}`);
    }
    if (row.column_name === 'id' && row.is_identity === 'YES') {
      throw new Error(`${table}.id must be serial-backed, not identity`);
    }
  }
  if (columns.rows.length !== Object.keys(expected).length) {
    throw new Error(`Column count drift in ${table}`);
  }

  const indexes = await db.query<IndexRow>(
    `select i.indisprimary as primary, i.indisunique as unique_index,
            array_agg(a.attname order by keys.ordinality)::text[] as columns
       from pg_index i
       join pg_class t on t.oid = i.indrelid
       join pg_namespace n on n.oid = t.relnamespace
       join lateral unnest(i.indkey) with ordinality as keys(attnum, ordinality) on true
       join pg_attribute a on a.attrelid = t.oid and a.attnum = keys.attnum
      where n.nspname = $1 and t.relname = $2
      group by i.indexrelid, i.indisprimary, i.indisunique`,
    [schema, name],
  );
  const has = (columns: string[], primary?: boolean) =>
    indexes.rows.some(
      (index) =>
        index.unique_index &&
        (primary === undefined || index.primary === primary) &&
        sameColumns(index.columns, columns),
    );
  if (table === 'senatran.veiculo') {
    if (
      !has(['chassi'], true) ||
      !has(['id']) ||
      !has(['placa']) ||
      !has(['codigo_renavam'])
    ) {
      throw new Error('Vehicle PK/UNIQUE drift');
    }
  } else if (!has(['id'], true)) {
    throw new Error('Condutor PK drift');
  }

  const unsupported = await db.query<{ kind: string; count: number }>(
    `select case c.contype when 'f' then 'foreign_key' else 'check' end as kind,
            count(*)::int as count
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = $1 and t.relname = $2 and c.contype in ('f', 'c')
      group by c.contype`,
    [schema, name],
  );
  if (unsupported.rows.some((row) => Number(row.count) !== 0)) {
    throw new Error(`Unexpected FK/CHECK constraint in ${table}`);
  }
};

export const assertOpenApiComponent = (table: SupportedTable): void => {
  const document = parse(
    readFileSync(resolve('docs/framework/contracts/openapi.yaml'), 'utf8'),
  ) as { components?: { schemas?: Record<string, unknown> } };
  const component = table.endsWith('condutor') ? 'Condutor' : 'Veiculo';
  if (!document.components?.schemas?.[component]) {
    throw new Error(`Missing OpenAPI component ${component}`);
  }
};

export const runPreflight = async (
  db: Queryable,
  table: SupportedTable,
  writeCatalogs: boolean,
): Promise<PreflightResult> => {
  await preflightSchema(db, table);
  assertOpenApiComponent(table);
  const catalogs = await preflightCatalogs(db, writeCatalogs);
  return { schema: 'ok', contract: 'ok', catalogs };
};
