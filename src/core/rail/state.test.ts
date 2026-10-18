import { describe, expect, it } from 'vitest';
import { carIdOfWindow, locoWindowId } from '../data/trains';
import { emptyMachine } from '../factory/factory';
import { GameState } from '../game/state';
import { planRails } from './plan';
import { TILE_CELLS } from './track';

const free = (): boolean => false;

describe('voies et trains dans la partie', () => {
  const start = (): GameState => {
    const s = new GameState({
      inventory: {
        rail: 200,
        train_locomotive: 1,
        train_wagon_freight: 2,
        coal: 30,
      },
    });
    s.creative = true; // sac sans limite de poids : les véhicules sont lourds
    return s;
  };
  const laidLine = (s: GameState, n: number): void => {
    for (let k = 0; k < n; k++)
      expect(s.placeRail('straight', 0, -TILE_CELLS * k, 0, 0, free)).toBe('ok');
  };

  it('poser une voie consomme l’objet et refuse de recouvrir une autre pièce', () => {
    const s = start();
    expect(s.placeRail('straight', 0, 0, 0, 0, free)).toBe('ok');
    expect(s.inventory.rail).toBe(199);
    expect(s.placeRail('straight', 1, 1, 0, 0, free)).toBe('blocked'); // recouvre une case
    expect(s.placeRail('straight', 40, 0, 0, 0, () => true)).toBe('blocked'); // terrain bloqué
    s.inventory.rail = 2;
    expect(s.placeRail('ramp', 80, 0, 0, 0, free)).toBe('missing'); // une rampe coûte 4 rails
    expect(s.removeRail(s.changes.rails[0].id, { x: 0, z: 0 })).toBe(true);
    expect(s.inventory.rail).toBe(3); // 2 en stock + 1 rendu
  });

  it('on pose une locomotive et des wagons sur la voie, sans qu’ils se chevauchent', () => {
    const s = start();
    laidLine(s, 30);
    const graph = s.railGraph();
    expect(graph.neighbour(s.changes.rails[0].id, 1)).not.toBeNull();
    const loco = s.placeCar('locomotive_steam', { piece: s.changes.rails[20].id, u: 0.5, dir: 1 });
    expect(loco).not.toBeNull();
    expect(
      s.placeCar('wagon_freight', { piece: s.changes.rails[20].id, u: 0.5, dir: 1 }),
    ).toBeNull();
    const wagon = s.placeCar('wagon_freight', { piece: s.changes.rails[10].id, u: 0.5, dir: 1 });
    expect(wagon).not.toBeNull();
    expect(s.inventory.train_wagon_freight).toBe(1);
    expect(s.pickUpCar(wagon!.id)).toBe('ok');
    expect(s.inventory.train_wagon_freight).toBe(2);
  });

  it('une voie sous un convoi ne se démonte pas', () => {
    const s = start();
    laidLine(s, 40);
    const piece = s.changes.rails[10];
    s.placeCar('locomotive_steam', { piece: piece.id, u: 0.5, dir: 1 });
    expect(s.removeRail(piece.id, { x: 0, z: 0 })).toBe(false);
    expect(s.changes.rails).toContain(piece);
    const far = s.changes.rails[s.changes.rails.length - 1];
    expect(s.removeRail(far.id, { x: 0, z: 0 })).toBe(true);
  });

  it('la fenêtre de la locomotive charge la soute jusqu’à 50 pièces', () => {
    const s = start();
    s.creative = true;
    s.inventory.coal = 80;
    const car = { id: 7, kind: 'locomotive_steam', rev: false, heatKJ: 0, fuel: null } as never as {
      fuel: { item: string; count: number } | null;
    };
    const m = emptyMachine(locoWindowId(7), 'chest_wood', 0, 0, 0);
    Object.defineProperty(m, 'fuel', { get: () => car.fuel, set: (x) => (car.fuel = x) });
    expect(carIdOfWindow(m.id)).toBe(7);
    expect(s.loadMachine(m, 'fuel', 'coal', 80)).toBe(50);
    expect(car.fuel).toEqual({ item: 'coal', count: 50 });
    expect(s.loadMachine(m, 'fuel', 'coal', 10)).toBe(0);
    expect(s.loadMachine(m, 'fuel', 'iron_ingot', 1)).toBe(0);
  });

  it('la locomotive se ravitaille depuis le sac, s’attelle à un wagon et se dételle', () => {
    const s = start();
    laidLine(s, 40);
    const loco = s.placeCar('locomotive_steam', { piece: s.changes.rails[10].id, u: 0.5, dir: 1 })!;
    expect(s.refuelLocomotive(loco.cars[0])).toBe(20);
    expect(loco.cars[0].fuel).toEqual({ item: 'coal', count: 20 });
    expect(s.inventory.coal).toBe(10);
    // Un wagon à 1 m de l'arrière de la locomotive : attelage.
    const graph = s.railGraph();
    const rear = graph.advance({ ...loco.head, dir: -1 }, 6.45 + 1.0 + 2.7).pos;
    const wagon = s.placeCar('wagon_freight', { piece: rear.piece, u: rear.u, dir: -1 })!;
    expect(s.coupleTrain(loco.id)).not.toBeNull();
    expect(s.changes.trains).toHaveLength(1);
    const train = s.changes.trains[0];
    expect(train.cars).toHaveLength(2);
    expect(s.pickUpCar(train.id)).toBe('coupled');
    const rest = s.uncoupleTrain(train.id, 1)!;
    expect(s.changes.trains).toHaveLength(2);
    expect(rest.cars.map((c) => c.id)).toContain(wagon.cars[0].id);
  });

  it('un virage ne prend que les cases de son arc : un obstacle dans le coin du bloc ne gêne pas', () => {
    const s = start();
    // Un obstacle au coin du bloc, loin de l'arc (le coin opposé au centre du cercle).
    const corner = { gx: 0, gz: 0 };
    const blocked = (c: { gx: number; gz: number }): boolean =>
      c.gx === corner.gx && c.gz === corner.gz;
    s.inventory.rail = 10;
    expect(s.placeRail('curve', 0, 0, 0, 0, blocked)).toBe('ok');
  });

  it('un tracé avec coins se pose en entier, dans les huit combinaisons de sens', () => {
    const dirs: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const a of dirs)
      for (const b of dirs) {
        if (a[0] * b[0] + a[1] * b[1] !== 0) continue;
        const s = start();
        s.inventory.rail = 500;
        const first = Array.from({ length: 5 }, (_, i) => ({
          tx: 20 + a[0] * i,
          tz: 20 + a[1] * i,
        }));
        const c = first[4];
        const second = Array.from({ length: 5 }, (_, i) => ({
          tx: c.tx + b[0] * (i + 1),
          tz: c.tz + b[1] * (i + 1),
        }));
        const plan = planRails([...first, ...second], { level: 0, tilt: 0, lead: 0 });
        for (const p of plan)
          expect(s.placeRail(p.kind, p.gx, p.gz, p.turns, p.level, free)).toBe('ok');
        expect(s.changes.rails).toHaveLength(plan.length);
      }
  });

  it('l’état se relit sans erreur et ignore ce qui est invalide', () => {
    const s = start();
    laidLine(s, 5);
    s.placeCar('locomotive_steam', { piece: s.changes.rails[2].id, u: 0.5, dir: 1 });
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.rails).toHaveLength(5);
    expect(copy.changes.trains).toHaveLength(1);
    const broken = new GameState({
      changes: {
        rails: [{ id: 1, kind: 'monorail', gx: 0, gz: 0 }],
        trains: [{ id: 1, head: { piece: 9, u: 0 }, cars: [] }],
      },
    });
    expect(broken.changes.rails).toEqual([]);
    expect(broken.changes.trains).toEqual([]);
  });
});
