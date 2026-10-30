/**
 * Météo du monde : température locale et vent. Fonctions pures du temps de jeu et de la seed (même seed + même temps =
 * même résultat, donc identiques chez tous les joueurs d'une partie).
 */
import { climateAt as biomeClimateAt } from '../world/biomes';
import { climateAt as seasonClimateAt, dayLight, DEFAULT_TIME, type TimeSettings } from './seasons';

/** Température (°C) du biome à `warmth` 0 (glacial) et 1 (brûlant), avant saison et heure. */
const BIOME_COLD_C = -5;
const BIOME_HOT_C = 30;
/** Écart de la saison (été : +, hiver : −) autour de la mi-saison, en °C pour une chaleur de 0 / 1. */
const SEASON_SWING_C = 20;
/** Refroidissement de la nuit noire, en °C. */
const NIGHT_DROP_C = 8;

/** Température de l'air (°C) en (xM, zM) au temps de jeu `time` (s). */
export function temperatureAt(
  seed: number,
  xM: number,
  zM: number,
  time: number,
  cfg: TimeSettings = DEFAULT_TIME,
): number {
  const base =
    BIOME_COLD_C + (BIOME_HOT_C - BIOME_COLD_C) * biomeClimateAt(seed, xM, zM).temperature;
  const season = (seasonClimateAt(time, cfg).warmth - 0.5) * SEASON_SWING_C;
  const night = (1 - dayLight(time, cfg).light) * NIGHT_DROP_C;
  return base + season - night;
}

/** Vent : `dir` est la direction VERS laquelle il souffle (radians, 0 = +x, π/2 = +z) ; `speed` va de 0 (calme) à 1 (tempête). */
export interface Wind {
  dir: number;
  speed: number;
}

/** Phase pseudo-aléatoire stable pour une seed et un numéro de composante. */
function phase(seed: number, k: number): number {
  const v = Math.sin((seed % 100003) * 12.9898 + k * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * Math.PI * 2;
}

/**
 * Vent au temps de jeu `time` (s). La direction dérive lentement (plusieurs minutes pour tourner de quelques dizaines
 * de degrés) ; la force alterne calmes et rafales (périodes de quelques secondes à quelques minutes).
 */
export function windAt(seed: number, time: number): Wind {
  const t = Math.max(0, time);
  const dir =
    phase(seed, 0) +
    1.1 * Math.sin(t / 310 + phase(seed, 1)) +
    0.45 * Math.sin(t / 97 + phase(seed, 2)) +
    0.12 * Math.sin(t / 19 + phase(seed, 3));
  const slow = Math.sin(t / 420 + phase(seed, 4));
  const gust = Math.sin(t / 61 + phase(seed, 5)) * 0.6 + Math.sin(t / 17 + phase(seed, 6)) * 0.4;
  const raw = 0.5 + 0.32 * slow + 0.18 * gust;
  return { dir, speed: Math.min(1, Math.max(0, raw)) };
}

/** Points de chaleur (vêtements et armure) portés : voir `warmth` des pièces d'équipement. */
export const COMFORT_BASE_C = 6;
/** Chaque point de chaleur abaisse de ce nombre de °C la température à partir de laquelle on a froid. */
export const COMFORT_PER_WARMTH_C = 1;
/** Dégâts par seconde et par °C sous le seuil de confort. */
export const COLD_DAMAGE_PER_C = 0.05;
/** Sous ce seuil de dégâts (PV/s), le froid est léger : la santé continue de remonter. */
export const COLD_HURT_PER_S = 0.15;

/** Température (°C) en dessous de laquelle le joueur souffre du froid, selon la chaleur de son équipement. */
export function comfortLimitC(warmth: number): number {
  return COMFORT_BASE_C - warmth * COMFORT_PER_WARMTH_C;
}

/** Dégâts par seconde que subit un joueur de chaleur `warmth` à la température `tempC`. */
export function coldDamagePerS(tempC: number, warmth: number): number {
  return Math.max(0, comfortLimitC(warmth) - tempC) * COLD_DAMAGE_PER_C;
}

const POINTS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
/** Point cardinal (n, ne, e…) vers lequel souffle un vent de direction `dir` (le nord est −z, l'est +x). */
export function compassOf(dir: number): (typeof POINTS)[number] {
  const bearing = 90 + (dir * 180) / Math.PI;
  return POINTS[((Math.round(bearing / 45) % 8) + 8) % 8];
}

/** Valeurs imposées par les commandes du chat (absent = le calcul normal). */
export interface WeatherOverrides {
  /** Température de l'air (°C) partout. */
  tempC?: number;
  /** Force du vent (0 à 1). */
  windSpeed?: number;
  /** Direction du vent (radians). */
  windDir?: number;
}

/** Vent du jeu : le calcul normal, sauf ce que les commandes imposent. */
export function windWith(seed: number, time: number, o?: WeatherOverrides): Wind {
  const w = windAt(seed, time);
  return { dir: o?.windDir ?? w.dir, speed: o?.windSpeed ?? w.speed };
}

/** Température de l'air (°C) du jeu : le calcul normal, sauf ce que les commandes imposent. */
export function airTempWith(computed: number, o?: WeatherOverrides): number {
  return o?.tempC ?? computed;
}

/** Température visée à l'intérieur d'un abri clos (°C) et part de l'écart avec l'extérieur qu'il compense. */
export const SHELTER_TARGET_C = 14;
export const SHELTER_FACTOR = 0.5;

/** Température dans une pièce close, pour une température extérieure donnée : l'abri adoucit les extrêmes. */
export function shelterTempC(outsideC: number): number {
  return outsideC + (SHELTER_TARGET_C - outsideC) * SHELTER_FACTOR;
}
