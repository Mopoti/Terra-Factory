import { playSfx } from '../audio/sfx';
import { itemById } from '../core/data/items';
import { TECHS, type TechDef } from '../core/data/techs';
import type { GameState } from '../core/game/state';
import { t, type TranslationKey } from '../i18n';
import './menu.css';

export interface TechWindow {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

const itemName = (id: string): string => t(`item.${id}` as TranslationKey);

/** Fenêtre « Technologies » (touche T) : on rembourse le coût avec des objets du sac pour débloquer des fabrications. */
export function mountTech(
  root: HTMLElement,
  state: GameState,
  actions: { onOpenChange(open: boolean): void },
): TechWindow {
  let isOpenNow = false;
  let message = '';

  function card(tech: TechDef): HTMLElement {
    const done = state.changes.unlocked.includes(tech.id);
    const blocked = !tech.requires.every((r) => state.changes.unlocked.includes(r));
    const box = document.createElement('div');
    box.className = `tech-card${done ? ' done' : ''}${blocked ? ' blocked' : ''}`;
    const title = document.createElement('h3');
    title.textContent = t(`tech.${tech.id}` as TranslationKey);
    box.append(title);
    if (tech.requires.length > 0) {
      const req = document.createElement('div');
      req.className = 'tech-line';
      req.textContent = `${t('tech.requires')} : ${tech.requires.map((r) => t(`tech.${r}` as TranslationKey)).join(', ')}`;
      box.append(req);
    }
    const cost = document.createElement('div');
    cost.className = 'tech-line';
    cost.append(`${t('tech.cost')} : `);
    for (const [item, n] of Object.entries(tech.cost)) {
      const have = state.inventory[item] ?? 0;
      const span = document.createElement('span');
      span.className = have >= n ? 'ok' : 'lack';
      span.textContent = `${itemName(item)} ${t('tech.have', { have: String(have), need: String(n) })}  `;
      cost.append(span);
    }
    box.append(cost);
    const unlocks = document.createElement('div');
    unlocks.className = 'tech-line sub';
    unlocks.textContent = `${t('tech.unlocks')} : ${tech.unlocks.map(itemName).join(', ')}`;
    box.append(unlocks);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-btn';
    button.textContent = done ? t('tech.done') : t('tech.research');
    button.disabled = done || blocked;
    button.addEventListener('click', () => {
      const result = state.research(tech.id);
      playSfx(result === 'ok' ? 'craft' : 'deny');
      message =
        result === 'ok'
          ? t('tech.researched', { tech: t(`tech.${tech.id}` as TranslationKey) })
          : result === 'locked'
            ? t('tech.locked')
            : result === 'missing'
              ? t('tech.missing')
              : '';
      render();
    });
    box.append(button);
    // Objets débloqués : couleur d'accent.
    box.style.setProperty('--item', itemById(tech.unlocks[0]).color);
    return box;
  }

  function render(): void {
    const panel = document.createElement('div');
    panel.className = 'panel tech-panel';
    panel.setAttribute('role', 'dialog');
    const title = document.createElement('h2');
    title.textContent = t('tech.title');
    const grid = document.createElement('div');
    grid.className = 'tech-grid';
    for (const tech of TECHS) grid.append(card(tech));
    const msg = document.createElement('div');
    msg.className = 'inv-message';
    msg.textContent = message;
    const help = document.createElement('small');
    help.className = 'help';
    help.textContent = t('tech.help');
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'panel-close';
    x.textContent = '✕';
    x.title = t('inv.close');
    x.setAttribute('aria-label', t('inv.close'));
    x.addEventListener('click', closeWindow);
    panel.append(title, grid, msg, help, x);
    root.replaceChildren(panel);
  }

  function openWindow(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    message = '';
    root.hidden = false;
    render();
    actions.onOpenChange(true);
  }

  function closeWindow(): void {
    if (!isOpenNow) return;
    isOpenNow = false;
    root.hidden = true;
    root.replaceChildren();
    actions.onOpenChange(false);
  }

  const onKey = (e: KeyboardEvent): void => {
    if (isOpenNow && e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      closeWindow();
    }
  };
  window.addEventListener('keydown', onKey, true);
  root.hidden = true;

  return {
    open: openWindow,
    close: closeWindow,
    toggle: () => (isOpenNow ? closeWindow() : openWindow()),
    isOpen: () => isOpenNow,
    dispose: () => {
      closeWindow();
      window.removeEventListener('keydown', onKey, true);
    },
  };
}
