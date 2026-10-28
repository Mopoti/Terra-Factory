import { describe, expect, it } from 'vitest';
import {
  CURVE_RADIUS_M,
  TILE_M,
  TrackGraph,
  crossesAtLevel,
  freePorts,
  headingDir,
  lengthOfPiece,
  neighbours,
  poseOn,
  portsOf,
  trackCellsOf,
  type RailKind,
  type RailPiece,
} from './track';

const piece = (
  id: number,
  kind: RailKind,
  x: number,
  z: number,
  h: number,
  level = 0,
): RailPiece => ({
  id,
  kind,
  x,
  z,
  h,
  level,
});

/** Pose, bout à bout, des pièces `kinds` à partir d'un port libre : chaque pièce part du port 1 de la précédente. */
function chain(kinds: RailKind[], x = 0, z = 0, h = 0): RailPiece[] {
  const out: RailPiece[] = [];
  let cur = { x, z, h, level: 0 };
  kinds.forEach((kind, i) => {
    const p = piece(i + 1, kind, cur.x, cur.z, cur.h, cur.level);
    out.push(p);
    const end = poseOn(p, lengthOfPiece(p));
    cur = {
      x: end.x,
      z: end.z,
      h: Math.round(((end.yaw / (Math.PI / 4)) % 8) + 8) % 8,
      level: end.y,
    };
  });
  return out;
}

describe('pièces de voie : géométrie', () => {
  it('un droit mesure une tuile le long d’un axe, une diagonale de tuile en diagonale', () => {
    expect(lengthOfPiece(piece(1, 'straight', 0, 0, 0))).toBeCloseTo(TILE_M, 6);
    expect(lengthOfPiece(piece(1, 'straight', 0, 0, 1))).toBeCloseTo(TILE_M * Math.SQRT2, 6);
    const e = poseOn(piece(1, 'straight', 0, 0, 1), lengthOfPiece(piece(1, 'straight', 0, 0, 1)));
    expect(e.x).toBeCloseTo(TILE_M, 6);
    expect(e.z).toBeCloseTo(TILE_M, 6);
  });

  it('huit virages de 45° du même côté font un cercle qui se referme', () => {
    for (const kind of ['curve_l', 'curve_r'] as const) {
      const ring = chain(Array(8).fill(kind));
      const last = ring[7];
      const end = poseOn(last, lengthOfPiece(last));
      expect(Math.hypot(end.x, end.z)).toBeLessThan(0.01);
      // Le diamètre du cercle est deux rayons.
      const far = Math.max(...ring.map((p) => Math.hypot(poseOn(p, 0).x, poseOn(p, 0).z)));
      expect(far).toBeCloseTo(2 * CURVE_RADIUS_M, 3);
    }
  });

  it('un virage tourne de 45° du bon côté : à gauche vers +x quand on va vers +z', () => {
    const l = piece(1, 'curve_l', 0, 0, 0);
    const r = piece(2, 'curve_r', 0, 0, 0);
    expect(poseOn(l, lengthOfPiece(l)).x).toBeGreaterThan(0);
    expect(poseOn(r, lengthOfPiece(r)).x).toBeLessThan(0);
    expect(poseOn(l, lengthOfPiece(l)).yaw).toBeCloseTo(Math.PI / 4, 6);
    expect(poseOn(r, lengthOfPiece(r)).yaw).toBeCloseTo(-Math.PI / 4, 6);
  });

  it('droit, virage, droits en diagonale, virage : toutes les pièces se raccordent', () => {
    const track = chain(['straight', 'curve_l', 'straight', 'straight', 'curve_l', 'straight']);
    const g = new TrackGraph(track);
    for (let i = 1; i < track.length; i++) {
      expect(g.neighbour(i, 1), `pièce ${i}`).toEqual({ piece: i + 1, port: 0 });
      expect(g.neighbour(i + 1, 0)).toEqual({ piece: i, port: 1 });
    }
    expect(g.neighbour(1, 0)).toBeNull();
    expect(g.neighbour(6, 1)).toBeNull();
  });

  it('un embranchement : un droit qui continue et un virage qui part du même bout', () => {
    const base = chain(['straight', 'straight']);
    const end = portsOf(base[1])[1];
    const straight = piece(3, 'straight', end.x, end.z, 0);
    const curve = piece(4, 'curve_l', end.x, end.z, 0);
    const g = new TrackGraph([...base, straight, curve]);
    // Au bout de la voie, deux suites : on prend d'abord la plus droite.
    expect(
      g
        .linksAt(2, 1)
        .map((l) => l.piece)
        .sort(),
    ).toEqual([3, 4]);
    expect(g.neighbour(2, 1)?.piece).toBe(3);
    expect(neighbours(straight, curve)).toBe(true);
    // La voie ne laisse pas de bout libre au raccord, mais les deux bouts lointains le sont.
    expect(freePorts([...base, straight, curve]).length).toBe(3);
  });

  it('deux voies parallèles à une tuile d’écart ne se gênent pas ; une voie sur la case d’une autre, si', () => {
    const a = piece(1, 'straight', 0, 0, 0);
    const b = piece(2, 'straight', TILE_M, 0, 0);
    const c = piece(3, 'straight', 0.5, 0, 0);
    const cells = (p: RailPiece): Set<string> =>
      new Set(trackCellsOf(p).map(([x, z]) => `${x},${z}`));
    expect([...cells(a)].some((k) => cells(b).has(k))).toBe(false);
    expect([...cells(a)].some((k) => cells(c).has(k))).toBe(true);
  });

  it('deux droits qui se coupent en travers forment un croisement, en diagonale aussi', () => {
    const along = piece(1, 'straight', 0, -TILE_M / 2, 0);
    const across = piece(2, 'straight', -TILE_M / 2, 0, 2);
    expect(crossesAtLevel(along, across)).toBe(true);
    const diag = piece(3, 'straight', -TILE_M / 2, -TILE_M / 2, 1);
    expect(crossesAtLevel(along, diag)).toBe(true);
    // Deux droits bout à bout ne se croisent pas.
    expect(crossesAtLevel(along, piece(4, 'straight', 0, TILE_M / 2, 0))).toBe(false);
  });

  it('une rampe monte de 2,5 m sur 10 m et la pièce suivante se pose à la bonne hauteur', () => {
    const ramp = piece(1, 'ramp', 0, 0, 0);
    const top = poseOn(ramp, lengthOfPiece(ramp));
    expect(top.z).toBeCloseTo(4 * TILE_M, 6);
    expect(top.y).toBeCloseTo(TILE_M, 6);
    expect(poseOn(ramp, 1).slope).toBeGreaterThan(0.2);
    expect(headingDir(0)).toEqual({ dx: 0, dz: 1 });
  });
});
