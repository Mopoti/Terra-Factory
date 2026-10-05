import {
  LAYERS_PER_STOREY,
  isPieceKind,
  pieceDef,
  slotOf,
  type PieceKind,
  type PieceSlot,
} from '../data/buildings';

/**
 * Position d'une pièce. Étage `level` (0 = rez-de-chaussée).
 * - bord (mur, porte) : `axis 'x'` = bord le long de x, à z = gz × 0,5 m (entre les cases (gx, gz−1) et (gx, gz)) ;
 *   `axis 'z'` = bord le long de z, à x = gx × 0,5 m (entre les cases (gx−1, gz) et (gx, gz)).
 *   `layer` = bloc de 50 cm de haut (0 = en bas, 4 = en haut). Une porte occupe tout l'étage et est rangée au bloc 0.
 * - sol, plafond : la case (gx, gz).
 */
export interface PiecePos {
  slot: PieceSlot;
  level: number;
  gx: number;
  gz: number;
  axis?: 'x' | 'z';
  layer?: number;
}

/** Les pièces posées : clé d'emplacement -> type. Une seule pièce par emplacement. */
export type Pieces = Record<string, PieceKind>;

export function pieceKey(p: PiecePos): string {
  const base = `${p.slot[0]}:${p.level}:${p.gx},${p.gz}`;
  return p.slot === 'edge' ? `${base}:${p.axis ?? 'x'}:${p.layer ?? 0}` : base;
}

const KEY_RE = /^([efc]):(-?\d+):(-?\d+),(-?\d+)(?::([xz]):(\d+))?$/;
const LEGACY_EDGE_RE = /^e:(-?\d+):(-?\d+),(-?\d+):([xz])$/;
const SLOT_OF: Record<string, PieceSlot> = { e: 'edge', f: 'floor', c: 'ceiling' };

export function parseKey(key: string): PiecePos | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const slot = SLOT_OF[m[1]];
  if ((slot === 'edge') !== (m[5] !== undefined)) return null;
  const layer = m[6] === undefined ? undefined : Number(m[6]);
  if (layer !== undefined && layer >= LAYERS_PER_STOREY) return null;
  return {
    slot,
    level: Number(m[2]),
    gx: Number(m[3]),
    gz: Number(m[4]),
    ...(m[5] ? { axis: m[5] as 'x' | 'z', layer } : {}),
  };
}

/** Emplacement qu'occupe une pièce à une position donnée (`layer` ne sert qu'aux murs). */
export function posFor(
  kind: PieceKind,
  level: number,
  gx: number,
  gz: number,
  axis?: 'x' | 'z',
  layer = 0,
): PiecePos {
  const type = pieceDef(kind).type;
  const slot = slotOf(type);
  return {
    slot,
    level,
    gx,
    gz,
    ...(slot === 'edge' ? { axis: axis ?? 'x', layer: type === 'door' ? 0 : layer } : {}),
  };
}

const edgeKey = (p: PiecePos, layer: number): string => pieceKey({ ...p, slot: 'edge', layer });

/** Bords de case : fermé par des blocs sur tout l'étage, par une porte, ou ouvert (même avec un trou). */
export function edgeState(pieces: Pieces, p: PiecePos): 'door' | 'closed' | 'open' {
  if (pieces[edgeKey(p, 0)]?.startsWith('door')) return 'door';
  for (let l = 0; l < LAYERS_PER_STOREY; l++) if (!pieces[edgeKey(p, l)]) return 'open';
  return 'closed';
}

/** Peut-on poser cette pièce ici ? (emplacement libre, sans porte ni mur gênant) */
export function isFree(pieces: Pieces, kind: PieceKind, pos: PiecePos): boolean {
  if (slotOf(pieceDef(kind).type) !== pos.slot) return false;
  if (pos.slot !== 'edge') return !pieces[pieceKey(pos)];
  if (pieceDef(kind).type === 'door') {
    for (let l = 0; l < LAYERS_PER_STOREY; l++) if (pieces[edgeKey(pos, l)]) return false;
    return true;
  }
  return !pieces[pieceKey(pos)] && !pieces[edgeKey(pos, 0)]?.startsWith('door');
}

/** Clés des pièces à retirer à un bord pour les blocs demandés (`null` = tout le bord, porte comprise). */
export function edgeKeysToRemove(pieces: Pieces, pos: PiecePos, layers: number[] | null): string[] {
  const all = Array.from({ length: LAYERS_PER_STOREY }, (_, i) => i);
  const wanted = layers ?? all;
  const door = pieces[edgeKey(pos, 0)]?.startsWith('door');
  if (door) return wanted.includes(0) || layers === null ? [edgeKey(pos, 0)] : [];
  return wanted.map((l) => edgeKey(pos, l)).filter((k) => pieces[k]);
}

const LEGACY: Record<string, PieceKind> = {
  wall: 'wall_stone',
  door: 'door_wood',
  floor: 'floor_wood',
  ceiling: 'ceiling_wood',
};

/** Lit des pièces enregistrées : ignore les clés ou types inutilisables, convertit l'ancien format. */
export function normalizePieces(raw: unknown): Pieces {
  const result: Pieces = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const legacy = LEGACY_EDGE_RE.exec(key);
    if (legacy && LEGACY[value]) {
      // Ancien mur sur tout l'étage -> 5 blocs ; ancienne porte -> porte.
      const kind = LEGACY[value];
      if (slotOf(pieceDef(kind).type) !== 'edge') continue;
      const base = {
        slot: 'edge',
        level: Number(legacy[1]),
        gx: Number(legacy[2]),
        gz: Number(legacy[3]),
        axis: legacy[4],
      } as PiecePos;
      const layers =
        pieceDef(kind).type === 'door'
          ? [0]
          : Array.from({ length: LAYERS_PER_STOREY }, (_, i) => i);
      for (const l of layers) result[edgeKey(base, l)] = kind;
      continue;
    }
    const pos = parseKey(key);
    if (!pos) continue;
    const kind = isPieceKind(value) ? value : LEGACY[value];
    if (!kind || slotOf(pieceDef(kind).type) !== pos.slot) continue;
    result[key] = kind;
  }
  return result;
}
