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

  it('recharge les batteries portables du joueur à portée, niveau par niveau', () => {
    const { s, f } = setup();
    expect(s.inventory.battery_portable).toBe(2);
    run(s, f, [{ x: 4, z: 2 }], 3);
    // 400 kW pendant 3 s = 1200 kJ = 2 niveaux de 600 kJ, sur une seule batterie (la plus chargée d'abord).
    expect(s.inventory['battery_portable~2']).toBe(1);
    expect(s.inventory.battery_portable).toBe(1);
    run(s, f, [{ x: 4, z: 2 }], 100);
    expect(s.inventory['battery_portable~10']).toBe(2);
    expect(s.hasChargeableBattery()).toBe(false);
  });

  it('sans cible, la borne ne consomme rien ; loin, elle ne charge pas', () => {
    const { s, f, charger } = setup();
    run(s, f, [{ x: 60, z: 60 }], 3);
    expect(s.inventory.battery_portable).toBe(2);
    expect(f.gridInfo(charger)!.demandKw).toBe(0);
  });

  it('le propulseur puise d’abord dans la batterie portable la moins chargée', () => {
    const s = new GameState({ inventory: { 'battery_portable~3': 1, 'battery_portable~7': 1 } });
    s.changes.equipment.back = 'jetpack';
    expect(s.useJetpack(1)).toBe(true);
    expect(s.inventory['battery_portable~2']).toBe(1);
    expect(s.inventory['battery_portable~7']).toBe(1);
    expect(s.useJetpack(5.5)).toBe(true); // encore dans le même niveau de 6 s
    expect(s.inventory['battery_portable~2']).toBe(1);
  });
});
