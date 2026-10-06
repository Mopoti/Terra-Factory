import { CELL_SIZE_M } from '../constants';
import { itemById } from '../data/items';
import {
  hasOutput,
  isChest,
  isArm,
  isAssembler,
  isDrill,
  isFluid,
  isLab,
  isLinear,
  isRouter,
  machineDef,
  smeltRecipe,
  visualHeight,
  type MachineType,
} from '../data/machines';
import {
  emptyFluid,
  fluidLevel,
  fluidLinks,
  stepFluids,
  type FluidKind,
  type FluidLink,
} from './fluids';

/** Une pile dans une case de machine : un seul type d'objet. */
export interface Stack {
  item: string;
  count: number;
}

export interface BeltItem {
  item: string;
  /** Avancement dans la case : 0 (entrée) à 1 (sortie). */
  pos: number;
}

/** Une machine posée (foreuse, fourneau) ou un élément de tapis. */
export interface Machine {
  id: number;
  type: MachineType;
  /** Case d'angle minimale (gx, gz) de l'emprise. */
  gx: number;
  gz: number;
  /** Sens de sortie : 0 = vers +z, 1 = +x, 2 = −z, 3 = −x (voir `RISE_DIR`). */
  rot: number;
  /** Secondes de combustion restantes sur le combustible déjà enflammé. */
  fuelLeft: number;
  /** Case de combustible. */
  fuel: Stack | null;
  /** Fourneau : minerai à cuire. */
  input: Stack | null;
  /** Foreuse : minerai extrait ; fourneau : lingots, en attente de sortie. */
  stock: Stack | null;
  /** Avancement du travail en cours (s). */
  progress: number;
  /** Tapis : objets en route. */
  belt: BeltItem[];
  /** Coffre : piles rangées (au plus `slots`). Assembleur : ingrédients en attente. */
  slots: Stack[];
  /** Assembleur : objet fabriqué (null = aucun choix). */
  recipe: string | null;
  /** Fluides contenus (tuyau, pompe, chaudière, turbine). */
  fluid: Record<FluidKind, number>;
  /** Tapis : forme verticale (voir `LIFTS`) ; 0 = à plat au sol. */
  lift: number;
}

/**
 * Formes verticales d'un tapis. `from` / `to` : niveau (0 = sol, 1 = en l'air à 1 m, −1 = sous terre) à l'entrée et à
 * la sortie ; `layers` : couches d'espace occupées (un tapis surélevé laisse libre le sol sous lui, un tunnel aussi).
 * Les pentes font 45° : 1 m de dénivelé sur une tuile de 1 m.
 */
export const LIFTS: ReadonlyArray<{ from: number; to: number; layers: readonly number[] }> = [
  { from: 0, to: 0, layers: [0] }, // 0 : à plat, au sol
  { from: 0, to: 1, layers: [0] }, // 1 : rampe montante
  { from: 1, to: 1, layers: [1] }, // 2 : surélevé
  { from: 1, to: 0, layers: [1, 0] }, // 3 : rampe descendante
  { from: 0, to: -1, layers: [0, -1] }, // 4 : entrée de tunnel
  { from: -1, to: -1, layers: [-1] }, // 5 : souterrain
  { from: -1, to: 0, layers: [-1] }, // 6 : sortie de tunnel
];
export const LIFT_COUNT = LIFTS.length;
/** Hauteur d'un niveau (m). */
export const LEVEL_M = 1;
export const liftStart = (m: Machine): number => (m.type === 'conveyor' ? LIFTS[m.lift].from : 0);
export const liftEnd = (m: Machine): number => (m.type === 'conveyor' ? LIFTS[m.lift].to : 0);

/** Assembleur : ingrédients de la recette choisie (objet -> quantité par unité fabriquée). */
export const recipeOf = (m: Machine): Record<string, number> | null =>
  m.recipe ? itemById(m.recipe).recipe : null;

/** Assembleur : combien d'unités d'un ingrédient il garde en attente au plus. */
export const ingredientCap = (need: number): number => Math.max(10, need * 4);

/** Taille d'une pile dans un coffre. */
export const CHEST_STACK = 100;

/** Combien d'unités de cet objet le coffre peut encore recevoir. */
export function chestRoom(m: Machine, item: string): number {
  const cap = machineDef(m.type).slots ?? 0;
  let room = Math.max(0, cap - m.slots.length) * CHEST_STACK;
  for (const s of m.slots) if (s.item === item) room += CHEST_STACK - s.count;
  return room;
}

/** Range des objets dans un coffre (remplit les piles entamées d'abord). Renvoie la quantité rangée. */
export function chestPut(m: Machine, item: string, count: number): number {
  let left = Math.min(count, chestRoom(m, item));
  const stored = left;
  for (const s of m.slots) {
    if (left <= 0) break;
    if (s.item !== item || s.count >= CHEST_STACK) continue;
    const n = Math.min(left, CHEST_STACK - s.count);
    s.count += n;
    left -= n;
  }
  while (left > 0) {
    const n = Math.min(left, CHEST_STACK);
    m.slots.push({ item, count: n });
    left -= n;
  }
  return stored;
}

/** Ce que l'usine sait du monde : minerai restant par case et extraction réelle. */
export interface FactoryWorld {
  oreAt(gx: number, gz: number): { id: string; item: string; amount: number } | null;
  mineOre(gx: number, gz: number, units: number): number;
  /** Y a-t-il de l'eau (étang) sur cette case ? Absent = pas d'eau. */
  waterAt?(gx: number, gz: number): boolean;
}

export type MachineStatus =
  'running' | 'idle' | 'noFuel' | 'noOre' | 'full' | 'blocked' | 'noPower' | 'noSteam' | 'noWater';

/** État d'un réseau électrique (poteaux reliés entre eux et machines raccordées). */
export interface GridInfo {
  id: number;
  machines: number;
  /** Puissance que les générateurs en état de marche peuvent fournir (kW). */
  capacityKw: number;
  /** Puissance demandée par les machines qui veulent travailler (kW). */
  demandKw: number;
  /** Part de la demande satisfaite (0 à 1). */
  satisfaction: number;
}

export interface Cell {
  gx: number;
  gz: number;
}

/** Écart minimal entre deux objets sur un tapis (en longueurs de tuile de tapis). */
const GAP = 0.17;

/** Bras robotique : réserve de combustible (s) sous laquelle il se ravitaille. */
const ARM_LOW_FUEL_S = 15;

/** Largeur et profondeur de l'emprise selon l'orientation. */
export function dims(type: MachineType, rot: number): { w: number; d: number } {
  const def = machineDef(type);
  return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
}

export function footprint(type: MachineType, gx: number, gz: number, rot: number): Cell[] {
  const { w, d } = dims(type, rot);
  const cells: Cell[] = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) cells.push({ gx: gx + x, gz: gz + z });
  return cells;
}

/** Case de sortie : juste devant le milieu du côté de sortie. */
export function outputCell(type: MachineType, gx: number, gz: number, rot: number): Cell {
  const { w, d } = dims(type, rot);
  switch (rot % 4) {
    case 0:
      return { gx: gx + Math.floor(w / 2), gz: gz + d };
    case 1:
      return { gx: gx + w, gz: gz + Math.floor(d / 2) };
    case 2:
      return { gx: gx + Math.floor(w / 2), gz: gz - 1 };
    default:
      return { gx: gx - 1, gz: gz + Math.floor(d / 2) };
  }
}

/** Une entrée ou une sortie : la case voisine concernée et le sens de la flèche (sens de circulation des objets). */
export interface Port {
  cell: Cell;
  dir: number;
}

/** Case voisine au milieu du côté `dir` (0 = +z, 1 = +x, 2 = −z, 3 = −x) d'une machine posée avec l'orientation `rot`. */
/** Toutes les cases voisines le long du côté `dir` d'une machine. */
export function sideCells(
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  dir: number,
): Cell[] {
  const { w, d } = dims(type, rot);
  const out: Cell[] = [];
  switch (dir % 4) {
    case 0:
      for (let x = 0; x < w; x++) out.push({ gx: gx + x, gz: gz + d });
      break;
    case 1:
      for (let z = 0; z < d; z++) out.push({ gx: gx + w, gz: gz + z });
      break;
    case 2:
      for (let x = 0; x < w; x++) out.push({ gx: gx + x, gz: gz - 1 });
      break;
    default:
      for (let z = 0; z < d; z++) out.push({ gx: gx - 1, gz: gz + z });
  }
  return out;
}

export function sideCell(
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  dir: number,
): Cell {
  const { w, d } = dims(type, rot);
  switch (dir % 4) {
    case 0:
      return { gx: gx + Math.floor(w / 2), gz: gz + d };
    case 1:
      return { gx: gx + w, gz: gz + Math.floor(d / 2) };
    case 2:
      return { gx: gx + Math.floor(w / 2), gz: gz - 1 };
    default:
      return { gx: gx - 1, gz: gz + Math.floor(d / 2) };
  }
}

/** Entrées (flèches vers la machine) et sorties (flèches vers l'extérieur) à dessiner autour d'une machine. */
export function ports(
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
): { ins: Port[]; outs: Port[] } {
  const out = (dir: number): Port => ({ cell: sideCell(type, gx, gz, rot, dir), dir: dir % 4 });
  const into = (dir: number): Port => ({
    cell: sideCell(type, gx, gz, rot, dir),
    dir: (dir + 2) % 4,
  });
  const back = (rot + 2) % 4;
  const left = (rot + 1) % 4;
  const right = (rot + 3) % 4;
  switch (type) {
    case 'drill':
    case 'furnace':
      return { ins: [into(back)], outs: [out(rot)] };
    case 'drill_electric':
      return { ins: [], outs: [out(rot)] };
    case 'generator':
      return { ins: [into(rot)], outs: [] };
    case 'splitter':
      return { ins: [into(back)], outs: [out(rot), out(left), out(right)] };
    case 'merger':
    case 'arm':
    case 'arm_electric':
    case 'assembler':
      return { ins: [into(back), into(left), into(right)], outs: [out(rot)] };
    case 'lab':
      return { ins: [into(back), into(left), into(right), into(rot)], outs: [] };
    case 'boiler':
      return { ins: [into(left), into(right)], outs: [] };
    default:
      return { ins: [], outs: [] };
  }
}

export function emptyMachine(
  id: number,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  lift = 0,
): Machine {
  return {
    id,
    type,
    gx,
    gz,
    rot: ((rot % 4) + 4) % 4,
    fuelLeft: 0,
    fuel: null,
    input: null,
    stock: null,
    progress: 0,
    belt: [],
    slots: [],
    recipe: null,
    fluid: emptyFluid(),
    lift: type === 'conveyor' && Number.isInteger(lift) && lift > 0 && lift < LIFT_COUNT ? lift : 0,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function normalizeStack(raw: unknown): Stack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.item !== 'string' || !isNum(s.count) || s.count <= 0) return null;
  try {
    itemById(s.item);
  } catch {
    return null;
  }
  return { item: s.item, count: Math.floor(s.count) };
}

/** Lit des machines enregistrées : ignore ce qui est inutilisable. */
export function normalizeMachines(raw: unknown): Machine[] {
  if (!Array.isArray(raw)) return [];
  const out: Machine[] = [];
  const seen = new Set<number>();
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const m = r as Record<string, unknown>;
    if (!isNum(m.id) || seen.has(m.id) || !isNum(m.gx) || !isNum(m.gz) || !isNum(m.rot)) continue;
    if (!MACHINE_TYPES.includes(m.type as MachineType)) continue;
    seen.add(m.id);
    const machine = emptyMachine(
      m.id,
      m.type as MachineType,
      Math.floor(m.gx),
      Math.floor(m.gz),
      Math.floor(m.rot),
      isNum(m.lift) ? m.lift : 0,
    );
    machine.fuelLeft = isNum(m.fuelLeft) && m.fuelLeft > 0 ? m.fuelLeft : 0;
    machine.fuel = normalizeStack(m.fuel);
    machine.input = normalizeStack(m.input);
    machine.stock = normalizeStack(m.stock);
    machine.progress = isNum(m.progress) && m.progress > 0 ? m.progress : 0;
    if (Array.isArray(m.belt)) {
      for (const b of m.belt) {
        if (typeof b !== 'object' || b === null) continue;
        const bi = b as Record<string, unknown>;
        if (typeof bi.item === 'string' && isNum(bi.pos)) {
          try {
            itemById(bi.item);
            machine.belt.push({ item: bi.item, pos: Math.min(1, Math.max(0, bi.pos)) });
          } catch {
            /* objet inconnu */
          }
        }
      }
    }
    if (isFluid(machine.type) && typeof m.fluid === 'object' && m.fluid !== null) {
      const f = m.fluid as Record<string, unknown>;
      const cap = machineDef(machine.type).fluidCap ?? 100;
      for (const kind of ['water', 'steam'] as const) {
        const v = f[kind];
        if (isNum(v) && v > 0) machine.fluid[kind] = Math.min(cap, v);
      }
    }
    if (typeof m.recipe === 'string' && isAssembler(machine.type)) {
      try {
        if (itemById(m.recipe).recipe) machine.recipe = m.recipe;
      } catch {
        /* recette inconnue */
      }
    }
    if (Array.isArray(m.slots) && (isChest(machine.type) || isAssembler(machine.type))) {
      for (const st of m.slots) {
        const stack = normalizeStack(st);
        if (stack) machine.slots.push({ ...stack, count: Math.min(stack.count, CHEST_STACK) });
      }
      machine.slots.length = Math.min(
        machine.slots.length,
        isChest(machine.type) ? (machineDef(machine.type).slots ?? 0) : 8,
      );
    }
    out.push(machine);
  }
  return out;
}

const MACHINE_TYPES: MachineType[] = [
  'drill',
  'drill_electric',
  'furnace',
  'conveyor',
  'chest_wood',
  'chest_iron',
  'generator',
  'pole',
  'splitter',
  'merger',
  'arm',
  'arm_electric',
  'assembler',
  'lab',
  'pipe',
  'pump',
  'boiler',
  'turbine',
];

/** Centre d'une machine (m). */
/** Rayon (m) dans lequel on vise ou on bute sur un poteau (le mât est fin, son emprise est de 2 × 2 cases). */
export const POLE_HIT_M = 0.18;

export function centerOf(m: Machine): { x: number; z: number } {
  const { w, d } = dims(m.type, m.rot);
  return { x: (m.gx + w / 2) * CELL_SIZE_M, z: (m.gz + d / 2) * CELL_SIZE_M };
}

/** L'usine : simule foreuses, fourneaux et tapis, 20 fois par seconde. */
export class Factory {
  private cells = new Map<string, Machine>();
  /** Réseau électrique de chaque machine raccordée (identifiant de réseau). */
  private gridOf = new Map<number, number>();
  private grids = new Map<number, GridInfo>();
  /** Fils à dessiner : de poteau à poteau et de poteau à machine. */
  wires: Array<{ from: Machine; to: Machine }> = [];

  constructor(
    readonly machines: Machine[],
    private readonly world: FactoryWorld,
  ) {
    this.reindex();
  }

  reindex(): void {
    this.cells.clear();
    this.upper.clear();
    this.lower.clear();
    this.occupied.clear();
    // Les machines d'abord : un tapis ou un tuyau posé à cheval sur une machine ne « possède » que ses cases libres
    // (la partie dans la machine est cachée et la machine reste celle qu'on trouve sur ces cases).
    for (const m of this.machines) {
      if (isLinear(m.type)) continue;
      for (const c of footprint(m.type, m.gx, m.gz, m.rot)) this.cells.set(`${c.gx},${c.gz}`, m);
    }
    for (const m of this.machines) {
      if (!isLinear(m.type)) continue;
      const start = liftStart(m);
      for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
        const k = `${c.gx},${c.gz}`;
        for (const layer of m.type === 'conveyor' ? LIFTS[m.lift].layers : [0]) {
          let set = this.occupied.get(layer);
          if (!set) this.occupied.set(layer, (set = new Set()));
          set.add(k);
        }
        if (start === 1) this.upper.set(k, m);
        else if (start === -1) this.lower.set(k, m);
        // Au sol : les tapis qui partent du sol et la rampe qui y arrive (visée par le joueur).
        if ((start === 0 || liftEnd(m) === 0) && !this.cells.has(k)) this.cells.set(k, m);
        if (start === 1 && liftEnd(m) === 0) this.upper.set(k, m);
      }
    }
    this.buildGrids();
    this.links = fluidLinks(
      this.machines.filter((m) => isFluid(m.type)),
      (gx, gz) => this.machineAt(gx, gz),
      (m, side) => sideCells(m.type, m.gx, m.gz, m.rot, side),
    );
    this.pumpsOk = new Set(
      this.machines
        .filter((m) => m.type === 'pump' && this.waterNear(m.type, m.gx, m.gz, m.rot))
        .map((m) => m.id),
    );
  }

  /** Cases prises par les tapis et tuyaux, par couche (0 = sol, 1 = en l'air, −1 = sous terre). */
  private readonly occupied = new Map<number, Set<string>>();
  /** Tapis qui partent d'en l'air / de sous terre, par case. */
  private readonly upper = new Map<string, Machine>();
  private readonly lower = new Map<string, Machine>();

  private links: FluidLink[] = [];
  private pumpsOk = new Set<number>();

  /**
   * Pompe : sa première ligne (côté sortie) est sur la terre, le reste de l'emprise est dans l'eau.
   */
  private waterNear(type: MachineType, gx: number, gz: number, rot: number): boolean {
    const water = this.world.waterAt;
    if (!water) return false;
    const { w, d } = dims(type, rot);
    const cells = footprint(type, gx, gz, rot);
    const depthOf = (c: Cell): number => {
      switch (rot % 4) {
        case 0:
          return c.gz - gz;
        case 1:
          return c.gx - gx;
        case 2:
          return d - 1 - (c.gz - gz);
        default:
          return w - 1 - (c.gx - gx);
      }
    };
    const front = Math.max(...cells.map(depthOf));
    return cells.every((c) => {
      const wet = water.call(this.world, c.gx, c.gz);
      return depthOf(c) === front ? !wet : wet;
    });
  }

  /** Relie les poteaux entre eux (fil de 8 m) et les machines électriques au poteau le plus proche (4 m). */
  private buildGrids(): void {
    this.gridOf.clear();
    this.wires = [];
    const poles = this.machines.filter((m) => m.type === 'pole');
    const parent = new Map<number, number>(poles.map((p) => [p.id, p.id]));
    const find = (id: number): number => {
      let r = id;
      while (parent.get(r) !== r) r = parent.get(r) as number;
      return r;
    };
    const wire = machineDef('pole').wireReachM ?? 8;
    const link = machineDef('pole').linkReachM ?? 4;
    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        const a = centerOf(poles[i]);
        const b = centerOf(poles[j]);
        if (Math.hypot(a.x - b.x, a.z - b.z) <= wire) {
          parent.set(find(poles[i].id), find(poles[j].id));
          this.wires.push({ from: poles[i], to: poles[j] });
        }
      }
    }
    const members = new Map<number, number>();
    for (const m of this.machines) {
      const def = machineDef(m.type);
      if (m.type === 'pole' || (!def.consumesKw && !def.producesKw)) continue;
      const c = centerOf(m);
      const reach = link + (Math.max(...Object.values(dims(m.type, m.rot))) * CELL_SIZE_M) / 2;
      let best: Machine | null = null;
      let bestD = Infinity;
      for (const p of poles) {
        const pc = centerOf(p);
        const dist = Math.hypot(pc.x - c.x, pc.z - c.z);
        if (dist <= reach && dist < bestD) {
          best = p;
          bestD = dist;
        }
      }
      if (!best) continue;
      const grid = find(best.id);
      this.gridOf.set(m.id, grid);
      this.wires.push({ from: best, to: m });
      members.set(grid, (members.get(grid) ?? 0) + 1);
    }
    for (const p of poles) this.gridOf.set(p.id, find(p.id));
    this.grids = new Map(
      [...new Set(this.gridOf.values())].map((id) => [
        id,
        { id, machines: members.get(id) ?? 0, capacityKw: 0, demandKw: 0, satisfaction: 1 },
      ]),
    );
  }

  /** Le réseau de cette machine (ou null si elle n'est reliée à aucun poteau). */
  gridInfo(m: Machine): GridInfo | null {
    const id = this.gridOf.get(m.id);
    return id === undefined ? null : (this.grids.get(id) ?? null);
  }

  /** Fraction de sa pleine puissance dont dispose une machine électrique (0 si non raccordée). */
  powerFactor(m: Machine): number {
    return this.gridInfo(m)?.satisfaction ?? 0;
  }

  /** La machine voisine de `m` par son côté `dir` (au milieu du côté ; 0 = +z, 1 = +x, 2 = −z, 3 = −x). */
  neighbor(m: Machine, dir: number): Machine | null {
    return this.neighbors(m, dir)[0] ?? null;
  }

  /** Toutes les machines qui reçoivent ce que `m` pousse par son côté `dir` (la case du milieu d'abord). */
  neighbors(m: Machine, dir: number): Machine[] {
    const level = liftEnd(m);
    const out: Machine[] = [];
    for (const f of this.sideCandidates(m, dir)) {
      const found = this.layerAt(level, f.gx, f.gz);
      if (!found || found === m || out.includes(found)) continue;
      // Un tapis ne reçoit que par son niveau d'entrée ; les machines sont toutes au sol.
      if (found.type === 'conveyor' ? liftStart(found) !== level : level !== 0) continue;
      out.push(found);
    }
    return out;
  }

  /** Tout ce qui touche le côté `dir` de `m` et lui amène des objets (un tapis dont la sortie est à notre niveau). */
  feeders(m: Machine, dir: number): Machine[] {
    const level = liftStart(m);
    const out: Machine[] = [];
    for (const f of this.sideCandidates(m, dir)) {
      for (const found of [
        this.cells.get(`${f.gx},${f.gz}`),
        this.upper.get(`${f.gx},${f.gz}`),
        this.lower.get(`${f.gx},${f.gz}`),
      ]) {
        if (!found || found === m || out.includes(found)) continue;
        if (found.type === 'conveyor' ? liftEnd(found) !== level : level !== 0) continue;
        out.push(found);
      }
    }
    return out;
  }

  private sideCandidates(m: Machine, dir: number): Cell[] {
    return [sideCell(m.type, m.gx, m.gz, m.rot, dir), ...sideCells(m.type, m.gx, m.gz, m.rot, dir)];
  }

  /** Pièce (machine ou tapis) qui démarre à ce niveau sur cette case. */
  private layerAt(level: number, gx: number, gz: number): Machine | null {
    const k = `${gx},${gz}`;
    const found =
      level === 0 ? this.cells.get(k) : level === 1 ? this.upper.get(k) : this.lower.get(k);
    return found ?? null;
  }

  /** Ce qu'il y a sur cette case : au sol par défaut, ou en l'air (1) / sous terre (−1). */
  machineAt(gx: number, gz: number, layer = 0): Machine | null {
    const k = `${gx},${gz}`;
    return (layer === 0 ? this.cells : layer === 1 ? this.upper : this.lower).get(k) ?? null;
  }

  /** La machine peut-elle se poser là (cases libres, sol praticable) ? */
  canPlace(
    type: MachineType,
    gx: number,
    gz: number,
    rot: number,
    blocked: (c: Cell) => boolean,
    lift = 0,
  ): boolean {
    if (type === 'pump' && !this.waterNear(type, gx, gz, rot)) return false;
    const cells = footprint(type, gx, gz, rot);
    if (isLinear(type)) {
      const layers = type === 'conveyor' ? (LIFTS[lift]?.layers ?? [0]) : [0];
      if (type === 'conveyor' && !LIFTS[lift]) return false;
      // Aucune place déjà prise dans les couches qu'il occupe (un tapis peut passer sur ou sous un autre).
      const taken = (c: Cell): boolean =>
        layers.some((l) => this.occupied.get(l)?.has(`${c.gx},${c.gz}`));
      // Un tapis / tuyau au sol peut chevaucher une machine (la moitié cachée dedans), mais au moins une de ses
      // cases doit être visible (libre). En l'air ou sous terre, les machines ne gênent pas.
      const onGround = layers.includes(0);
      const free = cells.filter((c) => !this.cells.has(`${c.gx},${c.gz}`));
      return (
        (!onGround || free.length > 0) &&
        cells.every((c) => !taken(c) && (!onGround || !blocked(c)))
      );
    }
    return cells.every((c) => !this.cells.has(`${c.gx},${c.gz}`) && !blocked(c));
  }

  add(machine: Machine): void {
    this.machines.push(machine);
    this.reindex();
  }

  remove(id: number): Machine | null {
    const i = this.machines.findIndex((m) => m.id === id);
    if (i < 0) return null;
    const [m] = this.machines.splice(i, 1);
    this.reindex();
    return m;
  }

  // --- Informations pour l'affichage -------------------------------------------------------------

  /** Minerai qui reste sous la foreuse, en tout et par type. */
  oreUnder(m: Machine): { total: number; byItem: Record<string, number> } {
    const byItem: Record<string, number> = {};
    let total = 0;
    for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
      const ore = this.world.oreAt(c.gx, c.gz);
      if (ore && ore.amount > 0) {
        byItem[ore.item] = (byItem[ore.item] ?? 0) + ore.amount;
        total += ore.amount;
      }
    }
    return { total, byItem };
  }

  /** Secondes de fonctionnement restantes avec le combustible disponible. */
  fuelSecondsLeft(m: Machine): number {
    const stack = m.fuel ? (itemById(m.fuel.item).fuelSeconds ?? 0) * m.fuel.count : 0;
    return m.fuelLeft + stack;
  }

  status(m: Machine): MachineStatus {
    const def = machineDef(m.type);
    if (isChest(m.type)) {
      const full =
        m.slots.length >= (def.slots ?? 0) && m.slots.every((x) => x.count >= CHEST_STACK);
      return full ? 'full' : m.slots.length > 0 ? 'running' : 'idle';
    }
    if (isRouter(m.type)) return m.stock ? 'blocked' : 'idle';
    if (isAssembler(m.type)) {
      const need = recipeOf(m);
      if (!need) return 'idle';
      if (this.powerFactor(m) <= 0) return 'noPower';
      if (m.stock && (m.stock.item !== m.recipe || m.stock.count >= (def.stockMax ?? 100)))
        return 'full';
      return this.hasIngredients(m, need) ? 'running' : 'idle';
    }
    if (m.type === 'pipe') return m.fluid.water + m.fluid.steam > 0.5 ? 'running' : 'idle';
    if (m.type === 'pump') {
      if (!this.pumpsOk.has(m.id)) return 'noWater';
      if (this.powerFactor(m) <= 0) return 'noPower';
      return m.fluid.water >= (machineDef('pump').fluidCap ?? 100) - 1 ? 'full' : 'running';
    }
    if (m.type === 'boiler') {
      if (m.fluid.water < 0.5) return 'noWater';
      if (this.fuelSecondsLeft(m) <= 0) return 'noFuel';
      return m.fluid.steam >= (def.fluidCap ?? 200) - 1 ? 'full' : 'running';
    }
    if (m.type === 'turbine') {
      if (this.turbineEfficiency(m) <= 0) return 'noSteam';
      return (this.gridInfo(m)?.demandKw ?? 0) > 0 ? 'running' : 'idle';
    }
    if (isLab(m.type)) {
      if (this.powerFactor(m) <= 0) return 'noPower';
      return this.labWorking(m) ? 'running' : 'idle';
    }
    if (isArm(m.type)) {
      if (def.consumesKw) {
        if (this.powerFactor(m) <= 0) return 'noPower';
      } else if (this.fuelSecondsLeft(m) <= 0) return 'noFuel';
      return m.stock ? 'running' : 'idle';
    }
    if (m.type === 'conveyor')
      return m.belt.length > 0 && m.belt[0].pos >= 1
        ? 'blocked'
        : m.belt.length > 0
          ? 'running'
          : 'idle';
    const max = def.stockMax ?? 100;
    if (m.type === 'pole') return (this.gridInfo(m)?.machines ?? 0) > 0 ? 'running' : 'idle';
    if (m.type === 'generator') {
      if (this.fuelSecondsLeft(m) <= 0) return 'noFuel';
      return (this.gridInfo(m)?.demandKw ?? 0) > 0 ? 'running' : 'idle';
    }
    if (isDrill(m.type)) {
      if (this.oreUnder(m).total === 0) return 'noOre';
      if (m.stock && m.stock.count >= max) return 'full';
      if (def.consumesKw && this.powerFactor(m) <= 0) return 'noPower';
    } else {
      if (!m.input || !smeltRecipe(m.input.item)) return 'idle';
      const out = smeltRecipe(m.input.item)?.out;
      if (m.stock && (m.stock.item !== out || m.stock.count >= max)) return 'full';
    }
    if (def.fuel && this.fuelSecondsLeft(m) <= 0) return 'noFuel';
    return 'running';
  }

  // --- Simulation ----------------------------------------------------------------------------------

  tick(dt: number): void {
    stepFluids(this.links, dt);
    this.updateGrids();
    for (const m of this.machines) {
      if (m.type === 'conveyor') this.tickBelt(m, dt);
      else if (isRouter(m.type)) this.tickRouter(m);
      else if (isArm(m.type)) this.tickArm(m, dt);
      else if (isAssembler(m.type)) this.tickAssembler(m, dt);
      else if (isLab(m.type)) this.tickLab(m, dt);
      else if (m.type === 'pump') this.tickPump(m, dt);
      else if (m.type === 'boiler') this.tickBoiler(m, dt);
      else if (m.type === 'turbine') this.tickTurbine(m, dt);
      else if (m.type === 'generator') this.tickGenerator(m, dt);
      else if (hasOutput(m.type)) {
        this.pushOutput(m);
        if (isDrill(m.type)) this.tickDrill(m, dt);
        else this.tickFurnace(m, dt);
      }
    }
  }

  /** Une machine électrique a-t-elle quelque chose à faire (donc demande du courant) ? */
  private wantsToWork(m: Machine): boolean {
    if (isAssembler(m.type)) return this.canCraft(m);
    if (isLab(m.type)) return this.labWorking(m);
    if (m.type === 'pump')
      return this.pumpsOk.has(m.id) && m.fluid.water < (machineDef('pump').fluidCap ?? 100) - 1;
    if (isArm(m.type)) return m.stock !== null || this.armCandidate(m) !== null;
    if (!isDrill(m.type)) return false;
    const max = machineDef(m.type).stockMax ?? 100;
    return !(m.stock && m.stock.count >= max) && this.pickOreCell(m) !== null;
  }

  /** Puissance disponible et demandée sur chaque réseau, puis part satisfaite. */
  /** Paquets de science que les laboratoires peuvent encore utiliser (fixé par la partie selon la recherche en cours). */
  labDemand = 0;
  /** Paquets consommés depuis la dernière lecture (la partie les ajoute à la recherche). */
  private labDone = 0;

  /** Renvoie (et remet à zéro) le nombre de paquets étudiés depuis le dernier appel. */
  takeLabPacks(): number {
    const n = this.labDone;
    this.labDone = 0;
    return n;
  }

  /** Bras robotiques : prochain côté à servir (pas sauvegardé). */
  private readonly armTurn = new Map<number, number>();

  private updateGrids(): void {
    for (const g of this.grids.values()) {
      g.capacityKw = 0;
      g.demandKw = 0;
    }
    for (const m of this.machines) {
      const g = this.gridInfo(m);
      if (!g) continue;
      const def = machineDef(m.type);
      if (def.consumesKw && this.wantsToWork(m)) g.demandKw += def.consumesKw;
      if (m.type === 'turbine') g.capacityKw += this.turbineKw(m);
      else if (def.producesKw && (m.fuelLeft > 0 || (m.fuel && m.fuel.count > 0))) {
        g.capacityKw += def.producesKw;
      }
    }
    for (const g of this.grids.values()) {
      g.satisfaction = g.demandKw <= 0 ? 1 : Math.min(1, g.capacityKw / g.demandKw);
    }
  }

  /** Un générateur ne brûle que ce qu'il faut pour la demande du réseau. */
  private tickGenerator(m: Machine, dt: number): void {
    const g = this.gridInfo(m);
    if (!g || g.demandKw <= 0 || g.capacityKw <= 0) return;
    if (!this.fire(m)) return;
    this.burn(m, dt * Math.min(1, g.demandKw / g.capacityKw));
  }

  /** Allume une unité de combustible si besoin ; renvoie vrai s'il y a de quoi brûler. */
  private fire(m: Machine): boolean {
    if (m.fuelLeft > 0) return true;
    if (!m.fuel || m.fuel.count <= 0) return false;
    m.fuelLeft += itemById(m.fuel.item).fuelSeconds ?? 0;
    m.fuel.count--;
    if (m.fuel.count <= 0) m.fuel = null;
    return m.fuelLeft > 0;
  }

  private burn(m: Machine, dt: number): void {
    m.fuelLeft = Math.max(0, m.fuelLeft - dt * (machineDef(m.type).burnPerSecond ?? 1));
  }

  private tickDrill(m: Machine, dt: number): void {
    const def = machineDef(m.type);
    const max = def.stockMax ?? 100;
    if (m.stock && m.stock.count >= max) return;
    const cell = this.pickOreCell(m);
    if (!cell) return;
    // Foreuse à combustible : elle brûle ; foreuse électrique : elle avance au rythme du courant reçu.
    let speed = 1;
    if (def.consumesKw) {
      speed = this.powerFactor(m);
      if (speed <= 0) return;
    } else {
      if (!this.fire(m)) return;
      this.burn(m, dt);
    }
    m.progress += dt * speed;
    const every = def.mineSeconds ?? 1;
    while (m.progress >= every) {
      m.progress -= every;
      const target = this.pickOreCell(m);
      if (!target || (m.stock && m.stock.count >= max)) {
        m.progress = 0;
        break;
      }
      if (this.world.mineOre(target.cell.gx, target.cell.gz, 1) > 0) {
        if (m.stock) m.stock.count++;
        else m.stock = { item: target.item, count: 1 };
      }
    }
  }

  /** Première case sous la foreuse qui a encore du minerai (du même type que le stock s'il y en a). */
  private pickOreCell(m: Machine): { cell: Cell; item: string } | null {
    for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
      const ore = this.world.oreAt(c.gx, c.gz);
      if (ore && ore.amount > 0 && (!m.stock || m.stock.item === ore.item))
        return { cell: c, item: ore.item };
    }
    return null;
  }

  private tickFurnace(m: Machine, dt: number): void {
    const def = machineDef('furnace');
    const max = def.stockMax ?? 100;
    const recipe = m.input ? smeltRecipe(m.input.item) : null;
    if (!m.input || !recipe) {
      m.progress = 0;
      return;
    }
    if (m.stock && (m.stock.item !== recipe.out || m.stock.count >= max)) return;
    if (!this.fire(m)) return;
    this.burn(m, dt);
    m.progress += dt;
    if (m.progress >= recipe.seconds) {
      m.progress -= recipe.seconds;
      m.input.count--;
      if (m.input.count <= 0) m.input = null;
      if (m.stock) m.stock.count++;
      else m.stock = { item: recipe.out, count: 1 };
    }
  }

  // --- Tapis et échanges ---------------------------------------------------------------------------

  /** Peut-on y ranger au moins 1 `item` poussé dans la direction `dir` ? (sans rien changer) */
  private canAccept(target: Machine, from: Machine, item: string, dir: number): boolean {
    if (isChest(target.type)) return chestRoom(target, item) > 0;
    // Séparateur : une seule case d'attente. Groupeur : va chercher lui-même sur les tapis qui l'alimentent.
    if (target.type === 'splitter') return !target.stock;
    if (target.type === 'merger') return !target.stock && from.type !== 'conveyor';
    if (target.type === 'conveyor') {
      // Un tapis qui nous fait face ne nous reçoit pas (face à face).
      if (
        target.rot === (dir + 2) % 4 &&
        (from.type === 'conveyor' || isRouter(from.type) || isArm(from.type))
      )
        return false;
      const cap = machineDef('conveyor').capacity ?? 3;
      if (target.belt.length >= cap) return false;
      const last = target.belt[target.belt.length - 1];
      return !(last && last.pos < GAP);
    }
    // Combustible : par n'importe quelle face sauf la sortie (le carré clair marque l'entrée conseillée).
    if (target.type === 'generator') return this.fuelRoom(target, item);
    if (target.type === 'furnace') {
      if (!smeltRecipe(item)) return dir !== (target.rot + 2) % 4 && this.fuelRoom(target, item);
      const max = machineDef('furnace').stockMax ?? 100;
      return !target.input || (target.input.item === item && target.input.count < max);
    }
    if (isDrill(target.type) || target.type === 'boiler')
      return dir !== (target.rot + 2) % 4 && this.fuelRoom(target, item);
    if (isAssembler(target.type)) return this.ingredientRoom(target, item);
    if (isLab(target.type))
      return (
        item === 'science_pack' &&
        (target.input?.count ?? 0) < (machineDef(target.type).stockMax ?? 20)
      );
    return false;
  }

  /** Pourquoi `target` refuse cet objet (clé de traduction `factory.refuse.*`), ou null s'il l'accepte. */
  refusal(target: Machine, from: Machine, item: string, dir: number): string | null {
    if (this.canAccept(target, from, item, dir)) return null;
    if (isChest(target.type)) return 'chestFull';
    if (isRouter(target.type))
      return target.type === 'merger' && from.type === 'conveyor' ? 'merger' : 'busy';
    if (target.type === 'conveyor') {
      if (target.rot === (dir + 2) % 4) return 'facing';
      return 'beltFull';
    }
    if (target.type === 'furnace') {
      if (smeltRecipe(item)) return target.input?.item !== item ? 'otherOre' : 'inputFull';
      if (!itemById(item).fuelSeconds) return 'notUsable';
      return dir === (target.rot + 2) % 4 ? 'outputFace' : 'fuelFull';
    }
    if (target.type === 'generator' || isDrill(target.type)) {
      if (!machineDef(target.type).fuel || !itemById(item).fuelSeconds) return 'notUsable';
      return isDrill(target.type) && dir === (target.rot + 2) % 4 ? 'outputFace' : 'fuelFull';
    }
    if (isAssembler(target.type))
      return recipeOf(target)?.[item] ? 'ingredientFull' : 'notIngredient';
    return 'notUsable';
  }

  /** Tapis bloqué : l'objet de tête, sa destination et la raison du refus (pour le panneau d'infos). */
  beltBlock(m: Machine): { item: string; target: Machine | null; reason: string | null } | null {
    const head = m.belt[0];
    if (m.type !== 'conveyor' || !head || head.pos < 1) return null;
    const target = this.neighbor(m, m.rot);
    if (!target || target === m) return { item: head.item, target: null, reason: null };
    return { item: head.item, target, reason: this.refusal(target, m, head.item, m.rot) };
  }

  /** Une machine ou un tapis peut-il recevoir cet objet par cette case ? Si oui, l'y met. */
  private deliver(target: Machine, from: Machine, item: string, dir = from.rot): boolean {
    if (!this.canAccept(target, from, item, dir)) return false;
    if (isChest(target.type)) return chestPut(target, item, 1) > 0;
    if (isRouter(target.type)) target.stock = { item, count: 1 };
    else if (target.type === 'conveyor') target.belt.push({ item, pos: 0 });
    else if (isLab(target.type)) {
      if (target.input) target.input.count++;
      else target.input = { item, count: 1 };
    } else if (isAssembler(target.type)) {
      const stack = target.slots.find((x) => x.item === item);
      if (stack) stack.count++;
      else target.slots.push({ item, count: 1 });
    } else if (target.type === 'furnace' && smeltRecipe(item)) {
      if (target.input) target.input.count++;
      else target.input = { item, count: 1 };
    } else this.addFuel(target, item);
    return true;
  }

  /** Pollution émise par seconde par cette machine (0 si elle ne travaille pas). */
  pollutionRate(m: Machine): number {
    const rate = machineDef(m.type).pollution ?? 0;
    return rate > 0 && this.status(m) === 'running' ? rate : 0;
  }

  /** Côtés d'une machine à fluide raccordés à une autre (pour dessiner les tuyaux). */
  fluidSides(m: Machine): number[] {
    const out: number[] = [];
    for (const l of this.links) {
      if (l.a === m) out.push(l.pa.side);
      else if (l.b === m) out.push(l.pb.side);
    }
    return out;
  }

  /** Turbine : rendement (0 à 1) selon la pression de vapeur : rien sous 20 %, plein à 60 %. */
  turbineEfficiency(m: Machine): number {
    return Math.min(1, Math.max(0, (fluidLevel(m, 'steam') - 0.2) / 0.4));
  }

  turbineKw(m: Machine): number {
    return (machineDef('turbine').producesKw ?? 0) * this.turbineEfficiency(m);
  }

  private tickTurbine(m: Machine, dt: number): void {
    const g = this.gridInfo(m);
    const e = this.turbineEfficiency(m);
    if (!g || g.demandKw <= 0 || g.capacityKw <= 0 || e <= 0) return;
    const load = Math.min(1, g.demandKw / g.capacityKw);
    m.fluid.steam = Math.max(
      0,
      m.fluid.steam - (machineDef('turbine').steamUse ?? 20) * dt * e * load,
    );
  }

  private tickPump(m: Machine, dt: number): void {
    const def = machineDef('pump');
    if (!this.pumpsOk.has(m.id)) return;
    const speed = this.powerFactor(m);
    if (speed <= 0) return;
    m.fluid.water = Math.min(
      def.fluidCap ?? 100,
      m.fluid.water + (def.pumpRate ?? 100) * dt * speed,
    );
  }

  /** Chaudière : transforme l'eau en vapeur tant qu'il y a du combustible et de la place pour la vapeur. */
  private tickBoiler(m: Machine, dt: number): void {
    const def = machineDef('boiler');
    const rate = def.boilRate ?? 60;
    const room = (def.fluidCap ?? 200) - m.fluid.steam;
    const want = Math.min(rate * dt, m.fluid.water, room);
    if (want <= 1e-6 || !this.fire(m)) return;
    m.fluid.water -= want;
    m.fluid.steam += want;
    this.burn(m, dt * (want / (rate * dt)));
  }

  /** Laboratoire : a-t-il des paquets et une étude à mener ? */
  private labWorking(m: Machine): boolean {
    return (m.input?.count ?? 0) > 0 && this.labDemand > 0;
  }

  private tickLab(m: Machine, dt: number): void {
    const speed = this.powerFactor(m);
    if (!this.labWorking(m) || speed <= 0) {
      if (!this.labWorking(m)) m.progress = 0;
      return;
    }
    m.progress += dt * speed;
    const seconds = machineDef(m.type).craftSeconds ?? 6;
    if (m.progress < seconds) return;
    m.progress -= seconds;
    if (m.input) {
      m.input.count--;
      if (m.input.count <= 0) m.input = null;
    }
    this.labDemand--;
    this.labDone++;
  }

  private ingredientRoom(m: Machine, item: string): boolean {
    const need = recipeOf(m)?.[item];
    if (!need) return false;
    const have = m.slots.find((x) => x.item === item)?.count ?? 0;
    return have < ingredientCap(need);
  }

  private hasIngredients(m: Machine, need: Record<string, number>): boolean {
    return Object.entries(need).every(
      ([item, n]) => (m.slots.find((x) => x.item === item)?.count ?? 0) >= n,
    );
  }

  /** Assembleur : assez d'ingrédients et de la place pour le produit ? */
  private canCraft(m: Machine): boolean {
    const need = recipeOf(m);
    if (!need || !m.recipe || !this.hasIngredients(m, need)) return false;
    const max = machineDef(m.type).stockMax ?? 100;
    return !m.stock || (m.stock.item === m.recipe && m.stock.count < max);
  }

  private tickAssembler(m: Machine, dt: number): void {
    this.pushOutput(m);
    const need = recipeOf(m);
    const speed = this.powerFactor(m);
    if (!need || !m.recipe || !this.canCraft(m) || speed <= 0) {
      if (!this.canCraft(m)) m.progress = 0;
      return;
    }
    m.progress += dt * speed;
    const seconds = machineDef(m.type).craftSeconds ?? 2;
    if (m.progress < seconds) return;
    m.progress -= seconds;
    for (const [item, n] of Object.entries(need)) {
      const stack = m.slots.find((x) => x.item === item);
      if (!stack) continue;
      stack.count -= n;
      if (stack.count <= 0) m.slots.splice(m.slots.indexOf(stack), 1);
    }
    if (m.stock) m.stock.count++;
    else m.stock = { item: m.recipe, count: 1 };
  }

  private addFuel(target: Machine, item: string): void {
    if (target.fuel) target.fuel.count++;
    else target.fuel = { item, count: 1 };
  }

  private fuelRoom(target: Machine, item: string): boolean {
    if (!machineDef(target.type).fuel || !itemById(item).fuelSeconds) return false;
    const max = machineDef(target.type).stockMax ?? 100;
    return !target.fuel || (target.fuel.item === item && target.fuel.count < max);
  }

  /** Foreuse / fourneau : pousse un objet du stock vers la case de sortie. */
  private pushOutput(m: Machine): void {
    if (!m.stock || m.stock.count <= 0) return;
    // Toute machine qui touche le côté de sortie convient (pas seulement celle de la case du milieu).
    for (const target of this.neighbors(m, m.rot)) {
      if (this.deliver(target, m, m.stock.item)) {
        m.stock.count--;
        if (m.stock.count <= 0) m.stock = null;
        return;
      }
    }
  }

  /** Séparateur : devant / gauche / droite à tour de rôle. Groupeur : prend derrière / gauche / droite à tour de rôle, sort devant. */
  private tickRouter(m: Machine): void {
    const front = m.rot;
    if (m.type === 'merger' && !m.stock) {
      for (let i = 0; i < 3; i++) {
        const k = (Math.floor(m.progress) + i) % 3;
        const side = (m.rot + [2, 3, 1][k]) % 4;
        const src = this.feeders(m, side).find(
          (c) => c.type === 'conveyor' && (c.rot + 2) % 4 === side && c.belt[0]?.pos >= 1,
        );
        const head = src?.belt[0];
        if (!src || !head) continue;
        m.stock = { item: head.item, count: 1 };
        src.belt.shift();
        m.progress = (k + 1) % 3;
        break;
      }
    }
    if (!m.stock) return;
    const outs = m.type === 'splitter' ? [front, (front + 1) % 4, (front + 3) % 4] : [front];
    for (let i = 0; i < outs.length; i++) {
      const k = m.type === 'splitter' ? (Math.floor(m.progress) + i) % 3 : 0;
      const dir = outs[k];
      const target = this.neighbors(m, dir).find((t) => this.deliver(t, m, m.stock!.item, dir));
      if (!target) continue;
      m.stock = null;
      if (m.type === 'splitter') m.progress = (k + 1) % 3;
      break;
    }
  }

  /** Tout ce qu'on peut prendre sur une machine voisine : objets d'un tapis, piles d'un coffre, stock de sortie. */
  private peekSources(src: Machine): { item: string; take: () => void }[] {
    if (src.type === 'conveyor') {
      return src.belt.map((b) => ({
        item: b.item,
        take: () => {
          const i = src.belt.indexOf(b);
          if (i >= 0) src.belt.splice(i, 1);
        },
      }));
    }
    if (isChest(src.type)) {
      return src.slots.map((stack) => ({
        item: stack.item,
        take: () => {
          stack.count--;
          if (stack.count <= 0) src.slots.splice(src.slots.indexOf(stack), 1);
        },
      }));
    }
    if (hasOutput(src.type) && src.stock) {
      const stack = src.stock;
      return [
        {
          item: stack.item,
          take: () => {
            stack.count--;
            if (stack.count <= 0) src.stock = null;
          },
        },
      ];
    }
    return [];
  }

  /** Bras robotique : s'il va manquer de combustible, en prend un dans une case voisine (derrière ou sur les côtés). */
  private armRefuel(m: Machine): void {
    const max = machineDef(m.type).stockMax ?? 10;
    for (const side of [2, 1, 3]) {
      const src = this.neighbor(m, (m.rot + side) % 4);
      const found = (src ? this.peekSources(src) : []).find(
        (f) =>
          itemById(f.item).fuelSeconds &&
          (!m.fuel || (m.fuel.item === f.item && m.fuel.count < max)),
      );
      if (!found) continue;
      found.take();
      this.addFuel(m, found.item);
      return;
    }
  }

  /** Ce que le bras pourrait prendre maintenant : un objet des 3 côtés (à tour de rôle) que la destination accepte. */
  private armCandidate(m: Machine): { item: string; take: () => void; side: number } | null {
    const dests = this.neighbors(m, m.rot);
    if (dests.length === 0) return null;
    const turn = this.armTurn.get(m.id) ?? 0;
    for (let i = 0; i < 3; i++) {
      const side = (turn + i) % 3;
      for (const src of this.neighbors(m, (m.rot + [2, 1, 3][side]) % 4)) {
        if (dests.includes(src)) continue;
        const found = this.peekSources(src).find((f) =>
          dests.some((d) => this.canAccept(d, m, f.item, m.rot)),
        );
        if (found) return { ...found, side };
      }
    }
    return null;
  }

  /** Pourquoi un bras ne travaille pas (pour le panneau d'infos). */
  armDiagnosis(m: Machine): 'ok' | 'noDest' | 'noSource' | 'refused' {
    const dests = this.neighbors(m, m.rot);
    if (dests.length === 0) return 'noDest';
    let any = false;
    for (const side of [2, 1, 3]) {
      for (const src of this.neighbors(m, (m.rot + side) % 4)) {
        if (dests.includes(src)) continue;
        for (const f of this.peekSources(src)) {
          any = true;
          if (dests.some((d) => this.canAccept(d, m, f.item, m.rot))) return 'ok';
        }
      }
    }
    return any ? 'refused' : 'noSource';
  }

  /** Bras robotique : prend sur 3 côtés, dépose devant (un aller-retour par `swingSeconds`). */
  private tickArm(m: Machine, dt: number): void {
    const def = machineDef(m.type);
    const electric = !!def.consumesKw;
    const swing = def.swingSeconds ?? 0.9;
    const speed = electric ? this.powerFactor(m) : 1;
    if (!m.stock) {
      if (!electric && this.fuelSecondsLeft(m) < ARM_LOW_FUEL_S) this.armRefuel(m);
      if (speed <= 0 || (!electric && this.fuelSecondsLeft(m) <= 0)) return;
      const found = this.armCandidate(m);
      if (!found) return;
      found.take();
      this.armTurn.set(m.id, (found.side + 1) % 3);
      m.stock = { item: found.item, count: 1 };
      m.progress = 0;
      return;
    }
    if (electric) {
      if (speed <= 0) return;
    } else {
      if (!this.fire(m)) return;
      this.burn(m, dt);
    }
    m.progress = Math.min(swing, m.progress + dt * speed);
    const item = m.stock.item;
    if (
      m.progress >= swing &&
      this.neighbors(m, m.rot).some((d) => this.deliver(d, m, item, m.rot))
    ) {
      m.stock = null;
      m.progress = 0;
    }
  }

  private tickBelt(m: Machine, dt: number): void {
    // Une pente à 45° est plus longue qu'une tuile plate (√2) : on y avance moins vite.
    const slope = liftStart(m) !== liftEnd(m) ? Math.SQRT1_2 : 1;
    const speed = (machineDef('conveyor').cellsPerSecond ?? 0.75) * slope;
    for (let i = 0; i < m.belt.length; i++) {
      const limit = i === 0 ? 1 : m.belt[i - 1].pos - GAP;
      m.belt[i].pos = Math.min(limit, m.belt[i].pos + speed * dt);
    }
    const front = m.belt[0];
    if (front && front.pos >= 1) {
      if (this.neighbors(m, m.rot).some((t) => this.deliver(t, m, front.item))) m.belt.shift();
    }
  }
}

/** Première machine ou tapis touché par un rayon (distance en mètres le long du rayon). */
export function pickMachine(
  factory: Factory,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist: number,
): { machine: Machine; t: number } | null {
  if (factory.machines.length === 0) return null;
  for (let t = 0.1; t <= maxDist; t += 0.05) {
    const y = origin.y + dir.y * t;
    if (y < 0) return null;
    const px = origin.x + dir.x * t;
    const pz = origin.z + dir.z * t;
    const gx = Math.floor(px / CELL_SIZE_M);
    const gz = Math.floor(pz / CELL_SIZE_M);
    // En l'air : tapis surélevés et rampes (entre 0,85 m et 1,3 m).
    if (y >= 0.85 && y <= 1.3) {
      const up = factory.machineAt(gx, gz, 1);
      if (up) return { machine: up, t };
    }
    const m = factory.machineAt(gx, gz);
    const top =
      m && m.type === 'conveyor' && m.lift !== 0 ? LEVEL_M + 0.15 : m ? visualHeight(m.type) : 0;
    if (m && y <= top) {
      // Le poteau est fin : on ne le vise que près de son mât (au milieu de son emprise).
      if (m.type === 'pole') {
        const c = centerOf(m);
        if (Math.hypot(px - c.x, pz - c.z) > POLE_HIT_M) continue;
      }
      return { machine: m, t };
    }
    // Sous terre : on vise la plaque du tunnel à ras du sol.
    if (y <= 0.1) {
      const under = factory.machineAt(gx, gz, -1);
      if (under) return { machine: under, t };
    }
  }
  return null;
}
