import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  RISE_DIR,
  STOREY_HEIGHT_M,
  type PieceKind,
} from '../data/buildings';
import {
  edgeKeysToRemove,
  isFree,
  isSupported,
  pieceKey,
  posFor,
  type PiecePos,
  type Pieces,
} from './pieces';

type Vec = { x: number; y: number; z: number };

/** Distance (m) à partir de laquelle un point est « sur » la ligne d'un bord de case. */
const SNAP_M = 0.15;
const STEP_M = 0.08;
/** Un mur touché moins de 0,8 m après un bloc de sol posable prend le dessus (viser le pied du mur). */
const ATTACH_BIAS_M = 0.8;

/** Bord de case le plus proche d'un point (x, z), avec sa distance. */
function nearestEdge(
  x: number,
  z: number,
  lock?: 'x' | 'z',
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
  const allowed = lock ? candidates.filter((c) => c.axis === lock) : candidates;
  return allowed.reduce((a, b) => (b.dist < a.dist ? b : a));
}

type EdgeRef = { axis: 'x' | 'z'; gx: number; gz: number };

/** Y a-t-il déjà un bloc de mur (ou une porte, qui occupe tout l'étage) à ce bord et à cette hauteur ? */
function isOccupied(pieces: Pieces, level: number, e: EdgeRef, layer: number): boolean {
  const at = (l: number): string =>
    pieceKey({ slot: 'edge', level, gx: e.gx, gz: e.gz, axis: e.axis, layer: l });
  return !!pieces[at(layer)] || !!pieces[at(0)]?.startsWith('door');
}

/**
 * Pose « contre » le bloc touché par le rayon : selon l'endroit du bloc visé (haut, bas, gauche, droite),
 * le bloc voisin correspondant ; si l'orientation imposée est perpendiculaire au mur visé, le bloc d'angle
 * au bout le plus proche. Renvoie le premier emplacement posable, ou null.
 */
function attachTo(
  origin: Vec,
  pieces: Pieces,
  kind: PieceKind,
  level: number,
  lockAxis: 'x' | 'z' | undefined,
  hit: EdgeRef,
  layer: number,
  x: number,
  yRel: number,
  z: number,
): PiecePos | null {
  const idx = hit.axis === 'x' ? hit.gx : hit.gz;
  const u = (hit.axis === 'x' ? x : z) / CELL_SIZE_M - idx;
  const v = yRel / LAYER_HEIGHT_M - layer;
  const valid = (pos: PiecePos): boolean =>
    (pos.layer ?? 0) >= 0 &&
    (pos.layer ?? 0) < LAYERS_PER_STOREY &&
    isFree(pieces, kind, pos) &&
    isSupported(pieces, kind, pos);
  if (lockAxis && lockAxis !== hit.axis) {
    // Angle : au bout le plus proche, de l'un ou l'autre côté du mur visé (le plus proche de l'œil d'abord).
    const end = u < 0.5 ? idx : idx + 1;
    const sides: PiecePos[] =
      hit.axis === 'z'
        ? [hit.gx - 1, hit.gx].map((gx) => posFor(kind, level, gx, end, 'x', layer))
        : [hit.gz - 1, hit.gz].map((gz) => posFor(kind, level, end, gz, 'z', layer));
    const dist = (p: PiecePos): number =>
      p.axis === 'x'
        ? Math.abs((p.gx + 0.5) * CELL_SIZE_M - origin.x)
        : Math.abs((p.gz + 0.5) * CELL_SIZE_M - origin.z);
    sides.sort((a, b) => dist(a) - dist(b));
    return sides.find(valid) ?? null;
  }
  const step = (di: number, dl: number): PiecePos =>
    hit.axis === 'x'
      ? posFor(kind, level, hit.gx + di, hit.gz, 'x', layer + dl)
      : posFor(kind, level, hit.gx, hit.gz + di, 'z', layer + dl);
  const options = [
    { d: u, pos: step(-1, 0) },
    { d: 1 - u, pos: step(1, 0) },
    { d: v, pos: step(0, -1) },
    { d: 1 - v, pos: step(0, 1) },
  ].sort((a, b) => a.d - b.d);
  return options.find((o) => valid(o.pos))?.pos ?? null;
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
  /** Orientation imposée (touche R) : on ne vise que les bords le long de cet axe. */
  lockAxis?: 'x' | 'z',
): { pos: PiecePos; cell: { gx: number; gz: number } } | null {
  const y0 = level * STOREY_HEIGHT_M;
  const top = LAYERS_PER_STOREY * LAYER_HEIGHT_M;
  type Found = { pos: PiecePos; cell: { gx: number; gz: number }; t: number };
  let firstFree: Found | null = null;
  let firstHit: Found | null = null;
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t - y0;
    const z = origin.z + dir.z * t;
    if (y < 0) break;
    if (y >= top) continue;
    const layer = Math.min(LAYERS_PER_STOREY - 1, Math.floor(y / LAYER_HEIGHT_M));
    const cell = { gx: Math.floor(x / CELL_SIZE_M), gz: Math.floor(z / CELL_SIZE_M) };
    if (mode === 'place' && !firstHit && !firstFree) {
      // Le rayon touche le dessus d'une dalle de plafond : le mur se pose dessus, sur le bord le plus proche.
      for (let l = 0; l < LAYERS_PER_STOREY - 1; l++) {
        const slabTop = (l + 1) * LAYER_HEIGHT_M + 0.003;
        if (y > slabTop || y < slabTop - 0.1) continue;
        if (!pieces[pieceKey({ slot: 'ceiling', level, gx: cell.gx, gz: cell.gz, layer: l })])
          continue;
        const e2 = nearestEdge(x, z, lockAxis);
        const pos = posFor(kind, level, e2.gx, e2.gz, e2.axis, l + 1);
        if (isFree(pieces, kind, pos) && isSupported(pieces, kind, pos)) {
          firstHit = { pos, cell, t };
          break;
        }
      }
      if (firstHit) break;
    }
    if (mode === 'place' && !firstHit) {
      // Le rayon entre dans un bloc déjà posé : on pose contre lui (côté visé), pas derrière.
      const hits = [nearestEdge(x, z, 'x'), nearestEdge(x, z, 'z')]
        .filter((h) => h.dist <= SNAP_M && isOccupied(pieces, level, h, layer))
        .sort((p, q) => p.dist - q.dist);
      if (hits.length > 0) {
        const pos = attachTo(origin, pieces, kind, level, lockAxis, hits[0], layer, x, y, z);
        if (pos) {
          firstHit = { pos, cell, t };
          if (!firstFree) break;
        }
        continue;
      }
    }
    if (firstFree) continue;
    const e = nearestEdge(x, z, lockAxis);
    if (e.dist > SNAP_M) continue;
    const pos = posFor(kind, level, e.gx, e.gz, e.axis, layer);
    const usable =
      mode === 'remove'
        ? edgeKeysToRemove(pieces, pos, [layer]).length > 0
        : isFree(pieces, kind, pos) && isSupported(pieces, kind, pos);
    if (usable) {
      firstFree = { pos, cell, t };
      // En démolition, ou sans mur à portée, on s'arrête au premier bloc trouvé.
      if (mode === 'remove') break;
    }
  }
  // Un mur visé juste derrière un bloc posable du sol l'emporte : on voulait poser contre lui.
  if (firstHit && (!firstFree || firstFree.t > firstHit.t - ATTACH_BIAS_M)) {
    return { pos: firstHit.pos, cell: firstHit.cell };
  }
  if (firstFree) return { pos: firstFree.pos, cell: firstFree.cell };
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
  const e = nearestEdge(x, z, lockAxis);
  return {
    pos: posFor(kind, level, e.gx, e.gz, e.axis, 0),
    cell: { gx: Math.floor(x / CELL_SIZE_M), gz: Math.floor(z / CELL_SIZE_M) },
  };
}

/** Case sous le rayon dans un plan horizontal à la hauteur `y`. */
export function cellOnPlane(origin: Vec, dir: Vec, y: number): { gx: number; gz: number } | null {
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (y - origin.y) / dir.y;
  if (t < 0 || t > 200) return null;
  return {
    gx: Math.floor((origin.x + dir.x * t) / CELL_SIZE_M),
    gz: Math.floor((origin.z + dir.z * t) / CELL_SIZE_M),
  };
}

/**
 * Vise une dalle de plafond. Elle se pose sur la tranche haute d'un mur, à la hauteur de ce mur (même d'un
 * seul bloc). On suit le rayon et on retient la première dalle posable : celle sous le rayon ou l'une des
 * deux dalles qui touchent le bord de mur visé, à la hauteur du bloc visé. Sinon on retombe sur la case
 * du plan du plafond de l'étage sous le rayon (rouge si elle ne tient pas).
 * En mode `remove`, on ne vise que les dalles existantes.
 */
export function aimCeiling(
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
  const usable = (gx: number, gz: number, layer: number): PiecePos | null => {
    const pos = posFor(kind, level, gx, gz, undefined, layer);
    if (mode === 'remove') return pieces[pieceKey(pos)] ? pos : null;
    return isFree(pieces, kind, pos) && isSupported(pieces, kind, pos) ? pos : null;
  };
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const y = origin.y + dir.y * t - y0;
    if (y < 0 || y > top + 0.4) {
      if (y > top + 0.4 && dir.y > 0) break;
      continue;
    }
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    const gx = Math.floor(x / CELL_SIZE_M);
    const gz = Math.floor(z / CELL_SIZE_M);
    // Hauteurs possibles : le bloc dans lequel est le rayon, ou celui juste en dessous (rayon au-dessus du mur).
    const layers = [
      ...new Set([Math.floor(y / LAYER_HEIGHT_M), Math.floor((y - 0.4) / LAYER_HEIGHT_M)]),
    ]
      .filter((l) => l >= 0 && l < LAYERS_PER_STOREY)
      .sort((a, b) => b - a);
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
    for (const layer of layers) {
      for (const [cx, cz] of candidates) {
        const pos = usable(cx, cz, layer);
        if (pos) return { pos, cell: { gx: cx, gz: cz } };
      }
    }
  }
  if (mode === 'remove') return null;
  const cell = cellOnPlane(origin, dir, y0 + top);
  return cell ? { pos: posFor(kind, level, cell.gx, cell.gz), cell } : null;
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

/**
 * Vise une marche d'escalier. Pose : la case où le rayon touche le sol, et si elle prolonge une volée
 * existante (case juste après le haut d'une marche), la marche suivante, un bloc plus haut et dans le même
 * sens. Sans orientation imposée, la marche monte dans le sens du regard. Démolition : la marche touchée.
 */
export function aimStairs(
  origin: Vec,
  dir: Vec,
  pieces: Pieces,
  kind: PieceKind,
  level: number,
  maxDist: number,
  mode: 'place' | 'remove' = 'place',
  forcedRot?: number | null,
): { pos: PiecePos; cell: { gx: number; gz: number } } | null {
  const y0 = level * STOREY_HEIGHT_M;
  const top = LAYERS_PER_STOREY * LAYER_HEIGHT_M;
  const look = riseFromDirection(dir.x, dir.z);
  const rot = forcedRot ?? look;
  if (mode === 'remove') {
    for (let t = 0.3; t <= maxDist; t += STEP_M) {
      const y = origin.y + dir.y * t - y0;
      if (y < 0) break;
      if (y >= top) continue;
      const gx = Math.floor((origin.x + dir.x * t) / CELL_SIZE_M);
      const gz = Math.floor((origin.z + dir.z * t) / CELL_SIZE_M);
      const layer = Math.min(LAYERS_PER_STOREY - 1, Math.floor(y / LAYER_HEIGHT_M));
      for (let r = 0; r < 4; r++) {
        const pos = posFor(kind, level, gx, gz, undefined, layer, r);
        if (pieces[pieceKey(pos)]) return { pos, cell: { gx, gz } };
      }
    }
    return null;
  }
  // Le premier escalier touché par le rayon : on prolonge sa volée (marche suivante, un bloc plus haut).
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const y = origin.y + dir.y * t - y0;
    if (y < 0) break;
    if (y >= top) continue;
    const gx = Math.floor((origin.x + dir.x * t) / CELL_SIZE_M);
    const gz = Math.floor((origin.z + dir.z * t) / CELL_SIZE_M);
    const layer = Math.floor(y / LAYER_HEIGHT_M);
    for (let r = 0; r < 4; r++) {
      if (!pieces[pieceKey({ slot: 'stairs', level, gx, gz, layer, rot: r })]) continue;
      const [dx, dz] = RISE_DIR[r];
      if (layer + 1 >= LAYERS_PER_STOREY) break;
      const next = posFor(kind, level, gx + dx, gz + dz, undefined, layer + 1, r);
      if (isFree(pieces, kind, next)) return { pos: next, cell: { gx: gx + dx, gz: gz + dz } };
    }
  }
  const cell = cellOnPlane(origin, dir, y0);
  if (!cell) return null;
  // Prolonger une volée : une marche voisine dont le haut touche cette case.
  for (let r = 0; r < 4; r++) {
    const [dx, dz] = RISE_DIR[r];
    for (let layer = 0; layer < LAYERS_PER_STOREY - 1; layer++) {
      const below = pieceKey({
        slot: 'stairs',
        level,
        gx: cell.gx - dx,
        gz: cell.gz - dz,
        layer,
        rot: r,
      });
      if (pieces[below]) {
        const next = posFor(kind, level, cell.gx, cell.gz, undefined, layer + 1, r);
        if (isFree(pieces, kind, next)) return { pos: next, cell };
      }
    }
  }
  return { pos: posFor(kind, level, cell.gx, cell.gz, undefined, 0, rot), cell };
}

/**
 * Vise une dalle de sol. Elle s'accroche au premier objet touché par le rayon : une dalle de sol existante
 * (on la prolonge, du côté visé), un mur (la dalle se pose contre lui, côté œil), sinon le sol sous le curseur.
 * `cell` reste la case du sol sous le curseur (pour étendre un rectangle en glissant).
 */
export function aimFloor(
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
  const ground = cellOnPlane(origin, dir, y0 + 0.1);
  const cellAt = (gx: number, gz: number): PiecePos => posFor(kind, level, gx, gz);
  const free = (gx: number, gz: number): boolean => isFree(pieces, kind, cellAt(gx, gz));
  let wallHit: { x: number; z: number } | null = null;
  for (let t = 0.3; t <= maxDist; t += STEP_M) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t - y0;
    const z = origin.z + dir.z * t;
    if (y < 0.1) break;
    if (y >= top) continue;
    const layer = Math.min(LAYERS_PER_STOREY - 1, Math.floor(y / LAYER_HEIGHT_M));
    const hits = [nearestEdge(x, z, 'x'), nearestEdge(x, z, 'z')]
      .filter((h) => h.dist <= SNAP_M && isOccupied(pieces, level, h, layer))
      .sort((p, q) => p.dist - q.dist);
    if (hits.length > 0) {
      wallHit = { x, z };
      break;
    }
  }
  if (mode === 'remove') {
    const cell = ground ?? null;
    return cell && pieces[pieceKey(cellAt(cell.gx, cell.gz))]
      ? { pos: cellAt(cell.gx, cell.gz), cell }
      : null;
  }
  if (wallHit) {
    // Contre le mur : la dalle posée du côté de l'œil.
    const e = nearestEdge(wallHit.x, wallHit.z);
    const sides: [number, number][] =
      e.axis === 'x'
        ? [
            [e.gx, e.gz - 1],
            [e.gx, e.gz],
          ]
        : [
            [e.gx - 1, e.gz],
            [e.gx, e.gz],
          ];
    const d = ([gx, gz]: [number, number]): number =>
      Math.hypot((gx + 0.5) * CELL_SIZE_M - origin.x, (gz + 0.5) * CELL_SIZE_M - origin.z);
    sides.sort((a, b) => d(a) - d(b));
    const side = sides.find(([gx, gz]) => free(gx, gz));
    if (side)
      return { pos: cellAt(side[0], side[1]), cell: ground ?? { gx: side[0], gz: side[1] } };
  }
  if (!ground) return null;
  if (!free(ground.gx, ground.gz)) {
    // Sur une dalle déjà posée : on la prolonge du côté de la case visé le plus proche d'un bord.
    const t = (y0 + 0.1 - origin.y) / dir.y;
    const fx = (origin.x + dir.x * t) / CELL_SIZE_M - ground.gx;
    const fz = (origin.z + dir.z * t) / CELL_SIZE_M - ground.gz;
    const options: { d: number; gx: number; gz: number }[] = [
      { d: fx, gx: ground.gx - 1, gz: ground.gz },
      { d: 1 - fx, gx: ground.gx + 1, gz: ground.gz },
      { d: fz, gx: ground.gx, gz: ground.gz - 1 },
      { d: 1 - fz, gx: ground.gx, gz: ground.gz + 1 },
    ];
    options.sort((a, b) => a.d - b.d);
    const next = options.find((o) => free(o.gx, o.gz));
    if (next) return { pos: cellAt(next.gx, next.gz), cell: ground };
  }
  return { pos: cellAt(ground.gx, ground.gz), cell: ground };
}
