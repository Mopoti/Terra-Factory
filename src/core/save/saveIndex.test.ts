import { describe, expect, it } from 'vitest';
import { defaultWorldParams } from '../world/worldgen';
import {
  DEFAULT_PLAYER_STATE,
  ProvisionalSaveIndex,
  lastSavedAt,
  latestGame,
  latestSlot,
  normalizeGame,
  type GameSummary,
} from './saveIndex';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
const player = { ...DEFAULT_PLAYER_STATE, x: 12, z: -3 };
const world = defaultWorldParams('test');

describe('dernière partie / dernière sauvegarde', () => {
  const game = (id: string, createdAt: number, saveTimes: number[]): GameSummary => ({
    id,
    name: id,
    world,
    createdAt,
    saves: saveTimes.map((t, i) => ({
      id: `${id}-${i}`,
      name: `s${i}`,
      kind: 'manual',
      savedAt: t,
      player,
    })),
  });
  it('sans partie : rien', () => {
    expect(latestGame([])).toBeUndefined();
  });
  it('la partie la plus récemment sauvegardée est proposée', () => {
    const games = [game('a', 100, [150]), game('b', 50, [300, 120]), game('c', 400, [])];
    expect(latestGame(games)?.id).toBe('c'); // créée en dernier, jamais sauvegardée
    expect(latestGame(games.slice(0, 2))?.id).toBe('b');
  });
  it('la sauvegarde la plus récente est choisie', () => {
    const g = game('b', 50, [300, 120, 200]);
    expect(lastSavedAt(g)).toBe(300);
    expect(latestSlot(g)?.savedAt).toBe(300);
    expect(latestSlot(game('x', 1, []))).toBeUndefined();
  });
});

describe('enregistrement des sauvegardes', () => {
  it("une partie nouvelle n'a aucune sauvegarde", () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    expect(index.get(g.id)?.saves).toEqual([]);
    expect(index.get(g.id)?.world.seed).toBe('terra');
  });
  it('même nom = la sauvegarde est remplacée', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Sauvegarde', kind: 'manual', player }, 5, 1000);
    const second = index.saveSlot(
      g.id,
      { name: 'Sauvegarde', kind: 'manual', player: { ...player, x: 99 } },
      5,
      2000,
    );
    expect(second?.replaced).toBe(true);
    const saves = index.get(g.id)?.saves ?? [];
    expect(saves).toHaveLength(1);
    expect(saves[0].savedAt).toBe(2000);
    expect(saves[0].player.x).toBe(99);
  });
  it('un autre nom = une nouvelle sauvegarde à côté', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Avant le boss', kind: 'manual', player }, 5, 1000);
    const other = index.saveSlot(g.id, { name: 'Après le boss', kind: 'manual', player }, 5, 2000);
    expect(other?.replaced).toBe(false);
    expect(index.get(g.id)?.saves.map((s) => s.name)).toEqual(['Avant le boss', 'Après le boss']);
  });
  it('les sauvegardes automatiques ne remplacent pas les manuelles et sont limitées en nombre', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Sauvegarde', kind: 'manual', player }, 3, 500);
    for (let i = 1; i <= 6; i++) {
      index.saveSlot(g.id, { name: 'Auto', kind: 'auto', player }, 3, 1000 + i);
    }
    const saves = index.get(g.id)?.saves ?? [];
    expect(saves.filter((s) => s.kind === 'manual')).toHaveLength(1);
    const autos = saves.filter((s) => s.kind === 'auto');
    expect(autos).toHaveLength(3);
    expect(autos.map((s) => s.savedAt).sort()).toEqual([1004, 1005, 1006]); // les plus récentes
  });
  it('un nom identique mais de type différent ne se remplace pas', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'X', kind: 'auto', player }, 5, 1000);
    index.saveSlot(g.id, { name: 'X', kind: 'manual', player }, 5, 2000);
    expect(index.get(g.id)?.saves).toHaveLength(2);
  });
  it('garde toujours au moins une sauvegarde automatique', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Auto', kind: 'auto', player }, 0, 1000);
    expect(index.get(g.id)?.saves).toHaveLength(1);
  });
  it('partie inconnue : rien enregistré', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    expect(index.saveSlot('absent', { name: 'x', kind: 'manual', player })).toBeNull();
  });
});

describe('suppression', () => {
  it('supprime la partie demandée et ses sauvegardes, pas les autres', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const a = index.create('A', 'seed-a');
    const b = index.create('B', 'seed-b');
    index.saveSlot(a.id, { name: 'x', kind: 'manual', player }, 5, 1000);
    expect(index.deleteGame(a.id)).toBe(true);
    expect(index.list().map((g) => g.id)).toEqual([b.id]);
    expect(index.get(a.id)).toBeUndefined();
  });
  it('partie inconnue : rien ne change', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const a = index.create('A', 'seed-a');
    expect(index.deleteGame('absent')).toBe(false);
    expect(index.list()).toHaveLength(1);
    expect(index.get(a.id)).toBeDefined();
  });
  it('« Continuer » ne propose plus une partie supprimée', () => {
    const index = new ProvisionalSaveIndex(memoryStore());
    const a = index.create('A', 'seed-a');
    index.deleteGame(a.id);
    expect(latestGame(index.list())).toBeUndefined();
  });
});

describe('vue enregistrée', () => {
  it('une ancienne sauvegarde (sans vue) reprend en 3ème personne', () => {
    const [g] = normalizeGame({
      id: 'a',
      name: 'b',
      saves: [
        { id: 's', name: 'n', savedAt: 5, player: { x: 4, z: 5, yaw: 1, pitch: 1, distance: 6 } },
      ],
    });
    expect(g.saves[0].player.view).toBe('third');
    expect(g.saves[0].player.topZoom).toBe(DEFAULT_PLAYER_STATE.topZoom);
  });
  it('conserve la vue choisie et ignore une vue inconnue', () => {
    const slot = (view: unknown) => ({ id: 's', name: 'n', savedAt: 5, player: { view } });
    const [a] = normalizeGame({ id: 'a', name: 'b', saves: [slot('top')] });
    const [b] = normalizeGame({ id: 'a', name: 'b', saves: [slot('fisheye')] });
    expect(a.saves[0].player.view).toBe('top');
    expect(b.saves[0].player.view).toBe('third');
  });
});

describe('lecture des anciens formats', () => {
  it('une ancienne partie (sans sauvegardes ni seed) reste utilisable', () => {
    const [g] = normalizeGame({ id: 'old', name: 'Ancienne', lastSavedAt: 777 });
    expect(g.createdAt).toBe(777);
    expect(g.saves).toEqual([]);
    expect(g.world.seed).toBe('old');
  });
  it('ignore les données abîmées', () => {
    expect(normalizeGame(null)).toEqual([]);
    expect(normalizeGame({ id: 1 })).toEqual([]);
    const [g] = normalizeGame({
      id: 'a',
      name: 'b',
      saves: [{ id: 1 }, { id: 's', name: 'n', savedAt: 5, player: { x: 'oops' } }],
    });
    expect(g.saves).toHaveLength(1);
    expect(g.saves[0].player.x).toBe(0);
  });
});
