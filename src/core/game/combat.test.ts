import { describe, expect, it } from 'vitest';
import { ITEMS, itemById } from '../data/items';
import { TURRETS, isTurret, machineDef, turretSpec } from '../data/machines';
import { TECHS, isSciencePack, scienceCost, techById, techFor } from '../data/techs';
import { WEAPONS } from '../data/weapons';
import { Threat } from './threat';
import { GameState } from './state';
import { normalizeChanges } from './worldChanges';

describe('technologies de combat', () => {
  it('palier 1 : 10 plaques de fer ; palier 2 : 5 paquets de combat ; 3 : 10 ; 4 : 20', () => {
    const costOf = (id: string): Record<string, number> => techById(id).cost;
    for (const id of ['defense', 'weapons_1', 'armor_1a', 'armor_1b'])
      expect(costOf(id), id).toEqual({ iron_plate: 10 });
    for (const id of ['weapons_2', 'armor_2a', 'armor_2b', 'turret_2'])
      expect(costOf(id), id).toEqual({ combat_pack: 5 });
    expect(costOf('turret_3')).toEqual({ combat_pack: 10 });
    for (const id of ['armor_4a', 'armor_4b', 'turret_4'])
      expect(costOf(id), id).toEqual({ combat_pack: 20 });
  });

  it('le paquet de combat est un paquet de science à part, fabriqué avec les dépouilles', () => {
    expect(isSciencePack('combat_pack')).toBe(true);
    expect(itemById('combat_pack').recipe).toEqual({ carapace: 2, living_tissue: 1 });
    expect(scienceCost(techById('turret_3'))).toBe(10);
  });

  it('chaque arme, armure et tourelle est débloquée par une technologie de combat', () => {
    for (const item of [
      'pistol',
      'magazine',
      'rifle',
      'rifle_magazine',
      'machine_turret',
      'machine_turret_heavy',
      'machine_turret_laser',
      'machine_turret_plasma',
      ...ITEMS.filter((i) => /^armor\d_/.test(i.id)).map((i) => i.id),
    ])
      expect(techFor(item), item).not.toBeNull();
    expect(TECHS.filter((t) => t.cost.combat_pack).every((t) => (t.reveal?.length ?? 0) > 0)).toBe(
      true,
    );
  });
});

describe('armures', () => {
  it('chaque pièce protège ; l’ensemble complet d’un palier réduit les dégâts de 22, 45 ou 72 %', () => {
    const setPercent = (prefix: string): number =>
      ['head', 'torso', 'legs', 'feet'].reduce(
        (sum, slot) => sum + (itemById(`${prefix}_${slot}`).equip?.armor ?? 0),
        0,
      );
    expect(setPercent('armor1')).toBe(22);
    expect(setPercent('armor2')).toBe(45);
    expect(setPercent('armor4')).toBe(72);
  });

  it('les dégâts reçus baissent avec l’armure portée, jamais au-delà de 80 %', () => {
    const s = new GameState({ inventory: { armor1_head: 1, armor1_torso: 1 } });
    expect(s.mitigate(100)).toBe(100);
    s.equip('armor1_head');
    s.equip('armor1_torso');
    expect(s.armorPercent()).toBe(12);
    expect(s.mitigate(100)).toBeCloseTo(88);
  });

  it('le sac à dos a son propre emplacement : on peut porter plastron et sac', () => {
    const s = new GameState({ inventory: { backpack: 1, armor1_torso: 1 } });
    expect(s.equip('backpack')).toBe('ok');
    expect(s.equip('armor1_torso')).toBe('ok');
    expect(s.changes.equipment).toEqual({ back: 'backpack', torso: 'armor1_torso' });
  });

  it('une ancienne sauvegarde qui rangeait le sac dans « torse » le retrouve dans « dos »', () => {
    expect(normalizeChanges({ equipment: { torso: 'backpack' } }).equipment).toEqual({
      back: 'backpack',
    });
  });
});

describe('armes et tourelles', () => {
  it('le fusil tire plus vite, plus loin et avec son propre chargeur', () => {
    expect(WEAPONS.rifle.every).toBeLessThan(WEAPONS.pistol.every);
    expect(WEAPONS.rifle.range).toBeGreaterThan(WEAPONS.pistol.range);
    const s = new GameState({ inventory: { rifle_magazine: 1, magazine: 1 } });
    expect(s.ammoOf('rifle')).toBe(0);
    expect(s.reload('rifle')).toBe('ok');
    expect(s.ammoOf('rifle')).toBe(30);
    expect(s.inventory.magazine).toBe(1);
    expect(s.fire('rifle')).toBe(true);
    expect(s.ammoOf('rifle')).toBe(29);
    expect(s.ammoOf('pistol')).toBe(0);
  });

  it('quatre tourelles : légère et lourde à munitions, laser et plasma électriques', () => {
    expect(Object.keys(TURRETS)).toHaveLength(4);
    expect(turretSpec('turret').ammo).toBe('magazine');
    expect(turretSpec('turret_heavy').ammo).toBe('rifle_magazine');
    expect(turretSpec('turret_laser').ammo).toBeNull();
    expect(turretSpec('turret_plasma').ammo).toBeNull();
    expect(turretSpec('turret_plasma').damage).toBeGreaterThan(turretSpec('turret_laser').damage);
    for (const t of Object.keys(TURRETS) as (keyof typeof TURRETS)[]) {
      expect(isTurret(t!)).toBe(true);
      expect(itemById(machineDef(t!).item)).toBeTruthy();
    }
    expect(machineDef('turret_laser').consumesKw).toBeGreaterThan(0);
  });
});

describe('dépouilles', () => {
  it('un ennemi tué est noté pour laisser des carapaces ; un nid détruit laisse du tissu vivant', () => {
    const threat = new Threat(
      {},
      {},
      { nestsIn: () => [], treesIn: () => 0, nestsNear: () => [] },
      { aggressive: false },
    );
    threat.enemies.push({
      id: 7,
      x: 3,
      z: 4,
      hp: 5,
      cooldown: 0,
      idle: 0,
      target: null,
      kind: 'scout',
    });
    expect(threat.hit(3, 4, 5, 10)).toBe('kill');
    expect(threat.deaths).toEqual([{ id: 7, x: 3, z: 4, kind: 'scout', mutant: false }]);
    const s = new GameState({});
    s.dropLoot('carapace', 2, 3, 4);
    s.dropLoot('living_tissue', 5, 0, 0);
    expect(s.changes.drops.map((d) => [d.item, d.count])).toEqual([
      ['carapace', 2],
      ['living_tissue', 5],
    ]);
    expect(itemById('carapace').recipe).toBeNull();
    expect(itemById('living_tissue').recipe).toBeNull();
  });
});
