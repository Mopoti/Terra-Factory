import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { RISE_DIR } from '../core/data/buildings';
import { itemById } from '../core/data/items';
import { machineDef, type MachineType } from '../core/data/machines';
import { dims, outputCell, type Factory, type Machine } from '../core/factory/factory';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';

const BELT_H = 0.12;
const BELT_W = 0.42;
const GREEN: Rgb = { r: 0.33, g: 0.88, b: 0.48 };
const RED: Rgb = { r: 1, g: 0.35, b: 0.3 };

const center = (g: number): number => (g + 0.5) * CELL_SIZE_M;

function geometryOf(mb: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(mb.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(mb.colors, 3));
  return g;
}

/** Face horizontale dont la normale regarde vers le haut. */
function flatTri(
  mb: MeshBuilder,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  y: number,
  color: Rgb,
): void {
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const pts = cross > 0 ? [a, c, b] : [a, b, c];
  mb.tri([pts[0][0], y, pts[0][1]], [pts[1][0], y, pts[1][1]], [pts[2][0], y, pts[2][1]], color);
}

/** Côté d'où arrivent les objets sur un tapis : un tapis ou une machine qui débouche sur lui. */
export function beltEntry(
  factory: Factory,
  m: Machine,
): { ex: number; ez: number; curved: boolean } {
  const [dx, dz] = RISE_DIR[m.rot];
  const feeds = (n: Machine | null): boolean => {
    if (!n || n === m) return false;
    const front =
      n.type === 'conveyor'
        ? { gx: n.gx + RISE_DIR[n.rot][0], gz: n.gz + RISE_DIR[n.rot][1] }
        : outputCell(n.type, n.gx, n.gz, n.rot);
    return front.gx === m.gx && front.gz === m.gz;
  };
  // Derrière : tout droit.
  if (feeds(factory.machineAt(m.gx - dx, m.gz - dz))) return { ex: -dx, ez: -dz, curved: false };
  // Sur les côtés : virage.
  for (const [sx, sz] of [
    [-dz, dx],
    [dz, -dx],
  ]) {
    if (feeds(factory.machineAt(m.gx + sx, m.gz + sz))) return { ex: sx, ez: sz, curved: true };
  }
  return { ex: -dx, ez: -dz, curved: false };
}

/** Dessine les machines et les tapis (corps fixes), les objets sur les tapis (dynamiques) et l'aperçu de pose. */
export class FactoryView {
  private readonly root = new THREE.Group();
  private bodies = new THREE.Mesh();
  private items = new THREE.Mesh();
  private readonly ghost = new THREE.Mesh();
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  private entries = new Map<number, { ex: number; ez: number; curved: boolean }>();
  private ghostKey = '';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: Factory,
  ) {
    this.bodies.material = propsMaterial;
    this.items.material = propsMaterial;
    this.ghost.material = this.ghostMaterial;
    this.ghost.visible = false;
    this.ghost.renderOrder = 6;
    this.bodies.castShadow = true;
    this.items.castShadow = false;
    this.root.add(this.bodies, this.items);
    scene.add(this.root, this.ghost);
    this.rebuild();
  }

  /** Refait les corps des machines (à appeler quand on en pose ou en retire). */
  rebuild(): void {
    this.factory.reindex();
    const mb = new MeshBuilder();
    this.entries.clear();
    for (const m of this.factory.machines) {
      if (m.type === 'conveyor') {
        const entry = beltEntry(this.factory, m);
        this.entries.set(m.id, entry);
        addBelt(mb, m.gx, m.gz, m.rot, entry, hexToRgb(machineDef('conveyor').color));
      } else addMachineBody(mb, m.type, m.gx, m.gz, m.rot);
    }
    this.bodies.geometry.dispose();
    this.bodies.geometry = geometryOf(mb);
    this.updateItems();
  }

  /** Remet les objets à leur place sur les tapis (quelques fois par seconde suffit). */
  updateItems(): void {
    const mb = new MeshBuilder();
    for (const m of this.factory.machines) {
      if (m.type !== 'conveyor' || m.belt.length === 0) continue;
      const entry = this.entries.get(m.id) ?? beltEntry(this.factory, m);
      const [dx, dz] = RISE_DIR[m.rot];
      for (const b of m.belt) {
        // Trajet : du bord d'entrée au centre, puis du centre au bord de sortie.
        const cx = center(m.gx);
        const cz = center(m.gz);
        let x: number;
        let z: number;
        if (b.pos < 0.5) {
          const k = (0.5 - b.pos) * CELL_SIZE_M;
          x = cx + entry.ex * k;
          z = cz + entry.ez * k;
        } else {
          const k = (b.pos - 0.5) * CELL_SIZE_M;
          x = cx + dx * k;
          z = cz + dz * k;
        }
        mb.box(x, BELT_H, z, 0.15, 0.13, 0.15, hexToRgb(itemById(b.item).color), true);
      }
    }
    this.items.geometry.dispose();
    this.items.geometry = geometryOf(mb);
  }

  /** Aperçu d'une ou plusieurs machines à poser : vert si possible, rouge sinon. */
  showGhost(list: { type: MachineType; gx: number; gz: number; rot: number; ok: boolean }[]): void {
    if (list.length === 0) {
      this.hideGhost();
      return;
    }
    const key = list.map((g) => `${g.type}${g.gx},${g.gz},${g.rot}${g.ok ? '+' : '-'}`).join(';');
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      const mb = new MeshBuilder();
      for (const g of list) {
        const color = g.ok ? GREEN : RED;
        const def = machineDef(g.type);
        const { w, d } = dims(g.type, g.rot);
        const x = (g.gx + w / 2) * CELL_SIZE_M;
        const z = (g.gz + d / 2) * CELL_SIZE_M;
        if (g.type === 'conveyor') mb.box(x, 0, z, 0.46, 0.14, 0.46, color, true);
        else
          mb.box(x, 0, z, w * CELL_SIZE_M - 0.04, def.height, d * CELL_SIZE_M - 0.04, color, true);
        // Flèche de sortie.
        const out = outputCell(g.type, g.gx, g.gz, g.rot);
        mb.box(center(out.gx), 0, center(out.gz), 0.2, 0.2, 0.2, shade(color, 0.85), true);
      }
      this.ghost.geometry.dispose();
      this.ghost.geometry = geometryOf(mb);
    }
    this.ghost.visible = true;
  }

  hideGhost(): void {
    this.ghost.visible = false;
    this.ghostKey = '';
  }

  dispose(): void {
    this.scene.remove(this.root, this.ghost);
    this.bodies.geometry.dispose();
    this.items.geometry.dispose();
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();
  }
}

function addBelt(
  mb: MeshBuilder,
  gx: number,
  gz: number,
  rot: number,
  entry: { ex: number; ez: number; curved: boolean },
  color: Rgb,
): void {
  const [dx, dz] = RISE_DIR[rot];
  const cx = center(gx);
  const cz = center(gz);
  const half = CELL_SIZE_M / 2;
  // Corps : le centre, la moitié de sortie, et la moitié d'entrée (côté ou derrière).
  mb.box(cx, 0, cz, BELT_W, BELT_H, BELT_W, color, true);
  const arm = (ux: number, uz: number): void => {
    mb.box(
      cx + (ux * half) / 2,
      0,
      cz + (uz * half) / 2,
      Math.abs(ux) > 0 ? half : BELT_W,
      BELT_H,
      Math.abs(uz) > 0 ? half : BELT_W,
      color,
      true,
    );
  };
  arm(dx, dz);
  arm(entry.ex, entry.ez);
  // Bords relevés et flèche de sens, claire, sur le dessus.
  const light = shade(color, 1.9);
  const tipX = cx + dx * 0.18;
  const tipZ = cz + dz * 0.18;
  const px = -dz;
  const pz = dx;
  flatTri(
    mb,
    [tipX, tipZ],
    [cx - dx * 0.05 + px * 0.1, cz - dz * 0.05 + pz * 0.1],
    [cx - dx * 0.05 - px * 0.1, cz - dz * 0.05 - pz * 0.1],
    BELT_H + 0.004,
    light,
  );
}

function addMachineBody(
  mb: MeshBuilder,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
): void {
  const def = machineDef(type);
  const { w, d } = dims(type, rot);
  const x = (gx + w / 2) * CELL_SIZE_M;
  const z = (gz + d / 2) * CELL_SIZE_M;
  const sx = w * CELL_SIZE_M - 0.06;
  const sz = d * CELL_SIZE_M - 0.06;
  const color = hexToRgb(def.color);
  const [fx, fz] = RISE_DIR[rot];
  const out = outputCell(type, gx, gz, rot);
  if (type === 'drill') {
    mb.box(x, 0, z, sx, 0.5, sz, hexToRgb('#4b4f55'), true);
    mb.box(x, 0.5, z, sx - 0.5, 0.45, sz - 0.5, color, true);
    mb.cone(x, 0.95, z, 0.3, 0.35, 8, hexToRgb('#8a9099'), 0.1);
    // Bec de sortie vers la case de sortie.
    mb.box(
      center(out.gx) - fx * 0.2,
      0.12,
      center(out.gz) - fz * 0.2,
      fx !== 0 ? 0.3 : 0.28,
      0.22,
      fz !== 0 ? 0.3 : 0.28,
      hexToRgb('#2a2d31'),
      true,
    );
  } else {
    mb.box(x, 0, z, sx, 0.9, sz, color, true);
    mb.box(x, 0.9, z, sx + 0.04, 0.06, sz + 0.04, shade(color, 1.25), true);
    // Cheminée à l'arrière, ouverture et braise côté sortie.
    mb.box(
      x - fx * 0.2 - (fx === 0 ? 0.2 : 0),
      0.96,
      z - fz * 0.2 - (fz === 0 ? 0.2 : 0),
      0.28,
      0.5,
      0.28,
      hexToRgb('#3d3835'),
      true,
    );
    mb.box(
      center(out.gx) - fx * 0.2,
      0.1,
      center(out.gz) - fz * 0.2,
      fx !== 0 ? 0.08 : 0.5,
      0.4,
      fz !== 0 ? 0.08 : 0.5,
      hexToRgb('#e0702a'),
      true,
    );
  }
}
