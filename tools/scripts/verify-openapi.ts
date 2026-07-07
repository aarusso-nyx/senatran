/**
 * openapi:check — structural + contract-invariant validation of the mock's
 * contracts. Both surfaces share ONE convention (WSDenatran), so both files are
 * checked with identical rules:
 *   docs/framework/contracts/openapi.yaml              (57 read endpoints)
 *   docs/framework/contracts/openapi-transactional.yaml (30 RENACH/RENAINF)
 *
 * Guards, independent of any external linter:
 *   - the document is OpenAPI 3.1;
 *   - every operation requires the `x-cpf-usuario` header (via $ref);
 *   - every operation declares a 2xx success and the full error envelope
 *     (400/401/402/404/500);
 *   - every internal $ref resolves to a defined component.
 *
 * In P4 this script is extended to cross-check controller routes against the
 * contracts. Exit code 0 = pass, 1 = fail.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(here, '../../docs/framework/contracts');
const SPECS = ['openapi.yaml', 'openapi-transactional.yaml'];

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
const SUCCESS_2XX = /^2\d\d$/;

type Json = Record<string, unknown>;

const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

const resolveRef = (spec: Json, ref: string): boolean => {
  if (!ref.startsWith('#/')) return true;
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

const walkRefs = (spec: Json, node: unknown, label: string): void => {
  if (Array.isArray(node)) {
    node.forEach((n) => walkRefs(spec, n, label));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Json)) {
      if (key === '$ref' && typeof value === 'string') {
        if (!resolveRef(spec, value))
          fail(`${label}: unresolved $ref ${value}`);
      } else {
        walkRefs(spec, value, label);
      }
    }
  }
};

let totalOps = 0;

for (const specFile of SPECS) {
  const spec = parse(
    readFileSync(resolve(contractsDir, specFile), 'utf8'),
  ) as Json;

  const version = String(spec.openapi ?? '');
  if (!version.startsWith('3.1')) {
    fail(
      `${specFile}: openapi version must be 3.1.x, got "${version || '(missing)'}"`,
    );
  }

  walkRefs(spec, spec, specFile);

  const paths = (spec.paths ?? {}) as Json;
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    const pathItem = pathItemRaw as Json;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method] as Json | undefined;
      if (!op) continue;
      totalOps += 1;
      const label = `${specFile} ${method.toUpperCase()} ${pathKey}`;

      const params = (op.parameters ?? []) as Json[];
      const hasCpf = params.some((p) => {
        const ref = p.$ref;
        if (typeof ref === 'string' && /XCpfUsuario/.test(ref)) return true;
        return p.in === 'header' && p.name === 'x-cpf-usuario';
      });
      if (!hasCpf) fail(`${label}: missing required header x-cpf-usuario`);

      const responses = (op.responses ?? {}) as Json;
      for (const status of REQUIRED_ERROR_STATUSES) {
        if (!(status in responses))
          fail(`${label}: missing ${status} response`);
      }
      if (!Object.keys(responses).some((s) => SUCCESS_2XX.test(s))) {
        fail(`${label}: missing a 2xx success response`);
      }
    }
  }
}

if (totalOps === 0) fail('no operations found in the contracts');

if (errors.length > 0) {
  console.error(`openapi:check FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `openapi:check OK — ${totalOps} operations across ${SPECS.length} contracts, all with x-cpf-usuario, a 2xx success and the full error envelope; all $refs resolve.`,
);
