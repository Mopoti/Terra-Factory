import raw from '../../../content/machines.json';

export type MachineType =
  | 'drill'
  | 'drill_electric'
  | 'furnace'
  | 'conveyor'
  | 'chest_wood'
  | 'chest_iron'
  | 'generator'
  | 'pole'
  | 'splitter'
  | 'merger'
  | 'arm'
  | 'arm_electric'
  | 'assembler';

export interface MachineDef {
  id: MachineType;
  /** Emprise en cases de 50 cm, orientation 0 (largeur x profondeur). */
  w: number;
  d: number;
  /** Objet du sac consommé à la pose et rendu (en ressources de fabrication) à la démolition. */
  item: string;
  color: string;
  /** Hauteur (m), pour viser la machine. */
  height: number;
  /** Brûle du combustible pour fonctionner. */
  fuel: boolean;
  burnPerSecond?: number;
  /** Foreuse : secondes par minerai extrait. */
  mineSeconds?: number;
  /** Capacité de la case de stockage. */
  stockMax?: number;
  /** Puissance consommée (kW) quand la machine travaille. */
  consumesKw?: number;
  /** Puissance produite (kW) à pleine charge. */
  producesKw?: number;
  /** Poteau : portée du fil vers un autre poteau (m) et vers une machine (m, bord de la machine). */
  wireReachM?: number;
  linkReachM?: number;
  /** Assembleur : secondes par objet fabriqué (à pleine puissance). */
  craftSeconds?: number;
  /** Bras robotique : durée d'un aller-retour (s). */
  swingSeconds?: number;
  /** Coffre : nombre de cases (une pile de 100 au plus par case). */
  slots?: number;
  /** Tapis : cases par seconde et nombre d'objets portés par case. */
  cellsPerSecond?: number;
  capacity?: number;
}

export interface SmeltRecipe {
  in: string;
  out: string;
  seconds: number;
}

export const isDrill = (type: MachineType): boolean =>
  type === 'drill' || type === 'drill_electric';

/** A une case de sortie (pousse son stock devant elle). */
export const hasOutput = (type: MachineType): boolean =>
  isDrill(type) || type === 'furnace' || type === 'assembler';

/** Assembleur : fabrique un objet à partir d'ingrédients amenés par tapis ou bras. */
export const isAssembler = (type: MachineType): boolean => type === 'assembler';

/** Séparateur (1 entrée, 3 sorties) ou groupeur (3 entrées, 1 sortie) : aiguille les objets d'un tapis à l'autre. */
export const isRouter = (type: MachineType): boolean => type === 'splitter' || type === 'merger';

/** Bras robotique (à combustible ou électrique). */
export const isArm = (type: MachineType): boolean => type === 'arm' || type === 'arm_electric';

export const isChest = (type: MachineType): boolean =>
  type === 'chest_wood' || type === 'chest_iron';

export const MACHINES: MachineDef[] = raw.machines as MachineDef[];
export const SMELTING: SmeltRecipe[] = raw.smelting;

export function machineDef(type: MachineType): MachineDef {
  const def = MACHINES.find((m) => m.id === type);
  if (!def) throw new Error(`Machine inconnue : ${type}`);
  return def;
}

/** Quelle machine correspond à cet objet du sac, s'il en est une. */
export const machineForItem = (item: string | null): MachineDef | null =>
  MACHINES.find((m) => m.item === item) ?? null;

export const smeltRecipe = (input: string): SmeltRecipe | null =>
  SMELTING.find((r) => r.in === input) ?? null;
