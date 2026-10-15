import { describe, expect, it } from 'vitest';
import { BIOME_IDS } from '../core/world/biomes';
import { cellDiagonal, groundColor, groundNormal } from './groundStyle';

describe('sol low poly des biomes', () => {
  it('donne à chaque biome une teinte distincte et des triangles variés', () => {
    const mean = (biome: (typeof BIOME_IDS)[number]): [number, number, number] => {
      let r = 0;
      let g = 0;
      let b = 0;
      const set = new Set<string>();
      for (let gx = 0; gx < 40; gx++)
        for (let gz = 0; gz < 40; gz++) {
          const c = groundColor(biome, 7, gx * 0.5, gz * 0.5, gx, gz, gx % 2);
          r += c.r;
          g += c.g;
          b += c.b;
          set.add(`${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`);
        }
      expect(set.size).toBeGreaterThan(50);
      return [r / 1600, g / 1600, b / 1600];
    };
    const prairie = mean('prairie');
    const desert = mean('desert');
    const tundra = mean('tundra');
    const forest = mean('forest');
    expect(prairie[1]).toBeGreaterThan(prairie[0]); // vert
    expect(forest[1]).toBeLessThan(prairie[1]); // plus sombre
    expect(desert[0]).toBeGreaterThan(desert[2]); // sable
    expect(tundra[2]).toBeGreaterThan(0.75); // neige
  });

  it('est déterministe et garde des normales presque verticales', () => {
    expect(groundColor('desert', 3, 1.25, 4.75, 2, 9, 1)).toEqual(
      groundColor('desert', 3, 1.25, 4.75, 2, 9, 1),
    );
    expect(cellDiagonal(3, 2, 9)).toBe(cellDiagonal(3, 2, 9));
    const [x, y, z] = groundNormal(3, 2, 9, 0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    expect(y).toBeGreaterThan(0.98);
  });
});
