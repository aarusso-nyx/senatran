/**
 * openapi:check — structural + contract-invariant validation of the WSDenatran
 * mock contract at docs/framework/contracts/openapi.yaml.
 *
 * This guards the invariants the mock relies on, independent of any external
 * linter:
 *   - the document is OpenAPI 3.1;
 *   - every operation requires the `x-cpf-usuario` header (via $ref);
 *   - every operation declares the full error envelope (400/401/402/404/500);
 *   - every internal $ref resolves to a defined component.
 *
 * In P4 this script is extended to cross-check that every NestJS controller
 * route is present in the contract and vice-versa.
 *
 * Exit code 0 = pass, 1 = fail.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(here, '../../docs/framework/contracts/openapi.yaml');

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
];
const REQUIRED_ERROR_STATUSES = ['400', '401', '402', '404', '500'];

type Json = Record<string, unknown>;

const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

const spec = parse(readFileSync(specPath, 'utf8')) as Json;

// 1. OpenAPI version.
const version = String(spec.openapi ?? '');
if (!version.startsWith('3.1')) {
  fail(`openapi version must be 3.1.x, got "${version || '(missing)'}"`);
}

// 2. Collect all $ref strings and validate they resolve within the document.
const resolveRef = (ref: string): boolean => {
  if (!ref.startsWith('#/')) return true; // external refs not used here
  const segments = ref.slice(2).split('/');
  let node: unknown = spec;
  for (const raw of segments) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (typeof node !== 'object' || node === null || !(key in (node as Json))) {
      return false;
    }
    node = (node as Json)[key];
  }
  return true;
};

const walkRefs = (node: unknown): void => {
  if (Array.isArray(node)) {
    node.forEach(walkRefs);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Json)) {
      if (key === '$ref' && typeof value === 'string') {
        if (!resolveRef(value)) fail(`unresolved $ref: ${value}`);
      } else {
        walkRefs(value);
      }
    }
  }
};
walkRefs(spec);

// 3. Per-operation contract invariants.
const paths = (spec.paths ?? {}) as Json;
let operationCount = 0;

for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
  const pathItem = pathItemRaw as Json;
  for (const method of HTTP_METHODS) {
    const op = pathItem[method] as Json | undefined;
    if (!op) continue;
    operationCount += 1;
    const label = `${method.toUpperCase()} ${pathKey}`;

    // x-cpf-usuario header present (via the shared parameter $ref or inline).
    const params = (op.parameters ?? []) as Json[];
    const hasCpf = params.some((p) => {
      const ref = p.$ref;
      if (typeof ref === 'string' && /XCpfUsuario/.test(ref)) return true;
      return p.in === 'header' && p.name === 'x-cpf-usuario';
    });
    if (!hasCpf) fail(`${label}: missing required header x-cpf-usuario`);

    // Error envelope statuses.
    const responses = (op.responses ?? {}) as Json;
    for (const status of REQUIRED_ERROR_STATUSES) {
      if (!(status in responses)) {
        fail(`${label}: missing ${status} response`);
      }
    }
    if (!('200' in responses)) fail(`${label}: missing 200 response`);
  }
}

if (operationCount === 0) fail('no operations found in the contract');

// Report.
if (errors.length > 0) {
  console.error(`openapi:check FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `openapi:check OK — ${operationCount} operations, all with x-cpf-usuario and the full error envelope; all $refs resolve.`,
);
