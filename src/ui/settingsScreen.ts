import { playTestTone, type SoundCategory } from '../audio/audio';
import {
  formatDistance,
  formatEnergy,
  formatMass,
  formatPower,
  formatPressure,
  formatTemperature,
} from '../core/units';
import { LOCALES, LOCALE_NAMES, getLocale, setLocale, t, type TranslationKey } from '../i18n';
import {
  ACTIONS,
  ACTION_CATEGORIES,
  bindingLabel,
  findConflict,
  isFixed,
  type ActionId,
  type Binding,
} from '../settings/controls';
import {
  DISPLAY_SECTION,
  GAME_SECTION,
  SOUND_SECTION,
  UNITS_SECTION,
  VIEW_SECTIONS,
  type Row,
} from '../settings/rows';
import type { SectionName } from '../settings/schema';
import { getAt, getSettings, resetSection, setBindings, setSetting } from '../settings/store';

type TabId = SectionName;
const TABS: { id: TabId; label: TranslationKey }[] = [
  { id: 'display', label: 'settings.tab.display' },
  { id: 'sound', label: 'settings.tab.sound' },
  { id: 'views', label: 'settings.tab.views' },
  { id: 'controls', label: 'settings.tab.controls' },
  { id: 'game', label: 'settings.tab.game' },
];

let currentTab: TabId = 'display';
let currentView = 'common';

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

function btn(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const label = (path: string): string => t(`set.${path}` as TranslationKey);

function decimals(step: number): number {
  return step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
}

function renderRow(row: Row): HTMLElement {
  const wrap = el('div', 'row');
  const name = el('span', 'row-label', label(row.path));
  wrap.append(name);
  const control = el('div', 'row-control');
  wrap.append(control);

  if (row.kind === 'range' || row.kind === 'sound') {
    const [min, max, step, suffix] =
      row.kind === 'range' ? [row.min, row.max, row.step, row.suffix ?? ''] : [0, 100, 1, '%'];
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(getAt(row.path));
    input.setAttribute('aria-label', name.textContent ?? '');
    const value = el('span', 'row-value');
    const show = (): void => {
      value.textContent = `${Number(input.value).toFixed(decimals(step))}${suffix}`;
    };
    show();
    input.addEventListener('input', () => {
      setSetting(row.path, Number(input.value));
      show();
    });
    control.append(input, value);
    if (row.kind === 'sound') {
      const category = row.path.split('.')[1] as SoundCategory | 'master';
      const mute = el('input');
      mute.type = 'checkbox';
      mute.checked = getAt(row.mutePath) === true;
      mute.title = t('settings.sound.mute');
      mute.setAttribute('aria-label', t('settings.sound.mute'));
      mute.addEventListener('change', () => setSetting(row.mutePath, mute.checked));
      const muteLabel = el('label', 'mute');
      muteLabel.append(mute, el('span', undefined, t('settings.sound.mute')));
      control.append(
        muteLabel,
        btn(t('settings.sound.test'), () => playTestTone(category)),
      );
    }
  } else if (row.kind === 'toggle') {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = getAt(row.path) === true;
    input.setAttribute('aria-label', name.textContent ?? '');
    input.addEventListener('change', () => setSetting(row.path, input.checked));
    control.append(input);
  } else {
    const select = el('select');
    select.setAttribute('aria-label', name.textContent ?? '');
    for (const o of row.options) {
      const opt = el('option', undefined, o.label ? t(o.label as TranslationKey) : (o.raw ?? ''));
      opt.value = String(o.value);
      select.append(opt);
    }
    select.value = String(getAt(row.path));
    select.addEventListener('change', () => {
      const chosen = row.options.find((o) => String(o.value) === select.value);
      if (chosen) setSetting(row.path, chosen.value);
    });
    control.append(select);
  }
  return wrap;
}

function unitsPreview(): HTMLElement {
  const box = el('p', 'units-preview');
  const render = (): void => {
    const u = getSettings().display.units;
    const loc = getLocale();
    box.textContent = `${t('settings.units.example')} : ${t('settings.units.sample', {
      distance: formatDistance(12.5, u, loc),
      temp: formatTemperature(20, u, loc),
      mass: formatMass(80, u, loc),
      pressure: formatPressure(200_000, u, loc),
      energy: formatEnergy(18_000_000, u, loc),
      power: formatPower(1500, u, loc),
    })}`;
  };
  render();
  box.addEventListener('refresh', render);
  return box;
}

function displayTab(): HTMLElement {
  const box = el('div');

  const lang = el('div', 'row');
  lang.append(el('span', 'row-label', t('settings.display.language')));
  const choices = el('div', 'row-control lang');
  for (const locale of LOCALES) {
    const b = btn(LOCALE_NAMES[locale], () => setLocale(locale));
    b.setAttribute('aria-pressed', String(getLocale() === locale));
    choices.append(b);
  }
  lang.append(choices);
  box.append(lang);

  const fs = el('div', 'row');
  fs.append(el('span', 'row-label', t('settings.fullscreen')));
  const fsBtn = btn('', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  });
  const syncFs = (): void => {
    fsBtn.textContent = document.fullscreenElement
      ? t('settings.fullscreen.exit')
      : t('settings.fullscreen');
  };
  syncFs();
  document.onfullscreenchange = syncFs;
  const fsControl = el('div', 'row-control');
  fsControl.append(fsBtn);
  fs.append(fsControl);
  box.append(fs);

  for (const row of DISPLAY_SECTION.rows) box.append(renderRow(row));

  box.append(el('h3', undefined, t('settings.section.units')));
  const preview = unitsPreview();
  for (const row of UNITS_SECTION.rows) {
    const r = renderRow(row);
    r.addEventListener('change', () => preview.dispatchEvent(new Event('refresh')));
    box.append(r);
  }
  box.append(preview);
  return box;
}

function soundTab(): HTMLElement {
  const box = el('div');
  for (const row of SOUND_SECTION.rows) box.append(renderRow(row));
  box.append(el('p', 'note', t('settings.sound.note')));
  return box;
}

function viewsTab(rerender: () => void): HTMLElement {
  const box = el('div');
  const sub = el('div', 'tabs');
  sub.setAttribute('role', 'tablist');
  for (const section of VIEW_SECTIONS) {
    const b = btn(t(`settings.view.${section.id}` as TranslationKey), () => {
      currentView = section.id;
      rerender();
    });
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(currentView === section.id));
    sub.append(b);
  }
  box.append(sub);
  const section = VIEW_SECTIONS.find((s) => s.id === currentView) ?? VIEW_SECTIONS[0];
  for (const row of section.rows) box.append(renderRow(row));
  return box;
}

function gameTab(): HTMLElement {
  const box = el('div');
  for (const row of GAME_SECTION.rows) box.append(renderRow(row));
  return box;
}

interface Listening {
  action: ActionId;
  slot: 0 | 1;
}
interface Pending extends Listening {
  code: string;
  other: Listening;
}

function controlsTab(): HTMLElement {
  const box = el('div');
  let listening: Listening | null = null;
  let pending: Pending | null = null;
  let stopListening: (() => void) | null = null;

  const actionName = (id: ActionId): string => t(`action.${id}` as TranslationKey);
  const codeLabel = (code: Binding): string =>
    code ? bindingLabel(code, (k) => t(k as TranslationKey), getLocale() === 'fr') : t('key.none');

  function assign(code: string): void {
    if (!listening) return;
    const target = listening;
    finish();
    const conflict = findConflict(getSettings().controls, code, target);
    if (conflict) {
      pending = { ...target, code, other: conflict };
      redraw();
      return;
    }
    setBindings([{ action: target.action, slot: target.slot, code }]);
    redraw();
  }

  function finish(): void {
    stopListening?.();
    stopListening = null;
    listening = null;
  }

  function startListening(target: Listening): void {
    finish();
    pending = null;
    listening = target;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || !e.code) return;
      if (e.code === 'Escape') {
        finish();
        redraw();
      } else assign(e.code);
    };
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 0) {
        if ((e.target as HTMLElement).closest('[data-left-click]')) return;
        finish();
        redraw();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      assign(`Mouse${e.button}`);
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      assign(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    };
    const noMenu = (e: Event): void => e.preventDefault();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', noMenu, true);
    stopListening = () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('contextmenu', noMenu, true);
    };
    redraw();
  }

  function slotButton(id: ActionId, slot: 0 | 1): HTMLElement {
    const cell = el('span', 'slot');
    const code = getSettings().controls[id][slot];
    if (isFixed(id)) {
      cell.append(el('span', 'fixed', slot === 0 && code ? codeLabel(code) : ''));
      return cell;
    }
    const isListening = listening?.action === id && listening.slot === slot;
    const b = btn(isListening ? t('settings.controls.listening') : codeLabel(code), () =>
      startListening({ action: id, slot }),
    );
    if (isListening) b.classList.add('listening');
    b.setAttribute(
      'aria-label',
      `${actionName(id)} — ${t(slot === 0 ? 'settings.controls.primary' : 'settings.controls.alternate')}`,
    );
    cell.append(b);
    if (isListening) {
      const left = btn(t('settings.controls.leftClick'), () => assign('Mouse0'));
      left.dataset.leftClick = '1';
      cell.append(left);
    } else if (code) {
      cell.append(
        btn(
          '×',
          () => {
            setBindings([{ action: id, slot, code: null }]);
            redraw();
          },
          'clear',
        ),
      );
      cell.lastElementChild?.setAttribute('title', t('settings.controls.clear'));
      cell.lastElementChild?.setAttribute('aria-label', t('settings.controls.clear'));
    }
    return cell;
  }

  function redraw(): void {
    box.replaceChildren(el('p', 'note', t('settings.controls.note')));
    if (pending) {
      const p = pending;
      const warn = el('div', 'conflict');
      warn.append(
        el(
          'span',
          undefined,
          t('settings.controls.conflict', {
            key: codeLabel(p.code),
            action: actionName(p.other.action),
          }),
        ),
        btn(
          t('settings.controls.swap'),
          () => {
            const old = getSettings().controls[p.action][p.slot];
            setBindings([
              { action: p.action, slot: p.slot, code: p.code },
              { action: p.other.action, slot: p.other.slot, code: old },
            ]);
            pending = null;
            redraw();
          },
          'menu-btn',
        ),
        btn(
          t('settings.controls.cancel'),
          () => {
            pending = null;
            redraw();
          },
          'menu-btn',
        ),
      );
      box.append(warn);
    }
    for (const category of ACTION_CATEGORIES) {
      box.append(el('h3', undefined, t(`actioncat.${category}` as TranslationKey)));
      for (const a of ACTIONS.filter((x) => x.category === category)) {
        const row = el('div', 'row');
        row.append(el('span', 'row-label', actionName(a.id)));
        const control = el('div', 'row-control');
        control.append(slotButton(a.id, 0), slotButton(a.id, 1));
        row.append(control);
        box.append(row);
      }
    }
  }

  redraw();
  // Si l'écran est quitté pendant l'écoute, on la coupe.
  const observer = new MutationObserver(() => {
    if (!box.isConnected) {
      finish();
      observer.disconnect();
    }
  });
  queueMicrotask(() => observer.observe(document.body, { childList: true, subtree: true }));
  return box;
}

/** Écran Paramètres complet. `rerender` reconstruit l'écran ; `back` revient au menu. */
export function buildSettingsPanel(back: () => void, rerender: () => void): HTMLElement {
  const panel = el('div', 'panel wide settings');
  panel.append(el('h2', undefined, t('screen.settings.title')));

  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  for (const tab of TABS) {
    const b = btn(t(tab.label), () => {
      currentTab = tab.id;
      rerender();
    });
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(currentTab === tab.id));
    tabs.append(b);
  }
  panel.append(tabs);

  const content = el('div', 'settings-content');
  switch (currentTab) {
    case 'display':
      content.append(displayTab());
      break;
    case 'sound':
      content.append(soundTab());
      break;
    case 'views':
      content.append(viewsTab(rerender));
      break;
    case 'controls':
      content.append(controlsTab());
      break;
    case 'game':
      content.append(gameTab());
      break;
  }
  panel.append(content);

  const footer = el('div', 'settings-footer');
  footer.append(
    btn(t('common.back'), back, 'menu-btn'),
    btn(
      t('settings.reset'),
      () => {
        resetSection(currentTab);
        rerender();
      },
      'menu-btn',
    ),
    btn(
      t('settings.resetAll'),
      () => {
        if (window.confirm(t('settings.resetAll.confirm'))) {
          resetSection('all');
          rerender();
        }
      },
      'menu-btn',
    ),
  );
  panel.append(footer);
  return panel;
}
