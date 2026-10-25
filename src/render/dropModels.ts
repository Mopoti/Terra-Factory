/**
 * Formes des objets posés au sol (`blender/scripts/objets.py`, fichiers `objet_<forme>.glb`) : une forme par sorte
 * d'objet (lingots, minerai, baril, paquet de science…), dont les faces magenta prennent la couleur de l'objet. Les
 * machines posées au sol (et le buggy, la balise) sont leur propre modèle en miniature.
 */
import * as THREE from 'three';
import { itemById } from '../core/data/items';
import { CARS, RAIL_ITEM, carKindOfItem } from '../core/data/trains';
import { VEHICLES, vehicleKindOfItem } from '../core/data/vehicles';
import { machineForItem, type MachineType } from '../core/data/machines';
import { MeshBuilder } from './meshBuilder';
import { DROP_SHAPES, bakedModel, beltModel, modelFor, type BakedModel } from './models';

export type DropShape = (typeof DROP_SHAPES)[number];
export { DROP_SHAPES };

/** Forme d'un objet du sac posé au sol (les machines ne sont pas ici : voir `dropMachine`). */
export function dropShape(item: string): DropShape {
  if (item === 'carapace') return 'carapace';
  if (item === 'living_tissue') return 'tissu_vivant';
  if (item === 'wood') return 'bois';
  if (item === 'stone' || item === 'crushed_stone' || item === 'slag') return 'caillou';
  if (/_ore(_washed)?$/.test(item) || item === 'uraninite' || item === 'coal' || item === 'bauxite')
    return 'minerai';
  if (item === 'silica_sand' || item === 'silicon_raw') return 'sable';
  if (item.endsWith('_ingot')) return 'lingot';
  if (item === 'iron_gear' || item === 'mould_gear') return 'engrenage';
  if (item === 'copper_wire' || item === 'cable_insulated' || item === 'mould_wire')
    return 'bobine';
  if (item.endsWith('_plate')) return 'plaque';
  if (item === 'fiber') return 'fibre';
  if (item === 'cloth') return 'tissu';
  if (item.startsWith('barrel_') || item === 'crude_oil') return 'baril';
  if (item.startsWith('science_pack') || item === 'combat_pack') return 'science';
  if (item === 'silicon_chip' || item === 'plastic_insulator') return 'puce';
  if (item === 'concrete_block') return 'bloc';
  if (item.startsWith('uranium_') || item === 'nuclear_waste') return 'conteneur';
  if (item === 'contaminated_glass') return 'verre';
  return 'caisse';
}

/** Taille (m) de la plus grande dimension d'une machine posée au sol. */
export const MINI_MACHINE_M = 0.45;

const MATERIAL_FILE: Record<string, string> = { wood: 'bois', stone: 'pierre' };

/**
 * Modèle maison propre à un objet qui n'est ni une machine ni une forme générique : véhicule, matériel roulant, rail,
 * tuyau, pièce de construction. Null pour les autres.
 */
export function iconModelName(item: string): string | null {
  const vehicle = vehicleKindOfItem(item);
  if (vehicle) return VEHICLES[vehicle].model;
  const car = carKindOfItem(item);
  if (car) return CARS[car].model;
  if (item === RAIL_ITEM) return 'rail_droit';
  const pipe = /^machine_pipe(?:_(\d))?$/.exec(item);
  if (pipe) return `tuyau_droit_t${pipe[1] ?? '1'}`;
  const piece = /^piece_(wall|door|stairs|slab|pillar)_(wood|stone)$/.exec(item);
  if (piece) {
    const mat = MATERIAL_FILE[piece[2]];
    return {
      wall: `mur_${mat}`,
      door: `porte_${mat}`,
      stairs: `escalier_${mat}`,
      slab: `dalle_${mat}`,
      pillar: `pilier_${mat}_seul`,
    }[piece[1] as 'wall'];
  }
  return null;
}

/** Objets sans modèle 3D pour l'instant (vêtements, munitions, outils de couchage…) : ils gardent la caisse. */
export const NO_MODEL_ITEMS: readonly string[] = [
  'train_station',
  'compass',
  'backpack',
  'hood',
  'trousers',
  'boots',
  'gloves',
  'sleeping_bag',
  'bed',
  'magazine',
  'rifle_magazine',
  'sniper_magazine',
  'rubber',
  'iron_rod',
  'steel_rod',
  'motor',
  'motor_heavy',
  ...['armor1', 'armor2', 'armor4'].flatMap((a) =>
    ['head', 'torso', 'legs', 'feet'].map((s) => `${a}_${s}`),
  ),
];

/** Outils et armes tenus : fichier du modèle et façon de le charger. */
export const HELD_MODELS: Record<string, { kind: 'pick' | 'weapon'; file: string }> = {
  tool_stone: { kind: 'pick', file: 'terra/pioche_hache_pierre' },
  tool_iron: { kind: 'pick', file: 'terra/pioche_hache' },
  pistol: { kind: 'weapon', file: 'pistolet' },
  rifle: { kind: 'weapon', file: 'fusil' },
  sniper: { kind: 'weapon', file: 'sniper' },
};

/** Modèle (en miniature) d'une machine, du buggy ou d'une balise posés au sol ; null si ce n'est pas une machine. */
export function dropMachine(item: string): BakedModel | null {
  const own = iconModelName(item);
  if (own) return bakedModel(own);
  const def = machineForItem(item);
  if (!def) return null;
  const type = def.id as MachineType;
  if (type === 'conveyor')
    return beltModel('straight', Math.max(1, (def.tierItems ?? []).indexOf(item) + 1));
  return modelFor(type);
}

/** Formes trop petites à côté des autres une fois au sol : on les grossit. */
const SHAPE_SCALE: Partial<Record<DropShape, number>> = { minerai: 1.5, caillou: 1.5 };

const MAGENTA = (r: number, g: number, b: number): boolean => r > 0.95 && g < 0.05 && b > 0.95;

/**
 * Géométrie d'une pile posée au sol (centrée, posée sur y = 0), ou null tant que le modèle n'est pas chargé.
 * `count` grossit un peu la pile.
 */
export function dropGeometry(item: string, count: number): THREE.BufferGeometry | null {
  const machine = dropMachine(item);
  const shape = machine ? null : bakedModel(`objet_${dropShape(item)}`);
  const model = machine ?? shape;
  if (!model) return null;
  const b = new MeshBuilder();
  let k = 1 + Math.min(0.25, Math.log10(Math.max(1, count)) * 0.12);
  if (!machine) k *= SHAPE_SCALE[dropShape(item)] ?? 1;
  if (machine) k = MINI_MACHINE_M / Math.max(model.size.x, model.size.y, model.size.z, 1e-6);
  b.model(model, 0, 0, 0, 0, k);
  if (shape) {
    // Les faces magenta prennent la couleur de l'objet.
    // Couleur de l'objet en linéaire, comme les couleurs des modèles.
    const c = new THREE.Color(itemById(item).color);
    for (let i = 0; i < b.colors.length; i += 3) {
      if (MAGENTA(b.colors[i], b.colors[i + 1], b.colors[i + 2])) {
        b.colors[i] = c.r;
        b.colors[i + 1] = c.g;
        b.colors[i + 2] = c.b;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  g.computeBoundingSphere();
  return g;
}
