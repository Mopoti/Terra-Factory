import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  pieceDef,
  resolveKind,
  type PieceKind,
} from '../data/buildings';
import { isFree, pieceKey, posFor, slabPos, type PiecePos, type Pieces } from './pieces';

/** Centre d'une position (m), pour mesurer la portée. */
export function posCenter(pos: PiecePos): { x: number; z: number } {
  if (pos.slot !== 'edge')
    return { x: (pos.gx + 0.5) * CELL_SIZE_M, z: (pos.gz + 0.5) * CELL_SIZE_M };
  return pos.axis === 'x'
    ? { x: (pos.gx + 0.5) * CELL_SIZE_M, z: pos.gz * CELL_SIZE_M }
    : { x: pos.gx * CELL_SIZE_M, z: (pos.gz + 0.5) * CELL_SIZE_M };
}

/** Cases d'un rectangle (sol, plafond), des plus proches du point de départ aux plus éloignées. */
export function planRect(
  kind: PieceKind,
  level: number,
  a: { gx: number; gz: number },
  b: { gx: number; gz: number },
  /** Plafond : bloc de mur sur lequel la dalle est posée (hauteur de la dalle). */
  layer?: number,
): PiecePos[] {
  const out: PiecePos[] = [];
  for (let gx = Math.min(a.gx, b.gx); gx <= Math.max(a.gx, b.gx); gx++) {
    for (let gz = Math.min(a.gz, b.gz); gz <= Math.max(a.gz, b.gz); gz++) {
      out.push(posFor(kind, level, gx, gz, undefined, layer));
    }
  }
  return out.sort(
    (p, q) =>
      Math.hypot(p.gx - a.gx, p.gz - a.gz) - Math.hypot(q.gx - a.gx, q.gz - a.gz) ||
      p.gx - q.gx ||
      p.gz - q.gz,
  );
}

/** Dalles d'un rectangle de cases, à la face `face` (en blocs de 50 cm depuis le sol), des plus proches du départ aux plus éloignées. */
export function planSlabs(
  kind: PieceKind,
  face: number,
  a: { gx: number; gz: number },
  b: { gx: number; gz: number },
): PiecePos[] {
  const out: PiecePos[] = [];
  for (let gx = Math.min(a.gx, b.gx); gx <= Math.max(a.gx, b.gx); gx++) {
    for (let gz = Math.min(a.gz, b.gz); gz <= Math.max(a.gz, b.gz); gz++) {
      const s = slabPos(face, gx, gz);
      out.push(posFor(resolveKind(kind, s.slot), s.level, gx, gz, undefined, s.layer));
    }
  }
  return out.sort(
    (p, q) =>
      Math.hypot(p.gx - a.gx, p.gz - a.gz) - Math.hypot(q.gx - a.gx, q.gz - a.gz) ||
      p.gx - q.gx ||
      p.gz - q.gz,
  );
}

/** Blocs d'un mur le long d'une ligne (de l'index i0 à i1), pour les hauteurs demandées (`null` = tout l'étage). */
export function planLine(
  kind: PieceKind,
  level: number,
  axis: 'x' | 'z',
  line: number,
  i0: number,
  i1: number,
  layers: number[] | null,
): PiecePos[] {
  const out: PiecePos[] = [];
  const step = i1 >= i0 ? 1 : -1;
  const isDoor = pieceDef(kind).type === 'door';
  const heights = isDoor ? [0] : (layers ?? Array.from({ length: LAYERS_PER_STOREY }, (_, i) => i));
  for (let i = i0; i !== i1 + step; i += step) {
    // Une porte ne se pose qu'à l'endroit visé, pas en ligne.
    if (isDoor && i !== i0) break;
    for (const layer of heights) {
      out.push(
        axis === 'x'
          ? posFor(kind, level, i, line, 'x', layer)
          : posFor(kind, level, line, i, 'z', layer),
      );
    }
  }
  return out;
}

export type PlanStatus = 'ok' | 'lack' | 'far' | 'occupied';
export interface PlanItem {
  pos: PiecePos;
  status: PlanStatus;
  /** Ordre de pose des éléments `ok`. */
  seq?: number;
}

/**
 * Ce qui sera posé (`ok`), ce qui manque de stock (`lack`), est hors de portée (`far`) ou déjà occupé.
 * Aucune condition d'appui : une pièce peut se poser n'importe où (même dans le vide).
 */
export function evaluatePlan(
  kind: PieceKind,
  positions: PiecePos[],
  pieces: Pieces,
  stock: number,
  player: { x: number; z: number },
  reachM: number,
): PlanItem[] {
  let left = stock;
  let seq = 0;
  const taken = new Set<string>();
  return positions.map((pos) => {
    const key = pieceKey(pos);
    if (!isFree(pieces, kind, pos) || taken.has(key))
      return { pos, status: 'occupied' as PlanStatus };
    const c = posCenter(pos);
    if (Math.hypot(c.x - player.x, c.z - player.z) > reachM)
      return { pos, status: 'far' as PlanStatus };
    if (left <= 0) return { pos, status: 'lack' as PlanStatus };
    left--;
    taken.add(key);
    return { pos, status: 'ok' as PlanStatus, seq: seq++ };
  });
}

export interface WallCoord {
  /** Index le long du mur (colonne de 50 cm). */
  i: number;
  /** Bloc de 50 cm en hauteur (0 à 4). */
  layer: number;
}

/**
 * Où un rayon traverse le plan vertical d'un bord de case (colonne et hauteur de bloc), ou `null` si le
 * rayon est presque parallèle au plan, part dans l'autre sens ou touche le plan hors de l'étage.
 */
export function rayOnEdgePlane(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  axis: 'x' | 'z',
  line: number,
  baseY: number,
): WallCoord | null {
  const perp = axis === 'x' ? dir.z : dir.x;
  if (Math.abs(perp) < 0.2) return null;
  const planeAt = line * CELL_SIZE_M;
  const t = (planeAt - (axis === 'x' ? origin.z : origin.x)) / perp;
  if (t <= 0 || t > 60) return null;
  const along = axis === 'x' ? origin.x + dir.x * t : origin.z + dir.z * t;
  const h = origin.y + dir.y * t - baseY;
  if (h < 0 || h >= LAYERS_PER_STOREY * LAYER_HEIGHT_M) return null;
  return { i: Math.floor(along / CELL_SIZE_M), layer: Math.floor(h / LAYER_HEIGHT_M) };
}

/** Rectangle de blocs de mur dans le plan vertical d'un bord, d'un coin à l'autre (une porte : un seul emplacement). */
export function planWall(
  kind: PieceKind,
  level: number,
  axis: 'x' | 'z',
  line: number,
  a: WallCoord,
  b: WallCoord,
): PiecePos[] {
  if (pieceDef(kind).type === 'door') {
    return [
      axis === 'x' ? posFor(kind, level, a.i, line, 'x') : posFor(kind, level, line, a.i, 'z'),
    ];
  }
  const out: (PiecePos & { d: number })[] = [];
  for (let i = Math.min(a.i, b.i); i <= Math.max(a.i, b.i); i++) {
    for (let layer = Math.min(a.layer, b.layer); layer <= Math.max(a.layer, b.layer); layer++) {
      const pos =
        axis === 'x'
          ? posFor(kind, level, i, line, 'x', layer)
          : posFor(kind, level, line, i, 'z', layer);
      out.push({ ...pos, d: Math.hypot(i - a.i, layer - a.layer) });
    }
  }
  return out
    .sort((p, q) => p.d - q.d)
    .map((item) => {
      const pos: PiecePos & { d?: number } = { ...item };
      delete pos.d;
      return pos;
    });
}
