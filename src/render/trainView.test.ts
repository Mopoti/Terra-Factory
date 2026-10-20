import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameState } from '../core/game/state';
import { TILE_M, portsOf } from '../core/rail/track';
import { TrainView } from './trainView';

/** Rejoue de vrais glissés de la souris dans `TrainView` (sans écran) : le tracé se pose comme en jeu. */
function bench() {
  const fake = () => ({
    className: '',
    hidden: false,
    textContent: '',
    appendChild() {},
    remove() {},
  });
  vi.stubGlobal('document', { createElement: fake });
  const state = new GameState({ inventory: { rail: 999 } });
  state.creative = true;
  state.held = 'rail';
  const down = new Set<string>();
  let aim: { x: number; z: number } | null = null;
  const view = new TrainView({
    scene: new THREE.Scene(),
    state,
    material: new THREE.MeshBasicMaterial(),
    container: fake() as never,
    aim: () => aim,
    blocked: () => false,
    held: (a: string) => down.has(a),
    message: () => {},
    sfx: () => {},
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
  return { state, drag };
}

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

  it('glisser de côté depuis la ligne pose un aiguillage et ne retire que ses trois tuiles', () => {
    const { state, drag } = bench();
    drag([20, 20], [[0, -1, 13]]);
    const line = state.changes.rails.map((p) => p.id);
    drag([20, 14], [[-1, 0, 5]]);
    const kept = new Set(state.changes.rails.map((p) => p.id));
    expect(line.filter((id) => !kept.has(id))).toHaveLength(3);
    expect(state.changes.rails.some((p) => p.kind.startsWith('switch'))).toBe(true);
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
});
