import { getLocale, resetLocale } from '../i18n';
import { ACTION_IDS, defaultControls, type ActionId, type Binding } from './controls';
import { ROW_BY_PATH } from './rows';
import { defaultSettings, type SectionName, type Settings } from './schema';

const STORAGE_KEY = 'terra.settings';
/** Version du format enregistré. À incrémenter quand la structure change (voir `migrate`). */
export const SETTINGS_VERSION = 1;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recopie dans `defaults` les valeurs valides de `raw` : tout le reste (inconnu, mal typé) est ignoré. */
function merge(defaults: unknown, raw: unknown, path: string): unknown {
  if (isRecord(defaults)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defaults)) {
      const sub = isRecord(raw) ? raw[key] : undefined;
      out[key] = merge(defaults[key], sub, path ? `${path}.${key}` : key);
    }
    return out;
  }
  const row = ROW_BY_PATH.get(path);
  if (typeof defaults === 'number') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return defaults;
    if (row?.kind === 'range') return Math.min(row.max, Math.max(row.min, raw));
    if (row?.kind === 'select') return row.options.some((o) => o.value === raw) ? raw : defaults;
    if (row?.kind === 'sound') return Math.min(100, Math.max(0, raw));
    return raw;
  }
  if (typeof defaults === 'string') {
    if (typeof raw !== 'string') return defaults;
    if (row?.kind === 'select') return row.options.some((o) => o.value === raw) ? raw : defaults;
    return defaults;
  }
  if (typeof defaults === 'boolean') return typeof raw === 'boolean' ? raw : defaults;
  return defaults;
}

function mergeControls(defaults: Settings['controls'], raw: unknown): Settings['controls'] {
  const out = { ...defaults };
  if (!isRecord(raw)) return out;
  for (const id of ACTION_IDS) {
    const pair = raw[id];
    if (Array.isArray(pair) && pair.length === 2) {
      const ok = (b: unknown): b is Binding =>
        b === null || (typeof b === 'string' && b.length < 30);
      if (ok(pair[0]) && ok(pair[1])) out[id] = [pair[0], pair[1]];
    }
  }
  out.pause = defaults.pause; // réservé : Échap
  return out;
}

/** Transforme des données enregistrées (n'importe quelle version) en réglages valides. */
export function sanitize(raw: unknown, french: boolean): Settings {
  const defaults = defaultSettings(french);
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : {};
  const merged = merge({ ...defaults, controls: undefined }, { ...data, controls: undefined }, '');
  return {
    ...(merged as Omit<Settings, 'controls'>),
    controls: mergeControls(defaults.controls, data.controls),
  };
}

let current: Settings = defaultSettings(true);
const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  return current;
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SETTINGS_VERSION, data: current }));
  } catch {
    /* stockage indisponible : les réglages durent le temps de la session */
  }
}

function commit(next: Settings): void {
  current = next;
  persist();
  listeners.forEach((fn) => fn(current));
}

function readStored(): unknown {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  current = sanitize(readStored(), getLocale() === 'fr');
  return current;
}

function setAt(root: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = root;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys[keys.length - 1]] = value;
}

export function getAt(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), current);
}

/** Change un réglage (valeur déjà valide pour sa ligne ; elle est bornée au passage). */
export function setSetting(path: string, value: string | number | boolean): void {
  const row = ROW_BY_PATH.get(path);
  let v = value;
  if (typeof v === 'number' && (row?.kind === 'range' || row?.kind === 'sound')) {
    const [min, max] = row.kind === 'range' ? [row.min, row.max] : [0, 100];
    v = Math.min(max, Math.max(min, v));
  }
  const next = structuredClone(current);
  setAt(next as unknown as Record<string, unknown>, path, v);
  commit(next);
}

export function setBindings(changes: { action: ActionId; slot: 0 | 1; code: Binding }[]): void {
  const next = structuredClone(current);
  for (const c of changes) next.controls[c.action][c.slot] = c.code;
  commit(next);
}

/** Remet une section (ou tout) aux valeurs par défaut. */
export function resetSection(section: SectionName | 'all'): void {
  const defaults = defaultSettings(getLocale() === 'fr');
  const next = structuredClone(current);
  const names: SectionName[] =
    section === 'all' ? ['display', 'sound', 'views', 'controls', 'game'] : [section];
  for (const name of names) (next as unknown as Record<string, unknown>)[name] = defaults[name];
  if (names.includes('display')) resetLocale();
  next.controls = names.includes('controls')
    ? defaultControls(getLocale() === 'fr')
    : next.controls;
  commit(next);
}
