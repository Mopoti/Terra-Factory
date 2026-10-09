import { describe, expect, it } from 'vitest';
import { emptyMachine } from '../factory/factory';
import { GameState } from './state';

describe('piles du sac et machines', () => {
  /** Un sac de 150 charbons coupés en piles de 70 (case 0) et 30 (case 3), plus 50 dans une autre pile. */
  const bag = (): GameState => {
    const s = new GameState({ inventory: { coal: 150 } });
    s.bagSlots(); // 100 + 50
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
    ).toEqual([70, 50, 0, 30]);
  });

  it('charger une machine avec une pile précise ne touche pas les autres piles', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    // La pile n° 3 (30 charbons) est plus petite que la limite de la machine : elle seule est consommée.
    expect(s.loadMachine(m, 'fuel', 'coal', 100, 3)).toBe(30);
    expect(m.fuel?.count).toBe(30);
    expect(
      s
        .bagSlots()
        .map((p) => p?.count ?? 0)
        .slice(0, 4),
    ).toEqual([70, 50, 0, 0]);
    expect(s.inventory.coal).toBe(120);
  });

  it('la machine ne prend que ce qui tient et laisse le reste dans la même pile', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    const room = 5;
    m.fuel = { item: 'coal', count: 100 - room };
    expect(s.loadMachine(m, 'fuel', 'coal', 100, 0)).toBe(room);
    expect(
      s
        .bagSlots()
        .map((p) => p?.count ?? 0)
        .slice(0, 4),
    ).toEqual([65, 50, 0, 30]);
  });

  it('on ne peut pas prendre dans une pile qui ne contient pas cet objet', () => {
    const s = bag();
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    expect(s.loadMachine(m, 'fuel', 'coal', 10, 2)).toBe(0);
    expect(s.inventory.coal).toBe(150);
  });
});
