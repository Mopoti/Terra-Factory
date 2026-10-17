import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../core/data/resources';
import { ORE_FILE_NAMES, registerModel, type BakedModel } from './models';
import {
  BUSHES_BY_BIOME,
  LOG,
  LOG_PAIR,
  ROCKS,
  TREES_BY_BIOME,
  oreClumpModels,
  parseLowpoly,
  rockModelsFor,
} from './nature';

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

describe('rochers et amas de minerai maison', () => {
  const cube = (sx: number, sy: number, sz: number): BakedModel => ({
    positions: new Float32Array([0, 0, 0, sx, 0, 0, sx, sy, sz, 0, sy, sz]),
    normals: new Float32Array(12),
    colors: new Float32Array(12).fill(0.5),
    index: new Uint32Array([0, 1, 2, 0, 2, 3]),
    min: { x: 0, y: 0, z: 0 },
    size: { x: sx, y: sy, z: sz },
  });

  it('nomme un amas pour chaque gisement solide ou liquide', () => {
    for (const r of RESOURCES.filter((x) => x.kind === 'deposit'))
      expect(ORE_FILE_NAMES[r.id], r.id).toBeTruthy();
  });

  it('ramène un rocher maison à 1 m de large, centré et posé au sol', () => {
    registerModel('rocher_desert_1', cube(2, 1.5, 1));
    const [m] = rockModelsFor('desert');
    expect(m.size.x).toBeCloseTo(1);
    expect(m.size.y).toBeCloseTo(0.75);
    expect(m.min.x).toBeCloseTo(-0.5);
    expect(Math.min(...m.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0);
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 0))).toBeCloseTo(0.5);
  });

  it('donne les amas d’un gisement, rien pour une ressource sans amas', () => {
    registerModel('minerai_charbon_2', cube(0.4, 0.1, 0.4));
    expect(oreClumpModels('coal')).toHaveLength(1);
    expect(oreClumpModels('tree')).toHaveLength(0);
  });
});
