/**
 * Voies ferrées (voir `docs/trains.md`) : pièces posées sur la grille, comme les modèles de
 * `blender/scripts/ferroviaire.py`, agrandis de `RAIL_SCALE` pour aller avec des trains à l'échelle du personnage
 * (écartement d'environ 1,5 m) :
 *  - `straight` : une tuile de 2,5 m (5 × 5 cases) ;
 *  - `curve`, `curve_wide`, `curve_large` : virages serré (3 × 3 tuiles, rayon 3,75 m), large (5 × 5, 6,25 m) et très
 *    large (7 × 7, 8,75 m) ; quart de cercle reliant le milieu de deux bords voisins du bloc ;
 *  - `ramp` : 1 × 4 tuiles (10 m), monte de 2,5 m ; la descente est la même pièce tournée d'un demi-tour ;
 * Une pièce est posée sur la grille de cases ; ses extrémités (« ports ») se raccordent à celles d'une pièce voisine.
 * Un train est repéré sur la voie par une pièce, une abscisse `u` (m le long de la voie, depuis le port 0) et un sens.
 * Il n'y a pas de pièce « aiguillage » : un embranchement est un virage posé dans le prolongement d'une ligne (voies
 * tangentes). Le conducteur (touches gauche / droite) ou le pilote automatique choisit la voie à prendre ; sans choix,
 * on va tout droit.
 */
import { CELL_SIZE_M } from '../constants';

export type RailKind =
  | 'straight'
  | 'curve'
  | 'curve_wide'
  | 'curve_large'
  | 'curve_big'
  | 'curve_huge'
  | 'ramp'
  | 'curve45'
  | 'curve45_b';
export const RAIL_KINDS: readonly RailKind[] = [
  'straight',
  'curve',
  'curve_wide',
  'curve_large',
  'curve_big',
  'curve_huge',
  'ramp',
  'curve45',
  'curve45_b',
];
export type CurveKind = 'curve' | 'curve_wide' | 'curve_large' | 'curve_big' | 'curve_huge';
export const CURVE_KINDS: readonly CurveKind[] = [
  'curve',
  'curve_wide',
  'curve_large',
  'curve_big',
  'curve_huge',
];
export const isCurve = (k: RailKind): k is CurveKind =>
  (CURVE_KINDS as readonly string[]).includes(k);
/**
 * Demi-virages (45°) : les deux moitiés d'un virage très large, dans le même bloc de 7 × 7 tuiles. `curve45` va du
 * milieu du bord +z jusqu'au milieu de l'arc (sur la diagonale du bloc), `curve45_b` de là au milieu du bord +x. Deux
 * à la suite font un quart de tour ; un seul tourne de 45° (son bout est alors en diagonale).
 */
export const isHalfCurve = (k: RailKind): k is 'curve45' | 'curve45_b' =>
  k === 'curve45' || k === 'curve45_b';

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

/** Pièce posée (dans `changes.rails`) à laquelle appartient une pièce du graphe (les deux sont la même). */
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
  if (kind === 'curve_large' || kind === 'curve45' || kind === 'curve45_b') return 7;
  if (kind === 'curve_big') return 11;
  if (kind === 'curve_huge') return 15;
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

/** Longueur de la voie d'une pièce (m), de son port 0 à son port 1. */
export function lengthOf(kind: RailKind): number {
  if (kind === 'straight') return TILE_M;
  if (kind === 'ramp') return Math.hypot(RAMP_RUN_M, RAMP_RISE_M);
  if (isHalfCurve(kind)) return (radiusOf(kind) * Math.PI) / 4;
  return (radiusOf(kind) * Math.PI) / 2;
}

/** Longueur de la voie d'une pièce posée. */
export const lengthOfPiece = (p: RailPiece): number => lengthOf(p.kind);

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
  if (kind === 'straight') return { x: 0, y: 0, z: TILE_M / 2 - u, tx: 0, tz: -1, dy: 0 };
  if (kind !== 'ramp') {
    // Quart de cercle du milieu du bord +z au milieu du bord +x.
    const r = radiusOf(kind);
    // La seconde moitié d'un demi-virage commence au milieu de l'arc (45° plus loin).
    const th = Math.PI + (kind === 'curve45_b' ? Math.PI / 4 : 0) + u / r;
    return {
      x: r + r * Math.cos(th),
      y: 0,
      z: r + r * Math.sin(th),
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

/**
 * Deux tuiles droites qui se croisent : même tuile, même hauteur, axes perpendiculaires. Elles se superposent sans
 * se raccorder (chaque voie traverse l'autre) : un croisement à niveau.
 */
export function crossesStraight(a: RailPiece, b: RailPiece): boolean {
  return (
    a.kind === 'straight' &&
    b.kind === 'straight' &&
    a.gx === b.gx &&
    a.gz === b.gz &&
    a.turns % 2 !== b.turns % 2 &&
    Math.abs(a.level - b.level) <= 0.05
  );
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
 * Croisement à niveau de deux pièces quelconques (droite, virage…) : à la même hauteur, leurs voies se coupent en
 * travers (plus de 30°), loin des bouts, sans se raccorder. Les trains traversent chacune sans passer sur l'autre.
 */
export function crossesAtLevel(a: RailPiece, b: RailPiece): boolean {
  if (a.id === b.id || a.kind === 'ramp' || b.kind === 'ramp') return false;
  if (Math.abs(a.level - b.level) > 0.05) return false;
  if (crossesStraight(a, b)) return true;
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

const SHARE_M = 11.5;
/**
 * Deux pièces dont les cases se chevauchent forment-elles un embranchement tangent ? Un virage part d'un point de la
 * voie (où une pièce attend déjà de l'autre côté) dans le sens même d'une voie droite : les deux restent tangents sur
 * quelques mètres, leurs cases se recouvrent donc sans que ce soit une erreur.
 */
export function tangentOverlap(a: RailPiece, b: RailPiece, rails: readonly RailPiece[]): boolean {
  if (a.kind === 'straight' && b.kind === 'straight') return false;
  if (Math.abs(a.level - b.level) > 0.3) return false;
  for (const [c, o] of [
    [a, b],
    [b, a],
  ] as const) {
    if (!isCurve(c.kind)) continue;
    for (const q of portsOf(c)) {
      const mated = rails.some(
        (z) => z.id !== c.id && z.id !== o.id && portsOf(z).some((zp) => portsMeet(q, zp)),
      );
      if (!mated) continue;
      const sameStart = portsOf(o).some(
        (op) =>
          Math.hypot(op.x - q.x, op.z - q.z) <= SAME_M &&
          Math.abs(op.y - q.y) <= SAME_M &&
          op.dx * q.dx + op.dz * q.dz > 0.9,
      );
      if (sameStart) return true;
      if (o.kind !== 'straight' || o.turns % 2 !== (Math.abs(q.dx) > 0.5 ? 1 : 0)) continue;
      const oc = centerOf(o);
      // Le port regarde vers la pointe : la voie part dans le sens opposé.
      const along = -((oc.x - q.x) * q.dx + (oc.z - q.z) * q.dz);
      const lateral = (oc.x - q.x) * -q.dz + (oc.z - q.z) * q.dx;
      if (along > 0 && along <= SHARE_M && Math.abs(lateral) < 0.3) return true;
    }
  }
  return false;
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
/**
 * La case est-elle du côté du bloc qui revient à ce demi-virage ? Le bloc est coupé par sa diagonale (celle où se
 * rejoignent les deux moitiés) : deux demi-virages qui se complètent n'ont aucune case en commun.
 */
function inHalf(p: RailPiece, gx: number, gz: number): boolean {
  const c = centerOf(p);
  const [lx, lz] = turn(
    (gx + 0.5) * CELL_SIZE_M - c.x,
    (gz + 0.5) * CELL_SIZE_M - c.z,
    4 - (p.turns % 4),
  );
  return p.kind === 'curve45' ? lz >= lx : lz < lx;
}

export function trackCellsOf(p: RailPiece): [number, number][] {
  if (p.kind === 'straight' || p.kind === 'ramp') return cellsOf(p);
  const keep = new Set<string>();
  const { w, d } = footprintOf(p.kind, p.turns);
  const reach = 1.6; // demi-écartement + marge (m)
  const span = Math.ceil(reach / CELL_SIZE_M);
  {
    const r = p;
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
          if (isHalfCurve(p.kind) && !inHalf(p, gx, gz)) continue;
          if (Math.hypot((gx + 0.5) * CELL_SIZE_M - q.x, (gz + 0.5) * CELL_SIZE_M - q.z) <= reach)
            keep.add(`${gx},${gz}`);
        }
    }
  }
  return [...keep].map((k) => k.split(',').map(Number) as [number, number]);
}
