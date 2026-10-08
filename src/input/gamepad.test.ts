import { describe, expect, it } from 'vitest';
import { readPad, withDeadzone, type PadState } from './gamepad';

const pad = (buttons: number[] = [], axes: number[] = [0, 0, 0, 0]): PadState => ({
  buttons: Array.from({ length: 17 }, (_, i) => buttons.includes(i)),
  axes,
});

describe('manette', () => {
  it('zone morte : rien sous le seuil, plein tarif à fond', () => {
    expect(withDeadzone(0.1)).toBe(0);
    expect(withDeadzone(1)).toBe(1);
    expect(withDeadzone(-1)).toBe(-1);
    expect(withDeadzone(0.6)).toBeCloseTo(0.5);
  });

  it('le stick gauche déplace, le droit regarde', () => {
    const f = readPad(pad([], [0, -0.9, 0.5, 0]), null, false);
    expect([...f.held]).toEqual(['forward']);
    expect(f.look.x).toBeGreaterThan(0);
    expect(f.look.y).toBe(0);
  });

  it('boutons : saut, clic (gâchette droite), démolir (gauche), sac, carte', () => {
    const f = readPad(pad([0, 7, 6, 13, 8]), null, false);
    expect([...f.held].sort()).toEqual(['interact', 'inventory', 'jump', 'map', 'secondary']);
  });

  it('Start et épaules ne comptent qu’à l’appui', () => {
    const down = pad([9, 5]);
    expect([...readPad(down, null, false).edges].sort()).toEqual(['hotbarNext', 'pause']);
    expect(readPad(down, down, false).edges.size).toBe(0);
  });

  it('dans les menus : la croix et A / B naviguent, rien ne se joue', () => {
    const f = readPad(pad([13, 0], [0, 0, 1, 1]), null, true);
    expect(f.held.size).toBe(0);
    expect(f.look).toEqual({ x: 0, y: 0 });
    expect([...f.edges].sort()).toEqual(['accept', 'down']);
    const stick = readPad(pad([], [0, 0.9, 0, 0]), pad(), true);
    expect(stick.edges.has('down')).toBe(true);
  });
});
