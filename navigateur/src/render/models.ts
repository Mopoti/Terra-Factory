/**
 * Modèles 3D du jeu : le « Factory Kit » de Kenney (CC0, voir `public/models/kenney/License.txt`). Les fichiers glTF
 * sont chargés une fois, puis « cuits » en sommets colorés (la couleur est lue dans la palette du kit) pour être
 * fusionnés dans le maillage des machines, comme les formes simples. Tant qu'un modèle n'est pas chargé, la machine
 * garde sa forme de secours.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MachineType } from '../core/data/machines';
import { motionGroups } from './partMotions';

export interface BakedModel {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  /** Dimensions (m) et position du plus bas coin avant mise à l'échelle. */
  size: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
  /** Parties animées à part (maillages dont le nom commence par un préfixe de `ANIMATED_MESHES`), absentes des tableaux ci-dessus. */
  flames?: FlameParts;
  /** Groupes de pièces mobiles (`MOTIONS` dans `partMotions.ts`), absents des tableaux ci-dessus, par nom de groupe. */
  groups?: Record<string, PartGroup>;
  /**
   * Point d'accroche du câble électrique (nœud `accroche_cable` du `.glb` : boule de la borne d'une machine électrique,
   * haut d'un poteau), dans le repère du modèle. Sans lui, le câble part du haut de la machine.
   */
  anchor?: { x: number; y: number; z: number };
  /** Véhicule : coussin du siège du conducteur (nœud vide `siege` du `.glb`), dans le repère du modèle. */
  seat?: { x: number; y: number; z: number };
}

/** Pièces d'un groupe mobile : maillage propre (repère du modèle) et pivot lu dans le nœud `pivot_<groupe>` du `.glb`. */
export interface PartGroup {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  pivot: { x: number; y: number; z: number };
  /** Axe de rotation (ou de glissement) : l'axe Y local du nœud pivot. */
  axis: { x: number; y: number; z: number };
  /**
   * Pas d'une boucle (m du modèle) : échelle du nœud pivot quand le modèle la donne (`T.pivot(..., pas=…)`, objets et
   * lames posés tous les `pas` sur un convoyeur). Il remplace alors la course `amount` du mouvement `loop`.
   */
  step?: number;
}

/** Un maillage animé (une flamme) : plage de sommets dans `FlameParts` et son pied (point autour duquel il vacille). */
export interface FlameGroup {
  first: number;
  count: number;
  px: number;
  py: number;
  pz: number;
  /** Lueur (maillage `lueur_*`, ex. braises d'un foyer) : ne vacille pas en taille, sa couleur rougeoie (rouge ↔ orange). */
  glow?: boolean;
  /** Voyant (maillage `voyant_*` ou `scanner_*`) : garde sa couleur, qui pulse en marche ; reste visible (terne) à l'arrêt. */
  pulse?: boolean;
}

/** Préfixe des lueurs parmi les maillages animés (`ANIMATED_MESHES`) : couleur qui rougeoie, forme fixe. */
const GLOW_PREFIX = ['lueur'];
/** Préfixes des voyants parmi les maillages animés : couleur propre qui pulse, toujours visibles. */
const PULSE_PREFIX = ['voyant', 'scanner'];

/** Maillages animés d'un modèle, dans le repère du modèle (mêmes unités et même origine que `BakedModel`). */
export interface FlameParts {
  positions: Float32Array;
  colors: Float32Array;
  /** Triangles, indices dans `positions` (sommets propres à cette partie). */
  index: Uint32Array;
  groups: FlameGroup[];
}

/** Modèle choisi pour chaque machine (les autres gardent leurs formes simples). */
export const MACHINE_MODELS: Partial<Record<MachineType, string>> = {
  furnace: 'machine-window',
  furnace_electric: 'machine-window-bar',
  stamper: 'piston-square',
  crusher: 'hopper-square',
  bessemer: 'hopper-high-round',
  mixer: 'piston-round',
  generator: 'machine-fortified',
  assembler: 'machine-window-bar',
  assembler_advanced: 'machine-window-bar',
  builder: 'machine-bed',
  lab: 'machine',
  heavy_press: 'piston-square',
  washer: 'machine-connection-pipe',
  plastic_press: 'piston-thin-round',
  centrifuge: 'piston-round',
  refinery: 'hopper-high-square',
  boiler: 'hopper-round',
  cooling_tower: 'hopper-high-round',
  evaporation_tower: 'hopper-high-round',
  vitrifier: 'machine-connection-hole',
  arm: 'robot-arm-a',
  arm_electric: 'robot-arm-a',
  arm_filter: 'robot-arm-b',
  chest_wood: 'box-small',
  chest_iron: 'box-large',
};

/**
 * Modèles faits pour le jeu (Blender, dossier `blender/` ; fichiers `.glb` dans `export/`, copiés dans
 * `public/models/terra/` par `node scripts/sync-modeles.mjs`). Ils passent avant ceux du kit.
 */
export const TERRA_MODELS: Partial<Record<MachineType, string>> = {
  // Clôtures, barrières et portails (`clotures.py`) : tronçons d'une case posés par trois, battants animés par `factoryView.ts`.
  fence_wood: 'cloture_bois',
  barrier_concrete: 'barriere_beton',
  barrier_reinforced: 'barriere_beton_arme',
  gate_wood: 'portail_bois',
  gate_concrete: 'portail_beton',
  gate_reinforced: 'portail_beton_arme',
  hologram_projector: 'barriere_holographique',
  hologram_gate: 'portail_holographique',
  drill: 'foreuse_t1',
  drill_electric: 'foreuse_electrique_t2',
  drill_eco: 'foreuse_eco_t3',
  furnace: 'fourneau_t1',
  furnace_electric: 'fourneau_electrique_t2',
  pumpjack: 'chevalet_t2',
  arm: 'bras_t1',
  arm_electric: 'bras_t2',
  arm_filter: 'bras_t3',
  splitter: 'separateur',
  merger: 'groupeur',
  sorter: 'trieur',
  stamper: 'estampeuse_t1',
  assembler: 'assembleur_t2',
  assembler_advanced: 'assembleur_avance',
  crusher: 'concasseur_t1',
  bessemer: 'convertisseur_t2',
  mixer: 'betonniere_t2',
  washer: 'station_lavage_t2',
  builder: 'constructeur_t2',
  heavy_press: 'presse_lourde_t3',
  refinery: 'raffinerie_t3',
  centrifuge: 'centrifugeuse_t4',
  pole: 'poteau_electrique',
  pole_hv: 'poteau_haute_tension',
  pole_uhv: 'poteau_tres_haute_tension',
  transformer: 'transformateur',
  breaker: 'disjoncteur',
  lamp: 'lampadaire',
  // Icônes seulement : en jeu, ces trois-là sont dessinés par `weatherProps.ts` (formes simples animées). Leurs modèles
  // ont les pièces pour les remplacer : `nacelle_` + `rotor_` (éolienne), `fleche_` + `anemometre_` (girouette), repère
  // `ecran` (thermomètre).
  thermometer: 'thermometre',
  vane: 'girouette',
  wind_turbine: 'eolienne',
  solar_panel: 'panneau_solaire',
  accumulator_basic: 'accumulateur_base',
  // Machines avancées (`blender/scripts/avancees.py`).
  charger: 'borne_recharge',
  air_compressor: 'compresseur_air',
  electrolyzer: 'electrolyseur',
  air_purifier: 'purificateur_air',
  fuel_cell: 'pile_combustible',
  drill_plasma: 'foreuse_plasma',
  arm_industrial: 'bras_industriel',
  fabricator: 'fabricateur_universel',
  quantum_chest: 'coffre_quantique',
  turret_rail: 'tourelle_rail',
  chest_wood: 'coffre_bois',
  chest_iron: 'coffre_fer',
  waterwheel: 'roue_a_aubes',
  pump: 'pompe_eau',
  crank: 'manivelle_reamorcage',
  boiler: 'chaudiere',
  turbine: 'turbine_vapeur',
  lab: 'laboratoire',
  generator: 'generateur_combustible',
  accumulator: 'accumulateur_t3',
  relay: 'relais_hyperfrequence',
  fission_reactor: 'reacteur_fission_t4',
  antenna: 'antenne_quantique',
  fusion_reactor: 'reacteur_fusion',
  barreler: 'remplisseuse_barils',
  booster: 'surpresseur_t2',
  cooling_tower: 'tour_refroidissement_t2',
  evaporation_tower: 'tour_evaporation_t4',
  vitrifier: 'station_vitrification_t4',
  turret: 'tourelle_base',
  waypoint: 'balise',
  plastic_press: 'presse_plastique_t2',
  turret_heavy: 'tourelle_lourde',
  turret_laser: 'tourelle_laser',
  turret_plasma: 'tourelle_plasma',
};

/**
 * Convention : dans un modèle maison, les maillages dont le NOM (ou celui d'un de leurs parents) commence par l'un de ces
 * préfixes sont animés à part par le jeu (voir `FlameParts`) et ne font pas partie du corps fixe de la machine.
 * Fourneau : `flamme_*` (cônes orange) et `coeur_*` (cœurs jaunes).
 */
export const ANIMATED_MESHES: Partial<Record<MachineType, readonly string[]>> = {
  furnace: ['flamme', 'coeur'],
  bessemer: ['flamme', 'coeur'],
  refinery: ['flamme', 'coeur'],
  washer: ['jet', 'ruissellement'],
  stamper: ['lueur'],
  // Foyers rougeoyants (`lueur_foyer`, `lueur_bouche`) et voyants qui pulsent (`voyant_*`, `scanner_*`).
  drill: ['lueur'],
  crusher: ['lueur'],
  arm: ['lueur'],
  furnace_electric: ['lueur'],
  centrifuge: ['voyant'],
  sorter: ['scanner'],
  waterwheel: ['jet'],
  boiler: ['lueur'],
  generator: ['lueur'],
  crank: ['voyant'],
  lab: ['voyant'],
  accumulator: ['voyant'],
  // Lampadaire : le globe (`voyant_lampe_*`) s'éclaire quand il est alimenté.
  lamp: ['voyant'],
  // Transformateur (énergie qui le traverse), disjoncteur (voyant ambre : ouvert), accumulateur de base (jauge).
  transformer: ['voyant'],
  breaker: ['voyant'],
  accumulator_basic: ['voyant'],
  // Assembleur avancé : bandeau lumineux et voyants des quatre types.
  assembler_advanced: ['voyant'],
  relay: ['voyant'],
  antenna: ['voyant'],
  fission_reactor: ['voyant'],
  fusion_reactor: ['voyant'],
  // Panaches de vapeur / de fumée (vacillent en marche), coulée de verre qui rougeoie, voyants des tourelles.
  cooling_tower: ['jet'],
  evaporation_tower: ['jet'],
  vitrifier: ['lueur'],
  plastic_press: ['lueur'],
  turret_laser: ['voyant'],
  turret_plasma: ['voyant'],
  // Machines avancées : écrans et voyants qui pulsent ; dard de plasma de la foreuse qui vacille (éteint à l'arrêt).
  charger: ['voyant'],
  air_compressor: ['voyant'],
  electrolyzer: ['voyant'],
  air_purifier: ['voyant'],
  fuel_cell: ['voyant'],
  drill_plasma: ['voyant', 'plasma'],
  arm_industrial: ['voyant'],
  fabricator: ['voyant'],
  quantum_chest: ['voyant'],
  turret_rail: ['voyant'],
};

/** Préfixes animés du modèle de ce nom (machines qui l'utilisent dans `TERRA_MODELS`). */
const prefixesOf = (name: string): string[] =>
  (Object.keys(TERRA_MODELS) as MachineType[])
    .filter((t) => TERRA_MODELS[t] === name)
    .flatMap((t) => ANIMATED_MESHES[t] ?? []);

/** Groupes mobiles du modèle de ce nom (voir `MOTIONS`). */
const groupsOf = (name: string): string[] =>
  (Object.keys(TERRA_MODELS) as MachineType[])
    .filter((t) => TERRA_MODELS[t] === name)
    .flatMap((t) => motionGroups(t));

/**
 * Modèles de tapis : droit et coude, pour chacun des 3 paliers (les pentes gardent leurs formes simples). Le coude existe
 * dans les deux sens (`corner` : entrée côté −x, sortie côté +z ; `cornerBack` : l'inverse), car les modèles maison
 * portent des flèches ; ceux du kit sont les mêmes dans les deux sens.
 */
export type BeltShape = 'straight' | 'corner' | 'cornerBack';
const BELT_MODELS: Record<BeltShape, readonly [string, string, string]> = {
  straight: ['conveyor-sides', 'conveyor-sides', 'conveyor-stripe-sides'],
  corner: ['conveyor-corner', 'conveyor-corner', 'conveyor-stripe-corner'],
  cornerBack: ['conveyor-corner', 'conveyor-corner', 'conveyor-stripe-corner'],
};
/**
 * Tapis maison (Blender, `blender/scripts/logistique.py`), par forme et palier : `null` = pas encore fait, on garde
 * celui du kit. Mêmes conventions que le kit : tuile de 1 m, dessus à `BELT_H` (20 cm), le droit circule vers +x, le
 * coude relie les côtés −x et +z. Leurs lames en flèche montrent le sens du tapis.
 */
const TERRA_BELT_MODELS: Record<BeltShape, readonly [string | null, string | null, string | null]> =
  {
    straight: ['convoyeur_t1', 'convoyeur_t2', 'convoyeur_t3'],
    corner: ['convoyeur_virage_t1', 'convoyeur_virage_t2', 'convoyeur_virage_t3'],
    cornerBack: [
      'convoyeur_virage_inverse_t1',
      'convoyeur_virage_inverse_t2',
      'convoyeur_virage_inverse_t3',
    ],
  };
export const beltModel = (shape: BeltShape, tier: number): BakedModel | null => {
  const t = Math.max(0, Math.min(2, tier - 1));
  const own = TERRA_BELT_MODELS[shape][t];
  return (own ? baked.get(own) : undefined) ?? baked.get(BELT_MODELS[shape][t]) ?? null;
};

/**
 * Tuyaux maison (`blender/scripts/fluides.py`) : une forme par façon d'être raccordé, trois paliers. Raccords de chaque
 * forme quand le modèle n'est pas tourné (côtés du jeu, 0 = +z, 1 = +x, 2 = -z, 3 = -x) ; le jeu la tourne pour couvrir
 * les côtés raccordés. `regard` = tuyau enterré (entrée ou sortie de tunnel) : un raccord, il plonge de l'autre côté.
 */
export type PipeForm = 'droit' | 'coude' | 'te' | 'croix' | 'bout' | 'seul' | 'regard';
const PIPE_PORTS: Record<PipeForm, number[]> = {
  droit: [3, 1],
  coude: [3, 0],
  te: [3, 1, 0],
  croix: [0, 1, 2, 3],
  bout: [3],
  seul: [],
  regard: [3],
};
const PIPE_NAMES = (
  ['droit', 'coude', 'te', 'croix', 'bout', 'seul', 'regard'] as PipeForm[]
).flatMap((f) => [1, 2, 3].map((t) => `tuyau_${f}_t${t}`));

/** Forme et quarts de tour du tuyau d'après ses côtés raccordés (ou son entrée / sortie de tunnel). */
export function pipeShape(
  sides: number[],
  lift: number,
  rot: number,
): { form: PipeForm; turns: number } {
  const want = (form: PipeForm, set: Set<number>): { form: PipeForm; turns: number } => {
    for (let t = 0; t < 4; t++) {
      const got = PIPE_PORTS[form].map((s) => (s + t) % 4);
      if (got.length === set.size && got.every((s) => set.has(s))) return { form, turns: t };
    }
    return { form, turns: 0 };
  };
  if (lift === 4 || lift === 5)
    return want('regard', new Set([lift === 4 ? (rot + 2) % 4 : rot % 4]));
  const set = new Set(sides.map((s) => ((s % 4) + 4) % 4));
  if (set.size === 0) return { form: 'seul', turns: rot % 4 };
  if (set.size === 1) return want('bout', set);
  if (set.size === 2)
    return want((set.has(0) && set.has(2)) || (set.has(1) && set.has(3)) ? 'droit' : 'coude', set);
  return want(set.size === 3 ? 'te' : 'croix', set);
}

/** Modèle maison du tuyau de ce palier et de cette forme (ou null s'il n'est pas chargé). */
export const pipeModel = (form: PipeForm, tier: number): BakedModel | null =>
  baked.get(`tuyau_${form}_t${Math.max(1, Math.min(3, tier))}`) ?? null;

/**
 * Autres modèles maison chargés avec les machines, et leurs groupes mobiles : le buggy (une roue par groupe, voir
 * `blender/scripts/vehicules.py`) et la végétation des biomes (`blender/scripts/vegetation.py`, voir `nature.ts`).
 */
const EXTRA_GROUPS: Record<string, string[]> = {
  // Rangées de barrières : les deux poteaux d'un tronçon sont à part (cachés là où un voisin touche) ; versions abîmées.
  ...Object.fromEntries(
    [
      'cloture_bois',
      'barriere_beton',
      'barriere_beton_abime1',
      'barriere_beton_abime2',
      'barriere_beton_arme',
      'barriere_beton_arme_abime1',
      'barriere_beton_arme_abime2',
    ].map((n) => [n, ['poteau_g', 'poteau_d']]),
  ),
  // Mur holographique : sa nappe de lumière (`holo_mur`) est dessinée à part, translucide, et seulement s'il est alimenté.
  barriere_holographique: ['poteau_g', 'poteau_d', 'holo_mur'],
  // Ennemis (icônes de l'onglet Créatif ; ils sont dessinés en jeu par `enemyView.ts`).
  ennemi_eclaireur: [],
  ennemi_gardien: [],
  ennemi_cracheur: [],
  // Portails : battants (pivots verticaux aux gonds), vantail coulissant du portail blindé, nappe de lumière.
  portail_bois: ['battant_g', 'battant_d'],
  portail_beton: ['battant_g', 'battant_d'],
  portail_beton_arme: ['vantail'],
  portail_holographique: ['holo_portail'],
  buggy: ['roue_avg', 'roue_avd', 'roue_arg', 'roue_ard'],
  quad: ['roue_avg', 'roue_avd', 'roue_arg', 'roue_ard'],
  quad_electrique: ['roue_avg', 'roue_avd', 'roue_arg', 'roue_ard'],
  // Char : cinq galets par côté, chacun sur son axe (ils roulent), et la tourelle.
  tank: [...[1, 2, 3, 4, 5].flatMap((k) => [`roue_g${k}`, `roue_d${k}`]), 'tourelle'],
  // Camionnette à benne et charrette à bras (poussée) : roues qui roulent.
  camionnette: ['roue_avg', 'roue_avd', 'roue_arg', 'roue_ard'],
  charrette: ['roue_g', 'roue_d'],
  // Objets de météo, dessinés par `weatherProps.ts` : nacelle (face au vent) et rotor de l'éolienne, flèche et
  // anémomètre de la girouette ; le thermomètre n'a pas de pièce mobile.
  eolienne: ['nacelle', 'rotor'],
  girouette: ['fleche', 'anemometre'],
  thermometre: [],
  // Quai de la gare (`ferroviaire.py`), dessiné par `stationView.ts`.
  gare: [],
  // Voies et trains (voir `docs/trains.md`) : les roues des trains tournent par groupes ; les bras d'attelage
  // automatique pivotent à leur traverse de tête pour rejoindre ceux du véhicule voisin (`trainView.ts`).
  rail_droit: [],
  rail_croisement: [],
  rail_virage: [],
  rail_virage_large: [],
  rail_virage_tres_large: [],
  rail_virage_grand: [],
  rail_virage_geant: [],
  rail_virage_45: [],
  rail_virage_45_b: [],
  rail_rampe: [],
  // Refonte des voies : virage de 45° (port 0 à l'origine) et droit en diagonale.
  rail_courbe: [],
  rail_diagonal: [],
  rail_aiguillage_d_droit: [],
  rail_aiguillage_d_devie: [],
  rail_aiguillage_g_droit: [],
  rail_aiguillage_g_devie: [],
  locomotive_vapeur: ['roues_av', 'roues_ar', 'roues_motrices', 'attelage_ar'],
  locomotive_electrique: [
    'roues_av',
    'roues_av2',
    'roues_ar2',
    'roues_ar',
    'attelage_av',
    'attelage_ar',
  ],
  wagon_fret: ['roues_av', 'roues_ar', 'attelage_av', 'attelage_ar'],
  wagon_plateforme: ['roues_av', 'roues_ar', 'attelage_av', 'attelage_ar'],
  wagon_citerne: ['roues_av', 'roues_ar', 'attelage_av', 'attelage_ar'],
};
/** Biomes des modèles de végétation maison (noms de fichiers) : `arbre_<biome>_<1-3>`, `buisson_<biome>_<1-3>`. */
export const NATURE_FILE_BIOMES = ['prairie', 'foret', 'desert', 'toundra'] as const;
export const NATURE_VARIANTS = 3;
const NATURE_NAMES = ['arbre', 'buisson'].flatMap((kind) =>
  NATURE_FILE_BIOMES.flatMap((b) =>
    Array.from({ length: NATURE_VARIANTS }, (_, i) => `${kind}_${b}_${i + 1}`),
  ),
);
/** Rochers maison (`blender/scripts/mineraux.py`) : `rocher_<biome>_<n>`. */
export const ROCK_VARIANTS = 3;
/** Gisement du jeu → nom des amas de minerai maison (`minerai_<nom>_<n>`). */
export const ORE_FILE_NAMES: Record<string, string> = {
  iron_ore: 'fer',
  copper_ore: 'cuivre',
  coal: 'charbon',
  zinc_ore: 'zinc',
  bauxite: 'bauxite',
  stone_ore: 'pierre',
  uraninite: 'uraninite',
  sand: 'sable',
  oil: 'petrole',
};
export const ORE_VARIANTS = 2;
/** Formes des objets posés au sol (`blender/scripts/objets.py`, `objet_<forme>.glb`) ; voir `dropModels.ts`. */
export const DROP_SHAPES = [
  'carapace',
  'tissu_vivant',
  'bois',
  'caillou',
  'minerai',
  'sable',
  'lingot',
  'plaque',
  'engrenage',
  'bobine',
  'fibre',
  'tissu',
  'baril',
  'science',
  // Paquets de science : un flacon par palier, et celui du combat.
  'science_1',
  'science_2',
  'science_3',
  'science_4',
  'science_5',
  'science_combat',
  // Moules : bloc d'acier avec l'empreinte de la pièce produite.
  'moule_plaque',
  'moule_engrenage',
  'moule_fil',
  // Intermédiaires des paliers 3 à 5.
  'chassis_simple',
  'chassis_renforce',
  'chassis_leger',
  'chassis_composite',
  'vitre',
  'vitre_blindee',
  'graphite',
  'sel_lithium',
  'fibre_carbone',
  'kit_circuit',
  'circuit_avance',
  'microcontroleur',
  'cellule_solaire',
  'filtre_graphite',
  'batterie_lithium',
  'batterie_portable',
  'kit_reparation',
  'capsule_fusion',
  'aimant_supra',
  'cristal_quantique',
  'deuterium',
  'tritium',
  'azote_liquide',
  'lingot_alu',
  'lingot_zamak',
  'cable',
  'isolant',
  'baril_vide',
  'baril_eau',
  'baril_petrole',
  'petrole_brut',
  'barre_uranium',
  'dechets_nucleaires',
  'puce',
  'bloc',
  'conteneur',
  'verre',
  'caisse',
  // Matériaux (`objets.py`) et eau (icône de la ressource).
  'caoutchouc',
  'tige',
  'moteur',
  'moteur_renforce',
  'eau',
  // Équipement, munitions et armures (`blender/scripts/equipement.py`).
  'boussole',
  'sac_a_dos',
  'capuche',
  'veste',
  'exosquelette',
  'propulseur',
  'pantalon',
  'bottes',
  'gants',
  'sac_couchage',
  'lit',
  'chargeur_pistolet',
  'chargeur_fusil',
  'chargeur_sniper',
  ...([1, 2, 3, 4, 5] as const).flatMap(
    (n) =>
      [
        `armure${n}_casque`,
        `armure${n}_plastron`,
        `armure${n}_jambieres`,
        `armure${n}_bottes`,
        `armure${n}_gants`,
      ] as const,
  ),
] as const;
const OBJET_NAMES = DROP_SHAPES.map((f) => `objet_${f}`);
const MINERAL_NAMES = [
  ...NATURE_FILE_BIOMES.flatMap((b) =>
    Array.from({ length: ROCK_VARIANTS }, (_, i) => `rocher_${b}_${i + 1}`),
  ),
  ...Object.values(ORE_FILE_NAMES).flatMap((o) =>
    Array.from({ length: ORE_VARIANTS }, (_, i) => `minerai_${o}_${i + 1}`),
  ),
];

/** Pièces de construction (`blender/scripts/construction.py`), utilisées par `buildingView.ts`. */
export const CONSTRUCTION_NAMES = [
  ...['bois', 'pierre', 'beton', 'aluminium'].flatMap((m) => [
    `mur_${m}`,
    `dalle_${m}`,
    // Pas de porte en béton dans le jeu.
    ...(m === 'beton' ? [] : [`porte_${m}`, `porte_${m}_battant`]),
    `escalier_${m}`,
    ...['bas', 'fut', 'haut', 'seul'].map((p) => `pilier_${m}_${p}`),
  ]),
  // Blindé : seulement le mur et la porte dans le jeu.
  'mur_blinde',
  'porte_blinde',
  'porte_blinde_battant',
  // Icône de la porte de garage (la vraie est dessinée par segments dans `buildingView.ts`).
  'porte_garage_aluminium',
];

const TERRA_NAMES = [
  ...new Set([
    ...PIPE_NAMES,
    ...Object.keys(EXTRA_GROUPS),
    ...NATURE_NAMES,
    ...MINERAL_NAMES,
    ...OBJET_NAMES,
    ...CONSTRUCTION_NAMES,
    // Nid des ennemis (`blender/scripts/creatures.py`) ; les ennemis eux-mêmes sont chargés par `enemyView.ts`.
    'nid',
    ...Object.values(TERRA_MODELS),
    ...Object.values(TERRA_BELT_MODELS)
      .flat()
      .filter((n): n is string => n !== null),
  ]),
] as string[];
const BELT_NAMES = new Set<string>(
  Object.values(TERRA_BELT_MODELS)
    .flat()
    .filter((n): n is string => n !== null),
);
const NAMES = [
  ...new Set([...Object.values(MACHINE_MODELS), ...Object.values(BELT_MODELS).flat()]),
] as string[];
const baked = new Map<string, BakedModel>();
let loading: Promise<void> | null = null;

/** Modèle abîmé d'une barrière (niveau d'usure 1 ou 2), ou null s'il n'y en a pas. */
export const damagedModel = (type: MachineType, level: number): BakedModel | null => {
  const own = TERRA_MODELS[type];
  return own && level > 0 ? (baked.get(`${own}_abime${Math.min(2, level)}`) ?? null) : null;
};

export const modelFor = (type: MachineType): BakedModel | null => {
  // Le modèle maison s'il est chargé, sinon celui du kit (un .glb absent ou en échec ne laisse pas la machine nue).
  const own = TERRA_MODELS[type];
  const kit = MACHINE_MODELS[type];
  return (own ? baked.get(own) : undefined) ?? (kit ? (baked.get(kit) ?? null) : null);
};

/** Enregistre un modèle déjà préparé (tests, ou modèle fabriqué ailleurs). */
export const registerModel = (name: string, model: BakedModel): void => {
  baked.set(name, model);
  settled = true; // un modèle fourni à la main (tests) : plus rien à attendre
};

/** Le chargement des modèles est-il terminé (réussi ou non) ? Avant, une machine qui a un modèle n'est pas dessinée. */
let settled = false;
export const modelsSettled = (): boolean => settled;

/** Cette machine a-t-elle un modèle prévu (maison ou kit) ? Sinon elle garde tout de suite sa forme simple. */
export const hasModelPlanned = (type: MachineType): boolean =>
  !!(TERRA_MODELS[type] ?? MACHINE_MODELS[type]);

/** Modèle déjà préparé sous ce nom (ou null). */
export const bakedModel = (name: string): BakedModel | null => baked.get(name) ?? null;

/** Y a-t-il déjà au moins un modèle prêt ? */
export const modelsReady = (): boolean => baked.size > 0;

/** Lit les couleurs de la palette du kit (image `colormap`) : un tableau RGBA et sa taille. */
function paletteOf(
  texture: THREE.Texture | null,
): { data: Uint8ClampedArray; w: number; h: number } | null {
  const image = texture?.image as CanvasImageSource & { width: number; height: number };
  if (!image || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    w: canvas.width,
    h: canvas.height,
  };
}

/** Le maillage ou l'un de ses parents porte-t-il un nom commençant par un des préfixes ? */
function hasAnimatedName(obj: THREE.Object3D, prefixes: readonly string[]): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    const n = o.name.toLowerCase();
    if (n && prefixes.some((p) => n.startsWith(p))) return true;
  }
  return false;
}

/** Le maillage appartient-il à ce groupe ? (`foret`, `foret_mandrin`, `foret_mandrin003`… ; pas `foretage`) */
function inGroup(name: string, group: string): boolean {
  const n = name.toLowerCase();
  if (!n.startsWith(group)) return false;
  const rest = n.slice(group.length);
  return rest === '' || rest[0] === '_' || /^\d+$/.test(rest);
}

export function bake(
  root: THREE.Object3D,
  animated: readonly string[] = [],
  groupNames: readonly string[] = [],
): BakedModel | null {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const fPos: number[] = [];
  const fCol: number[] = [];
  const fIdx: number[] = [];
  const groups: FlameGroup[] = [];
  root.updateMatrixWorld(true);
  // Pivots : nœuds `pivot_<groupe>` (le chargeur retire les points des noms, l'exporteur ajoute parfois « 002 »).
  const pivots = new Map<string, { pivot: THREE.Vector3; axis: THREE.Vector3; step?: number }>();
  root.traverse((o) => {
    if (!o.name.toLowerCase().startsWith('pivot_')) return;
    const key = o.name
      .toLowerCase()
      .slice(6)
      .replace(/\d{3}$/, '');
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    o.matrixWorld.decompose(p, q, s);
    pivots.set(key, {
      pivot: p,
      axis: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
      step: Math.abs(s.x - 1) > 1e-4 ? s.x : undefined,
    });
  });
  // Accroche du câble électrique : nœud vide `accroche_cable` (le premier trouvé).
  let anchor: { x: number; y: number; z: number } | undefined;
  root.traverse((o) => {
    if (anchor || !o.name.toLowerCase().startsWith('accroche')) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    anchor = { x: p.x, y: p.y, z: p.z };
  });
  // Siège d'un véhicule : nœud vide `siege` (ou `siege.001`… : Blender numérote les noms en double).
  let seat: { x: number; y: number; z: number } | undefined;
  root.traverse((o) => {
    if (seat || !o.name.toLowerCase().startsWith('siege')) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    seat = { x: p.x, y: p.y, z: p.z };
  });
  const byLength = [...groupNames].sort((a, b) => b.length - a.length);
  const parts = new Map<string, { pos: number[]; nor: number[]; col: number[]; idx: number[] }>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const flame = animated.length > 0 && hasAnimatedName(mesh, animated);
    const group = flame ? undefined : byLength.find((g) => inGroup(mesh.name, g));
    let part = group ? parts.get(group) : undefined;
    if (group && !part) {
      part = { pos: [], nor: [], col: [], idx: [] };
      parts.set(group, part);
    }
    const g = mesh.geometry as THREE.BufferGeometry;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const material = (
      Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    ) as THREE.MeshStandardMaterial;
    const palette = paletteOf(material.map);
    const tPos = flame ? fPos : (part?.pos ?? pos);
    const tCol = flame ? fCol : (part?.col ?? col);
    const tIdx = flame ? fIdx : (part?.idx ?? idx);
    const tNor = part?.nor ?? nor;
    const base = tPos.length / 3;
    const v = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      tPos.push(v.x, v.y, v.z);
      if (!flame) {
        if (n) {
          v.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
          tNor.push(v.x, v.y, v.z);
        } else tNor.push(0, 1, 0);
      }
      if (palette && uv) {
        const x = Math.min(palette.w - 1, Math.max(0, Math.floor(uv.getX(i) * palette.w)));
        const y = Math.min(palette.h - 1, Math.max(0, Math.floor(uv.getY(i) * palette.h)));
        const k = (y * palette.w + x) * 4;
        // La palette est en sRGB ; les couleurs de sommet sont lues comme linéaires : on convertit pour garder les teintes.
        tCol.push(
          (palette.data[k] / 255) ** 2.2,
          (palette.data[k + 1] / 255) ** 2.2,
          (palette.data[k + 2] / 255) ** 2.2,
        );
      } else if (material.color) tCol.push(material.color.r, material.color.g, material.color.b);
      else tCol.push(0.6, 0.6, 0.7);
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) tIdx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) tIdx.push(base + i);
    if (flame) {
      // Pied de la flamme : centre de son emprise, au plus bas.
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      let y0 = Infinity;
      for (let i = base; i < base + p.count; i++) {
        x0 = Math.min(x0, fPos[i * 3]);
        x1 = Math.max(x1, fPos[i * 3]);
        y0 = Math.min(y0, fPos[i * 3 + 1]);
        z0 = Math.min(z0, fPos[i * 3 + 2]);
        z1 = Math.max(z1, fPos[i * 3 + 2]);
      }
      groups.push({
        first: base,
        count: p.count,
        px: (x0 + x1) / 2,
        py: y0,
        pz: (z0 + z1) / 2,
        glow: hasAnimatedName(mesh, GLOW_PREFIX),
        pulse: hasAnimatedName(mesh, PULSE_PREFIX),
      });
    }
  });
  if (pos.length === 0 && fPos.length === 0 && parts.size === 0) return null;
  // L'enveloppe couvre tout le modèle, flammes comprises : l'échelle dans le jeu reste celle voulue par l'auteur.
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const list of [pos, fPos, ...[...parts.values()].map((x) => x.pos)]) {
    for (let i = 0; i < list.length; i += 3) {
      min.x = Math.min(min.x, list[i]);
      max.x = Math.max(max.x, list[i]);
      min.y = Math.min(min.y, list[i + 1]);
      max.y = Math.max(max.y, list[i + 1]);
      min.z = Math.min(min.z, list[i + 2]);
      max.z = Math.max(max.z, list[i + 2]);
    }
  }
  const model: BakedModel = {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    colors: new Float32Array(col),
    index: new Uint32Array(idx),
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    min,
  };
  if (anchor) model.anchor = anchor;
  if (seat) model.seat = seat;
  if (parts.size > 0) {
    model.groups = {};
    for (const [name, g] of parts) {
      // Sans nœud pivot, le groupe tourne autour du centre de ses pièces, axe vertical.
      let found = pivots.get(name);
      if (!found) {
        const c = new THREE.Vector3();
        for (let i = 0; i < g.pos.length; i += 3)
          c.add(new THREE.Vector3(g.pos[i], g.pos[i + 1], g.pos[i + 2]));
        found = {
          pivot: c.multiplyScalar(3 / Math.max(1, g.pos.length)),
          axis: new THREE.Vector3(0, 1, 0),
        };
      }
      model.groups[name] = {
        positions: new Float32Array(g.pos),
        normals: new Float32Array(g.nor),
        colors: new Float32Array(g.col),
        index: new Uint32Array(g.idx),
        pivot: { x: found.pivot.x, y: found.pivot.y, z: found.pivot.z },
        axis: { x: found.axis.x, y: found.axis.y, z: found.axis.z },
      };
      if (found.step) model.groups[name].step = found.step;
    }
  }
  if (groups.length > 0)
    model.flames = {
      positions: new Float32Array(fPos),
      colors: new Float32Array(fCol),
      index: new Uint32Array(fIdx),
      groups,
    };
  return model;
}

/** Charge (une seule fois) les modèles utilisés ; les échecs sont ignorés : la machine garde sa forme simple. */
export function loadModels(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all(
    [
      ...NAMES.map((name) => ({ name, folder: 'kenney' })),
      ...TERRA_NAMES.map((name) => ({ name, folder: 'terra' })),
    ].map(
      ({ name, folder }) =>
        new Promise<void>((resolve) => {
          loader.load(
            `${baseUrl}models/${folder}/${name}.glb`,
            (gltf) => {
              // Tapis maison : leurs lames (groupe `bande_`) défilent à part (voir `beltBands.ts`).
              const groups = BELT_NAMES.has(name)
                ? ['bande']
                : (EXTRA_GROUPS[name] ?? groupsOf(name));
              const model = bake(gltf.scene, prefixesOf(name), groups);
              if (model) baked.set(name, model);
              resolve();
            },
            undefined,
            () => resolve(),
          );
        }),
    ),
  ).then(() => {
    settled = true;
  });
  return loading;
}

/** Articulation d'un modèle : la partie haute (au-dessus de `split`, en part de la hauteur) est animée à part. */
export type AnimKind = 'press' | 'swing' | 'spin';
export const MACHINE_ANIM: Partial<Record<MachineType, { kind: AnimKind; split: number }>> = {
  stamper: { kind: 'press', split: 0.5 },
  heavy_press: { kind: 'press', split: 0.5 },
  plastic_press: { kind: 'press', split: 0.5 },
  arm: { kind: 'swing', split: 0.2 },
  arm_electric: { kind: 'swing', split: 0.2 },
  arm_filter: { kind: 'swing', split: 0.2 },
};

const splits = new Map<string, { low: BakedModel; high: BakedModel }>();

/** Coupe un modèle en deux (mêmes sommets, deux listes de triangles) selon la hauteur de leur centre. */
export function splitModel(
  model: BakedModel,
  split: number,
): { low: BakedModel; high: BakedModel } {
  const limit = model.min.y + model.size.y * split;
  const low: number[] = [];
  const high: number[] = [];
  for (let k = 0; k < model.index.length; k += 3) {
    const a = model.index[k];
    const b = model.index[k + 1];
    const c = model.index[k + 2];
    const y =
      (model.positions[a * 3 + 1] + model.positions[b * 3 + 1] + model.positions[c * 3 + 1]) / 3;
    (y > limit ? high : low).push(a, b, c);
  }
  return {
    low: { ...model, index: new Uint32Array(low) },
    high: { ...model, index: new Uint32Array(high) },
  };
}

/** Les deux parties d'un modèle articulé, ou null si la machine n'a pas d'animation ou si son modèle n'est pas prêt. */
export function animatedParts(
  type: MachineType,
): { kind: AnimKind; low: BakedModel; high: BakedModel } | null {
  const anim = MACHINE_ANIM[type];
  const name = MACHINE_MODELS[type];
  const model = modelFor(type);
  if (!anim || !name || !model) return null;
  // Seul le modèle du kit est coupé à mi-hauteur. Un modèle maison (`TERRA_MODELS`) garde ses pièces entières : ses
  // pièces mobiles sont des groupes à part (voir blender/ANIMATIONS.md). Sans ce test, la découpe du modèle maison
  // était aussi mise en cache sous le nom du kit, partagé par d'autres machines (l'estampeuse prêtait son modèle à la
  // presse lourde, à la mauvaise échelle).
  if (model !== baked.get(name)) return null;
  let parts = splits.get(name + anim.split);
  if (!parts) {
    parts = splitModel(model, anim.split);
    splits.set(name + anim.split, parts);
  }
  return { kind: anim.kind, ...parts };
}
