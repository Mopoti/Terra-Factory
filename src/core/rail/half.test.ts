import { describe, expect, it } from 'vitest';
import {
  TrackGraph,
  freePorts,
  lengthOf,
  matesFor,
  portsOf,
  trackCellsOf,
  TILE_CELLS,
  type Port,
  type RailKind,
  type RailPiece,
} from './track';

const line = (n: number): RailPiece[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    kind: 'straight' as RailKind,
    gx: 0,
    gz: -TILE_CELLS * k,
    turns: 0,
    level: 0,
  }));

/** Poses exactes d'une pièce sur le port libre `target` (port de la pièce pile dessus). */
const exact = (kind: RailKind, target: Port, id: number): RailPiece[] =>
  matesFor(kind, target)
    .map((m) => ({ id, kind, ...m }))
    .filter((p) => portsOf(p).some((q) => Math.hypot(q.x - target.x, q.z - target.z) < 0.02));

describe('demi-virages (45°)', () => {
  it('au bout d’une ligne : un demi-virage à gauche et un à droite, qui tournent de 45°', () => {
    const pieces = line(4);
    const end = freePorts(pieces).find((p) => p.piece === 4)!;
    const opts = [...exact('curve45', end.at, 10), ...exact('curve45_b', end.at, 10)];
    expect(opts).toHaveLength(2);
    for (const p of opts) {
      const out = portsOf(p).find((q) => Math.hypot(q.x - end.at.x, q.z - end.at.z) > 0.1)!;
      expect(Math.abs(out.dx)).toBeCloseTo(Math.SQRT1_2, 3);
      expect(Math.abs(out.dz)).toBeCloseTo(Math.SQRT1_2, 3);
    }
    expect(lengthOf('curve45')).toBeCloseTo((8.75 * Math.PI) / 4, 3);
  });

  it('deux moitiés font un quart de tour, sans case commune, et un train y passe', () => {
    for (const first of ['curve45', 'curve45_b'] as const) {
      const pieces = line(4);
      const end = freePorts(pieces).find((p) => p.piece === 4)!;
      const a = exact(first, end.at, 10)[0];
      const diag = freePorts([...pieces, a]).find((p) => p.piece === 10)!;
      const other = first === 'curve45' ? 'curve45_b' : 'curve45';
      const bs = exact(other, diag.at, 11);
      expect(bs).toHaveLength(1);
      const b = bs[0];
      // Même bloc, moitiés disjointes.
      expect([b.gx, b.gz]).toEqual([a.gx, a.gz]);
      const ca = new Set(trackCellsOf(a).map(([x, z]) => `${x},${z}`));
      expect(trackCellsOf(b).some(([x, z]) => ca.has(`${x},${z}`))).toBe(false);
      // Le bout est droit (sur la grille) : une tuile droite s'y raccorde, et un train va de la ligne jusqu'à elle.
      const out = freePorts([...pieces, a, b]).find((p) => p.piece === 11)!;
      expect(Math.abs(out.at.dx) + Math.abs(out.at.dz)).toBeCloseTo(1, 3);
      const after = exact('straight', out.at, 12)[0];
      const g = new TrackGraph([...pieces, a, b, after]);
      const run = g.advance({ piece: 1, u: 0, dir: 1 }, 10 + 2 * lengthOf('curve45') + 1);
      expect(run.blocked).toBe(false);
      expect(run.pos.piece).toBe(12);
    }
  });
});
