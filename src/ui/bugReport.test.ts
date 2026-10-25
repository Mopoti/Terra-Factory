import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBugReport, recorder } from './bugReport';

describe('rapport de bug', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { userAgent: 'test', language: 'fr' });
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });
    recorder.clear();
  });

  it('réunit la note, la partie, les actions récentes et la version', () => {
    recorder.record('keydown', { code: 'KeyD' }, 99_000);
    recorder.record('mousedown', { button: 0, x: 1, y: 2 }, 99_500);
    const r = buildBugReport({
      note: '  la loco va tout droit ',
      game: { id: 'g', name: 'Base', seed: 'terra' },
      snapshot: { inventory: {} },
      player: { x: 1, y: 0, z: 2 },
      info: { view: 'third' },
      settings: {},
      screenshot: null,
      now: 100_000,
    });
    expect(r.format).toBe('terra-bug-report');
    expect(r.note).toBe('la loco va tout droit');
    expect(r.build).toBeTruthy();
    expect(r.actions.map((a) => a.kind)).toEqual(['keydown', 'mousedown']);
    expect(r.actions[1].t).toBe(-0.5);
    expect(r.browser.viewport).toEqual({ w: 800, h: 600 });
  });
});
