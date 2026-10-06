import { describe, expect, it } from 'vitest';
import {
  Factory,
  chestPut,
  chestRoom,
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
    belt.belt.push({ item: 'stone', pos: 1 });
    const g = new Factory([coal, belt], world);
    run(g, 2);
    expect(coal.input).toBeNull(); // la pierre ne se cuit pas et ne brûle pas : elle reste sur le tapis
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
    run(f, 6);
    expect(drill.stock?.count).toBe(8); // 1,5 minerai / s pendant 6 s ~ 9, premier minerai au bout de 0,67 s
    expect(f.status(drill)).toBe('running');
    const g = f.gridInfo(drill)!;
    expect(g.demandKw).toBe(90);
    expect(g.capacityKw).toBe(300);
    expect(g.satisfaction).toBe(1);
    // Charge de 30 % : le générateur ne brûle que 0,3 s de combustible par seconde.
    expect(f.fuelSecondsLeft(gen)).toBeGreaterThan(200 - 6 * 0.35);
    expect(gen.fuelLeft).toBeLessThan(100);
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
    run(f, 10);
    const g = f.gridInfo(drills[0])!;
    expect(g.demandKw).toBe(360);
    expect(g.capacityKw).toBe(300);
    expect(g.satisfaction).toBeCloseTo(300 / 360, 3);
    // 10 s x 1,5 minerai/s x 5/6 de courant, soit 12 à 13 minerais chacune.
    expect(drills[0].stock!.count).toBeGreaterThanOrEqual(12);
    expect(drills[0].stock!.count).toBeLessThanOrEqual(13);
    // À pleine charge le générateur brûle 1 s de combustible par seconde.
    expect(gen.fuelLeft).toBeLessThanOrEqual(100 - 9);
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
    // Séparateur en (10,10) tourné vers +z ; entrée par derrière (10,9).
    const src = loaded(1, 10, 9, 0, 3);
    const sp = emptyMachine(2, 'splitter', 10, 10, 0);
    const front = emptyMachine(3, 'chest_wood', 10, 11, 0);
    const left = emptyMachine(4, 'chest_wood', 11, 10, 0);
    const right = emptyMachine(5, 'chest_wood', 9, 10, 0);
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
  it('le générateur ne prend le combustible que par sa face d’entrée', () => {
    // Générateur 2x2 en (10,10), entrée côté +z (rot 0). Tapis en (10,12) qui descend vers -z : bonne face.
    const good = emptyMachine(2, 'conveyor', 10, 12, 2);
    good.belt.push({ item: 'coal', pos: 1 });
    const gen = emptyMachine(1, 'generator', 10, 10, 0);
    const bad = emptyMachine(3, 'conveyor', 9, 10, 1);
    bad.belt.push({ item: 'coal', pos: 1 });
    const f = new Factory([gen, good, bad], makeWorld().world);
    run(f, 0.5);
    expect(gen.fuel).toEqual({ item: 'coal', count: 1 });
    expect(good.belt.length).toBe(0);
    expect(bad.belt.length).toBe(1);
  });

  it('un fourneau ou une foreuse prend son combustible par sa face arrière, pas par les côtés', () => {
    const furnace = emptyMachine(1, 'furnace', 10, 10, 0);
    const back = emptyMachine(2, 'conveyor', 10, 9, 0);
    back.belt.push({ item: 'coal', pos: 1 });
    const side = emptyMachine(3, 'conveyor', 9, 10, 1);
    side.belt.push({ item: 'coal', pos: 1 });
    const stone = emptyMachine(4, 'conveyor', 10, 8, 0);
    const f = new Factory([furnace, back, side, stone], makeWorld().world);
    run(f, 0.5);
    expect(furnace.fuel?.count).toBe(1);
    expect(back.belt.length).toBe(0);
    expect(side.belt.length).toBe(1);
    // une pierre sur la face arrière reste bloquée
    back.belt.push({ item: 'stone', pos: 1 });
    run(f, 0.5);
    expect(back.belt.length).toBe(1);
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
    const f = new Factory([src, arm, furnace], makeWorld().world);
    run(f, 4);
    expect(furnace.input?.count ?? 0).toBeGreaterThanOrEqual(3);
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
    const f = new Factory([src, arm, furnace], makeWorld().world);
    run(f, 2);
    expect(f.status(arm)).toBe('noFuel');
    expect(furnace.input).toBeNull();
    // un coffre de charbon sur le côté
    const fuelBox = chestWith(4, 11, 10, 'coal', 4);
    const g = new Factory([src, arm, furnace, fuelBox], makeWorld().world);
    run(g, 3);
    expect(fuelBox.slots[0].count).toBeLessThan(4);
    expect(g.fuelSecondsLeft(arm)).toBeGreaterThan(0);
    expect(furnace.input?.count ?? 0).toBeGreaterThan(0);
  });

  it('quand il va manquer de combustible il en garde un de ce qu’il transporte', () => {
    const src = chestWith(1, 10, 9, 'coal', 20);
    const arm = emptyMachine(2, 'arm', 10, 10, 0);
    arm.fuelLeft = 5;
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
});
