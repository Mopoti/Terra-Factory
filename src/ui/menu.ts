import {
  LOCALES,
  LOCALE_NAMES,
  getLocale,
  onLocaleChange,
  setLocale,
  t,
  type TranslationKey,
} from '../i18n';
import { latestGame, type GameSummary, type ProvisionalSaveIndex } from '../core/save/saveIndex';
import './menu.css';

type Screen = 'main' | 'newGame' | 'loadGame' | 'settings';
type SettingsTab = 'display' | 'sound' | 'views' | 'controls';

const SETTINGS_TABS: { id: SettingsTab; label: TranslationKey }[] = [
  { id: 'display', label: 'settings.tab.display' },
  { id: 'sound', label: 'settings.tab.sound' },
  { id: 'views', label: 'settings.tab.views' },
  { id: 'controls', label: 'settings.tab.controls' },
];

/** Faux tant qu'on est dans un navigateur : un site ne peut pas toujours fermer son onglet. */
function canQuit(): boolean {
  return false;
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

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(ms),
  );
}

export interface MenuOptions {
  saves: ProvisionalSaveIndex;
  devMode: boolean;
  /** Appelé quand le joueur lance une partie (nouvelle, continuée ou chargée). */
  onStartGame: (game: GameSummary) => void;
}

export function mountMenu(root: HTMLElement, options: MenuOptions): void {
  const { saves, devMode, onStartGame } = options;
  let screen: Screen = 'main';
  let settingsTab: SettingsTab = 'display';

  function button(label: string, onClick: () => void, className = 'menu-btn'): HTMLButtonElement {
    const b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function go(next: Screen): void {
    screen = next;
    render();
  }

  function gameButton(game: GameSummary, primaryLabel: string | null): HTMLButtonElement {
    const b = button('', () => onStartGame(game), primaryLabel ? 'menu-btn primary' : 'menu-btn');
    b.append(el('span', undefined, primaryLabel ?? game.name));
    b.append(
      el(
        'small',
        undefined,
        primaryLabel
          ? t('menu.continue.detail', { name: game.name, date: formatDate(game.lastSavedAt) })
          : formatDate(game.lastSavedAt),
      ),
    );
    return b;
  }

  function mainPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h1', undefined, t('game.title')));

    const games = saves.list();
    const latest = latestGame(games);
    if (latest) panel.append(gameButton(latest, t('menu.continue')));
    panel.append(button(t('menu.newGame'), () => go('newGame')));
    if (games.length > 0) panel.append(button(t('menu.loadGame'), () => go('loadGame')));
    panel.append(button(t('menu.settings'), () => go('settings')));
    if (canQuit()) panel.append(button(t('menu.quit'), () => window.close()));

    if (devMode) {
      const dev = el('div', 'dev');
      dev.append(
        button(
          '[dev] vider les parties',
          () => {
            saves.clearAll();
            render();
          },
          '',
        ),
      );
      panel.append(dev);
    }
    return panel;
  }

  function newGamePanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h2', undefined, t('screen.newGame.title')));
    const field = el('label', 'field');
    field.append(el('span', undefined, t('screen.newGame.name')));
    const input = el('input');
    input.type = 'text';
    input.maxLength = 40;
    input.value = t('screen.newGame.defaultName', { n: String(saves.list().length + 1) });
    field.append(input);
    panel.append(field);
    const launch = (): void => {
      const name = input.value.trim() || t('screen.newGame.defaultName', { n: '1' });
      onStartGame(saves.create(name));
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && launch());
    panel.append(
      el('p', undefined, t('screen.newGame.provisional')),
      button(t('screen.newGame.launch'), launch, 'menu-btn primary'),
      button(t('common.back'), () => go('main')),
    );
    return panel;
  }

  function loadGamePanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(
      el('h2', undefined, t('screen.loadGame.title')),
      el('p', undefined, t('screen.loadGame.pick')),
    );
    const sorted = [...saves.list()].sort((a, b) => b.lastSavedAt - a.lastSavedAt);
    for (const game of sorted) panel.append(gameButton(game, null));
    panel.append(button(t('common.back'), () => go('main')));
    return panel;
  }

  function settingsPanel(): HTMLElement {
    const panel = el('div', 'panel wide');
    panel.append(el('h2', undefined, t('screen.settings.title')));

    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const tab of SETTINGS_TABS) {
      const b = button(
        t(tab.label),
        () => {
          settingsTab = tab.id;
          render();
        },
        '',
      );
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(settingsTab === tab.id));
      tabs.append(b);
    }
    panel.append(tabs);

    if (settingsTab === 'display') {
      const box = el('div', 'lang');
      box.append(el('span', undefined, t('settings.display.language')));
      for (const locale of LOCALES) {
        const b = button(LOCALE_NAMES[locale], () => setLocale(locale), '');
        b.setAttribute('aria-pressed', String(getLocale() === locale));
        box.append(b);
      }
      panel.append(box);
    } else {
      panel.append(el('p', undefined, t('common.comingSoon')));
    }
    panel.append(button(t('common.back'), () => go('main')));
    return panel;
  }

  function render(): void {
    root.replaceChildren();
    switch (screen) {
      case 'main':
        root.append(mainPanel());
        break;
      case 'newGame':
        root.append(newGamePanel());
        break;
      case 'loadGame':
        root.append(loadGamePanel());
        break;
      case 'settings':
        root.append(settingsPanel());
        break;
    }
    const first = screen === 'newGame' ? root.querySelector('input') : root.querySelector('button');
    first?.focus({ preventScroll: true });
  }

  onLocaleChange(render);
  render();
}
