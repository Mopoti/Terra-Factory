import { CELL_SIZE_M } from '../constants';
import { itemById } from '../data/items';
import { CARS, isCarKind, isLiquid } from '../data/trains';
import { RAIL_KINDS, TILE_M, cornerFor, lengthOf, type RailKind, type RailPiece } from './track';
import { normalizeProgram, type Program } from './program';
import type { Car, Consist } from './train';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Limites de ce qui est enregistré (une sauvegarde abîmée ne doit pas faire exploser le jeu). */
/** 2 : voie agrandie à l'échelle des trains (écartement de 1,5 m). */
export const RAIL_VERSION = 2;
export const MAX_RAILS = 4000;
export const MAX_CONSISTS = 200;
export const SOUTE_MAX = 50;

/** Les tuiles de 2,5 m que fait la voie directe d'un ancien aiguillage (3 × 3 tuiles), dans l'ordre du port 0 au port 1. */
function legacySwitchTiles(gx: number, gz: number, turns: number): { gx: number; gz: number }[] {
  const side = 3 * TILE_M;
  // Centre du bloc (carré : les quarts de tour ne le déplacent pas), en mètres.
  const cx = gx * CELL_SIZE_M + side / 2;
  const cz = gz * CELL_SIZE_M + side / 2;
  return [TILE_M, 0, -TILE_M].map((z) => {
    // La voie directe suit l'axe z local ; on le tourne de `turns` quarts de tour (même convention que le rendu).
    const [rx, rz] = [
      (x: number, y: number) => [x, y],
      (x: number, y: number) => [y, -x],
      (x: number, y: number) => [-x, -y],
      (x: number, y: number) => [-y, x],
    ][turns](0, z);
    return cornerFor('straight', turns, cx + rx, cz + rz);
  });
}

/**
 * Relit les pièces de voie enregistrées ; ignore ce qui est invalide ou en double. Les anciens aiguillages (supprimés :
 * un embranchement est maintenant un virage tangent) deviennent trois tuiles droites, sur leur voie directe.
 */
export function normalizeRails(raw: unknown): RailPiece[] {
  if (!Array.isArray(raw)) return [];
  const out: RailPiece[] = [];
  const ids = new Set<number>();
  let nextId =
    1 + raw.reduce((m: number, r) => (isRec(r) && isNum(r.id) ? Math.max(m, r.id) : m), 0);
  for (const r of raw.slice(0, MAX_RAILS)) {
    if (!isRec(r) || !isNum(r.id) || ids.has(r.id)) continue;
    if (!isNum(r.gx) || !isNum(r.gz)) continue;
    if (r.id < 1) continue; // les identifiants négatifs désignaient les voies déviées des aiguillages
    if (r.kind === 'switch_r' || r.kind === 'switch_l') {
      const turns = isNum(r.turns) ? ((Math.floor(r.turns) % 4) + 4) % 4 : 0;
      const level = isNum(r.level)
        ? Math.max(-40, Math.min(40, Math.round(r.level * 100) / 100))
        : 0;
      ids.add(r.id);
      legacySwitchTiles(Math.floor(r.gx), Math.floor(r.gz), turns).forEach((c, i) =>
        out.push({
          id: i === 0 ? Math.floor(r.id as number) : nextId++,
          kind: 'straight',
          ...c,
          turns,
          level,
        }),
      );
      continue;
    }
    if (!RAIL_KINDS.includes(r.kind as RailKind)) continue;
    ids.add(r.id);
    const piece: RailPiece = {
      id: Math.floor(r.id),
      kind: r.kind as RailKind,
      gx: Math.floor(r.gx),
      gz: Math.floor(r.gz),
      turns: isNum(r.turns) ? ((Math.floor(r.turns) % 4) + 4) % 4 : 0,
      level: isNum(r.level) ? Math.max(-40, Math.min(40, Math.round(r.level * 100) / 100)) : 0,
    };
    out.push(piece);
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
  const spec = CARS[raw.kind];
  const car: Car = {
    id: Math.floor(raw.id),
    kind: raw.kind,
    rev: raw.rev === true,
    heatKJ: isNum(raw.heatKJ) ? Math.max(0, raw.heatKJ) : 0,
    fuel: spec.loco ? stack : null,
  };
  if (spec.cargo && Array.isArray(raw.cargo)) {
    // Les piles valides, tant que la charge utile et le volume du wagon le permettent.
    const cargo: NonNullable<Car['cargo']> = [];
    let kg = 0;
    let litres = 0;
    for (const s of raw.cargo.slice(0, 32)) {
      if (!isRec(s) || typeof s.item !== 'string' || !isNum(s.count) || s.count < 1) continue;
      let def;
      try {
        def = itemById(s.item);
      } catch {
        continue;
      }
      const n = Math.min(
        Math.floor(s.count),
        Math.floor((spec.cargo.maxKg - kg) / (def.weightG / 1000)),
        Math.floor((spec.cargo.maxL - litres) / (def.volumeMl / 1000)),
      );
      if (n < 1) continue;
      cargo.push({ item: s.item, count: n });
      kg += (def.weightG / 1000) * n;
      litres += (def.volumeMl / 1000) * n;
    }
    if (cargo.length > 0) car.cargo = cargo;
  }
  if (spec.tankL && isRec(raw.liquid) && isLiquid(raw.liquid.kind) && isNum(raw.liquid.liters)) {
    const liters = Math.max(0, Math.min(spec.tankL, raw.liquid.liters));
    if (liters > 0) car.liquid = { kind: raw.liquid.kind, liters };
  }
  return car;
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
    // Un convoi sur la voie déviée d'un ancien aiguillage (identifiant négatif) n'a plus de voie : il disparaît.
    const piece =
      isNum(head.piece) && head.piece > 0 ? rails.find((p) => p.id === head.piece) : undefined;
    if (!piece || !isNum(head.u)) continue;
    const cars = r.cars
      .slice(0, 40)
      .map((c) => normalizeCar(c, carIds))
      .filter((c): c is Car => c !== null);
    if (cars.length === 0) continue;
    ids.add(r.id);
    out.push({
      ...(isNum(r.goTo) && r.goTo >= 1 ? { goTo: Math.floor(r.goTo) } : {}),
      ...(normalizeProgram(r.program) ? { program: normalizeProgram(r.program) as Program } : {}),
      ...(Array.isArray(r.trail)
        ? {
            trail: r.trail
              .filter(isNum)
              .slice(-80)
              .map((n) => Math.floor(n)),
          }
        : {}),
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
