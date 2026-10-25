import type { SaveLibrary } from '../core/save/library';
import { hashPassword } from '../core/net/password';
import {
  DEFAULT_GAME_OPTIONS,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  GAME_MODES,
  REALISM_LEVELS,
  type Difficulty,
  type GameMode,
  MAX_PLAYERS,
  type GameOptions,
  type GameSummary,
  type Realism,
} from '../core/save/saveIndex';
import { MIN_SHARE, SEASON_IDS, type TimeSettings } from '../core/game/seasons';
import { RESOURCES, resourceById, type DepositResource } from '../core/data/resources';
import { BIOME_COLORS, BIOME_IDS } from '../core/world/biomes';
import { PreviewRenderer } from '../core/world/preview';
import {
  DEFAULT_SAFE_ZONE_M,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  SAFE_ZONE_MAX_M,
  SAFE_ZONE_MIN_M,
  WorldGenerator,
  defaultWorldParams,
  type ResourceParams,
} from '../core/world/worldgen';
import { getLocale, t, type TranslationKey } from '../i18n';

const CRITERIA = ['frequency', 'size', 'density'] as const;
type Criterion = (typeof CRITERIA)[number];

/** Icône « mélanger » (deux flèches qui se croisent). */
const SHUFFLE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';
const MODE_ICONS: Record<GameMode, string> = {
  survival:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6z"/></svg>',
  creative:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/></svg>',
};

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Seed aléatoire lisible (sans caractères ambigus). Le hasard est permis ici : c'est de l'interface, pas du monde. */
export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join('');
}

/** Mot décrivant un multiplicateur (×0,25 à ×3). */
export function levelOf(multiplier: number): 'veryLow' | 'low' | 'normal' | 'high' | 'veryHigh' {
  if (multiplier < 0.45) return 'veryLow';
  if (multiplier < 0.9) return 'low';
  if (multiplier <= 1.1) return 'normal';
  if (multiplier < 2) return 'high';
  return 'veryHigh';
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = 'menu-btn'): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const times = (v: number): string =>
  `×${v.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface GameEditor {
  element: HTMLElement;
  /** Arrête les calculs de l'aperçu (à appeler quand l'écran est quitté). */
  dispose(): void;
}

export interface GameEditorContext {
  saves: SaveLibrary;
  defaultName: string;
  onLaunch(game: GameSummary): void;
  onBack(): void;
}

/** Ressources du tableau « Minerais » : les gisements, les plus proches du départ d'abord. */
const ORE_IDS = RESOURCES.filter((r): r is DepositResource => r.kind === 'deposit')
  .sort((a, b) => (a.minDistanceM ?? 0) - (b.minDistanceM ?? 0))
  .map((r) => r.id);
/** Ressources du tableau « Environnement ». */
const ENV_IDS = ['tree', 'fiber_bush', 'rock', 'water', 'nest'];

/** Rayon d'aperçu (chunks de 8 m) et son côté en mètres, pour le texte d'aide. */
const PREVIEW_SIZE_M = 512;

/** Écran d'édition d'une nouvelle partie : monde, trois onglets de réglages (minerais, environnement, jouabilité), aperçu. */
export function buildGameEditor(ctx: GameEditorContext): GameEditor {
  const base = defaultWorldParams('');
  const resources: ResourceParams = structuredClone(base.resources ?? {});
  const options: GameOptions = structuredClone(DEFAULT_GAME_OPTIONS);
  options.time = structuredClone(options.time);
  let distanceRatio = 1;
  let safeZoneM = DEFAULT_SAFE_ZONE_M;
  let disposed = false;
  /** Remises à zéro des commandes (bouton « Réinitialiser »). */
  const syncs: (() => void)[] = [];

  const panel = el('div', 'panel editor ng');
  panel.append(el('h2', undefined, t('screen.newGame.title')));
  const layout = el('div', 'ng-layout');
  const main = el('div', 'ng-main');
  const side = el('div', 'ng-side');
  layout.append(main, side);
  panel.append(layout);

  // --- Le monde : nom, seed, mode, accès --------------------------------------------------------
  const world = el('section', 'ng-card');
  world.append(el('h3', undefined, t('editor.section.world')));
  const nameField = el('label', 'field');
  nameField.append(el('span', undefined, t('screen.newGame.name')));
  const nameInput = el('input');
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.value = ctx.defaultName;
  nameField.append(nameInput);

  const seedField = el('div', 'field');
  const seedLabel = el('label', undefined, t('screen.newGame.seed'));
  seedLabel.htmlFor = 'seed-input';
  const seedRow = el('div', 'seed-row');
  const seedInput = el('input');
  seedInput.type = 'text';
  seedInput.maxLength = 40;
  seedInput.id = 'seed-input';
  seedInput.value = randomSeed();
  const shuffle = el('button', 'icon-btn');
  shuffle.type = 'button';
  shuffle.title = t('screen.newGame.shuffle');
  shuffle.setAttribute('aria-label', t('screen.newGame.shuffle'));
  shuffle.innerHTML = SHUFFLE_ICON;
  shuffle.addEventListener('click', () => {
    seedInput.value = randomSeed();
    seedInput.focus();
    schedulePreview();
  });
  seedInput.addEventListener('input', schedulePreview);
  seedRow.append(seedInput, shuffle);
  seedField.append(seedLabel, seedRow, el('small', 'help', t('screen.newGame.seedHelp')));
  const nameSeed = el('div', 'ng-two');
  nameSeed.append(nameField, seedField);
  world.append(nameSeed);

  // Mode de jeu : deux cartes.
  const modePick = el('div', 'ng-pick');
  modePick.append(el('span', 'ng-pick-title', t('editor.mode')));
  const modeCards = el('div', 'ng-cards');
  const modeButtons = new Map<GameMode, HTMLButtonElement>();
  const syncMode = (): void => {
    for (const [m, b] of modeButtons) b.setAttribute('aria-pressed', String(options.mode === m));
  };
  for (const m of GAME_MODES) {
    const card = el('button', 'ng-card-btn');
    card.type = 'button';
    const icon = el('span', 'ng-card-icon');
    icon.innerHTML = MODE_ICONS[m];
    const text = el('span', 'ng-card-text');
    text.append(
      el('strong', undefined, t(`editor.mode.${m}` as TranslationKey)),
      el('small', undefined, t(`editor.mode.${m}.help` as TranslationKey)),
    );
    card.append(icon, text);
    card.addEventListener('click', () => {
      options.mode = m;
      syncMode();
    });
    modeButtons.set(m, card);
    modeCards.append(card);
  }
  syncMode();
  syncs.push(syncMode);
  modePick.append(modeCards);

  // Accès : privée ou publique (avec mot de passe), et le multijoueur lui-même.
  const mp = options.multiplayer;
  const accessPick = el('div', 'ng-pick');
  accessPick.append(el('span', 'ng-pick-title', t('editor.mp.visibility')));
  const seg = el('div', 'ng-segment');
  const segButtons = new Map<'private' | 'public', HTMLButtonElement>();
  const pass = el('input');
  pass.type = 'text';
  pass.maxLength = 40;
  pass.placeholder = t('editor.mp.password');
  pass.setAttribute('aria-label', t('editor.mp.password'));
  pass.value = mp.password;
  pass.addEventListener('input', () => (mp.password = pass.value));
  const syncAccess = (): void => {
    for (const [v, b] of segButtons) b.setAttribute('aria-pressed', String(mp.visibility === v));
    pass.hidden = mp.visibility !== 'public';
  };
  for (const v of ['private', 'public'] as const) {
    const b = el('button', undefined, t(`editor.mp.visibility.${v}` as TranslationKey));
    b.type = 'button';
    b.addEventListener('click', () => {
      mp.visibility = v;
      syncAccess();
    });
    segButtons.set(v, b);
    seg.append(b);
  }
  syncAccess();
  accessPick.append(seg, pass, el('small', 'help', t('editor.mp.visibility.help')));
  const picks = el('div', 'ng-two');
  picks.append(modePick, accessPick);
  world.append(picks);
  main.append(world);

  // --- Onglets ---------------------------------------------------------------------------------------
  const TABS = ['ores', 'environment', 'gameplay'] as const;
  type Tab = (typeof TABS)[number];
  const tablist = el('div', 'ng-tabs');
  tablist.setAttribute('role', 'tablist');
  const panes = new Map<Tab, HTMLElement>();
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  let current: Tab = 'ores';
  const showTab = (tab: Tab): void => {
    current = tab;
    for (const id of TABS) {
      tabButtons.get(id)?.setAttribute('aria-selected', String(id === tab));
      const pane = panes.get(id);
      if (pane) pane.hidden = id !== tab;
    }
  };
  for (const id of TABS) {
    const b = el('button', 'ng-tab', t(`editor.tab.${id}` as TranslationKey));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => showTab(id));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next =
        TABS[
          (TABS.indexOf(current) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length
        ];
      showTab(next);
      tabButtons.get(next)?.focus();
    });
    tabButtons.set(id, b);
    tablist.append(b);
    const pane = el('div', 'ng-pane');
    pane.setAttribute('role', 'tabpanel');
    panes.set(id, pane);
  }
  main.append(tablist, ...TABS.map((id) => panes.get(id) as HTMLElement));

  /** Un curseur avec sa valeur, branché sur `get` / `set` ; `onChange` relance l'aperçu si besoin. */
  function slider(
    label: string,
    min: number,
    max: number,
    step: number,
    get: () => number,
    set: (v: number) => void,
    format: (v: number) => string,
    preview = true,
  ): HTMLElement {
    const box = el('div', 'ng-slider');
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', label);
    const value = el('span', 'ng-value');
    const sync = (): void => {
      input.value = String(get());
      value.textContent = format(get());
    };
    input.addEventListener('input', () => {
      set(Math.round(Number(input.value) * 100) / 100);
      sync();
      if (preview) schedulePreview();
    });
    syncs.push(sync);
    sync();
    box.append(input, value);
    return box;
  }

  /** Tableau de proportions : une ligne par ressource, un curseur par critère. */
  function resourceTable(ids: string[], withAppears: boolean): HTMLElement {
    const wrap = el('div', 'ng-table-wrap');
    const table = el('table', 'ng-table');
    const head = el('tr');
    head.append(el('th', undefined, t('editor.col.resource')));
    for (const c of CRITERIA) {
      const th = el('th', undefined, t(`editor.criteria.${c}` as TranslationKey));
      th.title = t(`editor.col.${c}.help` as TranslationKey);
      head.append(th);
    }
    if (withAppears) head.append(el('th', undefined, t('editor.col.appears')));
    const thead = el('thead');
    thead.append(head);
    table.append(thead);
    const body = el('tbody');
    for (const id of ids) {
      const res = resourceById(id);
      const row = el('tr');
      const name = el('th');
      name.scope = 'row';
      const chip = el('span', 'chip');
      chip.style.background = res.color;
      name.append(chip, t(`res.${id}` as TranslationKey));
      row.append(name);
      for (const c of CRITERIA) {
        const cell = el('td');
        const label = `${t(`res.${id}` as TranslationKey)} — ${t(`editor.criteria.${c}` as TranslationKey)}`;
        cell.append(
          slider(
            label,
            MULTIPLIER_MIN,
            MULTIPLIER_MAX,
            0.05,
            () => resources[id][c as Criterion],
            (v) => (resources[id][c as Criterion] = v),
            times,
          ),
        );
        row.append(cell);
      }
      if (withAppears) {
        const min = res.kind === 'deposit' ? (res.minDistanceM ?? 0) : 0;
        row.append(
          el(
            'td',
            'ng-appears',
            min > 0 ? t('editor.ores.from', { m: String(min) }) : t('editor.ores.fromStart'),
          ),
        );
      }
      body.append(row);
    }
    table.append(body);
    wrap.append(table);
    return wrap;
  }

  // --- Onglet Minerais ---------------------------------------------------------------------------
  const ores = panes.get('ores') as HTMLElement;
  ores.append(
    el('h3', undefined, t('editor.ores.title')),
    el('small', 'help', t('editor.ores.help')),
    resourceTable(ORE_IDS, true),
    el('small', 'help ng-note', t('editor.ores.far')),
  );
  const distRow = el('div', 'ng-line');
  distRow.append(el('span', 'ng-line-label', t('editor.distance')));
  distRow.append(
    slider(
      t('editor.distance'),
      MULTIPLIER_MIN,
      MULTIPLIER_MAX,
      0.05,
      () => distanceRatio,
      (v) => (distanceRatio = v),
      times,
    ),
  );
  ores.append(distRow, el('small', 'help', t('editor.distance.help')));

  // --- Onglet Environnement ----------------------------------------------------------------------
  const env = panes.get('environment') as HTMLElement;
  env.append(
    el('h3', undefined, t('editor.env.nature')),
    el('small', 'help', t('editor.env.help')),
    resourceTable(ENV_IDS, false),
    el('h3', undefined, t('editor.env.enemies')),
  );
  const checkbox = (
    label: string,
    help: string,
    initial: () => boolean,
    onChange: (value: boolean) => void,
  ): HTMLElement => {
    const row = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = initial();
    input.addEventListener('change', () => onChange(input.checked));
    syncs.push(() => (input.checked = initial()));
    const text = el('span');
    text.append(el('span', undefined, label));
    if (help) text.append(el('small', 'help', help));
    row.append(input, text);
    return row;
  };
  const line = (label: string, help: string, control: HTMLElement): HTMLElement => {
    const box = el('div', 'ng-line');
    const text = el('span', 'ng-line-label', label);
    if (help) text.append(el('small', 'help', help));
    box.append(text, control);
    return box;
  };
  const en = options.enemies;
  env.append(
    checkbox(
      t('editor.enemies.aggressive'),
      t('editor.enemies.aggressive.help'),
      () => en.aggressive,
      (v) => (en.aggressive = v),
    ),
    checkbox(
      t('editor.enemies.expand'),
      t('editor.enemies.expand.help'),
      () => en.expand,
      (v) => (en.expand = v),
    ),
    line(
      t('editor.enemies.expansionSpeed'),
      t('editor.enemies.expansionSpeed.help'),
      slider(
        t('editor.enemies.expansionSpeed'),
        0.25,
        4,
        0.05,
        () => en.expansionSpeed,
        (v) => (en.expansionSpeed = v),
        times,
        false,
      ),
    ),
    line(
      t('editor.enemies.pollution'),
      t('editor.enemies.pollution.help'),
      slider(
        t('editor.enemies.pollution'),
        0.25,
        4,
        0.05,
        () => en.pollutionSensitivity,
        (v) => (en.pollutionSensitivity = v),
        times,
        false,
      ),
    ),
    line(
      t('editor.enemies.max'),
      t('editor.enemies.max.help'),
      slider(
        t('editor.enemies.max'),
        0,
        100,
        1,
        () => en.maxEnemies,
        (v) => (en.maxEnemies = Math.round(v)),
        (v) => String(v),
        false,
      ),
    ),
    line(
      t('editor.enemies.guards'),
      t('editor.enemies.guards.help'),
      slider(
        t('editor.enemies.guards'),
        0,
        8,
        1,
        () => en.guardsPerNest,
        (v) => (en.guardsPerNest = Math.round(v)),
        (v) => String(v),
        false,
      ),
    ),
  );

  // --- Onglet Jouabilité -------------------------------------------------------------------------
  const play = panes.get('gameplay') as HTMLElement;
  play.append(
    el('h3', undefined, t('editor.play.costs')),
    el('small', 'help', t('editor.play.costs.help')),
  );
  const costRows: [keyof Difficulty, TranslationKey][] = [
    ['researchPacks', 'editor.cost.researchPacks'],
    ['researchItems', 'editor.cost.researchItems'],
    ['crafting', 'editor.cost.crafting'],
  ];
  for (const [key, label] of costRows)
    play.append(
      line(
        t(label),
        '',
        slider(
          t(label),
          DIFFICULTY_MIN,
          DIFFICULTY_MAX,
          0.05,
          () => options.difficulty[key],
          (v) => (options.difficulty[key] = v),
          times,
          false,
        ),
      ),
    );
  play.append(
    el('h3', undefined, t('editor.play.world')),
    line(
      t('editor.safe'),
      t('editor.safe.help'),
      slider(
        t('editor.safe'),
        SAFE_ZONE_MIN_M,
        SAFE_ZONE_MAX_M,
        10,
        () => safeZoneM,
        (v) => (safeZoneM = v),
        (v) => `${v} m`,
      ),
    ),
  );
  const realismControl = el('select');
  realismControl.setAttribute('aria-label', t('editor.realism'));
  for (const level of REALISM_LEVELS) {
    const option = el('option', undefined, t(`editor.realism.${level}` as TranslationKey));
    option.value = level;
    realismControl.append(option);
  }
  realismControl.value = options.realism;
  realismControl.addEventListener(
    'change',
    () => (options.realism = realismControl.value as Realism),
  );
  syncs.push(() => (realismControl.value = options.realism));
  play.append(line(t('editor.realism'), t('editor.realism.help'), realismControl));

  // Temps : jour, nuit, saisons.
  play.append(
    el('h3', undefined, t('editor.time.title')),
    el('small', 'help', t('editor.time.help')),
  );
  const timeRow = (
    key: 'dayMinutes' | 'nightMinutes' | 'seasonDays',
    label: string,
    unit: string,
    min: number,
    max: number,
  ): HTMLElement =>
    line(
      label,
      '',
      slider(
        label,
        min,
        max,
        1,
        () => options.time[key],
        (v) => (options.time[key] = Math.round(v)),
        (v) => `${v} ${unit}`,
        false,
      ),
    );
  play.append(
    timeRow('dayMinutes', t('editor.time.day'), t('editor.time.minutes'), 1, 60),
    timeRow('nightMinutes', t('editor.time.night'), t('editor.time.minutes'), 1, 60),
    timeRow('seasonDays', t('editor.time.seasonDays'), t('editor.time.days'), 1, 60),
    seasonPie(options.time),
  );

  // Tutoriel et multijoueur.
  play.append(
    el('h3', undefined, t('editor.mp.title')),
    el('small', 'help', t('editor.mp.help', { n: String(MAX_PLAYERS) })),
    checkbox(
      t('editor.tutorial'),
      t('editor.tutorial.help'),
      () => options.tutorial,
      (v) => (options.tutorial = v),
    ),
  );
  const mpBox = el('div', 'mp-box');
  const syncMp = (): void => {
    mpBox.hidden = !mp.enabled;
  };
  play.append(
    checkbox(
      t('editor.mp.enable'),
      t('editor.mp.enable.help'),
      () => mp.enabled,
      (v) => {
        mp.enabled = v;
        syncMp();
      },
    ),
    mpBox,
  );
  mpBox.append(el('h4', undefined, t('editor.mp.share')));
  for (const key of ['research', 'credits'] as const)
    mpBox.append(
      checkbox(
        t(`editor.mp.share.${key}` as TranslationKey),
        '',
        () => mp.share[key],
        (v) => (mp.share[key] = v),
      ),
    );
  syncMp();
  showTab('ores');

  // --- Colonne de droite : aperçu, légende, boutons ----------------------------------------------------
  const launch = (): void => {
    const name = nameInput.value.trim() || t('screen.newGame.defaultName', { n: '1' });
    const seed = seedInput.value.trim() || randomSeed();
    dispose();
    ctx.onLaunch(
      ctx.saves.create(name, seed, {
        distanceRatio,
        resources: structuredClone(resources),
        safeZoneM,
        // Le mot de passe est rangé sous forme d'empreinte, jamais en clair.
        options: {
          ...options,
          multiplayer: {
            ...options.multiplayer,
            password: hashPassword(options.multiplayer.password),
          },
        },
      }),
    );
  };
  for (const input of [nameInput, seedInput]) {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      launch();
    });
  }

  side.append(el('h3', undefined, t('editor.preview.title')));
  const frame = el('div', 'preview-frame');
  const canvas = el('canvas', 'preview-canvas');
  const status = el('div', 'preview-status');
  const tip = el('div', 'preview-tip');
  tip.hidden = true;
  frame.append(canvas, status, tip);
  const actions = el('div', 'ng-actions');
  actions.append(
    button(t('screen.newGame.launch'), launch, 'menu-btn primary'),
    button(t('editor.resetWorld'), () => {
      for (const id of Object.keys(resources))
        resources[id] = { frequency: 1, size: 1, density: 1 };
      distanceRatio = 1;
      safeZoneM = DEFAULT_SAFE_ZONE_M;
      Object.assign(options.enemies, DEFAULT_GAME_OPTIONS.enemies);
      Object.assign(options.difficulty, DEFAULT_GAME_OPTIONS.difficulty);
      syncs.forEach((sync) => sync());
      schedulePreview();
    }),
    button(t('common.back'), () => {
      dispose();
      ctx.onBack();
    }),
  );
  const note = el('small', 'help');
  side.append(frame, actions, legend(), note);

  let timer = 0;
  let running = 0;
  let renderer: PreviewRenderer | null = null;
  function schedulePreview(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(startPreview, 180);
  }

  function startPreview(): void {
    if (disposed) return;
    const token = ++running;
    const seed = seedInput.value.trim() || ' ';
    const params = {
      ...defaultWorldParams(seed),
      resources: structuredClone(resources),
      distanceRatio,
      safeZoneM,
    };
    const r = new PreviewRenderer(new WorldGenerator(params));
    renderer = r;
    note.textContent = t('editor.preview.note', {
      size: String(PREVIEW_SIZE_M),
      safe: String(safeZoneM),
    });
    canvas.width = r.width;
    canvas.height = r.width;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const image = new ImageData(r.pixels, r.width, r.width);
    const tick = (): void => {
      if (disposed || token !== running) return;
      const started = performance.now();
      let done = false;
      while (!done && performance.now() - started < 12) done = r.step();
      ctx2d.putImageData(image, 0, 0);
      if (done) {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent = t('editor.preview.loading', {
        pct: String(Math.round(r.progress * 100)),
      });
      window.setTimeout(tick, 0);
    };
    tick();
  }

  // Info-bulle : la ressource sous le curseur (pas les arbres, trop nombreux).
  canvas.addEventListener('mousemove', (e) => {
    if (!renderer) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { gx, gz } = renderer.cellOfPixel(px, py);
    const hit = renderer.inspect(gx, gz);
    if (!hit || hit.id === 'tree') {
      tip.hidden = true;
      return;
    }
    tip.textContent = t(`res.${hit.id}` as TranslationKey);
    tip.hidden = false;
    const f = frame.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - f.left + 14, f.width - 130)}px`;
    tip.style.top = `${Math.max(4, e.clientY - f.top - 30)}px`;
  });
  canvas.addEventListener('mouseleave', () => (tip.hidden = true));

  function legend(): HTMLElement {
    const box = el('ul', 'legend');
    const item = (color: string, label: string, ring = false): void => {
      const li = el('li');
      const chip = el('span', ring ? 'chip ring' : 'chip');
      chip.style.background = ring ? 'transparent' : color;
      li.append(chip, el('span', undefined, label));
      box.append(li);
    };
    for (const id of BIOME_IDS) item(BIOME_COLORS[id], t(`biome.${id}` as TranslationKey));
    for (const r of RESOURCES) item(r.color, t(`res.${r.id}` as TranslationKey));
    item('#fff', t('editor.legend.safe'), true);
    return box;
  }

  function dispose(): void {
    disposed = true;
    window.clearTimeout(timer);
    running++;
  }

  startPreview();
  return { element: panel, dispose };
}

const SEASON_COLORS = ['#7bc96f', '#f2c94c', '#d98b3a', '#9ec9e6'];

/**
 * Camembert des saisons : chaque part est une saison ; on tire les poignées aux frontières pour agrandir ou
 * rapetisser une saison (au moins 5 % chacune). Modifie `time.shares` sur place.
 */
function seasonPie(time: TimeSettings): HTMLElement {
  const box = el('div', 'season-pie');
  const NS = 'http://www.w3.org/2000/svg';
  const size = 230;
  const c = size / 2;
  const r = 88;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('editor.time.pie'));
  const info = el('div', 'season-pie-info');
  const point = (frac: number, radius: number): [number, number] => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    return [c + Math.cos(a) * radius, c + Math.sin(a) * radius];
  };
  const bounds = (): number[] => {
    const out = [0];
    for (const s of time.shares) out.push(out[out.length - 1] + s / 100);
    return out;
  };
  function draw(): void {
    svg.replaceChildren();
    const b = bounds();
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = point(b[i], r);
      const [x1, y1] = point(b[i + 1], r);
      const large = b[i + 1] - b[i] > 0.5 ? 1 : 0;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`);
      path.setAttribute('fill', SEASON_COLORS[i]);
      path.setAttribute('stroke', '#1b2430');
      path.setAttribute('stroke-width', '2');
      svg.append(path);
      const [lx, ly] = point((b[i] + b[i + 1]) / 2, r * 0.6);
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(lx));
      label.setAttribute('y', String(ly));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#1b2430');
      label.setAttribute('pointer-events', 'none');
      label.textContent = `${t(`season.${SEASON_IDS[i]}` as TranslationKey)} ${time.shares[i]} %`;
      svg.append(label);
    }
    // Poignées aux frontières entre saisons (la première saison commence en haut).
    for (let k = 1; k <= 3; k++) {
      const [hx, hy] = point(b[k], r);
      const handle = document.createElementNS(NS, 'circle');
      handle.setAttribute('cx', String(hx));
      handle.setAttribute('cy', String(hy));
      handle.setAttribute('r', '8');
      handle.setAttribute('fill', '#fff');
      handle.setAttribute('stroke', '#1b2430');
      handle.setAttribute('stroke-width', '2');
      handle.setAttribute('cursor', 'grab');
      handle.addEventListener('pointerdown', (e) => {
        handle.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent): void => {
          const rect = svg.getBoundingClientRect();
          const px = ((ev.clientX - rect.left) / rect.width) * size - c;
          const py = ((ev.clientY - rect.top) / rect.height) * size - c;
          let frac = (Math.atan2(py, px) + Math.PI / 2) / (Math.PI * 2);
          if (frac < 0) frac += 1;
          const min = MIN_SHARE / 100;
          const lo = b[k - 1] + min;
          const hi = b[k + 1] - min;
          frac = Math.min(hi, Math.max(lo, frac));
          const next = [...b];
          next[k] = frac;
          // Parts entières ; la dernière complète à 100.
          const shares = [0, 1, 2, 3].map((i) => Math.round((next[i + 1] - next[i]) * 100));
          shares[3] = 100 - shares[0] - shares[1] - shares[2];
          if (shares.every((v) => v >= MIN_SHARE)) {
            time.shares = shares as TimeSettings['shares'];
            draw();
          }
        };
        const up = (): void => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
      });
      svg.append(handle);
    }
    const yearDays = time.seasonDays * 4;
    info.textContent = SEASON_IDS.map(
      (id, i) =>
        `${t(`season.${id}` as TranslationKey)} : ${time.shares[i]} % (${Math.round((yearDays * time.shares[i]) / 100)} ${t('editor.time.days')})`,
    ).join(' · ');
  }
  draw();
  box.append(
    el('div', 'row-label', t('editor.time.pie')),
    svg,
    info,
    el('small', 'help', t('editor.time.pieHelp')),
  );
  return box;
}
