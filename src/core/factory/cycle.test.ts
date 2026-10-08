import { describe, expect, it } from 'vitest';
import { RECIPES } from '../data/recipes';
import { emptyMachine, Factory } from './factory';

const world = { oreAt: () => null, mineOre: () => 0 };

describe('barre de progression des machines', () => {
  it('le fourneau : fraction du cycle de la recette en cours, rien sans cycle', () => {
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    m.recipe = 'iron';
    const f = new Factory([m], world);
    const seconds = RECIPES.find((r) => r.id === 'iron')?.seconds ?? 1;
    expect(f.cycleFraction(m)).toBeNull();
    m.progress = seconds / 2;
    expect(f.cycleFraction(m)).toBeCloseTo(0.5);
    m.progress = seconds * 3;
    expect(f.cycleFraction(m)).toBe(1);
    m.broken = true;
    expect(f.cycleFraction(m)).toBeNull();
  });

  it('tapis, tuyaux et coffres n’ont pas de barre ; le réacteur à fission descend avec sa barre', () => {
    const belt = emptyMachine(1, 'conveyor', 0, 0, 0);
    belt.progress = 1;
    const f = new Factory([belt], world);
    expect(f.cycleFraction(belt)).toBeNull();
    const reactor = emptyMachine(2, 'fission_reactor', 4, 4, 0);
    reactor.progress = Factory.ROD_SECONDS;
    expect(f.cycleFraction(reactor)).toBeCloseTo(0);
    reactor.progress = Factory.ROD_SECONDS / 4;
    expect(f.cycleFraction(reactor)).toBeCloseTo(0.75);
  });

  it('entre deux cycles la barre revient à zéro pendant la pause, puis repart', () => {
    const m = emptyMachine(1, 'stamper', 0, 0, 0);
    m.recipe = 'copper_plate';
    m.fuel = { item: 'coal', count: 20 };
    m.input = { item: 'mould_plate', count: 3 };
    m.slots.push({ item: 'copper_ingot', count: 20 });
    const f = new Factory([m], world);
    const seconds = RECIPES.find((r) => r.id === 'copper_plate')?.seconds ?? 1;
    let reachedEnd = 0;
    let restFrames = 0;
    let produced = m.stock?.count ?? 0;
    for (let i = 0; i < 200; i++) {
      f.tick(0.05);
      reachedEnd = Math.max(reachedEnd, f.cycleFraction(m) ?? 0);
      const now = m.stock?.count ?? 0;
      if (now > produced) {
        // Un cycle vient de finir : la barre est à zéro et le reste jusqu'à la fin de la pause.
        expect(f.cycleFraction(m)).toBeNull();
        produced = now;
      }
      if (f.cycleFraction(m) === null && produced > 0) restFrames++;
    }
    expect(reachedEnd).toBeGreaterThan(0.9); // la barre va (presque) jusqu'au bout
    expect(restFrames * 0.05).toBeGreaterThanOrEqual(Factory.CYCLE_REST_S);
    expect(seconds).toBeGreaterThanOrEqual(3); // le cycle dure au moins 3 s
  });
});
