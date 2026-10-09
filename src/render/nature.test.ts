import { describe, expect, it } from 'vitest';
import { BUSHES_BY_BIOME, LOG, LOG_PAIR, ROCKS, TREES_BY_BIOME, parseLowpoly } from './nature';

const packFiles = import.meta.glob('../../public/models/nature/lowpoly.json', {
  eager: true,
  import: 'default',
}) as Record<string, Parameters<typeof parseLowpoly>[0]>;

describe('pack d’arbres et de rochers', () => {
  const models = parseLowpoly(Object.values(packFiles)[0]);

  it('contient les arbres de chaque biome, les rochers et les bûches', () => {
    for (const names of Object.values(TREES_BY_BIOME)) {
      expect(names.length).toBeGreaterThan(0);
      for (const n of names) expect(models.has(n), n).toBe(true);
    }
    for (const names of Object.values(BUSHES_BY_BIOME))
      for (const n of names) expect(models.has(n), n).toBe(true);
    for (const n of [...ROCKS, LOG, LOG_PAIR]) expect(models.has(n), n).toBe(true);
  });

  it('chaque modèle est cohérent : indices valides, couleurs en 0-1, arbre posé sur le sol', () => {
    for (const [name, m] of models) {
      expect(Math.max(...m.index), name).toBeLessThan(m.positions.length / 3);
      expect(
        m.colors.every((c) => c >= 0 && c <= 1),
        name,
      ).toBe(true);
      expect(m.min.y).toBeCloseTo(0, 2);
    }
    for (const n of TREES_BY_BIOME.forest) expect(models.get(n)?.size.y).toBeCloseTo(1, 2);
  });
});
