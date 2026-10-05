/** Résumé d'une partie sauvegardée, tel qu'affiché dans le menu. */
export interface GameSummary {
  id: string;
  name: string;
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

/** Index provisoire (localStorage) en attendant le vrai système de sauvegarde. */
export class ProvisionalSaveIndex implements SaveIndex {
  list(): GameSummary[] {
    try {
      const raw = localStorage.getItem(DEV_KEY);
      return raw ? (JSON.parse(raw) as GameSummary[]) : [];
    } catch {
      return [];
    }
  }

  /** Ajoute une partie (provisoire : seul le nom et la date sont retenus). */
  create(name: string): GameSummary {
    const game: GameSummary = { id: `game-${Date.now()}`, name, lastSavedAt: Date.now() };
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
