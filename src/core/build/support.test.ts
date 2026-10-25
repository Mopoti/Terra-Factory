import { describe, expect, it } from 'vitest';
import { pieceKey, posFor, slabPos, type Pieces } from './pieces';
import { SupportMap, isSupported, pillarKey } from './support';

const wall = (
  p: Pieces,
  level: number,
  gx: number,
  gz: number,
  axis: 'x' | 'z',
  layers: number[],
): void => {
  for (const l of layers) p[pieceKey(posFor('wall_stone', level, gx, gz, axis, l))] = 'wall_stone';
};
const slab = (p: Pieces, face: number, gx: number, gz: number): void => {
  const s = slabPos(face, gx, gz);
  const kind = s.slot === 'floor' ? 'floor_stone' : 'ceiling_stone';
  p[pieceKey(posFor(kind, s.level, gx, gz, undefined, s.layer))] = kind;
};
const ALL = [0, 1, 2, 3, 4];
const slabPosAt = (face: number, gx: number, gz: number) => {
  const s = slabPos(face, gx, gz);
  return posFor(
    s.slot === 'floor' ? 'floor_stone' : 'ceiling_stone',
    s.level,
    gx,
    gz,
    undefined,
    s.layer,
  );
};
const slabOk = (p: Pieces, face: number, gx: number, gz: number): boolean => {
  const pos = slabPosAt(face, gx, gz);
  return isSupported(p, pos.slot === 'floor' ? 'floor_stone' : 'ceiling_stone', pos);
};

describe('appuis : 5 m sans mur, ni pilier automatique', () => {
  it('le sol est toujours soutenu ; un étage sans rien dessous est refusé', () => {
    const p: Pieces = {};
    expect(new SupportMap(p).supportNear(0, 3, 3)).toBe(true);
    expect(slabOk(p, 0, 3, 3)).toBe(true);
    expect(slabOk(p, 5, 3, 3)).toBe(false);
  });

  it('une dalle à moins de 5 m d’un mur posé sur le sol est soutenue, au-delà elle est refusée', () => {
    const p: Pieces = {};
    wall(p, 0, 0, 0, 'x', ALL); // mur le long de x, de la case 0 à la case 1, à z = 0
    expect(slabOk(p, 5, 0, 0)).toBe(true);
    // 4 cases (2 m) et 8 cases (4 m) plus loin : dans la portée
    expect(slabOk(p, 5, 0, 4)).toBe(true);
    expect(slabOk(p, 5, 0, 8)).toBe(true);
    // 11 cases (5,5 m) plus loin : hors portée
    expect(slabOk(p, 5, 0, 11)).toBe(false);
  });

  it('un mur flottant ne soutient rien ; un pilier posé à la main soutient', () => {
    const p: Pieces = {};
    wall(p, 1, 0, 0, 'x', ALL); // mur flottant à l'étage 1
    expect(slabOk(p, 10, 0, 0)).toBe(false);
    // Un pilier au sol (étage 0), posé à la main, soutient la dalle de l'étage 1 à côté.
    const pillar = posFor('pillar_stone', 0, 3, 3);
    expect(isSupported(p, 'pillar_stone', pillar)).toBe(true);
    p[pieceKey(pillar)] = 'pillar_stone';
    expect(new SupportMap(p).pillarGrounded(5, 3, 3)).toBe(true);
    slab(p, 5, 3, 4);
    expect(slabOk(p, 5, 3, 4)).toBe(true);
    // Un pilier à l'étage 1 sans rien dessous est refusé, sur une dalle soutenue il est accepté.
    const upper = posFor('pillar_stone', 1, 3, 4);
    expect(isSupported(p, 'pillar_stone', upper)).toBe(true);
    expect(isSupported(p, 'pillar_stone', posFor('pillar_stone', 1, 20, 20))).toBe(false);
    expect(pillarKey(5, 3, 3)).toBe(pieceKey(pillar));
  });

  it('un mur accroché sous un plafond soutenu ou contre un mur soutenu tient sans pilier', () => {
    const p: Pieces = {};
    wall(p, 0, 0, 0, 'x', ALL);
    wall(p, 0, 0, 0, 'z', ALL);
    slab(p, 5, 0, 0);
    expect(isSupported(p, 'wall_stone', posFor('wall_stone', 0, 1, 0, 'z', 4))).toBe(true);
    p[pieceKey(posFor('wall_stone', 0, 1, 0, 'x', 3))] = 'wall_stone';
    expect(new SupportMap(p).wallGrounded({ level: 0, gx: 1, gz: 0, axis: 'x' }, 3)).toBe(true);
    // Un mur d'étage sans mur ni dalle soutenue dessous est refusé.
    expect(isSupported(p, 'wall_stone', posFor('wall_stone', 1, 9, 9, 'x', 0))).toBe(false);
  });
});
