import { discoveryFor } from '../core/data/discoveries';
import { techFor } from '../core/data/techs';
import {
  ITEM_CATEGORIES,
  ITEMS,
  categoryOf,
  type ItemCategory,
  itemById,
  type EquipSlot,
} from '../core/data/items';
import { totals } from '../core/game/inventory';
import type { GameState } from '../core/game/state';
import { formatMass } from '../core/units';
import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import { getSettings } from '../settings/store';
import { playSfx } from '../audio/sfx';
import { ITEM_DRAG_TYPE } from './hotbar';
import { PIECES } from '../core/data/buildings';
import { machineForItem } from '../core/data/machines';
import type { CommandBus } from '../core/game/commands';
import { BAG_SLOT_TYPE, bagCellsShown, takeAsked, takeHalf, updateHandCursor } from './pick';
import './menu.css';

/** Type MIME d'une pile du sac que l'on déplace (numéro de case). */

/** Objet que l'on peut poser (machine ou pièce de construction). */
const isPlaceable = (item: string): boolean =>
  machineForItem(item) !== null || PIECES.some((p) => p.item === item);

export interface InventoryActions {
  /** Commandes du joueur (fabrication, etc.). */
  bus: CommandBus;
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
  /** Case du sac de la pile choisie (pour fusionner avec une autre pile du même objet). */
  let selectedSlot: number | null = null;
  let craftTab: ItemCategory | null = null;
  let hovered: string | null = null;
  let message = '';
  let mouse = { x: 0, y: 0 };
  const tooltip = el('div', 'inv-tooltip');
  tooltip.hidden = true;

  const itemName = (id: string): string => t(`item.${id}` as TranslationKey);

  /** Cases du sac : des piles de 100 max, déplaçables ; les cases vides sont `null`. */
  const slotList = (): ({ item: string; count: number } | null)[] => state.bagSlots();

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
    const rows: EquipSlot[][] = [['head'], ['torso', 'back'], ['legs', 'hands'], ['feet']];
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
      el('small', 'help', t('equip.armorTotal', { v: String(state.armorPercent()) })),
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
      tooltip.append(
        el(
          'div',
          undefined,
          def.yield > 1 ? `${t('inv.recipe')} (→ ${def.yield})` : t('inv.recipe'),
        ),
      );
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
    if (def.equip?.armor) {
      tooltip.append(el('div', 'ok', t('equip.armor', { v: String(def.equip.armor) })));
    }
    if (def.energyMJ) {
      tooltip.append(el('div', 'note', t('inv.energy', { v: String(def.energyMJ) })));
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
      tooltip.append(el('div', 'lack', lockedReason(hovered)));
    }
    tooltip.append(el('small', undefined, `${t('inv.count')} : ${state.inventory[hovered] ?? 0}`));
    tooltip.hidden = false;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    tooltip.style.left = `${Math.max(8, Math.min(mouse.x + 16, window.innerWidth - w - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(mouse.y + 16, window.innerHeight - h - 8))}px`;
  }

  /** Pourquoi un objet est verrouillé : technologie à rechercher, ou découverte à faire en récoltant. */
  function lockedReason(item: string): string {
    const tech = techFor(item);
    if (tech && !state.changes.unlocked.includes(tech.id))
      return t('tech.needed', { tech: t(`tech.${tech.id}` as TranslationKey) });
    const d = discoveryFor(item);
    if (d)
      return t('discovery.needed', {
        n: String(d.goal.count),
        item: itemName(d.goal.item),
        have: String(state.discoveryProgress(d)),
      });
    return '';
  }

  function craft(item: string, times: number): void {
    const result = actions.bus.dispatch<'queueCraft'>({ type: 'queueCraft', item, times });
    if (result !== 'ok') {
      playSfx('deny');
      message =
        result === 'bag'
          ? t('inv.craftBagFull')
          : result === 'locked'
            ? lockedReason(item)
            : t('inv.noResources');
    } else {
      playSfx('craft');
      message = t('inv.queued', {
        n: String(times),
        item: itemName(item),
        s: state.craftSeconds(item).toFixed(1),
      });
    }
    render();
  }

  /** File d'attente de fabrication : barre de progression et boutons d'annulation. */
  let liveBar: HTMLElement | null = null;
  let liveLabel: HTMLElement | null = null;
  /** Barre de la fabrication en cours : largeur et temps restant. */
  function updateCraftBar(): void {
    const p = state.craftProgress();
    const job = state.craftQueue[0];
    if (liveBar) liveBar.style.width = `${Math.round((p?.fraction ?? 0) * 100)}%`;
    if (liveLabel && job)
      liveLabel.textContent = `${Math.max(0, job.duration - job.elapsed).toFixed(1)} s`;
  }
  function queueBox(): HTMLElement | null {
    liveBar = null;
    if (state.craftQueue.length === 0) return null;
    const box = el('div', 'craft-queue');
    state.craftQueue.forEach((job, i) => {
      const row = el('div', 'craft-job');
      row.append(el('span', undefined, `${itemName(job.item)} ×${job.left}`));
      if (i === 0) {
        const bar = el('div', 'craft-bar');
        const fill = el('div');
        const label = el('span', 'craft-bar-label');
        bar.append(fill, label);
        liveBar = fill;
        liveLabel = label;
        updateCraftBar();
        row.append(bar);
      }
      const cancel = el('button', undefined, '✕');
      cancel.type = 'button';
      cancel.title = t('inv.cancelCraft');
      cancel.addEventListener('click', () => {
        actions.bus.dispatch<'cancelCraft'>({ type: 'cancelCraft', index: i });
        render();
      });
      row.append(cancel);
      box.append(row);
    });
    return box;
  }
  const craftTimer = window.setInterval(() => {
    if (!isOpenNow) return;
    if (state.craftQueue.length === 0 && liveBar === null) return;
    if (!liveBar || state.craftQueue.length > 0 !== (liveBar !== null)) return render();
    updateCraftBar();
  }, 200);

  function render(): void {
    const used = totals(state.inventory);
    const units = getSettings().display.units;
    const locale = getLocale();
    const panel = el('div', 'panel inventory');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('inv.title'));
    panel.append(el('h2', undefined, t('inv.title')));
    const slots = slotList();
    const usedSlots = slots.filter(Boolean).length;
    panel.append(
      gauge(
        t('inv.weight'),
        `${formatMass(used.weightG / 1000, units, locale)} / ${Number.isFinite(state.limits.maxWeightG) ? formatMass(state.limits.maxWeightG / 1000, units, locale) : t('inv.unlimited')}`,
        Number.isFinite(state.limits.maxWeightG) ? used.weightG / state.limits.maxWeightG : 0,
      ),
      gauge(
        t('inv.volume'),
        `${(used.volumeMl / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} / ${Number.isFinite(state.limits.maxVolumeMl) ? `${(state.limits.maxVolumeMl / 1000).toLocaleString(locale)} L` : t('inv.unlimited')}`,
        Number.isFinite(state.limits.maxVolumeMl) ? used.volumeMl / state.limits.maxVolumeMl : 0,
      ),
      gauge(
        t('inv.slots'),
        `${usedSlots} / ${state.limits.maxSlots}`,
        usedSlots / state.limits.maxSlots,
      ),
    );

    const layout = el('div', 'inv-layout inv-layout-3');

    // Gauche : les cases du sac.
    const bag = el('div', 'inv-bag');
    const grid = el('div', 'slot-grid');
    for (let i = 0; i < bagCellsShown(state); i++) {
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
        cell.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData(ITEM_DRAG_TYPE, slot.item);
          e.dataTransfer?.setData(BAG_SLOT_TYPE, String(i));
        });
        // Lâchée hors de la fenêtre (ou sur le fond), la pile tombe par terre.
        cell.addEventListener('dragend', (e) => {
          const over = document.elementFromPoint(e.clientX, e.clientY);
          if (e.dataTransfer?.dropEffect !== 'none' || over?.closest('.panel')) return;
          const dropped = state.clearBagSlot(i);
          if (dropped) actions.drop(dropped.item, dropped.count);
          render();
        });
        cell.addEventListener('click', (e) => {
          if (state.hand) {
            if (!state.placeHand(i)) playSfx('deny');
            render();
            return;
          }
          if (e.shiftKey) return;
          if (e.ctrlKey || e.metaKey) {
            void takeAsked(state, slot.item, itemName(slot.item), slot.count, e, i).then(render);
            return;
          }
          // Une pile est déjà choisie et on clique une autre pile du même objet : elles fusionnent.
          if (selected === slot.item && selectedSlot !== null && selectedSlot !== i) {
            state.moveBagSlot(selectedSlot, i);
            selectedSlot = null;
            playSfx('pickup');
            render();
            return;
          }
          selected = selected === slot.item ? null : slot.item;
          selectedSlot = selected ? i : null;
          // L'objet choisi peut être rangé dans une case de la barre de raccourcis d'un clic.
          state.carried = selected;
          render();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          takeHalf(state, slot.item, slot.count, e, i);
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
          state.placeHand(i);
          render();
        });
      }
      // Glisser une pile sur une autre case : on la déplace (vide), la fusionne (même objet) ou l'échange.
      cell.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(BAG_SLOT_TYPE)) e.preventDefault();
      });
      cell.addEventListener('drop', (e) => {
        const from = e.dataTransfer?.getData(BAG_SLOT_TYPE);
        if (from === undefined || from === '') return;
        e.preventDefault();
        state.moveBagSlot(Number(from), i);
        render();
      });
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
    } else {
      selected = null;
      bag.append(el('small', 'help', usedSlots === 0 ? t('inv.empty') : t('inv.selectHint')));
    }

    // Droite : tous les objets, à fabriquer.
    const craftBox = el('div', 'inv-craft');
    craftBox.append(el('h3', undefined, t('inv.craftTitle')));
    // Seuls les objets déjà débloqués se montrent ; un onglet sans objet disparaît.
    const visible = ITEMS.filter((i) => i.recipe !== null && state.isUnlocked(i.id));
    const tabsShown = ITEM_CATEGORIES.filter((c) => visible.some((i) => categoryOf(i) === c));
    if (craftTab === null || !tabsShown.includes(craftTab)) craftTab = tabsShown[0] ?? null;
    const tabs = el('div', 'craft-tabs');
    for (const category of tabsShown) {
      const tab = el('button', category === craftTab ? 'craft-tab active' : 'craft-tab');
      tab.type = 'button';
      tab.textContent = t(`craft.cat.${category}` as TranslationKey);
      tab.addEventListener('click', () => {
        craftTab = category;
        hovered = null;
        render();
      });
      tabs.append(tab);
    }
    craftBox.append(tabs);
    const catalog = el('div', 'slot-grid craft-grid');
    for (const def of visible.filter((i) => categoryOf(i) === craftTab)) {
      const cell = el('button', 'slot craft');
      cell.type = 'button';
      cell.style.setProperty('--item', def.color);
      const canCraft =
        def.recipe !== null &&
        Object.entries(def.recipe).every(([id, n]) => (state.inventory[id] ?? 0) >= n);
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
    const queue = queueBox();
    if (queue) craftBox.append(queue);

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
    updateHandCursor(state, selected);
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
    // Un objet posable choisi dans le sac reste en main (clic droit : mains vides).
    if (selected && isPlaceable(selected) && (state.inventory[selected] ?? 0) > 0)
      state.setHeld(selected);
    state.carried = null;
    state.returnHand();
    // Fenêtre fermée : l'objet choisi n'est plus au bout du curseur (s'il est posable, il est en main).
    updateHandCursor(state, null);
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
      window.clearInterval(craftTimer);
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
