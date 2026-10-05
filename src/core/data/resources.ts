import raw from '../../../content/resources.json';
import type { BiomeId } from '../world/biomes';

export type FamilyId = 'forests' | 'rocks' | 'ores' | 'water' | 'enemies';
export type BiomeTable = Record<BiomeId, number>;

interface Base {
  id: string;
  family: FamilyId;
  color: string;
}
export interface ObjectResource extends Base {
  kind: 'object';
  /** Quantité récoltable (bois, pierre…). */
  amount: number;
  /** Probabilité qu'un emplacement de 1 m × 1 m contienne cet objet DANS un bosquet / affleurement, par biome. */
  biomeDensity: BiomeTable;
  /** Part du terrain occupée par des bosquets / affleurements, par biome (×1 = moitié du terrain à fréquence ×1). */
  biomeCover: BiomeTable;
  /** Taille des bosquets / affleurements : longueur d'onde du bruit (m). */
  clusterWavelengthM: number;
  /** Fraction de la densité hors des bosquets (arbres isolés, 0 = aucun). */
  outsideFactor: number;
}
interface PatchBase extends Base {
  candidateSizeM: number;
  presence: number;
  radiusM: [number, number];
  biomeWeight: BiomeTable;
}
export interface DepositResource extends PatchBase {
  kind: 'deposit';
  centerAmount: number;
  edgeRatio: number;
  richness: [number, number];
}
export interface PondResource extends PatchBase {
  kind: 'pond';
}
export interface NestResource extends Base {
  kind: 'nest';
  candidateSizeM: number;
  presence: number;
  footprintCells: number;
  minDistanceFromSpawnM: number;
  biomeWeight: BiomeTable;
}
export type Resource = ObjectResource | DepositResource | PondResource | NestResource;

export const FAMILY_IDS = raw.families as FamilyId[];
export const RESOURCES = raw.resources as Resource[];

export function resourceById(id: string): Resource {
  const found = RESOURCES.find((r) => r.id === id);
  if (!found) throw new Error(`Ressource inconnue : ${id}`);
  return found;
}
