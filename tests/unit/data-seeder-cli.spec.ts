import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CliUsageError,
  DEFAULT_BATCH_SIZE,
  DEFAULT_SEED,
  main,
  parseCliArgs,
  poolConfigFromDatabase,
  runCli,
  type CliDependencies,
} from '../../tools/data-seeder/cli.js';

const validArgs = ['--table', 'senatran.condutor', '--rows', '10000'];

const fakeDependencies = () => {
  const query = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));
  const end = vi.fn(async () => undefined);
  const createPool = vi.fn(() => ({ query, end }));
  const output = { log: vi.fn(), error: vi.fn() };
  return {
    dependencies: { createPool, output } satisfies CliDependencies,
    createPool,
    query,
    end,
    output,
  };
};

describe('data seeder CLI', () => {
  it('runs node populate.js --help without connecting', () => {
    const result = spawnSync(process.execPath, ['populate.js', '--help'], {
      cwd: resolve(import.meta.dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://user:do-not-print@invalid:1/database',
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('node populate.js');
    expect(result.stdout).not.toContain('do-not-print');
    expect(result.stderr).toBe('');
  });

  it('parses required arguments and stable defaults', () => {
    expect(parseCliArgs(validArgs)).toEqual({
      table: 'senatran.condutor',
      rows: 10_000,
      seed: DEFAULT_SEED,
      batchSize: DEFAULT_BATCH_SIZE,
      dryRun: false,
      onConflict: 'error',
      includeAuxiliaries: false,
    });
  });

  it('parses all optional arguments', () => {
    expect(
      parseCliArgs([
        '--table',
        'senatran.veiculo',
        '--rows',
        '1',
        '--seed',
        '-42',
        '--batch-size',
        '10',
        '--dry-run',
        '--on-conflict',
        'skip',
      ]),
    ).toMatchObject({
      table: 'senatran.veiculo',
      rows: 1,
      seed: -42,
      batchSize: 10,
      dryRun: true,
      onConflict: 'skip',
    });
  });

  it.each([
    [[], '--table is required'],
    [['--table', 'senatran.infracao', '--rows', '1'], 'unsupported table'],
    [['--table', 'senatran.condutor'], '--rows is required'],
    [['--table', 'senatran.condutor', '--rows', '0'], 'at least 1'],
    [['--table', 'senatran.condutor', '--rows', '10001'], 'at most 10000'],
    [['--table', 'senatran.condutor', '--rows', '1.5'], 'must be an integer'],
    [
      ['--table', 'senatran.condutor', '--rows', '1', '--batch-size', '0'],
      'at least 1',
    ],
    [
      ['--table', 'senatran.condutor', '--rows', '1', '--on-conflict', 'merge'],
      'must be error or skip',
    ],
    [['--unknown'], 'unknown argument'],
  ])('rejects invalid arguments %# before connecting', (args, message) => {
    expect(() => parseCliArgs(args)).toThrowError(CliUsageError);
    expect(() => parseCliArgs(args)).toThrow(message);
  });

  it('uses DATABASE_URL before individual DB variables', () => {
    const connectionString =
      'postgres://url-user:url-secret@url-host:5433/url-db';
    const config = poolConfigFromDatabase(
      // This is the shape returned by the shared loadConfig function.
      {
        connectionString,
        ssl: true,
        queryTimeoutMs: 4321,
      },
    );

    expect(config).toMatchObject({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4321,
      query_timeout: 4321,
      statement_timeout: 4321,
    });
  });

  it('passes DATABASE_URL precedence from shared configuration to pg', async () => {
    const fake = fakeDependencies();
    const databaseUrl = 'postgres://url-user:url-secret@url-host:5433/url-db';
    await runCli(
      validArgs,
      {
        DATABASE_URL: databaseUrl,
        DB_USER: 'ignored-user',
        DB_PASSWORD: 'ignored-secret',
        DB_HOST: 'ignored-host',
        DB_NAME: 'ignored-db',
      },
      fake.dependencies,
    );

    expect(fake.createPool).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: databaseUrl }),
    );
  });

  it('resolves DB_* variables and always closes a successful connection', async () => {
    const fake = fakeDependencies();
    const code = await runCli(
      validArgs,
      {
        DB_USER: 'db-user',
        DB_PASSWORD: 'db-secret',
        DB_HOST: 'db-host',
        DB_PORT: '5544',
        DB_NAME: 'db-name',
        DB_SSL: 'true',
        DB_QUERY_TIMEOUT_MS: '7654',
      },
      fake.dependencies,
    );

    expect(code).toBe(0);
    expect(fake.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgres://db-user:db-secret@db-host:5544/db-name',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 7654,
      }),
    );
    expect(fake.query).toHaveBeenCalledWith('select 1');
    expect(fake.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(fake.output.log.mock.calls)).not.toContain(
      'db-secret',
    );
  });

  it('rejects production before creating a pool, without an override', async () => {
    const fake = fakeDependencies();
    const code = await main(
      validArgs,
      { NODE_ENV: 'production' },
      fake.dependencies,
    );

    expect(code).toBe(1);
    expect(fake.createPool).not.toHaveBeenCalled();
    expect(fake.output.error).toHaveBeenCalledWith(
      'Data seeding is forbidden when NODE_ENV=production',
    );
  });

  it('rejects invalid arguments before creating a pool', async () => {
    const fake = fakeDependencies();
    const code = await main(
      ['--table', 'senatran.condutor', '--rows', '0'],
      {},
      fake.dependencies,
    );

    expect(code).toBe(1);
    expect(fake.createPool).not.toHaveBeenCalled();
    expect(fake.output.error).toHaveBeenCalledWith('--rows must be at least 1');
  });

  it('sanitizes connection failures and closes the pool', async () => {
    const fake = fakeDependencies();
    fake.query.mockRejectedValueOnce(
      new Error('postgres://user:super-secret@host/database'),
    );
    const code = await main(validArgs, {}, fake.dependencies);

    expect(code).toBe(1);
    expect(fake.output.error).toHaveBeenCalledWith(
      'Database connection failed',
    );
    expect(JSON.stringify(fake.output.error.mock.calls)).not.toContain(
      'super-secret',
    );
    expect(fake.end).toHaveBeenCalledOnce();
  });
});
