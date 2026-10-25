import { describe, expect, it } from 'vitest';
import { getDevice, noteDevice, onDeviceChange } from './lastDevice';

describe('dernier périphérique', () => {
  it('prévient quand on change de périphérique, pas quand on reste sur le même', () => {
    const seen: string[] = [];
    const off = onDeviceChange((d) => seen.push(d));
    noteDevice('keyboard');
    noteDevice('pad');
    noteDevice('pad');
    noteDevice('keyboard');
    off();
    expect(seen).toEqual(['pad', 'keyboard']);
    expect(getDevice()).toBe('keyboard');
  });
});
