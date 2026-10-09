import * as THREE from 'three';
import type { PlayerInfo } from '../core/net/protocol';
import { Miner, minerReady } from './minerModel';

/** Teinte propre à chaque joueur (silhouette, mannequin et point de la carte). */
export function playerHue(id: string): number {
  return [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 17);
}

/** Affichage des autres joueurs : une silhouette colorée et leur nom, lissées entre deux envois du réseau. */
export class RemotePlayersView {
  private readonly root = new THREE.Group();
  private readonly shown = new Map<
    string,
    { group: THREE.Group; target: THREE.Vector3; miner: Miner | null }
  >();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  private make(p: PlayerInfo): THREE.Group {
    const hue = playerHue(p.id);
    const color = new THREE.Color().setHSL(hue / 360, 0.6, 0.5);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 1.0, 4, 10),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.85;
    body.castShadow = true;
    body.name = 'capsule';
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf0e0c0 }),
    );
    nose.position.set(0, 1.3, 0.3);
    nose.name = 'capsule';
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
        entry = { group, target: new THREE.Vector3(), miner: null };
        this.shown.set(p.id, entry);
      }
      // Le mannequin articulé remplace la silhouette dès que le fichier est chargé.
      if (!entry.miner && minerReady()) {
        const hue = playerHue(p.id);
        entry.miner = new Miner(1.7, new THREE.Color().setHSL(hue / 360, 0.6, 0.5).getHex());
        entry.miner.root.position.y = 0.85;
        entry.group.add(entry.miner.root);
        for (const child of [...entry.group.children])
          if (child.name === 'capsule') entry.group.remove(child);
      }
      entry.target.set(p.x, p.y, p.z);
      const before = entry.group.position.clone();
      entry.group.position.lerp(entry.target, Math.min(1, dt * 12));
      entry.miner?.update(dt, before.distanceTo(entry.group.position) / Math.max(dt, 1e-3), false);
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
