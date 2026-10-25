import { describe, expect, it } from 'vitest';
import { ActionRecorder } from './recorder';

describe('enregistreur d’actions', () => {
  it('ne garde que la dernière minute, datée avant le rapport', () => {
    const r = new ActionRecorder(60_000);
    r.record('key', { code: 'KeyA' }, 0);
    r.record('key', { code: 'KeyB' }, 30_000);
    r.record('click', undefined, 70_000);
    const out = r.dump(75_000);
    expect(out.map((e) => e.kind)).toEqual(['key', 'click']);
    expect(out[0].t).toBe(-45);
    expect(out[1].t).toBe(-5);
    expect(out[1]).not.toHaveProperty('data');
  });

  it('plafonne le nombre d’événements', () => {
    const r = new ActionRecorder(60_000, 3);
    for (let i = 0; i < 10; i++) r.record('k', i, i);
    expect(r.dump(10).map((e) => e.data)).toEqual([7, 8, 9]);
  });
});
