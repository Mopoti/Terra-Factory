import { defaultWorldParams, type WorldParams } from '../world/worldgen';

/** Résumé d'une partie sauvegardée, tel qu'affiché dans le menu. */
export interface GameSummary {
  id: string;
  name: string;
  /** Seed et réglages de génération : suffisent à recréer le monde d'origine. */
  world: WorldParams;
  /** Date/heure de la dernière sauvegarde (ms depuis 1970). */
  lastSavedAt: number;
}

/** Liste des parties connues. Le stockage réel (IndexedDB) arrive au chantier 6. */
export interface SaveIndex {
  list(): GameSummary[];
}

/** La partie à proposer dans « Continuer » : la plus récemment sauvegardée. */
export function latestGame(games: readonly GameSummary[]): GameSummary | undefined {
  return games.reduce<GameSummary | undefined>(
    (best, g) => (!best || g.lastSavedAt > best.lastSavedAt ? g : best),
    undefined,
  );
}

const DEV_KEY = 'terra.dev.games';

/** Relit une partie enregistrée ; complète les anciennes (sans seed) et ignore ce qui est inutilisable. */
function normalize(item: unknown): GameSummary[] {
  if (typeof item !== 'object' || item === null) return [];
  const g = item as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.name !== 'string' || typeof g.lastSavedAt !== 'number')
    return [];
  const world = g.world as Partial<WorldParams> | undefined;
  const seed = typeof world?.seed === 'string' ? world.seed : g.id;
  return [
    {
      id: g.id,
      name: g.name,
      lastSavedAt: g.lastSavedAt,
      world: {
        ...defaultWorldParams(seed),
        ...(world?.families ? { families: world.families } : {}),
      },
    },
  ];
}

/** Index provisoire (localStorage) en attendant le vrai système de sauvegarde. */
export class ProvisionalSaveIndex implements SaveIndex {
  list(): GameSummary[] {
    try {
      const raw = localStorage.getItem(DEV_KEY);
      const items = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(items) ? items.flatMap((item) => normalize(item)) : [];
    } catch {
      return [];
    }
  }

  /** Ajoute une partie (provisoire : nom, date, seed et réglages du monde sont retenus). */
  create(name: string, seed: string): GameSummary {
    const game: GameSummary = {
      id: `game-${Date.now()}`,
      name,
      lastSavedAt: Date.now(),
      world: defaultWorldParams(seed),
    };
    const games = [...this.list(), game];
    try {
      localStorage.setItem(DEV_KEY, JSON.stringify(games));
    } catch {
      /* ignoré */
    }
    return game;
  }

  /** Outil de test (mode ?dev=1) : supprime toutes les parties. */
  clearAll(): void {
    try {
      localStorage.removeItem(DEV_KEY);
    } catch {
      /* ignoré */
    }
  }
}
