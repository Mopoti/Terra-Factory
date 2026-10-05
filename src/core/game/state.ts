import { isFree, pieceKey, type PiecePos } from '../build/pieces';
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
  { type: 'harvest'; key: string } | { type: 'drops' } | { type: 'inventory' } | { type: 'build' };

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
  place(kind: PieceKind, pos: PiecePos): 'ok' | 'occupied' | 'missing' | 'invalid' {
    const def = pieceDef(kind);
    if (slotOf(def.type) !== pos.slot) return 'invalid';
    if (!isFree(this.changes.pieces, kind, pos)) return 'occupied';
    if (!this.canAfford(kind)) return 'missing';
    this.inventory = remove(this.inventory, def.item, 1).inventory;
    this.changes.pieces[pieceKey(pos)] = kind;
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Pose plusieurs pièces d'un coup ; renvoie combien ont pu l'être (selon le stock et les emplacements libres). */
  placeMany(kind: PieceKind, positions: PiecePos[]): number {
    let n = 0;
    for (const pos of positions) if (this.place(kind, pos) === 'ok') n++;
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
    if (made > 0) this.emit({ type: 'inventory' });
    return { made, stopped };
  }

  /**
   * Démonte des pièces et rend les objets (s'ils ne tiennent pas dans le sac, ils tombent au sol aux
   * coordonnées données). Renvoie le nombre de pièces démontées.
   */
  removeKeys(keys: string[], drop: { x: number; z: number }): number {
    let n = 0;
    for (const key of keys) {
      const kind = this.changes.pieces[key];
      if (!kind) continue;
      delete this.changes.pieces[key];
      n++;
      const item = pieceDef(kind).item;
      if (maxAddable(this.inventory, item, this.limits) >= 1) {
        this.inventory = add(this.inventory, item, 1);
      } else {
        this.changes.drops.push({
          id: `drop-${this.changes.nextDropId++}`,
          item,
          count: 1,
          x: drop.x,
          z: drop.z,
        });
        this.emit({ type: 'drops' });
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
