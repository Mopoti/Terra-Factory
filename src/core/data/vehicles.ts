/** Les véhicules que le joueur conduit : buggy, quad et char (modèles dans `blender/scripts/vehicules.py`), et la charrette à bras qu'il pousse. */
export const VEHICLE_KINDS = ['buggy', 'quad', 'tank', 'van', 'cart'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export interface VehicleSpec {
  /** Objet du sac qui pose ce véhicule. */
  item: string;
  /** Nom du modèle (fichier `public/models/terra/<model>.glb`). */
  model: string;
  /** Vitesse au volant, en multiples de la marche. */
  speedFactor: number;
  /** Puissance brûlée au volant (kW) : un charbon (9 MJ) dure 9000 / burnKw secondes. */
  burnKw: number;
  /** Rayon (m) et dégâts de l'écrasement des ennemis sur la route. */
  runOver: { radius: number; damage: number };
  /** Rayon (m) de la sphère de visée autour du centre du véhicule, à `aimHeight` du sol. */
  aimRadius: number;
  aimHeight: number;
  /** Largeur du véhicule (m) : sert à dimensionner les portes de garage. */
  widthM: number;
  /** Véhicule qu'on pousse à pied devant soi (charrette) : sans carburant, sans siège, il suit le joueur. */
  pushed?: boolean;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  buggy: {
    item: 'vehicle_buggy',
    model: 'buggy',
    speedFactor: 2.6,
    burnKw: 180,
    runOver: { radius: 1.8, damage: 20 },
    aimRadius: 1.3,
    aimHeight: 0.7,
    widthM: 1.7,
  },
  // Léger et sobre : un peu plus vite que le buggy, qui consomme moins.
  quad: {
    item: 'vehicle_quad',
    model: 'quad',
    speedFactor: 3.1,
    burnKw: 110,
    runOver: { radius: 1.4, damage: 14 },
    aimRadius: 1.0,
    aimHeight: 0.55,
    widthM: 1.25,
  },
  // Lourd et gourmand : lent, mais il écrase tout sur son passage.
  tank: {
    item: 'vehicle_tank',
    model: 'tank',
    speedFactor: 1.8,
    burnKw: 450,
    runOver: { radius: 2.6, damage: 80 },
    aimRadius: 2.0,
    aimHeight: 1.0,
    widthM: 2.5,
  },
  // Camionnette : même palier que le char, plus rapide que lui, avec un grand coffre (32 cases).
  van: {
    item: 'vehicle_van',
    model: 'camionnette',
    speedFactor: 2.2,
    burnKw: 300,
    runOver: { radius: 2.0, damage: 35 },
    aimRadius: 1.6,
    aimHeight: 0.9,
    widthM: 1.7,
  },
  // Charrette à bras en bois, roues en bois (pas de caoutchouc au début) : plus lente que la marche, sans moteur.
  cart: {
    item: 'vehicle_cart',
    model: 'charrette',
    speedFactor: 0.8,
    burnKw: 0,
    runOver: { radius: 0, damage: 0 },
    aimRadius: 0.9,
    aimHeight: 0.5,
    widthM: 1.1,
    pushed: true,
  },
};

export const isVehicleKind = (x: unknown): x is VehicleKind =>
  typeof x === 'string' && (VEHICLE_KINDS as readonly string[]).includes(x);

/** Le type de véhicule que pose cet objet du sac, ou null. */
export const vehicleKindOfItem = (item: string): VehicleKind | null =>
  VEHICLE_KINDS.find((k) => VEHICLES[k].item === item) ?? null;

/** Largeur (m) du plus large des véhicules : une porte de garage fait cette largeur plus 2 cases (1 m). */
export const WIDEST_VEHICLE_M = Math.max(...VEHICLE_KINDS.map((k) => VEHICLES[k].widthM));
