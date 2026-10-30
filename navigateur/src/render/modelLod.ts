/**
 * Niveaux de détail des modèles de décor (arbres, buissons, rochers, minerais) : les modèles « style doux » ont
 * plusieurs fois plus de triangles que les anciens, et le monde en porte des milliers. Loin du joueur, on les remplace
 * par une version simplifiée (regroupement de sommets sur une grille : les sommets proches fusionnent, les triangles
 * écrasés disparaissent). Calculé une fois par modèle et par niveau.
 */
interface Geometry {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
  min: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

/** Part des triangles gardée à chaque niveau : 1 = assez loin, 2 = très loin. */
const KEEP: Record<1 | 2, number> = { 1: 0.3, 2: 0.07 };
/** En dessous, un modèle est déjà assez simple : on le garde tel quel. */
const MIN_TRIANGLES = 60;
/** Finesse de la grille (cases le long de la plus grande dimension), de la plus fine à la plus grossière. */
const GRIDS = [48, 36, 28, 22, 17, 13, 10, 8, 6, 5, 4];

const cache = new WeakMap<object, Partial<Record<1 | 2, Geometry>>>();

/** Regroupe les sommets d'une même case de la grille (moyenne des positions, normales et couleurs). */
export function cluster<T extends Geometry>(m: T, cell: number): Geometry {
  const n = m.positions.length / 3;
  const cellOf = new Map<string, number>();
  const remap = new Uint32Array(n);
  const sums: {
    p: [number, number, number];
    nr: [number, number, number];
    c: [number, number, number];
    k: number;
  }[] = [];
  for (let i = 0; i < n; i++) {
    const x = m.positions[i * 3];
    const y = m.positions[i * 3 + 1];
    const z = m.positions[i * 3 + 2];
    const key = `${Math.floor((x - m.min.x) / cell)},${Math.floor((y - m.min.y) / cell)},${Math.floor((z - m.min.z) / cell)}`;
    let id = cellOf.get(key);
    if (id === undefined) {
      id = sums.length;
      cellOf.set(key, id);
      sums.push({ p: [0, 0, 0], nr: [0, 0, 0], c: [0, 0, 0], k: 0 });
    }
    remap[i] = id;
    const s = sums[id];
    s.p[0] += x;
    s.p[1] += y;
    s.p[2] += z;
    s.nr[0] += m.normals[i * 3];
    s.nr[1] += m.normals[i * 3 + 1];
    s.nr[2] += m.normals[i * 3 + 2];
    s.c[0] += m.colors[i * 3];
    s.c[1] += m.colors[i * 3 + 1];
    s.c[2] += m.colors[i * 3 + 2];
    s.k++;
  }
  const index: number[] = [];
  for (let t = 0; t + 2 < m.index.length; t += 3) {
    const a = remap[m.index[t]];
    const b = remap[m.index[t + 1]];
    const c = remap[m.index[t + 2]];
    if (a !== b && b !== c && a !== c) index.push(a, b, c);
  }
  // On ne garde que les sommets encore utilisés.
  const used = new Map<number, number>();
  const keep: number[] = [];
  const finalIndex = new Uint32Array(index.length);
  index.forEach((v, i) => {
    let u = used.get(v);
    if (u === undefined) {
      u = keep.length;
      used.set(v, u);
      keep.push(v);
    }
    finalIndex[i] = u;
  });
  const positions = new Float32Array(keep.length * 3);
  const normals = new Float32Array(keep.length * 3);
  const colors = new Float32Array(keep.length * 3);
  keep.forEach((v, i) => {
    const s = sums[v];
    for (let k = 0; k < 3; k++) {
      positions[i * 3 + k] = s.p[k] / s.k;
      colors[i * 3 + k] = s.c[k] / s.k;
    }
    const len = Math.hypot(s.nr[0], s.nr[1], s.nr[2]) || 1;
    for (let k = 0; k < 3; k++) normals[i * 3 + k] = s.nr[k] / len;
  });
  return { positions, normals, colors, index: finalIndex, min: m.min, size: m.size };
}

/** Version simplifiée d'un modèle (ou le modèle lui-même s'il est déjà léger). */
export function lowDetail<T extends Geometry>(m: T, level: 1 | 2): Geometry {
  const triangles = m.index.length / 3;
  if (triangles <= MIN_TRIANGLES) return m;
  let known = cache.get(m);
  if (!known) cache.set(m, (known = {}));
  const have = known[level];
  if (have) return have;
  const target = triangles * KEEP[level];
  const biggest = Math.max(m.size.x, m.size.y, m.size.z) || 1;
  let result: Geometry = m;
  for (const grid of GRIDS) {
    result = cluster(m, biggest / grid);
    if (result.index.length / 3 <= target) break;
  }
  known[level] = result;
  return result;
}
