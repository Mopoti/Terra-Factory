/**
 * Dernier périphérique utilisé : clavier / souris, ou manette. Le joueur peut passer de l'un à l'autre à tout
 * moment (ou les mélanger) : les textes d'aide affichent les touches du périphérique qu'il vient d'employer.
 */
export type Device = 'keyboard' | 'pad';

let current: Device = 'keyboard';
const listeners = new Set<(d: Device) => void>();

export function getDevice(): Device {
  return current;
}

export function noteDevice(device: Device): void {
  if (device === current) return;
  current = device;
  listeners.forEach((fn) => fn(device));
}

export function onDeviceChange(fn: (d: Device) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Écoute clavier et souris (les événements synthétiques, comme l'Échap de la manette, sont ignorés). */
export function trackKeyboardMouse(): () => void {
  const key = (e: KeyboardEvent): void => {
    if (e.isTrusted) noteDevice('keyboard');
  };
  const mouse = (e: MouseEvent): void => {
    if (e.isTrusted && (e.type !== 'mousemove' || Math.hypot(e.movementX, e.movementY) > 3))
      noteDevice('keyboard');
  };
  window.addEventListener('keydown', key, true);
  window.addEventListener('mousedown', mouse, true);
  window.addEventListener('mousemove', mouse, true);
  return () => {
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('mousedown', mouse, true);
    window.removeEventListener('mousemove', mouse, true);
  };
}
