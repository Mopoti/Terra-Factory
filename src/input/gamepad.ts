import type { Input } from './input';
import type { ActionId } from '../settings/controls';

/** Ce que la manette demande à un instant donné (disposition « standard » des navigateurs). */
export interface PadFrame {
  /** Actions maintenues. */
  held: Set<ActionId>;
  /** Regard (−1 à 1 par axe, zone morte retirée). */
  look: { x: number; y: number };
  /** Boutons qui viennent d'être pressés (une seule fois). */
  edges: Set<PadEdge>;
}
export type PadEdge = 'pause' | 'hotbarPrev' | 'hotbarNext' | 'accept' | 'back' | 'up' | 'down';

export interface PadState {
  buttons: readonly boolean[];
  axes: readonly number[];
}

export const STICK_DEADZONE = 0.2;
const MOVE_THRESHOLD = 0.4;

/** Boutons (disposition standard) → actions maintenues. */
const BUTTON_ACTIONS: Partial<Record<number, ActionId>> = {
  0: 'jump', // A
  2: 'use', // X
  1: 'crouch', // B
  3: 'cycleView', // Y
  7: 'interact', // gâchette droite : clic gauche
  6: 'secondary', // gâchette gauche : clic droit (démolir)
  10: 'sprint', // clic du stick gauche
  11: 'rotate', // clic du stick droit : tourner la pièce
  8: 'map', // Retour
  13: 'inventory', // croix bas
  12: 'techTree', // croix haut
  14: 'levelDown', // croix gauche
  15: 'levelUp', // croix droite
};
const EDGES: Partial<Record<number, PadEdge>> = { 9: 'pause', 4: 'hotbarPrev', 5: 'hotbarNext' };
/** Dans les menus : croix et boutons A / B. */
const UI_EDGES: Partial<Record<number, PadEdge>> = {
  0: 'accept',
  1: 'back',
  12: 'up',
  13: 'down',
  14: 'up',
  15: 'down',
};

export const withDeadzone = (v: number, zone = STICK_DEADZONE): number => {
  const a = Math.abs(v);
  if (a <= zone) return 0;
  return Math.sign(v) * Math.min(1, (a - zone) / (1 - zone));
};

/**
 * Traduit l'état d'une manette. `previous` sert à repérer les boutons « tout juste pressés » ; `ui` indique que
 * le jeu est en pause ou qu'une fenêtre est ouverte (la manette navigue alors dans les menus).
 */
export function readPad(state: PadState, previous: PadState | null, ui: boolean): PadFrame {
  const held = new Set<ActionId>();
  const edges = new Set<PadEdge>();
  const down = (i: number): boolean => state.buttons[i] === true;
  const was = (i: number): boolean => previous?.buttons[i] === true;
  if (!ui) {
    for (const [i, action] of Object.entries(BUTTON_ACTIONS))
      if (down(Number(i))) held.add(action!);
    const x = state.axes[0] ?? 0;
    const y = state.axes[1] ?? 0;
    if (y < -MOVE_THRESHOLD) held.add('forward');
    if (y > MOVE_THRESHOLD) held.add('backward');
    if (x < -MOVE_THRESHOLD) held.add('left');
    if (x > MOVE_THRESHOLD) held.add('right');
  }
  for (const [i, edge] of Object.entries(EDGES))
    if (down(Number(i)) && !was(Number(i))) edges.add(edge!);
  if (ui) {
    for (const [i, edge] of Object.entries(UI_EDGES))
      if (down(Number(i)) && !was(Number(i))) edges.add(edge!);
    // Le stick gauche navigue aussi (une impulsion à chaque bascule).
    const sy = state.axes[1] ?? 0;
    const py = previous?.axes[1] ?? 0;
    if (sy > MOVE_THRESHOLD && py <= MOVE_THRESHOLD) edges.add('down');
    if (sy < -MOVE_THRESHOLD && py >= -MOVE_THRESHOLD) edges.add('up');
  }
  const look = ui
    ? { x: 0, y: 0 }
    : { x: withDeadzone(state.axes[2] ?? 0), y: withDeadzone(state.axes[3] ?? 0) };
  return { held, look, edges };
}

export interface GamepadOptions {
  input: Input;
  /** Jeu en pause ou fenêtre ouverte : la manette navigue dans les menus au lieu de jouer. */
  inMenu(): boolean;
  /** Regard en pixels (à ajouter comme un mouvement de souris). */
  onLook(dx: number, dy: number): void;
  onHotbarStep(step: 1 | -1): void;
  /** Vitesse du regard à pleine inclinaison (pixels par seconde). */
  lookSpeed?: number;
}

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/** Déplace le focus dans l'interface (menus, fenêtres) d'un élément visible à l'autre. */
export function moveFocus(step: 1 | -1, root: ParentNode = document): void {
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (e) => !e.closest('.touch-ui') && !(e as HTMLButtonElement).disabled && e.offsetParent !== null,
  );
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next =
    at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  items[next].focus({ preventScroll: false });
}

/** Branche les manettes branchées : agit sur `Input` (actions virtuelles) et renvoie `dispose`. */
export function mountGamepad(options: GamepadOptions): { dispose(): void; active(): boolean } {
  const { input } = options;
  let raf = 0;
  let last = performance.now();
  let lastUsed = -1e9;
  const previous = new Map<number, PadState>();
  let applied = new Set<ActionId>();

  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
    const wanted = new Set<ActionId>();
    for (const pad of pads) {
      const state: PadState = {
        buttons: pad.buttons.map((b) => b.pressed),
        axes: [...pad.axes],
      };
      const ui = options.inMenu();
      const frame = readPad(state, previous.get(pad.index) ?? null, ui);
      previous.set(pad.index, state);
      for (const a of frame.held) wanted.add(a);
      if (frame.held.size > 0 || frame.edges.size > 0 || frame.look.x !== 0 || frame.look.y !== 0)
        lastUsed = now;
      const speed = options.lookSpeed ?? 700;
      if (frame.look.x !== 0 || frame.look.y !== 0)
        options.onLook(frame.look.x * speed * dt, frame.look.y * speed * dt);
      for (const edge of frame.edges) {
        if (edge === 'pause')
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        else if (edge === 'back')
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        else if (edge === 'hotbarPrev' && !ui) options.onHotbarStep(-1);
        else if (edge === 'hotbarNext' && !ui) options.onHotbarStep(1);
        else if (edge === 'up') moveFocus(-1);
        else if (edge === 'down') moveFocus(1);
        else if (edge === 'accept') (document.activeElement as HTMLElement | null)?.click?.();
      }
    }
    for (const a of applied) if (!wanted.has(a)) input.setVirtual(a, false);
    for (const a of wanted) if (!applied.has(a)) input.setVirtual(a, true);
    applied = wanted;
  };
  raf = requestAnimationFrame(tick);
  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      for (const a of applied) input.setVirtual(a, false);
      applied.clear();
    },
    /** Une manette a servi dans les 3 dernières secondes. */
    active: () => performance.now() - lastUsed < 3000,
  };
}
