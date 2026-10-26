import { Faker, pt_BR } from '@faker-js/faker';
import { Rng } from '../scripts/lib/br.js';

export const GENERATION_BASE_DATE = '2025-01-01T00:00:00Z';
export const GENERATION_BASE_INSTANT = new Date(GENERATION_BASE_DATE);
export const MAX_COLLISION_ATTEMPTS = 100;

const hashLabel = (seed: number, label: string): number => {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

export interface GenerationStream {
  readonly rng: Rng;
  readonly faker: Faker;
}

/** Independent deterministic stream derived from the command seed and entity. */
export const createGenerationStream = (
  seed: number,
  label: string,
): GenerationStream => {
  const derivedSeed = hashLabel(seed, label);
  const faker = new Faker({ locale: [pt_BR] });
  faker.seed(derivedSeed);
  return { rng: new Rng(derivedSeed), faker };
};

export const syntheticName = (stream: GenerationStream): string =>
  stream.faker.person.fullName().toLocaleUpperCase('pt-BR');

export const syntheticStreet = (stream: GenerationStream): string =>
  stream.faker.location.street().toLocaleUpperCase('pt-BR');

export const syntheticText = (stream: GenerationStream, words = 4): string =>
  stream.faker.lorem.words(words).toLocaleUpperCase('pt-BR');

export const uniqueCandidate = <T>(
  seen: Set<string>,
  keyOf: (candidate: T) => string,
  build: () => T,
  maximumAttempts = MAX_COLLISION_ATTEMPTS,
): { candidate: T; attempts: number } => {
  for (let attempts = 1; attempts <= maximumAttempts; attempts += 1) {
    const candidate = build();
    const key = keyOf(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      return { candidate, attempts };
    }
  }
  throw new Error(
    `Deterministic collision retry limit reached (${maximumAttempts})`,
  );
};
