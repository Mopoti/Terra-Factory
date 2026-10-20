/**
 * Voies et trains en jeu : dessin des rails et des véhicules, pose (avec raccord automatique au bout de la voie),
 * conduite de la locomotive, attelage et dételage, simulation du convoi (voir `docs/trains.md`).
 */
import * as THREE from 'three';
import {
  CARS,
  RAIL_COST,
  RAIL_ITEM,
  carIdOfWindow,
  carKindOfItem,
  locoWindowId,
  type CarKind,
} from '../core/data/trains';
import { emptyMachine, type Machine } from '../core/factory/factory';
import type { GameState } from '../core/game/state';
import { leadTile, planRails, tileOf, type PlannedPiece, type Tile } from '../core/rail/plan';
import {
  RAIL_SCALE,
  RAIL_TOP_M,
  TILE_M,
  centerOf,
  cornerFor,
  trackCellsOf,
  freePorts,
  footprintOf,
  isSwitch,
  portsOf,
  leverOf,
  lengthOfPiece,
  isCurve,
  lengthOf,
  poseOn,
  routesOf,
  type Port,
  type RailKind,
  type RailPiece,
  type TrackGraph,
  type TrackPos,
} from '../core/rail/track';
import {
  IDLE,
  CAR_HALF_WIDTH_M,
  carPoses,
  endPos,
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

const RAIL_MODEL: Record<Exclude<RailKind, 'switch_r' | 'switch_l'>, string> = {
  straight: 'rail_droit',
  curve: 'rail_virage',
  curve_wide: 'rail_virage_large',
  curve_large: 'rail_virage_tres_large',
  // Pas encore de modèle (à faire dans Blender) : un ruban provisoire est dessiné à la place.
  curve_big: 'rail_virage_grand',
  curve_huge: 'rail_virage_geant',
  ramp: 'rail_rampe',
};
/** Modèle d'une pièce de voie : un aiguillage a un modèle par côté et par position des lames. */
export function railModelName(p: RailPiece): string {
  if (!isSwitch(p.kind)) return RAIL_MODEL[p.kind];
  return `rail_aiguillage_${p.kind === 'switch_r' ? 'd' : 'g'}_${p.branch === 1 ? 'devie' : 'droit'}`;
}
/** Formes de voie qu'on choisit avec B : la taille des virages du tracé, ou l'aiguillage. */
/** Distance (m) au levier d'un aiguillage pour le manœuvrer à pied (touche F). */
const LEVER_REACH_M = 2.5;
/** Distance (m) jusqu'à laquelle on cherche, depuis la locomotive, l'aiguillage à manœuvrer (touche R). */
const SWITCH_AHEAD_M = 60;
const GREEN: Rgb = hexToRgb('#4cd964');
const RED: Rgb = hexToRgb('#ff5a4a');
const STEP = 1 / 60;
/** Portée (m) pour monter dans une locomotive ou reprendre un véhicule (en plus de sa demi-longueur). */
const REACH_M = 4;
/** Hauteur d'un véhicule (m) tant que son modèle n'est pas chargé. */
const CAR_HEIGHT_M = 3.8;
/** Hauteur des tampons et des attelages au-dessus du rail (m), comme dans `ferroviaire.py` (2,1 unités). */
const CAR_COUPLER_Y_M = 1.05;
/** Distance (m) à laquelle un bout de voie libre attire la pièce qu'on pose. */
const SNAP_M = 7;
/** Écart maximal (m) entre la visée et la voie pour poser un véhicule. */
const CAR_AIM_M = 2.2;
/** Longueur maximale d'un tracé (tuiles). */
const MAX_PATH = 150;

/**
 * Vitres de la cabine (coordonnées du fichier du modèle, m : centre x, y, z, largeur, hauteur) : la façade du modèle a
 * de vraies ouvertures (`blender/scripts/ferroviaire.py`, deux fenêtres de part et d'autre de la chaudière) ; le jeu
 * les ferme par une vitre translucide, pour voir la voie depuis le siège.
 */
const CAB_GLASS: Partial<
  Record<CarKind, { x: number; y: number; z: number; w: number; h: number }[]>
> = {
  locomotive_steam: [
    { x: -0.9, y: 3.1, z: -0.985, w: 0.55, h: 0.6 },
    { x: 0.9, y: 3.1, z: -0.985, w: 0.55, h: 0.6 },
  ],
};
const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x9fd3ec,
  transparent: true,
  opacity: 0.22,
  roughness: 0.08,
  metalness: 0.1,
  side: THREE.DoubleSide,
  depthWrite: false,
});

export interface TrainHost {
  scene: THREE.Scene;
  state: GameState;
  material: THREE.Material;
  container: HTMLElement;
  /** Point du sol visé (m), ou null. */
  aim(): { x: number; z: number } | null;
  /** Case (gx, gz) bloquée par le terrain, une machine ou une construction ? */
  blocked(gx: number, gz: number): boolean;
  held(action: 'forward' | 'backward' | 'jump' | 'interact' | 'sprint' | 'left' | 'right'): boolean;
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
  /** Décalage latéral du siège dans le véhicule (m, côté +x du modèle). */
  seatX: number;
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
  private locoProxies = new Map<number, Machine>();
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

  /** Identifiant de la fenêtre (soute) de la locomotive qu'on conduit, sinon null. */
  mountedWindowId(): number | null {
    return this.mountedCar === null ? null : locoWindowId(this.mountedCar);
  }

  /** La locomotive vue comme une machine : sa soute est la case de combustible, la chaudière sa chaleur. */
  locoMachine(windowId: number): Machine | null {
    const carId = carIdOfWindow(windowId);
    const car = this.host.state.changes.trains
      .flatMap((c) => c.cars)
      .find((k) => k.id === carId && k.kind === 'locomotive_steam');
    if (!car) return null;
    let m = this.locoProxies.get(carId);
    if (!m) {
      m = emptyMachine(windowId, 'chest_wood', 0, 0, 0);
      this.locoProxies.set(carId, m);
    }
    Object.defineProperty(m, 'fuel', {
      configurable: true,
      get: () => car.fuel,
      set: (x) => (car.fuel = x),
    });
    Object.defineProperty(m, 'fuelLeft', {
      configurable: true,
      get: () => car.heatKJ,
      set: (x) => (car.heatKJ = x),
    });
    return m;
  }

  /** Boîtes de collision des véhicules (mises à jour à chaque image). */
  private readonly solids: {
    x: number;
    z: number;
    y0: number;
    y1: number;
    ux: number;
    uz: number;
    hl: number;
    hw: number;
  }[] = [];

  /**
   * Le point (x, z) est-il dans la caisse d'un véhicule, entre les hauteurs y0 et y1 (le joueur) ? Sert à empêcher de
   * traverser les locomotives et les wagons à pied.
   */
  solidAt(x: number, z: number, y0: number, y1: number): boolean {
    for (const b of this.solids) {
      if (y1 <= b.y0 || y0 >= b.y1) continue;
      const dx = x - b.x;
      const dz = z - b.z;
      if (Math.abs(dx * b.ux + dz * b.uz) > b.hl) continue;
      if (Math.abs(dx * b.uz - dz * b.ux) > b.hw) continue;
      return true;
    }
    return false;
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
    for (const piece of this.host.state.changes.rails)
      for (const route of routesOf(piece)) {
        const len = lengthOfPiece(route);
        for (let u = 0; u <= len + 1e-6; u += 0.8) {
          const p = poseOn(route, Math.min(u, len));
          const wx = p.x - o.x;
          const wy = p.y + RAIL_TOP_M - o.y;
          const wz = p.z - o.z;
          const t0 = wx * d.x + wy * d.y + wz * d.z;
          if (t0 < 0 || t0 > maxDist) continue;
          const rx = wx - t0 * d.x;
          const ry = wy - t0 * d.y;
          const rz = wz - t0 * d.z;
          if (rx * rx + ry * ry + rz * rz > 1.1 * 1.1) continue;
          if (!best || t0 < best.t) best = { piece, t: t0 };
        }
      }
    return best;
  }

  /** Véhicule que le rayon touche (sphère de 1,4 m autour de son milieu et de ses extrémités), avec la distance. */
  pickCar(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
  ): { car: Car; t: number; x: number; y: number; z: number; len: number } | null {
    const graph = this.host.state.railGraph();
    let best: { car: Car; t: number; x: number; y: number; z: number; len: number } | null = null;
    for (const consist of this.host.state.changes.trains) {
      for (const pose of carPoses(graph, consist)) {
        const len = CARS[pose.car.kind].lengthM;
        const sx = Math.sin(pose.yaw);
        const cz = Math.cos(pose.yaw);
        for (const k of [-0.35, 0, 0.35]) {
          const px = pose.x + sx * len * k - o.x;
          const py = pose.y + 1.2 - o.y;
          const pz = pose.z + cz * len * k - o.z;
          const t0 = px * d.x + py * d.y + pz * d.z;
          if (t0 < 0 || t0 > maxDist) continue;
          const rx = px - t0 * d.x;
          const ry = py - t0 * d.y;
          const rz = pz - t0 * d.z;
          if (rx * rx + ry * ry + rz * rz > 1.5 * 1.5) continue;
          if (!best || t0 < best.t)
            best = { car: pose.car, t: t0, x: pose.x, y: pose.y, z: pose.z, len };
        }
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
    const sy = piece.kind === 'ramp' ? 1.3 * RAIL_SCALE : 0.3 * RAIL_SCALE;
    return { x: c.x, y: piece.level + sy / 2, z: c.z, sx: w * 0.5, sy, sz: d * 0.5 };
  }

  // --- Dessin ------------------------------------------------------------------------------------

  /** Le modèle d'une pièce, recentré sur le milieu de sa tuile (et non sur sa boîte englobante). */
  private railModel(p: RailPiece): ReturnType<typeof bakedModel> {
    const m = bakedModel(railModelName(p));
    if (!m) return null;
    return { ...m, min: { x: -m.size.x / 2, y: m.min.y, z: -m.size.z / 2 } };
  }

  private addPiece(mb: MeshBuilder, p: RailPiece, tint?: Rgb): void {
    const model = this.railModel(p);
    const c = centerOf(p);
    if (model) {
      mb.model(model, c.x, p.level, c.z, p.turns, RAIL_SCALE, tint, tint ? 0.55 : 0);
      return;
    }
    // Forme de secours tant que le modèle n'est pas chargé : une dalle à la taille de la voie.
    const color = tint ?? hexToRgb('#7d776e');
    if (isCurve(p.kind)) {
      // Un grand virage sans modèle : un ruban de dalles le long de la voie.
      const len = lengthOf(p.kind);
      for (let u = 0; u <= len + 1e-6; u += 0.7) {
        const q = poseOn(p, Math.min(u, len));
        mb.box(q.x, q.y, q.z, 1.8, RAIL_TOP_M, 1.8, color, true);
      }
      return;
    }
    const { w, d } = footprintOf(p.kind, p.turns);
    mb.box(c.x, p.level, c.z, w * 0.5, RAIL_TOP_M, d * 0.5, color, true);
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
      .map(
        ({ piece: p, ok }) =>
          `${p.kind}${p.gx},${p.gz},${p.turns},${p.level},${p.branch ?? 0}${ok ? '+' : '-'}`,
      )
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
      const mesh = vehicleFromModel(model, material, true);
      mesh.group.rotation.order = 'YXZ';
      mesh.group.renderOrder = 6;
      this.host.scene.add(mesh.group);
      this.carGhost = { kind: at.kind, mesh };
    }
    const { mesh } = this.carGhost;
    const graph = this.host.state.railGraph();
    const spec = CARS[at.kind];
    const head = graph.advance(at.pos, spec.frontM).pos;
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
    this.solids.length = 0;
    for (const consist of this.host.state.changes.trains) {
      for (const pose of carPoses(graph, consist)) {
        const spec = CARS[pose.car.kind];
        seen.add(pose.car.id);
        // Boîte de collision : de l'avant à l'arrière du véhicule (attelages compris : on ne passe pas entre deux
        // véhicules attelés), sur toute la largeur, du rail au toit. Le centre du modèle est entre ses essieux.
        const ux = Math.sin(pose.yaw);
        const uz = Math.cos(pose.yaw);
        const mid = spec.frontM - spec.lengthM / 2;
        this.solids.push({
          x: pose.x + ux * mid,
          z: pose.z + uz * mid,
          y0: pose.y + RAIL_TOP_M,
          y1: pose.y + RAIL_TOP_M + (bakedModel(spec.model)?.size.y ?? CAR_HEIGHT_M),
          ux,
          uz,
          hl: spec.lengthM / 2,
          hw: CAR_HALF_WIDTH_M,
        });
        let entry = this.meshes.get(pose.car.id);
        const model = bakedModel(spec.model);
        if (!entry && model) {
          // Centré sur l'origine du modèle (milieu des essieux), comme la pose.
          const mesh = vehicleFromModel(model, this.host.material, true);
          mesh.group.rotation.order = 'YXZ';
          for (const pivot of mesh.parts.values()) pivot.rotation.order = 'YXZ';
          // Vitres translucides dans les ouvertures de la cabine.
          for (const g of CAB_GLASS[pose.car.kind] ?? []) {
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(g.w, g.h), glassMaterial);
            glass.position.set(g.x, g.y - model.min.y, g.z);
            glass.renderOrder = 4;
            mesh.group.add(glass);
          }
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
      this.alignCouplers(consist);
    }
    for (const [id, entry] of this.meshes) {
      if (seen.has(id)) continue;
      this.host.scene.remove(entry.mesh.group);
      this.meshes.delete(id);
    }
  }

  /**
   * Attelages automatiques : entre deux véhicules attelés, les deux bras (pivotant à la traverse de tête) se tournent
   * l'un vers l'autre et leurs têtes se rejoignent, en courbe comme en ligne droite ; aux bouts du convoi ils restent
   * droits. Un véhicule sans bras de ce côté (avant de la locomotive : tampons) offre son point d'attelage.
   */
  private alignCouplers(consist: Consist): void {
    type End = {
      pivot: THREE.Object3D | null;
      group: THREE.Group;
      z: number;
      len: number;
      sign: number;
    };
    const ends: { lead: End; tail: End }[] = [];
    for (const car of consist.cars) {
      const entry = this.meshes.get(car.id);
      if (!entry) return;
      const spec = CARS[car.kind];
      const { group } = entry.mesh;
      group.updateMatrixWorld(true);
      const end = (name: 'attelage_av' | 'attelage_ar'): End => {
        const front = name === 'attelage_av';
        // Point d'attelage dans le repère du modèle (l'avant est vers +z).
        const z = front ? spec.frontM : spec.frontM - spec.lengthM;
        const pivot = entry.mesh.parts.get(name) ?? null;
        if (pivot) {
          pivot.rotation.set(0, 0, 0);
          pivot.scale.set(1, 1, 1);
        }
        return {
          pivot,
          group,
          z,
          len: pivot ? Math.abs(z - pivot.position.z) : 0,
          sign: front ? 1 : -1,
        };
      };
      const av = end('attelage_av');
      const ar = end('attelage_ar');
      ends.push(car.rev ? { lead: ar, tail: av } : { lead: av, tail: ar });
    }
    const base = (e: End): THREE.Vector3 =>
      e.pivot
        ? e.group.localToWorld(e.pivot.position.clone())
        : e.group.localToWorld(new THREE.Vector3(0, CAR_COUPLER_Y_M, e.z));
    for (let i = 1; i < ends.length; i++) {
      const a = ends[i - 1].tail;
      const b = ends[i].lead;
      if (!a.pivot && !b.pivot) continue;
      // Les têtes se rejoignent en un point qui partage l'écart entre les deux bras selon leurs longueurs.
      const pa = base(a);
      const pb = base(b);
      const meet = pa.clone().lerp(pb, a.len / (a.len + b.len));
      for (const e of [a, b]) {
        if (!e.pivot) continue;
        const v = e.group.worldToLocal(meet.clone()).sub(e.pivot.position);
        const h = Math.hypot(v.x, v.z);
        // Le bras est le long de +z (avant) ou −z (arrière) du modèle.
        e.pivot.rotation.y = Math.atan2(e.sign * v.x, e.sign * v.z);
        e.pivot.rotation.x = -e.sign * Math.atan2(v.y, h);
        e.pivot.scale.z = Math.hypot(h, v.y) / Math.max(e.len, 1e-3);
      }
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
      if (Math.hypot(c.x - x, c.z - z) > 20) continue;
      const len = lengthOfPiece(piece);
      for (let u = 0; u <= len + 1e-6; u += 0.5) {
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
    if (frame.rotate && this.mountedCar !== null) this.switchAheadOfLoco(graph);
    // Aux commandes : D / Q (droite / gauche) mettent l'aiguillage devant la locomotive sur la voie qui part de ce côté.
    const right = this.host.held('right');
    const left = this.host.held('left');
    if (this.mountedCar !== null) {
      if (right && !this.wasRight) this.steerAhead(graph, 'right');
      if (left && !this.wasLeft) this.steerAhead(graph, 'left');
    }
    this.wasRight = right;
    this.wasLeft = left;
    if (frame.use) {
      if (this.mountedCar !== null) this.dismount(true);
      else {
        const near = this.carNear(player.x, player.z);
        const lever = this.leverNear(player.x, player.z);
        if (lever !== null) this.toggleSwitch(lever);
        else if (near && this.host.held('sprint')) {
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

  /** Aiguillage dont le levier est à portée du joueur à pied (le plus proche), ou null. */
  private leverNear(x: number, z: number): number | null {
    let best: { id: number; d: number } | null = null;
    for (const p of this.host.state.changes.rails) {
      if (!isSwitch(p.kind)) continue;
      const l = leverOf(p);
      const d = Math.hypot(l.x - x, l.z - z);
      if (d <= LEVER_REACH_M && (!best || d < best.d)) best = { id: p.id, d };
    }
    return best?.id ?? null;
  }

  /** Manœuvre un aiguillage (message et son), sauf si un convoi est dessus. */
  private toggleSwitch(id: number): void {
    const r = this.host.state.toggleSwitch(id);
    if (r === null) {
      this.host.sfx('deny');
      this.host.message(t('train.switchBusy'));
      return;
    }
    this.host.sfx('select');
    this.host.message(t(r === 1 ? 'train.switchDiverge' : 'train.switchStraight'));
  }

  /** Premier choix de voie devant la locomotive (dans le sens où elle regarde). */
  private choiceAheadOfLoco(graph: TrackGraph): ReturnType<TrackGraph['choiceAhead']> {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const loco = c?.cars.find((k) => k.id === this.mountedCar);
    if (!c || !loco) return null;
    // La locomotive regarde vers la tête du convoi, sauf si elle est retournée.
    const from = loco.rev ? endPos(graph, c, 'rear') : c.head;
    return graph.choiceAhead(from, SWITCH_AHEAD_M);
  }

  /** Depuis la locomotive : manœuvre le premier aiguillage (ou embranchement) devant elle. */
  private switchAheadOfLoco(graph: TrackGraph): void {
    const ahead = this.choiceAheadOfLoco(graph);
    if (!ahead) {
      this.host.sfx('deny');
      this.host.message(t('train.noSwitch'));
    } else if (ahead.kind === 'switch') this.toggleSwitch(ahead.id);
    else {
      // Embranchement tangent : on passe à la voie suivante.
      const at = ahead.options.findIndex((o) => o.open);
      const next = ahead.options[(at + 1) % ahead.options.length];
      this.selectRoute(ahead, next.piece);
    }
  }

  private wasRight = false;
  private wasLeft = false;

  private selectRoute(ahead: { options: { piece: number }[] }, chosen: number): void {
    const ok = this.host.state.selectRoute(
      chosen,
      ahead.options.map((o) => o.piece),
    );
    this.host.sfx(ok ? 'select' : 'deny');
    this.host.message(t(ok ? 'train.switchChosen' : 'train.switchBusy'));
  }

  /** Met la voie devant la locomotive du côté demandé (l'autre : tout droit). */
  private steerAhead(graph: TrackGraph, side: 'left' | 'right'): void {
    const ahead = this.choiceAheadOfLoco(graph);
    if (!ahead) return;
    if (ahead.kind === 'junction') {
      // Voie qui tourne le plus de ce côté ; à défaut de voie qui tourne, la plus droite.
      const sign = side === 'right' ? 1 : -1;
      const turning = ahead.options.filter((o) => o.lateral * sign > 0.3);
      const pool = turning.length > 0 ? turning : ahead.options;
      const best =
        turning.length > 0
          ? pool.reduce((a, b) => (b.lateral * sign > a.lateral * sign ? b : a))
          : pool.reduce((a, b) => (Math.abs(b.lateral) < Math.abs(a.lateral) ? b : a));
      this.selectRoute(ahead, best.piece);
      return;
    }
    const piece = this.host.state.changes.rails.find((p) => p.id === ahead.id);
    if (!piece) return;
    // La voie déviée d'un aiguillage « droit » part à droite ; celle d'un aiguillage « gauche », à gauche.
    const diverges = (piece.kind === 'switch_r') === (side === 'right');
    const r = this.host.state.setSwitch(piece.id, diverges ? 1 : 0);
    if (r === null) {
      this.host.sfx('deny');
      this.host.message(t('train.switchBusy'));
      return;
    }
    this.host.sfx('select');
    this.host.message(t(side === 'right' ? 'train.steerRight' : 'train.steerLeft'));
  }

  private dismount(announce: boolean): void {
    this.exit = this.sideSpot();
    this.mountedCar = null;
    this.attach = null;
    if (announce) this.host.sfx('select');
  }

  /**
   * Un point à côté du véhicule où poser le joueur qui descend : du côté du siège (la porte de l'abri), hors de la
   * boîte de collision du véhicule et de son marchepied, à la hauteur du siège le long de la voie.
   */
  private sideSpot(): { x: number; z: number; y: number } | null {
    const a = this.attach;
    if (!a) return null;
    const side = a.seatX < 0 ? -1 : 1;
    // Repère du véhicule : (cos cap, −sin cap) est son côté +x.
    const out = side * (CAR_HALF_WIDTH_M + 0.9) - a.seatX;
    return {
      x: a.x + Math.cos(a.yaw) * out,
      z: a.z - Math.sin(a.yaw) * out,
      y: a.y - RAIL_TOP_M,
    };
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
      seatX: at.x,
    };
  }

  // --- Pose ---------------------------------------------------------------------------------------

  private tilt: -1 | 0 | 1 = 0;
  /** Tracé en cours (tuiles de 1 m), comme celui d'un convoyeur : on glisse, on relâche, tout est posé. */
  private path: Tile[] = [];
  private pathLead = 0;
  private pathLevel = 0;
  private railTurn = 0;
  /** Ligne droite d'où part le tracé en cours : s'il la quitte de côté, un aiguillage est posé. */
  private branch: RailPiece | null = null;

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

  /** Les pièces du tracé avec ce qu'on peut vraiment poser : par-dessus la voie existante, on la remplace (rails rendus). */
  private evaluate(
    planned: PlannedPiece[],
  ): { piece: RailPiece; ok: boolean; plan: PlannedPiece }[] {
    const { state } = this.host;
    const gone = new Set<number>();
    const added = new Set<string>();
    let stock = state.inventory[RAIL_ITEM] ?? 0;
    return planned.map((plan) => {
      const piece: RailPiece = {
        id: -1,
        kind: plan.kind,
        gx: plan.gx,
        gz: plan.gz,
        turns: plan.turns,
        level: plan.level,
        ...(isSwitch(plan.kind) ? { branch: 0 as const } : {}),
      };
      if (state.railAlready(plan.kind, plan.gx, plan.gz, plan.turns, plan.level))
        return { piece, ok: true, plan };
      const over = state.railsOverlapping(piece).filter((p) => !gone.has(p.id));
      const refund = over.reduce((n, p) => n + RAIL_COST[p.kind], 0);
      const cells = trackCellsOf(piece);
      const free = cells.every(([x, z]) => !added.has(`${x},${z}`) && !this.host.blocked(x, z));
      const ok = free && !over.some((p) => state.railOccupied(p.id)) && stock + refund >= plan.cost;
      if (ok) {
        stock += refund - plan.cost;
        for (const p of over) gone.add(p.id);
        for (const [x, z] of cells) added.add(`${x},${z}`);
      }
      return { piece, ok, plan };
    });
  }

  /** Tuile droite posée sur cette tuile de tracé, s'il y en a une. */
  private straightAt(tile: Tile): RailPiece | null {
    for (const p of this.host.state.changes.rails) {
      if (p.kind !== 'straight') continue;
      const c = centerOf(p);
      const t = tileOf(c.x, c.z);
      if (t.tx === tile.tx && t.tz === tile.tz) return p;
    }
    return null;
  }

  /**
   * Aiguillage d'un tracé qui quitte une ligne de côté : le bloc est centré sur la tuile de départ, sa branche sort
   * du côté où l'on glisse. R choisit de quel bout de la ligne part la pointe.
   */
  private branchSwitch(line: RailPiece, side: Tile): PlannedPiece | null {
    const c = centerOf(line);
    const want = { x: c.x + side.tx * 1.5 * TILE_M, z: c.z + side.tz * 1.5 * TILE_M };
    const found: PlannedPiece[] = [];
    for (const turns of [line.turns % 2, (line.turns % 2) + 2])
      for (const kind of ['switch_r', 'switch_l'] as const) {
        const at = { ...cornerFor(kind, turns, c.x, c.z), turns, level: line.level };
        const exit = portsOf({ id: -1, kind, ...at, branch: 0 })[2];
        if (exit && Math.hypot(exit.x - want.x, exit.z - want.z) < 0.3)
          found.push({ kind, ...at, cost: RAIL_COST[kind] });
      }
    return found.length > 0 ? found[this.railTurn % found.length] : null;
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
      // Départ sur une ligne droite (et pas à son bout) : si le tracé la quitte de côté, ce sera un aiguillage.
      const onLine = this.straightAt(here);
      this.branch =
        onLine && !(port && Math.hypot(port.x - aim.x, port.z - aim.z) < 1.4) ? onLine : null;
      if (this.branch) {
        this.path = [here];
        this.pathLead = 0;
        this.pathLevel = this.branch.level;
      }
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
    let planned: PlannedPiece[];
    // Une ligne droite est quittée de côté (départ) ou jointe de côté (arrivée) : un aiguillage s'y pose.
    const perpendicular = (line: RailPiece, d: Tile): boolean =>
      line.turns % 2 === 0 ? d.tx !== 0 : d.tz !== 0;
    let sw: PlannedPiece | null = null;
    let rest: Tile[] = [];
    let restTilt: -1 | 0 | 1 = this.tilt;
    if (this.branch && tiles.length >= 2) {
      const side = { tx: tiles[1].tx - tiles[0].tx, tz: tiles[1].tz - tiles[0].tz };
      if (perpendicular(this.branch, side)) sw = this.branchSwitch(this.branch, side);
      rest = tiles.slice(1);
    } else if (!this.branch && this.pathLead === 0 && this.path.length >= 3) {
      const end = this.path[this.path.length - 1];
      const prev = this.path[this.path.length - 2];
      const line = this.straightAt(end);
      const side = { tx: prev.tx - end.tx, tz: prev.tz - end.tz };
      if (line && perpendicular(line, side)) {
        sw = this.branchSwitch(line, side);
        // Le tracé est lu de la ligne vers son départ : la branche du côté de l'aiguillage, le reste la prolonge.
        rest = this.path.slice(0, -1).reverse();
        restTilt = 0;
      }
    }
    if (sw) {
      const exit = portsOf({ id: -1, ...sw, branch: 0 })[2];
      planned = [sw, ...planRails(rest, { level: exit.y, tilt: restTilt, lead: 1, curve: 'auto' })];
    } else {
      planned = planRails(tiles, { level, tilt: this.tilt, lead, curve: 'auto' });
      if (single) planned = planned.slice(0, 1);
      if (this.branch && tiles.length < 2) planned = [];
    }
    const checked = this.evaluate(planned);
    this.setGhost(checked.map(({ piece, ok }) => ({ piece, ok })));
    if (release && this.path.length > 0 && planned.length === 0) {
      this.path = [];
      this.branch = null;
    } else if (release && this.path.length > 0) {
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
            true,
          ) === 'ok'
        )
          placed++;
      }
      this.path = [];
      this.branch = null;
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

  /** Prochain aiguillage devant la locomotive, pour le tableau de bord : « aiguillage ← gauche (Q / D) ». */
  private switchHud(): string {
    const graph = this.lastGraph;
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const loco = c?.cars.find((k) => k.id === this.mountedCar);
    if (!graph || !c || !loco) return '';
    const from = loco.rev ? endPos(graph, c, 'rear') : c.head;
    const ahead = graph.choiceAhead(from, SWITCH_AHEAD_M);
    if (!ahead) return '';
    if (ahead.kind === 'junction') {
      const open = ahead.options.find((o) => o.open) ?? ahead.options[0];
      const key =
        open.lateral > 0.3
          ? 'train.hud.switchRight'
          : open.lateral < -0.3
            ? 'train.hud.switchLeft'
            : 'train.hud.switchStraight';
      return ` · ${t(key)}`;
    }
    const p = this.host.state.changes.rails.find((q) => q.id === ahead.id);
    if (!p) return '';
    // Aiguillage à droite : la voie déviée part à droite, la directe à gauche ; l'inverse pour un aiguillage à gauche.
    const right = (p.kind === 'switch_r') === (p.branch === 1);
    return ` · ${t(right ? 'train.hud.switchRight' : 'train.hud.switchLeft')}`;
  }

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
      }) +
      brake +
      this.switchHud() +
      (c.cars.length > 1 ? ` · ${t('train.uncoupleHint')}` : ` · ${t('train.coupleHint')}`);
  }
}
