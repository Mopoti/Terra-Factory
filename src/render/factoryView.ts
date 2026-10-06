import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { RISE_DIR } from '../core/data/buildings';
import { itemById } from '../core/data/items';
import {
  hasOutput,
  isChest,
  isDrill,
  isRouter,
  machineDef,
  type MachineType,
} from '../core/data/machines';
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
    if (n.type === 'splitter') {
      // Trois sorties : devant, gauche, droite (pas derrière).
      const back = (n.rot + 2) % 4;
      return RISE_DIR.some(
        ([ax, az], dir) => dir !== back && n.gx + ax === m.gx && n.gz + az === m.gz,
      );
    }
    const front =
      n.type === 'conveyor' || n.type === 'merger'
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
  private readonly wires = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x1b1b1f }),
  );
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
    this.root.add(this.bodies, this.items, this.wires);
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
    // Fils électriques : du haut d'un poteau au poteau voisin ou à la machine raccordée.
    const pts: number[] = [];
    const top = (m: Machine): [number, number, number] => {
      const { w, d } = dims(m.type, m.rot);
      const h = m.type === 'pole' ? 2.1 : machineDef(m.type).height;
      return [(m.gx + w / 2) * CELL_SIZE_M, h, (m.gz + d / 2) * CELL_SIZE_M];
    };
    for (const { from, to } of this.factory.wires) {
      const a = top(from);
      const b = top(to);
      // Un fil qui pend un peu : deux segments avec un point bas au milieu.
      const mid: [number, number, number] = [
        (a[0] + b[0]) / 2,
        Math.min(a[1], b[1]) - 0.25,
        (a[2] + b[2]) / 2,
      ];
      pts.push(...a, ...mid, ...mid, ...b);
    }
    this.wires.geometry.dispose();
    this.wires.geometry = new THREE.BufferGeometry();
    this.wires.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
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
        // Flèche de sortie (un coffre n'en a pas : il se remplit par les tapis).
        if (isRouter(g.type)) {
          const outs = g.type === 'splitter' ? [g.rot, (g.rot + 1) % 4, (g.rot + 3) % 4] : [g.rot];
          for (const dir of outs)
            mb.box(
              center(g.gx + RISE_DIR[dir][0]),
              0,
              center(g.gz + RISE_DIR[dir][1]),
              0.2,
              0.2,
              0.2,
              shade(color, 0.85),
              true,
            );
        } else if (hasOutput(g.type)) {
          const out = outputCell(g.type, g.gx, g.gz, g.rot);
          mb.box(center(out.gx), 0, center(out.gz), 0.2, 0.2, 0.2, shade(color, 0.85), true);
        }
        // Entrées : petit cube clair sur la face qui reçoit (combustible du générateur, entrées du groupeur…).
        const inDirs =
          g.type === 'generator'
            ? [g.rot]
            : g.type === 'splitter'
              ? [(g.rot + 2) % 4]
              : g.type === 'merger'
                ? [(g.rot + 2) % 4, (g.rot + 1) % 4, (g.rot + 3) % 4]
                : [];
        for (const dir of inDirs) {
          const [ix, iz] = RISE_DIR[dir];
          mb.box(
            x + ix * ((ix !== 0 ? w : d) * CELL_SIZE_M * 0.5 + 0.1),
            0,
            z + iz * ((ix !== 0 ? w : d) * CELL_SIZE_M * 0.5 + 0.1),
            0.16,
            0.16,
            0.16,
            shade(color, 1.25),
            true,
          );
        }
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
    this.wires.geometry.dispose();
    (this.wires.material as THREE.Material).dispose();
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

/** Petit carré clair posé sur une face (entrée de ressources) : largeur `w`, de la hauteur `y` sur `h` de haut. */
function inputMark(
  mb: MeshBuilder,
  ex: number,
  ez: number,
  dx: number,
  dz: number,
  w: number,
  y: number,
  h: number,
): void {
  const t = 0.03;
  mb.box(
    ex + dx * (t / 2 - 0.005),
    y,
    ez + dz * (t / 2 - 0.005),
    dx !== 0 ? t : w,
    h,
    dz !== 0 ? t : w,
    hexToRgb('#cfe4f2'),
    true,
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
  if (isChest(type)) {
    // Coffre : caisse, couvercle un peu plus large, sangles sombres.
    const iron = type === 'chest_iron';
    mb.box(x, 0, z, 0.44, 0.38, 0.44, color, true);
    mb.box(x, 0.38, z, 0.48, 0.2, 0.48, shade(color, iron ? 1.15 : 0.85), true);
    const strap = hexToRgb(iron ? '#4a5058' : '#3a2a1a');
    mb.box(x - 0.13, 0, z, 0.06, 0.58, 0.5, strap, true);
    mb.box(x + 0.13, 0, z, 0.06, 0.58, 0.5, strap, true);
    mb.box(
      x + fx * 0.24,
      0.3,
      z + fz * 0.24,
      fx !== 0 ? 0.03 : 0.1,
      0.12,
      fz !== 0 ? 0.03 : 0.1,
      hexToRgb('#d9c15a'),
      true,
    );
    return;
  }
  if (type === 'splitter' || type === 'merger') {
    // Boîtier plat. Becs sombres = sorties (séparateur : 3, groupeur : 1) ; carrés clairs en creux = entrées.
    // Becs et carrés restent sous le dessus (0.25) et débordent de 2 cm dans le boîtier : pas de faces confondues.
    mb.box(x, 0, z, sx, 0.25, sz, color, true);
    mb.box(x, 0.25, z, sx - 0.16, 0.08, sz - 0.16, shade(color, 1.3), true);
    const side = (dir: number): [number, number] => RISE_DIR[dir];
    const outs = type === 'splitter' ? [rot, (rot + 1) % 4, (rot + 3) % 4] : [rot];
    const ins =
      type === 'splitter' ? [(rot + 2) % 4] : [(rot + 2) % 4, (rot + 1) % 4, (rot + 3) % 4];
    for (const dir of outs) {
      const [bx, bz] = side(dir);
      mb.box(
        x + bx * 0.28,
        0.04,
        z + bz * 0.28,
        bx !== 0 ? 0.16 : 0.2,
        0.18,
        bz !== 0 ? 0.16 : 0.2,
        hexToRgb('#2a2d31'),
        true,
      );
    }
    for (const dir of ins) {
      const [bx, bz] = side(dir);
      inputMark(mb, x + bx * (sx / 2), z + bz * (sz / 2), bx, bz, 0.12, 0.06, 0.14);
    }
    return;
  }
  if (type === 'pole') {
    // Poteau : mât, bras, deux isolateurs.
    mb.box(x, 0, z, 0.12, 2.2, 0.12, color, true);
    mb.box(x, 2.0, z, 0.7, 0.07, 0.1, shade(color, 0.8), true);
    mb.box(x - 0.3, 2.07, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
    mb.box(x + 0.3, 2.07, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
    return;
  }
  if (type === 'generator') {
    // Générateur : caisson, bloc moteur, échappement à l'arrière ; carré clair sur la face d'entrée du combustible.
    const [rx, rz] = [-fz, fx];
    mb.box(x, 0, z, sx, 0.7, sz, color, true);
    mb.box(x - fx * 0.1, 0.7, z - fz * 0.1, sx - 0.4, 0.3, sz - 0.4, shade(color, 1.3), true);
    mb.box(
      x - fx * 0.3 + rx * 0.3,
      0.7,
      z - fz * 0.3 + rz * 0.3,
      0.18,
      0.55,
      0.18,
      hexToRgb('#3d3a38'),
      true,
    );
    inputMark(mb, x + fx * (sx / 2), z + fz * (sz / 2), fx, fz, 0.3, 0.2, 0.3);
    return;
  }
  if (isDrill(type)) {
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
