import { TUTORIAL_STEPS, type Tutorial } from '../core/game/tutorial';
import { t, type TranslationKey } from '../i18n';
import { actionLabel, getDevice } from './keyHints';
import { getSettings } from '../settings/store';

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
    const progress = tutorial.progress() ?? { have: 0, total: 1 };
    const key = `${step.id}|${getSettings().keyboard}|${getDevice()}|${progress.have}`;
    if (shown === key) return;
    shown = key;
    panel.hidden = false;
    const keys = [...new Set(step.keys.map((k) => actionLabel(k)))].join(' ');
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
      ...(progress.total > 1 ? [progressBar(progress.have, progress.total)] : []),
      skip,
    );
  }

  function progressBar(have: number, total: number): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'tutorial-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(have));
    const fill = document.createElement('div');
    fill.style.width = `${Math.round((have / total) * 100)}%`;
    const label = document.createElement('span');
    label.textContent = `${have} / ${total}`;
    bar.append(fill, label);
    return bar;
  }

  function textLine(tag: string, text: string): HTMLElement {
    const e = document.createElement(tag);
    e.textContent = text;
    return e;
  }

  refresh();
  return { refresh, dispose: () => panel.remove() };
}
