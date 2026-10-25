/**
 * Itinéraires et pilotage automatique d'un convoi (voir `docs/trains-programmation.md`) : recherche du chemin le plus
 * court jusqu'à un point de la voie (une station), réglage des aiguillages le long du chemin, et commande du convoi
 * (poussée et frein) pour rouler puis s'arrêter pile sur le repère.
 */
import { lengthOfPiece, baseId, type TrackGraph, type TrackPos } from './track';
import { BRAKE_DECEL, type Consist, type Control } from './train';

/** Point d'arrêt sur la voie : une pièce du graphe et l'abscisse (m depuis son port 0). */
export interface Stop {
  piece: number;
  u: number;
}

/** Choix à faire sur le chemin : devant `port` de `piece`, prendre la pièce `chosen`. */
export interface Decision {
  piece: number;
  port: 0 | 1;
  chosen: number;
  /** Distance (m) depuis le départ jusqu'à ce choix. */
  at: number;
}

export interface Route {
  /** Distance (m) depuis le point de départ jusqu'à l'arrêt. */
  distance: number;
  /** Pièces parcourues, dans l'ordre, avec le sens de marche (+1 vers le port 1). */
  steps: { piece: number; dir: 1 | -1 }[];
  decisions: Decision[];
}

interface Node {
  piece: number;
  dir: 1 | -1;
}
const keyOf = (n: Node): string => `${n.piece}:${n.dir}`;

/** Plus court chemin (en mètres de voie) de `from` à l'arrêt `to`, en roulant dans le sens de `from.dir`, ou null. */
export function findRoute(graph: TrackGraph, from: TrackPos, to: Stop): Route | null {
  const start = graph.byId.get(from.piece);
  const goal = graph.byId.get(to.piece);
  if (!start || !goal) return null;
  // Déjà sur la bonne pièce, et l'arrêt est devant : tout droit.
  if (from.piece === to.piece && (to.u - from.u) * from.dir >= 0)
    return {
      distance: Math.abs(to.u - from.u),
      steps: [{ piece: from.piece, dir: from.dir }],
      decisions: [],
    };

  const cost = new Map<string, number>(); // coût pour sortir de la pièce (état = pièce + sens)
  const prev = new Map<string, { from: string; decision: Decision | null }>();
  const heap: { key: string; node: Node; cost: number }[] = [];
  const push = (e: (typeof heap)[number]): void => {
    heap.push(e);
    heap.sort((a, b) => b.cost - a.cost); // petit tas : les graphes sont petits, l'ordre suffit
  };
  const first: Node = { piece: from.piece, dir: from.dir };
  const firstCost = from.dir === 1 ? lengthOfPiece(start) - from.u : from.u;
  cost.set(keyOf(first), firstCost);
  push({ key: keyOf(first), node: first, cost: firstCost });

  let best: { total: number; via: string; entry: Node; decision: Decision | null } | null = null;
  while (heap.length > 0) {
    const cur = heap.pop() as (typeof heap)[number];
    if (best && cur.cost >= best.total) break;
    if (cur.cost > (cost.get(cur.key) ?? Infinity)) continue;
    const piece = graph.byId.get(cur.node.piece);
    if (!piece) continue;
    const port = cur.node.dir === 1 ? 1 : 0;
    const links = graph.linksAt(cur.node.piece, port);
    const distinct = new Set(links.map((l) => baseId(l.piece))).size > 1;
    // Pointe d'un aiguillage : les deux voies d'une même pièce posée comptent comme un choix aussi.
    const choice = links.length > 1 || distinct;
    for (const l of links) {
      const next = graph.byId.get(l.piece);
      if (!next) continue;
      const nd: 1 | -1 = l.port === 0 ? 1 : -1;
      const decision: Decision | null = choice
        ? { piece: cur.node.piece, port, chosen: l.piece, at: cur.cost }
        : null;
      const node: Node = { piece: next.id, dir: nd };
      if (next.id === to.piece) {
        const into = nd === 1 ? to.u : lengthOfPiece(next) - to.u;
        const total = cur.cost + into;
        if (!best || total < best.total) best = { total, via: cur.key, entry: node, decision };
      }
      const through = cur.cost + lengthOfPiece(next);
      const k = keyOf(node);
      if (through < (cost.get(k) ?? Infinity)) {
        cost.set(k, through);
        prev.set(k, { from: cur.key, decision });
        push({ key: k, node, cost: through });
      }
    }
  }
  if (!best) return null;
  // Reconstruction : de l'état d'où l'on entre sur la pièce d'arrêt, en remontant jusqu'au départ.
  const steps: Route['steps'] = [{ piece: best.entry.piece, dir: best.entry.dir }];
  const decisions: Decision[] = best.decision ? [best.decision] : [];
  let k: string | undefined = best.via;
  while (k !== undefined) {
    const [pc, d] = k.split(':');
    steps.unshift({ piece: Number(pc), dir: Number(d) === 1 ? 1 : -1 });
    const p = prev.get(k);
    if (p?.decision) decisions.unshift(p.decision);
    k = p?.from;
  }
  return { distance: best.total, steps, decisions };
}

/** Vitesse de croisière du pilote (m/s) et décélération douce prévue pour s'arrêter (m/s²). */
export const AUTO_SPEED = 9;
const AUTO_DECEL = 0.5;
/** Distance (m) avant laquelle le convoi doit être arrêté sur le repère. */
const STOP_MARGIN = 0.25;

/**
 * Commande du convoi vers l'arrêt : accélérer jusqu'à la vitesse de croisière, puis freiner à temps pour s'arrêter sur
 * le repère (`remaining` : mètres restant à parcourir). Le frein est dosé sur la décélération nécessaire.
 */
export function autoControl(c: Consist, remaining: number, vMax = AUTO_SPEED): Control {
  const room = Math.max(remaining - STOP_MARGIN, 0);
  if (remaining <= STOP_MARGIN && Math.abs(c.v) < 0.25)
    return { throttle: 0, brake: 1, parked: true };
  const target = Math.min(vMax, Math.sqrt(2 * AUTO_DECEL * room));
  const required = (c.v * c.v) / (2 * Math.max(room, 0.05)); // décélération qu'il faudrait pour s'arrêter pile
  if (c.v > 0.05 && (required > AUTO_DECEL * 0.8 || c.v > target + 0.3))
    return { throttle: 0, brake: Math.min(1, required / BRAKE_DECEL + 0.08), parked: false };
  if (c.v < target - 0.15)
    return { throttle: Math.min(1, 0.3 + (target - c.v) * 0.5), brake: 0, parked: false };
  return { throttle: 0, brake: 0, parked: false };
}
