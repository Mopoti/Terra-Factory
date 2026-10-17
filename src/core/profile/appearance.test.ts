import { describe, expect, it } from 'vitest';
import {
  BODY_KEYS,
  COLOR_KEYS,
  FACE_KEYS,
  bodyScales,
  decodeLook,
  defaultAppearance,
  encodeLook,
  isHexColor,
  normalizeAppearance,
  randomAppearance,
} from './appearance';

describe('apparence du personnage', () => {
  it('une apparence abîmée ou inconnue redevient valide', () => {
    expect(normalizeAppearance(null)).toEqual(defaultAppearance());
    const a = normalizeAppearance({
      silhouette: 'robot',
      body: { height: 9, build: 'oops', bulk: -3 },
      hairStyle: 'iroquoise',
      colors: { suit: '#ABCDEF', skin: 'rouge', hair: '#12345' },
    });
    expect(a.silhouette).toBe('homme');
    expect(a.body.height).toBe(1);
    expect(a.body.build).toBe(0);
    expect(a.body.bulk).toBe(-1);
    expect(a.hairStyle).toBe('model');
    expect(a.colors.suit).toBe('#abcdef');
    expect(a.colors.skin).toBe(defaultAppearance().colors.skin);
    expect(a.colors.hair).toBe(defaultAppearance().colors.hair);
  });

  it('le hasard donne toujours une apparence valide et variée', () => {
    let n = 0;
    const lcg = (): number => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const a = randomAppearance(lcg);
      expect(normalizeAppearance(a)).toEqual(a);
      for (const k of BODY_KEYS) expect(Math.abs(a.body[k])).toBeLessThanOrEqual(0.8);
      for (const k of FACE_KEYS) expect(Math.abs(a.face[k])).toBeLessThanOrEqual(0.8);
      for (const k of COLOR_KEYS) expect(isHexColor(a.colors[k])).toBe(true);
      seen.add(encodeLook(a));
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('la forme courte (réseau) retrouve la même apparence', () => {
    const a = defaultAppearance('femme');
    a.body.height = 0.35;
    a.face.lips = -0.6;
    a.hairStyle = 'none';
    a.colors.suit = '#123456';
    const text = encodeLook(a);
    expect(text.length).toBeLessThan(150);
    expect(decodeLook(text)).toEqual(a);
  });

  it('un texte qui n’est pas une apparence est refusé', () => {
    expect(decodeLook('nimporte quoi')).toBeNull();
    expect(decodeLook(42)).toBeNull();
    expect(decodeLook('h|1,2|3|m|a,b')).toBeNull();
    expect(decodeLook('x'.repeat(400))).toBeNull();
  });

  it('les curseurs donnent des échelles autour de 1', () => {
    const base = bodyScales(defaultAppearance().body, 'homme');
    expect(Object.values(base).every((v) => v === 1)).toBe(true);
    const tall = bodyScales({ ...defaultAppearance().body, height: 1, legs: 1, bulk: 1 }, 'homme');
    expect(tall.size).toBeGreaterThan(1);
    expect(tall.legs).toBeGreaterThan(1);
    expect(tall.hips).toBeGreaterThan(1);
    const a = bodyScales({ ...defaultAppearance().body, bust: 1 }, 'femme').chest;
    const b = bodyScales({ ...defaultAppearance().body, bust: 1 }, 'homme').chest;
    expect(a).toBeGreaterThan(b);
  });
});
