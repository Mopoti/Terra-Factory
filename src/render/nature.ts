/**
 * Décor naturel. Arbres, rochers et bûches viennent du pack « Low Poly Nature » (couleurs de sommet, fusionnées avec
 * le reste du décor) ; les plantes basses sont des cartes texturées à transparence (matériau à part). Voir
 * `docs/modeles3d.md` pour les sources. Tant que les fichiers ne sont pas chargés, le décor garde ses formes simples.
 */
import * as THREE from 'three';
import type { BiomeId } from '../core/world/biomes';
import type { BakedModel } from './models';

/** Modèle à cartes texturées (plantes) : sommets, normales, coordonnées de texture. */
export interface TreeModel {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
  /** Position (x, z) du pied et hauteur totale, dans le repère du fichier. */
  base: { x: number; z: number; minY: number };
  height: number;
  /** Plus grande largeur horizontale. */
  width: number;
}

const plants: TreeModel[] = [];
const lows = new Map<string, BakedModel>();

/** Plantes basses (herbes, buissons fleuris, fougères) : plusieurs formes, à choisir au hasard. */
export const plantModels = (): readonly TreeModel[] => plants;

/** Arbres de chaque biome (noms dans `lowpoly.json`) : feuillus en prairie, conifères en forêt, arbres secs au désert. */
export const TREES_BY_BIOME: Record<BiomeId, readonly string[]> = {
  prairie: ['Tree016', 'Tree019', 'Tree012', 'Tree013'],
  forest: ['Tree009', 'Tree017', 'Tree018', 'Tree010', 'Tree001', 'Tree004'],
  desert: ['Tree022', 'Tree024', 'Tree026'],
  tundra: ['Tree007', 'Tree008', 'Tree005', 'Tree003'],
};
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

/** Matériau des plantes : texture peinte, les zones transparentes sont découpées. */
export const plantMaterial = new THREE.MeshStandardMaterial({
  alphaTest: 0.5,
  side: THREE.DoubleSide,
  roughness: 1,
});

/** Lit le sous-ensemble d'OBJ du fichier (sommets `v`, coordonnées `vt`, faces `f a/a b/b c/c`) et calcule les normales. */
export function parseTree(text: string): TreeModel {
  const v: number[] = [];
  const vt: number[] = [];
  const idx: number[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push(+t[1], +t[2], +t[3]);
    else if (t[0] === 'vt') vt.push(+t[1], +t[2]);
    else if (t[0] === 'f') for (const k of [1, 2, 3]) idx.push(parseInt(t[k], 10) - 1);
  }
  const n = v.length / 3;
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const ux = v[b] - v[a];
    const uy = v[b + 1] - v[a + 1];
    const uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a];
    const wy = v[c + 1] - v[a + 1];
    const wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy;
    const ny = uz * wx - ux * wz;
    const nz = ux * wy - uy * wx;
    for (const o of [a, b, c]) {
      normals[o] += nx;
      normals[o + 1] += ny;
      normals[o + 2] += nz;
    }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    // Le feuillage est fait de cartes : on relève un peu les normales pour un éclairage doux, comme un arbre touffu.
    normals[i * 3] /= l;
    normals[i * 3 + 1] = normals[i * 3 + 1] / l + 0.6;
    normals[i * 3 + 2] /= l;
    const l2 = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    normals[i * 3] /= l2;
    normals[i * 3 + 1] /= l2;
    normals[i * 3 + 2] /= l2;
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < v.length; i += 3) {
    minY = Math.min(minY, v[i]);
    maxY = Math.max(maxY, v[i]);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    minX = Math.min(minX, v[i]);
    maxX = Math.max(maxX, v[i]);
    minZ = Math.min(minZ, v[i + 2]);
    maxZ = Math.max(maxZ, v[i + 2]);
  }
  let bx = 0;
  let bz = 0;
  let count = 0;
  for (let i = 0; i < n; i++)
    if (v[i * 3 + 1] < minY + 0.3) {
      bx += v[i * 3];
      bz += v[i * 3 + 2];
      count++;
    }
  return {
    positions: new Float32Array(v),
    normals,
    uvs: new Float32Array(vt),
    index: new Uint32Array(idx),
    base: { x: bx / (count || 1), z: bz / (count || 1), minY },
    height: maxY - minY,
    width: Math.max(maxX - minX, maxZ - minZ),
  };
}

let loading: Promise<void> | null = null;

/** Charge (une seule fois) le pack d'arbres et de rochers et les plantes ; un échec est ignoré. */
export function loadNature(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const dir = `${baseUrl}models/nature/`;
  const lowLoad = fetch(`${dir}lowpoly.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((file: LowFile) => {
      for (const [name, model] of parseLowpoly(file)) lows.set(name, model);
    })
    .catch(() => undefined);
  const plantsLoad = Promise.all(
    [1, 2, 3, 4].map((n) =>
      fetch(`${dir}plant${n}.obj`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => parseTree(text)),
    ),
  )
    .then(
      (models) =>
        new Promise<void>((resolve) => {
          new THREE.TextureLoader().load(
            `${dir}plants.png`,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              plantMaterial.map = texture;
              plantMaterial.needsUpdate = true;
              plants.push(...models);
              resolve();
            },
            undefined,
            () => resolve(),
          );
        }),
    )
    .catch(() => undefined);
  loading = Promise.all([lowLoad, plantsLoad]).then(() => undefined);
  return loading;
}
