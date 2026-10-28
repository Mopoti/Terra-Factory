/**
 * Pose des pièces de voie, une à la fois, avec un patron (voir `docs/rails-refonte.md`) : près d'un bout de voie libre le
 * patron s'y colle et prend la forme que montre le curseur (droit, virage à gauche ou à droite, rampe) ; ailleurs il suit
 * la grille et un droit se tourne par pas de 45°.
 */
import { CELL_SIZE_M } from '../constants';
import { RAIL_COST } from '../data/trains';
import {
  RAMP_RISE_M,
  RAMP_RUN_M,
  headingDir,
  headingOf,
  lengthOf,
  mm,
  type Port,
  type RailKind,
  type RailPiece,
} from './track';

export interface RailCandidate {
  kind: RailKind;
  x: number;
  z: number;
  h: number;
  level: number;
  /** Rails consommés. */
  cost: number;
}

const candidate = (
  kind: RailKind,
  x: number,
  z: number,
  h: number,
  level: number,
): RailCandidate => ({
  kind,
  x: mm(x),
  z: mm(z),
  h: ((h % 8) + 8) % 8,
  level: mm(level),
  cost: RAIL_COST[kind],
});

/** Cap (0 à 7) dans lequel une voie repart d'un port : vers l'extérieur de la pièce qui le porte. */
export const headingOfPort = (port: Port): number => headingOf(port.dx, port.dz);

/**
 * Les pièces qu'on peut raccorder à un port libre : un droit, un virage à gauche ou à droite, et, si `tilt` ≠ 0 et que
 * la voie est le long d'un axe, une rampe qui monte (1) ou descend (−1).
 */
export function candidatesFrom(port: Port, tilt: -1 | 0 | 1 = 0): RailCandidate[] {
  const h = headingOfPort(port);
  if (tilt === 0)
    return [
      candidate('straight', port.x, port.z, h, port.y),
      candidate('curve_l', port.x, port.z, h, port.y),
      candidate('curve_r', port.x, port.z, h, port.y),
    ];
  if (h % 2 !== 0) return [];
  if (tilt > 0) return [candidate('ramp', port.x, port.z, h, port.y)];
  // Descente : la rampe se prend par son sommet, qui touche le port ; elle part en sens inverse.
  const d = headingDir(h);
  return [
    candidate(
      'ramp',
      port.x + d.dx * RAMP_RUN_M,
      port.z + d.dz * RAMP_RUN_M,
      h + 4,
      port.y - RAMP_RISE_M,
    ),
  ];
}

/** Parmi les pièces d'un port, celle que montre le curseur : tout droit près de l'axe, sinon le virage de ce côté. */
export function pickCandidate(
  cands: readonly RailCandidate[],
  port: Port,
  aim: { x: number; z: number },
): RailCandidate | null {
  if (cands.length === 0) return null;
  if (cands.length === 1) return cands[0];
  // La gauche d'une direction (dx, dz) est (dz, −dx) : le cap croît quand on tourne de ce côté.
  const lateral = (aim.x - port.x) * port.dz - (aim.z - port.z) * port.dx;
  const along = (aim.x - port.x) * port.dx + (aim.z - port.z) * port.dz;
  const straight = cands.find((c) => c.kind === 'straight');
  const left = cands.find((c) => c.kind === 'curve_l');
  const right = cands.find((c) => c.kind === 'curve_r');
  // Un curseur près de l'axe, ou presque entièrement devant le bout, veut le droit ; ailleurs, le virage de son côté.
  const side = Math.abs(lateral);
  if (straight && (side < 1.6 || side < 0.3 * Math.max(along, 0))) return straight;
  return (lateral > 0 ? left : right) ?? straight ?? cands[0];
}

/**
 * Un droit posé librement (loin de toute voie) : centré sur la case visée, au cap `h` (0 à 7) ; un droit en diagonale est
 * plus long, son milieu reste sur la grille de cases.
 */
export function freeCandidate(
  aim: { x: number; z: number },
  h: number,
  level: number,
): RailCandidate {
  const cx = (Math.floor(aim.x / CELL_SIZE_M) + 0.5) * CELL_SIZE_M;
  const cz = (Math.floor(aim.z / CELL_SIZE_M) + 0.5) * CELL_SIZE_M;
  const d = headingDir(h);
  const half = lengthOf('straight', h) / 2;
  return candidate('straight', cx - d.dx * half, cz - d.dz * half, h, level);
}

/** La pièce posée correspondant à un candidat (identifiant provisoire). */
export const pieceOf = (c: RailCandidate, id = -1): RailPiece => ({
  id,
  kind: c.kind,
  x: c.x,
  z: c.z,
  h: c.h,
  level: c.level,
});
