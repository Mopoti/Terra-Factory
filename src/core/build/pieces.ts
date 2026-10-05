import {
  LAYERS_PER_STOREY,
  isPieceKind,
  pieceDef,
  RISE_DIR,
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
export function isFree(pieces: Pieces, kind: PieceKind, pos: PiecePos): boolean {
  if (slotOf(pieceDef(kind).type) !== pos.slot) return false;
  if (pos.slot === 'stairs') {
    // Une seule marche par case et par hauteur, quel que soit son sens.
    for (let r = 0; r < 4; r++) if (pieces[pieceKey({ ...pos, rot: r })]) return false;
    return true;
  }
  if (pos.slot === 'ceiling') {
    // Une seule dalle de plafond par case, à n'importe quelle hauteur.
    for (let l = 0; l < LAYERS_PER_STOREY; l++)
      if (pieces[pieceKey({ ...pos, layer: l })]) return false;
    return true;
  }
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
  return result;
}

const hasBlock = (
  pieces: Pieces,
  level: number,
  gx: number,
  gz: number,
  axis: 'x' | 'z',
  layer: number,
): boolean => {
  const base: PiecePos = { slot: 'edge', level, gx, gz, axis };
  // Une porte occupe tout l'étage.
  return !!pieces[edgeKey(base, layer)] || !!pieces[edgeKey(base, 0)]?.startsWith('door');
};

/**
 * Un mur ne tient pas dans le vide : un bloc de mur doit reposer sur le sol (rez-de-chaussée), sur un sol
 * posé à l'étage ou sur le mur de l'étage d'en dessous, ou être accolé à un autre bloc (au-dessus, en
 * dessous, à côté, ou dans l'angle perpendiculaire) pour faire des encadrements.
 */
export function isSupported(pieces: Pieces, kind: PieceKind, pos: PiecePos): boolean {
  if (pos.slot === 'ceiling') return ceilingSupported(pieces, pos);
  if (pos.slot === 'stairs') return stairsSupported(pieces, pos);
  if (pos.slot !== 'edge') return true;
  const { level, gx, gz } = pos;
  const axis = pos.axis ?? 'x';
  const layer = pos.layer ?? 0;
  if (layer === 0) {
    if (level === 0) return true;
    const cells =
      axis === 'x'
        ? [
            [gx, gz - 1],
            [gx, gz],
          ]
        : [
            [gx - 1, gz],
            [gx, gz],
          ];
    if (cells.some(([cx, cz]) => pieces[pieceKey({ slot: 'floor', level, gx: cx, gz: cz })]))
      return true;
    if (hasBlock(pieces, level - 1, gx, gz, axis, LAYERS_PER_STOREY - 1)) return true;
  }
  if (layer > 0) {
    // Un mur peut aussi reposer sur une dalle de plafond posée juste en dessous, d'un côté ou de l'autre.
    const cells =
      axis === 'x'
        ? [
            [gx, gz - 1],
            [gx, gz],
          ]
        : [
            [gx - 1, gz],
            [gx, gz],
          ];
    if (
      cells.some(
        ([cx, cz]) =>
          pieces[pieceKey({ slot: 'ceiling', level, gx: cx, gz: cz, layer: layer - 1 })],
      )
    ) {
      return true;
    }
  }
  if (pieceDef(kind).type === 'door') return false;
  const has = (g: number, h: number, a: 'x' | 'z', l: number): boolean =>
    hasBlock(pieces, level, g, h, a, l);
  if (layer > 0 && has(gx, gz, axis, layer - 1)) return true;
  if (layer < LAYERS_PER_STOREY - 1 && has(gx, gz, axis, layer + 1)) return true;
  if (axis === 'x') {
    if (has(gx - 1, gz, 'x', layer) || has(gx + 1, gz, 'x', layer)) return true;
    return [gx, gx + 1].some((x) => has(x, gz - 1, 'z', layer) || has(x, gz, 'z', layer));
  }
  if (has(gx, gz - 1, 'z', layer) || has(gx, gz + 1, 'z', layer)) return true;
  return [gz, gz + 1].some((z) => has(gx - 1, z, 'x', layer) || has(gx, z, 'x', layer));
}

/** Jusqu'où (en cases) une dalle de plafond peut s'étendre depuis un mur qui la porte. */
export const MAX_CEILING_SPAN = 3;

/**
 * La case a-t-elle, à l'un de ses 4 bords, un mur dont le bloc `layer` est le dernier (le plafond se pose
 * sur la tranche haute du mur, à la hauteur de ce mur, même s'il ne fait qu'un bloc de haut) ?
 */
function carriedByWall(
  pieces: Pieces,
  level: number,
  gx: number,
  gz: number,
  layer: number,
): boolean {
  const top = (g: number, h: number, axis: 'x' | 'z'): boolean =>
    hasBlock(pieces, level, g, h, axis, layer) &&
    (layer === TOP_LAYER || !hasBlock(pieces, level, g, h, axis, layer + 1));
  return top(gx, gz, 'x') || top(gx, gz + 1, 'x') || top(gx, gz, 'z') || top(gx + 1, gz, 'z');
}

/**
 * Un plafond s'accroche à la tranche haute d'un mur, à la hauteur de ce mur, sans autre condition, ou
 * prolonge une dalle déjà posée à la même hauteur, à moins de `MAX_CEILING_SPAN` cases d'un mur porteur.
 */
function ceilingSupported(pieces: Pieces, pos: PiecePos): boolean {
  const layer = pos.layer ?? TOP_LAYER;
  const seen = new Set<string>([`${pos.gx},${pos.gz}`]);
  let frontier: [number, number][] = [[pos.gx, pos.gz]];
  for (let depth = 0; depth <= MAX_CEILING_SPAN; depth++) {
    const next: [number, number][] = [];
    for (const [gx, gz] of frontier) {
      if (carriedByWall(pieces, pos.level, gx, gz, layer)) return true;
      for (const [nx, nz] of [
        [gx - 1, gz],
        [gx + 1, gz],
        [gx, gz - 1],
        [gx, gz + 1],
      ]) {
        const k = `${nx},${nz}`;
        if (seen.has(k)) continue;
        if (!pieces[pieceKey({ slot: 'ceiling', level: pos.level, gx: nx, gz: nz, layer })])
          continue;
        seen.add(k);
        next.push([nx, nz]);
      }
    }
    frontier = next;
  }
  return false;
}

/**
 * Un escalier (marche de 50 cm de haut qui monte dans le sens `rot`) se pose au sol (rez-de-chaussée), sur un
 * sol d'étage, ou dans le prolongement d'un autre escalier de même sens, un bloc plus bas, côté bas.
 */
function stairsSupported(pieces: Pieces, pos: PiecePos): boolean {
  const layer = pos.layer ?? 0;
  const rot = pos.rot ?? 0;
  if (layer === 0) {
    if (pos.level === 0) return true;
    return !!pieces[pieceKey({ slot: 'floor', level: pos.level, gx: pos.gx, gz: pos.gz })];
  }
  const [dx, dz] = RISE_DIR[rot];
  return !!pieces[
    pieceKey({
      slot: 'stairs',
      level: pos.level,
      gx: pos.gx - dx,
      gz: pos.gz - dz,
      layer: layer - 1,
      rot,
    })
  ];
}
