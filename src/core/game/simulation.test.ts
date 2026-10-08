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
