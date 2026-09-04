import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { GenerationStream } from './deterministic.js';
import { syntheticName, syntheticText } from './deterministic.js';

export interface OpenApiSchema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: unknown[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
}

interface OpenApiDocument {
  components: { schemas: Record<string, OpenApiSchema> };
}

let cached: OpenApiDocument | undefined;
export const openApiDocument = (): OpenApiDocument =>
  (cached ??= parse(
    readFileSync(resolve('docs/framework/contracts/openapi.yaml'), 'utf8'),
  ) as OpenApiDocument);

const dereference = (schema: OpenApiSchema): OpenApiSchema => {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').at(-1);
  const target = name && openApiDocument().components.schemas[name];
  if (!target) throw new Error(`Unknown OpenAPI reference ${schema.$ref}`);
  return target;
};

const genericString = (field: string, stream: GenerationStream): string => {
  if (/nome/i.test(field)) return syntheticName(stream);
  if (/uf/i.test(field)) return 'SP';
  if (/cep/i.test(field)) return stream.rng.digits(8);
  if (/^(numero|codigo|registro)/i.test(field)) return stream.rng.digits(8);
  return syntheticText(stream, 3);
};

const genericValue = (
  field: string,
  schemaInput: OpenApiSchema,
  stream: GenerationStream,
): unknown => {
  const schema = dereference(schemaInput);
  if (schema.enum?.length) return schema.enum[0];
  if (schema.properties || schema.type === 'object') {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([key, value]) => [
        key,
        genericValue(key, value, stream),
      ]),
    );
  }
  if (schema.type === 'array') return [];
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer') return stream.rng.int(0, 999);
  if (schema.type === 'number') return stream.rng.int(0, 999);
  if (schema.format === 'date-time') return '2024-01-01T00:00:00.000Z';
  if (schema.format === 'date') return '2024-01-01';
  return genericString(field, stream);
};

export const buildCompletePayload = (
  component: string,
  stream: GenerationStream,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  const schema = openApiDocument().components.schemas[component];
  if (!schema) throw new Error(`Missing OpenAPI component ${component}`);
  const value = genericValue(component, schema, stream);
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`OpenAPI component ${component} is not an object`);
  }
  return Object.assign(value, overrides);
};

const validateValue = (
  value: unknown,
  schemaInput: OpenApiSchema,
  path: string,
  errors: string[],
): void => {
  const schema = dereference(schemaInput);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum`);
  if (schema.properties || schema.type === 'object') {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      errors.push(`${path}: object expected`);
      return;
    }
    const object = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!(required in object)) errors.push(`${path}.${required}: required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in object)
        validateValue(object[key], child, `${path}.${key}`, errors);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) errors.push(`${path}: array expected`);
    else if (schema.items)
      value.forEach((item, index) =>
        validateValue(item, schema.items!, `${path}[${index}]`, errors),
      );
    return;
  }
  if (schema.type === 'boolean' && typeof value !== 'boolean')
    errors.push(`${path}: boolean expected`);
  if (
    schema.type === 'integer' &&
    (!Number.isInteger(value) || typeof value !== 'number')
  )
    errors.push(`${path}: integer expected`);
  if (schema.type === 'number' && typeof value !== 'number')
    errors.push(`${path}: number expected`);
  if ((schema.type === 'string' || schema.format) && typeof value !== 'string')
    errors.push(`${path}: string expected`);
  if (
    schema.format === 'date-time' &&
    typeof value === 'string' &&
    Number.isNaN(Date.parse(value))
  )
    errors.push(`${path}: invalid date-time`);
  if (
    schema.format === 'date' &&
    typeof value === 'string' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  )
    errors.push(`${path}: invalid date`);
};

export const validateOpenApiPayload = (
  component: string,
  payload: unknown,
): string[] => {
  const schema = openApiDocument().components.schemas[component];
  if (!schema) return [`Missing OpenAPI component ${component}`];
  const errors: string[] = [];
  validateValue(payload, schema, component, errors);
  return errors;
};
