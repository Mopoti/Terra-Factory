/** Calculs purs des caméras (sans Three.js) : faciles à tester. Angles en radians, distances en mètres. */

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Rapproche `current` de `target` indépendamment du nombre d'images par seconde. `rate` infini = instantané. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  if (!Number.isFinite(rate)) return target;
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Lissage de la caméra (0–100 %) -> vitesse de rattrapage. 0 % = instantané. */
export function smoothingRate(percent: number): number {
  if (percent <= 0) return Infinity;
  return lerp(40, 4, clamp(percent, 0, 100) / 100);
}

/** Ramène un angle dans ]-π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Angle le plus proche multiple de 90°. */
export function snapToQuarterTurn(yaw: number): number {
  return Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Direction du regard. `yaw` 0 = vers -z ; `pitchDown` > 0 = regarde vers le bas. */
export function lookDirection(yaw: number, pitchDown: number): Vec3 {
  const c = Math.cos(pitchDown);
  return { x: -Math.sin(yaw) * c, y: -Math.sin(pitchDown), z: -Math.cos(yaw) * c };
}

/** Position de la caméra autour de sa cible (derrière le joueur). `elevation` : angle au-dessus de l'horizon. */
export function orbitOffset(yaw: number, elevation: number, distance: number): Vec3 {
  const c = Math.cos(elevation);
  return {
    x: Math.sin(yaw) * c * distance,
    y: Math.sin(elevation) * distance,
    z: Math.cos(yaw) * c * distance,
  };
}

/** Défilement par les bords : -1…1 sur chaque axe (x : droite, y : haut). */
export function edgePan(
  mouseX: number,
  mouseY: number,
  width: number,
  height: number,
  zonePx = 36,
): { x: number; y: number } {
  const axis = (pos: number, size: number): number => {
    if (pos < zonePx) return -clamp((zonePx - pos) / zonePx, 0, 1);
    if (pos > size - zonePx) return clamp((pos - (size - zonePx)) / zonePx, 0, 1);
    return 0;
  };
  return { x: axis(mouseX, width), y: 0 - axis(mouseY, height) };
}

/**
 * Distance maximale que peut avoir la caméra le long d'un rayon sans entrer dans un obstacle.
 * `blockedAt(x, y, z)` dit si un point est dans le décor.
 */
export function limitCameraDistance(
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
  blockedAt: (x: number, y: number, z: number) => boolean,
  minDistance = 0.6,
  step = 0.25,
): number {
  for (let t = step; t <= maxDistance; t += step) {
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    const z = origin.z + direction.z * t;
    if (y < 0.25 || blockedAt(x, y, z)) return Math.max(minDistance, t - 0.3);
  }
  return maxDistance;
}

/** Rayon (en pixels) de l'aura de transparence : 100 % = 30 % de la hauteur de l'écran. */
export function ghostRadiusPx(percent: number, viewportHeightPx: number): number {
  return (clamp(percent, 0, 100) / 100) * 0.3 * viewportHeightPx;
}

/** Facteur appliqué à la distance à chaque cran de molette (vitesse du zoom 10–100 %). */
export function zoomFactor(speedPercent: number): number {
  return 1 + 0.2 * (clamp(speedPercent, 10, 100) / 50);
}

/** Opacité de l'aura : très transparent près du joueur, opaque à partir du rayon. */
export function ghostOpacity(distancePx: number, radiusPx: number): number {
  if (radiusPx <= 0) return 1;
  const t = clamp(distancePx / radiusPx, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return 0.08 + 0.92 * smooth;
}
