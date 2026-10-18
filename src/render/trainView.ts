/**
 * Voies et trains en jeu : dessin des rails et des véhicules, pose (avec raccord automatique au bout de la voie),
 * conduite de la locomotive, attelage et dételage, simulation du convoi (voir `docs/trains.md`).
 */
import * as THREE from 'three';
import { CARS, RAIL_ITEM, carKindOfItem, type CarKind } from '../core/data/trains';
import type { GameState } from '../core/game/state';
import { leadTile, planRails, tileOf, type PlannedPiece, type Tile } from '../core/rail/plan';
import {
  RAIL_TOP_M,
  centerOf,
  cellsOf,
  freePorts,
  footprintOf,
  lengthOf,
  poseOn,
  type Port,
  type RailKind,
  type RailPiece,
  type TrackGraph,
  type TrackPos,
} from '../core/rail/track';
import {
  IDLE,
  carPoses,
  collide,
  findCoupling,
  stepConsist,
  type Car,
  type Consist,
} from '../core/rail/train';
import { t } from '../i18n';
import { MeshBuilder, hexToRgb, type Rgb } from './meshBuilder';
import { bakedModel } from './models';
import { rollWheels, vehicleFromModel, type VehicleMesh } from './vehicleModel';

const RAIL_MODEL: Record<RailKind, string> = {
  straight: 'rail_droit',
  curve: 'rail_virage',
  ramp: 'rail_rampe',
};
const GREEN: Rgb = hexToRgb('#4cd964');
const RED: Rgb = hexToRgb('#ff5a4a');
const STEP = 1 / 60;
/** Portée (m) pour monter dans une locomotive ou reprendre un véhicule (en plus de sa demi-longueur). */
const REACH_M = 4;
/** Distance (m) à laquelle un bout de voie libre attire la pièce qu'on pose. */
const SNAP_M = 4;
/** Écart maximal (m) entre la visée et la voie pour poser un véhicule. */
const CAR_AIM_M = 1.4;
/** Longueur maximale d'un tracé (tuiles). */
const MAX_PATH = 150;

export interface TrainHost {
  scene: THREE.Scene;
  state: GameState;
  material: THREE.Material;
  container: HTMLElement;
  /** Point du sol visé (m), ou null. */
  aim(): { x: number; z: number } | null;
  /** Case (gx, gz) bloquée par le terrain, une machine ou une construction ? */
  blocked(gx: number, gz: number): boolean;
  held(action: 'forward' | 'backward' | 'jump' | 'interact' | 'sprint'): boolean;
  message(text: string): void;
  sfx(name: 'placeStone' | 'pickup' | 'deny' | 'select'): void;
}

export interface TrainFrame {
  dt: number;
  paused: boolean;
  uiOpen: boolean;
  guest: boolean;
  /** Touches pressées ce tour (une seule fois par appui). */
  use: boolean;
  couple: boolean;
  rotate: boolean;
  /** PageUp / PageDown : monter / descendre (rampe en tête de tracé). */
  levelUp: boolean;
  levelDown: boolean;
  /** Le joueur vise déjà autre chose (ressource, machine…). */
  aimed: boolean;
  /** Cap du joueur (rad) : sert à choisir le sens d'un véhicule qu'on pose. */
  facing: number;
}

/** Où se trouve le joueur quand il conduit : au siège de la locomotive. */
export interface TrainAttach {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Hauteur du coussin du siège au-dessus du plancher du véhicule (m). */
  seatY: number;
}

export class TrainView {
  private readonly rails = new THREE.Mesh();
  private railsKey = '';
  private builtFor: TrackGraph | null = null;
  private readonly ghost = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  private ghostKey = '';
  private readonly meshes = new Map<number, { mesh: VehicleMesh; kind: CarKind }>();
  private mountedCar: number | null = null;
  private attach: TrainAttach | null = null;
  private exit: { x: number; z: number; y: number } | null = null;
  private wasDown = false;
  private readonly hud = document.createElement('div');
  private lastGraph: TrackGraph | null = null;
  private hintShown = '';
  private warnedFuel = false;

  constructor(private readonly host: TrainHost) {
    this.rails.frustumCulled = false;
    this.rails.receiveShadow = true;
    this.ghost.frustumCulled = false;
    this.ghost.renderOrder = 6;
    this.ghost.visible = false;
    host.scene.add(this.rails, this.ghost);
    this.hud.className = 'ammo-box';
    this.hud.hidden = true;
    host.container.appendChild(this.hud);
  }

  /** Siège du joueur quand il conduit, sinon null. */
  mounted(): TrainAttach | null {
    return this.attach;
  }

  isMounted(): boolean {
    return this.mountedCar !== null;
  }

  /** Où poser le joueur qui vient de descendre (une seule fois). */
  takeExit(): { x: number; z: number; y: number } | null {
    const e = this.exit;
    this.exit = null;
    return e;
  }

  dispose(): void {
    this.host.scene.remove(this.rails, this.ghost);
    for (const { mesh } of this.meshes.values()) this.host.scene.remove(mesh.group);
    this.meshes.clear();
    this.rails.geometry.dispose();
    this.ghost.geometry.dispose();
    this.hud.remove();
  }

  /** Pièce de voie que le rayon touche (à moins de 50 cm de la voie), avec la distance. */
  pickRail(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
  ): { piece: RailPiece; t: number } | null {
    let best: { piece: RailPiece; t: number } | null = null;
    for (const piece of this.host.state.changes.rails) {
      const len = lengthOf(piece.kind);
      for (let u = 0; u <= len + 1e-6; u += 0.4) {
        const p = poseOn(piece, Math.min(u, len));
        const wx = p.x - o.x;
        const wy = p.y + RAIL_TOP_M - o.y;
        const wz = p.z - o.z;
        const t0 = wx * d.x + wy * d.y + wz * d.z;
        if (t0 < 0 || t0 > maxDist) continue;
        const rx = wx - t0 * d.x;
        const ry = wy - t0 * d.y;
        const rz = wz - t0 * d.z;
        if (rx * rx + ry * ry + rz * rz > 0.45 * 0.45) continue;
        if (!best || t0 < best.t) best = { piece, t: t0 };
      }
    }
    return best;
  }

  /** Boîte (centre et dimensions, m) qui entoure une pièce de voie : pour la surbrillance. */
  railBox(piece: RailPiece): {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
  } {
    const { w, d } = footprintOf(piece.kind, piece.turns);
    const c = centerOf(piece);
    const sy = piece.kind === 'ramp' ? 1.3 : 0.3;
    return { x: c.x, y: piece.level + sy / 2, z: c.z, sx: w * 0.5, sy, sz: d * 0.5 };
  }

  // --- Dessin ------------------------------------------------------------------------------------

  /** Le modèle d'une pièce, recentré sur le milieu de sa tuile (et non sur sa boîte englobante). */
  private railModel(kind: RailKind): ReturnType<typeof bakedModel> {
    const m = bakedModel(RAIL_MODEL[kind]);
    if (!m) return null;
    return { ...m, min: { x: -m.size.x / 2, y: m.min.y, z: -m.size.z / 2 } };
  }

  private addPiece(mb: MeshBuilder, p: RailPiece, tint?: Rgb): void {
    const model = this.railModel(p.kind);
    const c = centerOf(p);
    if (model) {
      mb.model(model, c.x, p.level, c.z, p.turns, 1, tint, tint ? 0.55 : 0);
      return;
    }
    // Forme de secours tant que le modèle n'est pas chargé : une dalle à la taille de la voie.
    const color = tint ?? hexToRgb('#7d776e');
    const len = p.kind === 'curve' ? 3 : p.kind === 'ramp' ? 4 : 1;
    const alongX = p.turns % 2 === 1;
    mb.box(c.x, p.level, c.z, alongX ? len : 1, 0.12, alongX ? 1 : len, color, true);
  }

  private geometryOf(mb: MeshBuilder): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(mb.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(mb.colors, 3));
    g.computeBoundingSphere();
    return g;
  }

  private rebuildRails(): void {
    const mb = new MeshBuilder();
    for (const p of this.host.state.changes.rails) this.addPiece(mb, p);
    this.rails.geometry.dispose();
    this.rails.geometry = this.geometryOf(mb);
    this.rails.material = this.host.material;
  }

  private setGhost(pieces: { piece: RailPiece; ok: boolean }[]): void {
    const key = pieces
      .map(({ piece: p, ok }) => `${p.kind}${p.gx},${p.gz},${p.turns},${p.level}${ok ? '+' : '-'}`)
      .join(';');
    this.ghost.visible = pieces.length > 0;
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    const mb = new MeshBuilder();
    for (const { piece, ok } of pieces) this.addPiece(mb, piece, ok ? GREEN : RED);
    this.ghost.geometry.dispose();
    this.ghost.geometry = this.geometryOf(mb);
  }

  private carGhost: { kind: CarKind; mesh: VehicleMesh } | null = null;

  /** Patron du véhicule en main, sur la voie visée (vert : on peut le poser, rouge : non). */
  private setCarGhost(at: { kind: CarKind; pos: TrackPos } | null, ok: boolean): void {
    if (!at) {
      if (this.carGhost) this.carGhost.mesh.group.visible = false;
      return;
    }
    const model = bakedModel(CARS[at.kind].model);
    if (!model) return;
    if (!this.carGhost || this.carGhost.kind !== at.kind) {
      if (this.carGhost) this.host.scene.remove(this.carGhost.mesh.group);
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      const mesh = vehicleFromModel(model, material);
      mesh.group.rotation.order = 'YXZ';
      mesh.group.renderOrder = 6;
      this.host.scene.add(mesh.group);
      this.carGhost = { kind: at.kind, mesh };
    }
    const { mesh } = this.carGhost;
    const graph = this.host.state.railGraph();
    const spec = CARS[at.kind];
    const head = graph.advance(at.pos, spec.lengthM / 2).pos;
    const pose = carPoses(graph, {
      id: -1,
      head,
      v: 0,
      cars: [{ id: -1, kind: at.kind, rev: false, heatKJ: 0, fuel: null }],
    })[0];
    mesh.group.visible = true;
    mesh.group.position.set(pose.x, pose.y + RAIL_TOP_M, pose.z);
    mesh.group.rotation.y = pose.yaw;
    mesh.group.rotation.x = -pose.pitch;
    mesh.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'color' in m) m.color.setRGB(ok ? 0.55 : 1, ok ? 1 : 0.45, ok ? 0.6 : 0.4);
    });
  }

  /** Les véhicules : un modèle par véhicule, posé sur la voie. */
  private syncCars(graph: TrackGraph, dt: number): void {
    const seen = new Set<number>();
    for (const consist of this.host.state.changes.trains) {
      for (const pose of carPoses(graph, consist)) {
        const spec = CARS[pose.car.kind];
        seen.add(pose.car.id);
        let entry = this.meshes.get(pose.car.id);
        const model = bakedModel(spec.model);
        if (!entry && model) {
          const mesh = vehicleFromModel(model, this.host.material);
          mesh.group.rotation.order = 'YXZ';
          this.host.scene.add(mesh.group);
          entry = { mesh, kind: pose.car.kind };
          this.meshes.set(pose.car.id, entry);
        }
        if (!entry) continue;
        const { group } = entry.mesh;
        group.position.set(pose.x, pose.y + RAIL_TOP_M, pose.z);
        group.rotation.y = pose.yaw;
        group.rotation.x = -pose.pitch;
        // Les roues tournent de la distance parcourue, dans le sens du véhicule.
        rollWheels(entry.mesh, consist.v * dt * (pose.car.rev ? -1 : 1));
      }
    }
    for (const [id, entry] of this.meshes) {
      if (seen.has(id)) continue;
      this.host.scene.remove(entry.mesh.group);
      this.meshes.delete(id);
    }
  }

  // --- Recherches --------------------------------------------------------------------------------

  private consistOf(carId: number): Consist | null {
    return this.host.state.changes.trains.find((c) => c.cars.some((k) => k.id === carId)) ?? null;
  }

  /** Voie la plus proche d'un point : pièce, abscisse (au quart de mètre près) et distance. */
  private nearestTrack(
    graph: TrackGraph,
    x: number,
    z: number,
  ): { piece: RailPiece; u: number; dist: number } | null {
    let best: { piece: RailPiece; u: number; dist: number } | null = null;
    for (const piece of graph.byId.values()) {
      const c = centerOf(piece);
      if (Math.hypot(c.x - x, c.z - z) > 4.5) continue;
      const len = lengthOf(piece.kind);
      for (let u = 0; u <= len + 1e-6; u += 0.25) {
        const p = poseOn(piece, Math.min(u, len));
        const d = Math.hypot(p.x - x, p.z - z);
        if (!best || d < best.dist) best = { piece, u: Math.min(u, len), dist: d };
      }
    }
    return best;
  }

  private carNear(x: number, z: number): { consist: Consist; car: Car } | null {
    const graph = this.lastGraph;
    if (!graph) return null;
    let best: { consist: Consist; car: Car; d: number } | null = null;
    for (const consist of this.host.state.changes.trains) {
      for (const pose of carPoses(graph, consist)) {
        const reach = REACH_M + CARS[pose.car.kind].lengthM / 2;
        const d = Math.hypot(pose.x - x, pose.z - z);
        if (d <= reach && (!best || d < best.d)) best = { consist, car: pose.car, d };
      }
    }
    return best;
  }

  // --- Boucle ------------------------------------------------------------------------------------

  /** À appeler à chaque image. `player` est la position du joueur à pied (m). */
  update(frame: TrainFrame, player: { x: number; z: number }): void {
    const { state } = this.host;
    const graph = state.railGraph();
    this.lastGraph = graph;
    // Le dessin des rails est refait quand la voie change (nouveau graphe) ou quand un modèle arrive.
    const key = `${bakedModel('rail_droit') ? 1 : 0}${bakedModel('rail_virage') ? 1 : 0}${bakedModel('rail_rampe') ? 1 : 0}`;
    if (graph !== this.builtFor || key !== this.railsKey) {
      this.builtFor = graph;
      this.railsKey = key;
      this.rebuildRails();
    }

    const active = !frame.paused && !frame.guest;
    if (active) this.simulate(graph, frame.dt);
    this.syncCars(graph, frame.dt);

    if (this.mountedCar !== null && !this.consistOf(this.mountedCar)) this.dismount(false);

    if (active && !frame.uiOpen) {
      this.handleMounted(graph, frame, player);
      this.handlePlacing(graph, frame, player);
    } else this.setGhost([]);

    this.updateAttach();
    this.updateHud();
  }

  private simulate(graph: TrackGraph, dt: number): void {
    const trains = this.host.state.changes.trains;
    if (trains.length === 0) return;
    let left = Math.min(dt, 0.1);
    const driven = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const input = (this.host.held('forward') ? 1 : 0) - (this.host.held('backward') ? 1 : 0);
    let ctrlDriven = IDLE;
    if (driven && this.mountedCar !== null) {
      const loco = driven.cars.find((k) => k.id === this.mountedCar);
      // Le levier est dans le sens où regarde la locomotive, pas dans celui du convoi.
      ctrlDriven = {
        throttle: input * (loco?.rev ? -1 : 1),
        brake: this.host.held('jump') ? 1 : 0,
        parked: false,
      };
      if (loco && input !== 0 && loco.heatKJ <= 0 && !loco.fuel) {
        if (this.host.state.refuelLocomotive(loco) === 0 && !this.warnedFuel) {
          this.warnedFuel = true;
          this.host.message(t('train.noFuel'));
        }
      }
      if (loco && (loco.fuel || loco.heatKJ > 0)) this.warnedFuel = false;
    }
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      left -= h;
      for (const c of trains) stepConsist(graph, c, h, c === driven ? ctrlDriven : IDLE);
      collide(graph, trains);
    }
  }

  // --- Conduite -----------------------------------------------------------------------------------

  private handleMounted(
    graph: TrackGraph,
    frame: TrainFrame,
    player: { x: number; z: number },
  ): void {
    const { state } = this.host;
    if (frame.use) {
      if (this.mountedCar !== null) this.dismount(true);
      else {
        const near = this.carNear(player.x, player.z);
        if (near && this.host.held('sprint')) {
          const r = state.pickUpCar(near.consist.id);
          if (r === 'ok') {
            this.host.sfx('pickup');
            this.host.message(t('train.pickedUp'));
          } else if (r === 'coupled') this.host.message(t('train.pickCoupled'));
        } else if (near && CARS[near.car.kind].loco) {
          this.mountedCar = near.car.id;
          this.warnedFuel = false;
          this.host.message(t('train.mount'));
          this.host.sfx('select');
        }
      }
    }
    if (frame.couple && this.mountedCar !== null) {
      const c = this.consistOf(this.mountedCar);
      if (!c) return;
      if (findCoupling(graph, state.changes.trains, c)) {
        const merged = state.coupleTrain(c.id);
        if (merged) {
          this.host.sfx('placeStone');
          this.host.message(t('train.coupled', { n: String(merged.cars.length) }));
        }
      } else if (c.cars.length > 1) {
        const i = c.cars.findIndex((k) => k.id === this.mountedCar);
        // On laisse derrière la locomotive ce qui lui est attelé à l'arrière ; si elle est en queue, ce qui est devant.
        const index = i < c.cars.length - 1 ? i + 1 : i;
        const rear = state.uncoupleTrain(c.id, index);
        if (rear) {
          this.host.sfx('placeStone');
          this.host.message(t('train.uncoupled', { n: String(rear.cars.length) }));
        }
      } else {
        this.host.sfx('deny');
        this.host.message(t('train.noCoupling'));
      }
    }
  }

  private dismount(announce: boolean): void {
    this.exit = this.sideSpot();
    this.mountedCar = null;
    this.attach = null;
    if (announce) this.host.sfx('select');
  }

  /** Un point à côté du véhicule où poser le joueur qui descend. */
  private sideSpot(): { x: number; z: number; y: number } | null {
    const a = this.attach;
    if (!a) return null;
    return { x: a.x + Math.cos(a.yaw) * 2.2, z: a.z - Math.sin(a.yaw) * 2.2, y: a.y - RAIL_TOP_M };
  }

  /** Cap et position du siège : le joueur y est assis. */
  private updateAttach(): void {
    this.attach = null;
    if (this.mountedCar === null) return;
    const entry = this.meshes.get(this.mountedCar);
    if (!entry) return;
    const { group, seat } = entry.mesh;
    const at = seat ?? { x: 0, y: 1.3, z: 0 };
    group.updateMatrixWorld(true);
    const world = group.localToWorld(new THREE.Vector3(at.x, 0, at.z));
    this.attach = {
      x: world.x,
      z: world.z,
      y: group.position.y,
      yaw: group.rotation.y,
      seatY: at.y,
    };
  }

  // --- Pose ---------------------------------------------------------------------------------------

  private tilt: -1 | 0 | 1 = 0;
  /** Tracé en cours (tuiles de 1 m), comme celui d'un convoyeur : on glisse, on relâche, tout est posé. */
  private path: Tile[] = [];
  private pathLead = 0;
  private pathLevel = 0;
  private railTurn = 0;

  private handlePlacing(
    graph: TrackGraph,
    frame: TrainFrame,
    player: { x: number; z: number },
  ): void {
    const { state } = this.host;
    const item = state.selectedItem();
    const rail = item === RAIL_ITEM;
    const carKind = item ? carKindOfItem(item) : null;
    const down = this.host.held('interact');
    const edge = down && !this.wasDown;
    const release = !down && this.wasDown;
    this.wasDown = down;
    if (!carKind) this.setCarGhost(null, false);
    if (this.mountedCar !== null || (!rail && !carKind)) {
      this.setGhost([]);
      this.hintShown = '';
      this.path = [];
      if (!rail) this.tilt = 0;
      return;
    }
    const aim = this.host.aim();
    if (rail) {
      if (frame.levelUp) this.setTilt(Math.min(1, this.tilt + 1) as -1 | 0 | 1);
      if (frame.levelDown) this.setTilt(Math.max(-1, this.tilt - 1) as -1 | 0 | 1);
      if (frame.rotate) this.railTurn++;
      this.trace(graph, aim, edge, release, down, frame, player);
      this.showHint('train.railHint');
    } else if (carKind && !aim) this.setCarGhost(null, false);
    else if (carKind && aim) {
      this.setGhost([]);
      this.placeCar(graph, carKind, aim, edge, frame.facing);
      this.showHint('train.carHint');
    }
  }

  private setTilt(next: -1 | 0 | 1): void {
    if (next === this.tilt) return;
    this.tilt = next;
    this.host.message(
      t(next > 0 ? 'train.tiltUp' : next < 0 ? 'train.tiltDown' : 'train.tiltFlat'),
    );
  }

  private showHint(key: 'train.railHint' | 'train.carHint'): void {
    if (this.hintShown === key) return;
    this.hintShown = key;
    this.host.message(t(key));
  }

  /** Bout de voie libre le plus proche du point visé, s'il est assez près pour prolonger la voie. */
  private nearestFreePort(aim: { x: number; z: number }): Port | null {
    let best: { port: Port; d: number } | null = null;
    for (const p of freePorts(this.host.state.changes.rails)) {
      const d = Math.hypot(p.at.x - aim.x, p.at.z - aim.z);
      if (d <= SNAP_M && (!best || d < best.d)) best = { port: p.at, d };
    }
    return best?.port ?? null;
  }

  /** Les pièces du tracé avec ce qu'on peut vraiment poser (terrain libre, rails en stock). */
  private evaluate(
    planned: PlannedPiece[],
  ): { piece: RailPiece; ok: boolean; plan: PlannedPiece }[] {
    const { state } = this.host;
    const taken = new Set<string>();
    for (const p of state.changes.rails) for (const [x, z] of cellsOf(p)) taken.add(`${x},${z}`);
    let stock = state.inventory[RAIL_ITEM] ?? 0;
    return planned.map((plan) => {
      const piece: RailPiece = {
        id: -1,
        kind: plan.kind,
        gx: plan.gx,
        gz: plan.gz,
        turns: plan.turns,
        level: plan.level,
      };
      const cells = cellsOf(piece);
      const free = cells.every(([x, z]) => !taken.has(`${x},${z}`) && !this.host.blocked(x, z));
      const ok = free && stock >= plan.cost;
      if (ok) {
        stock -= plan.cost;
        for (const [x, z] of cells) taken.add(`${x},${z}`);
      }
      return { piece, ok, plan };
    });
  }

  private trace(
    graph: TrackGraph,
    aim: { x: number; z: number } | null,
    edge: boolean,
    release: boolean,
    down: boolean,
    frame: TrainFrame,
    player: { x: number; z: number },
  ): void {
    void graph;
    const { state } = this.host;
    const blocked = (c: { gx: number; gz: number }): boolean => this.host.blocked(c.gx, c.gz);
    if (!aim) {
      this.setGhost([]);
      return;
    }
    const here = tileOf(aim.x, aim.z);
    const port = this.nearestFreePort(aim);
    // Début du tracé : au bout de la voie la plus proche (la voie se prolonge), sinon sur la tuile visée.
    const startFor = (): { tiles: Tile[]; lead: number; level: number } => {
      if (port) {
        const lead = leadTile(port);
        const dx = Math.round(port.dx);
        const dz = Math.round(port.dz);
        return { tiles: [lead, { tx: lead.tx + dx, tz: lead.tz + dz }], lead: 1, level: port.y };
      }
      return { tiles: [here], lead: 0, level: 0 };
    };
    // Rails et véhicules : poser prime sur le reste (les rails déjà posés sont eux-mêmes une cible visée).
    if (edge) {
      const s = startFor();
      this.path = s.tiles;
      this.pathLead = s.lead;
      this.pathLevel = s.level;
    }
    if (this.path.length > 0 && down) {
      const back = this.path.findIndex(
        (p, i) => i >= this.pathLead && p.tx === here.tx && p.tz === here.tz,
      );
      if (back >= 0 && back >= this.pathLead)
        this.path.length = Math.max(back + 1, this.pathLead + 1);
      else {
        const cur = { ...this.path[this.path.length - 1] };
        for (
          let guard = 0;
          guard < MAX_PATH && (cur.tx !== here.tx || cur.tz !== here.tz);
          guard++
        ) {
          const dx = here.tx - cur.tx;
          const dz = here.tz - cur.tz;
          const prev = this.path[this.path.length - 2];
          const horizontal = Math.abs(dx) >= Math.abs(dz);
          let step = horizontal ? { tx: Math.sign(dx), tz: 0 } : { tx: 0, tz: Math.sign(dz) };
          // Jamais de demi-tour sur soi-même : on prend l'autre axe, ou on s'arrête.
          if (prev && cur.tx + step.tx === prev.tx && cur.tz + step.tz === prev.tz) {
            const other = horizontal ? { tx: 0, tz: Math.sign(dz) } : { tx: Math.sign(dx), tz: 0 };
            if (other.tx === 0 && other.tz === 0) break;
            step = other;
          }
          cur.tx += step.tx;
          cur.tz += step.tz;
          this.path.push({ ...cur });
        }
        if (this.path.length > MAX_PATH) this.path.length = MAX_PATH;
      }
    }
    // Aperçu : le tracé en cours, ou une seule tuile (ou rampe) sous le curseur.
    let tiles = this.path;
    let lead = this.pathLead;
    let level = this.pathLevel;
    let single = false;
    if (tiles.length === 0) {
      const s = startFor();
      tiles = s.tiles;
      lead = s.lead;
      level = s.level;
      if (!port) {
        const dirs = [
          { tx: 0, tz: -1 },
          { tx: 1, tz: 0 },
          { tx: 0, tz: 1 },
          { tx: -1, tz: 0 },
        ];
        const base = Math.round((((-frame.facing / (Math.PI / 2)) % 4) + 4) % 4);
        const d = dirs[(base + this.railTurn) % 4];
        const len = this.tilt !== 0 ? 4 : 2;
        tiles = Array.from({ length: len }, (_, i) => ({
          tx: here.tx + d.tx * i,
          tz: here.tz + d.tz * i,
        }));
        single = this.tilt === 0;
      } else if (this.tilt !== 0) {
        const lastDir = { tx: tiles[1].tx - tiles[0].tx, tz: tiles[1].tz - tiles[0].tz };
        tiles = [
          tiles[0],
          ...Array.from({ length: 4 }, (_, i) => ({
            tx: tiles[0].tx + lastDir.tx * (i + 1),
            tz: tiles[0].tz + lastDir.tz * (i + 1),
          })),
        ];
      } else single = true;
    }
    let planned = planRails(tiles, { level, tilt: this.tilt, lead });
    if (single) planned = planned.slice(0, 1);
    const checked = this.evaluate(planned);
    this.setGhost(checked.map(({ piece, ok }) => ({ piece, ok })));
    if (release && this.path.length > 0) {
      let placed = 0;
      for (const c of checked) {
        if (!c.ok) continue;
        if (
          state.placeRail(
            c.plan.kind,
            c.plan.gx,
            c.plan.gz,
            c.plan.turns,
            c.plan.level,
            blocked,
          ) === 'ok'
        )
          placed++;
      }
      this.path = [];
      this.ghostKey = '';
      if (placed > 0) {
        this.host.sfx('placeStone');
        this.host.message(t('train.railPlaced'));
      } else {
        this.host.sfx('deny');
        this.host.message(t('train.railBlocked'));
      }
    }
    void player;
  }

  private placeCar(
    graph: TrackGraph,
    kind: CarKind,
    aim: { x: number; z: number },
    edge: boolean,
    facing: number,
  ): void {
    const near = this.nearestTrack(graph, aim.x, aim.z);
    if (!near || near.dist > CAR_AIM_M) {
      this.setCarGhost(null, false);
      if (edge) {
        this.host.sfx('deny');
        this.host.message(t('train.cannotPlace'));
      }
      return;
    }
    // Le véhicule regarde du côté où regarde le joueur.
    const fwd = poseOn(near.piece, near.u, 1);
    const along = Math.sin(fwd.yaw) * Math.sin(facing) + Math.cos(fwd.yaw) * Math.cos(facing);
    const pos: TrackPos = { piece: near.piece.id, u: near.u, dir: along >= 0 ? 1 : -1 };
    const free = this.host.state.canPlaceCar(kind, pos);
    this.setCarGhost({ kind, pos }, free);
    if (!edge) return;
    if (this.host.state.placeCar(kind, pos)) {
      this.host.sfx('placeStone');
      this.host.message(t('train.placed'));
    } else {
      this.host.sfx('deny');
      this.host.message(t('train.cannotPlace'));
    }
  }

  // --- Affichage ------------------------------------------------------------------------------------

  private updateHud(): void {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    if (!c || this.mountedCar === null) {
      this.hud.hidden = true;
      return;
    }
    const loco = c.cars.find((k) => k.id === this.mountedCar);
    // Sens du convoi par rapport à la locomotive : avant si elle avance dans le sens où elle regarde.
    const v = c.v * (loco?.rev ? -1 : 1);
    const heat = Math.round(Math.min(100, ((loco?.heatKJ ?? 0) / 9000) * 100));
    const brake = this.host.held('jump') ? t('train.hud.brake') : '';
    this.hud.hidden = false;
    this.hud.textContent =
      t('train.hud', {
        speed: (Math.abs(v) * 3.6).toFixed(0),
        dir:
          Math.abs(v) < 0.05
            ? t('train.hud.stop')
            : v > 0
              ? t('train.hud.fwd')
              : t('train.hud.rev'),
        fuel: String(loco?.fuel?.count ?? 0),
        heat: String(heat),
      }) + brake;
  }
}
