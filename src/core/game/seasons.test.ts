import { describe, expect, it } from 'vitest';
import { SEASON_LENGTH_S, seasonAt } from './seasons';

describe('saisons', () => {
  it('tournent printemps, été, automne, hiver, puis une nouvelle année', () => {
    expect(seasonAt(0).season.id).toBe('spring');
    expect(seasonAt(SEASON_LENGTH_S + 1).season.id).toBe('summer');
    expect(seasonAt(SEASON_LENGTH_S * 2 + 1).season.id).toBe('autumn');
    expect(seasonAt(SEASON_LENGTH_S * 3 + 1).season.id).toBe('winter');
    const next = seasonAt(SEASON_LENGTH_S * 4 + 61);
    expect(next.season.id).toBe('spring');
    expect(next.year).toBe(2);
    expect(next.day).toBe(2);
  });
  it('les arbres absorbent moins l’hiver', () => {
    expect(seasonAt(SEASON_LENGTH_S * 3).season.treeAbsorb).toBeLessThan(
      seasonAt(SEASON_LENGTH_S).season.treeAbsorb,
    );
  });
});
