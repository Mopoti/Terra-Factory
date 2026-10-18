import { itemById } from '../data/items';
import { CARS, isCarKind } from '../data/trains';
import { RAIL_KINDS, lengthOf, type RailKind, type RailPiece } from './track';
import type { Car, Consist } from './train';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Limites de ce qui est enregistré (une sauvegarde abîmée ne doit pas faire exploser le jeu). */
/** 2 : voie agrandie à l'échelle des trains (écartement de 1,5 m). */
export const RAIL_VERSION = 2;
export const MAX_RAILS = 4000;
export const MAX_CONSISTS = 200;
export const SOUTE_MAX = 50;

/** Relit les pièces de voie enregistrées ; ignore ce qui est invalide ou en double. */
export function normalizeRails(raw: unknown): RailPiece[] {
  if (!Array.isArray(raw)) return [];
  const out: RailPiece[] = [];
  const ids = new Set<number>();
  for (const r of raw.slice(0, MAX_RAILS)) {
    if (!isRec(r) || !isNum(r.id) || ids.has(r.id)) continue;
    if (!isNum(r.gx) || !isNum(r.gz) || !RAIL_KINDS.includes(r.kind as RailKind)) continue;
    ids.add(r.id);
    out.push({
      id: Math.floor(r.id),
      kind: r.kind as RailKind,
      gx: Math.floor(r.gx),
      gz: Math.floor(r.gz),
      turns: isNum(r.turns) ? ((Math.floor(r.turns) % 4) + 4) % 4 : 0,
      level: isNum(r.level) ? Math.max(-40, Math.min(40, Math.round(r.level * 100) / 100)) : 0,
    });
  }
  return out;
}

function normalizeCar(raw: unknown, used: Set<number>): Car | null {
  if (!isRec(raw) || !isNum(raw.id) || used.has(raw.id) || !isCarKind(raw.kind)) return null;
  const fuel = raw.fuel;
  let stack: Car['fuel'] = null;
  if (isRec(fuel) && typeof fuel.item === 'string' && isNum(fuel.count) && fuel.count > 0) {
    try {
      if (itemById(fuel.item).energyMJ)
        stack = { item: fuel.item, count: Math.min(SOUTE_MAX, Math.floor(fuel.count)) };
    } catch {
      stack = null;
    }
  }
  used.add(raw.id);
  return {
    id: Math.floor(raw.id),
    kind: raw.kind,
    rev: raw.rev === true,
    heatKJ: isNum(raw.heatKJ) ? Math.max(0, raw.heatKJ) : 0,
    fuel: CARS[raw.kind].loco ? stack : null,
  };
}

/** Relit les convois enregistrés ; un convoi sans véhicule valide disparaît. */
export function normalizeTrains(raw: unknown, rails: readonly RailPiece[]): Consist[] {
  if (!Array.isArray(raw)) return [];
  const out: Consist[] = [];
  const ids = new Set<number>();
  const carIds = new Set<number>();
  for (const r of raw.slice(0, MAX_CONSISTS)) {
    if (!isRec(r) || !isNum(r.id) || ids.has(r.id) || !isRec(r.head) || !Array.isArray(r.cars))
      continue;
    const head = r.head as Record<string, unknown>;
    const piece = rails.find((p) => p.id === head.piece);
    if (!piece || !isNum(head.u)) continue;
    const cars = r.cars
      .slice(0, 40)
      .map((c) => normalizeCar(c, carIds))
      .filter((c): c is Car => c !== null);
    if (cars.length === 0) continue;
    ids.add(r.id);
    out.push({
      id: Math.floor(r.id),
      head: {
        piece: piece.id,
        u: Math.max(0, Math.min(lengthOf(piece.kind), head.u)),
        dir: head.dir === -1 ? -1 : 1,
      },
      v: isNum(r.v) ? Math.max(-30, Math.min(30, r.v)) : 0,
      cars,
    });
  }
  return out;
}
