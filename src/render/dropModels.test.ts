import { describe, expect, it } from 'vitest';
import { ITEMS } from '../core/data/items';
import { machineForItem } from '../core/data/machines';
import { DROP_SHAPES, dropShape, iconModelName } from './dropModels';

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
    expect(dropShape('hood')).toBe('capuche');
    expect(dropShape('steel_rod')).toBe('tige');
    expect(dropShape('rifle_magazine')).toBe('chargeur_fusil');
    expect(dropShape('armor2_torso')).toBe('armure2_plastron');
    expect(dropShape('armor4_feet')).toBe('armure4_bottes');
    expect(dropShape('res_water')).toBe('eau');
  });

  it('les pièces béton et aluminium, la gare et les ressources du monde ont leur modèle', () => {
    expect(iconModelName('piece_wall_concrete')).toBe('mur_beton');
    expect(iconModelName('piece_pillar_aluminium')).toBe('pilier_aluminium_seul');
    expect(iconModelName('piece_garage_aluminium')).toBe('porte_garage_aluminium');
    expect(iconModelName('train_station')).toBe('gare');
    expect(iconModelName('vehicle_cart')).toBe('charrette');
    expect(iconModelName('res_coal')).toBe('minerai_charbon_1');
    expect(iconModelName('res_tree')).toBe('arbre_prairie_1');
  });

  it('les objets-machines sont reconnus (ils s’affichent en miniature)', () => {
    expect(machineForItem('machine_furnace')).not.toBeNull();
    expect(machineForItem('machine_conveyor_2')).not.toBeNull();
    expect(machineForItem('iron_ingot')).toBeNull();
  });
});
