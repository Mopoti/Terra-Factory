import { describe, expect, it } from 'vitest';
import { chainSlot } from './aim';
import { pieceKey, slabAt, wallBeside, wallSide, type Pieces } from './pieces';

describe('pose du thermomètre (contre un mur) et de la girouette (sur une dalle)', () => {
  it('un mur sur un côté de la case suffit, à n’importe quelle hauteur', () => {
    const pieces: Pieces = {};
    expect(wallBeside(pieces, 0, 3, 3)).toBe(false);
    pieces[pieceKey({ slot: 'edge', level: 0, gx: 3, gz: 4, axis: 'x', layer: 2 })] = 'wall_wood';
    expect(wallBeside(pieces, 0, 3, 3)).toBe(true); // bord sud de la case (3, 3)
    expect(wallBeside(pieces, 0, 3, 4)).toBe(true); // bord nord de la case (3, 4)
    expect(wallBeside(pieces, 0, 3, 2)).toBe(false);
    expect(wallBeside(pieces, 1, 3, 3)).toBe(false); // un autre étage
  });

  it('une dalle au sol se reconnaît sous la case', () => {
    const pieces: Pieces = {};
    expect(slabAt(pieces, 0, 5, 5)).toBeNull();
    pieces[pieceKey({ slot: 'floor', level: 0, gx: 5, gz: 5 })] = 'slab_wood';
    expect(slabAt(pieces, 0, 5, 5)).not.toBeNull();
    expect(slabAt(pieces, 0, 6, 5)).toBeNull();
  });

  it('donne le côté du mur : vers le nord, le sud, l’ouest ou l’est de la case', () => {
    const at = (gx: number, gz: number, axis: 'x' | 'z'): Pieces => ({
      [pieceKey({ slot: 'edge', level: 0, gx, gz, axis, layer: 0 })]: 'wall_wood',
    });
    expect(wallSide(at(3, 3, 'x'), 0, 3, 3)).toEqual([0, -1]);
    expect(wallSide(at(3, 4, 'x'), 0, 3, 3)).toEqual([0, 1]);
    expect(wallSide(at(3, 3, 'z'), 0, 3, 3)).toEqual([-1, 0]);
    expect(wallSide(at(4, 3, 'z'), 0, 3, 3)).toEqual([1, 0]);
    expect(wallSide({}, 0, 3, 3)).toBeNull();
  });
});

describe('pose à la suite (clic maintenu)', () => {
  const last = { gx: 10, gz: 4, w: 3, d: 1 };

  it('se cale bout à bout derrière la dernière pièce, du côté du curseur', () => {
    expect(chainSlot(last, { w: 3, d: 1 }, { gx: 14, gz: 4 })).toEqual({ gx: 13, gz: 4 });
    expect(chainSlot(last, { w: 3, d: 1 }, { gx: 8, gz: 4 })).toEqual({ gx: 7, gz: 4 });
  });

  it('tient compte du sens : une pièce posée en travers s’enchaîne le long de z', () => {
    const across = { gx: 10, gz: 4, w: 1, d: 3 };
    expect(chainSlot(across, { w: 1, d: 3 }, { gx: 10, gz: 8 })).toEqual({ gx: 10, gz: 7 });
    expect(chainSlot(across, { w: 1, d: 3 }, { gx: 10, gz: 2 })).toEqual({ gx: 10, gz: 1 });
  });

  it('rend null quand le curseur est loin', () => {
    expect(chainSlot(last, { w: 3, d: 1 }, { gx: 30, gz: 4 })).toBeNull();
    expect(chainSlot(last, { w: 3, d: 1 }, { gx: 11, gz: 20 })).toBeNull();
  });
});
