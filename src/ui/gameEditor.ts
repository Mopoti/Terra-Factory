import type { SaveLibrary } from '../core/save/library';
import {
  DEFAULT_GAME_OPTIONS,
  GAME_MODES,
  REALISM_LEVELS,
  type GameMode,
  type GameOptions,
  type GameSummary,
  type Realism,
} from '../core/save/saveIndex';
import { MIN_SHARE, SEASON_IDS, type TimeSettings } from '../core/game/seasons';
import { FAMILY_IDS, RESOURCES, type FamilyId } from '../core/data/resources';
import { BIOME_COLORS, BIOME_IDS } from '../core/world/biomes';
import { PreviewRenderer } from '../core/world/preview';
import {
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  WorldGenerator,
  defaultWorldParams,
  type FamilyParams,
  type WorldFamilies,
} from '../core/world/worldgen';
import { getLocale, t, type TranslationKey } from '../i18n';

const CRITERIA = ['frequency', 'size', 'density'] as const;
type Criterion = (typeof CRITERIA)[number];

/** Icône « mélanger » (deux flèches qui se croisent). */
const SHUFFLE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';

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

/** Écran d'édition d'une nouvelle partie : seed, ressources, ennemis, physique, avec aperçu en direct. */
export function buildGameEditor(ctx: GameEditorContext): GameEditor {
  const families: WorldFamilies = defaultWorldParams('').families;
  const options: GameOptions = structuredClone(DEFAULT_GAME_OPTIONS);
  let distanceRatio = 1;
  let disposed = false;

  const panel = el('div', 'panel editor');
  panel.append(el('h2', undefined, t('screen.newGame.title')));
  const layout = el('div', 'editor-layout');
  const form = el('div', 'editor-form');
  const side = el('div', 'editor-side');
  layout.append(form, side);
  panel.append(layout);

  // --- Nom et seed ---------------------------------------------------------------------------
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
  form.append(nameField, seedField);

  // --- Ressources ------------------------------------------------------------------------------
  const sliderSyncs: (() => void)[] = [];
  form.append(el('h3', undefined, t('editor.resources')));

  function slider(family: FamilyId, criterion: Criterion): HTMLElement {
    const row = el('div', 'row');
    const label = t(`editor.criteria.${criterion}` as TranslationKey);
    row.append(el('span', 'row-label', label));
    const control = el('div', 'row-control');
    const input = el('input');
    input.type = 'range';
    input.min = String(MULTIPLIER_MIN);
    input.max = String(MULTIPLIER_MAX);
    input.step = '0.05';
    input.setAttribute(
      'aria-label',
      `${t(`editor.family.${family}` as TranslationKey)} — ${label}`,
    );
    const value = el('span', 'row-value');
    const word = el('span', 'level');
    const sync = (): void => {
      const v = families[family][criterion];
      input.value = String(v);
      value.textContent = `×${v.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      word.textContent = t(`editor.level.${levelOf(v)}` as TranslationKey);
    };
    input.addEventListener('input', () => {
      const f: FamilyParams = families[family];
      f[criterion] = Math.round(Number(input.value) * 100) / 100;
      sync();
      schedulePreview();
    });
    sliderSyncs.push(sync);
    sync();
    control.append(input, value, word);
    row.append(control);
    return row;
  }

  for (const family of FAMILY_IDS) {
    const section = el('section', 'family');
    section.append(
      el('h4', undefined, t(`editor.family.${family}` as TranslationKey)),
      el('small', 'help', t(`editor.hint.${family}` as TranslationKey)),
    );
    for (const criterion of CRITERIA) section.append(slider(family, criterion));
    if (family === 'enemies') {
      section.append(
        checkbox(
          t('editor.enemies.aggressive'),
          t('editor.enemies.aggressive.help'),
          options.enemies.aggressive,
          (v) => (options.enemies.aggressive = v),
        ),
        checkbox(
          t('editor.enemies.expand'),
          t('editor.enemies.expand.help'),
          options.enemies.expand,
          (v) => (options.enemies.expand = v),
        ),
      );
    }
    form.append(section);
  }

  // --- Ratio de distance des ressources ----------------------------------------------------------
  const distRow = el('div', 'row');
  distRow.append(el('span', 'row-label', t('editor.distance')));
  const distControl = el('div', 'row-control');
  const distInput = el('input');
  distInput.type = 'range';
  distInput.min = String(MULTIPLIER_MIN);
  distInput.max = String(MULTIPLIER_MAX);
  distInput.step = '0.05';
  distInput.setAttribute('aria-label', t('editor.distance'));
  const distValue = el('span', 'row-value');
  const syncDistance = (): void => {
    distInput.value = String(distanceRatio);
    distValue.textContent = `×${distanceRatio.toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  distInput.addEventListener('input', () => {
    distanceRatio = Math.round(Number(distInput.value) * 100) / 100;
    syncDistance();
    schedulePreview();
  });
  sliderSyncs.push(syncDistance);
  syncDistance();
  distControl.append(distInput, distValue);
  distRow.append(distControl);
  form.append(distRow, el('small', 'help', t('editor.distance.help')));

  function checkbox(
    label: string,
    help: string,
    initial: boolean,
    onChange: (value: boolean) => void,
  ): HTMLElement {
    const row = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = initial;
    input.addEventListener('change', () => onChange(input.checked));
    const text = el('span');
    text.append(el('span', undefined, label), el('small', 'help', help));
    row.append(input, text);
    return row;
  }

  // --- Physique --------------------------------------------------------------------------------
  form.append(el('h3', undefined, t('editor.section.rules')));
  const realismRow = el('div', 'row');
  realismRow.append(el('span', 'row-label', t('editor.realism')));
  const realismControl = el('div', 'row-control');
  const realism = el('select');
  realism.setAttribute('aria-label', t('editor.realism'));
  for (const level of REALISM_LEVELS) {
    const option = el('option', undefined, t(`editor.realism.${level}` as TranslationKey));
    option.value = level;
    realism.append(option);
  }
  realism.value = options.realism;
  realism.addEventListener('change', () => (options.realism = realism.value as Realism));
  realismControl.append(realism);
  realismRow.append(realismControl);
  form.append(realismRow, el('small', 'help', t('editor.realism.help')));
  const modeRow = el('div', 'row');
  modeRow.append(el('span', 'row-label', t('editor.mode')));
  const modeControl = el('div', 'row-control');
  const mode = el('select');
  mode.setAttribute('aria-label', t('editor.mode'));
  for (const m of GAME_MODES) {
    const option = el('option', undefined, t(`editor.mode.${m}` as TranslationKey));
    option.value = m;
    mode.append(option);
  }
  mode.value = options.mode;
  mode.addEventListener('change', () => (options.mode = mode.value as GameMode));
  modeControl.append(mode);
  modeRow.append(modeControl);
  form.append(modeRow, el('small', 'help', t('editor.mode.help')));
  form.append(
    checkbox(
      t('editor.tutorial'),
      t('editor.tutorial.help'),
      options.tutorial,
      (v) => (options.tutorial = v),
    ),
  );

  // --- Temps : jour, nuit, saisons (trois réglages indépendants) ------------------------------------
  form.append(
    el('h3', undefined, t('editor.time.title')),
    el('small', 'help', t('editor.time.help')),
  );
  options.time = structuredClone(options.time);
  const timeRow = (
    key: 'dayMinutes' | 'nightMinutes' | 'seasonDays',
    label: string,
    unit: string,
    min: number,
    max: number,
  ): HTMLElement => {
    const row = el('div', 'row');
    row.append(el('span', 'row-label', label));
    const control = el('div', 'row-control');
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(options.time[key]);
    input.setAttribute('aria-label', label);
    const value = el('span', 'row-value');
    const sync = (): void => {
      value.textContent = `${options.time[key]} ${unit}`;
    };
    input.addEventListener('input', () => {
      options.time[key] = Number(input.value);
      sync();
    });
    sync();
    control.append(input, value);
    row.append(control);
    return row;
  };
  form.append(
    timeRow('dayMinutes', t('editor.time.day'), t('editor.time.minutes'), 1, 60),
    timeRow('nightMinutes', t('editor.time.night'), t('editor.time.minutes'), 1, 60),
    timeRow('seasonDays', t('editor.time.seasonDays'), t('editor.time.days'), 1, 60),
    seasonPie(options.time),
  );

  // --- Actions -----------------------------------------------------------------------------------
  const launch = (): void => {
    const name = nameInput.value.trim() || t('screen.newGame.defaultName', { n: '1' });
    const seed = seedInput.value.trim() || randomSeed();
    dispose();
    ctx.onLaunch(
      ctx.saves.create(name, seed, {
        families: structuredClone(families),
        distanceRatio,
        options,
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
  const actions = el('div', 'editor-actions');
  actions.append(
    button(t('screen.newGame.launch'), launch, 'menu-btn primary'),
    button(t('editor.resetWorld'), () => {
      for (const id of FAMILY_IDS) families[id] = { frequency: 1, size: 1, density: 1 };
      distanceRatio = 1;
      sliderSyncs.forEach((sync) => sync());
      schedulePreview();
    }),
    button(t('common.back'), () => {
      dispose();
      ctx.onBack();
    }),
  );
  form.append(actions);

  // --- Aperçu du monde ---------------------------------------------------------------------------
  side.append(el('h3', undefined, t('editor.preview.title')));
  const frame = el('div', 'preview-frame');
  const canvas = el('canvas', 'preview-canvas');
  const status = el('div', 'preview-status');
  frame.append(canvas, status);
  side.append(frame, legend(), el('small', 'help', t('editor.preview.note')));

  let timer = 0;
  let running = 0;
  function schedulePreview(): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(startPreview, 180);
  }

  function startPreview(): void {
    if (disposed) return;
    const token = ++running;
    const seed = seedInput.value.trim() || ' ';
    const renderer = new PreviewRenderer(
      new WorldGenerator({ seed, families: structuredClone(families), distanceRatio }),
    );
    canvas.width = renderer.width;
    canvas.height = renderer.width;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const image = new ImageData(renderer.pixels, renderer.width, renderer.width);
    const tick = (): void => {
      if (disposed || token !== running) return;
      const started = performance.now();
      let done = false;
      while (!done && performance.now() - started < 12) done = renderer.step();
      ctx2d.putImageData(image, 0, 0);
      if (done) {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent = t('editor.preview.loading', {
        pct: String(Math.round(renderer.progress * 100)),
      });
      window.setTimeout(tick, 0);
    };
    tick();
  }

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
