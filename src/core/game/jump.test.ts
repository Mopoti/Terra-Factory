import { describe, expect, it } from 'vitest';
import { pieceKey, posFor, type Pieces } from '../build/pieces';
import { bodyBlocked, groundAt, ceilingAbove, stepVertical, type Body } from './physics';

const R = 0.25;

/** Le joueur court vers un mur (à z = 1) et saute à `startDist` m de lui ; renvoie la hauteur de ses pieds à la fin. */
function jumpAtWall(layers: number[], speed: number, startDist: number): number {
  const pieces: Pieces = {};
  for (const l of layers) pieces[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
  const dt = 1 / 60;
  let z = 1.0 - R - 0.07 - startDist;
  let b: Body = { y: 0, vy: 0, onGround: true };
  let jumped = false;
  for (let i = 0; i < 180; i++) {
    const nz = z + speed * dt;
    let ok = true;
    for (const dx of [-R, 0, R])
      for (const dz of [-R, 0, R])
        if (bodyBlocked(pieces, 0.25 + dx, nz + dz, b.y, 1.7, speed * dt)) ok = false;
    if (ok) z = nz;
    let ground = 0;
    for (const [dx, dz] of [
      [0, 0],
      [0.2, 0],
      [-0.2, 0],
      [0, 0.2],
      [0, -0.2],
    ])
      ground = Math.max(ground, groundAt(pieces, 0.25 + dx, z + dz, b.y, speed * dt));
    const roof = ceilingAbove(pieces, 0.25, z, b.y + 1.7, b.y);
    b = stepVertical(b, dt, ground, roof, 1.7, !jumped);
    jumped = true;
    // Une fois perché sur le mur, on s'arrête (on ne retombe pas de l'autre côté).
    if (b.onGround && b.y > 0.9) return b.y;
  }
  return b.y;
}

describe('saut sur un mur de deux blocs (1 m)', () => {
  it('deux blocs empilés se montent d’un seul saut, de près comme de plus loin', () => {
    for (const speed of [2, 4.5, 7.65]) {
      for (const dist of [0, 0.3, 0.6]) {
        expect(jumpAtWall([0, 1], speed, dist)).toBeCloseTo(1.0, 2);
      }
    }
  });
  it('trois blocs (1,5 m) restent hors d’atteinte', () => {
    expect(jumpAtWall([0, 1, 2], 4.5, 0.3)).toBeLessThan(0.9);
  });
  it('le dessus d’un bloc recouvert ne sert pas d’appui', () => {
    const pieces: Pieces = {};
    for (const l of [0, 1]) pieces[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
    expect(groundAt(pieces, 0.25, 1.0, 0.15)).toBe(0);
    expect(groundAt(pieces, 0.25, 1.0, 0.7)).toBeCloseTo(1.0);
  });
});
