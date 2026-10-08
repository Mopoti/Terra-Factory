import * as THREE from 'three';
import type { PlayerInfo } from '../core/net/protocol';

/** Affichage des autres joueurs : une silhouette colorée et leur nom, lissées entre deux envois du réseau. */
export class RemotePlayersView {
  private readonly root = new THREE.Group();
  private readonly shown = new Map<string, { group: THREE.Group; target: THREE.Vector3 }>();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  private make(p: PlayerInfo): THREE.Group {
    const hue = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 17);
    const color = new THREE.Color().setHSL(hue / 360, 0.6, 0.5);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.0, 4, 10),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.85;
    body.castShadow = true;
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf0e0c0 }),
    );
    nose.position.set(0, 1.3, 0.3);
    g.add(body, nose);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 8, 256, 48);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.name, 128, 44);
    }
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
    );
    label.scale.set(1.6, 0.4, 1);
    label.position.y = 2.1;
    label.renderOrder = 10;
    g.add(label);
    return g;
  }

  /** `players` : tous les joueurs reçus ; `selfId` est ignoré. `dt` lisse les déplacements. */
  update(players: PlayerInfo[], selfId: string, dt: number): void {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === selfId) continue;
      seen.add(p.id);
      let entry = this.shown.get(p.id);
      if (!entry) {
        const group = this.make(p);
        group.position.set(p.x, p.y, p.z);
        this.root.add(group);
        entry = { group, target: new THREE.Vector3() };
        this.shown.set(p.id, entry);
      }
      entry.target.set(p.x, p.y, p.z);
      entry.group.position.lerp(entry.target, Math.min(1, dt * 12));
      entry.group.rotation.y = p.yaw;
    }
    for (const [id, entry] of this.shown) {
      if (seen.has(id)) continue;
      this.root.remove(entry.group);
      this.shown.delete(id);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.shown.clear();
  }
}
