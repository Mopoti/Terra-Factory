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
