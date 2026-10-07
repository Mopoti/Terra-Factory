import { CELL_SIZE_M } from '../constants';
import {
  RISE_DIR,
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  STOREY_HEIGHT_M,
  THICKNESS_M,
} from '../data/buildings';
import { pieceKey, type Pieces } from '../build/pieces';
import { pieceDef, type Material } from '../data/buildings';

/** Hauteur de marche : une marche plus basse se monte sans sauter (dalle de sol de 10 cm). */
export const STEP_UP_M = 0.35;
export const GRAVITY_M_S2 = 22;
/** Vitesse de saut : environ 1,1 m de hauteur, soit 2 blocs de mur de 50 cm. */
export const JUMP_SPEED_M_S = 7;

/** Épaisseur de la dalle d'un plafond ou d'un sol. */
const SLAB_M = THICKNESS_M;
/** Au-dessus d'un mur, la dalle dépasse de 3 mm (évite que deux faces se confondent à l'écran). */
export const SLAB_LIFT_M = 0.003;

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
    // Une porte fermée barre tout le passage ; ouverte, elle laisse passer.
    const doors: Array<[boolean, string, string]> = [
      [
        nearZ,
        pieceKey({ slot: 'edge', level, gx: gxn, gz, axis: 'z', layer: 0 }),
        `o:${level}:${gxn},${gz}:z`,
      ],
      [
        nearX,
        pieceKey({ slot: 'edge', level, gx, gz: gzn, axis: 'x', layer: 0 }),
        `o:${level}:${gx},${gzn}:x`,
      ],
    ];
    for (const [near, key, open] of doors) {
      if (near && pieces[key]?.startsWith('door') && !pieces[open]) {
        spans.push({ bottom: y0, top: y0 + STOREY_HEIGHT_M });
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
  /** Distance parcourue pendant ce pas : sur une pente à 45°, on monte autant qu'on avance. */
  slack = 0,
): boolean {
  return (
    spansAt(pieces, x, z, feetY, THICKNESS_M / 2 + 0.02).some(
      (s) => s.top > feetY + STEP_UP_M && s.bottom < feetY + height,
    ) || stairTops(pieces, x, z, feetY).some((top) => top > feetY + STEP_UP_M + slack)
  );
}

/**
 * Hauteur du sol sous un point : le dessus le plus haut qu'on peut atteindre (au plus `STEP_UP_M` au-dessus
 * des pieds), sinon le terrain (0). On est plus indulgent pour se tenir sur la tranche d'un mur fin.
 */
export function groundAt(
  pieces: Pieces,
  x: number,
  z: number,
  feetY: number,
  /** Distance parcourue pendant ce pas (voir `bodyBlocked`). */
  slack = 0,
): number {
  let ground = 0;
  const spans = spansAt(pieces, x, z, feetY, 0.2);
  for (const s of spans) {
    // Le dessus d'un bloc recouvert par un autre bloc (murs empilés) n'est pas un appui : sinon on resterait
    // accroché à mi-hauteur contre un mur de deux blocs au lieu de le monter d'un saut.
    if (spans.some((o) => o !== s && Math.abs(o.bottom - s.top) < 0.02)) continue;
    if (s.top <= feetY + STEP_UP_M && s.top > ground) ground = s.top;
  }
  for (const top of stairTops(pieces, x, z, feetY)) {
    if (top <= feetY + STEP_UP_M + slack && top > ground) ground = top;
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

/**
 * Hauteurs de dessus des escaliers sous le point (x, z) pour des pieds à `feetY` : chaque marche monte de
 * 50 cm sur sa case, dans le sens de son orientation.
 */
export function stairTops(pieces: Pieces, x: number, z: number, feetY: number): number[] {
  const tops: number[] = [];
  const gx = Math.floor(x / CELL_SIZE_M);
  const gz = Math.floor(z / CELL_SIZE_M);
  const fx = x / CELL_SIZE_M - gx;
  const fz = z / CELL_SIZE_M - gz;
  const level0 = Math.floor(feetY / STOREY_HEIGHT_M);
  for (let level = Math.max(0, level0 - 1); level <= level0 + 1; level++) {
    for (let layer = 0; layer < LAYERS_PER_STOREY; layer++) {
      for (let rot = 0; rot < 4; rot++) {
        if (!pieces[pieceKey({ slot: 'stairs', level, gx, gz, layer, rot })]) continue;
        const [dx, dz] = RISE_DIR[rot];
        // Avancement 0 (bas) à 1 (haut) le long de la montée.
        const along = dx !== 0 ? (dx > 0 ? fx : 1 - fx) : dz > 0 ? fz : 1 - fz;
        tops.push(level * STOREY_HEIGHT_M + (layer + along) * LAYER_HEIGHT_M);
      }
    }
  }
  return tops;
}

/**
 * Distance jusqu'au premier objet de construction touché par un rayon (mur, dalle, escalier), ou Infinity.
 * Sert à ne pas viser ni récolter à travers un mur.
 */
export function rayHitPiece(
  pieces: Pieces,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist: number,
): number {
  if (Object.keys(pieces).length === 0) return Infinity;
  for (let t = 0.1; t <= maxDist; t += 0.05) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    if (y < 0) return Infinity;
    // Épaisseur d'un mur (10 cm) plus une marge : le rayon avance par pas de 5 cm.
    if (spansAt(pieces, x, z, y, THICKNESS_M / 2 + 0.01).some((s) => y >= s.bottom && y <= s.top)) {
      return t;
    }
    if (stairTops(pieces, x, z, y).some((top) => y <= top && y >= top - LAYER_HEIGHT_M)) return t;
  }
  return Infinity;
}

/**
 * Matériau de la construction sur laquelle les pieds reposent (pour le bruit des pas), ou null si on est sur le
 * terrain.
 */
export function surfaceMaterialAt(
  pieces: Pieces,
  x: number,
  z: number,
  feetY: number,
): Material | null {
  if (feetY < 0.02) return null;
  const near = (top: number): boolean => Math.abs(top - feetY) < 0.12;
  const gx = Math.floor(x / CELL_SIZE_M);
  const gz = Math.floor(z / CELL_SIZE_M);
  const fx = x / CELL_SIZE_M - gx;
  const fz = z / CELL_SIZE_M - gz;
  const level = Math.floor(feetY / STOREY_HEIGHT_M);
  const y0 = level * STOREY_HEIGHT_M;
  const material = (key: string): Material | null => {
    const kind = pieces[key];
    return kind ? pieceDef(kind).material : null;
  };
  for (let layer = 0; layer < LAYERS_PER_STOREY; layer++) {
    const top = y0 + (layer + 1) * LAYER_HEIGHT_M;
    if (near(top + SLAB_LIFT_M)) {
      const m = material(pieceKey({ slot: 'ceiling', level, gx, gz, layer }));
      if (m) return m;
    }
    if (near(top)) {
      // Tranche d'un mur : le bord le plus proche du point.
      const edges: Array<[string, number]> = [
        [pieceKey({ slot: 'edge', level, gx, gz, axis: 'x', layer }), fz],
        [pieceKey({ slot: 'edge', level, gx, gz: gz + 1, axis: 'x', layer }), 1 - fz],
        [pieceKey({ slot: 'edge', level, gx, gz, axis: 'z', layer }), fx],
        [pieceKey({ slot: 'edge', level, gx: gx + 1, gz, axis: 'z', layer }), 1 - fx],
      ];
      for (const [key] of edges.sort((a, b) => a[1] - b[1])) {
        const m = material(key);
        if (m) return m;
      }
    }
    for (let rot = 0; rot < 4; rot++) {
      const m = material(pieceKey({ slot: 'stairs', level, gx, gz, layer, rot }));
      if (m && near(y0 + (layer + 0.5) * LAYER_HEIGHT_M)) return m;
    }
  }
  if (near(y0 + SLAB_M)) return material(pieceKey({ slot: 'floor', level, gx, gz }));
  return null;
}
