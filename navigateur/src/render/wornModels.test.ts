import { describe, expect, it } from 'vitest';
import { isGloves, wornHidesHair, wornModelName } from './wornModels';

describe('équipement porté', () => {
  it('donne le modèle porté des vêtements', () => {
    expect(wornModelName('backpack')).toBe('porte_sac_a_dos');
    expect(wornModelName('hood')).toBe('porte_capuche');
    expect(wornModelName('armor1_head')).toBe('porte_armure1_casque');
    expect(wornModelName('armor5_feet')).toBe('porte_armure5_bottes');
    expect(wornModelName('jetpack')).toBe('porte_propulseur');
    expect(wornModelName('compass')).toBeNull();
    expect(wornHidesHair('armor3_head')).toBe(true);
    expect(wornHidesHair('hood')).toBe(true);
    expect(wornHidesHair('jacket')).toBe(false);
    expect(isGloves('gloves')).toBe(true);
  });
});
