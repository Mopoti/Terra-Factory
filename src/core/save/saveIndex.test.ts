import { DEFAULT_TIME } from '../game/seasons';
import { describe, expect, it } from 'vitest';
import { GameState } from '../game/state';
import { SaveLibrary } from './library';
import { MemoryStorage } from './storage';
import { emptyChanges } from '../game/worldChanges';
import { defaultWorldParams } from '../world/worldgen';
import {
  DEFAULT_GAME_OPTIONS,
  DEFAULT_PLAYER_STATE,
  lastSavedAt,
  latestGame,
  latestSlot,
  normalizeGame,
  type GameSummary,
} from './saveIndex';

const player = { ...DEFAULT_PLAYER_STATE, x: 12, z: -3 };
const world = defaultWorldParams('test');

describe('dernière partie / dernière sauvegarde', () => {
  const game = (id: string, createdAt: number, saveTimes: number[]): GameSummary => ({
    id,
    name: id,
    world,
    options: DEFAULT_GAME_OPTIONS,
    createdAt,
    saves: saveTimes.map((t, i) => ({
      id: `${id}-${i}`,
      name: `s${i}`,
      kind: 'manual',
      savedAt: t,
      player,
      inventory: {},
      changes: emptyChanges(),
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
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    expect(index.get(g.id)?.saves).toEqual([]);
    expect(index.get(g.id)?.world.seed).toBe('terra');
  });
  it('même nom = la sauvegarde est remplacée', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
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
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Avant le boss', kind: 'manual', player }, 5, 1000);
    const other = index.saveSlot(g.id, { name: 'Après le boss', kind: 'manual', player }, 5, 2000);
    expect(other?.replaced).toBe(false);
    expect(index.get(g.id)?.saves.map((s) => s.name)).toEqual(['Avant le boss', 'Après le boss']);
  });
  it('les sauvegardes automatiques ne remplacent pas les manuelles et sont limitées en nombre', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
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
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'X', kind: 'auto', player }, 5, 1000);
    index.saveSlot(g.id, { name: 'X', kind: 'manual', player }, 5, 2000);
    expect(index.get(g.id)?.saves).toHaveLength(2);
  });
  it('garde toujours au moins une sauvegarde automatique', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'Auto', kind: 'auto', player }, 0, 1000);
    expect(index.get(g.id)?.saves).toHaveLength(1);
  });
  it('partie inconnue : rien enregistré', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    expect(index.saveSlot('absent', { name: 'x', kind: 'manual', player })).toBeNull();
  });
});

describe('suppression', () => {
  it('supprime la partie demandée et ses sauvegardes, pas les autres', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const a = index.create('A', 'seed-a');
    const b = index.create('B', 'seed-b');
    index.saveSlot(a.id, { name: 'x', kind: 'manual', player }, 5, 1000);
    expect(index.deleteGame(a.id)).toBe(true);
    expect(index.list().map((g) => g.id)).toEqual([b.id]);
    expect(index.get(a.id)).toBeUndefined();
  });
  it('partie inconnue : rien ne change', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const a = index.create('A', 'seed-a');
    expect(index.deleteGame('absent')).toBe(false);
    expect(index.list()).toHaveLength(1);
    expect(index.get(a.id)).toBeDefined();
  });
  it('« Continuer » ne propose plus une partie supprimée', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
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

describe('options et réglages de la partie', () => {
  it('sont enregistrés avec la partie', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra', {
      families: {
        ...defaultWorldParams('x').families,
        ores: { frequency: 2, size: 1.5, density: 0.5 },
      },
      options: {
        enemies: { aggressive: true, expand: false },
        realism: 'realistic',
        tutorial: false,
        time: DEFAULT_TIME,
      },
    });
    const back = index.get(g.id);
    expect(back?.world.families.ores).toEqual({ frequency: 2, size: 1.5, density: 0.5 });
    expect(back?.world.families.forests).toEqual({ frequency: 1, size: 1, density: 1 });
    expect(back?.options).toEqual({
      enemies: { aggressive: true, expand: false },
      realism: 'realistic',
      tutorial: false,
      time: DEFAULT_TIME,
    });
  });
  it('par défaut : ennemis non agressifs mais qui s’étendent, physique équilibrée', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    expect(g.options).toEqual({
      enemies: { aggressive: false, expand: true },
      realism: 'balanced',
      tutorial: true,
      time: DEFAULT_TIME,
    });
  });
  it('les multiplicateurs hors limites ou invalides sont ramenés dans ×0,25 – ×3', () => {
    const [g] = normalizeGame({
      id: 'a',
      name: 'b',
      world: { seed: 's', families: { ores: { frequency: 99, size: -4, density: 'oops' } } },
      options: { realism: 'ultra', enemies: { aggressive: 'oui' } },
    });
    expect(g.world.families.ores).toEqual({ frequency: 3, size: 0.25, density: 1 });
    expect(g.options.realism).toBe('balanced');
    expect(g.options.enemies).toEqual({ aggressive: false, expand: true });
  });
  it('une ancienne partie reçoit les options par défaut', () => {
    const [g] = normalizeGame({ id: 'old', name: 'Ancienne' });
    expect(g.options).toEqual({ ...DEFAULT_GAME_OPTIONS, tutorial: false });
  });
});

describe('sac et changements du monde dans les sauvegardes', () => {
  it('une sauvegarde retient le sac et les ressources récoltées', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    const state = new GameState();
    state.harvest('4,6', 4, 'wood', 3);
    state.drop('wood', 1, 2, 2);
    index.saveSlot(g.id, { name: 'S', kind: 'manual', player, ...state.snapshot() }, 5, 1000);
    const slot = index.get(g.id)?.saves[0];
    expect(slot?.inventory).toEqual({ wood: 2 });
    expect(slot?.changes.taken['4,6']).toBe(3);
    expect(slot?.changes.drops).toHaveLength(1);
  });
  it('remplacer une sauvegarde remplace aussi son contenu', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(g.id, { name: 'S', kind: 'manual', player, inventory: { wood: 5 } }, 5, 1000);
    index.saveSlot(g.id, { name: 'S', kind: 'manual', player, inventory: { coal: 2 } }, 5, 2000);
    const saves = index.get(g.id)?.saves ?? [];
    expect(saves).toHaveLength(1);
    expect(saves[0].inventory).toEqual({ coal: 2 });
  });
  it('deux sauvegardes d’une même partie gardent chacune leur propre état', () => {
    const index = SaveLibrary.empty(new MemoryStorage());
    const g = index.create('Ma base', 'terra');
    index.saveSlot(
      g.id,
      { name: 'Avant', kind: 'manual', player, inventory: { wood: 1 } },
      5,
      1000,
    );
    index.saveSlot(
      g.id,
      { name: 'Après', kind: 'manual', player, inventory: { wood: 9 } },
      5,
      2000,
    );
    const byName = Object.fromEntries(
      (index.get(g.id)?.saves ?? []).map((s) => [s.name, s.inventory.wood]),
    );
    expect(byName).toEqual({ Avant: 1, Après: 9 });
  });
  it('une ancienne sauvegarde (sans sac) reprend avec un sac vide et un monde intact', () => {
    const [g] = normalizeGame({ id: 'a', name: 'b', saves: [{ id: 's', name: 'n', savedAt: 5 }] });
    expect(g.saves[0].inventory).toEqual({});
    expect(g.saves[0].changes.taken).toEqual({});
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
