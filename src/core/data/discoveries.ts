import raw from '../../../content/discoveries.json';

export interface DiscoveryDef {
  id: string;
  harvest: { item: string; count: number };
  unlocks: string[];
}

export const DISCOVERIES: DiscoveryDef[] = raw.discoveries as DiscoveryDef[];

/** La découverte qui débloque cet objet, ou null s'il n'en dépend pas. */
export const discoveryFor = (item: string): DiscoveryDef | null =>
  DISCOVERIES.find((d) => d.unlocks.includes(item)) ?? null;
