import { describe, expect, it } from 'vitest';
import { BAND_PITCH_M, BandBuilder, bandSign, withUpstream } from './beltBands';
import type { PartGroup } from './models';

/** Une « lame » d'un seul triangle, posée à (x, 0, z). */
const lame = (x: number, z: number): PartGroup => ({
  positions: new Float32Array([x, 0, z, x + 0.01, 0, z, x, 0, z + 0.01]),
  normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
  colors: new Float32Array(9).fill(0.5),
  index: new Uint32Array([0, 1, 2]),
  pivot: { x: -0.5, y: 0, z: 0.5 },
  axis: { x: 0, y: 1, z: 0 },
});
const box = { min: { x: -0.5, y: 0, z: -0.5 }, size: { x: 1, y: 0.2, z: 1 } };

describe('bande des tapis', () => {
  it('ajoute une lame un pas en amont sur le tapis droit', () => {
    const b = withUpstream(lame(0.125, 0), 'straight');
    expect(b.positions.length).toBe(18);
    expect(b.index.length).toBe(6);
    expect(b.positions[9]).toBeCloseTo(0.125 - BAND_PITCH_M);
    expect(b.index[3]).toBe(3);
  });

  it('ajoute la lame en amont du sens de rotation dans les virages', () => {
    expect(bandSign('corner')).toBe(-1);
    expect(bandSign('cornerBack')).toBe(1);
    // Lame à 45° autour du pivot (−0,5 ; 0,5) : la copie est à 67,5° (corner, angle décroissant) ou 22,5° (inverse).
    const r = 0.5;
    const g = lame(-0.5 + r * Math.cos(Math.PI / 4), 0.5 - r * Math.sin(Math.PI / 4));
    const angle = (b: PartGroup): number =>
      Math.atan2(-(b.positions[11] - 0.5), b.positions[9] + 0.5);
    expect(angle(withUpstream(g, 'corner'))).toBeCloseTo((3 * Math.PI) / 8);
    expect(angle(withUpstream(g, 'cornerBack'))).toBeCloseTo(Math.PI / 8);
  });

  it('donne à chaque sommet le mouvement de sa tuile', () => {
    const bb = new BandBuilder();
    bb.add(lame(0, 0), box, 'straight', 10, 0, 20, 1, 1, 1, 0.5, 1.5);
    const n = bb.mb.positions.length / 3;
    expect(n).toBe(6);
    expect(bb.flowA.length).toBe(n * 4);
    // Tourné d'un quart de tour : +x du modèle devient −z.
    expect(bb.flowA[0]).toBeCloseTo(0);
    expect(bb.flowA[1]).toBeCloseTo(-1);
    expect(bb.flowB.slice(0, 3)).toEqual([0, 1.5, BAND_PITCH_M]);
    expect(bb.tile.slice(0, 3)).toEqual([10, 20, 0.5]);
    bb.add(lame(0, 0), box, 'corner', 0, 0, 0, 0, 1, 1, 0.5, 1);
    const k = n * 4;
    expect(bb.flowA[k]).toBeCloseTo(-0.5);
    expect(bb.flowA[k + 1]).toBeCloseTo(0.5);
    expect(bb.flowB[k]).toBe(1);
    expect(bb.flowB[k + 3]).toBe(-1);
    expect(bb.geometry().getAttribute('aBandB').count).toBe(12);
  });
});
