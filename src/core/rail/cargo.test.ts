import { describe, expect, it } from 'vitest';
import { cargoWindowId } from '../data/trains';
import { emptyMachine } from '../factory/factory';
import { GameState } from '../game/state';
import { normalizeChanges } from '../game/worldChanges';
import { TILE_CELLS } from './track';
import { cargoMassKg, consistMass, massOfCar } from './train';

const free = (): boolean => false;

function setup() {
  const s = new GameState({
    inventory: {
      rail: 99,
      train_wagon_freight: 1,
      train_wagon_tanker: 1,
      barrel_water: 8,
      barrel_empty: 3,
    },
  });
  s.creative = true;
  for (let k = 0; k < 6; k++) s.placeRail('straight', 0, -TILE_CELLS * k, 0, 0, free);
  const rails = s.changes.rails;
  const freight = s.placeCar('wagon_freight', { piece: rails[0].id, u: 1, dir: 1 })!.cars[0];
  const tanker = s.placeCar('wagon_tanker', { piece: rails[3].id, u: 1, dir: 1 })!.cars[0];
  const chest = emptyMachine(cargoWindowId(freight.id), 'chest_iron', 0, 0, 0);
  freight.cargo = [];
  chest.slots = freight.cargo;
  return { s, freight, tanker, chest };
}

describe('contenu des wagons', () => {
  it('un wagon de fret se charge selon la charge utile et pèse son contenu', () => {
    const { s, freight, chest } = setup();
    const empty = massOfCar(freight);
    expect(s.cargoRoom(freight, 'barrel_water')).toBe(185); // 20 000 kg / 108 kg
    s.inventory.barrel_water = 300;
    expect(s.putInChest(chest, 'barrel_water', 300)).toBe(185);
    expect(cargoMassKg(freight)).toBeCloseTo(185 * 108);
    expect(massOfCar(freight)).toBeCloseTo(empty + 185 * 108);
    expect(s.cargoRoom(freight, 'barrel_water')).toBe(0);
    // Reprendre libère la charge utile.
    expect(s.takeFromChest(chest, 0, 10)).toBe(10);
    expect(s.cargoRoom(freight, 'barrel_water')).toBe(10);
  });

  it('la masse du convoi compte le contenu', () => {
    const { s, freight } = setup();
    const c = s.changes.trains.find((t) => t.cars.includes(freight))!;
    const before = consistMass(c);
    freight.cargo = [{ item: 'barrel_water', count: 100 }];
    expect(consistMass(c)).toBeCloseTo(before + 10800);
  });

  it('une citerne se remplit et se vide par barils de 100 L', () => {
    const { s, tanker } = setup();
    expect(s.pourBarrel(tanker.id)).toBe('ok');
    expect(s.pourBarrel(tanker.id)).toBe('ok');
    expect(tanker.liquid).toEqual({ kind: 'water', liters: 200 });
    expect(s.inventory.barrel_water).toBe(6);
    expect(s.inventory.barrel_empty).toBe(5);
    expect(cargoMassKg(tanker)).toBeCloseTo(200);
    expect(s.drawBarrel(tanker.id)).toBe('ok');
    expect(tanker.liquid?.liters).toBe(100);
    expect(s.drawBarrel(tanker.id)).toBe('ok');
    expect(tanker.liquid).toBeNull();
    expect(s.drawBarrel(tanker.id)).toBe('empty');
    s.inventory.barrel_empty = 0;
    tanker.liquid = { kind: 'water', liters: 500 };
    expect(s.drawBarrel(tanker.id)).toBe('noBarrel');
    tanker.liquid = { kind: 'water', liters: 9950 };
    expect(s.pourBarrel(tanker.id)).toBe('full');
  });

  it('le contenu survit à une sauvegarde, borné par les limites du wagon', () => {
    const { s, freight, tanker } = setup();
    freight.cargo = [{ item: 'barrel_water', count: 100 }];
    tanker.liquid = { kind: 'oil', liters: 4000 };
    const copy = normalizeChanges(JSON.parse(JSON.stringify(s.snapshot().changes)));
    const cars = copy.trains.flatMap((c) => c.cars);
    expect(cars.find((k) => k.kind === 'wagon_freight')?.cargo).toEqual([
      { item: 'barrel_water', count: 100 },
    ]);
    expect(cars.find((k) => k.kind === 'wagon_tanker')?.liquid).toEqual({
      kind: 'oil',
      liters: 4000,
    });
    // Une sauvegarde truquée est ramenée aux limites.
    const raw = JSON.parse(JSON.stringify(s.snapshot().changes));
    raw.trains[0].cars[0].cargo = [{ item: 'barrel_water', count: 99999 }];
    const bad = normalizeChanges(raw)
      .trains.flatMap((c) => c.cars)
      .find((k) => k.kind === 'wagon_freight');
    expect(bad?.cargo?.[0].count).toBe(185);
  });
});
