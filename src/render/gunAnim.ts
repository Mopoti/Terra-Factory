/**
 * Animations des armes à feu (modèles en pièces de `blender/scripts/outils.py` : `pistolet`, `fusil`, `sniper`).
 *
 * Au tir : recul de l'arme (en arrière et le canon qui se relève), culasse ou levier d'armement qui recule puis revient,
 * éclair au bout du canon ; pour le sniper, cycle du verrou (lever, tirer, pousser, rabattre).
 * Au rechargement : l'arme s'incline et descend, le chargeur sort le long de son axe et disparaît, un plein remonte,
 * puis on réarme (culasse, levier ou verrou).
 *
 * Les poses sont des fonctions pures du temps (testées) ; `GunRig` les applique aux pièces d'un modèle chargé.
 */
import * as THREE from 'three';

export type GunKind = 'pistol' | 'rifle' | 'sniper';

export interface GunProfile {
  /** Durée du recul (s) et amplitude : recul (m) et relèvement du canon (rad). */
  readonly recoilS: number;
  readonly kickBack: number;
  readonly kickUp: number;
  /** Pièce qui recule au tir (`culasse`, `levier`) et de combien (m) ; le sniper fait plutôt un cycle de verrou. */
  readonly slide: string | null;
  readonly slideBack: number;
  /** Cycle du verrou après chaque tir (s), 0 sans verrou. */
  readonly boltS: number;
  /** Durée du rechargement (s). */
  readonly reloadS: number;
  /** Sortie du chargeur : direction dans le repère du modèle (canon vers +z, haut +y) et distance (m). */
  readonly magDir: readonly [number, number, number];
  readonly magDrop: number;
}

export const GUN_PROFILES: Record<GunKind, GunProfile> = {
  pistol: {
    recoilS: 0.16,
    kickBack: 0.045,
    kickUp: 0.16,
    slide: 'culasse',
    slideBack: 0.028,
    boltS: 0,
    reloadS: 1.1,
    magDir: [0, -0.947, -0.323],
    magDrop: 0.13,
  },
  rifle: {
    recoilS: 0.1,
    kickBack: 0.03,
    kickUp: 0.05,
    slide: 'levier',
    slideBack: 0.05,
    boltS: 0,
    reloadS: 1.6,
    magDir: [0, -0.94, 0.34],
    magDrop: 0.16,
  },
  sniper: {
    recoilS: 0.32,
    kickBack: 0.09,
    kickUp: 0.22,
    slide: null,
    slideBack: 0,
    boltS: 0.9,
    reloadS: 1.8,
    magDir: [0, -1, 0],
    magDrop: 0.2,
  },
};

/** Arme du jeu → modèle. */
export const GUN_FILES: Record<GunKind, string> = {
  pistol: 'pistolet',
  rifle: 'fusil',
  sniper: 'sniper',
};

/** Geste du rechargement : décalage vers le centre et vers le haut (m), canon relevé et arme tournée (rad). */
const RELOAD_SHIFT: readonly [number, number] = [0.06, 0.05];
const RELOAD_RAISE = 0.5;
const RELOAD_ROLL = 0.6;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
/** Douceur : 0 → 1 entre a et b (lissée). */
export const ramp = (t: number, a: number, b: number): number => {
  const u = clamp01((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** Recul au tir (t de 0 à 1 sur `recoilS`) : monte très vite, redescend en douceur. */
export function kick(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return t < 0.18 ? ramp(t, 0, 0.18) : 1 - ramp(t, 0.18, 1);
}

/** Cycle du verrou (t de 0 à 1) : `turn` = levier levé (0 à 1), `pull` = verrou tiré en arrière (0 à 1). */
export function boltCycle(t: number): { turn: number; pull: number } {
  if (t <= 0 || t >= 1) return { turn: 0, pull: 0 };
  return {
    turn: ramp(t, 0, 0.22) * (1 - ramp(t, 0.78, 1)),
    pull: ramp(t, 0.24, 0.48) * (1 - ramp(t, 0.52, 0.76)),
  };
}

export interface ReloadPose {
  /** Arme inclinée sur le côté et descendue (0 à 1). */
  tilt: number;
  /** Chargeur sorti (0 : en place, 1 : au bout de sa course) et visible ou non (entre les deux chargeurs). */
  mag: number;
  magVisible: boolean;
  /** Réarmement à la fin : culasse ou levier tiré (0 à 1), ou cycle du verrou (t du cycle, 0 sans). */
  slide: number;
  bolt: number;
}

/** Pose du rechargement (t de 0 à 1 sur `reloadS`). */
export function reloadPose(kind: GunKind, t: number): ReloadPose {
  if (t <= 0 || t >= 1) return { tilt: 0, mag: 0, magVisible: true, slide: 0, bolt: 0 };
  const tilt = ramp(t, 0, 0.16) * (1 - ramp(t, 0.86, 1));
  const out = ramp(t, 0.12, 0.32);
  const back = 1 - ramp(t, 0.5, 0.72);
  const mag = t < 0.41 ? out : back;
  const magVisible = t < 0.34 || t > 0.48;
  const bolt = kind === 'sniper' ? clamp01((t - 0.74) / 0.24) : 0;
  const slide = kind === 'sniper' ? 0 : ramp(t, 0.76, 0.86) * (1 - ramp(t, 0.88, 0.95));
  return { tilt, mag, magVisible, slide, bolt: bolt > 0 && bolt < 1 ? bolt : 0 };
}

/**
 * Anime une arme chargée (pièces `culasse` / `levier`, `chargeur`, repère `bouche`). `wrapper` contient le modèle ;
 * `barrel` : sens du canon dans le repère du wrapper (+1 : vers +z, -1 : vers -z, comme en vue subjective).
 */
export class GunRig {
  private readonly profile: GunProfile;
  private readonly rest = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion }>();
  private readonly slidePiece: THREE.Object3D | null;
  private readonly mag: THREE.Object3D | null;
  private readonly bolt: THREE.Object3D | null;
  readonly muzzle: THREE.Object3D | null;
  private readonly flash: THREE.Object3D;
  private recoilT = 1;
  private boltT = 1;
  private reloadT = 1;
  private flashLife = 0;

  constructor(
    readonly kind: GunKind,
    private readonly wrapper: THREE.Object3D,
    private readonly barrel: 1 | -1,
  ) {
    this.profile = GUN_PROFILES[kind];
    const find = (name: string): THREE.Object3D | null => wrapper.getObjectByName(name) ?? null;
    this.slidePiece = this.profile.slide ? find(this.profile.slide) : null;
    this.mag = find('chargeur');
    this.bolt = kind === 'sniper' ? find('culasse') : null;
    this.muzzle = find('bouche');
    for (const o of [this.slidePiece, this.mag, this.bolt, wrapper])
      if (o) this.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
    this.flash = makeFlash();
    this.flash.visible = false;
    (this.muzzle ?? wrapper).add(this.flash);
  }

  /** En train de recharger (ou de manœuvrer le verrou) : on ne tire pas. */
  get busy(): boolean {
    return this.reloadT < 1 || this.boltT < 1;
  }

  fire(): void {
    this.recoilT = 0;
    if (this.profile.boltS > 0) this.boltT = -this.profile.recoilS / this.profile.boltS;
    this.flashLife = 0.05;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.8 + Math.random() * 0.5);
  }

  reload(): void {
    this.reloadT = 0;
  }

  /** Tout remettre au repos (changement d'arme). */
  reset(): void {
    this.recoilT = this.boltT = this.reloadT = 1;
    this.flashLife = 0;
    this.apply();
  }

  update(dt: number): void {
    const pr = this.profile;
    if (this.recoilT < 1) this.recoilT = Math.min(1, this.recoilT + dt / pr.recoilS);
    if (this.boltT < 1) this.boltT = Math.min(1, this.boltT + dt / pr.boltS);
    if (this.reloadT < 1) this.reloadT = Math.min(1, this.reloadT + dt / pr.reloadS);
    this.flashLife = Math.max(0, this.flashLife - dt);
    this.apply();
  }

  private apply(): void {
    const pr = this.profile;
    const k = kick(this.recoilT);
    const r = reloadPose(this.kind, this.reloadT);
    // Arme entière : recul, canon relevé ; au rechargement, relevée, ramenée vers le centre et tournée pour montrer
    // le logement du chargeur.
    const w = this.rest.get(this.wrapper);
    if (w) {
      this.wrapper.position.copy(w.p);
      this.wrapper.position.z -= this.barrel * pr.kickBack * k;
      this.wrapper.position.x -= RELOAD_SHIFT[0] * r.tilt;
      this.wrapper.position.y += RELOAD_SHIFT[1] * r.tilt;
      this.wrapper.quaternion.copy(w.q);
      this.wrapper.rotateX(-this.barrel * (pr.kickUp * k + RELOAD_RAISE * r.tilt));
      this.wrapper.rotateZ(this.barrel * RELOAD_ROLL * r.tilt);
    }
    // Culasse ou levier : recule au tir, puis au réarmement.
    if (this.slidePiece) {
      const s = this.rest.get(this.slidePiece);
      const back = Math.max(k, r.slide);
      if (s) this.slidePiece.position.set(s.p.x, s.p.y, s.p.z - pr.slideBack * back);
    }
    // Verrou du sniper : lever, tirer, pousser, rabattre.
    if (this.bolt) {
      const s = this.rest.get(this.bolt);
      const c = boltCycle(r.bolt > 0 ? r.bolt : this.boltT);
      if (s) {
        this.bolt.position.set(s.p.x, s.p.y, s.p.z - 0.075 * c.pull);
        this.bolt.quaternion.copy(s.q);
        this.bolt.rotateZ(-1.1 * c.turn);
      }
    }
    // Chargeur : sort le long de son axe, disparaît, le plein remonte.
    if (this.mag) {
      const s = this.rest.get(this.mag);
      const [dx, dy, dz] = pr.magDir;
      if (s)
        this.mag.position.set(
          s.p.x + dx * pr.magDrop * r.mag,
          s.p.y + dy * pr.magDrop * r.mag,
          s.p.z + dz * pr.magDrop * r.mag,
        );
      this.mag.visible = r.magVisible;
    }
    this.flash.visible = this.flashLife > 0;
  }
}

let flashGeometry: THREE.BufferGeometry | null = null;
let flashMaterial: THREE.MeshBasicMaterial | null = null;

/** Éclair au bout du canon : étoile jaune orangé (deux plans croisés et un plan de face), lumineuse. */
function makeFlash(): THREE.Object3D {
  if (!flashGeometry) {
    const star = new THREE.Shape();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.07 : 0.025;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    flashGeometry = new THREE.ShapeGeometry(star);
    flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc55a,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }
  const g = new THREE.Group();
  const face = new THREE.Mesh(flashGeometry, flashMaterial!);
  const side = new THREE.Mesh(flashGeometry, flashMaterial!);
  side.rotation.y = Math.PI / 2;
  side.scale.set(1, 0.6, 1);
  side.position.z = 0.05;
  const top = side.clone();
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  g.add(face, side, top);
  g.renderOrder = 5;
  return g;
}
