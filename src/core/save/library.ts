import type { Inventory } from '../game/inventory';
import { emptyChanges, type WorldChanges } from '../game/worldChanges';
import { normalizeWorldParams, type WorldFamilies } from '../world/worldgen';
import {
  normalizeGame,
  normalizeOptions,
  type GameOptions,
  type GameSummary,
  type PlayerState,
  type SaveIndex,
  type SaveSlot,
  type SlotKind,
} from './saveIndex';
import type { SaveStorage } from './storage';

export const MAX_NAME_LENGTH = 40;
export type RenameResult = 'ok' | 'empty' | 'duplicate' | 'auto' | 'missing';

const newId = (prefix: string, now: number): string =>
  `${prefix}-${now}-${Math.floor(Math.random() * 1e9).toString(36)}`;

const cleanName = (name: string): string => name.trim().slice(0, MAX_NAME_LENGTH);

/**
 * Toutes les parties du joueur. Les lectures sont immédiates (copie en mémoire) ; chaque
 * modification est écrite en arrière-plan dans le stockage (IndexedDB), dans l'ordre.
 */
export class SaveLibrary implements SaveIndex {
  private games: GameSummary[] = [];
  private queue: Promise<void> = Promise.resolve();
  /** Nombre d'écritures qui ont échoué (stockage plein, refusé…). */
  failedWrites = 0;
  /** Parties reprises de l'ancien stockage lors de l'ouverture. */
  migratedCount = 0;

  private constructor(private readonly storage: SaveStorage) {}

  /** Bibliothèque vide, sans lecture du stockage (tests). */
  static empty(storage: SaveStorage): SaveLibrary {
    return new SaveLibrary(storage);
  }

  /** Ouvre la bibliothèque. `legacy` : ancien stockage dont on reprend les parties une fois. */
  static async open(storage: SaveStorage, legacy: SaveStorage | null = null): Promise<SaveLibrary> {
    const library = new SaveLibrary(storage);
    library.games = (await storage.loadAll()).flatMap(normalizeGame);
    if (legacy && legacy !== storage) {
      for (const raw of await legacy.loadAll()) {
        for (const game of normalizeGame(raw)) {
          if (library.games.some((g) => g.id === game.id)) continue;
          library.games.push(game);
          library.migratedCount++;
          await storage.put(game);
        }
      }
      // Les parties sont en sécurité dans le nouveau stockage : on libère l'ancien.
      if (library.migratedCount > 0) {
        for (const raw of await legacy.loadAll()) {
          const id = (raw as { id?: unknown })?.id;
          if (typeof id === 'string') await legacy.remove(id);
        }
      }
    }
    return library;
  }

  get storageKind(): SaveStorage['kind'] {
    return this.storage.kind;
  }

  /** Attend la fin des écritures en cours. */
  flush(): Promise<void> {
    return this.queue;
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue = this.queue.then(job).catch(() => {
      this.failedWrites++;
    });
  }

  private persist(game: GameSummary): void {
    const copy = structuredClone(game);
    this.enqueue(() => this.storage.put(copy));
  }

  list(): GameSummary[] {
    return this.games;
  }

  get(id: string): GameSummary | undefined {
    return this.games.find((g) => g.id === id);
  }

  /** Crée une partie (sans sauvegarde : la première est créée à la sortie ou par le joueur). */
  create(
    name: string,
    seed: string,
    extras: { families?: WorldFamilies; distanceRatio?: number; options?: GameOptions } = {},
    now = Date.now(),
  ): GameSummary {
    const game: GameSummary = {
      id: newId('game', now),
      name: cleanName(name) || 'Partie',
      createdAt: now,
      world: normalizeWorldParams(seed, extras.families, extras.distanceRatio),
      options: normalizeOptions(extras.options, true),
      saves: [],
    };
    this.games.push(game);
    this.persist(game);
    return game;
  }

  /**
   * Enregistre une sauvegarde dans une partie.
   * - manuelle : une sauvegarde de même nom est remplacée, un autre nom en crée une nouvelle à côté ;
   * - automatique : une nouvelle est ajoutée, les plus anciennes au-delà de `keepAuto` sont supprimées.
   */
  saveSlot(
    gameId: string,
    slot: {
      name: string;
      kind: SlotKind;
      player: PlayerState;
      inventory?: Inventory;
      changes?: WorldChanges;
      players?: SaveSlot['players'];
    },
    keepAuto = 5,
    now = Date.now(),
  ): { game: GameSummary; slot: SaveSlot; replaced: boolean } | null {
    const game = this.get(gameId);
    if (!game) return null;
    const name = cleanName(slot.name) || 'Sauvegarde';
    let replaced = false;
    let saved: SaveSlot | undefined;
    if (slot.kind === 'manual') {
      const existing = game.saves.find((s) => s.kind === 'manual' && s.name === name);
      if (existing) {
        existing.savedAt = now;
        existing.player = slot.player;
        existing.inventory = slot.inventory ?? {};
        existing.changes = slot.changes ?? emptyChanges();
        existing.players = slot.players;
        saved = existing;
        replaced = true;
      }
    }
    if (!saved) {
      saved = {
        id: newId('slot', now),
        name,
        kind: slot.kind,
        savedAt: now,
        player: slot.player,
        inventory: slot.inventory ?? {},
        changes: slot.changes ?? emptyChanges(),
        players: slot.players,
      };
      game.saves.push(saved);
    }
    if (slot.kind === 'auto') {
      const autos = game.saves
        .filter((s) => s.kind === 'auto')
        .sort((a, b) => b.savedAt - a.savedAt);
      const drop = new Set(autos.slice(Math.max(1, keepAuto)).map((s) => s.id));
      game.saves = game.saves.filter((s) => !drop.has(s.id));
    }
    this.persist(game);
    return { game, slot: saved, replaced };
  }

  /** Supprime une partie et toutes ses sauvegardes. Renvoie false si elle n'existe pas. */
  deleteGame(id: string): boolean {
    const before = this.games.length;
    this.games = this.games.filter((g) => g.id !== id);
    if (this.games.length === before) return false;
    this.enqueue(() => this.storage.remove(id));
    return true;
  }

  /** Supprime une seule sauvegarde d'une partie. */
  deleteSlot(gameId: string, slotId: string): boolean {
    const game = this.get(gameId);
    if (!game || !game.saves.some((s) => s.id === slotId)) return false;
    game.saves = game.saves.filter((s) => s.id !== slotId);
    this.persist(game);
    return true;
  }

  renameGame(id: string, name: string): RenameResult {
    const game = this.get(id);
    if (!game) return 'missing';
    const clean = cleanName(name);
    if (!clean) return 'empty';
    game.name = clean;
    this.persist(game);
    return 'ok';
  }

  /** Renomme une sauvegarde manuelle (les noms manuels d'une même partie restent uniques). */
  renameSlot(gameId: string, slotId: string, name: string): RenameResult {
    const game = this.get(gameId);
    const slot = game?.saves.find((s) => s.id === slotId);
    if (!game || !slot) return 'missing';
    if (slot.kind === 'auto') return 'auto';
    const clean = cleanName(name);
    if (!clean) return 'empty';
    if (game.saves.some((s) => s.id !== slotId && s.kind === 'manual' && s.name === clean)) {
      return 'duplicate';
    }
    slot.name = clean;
    this.persist(game);
    return 'ok';
  }

  /** Copie d'une partie entière (monde, réglages et toutes ses sauvegardes). */
  duplicateGame(id: string, newName: string, now = Date.now()): GameSummary | null {
    const source = this.get(id);
    if (!source) return null;
    const copy: GameSummary = structuredClone(source);
    copy.id = newId('game', now);
    copy.name = cleanName(newName) || source.name;
    copy.createdAt = now;
    copy.saves = copy.saves.map((s) => ({ ...s, id: newId('slot', now) }));
    this.games.push(copy);
    this.persist(copy);
    return copy;
  }

  /** Copie une sauvegarde sous un nouveau nom manuel (un nom déjà pris reçoit un numéro). */
  duplicateSlot(
    gameId: string,
    slotId: string,
    newName: string,
    now = Date.now(),
  ): SaveSlot | null {
    const game = this.get(gameId);
    const source = game?.saves.find((s) => s.id === slotId);
    if (!game || !source) return null;
    const base = cleanName(newName) || source.name;
    let name = base;
    for (let n = 2; game.saves.some((s) => s.kind === 'manual' && s.name === name); n++) {
      name = cleanName(`${base} ${n}`);
    }
    const copy: SaveSlot = {
      ...structuredClone(source),
      id: newId('slot', now),
      name,
      kind: 'manual',
      savedAt: now,
    };
    game.saves.push(copy);
    this.persist(game);
    return copy;
  }

  /** Ajoute une partie venue d'un fichier. Elle reçoit toujours un nouvel identifiant. */
  importGame(game: GameSummary, now = Date.now()): GameSummary {
    const copy: GameSummary = structuredClone(game);
    copy.id = newId('game', now);
    const used = new Set<string>();
    copy.saves = copy.saves.map((s) => {
      const id = used.has(s.id) ? newId('slot', now) : s.id;
      used.add(id);
      return { ...s, id };
    });
    this.games.push(copy);
    this.persist(copy);
    return copy;
  }

  /** Outil de test (mode ?dev=1) : supprime toutes les parties. */
  clearAll(): void {
    const ids = this.games.map((g) => g.id);
    this.games = [];
    for (const id of ids) this.enqueue(() => this.storage.remove(id));
  }
}
