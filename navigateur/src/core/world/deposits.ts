/**
 * Filons : un filon est un groupe de cases de minerai du même type qui se touchent (par un côté). On le retrouve en
 * partant d'une case et en suivant ses voisines, ce qui donne sa quantité totale (pour l'info-bulle de la carte).
 */

export interface OreLookup {
  (gx: number, gz: number): { id: string; amount: number } | null;
}

export interface DepositInfo {
  id: string;
  /** Minerai restant dans tout le filon. */
  total: number;
  /** Nombre de cases du filon. */
  cells: number;
  /** Vrai si le parcours s'est arrêté avant la fin (filon énorme) : le total est alors un minimum. */
  truncated: boolean;
}

/** Limite de cases parcourues : un filon de 120 m de rayon en fait environ 180 000. */
export const MAX_DEPOSIT_CELLS = 250_000;

/** Quantité totale du filon qui contient la case (gx, gz), ou null s'il n'y a pas de minerai dessus. */
export function depositInfo(
  oreAt: OreLookup,
  gx: number,
  gz: number,
  maxCells = MAX_DEPOSIT_CELLS,
): DepositInfo | null {
  const start = oreAt(gx, gz);
  if (!start || start.amount <= 0) return null;
  const seen = new Set<string>([`${gx},${gz}`]);
  const stack: [number, number][] = [[gx, gz]];
  let total = 0;
  let cells = 0;
  let truncated = false;
  while (stack.length > 0) {
    const [x, z] = stack.pop() as [number, number];
    const here = oreAt(x, z);
    if (!here || here.id !== start.id || here.amount <= 0) continue;
    total += here.amount;
    cells++;
    if (cells >= maxCells) {
      truncated = true;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${x + dx},${z + dz}`;
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push([x + dx, z + dz]);
    }
  }
  return { id: start.id, total, cells, truncated };
}
