import type { SaveLibrary } from '../core/save/library';
import { splitPlayTime } from '../core/save/playTime';
import { getLocale, onLocaleChange, t, type TranslationKey } from '../i18n';
import {
  lastSavedAt,
  latestGame,
  latestSlot,
  type GameSummary,
  type SaveSlot,
} from '../core/save/saveIndex';
import { getSettings } from '../settings/store';
import {
  buildExchange,
  decodeExchange,
  encodeExchange,
  exchangeFileName,
  parseExchange,
} from '../core/save/exchange';
import { buildGameEditor } from './gameEditor';
import { downloadBlob, pickFile } from './files';
import { confirmModal, infoModal, promptModal } from './modal';
import { GuestClient, RefusedError } from '../core/net/guest';
import { parseInviteCode, type Network } from '../core/net/transport';
import { buildSettingsPanel } from './settingsScreen';
import './menu.css';

type Screen = 'main' | 'newGame' | 'loadGame' | 'settings' | 'join';

/** Icône « corbeille ». */
const TRASH_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

const svg = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
/** Crayon. */
const PENCIL_ICON = svg(
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
);
/** Deux feuilles. */
const COPY_ICON = svg(
  '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
);
/** Flèche vers le bas, vers un plateau. */
const DOWNLOAD_ICON = svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>');
/** Flèche vers le haut, depuis un plateau. */
const UPLOAD_ICON = svg('<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>');

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

/** « 2 h 05 min 09 s » : temps de jeu d'une sauvegarde. */
function formatPlayTime(seconds: number): string {
  const { h, m, s } = splitPlayTime(seconds);
  return t('menu.playTime', {
    h: String(h),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  });
}

function formatDate(ms: number): string {
  const format = getSettings().display.timeFormat;
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(format === 'auto' ? {} : { hour12: format === '12h' }),
  }).format(new Date(ms));
}

/** Ce qui a servi à rejoindre la partie (pour se reconnecter après une coupure). */
export interface JoinInfo {
  code: string;
  name: string;
  password: string;
}

export interface MenuOptions {
  saves: SaveLibrary;
  devMode: boolean;
  /** Appelé quand le joueur lance une partie (nouvelle, continuée ou chargée). */
  onStartGame: (game: GameSummary, slot?: SaveSlot) => void;
  /** Réseau réel (WebRTC) pour rejoindre la partie d'un autre joueur. */
  network?: Network;
  /** Rejoindre une partie : le client connecté démarre une partie « invité ». */
  onJoin?: (client: GuestClient, who: JoinInfo) => void;
}

/** Monte le menu une seule fois ; la fonction renvoyée le remet sur l'écran principal. */
export function mountMenu(root: HTMLElement, options: MenuOptions): () => void {
  const { saves, devMode, onStartGame } = options;
  let screen: Screen = 'main';
  /** Partie dont on choisit la sauvegarde dans « Charger une partie ». */
  let selectedGameId: string | null = null;
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
        t('menu.continue.detail', {
          name: game.name,
          save: latestSlot(game)?.name ?? '',
          date: formatDate(lastSavedAt(game)),
          time: formatPlayTime(latestSlot(game)?.changes.time ?? 0),
        }),
      ),
    );
    return b;
  }

  function mainPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h1', undefined, t('game.title')));
    const warning = storageWarning();
    if (warning) panel.append(warning);

    const games = saves.list();
    const latest = latestGame(games);
    if (latest) panel.append(continueButton(latest));
    panel.append(button(t('menu.newGame'), () => go('newGame')));
    if (games.length > 0) panel.append(button(t('menu.loadGame'), () => go('loadGame')));
    else panel.append(button(t('manage.import'), () => void importFromFile()));
    if (options.network) panel.append(button(t('menu.join'), () => go('join')));
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
    if (selectedGameId === game.id) selectedGameId = null;
    if (saves.list().length === 0) go('main');
    else render();
  }

  /** Message d'alerte si les parties ne sont pas conservées correctement. */
  function storageWarning(): HTMLElement | null {
    let key: TranslationKey | null = null;
    if (saves.storageKind === 'memory') key = 'storage.memory';
    else if (saves.failedWrites > 0) key = 'storage.failed';
    else if (saves.storageKind === 'localstorage') key = 'storage.localstorage';
    if (!key) return null;
    const box = el('p', 'warning', t(key));
    box.setAttribute('role', 'alert');
    return box;
  }

  function iconButton(
    icon: string,
    label: string,
    onClick: () => void,
    className = 'icon-btn',
  ): HTMLButtonElement {
    const b = button('', onClick, className);
    b.innerHTML = icon;
    b.title = label;
    b.setAttribute('aria-label', label);
    return b;
  }

  /** Message de retour affiché en haut de l'écran « Charger une partie ». */
  let notice = '';

  async function importFromFile(): Promise<void> {
    const file = await pickFile('.terra,.json,application/json,application/gzip');
    if (!file) return;
    const reasonKey = {
      invalid: 'import.error.invalid',
      format: 'import.error.format',
      newer: 'import.error.newer',
      empty: 'import.error.empty',
      tooBig: 'import.error.tooBig',
    } as const;
    const fail = (reason: keyof typeof reasonKey): Promise<void> =>
      infoModal({
        title: t('import.error.title'),
        body: t(reasonKey[reason]),
        okLabel: t('modal.ok'),
      });
    if (file.size > 80 * 1024 * 1024) return fail('tooBig');
    let text: string;
    try {
      text = await decodeExchange(await file.arrayBuffer());
    } catch {
      return fail('invalid');
    }
    const result = parseExchange(text);
    if (!result.ok) return fail(result.reason);
    const imported = saves.importGame(result.game);
    selectedGameId = imported.id;
    notice = t('manage.imported', { name: imported.name });
    if (screen === 'main') go('loadGame');
    else render();
  }

  async function exportGame(game: GameSummary): Promise<void> {
    const blob = await encodeExchange(buildExchange(game));
    const fileName = exchangeFileName(game);
    downloadBlob(blob, fileName);
    notice = t('manage.exported', { file: fileName });
    render();
  }

  async function renameGame(game: GameSummary): Promise<void> {
    const name = await promptModal({
      title: t('manage.renameGame.title'),
      label: t('manage.name'),
      value: game.name,
      confirmLabel: t('manage.rename.confirm'),
      cancelLabel: t('modal.cancel'),
      validate: (v) => (v === '' ? t('manage.nameEmpty') : null),
    });
    if (name === null) return;
    saves.renameGame(game.id, name);
    render();
  }

  function duplicateGame(game: GameSummary): void {
    const copy = saves.duplicateGame(game.id, t('manage.copyName', { name: game.name }));
    if (copy) notice = t('manage.duplicated', { name: copy.name });
    render();
  }

  async function renameSlot(game: GameSummary, slot: SaveSlot): Promise<void> {
    const name = await promptModal({
      title: t('manage.renameSlot.title'),
      label: t('manage.name'),
      value: slot.name,
      confirmLabel: t('manage.rename.confirm'),
      cancelLabel: t('modal.cancel'),
      validate: (v) => {
        if (v === '') return t('manage.nameEmpty');
        const taken = game.saves.some(
          (s) => s.id !== slot.id && s.kind === 'manual' && s.name === v,
        );
        return taken ? t('manage.nameTaken') : null;
      },
    });
    if (name === null) return;
    saves.renameSlot(game.id, slot.id, name);
    render();
  }

  function duplicateSlot(game: GameSummary, slot: SaveSlot): void {
    const copy = saves.duplicateSlot(game.id, slot.id, t('manage.copyName', { name: slot.name }));
    if (copy) notice = t('manage.duplicated', { name: copy.name });
    render();
  }

  async function deleteSlot(game: GameSummary, slot: SaveSlot): Promise<void> {
    if (getSettings().game.confirmDelete) {
      const ok = await confirmModal({
        title: t('modal.deleteSlot.title'),
        body: t('modal.deleteSlot.body', { name: slot.name }),
        confirmLabel: t('modal.deleteGame.confirm'),
        cancelLabel: t('modal.cancel'),
      });
      if (!ok) return;
    }
    saves.deleteSlot(game.id, slot.id);
    render();
  }

  /** « Charger une partie » : les parties à gauche, les sauvegardes de la partie choisie à droite. */
  function loadGamePanel(): HTMLElement {
    const panel = el('div', 'panel editor load');
    const head = el('div', 'panel-head');
    head.append(el('h2', undefined, t('screen.loadGame.title')));
    head.append(
      iconButton(UPLOAD_ICON, t('manage.import'), () => void importFromFile(), 'icon-btn text'),
    );
    panel.append(head);
    const warning = storageWarning();
    if (warning) panel.append(warning);
    if (notice) {
      const status = el('p', 'notice', notice);
      status.setAttribute('role', 'status');
      panel.append(status);
      notice = '';
    }

    const sorted = [...saves.list()].sort((a, b) => lastSavedAt(b) - lastSavedAt(a));
    if (sorted.length === 0) return panel;
    // La partie choisie, ou à défaut la plus récente.
    const game = sorted.find((g) => g.id === selectedGameId) ?? sorted[0];
    selectedGameId = game.id;

    const layout = el('div', 'editor-layout');
    const left = el('div', 'editor-form');
    left.append(el('h3', undefined, t('load.games')));
    for (const g of sorted) {
      const open = button('', () => {
        selectedGameId = g.id;
        render();
      });
      open.setAttribute('aria-pressed', String(g.id === game.id));
      open.classList.toggle('selected', g.id === game.id);
      open.append(el('span', undefined, g.name));
      open.append(
        el(
          'small',
          undefined,
          `${formatDate(lastSavedAt(g))} · ${t('load.count', { n: String(g.saves.length) })}`,
        ),
      );
      const row = el('div', 'game-row');
      row.append(
        open,
        iconButton(
          PENCIL_ICON,
          t('manage.renameGameLabel', { name: g.name }),
          () => void renameGame(g),
        ),
        iconButton(COPY_ICON, t('manage.duplicateGameLabel', { name: g.name }), () =>
          duplicateGame(g),
        ),
        iconButton(
          DOWNLOAD_ICON,
          t('manage.exportLabel', { name: g.name }),
          () => void exportGame(g),
        ),
        iconButton(
          TRASH_ICON,
          t('load.delete', { name: g.name }),
          () => void deleteGame(g),
          'icon-btn danger',
        ),
      );
      left.append(row);
    }

    const right = el('div', 'editor-side');
    right.append(
      el('h3', undefined, t('load.savesOf', { name: game.name })),
      el('small', 'help', t('manage.seedInfo', { seed: game.world.seed })),
    );
    const slots = [...game.saves].sort((a, b) => b.savedAt - a.savedAt);
    for (const slot of slots) {
      const b = button('', () => onStartGame(game, slot));
      const top = el('span', 'slot-meta');
      top.append(
        el('span', undefined, slot.name),
        el('span', `badge ${slot.kind}`, t(`save.kind.${slot.kind}` as TranslationKey)),
      );
      b.append(
        top,
        el(
          'small',
          undefined,
          `${formatDate(slot.savedAt)} · ${formatPlayTime(slot.changes.time)}`,
        ),
      );
      const row = el('div', 'game-row');
      row.append(b);
      if (slot.kind === 'auto') {
        // Même largeur que le crayon des sauvegardes manuelles : les icônes restent alignées.
        row.append(el('span', 'icon-spacer'));
      } else {
        row.append(
          iconButton(
            PENCIL_ICON,
            t('manage.renameSlotLabel', { name: slot.name }),
            () => void renameSlot(game, slot),
          ),
        );
      }
      row.append(
        iconButton(COPY_ICON, t('manage.duplicateSlotLabel', { name: slot.name }), () =>
          duplicateSlot(game, slot),
        ),
        iconButton(
          TRASH_ICON,
          t('manage.deleteSlot', { name: slot.name }),
          () => void deleteSlot(game, slot),
          'icon-btn danger',
        ),
      );
      right.append(row);
    }
    if (slots.length === 0) right.append(button(t('load.noSave'), () => onStartGame(game)));

    layout.append(left, right);
    panel.append(
      layout,
      button(t('common.back'), () => go('main')),
    );
    return panel;
  }

  /** Rejoindre la partie d'un autre joueur : code d'invitation, nom, mot de passe ; une fois accepté, la partie démarre. */
  function joinPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h2', undefined, t('menu.join')));
    const network = options.network;
    if (!network || !options.onJoin) return panel;
    const onJoin = options.onJoin;
    const fields = (label: string, type: string, value = ''): HTMLInputElement => {
      const f = el('label', 'field');
      f.append(el('span', undefined, label));
      const input = el('input');
      input.type = type;
      input.value = value;
      input.maxLength = 80;
      f.append(input);
      panel.append(f);
      return input;
    };
    const code = fields(
      t('join.code'),
      'text',
      new URLSearchParams(window.location.search).get('join') ?? '',
    );
    const who = fields(t('join.name'), 'text', t('join.defaultName'));
    const pass = fields(t('join.password'), 'password');
    const status = el('p', 'note');
    const go = button(
      t('join.connect'),
      () => {
        const parsed = parseInviteCode(code.value);
        if (!parsed) {
          status.textContent = t('join.badCode');
          return;
        }
        go.disabled = true;
        status.textContent = t('join.connecting');
        const info: JoinInfo = {
          code: parsed,
          name: who.value.trim() || 'Joueur',
          password: pass.value,
        };
        GuestClient.connect(network, info.code, {
          name: info.name,
          password: info.password,
        }).then(
          (g) => onJoin(g, info),
          (e: unknown) => {
            go.disabled = false;
            status.textContent =
              e instanceof RefusedError
                ? t(`join.refused.${e.reason}` as TranslationKey)
                : t('join.unreachable');
          },
        );
      },
      'menu-btn primary',
    );
    panel.append(
      status,
      go,
      button(t('common.back'), () => go_('main')),
    );
    return panel;
  }
  const go_ = (next: Screen): void => go(next);

  function render(): void {
    // Plus aucune partie (la dernière vient d'être supprimée) : retour à l'écran principal.
    if (screen === 'loadGame' && saves.list().length === 0) screen = 'main';
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
      case 'join':
        root.append(joinPanel());
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
    selectedGameId = null;
    go('main');
  };
}
