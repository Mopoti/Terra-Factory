import { describe, expect, it } from 'vitest';
import { levelInfo, variantId } from '../data/itemData';
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

describe('gantelets : outil intégré', () => {
  const hands = (piece: string, level: number | null = 5): GameState => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.hands = piece;
    if (level !== null) s.changes.armorBattery.hands = variantId('battery_portable', level);
    return s;
  };

  it('seuls les gantelets T4 et T5 ont un outil, et il faut de l’énergie', () => {
    expect(hands('armor3_hands').harvestTool()).toBeNull();
    expect(hands('gloves').harvestTool()).toBeNull();
    expect(hands('armor4_hands', null).harvestTool()).toBeNull();
    expect(hands('armor4_hands').harvestTool()).toMatchObject({ speed: 4.5, yield: 3 });
    expect(hands('armor5_hands').harvestTool()).toMatchObject({ speed: 6, yield: 4 });
  });

  it('ils remplacent l’outil en main seulement s’ils sont meilleurs', () => {
    const s = hands('armor4_hands');
    s.inventory.tool_iron = 1;
    s.assignSlot(0, 'tool_iron');
    s.selectSlot(0);
    expect(s.harvestTool()).toMatchObject({ gauntlet: true }); // 4,5 > 3,5
    const weak = hands('armor4_hands', null);
    weak.inventory.tool_iron = 1;
    weak.assignSlot(0, 'tool_iron');
    weak.selectSlot(0);
    expect(weak.harvestTool()).toEqual({ speed: 3.5, yield: 2 }); // sans énergie : l'outil
  });

  it('chaque coup consomme de l’énergie, la T5 un peu moins ; à court, le coup est à mains nues', () => {
    const t4 = hands('armor4_hands', 1);
    let strokes = 0;
    while (t4.payGauntletStroke() && strokes < 1000) strokes++;
    expect(strokes).toBe(Math.ceil(150 / 3)); // un niveau de 150 s à 3 s par coup
    expect(t4.harvestTool()).toBeNull();
    const t5 = hands('armor5_hands', 1);
    let strokes5 = 0;
    while (t5.payGauntletStroke() && strokes5 < 1000) strokes5++;
    expect(strokes5).toBeGreaterThan(strokes);
  });

  it('les gantelets s’usent et ont leur jauge comme les autres pièces', () => {
    expect(levelInfo('armor3_hands')).toEqual({ base: 'armor3_hands', level: 10, steps: 10 });
  });
});

describe('barre de raccourcis en plus (plastron T4 ou T5)', () => {
  const torso = (piece: string, level: number | null = 5): GameState => {
    const s = new GameState({ inventory: { iron_plate: 5, wood: 5, stone: 5 } });
    s.changes.equipment.torso = piece;
    if (level !== null) s.changes.armorBattery.torso = variantId('battery_portable', level);
    return s;
  };

  it('seul un plastron T4 ou T5 donne la barre en plus, et elle demande de l’énergie', () => {
    expect(torso('armor3_torso').hasExtraBar()).toBe(false);
    expect(torso('jacket').hasExtraBar()).toBe(false);
    expect(torso('armor4_torso').extraBarOn()).toBe(true);
    expect(torso('armor5_torso', null).hasExtraBar()).toBe(true);
    expect(torso('armor5_torso', null).extraBarOn()).toBe(false);
  });

  it('on y range et on y choisit des objets (cases 10 à 19) ; un objet n’est que dans une case', () => {
    const s = torso('armor4_torso');
    s.assignSlot(0, 'iron_plate');
    s.assignSlot(12, 'iron_plate'); // déplacé dans la barre en plus
    expect(s.slotItem(0)).toBeNull();
    expect(s.slotItem(12)).toBe('iron_plate');
    s.selectSlot(12);
    expect(s.selectedItem()).toBe('iron_plate');
    const bare = new GameState({ inventory: { iron_plate: 1 } });
    bare.assignSlot(12, 'iron_plate');
    expect(bare.slotItem(12)).toBeNull(); // sans plastron : refusé
    bare.selectSlot(12);
    expect(bare.selectedSlot).toBeNull();
  });

  it('sans énergie ou sans plastron, une case de la barre en plus se lâche, et on sait pourquoi', () => {
    const s = torso('armor4_torso');
    s.assignSlot(12, 'wood');
    s.selectSlot(12);
    expect(s.selectedItem()).toBe('wood');
    expect(s.extraBarRefusal()).toBeNull();
    delete s.changes.armorBattery.torso;
    s.tickExtraBar(0.05);
    expect(s.selectedSlot).toBeNull();
    expect(s.extraBarRefusal()).toBe('noBattery');
    expect(torso('armor3_torso').extraBarRefusal()).toBe('noTorso');
    const off = torso('armor5_torso');
    off.setExtraBar(false);
    expect(off.extraBarRefusal()).toBe('disabled');
  });

  it('elle consomme presque rien, seulement quand elle sert', () => {
    const idle = torso('armor4_torso');
    idle.tickExtraBar(60);
    expect(idle.changes.armorBattery.torso).toBe('battery_portable~5');
    const busy = torso('armor4_torso');
    busy.assignSlot(12, 'wood');
    busy.selectSlot(12);
    for (let i = 0; i < 60 * 20; i++) busy.tickExtraBar(0.05); // une minute
    // 0,05 s d'affichage par seconde : 3 s en une minute, très loin d'un niveau (150 s).
    expect(busy.changes.armorBattery.torso).toBe('battery_portable~4');
    expect(busy.selectedSlot).toBe(12);
  });

  it('elle est enregistrée avec la partie (un objet par case, dans les deux barres)', () => {
    const changes = emptyChanges();
    changes.hotbar[0] = 'wood';
    changes.hotbarExtra[3] = 'iron_plate';
    const back = normalizeChanges(JSON.parse(JSON.stringify(changes)));
    expect(back.hotbarExtra[3]).toBe('iron_plate');
    const dup = JSON.parse(JSON.stringify(changes));
    dup.hotbarExtra[5] = 'wood'; // déjà dans la barre principale
    expect(normalizeChanges(dup).hotbarExtra[5]).toBeNull();
  });
});

describe('bottes : ressorts de saut', () => {
  const boots = (piece: string, level: number | null = 5): GameState => {
    const s = new GameState({ inventory: {} });
    s.changes.equipment.feet = piece;
    if (level !== null) s.changes.armorBattery.feet = variantId('battery_portable', level);
    return s;
  };

  it('seules les bottes T4 et T5 donnent un saut plus haut, la T5 davantage', () => {
    expect(boots('armor3_feet').useJumpBoost()).toBe(1);
    expect(boots('boots').useJumpBoost()).toBe(1);
    expect(boots('armor4_feet').useJumpBoost()).toBeCloseTo(1.15);
    expect(boots('armor5_feet').useJumpBoost()).toBeCloseTo(1.3);
  });

  it('chaque saut paie un peu d’énergie, la T5 moins ; à court, le saut est normal', () => {
    const t4 = boots('armor4_feet', 1);
    let jumps = 0;
    while (t4.useJumpBoost() > 1 && jumps < 1000) jumps++;
    expect(jumps).toBe(100); // un niveau de 150 s à 1,5 s par saut
    const t5 = boots('armor5_feet', 1);
    let jumps5 = 0;
    while (t5.useJumpBoost() > 1 && jumps5 < 1000) jumps5++;
    expect(jumps5).toBeGreaterThan(jumps);
    expect(boots('armor4_feet', null).useJumpBoost()).toBe(1);
  });

  it('on peut les couper dans le menu, et on est prévenu sans bottes ou sans énergie', () => {
    const s = boots('armor5_feet');
    expect(s.setBoots(false)).toBe('ok');
    expect(s.useJumpBoost()).toBe(1);
    expect(s.setBoots(true)).toBe('ok');
    expect(s.useJumpBoost()).toBeGreaterThan(1);
    expect(new GameState({ inventory: {} }).setBoots(true)).toBe('noBoots');
    expect(boots('armor4_feet', null).setBoots(true)).toBe('noBattery');
  });
});

describe('activer ou couper chaque partie de l’armure', () => {
  const full = (): GameState => {
    const s = new GameState({ inventory: {} });
    Object.assign(s.changes.equipment, {
      head: 'armor5_head',
      torso: 'armor5_torso',
      legs: 'armor5_legs',
      hands: 'armor5_hands',
    });
    s.changes.armorBattery.torso = variantId('battery_portable', 5);
    return s;
  };

  it('la barre en plus se coupe et se rallume ; coupée, on revient à la barre principale', () => {
    const s = full();
    expect(s.extraBarOn()).toBe(true);
    s.assignSlot(12, 'wood');
    s.selectSlot(12);
    expect(s.selectedSlot).toBe(12);
    expect(s.setExtraBar(false)).toBe('ok');
    expect(s.extraBarOn()).toBe(false);
    expect(s.selectedSlot).toBeNull();
    expect(s.setExtraBar(true)).toBe('ok');
    expect(s.extraBarOn()).toBe(true);
  });

  it('l’outil des gantelets se coupe : coupé, aucun coup n’est payé et l’outil en main reprend', () => {
    const s = full();
    expect(s.harvestTool()).toMatchObject({ gauntlet: true });
    expect(s.setGauntlet(false)).toBe('ok');
    expect(s.harvestTool()).toBeNull();
    expect(s.setGauntlet(true)).toBe('ok');
    expect(s.harvestTool()).toMatchObject({ gauntlet: true });
  });

  it('on ne peut pas allumer une partie qu’on ne porte pas, et on est prévenu sans énergie', () => {
    const bare = new GameState({ inventory: {} });
    expect(bare.setExtraBar(true)).toBe('noTorso');
    expect(bare.setGauntlet(true)).toBe('noHands');
    const dry = full();
    delete dry.changes.armorBattery.torso;
    expect(dry.setExtraBar(true)).toBe('noBattery');
    expect(dry.setGauntlet(true)).toBe('noBattery');
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
