import { describe, expect, it } from 'vitest';
import { ITEMS, itemById } from '../data/items';
import { TURRETS, isTurret, machineDef, turretSpec } from '../data/machines';
import { TECHS, isSciencePack, scienceCost, techById, techFor } from '../data/techs';
import { WEAPONS } from '../data/weapons';
import { Threat } from './threat';
import { GameState } from './state';
import { normalizeChanges } from './worldChanges';

describe('technologies de combat', () => {
  it('les armes, armures et tourelles se paient en paquets de combat en plus des paquets de leur palier', () => {
    const combat: Record<string, number> = {
      armor_1: 10,
      turret: 10,
      rifle: 20,
      armor_2: 20,
      turret_heavy: 20,
      sniper: 30,
      turret_laser: 30,
      armor_4: 40,
      turret_plasma: 40,
    };
    for (const [id, n] of Object.entries(combat)) expect(techById(id).cost.combat_pack, id).toBe(n);
    // Le pistolet reste payé en plaques de fer, au palier 0.
    expect(techById('pistol').cost).toEqual({ iron_plate: 10 });
  });

  it('le paquet de combat est un paquet de science à part, fabriqué avec les dépouilles', () => {
    expect(isSciencePack('combat_pack')).toBe(true);
    expect(itemById('combat_pack').recipe).toEqual({ carapace: 2, living_tissue: 1 });
    expect(scienceCost(techById('turret_laser'))).toBe(330);
  });

  it('chaque arme, armure et tourelle est débloquée par une technologie de combat', () => {
    for (const item of [
      'pistol',
      'magazine',
      'rifle',
      'rifle_magazine',
      'sniper',
      'sniper_magazine',
      'machine_turret',
      'machine_turret_heavy',
      'machine_turret_laser',
      'machine_turret_plasma',
      ...ITEMS.filter((i) => /^armor\d_/.test(i.id)).map((i) => i.id),
    ])
      expect(techFor(item), item).not.toBeNull();
    expect(TECHS.filter((t) => t.cost.combat_pack).every((t) => t.requires.length > 0)).toBe(true);
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

  it('le sniper tire peu, fort et loin ; sans visée il disperse, avec la lunette il est précis', () => {
    expect(WEAPONS.sniper.damage).toBeGreaterThan(WEAPONS.rifle.damage * 3);
    expect(WEAPONS.sniper.range).toBeGreaterThan(WEAPONS.rifle.range);
    expect(WEAPONS.sniper.hipSpread).toBeGreaterThan(0);
    expect(WEAPONS.sniper.scopeFov).not.toBeNull();
    const s = new GameState({ inventory: { sniper_magazine: 1 } });
    expect(s.fire('sniper')).toBe(false);
    expect(s.reload('sniper')).toBe('ok');
    expect(s.ammoOf('sniper')).toBe(WEAPONS.sniper.rounds);
    expect(s.fire('sniper')).toBe(true);
    expect(s.ammoOf('sniper')).toBe(WEAPONS.sniper.rounds - 1);
    expect(s.ammoOf('pistol')).toBe(0);
  });
});
