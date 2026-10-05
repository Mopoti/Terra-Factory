import { isFree, isSupported, pieceKey, type PiecePos } from '../build/pieces';
import { detectRooms, type Room } from '../build/rooms';
import { pieceDef, slotOf, type PieceKind } from '../data/buildings';
import { BAG_LIMITS, itemById, type BagLimits } from '../data/items';
import { add, maxAddable, normalizeInventory, remove, type Inventory } from './inventory';
import {
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
  | { type: 'hotbar' };

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
  private roomCache: Room[] | null = null;
  private readonly listeners = new Set<(e: StateEvent) => void>();

  constructor(
    saved?: { inventory?: unknown; changes?: unknown },
    readonly limits: BagLimits = BAG_LIMITS,
  ) {
    this.inventory = normalizeInventory(saved?.inventory);
    this.changes = saved ? normalizeChanges(saved.changes) : emptyChanges();
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
    return { inventory: structuredClone(this.inventory), changes: structuredClone(this.changes) };
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
    }
    return { gained, left: stack.count, bagFull: stack.count > 0 };
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
    if (slotOf(def.type) !== pos.slot) return 'invalid';
    if (!isFree(this.changes.pieces, kind, pos)) return 'occupied';
    if (!isSupported(this.changes.pieces, kind, pos)) return 'unsupported';
    if (!this.canAfford(kind)) return 'missing';
    this.inventory = remove(this.inventory, def.item, 1).inventory;
    this.changes.pieces[pieceKey(pos)] = kind;
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
  craft(item: string, times: number): { made: number; stopped: 'resources' | 'bag' | null } {
    const recipe = itemById(item).recipe;
    if (!recipe) return { made: 0, stopped: 'resources' };
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
   * Démolit des pièces et rend leurs ressources de fabrication (ce qui ne tient pas dans le sac tombe au sol
   * aux coordonnées données). Renvoie le nombre de pièces démontées.
   */
  removeKeys(keys: string[], drop: { x: number; z: number }): number {
    let n = 0;
    for (const key of keys) {
      const kind = this.changes.pieces[key];
      if (!kind) continue;
      delete this.changes.pieces[key];
      delete this.changes.rotations[key];
      n++;
      // Démolir rend les ressources de fabrication (pierre, bois), pas la pièce elle-même.
      const recipe = itemById(pieceDef(kind).item).recipe ?? { [pieceDef(kind).item]: 1 };
      for (const [item, count] of Object.entries(recipe)) {
        const fits = Math.min(count, maxAddable(this.inventory, item, this.limits));
        if (fits > 0) this.inventory = add(this.inventory, item, fits);
        if (count - fits > 0) {
          this.changes.drops.push({
            id: `drop-${this.changes.nextDropId++}`,
            item,
            count: count - fits,
            x: drop.x,
            z: drop.z,
          });
          this.emit({ type: 'drops' });
        }
      }
    }
    if (n > 0) {
      this.roomCache = null;
      this.emit({ type: 'build' });
      this.emit({ type: 'inventory' });
    }
    return n;
  }
}
