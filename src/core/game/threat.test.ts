import { describe, expect, it } from 'vitest';
import { Threat, cellOf, type ThreatWorld } from './threat';

/** Un nid en (100, 0) m ; pas d'arbres. */
const world: ThreatWorld = {
  nestsIn: (pcx, pcz) => (pcx === cellOf(100) && pcz === cellOf(0) ? [{ x: 100, z: 0 }] : []),
  treesIn: () => 0,
};

const run = (
  t: Threat,
  seconds: number,
  targets = [] as { id: string; x: number; z: number }[],
): void => {
  for (let i = 0; i < seconds * 20; i++) t.update(0.05, targets);
};

describe('pollution', () => {
  it('s’accumule, se répand et disparaît peu à peu (absorption)', () => {
    const t = new Threat({}, world, { aggressive: false });
    t.emit(0, 0, 100);
    expect(t.at(0, 0)).toBe(100);
    run(t, 4, []);
    expect(t.at(0, 0)).toBeLessThan(100);
    expect(t.at(1, 0) + t.at(-1, 0) + t.at(0, 1) + t.at(0, -1)).toBeGreaterThan(0);
    run(t, 600, []);
    expect(t.total()).toBeLessThan(1);
  });

  it('les arbres absorbent', () => {
    const woods: ThreatWorld = { ...world, treesIn: () => 40 };
    const a = new Threat({}, world, { aggressive: false });
    const b = new Threat({}, woods, { aggressive: false });
    a.emit(0, 0, 50);
    b.emit(0, 0, 50);
    run(a, 20);
    run(b, 20);
    expect(b.total()).toBeLessThan(a.total());
  });
});

describe('nids et ennemis', () => {
  it('un nid qui absorbe assez de pollution fabrique un ennemi ; sans pollution, rien', () => {
    const t = new Threat({}, world, { aggressive: false });
    run(t, 60);
    expect(t.enemies).toHaveLength(0);
    // pollution dans la cellule du nid : 3 points/s pendant 30 s
    for (let s = 0; s < 30; s++) {
      t.emit(100, 0, 3);
      run(t, 1);
    }
    expect(t.enemies.length).toBeGreaterThan(0);
  });

  it('les ennemis vont vers l’installation polluante et la détruisent à coups de dégâts', () => {
    const t = new Threat({}, world, { aggressive: false });
    t.enemies.push({ id: 1, x: 100, z: 0, hp: 25, cooldown: 0, idle: 0, target: null });
    const targets = [{ id: 'machine:7', x: 60, z: 0 }];
    let dealt = 0;
    for (let i = 0; i < 20 * 30; i++) {
      for (const d of t.update(0.05, targets)) if (d.target === 'machine:7') dealt += d.amount;
    }
    expect(t.enemies[0].x).toBeLessThan(62);
    expect(dealt).toBeGreaterThan(50);
  });

  it('un ennemi peu agressif ignore le joueur lointain ; le joueur peut les frapper', () => {
    const calm = new Threat({}, world, { aggressive: false });
    calm.enemies.push({ id: 1, x: 0, z: 0, hp: 25, cooldown: 0, idle: 0, target: null });
    calm.update(0.05, [{ id: 'player', x: 20, z: 0 }]);
    expect(calm.enemies[0].target).toBeNull();
    const fierce = new Threat({}, world, { aggressive: true });
    fierce.enemies.push({ id: 1, x: 0, z: 0, hp: 25, cooldown: 0, idle: 0, target: null });
    fierce.update(0.05, [{ id: 'player', x: 20, z: 0 }]);
    expect(fierce.enemies[0].target).toBe('player');
    expect(fierce.hit(0, 0, 2, 13)).toBe('hit');
    expect(fierce.hit(0, 0, 2, 13)).toBe('kill');
    expect(fierce.enemies).toHaveLength(0);
  });

  it('la pollution est enregistrée avec la partie', () => {
    const saved = { '0,0': 12 };
    const t = new Threat(saved, world, { aggressive: false });
    t.emit(1, 1, 5);
    expect(saved['0,0']).toBe(17);
  });
});
