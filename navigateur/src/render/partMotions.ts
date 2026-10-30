/**
 * Mouvements des pièces mobiles des modèles maison (voir `blender/ANIMATIONS.md`).
 *
 * Convention du modèle : toutes les pièces dont le nom commence par `<groupe>_` bougent ensemble autour du nœud
 * `pivot_<groupe>` du `.glb` (position = centre de rotation, axe Y local du nœud = axe de rotation ou de glissement).
 * Ce fichier dit, machine par machine, COMMENT chaque groupe bouge ; `models.ts` sort les groupes du corps fixe au
 * chargement et `FactoryView.updateParts` les anime. Tout est ici sans dépendance à three.js, pour être testé.
 *
 * Les durées sont en secondes de marche (le temps ne passe pas quand la machine est arrêtée), les distances en mètres
 * du MODÈLE (le jeu les met à l'échelle de la machine), les angles en radians.
 */
import type { MachineType } from '../core/data/machines';

export type Motion =
  /** Tourne en continu autour de l'axe du pivot (`speed` rad/s, négatif = sens contraire). */
  | { kind: 'spin'; speed: number }
  /** Va-et-vient de rotation, `angle` de chaque côté (ou d'un seul côté si `oneSided`). */
  | { kind: 'swing'; angle: number; period: number; offset?: number; oneSided?: boolean }
  /**
   * Glisse le long de `dir` : `axis` = l'axe du pivot, `up` / `front` = repères du modèle (Y haut, +Z devant).
   * - `pulse` : une bosse par période, entre les parts `from` et `to` de la période (course aller-retour) ;
   * - `loop` : avance régulièrement de `amount` par période puis revient (en boucle, invisible si le motif se répète).
   */
  | {
      kind: 'slide';
      dir: 'axis' | 'up' | 'down' | 'front' | 'back' | 'left' | 'right';
      amount: number;
      period: number;
      shape: 'pulse' | 'loop';
      from?: number;
      to?: number;
    }
  /** Descend tout droit en fin de cycle de travail (comme le piston des presses du kit). */
  | { kind: 'press'; depth: number }
  /** S'ouvre de `angle` (rad) autour de l'axe du pivot tant que la machine « travaille », se referme sinon (couvercle). */
  | { kind: 'open'; angle: number }
  /** Tourne par quarts de tour : `angle` à chaque période, en marquant une pause entre deux. */
  | { kind: 'step'; angle: number; period: number }
  /** Pièce du chevalet de pompage : pose calculée par la cinématique (voir `rockerPose`). */
  | { kind: 'rocker'; role: 'manivelle' | 'balancier' | 'tige' | 'bielle' };

export type GroupMotions = Record<string, Motion & { parent?: string }>;

const TAU = Math.PI * 2;
const spin = (speed: number): Motion => ({ kind: 'spin', speed });
const loop = (amount: number, period: number, dir: 'axis' | 'front' | 'back' = 'axis'): Motion => ({
  kind: 'slide',
  dir,
  amount,
  period,
  shape: 'loop',
});

/** Mouvements par machine (clé : type de machine ; sous-clé : nom du groupe dans le modèle). */
// Constructeur, presse lourde et centrifugeuse : modèles agrandis de ×1,33 pour l'emprise 4 × 4 (courses ×1,33).
export const MOTIONS: Partial<Record<MachineType, GroupMotions>> = {
  drill: {
    foret: spin(-7),
    volant: spin(4),
    poulie_boite: spin(12),
    poulie_tete: spin(2),
  },
  drill_electric: { foret: spin(10) },
  drill_eco: { foret: spin(12), gyrophare: spin(5) },
  pumpjack: {
    manivelle: { kind: 'rocker', role: 'manivelle' },
    balancier: { kind: 'rocker', role: 'balancier' },
    tige: { kind: 'rocker', role: 'tige' },
    bielle: { kind: 'rocker', role: 'bielle' },
  },
  // Estampeuse agrandie de ×1,33 (emprise 4 × 4) : course du marteau et pas des plaques en conséquence.
  stamper: { marteau: { kind: 'press', depth: 0.133 }, sortie: loop(0.21, 3) },
  crusher: {
    volant: spin(2.5),
    rouleau: spin(-2.5),
    moteur: spin(6.5),
    vis: spin(-3),
    gravier: loop(0.06, 0.4),
  },
  mixer: {
    tambour: spin(1.2),
    pignon: spin(-6),
    tiroir: {
      kind: 'slide',
      dir: 'front',
      amount: 0.125,
      period: 6,
      shape: 'pulse',
      from: 0,
      to: 0.4,
    },
    presse: {
      kind: 'slide',
      dir: 'down',
      amount: 0.15,
      period: 6,
      shape: 'pulse',
      from: 0.5,
      to: 0.8,
    },
    blocs: loop(0.075, 6, 'front'),
  },
  washer: {
    tambour: spin(1),
    galets: spin(-6.5),
    bande: loop(0.065, 1.2),
    sortie: loop(0.1, 1.5),
  },
  assembler: {
    bras1: { kind: 'swing', angle: 0.9, period: 3 },
    bras2: { kind: 'swing', angle: 0.9, period: 3, offset: 0.5 },
    plateau: { kind: 'step', angle: Math.PI / 2, period: 3 },
    ventilateur: spin(14),
  },
  assembler_advanced: {
    bras1: { kind: 'swing', angle: 0.9, period: 1.5 },
    bras2: { kind: 'swing', angle: 0.9, period: 1.5, offset: 0.5 },
    plateau: { kind: 'step', angle: Math.PI / 2, period: 1.5 },
    ventilateur: spin(20),
  },
  builder: {
    portique: {
      kind: 'slide',
      dir: 'front',
      amount: 0.4,
      period: 7,
      shape: 'pulse',
      from: 0,
      to: 1,
    },
    chariot: {
      kind: 'slide',
      dir: 'right',
      amount: 0.4,
      period: 4.3,
      shape: 'pulse',
      from: 0,
      to: 1,
      parent: 'portique',
    },
    outil: {
      kind: 'slide',
      dir: 'down',
      amount: 0.067,
      period: 2.1,
      shape: 'pulse',
      from: 0,
      to: 1,
      parent: 'chariot',
    },
    ventilateur: spin(14),
    entree: loop(0.133, 1.5),
    sortie: loop(0.133, 1.5),
  },
  heavy_press: {
    coulisseau: { kind: 'press', depth: 0.146 },
    ventilateur: spin(14),
    entree: loop(0.133, 1.5),
    sortie: loop(0.133, 1.5),
  },
  // Presse à plastique : le demi-moule du haut se ferme sur celui du bas ; les isolateurs avancent.
  plastic_press: { coulisseau: { kind: 'press', depth: 0.1 }, sortie: loop(0.12, 1.5) },
  centrifuge: {
    rotor: spin(25),
    ventilateur: spin(14),
    entree: loop(0.133, 1.5),
    sortie: loop(0.133, 1.5),
  },
  bessemer: {
    trappe: { kind: 'swing', angle: 1.3, period: 8, oneSided: true },
    moule: {
      kind: 'slide',
      dir: 'front',
      amount: 0.16,
      period: 8,
      shape: 'pulse',
      from: 0.25,
      to: 0.75,
    },
    poincon: {
      kind: 'slide',
      dir: 'down',
      amount: 0.075,
      period: 8,
      shape: 'pulse',
      from: 0.5,
      to: 0.62,
    },
    lingot: loop(0.11, 8, 'front'),
  },
  arm: { tourelle: { kind: 'swing', angle: 0.9, period: 2.85 }, volant: spin(8) },
  // Coffres : le couvercle s'ouvre quand on s'en sert (fenêtre ouverte, objet qui entre ou sort).
  chest_wood: { couvercle: { kind: 'open', angle: 1.9 } },
  chest_iron: { couvercle: { kind: 'open', angle: 1.9 } },
  // Roue à aubes : ne tourne que si le réseau demande de l'énergie (état « running »).
  waterwheel: { roue: spin(0.9), pignon: spin(-3.4) },
  // Pompe : accouplement moteur-pompe, et bagues d'eau qui montent dans le voyant de débit (pas lu dans le modèle).
  pump: { arbre: spin(30), debit: loop(0.05, 0.25) },
  // Manivelle de réamorçage : tourne pendant qu'on l'actionne (sa fenêtre est ouverte).
  crank: { manivelle: spin(4) },
  turbine: { arbre: spin(40) },
  // Éolienne : le rotor tourne quand elle produit.
  wind_turbine: { rotor: spin(1.8) },
  // Disjoncteur : le levier rouge bascule vers le bas quand il s'ouvre (surcharge ou à la main).
  breaker: { levier: { kind: 'open', angle: 2.5 } },
  generator: { volant: spin(6), ventilateur: spin(14) },
  lab: { carrousel: spin(1.5) },
  // Relais : la parabole balaye doucement ; antenne : anneaux qui tournent en sens contraires.
  relay: { parabole: { kind: 'swing', angle: 0.5, period: 9 } },
  antenna: { anneaux: spin(0.7), contre: spin(-1.1) },
  fission_reactor: { pompe1: spin(12), pompe2: spin(12) },
  // Remplisseuse : les barils avancent sur le convoyeur (pas lu dans le modèle), la buse descend sur chaque baril.
  barreler: { barils: loop(0.25, 2.4), buse: { kind: 'press', depth: 0.05 } },
  booster: { ventilateur: spin(22) },
  cooling_tower: { ventilateur: spin(3) },
  vitrifier: { sortie: loop(0.2, 3) },
  // Tourelles : la tête balaye l'horizon tant qu'elles sont prêtes à tirer (munitions ou courant).
  turret: { tourelle: { kind: 'swing', angle: 0.9, period: 5 } },
  turret_heavy: { tourelle: { kind: 'swing', angle: 0.7, period: 7 } },
  turret_laser: { tourelle: { kind: 'swing', angle: 0.8, period: 6 } },
  turret_plasma: { tourelle: { kind: 'swing', angle: 0.6, period: 8 } },
  arm_electric: { tourelle: { kind: 'swing', angle: 0.9, period: 2.85 } },
  arm_filter: { tourelle: { kind: 'swing', angle: 0.9, period: 2.85 } },
  // Machines avancées (`blender/scripts/avancees.py`).
  // Bras industriel : chaîne tourelle > épaule > coude > poignet, chaque articulation suit la précédente.
  arm_industrial: {
    tourelle: { kind: 'swing', angle: 0.9, period: 2.2 },
    epaule: { kind: 'swing', angle: 0.22, period: 2.2, offset: 0.25, parent: 'tourelle' },
    coude: { kind: 'swing', angle: 0.3, period: 2.2, offset: 0.5, parent: 'epaule' },
    poignet: { kind: 'swing', angle: 1.2, period: 1.1, parent: 'coude' },
  },
  air_compressor: { volant: spin(10) },
  air_purifier: { helice_g: spin(14), helice_d: spin(-14) },
  fuel_cell: { helice_pile: spin(16) },
  fabricator: { plateau: spin(1.2) },
  quantum_chest: { couvercle: { kind: 'open', angle: 1.9 }, cristal: spin(1.5) },
  turret_rail: { tourelle: { kind: 'swing', angle: 0.6, period: 8 } },
};

/**
 * Course d'une boucle donnée par le modèle (pas des objets et des lames sur un convoyeur, voir `PartGroup.step`) : elle
 * remplace `amount`, pour que le motif retombe exactement sur lui-même à chaque période.
 */
export function withStep(motion: Motion, step?: number): Motion {
  if (!step || motion.kind !== 'slide' || motion.shape !== 'loop') return motion;
  return { ...motion, amount: step };
}

/** Noms des groupes à sortir du maillage fixe pour cette machine. */
export const motionGroups = (type: MachineType): string[] => Object.keys(MOTIONS[type] ?? {});

/** Pose d'un groupe : rotation autour de l'axe du pivot (rad) et déplacement (m, repère du modèle : x, y haut, z devant). */
export interface Pose {
  angle: number;
  dx: number;
  dy: number;
  dz: number;
}

/** Avancement en part de période (0 à 1) d'un mouvement. */
const fraction = (phase: number, period: number, offset = 0): number => {
  const f = (phase / period + offset) % 1;
  return f < 0 ? f + 1 : f;
};

/** Bosse lisse : 0 hors de [from, to], 0 → 1 → 0 dedans. */
export function pulse(u: number, from: number, to: number): number {
  if (u <= from || u >= to) return 0;
  return Math.sin((Math.PI * (u - from)) / (to - from));
}

/**
 * Pose d'un mouvement simple.
 * @param phase secondes de marche cumulées (ne progresse pas à l'arrêt)
 * @param spinAngle angle déjà cumulé des rotations continues (rad)
 * @param cycle avancement (0 à 1) du cycle de travail de la machine, ou null
 * @param axis axe du pivot, dans le repère du modèle (pour `dir: 'axis'`)
 */
export function poseOf(
  motion: Motion,
  phase: number,
  spinAngle: number,
  cycle: number | null,
  axis: { x: number; y: number; z: number },
  level = 1,
): Pose {
  const pose: Pose = { angle: 0, dx: 0, dy: 0, dz: 0 };
  switch (motion.kind) {
    case 'spin':
      pose.angle = spinAngle;
      break;
    case 'swing': {
      const s = Math.sin(TAU * fraction(phase, motion.period, motion.offset ?? 0));
      pose.angle = motion.oneSided
        ? motion.angle * (0.5 - 0.5 * Math.cos(TAU * fraction(phase, motion.period)))
        : motion.angle * s;
      break;
    }
    case 'step': {
      const k = Math.floor(phase / motion.period);
      const u = fraction(phase, motion.period);
      // La moitié de la période pour tourner (départ et arrivée en douceur), le reste à l'arrêt.
      const turn = u < 0.5 ? 0.5 - 0.5 * Math.cos(Math.PI * (u / 0.5)) : 1;
      pose.angle = (k + turn) * motion.angle;
      break;
    }
    case 'press': {
      const f = cycle ?? fraction(phase, 3);
      // Il reste en haut, puis s'abat sur le dernier quart du cycle.
      pose.dy = -motion.depth * (f > 0.75 ? Math.sin(((f - 0.75) / 0.25) * Math.PI) : 0);
      break;
    }
    case 'slide': {
      const u = fraction(phase, motion.period);
      const t =
        motion.shape === 'loop'
          ? u * motion.amount
          : pulse(u, motion.from ?? 0, motion.to ?? 1) * motion.amount;
      const d = motion.dir;
      if (d === 'axis') {
        pose.dx = axis.x * t;
        pose.dy = axis.y * t;
        pose.dz = axis.z * t;
      } else if (d === 'up') pose.dy = t;
      else if (d === 'down') pose.dy = -t;
      else if (d === 'front') pose.dz = t;
      else if (d === 'back') pose.dz = -t;
      else if (d === 'right') pose.dx = t;
      else pose.dx = -t;
      break;
    }
    case 'open':
      // Ouverture douce (le niveau est déjà lissé) : un peu plus vite au début, comme un couvercle qu'on lève.
      pose.angle = motion.angle * Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, level)));
      break;
    case 'rocker':
      break;
  }
  return pose;
}

/** Géométrie du chevalet de pompage, relevée sur les pivots du modèle (plan : u = devant, v = haut ; origine = palier du balancier). */
export interface RockerGeometry {
  /** Arbre de la manivelle. */
  crank: { u: number; v: number };
  /** Haut des bielles (palonnier), au repos. */
  top: { u: number; v: number };
  /** Rayon du maneton. */
  radius: number;
  /** Angle du maneton au repos (dans le plan u, v). */
  beta0: number;
  /** Distance du palier aux câbles (devant). */
  cable: number;
}

/** Valeurs du modèle `chevalet_t2` (unités du modèle, mètres) : les pivots lus dans le `.glb` les remplacent s'ils sont là. */
export const ROCKER_DEFAULT: RockerGeometry = {
  crank: { u: -0.355, v: -1.25 },
  top: { u: -0.475, v: -0.03 },
  radius: 0.22,
  beta0: Math.atan2(-0.185, -0.12),
  cable: 0.4475,
};

export interface RockerPose {
  /** Rotation de la manivelle (rad, autour de +X). */
  crank: number;
  /** Rotation du balancier (rad, autour de +X ; positif = la tête descend). */
  rocker: number;
  /** Descente verticale de la tige (m, positif = vers le bas). */
  rod: number;
  /** Rotation des bielles autour de leur pivot (rad, autour de +X) ; `top` = nouvelle position du pivot (u, v relatifs au palier). */
  link: number;
  topU: number;
  topV: number;
}

const rotate = (u: number, v: number, a: number): [number, number] => [
  u * Math.cos(a) + v * Math.sin(a),
  v * Math.cos(a) - u * Math.sin(a),
];

/**
 * Cinématique du chevalet : la manivelle tourne de `crank` ; le balancier prend l'angle qui garde la bielle à longueur
 * constante (racine la plus proche de `previous` pour rester sur la même branche) ; la tige suit la tête du balancier.
 */
export function rockerPose(g: RockerGeometry, crank: number, previous = 0): RockerPose {
  const pin = (a: number): [number, number] => [
    g.crank.u + g.radius * Math.cos(g.beta0 - a),
    g.crank.v + g.radius * Math.sin(g.beta0 - a),
  ];
  const [pu0, pv0] = pin(0);
  const length = Math.hypot(pu0 - g.top.u, pv0 - g.top.v);
  const [pu, pv] = pin(crank);
  const f = (th: number): number => {
    const [tu, tv] = rotate(g.top.u, g.top.v, th);
    return Math.hypot(pu - tu, pv - tv) - length;
  };
  // Racines de f sur [-0,8 ; 0,8] : on garde celle qui est la plus proche de l'angle précédent.
  let best = NaN;
  let bestDist = Infinity;
  const N = 160;
  let a = -0.8;
  let fa = f(a);
  for (let i = 1; i <= N; i++) {
    const b = -0.8 + (1.6 * i) / N;
    const fb = f(b);
    if (fa === 0 || fa * fb < 0) {
      let lo = a;
      let hi = b;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid;
        else lo = mid;
      }
      const root = (lo + hi) / 2;
      if (Math.abs(root - previous) < bestDist) {
        bestDist = Math.abs(root - previous);
        best = root;
      }
    }
    a = b;
    fa = fb;
  }
  const rocker = Number.isNaN(best) ? previous : best;
  const [tu, tv] = rotate(g.top.u, g.top.v, rocker);
  const d0 = Math.atan2(pv0 - g.top.v, pu0 - g.top.u);
  const d1 = Math.atan2(pv - tv, pu - tu);
  return {
    crank,
    rocker,
    rod: g.cable * Math.sin(rocker),
    link: d0 - d1,
    topU: tu - g.top.u,
    topV: tv - g.top.v,
  };
}
