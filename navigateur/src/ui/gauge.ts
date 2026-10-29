/** Jauge fine sous l'icône d'un objet qui contient de l'énergie ou des charges (batterie portable, kit de réparation entamé). */
import type { GameState } from '../core/game/state';
import { REPAIR_KIT_CHARGES } from '../core/game/state';

/** Remplissage (0 à 1) de la jauge de cet objet, ou null s'il n'en a pas. */
export function gaugeOf(state: GameState, item: string): number | null {
  if (item === 'battery_portable') return state.batteryFill();
  if (item === 'repair_kit') return state.changes.kitCharges / REPAIR_KIT_CHARGES;
  return null;
}

export function itemGauge(state: GameState, item: string): HTMLElement | null {
  const fill = gaugeOf(state, item);
  if (fill === null) return null;
  const bar = document.createElement('span');
  bar.className = 'slot-gauge';
  const inner = document.createElement('i');
  inner.style.width = `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%`;
  inner.className = fill > 0.5 ? 'hi' : fill > 0.2 ? 'mid' : 'lo';
  bar.append(inner);
  return bar;
}
