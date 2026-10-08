import { TUTORIAL_STEPS, type Tutorial } from '../core/game/tutorial';
import { t, type TranslationKey } from '../i18n';
import { bindingLabel, type ActionId } from '../settings/controls';
import { getSettings } from '../settings/store';
import { isTouchMode } from './touchControls';

/** Texte d'une touche d'après les réglages du joueur (première liaison libre de l'action). */
function keyLabel(action: string): string {
  if (isTouchMode())
    return t(
      `touch.${action === 'interact' ? 'interact' : action === 'cycleView' ? 'view' : action === 'techTree' ? 'tech' : ['forward', 'left', 'backward', 'right'].includes(action) ? 'stick' : action}` as TranslationKey,
    );
  const pair = getSettings().controls[action as ActionId];
  const code = pair?.[0] ?? pair?.[1];
  return code
    ? bindingLabel(code, (k) => t(k as TranslationKey), getSettings().keyboard === 'zqsd')
    : '?';
}

/** Panneau du tutoriel en haut à droite : l'étape en cours, un compteur, et « Passer le tutoriel ». */
export function mountTutorialPanel(
  container: HTMLElement,
  tutorial: Tutorial,
  onSkip: () => void,
): { refresh(finished?: boolean): void; dispose(): void } {
  const panel = document.createElement('aside');
  panel.className = 'tutorial-panel';
  panel.setAttribute('role', 'status');
  container.append(panel);
  let doneUntil = 0;
  let shown = '';

  function refresh(finished = false): void {
    if (finished) doneUntil = performance.now() + 6000;
    const step = tutorial.current();
    if (!step) {
      if (performance.now() < doneUntil) {
        const key = 'done';
        if (shown !== key) {
          shown = key;
          panel.hidden = false;
          panel.replaceChildren(
            textLine('h3', t('tutorial.title')),
            textLine('p', t('tutorial.done')),
          );
        }
      } else {
        shown = '';
        panel.hidden = true;
      }
      return;
    }
    const n = TUTORIAL_STEPS.indexOf(step) + 1;
    const key = `${step.id}|${getSettings().keyboard}`;
    if (shown === key) return;
    shown = key;
    panel.hidden = false;
    const keys = [...new Set(step.keys.map(keyLabel))].join(' ');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = t('tutorial.skip');
    skip.addEventListener('click', onSkip);
    panel.replaceChildren(
      textLine(
        'h3',
        `${t('tutorial.title')} — ${t('tutorial.step', { n: String(n), total: String(TUTORIAL_STEPS.length) })}`,
      ),
      textLine('small', t(`tutorial.group.${step.group}` as TranslationKey)),
      textLine('p', t(`tutorial.step.${step.id}` as TranslationKey, { keys })),
      skip,
    );
  }

  function textLine(tag: string, text: string): HTMLElement {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  }

  refresh();
  return { refresh, dispose: () => panel.remove() };
}
