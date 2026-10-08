import { machineDef, type MachineType } from '../data/machines';
import type { Cell, Machine } from './factory';

export type FluidKind = 'water' | 'steam' | 'hot';
export const FLUID_KINDS: FluidKind[] = ['water', 'steam', 'hot'];
/** Machines qui poussent un fluide (donc qui donnent une pression de départ) : le fluide qu'elles émettent. */
export const SOURCE_KIND: Partial<Record<MachineType, FluidKind>> = {
  pump: 'water',
  boiler: 'steam',
  builder: 'hot',
  furnace_electric: 'hot',
  cooling_tower: 'water',
};

/** Une prise de fluide sur un côté d'une machine : sens `in` (reçoit), `out` (émet) ou `both` (tuyau). */
export interface FluidPort {
  /** Côté de la machine (0 = +z, 1 = +x, 2 = −z, 3 = −x). */
  side: number;
  mode: 'in' | 'out' | 'both';
  /** Fluide admis / émis (un tuyau accepte les deux, un à la fois). */
  /** `liquid` : eau ou eau chaude (jamais de vapeur). */
  fluid: FluidKind | 'any' | 'liquid';
}

/** Débit : part de l'écart de niveau (0 à 1) qui passe par seconde, multipliée par la plus petite capacité. */
const FLOW_RATE = 20;

export function emptyFluid(): Record<FluidKind, number> {
  return { water: 0, steam: 0, hot: 0 };
}

/** Prises de fluide d'une machine posée avec l'orientation `rot`. */
export function fluidPorts(type: MachineType, rot: number, lift = 0): FluidPort[] {
  const back = (rot + 2) % 4;
  switch (type) {
    case 'pipe':
      // Tuyau enterré : l'entrée se raccorde derrière, la sortie devant (le reste passe sous terre).
      if (lift === 4) return [{ side: back, mode: 'both', fluid: 'any' }];
      if (lift === 5) return [{ side: rot % 4, mode: 'both', fluid: 'any' }];
      return [0, 1, 2, 3].map((side) => ({ side, mode: 'both' as const, fluid: 'any' as const }));
    case 'pump':
      return [{ side: rot % 4, mode: 'out', fluid: 'water' }];
    case 'boiler':
      // Eau par un côté et qui ressort de l'autre (chaudières en série) ; vapeur devant, combustible derrière.
      return [
        { side: (rot + 1) % 4, mode: 'both', fluid: 'liquid' },
        { side: (rot + 3) % 4, mode: 'both', fluid: 'liquid' },
        { side: rot % 4, mode: 'out', fluid: 'steam' },
      ];
    case 'furnace_electric':
    case 'builder':
      // Refroidissement : eau froide par un côté, eau chaude rejetée par l'autre.
      return [
        { side: (rot + 1) % 4, mode: 'in', fluid: 'water' },
        { side: (rot + 3) % 4, mode: 'out', fluid: 'hot' },
      ];
    case 'cooling_tower':
      return [
        { side: back, mode: 'in', fluid: 'hot' },
        { side: rot % 4, mode: 'out', fluid: 'water' },
      ];
    case 'booster':
      // Surpresseur en ligne : le fluide entre derrière, ressort devant avec plus de pression.
      return [
        { side: back, mode: 'in', fluid: 'any' },
        { side: rot % 4, mode: 'out', fluid: 'any' },
      ];
    case 'washer':
    case 'barreler':
      // Remplisseuse / videuse de barils : l'eau entre ou sort par les côtés (objets : entrée derrière, sortie devant).
      return [
        { side: (rot + 1) % 4, mode: 'both', fluid: 'water' },
        { side: (rot + 3) % 4, mode: 'both', fluid: 'water' },
      ];
    case 'turbine':
      return [
        { side: back, mode: 'in', fluid: 'steam' },
        { side: rot % 4, mode: 'out', fluid: 'steam' },
      ];
    default:
      return [];
  }
}

export interface FluidLink {
  a: Machine;
  pa: FluidPort;
  b: Machine;
  pb: FluidPort;
}

/**
 * Raccords entre machines à fluide voisines : deux machines se raccordent quand leurs côtés se touchent et que
 * chacune a une prise sur le côté qui fait face à l'autre (peu importe de combien elles sont décalées).
 * `sideCellsOf` donne les cases voisines tout le long d'un côté.
 */
export function fluidLinks(
  machines: Machine[],
  machineAt: (gx: number, gz: number) => Machine | null,
  sideCellsOf: (m: Machine, side: number) => Cell[],
): FluidLink[] {
  const links: FluidLink[] = [];
  for (const a of machines) {
    for (const pa of fluidPorts(a.type, a.rot, a.lift)) {
      const seen = new Set<number>();
      for (const cell of sideCellsOf(a, pa.side)) {
        const b = machineAt(cell.gx, cell.gz);
        if (!b || b === a || b.id < a.id || seen.has(b.id)) continue;
        seen.add(b.id);
        const pb = fluidPorts(b.type, b.rot, b.lift).find((p) => p.side === (pa.side + 2) % 4);
        if (pb) links.push({ a, pa, b, pb });
      }
    }
  }
  return links;
}

const capOf = (m: Machine): number => machineDef(m.type).fluidCap ?? 100;

/** Un tuyau ne porte qu'un fluide à la fois ; les autres machines ont une réserve par fluide. */
export function canHold(m: Machine, port: FluidPort, kind: FluidKind): boolean {
  if (port.fluid === 'liquid' ? kind === 'steam' : port.fluid !== 'any' && port.fluid !== kind)
    return false;
  if (m.type !== 'pipe') return true;
  return FLUID_KINDS.every((other) => other === kind || m.fluid[other] < 0.5);
}

/** Fait circuler les fluides entre les machines raccordées pendant `dt` secondes (équilibrage des niveaux). */
export function stepFluids(links: FluidLink[], dt: number): void {
  for (const link of links) {
    for (const kind of FLUID_KINDS) {
      for (const [from, pf, to, pt] of [
        [link.a, link.pa, link.b, link.pb],
        [link.b, link.pb, link.a, link.pa],
      ] as const) {
        if (pf.mode === 'in' || pt.mode === 'out') continue;
        if (from.broken || to.broken || from.pressure <= 0 || to.pressure <= 0) continue;
        if (!canHold(from, pf, kind) || !canHold(to, pt, kind)) continue;
        const levelFrom = from.fluid[kind] / capOf(from);
        const levelTo = to.fluid[kind] / capOf(to);
        if (levelFrom <= levelTo) continue;
        const room = capOf(to) - to.fluid[kind];
        const flow = Math.min(
          from.fluid[kind],
          room,
          // Au plus la moitié de l'écart par pas : on s'approche de l'équilibre sans le dépasser.
          (levelFrom - levelTo) * Math.min(capOf(from), capOf(to)) * Math.min(0.5, FLOW_RATE * dt),
        );
        if (flow <= 0) continue;
        from.fluid[kind] -= flow;
        to.fluid[kind] += flow;
      }
    }
  }
}

/** Niveau de remplissage (0 à 1) d'un fluide dans une machine. */
export const fluidLevel = (m: Machine, kind: FluidKind): number => m.fluid[kind] / capOf(m);

/** Pression maximale (bar) qu'un tuyau supporte, selon son palier. */
export const pipeMaxBar = (m: Machine): number =>
  machineDef('pipe').tierMaxBar?.[m.tier - 1] ?? machineDef('pipe').tierMaxBar?.[0] ?? 5;

/** Perte de charge (bar par tuile) d'un tuyau, selon son palier ; les autres machines n'en ont pas. */
const frictionOf = (m: Machine): number =>
  m.type === 'pipe'
    ? (machineDef('pipe').tierFrictionBar?.[m.tier - 1] ??
      machineDef('pipe').tierFrictionBar?.[0] ??
      0.1)
    : 0;

/** Ce que le réseau sait de l'état des sources de pression. */
export interface PressureSources {
  /** La pompe a-t-elle de l'eau à pomper ? */
  pumpOn(m: Machine): boolean;
  /** Le surpresseur a-t-il du courant ? */
  powered(m: Machine): boolean;
}

/**
 * Pression (bar) de chaque machine à fluide : les pompes (eau) et les chaudières (vapeur) donnent leur pression de
 * départ, qui diminue de la perte de charge de chaque tuile traversée ; un surpresseur alimenté ajoute de la pression à
 * sa sortie. Un tuyau rompu coupe le passage. À 0 bar le fluide s'immobilise.
 * `extra` : liaisons supplémentaires (tunnels) avec leur longueur en tuiles.
 */
export function stepPressure(
  machines: Machine[],
  links: FluidLink[],
  src: PressureSources,
  tunnelLen: (l: FluidLink) => number = () => 1,
): void {
  for (const m of machines) m.pressure = 0;
  for (const kind of FLUID_KINDS) {
    const edges = new Map<Machine, { to: Machine; cost: number; gain: number }[]>();
    for (const link of links) {
      const len = tunnelLen(link);
      for (const [from, pf, to, pt] of [
        [link.a, link.pa, link.b, link.pb],
        [link.b, link.pb, link.a, link.pa],
      ] as const) {
        if (pf.mode === 'in' || pt.mode === 'out' || from.broken || to.broken) continue;
        if (!canHold(from, pf, kind) || !canHold(to, pt, kind)) continue;
        const gain =
          from.type === 'booster' && pf.mode === 'out' && src.powered(from)
            ? (machineDef('booster').boostBar ?? 0)
            : 0;
        let list = edges.get(from);
        if (!list) edges.set(from, (list = []));
        list.push({ to, cost: frictionOf(to) * len, gain });
      }
    }
    const level = new Map<Machine, number>();
    const queue: Machine[] = [];
    for (const m of machines) {
      const bar = machineDef(m.type).startBar ?? 0;
      if (SOURCE_KIND[m.type] !== kind) continue;
      const on = m.type === 'pump' ? src.pumpOn(m) : m.fluid[kind] > 0.5;
      if (on && bar > 0) {
        level.set(m, bar);
        queue.push(m);
      }
    }
    for (let guard = 0; queue.length > 0 && guard < 200000; guard++) {
      const from = queue.shift() as Machine;
      const p = level.get(from) ?? 0;
      for (const e of edges.get(from) ?? []) {
        const next = p - e.cost + e.gain;
        if (next > 0 && next > (level.get(e.to) ?? 0) + 1e-9) {
          level.set(e.to, next);
          queue.push(e.to);
        }
      }
    }
    for (const [m, p] of level) m.pressure = Math.max(m.pressure, p);
  }
}
