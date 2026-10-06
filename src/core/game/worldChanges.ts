import { normalizePieces, type Pieces } from '../build/pieces';
import { CELL_SIZE_M } from '../constants';
import { footprint, normalizeMachines, type Machine } from '../factory/factory';
import { machineDef } from '../data/machines';
import { itemById, type EquipSlot } from '../data/items';
import { migrateItemId } from './inventory';
import { resourceById } from '../data/resources';
import { TECHS } from '../data/techs';
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
  /** Pièces de construction posées (voir `core/build/pieces.ts`). */
  pieces: Pieces;
  /** Orientation des pièces posées, en quarts de tour (1 à 3 ; 0 = non enregistré), pour les futurs habillages. */
  rotations: Record<string, number>;
  /** Barre de raccourcis du joueur (rangée avec le reste de la partie) : objet par case, ou null. */
  hotbar: (string | null)[];
  /** Machines et tapis posés (voir `core/factory`). */
  machines: Machine[];
  nextMachineId: number;
  /** Équipement porté : un objet par emplacement du corps. */
  equipment: Partial<Record<EquipSlot, string>>;
  /** Technologies déjà recherchées. */
  unlocked: string[];
  /** Technologie étudiée par les laboratoires (null = aucune) et paquets de science déjà consommés par technologie. */
  researching: string | null;
  progress: Record<string, number>;
  /** Pollution par cellule de 32 m (« pcx,pcz »). */
  pollution: Record<string, number>;
  /** Pollution du sol, par cellule de 32 m. */
  groundPollution: Record<string, number>;
  /** Balles dans le pistolet. */
  ammo: number;
  /** Version des emprises des machines (2 = tapis en tuiles de 2 × 2, machines +1 case). */
  footprintVersion: number;
}

export const FOOTPRINT_VERSION = 2;

/** Balles d'un chargeur. */
export const MAGAZINE_ROUNDS = 12;

export const HOTBAR_SLOTS = 9;

export const cellKey = (gx: number, gz: number): string => `${gx},${gz}`;

export function emptyChanges(): WorldChanges {
  return {
    taken: {},
    drops: [],
    nextDropId: 1,
    pieces: {},
    rotations: {},
    hotbar: Array.from({ length: HOTBAR_SLOTS }, () => null),
    machines: [],
    nextMachineId: 1,
    equipment: {},
    unlocked: [],
    researching: null,
    progress: {},
    pollution: {},
    groundPollution: {},
    ammo: 0,
    footprintVersion: FOOTPRINT_VERSION,
  };
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
  result.pieces = normalizePieces(r.pieces);
  result.machines = normalizeMachines(r.machines);
  const maxMachine = result.machines.reduce((m, x) => Math.max(m, x.id), 0);
  result.nextMachineId = Math.max(
    isNum(r.nextMachineId) ? Math.floor(r.nextMachineId) : 1,
    maxMachine + 1,
  );
  if (typeof r.rotations === 'object' && r.rotations !== null) {
    for (const [key, v] of Object.entries(r.rotations as Record<string, unknown>)) {
      if (result.pieces[key] && isNum(v) && v >= 1 && v <= 3) result.rotations[key] = Math.floor(v);
    }
  }
  if (typeof r.equipment === 'object' && r.equipment !== null) {
    for (const [slot, id] of Object.entries(r.equipment as Record<string, unknown>)) {
      if (typeof id !== 'string') continue;
      try {
        if (itemById(id).equip?.slot === slot) result.equipment[slot as EquipSlot] = id;
      } catch {
        /* objet inconnu */
      }
    }
  }
  // Une ancienne sauvegarde (sans recherche) garde tout ce qu'elle avait : tout est débloqué.
  result.unlocked = Array.isArray(r.unlocked)
    ? TECHS.map((t) => t.id).filter((id) => (r.unlocked as unknown[]).includes(id))
    : TECHS.map((t) => t.id);
  if (typeof r.progress === 'object' && r.progress !== null) {
    for (const t of TECHS) {
      const v = (r.progress as Record<string, unknown>)[t.id];
      if (isNum(v) && v > 0) result.progress[t.id] = Math.floor(v);
    }
  }
  if (isNum(r.ammo)) result.ammo = Math.max(0, Math.min(MAGAZINE_ROUNDS, Math.floor(r.ammo)));
  if (typeof r.groundPollution === 'object' && r.groundPollution !== null) {
    for (const [k, v] of Object.entries(r.groundPollution as Record<string, unknown>)) {
      if (/^-?\d+,-?\d+$/.test(k) && isNum(v) && v > 0) result.groundPollution[k] = v;
    }
  }
  if (typeof r.pollution === 'object' && r.pollution !== null) {
    for (const [k, v] of Object.entries(r.pollution as Record<string, unknown>)) {
      if (/^-?\d+,-?\d+$/.test(k) && isNum(v) && v > 0) result.pollution[k] = v;
    }
  }
  if (typeof r.researching === 'string' && TECHS.some((t) => t.id === r.researching)) {
    if (!result.unlocked.includes(r.researching)) result.researching = r.researching;
  }
  if (Array.isArray(r.hotbar)) {
    r.hotbar.slice(0, HOTBAR_SLOTS).forEach((rawId, i) => {
      if (typeof rawId !== 'string') return;
      const id = migrateItemId(rawId);
      try {
        itemById(id);
        result.hotbar[i] = result.hotbar.includes(id) ? null : id;
      } catch {
        /* objet inconnu : case vide */
      }
    });
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
  if (r.footprintVersion !== FOOTPRINT_VERSION && result.machines.length > 0)
    migrateFootprints(result);
  return result;
}

/**
 * Anciennes parties (machines de l'ancienne taille) : les tapis se recalent sur la grille de tuiles de 2 × 2 cases
 * et les machines gardent leur coin ; celles qui se chevauchent maintenant sont retirées et posées au sol (on
 * peut les ramasser).
 */
function migrateFootprints(changes: WorldChanges): void {
  const taken = new Set<string>();
  const kept: Machine[] = [];
  for (const m of [...changes.machines].sort((a, b) => a.id - b.id)) {
    if (m.type === 'conveyor') {
      m.gx = Math.floor(m.gx / 2) * 2;
      m.gz = Math.floor(m.gz / 2) * 2;
    }
    const cells = footprint(m.type, m.gx, m.gz, m.rot).map((c) => `${c.gx},${c.gz}`);
    if (cells.some((c) => taken.has(c))) {
      changes.drops.push({
        id: `drop-${changes.nextDropId++}`,
        item: machineDef(m.type).item,
        count: 1,
        x: (m.gx + 0.5) * CELL_SIZE_M,
        z: (m.gz + 0.5) * CELL_SIZE_M,
      });
      continue;
    }
    for (const c of cells) taken.add(c);
    kept.push(m);
  }
  changes.machines = kept;
}
