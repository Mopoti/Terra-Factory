import { describe, expect, it } from 'vitest';
import { emptyMachine, Factory, type FactoryWorld } from '../factory/factory';
import { SIM_STEP_S, WorldSimulation, type SimEvent } from './simulation';
import { GameState } from './state';
import { Threat, type Enemy, type ThreatWorld } from './threat';

const flat: FactoryWorld = { oreAt: () => null, mineOre: () => 0 };
const noNests: ThreatWorld = { nestsIn: () => [], treesIn: () => 0, nestsNear: () => [] };

const make = (
  machines = [] as ReturnType<typeof emptyMachine>[],
  enemies: Enemy[] = [],
): { sim: WorldSimulation; state: GameState; factory: Factory; threat: Threat } => {
  const state = new GameState({ inventory: {} });
  const factory = new Factory(machines, flat);
  const threat = new Threat({}, {}, noNests, { aggressive: false }, enemies);
  return { sim: new WorldSimulation(state, factory, threat), state, factory, threat };
};

describe('simulation du monde à pas fixe', () => {
  it('avance par pas de 0,05 s, quelle que soit la durée des images', () => {
    const a = make();
    const b = make();
    a.sim.advance(0.5, []);
    for (let i = 0; i < 50; i++) b.sim.advance(0.01, []);
    expect(a.state.changes.time).toBeCloseTo(0.5, 5);
    expect(b.state.changes.time).toBeCloseTo(0.5, 5);
    // une image très longue est plafonnée à 0,5 s de simulation
    a.sim.advance(5, []);
    expect(a.state.changes.time).toBeCloseTo(1, 5);
    expect(SIM_STEP_S).toBe(0.05);
  });

  it('deux simulations identiques donnent le même résultat (déterminisme)', () => {
    const mk = (): ReturnType<typeof make> => {
      const belt = emptyMachine(1, 'conveyor', 0, 0, 1);
      belt.belt.push({ item: 'iron_ingot', pos: 0 });
      return make([belt, emptyMachine(2, 'conveyor', 2, 0, 1)]);
    };
    const a = mk();
    const b = mk();
    a.sim.advance(0.5, []);
    for (let i = 0; i < 5; i++) b.sim.advance(0.1, []);
    expect(JSON.stringify(a.factory.machines)).toBe(JSON.stringify(b.factory.machines));
  });

  it('un ennemi qui touche un joueur renvoie un événement ; en Créatif, il l’ignore', () => {
    const enemy: Enemy = { id: 1, x: 0, z: 0, hp: 25, cooldown: 0, idle: 0, target: null };
    const solo = make([], [{ ...enemy }]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 40; i++) solo.sim.step([{ id: 'p1', x: 0.5, z: 0 }], events);
    expect(events.some((e) => e.type === 'playerHit' && e.player === 'p1')).toBe(true);
    const creative = make([], [{ ...enemy }]);
    creative.state.creative = true;
    const quiet: SimEvent[] = [];
    for (let i = 0; i < 40; i++) creative.sim.step([{ id: 'p1', x: 0.5, z: 0 }], quiet);
    expect(quiet.some((e) => e.type === 'playerHit')).toBe(false);
  });

  it('plusieurs joueurs : chacun est une cible identifiée par son nom', () => {
    const enemy: Enemy = { id: 1, x: 10, z: 0, hp: 25, cooldown: 0, idle: 0, target: null };
    const { sim } = make([], [enemy]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 200; i++)
      sim.step(
        [
          { id: 'p1', x: 40, z: 40 },
          { id: 'p2', x: 10.5, z: 0 },
        ],
        events,
      );
    const hits = events.filter((e) => e.type === 'playerHit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.type === 'playerHit' && e.player === 'p2')).toBe(true);
  });

  it('un cracheur abîme un tapis proche (événement machineAcid)', () => {
    const spitter: Enemy = {
      id: 1,
      x: 0,
      z: 0,
      hp: 40,
      kind: 'spitter',
      home: { x: 0, z: 0 },
      cooldown: 0,
      idle: 0,
      target: null,
    };
    const belt = emptyMachine(7, 'conveyor', 10, 0, 1);
    const { sim, factory } = make([belt], [spitter]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 60; i++) sim.step([], events);
    expect(events).toContainEqual({ type: 'machineAcid', id: 7 });
    expect(factory.machines[0].broken).toBe(true);
  });
});

describe('tourelles : repérer, viser, tirer', () => {
  const enemyAt = (id: number, x: number, z: number, hp = 25): Enemy => ({
    id,
    x,
    z,
    hp,
    cooldown: 0,
    idle: 0,
    target: null,
  });
  const laser = (): ReturnType<typeof emptyMachine> => emptyMachine(1, 'turret_laser', 0, 0, 0);
  const powered = (m: ReturnType<typeof emptyMachine>): ReturnType<typeof emptyMachine>[] => [
    emptyMachine(2, 'generator', 8, 0, 0),
    emptyMachine(3, 'pole', 4, 4, 0),
    m,
  ];

  it('la tourelle vise l’ennemi le plus proche à portée, et le touche', () => {
    const turret = laser();
    const gen = emptyMachine(2, 'generator', 8, 0, 0);
    gen.fuel = { item: 'coal', count: 10 };
    const { sim, factory, threat } = make(
      [gen, emptyMachine(3, 'pole', 4, 4, 0), turret],
      [enemyAt(1, 30, 0, 100), enemyAt(2, 10, 0, 100), enemyAt(3, 200, 0, 100)],
    );
    const events: SimEvent[] = [];
    for (let i = 0; i < 8; i++) sim.step([], events);
    expect(factory.turretAim.get(1)).toEqual({ x: 10, z: 0 });
    const shots = events.filter((e) => e.type === 'turretShot');
    expect(shots.length).toBeGreaterThan(0);
    expect(shots[0]).toMatchObject({ id: 1, tx: 10, tz: 0 });
    expect(threat.enemies.find((e) => e.id === 2)!.hp).toBeLessThan(100);
    expect(threat.enemies.find((e) => e.id === 1)!.hp).toBe(100);
  });

  it('hors de portée, ou sans courant, ou sans ennemi : elle ne vise pas et ne tire pas', () => {
    const far = make([...powered(laser())], [enemyAt(1, 500, 0)]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 8; i++) far.sim.step([], events);
    expect(far.factory.turretAim.size).toBe(0);
    expect(events.some((e) => e.type === 'turretShot')).toBe(false);
    // Sans générateur alimenté : pas de courant, donc pas de tir.
    const dark = make([laser()], [enemyAt(1, 10, 0)]);
    for (let i = 0; i < 8; i++) dark.sim.step([], events);
    expect(dark.factory.turretAim.size).toBe(0);
    expect(events.some((e) => e.type === 'turretShot')).toBe(false);
    // Plus d'ennemi : la visée est effacée.
    const calm = make([...powered(laser())], []);
    calm.factory.turretAim.set(1, { x: 1, z: 1 });
    calm.sim.step([], events);
    expect(calm.factory.turretAim.size).toBe(0);
  });

  it('la tourelle à munitions tire jusqu’à épuisement des balles', () => {
    const turret = emptyMachine(1, 'turret', 0, 0, 0);
    turret.input = { item: 'magazine', count: 1 };
    const { sim, threat } = make([turret], [enemyAt(1, 5, 0, 10_000)]);
    const events: SimEvent[] = [];
    for (let i = 0; i < 20 * 30; i++) sim.step([], events);
    const shots = events.filter((e) => e.type === 'turretShot').length;
    expect(shots).toBe(12); // un chargeur de 12 balles
    expect(threat.enemies[0].hp).toBe(10_000 - 12 * 9);
  });
});
