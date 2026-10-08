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
/** Paquets de science : T1, T2, T3 (un par palier ; le T4 viendra avec la fission). */
export const SCIENCE_PACKS = [
  'science_pack',
  'science_pack_2',
  'science_pack_3',
  'science_pack_4',
] as const;
export const isSciencePack = (item: string | null | undefined): boolean =>
  !!item && (SCIENCE_PACKS as readonly string[]).includes(item);

/** Paquets de science (par type) qu'une technologie demande à étudier en laboratoire. */
export const packCost = (tech: TechDef): Record<string, number> =>
  Object.fromEntries(Object.entries(tech.cost).filter(([item]) => isSciencePack(item)));

/** Total de paquets à étudier (0 = recherche à la main avec des objets). */
export const scienceCost = (tech: TechDef): number =>
  Object.values(packCost(tech)).reduce((a, b) => a + b, 0);
