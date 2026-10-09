/**
 * Décor naturel. Arbres, rochers et bûches viennent du pack « Low Poly Nature » (couleurs de sommet, fusionnées avec
 * le reste du décor), de même que les herbes et plantes des buissons. Voir
 * `docs/modeles3d.md` pour les sources. Tant que les fichiers ne sont pas chargés, le décor garde ses formes simples.
 */
import type { BiomeId } from '../core/world/biomes';
import type { BakedModel } from './models';

const lows = new Map<string, BakedModel>();

/** Arbres de chaque biome (noms dans `lowpoly.json`) : feuillus en prairie, conifères en forêt, arbres secs au désert. */
export const TREES_BY_BIOME: Record<BiomeId, readonly string[]> = {
  prairie: ['Tree016', 'Tree019', 'Tree012', 'Tree013'],
  forest: ['Tree009', 'Tree017', 'Tree018', 'Tree010', 'Tree001', 'Tree004'],
  desert: ['Tree022', 'Tree024', 'Tree026'],
  tundra: ['Tree007', 'Tree008', 'Tree005', 'Tree003'],
};
/** Herbes et plantes des buissons de fibres, par biome. */
export const BUSHES_BY_BIOME: Record<BiomeId, readonly string[]> = {
  prairie: ['Grass007', 'Grass005', 'Grass011', 'Grass003'],
  forest: ['Grass004', 'Grass012', 'Grass005', 'Grass008'],
  desert: ['Grass006', 'Grass011', 'Grass010'],
  tundra: ['Grass012', 'Grass006', 'Grass003'],
};
/** Hauteur (m) et largeur maximale (m) d'un buisson de taille moyenne. */
export const BUSH_HEIGHT_MODEL_M = 0.6;
export const BUSH_MAX_WIDTH_M = 0.95;

/** Rochers, du plus petit aspect au plus massif ; les petits, moyens et grands piochent dans toute la liste. */
export const ROCKS = [
  'Stone014',
  'Stone012',
  'Stone003',
  'Stone001',
  'Stone002',
  'Stone004',
  'Stone005',
];
/** Bûche seule et paire de bûches (objets de bois posés au sol). */
export const LOG = 'Tree025';
export const LOG_PAIR = 'Stump';

/** Hauteur (m) d'un arbre de taille moyenne ; largeur (m) d'un rocher de taille moyenne. */
export const TREE_MODEL_HEIGHT_M = 5.5;
export const ROCK_MODEL_WIDTH_M = 0.95;

/** Modèle du pack par nom, ou null tant qu'il n'est pas chargé. */
export const lowModel = (name: string): BakedModel | null => lows.get(name) ?? null;
/** Arbres disponibles pour ce biome (vide tant que le pack n'est pas chargé). */
export const treeModelsFor = (biome: BiomeId): BakedModel[] =>
  TREES_BY_BIOME[biome].flatMap((n) => lows.get(n) ?? []);
export const bushModelsFor = (biome: BiomeId): BakedModel[] =>
  BUSHES_BY_BIOME[biome].flatMap((n) => lows.get(n) ?? []);
export const rockModels = (): BakedModel[] => ROCKS.flatMap((n) => lows.get(n) ?? []);

interface LowFile {
  [name: string]: { ref: string; p: number[]; n: number[]; c: number[]; i: number[] };
}

/** Transforme le fichier compact du pack en modèles prêts à fusionner (couleurs en linéaire). */
export function parseLowpoly(file: LowFile): Map<string, BakedModel> {
  const out = new Map<string, BakedModel>();
  for (const [name, m] of Object.entries(file)) {
    const count = m.p.length / 3;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = m.p[i] / 1000;
      normals[i] = m.n[i] / 100;
      colors[i] = (m.c[i] / 255) ** 2.2;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      minX = Math.min(minX, positions[i * 3]);
      maxX = Math.max(maxX, positions[i * 3]);
      minY = Math.min(minY, positions[i * 3 + 1]);
      maxY = Math.max(maxY, positions[i * 3 + 1]);
      minZ = Math.min(minZ, positions[i * 3 + 2]);
      maxZ = Math.max(maxZ, positions[i * 3 + 2]);
    }
    // Un arbre est posé par le pied de son tronc : on déclare la boîte symétrique autour de lui.
    const byFoot = m.ref === 'h';
    const ax = Math.max(Math.abs(minX), Math.abs(maxX));
    const az = Math.max(Math.abs(minZ), Math.abs(maxZ));
    out.set(name, {
      positions,
      normals,
      colors,
      index: new Uint32Array(m.i),
      min: byFoot ? { x: -ax, y: minY, z: -az } : { x: minX, y: minY, z: minZ },
      size: byFoot
        ? { x: 2 * ax, y: maxY - minY, z: 2 * az }
        : { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    });
  }
  return out;
}

let loading: Promise<void> | null = null;

/** Charge (une seule fois) le pack d'arbres, de rochers et de plantes ; un échec est ignoré. */
export function loadNature(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const dir = `${baseUrl}models/nature/`;
  const lowLoad = fetch(`${dir}lowpoly.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((file: LowFile) => {
      for (const [name, model] of parseLowpoly(file)) lows.set(name, model);
    })
    .catch(() => undefined);
  loading = lowLoad;
  return loading;
}
