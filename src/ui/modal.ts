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
