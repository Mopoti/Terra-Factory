import { describe, expect, it } from 'vitest';
import { PreviewRenderer, renderPreview } from './preview';
import { WorldGenerator, defaultWorldParams, type WorldParams } from './worldgen';

const gen = (seed: string, tweak?: (p: WorldParams) => void): WorldGenerator => {
  const p = defaultWorldParams(seed);
  tweak?.(p);
  return new WorldGenerator(p);
};

/** Compte les pixels dont la couleur est (presque) celle donnée. */
function countColor(pixels: Uint8ClampedArray, rgb: [number, number, number], tol = 6): number {
  let n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (
      Math.abs(pixels[i] - rgb[0]) <= tol &&
      Math.abs(pixels[i + 1] - rgb[1]) <= tol &&
      Math.abs(pixels[i + 2] - rgb[2]) <= tol
    )
      n++;
  }
  return n;
}
const WATER: [number, number, number] = [0x2f, 0x6f, 0xb0];

const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

describe('carte d’aperçu', () => {
  it('est entièrement dessinée et opaque', () => {
    const r = renderPreview(gen('apercu'), 4);
    expect(r.width).toBe(9 * 16);
    for (let i = 3; i < r.pixels.length; i += 4) expect(r.pixels[i]).toBe(255);
  });
  it('est déterministe : même seed et mêmes réglages = même carte', () => {
    const a = renderPreview(gen('apercu'), 4).pixels;
    const b = renderPreview(gen('apercu'), 4).pixels;
    expect(same(a, b)).toBe(true);
  });
  it('change avec la seed', () => {
    const a = renderPreview(gen('apercu'), 6).pixels;
    const b = renderPreview(gen('autre'), 6).pixels;
    expect(same(a, b)).toBe(false);
  });
  it('avance rangée par rangée jusqu’à la fin', () => {
    const r = new PreviewRenderer(gen('apercu'), 3);
    let steps = 0;
    while (!r.step()) {
      steps++;
      expect(r.progress).toBeGreaterThan(0);
      expect(r.progress).toBeLessThan(1);
    }
    expect(steps).toBe(7); // une rangée de chunks par étape
    expect(r.step()).toBe(true);
  });
  it('plus de fréquence d’étangs = plus d’eau sur la carte', () => {
    const few = countColor(
      renderPreview(
        gen('eau', (p) => (p.families.water.frequency = 0.25)),
        10,
      ).pixels,
      WATER,
    );
    const many = countColor(
      renderPreview(
        gen('eau', (p) => (p.families.water.frequency = 3)),
        10,
      ).pixels,
      WATER,
    );
    expect(many).toBeGreaterThan(few);
  });
  it('le point d’apparition est marqué au centre', () => {
    const r = renderPreview(gen('apercu'), 4);
    const c = r.width / 2;
    const i = (Math.round(c) * r.width + Math.round(c)) * 4;
    expect([r.pixels[i], r.pixels[i + 1], r.pixels[i + 2]]).toEqual([255, 255, 255]);
  });
});
