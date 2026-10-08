import { CELL_SIZE_M } from '../constants';
import {
  chestPut,
  chestRoom,
  emptyMachine,
  ingredientCap,
  LIFTS,
  levelY,
  recipeOf,
  type Cell,
  type Factory,
  type Machine,
  type Stack,
} from '../factory/factory';
import { DISCOVERIES, discoveryFor } from '../data/discoveries';
import { SCIENCE_PACK, TECHS, scienceCost, techById, techFor } from '../data/techs';
import { isSmith, itemOfTier, machineDef, type MachineType } from '../data/machines';
import { recipeById } from '../data/recipes';
import { isFree, pieceKey, type PiecePos } from '../build/pieces';
import { pillarsFor, pillarsForFace } from '../build/support';
import { detectRooms, type Room } from '../build/rooms';
import { pieceDef, resolveKind, slotOf, type PieceKind } from '../data/buildings';
import {
  BAG_LIMITS,
  ITEMS,
  VEHICLE_BURN_KW,
  energyKJ,
  itemById,
  type BagLimits,
  type EquipSlot,
} from '../data/items';
import {
  add,
  maxAddable,
  normalizeInventory,
  remove,
  slotsUsed,
  totals,
  type Inventory,
} from './inventory';
import {
  MAGAZINE_ROUNDS,
  emptyChanges,
  normalizeChanges,
  type Corpse,
  type DroppedStack,
  type SpawnPoint,
  type Vehicle,
  type WorldChanges,
} from './worldChanges';

export type StateEvent =
  | { type: 'harvest'; key: string }
  | { type: 'drops' }
  | { type: 'inventory' }
  | { type: 'build' }
  | { type: 'hotbar' }
  | { type: 'factory' }
  | { type: 'discovery'; id: string };

export interface HarvestResult {
  /** Unités réellement ajoutées au sac. */
  gained: number;
  /** Ce qu'il reste dans la ressource après la récolte. */
  left: number;
  /** Le sac n'a pas pu tout recevoir. */
  bagFull: boolean;
}

/**
 * État de jeu modifiable par le joueur : sac et changements du monde. Toute modification passe par
 * une méthode (« commande ») : c'est ce que le multijoueur et l'annulation rejoueront plus tard.
 */
export class GameState {
  inventory: Inventory;
  changes: WorldChanges;
  /** Case de la barre de raccourcis sélectionnée (0 à 8), ou null. */
  selectedSlot: number | null = null;
  /** Objet « en main » depuis le sac, à poser dans une case de la barre au prochain clic. */
  carried: string | null = null;
  /** Objet posable tenu en main (choisi dans le sac) : clic droit = mains vides. */
  held: string | null = null;
  /** Pile tenue au bout du curseur (retirée du sac) pour la déplacer dans une case de machine ou un coffre. */
  hand: { item: string; count: number } | null = null;
  private roomCache: Room[] | null = null;
  private readonly listeners = new Set<(e: StateEvent) => void>();

  constructor(
    saved?: { inventory?: unknown; changes?: unknown },
    private readonly baseLimits: BagLimits = BAG_LIMITS,
  ) {
    this.inventory = normalizeInventory(saved?.inventory);
    this.changes = saved ? normalizeChanges(saved.changes) : emptyChanges();
  }

  /** Capacité du sac : de base, plus les bonus de l'équipement porté (sac à dos…). */
  get limits(): BagLimits {
    const l = { ...this.baseLimits };
    for (const id of Object.values(this.changes.equipment)) {
      const bonus = itemById(id).equip?.bonus;
      if (!bonus) continue;
      l.maxSlots += bonus.slots;
      l.maxWeightG += bonus.weightG;
      l.maxVolumeMl += bonus.volumeMl;
    }
    return l;
  }

  /** Capacité de base du sac, sans équipement. */
  baseLimitsView(): BagLimits {
    return { ...this.baseLimits };
  }

  onChange(listener: (e: StateEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: StateEvent): void {
    this.listeners.forEach((l) => l(e));
  }

  /** Copie à enregistrer dans une sauvegarde. */
  snapshot(): { inventory: Inventory; changes: WorldChanges } {
    // Ce que le joueur tient au bout du curseur fait partie de son sac.
    const inventory = structuredClone(this.inventory);
    return {
      inventory: this.hand ? add(inventory, this.hand.item, this.hand.count) : inventory,
      changes: structuredClone(this.changes),
    };
  }

  // --- Cases du sac : des piles de quantités différentes, déplaçables ----------------------------

  /** Cases du sac (l'ordre et le découpage des piles). Le contenu total reste `inventory`. */
  private bag: ({ item: string; count: number } | null)[] = [];

  /** Les cases du sac, remises d'accord avec le contenu (ajouts : piles entamées d'abord, puis cases libres). */
  bagSlots(): ({ item: string; count: number } | null)[] {
    const n = this.limits.maxSlots;
    const max = this.limits.stackMax;
    while (this.bag.length < n) this.bag.push(null);
    for (let i = n; i < this.bag.length; i++) this.bag[i] = null;
    this.bag.length = n;
    const sum = new Map<string, number>();
    for (const s of this.bag) if (s) sum.set(s.item, (sum.get(s.item) ?? 0) + s.count);
    // Trop dans les cases : on retire depuis la dernière.
    for (const [item, have] of sum) {
      let extra = have - (this.inventory[item] ?? 0);
      for (let i = n - 1; i >= 0 && extra > 0; i--) {
        const s = this.bag[i];
        if (!s || s.item !== item) continue;
        const cut = Math.min(extra, s.count);
        s.count -= cut;
        extra -= cut;
        if (s.count <= 0) this.bag[i] = null;
      }
    }
    // Pas assez : on complète les piles entamées, puis on prend des cases libres (dans l'ordre du catalogue).
    for (const def of ITEMS) {
      let need =
        (this.inventory[def.id] ?? 0) -
        this.bag.reduce((a, s) => a + (s && s.item === def.id ? s.count : 0), 0);
      for (let i = 0; i < n && need > 0; i++) {
        const s = this.bag[i];
        if (s && s.item === def.id && s.count < max) {
          const put = Math.min(need, max - s.count);
          s.count += put;
          need -= put;
        }
      }
      while (need > 0) {
        let free = this.bag.indexOf(null);
        if (free < 0) {
          this.compactBag();
          free = this.bag.indexOf(null);
          if (free < 0) break;
        }
        const put = Math.min(need, max);
        this.bag[free] = { item: def.id, count: put };
        need -= put;
      }
    }
    return this.bag;
  }

  /** Regroupe les piles du même objet (quand il n'y a plus de case libre). */
  private compactBag(): void {
    const max = this.limits.stackMax;
    const totals = new Map<string, number>();
    for (const s of this.bag) if (s) totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
    this.bag = this.bag.map(() => null);
    let i = 0;
    for (const [item, total] of totals) {
      for (let left = total; left > 0; left -= max)
        this.bag[i++] = { item, count: Math.min(left, max) };
    }
  }

  /** Déplace une pile d'une case à l'autre : case vide = déplacée, même objet = fusionnée, sinon échange. */
  moveBagSlot(from: number, to: number): void {
    const bag = this.bagSlots();
    const a = bag[from];
    if (!a || from === to || to < 0 || to >= bag.length) return;
    const b = bag[to];
    const max = this.limits.stackMax;
    if (!b) {
      bag[to] = a;
      bag[from] = null;
    } else if (b.item === a.item) {
      const put = Math.min(a.count, max - b.count);
      b.count += put;
      a.count -= put;
      if (a.count <= 0) bag[from] = null;
    } else {
      bag[to] = a;
      bag[from] = b;
    }
    this.emit({ type: 'inventory' });
  }

  /** Vide la case du sac (avant de retirer ses objets du contenu, par exemple pour les jeter). */
  clearBagSlot(index: number): { item: string; count: number } | null {
    const bag = this.bagSlots();
    const s = bag[index] ?? null;
    if (s) bag[index] = null;
    return s;
  }

  /** Pose la pile tenue au curseur dans cette case du sac (vide : nouvelle pile ; même objet : on complète ; sinon échange). */
  placeHand(index: number): number {
    const h = this.hand;
    if (!h) return 0;
    const bag = this.bagSlots();
    if (index < 0 || index >= bag.length) return 0;
    const max = this.limits.stackMax;
    const slot = bag[index];
    const room = maxAddable(this.inventory, h.item, this.limits);
    if (slot && slot.item !== h.item) {
      // Échange : la pile de la case passe au curseur.
      if (h.count > max) return 0;
      const old = { ...slot };
      bag[index] = { item: h.item, count: h.count };
      this.inventory = add(this.inventory, h.item, h.count);
      this.inventory = remove(this.inventory, old.item, old.count).inventory;
      this.hand = old;
    } else {
      const n = Math.min(h.count, room, max - (slot?.count ?? 0));
      if (n <= 0) return 0;
      if (slot) slot.count += n;
      else bag[index] = { item: h.item, count: n };
      this.inventory = add(this.inventory, h.item, n);
      h.count -= n;
      if (h.count <= 0) this.hand = null;
    }
    this.emit({ type: 'inventory' });
    return 1;
  }

  /** Prend `count` unités du sac au bout du curseur (la pile tenue est d'abord rangée si c'est un autre objet). */
  takeToHand(item: string, count: number, slot?: number): number {
    if (this.hand && this.hand.item !== item) this.returnHand();
    let n = Math.min(count, this.inventory[item] ?? 0);
    if (n <= 0) return 0;
    if (slot !== undefined) {
      // La pile cliquée est celle qui diminue.
      const s = this.bagSlots()[slot];
      if (s && s.item === item) {
        n = Math.min(n, s.count);
        s.count -= n;
        if (s.count <= 0) this.bag[slot] = null;
      }
    }
    this.inventory = remove(this.inventory, item, n).inventory;
    this.hand = { item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Prend des objets d'une case de coffre (ou d'ingrédient d'assembleur) au bout du curseur. */
  takeChestToHand(m: Machine, index: number, count: number): number {
    const st = m.slots[index];
    if (!st || (this.hand && this.hand.item !== st.item)) return 0;
    const n = Math.min(count, st.count);
    if (n <= 0) return 0;
    st.count -= n;
    if (st.count <= 0) m.slots.splice(index, 1);
    this.hand = { item: st.item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Prend des objets d'une case de machine (combustible, entrée, sortie) au bout du curseur. */
  takeSlotToHand(m: Machine, slot: 'fuel' | 'input' | 'stock' | 'extra', count: number): number {
    const st = m[slot];
    if (!st || (this.hand && this.hand.item !== st.item)) return 0;
    const n = Math.min(count, st.count);
    if (n <= 0) return 0;
    st.count -= n;
    if (st.count <= 0) m[slot] = null;
    this.hand = { item: st.item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Range dans le sac la pile tenue (tout ce qui tient). Renvoie la quantité rangée. */
  returnHand(): number {
    if (!this.hand) return 0;
    const n = Math.min(this.hand.count, maxAddable(this.inventory, this.hand.item, this.limits));
    if (n > 0) this.inventory = add(this.inventory, this.hand.item, n);
    this.hand.count -= n;
    if (this.hand.count <= 0) this.hand = null;
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Dépose la pile tenue via `use(item, count)` (qui renvoie la quantité acceptée) ; le reste reste en main. */
  useHand(use: (item: string, count: number) => number): number {
    const h = this.hand;
    if (!h) return 0;
    // Les actions de la machine puisent dans le sac : on y remet la pile le temps du geste.
    this.hand = null;
    this.inventory = add(this.inventory, h.item, h.count);
    const moved = use(h.item, h.count);
    const left = h.count - moved;
    if (left > 0) {
      this.inventory = remove(this.inventory, h.item, left).inventory;
      this.hand = { item: h.item, count: left };
    }
    this.emit({ type: 'inventory' });
    return moved;
  }

  /**
   * Équipe 1 objet du sac sur son emplacement ; celui qui y était retourne au sac (échange).
   * Renvoie 'ok', 'notEquipment' (pas un équipement) ou 'bagFull' (l'échange ne tient pas).
   */
  equip(item: string): 'ok' | 'notEquipment' | 'bagFull' {
    const slot = itemById(item).equip?.slot;
    if (!slot) return 'notEquipment';
    if ((this.inventory[item] ?? 0) <= 0) return 'notEquipment';
    const previous = this.changes.equipment[slot];
    const saved = { inventory: this.inventory, equipment: { ...this.changes.equipment } };
    this.inventory = remove(this.inventory, item, 1).inventory;
    this.changes.equipment[slot] = item;
    if (previous) {
      if (maxAddable(this.inventory, previous, this.limits) < 1) {
        this.inventory = saved.inventory;
        this.changes.equipment = saved.equipment;
        return 'bagFull';
      }
      this.inventory = add(this.inventory, previous, 1);
    }
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Retire l'équipement d'un emplacement vers le sac, si le sac (sans le bonus de l'objet) le contient encore. */
  unequip(slot: EquipSlot): 'ok' | 'empty' | 'bagFull' {
    const item = this.changes.equipment[slot];
    if (!item) return 'empty';
    const saved = { ...this.changes.equipment };
    delete this.changes.equipment[slot];
    const lim = this.limits;
    const withItem = add(this.inventory, item, 1);
    const used = totals(withItem);
    const slots = slotsUsed(withItem, lim);
    if (used.weightG > lim.maxWeightG || used.volumeMl > lim.maxVolumeMl || slots > lim.maxSlots) {
      this.changes.equipment = saved;
      return 'bagFull';
    }
    this.inventory = withItem;
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Le sac peut-il encore recevoir au moins une unité de cet objet ? */
  hasRoomFor(item: string): boolean {
    return maxAddable(this.inventory, item, this.limits) > 0;
  }

  /** Reste dans une ressource dont le contenu d'origine est `total`. */
  remaining(key: string, total: number): number {
    return Math.max(0, total - (this.changes.taken[key] ?? 0));
  }

  /** Compte une récolte à la main et déclenche les découvertes atteintes. */
  private countHarvest(item: string, n: number): void {
    this.changes.harvested[item] = (this.changes.harvested[item] ?? 0) + n;
    this.checkDiscoveries('harvest');
  }

  /** Quelque chose a été fabriqué (par une machine ou à la main) : compteur des découvertes. */
  countProduced(item: string, n: number): void {
    if (n <= 0) return;
    this.changes.produced[item] = (this.changes.produced[item] ?? 0) + n;
    this.checkDiscoveries('produce');
    this.emit({ type: 'inventory' });
  }

  /** Avancement d'une découverte (plafonné à son objectif). */
  discoveryProgress(d: (typeof DISCOVERIES)[number]): number {
    const counter = d.goal.kind === 'harvest' ? this.changes.harvested : this.changes.produced;
    return Math.min(d.goal.count, counter[d.goal.item] ?? 0);
  }

  private checkDiscoveries(kind: 'harvest' | 'produce'): void {
    for (const d of DISCOVERIES) {
      if (d.goal.kind !== kind || this.changes.discovered.includes(d.id)) continue;
      if (this.discoveryProgress(d) < d.goal.count) continue;
      this.changes.discovered.push(d.id);
      this.emit({ type: 'discovery', id: d.id });
    }
  }

  /** Récolte jusqu'à `units` unités d'une ressource (arbre, rocher, case de minerai). */
  harvest(key: string, total: number, item: string, units = 1): HarvestResult {
    const available = this.remaining(key, total);
    const fits = maxAddable(this.inventory, item, this.limits);
    const gained = Math.max(0, Math.min(units, available, fits));
    if (gained > 0) {
      this.inventory = add(this.inventory, item, gained);
      this.changes.taken[key] = (this.changes.taken[key] ?? 0) + gained;
      this.countHarvest(item, gained);
      this.emit({ type: 'harvest', key });
      this.emit({ type: 'inventory' });
    }
    return { gained, left: available - gained, bagFull: gained < Math.min(units, available) };
  }

  /** Pose des objets du sac au sol. Renvoie la pile créée, ou null s'il n'y a rien à jeter. */
  drop(item: string, count: number, x: number, z: number): DroppedStack | null {
    const { inventory, removed } = remove(this.inventory, item, count);
    if (removed === 0) return null;
    this.inventory = inventory;
    const stack: DroppedStack = {
      id: `drop-${this.changes.nextDropId++}`,
      item,
      count: removed,
      x,
      z,
    };
    this.changes.drops.push(stack);
    this.emit({ type: 'drops' });
    this.emit({ type: 'inventory' });
    return stack;
  }

  /** Ramasse (tout ou en partie, selon la place) une pile posée au sol. */
  pickUp(stackId: string): HarvestResult {
    const stack = this.changes.drops.find((d) => d.id === stackId);
    if (!stack) return { gained: 0, left: 0, bagFull: false };
    const gained = Math.min(stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (gained > 0) {
      this.inventory = add(this.inventory, stack.item, gained);
      stack.count -= gained;
      if (stack.count <= 0) this.changes.drops = this.changes.drops.filter((d) => d.id !== stackId);
      this.emit({ type: 'drops' });
      this.emit({ type: 'inventory' });
    }
    return { gained, left: stack.count, bagFull: stack.count > 0 };
  }

  /** Ouvre ou ferme une porte (clé du bloc 0 de la porte). Renvoie vrai si elle est ouverte ensuite. */
  toggleDoor(key: string): boolean | null {
    const kind = this.changes.pieces[key];
    const m = /^e:(-?\d+):(-?\d+),(-?\d+):([xz]):0$/.exec(key);
    if (!kind?.startsWith('door') || !m) return null;
    const open = `o:${m[1]}:${m[2]},${m[3]}:${m[4]}`;
    const nowOpen = !this.changes.pieces[open];
    if (nowOpen) this.changes.pieces[open] = kind;
    else delete this.changes.pieces[open];
    this.emit({ type: 'build' });
    return nowOpen;
  }

  // --- Barre de raccourcis ---------------------------------------------------------------------

  /** Sélectionne la case (ou la désélectionne si elle l'était déjà). Une case vide ne se sélectionne pas. */
  selectSlot(index: number): void {
    if (index < 0 || index >= this.changes.hotbar.length) return;
    this.held = null;
    this.selectedSlot = this.selectedSlot === index || !this.changes.hotbar[index] ? null : index;
    this.emit({ type: 'hotbar' });
  }

  /** Objet de la case sélectionnée. */
  selectedItem(): string | null {
    if (this.held) {
      if ((this.inventory[this.held] ?? 0) > 0) return this.held;
      this.held = null;
    }
    return this.selectedSlot === null ? null : this.changes.hotbar[this.selectedSlot];
  }

  /** Prend en main un objet posable choisi dans le sac (prioritaire sur la barre de raccourcis). */
  setHeld(item: string | null): void {
    this.held = item && (this.inventory[item] ?? 0) > 0 ? item : null;
    this.emit({ type: 'hotbar' });
  }

  /** Outil rangé dans la case d'outils (s'il en reste dans le sac), ou null : mains nues. */
  toolItem(index = 0): string | null {
    const id = this.changes.tools[index] ?? null;
    return id && (this.inventory[id] ?? 0) > 0 ? id : null;
  }

  /** Bonus de récolte de l'outil en place (null = mains nues). */
  harvestTool(): { speed: number; yield: number } | null {
    const id = this.toolItem();
    return id ? itemById(id).tool : null;
  }

  /** Range un outil (ou le pistolet) dans la case d'outils, ou la vide (`null`). */
  assignTool(index: number, item: string | null): boolean {
    if (index < 0 || index >= this.changes.tools.length) return false;
    if (item !== null) {
      const def = itemById(item);
      if (!def.tool && def.id !== 'pistol') return false;
    }
    this.changes.tools[index] = item;
    this.carried = null;
    this.emit({ type: 'hotbar' });
    return true;
  }

  /** Range un objet dans une case (un objet n'occupe qu'une case) ou la vide (`null`). */
  assignSlot(index: number, item: string | null): void {
    if (index < 0 || index >= this.changes.hotbar.length) return;
    if (item !== null) {
      this.changes.hotbar = this.changes.hotbar.map((x) => (x === item ? null : x));
    }
    this.changes.hotbar[index] = item;
    if (this.selectedSlot !== null && !this.changes.hotbar[this.selectedSlot]) {
      this.selectedSlot = null;
    }
    this.carried = null;
    this.emit({ type: 'hotbar' });
  }

  // --- Construction ----------------------------------------------------------------------------

  /** Les pièces (espaces fermés) du moment, recalculées seulement après une modification. */
  rooms(): Room[] {
    this.roomCache ??= detectRooms(this.changes.pieces);
    return this.roomCache;
  }

  /** Le sac contient-il l'objet nécessaire pour poser cette pièce ? */
  canAfford(kind: PieceKind): boolean {
    return (this.inventory[pieceDef(kind).item] ?? 0) >= 1;
  }

  /** Pose une pièce (consomme 1 objet du sac). Refuse si l'emplacement est pris ou si le sac n'en a pas. */
  place(kind: PieceKind, pos: PiecePos, rotation = 0): 'ok' | 'occupied' | 'missing' | 'invalid' {
    const def = pieceDef(kind);
    // Une dalle devient un sol ou un plafond selon l'emplacement.
    const placed = resolveKind(kind, pos.slot);
    if (slotOf(pieceDef(placed).type) !== pos.slot) return 'invalid';
    if (!isFree(this.changes.pieces, placed, pos)) return 'occupied';
    if (!this.canAfford(kind)) return 'missing';
    this.inventory = remove(this.inventory, def.item, 1).inventory;
    this.changes.pieces[pieceKey(pos)] = placed;
    // Pièce en hauteur à plus de 2,5 m d'un support : des piliers sont posés automatiquement (sans coût).
    Object.assign(
      this.changes.pieces,
      pillarsFor(this.changes.pieces, pos, pieceDef(placed).material),
    );
    if (rotation % 4 !== 0) this.changes.rotations[pieceKey(pos)] = ((rotation % 4) + 4) % 4;
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Pose plusieurs pièces d'un coup ; renvoie combien ont pu l'être (selon le stock et les emplacements libres). */
  placeMany(kind: PieceKind, positions: PiecePos[], rotation = 0): number {
    let n = 0;
    for (const pos of positions) if (this.place(kind, pos, rotation) === 'ok') n++;
    return n;
  }

  /**
   * Fabrique à la main jusqu'à `times` unités d'un objet. Ne fabrique que ce que les ressources et la
   * place dans le sac permettent. Renvoie le nombre fabriqué et la raison de l'arrêt éventuel.
   */
  /** Cet objet peut-il être fabriqué (sa technologie est-elle recherchée) ? */
  isUnlocked(item: string): boolean {
    const tech = techFor(item);
    const discovery = discoveryFor(item);
    return (
      (!tech || this.changes.unlocked.includes(tech.id)) &&
      (!discovery || this.changes.discovered.includes(discovery.id))
    );
  }

  /** Recherche une technologie : consomme son coût dans le sac. */
  research(id: string): 'ok' | 'done' | 'locked' | 'missing' | 'lab' {
    const tech = techById(id);
    if (this.changes.unlocked.includes(id)) return 'done';
    if (scienceCost(tech) > 0) return 'lab';
    if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) return 'locked';
    if (!Object.entries(tech.cost).every(([item, n]) => (this.inventory[item] ?? 0) >= n))
      return 'missing';
    for (const [item, n] of Object.entries(tech.cost))
      this.inventory = remove(this.inventory, item, n).inventory;
    this.changes.unlocked.push(id);
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Choisit (ou, avec null, arrête) la technologie étudiée par les laboratoires. */
  study(id: string | null): 'ok' | 'done' | 'locked' | 'notLab' {
    if (id === null) {
      this.changes.researching = null;
      this.emit({ type: 'factory' });
      return 'ok';
    }
    const tech = techById(id);
    if (scienceCost(tech) <= 0) return 'notLab';
    if (this.changes.unlocked.includes(id)) return 'done';
    if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) return 'locked';
    this.changes.researching = id;
    this.emit({ type: 'factory' });
    return 'ok';
  }

  /** Sans étude choisie, les laboratoires qui ont des paquets étudient la première technologie disponible. */
  autoStudy(): string | null {
    if (this.changes.researching) return null;
    for (const tech of TECHS) {
      if (scienceCost(tech) <= 0 || this.changes.unlocked.includes(tech.id)) continue;
      if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) continue;
      this.study(tech.id);
      return tech.id;
    }
    return null;
  }

  /** Paquets de science encore à étudier pour la technologie en cours. */
  studyRemaining(): number {
    const id = this.changes.researching;
    if (!id) return 0;
    return Math.max(0, scienceCost(techById(id)) - (this.changes.progress[id] ?? 0));
  }

  /** Les laboratoires ont étudié `n` paquets : la technologie avance, et se débloque à la fin. */
  addStudy(n: number): void {
    const id = this.changes.researching;
    if (!id || n <= 0) return;
    const cost = scienceCost(techById(id));
    this.changes.progress[id] = Math.min(cost, (this.changes.progress[id] ?? 0) + n);
    if (this.changes.progress[id] >= cost) {
      this.changes.unlocked.push(id);
      this.changes.researching = null;
    }
    this.emit({ type: 'inventory' });
  }

  craft(
    item: string,
    times: number,
  ): { made: number; stopped: 'resources' | 'bag' | 'locked' | null } {
    const recipe = itemById(item).recipe;
    if (!recipe) return { made: 0, stopped: 'resources' };
    if (!this.isUnlocked(item)) return { made: 0, stopped: 'locked' };
    let made = 0;
    let stopped: 'resources' | 'bag' | null = null;
    while (made < times) {
      if (!Object.entries(recipe).every(([id, n]) => (this.inventory[id] ?? 0) >= n)) {
        stopped = 'resources';
        break;
      }
      let after = this.inventory;
      for (const [id, n] of Object.entries(recipe)) after = remove(after, id, n).inventory;
      const per = itemById(item).yield;
      if (maxAddable(after, item, this.limits) < per) {
        stopped = 'bag';
        break;
      }
      this.inventory = add(after, item, per);
      made += per;
    }
    if (made > 0) {
      this.changes.produced[item] = (this.changes.produced[item] ?? 0) + made;
      this.checkDiscoveries('produce');
      // Une pièce de construction fabriquée prend la première case libre de la barre.
      if (item.startsWith('piece_') && !this.changes.hotbar.includes(item)) {
        const free = this.changes.hotbar.indexOf(null);
        if (free >= 0) {
          this.changes.hotbar[free] = item;
          this.emit({ type: 'hotbar' });
        }
      }
      this.emit({ type: 'inventory' });
    }
    return { made, stopped };
  }

  /**
   * Démolit des pièces et rend les objets correspondants (ce qui ne tient pas dans le sac tombe au sol
   * aux coordonnées données). Renvoie le nombre de pièces démontées.
   */
  removeKeys(keys: string[], drop: { x: number; z: number }): number {
    let n = 0;
    for (const key of keys) {
      const kind = this.changes.pieces[key];
      if (!kind) continue;
      delete this.changes.pieces[key];
      delete this.changes.rotations[key];
      const door = /^e:(-?\d+):(-?\d+),(-?\d+):([xz]):0$/.exec(key);
      if (door) delete this.changes.pieces[`o:${door[1]}:${door[2]},${door[3]}:${door[4]}`];
      n++;
      // Démolir rend la pièce elle-même (l'objet), pas ses ressources de fabrication. Un pilier
      // automatique ne rend rien.
      if (pieceDef(kind).type !== 'pillar') this.giveBack(pieceDef(kind).item, 1, drop);
    }
    if (n > 0) {
      this.roomCache = null;
      this.emit({ type: 'build' });
      this.emit({ type: 'inventory' });
    }
    return n;
  }

  // --- Véhicules ---------------------------------------------------------------------------------

  /** Pose un buggy (consomme l'objet du sac). */
  // --- Mort, corps et réapparition ---------------------------------------------------------------

  /** Le joueur tombe : tout ce qu'il porte (sac, curseur, équipement) reste sur son corps, à récupérer. */
  dieAt(x: number, z: number, yaw: number): Corpse {
    const inventory = this.hand
      ? add(structuredClone(this.inventory), this.hand.item, this.hand.count)
      : structuredClone(this.inventory);
    const corpse: Corpse = {
      id: this.changes.nextCorpseId++,
      x,
      z,
      yaw,
      inventory,
      equipment: { ...this.changes.equipment },
    };
    this.inventory = {};
    this.hand = null;
    this.held = null;
    this.carried = null;
    this.bag = [];
    this.changes.equipment = {};
    this.changes.corpses.push(corpse);
    this.emit({ type: 'inventory' });
    return corpse;
  }

  /**
   * Le joueur interagit avec un corps : l'équipement se remet sur lui (ou va au sac si l'emplacement est pris),
   * puis le contenu passe dans le sac autant que la place le permet. Le corps disparaît quand il est vide.
   */
  recoverCorpse(id: number): 'recovered' | 'partial' | 'empty' | 'none' {
    const corpse = this.changes.corpses.find((c) => c.id === id);
    if (!corpse) return 'none';
    const hadStuff =
      Object.keys(corpse.inventory).length > 0 || Object.keys(corpse.equipment).length > 0;
    for (const [slot, item] of Object.entries(corpse.equipment) as [EquipSlot, string][]) {
      if (!this.changes.equipment[slot]) this.changes.equipment[slot] = item;
      else corpse.inventory = add(corpse.inventory, item, 1);
      delete corpse.equipment[slot];
    }
    for (const [item, count] of Object.entries(corpse.inventory)) {
      const n = Math.min(count, maxAddable(this.inventory, item, this.limits));
      if (n <= 0) continue;
      this.inventory = add(this.inventory, item, n);
      corpse.inventory = remove(corpse.inventory, item, n).inventory;
    }
    const left = Object.keys(corpse.inventory).length > 0;
    if (!left) this.changes.corpses.splice(this.changes.corpses.indexOf(corpse), 1);
    this.emit({ type: 'inventory' });
    return !hadStuff ? 'empty' : left ? 'partial' : 'recovered';
  }

  /** Pose un duvet (usage unique) ou un lit (permanent) : le dernier posé est le point de réapparition. */
  placeSpawn(kind: 'bag' | 'bed', x: number, z: number): SpawnPoint | null {
    const item = kind === 'bag' ? 'sleeping_bag' : 'bed';
    if ((this.inventory[item] ?? 0) < 1) return null;
    this.inventory = remove(this.inventory, item, 1).inventory;
    const point: SpawnPoint = { id: this.changes.nextSpawnId++, x, z, kind };
    this.changes.spawns.push(point);
    this.emit({ type: 'inventory' });
    return point;
  }

  /** Range un duvet ou un lit : il revient dans le sac (ou tombe au sol si le sac est plein). */
  pickUpSpawn(id: number, at: { x: number; z: number }): boolean {
    const i = this.changes.spawns.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const [point] = this.changes.spawns.splice(i, 1);
    this.giveBack(point.kind === 'bag' ? 'sleeping_bag' : 'bed', 1, at);
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Où le joueur se réveille : le dernier duvet ou lit posé (un duvet est consommé), sinon `null` (point de départ). */
  consumeRespawn(): { x: number; z: number } | null {
    const spawns = this.changes.spawns;
    const last = spawns[spawns.length - 1];
    if (!last) return null;
    if (last.kind === 'bag') spawns.pop();
    return { x: last.x, z: last.z };
  }

  /**
   * Un tapis surélevé (niveau 1 ou 2, y compris les rampes qui montent du niveau 1) doit avoir un support à moins de
   * 2,5 m : sinon un pilier de soutènement est posé sous lui, automatiquement et sans coût (comme pour la construction).
   */
  private supportBelt(type: MachineType, gx: number, gz: number, lift: number): void {
    if (type !== 'conveyor') return;
    const shape = LIFTS[lift];
    const low = shape ? Math.min(shape.from, shape.to) : 0;
    if (low < 1) return;
    const added = pillarsForFace(
      this.changes.pieces,
      Math.round(levelY(low) / CELL_SIZE_M),
      gx,
      gz,
      'stone',
    );
    if (Object.keys(added).length === 0) return;
    Object.assign(this.changes.pieces, added);
    this.roomCache = null;
    this.emit({ type: 'build' });
  }

  /** Filtre d'un bras filtrant ou d'un trieur : passe de liste blanche à liste noire (ou l'inverse). */
  setFilterMode(m: Machine, index: number, mode: 'allow' | 'deny'): boolean {
    const f = m.filters[index];
    if (!f) return false;
    f.mode = mode;
    this.emit({ type: 'factory' });
    return true;
  }

  /** Coche ou décoche un objet dans un filtre. Renvoie vrai s'il est maintenant coché. */
  toggleFilterItem(m: Machine, index: number, item: string): boolean {
    const f = m.filters[index];
    if (!f) return false;
    const at = f.items.indexOf(item);
    if (at >= 0) f.items.splice(at, 1);
    else f.items.push(item);
    this.emit({ type: 'factory' });
    return at < 0;
  }

  /** Vide un filtre (liste noire vide : tout passe). */
  clearFilter(m: Machine, index: number): void {
    const f = m.filters[index];
    if (!f) return;
    f.items = [];
    this.emit({ type: 'factory' });
  }

  placeVehicle(x: number, z: number, yaw: number): Vehicle | null {
    if ((this.inventory.vehicle_buggy ?? 0) < 1) return null;
    this.inventory = remove(this.inventory, 'vehicle_buggy', 1).inventory;
    const id = this.changes.vehicles.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    const v: Vehicle = { id, x, z, yaw, fuel: 0, fuelStack: null, slots: [] };
    this.changes.vehicles.push(v);
    this.emit({ type: 'inventory' });
    return v;
  }

  /** Range un buggy dans le sac (ou au sol s'il est plein). */
  pickUpVehicle(id: number): boolean {
    const i = this.changes.vehicles.findIndex((v) => v.id === id);
    if (i < 0) return false;
    const [v] = this.changes.vehicles.splice(i, 1);
    this.giveBack('vehicle_buggy', 1, { x: v.x, z: v.z });
    for (const st of [v.fuelStack, ...v.slots])
      if (st) this.giveBack(st.item, st.count, { x: v.x, z: v.z });
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Remplit le réservoir du buggy avec un combustible du sac (renvoie les secondes de route ajoutées, 0 s'il n'y en a pas). */
  refuelVehicle(v: Vehicle): number {
    // D'abord la case de carburant, puis le coffre du buggy, puis le sac.
    const take = (): { seconds: number } | null => {
      const f = v.fuelStack;
      if (f && itemById(f.item).energyMJ) {
        f.count--;
        if (f.count <= 0) v.fuelStack = null;
        return { seconds: energyKJ(f.item) / VEHICLE_BURN_KW };
      }
      for (const item of ['coal', 'wood']) {
        const seconds = energyKJ(item) / VEHICLE_BURN_KW;
        const stack = v.slots.find((x) => x.item === item);
        if (stack) {
          stack.count--;
          if (stack.count <= 0) v.slots.splice(v.slots.indexOf(stack), 1);
          return { seconds };
        }
      }
      for (const item of ['coal', 'wood']) {
        const seconds = energyKJ(item) / VEHICLE_BURN_KW;
        if ((this.inventory[item] ?? 0) >= 1) {
          this.inventory = remove(this.inventory, item, 1).inventory;
          return { seconds };
        }
      }
      return null;
    };
    const got = take();
    if (got) {
      v.fuel += got.seconds;
      this.emit({ type: 'inventory' });
      return got.seconds;
    }
    return 0;
  }

  // --- Machines ------------------------------------------------------------------------------------

  /** Pose une machine ou un élément de tapis (consomme l'objet du sac). */
  placeMachine(
    factory: Factory,
    type: MachineType,
    gx: number,
    gz: number,
    rot: number,
    blocked: (c: Cell) => boolean,
    lift = 0,
    tier = 1,
  ): 'ok' | 'missing' | 'blocked' {
    const def = machineDef(type);
    const item = itemOfTier(def, tier);
    if ((this.inventory[item] ?? 0) < 1) return 'missing';
    if (!factory.canPlace(type, gx, gz, rot, blocked, lift, tier)) return 'blocked';
    this.inventory = remove(this.inventory, item, 1).inventory;
    // Amélioration d'un tapis : l'ancien revient dans le sac, ses objets restent sur le nouveau.
    const old = factory.upgradeOf(type, gx, gz, lift, tier);
    if (old) {
      factory.remove(old.id);
      this.giveBack(itemOfTier(def, old.tier), 1, {
        x: (gx + 0.5) * CELL_SIZE_M,
        z: (gz + 0.5) * CELL_SIZE_M,
      });
      const fresh = emptyMachine(this.changes.nextMachineId++, type, gx, gz, rot, lift, tier);
      fresh.belt = old.belt;
      fresh.fluid = old.fluid;
      factory.add(fresh);
      this.emit({ type: 'factory' });
      this.emit({ type: 'inventory' });
      return 'ok';
    }
    // Les tapis remplacés (séparateur / groupeur posé sur une ligne) reviennent dans le sac avec leur contenu.
    const at = { x: (gx + 0.5) * CELL_SIZE_M, z: (gz + 0.5) * CELL_SIZE_M };
    for (const belt of factory.replacedBelts(type, gx, gz, rot, lift))
      this.removeMachine(factory, belt.id, at);
    factory.add(emptyMachine(this.changes.nextMachineId++, type, gx, gz, rot, lift, tier));
    this.supportBelt(type, gx, gz, lift);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Remet dans le sac (ou au sol si plein) un tas qui sort d'une machine ou d'une démolition. */
  private giveBack(item: string, count: number, at: { x: number; z: number }): void {
    if (count <= 0) return;
    const fits = Math.min(count, maxAddable(this.inventory, item, this.limits));
    if (fits > 0) this.inventory = add(this.inventory, item, fits);
    if (count - fits > 0) {
      this.changes.drops.push({
        id: `drop-${this.changes.nextDropId++}`,
        item,
        count: count - fits,
        x: at.x,
        z: at.z,
      });
      this.emit({ type: 'drops' });
    }
  }

  /** Assembleur : choisit l'objet à fabriquer ; les ingrédients et le produit en cours reviennent au sac. */
  setRecipe(m: Machine, item: string | null): boolean {
    if (m.type !== 'assembler' && !isSmith(m.type)) return false;
    if (item !== null) {
      if (isSmith(m.type) ? recipeById(item)?.machine !== m.type : !itemById(item).recipe)
        return false;
      // Une recette dont le produit n'est pas encore débloqué (technologie) reste fermée.
      const product = isSmith(m.type) ? Object.keys(recipeById(item)?.out ?? {})[0] : item;
      if (product && !this.isUnlocked(product)) return false;
    }
    const at = { x: m.gx * CELL_SIZE_M, z: m.gz * CELL_SIZE_M };
    for (const stack of [...m.slots, m.stock, m.extra])
      if (stack) this.giveBack(stack.item, stack.count, at);
    m.slots = [];
    m.stock = null;
    m.extra = null;
    m.progress = 0;
    m.recipe = item;
    // Changer de recette rend aussi le moule en réserve (celui qui est engagé se perd).
    if (isSmith(m.type) && m.input && m.input.item !== recipeById(item)?.mould) {
      this.giveBack(m.input.item, m.input.count, at);
      m.input = null;
    }
    m.wear = 0;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Assembleur : met des ingrédients du sac dans la machine (seulement ceux de la recette). Renvoie la quantité. */
  loadIngredient(m: Machine, item: string, count: number): number {
    const need = recipeOf(m)?.[item];
    if ((m.type !== 'assembler' && !isSmith(m.type)) || !need) return 0;
    const stack = m.slots.find((x) => x.item === item);
    const room = ingredientCap(need) - (stack?.count ?? 0);
    const moved = Math.min(count, this.inventory[item] ?? 0, room);
    if (moved <= 0) return 0;
    this.inventory = remove(this.inventory, item, moved).inventory;
    if (stack) stack.count += moved;
    else m.slots.push({ item, count: moved });
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Recharge le pistolet avec un chargeur du sac. */
  reload(): 'ok' | 'noMagazine' | 'full' {
    if (this.changes.ammo >= MAGAZINE_ROUNDS) return 'full';
    if ((this.inventory.magazine ?? 0) <= 0) return 'noMagazine';
    this.inventory = remove(this.inventory, 'magazine', 1).inventory;
    this.changes.ammo = MAGAZINE_ROUNDS;
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Tire une balle ; renvoie faux si le pistolet est vide. */
  fire(): boolean {
    if (this.changes.ammo <= 0) return false;
    this.changes.ammo--;
    return true;
  }

  /** Une machine détruite (par des ennemis) : elle disparaît avec son contenu, sans rien rendre. */
  destroyMachine(factory: Factory, id: number): boolean {
    const m = factory.remove(id);
    if (!m) return false;
    this.emit({ type: 'factory' });
    return true;
  }

  /** Démolit une machine : l'objet et son contenu reviennent au joueur. */
  removeMachine(factory: Factory, id: number, at: { x: number; z: number }): boolean {
    const m = factory.remove(id);
    if (!m) return false;
    this.giveBack(itemOfTier(machineDef(m.type), m.tier), 1, at);
    for (const stack of [m.fuel, m.input, m.stock, m.extra, ...m.slots])
      if (stack) this.giveBack(stack.item, stack.count, at);
    for (const b of m.belt) this.giveBack(b.item, 1, at);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return true;
  }

  /**
   * Met des objets du sac dans la case de combustible ou d'entrée d'une machine (un seul type par case).
   * Renvoie la quantité déplacée.
   */
  loadMachine(m: Machine, slot: 'fuel' | 'input', item: string, count: number): number {
    const max = machineDef(m.type).stockMax ?? 100;
    if (slot === 'fuel' && ((!machineDef(m.type).fuel && m.id >= 0) || !itemById(item).energyMJ))
      return 0;
    if (
      slot === 'input' &&
      !(isSmith(m.type) && !!item && recipeById(m.recipe)?.mould === item) &&
      !(m.type === 'lab' && item === SCIENCE_PACK) &&
      !(m.type === 'turret' && item === 'magazine')
    )
      return 0;
    const current: Stack | null = slot === 'fuel' ? m.fuel : m.input;
    if (current && current.item !== item) return 0;
    const moved = Math.min(count, this.inventory[item] ?? 0, max - (current?.count ?? 0));
    if (moved <= 0) return 0;
    this.inventory = remove(this.inventory, item, moved).inventory;
    const next = { item, count: (current?.count ?? 0) + moved };
    if (slot === 'fuel') m.fuel = next;
    else m.input = next;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Reprend dans le sac le contenu d'une case de machine (tout ce qui tient). Renvoie la quantité. */
  unloadMachine(m: Machine, slot: 'fuel' | 'input' | 'stock' | 'extra', count = Infinity): number {
    const stack = m[slot];
    if (!stack) return 0;
    const moved = Math.min(count, stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (moved <= 0) return 0;
    this.inventory = add(this.inventory, stack.item, moved);
    stack.count -= moved;
    if (stack.count <= 0) m[slot] = null;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Retire du monde du minerai (l'usine épuise vraiment les cases) ; renvoie la quantité retirée. */
  takeFromWorld(key: string, total: number, units: number): number {
    const n = Math.max(0, Math.min(units, this.remaining(key, total)));
    if (n > 0) this.changes.taken[key] = (this.changes.taken[key] ?? 0) + n;
    return n;
  }

  /** Range des objets du sac dans un coffre (jusqu'à `count`). Renvoie la quantité rangée. */
  putInChest(m: Machine, item: string, count: number): number {
    const n = Math.min(count, this.inventory[item] ?? 0, chestRoom(m, item));
    if (n <= 0) return 0;
    const stored = chestPut(m, item, n);
    this.inventory = remove(this.inventory, item, stored).inventory;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return stored;
  }

  /** Reprend dans le sac la pile n° `index` d'un coffre (tout ce qui tient). Renvoie la quantité. */
  takeFromChest(m: Machine, index: number, count = Infinity): number {
    const stack = m.slots[index];
    if (!stack) return 0;
    const moved = Math.min(count, stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (moved <= 0) return 0;
    this.inventory = add(this.inventory, stack.item, moved);
    stack.count -= moved;
    if (stack.count <= 0) m.slots.splice(index, 1);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }
}
