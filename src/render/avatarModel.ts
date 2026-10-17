/**
 * Personnage du joueur fait pour le jeu (`blender/scripts/personnage.py`, voir `docs/personnage.md`) : homme ou femme,
 * même squelette (`bassin`, `cuisse_g`, `bras_d`…), en mètres, l'avant vers +z. Un matériau par teinte : la combinaison
 * prend la couleur du joueur ; peau, cheveux, bandes et yeux gardent la leur (réglables plus tard dans le profil).
 * La marche et le geste de frappe sont calculés ici en tournant les os, comme pour le mannequin provisoire
 * (`minerModel.ts`), qui reste utilisé tant que ces fichiers ne sont pas chargés.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Silhouette = 'homme' | 'femme';

/** Taille du personnage dans le fichier (m), de la plante des pieds au sommet du crâne. */
const MODEL_HEIGHT_M = 1.8;

const sources = new Map<Silhouette, THREE.Group>();
let loading: Promise<boolean> | null = null;

export const avatarReady = (): boolean => sources.size === 2;

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
const LEG = { g: ['cuisse_g', 'jambe_g'], d: ['cuisse_d', 'jambe_d'] };

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** Rotation de repos du parent par rapport au personnage, et son inverse. */
  parentWorld: THREE.Quaternion;
  parentInverse: THREE.Quaternion;
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Avatar {
  readonly root = new THREE.Group();
  /** Matériau de la combinaison. */
  readonly suit: THREE.MeshStandardMaterial;
  private readonly materials: THREE.Material[] = [];
  private readonly joints = new Map<string, Joint>();
  private readonly firstPerson: boolean;
  private phase = 0;
  private strike = 0;
  private amount = 0;

  /** `height` : taille (m) ; `color` : couleur de la combinaison ; `silhouette` : homme ou femme. */
  constructor(
    height: number,
    color: number,
    options: { firstPerson?: boolean; silhouette?: Silhouette } = {},
  ) {
    this.firstPerson = options.firstPerson ?? false;
    const source = sources.get(options.silhouette ?? 'homme');
    if (!source) throw new Error('Personnage non chargé');
    const model = cloneSkinned(source) as THREE.Group;
    const byName = new Map<string, THREE.MeshStandardMaterial>();
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh && !(mesh as unknown as THREE.Mesh).isMesh) return;
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
    });
    this.suit = byName.get('combinaison') ?? new THREE.MeshStandardMaterial();
    this.suit.color.setHex(color);
    // Les bandes : une teinte plus claire de la même couleur, pour que chaque joueur reste reconnaissable.
    const stripe = byName.get('bande');
    if (stripe) stripe.color.setHex(color).offsetHSL(0.08, 0.1, 0.22);

    model.updateMatrixWorld(true);
    for (const name of [...ARM.g, ...ARM.d, ...LEG.g, ...LEG.d]) {
      const bone = bones.get(name);
      if (!bone) continue;
      const parentWorld = new THREE.Quaternion();
      bone.parent?.getWorldQuaternion(parentWorld);
      this.joints.set(name, {
        bone,
        rest: bone.quaternion.clone(),
        parentWorld,
        parentInverse: parentWorld.clone().invert(),
      });
    }
    const k = height / MODEL_HEIGHT_M;
    model.scale.setScalar(k);
    model.position.y = -height / 2;
    this.root.add(model);
  }

  /** Plans de découpe (vue à la 1re personne : le corps derrière la caméra ne se voit pas). */
  clip(planes: THREE.Plane[]): void {
    for (const m of this.materials) m.clippingPlanes = planes;
  }

  /** Tourne l'os `name` de `angle` autour d'un axe donné dans le repère du personnage (depuis la pose de repos). */
  private rotate(name: string, q: THREE.Quaternion): void {
    const j = this.joints.get(name);
    if (!j) return;
    j.bone.quaternion.copy(j.parentInverse).multiply(q).multiply(j.parentWorld).multiply(j.rest);
  }

  private axis(axis: THREE.Vector3, angle: number): THREE.Quaternion {
    return new THREE.Quaternion().setFromAxisAngle(axis, angle);
  }

  /** Bras : un peu écarté du corps, balancé d'avant en arrière (angle négatif = vers l'avant), coude plié. */
  private arm(side: 'g' | 'd', swing: number, raise = 0, bend = 0.2): void {
    const [upper, fore] = ARM[side];
    const out = side === 'g' ? 0.07 : -0.07;
    this.rotate(upper, this.axis(X, swing + raise).multiply(this.axis(Z, out)));
    this.rotate(fore, this.axis(X, -bend - Math.max(0, -swing) * 0.5));
  }

  private leg(side: 'g' | 'd', swing: number): void {
    const [thigh, shin] = LEG[side];
    this.rotate(thigh, this.axis(X, swing));
    this.rotate(shin, this.axis(X, Math.max(0, -swing) * 1.1));
  }

  /**
   * Place un outil dans la main droite (`tool` : ~0,7 m de long, tête vers +z, pointe vers -y) : il suit le bras et,
   * au moment du coup (bras tendu vers l'avant), la tête pointe vers l'avant et la pointe vers le bas.
   */
  attachHandTool(tool: THREE.Object3D, size = 1.15): void {
    const j = this.joints.get(ARM.d[2]) ?? this.joints.get(ARM.d[1]);
    const hand = this.handBone();
    if (!j || !hand) return;
    const rootInverse = new THREE.Quaternion();
    const relative = (): THREE.Quaternion => {
      this.root.updateMatrixWorld(true);
      this.root.getWorldQuaternion(rootInverse).invert();
      return rootInverse.clone().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
    };
    // Pose du coup : bras droit tendu vers l'avant, coude plié.
    this.arm('g', 0);
    this.arm('d', 0, this.firstPerson ? -1.5 : -1.0, 0.6);
    const impact = relative();
    for (const joint of this.joints.values()) joint.bone.quaternion.copy(joint.rest);
    this.root.updateMatrixWorld(true);
    const scale = new THREE.Vector3();
    hand.getWorldScale(scale);
    const rootScale = new THREE.Vector3();
    this.root.getWorldScale(rootScale);
    const holder = new THREE.Object3D();
    holder.quaternion.copy(impact.invert());
    // Au creux de la main, un peu le long de l'os (qui descend du poignet vers les doigts).
    holder.position.set(0, (0.07 * rootScale.x) / scale.x, 0);
    holder.scale.setScalar(rootScale.x / scale.x);
    tool.position.set(0, 0, 0.21 * size);
    tool.rotation.set(0, 0, 0);
    tool.scale.setScalar(size);
    holder.add(tool);
    hand.add(holder);
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
    this.amount += (Math.min(1, speed / 2.5) - this.amount) * Math.min(1, dt * 10);
    this.phase += dt * (3 + Math.min(speed, 6) * 1.6);
    this.strike += dt * 7.5;
    const s = Math.sin(this.phase) * 0.6 * this.amount;
    if (this.firstPerson) {
      const t = 0.5 + 0.5 * Math.sin(this.strike);
      const bob = Math.sin(this.phase * 0.5) * 0.04 * this.amount;
      this.arm('g', 0);
      this.arm('d', 0, -(striking ? 1.5 + 1.0 * t : 1.7) + bob, striking ? 0.6 : 0.9);
      return;
    }
    this.leg('g', s);
    this.leg('d', -s);
    this.arm('g', -s * 0.8);
    if (striking) {
      const t = 0.5 + 0.5 * Math.sin(this.strike);
      this.arm('d', 0, -(0.6 + 1.9 * t));
    } else this.arm('d', s * 0.8);
  }
}
