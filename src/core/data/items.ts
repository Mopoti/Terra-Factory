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
  /** Combustible : secondes de fonctionnement d'une machine pour 1 unité (absent = n'est pas un combustible). */
  fuelSeconds: number | null;
}

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
  fuelSeconds?: number;
}

export const ITEMS: ItemDef[] = (raw.items as RawItem[]).map((i) => ({
  id: i.id,
  weightG: Math.round(i.weightKg * 1000),
  volumeMl: Math.round(i.volumeL * 1000),
  color: i.color,
  recipe: i.recipe ?? null,
  fuelSeconds: i.fuelSeconds ?? null,
}));

export const BAG_LIMITS: BagLimits = {
  maxWeightG: Math.round(raw.bag.maxWeightKg * 1000),
  maxVolumeMl: Math.round(raw.bag.maxVolumeL * 1000),
  maxSlots: raw.bag.slots,
  stackMax: raw.bag.stackMax,
};

/** Portée de la récolte à la main, en mètres. */
export const REACH_M: number = raw.reachM;

export function itemById(id: string): ItemDef {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Objet inconnu : ${id}`);
  return found;
}
