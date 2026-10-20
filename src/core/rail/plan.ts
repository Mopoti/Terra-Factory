/**
 * Tracé de la voie, comme pour les convoyeurs : le joueur glisse d'une tuile (2,5 m) à l'autre et le jeu choisit seul
 * la forme de chaque pièce : tuiles droites en ligne, virage à chaque coin (serré 3 × 3 tuiles, large 5 × 5 ou très
 * large 7 × 7, au choix du joueur), rampe de 4 tuiles quand on a choisi de monter ou de descendre (PageUp / PageDown).
 */
import { RAIL_COST } from '../data/trains';
import {
  RAMP_RISE_M,
  TILE_M,
  blockTiles,
  cornerFor,
  type CurveKind,
  type Port,
  type RailKind,
} from './track';

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
export const tileOf = (x: number, z: number): Tile => ({
  tx: Math.floor(x / TILE_M),
  tz: Math.floor(z / TILE_M),
});

const centreX = (t: Tile): number => (t.tx + 0.5) * TILE_M;
const centreZ = (t: Tile): number => (t.tz + 0.5) * TILE_M;

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
  /**
   * Virage posé aux coins : une taille fixe, ou `auto` (le jeu prend le plus grand qui tient entre les coins voisins,
   * jusqu'au très large). Serré par défaut.
   */
  curve?: CurveKind | 'auto';
}

/**
 * Pièces d'un tracé de tuiles voisines. Le tracé est coupé là où il ne tient pas (demi-tour, coins trop rapprochés,
 * rampe trop courte) : on ne renvoie que ce qui est posable.
 */
export function planRails(tilesIn: readonly Tile[], opts: PlanOptions): PlannedPiece[] {
  const tiles = [...tilesIn];
  // Tuiles voisines seulement, sans demi-tour.
  let len = 1;
  let prev: Dir | null = null;
  for (; len < tiles.length; len++) {
    const d = { dx: tiles[len].tx - tiles[len - 1].tx, dz: tiles[len].tz - tiles[len - 1].tz };
    if (Math.abs(d.dx) + Math.abs(d.dz) !== 1) break;
    if (prev && d.dx === -prev.dx && d.dz === -prev.dz) break;
    prev = d;
  }
  const path = tiles.slice(0, len);
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
  // Coins : un virage occupe un bloc de n × n tuiles centré sur le coin (h tuiles de chaque côté), donc ni sur la
  // voie existante, ni sur la rampe, ni trop près d'un autre coin. Après le dernier coin, le virage peut dépasser la
  // fin du tracé (on voit tout de suite où il mène).
  const choice = opts.curve ?? 'curve';
  // Virages que le tracé automatique peut poser (les serrés sont retirés pour l'instant) : demi-bloc en tuiles.
  const AUTO: { kind: CurveKind; half: number }[] = [
    { kind: 'curve_wide', half: 2 },
    { kind: 'curve_large', half: 3 },
    { kind: 'curve_big', half: 5 },
    { kind: 'curve_huge', half: 7 },
  ];
  const cornerAt: number[] = [];
  for (let i = lead; i < dirs.length; i++) if (corner(i)) cornerAt.push(i);
  const corners: number[] = [];
  const kindAt = new Map<number, CurveKind>();
  const halfAt = new Map<number, number>();
  for (let c = 0; c < cornerAt.length; c++) {
    const i = cornerAt[c];
    const prevI = corners[corners.length - 1];
    // Première tuile libre à gauche : après la voie existante, la rampe ou le bloc du coin précédent.
    const leftEdge =
      prevI !== undefined ? prevI + (halfAt.get(prevI) ?? 0) + 1 : ramp ? rampEnd : lead;
    const leftRoom = i - leftEdge;
    let half: number;
    if (choice === 'auto') {
      // À droite : jusqu'au coin suivant (qui garde au moins un virage serré) ou jusqu'au bout du tracé.
      const next = cornerAt[c + 1];
      const rightRoom = next !== undefined ? next - 1 - i : dirs.length - i;
      half = Math.min(AUTO[AUTO.length - 1].half, leftRoom, rightRoom);
    } else half = (blockTiles(choice) - 1) / 2;
    // En automatique : le plus grand virage qui tient ; trop serré pour le plus petit, le tracé s'arrête là.
    const picked = choice === 'auto' ? AUTO.filter((a) => a.half <= half).pop() : undefined;
    if (choice === 'auto' ? !picked : half < 1 || half > leftRoom) {
      limit = i;
      break;
    }
    if (picked) half = picked.half;
    corners.push(i);
    halfAt.set(i, half);
    kindAt.set(i, picked ? picked.kind : (choice as CurveKind));
  }
  const used = path.slice(0, limit);
  const covered = new Set<number>();
  if (ramp) for (let i = lead; i < rampEnd; i++) covered.add(i);
  for (const i of corners) {
    if (i >= limit) continue;
    const h = halfAt.get(i) ?? 1;
    for (let k = i - h; k <= i + h; k++) covered.add(k);
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
        level: climbs ? level : level - RAMP_RISE_M,
        cost: RAIL_COST.ramp,
      });
      level += climbs ? RAMP_RISE_M : -RAMP_RISE_M;
      continue;
    }
    if (covered.has(i)) {
      if (corners.includes(i) && i < limit) {
        const k = used[i];
        const curve = kindAt.get(i) ?? 'curve';
        const turns = curveTurns({ dx: -dirs[i - 1].dx, dz: -dirs[i - 1].dz }, dirs[i]);
        out.push({
          kind: curve,
          ...cornerFor(curve, turns, centreX(k), centreZ(k)),
          turns,
          level,
          cost: RAIL_COST[curve],
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
export const leadTile = (p: Port): Tile =>
  tileOf(p.x - p.dx * (TILE_M / 2), p.z - p.dz * (TILE_M / 2));
