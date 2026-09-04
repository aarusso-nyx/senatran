import { pathToFileURL } from 'node:url';
import { generateCsv } from './csv-generator.js';
import { DEFAULT_SEED } from './cli.js';

export interface CsvCliOptions {
  schemaPath: string;
  rows: number;
  outputPath: string;
  seed: number;
}

export const CSV_HELP = `Senatran Data Seeder CSV (development/test only)

Usage:
  pnpm data:generate --schema <file> --rows <n> --output <file> [--seed <n>]
`;

const valueAfter = (args: string[], index: number): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${args[index]} requires a value`);
  }
  return value;
};

const integer = (value: string, flag: string, minimum?: number): number => {
  if (!/^-?\d+$/.test(value)) throw new Error(`${flag} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${flag} must be a safe integer`);
  if (minimum !== undefined && parsed < minimum) {
    throw new Error(`${flag} must be at least ${minimum}`);
  }
  return parsed;
};

export const parseCsvCliArgs = (args: string[]): CsvCliOptions | 'help' => {
  if (args.includes('--help')) return 'help';
  let schemaPath: string | undefined;
  let rows: number | undefined;
  let outputPath: string | undefined;
  let seed = DEFAULT_SEED;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`${flag} was provided twice`);
    seen.add(flag);
    switch (flag) {
      case '--schema':
        schemaPath = valueAfter(args, index);
        index += 1;
        break;
      case '--rows':
        rows = integer(valueAfter(args, index), flag, 1);
        index += 1;
        break;
      case '--output':
        outputPath = valueAfter(args, index);
        index += 1;
        break;
      case '--seed':
        seed = integer(valueAfter(args, index), flag);
        index += 1;
        break;
      default:
        throw new Error(`unknown argument: ${flag}`);
    }
  }
  if (!schemaPath) throw new Error('--schema is required');
  if (rows === undefined) throw new Error('--rows is required');
  if (!outputPath) throw new Error('--output is required');
  return { schemaPath, rows, outputPath, seed };
};

export const main = (
  args = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): number => {
  try {
    const options = parseCsvCliArgs(args);
    if (options === 'help') {
      console.log(CSV_HELP);
      return 0;
    }
    if (env.NODE_ENV === 'production') {
      throw new Error('Data seeding is forbidden when NODE_ENV=production');
    }
    const output = generateCsv(options);
    console.log(`Generated ${options.rows} rows at ${output}`);
    return 0;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'CSV generation failed',
    );
    return 1;
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
