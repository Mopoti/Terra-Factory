/**
 * Tracé de la voie, comme pour les convoyeurs : le joueur glisse d'une tuile (1 m) à l'autre et le jeu choisit seul
 * la forme de chaque pièce : tuiles droites en ligne, virage de 3 × 3 tuiles à chaque coin, rampe de 4 tuiles quand
 * on a choisi de monter ou de descendre (PageUp / PageDown).
 */
import { RAIL_COST } from '../data/trains';
import { cornerFor, type Port, type RailKind } from './track';

export interface Tile {
  tx: number;
  tz: number;
}

export interface PlannedPiece {
  kind: RailKind;
  gx: number;
  gz: number;
  turns: number;
  level: number;
  /** Rails consommés. */
  cost: number;
}

/** Tuile (1 m) qui contient ce point. */
export const tileOf = (x: number, z: number): Tile => ({ tx: Math.floor(x), tz: Math.floor(z) });

const centreX = (t: Tile): number => t.tx + 0.5;
const centreZ = (t: Tile): number => t.tz + 0.5;

type Dir = { dx: number; dz: number };
const sameDir = (a: Dir, b: Dir): boolean => a.dx === b.dx && a.dz === b.dz;

/** Quarts de tour du virage qui relie les côtés `a` et `b` du bloc (directions qui sortent du centre). */
function curveTurns(a: Dir, b: Dir): number {
  const has = (d: Dir): boolean => sameDir(a, d) || sameDir(b, d);
  const south = { dx: 0, dz: 1 };
  const east = { dx: 1, dz: 0 };
  const north = { dx: 0, dz: -1 };
  const west = { dx: -1, dz: 0 };
  if (has(south) && has(east)) return 0;
  if (has(east) && has(north)) return 1;
  if (has(north) && has(west)) return 2;
  return 3;
}

/** Quarts de tour d'une pièce droite le long de `d`, et d'une rampe qui monte vers `d`. */
const straightTurns = (d: Dir): number => (d.dx !== 0 ? 1 : 0);
function rampTurns(up: Dir): number {
  if (up.dz < 0) return 0;
  if (up.dx < 0) return 1;
  if (up.dz > 0) return 2;
  return 3;
}

export interface PlanOptions {
  /** Hauteur (m) du sol de la voie au départ. */
  level: number;
  /** 1 : la voie monte (rampe en tête de tracé) ; −1 : elle descend ; 0 : à plat. */
  tilt: -1 | 0 | 1;
  /** Nombre de tuiles du début qui existent déjà (la voie qu'on prolonge) : rien n'y est posé. */
  lead: number;
}

/**
 * Pièces d'un tracé de tuiles voisines. Le tracé est coupé là où il ne tient pas (demi-tour, coins trop rapprochés,
 * rampe trop courte) : on ne renvoie que ce qui est posable.
 */
export function planRails(tilesIn: readonly Tile[], opts: PlanOptions): PlannedPiece[] {
  const tiles = [...tilesIn];
  // Tuiles voisines seulement, sans demi-tour.
  let n = 1;
  let prev: Dir | null = null;
  for (; n < tiles.length; n++) {
    const d = { dx: tiles[n].tx - tiles[n - 1].tx, dz: tiles[n].tz - tiles[n - 1].tz };
    if (Math.abs(d.dx) + Math.abs(d.dz) !== 1) break;
    if (prev && d.dx === -prev.dx && d.dz === -prev.dz) break;
    prev = d;
  }
  const path = tiles.slice(0, n);
  const dirs: Dir[] = [];
  for (let i = 0; i + 1 < path.length; i++)
    dirs.push({ dx: path[i + 1].tx - path[i].tx, dz: path[i + 1].tz - path[i].tz });
  const lead = Math.max(0, Math.min(opts.lead, path.length));
  const corner = (i: number): boolean => i > 0 && i < dirs.length && !sameDir(dirs[i - 1], dirs[i]);

  // Rampe : les quatre premières tuiles à poser, droites, puis au moins une tuile avant un virage.
  const ramp = opts.tilt !== 0;
  const rampEnd = lead + 4; // premier indice après la rampe
  let limit = path.length;
  if (ramp) {
    if (path.length < rampEnd) return [];
    for (let i = lead; i < rampEnd - 1; i++)
      if (!dirs[i] || !sameDir(dirs[i], dirs[lead])) return [];
  }
  // Coins : un virage occupe 3 × 3 tuiles autour du coin, donc ni sur la tuile existante, ni trop près d'un autre coin.
  const corners: number[] = [];
  for (let i = lead; i < dirs.length; i++) {
    if (!corner(i)) continue;
    const tooEarly = i - 1 < lead || (ramp && i - 1 < rampEnd);
    const last = corners[corners.length - 1];
    if (tooEarly || (last !== undefined && i - last < 3)) {
      limit = i;
      break;
    }
    corners.push(i);
  }
  const used = path.slice(0, limit);
  const covered = new Set<number>();
  if (ramp) for (let i = lead; i < rampEnd; i++) covered.add(i);
  for (const i of corners) {
    if (i >= limit) continue;
    for (const k of [i - 1, i, i + 1]) covered.add(k);
  }

  const out: PlannedPiece[] = [];
  let level = opts.level;
  for (let i = lead; i < used.length; i++) {
    if (ramp && i === lead) {
      const up = dirs[lead];
      const climbs = opts.tilt > 0;
      const along = climbs ? up : { dx: -up.dx, dz: -up.dz };
      const turns = rampTurns(along);
      const a = used[lead];
      const b = used[lead + 3];
      const cx = (centreX(a) + centreX(b)) / 2;
      const cz = (centreZ(a) + centreZ(b)) / 2;
      out.push({
        kind: 'ramp',
        ...cornerFor('ramp', turns, cx, cz),
        turns,
        level: climbs ? level : level - 1,
        cost: RAIL_COST.ramp,
      });
      level += climbs ? 1 : -1;
      continue;
    }
    if (covered.has(i)) {
      if (corners.includes(i) && i < limit) {
        const k = used[i];
        const turns = curveTurns({ dx: -dirs[i - 1].dx, dz: -dirs[i - 1].dz }, dirs[i]);
        out.push({
          kind: 'curve',
          ...cornerFor('curve', turns, centreX(k), centreZ(k)),
          turns,
          level,
          cost: RAIL_COST.curve,
        });
      }
      continue;
    }
    const d = dirs[i] ?? dirs[i - 1] ?? { dx: 0, dz: 1 };
    out.push({
      kind: 'straight',
      ...cornerFor('straight', 0, centreX(used[i]), centreZ(used[i])),
      turns: straightTurns(d),
      level,
      cost: RAIL_COST.straight,
    });
  }
  return out;
}

/** Direction (vers l'extérieur) d'un port, en pas de tuile. */
export const portDir = (p: Port): Dir => ({ dx: Math.round(p.dx), dz: Math.round(p.dz) });

/** Tuile qui contient l'extrémité de la voie existante (là où se raccorde le tracé). */
export const leadTile = (p: Port): Tile => tileOf(p.x - p.dx * 0.5, p.z - p.dz * 0.5);
