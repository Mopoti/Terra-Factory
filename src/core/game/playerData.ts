/**
 * Ce qui appartient à UN joueur et ce qui appartient au MONDE. Aujourd'hui tout est dans `WorldChanges` (un seul
 * joueur) ; en multijoueur l'hôte garde le monde et une fiche par joueur. Ces fonctions découpent et recollent les
 * deux sans changer le format des sauvegardes. Les technologies, les crédits et le sac sont « partagés » ou
 * « individuels » selon les réglages de la partie (`options.multiplayer.share`).
 */
import type { Inventory } from './inventory';
import type { WorldChanges } from './worldChanges';
import type { MultiplayerOptions } from '../save/saveIndex';

/** Toujours individuel : barre d'objets, outils, équipement, munitions, cadavres, réapparition, tutoriel. */
export const PLAYER_KEYS = [
  'hotbar',
  'tools',
  'equipment',
  'ammo',
  'rifleAmmo',
  'corpses',
  'nextCorpseId',
  'spawns',
  'nextSpawnId',
  'tutorialDone',
  'tutorialSkipped',
] as const satisfies readonly (keyof WorldChanges)[];

/** Individuel seulement si le partage est désactivé. */
export const RESEARCH_KEYS = [
  'unlocked',
  'researching',
  'progress',
  'packProgress',
] as const satisfies readonly (keyof WorldChanges)[];
export const CREDIT_KEYS = ['credits'] as const satisfies readonly (keyof WorldChanges)[];

export type PlayerKey =
  (typeof PLAYER_KEYS)[number] | (typeof RESEARCH_KEYS)[number] | (typeof CREDIT_KEYS)[number];

export type PlayerChanges = Partial<Pick<WorldChanges, PlayerKey>>;
export type WorldPart = Omit<WorldChanges, PlayerKey> & Partial<Pick<WorldChanges, PlayerKey>>;

/** Fiche d'un joueur : son nom, son sac (s'il n'est pas commun) et sa part individuelle des changements. */
export interface PlayerProfile {
  id: string;
  name: string;
  inventory: Inventory;
  changes: PlayerChanges;
}

/** Les champs individuels d'un joueur selon ce que la partie partage. */
export function perPlayerKeys(share: MultiplayerOptions['share']): PlayerKey[] {
  return [
    ...PLAYER_KEYS,
    ...(share.research ? [] : RESEARCH_KEYS),
    ...(share.credits ? [] : CREDIT_KEYS),
  ];
}

/** Sépare les changements : ce qui va dans la fiche du joueur, et le reste (le monde). Rien n'est copié en double. */
export function splitChanges(
  changes: WorldChanges,
  keys: readonly PlayerKey[] = PLAYER_KEYS,
): { world: WorldPart; player: PlayerChanges } {
  const player: Record<string, unknown> = {};
  const world: Record<string, unknown> = { ...changes };
  for (const key of keys) {
    player[key] = changes[key];
    delete world[key];
  }
  return { world: world as WorldPart, player: player as PlayerChanges };
}

/** Recolle un monde et la part d'un joueur en un `WorldChanges` complet (le monde fournit les valeurs manquantes). */
export function mergeChanges(world: WorldChanges, player: PlayerChanges): WorldChanges {
  return { ...world, ...player } as WorldChanges;
}
