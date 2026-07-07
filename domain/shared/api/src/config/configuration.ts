/**
 * Typed environment configuration for the SENATRAN mock.
 *
 * Values are read once at bootstrap. Everything has a dev-friendly default so
 * the service boots with zero configuration against a local Postgres.app.
 */
export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean;
  queryTimeoutMs: number;
}

export interface AuthConfig {
  /** When true, x-client-cert-cn must match an allowlisted CN (DB or dev list). */
  certSimulation: boolean;
  /** Fallback dev CNs accepted when the DB allowlist is empty. */
  devCertCns: string[];
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  database: DatabaseConfig;
  auth: AuthConfig;
}

const bool = (v: string | undefined, fallback: boolean): boolean =>
  v === undefined ? fallback : /^(1|true|on|yes)$/i.test(v);

const int = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const connectionString =
    env.DATABASE_URL ??
    `postgres://${env.DB_USER ?? 'postgres'}:${env.DB_PASSWORD ?? ''}@${
      env.DB_HOST ?? 'localhost'
    }:${env.DB_PORT ?? '5432'}/${env.DB_NAME ?? 'senatran'}`;

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: int(env.PORT, 3000),
    apiPrefix: env.API_PREFIX ?? '',
    database: {
      connectionString,
      ssl: bool(env.DB_SSL, false),
      queryTimeoutMs: int(env.DB_QUERY_TIMEOUT_MS, 15000),
    },
    auth: {
      certSimulation: bool(env.AUTH_CERT_SIMULATION, true),
      devCertCns: (env.AUTH_DEV_CERT_CNS ?? 'senatran-dev-client')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  };
};

/** DI token for the resolved AppConfig. */
export const APP_CONFIG = Symbol('APP_CONFIG');
