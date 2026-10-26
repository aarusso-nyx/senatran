import { describe, expect, it } from 'vitest';
import {
  GENERATION_BASE_DATE,
  createGenerationStream,
  syntheticName,
  uniqueCandidate,
} from '../../tools/data-seeder/deterministic.js';
import {
  chassi,
  cnpj,
  cpf,
  placaLegacy,
  placaMercosul,
  renavam,
} from '../../tools/scripts/lib/br.js';

describe('data seeder deterministic primitives', () => {
  it('pins the versioned generation base date', () => {
    expect(GENERATION_BASE_DATE).toBe('2025-01-01T00:00:00Z');
  });

  it('reproduces regulated and human candidates for the same stream', () => {
    const sample = () => {
      const stream = createGenerationStream(42, 'condutor');
      return [
        cpf(stream.rng),
        cnpj(stream.rng),
        placaMercosul(stream.rng),
        placaLegacy(stream.rng),
        chassi(stream.rng),
        renavam(stream.rng),
        syntheticName(stream),
      ];
    };
    expect(sample()).toEqual(sample());
  });

  it('keeps entity streams independent of consumption in another stream', () => {
    const vehicleBefore = createGenerationStream(20250101, 'veiculo');
    const expected = [chassi(vehicleBefore.rng), renavam(vehicleBefore.rng)];

    const drivers = createGenerationStream(20250101, 'condutor');
    for (let index = 0; index < 1_000; index += 1) cpf(drivers.rng);

    const vehicleAfter = createGenerationStream(20250101, 'veiculo');
    expect([chassi(vehicleAfter.rng), renavam(vehicleAfter.rng)]).toEqual(
      expected,
    );
  });

  it('retries collisions deterministically and enforces a limit', () => {
    const seen = new Set(['duplicate']);
    const values = ['duplicate', 'unique'];
    const result = uniqueCandidate(
      seen,
      (value) => value,
      () => values.shift()!,
    );
    expect(result).toEqual({ candidate: 'unique', attempts: 2 });
    expect(() =>
      uniqueCandidate(
        new Set(['x']),
        (value) => value,
        () => 'x',
        2,
      ),
    ).toThrow(/retry limit/);
  });
});
