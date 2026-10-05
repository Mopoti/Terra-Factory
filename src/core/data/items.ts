import raw from '../../../content/items.json';

export interface ItemDef {
  id: string;
  /** Poids d'une unité, en grammes (entier : pas d'erreurs d'arrondi). */
  weightG: number;
  /** Volume d'une unité, en millilitres. */
  volumeMl: number;
  color: string;
}

export interface BagLimits {
  maxWeightG: number;
  maxVolumeMl: number;
}

export const ITEMS: ItemDef[] = raw.items.map((i) => ({
  id: i.id,
  weightG: Math.round(i.weightKg * 1000),
  volumeMl: Math.round(i.volumeL * 1000),
  color: i.color,
}));

export const BAG_LIMITS: BagLimits = {
  maxWeightG: Math.round(raw.bag.maxWeightKg * 1000),
  maxVolumeMl: Math.round(raw.bag.maxVolumeL * 1000),
};

/** Portée de la récolte à la main, en mètres. */
export const REACH_M: number = raw.reachM;

export function itemById(id: string): ItemDef {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Objet inconnu : ${id}`);
  return found;
}
