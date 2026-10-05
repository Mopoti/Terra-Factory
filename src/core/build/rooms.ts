import { MAX_ROOM_CELLS } from '../data/buildings';
import { parseKey, pieceKey, type Pieces } from './pieces';

/** Une pièce : un espace fermé (murs, portes, sol et plafond complets) avec au moins une porte. */
export interface Room {
  /** Identifiant stable tant que la pièce ne change pas de forme : « étage:gx,gz » de sa première case. */
  id: string;
  level: number;
  /** Cases « gx,gz ». */
  cells: string[];
  doors: number;
}

const at = (level: number, gx: number, gz: number, axis: 'x' | 'z'): string =>
  pieceKey({ slot: 'edge', level, gx, gz, axis });
const cellAt = (slot: 'floor' | 'ceiling', level: number, gx: number, gz: number): string =>
  pieceKey({ slot, level, gx, gz });

/** Détecte toutes les pièces. Relancé après chaque modification (le calcul est borné par la taille max). */
export function detectRooms(pieces: Pieces): Room[] {
  const rooms: Room[] = [];
  const seen = new Set<string>();
  const floors = Object.keys(pieces)
    .filter((k) => k.startsWith('f:'))
    .sort();
  for (const key of floors) {
    const start = parseKey(key);
    if (!start || seen.has(key)) continue;
    const { level } = start;
    const cells: string[] = [];
    const queue: [number, number][] = [[start.gx, start.gz]];
    const visited = new Set<string>([`${start.gx},${start.gz}`]);
    let closed = true;
    const doorEdges = new Set<string>();
    while (queue.length > 0 && closed) {
      const [gx, gz] = queue.pop() as [number, number];
      if (!pieces[cellAt('floor', level, gx, gz)] || !pieces[cellAt('ceiling', level, gx, gz)]) {
        closed = false;
        break;
      }
      cells.push(`${gx},${gz}`);
      if (cells.length > MAX_ROOM_CELLS) {
        closed = false;
        break;
      }
      const sides: [string, number, number][] = [
        [at(level, gx, gz, 'x'), gx, gz - 1],
        [at(level, gx, gz + 1, 'x'), gx, gz + 1],
        [at(level, gx, gz, 'z'), gx - 1, gz],
        [at(level, gx + 1, gz, 'z'), gx + 1, gz],
      ];
      for (const [edge, nx, nz] of sides) {
        const piece = pieces[edge];
        if (piece === 'door') doorEdges.add(edge);
        if (piece) continue;
        const nk = `${nx},${nz}`;
        if (visited.has(nk)) continue;
        visited.add(nk);
        queue.push([nx, nz]);
      }
    }
    for (const v of visited) {
      const [vx, vz] = v.split(',').map(Number);
      seen.add(cellAt('floor', level, vx, vz));
    }
    const doors = doorEdges.size;
    if (closed && doors > 0) {
      cells.sort((a, b) => {
        const [ax, az] = a.split(',').map(Number);
        const [bx, bz] = b.split(',').map(Number);
        return ax - bx || az - bz;
      });
      rooms.push({ id: `${level}:${cells[0]}`, level, cells, doors });
    }
  }
  return rooms;
}

/** La pièce qui contient cette case, s'il y en a une. */
export function roomAt(rooms: Room[], level: number, gx: number, gz: number): Room | null {
  const k = `${gx},${gz}`;
  return rooms.find((r) => r.level === level && r.cells.includes(k)) ?? null;
}
