import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

/**
 * A strict JSON-Schema subset validator shared by the contract-conformance
 * specs. The mock's OpenAPI schemas use only $ref/type/properties/items/format/
 * enum, so a purpose-built validator is enough and needs no dependency.
 *
 * Strict = an undeclared field, a type/enum/format mismatch all fail. Missing
 * fields are allowed (the contract declares no `required` on responses) and
 * null/undefined are allowed. A `properties`-less object schema is free-form.
 */
export type JsonSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T/;

const deref = (
  s: JsonSchema,
  schemas: Record<string, JsonSchema>,
): JsonSchema => {
  let cur = s;
  for (let i = 0; i < 10 && cur?.$ref; i++)
    cur = schemas[cur.$ref.split('/').pop() as string] ?? {};
  return cur;
};

/** Collect strict conformance violations of `value` against `schemaIn`. */
export function validateAgainstSchema(
  value: unknown,
  schemaIn: JsonSchema,
  schemas: Record<string, JsonSchema>,
  path = '$',
  out: string[] = [],
): string[] {
  const s = deref(schemaIn, schemas);
  if (value === null || value === undefined) return out;
  if (Array.isArray(s.enum)) {
    if (!s.enum.includes(value))
      out.push(`${path}: ${JSON.stringify(value)} not in enum`);
    return out;
  }
  if (s.type === 'array' || s.items) {
    if (!Array.isArray(value)) {
      out.push(`${path}: expected array, got ${typeof value}`);
      return out;
    }
    const items = s.items ?? { type: 'string' };
    value.forEach((v, i) =>
      validateAgainstSchema(v, items, schemas, `${path}[${i}]`, out),
    );
    return out;
  }
  if (s.properties || s.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      out.push(`${path}: expected object, got ${typeof value}`);
      return out;
    }
    if (!s.properties) return out; // free-form object
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!(k in s.properties))
        out.push(`${path}.${k}: undeclared field (not in contract schema)`);
      else
        validateAgainstSchema(v, s.properties[k], schemas, `${path}.${k}`, out);
    }
    return out;
  }
  if (s.type === 'integer' || s.type === 'number') {
    if (typeof value !== 'number')
      out.push(`${path}: expected ${s.type}, got ${typeof value}`);
    else if (s.type === 'integer' && !Number.isInteger(value))
      out.push(`${path}: expected integer, got ${value}`);
    return out;
  }
  if (s.type === 'boolean') {
    if (typeof value !== 'boolean')
      out.push(`${path}: expected boolean, got ${typeof value}`);
    return out;
  }
  if (typeof value !== 'string') {
    out.push(`${path}: expected string, got ${typeof value}`);
    return out;
  }
  if (value !== '') {
    if (s.format === 'date' && !isoDate.test(value))
      out.push(`${path}: expected date (YYYY-MM-DD), got "${value}"`);
    if (s.format === 'date-time' && !isoDateTime.test(value))
      out.push(`${path}: expected date-time, got "${value}"`);
  }
  return out;
}

type Operation = {
  responses: Record<
    string,
    { content?: { 'application/json'?: { schema?: JsonSchema } } }
  >;
};
export type Contract = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, JsonSchema> };
};

/** Load an OpenAPI contract from docs/framework/contracts relative to tests/. */
export function loadContract(fileName: string): Contract {
  const here = dirname(fileURLToPath(import.meta.url));
  return parse(
    readFileSync(
      resolve(here, '../../docs/framework/contracts', fileName),
      'utf8',
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
}

/** The application/json schema declared for the first 2xx status of an op. */
export function success2xxSchema(op: Operation): JsonSchema | undefined {
  const ok = Object.keys(op.responses).find((c) => /^2/.test(c));
  return ok
    ? op.responses[ok].content?.['application/json']?.schema
    : undefined;
}
