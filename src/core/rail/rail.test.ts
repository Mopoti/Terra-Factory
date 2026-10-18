import { describe, expect, it } from 'vitest';
import { CARS } from '../data/trains';
import {
  TrackGraph,
  cellsOf,
  flip,
  centerOf,
  cornerFor,
  freePorts,
  lengthOf,
  RAMP_RISE_M,
  TILE_CELLS,
  TILE_M,
  matesFor,
  portsOf,
  poseOn,
  type RailPiece,
} from './track';
import {
  coupleConsists,
  collide,
  consistMass,
  endPos,
  findCoupling,
  splitConsist,
  stepConsist,
  carPoses,
  type Car,
  type Consist,
} from './train';

/** Une voie droite de `n` tuiles de 1 m le long de z (tuile k à gz = −TILE_CELLS·k : on avance vers −z, le port 1). */
const line = (n: number, gx = 0): RailPiece[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    kind: 'straight',
    gx,
    gz: -TILE_CELLS * k,
    turns: 0,
    level: 0,
  }));

const car = (id: number, kind: Car['kind'], fuel = 0): Car => ({
  id,
  kind,
  rev: false,
  heatKJ: 0,
  fuel: fuel > 0 ? { item: 'coal', count: fuel } : null,
});

/** Un convoi dont la tête est à `u` mètres du port 0 de la tuile `piece` (marche vers le port 1 : vers −z). */
const consist = (id: number, cars: Car[], piece: number, u = 0.5): Consist => ({
  id,
  head: { piece, u, dir: 1 },
  v: 0,
  cars,
});

describe('voies : géométrie et raccords', () => {
  it('des tuiles bout à bout se raccordent et le train passe de l’une à l’autre', () => {
    const g = new TrackGraph(line(4));
    expect(g.neighbour(1, 1)).toEqual({ piece: 2, port: 0 });
    expect(g.neighbour(2, 0)).toEqual({ piece: 1, port: 1 });
    expect(g.neighbour(1, 0)).toBeNull();
    const r = g.advance({ piece: 1, u: 0.5, dir: 1 }, TILE_M * 2.2);
    expect(r.blocked).toBe(false);
    expect(r.pos.piece).toBe(3);
    expect(r.pos.u).toBeCloseTo(0.5 + TILE_M * 0.2, 5);
    // En sens inverse, retour à la tuile de départ.
    const back = g.advance({ ...r.pos, dir: -1 }, TILE_M * 2.2);
    expect(back.pos.piece).toBe(1);
    expect(back.pos.u).toBeCloseTo(0.5, 5);
  });

  it('au bout de la voie on s’arrête et on dit ce qui reste', () => {
    const g = new TrackGraph(line(2));
    const r = g.advance({ piece: 1, u: 0, dir: 1 }, 2 * TILE_M + 2);
    expect(r.blocked).toBe(true);
    expect(r.pos.piece).toBe(2);
    expect(r.pos.u).toBeCloseTo(TILE_M);
    expect(r.left).toBeCloseTo(2 + 0, 5);
  });

  it('un virage se raccorde au bout d’une voie droite, quel que soit le côté, et on le parcourt', () => {
    const pieces = line(2);
    for (const port of freePorts(pieces)) {
      const mates = matesFor('curve', port.at);
      expect(mates.length).toBeGreaterThan(0);
      let id = 10;
      for (const m of mates) {
        const g = new TrackGraph([...pieces, { id: id++, kind: 'curve', ...m }]);
        expect(g.neighbour(port.piece, port.port)).not.toBeNull();
      }
    }
    // Longueur d'un quart de cercle de 1,5 m, cap qui tourne de 90°.
    const curve: RailPiece = { id: 1, kind: 'curve', gx: 0, gz: 0, turns: 0, level: 0 };
    expect(lengthOf('curve')).toBeCloseTo((Math.PI / 2) * 3.75, 3);
    const a = poseOn(curve, 0);
    const b = poseOn(curve, lengthOf('curve'));
    let dyaw = b.yaw - a.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    expect(Math.abs(dyaw)).toBeCloseTo(Math.PI / 2, 3);
  });

  it('une rampe monte d’un mètre et la pièce suivante se pose à la bonne hauteur', () => {
    const ramp: RailPiece = { id: 1, kind: 'ramp', gx: 0, gz: 0, turns: 0, level: 0 };
    const [low, high] = portsOf(ramp);
    expect(high.y - low.y).toBeCloseTo(RAMP_RISE_M);
    const next = matesFor('straight', high)[0];
    expect(next.level).toBeCloseTo(RAMP_RISE_M);
    expect(poseOn(ramp, lengthOf('ramp')).slope).toBeGreaterThan(0.2);
  });

  it('emprise : une tuile, un virage de 3 × 3 tuiles, une rampe de 1 × 4 tuiles', () => {
    const s: RailPiece = { id: 1, kind: 'straight', gx: 4, gz: 6, turns: 0, level: 0 };
    expect(cellsOf(s)).toHaveLength(TILE_CELLS ** 2);
    expect(cellsOf({ ...s, kind: 'curve' })).toHaveLength(9 * TILE_CELLS ** 2);
    expect(cellsOf({ ...s, kind: 'ramp' })).toHaveLength(4 * TILE_CELLS ** 2);
    const c = centerOf({ ...s, kind: 'ramp', turns: 1 });
    expect(cornerFor('ramp', 1, c.x, c.z)).toEqual({ gx: 4, gz: 6 });
  });
});

describe('trains : traction, freins, pente', () => {
  const run = (
    g: TrackGraph,
    c: Consist,
    seconds: number,
    ctrl: Parameters<typeof stepConsist>[3],
  ): void => {
    for (let t = 0; t < seconds * 60; t++) stepConsist(g, c, 1 / 60, ctrl);
  };

  it('la locomotive accélère, la vitesse reste bornée, le combustible brûle', () => {
    const g = new TrackGraph(line(120));
    const c = consist(1, [car(1, 'locomotive_steam', 5), car(2, 'wagon_freight')], 1, 0.5);
    run(g, c, 15, { throttle: 1, brake: 0, parked: false });
    expect(c.v).toBeGreaterThan(3);
    expect(c.v).toBeLessThanOrEqual(CARS.locomotive_steam.loco!.vMax + 0.5);
    expect(c.cars[0].fuel!.count).toBeLessThan(5);
    expect(c.head.piece).toBeGreaterThan(1);
  });

  it('plus de combustible, plus de traction ; le convoi lancé ralentit tout seul', () => {
    const g = new TrackGraph(line(200));
    const c = consist(1, [car(1, 'locomotive_steam', 0), car(2, 'wagon_freight')], 1, 0.5);
    run(g, c, 5, { throttle: 1, brake: 0, parked: false });
    expect(c.v).toBe(0);
    c.v = 8;
    run(g, c, 10, { throttle: 0, brake: 0, parked: false });
    expect(c.v).toBeLessThan(8);
    expect(c.v).toBeGreaterThan(0);
  });

  it('le frein arrête le convoi ; garé, il tient sur place', () => {
    const g = new TrackGraph(line(200));
    const c = consist(1, [car(1, 'locomotive_steam', 5), car(2, 'wagon_freight')], 1, 0.5);
    c.v = 8;
    run(g, c, 3, { throttle: 0, brake: 1, parked: false });
    expect(c.v).toBeLessThan(5);
    run(g, c, 10, { throttle: 0, brake: 1, parked: false });
    expect(c.v).toBe(0);
    const at = c.head.u + c.head.piece;
    run(g, c, 5, { throttle: 0, brake: 1, parked: true });
    expect(c.head.u + c.head.piece).toBe(at);
  });

  it('une rame plus lourde accélère moins vite', () => {
    const g = new TrackGraph(line(300));
    const light = consist(1, [car(1, 'locomotive_steam', 20)], 1, 0.5);
    const heavy = consist(
      2,
      [car(2, 'locomotive_steam', 20), ...[3, 4, 5, 6].map((i) => car(i, 'wagon_freight'))],
      1,
      0.5,
    );
    run(g, light, 6, { throttle: 1, brake: 0, parked: false });
    run(g, heavy, 6, { throttle: 1, brake: 0, parked: false });
    expect(heavy.v).toBeLessThan(light.v);
  });

  it('en marche arrière la locomotive recule', () => {
    const g = new TrackGraph(line(60));
    const c = consist(1, [car(1, 'locomotive_steam', 5)], 30, 0.5);
    run(g, c, 6, { throttle: -1, brake: 0, parked: false });
    expect(c.v).toBeLessThan(-1);
    expect(c.head.piece).toBeLessThan(30);
  });

  it('au bout de la voie le convoi s’arrête (butoir)', () => {
    const g = new TrackGraph(line(6));
    const c = consist(1, [car(1, 'locomotive_steam', 5)], 1, 0.5);
    run(g, c, 25, { throttle: 1, brake: 0, parked: false });
    expect(c.head.piece).toBe(6);
    expect(Math.abs(c.v)).toBeLessThan(1);
  });

  it('les véhicules sont placés bout à bout derrière la tête', () => {
    const g = new TrackGraph(line(20));
    const c = consist(1, [car(1, 'locomotive_steam'), car(2, 'wagon_freight')], 18, 0.5);
    const poses = carPoses(g, c);
    const gap = Math.hypot(poses[0].x - poses[1].x, poses[0].z - poses[1].z);
    expect(gap).toBeCloseTo((CARS.locomotive_steam.lengthM + CARS.wagon_freight.lengthM) / 2, 2);
    // La locomotive regarde vers −z (sens de marche sur cette voie).
    expect(Math.cos(poses[0].yaw)).toBeLessThan(-0.99);
  });
});

describe('attelage, dételage, chocs', () => {
  const setup = (): { g: TrackGraph; loco: Consist; wagon: Consist } => {
    const g = new TrackGraph(line(40));
    // Locomotive à la tuile 30 (tête vers −z), wagon plus loin devant, sur la même voie.
    const loco = consist(1, [car(1, 'locomotive_steam', 5)], 30, 0.5);
    const wagon = consist(2, [car(2, 'wagon_freight')], 18, 0.5);
    return { g, loco, wagon };
  };

  it('la locomotive qui avance vers un wagon l’attelle par l’avant : un seul convoi, mouvement conservé', () => {
    const { g, loco, wagon } = setup();
    // L'arrière du wagon est vers +z ; la tête de la locomotive (qui regarde vers −z) en est à 1 m.
    const wagonRear = endPos(g, wagon, 'rear');
    const start = g.advance(wagonRear, 1.0).pos;
    loco.head = flip(start);
    const found = findCoupling(g, [loco, wagon], loco);
    expect(found).not.toBeNull();
    expect(found).toMatchObject({ mine: 'front', theirs: 'rear' });
    expect(found!.gap).toBeCloseTo(1, 1);
    loco.v = 0.5;
    const before = consistMass(loco) * loco.v;
    const merged = coupleConsists(g, loco, found!.mine, wagon, found!.theirs);
    // La locomotive est derrière le wagon : le convoi regarde maintenant vers +z et la locomotive est en tête (à l'envers).
    expect(merged.cars.map((k) => k.id)).toEqual([1, 2]);
    expect(merged.cars[0].rev).toBe(true);
    expect(consistMass(merged) * Math.abs(merged.v)).toBeCloseTo(before, 3);
  });

  it('on recule avec la locomotive vers un wagon : attelage par l’arrière, locomotive en tête', () => {
    const { g, loco, wagon } = setup();
    // La locomotive est devant le wagon (vers −z) ; son arrière est à 1 m de l'avant du wagon.
    const start = g.advance(wagon.head, 1.0 + CARS.locomotive_steam.lengthM).pos;
    loco.head = start;
    const found = findCoupling(g, [loco, wagon], loco);
    expect(found).toMatchObject({ mine: 'rear', theirs: 'front' });
    const merged = coupleConsists(g, loco, found!.mine, wagon, found!.theirs);
    // La locomotive reste en tête du convoi et tire le wagon.
    expect(merged.cars.map((k) => k.id)).toEqual([1, 2]);
    expect(merged.cars[0].rev).toBe(false);
    const poses = carPoses(g, merged);
    const gap = Math.hypot(poses[0].x - poses[1].x, poses[0].z - poses[1].z);
    expect(gap).toBeCloseTo((CARS.locomotive_steam.lengthM + CARS.wagon_freight.lengthM) / 2, 2);
  });

  it('trop loin, pas d’attelage', () => {
    const { g, loco, wagon } = setup();
    expect(findCoupling(g, [loco, wagon], loco)).toBeNull();
  });

  it('dételer sépare la rame au bon endroit', () => {
    const g = new TrackGraph(line(40));
    const c = consist(
      1,
      [car(1, 'locomotive_steam'), car(2, 'wagon_freight'), car(3, 'wagon_tanker')],
      30,
      0.5,
    );
    c.v = 2;
    const rear = splitConsist(g, c, 1, 9)!;
    expect(c.cars.map((k) => k.id)).toEqual([1]);
    expect(rear.cars.map((k) => k.id)).toEqual([2, 3]);
    expect(rear.v).toBe(2);
    // L'arrière commence juste derrière la locomotive.
    const poses = carPoses(g, rear);
    const loco = carPoses(g, c)[0];
    const gap = Math.hypot(poses[0].x - loco.x, poses[0].z - loco.z);
    expect(gap).toBeCloseTo((CARS.locomotive_steam.lengthM + CARS.wagon_freight.lengthM) / 2, 2);
  });

  it('un choc entre convois non attelés transmet la vitesse sans les traverser', () => {
    const g = new TrackGraph(line(40));
    // Un convoi qui roule vers −z et un wagon à l'arrêt devant lui, tête contre arrière.
    const wagon = consist(2, [car(2, 'wagon_freight')], 10, 0.5);
    const rearWagon = g.advance({ ...wagon.head, dir: -1 }, CARS.wagon_freight.lengthM).pos; // vers +z
    const loco = consist(1, [car(1, 'locomotive_steam')], 20, 0.5);
    loco.head = { piece: rearWagon.piece, u: rearWagon.u, dir: 1 }; // tête de la loco = arrière du wagon
    loco.v = 3;
    collide(g, [loco, wagon]);
    expect(wagon.v).toBeGreaterThan(0.5);
    expect(loco.v).toBeLessThan(3);
    expect(loco.v).toBeLessThan(wagon.v);
  });
});
