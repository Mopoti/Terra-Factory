import { clamp, fbm, lerp, smoothstep } from './noise';
import { saltOf } from './rng';

export type BiomeId = 'prairie' | 'forest' | 'desert' | 'tundra';
export const BIOME_IDS: readonly BiomeId[] = ['prairie', 'forest', 'desert', 'tundra'];

/** Couleur du sol de chaque biome (affichage 3D et carte d'aperçu). */
export const BIOME_COLORS: Record<BiomeId, string> = {
  prairie: '#5f9140',
  forest: '#3e6e35',
  desert: '#cdb56d',
  tundra: '#d5dde3',
};

/** Taille des grandes zones de climat, en mètres. */
const CLIMATE_WAVELENGTH_M = 500;
/** Autour du point de départ, le climat est ramené à « prairie » (zone de départ garantie). */
const START_BIAS_FULL_M = 150;
const START_BIAS_NONE_M = 350;

const TEMPERATURE_SALT = saltOf('climate.temperature');
const HUMIDITY_SALT = saltOf('climate.humidity');

export interface Climate {
  /** 0 = glacial, 1 = brûlant. */
  temperature: number;
  /** 0 = sec, 1 = détrempé. */
  humidity: number;
}

function contrast(v: number): number {
  return clamp(0.5 + (v - 0.5) * 2, 0, 1);
}

export function climateAt(seed: number, xM: number, zM: number): Climate {
  const x = xM / CLIMATE_WAVELENGTH_M;
  const z = zM / CLIMATE_WAVELENGTH_M;
  let temperature = contrast(fbm(seed, x, z, TEMPERATURE_SALT, 3));
  let humidity = contrast(fbm(seed, x, z, HUMIDITY_SALT, 3));
  const bias = 1 - smoothstep(START_BIAS_FULL_M, START_BIAS_NONE_M, Math.hypot(xM, zM));
  temperature = lerp(temperature, 0.5, bias);
  humidity = lerp(humidity, 0.5, bias);
  return { temperature, humidity };
}

export function biomeFromClimate(c: Climate): BiomeId {
  if (c.temperature < 0.3) return 'tundra';
  if (c.temperature > 0.62 && c.humidity < 0.45) return 'desert';
  if (c.humidity > 0.58) return 'forest';
  return 'prairie';
}

export function biomeAt(seed: number, xM: number, zM: number): BiomeId {
  return biomeFromClimate(climateAt(seed, xM, zM));
}
