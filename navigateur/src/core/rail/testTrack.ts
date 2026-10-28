/** Aides des tests : des voies faciles à construire avec les pièces de la refonte (voir `docs/rails-refonte.md`). */
import { GameState } from '../game/state';
import { candidatesFrom } from './place';
import { TILE_M, portsOf, type Port, type RailKind, type RailPiece } from './track';

/** Une voie droite de `n` pièces de 2,5 m vers −z (cap 4) : la pièce k part de z − k·2,5, son port 1 regarde vers −z. */
export const line = (n: number, x = 0, z = 0): RailPiece[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    kind: 'straight' as const,
    x,
    z: z - TILE_M * k,
    h: 4,
    level: 0,
  }));

/** Pièce du type `kind` raccordée à un port libre (pour un droit, un virage à gauche ou à droite). */
export function attach(kind: RailKind, port: Port, id: number, tilt: -1 | 0 | 1 = 0): RailPiece {
  const c = candidatesFrom(port, tilt).find((m) => m.kind === kind);
  if (!c) throw new Error(`pas de ${kind} possible sur ce port`);
  return { id, kind, x: c.x, z: c.z, h: c.h, level: c.level };
}

/** Pose, dans une partie, `n` droits vers −z (cap 4) à partir de (x, z). */
export function placeLine(s: GameState, n: number, x = 0, z = 0): void {
  for (let k = 0; k < n; k++) s.placeRail('straight', x, z - TILE_M * k, 4, 0, () => false);
}

/** Pose, dans une partie, une pièce `kind` raccordée au port donné ; renvoie la pièce posée ou null. */
export function placeAt(s: GameState, kind: RailKind, port: Port): RailPiece | null {
  const c = candidatesFrom(port, 0).find((m) => m.kind === kind);
  if (!c) return null;
  return s.placeRail(kind, c.x, c.z, c.h, c.level, () => false) === 'ok'
    ? s.changes.rails[s.changes.rails.length - 1]
    : null;
}

/** Les deux ports d'une pièce de la partie. */
export const portsOfId = (s: GameState, id: number): Port[] =>
  portsOf(s.changes.rails.find((p) => p.id === id) as RailPiece);
