import { GARAGE_KIND } from '../data/buildings';
import { CELL_SIZE_M } from '../constants';
import type { Pieces } from './pieces';

/** Les segments (50 cm) d'une porte de garage forment une rangée contiguë de pièces `door_garage` sur un même bord. */
export interface GarageGroup {
  /** Clé du premier segment : identifiant de la porte (réglages, état ouvert). */
  anchor: string;
  /** Clés de tous les segments, dans l'ordre. */
  keys: string[];
  axis: 'x' | 'z';
  level: number;
  /** Ligne du bord (gz pour un mur le long de x, gx pour un mur le long de z) et index du premier / dernier segment. */
  line: number;
  i0: number;
  i1: number;
}

const KEY_RE = /^e:(-?\d+):(-?\d+),(-?\d+):([xz]):0$/;

const keyAt = (level: number, axis: 'x' | 'z', line: number, i: number): string =>
  axis === 'x' ? `e:${level}:${i},${line}:x:0` : `e:${level}:${line},${i}:z:0`;

/** La porte de garage à laquelle appartient ce segment, ou null si ce n'en est pas un. */
export function garageGroup(pieces: Pieces, key: string): GarageGroup | null {
  const m = KEY_RE.exec(key);
  if (!m || pieces[key] !== GARAGE_KIND) return null;
  const level = Number(m[1]);
  const axis = m[4] as 'x' | 'z';
  const line = Number(axis === 'x' ? m[3] : m[2]);
  const at = Number(axis === 'x' ? m[2] : m[3]);
  let i0 = at;
  let i1 = at;
  while (pieces[keyAt(level, axis, line, i0 - 1)] === GARAGE_KIND) i0--;
  while (pieces[keyAt(level, axis, line, i1 + 1)] === GARAGE_KIND) i1++;
  const keys: string[] = [];
  for (let i = i0; i <= i1; i++) keys.push(keyAt(level, axis, line, i));
  return { anchor: keys[0], keys, axis, level, line, i0, i1 };
}

/** Distance (m) d'un point (x, z) au segment que forme la porte de garage. */
export function distanceToGarage(g: GarageGroup, x: number, z: number): number {
  const a = g.i0 * CELL_SIZE_M;
  const b = (g.i1 + 1) * CELL_SIZE_M;
  const l = g.line * CELL_SIZE_M;
  const along = g.axis === 'x' ? x : z;
  const across = g.axis === 'x' ? z : x;
  const dAlong = Math.max(a - along, 0, along - b);
  return Math.hypot(dAlong, across - l);
}

/** Clé de l'indicateur « ouvert » d'un segment de bord. */
export const openKeyOf = (key: string): string | null => {
  const m = KEY_RE.exec(key);
  return m ? `o:${m[1]}:${m[2]},${m[3]}:${m[4]}` : null;
};
