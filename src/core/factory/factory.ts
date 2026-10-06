import { CELL_SIZE_M } from '../constants';
import { RISE_DIR } from '../data/buildings';
import { itemById } from '../data/items';
import {
  hasOutput,
  isChest,
  isDrill,
  isRouter,
  machineDef,
  smeltRecipe,
  type MachineType,
} from '../data/machines';

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
  /** Coffre : piles rangées (au plus `slots`). */
  slots: Stack[];
}

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
}

export type MachineStatus =
  'running' | 'idle' | 'noFuel' | 'noOre' | 'full' | 'blocked' | 'noPower';

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

const GAP = 0.34;

/** Bras robotique : durée d'un aller-retour (s), et réserve de combustible (s) sous laquelle il se ravitaille. */
const ARM_SWING_S = 0.9;
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

export function emptyMachine(
  id: number,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
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
    if (Array.isArray(m.slots) && isChest(machine.type)) {
      for (const st of m.slots) {
        const stack = normalizeStack(st);
        if (stack) machine.slots.push({ ...stack, count: Math.min(stack.count, CHEST_STACK) });
      }
      machine.slots.length = Math.min(machine.slots.length, machineDef(machine.type).slots ?? 0);
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
];

/** Centre d'une machine (m). */
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
    for (const m of this.machines) {
      for (const c of footprint(m.type, m.gx, m.gz, m.rot)) this.cells.set(`${c.gx},${c.gz}`, m);
    }
    this.buildGrids();
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

  machineAt(gx: number, gz: number): Machine | null {
    return this.cells.get(`${gx},${gz}`) ?? null;
  }

  /** La machine peut-elle se poser là (cases libres, sol praticable) ? */
  canPlace(
    type: MachineType,
    gx: number,
    gz: number,
    rot: number,
    blocked: (c: Cell) => boolean,
  ): boolean {
    return footprint(type, gx, gz, rot).every(
      (c) => !this.cells.has(`${c.gx},${c.gz}`) && !blocked(c),
    );
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
    if (m.type === 'arm') {
      if (this.fuelSecondsLeft(m) <= 0) return 'noFuel';
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
    this.updateGrids();
    for (const m of this.machines) {
      if (m.type === 'conveyor') this.tickBelt(m, dt);
      else if (isRouter(m.type)) this.tickRouter(m);
      else if (m.type === 'arm') this.tickArm(m, dt);
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
    if (!isDrill(m.type)) return false;
    const max = machineDef(m.type).stockMax ?? 100;
    return !(m.stock && m.stock.count >= max) && this.pickOreCell(m) !== null;
  }

  /** Puissance disponible et demandée sur chaque réseau, puis part satisfaite. */
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
      if (def.producesKw && (m.fuelLeft > 0 || (m.fuel && m.fuel.count > 0))) {
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
        (from.type === 'conveyor' || isRouter(from.type) || from.type === 'arm')
      )
        return false;
      const cap = machineDef('conveyor').capacity ?? 3;
      if (target.belt.length >= cap) return false;
      const last = target.belt[target.belt.length - 1];
      return !(last && last.pos < GAP);
    }
    // Combustible : par la face d'entrée (carré clair). Générateur : face avant ; foreuse et fourneau : face arrière.
    if (target.type === 'generator')
      return dir === (target.rot + 2) % 4 && this.fuelRoom(target, item);
    if (target.type === 'furnace') {
      if (!smeltRecipe(item)) return dir === target.rot && this.fuelRoom(target, item);
      const max = machineDef('furnace').stockMax ?? 100;
      return !target.input || (target.input.item === item && target.input.count < max);
    }
    if (isDrill(target.type)) return dir === target.rot && this.fuelRoom(target, item);
    return false;
  }

  /** Une machine ou un tapis peut-il recevoir cet objet par cette case ? Si oui, l'y met. */
  private deliver(target: Machine, from: Machine, item: string, dir = from.rot): boolean {
    if (!this.canAccept(target, from, item, dir)) return false;
    if (isChest(target.type)) return chestPut(target, item, 1) > 0;
    if (isRouter(target.type)) target.stock = { item, count: 1 };
    else if (target.type === 'conveyor') target.belt.push({ item, pos: 0 });
    else if (target.type === 'furnace' && smeltRecipe(item)) {
      if (target.input) target.input.count++;
      else target.input = { item, count: 1 };
    } else this.addFuel(target, item);
    return true;
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
    const out = outputCell(m.type, m.gx, m.gz, m.rot);
    const target = this.machineAt(out.gx, out.gz);
    if (!target || target === m) return;
    if (this.deliver(target, m, m.stock.item)) {
      m.stock.count--;
      if (m.stock.count <= 0) m.stock = null;
    }
  }

  /** Séparateur : devant / gauche / droite à tour de rôle. Groupeur : prend derrière / gauche / droite à tour de rôle, sort devant. */
  private tickRouter(m: Machine): void {
    const front = m.rot;
    if (m.type === 'merger' && !m.stock) {
      for (let i = 0; i < 3; i++) {
        const k = (Math.floor(m.progress) + i) % 3;
        const side = (m.rot + [2, 3, 1][k]) % 4;
        const [dx, dz] = RISE_DIR[side];
        const src = this.machineAt(m.gx + dx, m.gz + dz);
        if (!src || src.type !== 'conveyor' || (src.rot + 2) % 4 !== side) continue;
        const head = src.belt[0];
        if (!head || head.pos < 1) continue;
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
      const [dx, dz] = RISE_DIR[dir];
      const target = this.machineAt(m.gx + dx, m.gz + dz);
      if (!target || target === m || !this.deliver(target, m, m.stock.item, dir)) continue;
      m.stock = null;
      if (m.type === 'splitter') m.progress = (k + 1) % 3;
      break;
    }
  }

  /** Ce qu'on peut prendre sur une machine voisine (objet de tête d'un tapis, d'un coffre, d'un stock de sortie). */
  private peekSource(src: Machine): { item: string; take: () => void } | null {
    if (src.type === 'conveyor') {
      const head = src.belt[0];
      return head && head.pos >= 0.5 ? { item: head.item, take: () => src.belt.shift() } : null;
    }
    if (isChest(src.type)) {
      const stack = src.slots[0];
      if (!stack) return null;
      return {
        item: stack.item,
        take: () => {
          stack.count--;
          if (stack.count <= 0) src.slots.shift();
        },
      };
    }
    if (hasOutput(src.type) && src.stock) {
      const stack = src.stock;
      return {
        item: stack.item,
        take: () => {
          stack.count--;
          if (stack.count <= 0) src.stock = null;
        },
      };
    }
    return null;
  }

  /** Bras robotique : s'il va manquer de combustible, en prend un dans une case voisine (derrière ou sur les côtés). */
  private armRefuel(m: Machine): void {
    const max = machineDef('arm').stockMax ?? 10;
    for (const side of [2, 1, 3]) {
      const [dx, dz] = RISE_DIR[(m.rot + side) % 4];
      const src = this.machineAt(m.gx + dx, m.gz + dz);
      const found = src ? this.peekSource(src) : null;
      if (!found || !itemById(found.item).fuelSeconds) continue;
      if (m.fuel && (m.fuel.item !== found.item || m.fuel.count >= max)) continue;
      found.take();
      this.addFuel(m, found.item);
      return;
    }
  }

  /** Bras robotique : prend derrière, dépose devant (un aller-retour par `ARM_SWING_S`). */
  private tickArm(m: Machine, dt: number): void {
    const [fx, fz] = RISE_DIR[m.rot];
    const dest = this.machineAt(m.gx + fx, m.gz + fz);
    if (!m.stock) {
      if (this.fuelSecondsLeft(m) < ARM_LOW_FUEL_S) this.armRefuel(m);
      if (this.fuelSecondsLeft(m) <= 0 || !dest) return;
      const src = this.machineAt(m.gx - fx, m.gz - fz);
      const found = src ? this.peekSource(src) : null;
      if (!found || !this.canAccept(dest, m, found.item, m.rot)) return;
      found.take();
      m.stock = { item: found.item, count: 1 };
      m.progress = 0;
      return;
    }
    if (!this.fire(m)) return;
    this.burn(m, dt);
    m.progress = Math.min(ARM_SWING_S, m.progress + dt);
    if (m.progress >= ARM_SWING_S && dest && this.deliver(dest, m, m.stock.item, m.rot)) {
      m.stock = null;
      m.progress = 0;
    }
  }

  private tickBelt(m: Machine, dt: number): void {
    const speed = machineDef('conveyor').cellsPerSecond ?? 1.5;
    for (let i = 0; i < m.belt.length; i++) {
      const limit = i === 0 ? 1 : m.belt[i - 1].pos - GAP;
      m.belt[i].pos = Math.min(limit, m.belt[i].pos + speed * dt);
    }
    const front = m.belt[0];
    if (front && front.pos >= 1) {
      const [dx, dz] = RISE_DIR[m.rot];
      const target = this.machineAt(m.gx + dx, m.gz + dz);
      if (target && target !== m && this.deliver(target, m, front.item)) m.belt.shift();
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
    const gx = Math.floor((origin.x + dir.x * t) / CELL_SIZE_M);
    const gz = Math.floor((origin.z + dir.z * t) / CELL_SIZE_M);
    const m = factory.machineAt(gx, gz);
    if (m && y <= machineDef(m.type).height) return { machine: m, t };
  }
  return null;
}
