import { describe, expect, it } from 'vitest';
import { latestGame } from './saveIndex';

describe('latestGame', () => {
  it('renvoie undefined sans partie', () => {
    expect(latestGame([])).toBeUndefined();
  });
  it('renvoie la partie sauvegardée en dernier', () => {
    const games = [
      { id: 'a', name: 'A', lastSavedAt: 100 },
      { id: 'b', name: 'B', lastSavedAt: 300 },
      { id: 'c', name: 'C', lastSavedAt: 200 },
    ];
    expect(latestGame(games)?.id).toBe('b');
  });
});
