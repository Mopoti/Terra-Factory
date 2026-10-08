import { machineDef, type MachineType } from '../data/machines';
import type { Cell, Machine } from './factory';

export type FluidKind = 'water' | 'steam';
export const FLUID_KINDS: FluidKind[] = ['water', 'steam'];

/** Une prise de fluide sur un côté d'une machine : sens `in` (reçoit), `out` (émet) ou `both` (tuyau). */
export interface FluidPort {
  /** Côté de la machine (0 = +z, 1 = +x, 2 = −z, 3 = −x). */
  side: number;
  mode: 'in' | 'out' | 'both';
  /** Fluide admis / émis (un tuyau accepte les deux, un à la fois). */
  fluid: FluidKind | 'any';
}

/** Débit : part de l'écart de niveau (0 à 1) qui passe par seconde, multipliée par la plus petite capacité. */
const FLOW_RATE = 20;

export function emptyFluid(): Record<FluidKind, number> {
  return { water: 0, steam: 0 };
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
        { side: (rot + 1) % 4, mode: 'both', fluid: 'water' },
        { side: (rot + 3) % 4, mode: 'both', fluid: 'water' },
        { side: rot % 4, mode: 'out', fluid: 'steam' },
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
function canHold(m: Machine, port: FluidPort, kind: FluidKind): boolean {
  if (port.fluid !== 'any' && port.fluid !== kind) return false;
  if (m.type !== 'pipe') return true;
  const other: FluidKind = kind === 'water' ? 'steam' : 'water';
  return m.fluid[other] < 0.5;
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
