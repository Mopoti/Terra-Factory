/**
 * Convois : des véhicules attelés qui roulent sur la voie (voir `docs/trains.md`). Le convoi est un seul corps rigide
 * qui avance le long de la voie ; sa tête (l'attelage avant du premier véhicule) est repérée sur la voie et chaque
 * véhicule est placé derrière, à la longueur de ceux qui le précèdent. La physique est celle d'un train : effort de
 * traction limité par la puissance et l'adhérence, résistance au roulement et à l'air, pente, freins, inertie de toute
 * la rame, chocs et attelage.
 */
import { energyKJ } from '../data/items';
import { CARS, type CarKind } from '../data/trains';
import { flip, type TrackGraph, type TrackPos } from './track';

export interface Car {
  id: number;
  kind: CarKind;
  /** Le véhicule regarde vers l'arrière du convoi (locomotive attelée à l'envers). */
  rev: boolean;
  /** Chaleur disponible dans la chaudière (kJ) d'une locomotive. */
  heatKJ: number;
  /** Combustible dans la soute d'une locomotive. */
  fuel: { item: string; count: number } | null;
}

export interface Consist {
  id: number;
  /** Attelage avant du premier véhicule, orienté dans le sens de marche du convoi. */
  head: TrackPos;
  /** Vitesse (m/s), positive vers l'avant du convoi. */
  v: number;
  /** Du premier au dernier véhicule. */
  cars: Car[];
}

export const G = 9.81;
const ROLLING = 0.0035;
const AERO = 2.5;
/** Décélération du frein de service (m/s²) et retenue d'un convoi garé (frein à main, m/s²). */
export const BRAKE_DECEL = 1.1;
const HOLD_DECEL = 3.6;
/** Écart maximal (m) entre deux attelages pour pouvoir les atteler. */
export const COUPLE_REACH_M = 1.6;
const RESTITUTION = 0.12;

export interface Control {
  /** Levier de traction dans le sens du convoi : −1 (arrière toute) à +1 (avant toute). */
  throttle: number;
  /** Frein de service, de 0 à 1 ; un convoi garé (`parked`) est retenu par le frein à main. */
  brake: number;
  parked: boolean;
}

export const IDLE: Control = { throttle: 0, brake: 1, parked: true };

export const lengthOfCar = (c: Car): number => CARS[c.kind].lengthM;
export const massOfCar = (c: Car): number => CARS[c.kind].massKg;
export const consistLength = (c: Consist): number => c.cars.reduce((a, k) => a + lengthOfCar(k), 0);
export const consistMass = (c: Consist): number => c.cars.reduce((a, k) => a + massOfCar(k), 0);

/** Distance de la tête au centre de chaque véhicule, en descendant le convoi. */
export function carOffsets(c: Consist): number[] {
  const out: number[] = [];
  let at = 0;
  for (const car of c.cars) {
    out.push(at + lengthOfCar(car) / 2);
    at += lengthOfCar(car);
  }
  return out;
}

/** Attelage avant ou arrière du convoi, orienté vers l'extérieur du convoi. */
export function endPos(graph: TrackGraph, c: Consist, end: 'front' | 'rear'): TrackPos {
  if (end === 'front') return c.head;
  return graph.advance(flip(c.head), consistLength(c)).pos;
}

export interface CarPose {
  car: Car;
  x: number;
  y: number;
  z: number;
  /** Cap du modèle (son avant). */
  yaw: number;
  /** Inclinaison (rad), positive quand l'avant du modèle monte. */
  pitch: number;
}

/** Place les véhicules : le centre est entre les deux essieux, qui suivent la voie (les courbes se prennent bien). */
/** Demi-largeur (m) des caisses et des traverses de tête, pour l'écart en courbe (voir `carPoses`). */
export const CAR_HALF_WIDTH_M = 1.3;

/** Pose d'un véhicule dont le centre est à `offset` mètres derrière la tête, et son avant (sens du convoi). */
function poseAt(
  graph: TrackGraph,
  c: Consist,
  car: Car,
  offset: number,
): { x: number; y: number; z: number; yaw: number; pitch: number; ux: number; uz: number } | null {
  const hb = CARS[car.kind].halfBaseM;
  const centre = graph.advance(flip(c.head), offset).pos; // regarde vers l'arrière du convoi
  const rear = graph.advance(centre, hb).pos;
  const front = graph.advance(flip(centre), hb).pos;
  const pf = graph.pose(front);
  const pr = graph.pose(rear);
  const pc = graph.pose(flip(centre));
  if (!pf || !pr || !pc) return null;
  const dx = pf.x - pr.x;
  const dz = pf.z - pr.z;
  const run = Math.hypot(dx, dz);
  const yaw = run > 1e-3 ? Math.atan2(dx, dz) : pc.yaw;
  const pitch = Math.atan2(pf.y - pr.y, Math.max(run, 1e-3));
  return {
    x: (pf.x + pr.x) / 2,
    y: (pf.y + pr.y) / 2,
    z: (pf.z + pr.z) / 2,
    yaw,
    pitch,
    ux: Math.sin(yaw),
    uz: Math.cos(yaw),
  };
}

/**
 * Recouvrement (m) entre l'arrière du véhicule `a` et l'avant du véhicule `b` qui le suit : en courbe, les caisses
 * droites se rapprochent du côté intérieur et se chevaucheraient (« effet portefeuille »). On mesure de combien les
 * coins de l'avant de `b` dépassent le plan arrière de `a`, et inversement ; 0 s'ils ne se touchent pas.
 */
export function overlapBetween(
  a: { x: number; z: number; ux: number; uz: number },
  la: number,
  b: { x: number; z: number; ux: number; uz: number },
  lb: number,
): number {
  const hw = CAR_HALF_WIDTH_M;
  // Plans : arrière de a (normale vers l'arrière de a), avant de b (normale vers l'avant de b).
  const ar = { x: a.x - a.ux * (la / 2), z: a.z - a.uz * (la / 2) };
  const bf = { x: b.x + b.ux * (lb / 2), z: b.z + b.uz * (lb / 2) };
  let d = 0;
  for (const s of [-1, 1]) {
    // Coins de l'avant de b : en avant du plan arrière de a ?
    const cbx = bf.x + b.uz * s * hw;
    const cbz = bf.z - b.ux * s * hw;
    d = Math.max(d, (cbx - ar.x) * a.ux + (cbz - ar.z) * a.uz);
    // Coins de l'arrière de a : en arrière du plan avant de b ?
    const cax = ar.x + a.uz * s * hw;
    const caz = ar.z - a.ux * s * hw;
    d = Math.max(d, -((cax - bf.x) * b.ux + (caz - bf.z) * b.uz));
  }
  return d;
}

/**
 * Pose de chaque véhicule : centre entre ses essieux, cap de la corde qui les relie. En courbe, chaque véhicule est
 * reculé juste assez pour que ses tampons ne rentrent pas dans ceux du précédent (l'attelage s'allonge un peu, comme
 * le jeu des tampons d'un vrai train) ; en ligne droite rien ne change.
 */
export function carPoses(graph: TrackGraph, c: Consist): CarPose[] {
  const offsets = carOffsets(c);
  let extra = 0;
  let prev: { pose: NonNullable<ReturnType<typeof poseAt>>; len: number } | null = null;
  return c.cars.map((car, i) => {
    const len = lengthOfCar(car);
    let p = poseAt(graph, c, car, offsets[i] + extra);
    if (p && prev) {
      for (let k = 0; k < 4; k++) {
        const d = overlapBetween(prev.pose, prev.len, p, len);
        if (d < 1e-3) break;
        extra += d;
        p = poseAt(graph, c, car, offsets[i] + extra) ?? p;
      }
    }
    if (!p) return { car, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    prev = { pose: p, len };
    let { yaw, pitch } = p;
    if (car.rev) {
      yaw += Math.PI;
      pitch = -pitch;
    }
    return { car, x: p.x, y: p.y, z: p.z, yaw, pitch };
  });
}

/** Chaleur à brûler : prend du combustible de la soute quand la chaudière est vide. Faux s'il n'y a plus rien. */
function feedBoiler(car: Car): boolean {
  if (car.heatKJ > 0) return true;
  if (!car.fuel || car.fuel.count <= 0) return false;
  const kj = energyKJ(car.fuel.item);
  if (kj <= 0) return false;
  car.heatKJ += kj;
  car.fuel.count--;
  if (car.fuel.count <= 0) car.fuel = null;
  return true;
}

/** Pente (m/m) moyenne sous le convoi, positive quand il monte en avançant. */
function gradeOf(graph: TrackGraph, c: Consist): number {
  const back = flip(c.head);
  let sum = 0;
  let mass = 0;
  const offsets = carOffsets(c);
  c.cars.forEach((car, i) => {
    const p = graph.pose(flip(graph.advance(back, offsets[i]).pos));
    const m = massOfCar(car);
    sum += (p?.slope ?? 0) * m;
    mass += m;
  });
  return mass > 0 ? sum / mass : 0;
}

/** Fait avancer le convoi de `dt` secondes sous la commande `ctrl`. */
export function stepConsist(graph: TrackGraph, c: Consist, dt: number, ctrl: Control): void {
  if (!graph.has(c.head.piece) || c.cars.length === 0) {
    c.v = 0;
    return;
  }
  const mass = consistMass(c);
  const th = Math.max(-1, Math.min(1, ctrl.throttle));
  // Traction : chaque locomotive pousse dans le sens de son levier ; l'effort baisse quand la vitesse monte.
  let drive = 0;
  for (const car of c.cars) {
    const spec = CARS[car.kind].loco;
    if (!spec) continue;
    const idle = spec.idleBurnKw * dt;
    let usedKJ = idle;
    if (th !== 0 && feedBoiler(car)) {
      const dir = Math.sign(th);
      const along = c.v * dir;
      const vNow = Math.max(0.5, along);
      let effort = Math.min(spec.startEffortN, (spec.powerKw * 1000) / vNow) * Math.abs(th);
      if (along > spec.vMax) effort = 0;
      drive += effort * dir;
      const powerFrac = Math.min(1, (effort * Math.max(along, 0)) / (spec.powerKw * 1000));
      usedKJ += (spec.fullBurnKw - spec.idleBurnKw) * powerFrac * dt;
    }
    if (car.heatKJ > 0 || feedBoiler(car)) car.heatKJ = Math.max(0, car.heatKJ - usedKJ);
  }
  // Pente et air (poussent ou freinent sans jamais « tenir » le convoi à l'arrêt).
  drive -= mass * G * gradeOf(graph, c);
  drive -= AERO * c.v * Math.abs(c.v);
  // Frottements : roulement et freins, qui s'opposent au mouvement et peuvent l'arrêter.
  const brake = ctrl.parked ? 1 : Math.max(0, Math.min(1, ctrl.brake));
  const friction = ROLLING * mass * G + brake * BRAKE_DECEL * mass;
  const hold =
    ROLLING * 1.4 * mass * G + (ctrl.parked ? HOLD_DECEL * mass : brake * BRAKE_DECEL * 1.6 * mass);
  let v = c.v + (drive / mass) * dt;
  if (Math.abs(c.v) < 0.03 && Math.abs(drive) <= hold) v = 0;
  else {
    const slow = (friction / mass) * dt;
    if (Math.abs(v) <= slow) v = 0;
    else v -= Math.sign(v) * slow;
  }
  c.v = v;
  // Déplacement.
  if (v === 0) return;
  const moved =
    v > 0
      ? graph.advance(c.head, v * dt)
      : (() => {
          const r = graph.advance(flip(c.head), -v * dt);
          return { ...r, pos: flip(r.pos) };
        })();
  c.head = moved.pos;
  // Butoir : on rebondit à peine.
  if (moved.blocked) c.v = -c.v * RESTITUTION;
}

/** Identifiants des pièces de voie sous le convoi (échantillonné tous les 0,5 m, tête et queue comprises). */
export function piecesUnder(graph: TrackGraph, c: Consist): Set<number> {
  const out = new Set<number>([c.head.piece]);
  const back = flip(c.head);
  const len = consistLength(c) + 1;
  for (let d = 0.5; d <= len; d += 0.5) out.add(graph.advance(back, d).pos.piece);
  return out;
}

/** Point du monde d'un attelage. */
function endPoint(
  graph: TrackGraph,
  c: Consist,
  end: 'front' | 'rear',
): { x: number; y: number; z: number } | null {
  const p = graph.pose(endPos(graph, c, end));
  return p ? { x: p.x, y: p.y, z: p.z } : null;
}

export interface CouplingCandidate {
  other: Consist;
  mine: 'front' | 'rear';
  theirs: 'front' | 'rear';
  gap: number;
}

/** L'attelage le plus proche d'un autre convoi (à moins de `reach` mètres), ou null. */
export function findCoupling(
  graph: TrackGraph,
  all: readonly Consist[],
  c: Consist,
  reach = COUPLE_REACH_M,
): CouplingCandidate | null {
  let best: CouplingCandidate | null = null;
  for (const other of all) {
    if (other.id === c.id) continue;
    for (const mine of ['front', 'rear'] as const) {
      const a = endPoint(graph, c, mine);
      if (!a) continue;
      for (const theirs of ['front', 'rear'] as const) {
        const b = endPoint(graph, other, theirs);
        if (!b) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (gap <= reach && (!best || gap < best.gap)) best = { other, mine, theirs, gap };
      }
    }
  }
  return best;
}

/** Retourne le convoi : l'arrière devient l'avant (la rame est la même, vue de l'autre bout). */
export function reverseConsist(graph: TrackGraph, c: Consist): void {
  c.head = endPos(graph, c, 'rear');
  c.cars = c.cars.reverse().map((k) => ({ ...k, rev: !k.rev }));
  c.v = -c.v;
}

/**
 * Attelle deux convois par les extrémités indiquées ; renvoie le convoi réuni (celui de `a`, `b` disparaît de la liste
 * que l'appelant gère). La vitesse commune conserve la quantité de mouvement.
 */
export function coupleConsists(
  graph: TrackGraph,
  a: Consist,
  aEnd: 'front' | 'rear',
  b: Consist,
  bEnd: 'front' | 'rear',
): Consist {
  // `a` est devant : son arrière touche l'avant de `b`.
  if (aEnd === 'front') reverseConsist(graph, a);
  if (bEnd === 'rear') reverseConsist(graph, b);
  const ma = consistMass(a);
  const mb = consistMass(b);
  const v = (ma * a.v + mb * b.v) / (ma + mb);
  a.cars = [...a.cars, ...b.cars];
  a.v = v;
  return a;
}

/** Sépare le convoi entre le véhicule `index − 1` et le véhicule `index` ; renvoie le convoi arrière (même vitesse). */
export function splitConsist(
  graph: TrackGraph,
  c: Consist,
  index: number,
  newId: number,
): Consist | null {
  if (index <= 0 || index >= c.cars.length) return null;
  const front = c.cars.slice(0, index);
  const rear = c.cars.slice(index);
  const frontLen = front.reduce((a, k) => a + lengthOfCar(k), 0);
  const rearHead = graph.advance(flip(c.head), frontLen).pos; // regarde vers l'arrière
  c.cars = front;
  return { id: newId, head: flip(rearHead), v: c.v, cars: rear };
}

/** Chocs entre convois qui se touchent sans être attelés : choc mou, ils repartent presque ensemble. */
export function collide(graph: TrackGraph, all: Consist[]): void {
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      for (const ea of ['front', 'rear'] as const) {
        for (const eb of ['front', 'rear'] as const) {
          const pa = endPoint(graph, a, ea);
          const pb = endPoint(graph, b, eb);
          if (!pa || !pb) continue;
          if (Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) > 0.3) continue;
          // Vitesses le long de l'axe qui va de `a` vers `b` : avancer par l'avant va vers l'autre.
          const va = ea === 'front' ? a.v : -a.v;
          const vb = eb === 'front' ? -b.v : b.v;
          if (va - vb <= 0.02) continue;
          const ma = consistMass(a);
          const mb = consistMass(b);
          const common = (ma * va + mb * vb) / (ma + mb);
          const nva = common - (mb * RESTITUTION * (va - vb)) / (ma + mb);
          const nvb = common + (ma * RESTITUTION * (va - vb)) / (ma + mb);
          a.v = ea === 'front' ? nva : -nva;
          b.v = eb === 'front' ? -nvb : nvb;
        }
      }
    }
  }
}
