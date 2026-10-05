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

/** Cases occupées : chaque objet remplit ceil(quantité / taille de pile) cases. */
export function slotsUsed(inv: Inventory, limits: BagLimits): number {
  let n = 0;
  for (const count of Object.values(inv)) n += Math.ceil(count / limits.stackMax);
  return n;
}

/** Place restante en nombre de cases, pour cet objet (piles entamées + cases libres). */
function slotRoom(inv: Inventory, itemId: string, limits: BagLimits): number {
  const count = inv[itemId] ?? 0;
  const ownSlots = Math.ceil(count / limits.stackMax);
  const free = limits.maxSlots - slotsUsed(inv, limits);
  return ownSlots * limits.stackMax - count + free * limits.stackMax;
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
  piece_wall: 'piece_wall_stone',
  piece_door: 'piece_door_wood',
  piece_floor: 'piece_floor_wood',
  piece_ceiling: 'piece_ceiling_wood',
};

/** Lit un sac enregistré : ignore les objets inconnus et les quantités invalides. */
export function normalizeInventory(raw: unknown): Inventory {
  const result: Inventory = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [rawId, count] of Object.entries(raw as Record<string, unknown>)) {
    const id = LEGACY_ITEMS[rawId] ?? rawId;
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
