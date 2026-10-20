import { describe, expect, it } from 'vitest';
import {
  conditionsMet,
  evalCondition,
  normalizeProgram,
  stepProgram,
  type Condition,
  type Program,
  type ProgramEnv,
} from './program';
import type { Car, Consist } from './train';

const car = (id: number, kind: Car['kind'], extra: Partial<Car> = {}): Car => ({
  id,
  kind,
  rev: false,
  heatKJ: 0,
  fuel: null,
  ...extra,
});
const train = (cars: Car[], program?: Program): Consist => ({
  id: 1,
  head: { piece: 1, u: 0, dir: 1 },
  v: 0,
  cars,
  ...(program ? { program } : {}),
});

const loco = car(1, 'locomotive_steam', { fuel: { item: 'coal', count: 12 } });
const emptyFret = (id: number): Car => car(id, 'wagon_freight');
const ironFret = (id: number, n: number): Car =>
  car(id, 'wagon_freight', { cargo: [{ item: 'iron_ore', count: n }] });
const tank = (id: number, liters: number): Car =>
  car(id, 'wagon_tanker', { liquid: liters > 0 ? { kind: 'water', liters } : null });

describe('conditions', () => {
  it('wagons vides : tous, au moins un, au moins N, le wagon n° N', () => {
    const c = train([loco, emptyFret(2), ironFret(3, 10), emptyFret(4)]);
    const base: Condition = { subject: 'wagons', verb: 'empty' };
    expect(evalCondition({ ...base, scope: 'all' }, c, 0)).toBe(false);
    expect(evalCondition({ ...base, scope: 'any' }, c, 0)).toBe(true);
    expect(evalCondition({ ...base, scope: 'atLeast', n: 2 }, c, 0)).toBe(true);
    expect(evalCondition({ ...base, scope: 'atLeast', n: 3 }, c, 0)).toBe(false);
    expect(evalCondition({ ...base, scope: 'index', n: 1 }, c, 0)).toBe(true);
    expect(evalCondition({ ...base, scope: 'index', n: 2 }, c, 0)).toBe(false);
    // Sans wagon, « tous vides » est faux (rien à vérifier).
    expect(evalCondition({ ...base, scope: 'all' }, train([loco]), 0)).toBe(false);
  });

  it('filtre fret / citerne, plein, contient', () => {
    const c = train([loco, ironFret(2, 20), tank(3, 10000), tank(4, 0)]);
    const tanks: Condition = { subject: 'wagons', verb: 'full', scope: 'any', filter: 'tanker' };
    expect(evalCondition(tanks, c, 0)).toBe(true);
    expect(evalCondition({ ...tanks, scope: 'all' }, c, 0)).toBe(false);
    expect(
      evalCondition(
        { subject: 'wagons', verb: 'has', scope: 'any', item: 'iron_ore', value: 20 },
        c,
        0,
      ),
    ).toBe(true);
    expect(
      evalCondition(
        { subject: 'wagons', verb: 'has', scope: 'any', item: 'iron_ore', value: 21 },
        c,
        0,
      ),
    ).toBe(false);
    expect(
      evalCondition(
        {
          subject: 'wagons',
          verb: 'has',
          scope: 'any',
          filter: 'tanker',
          item: 'water',
          value: 5000,
        },
        c,
        0,
      ),
    ).toBe(true);
  });

  it('locomotive et temps ; toutes ou au moins une', () => {
    const c = train([loco]);
    expect(evalCondition({ subject: 'loco', verb: 'below', value: 20 }, c, 0)).toBe(true);
    expect(evalCondition({ subject: 'loco', verb: 'has', value: 20 }, c, 0)).toBe(false);
    expect(evalCondition({ subject: 'time', verb: 'elapsed', value: 5 }, c, 4)).toBe(false);
    expect(evalCondition({ subject: 'time', verb: 'elapsed', value: 5 }, c, 5)).toBe(true);
    const step = {
      mode: 'any' as const,
      when: [
        { subject: 'time' as const, verb: 'elapsed' as const, value: 99 },
        { subject: 'loco' as const, verb: 'below' as const, value: 20 },
      ],
      then: { type: 'wait' as const, seconds: 1 },
    };
    expect(conditionsMet(step, c, 0)).toBe(true);
    expect(conditionsMet({ ...step, mode: 'all' }, c, 0)).toBe(false);
    expect(conditionsMet({ ...step, when: [] }, c, 0)).toBe(true);
  });
});

describe('déroulement du programme', () => {
  const env = (at: number | null): ProgramEnv => ({
    stations: new Set([1, 2]),
    atStation: (_c, id) => id === at,
  });

  const program = (): Program => ({
    index: 0,
    phase: 'waiting',
    timer: 0,
    running: true,
    steps: [
      {
        mode: 'all',
        when: [{ subject: 'wagons', verb: 'full', scope: 'all' }],
        then: { type: 'goTo', station: 2 },
      },
      { mode: 'all', when: [], then: { type: 'wait', seconds: 3 } },
      {
        mode: 'all',
        when: [{ subject: 'wagons', verb: 'empty', scope: 'all' }],
        then: { type: 'goTo', station: 1 },
      },
    ],
  });

  it('attend les conditions, part, arrive, attend, repart, et boucle', () => {
    const c = train([loco, ironFret(2, 0)], program());
    // Étape 1 : le wagon n'est pas plein, on attend.
    expect(stepProgram(c, 1, env(null))).toEqual({});
    expect(c.program?.index).toBe(0);
    c.cars[1].cargo = [{ item: 'barrel_water', count: 185 }]; // plein
    expect(stepProgram(c, 0.1, env(null))).toEqual({ goTo: 2 });
    expect(c.program?.phase).toBe('moving');
    // En route : rien à faire tant que l'ordre dure.
    c.goTo = 2;
    expect(stepProgram(c, 1, env(null))).toEqual({});
    // Arrivé : l'ordre est effacé et le train est à la station → étape suivante.
    delete c.goTo;
    expect(stepProgram(c, 1, env(2))).toEqual({});
    expect(c.program?.index).toBe(1);
    // Étape 2 : attendre 3 s.
    expect(stepProgram(c, 0.1, env(2))).toEqual({});
    expect(c.program?.phase).toBe('pausing');
    stepProgram(c, 2, env(2));
    expect(c.program?.index).toBe(1);
    stepProgram(c, 1.5, env(2));
    expect(c.program?.index).toBe(2);
    // Étape 3 : attend que le wagon soit vidé.
    expect(stepProgram(c, 1, env(2))).toEqual({});
    c.cars[1].cargo = [];
    expect(stepProgram(c, 0.1, env(2))).toEqual({ goTo: 1 });
    c.goTo = 1;
    delete c.goTo;
    stepProgram(c, 1, env(1));
    // La boucle revient à la première étape.
    expect(c.program?.index).toBe(0);
    expect(c.program?.phase).toBe('waiting');
  });

  it('se met en pause si la station a disparu ou si le train n’est pas arrivé', () => {
    const p = program();
    p.steps[0].when = [];
    const c = train([loco, ironFret(2, 1)], p);
    expect(stepProgram(c, 1, { stations: new Set([1]), atStation: () => false })).toEqual({
      paused: 'noStation',
    });
    expect(c.program?.running).toBe(false);
    const c2 = train([loco], program());
    c2.program!.steps[0].when = [];
    expect(stepProgram(c2, 1, env(null)).goTo).toBe(2);
    // L'ordre a disparu sans que le train soit à la station (annulé) : pause.
    expect(stepProgram(c2, 1, env(null))).toEqual({ paused: 'cancelled' });
    expect(c2.program?.running).toBe(false);
    // En pause, rien ne bouge.
    expect(stepProgram(c2, 5, env(2))).toEqual({});
  });

  it('un programme enregistré est relu et borné', () => {
    const ok = normalizeProgram(JSON.parse(JSON.stringify(program())));
    expect(ok?.steps).toHaveLength(3);
    expect(normalizeProgram({ steps: [] })).toBeNull();
    expect(normalizeProgram({ steps: [{ then: { type: 'fly' } }] })).toBeNull();
    const weird = normalizeProgram({
      steps: [
        {
          mode: 'any',
          when: [
            { subject: 'wagons', verb: 'has', item: 'objet_inconnu' },
            {
              subject: 'wagons',
              verb: 'has',
              item: 'iron_ore',
              value: -5,
              scope: 'atLeast',
              n: 999,
            },
            { subject: 'time', verb: 'empty' },
          ],
          then: { type: 'wait', seconds: 1e9 },
        },
      ],
    });
    expect(weird?.steps[0].when).toHaveLength(1);
    expect(weird?.steps[0].when[0]).toMatchObject({ item: 'iron_ore', value: 0, n: 40 });
    expect(weird?.steps[0].then).toEqual({ type: 'wait', seconds: 86400 });
  });
});
