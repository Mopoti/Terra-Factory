import { describe, expect, it } from 'vitest';
import { defaultWorldParams } from '../world/worldgen';
import { latestGame } from './saveIndex';

const world = defaultWorldParams('test');

describe('latestGame', () => {
  it('renvoie undefined sans partie', () => {
    expect(latestGame([])).toBeUndefined();
  });
  it('renvoie la partie sauvegardée en dernier', () => {
    const games = [
      { id: 'a', name: 'A', lastSavedAt: 100, world },
      { id: 'b', name: 'B', lastSavedAt: 300, world },
      { id: 'c', name: 'C', lastSavedAt: 200, world },
    ];
    expect(latestGame(games)?.id).toBe('b');
  });
});
