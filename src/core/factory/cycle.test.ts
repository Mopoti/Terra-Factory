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
});
