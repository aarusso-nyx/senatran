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
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

// ---- example ↔ schema conformance -----------------------------------------
// Any `example:` on a component schema must itself satisfy that schema, so the
// documented samples cannot silently drift from the contract. Strict: undeclared
// fields, type/enum/format mismatches all fail. (Missing fields are allowed —
// examples may be representative subsets.)
const derefSchema = (spec: Json, s: Json): Json => {
  let cur = s;
  for (let i = 0; i < 10 && typeof cur?.$ref === 'string'; i++) {
    let node: unknown = spec;
    for (const k of cur.$ref.slice(2).split('/')) node = (node as Json)?.[k];
    cur = (node as Json) ?? {};
  }
  return cur;
};

const checkExample = (
  spec: Json,
  value: unknown,
  schemaIn: Json,
  path: string,
  label: string,
): void => {
  const s = derefSchema(spec, schemaIn);
  if (value === null || value === undefined) return;
  const en = s.enum as unknown[] | undefined;
  if (Array.isArray(en)) {
    if (!en.includes(value))
      fail(`${label} example ${path}: ${JSON.stringify(value)} not in enum`);
    return;
  }
  const type = s.type as string | undefined;
  if (type === 'array' || s.items) {
    if (!Array.isArray(value))
      return fail(`${label} example ${path}: not array`);
    const items = (s.items as Json) ?? { type: 'string' };
    value.forEach((v, i) =>
      checkExample(spec, v, items, `${path}[${i}]`, label),
    );
    return;
  }
  if (s.properties || type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value))
      return fail(`${label} example ${path}: not object`);
    if (!s.properties) return; // free-form object accepts anything
    const props = s.properties as Json;
    for (const [k, v] of Object.entries(value as Json)) {
      if (!(k in props))
        fail(`${label} example ${path}.${k}: undeclared field`);
      else checkExample(spec, v, props[k] as Json, `${path}.${k}`, label);
    }
    return;
  }
  if (type === 'integer' || type === 'number') {
    if (typeof value !== 'number')
      fail(`${label} example ${path}: expected ${type}`);
    else if (type === 'integer' && !Number.isInteger(value))
      fail(`${label} example ${path}: expected integer`);
    return;
  }
  if (type === 'boolean') {
    if (typeof value !== 'boolean')
      fail(`${label} example ${path}: expected boolean`);
    return;
  }
  if (typeof value !== 'string')
    return fail(`${label} example ${path}: expected string`);
  if (value !== '') {
    if (s.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value))
      fail(`${label} example ${path}: expected date (YYYY-MM-DD)`);
    if (s.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T/.test(value))
      fail(`${label} example ${path}: expected date-time`);
  }
};

let totalOps = 0;
let totalExamples = 0;
const contractOps = new Set<string>(); // "method /path" across both contracts

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

  const schemasMap = ((spec.components as Json)?.schemas ?? {}) as Json;
  for (const [name, schemaRaw] of Object.entries(schemasMap)) {
    const schema = schemaRaw as Json;
    if ('example' in schema) {
      totalExamples += 1;
      checkExample(spec, schema.example, schema, name, `${specFile} ${name}`);
    }
  }

  const paths = (spec.paths ?? {}) as Json;
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    const pathItem = pathItemRaw as Json;
    for (const method of HTTP_METHODS) {
      const op = pathItem[method] as Json | undefined;
      if (!op) continue;
      totalOps += 1;
      contractOps.add(`${method} ${pathKey}`);
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

// ---- Controller ↔ contract drift ------------------------------------------
const repoRoot = resolve(here, '../..');

function walkControllers(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkControllers(p));
    else if (entry.endsWith('.controller.ts') && !entry.endsWith('.spec.ts'))
      out.push(p);
  }
  return out;
}

/** Normalize a controller base+subpath to the contract path form (after /v1). */
function toContractPath(base: string, sub: string): string {
  const joined = [base, sub].filter(Boolean).join('/');
  let path =
    '/' + joined.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/{2,}/g, '/');
  path = path.replace(/^\/v1(?=\/|$)/, ''); // strip the /v1 base prefix
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function controllerOps(): Set<string> {
  const routes = new Set<string>();
  const ctrlRe = /@Controller\(\s*(['"`])([^'"`]*)\1/;
  const methodRe = /@(Get|Post|Put|Patch|Delete)\(\s*(?:(['"`])([^'"`]*)\2)?/g;
  const files = [
    resolve(repoRoot, 'domain'),
    resolve(repoRoot, 'apps'),
  ].flatMap(walkControllers);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const cm = ctrlRe.exec(src);
    if (!cm) continue;
    const base = cm[2];
    if (base === 'health') continue; // operational, not part of the contract
    let m: RegExpExecArray | null;
    while ((m = methodRe.exec(src)) !== null) {
      routes.add(`${m[1].toLowerCase()} ${toContractPath(base, m[3] ?? '')}`);
    }
  }
  return routes;
}

const implemented = controllerOps();
for (const route of implemented) {
  if (!contractOps.has(route))
    fail(`controller route not in any contract: ${route}`);
}
for (const route of contractOps) {
  if (!implemented.has(route))
    fail(`contract path not implemented by a controller: ${route}`);
}

if (errors.length > 0) {
  console.error(`openapi:check FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `openapi:check OK — ${totalOps} operations across ${SPECS.length} contracts, all with x-cpf-usuario, a 2xx success and the full error envelope; all $refs resolve; ${totalExamples} schema examples conform; ${implemented.size} controller routes match the contracts (no drift).`,
);
