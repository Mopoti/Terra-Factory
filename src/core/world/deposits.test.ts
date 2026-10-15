import { describe, expect, it } from 'vitest';
import { depositInfo, type OreLookup } from './deposits';

/** Deux filons séparés par une case vide : fer 3 x 2 (10 par case) et charbon 2 x 1 collé au fer en diagonale. */
const cells: Record<string, { id: string; amount: number }> = {};
for (let x = 0; x < 3; x++)
  for (let z = 0; z < 2; z++) cells[`${x},${z}`] = { id: 'iron_ore', amount: 10 };
cells['3,2'] = { id: 'coal', amount: 7 };
cells['4,2'] = { id: 'coal', amount: 5 };
cells['2,2'] = { id: 'coal', amount: 0 }; // épuisé : ne compte pas
const oreAt: OreLookup = (gx, gz) => cells[`${gx},${gz}`] ?? null;

describe('filons', () => {
  it('additionne les cases voisines du même minerai', () => {
    expect(depositInfo(oreAt, 1, 1)).toEqual({
      id: 'iron_ore',
      total: 60,
      cells: 6,
      truncated: false,
    });
    expect(depositInfo(oreAt, 3, 2)).toEqual({ id: 'coal', total: 12, cells: 2, truncated: false });
  });
  it('rien sur une case vide ou épuisée', () => {
    expect(depositInfo(oreAt, 9, 9)).toBeNull();
    expect(depositInfo(oreAt, 2, 2)).toBeNull();
  });
  it('s’arrête sur un filon trop grand et le dit', () => {
    const big: OreLookup = () => ({ id: 'sand', amount: 1 });
    const info = depositInfo(big, 0, 0, 500);
    expect(info?.truncated).toBe(true);
    expect(info?.cells).toBe(500);
  });
});
