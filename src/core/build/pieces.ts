import {
  LAYERS_PER_STOREY,
  isPieceKind,
  pieceDef,
  resolveKind,
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
  /** Escalier : orientation (quarts de tour), c'est le sens de la montée (voir `RISE_DIR`). */
  rot?: number;
}

/** Les pièces posées : clé d'emplacement -> type. Une seule pièce par emplacement. */
export type Pieces = Record<string, PieceKind>;

/** Bloc le plus haut d'un étage : un plafond « de pièce » est posé sur lui. */
export const TOP_LAYER = LAYERS_PER_STOREY - 1;

export function pieceKey(p: PiecePos): string {
  const base = `${p.slot[0]}:${p.level}:${p.gx},${p.gz}`;
  if (p.slot === 'edge') return `${base}:${p.axis ?? 'x'}:${p.layer ?? 0}`;
  if (p.slot === 'ceiling') return `${base}:${p.layer ?? TOP_LAYER}`;
  if (p.slot === 'stairs') return `${base}:${p.layer ?? 0}:${p.rot ?? 0}`;
  return base;
}

const KEY_RE = /^([efcs]):(-?\d+):(-?\d+),(-?\d+)(?::([xz]):(\d+)|:(\d+)(?::(\d))?)?$/;
/** Clé qui marque une porte comme ouverte (même valeur que la porte) : `o:étage:gx,gz:axe`. */
export const doorOpenKey = (p: {
  level: number;
  gx: number;
  gz: number;
  axis?: 'x' | 'z';
}): string => `o:${p.level}:${p.gx},${p.gz}:${p.axis ?? 'x'}`;
const OPEN_RE = /^o:(-?\d+):(-?\d+),(-?\d+):([xz])$/;

const LEGACY_CEILING_RE = /^c:(-?\d+):(-?\d+),(-?\d+)$/;
const LEGACY_EDGE_RE = /^e:(-?\d+):(-?\d+),(-?\d+):([xz])$/;
const SLOT_OF: Record<string, PieceSlot> = { e: 'edge', f: 'floor', c: 'ceiling', s: 'stairs' };

export function parseKey(key: string): PiecePos | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const slot = SLOT_OF[m[1]];
  if ((slot === 'edge') !== (m[5] !== undefined)) return null;
  if ((slot === 'ceiling' || slot === 'stairs') !== (m[7] !== undefined)) return null;
  if ((slot === 'stairs') !== (m[8] !== undefined)) return null;
  if (slot === 'stairs' && Number(m[8]) > 3) return null;
  const layerText = m[6] ?? m[7];
  const layer = layerText === undefined ? undefined : Number(layerText);
  if (layer !== undefined && layer >= LAYERS_PER_STOREY) return null;
  return {
    slot,
    level: Number(m[2]),
    gx: Number(m[3]),
    gz: Number(m[4]),
    ...(m[5] ? { axis: m[5] as 'x' | 'z', layer } : {}),
    ...(slot === 'ceiling' ? { layer } : {}),
    ...(slot === 'stairs' ? { layer, rot: Number(m[8]) } : {}),
  };
}

/** Emplacement qu'occupe une pièce à une position donnée (`layer` ne sert qu'aux murs). */
export function posFor(
  kind: PieceKind,
  level: number,
  gx: number,
  gz: number,
  axis?: 'x' | 'z',
  layer?: number,
  rot?: number,
): PiecePos {
  const type = pieceDef(kind).type;
  const slot = slotOf(type);
  return {
    slot,
    level,
    gx,
    gz,
    ...(slot === 'edge' ? { axis: axis ?? 'x', layer: type === 'door' ? 0 : (layer ?? 0) } : {}),
    // Un plafond est posé sur le haut d'un mur : par défaut sur le bloc du haut de l'étage.
    ...(slot === 'ceiling' ? { layer: layer ?? TOP_LAYER } : {}),
    ...(slot === 'stairs' ? { layer: layer ?? 0, rot: (((rot ?? 0) % 4) + 4) % 4 } : {}),
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
export function isFree(pieces: Pieces, kindIn: PieceKind, pos: PiecePos): boolean {
  const kind = resolveKind(kindIn, pos.slot);
  if (slotOf(pieceDef(kind).type) !== pos.slot) return false;
  if (pos.slot === 'stairs') {
    // Une seule marche par case et par hauteur, quel que soit son sens.
    for (let r = 0; r < 4; r++) if (pieces[pieceKey({ ...pos, rot: r })]) return false;
    return true;
  }
  if (pos.slot === 'ceiling' || pos.slot === 'floor') {
    // Une dalle par face : le sol d'un étage et le plafond posé sur le dernier bloc de l'étage du dessous
    // sont la même face.
    return !slabAt(pieces, slabFace(pos), pos.gx, pos.gz);
  }
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
    const legacyCeiling = LEGACY_CEILING_RE.exec(key);
    if (legacyCeiling && (isPieceKind(value) || LEGACY[value])) {
      const kind = isPieceKind(value) ? value : LEGACY[value];
      if (pieceDef(kind).type === 'ceiling') result[`${key}:${TOP_LAYER}`] = kind;
      continue;
    }
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
  // Portes ouvertes : seulement si la porte existe.
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const m = OPEN_RE.exec(key);
    if (!m || typeof value !== 'string' || !value.startsWith('door')) continue;
    const door = `e:${m[1]}:${m[2]},${m[3]}:${m[4]}:0`;
    if (result[door]?.startsWith('door')) result[key] = result[door];
  }
  return result;
}

/** Hauteur (en blocs de 50 cm) de la face d'une dalle : un sol est à la base de son étage, un plafond sur son bloc. */
export function slabFace(pos: { slot: PieceSlot; level: number; layer?: number }): number {
  return pos.slot === 'floor'
    ? pos.level * LAYERS_PER_STOREY
    : pos.level * LAYERS_PER_STOREY + (pos.layer ?? TOP_LAYER) + 1;
}

/** Position d'une dalle à la face `face` (blocs depuis le sol) : un sol si la face est à la base d'un étage. */
export function slabPos(face: number, gx: number, gz: number): PiecePos {
  if (face % LAYERS_PER_STOREY === 0)
    return { slot: 'floor', level: face / LAYERS_PER_STOREY, gx, gz };
  const below = face - 1;
  return {
    slot: 'ceiling',
    level: Math.floor(below / LAYERS_PER_STOREY),
    gx,
    gz,
    layer: below % LAYERS_PER_STOREY,
  };
}

/** Y a-t-il une dalle sur cette face de cette case ? (clé du sol ou du plafond équivalent) */
export function slabAt(pieces: Pieces, face: number, gx: number, gz: number): string | null {
  const pos = slabPos(face, gx, gz);
  if (pieces[pieceKey(pos)]) return pieceKey(pos);
  // Ancien plafond posé sur le dernier bloc de l'étage du dessous : même face que le sol de l'étage.
  if (pos.slot === 'floor' && pos.level > 0) {
    const old = pieceKey({ slot: 'ceiling', level: pos.level - 1, gx, gz, layer: TOP_LAYER });
    if (pieces[old]) return old;
  }
  return null;
}
