import { CELL_SIZE_M } from '../constants';

/**
 * Distance (m) entre le joueur et le bord le plus proche d'une emprise carrée de `cells` cases
 * dont le coin est la case (gx, gz). 0 si le joueur est dessus.
 */
export function distanceToFootprint(
  player: { x: number; z: number },
  gx: number,
  gz: number,
  cells: number,
): number {
  const minX = gx * CELL_SIZE_M;
  const minZ = gz * CELL_SIZE_M;
  const size = cells * CELL_SIZE_M;
  const dx = Math.max(minX - player.x, 0, player.x - (minX + size));
  const dz = Math.max(minZ - player.z, 0, player.z - (minZ + size));
  return Math.hypot(dx, dz);
}

export function isWithinReach(distanceM: number, reachM: number): boolean {
  return distanceM <= reachM;
}
