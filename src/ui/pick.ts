import type { GameState } from '../core/game/state';
import { t } from '../i18n';
import { promptModal } from './modal';

/** Clic droit sur une pile du sac : on en prend la moitié (arrondie au-dessus). */
export function pickHalf(state: GameState, item: string, stackCount: number): void {
  state.carried = item;
  state.pick = { item, count: Math.max(1, Math.ceil(stackCount / 2)) };
}

/** Ctrl + clic gauche : le joueur choisit la quantité. Renvoie vrai si une quantité a été retenue. */
export async function pickAsked(
  state: GameState,
  item: string,
  itemName: string,
  stackCount: number,
): Promise<boolean> {
  const value = await promptModal({
    title: itemName,
    label: t('inv.pickLabel', { max: String(stackCount) }),
    value: String(stackCount),
    confirmLabel: t('inv.pickConfirm'),
    cancelLabel: t('inv.pickCancel'),
    maxLength: 4,
    validate: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= stackCount
        ? null
        : t('inv.pickInvalid', { max: String(stackCount) });
    },
  });
  if (value === null) return false;
  state.carried = item;
  state.pick = { item, count: Number(value) };
  return true;
}

/** Quantité à déplacer pour cet objet : celle choisie, sinon `fallback`. */
export const pickedCount = (state: GameState, item: string, fallback: number): number =>
  state.pick && state.pick.item === item ? state.pick.count : fallback;
