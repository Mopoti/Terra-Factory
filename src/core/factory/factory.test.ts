import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { machineDef } from '../data/machines';
import { GameState } from '../game/state';
import { MOULD_CYCLES, RECIPES } from '../data/recipes';
import {
  Factory,
  filterPasses,
  chestPut,
  chestRoom,
  emptyMachine,
  footprint,
  normalizeMachines,
  outputCell,
  pickMachine,
  type FactoryWorld,
  type Machine,
  dims,
  tunnelRange,
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

/** Durée (s) d'une recette du fourneau : le délai se règle dans content/recipes.json, pas dans les tests. */
const secs = (id: string): number => RECIPES.find((r) => r.id === id)?.seconds ?? 0;
/** Un cycle complet d'une machine de fabrication : la recette puis la courte pause qui remet la barre à zéro. */
const cycle = (id: string): number => secs(id) + Factory.CYCLE_REST_S;

describe('emprise et sorties', () => {
  it('une foreuse fait 4 x 4 cases, la sortie est au milieu du côté choisi', () => {
    expect(footprint('drill', 0, 0, 0)).toHaveLength(16);
    expect(outputCell('drill', 0, 0, 0)).toEqual({ gx: 2, gz: 4 });
    expect(outputCell('drill', 0, 0, 1)).toEqual({ gx: 4, gz: 2 });
    expect(outputCell('drill', 0, 0, 2)).toEqual({ gx: 2, gz: -1 });
    expect(outputCell('drill', 0, 0, 3)).toEqual({ gx: -1, gz: 2 });
    expect(footprint('furnace', 2, 2, 1)).toHaveLength(9);
    // Un tapis occupe une tuile de 2 x 2 cases.
    expect(footprint('conveyor', 4, 6, 0)).toHaveLength(4);
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
    run(f, 20);
    expect(d.stock).toEqual({ item: 'iron_ore', count: 20 });
    expect(f.oreUnder(d).total).toBe(25);
    expect([...left.values()].reduce((a, b) => a + b, 0)).toBe(25);
    expect(d.fuel).toBeNull();
    expect(f.fuelSecondsLeft(d)).toBeCloseTo(80, 0);
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
    furnace.recipe = 'iron';
    furnace.slots.push({ item: 'coal', count: 10 }); // le réactif de la recette
    const f = new Factory([d, ...belts, furnace], world);
    run(f, 12);
    expect(furnace.slots.some((s) => s.item === 'iron_ore') || furnace.stock !== null).toBe(true);
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
    expect(pos[0] - pos[1]).toBeGreaterThanOrEqual(0.16);
    expect(pos[1] - pos[2]).toBeGreaterThanOrEqual(0.16);
  });
  it("un fourneau cuit le minerai en lingots, et ne prend que ce qu'il sait cuire", () => {
    const { world } = makeWorld();
    const f1 = emptyMachine(1, 'furnace', 0, 0, 0);
    f1.fuel = { item: 'wood', count: 3 };
    f1.recipe = 'copper';
    f1.slots.push({ item: 'copper_ore', count: 2 });
    const f = new Factory([f1], world);
    run(f, secs('copper') + 0.5);
    expect(f1.stock).toEqual({ item: 'copper_ingot', count: 2 });
    expect(f1.slots).toHaveLength(0);
    expect(f.status(f1)).toBe('idle');
    const coal = emptyMachine(2, 'furnace', 5, 5, 0);
    const belt = emptyMachine(3, 'conveyor', 5, 4, 0);
    belt.belt.push({ item: 'stone', pos: 1 });
    const g = new Factory([coal, belt], world);
    run(g, 2);
    expect(coal.slots).toHaveLength(0); // la pierre ne se cuit pas et ne brûle pas : elle reste sur le tapis
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

describe('coffres', () => {
  it("rangent des piles de 100, par type, jusqu'au nombre de cases", () => {
    const c = emptyMachine(1, 'chest_wood', 0, 0, 0);
    expect(chestRoom(c, 'iron_ore')).toBe(1600); // 16 cases
    expect(chestPut(c, 'iron_ore', 250)).toBe(250);
    expect(c.slots).toEqual([
      { item: 'iron_ore', count: 100 },
      { item: 'iron_ore', count: 100 },
      { item: 'iron_ore', count: 50 },
    ]);
    expect(chestPut(c, 'coal', 100)).toBe(100);
    expect(chestRoom(c, 'iron_ore')).toBe(50 + 12 * 100);
    const big = emptyMachine(2, 'chest_iron', 0, 0, 0);
    expect(chestRoom(big, 'coal')).toBe(3200); // 32 cases
    const full = emptyMachine(3, 'chest_wood', 0, 0, 0);
    chestPut(full, 'stone', 1600);
    expect(chestPut(full, 'stone', 5)).toBe(0);
    expect(new Factory([full], makeWorld().world).status(full)).toBe('full');
  });
  it('un tapis dépose dans le coffre qui est devant lui', () => {
    const { world } = makeWorld();
    const belt = emptyMachine(1, 'conveyor', 0, 0, 0);
    const chest = emptyMachine(2, 'chest_wood', 0, 1, 0);
    for (let i = 0; i < 3; i++) belt.belt.push({ item: 'iron_ingot', pos: 0.1 * i });
    const f = new Factory([belt, chest], world);
    run(f, 4);
    expect(chest.slots).toEqual([{ item: 'iron_ingot', count: 3 }]);
    expect(belt.belt).toHaveLength(0);
  });
  it('les coffres sont enregistrés avec leur contenu', () => {
    const c = emptyMachine(5, 'chest_iron', 3, 3, 0);
    chestPut(c, 'wood', 130);
    const back = normalizeMachines(JSON.parse(JSON.stringify([c])));
    expect(back[0].slots).toEqual(c.slots);
  });
});

describe('électricité', () => {
  /** Générateur (2 x 2) en (10, 0), poteau en (8, 1), foreuse électrique sur le minerai en (0, 0). */
  function setup(): {
    f: Factory;
    gen: Machine;
    drill: Machine;
    pole: Machine;
    left: Map<string, number>;
  } {
    const { world, left } = makeWorld(50);
    const gen = emptyMachine(1, 'generator', 10, 0, 0);
    gen.fuel = { item: 'coal', count: 2 };
    const pole = emptyMachine(2, 'pole', 6, 1, 0);
    const drill = emptyMachine(3, 'drill_electric', 0, 0, 0);
    return { f: new Factory([gen, pole, drill], world), gen, drill, pole, left };
  }
  it("les machines à moins de 4 m d'un poteau sont raccordées, les autres non", () => {
    const { f, drill } = setup();
    expect(f.gridInfo(drill)).not.toBeNull();
    const far = emptyMachine(9, 'drill_electric', 40, 40, 0);
    expect(
      new Factory([far, emptyMachine(8, 'pole', 0, 0, 0)], makeWorld().world).gridInfo(far),
    ).toBeNull();
  });
  it('le générateur alimente la foreuse électrique, qui mine plus vite', () => {
    const { f, gen, drill } = setup();
    run(f, 12);
    expect(drill.stock?.count).toBe(48); // 4 minerais / s pendant 12 s
    expect(f.status(drill)).toBe('running');
    const g = f.gridInfo(drill)!;
    expect(g.demandKw).toBe(90);
    expect(g.capacityKw).toBe(300);
    expect(g.satisfaction).toBe(1);
    // Charge de 30 % : le générateur ne brûle que 30 % de ses 900 kW, soit environ 270 kW (3,2 MJ en 12 s).
    const burntKJ = 12 * 0.3 * 900;
    expect(f.fuelSecondsLeft(gen)).toBeGreaterThan((2 * 9000 - burntKJ * 1.1) / 900);
    expect(gen.fuelLeft).toBeLessThan(9000);
  });
  it("sans combustible : plus de courant ; sans poteau : la foreuse est à l'arrêt", () => {
    const { f, gen, drill } = setup();
    gen.fuel = null;
    run(f, 3);
    expect(drill.stock).toBeNull();
    expect(f.status(drill)).toBe('noPower');
    expect(f.status(gen)).toBe('noFuel');
    const alone = emptyMachine(4, 'drill_electric', 0, 0, 0);
    expect(new Factory([alone], makeWorld().world).status(alone)).toBe('noPower');
  });
  it('trop de demande : le courant est partagé et la production ralentit', () => {
    const rich: FactoryWorld = {
      oreAt: () => ({ id: 'iron_ore', item: 'iron_ore', amount: 9999 }),
      mineOre: (_x, _z, n) => n,
    };
    const gen = emptyMachine(1, 'generator', 10, 0, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const pole = emptyMachine(2, 'pole', 6, 1, 0);
    const drills = [
      emptyMachine(3, 'drill_electric', 0, 0, 0),
      emptyMachine(4, 'drill_electric', 0, 3, 0),
      emptyMachine(5, 'drill_electric', 3, 3, 0),
      emptyMachine(6, 'drill_electric', 0, -3, 0),
    ];
    const f = new Factory([gen, pole, ...drills], rich);
    run(f, 1.9); // avant le délai de blackout (surcharge de plus de 10 % : 2 s)
    const g = f.gridInfo(drills[0])!;
    expect(g.demandKw).toBe(360);
    expect(g.capacityKw).toBe(300);
    expect(g.satisfaction).toBeCloseTo(300 / 360, 3);
    // 1,9 s x 4 minerais/s x 5/6 de courant, soit 6 à 7 minerais chacune.
    expect(drills[0].stock!.count).toBeGreaterThanOrEqual(6);
    expect(drills[0].stock!.count).toBeLessThanOrEqual(7);
  });

  it('blackout : surcharge de plus de 10 % pendant 2 s, réamorçage à la manivelle', () => {
    const rich: FactoryWorld = {
      oreAt: () => ({ id: 'iron_ore', item: 'iron_ore', amount: 9999 }),
      mineOre: (_x, _z, n) => n,
    };
    const gen = emptyMachine(1, 'generator', 10, 0, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const pole = emptyMachine(2, 'pole', 6, 1, 0);
    const crank = emptyMachine(7, 'crank', 8, 4, 0);
    const drills = [
      emptyMachine(3, 'drill_electric', 0, 0, 0),
      emptyMachine(4, 'drill_electric', 0, 3, 0),
      emptyMachine(5, 'drill_electric', 3, 3, 0),
      emptyMachine(6, 'drill_electric', 0, -3, 0),
    ];
    const f = new Factory([gen, pole, crank, ...drills], rich);
    run(f, 3);
    const g = f.gridInfo(drills[0])!;
    expect(g.blackout).toBe(true);
    expect(f.status(drills[0])).toBe('noPower');
    expect(f.crank(crank)).toBe('tooMuch'); // la demande dépasse toujours la production
    f.remove(drills[3].id);
    expect(f.crank(crank)).toBe('ok');
    run(f, 3);
    expect(f.gridInfo(drills[0])!.blackout).toBe(false);
    expect(f.status(drills[0])).toBe('running');
  });
});

describe('séparateur et groupeur', () => {
  const setup = (...ms: Machine[]): Factory => {
    return new Factory(ms, makeWorld().world);
  };
  const loaded = (id: number, gx: number, gz: number, rot: number, n: number): Machine => {
    const b = emptyMachine(id, 'conveyor', gx, gz, rot);
    for (let i = 0; i < n; i++) b.belt.push({ item: 'iron_ore', pos: 1 - i * 0.34 });
    return b;
  };

  it('le séparateur répartit sur ses 3 sorties, jamais derrière', () => {
    // Séparateur (2 x 2) en (10,10) tourné vers +z ; entrée par derrière (tuile en (10,8)).
    const src = loaded(1, 10, 8, 0, 3);
    const sp = emptyMachine(2, 'splitter', 10, 10, 0);
    const front = emptyMachine(3, 'chest_wood', 10, 12, 0);
    const left = emptyMachine(4, 'chest_wood', 12, 10, 0);
    const right = emptyMachine(5, 'chest_wood', 8, 10, 0);
    const f = setup(src, sp, front, left, right);
    run(f, 3);
    expect([front, left, right].map((c) => c.slots[0]?.count ?? 0)).toEqual([1, 1, 1]);
    expect(src.belt.length).toBe(0);
  });

  it('le séparateur ne pousse pas dans un tapis qui lui fait face', () => {
    const sp = emptyMachine(2, 'splitter', 10, 10, 0);
    sp.stock = { item: 'iron_ore', count: 1 };
    const facing = emptyMachine(3, 'conveyor', 10, 11, 2);
    const f = setup(sp, facing);
    run(f, 1);
    expect(sp.stock).not.toBeNull();
    expect(facing.belt.length).toBe(0);
  });

  it('le groupeur prend à tour de rôle sur ses 3 entrées', () => {
    const mg = emptyMachine(1, 'merger', 10, 10, 0);
    const back = loaded(2, 10, 9, 0, 3);
    const l = loaded(3, 11, 10, 3, 3);
    const r = loaded(4, 9, 10, 1, 3);
    const out = emptyMachine(5, 'chest_wood', 10, 11, 0);
    const f = setup(mg, back, l, r, out);
    run(f, 0.15);
    expect(out.slots[0]?.count).toBe(3);
    expect([back, l, r].map((b) => b.belt.length)).toEqual([2, 2, 2]);
  });

  it('un groupeur reçoit aussi directement d’une foreuse', () => {
    const mg = emptyMachine(1, 'merger', 3, 1, 1);
    const drill = emptyMachine(2, 'drill', 0, 0, 1);
    drill.fuel = { item: 'coal', count: 5 };
    const out = emptyMachine(3, 'chest_wood', 4, 1, 0);
    const f = setup(mg, drill, out);
    run(f, 4);
    expect(out.slots[0]?.count ?? 0).toBeGreaterThan(0);
  });
});

describe('combustible par tapis', () => {
  it('le générateur prend le combustible par n’importe quelle face', () => {
    const gen = emptyMachine(1, 'generator', 10, 10, 0);
    const a = emptyMachine(2, 'conveyor', 10, 12, 2);
    a.belt.push({ item: 'coal', pos: 1 });
    const b = emptyMachine(3, 'conveyor', 9, 10, 1);
    b.belt.push({ item: 'coal', pos: 1 });
    const f = new Factory([gen, a, b], makeWorld().world);
    run(f, 0.5);
    expect([a.belt.length, b.belt.length, gen.fuel?.count]).toEqual([0, 0, 2]);
  });

  it('un fourneau prend son combustible par les côtés et l’arrière, pas par sa sortie', () => {
    const furnace = emptyMachine(1, 'furnace', 10, 10, 0);
    const back = emptyMachine(2, 'conveyor', 10, 8, 0);
    back.belt.push({ item: 'coal', pos: 1 });
    const side = emptyMachine(3, 'conveyor', 8, 10, 1);
    side.belt.push({ item: 'coal', pos: 1 });
    const front = emptyMachine(4, 'conveyor', 10, 13, 2);
    front.belt.push({ item: 'coal', pos: 1 });
    const f = new Factory([furnace, back, side, front], makeWorld().world);
    run(f, 0.5);
    expect(furnace.fuel?.count).toBe(2);
    expect(front.belt.length).toBe(1);
    back.belt.push({ item: 'stone', pos: 1 });
    run(f, 0.5);
    expect(back.belt.length).toBe(1); // la pierre ne brûle pas
  });
});

describe('bras robotique', () => {
  const chestWith = (id: number, gx: number, gz: number, item: string, n: number): Machine => {
    const c = emptyMachine(id, 'chest_wood', gx, gz, 0);
    c.slots.push({ item, count: n });
    return c;
  };

  it('prend dans le coffre derrière et dépose dans le fourneau devant, au rythme du bras', () => {
    const src = chestWith(1, 10, 9, 'iron_ore', 5);
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuel = { item: 'coal', count: 3 };
    const furnace = emptyMachine(3, 'furnace', 10, 11, 0);
    furnace.recipe = 'iron';
    const f = new Factory([src, arm, furnace], makeWorld().world);
    run(f, 4);
    expect(furnace.slots.find((s) => s.item === 'iron_ore')?.count ?? 0).toBeGreaterThanOrEqual(3);
    expect(src.slots[0]?.count ?? 0).toBeLessThanOrEqual(2);
  });

  it('ne prend rien que la destination refuse', () => {
    const src = chestWith(1, 10, 9, 'stone', 5);
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuel = { item: 'coal', count: 3 };
    const furnace = emptyMachine(3, 'furnace', 10, 11, 0);
    const f = new Factory([src, arm, furnace], makeWorld().world);
    run(f, 3);
    expect(src.slots[0].count).toBe(5);
    expect(arm.stock).toBeNull();
  });

  it('sans combustible il ne bouge pas ; il en reprend un dans un coffre voisin et repart', () => {
    const src = chestWith(1, 10, 9, 'iron_ore', 5);
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    const furnace = emptyMachine(3, 'furnace', 10, 11, 0);
    furnace.recipe = 'iron';
    const f = new Factory([src, arm, furnace], makeWorld().world);
    run(f, 2);
    expect(f.status(arm)).toBe('noFuel');
    expect(furnace.slots).toHaveLength(0);
    // un coffre de charbon sur le côté
    const fuelBox = chestWith(4, 11, 10, 'coal', 4);
    const g = new Factory([src, arm, furnace, fuelBox], makeWorld().world);
    run(g, 3);
    expect(fuelBox.slots[0].count).toBeLessThan(4);
    expect(g.fuelSecondsLeft(arm)).toBeGreaterThan(0);
    expect(furnace.slots.find((s) => s.item === 'iron_ore')?.count ?? 0).toBeGreaterThan(0);
  });

  it('quand il va manquer de combustible il en garde un de ce qu’il transporte', () => {
    const src = chestWith(1, 10, 9, 'coal', 20);
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuelLeft = 100; // 100 kJ à 20 kW : 5 s de combustion restantes
    const target = emptyMachine(3, 'chest_wood', 10, 11, 0);
    const f = new Factory([src, arm, target], makeWorld().world);
    run(f, 1.5);
    expect(arm.fuel?.item).toBe('coal');
    expect(target.slots[0]?.count ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('alimente une foreuse en combustible par sa face arrière', () => {
    const src = chestWith(1, 1, -2, 'coal', 10);
    const arm = emptyMachine(2, 'arm', 1, -1, 0);
    arm.fuel = { item: 'coal', count: 2 };
    const drill = emptyMachine(3, 'drill', 0, 0, 0);
    const f = new Factory([src, arm, drill], makeWorld().world);
    run(f, 3);
    expect(drill.fuel?.count ?? 0).toBeGreaterThan(0);
  });

  it('prend sur ses 3 côtés, à tour de rôle, et dépose devant', () => {
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuel = { item: 'coal', count: 5 };
    const back = chestWith(1, 10, 9, 'iron_ore', 2);
    const left = chestWith(3, 11, 10, 'copper_ore', 2);
    const right = chestWith(4, 9, 10, 'iron_ore', 2);
    const out = emptyMachine(5, 'chest_wood', 10, 11, 0);
    const f = new Factory([arm, back, left, right, out], makeWorld().world);
    run(f, 8);
    const total = out.slots.reduce((n, x) => n + x.count, 0);
    expect(total).toBe(6);
    expect([back, left, right].map((c) => c.slots.length)).toEqual([0, 0, 0]);
  });

  it('prend aussi sur un tapis qui passe sur le côté', () => {
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuel = { item: 'coal', count: 5 };
    const belt = emptyMachine(1, 'conveyor', 11, 10, 0);
    belt.belt.push({ item: 'iron_ore', pos: 0.3 });
    const out = emptyMachine(5, 'chest_wood', 10, 11, 0);
    const f = new Factory([arm, belt, out], makeWorld().world);
    run(f, 2);
    expect(out.slots[0]?.count).toBe(1);
  });

  it('le bras électrique est deux fois plus rapide et ne marche qu’avec du courant', () => {
    const src = chestWith(1, 10, 9, 'iron_ore', 20);
    const arm = emptyMachine(2, 'arm_electric', 10, 10, 0);
    const out = emptyMachine(5, 'chest_wood', 10, 11, 0);
    const f = new Factory([src, arm, out], makeWorld().world);
    run(f, 3);
    expect(f.status(arm)).toBe('noPower');
    expect(out.slots.length).toBe(0);
    const gen = emptyMachine(3, 'generator', 14, 10, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const pole = emptyMachine(4, 'pole', 12, 10, 0);
    const g = new Factory([src, arm, out, gen, pole], makeWorld().world);
    run(g, 4);
    expect(out.slots[0]?.count ?? 0).toBeGreaterThanOrEqual(7);
  });
});

describe('bras et tapis mélangés', () => {
  it('prend dans le tapis l’objet que la destination accepte, même derrière un autre', () => {
    const belt = emptyMachine(1, 'conveyor', 10, 9, 0);
    belt.belt.push({ item: 'stone', pos: 1 }, { item: 'iron_ore', pos: 0.6 });
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuel = { item: 'coal', count: 3 };
    const furnace = emptyMachine(3, 'furnace', 10, 11, 0);
    furnace.recipe = 'iron';
    const f = new Factory([belt, arm, furnace], makeWorld().world);
    expect(f.armDiagnosis(arm)).toBe('ok');
    run(f, 3);
    expect(furnace.slots[0]?.item).toBe('iron_ore');
    expect(belt.belt.map((b) => b.item)).toEqual(['stone']);
    expect(f.armDiagnosis(arm)).toBe('refused');
  });

  it('un bras de côté apporte le charbon au fourneau', () => {
    const chest = emptyMachine(1, 'chest_wood', 8, 10, 0);
    chest.slots.push({ item: 'coal', count: 5 });
    const arm = emptyMachine(2, 'arm', 9, 10, 1);
    arm.fuel = { item: 'coal', count: 3 };
    const furnace = emptyMachine(3, 'furnace', 10, 10, 0);
    const f = new Factory([chest, arm, furnace], makeWorld().world);
    run(f, 3);
    expect(furnace.fuel?.count ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe('assembleur', () => {
  const powered = (asm: Machine, extra: Machine[] = []): Factory => {
    const gen = emptyMachine(90, 'generator', 14, 10, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const pole = emptyMachine(91, 'pole', 12, 10, 0);
    return new Factory([asm, gen, pole, ...extra], makeWorld().world);
  };

  it('fabrique la recette choisie avec courant, ingrédients et place pour le produit', () => {
    const asm = emptyMachine(1, 'assembler', 10, 10, 0);
    asm.recipe = 'machine_conveyor';
    asm.slots.push({ item: 'iron_ingot', count: 6 });
    const out = emptyMachine(2, 'chest_wood', 11, 12, 0);
    const f = powered(asm, [out]);
    run(f, (machineDef('assembler').craftSeconds ?? 2) * 3 + Factory.CYCLE_REST_S * 3 + 0.2);
    expect(out.slots[0]).toEqual({ item: 'machine_conveyor', count: 3 });
    expect(asm.slots).toHaveLength(0);
    expect(f.status(asm)).toBe('idle');
  });

  it('ne travaille pas sans courant ni sans recette, et ne prend que les ingrédients de la recette', () => {
    const asm = emptyMachine(1, 'assembler', 10, 10, 0);
    asm.recipe = 'machine_conveyor';
    asm.slots.push({ item: 'iron_ingot', count: 3 });
    const f = new Factory([asm], makeWorld().world);
    run(f, 5);
    expect(f.status(asm)).toBe('noPower');
    expect(asm.stock).toBeNull();
    const belt = emptyMachine(5, 'conveyor', 9, 10, 1);
    belt.belt.push({ item: 'copper_ingot', pos: 1 });
    const g = powered(asm, [belt]);
    run(g, 1);
    expect(belt.belt).toHaveLength(1); // le cuivre n'est pas un ingrédient
    belt.belt[0].item = 'iron_ingot';
    run(g, 0.5);
    expect(belt.belt).toHaveLength(0);
  });

  it('la recette est enregistrée ; changer de recette rend tout au sac', () => {
    const asm = emptyMachine(1, 'assembler', 3, 3, 1);
    asm.recipe = 'machine_conveyor';
    asm.slots.push({ item: 'iron_ingot', count: 4 });
    const back = normalizeMachines(JSON.parse(JSON.stringify([asm])));
    expect(back[0].recipe).toBe('machine_conveyor');
    expect(back[0].slots).toEqual([{ item: 'iron_ingot', count: 4 }]);
    expect(normalizeMachines([{ ...asm, recipe: 'pas_un_objet' }])[0].recipe).toBeNull();
  });
});

describe('laboratoire', () => {
  const lab = (): Machine => {
    const m = emptyMachine(1, 'lab', 10, 10, 0);
    m.slots.push({ item: 'science_pack', count: 5 });
    return m;
  };
  const power = (m: Machine): Factory => {
    const gen = emptyMachine(90, 'generator', 14, 10, 0);
    gen.fuel = { item: 'coal', count: 5 };
    return new Factory([m, gen, emptyMachine(91, 'pole', 12, 10, 0)], makeWorld().world);
  };

  it('consomme un paquet toutes les 6 s, seulement pour une étude en cours et avec du courant', () => {
    const m = lab();
    const f = power(m);
    f.labDemand = 0;
    run(f, 7);
    expect(m.slots[0]?.count).toBe(5); // rien à étudier
    f.labDemand = 3;
    run(f, 13);
    expect(f.takeLabPacks()).toEqual({ science_pack: 2 });
    expect(m.slots[0]?.count).toBe(3);
    expect(f.takeLabPacks()).toEqual({});
    const g = new Factory([lab()], makeWorld().world);
    g.labDemand = 3;
    run(g, 7);
    expect(g.takeLabPacks()).toEqual({});
    expect(g.status(g.machines[0])).toBe('noPower');
  });

  it('reçoit seulement des paquets de science, par un bras ou un tapis', () => {
    const m = emptyMachine(1, 'lab', 10, 10, 0);
    const belt = emptyMachine(2, 'conveyor', 9, 10, 1);
    belt.belt.push({ item: 'iron_ingot', pos: 1 });
    const f = power(m);
    f.machines.push(belt);
    f.reindex();
    run(f, 0.5);
    expect(belt.belt).toHaveLength(1);
    belt.belt[0].item = 'science_pack';
    run(f, 0.5);
    expect(m.slots[0]?.count).toBe(1);
  });
});

describe('vapeur : pompe, tuyaux, chaudière, turbine', () => {
  const world = (): FactoryWorld => ({ ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 });
  const plant = (
    turbines: number,
    boilerCoal: number,
  ): { f: Factory; ms: Record<string, Machine> } => {
    // Pompe et tuyaux en 2 x 2 le long de +z ; la chaudière 3 x 3 (tournée vers +x) reçoit l'eau par son côté -z
    // et sort la vapeur vers +x, où les turbines 2 x 3 s'alignent.
    const gen = emptyMachine(1, 'generator', 15, 0, 0);
    gen.fuel = { item: 'coal', count: 10 };
    const poles = [4, 12, 20, 28].map((z, i) => emptyMachine(2 + i, 'pole', 13, z, 0));
    const pump = emptyMachine(20, 'pump', 10, -1, 0);
    const p1 = emptyMachine(21, 'pipe', 10, 1, 0);
    const p2 = emptyMachine(22, 'pipe', 10, 3, 0);
    const boiler = emptyMachine(23, 'boiler', 9, 5, 1);
    if (boilerCoal > 0) boiler.fuel = { item: 'coal', count: boilerCoal };
    const p3 = emptyMachine(24, 'pipe', 12, 5, 0, 0, 2);
    const list = [gen, ...poles, pump, p1, p2, boiler, p3];
    const ms: Record<string, Machine> = { pump, boiler, p3 };
    for (let i = 0; i < turbines; i++) {
      const t = emptyMachine(40 + i, 'turbine', 14 + 4 * i, 5, 1);
      ms[`t${i}`] = t;
      list.push(t);
    }
    // De la demande électrique : plusieurs laboratoires alimentés.
    for (let i = 0; i < 3; i++) {
      const lab = emptyMachine(60 + i, 'lab', 16, 8 + 5 * i, 0);
      lab.slots.push({ item: 'science_pack', count: 20 });
      list.push(lab);
    }
    const f = new Factory(list, world());
    f.labDemand = 1000;
    return { f, ms };
  };

  it('une pompe ne se pose qu’au bord de l’eau', () => {
    const f = new Factory([], world());
    // Pompe 2 x 2 tournée vers +z : la ligne côté sortie (z = 0) sur la terre, l'autre (z = -1) dans l'eau.
    expect(f.canPlace('pump', 10, -1, 0, () => false)).toBe(true);
    // tout sur la terre, ou tout dans l'eau : refusé
    expect(f.canPlace('pump', 10, 0, 0, () => false)).toBe(false);
    expect(f.canPlace('pump', 10, -2, 0, () => false)).toBe(false);
    expect(f.canPlace('pump', 10, 5, 0, () => false)).toBe(false);
    // tournée vers -z, la ligne de sortie est celle du bas (z = -1) : dans l'eau, donc refusé ; avec z = 0 sortie vers -z impossible
    expect(f.canPlace('pump', 10, -1, 2, () => false)).toBe(false);
  });

  it('l’eau va de la pompe à la chaudière par les tuyaux, la vapeur de la chaudière à la turbine', () => {
    const { f, ms } = plant(1, 5);
    run(f, 20);
    expect(ms.boiler.fluid.water).toBeGreaterThan(20);
    expect(ms.p3.fluid.steam).toBeGreaterThan(20);
    expect(ms.p3.fluid.water).toBeLessThan(0.5); // un tuyau = un seul fluide
    expect(f.turbineEfficiency(ms.t0)).toBeGreaterThan(0.5);
    expect(f.status(ms.t0)).toBe('running');
    // le réseau électrique compte la turbine
    expect(f.gridInfo(ms.t0)!.capacityKw).toBeGreaterThan(200);
  });

  it('l’eau traverse une chaudière et alimente la suivante ; le charbon n’entre que par l’arrière', () => {
    const pipe = emptyMachine(1, 'pipe', 11, 3, 0);
    pipe.fluid.water = 100;
    const pump = emptyMachine(4, 'pump', 11, -1, 0);
    const lead = emptyMachine(5, 'pipe', 11, 1, 0);
    const b1 = emptyMachine(2, 'boiler', 9, 5, 1);
    const b2 = emptyMachine(3, 'boiler', 9, 8, 1); // côté +z de la première
    const f = new Factory([pump, lead, pipe, b1, b2], world());
    run(f, 20);
    expect(b1.fluid.water).toBeGreaterThan(20);
    expect(b2.fluid.water).toBeGreaterThan(20);
    // rot 1 : derrière = -x. Un tapis venant de -x (direction +x = rot) est accepté, un autre côté non.
    const coal = (dir: number): boolean =>
      (
        f as unknown as { canAccept: (t: Machine, fr: Machine, i: string, d: number) => boolean }
      ).canAccept(b1, pipe, 'coal', dir);
    expect(coal(1)).toBe(true);
    expect(coal(0)).toBe(false);
    expect(coal(2)).toBe(false);
    expect(coal(3)).toBe(false);
  });

  it('sans combustible la chaudière ne produit pas de vapeur : la turbine reste à l’arrêt', () => {
    const { f, ms } = plant(1, 0);
    run(f, 15);
    expect(ms.boiler.fluid.water).toBeGreaterThan(20);
    expect(ms.boiler.fluid.steam).toBe(0);
    expect(f.status(ms.t0)).toBe('noSteam');
    expect(f.status(ms.boiler)).toBe('noFuel');
  });

  it('en file indienne, la pression baisse le long de la file quand la vapeur manque', () => {
    const { f, ms } = plant(6, 20);
    run(f, 40);
    const eff = [0, 1, 2, 3, 4, 5].map((i) => f.turbineEfficiency(ms[`t${i}`]));
    expect(eff[0]).toBeGreaterThanOrEqual(eff[5]);
    expect(eff[0]).toBeGreaterThan(0);
  });
});

describe('tapis et tuyaux à cheval sur une machine', () => {
  it('on peut poser un tapis dont une partie est cachée dans une machine, pas entièrement dedans ni sur un autre tapis', () => {
    const { world } = makeWorld();
    const f = new Factory([emptyMachine(1, 'drill', 0, 0, 0)], world); // foreuse 4 x 4 : cases 0..3
    // tuile 2 x 2 en (3,3) : 1 case dans la foreuse… (3,3) dedans, (4,3), (3,4), (4,4) dehors
    expect(f.canPlace('conveyor', 3, 3, 0, () => false)).toBe(true);
    // entièrement dans la foreuse : refusé (rien de visible)
    expect(f.canPlace('conveyor', 1, 1, 0, () => false)).toBe(false);
    // une machine ne peut pas se poser sur un tapis (même caché en partie)
    f.add(emptyMachine(2, 'conveyor', 3, 3, 0));
    expect(f.canPlace('drill', 3, 3, 0, () => false)).toBe(false);
    // deux tapis ne se chevauchent pas
    expect(f.canPlace('conveyor', 4, 4, 0, () => false)).toBe(false);
    // sur les cases partagées on trouve la machine, sur les cases libres le tapis
    expect(f.machineAt(3, 3)?.type).toBe('drill');
    expect(f.machineAt(4, 4)?.type).toBe('conveyor');
    // les tuyaux suivent la même règle
    expect(f.canPlace('pipe', -1, 1, 0, () => false)).toBe(true);
  });
});

describe('raccords décalés et poteau fin', () => {
  it('un tuyau relié à la chaudière par un côté qui ne fait que se toucher alimente quand même', () => {
    const world = { ...makeWorld().world, waterAt: (_gx: number, gz: number) => gz < 0 };
    const pipe = emptyMachine(1, 'pipe', 11, 3, 0); // touche seulement la case (11,4) du côté arrière
    pipe.fluid.water = 100;
    const pump = emptyMachine(3, 'pump', 11, -1, 0);
    const lead = emptyMachine(4, 'pipe', 11, 1, 0);
    const boiler = emptyMachine(2, 'boiler', 9, 5, 1);
    const f = new Factory([pump, lead, pipe, boiler], world);
    run(f, 3);
    expect(boiler.fluid.water).toBeGreaterThan(20);
  });

  it('un tapis débite dans une machine qui touche son côté de sortie, même décalée', () => {
    const belt = emptyMachine(1, 'conveyor', 10, 8, 0); // sortie : cases (10..11, 10)
    belt.belt.push({ item: 'iron_ore', pos: 1 });
    const chest = emptyMachine(2, 'chest_wood', 11, 10, 0); // ne touche que la case (11,10)
    const f = new Factory([belt, chest], makeWorld().world);
    run(f, 0.5);
    expect(chest.slots[0]?.count).toBe(1);
  });

  it('on ne vise le poteau que près de son mât', () => {
    const pole = emptyMachine(1, 'pole', 0, 0, 0); // emprise (0..1, 0..1), mât au centre (0,5 ; 0,5)
    const f = new Factory([pole], makeWorld().world);
    const down = { x: 0, y: -1, z: 0 };
    expect(pickMachine(f, { x: 0.5, y: 3, z: 0.5 }, down, 5)).not.toBeNull();
    expect(pickMachine(f, { x: 0.1, y: 3, z: 0.1 }, down, 5)).toBeNull();
  });
});

describe('tapis en hauteur et tunnels', () => {
  const belt = (id: number, gx: number, gz: number, rot: number, lift = 0): Machine =>
    emptyMachine(id, 'conveyor', gx, gz, rot, lift);

  it('un pont de tapis passe au-dessus d’un autre tapis et amène ses objets', () => {
    const { world } = makeWorld();
    // Tapis au sol vers +x (rot 1) le long de gz = 10, et un pont vers +z (rot 0) le long de gx = 4.
    const ground = [0, 2, 4, 6, 8].map((x, i) => belt(10 + i, x, 10, 1));
    const bridge = [
      belt(1, 4, 6, 0, 1), // rampe montante
      belt(2, 4, 8, 0, 2),
      belt(3, 4, 10, 0, 2), // au-dessus du tapis au sol
      belt(4, 4, 12, 0, 3), // rampe descendante
      belt(5, 4, 14, 0, 0),
    ];
    const f = new Factory([...ground, ...bridge], world);
    expect(f.canPlace('conveyor', 4, 10, 0, () => false, 2)).toBe(false); // déjà pris en l'air
    const fresh = new Factory(ground, world);
    expect(fresh.canPlace('conveyor', 4, 10, 0, () => false, 2)).toBe(true); // libre en l'air
    expect(fresh.canPlace('conveyor', 4, 10, 0, () => false, 0)).toBe(false); // occupé au sol
    bridge[0].belt.push({ item: 'iron_ore', pos: 0 });
    ground[0].belt.push({ item: 'copper_ore', pos: 0 });
    run(f, 12);
    expect(bridge[4].belt.map((b) => b.item)).toEqual(['iron_ore']);
    expect(ground[4].belt.map((b) => b.item)).toEqual(['copper_ore']);
  });

  it('un tapis au sol ne se raccorde pas à un tapis en l’air sans rampe', () => {
    const { world } = makeWorld();
    const a = belt(1, 4, 4, 0);
    const b = belt(2, 4, 6, 0, 2);
    a.belt.push({ item: 'iron_ore', pos: 0 });
    const f = new Factory([a, b], world);
    run(f, 6);
    expect(b.belt).toHaveLength(0);
    expect(a.belt).toHaveLength(1);
  });

  it('un tunnel relie une entrée à une sortie sans rien entre les deux', () => {
    const { world } = makeWorld();
    const chest = emptyMachine(9, 'chest_wood', 4, 11, 0); // posé au-dessus du tunnel
    const entrance = belt(1, 4, 6, 0, 4);
    const exit = belt(2, 4, 14, 0, 5);
    const after = belt(3, 4, 16, 0, 0);
    entrance.belt.push({ item: 'iron_ore', pos: 0 }, { item: 'copper_ore', pos: 0.3 });
    const f = new Factory([chest, entrance, exit, after], world);
    expect(f.tunnelTarget(entrance)?.id).toBe(2);
    run(f, 2);
    expect(entrance.belt).toHaveLength(0); // avalés
    expect(after.belt).toHaveLength(0); // pas encore ressortis
    run(f, 20);
    expect(after.belt.map((b) => b.item).sort()).toEqual(['copper_ore', 'iron_ore']);
    expect(chest.slots).toHaveLength(0);
  });

  it('une sortie de tunnel ne reçoit rien par derrière et une entrée sans sortie bloque', () => {
    const { world } = makeWorld();
    const feeder = belt(1, 4, 0, 0);
    const exit = belt(2, 4, 2, 0, 5);
    feeder.belt.push({ item: 'iron_ore', pos: 0 });
    const lone = belt(3, 10, 0, 0, 4);
    lone.belt.push({ item: 'iron_ore', pos: 0 });
    const f = new Factory([feeder, exit, lone], world);
    run(f, 6);
    expect(exit.belt).toHaveLength(0);
    expect(lone.belt).toHaveLength(1);
  });

  it('la forme du tapis est enregistrée', () => {
    const m = belt(1, 0, 0, 0, 3);
    const back = normalizeMachines(JSON.parse(JSON.stringify([m])));
    expect(back[0].lift).toBe(3);
    expect(normalizeMachines([{ ...m, lift: 99 }])[0].lift).toBe(0);
  });
});

describe('séparateur posé sur un tapis', () => {
  it('remplace le tapis et la chaîne continue', () => {
    const { world } = makeWorld();
    const belt = (id: number, gz: number): Machine => emptyMachine(id, 'conveyor', 4, gz, 0);
    const parts = [belt(1, 0), belt(2, 2), belt(3, 4), belt(4, 6), belt(5, 8)];
    parts[0].belt.push({ item: 'iron_ore', pos: 0 });
    const end = parts[4];
    const f = new Factory(parts, world);
    expect(f.canPlace('merger', 4, 4, 0, () => false)).toBe(true);
    expect(f.canPlace('chest_wood', 4, 4, 0, () => false)).toBe(false);
    const replaced = f.replacedBelts('merger', 4, 4, 0);
    expect(replaced.map((b) => b.id)).toEqual([3]);
    for (const b of replaced) f.remove(b.id);
    f.add(emptyMachine(9, 'merger', 4, 4, 0));
    run(f, 20);
    expect(end.belt.map((b) => b.item)).toEqual(['iron_ore']);
  });
});

describe('niveau 2 (2 m)', () => {
  const belt = (id: number, gx: number, gz: number, rot: number, lift = 0): Machine =>
    emptyMachine(id, 'conveyor', gx, gz, rot, lift);

  it('un pont de niveau 2 passe au-dessus d’un tapis de niveau 1, et le joueur passe dessous', () => {
    const { world } = makeWorld();
    // Pont niveau 1 vers +x (rot 1) le long de gz = 10 : rampe, 3 tapis à 1 m, rampe descendante.
    const low = [
      belt(1, 0, 10, 1, 1),
      belt(2, 2, 10, 1, 2),
      belt(3, 4, 10, 1, 2),
      belt(4, 6, 10, 1, 2),
      belt(5, 8, 10, 1, 3),
    ];
    // Pont niveau 2 vers +z (rot 0) le long de gx = 4, qui passe au-dessus de (4, 10).
    const high = [
      belt(11, 4, 4, 0, 1),
      belt(12, 4, 6, 0, 6),
      belt(13, 4, 8, 0, 7),
      belt(14, 4, 10, 0, 7),
      belt(15, 4, 12, 0, 8),
      belt(16, 4, 14, 0, 3),
      belt(17, 4, 16, 0, 0),
    ];
    const f = new Factory([...low, ...high], world);
    expect(f.solidAt(4, 10)).toBe(true); // le niveau 1 en dessous bloque
    expect(f.solidAt(4, 8)).toBe(false); // seul le niveau 2 au-dessus : on passe dessous
    expect(f.machineAt(4, 8, 2)?.id).toBe(13);
    high[0].belt.push({ item: 'iron_ore', pos: 0 });
    run(f, 25);
    expect(high[6].belt.map((b) => b.item)).toEqual(['iron_ore']);
  });
});

describe('machines à l’étage', () => {
  it('un tapis de niveau 2 alimente un coffre posé à l’étage, sans toucher au sol', () => {
    const { world } = makeWorld();
    const up = emptyMachine(1, 'conveyor', 4, 4, 0, 7);
    up.belt.push({ item: 'iron_ore', pos: 0.5 });
    const chest = emptyMachine(2, 'chest_wood', 4, 6, 0, 2);
    const groundChest = emptyMachine(3, 'chest_wood', 4, 6, 0); // même place, au sol
    const f = new Factory([up, chest, groundChest], world);
    expect(chest.lift).toBe(2);
    expect(f.machineAt(4, 6, 2)?.id).toBe(2);
    expect(f.machineAt(4, 6)?.id).toBe(3);
    expect(f.canPlace('chest_wood', 4, 6, 0, () => false, 2)).toBe(false); // déjà pris à l'étage
    expect(f.canPlace('chest_wood', 8, 6, 0, () => false, 2)).toBe(true);
    run(f, 5);
    expect(chest.slots[0]?.item).toBe('iron_ore');
    expect(groundChest.slots).toHaveLength(0);
  });
});

describe('tourelle', () => {
  it('reçoit des chargeurs par un tapis et tire balle par balle', () => {
    const { world } = makeWorld();
    const belt = emptyMachine(1, 'conveyor', 4, 2, 0);
    belt.belt.push({ item: 'magazine', pos: 0.5 });
    const side = emptyMachine(3, 'conveyor', 6, 4, 3); // débouche sur le côté de la tourelle
    side.belt.push({ item: 'iron_ore', pos: 0.9 });
    const turret = emptyMachine(2, 'turret', 4, 4, 0);
    const f = new Factory([belt, side, turret], world);
    expect(f.status(turret)).toBe('noAmmo');
    run(f, 10);
    expect(turret.input?.item).toBe('magazine');
    expect(side.belt.map((b) => b.item)).toEqual(['iron_ore']); // le minerai n'est pas accepté
    expect(f.turretReady(turret)).toBe(true);
    for (let i = 0; i < 12; i++) expect(f.turretTake(turret)).toBe(true);
    expect(f.turretTake(turret)).toBe(false);
    expect(turret.input).toBeNull();
  });
});

describe('marcher sur les tapis surélevés', () => {
  it('donne la hauteur du dessus : plat à 1 m, rampe qui monte, et dessous libre à 2,5 m', () => {
    const { world } = makeWorld();
    const ramp = emptyMachine(1, 'conveyor', 0, 0, 1, 1); // vers +x, de 0 à 1,25 m
    const flat = emptyMachine(2, 'conveyor', 2, 0, 1, 2);
    const high = emptyMachine(3, 'conveyor', 4, 0, 1, 7);
    const f = new Factory([ramp, flat, high], world);
    const top = (x: number): number => f.beltSpansAt(x, 0.25)[0]?.top ?? -1;
    expect(top(0.05)).toBeCloseTo(0.12 + 0.05, 1);
    expect(top(0.95)).toBeGreaterThan(top(0.2));
    expect(top(1.5)).toBeCloseTo(1 + 0.12, 2);
    expect(f.beltUnder(1.5, 0.25, 1.15)?.id).toBe(2);
    expect(f.beltUnder(1.5, 0.25, 0)).toBeNull();
    const highSpan = f.beltSpansAt(2.5, 0.25)[0];
    expect(highSpan.bottom).toBeGreaterThan(1.7); // le joueur (1,7 m) passe dessous
  });
});

describe('amorçage de la vapeur sans générateur', () => {
  it('la pompe tourne au ralenti sans courant, ce qui permet de lancer chaudière et turbine', () => {
    const water: FactoryWorld = {
      oreAt: () => null,
      mineOre: () => 0,
      waterAt: (_gx, gz) => gz < 9, // l'eau est au nord (z < 9), la terre au sud
    };
    // Pompe : sortie vers +z (terre), le reste dans l'eau.
    const pump = emptyMachine(1, 'pump', 0, 8, 0);
    const f = new Factory([pump], water);
    run(f, 5);
    expect(pump.fluid.water).toBeGreaterThan(0);
    expect(pump.fluid.water).toBeLessThan(5 * 100 * 0.5); // bien moins vite qu'à pleine puissance
  });
});

describe('emprise de la turbine', () => {
  it('fait 3 cases en largeur et 4 en longueur (tournée de 90°, l’inverse)', () => {
    expect(dims('turbine', 0)).toEqual({ w: 3, d: 4 });
    expect(dims('turbine', 1)).toEqual({ w: 4, d: 3 });
  });
});

describe('tuyaux enterrés (tunnel)', () => {
  const world = (): FactoryWorld => ({ ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 });
  const pipeLine = (): { f: Factory; entrance: Machine; exit: Machine; far: Machine } => {
    // Pompe → tuyau → entrée (z = 4) … 3 tuiles sous terre … sortie (z = 10) → tuyau, le long de +z.
    const pump = emptyMachine(1, 'pump', 10, -1, 0);
    const p1 = emptyMachine(2, 'pipe', 10, 1, 0);
    const entrance = emptyMachine(3, 'pipe', 10, 3, 0, 4);
    const exit = emptyMachine(4, 'pipe', 10, 9, 0, 5);
    const far = emptyMachine(5, 'pipe', 10, 11, 0);
    return { f: new Factory([pump, p1, entrance, exit, far], world()), entrance, exit, far };
  };

  it('seuls les tuyaux ont des formes de tunnel (entrée 4, sortie 5)', () => {
    expect(emptyMachine(1, 'pipe', 0, 0, 0, 4).lift).toBe(4);
    expect(emptyMachine(1, 'pipe', 0, 0, 0, 5).lift).toBe(5);
    expect(emptyMachine(1, 'pipe', 0, 0, 0, 1).lift).toBe(0);
    const f = new Factory([], makeWorld().world);
    expect(f.canPlace('pipe', 0, 0, 0, () => false, 4)).toBe(true);
    expect(f.canPlace('pipe', 0, 0, 0, () => false, 3)).toBe(false);
  });

  it('l’eau traverse le tunnel et on peut construire au-dessus du passage', () => {
    const { f, entrance, exit, far } = pipeLine();
    run(f, 30);
    expect(entrance.fluid.water).toBeGreaterThan(5);
    expect(exit.fluid.water).toBeGreaterThan(5);
    expect(far.fluid.water).toBeGreaterThan(5);
    // Une machine posée sur le trajet souterrain (z = 5..8) n'est pas gênée.
    expect(f.canPlace('chest_wood', 10, 6, 0, () => false)).toBe(true);
  });

  it('sans la sortie, rien ne passe de l’autre côté', () => {
    const { f, exit, far } = pipeLine();
    f.remove(exit.id);
    run(f, 30);
    expect(far.fluid.water).toBeLessThan(0.5);
  });
});

describe('métallurgie T1 : fourneau à recette et estampeuse à moules', () => {
  const stock = (m: Machine, item: string, count: number): void => {
    m.slots.push({ item, count });
  };

  it('le fer demande hématite ET charbon : 2 hématite + 1 charbon → 2 lingots (durée de la recette)', () => {
    const f1 = emptyMachine(1, 'furnace', 0, 0, 0);
    f1.recipe = 'iron';
    f1.fuel = { item: 'wood', count: 5 };
    stock(f1, 'iron_ore', 2);
    const f = new Factory([f1], makeWorld().world);
    run(f, 3);
    expect(f.status(f1)).toBe('idle'); // il manque le charbon
    expect(f1.stock).toBeNull();
    stock(f1, 'coal', 1);
    run(f, secs('iron') + 0.5);
    expect(f1.stock).toEqual({ item: 'iron_ingot', count: 2 });
    expect(f1.slots).toHaveLength(0);
  });

  it('la fonte : 2 hématite + 3 charbon → 2 lingots de fonte (durée de la recette)', () => {
    const f1 = emptyMachine(1, 'furnace', 0, 0, 0);
    f1.recipe = 'cast_iron';
    f1.fuel = { item: 'wood', count: 5 };
    stock(f1, 'iron_ore', 2);
    stock(f1, 'coal', 3);
    const f = new Factory([f1], makeWorld().world);
    run(f, secs('cast_iron') - 0.5);
    expect(f1.stock).toBeNull();
    run(f, 1);
    expect(f1.stock).toEqual({ item: 'cast_iron_ingot', count: 2 });
  });

  it('un fourneau sans recette choisie refuse tout sauf le combustible', () => {
    const belt = emptyMachine(1, 'conveyor', 5, 4, 0);
    belt.belt.push({ item: 'iron_ore', pos: 1 });
    const furnace = emptyMachine(2, 'furnace', 5, 5, 0);
    const f = new Factory([belt, furnace], makeWorld().world);
    run(f, 2);
    expect(furnace.slots).toHaveLength(0);
    expect(belt.belt).toHaveLength(1);
  });

  it('le charbon va d’abord dans les ingrédients, puis (si plein) dans le combustible', () => {
    const furnace = emptyMachine(2, 'furnace', 5, 5, 0);
    furnace.recipe = 'iron';
    const feeder = (): Machine => {
      const b = emptyMachine(1, 'conveyor', 5, 4, 0);
      b.belt.push({ item: 'coal', pos: 1 });
      return b;
    };
    stock(furnace, 'coal', 9); // 10 = plafond de la recette (max(10, 4 × 1))
    const b1 = feeder();
    const f = new Factory([b1, furnace], makeWorld().world);
    run(f, 1);
    expect(furnace.slots.find((s) => s.item === 'coal')?.count).toBe(10);
    const b2 = feeder();
    const g = new Factory([b2, furnace], makeWorld().world);
    run(g, 1);
    expect(furnace.fuel?.item).toBe('coal'); // les ingrédients sont pleins : c'est du combustible
  });

  it('l’estampeuse exige un moule, qui s’use de 1 par cycle et se brise après 8 cycles', () => {
    const st = emptyMachine(1, 'stamper', 0, 0, 0);
    st.recipe = 'iron_plate';
    st.fuel = { item: 'coal', count: 5 };
    stock(st, 'iron_ingot', 30);
    const f = new Factory([st], makeWorld().world);
    run(f, 4);
    expect(f.status(st)).toBe('noMould');
    expect(st.stock).toBeNull();
    st.input = { item: 'mould_plate', count: 2 };
    run(f, secs('iron_plate') + 0.1);
    expect(st.stock).toEqual({ item: 'iron_plate', count: 1 });
    expect(st.wear).toBe(7);
    expect(st.input?.count).toBe(1); // un moule est engagé, un reste en réserve
    // 8 cycles au total avec le premier moule : à la fin du 8ᵉ il est brisé, le second est aussitôt engagé
    run(f, cycle('iron_plate') * 7 + 0.6);
    expect(st.stock?.count).toBe(8);
    expect(st.wear).toBe(0); // le premier moule est brisé ; la machine fait sa pause entre deux cycles
    run(f, Factory.CYCLE_REST_S + 0.2);
    expect(st.wear).toBe(MOULD_CYCLES); // le second moule est engagé au cycle suivant
    expect(st.input).toBeNull(); // plus de moule en réserve : le second est en place
    run(f, secs('iron_plate'));
    expect(st.stock?.count).toBe(9);
    expect(st.wear).toBe(MOULD_CYCLES - 1);
  });

  it('la plaque de cuivre (2 lingots + moule de plaque) est comptée dans les fabrications', () => {
    const st = emptyMachine(1, 'stamper', 0, 0, 0);
    st.recipe = 'copper_plate';
    st.fuel = { item: 'coal', count: 5 };
    st.input = { item: 'mould_plate', count: 1 };
    stock(st, 'copper_ingot', 4);
    const f = new Factory([st], makeWorld().world);
    run(f, cycle('copper_plate') + secs('copper_plate') + 0.2);
    expect(st.stock).toEqual({ item: 'copper_plate', count: 2 });
    expect(f.takeProduced()).toEqual([['copper_plate', 2]]);
    expect(f.takeProduced()).toEqual([]);
  });

  it('le fil de cuivre : 1 lingot → 2 fils', () => {
    const st = emptyMachine(1, 'stamper', 0, 0, 0);
    st.recipe = 'copper_wire';
    st.fuel = { item: 'coal', count: 5 };
    st.input = { item: 'mould_wire', count: 1 };
    stock(st, 'copper_ingot', 4);
    const f = new Factory([st], makeWorld().world);
    run(f, secs('copper_wire') + 0.1);
    expect(st.stock).toEqual({ item: 'copper_wire', count: 2 });
  });

  it('le moule du bon type seulement ; la recette, le moule et l’usure survivent à la sauvegarde', () => {
    const st = emptyMachine(1, 'stamper', 0, 0, 0);
    st.recipe = 'iron_gear';
    const belt = emptyMachine(2, 'conveyor', 0, 0, 0);
    expect(new Factory([st], makeWorld().world).refusal(st, belt, 'mould_plate', 0)).not.toBeNull();
    expect(new Factory([st], makeWorld().world).refusal(st, belt, 'mould_gear', 0)).toBeNull();
    st.wear = 5;
    st.input = { item: 'mould_gear', count: 2 };
    const back = normalizeMachines(JSON.parse(JSON.stringify([st])));
    expect(back[0].recipe).toBe('iron_gear');
    expect(back[0].wear).toBe(5);
    expect(back[0].input).toEqual({ item: 'mould_gear', count: 2 });
    // une recette d'un autre type de machine est ignorée
    const bad = normalizeMachines([{ ...JSON.parse(JSON.stringify(st)), recipe: 'iron' }]);
    expect(bad[0].recipe).toBeNull();
  });
});

describe('roue à aubes (tier 0)', () => {
  const lake = (_gx: number, gz: number): boolean => gz < 0;
  const world = (): FactoryWorld => ({ ...makeWorld().world, waterAt: lake });

  it('se pose à cheval sur la rive : ni sur la terre, ni au milieu de l’eau', () => {
    const f = new Factory([], world());
    // Les cases d'eau comptent comme bloquées pour le reste du jeu, mais pas pour la roue.
    const blocked = (c: { gx: number; gz: number }): boolean => lake(c.gx, c.gz);
    expect(f.canPlace('waterwheel', 10, -1, 0, blocked)).toBe(true); // une rangée d'eau, deux de terre
    expect(f.canPlace('waterwheel', 10, -2, 0, blocked)).toBe(true); // deux rangées d'eau, une de terre
    expect(f.canPlace('waterwheel', 10, 0, 0, blocked)).toBe(false); // sur la terre, même contre l'eau
    expect(f.canPlace('waterwheel', 10, 5, 0, blocked)).toBe(false); // trop loin
    expect(f.canPlace('waterwheel', 10, -4, 0, blocked)).toBe(false); // au milieu de l'eau
    // Un obstacle sur la terre ferme (arbre, rocher) la bloque toujours.
    expect(f.canPlace('waterwheel', 10, -1, 0, (c) => lake(c.gx, c.gz) || c.gz === 1)).toBe(false);
  });

  it('alimente un réseau : une foreuse électrique tourne à 10/90 de sa vitesse', () => {
    const wheel = emptyMachine(1, 'waterwheel', 10, -1, 0);
    const pole = emptyMachine(2, 'pole', 14, 0, 0);
    const lamp = emptyMachine(3, 'lab', 17, 0, 0);
    lamp.slots.push({ item: 'science_pack', count: 5 });
    const f = new Factory([wheel, pole, lamp], world());
    f.labDemand = 5;
    run(f, 1);
    const g = f.gridInfo(lamp)!;
    expect(g.capacityKw).toBe(10);
    expect(g.demandKw).toBe(30);
    expect(g.satisfaction).toBeCloseTo(1 / 3, 5);
  });
});

describe('métallurgie 3b-1 : zinc, concasseur, tuyau de cuivre', () => {
  it('le concasseur broie 1 pierre en 1 pierre écrasée (recette d’office), pierre amenée par tapis', () => {
    const crusher = emptyMachine(2, 'crusher', 5, 5, 0);
    expect(crusher.recipe).toBe('crushed_stone');
    crusher.fuel = { item: 'coal', count: 3 };
    const belt = emptyMachine(1, 'conveyor', 5, 4, 0);
    belt.belt.push({ item: 'stone', pos: 1 });
    const f = new Factory([belt, crusher], makeWorld().world);
    run(f, 3.2);
    expect(crusher.stock).toEqual({ item: 'crushed_stone', count: 1 });
    expect(f.takeProduced()).toEqual([['crushed_stone', 1]]);
  });

  it('le zinc : 2 sphalérite → 2 lingots de zinc, sans charbon', () => {
    const furnace = emptyMachine(1, 'furnace', 0, 0, 0);
    furnace.recipe = 'zinc';
    furnace.fuel = { item: 'wood', count: 5 };
    furnace.slots.push({ item: 'zinc_ore', count: 2 });
    const f = new Factory([furnace], makeWorld().world);
    run(f, secs('zinc') + 0.2);
    expect(furnace.stock).toEqual({ item: 'zinc_ingot', count: 2 });
  });
});

describe('métallurgie 3b-2 : Bessemer (acier + scorie) et bétonnière', () => {
  const powered = (...ms: Machine[]): Factory => {
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const pole = emptyMachine(91, 'pole', 4, 0, 0);
    return new Factory([gen, pole, ...ms], makeWorld().world);
  };

  it('le Bessemer : 2 fonte → 2 acier + 1 scorie en 3 s, électricité exigée', () => {
    const b = emptyMachine(1, 'bessemer', 8, 0, 0);
    expect(b.recipe).toBe('steel'); // recette unique, choisie d'office
    b.slots.push({ item: 'cast_iron_ingot', count: 4 });
    const noCurrent = new Factory([b], makeWorld().world);
    run(noCurrent, 5);
    expect(b.stock).toBeNull();
    expect(noCurrent.status(b)).toBe('noPower');
    const f = powered(b);
    run(f, 3.2);
    expect(b.stock).toEqual({ item: 'steel_ingot', count: 2 });
    expect(b.extra).toEqual({ item: 'slag', count: 1 });
    expect(f.takeProduced().sort()).toEqual([
      ['slag', 1],
      ['steel_ingot', 2],
    ]);
  });

  it('le sous-produit bloque la machine quand sa case est pleine', () => {
    const b = emptyMachine(1, 'bessemer', 8, 0, 0);
    b.slots.push({ item: 'cast_iron_ingot', count: 6 });
    b.extra = { item: 'slag', count: 100 };
    const f = powered(b);
    run(f, 5);
    expect(b.stock).toBeNull();
    expect(f.status(b)).toBe('full');
  });

  it('la scorie et l’acier sortent par la face de sortie, un par un, vers un coffre', () => {
    const b = emptyMachine(1, 'bessemer', 8, 0, 0); // sortie : +z, devant (9, 3)
    b.slots.push({ item: 'cast_iron_ingot', count: 2 });
    const chest = emptyMachine(2, 'chest_wood', 9, 3, 0);
    const f = powered(b, chest);
    run(f, 6);
    const stored = Object.fromEntries(chest.slots.map((s) => [s.item, s.count]));
    expect(stored).toEqual({ steel_ingot: 2, slag: 1 });
    expect(b.stock).toBeNull();
    expect(b.extra).toBeNull();
  });

  it('la bétonnière : 1 pierre écrasée + 1 scorie → 2 blocs de béton', () => {
    const mixer = emptyMachine(1, 'mixer', 8, 0, 0);
    expect(mixer.recipe).toBe('concrete');
    mixer.slots.push({ item: 'crushed_stone', count: 2 }, { item: 'slag', count: 1 });
    const f = powered(mixer);
    run(f, secs('concrete') + 0.2);
    expect(mixer.stock).toEqual({ item: 'concrete_block', count: 2 });
    run(f, cycle('concrete')); // plus de scorie : s'arrête
    expect(mixer.stock?.count).toBe(2);
    expect(f.status(mixer)).toBe('idle');
  });

  it('la remplisseuse met 100 L d’eau dans un baril, la videuse les rend', () => {
    const b = emptyMachine(1, 'barreler', 8, 0, 0);
    b.recipe = 'fill_water_barrel';
    b.slots.push({ item: 'barrel_empty', count: 2 });
    b.fluid.water = 150;
    const f = powered(b);
    run(f, secs('fill_water_barrel') + 0.2);
    expect(b.stock).toEqual({ item: 'barrel_water', count: 1 });
    expect(b.fluid.water).toBeCloseTo(50);
    run(f, cycle('fill_water_barrel')); // il ne reste que 50 L : pas assez pour un second baril
    expect(b.stock?.count).toBe(1);
    expect(f.status(b)).toBe('noWater');
    const d = emptyMachine(2, 'barreler', 8, 4, 0);
    d.recipe = 'drain_water_barrel';
    d.slots.push({ item: 'barrel_water', count: 1 });
    const g = powered(d);
    g.tick(0);
    run(g, secs('drain_water_barrel') + 0.2);
    expect(d.stock).toEqual({ item: 'barrel_empty', count: 1 });
    expect(d.fluid.water).toBeCloseTo(100);
  });

  it('le constructeur fait 2 tuyaux de laiton, la presse lourde 2 tuyaux d’acier', () => {
    const b = emptyMachine(1, 'builder', 8, 0, 0);
    b.recipe = 'brass_pipe';
    b.slots.push({ item: 'copper_ingot', count: 1 }, { item: 'zinc_ingot', count: 1 });
    const f = powered(b);
    run(f, secs('brass_pipe') + 0.2);
    expect(b.stock).toEqual({ item: 'machine_pipe_2', count: 2 });
    const p = emptyMachine(2, 'heavy_press', 8, 4, 0);
    p.recipe = 'steel_pipe';
    p.slots.push({ item: 'steel_ingot', count: 2 });
    const g = powered(p);
    run(g, 3.2);
    expect(p.stock).toEqual({ item: 'machine_pipe_3', count: 2 });
  });

  it('la station de lavage : 2 minerais + 20 L d’eau sous pression → 3 minerais purifiés', () => {
    const w = emptyMachine(1, 'washer', 8, 3, 1);
    w.recipe = 'wash_iron';
    w.slots.push({ item: 'iron_ore', count: 2 });
    const gen = emptyMachine(90, 'generator', 3, 3, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const pole = emptyMachine(91, 'pole', 6, 3, 0);
    const dry = new Factory([w, gen, pole], makeWorld().world);
    run(dry, 3.2);
    expect(dry.status(w)).toBe('noWater');
    expect(w.stock).toBeNull();
    const world: FactoryWorld = { ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 };
    const f = new Factory(
      [w, gen, pole, emptyMachine(2, 'pump', 8, -1, 0), emptyMachine(3, 'pipe', 8, 1, 0)],
      world,
    );
    run(f, 8);
    expect(w.stock).toEqual({ item: 'iron_ore_washed', count: 3 });
  });

  it('un tuyau de laiton remplace un tuyau de cuivre (amélioration sur place)', () => {
    const f = new Factory([emptyMachine(1, 'pipe', 4, 4, 0)], makeWorld().world);
    expect(f.upgradeOf('pipe', 4, 4, 0, 2)?.id).toBe(1);
    expect(f.upgradeOf('pipe', 4, 4, 0, 1)).toBeNull();
    expect(emptyMachine(2, 'pipe', 0, 0, 0, 0, 3).tier).toBe(3);
  });

  it('le sous-produit survit à la sauvegarde', () => {
    const b = emptyMachine(1, 'bessemer', 8, 0, 0);
    b.extra = { item: 'slag', count: 7 };
    const back = normalizeMachines(JSON.parse(JSON.stringify([b])));
    expect(back[0].extra).toEqual({ item: 'slag', count: 7 });
    expect(back[0].recipe).toBe('steel');
  });
});

describe('point 5a : tapis et foreuses par palier', () => {
  const rich: FactoryWorld = {
    oreAt: () => ({ id: 'iron_ore', item: 'iron_ore', amount: 99999 }),
    mineOre: (_x, _z, n) => n,
  };
  const grid = (...ms: Machine[]): Factory => {
    const gen = emptyMachine(90, 'generator', 8, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const pole = emptyMachine(91, 'pole', 4, 3, 0);
    return new Factory([gen, pole, ...ms], rich);
  };

  it('cadences : T1 1/s (combustible), T2 4/s, T3 10/s (et 25 % d’électricité en moins)', () => {
    const t1 = emptyMachine(1, 'drill', 0, 0, 0);
    t1.fuel = { item: 'coal', count: 3 };
    const t2 = emptyMachine(2, 'drill_electric', 0, 5, 0);
    const t3 = emptyMachine(3, 'drill_eco', 5, 5, 0);
    const f = grid(t1, t2, t3);
    run(f, 10);
    expect(t1.stock?.count).toBe(10);
    expect(t2.stock?.count).toBe(40);
    expect(t3.stock?.count).toBe(100);
    expect(machineDef('drill_eco').consumesKw).toBe(
      0.75 * (machineDef('drill_electric').consumesKw ?? 0),
    );
  });

  it('un objet de tapis par palier ; la vitesse double puis redouble', () => {
    expect(machineDef('conveyor').tierItems).toEqual([
      'machine_conveyor',
      'machine_conveyor_2',
      'machine_conveyor_3',
    ]);
    const speeds = [1, 2, 3].map((tier) => {
      const b = emptyMachine(tier, 'conveyor', 0, 0, 0, 0, tier);
      b.belt.push({ item: 'stone', pos: 0 });
      const lone = new Factory([b], makeWorld().world);
      run(lone, 0.2);
      return b.belt[0].pos / 0.2;
    });
    expect(speeds[0]).toBeCloseTo(0.75, 2);
    expect(speeds[1]).toBeCloseTo(1.5, 2);
    expect(speeds[2]).toBeCloseTo(3, 2);
  });

  it('un tapis plus rapide se pose par-dessus un plus lent (même case) mais pas l’inverse', () => {
    const b1 = emptyMachine(1, 'conveyor', 4, 4, 0);
    const f = new Factory([b1], makeWorld().world);
    expect(f.canPlace('conveyor', 4, 4, 0, () => false, 0, 1)).toBe(false);
    expect(f.canPlace('conveyor', 4, 4, 0, () => false, 0, 2)).toBe(true);
    expect(f.upgradeOf('conveyor', 4, 4, 0, 3)).toBe(b1);
    const b3 = emptyMachine(2, 'conveyor', 8, 8, 0, 0, 3);
    const g = new Factory([b3], makeWorld().world);
    expect(g.canPlace('conveyor', 8, 8, 0, () => false, 0, 2)).toBe(false);
  });

  it('le palier est enregistré avec la machine', () => {
    const b = emptyMachine(1, 'conveyor', 0, 0, 0, 0, 3);
    expect(normalizeMachines(JSON.parse(JSON.stringify([b])))[0].tier).toBe(3);
    expect(normalizeMachines([{ ...JSON.parse(JSON.stringify(b)), tier: 9 }])[0].tier).toBe(3);
  });
});

describe('point 5b : bras filtrant et trieur', () => {
  const powerFor = (...ms: Machine[]): Factory => {
    const gen = emptyMachine(90, 'generator', 6, 2, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const pole = emptyMachine(91, 'pole', 11, 6, 0);
    return new Factory([gen, pole, ...ms], makeWorld().world);
  };
  const chestWith = (id: number, gx: number, gz: number, item: string, n: number): Machine => {
    const c = emptyMachine(id, 'chest_wood', gx, gz, 0);
    c.slots.push({ item, count: n });
    return c;
  };

  it('le filtre : liste blanche = seulement les objets cochés ; liste noire = tout sauf eux ; sans filtre tout passe', () => {
    expect(filterPasses(undefined, 'coal')).toBe(true);
    expect(filterPasses({ mode: 'deny', items: [] }, 'coal')).toBe(true);
    expect(filterPasses({ mode: 'deny', items: ['coal'] }, 'coal')).toBe(false);
    expect(filterPasses({ mode: 'deny', items: ['coal'] }, 'wood')).toBe(true);
    expect(filterPasses({ mode: 'allow', items: [] }, 'wood')).toBe(false);
    expect(filterPasses({ mode: 'allow', items: ['wood'] }, 'wood')).toBe(true);
    expect(filterPasses({ mode: 'allow', items: ['wood'] }, 'coal')).toBe(false);
  });

  it('le bras filtrant en liste blanche ne prend que l’objet coché, même derrière un autre', () => {
    const src = emptyMachine(1, 'chest_wood', 10, 8, 0);
    src.slots.push({ item: 'stone', count: 5 }, { item: 'copper_ingot', count: 5 });
    const arm = emptyMachine(2, 'arm_filter', 10, 10, 0);
    arm.filters[0] = { mode: 'allow', items: ['copper_ingot'] };
    const dest = emptyMachine(3, 'chest_wood', 10, 12, 0);
    const f = powerFor(src, arm, dest);
    run(f, 3);
    expect(dest.slots).toEqual([{ item: 'copper_ingot', count: 5 }]);
    expect(src.slots.find((s) => s.item === 'stone')?.count).toBe(5);
    // le cuivre est épuisé : la pierre reste là mais le filtre la refuse, donc rien à prendre
    expect(f.armDiagnosis(arm)).toBe('noSource');
  });

  it('le bras filtrant en liste noire laisse tout passer sauf l’objet coché ; il est 3 fois plus rapide (0,3 s)', () => {
    const src = chestWith(1, 10, 8, 'stone', 6);
    src.slots.push({ item: 'wood', count: 6 });
    const arm = emptyMachine(2, 'arm_filter', 10, 10, 0);
    arm.filters[0] = { mode: 'deny', items: ['stone'] };
    const dest = emptyMachine(3, 'chest_wood', 10, 12, 0);
    const f = powerFor(src, arm, dest);
    run(f, 2.1);
    expect(dest.slots).toEqual([{ item: 'wood', count: 6 }]);
    expect(machineDef('arm_filter').swingSeconds).toBe(0.3);
  });

  it('sans courant le bras filtrant ne bouge pas', () => {
    const src = chestWith(1, 10, 8, 'wood', 3);
    const arm = emptyMachine(2, 'arm_filter', 10, 10, 0);
    const dest = emptyMachine(3, 'chest_wood', 10, 12, 0);
    const f = new Factory([src, arm, dest], makeWorld().world);
    run(f, 3);
    expect(dest.slots).toHaveLength(0);
    expect(f.status(arm)).toBe('noPower');
  });

  it('le trieur envoie chaque objet vers la sortie dont le filtre l’accepte', () => {
    // Trieur 2×2 en (8,8) tourné vers +z : devant (z = 10), gauche (+1 → +x), droite (+3 → −x).
    const sorter = emptyMachine(1, 'sorter', 8, 8, 0);
    sorter.filters[0] = { mode: 'allow', items: ['iron_ingot'] }; // devant
    sorter.filters[1] = { mode: 'allow', items: ['copper_ingot'] }; // gauche
    sorter.filters[2] = { mode: 'deny', items: ['iron_ingot', 'copper_ingot'] }; // droite : le reste
    const front = emptyMachine(2, 'chest_wood', 8, 10, 0);
    const left = emptyMachine(3, 'chest_wood', 10, 8, 0);
    const right = emptyMachine(4, 'chest_wood', 6, 8, 0);
    const feed = emptyMachine(5, 'conveyor', 8, 6, 0);
    for (const item of ['iron_ingot', 'copper_ingot', 'stone', 'iron_ingot', 'wood'])
      feed.belt.push({ item, pos: 1 - feed.belt.length * 0.34 });
    const f = powerFor(feed, sorter, front, left, right);
    run(f, 8);
    const names = (c: Machine): string[] => c.slots.map((s) => `${s.item}×${s.count}`).sort();
    expect(names(front)).toEqual(['iron_ingot×2']);
    expect(names(left)).toEqual(['copper_ingot×1']);
    expect(names(right)).toEqual(['stone×1', 'wood×1']);
  });

  it('le trieur n’aiguille rien sans courant, et un objet que personne n’accepte reste bloqué', () => {
    const sorter = emptyMachine(1, 'sorter', 8, 8, 0);
    sorter.filters[0] = { mode: 'allow', items: ['wood'] };
    sorter.filters[1] = { mode: 'allow', items: ['wood'] };
    sorter.filters[2] = { mode: 'allow', items: ['wood'] };
    const out = emptyMachine(2, 'chest_wood', 8, 10, 0);
    const feed = emptyMachine(5, 'conveyor', 8, 6, 0);
    feed.belt.push({ item: 'stone', pos: 1 });
    const dark = new Factory([feed, sorter, out], makeWorld().world);
    run(dark, 3);
    expect(dark.status(sorter)).toBe('noPower');
    expect(out.slots).toHaveLength(0);
    const f = powerFor(feed, sorter, out);
    run(f, 3);
    expect(sorter.stock?.item).toBe('stone'); // aucune sortie n'accepte la pierre
    expect(out.slots).toHaveLength(0);
  });

  it('les filtres survivent à la sauvegarde ; un type ou un nombre invalide est ignoré', () => {
    const sorter = emptyMachine(1, 'sorter', 8, 8, 0);
    sorter.filters[1] = { mode: 'allow', items: ['coal', 'wood'] };
    const back = normalizeMachines(JSON.parse(JSON.stringify([sorter])));
    expect(back[0].filters).toHaveLength(3);
    expect(back[0].filters[1]).toEqual({ mode: 'allow', items: ['coal', 'wood'] });
    const bad = normalizeMachines([
      { ...JSON.parse(JSON.stringify(sorter)), filters: [5, { mode: 'x', items: [1, 'coal'] }] },
    ]);
    expect(bad[0].filters[0]).toEqual({ mode: 'deny', items: [] });
    expect(bad[0].filters[1]).toEqual({ mode: 'deny', items: ['coal'] });
    expect(emptyMachine(1, 'conveyor', 0, 0, 0).filters).toHaveLength(0);
  });
});

describe('portée des tunnels', () => {
  it('4 / 8 / 16 tuiles selon le niveau du tapis, 4 pour les tuyaux', () => {
    expect([1, 2, 3].map((t) => tunnelRange('conveyor', t))).toEqual([4, 8, 16]);
    expect(tunnelRange('pipe', 3)).toBe(4);
  });
});

describe('pression (Bars) : friction, rupture, surpresseur', () => {
  const world = (): FactoryWorld => ({ ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 });
  /** Pompe (3 bar) puis `n` tuyaux alignés le long de +z, de palier `tier`. */
  const line = (n: number, tier = 1, booster = -1): { f: Factory; pipes: Machine[] } => {
    const list: Machine[] = [emptyMachine(1, 'pump', 10, -1, 0)];
    const pipes: Machine[] = [];
    let z = 1;
    for (let i = 0; i < n; i++) {
      if (i === booster) {
        list.push(emptyMachine(100, 'booster', 10, z, 0));
      } else {
        const p = emptyMachine(2 + i, 'pipe', 10, z, 0, 0, tier);
        pipes.push(p);
        list.push(p);
      }
      z += 2;
    }
    const gen = emptyMachine(90, 'generator', 14, 5, 0);
    gen.fuel = { item: 'coal', count: 10 };
    list.push(gen, emptyMachine(91, 'pole', 12, 4, 0));
    return { f: new Factory(list, world()), pipes };
  };

  it('la pression part de la pompe (3 bar) et baisse de 0,1 bar par tuyau de cuivre', () => {
    const { f, pipes } = line(10);
    run(f, 3);
    expect(pipes[0].pressure).toBeCloseTo(2.9);
    expect(pipes[9].pressure).toBeCloseTo(2.0);
    expect(pipes.every((p) => !p.broken)).toBe(true);
  });

  it('à 0 bar le fluide s’immobilise : trop loin de la pompe, rien n’arrive', () => {
    const { f, pipes } = line(40);
    run(f, 40);
    expect(pipes[35].pressure).toBe(0);
    expect(pipes[35].fluid.water).toBeLessThan(0.5);
    expect(pipes[10].fluid.water).toBeGreaterThan(5);
  });

  it('le laiton perd moins de pression que le cuivre', () => {
    const { f, pipes } = line(10, 2);
    run(f, 3);
    expect(pipes[9].pressure).toBeCloseTo(3 - 0.05 * 10);
  });

  it('un surpresseur alimenté ajoute 2 bar à sa sortie', () => {
    const { f, pipes } = line(6, 1, 2);
    run(f, 3);
    const before = pipes[1].pressure;
    const after = pipes[2].pressure;
    expect(after).toBeGreaterThan(before + 1.5);
  });

  it('un tuyau de cuivre qui reçoit de la vapeur à 8 bar se rompt, pas un tuyau de laiton', () => {
    const copper = emptyMachine(2, 'pipe', 12, 5, 0);
    const brass = emptyMachine(3, 'pipe', 12, 5, 0, 0, 2);
    for (const [pipe, id] of [
      [copper, 1],
      [brass, 4],
    ] as const) {
      const boiler = emptyMachine(id, 'boiler', 9, 5, 1);
      boiler.fluid.steam = 100;
      boiler.fuel = { item: 'coal', count: 5 };
      const f = new Factory([boiler, pipe], world());
      run(f, 1);
      expect(pipe.broken).toBe(pipe === copper);
    }
    expect(new Factory([copper], world()).status(copper)).toBe('broken');
  });

  it('un tuyau rompu est remplacé en posant un tuyau neuf du même palier par-dessus', () => {
    const pipe = emptyMachine(1, 'pipe', 4, 4, 0);
    pipe.broken = true;
    const f = new Factory([pipe], world());
    expect(f.upgradeOf('pipe', 4, 4, 0, 1)?.id).toBe(1);
    pipe.broken = false;
    expect(f.upgradeOf('pipe', 4, 4, 0, 1)).toBeNull();
  });
});

describe('refroidissement (6c)', () => {
  const world = (): FactoryWorld => ({ ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 });
  const plant = (cooled: boolean): { f: Factory; b: Machine; tower: Machine; boiler: Machine } => {
    const b = emptyMachine(1, 'builder', 8, 3, 1); // eau côté -z (pipe en dessous), eau chaude côté +z
    b.recipe = 'brass_pipe';
    b.slots.push({ item: 'copper_ingot', count: 20 }, { item: 'zinc_ingot', count: 20 });
    const gen = emptyMachine(90, 'generator', 3, 3, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const pole = emptyMachine(91, 'pole', 6, 3, 0);
    const tower = emptyMachine(5, 'cooling_tower', 8, 7, 2); // entrée chaude derrière = côté +z du constructeur
    const boiler = emptyMachine(6, 'boiler', 20, 20, 0);
    const list = [b, gen, pole, tower, boiler];
    if (cooled) list.push(emptyMachine(2, 'pump', 8, -1, 0), emptyMachine(3, 'pipe', 8, 1, 0));
    return { f: new Factory(list, world()), b, tower, boiler };
  };

  it('l’eau froide sous pression donne +50 % de vitesse au constructeur et ressort chaude', () => {
    const slow = plant(false);
    const span = cycle('brass_pipe') * 6;
    run(slow.f, span);
    const fast = plant(true);
    run(fast.f, span);
    const count = (m: Machine): number => m.stock?.count ?? 0;
    expect(count(slow.b)).toBeGreaterThanOrEqual(10); // 6 cycles = 12 tuyaux
    expect(count(fast.b)).toBeGreaterThan(count(slow.b));
  });

  it('une tour de refroidissement rend de l’eau froide à partir de l’eau chaude', () => {
    const { f, tower } = plant(true);
    tower.fluid.hot = 100;
    run(f, 3);
    expect(tower.fluid.hot).toBeLessThan(100);
    expect(tower.fluid.water).toBeGreaterThan(0);
  });

  it('une chaudière brûle moitié moins de combustible avec de l’eau chaude', () => {
    const hot = emptyMachine(1, 'boiler', 9, 5, 1);
    hot.fluid.hot = 100;
    hot.fuel = { item: 'coal', count: 20 };
    const cold = emptyMachine(2, 'boiler', 9, 5, 1);
    cold.fluid.water = 100;
    cold.fuel = { item: 'coal', count: 20 };
    const a = new Factory([hot], world());
    const b = new Factory([cold], world());
    run(a, 1);
    run(b, 1);
    expect(hot.fluid.steam).toBeCloseTo(cold.fluid.steam);
    expect(hot.fuelLeft).toBeGreaterThan(cold.fuelLeft);
  });
});

describe('sable et silicium (7a)', () => {
  const sandWorld = (): FactoryWorld => ({
    oreAt: () => ({ id: 'sand', item: 'silica_sand', amount: 500 }),
    mineOre: (_x, _z, n) => n,
  });

  it('la foreuse à combustible ne mine pas le sable, la foreuse électrique oui', () => {
    const t1 = emptyMachine(1, 'drill', 0, 0, 0);
    t1.fuel = { item: 'coal', count: 5 };
    const f1 = new Factory([t1], sandWorld());
    run(f1, 5);
    expect(t1.stock).toBeNull();
    expect(f1.status(t1)).toBe('noOre');
    const gen = emptyMachine(90, 'generator', 10, 0, 0);
    gen.fuel = { item: 'coal', count: 5 };
    const t2 = emptyMachine(2, 'drill_electric', 0, 0, 0);
    const f2 = new Factory([t2, gen, emptyMachine(91, 'pole', 6, 1, 0)], sandWorld());
    run(f2, 3);
    expect(t2.stock?.item).toBe('silica_sand');
  });

  it('le concasseur sur-broie : 2 pierres écrasées → 1 sable siliceux', () => {
    const c = emptyMachine(1, 'crusher', 0, 0, 0);
    c.recipe = 'silica_sand';
    c.slots.push({ item: 'crushed_stone', count: 2 });
    c.fuel = { item: 'coal', count: 5 };
    const f = new Factory([c], makeWorld().world);
    run(f, 4);
    expect(c.stock).toEqual({ item: 'silica_sand', count: 1 });
  });

  it('le four électrique : 4 sable + 1 charbon → 2 silicium brut', () => {
    const e = emptyMachine(1, 'furnace_electric', 8, 0, 0);
    e.recipe = 'silicon';
    e.slots.push({ item: 'silica_sand', count: 4 }, { item: 'coal', count: 1 });
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), e], makeWorld().world);
    run(f, 5);
    expect(e.stock).toEqual({ item: 'silicon_raw', count: 2 });
  });
});

describe('pétrole (7b)', () => {
  const oilWorld = (left: { n: number }): FactoryWorld => ({
    oreAt: () => (left.n > 0 ? { id: 'oil', item: 'crude_oil', amount: left.n } : null),
    mineOre: (_x, _z, n) => {
      const got = Math.min(n, left.n);
      left.n -= got;
      return got;
    },
  });
  const gridFor = (...ms: Machine[]): Machine[] => {
    const gen = emptyMachine(90, 'generator', 20, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    return [gen, emptyMachine(91, 'pole', 16, 0, 0), ...ms];
  };

  it('le chevalet pompe 1 L/s sur un gisement et l’épuise', () => {
    const left = { n: 5 };
    const j = emptyMachine(1, 'pumpjack', 10, 0, 0);
    const f = new Factory(gridFor(j), oilWorld(left));
    run(f, 3.5);
    expect(j.fluid.oil).toBeCloseTo(3, 0);
    run(f, 10);
    expect(j.fluid.oil).toBe(5);
    expect(left.n).toBe(0);
    expect(f.status(j)).toBe('noOre');
  });

  it('les foreuses ne touchent pas au pétrole', () => {
    const d = emptyMachine(1, 'drill_electric', 10, 0, 0);
    const f = new Factory(gridFor(d), oilWorld({ n: 100 }));
    run(f, 3);
    expect(d.stock).toBeNull();
  });

  it('la remplisseuse met 100 L de pétrole dans un baril', () => {
    const b = emptyMachine(1, 'barreler', 8, 0, 0);
    b.recipe = 'fill_oil_barrel';
    b.slots.push({ item: 'barrel_empty', count: 1 });
    b.fluid.oil = 120;
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), b], makeWorld().world);
    run(f, secs('fill_oil_barrel') + 0.2);
    expect(b.stock).toEqual({ item: 'barrel_oil', count: 1 });
    expect(b.fluid.oil).toBeCloseTo(20);
  });
});

describe('raffinerie et plastique (7c)', () => {
  it('la presse à plastique : 20 L de polymère → 4 isolants', () => {
    const p = emptyMachine(1, 'plastic_press', 8, 0, 0);
    expect(p.recipe).toBe('plastic');
    p.fluid.polymer = 45;
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), p], makeWorld().world);
    run(f, 7);
    expect(p.stock).toEqual({ item: 'plastic_insulator', count: 8 });
    expect(p.fluid.polymer).toBeCloseTo(5);
  });

  it('la raffinerie exige 8 bar : chevalet (4) + 2 surpresseurs (+2 chacun)', () => {
    const oil = { n: 5000 };
    const world: FactoryWorld = {
      oreAt: (_x, gz) =>
        gz < 3 && oil.n > 0 ? { id: 'oil', item: 'crude_oil', amount: oil.n } : null,
      mineOre: (_x, _z, n) => {
        oil.n -= n;
        return n;
      },
    };
    const build = (boosters: number): { f: Factory; r: Machine } => {
      const list: Machine[] = [emptyMachine(1, 'pumpjack', 10, 0, 0)];
      let z = 3;
      for (let i = 0; i < boosters; i++, z += 2)
        list.push(emptyMachine(10 + i, 'booster', 10, z, 0));
      const r = emptyMachine(2, 'refinery', 9, z, 1);
      const gen = emptyMachine(90, 'generator', 15, 3, 0);
      gen.fuel = { item: 'coal', count: 20 };
      list.push(r, gen, emptyMachine(91, 'pole', 13, 5, 0));
      return { f: new Factory(list, world), r };
    };
    const weak = build(1);
    run(weak.f, 30);
    expect(weak.r.fluid.polymer).toBe(0);
    expect(weak.f.status(weak.r)).toBe('lowPressure');
    const strong = build(2);
    run(strong.f, 30);
    expect(strong.r.pressure).toBeGreaterThanOrEqual(8);
    expect(strong.r.fluid.polymer).toBeGreaterThan(5);
  });
});

describe('câble isolé, puce et paquet T3 (7d)', () => {
  it('le laboratoire ne consomme que les paquets que l’étude en cours réclame', () => {
    const lab = emptyMachine(1, 'lab', 8, 0, 0);
    lab.slots.push({ item: 'science_pack', count: 3 }, { item: 'science_pack_2', count: 3 });
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), lab], makeWorld().world);
    f.labDemand = 2;
    f.labNeeds = { science_pack_2: 2 };
    run(f, 13);
    expect(f.takeLabPacks()).toEqual({ science_pack_2: 2 });
    expect(lab.slots.map((s) => [s.item, s.count])).toEqual([
      ['science_pack', 3],
      ['science_pack_2', 1],
    ]);
    f.labDemand = 1;
    f.labNeeds = { science_pack_3: 1 };
    expect(f.status(lab)).toBe('wrongPack');
  });

  it('les recettes : 4 fils + 1 isolant → 4 câbles isolés ; puce ; paquet T3', () => {
    expect(itemById('cable_insulated').recipe).toEqual({ copper_wire: 4, plastic_insulator: 1 });
    expect(itemById('cable_insulated').yield).toBe(4);
    expect(itemById('silicon_chip').recipe).toEqual({ silicon_raw: 1, copper_wire: 2 });
    expect(itemById('science_pack_3').recipe).toEqual({ silicon_chip: 1, cable_insulated: 1 });
  });
});

describe('laboratoire à plusieurs emplacements', () => {
  const lab = (): { f: Factory; l: Machine } => {
    const l = emptyMachine(1, 'lab', 8, 0, 0);
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    return { f: new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), l], makeWorld().world), l };
  };

  it('4 emplacements de 20 paquets, de types différents ; les autres objets sont refusés', () => {
    const { l } = lab();
    expect(chestPut(l, 'science_pack', 50)).toBe(50); // 20 + 20 + 10 : trois emplacements
    expect(chestPut(l, 'science_pack_3', 5)).toBe(5); // le quatrième
    expect(chestPut(l, 'iron_ingot', 5)).toBe(0);
    expect(chestPut(l, 'science_pack', 50)).toBe(10); // il ne reste que 10 de place
    expect(chestRoom(l, 'science_pack_3')).toBe(15);
  });

  it('un laboratoire d’une ancienne sauvegarde garde ses paquets', () => {
    const [m] = normalizeMachines([
      { id: 1, type: 'lab', gx: 0, gz: 0, rot: 0, input: { item: 'science_pack', count: 7 } },
    ]);
    expect(m.slots).toEqual([{ item: 'science_pack', count: 7 }]);
    expect(m.input).toBeNull();
  });
});

describe('plaque d’acier et paquet T2', () => {
  it('l’estampeuse fait une plaque d’acier avec le moule de plaque ; le paquet T2 = plaque + tuyau de laiton', () => {
    const st = emptyMachine(1, 'stamper', 8, 0, 0);
    st.recipe = 'steel_plate';
    st.slots.push({ item: 'steel_ingot', count: 1 });
    st.input = { item: 'mould_plate', count: 1 };
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), st], makeWorld().world);
    st.fuel = { item: 'coal', count: 5 };
    run(f, 4);
    expect(st.stock).toEqual({ item: 'steel_plate', count: 1 });
    expect(itemById('science_pack_2').recipe).toEqual({ steel_plate: 1, machine_pipe_2: 1 });
  });
});

describe('tapis abîmé par l’acide', () => {
  it('un tapis abîmé ne transporte plus et se remplace par un neuf du même palier', () => {
    const a = emptyMachine(1, 'conveyor', 0, 0, 1);
    const b = emptyMachine(2, 'conveyor', 2, 0, 1);
    a.belt.push({ item: 'iron_ingot', pos: 0.5 });
    a.broken = true;
    const f = new Factory([a, b], makeWorld().world);
    run(f, 3);
    expect(b.belt).toHaveLength(0);
    expect(a.belt[0].pos).toBe(0.5);
    expect(f.status(a)).toBe('broken');
    expect(f.upgradeOf('conveyor', 0, 0, 0, 1)?.id).toBe(1);
    a.broken = false;
    expect(f.upgradeOf('conveyor', 0, 0, 0, 1)).toBeNull();
  });
});

describe('fission (11a)', () => {
  const water = (): FactoryWorld => ({ ...makeWorld().world, waterAt: (_gx, gz) => gz < 0 });
  /** Pompe (3 bar) + 5 surpresseurs (+2 chacun) = 13 bar, puis le réacteur (eau par son côté -z). */
  const plant = (boosters: number): { f: Factory; r: Machine } => {
    const list: Machine[] = [emptyMachine(1, 'pump', 10, -1, 0)];
    let z = 1;
    for (let i = 0; i < boosters; i++, z += 2) list.push(emptyMachine(10 + i, 'booster', 10, z, 0));
    if (boosters === 0) z = 1;
    const r = emptyMachine(2, 'fission_reactor', 8, z, 1);
    r.input = { item: 'uranium_rod', count: 3 };
    const gen = emptyMachine(90, 'generator', 16, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    list.push(r, gen, emptyMachine(91, 'pole', 13, 4, 0), emptyMachine(92, 'pole', 13, 12, 0));
    return { f: new Factory(list, water()), r };
  };

  it('à 12 bar ou plus, le réacteur produit 10 MW, rejette l’eau contaminée et des déchets', () => {
    const { f, r } = plant(5);
    run(f, 5);
    expect(r.pressure).toBeGreaterThanOrEqual(12);
    expect(f.status(r)).toBe('running');
    expect(f.gridInfo(r)?.capacityKw ?? 0).toBeGreaterThanOrEqual(10000);
    expect(r.fluid.dirty).toBeGreaterThan(50);
    // Sans évacuation l'eau contaminée finit par saturer le réacteur : ici on la vide à la main (11b la traitera).
    for (let i = 0; i < 125; i++) {
      run(f, 1);
      r.fluid.dirty = 0;
    }
    expect(r.broken).toBe(false);
    expect(r.stock).toEqual({ item: 'nuclear_waste', count: 1 });
    expect(r.input?.count).toBe(1);
  });

  it('si l’eau contaminée ne part pas, le réacteur finit par surchauffer', () => {
    const { f, r } = plant(5);
    run(f, 25);
    expect(r.broken).toBe(true);
  });

  it('une barre ne s’allume pas sans eau sous pression ; si l’eau manque en cours de route, il surchauffe puis tombe en panne', () => {
    const idle = plant(1);
    run(idle.f, 10);
    expect(idle.r.progress).toBe(0);
    expect(idle.f.status(idle.r)).toBe('idle');
    const { f, r } = plant(1);
    r.progress = 60; // une barre brûle déjà, mais la pression (5 bar) est trop basse
    run(f, 4);
    expect(f.status(r)).toBe('overheat');
    run(f, 4);
    expect(r.broken).toBe(true);
    expect(f.status(r)).toBe('broken');
    expect(f.gridInfo(r)?.capacityKw ?? 0).toBeLessThan(10000);
  });

  it('la centrifugeuse sépare l’uraninite en uranium enrichi et appauvri', () => {
    const c = emptyMachine(1, 'centrifuge', 8, 0, 0);
    c.recipe = 'enrich_uranium';
    c.slots.push({ item: 'uraninite', count: 4 });
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), c], makeWorld().world);
    run(f, 7);
    expect(c.stock).toEqual({ item: 'uranium_enriched', count: 1 });
    expect(c.extra).toEqual({ item: 'uranium_depleted', count: 3 });
  });
});

describe('déchets (11b)', () => {
  it('la tour d’évaporation vide l’eau contaminée (20 L/s) et signale la vapeur toxique', () => {
    const t = emptyMachine(1, 'evaporation_tower', 0, 0, 0);
    t.fluid.dirty = 100;
    const f = new Factory([t], makeWorld().world);
    expect(f.evaporating(t)).toBe(true);
    expect(f.status(t)).toBe('running');
    run(f, 3);
    expect(t.fluid.dirty).toBeCloseTo(40);
    run(f, 4);
    expect(t.fluid.dirty).toBe(0);
    expect(f.evaporating(t)).toBe(false);
  });

  it('la vitrification : 100 L d’eau contaminée + 4 pierres + 2 isolants → 1 cylindre de verre', () => {
    const v = emptyMachine(1, 'vitrifier', 8, 0, 0);
    v.recipe = 'vitrify';
    v.slots.push({ item: 'stone', count: 4 }, { item: 'plastic_insulator', count: 2 });
    v.fluid.dirty = 150;
    v.pressure = 0;
    const gen = emptyMachine(90, 'generator', 0, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([gen, emptyMachine(91, 'pole', 4, 0, 0), v], makeWorld().world);
    run(f, 9);
    expect(v.stock).toEqual({ item: 'contaminated_glass', count: 1 });
    expect(v.fluid.dirty).toBeCloseTo(50);
  });
});

describe('fusion (11c)', () => {
  const plant = (accumulators: number, fuel = 1): { f: Factory; r: Machine; acc: Machine[] } => {
    const list: Machine[] = [];
    const acc: Machine[] = [];
    for (let i = 0; i < accumulators; i++) {
      const a = emptyMachine(
        10 + i,
        'accumulator',
        20 + (i % 2) * 2,
        14 + Math.floor(i / 2) * 2,
        0,
      );
      a.fuelLeft = 1_000_000; // plein : 1 GJ
      acc.push(a);
      list.push(a);
    }
    const r = emptyMachine(2, 'fusion_reactor', 30, 20, 0);
    r.slots.push(
      { item: 'nuclear_waste', count: fuel },
      { item: 'contaminated_glass', count: fuel },
    );
    list.push(r, emptyMachine(91, 'pole', 27, 21, 0), emptyMachine(92, 'pole', 17, 18, 0));
    return { f: new Factory(list, makeWorld().world), r, acc };
  };

  it('dix accumulateurs pleins amorcent la fusion (500 MW pendant 10 s), puis le plasma produit 500 MW', () => {
    const { f, r, acc } = plant(10);
    run(f, 5);
    expect(f.status(r)).toBe('priming');
    run(f, 7);
    expect(f.status(r)).toBe('plasma');
    expect(f.gridInfo(r)?.capacityKw ?? 0).toBeGreaterThanOrEqual(500000);
    expect(acc.reduce((a, m) => a + m.fuelLeft, 0)).toBeLessThan(10 * 1_000_000 - 4_000_000);
  });

  it('avec trop peu d’accumulateurs, l’amorçage échoue', () => {
    const { f, r } = plant(3);
    run(f, 20);
    expect(f.status(r)).not.toBe('plasma');
  });

  it('sans combustible, le plasma s’effondre ; la réparation remet le réacteur à froid', () => {
    const { f, r } = plant(10);
    run(f, 12);
    expect(f.fusionOn(r)).toBe(true);
    run(f, 75); // un déchet + un cylindre = 30 s, puis plus rien
    expect(r.broken).toBe(true);
    expect(f.status(r)).toBe('broken');
    const s = new GameState({
      inventory: { steel_plate: 100, zamak_ingot: 40, cable_insulated: 40 },
    });
    expect(s.repairReactor(r)).toBe('ok');
    expect(r.broken).toBe(false);
    expect(r.wear).toBe(0);
  });

  it('un accumulateur se charge avec le surplus du réseau', () => {
    const a = emptyMachine(1, 'accumulator', 0, 0, 0);
    const gen = emptyMachine(90, 'generator', 4, 0, 0);
    gen.fuel = { item: 'coal', count: 20 };
    const f = new Factory([a, gen, emptyMachine(91, 'pole', 3, 3, 0)], makeWorld().world);
    run(f, 10);
    expect(a.fuelLeft).toBeGreaterThan(0);
  });
});

describe('balise', () => {
  it('le relais ne lance la séquence que si le plasma brûle et qu’une antenne est raccordée', () => {
    const relay = emptyMachine(1, 'relay', 0, 0, 0);
    const antenna = emptyMachine(2, 'antenna', 6, 0, 0);
    const reactor = emptyMachine(3, 'fusion_reactor', 14, 0, 0);
    reactor.wear = 1;
    const pole = emptyMachine(4, 'pole', 8, 3, 0);
    const f = new Factory([relay, antenna, reactor, pole], makeWorld().world);
    f.tick(0.05);
    const s = new GameState({ inventory: {} });
    reactor.wear = 0;
    expect(s.activateBeacon(f, relay)).toBe('noPlasma');
    reactor.wear = 1;
    f.machines.splice(f.machines.indexOf(antenna), 1);
    expect(s.activateBeacon(f, relay)).toBe('noAntenna');
    f.machines.push(antenna);
    f.reindex();
    f.tick(0.05);
    expect(s.activateBeacon(f, relay)).toBe('ok');
    expect(s.changes.beacon).toBe(true);
    expect(s.activateBeacon(f, relay)).toBe('done');
  });
});
