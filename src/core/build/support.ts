import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  SUPPORT_SPAN_M,
  kindFor,
  pieceDef,
  type Material,
  type PieceKind,
} from '../data/buildings';
import { pieceKey, slabAt, type PiecePos, type Pieces } from './pieces';

/**
 * Supports de construction. Aucune pièce n'est refusée faute d'appui, mais **une pièce en hauteur doit avoir un
 * support à moins de `SUPPORT_SPAN_M` (2,5 m)** ; sinon un **pilier de soutènement** est posé automatiquement
 * sous elle, et il compte à son tour comme support. Un support est une colonne qui descend jusqu'au sol :
 * un mur (blocs empilés, ou posés sur une dalle elle-même soutenue), ou un pilier.
 *
 * Positions en « faces » : la face `f` est à `f` blocs de 50 cm au-dessus du sol (le sol de l'étage `n` est à la face `5 n`).
 */
const L = LAYERS_PER_STOREY;
const REACH_CELLS = Math.ceil(SUPPORT_SPAN_M / CELL_SIZE_M) + 1;
const EPS = 1e-6;

type Edge = { level: number; gx: number; gz: number; axis: 'x' | 'z' };

const isWall = (kind: PieceKind | undefined): boolean => !!kind && /^(wall|door)/.test(kind);

/** Le bloc de mur numéro `b` (0 = posé sur le sol) existe-t-il à ce bord ? (une porte occupe tout l'étage) */
function wallBlock(pieces: Pieces, e: Edge, b: number): boolean {
  const level = Math.floor(b / L);
  const layer = b % L;
  const base = { slot: 'edge' as const, level, gx: e.gx, gz: e.gz, axis: e.axis };
  return (
    isWall(pieces[pieceKey({ ...base, layer })]) ||
    pieces[pieceKey({ ...base, layer: 0 })]?.startsWith('door') === true
  );
}

/** Cases de part et d'autre d'un bord. */
const edgeCells = (e: Edge): [number, number][] =>
  e.axis === 'x'
    ? [
        [e.gx, e.gz - 1],
        [e.gx, e.gz],
      ]
    : [
        [e.gx - 1, e.gz],
        [e.gx, e.gz],
      ];

/** Les quatre bords d'une case. */
const cellEdges = (level: number, gx: number, gz: number): Edge[] => [
  { level, gx, gz, axis: 'x' },
  { level, gx, gz: gz + 1, axis: 'x' },
  { level, gx, gz, axis: 'z' },
  { level, gx: gx + 1, gz, axis: 'z' },
];

/** Milieu d'un bord (en cases, réel). */
const edgeMid = (e: Edge): [number, number] =>
  e.axis === 'x' ? [e.gx + 0.5, e.gz] : [e.gx, e.gz + 0.5];

/** Clé d'un pilier dont le dessus est à la face `top` dans la case. */
export function pillarKey(top: number, gx: number, gz: number): string {
  const level = Math.ceil(top / L) - 1;
  return pieceKey({ slot: 'pillar', level, gx, gz, layer: top - 1 - level * L });
}

export class SupportMap {
  private readonly memo = new Map<string, boolean>();

  constructor(private readonly pieces: Pieces) {}

  private cached(key: string, compute: () => boolean): boolean {
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    this.memo.set(key, false); // protège d'une boucle improbable
    const value = compute();
    this.memo.set(key, value);
    return value;
  }

  /** Une dalle existe à cette face et elle est soutenue. */
  slabHeld(face: number, gx: number, gz: number): boolean {
    if (!slabAt(this.pieces, face, gx, gz)) return false;
    return this.supportNear(face, gx, gz);
  }

  /** Le bloc `b` de ce bord repose-t-il sur le sol, sur des blocs soutenus ou sur une dalle soutenue ? */
  wallGrounded(e: Edge, b: number): boolean {
    return this.cached(`w:${e.axis}:${e.gx},${e.gz}:${b}`, () => {
      if (!wallBlock(this.pieces, e, b)) return false;
      if (b === 0) return true;
      if (wallBlock(this.pieces, e, b - 1) && this.wallGrounded(e, b - 1)) return true;
      return edgeCells(e).some(([cx, cz]) => this.slabHeld(b, cx, cz));
    });
  }

  /** Le pilier dont le dessus est à la face `top` repose-t-il sur le sol ou sur une dalle soutenue ? */
  pillarGrounded(top: number, gx: number, gz: number): boolean {
    return this.cached(`p:${gx},${gz}:${top}`, () => {
      if (!this.pieces[pillarKey(top, gx, gz)]) return false;
      const bottom = (Math.ceil(top / L) - 1) * L;
      if (bottom === 0) return true;
      return this.pillarGrounded(bottom, gx, gz) || this.slabHeld(bottom, gx, gz);
    });
  }

  /** Y a-t-il un support dont le dessus est à la face `face` à moins de 2,5 m de cette case ? */
  supportNear(face: number, gx: number, gz: number): boolean {
    if (face === 0) return true;
    return this.cached(`n:${gx},${gz}:${face}`, () => {
      const level = Math.ceil(face / L) - 1;
      const b = face - 1;
      const cx = gx + 0.5;
      const cz = gz + 0.5;
      for (let dx = -REACH_CELLS; dx <= REACH_CELLS; dx++) {
        for (let dz = -REACH_CELLS; dz <= REACH_CELLS; dz++) {
          const x = gx + dx;
          const z = gz + dz;
          if (Math.hypot(dx, dz) * CELL_SIZE_M > SUPPORT_SPAN_M + CELL_SIZE_M) continue;
          if (
            this.pillarGrounded(face, x, z) &&
            Math.hypot(x + 0.5 - cx, z + 0.5 - cz) * CELL_SIZE_M <= SUPPORT_SPAN_M + EPS
          )
            return true;
          for (const e of cellEdges(level, x, z)) {
            const [mx, mz] = edgeMid(e);
            if (Math.hypot(mx - cx, mz - cz) * CELL_SIZE_M > SUPPORT_SPAN_M + EPS) continue;
            if (this.wallGrounded(e, b)) return true;
          }
        }
      }
      return false;
    });
  }
}

/**
 * Piliers à ajouter pour que la pièce qu'on vient de poser soit soutenue : un pilier sous la pièce, et au besoin
 * d'autres en dessous jusqu'au sol ou jusqu'à une dalle soutenue. Renvoie `clé -> matériau`.
 */
export function pillarsFor(
  pieces: Pieces,
  pos: PiecePos,
  material: Material,
): Record<string, PieceKind> {
  const pillar = kindFor('pillar', material);
  const out: Record<string, PieceKind> = {};
  const map = new SupportMap(pieces);
  const column = (face: number, gx: number, gz: number): void => {
    let top = face;
    for (let guard = 0; top > 0 && guard < 12; guard++) {
      const key = pillarKey(top, gx, gz);
      if (!pieces[key]) out[key] = pillar;
      const bottom = (Math.ceil(top / L) - 1) * L;
      if (bottom === 0 || map.slabHeld(bottom, gx, gz)) return;
      top = bottom;
    }
  };
  if (pos.slot === 'floor' || pos.slot === 'ceiling') {
    const face = pos.slot === 'floor' ? pos.level * L : pos.level * L + (pos.layer ?? L - 1) + 1;
    if (face > 0 && !map.supportNear(face, pos.gx, pos.gz)) column(face, pos.gx, pos.gz);
  } else if (pos.slot === 'stairs') {
    const face = pos.level * L + (pos.layer ?? 0);
    if (face > 0 && !map.slabHeld(face, pos.gx, pos.gz) && !map.supportNear(face, pos.gx, pos.gz))
      column(face, pos.gx, pos.gz);
  } else if (pos.slot === 'edge') {
    const b = pos.level * L + (pos.layer ?? 0);
    const e: Edge = { level: pos.level, gx: pos.gx, gz: pos.gz, axis: pos.axis ?? 'x' };
    if (b > 0 && !map.wallGrounded(e, b)) {
      // Mur en l'air : un pilier dans la case voisine (celle sans dalle) le soutient.
      const [cx, cz] =
        edgeCells(e).find(([x, z]) => !slabAt(pieces, b, x, z)) ??
        (edgeCells(e)[0] as [number, number]);
      column(b, cx, cz);
    }
  }
  return out;
}

/**
 * Piliers à ajouter sous un élément à la face `face` (blocs de 50 cm depuis le sol) dans la case (gx, gz) : un tapis
 * surélevé, par exemple. Rien si un support (pilier ou mur qui touche le sol) est à moins de 2,5 m.
 */
export function pillarsForFace(
  pieces: Pieces,
  face: number,
  gx: number,
  gz: number,
  material: Material,
): Record<string, PieceKind> {
  if (face <= 0) return {};
  const map = new SupportMap(pieces);
  if (map.supportNear(face, gx, gz)) return {};
  const pillar = kindFor('pillar', material);
  const out: Record<string, PieceKind> = {};
  let top = face;
  for (let guard = 0; top > 0 && guard < 12; guard++) {
    const key = pillarKey(top, gx, gz);
    if (!pieces[key]) out[key] = pillar;
    const bottom = (Math.ceil(top / L) - 1) * L;
    if (bottom === 0 || map.slabHeld(bottom, gx, gz)) break;
    top = bottom;
  }
  return out;
}

export const isPillarKind = (kind: PieceKind | undefined): boolean =>
  !!kind && pieceDef(kind).type === 'pillar';
