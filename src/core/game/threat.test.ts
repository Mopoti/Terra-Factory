import { describe, expect, it } from 'vitest';
import { ENEMY_STATS, Threat, cellOf, kindOf, type Enemy, type ThreatWorld } from './threat';

/** Un nid en (100, 0) m ; pas d'arbres. */
const world: ThreatWorld = {
  nestsIn: (pcx, pcz) => (pcx === cellOf(100) && pcz === cellOf(0) ? [{ x: 100, z: 0 }] : []),
  treesIn: () => 0,
  nestsNear: (x, z, r) => (Math.hypot(x - 100, z) <= r ? [{ x: 100, z: 0 }] : []),
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
    const t = new Threat({}, {}, world, { aggressive: false });
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
    const a = new Threat({}, {}, world, { aggressive: false });
    const b = new Threat({}, {}, woods, { aggressive: false });
    a.emit(0, 0, 50);
    b.emit(0, 0, 50);
    run(a, 20);
    run(b, 20);
    expect(b.total()).toBeLessThan(a.total());
  });
});

describe('nids et ennemis', () => {
  it('un nid qui absorbe assez de pollution fabrique un ennemi ; sans pollution, rien', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
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
    const t = new Threat({}, {}, world, { aggressive: false });
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
    const calm = new Threat({}, {}, world, { aggressive: false });
    calm.enemies.push({ id: 1, x: 0, z: 0, hp: 25, cooldown: 0, idle: 0, target: null });
    calm.update(0.05, [{ id: 'player', x: 40, z: 0 }]);
    expect(calm.enemies[0].target).toBeNull();
    const fierce = new Threat({}, {}, world, { aggressive: true });
    fierce.enemies.push({ id: 1, x: 0, z: 0, hp: 25, cooldown: 0, idle: 0, target: null });
    fierce.update(0.05, [{ id: 'player', x: 40, z: 0 }]);
    expect(fierce.enemies[0].target).toBe('player');
    expect(fierce.hit(0, 0, 2, 13)).toBe('hit');
    expect(fierce.hit(0, 0, 2, 13)).toBe('kill');
    expect(fierce.enemies).toHaveLength(0);
  });

  it('la pollution est enregistrée avec la partie', () => {
    const saved = { '0,0': 12 };
    const t = new Threat(saved, {}, world, { aggressive: false });
    t.emit(1, 1, 5);
    expect(saved['0,0']).toBe(17);
  });
});

describe('pollution du sol et gardiens', () => {
  it('la pollution du sol ne se répand pas et s’efface très lentement', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    t.emit(0, 0, 50, 'ground');
    run(t, 10);
    expect(t.groundAt(0, 0)).toBeGreaterThan(48);
    expect(t.at(0, 0) + t.at(1, 0)).toBe(0);
    expect(t.groundAt(1, 0) + t.groundAt(-1, 0)).toBe(0);
  });

  it('un nid nourri de pollution du sol fabrique aussi des ennemis', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    for (let s = 0; s < 80; s++) {
      t.emit(100, 0, 2, 'ground');
      run(t, 1);
    }
    expect(t.enemies.length).toBeGreaterThan(0);
  });

  it('un nid garde 3 gardiens quand le joueur approche ; ils ne poursuivent que le joueur proche', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    t.keepGuards(1000, 1000, 1);
    expect(t.enemies).toHaveLength(0);
    t.keepGuards(60, 0, 1);
    expect(t.enemies).toHaveLength(3);
    t.update(0.05, [{ id: 'player', x: 160, z: 0 }]);
    expect(t.enemies.every((e) => e.target === null)).toBe(true);
    t.update(0.05, [{ id: 'player', x: 108, z: 0 }]);
    expect(t.enemies.every((e) => e.target === 'player')).toBe(true);
    // un gardien tué est remplacé au bout de 2 minutes
    t.hit(100, 0, 10, 100);
    expect(t.enemies).toHaveLength(2);
    for (let i = 0; i < 125; i++) t.keepGuards(60, 0, 1);
    expect(t.enemies).toHaveLength(3);
  });
});

describe('variantes d’ennemis (point 8)', () => {
  const enemy = (kind: Enemy['kind'], x: number, z: number): Enemy => ({
    id: 1,
    x,
    z,
    hp: ENEMY_STATS[kind ?? 'scout'].hp,
    kind,
    cooldown: 0,
    idle: 0,
    target: null,
    ...(kind && kind !== 'scout' ? { home: { x, z } } : {}),
  });

  it('éclaireur 25 PV / 4,5 m/s, gardien 80 PV / 2 m/s, cracheur 40 PV statique', () => {
    expect(ENEMY_STATS.scout).toEqual({ hp: 25, speed: 4.5 });
    expect(ENEMY_STATS.guard).toEqual({ hp: 80, speed: 2 });
    expect(ENEMY_STATS.spitter).toEqual({ hp: 40, speed: 0 });
    expect(kindOf({ ...enemy(undefined, 0, 0), home: { x: 0, z: 0 } })).toBe('guard');
    expect(kindOf(enemy(undefined, 0, 0))).toBe('scout');
  });

  it('un nid garde 3 gardiens de 80 PV', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    t.keepGuards(60, 0, 1);
    expect(t.enemies.map((e) => [kindOf(e), e.hp])).toEqual([
      ['guard', 80],
      ['guard', 80],
      ['guard', 80],
    ]);
  });

  it('un cracheur ne bouge pas et crache sur un tapis à portée toutes les 4 s', () => {
    const t = new Threat({}, {}, world, { aggressive: false }, [enemy('spitter', 100, 0)]);
    const belt = { id: 'machine:7', x: 110, z: 0 };
    const far = { id: 'machine:8', x: 200, z: 0 };
    const hits: string[] = [];
    for (let i = 0; i < 20 * 9; i++)
      for (const d of t.update(0.05, [], [belt, far])) if (d.acid) hits.push(d.target);
    expect(hits).toEqual(['machine:7', 'machine:7', 'machine:7']);
    expect([t.enemies[0].x, t.enemies[0].z]).toEqual([100, 0]);
  });

  it('un gardien attaque une machine polluante dans sa zone de 90 m, pas au-delà', () => {
    const t = new Threat({}, {}, world, { aggressive: false }, [enemy('guard', 100, 0)]);
    const near = { id: 'machine:1', x: 130, z: 0 };
    let damage = 0;
    for (let i = 0; i < 20 * 30; i++)
      for (const d of t.update(0.05, [near])) if (d.target === near.id) damage += d.amount;
    expect(damage).toBeGreaterThan(0);
    const t2 = new Threat({}, {}, world, { aggressive: false }, [enemy('guard', 100, 0)]);
    let far = 0;
    for (let i = 0; i < 20 * 30; i++)
      for (const d of t2.update(0.05, [{ id: 'machine:2', x: 300, z: 0 }])) far += d.amount;
    expect(far).toBe(0);
  });
});

describe('mutants (vapeur toxique)', () => {
  it('un nid proche d’une tour d’évaporation donne des ennemis mutants (PV ×2)', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    t.toxicSources = [{ x: 150, z: 0 }];
    t.keepGuards(60, 0, 1);
    expect(t.enemies.every((e) => e.mutant && e.hp === ENEMY_STATS.guard.hp * 2)).toBe(true);
    const calm = new Threat({}, {}, world, { aggressive: false });
    calm.toxicSources = [{ x: 600, z: 0 }];
    calm.keepGuards(60, 0, 1);
    expect(calm.enemies.some((e) => e.mutant)).toBe(false);
  });
});

describe('expansion des colonies', () => {
  const feed = (t: Threat, seconds: number): void => {
    for (let i = 0; i < seconds; i++) {
      t.emit(100, 0, 6);
      run(t, 1);
    }
  };

  it('un nid qui se nourrit de pollution en fonde un autre à 25–45 m', () => {
    const founded: { x: number; z: number }[] = [];
    const w: ThreatWorld = { ...world, addNest: (x, z) => (founded.push({ x, z }), true) };
    const t = new Threat({}, {}, w, { aggressive: false, expand: true });
    feed(t, 400);
    expect(founded.length).toBeGreaterThan(0);
    const d = Math.hypot(founded[0].x - 100, founded[0].z);
    expect(d).toBeGreaterThanOrEqual(25);
    expect(d).toBeLessThanOrEqual(45);
  });

  it('sans l’option, ou si le monde refuse, rien n’est fondé (et on réessaie plus tard)', () => {
    let asked = 0;
    const w: ThreatWorld = { ...world, addNest: () => (asked++, false) };
    feed(new Threat({}, {}, w, { aggressive: false, expand: false }), 400);
    expect(asked).toBe(0);
    feed(new Threat({}, {}, w, { aggressive: false, expand: true }), 400);
    expect(asked).toBeGreaterThan(1);
  });
});
