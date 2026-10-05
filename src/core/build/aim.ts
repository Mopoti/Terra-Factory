import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  STOREY_HEIGHT_M,
  type PieceKind,
} from '../data/buildings';
import {
  edgeKeysToRemove,
  isFree,
  isSupported,
  posFor,
  type PiecePos,
  type Pieces,
} from './pieces';

type Vec = { x: number; y: number; z: number };

/** Distance (m) à partir de laquelle un point est « sur » la ligne d'un bord de case. */
const SNAP_M = 0.15;
const STEP_M = 0.08;

/** Bord de case le plus proche d'un point (x, z), avec sa distance. */
function nearestEdge(
  x: number,
  z: number,
): { axis: 'x' | 'z'; gx: number; gz: number; dist: number } {
  const gx = Math.floor(x / CELL_SIZE_M);
  const gz = Math.floor(z / CELL_SIZE_M);
  const fx = x / CELL_SIZE_M - gx;
  const fz = z / CELL_SIZE_M - gz;
  const candidates = [
    { axis: 'z' as const, gx, gz, dist: fx * CELL_SIZE_M },
    { axis: 'z' as const, gx: gx + 1, gz, dist: (1 - fx) * CELL_SIZE_M },
    { axis: 'x' as const, gx, gz, dist: fz * CELL_SIZE_M },
    { axis: 'x' as const, gx, gz: gz + 1, dist: (1 - fz) * CELL_SIZE_M },
  ];
  return candidates.reduce((a, b) => (b.dist < a.dist ? b : a));
}

/**
 * Vise un bloc de mur (ou une porte) avec un rayon. On suit le rayon et on retient le premier bloc
 * qui peut réellement être posé : au sol (bloc du bas) ou accolé à un mur existant. Ainsi on n'a pas à
 * viser en l'air avec précision : le curseur « colle » aux endroits valides.
 * Si rien de valide n'est touché, le rayon arrive au sol : on propose le bloc du bas le plus proche.
 */
export function aimEdge(
  origin: Vec,
  dir: Vec,
  pieces: Pieces,
  kind: PieceKind,
  level: number,
  maxDist: number,
  mode: 'place' | 'remove' = 'place',
): { pos: PiecePos; cell: { gx: number; gz: number } } | null {
  const y0 = level * STOREY_HEIGHT_M;
  const top = LAYERS_PER_STOREY * LAYER_HEIGHT_M;
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t - y0;
    const z = origin.z + dir.z * t;
    if (y < 0) break;
    if (y >= top) continue;
    const e = nearestEdge(x, z);
    if (e.dist > SNAP_M) continue;
    const layer = Math.min(LAYERS_PER_STOREY - 1, Math.floor(y / LAYER_HEIGHT_M));
    const pos = posFor(kind, level, e.gx, e.gz, e.axis, layer);
    const usable =
      mode === 'remove'
        ? edgeKeysToRemove(pieces, pos, [layer]).length > 0
        : isFree(pieces, kind, pos) && isSupported(pieces, kind, pos);
    if (usable) {
      return { pos, cell: { gx: Math.floor(x / CELL_SIZE_M), gz: Math.floor(z / CELL_SIZE_M) } };
    }
  }
  if (mode === 'remove') return null;
  // Le rayon touche le sol (ou rien de valide) : bloc du bas du bord le plus proche du point d'impact.
  let x: number;
  let z: number;
  const t = dir.y < -1e-6 ? (y0 - origin.y) / dir.y : -1;
  if (t > 0 && t <= maxDist * 2) {
    x = origin.x + dir.x * t;
    z = origin.z + dir.z * t;
  } else {
    const flat = Math.hypot(dir.x, dir.z) || 1;
    x = origin.x + (dir.x / flat) * 3;
    z = origin.z + (dir.z / flat) * 3;
  }
  const e = nearestEdge(x, z);
  return {
    pos: posFor(kind, level, e.gx, e.gz, e.axis, 0),
    cell: { gx: Math.floor(x / CELL_SIZE_M), gz: Math.floor(z / CELL_SIZE_M) },
  };
}

/**
 * Vise une dalle de plafond. On suit le rayon dans la bande de hauteur du haut des murs (bloc du haut et
 * un peu au-dessus) et on retient la première dalle posable : celle sous le rayon, ou l'une des deux
 * dalles qui touchent le bord de mur visé. Ainsi, viser la face ou la tranche d'un mur suffit pour
 * accrocher la dalle de son côté, même si le rayon traverse le plan du plafond derrière le mur.
 * Sinon on retombe sur la case du plan du plafond sous le rayon (qui s'affichera en rouge si elle ne tient pas).
 */
export function aimCeiling(
  origin: Vec,
  dir: Vec,
  pieces: Pieces,
  kind: PieceKind,
  level: number,
  maxDist: number,
): { pos: PiecePos; cell: { gx: number; gz: number } } | null {
  const topY = level * STOREY_HEIGHT_M + STOREY_HEIGHT_M;
  const bandLow = topY - LAYER_HEIGHT_M;
  const bandHigh = topY + 0.4;
  const usable = (gx: number, gz: number): PiecePos | null => {
    const pos = posFor(kind, level, gx, gz);
    return isFree(pieces, kind, pos) && isSupported(pieces, kind, pos) ? pos : null;
  };
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const y = origin.y + dir.y * t;
    if (y > bandHigh && dir.y > 0) break;
    if (y < bandLow || y > bandHigh) continue;
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    const gx = Math.floor(x / CELL_SIZE_M);
    const gz = Math.floor(z / CELL_SIZE_M);
    const candidates: [number, number][] = [[gx, gz]];
    const e = nearestEdge(x, z);
    if (e.dist <= SNAP_M) {
      // Les deux cases de part et d'autre du bord, la plus proche de l'œil d'abord.
      const pair: [number, number][] =
        e.axis === 'x'
          ? [
              [e.gx, e.gz - 1],
              [e.gx, e.gz],
            ]
          : [
              [e.gx - 1, e.gz],
              [e.gx, e.gz],
            ];
      const d = (c: [number, number]): number =>
        Math.hypot((c[0] + 0.5) * CELL_SIZE_M - origin.x, (c[1] + 0.5) * CELL_SIZE_M - origin.z);
      pair.sort((a, b) => d(a) - d(b));
      candidates.push(...pair);
    }
    for (const [cx, cz] of candidates) {
      const pos = usable(cx, cz);
      if (pos) return { pos, cell: { gx: cx, gz: cz } };
    }
  }
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (topY - origin.y) / dir.y;
  if (t < 0 || t > 200) return null;
  const gx = Math.floor((origin.x + dir.x * t) / CELL_SIZE_M);
  const gz = Math.floor((origin.z + dir.z * t) / CELL_SIZE_M);
  return { pos: posFor(kind, level, gx, gz), cell: { gx, gz } };
}
