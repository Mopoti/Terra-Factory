import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { RISE_DIR } from '../core/data/buildings';
import { itemById } from '../core/data/items';
import {
  isChest,
  isArm,
  isAssembler,
  isDrill,
  GROW_M,
  machineDef,
  visualHeight,
  type MachineType,
} from '../core/data/machines';
import {
  LEVEL_M,
  LIFTS,
  dims,
  footprint,
  liftEnd,
  liftStart,
  outputCell,
  ports,
  sideCell,
  type Factory,
  type Machine,
} from '../core/factory/factory';
import { fluidPorts } from '../core/factory/fluids';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';

const BELT_H = 0.12;
/** Un tapis occupe une tuile de 2 × 2 cases (1 m) ; les objets passent par son milieu. */
const TILE_M = 2 * CELL_SIZE_M;
const BELT_W = TILE_M;
const GREEN: Rgb = { r: 0.33, g: 0.88, b: 0.48 };
const RED: Rgb = { r: 1, g: 0.35, b: 0.3 };

const OUT_ARROW: Rgb = hexToRgb('#ffb347');
const IN_ARROW: Rgb = hexToRgb('#7ec8ff');

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

/** Flèche à plat dans une case, pointant dans la direction `dir` (entrée : vers la machine ; sortie : vers l'extérieur). */
function flatArrow(
  mb: MeshBuilder,
  cell: { gx: number; gz: number },
  dir: number,
  color: Rgb,
): void {
  const [dx, dz] = RISE_DIR[dir];
  const px = -dz;
  const pz = dx;
  const cx = center(cell.gx);
  const cz = center(cell.gz);
  const y = 0.04;
  const at = (along: number, across: number): [number, number] => [
    cx + dx * along + px * across,
    cz + dz * along + pz * across,
  ];
  // Hampe, puis pointe.
  flatTri(mb, at(-0.2, -0.04), at(0.02, -0.04), at(0.02, 0.04), y, color);
  flatTri(mb, at(-0.2, -0.04), at(0.02, 0.04), at(-0.2, 0.04), y, color);
  flatTri(mb, at(0.02, -0.14), at(0.2, 0), at(0.02, 0.14), y, color);
}

const WATER_ARROW: Rgb = hexToRgb('#3fa9f5');
const STEAM_ARROW: Rgb = hexToRgb('#f2f5f7');

/** Flèches des prises de fluide (eau en bleu, vapeur en blanc) : entrée vers la machine, sortie vers l'extérieur. */
function fluidArrows(
  mb: MeshBuilder,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  tint?: (c: Rgb) => Rgb,
): void {
  for (const p of fluidPorts(type, rot)) {
    if (p.mode === 'both') continue;
    const cell = sideCell(type, gx, gz, rot, p.side);
    const base = p.fluid === 'water' ? WATER_ARROW : STEAM_ARROW;
    flatArrow(mb, cell, p.mode === 'out' ? p.side : (p.side + 2) % 4, tint ? tint(base) : base);
  }
}

/** Côté d'où arrivent les objets sur un tapis : un tapis ou une machine qui débouche sur lui. */
export function beltEntry(
  factory: Factory,
  m: Machine,
): { ex: number; ez: number; curved: boolean } {
  const [dx, dz] = RISE_DIR[m.rot];
  const mine = new Set(footprint(m.type, m.gx, m.gz, m.rot).map((c) => `${c.gx},${c.gz}`));
  const lands = (c: { gx: number; gz: number }): boolean => mine.has(`${c.gx},${c.gz}`);
  const feeds = (n: Machine | null): boolean => {
    if (!n || n === m) return false;
    if (n.type === 'conveyor' && liftEnd(n) !== liftStart(m)) return false;
    if (n.type === 'splitter') {
      // Trois sorties : devant, gauche, droite (pas derrière).
      const back = (n.rot + 2) % 4;
      return [0, 1, 2, 3].some(
        (dir) => dir !== back && lands(sideCell(n.type, n.gx, n.gz, n.rot, dir)),
      );
    }
    const front =
      n.type === 'conveyor' || n.type === 'merger' || isArm(n.type)
        ? sideCell(n.type, n.gx, n.gz, n.rot, n.rot)
        : outputCell(n.type, n.gx, n.gz, n.rot);
    return lands(front);
  };
  const feeder = (dir: number): boolean => factory.feeders(m, dir).some(feeds);
  // Derrière : tout droit.
  if (feeder((m.rot + 2) % 4)) return { ex: -dx, ez: -dz, curved: false };
  // Les pentes et les tunnels restent droits.
  if (LIFTS[m.lift].from !== LIFTS[m.lift].to || (m.lift >= 4 && m.lift <= 5))
    return { ex: -dx, ez: -dz, curved: false };
  // Sur les côtés : virage.
  for (const [dir, sx, sz] of [
    [(m.rot + 3) % 4, -dz, dx],
    [(m.rot + 1) % 4, dz, -dx],
  ] as const) {
    if (feeder(dir)) return { ex: sx, ez: sz, curved: true };
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
        addBelt(mb, m, entry, hexToRgb(machineDef('conveyor').color), this.factory);
      } else {
        const start = mb.positions.length;
        addMachineBody(mb, m.type, m.gx, m.gz, m.rot, this.factory.fluidSides(m));
        growBody(mb, start, m);
        fluidArrows(mb, m.type, m.gx, m.gz, m.rot);
        const io = ports(m.type, m.gx, m.gz, m.rot);
        for (const o of io.outs) flatArrow(mb, o.cell, o.dir, OUT_ARROW);
        for (const i of io.ins) flatArrow(mb, i.cell, i.dir, IN_ARROW);
        liftBody(mb, start, m.lift);
      }
    }
    this.bodies.geometry.dispose();
    this.bodies.geometry = geometryOf(mb);
    // Fils électriques : du haut d'un poteau au poteau voisin ou à la machine raccordée.
    const pts: number[] = [];
    const top = (m: Machine): [number, number, number] => {
      const { w, d } = dims(m.type, m.rot);
      const h = m.type === 'pole' ? 3.3 + GROW_M : visualHeight(m.type);
      return [(m.gx + w / 2) * CELL_SIZE_M, h + m.lift * LEVEL_M, (m.gz + d / 2) * CELL_SIZE_M];
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
        const cx = (m.gx + 1) * CELL_SIZE_M;
        const cz = (m.gz + 1) * CELL_SIZE_M;
        let x: number;
        let z: number;
        if (b.pos < 0.5) {
          const k = (0.5 - b.pos) * TILE_M;
          x = cx + entry.ex * k;
          z = cz + entry.ez * k;
        } else {
          const k = (b.pos - 0.5) * TILE_M;
          x = cx + dx * k;
          z = cz + dz * k;
        }
        if (b.pos < 0) continue;
        const y = itemHeight(m, b.pos);
        if (y === null) continue;
        mb.box(x, y, z, 0.22, 0.16, 0.22, hexToRgb(itemById(b.item).color), true);
      }
    }
    // Contenu des tuyaux : un cœur coloré dont la hauteur suit le remplissage.
    for (const m of this.factory.machines) {
      if (m.type !== 'pipe') continue;
      const amount = m.fluid.water + m.fluid.steam;
      if (amount < 1) continue;
      const color = m.fluid.water >= m.fluid.steam ? hexToRgb('#3fa9f5') : hexToRgb('#f2f5f7');
      mb.box(
        center(m.gx),
        0.2,
        center(m.gz),
        0.1,
        0.02 + 0.08 * Math.min(1, amount / 100),
        0.1,
        color,
        true,
      );
    }
    this.items.geometry.dispose();
    this.items.geometry = geometryOf(mb);
  }

  /** Aperçu d'une ou plusieurs machines à poser : vert si possible, rouge sinon. */
  showGhost(
    list: { type: MachineType; gx: number; gz: number; rot: number; ok: boolean; lift?: number }[],
  ): void {
    if (list.length === 0) {
      this.hideGhost();
      return;
    }
    const key = list
      .map((g) => `${g.type}${g.gx},${g.gz},${g.rot}${g.lift ?? 0}${g.ok ? '+' : '-'}`)
      .join(';');
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      const mb = new MeshBuilder();
      for (const g of list) {
        const color = g.ok ? GREEN : RED;
        const first = mb.positions.length;
        const { w, d } = dims(g.type, g.rot);
        const x = (g.gx + w / 2) * CELL_SIZE_M;
        const z = (g.gz + d / 2) * CELL_SIZE_M;
        if (g.type === 'conveyor') ghostBelt(mb, x, z, g.rot, g.lift ?? 0, color);
        else
          mb.box(
            x,
            0,
            z,
            w * CELL_SIZE_M + GROW_M - 0.04,
            visualHeight(g.type),
            d * CELL_SIZE_M + GROW_M - 0.04,
            color,
            true,
          );
        // Flèches : sorties vers l'extérieur, entrées vers l'intérieur.
        const io = ports(g.type, g.gx, g.gz, g.rot);
        fluidArrows(mb, g.type, g.gx, g.gz, g.rot, (c) =>
          shade(color, (c.r + c.g + c.b) / 3 + 0.3),
        );
        for (const o of io.outs) flatArrow(mb, o.cell, o.dir, shade(color, 0.85));
        for (const i of io.ins) flatArrow(mb, i.cell, i.dir, shade(color, 1.3));
        if (g.type !== 'conveyor') liftBody(mb, first, g.lift ?? 0);
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

/** Hauteur (m) d'un objet sur un tapis à l'avancement `pos`, ou null s'il est caché sous terre. */
function itemHeight(m: Machine, pos: number): number | null {
  // Tunnel : l'objet disparaît dans le portail de l'entrée et réapparaît à celui de la sortie.
  if (m.lift === 4) return pos < 0.8 ? BELT_H : null;
  if (m.lift === 5) return pos > 0.2 ? BELT_H : null;
  const { from, to } = LIFTS[m.lift];
  return BELT_H + LEVEL_M * (from + (to - from) * pos);
}

/** Dalle inclinée sur une tuile : de la hauteur `y0` au bord arrière à `y1` au bord avant. */
function slope(
  mb: MeshBuilder,
  cx: number,
  cz: number,
  rot: number,
  y0: number,
  y1: number,
  thick: number,
  color: Rgb,
): void {
  const [dx, dz] = RISE_DIR[rot];
  const px = -dz;
  const pz = dx;
  const h = TILE_M / 2;
  const w = BELT_W / 2;
  const at = (along: number, across: number, y: number): [number, number, number] => [
    cx + dx * along + px * across,
    y,
    cz + dz * along + pz * across,
  ];
  const yy = (along: number): number => (along < 0 ? y0 : y1);
  const a = at(-h, -w, yy(-h) + thick);
  const b = at(-h, w, yy(-h) + thick);
  const c = at(h, w, yy(h) + thick);
  const d = at(h, -w, yy(h) + thick);
  const a0 = at(-h, -w, yy(-h));
  const b0 = at(-h, w, yy(-h));
  const c0 = at(h, w, yy(h));
  const d0 = at(h, -w, yy(h));
  // Dessus (visible des deux côtés pour ne pas dépendre du sens des faces), dessous, côtés.
  mb.quad(a, b, c, d, color);
  mb.quad(d, c, b, a, color);
  mb.quad(a0, d0, c0, b0, shade(color, 0.6));
  mb.quad(a0, a, d, d0, shade(color, 0.75));
  mb.quad(d0, d, c, c0, shade(color, 0.75));
  mb.quad(c0, c, b, b0, shade(color, 0.75));
  mb.quad(b0, b, a, a0, shade(color, 0.75));
}

/** Aperçu d'un tapis selon sa forme. */
function ghostBelt(
  mb: MeshBuilder,
  x: number,
  z: number,
  rot: number,
  lift: number,
  color: Rgb,
): void {
  const { from, to } = LIFTS[lift] ?? LIFTS[0];
  if (from === to) {
    mb.box(x, from * LEVEL_M, z, BELT_W, 0.14, BELT_W, color, true);
    return;
  }
  slope(mb, x, z, rot, Math.max(0, from) * LEVEL_M, Math.max(0, to) * LEVEL_M, 0.14, color);
}

const PORTAL: Rgb = hexToRgb('#2b2d33');

/** Un pilier sous un tapis surélevé, tous les 5 tuiles dans l'axe du tapis, sauf là où un tapis passe dessous. */
function pillar(mb: MeshBuilder, m: Machine, factory: Factory, color: Rgb, height: number): void {
  const along = m.rot % 2 === 0 ? m.gz / 2 : m.gx / 2;
  if (Math.floor(along) % 5 !== 0) return;
  for (const c of footprint(m.type, m.gx, m.gz, m.rot)) {
    // Rien ne doit traverser le pilier : un tapis ou une machine dessous (sol, ou niveau 1 sous un tapis de niveau 2).
    const under = factory.machineAt(c.gx, c.gz);
    if (under && (under.type !== 'conveyor' || under.lift === 0)) return;
    if (height > LEVEL_M && factory.machineAt(c.gx, c.gz, 1)) return;
  }
  mb.box(
    (m.gx + 1) * CELL_SIZE_M,
    0,
    (m.gz + 1) * CELL_SIZE_M,
    0.14,
    height,
    0.14,
    shade(color, 0.7),
    true,
  );
}

function addBelt(
  mb: MeshBuilder,
  m: Machine,
  entry: { ex: number; ez: number; curved: boolean },
  color: Rgb,
  factory: Factory,
): void {
  const { gx, gz, rot, lift } = m;
  const cxm = (gx + 1) * CELL_SIZE_M;
  const czm = (gz + 1) * CELL_SIZE_M;
  const [fx, fz] = RISE_DIR[rot];
  const shape = LIFTS[lift];
  if (shape.from !== shape.to) {
    const [y0, y1] = [shape.from * LEVEL_M, shape.to * LEVEL_M];
    slope(mb, cxm, czm, rot, y0, y1, BELT_H, color);
    // Flèche de sens sur la pente.
    return void arrowOnSlope(mb, cxm, czm, rot, y0, y1, shade(color, 1.9));
  }
  if (lift === 4 || lift === 5) {
    // Tunnel : une dalle sombre avec un portail du côté où les objets entrent (entrée : devant) ou sortent (sortie : derrière).
    mb.box(cxm, 0, czm, BELT_W, 0.1, BELT_W, shade(PORTAL, 1.6), true);
    const edge = lift === 4 ? 1 : -1;
    mb.box(
      cxm + fx * edge * (TILE_M / 2 - 0.05),
      0,
      czm + fz * edge * (TILE_M / 2 - 0.05),
      Math.abs(fx) > 0 ? 0.1 : BELT_W,
      0.4,
      Math.abs(fz) > 0 ? 0.1 : BELT_W,
      PORTAL,
      true,
    );
    arrowOnSlope(mb, cxm, czm, rot, 0.1, 0.1, shade(color, 1.9));
    return;
  }
  const height = shape.from * LEVEL_M;
  if (height > 0) pillar(mb, m, factory, color, height);
  addFlatBelt(mb, gx, gz, rot, entry, color, height);
}

/** Flèche de sens à plat sur une dalle (ou inclinée). */
function arrowOnSlope(
  mb: MeshBuilder,
  cx: number,
  cz: number,
  rot: number,
  y0: number,
  y1: number,
  color: Rgb,
): void {
  const [dx, dz] = RISE_DIR[rot];
  const px = -dz;
  const pz = dx;
  const at = (along: number, across: number): [number, number, number] => {
    const t = (along + TILE_M / 2) / TILE_M;
    return [
      cx + dx * along + px * across,
      y0 + (y1 - y0) * t + BELT_H + 0.008,
      cz + dz * along + pz * across,
    ];
  };
  mb.tri(at(0.36, 0), at(-0.1, 0.2), at(-0.1, -0.2), color);
  mb.tri(at(0.36, 0), at(-0.1, -0.2), at(-0.1, 0.2), color);
}

function addFlatBelt(
  mb: MeshBuilder,
  gx: number,
  gz: number,
  rot: number,
  entry: { ex: number; ez: number; curved: boolean },
  color: Rgb,
  lift: number,
): void {
  const [dx, dz] = RISE_DIR[rot];
  // Un tapis occupe 2 × 2 cases : on le dessine centré sur sa tuile.
  const cx = (gx + 1) * CELL_SIZE_M;
  const cz = (gz + 1) * CELL_SIZE_M;
  const half = TILE_M / 2;
  // Corps : le centre, la moitié de sortie, et la moitié d'entrée (côté ou derrière).
  mb.box(cx, lift, cz, BELT_W, BELT_H, BELT_W, color, true);
  const arm = (ux: number, uz: number): void => {
    mb.box(
      cx + (ux * half) / 2,
      lift,
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
  // Voie centrale (là où passent les objets) : de l'entrée au centre puis du centre à la sortie ; elle dessine
  // aussi les angles.
  const lane = shade(color, 0.7);
  // Deux morceaux qui ne se recouvrent pas (sinon les faces coplanaires scintillent) : la sortie couvre le centre.
  const laneBox = (ux: number, uz: number, from: number, to: number): void => {
    const mid = (from + to) / 2;
    const len = to - from;
    mb.box(
      cx + ux * mid,
      lift + BELT_H,
      cz + uz * mid,
      Math.abs(ux) > 0 ? len : 0.14,
      0.003,
      Math.abs(uz) > 0 ? len : 0.14,
      lane,
      false,
    );
  };
  laneBox(dx, dz, -0.07, half);
  laneBox(entry.ex, entry.ez, 0.07, half);
  // Flèche de sens, claire, sur le dessus (au milieu du tapis, là où passent les objets).
  const light = shade(color, 1.9);
  const tipX = cx + dx * 0.36;
  const tipZ = cz + dz * 0.36;
  const px = -dz;
  const pz = dx;
  flatTri(
    mb,
    [tipX, tipZ],
    [cx - dx * 0.1 + px * 0.2, cz - dz * 0.1 + pz * 0.2],
    [cx - dx * 0.1 - px * 0.2, cz - dz * 0.1 - pz * 0.2],
    lift + BELT_H + 0.006,
    light,
  );
}

/** Monte tout ce qui a été dessiné depuis `start` à la hauteur du niveau (machine posée à l'étage). */
function liftBody(mb: MeshBuilder, start: number, level: number): void {
  if (level <= 0) return;
  for (let i = start + 1; i < mb.positions.length; i += 3) mb.positions[i] += level * LEVEL_M;
}

/** Agrandit le corps d'une machine de 10 cm en largeur, longueur et hauteur (autour de son centre au sol). */
function growBody(mb: MeshBuilder, start: number, m: Machine): void {
  const { w, d } = dims(m.type, m.rot);
  const W = w * CELL_SIZE_M;
  const D = d * CELL_SIZE_M;
  const H = machineDef(m.type).height;
  const cx = (m.gx + w / 2) * CELL_SIZE_M;
  const cz = (m.gz + d / 2) * CELL_SIZE_M;
  const kx = (W + GROW_M) / W;
  const kz = (D + GROW_M) / D;
  const ky = (H + GROW_M) / H;
  const p = mb.positions;
  for (let i = start; i < p.length; i += 3) {
    p[i] = cx + (p[i] - cx) * kx;
    p[i + 1] *= ky;
    p[i + 2] = cz + (p[i + 2] - cz) * kz;
  }
}

function addMachineBody(
  mb: MeshBuilder,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  sides: number[] = [],
): void {
  const def = machineDef(type);
  const { w, d } = dims(type, rot);
  const x = (gx + w / 2) * CELL_SIZE_M;
  const z = (gz + d / 2) * CELL_SIZE_M;
  const sx = w * CELL_SIZE_M - 0.06;
  const sz = d * CELL_SIZE_M - 0.06;
  const color = hexToRgb(def.color);
  const [fx, fz] = RISE_DIR[rot];
  if (isArm(type)) {
    // Bras : socle, mât, bras horizontal vers l'avant et pince .
    mb.box(x, 0, z, 0.4, 0.12, 0.4, color, true);
    mb.box(x, 0.12, z, 0.14, 0.33, 0.14, shade(color, 0.8), true);
    mb.box(
      x + fx * 0.12,
      0.45,
      z + fz * 0.12,
      fx !== 0 ? 0.5 : 0.12,
      0.1,
      fz !== 0 ? 0.5 : 0.12,
      shade(color, 1.2),
      true,
    );
    mb.box(
      x + fx * 0.3,
      0.25,
      z + fz * 0.3,
      fx !== 0 ? 0.08 : 0.2,
      0.2,
      fz !== 0 ? 0.08 : 0.2,
      hexToRgb('#2a2d31'),
      true,
    );
    return;
  }
  if (type === 'pipe') {
    // Tuyau : moyeu central et un manchon jusqu'au bord de la tuile vers chaque voisin raccordé (tuyau continu).
    mb.box(x, 0.02, z, 0.36, 0.32, 0.36, shade(color, 1.1), true);
    for (const side of sides) {
      const [dx, dz] = RISE_DIR[side];
      mb.box(
        x + dx * 0.25,
        0.04,
        z + dz * 0.25,
        dx !== 0 ? 0.52 : 0.28,
        0.28,
        dz !== 0 ? 0.52 : 0.28,
        color,
        true,
      );
    }
    return;
  }
  if (type === 'pump') {
    // Pompe : socle, corps bleu, moteur dessus, bec de sortie devant.
    mb.box(x, 0, z, 0.42, 0.16, 0.42, shade(color, 0.7), true);
    mb.box(x, 0.16, z, 0.34, 0.4, 0.34, color, true);
    mb.box(x, 0.56, z, 0.22, 0.18, 0.22, hexToRgb('#2f3a40'), true);
    mb.box(
      x + fx * 0.22,
      0.2,
      z + fz * 0.22,
      fx !== 0 ? 0.14 : 0.12,
      0.12,
      fz !== 0 ? 0.14 : 0.12,
      shade(color, 1.2),
      true,
    );
    return;
  }
  if (type === 'boiler') {
    // Chaudière : socle de brique, cuve, dôme et cheminée à l'arrière ; porte de chauffe sur les côtés.
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.8), true);
    mb.box(x, 0.3, z, sx - 0.1, 0.9, sz - 0.1, color, true);
    mb.box(x, 1.2, z, sx - 0.3, 0.14, sz - 0.3, shade(color, 1.3), true);
    mb.box(x - fx * 0.28, 1.34, z - fz * 0.28, 0.18, 0.55, 0.18, hexToRgb('#3d3a38'), true);
    for (const side of [(rot + 1) % 4, (rot + 3) % 4]) {
      const [dx, dz] = RISE_DIR[side];
      mb.box(
        x + dx * (sx / 2),
        0.35,
        z + dz * (sz / 2),
        dx !== 0 ? 0.04 : 0.28,
        0.28,
        dz !== 0 ? 0.04 : 0.28,
        hexToRgb('#e0702a'),
        true,
      );
    }
    return;
  }
  if (type === 'turbine') {
    // Turbine : carter long, brides aux deux bouts, axe de rotor visible dessus.
    const long = Math.max(sx, sz);
    mb.box(x, 0, z, fx !== 0 ? long : 0.42, 0.7, fz !== 0 ? long : 0.42, color, true);
    for (const k of [-1, 1]) {
      mb.box(
        x + fx * k * (long / 2 - 0.06),
        0.02,
        z + fz * k * (long / 2 - 0.06),
        fx !== 0 ? 0.1 : 0.5,
        0.66,
        fz !== 0 ? 0.1 : 0.5,
        shade(color, 0.75),
        true,
      );
    }
    mb.box(x, 0.7, z, 0.16, 0.2, 0.16, hexToRgb('#3d3a38'), true);
    mb.box(x, 0.9, z, fx !== 0 ? 0.5 : 0.1, 0.06, fz !== 0 ? 0.5 : 0.1, hexToRgb('#e6c84a'), true);
    return;
  }
  if (type === 'lab') {
    // Laboratoire : paillasse basse, cornue (cône) et éprouvette lumineuse.
    mb.box(x, 0, z, sx, 0.55, sz, color, true);
    mb.box(x, 0.55, z, sx - 0.12, 0.1, sz - 0.12, shade(color, 1.3), true);
    mb.cone(x - 0.18, 0.65, z - 0.1, 0.17, 0.3, 8, hexToRgb('#cfe9ef'));
    mb.box(x + 0.2, 0.65, z + 0.15, 0.08, 0.28, 0.08, hexToRgb('#4fc3a1'), true);
    mb.box(x + 0.2, 0.65, z - 0.2, 0.18, 0.12, 0.14, hexToRgb('#2f3a40'), true);
    return;
  }
  if (isAssembler(type)) {
    // Assembleur : socle, caisson, plateau de travail et bras de montage ; bec sombre côté sortie.
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x, 0.2, z, sx - 0.1, 0.7, sz - 0.1, color, true);
    mb.box(x, 0.9, z, sx - 0.3, 0.1, sz - 0.3, shade(color, 1.3), true);
    mb.box(x - fx * 0.15, 1.0, z - fz * 0.15, 0.12, 0.3, 0.12, hexToRgb('#3d3a38'), true);
    mb.box(
      x + fx * 0.05,
      1.2,
      z + fz * 0.05,
      fx !== 0 ? 0.4 : 0.1,
      0.08,
      fz !== 0 ? 0.4 : 0.1,
      hexToRgb('#e6c84a'),
      true,
    );
    return;
  }
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
    // Boîtier plat (les entrées et sorties sont indiquées par des flèches au sol).
    mb.box(x, 0, z, sx, 0.25, sz, color, true);
    mb.box(x, 0.25, z, sx - 0.16, 0.08, sz - 0.16, shade(color, 1.3), true);
    return;
  }
  if (type === 'pole') {
    // Poteau : mât, bras, deux isolateurs.
    mb.box(x, 0, z, 0.12, 3.4, 0.12, color, true);
    mb.box(x, 3.15, z, 0.7, 0.07, 0.1, shade(color, 0.8), true);
    mb.box(x, 2.85, z, 0.5, 0.06, 0.08, shade(color, 0.8), true);
    mb.box(x - 0.3, 3.22, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
    mb.box(x + 0.3, 3.22, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
    return;
  }
  if (type === 'generator') {
    // Générateur : caisson, bloc moteur, échappement à l'arrière .
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
    return;
  }
  if (isDrill(type)) {
    mb.box(x, 0, z, sx, 0.5, sz, hexToRgb('#4b4f55'), true);
    mb.box(x, 0.5, z, sx - 0.5, 0.45, sz - 0.5, color, true);
    mb.cone(x, 0.95, z, 0.3, 0.35, 8, hexToRgb('#8a9099'), 0.1);
  } else {
    mb.box(x, 0, z, sx, 0.9, sz, color, true);
    mb.box(x, 0.9, z, sx + 0.04, 0.06, sz + 0.04, shade(color, 1.25), true);
    // Cheminée à l'arrière.
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
  }
}
