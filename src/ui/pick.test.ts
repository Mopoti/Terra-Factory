import { describe, expect, it } from 'vitest';
import { GameState } from '../core/game/state';
import { cellsToShow } from '../core/game/inventory';

const bagCellsShown = (s: GameState): number => cellsToShow(s.bagSlots(), s.limits.maxSlots);

describe('cases du sac affichées', () => {
  it('en créatif, descendre une pile ne fait pas grandir la grille', () => {
    const s = new GameState({ inventory: { coal: 1, wood: 5 } });
    s.creative = true;
    const start = bagCellsShown(s);
    expect(start).toBe(30);
    const i = s.bagSlots().findIndex((x) => x?.item === 'coal');
    // On descend la pile de quelques cases, plusieurs fois, jusqu'au bas de la grille affichée.
    let at = i;
    for (let k = 0; k < 10 && at + 3 < bagCellsShown(s); k++) {
      s.moveBagSlot(at, at + 3);
      at += 3;
    }
    expect(bagCellsShown(s)).toBe(30);
    expect(s.bagSlots().filter(Boolean)).toHaveLength(2);
  });

  it('la grille garde la place des piles et une dizaine de cases libres', () => {
    const s = new GameState({ inventory: {} });
    s.creative = true;
    for (const [id, n] of [
      ['coal', 1],
      ['wood', 1],
      ['rail', 500],
    ] as const)
      s.inventory[id] = n;
    const shown = bagCellsShown(s);
    expect(shown).toBeGreaterThanOrEqual(30);
    expect(shown).toBeGreaterThanOrEqual(s.bagSlots().filter(Boolean).length + 10);
  });
});
