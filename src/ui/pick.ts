import type { GameState } from '../core/game/state';
import { itemById } from '../core/data/items';
import { t, type TranslationKey } from '../i18n';
import { promptModal } from './modal';

let cursor: HTMLElement | null = null;
let last = { x: 0, y: 0 };

function place(): void {
  if (cursor) cursor.style.transform = `translate(${last.x + 14}px, ${last.y + 14}px)`;
}

window.addEventListener(
  'mousemove',
  (e) => {
    last = { x: e.clientX, y: e.clientY };
    place();
  },
  true,
);

/** Affiche (ou cache) la pile tenue au bout du curseur. */
export function updateHandCursor(state: GameState): void {
  const hand = state.hand;
  if (!hand) {
    cursor?.remove();
    cursor = null;
    return;
  }
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.className = 'hand-cursor';
    document.body.append(cursor);
  }
  cursor.style.setProperty('--item', itemById(hand.item).color);
  cursor.textContent = `${t(`item.${hand.item}` as TranslationKey)} ×${hand.count}`;
  place();
}

/** Clic droit sur une pile du sac : on en prend la moitié (arrondie au-dessus) au bout du curseur. */
export function takeHalf(
  state: GameState,
  item: string,
  stackCount: number,
  at: MouseEvent,
  slot?: number,
): void {
  last = { x: at.clientX, y: at.clientY };
  state.takeToHand(item, Math.max(1, Math.ceil(stackCount / 2)), slot);
}

/** Demande une quantité (1 à `max`) au joueur ; null s'il annule. */
export async function askAmount(
  itemName: string,
  max: number,
  at: MouseEvent,
): Promise<number | null> {
  last = { x: at.clientX, y: at.clientY };
  const value = await promptModal({
    title: itemName,
    label: t('inv.pickLabel', { max: String(max) }),
    value: String(max),
    confirmLabel: t('inv.pickConfirm'),
    cancelLabel: t('inv.pickCancel'),
    maxLength: 4,
    validate: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= max
        ? null
        : t('inv.pickInvalid', { max: String(max) });
    },
  });
  return value === null ? null : Number(value);
}

/** Ctrl + clic gauche : le joueur choisit la quantité à prendre. */
export async function takeAsked(
  state: GameState,
  item: string,
  itemName: string,
  stackCount: number,
  at: MouseEvent,
  slot?: number,
): Promise<void> {
  const n = await askAmount(itemName, stackCount, at);
  if (n !== null) state.takeToHand(item, n, slot);
}
