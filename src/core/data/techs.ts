import raw from '../../../content/techs.json';

export interface TechDef {
  id: string;
  /** Objets du sac consommés à la recherche. */
  cost: Record<string, number>;
  requires: string[];
  /** Objets dont la fabrication est débloquée. */
  unlocks: string[];
}

export const TECHS: TechDef[] = raw.techs as unknown as TechDef[];

export function techById(id: string): TechDef {
  const found = TECHS.find((t) => t.id === id);
  if (!found) throw new Error(`Technologie inconnue : ${id}`);
  return found;
}

/** Technologie qui débloque cet objet, ou null s'il est disponible dès le départ. */
export const techFor = (item: string): TechDef | null =>
  TECHS.find((t) => t.unlocks.includes(item)) ?? null;

export const SCIENCE_PACK = 'science_pack';
/** Paquets de science par palier : valeur en études (provisoire, avant le tableau type × tier). */
export const SCIENCE_PACKS: Record<string, number> = { science_pack: 1, science_pack_3: 3 };
export const isSciencePack = (item: string | null | undefined): boolean =>
  !!item && item in SCIENCE_PACKS;
export const packValue = (item: string): number => SCIENCE_PACKS[item] ?? 0;

/** Paquets de science qu'une technologie demande à étudier en laboratoire (0 = recherche à la main). */
export const scienceCost = (tech: TechDef): number => tech.cost[SCIENCE_PACK] ?? 0;
