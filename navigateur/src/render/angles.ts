/** Angle équivalent ramené dans ]−π, π]. */
export function wrapAngle(a: number): number {
  const turn = Math.PI * 2;
  let r = a % turn;
  if (r > Math.PI) r -= turn;
  if (r <= -Math.PI) r += turn;
  return r;
}

/** Angle le plus court de `from` vers `to`, avancé d'au plus `step` (radians). */
export function turnToward(from: number, to: number, step: number): number {
  const diff = wrapAngle(to - from);
  return from + Math.max(-step, Math.min(step, diff));
}

/** Cap (radians) d'un vecteur (dx, dz) : 0 vers +z, π/2 vers +x. */
export const bearingOf = (dx: number, dz: number): number => Math.atan2(dx, dz);
