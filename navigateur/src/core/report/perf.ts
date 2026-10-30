/**
 * Fluidité du jeu : durée de chaque image (intervalle entre deux images, et travail du programme réparti entre chunks,
 * simulation, rendu…), gardée sur les dernières secondes pour les rapports de bug.
 */
export interface FrameSample {
  /** Horloge (ms) au début de l'image. */
  at: number;
  /** Temps écoulé depuis l'image précédente (ms) : c'est ce qui donne les images par seconde. */
  interval: number;
  /** Travail du programme pendant l'image (ms), et sa répartition. */
  cpu: number;
  parts: Record<string, number>;
}

const round = (x: number, digits = 1): number => {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
};

const percentile = (sorted: number[], p: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

export class FrameStats {
  private readonly samples: FrameSample[] = [];
  private readonly longTasks: { at: number; ms: number }[] = [];

  constructor(private readonly capacity = 3600) {}

  record(sample: FrameSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  /** Tâche longue du navigateur (plus de 50 ms), signalée par `PerformanceObserver`. */
  recordLongTask(at: number, ms: number): void {
    this.longTasks.push({ at, ms });
    if (this.longTasks.length > 60) this.longTasks.shift();
  }

  /** Résumé lisible : images par seconde, à-coups, répartition du travail, pires images, courbe seconde par seconde. */
  summary(now: number): Record<string, unknown> {
    const s = this.samples;
    if (s.length === 0) return { frames: 0 };
    const intervals = s.map((x) => x.interval).sort((a, b) => a - b);
    const cpus = s.map((x) => x.cpu).sort((a, b) => a - b);
    const total = intervals.reduce((a, b) => a + b, 0);
    const over = (ms: number): number => s.filter((x) => x.interval > ms).length;
    const partNames = [...new Set(s.flatMap((x) => Object.keys(x.parts)))];
    const parts: Record<string, { avg: number; max: number }> = {};
    for (const name of partNames) {
      const values = s.map((x) => x.parts[name] ?? 0);
      parts[name] = {
        avg: round(values.reduce((a, b) => a + b, 0) / values.length, 2),
        max: round(Math.max(...values), 1),
      };
    }
    const worst = [...s]
      .sort((a, b) => b.interval - a.interval)
      .slice(0, 8)
      .map((x) => ({
        secondsAgo: round((now - x.at) / 1000, 1),
        intervalMs: round(x.interval),
        cpuMs: round(x.cpu),
        parts: Object.fromEntries(Object.entries(x.parts).map(([k, v]) => [k, round(v)])),
      }));
    // Une ligne par seconde sur les 90 dernières : images, intervalle le plus long.
    const seconds: { secondsAgo: number; frames: number; maxIntervalMs: number }[] = [];
    for (let back = 0; back < 90; back++) {
      const from = now - (back + 1) * 1000;
      const to = now - back * 1000;
      const inside = s.filter((x) => x.at > from && x.at <= to);
      if (inside.length === 0 && back > 0 && seconds.length === 0) continue;
      seconds.push({
        secondsAgo: back,
        frames: inside.length,
        maxIntervalMs: round(Math.max(0, ...inside.map((x) => x.interval))),
      });
    }
    return {
      frames: s.length,
      coveredSeconds: round(total / 1000),
      avgFps: round((s.length * 1000) / total),
      intervalMs: {
        median: round(percentile(intervals, 0.5)),
        p95: round(percentile(intervals, 0.95)),
        p99: round(percentile(intervals, 0.99)),
        max: round(intervals[intervals.length - 1]),
      },
      cpuMs: {
        median: round(percentile(cpus, 0.5), 2),
        p95: round(percentile(cpus, 0.95), 2),
        max: round(cpus[cpus.length - 1]),
      },
      framesOver: { '33ms': over(33), '50ms': over(50), '100ms': over(100), '250ms': over(250) },
      parts,
      worst,
      seconds,
      longTasks: this.longTasks.slice(-20).map((t) => ({
        secondsAgo: round((now - t.at) / 1000, 1),
        ms: round(t.ms),
      })),
    };
  }
}
