import { describe, expect, it } from 'vitest';
import { Factory, emptyMachine, normalizeMachines } from './factory';

const world = { oreAt: () => null, mineOre: () => 0 };
const free = (): boolean => false;

describe('portails : mode manuel ou automatique', () => {
  it('manuel par défaut : E ouvre et ferme, rien ne s’ouvre à l’approche', () => {
    const gate = emptyMachine(1, 'gate_reinforced', 0, 0, 0);
    const f = new Factory([gate], world);
    f.tickGates([{ x: 1, z: 0 }]);
    expect(f.gateOpen(gate)).toBe(false);
    f.toggleGate(gate);
    expect(f.gateOpen(gate)).toBe(true);
    f.toggleGate(gate);
    expect(f.gateOpen(gate)).toBe(false);
  });

  it('en mode automatique : il s’ouvre à l’approche, se referme au départ, et E n’y change rien', () => {
    const gate = emptyMachine(1, 'gate_reinforced', 0, 0, 0);
    const f = new Factory([gate], world);
    expect(f.toggleGateMode(gate)).toBe(true);
    expect(gate.auto).toBe(true);
    f.tickGates([{ x: 1.5, z: 0.25 }]);
    expect(f.gateOpen(gate)).toBe(true);
    f.tickGates([{ x: 50, z: 50 }]);
    expect(f.gateOpen(gate)).toBe(false);
    f.toggleGate(gate);
    expect(f.gateOpen(gate)).toBe(false);
    f.toggleGateMode(gate);
    expect(gate.auto).toBeUndefined();
  });

  it('seuls les portails qui peuvent être automatiques changent de mode', () => {
    const wood = emptyMachine(1, 'gate_wood', 0, 0, 0);
    const f = new Factory([wood], world);
    expect(f.toggleGateMode(wood)).toBe(false);
    expect(wood.auto).toBeUndefined();
  });

  it('le mode est enregistré, et ignoré sur une machine qui n’en a pas', () => {
    const gate = emptyMachine(1, 'gate_reinforced', 0, 0, 0);
    gate.auto = true;
    const lamp = emptyMachine(2, 'lamp', 10, 10, 0);
    lamp.auto = true;
    const back = normalizeMachines(JSON.parse(JSON.stringify([gate, lamp])));
    expect(back.find((m) => m.type === 'gate_reinforced')?.auto).toBe(true);
    expect(back.find((m) => m.type === 'lamp')?.auto).toBeUndefined();
  });
});

describe('barrières en angle', () => {
  it('une barrière peut se poser contre l’angle d’une autre posée dans l’autre sens', () => {
    const horizontal = emptyMachine(1, 'barrier_concrete', 0, 0, 0); // cases (0..2, 0)
    const f = new Factory([horizontal], world);
    // Verticale (tournée d'un quart) dont une case est celle du bout de la première.
    expect(f.canPlace('barrier_reinforced', 2, 0, 1, free)).toBe(true);
    expect(f.canPlace('gate_wood', 2, -1, 1, free)).toBe(true);
  });

  it('mais pas dans le même sens, ni sur une machine qui n’est pas une barrière', () => {
    const horizontal = emptyMachine(1, 'barrier_concrete', 0, 0, 0);
    const lamp = emptyMachine(2, 'lamp', 10, 0, 0);
    const f = new Factory([horizontal, lamp], world);
    expect(f.canPlace('barrier_concrete', 2, 0, 0, free)).toBe(false);
    expect(f.canPlace('barrier_concrete', 1, 0, 2, free)).toBe(false); // sens opposé, même axe
    expect(f.canPlace('barrier_concrete', 10, -1, 1, free)).toBe(false); // lampadaire
    expect(f.canPlace('lamp', 2, 0, 0, free)).toBe(false); // une machine ne se glisse pas sous une barrière
  });
});
