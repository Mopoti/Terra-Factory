/**
 * Le personnage : un mannequin articulé (« 3D Rigged Character », CC0 — voir `docs/modeles3d.md`) équipé d'un casque
 * à lampe. Le fichier n'a ni matériau ni animation : les couleurs viennent de la hauteur des sommets (tête, torse,
 * jambes, mains) et la marche comme le geste de frappe sont calculés ici en tournant les os.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Hauteur du modèle dans le fichier (de la plante des pieds au sommet du crâne) et position de ses pieds. */
const FOOT_Y = -6.5;
const HEAD_TOP_Y = 11.43;
const SKIN = new THREE.Color(0xe0b38a);
const PANTS = new THREE.Color(0x4a5d7e);

let source: THREE.Group | null = null;
let loading: Promise<boolean> | null = null;

export const minerReady = (): boolean => source !== null;

/** Charge (une seule fois) le fichier ; false en cas d'échec : le joueur garde sa capsule. */
export function loadMiner(baseUrl = import.meta.env.BASE_URL ?? './'): Promise<boolean> {
  loading ??= new Promise((resolve) => {
    new GLTFLoader().load(
      `${baseUrl}models/character/miner.glb`,
      (gltf) => {
        source = gltf.scene;
        // Région de chaque sommet, d'après sa position de repos : 0 = combinaison, 1 = peau, 2 = pantalon.
        source.traverse((o) => {
          const mesh = o as THREE.SkinnedMesh;
          if (!mesh.isSkinnedMesh) return;
          const pos = mesh.geometry.getAttribute('position');
          const region = new Uint8Array(pos.count);
          for (let i = 0; i < pos.count; i++) {
            const x = Math.abs(pos.getX(i));
            const y = pos.getY(i);
            region[i] = y > 8.7 || x > 7 ? 1 : y < 2.2 ? 2 : 0;
          }
          mesh.geometry.setAttribute('region', new THREE.BufferAttribute(region, 1));
        });
        resolve(true);
      },
      undefined,
      () => resolve(false),
    );
  });
  return loading;
}

const BONES = {
  spine: 'Bone',
  head: 'Bone002',
  /**
   * Le mannequin du fichier regarde vers -z : on le tourne d'un demi-tour pour qu'il regarde vers +z comme le jeu. Son
   * côté -x devient alors le côté +x du monde, c'est-à-dire la gauche du personnage.
   */
  armL: ['Bone004', 'Bone008', 'Bone009'],
  armR: ['Bone005', 'Bone006', 'Bone007'],
  legL: ['Bone011', 'Bone012', 'Bone015'],
  legR: ['Bone013', 'Bone014', 'Bone016'],
} as const;

interface Joint {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** Rotation de repos du parent, dans le monde : sert à exprimer un axe du monde dans le repère de l'os. */
  parentInverse: THREE.Quaternion;
  parentWorld: THREE.Quaternion;
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tmp = new THREE.Quaternion();
const tmp2 = new THREE.Quaternion();

export class Miner {
  readonly root = new THREE.Group();
  private readonly joints = new Map<string, Joint>();
  /** Matériau du corps (public : la vue à la 1re personne le découpe derrière la caméra). */
  readonly suit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly firstPerson: boolean;
  private readonly scale: number;
  private phase = 0;
  private strike = 0;
  private amount = 0;

  /** `height` : taille du personnage (m) ; `color` : couleur de la combinaison. */
  constructor(height: number, color: number, options: { firstPerson?: boolean } = {}) {
    this.firstPerson = options.firstPerson ?? false;
    if (!source) throw new Error('Mineur non chargé');
    const model = cloneSkinned(source) as THREE.Group;
    model.rotation.y = Math.PI;
    model.updateMatrixWorld(true);
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        // Couleurs propres à ce joueur : la combinaison prend sa couleur, la peau et le pantalon gardent la leur.
        mesh.geometry = mesh.geometry.clone();
        const region = mesh.geometry.getAttribute('region');
        const colors = new Float32Array(region.count * 3);
        const suitColor = new THREE.Color(color);
        for (let i = 0; i < region.count; i++) {
          const c = region.getX(i) === 1 ? SKIN : region.getX(i) === 2 ? PANTS : suitColor;
          colors.set([c.r, c.g, c.b], i * 3);
        }
        mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        mesh.material = this.suit;
        mesh.castShadow = !this.firstPerson;
        mesh.frustumCulled = false;
      }
    });
    const names = [
      BONES.spine,
      BONES.head,
      ...BONES.armL,
      ...BONES.armR,
      ...BONES.legL,
      ...BONES.legR,
    ];
    for (const name of names) {
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
    const k = height / (HEAD_TOP_Y - FOOT_Y);
    this.scale = k;
    model.scale.setScalar(k);
    model.position.y = -FOOT_Y * k - height / 2;
    this.root.add(model);
    if (!this.firstPerson) this.addHelmet(model);
  }

  /**
   * Place un outil dans la main droite (`tool` : objet de ~0,7 m de long, tête vers +z, pointe vers -y) : il suit le
   * bras. Il est orienté pour que, au moment du coup (bras tendu vers l'avant), la tête pointe vers l'avant et la
   * pointe vers le bas ; il se lève avec le bras pour l'élan.
   */
  attachHandTool(tool: THREE.Object3D, size = 1.15): void {
    const j = this.joints.get(BONES.armR[2]);
    if (!j) return;
    // Orientation de l'os de la main par rapport au personnage (indépendante de sa position dans le monde).
    const rootInverse = new THREE.Quaternion();
    const relative = (): THREE.Quaternion => {
      this.root.updateMatrixWorld(true);
      this.root.getWorldQuaternion(rootInverse).invert();
      return rootInverse.clone().multiply(j.bone.getWorldQuaternion(new THREE.Quaternion()));
    };
    const rest = relative();
    // Pose du coup : bras droit tendu vers l'avant, coude plié.
    this.arm('L', 0);
    this.arm('R', 0, this.firstPerson ? -1.5 : -1.0, 0.6);
    const impact = relative();
    for (const joint of this.joints.values()) joint.bone.quaternion.copy(joint.rest);
    this.root.updateMatrixWorld(true);
    const holder = new THREE.Object3D();
    holder.quaternion.copy(impact.invert());
    // La main est au bout du bras : on décale l'outil le long de l'os (à plat, le bras part vers -x).
    holder.position.copy(
      new THREE.Vector3(-1, 0, 0).applyQuaternion(rest.clone().invert()).multiplyScalar(0.7),
    );
    holder.scale.setScalar(1 / this.scale);
    tool.position.set(0, 0, 0);
    tool.rotation.set(0, 0, 0);
    tool.scale.setScalar(size);
    holder.add(tool);
    j.bone.add(holder);
  }

  /** Casque jaune et lampe : posés sur le modèle (retourné d'un demi-tour : l'avant est donc du côté -z du fichier) (pas sur l'os, la tête ne bouge pas). */
  private addHelmet(model: THREE.Object3D): void {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.6 }),
    );
    helmet.position.set(0, 10.1, 0);
    helmet.castShadow = true;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.6 }),
    );
    brim.position.set(0, 10.2, -0.2);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.7, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfff3b0,
        emissive: 0xffe680,
        emissiveIntensity: 1.2,
      }),
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 11.0, -2.1);
    model.add(helmet, brim, lamp);
  }

  /** Tourne l'os `name` de `angle` autour d'un axe donné dans le monde (par rapport à sa pose de repos). */
  private rotate(name: string, axis: THREE.Vector3, angle: number, then?: THREE.Quaternion): void {
    const j = this.joints.get(name);
    if (!j) return;
    tmp.setFromAxisAngle(axis.clone().applyQuaternion(j.parentInverse).normalize(), angle);
    if (then) tmp.premultiply(then);
    j.bone.quaternion.copy(tmp).multiply(j.rest);
  }

  /** Bras : on l'abaisse le long du corps (autour de z), puis on le balance d'avant en arrière (autour de x). */
  private arm(side: 'L' | 'R', swing: number, raise = 0, bend = 0.25): void {
    const names = side === 'L' ? BONES.armL : BONES.armR;
    const down = side === 'L' ? -1.35 : 1.35;
    const j = this.joints.get(names[0]);
    if (!j) return;
    tmp2.setFromAxisAngle(Z, down);
    const swingQ = new THREE.Quaternion().setFromAxisAngle(X, swing + raise);
    // Monde : d'abord abaisser, puis balancer = swingQ * downQ.
    const world = swingQ.multiply(tmp2);
    j.bone.quaternion.copy(
      j.parentInverse.clone().multiply(world).multiply(j.parentWorld).multiply(j.rest),
    );
    // Coude : légèrement plié vers l'avant.
    this.rotate(names[1], X, -bend - Math.max(0, -swing) * 0.5);
  }

  private leg(side: 'L' | 'R', swing: number): void {
    const names = side === 'L' ? BONES.legL : BONES.legR;
    this.rotate(names[0], X, swing);
    this.rotate(names[1], X, Math.max(0, -swing) * 1.1);
  }

  /** `speed` : vitesse (m/s) ; `striking` : le joueur frappe avec son outil ; `dt` en secondes. */
  update(dt: number, speed: number, striking: boolean): void {
    this.amount += (Math.min(1, speed / 2.5) - this.amount) * Math.min(1, dt * 10);
    this.phase += dt * (3 + Math.min(speed, 6) * 1.6);
    this.strike += dt * 7.5;
    const s = Math.sin(this.phase) * 0.7 * this.amount;
    if (this.firstPerson) {
      // Vue subjective : seul le bras droit compte, tendu devant soi ; il se lève puis s'abat quand on frappe.
      const t = 0.5 + 0.5 * Math.sin(this.strike);
      const bob = Math.sin(this.phase * 0.5) * 0.04 * this.amount;
      this.arm('L', 0);
      this.arm('R', 0, -(striking ? 1.5 + 1.0 * t : 1.7) + bob, striking ? 0.6 : 0.9);
      return;
    }
    this.leg('L', s);
    this.leg('R', -s);
    this.arm('L', -s * 0.8);
    if (striking) {
      // Bras droit levé au-dessus de la tête, puis abattu vers l'avant (angle négatif = vers l'avant).
      const t = 0.5 + 0.5 * Math.sin(this.strike);
      this.arm('R', 0, -(0.6 + 1.9 * t));
    } else this.arm('R', s * 0.8);
  }
}
