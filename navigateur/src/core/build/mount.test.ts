import { describe, expect, it } from 'vitest';
import { pieceKey, slabAt, wallBeside, type Pieces } from './pieces';

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
});
