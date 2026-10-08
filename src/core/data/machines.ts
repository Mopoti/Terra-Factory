import raw from '../../../content/machines.json';

export type MachineType =
  | 'drill'
  | 'drill_electric'
  | 'drill_eco'
  | 'furnace'
  | 'stamper'
  | 'crusher'
  | 'bessemer'
  | 'mixer'
  | 'barreler'
  | 'booster'
  | 'builder'
  | 'heavy_press'
  | 'washer'
  | 'conveyor'
  | 'chest_wood'
  | 'chest_iron'
  | 'generator'
  | 'waterwheel'
  | 'pole'
  | 'crank'
  | 'splitter'
  | 'sorter'
  | 'merger'
  | 'arm'
  | 'arm_electric'
  | 'arm_filter'
  | 'assembler'
  | 'lab'
  | 'turret'
  | 'pipe'
  | 'pump'
  | 'boiler'
  | 'turbine';

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
  /** Combustible : puissance brûlée à pleine charge (kW = kJ/s), dans la même unité que l'énergie des objets. */
  burnKw?: number;
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
  /** Pollution émise (points par seconde) quand la machine travaille. */
  pollution?: number;
  /** Fumées (air : se répandent, les arbres les absorbent) ou pollution du sol (reste sur place). */
  pollutionKind?: 'air' | 'ground';
  /** Fluides : capacité de la machine (unités). */
  fluidCap?: number;
  /** Pression de départ (bar) d'une pompe (eau) ou d'une chaudière (vapeur). */
  startBar?: number;
  /** Surpresseur : pression ajoutée (bar) à sa sortie. */
  boostBar?: number;
  /** Tuyaux : pression maximale (bar) et perte de charge (bar par tuile) à chaque palier. */
  tierMaxBar?: number[];
  tierFrictionBar?: number[];
  /** Pompe : eau pompée (unités/s) à pleine puissance. */
  pumpRate?: number;
  /** Chaudière : eau transformée en vapeur (unités/s) à pleine chauffe. */
  boilRate?: number;
  /** Turbine : vapeur consommée (unités/s) à pleine charge. */
  steamUse?: number;
  /** Assembleur : secondes par objet fabriqué (à pleine puissance). */
  craftSeconds?: number;
  /** Bras robotique : durée d'un aller-retour (s). */
  swingSeconds?: number;
  /** Coffre : nombre de cases (une pile de 100 au plus par case). */
  slots?: number;
  /** Tapis : cases par seconde et nombre d'objets portés par case. */
  cellsPerSecond?: number;
  /** Tapis : un objet du sac par palier (T1, T2, T3), avec sa vitesse (cases/s) et sa couleur. */
  tierItems?: string[];
  tierSpeeds?: number[];
  tierColors?: string[];
  capacity?: number;
}

export const isDrill = (type: MachineType): boolean =>
  type === 'drill' || type === 'drill_electric' || type === 'drill_eco';

/** A une case de sortie (pousse son stock devant elle). */
export const hasOutput = (type: MachineType): boolean =>
  isDrill(type) || isSmith(type) || type === 'assembler';

/** Fourneau ou estampeuse : machine à combustible dont la recette (de `recipes.json`) se choisit dans la fenêtre. */
export const isSmith = (type: MachineType): boolean =>
  type === 'furnace' ||
  type === 'stamper' ||
  type === 'crusher' ||
  type === 'bessemer' ||
  type === 'mixer' ||
  type === 'barreler' ||
  type === 'builder' ||
  type === 'heavy_press' ||
  type === 'washer';

/** Assembleur : fabrique un objet à partir d'ingrédients amenés par tapis ou bras. */
export const isAssembler = (type: MachineType): boolean => type === 'assembler';

/** Séparateur (1 entrée, 3 sorties) ou groupeur (3 entrées, 1 sortie) : aiguille les objets d'un tapis à l'autre. */
export const isRouter = (type: MachineType): boolean =>
  type === 'splitter' || type === 'merger' || type === 'sorter';

/** Machine à filtres (liste blanche ou noire d'objets) : le bras filtrant (1 filtre) et le trieur (1 par sortie). */
export const filterCount = (type: MachineType): number =>
  type === 'arm_filter' ? 1 : type === 'sorter' ? 3 : 0;

/** Bras robotique (à combustible ou électrique). */
export const isArm = (type: MachineType): boolean =>
  type === 'arm' || type === 'arm_electric' || type === 'arm_filter';

/** Laboratoire : consomme des paquets de science pour étudier la technologie choisie. */
export const isLab = (type: MachineType): boolean => type === 'lab';

/** Tourelle automatique : tire sur les ennemis proches avec des chargeurs. */
export const isTurret = (type: MachineType): boolean => type === 'turret';
/** Balles par chargeur dans une tourelle, portée (m), dégâts par balle, secondes entre deux tirs. */
export const TURRET_ROUNDS = 12;
export const TURRET_RANGE_M = 22;
export const TURRET_DAMAGE = 9;
export const TURRET_EVERY_S = 0.6;

/** Machine du réseau de fluides (tuyau, pompe, chaudière, turbine). */
export const isFluid = (type: MachineType): boolean =>
  type === 'pipe' ||
  type === 'pump' ||
  type === 'boiler' ||
  type === 'turbine' ||
  type === 'barreler' ||
  type === 'washer' ||
  type === 'booster';

/** Élément qu'on pose en traçant un chemin (tapis, tuyau). */
export const isLinear = (type: MachineType): boolean => type === 'conveyor' || type === 'pipe';

/** La machine a une fenêtre d'interface (touche F) : ni tapis, séparateur, groupeur, poteau, ni éléments à fluide sauf la chaudière. */
export const hasWindow = (type: MachineType): boolean =>
  !(
    type === 'conveyor' ||
    type === 'splitter' ||
    type === 'merger' ||
    type === 'pole' ||
    type === 'pipe' ||
    type === 'pump' ||
    type === 'booster' ||
    type === 'turbine'
  );

/** Les machines (sauf les tapis) sont dessinées 10 cm plus larges, plus longues et plus hautes que leur emprise. */
export const GROW_M = 0.1;

/** Hauteur dessinée (et visée) d'une machine. */
export const visualHeight = (type: MachineType): number =>
  type === 'conveyor' ? machineDef(type).height : machineDef(type).height + GROW_M;

export const isChest = (type: MachineType): boolean =>
  type === 'chest_wood' || type === 'chest_iron';

export const MACHINES: MachineDef[] = raw.machines as MachineDef[];

export function machineDef(type: MachineType): MachineDef {
  const def = MACHINES.find((m) => m.id === type);
  if (!def) throw new Error(`Machine inconnue : ${type}`);
  return def;
}

/** Quelle machine correspond à cet objet du sac, s'il en est une. */
export const machineForItem = (item: string | null): MachineDef | null =>
  MACHINES.find((m) => m.item === item || (!!item && !!m.tierItems?.includes(item))) ?? null;

/** Palier (1 à 3) d'un objet-machine : les tapis ont un objet par palier, les autres machines un seul. */
export const tierOfItem = (item: string | null): number => {
  const def = machineForItem(item);
  const i = def?.tierItems?.indexOf(item ?? '') ?? -1;
  return i >= 0 ? i + 1 : 1;
};

/** Objet du sac d'une machine à un palier donné. */
export const itemOfTier = (def: MachineDef, tier: number): string =>
  def.tierItems?.[tier - 1] ?? def.item;

/** Vitesse d'un tapis (cases/s) au palier donné. */
export const beltSpeed = (tier: number): number =>
  machineDef('conveyor').tierSpeeds?.[tier - 1] ?? machineDef('conveyor').cellsPerSecond ?? 0.75;
