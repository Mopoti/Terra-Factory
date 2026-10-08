import { normalizeInventory, type Inventory } from '../game/inventory';
import { normalizeChanges, type WorldChanges } from '../game/worldChanges';
import { DEFAULT_TIME, normalizeTime, type TimeSettings } from '../game/seasons';
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
  /** Hauteur des pieds (m) : sur un mur ou une dalle, on retrouve sa place au chargement. */
  y: number;
  firstPitch: number;
  /** Distance de la caméra en vue du dessus (m). */
  topZoom: number;
}

/** Niveau de réalisme de la physique (chaleur, pression, électricité…) : appliqué quand ces systèmes existeront. */
export type Realism = 'arcade' | 'balanced' | 'realistic';
export const REALISM_LEVELS: readonly Realism[] = ['arcade', 'balanced', 'realistic'];

/** Mode de jeu : Survie, ou Créatif (recherche et fabrication gratuites, sac sans limite de poids ni de volume, ignoré des ennemis). */
export type GameMode = 'survival' | 'creative';
export const GAME_MODES: readonly GameMode[] = ['survival', 'creative'];

/** Règles de la partie choisies à sa création. */
export interface GameOptions {
  enemies: {
    /** Les ennemis attaquent le joueur et ses installations. Défaut : non. */
    aggressive: boolean;
    /** Les colonies grossissent et fondent de nouveaux nids. Défaut : oui. */
    expand: boolean;
  };
  realism: Realism;
  mode: GameMode;
  /** Tutoriel pas à pas (en haut à droite) : oui par défaut dans une nouvelle partie. */
  tutorial: boolean;
  multiplayer: MultiplayerOptions;
  /** Jour, nuit et saisons (réglages indépendants). */
  time: TimeSettings;
}

/** Réglages multijoueur d'une partie (le réseau lui-même viendra aux étapes M2 et M3, voir docs/multijoueur.md). */
export interface MultiplayerOptions {
  enabled: boolean;
  /** Privée : seuls les joueurs invités par l'hôte ; publique : une adresse, avec un mot de passe optionnel. */
  visibility: 'private' | 'public';
  /** Mot de passe d'une partie publique (vide = aucun). */
  password: string;
  /** Ce que les joueurs partagent (tout partagé par défaut) : technologies, crédits du comptoir, sac. */
  share: { research: boolean; credits: boolean; inventory: boolean };
}
export const MAX_PLAYERS = 5;

export const DEFAULT_MULTIPLAYER: MultiplayerOptions = {
  enabled: false,
  visibility: 'private',
  password: '',
  share: { research: true, credits: true, inventory: true },
};

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  enemies: { aggressive: false, expand: true },
  realism: 'balanced',
  mode: 'survival',
  tutorial: true,
  multiplayer: DEFAULT_MULTIPLAYER,
  time: DEFAULT_TIME,
};

/** `tutorialDefault` : valeur si le tutoriel n'est pas précisé (non pour une ancienne partie, oui pour une nouvelle). */
export function normalizeMultiplayer(raw: unknown): MultiplayerOptions {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const s = (typeof o.share === 'object' && o.share !== null ? o.share : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_MULTIPLAYER;
  const flag = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
  return {
    enabled: flag(o.enabled, d.enabled),
    visibility: o.visibility === 'public' ? 'public' : 'private',
    password: typeof o.password === 'string' ? o.password.slice(0, 40) : '',
    share: {
      research: flag(s.research, d.share.research),
      credits: flag(s.credits, d.share.credits),
      inventory: flag(s.inventory, d.share.inventory),
    },
  };
}

export function normalizeOptions(raw: unknown, tutorialDefault = false): GameOptions {
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
    mode: GAME_MODES.find((m) => m === o.mode) ?? d.mode,
    multiplayer: normalizeMultiplayer(o.multiplayer),
    // Une ancienne partie n'a pas de tutoriel.
    tutorial: typeof o.tutorial === 'boolean' ? o.tutorial : tutorialDefault,
    time: normalizeTime(o.time),
  };
}

export type SlotKind = 'manual' | 'auto';

/** Une sauvegarde : un instant d'une partie. */
/** Fiche d'un joueur invité, gardée dans la sauvegarde de l'hôte pour qu'il retrouve ses affaires en revenant. */
export interface SavedPlayer {
  inventory: Inventory;
  changes: Record<string, unknown>;
}

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
  /** Joueurs invités (par nom), si la partie a été ouverte à des invités. */
  players?: Record<string, SavedPlayer>;
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
  y: 0,
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
    y: isNum(p.y) && p.y >= 0 && p.y < 100 ? p.y : d.y,
    firstPitch: isNum(p.firstPitch) ? p.firstPitch : d.firstPitch,
    topZoom: isNum(p.topZoom) ? p.topZoom : d.topZoom,
  };
}

function normalizePlayers(raw: unknown): Record<string, SavedPlayer> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, SavedPlayer> = {};
  for (const [name, v] of Object.entries(raw).slice(0, MAX_PLAYERS * 4)) {
    if (typeof v !== 'object' || v === null) continue;
    const p = v as Record<string, unknown>;
    const changes = typeof p.changes === 'object' && p.changes !== null ? p.changes : {};
    out[name.slice(0, 24)] = {
      inventory: normalizeInventory(p.inventory),
      changes: changes as Record<string, unknown>,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
      players: normalizePlayers(s.players),
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
      world: normalizeWorldParams(seed, world?.families, world?.distanceRatio),
      options: normalizeOptions(g.options),
      saves: Array.isArray(g.saves) ? g.saves.flatMap(normalizeSlot) : [],
    },
  ];
}
