import { CELL_SIZE_M } from '../constants';
import { LAYERS_PER_STOREY, LAYER_HEIGHT_M, STOREY_HEIGHT_M, THICKNESS_M } from '../data/buildings';
import { pieceKey, type Pieces } from '../build/pieces';

/** Hauteur de marche : une marche plus basse se monte sans sauter (dalle de sol de 10 cm). */
export const STEP_UP_M = 0.35;
export const GRAVITY_M_S2 = 22;
/** Vitesse de saut : environ 1,1 m de hauteur, soit 2 blocs de mur de 50 cm. */
export const JUMP_SPEED_M_S = 7;

/** Épaisseur de la dalle d'un plafond ou d'un sol. */
const SLAB_M = THICKNESS_M;
/** Au-dessus d'un mur, la dalle dépasse de 5 mm (évite que deux faces se confondent à l'écran). */
export const SLAB_LIFT_M = 0.005;

export interface Span {
  bottom: number;
  top: number;
}

/**
 * Solides à la verticale du point (x, z), pour un joueur dont les pieds sont à `feetY` : blocs de mur
 * (si le point est à moins de `wallMargin` de la ligne d'un bord), sols et plafonds de la case. Les portes
 * laissent passer. Seuls les étages proches des pieds sont examinés.
 */
export function spansAt(
  pieces: Pieces,
  x: number,
  z: number,
  feetY: number,
  wallMargin: number,
): Span[] {
  const spans: Span[] = [];
  const level0 = Math.floor(feetY / STOREY_HEIGHT_M);
  const gx = Math.floor(x / CELL_SIZE_M);
  const gz = Math.floor(z / CELL_SIZE_M);
  const gxn = Math.round(x / CELL_SIZE_M);
  const gzn = Math.round(z / CELL_SIZE_M);
  const nearZ = Math.abs(x - gxn * CELL_SIZE_M) <= wallMargin; // ligne d'un bord le long de z
  const nearX = Math.abs(z - gzn * CELL_SIZE_M) <= wallMargin; // ligne d'un bord le long de x
  for (let level = Math.max(0, level0 - 1); level <= level0 + 1; level++) {
    const y0 = level * STOREY_HEIGHT_M;
    for (let layer = 0; layer < LAYERS_PER_STOREY; layer++) {
      const wall =
        (nearZ &&
          pieces[pieceKey({ slot: 'edge', level, gx: gxn, gz, axis: 'z', layer })]?.startsWith(
            'wall',
          )) ||
        (nearX &&
          pieces[pieceKey({ slot: 'edge', level, gx, gz: gzn, axis: 'x', layer })]?.startsWith(
            'wall',
          ));
      if (wall)
        spans.push({ bottom: y0 + layer * LAYER_HEIGHT_M, top: y0 + (layer + 1) * LAYER_HEIGHT_M });
      if (pieces[pieceKey({ slot: 'ceiling', level, gx, gz, layer })]) {
        const top = y0 + (layer + 1) * LAYER_HEIGHT_M + SLAB_LIFT_M;
        spans.push({ bottom: top - SLAB_M, top });
      }
    }
    if (pieces[pieceKey({ slot: 'floor', level, gx, gz })])
      spans.push({ bottom: y0, top: y0 + SLAB_M });
  }
  return spans;
}

/** Le corps (hauteur `height`, pieds à `feetY`) est-il arrêté par un solide à ce point ? */
export function bodyBlocked(
  pieces: Pieces,
  x: number,
  z: number,
  feetY: number,
  height: number,
): boolean {
  return spansAt(pieces, x, z, feetY, THICKNESS_M / 2 + 0.02).some(
    (s) => s.top > feetY + STEP_UP_M && s.bottom < feetY + height,
  );
}

/**
 * Hauteur du sol sous un point : le dessus le plus haut qu'on peut atteindre (au plus `STEP_UP_M` au-dessus
 * des pieds), sinon le terrain (0). On est plus indulgent pour se tenir sur la tranche d'un mur fin.
 */
export function groundAt(pieces: Pieces, x: number, z: number, feetY: number): number {
  let ground = 0;
  for (const s of spansAt(pieces, x, z, feetY, 0.2)) {
    if (s.top <= feetY + STEP_UP_M && s.top > ground) ground = s.top;
  }
  return ground;
}

/** Plus bas dessous de solide au-dessus de la tête (pour s'y cogner en sautant), ou Infinity. */
export function ceilingAbove(
  pieces: Pieces,
  x: number,
  z: number,
  headY: number,
  feetY: number,
): number {
  let lowest = Infinity;
  for (const s of spansAt(pieces, x, z, feetY, THICKNESS_M / 2 + 0.02)) {
    if (s.bottom >= headY - 0.02 && s.bottom < lowest) lowest = s.bottom;
  }
  return lowest;
}

export interface Body {
  y: number;
  vy: number;
  onGround: boolean;
}

/**
 * Un pas de physique verticale. `ground` = hauteur du sol sous les pieds, `roof` = plus bas dessous au-dessus
 * de la tête. Le saut n'est possible qu'au sol.
 */
export function stepVertical(
  body: Body,
  dt: number,
  ground: number,
  roof: number,
  height: number,
  jump: boolean,
): Body {
  let { y, vy } = body;
  if (jump && body.onGround) vy = JUMP_SPEED_M_S;
  vy -= GRAVITY_M_S2 * dt;
  y += vy * dt;
  if (vy > 0 && y + height > roof) {
    y = roof - height;
    vy = 0;
  }
  if (y <= ground) return { y: ground, vy: 0, onGround: true };
  return { y, vy, onGround: false };
}
