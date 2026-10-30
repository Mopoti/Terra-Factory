import {
  animatedParts,
  beltModel,
  hasModelPlanned,
  pipeModel,
  pipeShape,
  modelFor,
  modelsSettled,
  type AnimKind,
  type BakedModel,
  type BeltShape,
} from './models';
import {
  MOTIONS,
  poseOf,
  ROCKER_DEFAULT,
  rockerPose,
  withStep,
  type Motion,
  type RockerGeometry,
} from './partMotions';
import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { RISE_DIR } from '../core/data/buildings';
import { itemById } from '../core/data/items';
import {
  isChest,
  isArm,
  isAssembler,
  isDrill,
  isPole,
  isAccumulator,
  isTurret,
  GROW_M,
  beltSpeed,
  machineDef,
  visualHeight,
  type MachineType,
} from '../core/data/machines';
import {
  levelY,
  LIFTS,
  dims,
  footprint,
  liftEnd,
  liftStart,
  outputCell,
  ports,
  sideCell,
  WAYPOINT_COLORS,
  type Factory,
  type Machine,
} from '../core/factory/factory';
import { t } from '../i18n';
import { fluidPorts } from '../core/factory/fluids';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';
import { BandBuilder, bandMaterial, setBandTime } from './beltBands';

const BELT_H = 0.2;
/** Un tapis occupe une tuile de 2 × 2 cases (1 m) ; les objets passent par son milieu. */
const TILE_M = 2 * CELL_SIZE_M;
const BELT_W = TILE_M;
const GREEN: Rgb = { r: 0.33, g: 0.88, b: 0.48 };
const RED: Rgb = { r: 1, g: 0.35, b: 0.3 };

const OUT_ARROW: Rgb = hexToRgb('#ffb347');
const IN_ARROW: Rgb = hexToRgb('#7ec8ff');
const COAL_ARROW: Rgb = hexToRgb('#2b2b2b');

const center = (g: number): number => (g + 0.5) * CELL_SIZE_M;

/** Flammes d'une machine : couleurs de sommet sans éclairage (elles brillent), vues des deux côtés. */
const flameMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

interface FlameInstance {
  m: Machine;
  mesh: THREE.Mesh;
  /** Sommets au repos (repère de la machine) ; le maillage reçoit les sommets mis à l'échelle autour du pied de chaque flamme. */
  base: Float32Array;
  colors: Float32Array;
  groups: {
    first: number;
    count: number;
    px: number;
    py: number;
    pz: number;
    glow?: boolean;
    pulse?: boolean;
  }[];
  /** Intensité lissée : 1 pleine, 0,2 braises, 0 éteinte. */
  level: number;
}

/**
 * Place un modèle comme `addMachineBody` : recentré, mis à l'échelle de l'emprise et de la hauteur de la machine, tourné
 * de quarts de tour. `place` transforme un point du modèle, `turn` une direction, `scale` est l'échelle du modèle.
 */
function placementOf(
  m: Machine,
  model: BakedModel,
): {
  w: number;
  d: number;
  scale: number;
  place: (x: number, y: number, z: number) => [number, number, number];
  turn: (x: number, y: number, z: number) => [number, number, number];
} {
  const def = machineDef(m.type);
  const { w, d } = dims(m.type, m.rot);
  const odd = m.rot % 2 === 1;
  const sizeX = odd ? model.size.z : model.size.x;
  const sizeZ = odd ? model.size.x : model.size.z;
  const scale = Math.min(
    (w * CELL_SIZE_M - 0.06) / sizeX,
    (d * CELL_SIZE_M - 0.06) / sizeZ,
    (def.height * 1.3) / model.size.y,
  );
  const a = (MODEL_TURNS[m.rot % 4] * Math.PI) / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = model.min.x + model.size.x / 2;
  const cz = model.min.z + model.size.z / 2;
  // Même transformation que `MeshBuilder.model` : recentrage, échelle, quarts de tour autour de la verticale.
  const place = (x: number, y: number, z: number): [number, number, number] => {
    const px = (x - cx) * scale;
    const pz = (z - cz) * scale;
    return [px * cos + pz * sin, (y - model.min.y) * scale, -px * sin + pz * cos];
  };
  const turn = (x: number, y: number, z: number): [number, number, number] => [
    x * cos + z * sin,
    y,
    -x * sin + z * cos,
  ];
  return { w, d, scale, place, turn };
}

interface PartItem {
  name: string;
  mesh: THREE.Mesh;
  motion: Motion;
  parent?: string;
  /** Pivot et axe dans le repère du jeu (déjà tournés et mis à l'échelle), et axe dans le repère du modèle. */
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
  modelAxis: { x: number; y: number; z: number };
  spin: number;
}

interface PartMachine {
  m: Machine;
  items: PartItem[];
  scale: number;
  turn: (x: number, y: number, z: number) => [number, number, number];
  /** Intensité lissée (0 à 1) et secondes de marche cumulées. */
  level: number;
  phase: number;
  crank: number;
  rocker: number;
  rockerGeometry?: RockerGeometry;
  /** Coffre : contenu vu à l'image précédente, et instant jusqu'auquel le couvercle reste ouvert. */
  chestSeen?: string;
  openUntil?: number;
}

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
  shift = 0,
): void {
  const [dx, dz] = RISE_DIR[dir];
  const px = -dz;
  const pz = dx;
  const cx = center(cell.gx) + px * shift;
  const cz = center(cell.gz) + pz * shift;
  // Un peu au-dessus du sol (plus haut qu'un tapis, 12 cm) pour rester visibles à côté d'un tapis.
  const y = 0.2;
  const at = (along: number, across: number): [number, number] => [
    cx + dx * along + px * across,
    cz + dz * along + pz * across,
  ];
  // Hampe, puis pointe.
  flatTri(mb, at(-0.2, -0.04), at(0.02, -0.04), at(0.02, 0.04), y, color);
  flatTri(mb, at(-0.2, -0.04), at(0.02, 0.04), at(-0.2, 0.04), y, color);
  flatTri(mb, at(0.02, -0.14), at(0.2, 0), at(0.02, 0.14), y, color);
}

/** Mélange les couleurs des sommets ajoutés depuis `from` avec `tint` (part `amount`). */
function tintFrom(mb: MeshBuilder, from: number, tint: Rgb, amount: number): void {
  const c = mb.colors;
  for (let i = from; i < c.length; i += 3) {
    c[i] += (tint.r - c[i]) * amount;
    c[i + 1] += (tint.g - c[i + 1]) * amount;
    c[i + 2] += (tint.b - c[i + 2]) * amount;
  }
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
    if (p.mode === 'both' && p.fluid === 'any') continue;
    const cell = sideCell(type, gx, gz, rot, p.side);
    const base = p.fluid === 'water' ? WATER_ARROW : STEAM_ARROW;
    const color = tint ? tint(base) : base;
    if (p.mode === 'both') {
      // Eau traversante (chaudière) : chaque côté fait entrer et sortir l'eau → une flèche dans chaque sens, côte à côte.
      flatArrow(mb, cell, (p.side + 2) % 4, color, 0.14);
      flatArrow(mb, cell, p.side, color, 0.14);
      continue;
    }
    flatArrow(mb, cell, p.mode === 'out' ? p.side : (p.side + 2) % 4, color);
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
    if (n.type === 'splitter' || n.type === 'sorter') {
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

/** Noircit les sommets ajoutés depuis `start` : suie par taches, de plus en plus marquée selon l'usure (1 à 3). */
function burn(mb: MeshBuilder, start: number, level: number): void {
  const k = [0, 0.25, 0.45, 0.65][level];
  const colors = mb.colors;
  for (let i = start; i + 2 < mb.positions.length; i += 3) {
    const noise =
      Math.abs(
        Math.sin(
          mb.positions[i] * 12.9898 + mb.positions[i + 1] * 78.233 + mb.positions[i + 2] * 37.719,
        ) * 43758.5453,
      ) % 1;
    const t = Math.min(1, k * (0.4 + 1.2 * noise));
    colors[i] = colors[i] * (1 - t) + 0.1 * t;
    colors[i + 1] = colors[i + 1] * (1 - t) + 0.08 * t;
    colors[i + 2] = colors[i + 2] * (1 - t) + 0.07 * t;
  }
}

/** Dessine les machines et les tapis (corps fixes), les objets sur les tapis (dynamiques) et l'aperçu de pose. */
export class FactoryView {
  private readonly root = new THREE.Group();
  private bodies = new THREE.Mesh();
  private items = new THREE.Mesh();
  /** Lames des tapis maison, qui défilent (voir `beltBands.ts`). */
  private bands = new THREE.Mesh();
  private readonly wires = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x1b1b1f }),
  );
  private readonly ghost = new THREE.Mesh();
  private readonly ghostMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  private entries = new Map<number, { ex: number; ez: number; curved: boolean }>();
  /** Fumée (vapeur) qui monte des turbines en marche. */
  private readonly smoke = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      size: 0.55,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  private ghostKey = '';
  /** Instant (s) où chaque tuyau rompu a été vu pour la première fois (gerbe de vapeur). */
  private readonly burstAt = new Map<number, number>();
  /** Balises : faisceau coloré et nom flottant, refaits à chaque `rebuild`. */
  private readonly flags = new THREE.Group();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: Factory,
  ) {
    this.bodies.material = propsMaterial;
    this.items.material = propsMaterial;
    this.bands.material = bandMaterial;
    this.ghost.material = this.ghostMaterial;
    this.ghost.visible = false;
    this.ghost.renderOrder = 6;
    this.bodies.castShadow = true;
    this.items.castShadow = false;
    this.smoke.frustumCulled = false;
    this.root.add(
      this.bodies,
      this.bands,
      this.items,
      this.wires,
      this.smoke,
      this.movers,
      this.flames,
      this.parts,
      this.flags,
    );
    scene.add(this.root, this.ghost);
    this.rebuild();
  }

  /** Version de l'aspect des machines au dernier dessin, et machines abîmées à cette version. */
  private visualSeen = -1;
  private damaged: Machine[] = [];
  /** Tuyaux et turbines (fumées), repérés au dernier dessin pour ne pas parcourir toutes les machines à chaque image. */
  private pipes: Machine[] = [];
  private turbines: Machine[] = [];
  /** Lampadaires, repérés au dernier dessin. */
  lamps: Machine[] = [];

  /** Niveau d'usure d'une machine abîmée par les ennemis : 0 (intacte), 1 (moins de 75 %), 2 (moins de 50 %), 3 (moins de 25 %). */
  private damageLevel(m: Machine): number {
    if (m.hp === undefined) return 0;
    const f = this.factory.healthFraction(m);
    return f >= 0.75 ? 0 : f >= 0.5 ? 1 : f >= 0.25 ? 2 : 3;
  }

  /** Redessine les machines dont l'aspect a changé (elles noircissent à mesure qu'elles s'abîment ; les portails s'ouvrent). */
  updateDamage(): void {
    if (this.factory.visualVersion === this.visualSeen) return;
    this.visualSeen = this.factory.visualVersion;
    this.damaged = this.factory.machines.filter((m) => m.hp !== undefined);
    this.rebuild();
  }

  /** Refait les corps des machines (à appeler quand on en pose ou en retire). */
  rebuild(): void {
    this.factory.reindex();
    this.pipes = this.factory.machines.filter((m) => m.type === 'pipe');
    this.turbines = this.factory.machines.filter((m) => m.type === 'turbine');
    this.lamps = this.factory.machines.filter((m) => m.type === 'lamp');
    const mb = new MeshBuilder();
    const bands = new BandBuilder();
    this.entries.clear();
    this.clearMovers();
    for (const m of this.factory.machines) {
      // Les modèles se chargent en arrière-plan : on n'affiche pas d'abord la forme simple puis le modèle. Une machine
      // qui a un modèle prévu attend la fin du chargement (puis prend le modèle maison, sinon celui du kit, sinon la forme simple).
      if (
        !modelsSettled() &&
        (m.type === 'conveyor' || m.type === 'pipe' || hasModelPlanned(m.type))
      )
        continue;
      if (m.type === 'conveyor') {
        const entry = beltEntry(this.factory, m);
        this.entries.set(m.id, entry);
        addBelt(
          mb,
          m,
          entry,
          hexToRgb(
            m.broken
              ? '#7a2e2a'
              : (machineDef('conveyor').tierColors?.[m.tier - 1] ?? machineDef('conveyor').color),
          ),
          this.factory,
          bands,
        );
      } else {
        const start = mb.positions.length;
        const tint =
          m.type === 'pipe'
            ? m.broken
              ? '#7a2e2a'
              : machineDef('pipe').tierColors?.[m.tier - 1]
            : m.type === 'waypoint'
              ? (m.tint ?? WAYPOINT_COLORS[0])
              : undefined;
        const parts = animatedParts(m.type);
        const piped =
          m.type === 'pipe' &&
          addPipeModel(mb, m, this.factory.fluidSides(m), tint ? hexToRgb(tint) : undefined);
        if (!piped)
          addMachineBody(
            mb,
            m.type,
            m.gx,
            m.gz,
            m.rot,
            this.factory.fluidSides(m),
            m.lift,
            tint,
            !!parts,
            this.factory.gateOpen(m),
          );
        const worn = this.damageLevel(m);
        if (worn > 0) burn(mb, start, worn);
        if (parts) this.addMover(m, parts);
        this.addFlames(m);
        this.addParts(m);
        if (!modelFor(m.type) && !piped) growBody(mb, start, m);
        fluidArrows(mb, m.type, m.gx, m.gz, m.rot);
        const io = ports(m.type, m.gx, m.gz, m.rot);
        for (const o of io.outs) flatArrow(mb, o.cell, o.dir, OUT_ARROW);
        for (const i of io.ins)
          flatArrow(mb, i.cell, i.dir, m.type === 'boiler' ? COAL_ARROW : IN_ARROW);
        liftBody(mb, start, m.type === 'pipe' ? 0 : m.lift);
      }
    }
    this.bodies.geometry.dispose();
    this.bodies.geometry = geometryOf(mb);
    this.bands.geometry.dispose();
    this.bands.geometry = bands.geometry();
    this.rebuildFlags();
    // Fils électriques : du haut d'un poteau au poteau voisin ou à la machine raccordée.
    const pts: number[] = [];
    const top = (m: Machine): [number, number, number] => {
      const { w, d } = dims(m.type, m.rot);
      // Le câble s'accroche à la boule de la borne (ou au haut du poteau) quand le modèle la donne.
      const model = modelFor(m.type);
      if (model?.anchor) {
        const p = placementOf(m, model).place(model.anchor.x, model.anchor.y, model.anchor.z);
        return [
          (m.gx + w / 2) * CELL_SIZE_M + p[0],
          levelY(m.lift) + p[1],
          (m.gz + d / 2) * CELL_SIZE_M + p[2],
        ];
      }
      const h = isPole(m.type) ? visualHeight(m.type) - 0.3 : visualHeight(m.type);
      return [(m.gx + w / 2) * CELL_SIZE_M, h + levelY(m.lift), (m.gz + d / 2) * CELL_SIZE_M];
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

  /** Balises : un faisceau lumineux (visible de loin) et leur nom au-dessus. */
  private rebuildFlags(): void {
    for (const child of [...this.flags.children]) {
      this.flags.remove(child);
      const mesh = child as THREE.Mesh | THREE.Sprite;
      if ('geometry' in mesh) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material & { map?: THREE.Texture | null };
      material.map?.dispose();
      material.dispose();
    }
    for (const m of this.factory.machines) {
      if (m.type !== 'waypoint') continue;
      const color = m.tint ?? WAYPOINT_COLORS[0];
      const x = (m.gx + 0.5) * CELL_SIZE_M;
      const z = (m.gz + 0.5) * CELL_SIZE_M;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 60, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(x, 30, z);
      this.flags.add(beam);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 8, 256, 48);
        ctx.fillStyle = color;
        ctx.fillRect(0, 8, 8, 48);
        ctx.fillStyle = '#fff';
        ctx.fillText(m.label || t('waypoint.default'), 132, 44, 236);
      }
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
      );
      label.scale.set(2.4, 0.6, 1);
      label.position.set(x, 2.6, z);
      label.renderOrder = 10;
      this.flags.add(label);
    }
  }

  /** Parties mobiles des modèles articulés (piston, bras, tête de scanner) : un objet par machine. */
  private readonly movers = new THREE.Group();
  private moverList: { m: Machine; kind: AnimKind; mesh: THREE.Mesh; angle: number }[] = [];
  private lastTime = 0;

  private clearMovers(): void {
    for (const a of this.moverList) {
      this.movers.remove(a.mesh);
      a.mesh.geometry.dispose();
    }
    this.moverList = [];
    for (const f of this.flameList) {
      this.flames.remove(f.mesh);
      f.mesh.geometry.dispose();
    }
    this.flameList = [];
    for (const p of this.partList)
      for (const i of p.items) {
        this.parts.remove(i.mesh);
        i.mesh.geometry.dispose();
      }
    this.partList = [];
  }

  /** Flammes animées des modèles qui en ont (maillages `flamme_*` / `coeur_*`) : un seul objet par machine. */
  private readonly flames = new THREE.Group();
  private flameList: FlameInstance[] = [];

  /** Pose les flammes d'une machine comme son corps (même échelle, même orientation), dans un objet à part. */
  private addFlames(m: Machine): void {
    const model = modelFor(m.type);
    const parts = model?.flames;
    if (!model || !parts) return;
    const { w, d, place } = placementOf(m, model);
    const base = new Float32Array(parts.positions.length);
    for (let i = 0; i < base.length; i += 3) {
      const p = place(parts.positions[i], parts.positions[i + 1], parts.positions[i + 2]);
      base.set(p, i);
    }
    const groups = parts.groups.map((g) => {
      const p = place(g.px, g.py, g.pz);
      return {
        first: g.first,
        count: g.count,
        px: p[0],
        py: p[1],
        pz: p[2],
        glow: g.glow,
        pulse: g.pulse,
      };
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(parts.colors.slice(), 3));
    geometry.setIndex(new THREE.BufferAttribute(parts.index, 1));
    geometry.computeBoundingSphere();
    // Les flammes bougent peu : on agrandit la sphère pour qu'elles ne disparaissent pas au bord de l'écran.
    if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.3;
    const mesh = new THREE.Mesh(geometry, flameMaterial);
    mesh.position.set((m.gx + w / 2) * CELL_SIZE_M, levelY(m.lift), (m.gz + d / 2) * CELL_SIZE_M);
    mesh.visible = false;
    this.flames.add(mesh);
    this.flameList.push({
      m,
      mesh,
      base,
      colors: parts.colors,
      groups,
      level: 0,
    });
  }

  /**
   * Fait vaciller les flammes (appelée à chaque image, `time` en secondes) : pleines quand la machine travaille, réduites à
   * 20 % (braises) si elle a du combustible mais ne travaille pas, cachées sans combustible. Seules les machines à moins
   * de `range` mètres de `near` sont mises à jour ; on ne réécrit que les sommets des flammes.
   */
  updateFlames(time: number, near?: { x: number; z: number }, range = 70): void {
    const dt = Math.min(0.1, Math.max(0, time - this.flameTime));
    this.flameTime = time;
    for (const f of this.flameList) {
      const mesh = f.mesh;
      if (near && Math.hypot(mesh.position.x - near.x, mesh.position.z - near.z) > range) continue;
      const running = this.animating(f.m);
      const target = running ? 1 : f.m.fuelLeft > 0 || (f.m.fuel?.count ?? 0) > 0 ? 0.2 : 0;
      f.level += (target - f.level) * Math.min(1, dt * 5);
      // Des voyants restent visibles (ternes) à l'arrêt : sans eux, il resterait un trou dans la machine.
      mesh.visible = f.level > 0.03 || f.groups.some((g) => g.pulse);
      if (!mesh.visible) continue;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const carr = col.array as Float32Array;
      f.groups.forEach((g, k) => {
        // Deux sinus de fréquences différentes et un déphasage propre à chaque machine et à chaque flamme.
        const ph = f.m.id * 1.7 + k * 2.3;
        if (g.pulse) {
          // Voyant : sa couleur, terne à l'arrêt, qui pulse doucement en marche.
          const k = 0.35 + 0.65 * Math.min(1, f.level) * (0.75 + 0.25 * Math.sin(time * 3 + ph));
          for (let i = g.first; i < g.first + g.count; i++) {
            const o = i * 3;
            arr[o] = f.base[o];
            arr[o + 1] = f.base[o + 1];
            arr[o + 2] = f.base[o + 2];
            carr[o] = f.colors[o] * k;
            carr[o + 1] = f.colors[o + 1] * k;
            carr[o + 2] = f.colors[o + 2] * k;
          }
          return;
        }
        if (g.glow) {
          // Lueur (braises d'un foyer) : forme fixe, la couleur rougeoie lentement entre un rouge sombre et un orange vif.
          const t = 0.5 + 0.25 * Math.sin(time * 2.1 + ph) + 0.25 * Math.sin(time * 3.7 + ph * 1.3);
          const heat = Math.min(1, f.level) * (0.55 + 0.45 * t);
          for (let i = g.first; i < g.first + g.count; i++) {
            const o = i * 3;
            arr[o] = f.base[o];
            arr[o + 1] = f.base[o + 1];
            arr[o + 2] = f.base[o + 2];
            carr[o] = 0.35 + 0.75 * heat;
            carr[o + 1] = 0.02 + 0.5 * heat * t;
            carr[o + 2] = 0.01 + 0.08 * heat * t;
          }
          return;
        }
        const wave = 0.5 * Math.sin(time * 9 + ph) + 0.5 * Math.sin(time * 14.3 + ph * 1.9);
        const sy = f.level * (0.975 + 0.175 * wave);
        const sxz = f.level * (1 + 0.06 * Math.sin(time * 11 + ph * 1.3));
        const light = 1 + 0.12 * wave;
        for (let i = g.first; i < g.first + g.count; i++) {
          const o = i * 3;
          arr[o] = g.px + (f.base[o] - g.px) * sxz;
          arr[o + 1] = g.py + (f.base[o + 1] - g.py) * sy;
          arr[o + 2] = g.pz + (f.base[o + 2] - g.pz) * sxz;
          carr[o] = f.colors[o] * light;
          carr[o + 1] = f.colors[o + 1] * light;
          carr[o + 2] = f.colors[o + 2] * light;
        }
      });
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
  }
  private flameTime = 0;

  /** Pièces mobiles des modèles maison (voir `partMotions.ts`) : un objet par groupe et par machine. */
  private readonly parts = new THREE.Group();
  private partList: PartMachine[] = [];
  private partTime = 0;

  /** Sort du corps fixe les groupes mobiles d'une machine et les pose, chacun dans son objet, autour de son pivot. */
  private addParts(m: Machine): void {
    const model = modelFor(m.type);
    const motions = MOTIONS[m.type];
    if (!model?.groups || !motions) return;
    const { w, d, scale, place, turn } = placementOf(m, model);
    const tint = hexToRgb(machineDef(m.type).color);
    const origin: [number, number, number] = [
      (m.gx + w / 2) * CELL_SIZE_M,
      levelY(m.lift),
      (m.gz + d / 2) * CELL_SIZE_M,
    ];
    const machine: PartMachine = {
      m,
      items: [],
      scale,
      turn,
      level: 0,
      phase: 0,
      crank: 0,
      rocker: 0,
    };
    for (const [name, group] of Object.entries(model.groups)) {
      const own = motions[name];
      if (!own) continue;
      const motion = { ...withStep(own, group.step), parent: own.parent };
      const pivot = place(group.pivot.x, group.pivot.y, group.pivot.z);
      const pos = new Float32Array(group.positions.length);
      const nor = new Float32Array(group.normals.length);
      const col = new Float32Array(group.colors.length);
      for (let i = 0; i < pos.length; i += 3) {
        const p = place(group.positions[i], group.positions[i + 1], group.positions[i + 2]);
        pos[i] = p[0] - pivot[0];
        pos[i + 1] = p[1] - pivot[1];
        pos[i + 2] = p[2] - pivot[2];
        nor.set(turn(group.normals[i], group.normals[i + 1], group.normals[i + 2]), i);
        // Même teinte légère que le corps de la machine.
        col[i] = group.colors[i] + (tint.r - group.colors[i]) * 0.12;
        col[i + 1] = group.colors[i + 1] + (tint.g - group.colors[i + 1]) * 0.12;
        col[i + 2] = group.colors[i + 2] + (tint.b - group.colors[i + 2]) * 0.12;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geometry.setIndex(new THREE.BufferAttribute(group.index, 1));
      const mesh = new THREE.Mesh(geometry, propsMaterial);
      mesh.castShadow = true;
      mesh.position.set(origin[0] + pivot[0], origin[1] + pivot[1], origin[2] + pivot[2]);
      this.parts.add(mesh);
      const axis = turn(group.axis.x, group.axis.y, group.axis.z);
      machine.items.push({
        name,
        mesh,
        motion,
        parent: motion.parent,
        pivot: new THREE.Vector3(origin[0] + pivot[0], origin[1] + pivot[1], origin[2] + pivot[2]),
        axis: new THREE.Vector3(...axis).normalize(),
        modelAxis: group.axis,
        spin: 0,
      });
    }
    if (machine.items.length === 0) return;
    // Les pièces portées passent après celles qui les portent.
    const depth = (i: PartItem): number =>
      i.parent ? 1 + depth(machine.items.find((x) => x.name === i.parent) ?? i) : 0;
    machine.items.sort((a, b) => depth(a) - depth(b));
    const g = model.groups;
    if (g.balancier && g.manivelle && g.bielle && g.tige) {
      // Chevalet : plan (u = devant, v = haut) relevé sur les pivots du modèle, origine au palier du balancier.
      const b = g.balancier.pivot;
      // Bas des bielles = maneton au repos : moyenne des sommets les plus bas du groupe.
      const bp = g.bielle.positions;
      let low = Infinity;
      for (let i = 1; i < bp.length; i += 3) low = Math.min(low, bp[i]);
      let pz = 0;
      let py = 0;
      let n = 0;
      for (let i = 0; i < bp.length; i += 3)
        if (bp[i + 1] < low + 0.03) {
          pz += bp[i + 2];
          py += bp[i + 1];
          n++;
        }
      const pin = { u: pz / n - b.z, v: py / n - b.y };
      const crank = { u: g.manivelle.pivot.z - b.z, v: g.manivelle.pivot.y - b.y };
      machine.rockerGeometry = {
        ...ROCKER_DEFAULT,
        radius: Math.hypot(pin.u - crank.u, pin.v - crank.v),
        beta0: Math.atan2(pin.v - crank.v, pin.u - crank.u),
        crank,
        top: { u: g.bielle.pivot.z - b.z, v: g.bielle.pivot.y - b.y },
        cable: Math.abs(g.tige.pivot.z - b.z),
      };
    }
    this.partList.push(machine);
  }

  /**
   * Anime les pièces mobiles (appelée à chaque image, `time` en secondes) : elles bougent tant que la machine travaille et
   * s'arrêtent en douceur sinon. Seules les matrices des objets changent ; machines à plus de `range` m de `near` ignorées.
   */
  updateParts(time: number, near?: { x: number; z: number }, range = 70): void {
    const dt = Math.min(0.1, Math.max(0, time - this.partTime));
    this.partTime = time;
    setBandTime(time);
    for (const p of this.partList) {
      const first = p.items[0].mesh;
      if (near && Math.hypot(first.position.x - near.x, first.position.z - near.z) > range)
        continue;
      const running = isChest(p.m.type) ? this.chestOpen(p, time) : this.animating(p.m);
      p.level += ((running ? 1 : 0) - p.level) * Math.min(1, dt * 4);
      p.phase += dt * p.level;
      const cycle = this.factory.cycleFraction(p.m);
      const offsets = new Map<string, THREE.Vector3>();
      let rocker: ReturnType<typeof rockerPose> | undefined;
      if (p.rockerGeometry) {
        p.crank += dt * p.level * 1.3;
        rocker = rockerPose(p.rockerGeometry, p.crank, p.rocker);
        p.rocker = rocker.rocker;
      }
      for (const i of p.items) {
        const motion = i.motion;
        let angle = 0;
        let off = new THREE.Vector3();
        if (motion.kind === 'rocker' && rocker) {
          // Le modèle se lit en (x, y haut, z devant) ; la cinématique en (u = devant, v = haut).
          if (motion.role === 'manivelle') angle = rocker.crank;
          else if (motion.role === 'balancier') angle = rocker.rocker;
          else if (motion.role === 'tige') off = new THREE.Vector3(...p.turn(0, -rocker.rod, 0));
          else {
            angle = rocker.link;
            off = new THREE.Vector3(...p.turn(0, rocker.topV, rocker.topU));
          }
        } else {
          if (motion.kind === 'spin') i.spin += motion.speed * dt * p.level;
          const pose = poseOf(motion, p.phase, i.spin, cycle, i.modelAxis, p.level);
          angle = pose.angle;
          off = new THREE.Vector3(...p.turn(pose.dx, pose.dy, pose.dz));
        }
        off.multiplyScalar(p.scale);
        // Une pièce portée par une autre (chariot sur portique…) suit son déplacement total.
        const carried = i.parent ? offsets.get(i.parent) : undefined;
        if (carried) off.add(carried);
        offsets.set(i.name, off);
        i.mesh.position.copy(i.pivot).add(off);
        i.mesh.quaternion.setFromAxisAngle(i.axis, angle);
      }
    }
  }

  /**
   * La machine est-elle « en marche » pour ses animations ? En plus de l'état `running` : plasma du réacteur à fusion,
   * réacteur à fission en surchauffe, relais et antenne alimentés, accumulateur raccordé, manivelle qu'on actionne.
   */
  private animating(m: Machine): boolean {
    if (m.type === 'crank') return this.opened === m.id;
    if (m.type === 'relay' || m.type === 'antenna') return this.factory.powerFactor(m) > 0;
    if (isAccumulator(m.type)) return this.factory.gridInfo(m) !== null;
    // Tourelle : prête à tirer (munitions ou courant) = « idle » ; elle balaye alors l'horizon.
    if (isTurret(m.type)) return this.factory.status(m) === 'idle';
    const s = this.factory.status(m);
    return s === 'running' || s === 'plasma' || s === 'overheat';
  }

  /** Machine dont la fenêtre est ouverte (son coffre s'ouvre), ou null. */
  private opened: number | null = null;
  setOpenedMachine(id: number | null): void {
    this.opened = id;
  }

  /**
   * Couvercle d'un coffre : ouvert tant que sa fenêtre est ouverte, et un moment quand un objet entre ou sort (bras,
   * tapis, joueur).
   */
  private chestOpen(p: PartMachine, time: number): boolean {
    const seen = p.m.slots.map((s) => `${s.item}:${s.count}`).join(',');
    if (p.chestSeen !== undefined && seen !== p.chestSeen) p.openUntil = time + 1.6;
    p.chestSeen = seen;
    return this.opened === p.m.id || time < (p.openUntil ?? 0);
  }

  /** Crée l'objet mobile (partie haute) d'une machine articulée, posé à l'emplacement de la machine. */
  private addMover(
    m: Machine,
    parts: { kind: AnimKind; high: import('./models').BakedModel },
  ): void {
    const def = machineDef(m.type);
    const { w, d } = dims(m.type, m.rot);
    const model = modelFor(m.type);
    if (!model) return;
    const odd = m.rot % 2 === 1;
    const sizeX = odd ? model.size.z : model.size.x;
    const sizeZ = odd ? model.size.x : model.size.z;
    const sx = w * CELL_SIZE_M - 0.06;
    const sz = d * CELL_SIZE_M - 0.06;
    const scale = Math.min(sx / sizeX, sz / sizeZ, (def.height * 1.3) / model.size.y);
    const mb = new MeshBuilder();
    mb.model(parts.high, 0, 0, 0, MODEL_TURNS[m.rot % 4], scale, hexToRgb(def.color), 0.12);
    const mesh = new THREE.Mesh(geometryOf(mb), propsMaterial);
    mesh.castShadow = true;
    mesh.position.set((m.gx + w / 2) * CELL_SIZE_M, levelY(m.lift), (m.gz + d / 2) * CELL_SIZE_M);
    this.movers.add(mesh);
    this.moverList.push({ m, kind: parts.kind, mesh, angle: 0 });
  }

  /**
   * Anime les modèles articulés (appelée à chaque image, `time` en secondes) : le piston s'abat en fin de cycle, le bras
   * pivote tant qu'il travaille, la tête du scanner tourne.
   */
  updateMovers(time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    for (const a of this.moverList) {
      const running = this.factory.status(a.m) === 'running';
      if (a.kind === 'press') {
        const f = this.factory.cycleFraction(a.m) ?? 0;
        // Course du piston : il reste en haut, puis s'abat sur le dernier quart du cycle.
        const stroke = f > 0.75 ? Math.sin(((f - 0.75) / 0.25) * Math.PI) : 0;
        a.mesh.position.y = levelY(a.m.lift) - 0.14 * stroke;
      } else if (a.kind === 'swing') {
        const target = running ? Math.sin(time * 2.2 + a.m.id) * 0.9 : 0;
        a.angle += (target - a.angle) * Math.min(1, dt * 6);
        a.mesh.rotation.y = a.angle;
      } else {
        a.angle += running ? dt * 1.6 : 0;
        a.mesh.rotation.y = a.angle;
      }
    }
  }

  /** Anime la fumée blanche des turbines en marche (appelée à chaque image, `time` en secondes). */
  updateSmoke(time: number): void {
    const PER = 7;
    const pos: number[] = [];
    const col: number[] = [];
    // Tuyaux rompus : explosion de vapeur au début (gerbe rapide), puis jet continu qui siffle par la fissure.
    const live = new Set<number>();
    for (const m of this.pipes) {
      if (!m.broken) continue;
      live.add(m.id);
      const since = time - (this.burstAt.get(m.id) ?? (this.burstAt.set(m.id, time), time));
      const cx = (m.gx + 1) * CELL_SIZE_M;
      const cz = (m.gz + 1) * CELL_SIZE_M;
      const N = since < 1.5 ? 22 : 9;
      for (let i = 0; i < N; i++) {
        const t = (time * (since < 1.5 ? 1.6 : 0.8) + i / N + m.id * 0.31) % 1;
        const a = i * 2.399 + m.id;
        const spread = (since < 1.5 ? 0.9 : 0.35) * t;
        pos.push(
          cx + Math.cos(a) * spread,
          0.35 + t * (since < 1.5 ? 2.6 : 1.7),
          cz + Math.sin(a) * spread,
        );
        // Vapeur blanche, quelques étincelles orangées au début.
        if (since < 1.5 && i % 5 === 0) col.push(1, 0.55 - 0.3 * t, 0.15);
        else {
          const g = 1 - 0.3 * t;
          col.push(g, g, g);
        }
      }
    }
    for (const id of [...this.burstAt.keys()]) if (!live.has(id)) this.burstAt.delete(id);
    // Machines très abîmées (moins de 50 %) : fumée noire, avec des étincelles sous 25 %.
    for (const m of this.damaged) {
      const level = this.damageLevel(m);
      if (level < 2 || m.type === 'conveyor' || m.type === 'pipe') continue;
      const { w, d } = dims(m.type, m.rot);
      const cx = (m.gx + w / 2) * CELL_SIZE_M;
      const cz = (m.gz + d / 2) * CELL_SIZE_M;
      const base = visualHeight(m.type) + levelY(m.lift);
      for (let i = 0; i < 4; i++) {
        const t = (time * 0.5 + i / 4 + m.id * 0.37) % 1;
        const a = i * 2.399 + m.id;
        pos.push(cx + Math.cos(a) * 0.25 * t, base + t * 1.8, cz + Math.sin(a) * 0.25 * t);
        if (level === 3 && i === 0 && t < 0.3) col.push(1, 0.6, 0.2);
        else {
          const g = 0.22 + 0.2 * t;
          col.push(g, g, g);
        }
      }
    }
    for (const m of this.turbines) {
      const power = this.factory.turbineEfficiency(m);
      if (power <= 0 || (this.factory.gridInfo(m)?.demandKw ?? 0) <= 0) continue;
      const { w, d } = dims(m.type, m.rot);
      const cx = (m.gx + w / 2) * CELL_SIZE_M;
      const cz = (m.gz + d / 2) * CELL_SIZE_M;
      const base = visualHeight(m.type) + levelY(m.lift);
      for (let i = 0; i < PER; i++) {
        // Phase de chaque volute : elle monte, s'étale et s'éclaircit en s'éloignant.
        const t = (time * 0.3 + i / PER + m.id * 0.137) % 1;
        const sway = Math.sin(time * 1.3 + i * 2.1 + m.id) * 0.25 * t;
        pos.push(
          cx + sway + Math.sin(i * 12.9) * 0.12,
          base + t * 2.4,
          cz + Math.cos(time + i) * 0.15 * t,
        );
        const g = 0.95 - 0.35 * t;
        col.push(g, g, g);
      }
    }
    const geo = this.smoke.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.smoke.visible = pos.length > 0;
  }

  /** Remet les objets à leur place sur les tapis (quelques fois par seconde suffit). */
  updateItems(): void {
    const mb = new MeshBuilder();
    if (!modelsSettled()) {
      this.items.geometry.dispose();
      this.items.geometry = geometryOf(mb);
      return;
    }
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
      const amount =
        m.fluid.water + m.fluid.steam + m.fluid.hot + m.fluid.oil + m.fluid.polymer + m.fluid.dirty;
      if (amount < 1) continue;
      const color =
        m.fluid.dirty > 0.5
          ? hexToRgb('#8fbf3a')
          : m.fluid.polymer > 0.5
            ? hexToRgb('#b58be0')
            : m.fluid.oil > 0.5
              ? hexToRgb('#1c1c22')
              : m.fluid.hot >= m.fluid.water && m.fluid.hot >= m.fluid.steam
                ? hexToRgb('#f08a3a')
                : m.fluid.water >= m.fluid.steam
                  ? hexToRgb('#3fa9f5')
                  : hexToRgb('#f2f5f7');
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
      for (const [i, g] of list.entries()) {
        const color = g.ok ? GREEN : RED;
        const first = mb.positions.length;
        const { w, d } = dims(g.type, g.rot);
        const x = (g.gx + w / 2) * CELL_SIZE_M;
        const z = (g.gz + d / 2) * CELL_SIZE_M;
        if (g.type === 'conveyor') {
          // Tapis droit au sol : le vrai modèle ; pentes et surélevés : la forme simple.
          const shape = {
            type: 'conveyor',
            tier: 1,
            rot: g.rot,
            gx: g.gx,
            gz: g.gz,
            lift: 0,
            broken: false,
          } as Machine;
          // Dans un angle, le patron prend la forme du virage (comme le tapis posé).
          const entry = this.ghostBeltEntry(list, i, shape);
          if (!((g.lift ?? 0) === 0 && addBeltModel(mb, shape, entry, 0, color)))
            ghostBelt(mb, x, z, g.rot, g.lift ?? 0, color);
        } else if (g.type === 'pipe' && (g.lift ?? 0) === 0 && this.ghostPipe(mb, list, i, color)) {
          // Tuyau : modèle d'après les côtés raccordés (coude, té, croix…).
        } else {
          // Le patron est l'objet lui-même (son modèle ou ses formes), teinté de vert ou de rouge.
          addMachineBody(mb, g.type, g.gx, g.gz, g.rot, [], g.lift ?? 0);
        }
        tintFrom(mb, first, color, 0.45);
        // Flèches : sorties vers l'extérieur, entrées vers l'intérieur.
        const io = ports(g.type, g.gx, g.gz, g.rot);
        fluidArrows(mb, g.type, g.gx, g.gz, g.rot, (c) =>
          shade(color, (c.r + c.g + c.b) / 3 + 0.3),
        );
        for (const o of io.outs) flatArrow(mb, o.cell, o.dir, shade(color, 0.85));
        for (const i of io.ins) flatArrow(mb, i.cell, i.dir, shade(color, 1.3));
        if (g.type !== 'conveyor' && g.type !== 'pipe') liftBody(mb, first, g.lift ?? 0);
      }
      this.ghost.geometry.dispose();
      this.ghost.geometry = geometryOf(mb);
    }
    this.ghost.visible = true;
  }

  /** Côté d'où arrive le tapis du patron : le tapis précédent du tracé, sinon ce qui est déjà posé. */
  private ghostBeltEntry(
    list: { type: MachineType; gx: number; gz: number; rot: number; lift?: number }[],
    i: number,
    m: Machine,
  ): { ex: number; ez: number; curved: boolean } {
    const prev = list[i - 1];
    if (prev && prev.type === 'conveyor' && (prev.lift ?? 0) === 0 && prev.rot !== m.rot) {
      const { w, d } = dims('conveyor', prev.rot);
      const [px, pz] = RISE_DIR[prev.rot];
      if (prev.gx + px * w === m.gx && prev.gz + pz * d === m.gz && prev.rot !== (m.rot + 2) % 4)
        return { ex: -px, ez: -pz, curved: true };
    }
    if (prev && prev.type === 'conveyor' && prev.rot === m.rot) {
      const [dx, dz] = RISE_DIR[m.rot];
      return { ex: -dx, ez: -dz, curved: false };
    }
    return beltEntry(this.factory, m);
  }

  /** Patron de tuyau en modèle, raccordé aux tuyaux voisins du tracé et à ceux déjà posés. */
  private ghostPipe(
    mb: MeshBuilder,
    list: { type: MachineType; gx: number; gz: number; rot: number; lift?: number }[],
    i: number,
    color: Rgb,
  ): boolean {
    const g = list[i];
    const { w, d } = dims('pipe', 0);
    const sides: number[] = [];
    for (let side = 0; side < 4; side++) {
      const [dx, dz] = RISE_DIR[side];
      const gx = g.gx + dx * w;
      const gz = g.gz + dz * d;
      const same = (o: { type: MachineType; gx: number; gz: number; lift?: number }): boolean =>
        o.type === 'pipe' && o.gx === gx && o.gz === gz && (o.lift ?? 0) === 0;
      if (list.some(same) || this.factory.machines.some(same)) sides.push(side);
    }
    const shape = { type: 'pipe', tier: 1, rot: g.rot, gx: g.gx, gz: g.gz, lift: 0 } as Machine;
    return addPipeModel(mb, shape, sides, color);
  }

  hideGhost(): void {
    this.ghost.visible = false;
    this.ghostKey = '';
  }

  dispose(): void {
    this.scene.remove(this.root, this.ghost);
    this.clearMovers();
    for (const child of [...this.flags.children]) this.flags.remove(child);
    this.bodies.geometry.dispose();
    this.items.geometry.dispose();
    this.wires.geometry.dispose();
    (this.wires.material as THREE.Material).dispose();
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();
    this.smoke.geometry.dispose();
    (this.smoke.material as THREE.Material).dispose();
  }
}

/** Hauteur (m) d'un objet sur un tapis à l'avancement `pos`, ou null s'il est caché sous terre. */
function itemHeight(m: Machine, pos: number): number | null {
  // Tunnel : l'objet disparaît dans le portail de l'entrée et réapparaît à celui de la sortie.
  if (m.lift === 4) return pos < 0.8 ? BELT_H : null;
  if (m.lift === 5) return pos > 0.2 ? BELT_H : null;
  const { from, to } = LIFTS[m.lift];
  return BELT_H + levelY(from) + (levelY(to) - levelY(from)) * pos;
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
    mb.box(x, levelY(from), z, BELT_W, 0.14, BELT_W, color, true);
    return;
  }
  slope(mb, x, z, rot, levelY(from), levelY(to), 0.14, color);
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
    if (height > levelY(1) && factory.machineAt(c.gx, c.gz, 1)) return;
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
  bands?: BandBuilder,
): void {
  const { gx, gz, rot, lift } = m;
  const cxm = (gx + 1) * CELL_SIZE_M;
  const czm = (gz + 1) * CELL_SIZE_M;
  const [fx, fz] = RISE_DIR[rot];
  const shape = LIFTS[lift];
  if (shape.from !== shape.to) {
    const [y0, y1] = [levelY(shape.from), levelY(shape.to)];
    slope(mb, cxm, czm, rot, y0, y1, BELT_H, color);
    return;
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
    return;
  }
  const height = levelY(shape.from);
  if (height > 0) pillar(mb, m, factory, color, height);
  if (addBeltModel(mb, m, entry, height, color, bands)) return;
  addFlatBelt(mb, gx, gz, rot, entry, color, height);
}

/**
 * Tuyau en modèle maison : forme d'après les côtés raccordés (ou tunnel), tournée pour les couvrir, à l'échelle de la
 * tuile (les brides se touchent d'une tuile à l'autre). Renvoie faux si le modèle n'est pas chargé (forme simple).
 */
function addPipeModel(mb: MeshBuilder, m: Machine, sides: number[], tint?: Rgb): boolean {
  const { form, turns } = pipeShape(sides, m.lift, m.rot);
  const model = pipeModel(form, m.tier);
  if (!model) return false;
  const scale = TILE_M / model.size.x;
  mb.model(
    model,
    (m.gx + 1) * CELL_SIZE_M,
    0,
    (m.gz + 1) * CELL_SIZE_M,
    turns,
    scale,
    tint,
    m.broken ? 0.6 : 0,
    false,
    scale,
  );
  return true;
}

/**
 * Orientation des modèles de tapis du kit (voir `RISE_DIR` : tourner de `t` quarts de tour envoie +z vers `RISE_DIR[t]`).
 * Le tapis droit circule le long de l'axe x du modèle ; le coude relie les côtés −x et +z (son coin extérieur arrondi est en +x, −z).
 */
const BELT_TURN_OFFSET = 3;

/**
 * Tapis plat (ou surélevé) en modèle 3D ; renvoie faux si le modèle n'est pas encore chargé. Les lames d'un tapis maison
 * (groupe `bande`) vont dans `bands`, qui les fait défiler ; sans `bands` (aperçu de pose), elles restent fixes.
 */
function addBeltModel(
  mb: MeshBuilder,
  m: Machine,
  entry: { ex: number; ez: number; curved: boolean },
  height: number,
  color: Rgb,
  bands?: BandBuilder,
): boolean {
  let turns = (m.rot + BELT_TURN_OFFSET) % 4;
  let shape: BeltShape = 'straight';
  if (entry.curved) {
    // Coude : relie la sortie à un côté voisin ; le modèle (côtés −x et +z) est tourné pour couvrir cette paire.
    // `first === m.rot` : les objets entrent par le côté +z du modèle et sortent par −x (coude « inverse »).
    const entrySide = RISE_DIR.findIndex(([ex, ez]) => ex === entry.ex && ez === entry.ez);
    const first = entrySide === (m.rot + 1) % 4 ? m.rot : (m.rot + 3) % 4;
    turns = (first + 1) % 4;
    shape = first === m.rot ? 'cornerBack' : 'corner';
  }
  const model = beltModel(shape, m.tier);
  if (!model) return false;
  const x = (m.gx + 1) * CELL_SIZE_M;
  const z = (m.gz + 1) * CELL_SIZE_M;
  // Hauteur du dessus du modèle = hauteur où roulent les objets.
  const scaleY = BELT_H / model.size.y;
  const tint = m.broken ? hexToRgb('#7a2e2a') : color;
  const mix = m.broken ? 0.7 : 0.1;
  const scale = TILE_M / model.size.x;
  mb.model(model, x, height, z, turns, scale, tint, mix, false, scaleY);
  const band = model.groups?.bande;
  if (band && bands) {
    const speed = m.broken ? 0 : beltSpeed(m.tier) * TILE_M;
    bands.add(band, model, shape, x, height, z, turns, scale, scaleY, TILE_M / 2, speed, tint, mix);
  } else if (band)
    mb.model(
      { ...band, min: model.min, size: model.size },
      x,
      height,
      z,
      turns,
      scale,
      tint,
      mix,
      false,
      scaleY,
    );
  return true;
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
}

/** Hauteur à laquelle chaque forme est dessinée (avant l'alignement des fiches sur des multiples de 50 cm). */
const DRAWN_HEIGHT: Partial<Record<MachineType, number>> = {
  drill: 1.3,
  drill_electric: 1.3,
  furnace: 1.0,
  stamper: 1.0,
  crusher: 1.0,
  bessemer: 1.5,
  mixer: 1.0,
  barreler: 1.0,
  booster: 1.0,
  pumpjack: 1.5,
  refinery: 2.0,
  centrifuge: 1.0,
  evaporation_tower: 2.0,
  accumulator: 1.2,
  fusion_reactor: 3.0,
  relay: 1.5,
  antenna: 3.0,
  vitrifier: 1.2,
  fission_reactor: 2.5,
  plastic_press: 1.0,
  furnace_electric: 1.2,
  cooling_tower: 1.5,
  builder: 1.0,
  heavy_press: 1.2,
  washer: 1.0,
  waterwheel: 1.5,
  chest_wood: 0.6,
  chest_iron: 0.6,
  generator: 1.1,
  pole: 3.6,
  pole_hv: 6.1,
  pole_uhv: 10.1,
  transformer: 2.6,
  breaker: 1.6,
  lamp: 3.1,
  thermometer: 1.3,
  vane: 2.6,
  wind_turbine: 6.1,
  solar_panel: 1.3,
  accumulator_basic: 1.1,
  charger: 1.9,
  air_compressor: 1.6,
  electrolyzer: 1.6,
  fuel_cell: 1.5,
  air_purifier: 1.9,
  drill_plasma: 2.6,
  arm_industrial: 1.3,
  fabricator: 2.1,
  quantum_chest: 1.0,
  turret_rail: 1.5,
  hologram_projector: 1.6,
  hologram_gate: 2.6,
  crank: 1.0,
  splitter: 0.4,
  merger: 0.4,
  arm: 0.7,
  arm_electric: 0.7,
  arm_filter: 0.7,
  sorter: 0.4,
  assembler: 1.0,
  assembler_advanced: 1.0,
  lab: 0.9,
  pipe: 0.3,
  pump: 0.8,
  boiler: 1.5,
  turbine: 1.1,
  turret: 0.9,
};

/** Monte tout ce qui a été dessiné depuis `start` à la hauteur du niveau (machine posée à l'étage). */
function liftBody(mb: MeshBuilder, start: number, level: number): void {
  if (level <= 0) return;
  for (let i = start + 1; i < mb.positions.length; i += 3) mb.positions[i] += levelY(level);
}

/** Agrandit le corps d'une machine de 10 cm en largeur, longueur et hauteur (autour de son centre au sol). */
function growBody(mb: MeshBuilder, start: number, m: Machine): void {
  const { w, d } = dims(m.type, m.rot);
  const W = w * CELL_SIZE_M;
  const D = d * CELL_SIZE_M;
  // Les formes sont dessinées à l'ancienne hauteur : on les ramène à la hauteur de la fiche (multiple de 50 cm).
  const H = DRAWN_HEIGHT[m.type] ?? machineDef(m.type).height;
  const target = machineDef(m.type).height;
  const cx = (m.gx + w / 2) * CELL_SIZE_M;
  const cz = (m.gz + d / 2) * CELL_SIZE_M;
  const kx = (W + GROW_M) / W;
  const kz = (D + GROW_M) / D;
  const ky = (target + GROW_M) / H;
  const p = mb.positions;
  for (let i = start; i < p.length; i += 3) {
    p[i] = cx + (p[i] - cx) * kx;
    p[i + 1] *= ky;
    p[i + 2] = cz + (p[i + 2] - cz) * kz;
  }
}

/** Quarts de tour à donner à un modèle du kit selon l'orientation de la machine. */
const MODEL_TURNS = [0, 1, 2, 3] as const;

/** Barrière ou portail : poteaux, lisses ou pleins de béton ; un portail ouvert pousse son vantail sur le côté. */
function addBarrierBody(
  mb: MeshBuilder,
  type: MachineType,
  x: number,
  z: number,
  sx: number,
  sz: number,
  color: Rgb,
  open: boolean,
): void {
  const def = machineDef(type);
  const long = Math.max(sx, sz);
  const alongX = sx >= sz;
  const thick = 0.22;
  // Pose un bloc de dimensions (a le long de l'axe, h, t en travers) à la position `at` le long de l'axe.
  const put = (at: number, a: number, y0: number, h: number, t: number, c: Rgb = color): void => {
    mb.box(
      alongX ? x + at : x,
      y0,
      alongX ? z : z + at,
      alongX ? a : t,
      h,
      alongX ? t : a,
      c,
      true,
    );
  };
  const dark = shade(color, 0.6);
  if (def.holo) {
    // Projecteur holographique : deux émetteurs au bout et un voile de lumière (plus mince et plus bas quand le portail est ouvert).
    for (const at of [-long / 2 + 0.12, long / 2 - 0.12])
      put(at, 0.24, 0, 0.5, 0.24, shade(color, 0.45));
    const span = long - 0.5;
    const leaf = open ? span / 6 : span;
    const at = open ? -long / 2 + 0.25 + leaf / 2 : 0;
    put(at, leaf, 0.5, def.height - 0.5, 0.04, color);
    return;
  }
  const wood = type === 'fence_wood' || type === 'gate_wood';
  const posts = def.gate ? 2 : Math.max(2, Math.round(long / 0.75) + 1);
  const h = def.height;
  for (let i = 0; i < posts; i++) {
    const at = -long / 2 + 0.1 + (i * (long - 0.2)) / (posts - 1);
    put(at, 0.16, 0, def.gate ? h : h, 0.16, wood ? dark : color);
  }
  if (def.gate) {
    // Vantail : plein sur toute la largeur (fermé), ou replié sur un tiers du côté (ouvert).
    const span = long - 0.4;
    const leaf = open ? span / 3 : span;
    const at = open ? -long / 2 + 0.2 + leaf / 2 : 0;
    if (wood) {
      for (const y0 of [0.3, 0.9, 1.5]) put(at, leaf, y0, 0.14, 0.1);
      put(at, leaf, 0.3, 1.34, 0.06, shade(color, 0.85));
    } else {
      put(at, leaf, 0.2, h - 0.35, thick * 0.6);
      if (type === 'gate_reinforced') put(at, leaf, 0.2, 0.12, thick * 0.9, dark);
    }
    return;
  }
  if (wood) {
    for (const y0 of [0.35, 0.85, 1.3]) put(0, long - 0.1, y0, 0.12, 0.1);
  } else {
    put(0, long - 0.1, 0, h * 0.8, thick, color);
    put(0, long - 0.1, h * 0.8, h * 0.2, thick * 0.7, dark);
    if (type === 'barrier_reinforced') {
      for (let i = 0; i < 4; i++)
        put(-long / 2 + (i + 0.5) * (long / 4), 0.05, 0, h, thick * 1.05, dark);
    }
  }
}

function addMachineBody(
  mb: MeshBuilder,
  type: MachineType,
  gx: number,
  gz: number,
  rot: number,
  sides: number[] = [],
  lift = 0,
  tint?: string,
  staticOnly = false,
  open = false,
): void {
  const def = machineDef(type);
  const { w, d } = dims(type, rot);
  const x = (gx + w / 2) * CELL_SIZE_M;
  const z = (gz + d / 2) * CELL_SIZE_M;
  const sx = w * CELL_SIZE_M - 0.06;
  const sz = d * CELL_SIZE_M - 0.06;
  const color = hexToRgb(tint ?? def.color);
  const [fx, fz] = RISE_DIR[rot];
  if (def.barrier) {
    addBarrierBody(mb, type, x, z, sx, sz, color, open);
    return;
  }
  const model = modelFor(type);
  if (model) {
    // Modèle 3D du kit : ajusté à l'emprise et à la hauteur de la machine, face tournée vers la sortie.
    const odd = rot % 2 === 1;
    const sizeX = odd ? model.size.z : model.size.x;
    const sizeZ = odd ? model.size.x : model.size.z;
    const scale = Math.min(sx / sizeX, sz / sizeZ, (def.height * 1.3) / model.size.y);
    // Un modèle articulé n'a ici que sa partie basse : la partie haute est un objet mobile (voir `FactoryView.movers`).
    const body = staticOnly ? (animatedParts(type)?.low ?? model) : model;
    if (type === 'waypoint') {
      // Balise : fanion et lanterne (faces magenta du modèle) à la couleur choisie, le reste garde ses teintes.
      const start = mb.colors.length;
      mb.model(body, x, 0, z, MODEL_TURNS[rot % 4], scale);
      const c = new THREE.Color(tint ?? def.color);
      for (let i = start; i < mb.colors.length; i += 3) {
        if (mb.colors[i] > 0.95 && mb.colors[i + 1] < 0.05 && mb.colors[i + 2] > 0.95) {
          mb.colors[i] = c.r;
          mb.colors[i + 1] = c.g;
          mb.colors[i + 2] = c.b;
        }
      }
      return;
    }
    mb.model(body, x, 0, z, MODEL_TURNS[rot % 4], scale, color, 0.12);
    return;
  }
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
  if (type === 'pipe' && (lift === 4 || lift === 5)) {
    // Tuyau enterré : un seul manchon côté raccord, puis une bouche sombre qui plonge dans le sol.
    const open = lift === 4 ? (rot + 2) % 4 : rot;
    const [ox, oz] = RISE_DIR[open];
    const [hx, hz] = RISE_DIR[(open + 2) % 4];
    mb.box(
      x + ox * 0.25,
      0.04,
      z + oz * 0.25,
      ox !== 0 ? 0.52 : 0.28,
      0.28,
      oz !== 0 ? 0.52 : 0.28,
      color,
      true,
    );
    mb.box(x, 0.02, z, 0.4, 0.32, 0.4, shade(color, 1.1), true);
    // Voûte côté sous-terre : dôme bas de terre avec l'ouverture sombre vers le manchon.
    mb.box(x + hx * 0.12, 0, z + hz * 0.12, 0.46, 0.22, 0.46, shade(color, 0.6), true);
    mb.box(x + hx * 0.02, 0.05, z + hz * 0.02, 0.26, 0.1, 0.26, hexToRgb('#1d1f22'), true);
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
    // Turbine : carter large (deux fois plus qu'avant), brides aux deux bouts, axe de rotor visible dessus.
    const len = fx !== 0 ? sx : sz;
    const wid = (fx !== 0 ? sz : sx) - 0.2;
    mb.box(x, 0, z, fx !== 0 ? len : wid, 0.7, fz !== 0 ? len : wid, color, true);
    for (const k of [-1, 1]) {
      mb.box(
        x + fx * k * (len / 2 - 0.06),
        0.02,
        z + fz * k * (len / 2 - 0.06),
        fx !== 0 ? 0.1 : wid + 0.08,
        0.66,
        fz !== 0 ? 0.1 : wid + 0.08,
        shade(color, 0.75),
        true,
      );
    }
    mb.box(x, 0.7, z, 0.16, 0.2, 0.16, hexToRgb('#3d3a38'), true);
    mb.box(
      x,
      0.9,
      z,
      fx !== 0 ? 0.1 : wid * 0.8,
      0.06,
      fz !== 0 ? 0.1 : wid * 0.8,
      hexToRgb('#e6c84a'),
      true,
    );
    return;
  }
  if (isTurret(type)) {
    // Tourelle : socle large, tourelle ronde et canon vers l'avant (canon double pour la lourde, pointe lumineuse pour les électriques).
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.7), true);
    mb.cone(x, 0.3, z, Math.min(sx, sz) * 0.36, 0.3, 10, color, Math.min(sx, sz) * 0.3);
    mb.box(
      x + fx * 0.28,
      0.5,
      z + fz * 0.28,
      fx !== 0 ? 0.6 : 0.1,
      0.1,
      fz !== 0 ? 0.6 : 0.1,
      hexToRgb('#3d3a38'),
      true,
    );
    mb.box(x - fx * 0.12, 0.6, z - fz * 0.12, 0.24, 0.12, 0.24, shade(color, 1.3), true);
    if (type === 'turret_heavy')
      mb.box(
        x + fx * 0.28 + fz * 0.14,
        0.5,
        z + fz * 0.28 + fx * 0.14,
        fx !== 0 ? 0.6 : 0.1,
        0.1,
        fz !== 0 ? 0.6 : 0.1,
        hexToRgb('#3d3a38'),
        true,
      );
    if (type === 'turret_laser' || type === 'turret_plasma' || type === 'turret_rail')
      mb.box(
        x + fx * 0.62,
        0.5,
        z + fz * 0.62,
        0.14,
        0.14,
        0.14,
        hexToRgb(type === 'turret_laser' ? '#7fd0ff' : '#d08cff'),
        true,
      );
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
  if (type === 'waterwheel') {
    // Roue à aubes : deux chevalets, un axe, et une roue d'aubes verticale (huit pales) tournée vers l'étang.
    const across = fx !== 0; // l'axe de la roue est perpendiculaire à la direction `rot`
    const axisX = across ? 0 : 1;
    const axisZ = across ? 1 : 0;
    const wood = shade(color, 1.0);
    for (const k of [-1, 1]) {
      mb.box(
        x + axisX * k * (sx / 2 - 0.1),
        0,
        z + axisZ * k * (sz / 2 - 0.1),
        axisX ? 0.1 : 0.5,
        1.0,
        axisZ ? 0.1 : 0.5,
        shade(color, 0.7),
        true,
      );
    }
    mb.box(
      x,
      0.95,
      z,
      axisX ? sx - 0.1 : 0.1,
      0.1,
      axisZ ? sz - 0.1 : 0.1,
      hexToRgb('#3d3a38'),
      true,
    );
    const R = 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * R;
      const py = 1.0 + Math.sin(a) * R;
      mb.box(
        x + (across ? 0 : px) * 1,
        py - 0.08,
        z + (across ? px : 0),
        axisX ? sx - 0.5 : 0.2,
        0.16,
        axisZ ? sz - 0.5 : 0.2,
        wood,
        true,
      );
    }
    return;
  }
  if (type === 'bessemer') {
    // Convertisseur Bessemer : socle, grande cornue en forme d'œuf (cône + dôme), bec orange et étincelles.
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.7), true);
    mb.box(x, 0.3, z, sx - 0.35, 0.8, sz - 0.35, color, true);
    mb.cone(x, 1.1, z, Math.min(sx, sz) * 0.26, 0.4, 10, shade(color, 1.2), Math.min(sx, sz) * 0.1);
    mb.box(
      x + fx * (sx / 2 - 0.12),
      0.9,
      z + fz * (sz / 2 - 0.12),
      fx !== 0 ? 0.3 : 0.2,
      0.12,
      fz !== 0 ? 0.3 : 0.2,
      hexToRgb('#e0702a'),
      true,
    );
    mb.box(x, 1.5, z, 0.14, 0.2, 0.14, hexToRgb('#ffd27a'), true);
    return;
  }
  if (type === 'crank') {
    // Manivelle : socle, montant et manivelle à bras.
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x, 0.2, z, 0.2, 0.6, 0.2, color, true);
    mb.box(x, 0.7, z, 0.6, 0.08, 0.1, hexToRgb('#3d3a38'), true);
    mb.box(x + 0.28, 0.5, z, 0.08, 0.28, 0.08, hexToRgb('#3d3a38'), true);
    return;
  }
  if (type === 'cooling_tower') {
    // Tour de refroidissement : socle, fût évasé (deux blocs) et couronne claire.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.2, 0.6, sz - 0.2, color, true);
    mb.box(x, 0.85, z, sx - 0.45, 0.5, sz - 0.45, shade(color, 1.1), true);
    mb.box(x, 1.35, z, sx - 0.3, 0.1, sz - 0.3, hexToRgb('#cfd8de'), true);
    return;
  }
  if (type === 'accumulator' || type === 'accumulator_basic') {
    // Accumulateur : bloc de cellules avec bandeau lumineux et bornes.
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x, 0.2, z, sx - 0.15, 0.85, sz - 0.15, color, true);
    mb.box(x, 0.8, z, sx - 0.05, 0.08, sz - 0.05, hexToRgb('#5be0a0'), true);
    mb.box(x - 0.2, 1.05, z, 0.12, 0.12, 0.12, hexToRgb('#d9a441'), true);
    mb.box(x + 0.2, 1.05, z, 0.12, 0.12, 0.12, hexToRgb('#d9a441'), true);
    return;
  }
  if (type === 'fusion_reactor') {
    // Tokamak : socle massif, tore (anneau de blocs), cœur lumineux et aimants.
    mb.box(x, 0, z, sx, 0.4, sz, shade(color, 0.6), true);
    mb.box(x, 0.4, z, sx - 0.6, 1.4, sz - 0.6, color, true);
    mb.box(x, 1.8, z, sx - 1.2, 0.8, sz - 1.2, shade(color, 1.2), true);
    mb.box(x, 1.2, z, sx - 2.2, 1.6, sz - 2.2, hexToRgb('#ff9ad5'), true);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      mb.box(
        x + dx * (sx / 2 - 0.4),
        0.4,
        z + dz * (sz / 2 - 0.4),
        0.4,
        2.4,
        0.4,
        hexToRgb('#cfd8e0'),
        true,
      );
    }
    return;
  }
  if (type === 'relay') {
    // Relais : mât court et parabole (boîte inclinée vers l'antenne).
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x, 0.2, z, 0.2, 0.9, 0.2, color, true);
    mb.box(x, 1.1, z, 0.7, 0.35, 0.7, shade(color, 1.3), true);
    return;
  }
  if (type === 'antenna') {
    // Antenne d'alignement : socle, mât haut et réseau de bras.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, 0.25, 2.6, 0.25, color, true);
    mb.box(x, 2.2, z, sx - 0.3, 0.1, 0.1, shade(color, 1.3), true);
    mb.box(x, 2.6, z, 0.1, 0.1, sz - 0.3, shade(color, 1.3), true);
    return;
  }
  if (type === 'evaporation_tower') {
    // Tour d'évaporation : socle, fût large, bassin ouvert violet en haut.
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.7), true);
    mb.box(x, 0.3, z, sx - 0.4, 1.2, sz - 0.4, color, true);
    mb.box(x, 1.5, z, sx - 0.2, 0.2, sz - 0.2, shade(color, 1.2), true);
    mb.box(x, 1.7, z, sx - 0.7, 0.05, sz - 0.7, hexToRgb('#b58be0'), true);
    return;
  }
  if (type === 'vitrifier') {
    // Station de vitrification : caisson blindé avec cheminée de coulée et sortie.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.2, 0.7, sz - 0.2, color, true);
    mb.box(x, 0.95, z, 0.4, 0.25, 0.4, hexToRgb('#b58be0'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'centrifuge') {
    // Centrifugeuse : socle, cuve cylindrique (boîtes empilées) et couvercle.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.3, 0.5, sz - 0.3, color, true);
    mb.box(x, 0.75, z, sx - 0.55, 0.15, sz - 0.55, shade(color, 1.3), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.3,
      0.12,
      fz !== 0 ? 0.1 : 0.3,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'fission_reactor') {
    // Réacteur : massif de béton, dôme de confinement (boîtes décroissantes) et cheminée de refroidissement.
    mb.box(x, 0, z, sx, 0.5, sz, shade(color, 0.75), true);
    mb.box(x, 0.5, z, sx - 0.4, 0.8, sz - 0.4, color, true);
    mb.box(x, 1.3, z, sx - 1.0, 0.6, sz - 1.0, shade(color, 1.15), true);
    mb.box(x, 1.9, z, sx - 1.8, 0.3, sz - 1.8, hexToRgb('#7be07b'), true);
    mb.box(x - sx / 2 + 0.3, 0.5, z - sz / 2 + 0.3, 0.3, 1.8, 0.3, hexToRgb('#b9c2c8'), true);
    return;
  }
  if (type === 'refinery') {
    // Raffinerie : socle, tour de distillation, deuxième colonne plus fine et échelle.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x - 0.2, 0.25, z, 0.5, 1.6, 0.5, color, true);
    mb.box(x + 0.35, 0.25, z + 0.2, 0.3, 1.1, 0.3, shade(color, 1.2), true);
    mb.box(x - 0.2, 1.85, z, 0.3, 0.2, 0.3, hexToRgb('#cfd8de'), true);
    mb.box(x + 0.35, 0.3, z - 0.3, 0.08, 1.4, 0.08, hexToRgb('#d9a441'), true);
    return;
  }
  if (type === 'plastic_press') {
    // Presse à injection : bâti, moule et vérin horizontal.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.3, 0.5, sz - 0.3, color, true);
    mb.box(x, 0.75, z, sx - 0.6, 0.15, sz - 0.6, hexToRgb('#d0d6dc'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.3,
      0.12,
      fz !== 0 ? 0.1 : 0.3,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'pumpjack') {
    // Chevalet de pompage : socle, pylône, balancier incliné (boîtes) et tête de puits.
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x - fx * 0.15, 0.2, z - fz * 0.15, 0.2, 0.9, 0.2, color, true);
    mb.box(
      x + fx * 0.1,
      1.05,
      z + fz * 0.1,
      fx !== 0 ? 1.0 : 0.16,
      0.14,
      fz !== 0 ? 1.0 : 0.16,
      shade(color, 1.3),
      true,
    );
    mb.box(x + fx * 0.55, 0.3, z + fz * 0.55, 0.1, 0.75, 0.1, hexToRgb('#8fa0ad'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.3,
      0.12,
      fz !== 0 ? 0.1 : 0.3,
      hexToRgb('#1c1c22'),
      true,
    );
    return;
  }
  if (type === 'booster') {
    // Surpresseur : corps cylindrique (boîte) entre deux brides, moteur au-dessus.
    mb.box(x, 0, z, sx, 0.2, sz, shade(color, 0.7), true);
    mb.box(x, 0.2, z, sx - 0.2, 0.5, sz - 0.2, color, true);
    mb.box(x, 0.7, z, 0.3, 0.2, 0.3, hexToRgb('#2f3a45'), true);
    return;
  }
  if (type === 'furnace_electric') {
    // Four électrique : caisson, hublot incandescent, câbles épais en haut et bec de sortie.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.15, 0.7, sz - 0.15, color, true);
    mb.box(
      x + fx * (sx / 2 - 0.08),
      0.5,
      z + fz * (sz / 2 - 0.08),
      fx !== 0 ? 0.06 : 0.35,
      0.25,
      fz !== 0 ? 0.06 : 0.35,
      hexToRgb('#ff9a3c'),
      true,
    );
    mb.box(x, 0.95, z, 0.3, 0.25, 0.3, hexToRgb('#2f3a45'), true);
    mb.box(x - fx * 0.3, 0.95, z - fz * 0.3, 0.12, 0.12, 0.12, hexToRgb('#d9a441'), true);
    return;
  }
  if (type === 'builder') {
    // Constructeur : caisson fermé, tête à outils au-dessus et bec de sortie.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.2, 0.55, sz - 0.2, color, true);
    mb.box(x, 0.8, z, sx - 0.6, 0.14, sz - 0.6, shade(color, 1.3), true);
    mb.box(x, 0.94, z, 0.12, 0.1, 0.12, hexToRgb('#e0a030'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'heavy_press') {
    // Presse hydraulique lourde : bâti, deux colonnes, vérin et plateau.
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.7), true);
    mb.box(x - sx / 2 + 0.15, 0.3, z, 0.2, 0.9, sz - 0.2, shade(color, 0.9), true);
    mb.box(x + sx / 2 - 0.15, 0.3, z, 0.2, 0.9, sz - 0.2, shade(color, 0.9), true);
    mb.box(x, 1.0, z, sx - 0.1, 0.2, sz - 0.3, color, true);
    mb.box(x, 0.55, z, 0.3, 0.45, 0.3, hexToRgb('#8fa0ad'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'washer') {
    // Station de lavage : bassin ouvert (bords et eau) avec une rampe d'arrosage.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx, 0.35, sz, color, true);
    mb.box(x, 0.58, z, sx - 0.3, 0.04, sz - 0.3, hexToRgb('#3fa9f5'), true);
    mb.box(x, 0.8, z, sx - 0.1, 0.08, 0.1, hexToRgb('#8fa0ad'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.15,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'barreler') {
    // Remplisseuse de barils : bâti, cuve bleue au centre, buse au-dessus et bec de sortie.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.3, 0.6, sz - 0.3, color, true);
    mb.box(x, 0.85, z, 0.2, 0.12, 0.2, hexToRgb('#4a8fc4'), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'mixer') {
    // Bétonnière : bâti, grand tambour incliné (boîte) et goulotte de sortie.
    mb.box(x, 0, z, sx, 0.22, sz, shade(color, 0.7), true);
    mb.box(x, 0.22, z, sx - 0.3, 0.6, sz - 0.3, color, true);
    mb.box(x, 0.82, z, sx - 0.55, 0.14, sz - 0.55, shade(color, 0.6), true);
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.15,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.35,
      0.12,
      fz !== 0 ? 0.1 : 0.35,
      hexToRgb('#3d3a38'),
      true,
    );
    return;
  }
  if (type === 'crusher') {
    // Concasseur : bâti, trémie évasée en haut, deux mâchoires, bec de sortie et cheminée.
    mb.box(x, 0, z, sx, 0.25, sz, shade(color, 0.7), true);
    mb.box(x, 0.25, z, sx - 0.2, 0.45, sz - 0.2, color, true);
    mb.box(x, 0.7, z, sx - 0.05, 0.12, sz - 0.05, shade(color, 1.25), true); // trémie
    mb.box(x, 0.82, z, sx - 0.45, 0.1, sz - 0.45, shade(color, 0.6), true); // ouverture
    mb.box(
      x + fx * (sx / 2 - 0.05),
      0.2,
      z + fz * (sz / 2 - 0.05),
      fx !== 0 ? 0.1 : 0.3,
      0.15,
      fz !== 0 ? 0.1 : 0.3,
      hexToRgb('#3d3a38'),
      true,
    );
    mb.box(x - fx * 0.35, 0.8, z - fz * 0.35, 0.14, 0.4, 0.14, hexToRgb('#3d3a38'), true);
    return;
  }
  if (type === 'stamper') {
    // Estampeuse : bâti de fonte, deux montants et une presse (piston) au-dessus de l'enclume ; cheminée de la chauffe.
    mb.box(x, 0, z, sx, 0.3, sz, shade(color, 0.75), true);
    mb.box(x, 0.3, z, sx - 0.2, 0.18, sz - 0.2, shade(color, 1.1), true); // enclume
    for (const k of [-1, 1]) {
      mb.box(
        x + (fx !== 0 ? 0 : k * (sx / 2 - 0.12)),
        0.3,
        z + (fz !== 0 ? 0 : k * (sz / 2 - 0.12)),
        0.12,
        0.6,
        0.12,
        shade(color, 0.9),
        true,
      );
    }
    mb.box(x, 0.8, z, sx - 0.12, 0.14, sz - 0.12, shade(color, 1.25), true); // traverse
    mb.box(x, 0.5, z, 0.18, 0.3, 0.18, hexToRgb('#3d3a38'), true); // piston
    mb.box(x - fx * 0.35, 0.9, z - fz * 0.35, 0.14, 0.4, 0.14, hexToRgb('#3d3a38'), true); // cheminée
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
  if (type === 'splitter' || type === 'merger' || type === 'sorter') {
    // Boîtier plat (les entrées et sorties sont indiquées par des flèches au sol).
    mb.box(x, 0, z, sx, 0.25, sz, color, true);
    mb.box(x, 0.25, z, sx - 0.16, 0.08, sz - 0.16, shade(color, 1.3), true);
    if (type === 'sorter') {
      // Trieur : petit écran lumineux et trois voyants, un par sortie.
      mb.box(x - fx * 0.12, 0.33, z - fz * 0.12, 0.24, 0.1, 0.24, hexToRgb('#27323b'), true);
      mb.box(x - fx * 0.12, 0.43, z - fz * 0.12, 0.16, 0.02, 0.16, hexToRgb('#4fe3c1'), true);
    }
    return;
  }
  if (type === 'waypoint') {
    // Balise : socle, mât mince et fanion de la couleur choisie.
    mb.box(x, 0, z, 0.36, 0.08, 0.36, shade(color, 0.5), true);
    mb.box(x, 0.08, z, 0.08, 1.7, 0.08, hexToRgb('#d9dfe6'), true);
    mb.box(x + 0.16, 1.4, z, 0.3, 0.26, 0.04, color, true);
    mb.box(x, 1.78, z, 0.16, 0.16, 0.16, color, true);
    return;
  }
  if (type === 'pole' || type === 'pole_hv' || type === 'pole_uhv') {
    // Poteau : mât, bras, isolateurs ; plus haut et plus large à chaque niveau.
    const top = type === 'pole' ? 3.4 : type === 'pole_hv' ? 5.9 : 9.9;
    const span = type === 'pole' ? 0.7 : type === 'pole_hv' ? 1.6 : 3.0;
    const arms = type === 'pole' ? 2 : 3;
    mb.box(x, 0, z, 0.06 * arms, top, 0.06 * arms, color, true);
    for (let i = 0; i < arms; i++) {
      const y = top - 0.25 - i * (type === 'pole' ? 0.3 : 0.7);
      const w = span * (1 - i * 0.25);
      mb.box(x, y, z, w, 0.07, 0.1, shade(color, 0.8), true);
      mb.box(x - w / 2 + 0.05, y + 0.07, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
      mb.box(x + w / 2 - 0.05, y + 0.07, z, 0.07, 0.12, 0.07, hexToRgb('#d9dfe6'), true);
    }
    return;
  }
  if (type === 'transformer') {
    // Transformateur : socle, cuve, trois isolateurs.
    mb.box(x, 0, z, 1.4, 0.2, 1.4, shade(color, 0.6), true);
    mb.box(x, 0.2, z, 1.1, 1.5, 1.1, color, true);
    for (const dx of [-0.3, 0, 0.3])
      mb.box(x + dx, 1.7, z, 0.12, 0.7, 0.12, hexToRgb('#d9dfe6'), true);
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
