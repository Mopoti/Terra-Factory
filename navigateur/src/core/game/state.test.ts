import { describe, expect, it } from 'vitest';
import { emptyMachine, Factory } from '../factory/factory';
import { GameState } from './state';

describe('kit de réparation', () => {
  const setup = (kits: number): { s: GameState; f: Factory; id: number } => {
    const s = new GameState({ inventory: { repair_kit: kits } });
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    const f = new Factory([m], { oreAt: () => null, mineOre: () => 0 });
    f.health.set(1, 30);
    return { s, f, id: 1 };
  };
  it('une charge rend 25 % de la vie ; un kit en a 5', () => {
    const { s, f, id } = setup(1);
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(f.health.get(id)).toBe(60);
    expect(s.changes.kitCharges).toBe(4);
    expect(s.inventory.repair_kit ?? 0).toBe(0);
    expect(s.repairCharges()).toBe(4);
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(f.health.has(id)).toBe(false); // 30 + 3 × 30 = 120 : intacte
    expect(s.repairMachine(f, id)).toBe('full');
    expect(s.changes.kitCharges).toBe(2);
  });
  it('sans kit, rien ne se répare', () => {
    const { s, f, id } = setup(0);
    expect(s.repairMachine(f, id)).toBe('noKit');
    expect(f.health.get(id)).toBe(30);
  });
});
