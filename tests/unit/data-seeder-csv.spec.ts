import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateCsv,
  loadCsvSchema,
} from '../../tools/data-seeder/csv-generator.js';
import { parseCsvCliArgs } from '../../tools/data-seeder/csv-cli.js';

const schema = (name: 'condutor' | 'veiculo') =>
  resolve(`tools/data-seeder/schemas/${name}.schema.json`);

describe('data seeder CSV', () => {
  it.each(['condutor', 'veiculo'] as const)(
    'loads the valid %s JSON Schema and writes deterministic rows',
    (entity) => {
      const definition = loadCsvSchema(schema(entity));
      expect(definition.$schema).toContain('2020-12');
      const directory = mkdtempSync(join(tmpdir(), 'senatran-csv-'));
      const first = join(directory, `${entity}-1.csv`);
      const second = join(directory, `${entity}-2.csv`);
      generateCsv({
        schemaPath: schema(entity),
        rows: 25,
        outputPath: first,
        seed: 77,
      });
      generateCsv({
        schemaPath: schema(entity),
        rows: 25,
        outputPath: second,
        seed: 77,
      });
      const content = readFileSync(first, 'utf8');
      expect(content).toBe(readFileSync(second, 'utf8'));
      expect(content.trimEnd().split('\n')).toHaveLength(26);
      expect(content.split('\n')[0]).toBe(
        definition['x-columnOrder'].join(','),
      );
      expect(content).toContain('"{""');
    },
  );

  it('parses the minimal CLI and default seed', () => {
    expect(
      parseCsvCliArgs([
        '--schema',
        schema('condutor'),
        '--rows',
        '10',
        '--output',
        'tmp/condutores.csv',
      ]),
    ).toMatchObject({ rows: 10, seed: 20250101 });
  });
});
