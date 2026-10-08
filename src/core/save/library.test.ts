import { DEFAULT_TIME } from '../game/seasons';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SaveLibrary } from './library';
import { DEFAULT_PLAYER_STATE } from './saveIndex';
import { IndexedDbStorage, LocalStorageStorage, MemoryStorage, LEGACY_KEY } from './storage';

const player = { ...DEFAULT_PLAYER_STATE, x: 3 };
const memory = (): SaveLibrary => SaveLibrary.empty(new MemoryStorage());

describe('stockage IndexedDB', () => {
  it('une partie survit à la fermeture et à la réouverture', async () => {
    const factory = new IDBFactory();
    const lib = SaveLibrary.empty(await IndexedDbStorage.open(factory));
    const g = lib.create('Ma base', 'terra');
    lib.saveSlot(g.id, { name: 'Départ', kind: 'manual', player, inventory: { wood: 3 } }, 5, 1000);
    await lib.flush();
    const reopened = await SaveLibrary.open(await IndexedDbStorage.open(factory));
    expect(reopened.list()).toHaveLength(1);
    expect(reopened.list()[0].name).toBe('Ma base');
    expect(reopened.list()[0].saves[0].inventory).toEqual({ wood: 3 });
  });
  it('suppression, renommage et copie sont aussi conservés', async () => {
    const factory = new IDBFactory();
    const lib = SaveLibrary.empty(await IndexedDbStorage.open(factory));
    const a = lib.create('A', 's1');
    const b = lib.create('B', 's2');
    lib.renameGame(a.id, 'Alpha');
    lib.duplicateGame(a.id, 'Alpha (copie)');
    lib.deleteGame(b.id);
    await lib.flush();
    const names = (await SaveLibrary.open(await IndexedDbStorage.open(factory)))
      .list()
      .map((g) => g.name)
      .sort();
    expect(names).toEqual(['Alpha', 'Alpha (copie)']);
  });
  it('les écritures se font dans l’ordre', async () => {
    const factory = new IDBFactory();
    const lib = SaveLibrary.empty(await IndexedDbStorage.open(factory));
    const g = lib.create('X', 's');
    for (let i = 0; i < 20; i++) lib.renameGame(g.id, `Nom ${i}`);
    await lib.flush();
    const back = await SaveLibrary.open(await IndexedDbStorage.open(factory));
    expect(back.list()[0].name).toBe('Nom 19');
    expect(lib.failedWrites).toBe(0);
  });
});

describe('reprise de l’ancien stockage', () => {
  function legacyStore(games: unknown[]): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
    const data = new Map<string, string>([[LEGACY_KEY, JSON.stringify(games)]]);
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }
  it('les parties de l’ancien stockage sont reprises, puis retirées de l’ancien', async () => {
    const old = legacyStore([
      { id: 'old-1', name: 'Ancienne', lastSavedAt: 5, world: { seed: 's' } },
      { id: 'old-2', name: 'Autre', createdAt: 9, world: { seed: 't' } },
    ]);
    const idb = await IndexedDbStorage.open(new IDBFactory());
    const lib = await SaveLibrary.open(idb, new LocalStorageStorage(old));
    expect(lib.migratedCount).toBe(2);
    expect(
      lib
        .list()
        .map((g) => g.id)
        .sort(),
    ).toEqual(['old-1', 'old-2']);
    expect(old.getItem(LEGACY_KEY)).toBeNull();
    expect((await idb.loadAll()).length).toBe(2);
  });
  it('ne reprend pas deux fois une partie déjà présente', async () => {
    const idb = new MemoryStorage();
    const existing = SaveLibrary.empty(idb);
    existing.create('Déjà là', 'seed');
    await existing.flush();
    const id = existing.list()[0].id;
    const old = legacyStore([{ id, name: 'Doublon', world: { seed: 'x' } }]);
    const lib = await SaveLibrary.open(idb, new LocalStorageStorage(old));
    expect(lib.migratedCount).toBe(0);
    expect(lib.list()).toHaveLength(1);
    expect(lib.list()[0].name).toBe('Déjà là');
  });
});

describe('gérer les sauvegardes', () => {
  it('supprime une seule sauvegarde, pas les autres', () => {
    const lib = memory();
    const g = lib.create('A', 's');
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player }, 5, 1);
    lib.saveSlot(g.id, { name: 'deux', kind: 'manual', player }, 5, 2);
    const first = lib.get(g.id)!.saves[0];
    expect(lib.deleteSlot(g.id, first.id)).toBe(true);
    expect(lib.get(g.id)!.saves.map((s) => s.name)).toEqual(['deux']);
    expect(lib.deleteSlot(g.id, 'absent')).toBe(false);
  });
  it('renomme une sauvegarde manuelle', () => {
    const lib = memory();
    const g = lib.create('A', 's');
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player }, 5, 1);
    const slot = lib.get(g.id)!.saves[0];
    expect(lib.renameSlot(g.id, slot.id, '  Avant le boss  ')).toBe('ok');
    expect(lib.get(g.id)!.saves[0].name).toBe('Avant le boss');
  });
  it('refuse un nom vide, un nom déjà pris, ou de renommer une sauvegarde auto', () => {
    const lib = memory();
    const g = lib.create('A', 's');
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player }, 5, 1);
    lib.saveSlot(g.id, { name: 'deux', kind: 'manual', player }, 5, 2);
    lib.saveSlot(g.id, { name: 'Auto', kind: 'auto', player }, 5, 3);
    const [one, , auto] = lib.get(g.id)!.saves;
    expect(lib.renameSlot(g.id, one.id, '   ')).toBe('empty');
    expect(lib.renameSlot(g.id, one.id, 'deux')).toBe('duplicate');
    expect(lib.renameSlot(g.id, auto.id, 'Mon auto')).toBe('auto');
    expect(lib.renameSlot(g.id, 'absent', 'x')).toBe('missing');
    expect(lib.get(g.id)!.saves[0].name).toBe('un'); // rien n'a changé
  });
  it('renommer une sauvegarde en gardant son propre nom est accepté', () => {
    const lib = memory();
    const g = lib.create('A', 's');
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player }, 5, 1);
    expect(lib.renameSlot(g.id, lib.get(g.id)!.saves[0].id, 'un')).toBe('ok');
  });
  it('les noms sont limités à 40 caractères', () => {
    const lib = memory();
    const g = lib.create('x'.repeat(100), 's');
    expect(g.name).toHaveLength(40);
    lib.renameGame(g.id, 'y'.repeat(100));
    expect(lib.get(g.id)!.name).toHaveLength(40);
    expect(lib.renameGame(g.id, '  ')).toBe('empty');
  });
  it('duplique une sauvegarde sous un nom libre', () => {
    const lib = memory();
    const g = lib.create('A', 's');
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player, inventory: { coal: 4 } }, 5, 1);
    const slot = lib.get(g.id)!.saves[0];
    const copy = lib.duplicateSlot(g.id, slot.id, 'un (copie)', 50)!;
    const copy2 = lib.duplicateSlot(g.id, slot.id, 'un (copie)', 60)!;
    expect(copy.name).toBe('un (copie)');
    expect(copy2.name).toBe('un (copie) 2');
    expect(copy.inventory).toEqual({ coal: 4 });
    expect(copy.id).not.toBe(slot.id);
    expect(lib.get(g.id)!.saves).toHaveLength(3);
    copy.inventory.coal = 99; // la copie est indépendante
    expect(slot.inventory.coal).toBe(4);
  });
  it('duplique une partie avec toutes ses sauvegardes, indépendamment de l’originale', () => {
    const lib = memory();
    const g = lib.create('A', 'seed-a', {
      options: {
        enemies: { aggressive: true, expand: false },
        realism: 'realistic',
        tutorial: false,
        time: DEFAULT_TIME,
      },
    });
    lib.saveSlot(g.id, { name: 'un', kind: 'manual', player, inventory: { wood: 2 } }, 5, 1);
    const copy = lib.duplicateGame(g.id, 'A (copie)')!;
    expect(copy.id).not.toBe(g.id);
    expect(copy.world.seed).toBe('seed-a');
    expect(copy.options.realism).toBe('realistic');
    expect(copy.saves).toHaveLength(1);
    expect(copy.saves[0].id).not.toBe(g.saves[0].id);
    copy.saves[0].inventory.wood = 50;
    expect(g.saves[0].inventory.wood).toBe(2);
    lib.deleteGame(copy.id);
    expect(lib.get(g.id)!.saves).toHaveLength(1);
  });
  it('une partie introuvable ne se duplique pas', () => {
    expect(memory().duplicateGame('absent', 'x')).toBeNull();
  });
});
