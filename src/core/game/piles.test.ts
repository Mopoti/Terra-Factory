import { describe, expect, it } from 'vitest';
import { emptyMachine } from '../factory/factory';
import { GameState } from './state';

describe('piles du sac et machines', () => {
  /** Un sac de 150 charbons (piles de 50) : la pile 0 est coupée, 30 charbons vont dans la case 3. */
  const bag = (): GameState => {
    const s = new GameState({ inventory: { coal: 150 } });
    s.bagSlots(); // 50 + 50 + 50
    s.takeToHand('coal', 30, 0);
    s.placeHand(3);
    return s;
  };

  it('on peut diviser une pile : les piles restent séparées', () => {
    const s = bag();
    expect(
      s
        .bagSlots()
        .map((p) => p?.count ?? 0)
        .slice(0, 4),
    ).toEqual([20, 50, 50, 30]);
  });

  it('charger une machine avec une pile précise ne touche pas les autres piles', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    // Le four garde 10 houilles au plus : seule la pile n° 3 (30 charbons) est entamée.
    expect(s.loadMachine(m, 'fuel', 'coal', 100, 3)).toBe(10);
    expect(m.fuel?.count).toBe(10);
    expect(
      s
        .bagSlots()
        .map((p) => p?.count ?? 0)
        .slice(0, 4),
    ).toEqual([20, 50, 50, 20]);
    expect(s.inventory.coal).toBe(140);
  });

  it('la machine ne prend que ce qui tient et laisse le reste dans la même pile', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    const room = 5;
    m.fuel = { item: 'coal', count: 10 - room };
    expect(s.loadMachine(m, 'fuel', 'coal', 100, 0)).toBe(room);
    expect(
      s
        .bagSlots()
        .map((p) => p?.count ?? 0)
        .slice(0, 4),
    ).toEqual([15, 50, 50, 30]);
  });

  it('on ne peut pas prendre dans une pile qui ne contient pas cet objet', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    expect(s.loadMachine(m, 'fuel', 'coal', 10, 4)).toBe(0); // la case 4 est vide
    expect(s.inventory.coal).toBe(150);
  });
});
