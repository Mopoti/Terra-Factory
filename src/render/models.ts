/**
 * Modèles 3D du jeu : le « Factory Kit » de Kenney (CC0, voir `public/models/kenney/License.txt`). Les fichiers glTF
 * sont chargés une fois, puis « cuits » en sommets colorés (la couleur est lue dans la palette du kit) pour être
 * fusionnés dans le maillage des machines, comme les formes simples. Tant qu'un modèle n'est pas chargé, la machine
 * garde sa forme de secours.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MachineType } from '../core/data/machines';

export interface BakedModel {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  /** Dimensions (m) et position du plus bas coin avant mise à l'échelle. */
  size: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
}

/** Modèle choisi pour chaque machine (les autres gardent leurs formes simples). */
export const MACHINE_MODELS: Partial<Record<MachineType, string>> = {
  furnace: 'machine-window',
  furnace_electric: 'machine-window-bar',
  stamper: 'piston-square',
  crusher: 'hopper-square',
  bessemer: 'hopper-high-round',
  mixer: 'piston-round',
  generator: 'machine-fortified',
  assembler: 'machine-window-bar',
  builder: 'machine-bed',
  lab: 'machine',
  heavy_press: 'piston-square',
  washer: 'machine-connection-pipe',
  plastic_press: 'piston-thin-round',
  centrifuge: 'piston-round',
  refinery: 'hopper-high-square',
  boiler: 'hopper-round',
  cooling_tower: 'hopper-high-round',
  evaporation_tower: 'hopper-high-round',
  vitrifier: 'machine-connection-hole',
  arm: 'robot-arm-a',
  arm_electric: 'robot-arm-a',
  arm_filter: 'robot-arm-b',
  chest_wood: 'box-small',
  chest_iron: 'box-large',
};

/** Modèles de tapis : droit et coude, pour chacun des 3 paliers (les pentes gardent leurs formes simples). */
export type BeltShape = 'straight' | 'corner';
const BELT_MODELS: Record<BeltShape, readonly [string, string, string]> = {
  straight: ['conveyor-sides', 'conveyor-sides', 'conveyor-stripe-sides'],
  corner: ['conveyor-corner', 'conveyor-corner', 'conveyor-stripe-corner'],
};
export const beltModel = (shape: BeltShape, tier: number): BakedModel | null =>
  baked.get(BELT_MODELS[shape][Math.max(0, Math.min(2, tier - 1))]) ?? null;

const NAMES = [
  ...new Set([...Object.values(MACHINE_MODELS), ...Object.values(BELT_MODELS).flat()]),
] as string[];
const baked = new Map<string, BakedModel>();
let loading: Promise<void> | null = null;

export const modelFor = (type: MachineType): BakedModel | null => {
  const name = MACHINE_MODELS[type];
  return name ? (baked.get(name) ?? null) : null;
};

/** Enregistre un modèle déjà préparé (tests, ou modèle fabriqué ailleurs). */
export const registerModel = (name: string, model: BakedModel): void => void baked.set(name, model);

/** Modèle déjà préparé sous ce nom (ou null). */
export const bakedModel = (name: string): BakedModel | null => baked.get(name) ?? null;

/** Y a-t-il déjà au moins un modèle prêt ? */
export const modelsReady = (): boolean => baked.size > 0;

/** Lit les couleurs de la palette du kit (image `colormap`) : un tableau RGBA et sa taille. */
function paletteOf(
  texture: THREE.Texture | null,
): { data: Uint8ClampedArray; w: number; h: number } | null {
  const image = texture?.image as CanvasImageSource & { width: number; height: number };
  if (!image || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    w: canvas.width,
    h: canvas.height,
  };
}

export function bake(root: THREE.Object3D): BakedModel | null {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as THREE.BufferGeometry;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const material = (
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    ) as THREE.MeshStandardMaterial;
    const palette = paletteOf(material.map);
    const base = pos.length / 3;
    const v = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      pos.push(v.x, v.y, v.z);
      if (n) {
        v.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
        nor.push(v.x, v.y, v.z);
      } else nor.push(0, 1, 0);
      if (palette && uv) {
        const x = Math.min(palette.w - 1, Math.max(0, Math.floor(uv.getX(i) * palette.w)));
        const y = Math.min(palette.h - 1, Math.max(0, Math.floor(uv.getY(i) * palette.h)));
        const k = (y * palette.w + x) * 4;
        // La palette est en sRGB ; les couleurs de sommet sont lues comme linéaires : on convertit pour garder les teintes.
        col.push(
          (palette.data[k] / 255) ** 2.2,
          (palette.data[k + 1] / 255) ** 2.2,
          (palette.data[k + 2] / 255) ** 2.2,
        );
      } else if (material.color) col.push(material.color.r, material.color.g, material.color.b);
      else col.push(0.6, 0.6, 0.7);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  });
  if (pos.length === 0) return null;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (let i = 0; i < pos.length; i += 3) {
    min.x = Math.min(min.x, pos[i]);
    max.x = Math.max(max.x, pos[i]);
    min.y = Math.min(min.y, pos[i + 1]);
    max.y = Math.max(max.y, pos[i + 1]);
    min.z = Math.min(min.z, pos[i + 2]);
    max.z = Math.max(max.z, pos[i + 2]);
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    colors: new Float32Array(col),
    index: new Uint32Array(idx),
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    min,
  };
}

/** Charge (une seule fois) les modèles utilisés ; les échecs sont ignorés : la machine garde sa forme simple. */
export function loadModels(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(
    NAMES.map(
      (name) =>
        new Promise<void>((resolve) => {
          loader.load(
            `${baseUrl}models/kenney/${name}.glb`,
            (gltf) => {
              const model = bake(gltf.scene);
              if (model) baked.set(name, model);
              resolve();
            },
            undefined,
            () => resolve(),
          );
        }),
    ),
  ).then(() => undefined);
  return loading;
}

/** Articulation d'un modèle : la partie haute (au-dessus de `split`, en part de la hauteur) est animée à part. */
export type AnimKind = 'press' | 'swing' | 'spin';
export const MACHINE_ANIM: Partial<Record<MachineType, { kind: AnimKind; split: number }>> = {
  stamper: { kind: 'press', split: 0.5 },
  heavy_press: { kind: 'press', split: 0.5 },
  plastic_press: { kind: 'press', split: 0.5 },
  arm: { kind: 'swing', split: 0.2 },
  arm_electric: { kind: 'swing', split: 0.2 },
  arm_filter: { kind: 'swing', split: 0.2 },
};

const splits = new Map<string, { low: BakedModel; high: BakedModel }>();

/** Coupe un modèle en deux (mêmes sommets, deux listes de triangles) selon la hauteur de leur centre. */
export function splitModel(
  model: BakedModel,
  split: number,
): { low: BakedModel; high: BakedModel } {
  const limit = model.min.y + model.size.y * split;
  const low: number[] = [];
  const high: number[] = [];
  for (let k = 0; k < model.index.length; k += 3) {
    const a = model.index[k];
    const b = model.index[k + 1];
    const c = model.index[k + 2];
    const y =
      (model.positions[a * 3 + 1] + model.positions[b * 3 + 1] + model.positions[c * 3 + 1]) / 3;
    (y > limit ? high : low).push(a, b, c);
  }
  return {
    low: { ...model, index: new Uint32Array(low) },
    high: { ...model, index: new Uint32Array(high) },
  };
}

/** Les deux parties d'un modèle articulé, ou null si la machine n'a pas d'animation ou si son modèle n'est pas prêt. */
export function animatedParts(
  type: MachineType,
): { kind: AnimKind; low: BakedModel; high: BakedModel } | null {
  const anim = MACHINE_ANIM[type];
  const name = MACHINE_MODELS[type];
  const model = modelFor(type);
  if (!anim || !name || !model) return null;
  let parts = splits.get(name + anim.split);
  if (!parts) {
    parts = splitModel(model, anim.split);
    splits.set(name + anim.split, parts);
  }
  return { kind: anim.kind, ...parts };
}
