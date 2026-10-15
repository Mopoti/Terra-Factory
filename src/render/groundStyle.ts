/**
 * Sol low poly des biomes : chaque case est coupée en deux triangles (diagonale tirée au hasard) qui ont chacun leur
 * couleur et une normale légèrement penchée, pour des facettes visibles sans relief réel (le sol reste plat sous les
 * machines). Chaque biome a sa palette et ses motifs :
 * - prairie : herbe aux verts mêlés, taches plus claires et plus sèches ;
 * - forêt : mousse sombre, plaques d'humus et de feuilles mortes ;
 * - désert : sable en rides (bandes claires et sombres), plaques de roche rouille ;
 * - toundra : neige aux reflets bleutés, plaques de gravier gris et de glace.
 */
import type { BiomeId } from '../core/world/biomes';
import { valueNoise } from '../core/world/noise';
import { hash01 } from '../core/world/rng';
import { hexToRgb, type Rgb } from './meshBuilder';

interface Palette {
  /** Teintes de base, mêlées au hasard d'un triangle à l'autre. */
  base: string[];
  /** Grandes taches (bruit à grande échelle) : couleur et part du sol couverte (0 à 1). */
  patches: { color: string; cover: number; scaleM: number }[];
  /** Petits détails isolés (un triangle) : couleur et probabilité. */
  specks?: { color: string; chance: number }[];
  /** Rides parallèles (désert) : couleurs claire et sombre, période (m). */
  ripples?: { light: string; dark: string; periodM: number };
}

const PALETTES: Record<BiomeId, Palette> = {
  prairie: {
    base: ['#5c8f3d', '#64983f', '#578a3a', '#6b9d45'],
    patches: [
      { color: '#7eaa4c', cover: 0.22, scaleM: 5 },
      { color: '#94a957', cover: 0.08, scaleM: 9 },
    ],
    // Pas de « fleurs » au sol : à 50 cm le triangle, elles feraient des taches ; les fleurs sont dans les buissons.
    specks: [
      { color: '#4f8034', chance: 0.05 },
      { color: '#6f9a40', chance: 0.04 },
    ],
  },
  forest: {
    base: ['#3c6b34', '#376330', '#41723a', '#33592e'],
    patches: [
      { color: '#5b4a34', cover: 0.18, scaleM: 4 },
      { color: '#4c6a2c', cover: 0.2, scaleM: 6 },
    ],
    specks: [
      { color: '#7a5a36', chance: 0.04 },
      { color: '#2b4a28', chance: 0.05 },
    ],
  },
  desert: {
    base: ['#cfb76f', '#d4bd76', '#c9b068'],
    patches: [{ color: '#b98f5c', cover: 0.07, scaleM: 7 }],
    specks: [{ color: '#a8885a', chance: 0.02 }],
    ripples: { light: '#ddc887', dark: '#bea35f', periodM: 1.6 },
  },
  tundra: {
    base: ['#d7dfe5', '#dfe6ec', '#cfd8e0'],
    patches: [
      { color: '#c2cedb', cover: 0.22, scaleM: 4 },
      { color: '#9aa3a9', cover: 0.07, scaleM: 6 },
      { color: '#e8f0f5', cover: 0.12, scaleM: 8 },
    ],
    specks: [{ color: '#8f989e', chance: 0.015 }],
  },
};

const RGB = new Map<string, Rgb>();
const rgb = (hex: string): Rgb => {
  let c = RGB.get(hex);
  if (!c) RGB.set(hex, (c = hexToRgb(hex)));
  return c;
};
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/** Diagonale de la case : vrai = de (0,0) à (1,1), faux = de (1,0) à (0,1). */
export const cellDiagonal = (seed: number, gx: number, gz: number): boolean =>
  hash01(seed, gx, gz, 4101) < 0.5;

/**
 * Couleur d'un triangle du sol. `xM`, `zM` = son centre (m) ; `gx`, `gz` = sa case ; `half` = 0 ou 1 (lequel des deux
 * triangles de la case).
 */
export function groundColor(
  biome: BiomeId,
  seed: number,
  xM: number,
  zM: number,
  gx: number,
  gz: number,
  half: number,
): Rgb {
  const p = PALETTES[biome];
  const h = (salt: number): number => hash01(seed, gx * 2 + half, gz, salt);
  let c = rgb(p.base[Math.floor(h(4102) * p.base.length)]);
  if (p.ripples) {
    // Rides : bandes ondulées, perpendiculaires au vent dominant, déformées par un bruit lent.
    const u =
      (xM * 0.8 + zM * 0.6) / p.ripples.periodM + 1.5 * valueNoise(seed, xM / 6, zM / 6, 4103);
    const w = Math.sin(u * Math.PI * 2);
    if (w > 0.45) c = mixRgb(c, rgb(p.ripples.light), 0.7);
    else if (w < -0.55) c = mixRgb(c, rgb(p.ripples.dark), 0.6);
  }
  p.patches.forEach((patch, i) => {
    const n = valueNoise(seed, xM / patch.scaleM, zM / patch.scaleM, 4110 + i);
    // Un léger « grain » au bord de la tache : les triangles y passent d'une couleur à l'autre en damier irrégulier.
    if (n > 1 - patch.cover + (h(4120 + i) - 0.5) * 0.08) c = mixRgb(c, rgb(patch.color), 0.85);
  });
  for (const [i, s] of (p.specks ?? []).entries())
    if (h(4130 + i) < s.chance) {
      c = rgb(s.color);
      break;
    }
  // Petite variation de clarté propre au triangle.
  const f = 0.95 + 0.1 * h(4140);
  return { r: Math.min(1, c.r * f), g: Math.min(1, c.g * f), b: Math.min(1, c.b * f) };
}

/** Normale légèrement penchée d'un triangle (facettes visibles à la lumière, sans relief réel). */
export function groundNormal(
  seed: number,
  gx: number,
  gz: number,
  half: number,
): [number, number, number] {
  const tx = (hash01(seed, gx * 2 + half, gz, 4150) - 0.5) * 0.22;
  const tz = (hash01(seed, gx * 2 + half, gz, 4151) - 0.5) * 0.22;
  const l = Math.hypot(tx, 1, tz);
  return [tx / l, 1 / l, tz / l];
}
