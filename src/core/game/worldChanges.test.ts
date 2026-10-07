import { describe, expect, it } from 'vitest';
import type { ChunkData } from '../world/worldgen';
import { NEST_HP, applyChanges, cellKey, emptyChanges, normalizeChanges } from './worldChanges';

const chunkWithNest = (): ChunkData =>
  ({
    objects: [{ id: 'nest', gx: 4, gz: 6, cells: 4, scale: 1, rotation: 0, amount: 0 }],
    ore: [],
    water: [],
  }) as unknown as ChunkData;

describe('nids détruits et mode débogage', () => {
  it('un nid disparaît quand il a reçu tous ses points de dégâts', () => {
    const changes = emptyChanges();
    changes.taken[cellKey(4, 6)] = NEST_HP - 1;
    expect(applyChanges(chunkWithNest(), changes).objects).toHaveLength(1);
    changes.taken[cellKey(4, 6)] = NEST_HP;
    expect(applyChanges(chunkWithNest(), changes).objects).toHaveLength(0);
  });

  it('le drapeau « admin » (débogage utilisé) est enregistré', () => {
    expect(normalizeChanges({}).admin).toBe(false);
    expect(normalizeChanges({ admin: true }).admin).toBe(true);
  });
});
