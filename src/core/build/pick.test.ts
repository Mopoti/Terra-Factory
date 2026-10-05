import { describe, expect, it } from 'vitest';
import { pickPiece } from './pick';
import { pieceKey, posFor, type Pieces } from './pieces';

describe('viser un élément de construction', () => {
  const wall: Pieces = {};
  for (let l = 0; l < 5; l++) wall[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
  it('touche le bloc de mur à la hauteur du rayon', () => {
    const hit = pickPiece(wall, { x: 0.25, y: 1.2, z: -1 }, { x: 0, y: 0, z: 1 }, 20);
    expect(hit?.key).toBe('e:0:0,2:x:2');
    expect(hit?.t).toBeGreaterThan(1.9);
    expect(pickPiece(wall, { x: 3, y: 1.2, z: -1 }, { x: 0, y: 0, z: 1 }, 20)).toBeNull();
  });
  it('touche une dalle de sol, de plafond et une marche', () => {
    const p: Pieces = {
      [pieceKey(posFor('floor_wood', 0, 5, 5))]: 'floor_wood',
      [pieceKey(posFor('ceiling_wood', 0, 8, 8, undefined, 1))]: 'ceiling_wood',
      [pieceKey(posFor('stairs_wood', 0, 12, 12, undefined, 0, 0))]: 'stairs_wood',
    };
    const down = { x: 0, y: -1, z: 0 };
    expect(pickPiece(p, { x: 2.75, y: 1.5, z: 2.75 }, down, 10)?.key).toBe('f:0:5,5');
    expect(pickPiece(p, { x: 4.25, y: 1.5, z: 4.25 }, down, 10)?.key).toBe('c:0:8,8:1');
    expect(pickPiece(p, { x: 6.25, y: 1.5, z: 6.4 }, down, 10)?.key).toBe('s:0:12,12:0:0');
  });
  it('rien dans le vide', () => {
    expect(pickPiece({}, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 20)).toBeNull();
  });
});
