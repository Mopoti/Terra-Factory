import { describe, expect, it } from 'vitest';
import { GameState } from './state';

describe('réalité augmentée', () => {
  const armored = (inventory: Record<string, number>): GameState => {
    const s = new GameState({ inventory });
    s.changes.equipment.head = 'armor4_head';
    return s;
  };

  it('exige une armure T4 ou T5', () => {
    const s = new GameState({ inventory: { 'battery_portable~5': 1 } });
    s.changes.equipment.head = 'armor3_head';
    expect(s.cycleAr()).toBe('noArmor');
    expect(s.arMode).toBe(0);
  });

  it('exige une batterie', () => {
    const s = armored({});
    expect(s.cycleAr()).toBe('noBattery');
    expect(s.arMode).toBe(0);
  });

  it('passe de désactivé à simple, complet puis désactivé', () => {
    const s = armored({ 'battery_portable~5': 1 });
    s.cycleAr();
    expect(s.arMode).toBe(1);
    s.cycleAr();
    expect(s.arMode).toBe(2);
    s.cycleAr();
    expect(s.arMode).toBe(0);
  });

  it('le mode complet consomme trois fois plus que le simple', () => {
    const simple = armored({ 'battery_portable~5': 1 });
    simple.cycleAr();
    expect(simple.useAr(60)).toBe(true);
    expect(simple.inventory['battery_portable~4']).toBe(1);
    const full = armored({ 'battery_portable~5': 1 });
    full.cycleAr();
    full.cycleAr();
    let steps = 0;
    for (let t = 0; t < 600; t++) {
      if (full.useAr(1)) steps++;
      else break;
    }
    expect(full.arMode).toBe(0);
    // 5 niveaux de 150 s en simple = 750 s ; en complet, trois fois moins.
    expect(steps).toBeLessThanOrEqual(260);
    expect(steps).toBeGreaterThanOrEqual(240);
  });

  it('se coupe quand l’armure est retirée', () => {
    const s = armored({ 'battery_portable~5': 1 });
    s.cycleAr();
    delete s.changes.equipment.head;
    expect(s.useAr(1)).toBe(false);
    expect(s.arMode).toBe(0);
  });
});
