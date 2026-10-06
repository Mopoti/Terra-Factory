/**
 * Saisons : le temps de jeu (secondes, enregistré avec la partie) fait tourner printemps, été, automne, hiver.
 * Effets : couleur du sol et du ciel, et absorption de la pollution par les arbres (moins l'automne et l'hiver,
 * donc plus de pollution qui s'attarde et des nids plus actifs).
 */

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Season {
  id: SeasonId;
  /** Multiplicateur de couleur du sol (r, g, b). */
  ground: [number, number, number];
  /** Voile clair ajouté au sol (neige). */
  snow: [number, number, number];
  /** Couleur du ciel et du brouillard. */
  sky: number;
  /** Part de l'absorption normale des arbres. */
  treeAbsorb: number;
}

export const SEASONS: Season[] = [
  { id: 'spring', ground: [0.95, 1.08, 0.95], snow: [0, 0, 0], sky: 0x9cc7e2, treeAbsorb: 1 },
  { id: 'summer', ground: [1, 1, 1], snow: [0, 0, 0], sky: 0x8fb8d8, treeAbsorb: 1.2 },
  { id: 'autumn', ground: [1.25, 0.95, 0.7], snow: [0, 0, 0], sky: 0xb7b3a6, treeAbsorb: 0.7 },
  {
    id: 'winter',
    ground: [0.6, 0.64, 0.7],
    snow: [0.5, 0.52, 0.56],
    sky: 0xc8d3dc,
    treeAbsorb: 0.35,
  },
];

/** Durée d'une saison (secondes de jeu) : 6 minutes, soit une année de 24 minutes. */
export const SEASON_LENGTH_S = 360;

/** Saison au temps `time` (s) : la saison, son numéro dans l'année, le jour de la saison (à partir de 1) et l'année. */
export function seasonAt(time: number): { season: Season; day: number; year: number } {
  const t = Math.max(0, time);
  const index = Math.floor(t / SEASON_LENGTH_S);
  const season = SEASONS[index % SEASONS.length];
  // Une saison dure 6 minutes = 6 « jours » d'une minute.
  const day = Math.floor((t % SEASON_LENGTH_S) / 60) + 1;
  return { season, day, year: Math.floor(index / SEASONS.length) + 1 };
}
