/** Jauge fine sous l'icône d'un objet qui a une charge ou une usure (batterie portable, kit de réparation, armure). */
import { fillOf, levelInfo, trackedOf } from '../core/data/itemData';
import type { GameState } from '../core/game/state';
import { t, type TranslationKey } from '../i18n';

/** Remplissage (0 à 1) de la jauge de cet objet, ou null s'il n'en a pas (ou s'il est neuf et plein). */
export function gaugeOf(item: string): number | null {
  const info = levelInfo(item);
  if (!info) return null;
  const fill = fillOf(item);
  const t = trackedOf(info.base);
  if (fill === null || !t) return null;
  // Un objet neuf et plein n'a pas besoin de jauge ; une batterie vide en a une (elle est « à zéro »).
  return t.start === 'full' && info.level === info.steps ? null : fill;
}

export function itemGauge(_state: GameState, item: string): HTMLElement | null {
  const fill = gaugeOf(item);
  if (fill === null) return null;
  const bar = document.createElement('span');
  bar.className = 'slot-gauge';
  const inner = document.createElement('i');
  // Une batterie vide montre une jauge vide : la largeur minimale ne vaut que pour une charge non nulle.
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  inner.style.width = `${fill > 0 ? Math.max(4, pct) : 0}%`;
  inner.className = fill > 0.5 ? 'hi' : fill > 0.2 ? 'mid' : 'lo';
  bar.append(inner);
  return bar;
}

/** Nom d'un objet pour une info-bulle : pour un objet suivi (batterie, kit, armure), avec sa charge ou son usure en %. */
export function itemLabel(item: string): string {
  const info = levelInfo(item);
  if (!info) return t(`item.${item}` as TranslationKey);
  const pct = Math.round((info.level / info.steps) * 100);
  return `${t(`item.${info.base}` as TranslationKey)} (${pct} %)`;
}
