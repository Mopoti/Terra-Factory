import { describe, expect, it } from 'vitest';
import { GameState } from '../game/state';
import { normalizeChanges } from '../game/worldChanges';
import { AUTO_SPEED, autoControl, findRoute } from './route';
import { TILE_CELLS, lengthOfPiece, matesFor, poseOn, portsOf } from './track';
import { carPoses, stepConsist } from './train';

const free = (): boolean => false;

/** Ligne de 12 tuiles vers −z, avec un virage large posé tangent au joint des tuiles 2 et 3 (embranchement). */
function network(): { s: GameState; curveId: number; lineIds: number[] } {
  const s = new GameState({
    inventory: { rail: 200, train_locomotive: 1, train_wagon_freight: 2, coal: 30 },
  });
  s.creative = true;
  for (let k = 0; k < 12; k++) s.placeRail('straight', 0, -TILE_CELLS * k, 0, 0, free);
  const lineIds = s.changes.rails.map((p) => p.id);
  const joint = portsOf(s.changes.rails[2]).find((p) => p.dz === -1)!;
  for (const m of matesFor('curve_wide', joint))
    if (s.placeRail('curve_wide', m.gx, m.gz, m.turns, m.level, free, true) === 'ok') break;
  const curve = s.changes.rails[s.changes.rails.length - 1];
  return { s, curveId: curve.id, lineIds };
}

describe('itinéraires', () => {
  it('tout droit sur la même pièce', () => {
    const { s, lineIds } = network();
    const g = s.railGraph();
    const r = findRoute(g, { piece: lineIds[0], u: 0.5, dir: 1 }, { piece: lineIds[0], u: 2 })!;
    expect(r.distance).toBeCloseTo(1.5);
    expect(r.decisions).toHaveLength(0);
  });

  it('jusqu’à la voie qui tourne : le choix de l’embranchement est noté', () => {
    const { s, curveId, lineIds } = network();
    const g = s.railGraph();
    const len = lengthOfPiece(g.byId.get(curveId)!);
    const r = findRoute(g, { piece: lineIds[0], u: 0, dir: 1 }, { piece: curveId, u: len / 2 });
    expect(r).not.toBeNull();
    expect(r!.decisions.some((d) => d.chosen === curveId)).toBe(true);
    // Les deux premières tuiles (5 m) puis la moitié du virage.
    expect(r!.distance).toBeGreaterThan(5);
    // Vers la fin de la ligne : tout droit, aucun choix pris vers le virage.
    const straight = findRoute(
      g,
      { piece: lineIds[0], u: 0, dir: 1 },
      { piece: lineIds[8], u: 1 },
    )!;
    expect(straight.decisions.every((d) => d.chosen !== curveId)).toBe(true);
  });

  it('pas de chemin à contresens', () => {
    const { s, lineIds } = network();
    const g = s.railGraph();
    expect(
      findRoute(g, { piece: lineIds[5], u: 1, dir: 1 }, { piece: lineIds[1], u: 1 }),
    ).toBeNull();
  });

  it('le pilote arrête le convoi sur le repère', () => {
    const { s, lineIds } = network();
    const loco = s.placeCar('locomotive_steam', { piece: lineIds[0], u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 20 };
    const g = s.railGraph();
    const goal = { piece: lineIds[8], u: 1.25 };
    let travelled = 0;
    const route = findRoute(g, loco.head, goal)!;
    let remaining = route.distance;
    let maxV = 0;
    for (let i = 0; i < 20 * 120; i++) {
      const ctrl = autoControl(loco, remaining);
      const before = loco.v;
      stepConsist(g, loco, 0.05, ctrl);
      const d = Math.abs((before + loco.v) / 2) * 0.05;
      travelled += d;
      remaining -= d;
      maxV = Math.max(maxV, loco.v);
      if (ctrl.parked) break;
    }
    console.log(
      'reste',
      remaining.toFixed(2),
      'voyagé',
      travelled.toFixed(2),
      'distance',
      route.distance.toFixed(2),
      'v',
      loco.v.toFixed(2),
      'maxV',
      maxV.toFixed(1),
    );
    expect(maxV).toBeLessThanOrEqual(AUTO_SPEED + 1);
    expect(loco.v).toBeLessThan(0.3);
    expect(Math.abs(travelled - route.distance)).toBeLessThan(1);
    expect(loco.head.piece).toBe(lineIds[8]);
  });

  it('stations : pose, nom, retrait avec la voie, ordre de route', () => {
    const { s, lineIds } = network();
    s.inventory.train_station = 3;
    const a = s.placeStation({ piece: lineIds[4], u: 1 }, '  Mine   de fer ')!;
    expect(a.name).toBe('Mine de fer');
    expect(s.inventory.train_station).toBe(2);
    // Trop près d'une autre station de la même pièce.
    expect(s.placeStation({ piece: lineIds[4], u: 2 })).toBeNull();
    const b = s.placeStation({ piece: lineIds[9], u: 1 })!;
    expect(b.name).toBe(`Station ${b.id}`);
    expect(s.renameStation(b.id, 'Fonderie')).toBe(true);
    expect(s.renameStation(b.id, '   ')).toBe(false);
    // Un convoi envoyé à une station, puis la station disparaît avec sa voie : il reprend la main.
    const loco = s.placeCar('locomotive_steam', { piece: lineIds[0], u: 1, dir: 1 })!;
    expect(s.sendTrain(loco.id, b.id)).toBe(true);
    expect(s.sendTrain(loco.id, 999)).toBe(false);
    expect(s.removeRail(lineIds[9], { x: 0, z: 0 })).toBe(true);
    expect(s.changes.stations.map((x) => x.id)).toEqual([a.id]);
    expect(loco.goTo).toBeUndefined();
    expect(s.inventory.train_station).toBe(2);
    expect(s.removeStation(a.id)).toBe(true);
    expect(s.inventory.train_station).toBe(3);
  });

  it('les stations et l’ordre de route survivent à une sauvegarde', () => {
    const { s, lineIds } = network();
    s.inventory.train_station = 1;
    const st = s.placeStation({ piece: lineIds[6], u: 2 }, 'Port')!;
    const loco = s.placeCar('locomotive_steam', { piece: lineIds[0], u: 1, dir: 1 })!;
    s.sendTrain(loco.id, st.id);
    const copy = normalizeChanges(JSON.parse(JSON.stringify(s.snapshot().changes)));
    expect(copy.stations).toEqual([st]);
    expect(copy.trains[0].goTo).toBe(st.id);
  });

  it('un train qui franchit un embranchement garde sa queue sur la voie d’où il vient', () => {
    const s = new GameState({
      inventory: { rail: 300, train_locomotive: 1, train_wagon_freight: 1, coal: 30 },
    });
    s.creative = true;
    for (let k = 0; k < 14; k++) s.placeRail('straight', 0, -TILE_CELLS * k, 0, 0, free);
    const line = s.changes.rails.map((p) => p.id);
    const joint = portsOf(s.changes.rails[2]).find((p) => p.dz === -1)!;
    for (const m of matesFor('curve_huge', joint))
      if (s.placeRail('curve_huge', m.gx, m.gz, m.turns, m.level, free, true) === 'ok') break;
    const curve = s.changes.rails[s.changes.rails.length - 1];
    expect(curve.kind).toBe('curve_huge');
    const g = s.railGraph();
    const len = lengthOfPiece(g.byId.get(curve.id)!);
    // Port du virage qui touche l'embranchement : l'autre bout du virage est loin.
    const ports = portsOf(curve);
    const near = ports.findIndex((p) => Math.hypot(p.x - joint.x, p.z - joint.z) < 0.3);
    const dir = near === 1 ? 1 : -1;
    const loco = s.placeCar('locomotive_steam', {
      piece: curve.id,
      u: near === 1 ? len - 4 : 4,
      dir,
    })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    // Un wagon attelé derrière la locomotive.
    const wagon = { id: 99, kind: 'wagon_freight' as const, rev: false, heatKJ: 0, fuel: null };
    loco.cars.push(wagon);
    // Remonte la queue sur la voie parcourue : le train vient du virage.
    loco.head = { piece: curve.id, u: near === 1 ? len - 13 : 13, dir };
    for (let i = 0; i < 20 * 40; i++) {
      stepConsist(g, loco, 0.05, { throttle: 1, brake: 0, parked: false });
      if (loco.head.piece === line[2] && loco.head.u > 2.2) break;
    }
    expect(loco.head.piece === line[2] || loco.head.piece === line[1]).toBe(true);
    // Le wagon est resté sur le virage (et non téléporté sur la voie droite).
    const w = carPoses(g, loco)[1];
    const onCurve = Math.min(
      ...Array.from({ length: 60 }, (_, k) => {
        const q = poseOn(g.byId.get(curve.id)!, (len * k) / 59);
        return Math.hypot(q.x - w.x, q.z - w.z);
      }),
    );
    const straight = g.byId.get(line[3])!;
    const onStraight = Math.min(
      ...Array.from({ length: 30 }, (_, k) => {
        const q = poseOn(straight, (lengthOfPiece(straight) * k) / 29);
        return Math.hypot(q.x - w.x, q.z - w.z);
      }),
    );
    expect(onCurve).toBeLessThan(0.6);
    expect(onStraight).toBeGreaterThan(1.5);
  });

  it("à l'embranchement, le convoi va tout droit sans consigne et prend le virage si on le choisit", () => {
    for (const pick of [false, true]) {
      const { s, curveId, lineIds } = network();
      s.inventory.train_locomotive = 1;
      const loco = s.placeCar('locomotive_steam', { piece: lineIds[0], u: 1, dir: 1 })!;
      loco.cars[0].fuel = { item: 'coal', count: 30 };
      if (pick) loco.pick = [curveId];
      const g = s.railGraph();
      const seen = new Set<number>();
      for (let i = 0; i < 20 * 40; i++) {
        stepConsist(g, loco, 0.05, { throttle: 1, brake: 0, parked: false });
        seen.add(loco.head.piece);
        if (loco.head.piece === curveId || loco.head.piece === lineIds[5]) break;
      }
      expect(seen.has(curveId)).toBe(pick);
      expect(seen.has(lineIds[5])).toBe(!pick);
    }
  });
});
