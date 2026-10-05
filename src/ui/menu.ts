import { getLocale, onLocaleChange, t } from '../i18n';
import { latestGame, type GameSummary, type ProvisionalSaveIndex } from '../core/save/saveIndex';
import { getSettings } from '../settings/store';
import { buildSettingsPanel } from './settingsScreen';
import './menu.css';

type Screen = 'main' | 'newGame' | 'loadGame' | 'settings';

/** Icône « mélanger » (deux flèches qui se croisent). */
const SHUFFLE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Seed aléatoire lisible (sans caractères ambigus). Le hasard est permis ici : c'est de l'interface, pas du monde. */
export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join('');
}

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
  const format = getSettings().display.timeFormat;
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(format === 'auto' ? {} : { hour12: format === '12h' }),
  }).format(new Date(ms));
}

export interface MenuOptions {
  saves: ProvisionalSaveIndex;
  devMode: boolean;
  /** Appelé quand le joueur lance une partie (nouvelle, continuée ou chargée). */
  onStartGame: (game: GameSummary) => void;
}

/** Monte le menu une seule fois ; la fonction renvoyée le remet sur l'écran principal. */
export function mountMenu(root: HTMLElement, options: MenuOptions): () => void {
  const { saves, devMode, onStartGame } = options;
  let screen: Screen = 'main';

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

    const nameField = el('label', 'field');
    nameField.append(el('span', undefined, t('screen.newGame.name')));
    const nameInput = el('input');
    nameInput.type = 'text';
    nameInput.maxLength = 40;
    nameInput.value = t('screen.newGame.defaultName', { n: String(saves.list().length + 1) });
    nameField.append(nameInput);

    const seedField = el('div', 'field');
    seedField.append(el('label', undefined, t('screen.newGame.seed')));
    const seedRow = el('div', 'seed-row');
    const seedInput = el('input');
    seedInput.type = 'text';
    seedInput.maxLength = 40;
    seedInput.value = randomSeed();
    seedInput.id = 'seed-input';
    seedField.firstElementChild?.setAttribute('for', 'seed-input');
    const shuffle = el('button', 'icon-btn');
    shuffle.type = 'button';
    shuffle.title = t('screen.newGame.shuffle');
    shuffle.setAttribute('aria-label', t('screen.newGame.shuffle'));
    shuffle.innerHTML = SHUFFLE_ICON;
    shuffle.addEventListener('click', () => {
      seedInput.value = randomSeed();
      seedInput.focus();
    });
    seedRow.append(seedInput, shuffle);
    seedField.append(seedRow, el('small', 'help', t('screen.newGame.seedHelp')));

    panel.append(nameField, seedField);
    const launch = (): void => {
      const name = nameInput.value.trim() || t('screen.newGame.defaultName', { n: '1' });
      const seed = seedInput.value.trim() || randomSeed();
      onStartGame(saves.create(name, seed));
    };
    for (const input of [nameInput, seedInput]) {
      input.addEventListener('keydown', (e) => e.key === 'Enter' && launch());
    }
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
        root.append(buildSettingsPanel(() => go('main'), render));
        break;
    }
    const first = screen === 'newGame' ? root.querySelector('input') : root.querySelector('button');
    first?.focus({ preventScroll: true });
  }

  onLocaleChange(render);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden && screen !== 'main') go('main');
  });
  render();

  return () => go('main');
}
