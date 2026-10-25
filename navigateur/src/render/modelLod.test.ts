import { describe, expect, it } from 'vitest';
import { lowDetail } from './modelLod';

/** Sphère maillée : assez de triangles pour être simplifiée. */
function sphere(n: number) {
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const a = (i / n) * Math.PI;
      const b = (j / n) * 2 * Math.PI;
      positions.push(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = i * (n + 1) + j;
      index.push(p, p + 1, p + n + 1, p + 1, p + n + 2, p + n + 1);
    }
  }
  const pos = new Float32Array(positions);
  return {
    positions: pos,
    normals: pos.slice(),
    colors: new Float32Array(pos.length).fill(0.5),
    index: new Uint32Array(index),
    min: { x: -1, y: -1, z: -1 },
    size: { x: 2, y: 2, z: 2 },
  };
}

describe('lowDetail', () => {
  it('réduit nettement les triangles et reste cohérent', () => {
    const m = sphere(24);
    const low = lowDetail(m, 2);
    expect(low.index.length).toBeLessThan(m.index.length * 0.3);
    expect(low.index.length).toBeGreaterThan(0);
    for (const i of low.index) expect(i * 3).toBeLessThan(low.positions.length);
  });
  it('garde tel quel un modèle déjà léger et met en cache', () => {
    const small = sphere(3);
    expect(lowDetail(small, 1)).toBe(small);
    const m = sphere(24);
    expect(lowDetail(m, 1)).toBe(lowDetail(m, 1));
  });
});
