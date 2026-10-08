import { normalizePieces, type Pieces } from '../build/pieces';
import { CELL_SIZE_M } from '../constants';
import { footprint, normalizeMachines, type Machine } from '../factory/factory';
import { machineDef } from '../data/machines';
import { itemById, type EquipSlot } from '../data/items';
import { migrateItemId, normalizeInventory, type Inventory } from './inventory';
import type { Enemy } from './threat';
import { resourceById } from '../data/resources';
import { DISCOVERIES } from '../data/discoveries';
import { TECHS, isSciencePack } from '../data/techs';
import { TUTORIAL_STEPS } from './tutorial';
import type { ChunkData } from '../world/worldgen';

/** Un véhicule posé dans le monde : position, cap (rad) et carburant (secondes de marche). */
export interface Vehicle {
  id: number;
  x: number;
  z: number;
  yaw: number;
  fuel: number;
  /** Case de carburant du buggy (charbon, bois…). */
  fuelStack: { item: string; count: number } | null;
  /** Coffre du buggy (carburant et quelques objets) : piles d'au plus 100. */
  slots: { item: string; count: number }[];
}

/** Le corps d'un joueur tombé : il garde tout ce que le joueur portait, à récupérer en interagissant. */
export interface Corpse {
  id: number;
  x: number;
  z: number;
  yaw: number;
  inventory: Inventory;
  equipment: Partial<Record<EquipSlot, string>>;
}

/** Point de réapparition posé par le joueur : un duvet (usage unique) ou un lit (permanent). */
export interface SpawnPoint {
  id: number;
  x: number;
  z: number;
  kind: 'bag' | 'bed';
}

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
  /** Case(s) d'outils à droite de la barre : outil de récolte ou pistolet (utilisé quand l'action le demande). */
  tools: (string | null)[];
  /** Machines et tapis posés (voir `core/factory`). */
  machines: Machine[];
  nextMachineId: number;
  /** Équipement porté : un objet par emplacement du corps. */
  equipment: Partial<Record<EquipSlot, string>>;
  /** Technologies déjà recherchées. */
  unlocked: string[];
  /** Le mode débogage a servi dans cette partie : pas de succès à débloquer. */
  admin: boolean;
  /** Tutoriel : étapes validées, et tutoriel passé par le joueur. */
  tutorialDone: string[];
  tutorialSkipped: boolean;
  /** Quantités récoltées à la main, par objet (compteurs des découvertes). */
  harvested: Record<string, number>;
  /** Quantités fabriquées (machines ou à la main), par objet (compteurs des découvertes). */
  produced: Record<string, number>;
  /** Découvertes faites (voir `content/discoveries.json`). */
  discovered: string[];
  /** Corps laissés là où le joueur est tombé, avec ses affaires (affichés dans le monde et sur la carte). */
  corpses: Corpse[];
  nextCorpseId: number;
  /** Duvets et lits posés : le dernier posé est le point de réapparition (sinon, le point de départ). */
  spawns: SpawnPoint[];
  nextSpawnId: number;
  /** Technologie étudiée par les laboratoires (null = aucune) et paquets de science déjà consommés par technologie. */
  researching: string | null;
  progress: Record<string, number>;
  /** Paquets déjà étudiés par technologie et par type de paquet (la somme est `progress`). */
  packProgress: Record<string, Record<string, number>>;
  /** Pollution par cellule de 32 m (« pcx,pcz »). */
  pollution: Record<string, number>;
  /** Pollution du sol, par cellule de 32 m. */
  groundPollution: Record<string, number>;
  /** Ennemis en vie (enregistrés avec la partie). */
  enemies: Enemy[];
  /** Temps de jeu écoulé (secondes) : fait tourner les saisons. */
  time: number;
  /** Véhicules posés dans le monde. */
  vehicles: Vehicle[];
  /** Balles dans le pistolet. */
  ammo: number;
  /** Unité de `fuelLeft` des machines : 1 = kilojoules (avant : secondes de combustion). */
  energyVersion: number;
  /** Version des emprises des machines (2 = tapis en tuiles de 2 × 2, machines +1 case). */
  footprintVersion: number;
}

export const FOOTPRINT_VERSION = 2;

/** Balles d'un chargeur. */
export const MAGAZINE_ROUNDS = 12;

export const HOTBAR_SLOTS = 9;
/** Cases d'outils (plus tard, un vêtement pourra en ajouter). */
export const TOOL_SLOTS = 1;

export const cellKey = (gx: number, gz: number): string => `${gx},${gz}`;

export function emptyChanges(): WorldChanges {
  return {
    taken: {},
    drops: [],
    nextDropId: 1,
    pieces: {},
    rotations: {},
    hotbar: Array.from({ length: HOTBAR_SLOTS }, () => null),
    tools: Array.from({ length: TOOL_SLOTS }, () => null),
    machines: [],
    nextMachineId: 1,
    equipment: {},
    unlocked: [],
    admin: false,
    tutorialDone: [],
    tutorialSkipped: false,
    harvested: {},
    produced: {},
    discovered: [],
    corpses: [],
    nextCorpseId: 1,
    spawns: [],
    nextSpawnId: 1,
    researching: null,
    progress: {},
    packProgress: {},
    pollution: {},
    groundPollution: {},
    enemies: [],
    time: 0,
    vehicles: [],
    ammo: 0,
    energyVersion: 1,
    footprintVersion: FOOTPRINT_VERSION,
  };
}

/** Applique les changements du joueur à un chunk fraîchement généré. */
/** Points de vie d'un nid : le « taken » du nid compte les dégâts reçus. */
export const NEST_HP = 150;

export function applyChanges(chunk: ChunkData, changes: WorldChanges): ChunkData {
  const hasTaken = Object.keys(changes.taken).length > 0;
  if (!hasTaken) return chunk;
  const objects = chunk.objects.flatMap((o) => {
    if (o.id === 'nest') return (changes.taken[cellKey(o.gx, o.gz)] ?? 0) >= NEST_HP ? [] : [o];
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
  // Anciennes sauvegardes : `fuelLeft` était en secondes de combustion, il est maintenant en kilojoules.
  if (r.energyVersion !== 1)
    for (const m of result.machines) m.fuelLeft *= machineDef(m.type).burnKw ?? 0;
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
  result.admin = r.admin === true;
  result.tutorialSkipped = r.tutorialSkipped === true;
  if (Array.isArray(r.tutorialDone)) {
    result.tutorialDone = r.tutorialDone.filter(
      (x): x is string => typeof x === 'string' && TUTORIAL_STEPS.some((s) => s.id === x),
    );
  }
  for (const counter of ['harvested', 'produced'] as const) {
    const raw = r[counter];
    if (typeof raw !== 'object' || raw === null) continue;
    for (const [item, n] of Object.entries(raw as Record<string, unknown>)) {
      if (isNum(n) && n > 0) result[counter][item] = Math.floor(n);
    }
  }
  result.discovered = Array.isArray(r.discovered)
    ? DISCOVERIES.map((d) => d.id).filter((id) => (r.discovered as unknown[]).includes(id))
    : [];
  const rec = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  for (const raw of Array.isArray(r.corpses) ? r.corpses.slice(0, 50) : []) {
    const o = rec(raw);
    if (!o || !isNum(o.x) || !isNum(o.z)) continue;
    const equipment: Partial<Record<EquipSlot, string>> = {};
    for (const [slot, id] of Object.entries(rec(o.equipment) ?? {})) {
      const item = typeof id === 'string' ? migrateItemId(id) : null;
      if (item && itemById(item).equip?.slot === slot) equipment[slot as EquipSlot] = item;
    }
    result.corpses.push({
      id: isNum(o.id) ? Math.floor(o.id) : result.corpses.length + 1,
      x: o.x,
      z: o.z,
      yaw: isNum(o.yaw) ? o.yaw : 0,
      inventory: normalizeInventory(o.inventory),
      equipment,
    });
  }
  result.nextCorpseId = result.corpses.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  for (const raw of Array.isArray(r.spawns) ? r.spawns.slice(0, 200) : []) {
    const o = rec(raw);
    if (!o || !isNum(o.x) || !isNum(o.z) || (o.kind !== 'bag' && o.kind !== 'bed')) continue;
    result.spawns.push({
      id: isNum(o.id) ? Math.floor(o.id) : result.spawns.length + 1,
      x: o.x,
      z: o.z,
      kind: o.kind,
    });
  }
  result.nextSpawnId = result.spawns.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  result.unlocked = Array.isArray(r.unlocked)
    ? TECHS.map((t) => t.id).filter((id) => (r.unlocked as unknown[]).includes(id))
    : TECHS.map((t) => t.id);
  if (typeof r.progress === 'object' && r.progress !== null) {
    for (const t of TECHS) {
      const v = (r.progress as Record<string, unknown>)[t.id];
      if (isNum(v) && v > 0) result.progress[t.id] = Math.floor(v);
    }
  }
  if (typeof r.packProgress === 'object' && r.packProgress !== null) {
    for (const t of TECHS) {
      const row = (r.packProgress as Record<string, unknown>)[t.id];
      if (typeof row !== 'object' || row === null) continue;
      for (const [pack, v] of Object.entries(row as Record<string, unknown>)) {
        if (isSciencePack(pack) && isNum(v) && v > 0) {
          (result.packProgress[t.id] ??= {})[pack] = Math.floor(v);
        }
      }
    }
  }
  if (isNum(r.time) && r.time > 0) result.time = r.time;
  if (Array.isArray(r.enemies)) {
    const seen = new Set<number>();
    for (const raw of r.enemies.slice(0, 200)) {
      if (typeof raw !== 'object' || raw === null) continue;
      const e = raw as Record<string, unknown>;
      if (!isNum(e.id) || seen.has(e.id) || !isNum(e.x) || !isNum(e.z) || !isNum(e.hp)) continue;
      if (e.hp <= 0) continue;
      seen.add(e.id);
      const home = e.home as Record<string, unknown> | undefined;
      result.enemies.push({
        id: e.id,
        x: e.x,
        z: e.z,
        hp: e.hp,
        cooldown: isNum(e.cooldown) ? Math.max(0, e.cooldown) : 0,
        idle: isNum(e.idle) ? Math.max(0, e.idle) : 0,
        target: typeof e.target === 'string' ? e.target : null,
        ...(e.mutant === true ? { mutant: true } : {}),
        ...(e.kind === 'scout' || e.kind === 'guard' || e.kind === 'spitter'
          ? { kind: e.kind }
          : {}),
        ...(home && isNum(home.x) && isNum(home.z) ? { home: { x: home.x, z: home.z } } : {}),
      });
    }
  }
  if (Array.isArray(r.vehicles)) {
    for (const raw of r.vehicles.slice(0, 50)) {
      if (typeof raw !== 'object' || raw === null) continue;
      const v = raw as Record<string, unknown>;
      if (!isNum(v.id) || !isNum(v.x) || !isNum(v.z)) continue;
      result.vehicles.push({
        id: v.id,
        x: v.x,
        z: v.z,
        yaw: isNum(v.yaw) ? v.yaw : 0,
        fuel: isNum(v.fuel) ? Math.max(0, v.fuel) : 0,
        fuelStack: (() => {
          const f = v.fuelStack as Record<string, unknown> | null | undefined;
          if (!f || typeof f.item !== 'string' || !isNum(f.count) || f.count <= 0) return null;
          try {
            if (!itemById(f.item).energyMJ) return null;
          } catch {
            return null;
          }
          return { item: f.item, count: Math.min(100, Math.floor(f.count)) };
        })(),
        slots: Array.isArray(v.slots)
          ? v.slots.slice(0, 16).flatMap((raw: unknown) => {
              const st = raw as Record<string, unknown> | null;
              if (!st || typeof st.item !== 'string' || !isNum(st.count) || st.count <= 0)
                return [];
              try {
                itemById(st.item);
              } catch {
                return [];
              }
              return [{ item: st.item, count: Math.min(100, Math.floor(st.count)) }];
            })
          : [],
      });
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
  if (Array.isArray(r.tools)) {
    r.tools.slice(0, TOOL_SLOTS).forEach((rawId, i) => {
      if (typeof rawId !== 'string') return;
      try {
        const id = migrateItemId(rawId);
        const def = itemById(id);
        if (def.tool || def.id === 'pistol') result.tools[i] = id;
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
