import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTIPLAYER } from '../save/saveIndex';
import {
  CREDIT_KEYS,
  PLAYER_KEYS,
  RESEARCH_KEYS,
  mergeChanges,
  perPlayerKeys,
  splitChanges,
} from './playerData';
import { GameState } from './state';

describe('joueur et monde', () => {
  const sample = (): GameState => {
    const s = new GameState({ inventory: { wood: 3 } });
    s.changes.hotbar[0] = 'tool_stone';
    s.changes.credits = 77;
    s.changes.unlocked.push('logistics');
    s.changes.time = 123;
    s.changes.tutorialDone.push('move');
    return s;
  };

  it('séparer puis recoller redonne exactement les mêmes changements', () => {
    const { changes } = sample();
    const { world, player } = splitChanges(changes);
    expect(Object.keys(player).sort()).toEqual([...PLAYER_KEYS].sort());
    for (const key of PLAYER_KEYS) expect(key in world).toBe(false);
    expect(world.time).toBe(123);
    expect(mergeChanges(world as typeof changes, player)).toEqual(changes);
  });

  it('technologies et crédits ne deviennent individuels que si le partage est désactivé', () => {
    expect(perPlayerKeys(DEFAULT_MULTIPLAYER.share)).toEqual([...PLAYER_KEYS]);
    const solo = perPlayerKeys({ research: false, credits: false, inventory: true });
    for (const key of [...RESEARCH_KEYS, ...CREDIT_KEYS]) expect(solo).toContain(key);
    const { world, player } = splitChanges(sample().changes, solo);
    expect(player.credits).toBe(77);
    expect(player.unlocked).toContain('logistics');
    expect('credits' in world).toBe(false);
  });

  it('aucun champ n’est à la fois du joueur et du monde', () => {
    const all = [...PLAYER_KEYS, ...RESEARCH_KEYS, ...CREDIT_KEYS];
    expect(new Set(all).size).toBe(all.length);
  });
});
