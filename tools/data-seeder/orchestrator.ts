import type { PoolClient } from 'pg';
import type { CliOptions, Output } from './cli.js';
import {
  condutorAuxiliaries,
  insertAuxiliaries,
  veiculoAuxiliaries,
} from './auxiliaries.js';
import { GENERATION_BASE_DATE } from './deterministic.js';
import { generateCondutores, generateVeiculos } from './generators.js';
import {
  assertNoReservedScenarioKeys,
  countDatabaseCollisions,
  filterDatabaseConflicts,
  persistCandidates,
} from './persistence.js';
import { runPreflight } from './preflight.js';
import { validateCondutores, validateVeiculos } from './validation.js';

export interface ConnectablePool {
  connect(): Promise<PoolClient>;
}

export interface SeederReport {
  target: string;
  phase: '1a' | '1b';
  seed: number;
  baseDate: string;
  candidates: number;
  attempts: number;
  inserted: number;
  skipped: number;
  auxiliaryInserted: number;
  batches: number;
  durationMs: number;
  validations: 'ok';
  dryRun: boolean;
}

export const executeSeeder = async (
  pool: ConnectablePool,
  options: CliOptions,
  output: Output,
): Promise<SeederReport> => {
  const started = performance.now();
  const client = await pool.connect();
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.once('SIGINT', interrupt);
  try {
    if (!options.dryRun) await client.query('begin');
    const preflight = await runPreflight(
      client,
      options.table,
      !options.dryRun,
    );
    const generated =
      options.table === 'senatran.condutor'
        ? generateCondutores(options.rows, options.seed)
        : generateVeiculos(options.rows, options.seed);
    if (options.table === 'senatran.condutor') {
      validateCondutores(
        generated.candidates as ReturnType<
          typeof generateCondutores
        >['candidates'],
      );
    } else {
      validateVeiculos(
        generated.candidates as ReturnType<
          typeof generateVeiculos
        >['candidates'],
      );
    }
    await assertNoReservedScenarioKeys(client, generated.candidates);
    const collisions = await countDatabaseCollisions(
      client,
      options.table,
      generated.candidates,
    );
    if (collisions > 0 && options.onConflict === 'error') {
      throw new Error(`Database collision detected (${collisions} rows)`);
    }
    const persistable =
      collisions > 0 && options.onConflict === 'skip'
        ? await filterDatabaseConflicts(
            client,
            options.table,
            generated.candidates,
          )
        : generated.candidates;
    let inserted = 0;
    let skipped = generated.candidates.length - persistable.length;
    let batches = 0;
    let auxiliaryInserted = 0;
    if (!options.dryRun) {
      const persisted = await persistCandidates(
        client,
        options.table,
        persistable,
        options.batchSize,
        options.onConflict,
        () => interrupted,
      );
      inserted = persisted.inserted;
      skipped += persisted.skipped;
      batches = persisted.batches;
      if (options.includeAuxiliaries) {
        const auxiliaryRows =
          options.table === 'senatran.condutor'
            ? condutorAuxiliaries(
                persistable as ReturnType<
                  typeof generateCondutores
                >['candidates'],
                options.seed,
              )
            : veiculoAuxiliaries(
                persistable as ReturnType<
                  typeof generateVeiculos
                >['candidates'],
                options.seed,
              );
        auxiliaryInserted = await insertAuxiliaries(
          client,
          auxiliaryRows,
          options.onConflict,
          options.batchSize,
        );
      }
      if (interrupted) throw new Error('Data seeding interrupted');
      await client.query('commit');
    }
    const report: SeederReport = {
      target: options.table,
      phase: options.includeAuxiliaries ? '1b' : '1a',
      seed: options.seed,
      baseDate: GENERATION_BASE_DATE,
      candidates: options.rows,
      attempts: generated.attempts,
      inserted,
      skipped,
      auxiliaryInserted,
      batches,
      durationMs: Math.round(performance.now() - started),
      validations: 'ok',
      dryRun: options.dryRun,
    };
    output.log(
      JSON.stringify({
        ...report,
        catalogDifferences: preflight.catalogs.missing,
      }),
    );
    return report;
  } catch (error) {
    if (!options.dryRun) {
      try {
        await client.query('rollback');
      } catch {
        // Preserve the original failure; connection cleanup is handled by the CLI.
      }
    }
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt);
    client.release();
  }
};
