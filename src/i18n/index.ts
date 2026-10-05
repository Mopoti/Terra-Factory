import fr from './fr.json';
import en from './en.json';

export type TranslationKey = keyof typeof fr;
export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];
export const LOCALE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' };

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { fr, en };
const STORAGE_KEY = 'terra.locale';

/** Choisit la langue à partir de la liste de langues du navigateur ; français par défaut si inconnue. */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}

let current: Locale = 'fr';
const listeners = new Set<() => void>();

export function initLocale(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : on retombe sur la langue du navigateur */
  }
  current =
    saved === 'fr' || saved === 'en'
      ? saved
      : detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
  document.documentElement.lang = current;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* sans effet : la langue ne sera simplement pas retenue */
  }
  listeners.forEach((fn) => fn());
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Traduit une clé ; `{nom}` dans le texte est remplacé par la valeur fournie. */
export function t(key: TranslationKey, params: Record<string, string> = {}): string {
  const text = dictionaries[current][key] ?? dictionaries.fr[key];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}
