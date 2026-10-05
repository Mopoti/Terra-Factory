import { describe, expect, it } from 'vitest';
import { pieceKey, posFor, type Pieces } from '../build/pieces';
import { bodyBlocked, groundAt, stairTops, stepVertical, type Body } from './physics';

const wallRow = (layers: number[]): Pieces => {
  const p: Pieces = {};
  for (const l of layers) p[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
  return p;
};

describe('physique du joueur', () => {
  it('un mur haut arrête le joueur, un sol plat non', () => {
    const wall = wallRow([0, 1, 2, 3, 4]);
    expect(bodyBlocked(wall, 0.25, 1.0, 0, 1.75)).toBe(true);
    expect(bodyBlocked(wall, 0.25, 0.4, 0, 1.75)).toBe(false);
    const floor: Pieces = { [pieceKey(posFor('floor_wood', 0, 0, 0))]: 'floor_wood' };
    expect(bodyBlocked(floor, 0.25, 0.25, 0, 1.75)).toBe(false); // dalle de 10 cm : on la monte
    expect(groundAt(floor, 0.25, 0.25, 0)).toBeCloseTo(0.1);
  });
  it("on peut se tenir sur la tranche d'un mur bas mais pas y entrer sans sauter", () => {
    const low = wallRow([0]); // 50 cm
    expect(bodyBlocked(low, 0.25, 1.0, 0, 1.75)).toBe(true); // 0,5 m > marche de 0,35 m
    expect(groundAt(low, 0.25, 1.0, 0)).toBe(0);
    expect(groundAt(low, 0.25, 1.0, 0.3)).toBeCloseTo(0.5); // en plein saut, on s'y pose
    expect(bodyBlocked(low, 0.25, 1.0, 0.5, 1.75)).toBe(false); // debout dessus
  });
  it('saut puis retour au sol', () => {
    let b: Body = { y: 0, vy: 0, onGround: true };
    b = stepVertical(b, 1 / 60, 0, Infinity, 1.75, true);
    expect(b.onGround).toBe(false);
    let top = 0;
    for (let i = 0; i < 120; i++) {
      b = stepVertical(b, 1 / 60, 0, Infinity, 1.75, false);
      top = Math.max(top, b.y);
    }
    expect(top).toBeGreaterThan(1.0);
    expect(top).toBeLessThan(1.3);
    expect(b).toEqual({ y: 0, vy: 0, onGround: true });
  });
  it('pas de saut en l air, et la tête cogne un plafond', () => {
    const air = stepVertical({ y: 1, vy: 0, onGround: false }, 1 / 60, 0, Infinity, 1.75, true);
    expect(air.vy).toBeLessThan(0);
    const bump = stepVertical({ y: 0.4, vy: 5, onGround: false }, 0.1, 0, 2.2, 1.75, false);
    expect(bump.y + 1.75).toBeLessThanOrEqual(2.2 + 1e-9);
    expect(bump.vy).toBe(0);
  });
});

describe('escaliers', () => {
  // Deux marches qui montent vers +z (orientation 0) : cases (0,0) puis (0,1).
  const stairs: Pieces = {
    [pieceKey(posFor('stairs_wood', 0, 0, 0, undefined, 0, 0))]: 'stairs_wood',
    [pieceKey(posFor('stairs_wood', 0, 0, 1, undefined, 1, 0))]: 'stairs_wood',
  };
  it('la hauteur monte régulièrement le long des marches', () => {
    expect(stairTops(stairs, 0.25, 0.0, 0)[0]).toBeCloseTo(0);
    expect(stairTops(stairs, 0.25, 0.25, 0)[0]).toBeCloseTo(0.25);
    expect(stairTops(stairs, 0.25, 0.5, 0.4)[0]).toBeCloseTo(0.5);
    expect(stairTops(stairs, 0.25, 0.75, 0.5)[0]).toBeCloseTo(0.75);
    expect(stairTops(stairs, 0.25, 0.99, 0.9)[0]).toBeCloseTo(1.0, 1);
  });
  it('on les monte à pied, sans sauter', () => {
    let y = 0;
    for (let z = 0.02; z < 1.0; z += 0.05) {
      expect(bodyBlocked(stairs, 0.25, z, y, 1.75)).toBe(false);
      y = Math.max(y, groundAt(stairs, 0.25, z, y));
    }
    expect(y).toBeGreaterThan(0.9);
  });
  it('par le côté, une marche haute arrête le joueur', () => {
    expect(bodyBlocked(stairs, 0.25, 0.9, 0, 1.75)).toBe(true);
  });
});
