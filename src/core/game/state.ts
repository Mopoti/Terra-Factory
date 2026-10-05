import { pieceKey, type PiecePos } from '../build/pieces';
import { detectRooms, type Room } from '../build/rooms';
import { pieceDef, type PieceKind } from '../data/buildings';
import { BAG_LIMITS, type BagLimits } from '../data/items';
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

  /** Le sac contient-il de quoi fabriquer cette pièce ? */
  canAfford(kind: PieceKind): boolean {
    return Object.entries(pieceDef(kind).cost).every(
      ([item, n]) => (this.inventory[item] ?? 0) >= n,
    );
  }

  /** Pose une pièce (consomme les matériaux). Refuse si l'emplacement est pris ou si le sac est trop pauvre. */
  place(kind: PieceKind, pos: PiecePos): 'ok' | 'occupied' | 'missing' | 'invalid' {
    const def = pieceDef(kind);
    if (def.slot !== pos.slot) return 'invalid';
    const key = pieceKey(pos);
    if (this.changes.pieces[key]) return 'occupied';
    if (!this.canAfford(kind)) return 'missing';
    for (const [item, n] of Object.entries(def.cost)) {
      this.inventory = remove(this.inventory, item, n).inventory;
    }
    this.changes.pieces[key] = kind;
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /**
   * Démonte une pièce et rend les matériaux (ce qui ne tient pas dans le sac reste perdu : le sac est
   * rempli au maximum, le reste tombe au sol aux coordonnées données).
   */
  removePiece(pos: PiecePos, drop: { x: number; z: number }): PieceKind | null {
    const key = pieceKey(pos);
    const kind = this.changes.pieces[key];
    if (!kind) return null;
    delete this.changes.pieces[key];
    this.roomCache = null;
    for (const [item, n] of Object.entries(pieceDef(kind).cost)) {
      const fits = Math.min(n, maxAddable(this.inventory, item, this.limits));
      if (fits > 0) this.inventory = add(this.inventory, item, fits);
      if (n - fits > 0) {
        this.changes.drops.push({
          id: `drop-${this.changes.nextDropId++}`,
          item,
          count: n - fits,
          x: drop.x,
          z: drop.z,
        });
        this.emit({ type: 'drops' });
      }
    }
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return kind;
  }
}
