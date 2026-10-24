/**
 * Personnage du joueur fait pour le jeu (`blender/scripts/personnage.py`, voir `docs/personnage.md`) : homme ou femme,
 * même squelette (`bassin`, `cuisse_g`, `bras_d`…), en mètres, l'avant vers +z. Un matériau par teinte : la combinaison
 * prend la couleur du joueur ; peau, cheveux, bandes et yeux gardent la leur (réglables plus tard dans le profil).
 * Les mouvements sont calculés ici en tournant les os (animation procédurale), comme pour le mannequin provisoire
 * (`minerModel.ts`), qui reste utilisé tant que ces fichiers ne sont pas chargés :
 *  - marche et course : jambes qui balancent avec le genou qui plie quand le pied passe devant, bassin qui tourne et
 *    descend à chaque pas, buste qui compense et se penche en courant, bras opposés aux jambes, coudes souples ;
 *  - repos : respiration légère du buste, bras détendus ;
 *  - saut : jambes repliées à la montée, tendues vers le sol à la descente, bras écartés pour l'équilibre, puis
 *    réception genoux fléchis (amortie selon la vitesse de chute) ;
 *  - accroupi : genoux pliés, pieds à plat, buste penché, corps abaissé ; on avance à petits pas ;
 *  - outil en main : tenu par le bas du manche dans la main droite, manche relevé devant soi, tête en haut ;
 *  - coup de pioche : à deux mains, en quatre temps (préparation, élan au-dessus de la tête, frappe rapide vers
 *    l'avant et le bas en se penchant, retour), courbes lissées entre les poses clés.
 * Chaque articulation glisse vers sa pose visée (amortissement) : les passages d'un mouvement à l'autre sont fluides.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  DEFAULT_HAIR,
  FACE_KEYS,
  bodyScales,
  type Appearance,
  type FaceKey,
  type HairStyle,
  type Silhouette,
} from '../core/profile/appearance';

export type { Silhouette };

/** Taille du personnage dans le fichier (m), de la plante des pieds au sommet du crâne (sans les cheveux). */
const MODEL_HEIGHT_M = 1.82;
/** Hauteur des hanches dans le fichier (m) : de là partent les jambes. */
const HIP_HEIGHT_M = 0.9;
/** Durée d'un coup de pioche complet (s). */
const STRIKE_PERIOD_S = 0.8;

const sources = new Map<Silhouette, THREE.Group>();
let loading: Promise<boolean> | null = null;

export const avatarReady = (): boolean => sources.size === 2;

/** Formes de déformation du visage attendues dans le modèle (voir `docs/personnage.md`) : `<nom>` pousse dans un sens, `<nom>_moins` dans l'autre. */
export const FACE_MORPHS: Record<FaceKey, string> = {
  noseSize: 'nez_taille',
  noseWidth: 'nez_largeur',
  noseHeight: 'nez_hauteur',
  mouthWidth: 'bouche_largeur',
  lips: 'levres',
  mouthHeight: 'bouche_hauteur',
  eyeShape: 'yeux_forme',
  eyeSpacing: 'yeux_ecart',
};

/** Réglages du visage que le modèle chargé sait appliquer (vide tant qu'il n'a pas de formes de déformation). */
export function avatarFaceKeys(): FaceKey[] {
  const found = new Set<string>();
  for (const source of sources.values())
    source.traverse((o) => {
      const dict = (o as THREE.Mesh).morphTargetDictionary;
      if (dict) for (const name of Object.keys(dict)) found.add(name);
    });
  return FACE_KEYS.filter((k) => found.has(FACE_MORPHS[k]));
}

/** Charge (une seule fois) les deux silhouettes ; false si un fichier manque (on garde le mannequin). */
export function loadAvatar(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<boolean> {
  loading ??= Promise.all(
    (['homme', 'femme'] as const).map(
      (s) =>
        new Promise<boolean>((resolve) => {
          new GLTFLoader().load(
            `${baseUrl}models/terra/personnage_${s}.glb`,
            (gltf) => {
              sources.set(s, gltf.scene);
              resolve(true);
            },
            undefined,
            () => resolve(false),
          );
        }),
    ),
  ).then((ok) => ok.every(Boolean));
  return loading;
}

/** Os animés : `_g` = gauche du personnage (côté +x), `_d` = droite (côté -x). */
const ARM = { g: ['bras_g', 'avantbras_g', 'main_g'], d: ['bras_d', 'avantbras_d', 'main_d'] };
const LEG = { g: ['cuisse_g', 'jambe_g', 'pied_g'], d: ['cuisse_d', 'jambe_d', 'pied_d'] };
const TRUNK = ['bassin', 'ventre', 'poitrine', 'cou', 'tete'];

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** Rotation de repos du parent par rapport au personnage, et son inverse. */
  parentWorld: THREE.Quaternion;
  parentInverse: THREE.Quaternion;
  /** Rotation actuelle (repère du personnage, depuis la pose de repos), qui glisse vers la rotation visée. */
  current: THREE.Quaternion;
  target: THREE.Quaternion;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Pose d'un bras : balancement (négatif : vers l'avant / le haut), écart du corps, coude, poignet, pivot vers le milieu. */
interface ArmPose {
  swing: number;
  out: number;
  bend: number;
  wrist: number;
  twist: number;
}

/** Pose clé du coup de pioche : bras droit, bras gauche (sur le manche, sous la main droite), buste, genoux. */
interface StrikeKey {
  t: number;
  right: ArmPose;
  left: ArmPose;
  lean: number;
  turn: number;
  knees: number;
}

const arm = (swing: number, out: number, bend: number, wrist = 0, twist = 0): ArmPose => ({
  swing,
  out,
  bend,
  wrist,
  twist,
});

/**
 * Coup de pioche à deux mains (t de 0 à 1 sur la durée du coup) : prêt, élan au-dessus de la tête (buste en arrière,
 * poignets cassés), frappe rapide vers l'avant et le bas (bras tendus, buste penché, genoux pliés), fin du geste,
 * retour à la pose de départ.
 */
/** Poses clés : [t, bras droit, bras gauche, buste penché, buste tourné, genoux pliés]. */
type KeyRow = [number, number[], number[], number, number, number];
// prettier-ignore
const ROWS: KeyRow[] = [
  //  t     bras droit (balancement, écart, coude, poignet, pivot)   bras gauche                     buste  tour   genoux
  [0,    [-0.95,  0.02, 1.0,  0.6,  0.42], [-0.7,   0.0,  1.1,  0.5,  0.5],   0.06, -0.12, 0.08],
  [0.22, [-1.8,  -0.22, 1.3, -0.1,  0.2],  [-1.7,  -0.3,  1.4, -0.1,  0.2],  -0.03, -0.2,  0.06],
  [0.44, [-2.8,  -0.36, 1.6, -0.7, -0.1],  [-2.75, -0.42, 1.7, -0.6, -0.15], -0.16, -0.26, 0.04],
  [0.56, [-2.0,  -0.28, 0.8,  0.35, 0.2],  [-1.9,  -0.34, 0.9,  0.3,  0.25],  0.12, -0.06, 0.16],
  [0.64, [-1.05,  0.0,  0.15, 0.95, 0.4],  [-0.85,  0.0,  0.25, 0.9,  0.48],  0.34,  0.06, 0.3],
  [0.74, [-0.85,  0.0,  0.25, 1.05, 0.4],  [-0.65,  0.0,  0.35, 1.0,  0.48],  0.32,  0.05, 0.26],
  [1,    [-0.95,  0.02, 1.0,  0.6,  0.42], [-0.7,   0.0,  1.1,  0.5,  0.5],   0.06, -0.12, 0.08],
];
const STRIKE_KEYS: StrikeKey[] = ROWS.map(([t, r, l, lean, turn, knees]) => ({
  t,
  right: arm(r[0], r[1], r[2], r[3], r[4]),
  left: arm(l[0], l[1], l[2], l[3], l[4]),
  lean,
  turn,
  knees,
}));

/** Main gantée : centre du manche, plaqué contre la paume au pied des doigts, dans le repère du modèle exporté (m, doigts vers +Z). */
const GLOVE_GRIP = new THREE.Vector3(0, -0.031, 0.09);
/** Main gantée tournée autour du manche (rad) : l'avant-bras arrive du bas à droite de l'écran. */
const GLOVE_ROLL = -0.6;
/** Poses des bras avec une arme (vues extérieures) : pistolet tenu bras tendu, arme longue épaulée. */
const GUN_ARM_PISTOL: ArmPose = arm(-1.45, 0.02, 0.1, 0.05, 0.25);
const GUN_ARM_LONG_RIGHT: ArmPose = arm(-0.25, 0.15, 1.35, 0.05, 0.3);
const GUN_ARM_LONG_LEFT: ArmPose = arm(-1.0, 0.0, 0.7, 0.1, 0.6);
/** Main gantée en vue extérieure : un peu plus petite qu'en vue subjective (proportions du corps entier). */
const GLOVE_SCALE_OUTSIDE = 1.05;
/** Échelle des os des mains du modèle quand les mains gantées les remplacent (repliées au poignet). */
const HIDDEN_HAND = 0.02;
/** Main gantée un peu plus grande que nature (style cartoon, comme l'image de référence). */
const GLOVE_SCALE = 1.3;
/** Longueur du modèle de manche `avant_bras` (m), étirement et épaisseur en vue subjective, recouvrement du gant (m). */
const SLEEVE_LENGTH_M = 0.24;
const SLEEVE_STRETCH = 1.35;
const SLEEVE_WIDTH = 1.15;
const SLEEVE_TUCK_M = 0.035;
/** Poignet souple : part du vrai avant-bras suivie par la manche, pli au repos et pli maximal (rad). */
const WRIST_FOLLOW = 0.55;
const WRIST_REST_BEND = 0.5;
const WRIST_MAX_BEND = 0.75;
/**
 * Doigts de la main gantée refermés sur le manche (rotation autour de l'axe X de chaque phalange, en rad) : calculés
 * pour que chaque doigt s'enroule autour du manche plaqué contre la paume (prise en poing).
 */
const FIST: Record<string, [number, number, number]> = {
  index: [1.2, 1.18, 0.98],
  majeur: [1.4, 1.31, 1.08],
  annulaire: [1.32, 1.28, 1.04],
  auriculaire: [0.95, 0.99, 0.89],
};
/** Pouce enroulé par-dessus l'index : rotations (x, puis autour de la verticale du modèle) de chaque segment. */
const THUMB: [number, number][] = [
  [0.1, -0.75],
  [0.8, -0.3],
  [0.7, 0],
];

/**
 * Vue subjective (bras droit seul, vu de l'épaule) : outil tenu en bas à droite, manche dressé un peu penché vers
 * l'avant ; au coup, la main monte et l'outil part en arrière par-dessus l'épaule, puis s'abat au centre de l'écran.
 */
const FP_HOLD: ArmPose = arm(-1.62, -0.21, 0.08, -0.23, 0.41);
// prettier-ignore
const FP_ROWS: [number, number[]][] = [
  [0,    [-1.62, -0.21, 0.08, -0.23, 0.41]],
  [0.44, [-1.92, -0.01, 0.09, -0.05, 0.59]],
  [0.56, [-1.87,  0.03, 0.05,  0.04, 0.68]],
  [0.64, [-1.66, -0.09, 0.06,  0.54, 0.47]],
  [0.74, [-1.62, -0.02, 0.08,  0.58, 0.55]],
  [1,    [-1.62, -0.21, 0.08, -0.23, 0.41]],
];

/** La pose du bras en vue subjective à l'instant t du coup (0 à 1), lissée entre les poses clés. */
export function fpPose(t: number): ArmPose {
  const k = FP_ROWS;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1][0]) i++;
  const a = k[Math.max(0, i - 1)][1];
  const b = k[i][1];
  const c = k[i + 1][1];
  const d = k[Math.min(k.length - 1, i + 2)][1];
  const u = Math.max(0, Math.min(1, (t - k[i][0]) / (k[i + 1][0] - k[i][0])));
  const n = (j: number): number => catmull(a[j], b[j], c[j], d[j], u);
  return arm(n(0), n(1), n(2), n(3), n(4));
}

/** Courbe douce (Catmull-Rom) entre les valeurs b et c, a et d étant les voisines. */
function catmull(a: number, b: number, c: number, d: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3)
  );
}

/** La pose du coup à l'instant t (0 à 1), lissée entre les poses clés. */
export function strikePose(t: number): StrikeKey {
  const k = STRIKE_KEYS;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[Math.max(0, i - 1)];
  const b = k[i];
  const c = k[i + 1];
  const d = k[Math.min(k.length - 1, i + 2)];
  const u = Math.max(0, Math.min(1, (t - b.t) / (c.t - b.t)));
  const n = (f: (key: StrikeKey) => number): number => catmull(f(a), f(b), f(c), f(d), u);
  const armAt = (side: 'right' | 'left'): ArmPose => ({
    swing: n((x) => x[side].swing),
    out: n((x) => x[side].out),
    bend: n((x) => x[side].bend),
    wrist: n((x) => x[side].wrist),
    twist: n((x) => x[side].twist),
  });
  return {
    t,
    right: armAt('right'),
    left: armAt('left'),
    lean: n((x) => x.lean),
    turn: n((x) => x.turn),
    knees: n((x) => x.knees),
  };
}

export class Avatar {
  readonly root = new THREE.Group();
  /** Matériau de la combinaison. */
  readonly suit: THREE.MeshStandardMaterial;
  private readonly materials: THREE.Material[] = [];
  private readonly named = new Map<string, THREE.MeshStandardMaterial>();
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly morphMeshes: THREE.Mesh[] = [];
  /** Pièces des coupes de cheveux (`<modèle>_coupe_<nom>`), une seule visible. */
  private readonly cuts: { object: THREE.Object3D; style: string }[] = [];
  private readonly model: THREE.Group;
  private readonly baseHeight: number;
  private readonly joints = new Map<string, Joint>();
  private readonly firstPerson: boolean;
  /** Avancement du coup en cours (0 à 1) et part du coup dans la pose (0 : pas de coup, 1 : en plein coup). */
  private strikeT = 0;
  private strikeMix = 0;
  /** Temps écoulé (respiration au repos). */
  private clock = 0;
  /** Hauteur de base du modèle (sans le rebond de la marche). */
  private modelY = 0;
  /** Vrai quand le joueur tient un outil : le bras droit le porte devant lui au lieu de balancer. */
  holding = false;
  /** Vrai quand le joueur conduit un véhicule : assis, cuisses vers l'avant, genoux pliés, mains sur le volant. */
  seated = false;
  /** Façon de s'asseoir : en voiture (volant), à moto / quad (jambes écartées vers les repose-pieds, penché sur le guidon). */
  seatStyle: 'car' | 'bike' = 'car';
  /** En l'air (saut, chute) et vitesse verticale (m/s, positive en montant). */
  airborne = false;
  verticalSpeed = 0;
  /** Accroupi (touche Accroupi au sol). */
  crouching = false;
  /** Hauteur dont le corps descend quand on est accroupi, pour un personnage de 1,70 m (m). */
  static readonly CROUCH_DROP_M = 0.42;
  /** Hauteur des hanches par rapport au centre de `root` (m), selon la taille et la longueur des jambes. */
  hipOffset = 0;
  private phase = 0;
  private amount = 0;
  /** Part de chaque posture dans la pose (0 à 1), qui suit l'état en douceur. */
  private airMix = 0;
  private crouchMix = 0;
  /** Réception d'un saut : flexion des genoux qui s'efface (0 à 1). */
  private landing = 0;
  private wasAirborne = false;
  /** Prise de l'outil (dans l'os de la main) et pivot de l'outil, posés par `attachHandTool`. */
  private toolHolder: THREE.Object3D | null = null;
  private mount: THREE.Object3D | null = null;
  /** Arme en main (vues extérieures) : bras droit tendu vers l'avant ; arme longue : bras gauche sous le garde-main. */
  gunPose: 'none' | 'pistol' | 'long' = 'none';
  /** Gants des vues extérieures et os de l'avant-bras correspondant (manchette tournée vers le coude). */
  private readonly cuffs: { glove: THREE.Object3D; fore: THREE.Bone }[] = [];
  /** Vue subjective, style doux : manche, gant, axe du gant (dans la prise) et os de l'avant-bras. */
  private fpSleeve: {
    sleeve: THREE.Object3D;
    glove: THREE.Object3D;
    axis: THREE.Vector3;
    fore: THREE.Bone;
    cuff: THREE.Object3D | null;
  } | null = null;
  /** Maillages du corps (sans l'outil tenu). */
  private readonly bodyMeshes: THREE.Object3D[] = [];
  private toolGrip: THREE.Object3D | null = null;
  private lastVy = 0;

  /**
   * `height` : taille (m) ; `color` : couleur de la combinaison ; `silhouette` : homme ou femme ; `appearance` : le
   * profil du joueur (silhouette, morphologie, couleurs), qui remplace `color` et `silhouette`.
   */
  constructor(
    height: number,
    color: number,
    options: {
      firstPerson?: boolean;
      silhouette?: Silhouette;
      /** Coupe de cheveux sans profil (par défaut celle de la silhouette). */
      hairStyle?: HairStyle;
      appearance?: Appearance;
    } = {},
  ) {
    this.firstPerson = options.firstPerson ?? false;
    const silhouette = options.appearance?.silhouette ?? options.silhouette ?? 'homme';
    const source = sources.get(silhouette);
    if (!source) throw new Error('Personnage non chargé');
    const model = cloneSkinned(source) as THREE.Group;
    const byName = new Map<string, THREE.MeshStandardMaterial>();
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const cut = /_coupe_([a-z_]+?)(?:_\d+)?$/.exec(o.name);
      if (cut) this.cuts.push({ object: o, style: cut[1] });
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh && !(mesh as unknown as THREE.Mesh).isMesh) return;
      if (mesh.morphTargetDictionary) this.morphMeshes.push(mesh);
      const own = (m: THREE.Material): THREE.MeshStandardMaterial => {
        const name = m.name.replace(/\.\d+$/, '');
        let c = byName.get(name);
        if (!c) {
          c = (m as THREE.MeshStandardMaterial).clone();
          c.roughness = 0.85;
          c.metalness = 0;
          c.name = name;
          byName.set(name, c);
          this.materials.push(c);
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(own)
        : own(mesh.material as THREE.Material);
      mesh.castShadow = !this.firstPerson;
      mesh.frustumCulled = false;
      this.bodyMeshes.push(mesh);
    });
    this.named = byName;
    this.bones = bones;
    this.suit = byName.get('combinaison') ?? new THREE.MeshStandardMaterial();
    this.suit.color.setHex(color);
    // Les bandes : une teinte plus claire de la même couleur, pour que chaque joueur reste reconnaissable.
    const stripe = byName.get('bande');
    if (stripe) stripe.color.setHex(color).offsetHSL(0.08, 0.1, 0.22);

    model.updateMatrixWorld(true);
    for (const name of [...ARM.g, ...ARM.d, ...LEG.g, ...LEG.d, ...TRUNK]) {
      const bone = bones.get(name);
      if (!bone) continue;
      const parentWorld = new THREE.Quaternion();
      bone.parent?.getWorldQuaternion(parentWorld);
      this.joints.set(name, {
        bone,
        rest: bone.quaternion.clone(),
        parentWorld,
        parentInverse: parentWorld.clone().invert(),
        current: new THREE.Quaternion(),
        target: new THREE.Quaternion(),
      });
    }
    const k = height / MODEL_HEIGHT_M;
    model.scale.setScalar(k);
    model.position.y = -height / 2;
    this.modelY = model.position.y;
    this.model = model;
    this.baseHeight = height;
    this.hipOffset = -height / 2 + HIP_HEIGHT_M * k;
    this.root.add(model);
    this.showHair(options.hairStyle ?? DEFAULT_HAIR[silhouette]);
    if (options.appearance) this.look(options.appearance);
  }

  /**
   * Applique le profil du joueur : couleurs, coupe de cheveux, morphologie (échelles des os, la taille du corps) et
   * visage (formes de déformation, si le modèle en a). À appeler avant d'attacher un outil à la main.
   */
  look(a: Appearance): void {
    const color = (name: string, hex: string): void => {
      this.named.get(name)?.color.set(hex);
    };
    color('combinaison', a.colors.suit);
    color('bande', a.colors.stripe);
    color('couture', a.colors.suit);
    this.named.get('couture')?.color.multiplyScalar(0.7);
    color('peau', a.colors.skin);
    color('cheveux', a.colors.hair);
    color('iris', a.colors.eyes);
    this.showHair(a.hairStyle);
    // Morphologie : des échelles sur les os du tronc et des jambes ; ce qui ne doit pas grossir est compensé.
    const s = bodyScales(a.body, a.silhouette);
    const set = (name: string, x: number, y: number, z: number): void => {
      this.bones.get(name)?.scale.set(x, y, z);
    };
    set('bassin', s.hips, 1, s.hips);
    set('poitrine', s.shoulders, 1, s.chest / s.hips);
    set('cou', 1 / (s.hips * s.shoulders), 1, 1 / s.chest);
    for (const side of ['g', 'd']) {
      set(`cuisse_${side}`, s.thighs / s.hips, s.legs, s.thighs / s.hips);
      set(`pied_${side}`, 1, 1 / s.legs, 1);
    }
    const k = (this.baseHeight / MODEL_HEIGHT_M) * s.size;
    this.model.scale.setScalar(k);
    // Des jambes plus longues descendent les pieds : on remonte le corps de la même longueur.
    this.model.position.y = -this.baseHeight / 2 + HIP_HEIGHT_M * (s.legs - 1) * k;
    this.modelY = this.model.position.y;
    this.hipOffset = this.model.position.y + HIP_HEIGHT_M * s.legs * k;
    for (const key of FACE_KEYS) this.morph(FACE_MORPHS[key], a.face[key]);
  }

  /** Montre une seule coupe de cheveux (`none` : aucune). */
  private showHair(style: HairStyle): void {
    for (const c of this.cuts) c.object.visible = c.style === style;
  }

  /** Règle une forme de déformation de −1 à +1 (`<nom>` vers le plus, `<nom>_moins` vers le moins). */
  private morph(name: string, value: number): void {
    for (const mesh of this.morphMeshes) {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) continue;
      if (name in dict) influences[dict[name]] = Math.max(0, value);
      if (`${name}_moins` in dict) influences[dict[`${name}_moins`]] = Math.max(0, -value);
    }
  }

  /** Plans de découpe (vue à la 1re personne : le corps derrière la caméra ne se voit pas). */
  clip(planes: THREE.Plane[]): void {
    for (const m of this.materials) m.clippingPlanes = planes;
  }

  /** Applique à l'os `name` la rotation `q`, donnée dans le repère du personnage depuis la pose de repos. */
  private rotate(name: string, q: THREE.Quaternion): void {
    const j = this.joints.get(name);
    if (!j) return;
    j.bone.quaternion.copy(j.parentInverse).multiply(q).multiply(j.parentWorld).multiply(j.rest);
  }

  /** Rotation visée d'un os (elle sera atteinte en douceur par `settle`). */
  private aim(name: string, q: THREE.Quaternion): void {
    this.joints.get(name)?.target.copy(q);
  }

  private axis(axis: THREE.Vector3, angle: number): THREE.Quaternion {
    return new THREE.Quaternion().setFromAxisAngle(axis, angle);
  }

  /** Rotation composée : d'abord autour de Z (écart), puis Y (rotation interne), puis X (balancement). */
  private euler(x: number, y: number, z: number): THREE.Quaternion {
    return this.axis(X, x).multiply(this.axis(Y, y)).multiply(this.axis(Z, z));
  }

  /** Vise la pose d'un bras : épaule (balancement, écart, rotation interne), coude, poignet. */
  private armTo(side: 'g' | 'd', p: ArmPose): void {
    const [upper, fore, hand] = ARM[side];
    const m = side === 'g' ? 1 : -1; // l'écart et le pivot vers le milieu sont symétriques
    // Écart du corps, puis balancement, puis pivot autour de la verticale (`twist` > 0 : la main vers le milieu).
    this.aim(
      upper,
      this.axis(Y, -m * p.twist)
        .multiply(this.axis(X, p.swing))
        .multiply(this.axis(Z, m * p.out)),
    );
    this.aim(fore, this.axis(X, -p.bend));
    this.aim(hand, this.axis(X, p.wrist));
  }

  /** Vise la pose d'une jambe : cuisse (balancement, écart), genou, cheville (le pied reste à peu près à plat). */
  private legTo(side: 'g' | 'd', swing: number, knee: number, spread = 0, flat = 0.55): void {
    const [thigh, shin, foot] = LEG[side];
    const m = side === 'g' ? 1 : -1;
    this.aim(thigh, this.euler(swing, 0, m * spread));
    this.aim(shin, this.axis(X, knee));
    // `flat` : part de la flexion compensée par la cheville (1 : pied à plat, accroupi).
    this.aim(foot, this.axis(X, -(swing + knee) * flat));
  }

  /** Fait glisser chaque articulation vers sa pose visée (`rate` : vivacité, par seconde) et l'applique. */
  private settle(dt: number, rate: number): void {
    const a = 1 - Math.exp(-dt * rate);
    for (const [name, j] of this.joints) {
      j.current.slerp(j.target, a);
      this.rotate(name, j.current);
    }
  }

  /** Remet toutes les articulations dans leur pose de repos (visée et actuelle). */
  private resetPose(): void {
    for (const j of this.joints.values()) {
      j.target.identity();
      j.current.identity();
      j.bone.quaternion.copy(j.rest);
    }
  }

  /**
   * Place un outil dans la main droite (`tool` : ~0,7 m de long, manche vers -z, tête vers +z, pointe vers -y). Bras
   * au repos (pendant, poing fermé), l'outil est tenu par le bas du manche, manche vers l'avant, tête dressée : il
   * suit ensuite la main dans tous les gestes. `size` : échelle de l'outil ; `roll` : rotation autour du manche ;
   * `tilt` : inclinaison du manche dans la main.
   */
  attachHandTool(tool: THREE.Object3D, size = 1.15, roll = 0, tilt = 0): void {
    const hand = this.handBone();
    if (!hand) return;
    this.resetPose();
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const handQ = hand.getWorldQuaternion(new THREE.Quaternion());
    const scale = new THREE.Vector3();
    hand.getWorldScale(scale);
    const rootScale = new THREE.Vector3();
    this.root.getWorldScale(rootScale);
    const holder = new THREE.Object3D();
    // Orientation : celle du personnage (l'outil est aligné sur lui quand le bras est au repos).
    holder.quaternion.copy(handQ.invert().multiply(rootQ));
    // Au creux du poing, un peu le long de l'os (qui descend du poignet vers les doigts).
    holder.position.set(0, (0.075 * rootScale.x) / scale.x, 0);
    holder.scale.setScalar(rootScale.x / scale.x);
    // Inclinaison et rotation sur le manche autour du poing : le manche reste dans la main.
    const grip = new THREE.Object3D();
    grip.rotation.set(tilt, 0, roll);
    holder.add(grip);
    this.toolHolder = holder;
    this.toolGrip = grip;
    // Tenu par le bas du manche : le poing est à 10 % de la longueur depuis le bout.
    tool.position.set(0, 0, 0.3 * size);
    tool.rotation.set(0, 0, 0);
    tool.scale.setScalar(size);
    grip.add(tool);
    hand.add(holder);
  }

  /** Matériaux propres à un modèle porté (gant, manche) : peau et combinaison aux couleurs du joueur, découpe. */
  private tintGlove(root: THREE.Object3D): void {
    const planes = this.materials[0]?.clippingPlanes ?? null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !this.firstPerson;
      mesh.frustumCulled = false;
      const own = (m: THREE.Material): THREE.Material => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        const name = m.name.replace(/\.\d+$/, '');
        const same = this.named.get(name === 'peau_main' ? 'peau' : name);
        if (same) c.color.copy(same.color);
        c.clippingPlanes = planes;
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(own)
        : own(mesh.material as THREE.Material);
    });
  }

  /** Doigts de la main gantée refermés en poing (autour d'un manche), pouce par-dessus l'index. */
  private static clench(glove: THREE.Object3D): void {
    for (const [finger, angles] of Object.entries(FIST))
      angles.forEach((angle, k) => {
        const o = glove.getObjectByName(`${finger}_${k + 1}`);
        if (o) o.rotation.x = angle;
      });
    // Modèle exporté (Y en haut) : la verticale de Blender est l'axe Y ; même ordre que Blender (X puis vertical).
    THUMB.forEach(([x, up], k) =>
      glove.getObjectByName(`pouce_${k + 1}`)?.rotation.set(x, up, 0, 'YXZ'),
    );
  }

  /**
   * Met la main gantée droite autour du manche de l'outil (dans la prise posée par `attachHandTool`) : jointures le
   * long du manche (pouce vers la tête de l'outil), doigts à l'opposé du coude (mesuré à la pose de repos), puis
   * tournée de `roll` autour du manche ; le manche passe dans le creux du poing. Renvoie l'axe du gant (du poignet
   * vers les doigts, dans la prise), ou null sans outil.
   */
  private gripGlove(glove: THREE.Object3D, roll: number, size = GLOVE_SCALE): THREE.Vector3 | null {
    const holder = this.toolHolder;
    const grip = this.toolGrip;
    const fore = this.bones.get(ARM.d[1]);
    if (!holder || !grip || !fore) return null;
    this.tintGlove(glove);
    Avatar.clench(glove);
    this.resetPose();
    this.root.updateMatrixWorld(true);
    const s = new THREE.Vector3(0, 0, 1).applyQuaternion(grip.quaternion);
    const f = holder.worldToLocal(fore.getWorldPosition(new THREE.Vector3())).negate();
    f.addScaledVector(s, -s.dot(f)).normalize().applyAxisAngle(s, roll);
    // Modèle exporté (Y en haut) : pouce vers +X, dos de la main vers +Y, doigts vers +Z.
    const back = new THREE.Vector3().crossVectors(f, s);
    glove.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(s, back, f));
    glove.scale.setScalar(size);
    glove.position.copy(GLOVE_GRIP).multiplyScalar(size).applyQuaternion(glove.quaternion).negate();
    return f;
  }

  /** Prépare un gant à porter ailleurs que sur ce personnage (arme en vue subjective) : couleurs du joueur, poing fermé. */
  dressGlove(glove: THREE.Object3D): void {
    this.tintGlove(glove);
    Avatar.clench(glove);
  }

  /**
   * Repère pour tenir une arme dans la main droite (vues extérieures) : son axe Y est celui du manche de l'outil (là
   * où le poing se referme), son axe Z part vers l'avant de la main (du coude vers les doigts). Une arme posée avec sa
   * poignée le long de Y et le canon vers Z tombe dans le poing ganté. Null sans outil attaché.
   */
  gunMount(): THREE.Object3D | null {
    if (this.mount) return this.mount;
    const holder = this.toolHolder;
    const grip = this.toolGrip;
    const fore = this.bones.get(ARM.d[1]);
    if (!holder || !grip || !fore) return null;
    this.resetPose();
    this.root.updateMatrixWorld(true);
    const s = new THREE.Vector3(0, 0, 1).applyQuaternion(grip.quaternion);
    const f = holder.worldToLocal(fore.getWorldPosition(new THREE.Vector3())).negate();
    f.addScaledVector(s, -s.dot(f)).normalize();
    const x = new THREE.Vector3().crossVectors(s, f);
    this.mount = new THREE.Object3D();
    this.mount.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, s, f));
    holder.add(this.mount);
    return this.mount;
  }

  /**
   * Vues extérieures (3e personne, vue du dessus), style doux : les mains du modèle se replient dans la manche et les
   * mains gantées les remplacent ; la droite serre le manche de l'outil comme en vue subjective, la gauche (le même
   * modèle en miroir) est fermée en poing. À appeler après `attachHandTool` et `look`.
   */
  wearGloves(right: THREE.Object3D, left: THREE.Object3D | null): void {
    const holder = this.toolHolder;
    const handD = this.bones.get(ARM.d[2]);
    const handG = this.bones.get(ARM.g[2]);
    if (!holder || !handD || !this.gripGlove(right, 0, GLOVE_SCALE_OUTSIDE)) return;
    holder.add(right);
    this.cuffs.push({ glove: right, fore: this.bones.get(ARM.d[1])! });
    // Gant gauche : même place dans la main gauche que le droit dans la droite, en miroir (os symétriques).
    if (left && handG) {
      this.tintGlove(left);
      Avatar.clench(left);
      this.root.updateMatrixWorld(true);
      const local = handD.matrixWorld.clone().invert().multiply(right.matrixWorld);
      const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
      local.premultiply(mirror).multiply(mirror);
      local.decompose(left.position, left.quaternion, left.scale);
      left.scale.x *= -1;
      handG.add(left);
      const foreG = this.bones.get(ARM.g[1]);
      if (foreG) this.cuffs.push({ glove: left, fore: foreG });
    }
    // Les mains du modèle (sans doigts) se replient au poignet, cachées par le gant ; ce qui est accroché aux os
    // (outil, gants) garde sa taille.
    for (const hand of [handD, handG]) {
      if (!hand) continue;
      hand.scale.setScalar(HIDDEN_HAND);
      for (const c of hand.children) {
        if ((c as THREE.Bone).isBone) continue;
        c.scale.multiplyScalar(1 / HIDDEN_HAND);
        c.position.multiplyScalar(1 / HIDDEN_HAND);
      }
    }
  }

  /**
   * Vue subjective, style doux : remplace le bras du modèle par la main gantée (`main_gantee`, doigts refermés sur
   * le manche) et la manche de la combinaison (`avant_bras`, étirée sur l'avant-bras). À appeler après
   * `attachHandTool` (la main se place autour du manche) et après `look` (couleurs de peau et de combinaison).
   */
  wearFirstPersonHand(glove: THREE.Object3D, sleeve: THREE.Object3D | null): void {
    const holder = this.toolHolder;
    const fore = this.bones.get(ARM.d[1]);
    if (!holder || !fore) return;
    for (const mesh of this.bodyMeshes) mesh.visible = false;
    const tint = (root: THREE.Object3D): void => this.tintGlove(root);
    const f = this.gripGlove(glove, GLOVE_ROLL);
    if (!f) return;
    holder.add(glove);
    if (!sleeve) return;
    tint(sleeve);
    // La manche prolonge le gant (même axe), la manchette du gant rentre dedans ; elle file hors de l'écran.
    sleeve.quaternion.copy(glove.quaternion);
    sleeve.scale.set(SLEEVE_WIDTH, SLEEVE_WIDTH, SLEEVE_STRETCH);
    sleeve.position
      .copy(glove.position)
      .addScaledVector(f, -(SLEEVE_LENGTH_M * SLEEVE_STRETCH + SLEEVE_TUCK_M));
    holder.add(sleeve);
    this.fpSleeve = {
      sleeve,
      glove,
      axis: f.clone(),
      fore,
      cuff: glove.getObjectByName('manchette') ?? null,
    };
    this.bendWrist();
  }

  /**
   * Poignet souple : la manche part du poignet du gant et se tourne en partie vers le vrai coude du bras animé
   * (`WRIST_FOLLOW`), plus un léger pli au repos (`WRIST_REST_BEND`), sans dépasser `WRIST_MAX_BEND`. Le poignet plie
   * donc pendant l'élan et la frappe au lieu de rester droit.
   */
  private bendWrist(): void {
    const fp = this.fpSleeve;
    if (!fp) return;
    const { sleeve, glove, axis, fore, cuff } = fp;
    const holder = glove.parent;
    if (!holder) return;
    this.root.updateMatrixWorld(true);
    const wrist = glove.position;
    const elbow = holder.worldToLocal(fore.getWorldPosition(new THREE.Vector3()));
    const toElbow = wrist.clone().sub(elbow).normalize();
    // Pli de repos vers le bas de l'écran : l'avant-bras arrive d'en dessous, le poignet est cassé.
    const holderQ = holder.getWorldQuaternion(new THREE.Quaternion()).invert();
    const camQ = (this.root.parent ?? this.root).getWorldQuaternion(new THREE.Quaternion());
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(camQ).applyQuaternion(holderQ);
    down.addScaledVector(axis, -down.dot(axis)).normalize();
    // `axis` va du poignet vers les doigts : l'avant-bras est du côté -axis, le pli le fait descendre.
    const rest = axis
      .clone()
      .multiplyScalar(Math.cos(WRIST_REST_BEND))
      .addScaledVector(down, -Math.sin(WRIST_REST_BEND));
    const dir = rest.lerp(toElbow, WRIST_FOLLOW).normalize();
    const angle = dir.angleTo(axis);
    if (angle > WRIST_MAX_BEND) {
      const n = new THREE.Vector3().crossVectors(axis, dir).normalize();
      dir.copy(axis).applyAxisAngle(n, WRIST_MAX_BEND);
    }
    // La manchette du gant plie au poignet avec l'avant-bras ; la manche la recouvre à moitié.
    if (cuff) {
      const local = dir.clone().applyQuaternion(glove.quaternion.clone().invert());
      cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), local);
    }
    const end = wrist.clone().addScaledVector(dir, -SLEEVE_TUCK_M * GLOVE_SCALE);
    sleeve.quaternion.setFromUnitVectors(axis, dir).multiply(glove.quaternion);
    sleeve.position.copy(end).addScaledVector(dir, -SLEEVE_LENGTH_M * SLEEVE_STRETCH);
  }

  /** Vues extérieures : la manchette de chaque gant se tourne vers le coude (poignet souple, pas de jour avec la manche). */
  private alignCuffs(): void {
    if (this.cuffs.length === 0) return;
    this.root.updateMatrixWorld(true);
    const elbow = new THREE.Vector3();
    const wrist = new THREE.Vector3();
    for (const { glove, fore } of this.cuffs) {
      const cuff = glove.getObjectByName('manchette');
      if (!cuff) continue;
      // Direction du coude vers le poignet, dans le repère du gant (les doigts y sont vers +Z, la manchette vers -Z).
      glove.worldToLocal(fore.getWorldPosition(elbow));
      wrist.set(0, 0, 0);
      const dir = wrist.sub(elbow).normalize();
      const axis = new THREE.Vector3(0, 0, 1);
      const angle = dir.angleTo(axis);
      if (angle > WRIST_MAX_BEND) {
        const n = new THREE.Vector3().crossVectors(axis, dir).normalize();
        dir.copy(axis).applyAxisAngle(n, WRIST_MAX_BEND);
      }
      cuff.quaternion.setFromUnitVectors(axis, dir);
    }
  }

  /** Vue subjective : 0 au repos, 1 au plus haut de l'élan (le bras se rapproche alors du centre de l'écran). */
  get windup(): number {
    if (this.strikeMix <= 0) return 0;
    const p = fpPose(this.strikeT);
    return this.strikeMix * Math.max(0, Math.min(1, (-p.swing - 1.62) / 0.3));
  }

  private handBone(): THREE.Bone | null {
    let found: THREE.Bone | null = null;
    this.root.traverse((o) => {
      if (!found && (o as THREE.Bone).isBone && o.name === 'main_d') found = o as THREE.Bone;
    });
    return found;
  }

  /** `speed` : vitesse (m/s) ; `striking` : le joueur frappe avec son outil ; `dt` en secondes. */
  update(dt: number, speed: number, striking: boolean): void {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    this.amount += (Math.min(1, speed / 2.5) - this.amount) * Math.min(1, dt * 8);
    const run = Math.max(0, Math.min(1, (speed - 3) / 3)); // 0 en marchant, 1 en courant
    this.phase += dt * (2.2 + Math.min(speed, 7) * 1.55);
    // Le coup avance tant qu'on frappe ; le geste en cours se termine en douceur quand on arrête.
    if (striking || (this.strikeMix > 0.02 && this.strikeT > 0.05 && this.strikeT < 0.97))
      this.strikeT = (this.strikeT + dt / STRIKE_PERIOD_S) % 1;
    this.strikeMix += ((striking ? 1 : 0) - this.strikeMix) * Math.min(1, dt * (striking ? 12 : 5));
    if (!striking && this.strikeMix < 0.02) this.strikeT = 0;

    // Saut et accroupi : chaque posture entre et sort en douceur ; la réception dépend de la vitesse de chute.
    if (this.wasAirborne && !this.airborne)
      this.landing = Math.min(1, Math.max(0.25, -this.lastVy / 7));
    this.wasAirborne = this.airborne;
    this.lastVy = this.verticalSpeed;
    this.landing = Math.max(0, this.landing - dt * 3.5);
    this.airMix += ((this.airborne ? 1 : 0) - this.airMix) * Math.min(1, dt * 12);
    const crouchNow = this.crouching && !this.airborne && !this.seated;
    this.crouchMix += ((crouchNow ? 1 : 0) - this.crouchMix) * Math.min(1, dt * 10);

    if (this.firstPerson) {
      this.updateFirstPerson(dt);
      return;
    }
    this.model.position.y = this.modelY;
    if (this.seated) {
      this.updateSeated(dt);
      return;
    }
    const a = this.amount;
    const ph = this.phase;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const stride = (0.5 + 0.25 * run) * a;
    // Jambes : la cuisse balance, le genou plie quand la jambe passe devant (le pied quitte le sol), un peu en appui.
    const kneeG = Math.max(0, c) * (0.85 + 0.5 * run) * a + 0.06 + 0.05 * a;
    const kneeD = Math.max(0, -c) * (0.85 + 0.5 * run) * a + 0.06 + 0.05 * a;
    // Bassin : descend au milieu de chaque pas, tourne avec la jambe qui avance ; buste qui compense.
    const breathe = Math.sin(this.clock * 1.7);
    const strike = this.strikeMix > 0.01 ? strikePose(this.strikeT) : null;
    const k = this.strikeMix;
    const cm = this.crouchMix;
    const am = this.airMix;
    const lean =
      (0.04 + 0.08 * a + 0.12 * run) * (1 - k) +
      (strike ? strike.lean * k : 0) +
      0.6 * cm +
      0.12 * am +
      0.15 * this.landing;
    const knees = (strike ? strike.knees * k : 0) + this.landing * 0.7;
    // Accroupi : cuisses vers l'avant, genoux très pliés, pieds à plat ; on avance à petits pas.
    const cStride = stride * (1 - 0.55 * cm);
    // En l'air : jambes repliées en montant, tendues vers le sol en descendant (vitesse verticale).
    const up = Math.max(-1, Math.min(1, this.verticalSpeed / 4));
    const rising = Math.max(0, up);
    const legPose = (side: 'g' | 'd', walkSwing: number, walkKnee: number): void => {
      let swing = walkSwing * (1 - cm) * (1 - am) - knees * 0.5;
      let knee = walkKnee * (1 - am) + knees;
      swing += cm * (-1.25 + walkSwing * 0.45);
      knee += cm * (2.05 - walkKnee * 0.5 + Math.max(0, walkSwing) * 0.3);
      // En l'air, une jambe un peu plus en avant que l'autre.
      const lead = side === 'g' ? 0.25 : -0.15;
      swing += am * (-0.55 - 0.35 * rising + lead * (1 - rising));
      knee += am * (0.6 + 0.6 * rising + (side === 'g' ? 0.1 : 0.25));
      this.legTo(side, swing, knee, 0.04 * cm, 0.55 + 0.45 * cm);
    };
    legPose('g', -s * cStride, kneeG);
    legPose('d', s * cStride, kneeD);
    this.model.position.y =
      this.modelY -
      (0.035 * a + 0.03 * run) * Math.abs(Math.sin(ph + Math.PI / 2)) * (1 - am) -
      knees * 0.06 -
      cm * Avatar.CROUCH_DROP_M * (this.baseHeight / 1.7) +
      am * 0.04;
    this.aim(
      'bassin',
      this.euler(0, s * 0.14 * a + (strike ? strike.turn * k * 0.4 : 0), c * 0.035 * a),
    );
    this.aim('ventre', this.euler(lean * 0.4, -s * 0.07 * a, 0));
    this.aim(
      'poitrine',
      this.euler(
        lean * 0.6 + breathe * 0.015 * (1 - a),
        -s * 0.12 * a + (strike ? strike.turn * k : 0),
        -c * 0.03 * a,
      ),
    );
    // La tête reste droite (elle compense le buste) et regarde un peu le sol pendant un coup.
    this.aim('cou', this.euler(-lean * 0.5 + (strike ? 0.15 * k : 0), s * 0.1 * a, 0));
    this.aim('tete', this.euler(-lean * 0.3, 0, 0));
    // Bras : à l'opposé des jambes, coude qui plie davantage vers l'avant, un peu écartés.
    const swingG = s * (0.55 + 0.35 * run) * a;
    const swingD = -s * (0.55 + 0.35 * run) * a;
    const rest = (sw: number): ArmPose =>
      arm(
        sw,
        0.1 + 0.02 * breathe * (1 - a),
        0.18 + Math.max(0, -sw) * 0.7 + 0.5 * run,
        0.05,
        0.05,
      );
    const blend = (p: ArmPose, q: ArmPose, t: number): ArmPose => ({
      swing: p.swing + (q.swing - p.swing) * t,
      out: p.out + (q.out - p.out) * t,
      bend: p.bend + (q.bend - p.bend) * t,
      wrist: p.wrist + (q.wrist - p.wrist) * t,
      twist: p.twist + (q.twist - p.twist) * t,
    });
    // Outil en main : tenu devant, manche relevé, tête en haut ; il balance un peu avec la marche.
    const carry = arm(-0.35 + swingD * 0.15, 0.04, 0.85 + 0.06 * Math.sin(ph * 2) * a, 0.55, 0.18);
    let right = this.holding ? carry : rest(swingD);
    let left = rest(swingG);
    // Arme en main : bras tendu vers l'avant (pistolet) ; arme longue épaulée, main gauche sous le garde-main.
    if (this.gunPose === 'pistol') right = GUN_ARM_PISTOL;
    else if (this.gunPose === 'long') {
      right = GUN_ARM_LONG_RIGHT;
      left = GUN_ARM_LONG_LEFT;
    }
    // En l'air : bras écartés et levés pour l'équilibre ; accroupi : bras en avant, près des genoux.
    const balance = (p: ArmPose): ArmPose =>
      blend(
        blend(p, arm(-0.5 - 0.3 * rising, 0.55, 0.45, 0.1, 0), am),
        arm(-0.65, 0.18, 0.75, 0.15, 0.1),
        cm * 0.8,
      );
    if (this.gunPose === 'none') {
      left = balance(left);
      if (!this.holding) right = balance(right);
    }
    if (strike) {
      right = blend(right, strike.right, k);
      left = blend(left, strike.left, k);
    }
    this.armTo('d', right);
    this.armTo('g', left);
    this.settle(dt, strike && k > 0.5 ? 30 : 14);
    this.alignCuffs();
  }

  /** Vue subjective : seul le bras droit se voit ; outil tenu en bas à droite, le coup part vers le centre de l'écran. */
  private updateFirstPerson(dt: number): void {
    const k = this.strikeMix;
    const p = fpPose(this.strikeT);
    const rest = FP_HOLD;
    const mix = (a: number, b: number): number => a + (b - a) * k;
    this.armTo('d', {
      swing: mix(rest.swing, p.swing),
      out: mix(rest.out, p.out),
      bend: mix(rest.bend, p.bend),
      wrist: mix(rest.wrist, p.wrist),
      twist: mix(rest.twist, p.twist),
    });
    this.armTo('g', arm(0, 0.07, 0.2));
    this.settle(dt, k > 0.5 ? 30 : 16);
    this.bendWrist();
  }

  /** Assis : cuisses vers l'avant, genoux pliés, mains devant (volant, guidon). */
  private updateSeated(dt: number): void {
    if (this.seatStyle === 'bike') {
      // Quad : cuisses un peu relevées, pieds sur les repose-pieds devant, buste penché, bras tendus au guidon.
      for (const side of ['g', 'd'] as const) this.legTo(side, -0.95, 0.7, 0.12);
      this.aim('bassin', new THREE.Quaternion());
      this.aim('ventre', this.axis(X, 0.12));
      this.aim('poitrine', this.axis(X, 0.23));
      this.aim('cou', this.axis(X, -0.2));
      this.aim('tete', this.axis(X, -0.1));
      this.armTo('g', arm(-1.12, 0.05, 0.25, 0.1));
      this.armTo('d', arm(-1.12, 0.05, 0.25, 0.1));
    } else {
      for (const side of ['g', 'd'] as const) this.legTo(side, -1.45, 1.45, 0.05);
      this.aim('bassin', new THREE.Quaternion());
      this.aim('ventre', this.axis(X, -0.04));
      this.aim('poitrine', this.axis(X, 0.02));
      this.aim('cou', new THREE.Quaternion());
      this.aim('tete', new THREE.Quaternion());
      this.armTo('g', arm(-0.75, 0.06, 0.6, 0.1));
      this.armTo('d', arm(-0.75, 0.06, 0.6, 0.1));
    }
    this.settle(dt, 10);
    this.alignCuffs();
  }
}
