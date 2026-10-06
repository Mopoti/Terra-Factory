import { techFor } from '../core/data/techs';
import { ITEMS, itemById, type EquipSlot } from '../core/data/items';
import { totals } from '../core/game/inventory';
import type { GameState } from '../core/game/state';
import { formatMass } from '../core/units';
import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import { getSettings } from '../settings/store';
import { playSfx } from '../audio/sfx';
import { ITEM_DRAG_TYPE } from './hotbar';
import { takeAsked, takeHalf, updateHandCursor } from './pick';
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
  let selected: string | null = null;
  let hovered: string | null = null;
  let message = '';
  let mouse = { x: 0, y: 0 };
  const tooltip = el('div', 'inv-tooltip');
  tooltip.hidden = true;

  const itemName = (id: string): string => t(`item.${id}` as TranslationKey);

  /** Cases du sac : une pile de 100 max par case, dans l'ordre du catalogue. */
  function slotList(): { item: string; count: number }[] {
    const slots: { item: string; count: number }[] = [];
    for (const item of ITEMS) {
      let left = state.inventory[item.id] ?? 0;
      while (left > 0) {
        const n = Math.min(left, state.limits.stackMax);
        slots.push({ item: item.id, count: n });
        left -= n;
      }
    }
    return slots;
  }

  /** Colonne d'équipement : tête, tronc (+ mains à côté), jambes, pieds. */
  function equipmentColumn(): HTMLElement {
    const col = el('div', 'inv-equip');
    col.append(el('h3', undefined, t('equip.title')));
    const slotBox = (slot: EquipSlot): HTMLElement => {
      const id = state.changes.equipment[slot];
      const cell = el('button', id ? 'slot equip-slot' : 'slot equip-slot empty');
      cell.type = 'button';
      cell.title = t(`equip.${slot}` as TranslationKey);
      cell.append(el('span', 'equip-label', t(`equip.${slot}` as TranslationKey)));
      if (id) {
        cell.style.setProperty('--item', itemById(id).color);
        cell.append(el('span', 'slot-name', itemName(id)));
        cell.addEventListener('mouseenter', () => {
          hovered = id;
          showTooltip();
        });
        cell.addEventListener('mouseleave', () => {
          hovered = null;
          showTooltip();
        });
      }
      const equipItem = (item: string): void => {
        state.returnHand();
        if (itemById(item).equip?.slot !== slot) {
          playSfx('deny');
          message = t('equip.slotOf', {
            slot: t(`equip.${itemById(item).equip?.slot ?? slot}` as TranslationKey),
          });
        } else {
          const result = state.equip(item);
          playSfx(result === 'ok' ? 'pickup' : 'deny');
          message = result === 'bagFull' ? t('equip.bagFull') : '';
          if (result === 'ok') selected = null;
        }
        render();
      };
      cell.addEventListener('click', () => {
        const held = state.hand?.item ?? selected;
        if (held) return equipItem(held);
        if (id) {
          const result = state.unequip(slot);
          playSfx(result === 'ok' ? 'pickup' : 'deny');
          message = result === 'bagFull' ? t('equip.bagFull') : '';
          render();
        }
      });
      cell.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
      });
      cell.addEventListener('drop', (e) => {
        const dropped = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
        if (!dropped) return;
        e.preventDefault();
        equipItem(dropped);
      });
      return cell;
    };
    const rows: EquipSlot[][] = [['head'], ['torso', 'hands'], ['legs'], ['feet']];
    for (const row of rows) {
      const r = el('div', 'equip-row');
      for (const slot of row) r.append(slotBox(slot));
      col.append(r);
    }
    const bonus = state.limits;
    col.append(
      el(
        'small',
        'help',
        `${t('equip.bonus', {
          slots: String(bonus.maxSlots - state.baseLimitsView().maxSlots),
          kg: String((bonus.maxWeightG - state.baseLimitsView().maxWeightG) / 1000),
          l: String((bonus.maxVolumeMl - state.baseLimitsView().maxVolumeMl) / 1000),
        })}`,
      ),
      el('small', 'help', t('equip.hint')),
    );
    return col;
  }

  function showTooltip(): void {
    if (!hovered || !isOpenNow) {
      tooltip.hidden = true;
      return;
    }
    const def = itemById(hovered);
    tooltip.replaceChildren(el('strong', undefined, itemName(hovered)));
    if (def.recipe) {
      tooltip.append(el('div', undefined, t('inv.recipe')));
      for (const [id, n] of Object.entries(def.recipe)) {
        const have = state.inventory[id] ?? 0;
        const line = el('div', have >= n ? 'ok' : 'lack', `${n} × ${itemName(id)} `);
        line.append(el('small', undefined, t('inv.have', { n: String(have) })));
        tooltip.append(line);
      }
    } else {
      tooltip.append(el('div', 'note', t('inv.raw')));
    }
    if (def.equip && (def.equip.bonus.slots || def.equip.bonus.weightG)) {
      tooltip.append(
        el(
          'div',
          'ok',
          t('equip.bonus', {
            slots: String(def.equip.bonus.slots),
            kg: String(def.equip.bonus.weightG / 1000),
            l: String(def.equip.bonus.volumeMl / 1000),
          }),
        ),
      );
    }
    if (def.equip) {
      tooltip.append(
        el(
          'div',
          'note',
          t('equip.slotOf', { slot: t(`equip.${def.equip.slot}` as TranslationKey) }),
        ),
      );
    }
    if (!state.isUnlocked(hovered)) {
      tooltip.append(
        el(
          'div',
          'lack',
          t('tech.needed', { tech: t(`tech.${techFor(hovered)?.id ?? ''}` as TranslationKey) }),
        ),
      );
    }
    tooltip.append(el('small', undefined, `${t('inv.count')} : ${state.inventory[hovered] ?? 0}`));
    tooltip.hidden = false;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    tooltip.style.left = `${Math.max(8, Math.min(mouse.x + 16, window.innerWidth - w - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(mouse.y + 16, window.innerHeight - h - 8))}px`;
  }

  function craft(item: string, times: number): void {
    const { made, stopped } = state.craft(item, times);
    if (made === 0) {
      playSfx('deny');
      message =
        stopped === 'bag'
          ? t('inv.craftBagFull')
          : stopped === 'locked'
            ? t('tech.needed', { tech: t(`tech.${techFor(item)?.id ?? ''}` as TranslationKey) })
            : t('inv.noResources');
    } else if (made < times) {
      playSfx('craft');
      message = t('inv.craftedPartial', { n: String(made), item: itemName(item) });
    } else {
      playSfx('craft');
      message = t('inv.crafted', { n: String(made), item: itemName(item) });
    }
    render();
  }

  function render(): void {
    const used = totals(state.inventory);
    const units = getSettings().display.units;
    const locale = getLocale();
    const panel = el('div', 'panel inventory');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('inv.title'));
    panel.append(el('h2', undefined, t('inv.title')));
    const slots = slotList();
    panel.append(
      gauge(
        t('inv.weight'),
        `${formatMass(used.weightG / 1000, units, locale)} / ${formatMass(state.limits.maxWeightG / 1000, units, locale)}`,
        used.weightG / state.limits.maxWeightG,
      ),
      gauge(
        t('inv.volume'),
        `${(used.volumeMl / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} / ${(state.limits.maxVolumeMl / 1000).toLocaleString(locale)} L`,
        used.volumeMl / state.limits.maxVolumeMl,
      ),
      gauge(
        t('inv.slots'),
        `${slots.length} / ${state.limits.maxSlots}`,
        slots.length / state.limits.maxSlots,
      ),
    );

    const layout = el('div', 'inv-layout inv-layout-3');

    // Gauche : les cases du sac.
    const bag = el('div', 'inv-bag');
    const grid = el('div', 'slot-grid');
    for (let i = 0; i < state.limits.maxSlots; i++) {
      const slot = slots[i];
      const cell = el('button', slot ? 'slot' : 'slot empty');
      cell.type = 'button';
      if (slot) {
        const def = itemById(slot.item);
        cell.style.setProperty('--item', def.color);
        cell.classList.toggle('selected', slot.item === selected);
        cell.append(
          el('span', 'slot-name', itemName(slot.item)),
          el('span', 'slot-count', String(slot.count)),
        );
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) =>
          e.dataTransfer?.setData(ITEM_DRAG_TYPE, slot.item),
        );
        cell.addEventListener('click', (e) => {
          if (state.hand) {
            state.returnHand();
            render();
            return;
          }
          if (e.ctrlKey || e.metaKey) {
            void takeAsked(state, slot.item, itemName(slot.item), slot.count, e).then(render);
            return;
          }
          selected = selected === slot.item ? null : slot.item;
          // L'objet choisi peut être rangé dans une case de la barre de raccourcis d'un clic.
          state.carried = selected;
          render();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          takeHalf(state, slot.item, slot.count, e);
          render();
        });
        cell.addEventListener('mouseenter', () => {
          hovered = slot.item;
          showTooltip();
        });
        cell.addEventListener('mouseleave', () => {
          hovered = null;
          showTooltip();
        });
      } else {
        cell.addEventListener('click', () => {
          if (!state.hand) return;
          state.returnHand();
          render();
        });
      }
      grid.append(cell);
    }
    bag.append(grid);
    const count = selected ? (state.inventory[selected] ?? 0) : 0;
    if (selected && count > 0) {
      bag.append(
        el(
          'div',
          'inv-selected',
          t('inv.selected', { item: itemName(selected), n: String(count) }),
        ),
      );
      const buttons = el('span', 'inv-actions');
      for (const [text, n] of [
        [t('inv.drop1'), 1],
        [t('inv.drop10'), 10],
        [t('inv.dropAll'), count],
      ] as [string, number][]) {
        const b = el('button', undefined, text);
        b.type = 'button';
        b.disabled = n > count;
        b.addEventListener('click', () => {
          actions.drop(selected as string, n);
          render();
        });
        buttons.append(b);
      }
      bag.append(buttons);
    } else {
      selected = null;
      bag.append(el('small', 'help', slots.length === 0 ? t('inv.empty') : t('inv.selectHint')));
    }

    // Droite : tous les objets, à fabriquer.
    const craftBox = el('div', 'inv-craft');
    craftBox.append(el('h3', undefined, t('inv.craftTitle')));
    const catalog = el('div', 'slot-grid craft-grid');
    for (const def of ITEMS) {
      const cell = el('button', 'slot craft');
      cell.type = 'button';
      cell.style.setProperty('--item', def.color);
      const canCraft =
        def.recipe !== null &&
        Object.entries(def.recipe).every(([id, n]) => (state.inventory[id] ?? 0) >= n);
      cell.classList.toggle('raw', def.recipe === null);
      cell.classList.toggle('locked', !state.isUnlocked(def.id));
      cell.classList.toggle('lack', def.recipe !== null && !canCraft);
      cell.append(el('span', 'slot-name', itemName(def.id)));
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => e.dataTransfer?.setData(ITEM_DRAG_TYPE, def.id));
      cell.addEventListener('click', () => def.recipe && craft(def.id, 1));
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (def.recipe) craft(def.id, 5);
      });
      cell.addEventListener('mouseenter', () => {
        hovered = def.id;
        showTooltip();
      });
      cell.addEventListener('mouseleave', () => {
        hovered = null;
        showTooltip();
      });
      catalog.append(cell);
    }
    craftBox.append(catalog, el('small', 'help', t('inv.craftHint')));
    craftBox.append(el('div', 'inv-message', message));

    layout.append(equipmentColumn(), bag, craftBox);
    panel.append(layout);
    panel.append(el('small', 'help', t('inv.hint')), el('small', 'help', t('hotbar.hint')));
    const x = el('button', 'panel-close', '✕');
    x.type = 'button';
    x.title = t('inv.close');
    x.setAttribute('aria-label', t('inv.close'));
    x.addEventListener('click', closeWindow);
    panel.append(x);
    root.replaceChildren(el('div', 'pause-dim'), panel, tooltip);
    showTooltip();
    updateHandCursor(state);
  }

  const onMove = (e: MouseEvent): void => {
    mouse = { x: e.clientX, y: e.clientY };
    if (hovered) showTooltip();
  };
  window.addEventListener('mousemove', onMove);

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
    state.carried = null;
    state.returnHand();
    updateHandCursor(state);
    hovered = null;
    message = '';
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
      window.removeEventListener('mousemove', onMove);
      unsubscribeLocale();
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
