import { Pool, type PoolConfig } from 'pg';
import {
  loadConfig,
  type DatabaseConfig,
} from '../../domain/shared/api/src/config/configuration.js';
import { executeSeeder, type ConnectablePool } from './orchestrator.js';

export const SUPPORTED_TABLES = [
  'senatran.condutor',
  'senatran.veiculo',
] as const;

export type SupportedTable = (typeof SUPPORTED_TABLES)[number];
export type ConflictMode = 'error' | 'skip';

export interface CliOptions {
  table: SupportedTable;
  rows: number;
  seed: number;
  batchSize: number;
  dryRun: boolean;
  onConflict: ConflictMode;
  includeAuxiliaries: boolean;
}

export interface Output {
  log(message: string): void;
  error(message: string): void;
}

interface PoolLike {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

export interface CliDependencies {
  createPool(config: PoolConfig): PoolLike;
  output: Output;
  execute?(pool: PoolLike, options: CliOptions, output: Output): Promise<void>;
}

export const DEFAULT_SEED = 20250101;
export const DEFAULT_BATCH_SIZE = 250;

export const HELP = `Senatran Data Seeder (development/test only)

Usage:
  node populate.js --table <schema.table> --rows <n> [options]

Required:
  --table <schema.table>       senatran.condutor or senatran.veiculo
  --rows <n>                  Candidate count (integer from 1 to 10000)

Options:
  --seed <n>                  Deterministic integer seed (default: ${DEFAULT_SEED})
  --batch-size <n>            Positive integer (default: ${DEFAULT_BATCH_SIZE})
  --dry-run                   Validate and report without writing
  --on-conflict error|skip    Database collision mode (default: error)
  --include-auxiliaries       Populate Phase 1b auxiliaries derived from candidates
  --help                      Show this help without connecting
`;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

export class ProductionEnvironmentError extends Error {
  constructor() {
    super('Data seeding is forbidden when NODE_ENV=production');
    this.name = 'ProductionEnvironmentError';
  }
}

const readValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new CliUsageError(`${flag} requires a value`);
  }
  return value;
};

const parseInteger = (
  raw: string,
  flag: string,
  minimum?: number,
  maximum?: number,
): number => {
  if (!/^-?\d+$/.test(raw)) {
    throw new CliUsageError(`${flag} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new CliUsageError(`${flag} must be a safe integer`);
  }
  if (minimum !== undefined && value < minimum) {
    throw new CliUsageError(`${flag} must be at least ${minimum}`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new CliUsageError(`${flag} must be at most ${maximum}`);
  }
  return value;
};

export const parseCliArgs = (args: string[]): CliOptions | 'help' => {
  if (args.includes('--help')) return 'help';

  let table: SupportedTable | undefined;
  let rows: number | undefined;
  let seed = DEFAULT_SEED;
  let batchSize = DEFAULT_BATCH_SIZE;
  let dryRun = false;
  let onConflict: ConflictMode = 'error';
  let includeAuxiliaries = false;
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (seen.has(flag)) throw new CliUsageError(`${flag} was provided twice`);
    seen.add(flag);

    switch (flag) {
      case '--table': {
        const value = readValue(args, index, flag);
        if (!SUPPORTED_TABLES.includes(value as SupportedTable)) {
          throw new CliUsageError(`unsupported table: ${value}`);
        }
        table = value as SupportedTable;
        index += 1;
        break;
      }
      case '--rows':
        rows = parseInteger(readValue(args, index, flag), flag, 1, 10_000);
        index += 1;
        break;
      case '--seed':
        seed = parseInteger(readValue(args, index, flag), flag);
        index += 1;
        break;
      case '--batch-size':
        batchSize = parseInteger(readValue(args, index, flag), flag, 1);
        index += 1;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--include-auxiliaries':
        includeAuxiliaries = true;
        break;
      case '--on-conflict': {
        const value = readValue(args, index, flag);
        if (value !== 'error' && value !== 'skip') {
          throw new CliUsageError('--on-conflict must be error or skip');
        }
        onConflict = value;
        index += 1;
        break;
      }
      default:
        throw new CliUsageError(`unknown argument: ${flag}`);
    }
  }

  if (table === undefined) throw new CliUsageError('--table is required');
  if (rows === undefined) throw new CliUsageError('--rows is required');

  return {
    table,
    rows,
    seed,
    batchSize,
    dryRun,
    onConflict,
    includeAuxiliaries,
  };
};

export const poolConfigFromDatabase = (config: DatabaseConfig): PoolConfig => ({
  connectionString: config.connectionString,
  ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: config.queryTimeoutMs,
  query_timeout: config.queryTimeoutMs,
  statement_timeout: config.queryTimeoutMs,
});

const defaultDependencies: CliDependencies = {
  createPool: (config) => new Pool(config),
  output: console,
  execute: async (pool, options, output) => {
    await executeSeeder(pool as unknown as ConnectablePool, options, output);
  },
};

export const runCli = async (
  args: string[],
  env: NodeJS.ProcessEnv,
  dependencies: CliDependencies = defaultDependencies,
): Promise<number> => {
  const options = parseCliArgs(args);
  if (options === 'help') {
    dependencies.output.log(HELP);
    return 0;
  }
  if (env.NODE_ENV === 'production') throw new ProductionEnvironmentError();

  const appConfig = loadConfig(env);
  const pool = dependencies.createPool(
    poolConfigFromDatabase(appConfig.database),
  );
  try {
    if (dependencies.execute) {
      await dependencies.execute(pool, options, dependencies.output);
    } else {
      await pool.query('select 1');
      dependencies.output.log(
        [
          'CLI validation OK',
          `target=${options.table}`,
          `candidates=${options.rows}`,
          `seed=${options.seed}`,
          `batchSize=${options.batchSize}`,
          `dryRun=${options.dryRun}`,
          `onConflict=${options.onConflict}`,
        ].join(' '),
      );
    }
    return 0;
  } finally {
    await pool.end();
  }
};

export const main = async (
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  dependencies: CliDependencies = defaultDependencies,
): Promise<number> => {
  try {
    return await runCli(args, env, dependencies);
  } catch (error) {
    if (
      error instanceof CliUsageError ||
      error instanceof ProductionEnvironmentError
    ) {
      dependencies.output.error(error.message);
    } else {
      dependencies.output.error('Database connection failed');
    }
    return 1;
  }
};
