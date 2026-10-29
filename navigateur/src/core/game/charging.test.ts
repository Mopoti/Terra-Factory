import { describe, expect, it } from 'vitest';
import { emptyMachine, Factory } from '../factory/factory';
import { stepChargers } from './charging';
import { GameState } from './state';

const world = { oreAt: () => null, mineOre: () => 0 };

describe('borne de recharge', () => {
  const setup = (): { s: GameState; f: Factory; charger: ReturnType<typeof emptyMachine> } => {
    const s = new GameState({ inventory: { battery_portable: 2 } });
    const gen = emptyMachine(1, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const gen2 = emptyMachine(4, 'generator', 0, 8, 0);
    gen2.fuel = { item: 'coal', count: 20 };
    const charger = emptyMachine(3, 'charger', 6, 0, 0);
    const f = new Factory([gen, gen2, emptyMachine(2, 'pole', 4, 4, 0), charger], world);
    return { s, f, charger };
  };
  const run = (
    s: GameState,
    f: Factory,
    players: { x: number; z: number }[],
    secs: number,
  ): void => {
    for (let i = 0; i < secs * 20; i++) {
      f.tick(0.05);
      stepChargers(s, f, players, 0.05);
    }
  };

  it('charge un véhicule électrique à portée, pas un véhicule à moteur', () => {
    const { s, f } = setup();
    s.changes.vehicles.push(
      { id: 1, kind: 'quad_electric', x: 4, z: 2, yaw: 0, fuel: 0, fuelStack: null, slots: [] },
      { id: 2, kind: 'quad', x: 4, z: 3, yaw: 0, fuel: 0, fuelStack: null, slots: [] },
    );
    run(s, f, [], 10);
    expect(s.changes.vehicles[0].fuel).toBeGreaterThan(40);
    expect(s.changes.vehicles[1].fuel).toBe(0);
  });

  it('recharge les batteries portables du joueur à portée, jusqu’à leur capacité', () => {
    const { s, f } = setup();
    run(s, f, [{ x: 4, z: 2 }], 60);
    expect(s.changes.batteryS).toBeCloseTo(120, 0); // 2 batteries × 60 s
    expect(s.batteryFill()).toBe(1);
  });

  it('sans cible, la borne ne consomme rien ; loin, elle ne charge pas', () => {
    const { s, f, charger } = setup();
    run(s, f, [{ x: 60, z: 60 }], 3);
    expect(s.changes.batteryS).toBe(0);
    expect(f.gridInfo(charger)!.demandKw).toBe(0);
  });

  it('le propulseur puise d’abord dans les batteries portables', () => {
    const s = new GameState({ inventory: { battery_portable: 1 } });
    s.changes.equipment.back = 'jetpack';
    s.changes.batteryS = 5;
    expect(s.useJetpack(2)).toBe(true);
    expect(s.changes.batteryS).toBe(3);
  });
});
