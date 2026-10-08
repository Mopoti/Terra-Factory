import { describe, expect, it } from 'vitest';
import { splitPlayTime } from './playTime';

describe('temps de jeu', () => {
  it('découpe des secondes en heures, minutes, secondes', () => {
    expect(splitPlayTime(0)).toEqual({ h: 0, m: 0, s: 0 });
    expect(splitPlayTime(3725.9)).toEqual({ h: 1, m: 2, s: 5 });
    expect(splitPlayTime(-4)).toEqual({ h: 0, m: 0, s: 0 });
    expect(splitPlayTime(Number.NaN)).toEqual({ h: 0, m: 0, s: 0 });
  });
});
