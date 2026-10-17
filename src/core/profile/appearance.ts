/**
 * Apparence du personnage choisie par le joueur (voir `docs/personnage.md`) : silhouette, morphologie, visage,
 * cheveux et couleurs. Ce fichier ne dépend ni du rendu ni du navigateur : réglages, bornes, valeurs aléatoires et
 * forme courte envoyée aux autres joueurs.
 */

export type Silhouette = 'homme' | 'femme';
export const SILHOUETTES: readonly Silhouette[] = ['homme', 'femme'];

/** Réglages de la morphologie, de −1 à +1 (0 = le modèle de base). */
export const BODY_KEYS = ['height', 'build', 'bulk', 'legs', 'bust'] as const;
export type BodyKey = (typeof BODY_KEYS)[number];

/** Réglages du visage, de −1 à +1 : appliqués par les formes de déformation du modèle quand il en a. */
export const FACE_KEYS = [
  'noseSize',
  'noseWidth',
  'noseHeight',
  'mouthWidth',
  'lips',
  'mouthHeight',
  'eyeShape',
  'eyeSpacing',
] as const;
export type FaceKey = (typeof FACE_KEYS)[number];

/** Coupes de cheveux (pièces `<modèle>_coupe_<nom>` du fichier, `blender/scripts/personnage.py`) ; `none` = chauve. */
export const HAIR_STYLES = [
  'courte',
  'rase',
  'brosse',
  'iroquoise',
  'mi_longue',
  'longue',
  'carre',
  'queue',
  'chignon',
  'afro',
  'none',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
/** Coupe par défaut de chaque silhouette. */
export const DEFAULT_HAIR: Record<Silhouette, HairStyle> = { homme: 'courte', femme: 'queue' };

export const COLOR_KEYS = ['suit', 'stripe', 'skin', 'hair', 'eyes'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export interface Appearance {
  silhouette: Silhouette;
  body: Record<BodyKey, number>;
  face: Record<FaceKey, number>;
  hairStyle: HairStyle;
  colors: Record<ColorKey, string>;
}

export const DEFAULT_COLORS: Record<ColorKey, string> = {
  suit: '#d9822b',
  stripe: '#f0c24a',
  skin: '#e0b38a',
  hair: '#4a3020',
  eyes: '#3f7a4f',
};

/** Teintes proposées d'un clic (on peut aussi choisir n'importe quelle couleur). */
export const PALETTES: Record<ColorKey, readonly string[]> = {
  suit: ['#d9822b', '#c0392b', '#2f6fb0', '#3f8f5a', '#7b4fa8', '#e0b83a', '#2b2f36', '#d8dde3'],
  stripe: ['#f0c24a', '#f2f2ee', '#2b2f36', '#d9822b', '#4fa8d9', '#7bc96f', '#c0392b', '#b57edc'],
  skin: ['#f6d9c0', '#e8c29e', '#e0b38a', '#c68e62', '#a56b43', '#7d4e30', '#5b3822', '#3d2517'],
  hair: ['#1c1410', '#4a3020', '#7a4a28', '#b9822f', '#e0c068', '#c0c0c0', '#b0402a', '#6a4aa8'],
  eyes: ['#3f7a4f', '#2f5f8f', '#6b4a2a', '#4a3a28', '#7a8a94', '#8a6a2a', '#5a3a7a', '#1c1c1c'],
};

export function defaultAppearance(silhouette: Silhouette = 'homme'): Appearance {
  return {
    silhouette,
    body: { height: 0, build: 0, bulk: 0, legs: 0, bust: 0 },
    face: {
      noseSize: 0,
      noseWidth: 0,
      noseHeight: 0,
      mouthWidth: 0,
      lips: 0,
      mouthHeight: 0,
      eyeShape: 0,
      eyeSpacing: 0,
    },
    hairStyle: DEFAULT_HAIR[silhouette],
    colors: { ...DEFAULT_COLORS },
  };
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const slider = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(clamp(v, -1, 1) * 100) / 100 : 0;
export const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Apparence valide à partir de n'importe quoi (profil ancien, abîmé, reçu du réseau) : le reste prend la valeur par défaut. */
export function normalizeAppearance(raw: unknown): Appearance {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const silhouette = SILHOUETTES.find((s) => s === r.silhouette) ?? 'homme';
  const out = defaultAppearance(silhouette);
  const body = (typeof r.body === 'object' && r.body !== null ? r.body : {}) as Record<
    string,
    unknown
  >;
  const face = (typeof r.face === 'object' && r.face !== null ? r.face : {}) as Record<
    string,
    unknown
  >;
  const colors = (typeof r.colors === 'object' && r.colors !== null ? r.colors : {}) as Record<
    string,
    unknown
  >;
  for (const k of BODY_KEYS) out.body[k] = slider(body[k]);
  for (const k of FACE_KEYS) out.face[k] = slider(face[k]);
  // Coupe inconnue (ou « model », l'ancienne coupe unique) : celle de la silhouette.
  out.hairStyle = HAIR_STYLES.find((h) => h === r.hairStyle) ?? DEFAULT_HAIR[silhouette];
  for (const k of COLOR_KEYS) {
    const c = colors[k];
    out.colors[k] = isHexColor(c) ? c.toLowerCase() : DEFAULT_COLORS[k];
  }
  return out;
}

/** Apparence au hasard (`random` renvoie un nombre dans [0, 1[ : le hasard est permis ici, c'est de l'interface). */
export function randomAppearance(random: () => number = Math.random): Appearance {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];
  const a = defaultAppearance(pick(SILHOUETTES));
  for (const k of BODY_KEYS) a.body[k] = Math.round((random() * 1.6 - 0.8) * 100) / 100;
  for (const k of FACE_KEYS) a.face[k] = Math.round((random() * 1.6 - 0.8) * 100) / 100;
  a.hairStyle = pick(HAIR_STYLES);
  for (const k of COLOR_KEYS) a.colors[k] = pick(PALETTES[k]);
  return a;
}

// --- Forme courte (réseau) ---------------------------------------------------------------------------

/** « h|0,0,0,0,0|0,0,0,0,0,0,0,0|courte|d9822b,f0c24a,e0b38a,4a3020,3f7a4f » : environ 100 caractères. */
export function encodeLook(a: Appearance): string {
  const n = (v: number): string => String(Math.round(v * 100));
  return [
    a.silhouette === 'homme' ? 'h' : 'f',
    BODY_KEYS.map((k) => n(a.body[k])).join(','),
    FACE_KEYS.map((k) => n(a.face[k])).join(','),
    a.hairStyle,
    COLOR_KEYS.map((k) => a.colors[k].slice(1)).join(','),
  ].join('|');
}

/** Relit une apparence envoyée par un autre joueur ; renvoie null si le texte n'en est pas une. */
export function decodeLook(text: unknown): Appearance | null {
  if (typeof text !== 'string' || text.length > 300) return null;
  const parts = text.split('|');
  if (parts.length !== 5) return null;
  const nums = (s: string, count: number): number[] | null => {
    const v = s.split(',').map((x) => Number(x) / 100);
    return v.length === count && v.every(Number.isFinite) ? v : null;
  };
  const body = nums(parts[1], BODY_KEYS.length);
  const face = nums(parts[2], FACE_KEYS.length);
  const colors = parts[4].split(',');
  if (!body || !face || colors.length !== COLOR_KEYS.length) return null;
  return normalizeAppearance({
    silhouette: parts[0] === 'f' ? 'femme' : 'homme',
    body: Object.fromEntries(BODY_KEYS.map((k, i) => [k, body[i]])),
    face: Object.fromEntries(FACE_KEYS.map((k, i) => [k, face[i]])),
    // « n » et « m » : ancienne forme (chauve, coupe du modèle).
    hairStyle: parts[3] === 'n' ? 'none' : parts[3],
    colors: Object.fromEntries(COLOR_KEYS.map((k, i) => [k, `#${colors[i]}`])),
  });
}

// --- Du réglage à la forme du corps -------------------------------------------------------------------

/** Échelles du corps déduites des curseurs (voir `Avatar.look`). */
export interface BodyScales {
  /** Taille de tout le personnage. */
  size: number;
  /** Largeur du bassin et du ventre (x, z). */
  hips: number;
  /** Largeur supplémentaire de la poitrine et des épaules (x). */
  shoulders: number;
  /** Épaisseur de la poitrine (z). */
  chest: number;
  /** Longueur des jambes. */
  legs: number;
  /** Épaisseur des cuisses. */
  thighs: number;
}

export function bodyScales(body: Record<BodyKey, number>, silhouette: Silhouette): BodyScales {
  return {
    size: 1 + 0.1 * body.height,
    hips: 1 + 0.14 * body.bulk,
    shoulders: 1 + 0.14 * body.build,
    chest: 1 + 0.1 * body.bulk + (silhouette === 'femme' ? 0.14 : 0.07) * body.bust,
    legs: 1 + 0.1 * body.legs,
    thighs: 1 + 0.07 * body.bulk,
  };
}
