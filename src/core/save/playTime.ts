/** Temps de jeu (secondes) découpé en heures, minutes et secondes. */
export function splitPlayTime(seconds: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
