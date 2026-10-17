import { describe, expect, it } from 'vitest';
import { ITEMS } from '../core/data/items';
import { machineForItem } from '../core/data/machines';
import { DROP_SHAPES, dropShape } from './dropModels';

describe('objets posés au sol', () => {
  it('chaque objet a une forme connue', () => {
    for (const item of ITEMS) expect(DROP_SHAPES, item.id).toContain(dropShape(item.id));
  });

  it('range les objets par sorte', () => {
    expect(dropShape('iron_ingot')).toBe('lingot');
    expect(dropShape('copper_ore_washed')).toBe('minerai');
    expect(dropShape('barrel_oil')).toBe('baril');
    expect(dropShape('science_pack_3')).toBe('science');
    expect(dropShape('iron_gear')).toBe('engrenage');
    expect(dropShape('steel_plate')).toBe('plaque');
    expect(dropShape('wood')).toBe('bois');
    expect(dropShape('hood')).toBe('caisse');
  });

  it('les objets-machines sont reconnus (ils s’affichent en miniature)', () => {
    expect(machineForItem('machine_furnace')).not.toBeNull();
    expect(machineForItem('machine_conveyor_2')).not.toBeNull();
    expect(machineForItem('iron_ingot')).toBeNull();
  });
});
