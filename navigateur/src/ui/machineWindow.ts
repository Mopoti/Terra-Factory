import { VEHICLES } from '../core/data/vehicles';
import { SOUTE_MAX } from '../core/rail/normalize';
import {
  CARS,
  carIdOfCargo,
  carIdOfWindow,
  isCargoWindow,
  isLocoWindow,
  LIQUID_KG_PER_L,
} from '../core/data/trains';
import { cargoMassKg, cargoVolumeL } from '../core/rail/train';
import type { Program } from '../core/rail/program';
import { draftFor, programEditorView } from './programEditor';
import { playSfx } from '../audio/sfx';
import { ITEMS, itemById } from '../core/data/items';
import {
  assemblerMaxTypes,
  isAssembler,
  isChest,
  isPole,
  isDrill,
  isLab,
  isSmith,
  isTurret,
  machineDef,
  slotCap,
  turretSpec,
} from '../core/data/machines';
import {
  MOULD_CYCLES,
  recipeById,
  recipeByproduct,
  recipesFor,
  type Recipe,
} from '../core/data/recipes';

const EMPTY_RECIPE: Recipe = { id: '', machine: 'furnace', in: {}, out: {}, seconds: 0 };
import {
  footprint,
  hasSlotStore,
  ingredientCap,
  recipeOf,
  WAYPOINT_COLORS,
  WAYPOINT_NAME_MAX,
  type Factory,
  type Machine,
  type Stack,
} from '../core/factory/factory';
import { totals } from '../core/game/inventory';
import { buyPrice, sellPrice } from '../core/game/trade';
import type { CommandBus } from '../core/game/commands';
import type { GameState } from '../core/game/state';
import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import { ITEM_DRAG_TYPE } from './hotbar';
import { itemIcon } from './itemIcon';
import {
  BAG_SLOT_TYPE,
  askAmount,
  bagCellsShown,
  takeAsked,
  takeHalf,
  updateHandCursor,
} from './pick';
import './menu.css';

export interface MachineWindow {
  open(id: number): void;
  /** Onglet de la locomotive à montrer à la prochaine ouverture (soute ou programme). */
  setLocoTab(tab: 'fuel' | 'program'): void;
  close(): void;
  isOpen(): boolean;
  /** Machine dont la fenêtre est ouverte (null si fermée). */
  openedId(): number | null;
  dispose(): void;
}

type SlotName = 'fuel' | 'input' | 'stock' | 'extra';
/** Cases de sortie : on y prend, on n'y dépose rien. */
const isOutputSlot = (slot: SlotName): boolean => slot === 'stock' || slot === 'extra';
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
  actions: {
    onOpenChange(open: boolean): void;
    /** Commandes du joueur : tout ce qui change le monde y passe. */
    bus: CommandBus;
    /** Machines qui ne sont pas dans l'usine (le coffre d'un buggy : identifiant négatif). */
    resolve?: (id: number) => Machine | null;
  },
): MachineWindow {
  let current: number | null = null;
  /** Nom du véhicule dont le coffre s'ouvre (identifiant négatif = −identifiant du véhicule). */
  const vehicleName = (id: number): string =>
    isLocoWindow(id)
      ? itemName('train_locomotive')
      : isCargoWindow(id)
        ? itemName(CARS[state.carById(carIdOfCargo(id))?.kind ?? 'wagon_freight'].item)
        : itemName(
            VEHICLES[state.changes.vehicles.find((v) => v.id === -id)?.kind ?? 'buggy'].item,
          );
  /** Capacité d'une case : la soute d'une locomotive en a une à elle. */
  const capOf = (m: Machine, slot: SlotName): number =>
    isLocoWindow(m.id) ? SOUTE_MAX : slotCap(machineDef(m.type), slot);
  let timer = 0;
  /** Onglet de la fenêtre d'une locomotive, et brouillons du programme (gardés quand on redessine). */
  let locoTab: 'fuel' | 'program' = 'fuel';
  const programDrafts = new Map<number, Program>();
  /** Objet du sac choisi par un clic, à déposer d'un clic dans une case de la machine. */
  let barTimer = 0;
  let selected: string | null = null;
  /** Case du sac de la pile choisie (pour fusionner avec une autre pile du même objet). */
  let selectedSlot: number | null = null;
  /** Pendant un glisser-déposer on ne redessine pas (cela l'annulerait). */
  let dragging = false;

  /** Éléments dont le texte change en continu (on les met à jour sans refaire la fenêtre). */
  let live: {
    status?: HTMLElement;
    cycle?: HTMLElement;
    fuel?: HTMLElement;
    fuelBar?: HTMLElement;
    ore?: HTMLElement;
    counts: Map<SlotName, HTMLElement>;
    chest: HTMLElement[];
    ingredients: Map<string, HTMLElement>;
    /** Compteur d'un poteau : se redessine à chaque mise à jour douce. */
    meter?: () => void;
  } = { counts: new Map(), chest: [], ingredients: new Map() };
  /** Ce qui, s'il change, oblige à redessiner la fenêtre (sac, présence d'objets dans les cases). */
  let lastShape = '';
  const shape = (m: Machine): string =>
    JSON.stringify([
      state.inventory,
      m.fuel?.item ?? null,
      m.input?.item ?? null,
      m.stock?.item ?? null,
      m.slots.map((x) => x.item),
      m.recipe,
      m.filters.length,
      selected,
      selectedSlot,
      state.hand,
    ]);

  const machine = (): Machine | null => {
    const found =
      current === null
        ? null
        : current < 0
          ? (actions.resolve?.(current) ?? null)
          : (factory.machines.find((m) => m.id === current) ?? null);
    // Coffre quantique : chaque joueur n'y voit que son contenu.
    return found ? state.chestOf(found) : null;
  };

  /** Une case de la machine peut-elle recevoir cet objet ? */
  const accepts = (m: Machine, slot: SlotName, item: string): boolean =>
    (slot === 'fuel' &&
      (machineDef(m.type).fuel || (m.id < 0 && !isCargoWindow(m.id))) &&
      !!itemById(item).energyMJ) ||
    (slot === 'input' && isSmith(m.type) && recipeById(m.recipe)?.mould === item) ||
    (slot === 'input' && isTurret(m.type) && item === turretSpec(m.type).ammo) ||
    (slot === 'input' && m.type === 'fission_reactor' && item === 'uranium_rod');

  function drop(m: Machine, slot: SlotName, item: string, bagIndex?: number): void {
    if (!accepts(m, slot, item)) {
      playSfx('deny');
      return;
    }
    const max = capOf(m, slot);
    playSfx(
      state.loadMachine(m, slot as 'fuel' | 'input', item, max, bagIndex) > 0 ? 'pickup' : 'deny',
    );
    render();
  }

  /** Dépose la pile tenue au bout du curseur dans une case de la machine (le reste reste en main). */
  function dropHand(m: Machine, slot: SlotName): void {
    const hand = state.hand;
    if (!hand || !accepts(m, slot, hand.item)) {
      playSfx('deny');
      return;
    }
    const max = capOf(m, slot);
    const moved = state.useHand((item, n) =>
      state.loadMachine(m, slot as 'fuel' | 'input', item, Math.min(n, max)),
    );
    playSfx(moved > 0 ? 'pickup' : 'deny');
    render();
  }

  function machineSlot(
    m: Machine,
    slot: SlotName,
    label: string,
    stack: Stack | null,
  ): HTMLElement {
    const max = capOf(m, slot);
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
    if (!isOutputSlot(slot)) {
      box.classList.add('target');
      box.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
      });
      box.addEventListener('drop', (e) => {
        const item = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
        if (!item) return;
        e.preventDefault();
        dragging = false;
        // Seule la pile glissée est utilisée : les autres piles du même objet ne bougent pas.
        const pile = e.dataTransfer?.getData(BAG_SLOT_TYPE);
        drop(m, slot, item, pile ? Number(pile) : undefined);
      });
    }
    row.append(box);
    const take = el('button', undefined, t('machine.take'));
    take.type = 'button';
    take.disabled = stack === null;
    // Mêmes gestes que dans le sac : clic = la pile au curseur (ou on y dépose la pile du curseur), clic droit =
    // la moitié, Ctrl + clic = une quantité, Maj + clic = directement dans l'autre inventaire.
    box.addEventListener('click', (e) => {
      if (e.shiftKey) {
        if (stack && state.unloadMachine(m, slot) > 0) playSfx('pickup');
        return render();
      }
      if (state.hand) {
        if (isOutputSlot(slot)) return playSfx('deny');
        return dropHand(m, slot);
      }
      if (e.ctrlKey || e.metaKey) {
        if (!stack) return;
        void askAmount(itemName(stack.item), stack.count, e).then((n) => {
          if (n !== null && state.takeSlotToHand(m, slot, n) > 0) playSfx('pickup');
          render();
        });
        return;
      }
      if (selected && !isOutputSlot(slot))
        return drop(m, slot, selected, selectedSlot ?? undefined);
      if (stack && state.takeSlotToHand(m, slot, stack.count) > 0) playSfx('pickup');
      render();
    });
    box.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (
        stack &&
        !state.hand &&
        state.takeSlotToHand(m, slot, Math.max(1, Math.ceil(stack.count / 2))) > 0
      )
        playSfx('pickup');
      render();
    });
    take.addEventListener('click', () => {
      if (state.unloadMachine(m, slot) > 0) playSfx('pickup');
      render();
    });
    row.append(take);
    return row;
  }

  let tradeSearch = '';
  /** Comptoir commercial spatial : crédits, vente de ce que contient le sac, catalogue d'achat. */
  function tradeRows(): HTMLElement[] {
    const out: HTMLElement[] = [];
    out.push(el('h3', undefined, t('trade.title', { n: state.changes.credits.toLocaleString() })));
    out.push(el('div', 'mach-info', t('trade.help')));
    const sellBox = el('div', 'trade-list');
    const bag = state.bagSlots().filter((x): x is NonNullable<typeof x> => !!x);
    if (bag.length === 0) sellBox.append(el('div', 'mach-info', t('trade.bagEmpty')));
    for (const slot of bag) {
      const row = el('div', 'trade-row');
      row.append(
        el('span', 'trade-name', `${itemName(slot.item)} ×${slot.count}`),
        el('span', 'trade-price', t('trade.sellPrice', { n: String(sellPrice(slot.item)) })),
      );
      for (const [label, n] of [
        ['×1', 1],
        ['×10', 10],
        [t('trade.all'), slot.count],
      ] as const) {
        const b = el('button', undefined, String(label));
        b.type = 'button';
        b.addEventListener('click', () => {
          if (actions.bus.dispatch<'sell'>({ type: 'sell', item: slot.item, count: n }) > 0)
            playSfx('pickup');
          render();
        });
        row.append(b);
      }
      sellBox.append(row);
    }
    out.push(sellBox);
    const search = el('input', 'mach-search');
    search.type = 'search';
    search.placeholder = t('trade.search');
    search.value = tradeSearch;
    search.addEventListener('change', () => {
      tradeSearch = search.value.trim().toLowerCase();
      render();
    });
    out.push(search);
    const buyBox = el('div', 'trade-list');
    const shown = ITEMS.filter(
      (i) =>
        !i.creativeOnly &&
        (tradeSearch === '' || itemName(i.id).toLowerCase().includes(tradeSearch)),
    ).slice(0, 40);
    for (const item of shown) {
      const row = el('div', 'trade-row');
      row.append(
        el('span', 'trade-name', itemName(item.id)),
        el('span', 'trade-price', t('trade.buyPrice', { n: String(buyPrice(item.id)) })),
      );
      for (const n of [1, 10, 100]) {
        const b = el('button', undefined, `×${n}`);
        b.type = 'button';
        b.disabled = state.changes.credits < buyPrice(item.id);
        b.addEventListener('click', () => {
          if (actions.bus.dispatch<'buy'>({ type: 'buy', item: item.id, count: n }) > 0)
            playSfx('pickup');
          else playSfx('deny');
          render();
        });
        row.append(b);
      }
      buyBox.append(row);
    }
    out.push(buyBox);
    return out;
  }

  /** Jauges et boutons d'un wagon : charge d'un wagon de fret, niveau et barils d'une citerne. */
  function cargoRows(m: Machine): HTMLElement[] {
    const car = state.carById(carIdOfCargo(m.id));
    if (!car) return [];
    const spec = CARS[car.kind];
    const gauge = (fraction: number): HTMLElement => {
      const bar = el('div', 'cycle-bar fuel-bar');
      bar.setAttribute('role', 'progressbar');
      const fill = el('div');
      bar.append(fill);
      setCycleBar(fill, fraction > 0 ? Math.min(1, fraction) : null);
      return bar;
    };
    const fmt = (n: number): string => Math.round(n).toLocaleString(getLocale());
    if (spec.cargo) {
      const kg = cargoMassKg(car);
      const litres = cargoVolumeL(car);
      return [
        el(
          'div',
          'mach-info',
          t('cargo.load', {
            kg: fmt(kg),
            max: fmt(spec.cargo.maxKg),
            l: fmt(litres),
            maxl: fmt(spec.cargo.maxL),
          }),
        ),
        gauge(Math.max(kg / spec.cargo.maxKg, litres / spec.cargo.maxL)),
        el('small', 'help', t('cargo.hint')),
      ];
    }
    const cap = spec.tankL ?? 0;
    const liquid = car.liquid;
    const info = el(
      'div',
      'mach-info',
      liquid
        ? t('tank.level', {
            kind: t(`liquid.${liquid.kind}` as TranslationKey),
            l: fmt(liquid.liters),
            cap: fmt(cap),
            kg: fmt(liquid.liters * LIQUID_KG_PER_L[liquid.kind]),
          })
        : t('tank.empty', { cap: fmt(cap) }),
    );
    const message = el('div', 'mach-info');
    const button = (label: string, run: () => string): HTMLButtonElement => {
      const b = el('button', undefined, label);
      b.type = 'button';
      b.addEventListener('click', () => {
        const r = run();
        playSfx(r === 'ok' ? 'pickup' : 'deny');
        if (r === 'ok') render();
        else message.textContent = t(`tank.err.${r}` as TranslationKey);
      });
      return b;
    };
    return [
      info,
      gauge((liquid?.liters ?? 0) / cap),
      button(t('tank.pour'), () => state.pourBarrel(car.id)),
      button(t('tank.draw'), () => state.drawBarrel(car.id)),
      message,
      el('small', 'help', t('tank.hint')),
    ];
  }

  /** Maj + clic sur une pile du sac : l'envoie dans la case de la machine qui l'accepte. Sans effet sinon. */
  function quickLoad(m: Machine, item: string, count: number, bagIndex?: number): void {
    let moved = 0;
    if ((isChest(m.type) || hasSlotStore(m.type)) && !isLocoWindow(m.id))
      moved = state.putInChest(m, item, count, bagIndex);
    else if (m.type === 'assembler' || (isSmith(m.type) && recipeOf(m)?.[item]))
      moved = actions.bus.dispatch<'loadIngredient'>({
        type: 'loadIngredient',
        id: m.id,
        item,
        count,
        slot: bagIndex,
      });
    else {
      for (const slot of ['input', 'fuel'] as const) {
        if (accepts(m, slot, item)) {
          moved = state.loadMachine(m, slot, item, Math.min(count, capOf(m, slot)), bagIndex);
          break;
        }
      }
    }
    if (moved > 0) {
      playSfx('pickup');
      render();
    }
  }

  /** Balise : un nom (« Balise » par défaut) et une couleur, vus de loin et sur la carte. */
  /** Courbe de la production (vert) et de la demande (orange) d'un réseau sur les dernières minutes. */
  function powerChart(history: { cap: number[]; demand: number[] } | null): HTMLElement {
    const box = el('div', 'power-chart');
    const W = 280;
    const H = 90;
    const n = Math.max(history?.cap.length ?? 0, 2);
    const max = Math.max(1, ...(history?.cap ?? []), ...(history?.demand ?? [])) * 1.1;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'power-chart-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('meter.chart'));
    const frame = document.createElementNS(NS, 'rect');
    frame.setAttribute('width', String(W));
    frame.setAttribute('height', String(H));
    frame.setAttribute('class', 'frame');
    svg.append(frame);
    const line = (values: number[], cls: string): void => {
      if (values.length < 2) return;
      const pts = values
        .map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`)
        .join(' ');
      const poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', pts);
      poly.setAttribute('class', cls);
      svg.append(poly);
    };
    line(history?.cap ?? [], 'cap');
    line(history?.demand ?? [], 'demand');
    box.append(
      svg,
      el(
        'div',
        'power-legend',
        t('meter.legend', {
          max: String(Math.round(max)),
          min: String(Math.round((n / 60) * 10) / 10),
        }),
      ),
    );
    return box;
  }

  /**
   * Compteur d'un poteau : prises utilisées, production et demande du réseau, puis chaque machine raccordée avec sa
   * puissance nominale (− consommée, + produite) et son état. Se met à jour en continu.
   */
  function poleMeter(m: Machine): HTMLElement {
    const box = el('div', 'pole-meter');
    const fill = (): void => {
      const sockets = factory.sockets(m);
      const g = factory.gridInfo(m);
      const kids: HTMLElement[] = [
        el(
          'div',
          'mach-info',
          t('meter.sockets', { used: String(sockets.used), max: String(sockets.max) }),
        ),
      ];
      if (!g) kids.push(el('div', 'mach-info warn', t('factory.power.unlinked')));
      else {
        kids.push(
          el(
            'div',
            'mach-info',
            t('meter.level', {
              level: t(`meter.level.${g.level}` as TranslationKey),
              max: g.maxKw >= 1000 ? `${g.maxKw / 1000} MW` : `${g.maxKw} kW`,
            }),
          ),
        );
        if (g.blackout) kids.push(el('div', 'mach-info warn', t('factory.power.blackout')));
        else if (g.overloadS > 0)
          kids.push(
            el(
              'div',
              'mach-info warn',
              t('factory.power.overload', { s: String(Math.round(g.overloadS)) }),
            ),
          );
        kids.push(
          el(
            'div',
            'mach-info',
            t('meter.power', {
              cap: String(Math.round(g.capacityKw)),
              demand: String(Math.round(g.demandKw)),
              pct: String(Math.round(g.satisfaction * 100)),
            }),
          ),
        );
        kids.push(powerChart(factory.gridHistory(m)));
        const members = factory.gridMembers(m);
        if (members.length === 0) kids.push(el('div', 'mach-info', t('meter.empty')));
        for (const { machine, kw } of members) {
          const name = itemName(machineDef(machine.type).item);
          const status = t(`factory.status.${factory.status(machine)}` as TranslationKey);
          kids.push(
            el('div', 'mach-info', `${name} · ${kw > 0 ? '+' : '−'}${Math.abs(kw)} kW · ${status}`),
          );
        }
      }
      box.replaceChildren(...kids);
    };
    fill();
    live.meter = fill;
    return box;
  }

  function waypointRows(m: Machine): HTMLElement[] {
    const tint = m.tint ?? WAYPOINT_COLORS[0];
    const apply = (label: string, color: string): void => {
      actions.bus.dispatch<'setWaypoint'>({ type: 'setWaypoint', id: m.id, label, tint: color });
      render();
    };
    const name = el('input', 'mach-search');
    name.type = 'text';
    name.maxLength = WAYPOINT_NAME_MAX;
    name.placeholder = t('waypoint.default');
    name.value = m.label ?? '';
    name.setAttribute('aria-label', t('waypoint.name'));
    name.addEventListener('change', () => apply(name.value, tint));
    name.addEventListener('keydown', (e) => {
      e.stopPropagation(); // taper un nom ne déclenche aucune action du jeu
      if (e.key === 'Enter') name.blur();
    });
    const palette = el('div', 'waypoint-colors');
    for (const color of WAYPOINT_COLORS) {
      const b = el('button', color === tint ? 'waypoint-color on' : 'waypoint-color');
      b.type = 'button';
      b.style.background = color;
      b.title = color;
      b.addEventListener('click', () => apply(name.value, color));
      palette.append(b);
    }
    return [
      el('div', 'mach-info', t('waypoint.name')),
      name,
      el('div', 'mach-info', t('waypoint.color')),
      palette,
      el('small', 'help', t('waypoint.help')),
    ];
  }

  /** Le sac, toujours visible à gauche. */
  function bagColumn(m: Machine): HTMLElement {
    const col = el('div', 'inv-bag');
    const used = totals(state.inventory);
    col.append(
      el(
        'div',
        'mach-info',
        Number.isFinite(state.limits.maxWeightG)
          ? `${(used.weightG / 1000).toFixed(1)} / ${state.limits.maxWeightG / 1000} kg · ${(used.volumeMl / 1000).toFixed(1)} / ${state.limits.maxVolumeMl / 1000} L`
          : `${(used.weightG / 1000).toFixed(1)} kg · ${(used.volumeMl / 1000).toFixed(1)} L (${t('inv.unlimited')})`,
      ),
    );
    const slots = state.bagSlots();
    const grid = el('div', 'slot-grid square');
    for (let i = 0; i < bagCellsShown(state); i++) {
      const slot = slots[i];
      const cell = el('button', slot ? 'slot' : 'slot empty');
      cell.type = 'button';
      if (slot) {
        cell.style.setProperty('--item', itemById(slot.item).color);
        cell.classList.toggle('selected', selectedSlot === i);
        cell.append(itemIcon(slot.item), el('span', 'slot-count', String(slot.count)));
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          dragging = true;
          e.dataTransfer?.setData(ITEM_DRAG_TYPE, slot.item);
          e.dataTransfer?.setData(BAG_SLOT_TYPE, String(i));
        });
        cell.addEventListener('dragend', () => {
          dragging = false;
          render();
        });
        cell.addEventListener('click', (e) => {
          if (state.hand) {
            if (!state.placeHand(i)) playSfx('deny');
            render();
            return;
          }
          // Maj + clic : la pile part directement dans la bonne case de la machine (rien si elle n'en veut pas).
          if (e.shiftKey) {
            quickLoad(m, slot.item, slot.count, i);
            return;
          }
          if (e.ctrlKey || e.metaKey) {
            void takeAsked(state, slot.item, itemName(slot.item), slot.count, e, i).then(render);
            return;
          }
          // On choisit CETTE pile (deux piles du même objet restent bien distinctes) ; recliquer la désélectionne.
          selectedSlot = selectedSlot === i ? null : i;
          selected = selectedSlot === null ? null : slot.item;
          render();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          takeHalf(state, slot.item, slot.count, e, i);
          render();
        });
      } else {
        cell.addEventListener('click', () => {
          if (!state.hand) return;
          state.placeHand(i);
          render();
        });
      }
      // Glisser une pile du sac sur une autre case : on la déplace, la fusionne (même objet) ou l'échange.
      cell.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes(BAG_SLOT_TYPE)) e.preventDefault();
      });
      cell.addEventListener('drop', (e) => {
        const from = e.dataTransfer?.getData(BAG_SLOT_TYPE);
        if (from === undefined || from === '') return;
        e.preventDefault();
        e.stopPropagation();
        dragging = false;
        state.moveBagSlot(Number(from), i);
        render();
      });
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
        cell.title = itemName(stack.item);
        cell.append(itemIcon(stack.item), count);
        cell.draggable = true;
        cell.addEventListener('dragstart', (e) => {
          dragging = true;
          e.dataTransfer?.setData(MACHINE_SLOT_TYPE, `chest:${i}`);
        });
        cell.addEventListener('dragend', () => {
          dragging = false;
          render();
        });
        cell.addEventListener('click', (e) => {
          if (state.hand) return putInChest(m, state.hand.item);
          // Maj + clic : directement dans le sac ; Ctrl + clic : une quantité ; sinon la pile au curseur.
          if (e.shiftKey) {
            if (state.takeFromChest(m, i) > 0) playSfx('pickup');
            return render();
          }
          if (e.ctrlKey || e.metaKey) {
            void askAmount(itemName(stack.item), stack.count, e).then((n) => {
              if (n !== null && state.takeChestToHand(m, i, n) > 0) playSfx('pickup');
              render();
            });
            return;
          }
          if (state.takeChestToHand(m, i, stack.count) > 0) playSfx('pickup');
          render();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (
            !state.hand &&
            state.takeChestToHand(m, i, Math.max(1, Math.ceil(stack.count / 2))) > 0
          )
            playSfx('pickup');
          render();
        });
      } else {
        cell.addEventListener('click', () => {
          if (state.hand) return putInChest(m, state.hand.item);
          if (selected) putInChest(m, selected, selectedSlot ?? undefined);
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
      const pile = e.dataTransfer?.getData(BAG_SLOT_TYPE);
      putInChest(m, item, pile ? Number(pile) : undefined);
    });
    return grid;
  }

  /** Dépose un ingrédient (de la main, de l'objet choisi ou glissé) dans l'assembleur. */
  function putIngredient(m: Machine, item: string, bagIndex?: number): void {
    const hand = state.hand;
    const moved =
      hand && hand.item === item
        ? state.useHand((it, n) =>
            actions.bus.dispatch<'loadIngredient'>({
              type: 'loadIngredient',
              id: m.id,
              item: it,
              count: n,
            }),
          )
        : actions.bus.dispatch<'loadIngredient'>({
            type: 'loadIngredient',
            id: m.id,
            item,
            count: 100,
            slot: bagIndex,
          });
    playSfx(moved > 0 ? 'pickup' : 'deny');
    render();
  }

  /** Assembleur : choix de la recette et cases d'ingrédients. */
  function assemblerRows(m: Machine): HTMLElement[] {
    const out: HTMLElement[] = [];
    const row = el('div', 'mach-row');
    row.append(el('span', 'mach-label', t('machine.recipe')));
    const select = el('select', 'mach-select');
    select.append(new Option(t('machine.recipeNone'), ''));
    if (isSmith(m.type)) {
      for (const r of recipesFor(m.type).filter(
        (x) => state.isUnlocked(Object.keys(x.out)[0]) || x.id === m.recipe,
      ))
        select.append(
          new Option(t(`recipe.${r.id}` as TranslationKey), r.id, false, r.id === m.recipe),
        );
    } else {
      for (const def of ITEMS) {
        if (
          def.recipe &&
          !def.creativeOnly &&
          state.isUnlocked(def.id) &&
          Object.keys(def.recipe).length <= assemblerMaxTypes(m.type)
        )
          select.append(new Option(itemName(def.id), def.id, false, def.id === m.recipe));
      }
    }
    select.value = m.recipe ?? '';
    select.addEventListener('change', () => {
      if (
        actions.bus.dispatch<'setRecipe'>({
          type: 'setRecipe',
          id: m.id,
          item: select.value || null,
        })
      )
        playSfx('pickup');
      render();
    });
    row.append(select);
    out.push(row);
    const need = recipeOf(m);
    if (need) {
      out.push(el('h3', undefined, t('machine.ingredients')));
      const grid = el('div', 'slot-grid chest-grid');
      for (const [item, n] of Object.entries(need)) {
        const have = m.slots.find((x) => x.item === item)?.count ?? 0;
        const cell = el('button', have > 0 ? 'slot' : 'slot empty');
        cell.type = 'button';
        cell.style.setProperty('--item', itemById(item).color);
        const count = el('span', 'slot-count', `${have} / ${ingredientCap(n)}`);
        live.ingredients.set(item, count);
        cell.title = `${n} × ${itemName(item)}`;
        cell.append(itemIcon(item), count);
        cell.addEventListener('click', () => {
          if (state.hand) return putIngredient(m, state.hand.item);
          if (selected) return putIngredient(m, selected, selectedSlot ?? undefined);
          const index = m.slots.findIndex((x) => x.item === item);
          if (index >= 0 && state.takeChestToHand(m, index, m.slots[index].count) > 0)
            playSfx('pickup');
          render();
        });
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const index = m.slots.findIndex((x) => x.item === item);
          if (index >= 0 && !state.hand) {
            state.takeChestToHand(m, index, Math.max(1, Math.ceil(m.slots[index].count / 2)));
            playSfx('pickup');
          }
          render();
        });
        cell.addEventListener('dragover', (e) => {
          if (e.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
        });
        cell.addEventListener('drop', (e) => {
          const dropped = e.dataTransfer?.getData(ITEM_DRAG_TYPE);
          if (!dropped) return;
          e.preventDefault();
          dragging = false;
          const pile = e.dataTransfer?.getData(BAG_SLOT_TYPE);
          putIngredient(m, dropped, pile ? Number(pile) : undefined);
        });
        grid.append(cell);
      }
      out.push(grid, el('small', 'help', t('machine.ingHint')));
    }
    return out;
  }

  /** Filtres d'un bras filtrant (1) ou d'un trieur (1 par sortie) : liste blanche / noire et objets à cocher. */
  const filterSearch = new Map<string, string>();
  function filterRows(m: Machine): HTMLElement[] {
    const out: HTMLElement[] = [];
    const names = [t('machine.filter.front'), t('machine.filter.left'), t('machine.filter.right')];
    m.filters.forEach((f, index) => {
      const box = el('div', 'filter-box');
      const head = el('div', 'mach-row');
      head.append(
        el('span', 'mach-label', m.filters.length > 1 ? names[index] : t('machine.filter.title')),
      );
      const mode = el('select', 'mach-select');
      mode.append(
        new Option(t('machine.filter.deny'), 'deny', false, f.mode === 'deny'),
        new Option(t('machine.filter.allow'), 'allow', false, f.mode === 'allow'),
      );
      mode.value = f.mode;
      mode.addEventListener('change', () => {
        state.setFilterMode(m, index, mode.value === 'allow' ? 'allow' : 'deny');
        playSfx('pickup');
        render();
      });
      const clear = el('button', undefined, t('machine.filter.clear'));
      clear.type = 'button';
      clear.addEventListener('click', () => {
        state.clearFilter(m, index);
        render();
      });
      head.append(mode, clear);
      box.append(head);
      const key = `${m.id}:${index}`;
      const search = el('input', 'mach-search') as HTMLInputElement;
      search.type = 'search';
      search.placeholder = t('machine.filter.search');
      search.value = filterSearch.get(key) ?? '';
      const grid = el('div', 'filter-grid');
      const fill = (): void => {
        grid.replaceChildren();
        const q = (filterSearch.get(key) ?? '').trim().toLowerCase();
        for (const def of ITEMS) {
          if (def.creativeOnly) continue;
          const name = itemName(def.id);
          if (q && !name.toLowerCase().includes(q) && !f.items.includes(def.id)) continue;
          const on = f.items.includes(def.id);
          const chip = el('button', on ? 'filter-chip on' : 'filter-chip', name);
          chip.type = 'button';
          chip.style.setProperty('--item', def.color);
          chip.addEventListener('click', () => {
            state.toggleFilterItem(m, index, def.id);
            playSfx('pickup');
            fill();
            summary.textContent = describe();
          });
          grid.append(chip);
        }
      };
      const describe = (): string =>
        t(f.mode === 'allow' ? 'machine.filter.onlyThese' : 'machine.filter.allBut', {
          n: String(f.items.length),
        });
      const summary = el('div', 'mach-info', describe());
      search.addEventListener('input', () => {
        filterSearch.set(key, search.value);
        fill();
      });
      fill();
      box.append(search, summary, grid);
      out.push(box);
    });
    return out;
  }

  function putInChest(m: Machine, item: string, bagIndex?: number): void {
    const hand = state.hand;
    const moved =
      hand && hand.item === item
        ? state.useHand((it, n) => state.putInChest(m, it, n))
        : state.putInChest(m, item, 100, bagIndex);
    playSfx(moved > 0 ? 'pickup' : 'deny');
    render();
  }

  /** Remplissage de la jauge de combustible : chaleur de la chaudière pour une locomotive. */
  const fuelFill01 = (m: Machine): number | null =>
    isLocoWindow(m.id)
      ? m.fuelLeft > 0
        ? Math.min(1, m.fuelLeft / 9000)
        : null
      : factory.fuelFraction(m);
  const fuelText = (m: Machine): string =>
    isLocoWindow(m.id)
      ? t('train.fuelInfo', {
          n: String(m.fuel?.count ?? 0),
          heat: String(Math.round(Math.min(100, (m.fuelLeft / 9000) * 100))),
        })
      : t('factory.fuel', {
          v: m.fuel ? `${m.fuel.count}` : '0',
          time: duration(factory.fuelSecondsLeft(m)),
        }) +
        (machineDef(m.type).burnKw
          ? ` · ${t('factory.burn', { v: String(machineDef(m.type).burnKw) })}`
          : '');

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
    setCycleBar(live.cycle, factory.cycleFraction(m));
    live.meter?.();
    if (live.fuel) live.fuel.textContent = fuelText(m);
    setCycleBar(live.fuelBar, fuelFill01(m));
    if (live.ore) live.ore.textContent = t('factory.ore', { n: String(factory.oreUnder(m).total) });
    m.slots.forEach((stack, i) => {
      const node = live.chest[i];
      if (node) node.textContent = String(stack.count);
    });
    const def = machineDef(m.type);
    const need = recipeOf(m);
    for (const [item, node] of live.ingredients) {
      const have = m.slots.find((x) => x.item === item)?.count ?? 0;
      node.textContent = `${have} / ${ingredientCap(need?.[item] ?? 0)}`;
    }
    for (const [name, node] of live.counts) {
      const stack = m[name];
      if (stack)
        node.textContent = `${stack.count} / ${isLocoWindow(m.id) ? SOUTE_MAX : slotCap(def, name)}`;
    }
  }

  /** Règle la largeur de la barre de cycle (null = rien en cours : barre vide). */
  function setCycleBar(fill: HTMLElement | undefined, fraction: number | null): void {
    if (!fill) return;
    fill.style.width = `${Math.round((fraction ?? 0) * 100)}%`;
    fill.parentElement?.setAttribute('aria-valuenow', String(Math.round((fraction ?? 0) * 100)));
  }

  function render(): void {
    const m = machine();
    if (!m) {
      close();
      return;
    }
    const def = machineDef(m.type);
    live = { counts: new Map(), chest: [], ingredients: new Map() };
    lastShape = shape(m);
    const panel = el('div', 'panel machine-window');
    panel.setAttribute('role', 'dialog');
    panel.append(
      el(
        'h2',
        undefined,
        current !== null && current < 0 ? vehicleName(current) : itemName(def.item),
      ),
    );
    if (isLocoWindow(m.id)) {
      const tabs = el('div', 'craft-tabs');
      for (const [id, label] of [
        ['fuel', t('loco.tab.fuel')],
        ['program', t('loco.tab.program')],
      ] as const) {
        const b = el('button', id === locoTab ? 'craft-tab active' : 'craft-tab', label);
        b.type = 'button';
        b.addEventListener('click', () => {
          locoTab = id;
          render();
        });
        tabs.append(b);
      }
      panel.append(tabs);
      if (locoTab === 'program') {
        // Onglet « Programme » : l'éditeur des étapes du train, à la place de la soute.
        const carId = carIdOfWindow(m.id);
        const consist = state.changes.trains.find((c) => c.cars.some((k) => k.id === carId));
        const draft = consist
          ? (programDrafts.get(consist.id) ?? draftFor(state, consist.id))
          : null;
        if (consist && draft) {
          programDrafts.set(consist.id, draft);
          panel.append(programEditorView({ state, consistId: consist.id, draft, redraw: render }));
        }
        const x = el('button', 'panel-close', '✕');
        x.type = 'button';
        x.title = t('inv.close');
        x.setAttribute('aria-label', t('inv.close'));
        x.addEventListener('click', close);
        panel.append(x);
        root.replaceChildren(el('div', 'pause-dim'), panel);
        return;
      }
    }
    const status = factory.status(m);
    const statusEl = el('div', `st ${status}`, t(`factory.status.${status}` as TranslationKey));
    live.status = statusEl;
    if (!isCargoWindow(m.id)) panel.append(statusEl);
    // Barre du cycle en cours (temps qui s'écoule dans la machine).
    const cycleBar = el('div', 'cycle-bar');
    cycleBar.setAttribute('role', 'progressbar');
    cycleBar.setAttribute('aria-label', t('machine.cycle'));
    const cycleFill = el('div');
    cycleBar.append(cycleFill);
    live.cycle = cycleFill;
    setCycleBar(cycleFill, factory.cycleFraction(m));
    if (
      isSmith(m.type) ||
      isAssembler(m.type) ||
      isLab(m.type) ||
      isDrill(m.type) ||
      m.type === 'fission_reactor' ||
      m.type === 'fusion_reactor'
    )
      panel.append(cycleBar);

    const rows = el('div', 'mach-rows');
    rows.append(
      el(
        'h3',
        undefined,
        current !== null && current < 0 ? vehicleName(current) : itemName(def.item),
      ),
    );
    if (machineDef(m.type).coolBoost)
      rows.append(el('div', 'mach-info', t('machine.cooling.help')));
    if (m.type === 'crank') {
      const note = el('div', 'mach-info', t('machine.crank.help'));
      const out = el('div', 'mach-info');
      const button = el('button', 'btn', t('machine.crank.button'));
      button.type = 'button';
      button.addEventListener('click', () => {
        const g = factory.gridInfo(m);
        out.textContent = t(
          g ? (`machine.crank.${factory.crank(m)}` as TranslationKey) : 'machine.crank.unlinked',
        );
      });
      rows.append(note, button, out);
    }
    // Vie de la machine (le kit de réparation s'utilise en main, un clic sur la machine, pas depuis cette fenêtre).
    const hp = Math.round(factory.healthFraction(m) * 100);
    rows.append(
      el(
        'div',
        hp < 100 ? 'mach-info warn' : 'mach-info',
        t('machine.health', { pct: String(hp) }),
      ),
    );
    if (m.type === 'breaker') {
      const note = el('div', 'mach-info', t('machine.breaker.help'));
      const out = el('div', 'mach-info');
      const button = el('button', 'btn', '');
      button.type = 'button';
      const show = (): void => {
        const state = factory.breakerState(m);
        out.textContent = t(`machine.breaker.${state}` as TranslationKey);
        button.textContent = t(
          state === 'open' ? 'machine.breaker.close' : 'machine.breaker.open.button',
        );
        button.disabled = state === 'unlinked';
      };
      button.addEventListener('click', () => {
        factory.toggleBreaker(m);
        show();
      });
      show();
      rows.append(note, button, out);
    }
    if (isPole(m.type)) rows.append(poleMeter(m));
    if (m.type === 'waypoint') rows.append(...waypointRows(m));
    if (isCargoWindow(m.id)) rows.append(...cargoRows(m));
    if (
      (isChest(m.type) || hasSlotStore(m.type)) &&
      !isLocoWindow(m.id) &&
      !(
        isCargoWindow(m.id) &&
        !CARS[state.carById(carIdOfCargo(m.id))?.kind ?? 'wagon_freight'].cargo
      )
    )
      rows.append(
        chestGrid(m),
        el(
          'small',
          'help',
          t(
            isLab(m.type)
              ? 'machine.labHint'
              : m.type === 'fusion_reactor'
                ? 'machine.fusion.help'
                : 'machine.chestHint',
          ),
        ),
      );
    if (m.type === 'fusion_reactor' && m.broken) {
      const fix = el('button', undefined, t('machine.repair.fusion'));
      fix.type = 'button';
      const out = el('div', 'mach-info');
      fix.addEventListener('click', () => {
        if (actions.bus.dispatch<'repairReactor'>({ type: 'repairReactor', id: m.id }) === 'ok')
          return render();
        out.textContent = t('machine.repair.missing');
      });
      rows.append(fix, out);
    }
    if (m.type === 'relay' && state.changes.beacon) rows.append(...tradeRows());
    if (m.type === 'relay' && !state.changes.beacon) {
      const note = el('div', 'mach-info', t('machine.beacon.help'));
      const go = el('button', undefined, t('machine.beacon'));
      go.type = 'button';
      const out = el('div', 'mach-info');
      go.addEventListener('click', () => {
        const r = actions.bus.dispatch<'activateBeacon'>({ type: 'activateBeacon', id: m.id });
        out.textContent = t(`machine.beacon.${r}` as TranslationKey);
      });
      rows.append(note, go, out);
    }
    if (def.fuel || (m.id < 0 && !isCargoWindow(m.id))) {
      rows.append(machineSlot(m, 'fuel', t('machine.fuel'), m.fuel));
      const fuelInfo = el('div', 'mach-info', fuelText(m));
      live.fuel = fuelInfo;
      const fuelBar = el('div', 'cycle-bar fuel-bar');
      fuelBar.setAttribute('role', 'progressbar');
      fuelBar.setAttribute('aria-label', t('machine.fuelBurn'));
      const fuelFill = el('div');
      fuelBar.append(fuelFill);
      live.fuelBar = fuelFill;
      setCycleBar(fuelFill, fuelFill01(m));
      rows.append(fuelInfo, fuelBar);
    }
    if (isAssembler(m.type)) rows.append(...assemblerRows(m));
    if (m.filters.length > 0) rows.append(...filterRows(m));
    if (isSmith(m.type)) {
      rows.append(...assemblerRows(m));
      const mould = recipeById(m.recipe)?.mould;
      if (mould) {
        rows.append(
          machineSlot(m, 'input', t('machine.mould', { item: itemName(mould) }), m.input),
        );
        rows.append(
          el(
            'div',
            'mach-info',
            t('machine.mouldWear', { n: String(m.wear), max: String(MOULD_CYCLES) }),
          ),
        );
      }
    }
    if (isTurret(m.type) && turretSpec(m.type).ammo)
      rows.append(machineSlot(m, 'input', t('machine.magazines'), m.input));
    if (m.type === 'fission_reactor') {
      rows.append(machineSlot(m, 'input', t('machine.rods'), m.input));
      rows.append(machineSlot(m, 'stock', t('machine.wasteOut'), m.stock));
      rows.append(el('div', 'mach-info', t('machine.reactor.help')));
      if (m.broken) {
        const fix = el('button', undefined, t('machine.repair'));
        fix.type = 'button';
        const out = el('div', 'mach-info');
        fix.addEventListener('click', () => {
          const r = actions.bus.dispatch<'repairReactor'>({ type: 'repairReactor', id: m.id });
          if (r === 'ok') return render();
          out.textContent = t('machine.repair.missing');
        });
        rows.append(fix, out);
      }
    }
    if (isDrill(m.type) || isSmith(m.type) || isAssembler(m.type)) {
      rows.append(
        machineSlot(
          m,
          'stock',
          t(
            isDrill(m.type)
              ? 'machine.stock'
              : isAssembler(m.type) || isSmith(m.type)
                ? 'machine.product'
                : 'machine.output',
          ),
          m.stock,
        ),
      );
    }
    if (isSmith(m.type) && (m.extra || recipeByproduct(recipeById(m.recipe) ?? EMPTY_RECIPE))) {
      rows.append(machineSlot(m, 'extra', t('machine.byproduct'), m.extra));
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
    if (m.id >= 0)
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
    updateHandCursor(state, selected);
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
    // La barre du cycle se met à jour plus souvent (cycles de quelques secondes) pour aller jusqu'au bout et revenir à zéro.
    barTimer = window.setInterval(() => {
      const m = machine();
      if (m) setCycleBar(live.cycle, factory.cycleFraction(m));
    }, 100);
  }

  function close(): void {
    if (current === null) return;
    current = null;
    selected = null;
    selectedSlot = null;
    dragging = false;
    state.returnHand();
    updateHandCursor(state, selected);
    programDrafts.clear();
    window.clearInterval(timer);
    window.clearInterval(barTimer);
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
    setLocoTab: (tab) => {
      locoTab = tab;
    },
    close,
    isOpen: () => current !== null,
    openedId: () => current,
    dispose: () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(timer);
      offLocale();
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
