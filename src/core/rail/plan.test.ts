import { describe, expect, it } from 'vitest';
import { leadTile, planRails, tileOf, type PlannedPiece, type Tile } from './plan';
import { TrackGraph, portsOf, type RailPiece } from './track';

const tilesOf = (...pts: [number, number][]): Tile[] => pts.map(([tx, tz]) => ({ tx, tz }));
/** Tuiles en ligne droite de (x, z) par pas (dx, dz). */
const line = (x: number, z: number, dx: number, dz: number, n: number): Tile[] =>
  Array.from({ length: n }, (_, i) => ({ tx: x + dx * i, tz: z + dz * i }));

const asPieces = (planned: PlannedPiece[]): RailPiece[] =>
  planned.map((p, i) => ({
    id: i + 1,
    kind: p.kind,
    gx: p.gx,
    gz: p.gz,
    turns: p.turns,
    level: p.level,
  }));

/** Nombre de raccords entre pièces : une voie continue de n pièces en a n − 1. */
const links = (pieces: RailPiece[]): number => {
  const g = new TrackGraph(pieces);
  let n = 0;
  for (const p of pieces) for (const port of [0, 1] as const) if (g.neighbour(p.id, port)) n++;
  return n / 2;
};

describe('tracé de la voie', () => {
  it('des tuiles en ligne donnent des tuiles droites raccordées, dans les quatre sens', () => {
    for (const [dx, dz] of [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
    ]) {
      const plan = planRails(line(3, 3, dx, dz, 6), { level: 0, tilt: 0, lead: 0 });
      expect(plan).toHaveLength(6);
      expect(plan.every((p) => p.kind === 'straight')).toBe(true);
      expect(links(asPieces(plan))).toBe(5);
    }
  });

  it('un coin devient un virage de 3 × 3 tuiles, raccordé aux deux lignes, dans les huit cas', () => {
    const dirs: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const a of dirs)
      for (const b of dirs) {
        if (a[0] * b[0] + a[1] * b[1] !== 0) continue;
        const first = line(10, 10, a[0], a[1], 5); // coin au dernier
        const corner = first[first.length - 1];
        const second = line(corner.tx + b[0], corner.tz + b[1], b[0], b[1], 5);
        const plan = planRails([...first, ...second], { level: 0, tilt: 0, lead: 0 });
        const curves = plan.filter((p) => p.kind === 'curve');
        expect(curves).toHaveLength(1);
        // Les tuiles avant et après le virage sont des tuiles droites ; tout se raccorde.
        expect(plan).toHaveLength(3 + 1 + 4);
        expect(links(asPieces(plan))).toBe(plan.length - 1);
      }
  });

  it('deux coins trop rapprochés : le tracé est coupé au second', () => {
    const t = tilesOf(
      [0, 0],
      [0, -1],
      [0, -2],
      [0, -3],
      [0, -4],
      [1, -4],
      [1, -5],
      [1, -6],
      [1, -7],
    );
    // Coin en (0,-4) puis coin en (1,-4) : trop près.
    const plan = planRails(t, { level: 0, tilt: 0, lead: 0 });
    expect(plan.filter((p) => p.kind === 'curve')).toHaveLength(1);
    expect(plan.length).toBeLessThan(6);
  });

  it('S : deux virages qui se touchent restent raccordés', () => {
    const t = [
      ...line(0, 0, 0, -1, 4), // (0,0)…(0,-3)
      ...tilesOf([1, -3], [2, -3], [3, -3], [3, -4], [3, -5], [3, -6]),
    ];
    // Coins en (0,-3) et (3,-3) : écart de 3 tuiles.
    const plan = planRails(t, { level: 0, tilt: 0, lead: 0 });
    expect(plan.filter((p) => p.kind === 'curve')).toHaveLength(2);
    expect(links(asPieces(plan))).toBe(plan.length - 1);
  });

  it('une rampe en tête de tracé monte d’un mètre et la voie continue à la hauteur d’arrivée', () => {
    const plan = planRails(line(5, 5, 0, -1, 9), { level: 0, tilt: 1, lead: 0 });
    expect(plan[0].kind).toBe('ramp');
    expect(plan[0].level).toBe(0);
    expect(plan.slice(1).every((p) => p.kind === 'straight' && p.level === 1)).toBe(true);
    expect(plan).toHaveLength(1 + 5);
    const pieces = asPieces(plan);
    expect(links(pieces)).toBe(pieces.length - 1);
    // Dans la descente c'est l'inverse : la rampe est plus bas que le départ.
    const down = planRails(line(5, 5, 1, 0, 9), { level: 1, tilt: -1, lead: 0 });
    expect(down[0].level).toBe(0);
    expect(down[1].level).toBe(0);
    expect(links(asPieces(down))).toBe(down.length - 1);
  });

  it('rampe trop courte ou suivie trop vite d’un virage : rien n’est posé', () => {
    expect(planRails(line(0, 0, 0, -1, 3), { level: 0, tilt: 1, lead: 0 })).toEqual([]);
    const t = [...line(0, 0, 0, -1, 5), ...line(1, -4, 1, 0, 4)]; // coin au 5e tuile, juste après la rampe
    const plan = planRails(t, { level: 0, tilt: 1, lead: 0 });
    expect(plan.filter((p) => p.kind === 'curve')).toHaveLength(0);
  });

  it('on prolonge une voie existante : la première tuile est celle du bout, rien n’y est posé', () => {
    const first = planRails(line(0, 0, 0, -1, 5), { level: 0, tilt: 0, lead: 0 });
    const existing = asPieces(first);
    // Le bout libre de la dernière tuile (id 5) est son port 1 : tournée vers −z.
    const end = portsOf(existing[4])[1];
    const lead = leadTile(end);
    expect(lead).toEqual({ tx: 0, tz: -4 });
    const more = planRails([lead, ...line(0, -5, 0, -1, 3)], { level: 0, tilt: 0, lead: 1 });
    expect(more).toHaveLength(3);
    const all = asPieces([...first, ...more]).map((p, i) => ({ ...p, id: i + 1 }));
    expect(links(all)).toBe(all.length - 1);
  });

  it('on peut prolonger une voie juste après un virage, dans les quatre sens', () => {
    const dirs: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const a of dirs)
      for (const b of dirs) {
        if (a[0] * b[0] + a[1] * b[1] !== 0) continue;
        const first = line(10, 10, a[0], a[1], 4);
        const corner = first[first.length - 1];
        const base = planRails(
          [...first, ...line(corner.tx + b[0], corner.tz + b[1], b[0], b[1], 2)],
          {
            level: 0,
            tilt: 0,
            lead: 0,
          },
        );
        const pieces = asPieces(base);
        const g = new TrackGraph(pieces);
        // Le bout libre qui regarde dans la direction b.
        const open = pieces
          .flatMap((p) =>
            ([0, 1] as const).map((i) => ({
              p,
              port: portsOf(p)[i],
              linked: g.neighbour(p.id, i),
            })),
          )
          .filter(
            (x) => !x.linked && Math.round(x.port.dx) === b[0] && Math.round(x.port.dz) === b[1],
          );
        expect(open).toHaveLength(1);
        const lead = leadTile(open[0].port);
        const more = planRails([lead, ...line(lead.tx + b[0], lead.tz + b[1], b[0], b[1], 3)], {
          level: 0,
          tilt: 0,
          lead: 1,
        });
        expect(more).toHaveLength(3);
        const all = asPieces([...base, ...more]);
        expect(links(all)).toBe(all.length - 1);
      }
  });

  it('tileOf : la tuile qui contient un point', () => {
    expect(tileOf(3.4, -0.2)).toEqual({ tx: 3, tz: -1 });
  });
});
