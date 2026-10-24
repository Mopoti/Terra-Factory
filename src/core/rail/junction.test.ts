import { describe, expect, it } from 'vitest';
import { normalizeRails, normalizeTrains } from './normalize';
import { TILE_CELLS, TrackGraph, lengthOf, type RailKind, type RailPiece } from './track';

const straight = (id: number, k: number): RailPiece => ({
  id,
  kind: 'straight' as RailKind,
  gx: 0,
  gz: -TILE_CELLS * k,
  turns: 0,
  level: 0,
});

describe('anciens aiguillages', () => {
  const legacy = [
    straight(1, 0),
    { id: 7, kind: 'switch_r', gx: -5, gz: -TILE_CELLS * 4 - 5, turns: 0, level: 0, branch: 1 },
  ];

  it('deviennent trois tuiles droites sur la voie directe, continues avec la ligne', () => {
    const rails = normalizeRails(JSON.parse(JSON.stringify(legacy)));
    expect(rails.filter((p) => p.kind === 'straight')).toHaveLength(4);
    expect(rails.every((p) => p.kind === 'straight')).toBe(true);
    expect(new Set(rails.map((p) => p.id)).size).toBe(rails.length);
    expect(rails.some((p) => p.id === 7)).toBe(true);
  });

  it('un train sur la voie déviée disparaît, un train sur la voie directe reste', () => {
    const rails = normalizeRails(JSON.parse(JSON.stringify(legacy)));
    const car = { id: 1, kind: 'wagon_freight', rev: false, heatKJ: 0, fuel: null };
    const trains = normalizeTrains(
      [
        { id: 1, head: { piece: -7, u: 2, dir: 1 }, v: 0, cars: [car] },
        { id: 2, head: { piece: 7, u: 1, dir: 1 }, v: 0, cars: [{ ...car, id: 2 }] },
      ],
      rails,
    );
    expect(trains.map((c) => c.id)).toEqual([2]);
    expect(trains[0].head.u).toBeLessThanOrEqual(lengthOf('straight'));
  });

  it('un graphe de lignes droites reste continu sans embranchement', () => {
    const g = new TrackGraph(Array.from({ length: 5 }, (_, k) => straight(k + 1, k)));
    expect(g.choiceAhead({ piece: 1, u: 0, dir: 1 }, 60)).toBeNull();
  });
});
