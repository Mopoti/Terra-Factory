import { CELL_SIZE_M } from '../constants';
import { LAYERS_PER_STOREY, pieceDef, type PieceKind } from '../data/buildings';
import { isFree, posFor, type PiecePos, type Pieces } from './pieces';

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
): PiecePos[] {
  const out: PiecePos[] = [];
  for (let gx = Math.min(a.gx, b.gx); gx <= Math.max(a.gx, b.gx); gx++) {
    for (let gz = Math.min(a.gz, b.gz); gz <= Math.max(a.gz, b.gz); gz++) {
      out.push(posFor(kind, level, gx, gz));
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
}

/** Ce qui sera posé (`ok`), ce qui manque de stock (`lack`), est hors de portée ou déjà occupé. */
export function evaluatePlan(
  kind: PieceKind,
  positions: PiecePos[],
  pieces: Pieces,
  stock: number,
  player: { x: number; z: number },
  reachM: number,
): PlanItem[] {
  let left = stock;
  return positions.map((pos) => {
    if (!isFree(pieces, kind, pos)) return { pos, status: 'occupied' as const };
    const c = posCenter(pos);
    if (Math.hypot(c.x - player.x, c.z - player.z) > reachM) return { pos, status: 'far' as const };
    if (left <= 0) return { pos, status: 'lack' as const };
    left--;
    return { pos, status: 'ok' as const };
  });
}
