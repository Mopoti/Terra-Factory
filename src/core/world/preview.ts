import { CELL_SIZE_M, CHUNK_CELLS } from '../constants';
import { resourceById } from '../data/resources';
import { BIOME_COLORS, type BiomeId } from './biomes';
import { SPAWN_CLEAR_M, type ChunkData, type OreCell, type WorldGenerator } from './worldgen';
import { chunkOfCell } from './worldgen';

/** Rayon (en chunks) de la carte d'aperçu : 32 chunks = 256 m autour du départ. */
export const PREVIEW_RADIUS_CHUNKS = 32;
/** Les biomes varient lentement : on les échantillonne tous les 4 cases (2 m). */
const BIOME_BLOCK = 4;
/** Zone de départ garantie, tracée sur la carte (m). */
export const SAFE_ZONE_M = 150;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = (c: Rgb, f: number): Rgb => [
  Math.min(255, c[0] * f),
  Math.min(255, c[1] * f),
  Math.min(255, c[2] * f),
];

/** Ce qu'il y a sous un point de la carte : un minerai, de l'eau, ou un objet (rocher, nid, arbre…). */
export interface PreviewHit {
  kind: 'ore' | 'water' | 'object';
  /** Identifiant de ressource (`iron_ore`, `water`, `rock`, `nest`, `tree`…). */
  id: string;
}

/**
 * Carte d'aperçu du monde vue du dessus (1 pixel = 1 case de 50 cm), dessinée chunk par chunk
 * pour pouvoir laisser respirer l'interface : appeler `step()` jusqu'à ce qu'il renvoie true.
 */
export class PreviewRenderer {
  readonly width: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  private row = 0;
  private readonly rows: number;
  private readonly chunks = new Map<string, { data: ChunkData; ore: Map<string, OreCell> }>();
  private readonly biomeColors: Record<BiomeId, Rgb>;

  constructor(
    private readonly gen: WorldGenerator,
    private readonly radiusChunks = PREVIEW_RADIUS_CHUNKS,
  ) {
    this.rows = radiusChunks * 2 + 1;
    this.width = this.rows * CHUNK_CELLS;
    this.pixels = new Uint8ClampedArray(new ArrayBuffer(this.width * this.width * 4));
    this.biomeColors = Object.fromEntries(
      Object.entries(BIOME_COLORS).map(([id, c]) => [id, hex(c)]),
    ) as Record<BiomeId, Rgb>;
  }

  /** Contenu d'un chunk (gardé en mémoire : la carte et les info-bulles le réutilisent). */
  private chunkAt(cx: number, cz: number): { data: ChunkData; ore: Map<string, OreCell> } {
    const k = `${cx},${cz}`;
    let c = this.chunks.get(k);
    if (!c) {
      const data = this.gen.chunk(cx, cz);
      c = { data, ore: new Map(data.ore.map((o) => [`${o.gx},${o.gz}`, o])) };
      this.chunks.set(k, c);
    }
    return c;
  }

  /** Case du monde sous un pixel de la carte (le départ est au centre). */
  cellOfPixel(px: number, py: number): { gx: number; gz: number } {
    const offset = this.radiusChunks * CHUNK_CELLS;
    return { gx: Math.floor(px) - offset, gz: Math.floor(py) - offset };
  }

  /** Minerai de cette case du monde (pour calculer un filon). */
  oreAt(gx: number, gz: number): OreCell | null {
    return this.chunkAt(chunkOfCell(gx), chunkOfCell(gz)).ore.get(`${gx},${gz}`) ?? null;
  }

  /** Ce que la carte montre sur cette case : minerai, eau ou objet (le minerai passe devant, comme à l'écran). */
  inspect(gx: number, gz: number): PreviewHit | null {
    const { data, ore } = this.chunkAt(chunkOfCell(gx), chunkOfCell(gz));
    const o = ore.get(`${gx},${gz}`);
    if (o) return { kind: 'ore', id: o.id };
    for (const obj of data.objects)
      if (gx >= obj.gx && gx < obj.gx + obj.cells && gz >= obj.gz && gz < obj.gz + obj.cells)
        return { kind: 'object', id: obj.id };
    if (data.water.some((w) => w.gx === gx && w.gz === gz)) return { kind: 'water', id: 'water' };
    return null;
  }

  /** Avancement de 0 à 1. */
  get progress(): number {
    return this.row / (this.rows + 1);
  }

  private put(px: number, py: number, c: Rgb): void {
    if (px < 0 || py < 0 || px >= this.width || py >= this.width) return;
    const i = (py * this.width + px) * 4;
    this.pixels[i] = c[0];
    this.pixels[i + 1] = c[1];
    this.pixels[i + 2] = c[2];
    this.pixels[i + 3] = 255;
  }

  private fill(px: number, py: number, size: number, c: Rgb): void {
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) this.put(px + dx, py + dy, c);
  }

  /** Dessine la rangée de chunks suivante ; renvoie true quand la carte est terminée. */
  step(): boolean {
    if (this.row > this.rows) return true;
    if (this.row === this.rows) {
      this.drawMarkers();
      this.row++;
      return true;
    }
    const r = this.radiusChunks;
    const cz = this.row - r;
    for (let cx = -r; cx <= r; cx++) this.drawChunk(cx, cz, cx + r, this.row);
    this.row++;
    return false;
  }

  private drawChunk(cx: number, cz: number, col: number, row: number): void {
    const n = CHUNK_CELLS;
    const x0 = col * n;
    const y0 = row * n;
    const gx0 = cx * n;
    const gz0 = cz * n;
    for (let by = 0; by < n; by += BIOME_BLOCK) {
      for (let bx = 0; bx < n; bx += BIOME_BLOCK) {
        const xM = (gx0 + bx + BIOME_BLOCK / 2) * CELL_SIZE_M;
        const zM = (gz0 + by + BIOME_BLOCK / 2) * CELL_SIZE_M;
        this.fill(x0 + bx, y0 + by, BIOME_BLOCK, this.biomeColors[this.gen.biomeAt(xM, zM)]);
      }
    }
    const chunk = this.chunkAt(cx, cz).data;
    const water = hex(resourceById('water').color);
    for (const w of chunk.water) this.put(x0 + (w.gx - gx0), y0 + (w.gz - gz0), water);
    for (const o of chunk.ore) {
      const base = hex(resourceById(o.id).color);
      this.put(
        x0 + (o.gx - gx0),
        y0 + (o.gz - gz0),
        shade(base, 0.8 + 0.5 * Math.min(1, o.amount / 3500)),
      );
    }
    for (const o of chunk.objects) {
      const color = hex(resourceById(o.id).color);
      const px = x0 + (o.gx - gx0);
      const py = y0 + (o.gz - gz0);
      if (o.id === 'nest') this.fill(px, py, o.cells, color);
      else this.fill(px, py, o.cells, o.id === 'tree' ? shade(color, 0.75) : color);
    }
  }

  /** Point d'apparition (croix) et limite de la zone de départ garantie (cercle). */
  private drawMarkers(): void {
    const c = this.width / 2;
    const ring = (this.gen.params.safeZoneM ?? SAFE_ZONE_M) / CELL_SIZE_M;
    for (let a = 0; a < 720; a++) {
      const t = (a / 720) * Math.PI * 2;
      this.put(
        Math.round(c + Math.cos(t) * ring),
        Math.round(c + Math.sin(t) * ring),
        [255, 255, 255],
      );
    }
    const arm = Math.round(SPAWN_CLEAR_M / CELL_SIZE_M);
    for (let i = -arm; i <= arm; i++) {
      this.put(Math.round(c) + i, Math.round(c), [255, 255, 255]);
      this.put(Math.round(c), Math.round(c) + i, [255, 255, 255]);
    }
  }
}

/** Dessine toute la carte d'un coup (tests, usages hors interface). */
export function renderPreview(
  gen: WorldGenerator,
  radiusChunks = PREVIEW_RADIUS_CHUNKS,
): PreviewRenderer {
  const renderer = new PreviewRenderer(gen, radiusChunks);
  while (!renderer.step()) {
    /* continue */
  }
  return renderer;
}
