/**
 * Formes des objets posés au sol (`blender/scripts/objets.py`, fichiers `objet_<forme>.glb`) : une forme par sorte
 * d'objet (lingots, minerai, baril, paquet de science…), dont les faces magenta prennent la couleur de l'objet. Les
 * machines posées au sol (et le buggy, la balise) sont leur propre modèle en miniature.
 */
import * as THREE from 'three';
import { itemById } from '../core/data/items';
import { CARS, RAIL_ITEM, STATION_ITEM, carKindOfItem } from '../core/data/trains';
import { VEHICLES, vehicleKindOfItem } from '../core/data/vehicles';
import { baseOf } from '../core/data/itemData';
import { machineForItem, type MachineType } from '../core/data/machines';
import { MeshBuilder } from './meshBuilder';
import {
  DROP_SHAPES,
  ORE_FILE_NAMES,
  bakedModel,
  beltModel,
  modelFor,
  type BakedModel,
} from './models';

export type DropShape = (typeof DROP_SHAPES)[number];
export { DROP_SHAPES };

/** Équipement et munitions (`blender/scripts/equipement.py`) : forme propre. */
const EQUIPMENT_SHAPES: Record<string, DropShape> = {
  compass: 'boussole',
  backpack: 'sac_a_dos',
  hood: 'capuche',
  jacket: 'veste',
  trousers: 'pantalon',
  boots: 'bottes',
  gloves: 'gants',
  sleeping_bag: 'sac_couchage',
  bed: 'lit',
  magazine: 'chargeur_pistolet',
  rifle_magazine: 'chargeur_fusil',
  sniper_magazine: 'chargeur_sniper',
};
/** Pièces des armures 1 à 5 : une forme par palier et par emplacement (détails propres au palier), gantelets compris. */
const ARMOR_SHAPES = Object.fromEntries(
  ([1, 2, 3, 4, 5] as const).flatMap((n) =>
    (
      [
        ['head', 'casque'],
        ['torso', 'plastron'],
        ['legs', 'jambieres'],
        ['feet', 'bottes'],
        ['hands', 'gants'],
      ] as const
    ).map(([slot, shape]) => [`${n}_${slot}`, `armure${n}_${shape}` as DropShape]),
  ),
) as Record<string, DropShape>;

/** Objets intermédiaires des paliers 3 à 5 qui ont leur forme propre (`blender/scripts/objets.py`). */
const OWN_SHAPES: Record<string, DropShape> = {
  chassis_simple: 'chassis_simple',
  chassis_steel: 'chassis_renforce',
  chassis_alu: 'chassis_leger',
  chassis_composite: 'chassis_composite',
  glass: 'vitre',
  armored_glass: 'vitre_blindee',
  graphite: 'graphite',
  lithium_salt: 'sel_lithium',
  carbon_fiber: 'fibre_carbone',
  kit_circuit: 'kit_circuit',
  circuit_advanced: 'circuit_avance',
  microcontroller: 'microcontroleur',
  solar_cell: 'cellule_solaire',
  graphite_filter: 'filtre_graphite',
  battery_lithium: 'batterie_lithium',
  battery_portable: 'batterie_portable',
  aluminium_rod: 'tige',
  repair_kit: 'kit_reparation',
  fusion_capsule: 'capsule_fusion',
  supra_magnet: 'aimant_supra',
  quantum_crystal: 'cristal_quantique',
  deuterium: 'deuterium',
  tritium: 'tritium',
  liquid_nitrogen: 'azote_liquide',
  // Objets qui partageaient une forme : chacun la sienne.
  aluminium_ingot: 'lingot_alu',
  zamak_ingot: 'lingot_zamak',
  cable_insulated: 'cable',
  plastic_insulator: 'isolant',
  barrel_empty: 'baril_vide',
  barrel_water: 'baril_eau',
  barrel_oil: 'baril_petrole',
  crude_oil: 'petrole_brut',
  uranium_rod: 'barre_uranium',
  nuclear_waste: 'dechets_nucleaires',
};

/** Forme d'un objet du sac posé au sol (les machines ne sont pas ici : voir `dropMachine`). */
export function dropShape(itemId: string): DropShape {
  const item = baseOf(itemId);
  if (OWN_SHAPES[item]) return OWN_SHAPES[item];
  if (item === 'carapace') return 'carapace';
  if (item === 'living_tissue') return 'tissu_vivant';
  if (item === 'wood') return 'bois';
  if (item === 'stone' || item === 'crushed_stone' || item === 'slag') return 'caillou';
  if (/_ore(_washed)?$/.test(item) || item === 'uraninite' || item === 'coal' || item === 'bauxite')
    return 'minerai';
  if (item === 'silica_sand' || item === 'silicon_raw') return 'sable';
  if (item.endsWith('_ingot')) return 'lingot';
  if (item === 'mould_plate') return 'moule_plaque';
  if (item === 'mould_gear') return 'moule_engrenage';
  if (item === 'mould_wire') return 'moule_fil';
  if (item === 'iron_gear') return 'engrenage';
  if (item === 'copper_wire' || item === 'cable_insulated') return 'bobine';
  if (item.endsWith('_plate')) return 'plaque';
  if (item === 'fiber') return 'fibre';
  if (item === 'cloth') return 'tissu';
  if (item.startsWith('barrel_') || item === 'crude_oil') return 'baril';
  if (item === 'combat_pack') return 'science_combat';
  if (item.startsWith('science_pack')) {
    // Un flacon par palier : `science_pack` (T1), `science_pack_2` à `science_pack_5`.
    const tier = /^science_pack_([2-5])$/.exec(item)?.[1] ?? '1';
    return `science_${tier}` as DropShape;
  }
  if (item === 'silicon_chip' || item === 'plastic_insulator') return 'puce';
  if (item === 'concrete_block') return 'bloc';
  if (item.startsWith('uranium_') || item === 'nuclear_waste') return 'conteneur';
  if (item === 'contaminated_glass') return 'verre';
  if (item === 'rubber') return 'caoutchouc';
  if (item === 'iron_rod' || item === 'steel_rod' || item === 'aluminium_rod') return 'tige';
  if (item === 'motor') return 'moteur';
  if (item === 'motor_heavy') return 'moteur_renforce';
  if (item === 'res_water') return 'eau';
  if (item === 'exoskeleton') return 'exosquelette';
  if (item === 'jetpack') return 'propulseur';
  const own = EQUIPMENT_SHAPES[item];
  if (own) return own;
  const armor = /^armor(1|2|3|4|5)_(head|torso|legs|feet|hands)$/.exec(item);
  if (armor) return ARMOR_SHAPES[`${armor[1]}_${armor[2]}`];
  return 'caisse';
}

/** Taille (m) de la plus grande dimension d'une machine posée au sol. */
export const MINI_MACHINE_M = 0.45;

const MATERIAL_FILE: Record<string, string> = {
  wood: 'bois',
  stone: 'pierre',
  concrete: 'beton',
  aluminium: 'aluminium',
  armored: 'blinde',
};
/** Ressources du monde (objets `res_*` du mode Créatif) : modèle du décor qu'elles posent. */
const RESOURCE_MODELS: Record<string, string> = {
  res_tree: 'arbre_prairie_1',
  res_rock: 'rocher_prairie_1',
  res_fiber_bush: 'buisson_prairie_1',
  // Onglet « Ennemis » du mode Créatif.
  res_nest: 'nid',
  res_scout: 'ennemi_eclaireur',
  res_guard: 'ennemi_gardien',
  res_spitter: 'ennemi_cracheur',
};

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
  if (item === STATION_ITEM) return 'gare';
  if (item === 'piece_garage_aluminium') return 'porte_garage_aluminium';
  if (RESOURCE_MODELS[item]) return RESOURCE_MODELS[item];
  const ore = item.startsWith('res_') ? ORE_FILE_NAMES[item.slice(4)] : undefined;
  if (ore) return `minerai_${ore}_1`;
  const pipe = /^machine_pipe(?:_(\d))?$/.exec(item);
  if (pipe) return `tuyau_droit_t${pipe[1] ?? '1'}`;
  const piece =
    /^piece_(wall|door|stairs|slab|pillar)_(wood|stone|concrete|aluminium|armored)$/.exec(item);
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

/** Objets sans modèle 3D (ils gardent la caisse) : aucun pour l'instant, chaque objet a sa forme ou son modèle. */
export const NO_MODEL_ITEMS: readonly string[] = [];

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
  if (machine) {
    // Pièces mobiles (tourelle, bras, couvercle, rotor…) dans leur position de repos : sans elles, l'icône ne montrerait
    // que le socle. Même repère que le corps (son enveloppe sert de référence).
    for (const part of Object.values(model.groups ?? {}))
      b.model({ ...part, min: model.min, size: model.size }, 0, 0, 0, 0, k);
  }
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
