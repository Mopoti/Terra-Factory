import { BAG_LIMITS, ITEMS } from '../core/data/items';
import { totals } from '../core/game/inventory';
import type { GameState } from '../core/game/state';
import { formatMass } from '../core/units';
import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import { getSettings } from '../settings/store';
import './menu.css';

export interface InventoryActions {
  /** Jette des objets du sac au sol. */
  drop(item: string, count: number): void;
  /** La fenêtre s'ouvre ou se ferme (met le jeu en pause / le relance). */
  onOpenChange(open: boolean): void;
}

export interface InventoryWindow {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gauge(label: string, valueText: string, ratio: number): HTMLElement {
  const box = el('div', 'gauge');
  const head = el('div', 'gauge-head');
  head.append(el('span', undefined, label), el('span', undefined, valueText));
  const bar = el('div', 'gauge-bar');
  const fill = el('div', ratio > 0.9 ? 'gauge-fill full' : 'gauge-fill');
  fill.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
  bar.append(fill);
  box.append(head, bar);
  return box;
}

/** Fenêtre « Sac » : contenu, poids et volume, et jeter des objets au sol. */
export function mountInventory(
  root: HTMLElement,
  state: GameState,
  actions: InventoryActions,
): InventoryWindow {
  let isOpenNow = false;

  function render(): void {
    const used = totals(state.inventory);
    const units = getSettings().display.units;
    const locale = getLocale();
    const panel = el('div', 'panel inventory');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('inv.title'));
    panel.append(el('h2', undefined, t('inv.title')));
    panel.append(
      gauge(
        t('inv.weight'),
        `${formatMass(used.weightG / 1000, units, locale)} / ${formatMass(BAG_LIMITS.maxWeightG / 1000, units, locale)}`,
        used.weightG / BAG_LIMITS.maxWeightG,
      ),
      gauge(
        t('inv.volume'),
        `${(used.volumeMl / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} / ${(BAG_LIMITS.maxVolumeMl / 1000).toLocaleString(locale)} L`,
        used.volumeMl / BAG_LIMITS.maxVolumeMl,
      ),
    );

    const rows = ITEMS.filter((item) => (state.inventory[item.id] ?? 0) > 0);
    if (rows.length === 0) {
      panel.append(el('p', 'note', t('inv.empty')));
    } else {
      const list = el('div', 'inv-list');
      for (const item of rows) {
        const count = state.inventory[item.id];
        const row = el('div', 'inv-row');
        const chip = el('span', 'chip');
        chip.style.background = item.color;
        const name = el('span', 'inv-name', t(`item.${item.id}` as TranslationKey));
        const qty = el('span', 'inv-qty', `×${count}`);
        const info = el(
          'small',
          'inv-info',
          `${formatMass((item.weightG * count) / 1000, units, locale)} · ${((item.volumeMl * count) / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} L`,
        );
        const buttons = el('span', 'inv-actions');
        const drop = (n: number): void => {
          actions.drop(item.id, n);
          render();
        };
        const label = t(`item.${item.id}` as TranslationKey);
        for (const [text, n] of [
          [t('inv.drop1'), 1],
          [t('inv.drop10'), 10],
          [t('inv.dropAll'), count],
        ] as [string, number][]) {
          const b = el('button', undefined, text);
          b.type = 'button';
          b.setAttribute('aria-label', `${text} — ${label}`);
          b.disabled = n > count;
          b.addEventListener('click', () => drop(n));
          buttons.append(b);
        }
        row.append(chip, name, qty, info, buttons);
        list.append(row);
      }
      panel.append(list);
    }
    panel.append(el('small', 'help', t('inv.hint')));
    const close = el('button', 'menu-btn', t('inv.close'));
    close.type = 'button';
    close.addEventListener('click', closeWindow);
    panel.append(close);
    root.replaceChildren(el('div', 'pause-dim'), panel);
  }

  function openWindow(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    root.hidden = false;
    render();
    actions.onOpenChange(true);
  }

  function closeWindow(): void {
    if (!isOpenNow) return;
    isOpenNow = false;
    root.hidden = true;
    root.replaceChildren();
    actions.onOpenChange(false);
  }

  // Échap ferme d'abord le sac, sans ouvrir le menu pause.
  const onKey = (e: KeyboardEvent): void => {
    if (isOpenNow && e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      closeWindow();
    }
  };
  window.addEventListener('keydown', onKey, true);
  const unsubscribeLocale = onLocaleChange(() => isOpenNow && render());
  root.hidden = true;

  return {
    open: openWindow,
    close: closeWindow,
    toggle: () => (isOpenNow ? closeWindow() : openWindow()),
    isOpen: () => isOpenNow,
    dispose: () => {
      window.removeEventListener('keydown', onKey, true);
      unsubscribeLocale();
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
