import { machineDef, smeltRecipe } from '../core/data/machines';
import { itemById } from '../core/data/items';
import { footprint, type Factory, type Machine, type Stack } from '../core/factory/factory';
import type { GameState } from '../core/game/state';
import { playSfx } from '../audio/sfx';
import { t, onLocaleChange, type TranslationKey } from '../i18n';
import './menu.css';

export interface MachineWindow {
  open(id: number): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

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
 * Fenêtre d'une foreuse ou d'un fourneau : case de combustible, minerai à cuire, stock / lingots produits.
 * On y met le contenu du sac et on en reprend.
 */
export function mountMachineWindow(
  root: HTMLElement,
  state: GameState,
  factory: Factory,
  actions: { onOpenChange(open: boolean): void },
): MachineWindow {
  let current: number | null = null;
  let timer = 0;

  const machine = (): Machine | null =>
    current === null ? null : (factory.machines.find((m) => m.id === current) ?? null);

  const slotRow = (
    label: string,
    stack: Stack | null,
    max: number | null,
    buttons: { text: string; enabled: boolean; run: () => void }[],
  ): HTMLElement => {
    const row = el('div', 'mach-row');
    row.append(el('span', 'mach-label', label));
    const box = el('span', stack ? 'mach-slot' : 'mach-slot empty');
    if (stack) {
      box.style.setProperty('--item', itemById(stack.item).color);
      box.append(
        el('span', undefined, itemName(stack.item)),
        el('strong', undefined, max ? `${stack.count} / ${max}` : String(stack.count)),
      );
    } else box.textContent = t('factory.empty');
    row.append(box);
    for (const b of buttons) {
      const btn = el('button', undefined, b.text);
      btn.type = 'button';
      btn.disabled = !b.enabled;
      btn.addEventListener('click', () => {
        b.run();
        render();
      });
      row.append(btn);
    }
    return row;
  };

  /** Quel objet du sac ajouter dans cette case ? Celui déjà dedans, sinon le premier qui convient. */
  const pickFuel = (m: Machine): string | null =>
    m.fuel?.item ??
    ['coal', 'wood'].find((id) => (state.inventory[id] ?? 0) > 0 && itemById(id).fuelSeconds) ??
    null;
  const pickInput = (m: Machine): string | null =>
    m.input?.item ??
    ['iron_ore', 'copper_ore'].find((id) => (state.inventory[id] ?? 0) > 0 && smeltRecipe(id)) ??
    null;

  function render(): void {
    const m = machine();
    if (!m) {
      close();
      return;
    }
    const def = machineDef(m.type);
    const max = def.stockMax ?? 100;
    const panel = el('div', 'panel machine-window');
    panel.setAttribute('role', 'dialog');
    panel.append(el('h2', undefined, itemName(def.item)));
    const status = factory.status(m);
    panel.append(el('div', `st ${status}`, t(`factory.status.${status}` as TranslationKey)));

    const rows = el('div', 'mach-rows');
    if (def.fuel) {
      const fuelItem = pickFuel(m);
      rows.append(
        slotRow(t('machine.fuel'), m.fuel, max, [
          {
            text: t('machine.add'),
            enabled: fuelItem !== null && (state.inventory[fuelItem] ?? 0) > 0,
            run: () => {
              if (fuelItem && state.loadMachine(m, 'fuel', fuelItem, max) > 0) playSfx('pickup');
            },
          },
          {
            text: t('machine.take'),
            enabled: m.fuel !== null,
            run: () => void state.unloadMachine(m, 'fuel'),
          },
        ]),
      );
      rows.append(
        el(
          'div',
          'mach-info',
          t('factory.fuel', {
            v: m.fuel ? `${m.fuel.count}` : '0',
            time: duration(factory.fuelSecondsLeft(m)),
          }),
        ),
      );
    }
    if (m.type === 'furnace') {
      const oreItem = pickInput(m);
      rows.append(
        slotRow(t('machine.input'), m.input, max, [
          {
            text: t('machine.add'),
            enabled: oreItem !== null && (state.inventory[oreItem] ?? 0) > 0,
            run: () => {
              if (oreItem && state.loadMachine(m, 'input', oreItem, max) > 0) playSfx('pickup');
            },
          },
          {
            text: t('machine.take'),
            enabled: m.input !== null,
            run: () => void state.unloadMachine(m, 'input'),
          },
        ]),
      );
    }
    if (m.type === 'drill' || m.type === 'furnace') {
      rows.append(
        slotRow(t(m.type === 'drill' ? 'machine.stock' : 'machine.output'), m.stock, max, [
          {
            text: t('machine.take'),
            enabled: m.stock !== null,
            run: () => {
              if (state.unloadMachine(m, 'stock') > 0) playSfx('pickup');
            },
          },
        ]),
      );
    }
    if (m.type === 'drill') {
      const ore = factory.oreUnder(m);
      rows.append(el('div', 'mach-info', t('factory.ore', { n: String(ore.total) })));
    }
    panel.append(rows);
    const cells = footprint(m.type, m.gx, m.gz, m.rot);
    panel.append(el('small', 'help', `${cells.length} ${t('machine.cells')}`));
    const closeBtn = el('button', 'menu-btn', t('inv.close'));
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    panel.append(closeBtn);
    root.replaceChildren(el('div', 'pause-dim'), panel);
  }

  function open(id: number): void {
    if (current !== null) return;
    current = id;
    root.hidden = false;
    render();
    actions.onOpenChange(true);
    timer = window.setInterval(render, 500);
  }

  function close(): void {
    if (current === null) return;
    current = null;
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
