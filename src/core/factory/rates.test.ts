import { describe, expect, it } from 'vitest';
import { machineRates } from './rates';

const line = (lines: { id: string; perSec: number }[], id: string): number | undefined =>
  lines.find((l) => l.id === id)?.perSec;

describe('débits des machines', () => {
  it('un fourneau : minerai et charbon entrants, lingots sortants, par seconde', () => {
    const r = machineRates('furnace', 'iron');
    expect(r.recipe).toEqual({ id: 'iron', seconds: 10 });
    expect(line(r.inputs, 'iron_ore')).toBeCloseTo(0.2);
    expect(line(r.inputs, 'coal')).toBeCloseTo(0.1);
    expect(line(r.outputs, 'iron_ingot')).toBeCloseTo(0.2);
    expect(r.burnKw).toBeGreaterThan(0);
  });

  it('la presse à plastique prend du polymère et rend des isolants', () => {
    const r = machineRates('plastic_press', 'plastic');
    expect(r.inputs.find((l) => l.kind === 'fluid')).toMatchObject({ id: 'polymer' });
    expect(line(r.inputs, 'polymer')).toBeCloseTo(20 / 3, 2);
    expect(line(r.outputs, 'plastic_insulator')).toBeCloseTo(4 / 3, 2);
    expect(r.consumeKw).toBe(80);
  });

  it('le caoutchouc : polymère et charbon entrants', () => {
    const r = machineRates('plastic_press', 'rubber');
    expect(line(r.inputs, 'coal')).toBeCloseTo(0.25);
    expect(line(r.inputs, 'polymer')).toBeCloseTo(7.5);
    expect(line(r.outputs, 'rubber')).toBeCloseTo(0.5);
  });

  it('le réacteur rejette de l’eau contaminée et pollue le sol ; la raffinerie pollue l’air', () => {
    const reactor = machineRates('fission_reactor', null);
    expect(reactor.dirtyWaterPerSec).toBe(20);
    expect(reactor.pollution?.kind).toBe('ground');
    expect(machineRates('refinery', null).pollution).toEqual({ kind: 'air', perSec: 0.8 });
  });

  it('le four électrique refroidi à l’eau : de l’eau froide entre, de l’eau chaude sort', () => {
    const r = machineRates('furnace_electric', 'silicon');
    expect(r.inputs.some((l) => l.id === 'water')).toBe(true);
    expect(r.outputs.some((l) => l.id === 'hot')).toBe(true);
  });

  it('une machine sans recette n’a ni entrée ni sortie d’objets', () => {
    expect(machineRates('stamper', null).recipe).toBeNull();
    expect(machineRates('pump', null).outputs).toEqual([
      { kind: 'fluid', id: 'water', perSec: 100 },
    ]);
  });
});
