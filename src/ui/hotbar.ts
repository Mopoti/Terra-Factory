import { itemById } from '../core/data/items';
import type { GameState } from '../core/game/state';
import { HOTBAR_SLOTS } from '../core/game/worldChanges';
import { t, onLocaleChange, type TranslationKey } from '../i18n';

export interface Hotbar {
  dispose(): void;
}

/** Type MIME des objets que l'on glisse du sac vers la barre. */
export const ITEM_DRAG_TYPE = 'text/x-terra-item';

/**
 * Barre de raccourcis en bas de l'écran : 9 cases (touches 1 à 9). Cliquer une case (ou sa touche) la
 * sélectionne ; si elle contient une pièce de construction, on peut la poser. On y range un objet en le
 * glissant depuis le sac, ou en le choisissant dans le sac puis en cliquant la case. Clic droit : vider.
 */
export function mountHotbar(root: HTMLElement, state: GameState): Hotbar {
  const bar = document.createElement('div');
  bar.className = 'hotbar';
  bar.setAttribute('role', 'toolbar');
  root.appendChild(bar);

  function render(): void {
    bar.replaceChildren();
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const item = state.changes.hotbar[i];
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'hot-slot';
      slot.classList.toggle('selected', state.selectedSlot === i);
      const key = document.createElement('span');
      key.className = 'hot-key';
      key.textContent = String(i + 1);
      slot.append(key);
      if (item) {
        const def = itemById(item);
        const count = state.inventory[item] ?? 0;
        slot.style.setProperty('--item', def.color);
        slot.classList.toggle('poor', count === 0);
        const name = document.createElement('span');
        name.className = 'hot-name';
        name.textContent = t(`item.${item}` as TranslationKey);
        const qty = document.createElement('span');
        qty.className = 'hot-count';
        qty.textContent = String(count);
        slot.append(name, qty);
        slot.title = t(`item.${item}` as TranslationKey);
      } else {
        slot.classList.add('empty');
        slot.title = t('hotbar.empty');
      }
      slot.addEventListener('click', () => {
        if (state.carried) state.assignSlot(i, state.carried);
        else state.selectSlot(i);
      });
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.assignSlot(i, null);
      });
      slot.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
      });
      slot.addEventListener('drop', (e) => {
        const id = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
        if (!id) return;
        e.preventDefault();
        state.assignSlot(i, id);
      });
      bar.append(slot);
    }
  }

  render();
  const off = state.onChange((e) => {
    if (e.type === 'hotbar' || e.type === 'inventory') render();
  });
  const offLocale = onLocaleChange(render);
  return {
    dispose: () => {
      off();
      offLocale();
      bar.remove();
    },
  };
}
