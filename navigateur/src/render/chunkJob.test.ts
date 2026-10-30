import { describe, expect, it } from 'vitest';
import { WorldGenerator, defaultWorldParams } from '../core/world/worldgen';
import { buildChunkMesh, startChunkMesh } from './chunkMesh';

const vertexCount = (g: { group: { children: unknown[] } }): number[] =>
  (g.group.children as { geometry: { getAttribute(n: string): { count: number } } }[]).map(
    (c) => c.geometry.getAttribute('position').count,
  );

describe('fabrication d’un chunk par étapes', () => {
  const gen = new WorldGenerator(defaultWorldParams('etapes'));
  it('par petites tranches, le résultat est celui de la fabrication d’un coup', () => {
    for (const [cx, cz] of [
      [3, 4],
      [5, 5],
    ]) {
      const data = gen.chunk(cx, cz);
      const whole = buildChunkMesh(gen, data, 0);
      const job = startChunkMesh(gen, data, 0);
      let mesh = null;
      let calls = 0;
      while (!mesh && calls < 100000) {
        mesh = job.step(0); // budget nul : une seule étape à la fois
        calls++;
      }
      expect(mesh).not.toBeNull();
      expect(vertexCount(mesh!)).toEqual(vertexCount(whole));
      expect(mesh!.blocked.length).toBe(whole.blocked.length);
      expect(mesh!.tall.length).toBe(whole.tall.length);
      expect(calls).toBeGreaterThan(1);
    }
  });
});
