/**
 * Commandes du chat (touche Entrée). Chaque commande se déclare avec `defineCommand` : un nom, des alias, la liste de
 * ses arguments typés et ce qu'elle fait. L'analyse du texte, les messages d'erreur et l'aide (`/aide`) se font tout
 * seuls : pour ajouter une commande, il suffit d'en déclarer une de plus dans `COMMANDS`.
 */
import { t, type TranslationKey } from '../../i18n';
import { timeAtPhase, timeAtSeason, type TimeSettings } from './seasons';
import type { GameState } from './state';

/** Ce dont une commande a besoin pour agir. */
export interface ChatContext {
  state: GameState;
  /** Réglages du jour, de la nuit et des saisons de la partie. */
  time: TimeSettings;
}

/** Type d'un argument : `number` (avec bornes), `choice` (un mot parmi une liste) ou `text` (le reste de la ligne). */
export type ArgSpec =
  | { name: string; kind: 'number'; min: number; max: number; optional?: boolean; auto?: boolean }
  | {
      name: string;
      kind: 'choice';
      choices: Record<string, number>;
      optional?: boolean;
      auto?: boolean;
    }
  | { name: string; kind: 'text'; optional?: boolean };

/** Valeur lue d'un argument : un nombre, un mot (`choice` : sa valeur numérique), `'auto'` ou rien. */
export type ArgValue = number | string | 'auto' | undefined;

export interface ChatCommand {
  name: string;
  aliases: string[];
  args: ArgSpec[];
  /** Exécute la commande ; renvoie le texte à montrer au joueur. */
  run(ctx: ChatContext, values: ArgValue[]): string;
}

export const defineCommand = (c: ChatCommand): ChatCommand => c;

/** Sans accents ni majuscules : « Été » et « ete » désignent la même saison. */
const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Points cardinaux : le vent souffle VERS ce point (nord = −z, est = +x ; angle 0 = est, π/2 = sud). */
const COMPASS: Record<string, number> = {
  e: 0,
  se: Math.PI / 4,
  s: Math.PI / 2,
  so: (3 * Math.PI) / 4,
  sw: (3 * Math.PI) / 4,
  o: Math.PI,
  w: Math.PI,
  no: (5 * Math.PI) / 4,
  nw: (5 * Math.PI) / 4,
  n: (3 * Math.PI) / 2,
  ne: (7 * Math.PI) / 4,
};

const SEASONS: Record<string, number> = {
  printemps: 0,
  spring: 0,
  ete: 1,
  summer: 1,
  automne: 2,
  autumn: 2,
  hiver: 3,
  winter: 3,
};

const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'] as const;

export const COMMANDS: ChatCommand[] = [
  defineCommand({
    name: 'aide',
    aliases: ['help', '?'],
    args: [{ name: 'commande', kind: 'text', optional: true }],
    run: (_ctx, [which]) => {
      if (typeof which === 'string' && which.length > 0) {
        const c = findCommand(which);
        return c ? usageOf(c) : t('chat.unknown', { name: which });
      }
      return `${t('chat.help.list')} ${COMMANDS.map((c) => `/${c.name}`).join(', ')}`;
    },
  }),
  defineCommand({
    name: 'jour',
    aliases: ['day'],
    args: [],
    run: ({ state, time }) => {
      state.changes.time = timeAtPhase(state.changes.time, time, 'day');
      return t('chat.time.day');
    },
  }),
  defineCommand({
    name: 'nuit',
    aliases: ['night'],
    args: [],
    run: ({ state, time }) => {
      state.changes.time = timeAtPhase(state.changes.time, time, 'night');
      return t('chat.time.night');
    },
  }),
  defineCommand({
    name: 'saison',
    aliases: ['season'],
    args: [
      {
        name: 'printemps|été|automne|hiver',
        kind: 'choice',
        choices: SEASONS,
      },
    ],
    run: ({ state, time }, [season]) => {
      const index = season as number;
      state.changes.time = timeAtSeason(state.changes.time, time, index);
      return t('chat.season', { season: t(`season.${SEASON_KEYS[index]}` as TranslationKey) });
    },
  }),
  defineCommand({
    name: 'temperature',
    aliases: ['temp'],
    args: [{ name: '°C|auto', kind: 'number', min: -100, max: 100, auto: true }],
    run: ({ state }, [value]) => {
      if (value === 'auto') {
        delete state.changes.weather.tempC;
        return t('chat.temp.auto');
      }
      state.changes.weather.tempC = value as number;
      return t('chat.temp.set', { value: String(value) });
    },
  }),
  defineCommand({
    name: 'vent',
    aliases: ['wind'],
    args: [
      { name: 'force 0-100|auto', kind: 'number', min: 0, max: 100, auto: true },
      {
        name: 'n|ne|e|se|s|so|o|no',
        kind: 'choice',
        choices: COMPASS,
        optional: true,
      },
    ],
    run: ({ state }, [force, direction]) => {
      if (force === 'auto') {
        delete state.changes.weather.windSpeed;
        delete state.changes.weather.windDir;
        return t('chat.wind.auto');
      }
      state.changes.weather.windSpeed = (force as number) / 100;
      if (typeof direction === 'number') state.changes.weather.windDir = direction;
      return t('chat.wind.set', { force: String(force) });
    },
  }),
  defineCommand({
    name: 'meteo',
    aliases: ['weather'],
    args: [],
    run: ({ state }) => {
      state.changes.weather = {};
      return t('chat.weather.reset');
    },
  }),
];

/** Retrouve une commande par son nom ou un alias (sans accents ni majuscules). */
export function findCommand(name: string): ChatCommand | null {
  const n = plain(name.replace(/^\//, ''));
  return COMMANDS.find((c) => plain(c.name) === n || c.aliases.some((a) => plain(a) === n)) ?? null;
}

/** Mode d'emploi d'une commande : `/vent <force 0-100|auto> [n|ne|…]`. */
export function usageOf(c: ChatCommand): string {
  const args = c.args.map((a) => (a.optional ? `[${a.name}]` : `<${a.name}>`)).join(' ');
  return `/${c.name} ${args}`.trim();
}

/** Lit un argument ; renvoie sa valeur, ou un message d'erreur. */
function readArg(spec: ArgSpec, word: string | undefined): { value: ArgValue } | { error: string } {
  if (word === undefined || word === '') {
    if (spec.optional) return { value: undefined };
    return { error: t('chat.missing', { arg: spec.name }) };
  }
  if (spec.kind === 'text') return { value: word };
  if ((spec.kind === 'number' || spec.kind === 'choice') && spec.auto && plain(word) === 'auto')
    return { value: 'auto' };
  if (spec.kind === 'number') {
    const n = Number(word.replace(',', '.'));
    if (!Number.isFinite(n) || n < spec.min || n > spec.max)
      return {
        error: t('chat.range', { arg: spec.name, min: String(spec.min), max: String(spec.max) }),
      };
    return { value: n };
  }
  const found = spec.choices[plain(word)];
  if (found === undefined) return { error: t('chat.choice', { arg: spec.name }) };
  return { value: found };
}

/** Exécute une ligne tapée dans le chat (`/vent 80 no`) ; renvoie ce qu'il faut afficher. */
export function runChat(line: string, ctx: ChatContext): { ok: boolean; text: string } {
  const text = line.trim();
  if (!text.startsWith('/')) return { ok: false, text: t('chat.notCommand') };
  const [head, ...rest] = text.split(/\s+/);
  const command = findCommand(head);
  if (!command) return { ok: false, text: t('chat.unknown', { name: head }) };
  const values: ArgValue[] = [];
  for (let i = 0; i < command.args.length; i++) {
    const spec = command.args[i];
    // Un argument `text` prend tout le reste de la ligne.
    const word = spec.kind === 'text' ? rest.slice(i).join(' ') : rest[i];
    const read = readArg(spec, word);
    if ('error' in read) return { ok: false, text: `${read.error} — ${usageOf(command)}` };
    values.push(read.value);
  }
  // Une commande change les règles du monde : la partie est marquée « admin » (pas de succès).
  ctx.state.changes.admin = true;
  return { ok: true, text: command.run(ctx, values) };
}
