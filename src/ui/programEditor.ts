/**
 * Éditeur du programme d'un train : une liste d'étapes « Quand… Alors… » lue en boucle (voir
 * `docs/trains-programmation.md`). On édite un brouillon ; « Enregistrer » le donne au jeu.
 */
import { ITEMS } from '../core/data/items';
import { LIQUIDS } from '../core/data/trains';
import {
  MAX_CONDITIONS,
  MAX_STEPS,
  type Condition,
  type Program,
  type Step,
  type Subject,
} from '../core/rail/program';
import type { GameState } from '../core/game/state';
import { t, type TranslationKey } from '../i18n';

type Tx = (key: string, vars?: Record<string, string>) => string;
const tx: Tx = (key, vars) => t(key as TranslationKey, vars);

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

function select(
  options: { value: string; label: string }[],
  value: string,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const s = el('select');
  for (const o of options) {
    const opt = el('option', undefined, o.label);
    opt.value = o.value;
    s.append(opt);
  }
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function number(
  value: number,
  min: number,
  onChange: (v: number) => void,
  width = 72,
): HTMLInputElement {
  const i = el('input');
  i.type = 'number';
  i.min = String(min);
  i.value = String(value);
  i.style.width = `${width}px`;
  i.addEventListener('input', () => {
    const v = Number(i.value);
    if (Number.isFinite(v)) onChange(Math.max(min, v));
  });
  return i;
}

/** Une condition neuve pour ce sujet, avec des valeurs par défaut raisonnables. */
export function defaultCondition(subject: Subject): Condition {
  if (subject === 'time') return { subject, verb: 'elapsed', value: 10 };
  if (subject === 'loco') return { subject, verb: 'below', value: 10 };
  return { subject, verb: 'empty', scope: 'all', filter: 'all' };
}

const itemChoices = (): { value: string; label: string }[] => [
  ...LIQUIDS.map((l) => ({ value: l, label: tx(`liquid.${l}`) })),
  ...ITEMS.filter((i) => !i.creativeOnly && !i.id.startsWith('res_'))
    .map((i) => ({ value: i.id, label: tx(`item.${i.id}`) }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export interface EditorOptions {
  state: GameState;
  consistId: number;
  /** Fermeture de la fenêtre (le jeu reprend la souris). */
  onClose: () => void;
}

/** Ouvre l'éditeur ; renvoie une fonction qui le ferme. */
export function openProgramEditor(options: EditorOptions): () => void {
  const { state, consistId } = options;
  const consist = state.changes.trains.find((c) => c.id === consistId);
  if (!consist) {
    options.onClose();
    return () => {};
  }
  const stations = state.changes.stations;
  const firstStation = stations[0]?.id ?? 1;
  const draft: Program = consist.program
    ? (structuredClone(consist.program) as Program)
    : {
        steps: [{ mode: 'all', when: [], then: { type: 'goTo', station: firstStation } }],
        index: 0,
        phase: 'waiting',
        timer: 0,
        running: false,
      };

  const overlay = el('div', 'modal-overlay');
  const dialog = el('div', 'modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.style.maxWidth = '820px';
  dialog.style.width = '92vw';
  dialog.style.maxHeight = '88vh';
  dialog.style.overflowY = 'auto';
  overlay.append(dialog);

  function close(): void {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    options.onClose();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }

  const row = (): HTMLElement => {
    const r = el('div');
    r.style.display = 'flex';
    r.style.flexWrap = 'wrap';
    r.style.alignItems = 'center';
    r.style.gap = '6px';
    r.style.margin = '4px 0';
    return r;
  };

  function conditionRow(step: Step, index: number): HTMLElement {
    const c = step.when[index];
    const r = row();
    const change = (next: Condition): void => {
      step.when[index] = next;
      render();
    };
    r.append(
      select(
        (['wagons', 'loco', 'time'] as Subject[]).map((s) => ({
          value: s,
          label: tx(`prog.subject.${s}`),
        })),
        c.subject,
        (v) => change(defaultCondition(v as Subject)),
      ),
    );
    if (c.subject === 'wagons') {
      r.append(
        select(
          ['all', 'any', 'atLeast', 'index'].map((s) => ({
            value: s,
            label: tx(`prog.scope.${s}`),
          })),
          c.scope ?? 'all',
          (v) =>
            change({
              ...c,
              scope: v as Condition['scope'],
              n: v === 'atLeast' || v === 'index' ? (c.n ?? 1) : undefined,
            }),
        ),
      );
      if (c.scope === 'atLeast' || c.scope === 'index')
        r.append(number(c.n ?? 1, 1, (v) => (c.n = Math.floor(v)), 56));
      r.append(
        select(
          ['all', 'freight', 'tanker'].map((s) => ({ value: s, label: tx(`prog.filter.${s}`) })),
          c.filter ?? 'all',
          (v) => change({ ...c, filter: v as Condition['filter'] }),
        ),
        select(
          ['empty', 'full', 'has'].map((s) => ({ value: s, label: tx(`prog.verb.${s}`) })),
          c.verb,
          (v) =>
            change({
              ...c,
              verb: v as Condition['verb'],
              item: v === 'has' ? (c.item ?? 'iron_ore') : undefined,
              value: v === 'has' ? (c.value ?? 10) : undefined,
            }),
        ),
      );
      if (c.verb === 'has') {
        r.append(
          select(itemChoices(), c.item ?? 'iron_ore', (v) => (c.item = v)),
          el('span', undefined, tx('prog.atLeastQty')),
          number(c.value ?? 1, 1, (v) => (c.value = v), 80),
        );
      }
    } else if (c.subject === 'loco') {
      r.append(
        select(
          ['below', 'has'].map((s) => ({ value: s, label: tx(`prog.loco.${s}`) })),
          c.verb,
          (v) => change({ ...c, verb: v as Condition['verb'] }),
        ),
        number(c.value ?? 0, 0, (v) => (c.value = v), 72),
        el('span', undefined, tx('prog.fuelPieces')),
      );
    } else {
      r.append(
        el('span', undefined, tx('prog.waitedFor')),
        number(c.value ?? 0, 0, (v) => (c.value = v), 72),
        el('span', undefined, tx('prog.seconds')),
      );
    }
    const del = el('button', 'menu-btn', '✕');
    del.type = 'button';
    del.title = tx('prog.remove');
    del.addEventListener('click', () => {
      step.when.splice(index, 1);
      render();
    });
    r.append(del);
    return r;
  }

  function stepCard(step: Step, i: number): HTMLElement {
    const card = el('div');
    card.style.border = '1px solid var(--tile-edge, #c9b48a)';
    card.style.borderRadius = '10px';
    card.style.padding = '8px 10px';
    card.style.margin = '8px 0';
    if (consist && consist.program?.running && consist.program.index === i)
      card.style.boxShadow = '0 0 0 2px var(--mint, #4fc38a)';
    const head = row();
    head.append(el('strong', undefined, tx('prog.step', { n: String(i + 1) })));
    const move = (d: number): void => {
      const j = i + d;
      if (j < 0 || j >= draft.steps.length) return;
      [draft.steps[i], draft.steps[j]] = [draft.steps[j], draft.steps[i]];
      render();
    };
    for (const [label, d] of [
      ['↑', -1],
      ['↓', 1],
    ] as const) {
      const b = el('button', 'menu-btn', label);
      b.type = 'button';
      b.addEventListener('click', () => move(d));
      head.append(b);
    }
    const del = el('button', 'menu-btn', tx('prog.removeStep'));
    del.type = 'button';
    del.disabled = draft.steps.length <= 1;
    del.addEventListener('click', () => {
      draft.steps.splice(i, 1);
      render();
    });
    head.append(del);
    card.append(head);

    const when = row();
    when.append(
      el('strong', undefined, tx('prog.when')),
      select(
        ['all', 'any'].map((m) => ({ value: m, label: tx(`prog.mode.${m}`) })),
        step.mode,
        (v) => (step.mode = v as Step['mode']),
      ),
    );
    card.append(when);
    if (step.when.length === 0) card.append(el('small', 'help', tx('prog.noCondition')));
    step.when.forEach((_, k) => card.append(conditionRow(step, k)));
    const add = el('button', 'menu-btn', tx('prog.addCondition'));
    add.type = 'button';
    add.disabled = step.when.length >= MAX_CONDITIONS;
    add.addEventListener('click', () => {
      step.when.push(defaultCondition('wagons'));
      render();
    });
    card.append(add);

    const then = row();
    then.append(
      el('strong', undefined, tx('prog.then')),
      select(
        [
          { value: 'goTo', label: tx('prog.action.goTo') },
          { value: 'wait', label: tx('prog.action.wait') },
        ],
        step.then.type,
        (v) => {
          step.then =
            v === 'goTo' ? { type: 'goTo', station: firstStation } : { type: 'wait', seconds: 10 };
          render();
        },
      ),
    );
    if (step.then.type === 'goTo') {
      const act = step.then;
      then.append(
        select(
          stations.length > 0
            ? stations.map((s) => ({ value: String(s.id), label: s.name }))
            : [{ value: String(act.station), label: tx('prog.noStations') }],
          String(act.station),
          (v) => (act.station = Number(v)),
        ),
      );
    } else {
      const act = step.then;
      then.append(
        number(act.seconds, 0, (v) => (act.seconds = v), 80),
        el('span', undefined, tx('prog.seconds')),
      );
    }
    card.append(then);
    return card;
  }

  function render(): void {
    dialog.replaceChildren();
    dialog.append(el('h2', undefined, tx('prog.title')), el('p', 'help', tx('prog.intro')));
    draft.steps.forEach((s, i) => dialog.append(stepCard(s, i)));
    const add = el('button', 'menu-btn', tx('prog.addStep'));
    add.type = 'button';
    add.disabled = draft.steps.length >= MAX_STEPS;
    add.addEventListener('click', () => {
      draft.steps.push({ mode: 'all', when: [], then: { type: 'goTo', station: firstStation } });
      render();
    });
    dialog.append(add);
    if (stations.length === 0) dialog.append(el('p', 'help error', tx('prog.noStations')));

    const actions = el('div', 'modal-actions');
    const cancel = el('button', 'menu-btn', tx('station.cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', close);
    const save = (run: boolean): void => {
      if (!state.setProgram(consistId, { ...draft, steps: draft.steps })) return;
      state.setProgramRunning(consistId, run);
      close();
    };
    const saveBtn = el('button', 'menu-btn', tx('prog.save'));
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', () => save(false));
    const run = el('button', 'menu-btn primary', tx('prog.saveRun'));
    run.type = 'button';
    run.addEventListener('click', () => save(true));
    actions.append(cancel, saveBtn, run);
    if (consist?.program?.running) {
      const stop = el('button', 'menu-btn', tx('prog.stop'));
      stop.type = 'button';
      stop.addEventListener('click', () => {
        state.setProgramRunning(consistId, false);
        close();
      });
      actions.prepend(stop);
    }
    dialog.append(actions);
  }

  window.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  render();
  return close;
}
