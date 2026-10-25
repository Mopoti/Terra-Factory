import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TrackGraph } from '../core/rail/track';
import { StationView } from './stationView';

describe('quai de gare : collisions', () => {
  // Voie le long de +z à l'origine : le quai est du côté +x (local), l'abri à x ≈ 3,2.
  const graph = {
    byId: new Map(),
    pose: () => ({ x: 0, y: 0, z: 0, yaw: 0 }),
  } as unknown as TrackGraph;
  const view = new StationView(new THREE.Scene());
  view.sync([{ id: 1, name: '', piece: 1, u: 0 } as never], graph);

  it('on ne traverse ni la paroi de l’abri ni le banc, mais on marche sur le quai', () => {
    expect(view.solidAt(3.2, -1, 0.32, 2)).toBe(true);
    expect(view.solidAt(3.0, -1, 0.32, 2)).toBe(true);
    expect(view.solidAt(2.6, -1, 0.32, 2)).toBe(false);
    expect(view.solidAt(2.6, 5, 0.32, 2)).toBe(false);
  });
  it('le mât du panneau est plein', () => {
    expect(view.solidAt(3.2, -3.7, 0.32, 2)).toBe(true);
  });
});
