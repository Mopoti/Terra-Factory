/**
 * Matériel roulant : locomotive à vapeur et wagons (modèles de `blender/scripts/ferroviaire.py`). Les nombres sont ceux
 * de petites machines de voie normale (écartement 1,5 m, comme la voie posée) : masses en kg, efforts en N, puissances en kW.
 */
import type { RailKind } from '../rail/track';

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
  /**
   * Longueur d'attelage à attelage (m) : deux véhicules attelés se touchent par la tête de leurs attelages
   * automatiques, toujours à la même distance (en courbe comme en ligne droite).
   */
  lengthM: number;
  /** Du centre (milieu des essieux, origine du modèle) au point d'attelage avant (m) ; l'arrière est à `lengthM - frontM`. */
  frontM: number;
  /** Du centre aux bouts de la caisse sans les attelages (tampons, traverses de tête), avant et arrière (m). */
  bodyM: { front: number; rear: number };
  /** Demi-empattement (m) : distance du centre à chaque essieu / bogie, pour suivre les courbes. */
  halfBaseM: number;
  massKg: number;
  loco?: LocoSpec;
}

export const CARS: Record<CarKind, CarSpec> = {
  locomotive_steam: {
    item: 'train_locomotive',
    model: 'locomotive_vapeur',
    // Tampons à l'avant (3,6 m du centre), attelage automatique de 1,1 m à l'arrière (traverse à 2,8 m).
    lengthM: 7.5,
    frontM: 3.6,
    bodyM: { front: 3.6, rear: 2.85 },
    halfBaseM: 1.5,
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
    // Caisse de 5 m (traverses de tête à 2,5 m du centre), attelage automatique de 0,8 m à chaque bout.
    lengthM: 6.6,
    frontM: 3.3,
    bodyM: { front: 2.55, rear: 2.55 },
    halfBaseM: 1.7,
    massKg: 9000,
  },
  wagon_tanker: {
    item: 'train_wagon_tanker',
    model: 'wagon_citerne',
    // Caisse de 5 m (traverses de tête à 2,5 m du centre), attelage automatique de 0,8 m à chaque bout.
    lengthM: 6.6,
    frontM: 3.3,
    bodyM: { front: 2.55, rear: 2.55 },
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
/**
 * Rails consommés par chaque forme de pièce (un rail ≈ 2,5 m de voie) : virage serré (5,9 m) 3, large (9,8 m) 4, très
 * large (13,7 m) 6, rampe (10 m) 4, aiguillage (ses deux voies et ses lames) 6.
 */
export const RAIL_COST: Record<RailKind, number> = {
  straight: 1,
  curve: 3,
  curve_wide: 4,
  curve_large: 6,
  ramp: 4,
  switch_r: 6,
  switch_l: 6,
};

/** Identifiants (négatifs) de la fenêtre d'une locomotive : −(base + identifiant du véhicule), hors de ceux des buggys. */
export const LOCO_WINDOW_BASE = 1_000_000;
export const locoWindowId = (carId: number): number => -(LOCO_WINDOW_BASE + carId);
export const isLocoWindow = (id: number): boolean => id <= -LOCO_WINDOW_BASE;
export const carIdOfWindow = (id: number): number => -id - LOCO_WINDOW_BASE;
