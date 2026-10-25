/**
 * Dessin des stations : le quai de gare (`gare`, `blender/scripts/ferroviaire.py` : quai, abri vitré, banc,
 * lampadaires ; formes simples tant qu'il n'est pas chargé) et un panneau sur mât avec le nom. Un fantôme montre où la
 * prochaine station se poserait.
 */
import * as THREE from 'three';
import type { Station } from '../core/rail/station';
import type { TrackGraph } from '../core/rail/track';
import { propsMaterial } from './chunkMesh';
import { bakedModel } from './models';
import { vehicleFromModel } from './vehicleModel';

const PLATFORM_LEN = 9;
const PLATFORM_W = 2.4;
const PLATFORM_H = 0.32;
/** Écart (m) entre l'axe de la voie et le milieu du quai (côté droit du sens de marche) et le mât du panneau. */
const SIDE_M = 2.3;
const SIGN_SIDE_M = 3.2;

const platformMat = new THREE.MeshStandardMaterial({ color: 0xb9ad96, roughness: 0.9 });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe0b84a, roughness: 0.8 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x4d4a46, roughness: 0.7 });
const boardMat = new THREE.MeshStandardMaterial({ color: 0x2d5f8b, roughness: 0.6 });

function labelTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#2d5f8b';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#f4efe3';
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#f4efe3';
    g.font = 'bold 56px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, 256, 66, 480);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Un groupe 3D de station, orienté le long de la voie (axe z local = sens de marche). */
function buildStation(name: string, tint?: THREE.Color): THREE.Group {
  const group = new THREE.Group();
  const own = bakedModel('gare');
  if (own) {
    // Modèle maison : centré sur le quai, la voie du côté -x.
    const quai = vehicleFromModel(own, propsMaterial, true).group;
    quai.position.set(SIDE_M, 0, 0);
    group.add(quai);
  }
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM_W, PLATFORM_H, PLATFORM_LEN),
    platformMat,
  );
  platform.position.set(SIDE_M, PLATFORM_H / 2, 0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, PLATFORM_LEN), stripeMat);
  stripe.position.set(SIDE_M - PLATFORM_W / 2 + 0.2, PLATFORM_H + 0.011, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), poleMat);
  pole.position.set(SIGN_SIDE_M, 1.3, -PLATFORM_LEN / 2 + 0.8);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    name
      ? new THREE.MeshBasicMaterial({ map: labelTexture(name), side: THREE.DoubleSide })
      : boardMat,
  );
  board.position.set(SIGN_SIDE_M, 2.5, -PLATFORM_LEN / 2 + 0.8);
  // Le panneau regarde vers la voie (axe x) pour être lu depuis le train.
  board.rotation.y = Math.PI / 2;
  group.add(pole, board);
  if (!own) group.add(platform, stripe);
  if (tint)
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = (o.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
        m.color = tint.clone();
        m.transparent = true;
        m.opacity = 0.55;
        o.material = m;
      }
    });
  return group;
}

export class StationView {
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<number, { key: string; group: THREE.Group }>();
  private ghost: { key: string; group: THREE.Group } | null = null;

  constructor(private readonly scene: THREE.Scene) {
    scene.add(this.root);
  }

  private place(group: THREE.Group, graph: TrackGraph, piece: number, u: number): boolean {
    const pose = graph.pose({ piece, u, dir: 1 });
    if (!pose) return false;
    group.position.set(pose.x, pose.y, pose.z);
    // Axe z local = sens de marche ; le quai est du côté droit.
    group.rotation.y = pose.yaw;
    return true;
  }

  /** Met les stations d'accord avec la partie. */
  sync(stations: readonly Station[], graph: TrackGraph): void {
    const live = new Set<number>();
    for (const s of stations) {
      live.add(s.id);
      const key = `${s.name}|${s.piece}|${s.u.toFixed(2)}|${graph.byId.size}`;
      const have = this.meshes.get(s.id);
      if (have && have.key === key) continue;
      if (have) this.drop(have.group);
      const group = buildStation(s.name);
      if (this.place(group, graph, s.piece, s.u)) {
        this.root.add(group);
        this.meshes.set(s.id, { key, group });
      } else this.meshes.delete(s.id);
    }
    for (const [id, m] of this.meshes)
      if (!live.has(id)) {
        this.drop(m.group);
        this.meshes.delete(id);
      }
  }

  /** Fantôme de la station qu'on s'apprête à poser (null : plus de fantôme). */
  showGhost(graph: TrackGraph, at: { piece: number; u: number } | null, ok: boolean): void {
    if (!at) {
      if (this.ghost) {
        this.drop(this.ghost.group);
        this.ghost = null;
      }
      return;
    }
    const key = `${at.piece}|${at.u.toFixed(2)}|${ok}`;
    if (this.ghost?.key === key) return;
    if (this.ghost) this.drop(this.ghost.group);
    const group = buildStation('', new THREE.Color(ok ? 0x55c878 : 0xd05555));
    if (this.place(group, graph, at.piece, at.u)) {
      this.root.add(group);
      this.ghost = { key, group };
    } else this.ghost = null;
  }

  /** Station que le rayon touche (quai et panneau), avec la distance. */
  pick(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
  ): { id: number; t: number; x: number; y: number; z: number } | null {
    let best: { id: number; t: number; x: number; y: number; z: number } | null = null;
    for (const [id, m] of this.meshes) {
      const g = m.group;
      // Trois sphères le long du quai, à hauteur de poitrine.
      for (const k of [-0.3, 0, 0.3]) {
        const local = new THREE.Vector3(SIDE_M, 0.8, k * PLATFORM_LEN);
        const p = local.applyEuler(g.rotation).add(g.position);
        const wx = p.x - o.x;
        const wy = p.y - o.y;
        const wz = p.z - o.z;
        const t0 = wx * d.x + wy * d.y + wz * d.z;
        if (t0 < 0 || t0 > maxDist) continue;
        const rx = wx - t0 * d.x;
        const ry = wy - t0 * d.y;
        const rz = wz - t0 * d.z;
        if (rx * rx + ry * ry + rz * rz > 1.9 * 1.9) continue;
        if (!best || t0 < best.t)
          best = { id, t: t0, x: g.position.x, y: g.position.y, z: g.position.z };
      }
    }
    return best;
  }

  /** Position du quai d'une station (milieu), pour savoir si le curseur est dessus. */
  platformAt(id: number): { x: number; z: number } | null {
    const g = this.meshes.get(id)?.group;
    if (!g) return null;
    const p = new THREE.Vector3(SIDE_M, 0, 0).applyEuler(g.rotation).add(g.position);
    return { x: p.x, z: p.z };
  }

  private drop(group: THREE.Group): void {
    this.root.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mat = o.material as THREE.Material & { map?: THREE.Texture | null };
        if (mat.map) mat.map.dispose();
        // Le matériau partagé du décor (quai maison) ne se jette pas.
        if (
          mat !== platformMat &&
          mat !== stripeMat &&
          mat !== poleMat &&
          mat !== boardMat &&
          mat !== propsMaterial
        )
          mat.dispose();
      }
    });
  }

  dispose(): void {
    for (const m of this.meshes.values()) this.drop(m.group);
    this.meshes.clear();
    if (this.ghost) this.drop(this.ghost.group);
    this.ghost = null;
    this.scene.remove(this.root);
  }
}
