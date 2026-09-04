/**
 * Brazilian format helpers + a deterministic PRNG. All randomness in the seed
 * generator flows through `Rng` so output is byte-identical across runs
 * (INV-DATA-001). No Math.random / Date.now.
 */

/** mulberry32 — small deterministic PRNG seeded from a 32-bit integer. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  bool(pTrue = 0.5): boolean {
    return this.next() < pTrue;
  }
  digits(n: number): string {
    let out = '';
    for (let i = 0; i < n; i++) out += String(this.int(0, 9));
    return out;
  }
}

const cpfCheck = (base: string): string => {
  const calc = (nums: number[]): number => {
    let sum = 0;
    const start = nums.length + 1;
    for (let i = 0; i < nums.length; i++) sum += nums[i] * (start - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const arr = base.split('').map(Number);
  const d1 = calc(arr);
  const d2 = calc([...arr, d1]);
  return base + d1 + d2;
};

/** Valid 11-digit CPF from a 9-digit numeric base. */
export const cpf = (rng: Rng): string => cpfCheck(rng.digits(9));

/** Returns whether a value is an 11-digit CPF with valid check digits. */
export const isValidCpf = (value: string): boolean =>
  /^\d{11}$/.test(value) &&
  !/^(\d)\1{10}$/.test(value) &&
  cpfCheck(value.slice(0, 9)) === value;

const cnpjCheck = (base: string): string => {
  const calc = (nums: number[], weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < nums.length; i++) sum += nums[i] * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const arr = base.split('').map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(arr, w1);
  const d2 = calc([...arr, d1], w2);
  return base + d1 + d2;
};

/** Valid 14-digit CNPJ (matriz 0001) from an 8-digit numeric base. */
export const cnpj = (rng: Rng): string => cnpjCheck(rng.digits(8) + '0001');

/** Returns whether a value is a 14-digit CNPJ with valid check digits. */
export const isValidCnpj = (value: string): boolean =>
  /^\d{14}$/.test(value) &&
  !/^(\d)\1{13}$/.test(value) &&
  cnpjCheck(value.slice(0, 12)) === value;

const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'; // plate letters (no I/O/Q ambiguity)
/** Mercosul plate LLLNLNN, e.g. ABC1D23. */
export const placaMercosul = (rng: Rng): string =>
  rng.pick(L.split('')) +
  rng.pick(L.split('')) +
  rng.pick(L.split('')) +
  rng.int(0, 9) +
  rng.pick(L.split('')) +
  rng.int(0, 9) +
  rng.int(0, 9);
/** Legacy plate LLLNNNN, e.g. ABC1234. */
export const placaLegacy = (rng: Rng): string =>
  rng.pick(L.split('')) +
  rng.pick(L.split('')) +
  rng.pick(L.split('')) +
  rng.digits(4);

export const isValidPlate = (value: string): boolean =>
  /^(?:[A-HJ-NPR-Z]{3}\d[A-HJ-NPR-Z]\d{2}|[A-HJ-NPR-Z]{3}\d{4})$/.test(value);

const VIN = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // no I/O/Q
/** 17-char VIN-style chassi. */
export const chassi = (rng: Rng): string => {
  let out = '';
  for (let i = 0; i < 17; i++) out += rng.pick(VIN.split(''));
  return out;
};

export const isValidChassi = (value: string): boolean =>
  /^[A-HJ-NPR-Z0-9]{17}$/.test(value);

/** Builds an 11-digit RENAVAM from a 10-digit numeric base. */
export const renavamFromBase = (base: string): string => {
  if (!/^\d{10}$/.test(base)) {
    throw new Error('RENAVAM base must contain exactly 10 digits');
  }
  const w = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(base[i]) * w[i];
  const r = (sum * 10) % 11;
  return base + (r === 10 ? 0 : r);
};

/** Returns whether a value is an 11-digit RENAVAM with a valid check digit. */
export const isValidRenavam = (value: string): boolean =>
  /^\d{11}$/.test(value) && renavamFromBase(value.slice(0, 10)) === value;

/** 11-digit RENAVAM (last digit a mod-11 check). */
export const renavam = (rng: Rng): string => renavamFromBase(rng.digits(10));

/** Deterministic ISO date-time between two years. */
export const dateTime = (
  rng: Rng,
  yearMin: number,
  yearMax: number,
): string => {
  const y = rng.int(yearMin, yearMax);
  const m = String(rng.int(1, 12)).padStart(2, '0');
  const d = String(rng.int(1, 28)).padStart(2, '0');
  const hh = String(rng.int(0, 23)).padStart(2, '0');
  const mm = String(rng.int(0, 59)).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:00.000Z`;
};

/** Deterministic ISO date (no time). */
export const dateOnly = (rng: Rng, yearMin: number, yearMax: number): string =>
  dateTime(rng, yearMin, yearMax).slice(0, 10);
