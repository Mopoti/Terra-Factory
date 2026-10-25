import { itemById, type BagLimits } from '../data/items';

/** Contenu du sac : identifiant d'objet -> quantité. */
export type Inventory = Record<string, number>;

export function totals(inv: Inventory): { weightG: number; volumeMl: number } {
  let weightG = 0;
  let volumeMl = 0;
  for (const [id, count] of Object.entries(inv)) {
    const item = itemById(id);
    weightG += item.weightG * count;
    volumeMl += item.volumeMl * count;
  }
  return { weightG, volumeMl };
}

/** Taille d'une pile de cet objet dans le sac (jamais plus que la limite générale du sac). */
export const stackOf = (itemId: string, limits: BagLimits): number =>
  Math.max(1, Math.min(limits.stackMax, itemById(itemId).stack));

/** Cases occupées : chaque objet remplit ceil(quantité / taille de pile) cases. */
export function slotsUsed(inv: Inventory, limits: BagLimits): number {
  let n = 0;
  for (const [id, count] of Object.entries(inv)) n += Math.ceil(count / stackOf(id, limits));
  return n;
}

/** Place restante en nombre de cases, pour cet objet (piles entamées + cases libres). */
function slotRoom(inv: Inventory, itemId: string, limits: BagLimits): number {
  const count = inv[itemId] ?? 0;
  const max = stackOf(itemId, limits);
  const ownSlots = Math.ceil(count / max);
  const free = limits.maxSlots - slotsUsed(inv, limits);
  return ownSlots * max - count + free * max;
}

/** Combien d'unités de cet objet le sac peut encore recevoir (limité par le poids ET le volume). */
export function maxAddable(inv: Inventory, itemId: string, limits: BagLimits): number {
  const item = itemById(itemId);
  const used = totals(inv);
  const byWeight = Math.floor((limits.maxWeightG - used.weightG) / item.weightG);
  const byVolume = Math.floor((limits.maxVolumeMl - used.volumeMl) / item.volumeMl);
  return Math.max(0, Math.min(byWeight, byVolume, slotRoom(inv, itemId, limits)));
}

export function add(inv: Inventory, itemId: string, count: number): Inventory {
  if (count <= 0) return inv;
  return { ...inv, [itemId]: (inv[itemId] ?? 0) + count };
}

/** Retire jusqu'à `count` unités ; renvoie le nouveau sac et le nombre réellement retiré. */
export function remove(
  inv: Inventory,
  itemId: string,
  count: number,
): { inventory: Inventory; removed: number } {
  const have = inv[itemId] ?? 0;
  const removed = Math.max(0, Math.min(have, count));
  if (removed === 0) return { inventory: inv, removed: 0 };
  const next = { ...inv };
  if (have - removed > 0) next[itemId] = have - removed;
  else delete next[itemId];
  return { inventory: next, removed };
}

/** Anciens objets de construction (avant les matériaux), convertis à la lecture. */
const LEGACY_ITEMS: Record<string, string> = {
  tool_wood: 'tool_stone',
  piece_wall: 'piece_wall_stone',
  piece_door: 'piece_door_wood',
  piece_floor: 'piece_slab_wood',
  piece_ceiling: 'piece_slab_wood',
  // Sols et plafonds sont devenus un seul objet : la dalle.
  piece_floor_wood: 'piece_slab_wood',
  piece_floor_stone: 'piece_slab_stone',
  piece_ceiling_wood: 'piece_slab_wood',
  piece_ceiling_stone: 'piece_slab_stone',
};

/** Identifiant actuel d'un objet enregistré avec un ancien nom. */
export const migrateItemId = (id: string): string => LEGACY_ITEMS[id] ?? id;

/** Lit un sac enregistré : ignore les objets inconnus et les quantités invalides. */
export function normalizeInventory(raw: unknown): Inventory {
  const result: Inventory = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [rawId, count] of Object.entries(raw as Record<string, unknown>)) {
    const id = migrateItemId(rawId);
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
    try {
      itemById(id);
    } catch {
      continue;
    }
    result[id] = (result[id] ?? 0) + Math.floor(count);
  }
  return result;
}

/**
 * Nombre de cases du sac à dessiner : toutes en survie, mais en mode Créatif (sac énorme) seulement de quoi contenir
 * les piles (dernière case utilisée comprise) plus une dizaine de cases libres, par rangées de 5, 30 au moins. Le
 * nombre dépend du nombre de piles et non de leur position : descendre une pile dans la grille ne l'agrandit pas.
 */
export function cellsToShow(slots: readonly (unknown | null)[], max: number): number {
  if (max <= 40) return max;
  let last = -1;
  let used = 0;
  slots.forEach((s, i) => {
    if (!s) return;
    last = i;
    used++;
  });
  const rows = (n: number): number => Math.ceil(n / 5) * 5;
  return Math.min(max, Math.max(30, rows(used + 10), rows(last + 1)));
}
