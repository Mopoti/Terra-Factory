import { describe, expect, it } from 'vitest';
import { GameState } from '../game/state';
import { crossesAtLevel, trackCellsOf, type RailKind, type RailPiece } from './track';

const piece = (kind: RailKind, gx: number, gz: number, turns: number, id = 1): RailPiece => ({
  id,
  kind,
  gx,
  gz,
  turns,
  level: 0,
});

describe('croisement à niveau', () => {
  it('un virage qui coupe une droite en travers est un croisement, pas une collision', () => {
    const line = piece('straight', 40, 40, 0, 1);
    const cells = new Set(trackCellsOf(line).map(([x, z]) => `${x},${z}`));
    let found: RailPiece | null = null;
    for (const kind of ['curve', 'curve_wide'] as const)
      for (let turns = 0; turns < 4 && !found; turns++)
        for (let dx = -30; dx <= 30 && !found; dx++)
          for (let dz = -30; dz <= 30 && !found; dz++) {
            const c = piece(kind, 40 + dx, 40 + dz, turns, 2);
            if (!trackCellsOf(c).some(([x, z]) => cells.has(`${x},${z}`))) continue;
            if (crossesAtLevel(c, line)) found = c;
          }
    expect(found).not.toBeNull();
    const s = new GameState({ inventory: { rail: 50 } });
    s.creative = true;
    expect(s.placeRail('straight', 40, 40, 0, 0, () => false)).toBe('ok');
    const f = found as RailPiece;
    expect(s.placeRail(f.kind, f.gx, f.gz, f.turns, 0, () => false)).toBe('ok');
    expect(s.changes.rails).toHaveLength(2);
  });

  it("deux droites parallèles voisines ou un virage tangent n'en sont pas", () => {
    const a = piece('straight', 40, 40, 0, 1);
    expect(crossesAtLevel(a, piece('straight', 40, 40, 0, 2))).toBe(false);
  });
});
