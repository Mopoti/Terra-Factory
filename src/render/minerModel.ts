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
        // Couleurs par région, d'après la position de repos de chaque sommet.
        source.traverse((o) => {
          const mesh = o as THREE.SkinnedMesh;
          if (!mesh.isSkinnedMesh) return;
          const pos = mesh.geometry.getAttribute('position');
          const colors = new Float32Array(pos.count * 3);
          const suit = new THREE.Color(0xffffff);
          for (let i = 0; i < pos.count; i++) {
            const x = Math.abs(pos.getX(i));
            const y = pos.getY(i);
            const c = y > 8.7 ? SKIN : x > 7 ? SKIN : y < 2.2 ? PANTS : suit;
            colors.set([c.r, c.g, c.b], i * 3);
          }
          mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
  private readonly suit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly scale: number;
  private phase = 0;
  private strike = 0;
  private amount = 0;

  /** `height` : taille du personnage (m) ; `color` : couleur de la combinaison. */
  constructor(height: number, color: number) {
    if (!source) throw new Error('Mineur non chargé');
    const model = cloneSkinned(source) as THREE.Group;
    model.rotation.y = Math.PI;
    model.updateMatrixWorld(true);
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.material = this.suit;
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    this.suit.color.set(color);
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
    this.addHelmet(model);
  }

  /** Place un outil dans la main droite (`tool` : objet de ~0,7 m de long, tête vers +z) : il suit le bras. */
  attachHandTool(tool: THREE.Object3D): void {
    const j = this.joints.get(BONES.armR[2]);
    if (!j) return;
    const rest = new THREE.Quaternion();
    j.bone.getWorldQuaternion(rest);
    const inverse = rest.clone().invert();
    const holder = new THREE.Object3D();
    // Au repos (bras en croix) l'outil est aligné sur les axes du monde : tête vers l'avant, comme un poing fermé.
    holder.quaternion.copy(inverse);
    holder.position.copy(new THREE.Vector3(-1, 0, 0).applyQuaternion(inverse).multiplyScalar(0.7));
    holder.scale.setScalar(1 / this.scale);
    tool.position.set(0, 0, 0);
    tool.rotation.set(0, 0, 0);
    tool.scale.setScalar(1.15);
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
  private arm(side: 'L' | 'R', swing: number, raise = 0): void {
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
    this.rotate(names[1], X, -0.25 - Math.max(0, -swing) * 0.5);
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
