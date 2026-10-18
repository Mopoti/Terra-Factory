/**
 * Voies ferrées (voir `docs/trains.md`) : trois pièces sans sens, comme les modèles de `blender/scripts/ferroviaire.py`.
 *  - `straight` : tuile de 2 × 2 cases (1 m) ;
 *  - `curve` : tuile de 6 × 6 cases (3 m), quart de cercle de 1,5 m de rayon reliant le milieu de deux bords voisins ;
 *  - `ramp` : 2 × 8 cases (4 m), monte de 1 m ; la descente est la même pièce tournée d'un demi-tour.
 * Une pièce est posée sur la grille de cases ; ses deux extrémités (« ports ») se raccordent à celles d'une pièce voisine.
 * Un train est repéré sur la voie par une pièce, une abscisse `u` (m le long de la voie, depuis le port 0) et un sens.
 */
import { CELL_SIZE_M } from '../constants';

export type RailKind = 'straight' | 'curve' | 'ramp';
export const RAIL_KINDS: readonly RailKind[] = ['straight', 'curve', 'ramp'];

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
}

/** Hauteur du dessus des rails au-dessus du bas d'une pièce (m) : les roues des trains y reposent. */
export const RAIL_TOP_M = 0.12;
/** Rayon d'un virage (m) et élévation d'une rampe (m). */
export const CURVE_RADIUS_M = 1.5;
export const RAMP_RISE_M = 1;
const RAMP_RUN_M = 4;

/** Dimensions de l'emprise en cases (largeur selon x, profondeur selon z) pour ce quart de tour. */
export function footprintOf(kind: RailKind, turns: number): { w: number; d: number } {
  if (kind === 'straight') return { w: 2, d: 2 };
  if (kind === 'curve') return { w: 6, d: 6 };
  return turns % 2 === 0 ? { w: 2, d: 8 } : { w: 8, d: 2 };
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

/** Longueur de la voie d'une pièce (m), de son port 0 à son port 1. */
export function lengthOf(kind: RailKind): number {
  if (kind === 'straight') return 1;
  if (kind === 'curve') return (CURVE_RADIUS_M * Math.PI) / 2;
  return Math.hypot(RAMP_RUN_M, RAMP_RISE_M);
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
): { x: number; y: number; z: number; tx: number; tz: number; dy: number } {
  if (kind === 'straight') return { x: 0, y: 0, z: 0.5 - u, tx: 0, tz: -1, dy: 0 };
  if (kind === 'curve') {
    const th = Math.PI + u / CURVE_RADIUS_M;
    return {
      x: CURVE_RADIUS_M + CURVE_RADIUS_M * Math.cos(th),
      y: 0,
      z: CURVE_RADIUS_M + CURVE_RADIUS_M * Math.sin(th),
      tx: -Math.sin(th),
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
  const l = local(p.kind, Math.max(0, Math.min(lengthOf(p.kind), u)));
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

/** Les deux extrémités (ports) d'une pièce. */
export function portsOf(p: RailPiece): [Port, Port] {
  const len = lengthOf(p.kind);
  const a = poseOn(p, 0);
  const b = poseOn(p, len);
  return [
    { x: a.x, y: a.y, z: a.z, dx: -Math.sin(a.yaw), dz: -Math.cos(a.yaw) },
    { x: b.x, y: b.y, z: b.z, dx: Math.sin(b.yaw), dz: Math.cos(b.yaw) },
  ];
}

export interface PortLink {
  piece: number;
  port: 0 | 1;
}

const SAME_M = 0.08;
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

/** Les pièces posées et leurs raccords. */
export class TrackGraph {
  readonly byId = new Map<number, RailPiece>();
  private readonly links = new Map<number, [PortLink | null, PortLink | null]>();

  constructor(pieces: readonly RailPiece[]) {
    for (const p of pieces) this.byId.set(p.id, p);
    const ports = new Map<number, [Port, Port]>();
    for (const p of pieces) ports.set(p.id, portsOf(p));
    for (const p of pieces) {
      const mine = ports.get(p.id) as [Port, Port];
      const out: [PortLink | null, PortLink | null] = [null, null];
      for (const i of [0, 1] as const) {
        search: for (const q of pieces) {
          if (q.id === p.id) continue;
          const theirs = ports.get(q.id) as [Port, Port];
          for (const j of [0, 1] as const)
            if (portsMeet(mine[i], theirs[j])) {
              out[i] = { piece: q.id, port: j };
              break search;
            }
        }
      }
      this.links.set(p.id, out);
    }
  }

  /** La pièce raccordée à ce port, ou null (bout de voie). */
  neighbour(piece: number, port: 0 | 1): PortLink | null {
    return this.links.get(piece)?.[port] ?? null;
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
      const len = lengthOf(p.kind);
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
          : { piece: next.id, u: lengthOf(next.kind), dir: -1 };
    }
    return { pos: cur, blocked: true, left };
  }
}

/** Les ports de la voie où l'on peut raccorder une nouvelle pièce (aucune pièce de l'autre côté). */
export function freePorts(
  pieces: readonly RailPiece[],
): { piece: number; port: 0 | 1; at: Port }[] {
  const graph = new TrackGraph(pieces);
  const out: { piece: number; port: 0 | 1; at: Port }[] = [];
  for (const p of pieces) {
    const ports = portsOf(p);
    for (const i of [0, 1] as const)
      if (!graph.neighbour(p.id, i)) out.push({ piece: p.id, port: i, at: ports[i] });
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
    for (const i of [0, 1] as const) {
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
