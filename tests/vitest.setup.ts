/**
 * Unit-tier setup. Stub env so modules import without a real environment, and
 * silence Nest logs. No database or network in the unit tier.
 */
import { Logger } from '@nestjs/common';

const setIfAbsent = (k: string, v: string): void => {
  if (process.env[k] === undefined) process.env[k] = v;
};

setIfAbsent('NODE_ENV', 'test');
setIfAbsent('DATABASE_URL', 'postgres://postgres@localhost:5432/senatran_test');
setIfAbsent('AUTH_CERT_SIMULATION', 'on');
setIfAbsent('AUTH_DEV_CERT_CNS', 'senatran-dev-client');

Logger.overrideLogger(false);
