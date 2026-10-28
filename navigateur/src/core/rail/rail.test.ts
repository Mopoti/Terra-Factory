import { describe, expect, it } from 'vitest';
import { CARS } from '../data/trains';
import {
  TrackGraph,
  flip,
  freePorts,
  lengthOfPiece,
  RAMP_RISE_M,
  TILE_M,
  portsOf,
  poseOn,
  type RailPiece,
} from './track';
import { attach, line } from './testTrack';
import {
  coupleConsists,
  collide,
  consistMass,
  endPos,
  findCoupling,
  splitConsist,
  stepConsist,
  bodyEnd,
  carOffsets,
  carPoses,
  overlapBetween,
  type Car,
  type Consist,
} from './train';

const car = (id: number, kind: Car['kind'], fuel = 0): Car => ({
  id,
  kind,
  rev: false,
  heatKJ: 0,
  fuel: fuel > 0 ? { item: 'coal', count: fuel } : null,
});

/** Un convoi dont la tête est à `u` mètres du port 0 de la tuile `piece` (marche vers le port 1 : vers −z). */
/** Entre les centres d'une locomotive et du wagon attelé derrière elle (m), points d'attelage l'un contre l'autre. */
const LOCO_WAGON_GAP =
  CARS.locomotive_steam.lengthM - CARS.locomotive_steam.frontM + CARS.wagon_freight.frontM;

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
      let id = 10;
      for (const kind of ['curve_l', 'curve_r'] as const) {
        const g = new TrackGraph([...pieces, attach(kind, port.at, id++)]);
        expect(g.neighbour(port.piece, port.port)).not.toBeNull();
      }
    }
    // Un virage de 45° : 6,9 m de voie et un cap qui tourne de 45°.
    const curve: RailPiece = { id: 1, kind: 'curve_l', x: 0, z: 0, h: 0, level: 0 };
    expect(lengthOfPiece(curve)).toBeCloseTo((Math.PI / 4) * 8.75, 3);
    const a = poseOn(curve, 0);
    const b = poseOn(curve, lengthOfPiece(curve));
    let dyaw = b.yaw - a.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    expect(Math.abs(dyaw)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('une rampe monte de 2,5 m et la pièce suivante se pose à la bonne hauteur', () => {
    const ramp: RailPiece = { id: 1, kind: 'ramp', x: 0, z: 0, h: 0, level: 0 };
    const [low, high] = portsOf(ramp);
    expect(high.y - low.y).toBeCloseTo(RAMP_RISE_M);
    const next = attach('straight', high, 2);
    expect(next.level).toBeCloseTo(RAMP_RISE_M);
    expect(poseOn(ramp, lengthOfPiece(ramp)).slope).toBeGreaterThan(0.2);
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
    expect(gap).toBeCloseTo(LOCO_WAGON_GAP, 2);
    // La locomotive regarde vers −z (sens de marche sur cette voie).
    expect(Math.cos(poses[0].yaw)).toBeLessThan(-0.99);
  });
});

describe('véhicules en courbe', () => {
  /** Ligne droite, puis virages (chacun prend le premier ou le second sens possible). */
  const track = (turns: (0 | 1)[]): { g: TrackGraph; last: number } => {
    const pieces = line(14);
    let id = 50;
    for (const t of turns) {
      const end = freePorts(pieces).find((p) => p.piece === (id === 50 ? 14 : id - 1))!;
      pieces.push(attach(t === 0 ? 'curve_l' : 'curve_r', end.at, id));
      id++;
    }
    return { g: new TrackGraph(pieces), last: id - 1 };
  };
  const train = () => [
    car(1, 'locomotive_steam'),
    car(2, 'wagon_freight'),
    car(3, 'wagon_tanker'),
    car(4, 'wagon_freight'),
  ];
  /** Les caisses des véhicules (vues du dessus), dans le sens du convoi. */
  const boxes = (g: TrackGraph, c: Consist) =>
    carPoses(g, c).map((p, i) => {
      const yaw = p.yaw + (c.cars[i].rev ? Math.PI : 0);
      const k = c.cars[i];
      return {
        x: p.x,
        z: p.z,
        ux: Math.sin(yaw),
        uz: Math.cos(yaw),
        lead: bodyEnd(k, 'lead'),
        tail: bodyEnd(k, 'tail'),
      };
    });
  const check = (g: TrackGraph, c: Consist): void => {
    const b = boxes(g, c);
    for (let i = 1; i < b.length; i++) expect(overlapBetween(b[i - 1], b[i])).toBeLessThan(0.01);
  };
  /** Convoi dont la tête est sur `piece` à `u`, la rame derrière elle sur la voie (et pas au-delà du bout). */
  const placed = (g: TrackGraph, cars: Car[], piece: number, u: number): Consist => {
    const dir =
      ([1, -1] as const).find((d) => !g.advance({ piece, u, dir: -d as 1 | -1 }, 30).blocked) ?? 1;
    return { id: 1, head: { piece, u, dir }, v: 0, cars };
  };

  it('les caisses ne se chevauchent pas dans un virage (pas d’effet portefeuille)', () => {
    const { g, last } = track([0]);
    for (const u of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]) check(g, placed(g, train(), last, u));
  });

  it('ni dans un S (virage à droite puis à gauche), ni dans un demi-tour', () => {
    for (const turns of [
      [0, 1],
      [1, 0],
      [0, 0],
      [0, 1, 0],
    ] as (0 | 1)[][]) {
      const { g, last } = track(turns);
      const len = lengthOfPiece(g.byId.get(last)!);
      for (let k = 0; k <= 8; k++) {
        // Tête dans le dernier virage, puis (u négatif) dans le précédent.
        const u = (k / 8) * len;
        check(g, placed(g, train(), last, u));
        check(g, placed(g, train(), last - 1, u));
      }
    }
  });

  it('la distance entre véhicules attelés par leurs attelages automatiques ne change pas en courbe', () => {
    for (const turns of [[0], [0, 0], [0, 1]] as (0 | 1)[][])
      for (const u of [0.5, 2, 3.5, 5]) {
        const { g, last } = track(turns);
        const c = placed(g, train(), last, u);
        const poses = carPoses(g, c);
        const offsets = carOffsets(c);
        c.cars.forEach((k, i) => {
          // Le même véhicule posé seul à sa place nominale : même pose (pas de recul ajouté).
          const back = g.advance(
            { ...c.head, dir: -c.head.dir as 1 | -1 },
            offsets[i] - CARS[k.kind].frontM,
          ).pos;
          const alone = carPoses(g, {
            id: 9,
            head: { ...back, dir: -back.dir as 1 | -1 },
            v: 0,
            cars: [k],
          })[0];
          expect(Math.hypot(alone.x - poses[i].x, alone.z - poses[i].z)).toBeLessThan(1e-6);
        });
      }
  });

  it('une locomotive à l’envers (tampons avant contre le wagon) est écartée juste assez en courbe', () => {
    const { g, last } = track([0, 1, 0]);
    const cars = train();
    cars[0].rev = true;
    for (let k = 0; k <= 12; k++)
      check(g, placed(g, cars, last - (k % 3), (k / 12) * lengthOfPiece(g.byId.get(last)!)));
  });

  it('en ligne droite, les véhicules restent bout à bout, attelage contre attelage', () => {
    const g = new TrackGraph(line(20));
    const c = consist(1, [car(1, 'locomotive_steam'), car(2, 'wagon_freight')], 18, 0.5);
    const [a, b] = carPoses(g, c);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(LOCO_WAGON_GAP, 3);
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
    expect(gap).toBeCloseTo(LOCO_WAGON_GAP, 2);
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
    expect(gap).toBeCloseTo(LOCO_WAGON_GAP, 2);
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
