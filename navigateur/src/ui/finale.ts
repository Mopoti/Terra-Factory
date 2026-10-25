import { t, type TranslationKey } from '../i18n';

const LINES: TranslationKey[] = ['finale.line1', 'finale.line2', 'finale.line3', 'finale.line4'];

/** Séquence finale : les messages s'affichent un à un, puis « Continuer la partie ». Renvoie une fonction pour la fermer. */
export function showFinale(container: HTMLElement, onClose: () => void): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'finale';
  overlay.setAttribute('role', 'dialog');
  const box = document.createElement('div');
  box.className = 'finale-box';
  overlay.append(box);
  container.append(overlay);
  const timers: number[] = [];
  LINES.forEach((key, i) => {
    timers.push(
      window.setTimeout(
        () => {
          const p = document.createElement('p');
          p.textContent = t(key);
          box.append(p);
          if (i === LINES.length - 1) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'menu-btn primary';
            b.textContent = t('finale.continue');
            b.addEventListener('click', close);
            box.append(b);
          }
        },
        1200 + i * 2600,
      ),
    );
  });
  function close(): void {
    for (const id of timers) window.clearTimeout(id);
    overlay.remove();
    onClose();
  }
  return close;
}
