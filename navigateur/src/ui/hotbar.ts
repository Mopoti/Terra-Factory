import { playSfx } from '../audio/sfx';
import { itemGauge } from './gauge';
import { itemIcon } from './itemIcon';
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
 * Barre de raccourcis en bas de l'écran : 10 cases (touches 1 à 9 puis 0). Cliquer une case (ou sa touche) la
 * sélectionne ; si elle contient une pièce de construction, on peut la poser. On y range un objet en le
 * glissant depuis le sac, ou en le choisissant dans le sac puis en cliquant la case. Clic droit : vider.
 */
export function mountHotbar(
  root: HTMLElement,
  state: GameState,
  actions: { onMessage?: (text: string) => void } = {},
): Hotbar {
  const bar = document.createElement('div');
  bar.className = 'hotbar';
  bar.setAttribute('role', 'toolbar');
  // Barre en plus (plastron d'armure T4 ou T5), au-dessus de la principale.
  const extra = document.createElement('div');
  extra.className = 'hotbar hotbar-extra';
  extra.setAttribute('role', 'toolbar');
  extra.title = t('hotbar.extra');
  root.append(extra, bar);

  function render(): void {
    fill(bar, 0);
    extra.hidden = !state.hasExtraBar();
    // Les informations de survie (santé, armure, munitions) montent au-dessus des deux barres.
    document.body.classList.toggle('extra-hotbar', state.hasExtraBar());
    extra.classList.toggle('off', !state.extraBarOn());
    const inExtra = state.selectedSlot !== null && state.selectedSlot >= HOTBAR_SLOTS;
    extra.classList.toggle('active', inExtra);
    bar.classList.toggle('active', !inExtra && state.selectedSlot !== null && state.hasExtraBar());
    if (state.hasExtraBar()) fill(extra, HOTBAR_SLOTS);
    else extra.replaceChildren();
  }

  /** Remplit une barre : ses 10 cases sont celles de `first` à `first + 9`. */
  function fill(target: HTMLElement, first: number): void {
    target.replaceChildren();
    for (let k = 0; k < HOTBAR_SLOTS; k++) {
      const i = first + k;
      const item = state.slotItem(i);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'hot-slot';
      slot.classList.toggle('selected', state.selectedSlot === i);
      const key = document.createElement('span');
      key.className = 'hot-key';
      key.textContent = String((k + 1) % 10);
      slot.append(key);
      if (item) {
        const def = itemById(item);
        const count = state.inventory[item] ?? 0;
        slot.style.setProperty('--item', def.color);
        slot.classList.toggle('poor', count === 0);
        const qty = document.createElement('span');
        qty.className = 'hot-count';
        qty.textContent = String(count);
        slot.append(itemIcon(item), qty);
        const gauge = itemGauge(state, item);
        if (gauge) slot.append(gauge);
        slot.title = t(`item.${item}` as TranslationKey);
      } else {
        slot.classList.add('empty');
        slot.title = t('hotbar.empty');
      }
      slot.addEventListener('click', () => {
        if (state.hand) {
          // La pile tenue au curseur donne son objet à la case, puis retourne dans le sac.
          state.assignSlot(i, state.hand.item);
          state.returnHand();
        } else if (state.carried) state.assignSlot(i, state.carried);
        else {
          // Une case de la barre en plus ne se choisit pas sans plastron T4 ou T5 allumé et chargé : on dit pourquoi.
          const refusal = i >= HOTBAR_SLOTS ? state.extraBarRefusal() : null;
          if (refusal) actions.onMessage?.(t(`hotbar.extra.${refusal}` as TranslationKey));
          else {
            state.selectSlot(i);
            playSfx('select');
          }
        }
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
      target.append(slot);
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
      extra.remove();
      document.body.classList.remove('extra-hotbar');
    },
  };
}
