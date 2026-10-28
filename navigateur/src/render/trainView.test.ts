import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { GameState } from '../core/game/state';
import { TILE_M, flip, portsOf } from '../core/rail/track';
import { placeAt, placeLine } from '../core/rail/testTrack';
import { anchorOffset } from '../core/rail/train';
import { TrainView } from './trainView';

/** Rejoue de vrais clics de la souris dans `TrainView` (sans écran) : le patron se pose comme en jeu. */
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
  /** Un clic (appui puis relâchement) sur le point (x, z) en mètres. */
  const click = (x: number, z: number, rotate = false): void => {
    aim = { x, z };
    down.delete('interact');
    view.update({ ...frame, rotate }, { x: 0, z: 0 });
    down.add('interact');
    view.update(frame, { x: 0, z: 0 });
    down.delete('interact');
    view.update(frame, { x: 0, z: 0 });
  };
  /** Le clic gauche est enfoncé en (x, z), puis le curseur glisse, puis on relâche. */
  const press = (x: number, z: number): void => {
    aim = { x, z };
    down.add('interact');
    view.update(frame, { x: 0, z: 0 });
  };
  const slide = (x: number, z: number): void => {
    aim = { x, z };
    view.update(frame, { x: 0, z: 0 });
  };
  const letGo = (): void => {
    down.delete('interact');
    view.update(frame, { x: 0, z: 0 });
  };
  /** Le curseur survole (x, z) sans cliquer. */
  const hover = (x: number, z: number): void => {
    aim = { x, z };
    down.delete('interact');
    view.update(frame, { x: 0, z: 0 });
  };
  const tick = (n: number, dt = 0.05, at = { x: 0, z: 0 }): void => {
    for (let i = 0; i < n; i++) view.update({ ...frame, dt }, at);
  };
  return {
    state,
    view,
    click,
    hover,
    press,
    slide,
    letGo,
    tick,
    /** Tout ce qui est plus au nord que cette ligne de tuiles est un obstacle. */
    blockNorthOf: (tz: number) => (blockBelowGz = (tz * TILE_M) / CELL_SIZE_M),
  };
}

const ghostOf = (view: unknown): { visible: boolean } =>
  (view as unknown as { ghost: { visible: boolean } }).ghost;

describe('patron de voie : une pièce par clic', () => {
  it('loin de toute voie : un clic pose un droit sur la grille, R le tourne par pas de 45°', () => {
    const { state, click } = bench();
    click(50, 50);
    expect(state.changes.rails).toHaveLength(1);
    expect(state.changes.rails[0]).toMatchObject({ kind: 'straight', h: 0 });
    click(100, 100, true); // un appui sur R tourne d'un cran (45°) : droit en diagonale
    const diag = state.changes.rails[1];
    expect(diag.kind).toBe('straight');
    expect(diag.h).toBe(1);
  });

  it('près du bout : le patron se colle et prolonge la voie ; le curseur de côté choisit un virage', () => {
    const { state, click } = bench();
    click(50, 50);
    const first = state.changes.rails[0];
    const end = portsOf(first)[1];
    // Curseur juste devant le bout : un droit qui prolonge exactement la voie.
    click(end.x + end.dx * 1.5, end.z + end.dz * 1.5);
    expect(state.changes.rails).toHaveLength(2);
    expect(state.changes.rails[1]).toMatchObject({ kind: 'straight', h: first.h });
    // Curseur de côté, plus loin : un virage de 45°, du côté visé.
    const e2 = portsOf(state.changes.rails[1])[1];
    const left = { x: e2.dz, z: -e2.dx };
    click(e2.x + e2.dx * 8 + left.x * 4, e2.z + e2.dz * 8 + left.z * 4);
    const turn = state.changes.rails[2];
    expect(turn.kind).toMatch(/^curve_/);
    const tail = portsOf(turn)[1];
    // Le virage finit du côté du curseur.
    expect((tail.x - e2.x) * left.x + (tail.z - e2.z) * left.z).toBeGreaterThan(0.5);
  });

  it('le patron est rouge et rien ne se pose sur un obstacle ; il dit pourquoi', () => {
    const { state, click, hover, blockNorthOf, view } = bench();
    blockNorthOf(1000); // tout est bloqué
    msgs.length = 0;
    hover(50, 50);
    expect(ghostOf(view).visible).toBe(true);
    click(50, 50);
    expect(state.changes.rails).toHaveLength(0);
    expect(msgs.at(-1)).toContain('obstacle');
  });

  it('sur la voie posée, le patron est rouge et rien ne se pose par-dessus', () => {
    const { state, click, hover, view } = bench();
    placeLine(state, 10, 20, 60);
    const mid = state.changes.rails[5];
    const before = state.changes.rails.length;
    msgs.length = 0;
    hover(mid.x, mid.z - 1);
    expect(ghostOf(view).visible).toBe(true);
    click(mid.x, mid.z - 1);
    expect(state.changes.rails).toHaveLength(before);
    expect(msgs.at(-1)).toContain('chevauche');
  });

  it('un embranchement : un virage posé au bout d’une voie qui a déjà une suite', () => {
    const { state } = bench();
    placeLine(state, 8, 20, 40);
    const line = state.changes.rails.map((p) => p.id);
    const joint = portsOf(state.changes.rails[3]).find((p) => p.dz === -1)!;
    const curve = placeAt(state, 'curve_l', joint)!;
    const g = state.railGraph();
    expect(g.linksAt(line[3], 1).map((l) => l.piece)).toEqual([line[4], curve.id]);
  });
});

describe('patrons en chaîne : clic gauche maintenu', () => {
  it('le curseur qui avance ajoute des patrons, relâcher pose toute la chaîne', () => {
    const { state, view, press, slide, letGo } = bench();
    press(50, 50);
    expect((view as unknown as { chain: unknown[] }).chain.length).toBe(1);
    expect(state.changes.rails).toHaveLength(0); // rien n'est posé avant le relâchement
    // Le premier patron est un droit vers +z (cap 0) ; on tire vers +z.
    for (let z = 52; z <= 66; z += 2) slide(50, z);
    letGo();
    const n = state.changes.rails.length;
    expect(n).toBeGreaterThanOrEqual(5);
    // Une voie continue, de bout en bout.
    const g = state.railGraph();
    const ids = state.changes.rails.map((p) => p.id);
    expect(g.advance({ piece: ids[0], u: 0, dir: 1 }, 2.5 * (n - 1)).blocked).toBe(false);
  });

  it('reculer retire des patrons ; le clic droit annule tout', () => {
    const { state, view, press, slide, letGo } = bench();
    press(50, 50);
    for (let z = 52; z <= 66; z += 2) slide(50, z);
    const far = (view as unknown as { chain: unknown[] }).chain.length;
    for (let z = 64; z >= 54; z -= 2) slide(50, z);
    expect((view as unknown as { chain: unknown[] }).chain.length).toBeLessThan(far);
    expect(view.isTracing()).toBe(true);
    expect(view.cancelTrace()).toBe(true);
    slide(50, 70);
    letGo();
    expect(state.changes.rails).toHaveLength(0);
  });

  it('un obstacle arrête la chaîne : seule la partie libre est posée', () => {
    const { state, press, slide, letGo, blockNorthOf } = bench();
    blockNorthOf(1000);
    msgs.length = 0;
    press(50, 50);
    for (let z = 52; z <= 66; z += 2) slide(50, z);
    letGo();
    expect(state.changes.rails).toHaveLength(0);
    expect(msgs.at(-1)).toBeTruthy();
  });
});

describe('trains sur la voie posée', () => {
  /** Ligne de `n` droits vers −z, avec, au joint des droits 5 et 6, un virage à gauche suivi de `tail` droits. */
  function withBranch(tail: number) {
    const b = bench();
    placeLine(b.state, 14, 20, 40);
    const rails = [...b.state.changes.rails];
    const joint = portsOf(rails[4]).find((p) => p.dz === -1)!;
    const curve = placeAt(b.state, 'curve_l', joint)!;
    const branch = [curve];
    for (let k = 0; k < tail; k++) {
      const last = b.state.changes.rails[b.state.changes.rails.length - 1];
      branch.push(placeAt(b.state, 'straight', portsOf(last)[1])!);
    }
    return { ...b, rails, curve, branch };
  }

  it('un convoi envoyé à une station y va tout seul, tourne par les embranchements et s’y arrête', () => {
    const { state, tick, rails, branch } = withBranch(6);
    state.inventory.train_station = 2;
    state.inventory.train_locomotive = 1;
    const target = branch[3];
    const station = state.placeStation({ piece: target.id, u: 1.5 }, 'Gare du virage')!;
    const loco = state.placeCar('locomotive_steam', { piece: rails[0].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    expect(state.sendTrain(loco.id, station.id)).toBe(true);
    tick(20 * 90); // 90 s
    expect(loco.goTo).toBeUndefined();
    expect(Math.abs(loco.v)).toBeLessThan(0.3);
    const g = state.railGraph();
    // C'est la locomotive (son centre) qui s'arrête au repère de la station.
    const head = g.pose(flip(g.advance(flip(loco.head), anchorOffset(loco)).pos))!;
    const stop = g.pose({ piece: station.piece, u: station.u, dir: 1 })!;
    expect(branch.map((p) => p.id)).toContain(loco.head.piece);
    expect(Math.hypot(head.x - stop.x, head.z - stop.z)).toBeLessThan(1);
  });

  it('un programme enchaîne les étapes : aller à B, attendre, aller à C, puis se met en pause faute de chemin', () => {
    const { state, tick } = bench();
    placeLine(state, 20, 20, 60);
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
    const head = g.pose(flip(g.advance(flip(loco.head), anchorOffset(loco)).pos))!;
    const stop = g.pose({ piece: c.piece, u: c.u, dir: 1 })!;
    expect(Math.hypot(head.x - stop.x, head.z - stop.z)).toBeLessThan(1);
    expect(loco.program?.running).toBe(false);
    expect(Math.abs(loco.v)).toBeLessThan(0.3);
  });

  it('un train en marche qui percute le joueur lui fait des dégâts selon sa vitesse', () => {
    const { state, tick } = bench();
    hurts.length = 0;
    placeLine(state, 10, 20, 40);
    const rails = state.changes.rails;
    state.inventory.train_locomotive = 1;
    const loco = state.placeCar('locomotive_steam', { piece: rails[0].id, u: 1, dir: 1 })!;
    loco.cars[0].fuel = { item: 'coal', count: 30 };
    // Le joueur se tient sur la voie, devant la locomotive : elle roule vers lui.
    const g = state.railGraph();
    const ahead = g.advance(loco.head, 14).pos;
    const at = g.pose(ahead)!;
    loco.v = 8;
    for (let i = 0; i < 60 && hurts.length === 0; i++) {
      loco.v = 8;
      tick(1, 0.05, { x: at.x, z: at.z });
    }
    expect(hurts.length).toBeGreaterThan(0);
    expect(hurts[0]).toBeGreaterThan(20);
    expect(hurts[0]).toBeLessThanOrEqual(100);
  });

  it('un programme « va à X » sans condition, quand le train est déjà à X, ne claque pas sans fin', () => {
    const { state, tick } = bench();
    placeLine(state, 10, 20, 40);
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
    tick(1); // le conseil du patron s'affiche une fois
    sfxs.length = 0;
    msgs.length = 0;
    tick(20 * 20); // 20 s
    expect(sfxs.filter((n) => n === 'select')).toHaveLength(0);
    expect(msgs).toHaveLength(0);
  });
});
