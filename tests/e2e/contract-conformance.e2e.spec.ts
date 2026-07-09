import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createE2eApp, AUTH, type TestApp } from '../utils/e2e-app.js';
import {
  loadContract,
  success2xxSchema,
  validateAgainstSchema,
  type JsonSchema,
} from '../utils/schema-validate.js';

/**
 * Contract conformance — every WSDenatran read endpoint is driven over real HTTP
 * with deterministic fixture params, and its response body is validated against
 * the schema the OpenAPI contract declares for that status. Because the schemas
 * carry no `required`/`additionalProperties`/`enum`, a permissive check is
 * worthless; the shared validator is STRICT — it fails on an undeclared field or
 * a type/format mismatch, exactly the view↔contract drift that would mislead
 * siblings (pec, teat). Success bodies validate against the operation's 2xx
 * schema; error bodies against ErrorResponse. No endpoint is silently dropped:
 * those whose params we cannot satisfy from fixtures are collected and printed,
 * and the covered count is asserted against a floor.
 */
const contract = loadContract('openapi.yaml');
const schemas = contract.components.schemas;

// Deterministic fixture values (see database/seed/manifest.json). The placa /
// chassi / renavam / motor / cambio all belong to the SAME vehicle (IND1I01) so
// multi-key lookups resolve to a real row; cpf/pgu/pid/impedimento are the
// fixture condutor (RN0000000001).
const PARAMS: Record<string, string> = {
  placa: 'IND1I01',
  chassi: '9BWZZZ377VT004253',
  renavam: '00123456782',
  motor: 'MOT0000003',
  cambio: 'CAM0000003',
  cpf: '52998224725',
  cnpj: '11444777000161',
  numeroRegistro: '01234567890',
  numeroRegistroCnh: '01234567890',
  numeroSeguranca: '000000001', // fixture condutor CNH security number
  cnh: '01234567890',
  pgu: 'PGU0000001',
  pid: 'PID0000001',
  impedimento: 'IMP0000001',
  identificacao: '52998224725', // proprietário lookup by owner document
  uf: 'RS',
  nomeCondutor: 'MARIA SILVA 01',
  dataNascimento: '1985-03-14',
  nomeMae: 'JOANA SILVA',
};

let ctx: TestApp;
beforeAll(async () => {
  ctx = await createE2eApp();
});
afterAll(async () => {
  await ctx.close();
});

describe('contract conformance (read surface)', () => {
  it('every GET response conforms strictly to its declared schema', async () => {
    const errorSchema: JsonSchema = {
      $ref: '#/components/schemas/ErrorResponse',
    };
    const violations: string[] = [];
    const skipped: string[] = [];
    let covered = 0;
    let ok2xx = 0;

    for (const [tmpl, ops] of Object.entries(contract.paths)) {
      const op = ops.get;
      if (!op) continue;
      const params = [...tmpl.matchAll(/{(\w+)}/g)].map((m) => m[1]);
      if (!params.every((p) => p in PARAMS)) {
        skipped.push(
          `${tmpl}  (needs ${params.filter((p) => !(p in PARAMS)).join(', ')})`,
        );
        continue;
      }
      const url =
        '/v1' +
        tmpl.replace(/{(\w+)}/g, (_, p) => encodeURIComponent(PARAMS[p]));
      const res = await request(ctx.server).get(url).set(AUTH);
      covered++;

      const schema =
        res.status >= 200 && res.status < 300
          ? success2xxSchema(op)
          : errorSchema;
      if (!schema) {
        violations.push(`${url}: no schema declared for status ${res.status}`);
        continue;
      }
      if (res.status >= 200 && res.status < 300) ok2xx++;
      // supertest only parses object/array bodies into res.body; scalar JSON
      // (e.g. a bare `true` from a boolean endpoint) lands in res.text.
      const body =
        res.text && res.text.length ? JSON.parse(res.text) : res.body;
      validateAgainstSchema(
        body,
        schema,
        schemas,
        `${res.status} ${tmpl}`,
        violations,
      );
    }

    if (skipped.length)
      console.warn(
        `conformance: ${skipped.length} endpoint(s) skipped (no fixture param):\n  ` +
          skipped.join('\n  '),
      );
    console.info(
      `conformance: ${covered} endpoints exercised, ${ok2xx} returned 2xx, ${violations.length} violations`,
    );
    if (violations.length)
      console.error('conformance violations:\n  ' + violations.join('\n  '));

    expect(violations).toEqual([]);
    // Guard against the fixture map / pagination silently regressing coverage
    // (deterministic run currently: 46 exercised, 40 at 2xx).
    expect(covered).toBeGreaterThanOrEqual(40);
    expect(ok2xx).toBeGreaterThanOrEqual(35);
  });
});
