import { normalizeWorldParams, type WorldFamilies, type WorldParams } from '../world/worldgen';

export type ViewId = 'first' | 'third' | 'top';
export const VIEW_IDS: readonly ViewId[] = ['first', 'third', 'top'];

/** État du joueur enregistré dans une sauvegarde (le monde lui-même se recalcule depuis la seed). */
export interface PlayerState {
  x: number;
  z: number;
  /** Orientation du joueur / de la caméra autour de la verticale. */
  yaw: number;
  /** Inclinaison de la caméra à la 3ème personne. */
  pitch: number;
  /** Distance de la caméra à la 3ème personne (m). */
  distance: number;
  /** Vue active. */
  view: ViewId;
  /** Inclinaison du regard à la 1ère personne (> 0 = vers le bas). */
  firstPitch: number;
  /** Distance de la caméra en vue du dessus (m). */
  topZoom: number;
}

/** Niveau de réalisme de la physique (chaleur, pression, électricité…) : appliqué quand ces systèmes existeront. */
export type Realism = 'arcade' | 'balanced' | 'realistic';
export const REALISM_LEVELS: readonly Realism[] = ['arcade', 'balanced', 'realistic'];

/** Règles de la partie choisies à sa création. */
export interface GameOptions {
  enemies: {
    /** Les ennemis attaquent le joueur et ses installations. Défaut : non. */
    aggressive: boolean;
    /** Les colonies grossissent et fondent de nouveaux nids. Défaut : oui. */
    expand: boolean;
  };
  realism: Realism;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  enemies: { aggressive: false, expand: true },
  realism: 'balanced',
};

function normalizeOptions(raw: unknown): GameOptions {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const e = (typeof o.enemies === 'object' && o.enemies !== null ? o.enemies : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_GAME_OPTIONS;
  return {
    enemies: {
      aggressive: typeof e.aggressive === 'boolean' ? e.aggressive : d.enemies.aggressive,
      expand: typeof e.expand === 'boolean' ? e.expand : d.enemies.expand,
    },
    realism: REALISM_LEVELS.find((r) => r === o.realism) ?? d.realism,
  };
}

export type SlotKind = 'manual' | 'auto';

/** Une sauvegarde : un instant d'une partie. */
export interface SaveSlot {
  id: string;
  name: string;
  kind: SlotKind;
  /** Date/heure de la sauvegarde (ms depuis 1970). */
  savedAt: number;
  player: PlayerState;
}

/** Une partie = un « dossier » contenant ses sauvegardes (manuelles et automatiques). */
export interface GameSummary {
  id: string;
  name: string;
  /** Seed et réglages de génération : suffisent à recréer le monde d'origine. */
  world: WorldParams;
  /** Règles de la partie (ennemis, réalisme). */
  options: GameOptions;
  createdAt: number;
  saves: SaveSlot[];
}

/** Liste des parties connues. Le stockage définitif (IndexedDB, export) arrive au chantier 6. */
export interface SaveIndex {
  list(): GameSummary[];
}

/** Date de la dernière sauvegarde d'une partie (ou de sa création). */
export function lastSavedAt(game: GameSummary): number {
  return game.saves.reduce((latest, s) => Math.max(latest, s.savedAt), game.createdAt);
}

/** La sauvegarde la plus récente d'une partie. */
export function latestSlot(game: GameSummary): SaveSlot | undefined {
  return game.saves.reduce<SaveSlot | undefined>(
    (best, s) => (!best || s.savedAt > best.savedAt ? s : best),
    undefined,
  );
}

/** La partie à proposer dans « Continuer » : la plus récemment sauvegardée. */
export function latestGame(games: readonly GameSummary[]): GameSummary | undefined {
  return games.reduce<GameSummary | undefined>(
    (best, g) => (!best || lastSavedAt(g) > lastSavedAt(best) ? g : best),
    undefined,
  );
}

const STORAGE_KEY = 'terra.dev.games';
export const DEFAULT_PLAYER_STATE: PlayerState = {
  x: 0,
  z: 0,
  yaw: Math.PI / 4,
  pitch: 0.75,
  distance: 9,
  view: 'third',
  firstPitch: 0,
  topZoom: 20,
};

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function normalizePlayer(raw: unknown): PlayerState {
  const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PLAYER_STATE;
  return {
    x: isNum(p.x) ? p.x : d.x,
    z: isNum(p.z) ? p.z : d.z,
    yaw: isNum(p.yaw) ? p.yaw : d.yaw,
    pitch: isNum(p.pitch) ? p.pitch : d.pitch,
    distance: isNum(p.distance) ? p.distance : d.distance,
    view: VIEW_IDS.find((v) => v === p.view) ?? d.view,
    firstPitch: isNum(p.firstPitch) ? p.firstPitch : d.firstPitch,
    topZoom: isNum(p.topZoom) ? p.topZoom : d.topZoom,
  };
}

function normalizeSlot(raw: unknown): SaveSlot[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string' || !isNum(s.savedAt)) return [];
  return [
    {
      id: s.id,
      name: s.name,
      kind: s.kind === 'auto' ? 'auto' : 'manual',
      savedAt: s.savedAt,
      player: normalizePlayer(s.player),
    },
  ];
}

/** Relit une partie enregistrée, y compris les anciens formats ; ignore ce qui est inutilisable. */
export function normalizeGame(item: unknown): GameSummary[] {
  if (typeof item !== 'object' || item === null) return [];
  const g = item as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.name !== 'string') return [];
  const world = g.world as Partial<WorldParams> | undefined;
  const seed = typeof world?.seed === 'string' ? world.seed : g.id;
  const createdAt = isNum(g.createdAt) ? g.createdAt : isNum(g.lastSavedAt) ? g.lastSavedAt : 0;
  return [
    {
      id: g.id,
      name: g.name,
      createdAt,
      world: normalizeWorldParams(seed, world?.families),
      options: normalizeOptions(g.options),
      saves: Array.isArray(g.saves) ? g.saves.flatMap(normalizeSlot) : [],
    },
  ];
}

function browserStorage(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Index provisoire (localStorage) en attendant le vrai système de sauvegarde du chantier 6. */
export class ProvisionalSaveIndex implements SaveIndex {
  constructor(private readonly store: Store | null = browserStorage()) {}

  list(): GameSummary[] {
    try {
      const raw = this.store?.getItem(STORAGE_KEY);
      const items = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(items) ? items.flatMap(normalizeGame) : [];
    } catch {
      return [];
    }
  }

  get(id: string): GameSummary | undefined {
    return this.list().find((g) => g.id === id);
  }

  private write(games: GameSummary[]): void {
    try {
      this.store?.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch {
      /* stockage plein ou indisponible : ignoré */
    }
  }

  /** Crée une partie (sans sauvegarde : la première est créée à la sortie ou par le joueur). */
  create(
    name: string,
    seed: string,
    extras: { families?: WorldFamilies; options?: GameOptions } = {},
  ): GameSummary {
    const now = Date.now();
    const game: GameSummary = {
      id: `game-${now}-${Math.floor(Math.random() * 1e6)}`,
      name,
      createdAt: now,
      world: normalizeWorldParams(seed, extras.families),
      options: normalizeOptions(extras.options),
      saves: [],
    };
    this.write([...this.list(), game]);
    return game;
  }

  /**
   * Enregistre une sauvegarde dans une partie.
   * - manuelle : une sauvegarde de même nom est remplacée, un autre nom en crée une nouvelle à côté ;
   * - automatique : une nouvelle est ajoutée, les plus anciennes au-delà de `keepAuto` sont supprimées.
   */
  saveSlot(
    gameId: string,
    slot: { name: string; kind: SlotKind; player: PlayerState },
    keepAuto = 5,
    now = Date.now(),
  ): { game: GameSummary; slot: SaveSlot; replaced: boolean } | null {
    const games = this.list();
    const game = games.find((g) => g.id === gameId);
    if (!game) return null;
    let replaced = false;
    let saved: SaveSlot | undefined;
    if (slot.kind === 'manual') {
      const existing = game.saves.find((s) => s.kind === 'manual' && s.name === slot.name);
      if (existing) {
        existing.savedAt = now;
        existing.player = slot.player;
        saved = existing;
        replaced = true;
      }
    }
    if (!saved) {
      saved = {
        id: `slot-${now}-${Math.floor(Math.random() * 1e6)}`,
        name: slot.name,
        kind: slot.kind,
        savedAt: now,
        player: slot.player,
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
    this.write(games);
    return { game, slot: saved, replaced };
  }

  /** Supprime une partie et toutes ses sauvegardes. Renvoie false si elle n'existe pas. */
  deleteGame(id: string): boolean {
    const games = this.list();
    const remaining = games.filter((g) => g.id !== id);
    if (remaining.length === games.length) return false;
    this.write(remaining);
    return true;
  }

  /** Outil de test (mode ?dev=1) : supprime toutes les parties. */
  clearAll(): void {
    try {
      this.store?.removeItem(STORAGE_KEY);
    } catch {
      /* ignoré */
    }
  }
}
