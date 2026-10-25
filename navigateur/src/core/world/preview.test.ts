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

describe('info-bulle de l’aperçu', () => {
  it('retrouve la ressource sous un pixel de la carte (minerai, eau, objet)', () => {
    const gen = new WorldGenerator(defaultWorldParams('terra'));
    const r = new PreviewRenderer(gen, 6);
    const chunk = gen.chunk(1, 1);
    const ore = chunk.ore[0];
    expect(ore).toBeDefined();
    // Pixel de cette case : (gx + rayon × 16, gz + rayon × 16).
    const { gx, gz } = r.cellOfPixel(ore.gx + 6 * 16, ore.gz + 6 * 16);
    expect([gx, gz]).toEqual([ore.gx, ore.gz]);
    expect(r.inspect(gx, gz)).toEqual({ kind: 'ore', id: ore.id });
    expect(r.oreAt(gx, gz)?.amount).toBe(ore.amount);
    const rock = gen
      .chunk(0, 0)
      .objects.concat(gen.chunk(2, 2).objects)
      .find((o) => o.id === 'rock');
    if (rock) expect(r.inspect(rock.gx, rock.gz)).toEqual({ kind: 'object', id: 'rock' });
    // Une case sans rien.
    let empty: { gx: number; gz: number } | null = null;
    for (let x = 0; x < 16 && !empty; x++)
      for (let z = 0; z < 16 && !empty; z++) if (!r.inspect(x, z)) empty = { gx: x, gz: z };
    expect(empty).not.toBeNull();
  });
});
