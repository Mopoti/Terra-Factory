import { describe, expect, it } from 'vitest';
import {
  TrackGraph,
  branchId,
  freePorts,
  lengthOf,
  matesFor,
  portsOf,
  radiusOf,
  TILE_CELLS,
  type Port,
  type RailKind,
  type RailPiece,
} from './track';
import { normalizeRails, normalizeTrains } from './normalize';

/** Une voie droite de `n` tuiles le long de z (on avance vers −z en allant vers le port 1). */
const line = (n: number): RailPiece[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    kind: 'straight' as RailKind,
    gx: 0,
    gz: -TILE_CELLS * k,
    turns: 0,
    level: 0,
  }));

const near = (a: Port, b: Port): boolean => Math.hypot(a.x - b.x, a.z - b.z) < 0.05;

/** Pièce de ce type dont le port `i` se raccorde au port libre `target`. */
function attach(kind: RailKind, target: Port, i: number, id: number): RailPiece {
  for (const m of matesFor(kind, target)) {
    const p: RailPiece = { id, kind, ...m };
    // Une tuile droite est symétrique : n'importe lequel de ses ports convient.
    if (kind === 'straight' ? portsOf(p).some((q) => near(q, target)) : near(portsOf(p)[i], target))
      return p;
  }
  throw new Error(`pas de pose pour ${kind}`);
}

/** Ligne de 10 tuiles, aiguillage (pointe au bout de la ligne), une tuile droite après chacune de ses deux voies. */
function setup(
  kind: 'switch_r' | 'switch_l' = 'switch_r',
  branch: 0 | 1 = 0,
): {
  pieces: RailPiece[];
  sw: RailPiece;
  straightAfter: RailPiece;
  branchAfter: RailPiece;
} {
  const pieces = line(10);
  const end = freePorts(pieces).find((p) => p.piece === 10)!;
  const sw = { ...attach(kind, end.at, 0, 50), branch };
  const ports = portsOf(sw);
  expect(ports).toHaveLength(3);
  const straightAfter = attach('straight', ports[1], 0, 60);
  const branchAfter = attach('straight', ports[2], 0, 61);
  return { pieces: [...pieces, sw, straightAfter, branchAfter], sw, straightAfter, branchAfter };
}

describe('aiguillages', () => {
  it('trois ports : la voie directe continue tout droit, la voie déviée tourne du bon côté', () => {
    for (const kind of ['switch_r', 'switch_l'] as const) {
      const { sw } = setup(kind);
      const [p0, p1, p2] = portsOf(sw);
      // On arrive par −z : la voie directe continue vers −z, la déviée part vers +x (droite) ou −x (gauche).
      expect(p1.dz).toBeCloseTo(-1);
      expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeCloseTo(2 * radiusOf(kind));
      expect(p2.dx).toBeCloseTo(kind === 'switch_r' ? 1 : -1);
    }
  });

  it('un train qui prend la pointe suit la voie donnée par l’aiguillage', () => {
    for (const branch of [0, 1] as const) {
      const { pieces, sw, straightAfter, branchAfter } = setup('switch_r', branch);
      const g = new TrackGraph(pieces);
      const start = { piece: 9, u: 0, dir: 1 as const };
      const len = lengthOf('straight') * 2 + lengthOf(sw.kind, branch) + 1;
      const at = g.advance(start, len).pos;
      expect(at.piece).toBe(branch === 0 ? straightAfter.id : branchAfter.id);
      // Sur l'aiguillage même : la voie directe (son identifiant) ou la déviée (l'opposé).
      const mid = g.advance(start, lengthOf('straight') * 2 + 1).pos;
      expect(mid.piece).toBe(branch === 0 ? sw.id : branchId(sw.id));
    }
  });

  it('en venant du talon, on passe quelle que soit la position (sans dérailler)', () => {
    const { pieces, branchAfter } = setup('switch_r', 0);
    const g = new TrackGraph(pieces);
    // Sur la tuile après la voie déviée, en marchant vers l'aiguillage.
    const ports = portsOf(branchAfter);
    const towardSwitch = g.neighbour(branchAfter.id, 0) ? -1 : 1;
    expect(ports).toHaveLength(2);
    const at = g.advance({ piece: branchAfter.id, u: 1, dir: towardSwitch as 1 | -1 }, 12);
    expect(at.blocked).toBe(false);
    expect(at.pos.piece).toBeGreaterThanOrEqual(1);
    expect(at.pos.piece).toBeLessThanOrEqual(10);
  });

  it('les ports libres d’une voie avec aiguillage : les deux bouts des voies et le début de la ligne', () => {
    const { pieces } = setup();
    expect(freePorts(pieces)).toHaveLength(3);
  });

  it('on trouve l’aiguillage devant le train, pas celui qu’on prend par le talon', () => {
    const { pieces, sw, branchAfter } = setup();
    const g = new TrackGraph(pieces);
    expect(g.switchAhead({ piece: 1, u: 0, dir: 1 }, 60)).toBe(sw.id);
    expect(g.switchAhead({ piece: 1, u: 0, dir: 1 }, 5)).toBeNull();
    const back = g.neighbour(branchAfter.id, 0) ? -1 : 1;
    expect(g.switchAhead({ piece: branchAfter.id, u: 1, dir: back as 1 | -1 }, 60)).toBeNull();
  });

  it('la position de l’aiguillage et un train sur sa voie déviée sont gardés à l’enregistrement', () => {
    const { pieces, sw } = setup('switch_l', 1);
    const rails = normalizeRails(JSON.parse(JSON.stringify(pieces)));
    expect(rails.find((p) => p.id === sw.id)?.branch).toBe(1);
    const trains = normalizeTrains(
      [
        {
          id: 1,
          head: { piece: branchId(sw.id), u: 2, dir: 1 },
          v: 0,
          cars: [{ id: 1, kind: 'wagon_freight', rev: false, heatKJ: 0, fuel: null }],
        },
      ],
      rails,
    );
    expect(trains[0].head.piece).toBe(branchId(sw.id));
  });
});
