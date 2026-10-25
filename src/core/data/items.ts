import raw from '../../../content/items.json';

export interface ItemDef {
  id: string;
  /** Poids d'une unité, en grammes (entier : pas d'erreurs d'arrondi). */
  weightG: number;
  /** Volume d'une unité, en millilitres. */
  volumeMl: number;
  color: string;
  /** Fabrication à la main : objet -> quantité nécessaire pour 1 unité. `null` = ressource brute. */
  recipe: Record<string, number> | null;
  /** Onglet du panneau de fabrication (absent : l'objet ne se fabrique pas à la main). */
  category: ItemCategory | null;
  /** Unités obtenues par fabrication (1 par défaut ; ex. 1 plaque de cuivre → 2 tuyaux). */
  yield: number;
  /** Combustible : énergie libérée par 1 unité, en mégajoules (absent = n'est pas un combustible). */
  energyMJ: number | null;
  /** Équipement porté : emplacement du corps et bonus de capacité du sac. */
  equip: {
    slot: EquipSlot;
    bonus: { slots: number; weightG: number; volumeMl: number };
    /** Protection (en %) : réduit les dégâts reçus (somme des pièces portées, plafonnée). */
    armor: number;
  } | null;
  /** Outil (case d'outils) : multiplicateur de vitesse de récolte et unités obtenues par coup. */
  tool: { speed: number; yield: number } | null;
  /** Objet du mode Créatif seulement (onglet « Ressources ») : invisible et non fabricable en Survie. */
  creativeOnly: boolean;
  /** Taille d'une pile (sac et coffres). */
  stack: number;
}

export type EquipSlot = 'head' | 'torso' | 'back' | 'legs' | 'feet' | 'hands';
/** Ordre d'affichage : de la tête aux pieds. */
export const EQUIP_SLOTS: EquipSlot[] = ['head', 'torso', 'back', 'hands', 'legs', 'feet'];

export interface BagLimits {
  maxWeightG: number;
  maxVolumeMl: number;
  /** Nombre de cases du sac et taille maximale d'une pile. */
  maxSlots: number;
  stackMax: number;
}

interface RawItem {
  id: string;
  weightKg: number;
  volumeL: number;
  color: string;
  recipe?: Record<string, number>;
  yield?: number;
  category?: ItemCategory;
  energyMJ?: number;
  tool?: { speed: number; yield: number };
  creative?: boolean;
  /** Taille d'une pile dans le sac et les coffres (défaut : celle du sac). */
  stack?: number;
  equip?: {
    slot: EquipSlot;
    bag?: { slots?: number; weightKg?: number; volumeL?: number };
    armor?: number;
  };
}

export const ITEMS: ItemDef[] = (raw.items as RawItem[]).map((i) => ({
  id: i.id,
  weightG: Math.round(i.weightKg * 1000),
  volumeMl: Math.round(i.volumeL * 1000),
  color: i.color,
  recipe: i.recipe ?? null,
  category: i.category ?? null,
  yield: i.yield ?? 1,
  energyMJ: i.energyMJ ?? null,
  tool: i.tool ?? null,
  creativeOnly: i.creative === true,
  stack: Math.max(1, Math.floor(i.stack ?? raw.bag.stackMax)),
  equip: i.equip
    ? {
        slot: i.equip.slot,
        armor: i.equip.armor ?? 0,
        bonus: {
          slots: i.equip.bag?.slots ?? 0,
          weightG: Math.round((i.equip.bag?.weightKg ?? 0) * 1000),
          volumeMl: Math.round((i.equip.bag?.volumeL ?? 0) * 1000),
        },
      }
    : null,
}));

export const BAG_LIMITS: BagLimits = {
  maxWeightG: Math.round(raw.bag.maxWeightKg * 1000),
  maxVolumeMl: Math.round(raw.bag.maxVolumeL * 1000),
  maxSlots: raw.bag.slots,
  stackMax: raw.bag.stackMax,
};

/** Onglets du panneau de fabrication (par usage) ; l'ordre est celui des onglets. */
export const ITEM_CATEGORIES = [
  'extraction',
  'smelting',
  'machining',
  'logistics',
  'fluids',
  'energy',
  'science',
  'buildings',
  'industrial',
  'equipment',
  'armor',
  'tools',
  'rail',
  'vehicles',
  'resources',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Onglet d'un objet fabricable (champ `category` de `items.json`) ; les autres objets n'en ont pas. */
export function categoryOf(item: ItemDef): ItemCategory | null {
  return item.category;
}

/**
 * Mode Créatif : ressource du monde que pose un objet de l'onglet « Ressources » (`res_<ressource>` : `res_iron_ore`,
 * `res_tree`, `res_water`…), ou null.
 */
export const creativeResourceOf = (item: string | null): string | null =>
  item && item.startsWith('res_') ? item.slice(4) : null;

/**
 * Mode Créatif, onglet « Ressources » : l'objet brut qui va avec chaque case de ressource (`res_<ressource>`), pour
 * les montrer côte à côte (le charbon à côté de la case de charbon).
 */
export const RESOURCE_PARTNER: Record<string, string> = {
  res_iron_ore: 'iron_ore',
  res_copper_ore: 'copper_ore',
  res_zinc_ore: 'zinc_ore',
  res_coal: 'coal',
  res_bauxite: 'bauxite',
  res_stone_ore: 'stone',
  res_uraninite: 'uraninite',
  res_sand: 'silica_sand',
  res_oil: 'crude_oil',
  res_tree: 'wood',
  res_fiber_bush: 'fiber',
};

/** Les objets d'un onglet, avec chaque objet brut juste après sa case de ressource (voir `RESOURCE_PARTNER`). */
export function withPartnersBeside<T extends { id: string }>(list: readonly T[]): T[] {
  const partners = new Set(Object.values(RESOURCE_PARTNER));
  const byId = new Map(list.map((i) => [i.id, i]));
  const out: T[] = [];
  for (const i of list) {
    const partner = RESOURCE_PARTNER[i.id];
    if (
      partners.has(i.id) &&
      [...Object.entries(RESOURCE_PARTNER)].some(([k, v]) => v === i.id && byId.has(k))
    )
      continue; // il sera placé après sa case
    out.push(i);
    const mate = partner ? byId.get(partner) : undefined;
    if (mate) out.push(mate);
  }
  return out;
}

/** Portée de la récolte à la main, en mètres. */
export const REACH_M: number = raw.reachM;

export function itemById(id: string): ItemDef {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Objet inconnu : ${id}`);
  return found;
}

/** Énergie d'une unité de combustible en kilojoules (0 si l'objet ne brûle pas). */
export const energyKJ = (item: string): number => (itemById(item).energyMJ ?? 0) * 1000;
