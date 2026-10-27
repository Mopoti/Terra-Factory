import { treeParents, type TechDef } from '../core/data/techs';

export const NODE_W = 132;
export const NODE_H = 60;
const GAP_Y = 44;
const MARGIN = 14;
const RELAY_W = 10;
const RELAY_GAP = 4;
const NODE_GAP = 12;
const CORNER = 5;

export interface TreeEdge {
  from: string;
  to: string;
  /** Découvertes reliées (un lien long compte plusieurs tronçons, tous marqués des mêmes extrémités). */
  /** Tracé orthogonal (SVG) : un couloir horizontal par parent entre deux rangées. */
  path: string;
}

export interface TreeLayout {
  pos: Map<string, { x: number; y: number }>;
  edges: TreeEdge[];
  width: number;
  height: number;
}

interface Slot {
  id: string | null;
  w: number;
  gap: number;
  x: number;
  y: number;
}

/**
 * Arbre en rangées de haut en bas : la rangée d'une découverte est son plus long chemin depuis les racines ; un lien
 * qui saute des rangées passe par des relais (pour ne pas traverser les cases) ; l'ordre dans les rangées réduit les
 * croisements. Les liens déjà impliqués par un autre prérequis ne sont pas tracés.
 */
export function layoutTree(techs: readonly TechDef[]): TreeLayout {
  const ids = techs.map((t) => t.id);
  const known = new Set(ids);
  const parents = new Map(techs.map((t) => [t.id, treeParents(t).filter((p) => known.has(p))]));
  const ancestors = new Map<string, Set<string>>();
  const ancOf = (k: string): Set<string> => {
    let s = ancestors.get(k);
    if (!s) {
      s = new Set();
      for (const p of parents.get(k) ?? []) {
        s.add(p);
        for (const a of ancOf(p)) s.add(a);
      }
      ancestors.set(k, s);
    }
    return s;
  };
  const direct = new Map(
    ids.map((k) => {
      const ps = parents.get(k) ?? [];
      return [k, ps.filter((p) => !ps.some((o) => o !== p && ancOf(o).has(p)))] as const;
    }),
  );
  const level = new Map<string, number>();
  const depth = (k: string): number => {
    let d = level.get(k);
    if (d === undefined) {
      d = Math.max(-1, ...(direct.get(k) ?? []).map(depth)) + 1;
      level.set(k, d);
    }
    return d;
  };
  ids.forEach(depth);
  const rowCount = Math.max(0, ...level.values()) + 1;
  const rows: Slot[][] = Array.from({ length: rowCount }, () => []);
  const slotOf = new Map<string, Slot>();
  for (const k of ids) {
    const s: Slot = { id: k, w: NODE_W, gap: NODE_GAP, x: 0, y: 0 };
    slotOf.set(k, s);
    rows[level.get(k) ?? 0].push(s);
  }
  const segs: [Slot, Slot, string, string][] = [];
  const ups = new Map<Slot, Slot[]>();
  const downs = new Map<Slot, Slot[]>();
  const link = (a: Slot, b: Slot, from: string, to: string): void => {
    segs.push([a, b, from, to]);
    (downs.get(a) ?? downs.set(a, []).get(a))?.push(b);
    (ups.get(b) ?? ups.set(b, []).get(b))?.push(a);
  };
  for (const k of ids)
    for (const d of direct.get(k) ?? []) {
      let prev = slotOf.get(d) as Slot;
      for (let r = (level.get(d) ?? 0) + 1; r < (level.get(k) ?? 0); r++) {
        const relay: Slot = { id: null, w: RELAY_W, gap: RELAY_GAP, x: 0, y: 0 };
        rows[r].push(relay);
        link(prev, relay, d, k);
        prev = relay;
      }
      link(prev, slotOf.get(k) as Slot, d, k);
    }
  const span = (r: Slot[]): number =>
    r.reduce((t, o) => t + o.w + o.gap, 0) - (r.length ? r[r.length - 1].gap : 0);
  const widest = Math.max(0, ...rows.map(span));
  rows.forEach((r) => {
    let x = (widest - span(r)) / 2;
    for (const o of r) {
      o.x = x;
      x += o.w + o.gap;
    }
  });
  const mean = (list: Slot[] | undefined, f: (s: Slot) => number): number | null =>
    list?.length ? list.reduce((t, s) => t + f(s), 0) / list.length : null;
  const order = [...rows.keys()];
  for (let it = 0; it < 6; it++) {
    const index = new Map<Slot, number>();
    rows.forEach((r) => r.forEach((o, i) => index.set(o, i)));
    for (const r of it % 2 ? [...order].reverse() : order) {
      const near = it % 2 ? downs : ups;
      const key = new Map(
        rows[r].map((o, i) => [o, mean(near.get(o), (s) => index.get(s) ?? 0) ?? i]),
      );
      rows[r].sort((a, b) => (key.get(a) ?? 0) - (key.get(b) ?? 0));
      rows[r].forEach((o, i) => index.set(o, i));
    }
  }
  const centre = (o: Slot): number => o.x + o.w / 2;
  for (let it = 0; it < 8; it++)
    for (const r of it % 2 ? [...order].reverse() : order) {
      const row = rows[r];
      const want = row.map((o) => {
        const around = [...(ups.get(o) ?? []), ...(downs.get(o) ?? [])];
        return mean(around, centre) ?? centre(o);
      });
      let x = 0;
      row.forEach((o, i) => {
        o.x = Math.max(x, want[i] - o.w / 2);
        x = o.x + o.w + o.gap;
      });
      x = widest;
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i].x + row[i].w > x) row[i].x = x - row[i].w;
        x = row[i].x - (i ? row[i - 1].gap : 0);
      }
    }
  rows.forEach((r, i) =>
    r.forEach((o) => {
      o.x += MARGIN;
      o.y = MARGIN + i * (NODE_H + GAP_Y);
    }),
  );
  const rowIndex = new Map<Slot, number>();
  rows.forEach((r) => r.forEach((o, i) => rowIndex.set(o, i)));
  const edges: TreeEdge[] = segs.map(([a, b, from, to]) => {
    const x1 = a.x + a.w / 2;
    const y1 = a.y + (a.id ? NODE_H : 5);
    const x2 = b.x + b.w / 2;
    const y2 = b.y + (b.id ? 0 : 5);
    const lane = y1 + 10 + ((rowIndex.get(a) ?? 0) % 5) * 6;
    const dir = x2 > x1 ? 1 : -1;
    const path =
      x1 === x2
        ? `M${x1} ${y1}V${y2}`
        : `M${x1} ${y1}V${lane - CORNER}q0 ${CORNER} ${dir * CORNER} ${CORNER}H${x2 - dir * CORNER}q${dir * CORNER} 0 ${dir * CORNER} ${CORNER}V${y2}`;
    return { from, to, path };
  });
  const pos = new Map<string, { x: number; y: number }>();
  for (const [k, s] of slotOf) pos.set(k, { x: s.x, y: s.y });
  return {
    pos,
    edges,
    width: widest + 2 * MARGIN,
    height: rowCount * (NODE_H + GAP_Y) - GAP_Y + 2 * MARGIN,
  };
}
