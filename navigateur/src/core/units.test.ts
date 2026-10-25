import { describe, expect, it } from 'vitest';
import {
  convertDistance,
  convertMass,
  convertPressure,
  convertTemperature,
  formatEnergy,
  formatPower,
  type UnitPrefs,
} from './units';

const metric: UnitPrefs = {
  distance: 'm',
  temperature: 'C',
  mass: 'kg',
  pressure: 'Pa',
  energy: 'SI',
};

describe('conversions', () => {
  it('distance', () => {
    expect(convertDistance(1, 'ft')).toBeCloseTo(3.2808, 3);
    expect(convertDistance(5, 'm')).toBe(5);
  });
  it('température', () => {
    expect(convertTemperature(0, 'F')).toBeCloseTo(32);
    expect(convertTemperature(100, 'F')).toBeCloseTo(212);
    expect(convertTemperature(0, 'K')).toBeCloseTo(273.15);
  });
  it('masse', () => {
    expect(convertMass(1, 'lb')).toBeCloseTo(2.2046, 3);
  });
  it('pression', () => {
    expect(convertPressure(101325, 'bar')).toBeCloseTo(1.01325, 5);
    expect(convertPressure(101325, 'psi')).toBeCloseTo(14.696, 2);
  });
  it('énergie et puissance', () => {
    expect(formatEnergy(3_600_000, { ...metric, energy: 'kWh' }, 'en')).toBe('1 kWh');
    expect(formatEnergy(1500, metric, 'en')).toBe('1,500 J');
    expect(formatPower(2500, { ...metric, energy: 'kWh' }, 'en')).toBe('2.5 kW');
  });
});
