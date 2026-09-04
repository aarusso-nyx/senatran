import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  isValidChassi,
  isValidCpf,
  isValidPlate,
  isValidRenavam,
} from '../scripts/lib/br.js';
import { generateCondutores, generateVeiculos } from './generators.js';
import { validateCondutores, validateVeiculos } from './validation.js';

interface SchemaProperty {
  type?: string | string[];
  format?: string;
  pattern?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  'x-source'?: string;
  'x-unique'?: boolean;
  'x-csv-json'?: boolean;
  'x-dateMinimum'?: string;
  'x-dateMaximum'?: string;
}

export interface CsvDataSchema extends SchemaProperty {
  $schema: string;
  title: string;
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
  'x-table': 'senatran.condutor' | 'senatran.veiculo';
  'x-entity': 'condutor' | 'veiculo';
  'x-columnOrder': string[];
}

export interface CsvGenerationOptions {
  schemaPath: string;
  rows: number;
  outputPath: string;
  seed: number;
}

const getPath = (value: unknown, path: string): unknown => {
  let current = value;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const allowsType = (schema: SchemaProperty, type: string): boolean =>
  schema.type === type ||
  (Array.isArray(schema.type) && schema.type.includes(type));

const validateValue = (
  value: unknown,
  schema: SchemaProperty,
  path: string,
): void => {
  if (value === null) {
    if (!allowsType(schema, 'null'))
      throw new Error(`${path}: null is not allowed`);
    return;
  }
  if (allowsType(schema, 'object')) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new Error(`${path}: object expected`);
    }
    const object = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (object[required] === undefined) {
        throw new Error(`${path}.${required}: required`);
      }
    }
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      if (object[name] !== undefined) {
        validateValue(object[name], child, `${path}.${name}`);
      }
    }
    return;
  }
  if (allowsType(schema, 'string')) {
    if (typeof value !== 'string') throw new Error(`${path}: string expected`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new Error(`${path}: pattern mismatch`);
    }
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${path}: invalid date`);
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      throw new Error(`${path}: invalid date-time`);
    }
    if (schema.format === 'cpf' && !isValidCpf(value)) {
      throw new Error(`${path}: invalid CPF`);
    }
    if (schema.format === 'placa' && !isValidPlate(value)) {
      throw new Error(`${path}: invalid placa`);
    }
    if (schema.format === 'chassi' && !isValidChassi(value)) {
      throw new Error(`${path}: invalid chassi`);
    }
    if (schema.format === 'renavam' && !isValidRenavam(value)) {
      throw new Error(`${path}: invalid RENAVAM`);
    }
    if (schema['x-dateMinimum'] && value < schema['x-dateMinimum']) {
      throw new Error(`${path}: before minimum date`);
    }
    if (schema['x-dateMaximum'] && value > schema['x-dateMaximum']) {
      throw new Error(`${path}: after maximum date`);
    }
  } else if (allowsType(schema, 'boolean')) {
    if (typeof value !== 'boolean')
      throw new Error(`${path}: boolean expected`);
  } else if (allowsType(schema, 'integer')) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`${path}: integer expected`);
    }
  } else if (allowsType(schema, 'number') && typeof value !== 'number') {
    throw new Error(`${path}: number expected`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${path}: value is outside enum`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new Error(`${path}: below minimum`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new Error(`${path}: above maximum`);
    }
  }
};

export const loadCsvSchema = (path: string): CsvDataSchema => {
  const schema = JSON.parse(
    readFileSync(resolve(path), 'utf8'),
  ) as CsvDataSchema;
  if (
    !schema.$schema ||
    schema.type !== 'object' ||
    !schema.properties ||
    !Array.isArray(schema.required) ||
    !Array.isArray(schema['x-columnOrder']) ||
    !['condutor', 'veiculo'].includes(schema['x-entity'])
  ) {
    throw new Error(`Invalid data schema: ${path}`);
  }
  const propertyNames = Object.keys(schema.properties);
  if (
    schema['x-columnOrder'].length !== propertyNames.length ||
    !schema['x-columnOrder'].every((column) => propertyNames.includes(column))
  ) {
    throw new Error('x-columnOrder must list every property exactly once');
  }
  for (const required of schema.required) {
    if (!schema.properties[required]) {
      throw new Error(`Unknown required property: ${required}`);
    }
  }
  return schema;
};

const buildRows = (
  schema: CsvDataSchema,
  count: number,
  seed: number,
): Record<string, unknown>[] => {
  const candidates =
    schema['x-entity'] === 'condutor'
      ? generateCondutores(count, seed).candidates
      : generateVeiculos(count, seed).candidates;
  if (schema['x-entity'] === 'condutor') {
    validateCondutores(
      candidates as ReturnType<typeof generateCondutores>['candidates'],
    );
  } else {
    validateVeiculos(
      candidates as ReturnType<typeof generateVeiculos>['candidates'],
    );
  }
  const rows = candidates.map((candidate, index) => {
    const row: Record<string, unknown> = {};
    for (const column of schema['x-columnOrder']) {
      const definition = schema.properties[column];
      const value = definition['x-source']
        ? getPath(candidate, definition['x-source'])
        : undefined;
      row[column] = value === undefined ? definition.default : value;
      if (schema.required.includes(column) && row[column] === undefined) {
        throw new Error(`row ${index + 1}.${column}: required`);
      }
      if (row[column] !== undefined) {
        validateValue(row[column], definition, `row ${index + 1}.${column}`);
      }
    }
    return row;
  });
  for (const [column, definition] of Object.entries(schema.properties)) {
    if (!definition['x-unique']) continue;
    const values = rows
      .map((row) => row[column])
      .filter((value) => value !== undefined && value !== null && value !== '');
    if (new Set(values).size !== values.length) {
      throw new Error(`${column}: generated values are not unique`);
    }
  }
  return rows;
};

const escapeCsv = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const generateCsv = (options: CsvGenerationOptions): string => {
  const schema = loadCsvSchema(options.schemaPath);
  const rows = buildRows(schema, options.rows, options.seed);
  const columns = schema['x-columnOrder'];
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(
      columns
        .map((column) => {
          const definition = schema.properties[column];
          const value = row[column];
          if (value === undefined || value === null) return '';
          const serialized = definition['x-csv-json']
            ? JSON.stringify(value)
            : String(value);
          return escapeCsv(serialized);
        })
        .join(','),
    );
  }
  const outputPath = resolve(options.outputPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return outputPath;
};
