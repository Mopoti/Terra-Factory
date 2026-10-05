import type { GameSummary } from './saveIndex';

/**
 * Où les parties sont réellement conservées. Les parties sont lues une fois au démarrage, puis
 * chaque modification est écrite ici en arrière-plan.
 */
export interface SaveStorage {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  /** Toutes les parties enregistrées (données brutes, à valider avant usage). */
  loadAll(): Promise<unknown[]>;
  put(game: GameSummary): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Stockage en mémoire : pour les tests, ou en dernier recours (rien n'est conservé). */
export class MemoryStorage implements SaveStorage {
  readonly kind = 'memory' as const;
  private readonly games = new Map<string, unknown>();

  loadAll(): Promise<unknown[]> {
    return Promise.resolve([...this.games.values()].map((g) => structuredClone(g)));
  }
  put(game: GameSummary): Promise<void> {
    this.games.set(game.id, structuredClone(game));
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    this.games.delete(id);
    return Promise.resolve();
  }
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const LEGACY_KEY = 'terra.dev.games';

/** Ancien stockage (localStorage) : lu pour reprendre les parties existantes, ou en secours. */
export class LocalStorageStorage implements SaveStorage {
  readonly kind = 'localstorage' as const;
  constructor(private readonly store: KeyValueStore) {}

  private read(): unknown[] {
    try {
      const raw = this.store.getItem(LEGACY_KEY);
      const items = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }
  loadAll(): Promise<unknown[]> {
    return Promise.resolve(this.read());
  }
  put(game: GameSummary): Promise<void> {
    const others = this.read().filter((g) => (g as { id?: unknown })?.id !== game.id);
    this.store.setItem(LEGACY_KEY, JSON.stringify([...others, game]));
    return Promise.resolve();
  }
  remove(id: string): Promise<void> {
    const others = this.read().filter((g) => (g as { id?: unknown })?.id !== id);
    if (others.length > 0) this.store.setItem(LEGACY_KEY, JSON.stringify(others));
    else this.store.removeItem(LEGACY_KEY);
    return Promise.resolve();
  }
}

const DB_NAME = 'terra-factory';
const STORE = 'games';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB'));
  });
}

/** Stockage définitif : IndexedDB (grand volume, un enregistrement par partie). */
export class IndexedDbStorage implements SaveStorage {
  readonly kind = 'indexeddb' as const;
  private constructor(private readonly db: IDBDatabase) {}

  static open(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IndexedDbStorage> {
    return new Promise((resolve, reject) => {
      const req = factory.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(new IndexedDbStorage(req.result));
      req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB bloquée'));
    });
  }

  loadAll(): Promise<unknown[]> {
    return request(this.db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  }
  async put(game: GameSummary): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(game);
    await transactionDone(tx);
  }
  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
  }
}

/** Le meilleur stockage disponible : IndexedDB, sinon localStorage, sinon mémoire (rien conservé). */
export async function openBestStorage(): Promise<SaveStorage> {
  try {
    if (typeof indexedDB !== 'undefined') {
      return await Promise.race([
        IndexedDbStorage.open(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('délai dépassé')), 3000),
        ),
      ]);
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const probe = '__terra_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return new LocalStorageStorage(localStorage);
  } catch {
    return new MemoryStorage();
  }
}
