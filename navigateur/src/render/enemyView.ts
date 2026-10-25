import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { kindOf, type Enemy, type EnemyKind } from '../core/game/threat';

/**
 * Affichage des ennemis : les modèles maison (`blender/scripts/creatures.py`, un fichier par variante) dès qu'ils sont
 * chargés, sinon une « punaise » en formes simples. Les pattes sont en deux trépieds (`pattes_a_*`, `pattes_b_*`) qui
 * balancent en sens contraires quand l'ennemi avance ; le corps (`corps_*`) sautille.
 */
const FILES: Record<EnemyKind, string> = {
  scout: 'ennemi_eclaireur',
  guard: 'ennemi_gardien',
  spitter: 'ennemi_cracheur',
};

interface Shown {
  kind: EnemyKind;
  group: THREE.Group;
  legsA: THREE.Object3D[];
  legsB: THREE.Object3D[];
  body: THREE.Object3D[];
  /** Modèle maison (sinon forme simple, à refaire quand le modèle arrive). */
  own: boolean;
  /** Taille relative (formes simples : les anciennes tailles des variantes). */
  scale: number;
  last: { x: number; z: number } | null;
}

export class EnemyView {
  private readonly root = new THREE.Group();
  private readonly shown = new Map<number, Shown>();
  private readonly templates = new Map<EnemyKind, THREE.Group>();
  private readonly bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a2d3a });
  private readonly guardMat = new THREE.MeshStandardMaterial({ color: 0x3f2a2a });
  private readonly spitterMat = new THREE.MeshStandardMaterial({ color: 0x5f9a3a });
  private readonly legMat = new THREE.MeshStandardMaterial({ color: 0x3b1820 });
  private readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd35a });
  private disposed = false;

  constructor(scene: THREE.Scene, baseUrl = import.meta.env.BASE_URL ?? './') {
    scene.add(this.root);
    for (const kind of Object.keys(FILES) as EnemyKind[]) {
      new GLTFLoader().load(
        `${baseUrl}models/terra/${FILES[kind]}.glb`,
        (gltf) => {
          if (this.disposed) return;
          gltf.scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) o.castShadow = true;
          });
          this.templates.set(kind, gltf.scene);
          // Les ennemis déjà affichés en formes simples prennent le modèle à la prochaine image.
          for (const [id, s] of [...this.shown]) if (s.kind === kind && !s.own) this.drop(id);
        },
        undefined,
        () => undefined,
      );
    }
  }

  /** Forme simple (tant que le modèle n'est pas chargé). */
  private makeSimple(kind: EnemyKind): Shown {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 8),
      kind === 'guard' ? this.guardMat : kind === 'spitter' ? this.spitterMat : this.bodyMat,
    );
    body.scale.set(1, 0.6, 1.3);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    const legsA: THREE.Object3D[] = [];
    const legsB: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      [-0.2, 0.05, 0.3].forEach((z, i) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.06), this.legMat);
        leg.position.set(side * 0.3, 0.12, z);
        leg.rotation.z = side * 0.5;
        g.add(leg);
        ((i % 2 === 0) === side < 0 ? legsA : legsB).push(leg);
      });
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), this.eyeMat);
      eye.position.set(side * 0.13, 0.4, 0.38);
      g.add(eye);
    }
    const scale = kind === 'guard' ? 1.6 : kind === 'spitter' ? 1.2 : 1;
    return { kind, group: g, legsA, legsB, body: [], own: false, scale, last: null };
  }

  private make(kind: EnemyKind): Shown {
    const template = this.templates.get(kind);
    if (!template) return this.makeSimple(kind);
    const g = new THREE.Group();
    const model = template.clone(true);
    g.add(model);
    const legsA: THREE.Object3D[] = [];
    const legsB: THREE.Object3D[] = [];
    const body: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      if (o.name.startsWith('pattes_a')) legsA.push(o);
      else if (o.name.startsWith('pattes_b')) legsB.push(o);
      else body.push(o);
    });
    return { kind, group: g, legsA, legsB, body, own: true, scale: 1, last: null };
  }

  private drop(id: number): void {
    const s = this.shown.get(id);
    if (!s) return;
    this.root.remove(s.group);
    if (!s.own) s.group.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
    this.shown.delete(id);
  }

  /** Place un modèle par ennemi (regardant vers sa cible), pattes et corps animés. */
  update(
    enemies: Enemy[],
    target: (e: Enemy) => { x: number; z: number } | null,
    time: number,
  ): void {
    const alive = new Set<number>();
    for (const e of enemies) {
      const kind = kindOf(e);
      alive.add(e.id);
      let s = this.shown.get(e.id);
      if (s && s.kind !== kind) {
        this.drop(e.id);
        s = undefined;
      }
      if (!s) {
        s = this.make(kind);
        this.shown.set(e.id, s);
        this.root.add(s.group);
      }
      const g = s.group;
      g.scale.setScalar(s.scale * (e.mutant ? 1.4 : 1));
      const aim = target(e);
      // Le modèle regarde vers +z (l'avant du fichier, -Y dans Blender).
      if (aim) g.rotation.y = Math.atan2(aim.x - e.x, aim.z - e.z);
      // Les pattes ne bougent que si l'ennemi avance.
      const moving = !s.last || Math.hypot(e.x - s.last.x, e.z - s.last.z) > 1e-3;
      s.last = { x: e.x, z: e.z };
      const pace = kind === 'scout' ? 14 : kind === 'guard' ? 7 : 10;
      const swing = moving ? Math.sin(time * pace + e.id) * 0.35 : 0;
      for (const l of s.legsA) l.rotation.y = swing;
      for (const l of s.legsB) l.rotation.y = -swing;
      const bob = kind === 'spitter' || !moving ? 0 : Math.abs(Math.sin(time * pace + e.id)) * 0.04;
      g.position.set(e.x, s.own ? 0 : bob, e.z);
      for (const b of s.body) b.position.y = bob;
    }
    for (const id of [...this.shown.keys()]) if (!alive.has(id)) this.drop(id);
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.shown.keys()]) this.drop(id);
    this.root.removeFromParent();
    this.bodyMat.dispose();
    this.guardMat.dispose();
    this.spitterMat.dispose();
    this.legMat.dispose();
    this.eyeMat.dispose();
  }
}
