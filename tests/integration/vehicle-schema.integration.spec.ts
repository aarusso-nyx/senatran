import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';

let db: PgDatabase;

beforeAll(() => {
  db = new PgDatabase(loadConfig().database);
});

afterAll(() => db.close());

describe('senatran.veiculo schema', () => {
  it('uses chassi as its domain primary key and id as a generated unique cursor', async () => {
    const columns = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select column_name, data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'senatran'
          and table_name = 'veiculo'
          and column_name in ('id', 'chassi', 'placa', 'codigo_renavam')`,
    );
    const byName = Object.fromEntries(
      columns.rows.map((column) => [column.column_name, column]),
    );

    expect(byName.id).toMatchObject({
      data_type: 'bigint',
      is_nullable: 'NO',
    });
    expect(byName.id.column_default).toContain('nextval(');
    expect(byName.chassi.is_nullable).toBe('NO');
    expect(byName.placa.is_nullable).toBe('NO');
    expect(byName.codigo_renavam.is_nullable).toBe('NO');

    const constraints = await db.query<{
      constraint_type: string;
      columns: string[];
    }>(
      `select tc.constraint_type,
              array_to_json(array_agg(kcu.column_name order by kcu.ordinal_position)) as columns
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on kcu.constraint_catalog = tc.constraint_catalog
          and kcu.constraint_schema = tc.constraint_schema
          and kcu.constraint_name = tc.constraint_name
        where tc.table_schema = 'senatran'
          and tc.table_name = 'veiculo'
          and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
        group by tc.constraint_name, tc.constraint_type`,
    );

    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        { constraint_type: 'PRIMARY KEY', columns: ['chassi'] },
        { constraint_type: 'UNIQUE', columns: ['id'] },
        { constraint_type: 'UNIQUE', columns: ['placa'] },
        { constraint_type: 'UNIQUE', columns: ['codigo_renavam'] },
      ]),
    );
  });

  it.each([
    ['chassi', 'TST001CHASSI00001', 'TQK0A01', '90000000001'],
    ['placa', 'TST001CHASSI00002', 'TQK0A02', '90000000002'],
    ['codigo_renavam', 'TST001CHASSI00003', 'TQK0A03', '90000000003'],
  ] as const)(
    'rejects duplicate %s values',
    async (column, chassi, placa, renavam) => {
      await db.query('begin');
      try {
        const inserted = await db.query<{ id: string }>(
          `insert into senatran.veiculo (chassi, placa, codigo_renavam, payload)
         values ($1, $2, $3, '{}'::jsonb)
         returning id`,
          [chassi, placa, renavam],
        );
        expect(inserted.rows[0].id).toBeDefined();

        const duplicate = {
          chassi: [chassi, 'TQK0A09', '90000000009'],
          placa: ['TST001CHASSI00009', placa, '90000000009'],
          codigo_renavam: ['TST001CHASSI00009', 'TQK0A09', renavam],
        }[column];

        await expect(
          db.query(
            `insert into senatran.veiculo (chassi, placa, codigo_renavam, payload)
           values ($1, $2, $3, '{}'::jsonb)`,
            duplicate,
          ),
        ).rejects.toMatchObject({ code: '23505' });
      } finally {
        await db.query('rollback');
      }
    },
  );
});
