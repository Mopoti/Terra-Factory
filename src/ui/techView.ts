import { playSfx } from '../audio/sfx';
import { DISCOVERIES, type DiscoveryDef } from '../core/data/discoveries';
import { itemById } from '../core/data/items';
import { TECHS, isSciencePack, packCost, scienceCost, type TechDef } from '../core/data/techs';
import type { GameState } from '../core/game/state';
import type { CommandBus } from '../core/game/commands';
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
  actions: { onOpenChange(open: boolean): void; bus: CommandBus },
): TechWindow {
  let isOpenNow = false;
  let message = '';
  let stopWatching: () => void = () => {};

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
      if (isSciencePack(item)) continue;
      const have = state.inventory[item] ?? 0;
      const span = document.createElement('span');
      span.className = have >= n ? 'ok' : 'lack';
      span.textContent = `${itemName(item)} ${t('tech.have', { have: String(have), need: String(n) })}  `;
      cost.append(span);
    }
    const science = state.creative ? 0 : scienceCost(tech);
    if (science > 0) {
      const done = state.changes.packProgress[tech.id];
      for (const [pack, need] of Object.entries(packCost(tech))) {
        const line = document.createElement('span');
        const have = done
          ? (done[pack] ?? 0)
          : pack === 'science_pack'
            ? (state.changes.progress[tech.id] ?? 0)
            : 0;
        line.textContent = `${t('tech.science.pack', { pack: itemName(pack), have: String(have), need: String(need) })}  `;
        cost.append(line);
      }
    }
    box.append(cost);
    const unlocks = document.createElement('div');
    unlocks.className = 'tech-line sub';
    unlocks.textContent = `${t('tech.unlocks')} : ${tech.unlocks.map(itemName).join(', ')}`;
    box.append(unlocks);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-btn';
    const studying = state.changes.researching === tech.id;
    button.textContent = done
      ? t('tech.done')
      : science > 0
        ? studying
          ? t('tech.stop')
          : t('tech.study')
        : t('tech.research');
    button.disabled = done || blocked;
    button.addEventListener('click', () => {
      if (science > 0) {
        actions.bus.dispatch<'study'>({ type: 'study', tech: studying ? null : tech.id });
        playSfx('craft');
        message = studying
          ? ''
          : t('tech.studyStarted', { tech: t(`tech.${tech.id}` as TranslationKey) });
        render();
        return;
      }
      const result = actions.bus.dispatch<'research'>({ type: 'research', tech: tech.id });
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
    if (science > 0 && !done) {
      const hint = document.createElement('small');
      hint.className = 'help';
      hint.textContent = t('tech.labHint');
      box.append(hint);
    }
    // Objets débloqués : couleur d'accent.
    box.style.setProperty('--item', itemById(tech.unlocks[0]).color);
    return box;
  }

  /** Carte d'une découverte du tier 0 : pas de coût, un compteur d'objets fabriqués. */
  function discoveryCard(d: DiscoveryDef): HTMLElement {
    const done = state.changes.discovered.includes(d.id);
    const box = document.createElement('div');
    box.className = `tech-card${done ? ' done' : ''}`;
    const title = document.createElement('h3');
    title.textContent = itemName(d.unlocks[0]);
    const tier = document.createElement('div');
    tier.className = 'tech-line sub';
    tier.textContent = t('discovery.title');
    const goal = document.createElement('div');
    goal.className = `tech-line ${done ? 'ok' : ''}`;
    goal.textContent = t('discovery.progress', {
      have: String(state.discoveryProgress(d)),
      n: String(d.goal.count),
      item: itemName(d.goal.item).toLowerCase(),
    });
    const unlocks = document.createElement('div');
    unlocks.className = 'tech-line sub';
    unlocks.textContent = `${t('tech.unlocks')} : ${d.unlocks.map(itemName).join(', ')}`;
    const status = document.createElement('div');
    status.className = 'tech-line';
    status.textContent = done ? t('discovery.done') : '';
    box.append(title, tier, goal, unlocks, status);
    box.style.setProperty('--item', itemById(d.unlocks[0]).color);
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
    for (const d of DISCOVERIES) grid.append(discoveryCard(d));
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
    // Les compteurs avancent pendant que la fenêtre est ouverte.
    stopWatching = state.onChange((e) => {
      if (e.type === 'inventory' || e.type === 'discovery') render();
    });
    render();
    actions.onOpenChange(true);
  }

  function closeWindow(): void {
    if (!isOpenNow) return;
    isOpenNow = false;
    stopWatching();
    stopWatching = () => {};
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
