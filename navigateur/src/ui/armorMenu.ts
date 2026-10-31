import type { GameState } from '../core/game/state';
import { t, type TranslationKey } from '../i18n';
import './menu.css';

export interface ArmorMenu {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

/** Une option d'un avantage (ex. mode simple de la réalité augmentée). */
interface Choice {
  label: string;
  active: boolean;
  /** Applique l'option ; renvoie un message d'erreur à montrer, ou null. */
  apply(): string | null;
}

/** Un avantage offert par une pièce d'armure portée. */
interface Advantage {
  id: string;
  label: string;
  /** Texte de l'état actuel, montré sous le nom. */
  status: string;
  choices: Choice[];
}

const SVG = 'http://www.w3.org/2000/svg';
const R_OUT = 140;
const R_IN = 66;
const GAP_RAD = 0.04;

const point = (r: number, a: number): string =>
  `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;

/** Secteur d'anneau entre les angles `a0` et `a1` (radians, 0 = à droite, sens horaire). */
function sectorPath(a0: number, a1: number): string {
  const end = Math.min(a1, a0 + Math.PI * 2 - 0.001);
  const large = end - a0 > Math.PI ? 1 : 0;
  return [
    `M ${point(R_OUT, a0)}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${point(R_OUT, end)}`,
    `L ${point(R_IN, end)}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${point(R_IN, a0)}`,
    'Z',
  ].join(' ');
}

/**
 * Menu circulaire de l'armure active : un anneau au centre de l'écran liste les avantages des pièces portées.
 * Choisir un avantage ouvre l'anneau de ses options ; choisir une option l'applique ; le centre revient en arrière.
 */
export function mountArmorMenu(
  root: HTMLElement,
  state: GameState,
  actions: { onOpenChange(open: boolean): void; onMessage(text: string): void },
): ArmorMenu {
  let isOpenNow = false;
  /** Avantage dont on voit les options (null = anneau des avantages). */
  let openedAdvantage: string | null = null;

  const advantages = (): Advantage[] => {
    const list: Advantage[] = [];
    if (state.arAvailable()) {
      const modes = [0, 1, 2] as const;
      list.push({
        id: 'ar',
        label: t('armor.ar'),
        status: t(`ar.mode.${state.arMode}` as TranslationKey),
        choices: modes.map((mode) => ({
          label: t(`armor.ar.${mode}` as TranslationKey),
          active: state.arMode === mode,
          apply: () => {
            const r = state.setAr(mode);
            return r === 'ok' ? null : t(`ar.${r}` as TranslationKey);
          },
        })),
      });
    }
    if (state.exoAvailable()) {
      list.push({
        id: 'exo',
        label: t('armor.exo'),
        status: t(state.exoOn ? 'armor.exo.1' : 'armor.exo.0'),
        choices: [false, true].map((on) => ({
          label: t(on ? 'armor.exo.1' : 'armor.exo.0'),
          active: state.exoOn === on,
          apply: () => {
            const r = state.setExo(on);
            return r === 'ok' ? null : t(`exo.${r}` as TranslationKey);
          },
        })),
      });
    }
    if (state.hasExtraBar()) {
      list.push({
        id: 'bar',
        label: t('armor.bar'),
        status: t(state.extraBarEnabled ? 'armor.exo.1' : 'armor.exo.0'),
        choices: [false, true].map((on) => ({
          label: t(on ? 'armor.exo.1' : 'armor.exo.0'),
          active: state.extraBarEnabled === on,
          apply: () => {
            const r = state.setExtraBar(on);
            return r === 'ok' ? null : t(`armor.noPart.${r}` as TranslationKey);
          },
        })),
      });
    }
    if (state.gauntletAvailable()) {
      list.push({
        id: 'hands',
        label: t('armor.hands'),
        status: t(state.gauntletEnabled ? 'armor.exo.1' : 'armor.exo.0'),
        choices: [false, true].map((on) => ({
          label: t(on ? 'armor.exo.1' : 'armor.exo.0'),
          active: state.gauntletEnabled === on,
          apply: () => {
            const r = state.setGauntlet(on);
            return r === 'ok' ? null : t(`armor.noPart.${r}` as TranslationKey);
          },
        })),
      });
    }
    if (state.bootsAvailable()) {
      list.push({
        id: 'boots',
        label: t('armor.boots'),
        status: t(state.bootsEnabled ? 'armor.exo.1' : 'armor.exo.0'),
        choices: [false, true].map((on) => ({
          label: t(on ? 'armor.exo.1' : 'armor.exo.0'),
          active: state.bootsEnabled === on,
          apply: () => {
            const r = state.setBoots(on);
            return r === 'ok' ? null : t(`armor.noPart.${r}` as TranslationKey);
          },
        })),
      });
    }
    return list;
  };

  function build(): void {
    root.replaceChildren();
    const list = advantages();
    const panel = document.createElement('div');
    panel.className = 'armor-menu';
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '-150 -150 300 300');
    const adv = list.find((a) => a.id === openedAdvantage) ?? null;
    if (!adv) openedAdvantage = null;
    const entries: { label: string; sub: string; active: boolean; pick: () => void }[] = adv
      ? adv.choices.map((c) => ({
          label: c.label,
          sub: '',
          active: c.active,
          pick: () => {
            const error = c.apply();
            if (error) actions.onMessage(error);
            close();
          },
        }))
      : list.map((a) => ({
          label: a.label,
          sub: a.status,
          active: false,
          pick: () => {
            openedAdvantage = a.id;
            build();
          },
        }));
    entries.forEach((e, i) => {
      const step = (Math.PI * 2) / entries.length;
      const a0 = -Math.PI / 2 + i * step + (entries.length > 1 ? GAP_RAD : 0);
      const a1 = -Math.PI / 2 + (i + 1) * step - (entries.length > 1 ? GAP_RAD : 0);
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', e.active ? 'armor-sector active' : 'armor-sector');
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', sectorPath(a0, a1));
      const mid = (a0 + a1) / 2;
      const label = document.createElementNS(SVG, 'text');
      const spot = (R_OUT + R_IN) / 2;
      label.setAttribute('x', (spot * Math.cos(mid)).toFixed(1));
      label.setAttribute('y', (spot * Math.sin(mid) - (e.sub ? 3 : -3)).toFixed(1));
      label.setAttribute('text-anchor', 'middle');
      label.textContent = e.label;
      g.append(path, label);
      if (e.sub) {
        const sub = document.createElementNS(SVG, 'text');
        sub.setAttribute('class', 'sub');
        sub.setAttribute('x', (spot * Math.cos(mid)).toFixed(1));
        sub.setAttribute('y', (spot * Math.sin(mid) + 10).toFixed(1));
        sub.setAttribute('text-anchor', 'middle');
        sub.textContent = e.sub;
        g.append(sub);
      }
      g.addEventListener('click', e.pick);
      svg.append(g);
    });
    const center = document.createElement('button');
    center.type = 'button';
    center.className = 'armor-center';
    center.textContent = adv ? t('armor.back') : list.length ? t('armor.title') : t('armor.none');
    center.addEventListener('click', () => {
      if (adv) {
        openedAdvantage = null;
        build();
      } else close();
    });
    panel.append(svg, center);
    root.append(panel);
  }

  function open(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    openedAdvantage = null;
    root.hidden = false;
    build();
    actions.onOpenChange(true);
  }

  function close(): void {
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
      if (openedAdvantage) {
        openedAdvantage = null;
        build();
      } else close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  root.hidden = true;

  return {
    toggle: () => (isOpenNow ? close() : open()),
    close,
    isOpen: () => isOpenNow,
    dispose: () => {
      window.removeEventListener('keydown', onKey, true);
      close();
    },
  };
}
