import { normalizeInventory, type Inventory } from '../game/inventory';
import { normalizeChanges, type WorldChanges } from '../game/worldChanges';
import { normalizeWorldParams, type WorldParams } from '../world/worldgen';

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

export function normalizeOptions(raw: unknown): GameOptions {
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
  /** Contenu du sac du joueur. */
  inventory: Inventory;
  /** Ce que le joueur a changé dans le monde (ressources récoltées, objets au sol). */
  changes: WorldChanges;
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
      inventory: normalizeInventory(s.inventory),
      changes: normalizeChanges(s.changes),
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
