import { ActionRecorder, type RecordedEvent } from '../core/report/recorder';
import { downloadBlob } from './files';

const MAX_ERRORS = 30;

const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** L'enregistreur de la session : touches, clics et erreurs de la dernière minute. */
export const recorder = new ActionRecorder();
const errors: { t: number; message: string }[] = [];
let installed = false;

function pushError(message: string): void {
  errors.push({ t: Date.now(), message: message.slice(0, 600) });
  if (errors.length > MAX_ERRORS) errors.shift();
}

/** Écoute le clavier, la souris et les erreurs de la page. Les textes saisis (noms, notes) ne sont jamais notés. */
export function installBugRecorder(): void {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || isTextTarget(e.target)) return;
      recorder.record('keydown', { code: e.code });
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (!isTextTarget(e.target)) recorder.record('keyup', { code: e.code });
    },
    true,
  );
  window.addEventListener(
    'mousedown',
    (e) => recorder.record('mousedown', { button: e.button, x: e.clientX, y: e.clientY }),
    true,
  );
  window.addEventListener(
    'mouseup',
    (e) => recorder.record('mouseup', { button: e.button, x: e.clientX, y: e.clientY }),
    true,
  );
  let lastWheel = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      const now = Date.now();
      if (now - lastWheel < 150) return;
      lastWheel = now;
      recorder.record('wheel', { dy: Math.sign(e.deltaY) });
    },
    true,
  );
  window.addEventListener('blur', () => recorder.record('blur'));
  window.addEventListener('error', (e) => pushError(`${e.message} (${e.filename}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) =>
    pushError(`promesse rejetée : ${String(e.reason)}`),
  );
  const original = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    pushError(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    original(...args);
  };
}

export interface BugReportInput {
  /** Ce que le joueur a écrit : ce qu'il attendait, ce qui s'est passé. */
  note: string;
  game: { id: string; name: string; seed?: string };
  /** Sauvegarde complète à cet instant (sac et changements du monde). */
  snapshot: unknown;
  player: unknown;
  /** Vue, véhicule ou train conduit, objet visé… */
  info: Record<string, unknown>;
  settings: unknown;
  screenshot: string | null;
  now?: number;
}

export interface BugReport {
  format: 'terra-bug-report';
  version: 1;
  build: string;
  createdAt: string;
  note: string;
  game: BugReportInput['game'];
  browser: { userAgent: string; viewport: { w: number; h: number }; language: string };
  player: unknown;
  info: Record<string, unknown>;
  settings: unknown;
  /** Les 60 dernières secondes : du plus ancien au plus récent, `t` en secondes avant le rapport. */
  actions: RecordedEvent[];
  errors: { t: number; message: string }[];
  snapshot: unknown;
  screenshot: string | null;
}

/** Assemble le rapport (sans rien envoyer nulle part). */
export function buildBugReport(input: BugReportInput): BugReport {
  const now = input.now ?? Date.now();
  return {
    format: 'terra-bug-report',
    version: 1,
    build: __BUILD_ID__,
    createdAt: new Date(now).toISOString(),
    note: input.note.trim().slice(0, 4000),
    game: input.game,
    browser: {
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      language: navigator.language,
    },
    player: input.player,
    info: input.info,
    settings: input.settings,
    actions: recorder.dump(now),
    errors: errors.map((e) => ({ t: Math.round((e.t - now) / 10) / 100, message: e.message })),
    snapshot: input.snapshot,
    screenshot: input.screenshot,
  };
}

/** Télécharge le rapport (un fichier JSON) ; renvoie son nom. */
export function downloadBugReport(report: BugReport): string {
  const stamp = report.createdAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const name = `terra-bug-${stamp}.json`;
  downloadBlob(new Blob([JSON.stringify(report)], { type: 'application/json' }), name);
  return name;
}
