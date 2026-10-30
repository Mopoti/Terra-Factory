import { describe, expect, it } from 'vitest';
import { emptyMachine, Factory, normalizeMachines } from '../factory/factory';
import { GameState } from './state';

describe('kit de réparation', () => {
  const setup = (inventory: Record<string, number>): { s: GameState; f: Factory; id: number } => {
    const s = new GameState({ inventory });
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    const f = new Factory([m], { oreAt: () => null, mineOre: () => 0 });
    f.health.set(1, 30);
    return { s, f, id: 1 };
  };
  it('une charge rend 25 % de la vie ; le kit s’use d’un niveau puis disparaît', () => {
    const { s, f, id } = setup({ repair_kit: 1 });
    expect(s.repairCharges()).toBe(5);
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(f.health.get(id)).toBe(60);
    expect(s.inventory.repair_kit ?? 0).toBe(0);
    expect(s.inventory['repair_kit~4']).toBe(1);
    expect(s.repairCharges()).toBe(4);
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(f.health.has(id)).toBe(false); // 30 + 3 × 30 = 120 : intacte
    expect(s.repairMachine(f, id)).toBe('full');
    expect(s.inventory['repair_kit~2']).toBe(1);
  });
  it('le kit reste en main d’une charge à l’autre', () => {
    const { s, f, id } = setup({ repair_kit: 1 });
    s.held = 'repair_kit';
    s.repairMachine(f, id);
    expect(s.selectedItem()).toBe('repair_kit~4');
  });
  it('on use d’abord le kit le plus entamé ; le dernier niveau détruit le kit', () => {
    const { s, f, id } = setup({ repair_kit: 1, 'repair_kit~1': 1 });
    expect(s.repairMachine(f, id)).toBe('ok');
    expect(s.inventory['repair_kit~1'] ?? 0).toBe(0);
    expect(s.inventory.repair_kit).toBe(1);
  });
  it('sans kit, rien ne se répare', () => {
    const { s, f, id } = setup({});
    expect(s.repairMachine(f, id)).toBe('noKit');
    expect(f.health.get(id)).toBe(30);
  });
  it('une ancienne sauvegarde garde son kit entamé', () => {
    const s = new GameState({ inventory: {}, changes: { kitCharges: 3 } });
    expect(s.inventory['repair_kit~3']).toBe(1);
    expect(s.changes.kitCharges).toBe(0);
  });
});

describe('usure de l’armure', () => {
  it('chaque coup use les pièces portées ; une pièce usée protège moins puis se brise', () => {
    const s = new GameState({ inventory: { armor1_head: 1 } });
    s.changes.equipment.head = 'armor1_head';
    const full = s.armorPercent();
    expect(full).toBeGreaterThan(0);
    for (let i = 0; i < 6; i++) s.mitigate(10); // 60 dégâts : un niveau
    expect(s.changes.equipment.head).toBe('armor1_head~9');
    expect(s.armorPercent()).toBeLessThan(full);
    expect(s.inventory['armor1_head~9']).toBe(1);
    expect(s.inventory.armor1_head ?? 0).toBe(0);
    for (let i = 0; i < 100; i++) s.mitigate(10);
    expect(s.changes.equipment.head).toBeFalsy();
  });
});

describe('vie des machines enregistrée', () => {
  it('une machine abîmée garde sa vie dans la sauvegarde', () => {
    const m = emptyMachine(1, 'furnace', 0, 0, 0);
    const f = new Factory([m], { oreAt: () => null, mineOre: () => 0 });
    f.health.set(1, 45);
    const back = normalizeMachines(JSON.parse(JSON.stringify(f.machines)));
    expect(back[0].hp).toBe(45);
    f.health.delete(1);
    expect(normalizeMachines(JSON.parse(JSON.stringify(f.machines)))[0].hp).toBeUndefined();
  });
});
