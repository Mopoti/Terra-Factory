/** Description des réglages affichés dans l'écran Paramètres (hors touches et langue). */

export interface SelectOption {
  value: string | number;
  /** Clé de traduction ; sinon `raw` est affiché tel quel. */
  label?: string;
  raw?: string;
}

export type Row =
  | { kind: 'range'; path: string; min: number; max: number; step: number; suffix?: string }
  | { kind: 'sound'; path: string; mutePath: string }
  | { kind: 'toggle'; path: string }
  | { kind: 'select'; path: string; options: SelectOption[] };

export interface Section {
  id: string;
  rows: Row[];
}

const range = (path: string, min: number, max: number, step: number, suffix = ''): Row => ({
  kind: 'range',
  path,
  min,
  max,
  step,
  suffix,
});
const toggle = (path: string): Row => ({ kind: 'toggle', path });
const select = (path: string, options: SelectOption[]): Row => ({ kind: 'select', path, options });
const sound = (name: string): Row => ({
  kind: 'sound',
  path: `sound.${name}`,
  mutePath: `sound.mute.${name}`,
});
const raws = (...values: string[]): SelectOption[] => values.map((v) => ({ value: v, raw: v }));
/** Options dont la clé de traduction est `opt.<valeur>`. */
const opts = (...values: string[]): SelectOption[] =>
  values.map((v) => ({ value: v, label: `opt.${v}` }));
/** Options dont la valeur enregistrée diffère de la clé de traduction : [valeur, clé]. */
const pairs = (...items: [string, string][]): SelectOption[] =>
  items.map(([value, label]) => ({ value, label: `opt.${label}` }));

const ghost = (view: string): Row[] => [
  toggle(`views.${view}.ghost`),
  range(`views.${view}.ghostRadius`, 10, 100, 5, '%'),
];

export const DISPLAY_SECTION: Section = {
  id: 'display',
  rows: [
    range('display.gamma', 0.5, 2, 0.05),
    range('display.brightness', 50, 150, 5, '%'),
    range('display.viewDistance', 2, 16, 1, ' chunks'),
    select('display.quality', opts('low', 'medium', 'high')),
    select(
      'display.shadows',
      pairs(['off', 'shadowsOff'], ['normal', 'shadowsNormal'], ['detailed', 'shadowsDetailed']),
    ),
    select('display.fpsLimit', [
      { value: 30, raw: '30' },
      { value: 60, raw: '60' },
      { value: 120, raw: '120' },
      { value: 0, label: 'opt.unlimited' },
    ]),
    range('display.uiScale', 80, 150, 5, '%'),
    select('display.timeFormat', pairs(['auto', 'timeAuto'], ['24h', 'time24'], ['12h', 'time12'])),
    select(
      'display.colorblind',
      pairs(
        ['none', 'cbNone'],
        ['protanopia', 'protanopia'],
        ['deuteranopia', 'deuteranopia'],
        ['tritanopia', 'tritanopia'],
      ),
    ),
    toggle('display.showFps'),
    toggle('display.showHealth'),
  ],
};

export const UNITS_SECTION: Section = {
  id: 'units',
  rows: [
    select('display.units.distance', raws('m', 'ft')),
    select('display.units.temperature', [
      { value: 'C', raw: '°C' },
      { value: 'F', raw: '°F' },
      { value: 'K', raw: 'K' },
    ]),
    select('display.units.mass', raws('kg', 'lb')),
    select('display.units.pressure', raws('Pa', 'bar', 'psi')),
    select('display.units.energy', [
      { value: 'SI', raw: 'J · W' },
      { value: 'kWh', raw: 'kWh · kW' },
    ]),
  ],
};

export const SOUND_SECTION: Section = {
  id: 'sound',
  rows: [
    sound('master'),
    sound('music'),
    sound('ambience'),
    sound('interaction'),
    sound('machines'),
    sound('alerts'),
    toggle('sound.muteInBackground'),
  ],
};

export const VIEW_SECTIONS: Section[] = [
  {
    id: 'common',
    rows: [
      range('views.common.mouseSensitivity', 1, 100, 1),
      toggle('views.common.invertY'),
      range('views.common.smoothing', 0, 100, 5, '%'),
    ],
  },
  {
    id: 'first',
    rows: [
      range('views.first.fov', 60, 120, 1, '°'),
      toggle('views.first.headBob'),
      range('views.first.headBobIntensity', 0, 100, 5, '%'),
      toggle('views.first.tilt'),
      toggle('views.first.showHands'),
      select(
        'views.first.crosshairStyle',
        pairs(['cross', 'cross'], ['dot', 'dot'], ['circle', 'circle'], ['none', 'crosshairNone']),
      ),
      range('views.first.crosshairSize', 10, 100, 5, '%'),
      select('views.first.crosshairColor', opts('white', 'orange', 'green', 'red', 'cyan')),
    ],
  },
  {
    id: 'third',
    rows: [
      range('views.third.fov', 50, 100, 1, '°'),
      range('views.third.distance', 1.5, 10, 0.5, ' m'),
      range('views.third.height', 0.5, 4, 0.1, ' m'),
      select(
        'views.third.shoulder',
        pairs(['left', 'shoulderLeft'], ['center', 'shoulderCenter'], ['right', 'shoulderRight']),
      ),
      toggle('views.third.collision'),
      toggle('views.third.autoRotate'),
      ...ghost('third'),
    ],
  },
  {
    id: 'top',
    rows: [
      range('views.top.angle', 30, 90, 1, '°'),
      range('views.top.zoomMin', 2, 20, 1, ' m'),
      range('views.top.zoomMax', 10, 100, 5, ' m'),
      range('views.top.zoomSpeed', 10, 100, 5, '%'),
      select(
        'views.top.rotation',
        pairs(['free', 'rotFree'], ['step', 'rotStep'], ['locked', 'rotLocked']),
      ),
      toggle('views.top.edgeScroll'),
      toggle('views.top.autoHideFloors'),
      ...ghost('top'),
    ],
  },
];

/** Boutons de la manette proposés (Start reste réservé à la pause). */
const PAD_BUTTONS: SelectOption[] = [
  { value: -1, label: 'opt.padNone' },
  ...['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Retour', '', 'L3', 'R3', '↑', '↓', '←', '→']
    .map((raw, i) => ({ value: i, raw }))
    .filter((o) => o.value !== 9),
];
const PAD_ACTIONS = [
  'jump',
  'use',
  'crouch',
  'cycleView',
  'interact',
  'secondary',
  'sprint',
  'rotate',
  'map',
  'inventory',
  'techTree',
  'levelDown',
  'levelUp',
] as const;

export const GAME_SECTION: Section = {
  id: 'game',
  rows: [
    select('game.autosaveMinutes', [
      { value: 0, label: 'opt.autosaveOff' },
      { value: 5, raw: '5 min' },
      { value: 10, raw: '10 min' },
      { value: 15, raw: '15 min' },
      { value: 30, raw: '30 min' },
    ]),
    range('game.autosaveKeep', 1, 20, 1),
    toggle('game.showTips'),
    toggle('game.confirmDelete'),
    range('game.touchScale', 70, 150, 5, '%'),
    toggle('game.touchLeftHanded'),
    range('game.padSensitivity', 20, 200, 10, '%'),
    range('game.padDeadzone', 5, 40, 5, '%'),
    ...PAD_ACTIONS.map((a) => select(`game.pad.${a}`, PAD_BUTTONS)),
  ],
};

export const ALL_SECTIONS: Section[] = [
  DISPLAY_SECTION,
  UNITS_SECTION,
  SOUND_SECTION,
  ...VIEW_SECTIONS,
  GAME_SECTION,
];

/** Toutes les lignes, indexées par chemin (pour valider et borner les valeurs enregistrées). */
export const ROW_BY_PATH: Map<string, Row> = new Map(
  ALL_SECTIONS.flatMap((s) => s.rows.map((r) => [r.path, r] as const)),
);
