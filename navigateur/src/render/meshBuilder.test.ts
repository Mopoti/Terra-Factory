import { describe, expect, it } from 'vitest';
import { MeshBuilder } from './meshBuilder';

/** Ancienne version (un appel par sommet de triangle) : sert de référence. */
function reference(
  model: {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    index: Uint32Array;
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  },
  x: number,
  y: number,
  z: number,
  turns: number,
  scale: number,
  tint: { r: number; g: number; b: number } | undefined,
  mix: number,
  mirror: boolean,
): { p: number[]; n: number[]; c: number[] } {
  const p: number[] = [];
  const nn: number[] = [];
  const cc: number[] = [];
  const a = (turns * Math.PI) / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const cx = model.min.x + model.size.x / 2;
  const cz = model.min.z + model.size.z / 2;
  const place = (i: number): void => {
    const flip = mirror ? -1 : 1;
    const px = (model.positions[i * 3] - cx) * scale * flip;
    const py = (model.positions[i * 3 + 1] - model.min.y) * scale;
    const pz = (model.positions[i * 3 + 2] - cz) * scale;
    p.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
    const nx = model.normals[i * 3] * flip;
    const nz = model.normals[i * 3 + 2];
    nn.push(nx * c + nz * s, model.normals[i * 3 + 1], -nx * s + nz * c);
    const r = model.colors[i * 3];
    const g = model.colors[i * 3 + 1];
    const b = model.colors[i * 3 + 2];
    if (tint && mix > 0)
      cc.push(r + (tint.r - r) * mix, g + (tint.g - g) * mix, b + (tint.b - b) * mix);
    else cc.push(r, g, b);
  };
  for (let k = 0; k < model.index.length; k += 3) {
    if (mirror) {
      place(model.index[k]);
      place(model.index[k + 2]);
      place(model.index[k + 1]);
    } else {
      place(model.index[k]);
      place(model.index[k + 1]);
      place(model.index[k + 2]);
    }
  }
  return { p, n: nn, c: cc };
}

describe('MeshBuilder.model', () => {
  const model = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 1, 0.5, 1, 1]),
    normals: new Float32Array([0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0]),
    colors: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0.5, 0.5, 0.5]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3, 1, 4, 3]),
    min: { x: 0, y: 0, z: 0 },
    size: { x: 1, y: 2, z: 1 },
  };
  for (const [turns, mirror, tint] of [
    [0, false, undefined],
    [1, false, { r: 0.9, g: 0.9, b: 1 }],
    [3, true, undefined],
    [2, true, { r: 0.2, g: 0.4, b: 0.6 }],
  ] as const) {
    it(`donne les mêmes sommets que la version d’origine (quarts de tour ${turns}, miroir ${mirror})`, () => {
      const b = new MeshBuilder();
      b.model(model, 2, 1, -3, turns, 1.7, tint, tint ? 0.4 : 0, mirror);
      const ref = reference(model, 2, 1, -3, turns, 1.7, tint, tint ? 0.4 : 0, mirror);
      expect(b.positions.length).toBe(ref.p.length);
      b.positions.forEach((v, i) => expect(v).toBeCloseTo(ref.p[i], 4));
      b.normals.forEach((v, i) => expect(v).toBeCloseTo(ref.n[i], 4));
      b.colors.forEach((v, i) => expect(v).toBeCloseTo(ref.c[i], 4));
    });
  }
});
