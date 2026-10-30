import { describe, expect, it } from 'vitest';
import { FrameStats } from './perf';

describe('FrameStats', () => {
  it('résume les images par seconde et repère les à-coups', () => {
    const stats = new FrameStats();
    let t = 0;
    for (let i = 0; i < 100; i++) {
      const interval = i === 50 ? 180 : 16.7;
      t += interval;
      stats.record({
        at: t,
        interval,
        cpu: interval === 180 ? 170 : 4,
        parts: { chunks: interval === 180 ? 160 : 0.5, render: 3 },
      });
    }
    const s = stats.summary(t) as {
      frames: number;
      avgFps: number;
      framesOver: Record<string, number>;
      worst: { intervalMs: number; parts: Record<string, number> }[];
      parts: Record<string, { max: number }>;
    };
    expect(s.frames).toBe(100);
    expect(s.avgFps).toBeGreaterThan(40);
    expect(s.framesOver['100ms']).toBe(1);
    expect(s.worst[0].intervalMs).toBe(180);
    expect(s.worst[0].parts.chunks).toBe(160);
    expect(s.parts.chunks.max).toBe(160);
  });
  it('ne garde que les dernières images et accepte un enregistrement vide', () => {
    const stats = new FrameStats(10);
    expect(stats.summary(0)).toEqual({ frames: 0 });
    for (let i = 0; i < 25; i++) stats.record({ at: i * 16, interval: 16, cpu: 3, parts: {} });
    expect((stats.summary(400) as { frames: number }).frames).toBe(10);
  });
});
