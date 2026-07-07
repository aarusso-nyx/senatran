import { describe, expect, it } from 'vitest';
import {
  Rng,
  cpf,
  cnpj,
  placaMercosul,
  placaLegacy,
  chassi,
  renavam,
} from '../../tools/scripts/lib/br.js';

const validCpf = (v: string): boolean => {
  if (!/^\d{11}$/.test(v)) return false;
  const calc = (n: number): number => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(v[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(v[9]) && calc(10) === Number(v[10]);
};

const validCnpj = (v: string): boolean => {
  if (!/^\d{14}$/.test(v)) return false;
  const calc = (base: number[], w: number[]): number => {
    const s = base.reduce((a, d, i) => a + d * w[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  const d = v.split('').map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    calc(d.slice(0, 12), w1) === d[12] && calc(d.slice(0, 13), w2) === d[13]
  );
};

describe('BR format helpers (INV-DATA-001)', () => {
  it('generates CPFs with valid check digits', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 200; i++) expect(validCpf(cpf(rng))).toBe(true);
  });

  it('generates CNPJs with valid check digits', () => {
    const rng = new Rng(2);
    for (let i = 0; i < 200; i++) expect(validCnpj(cnpj(rng))).toBe(true);
  });

  it('generates well-formed plates, chassis and RENAVAMs', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      expect(placaMercosul(rng)).toMatch(
        /^[A-HJ-NPR-Z]{3}\d[A-HJ-NPR-Z]\d{2}$/,
      );
      expect(placaLegacy(rng)).toMatch(/^[A-HJ-NPR-Z]{3}\d{4}$/);
      const c = chassi(rng);
      expect(c).toHaveLength(17);
      expect(c).not.toMatch(/[IOQ]/);
      expect(renavam(rng)).toMatch(/^\d{11}$/);
    }
  });

  it('is deterministic: same seed → identical sequence', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => cpf(a));
    const seqB = Array.from({ length: 20 }, () => cpf(b));
    expect(seqA).toEqual(seqB);
  });
});
