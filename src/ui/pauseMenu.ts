import { onLocaleChange, t } from '../i18n';
import { buildSettingsPanel } from './settingsScreen';
import './menu.css';

export interface PauseActions {
  /** Appelé quand le menu pause se ferme ou s'ouvre : met le jeu en pause / le relance. */
  onPausedChange(paused: boolean): void;
  /** Nom proposé par défaut pour une sauvegarde manuelle. */
  defaultSaveName(): string;
  /** Noms des sauvegardes manuelles existantes (pour prévenir d'un remplacement). */
  manualSaveNames(): string[];
  /** Enregistre une sauvegarde manuelle. */
  save(name: string): void;
  /** Multijoueur : ouvrir la partie aux invités (absent si la partie n'est pas multijoueur). */
  multi?: {
    code(): string | null;
    players(): string[];
    start(): Promise<string>;
    stop(): void;
  };
  /** Quitte vers le menu principal (une sauvegarde automatique est faite avant). */
  quit(): void;
}

export interface PauseMenu {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

type Screen = 'main' | 'save' | 'settings' | 'multi';

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

/**
 * Menu pause affiché par-dessus la partie : Reprendre, Sauvegarder, Paramètres, Quitter.
 * Échap l'ouvre ; dans un sous-écran, Échap revient au menu pause ; sur le menu pause, Échap reprend.
 */
export function mountPauseMenu(root: HTMLElement, actions: PauseActions): PauseMenu {
  let open = false;
  let screen: Screen = 'main';

  function button(label: string, onClick: () => void, className = 'menu-btn'): HTMLButtonElement {
    const b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function setScreen(next: Screen): void {
    screen = next;
    render();
  }

  function mainPanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(
      el('h1', undefined, t('pause.title')),
      button(t('pause.resume'), close, 'menu-btn primary'),
      button(t('pause.save'), () => setScreen('save')),
      ...(actions.multi ? [button(t('pause.multi'), () => setScreen('multi'))] : []),
      button(t('pause.settings'), () => setScreen('settings')),
    );
    const quit = button('', actions.quit);
    quit.append(
      el('span', undefined, t('pause.quit')),
      el('small', undefined, t('pause.quit.hint')),
    );
    panel.append(quit);
    return panel;
  }

  function savePanel(): HTMLElement {
    const panel = el('div', 'panel');
    panel.append(el('h2', undefined, t('pause.save.title')));
    const field = el('label', 'field');
    field.append(el('span', undefined, t('pause.save.name')));
    const input = el('input');
    input.type = 'text';
    input.maxLength = 40;
    input.value = actions.defaultSaveName();
    field.append(input);
    const hint = el('p', 'note');
    const names = actions.manualSaveNames();
    const refreshHint = (): void => {
      hint.textContent = names.includes(input.value.trim())
        ? t('pause.save.overwrite')
        : t('pause.save.new');
    };
    input.addEventListener('input', refreshHint);
    refreshHint();
    const confirm = (): void => {
      const name = input.value.trim() || t('save.defaultName');
      actions.save(name);
      close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      confirm();
    });
    panel.append(
      field,
      hint,
      button(t('pause.save.confirm'), confirm, 'menu-btn primary'),
      button(t('common.back'), () => setScreen('main')),
    );
    return panel;
  }

  let multiTimer = 0;
  function multiPanel(): HTMLElement {
    const panel = el('div', 'panel');
    const multi = actions.multi;
    panel.append(el('h2', undefined, t('pause.multi')));
    if (!multi) return panel;
    const status = el('p', 'note');
    const list = el('ul', 'mp-players');
    const code = multi.code();
    if (!code) {
      status.textContent = t('pause.multi.closed');
      const open = button(
        t('pause.multi.open'),
        () => {
          open.disabled = true;
          status.textContent = t('pause.multi.opening');
          multi.start().then(
            () => render(),
            () => {
              open.disabled = false;
              status.textContent = t('pause.multi.error');
            },
          );
        },
        'menu-btn primary',
      );
      panel.append(status, open);
    } else {
      const big = el('div', 'invite-code', code);
      const link = `${window.location.origin}${window.location.pathname}?join=${code}`;
      const copy = button(t('pause.multi.copy'), () => {
        void navigator.clipboard?.writeText(link);
        copy.textContent = t('pause.multi.copied');
      });
      status.textContent = t('pause.multi.open.help');
      panel.append(status, big, copy, el('h3', undefined, t('pause.multi.players')), list);
      const refresh = (): void => {
        list.replaceChildren(...multi.players().map((n) => el('li', undefined, n)));
      };
      refresh();
      window.clearInterval(multiTimer);
      multiTimer = window.setInterval(refresh, 1000);
      panel.append(
        button(t('pause.multi.stop'), () => {
          multi.stop();
          render();
        }),
      );
    }
    panel.append(button(t('common.back'), () => setScreen('main')));
    return panel;
  }

  function render(): void {
    window.clearInterval(multiTimer);
    root.replaceChildren(el('div', 'pause-dim'));
    if (screen === 'main') root.append(mainPanel());
    else if (screen === 'save') root.append(savePanel());
    else if (screen === 'multi') root.append(multiPanel());
    else root.append(buildSettingsPanel(() => setScreen('main'), render));
    root
      .querySelector<HTMLElement>(screen === 'save' ? 'input' : '.panel button')
      ?.focus({ preventScroll: true });
  }

  function openMenu(): void {
    if (open) return;
    open = true;
    screen = 'main';
    root.hidden = false;
    actions.onPausedChange(true);
    render();
  }

  function close(): void {
    if (!open) return;
    open = false;
    root.hidden = true;
    root.replaceChildren();
    actions.onPausedChange(false);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.repeat) return;
    if (!open) openMenu();
    else if (screen !== 'main') setScreen('main');
    else close();
  };
  window.addEventListener('keydown', onKey);
  const unsubscribeLocale = onLocaleChange(() => open && render());
  root.hidden = true;

  return {
    open: openMenu,
    close,
    toggle: () => (open ? close() : openMenu()),
    isOpen: () => open,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      unsubscribeLocale();
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
