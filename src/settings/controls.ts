/**
 * Actions du jeu et touches associées.
 * Les touches sont stockées par POSITION PHYSIQUE (KeyboardEvent.code) : « Z » d'un clavier AZERTY
 * est au même endroit que « W » d'un QWERTY. Seul l'affichage dépend de la disposition du clavier.
 * Entrées spéciales : "Mouse0/1/2" (boutons), "WheelUp"/"WheelDown" (molette).
 * Combinaison : 2 entrées maximum reliées par « + », par exemple "Control+KeyC" ou "Shift+WheelUp".
 * Dans une combinaison, les modificateurs sont génériques (Shift, Control, Alt, Meta : gauche ou droite)
 * et l'ordre n'a pas d'importance : "KeyC+Control" = "Control+KeyC".
 */

export type KeyboardPreset = 'zqsd' | 'wasd';
export const KEYBOARD_PRESETS: readonly KeyboardPreset[] = ['zqsd', 'wasd'];
/** ZQSD (AZERTY) pour un navigateur en français, WASD (QWERTY) sinon. */
export function presetForLocale(locale: string): KeyboardPreset {
  return locale === 'fr' ? 'zqsd' : 'wasd';
}

export type Binding = string | null;
export type BindingPair = [Binding, Binding];

export const ACTION_CATEGORIES = [
  'movement',
  'views',
  'interaction',
  'ui',
  'build',
  'camera',
  'hotbar',
] as const;
export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

interface ActionDef {
  id: string;
  category: ActionCategory;
  /** Touches par défaut. « L:X » = la lettre X telle qu'elle est écrite sur le clavier du joueur. */
  defaults: [string | null, string | null];
  /** Non modifiable (réservé par l'interface). */
  fixed?: boolean;
}

const hotbar = (n: number): ActionDef => ({
  id: `hotbar${n}`,
  category: 'hotbar',
  defaults: [`Digit${n}`, null],
});

export const ACTIONS = [
  { id: 'forward', category: 'movement', defaults: ['L:MOVE_UP', null] },
  { id: 'backward', category: 'movement', defaults: ['L:S', null] },
  { id: 'left', category: 'movement', defaults: ['L:MOVE_LEFT', null] },
  { id: 'right', category: 'movement', defaults: ['L:D', null] },
  { id: 'jump', category: 'movement', defaults: ['Space', null] },
  { id: 'sprint', category: 'movement', defaults: ['ShiftLeft', null] },
  { id: 'crouch', category: 'movement', defaults: ['ControlLeft', null] },
  { id: 'cycleView', category: 'views', defaults: ['L:V', null] },
  { id: 'viewFirst', category: 'views', defaults: [null, null] },
  { id: 'viewThird', category: 'views', defaults: [null, null] },
  { id: 'viewTop', category: 'views', defaults: [null, null] },
  { id: 'interact', category: 'interaction', defaults: ['Mouse0', 'L:E'] },
  { id: 'secondary', category: 'interaction', defaults: ['Mouse2', null] },
  { id: 'drop', category: 'interaction', defaults: ['L:G', null] },
  { id: 'inventory', category: 'ui', defaults: ['Tab', 'L:I'] },
  { id: 'map', category: 'ui', defaults: ['L:M', null] },
  { id: 'techTree', category: 'ui', defaults: ['L:T', null] },
  { id: 'screenshot', category: 'ui', defaults: ['F2', null] },
  { id: 'pause', category: 'ui', defaults: ['Escape', null], fixed: true },
  { id: 'buildMode', category: 'build', defaults: ['L:B', null] },
  { id: 'rotate', category: 'build', defaults: ['L:R', null] },
  { id: 'remove', category: 'build', defaults: ['L:X', 'Delete'] },
  { id: 'copy', category: 'build', defaults: ['Control+L:C', null] },
  { id: 'paste', category: 'build', defaults: ['Control+L:V', null] },
  { id: 'undo', category: 'build', defaults: ['Control+L:Z', null] },
  { id: 'redo', category: 'build', defaults: ['Control+L:Y', null] },
  { id: 'zoomIn', category: 'camera', defaults: ['WheelUp', 'Equal'] },
  { id: 'zoomOut', category: 'camera', defaults: ['WheelDown', 'Minus'] },
  { id: 'rotateLeft', category: 'camera', defaults: ['ArrowLeft', null] },
  { id: 'rotateRight', category: 'camera', defaults: ['ArrowRight', null] },
  hotbar(1),
  hotbar(2),
  hotbar(3),
  hotbar(4),
  hotbar(5),
  hotbar(6),
  hotbar(7),
  hotbar(8),
  hotbar(9),
] as const satisfies readonly ActionDef[];

export type ActionId = (typeof ACTIONS)[number]['id'];
export type ControlsSettings = Record<ActionId, BindingPair>;
export const ACTION_IDS = ACTIONS.map((a) => a.id) as ActionId[];

/** Lettre -> code physique, d'après la disposition du clavier du joueur (si connue). */
type LayoutMap = { entries(): IterableIterator<[string, string]> };
let reverseLayout: Map<string, string> | null = null;

/** À appeler une fois au démarrage : lit la disposition réelle du clavier (Chrome/Edge). */
export async function initKeyboardLayout(): Promise<LayoutMap | null> {
  try {
    const kb = (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<LayoutMap> } })
      .keyboard;
    if (!kb) return null;
    const map = await Promise.race<LayoutMap | null>([
      kb.getLayoutMap(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    if (map) setLayout(map);
    return map;
  } catch {
    return null;
  }
}

let currentLayout: LayoutMap | null = null;
function setLayout(map: LayoutMap | null): void {
  currentLayout = map;
  reverseLayout = null;
  if (map) {
    reverseLayout = new Map();
    for (const [code, key] of map.entries()) {
      if (key.length === 1 && !code.startsWith('Digit') && !code.startsWith('Numpad')) {
        const letter = key.toUpperCase();
        if (!reverseLayout.has(letter) || code.startsWith('Key')) reverseLayout.set(letter, code);
      }
    }
  }
}

/** Pour les tests. */
export function setLayoutForTests(map: LayoutMap | null): void {
  setLayout(map);
}

/** Disposition AZERTY supposée quand le navigateur ne la donne pas (langue française). */
const AZERTY_LETTER_TO_CODE: Record<string, string> = {
  A: 'KeyQ',
  Z: 'KeyW',
  Q: 'KeyA',
  W: 'KeyZ',
  M: 'Semicolon',
};

function letterToCode(letter: string, assumeAzerty: boolean): string {
  const fromLayout = reverseLayout?.get(letter);
  if (fromLayout) return fromLayout;
  if (assumeAzerty && AZERTY_LETTER_TO_CODE[letter]) return AZERTY_LETTER_TO_CODE[letter];
  return `Key${letter}`;
}

/** Touches par défaut pour un type de clavier. */
export function defaultControls(preset: KeyboardPreset): ControlsSettings {
  const french = preset === 'zqsd';
  const resolvePart = (token: string): string => {
    if (!token.startsWith('L:')) return token;
    let letter = token.slice(2);
    if (letter === 'MOVE_UP') letter = french ? 'Z' : 'W';
    if (letter === 'MOVE_LEFT') letter = french ? 'Q' : 'A';
    return letterToCode(letter, french);
  };
  const resolve = (token: string | null): Binding =>
    token === null ? null : normalizeBinding(token.split('+').map(resolvePart));
  const result = {} as ControlsSettings;
  for (const a of ACTIONS) result[a.id] = [resolve(a.defaults[0]), resolve(a.defaults[1])];
  return result;
}

/** Vrai si les touches ne sont plus celles du préréglage (le joueur a personnalisé quelque chose). */
export function isCustomized(controls: ControlsSettings, preset: KeyboardPreset): boolean {
  const defaults = defaultControls(preset);
  return ACTION_IDS.some((id) => controls[id].some((b, i) => b !== defaults[id][i]));
}

// --- Combinaisons --------------------------------------------------------------------------

const MODIFIERS: Record<string, string> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
};
const GENERIC_MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

export const MAX_COMBO_PARTS = 2;

function partRank(part: string): number {
  if (GENERIC_MODIFIERS.has(part)) return 0;
  return part.startsWith('Mouse') || part.startsWith('Wheel') ? 2 : 1;
}

/** Forme unique d'une touche ou combinaison (pour comparer, enregistrer, détecter les conflits). */
export function normalizeBinding(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return parts
    .slice(0, MAX_COMBO_PARTS)
    .map((p) => MODIFIERS[p] ?? p)
    .sort((a, b) => partRank(a) - partRank(b) || a.localeCompare(b))
    .join('+');
}

export function splitBinding(binding: string): string[] {
  return binding.split('+');
}

/** Valide une valeur lue dans le stockage : 1 ou 2 parties, caractères simples, forme normalisée. */
export function isValidBinding(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 60) return false;
  const parts = value.split('+');
  return (
    parts.length <= MAX_COMBO_PARTS &&
    parts.every((p) => /^[A-Za-z0-9]{1,24}$/.test(p)) &&
    normalizeBinding(parts) === value
  );
}

export function isFixed(id: ActionId): boolean {
  return ACTIONS.some((a) => a.id === id && 'fixed' in a && a.fixed);
}

/** Autre emplacement qui utilise déjà cette touche, s'il y en a un. */
export function findConflict(
  controls: ControlsSettings,
  code: string,
  except: { action: ActionId; slot: 0 | 1 },
): { action: ActionId; slot: 0 | 1 } | null {
  for (const id of ACTION_IDS) {
    for (const slot of [0, 1] as const) {
      if (id === except.action && slot === except.slot) continue;
      if (controls[id][slot] === code) return { action: id, slot };
    }
  }
  return null;
}

/** Texte lisible d'une touche ou combinaison. `t` fournit les noms traduits ; `assumeAzerty` sert si la disposition est inconnue. */
export function bindingLabel(
  binding: string,
  t: (key: string) => string,
  assumeAzerty = false,
): string {
  return splitBinding(binding)
    .map((part) => partLabel(part, t, assumeAzerty))
    .join(' + ');
}

function partLabel(code: string, t: (key: string) => string, assumeAzerty: boolean): string {
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const known: Record<string, string> = {
    Mouse0: 'key.mouse0',
    Mouse1: 'key.mouse1',
    Mouse2: 'key.mouse2',
    WheelUp: 'key.wheelUp',
    WheelDown: 'key.wheelDown',
    Space: 'key.space',
    ShiftLeft: 'key.shift',
    ShiftRight: 'key.shift',
    Shift: 'key.shift',
    ControlLeft: 'key.ctrl',
    ControlRight: 'key.ctrl',
    Control: 'key.ctrl',
    AltLeft: 'key.alt',
    AltRight: 'key.alt',
    Alt: 'key.alt',
    MetaLeft: 'key.meta',
    MetaRight: 'key.meta',
    Meta: 'key.meta',
    Tab: 'key.tab',
    Escape: 'key.escape',
    Delete: 'key.delete',
    Backspace: 'key.backspace',
    Enter: 'key.enter',
  };
  if (known[code]) return t(known[code]);
  const arrows: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
  };
  if (arrows[code]) return arrows[code];
  if (currentLayout) {
    const label = new Map(currentLayout.entries()).get(code);
    if (label && label.length === 1) return label.toUpperCase();
  } else if (assumeAzerty) {
    const hit = Object.entries(AZERTY_LETTER_TO_CODE).find(([, c]) => c === code);
    if (hit) return hit[0];
  }
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}
