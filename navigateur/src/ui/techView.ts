import { playSfx } from '../audio/sfx';
import { ITEMS } from '../core/data/items';
import { RECIPES } from '../core/data/recipes';
import {
  TECHS,
  isSciencePack,
  scienceCost,
  techById,
  techStatus,
  treeParents,
  type TechDef,
  type TechStatus,
} from '../core/data/techs';
import type { GameState } from '../core/game/state';
import type { CommandBus } from '../core/game/commands';
import { t, type TranslationKey } from '../i18n';
import { itemIcon } from './itemIcon';
import { NODE_H, NODE_W, layoutTree } from './techLayout';
import './menu.css';

export interface TechWindow {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

const itemName = (id: string): string => t(`item.${id}` as TranslationKey);
const techName = (id: string): string => t(`tech.${id}` as TranslationKey);
const ORDER = new Map(TECHS.map((tech, i) => [tech.id, i]));
const byOrder = (a: TechDef, b: TechDef): number =>
  a.tier - b.tier || (ORDER.get(a.id) ?? 0) - (ORDER.get(b.id) ?? 0);
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
/** Objet qui illustre une découverte : le premier qu'elle débloque. */
const iconItem = (tech: TechDef): string | null => tech.unlocks[0] ?? null;

/**
 * Écran « Découvertes » (touche T) : à droite (2/3) l'arbre entier ; à gauche (1/3), en haut la découverte choisie (image,
 * coût, objets débloqués dont le survol donne le coût de fabrication), en bas la liste dans l'ordre — en orange les
 * prochaines, en rouge celles à qui il manque un prérequis, puis après une ligne les découvertes déjà faites en vert.
 */
export function mountTech(
  root: HTMLElement,
  state: GameState,
  actions: { onOpenChange(open: boolean): void; bus: CommandBus },
): TechWindow {
  let isOpenNow = false;
  let message = '';
  let showLog = false;
  let sel: string | null = null;
  let stopWatching: () => void = () => {};
  const layout = layoutTree(TECHS);
  const known = (): string[] => state.changes.unlocked;
  const statusOf = (tech: TechDef): TechStatus => techStatus(tech, known());

  // Éléments vivants de l'écran (recréés à chaque ouverture).
  let treeView: HTMLElement;
  let world: HTMLElement;
  let nodes = new Map<string, HTMLElement>();
  let edgeEls: { el: SVGPathElement; from: string; to: string }[] = [];
  let detailEl: HTMLElement;
  let listEl: HTMLElement;
  let tip: HTMLElement;
  const view = { x: 0, y: 0, z: 1 };

  const applyView = (): void => {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  };
  const fit = (): void => {
    const r = treeView.getBoundingClientRect();
    if (r.width === 0) return;
    view.z = Math.min(1, r.width / layout.width, r.height / layout.height);
    view.x = (r.width - layout.width * view.z) / 2;
    view.y = 8;
    applyView();
  };
  const zoomAt = (factor: number, cx: number, cy: number): void => {
    const z = Math.max(0.2, Math.min(1.6, view.z * factor));
    view.x = cx - ((cx - view.x) / view.z) * z;
    view.y = cy - ((cy - view.y) / view.z) * z;
    view.z = z;
    applyView();
  };
  const focus = (id: string): void => {
    const p = layout.pos.get(id);
    const r = treeView.getBoundingClientRect();
    if (!p || r.width === 0) return;
    view.z = Math.max(view.z, 0.7);
    view.x = r.width / 2 - (p.x + NODE_W / 2) * view.z;
    view.y = r.height * 0.3 - (p.y + NODE_H / 2) * view.z;
    applyView();
  };

  const select = (id: string, centre: boolean): void => {
    sel = id;
    message = '';
    showLog = false;
    refresh();
    if (centre) focus(id);
  };

  function ancestorsOf(id: string, into = new Set<string>()): Set<string> {
    for (const p of treeParents(techById(id)))
      if (!into.has(p)) {
        into.add(p);
        ancestorsOf(p, into);
      }
    return into;
  }

  /** Coût de fabrication d'un objet : à la main si possible, sinon par la première recette de machine. */
  function craftText(item: string): string {
    const list = (m: Record<string, number>): string =>
      Object.entries(m)
        .map(([i, n]) => `${n} × ${itemName(i)}`)
        .join(' + ');
    const hand = state.recipeFor(item);
    if (hand) return t('tech.craft.hand', { list: list(hand) });
    const r = RECIPES.find((x) => x.out[item] !== undefined);
    if (r) {
      const machine = ITEMS.some((i) => i.id === `machine_${r.machine}`)
        ? itemName(`machine_${r.machine}`)
        : r.machine;
      return t('tech.craft.machine', { machine, s: String(r.seconds), list: list(r.in) });
    }
    return t('tech.craft.none');
  }

  function showTip(item: string, e: MouseEvent): void {
    tip.replaceChildren(el('b', '', itemName(item)), el('div', '', craftText(item)));
    tip.hidden = false;
    const r = root.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 260)}px`;
    tip.style.top = `${e.clientY - r.top + 16}px`;
  }

  function costLines(tech: TechDef): HTMLElement[] {
    const lines: HTMLElement[] = [];
    const needs = state.techCost(tech);
    const res = el('div', 'tech-line');
    for (const [item, n] of Object.entries(needs)) {
      if (isSciencePack(item)) continue;
      const have = state.inventory[item] ?? 0;
      const span = el(
        'span',
        have >= n ? 'ok' : 'lack',
        `${itemName(item)} ${t('tech.have', { have: String(have), need: String(n) })}  `,
      );
      res.append(span);
    }
    if (res.childNodes.length > 0) lines.push(res);
    if (!state.creative && scienceCost(tech) > 0) {
      const done = state.changes.packProgress[tech.id];
      const packs = el('div', 'tech-line');
      for (const [pack, need] of Object.entries(state.packCostOf(tech))) {
        const have = done
          ? (done[pack] ?? 0)
          : pack === 'science_pack'
            ? (state.changes.progress[tech.id] ?? 0)
            : 0;
        packs.append(
          el(
            'span',
            have >= need ? 'ok' : '',
            `${t('tech.science.pack', { pack: itemName(pack), have: String(have), need: String(need) })}  `,
          ),
        );
      }
      lines.push(packs);
    }
    return lines;
  }

  function actionButton(tech: TechDef): HTMLButtonElement {
    const done = known().includes(tech.id);
    const blocked = !tech.requires.every((r) => known().includes(r));
    const science = state.creative ? 0 : scienceCost(tech);
    const studying = state.changes.researching === tech.id;
    const button = el('button', 'menu-btn');
    button.type = 'button';
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
        message = studying ? '' : t('tech.studyStarted', { tech: techName(tech.id) });
        refresh();
        return;
      }
      const result = actions.bus.dispatch<'research'>({ type: 'research', tech: tech.id });
      playSfx(result === 'ok' ? 'craft' : 'deny');
      message =
        result === 'ok'
          ? t('tech.researched', { tech: techName(tech.id) })
          : result === 'locked'
            ? t('tech.locked')
            : result === 'missing'
              ? t('tech.missing')
              : '';
      refresh();
    });
    return button;
  }

  function renderDetail(): void {
    const head = el('div', 'tech-head');
    const journal = el(
      'button',
      'menu-btn tech-journal-btn',
      showLog ? t('tech.journal.back') : t('tech.journal'),
    );
    journal.type = 'button';
    journal.addEventListener('click', () => {
      showLog = !showLog;
      refresh();
    });
    const close = el('button', 'panel-close', '✕');
    close.type = 'button';
    close.title = t('inv.close');
    close.setAttribute('aria-label', t('inv.close'));
    close.addEventListener('click', closeWindow);
    head.append(el('h2', '', t('tech.title')), journal, close);
    const body = el('div', 'tech-body');
    const tech = sel ? techById(sel) : null;
    if (!tech) body.append(el('p', 'tech-line sub', t('tech.pick')));
    else {
      const status = statusOf(tech);
      const top = el('div', 'tech-top');
      const pic = el('div', `tech-pic ${status}`);
      const icon = iconItem(tech);
      if (icon) pic.append(itemIcon(icon));
      else pic.append(el('span', 'tech-glyph', '✦'));
      const titles = el('div', 'tech-titles');
      titles.append(
        el('h3', '', techName(tech.id)),
        el('div', 'tech-line sub', t('tech.tier', { n: String(tech.tier) })),
      );
      top.append(pic, titles);
      body.append(top, ...costLines(tech));
      if (status === 'near' || status === 'far') {
        const missing = tech.requires.filter((r) => !known().includes(r));
        body.append(
          el(
            'div',
            'tech-line lack',
            t('tech.missingReq', { names: missing.map(techName).join(', ') }),
          ),
        );
      }
      const unlocks = el('div', 'tech-unlocks');
      for (const item of tech.unlocks) {
        const chip = el('span', 'tech-unlock');
        chip.append(itemIcon(item), el('span', '', itemName(item)));
        chip.addEventListener('mousemove', (e) => showTip(item, e));
        chip.addEventListener('mouseleave', () => (tip.hidden = true));
        unlocks.append(chip);
      }
      if (tech.unlocks.length === 0)
        unlocks.append(el('div', 'tech-line sub', t(`tech.effect.${tech.id}` as TranslationKey)));
      body.append(unlocks, actionButton(tech));
    }
    if (message) body.append(el('div', 'inv-message', message));
    detailEl.replaceChildren(head, body);
  }

  function journalList(): HTMLElement {
    const list = el('div', 'game-log');
    const entries = [...state.changes.log].reverse();
    if (entries.length === 0) {
      list.append(t('tech.journal.empty'));
      return list;
    }
    for (const e of entries) {
      const row = el('div', `game-log-row ${e.kind}`);
      row.append(
        el('time', '', new Date(e.t).toLocaleString()),
        t(`log.${e.kind}` as TranslationKey, {
          name: e.kind === 'discovery' ? e.id : techName(e.id),
        }),
      );
      list.append(row);
    }
    return list;
  }

  function row(tech: TechDef, status: TechStatus): HTMLElement {
    const r = el('button', `tech-row ${status}${tech.id === sel ? ' sel' : ''}`);
    r.type = 'button';
    const icon = iconItem(tech);
    if (icon) r.append(itemIcon(icon));
    const text = el('span', 'tech-row-text');
    text.append(el('b', '', techName(tech.id)));
    if (status === 'near')
      text.append(
        el(
          'small',
          '',
          t('tech.missingReq', {
            names: tech.requires
              .filter((q) => !known().includes(q))
              .map(techName)
              .join(', '),
          }),
        ),
      );
    r.append(text, el('span', 'tech-row-tier', `T${tech.tier}`));
    r.addEventListener('click', () => select(tech.id, true));
    return r;
  }

  function renderList(): void {
    const scroll = listEl.scrollTop;
    if (showLog) {
      listEl.replaceChildren(journalList());
      return;
    }
    const all = [...TECHS].sort(byOrder);
    const pick = (s: TechStatus): TechDef[] => all.filter((x) => statusOf(x) === s);
    const done = el('div', 'tech-done');
    done.append(...pick('done').map((x) => row(x, 'done')));
    listEl.replaceChildren(
      ...pick('next').map((x) => row(x, 'next')),
      ...pick('near').map((x) => row(x, 'near')),
      el('hr', 'tech-sep'),
      done,
    );
    listEl.scrollTop = scroll;
  }

  function renderTree(): void {
    const chain = sel ? new Set([sel, ...ancestorsOf(sel)]) : null;
    for (const tech of TECHS) {
      const node = nodes.get(tech.id);
      if (!node) continue;
      node.className = `tech-node ${statusOf(tech)}${tech.id === sel ? ' sel' : ''}${chain && !chain.has(tech.id) ? ' dim' : ''}`;
    }
    for (const e of edgeEls) {
      const on = !!chain && chain.has(e.from) && chain.has(e.to);
      e.el.setAttribute('class', `tech-edge${on ? ' on' : chain ? ' dim' : ''}`);
    }
  }

  function refresh(): void {
    renderDetail();
    renderList();
    renderTree();
  }

  function buildTree(): void {
    world = el('div', 'tech-world');
    world.style.width = `${layout.width}px`;
    world.style.height = `${layout.height}px`;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(layout.width));
    svg.setAttribute('height', String(layout.height));
    svg.setAttribute('class', 'tech-edges');
    edgeEls = layout.edges.map((e) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', e.path);
      svg.append(path);
      return { el: path, from: e.from, to: e.to };
    });
    world.append(svg);
    nodes = new Map();
    for (const tech of TECHS) {
      const p = layout.pos.get(tech.id);
      if (!p) continue;
      const node = el('button', 'tech-node far');
      node.type = 'button';
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
      node.style.width = `${NODE_W}px`;
      node.style.height = `${NODE_H}px`;
      node.title = techName(tech.id);
      const icon = iconItem(tech);
      if (icon) node.append(itemIcon(icon));
      node.append(
        el('span', 'tech-node-name', techName(tech.id)),
        el('span', 'tech-node-tier', `T${tech.tier}`),
      );
      node.addEventListener('click', () => {
        if (!dragged) select(tech.id, false);
      });
      nodes.set(tech.id, node);
      world.append(node);
    }
    treeView.replaceChildren(world);
    const tools = el('div', 'tech-tools');
    const mk = (label: string, title: string, on: () => void): HTMLButtonElement => {
      const b = el('button', 'menu-btn', label);
      b.type = 'button';
      b.title = title;
      b.addEventListener('click', on);
      return b;
    };
    const mid = (): [number, number] => {
      const r = treeView.getBoundingClientRect();
      return [r.width / 2, r.height / 2];
    };
    tools.append(
      mk('−', t('tech.zoomOut'), () => zoomAt(0.8, ...mid())),
      mk('+', t('tech.zoomIn'), () => zoomAt(1.25, ...mid())),
      mk('⤢', t('tech.fit'), fit),
    );
    treeView.append(tools, el('div', 'tech-hint', t('tech.navHint')));
  }

  let dragged = false;
  function wirePan(): void {
    let start: { x: number; y: number; vx: number; vy: number; id: number } | null = null;
    treeView.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.tech-tools')) return;
      start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, id: e.pointerId };
      dragged = false;
    });
    treeView.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (!dragged) treeView.setPointerCapture(start.id);
      dragged = true;
      view.x = start.vx + dx;
      view.y = start.vy + dy;
      applyView();
    });
    const end = (): void => {
      start = null;
      setTimeout(() => (dragged = false), 0);
    };
    treeView.addEventListener('pointerup', end);
    treeView.addEventListener('pointercancel', end);
    treeView.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Ctrl + molette : zoom autour du curseur ; molette seule : on fait défiler l'arbre.
        if (e.ctrlKey) {
          const r = treeView.getBoundingClientRect();
          zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
        } else {
          view.x -= e.shiftKey ? e.deltaY : e.deltaX;
          view.y -= e.shiftKey ? 0 : e.deltaY;
          applyView();
        }
      },
      { passive: false },
    );
  }

  function openWindow(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    message = '';
    showLog = false;
    root.hidden = false;
    const screen = el('div', 'tech-screen');
    const left = el('div', 'tech-left');
    detailEl = el('section', 'tech-detail');
    listEl = el('section', 'tech-list');
    left.append(detailEl, listEl);
    treeView = el('section', 'tech-tree');
    tip = el('div', 'tech-tip');
    tip.hidden = true;
    screen.append(left, treeView, tip);
    root.replaceChildren(screen);
    buildTree();
    wirePan();
    if (!sel || !ORDER.has(sel))
      sel = TECHS.filter((x) => statusOf(x) === 'next').sort(byOrder)[0]?.id ?? null;
    refresh();
    fit();
    if (sel) requestAnimationFrame(() => focus(sel as string));
    // Les compteurs avancent pendant que la fenêtre est ouverte.
    stopWatching = state.onChange((e) => {
      if (e.type === 'inventory' || e.type === 'discovery') refresh();
    });
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
