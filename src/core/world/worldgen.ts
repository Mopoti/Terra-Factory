import { CELL_SIZE_M, CHUNK_CELLS } from '../constants';
import {
  FAMILY_IDS,
  RESOURCES,
  type DepositResource,
  type FamilyId,
  type NestResource,
  type ObjectResource,
  type PondResource,
} from '../data/resources';
import { biomeAt, type BiomeId } from './biomes';
import { clamp, fbm, lerp, smoothstep, valueNoise } from './noise';
import { hash01, hashSeed, saltOf } from './rng';

// --- Réglages d'une partie ------------------------------------------------------------------

export interface FamilyParams {
  /** Combien de tas / bosquets / étangs / nids (×0,25 à ×3). */
  frequency: number;
  /** Taille des tas, bosquets, étangs (×0,25 à ×3). */
  size: number;
  /** Densité : quantité par case de minerai, arbres par bosquet, etc. (×0,25 à ×3). */
  density: number;
}
export type WorldFamilies = Record<FamilyId, FamilyParams>;
export interface WorldParams {
  seed: string;
  families: WorldFamilies;
}

export const MULTIPLIER_MIN = 0.25;
export const MULTIPLIER_MAX = 3;
/** Emprise (en cases, côté) d'un nid : entre 1 m et 6 m. */
const NEST_MIN_CELLS = 2;
const NEST_MAX_CELLS = 12;

export function defaultWorldParams(seed: string): WorldParams {
  const families = {} as WorldFamilies;
  for (const id of FAMILY_IDS) families[id] = { frequency: 1, size: 1, density: 1 };
  return { seed, families };
}

/** Réglages valides : toutes les familles présentes, multiplicateurs dans ×0,25 – ×3. */
export function normalizeWorldParams(seed: string, families?: Partial<WorldFamilies>): WorldParams {
  const result = defaultWorldParams(seed);
  const num = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, MULTIPLIER_MIN, MULTIPLIER_MAX) : 1;
  for (const id of FAMILY_IDS) {
    const f = families?.[id];
    result.families[id] = {
      frequency: num(f?.frequency),
      size: num(f?.size),
      density: num(f?.density),
    };
  }
  return result;
}

// --- Contenu d'un chunk ----------------------------------------------------------------------

export interface PlacedObject {
  id: string;
  /** Case d'ancrage (coin de l'emplacement). */
  gx: number;
  gz: number;
  /** Côté de l'emprise, en cases. */
  cells: number;
  scale: number;
  rotation: number;
  amount: number;
}
export interface OreCell {
  id: string;
  gx: number;
  gz: number;
  /** Nombre de minerais dans cette case de 50 cm. */
  amount: number;
}
export interface WaterCell {
  gx: number;
  gz: number;
}
export interface ChunkData {
  cx: number;
  cz: number;
  objects: PlacedObject[];
  ore: OreCell[];
  water: WaterCell[];
}

// --- Constantes de génération -----------------------------------------------------------------

/** Rayon autour du point de départ où rien n'est posé (m). */
export const SPAWN_CLEAR_M = 8;
/** Les formes de tas sont déformées par un bruit : au plus ×1,3 le rayon nominal. */
const SHAPE_REACH = 1.3;
const SHAPE_NOISE_M = 7;
const SHAPE_NOISE_AMPLITUDE = 0.6;
const OBJECT_SLOT_CELLS = 2;
/** Bande de sable autour d'un étang : largeur de 2 à 4 m (4 à 8 cases), quantité finie par case. */
const POND_BAND_MIN_M = 2;
const POND_BAND_MAX_M = 4;
const POND_BAND_AMOUNT = 400;
const STARTER_MIN_DISTANCE_M = 60;
const STARTER_DISTANCE_RANGE_M = 50;
const STARTER_MIN_RADIUS_M = 4;

type PatchResource = DepositResource | PondResource;

interface Patch {
  res: PatchResource;
  xM: number;
  zM: number;
  radiusM: number;
  richness: number;
  noiseSalt: number;
}
/** Bosquet / affleurement garanti près du départ, pour ne jamais manquer de bois ni de pierre. */
interface StarterCluster {
  res: ObjectResource;
  xM: number;
  zM: number;
  radiusM: number;
}
interface Nest {
  res: NestResource;
  gx: number;
  gz: number;
  /** Côté de l'emprise, en cases (dépend du réglage « taille » des ennemis). */
  cells: number;
}

const cellCenter = (g: number): number => (g + 0.5) * CELL_SIZE_M;
const roundTo5 = (v: number): number => Math.max(5, Math.round(v / 5) * 5);

/** Richesse d'un gisement selon la distance D (m) de son centre au point de départ : 1 + (D / 100)^1,5. */
export const distanceRichness = (distM: number): number =>
  1 + Math.pow(Math.max(0, distM) / 100, 1.5);
/** Agrandissement des gisements avec la distance : ×1 au départ, ×2 à 1 000 m et au-delà. */
export const distanceGrowth = (distM: number): number => 1 + Math.min(1, Math.max(0, distM) / 1000);

export class WorldGenerator {
  readonly seed: number;
  readonly params: WorldParams;
  private readonly starters: Patch[] = [];
  private readonly starterClusters: StarterCluster[] = [];
  private readonly salts = new Map<string, number>();

  constructor(params: WorldParams) {
    this.params = normalizeWorldParams(params.seed, params.families);
    this.seed = hashSeed(params.seed);
    this.buildStarters();
  }

  private salt(key: string): number {
    let s = this.salts.get(key);
    if (s === undefined) {
      s = saltOf(key);
      this.salts.set(key, s);
    }
    return s;
  }

  biomeAt(xM: number, zM: number): BiomeId {
    return biomeAt(this.seed, xM, zM);
  }

  /** Positions (m) des tas et bosquets garantis près du départ, par id de ressource. */
  starterSites(): { id: string; xM: number; zM: number }[] {
    return [
      ...this.starters.map((p) => ({ id: p.res.id, xM: p.xM, zM: p.zM })),
      ...this.starterClusters.map((c) => ({ id: c.res.id, xM: c.xM, zM: c.zM })),
    ];
  }

  // --- Tas (minerais et étangs) -------------------------------------------------------------

  /** Un tas de départ par minerai et par étang, à portée de marche du point d'apparition. */
  private buildStarters(): void {
    const kinds = RESOURCES.filter(
      (r): r is PatchResource =>
        (r.kind === 'deposit' && (r.minDistanceM ?? 0) === 0) || r.kind === 'pond',
    );
    const base = hash01(this.seed, 0, 0, this.salt('starter.angle')) * Math.PI * 2;
    const objects = RESOURCES.filter((r): r is ObjectResource => r.kind === 'object');
    objects.forEach((res, i) => {
      const angle = base + Math.PI / kinds.length + (i * Math.PI * 2) / objects.length;
      const distance = 35 + 40 * hash01(this.seed, i, 2, this.salt('starter.cluster'));
      const size = this.params.families[res.family].size;
      this.starterClusters.push({
        res,
        xM: Math.cos(angle) * distance,
        zM: Math.sin(angle) * distance,
        radiusM: Math.max(10 * size, 6),
      });
    });
    kinds.forEach((res, i) => {
      const angle = base + (i * Math.PI * 2) / kinds.length;
      const distance =
        STARTER_MIN_DISTANCE_M +
        STARTER_DISTANCE_RANGE_M * hash01(this.seed, i, 1, this.salt('starter.distance'));
      const size = this.params.families[res.family].size;
      const mid = (res.radiusM[0] + res.radiusM[1]) / 2;
      this.starters.push({
        res,
        xM: Math.cos(angle) * distance,
        zM: Math.sin(angle) * distance,
        radiusM: Math.max(mid * size, STARTER_MIN_RADIUS_M),
        richness: res.kind === 'deposit' ? (res.richness[0] + res.richness[1]) / 2 : 1,
        noiseSalt: this.salt(`patch.starter.${res.id}`),
      });
    });
  }

  /** Cases-candidates d'une ressource : taille réglée par la fréquence de sa famille. */
  private candidateSize(res: { candidateSizeM: number; family: FamilyId }): number {
    return res.candidateSizeM / Math.sqrt(this.params.families[res.family].frequency);
  }

  private presence(res: { presence: number; family: FamilyId; kind: string }): number {
    const density = this.params.families[res.family].density;
    // Pour les étangs et les nids, la densité règle la probabilité d'en avoir un par case-candidate.
    return res.kind === 'deposit' ? res.presence : clamp(res.presence * density, 0, 1);
  }

  /** Tous les tas d'une ressource dont l'emprise peut toucher la zone (en mètres). */
  private patchesIn(
    res: PatchResource,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): Patch[] {
    const fam = this.params.families[res.family];
    const size = fam.size;
    const extra = res.kind === 'pond' ? POND_BAND_MAX_M : 0;
    const reach = res.radiusM[1] * size * SHAPE_REACH + extra;
    const s = this.candidateSize(res);
    const id = res.id;
    const result: Patch[] = [];
    for (const p of this.starters) {
      if (p.res.id !== id) continue;
      const r = p.radiusM * SHAPE_REACH + extra;
      if (p.xM + r >= minX && p.xM - r <= maxX && p.zM + r >= minZ && p.zM - r <= maxZ)
        result.push(p);
    }
    const ixMin = Math.floor((minX - reach) / s);
    const ixMax = Math.floor((maxX + reach) / s);
    const izMin = Math.floor((minZ - reach) / s);
    const izMax = Math.floor((maxZ + reach) / s);
    const saltId = this.salt(id);
    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iz = izMin; iz <= izMax; iz++) {
        const xM = (ix + 0.1 + 0.8 * hash01(this.seed, ix, iz, saltId + 2)) * s;
        const zM = (iz + 0.1 + 0.8 * hash01(this.seed, ix, iz, saltId + 3)) * s;
        const dist = Math.hypot(xM, zM);
        if (res.kind === 'deposit' && dist < (res.minDistanceM ?? 0)) continue;
        const weight = res.biomeWeight[this.biomeAt(xM, zM)];
        // Plus on s'éloigne du départ, plus les gisements sont un peu espacés (÷ 1,5 à 1 000 m)…
        const spacing = res.kind === 'deposit' ? 1 / (1 + dist / 2000) : 1;
        if (hash01(this.seed, ix, iz, saltId + 1) >= this.presence(res) * weight * spacing)
          continue;
        // … et plus grands (jusqu'à ×2 à 1 000 m).
        const grow = res.kind === 'deposit' ? distanceGrowth(dist) : 1;
        const radiusM =
          (res.radiusM[0] +
            (res.radiusM[1] - res.radiusM[0]) * hash01(this.seed, ix, iz, saltId + 4)) *
          size *
          grow;
        const r = radiusM * SHAPE_REACH + extra;
        if (xM + r < minX || xM - r > maxX || zM + r < minZ || zM - r > maxZ) continue;
        const richness =
          res.kind === 'deposit'
            ? lerp(res.richness[0], res.richness[1], hash01(this.seed, ix, iz, saltId + 5))
            : 1;
        result.push({
          res,
          xM,
          zM,
          radiusM,
          richness,
          noiseSalt: saltId + 6 + ((ix * 31 + iz) | 0),
        });
      }
    }
    return result;
  }

  /** Distance normalisée d'une case au centre du tas : < 1 dedans, 0 au centre, 1 au bord. */
  private patchT(p: Patch, gx: number, gz: number): number {
    const x = cellCenter(gx);
    const z = cellCenter(gz);
    const d = Math.hypot(x - p.xM, z - p.zM);
    const dev =
      (valueNoise(this.seed, x / SHAPE_NOISE_M, z / SHAPE_NOISE_M, p.noiseSalt) - 0.5) *
      SHAPE_NOISE_AMPLITUDE;
    return d / p.radiusM + dev;
  }

  /** Part (0 à 1) de la largeur de bande de sable propre à un étang. */
  private bandShare(p: Patch): number {
    return hash01(this.seed, Math.round(p.xM), Math.round(p.zM), this.salt('pond.band'));
  }

  /** Nombre de minerais dans une case : max au centre, `edgeRatio` × le max au bord. */
  private oreAmount(p: Patch & { res: DepositResource }, t: number): number {
    const density = this.params.families[p.res.family].density;
    const tc = clamp(t, 0, 1);
    const profile = p.res.edgeRatio + (1 - p.res.edgeRatio) * (1 - tc * tc);
    const richer = distanceRichness(Math.hypot(p.xM, p.zM));
    return roundTo5(p.res.centerAmount * p.richness * density * profile * richer);
  }

  // --- Nids ---------------------------------------------------------------------------------

  /** Emprise d'un nid : le réglage « taille » des ennemis agrandit ou réduit les colonies de départ. */
  private nestCells(res: NestResource): number {
    const size = this.params.families[res.family].size;
    return clamp(Math.round(res.footprintCells * size), NEST_MIN_CELLS, NEST_MAX_CELLS);
  }

  private nestsIn(
    res: NestResource,
    minGx: number,
    maxGx: number,
    minGz: number,
    maxGz: number,
  ): Nest[] {
    const s = this.candidateSize(res);
    const saltId = this.salt(res.id);
    const cells = this.nestCells(res);
    const margin = NEST_MAX_CELLS;
    const ixMin = Math.floor(((minGx - margin) * CELL_SIZE_M) / s);
    const ixMax = Math.floor(((maxGx + margin) * CELL_SIZE_M) / s);
    const izMin = Math.floor(((minGz - margin) * CELL_SIZE_M) / s);
    const izMax = Math.floor(((maxGz + margin) * CELL_SIZE_M) / s);
    const result: Nest[] = [];
    for (let ix = ixMin; ix <= ixMax; ix++) {
      for (let iz = izMin; iz <= izMax; iz++) {
        const xM = (ix + 0.1 + 0.8 * hash01(this.seed, ix, iz, saltId + 2)) * s;
        const zM = (iz + 0.1 + 0.8 * hash01(this.seed, ix, iz, saltId + 3)) * s;
        if (Math.hypot(xM, zM) < res.minDistanceFromSpawnM) continue;
        const weight = res.biomeWeight[this.biomeAt(xM, zM)];
        if (hash01(this.seed, ix, iz, saltId + 1) >= this.presence(res) * weight) continue;
        // (gx, gz) = coin de l'emprise ; le nid est centré sur le point tiré.
        const gx = Math.floor(xM / CELL_SIZE_M) - Math.floor(cells / 2);
        const gz = Math.floor(zM / CELL_SIZE_M) - Math.floor(cells / 2);
        if (gx < minGx - margin || gx > maxGx || gz < minGz - margin || gz > maxGz) continue;
        if (this.footprintHasResource(gx, gz, cells)) continue;
        result.push({ res, gx, gz, cells });
      }
    }
    return result;
  }

  /** Vrai si un minerai ou de l'eau occupe une case de l'emprise (pas de nid dessus). (gx, gz) = coin. */
  private footprintHasResource(gx: number, gz: number, cells: number): boolean {
    for (let dx = 0; dx < cells; dx++) {
      for (let dz = 0; dz < cells; dz++) {
        const cx = gx + dx;
        const cz = gz + dz;
        const x = cellCenter(cx);
        const z = cellCenter(cz);
        for (const res of RESOURCES) {
          if (res.kind !== 'deposit' && res.kind !== 'pond') continue;
          for (const p of this.patchesIn(res, x, x, z, z))
            if (this.patchT(p, cx, cz) < 1) return true;
        }
      }
    }
    return false;
  }

  // --- Génération d'un chunk -------------------------------------------------------------------

  chunk(cx: number, cz: number): ChunkData {
    const n = CHUNK_CELLS;
    const gx0 = cx * n;
    const gz0 = cz * n;
    const minX = gx0 * CELL_SIZE_M;
    const maxX = (gx0 + n) * CELL_SIZE_M;
    const minZ = gz0 * CELL_SIZE_M;
    const maxZ = (gz0 + n) * CELL_SIZE_M;

    const water = new Uint8Array(n * n);
    const oreAmount = new Float64Array(n * n);
    const oreId: (string | null)[] = new Array<string | null>(n * n).fill(null);
    const clear = new Uint8Array(n * n);
    const sandCells = new Uint8Array(n * n);

    for (let lz = 0; lz < n; lz++) {
      for (let lx = 0; lx < n; lx++) {
        const d = Math.hypot(cellCenter(gx0 + lx), cellCenter(gz0 + lz));
        if (d < SPAWN_CLEAR_M) clear[lz * n + lx] = 1;
      }
    }

    for (const res of RESOURCES) {
      if (res.kind !== 'deposit' && res.kind !== 'pond') continue;
      for (const p of this.patchesIn(res, minX, maxX, minZ, maxZ)) {
        const reach = p.radiusM * SHAPE_REACH + (res.kind === 'pond' ? POND_BAND_MAX_M : 0);
        const lxMin = Math.max(0, Math.floor((p.xM - reach) / CELL_SIZE_M) - gx0);
        const lxMax = Math.min(n - 1, Math.floor((p.xM + reach) / CELL_SIZE_M) - gx0);
        const lzMin = Math.max(0, Math.floor((p.zM - reach) / CELL_SIZE_M) - gz0);
        const lzMax = Math.min(n - 1, Math.floor((p.zM + reach) / CELL_SIZE_M) - gz0);
        for (let lz = lzMin; lz <= lzMax; lz++) {
          for (let lx = lxMin; lx <= lxMax; lx++) {
            const i = lz * n + lx;
            if (clear[i]) continue;
            const t = this.patchT(p, gx0 + lx, gz0 + lz);
            if (t >= 1) {
              if (res.kind === 'pond' && !water[i]) {
                const band =
                  POND_BAND_MIN_M + (POND_BAND_MAX_M - POND_BAND_MIN_M) * this.bandShare(p);
                if (t < 1 + band / p.radiusM && oreAmount[i] <= 0) {
                  sandCells[i] = 1;
                }
              }
              continue;
            }
            if (res.kind === 'pond') {
              water[i] = 1;
            } else {
              const amount = this.oreAmount(p as Patch & { res: DepositResource }, t);
              if (amount > oreAmount[i]) {
                oreAmount[i] = amount;
                oreId[i] = res.id;
              }
            }
          }
        }
      }
    }

    // Rivage : du sable fini autour des étangs (sauf sur l'eau et sur un minerai).
    for (let i = 0; i < n * n; i++) {
      if (sandCells[i] && !water[i] && oreAmount[i] <= 0) {
        oreAmount[i] = POND_BAND_AMOUNT;
        oreId[i] = 'sand';
      }
    }

    // Nids dont l'emprise touche ce chunk.
    const nests: Nest[] = [];
    for (const res of RESOURCES) {
      if (res.kind === 'nest') nests.push(...this.nestsIn(res, gx0, gx0 + n - 1, gz0, gz0 + n - 1));
    }
    const inNest = (gx: number, gz: number): boolean =>
      nests.some(
        (nst) => gx >= nst.gx && gx < nst.gx + nst.cells && gz >= nst.gz && gz < nst.gz + nst.cells,
      );

    // Arbres, rochers : un emplacement de 1 m × 1 m, au plus un objet.
    const objects: PlacedObject[] = [];
    const objectRes = RESOURCES.filter((r): r is ObjectResource => r.kind === 'object');
    const slots = n / OBJECT_SLOT_CELLS;
    for (let sz = 0; sz < slots; sz++) {
      for (let sx = 0; sx < slots; sx++) {
        const gx = gx0 + sx * OBJECT_SLOT_CELLS;
        const gz = gz0 + sz * OBJECT_SLOT_CELLS;
        let blocked = false;
        for (let dz = 0; dz < OBJECT_SLOT_CELLS && !blocked; dz++) {
          for (let dx = 0; dx < OBJECT_SLOT_CELLS && !blocked; dx++) {
            const i = (sz * OBJECT_SLOT_CELLS + dz) * n + sx * OBJECT_SLOT_CELLS + dx;
            if (water[i] || oreId[i] || clear[i] || inNest(gx + dx, gz + dz)) blocked = true;
          }
        }
        if (blocked) continue;
        const xM = (gx + OBJECT_SLOT_CELLS / 2) * CELL_SIZE_M;
        const zM = (gz + OBJECT_SLOT_CELLS / 2) * CELL_SIZE_M;
        const biome = this.biomeAt(xM, zM);
        const slotX = gx / OBJECT_SLOT_CELLS;
        const slotZ = gz / OBJECT_SLOT_CELLS;
        for (const res of objectRes) {
          const fam = this.params.families[res.family];
          const saltId = this.salt(res.id);
          const cover = clamp(0.5 * fam.frequency * res.biomeCover[biome], 0.03, 1);
          const threshold = 0.5 + (0.5 - cover) * 0.8;
          const wave = res.clusterWavelengthM * fam.size;
          const noise = fbm(this.seed, xM / wave, zM / wave, saltId + 7, 2);
          const factor =
            res.outsideFactor +
            (1 - res.outsideFactor) * smoothstep(threshold - 0.04, threshold + 0.04, noise);
          let p = res.biomeDensity[biome] * fam.density * factor;
          const starter = this.starterClusters.some(
            (c) => c.res === res && Math.hypot(xM - c.xM, zM - c.zM) < c.radiusM,
          );
          if (starter) p = Math.max(p, res.biomeDensity.prairie * fam.density);
          if (hash01(this.seed, slotX, slotZ, saltId) < p) {
            objects.push({
              id: res.id,
              gx,
              gz,
              cells: OBJECT_SLOT_CELLS,
              scale: 0.8 + 0.45 * hash01(this.seed, slotX, slotZ, saltId + 1),
              rotation: hash01(this.seed, slotX, slotZ, saltId + 2) * Math.PI * 2,
              amount: res.amount,
            });
            break;
          }
        }
      }
    }
    for (const nst of nests) {
      if (nst.gx >= gx0 && nst.gx < gx0 + n && nst.gz >= gz0 && nst.gz < gz0 + n) {
        objects.push({
          id: nst.res.id,
          gx: nst.gx,
          gz: nst.gz,
          cells: nst.cells,
          scale: 1,
          rotation: 0,
          amount: 0,
        });
      }
    }

    const ore: OreCell[] = [];
    const waterCells: WaterCell[] = [];
    for (let lz = 0; lz < n; lz++) {
      for (let lx = 0; lx < n; lx++) {
        const i = lz * n + lx;
        if (water[i]) waterCells.push({ gx: gx0 + lx, gz: gz0 + lz });
        else if (oreId[i])
          ore.push({ id: oreId[i] as string, gx: gx0 + lx, gz: gz0 + lz, amount: oreAmount[i] });
      }
    }
    return { cx, cz, objects, ore, water: waterCells };
  }
}

export const chunkOfCell = (g: number): number => Math.floor(g / CHUNK_CELLS);
export const cellOfMeters = (m: number): number => Math.floor(m / CELL_SIZE_M);
