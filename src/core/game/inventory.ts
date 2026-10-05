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

/** Combien d'unités de cet objet le sac peut encore recevoir (limité par le poids ET le volume). */
export function maxAddable(inv: Inventory, itemId: string, limits: BagLimits): number {
  const item = itemById(itemId);
  const used = totals(inv);
  const byWeight = Math.floor((limits.maxWeightG - used.weightG) / item.weightG);
  const byVolume = Math.floor((limits.maxVolumeMl - used.volumeMl) / item.volumeMl);
  return Math.max(0, Math.min(byWeight, byVolume));
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

/** Lit un sac enregistré : ignore les objets inconnus et les quantités invalides. */
export function normalizeInventory(raw: unknown): Inventory {
  const result: Inventory = {};
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [id, count] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
    try {
      itemById(id);
    } catch {
      continue;
    }
    result[id] = Math.floor(count);
  }
  return result;
}
