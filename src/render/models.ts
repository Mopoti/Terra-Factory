/**
 * Modèles 3D du jeu : le « Factory Kit » de Kenney (CC0, voir `public/models/kenney/License.txt`). Les fichiers glTF
 * sont chargés une fois, puis « cuits » en sommets colorés (la couleur est lue dans la palette du kit) pour être
 * fusionnés dans le maillage des machines, comme les formes simples. Tant qu'un modèle n'est pas chargé, la machine
 * garde sa forme de secours.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MachineType } from '../core/data/machines';
import { motionGroups } from './partMotions';

export interface BakedModel {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  /** Dimensions (m) et position du plus bas coin avant mise à l'échelle. */
  size: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
  /** Parties animées à part (maillages dont le nom commence par un préfixe de `ANIMATED_MESHES`), absentes des tableaux ci-dessus. */
  flames?: FlameParts;
  /** Groupes de pièces mobiles (`MOTIONS` dans `partMotions.ts`), absents des tableaux ci-dessus, par nom de groupe. */
  groups?: Record<string, PartGroup>;
}

/** Pièces d'un groupe mobile : maillage propre (repère du modèle) et pivot lu dans le nœud `pivot_<groupe>` du `.glb`. */
export interface PartGroup {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  pivot: { x: number; y: number; z: number };
  /** Axe de rotation (ou de glissement) : l'axe Y local du nœud pivot. */
  axis: { x: number; y: number; z: number };
}

/** Un maillage animé (une flamme) : plage de sommets dans `FlameParts` et son pied (point autour duquel il vacille). */
export interface FlameGroup {
  first: number;
  count: number;
  px: number;
  py: number;
  pz: number;
}

/** Maillages animés d'un modèle, dans le repère du modèle (mêmes unités et même origine que `BakedModel`). */
export interface FlameParts {
  positions: Float32Array;
  colors: Float32Array;
  /** Triangles, indices dans `positions` (sommets propres à cette partie). */
  index: Uint32Array;
  groups: FlameGroup[];
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

/**
 * Modèles faits pour le jeu (Blender, dossier `blender/` ; fichiers `.glb` dans `export/`, copiés dans
 * `public/models/terra/` par `node scripts/sync-modeles.mjs`). Ils passent avant ceux du kit.
 */
export const TERRA_MODELS: Partial<Record<MachineType, string>> = {
  drill: 'foreuse_t1',
  drill_electric: 'foreuse_electrique_t2',
  drill_eco: 'foreuse_eco_t3',
  furnace: 'fourneau_t1',
  furnace_electric: 'fourneau_electrique_t2',
  pumpjack: 'chevalet_t2',
  arm: 'bras_t1',
  arm_electric: 'bras_t2',
  arm_filter: 'bras_t3',
  splitter: 'separateur',
  merger: 'groupeur',
  sorter: 'trieur',
  stamper: 'estampeuse_t1',
  assembler: 'assembleur_t2',
  crusher: 'concasseur_t1',
  bessemer: 'convertisseur_t2',
  mixer: 'betonniere_t2',
  washer: 'station_lavage_t2',
  builder: 'constructeur_t2',
  heavy_press: 'presse_lourde_t3',
  refinery: 'raffinerie_t3',
  centrifuge: 'centrifugeuse_t4',
};

/**
 * Convention : dans un modèle maison, les maillages dont le NOM (ou celui d'un de leurs parents) commence par l'un de ces
 * préfixes sont animés à part par le jeu (voir `FlameParts`) et ne font pas partie du corps fixe de la machine.
 * Fourneau : `flamme_*` (cônes orange) et `coeur_*` (cœurs jaunes).
 */
export const ANIMATED_MESHES: Partial<Record<MachineType, readonly string[]>> = {
  furnace: ['flamme', 'coeur'],
  bessemer: ['flamme', 'coeur'],
  refinery: ['flamme', 'coeur'],
  washer: ['jet', 'ruissellement'],
};

/** Préfixes animés du modèle de ce nom (machines qui l'utilisent dans `TERRA_MODELS`). */
const prefixesOf = (name: string): string[] =>
  (Object.keys(TERRA_MODELS) as MachineType[])
    .filter((t) => TERRA_MODELS[t] === name)
    .flatMap((t) => ANIMATED_MESHES[t] ?? []);

/** Groupes mobiles du modèle de ce nom (voir `MOTIONS`). */
const groupsOf = (name: string): string[] =>
  (Object.keys(TERRA_MODELS) as MachineType[])
    .filter((t) => TERRA_MODELS[t] === name)
    .flatMap((t) => motionGroups(t));

/**
 * Modèles de tapis : droit et coude, pour chacun des 3 paliers (les pentes gardent leurs formes simples). Le coude existe
 * dans les deux sens (`corner` : entrée côté −x, sortie côté +z ; `cornerBack` : l'inverse), car les modèles maison
 * portent des flèches ; ceux du kit sont les mêmes dans les deux sens.
 */
export type BeltShape = 'straight' | 'corner' | 'cornerBack';
const BELT_MODELS: Record<BeltShape, readonly [string, string, string]> = {
  straight: ['conveyor-sides', 'conveyor-sides', 'conveyor-stripe-sides'],
  corner: ['conveyor-corner', 'conveyor-corner', 'conveyor-stripe-corner'],
  cornerBack: ['conveyor-corner', 'conveyor-corner', 'conveyor-stripe-corner'],
};
/**
 * Tapis maison (Blender, `blender/scripts/logistique.py`), par forme et palier : `null` = pas encore fait, on garde
 * celui du kit. Mêmes conventions que le kit : tuile de 1 m, dessus à `BELT_H` (20 cm), le droit circule vers +x, le
 * coude relie les côtés −x et +z. Leurs lames en flèche montrent le sens du tapis.
 */
const TERRA_BELT_MODELS: Record<BeltShape, readonly [string | null, string | null, string | null]> =
  {
    straight: ['convoyeur_t1', 'convoyeur_t2', 'convoyeur_t3'],
    corner: ['convoyeur_virage_t1', 'convoyeur_virage_t2', 'convoyeur_virage_t3'],
    cornerBack: [
      'convoyeur_virage_inverse_t1',
      'convoyeur_virage_inverse_t2',
      'convoyeur_virage_inverse_t3',
    ],
  };
export const beltModel = (shape: BeltShape, tier: number): BakedModel | null => {
  const t = Math.max(0, Math.min(2, tier - 1));
  const own = TERRA_BELT_MODELS[shape][t];
  return (own ? baked.get(own) : undefined) ?? baked.get(BELT_MODELS[shape][t]) ?? null;
};

const TERRA_NAMES = [
  ...new Set([
    ...Object.values(TERRA_MODELS),
    ...Object.values(TERRA_BELT_MODELS)
      .flat()
      .filter((n): n is string => n !== null),
  ]),
] as string[];
const NAMES = [
  ...new Set([...Object.values(MACHINE_MODELS), ...Object.values(BELT_MODELS).flat()]),
] as string[];
const baked = new Map<string, BakedModel>();
let loading: Promise<void> | null = null;

export const modelFor = (type: MachineType): BakedModel | null => {
  // Le modèle maison s'il est chargé, sinon celui du kit (un .glb absent ou en échec ne laisse pas la machine nue).
  const own = TERRA_MODELS[type];
  const kit = MACHINE_MODELS[type];
  return (own ? baked.get(own) : undefined) ?? (kit ? (baked.get(kit) ?? null) : null);
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

/** Le maillage ou l'un de ses parents porte-t-il un nom commençant par un des préfixes ? */
function hasAnimatedName(obj: THREE.Object3D, prefixes: readonly string[]): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    const n = o.name.toLowerCase();
    if (n && prefixes.some((p) => n.startsWith(p))) return true;
  }
  return false;
}

/** Le maillage appartient-il à ce groupe ? (`foret`, `foret_mandrin`, `foret_mandrin003`… ; pas `foretage`) */
function inGroup(name: string, group: string): boolean {
  const n = name.toLowerCase();
  if (!n.startsWith(group)) return false;
  const rest = n.slice(group.length);
  return rest === '' || rest[0] === '_' || /^\d+$/.test(rest);
}

export function bake(
  root: THREE.Object3D,
  animated: readonly string[] = [],
  groupNames: readonly string[] = [],
): BakedModel | null {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const fPos: number[] = [];
  const fCol: number[] = [];
  const fIdx: number[] = [];
  const groups: FlameGroup[] = [];
  root.updateMatrixWorld(true);
  // Pivots : nœuds `pivot_<groupe>` (le chargeur retire les points des noms, l'exporteur ajoute parfois « 002 »).
  const pivots = new Map<string, { pivot: THREE.Vector3; axis: THREE.Vector3 }>();
  root.traverse((o) => {
    if (!o.name.toLowerCase().startsWith('pivot_')) return;
    const key = o.name
      .toLowerCase()
      .slice(6)
      .replace(/\d{3}$/, '');
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    o.matrixWorld.decompose(p, q, new THREE.Vector3());
    pivots.set(key, { pivot: p, axis: new THREE.Vector3(0, 1, 0).applyQuaternion(q) });
  });
  const byLength = [...groupNames].sort((a, b) => b.length - a.length);
  const parts = new Map<string, { pos: number[]; nor: number[]; col: number[]; idx: number[] }>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const flame = animated.length > 0 && hasAnimatedName(mesh, animated);
    const group = flame ? undefined : byLength.find((g) => inGroup(mesh.name, g));
    let part = group ? parts.get(group) : undefined;
    if (group && !part) {
      part = { pos: [], nor: [], col: [], idx: [] };
      parts.set(group, part);
    }
    const g = mesh.geometry as THREE.BufferGeometry;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const material = (
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    ) as THREE.MeshStandardMaterial;
    const palette = paletteOf(material.map);
    const tPos = flame ? fPos : (part?.pos ?? pos);
    const tCol = flame ? fCol : (part?.col ?? col);
    const tIdx = flame ? fIdx : (part?.idx ?? idx);
    const tNor = part?.nor ?? nor;
    const base = tPos.length / 3;
    const v = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      tPos.push(v.x, v.y, v.z);
      if (!flame) {
        if (n) {
          v.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
          tNor.push(v.x, v.y, v.z);
        } else tNor.push(0, 1, 0);
      }
      if (palette && uv) {
        const x = Math.min(palette.w - 1, Math.max(0, Math.floor(uv.getX(i) * palette.w)));
        const y = Math.min(palette.h - 1, Math.max(0, Math.floor(uv.getY(i) * palette.h)));
        const k = (y * palette.w + x) * 4;
        // La palette est en sRGB ; les couleurs de sommet sont lues comme linéaires : on convertit pour garder les teintes.
        tCol.push(
          (palette.data[k] / 255) ** 2.2,
          (palette.data[k + 1] / 255) ** 2.2,
          (palette.data[k + 2] / 255) ** 2.2,
        );
      } else if (material.color) tCol.push(material.color.r, material.color.g, material.color.b);
      else tCol.push(0.6, 0.6, 0.7);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) tIdx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) tIdx.push(base + i);
    if (flame) {
      // Pied de la flamme : centre de son emprise, au plus bas.
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      let y0 = Infinity;
      for (let i = base; i < base + p.count; i++) {
        x0 = Math.min(x0, fPos[i * 3]);
        x1 = Math.max(x1, fPos[i * 3]);
        y0 = Math.min(y0, fPos[i * 3 + 1]);
        z0 = Math.min(z0, fPos[i * 3 + 2]);
        z1 = Math.max(z1, fPos[i * 3 + 2]);
      }
      groups.push({ first: base, count: p.count, px: (x0 + x1) / 2, py: y0, pz: (z0 + z1) / 2 });
    }
  });
  if (pos.length === 0 && fPos.length === 0 && parts.size === 0) return null;
  // L'enveloppe couvre tout le modèle, flammes comprises : l'échelle dans le jeu reste celle voulue par l'auteur.
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const list of [pos, fPos, ...[...parts.values()].map((x) => x.pos)]) {
    for (let i = 0; i < list.length; i += 3) {
      min.x = Math.min(min.x, list[i]);
      max.x = Math.max(max.x, list[i]);
      min.y = Math.min(min.y, list[i + 1]);
      max.y = Math.max(max.y, list[i + 1]);
      min.z = Math.min(min.z, list[i + 2]);
      max.z = Math.max(max.z, list[i + 2]);
    }
  }
  const model: BakedModel = {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    colors: new Float32Array(col),
    index: new Uint32Array(idx),
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    min,
  };
  if (parts.size > 0) {
    model.groups = {};
    for (const [name, g] of parts) {
      // Sans nœud pivot, le groupe tourne autour du centre de ses pièces, axe vertical.
      let found = pivots.get(name);
      if (!found) {
        const c = new THREE.Vector3();
        for (let i = 0; i < g.pos.length; i += 3)
          c.add(new THREE.Vector3(g.pos[i], g.pos[i + 1], g.pos[i + 2]));
        found = {
          pivot: c.multiplyScalar(3 / Math.max(1, g.pos.length)),
          axis: new THREE.Vector3(0, 1, 0),
        };
      }
      model.groups[name] = {
        positions: new Float32Array(g.pos),
        normals: new Float32Array(g.nor),
        colors: new Float32Array(g.col),
        index: new Uint32Array(g.idx),
        pivot: { x: found.pivot.x, y: found.pivot.y, z: found.pivot.z },
        axis: { x: found.axis.x, y: found.axis.y, z: found.axis.z },
      };
    }
  }
  if (groups.length > 0)
    model.flames = {
      positions: new Float32Array(fPos),
      colors: new Float32Array(fCol),
      index: new Uint32Array(fIdx),
      groups,
    };
  return model;
}

/** Charge (une seule fois) les modèles utilisés ; les échecs sont ignorés : la machine garde sa forme simple. */
export function loadModels(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(
    [
      ...NAMES.map((name) => ({ name, folder: 'kenney' })),
      ...TERRA_NAMES.map((name) => ({ name, folder: 'terra' })),
    ].map(
      ({ name, folder }) =>
        new Promise<void>((resolve) => {
          loader.load(
            `${baseUrl}models/${folder}/${name}.glb`,
            (gltf) => {
              const model = bake(gltf.scene, prefixesOf(name), groupsOf(name));
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
  // Seul le modèle du kit est coupé à mi-hauteur. Un modèle maison (`TERRA_MODELS`) garde ses pièces entières : ses
  // pièces mobiles sont des groupes à part (voir blender/ANIMATIONS.md). Sans ce test, la découpe du modèle maison
  // était aussi mise en cache sous le nom du kit, partagé par d'autres machines (l'estampeuse prêtait son modèle à la
  // presse lourde, à la mauvaise échelle).
  if (model !== baked.get(name)) return null;
  let parts = splits.get(name + anim.split);
  if (!parts) {
    parts = splitModel(model, anim.split);
    splits.set(name + anim.split, parts);
  }
  return { kind: anim.kind, ...parts };
}
