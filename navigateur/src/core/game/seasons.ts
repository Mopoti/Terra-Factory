/**
 * Jour / nuit et saisons. Le temps de jeu (secondes, enregistré avec la partie) fait tourner les jours et les nuits ;
 * les saisons se répartissent sur une année dont la longueur et le partage entre saisons sont des réglages de la partie.
 * Les effets (teinte du sol, ciel, absorption de la pollution par les arbres) passent **progressivement** d'une saison
 * à la suivante : on interpole entre les « centres » de saison au lieu de changer d'un coup.
 */

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_IDS: readonly SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];

export interface Season {
  id: SeasonId;
  /** Multiplicateur de couleur du sol (r, g, b). */
  ground: [number, number, number];
  /** Voile clair ajouté au sol (neige). */
  snow: [number, number, number];
  /** Couleur du ciel de jour (hexadécimal). */
  sky: number;
  /** Part de l'absorption normale des arbres. */
  treeAbsorb: number;
}

export const SEASONS: Season[] = [
  { id: 'spring', ground: [0.95, 1.08, 0.95], snow: [0, 0, 0], sky: 0x9cc7e2, treeAbsorb: 1 },
  { id: 'summer', ground: [1, 1, 1], snow: [0, 0, 0], sky: 0x8fb8d8, treeAbsorb: 1.2 },
  { id: 'autumn', ground: [1.25, 0.95, 0.7], snow: [0, 0, 0], sky: 0xb7b3a6, treeAbsorb: 0.7 },
  {
    id: 'winter',
    ground: [0.6, 0.64, 0.7],
    snow: [0.5, 0.52, 0.56],
    sky: 0xc8d3dc,
    treeAbsorb: 0.35,
  },
];

/** Réglages du temps d'une partie (indépendants les uns des autres). */
export interface TimeSettings {
  /** Durée d'un jour (minutes de jeu). */
  dayMinutes: number;
  /** Durée d'une nuit (minutes de jeu). */
  nightMinutes: number;
  /** Durée moyenne d'une saison (jours) : l'année dure 4 fois cette durée. */
  seasonDays: number;
  /** Part de l'année de chaque saison (printemps, été, automne, hiver), en pourcentage, somme 100. */
  shares: [number, number, number, number];
}

export const DEFAULT_TIME: TimeSettings = {
  dayMinutes: 10,
  nightMinutes: 8,
  seasonDays: 10,
  shares: [25, 25, 25, 25],
};

export const MIN_SHARE = 5;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

/** Lit des réglages enregistrés : bornes, parts d'au moins 5 % et somme exactement 100. */
export function normalizeTime(raw: unknown): TimeSettings {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TIME;
  const given = Array.isArray(o.shares) ? o.shares.slice(0, 4).map((v) => num(v, 25)) : d.shares;
  while (given.length < 4) given.push(25);
  // Chaque saison garde au moins MIN_SHARE % ; le reste se répartit selon ce qui dépasse ce minimum.
  const extra = given.map((v) => Math.max(0, v - MIN_SHARE));
  const extraSum = extra.reduce((x, y) => x + y, 0);
  const spare = 100 - MIN_SHARE * 4;
  const shares = extra.map((e) => MIN_SHARE + (extraSum > 0 ? (e / extraSum) * spare : spare / 4));
  // Parts entières (la dernière complète à 100).
  const whole = shares.map((v) => Math.round(v));
  whole[3] = 100 - whole[0] - whole[1] - whole[2];
  return {
    dayMinutes: clamp(Math.round(num(o.dayMinutes, d.dayMinutes)), 1, 120),
    nightMinutes: clamp(Math.round(num(o.nightMinutes, d.nightMinutes)), 1, 120),
    seasonDays: clamp(Math.round(num(o.seasonDays, d.seasonDays)), 1, 100),
    shares: whole as [number, number, number, number],
  };
}

/** Secondes d'un jour + une nuit. */
export const cycleSeconds = (c: TimeSettings): number => (c.dayMinutes + c.nightMinutes) * 60;
/** Secondes d'une année. */
export const yearSeconds = (c: TimeSettings): number => cycleSeconds(c) * c.seasonDays * 4;

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
const lerp3 = (a: number[], b: number[], f: number): [number, number, number] => [
  lerp(a[0], b[0], f),
  lerp(a[1], b[1], f),
  lerp(a[2], b[2], f),
];
function lerpColor(a: number, b: number, f: number): number {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, f);
  const g = lerp((a >> 8) & 255, (b >> 8) & 255, f);
  const bl = lerp(a & 255, b & 255, f);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
const smooth = (f: number): number => f * f * (3 - 2 * f);

export interface Climate {
  /** Saison en cours (celle dont on est le plus proche). */
  season: Season;
  /** Jour de la saison (à partir de 1) et année (à partir de 1). */
  day: number;
  year: number;
  /** Valeurs interpolées entre les saisons (changement progressif). */
  ground: [number, number, number];
  snow: [number, number, number];
  sky: number;
  treeAbsorb: number;
}

/** Saison, jour, année et ambiance interpolée au temps `time` (s). */
export function climateAt(time: number, cfg: TimeSettings = DEFAULT_TIME): Climate {
  const year = yearSeconds(cfg);
  const t = Math.max(0, time);
  const yearIndex = Math.floor(t / year);
  const y = (t % year) / year; // 0..1 dans l'année
  // Début et fin de chaque saison (fractions de l'année).
  const starts: number[] = [];
  let acc = 0;
  for (const s of cfg.shares) {
    starts.push(acc);
    acc += s / 100;
  }
  let i = starts.findIndex((s, k) => y >= s && y < s + cfg.shares[k] / 100);
  if (i < 0) i = 3;
  const centers = starts.map((s, k) => s + cfg.shares[k] / 200);
  // Segment entre le centre de la saison précédente / suivante et le centre de la saison actuelle.
  let a: number;
  let b: number;
  let f: number;
  if (y >= centers[i]) {
    a = i;
    b = (i + 1) % 4;
    const end = b === 0 ? centers[0] + 1 : centers[b];
    f = (y - centers[i]) / (end - centers[i]);
  } else {
    a = (i + 3) % 4;
    b = i;
    const begin = a === 3 ? centers[3] - 1 : centers[a];
    f = (y - begin) / (centers[i] - begin);
  }
  f = smooth(clamp(f, 0, 1));
  const A = SEASONS[a];
  const B = SEASONS[b];
  const cycle = cycleSeconds(cfg);
  const day = Math.floor(((y - starts[i]) * year) / cycle) + 1;
  return {
    season: SEASONS[i],
    day,
    year: yearIndex + 1,
    ground: lerp3(A.ground, B.ground, f),
    snow: lerp3(A.snow, B.snow, f),
    sky: lerpColor(A.sky, B.sky, f),
    treeAbsorb: lerp(A.treeAbsorb, B.treeAbsorb, f),
  };
}

/** Ancienne signature : saison, jour et année (réglages par défaut). */
export function seasonAt(
  time: number,
  cfg: TimeSettings = DEFAULT_TIME,
): { season: Season; day: number; year: number } {
  const c = climateAt(time, cfg);
  return { season: c.season, day: c.day, year: c.year };
}

/** Moment de la journée : jour ou nuit, et luminosité du ciel (0 nuit noire, 1 plein jour) avec aube et crépuscule. */
export function dayLight(
  time: number,
  cfg: TimeSettings = DEFAULT_TIME,
): { isDay: boolean; light: number; minutes: number } {
  // La partie commence en plein jour, juste après l'aube.
  const dawn = Math.min(1, cfg.dayMinutes * 0.1);
  const into = (Math.max(0, time) / 60 + dawn) % (cfg.dayMinutes + cfg.nightMinutes);
  const isDay = into < cfg.dayMinutes;
  // Aube et crépuscule : 10 % du jour (au plus 1 minute) de transition de chaque côté.
  const twilight = dawn;
  const night = 0.12;
  let light: number;
  if (isDay) {
    const up = clamp(into / twilight, 0, 1);
    const down = clamp((cfg.dayMinutes - into) / twilight, 0, 1);
    light = lerp(night, 1, smooth(Math.min(up, down)));
  } else light = night;
  return { isDay, light, minutes: into };
}
