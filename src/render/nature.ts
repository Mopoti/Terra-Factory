/**
 * Décor naturel : un conifère (feuillage en cartes texturées à transparence, d'où un matériau à part) et un tas de
 * cailloux (couleur par sommet, fusionné avec le reste du décor). Voir `docs/modeles3d.md` pour les sources.
 * Tant que les fichiers ne sont pas chargés, le décor garde ses formes simples.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bake, bakedModel, registerModel, type BakedModel } from './models';

export interface TreeModel {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
  /** Position (x, z) de la base du tronc et hauteur totale, dans le repère du fichier. */
  base: { x: number; z: number; minY: number };
  height: number;
}

let tree: TreeModel | null = null;
/** Hauteur d'un conifère moyen dans le jeu (m) : le fichier d'origine en fait presque 18. */
export const TREE_MODEL_HEIGHT_M = 5.5;

export const treeModel = (): TreeModel | null => tree;
export const rockModel = (): BakedModel | null => bakedModel('pebbles');

/** Matériau du feuillage : texture peinte, les zones transparentes sont découpées. */
export const foliageMaterial = new THREE.MeshStandardMaterial({
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
  };
}

let loading: Promise<void> | null = null;

/** Charge (une seule fois) l'arbre et les cailloux ; un échec est ignoré. */
export function loadNature(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const dir = `${baseUrl}models/nature/`;
  const treeLoad = fetch(`${dir}tree.obj`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then(
      (text) =>
        new Promise<void>((resolve) => {
          const parsed = parseTree(text);
          new THREE.TextureLoader().load(
            `${dir}tree.png`,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              foliageMaterial.map = texture;
              foliageMaterial.needsUpdate = true;
              tree = parsed;
              resolve();
            },
            undefined,
            () => resolve(),
          );
        }),
    )
    .catch(() => undefined);
  const rocksLoad = new Promise<void>((resolve) => {
    new GLTFLoader().load(
      `${dir}pebbles.gltf`,
      (gltf) => {
        const model = bake(gltf.scene);
        if (model) registerModel('pebbles', model);
        resolve();
      },
      undefined,
      () => resolve(),
    );
  });
  loading = Promise.all([treeLoad, rocksLoad]).then(() => undefined);
  return loading;
}
