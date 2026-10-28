/**
 * Voies ferrées (voir `docs/rails-refonte.md`) : peu de pièces, toutes à l'échelle des trains (écartement d'environ
 * 1,5 m), posées bout à bout au millimètre près, dans huit directions (tous les 45°) :
 *  - `straight` : un droit, long d'une tuile (2,5 m) le long d'un axe, d'une diagonale de tuile (3,54 m) en diagonale ;
 *  - `curve_l` / `curve_r` : le virage unique de 45° (à gauche / à droite), de rayon 8,75 m ; huit font un cercle ;
 *  - `ramp` : 10 m de long, monte de 2,5 m (la descente est la même pièce prise par l'autre bout).
 * Une pièce est repérée par son port 0 (position en mètres, `x`, `z`, et hauteur `level`) et son cap `h` (0 à 7, par pas
 * de 45° : 0 vers +z, 2 vers +x, 4 vers −z, 6 vers −x) : le sens de marche en quittant le port 0. Ses extrémités
 * (« ports ») se raccordent à celles d'une pièce voisine. Un train est repéré sur la voie par une pièce, une abscisse `u`
 * (m le long de la voie, depuis le port 0) et un sens.
 * Il n'y a pas de pièce « aiguillage » : un embranchement est une pièce posée au bout d'une voie qui en a déjà une autre
 * (un bout de voie a plusieurs suites). Le conducteur ou le pilote automatique choisit la voie ; sans choix, tout droit.
 */
import { CELL_SIZE_M } from '../constants';

export type RailKind = 'straight' | 'curve_l' | 'curve_r' | 'ramp';
export const RAIL_KINDS: readonly RailKind[] = ['straight', 'curve_l', 'curve_r', 'ramp'];
export const isCurve = (k: RailKind): k is 'curve_l' | 'curve_r' =>
  k === 'curve_l' || k === 'curve_r';

export interface RailPiece {
  id: number;
  kind: RailKind;
  /** Position du port 0 (m), au millimètre. */
  x: number;
  z: number;
  /** Cap du sens de marche en quittant le port 0 : 0 à 7, par pas de 45° (0 vers +z, 2 vers +x, 4 vers −z, 6 vers −x). */
  h: number;
  /** Hauteur (m) du port 0 : 0 au sol, 2,5 au sommet d'une rampe… */
  level: number;
}

/** Pièce posée (dans `changes.rails`) à laquelle appartient une pièce du graphe (les deux sont la même). */
export const baseId = (id: number): number => Math.abs(id);

/** Agrandissement des modèles de voie (créés pour une voie étroite de 60 cm) : écartement de 1,5 m. */
export const RAIL_SCALE = 2.5;
/** Côté d'une tuile de voie (m, et en cases). */
export const TILE_M = RAIL_SCALE;
export const TILE_CELLS = TILE_M / CELL_SIZE_M;
/** Hauteur du dessus des rails au-dessus du bas d'une pièce (m) : les roues des trains y reposent. */
export const RAIL_TOP_M = 0.12 * RAIL_SCALE;
/** Rayon du virage de 45° (m) : 3,5 tuiles. */
export const CURVE_RADIUS_M = 3.5 * TILE_M;
export const RAMP_RISE_M = 1 * RAIL_SCALE;
export const RAMP_RUN_M = 4 * RAIL_SCALE;
/** Demi-largeur de l'emprise d'une voie (m) : deux voies côte à côte, à une tuile d'écart, ne se touchent pas. */
export const HALF_WIDTH_M = 1.2;

/** Arrondi au millimètre : les positions enregistrées restent propres. */
export const mm = (v: number): number => Math.round(v * 1000) / 1000;

/** Direction (vecteur unitaire dans le plan) du cap `h`. */
export function headingDir(h: number): { dx: number; dz: number } {
  const a = (((h % 8) + 8) % 8) * (Math.PI / 4);
  return { dx: Math.round(Math.sin(a) * 1e9) / 1e9, dz: Math.round(Math.cos(a) * 1e9) / 1e9 };
}
/** Cap (0 à 7) le plus proche d'une direction. */
export const headingOf = (dx: number, dz: number): number =>
  (((Math.round(Math.atan2(dx, dz) / (Math.PI / 4)) % 8) + 8) % 8) as number;

/** Longueur de la voie d'une pièce (m), de son port 0 à son port 1. */
export function lengthOf(kind: RailKind, h = 0): number {
  if (kind === 'straight') return h % 2 === 0 ? TILE_M : TILE_M * Math.SQRT2;
  if (kind === 'ramp') return Math.hypot(RAMP_RUN_M, RAMP_RISE_M);
  return (CURVE_RADIUS_M * Math.PI) / 4;
}
/** Longueur de la voie d'une pièce posée. */
export const lengthOfPiece = (p: RailPiece): number => lengthOf(p.kind, p.h);

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Cap (rad) : le sens de marche est (sin cap, cos cap), comme le joueur et les véhicules. */
  yaw: number;
  /** Pente (hauteur gagnée par mètre parcouru dans le sens de marche). */
  slope: number;
}

/** Position et cap sur la voie d'une pièce, à l'abscisse `u`, en marchant dans le sens `dir` (+1 : vers le port 1). */
export function poseOn(p: RailPiece, u: number, dir: 1 | -1 = 1): Pose {
  const len = lengthOfPiece(p);
  const s = Math.max(0, Math.min(len, u));
  const y0 = (p.h * Math.PI) / 4;
  let x: number;
  let z: number;
  let yaw: number;
  let rise = 0;
  if (p.kind === 'straight' || p.kind === 'ramp') {
    // Une rampe avance de `RAMP_RUN_M` à plat pendant que la voie fait `len` en pente.
    const along = p.kind === 'ramp' ? (s / len) * RAMP_RUN_M : s;
    x = p.x + Math.sin(y0) * along;
    z = p.z + Math.cos(y0) * along;
    yaw = y0;
    if (p.kind === 'ramp') rise = (s / len) * RAMP_RISE_M;
  } else {
    // Centre de courbure à gauche (yaw qui croît) ou à droite ; θ = angle déjà tourné.
    const sign = p.kind === 'curve_l' ? 1 : -1;
    const th = s / CURVE_RADIUS_M;
    const lx = Math.cos(y0) * sign;
    const lz = -Math.sin(y0) * sign;
    const cx = p.x + lx * CURVE_RADIUS_M;
    const cz = p.z + lz * CURVE_RADIUS_M;
    const yaw1 = y0 + sign * th;
    x = cx - Math.cos(yaw1) * sign * CURVE_RADIUS_M;
    z = cz + Math.sin(yaw1) * sign * CURVE_RADIUS_M;
    yaw = yaw1;
  }
  return {
    x,
    y: p.level + rise,
    z,
    yaw: dir === 1 ? yaw : yaw + Math.PI,
    slope: p.kind === 'ramp' ? (RAMP_RISE_M / len) * dir : 0,
  };
}

/** Milieu de la voie d'une pièce (m). */
export function centerOf(p: RailPiece): { x: number; z: number } {
  const q = poseOn(p, lengthOfPiece(p) / 2);
  return { x: q.x, z: q.z };
}

export interface Port {
  x: number;
  y: number;
  z: number;
  /** Direction horizontale vers l'extérieur de la pièce (vecteur unitaire). */
  dx: number;
  dz: number;
}

/** Les extrémités (ports) d'une pièce : son port 0 et son port 1. */
export function portsOf(p: RailPiece): Port[] {
  const a = poseOn(p, 0);
  const b = poseOn(p, lengthOfPiece(p));
  return [
    { x: a.x, y: a.y, z: a.z, dx: -Math.sin(a.yaw), dz: -Math.cos(a.yaw) },
    { x: b.x, y: b.y, z: b.z, dx: Math.sin(b.yaw), dz: Math.cos(b.yaw) },
  ];
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

/** Les pièces posées et leurs raccords. */
export class TrackGraph {
  readonly byId = new Map<number, RailPiece>();
  /** Pour chaque pièce du graphe et chacun de ses deux ports : les pièces qui s'y raccordent. */
  private readonly links = new Map<number, [PortLink[], PortLink[]]>();

  constructor(pieces: readonly RailPiece[]) {
    const all = pieces;
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
    // Devant un embranchement, la voie la plus droite d'abord (c'est celle que prend un train sans consigne).
    for (const lists of this.links.values())
      for (const list of lists)
        if (list.length > 1) {
          const lat = new Map(list.map((l) => [l, Math.abs(this.lateralOf(l))] as const));
          list.sort((a, b) => (lat.get(a) as number) - (lat.get(b) as number) || a.piece - b.piece);
        }
  }

  /**
   * La pièce raccordée à ce port, ou null (bout de voie). Devant un embranchement (plusieurs voies qui partent du même
   * point), c'est la plus droite : sans choix du conducteur ou du pilote, on va tout droit.
   */
  neighbour(piece: number, port: 0 | 1): PortLink | null {
    return this.links.get(piece)?.[port]?.[0] ?? null;
  }

  /** Écart latéral (m, > 0 : à droite) de la voie qui part d'un port, mesuré à 5 m : sert à reconnaître « tout droit ». */
  private lateralOf(link: PortLink): number {
    const s = this.byId.get(link.piece) as RailPiece;
    const sl = lengthOfPiece(s);
    const at = portsOf(s)[link.port];
    const q = poseOn(s, link.port === 0 ? Math.min(5, sl) : sl - Math.min(5, sl));
    return (q.x - at.x) * -at.dz + (q.z - at.z) * at.dx;
  }

  /**
   * Premier choix de voie devant `pos`, à moins de `maxDist` mètres : un embranchement tangent (plusieurs voies qui partent du même point). `lateral` : écart à 5 m (> 0 : à droite).
   */
  choiceAhead(
    pos: TrackPos,
    maxDist: number,
  ): { kind: 'junction'; options: { piece: number; lateral: number; open: boolean }[] } | null {
    let cur = { ...pos };
    let dist = 0;
    for (let guard = 0; guard < 400; guard++) {
      const p = this.byId.get(cur.piece);
      if (!p) return null;
      const len = lengthOfPiece(p);
      dist += cur.dir === 1 ? len - cur.u : cur.u;
      if (dist > maxDist) return null;
      const port = cur.dir === 1 ? 1 : 0;
      const list = this.links.get(cur.piece)?.[port] ?? [];
      if (new Set(list.map((l) => baseId(l.piece))).size > 1) {
        return {
          kind: 'junction',
          options: list.map((l, i) => ({
            piece: l.piece,
            lateral: this.lateralOf(l),
            // La première voie de la liste est celle que prend un train sans consigne : tout droit.
            open: i === 0,
          })),
        };
      }
      const link = this.neighbour(cur.piece, port);
      if (!link) return null;
      const next = this.byId.get(link.piece);
      if (!next) return null;
      cur =
        link.port === 0
          ? { piece: next.id, u: 0, dir: 1 }
          : { piece: next.id, u: lengthOfPiece(next), dir: -1 };
    }
    return null;
  }

  /**
   * Devant un embranchement, la voie que le convoi a vraiment suivie (une pièce de `prefer`), sinon rien : un train
   * qui a franchi un aiguillage garde sa queue sur la voie d'où il vient, quelle que soit la position des lames.
   */
  private followed(piece: number, port: 0 | 1, prefer: ReadonlySet<number>): PortLink | null {
    const list = this.links.get(piece)?.[port] ?? [];
    return list.length > 1 ? (list.find((l) => prefer.has(l.piece)) ?? null) : null;
  }

  /** Toutes les pièces raccordées à ce port (plusieurs devant la pointe d'un aiguillage ou d'un embranchement). */
  linksAt(piece: number, port: 0 | 1): readonly PortLink[] {
    return this.links.get(piece)?.[port] ?? [];
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
  advance(
    pos: TrackPos,
    dist: number,
    prefer?: ReadonlySet<number>,
  ): { pos: TrackPos; blocked: boolean; left: number } {
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
      const port = cur.dir === 1 ? 1 : 0;
      const link =
        (prefer && this.followed(cur.piece, port, prefer)) || this.neighbour(cur.piece, port);
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
}

/** Points de la voie d'une pièce, tous les ~0,3 m, avec le cap : de quoi chercher où deux voies se coupent. */
function centreline(
  p: RailPiece,
): { x: number; z: number; tx: number; tz: number; end: boolean }[] {
  const len = lengthOfPiece(p);
  const n = Math.max(2, Math.ceil(len / 0.3));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = (len * i) / n;
    const q = poseOn(p, u);
    out.push({
      x: q.x,
      z: q.z,
      tx: Math.sin(q.yaw),
      tz: Math.cos(q.yaw),
      end: u < 0.5 || u > len - 0.5,
    });
  }
  return out;
}

/**
 * Croisement à niveau de deux pièces quelconques : à la même hauteur, leurs voies se coupent en travers (plus de 30°),
 * loin des bouts, sans se raccorder. Les trains traversent chacune sans passer sur l'autre (le « + »).
 */
export function crossesAtLevel(a: RailPiece, b: RailPiece): boolean {
  if (a.id === b.id || a.kind === 'ramp' || b.kind === 'ramp') return false;
  if (Math.abs(a.level - b.level) > 0.05) return false;
  const pa = centreline(a);
  const pb = centreline(b);
  let crossing = false;
  for (const p of pa)
    for (const q of pb) {
      if (Math.hypot(p.x - q.x, p.z - q.z) > 0.45) continue;
      // Un bout qui touche l'autre voie est un raccord ou un embranchement, pas un croisement.
      if (p.end || q.end) return false;
      const cos = Math.abs(p.tx * q.tx + p.tz * q.tz);
      if (cos > Math.cos((30 * Math.PI) / 180)) return false;
      crossing = true;
    }
  return crossing;
}

/** Deux ports se touchent-ils, ou partent-ils du même point dans le même sens (deux pièces qui divergent d'un bout) ? */
function portsRelated(a: Port, b: Port): boolean {
  if (Math.hypot(a.x - b.x, a.z - b.z) > SAME_M || Math.abs(a.y - b.y) > SAME_M) return false;
  return a.dx * b.dx + a.dz * b.dz < -0.9 || a.dx * b.dx + a.dz * b.dz > 0.9;
}

/**
 * Deux pièces sont-elles voisines (raccordées bout à bout ou issues du même bout) ? Leurs emprises se touchent alors sans
 * que ce soit une erreur : le raccord, ou le départ commun d'un embranchement.
 */
export function neighbours(a: RailPiece, b: RailPiece): boolean {
  // Deux pièces identiques posées au même endroit ne sont pas voisines : c'est un doublon.
  if (a.kind === b.kind && a.h === b.h && Math.hypot(a.x - b.x, a.z - b.z) <= SAME_M) return false;
  const pa = portsOf(a);
  const pb = portsOf(b);
  return pa.some((p) => pb.some((q) => portsRelated(p, q)));
}

/** Distance (m) autour d'un nœud de la voie où deux voies qui en partent peuvent se recouvrir (départ d'un embranchement). */
const SHARE_M = 10;

/**
 * Deux pièces dont les emprises se recouvrent partent-elles du même nœud de la voie ? Un virage qui s'écarte d'un bout de
 * voie reste tangent aux droits qui continuent pendant quelques mètres : leurs cases se recouvrent sans que ce soit une
 * erreur, tant que le recouvrement reste près du nœud (un port où une autre pièce se raccorde).
 */
export function sharesOrigin(a: RailPiece, b: RailPiece, rails: readonly RailPiece[]): boolean {
  const cellsB = new Set(trackCellsOf(b).map(([x, z]) => `${x},${z}`));
  const common = trackCellsOf(a).filter(([x, z]) => cellsB.has(`${x},${z}`));
  if (common.length === 0) return true;
  // Seul un virage s'écarte d'une voie qui continue ; deux pièces droites qui se recouvrent sont un doublon.
  if (!isCurve(a.kind) && !isCurve(b.kind)) return false;
  for (const owner of [a, b])
    for (const q of portsOf(owner)) {
      const mated = rails.some(
        (z) => z.id !== a.id && z.id !== b.id && portsOf(z).some((zp) => portsRelated(q, zp)),
      );
      if (!mated) continue;
      if (
        common.every(
          ([gx, gz]) =>
            Math.hypot((gx + 0.5) * CELL_SIZE_M - q.x, (gz + 0.5) * CELL_SIZE_M - q.z) <= SHARE_M,
        )
      )
        return true;
    }
  return false;
}

/**
 * Les ports de la voie où l'on peut raccorder une nouvelle pièce : ceux où rien n'est raccordé. Un bout où plusieurs
 * voies se raccordent déjà n'est pas libre ; un bout seul l'est, et on peut y poser un embranchement.
 */
export function freePorts(
  pieces: readonly RailPiece[],
): { piece: number; port: 0 | 1; at: Port }[] {
  const graph = new TrackGraph(pieces);
  const out: { piece: number; port: 0 | 1; at: Port }[] = [];
  for (const p of graph.byId.values()) {
    const ports = portsOf(p);
    for (const i of [0, 1] as const) {
      if (!graph.neighbour(p.id, i)) out.push({ piece: p.id, port: i, at: ports[i] });
    }
  }
  return out;
}

/**
 * Cases (gx, gz) couvertes par la voie d'une pièce : celles dont le centre est à moins de `HALF_WIDTH_M` de la voie.
 * Deux voies parallèles à une tuile d'écart n'ont aucune case en commun.
 */
export function trackCellsOf(p: RailPiece): [number, number][] {
  const len = lengthOfPiece(p);
  const span = Math.ceil(HALF_WIDTH_M / CELL_SIZE_M);
  // Pour chaque case voisine de la voie : l'échantillon de voie le plus proche de son centre.
  const best = new Map<string, { d: number; last: number; dot: number }>();
  const n = Math.max(1, Math.ceil(len / (CELL_SIZE_M / 2)));
  for (let i = 0; i <= n; i++) {
    const q = poseOn(p, (len * i) / n);
    const fx = Math.sin(q.yaw);
    const fz = Math.cos(q.yaw);
    const cx = Math.floor(q.x / CELL_SIZE_M);
    const cz = Math.floor(q.z / CELL_SIZE_M);
    for (let dx = -span; dx <= span; dx++)
      for (let dz = -span; dz <= span; dz++) {
        const gx = cx + dx;
        const gz = cz + dz;
        const ox = (gx + 0.5) * CELL_SIZE_M - q.x;
        const oz = (gz + 0.5) * CELL_SIZE_M - q.z;
        const d = Math.hypot(ox, oz);
        const key = `${gx},${gz}`;
        const cur = best.get(key);
        if (!cur || d < cur.d) best.set(key, { d, last: i, dot: ox * fx + oz * fz });
      }
  }
  const out: [number, number][] = [];
  for (const [key, c] of best) {
    if (c.d > HALF_WIDTH_M) continue;
    // Aux bouts, l'emprise s'arrête net (pas de calotte ronde) : pas de case au-delà du bout de la voie.
    if (c.last === 0 && c.dot < -CELL_SIZE_M / 2 + 1e-6) continue;
    if (c.last === n && c.dot > CELL_SIZE_M / 2 - 1e-6) continue;
    out.push(key.split(',').map(Number) as [number, number]);
  }
  return out;
}

/** Boîte qui entoure la voie d'une pièce (m) : pour la surbrillance. */
export function boundsOf(p: RailPiece): { x0: number; x1: number; z0: number; z1: number } {
  const len = lengthOfPiece(p);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let u = 0; u <= len + 1e-6; u += 0.5) {
    const q = poseOn(p, Math.min(u, len));
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    z0 = Math.min(z0, q.z);
    z1 = Math.max(z1, q.z);
  }
  return {
    x0: x0 - HALF_WIDTH_M,
    x1: x1 + HALF_WIDTH_M,
    z0: z0 - HALF_WIDTH_M,
    z1: z1 + HALF_WIDTH_M,
  };
}
