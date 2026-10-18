/**
 * Matériel roulant : locomotive à vapeur et wagons (modèles de `blender/scripts/ferroviaire.py`). Les nombres sont ceux
 * d'une voie étroite industrielle, ramenés à l'échelle du jeu : masses en kg, efforts en N, puissances en kW.
 */
export const CAR_KINDS = ['locomotive_steam', 'wagon_freight', 'wagon_tanker'] as const;
export type CarKind = (typeof CAR_KINDS)[number];

export interface LocoSpec {
  /** Puissance à la jante (kW) : l'effort de traction vaut puissance / vitesse, plafonné à l'adhérence. */
  powerKw: number;
  /** Effort maximal au démarrage (N), limité par l'adhérence des roues motrices. */
  startEffortN: number;
  /** Vitesse maximale (m/s). */
  vMax: number;
  /** Combustible brûlé à vide (pression maintenue) et à pleine puissance (kW). */
  idleBurnKw: number;
  fullBurnKw: number;
}

export interface CarSpec {
  /** Objet du sac qui pose ce véhicule sur la voie. */
  item: string;
  /** Fichier du modèle (`public/models/terra/<model>.glb`). */
  model: string;
  /** Longueur d'attelage à attelage (m) : deux wagons attelés se touchent par leurs tampons. */
  lengthM: number;
  /** Demi-empattement (m) : distance du centre à chaque essieu / bogie, pour suivre les courbes. */
  halfBaseM: number;
  massKg: number;
  loco?: LocoSpec;
}

export const CARS: Record<CarKind, CarSpec> = {
  locomotive_steam: {
    item: 'train_locomotive',
    model: 'locomotive_vapeur',
    lengthM: 6.45,
    halfBaseM: 2.17,
    massKg: 22000,
    loco: {
      powerKw: 140,
      startEffortN: 36000,
      vMax: 12,
      idleBurnKw: 35,
      fullBurnKw: 650,
    },
  },
  wagon_freight: {
    item: 'train_wagon_freight',
    model: 'wagon_fret',
    lengthM: 5.4,
    halfBaseM: 1.7,
    massKg: 9000,
  },
  wagon_tanker: {
    item: 'train_wagon_tanker',
    model: 'wagon_citerne',
    lengthM: 5.4,
    halfBaseM: 1.7,
    massKg: 9500,
  },
};

export const isCarKind = (x: unknown): x is CarKind =>
  typeof x === 'string' && (CAR_KINDS as readonly string[]).includes(x);

export const carKindOfItem = (item: string): CarKind | null =>
  CAR_KINDS.find((k) => CARS[k].item === item) ?? null;

/** Objet du sac qui pose la voie : 1 rail = 1 m de voie (une tuile droite). */
export const RAIL_ITEM = 'rail';
/** Rails consommés par chaque forme de pièce : le virage (2,4 m) en vaut 3, la rampe (4 m) en vaut 4. */
export const RAIL_COST = { straight: 1, curve: 3, ramp: 4 } as const;

/** Identifiants (négatifs) de la fenêtre d'une locomotive : −(base + identifiant du véhicule), hors de ceux des buggys. */
export const LOCO_WINDOW_BASE = 1_000_000;
export const locoWindowId = (carId: number): number => -(LOCO_WINDOW_BASE + carId);
export const isLocoWindow = (id: number): boolean => id <= -LOCO_WINDOW_BASE;
export const carIdOfWindow = (id: number): number => -id - LOCO_WINDOW_BASE;
