/**
 * Profil du joueur : son apparence, enregistrée dans le navigateur (comme les réglages) et reprise dans chaque
 * partie, y compris en multijoueur.
 */
import { defaultAppearance, normalizeAppearance, type Appearance } from './appearance';

const STORAGE_KEY = 'terra.character';

const PSEUDO_KEY = 'terra.pseudo';
export const PSEUDO_MAX = 20;

let current: Appearance = defaultAppearance();
const listeners = new Set<(a: Appearance) => void>();

function read(): unknown {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** Relit le profil enregistré (à appeler au démarrage). */
export function loadCharacter(): Appearance {
  current = normalizeAppearance(read());
  return current;
}

export function getCharacter(): Appearance {
  return current;
}

export function onCharacterChange(fn: (a: Appearance) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Enregistre l'apparence (elle est d'abord rendue valide). */
export function setCharacter(next: Appearance): Appearance {
  current = normalizeAppearance(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* stockage indisponible : le profil dure le temps de la session */
  }
  listeners.forEach((fn) => fn(current));
  return current;
}

/** Pseudo du joueur (vide tant qu'il n'en a pas choisi) : repris comme nom en multijoueur. */
export function getPseudo(): string {
  try {
    return (localStorage.getItem(PSEUDO_KEY) ?? '').slice(0, PSEUDO_MAX);
  } catch {
    return '';
  }
}

export function setPseudo(value: string): string {
  const pseudo = value.trim().slice(0, PSEUDO_MAX);
  try {
    localStorage.setItem(PSEUDO_KEY, pseudo);
  } catch {
    /* stockage indisponible : le pseudo n'est pas conservé */
  }
  return pseudo;
}
