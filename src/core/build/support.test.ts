import { describe, expect, it } from 'vitest';
import { pieceKey, posFor, slabPos, type Pieces } from './pieces';
import { SupportMap, pillarKey, pillarsFor } from './support';

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
const posAt = (face: number, gx: number, gz: number) => {
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

describe('supports : piliers automatiques à 2,5 m', () => {
  it('le sol est toujours soutenu ; un étage sans rien dessous exige un pilier', () => {
    const p: Pieces = {};
    expect(new SupportMap(p).supportNear(0, 3, 3)).toBe(true);
    slab(p, 5, 3, 3);
    const add = pillarsFor(p, posAt(5, 3, 3), 'stone');
    expect(Object.keys(add)).toEqual([pillarKey(5, 3, 3)]);
  });

  it('une dalle à moins de 2,5 m d’un mur posé sur le sol n’a pas besoin de pilier', () => {
    const p: Pieces = {};
    wall(p, 0, 0, 0, 'x', ALL); // mur le long de x, de la case 0 à la case 1 (x de 0 à 0,5 m), à z = 0
    slab(p, 5, 0, 0);
    expect(new SupportMap(p).supportNear(5, 0, 0)).toBe(true);
    // 4 cases plus loin (≈ 2 m) : encore dans la portée
    slab(p, 5, 0, 4);
    expect(new SupportMap(p).supportNear(5, 0, 4)).toBe(true);
    // 6 cases plus loin (≈ 3 m) : hors portée
    expect(new SupportMap(p).supportNear(5, 0, 6)).toBe(false);
  });

  it('un mur qui ne touche pas le sol ne soutient rien ; un pilier posé compte comme support', () => {
    const p: Pieces = {};
    wall(p, 1, 0, 0, 'x', ALL); // mur flottant à l'étage 1
    slab(p, 10, 0, 0);
    expect(new SupportMap(p).supportNear(10, 0, 0)).toBe(false);
    // pilier sous la dalle (étage 1 puis étage 0), tous deux posés
    slab(p, 5, 3, 3);
    const posAtFace = (face: number, gx: number, gz: number) => {
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
    const add = pillarsFor(p, posAtFace(10, 8, 8), 'stone');
    // le pilier descend de l'étage 1 à l'étage 0 puis s'arrête au sol (ou sur la dalle soutenue)
    expect(Object.keys(add)).toContain(pillarKey(10, 8, 8));
    Object.assign(p, add);
    expect(new SupportMap(p).pillarGrounded(10, 8, 8)).toBe(true);
    // une dalle voisine (1 case) est maintenant soutenue par ce pilier
    slab(p, 10, 9, 8);
    expect(new SupportMap(p).supportNear(10, 9, 8)).toBe(true);
  });

  it('une grande dalle posée case par case reçoit un pilier tous les ≈ 3 m', () => {
    const p: Pieces = {};
    wall(p, 0, 0, 0, 'x', ALL);
    const pillars = new Set<string>();
    for (let gz = 0; gz < 24; gz++) {
      slab(p, 5, 0, gz);
      const add = pillarsFor(p, posAt(5, 0, gz), 'stone');
      for (const k of Object.keys(add)) pillars.add(k);
      Object.assign(p, add);
    }
    // 12 m de dalle : un pilier toutes les 6 cases (3 m), dès que la dalle dépasse 2,5 m du mur, jamais un par case
    expect([...pillars].sort()).toEqual(['p:0:0,11:4', 'p:0:0,17:4', 'p:0:0,23:4', 'p:0:0,5:4']);
  });
});
