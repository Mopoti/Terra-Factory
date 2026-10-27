import raw from '../../../content/techs.json';
import legacyRaw from '../../../content/techs_legacy.json';
import { ITEMS } from './items';

export interface TechDef {
  id: string;
  /** Objets du sac consommés à la recherche. */
  cost: Record<string, number>;
  requires: string[];
  /** Palier : 0 (payé en ressources) à 5. */
  tier: number;
  /** Technologies à avoir recherchées pour faire apparaître celle-ci (palier ≥ 2 ; par défaut `requires`). */
  reveal?: string[];
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

/** Visible dans la fenêtre : palier 1, déjà recherchée, ou technologie du palier inférieur recherchée. Tout en Créatif. */
export function isTechVisible(
  tech: TechDef,
  researched: readonly string[],
  creative: boolean,
): boolean {
  if (creative || tech.tier <= 1 || researched.includes(tech.id)) return true;
  return (tech.reveal ?? tech.requires).every((r) => researched.includes(r));
}

export const SCIENCE_PACK = 'science_pack';
/**
 * Paquets de science : un par palier, T1 à T5. Le paquet Tn se fabrique avec des éléments du palier précédent ; un objet
 * ou une technologie de palier n coûte des paquets Tn et T(n-1) (palier 1 : paquets T1 seuls).
 */
export const SCIENCE_PACKS = [
  'science_pack',
  'science_pack_2',
  'science_pack_3',
  'science_pack_4',
  'science_pack_5',
  /** Paquet de combat : à part des paliers, fabriqué avec les dépouilles des ennemis (carapaces, tissu vivant). */
  'combat_pack',
] as const;
export const isSciencePack = (item: string | null | undefined): boolean =>
  !!item && (SCIENCE_PACKS as readonly string[]).includes(item);

/** Paquets de science (par type) qu'une technologie demande à étudier en laboratoire. */
export const packCost = (tech: TechDef): Record<string, number> =>
  Object.fromEntries(Object.entries(tech.cost).filter(([item]) => isSciencePack(item)));

/** Total de paquets à étudier (0 = recherche à la main avec des objets). */
export const scienceCost = (tech: TechDef): number =>
  Object.values(packCost(tech)).reduce((a, b) => a + b, 0);

/**
 * Technologies de tier 1 découpées (2 objets au plus chacune) : une ancienne sauvegarde qui avait recherché l'ancienne
 * technologie garde tout ce qu'elle débloquait.
 */
export const LEGACY_TECH_SPLITS: Record<string, string[]> = {
  logistics: ['handling', 'routing'],
  power_generation: ['electricity_2', 'power_generation_2'],
  electricity: ['power_generation', 'laboratory'],
  steam: ['steam_power'],
  textile: ['clothing', 'handwear', 'bedding'],
};

/** Découvertes connues parmi `ids` (sans rien ajouter). */
export const knownTechs = (ids: readonly unknown[]): string[] => {
  const have = new Set(ids);
  return TECHS.map((t) => t.id).filter((id) => have.has(id));
};

/** Identifiants des anciennes technologies (avant les découvertes), avec ceux d'avant leur découpage. */
export function expandLegacyIds(ids: readonly unknown[]): Set<unknown> {
  const have = new Set<unknown>(ids);
  for (const [old, parts] of Object.entries(LEGACY_TECH_SPLITS))
    if (have.has(old)) for (const p of parts) have.add(p);
  return have;
}

/**
 * Découvertes d'une partie qui avait des technologies : une découverte est acquise si tous les objets qu'elle débloque
 * étaient déjà fabricables (aucune technologie, ou technologie recherchée). Les prérequis suivent toujours.
 */
export function discoveriesFromLegacy(oldIds: readonly unknown[]): string[] {
  const researched = expandLegacyIds(oldIds);
  const gated = new Set(legacyRaw.techs.flatMap((t) => t.unlocks));
  const available = new Set(ITEMS.map((i) => i.id).filter((id) => !gated.has(id)));
  for (const t of legacyRaw.techs)
    if (researched.has(t.id)) for (const u of t.unlocks) available.add(u);
  const got = new Set(
    TECHS.filter((t) =>
      t.unlocks.length > 0 ? t.unlocks.every((u) => available.has(u)) : researched.has(t.id),
    ).map((t) => t.id),
  );
  const add = (id: string): void => {
    for (const r of techById(id).requires)
      if (!got.has(r)) {
        got.add(r);
        add(r);
      }
  };
  for (const id of [...got]) add(id);
  return TECHS.map((t) => t.id).filter((id) => got.has(id));
}

/** Durée de base (en secondes) pour qu'un laboratoire consomme un paquet. */
export const LAB_PACK_SECONDS = 5;
/** Paquets accélérés par les technologies « Recherche » : le niveau n retire 1 s aux paquets des paliers 1 à n. */
const LAB_TIERED_PACKS = [
  'science_pack',
  'science_pack_2',
  'science_pack_3',
  'science_pack_4',
  'science_pack_5',
];

/** Niveau de recherche atteint (0 à 4) d'après les technologies déjà recherchées. */
export function labResearchLevel(researched: readonly string[]): number {
  let level = 0;
  while (level < 4 && researched.includes(`research_${level + 1}`)) level++;
  return level;
}

/** Secondes qu'un laboratoire met à consommer un paquet de ce type, selon le niveau de recherche. */
export function labPackSeconds(item: string, level: number): number {
  const tier = LAB_TIERED_PACKS.indexOf(item);
  if (tier < 0 || tier >= level) return LAB_PACK_SECONDS;
  return LAB_PACK_SECONDS - (level - tier);
}
