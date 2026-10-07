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
  /** Combustible : énergie libérée par 1 unité, en mégajoules (absent = n'est pas un combustible). */
  energyMJ: number | null;
  /** Équipement porté : emplacement du corps et bonus de capacité du sac. */
  equip: { slot: EquipSlot; bonus: { slots: number; weightG: number; volumeMl: number } } | null;
  /** Outil (case d'outils) : multiplicateur de vitesse de récolte et unités obtenues par coup. */
  tool: { speed: number; yield: number } | null;
}

export type EquipSlot = 'head' | 'torso' | 'legs' | 'feet' | 'hands';
/** Ordre d'affichage : de la tête aux pieds. */
export const EQUIP_SLOTS: EquipSlot[] = ['head', 'torso', 'hands', 'legs', 'feet'];

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
  energyMJ?: number;
  tool?: { speed: number; yield: number };
  equip?: { slot: EquipSlot; bag?: { slots?: number; weightKg?: number; volumeL?: number } };
}

export const ITEMS: ItemDef[] = (raw.items as RawItem[]).map((i) => ({
  id: i.id,
  weightG: Math.round(i.weightKg * 1000),
  volumeMl: Math.round(i.volumeL * 1000),
  color: i.color,
  recipe: i.recipe ?? null,
  energyMJ: i.energyMJ ?? null,
  tool: i.tool ?? null,
  equip: i.equip
    ? {
        slot: i.equip.slot,
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

export type ItemCategory = 'machines' | 'tools' | 'buildings' | 'equipment';
export const ITEM_CATEGORIES: ItemCategory[] = ['machines', 'tools', 'buildings', 'equipment'];

/**
 * Catégorie d'un objet dans le panneau de fabrication : constructions (pièces), machines, équipements
 * (ce qui se porte), et « ustensiles » pour tout le reste (matières, lingots, fibres, tissu…).
 */
export function categoryOf(item: ItemDef): ItemCategory {
  if (item.id.startsWith('piece_')) return 'buildings';
  if (item.id.startsWith('machine_')) return 'machines';
  if (item.equip) return 'equipment';
  return 'tools';
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
/** Puissance consommée par un buggy qui roule (kW) : un charbon (9 MJ) = 50 s de route. */
export const VEHICLE_BURN_KW = 180;
