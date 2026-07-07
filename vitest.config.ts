import { defineConfig } from 'vitest/config';

/**
 * Tiered Vitest configuration for the SENATRAN mock.
 *
 * Select tier via SENATRAN_TEST_TIER env var (default: unit):
 *   unit        — domain/**\/*.spec.ts + apps/**\/*.spec.ts (co-located unit tests, DB stubbed)
 *   integration — tests/integration/**\/*.integration.spec.ts (real Postgres, contract views)
 *   e2e         — tests/e2e/**\/*.e2e.spec.ts (full HTTP + real Postgres, scenario matrix)
 *   real        — tests/real/**\/*.real.spec.ts (reserved)
 */
const tier = (process.env.SENATRAN_TEST_TIER ?? 'unit') as
  'unit' | 'integration' | 'e2e' | 'real';

const isCoverageRun =
  process.argv.includes('--coverage') ||
  process.env.COVERAGE === 'true' ||
  process.env.npm_lifecycle_event?.startsWith('test:cov') === true;

const enforceCoverageThresholds = tier === 'unit';

const includeByTier: Record<typeof tier, string[]> = {
  unit: [
    'domain/**/api/src/**/*.spec.ts',
    'apps/**/*.spec.ts',
    'tests/unit/**/*.spec.ts',
  ],
  integration: ['tests/integration/**/*.integration.spec.ts'],
  e2e: ['tests/e2e/**/*.e2e.spec.ts'],
  real: ['tests/real/**/*.real.spec.ts'],
};

const setupByTier: Record<typeof tier, string[]> = {
  unit: ['tests/vitest.setup.ts'],
  integration: ['tests/vitest.setup.integration.ts'],
  e2e: ['tests/vitest.setup.integration.ts'],
  real: ['tests/vitest.setup.integration.ts'],
};

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: includeByTier[tier],
    setupFiles: setupByTier[tier],
    passWithNoTests: true,
    fileParallelism: !(tier === 'e2e' && isCoverageRun),
    testTimeout: tier === 'unit' ? 10_000 : 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      include: ['domain/**/api/src/**/*.ts', 'apps/**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.module.ts',
        '**/main.ts',
      ],
      reportsDirectory: '.devai/state/coverage/tier-' + tier,
      // Aligned with .devai/config/thresholds.json (unit tier only).
      thresholds: enforceCoverageThresholds
        ? { lines: 70, branches: 60, functions: 70, statements: 70 }
        : { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
  },
});
