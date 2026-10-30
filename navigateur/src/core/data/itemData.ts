/**
 * Données par objet (charge d'une batterie, charges d'un kit, usure d'une armure) : un objet suivi existe en plusieurs
 * « niveaux », chacun avec son propre identifiant (`base~niveau`). Ainsi piles, coffres, sols, échanges et sauvegardes
 * le gardent sans code particulier : ce sont des objets comme les autres, qui ne se mélangent qu'à égal niveau.
 *
 * Le niveau de départ garde l'identifiant de base : plein pour un kit ou une armure neufs, vide pour une batterie qu'on
 * vient de fabriquer.
 */
export interface Tracked {
  /** Niveau maximal (le niveau va de 0 à `steps`). */
  steps: number;
  /** Niveau d'un objet neuf : plein (`steps`) ou vide (0). Il garde l'identifiant de base. */
  start: 'full' | 'empty';
}

const ARMOR = /^armor[1-5]_(head|torso|legs|feet)$/;

/** Description du suivi d'un objet de base, ou null s'il n'en a pas. */
export function trackedOf(base: string): Tracked | null {
  if (base === 'repair_kit') return { steps: 5, start: 'full' };
  if (base === 'battery_portable') return { steps: 10, start: 'empty' };
  if (ARMOR.test(base)) return { steps: 10, start: 'full' };
  return null;
}

/** Identifiant de l'objet `base` au niveau `level` (0 à `steps`). */
export function variantId(base: string, level: number): string {
  const t = trackedOf(base);
  if (!t) return base;
  const l = Math.max(0, Math.min(t.steps, Math.round(level)));
  return l === (t.start === 'full' ? t.steps : 0) ? base : `${base}~${l}`;
}

/** Objet de base et niveau d'un identifiant (null si ce n'est pas un objet suivi). */
export function levelInfo(id: string): { base: string; level: number; steps: number } | null {
  const i = id.indexOf('~');
  const base = i < 0 ? id : id.slice(0, i);
  const t = trackedOf(base);
  if (!t) return null;
  if (i < 0) return { base, level: t.start === 'full' ? t.steps : 0, steps: t.steps };
  const level = Number(id.slice(i + 1));
  if (!Number.isInteger(level) || level < 0 || level > t.steps) return null;
  return { base, level, steps: t.steps };
}

/** Objet de base d'un identifiant (le même s'il n'a pas de niveau). */
export const baseOf = (id: string): string =>
  id.includes('~') ? id.slice(0, id.indexOf('~')) : id;

/** Part pleine d'un objet suivi (0 à 1), ou null. */
export function fillOf(id: string): number | null {
  const info = levelInfo(id);
  return info ? info.level / info.steps : null;
}

/** Tous les identifiants de cet objet, du plus vide au plus plein. */
export function allLevels(base: string): string[] {
  const t = trackedOf(base);
  if (!t) return [base];
  return Array.from({ length: t.steps + 1 }, (_, l) => variantId(base, l));
}
