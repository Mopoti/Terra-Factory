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

type Screen = 'main' | 'newGame' | 'loadGame' | 'settings' | 'game';

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

export function mountMenu(root: HTMLElement, saves: ProvisionalSaveIndex, devMode: boolean): void {
  let screen: Screen = 'main';
  let selected: GameSummary | undefined;

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

  function languageSwitch(): HTMLElement {
    const box = el('div', 'lang');
    box.append(el('span', undefined, t('menu.language')));
    for (const locale of LOCALES) {
      const b = button(LOCALE_NAMES[locale], () => setLocale(locale), '');
      b.setAttribute('aria-pressed', String(getLocale() === locale));
      box.append(b);
    }
    return box;
  }

  function placeholder(title: TranslationKey, body: TranslationKey, params = {}): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h2', undefined, t(title)), el('p', undefined, t(body, params)));
    panel.append(el('p', undefined, t('common.comingSoon')));
    panel.append(button(t('common.back'), () => go('main')));
    return panel;
  }

  function mainPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h1', undefined, t('game.title')));

    const latest = latestGame(saves.list());
    if (latest) {
      const b = button('', () => {
        selected = latest;
        go('game');
      }, 'menu-btn primary');
      b.append(el('span', undefined, t('menu.continue')));
      b.append(
        el(
          'small',
          undefined,
          t('menu.continue.detail', { name: latest.name, date: formatDate(latest.lastSavedAt) }),
        ),
      );
      panel.append(b);
    }
    panel.append(
      button(t('menu.newGame'), () => go('newGame')),
      button(t('menu.loadGame'), () => go('loadGame')),
      button(t('menu.settings'), () => go('settings')),
    );
    if (canQuit()) panel.append(button(t('menu.quit'), () => window.close()));
    panel.append(languageSwitch());

    if (devMode) {
      const dev = el('div', 'dev');
      dev.append(
        button('[dev] + partie factice', () => {
          saves.addFake(`Partie ${saves.list().length + 1}`);
          render();
        }, ''),
        button('[dev] vider', () => {
          saves.clearFakes();
          render();
        }, ''),
      );
      panel.append(dev);
    }
    return panel;
  }

  function render(): void {
    root.replaceChildren();
    switch (screen) {
      case 'main':
        root.append(mainPanel());
        break;
      case 'newGame':
        root.append(placeholder('screen.newGame.title', 'screen.newGame.body'));
        break;
      case 'loadGame':
        root.append(placeholder('screen.loadGame.title', 'screen.loadGame.body'));
        break;
      case 'settings':
        root.append(placeholder('screen.settings.title', 'screen.settings.body'));
        break;
      case 'game':
        root.append(
          placeholder('screen.game.title', 'screen.game.body', { name: selected?.name ?? '' }),
        );
        break;
    }
    root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }

  onLocaleChange(render);
  render();
}
