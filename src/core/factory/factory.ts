import { CELL_SIZE_M } from '../constants';
import { RISE_DIR } from '../data/buildings';
import { energyKJ, itemById } from '../data/items';
import {
  AUTO_RECIPE,
  MOULD_CYCLES,
  recipeById,
  recipeByproduct,
  recipeProduct,
} from '../data/recipes';
import { isSciencePack } from '../data/techs';
import {
  beltSpeed,
  filterCount,
  hasOutput,
  isChest,
  isArm,
  isAssembler,
  isDrill,
  isFluid,
  isLab,
  isTurret,
  turretSpec,
  isLinear,
  isRouter,
  machineDef,
  isSmith,
  drillCanMine,
  visualHeight,
  type MachineType,
} from '../data/machines';
import {
  emptyFluid,
  fluidLevel,
  fluidLinks,
  pipeMaxBar,
  stepFluids,
  stepPressure,
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
/** Filtre d'objets : en liste blanche seuls les objets listés passent, en liste noire tous sauf ceux listés. */
export interface ItemFilter {
  mode: 'allow' | 'deny';
  items: string[];
}

/** Un objet passe-t-il ce filtre ? (un filtre absent laisse tout passer) */
export const filterPasses = (f: ItemFilter | undefined, item: string): boolean =>
  !f || (f.mode === 'allow' ? f.items.includes(item) : !f.items.includes(item));

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
  /** Sous-produit (scorie du Bessemer…) : sort par la même face que le produit. */
  extra: Stack | null;
  /** Avancement du travail en cours (s). */
  progress: number;
  /** Tapis : objets en route. */
  belt: BeltItem[];
  /** Coffre : piles rangées (au plus `slots`). Assembleur : ingrédients en attente. */
  slots: Stack[];
  /** Assembleur : objet fabriqué. Fourneau / estampeuse : identifiant de la recette (`recipes.json`). Null = aucun choix. */
  recipe: string | null;
  /** Estampeuse : cycles restants sur le moule en place (0 = aucun moule engagé). */
  wear: number;
  /** Fluides contenus (tuyau, pompe, chaudière, turbine). */
  fluid: Record<FluidKind, number>;
  /** Tapis : palier (1 à 3) qui fixe la vitesse. */
  tier: number;
  /** Bras filtrant (1 filtre) et trieur (3 : devant, gauche, droite) : liste blanche ou noire d'objets. */
  filters: ItemFilter[];
  /** Pression (bar) du fluide dans cette machine (calculée à chaque pas, non enregistrée). */
  pressure: number;
  /** Tuyau rompu (pression trop forte) ou tapis / tuyau abîmé par l'acide : il ne laisse rien passer jusqu'à réparation. */
  broken: boolean;
  /** Tapis : forme verticale (voir `LIFTS`) ; 0 = à plat au sol, 4 / 5 = entrée / sortie de tunnel. */
  lift: number;
  /** Balise : nom affiché (« Balise » par défaut) et couleur (#rrggbb). */
  label?: string;
  tint?: string;
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
  { from: 0, to: 0, layers: [0] }, // 4 : entrée de tunnel (les objets disparaissent)
  { from: 0, to: 0, layers: [0] }, // 5 : sortie de tunnel (ils réapparaissent)
  { from: 1, to: 2, layers: [1] }, // 6 : rampe montante du niveau 1 au niveau 2
  { from: 2, to: 2, layers: [2] }, // 7 : surélevé niveau 2 (2 m : on passe dessous)
  { from: 2, to: 1, layers: [2, 1] }, // 8 : rampe descendante du niveau 2 au niveau 1
];
/** Forme qui prolonge celle-ci (ce qu'on pose à sa suite). */
export const LIFT_NEXT = [0, 2, 2, 0, 0, 0, 7, 7, 2] as const;
/** Portée maximale d'un tunnel de tapis (en tuiles de 1 m entre l'entrée et la sortie), selon le palier T1, T2, T3. */
export const TUNNEL_RANGE_TILES = [4, 8, 16] as const;
/** Portée d'un tunnel de tuyau (en tuiles) : tuyau de cuivre (T1) ; les autres tuyaux viendront avec la pression (point 6). */
export const PIPE_TUNNEL_TILES = 4;
/** Plus longue portée possible (pour borner les objets en transit). */
export const TUNNEL_MAX_TILES = 16;
/** Portée de tunnel d'une entrée de tapis (selon son palier) ou de tuyau. */
export const tunnelRange = (type: string, tier: number): number =>
  type === 'pipe' ? PIPE_TUNNEL_TILES : (TUNNEL_RANGE_TILES[tier - 1] ?? TUNNEL_RANGE_TILES[0]);
export const LIFT_COUNT = LIFTS.length;
/** Hauteur d'un niveau (m). */
/** Hauteur (m) de chaque niveau, en multiples de 50 cm et de même pas (rampes toutes identiques, à 45°) : sol, 1 m, 2 m. */
export const LEVEL_HEIGHTS = [0, 1, 2] as const;
export const levelY = (level: number): number => LEVEL_HEIGHTS[level] ?? 0;
/** Niveau d'entrée d'une pièce : un tapis suit sa forme ; une machine est au sol (0) ou à l'étage sur une dalle (2). */
// Un tuyau n'a que des formes de tunnel (4 entrée, 5 sortie) : toujours au niveau du sol.
export const liftStart = (m: Machine): number =>
  m.type === 'conveyor' ? LIFTS[m.lift].from : m.type === 'pipe' ? 0 : m.lift;
export const liftEnd = (m: Machine): number =>
  m.type === 'conveyor' ? LIFTS[m.lift].to : m.type === 'pipe' ? 0 : m.lift;
/** Étage (dalle à 2 m) : niveau des machines posées en hauteur. */
export const UPPER_LEVEL = 2;

/** Assembleur : ingrédients de la recette choisie (objet -> quantité par unité fabriquée). */
export const recipeOf = (m: Machine): Record<string, number> | null =>
  isSmith(m.type)
    ? (recipeById(m.recipe)?.in ?? null)
    : m.recipe
      ? itemById(m.recipe).recipe
      : null;

/** Objet fabriqué par la recette choisie (assembleur : l'objet lui-même ; fourneau / estampeuse : le produit de la recette). */
export const productOf = (m: Machine): { item: string; count: number } | null => {
  if (!m.recipe) return null;
  if (isSmith(m.type)) {
    const r = recipeById(m.recipe);
    return r ? recipeProduct(r) : null;
  }
  return { item: m.recipe, count: itemById(m.recipe).yield };
};

/** Assembleur : combien d'unités d'un ingrédient il garde en attente au plus. */
export const ingredientCap = (need: number): number => Math.max(10, need * 4);

/** Taille d'une pile dans un coffre. */
export const CHEST_STACK = 100;

/** Taille d'une pile : 100 dans un coffre, `stockMax` (20) dans un laboratoire. */
export const stackLimit = (m: Machine): number =>
  hasSlotStore(m.type) ? (machineDef(m.type).stockMax ?? 20) : CHEST_STACK;

/** Machine dont les `slots` reçoivent des objets précis (laboratoire : paquets ; réacteur à fusion : déchets). */
export const hasSlotStore = (type: MachineType): boolean =>
  type === 'lab' || type === 'fusion_reactor';
/** Combustible du réacteur à fusion. */
export const FUSION_FUEL = ['nuclear_waste', 'contaminated_glass'] as const;

/** Combien d'unités de cet objet le coffre (ou le laboratoire : paquets de science seulement) peut encore recevoir. */
export function chestRoom(m: Machine, item: string): number {
  if (isLab(m.type) && !isSciencePack(item)) return 0;
  if (m.type === 'fusion_reactor' && !(FUSION_FUEL as readonly string[]).includes(item)) return 0;
  const cap = machineDef(m.type).slots ?? 0;
  const limit = stackLimit(m);
  let room = Math.max(0, cap - m.slots.length) * limit;
  for (const s of m.slots) if (s.item === item) room += limit - s.count;
  return room;
}

/** Range des objets dans un coffre (remplit les piles entamées d'abord). Renvoie la quantité rangée. */
export function chestPut(m: Machine, item: string, count: number): number {
  let left = Math.min(count, chestRoom(m, item));
  const stored = left;
  for (const s of m.slots) {
    if (left <= 0) break;
    if (s.item !== item || s.count >= stackLimit(m)) continue;
    const n = Math.min(left, stackLimit(m) - s.count);
    s.count += n;
    left -= n;
  }
  while (left > 0) {
    const n = Math.min(left, stackLimit(m));
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
  | 'running'
  | 'idle'
  | 'noAmmo'
  | 'noStudy'
  | 'noFuel'
  | 'noMould'
  | 'noOre'
  | 'full'
  | 'blocked'
  | 'noPower'
  | 'noSteam'
  | 'noWater'
  | 'broken'
  | 'lowPressure'
  | 'wrongPack'
  | 'overheat'
  | 'plasma'
  | 'priming';

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
  /** Secondes passées en surcharge (demande > production) d'affilée. */
  overloadS: number;
  /** Réseau éteint par une surcharge : tout s'arrête jusqu'à un réamorçage à la manivelle. */
  blackout: boolean;
}

/** Surcharge de 0 à 10 % : les machines ralentissent ; au-delà de 10 s elle provoque un blackout. */
export const OVERLOAD_SOFT_S = 10;
/** Surcharge de plus de 10 % : blackout après ce délai (s). */
export const OVERLOAD_HARD_S = 2;
export const OVERLOAD_HARD_RATIO = 1.1;

export interface Cell {
  gx: number;
  gz: number;
}

/** Écart minimal entre deux objets sur un tapis (en longueurs de tuile de tapis). */
const GAP = 0.17;

/** Intervalle (s) entre deux calculs de pression. */
const PRESSURE_EVERY_S = 0.25;

/** Part du combustible qu'il faut pour chauffer de l'eau déjà chaude. */
const HOT_WATER_FUEL = 0.5;

/** Part du débit de la pompe quand le réseau ne lui donne pas de courant. */
export const PUMP_BACKUP = 0.2;

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
    case 'stamper':
    case 'crusher':
    case 'bessemer':
    case 'mixer':
    case 'barreler':
    case 'builder':
    case 'furnace_electric':
    case 'centrifuge':
    case 'vitrifier':
    case 'fission_reactor':
    case 'plastic_press':
    case 'heavy_press':
    case 'washer':
      return { ins: [into(back)], outs: [out(rot)] };
    case 'drill_electric':
    case 'drill_eco':
      return { ins: [], outs: [out(rot)] };
    case 'generator':
      return { ins: [into(rot)], outs: [] };
    case 'splitter':
    case 'sorter':
      return { ins: [into(back)], outs: [out(rot), out(left), out(right)] };
    case 'merger':
    case 'arm':
    case 'arm_electric':
    case 'arm_filter':
    case 'assembler':
      return { ins: [into(back), into(left), into(right)], outs: [out(rot)] };
    case 'lab':
    case 'turret':
    case 'turret_heavy':
    case 'turret_laser':
    case 'turret_plasma':
      return { ins: [into(back), into(left), into(right), into(rot)], outs: [] };
    case 'boiler':
    case 'fusion_reactor':
      return { ins: [into(back)], outs: [] };
    case 'relay':
      return { ins: [into(back), into(left), into(right), into(rot)], outs: [] };
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
  tier = 1,
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
    extra: null,
    progress: 0,
    belt: [],
    slots: [],
    // Une machine qui n'a qu'une recette (concasseur, Bessemer, bétonnière) la prend d'office.
    recipe: AUTO_RECIPE[type] ?? null,
    wear: 0,
    filters: Array.from({ length: filterCount(type) }, () => ({
      mode: 'deny' as const,
      items: [],
    })),
    tier:
      type === 'conveyor' || type === 'pipe' ? Math.min(3, Math.max(1, Math.floor(tier) || 1)) : 1,
    fluid: emptyFluid(),
    pressure: 0,
    broken: false,
    lift:
      type === 'conveyor'
        ? Number.isInteger(lift) && lift > 0 && lift < LIFT_COUNT
          ? lift
          : 0
        : type === 'pipe'
          ? lift === 4 || lift === 5
            ? lift
            : 0
          : !isLinear(type) && lift === UPPER_LEVEL
            ? UPPER_LEVEL
            : 0,
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
      isNum(m.tier) ? m.tier : 1,
    );
    machine.fuelLeft = isNum(m.fuelLeft) && m.fuelLeft > 0 ? m.fuelLeft : 0;
    machine.fuel = normalizeStack(m.fuel);
    machine.input = isLab(machine.type) ? null : normalizeStack(m.input);
    const oldPacks = isLab(machine.type) ? normalizeStack(m.input) : null;
    machine.stock = normalizeStack(m.stock);
    machine.extra = isSmith(machine.type) ? normalizeStack(m.extra) : null;
    if (Array.isArray(m.filters)) {
      machine.filters.forEach((slot, i) => {
        const raw = m.filters && (m.filters as unknown[])[i];
        if (typeof raw !== 'object' || raw === null) return;
        const f = raw as Record<string, unknown>;
        slot.mode = f.mode === 'allow' ? 'allow' : 'deny';
        slot.items = Array.isArray(f.items)
          ? (f.items as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 200)
          : [];
      });
    }
    machine.progress = isNum(m.progress) && m.progress > 0 ? m.progress : 0;
    if (machine.type === 'waypoint') {
      if (typeof m.label === 'string') machine.label = m.label.slice(0, WAYPOINT_NAME_MAX);
      if (typeof m.tint === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.tint)) machine.tint = m.tint;
    }
    if (Array.isArray(m.belt)) {
      for (const b of m.belt) {
        if (typeof b !== 'object' || b === null) continue;
        const bi = b as Record<string, unknown>;
        if (typeof bi.item === 'string' && isNum(bi.pos)) {
          try {
            itemById(bi.item);
            machine.belt.push({
              item: bi.item,
              pos: Math.min(1, Math.max(-TUNNEL_MAX_TILES - 1, bi.pos)),
            });
          } catch {
            /* objet inconnu */
          }
        }
      }
    }
    if (isFluid(machine.type) && typeof m.fluid === 'object' && m.fluid !== null) {
      const f = m.fluid as Record<string, unknown>;
      const cap = machineDef(machine.type).fluidCap ?? 100;
      for (const kind of ['water', 'steam', 'hot', 'oil', 'polymer', 'dirty'] as const) {
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
    if (typeof m.recipe === 'string' && isSmith(machine.type)) {
      if (recipeById(m.recipe)?.machine === machine.type) machine.recipe = m.recipe;
    }
    if (oldPacks && isSciencePack(oldPacks.item) && machine.slots.length === 0)
      machine.slots.push({ ...oldPacks, count: Math.min(oldPacks.count, stackLimit(machine)) });
    machine.broken =
      m.broken === true &&
      (machine.type === 'pipe' ||
        machine.type === 'conveyor' ||
        machine.type === 'fission_reactor' ||
        machine.type === 'fusion_reactor');
    machine.wear = isNum(m.wear) && m.wear > 0 ? Math.min(MOULD_CYCLES, Math.floor(m.wear)) : 0;
    if (
      Array.isArray(m.slots) &&
      (isChest(machine.type) ||
        hasSlotStore(machine.type) ||
        isAssembler(machine.type) ||
        isSmith(machine.type))
    ) {
      for (const st of m.slots) {
        const stack = normalizeStack(st);
        if (stack)
          machine.slots.push({ ...stack, count: Math.min(stack.count, stackLimit(machine)) });
      }
      machine.slots.length = Math.min(
        machine.slots.length,
        isChest(machine.type) || hasSlotStore(machine.type)
          ? (machineDef(machine.type).slots ?? 0)
          : 8,
      );
    }
    out.push(machine);
  }
  return out;
}

/** Longueur maximale du nom d'une balise. */
export const WAYPOINT_NAME_MAX = 24;
/** Couleurs proposées pour une balise. */
export const WAYPOINT_COLORS = [
  '#e5484d',
  '#f5a524',
  '#f4d03f',
  '#46c46a',
  '#27c1b8',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f4f4f5',
  '#6b7280',
] as const;

const MACHINE_TYPES: MachineType[] = [
  'drill',
  'drill_electric',
  'drill_eco',
  'furnace',
  'stamper',
  'crusher',
  'bessemer',
  'mixer',
  'barreler',
  'booster',
  'cooling_tower',
  'builder',
  'furnace_electric',
  'heavy_press',
  'washer',
  'conveyor',
  'chest_wood',
  'chest_iron',
  'generator',
  'waterwheel',
  'pole',
  'crank',
  'splitter',
  'sorter',
  'arm_filter',
  'merger',
  'arm',
  'arm_electric',
  'assembler',
  'lab',
  'waypoint',
  'turret',
  'turret_heavy',
  'turret_laser',
  'turret_plasma',
  'pipe',
  'pump',
  'pumpjack',
  'refinery',
  'centrifuge',
  'fission_reactor',
  'evaporation_tower',
  'vitrifier',
  'accumulator',
  'fusion_reactor',
  'relay',
  'antenna',
  'plastic_press',
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
    this.air.clear();
    this.occupied.clear();
    // Les machines d'abord : un tapis ou un tuyau posé à cheval sur une machine ne « possède » que ses cases libres
    // (la partie dans la machine est cachée et la machine reste celle qu'on trouve sur ces cases).
    for (const m of this.machines) {
      if (isLinear(m.type)) continue;
      for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
        const k = `${c.gx},${c.gz}`;
        if (m.lift === UPPER_LEVEL) {
          // Machine à l'étage (sur une dalle) : elle occupe le niveau 2, pas le sol.
          let up = this.air.get(UPPER_LEVEL);
          if (!up) this.air.set(UPPER_LEVEL, (up = new Map()));
          up.set(k, m);
          let set = this.occupied.get(UPPER_LEVEL);
          if (!set) this.occupied.set(UPPER_LEVEL, (set = new Set()));
          set.add(k);
        } else this.cells.set(k, m);
      }
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
        if (start >= 1) {
          let level = this.air.get(start);
          if (!level) this.air.set(start, (level = new Map()));
          level.set(k, m);
        }
        // Au sol : les tapis qui partent du sol et la rampe qui y arrive (visée par le joueur).
        if ((start === 0 || liftEnd(m) === 0) && !this.cells.has(k)) this.cells.set(k, m);
      }
    }
    this.linkTunnels();
    this.buildGrids();
    this.tunnelLinks = [];
    for (const m of this.machines) {
      const out = m.type === 'pipe' && m.lift === 4 ? this.tunnelExit.get(m.id) : undefined;
      if (!out) continue;
      // Tuyau enterré : l'eau passe de l'entrée à la sortie comme dans un tuyau continu.
      this.tunnelLinks.push({
        a: m,
        pa: { side: m.rot, mode: 'both', fluid: 'any' },
        b: out,
        pb: { side: (out.rot + 2) % 4, mode: 'both', fluid: 'any' },
      });
    }
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

  /** Entrée de tunnel (id) → sa sortie : la première sortie alignée devant elle. */
  private readonly tunnelExit = new Map<number, Machine>();
  /** Raccords des tuyaux enterrés (entrée ↔ sortie), en plus des raccords voisins. */
  private tunnelLinks: FluidLink[] = [];

  private linkTunnels(): void {
    this.tunnelExit.clear();
    const anchors = new Map<string, Machine>();
    // Tapis et tuyaux ont chacun leurs tunnels : une entrée ne trouve qu'une sortie de son espèce.
    for (const m of this.machines)
      if ((m.type === 'conveyor' || m.type === 'pipe') && m.lift === 5)
        anchors.set(`${m.type}:${m.gx},${m.gz}`, m);
    for (const m of this.machines) {
      if ((m.type !== 'conveyor' && m.type !== 'pipe') || m.lift !== 4) continue;
      const [dx, dz] = RISE_DIR[m.rot];
      for (let k = 1; k <= tunnelRange(m.type, m.tier); k++) {
        const out = anchors.get(`${m.type}:${m.gx + dx * 2 * k},${m.gz + dz * 2 * k}`);
        if (out && out.rot === m.rot) {
          this.tunnelExit.set(m.id, out);
          break;
        }
      }
    }
  }

  /** La sortie de tunnel qui reçoit ce que cette entrée avale (null s'il n'y en a pas). */
  tunnelTarget(m: Machine): Machine | null {
    return this.tunnelExit.get(m.id) ?? null;
  }

  /** Cases prises par les tapis et tuyaux, par couche (0 = sol, 1 = en l'air, −1 = sous terre). */
  private readonly occupied = new Map<number, Set<string>>();
  /** Tapis qui partent d'en l'air / de sous terre, par case. */
  private readonly air = new Map<number, Map<string, Machine>>();

  private links: FluidLink[] = [];
  private pumpsOk = new Set<number>();

  /**
   * Pompe : sa première ligne (côté sortie) est sur la terre, le reste de l'emprise est dans l'eau.
   */
  /** La machine touche-t-elle un étang (une case d'eau contre l'un de ses côtés) sans être elle-même dans l'eau ? */
  /** Roue à aube : à cheval sur la rive (au moins une case dans l'eau et au moins une sur la terre). */
  private onShore(type: MachineType, gx: number, gz: number, rot: number): boolean {
    const water = this.world.waterAt;
    if (!water) return false;
    const cells = footprint(type, gx, gz, rot);
    const wet = cells.filter((c) => water.call(this.world, c.gx, c.gz)).length;
    return wet > 0 && wet < cells.length;
  }

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
        {
          id,
          machines: members.get(id) ?? 0,
          capacityKw: 0,
          demandKw: 0,
          satisfaction: 1,
          overloadS: this.overloadOf.get(id) ?? 0,
          blackout: this.blackedOut.has(id),
        },
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
      if (liftStart(found) !== level) continue;
      out.push(found);
    }
    return out;
  }

  /** Tout ce qui touche le côté `dir` de `m` et lui amène des objets (un tapis dont la sortie est à notre niveau). */
  feeders(m: Machine, dir: number): Machine[] {
    const level = liftStart(m);
    const out: Machine[] = [];
    for (const f of this.sideCandidates(m, dir)) {
      const k = `${f.gx},${f.gz}`;
      for (const found of [this.cells.get(k), ...[...this.air.values()].map((l) => l.get(k))]) {
        if (!found || found === m || out.includes(found)) continue;
        if (liftEnd(found) !== level) continue;
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
    return (level === 0 ? this.cells : this.air.get(level))?.get(k) ?? null;
  }

  /** Ce qu'il y a sur cette case : au sol par défaut, ou en l'air (niveau 1 ou 2). */
  machineAt(gx: number, gz: number, layer = 0): Machine | null {
    return this.layerAt(layer, gx, gz);
  }

  /**
   * Dessus des tapis surélevés et rampes au point (x, z) en mètres : le joueur peut s'y tenir (sol) ou s'y
   * cogner (côté, dessous). Les tapis à plat au sol et les tunnels sont trop bas pour compter.
   */
  beltSpansAt(x: number, z: number): { bottom: number; top: number; belt: Machine }[] {
    const gx = Math.floor(x / CELL_SIZE_M);
    const gz = Math.floor(z / CELL_SIZE_M);
    const k = `${gx},${gz}`;
    const found = new Set<Machine>();
    const low = this.cells.get(k);
    if (low && low.type === 'conveyor' && low.lift !== 0 && low.lift < 4) found.add(low);
    for (const level of this.air.values()) {
      const m = level.get(k);
      if (m && m.type === 'conveyor') found.add(m);
    }
    const out: { bottom: number; top: number; belt: Machine }[] = [];
    for (const m of found) {
      const { from, to } = LIFTS[m.lift];
      const [dx, dz] = RISE_DIR[m.rot];
      const fx = x / CELL_SIZE_M - m.gx;
      const fz = z / CELL_SIZE_M - m.gz;
      // Avancement 0 → 1 le long de la tuile (2 × 2 cases) dans le sens du tapis.
      const raw = dx !== 0 ? (dx > 0 ? fx : 2 - fx) : dz > 0 ? fz : 2 - fz;
      const along = Math.min(1, Math.max(0, raw / 2));
      const top = levelY(from) + (levelY(to) - levelY(from)) * along + 0.12;
      out.push({ bottom: top - 0.2, top, belt: m });
    }
    return out;
  }

  /** Le tapis (surélevé ou rampe) sur lequel se tient quelqu'un dont les pieds sont à la hauteur `y`, ou null. */
  beltUnder(x: number, z: number, y: number): Machine | null {
    return this.beltSpansAt(x, z).find((s) => Math.abs(s.top - y) <= 0.25)?.belt ?? null;
  }

  /** Un tapis plein (rampe, tapis surélevé à 1 m) bloque le passage du joueur ; à 2 m on passe dessous. */
  solidAt(gx: number, gz: number): boolean {
    const k = `${gx},${gz}`;
    const low = this.cells.get(k);
    if (low && low.type === 'conveyor' && low.lift !== 0 && low.lift < 4) return true;
    if (this.air.get(1)?.has(k)) return true;
    const high = this.air.get(2)?.get(k);
    return !!high && high.type === 'conveyor' && high.lift === 8;
  }

  /** Le tapis de palier inférieur que ce tapis remplacerait (même case, même forme), ou null. */
  upgradeOf(type: MachineType, gx: number, gz: number, lift: number, tier: number): Machine | null {
    if (type !== 'conveyor' && type !== 'pipe') return null;
    return (
      this.machines.find(
        (m) =>
          m.type === type &&
          m.gx === gx &&
          m.gz === gz &&
          m.lift === lift &&
          (m.tier < tier || (m.broken && m.tier === tier)),
      ) ?? null
    );
  }

  /** La machine peut-elle se poser là (cases libres, sol praticable) ? */
  canPlace(
    type: MachineType,
    gx: number,
    gz: number,
    rot: number,
    blockedBy: (c: Cell) => boolean,
    lift = 0,
    tier = 1,
  ): boolean {
    // La roue à aube se pose dans l'eau : les cases d'eau ne la bloquent pas (le reste, oui).
    const blocked =
      type === 'waterwheel'
        ? (c: Cell): boolean => !this.world.waterAt?.call(this.world, c.gx, c.gz) && blockedBy(c)
        : blockedBy;
    // Un tapis d'un palier supérieur se pose par-dessus un tapis plus lent, à la même place : il le remplace.
    if (this.upgradeOf(type, gx, gz, lift, tier)) return true;
    if (type === 'pump' && !this.waterNear(type, gx, gz, rot)) return false;
    if (type === 'waterwheel' && !this.onShore(type, gx, gz, rot)) return false;
    const cells = footprint(type, gx, gz, rot);
    if (isLinear(type)) {
      const layers = type === 'conveyor' ? (LIFTS[lift]?.layers ?? [0]) : [0];
      if (type === 'conveyor' && !LIFTS[lift]) return false;
      if (type === 'pipe' && lift !== 0 && lift !== 4 && lift !== 5) return false;
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
    // Machine à l'étage : places libres au niveau 2 (la dalle dessous est vérifiée par `blocked`).
    if (lift === UPPER_LEVEL) {
      if (type === 'pump') return false;
      const occ = this.occupied.get(UPPER_LEVEL);
      if (isRouter(type)) {
        return cells.every((c) => {
          const there = this.air.get(UPPER_LEVEL)?.get(`${c.gx},${c.gz}`);
          return there ? there.type === 'conveyor' && there.lift === 7 : !blocked(c);
        });
      }
      return cells.every((c) => !occ?.has(`${c.gx},${c.gz}`) && !blocked(c));
    }
    // Un séparateur ou un groupeur se pose sur des tapis à plat : ils sont remplacés et la chaîne continue.
    if (isRouter(type)) {
      return cells.every((c) => {
        const there = this.cells.get(`${c.gx},${c.gz}`);
        return there ? there.type === 'conveyor' && there.lift === 0 : !blocked(c);
      });
    }
    return cells.every((c) => !this.cells.has(`${c.gx},${c.gz}`) && !blocked(c));
  }

  /** Tapis qu'un séparateur / groupeur posé là remplacerait. */
  replacedBelts(type: MachineType, gx: number, gz: number, rot: number, lift = 0): Machine[] {
    if (!isRouter(type)) return [];
    const found = new Set<Machine>();
    for (const c of footprint(type, gx, gz, rot)) {
      const k = `${c.gx},${c.gz}`;
      const there = lift === UPPER_LEVEL ? this.air.get(UPPER_LEVEL)?.get(k) : this.cells.get(k);
      if (there && there.type === 'conveyor') found.add(there);
    }
    return [...found];
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
      if (ore && ore.amount > 0 && drillCanMine(m.type, ore.item)) {
        byItem[ore.item] = (byItem[ore.item] ?? 0) + ore.amount;
        total += ore.amount;
      }
    }
    return { total, byItem };
  }

  /** Secondes de fonctionnement restantes (à pleine charge) avec le combustible disponible. `fuelLeft` est en kJ. */
  fuelSecondsLeft(m: Machine): number {
    const stack = m.fuel ? energyKJ(m.fuel.item) * m.fuel.count : 0;
    return (m.fuelLeft + stack) / (machineDef(m.type).burnKw || 1);
  }

  /**
   * Avancement (0 à 1) du cycle de travail en cours, pour la barre de progression ; `null` si la machine ne travaille
   * pas par cycles (tapis, tuyau, coffre…) ou n'a rien en cours. Les foreuses très rapides n'ont pas de barre.
   */
  cycleFraction(m: Machine): number | null {
    if (m.broken) return null;
    const clamp = (v: number): number => Math.max(0, Math.min(1, v));
    const def = machineDef(m.type);
    if (m.type === 'fission_reactor') {
      return m.progress > 0 ? clamp(1 - m.progress / Factory.ROD_SECONDS) : null;
    }
    if (m.type === 'fusion_reactor') {
      if (m.progress <= 0) return null;
      return clamp(m.progress / (m.wear === 0 ? Factory.FUSION_PRIME_S : Factory.FUSION_CYCLE_S));
    }
    if (m.progress <= 0) return null;
    if (isSmith(m.type)) {
      const r = recipeById(m.recipe);
      return r ? clamp(m.progress / r.seconds) : null;
    }
    if (isLab(m.type)) return clamp(m.progress / (def.craftSeconds ?? 6));
    if (isAssembler(m.type)) return clamp(m.progress / (def.craftSeconds ?? 2));
    if (isDrill(m.type) && (def.mineSeconds ?? 1) >= 0.5)
      return clamp(m.progress / (def.mineSeconds ?? 1));
    return null;
  }

  status(m: Machine): MachineStatus {
    const def = machineDef(m.type);
    if (isChest(m.type)) {
      const full =
        m.slots.length >= (def.slots ?? 0) && m.slots.every((x) => x.count >= CHEST_STACK);
      return full ? 'full' : m.slots.length > 0 ? 'running' : 'idle';
    }
    if (m.type === 'sorter' && this.powerFactor(m) <= 0) return 'noPower';
    if (isRouter(m.type)) return m.stock ? 'blocked' : 'idle';
    if (isAssembler(m.type)) {
      const need = recipeOf(m);
      if (!need) return 'idle';
      if (this.powerFactor(m) <= 0) return 'noPower';
      if (m.stock && (m.stock.item !== m.recipe || m.stock.count >= (def.stockMax ?? 100)))
        return 'full';
      return this.hasIngredients(m, need) ? 'running' : 'idle';
    }
    if ((m.type === 'pipe' || m.type === 'conveyor') && m.broken) return 'broken';
    if (m.type === 'pipe') return m.fluid.water + m.fluid.steam > 0.5 ? 'running' : 'idle';
    if (m.type === 'fusion_reactor') {
      if (m.broken) return 'broken';
      return this.fusionOn(m) ? 'plasma' : this.fusionPriming(m) ? 'priming' : 'idle';
    }
    if (m.type === 'evaporation_tower') return m.fluid.dirty > 0.5 ? 'running' : 'idle';
    if (m.type === 'fission_reactor') {
      if (m.broken) return 'broken';
      if (m.progress > 0) return m.fuelLeft > 0 ? 'overheat' : 'running';
      return 'idle';
    }
    if (m.type === 'refinery') {
      if (m.fluid.oil < 0.5 && m.fluid.polymer < 0.5) return 'idle';
      if (m.pressure < Factory.REFINERY_MIN_BAR && m.fluid.oil >= 0.5) return 'lowPressure';
      if (this.powerFactor(m) <= 0) return 'noPower';
      return m.fluid.polymer >= (def.fluidCap ?? 200) - 1
        ? 'full'
        : this.refineryReady(m)
          ? 'running'
          : 'idle';
    }
    if (m.type === 'pumpjack') {
      if (!this.oilCell(m)) return 'noOre';
      if (this.powerFactor(m) <= 0) return 'noPower';
      return m.fluid.oil >= (def.fluidCap ?? 200) - 1 ? 'full' : 'running';
    }
    if (m.type === 'pump') {
      if (!this.pumpsOk.has(m.id)) return 'noWater';
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
    if (isTurret(m.type)) {
      if (turretSpec(m.type).ammo === null) return this.powerFactor(m) > 0 ? 'idle' : 'noPower';
      return this.turretReady(m) ? 'idle' : 'noAmmo';
    }
    if (isLab(m.type)) {
      if (this.powerFactor(m) <= 0) return 'noPower';
      if (this.hasPacks(m) && this.labDemand <= 0) return 'noStudy';
      if (this.hasPacks(m) && !this.usablePack(m)) return 'wrongPack';
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
    if (m.type === 'waterwheel') return (this.gridInfo(m)?.demandKw ?? 0) > 0 ? 'running' : 'idle';
    if (m.type === 'generator') {
      if (this.fuelSecondsLeft(m) <= 0) return 'noFuel';
      return (this.gridInfo(m)?.demandKw ?? 0) > 0 ? 'running' : 'idle';
    }
    if (isDrill(m.type)) {
      if (this.oreUnder(m).total === 0) return 'noOre';
      if (m.stock && m.stock.count >= max) return 'full';
      if (def.consumesKw && this.powerFactor(m) <= 0) return 'noPower';
    } else {
      const r = recipeById(m.recipe);
      const product = productOf(m);
      if (!r || !product || !this.hasIngredients(m, r.in)) return 'idle';
      if (
        (m.stock && (m.stock.item !== product.item || m.stock.count + product.count > max)) ||
        (m.extra && m.extra.count >= max)
      )
        return 'full';
      if (r.mould && m.wear <= 0 && !(m.input?.item === r.mould && m.input.count > 0))
        return 'noMould';
      if (r.fluid) {
        const have = m.fluid[r.fluid.kind];
        if (r.fluid.amount > 0 && have < r.fluid.amount) return 'noWater';
        if (r.fluid.minBar && m.pressure < r.fluid.minBar) return 'lowPressure';
        if (r.fluid.amount < 0 && (def.fluidCap ?? 100) - have < -r.fluid.amount) return 'full';
      }
      if (def.consumesKw && this.powerFactor(m) <= 0) return 'noPower';
    }
    if (def.fuel && this.fuelSecondsLeft(m) <= 0) return 'noFuel';
    return 'running';
  }

  // --- Simulation ----------------------------------------------------------------------------------

  tick(dt: number): void {
    this.pressureClock += dt;
    if (this.pressureClock >= PRESSURE_EVERY_S) {
      this.pressureClock = 0;
      this.updatePressure();
    }
    for (const m of this.machines) if (m.broken) m.fluid = emptyFluid();
    stepFluids(this.links, dt);
    stepFluids(this.tunnelLinks, dt);
    this.updateGrids(dt);
    for (const m of this.machines) {
      if (m.type === 'conveyor') this.tickBelt(m, dt);
      else if (isRouter(m.type)) this.tickRouter(m);
      else if (isArm(m.type)) this.tickArm(m, dt);
      else if (isAssembler(m.type)) this.tickAssembler(m, dt);
      else if (isLab(m.type)) this.tickLab(m, dt);
      else if (m.type === 'pump') this.tickPump(m, dt);
      else if (m.type === 'pumpjack') this.tickPumpjack(m, dt);
      else if (m.type === 'refinery') this.tickRefinery(m, dt);
      else if (m.type === 'fission_reactor') this.tickReactor(m, dt);
      else if (m.type === 'evaporation_tower') this.tickEvaporator(m, dt);
      else if (m.type === 'fusion_reactor') this.tickFusion(m, dt);
      else if (m.type === 'boiler') this.tickBoiler(m, dt);
      else if (m.type === 'cooling_tower') this.tickCooler(m, dt);
      else if (m.type === 'turbine') this.tickTurbine(m, dt);
      else if (m.type === 'generator') this.tickGenerator(m, dt);
      else if (hasOutput(m.type)) {
        this.pushOutput(m);
        if (isDrill(m.type)) this.tickDrill(m, dt);
        else this.tickSmith(m, dt);
      }
    }
  }

  /** Une machine électrique a-t-elle quelque chose à faire (donc demande du courant) ? */
  private wantsToWork(m: Machine): boolean {
    if (isAssembler(m.type)) return this.canCraft(m);
    if (isLab(m.type)) return this.labWorking(m);
    if (m.type === 'pump')
      return this.pumpsOk.has(m.id) && m.fluid.water < (machineDef('pump').fluidCap ?? 100) - 1;
    if (m.type === 'relay' || m.type === 'antenna') return true;
    if (m.type === 'refinery') return this.refineryReady(m);
    if (m.type === 'pumpjack')
      return this.oilCell(m) !== null && m.fluid.oil < (machineDef('pumpjack').fluidCap ?? 200) - 1;
    if (m.type === 'sorter') return m.stock !== null;
    if (isArm(m.type)) return m.stock !== null || this.armCandidate(m) !== null;
    if (isSmith(m.type)) return !!machineDef(m.type).consumesKw && this.smithReady(m);
    if (!isDrill(m.type)) return false;
    const max = machineDef(m.type).stockMax ?? 100;
    return !(m.stock && m.stock.count >= max) && this.pickOreCell(m) !== null;
  }

  /** Puissance disponible et demandée sur chaque réseau, puis part satisfaite. */
  /** Paquets de science que les laboratoires peuvent encore utiliser (fixé par la partie selon la recherche en cours). */
  labDemand = 0;
  /** Paquets consommés depuis la dernière lecture (la partie les ajoute à la recherche). */
  private labDone: Record<string, number> = {};
  /** Le comptoir spatial est ouvert (balise activée) : le relais achète tout ce qu'un tapis lui amène. */
  tradeOpen = false;
  private readonly sold = new Map<string, number>();

  /** Relève (et remet à zéro) ce que le relais a reçu par tapis : objet -> quantité. */
  takeSold(): [string, number][] {
    const out = [...this.sold];
    this.sold.clear();
    return out;
  }
  /** Paquets encore utiles à l'étude en cours, par type (null = n'importe lequel). */
  labNeeds: Record<string, number> | null = null;
  /** Objets fabriqués par les machines depuis le dernier relevé (compteurs des découvertes). */
  private readonly made = new Map<string, number>();

  /** Renvoie (et remet à zéro) le nombre de paquets étudiés depuis le dernier appel. */
  /** Relève (et remet à zéro) ce que les machines ont fabriqué : objet -> quantité. */
  takeProduced(): [string, number][] {
    const out = [...this.made];
    this.made.clear();
    return out;
  }

  takeLabPacks(): Record<string, number> {
    const n = this.labDone;
    this.labDone = {};
    return n;
  }

  /** Bras robotiques : prochain côté à servir (pas sauvegardé). */
  private readonly armTurn = new Map<number, number>();

  /** Réseaux en blackout et temps de surcharge (par identifiant de réseau), conservés quand le plan est refait. */
  private readonly blackedOut = new Set<number>();
  private readonly overloadOf = new Map<number, number>();

  /**
   * Manivelle : réamorce le réseau de la manivelle `m` après un blackout. Il faut que la production couvre
   * la demande (sinon il faut couper des machines ou ajouter des générateurs d'abord).
   */
  crank(m: Machine): 'ok' | 'running' | 'tooMuch' {
    const g = this.gridInfo(m);
    if (!g || !g.blackout) return 'running';
    if (g.demandKw > g.capacityKw) return 'tooMuch';
    this.blackedOut.delete(g.id);
    this.overloadOf.delete(g.id);
    g.blackout = false;
    g.overloadS = 0;
    return 'ok';
  }

  private pressureClock = Infinity;

  /** Recalcule la pression de chaque réseau de fluides et rompt les tuyaux qui dépassent leur maximum. */
  private updatePressure(): void {
    const fluids = this.machines.filter((m) => isFluid(m.type));
    if (fluids.length === 0) return;
    const all = [...this.links, ...this.tunnelLinks];
    stepPressure(
      fluids,
      all,
      {
        pumpOn: (m) => this.pumpsOk.has(m.id),
        powered: (m) => this.powerFactor(m) > 0,
      },
      (l) =>
        this.tunnelLinks.includes(l)
          ? Math.max(1, Math.abs(l.b.gx - l.a.gx) + Math.abs(l.b.gz - l.a.gz)) / 2
          : 1,
    );
    for (const m of fluids) {
      if (m.type === 'pipe' && !m.broken && m.pressure > pipeMaxBar(m) + 1e-6) m.broken = true;
    }
  }

  /** Plasma allumé dans le réacteur à fusion ? (`wear` = 1 tant que le plasma brûle.) */
  fusionOn(m: Machine): boolean {
    return m.type === 'fusion_reactor' && !m.broken && m.wear === 1;
  }

  private fusionFuelCount(m: Machine, item: string): number {
    return m.slots.find((s) => s.item === item)?.count ?? 0;
  }

  /** Le réacteur à fusion a-t-il de quoi (au moins un déchet et un cylindre) s'amorcer ? */
  fusionFueled(m: Machine): boolean {
    return FUSION_FUEL.every((i) => this.fusionFuelCount(m, i) > 0);
  }

  /** Amorçage : 500 MW pendant 10 s, fournis par le réseau (accumulateurs). */
  static readonly FUSION_PRIME_KW = 500000;
  /** Pause (s) entre deux cycles d'une machine de fabrication : la barre de progression revient à zéro. */
  static readonly CYCLE_REST_S = 0.5;
  private readonly rest = new Map<number, number>();

  /** Machine en pause entre deux cycles : rien ne se fait, la barre est à zéro. */
  private resting(m: Machine, dt: number): boolean {
    const left = this.rest.get(m.id);
    if (left === undefined) return false;
    // Marge de 1 µs : 0,5 s = exactement 10 pas de 0,05 s malgré les arrondis.
    if (left <= dt + 1e-6) this.rest.delete(m.id);
    else this.rest.set(m.id, left - dt);
    m.progress = 0;
    return true;
  }

  static readonly FUSION_PRIME_S = 10;
  /** Un déchet et un cylindre brûlent toutes les 30 s. */
  static readonly FUSION_CYCLE_S = 30;

  private fusionPriming(m: Machine): boolean {
    return m.type === 'fusion_reactor' && !m.broken && m.wear === 0 && this.fusionFueled(m);
  }

  /** Réacteur à fusion : amorçage sur le réseau, puis plasma qui brûle son combustible ; il s'effondre s'il en manque ou si le réseau disjoncte. */
  private tickFusion(m: Machine, dt: number): void {
    if (m.broken) return;
    const g = this.gridInfo(m);
    if (m.wear === 0) {
      // Amorçage : il faut toute la puissance demandée, d'affilée.
      if (this.fusionPriming(m) && g && !g.blackout && g.satisfaction >= 0.999) m.progress += dt;
      else m.progress = 0;
      if (m.progress >= Factory.FUSION_PRIME_S) {
        m.wear = 1;
        m.progress = 0;
      }
      return;
    }
    // Plasma : les aimants exigent le réseau ; le combustible se consomme au rythme du cycle.
    if (!g || g.blackout || g.satisfaction < 0.5) return this.collapse(m);
    m.progress += dt;
    if (m.progress >= Factory.FUSION_CYCLE_S) {
      m.progress -= Factory.FUSION_CYCLE_S;
      if (!this.fusionFueled(m)) return this.collapse(m);
      for (const item of FUSION_FUEL) {
        const stack = m.slots.find((s) => s.item === item);
        if (!stack) continue;
        stack.count--;
        if (stack.count <= 0) m.slots.splice(m.slots.indexOf(stack), 1);
      }
    }
  }

  private collapse(m: Machine): void {
    m.broken = true;
    m.wear = 0;
    m.progress = 0;
  }

  /** Accumulateurs : chargent avec le surplus du réseau, donnent leur énergie quand la demande dépasse la production. */
  private storeEnergy(dt: number): void {
    const byGrid = new Map<number, Machine[]>();
    for (const m of this.machines) {
      if (m.type !== 'accumulator') continue;
      const g = this.gridInfo(m);
      if (!g) continue;
      const list = byGrid.get(g.id) ?? [];
      list.push(m);
      byGrid.set(g.id, list);
    }
    for (const [id, accs] of byGrid) {
      const g = this.grids.get(id);
      if (!g || g.blackout) continue;
      const def = machineDef('accumulator');
      const max = def.storageKJ ?? 0;
      if (g.demandKw > g.capacityKw) {
        // Décharge : au plus la puissance de chaque accumulateur et ce qu'il lui reste.
        let need = g.demandKw - g.capacityKw;
        for (const a of accs) {
          const give = Math.min(need, def.dischargeKw ?? 0, a.fuelLeft / dt);
          if (give <= 0) continue;
          a.fuelLeft -= give * dt;
          g.capacityKw += give;
          need -= give;
        }
      } else {
        let surplus = g.capacityKw - g.demandKw;
        for (const a of accs) {
          const take = Math.min(surplus, def.chargeKw ?? 0, (max - a.fuelLeft) / dt);
          if (take <= 0) continue;
          a.fuelLeft += take * dt;
          surplus -= take;
        }
      }
    }
  }

  private updateGrids(dt: number): void {
    for (const g of this.grids.values()) {
      g.capacityKw = 0;
      g.demandKw = 0;
    }
    for (const m of this.machines) {
      const g = this.gridInfo(m);
      if (!g) continue;
      const def = machineDef(m.type);
      if (m.type === 'fusion_reactor') {
        // Amorçage : 500 MW ; plasma : aimants 50 MW et production 500 MW.
        if (this.fusionOn(m)) {
          g.demandKw += def.consumesKw ?? 0;
          g.capacityKw += def.producesKw ?? 0;
        } else if (this.fusionPriming(m)) g.demandKw += Factory.FUSION_PRIME_KW;
        continue;
      }
      if (def.consumesKw && this.wantsToWork(m)) g.demandKw += def.consumesKw;
      if (m.type === 'accumulator') continue;
      if (m.type === 'fission_reactor')
        g.capacityKw += this.reactorRunning(m) ? (def.producesKw ?? 0) : 0;
      else if (m.type === 'turbine') g.capacityKw += this.turbineKw(m);
      else if (m.type === 'waterwheel') g.capacityKw += def.producesKw ?? 0;
      else if (def.producesKw && (m.fuelLeft > 0 || (m.fuel && m.fuel.count > 0))) {
        g.capacityKw += def.producesKw;
      }
    }
    this.storeEnergy(dt);
    for (const g of this.grids.values()) {
      g.satisfaction = g.demandKw <= 0 ? 1 : Math.min(1, g.capacityKw / g.demandKw);
      const ratio = g.capacityKw > 0 ? g.demandKw / g.capacityKw : 0;
      if (ratio > 1 && !g.blackout) {
        g.overloadS += dt;
        if (
          g.overloadS >= OVERLOAD_SOFT_S ||
          (ratio > OVERLOAD_HARD_RATIO && g.overloadS >= OVERLOAD_HARD_S)
        ) {
          g.blackout = true;
          this.blackedOut.add(g.id);
        }
      } else if (ratio <= 1) g.overloadS = 0;
      if (g.overloadS > 0) this.overloadOf.set(g.id, g.overloadS);
      else this.overloadOf.delete(g.id);
      if (g.blackout) g.satisfaction = 0;
    }
  }

  /** Un générateur ne brûle que ce qu'il faut pour la demande du réseau. */
  private tickGenerator(m: Machine, dt: number): void {
    const g = this.gridInfo(m);
    if (!g || g.blackout || g.demandKw <= 0 || g.capacityKw <= 0) return;
    if (!this.fire(m)) return;
    this.burn(m, dt * Math.min(1, g.demandKw / g.capacityKw));
  }

  /** Allume une unité de combustible si besoin ; renvoie vrai s'il y a de quoi brûler. */
  private fire(m: Machine): boolean {
    if (m.fuelLeft > 0) return true;
    if (!m.fuel || m.fuel.count <= 0) return false;
    m.fuelLeft += energyKJ(m.fuel.item);
    m.fuel.count--;
    if (m.fuel.count <= 0) m.fuel = null;
    return m.fuelLeft > 0;
  }

  private burn(m: Machine, dt: number): void {
    m.fuelLeft = Math.max(0, m.fuelLeft - dt * (machineDef(m.type).burnKw ?? 0));
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
      if (
        ore &&
        ore.amount > 0 &&
        drillCanMine(m.type, ore.item) &&
        (!m.stock || m.stock.item === ore.item)
      )
        return { cell: c, item: ore.item };
    }
    return null;
  }

  /** Le cycle de la recette peut-il démarrer (ingrédients, place pour les produits, moule) ? Sert à l'état et à la demande de courant. */
  private smithReady(m: Machine): boolean {
    const def = machineDef(m.type);
    const max = def.stockMax ?? 100;
    const r = recipeById(m.recipe);
    const product = productOf(m);
    if (!r || !product || !this.hasIngredients(m, r.in)) return false;
    if (m.stock && (m.stock.item !== product.item || m.stock.count + product.count > max))
      return false;
    const by = recipeByproduct(r);
    if (by && m.extra && (m.extra.item !== by.item || m.extra.count + by.count > max)) return false;
    if (r.mould && m.wear <= 0 && !(m.input?.item === r.mould && m.input.count > 0)) return false;
    if (r.fluid) {
      // Remplir un baril puise l'eau de la machine ; le vider l'y verse (il faut de la place dans sa réserve).
      const have = m.fluid[r.fluid.kind];
      if (r.fluid.minBar && m.pressure < r.fluid.minBar) return false;
      if (
        r.fluid.amount > 0 ? have < r.fluid.amount : (def.fluidCap ?? 100) - have < -r.fluid.amount
      )
        return false;
    }
    return true;
  }

  /**
   * Fourneau, estampeuse, concasseur, Bessemer, bétonnière : un cycle de la recette choisie. Il faut tous les
   * ingrédients, de la place pour les produits et, pour l'estampeuse, un moule (il s'use de 1 par cycle et se
   * brise à zéro). Les machines à combustible brûlent ; les machines électriques ralentissent sans courant.
   */
  private tickSmith(m: Machine, dt: number): void {
    if (this.resting(m, dt)) return;
    const def = machineDef(m.type);
    const r = recipeById(m.recipe);
    const product = productOf(m);
    if (!r || !product || !this.hasIngredients(m, r.in)) {
      m.progress = 0;
      return;
    }
    if (!this.smithReady(m)) return;
    // Moule : on en engage un neuf quand le précédent est brisé.
    if (r.mould && m.wear <= 0) {
      if (m.input?.item !== r.mould || m.input.count <= 0) return;
      m.input.count--;
      if (m.input.count <= 0) m.input = null;
      m.wear = MOULD_CYCLES;
    }
    if (def.consumesKw) {
      const speed = this.powerFactor(m);
      if (speed <= 0) return;
      m.progress += dt * speed * this.coolingFactor(m, dt);
    } else {
      if (!this.fire(m)) return;
      this.burn(m, dt);
      m.progress += dt;
    }
    if (m.progress < r.seconds) return;
    m.progress = 0;
    this.rest.set(m.id, Factory.CYCLE_REST_S);
    for (const [item, n] of Object.entries(r.in)) {
      const stack = m.slots.find((x) => x.item === item);
      if (!stack) continue;
      stack.count -= n;
      if (stack.count <= 0) m.slots.splice(m.slots.indexOf(stack), 1);
    }
    if (r.mould) m.wear--;
    if (r.fluid) m.fluid[r.fluid.kind] = Math.max(0, m.fluid[r.fluid.kind] - r.fluid.amount);
    if (m.stock) m.stock.count += product.count;
    else m.stock = { item: product.item, count: product.count };
    this.made.set(product.item, (this.made.get(product.item) ?? 0) + product.count);
    const by = recipeByproduct(r);
    if (by) {
      if (m.extra) m.extra.count += by.count;
      else m.extra = { item: by.item, count: by.count };
      this.made.set(by.item, (this.made.get(by.item) ?? 0) + by.count);
    }
  }

  // --- Tapis et échanges ---------------------------------------------------------------------------

  /** Peut-on y ranger au moins 1 `item` poussé dans la direction `dir` ? (sans rien changer) */
  private canAccept(target: Machine, from: Machine, item: string, dir: number): boolean {
    if (isChest(target.type)) return chestRoom(target, item) > 0;
    // Séparateur : une seule case d'attente. Groupeur : va chercher lui-même sur les tapis qui l'alimentent.
    if (target.type === 'splitter' || target.type === 'sorter') return !target.stock;
    if (target.type === 'merger') return !target.stock && from.type !== 'conveyor';
    if (target.type === 'conveyor') {
      if (target.broken) return false;
      // Une sortie de tunnel ne reçoit que de son entrée.
      if (target.lift === 5) return false;
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
    if (isSmith(target.type)) return this.smithSlot(target, item, dir) !== null;
    // Chaudière : combustible uniquement par l'arrière (face à la sortie de vapeur).
    if (target.type === 'boiler') return dir === target.rot && this.fuelRoom(target, item);
    if (isDrill(target.type)) return dir !== (target.rot + 2) % 4 && this.fuelRoom(target, item);
    if (isAssembler(target.type)) return this.ingredientRoom(target, item);
    if (target.type === 'fission_reactor')
      return (
        item === 'uranium_rod' &&
        !target.broken &&
        (!target.input || target.input.item === item) &&
        (target.input?.count ?? 0) < (machineDef('fission_reactor').stockMax ?? 20)
      );
    if (isTurret(target.type))
      return (
        item === turretSpec(target.type).ammo &&
        (target.input?.count ?? 0) < (machineDef(target.type).stockMax ?? 20)
      );
    if (target.type === 'relay') return this.tradeOpen;
    if (isLab(target.type) || target.type === 'fusion_reactor')
      return !target.broken && chestRoom(target, item) > 0;
    return false;
  }

  /** Une tourelle a-t-elle de quoi tirer (balles dans le chargeur en place ou chargeurs en réserve) ? */
  turretReady(m: Machine): boolean {
    const spec = turretSpec(m.type);
    if (spec.ammo === null) return this.powerFactor(m) > 0;
    return m.fuelLeft >= 1 || (m.input?.item === spec.ammo && m.input.count > 0);
  }

  /** Tire une balle de la tourelle (recharge un chargeur au besoin). Renvoie faux sans munitions. */
  turretTake(m: Machine): boolean {
    const spec = turretSpec(m.type);
    if (spec.ammo === null) return this.powerFactor(m) > 0;
    if (m.fuelLeft < 1) {
      if (m.input?.item !== spec.ammo || m.input.count <= 0) return false;
      m.input.count--;
      if (m.input.count <= 0) m.input = null;
      m.fuelLeft = spec.rounds;
    }
    m.fuelLeft -= 1;
    return true;
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
    if (isSmith(target.type)) {
      if (recipeOf(target)?.[item]) return 'ingredientFull';
      if (recipeById(target.recipe)?.mould === item) return 'mouldFull';
      if (!itemById(item).energyMJ) return recipeOf(target) ? 'notIngredient' : 'noRecipe';
      return dir === (target.rot + 2) % 4 ? 'outputFace' : 'fuelFull';
    }
    if (target.type === 'generator' || isDrill(target.type)) {
      if (!machineDef(target.type).fuel || !itemById(item).energyMJ) return 'notUsable';
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
    else if (target.type === 'relay') this.sold.set(item, (this.sold.get(item) ?? 0) + 1);
    else if (isLab(target.type) || target.type === 'fusion_reactor') chestPut(target, item, 1);
    else if (isTurret(target.type) || target.type === 'fission_reactor') {
      if (target.input) target.input.count++;
      else target.input = { item, count: 1 };
    } else if (isAssembler(target.type)) {
      const stack = target.slots.find((x) => x.item === item);
      if (stack) stack.count++;
      else target.slots.push({ item, count: 1 });
    } else if (isSmith(target.type)) {
      const where = this.smithSlot(target, item, dir);
      if (where === 'ingredient') {
        const stack = target.slots.find((x) => x.item === item);
        if (stack) stack.count++;
        else target.slots.push({ item, count: 1 });
      } else if (where === 'mould') {
        if (target.input) target.input.count++;
        else target.input = { item, count: 1 };
      } else this.addFuel(target, item);
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
    const e = Math.min(1, Math.max(0, (fluidLevel(m, 'steam') - 0.2) / 0.4));
    return e < 0.01 ? 0 : e;
  }

  turbineKw(m: Machine): number {
    return (machineDef('turbine').producesKw ?? 0) * this.turbineEfficiency(m);
  }

  private tickTurbine(m: Machine, dt: number): void {
    const g = this.gridInfo(m);
    const e = this.turbineEfficiency(m);
    if (!g || g.blackout || g.demandKw <= 0 || g.capacityKw <= 0 || e <= 0) return;
    const load = Math.min(1, g.demandKw / g.capacityKw);
    m.fluid.steam = Math.max(
      0,
      m.fluid.steam - (machineDef('turbine').steamUse ?? 20) * dt * e * load,
    );
  }

  /** Chevalet de pompage : 1 L de pétrole par seconde, tiré du gisement (fini) sous son emprise. */
  private tickPumpjack(m: Machine, dt: number): void {
    const def = machineDef('pumpjack');
    const speed = this.powerFactor(m);
    if (speed <= 0 || m.fluid.oil >= (def.fluidCap ?? 200) - 0.01) return;
    const cell = this.oilCell(m);
    if (!cell) return;
    m.progress += dt * speed * (def.pumpRate ?? 1);
    while (m.progress >= 1 && m.fluid.oil < (def.fluidCap ?? 200)) {
      if (this.world.mineOre(cell.gx, cell.gz, 1) <= 0) {
        m.progress = 0;
        return;
      }
      m.progress -= 1;
      m.fluid.oil += 1;
    }
  }

  /** Pression d'huile minimale (bar) pour que la raffinerie travaille. */
  static readonly REFINERY_MIN_BAR = 8;

  private refineryReady(m: Machine): boolean {
    const def = machineDef('refinery');
    return (
      m.pressure >= Factory.REFINERY_MIN_BAR &&
      m.fluid.oil > 0.5 &&
      m.fluid.polymer < (def.fluidCap ?? 200) - 0.5
    );
  }

  /** Raffinerie : le pétrole sous haute pression devient du polymère liquide (1 L pour 1 L). */
  private tickRefinery(m: Machine, dt: number): void {
    const def = machineDef('refinery');
    if (!this.refineryReady(m)) return;
    const speed = this.powerFactor(m);
    if (speed <= 0) return;
    const moved = Math.min(
      (def.pumpRate ?? 10) * dt * speed,
      m.fluid.oil,
      (def.fluidCap ?? 200) - m.fluid.polymer,
    );
    m.fluid.oil -= moved;
    m.fluid.polymer += moved;
  }

  /** Pression d'eau minimale (bar) du réacteur, eau consommée (L/s), durée d'une barre (s), tolérance de surchauffe (s). */
  static readonly REACTOR_MIN_BAR = 12;
  static readonly REACTOR_WATER_LPS = 20;
  static readonly ROD_SECONDS = 120;
  static readonly OVERHEAT_S = 5;

  /** Le réacteur produit-il du courant en ce moment (barre en cours, pas en panne) ? */
  reactorRunning(m: Machine): boolean {
    return !m.broken && m.progress > 0;
  }

  /**
   * Réacteur à fission : une barre d'uranium dure 2 minutes ; tant qu'elle brûle, il faut de l'eau sous haute pression
   * (consommée, rejetée contaminée) et de la place pour les rejets. Sinon il surchauffe et tombe en panne.
   * Une barre usée donne un déchet nucléaire solide (case de sortie, évacuée par tapis).
   */
  private tickReactor(m: Machine, dt: number): void {
    const def = machineDef('fission_reactor');
    if (m.broken) return;
    this.pushOutput(m);
    // Une barre ne s'allume que si le refroidissement est prêt (réserve d'eau et pression suffisantes).
    const ready =
      m.fluid.water >= 2 * Factory.REACTOR_WATER_LPS && m.pressure >= Factory.REACTOR_MIN_BAR;
    if (m.progress <= 0 && m.input && m.input.count > 0 && ready) {
      m.input.count--;
      if (m.input.count <= 0) m.input = null;
      m.progress = Factory.ROD_SECONDS;
    }
    if (m.progress <= 0) {
      m.fuelLeft = 0;
      return;
    }
    const need = Factory.REACTOR_WATER_LPS * dt;
    const cap = def.fluidCap ?? 200;
    const cooled =
      m.fluid.water >= need && m.pressure >= Factory.REACTOR_MIN_BAR && m.fluid.dirty + need <= cap;
    if (cooled) {
      m.fluid.water -= need;
      m.fluid.dirty += need;
      m.fuelLeft = Math.max(0, m.fuelLeft - dt);
    } else m.fuelLeft += dt; // `fuelLeft` compte ici les secondes de surchauffe
    const wasteFull = !!m.stock && m.stock.count >= (def.stockMax ?? 20);
    m.progress -= dt;
    if (m.progress <= 0) {
      m.progress = 0;
      if (wasteFull) m.fuelLeft += Factory.OVERHEAT_S;
      else if (m.stock) m.stock.count++;
      else m.stock = { item: 'nuclear_waste', count: 1 };
      this.made.set('nuclear_waste', (this.made.get('nuclear_waste') ?? 0) + 1);
    }
    if (m.fuelLeft >= Factory.OVERHEAT_S) {
      m.broken = true;
      m.progress = 0;
      m.fuelLeft = 0;
    }
  }

  /** Tour d'évaporation : l'eau contaminée part en vapeur violette toxique (sans énergie). */
  private tickEvaporator(m: Machine, dt: number): void {
    const def = machineDef('evaporation_tower');
    m.fluid.dirty = Math.max(0, m.fluid.dirty - (def.coolRate ?? 20) * dt);
  }

  /** La tour d'évaporation rejette-t-elle de la vapeur toxique en ce moment ? */
  evaporating(m: Machine): boolean {
    return m.type === 'evaporation_tower' && m.fluid.dirty > 0.5;
  }

  /** Première case de pétrole sous le chevalet. */
  private oilCell(m: Machine): Cell | null {
    for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
      const ore = this.world.oreAt(c.gx, c.gz);
      if (ore && ore.item === 'crude_oil' && ore.amount > 0) return c;
    }
    return null;
  }

  private tickPump(m: Machine, dt: number): void {
    const def = machineDef('pump');
    if (!this.pumpsOk.has(m.id)) return;
    // Sans courant la pompe tourne au ralenti (amorçage à la main) : sinon, pas d'eau, donc pas de vapeur, donc
    // jamais de courant pour la faire tourner quand on n'a que des turbines.
    const speed = Math.max(PUMP_BACKUP, this.powerFactor(m));
    m.fluid.water = Math.min(
      def.fluidCap ?? 100,
      m.fluid.water + (def.pumpRate ?? 100) * dt * speed,
    );
  }

  /**
   * Refroidissement actif : une machine qui a de l'eau froide et de la place pour rejeter l'eau chaude gagne le
   * bonus de vitesse (+50 % pour le constructeur) ; l'eau est consommée et ressort chaude.
   */
  private coolingFactor(m: Machine, dt: number): number {
    const def = machineDef(m.type);
    if (!def.coolBoost || !def.coolLitersPerS) return 1;
    const use = def.coolLitersPerS * dt;
    if (m.fluid.water < use || (def.fluidCap ?? 100) - m.fluid.hot < use) return 1;
    m.fluid.water -= use;
    m.fluid.hot += use;
    return 1 + def.coolBoost;
  }

  /** Tour de refroidissement : l'eau chaude qui arrive ressort froide, sans énergie. */
  private tickCooler(m: Machine, dt: number): void {
    const def = machineDef(m.type);
    const moved = Math.min(
      (def.coolRate ?? 20) * dt,
      m.fluid.hot,
      (def.fluidCap ?? 200) - m.fluid.water,
    );
    if (moved <= 0) return;
    m.fluid.hot -= moved;
    m.fluid.water += moved;
  }

  /** Chaudière : transforme l'eau en vapeur tant qu'il y a du combustible et de la place pour la vapeur. */
  private tickBoiler(m: Machine, dt: number): void {
    const def = machineDef('boiler');
    const rate = def.boilRate ?? 60;
    const room = (def.fluidCap ?? 200) - m.fluid.steam;
    // L'eau chaude (rejetée par le refroidissement des machines) passe d'abord : elle coûte moitié moins de combustible.
    const hot = Math.min(rate * dt, m.fluid.hot, room);
    const cold = Math.min(rate * dt - hot, m.fluid.water, room - hot);
    const want = hot + cold;
    if (want <= 1e-6 || !this.fire(m)) return;
    m.fluid.hot -= hot;
    m.fluid.water -= cold;
    m.fluid.steam += want;
    this.burn(m, dt * ((cold + hot * HOT_WATER_FUEL) / (rate * dt)));
  }

  /** Laboratoire : a-t-il des paquets et une étude à mener ? */
  private labWorking(m: Machine): boolean {
    return this.labDemand > 0 && this.usablePack(m) !== null;
  }

  /** Premier emplacement dont les paquets servent à l'étude en cours. */
  private usablePack(m: Machine): Stack | null {
    return (
      m.slots.find(
        (s) => s.count > 0 && (this.labNeeds === null || (this.labNeeds[s.item] ?? 0) > 0),
      ) ?? null
    );
  }

  /** Le laboratoire a-t-il au moins un paquet dans l'un de ses emplacements ? */
  hasPacks(m: Machine): boolean {
    return m.slots.some((s) => s.count > 0);
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
    const stack = this.usablePack(m);
    if (!stack) return;
    const item = stack.item;
    stack.count--;
    if (stack.count <= 0) m.slots.splice(m.slots.indexOf(stack), 1);
    this.labDemand--;
    if (this.labNeeds) this.labNeeds[item] = (this.labNeeds[item] ?? 0) - 1;
    this.labDone[item] = (this.labDone[item] ?? 0) + 1;
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
    return (
      !m.stock || (m.stock.item === m.recipe && m.stock.count + itemById(m.recipe).yield <= max)
    );
  }

  private tickAssembler(m: Machine, dt: number): void {
    this.pushOutput(m);
    if (this.resting(m, dt)) return;
    const need = recipeOf(m);
    const speed = this.powerFactor(m);
    if (!need || !m.recipe || !this.canCraft(m) || speed <= 0) {
      if (!this.canCraft(m)) m.progress = 0;
      return;
    }
    m.progress += dt * speed;
    const seconds = machineDef(m.type).craftSeconds ?? 2;
    if (m.progress < seconds) return;
    m.progress = 0;
    this.rest.set(m.id, Factory.CYCLE_REST_S);
    for (const [item, n] of Object.entries(need)) {
      const stack = m.slots.find((x) => x.item === item);
      if (!stack) continue;
      stack.count -= n;
      if (stack.count <= 0) m.slots.splice(m.slots.indexOf(stack), 1);
    }
    const per = itemById(m.recipe).yield;
    if (m.stock) m.stock.count += per;
    else m.stock = { item: m.recipe, count: per };
    this.made.set(m.recipe, (this.made.get(m.recipe) ?? 0) + per);
  }

  /** Où va cet objet dans un fourneau / une estampeuse : ingrédient de la recette, moule, ou combustible (null = refusé). */
  private smithSlot(m: Machine, item: string, dir: number): 'ingredient' | 'mould' | 'fuel' | null {
    if (recipeOf(m)?.[item] && this.ingredientRoom(m, item)) return 'ingredient';
    const mould = recipeById(m.recipe)?.mould;
    if (mould === item) {
      const max = machineDef(m.type).stockMax ?? 100;
      return !m.input || (m.input.item === item && m.input.count < Math.min(max, 20))
        ? 'mould'
        : null;
    }
    // Combustible : par n'importe quelle face sauf la sortie.
    return dir !== (m.rot + 2) % 4 && this.fuelRoom(m, item) ? 'fuel' : null;
  }

  private addFuel(target: Machine, item: string): void {
    if (target.fuel) target.fuel.count++;
    else target.fuel = { item, count: 1 };
  }

  private fuelRoom(target: Machine, item: string): boolean {
    if (!machineDef(target.type).fuel || !itemById(item).energyMJ) return false;
    const max = machineDef(target.type).stockMax ?? 100;
    return !target.fuel || (target.fuel.item === item && target.fuel.count < max);
  }

  /** Foreuse / fourneau : pousse un objet du stock vers la case de sortie. */
  private pushOutput(m: Machine): void {
    // Produit puis sous-produit : un objet par pas, par la même face de sortie.
    for (const key of ['stock', 'extra'] as const) {
      const stack = m[key];
      if (!stack || stack.count <= 0) continue;
      // Toute machine qui touche le côté de sortie convient (pas seulement celle de la case du milieu).
      for (const target of this.neighbors(m, m.rot)) {
        if (this.deliver(target, m, stack.item)) {
          stack.count--;
          if (stack.count <= 0) m[key] = null;
          return;
        }
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
    const multi = m.type === 'splitter' || m.type === 'sorter';
    // Le trieur est électrique : sans courant il n'aiguille rien.
    if (m.type === 'sorter' && this.powerFactor(m) <= 0) return;
    const outs = multi ? [front, (front + 1) % 4, (front + 3) % 4] : [front];
    for (let i = 0; i < outs.length; i++) {
      const k = multi ? (Math.floor(m.progress) + i) % 3 : 0;
      const dir = outs[k];
      // Trieur : chaque sortie a son filtre (devant, gauche, droite).
      if (m.type === 'sorter' && !filterPasses(m.filters[k], m.stock!.item)) continue;
      const target = this.neighbors(m, dir).find((t) => this.deliver(t, m, m.stock!.item, dir));
      if (!target) continue;
      m.stock = null;
      if (multi) m.progress = (k + 1) % 3;
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
          itemById(f.item).energyMJ && (!m.fuel || (m.fuel.item === f.item && m.fuel.count < max)),
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
        const found = this.peekSources(src).find(
          (f) =>
            filterPasses(m.filters[0], f.item) &&
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
          if (!filterPasses(m.filters[0], f.item)) continue;
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
    if (m.broken) return;
    // Une pente à 45° est plus longue qu'une tuile plate (√2) : on y avance moins vite.
    const slope = liftStart(m) !== liftEnd(m) ? Math.SQRT1_2 : 1;
    const speed = beltSpeed(m.tier) * slope;
    for (let i = 0; i < m.belt.length; i++) {
      const limit = i === 0 ? 1 : m.belt[i - 1].pos - GAP;
      m.belt[i].pos = Math.min(limit, m.belt[i].pos + speed * dt);
    }
    const front = m.belt[0];
    if (front && front.pos >= 1 && m.lift === 4) {
      // Tunnel : l'objet entre et ressort à l'autre bout après le temps du trajet.
      const out = this.tunnelTarget(m);
      const last = out?.belt[out.belt.length - 1];
      const cap = machineDef('conveyor').capacity ?? 3;
      const tiles = out ? Math.max(Math.abs(out.gx - m.gx), Math.abs(out.gz - m.gz)) / 2 : 0;
      // Les objets en route sous terre ne comptent pas dans la place du tapis de sortie ; ils gardent leur écart.
      if (
        out &&
        out.belt.filter((b) => b.pos >= 0).length < cap &&
        !(last && last.pos < GAP - tiles)
      ) {
        out.belt.push({ item: front.item, pos: -tiles });
        m.belt.shift();
      }
    } else if (front && front.pos >= 1) {
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
    // En l'air : tapis surélevés (niveaux 1 et 2), rampes, machines posées à l'étage.
    if (y >= levelY(1) - 0.4) {
      const one = factory.machineAt(gx, gz, 1);
      if (one && y <= (one.lift === 6 ? levelY(2) + 0.3 : levelY(1) + 0.3))
        return { machine: one, t };
      const two = factory.machineAt(gx, gz, 2);
      if (two) {
        const floor = levelY(2);
        const ok =
          two.type !== 'conveyor'
            ? y >= floor && y <= floor + visualHeight(two.type)
            : two.lift === 7
              ? y >= floor - 0.15 && y <= floor + 0.3
              : y <= floor + 0.3;
        if (ok) {
          if (two.type === 'pole') {
            const c = centerOf(two);
            if (Math.hypot(px - c.x, pz - c.z) > POLE_HIT_M) continue;
          }
          return { machine: two, t };
        }
      }
    }
    const m = factory.machineAt(gx, gz);
    const top =
      m && m.type === 'conveyor' && m.lift !== 0
        ? levelY(Math.max(LIFTS[m.lift].from, LIFTS[m.lift].to)) + 0.15
        : m
          ? visualHeight(m.type)
          : 0;
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
