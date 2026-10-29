/**
 * Convois : des véhicules attelés qui roulent sur la voie (voir `docs/trains.md`). Le convoi est un seul corps rigide
 * qui avance le long de la voie ; sa tête (l'attelage avant du premier véhicule) est repérée sur la voie et chaque
 * véhicule est placé derrière, à la longueur de ceux qui le précèdent. La physique est celle d'un train : effort de
 * traction limité par la puissance et l'adhérence, résistance au roulement et à l'air, pente, freins, inertie de toute
 * la rame, chocs et attelage.
 */
import { energyKJ, itemById } from '../data/items';
import { CARS, LIQUID_KG_PER_L, type CarKind, type LiquidKind } from '../data/trains';
import type { Program } from './program';
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
  /** Wagon de fret : les piles chargées (liste sans trous, comme un coffre). */
  cargo?: { item: string; count: number }[];
  /** Citerne : le liquide transporté et sa quantité (L). */
  liquid?: { kind: LiquidKind; liters: number } | null;
}

export interface Consist {
  id: number;
  /** Attelage avant du premier véhicule, orienté dans le sens de marche du convoi. */
  head: TrackPos;
  /** Vitesse (m/s), positive vers l'avant du convoi. */
  v: number;
  /** Du premier au dernier véhicule. */
  cars: Car[];
  /** Pilote automatique : station où le convoi se rend (rien : conduite à la main). */
  goTo?: number;
  /** Pièces que la tête a parcourues dernièrement : la queue du convoi les suit aux embranchements. */
  trail?: number[];
  /**
   * Voies à prendre aux prochains embranchements (pièces choisies par le conducteur avec gauche / droite, ou par le
   * pilote automatique). Rien : tout droit. Réévalué à chaque image, jamais sauvegardé.
   */
  pick?: number[];
  /** Programme en boucle (étapes « quand… alors… »), voir `program.ts`. */
  program?: Program;
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
/** Masse du contenu d'un wagon (kg) : objets chargés ou liquide. */
export function cargoMassKg(c: Car): number {
  let kg = 0;
  for (const s of c.cargo ?? []) kg += (itemById(s.item).weightG / 1000) * s.count;
  if (c.liquid) kg += LIQUID_KG_PER_L[c.liquid.kind] * c.liquid.liters;
  return kg;
}
/** Volume (L) des objets chargés dans un wagon de fret. */
export function cargoVolumeL(c: Car): number {
  let l = 0;
  for (const s of c.cargo ?? []) l += (itemById(s.item).volumeMl / 1000) * s.count;
  return l;
}
/** Masse totale du véhicule : à vide plus son contenu. Plus la rame est lourde, plus elle est lente à lancer et à arrêter. */
export const massOfCar = (c: Car): number => CARS[c.kind].massKg + cargoMassKg(c);
export const consistLength = (c: Consist): number => c.cars.reduce((a, k) => a + lengthOfCar(k), 0);
export const consistMass = (c: Consist): number => c.cars.reduce((a, k) => a + massOfCar(k), 0);

/** Du centre du véhicule à son attelage côté tête du convoi (m) : l'avant du modèle, ou l'arrière s'il est retourné. */
export const leadOfCar = (c: Car): number =>
  c.rev ? CARS[c.kind].lengthM - CARS[c.kind].frontM : CARS[c.kind].frontM;

/** Du centre du véhicule au bout de sa caisse (sans l'attelage), côté tête ou côté queue du convoi (m). */
export const bodyEnd = (c: Car, side: 'lead' | 'tail'): number => {
  const b = CARS[c.kind].bodyM;
  return (side === 'lead') !== c.rev ? b.front : b.rear;
};

/**
 * Distance de la tête au centre de chaque véhicule, en descendant le convoi : les points d'attelage se touchent, la
 * distance entre deux véhicules est donc fixe (le long de la voie).
 */
export function carOffsets(c: Consist): number[] {
  const out: number[] = [];
  let at = 0;
  for (const car of c.cars) {
    out.push(at + leadOfCar(car));
    at += lengthOfCar(car);
  }
  return out;
}

/**
 * Distance (m) de la tête du convoi au centre de sa première locomotive (à défaut, du premier véhicule) : c'est elle
 * qui doit se trouver au milieu du quai d'une station, la tête dépassant donc le repère de cette distance.
 */
export function anchorOffset(c: Consist): number {
  const offsets = carOffsets(c);
  const i = c.cars.findIndex((k) => CARS[k.kind].loco);
  return offsets[i >= 0 ? i : 0] ?? 0;
}

const TRAIL_MAX = 80;
const trailSets = new WeakMap<number[], Set<number>>();
/** Les pièces que le convoi vient de parcourir (pour placer sa queue aux embranchements), ou rien. */
export function preferOf(c: Consist): ReadonlySet<number> | undefined {
  const trail = c.trail;
  if (!trail || trail.length === 0) return undefined;
  let set = trailSets.get(trail);
  if (!set) {
    set = new Set(trail);
    trailSets.set(trail, set);
  }
  return set;
}

const pickSets = new WeakMap<number[], Set<number>>();
/** Les voies que le convoi doit prendre aux embranchements devant lui, ou rien (tout droit). */
export function wantOf(c: Consist): ReadonlySet<number> | undefined {
  const pick = c.pick;
  if (!pick || pick.length === 0) return undefined;
  let set = pickSets.get(pick);
  if (!set) {
    set = new Set(pick);
    pickSets.set(pick, set);
  }
  return set;
}

/** Note la pièce où est la tête (à chaque changement de pièce). */
function noteTrail(c: Consist): void {
  const last = c.trail?.[c.trail.length - 1];
  if (last === c.head.piece) return;
  c.trail = [...(c.trail ?? []).slice(-(TRAIL_MAX - 1)), c.head.piece];
}

/** Attelage avant ou arrière du convoi, orienté vers l'extérieur du convoi. */
export function endPos(graph: TrackGraph, c: Consist, end: 'front' | 'rear'): TrackPos {
  if (end === 'front') return c.head;
  return graph.advance(flip(c.head), consistLength(c), preferOf(c)).pos;
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
  const prefer = preferOf(c);
  const centre = graph.advance(flip(c.head), offset, prefer).pos; // regarde vers l'arrière du convoi
  const rear = graph.advance(centre, hb, prefer).pos;
  const front = graph.advance(flip(centre), hb, prefer).pos;
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

/** Caisse d'un véhicule vue du dessus : centre (entre les essieux), sens du convoi, bouts côté tête et côté queue. */
export interface CarBox {
  x: number;
  z: number;
  /** Sens du convoi (vers la tête). */
  ux: number;
  uz: number;
  /** Du centre au bout de la caisse côté tête et côté queue (m). */
  lead: number;
  tail: number;
}

/**
 * Recouvrement (m) de deux caisses vues du dessus (rectangles de `2 × CAR_HALF_WIDTH_M` de large) : la plus petite
 * profondeur de pénétration sur les quatre axes des rectangles (théorème des axes séparateurs), 0 s'ils ne se touchent
 * pas. En courbe, des caisses droites trop proches se chevaucheraient du côté intérieur (« effet portefeuille »).
 */
export function overlapBetween(a: CarBox, b: CarBox): number {
  const hw = CAR_HALF_WIDTH_M;
  const corners = (k: CarBox): [number, number][] => {
    const out: [number, number][] = [];
    for (const l of [k.lead, -k.tail])
      for (const s of [-1, 1])
        out.push([k.x + k.ux * l + k.uz * s * hw, k.z + k.uz * l - k.ux * s * hw]);
    return out;
  };
  const ca = corners(a);
  const cb = corners(b);
  let best = Infinity;
  for (const [ax, az] of [
    [a.ux, a.uz],
    [a.uz, -a.ux],
    [b.ux, b.uz],
    [b.uz, -b.ux],
  ]) {
    const span = (cs: [number, number][]): [number, number] => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const [x, z] of cs) {
        const d = x * ax + z * az;
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
      return [lo, hi];
    };
    const [a0, a1] = span(ca);
    const [b0, b1] = span(cb);
    const depth = Math.min(a1, b1) - Math.max(a0, b0);
    if (depth <= 0) return 0;
    best = Math.min(best, depth);
  }
  return best;
}

/**
 * Pose de chaque véhicule : centre entre ses essieux, cap de la corde qui les relie. Les attelages automatiques
 * (longs bras à l'arrière de la locomotive et aux deux bouts des wagons) écartent assez les caisses pour qu'elles ne
 * se touchent pas dans les virages : la distance entre véhicules reste fixe. Seul cas restant, un wagon attelé aux
 * tampons de l'avant d'une locomotive (sans long attelage) : il est alors reculé juste assez en courbe pour que les
 * caisses ne se chevauchent pas.
 */
export function carPoses(graph: TrackGraph, c: Consist): CarPose[] {
  const offsets = carOffsets(c);
  let extra = 0;
  let prev: CarBox | null = null;
  return c.cars.map((car, i) => {
    let p = poseAt(graph, c, car, offsets[i] + extra);
    const box = (q: NonNullable<typeof p>): CarBox => ({
      x: q.x,
      z: q.z,
      ux: q.ux,
      uz: q.uz,
      lead: bodyEnd(car, 'lead'),
      tail: bodyEnd(car, 'tail'),
    });
    if (p && prev) {
      for (let k = 0; k < 8; k++) {
        const d = overlapBetween(prev, box(p));
        if (d < 1e-3) break;
        extra += Math.max(d, 0.05);
        p = poseAt(graph, c, car, offsets[i] + extra) ?? p;
      }
    }
    if (!p) return { car, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    prev = box(p);
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
  // Locomotive électrique : la batterie fait office de réserve, rien à enfourner.
  if (CARS[car.kind].loco?.electric) return car.heatKJ > 0;
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
    const p = graph.pose(flip(graph.advance(back, offsets[i], preferOf(c)).pos));
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
      ? graph.advance(c.head, v * dt, wantOf(c))
      : (() => {
          const r = graph.advance(flip(c.head), -v * dt);
          return { ...r, pos: flip(r.pos) };
        })();
  c.head = moved.pos;
  noteTrail(c);
  // Butoir : on rebondit à peine.
  if (moved.blocked) c.v = -c.v * RESTITUTION;
}

/** Identifiants des pièces de voie sous le convoi (échantillonné tous les 0,5 m, tête et queue comprises). */
export function piecesUnder(graph: TrackGraph, c: Consist): Set<number> {
  const out = new Set<number>([c.head.piece]);
  const back = flip(c.head);
  const len = consistLength(c) + 1;
  const prefer = preferOf(c);
  for (let d = 0.5; d <= len; d += 0.5) out.add(graph.advance(back, d, prefer).pos.piece);
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
  const rearHead = graph.advance(flip(c.head), frontLen, preferOf(c)).pos; // regarde vers l'arrière
  c.cars = front;
  return {
    id: newId,
    head: flip(rearHead),
    v: c.v,
    cars: rear,
    ...(c.trail ? { trail: [...c.trail] } : {}),
  };
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
