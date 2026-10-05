/** Conversions d'affichage. Le jeu calcule toujours en unités SI ; on ne convertit qu'à l'affichage. */

export type DistanceUnit = 'm' | 'ft';
export type TemperatureUnit = 'C' | 'F' | 'K';
export type MassUnit = 'kg' | 'lb';
export type PressureUnit = 'Pa' | 'bar' | 'psi';
export type EnergyUnit = 'SI' | 'kWh';

export interface UnitPrefs {
  distance: DistanceUnit;
  temperature: TemperatureUnit;
  mass: MassUnit;
  pressure: PressureUnit;
  energy: EnergyUnit;
}

const FEET_PER_METER = 3.280839895;
const POUNDS_PER_KG = 2.2046226218;
const PA_PER_BAR = 100_000;
const PA_PER_PSI = 6894.757293168;
const J_PER_KWH = 3_600_000;

export function convertDistance(meters: number, unit: DistanceUnit): number {
  return unit === 'ft' ? meters * FEET_PER_METER : meters;
}
export function convertTemperature(celsius: number, unit: TemperatureUnit): number {
  if (unit === 'F') return celsius * 1.8 + 32;
  if (unit === 'K') return celsius + 273.15;
  return celsius;
}
export function convertMass(kg: number, unit: MassUnit): number {
  return unit === 'lb' ? kg * POUNDS_PER_KG : kg;
}
export function convertPressure(pascals: number, unit: PressureUnit): number {
  if (unit === 'bar') return pascals / PA_PER_BAR;
  if (unit === 'psi') return pascals / PA_PER_PSI;
  return pascals;
}

function num(value: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}

export function formatDistance(meters: number, u: UnitPrefs, locale: string): string {
  return `${num(convertDistance(meters, u.distance), locale)} ${u.distance}`;
}
export function formatTemperature(celsius: number, u: UnitPrefs, locale: string): string {
  const symbol = u.temperature === 'K' ? 'K' : `°${u.temperature}`;
  return `${num(convertTemperature(celsius, u.temperature), locale, 1)} ${symbol}`;
}
export function formatMass(kg: number, u: UnitPrefs, locale: string): string {
  return `${num(convertMass(kg, u.mass), locale)} ${u.mass}`;
}
export function formatPressure(pascals: number, u: UnitPrefs, locale: string): string {
  return `${num(convertPressure(pascals, u.pressure), locale, 3)} ${u.pressure}`;
}
export function formatEnergy(joules: number, u: UnitPrefs, locale: string): string {
  return u.energy === 'kWh'
    ? `${num(joules / J_PER_KWH, locale, 3)} kWh`
    : `${num(joules, locale, 0)} J`;
}
export function formatPower(watts: number, u: UnitPrefs, locale: string): string {
  return u.energy === 'kWh' ? `${num(watts / 1000, locale, 3)} kW` : `${num(watts, locale, 0)} W`;
}
