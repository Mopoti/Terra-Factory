/**
 * Programme d'un convoi (voir `docs/trains-programmation.md`) : une liste d'étapes lue en boucle. Chaque étape dit
 * « quand ces conditions sont réunies, alors fais cette action » : aller à une station, ou attendre quelques secondes.
 * Une condition est « quoi + comment + combien » (sujet, verbe, valeur) ; le même modèle servira plus tard aux signaux
 * et à l'automatisation des lignes de production.
 */
import { CARS, LIQUIDS, isLiquid, type LiquidKind } from '../data/trains';
import { itemById } from '../data/items';
import { cargoMassKg, cargoVolumeL, type Car, type Consist } from './train';

/** Ce que la condition regarde. */
export type Subject = 'wagons' | 'loco' | 'time';
/** Comment : un wagon vide / plein / contenant un objet ; la soute de la locomotive ; le temps écoulé. */
export type Verb = 'empty' | 'full' | 'has' | 'below' | 'elapsed';
/** Pour les wagons : tous, au moins un, au moins N, ou le wagon n° N (en comptant depuis la tête). */
export type Scope = 'all' | 'any' | 'atLeast' | 'index';
export type WagonFilter = 'all' | 'freight' | 'tanker';

export interface Condition {
  subject: Subject;
  verb: Verb;
  scope?: Scope;
  /** Nombre de wagons (`atLeast`) ou rang du wagon (`index`). */
  n?: number;
  filter?: WagonFilter;
  /** Objet (wagon de fret) ou liquide (citerne) cherché par « contient ». */
  item?: string;
  /** Quantité (objets, litres, pièces de combustible, secondes selon le verbe). */
  value?: number;
}

export type Action = { type: 'goTo'; station: number } | { type: 'wait'; seconds: number };

export interface Step {
  /** `all` : toutes les conditions ; `any` : au moins une. Sans condition, l'étape se déclenche tout de suite. */
  mode: 'all' | 'any';
  when: Condition[];
  then: Action;
}

export type Phase = 'waiting' | 'moving' | 'pausing';

export interface Program {
  steps: Step[];
  /** Étape en cours. */
  index: number;
  phase: Phase;
  /** Temps (s) passé dans la phase en cours (sert au verbe « a attendu » et à l'action « attendre »). */
  timer: number;
  /** Le programme tourne (sinon il est en pause : le train reste à la main). */
  running: boolean;
}

export const MAX_STEPS = 24;
export const MAX_CONDITIONS = 8;
export const FULL_FRACTION = 0.98;
/** Temps minimal (s) passé dans une étape avant d'agir : évite qu'un programme sans condition tourne à chaque image. */
export const MIN_DWELL_S = 1;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

// --- Lecture du contenu d'un wagon -----------------------------------------------------------------------------

/** Taux de remplissage (0 à 1) d'un wagon : charge ou volume de fret, niveau d'une citerne. */
export function fillOf(car: Car): number {
  const spec = CARS[car.kind];
  if (spec.cargo)
    return Math.max(cargoMassKg(car) / spec.cargo.maxKg, cargoVolumeL(car) / spec.cargo.maxL);
  if (spec.tankL) return (car.liquid?.liters ?? 0) / spec.tankL;
  return 0;
}

/** Quantité d'un objet (fret) ou d'un liquide (citerne, en litres) dans un wagon. */
export function amountIn(car: Car, item: string): number {
  if (CARS[car.kind].tankL) return car.liquid && car.liquid.kind === item ? car.liquid.liters : 0;
  let n = 0;
  for (const s of car.cargo ?? []) if (s.item === item) n += s.count;
  return n;
}

const matchesFilter = (car: Car, filter: WagonFilter): boolean =>
  filter === 'all'
    ? !CARS[car.kind].loco
    : filter === 'freight'
      ? !!CARS[car.kind].cargo
      : !!CARS[car.kind].tankL;

function wagonOk(car: Car, c: Condition): boolean {
  switch (c.verb) {
    case 'empty':
      return fillOf(car) <= 0;
    case 'full':
      return fillOf(car) >= FULL_FRACTION;
    case 'has':
      return !!c.item && amountIn(car, c.item) >= Math.max(1, c.value ?? 1);
    default:
      return false;
  }
}

/** La condition est-elle vraie pour ce convoi ? `timer` : secondes passées dans l'étape. */
export function evalCondition(c: Condition, consist: Consist, timer: number): boolean {
  if (c.subject === 'time') return timer >= (c.value ?? 0);
  if (c.subject === 'loco') {
    const soute = consist.cars.reduce(
      (n, k) => n + (CARS[k.kind].loco ? (k.fuel?.count ?? 0) : 0),
      0,
    );
    const v = c.value ?? 0;
    return c.verb === 'below' ? soute < v : soute >= v;
  }
  const wagons = consist.cars.filter((k) => matchesFilter(k, c.filter ?? 'all'));
  const scope = c.scope ?? 'all';
  const n = Math.max(1, Math.floor(c.n ?? 1));
  if (scope === 'index') return wagons[n - 1] !== undefined && wagonOk(wagons[n - 1], c);
  const ok = wagons.filter((k) => wagonOk(k, c)).length;
  if (scope === 'any') return ok >= 1;
  if (scope === 'atLeast') return ok >= n;
  return wagons.length > 0 && ok === wagons.length;
}

export const conditionsMet = (step: Step, consist: Consist, timer: number): boolean =>
  step.when.length === 0 ||
  (step.mode === 'any'
    ? step.when.some((c) => evalCondition(c, consist, timer))
    : step.when.every((c) => evalCondition(c, consist, timer)));

// --- Déroulement -------------------------------------------------------------------------------------------------

export interface ProgramEnv {
  /** Identifiants des stations qui existent. */
  stations: ReadonlySet<number>;
  /** Le convoi est-il arrêté à cette station ? */
  atStation(consist: Consist, station: number): boolean;
}

export interface ProgramEvent {
  /** Envoyer le convoi à cette station. */
  goTo?: number;
  /** Le programme s'est mis en pause. */
  paused?: 'noStation' | 'cancelled';
}

const advance = (p: Program): void => {
  p.index = (p.index + 1) % p.steps.length;
  p.phase = 'waiting';
  p.timer = 0;
};

/** Fait avancer le programme du convoi de `dt` secondes ; renvoie ce que le jeu doit faire (envoyer le train…). */
export function stepProgram(c: Consist, dt: number, env: ProgramEnv): ProgramEvent {
  const p = c.program;
  if (!p || !p.running || p.steps.length === 0) return {};
  p.index %= p.steps.length;
  const step = p.steps[p.index];
  if (p.phase === 'moving') {
    if (c.goTo !== undefined) return {};
    // Le convoi n'a plus d'ordre : arrivé (étape suivante) ou ordre annulé (pas de chemin, plus de combustible…).
    if (step.then.type === 'goTo' && env.atStation(c, step.then.station)) advance(p);
    else {
      p.running = false;
      return { paused: 'cancelled' };
    }
    return {};
  }
  p.timer += dt;
  if (p.phase === 'pausing') {
    if (step.then.type === 'wait' && p.timer >= step.then.seconds) advance(p);
    return {};
  }
  if (p.timer < MIN_DWELL_S || !conditionsMet(step, c, p.timer)) return {};
  if (step.then.type === 'wait') {
    p.phase = 'pausing';
    p.timer = 0;
    return {};
  }
  if (!env.stations.has(step.then.station)) {
    p.running = false;
    return { paused: 'noStation' };
  }
  p.phase = 'moving';
  p.timer = 0;
  return { goTo: step.then.station };
}

// --- Lecture d'une sauvegarde ----------------------------------------------------------------------------------

const SUBJECTS: readonly Subject[] = ['wagons', 'loco', 'time'];
const VERBS: readonly Verb[] = ['empty', 'full', 'has', 'below', 'elapsed'];
const SCOPES: readonly Scope[] = ['all', 'any', 'atLeast', 'index'];
const FILTERS: readonly WagonFilter[] = ['all', 'freight', 'tanker'];

function normalizeCondition(raw: unknown): Condition | null {
  if (!isRec(raw) || !SUBJECTS.includes(raw.subject as Subject)) return null;
  const subject = raw.subject as Subject;
  const allowed: Record<Subject, Verb[]> = {
    wagons: ['empty', 'full', 'has'],
    loco: ['below', 'has'],
    time: ['elapsed'],
  };
  const verb = VERBS.includes(raw.verb as Verb) ? (raw.verb as Verb) : allowed[subject][0];
  if (!allowed[subject].includes(verb)) return null;
  const c: Condition = { subject, verb };
  if (subject === 'wagons') {
    c.scope = SCOPES.includes(raw.scope as Scope) ? (raw.scope as Scope) : 'all';
    c.filter = FILTERS.includes(raw.filter as WagonFilter) ? (raw.filter as WagonFilter) : 'all';
    if (c.scope === 'atLeast' || c.scope === 'index')
      c.n = isNum(raw.n) ? Math.max(1, Math.min(40, Math.floor(raw.n))) : 1;
    if (verb === 'has') {
      let valid = false;
      if (typeof raw.item === 'string') {
        if (isLiquid(raw.item)) valid = true;
        else
          try {
            itemById(raw.item);
            valid = true;
          } catch {
            valid = false;
          }
      }
      if (!valid) return null;
      c.item = raw.item as string;
    }
  }
  if (isNum(raw.value)) c.value = Math.max(0, Math.min(1_000_000, raw.value));
  return c;
}

function normalizeStep(raw: unknown): Step | null {
  if (!isRec(raw) || !isRec(raw.then)) return null;
  let then: Action;
  if (raw.then.type === 'goTo' && isNum(raw.then.station) && raw.then.station >= 1)
    then = { type: 'goTo', station: Math.floor(raw.then.station) };
  else if (raw.then.type === 'wait' && isNum(raw.then.seconds))
    then = { type: 'wait', seconds: Math.max(0, Math.min(86_400, raw.then.seconds)) };
  else return null;
  const when = (Array.isArray(raw.when) ? raw.when : [])
    .slice(0, MAX_CONDITIONS)
    .map(normalizeCondition)
    .filter((c): c is Condition => c !== null);
  return { mode: raw.mode === 'any' ? 'any' : 'all', when, then };
}

/** Relit un programme enregistré (ou saisi) ; null s'il n'a aucune étape valide. */
export function normalizeProgram(raw: unknown): Program | null {
  if (!isRec(raw) || !Array.isArray(raw.steps)) return null;
  const steps = raw.steps
    .slice(0, MAX_STEPS)
    .map(normalizeStep)
    .filter((s): s is Step => s !== null);
  if (steps.length === 0) return null;
  const phase: Phase = raw.phase === 'moving' || raw.phase === 'pausing' ? raw.phase : 'waiting';
  return {
    steps,
    index: isNum(raw.index) ? Math.max(0, Math.floor(raw.index)) % steps.length : 0,
    phase,
    timer: isNum(raw.timer) ? Math.max(0, raw.timer) : 0,
    running: raw.running === true,
  };
}

export const LIQUID_CHOICES: readonly LiquidKind[] = LIQUIDS;
