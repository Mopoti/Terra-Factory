import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  RISE_DIR,
  STOREY_HEIGHT_M,
  THICKNESS_M,
  pieceDef,
  resolveKind,
  type PieceKind,
} from '../data/buildings';
import { isFree, parseKey, posFor, slabPos, type PiecePos, type Pieces } from './pieces';
import { pickPiece } from './pick';

type Vec = { x: number; y: number; z: number };

/** La case du sol (ou d'un plan horizontal à la hauteur `y`) sous un rayon. */
export function cellOnPlane(origin: Vec, dir: Vec, y: number): { gx: number; gz: number } | null {
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (y - origin.y) / dir.y;
  if (t < 0 || t > 200) return null;
  return {
    gx: Math.floor((origin.x + dir.x * t) / CELL_SIZE_M),
    gz: Math.floor((origin.z + dir.z * t) / CELL_SIZE_M),
  };
}

/** Sens de montée (0 à 3) le plus proche d'une direction horizontale. */
export function riseFromDirection(dx: number, dz: number): number {
  let best = 0;
  let bestDot = -Infinity;
  RISE_DIR.forEach(([rx, rz], i) => {
    const dot = rx * dx + rz * dz;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  });
  return best;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Distance d'un point à une boîte (0 s'il est dedans). */
function boxDist(p: Vec, b: Box): number {
  const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1);
  const dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
  const dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
  return Math.hypot(dx, dy, dz);
}

const BLOCK = LAYER_HEIGHT_M;
const HALF = THICKNESS_M / 2;

/** Boîte occupée par une pièce à `pos` : un bloc de mur, une porte, une dalle ou un cube d'escalier. */
export function pieceBox(pos: PiecePos, type: 'wall' | 'door' | 'slab' | 'stairs'): Box {
  const y0 = pos.level * STOREY_HEIGHT_M;
  const x = pos.gx * CELL_SIZE_M;
  const z = pos.gz * CELL_SIZE_M;
  if (pos.slot === 'edge') {
    const yb = y0 + (type === 'door' ? 0 : (pos.layer ?? 0) * BLOCK);
    const yt = type === 'door' ? y0 + STOREY_HEIGHT_M : yb + BLOCK;
    return pos.axis === 'x'
      ? { x0: x, x1: x + CELL_SIZE_M, y0: yb, y1: yt, z0: z - HALF, z1: z + HALF }
      : { x0: x - HALF, x1: x + HALF, y0: yb, y1: yt, z0: z, z1: z + CELL_SIZE_M };
  }
  if (pos.slot === 'stairs') {
    const yb = y0 + (pos.layer ?? 0) * BLOCK;
    return { x0: x, x1: x + CELL_SIZE_M, y0: yb, y1: yb + BLOCK, z0: z, z1: z + CELL_SIZE_M };
  }
  // Dalle : épaisseur de 10 cm au-dessus de sa face (sol) ou sur le haut du bloc (plafond).
  const top = pos.slot === 'floor' ? y0 + THICKNESS_M : y0 + ((pos.layer ?? 0) + 1) * BLOCK + 0.003;
  return { x0: x, x1: x + CELL_SIZE_M, y0: top - THICKNESS_M, y1: top, z0: z, z1: z + CELL_SIZE_M };
}

/** Pièce à poser, selon le type et la hauteur absolue (en blocs depuis le sol). */
function candidatePos(
  kind: PieceKind,
  type: 'wall' | 'door' | 'slab' | 'stairs',
  gx: number,
  gz: number,
  hy: number,
  axis: 'x' | 'z',
  rot: number,
): PiecePos {
  const level = Math.floor(hy / LAYERS_PER_STOREY);
  const layer = hy % LAYERS_PER_STOREY;
  if (type === 'slab') {
    const s = slabPos(hy, gx, gz);
    return posFor(resolveKind(kind, s.slot), s.level, gx, gz, undefined, s.layer);
  }
  if (type === 'stairs') return posFor(kind, level, gx, gz, undefined, layer, rot);
  if (type === 'door') return posFor(kind, level, gx, gz, axis, 0);
  return posFor(kind, level, gx, gz, axis, layer);
}

export interface Aim {
  pos: PiecePos;
  /** Case sous le curseur, dans le plan de la pièce (pour étendre un rectangle en glissant). */
  cell: { gx: number; gz: number };
  /** Point touché par le rayon (m). */
  hit: Vec;
}

/**
 * Vise l'emplacement où poser une pièce, pour **tous** les types et tous les cas, avec une seule règle : on suit le
 * rayon jusqu'à la première surface touchée (pièce déjà posée, terrain, ou plan de construction à la hauteur
 * `planeY` si rien n'est touché), puis on choisit l'emplacement **libre le plus proche du point touché** parmi les
 * emplacements possibles de cette pièce (faces de blocs de 50 cm). Rien ne dépend de ce qui est dessous ou à côté :
 * une pièce peut se poser n'importe où, flottante comprise.
 */
export function aimBuild(
  origin: Vec,
  dir: Vec,
  pieces: Pieces,
  kind: PieceKind,
  planeY: number,
  maxDist: number,
  lockAxis?: 'x' | 'z',
  forcedRot?: number | null,
): Aim | null {
  const def = pieceDef(kind);
  const type = def.type === 'floor' || def.type === 'ceiling' ? 'slab' : def.type;
  const rot = forcedRot ?? riseFromDirection(dir.x, dir.z);
  // Première surface touchée.
  const candidates: number[] = [];
  const piece = pickPiece(pieces, origin, dir, maxDist);
  if (piece) candidates.push(piece.t);
  if (dir.y < -1e-6) {
    const tGround = (0 - origin.y) / dir.y;
    if (tGround > 0) candidates.push(tGround);
    const tPlane = (planeY - origin.y) / dir.y;
    if (planeY > 0 && tPlane > 0) candidates.push(tPlane);
  } else if (dir.y > 1e-6 && planeY > origin.y) {
    candidates.push((planeY - origin.y) / dir.y);
  }
  const t = candidates.length > 0 ? Math.min(...candidates) : null;
  if (t === null || t > maxDist) return null;
  const hit = {
    x: origin.x + dir.x * t,
    y: Math.max(0, origin.y + dir.y * t),
    z: origin.z + dir.z * t,
  };
  // Point juste avant la surface, du côté de l'œil : sert à départager deux emplacements équidistants.
  const eye = {
    x: origin.x + dir.x * Math.max(0, t - 0.06),
    y: origin.y + dir.y * Math.max(0, t - 0.06),
    z: origin.z + dir.z * Math.max(0, t - 0.06),
  };
  const gx0 = Math.floor(hit.x / CELL_SIZE_M);
  const gz0 = Math.floor(hit.z / CELL_SIZE_M);
  const hy0 = Math.floor(hit.y / BLOCK);
  const axes: ('x' | 'z')[] = lockAxis ? [lockAxis] : ['x', 'z'];
  let best: { pos: PiecePos; d: number; e: number } | null = null;
  const consider = (pos: PiecePos): void => {
    if (!isFree(pieces, kind, pos)) return;
    const box = pieceBox(pos, type);
    const d = boxDist(hit, box);
    const e = boxDist(eye, box);
    if (!best || d < best.d - 0.03 || (Math.abs(d - best.d) <= 0.03 && e < best.e)) {
      best = { pos, d, e };
    }
  };
  for (let gx = gx0 - 2; gx <= gx0 + 3; gx++) {
    for (let gz = gz0 - 2; gz <= gz0 + 3; gz++) {
      for (let hy = Math.max(0, hy0 - 2); hy <= hy0 + 3 && hy < 10 * LAYERS_PER_STOREY; hy++) {
        if (type === 'slab' || type === 'stairs') {
          if (gx > gx0 + 2 || gz > gz0 + 2) continue;
          consider(candidatePos(kind, type, gx, gz, hy, 'x', rot));
        } else {
          // Une porte n'existe qu'à la base d'un étage.
          if (type === 'door' && hy % LAYERS_PER_STOREY !== 0) continue;
          for (const axis of axes) consider(candidatePos(kind, type, gx, gz, hy, axis, rot));
        }
      }
    }
  }
  if (!best) return null;
  const pos = (best as { pos: PiecePos }).pos;
  const cell =
    pos.slot === 'edge'
      ? { gx: Math.floor(hit.x / CELL_SIZE_M), gz: Math.floor(hit.z / CELL_SIZE_M) }
      : { gx: pos.gx, gz: pos.gz };
  return { pos, cell, hit };
}

/** Vise une pièce déjà posée (démolition) : la première touchée par le rayon. */
export function aimExisting(
  origin: Vec,
  dir: Vec,
  pieces: Pieces,
  maxDist: number,
): { pos: PiecePos; cell: { gx: number; gz: number } } | null {
  const hit = pickPiece(pieces, origin, dir, maxDist);
  const pos = hit ? parseKey(hit.key) : null;
  return pos ? { pos, cell: { gx: pos.gx, gz: pos.gz } } : null;
}
