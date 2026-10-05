import { pieceDef, type PieceKind, type PieceSlot } from '../data/buildings';

/**
 * Position d'une pièce. Étage `level` (0 = rez-de-chaussée).
 * - bord (mur, porte) : `axis 'x'` = bord le long de x, à z = gz × 0,5 m (entre les cases (gx, gz−1) et (gx, gz)) ;
 *   `axis 'z'` = bord le long de z, à x = gx × 0,5 m (entre les cases (gx−1, gz) et (gx, gz)).
 * - sol, plafond : la case (gx, gz).
 */
export interface PiecePos {
  slot: PieceSlot;
  level: number;
  gx: number;
  gz: number;
  axis?: 'x' | 'z';
}

/** Les pièces posées : clé d'emplacement -> type. Une seule pièce par emplacement. */
export type Pieces = Record<string, PieceKind>;

export function pieceKey(p: PiecePos): string {
  const base = `${p.slot[0]}:${p.level}:${p.gx},${p.gz}`;
  return p.slot === 'edge' ? `${base}:${p.axis ?? 'x'}` : base;
}

const KEY_RE = /^([efc]):(-?\d+):(-?\d+),(-?\d+)(?::([xz]))?$/;
const SLOT_OF: Record<string, PieceSlot> = { e: 'edge', f: 'floor', c: 'ceiling' };

export function parseKey(key: string): PiecePos | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const slot = SLOT_OF[m[1]];
  if ((slot === 'edge') !== (m[5] !== undefined)) return null;
  return {
    slot,
    level: Number(m[2]),
    gx: Number(m[3]),
    gz: Number(m[4]),
    ...(m[5] ? { axis: m[5] as 'x' | 'z' } : {}),
  };
}

/** Emplacement qu'occupe un type de pièce à une position donnée. */
export function posFor(
  kind: PieceKind,
  level: number,
  gx: number,
  gz: number,
  axis?: 'x' | 'z',
): PiecePos {
  const slot = pieceDef(kind).slot;
  return { slot, level, gx, gz, ...(slot === 'edge' ? { axis: axis ?? 'x' } : {}) };
}

/** Lit des pièces enregistrées : ignore les clés ou types inutilisables. */
export function normalizePieces(raw: unknown): Pieces {
  const result: Pieces = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [key, kind] of Object.entries(raw as Record<string, unknown>)) {
    const pos = parseKey(key);
    if (!pos || typeof kind !== 'string') continue;
    try {
      if (pieceDef(kind as PieceKind).slot !== pos.slot) continue;
    } catch {
      continue;
    }
    result[key] = kind as PieceKind;
  }
  return result;
}
