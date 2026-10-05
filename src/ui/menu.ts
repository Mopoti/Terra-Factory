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
import { buildGameEditor } from './gameEditor';
import { confirmModal } from './modal';
import { buildSettingsPanel } from './settingsScreen';
import './menu.css';

type Screen = 'main' | 'newGame' | 'loadGame' | 'settings';

/** Icône « corbeille ». */
const TRASH_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

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
  /** Arrête les calculs de l'écran d'édition quand on le quitte. */
  let disposeEditor: () => void = () => undefined;

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
    const editor = buildGameEditor({
      saves,
      defaultName: t('screen.newGame.defaultName', { n: String(saves.list().length + 1) }),
      onLaunch: (game) => onStartGame(game),
      onBack: () => go('main'),
    });
    disposeEditor = editor.dispose;
    return editor.element;
  }

  /** Supprime une partie après confirmation (sauf si le joueur a désactivé la confirmation). */
  async function deleteGame(game: GameSummary): Promise<void> {
    if (getSettings().game.confirmDelete) {
      const ok = await confirmModal({
        title: t('modal.deleteGame.title'),
        body: t('modal.deleteGame.body', { name: game.name, n: String(game.saves.length) }),
        confirmLabel: t('modal.deleteGame.confirm'),
        cancelLabel: t('modal.cancel'),
      });
      if (!ok) return;
    }
    saves.deleteGame(game.id);
    if (saves.list().length === 0) go('main');
    else render();
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
        const open = button('', () => {
          loadingGame = g;
          render();
        });
        open.append(el('span', undefined, g.name));
        open.append(
          el(
            'small',
            undefined,
            `${formatDate(lastSavedAt(g))} · ${t('load.count', { n: String(g.saves.length) })}`,
          ),
        );
        const trash = button('', () => void deleteGame(g), 'icon-btn danger');
        trash.innerHTML = TRASH_ICON;
        const label = t('load.delete', { name: g.name });
        trash.title = label;
        trash.setAttribute('aria-label', label);
        const row = el('div', 'game-row');
        row.append(open, trash);
        panel.append(row);
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
    disposeEditor();
    disposeEditor = () => undefined;
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
