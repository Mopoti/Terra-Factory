import { t } from '../i18n';
import './menu.css';

export interface Chat {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
  /** Ajoute une ligne à l'historique visible (message du jeu). */
  say(text: string, ok?: boolean): void;
  dispose(): void;
}

const MAX_LINES = 8;
const FADE_MS = 9000;

/**
 * Chat et commandes : Entrée ouvre une ligne de saisie (le curseur y est), Entrée envoie, Échap ferme. Les dernières
 * lignes restent affichées quelques secondes. Le texte tapé est confié à `onSubmit`, qui renvoie la réponse.
 */
export function mountChat(
  root: HTMLElement,
  actions: {
    onOpenChange(open: boolean): void;
    onSubmit(line: string): { ok: boolean; text: string };
  },
): Chat {
  let isOpenNow = false;
  const history: string[] = [];
  let historyIndex = 0;
  const log = document.createElement('div');
  log.className = 'chat-log';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-input';
  input.placeholder = t('chat.placeholder');
  input.maxLength = 200;
  input.hidden = true;
  input.autocomplete = 'off';
  root.replaceChildren(log, input);
  root.hidden = false;

  const say = (text: string, ok = true): void => {
    const line = document.createElement('div');
    line.className = ok ? 'chat-line' : 'chat-line bad';
    line.textContent = text;
    log.append(line);
    while (log.childElementCount > MAX_LINES) log.firstElementChild?.remove();
    window.setTimeout(() => line.classList.add('old'), FADE_MS);
  };

  function open(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    root.classList.add('open');
    input.hidden = false;
    input.value = '';
    historyIndex = history.length;
    actions.onOpenChange(true);
    input.focus();
  }

  function close(): void {
    if (!isOpenNow) return;
    isOpenNow = false;
    root.classList.remove('open');
    input.hidden = true;
    input.blur();
    actions.onOpenChange(false);
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value.trim();
      close();
      if (!line) return;
      history.push(line);
      say(`> ${line}`);
      const answer = actions.onSubmit(line);
      say(answer.text, answer.ok);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    }
  });
  // Échap ferme le chat sans ouvrir le menu pause.
  const onEscape = (e: KeyboardEvent): void => {
    if (isOpenNow && e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', onEscape, true);

  return {
    toggle: () => (isOpenNow ? close() : open()),
    close,
    isOpen: () => isOpenNow,
    say,
    dispose: () => {
      window.removeEventListener('keydown', onEscape, true);
      close();
      root.replaceChildren();
    },
  };
}
