import * as THREE from 'three';
import type { Enemy } from '../core/game/threat';

/** Affichage des ennemis : des « punaises » sombres à pattes, une forme simple par ennemi (réutilisée). */
export class EnemyView {
  private readonly root = new THREE.Group();
  private readonly pool: THREE.Group[] = [];
  private readonly bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a2d3a });
  private readonly legMat = new THREE.MeshStandardMaterial({ color: 0x3b1820 });
  private readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd35a });

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  private make(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), this.bodyMat);
    body.scale.set(1, 0.6, 1.3);
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    for (const side of [-1, 1]) {
      for (const z of [-0.2, 0.05, 0.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.06), this.legMat);
        leg.position.set(side * 0.3, 0.12, z);
        leg.rotation.z = side * 0.5;
        g.add(leg);
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), this.eyeMat);
      eye.position.set(side * 0.13, 0.4, 0.38);
      g.add(eye);
    }
    return g;
  }

  /** Place une forme par ennemi (regardant vers sa cible). */
  update(
    enemies: Enemy[],
    target: (e: Enemy) => { x: number; z: number } | null,
    time: number,
  ): void {
    while (this.pool.length < enemies.length) {
      const g = this.make();
      this.pool.push(g);
      this.root.add(g);
    }
    this.pool.forEach((g, i) => {
      const e = enemies[i];
      g.visible = !!e;
      if (!e) return;
      const aim = target(e);
      g.position.set(e.x, 0, e.z);
      if (aim) g.rotation.y = Math.atan2(aim.x - e.x, aim.z - e.z);
      // Petit sautillement.
      g.position.y = Math.abs(Math.sin(time * 9 + e.id)) * 0.05;
    });
  }

  dispose(): void {
    this.root.removeFromParent();
    this.bodyMat.dispose();
    this.legMat.dispose();
    this.eyeMat.dispose();
    for (const g of this.pool) g.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
  }
}
