import { getSettings, onSettingsChange } from './store';
import type { Settings } from './schema';

const ACCENT: Record<Settings['display']['colorblind'], string> = {
  none: '#d9822b',
  protanopia: '#4da3ff',
  deuteranopia: '#4da3ff',
  tritanopia: '#ff5c8a',
};

/** Applique à la page les réglages qui la concernent (gamma, luminosité, taille de l'interface…). */
function apply(s: Settings): void {
  const exponent = String(1 / s.display.gamma);
  document
    .querySelectorAll('#gamma-filter feFuncR, #gamma-filter feFuncG, #gamma-filter feFuncB')
    .forEach((f) => f.setAttribute('exponent', exponent));
  const filter = `url(#gamma-filter) brightness(${s.display.brightness / 100})`;
  for (const id of ['app', 'menu-bg']) {
    const el = document.getElementById(id);
    if (el) el.style.filter = filter;
  }
  const scale = String(s.display.uiScale / 100);
  for (const id of ['ui', 'hud', 'pause', 'inventory', 'machine']) {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('zoom', scale);
  }
  document.documentElement.style.setProperty('--touch-scale', String(s.game.touchScale / 100));
  document.body.classList.toggle('touch-left', s.game.touchLeftHanded);
  document.documentElement.style.setProperty('--accent', ACCENT[s.display.colorblind]);
}

export function startApplyingSettings(): void {
  apply(getSettings());
  onSettingsChange(apply);
}
