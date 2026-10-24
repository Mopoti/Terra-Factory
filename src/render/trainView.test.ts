import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { GameState } from '../core/game/state';
import { TILE_M, flip, matesFor, portsOf } from '../core/rail/track';
import { anchorOffset } from '../core/rail/train';
import { TrainView } from './trainView';

/** Rejoue de vrais glissés de la souris dans `TrainView` (sans écran) : le tracé se pose comme en jeu. */
const hurts: number[] = [];
const sfxs: string[] = [];
const msgs: string[] = [];
function bench() {
  const fake = () => ({
    className: '',
    hidden: false,
    textContent: '',
    appendChild() {},
    remove() {},
    getContext: () => null,
  });
  vi.stubGlobal('document', { createElement: fake });
  const state = new GameState({ inventory: { rail: 999 } });
  state.creative = true;
  state.held = 'rail';
  const down = new Set<string>();
  let blockBelowGz = -1e9;
  let aim: { x: number; z: number } | null = null;
  const view = new TrainView({
    scene: new THREE.Scene(),
    state,
    material: new THREE.MeshBasicMaterial(),
    container: fake() as never,
    aim: () => aim,
    blocked: (_gx: number, gz: number) => gz < blockBelowGz,
    held: (a: string) => down.has(a),
    message: (m: string) => msgs.push(m),
    sfx: (n: string) => sfxs.push(n),
    renameStation: () => {},
    hurtPlayer: (a: number) => hurts.push(a),
    openWindow: () => {},
    chooseStation: () => Promise.resolve(null),
  } as never);
  const frame = {
    dt: 0.016,
    paused: false,
    uiOpen: false,
    guest: false,
    use: false,
    couple: false,
    rotate: false,
    levelUp: false,
    levelDown: false,
    route: false,
    aimed: false,
    facing: 0,
  };
  const at = (tx: number, tz: number) => ({ x: (tx + 0.5) * TILE_M, z: (tz + 0.5) * TILE_M });
  const step = (tx: number, tz: number, pressed: boolean): void => {
    aim = at(tx, tz);
    if (pressed) down.add('interact');
    else down.delete('interact');
    view.update(frame, { x: 0, z: 0 });
  };
  /** Glisse de tuile en tuile le long des étapes (dx, dz, n), puis relâche. */
  const drag = (from: [number, number], legs: [number, number, number][]): void => {
    let [tx, tz] = from;
    step(tx, tz, false);
    step(tx, tz, true);
    for (const [dx, dz, n] of legs)
      for (let k = 0; k < n; k++) {
        tx += dx;
        tz += dz;
        step(tx, tz, true);
      }
    step(tx, tz, false);
  };
  const tick = (n: number, dt = 0.05, at = { x: 0, z: 0 }): void => {
    for (let i = 0; i < n; i++) view.update({ ...frame, dt }, at);
  };
  return {
    state,
    view,
    drag,
    tick,
    step,
    /** Tout ce qui est plus au nord que cette ligne de tuiles est un obstacle. */
    blockNorthOf: (tz: number) => (blockBelowGz = (tz * TILE_M) / CELL_SIZE_M),
  };
}

describe('tracé : obstacle et annulation', () => {
  it("la pose s'arrête avant l'obstacle (seule la partie libre est posée)", () => {
    const { state, drag, blockNorthOf } = bench();
    blockNorthOf(12);
    drag([20, 20], [[0, -1, 14]]);
    const rails = state.changes.rails;
    expect(rails.length).toBeGreaterThan(5);
    expect(rails.length).toBeLessThan(15);
    for (const p of rails) expect(p.gz).toBeGreaterThanOrEqual((12 * TILE_M) / CELL_SIZE_M - 1);
    expect(msgs.at(-1)).toContain('obstacle');
  });

  it("le clic droit pendant le tracé l'annule : rien n'est posé au relâchement", () => {
    const { state, view, step } = bench();
    step(20, 20, false);
    step(20, 20, true);
    for (let tz = 19; tz >= 12; tz--) step(20, tz, true);
    expect(view.isTracing()).toBe(true);
    expect(view.cancelTrace()).toBe(true);
    step(20, 12, true);
    step(20, 12, false);
    expect(state.changes.rails).toHaveLength(0);
    // Un nouveau tracé repart normalement.
    step(20, 20, true);
    for (let tz = 19; tz >= 15; tz--) step(20, tz, true);
    step(20, 15, false);
    expect(state.changes.rails.length).toBeGreaterThan(0);
  });
});

describe('tracé à la souris depuis une voie existante', () => {
  it('un virage tracé depuis la ligne en garde toute la longueur (deux chemins)', () => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 13]]); // ligne droite de 14 tuiles
    const line = state.changes.rails.map((p) => p.id);
    expect(line).toHaveLength(14);
    drag(
      [20, 17],
      [
        [0, -1, 3],
        [-1, 0, 5],
      ],
    );
    const kept = new Set(state.changes.rails.map((p) => p.id));
    expect(line.every((id) => kept.has(id))).toBe(true);
    expect(state.changes.rails.some((p) => p.kind.startsWith('curve'))).toBe(true);
  });

  it('glisser de côté depuis la ligne pose un embranchement tangent : la ligne reste entière', () => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 13]]);
    const line = state.changes.rails.map((p) => p.id);
    drag([20, 14], [[-1, 0, 5]]);
    const kept = new Set(state.changes.rails.map((p) => p.id));
    expect(line.filter((id) => !kept.has(id))).toHaveLength(0);
    expect(state.changes.rails.length).toBeGreaterThan(line.length);
    expect(state.changes.rails.some((p) => p.kind.startsWith('curve'))).toBe(true);
    // Un embranchement : une voie de la ligne a deux suites, la ligne droite d'abord (tout droit sans consigne).
    const g = state.railGraph();
    const curve = state.changes.rails.find((p) => p.kind.startsWith('curve'))!;
    const forks = line.flatMap((id) =>
      ([0, 1] as const).map((port) => g.linksAt(id, port)).filter((l) => l.length > 1),
    );
    expect(forks).toHaveLength(1);
    expect(forks[0].map((l) => l.piece)).toContain(curve.id);
    expect(forks[0][0].piece).not.toBe(curve.id);
  });

  it("un clic loin devant le bout de la voie la prolonge jusqu'au curseur", () => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 4]]); // 5 tuiles, bout à tz = 16
    const before = state.changes.rails.length;
    // Clic simple, sans glisser, 8 tuiles plus loin sur la même ligne.
    drag([20, 8], []);
    expect(state.changes.rails.length).toBeGreaterThanOrEqual(before + 7);
    const g = state.railGraph();
    const run = g.advance({ piece: state.changes.rails[0].id, u: 0, dir: 1 }, 25);
    expect(run.blocked).toBe(false);
  });

  it.each([
    ['devant à gauche', 17, 12, 3.5],
    ['de côté à gauche', 17, 16, 3.5],
    ['en dessous à gauche', 17, 18, 5.5],
    ['devant à droite, loin', 26, 8, 3.5],
  ])('le curseur %s du bout de voie : un virage mène au plus près', (_nom, tx, tz, tol) => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 4]]); // 5 tuiles, bout à tz = 16, qui regarde vers −z
    const before = state.changes.rails.length;
    drag([tx, tz], []);
    const added = state.changes.rails.slice(before);
    expect(added.some((p) => p.kind.startsWith('curve'))).toBe(true);
    // Voie continue du premier rail à la fin.
    const g = state.railGraph();
    expect(g.advance({ piece: state.changes.rails[0].id, u: 0, dir: 1 }, 12.5).blocked).toBe(false);
    // La voie finit près du curseur (quelques tuiles de l'un de ses bouts).
    const last = added[added.length - 1];
    const gap = Math.min(
      ...portsOf(last).map((q) => Math.hypot(q.x - (tx + 0.5) * TILE_M, q.z - (tz + 0.5) * TILE_M)),
    );
    expect(gap).toBeLessThan(tol * TILE_M);
  });

  it('un décalage de moins de 2 tuiles est ignoré : la voie reste droite', () => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 4]]);
    const before = state.changes.rails.length;
    drag([19, 10], []);
    const added = state.changes.rails.slice(before);
    expect(added.length).toBeGreaterThan(3);
    expect(added.every((p) => p.kind === 'straight')).toBe(true);
  });

  it('un convoi envoyé à une station y va tout seul, tourne par les aiguillages et s’y arrête', () => {
    const { state, drag, tick } = bench();
    drag([20, 20], [[0, -1, 13]]); // ligne de 14 tuiles vers −z
    // Un virage tangent au joint des tuiles 4 et 5 ; la station est au bout du virage.
    const rails = state.changes.rails;
    const joint = portsOf(rails[4]).find((p) => p.dz === -1)!;
    for (const m of matesFor('curve_large', joint))
      if (state.placeRail('curve_large', m.gx, m.gz, m.turns, m.level, () => false, true) === 'ok')
        break;
    const curve = state.changes.rails[state.changes.rails.length - 1];
    expect(curve.kind).toBe('curve_large');
    state.inventory.train_station = 2;
    state.inventory.train_locomotive = 1;
    const station = state.placeStation({ piece: curve.id, u: 9 }, 'Gare du virage')!;
    const loco = state.placeCar('locomotive_steam', { piece: rails[0].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    expect(state.sendTrain(loco.id, station.id)).toBe(true);
    tick(20 * 90); // 90 s
    expect(loco.goTo).toBeUndefined();
    expect(Math.abs(loco.v)).toBeLessThan(0.3);
    // Il est arrivé sur la voie du virage, à moins de 1 m du repère.
    const g = state.railGraph();
    // C'est la locomotive (son centre) qui s'arrête au repère de la station.
    const head = g.pose(flip(g.advance(flip(loco.head), anchorOffset(loco)).pos))!;
    const stop = g.pose({ piece: station.piece, u: station.u, dir: 1 })!;
    expect(loco.head.piece).toBe(curve.id);
    expect(Math.hypot(head.x - stop.x, head.z - stop.z)).toBeLessThan(1);
  });

  it('un programme enchaîne les étapes : aller à B, attendre, aller à C, puis se met en pause faute de chemin', () => {
    const { state, drag, tick } = bench();
    drag([20, 20], [[0, -1, 19]]); // ligne de 20 tuiles vers −z
    const rails = state.changes.rails;
    state.inventory.train_station = 2;
    state.inventory.train_locomotive = 1;
    const b = state.placeStation({ piece: rails[6].id, u: 1.25 }, 'B')!;
    const c = state.placeStation({ piece: rails[15].id, u: 1.25 }, 'C')!;
    const loco = state.placeCar('locomotive_steam', { piece: rails[0].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 40 };
    expect(
      state.setProgram(loco.id, {
        steps: [
          { mode: 'all', when: [], then: { type: 'goTo', station: b.id } },
          {
            mode: 'all',
            when: [{ subject: 'time', verb: 'elapsed', value: 2 }],
            then: { type: 'wait', seconds: 1 },
          },
          { mode: 'all', when: [], then: { type: 'goTo', station: c.id } },
        ],
      }),
    ).toBe(true);
    expect(loco.program?.running).toBe(false);
    tick(20 * 3);
    expect(loco.goTo).toBeUndefined(); // en pause : rien ne bouge
    state.setProgramRunning(loco.id, true);
    tick(20 * 12);
    expect(loco.program?.index).toBeGreaterThanOrEqual(0);
    tick(20 * 150);
    // Arrivé à C ; revenir à B est impossible (il est derrière) : le programme se met en pause.
    const g = state.railGraph();
    // C'est la locomotive (son centre) qui s'arrête au repère de la station.
    const head = g.pose(flip(g.advance(flip(loco.head), anchorOffset(loco)).pos))!;
    const stop = g.pose({ piece: c.piece, u: c.u, dir: 1 })!;
    expect(Math.hypot(head.x - stop.x, head.z - stop.z)).toBeLessThan(1);
    expect(loco.program?.running).toBe(false);
    expect(Math.abs(loco.v)).toBeLessThan(0.3);
  });

  it('un train en marche qui percute le joueur lui fait des dégâts selon sa vitesse', () => {
    const { state, drag, tick } = bench();
    hurts.length = 0;
    drag([20, 20], [[0, -1, 9]]);
    const rails = state.changes.rails;
    state.inventory.train_locomotive = 1;
    const loco = state.placeCar('locomotive_steam', { piece: rails[0].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    // Le joueur se tient sur la voie, devant la locomotive : elle roule vers lui.
    const g = state.railGraph();
    const ahead = g.advance(loco.head, 14).pos;
    const at = g.pose(ahead)!;
    loco.v = 8;
    // Les frames du banc ne donnent pas la position du joueur : on appelle update avec la sienne.
    for (let i = 0; i < 60 && hurts.length === 0; i++) {
      loco.v = 8;
      tick(1, 0.05, { x: at.x, z: at.z });
    }
    expect(hurts.length).toBeGreaterThan(0);
    expect(hurts[0]).toBeGreaterThan(20);
    expect(hurts[0]).toBeLessThanOrEqual(100);
  });

  it('un programme « va à X » sans condition, quand le train est déjà à X, ne claque pas sans fin', () => {
    const { state, drag, tick } = bench();
    drag([20, 20], [[0, -1, 9]]);
    const rails = state.changes.rails;
    state.inventory.train_station = 1;
    state.inventory.train_locomotive = 1;
    const loco = state.placeCar('locomotive_steam', { piece: rails[3].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    // La station est juste sous la locomotive.
    const g = state.railGraph();
    const at = g.advance(flip(loco.head), anchorOffset(loco)).pos;
    const st = state.placeStation({ piece: at.piece, u: at.u }, 'Ici')!;
    state.setProgram(loco.id, {
      steps: [{ mode: 'all', when: [], then: { type: 'goTo', station: st.id } }],
    });
    state.setProgramRunning(loco.id, true);
    sfxs.length = 0;
    msgs.length = 0;
    tick(20 * 20); // 20 s
    expect(sfxs.filter((n) => n === 'select')).toHaveLength(0);
    expect(msgs).toHaveLength(0);
  });
});
