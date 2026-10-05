import { hash01 } from './rng';

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Bruit de valeur 2D lisse, dans [0, 1]. Coordonnées en « unités de bruit » (1 = une maille). */
export function valueNoise(seed: number, x: number, y: number, salt: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const sx = smooth(x - xi);
  const sy = smooth(y - yi);
  const a = hash01(seed, xi, yi, salt);
  const b = hash01(seed, xi + 1, yi, salt);
  const c = hash01(seed, xi, yi + 1, salt);
  const d = hash01(seed, xi + 1, yi + 1, salt);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/** Somme de plusieurs bruits de plus en plus fins, ramenée dans [0, 1]. */
export function fbm(seed: number, x: number, y: number, salt: number, octaves = 3): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(seed, x * frequency, y * frequency, salt + i * 101);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
export const smoothstep = (edge0: number, edge1: number, x: number): number =>
  smooth(clamp((x - edge0) / (edge1 - edge0), 0, 1));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
