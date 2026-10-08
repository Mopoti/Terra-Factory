import { t, type TranslationKey } from '../i18n';
import type { Input } from '../input/input';
import type { ActionId } from '../settings/controls';

/** Écran tactile (téléphone, tablette) : on affiche les commandes à l'écran. `?touch=1` / `?touch=0` force le choix. */
export function isTouchMode(): boolean {
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export interface TouchOptions {
  input: Input;
  /** Déplacement de la caméra par glissement (pixels). */
  onLook(dx: number, dy: number): void;
  onPause(): void;
  /** Le monde 3D : un appui bref dessus compte comme un clic (poser une machine, viser). */
  canvas: HTMLElement;
}

/** Seuil du joystick (part du rayon) au-delà duquel une direction est « appuyée ». */
const STICK_THRESHOLD = 0.3;

const BUTTONS: { action: ActionId; key: string; hold?: boolean; toggle?: boolean }[] = [
  { action: 'jump', key: 'touch.jump', hold: true },
  { action: 'interact', key: 'touch.interact', hold: true },
  { action: 'use', key: 'touch.use', hold: true },
  { action: 'crouch', key: 'touch.crouch', toggle: true },
  { action: 'sprint', key: 'touch.sprint', toggle: true },
  { action: 'cycleView', key: 'touch.view', hold: true },
  { action: 'inventory', key: 'touch.inventory', hold: true },
  { action: 'map', key: 'touch.map', hold: true },
  { action: 'techTree', key: 'touch.tech', hold: true },
];

/** Commandes tactiles : joystick à gauche, glissement à droite pour la caméra, boutons d'action. Renvoie `dispose`. */
export function mountTouchControls(container: HTMLElement, options: TouchOptions): () => void {
  const { input } = options;
  const root = document.createElement('div');
  root.className = 'touch-ui';

  // --- Joystick de déplacement ---
  const stick = document.createElement('div');
  stick.className = 'touch-stick';
  const knob = document.createElement('div');
  knob.className = 'touch-knob';
  stick.append(knob);
  let stickId: number | null = null;
  const dirs: ActionId[] = ['forward', 'backward', 'left', 'right'];
  const release = (): void => {
    for (const d of dirs) input.setVirtual(d, false);
    knob.style.transform = '';
    stickId = null;
  };
  const moveStick = (e: PointerEvent): void => {
    const r = stick.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    input.setVirtual('forward', dy < -STICK_THRESHOLD);
    input.setVirtual('backward', dy > STICK_THRESHOLD);
    input.setVirtual('left', dx < -STICK_THRESHOLD);
    input.setVirtual('right', dx > STICK_THRESHOLD);
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  for (const type of ['pointerup', 'pointercancel'] as const)
    stick.addEventListener(type, (e) => {
      if (e.pointerId === stickId) release();
    });

  // --- Zone de caméra : on glisse le doigt ---
  const look = document.createElement('div');
  look.className = 'touch-look';
  let lookId: number | null = null;
  let last = { x: 0, y: 0 };
  let start = { x: 0, y: 0, at: 0 };
  let moved = 0;
  look.addEventListener('pointerdown', (e) => {
    lookId = e.pointerId;
    last = { x: e.clientX, y: e.clientY };
    start = { x: e.clientX, y: e.clientY, at: performance.now() };
    moved = 0;
    look.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    moved = Math.max(moved, Math.hypot(e.clientX - start.x, e.clientY - start.y));
    options.onLook((e.clientX - last.x) * 1.4, (e.clientY - last.y) * 1.4);
    last = { x: e.clientX, y: e.clientY };
  });
  look.addEventListener('pointerup', (e) => {
    if (e.pointerId !== lookId) return;
    lookId = null;
    // Appui bref sans glissement : un clic sur le monde (pose d'une machine…).
    if (moved < 10 && performance.now() - start.at < 350) {
      const at = { clientX: e.clientX, clientY: e.clientY, bubbles: true, button: 0 };
      for (const name of ['mousemove', 'mousedown', 'mouseup', 'click'])
        options.canvas.dispatchEvent(new MouseEvent(name, at));
    }
  });
  look.addEventListener('pointercancel', (e) => {
    if (e.pointerId === lookId) lookId = null;
  });

  // --- Boutons ---
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  for (const def of BUTTONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `touch-btn touch-${def.action}`;
    b.textContent = t(def.key as TranslationKey);
    if (def.toggle) {
      let on = false;
      b.addEventListener('pointerdown', (e) => {
        on = !on;
        input.setVirtual(def.action, on);
        b.classList.toggle('on', on);
        e.preventDefault();
      });
    } else {
      b.addEventListener('pointerdown', (e) => {
        input.setVirtual(def.action, true);
        b.classList.add('on');
        e.preventDefault();
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const)
        b.addEventListener(type, () => {
          input.setVirtual(def.action, false);
          b.classList.remove('on');
        });
    }
    pad.append(b);
  }
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'touch-btn touch-pause';
  pause.textContent = '☰';
  pause.setAttribute('aria-label', t('touch.pause'));
  pause.addEventListener('click', options.onPause);

  root.append(look, stick, pad, pause);
  container.append(root);
  document.body.classList.add('touch-mode');
  return () => {
    release();
    document.body.classList.remove('touch-mode');
    root.remove();
  };
}
