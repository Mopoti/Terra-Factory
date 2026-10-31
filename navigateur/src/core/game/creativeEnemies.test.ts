import { describe, expect, it } from 'vitest';
import { ITEMS, creativeEnemyOf, creativeResourceOf } from '../data/items';
import { GameState } from './state';
import { Threat, kindOf, type ThreatWorld } from './threat';

const world: ThreatWorld = { nestsIn: () => [], treesIn: () => 0, nestsNear: () => [] };

describe('onglet Ennemis du Créatif', () => {
  it('un nid et chaque type d’ennemi ont leur objet, rangés dans l’onglet « enemies »', () => {
    for (const id of ['res_nest', 'res_scout', 'res_guard', 'res_spitter']) {
      const item = ITEMS.find((i) => i.id === id);
      expect(item?.category).toBe('enemies');
      expect(item?.creativeOnly).toBe(true);
      expect(creativeEnemyOf(id)).not.toBeNull();
    }
    expect(creativeEnemyOf('res_iron_ore')).toBeNull();
    expect(creativeEnemyOf(null)).toBeNull();
    // Ce sont aussi des « res_ » : le jeu ne les récolte pas et les masque en Survie.
    expect(creativeResourceOf('res_nest')).toBe('nest');
  });

  it('ils n’existent qu’en Créatif', () => {
    const s = new GameState({ inventory: {} });
    expect(s.isUnlocked('res_guard')).toBe(false);
    s.creative = true;
    expect(s.isUnlocked('res_guard')).toBe(true);
  });

  it('spawnAt pose un ennemi du bon type, gardien et cracheur restant près de leur point', () => {
    const t = new Threat({}, {}, world, { aggressive: false });
    t.spawnAt(10, 20, 'guard');
    t.spawnAt(30, 40, 'spitter');
    t.spawnAt(50, 60, 'scout');
    expect(t.enemies.map(kindOf)).toEqual(['guard', 'spitter', 'scout']);
    expect(t.enemies[0].home).toEqual({ x: 10, z: 20 });
    expect(t.enemies[2].home).toBeUndefined();
  });
});
