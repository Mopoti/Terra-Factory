import { playSfx } from '../audio/sfx';
import { BAG_LIMITS, ITEMS, itemById } from '../core/data/items';
import { isChest, isDrill, machineDef, smeltRecipe } from '../core/data/machines';
import { footprint, type Factory, type Machine, type Stack } from '../core/factory/factory';
import { totals } from '../core/game/inventory';
import type { GameState } from '../core/game/state';
import { onLocaleChange, t, type TranslationKey } from '../i18n';
import { ITEM_DRAG_TYPE } from './hotbar';
import './menu.css';

export interface MachineWindow {
  open(id: number): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

type SlotName = 'fuel' | 'input' | 'stock';
/** Type MIME d'une case de machine que l'on glisse vers le sac pour la reprendre. */
const MACHINE_SLOT_TYPE = 'text/x-terra-machine-slot';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const itemName = (id: string): string => t(`item.${id}` as TranslationKey);
const duration = (sec: number): string =>
  sec >= 60 ? `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s` : `${Math.round(sec)} s`;

/**
 * Fenêtre d'une foreuse ou d'un fourneau. Le sac reste affiché à gauche (à la place de la fabrication) : on y
 * prend un objet, on le glisse (ou on le clique puis on clique la case) dans une case de la machine ; on
 * reprend le contenu d'une case en la glissant sur le sac, ou avec le bouton « Reprendre ».
 */
export function mountMachineWindow(
  root: HTMLElement,
  state: GameState,
  factory: Factory,
  actions: { onOpenChange(open: boolean): void },
): MachineWindow {
  let current: number | null = null;
  let timer = 0;
  /** Objet du sac choisi par un clic, à déposer d'un clic dans une case de la machine. */
  let selected: string | null = null;
  /** Pendant un glisser-déposer on ne redessine pas (cela l'annulerait). */
  let dragging = false;

  /** Éléments dont le texte change en continu (on les met à jour sans refaire la fenêtre). */
  let live: {
    status?: HTMLElement;
    fuel?: HTMLElement;
    ore?: HTMLElement;
    counts: Map<SlotName, HTMLElement>;
    chest: HTMLElement[];
  } = { counts: new Map(), chest: [] };
  /** Ce qui, s'il change, oblige à redessiner la fenêtre (sac, présence d'objets dans les cases). */
  let lastShape = '';
  const shape = (m: Machine): string =>
    JSON.stringify([
      state.inventory,
      m.fuel?.item ?? null,
      m.input?.item ?? null,
      m.stock?.item ?? null,
      m.slots.map((x) => x.item),
      selected,
    ]);

  const machine = (): Machine | null =>
    current === null ? null : (factory.machines.find((m) => m.id === current) ?? null);

  /** Une case de la machine peut-elle recevoir cet objet ? */
  const accepts = (m: Machine, slot: SlotName, item: string): boolean =>
    (slot === 'fuel' && machineDef(m.type).fuel && !!itemById(item).fuelSeconds) ||
    (slot === 'input' && m.type === 'furnace' && !!smeltRecipe(item));

  function drop(m: Machine, slot: SlotName, item: string): void {
    if (!accepts(m, slot, item)) {
      playSfx('deny');
      return;
    }
    const max = machineDef(m.type).stockMax ?? 100;
    playSfx(state.loadMachine(m, slot as 'fuel' | 'input', item, max) > 0 ? 'pickup' : 'deny');
    render();
  }

  function machineSlot(
    m: Machine,
    slot: SlotName,
    label: string,
    stack: Stack | null,
  ): HTMLElement {
    const max = machineDef(m.type).stockMax ?? 100;
    const row = el('div', 'mach-row');
    row.append(el('span', 'mach-label', label));
    const box = el('span', stack ? 'mach-slot' : 'mach-slot empty');
    if (stack) {
      box.style.setProperty('--item', itemById(stack.item).color);
      box.append(
        el('span', undefined, itemName(stack.item)),
        (() => {
          const count = el('strong', undefined, `${stack.count} / ${max}`);
          live.counts.set(slot, count);
          return count;
        })(),
      );
      box.draggable = true;
      box.addEventListener('dragstart', (e) => {
        dragging = true;
        e.dataTransfer?.setData(MACHINE_SLOT_TYPE, slot);
      });
      box.addEventListener('dragend', () => {
        dragging = false;
        render();
      });
    } else box.textContent = t('factory.empty');
    if (slot !== 'stock') {
      box.classList.add('target');
      box.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
      });
      box.addEventListener('drop', (e) => {
        const item = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
        if (!item) return;
        e.preventDefault();
        dragging = false;
        drop(m, slot, item);
      });
      box.addEventListener('click', () => {
        if (selected) drop(m, slot, selected);
      });
    }
    row.append(box);
    const take = el('button', undefined, t('machine.take'));
    take.type = 'button';
    take.disabled = stack === null;
    take.addEventListener('click', () => {
      if (state.unloadMachine(m, slot) > 0) playSfx('pickup');
      render();
    });
    row.append(take);
    return row;
  }

  /** Le sac, toujours visible à gauche. */
  function bagColumn(m: Machine): HTMLElement {
    const col = el('div', 'inv-bag');
    const used = totals(state.inventory);
    col.append(
      el(
        'div',
        'mach-info',
        `${(used.weightG / 1000).toFixed(1)} / ${BAG_LIMITS.maxWeightG / 1000} kg · ${(used.volumeMl / 1000).toFixed(1)} / ${BAG_LIMITS.maxVolumeMl / 1000} L`,
      ),
    );
    const slots: { item: string; count: number }[] = [];
    for (const item of ITEMS) {
      let left = state.inventory[item.id] ?? 0;
      while (left > 0) {
        const n = Math.min(left, BAG_LIMITS.stackMax);
        slots.push({ item: item.id, count: n });
        left -= n;
      }
    }
    const grid = el('div', 'slot-grid');
    for (let i = 0; i < BAG_LIMITS.maxSlots; i++) {
      const slot = slots[i];
      const cell = el('button', slot ? 'slot' : 'slot empty');
      cell.type = 'button';
      if (slot) {
        cell.style.setProperty('--item', itemById(slot.item).color);
        cell.classList.toggle('selected', slot.item === selected);
        cell.append(
          el('span', 'slot-name', itemName(slot.item)),
          el('span', 'slot-count', String(slot.count)),
        );
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          dragging = true;
          e.dataTransfer?.setData(ITEM_DRAG_TYPE, slot.item);
        });
        cell.addEventListener('dragend', () => {
          dragging = false;
          render();
        });
        cell.addEventListener('click', () => {
          selected = selected === slot.item ? null : slot.item;
          render();
        });
      } else cell.disabled = true;
      grid.append(cell);
    }
    grid.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes(MACHINE_SLOT_TYPE)) e.preventDefault();
    });
    grid.addEventListener('drop', (e) => {
      const name = e.dataTransfer?.getData(MACHINE_SLOT_TYPE);
      if (!name) return;
      e.preventDefault();
      dragging = false;
      const taken = name.startsWith('chest:')
        ? state.takeFromChest(m, Number(name.slice(6)))
        : state.unloadMachine(m, name as SlotName);
      if (taken > 0) playSfx('pickup');
      render();
    });
    col.append(grid, el('small', 'help', t('machine.dragHint')));
    return col;
  }

  /** Les cases du coffre : on y dépose un objet du sac, on clique ou glisse une case pour la reprendre. */
  function chestGrid(m: Machine): HTMLElement {
    const cap = machineDef(m.type).slots ?? 0;
    const grid = el('div', 'slot-grid chest-grid');
    for (let i = 0; i < cap; i++) {
      const stack = m.slots[i] ?? null;
      const cell = el('button', stack ? 'slot' : 'slot empty');
      cell.type = 'button';
      if (stack) {
        cell.style.setProperty('--item', itemById(stack.item).color);
        const count = el('span', 'slot-count', String(stack.count));
        live.chest[i] = count;
        cell.append(el('span', 'slot-name', itemName(stack.item)), count);
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          dragging = true;
          e.dataTransfer?.setData(MACHINE_SLOT_TYPE, `chest:${i}`);
        });
        cell.addEventListener('dragend', () => {
          dragging = false;
          render();
        });
        cell.addEventListener('click', () => {
          if (state.takeFromChest(m, i) > 0) playSfx('pickup');
          render();
        });
      } else {
        cell.addEventListener('click', () => {
          if (selected) putInChest(m, selected);
        });
      }
      grid.append(cell);
    }
    grid.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
    });
    grid.addEventListener('drop', (e) => {
      const item = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
      if (!item) return;
      e.preventDefault();
      dragging = false;
      putInChest(m, item);
    });
    return grid;
  }

  function putInChest(m: Machine, item: string): void {
    playSfx(state.putInChest(m, item, 100) > 0 ? 'pickup' : 'deny');
    render();
  }

  const fuelText = (m: Machine): string =>
    t('factory.fuel', {
      v: m.fuel ? `${m.fuel.count}` : '0',
      time: duration(factory.fuelSecondsLeft(m)),
    });

  /** Mise à jour douce : seuls les nombres qui bougent changent, les éléments ne sont pas remplacés. */
  function refresh(): void {
    const m = machine();
    if (!m) return close();
    if (shape(m) !== lastShape) return render();
    const status = factory.status(m);
    if (live.status) {
      live.status.className = `st ${status}`;
      live.status.textContent = t(`factory.status.${status}` as TranslationKey);
    }
    if (live.fuel) live.fuel.textContent = fuelText(m);
    if (live.ore) live.ore.textContent = t('factory.ore', { n: String(factory.oreUnder(m).total) });
    m.slots.forEach((stack, i) => {
      const node = live.chest[i];
      if (node) node.textContent = String(stack.count);
    });
    const max = machineDef(m.type).stockMax ?? 100;
    for (const [name, node] of live.counts) {
      const stack = m[name];
      if (stack) node.textContent = `${stack.count} / ${max}`;
    }
  }

  function render(): void {
    const m = machine();
    if (!m) {
      close();
      return;
    }
    const def = machineDef(m.type);
    live = { counts: new Map(), chest: [] };
    lastShape = shape(m);
    const panel = el('div', 'panel machine-window');
    panel.setAttribute('role', 'dialog');
    panel.append(el('h2', undefined, itemName(def.item)));
    const status = factory.status(m);
    const statusEl = el('div', `st ${status}`, t(`factory.status.${status}` as TranslationKey));
    live.status = statusEl;
    panel.append(statusEl);

    const rows = el('div', 'mach-rows');
    rows.append(el('h3', undefined, itemName(def.item)));
    if (isChest(m.type)) rows.append(chestGrid(m), el('small', 'help', t('machine.chestHint')));
    if (def.fuel) {
      rows.append(machineSlot(m, 'fuel', t('machine.fuel'), m.fuel));
      const fuelInfo = el('div', 'mach-info', fuelText(m));
      live.fuel = fuelInfo;
      rows.append(fuelInfo);
    }
    if (m.type === 'furnace') rows.append(machineSlot(m, 'input', t('machine.input'), m.input));
    if (isDrill(m.type) || m.type === 'furnace') {
      rows.append(
        machineSlot(m, 'stock', t(isDrill(m.type) ? 'machine.stock' : 'machine.output'), m.stock),
      );
    }
    if (isDrill(m.type)) {
      const ore = el(
        'div',
        'mach-info',
        t('factory.ore', { n: String(factory.oreUnder(m).total) }),
      );
      live.ore = ore;
      rows.append(ore);
    }
    const layout = el('div', 'inv-layout');
    layout.append(bagColumn(m), rows);
    panel.append(layout);
    panel.append(
      el('small', 'help', `${footprint(m.type, m.gx, m.gz, m.rot).length} ${t('machine.cells')}`),
    );
    const x = el('button', 'panel-close', '✕');
    x.type = 'button';
    x.title = t('inv.close');
    x.setAttribute('aria-label', t('inv.close'));
    x.addEventListener('click', close);
    panel.append(x);
    root.replaceChildren(el('div', 'pause-dim'), panel);
  }

  function open(id: number): void {
    if (current !== null) return;
    current = id;
    root.hidden = false;
    render();
    actions.onOpenChange(true);
    timer = window.setInterval(() => {
      if (!dragging) refresh();
    }, 500);
  }

  function close(): void {
    if (current === null) return;
    current = null;
    selected = null;
    dragging = false;
    window.clearInterval(timer);
    root.hidden = true;
    root.replaceChildren();
    actions.onOpenChange(false);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (current !== null && e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  const offLocale = onLocaleChange(() => current !== null && render());
  root.hidden = true;

  return {
    open,
    close,
    isOpen: () => current !== null,
    dispose: () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(timer);
      offLocale();
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
