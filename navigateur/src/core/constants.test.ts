import { describe, expect, it } from 'vitest';
import { CELL_SIZE_M, FINE_PER_CELL, TICK_SECONDS, fineToMeters } from './constants';

describe('constantes', () => {
  it('une case fait 50 cm', () => {
    expect(CELL_SIZE_M).toBeCloseTo(0.5);
    expect(FINE_PER_CELL).toBe(5);
  });
  it('un tick dure 0,05 s', () => {
    expect(TICK_SECONDS).toBeCloseTo(0.05);
  });
  it('convertit les pas fins en mètres', () => {
    expect(fineToMeters(15)).toBeCloseTo(1.5);
  });
});
