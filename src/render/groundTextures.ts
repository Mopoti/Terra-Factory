/**
 * Textures du sol dessinées par le code (aucun fichier) : l'eau, qui coule doucement, et un atlas de gisements
 * (une vignette par ressource : grains de sable, éclats de charbon, paillettes de minerai…). Sans navigateur
 * (tests), les textures sont absentes et les matériaux gardent leur couleur unie.
 */
import * as THREE from 'three';

/** Ressources représentées dans l'atlas, dans l'ordre des vignettes (4 par ligne). */
export const ORE_TILES = [
  'iron_ore',
  'copper_ore',
  'coal',
  'zinc_ore',
  'bauxite',
  'sand',
  'oil',
  'uraninite',
  'stone_ore',
] as const;
const COLUMNS = 4;
const ROWS = 3;
const TILE_PX = 128;

/** Taille (m) que couvre la texture de l'eau avant de se répéter. */
export const WATER_TILE_M = 3;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
const mix = (a: number, b: number, t: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

interface TileStyle {
  base: number;
  /** Éclats : nombre, rayon min/max (px), teintes. */
  chunks: { n: number; min: number; max: number; colors: number[] };
  /** Points brillants ou sombres de quelques pixels. */
  flecks?: { n: number; colors: number[]; size: number };
}

const STYLES: Record<(typeof ORE_TILES)[number], TileStyle> = {
  iron_ore: {
    base: 0x8d6e63,
    chunks: { n: 70, min: 5, max: 13, colors: [0x6d4c41, 0xa1887f, 0x5d4037, 0xb0786a] },
    flecks: { n: 90, colors: [0xc0492c, 0x3e2723], size: 2 },
  },
  copper_ore: {
    base: 0xd2793b,
    chunks: { n: 60, min: 5, max: 12, colors: [0xb85f26, 0xe8955a, 0x9c4a1c] },
    flecks: { n: 70, colors: [0x3fa389, 0xffc08a, 0x2e8b74], size: 2 },
  },
  coal: {
    base: 0x2b2b2f,
    chunks: { n: 80, min: 6, max: 15, colors: [0x1b1b1f, 0x3a3a40, 0x111114, 0x4a4a52] },
    flecks: { n: 60, colors: [0x8a8a96, 0xb8b8c8], size: 2 },
  },
  zinc_ore: {
    base: 0xb7a54a,
    chunks: { n: 60, min: 5, max: 12, colors: [0x9b8c3c, 0xcbb95e, 0x8f9a8a, 0xa9a06b] },
    flecks: { n: 80, colors: [0xdfe8f0, 0x7d8c99], size: 2 },
  },
  bauxite: {
    base: 0xb5532f,
    chunks: { n: 70, min: 4, max: 11, colors: [0x9a3f20, 0xd2744a, 0x7d3018, 0xc66a40] },
    flecks: { n: 60, colors: [0xe8a07a, 0x5a2410], size: 2 },
  },
  sand: {
    base: 0xe3d49a,
    chunks: { n: 30, min: 3, max: 6, colors: [0xd6c58a, 0xefe2b0] },
    flecks: { n: 700, colors: [0xc9b878, 0xf4ebc4, 0xb8a666, 0xffffff], size: 1 },
  },
  oil: {
    base: 0x1c1c22,
    chunks: { n: 28, min: 12, max: 30, colors: [0x101015, 0x26262f, 0x15151c] },
    flecks: { n: 40, colors: [0x4a3b78, 0x2f5f78, 0x6a4a58], size: 3 },
  },
  stone_ore: {
    base: 0x6f8196,
    chunks: { n: 70, min: 6, max: 16, colors: [0x5f7084, 0x8a9bb0, 0x4f5f72, 0x7c8ea3] },
    flecks: { n: 80, colors: [0xd8dbe0, 0x555a62], size: 2 },
  },
  uraninite: {
    base: 0x2f7d46,
    chunks: { n: 60, min: 5, max: 12, colors: [0x24663a, 0x3a9356, 0x1c4f2d] },
    flecks: { n: 90, colors: [0x9dff9d, 0xd4ffd4, 0x64e08a], size: 2 },
  },
};

/** Dessine un éclat à cinq côtés, et ses copies décalées pour que la vignette se raccorde à elle-même. */
function blob(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  r: number,
  color: number,
): void {
  ctx.fillStyle = css(color);
  const pts: [number, number][] = [];
  const turn = random() * Math.PI * 2;
  for (let i = 0; i < 5; i++) {
    const a = turn + (i / 5) * Math.PI * 2;
    const rr = r * (0.65 + 0.5 * random());
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (const dx of [-TILE_PX, 0, TILE_PX])
    for (const dy of [-TILE_PX, 0, TILE_PX]) {
      const ox = cx + dx;
      const oy = cy + dy;
      if (ox < -r || oy < -r || ox > TILE_PX + r || oy > TILE_PX + r) continue;
      ctx.beginPath();
      pts.forEach(([px, py], i) =>
        i === 0 ? ctx.moveTo(x0 + ox + px, y0 + oy + py) : ctx.lineTo(x0 + ox + px, y0 + oy + py),
      );
      ctx.closePath();
      ctx.fill();
    }
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  id: (typeof ORE_TILES)[number],
): void {
  const style = STYLES[id];
  const random = rng(1000 + col * 7 + row * 31);
  const x0 = col * TILE_PX;
  const y0 = row * TILE_PX;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, TILE_PX, TILE_PX);
  ctx.clip();
  ctx.fillStyle = css(style.base);
  ctx.fillRect(x0, y0, TILE_PX, TILE_PX);
  const { n, min, max, colors } = style.chunks;
  for (let i = 0; i < n; i++)
    blob(
      ctx,
      random,
      x0,
      y0,
      random() * TILE_PX,
      random() * TILE_PX,
      min + random() * (max - min),
      mix(colors[Math.floor(random() * colors.length)], style.base, 0.15),
    );
  if (style.flecks) {
    for (let i = 0; i < style.flecks.n; i++) {
      ctx.fillStyle = css(style.flecks.colors[Math.floor(random() * style.flecks.colors.length)]);
      const s = style.flecks.size * (0.6 + random());
      ctx.fillRect(x0 + random() * TILE_PX, y0 + random() * TILE_PX, s, s);
    }
  }
  ctx.restore();
}

let atlas: THREE.CanvasTexture | null = null;

/** Atlas des gisements (null sans navigateur). */
export function oreAtlas(): THREE.CanvasTexture | null {
  if (atlas || typeof document === 'undefined') return atlas;
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * TILE_PX;
  canvas.height = ROWS * TILE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ORE_TILES.forEach((id, i) => paintTile(ctx, i % COLUMNS, Math.floor(i / COLUMNS), id));
  atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}

/** Rectangle (u0, v0, u1, v1) de la vignette d'une ressource dans l'atlas, ou null si elle n'en a pas. */
export function oreTile(id: string): [number, number, number, number] | null {
  const i = (ORE_TILES as readonly string[]).indexOf(id);
  if (i < 0) return null;
  const col = i % COLUMNS;
  const row = Math.floor(i / COLUMNS);
  const inset = 1.5;
  const w = COLUMNS * TILE_PX;
  const h = ROWS * TILE_PX;
  return [
    (col * TILE_PX + inset) / w,
    1 - ((row + 1) * TILE_PX - inset) / h,
    ((col + 1) * TILE_PX - inset) / w,
    1 - (row * TILE_PX + inset) / h,
  ];
}

let water: THREE.CanvasTexture | null = null;

/** Texture de l'eau, qui se raccorde sur ses bords (null sans navigateur). */
export function waterTexture(): THREE.CanvasTexture | null {
  if (water || typeof document === 'undefined') return water;
  const n = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(n, n);
  const deep = [0x1f, 0x5a, 0x98];
  const light = [0x5f, 0xa8, 0xd8];
  const tau = Math.PI * 2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      // Somme de vagues dont les fréquences sont entières : la texture se raccorde à elle-même.
      const a = Math.sin(tau * (3 * u + 2 * v) + 1.6 * Math.sin(tau * 2 * v));
      const b = Math.sin(tau * (2 * u - 4 * v) + 2.1 * Math.sin(tau * u));
      const c = Math.sin(tau * (5 * u + 5 * v) + 1.1 * Math.sin(tau * 3 * u));
      const t = 0.5 + 0.28 * a + 0.2 * b + 0.12 * c;
      const k = Math.min(1, Math.max(0, t));
      const crest = Math.max(0, (k - 0.82) / 0.18);
      const i = (y * n + x) * 4;
      for (let ch = 0; ch < 3; ch++)
        image.data[i + ch] = Math.min(255, deep[ch] + (light[ch] - deep[ch]) * k + crest * 55);
      image.data[i + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  water = new THREE.CanvasTexture(canvas);
  water.wrapS = water.wrapT = THREE.RepeatWrapping;
  water.colorSpace = THREE.SRGBColorSpace;
  water.anisotropy = 4;
  return water;
}

/** Fait couler l'eau : à appeler à chaque image avec le temps écoulé (s). */
export function tickWater(seconds: number): void {
  if (!water) return;
  water.offset.set((seconds * 0.02) % 1, (seconds * 0.011) % 1);
}
