import { getDevice, onDeviceChange, trackKeyboardMouse } from '../input/lastDevice';
import { setHintResolver, t, type TranslationKey } from '../i18n';
import { bindingLabel, type ActionId } from '../settings/controls';
import { getSettings } from '../settings/store';
import { isTouchMode } from './touchControls';

/** Boutons de la manette (disposition standard), tels qu'on les écrit dans les textes. */
const PAD_BUTTONS = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Retour',
  'Start',
  'L3',
  'R3',
  '↑',
  '↓',
  '←',
  '→',
];

const MOVES: readonly string[] = ['forward', 'backward', 'left', 'right'];
const TOUCH_NAMES: Record<string, string> = {
  interact: 'interact',
  cycleView: 'view',
  techTree: 'tech',
  jump: 'jump',
  use: 'use',
  crouch: 'crouch',
  sprint: 'sprint',
  inventory: 'inventory',
  map: 'map',
};

/** Bouton de manette d'une action, ou null si elle n'a pas de bouton. */
export function padLabel(action: string): string | null {
  if (MOVES.includes(action)) return t('pad.stickLeft');
  if (action === 'look') return t('pad.stickRight');
  if (action === 'pause') return 'Start';
  if (action.startsWith('hotbar')) return 'LB / RB';
  const asked = action === 'remove' ? 'secondary' : action;
  const button = (getSettings().game.pad as Record<string, number>)[asked];
  return button !== undefined && button >= 0 ? PAD_BUTTONS[button] : null;
}

/** Touche (ou combinaison) du clavier / de la souris d'une action, d'après les réglages du joueur. */
export function keyboardLabel(action: string): string {
  const pair = getSettings().controls[action as ActionId];
  const code = pair?.[0] ?? pair?.[1];
  return code
    ? bindingLabel(code, (k) => t(k as TranslationKey), getSettings().keyboard === 'zqsd')
    : '?';
}

/** Ce qu'il faut écrire dans un texte pour cette action : écran tactile, manette ou clavier, selon le dernier usage. */
export function actionLabel(action: string, device = getDevice()): string {
  if (isTouchMode()) {
    const name = MOVES.includes(action) ? 'stick' : TOUCH_NAMES[action];
    if (name) return t(`touch.${name}` as TranslationKey);
  }
  if (device === 'pad') return padLabel(action) ?? keyboardLabel(action);
  return keyboardLabel(action);
}

/** À appeler une fois au démarrage : les `{@action}` des textes suivent le dernier périphérique utilisé. */
export function installKeyHints(): void {
  setHintResolver((action) => actionLabel(action));
  trackKeyboardMouse();
}

export { getDevice, onDeviceChange };
