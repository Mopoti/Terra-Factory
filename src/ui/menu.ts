import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import {
  lastSavedAt,
  latestGame,
  latestSlot,
  type GameSummary,
  type ProvisionalSaveIndex,
  type SaveSlot,
} from '../core/save/saveIndex';
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
  onStartGame: (game: GameSummary, slot?: SaveSlot) => void;
}

/** Monte le menu une seule fois ; la fonction renvoyée le remet sur l'écran principal. */
export function mountMenu(root: HTMLElement, options: MenuOptions): () => void {
  const { saves, devMode, onStartGame } = options;
  let screen: Screen = 'main';
  /** Partie dont on choisit la sauvegarde dans « Charger une partie ». */
  let loadingGame: GameSummary | null = null;

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

  /** Bouton « Continuer » : reprend la dernière sauvegarde de la partie la plus récente. */
  function continueButton(game: GameSummary): HTMLButtonElement {
    const b = button('', () => onStartGame(game, latestSlot(game)), 'menu-btn primary');
    b.append(el('span', undefined, t('menu.continue')));
    b.append(
      el(
        'small',
        undefined,
        t('menu.continue.detail', { name: game.name, date: formatDate(lastSavedAt(game)) }),
      ),
    );
    return b;
  }

  function mainPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h1', undefined, t('game.title')));

    const games = saves.list();
    const latest = latestGame(games);
    if (latest) panel.append(continueButton(latest));
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

  /** « Charger une partie » : d'abord la partie (le « dossier »), puis l'une de ses sauvegardes. */
  function loadGamePanel(): HTMLElement {
    const panel = el('div', 'panel wide');
    panel.append(el('h2', undefined, t('screen.loadGame.title')));
    const game = loadingGame ? saves.get(loadingGame.id) : undefined;

    if (!game) {
      loadingGame = null;
      panel.append(el('p', undefined, t('screen.loadGame.pick')));
      const sorted = [...saves.list()].sort((a, b) => lastSavedAt(b) - lastSavedAt(a));
      for (const g of sorted) {
        const b = button('', () => {
          loadingGame = g;
          render();
        });
        b.append(el('span', undefined, g.name));
        b.append(
          el(
            'small',
            undefined,
            `${formatDate(lastSavedAt(g))} · ${t('load.count', { n: String(g.saves.length) })}`,
          ),
        );
        panel.append(b);
      }
      panel.append(button(t('common.back'), () => go('main')));
      return panel;
    }

    panel.append(el('p', undefined, t('screen.loadGame.pickSave', { name: game.name })));
    const slots = [...game.saves].sort((a, b) => b.savedAt - a.savedAt);
    for (const slot of slots) {
      const b = button('', () => onStartGame(game, slot));
      const top = el('span', 'slot-meta');
      top.append(
        el('span', undefined, slot.name),
        el('span', `badge ${slot.kind}`, t(`save.kind.${slot.kind}` as TranslationKey)),
      );
      b.append(top, el('small', undefined, formatDate(slot.savedAt)));
      panel.append(b);
    }
    if (slots.length === 0) panel.append(button(t('load.noSave'), () => onStartGame(game)));
    panel.append(
      button(t('common.back'), () => {
        loadingGame = null;
        render();
      }),
    );
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

  return () => {
    loadingGame = null;
    go('main');
  };
}
