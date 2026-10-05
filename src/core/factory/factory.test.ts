import { describe, expect, it } from 'vitest';
import {
  Factory,
  emptyMachine,
  footprint,
  normalizeMachines,
  outputCell,
  type FactoryWorld,
  type Machine,
} from './factory';

/** Un petit monde : des cases de minerai de fer sous (0..2, 0..2), 5 minerais chacune. */
function makeWorld(amount = 5): { world: FactoryWorld; left: Map<string, number> } {
  const left = new Map<string, number>();
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) left.set(`${x},${z}`, amount);
  return {
    left,
    world: {
      oreAt: (gx, gz) => {
        const n = left.get(`${gx},${gz}`) ?? 0;
        return n > 0 ? { id: 'iron_ore', item: 'iron_ore', amount: n } : null;
      },
      mineOre: (gx, gz, units) => {
        const k = `${gx},${gz}`;
        const n = Math.min(units, left.get(k) ?? 0);
        left.set(k, (left.get(k) ?? 0) - n);
        return n;
      },
    },
  };
}

const run = (f: Factory, seconds: number): void => {
  for (let i = 0; i < seconds * 20; i++) f.tick(0.05);
};

describe('emprise et sorties', () => {
  it('une foreuse fait 3 x 3 cases, la sortie est au milieu du côté choisi', () => {
    expect(footprint('drill', 0, 0, 0)).toHaveLength(9);
    expect(outputCell('drill', 0, 0, 0)).toEqual({ gx: 1, gz: 3 });
    expect(outputCell('drill', 0, 0, 1)).toEqual({ gx: 3, gz: 1 });
    expect(outputCell('drill', 0, 0, 2)).toEqual({ gx: 1, gz: -1 });
    expect(outputCell('drill', 0, 0, 3)).toEqual({ gx: -1, gz: 1 });
    expect(footprint('furnace', 2, 2, 1)).toHaveLength(4);
  });
  it('on ne pose pas sur une autre machine ni sur un terrain bloqué', () => {
    const { world } = makeWorld();
    const f = new Factory([], world);
    f.add(emptyMachine(1, 'drill', 0, 0, 0));
    expect(f.canPlace('conveyor', 1, 1, 0, () => false)).toBe(false);
    expect(f.canPlace('conveyor', 5, 5, 0, () => false)).toBe(true);
    expect(f.canPlace('conveyor', 5, 5, 0, (c) => c.gx === 5)).toBe(false);
  });
});

describe('foreuse', () => {
  it('sans combustible elle ne fait rien', () => {
    const { world } = makeWorld();
    const d = emptyMachine(1, 'drill', 0, 0, 0);
    const f = new Factory([d], world);
    run(f, 5);
    expect(d.stock).toBeNull();
    expect(f.status(d)).toBe('noFuel');
  });
  it('mine 1 minerai par seconde, brûle du combustible et épuise vraiment les cases', () => {
    const { world, left } = makeWorld();
    const d = emptyMachine(1, 'drill', 0, 0, 0);
    d.fuel = { item: 'coal', count: 1 }; // 100 s
    const f = new Factory([d], world);
    expect(f.oreUnder(d).total).toBe(45);
    run(f, 10);
    expect(d.stock).toEqual({ item: 'iron_ore', count: 10 });
    expect(f.oreUnder(d).total).toBe(35);
    expect([...left.values()].reduce((a, b) => a + b, 0)).toBe(35);
    expect(d.fuel).toBeNull();
    expect(f.fuelSecondsLeft(d)).toBeCloseTo(90, 0);
  });
  it("s'arrête quand le stock est plein ou qu'il n'y a plus de minerai", () => {
    const { world } = makeWorld(1);
    const d = emptyMachine(1, 'drill', 0, 0, 0);
    d.fuel = { item: 'coal', count: 5 };
    const f = new Factory([d], world);
    run(f, 30);
    expect(d.stock?.count).toBe(9); // 9 cases x 1
    expect(f.status(d)).toBe('noOre');
    const full = emptyMachine(2, 'drill', 0, 0, 0);
    full.fuel = { item: 'coal', count: 5 };
    full.stock = { item: 'iron_ore', count: 100 };
    expect(new Factory([full], makeWorld().world).status(full)).toBe('full');
  });
});

describe('tapis et fourneau', () => {
  it("la foreuse envoie son stock sur le tapis qui l'attend, jusqu'au fourneau", () => {
    const { world } = makeWorld();
    const d = emptyMachine(1, 'drill', 0, 0, 0); // sortie en (1, 3)
    d.fuel = { item: 'coal', count: 3 };
    const belts: Machine[] = [
      emptyMachine(2, 'conveyor', 1, 3, 0),
      emptyMachine(3, 'conveyor', 1, 4, 0),
    ];
    const furnace = emptyMachine(4, 'furnace', 1, 5, 0); // emprise (1..2, 5..6), reçoit le tapis (1,4)
    furnace.fuel = { item: 'coal', count: 2 };
    const f = new Factory([d, ...belts, furnace], world);
    run(f, 12);
    expect(furnace.input !== null || furnace.stock !== null).toBe(true);
    run(f, 20);
    expect(furnace.stock?.item).toBe('iron_ingot');
    expect(furnace.stock?.count).toBeGreaterThanOrEqual(3);
  });
  it('un tapis qui débouche sur rien bloque ses objets', () => {
    const { world } = makeWorld();
    const b = emptyMachine(1, 'conveyor', 0, 0, 0);
    b.belt.push({ item: 'iron_ore', pos: 0 });
    const f = new Factory([b], world);
    run(f, 3);
    expect(b.belt).toHaveLength(1);
    expect(b.belt[0].pos).toBe(1);
    expect(f.status(b)).toBe('blocked');
  });
  it("les objets d'un tapis restent espacés", () => {
    const { world } = makeWorld();
    const b = emptyMachine(1, 'conveyor', 0, 0, 0);
    for (let i = 0; i < 3; i++) b.belt.push({ item: 'iron_ore', pos: 0 });
    const f = new Factory([b], world);
    run(f, 3);
    const pos = b.belt.map((x) => x.pos);
    expect(pos[0]).toBe(1);
    expect(pos[0] - pos[1]).toBeGreaterThanOrEqual(0.33);
    expect(pos[1] - pos[2]).toBeGreaterThanOrEqual(0.33);
  });
  it("un fourneau cuit le minerai en lingots, 3 s pièce, et ne prend que ce qu'il sait cuire", () => {
    const { world } = makeWorld();
    const f1 = emptyMachine(1, 'furnace', 0, 0, 0);
    f1.fuel = { item: 'wood', count: 3 };
    f1.input = { item: 'copper_ore', count: 2 };
    const f = new Factory([f1], world);
    run(f, 6.5);
    expect(f1.stock).toEqual({ item: 'copper_ingot', count: 2 });
    expect(f1.input).toBeNull();
    expect(f.status(f1)).toBe('idle');
    const coal = emptyMachine(2, 'furnace', 5, 5, 0);
    const belt = emptyMachine(3, 'conveyor', 5, 4, 0);
    belt.belt.push({ item: 'coal', pos: 1 });
    const g = new Factory([coal, belt], world);
    run(g, 2);
    expect(coal.input).toBeNull(); // le charbon n'est pas cuisible : il reste sur le tapis
    expect(belt.belt).toHaveLength(1);
  });
});

describe('enregistrement', () => {
  it('les machines survivent à la sauvegarde, les données invalides sont ignorées', () => {
    const d = emptyMachine(7, 'drill', 3, -4, 2);
    d.fuel = { item: 'coal', count: 4 };
    d.stock = { item: 'iron_ore', count: 9 };
    const b = emptyMachine(8, 'conveyor', 0, 0, 1);
    b.belt.push({ item: 'iron_ore', pos: 0.5 });
    const back = normalizeMachines(
      JSON.parse(
        JSON.stringify([
          d,
          b,
          { id: 9, type: 'zzz' },
          null,
          { id: 7, type: 'drill', gx: 0, gz: 0, rot: 0 },
        ]),
      ),
    );
    expect(back).toEqual([d, b]);
  });
});
