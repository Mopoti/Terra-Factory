export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}

/**
 * Fenêtre de confirmation (modale). Renvoie true si le joueur confirme, false s'il annule
 * (bouton Annuler, touche Échap ou clic en dehors). Le focus part sur « Annuler » pour éviter
 * une confirmation par erreur, puis revient à l'élément précédent.
 */
export function confirmModal(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.id = 'modal-title';
    title.textContent = options.title;
    const body = document.createElement('p');
    body.id = 'modal-body';
    body.textContent = options.body;
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.setAttribute('aria-describedby', body.id);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'menu-btn';
    cancel.textContent = options.cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'menu-btn danger';
    confirm.textContent = options.confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(title, body, actions);
    overlay.append(dialog);

    function close(result: boolean): void {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      previous?.focus({ preventScroll: true });
      resolve(result);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        (document.activeElement === cancel ? confirm : cancel).focus();
      }
    }
    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(false);
    });
    window.addEventListener('keydown', onKey, true);

    document.body.append(overlay);
    cancel.focus();
  });
}

export interface PromptOptions {
  title: string;
  label: string;
  value: string;
  confirmLabel: string;
  cancelLabel: string;
  maxLength?: number;
  /** Renvoie un message d'erreur (le bouton de validation est alors bloqué) ou null si la saisie convient. */
  validate?: (value: string) => string | null;
}

/** Fenêtre de saisie d'un texte. Renvoie le texte validé, ou null si le joueur annule. */
export function promptModal(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.textContent = options.title;
    title.id = 'prompt-title';
    dialog.setAttribute('aria-labelledby', title.id);

    const field = document.createElement('label');
    field.className = 'field';
    const label = document.createElement('span');
    label.textContent = options.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = options.value;
    input.maxLength = options.maxLength ?? 40;
    field.append(label, input);
    const error = document.createElement('small');
    error.className = 'help error';
    error.setAttribute('role', 'alert');

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'menu-btn';
    cancel.textContent = options.cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'menu-btn primary';
    confirm.textContent = options.confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(title, field, error, actions);
    overlay.append(dialog);

    const check = (): string | null => options.validate?.(input.value.trim()) ?? null;
    const refresh = (): void => {
      const message = check();
      error.textContent = message ?? '';
      confirm.disabled = message !== null;
    };
    function close(result: string | null): void {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      previous?.focus({ preventScroll: true });
      resolve(result);
    }
    function submit(): void {
      if (check() === null) close(input.value.trim());
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close(null);
      }
    }
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      // Sans cela, la même touche « Entrée » activerait aussi le bouton qui reçoit le focus ensuite.
      e.preventDefault();
      submit();
    });
    cancel.addEventListener('click', () => close(null));
    confirm.addEventListener('click', submit);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(null);
    });
    window.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    refresh();
    input.focus();
    input.select();
  });
}

/** Fenêtre d'information avec un seul bouton. */
export function infoModal(options: {
  title: string;
  body: string;
  okLabel: string;
}): Promise<void> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.textContent = options.title;
    const body = document.createElement('p');
    body.textContent = options.body;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'menu-btn primary';
    ok.textContent = options.okLabel;
    actions.append(ok);
    dialog.append(title, body, actions);
    overlay.append(dialog);
    function close(): void {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      previous?.focus({ preventScroll: true });
      resolve();
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    }
    ok.addEventListener('click', close);
    window.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    ok.focus();
  });
}
