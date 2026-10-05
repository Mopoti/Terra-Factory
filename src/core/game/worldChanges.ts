import { resourceById } from '../data/resources';
import type { ChunkData } from '../world/worldgen';

/** Objets déposés au sol par le joueur. */
export interface DroppedStack {
  id: string;
  item: string;
  count: number;
  x: number;
  z: number;
}

/**
 * Ce que le joueur a changé dans le monde d'origine (qui, lui, se recalcule depuis la seed).
 * Seules les différences sont enregistrées : une sauvegarde reste petite.
 */
export interface WorldChanges {
  /** Quantité déjà prélevée, par case d'ancrage « gx,gz » (arbre, rocher ou case de minerai). */
  taken: Record<string, number>;
  drops: DroppedStack[];
  nextDropId: number;
}

export const cellKey = (gx: number, gz: number): string => `${gx},${gz}`;

export function emptyChanges(): WorldChanges {
  return { taken: {}, drops: [], nextDropId: 1 };
}

/** Applique les changements du joueur à un chunk fraîchement généré. */
export function applyChanges(chunk: ChunkData, changes: WorldChanges): ChunkData {
  const hasTaken = Object.keys(changes.taken).length > 0;
  if (!hasTaken) return chunk;
  const objects = chunk.objects.flatMap((o) => {
    if (o.id === 'nest') return [o];
    const taken = changes.taken[cellKey(o.gx, o.gz)] ?? 0;
    const left = resourceById(o.id).kind === 'object' ? o.amount - taken : o.amount;
    return left > 0 ? [{ ...o, amount: left }] : [];
  });
  const ore = chunk.ore.flatMap((o) => {
    const left = o.amount - (changes.taken[cellKey(o.gx, o.gz)] ?? 0);
    return left > 0 ? [{ ...o, amount: left }] : [];
  });
  return { ...chunk, objects, ore };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Lit des changements enregistrés (ignore ce qui est inutilisable). */
export function normalizeChanges(raw: unknown): WorldChanges {
  const result = emptyChanges();
  if (typeof raw !== 'object' || raw === null) return result;
  const r = raw as Record<string, unknown>;
  if (typeof r.taken === 'object' && r.taken !== null) {
    for (const [key, v] of Object.entries(r.taken as Record<string, unknown>)) {
      if (/^-?\d+,-?\d+$/.test(key) && isNum(v) && v > 0) result.taken[key] = v;
    }
  }
  if (Array.isArray(r.drops)) {
    for (const d of r.drops) {
      if (typeof d !== 'object' || d === null) continue;
      const s = d as Record<string, unknown>;
      if (
        typeof s.id === 'string' &&
        typeof s.item === 'string' &&
        isNum(s.count) &&
        s.count > 0 &&
        isNum(s.x) &&
        isNum(s.z)
      ) {
        result.drops.push({ id: s.id, item: s.item, count: Math.floor(s.count), x: s.x, z: s.z });
      }
    }
  }
  const maxId = result.drops.reduce((m, d) => Math.max(m, Number(d.id.replace(/\D/g, '')) || 0), 0);
  result.nextDropId = Math.max(isNum(r.nextDropId) ? Math.floor(r.nextDropId) : 1, maxId + 1);
  return result;
}
