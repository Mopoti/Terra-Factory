/** Constantes fondamentales du jeu. Toutes les grandeurs sont en unités SI (m, s, kg, ...). */

/** Cadence de la simulation : 20 ticks par seconde. */
export const TICK_RATE = 20;
export const TICK_SECONDS = 1 / TICK_RATE;

/** Pas fin de placement (10 cm), en mètres. Les positions sont stockées en entiers de ce pas. */
export const FINE_STEP_M = 0.1;
/** Case logistique (50 cm) = 5 pas fins. */
export const FINE_PER_CELL = 5;
export const CELL_SIZE_M = FINE_STEP_M * FINE_PER_CELL;

/** Convertit une position en pas fins (entier) vers des mètres. */
export function fineToMeters(fine: number): number {
  return fine * FINE_STEP_M;
}
