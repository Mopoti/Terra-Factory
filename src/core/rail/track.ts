/**
 * Voies ferrées (voir `docs/trains.md`) : pièces posées sur la grille, comme les modèles de
 * `blender/scripts/ferroviaire.py`, agrandis de `RAIL_SCALE` pour aller avec des trains à l'échelle du personnage
 * (écartement d'environ 1,5 m) :
 *  - `straight` : une tuile de 2,5 m (5 × 5 cases) ;
 *  - `curve`, `curve_wide`, `curve_large` : virages serré (3 × 3 tuiles, rayon 3,75 m), large (5 × 5, 6,25 m) et très
 *    large (7 × 7, 8,75 m) ; quart de cercle reliant le milieu de deux bords voisins du bloc ;
 *  - `ramp` : 1 × 4 tuiles (10 m), monte de 2,5 m ; la descente est la même pièce tournée d'un demi-tour ;
 *  - `switch_r`, `switch_l` : aiguillages (3 × 3 tuiles) : du port 0, la voie directe va tout droit au port 1, la voie
 *    déviée tourne (vers la droite ou la gauche, en virage serré) jusqu'au port 2. `branch` dit laquelle est donnée.
 * Une pièce est posée sur la grille de cases ; ses extrémités (« ports ») se raccordent à celles d'une pièce voisine.
 * Un train est repéré sur la voie par une pièce, une abscisse `u` (m le long de la voie, depuis le port 0) et un sens.
 * Dans le graphe, un aiguillage compte pour deux pièces : sa voie directe (son identifiant) et sa voie déviée (l'opposé
 * de son identifiant, voir `branchId`), qui partagent le port 0.
 */
import { CELL_SIZE_M } from '../constants';

export type RailKind =
  'straight' | 'curve' | 'curve_wide' | 'curve_large' | 'ramp' | 'switch_r' | 'switch_l';
export const RAIL_KINDS: readonly RailKind[] = [
  'straight',
  'curve',
  'curve_wide',
  'curve_large',
  'ramp',
  'switch_r',
  'switch_l',
];
export type CurveKind = 'curve' | 'curve_wide' | 'curve_large';
export const CURVE_KINDS: readonly CurveKind[] = ['curve', 'curve_wide', 'curve_large'];
export const isCurve = (k: RailKind): k is CurveKind =>
  (CURVE_KINDS as readonly string[]).includes(k);
export const isSwitch = (k: RailKind): k is 'switch_r' | 'switch_l' =>
  k === 'switch_r' || k === 'switch_l';

export interface RailPiece {
  id: number;
  kind: RailKind;
  /** Coin de l'emprise, en cases. */
  gx: number;
  gz: number;
  /** Quarts de tour (0 à 3), comme `MeshBuilder.model`. */
  turns: number;
  /** Hauteur (m) du bas de la pièce : 0 au sol, 1 sur une rampe qui a monté… */
  level: number;
  /** Aiguillage : voie donnée aux trains qui arrivent par le port 0 (0 : directe, 1 : déviée). */
  branch?: 0 | 1;
  /** Dans le graphe seulement : voie d'un aiguillage que représente cette pièce (0 : directe, 1 : déviée). */
  route?: 0 | 1;
}

/** Identifiant de la voie déviée d'un aiguillage dans le graphe (et inversement). */
export const branchId = (id: number): number => -id;
/** Pièce posée (dans `changes.rails`) à laquelle appartient une pièce du graphe. */
export const baseId = (id: number): number => Math.abs(id);

/** Agrandissement des modèles de voie (créés pour une voie étroite de 60 cm) : écartement de 1,5 m. */
export const RAIL_SCALE = 2.5;
/** Côté d'une tuile de voie (m, et en cases). */
export const TILE_M = RAIL_SCALE;
export const TILE_CELLS = TILE_M / CELL_SIZE_M;
/** Hauteur du dessus des rails au-dessus du bas d'une pièce (m) : les roues des trains y reposent. */
export const RAIL_TOP_M = 0.12 * RAIL_SCALE;
/** Rayon du virage serré (m) et élévation d'une rampe (m). */
export const CURVE_RADIUS_M = 1.5 * RAIL_SCALE;
export const RAMP_RISE_M = 1 * RAIL_SCALE;
const RAMP_RUN_M = 4 * RAIL_SCALE;

/** Côté du bloc d'un virage ou d'un aiguillage (en tuiles). */
export function blockTiles(kind: RailKind): number {
  if (kind === 'curve_wide') return 5;
  if (kind === 'curve_large') return 7;
  return 3;
}
/** Rayon (m) d'un virage, ou de la voie déviée d'un aiguillage : la moitié du côté du bloc. */
export const radiusOf = (kind: RailKind): number => (blockTiles(kind) * TILE_M) / 2;

/** Dimensions de l'emprise en cases (largeur selon x, profondeur selon z) pour ce quart de tour. */
export function footprintOf(kind: RailKind, turns: number): { w: number; d: number } {
  if (kind === 'straight') return { w: TILE_CELLS, d: TILE_CELLS };
  if (kind !== 'ramp')
    return { w: blockTiles(kind) * TILE_CELLS, d: blockTiles(kind) * TILE_CELLS };
  return turns % 2 === 0
    ? { w: TILE_CELLS, d: 4 * TILE_CELLS }
    : { w: 4 * TILE_CELLS, d: TILE_CELLS };
}

/** Centre de la pièce (m). */
export function centerOf(p: RailPiece): { x: number; z: number } {
  const { w, d } = footprintOf(p.kind, p.turns);
  return { x: (p.gx + w / 2) * CELL_SIZE_M, z: (p.gz + d / 2) * CELL_SIZE_M };
}

/** Position de la pièce pour qu'elle soit centrée en (x, z) (m), au quart de case près. */
export function cornerFor(
  kind: RailKind,
  turns: number,
  x: number,
  z: number,
): { gx: number; gz: number } {
  const { w, d } = footprintOf(kind, turns);
  return { gx: Math.round(x / CELL_SIZE_M - w / 2), gz: Math.round(z / CELL_SIZE_M - d / 2) };
}

/** Tourne un point local de `turns` quarts de tour (même convention que `MeshBuilder.model`). */
function turn(x: number, z: number, turns: number): [number, number] {
  switch (((turns % 4) + 4) % 4) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

/** Longueur de la voie d'une pièce (m), de son port 0 à son port 1 (aiguillage : de la voie `route`). */
export function lengthOf(kind: RailKind, route: 0 | 1 = 0): number {
  if (kind === 'straight') return TILE_M;
  if (kind === 'ramp') return Math.hypot(RAMP_RUN_M, RAMP_RISE_M);
  if (isSwitch(kind) && route === 0) return 2 * radiusOf(kind);
  return (radiusOf(kind) * Math.PI) / 2;
}

/** Longueur de la voie d'une pièce du graphe (la voie déviée d'un aiguillage n'a pas la longueur de la directe). */
export const lengthOfPiece = (p: RailPiece): number => lengthOf(p.kind, p.route ?? 0);

/** Les voies d'une pièce posée : elle-même, ou les deux voies d'un aiguillage (pièces du graphe). */
export function routesOf(p: RailPiece): RailPiece[] {
  if (!isSwitch(p.kind) || p.route !== undefined) return [p];
  return [
    { ...p, route: 0 },
    { ...p, id: branchId(p.id), route: 1 },
  ];
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Cap (rad) : le sens de marche est (sin cap, cos cap), comme le joueur et les véhicules. */
  yaw: number;
  /** Pente (hauteur gagnée par mètre parcouru dans le sens de marche). */
  slope: number;
}

/** Point local (avant rotation) et tangente de la voie vers le port 1, à l'abscisse `u`. */
function local(
  kind: RailKind,
  u: number,
  route: 0 | 1 = 0,
): { x: number; y: number; z: number; tx: number; tz: number; dy: number } {
  if (kind === 'straight') return { x: 0, y: 0, z: TILE_M / 2 - u, tx: 0, tz: -1, dy: 0 };
  if (isSwitch(kind) && route === 0) {
    const r = radiusOf(kind);
    return { x: 0, y: 0, z: r - u, tx: 0, tz: -1, dy: 0 };
  }
  if (kind !== 'ramp') {
    // Quart de cercle du milieu du bord +z au milieu du bord +x (aiguillage à gauche : vers le bord −x).
    const r = radiusOf(kind);
    const m = kind === 'switch_l' ? -1 : 1;
    const th = Math.PI + u / r;
    return {
      x: m * (r + r * Math.cos(th)),
      y: 0,
      z: r + r * Math.sin(th),
      tx: -m * Math.sin(th),
      tz: Math.cos(th),
      dy: 0,
    };
  }
  const len = lengthOf('ramp');
  return {
    x: 0,
    y: (u / len) * RAMP_RISE_M,
    z: RAMP_RUN_M / 2 - (u / len) * RAMP_RUN_M,
    tx: 0,
    tz: -1,
    dy: RAMP_RISE_M / len,
  };
}

/** Position et cap sur la voie d'une pièce, à l'abscisse `u`, en marchant dans le sens `dir` (+1 : vers le port 1). */
export function poseOn(p: RailPiece, u: number, dir: 1 | -1 = 1): Pose {
  const route = p.route ?? 0;
  const l = local(p.kind, Math.max(0, Math.min(lengthOf(p.kind, route), u)), route);
  const [rx, rz] = turn(l.x, l.z, p.turns);
  const [tx, tz] = turn(l.tx, l.tz, p.turns);
  const c = centerOf(p);
  return {
    x: c.x + rx,
    y: p.level + l.y,
    z: c.z + rz,
    yaw: Math.atan2(tx * dir, tz * dir),
    slope: l.dy * dir,
  };
}

export interface Port {
  x: number;
  y: number;
  z: number;
  /** Direction horizontale vers l'extérieur de la pièce (vecteur unitaire). */
  dx: number;
  dz: number;
}

/**
 * Les extrémités (ports) d'une pièce : deux, ou trois pour un aiguillage posé (port 0 commun, port 1 au bout de la voie
 * directe, port 2 au bout de la voie déviée). Une pièce du graphe (une voie d'aiguillage) n'en a que deux.
 */
export function portsOf(p: RailPiece): Port[] {
  const out: Port[] = [];
  for (const r of routesOf(p)) {
    const a = poseOn(r, 0);
    const b = poseOn(r, lengthOfPiece(r));
    if (out.length === 0)
      out.push({ x: a.x, y: a.y, z: a.z, dx: -Math.sin(a.yaw), dz: -Math.cos(a.yaw) });
    out.push({ x: b.x, y: b.y, z: b.z, dx: Math.sin(b.yaw), dz: Math.cos(b.yaw) });
  }
  return out;
}

/** Position du levier d'un aiguillage (m), sur le côté opposé à la voie déviée, près de la pointe. */
export function leverOf(p: RailPiece): { x: number; y: number; z: number } {
  const r = radiusOf(p.kind);
  const m = p.kind === 'switch_l' ? -1 : 1;
  const [rx, rz] = turn(-m * 0.5 * r, 0.75 * r, p.turns);
  const c = centerOf(p);
  return { x: c.x + rx, y: p.level, z: c.z + rz };
}

export interface PortLink {
  piece: number;
  port: 0 | 1;
}

const SAME_M = 0.2;
const portsMeet = (a: Port, b: Port): boolean =>
  Math.hypot(a.x - b.x, a.z - b.z) <= SAME_M &&
  Math.abs(a.y - b.y) <= SAME_M &&
  a.dx * b.dx + a.dz * b.dz < -0.9;

/** Position d'un train sur la voie. */
export interface TrackPos {
  piece: number;
  u: number;
  /** +1 : on avance vers le port 1 de la pièce ; −1 : vers le port 0. */
  dir: 1 | -1;
}

export const flip = (p: TrackPos): TrackPos => ({ ...p, dir: p.dir === 1 ? -1 : 1 });

/** Les pièces posées et leurs raccords (un aiguillage y compte pour ses deux voies, voir `routesOf`). */
export class TrackGraph {
  readonly byId = new Map<number, RailPiece>();
  /** Pour chaque pièce du graphe et chacun de ses deux ports : les pièces qui s'y raccordent. */
  private readonly links = new Map<number, [PortLink[], PortLink[]]>();

  constructor(pieces: readonly RailPiece[]) {
    const all = pieces.flatMap(routesOf);
    for (const p of all) this.byId.set(p.id, p);
    const ports = new Map<number, Port[]>();
    // Grille de 60 cm : on ne compare un port qu'à ceux des cases voisines (la voie peut compter des milliers de pièces).
    const BUCKET = 0.6;
    const bucket = new Map<string, { piece: number; port: 0 | 1 }[]>();
    const keyOf = (x: number, z: number): string =>
      `${Math.round(x / BUCKET)},${Math.round(z / BUCKET)}`;
    for (const p of all) {
      const pp = portsOf(p);
      ports.set(p.id, pp);
      for (const i of [0, 1] as const) {
        const k = keyOf(pp[i].x, pp[i].z);
        const list = bucket.get(k) ?? [];
        list.push({ piece: p.id, port: i });
        bucket.set(k, list);
      }
    }
    for (const p of all) {
      const mine = ports.get(p.id) as Port[];
      const out: [PortLink[], PortLink[]] = [[], []];
      for (const i of [0, 1] as const) {
        const cx = Math.round(mine[i].x / BUCKET);
        const cz = Math.round(mine[i].z / BUCKET);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++)
            for (const cand of bucket.get(`${cx + dx},${cz + dz}`) ?? []) {
              if (baseId(cand.piece) === baseId(p.id)) continue;
              const theirs = ports.get(cand.piece) as Port[];
              if (portsMeet(mine[i], theirs[cand.port]))
                out[i].push({ piece: cand.piece, port: cand.port });
            }
      }
      this.links.set(p.id, out);
    }
  }

  /** La voie d'un aiguillage est-elle celle qu'il donne (toujours vrai pour une autre pièce) ? */
  private active(id: number): boolean {
    const p = this.byId.get(id);
    if (!p || p.route === undefined) return true;
    return (p.branch ?? 0) === p.route;
  }

  /**
   * La pièce raccordée à ce port, ou null (bout de voie). Devant la pointe d'un aiguillage (son port 0), c'est la voie
   * qu'il donne ; en venant du talon (ports 1 et 2), on passe toujours.
   */
  neighbour(piece: number, port: 0 | 1): PortLink | null {
    const list = this.links.get(piece)?.[port] ?? [];
    if (list.length <= 1) return list[0] ?? null;
    return list.find((l) => this.active(l.piece)) ?? list[0];
  }

  has(piece: number): boolean {
    return this.byId.has(piece);
  }

  /** Cap, position et pente d'un train repéré sur la voie. */
  pose(pos: TrackPos): Pose | null {
    const p = this.byId.get(pos.piece);
    return p ? poseOn(p, pos.u, pos.dir) : null;
  }

  /**
   * Avance de `dist` mètres (≥ 0) dans le sens de marche. `blocked` : on a atteint un bout de voie (la position reste
   * au bout) ; `left` : la distance qui n'a pas pu être parcourue.
   */
  advance(pos: TrackPos, dist: number): { pos: TrackPos; blocked: boolean; left: number } {
    let cur = { ...pos };
    let left = dist;
    for (let guard = 0; guard < 400; guard++) {
      const p = this.byId.get(cur.piece);
      if (!p) return { pos: cur, blocked: true, left };
      const len = lengthOfPiece(p);
      const room = cur.dir === 1 ? len - cur.u : cur.u;
      if (left <= room) {
        cur.u += cur.dir * left;
        return { pos: cur, blocked: false, left: 0 };
      }
      left -= room;
      const link = this.neighbour(cur.piece, cur.dir === 1 ? 1 : 0);
      if (!link) {
        cur.u = cur.dir === 1 ? len : 0;
        return { pos: cur, blocked: true, left };
      }
      const next = this.byId.get(link.piece);
      if (!next) return { pos: cur, blocked: true, left };
      cur =
        link.port === 0
          ? { piece: next.id, u: 0, dir: 1 }
          : { piece: next.id, u: lengthOfPiece(next), dir: -1 };
    }
    return { pos: cur, blocked: true, left };
  }

  /**
   * Premier aiguillage pris par la pointe (par son port 0) en avançant depuis `pos`, à moins de `maxDist` mètres :
   * celui dont la position décide de la route du train. Renvoie l'identifiant de la pièce posée, ou null.
   */
  switchAhead(pos: TrackPos, maxDist: number): number | null {
    let cur = { ...pos };
    let dist = 0;
    for (let guard = 0; guard < 400; guard++) {
      const p = this.byId.get(cur.piece);
      if (!p) return null;
      const len = lengthOfPiece(p);
      dist += cur.dir === 1 ? len - cur.u : cur.u;
      if (dist > maxDist) return null;
      const link = this.neighbour(cur.piece, cur.dir === 1 ? 1 : 0);
      if (!link) return null;
      const next = this.byId.get(link.piece);
      if (!next) return null;
      if (next.route !== undefined && link.port === 0) return baseId(next.id);
      cur =
        link.port === 0
          ? { piece: next.id, u: 0, dir: 1 }
          : { piece: next.id, u: lengthOfPiece(next), dir: -1 };
    }
    return null;
  }
}

/** Les ports de la voie où l'on peut raccorder une nouvelle pièce (aucune pièce de l'autre côté). */
export function freePorts(
  pieces: readonly RailPiece[],
): { piece: number; port: 0 | 1; at: Port }[] {
  const graph = new TrackGraph(pieces);
  const out: { piece: number; port: 0 | 1; at: Port }[] = [];
  for (const p of graph.byId.values()) {
    const ports = portsOf(p);
    for (const i of [0, 1] as const) {
      // Le port 0 d'une voie déviée est celui de la voie directe : compté une fois.
      if (i === 0 && p.route === 1) continue;
      if (!graph.neighbour(p.id, i)) out.push({ piece: p.id, port: i, at: ports[i] });
    }
  }
  return out;
}

/**
 * Pièces qui se raccordent exactement au port libre `target` : pour chaque quart de tour et chaque extrémité de la
 * nouvelle pièce, celle qui tombe pile sur le port avec la direction opposée.
 */
export function matesFor(
  kind: RailKind,
  target: Port,
): { gx: number; gz: number; turns: number; level: number }[] {
  const out: { gx: number; gz: number; turns: number; level: number }[] = [];
  for (let turns = 0; turns < 4; turns++) {
    const probe: RailPiece = { id: -1, kind, gx: 0, gz: 0, turns, level: 0 };
    const ports = portsOf(probe);
    for (let i = 0; i < ports.length; i++) {
      const mine = ports[i];
      if (mine.dx * target.dx + mine.dz * target.dz > -0.9) continue;
      // Décalage qui amène ce port sur la cible.
      const ox = target.x - mine.x;
      const oz = target.z - mine.z;
      const gx = Math.round(ox / CELL_SIZE_M);
      const gz = Math.round(oz / CELL_SIZE_M);
      const placed: RailPiece = { ...probe, gx, gz, level: target.y - mine.y };
      const check = portsOf(placed)[i];
      if (Math.hypot(check.x - target.x, check.z - target.z) > SAME_M) continue;
      out.push({ gx, gz, turns, level: placed.level });
    }
  }
  // Pas deux fois la même pose : une pièce droite tournée d'un demi-tour est la même pièce.
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.gx},${m.gz},${kind === 'straight' ? m.turns % 2 : m.turns}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Cases (gx, gz) couvertes par l'emprise d'une pièce. */
export function cellsOf(p: RailPiece): [number, number][] {
  const { w, d } = footprintOf(p.kind, p.turns);
  const out: [number, number][] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) out.push([p.gx + x, p.gz + z]);
  return out;
}

/**
 * Cases réellement prises par la voie : toute l'emprise pour une tuile droite et une rampe, mais pour un virage ou un
 * aiguillage seulement les cases proches de la voie (le reste du bloc est libre : arbres, rochers, autre voie).
 */
export function trackCellsOf(p: RailPiece): [number, number][] {
  if (p.kind === 'straight' || p.kind === 'ramp') return cellsOf(p);
  const keep = new Set<string>();
  const { w, d } = footprintOf(p.kind, p.turns);
  const reach = 1.6; // demi-écartement + marge (m)
  const span = Math.ceil(reach / CELL_SIZE_M);
  for (const r of routesOf(p)) {
    const len = lengthOfPiece(r);
    for (let u = 0; u <= len + 1e-6; u += CELL_SIZE_M / 2) {
      const q = poseOn(r, Math.min(u, len));
      const cx = Math.floor(q.x / CELL_SIZE_M);
      const cz = Math.floor(q.z / CELL_SIZE_M);
      for (let dx = -span; dx <= span; dx++)
        for (let dz = -span; dz <= span; dz++) {
          const gx = cx + dx;
          const gz = cz + dz;
          // Jamais hors du bloc : les cases au-delà des bords appartiennent à la pièce voisine.
          if (gx < p.gx || gx >= p.gx + w || gz < p.gz || gz >= p.gz + d) continue;
          if (Math.hypot((gx + 0.5) * CELL_SIZE_M - q.x, (gz + 0.5) * CELL_SIZE_M - q.z) <= reach)
            keep.add(`${gx},${gz}`);
        }
    }
  }
  return [...keep].map((k) => k.split(',').map(Number) as [number, number]);
}
