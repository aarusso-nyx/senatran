import { describe, expect, it } from 'vitest';
import {
  condutorAuxiliaries,
  veiculoAuxiliaries,
} from '../../tools/data-seeder/auxiliaries.js';
import {
  generateCondutores,
  generateVeiculos,
} from '../../tools/data-seeder/generators.js';
import { validateOpenApiPayload } from '../../tools/data-seeder/openapi.js';
import {
  validateCondutores,
  validateVeiculos,
} from '../../tools/data-seeder/validation.js';

describe('data seeder candidate generation', () => {
  it('reproduces Condutores and covers categories and optional profiles', () => {
    const first = generateCondutores(100, 77);
    const second = generateCondutores(100, 77);
    expect(first).toEqual(second);
    expect(() => validateCondutores(first.candidates)).not.toThrow();
    expect(new Set(first.candidates.map((item) => item.payload.categoriaAtual))).toEqual(
      new Set(['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE']),
    );
    expect(first.candidates.some((item) => item.numeroPgu === undefined)).toBe(true);
    expect(first.candidates.some((item) => item.numeroFormularioPid === undefined)).toBe(true);
    expect(first.candidates.some((item) => item.numeroListaImpedimento === undefined)).toBe(true);
  });

  it('reproduces Veiculos independently and covers PF/PJ and vehicle types', () => {
    const first = generateVeiculos(100, 77);
    generateCondutores(7, 77);
    const second = generateVeiculos(100, 77);
    expect(first).toEqual(second);
    expect(() => validateVeiculos(first.candidates)).not.toThrow();
    expect(new Set(first.candidates.map((item) => item.tipoProprietario))).toEqual(
      new Set(['1', '2']),
    );
    const types = new Set(
      first.candidates.map((item) => item.payload.descricaoTipoVeiculo),
    );
    for (const type of ['AUTOMOVEL', 'CAMINHAO', 'MOTOCICLETA', 'ONIBUS']) {
      expect(types.has(type)).toBe(true);
    }
  });

  it('derives every auxiliary from a principal and leaves deterministic absences', () => {
    const drivers = generateCondutores(30, 5).candidates;
    const driverRows = condutorAuxiliaries(drivers, 5);
    expect(driverRows.length).toBeGreaterThan(0);
    expect(driverRows.length).toBeLessThan(60);
    for (const row of driverRows) {
      const key = row.table.endsWith('condutor_imagem') ? row.values[0] : row.values[0];
      expect(drivers.some((item) => item.cpf === key || item.numeroRegistro === key)).toBe(true);
    }

    const vehicles = generateVeiculos(60, 5).candidates;
    const vehicleRows = veiculoAuxiliaries(vehicles, 5);
    expect(vehicleRows.length).toBeGreaterThan(0);
    for (const row of vehicleRows) {
      const serialized = JSON.stringify(row.values);
      expect(
        vehicles.some(
          (item) =>
            serialized.includes(item.placa) || serialized.includes(item.chassi),
        ),
      ).toBe(true);
    }
  });

  it('rejects scalar, wrong type, anchor drift and code/description drift', () => {
    expect(validateOpenApiPayload('Condutor', 'scalar')).toContain(
      'Condutor: object expected',
    );
    const driver = generateCondutores(1, 1).candidates[0];
    driver.payload.sexo = 'wrong';
    expect(validateOpenApiPayload('Condutor', driver.payload)).toContain(
      'Condutor.sexo: integer expected',
    );

    const vehicle = generateVeiculos(1, 1).candidates[0];
    vehicle.payload.placa = 'DRIFT';
    expect(() => validateVeiculos([vehicle])).toThrow(/anchor mismatch/);
    vehicle.payload.placa = vehicle.placa;
    vehicle.payload.descricaoCor = 'INCOMPATIVEL';
    expect(() => validateVeiculos([vehicle])).toThrow(/mismatch/);
  });
});
