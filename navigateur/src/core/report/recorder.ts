/**
 * Mémoire des dernières actions du joueur (touches, clics, commandes, événements du jeu, position) : de quoi rejouer
 * une situation à la lecture d'un rapport de bug. Fenêtre glissante : les événements plus vieux sont oubliés.
 */
export interface RecordedEvent {
  /** Secondes avant l'instant du rapport (≤ 0). */
  t: number;
  kind: string;
  data?: unknown;
}

export const RECORD_WINDOW_MS = 60_000;
const MAX_EVENTS = 4000;

export class ActionRecorder {
  private events: { at: number; kind: string; data?: unknown }[] = [];

  constructor(
    private readonly windowMs = RECORD_WINDOW_MS,
    private readonly max = MAX_EVENTS,
  ) {}

  record(kind: string, data?: unknown, now = Date.now()): void {
    this.events.push({ at: now, kind, data });
    this.trim(now);
  }

  private trim(now: number): void {
    const from = now - this.windowMs;
    let i = 0;
    while (i < this.events.length && this.events[i].at < from) i++;
    if (i > 0) this.events.splice(0, i);
    if (this.events.length > this.max) this.events.splice(0, this.events.length - this.max);
  }

  /** Les événements de la fenêtre, du plus ancien au plus récent, datés par rapport à `now`. */
  dump(now = Date.now()): RecordedEvent[] {
    this.trim(now);
    return this.events.map((e) => ({
      t: Math.round((e.at - now) / 10) / 100,
      kind: e.kind,
      ...(e.data === undefined ? {} : { data: e.data }),
    }));
  }

  clear(): void {
    this.events = [];
  }
}
