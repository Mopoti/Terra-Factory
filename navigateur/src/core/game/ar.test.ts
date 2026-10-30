import { describe, expect, it } from 'vitest';
import { variantId } from '../data/itemData';
import { GameState } from './state';
import { emptyChanges, normalizeChanges } from './worldChanges';

describe('réalité augmentée', () => {
  /** Un joueur casqué T4 avec une batterie (niveau donné) dans le casque. */
  const armored = (level: number | null, helmet = 'armor4_head'): GameState => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.head = helmet;
    if (level !== null) s.changes.armorBattery.head = variantId('battery_portable', level);
    return s;
  };

  it('exige un casque T4 ou T5, pas une autre pièce', () => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.head = 'armor3_head';
    s.changes.armorBattery.head = 'battery_portable~5';
    expect(s.setAr(1)).toBe('noArmor');
    s.changes.equipment.head = undefined;
    s.changes.equipment.torso = 'armor5_torso';
    expect(s.setAr(1)).toBe('noArmor');
    s.changes.equipment.head = 'armor5_head';
    expect(s.setAr(1)).toBe('ok');
  });

  it('exige une batterie dans l’armure, pas dans le sac', () => {
    const s = armored(null);
    s.inventory['battery_portable~5'] = 1;
    expect(s.setAr(1)).toBe('noBattery');
    expect(s.arMode).toBe(0);
  });

  it('passe de désactivé à simple, complet puis désactivé', () => {
    const s = armored(5);
    s.setAr(1);
    expect(s.arMode).toBe(1);
    s.setAr(2);
    expect(s.arMode).toBe(2);
    s.setAr(0);
    expect(s.arMode).toBe(0);
  });

  it('puise dans la batterie de l’armure ; le mode complet consomme trois fois plus', () => {
    const simple = armored(5);
    simple.setAr(1);
    expect(simple.useAr(60)).toBe(true);
    expect(simple.changes.armorBattery.head).toBe('battery_portable~4');
    const full = armored(5);
    full.setAr(2);
    let steps = 0;
    for (let t = 0; t < 600; t++) {
      if (full.useAr(1)) steps++;
      else break;
    }
    expect(full.arMode).toBe(0);
    // 5 niveaux de 150 s en simple = 750 s ; en complet, trois fois moins.
    expect(steps).toBeLessThanOrEqual(260);
    expect(steps).toBeGreaterThanOrEqual(240);
  });

  it('l’armure T5 consomme un peu moins que la T4', () => {
    const run = (helmet: string): number => {
      const s = armored(3, helmet);
      s.setAr(1);
      let steps = 0;
      while (s.useAr(1) && steps < 5000) steps++;
      return steps;
    };
    expect(run('armor5_head')).toBeGreaterThan(run('armor4_head'));
  });

  it('se coupe quand le casque est retiré', () => {
    const s = armored(5);
    s.setAr(1);
    delete s.changes.equipment.head;
    expect(s.useAr(1)).toBe(false);
    expect(s.arMode).toBe(0);
  });
});

describe('batterie dans une pièce d’armure', () => {
  const worn = (): GameState => {
    const s = new GameState({ inventory: { 'battery_portable~4': 1, battery_portable: 1 } });
    s.changes.equipment.torso = 'armor5_torso';
    return s;
  };

  it('s’insère dans une pièce T4 ou T5 seulement, et seule une batterie portable passe', () => {
    const s = worn();
    expect(s.insertArmorBattery('torso', 'battery_portable~4')).toBe('ok');
    expect(s.changes.armorBattery.torso).toBe('battery_portable~4');
    expect(s.inventory['battery_portable~4']).toBeUndefined();
    s.inventory.iron_plate = 1;
    expect(s.insertArmorBattery('torso', 'iron_plate')).toBe('notBattery');
    expect(s.insertArmorBattery('legs', 'battery_portable')).toBe('noPiece');
    s.changes.equipment.hands = 'gloves';
    expect(s.insertArmorBattery('hands', 'battery_portable')).toBe('noPiece');
  });

  it('remplacer la batterie rend l’ancienne au sac, et la reprendre aussi', () => {
    const s = worn();
    s.insertArmorBattery('torso', 'battery_portable~4');
    expect(s.insertArmorBattery('torso', 'battery_portable')).toBe('ok');
    expect(s.inventory['battery_portable~4']).toBe(1);
    expect(s.removeArmorBattery('torso')).toBe('ok');
    expect(s.inventory.battery_portable).toBe(1);
    expect(s.removeArmorBattery('torso')).toBe('empty');
  });

  it('enlever la pièce rend la batterie au sac', () => {
    const s = worn();
    s.insertArmorBattery('torso', 'battery_portable~4');
    expect(s.unequip('torso')).toBe('ok');
    expect(s.changes.armorBattery.torso).toBeUndefined();
    expect(s.inventory['battery_portable~4']).toBe(1);
  });

  it('la mort la laisse sur le corps', () => {
    const s = worn();
    s.insertArmorBattery('torso', 'battery_portable~4');
    const corpse = s.dieAt(0, 0, 0);
    expect(corpse.inventory['battery_portable~4']).toBe(1);
    expect(s.changes.armorBattery).toEqual({});
  });

  it('se recharge avec les batteries du sac (la borne), jusqu’à pleine', () => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.torso = 'armor4_torso';
    s.changes.armorBattery.torso = 'battery_portable~8';
    expect(s.hasChargeableBattery()).toBe(true);
    s.chargeBatteries(5000);
    expect(s.changes.armorBattery.torso).toBe('battery_portable~10');
    expect(s.hasChargeableBattery()).toBe(false);
  });
});

describe('exosquelette des jambes', () => {
  const legs = (piece: string, level: number | null = 5): GameState => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.legs = piece;
    if (level !== null) s.changes.armorBattery.legs = variantId('battery_portable', level);
    return s;
  };

  it('exige des jambes T4 ou T5 et une batterie', () => {
    const plain = new GameState({ inventory: {} });
    plain.changes.equipment.legs = 'armor3_legs';
    expect(plain.setExo(true)).toBe('noLegs');
    expect(legs('armor4_legs', null).setExo(true)).toBe('noBattery');
    expect(legs('armor4_legs').setExo(true)).toBe('ok');
  });

  it('T4 donne la puissance 1 (+40 kg), T5 la puissance 2 (+80 kg), seulement allumé', () => {
    const t4 = legs('armor4_legs');
    const base = t4.limits.maxWeightG;
    expect(t4.exoPower()).toBe(0);
    t4.setExo(true);
    expect(t4.exoPower()).toBe(1);
    expect(t4.limits.maxWeightG).toBe(base + 40_000);
    const t5 = legs('armor5_legs');
    t5.setExo(true);
    expect(t5.exoPower()).toBe(2);
    expect(t5.limits.maxWeightG).toBe(base + 80_000);
  });

  it('consomme seulement en marchant, la T5 un peu moins que la T4', () => {
    const t4 = legs('armor4_legs');
    t4.setExo(true);
    t4.tickExo(60, false);
    expect(t4.changes.armorBattery.legs).toBe('battery_portable~5');
    const run = (piece: string): number => {
      const s = legs(piece, 3);
      s.setExo(true);
      let n = 0;
      while (s.exoOn && n < 5000) {
        s.tickExo(1, true);
        n++;
      }
      return n;
    };
    expect(run('armor5_legs')).toBeGreaterThan(run('armor4_legs'));
  });

  it('s’éteint à court d’énergie ou quand les jambes sont retirées', () => {
    const s = legs('armor4_legs', 1);
    s.setExo(true);
    for (let i = 0; i < 400 && s.exoOn; i++) s.tickExo(1, true);
    expect(s.exoOn).toBe(false);
    const t = legs('armor4_legs');
    t.setExo(true);
    delete t.changes.equipment.legs;
    t.tickExo(1, true);
    expect(t.exoOn).toBe(false);
  });

  it('l’ancien exosquelette (T3) reste actif sans énergie', () => {
    const s = legs('exoskeleton', null);
    expect(s.exoPower()).toBe(1);
  });
});

describe('sauvegarde de la batterie d’armure', () => {
  it('survit à l’enregistrement, mais pas sans pièce T4 ou T5 pour la porter', () => {
    const changes = emptyChanges();
    changes.equipment.torso = 'armor5_torso';
    changes.armorBattery.torso = 'battery_portable~7';
    const back = normalizeChanges(JSON.parse(JSON.stringify(changes)));
    expect(back.armorBattery.torso).toBe('battery_portable~7');
    const bad = JSON.parse(JSON.stringify(changes));
    bad.equipment = { torso: 'jacket' };
    expect(normalizeChanges(bad).armorBattery).toEqual({});
  });
});

describe('chaîne de recherche', () => {
  it('liste les prérequis manquants avant la technologie, sans doublon', async () => {
    const { researchChain, techById } = await import('../data/techs');
    const chain = researchChain('wind', []);
    expect(chain.at(-1)).toBe('wind');
    expect(new Set(chain).size).toBe(chain.length);
    chain.forEach((id, i) => {
      for (const r of techById(id).requires) expect(chain.indexOf(r)).toBeLessThan(i);
    });
    expect(researchChain('wind', chain)).toEqual([]);
  });
});
