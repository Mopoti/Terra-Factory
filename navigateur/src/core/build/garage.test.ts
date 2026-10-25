import { describe, expect, it } from 'vitest';
import { GameState } from '../game/state';
import { normalizeChanges } from '../game/worldChanges';
import { GARAGE_KIND, GARAGE_WIDTH_CELLS, pieceDef } from '../data/buildings';
import { WIDEST_VEHICLE_M } from '../data/vehicles';
import { itemById } from '../data/items';
import { distanceToGarage, garageGroup } from './garage';
import { evaluatePlan, planWall } from './plan';

const stateWithGarage = (): { s: GameState; key: string } => {
  const s = new GameState({ inventory: { piece_garage_aluminium: 2 } });
  const plan = planWall(GARAGE_KIND, 0, 'x', 10, { i: 20, layer: 0 }, { i: 20, layer: 0 });
  expect(s.placeMany(GARAGE_KIND, plan)).toBe(plan.length);
  return { s, key: 'e:0:20,10:x:0' };
};

describe('porte de garage', () => {
  it('fait la largeur du plus large des véhicules + 2 cases, centrée sur la case visée', () => {
    expect(WIDEST_VEHICLE_M).toBeGreaterThanOrEqual(2.4);
    expect(GARAGE_WIDTH_CELLS * 0.5).toBeGreaterThanOrEqual(WIDEST_VEHICLE_M + 1);
    const plan = planWall(GARAGE_KIND, 0, 'x', 10, { i: 20, layer: 0 }, { i: 20, layer: 0 });
    expect(plan).toHaveLength(GARAGE_WIDTH_CELLS);
    expect(plan[0].gx).toBe(20 - (GARAGE_WIDTH_CELLS - 1) / 2);
    expect(plan[plan.length - 1].gx).toBe(20 + (GARAGE_WIDTH_CELLS - 1) / 2);
  });

  it("n'existe qu'en aluminium, avec un moteur renforcé dans sa recette", () => {
    expect(pieceDef(GARAGE_KIND).material).toBe('aluminium');
    const recipe = itemById('piece_garage_aluminium').recipe;
    expect(recipe?.motor_heavy).toBe(1);
    expect(recipe?.aluminium_plate).toBeGreaterThan(0);
  });

  it("ne coûte qu'un objet pour toute la largeur, et se pose entière ou pas du tout", () => {
    const { s } = stateWithGarage();
    expect(s.inventory.piece_garage_aluminium).toBe(1);
    const group = garageGroup(s.changes.pieces, 'e:0:20,10:x:0');
    expect(group?.keys).toHaveLength(GARAGE_WIDTH_CELLS);
    // Un segment déjà pris : refus de toute la porte, sans consommer d'objet.
    const again = planWall(GARAGE_KIND, 0, 'x', 10, { i: 22, layer: 0 }, { i: 22, layer: 0 });
    expect(
      evaluatePlan(GARAGE_KIND, again, s.changes.pieces, 1, { x: 10, z: 5 }, 12).every(
        (i) => i.status === 'occupied',
      ),
    ).toBe(true);
    expect(s.placeMany(GARAGE_KIND, again)).toBe(0);
    expect(s.inventory.piece_garage_aluminium).toBe(1);
    // Sur un autre mur, avec un seul objet en stock, le patron entier est vert.
    const free = planWall(GARAGE_KIND, 0, 'x', 30, { i: 20, layer: 0 }, { i: 20, layer: 0 });
    const items = evaluatePlan(GARAGE_KIND, free, s.changes.pieces, 1, { x: 10, z: 15 }, 12);
    expect(items.every((i) => i.status === 'ok')).toBe(true);
  });

  it("s'ouvre à la touche en mode manuel, pas en mode automatique", () => {
    const { s, key } = stateWithGarage();
    expect(s.garageAt(key)?.mode).toBe('manual');
    expect(s.toggleDoor(key)).toBe(true);
    for (const k of garageGroup(s.changes.pieces, key)!.keys)
      expect(s.changes.pieces[`o:${k.slice(2, -2)}`]).toBeDefined();
    expect(s.toggleDoor(key)).toBe(false);
    s.setGarage(key, 'auto', 4);
    expect(s.toggleDoor(key)).toBeNull();
  });

  it("en automatique, s'ouvre quand un véhicule est à portée et reste ouverte tant qu'il y est", () => {
    const { s, key } = stateWithGarage();
    s.setGarage(key, 'auto', 2);
    const group = garageGroup(s.changes.pieces, key)!;
    const centerX = ((group.i0 + group.i1 + 1) / 2) * 0.5;
    const z = 10 * 0.5;
    const open = (): boolean => !!s.changes.pieces[`o:0:${group.i0},10:x`];
    s.senseGarages([{ x: centerX, z: z + 6 }]);
    expect(open()).toBe(false);
    s.senseGarages([{ x: centerX, z: z + 1.9 }]);
    expect(open()).toBe(true);
    s.senseGarages([{ x: centerX, z: z + 1.9 }]);
    expect(open()).toBe(true);
    s.senseGarages([{ x: centerX + 30, z }]);
    expect(open()).toBe(false);
    expect(distanceToGarage(group, centerX, z + 3)).toBeCloseTo(3);
  });

  it('se démolit en entier et rend un seul objet ; les réglages survivent à la sauvegarde', () => {
    const { s, key } = stateWithGarage();
    s.setGarage(key, 'auto', 6);
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.garageAt(key)).toMatchObject({ mode: 'auto', range: 6 });
    const c = normalizeChanges({
      pieces: { [key]: GARAGE_KIND },
      garages: { [key]: { mode: 'auto', range: 99 } },
    });
    expect(c.garages[key]).toEqual({ mode: 'auto', range: 2 });
    const before = s.inventory.piece_garage_aluminium ?? 0;
    expect(s.removeKeys([key], { x: 0, z: 0 })).toBe(GARAGE_WIDTH_CELLS);
    expect(s.inventory.piece_garage_aluminium).toBe(before + 1);
    expect(Object.keys(s.changes.garages)).toHaveLength(0);
  });
});
