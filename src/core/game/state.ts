import { CELL_SIZE_M } from '../constants';
import {
  chestPut,
  chestRoom,
  emptyMachine,
  ingredientCap,
  type Cell,
  type Factory,
  type Machine,
  type Stack,
} from '../factory/factory';
import { SCIENCE_PACK, scienceCost, techById, techFor } from '../data/techs';
import { machineDef, smeltRecipe, type MachineType } from '../data/machines';
import { isFree, isSupported, pieceKey, type PiecePos } from '../build/pieces';
import { detectRooms, type Room } from '../build/rooms';
import { pieceDef, resolveKind, slotOf, type PieceKind } from '../data/buildings';
import { BAG_LIMITS, itemById, type BagLimits, type EquipSlot } from '../data/items';
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
  type DroppedStack,
  type WorldChanges,
} from './worldChanges';

export type StateEvent =
  | { type: 'harvest'; key: string }
  | { type: 'drops' }
  | { type: 'inventory' }
  | { type: 'build' }
  | { type: 'hotbar' }
  | { type: 'factory' };

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

  /** Prend `count` unités du sac au bout du curseur (la pile tenue est d'abord rangée si c'est un autre objet). */
  takeToHand(item: string, count: number): number {
    if (this.hand && this.hand.item !== item) this.returnHand();
    const n = Math.min(count, this.inventory[item] ?? 0);
    if (n <= 0) return 0;
    this.inventory = remove(this.inventory, item, n).inventory;
    this.hand = { item, count: (this.hand?.count ?? 0) + n };
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

  /** Récolte jusqu'à `units` unités d'une ressource (arbre, rocher, case de minerai). */
  harvest(key: string, total: number, item: string, units = 1): HarvestResult {
    const available = this.remaining(key, total);
    const fits = maxAddable(this.inventory, item, this.limits);
    const gained = Math.max(0, Math.min(units, available, fits));
    if (gained > 0) {
      this.inventory = add(this.inventory, item, gained);
      this.changes.taken[key] = (this.changes.taken[key] ?? 0) + gained;
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
    this.selectedSlot = this.selectedSlot === index || !this.changes.hotbar[index] ? null : index;
    this.emit({ type: 'hotbar' });
  }

  /** Objet de la case sélectionnée. */
  selectedItem(): string | null {
    return this.selectedSlot === null ? null : this.changes.hotbar[this.selectedSlot];
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
  place(
    kind: PieceKind,
    pos: PiecePos,
    rotation = 0,
  ): 'ok' | 'occupied' | 'missing' | 'invalid' | 'unsupported' {
    const def = pieceDef(kind);
    // Une dalle devient un sol ou un plafond selon l'emplacement.
    const placed = resolveKind(kind, pos.slot);
    if (slotOf(pieceDef(placed).type) !== pos.slot) return 'invalid';
    if (!isFree(this.changes.pieces, placed, pos)) return 'occupied';
    if (!isSupported(this.changes.pieces, placed, pos)) return 'unsupported';
    if (!this.canAfford(kind)) return 'missing';
    this.inventory = remove(this.inventory, def.item, 1).inventory;
    this.changes.pieces[pieceKey(pos)] = placed;
    if (rotation % 4 !== 0) this.changes.rotations[pieceKey(pos)] = ((rotation % 4) + 4) % 4;
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /**
   * Pose plusieurs pièces d'un coup ; renvoie combien ont pu l'être (selon le stock, les emplacements
   * libres et le soutien : un bloc peut s'appuyer sur un autre posé juste avant).
   */
  placeMany(kind: PieceKind, positions: PiecePos[], rotation = 0): number {
    let remaining = positions;
    let n = 0;
    for (let progress = true; progress && remaining.length > 0;) {
      progress = false;
      const next: PiecePos[] = [];
      for (const pos of remaining) {
        const r = this.place(kind, pos, rotation);
        if (r === 'ok') {
          n++;
          progress = true;
        } else if (r === 'unsupported') next.push(pos);
      }
      remaining = next;
    }
    return n;
  }

  /**
   * Fabrique à la main jusqu'à `times` unités d'un objet. Ne fabrique que ce que les ressources et la
   * place dans le sac permettent. Renvoie le nombre fabriqué et la raison de l'arrêt éventuel.
   */
  /** Cet objet peut-il être fabriqué (sa technologie est-elle recherchée) ? */
  isUnlocked(item: string): boolean {
    const tech = techFor(item);
    return !tech || this.changes.unlocked.includes(tech.id);
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
      if (maxAddable(after, item, this.limits) < 1) {
        stopped = 'bag';
        break;
      }
      this.inventory = add(after, item, 1);
      made++;
    }
    if (made > 0) {
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
      // Démolir rend la pièce elle-même (l'objet), pas ses ressources de fabrication.
      this.giveBack(pieceDef(kind).item, 1, drop);
    }
    if (n > 0) {
      this.roomCache = null;
      this.emit({ type: 'build' });
      this.emit({ type: 'inventory' });
    }
    return n;
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
  ): 'ok' | 'missing' | 'blocked' {
    const def = machineDef(type);
    if ((this.inventory[def.item] ?? 0) < 1) return 'missing';
    if (!factory.canPlace(type, gx, gz, rot, blocked, lift)) return 'blocked';
    this.inventory = remove(this.inventory, def.item, 1).inventory;
    factory.add(emptyMachine(this.changes.nextMachineId++, type, gx, gz, rot, lift));
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
    if (m.type !== 'assembler') return false;
    if (item !== null && !itemById(item).recipe) return false;
    const at = { x: m.gx * CELL_SIZE_M, z: m.gz * CELL_SIZE_M };
    for (const stack of [...m.slots, m.stock])
      if (stack) this.giveBack(stack.item, stack.count, at);
    m.slots = [];
    m.stock = null;
    m.progress = 0;
    m.recipe = item;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Assembleur : met des ingrédients du sac dans la machine (seulement ceux de la recette). Renvoie la quantité. */
  loadIngredient(m: Machine, item: string, count: number): number {
    const need = m.recipe ? itemById(m.recipe).recipe?.[item] : undefined;
    if (m.type !== 'assembler' || !need) return 0;
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
    this.giveBack(machineDef(m.type).item, 1, at);
    for (const stack of [m.fuel, m.input, m.stock, ...m.slots])
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
    if (slot === 'fuel' && (!machineDef(m.type).fuel || !itemById(item).fuelSeconds)) return 0;
    if (
      slot === 'input' &&
      !(m.type === 'furnace' && smeltRecipe(item)) &&
      !(m.type === 'lab' && item === SCIENCE_PACK)
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
  unloadMachine(m: Machine, slot: 'fuel' | 'input' | 'stock', count = Infinity): number {
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
