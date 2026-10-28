/**
 * Voies et trains en jeu : dessin des rails et des véhicules, pose (avec raccord automatique au bout de la voie),
 * conduite de la locomotive, attelage et dételage, simulation du convoi (voir `docs/trains.md`).
 */
import * as THREE from 'three';
import { STATION_ITEM } from '../core/data/trains';
import {
  CARS,
  RAIL_ITEM,
  carIdOfCargo,
  carIdOfWindow,
  cargoWindowId,
  carKindOfItem,
  locoWindowId,
  type CarKind,
} from '../core/data/trains';
import { emptyMachine, type Machine } from '../core/factory/factory';
import type { GameState } from '../core/game/state';
import {
  candidatesFrom,
  freeCandidate,
  pickCandidate,
  pieceOf,
  type RailCandidate,
} from '../core/rail/place';
import {
  RAIL_SCALE,
  RAIL_TOP_M,
  boundsOf,
  centerOf,
  freePorts,
  lengthOfPiece,
  headingOf,
  poseOn,
  portsOf,
  flip,
  TILE_M,
  type Port,
  type RailPiece,
  type TrackGraph,
  type TrackPos,
} from '../core/rail/track';
import {
  IDLE,
  anchorOffset,
  preferOf,
  consistMass,
  CAR_HALF_WIDTH_M,
  carPoses,
  endPos,
  collide,
  findCoupling,
  stepConsist,
  type Car,
  type Consist,
} from '../core/rail/train';
import { t, type TranslationKey } from '../i18n';
import { MeshBuilder, hexToRgb, type Rgb } from './meshBuilder';
import { StationView } from './stationView';
import { AUTO_SPEED, autoControl as autoThrottle, findRoute, type Route } from '../core/rail/route';
import { bakedModel } from './models';
import { rollWheels, vehicleFromModel, type VehicleMesh } from './vehicleModel';

/** Modèles des pièces qui en ont un (le droit le long d'un axe et la rampe) ; les autres sont dessinées par le code. */
const RAIL_MODEL: Partial<Record<RailPiece['kind'], string>> = {
  straight: 'rail_droit',
  ramp: 'rail_rampe',
};
/** Modèle d'une pièce de voie, ou undefined si elle est dessinée par le code (droit en diagonale, virage). */
export function railModelName(p: RailPiece): string | undefined {
  return p.kind === 'straight' && p.h % 2 !== 0 ? undefined : RAIL_MODEL[p.kind];
}
/** Distance (m) jusqu'à laquelle on regarde, devant la locomotive, l'embranchement à prendre (touches gauche / droite). */
const SWITCH_AHEAD_M = 60;
/** Nombre maximal de patrons d'une chaîne (clic maintenu). */
const MAX_CHAIN = 120;
const GREEN: Rgb = hexToRgb('#4cd964');
const RED: Rgb = hexToRgb('#ff5a4a');
const STEP = 1 / 60;
/** Portée (m) pour monter dans une locomotive ou reprendre un véhicule (en plus de sa demi-longueur). */
const REACH_M = 4;
/** Hauteur d'un véhicule (m) tant que son modèle n'est pas chargé. */
const CAR_HEIGHT_M = 3.8;
/** Hauteur des tampons et des attelages au-dessus du rail (m), comme dans `ferroviaire.py` (2,1 unités). */
const CAR_COUPLER_Y_M = 1.05;
/** Distance (m) à laquelle un bout de voie libre attire le départ : le curseur sur sa tuile ou la suivante. */
const SNAP_M = 1.9;
/** Portée d'un bout de voie : le curseur peut être bien plus loin s'il est devant lui (le tracé le rejoint). */
const PORT_REACH_M = 30;
/** Écart maximal (m) entre la visée et la voie pour poser un véhicule. */
const CAR_AIM_M = 2.2;

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
  /** Le joueur veut renommer cette station (fenêtre de saisie). */
  renameStation(id: number): void;
  /** Le joueur est percuté : dégâts avant armure. */
  hurtPlayer(amount: number): void;
  /** Ouvre la fenêtre du contenu d'un wagon (identifiant de fenêtre négatif). */
  openWindow(id: number): void;
  /** Fenêtre de choix d'une station ; renvoie son identifiant, ou null si le joueur annule. */
  chooseStation(stations: { id: number; name: string }[]): Promise<number | null>;
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
  /** H : choisir la destination du train (pilote automatique). */
  route: boolean;
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

  private readonly stations: StationView;
  /** Pilote automatique : itinéraire en cours de chaque convoi (distance restante, graphe d'origine, âge). */
  private readonly autos = new Map<
    number,
    { route: Route; remaining: number; graph: TrackGraph; age: number; total: number }
  >();
  private choosing = false;
  /** Le prochain véhicule posé regarde à contresens de la voie (touche R). */
  private carFlip = false;
  /** Effort demandé à la locomotive conduite (0 à 1), pour le bruit de moteur. */
  private engineEffort = 0;

  constructor(private readonly host: TrainHost) {
    this.stations = new StationView(host.scene);
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
  /** Le contenu d'un wagon vu comme un coffre (fret) ou comme une machine sans cases (citerne). */
  cargoMachine(windowId: number): Machine | null {
    const car = this.host.state.carById(carIdOfCargo(windowId));
    if (!car) return null;
    const spec = CARS[car.kind];
    if (!spec.cargo && !spec.tankL) return null;
    let m = this.locoProxies.get(car.id);
    if (!m) {
      m = emptyMachine(windowId, spec.cargo ? 'chest_iron' : 'chest_wood', 0, 0, 0);
      this.locoProxies.set(car.id, m);
    }
    // Le coffre du wagon est directement sa liste de piles : ranger ou reprendre la modifie.
    if (spec.cargo) {
      car.cargo ??= [];
      m.slots = car.cargo;
    } else m.slots = [];
    return m;
  }

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
    /** Vitesse (m/s) du convoi, pour les dégâts d'une collision. */
    v: number;
  }[] = [];
  private hitCooldown = 0;

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
    return this.stations.solidAt(x, z, y0, y1);
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
    this.stations.dispose();
  }

  /** Pièce de voie que le rayon touche (à moins de 50 cm de la voie), avec la distance. */
  pickRail(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
  ): { piece: RailPiece; t: number } | null {
    let best: { piece: RailPiece; t: number } | null = null;
    for (const piece of this.host.state.changes.rails) {
      const route = piece;
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

  /** Station que le rayon touche (quai ou panneau), avec la distance. */
  pickStation(
    o: THREE.Vector3,
    d: THREE.Vector3,
    maxDist: number,
  ): { id: number; t: number; x: number; z: number } | null {
    const hit = this.stations.pick(o, d, maxDist);
    if (!hit) return null;
    const at = this.stations.platformAt(hit.id);
    return { id: hit.id, t: hit.t, x: at?.x ?? hit.x, z: at?.z ?? hit.z };
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
    const b = boundsOf(piece);
    const sy = piece.kind === 'ramp' ? 1.3 * RAIL_SCALE : 0.3 * RAIL_SCALE;
    return {
      x: (b.x0 + b.x1) / 2,
      y: piece.level + sy / 2,
      z: (b.z0 + b.z1) / 2,
      sx: b.x1 - b.x0,
      sy,
      sz: b.z1 - b.z0,
    };
  }

  // --- Dessin ------------------------------------------------------------------------------------

  /** Le modèle d'une pièce, recentré sur le milieu de sa voie (et non sur sa boîte englobante). */
  private railModel(p: RailPiece): ReturnType<typeof bakedModel> {
    const name = railModelName(p);
    const m = name ? bakedModel(name) : null;
    if (!m) return null;
    return { ...m, min: { x: -m.size.x / 2, y: m.min.y, z: -m.size.z / 2 } };
  }

  private addPiece(mb: MeshBuilder, p: RailPiece, tint?: Rgb): void {
    const model = this.railModel(p);
    if (model) {
      const c = centerOf(p);
      // Quarts de tour du modèle : un droit le long de z (cap 0 ou 4) n'est pas tourné ; une rampe monte vers −z au cap 4.
      const turns = p.kind === 'ramp' ? (p.h / 2 + 2) % 4 : p.h / 2;
      mb.model(model, c.x, p.level, c.z, turns, RAIL_SCALE, tint, tint ? 0.55 : 0);
      return;
    }
    this.addProcedural(mb, p, tint);
  }

  /**
   * Une pièce sans modèle 3D (virage, droit en diagonale) : ballast, traverses et rails dessinés le long de la voie.
   * Boîtes orientées le long de la voie, assez courtes pour suivre la courbe sans escalier.
   */
  private addProcedural(mb: MeshBuilder, p: RailPiece, tint?: Rgb): void {
    const pick = (hex: string): Rgb => tint ?? hexToRgb(hex);
    const ballast = pick('#7a7167');
    const sleeper = pick('#4a3325');
    const steel = pick('#8d939c');
    const len = lengthOfPiece(p);
    const STEP = 0.5;
    // Une boîte orientée : centre (x, z), cap (fx, fz), demi-longueur, demi-largeur, de y0 à y0 + h.
    const obox = (
      x: number,
      z: number,
      fx: number,
      fz: number,
      hl: number,
      hw: number,
      y0: number,
      h: number,
      color: Rgb,
    ): void => {
      const rx = fz;
      const rz = -fx;
      const corner = (sl: number, sw: number, y: number): [number, number, number] => [
        x + fx * hl * sl + rx * hw * sw,
        y,
        z + fz * hl * sl + rz * hw * sw,
      ];
      const lo = [corner(-1, -1, y0), corner(1, -1, y0), corner(1, 1, y0), corner(-1, 1, y0)];
      const hi = [
        corner(-1, -1, y0 + h),
        corner(1, -1, y0 + h),
        corner(1, 1, y0 + h),
        corner(-1, 1, y0 + h),
      ];
      const mid: [number, number, number] = [x, y0 + h / 2, z];
      const face = (
        a: [number, number, number],
        b: [number, number, number],
        c: [number, number, number],
        d: [number, number, number],
        shade: number,
      ): void => {
        // Le sommet qui regarde vers l'extérieur : on inverse l'ordre si la normale pointe vers le centre.
        const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
        const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        const out = nx * (a[0] - mid[0]) + ny * (a[1] - mid[1]) + nz * (a[2] - mid[2]);
        const col = { r: color.r * shade, g: color.g * shade, b: color.b * shade };
        if (out >= 0) mb.quad(a, b, c, d, col);
        else mb.quad(d, c, b, a, col);
      };
      face(hi[0], hi[1], hi[2], hi[3], 1);
      face(lo[3], lo[2], lo[1], lo[0], 0.6);
      face(lo[0], lo[1], hi[1], hi[0], 0.85);
      face(lo[1], lo[2], hi[2], hi[1], 0.75);
      face(lo[2], lo[3], hi[3], hi[2], 0.85);
      face(lo[3], lo[0], hi[0], hi[3], 0.75);
    };
    const GAUGE = 0.75; // demi-écartement (m)
    for (let u = 0; u < len - 1e-6; u += STEP) {
      const mid = Math.min(u + STEP / 2, len);
      const q = poseOn(p, mid);
      const fx = Math.sin(q.yaw);
      const fz = Math.cos(q.yaw);
      const rx = fz;
      const rz = -fx;
      const base = q.y;
      obox(q.x, q.z, fx, fz, STEP * 0.56, 1.35, base, 0.1, ballast);
      if (Math.round(u / STEP) % 2 === 0)
        obox(q.x, q.z, fx, fz, 0.13, 1.15, base + 0.1, 0.1, sleeper);
      for (const side of [-1, 1])
        obox(
          q.x + rx * GAUGE * side,
          q.z + rz * GAUGE * side,
          fx,
          fz,
          STEP * 0.56,
          0.06,
          base + 0.2,
          RAIL_TOP_M - 0.2,
          steel,
        );
    }
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
    const rails = this.host.state.changes.rails;
    // Croisement en « + » : deux droits le long des axes qui se coupent en leur milieu, dessinés une seule fois avec le
    // modèle du croisement.
    const mid = new Map<string, RailPiece[]>();
    for (const p of rails)
      if (p.kind === 'straight' && p.h % 2 === 0) {
        const c = centerOf(p);
        const key = `${Math.round(c.x * 2)},${Math.round(c.z * 2)},${p.level}`;
        const list = mid.get(key) ?? [];
        list.push(p);
        mid.set(key, list);
      }
    const crossModel = bakedModel('rail_croisement');
    const crossed = new Set<number>();
    if (crossModel)
      for (const list of mid.values()) {
        const a = list.find((p) => p.h % 4 === 0);
        const b = list.find((p) => p.h % 4 === 2);
        if (!a || !b) continue;
        crossed.add(a.id).add(b.id);
        const c = centerOf(a);
        const m = {
          ...crossModel,
          min: { x: -crossModel.size.x / 2, y: crossModel.min.y, z: -crossModel.size.z / 2 },
        };
        mb.model(m, c.x, a.level, c.z, 0, RAIL_SCALE);
      }
    for (const p of rails) if (!crossed.has(p.id)) this.addPiece(mb, p);
    this.rails.geometry.dispose();
    this.rails.geometry = this.geometryOf(mb);
    this.rails.material = this.host.material;
  }

  private setGhost(pieces: { piece: RailPiece; ok: boolean }[]): void {
    const key = pieces
      .map(({ piece: p, ok }) => `${p.kind}${p.x},${p.z},${p.h},${p.level}${ok ? '+' : '-'}`)
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
          v: Math.abs(consist.v),
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

  /**
   * Un train en marche qui percute le joueur lui fait des dégâts selon sa vitesse (à 12 m/s : 60 points). On est touché
   * par l'avant ou le flanc d'un véhicule qui va assez vite ; un convoi qui rampe ne fait que pousser.
   */
  private collideWithPlayer(player: { x: number; z: number; y?: number }, dt: number): void {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (this.hitCooldown > 0) return;
    for (const b of this.solids) {
      if (b.v < 1.5) continue;
      if (player.y !== undefined && (player.y > b.y1 || player.y + 1.7 < b.y0)) continue;
      const dx = player.x - b.x;
      const dz = player.z - b.z;
      if (Math.abs(dx * b.ux + dz * b.uz) > b.hl + 0.5) continue;
      if (Math.abs(dx * b.uz - dz * b.ux) > b.hw + 0.25) continue;
      this.hitCooldown = 0.7;
      this.host.hurtPlayer(Math.min(100, b.v * 5));
      this.host.sfx('deny');
      return;
    }
  }

  /** Vitesse (0 à 1) et effort (0 à 1) du train qu'on conduit, pour le bruit de moteur ; null à pied. */
  engineState(): { speed: number; effort: number } | null {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const loco = c?.cars.find((k) => k.id === this.mountedCar);
    const spec = loco ? CARS[loco.kind].loco : undefined;
    if (!c || !spec) return null;
    return { speed: Math.min(1, Math.abs(c.v) / spec.vMax), effort: this.engineEffort };
  }

  /** Distance (m) du joueur au véhicule ferroviaire le plus proche à portée de F, sinon l'infini. */
  useDistance(x: number, z: number): number {
    const graph = this.lastGraph;
    if (!graph) return Infinity;
    let best = Infinity;
    for (const consist of this.host.state.changes.trains)
      for (const pose of carPoses(graph, consist))
        best = Math.min(best, Math.hypot(pose.x - x, pose.z - z) - CARS[pose.car.kind].lengthM / 2);
    return best <= REACH_M ? Math.max(0, best) : Infinity;
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
  update(frame: TrainFrame, player: { x: number; z: number; y?: number }): void {
    const { state } = this.host;
    const graph = state.railGraph();
    this.lastGraph = graph;
    // Le dessin des rails est refait quand la voie change (nouveau graphe) ou quand un modèle arrive.
    // Le dessin est refait quand un modèle de voie arrive (chargés après la partie).
    const key = ['rail_droit', 'rail_virage', 'rail_rampe', 'rail_croisement', 'rail_virage_45']
      .map((n) => (bakedModel(n) ? 1 : 0))
      .join('');
    if (graph !== this.builtFor || key !== this.railsKey) {
      this.builtFor = graph;
      this.railsKey = key;
      this.rebuildRails();
    }

    const active = !frame.paused && !frame.guest;
    if (active) {
      // Les programmes avancent ; on n'annonce que ceux du train qu'on conduit.
      for (const { consist, event } of this.host.state.tickPrograms(frame.dt)) {
        if (event.goTo !== undefined) this.autos.delete(consist);
        if (this.mountedCar === null || this.consistOf(this.mountedCar)?.id !== consist) continue;
        if (event.paused === 'noStation') this.host.message(t('train.programNoStation'));
        else if (event.paused === 'cancelled') this.host.message(t('train.programCancelled'));
      }
      this.simulate(graph, frame.dt);
    }
    this.syncCars(graph, frame.dt);

    if (this.mountedCar !== null && !this.consistOf(this.mountedCar)) this.dismount(false);

    this.stations.sync(this.host.state.changes.stations, graph);
    this.traceInfo = '';
    if (active && !frame.uiOpen) {
      this.handleMounted(graph, frame, player);
      this.handlePlacing(graph, frame);
    } else this.setGhost([]);

    if (active && this.mountedCar === null) this.collideWithPlayer(player, frame.dt);
    this.updateAttach();
    this.updateHud();
  }

  private simulate(graph: TrackGraph, dt: number): void {
    const trains = this.host.state.changes.trains;
    if (trains.length === 0) return;
    let left = Math.min(dt, 0.1);
    const driven = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const input = (this.host.held('forward') ? 1 : 0) - (this.host.held('backward') ? 1 : 0);
    // Toucher aux commandes (avancer, reculer, frein) reprend la conduite à la main.
    if (
      driven &&
      (driven.goTo !== undefined || driven.program?.running) &&
      (input !== 0 || this.host.held('jump'))
    ) {
      this.host.state.sendTrain(driven.id, null);
      this.host.state.setProgramRunning(driven.id, false);
      this.autos.delete(driven.id);
      this.host.message(t('train.autoOff'));
    }
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
      for (const c of trains) {
        const auto = c.goTo !== undefined ? this.autoControl(graph, c, h) : null;
        // Voie prise aux embranchements : l'itinéraire du pilote, les touches gauche / droite du conducteur, sinon tout droit.
        c.pick = auto ? this.routePicks(c) : c === driven ? this.steerPicks(graph, c) : undefined;
        if (c === driven) this.engineEffort = Math.abs((auto ?? ctrlDriven).throttle);
        stepConsist(graph, c, h, auto ?? (c === driven ? ctrlDriven : IDLE));
        const e = auto ? this.autos.get(c.id) : undefined;
        if (e) e.remaining -= Math.max(0, c.v) * h;
      }
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
    if (frame.route && this.mountedCar !== null) this.chooseDestination();
    if (frame.use) {
      if (this.mountedCar !== null) this.dismount(true);
      else {
        const near = this.carNear(player.x, player.z);
        const station = this.stationAimed(player);
        if (station !== null) this.host.renameStation(station);
        else if (near && this.host.held('sprint')) {
          const r = state.pickUpCar(near.consist.id);
          if (r === 'ok') {
            this.host.sfx('pickup');
            this.host.message(t('train.pickedUp'));
          } else if (r === 'coupled') this.host.message(t('train.pickCoupled'));
        } else if (near && !CARS[near.car.kind].loco) {
          this.host.openWindow(cargoWindowId(near.car.id));
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

  /** Premier choix de voie devant la locomotive (dans le sens où elle regarde). */
  private choiceAheadOfLoco(graph: TrackGraph): ReturnType<TrackGraph['choiceAhead']> {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const loco = c?.cars.find((k) => k.id === this.mountedCar);
    if (!c || !loco) return null;
    // La locomotive regarde vers la tête du convoi, sauf si elle est retournée.
    const from = loco.rev ? endPos(graph, c, 'rear') : c.head;
    return graph.choiceAhead(from, SWITCH_AHEAD_M);
  }

  /** Station dont le quai est sous le curseur, et assez près du joueur pour la renommer. */
  private stationAimed(player: { x: number; z: number }): number | null {
    const aim = this.host.aim();
    if (!aim) return null;
    let best: { id: number; d: number } | null = null;
    for (const st of this.host.state.changes.stations) {
      const at = this.stations.platformAt(st.id);
      if (!at) continue;
      const d = Math.hypot(at.x - aim.x, at.z - aim.z);
      if (d <= 3 && Math.hypot(at.x - player.x, at.z - player.z) <= 12 && (!best || d < best.d))
        best = { id: st.id, d };
    }
    return best?.id ?? null;
  }

  /** H : choisir la station où envoyer le train qu'on conduit (pilote automatique). */
  private chooseDestination(): void {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    if (!c || this.choosing) return;
    const stations = this.host.state.changes.stations;
    if (stations.length === 0) {
      this.host.sfx('deny');
      this.host.message(t('train.noStation'));
      return;
    }
    this.choosing = true;
    void this.host.chooseStation(stations.map((s) => ({ id: s.id, name: s.name }))).then((id) => {
      this.choosing = false;
      const station = id === null ? null : stations.find((s) => s.id === id);
      if (!station) return;
      if (this.host.state.sendTrain(c.id, station.id)) {
        this.autos.delete(c.id);
        this.host.sfx('select');
        this.host.message(t('train.goTo', { name: station.name }));
      }
    });
  }

  /** Voies de l'itinéraire à prendre aux embranchements qui sont à moins de 60 m devant le convoi. */
  private routePicks(c: Consist): number[] | undefined {
    const e = this.autos.get(c.id);
    if (!e) return undefined;
    const travelled = e.total - e.remaining;
    const picks = e.route.decisions
      .filter((d) => d.at - travelled <= 60 && d.at >= travelled - 2)
      .map((d) => d.chosen);
    return picks.length > 0 ? picks : undefined;
  }

  /**
   * Voie que prend le conducteur au prochain embranchement : celle qui tourne du côté où il appuie (gauche / droite),
   * sinon tout droit. L'embranchement n'est pas un levier : c'est le train qui choisit.
   */
  private steerPicks(graph: TrackGraph, c: Consist): number[] | undefined {
    const left = this.host.held('left');
    const right = this.host.held('right');
    if (left === right) return undefined;
    const ahead = this.choiceAheadOfLoco(graph);
    if (!ahead) return undefined;
    const sign = right ? 1 : -1;
    const turning = ahead.options.filter((o) => o.lateral * sign > 0.3);
    if (turning.length === 0) return undefined;
    const best = turning.reduce((a, b) => (b.lateral * sign > a.lateral * sign ? b : a));
    void c;
    return [best.piece];
  }

  /** Commande du pilote automatique pour ce convoi ; null si l'ordre est annulé (pas de chemin, plus de combustible). */
  private autoControl(
    graph: TrackGraph,
    c: Consist,
    dt: number,
  ): import('../core/rail/train').Control | null {
    const { state } = this.host;
    const station = state.changes.stations.find((x) => x.id === c.goTo);
    if (!station) {
      state.sendTrain(c.id, null);
      this.autos.delete(c.id);
      return null;
    }
    let e = this.autos.get(c.id);
    if (e) e.age += dt;
    if (!e || e.graph !== graph || e.age > 3) {
      const stop = { piece: station.piece, u: station.u };
      const offset = anchorOffset(c);
      // La locomotive (et non la tête du convoi) s'arrête au milieu du quai : la tête dépasse le repère de `offset`.
      let route = findRoute(graph, c.head, stop);
      let total = route ? route.distance + offset : 0;
      if (!route) {
        // La tête a déjà dépassé le repère : on regarde où en est la locomotive.
        const anchor = flip(graph.advance(flip(c.head), offset, preferOf(c)).pos);
        route = findRoute(graph, anchor, stop);
        total = route?.distance ?? 0;
        const a = graph.pose(anchor);
        const st = graph.pose({ piece: stop.piece, u: stop.u, dir: 1 });
        if (!route && a && st && Math.hypot(a.x - st.x, a.z - st.z) < 2)
          route = { distance: 0, steps: [], decisions: [] };
      }
      if (!route) {
        state.sendTrain(c.id, null);
        this.autos.delete(c.id);
        this.host.sfx('deny');
        this.host.message(t('train.noRoute', { name: station.name }));
        return null;
      }
      e = { route, remaining: total, graph, age: 0, total };
      this.autos.set(c.id, e);
    }
    const loco = c.cars.find((k) => CARS[k.kind].loco);
    if (loco && loco.heatKJ <= 0 && !loco.fuel && Math.abs(c.v) < 0.1) {
      state.sendTrain(c.id, null);
      this.autos.delete(c.id);
      this.host.message(t('train.noFuelAuto'));
      return null;
    }
    const ctrl = autoThrottle(c, e.remaining, AUTO_SPEED);
    if (ctrl.parked) {
      state.sendTrain(c.id, null);
      this.autos.delete(c.id);
      // Un train déjà à la station ne l'annonce pas (sinon un programme « va à X » sans condition claquerait sans fin).
      if (e.total > 1.5) {
        this.host.sfx('select');
        this.host.message(t('train.arrived', { name: station.name }));
      }
    }
    return ctrl;
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
    let out = side * (CAR_HALF_WIDTH_M + 0.9) - a.seatX;
    // À une station : on descend sur le quai, du côté où il se trouve (sinon, du côté du conducteur).
    for (const st of this.host.state.changes.stations) {
      const plat = this.stations.platformAt(st.id);
      if (!plat || Math.hypot(plat.x - a.x, plat.z - a.z) > 7) continue;
      const lateral = (plat.x - a.x) * Math.cos(a.yaw) - (plat.z - a.z) * Math.sin(a.yaw);
      if (Math.abs(lateral) >= 1.5 && Math.abs(lateral) <= 4) {
        out = lateral;
        break;
      }
    }
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
  /** Cap (0 à 7) du droit posé librement, loin de toute voie : R le tourne par pas de 45°. */
  private railTurn = 0;
  /** Ligne d'infos du patron : pourquoi on ne peut pas poser, vide sinon. */
  private traceInfo = '';

  /** Patrons posés en chaîne tant que le clic gauche est maintenu (relâcher pose, clic droit annule). */
  private chain: RailCandidate[] = [];
  /** Le clic droit a annulé la chaîne : rien ne se pose tant que le clic gauche n'est pas relâché. */
  private chainCancelled = false;
  /** Point visé au début d'une chaîne qui ne part d'aucune voie (sinon null). */
  private chainOrigin: { x: number; z: number } | null = null;

  /** Une chaîne de patrons est-elle en cours (clic gauche maintenu) ? */
  isTracing(): boolean {
    return this.chain.length > 0 && this.wasDown;
  }

  /** Clic droit pendant la chaîne : retire les patrons ; rien ne se pose au relâchement. */
  cancelTrace(): boolean {
    if (this.chain.length === 0) return false;
    this.chain = [];
    this.chainCancelled = true;
    this.ghostKey = '';
    this.setGhost([]);
    this.traceInfo = '';
    return true;
  }

  private handlePlacing(graph: TrackGraph, frame: TrainFrame): void {
    const { state } = this.host;
    const item = state.selectedItem();
    const rail = item === RAIL_ITEM;
    const carKind = item ? carKindOfItem(item) : null;
    const station = item === STATION_ITEM;
    const down = this.host.held('interact');
    const edge = down && !this.wasDown;
    const release = !down && this.wasDown;
    this.wasDown = down;
    if (!carKind) this.setCarGhost(null, false);
    if (!station) this.stations.showGhost(graph, null, false);
    if (this.mountedCar !== null || (!rail && !carKind && !station)) {
      this.setGhost([]);
      this.hintShown = '';
      this.chain = [];
      if (!rail) this.tilt = 0;
      return;
    }
    const aim = this.host.aim();
    if (rail) {
      if (frame.levelUp) this.setTilt(Math.min(1, this.tilt + 1) as -1 | 0 | 1);
      if (frame.levelDown) this.setTilt(Math.max(-1, this.tilt - 1) as -1 | 0 | 1);
      if (frame.rotate) this.railTurn = (this.railTurn + 1) % 8;
      this.placePatron(aim, edge, down, release);
      this.showHint('train.railHint');
    } else if (station) {
      this.setGhost([]);
      if (aim) this.placeStationAt(graph, aim, edge);
      else this.stations.showGhost(graph, null, false);
      this.showHint('train.stationHint');
    } else if (carKind && !aim) this.setCarGhost(null, false);
    else if (carKind && aim) {
      this.setGhost([]);
      if (frame.rotate) {
        this.carFlip = !this.carFlip;
        this.host.message(t('train.carFlipped'));
      }
      this.placeCar(graph, carKind, aim, edge);
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

  private showHint(key: 'train.railHint' | 'train.carHint' | 'train.stationHint'): void {
    if (this.hintShown === key) return;
    this.hintShown = key;
    this.host.message(t(key));
  }

  /** Le point visé est-il sur la voie existante, ou à moins de `margin` m d'elle ? */
  private onTrack(aim: { x: number; z: number }, margin: number): boolean {
    for (const piece of this.host.state.changes.rails) {
      const c = centerOf(piece);
      // Une pièce tient dans un bloc d'au plus 7 tuiles : trop loin, inutile de la regarder de près.
      if (Math.hypot(c.x - aim.x, c.z - aim.z) > 7 * TILE_M) continue;
      const len = lengthOfPiece(piece);
      for (let u = 0; u <= len + 1e-6; u += 0.8) {
        const q = poseOn(piece, Math.min(u, len));
        if (Math.hypot(q.x - aim.x, q.z - aim.z) <= margin) return true;
      }
    }
    return false;
  }

  /**
   * Bout de voie libre où le tracé s'accroche : celui dont le curseur est tout près (une tuile), ou, sur un terrain sans
   * voie, celui devant lequel le curseur se trouve même loin. Au milieu de la voie, le départ est la tuile visée.
   */
  private nearestFreePort(aim: { x: number; z: number }): Port | null {
    let best: { port: Port; d: number } | null = null;
    let onTrack: boolean | null = null;
    for (const p of freePorts(this.host.state.changes.rails)) {
      const d = Math.hypot(p.at.x - aim.x, p.at.z - aim.z);
      // Devant le bout de voie (pas derrière lui) : le plus proche du curseur, même loin.
      const along = (aim.x - p.at.x) * p.at.dx + (aim.z - p.at.z) * p.at.dz;
      let near = d <= SNAP_M;
      if (!near && along > -3 * TILE_M && d <= PORT_REACH_M) {
        onTrack ??= this.onTrack(aim, 2.2);
        near = !onTrack;
      }
      if (near && (!best || d < best.d)) best = { port: p.at, d };
    }
    return best?.port ?? null;
  }

  /** Pièce que montre le patron au curseur : près d'un bout de voie libre elle s'y colle, ailleurs c'est un droit sur la grille. */
  private patronAt(aim: { x: number; z: number }): { cand: RailCandidate | null; free: boolean } {
    const port = this.nearestFreePort(aim);
    return port
      ? { cand: pickCandidate(candidatesFrom(port, this.tilt), port, aim), free: false }
      : { cand: freeCandidate(aim, this.railTurn, 0), free: true };
  }

  /**
   * Vérifie une chaîne de patrons : chaque pièce doit tenir (terrain, chevauchement avec la voie ou avec les pièces
   * précédentes de la chaîne) et il faut assez de rails ; au premier refus, tout le reste est refusé.
   */
  private checkChain(chain: readonly RailCandidate[]): {
    items: { piece: RailPiece; ok: boolean }[];
    reason: 'terrain' | 'overlap' | 'missing' | null;
    cost: number;
  } {
    const { state } = this.host;
    let stock = state.inventory[RAIL_ITEM] ?? 0;
    const placed: RailPiece[] = [];
    let reason: 'terrain' | 'overlap' | 'missing' | null = null;
    let cost = 0;
    const items = chain.map((cand) => {
      const piece = pieceOf(cand);
      let ok = reason === null;
      if (ok) {
        const problem = state.railProblem(piece, (c) => this.host.blocked(c.gx, c.gz), placed);
        if (problem) reason = problem;
        else if (stock < cand.cost) reason = 'missing';
        ok = reason === null;
      }
      if (ok) {
        stock -= cand.cost;
        cost += cand.cost;
        placed.push({ ...piece, id: -(placed.length + 2) });
      }
      return { piece, ok };
    });
    return { items, reason, cost };
  }

  /**
   * Le patron de la prochaine pièce : vert si elle se pose, rouge sinon (avec la raison). Près d'un bout de voie libre il
   * s'y colle et prend la forme que montre le curseur (droit, virage à gauche ou à droite, rampe) ; ailleurs c'est un
   * droit sur la grille, que R tourne par pas de 45°. Clic gauche maintenu : le patron se fixe et le curseur qui avance
   * ajoute des patrons à la suite (reculer en retire) ; relâcher pose toute la chaîne, clic droit l'annule.
   */
  private placePatron(
    aim: { x: number; z: number } | null,
    edge: boolean,
    down: boolean,
    release: boolean,
  ): void {
    const { state } = this.host;
    if (this.chainCancelled) {
      if (!down) this.chainCancelled = false;
      this.chain = [];
      this.setGhost([]);
      return;
    }
    if (!aim) {
      if (release) this.chain = [];
      this.setGhost([]);
      return;
    }
    if (edge) {
      const first = this.patronAt(aim);
      this.chain = first.cand ? [first.cand] : [];
      // Départ libre : la première pièce se tourne vers le curseur dès qu'on glisse.
      this.chainOrigin = first.free ? { x: aim.x, z: aim.z } : null;
    }
    if (down && this.chain.length > 0) this.growChain(aim);
    // Relâcher : on pose la chaîne (ou, sans chaîne, le patron sous le curseur n'est qu'un aperçu).
    if (release && this.chain.length > 0) {
      const { items, reason: why } = this.checkChain(this.chain);
      let placed = 0;
      for (let i = 0; i < items.length; i++) {
        if (!items[i].ok) break;
        const c = this.chain[i];
        if (
          state.placeRail(c.kind, c.x, c.z, c.h, c.level, (cell) =>
            this.host.blocked(cell.gx, cell.gz),
          ) === 'ok'
        )
          placed++;
      }
      const stopped = placed < this.chain.length;
      this.chain = [];
      this.ghostKey = '';
      this.setGhost([]);
      this.traceInfo = '';
      if (placed > 0) {
        this.host.sfx('placeStone');
        this.host.message(t(stopped ? 'train.railStopped' : 'train.railPlaced'));
      } else {
        this.host.sfx('deny');
        this.host.message(why ? t(`train.rail.${why}` as TranslationKey) : t('train.railBlocked'));
      }
      return;
    }
    const shown = this.chain.length > 0 ? this.chain : this.single(aim);
    if (shown.length === 0) {
      this.setGhost([]);
      return;
    }
    const { items, reason, cost } = this.checkChain(shown);
    this.setGhost(items);
    if (reason) this.traceInfo = t(`train.rail.${reason}` as TranslationKey);
    else if (shown.length > 1)
      this.traceInfo = t('train.trace', {
        rails: String(cost),
        length: String(Math.round(shown.reduce((n, c) => n + lengthOfPiece(pieceOf(c)), 0))),
      });
    else this.traceInfo = '';
  }

  /** Le patron seul sous le curseur (sans chaîne), ou rien s'il n'y a rien à montrer. */
  private single(aim: { x: number; z: number }): RailCandidate[] {
    const { cand } = this.patronAt(aim);
    if (!cand || this.host.state.railAlready(cand.kind, cand.x, cand.z, cand.h, cand.level))
      return [];
    return [cand];
  }

  /** Allonge la chaîne vers le curseur : un patron de plus chaque fois qu'il est devant le bout, un de moins s'il recule. */
  private growChain(aim: { x: number; z: number }): void {
    // Départ libre : tant que la chaîne n'a qu'une pièce, elle regarde vers le curseur (par pas de 45°).
    if (this.chain.length === 1 && this.chainOrigin) {
      const o = this.chainOrigin;
      if (Math.hypot(aim.x - o.x, aim.z - o.z) > TILE_M)
        this.chain = [freeCandidate(o, headingOf(aim.x - o.x, aim.z - o.z), this.chain[0].level)];
    }
    for (let guard = 0; guard < 6 && this.chain.length < MAX_CHAIN; guard++) {
      const last = this.chain[this.chain.length - 1];
      const tail = portsOf(pieceOf(last))[1];
      const dx = aim.x - tail.x;
      const dz = aim.z - tail.z;
      const along = dx * tail.dx + dz * tail.dz;
      // Le curseur doit avoir dépassé le bout d'au moins une demi-pièce droite pour qu'une pièce s'ajoute.
      if (along < TILE_M / 2 || Math.hypot(dx, dz) < TILE_M) break;
      const next = pickCandidate(candidatesFrom(tail, 0), tail, aim);
      if (!next) break;
      this.chain.push(next);
    }
    // Le curseur est revenu derrière le début de la dernière pièce : on la retire (jamais la première).
    while (this.chain.length > 1) {
      const last = this.chain[this.chain.length - 1];
      const start = portsOf(pieceOf(last))[0];
      // Le port 0 regarde en arrière : le sens de marche de la pièce est son opposé.
      const ahead = -((aim.x - start.x) * start.dx + (aim.z - start.z) * start.dz);
      if (ahead < TILE_M / 2) this.chain.pop();
      else break;
    }
  }

  /** Pose d'une station sur la voie la plus proche du curseur (fantôme vert : on peut ; rouge : non). */
  private placeStationAt(graph: TrackGraph, aim: { x: number; z: number }, edge: boolean): void {
    const near = this.nearestTrack(graph, aim.x, aim.z);
    if (!near || near.dist > CAR_AIM_M * 2) {
      this.stations.showGhost(graph, null, false);
      if (edge) {
        this.host.sfx('deny');
        this.host.message(t('train.cannotStation'));
      }
      return;
    }
    const at = { piece: near.piece.id, u: near.u };
    const { state } = this.host;
    const ok = !state.changes.stations.some(
      (s) => s.piece === at.piece && Math.abs(s.u - at.u) < 3,
    );
    this.stations.showGhost(graph, at, ok);
    if (!edge) return;
    const placed = ok ? state.placeStation(at) : null;
    if (placed) {
      this.host.sfx('placeStone');
      this.host.message(t('train.stationPlaced', { name: placed.name }));
    } else {
      this.host.sfx('deny');
      this.host.message(t('train.cannotStation'));
    }
  }

  private placeCar(
    graph: TrackGraph,
    kind: CarKind,
    aim: { x: number; z: number },
    edge: boolean,
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
    // Le véhicule regarde le sens de la voie ; R l'inverse (il ne dépend plus du sens du joueur).
    const pos: TrackPos = { piece: near.piece.id, u: near.u, dir: this.carFlip ? -1 : 1 };
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

  /** Ligne du pilote automatique : destination et distance restante, ou le rappel de la touche H. */
  private autoHud(c: Consist): string {
    const prog = c.program;
    const progText =
      prog && prog.steps.length > 0
        ? ` · ${t(prog.running ? 'train.hud.program' : 'train.hud.programPaused', { n: String((prog.index % prog.steps.length) + 1), of: String(prog.steps.length) })}`
        : '';
    const st = this.host.state.changes.stations.find((x) => x.id === c.goTo);
    const e = this.autos.get(c.id);
    if (st)
      return `${progText} · ${t('train.hud.auto', { name: st.name, dist: String(Math.max(0, Math.round(e?.remaining ?? 0))) })}`;
    return `${progText} · ${t('train.routeHint')}`;
  }

  /** Prochain embranchement devant la locomotive, pour le tableau de bord : voies qui tournent et touches à presser. */
  private switchHud(): string {
    const graph = this.lastGraph;
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    const loco = c?.cars.find((k) => k.id === this.mountedCar);
    if (!graph || !c || !loco) return '';
    const ahead = this.choiceAheadOfLoco(graph);
    if (!ahead) return '';
    const left = ahead.options.some((o) => o.lateral < -0.3);
    const right = ahead.options.some((o) => o.lateral > 0.3);
    if (!left && !right) return '';
    const key =
      left && right
        ? 'train.hud.junctionBoth'
        : left
          ? 'train.hud.junctionLeft'
          : 'train.hud.junctionRight';
    return ` · ${t(key)}`;
  }

  private hudSig = '';
  private hudExtra = '';

  private updateHud(): void {
    const c = this.mountedCar !== null ? this.consistOf(this.mountedCar) : null;
    if (!c || this.mountedCar === null) {
      this.hudSig = '';
      this.hud.hidden = this.traceInfo === '';
      this.hud.textContent = this.traceInfo;
      return;
    }
    const loco = c.cars.find((k) => k.id === this.mountedCar);
    // Sans changement visible, on ne retouche pas le DOM à chaque image.
    const sig = [
      Math.round(Math.abs(c.v) * 3.6),
      Math.abs(c.v) < 0.05 ? 0 : c.v * (loco?.rev ? -1 : 1) > 0 ? 1 : -1,
      loco?.fuel?.count ?? 0,
      Math.round(Math.min(100, ((loco?.heatKJ ?? 0) / 9000) * 100)),
      this.host.held('jump') ? 1 : 0,
      Math.round(consistMass(c) / 1000),
      c.cars.length > 1 ? 1 : 0,
    ].join();
    const extra = this.switchHud() + this.autoHud(c);
    if (sig === this.hudSig && extra === this.hudExtra && !this.hud.hidden) return;
    this.hudSig = sig;
    this.hudExtra = extra;
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
      ` · ${t('train.hud.mass', { t: (consistMass(c) / 1000).toFixed(0) })}` +
      extra +
      (c.cars.length > 1 ? ` · ${t('train.uncoupleHint')}` : ` · ${t('train.coupleHint')}`);
  }
}
