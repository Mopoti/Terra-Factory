import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_CATEGORIES, categoryOf, itemById } from './items';
import { expandLegacyTechs, TECHS } from './techs';

/** Machines et équipements : seuls objets comptés dans la limite de 2 par technologie (les matériaux sont libres). */
const counted = (item: string): boolean =>
  item.startsWith('machine_') ||
  !!itemById(item).equip ||
  item === 'sleeping_bag' ||
  item === 'bed';

describe('technologies', () => {
  it('chaque technologie débloque 2 machines ou équipements au plus', () => {
    for (const tech of TECHS) {
      expect(tech.unlocks.filter(counted).length, tech.id).toBeLessThanOrEqual(2);
    }
  });

  it('un objet n’est débloqué que par une seule technologie, et les prérequis existent', () => {
    const seen = new Map<string, string>();
    const ids = new Set(TECHS.map((t) => t.id));
    for (const tech of TECHS) {
      for (const r of tech.requires) expect(ids.has(r), `${tech.id} → ${r}`).toBe(true);
      for (const u of tech.unlocks) {
        expect(seen.get(u), u).toBeUndefined();
        seen.set(u, tech.id);
      }
    }
  });

  it('une ancienne sauvegarde garde ce que débloquait l’ancienne technologie découpée', () => {
    const ids = expandLegacyTechs(['electricity', 'textile', 'logistics', 'steam']);
    for (const id of [
      'power_generation',
      'laboratory',
      'clothing',
      'handwear',
      'bedding',
      'handling',
      'steam_power',
    ])
      expect(ids).toContain(id);
    expect(expandLegacyTechs(['electricity'])).not.toContain('handling');
  });
});

describe('onglets de fabrication', () => {
  it('chaque objet fabricable a un onglet, et aucun onglet n’est vide ni trop chargé', () => {
    const counts = new Map<string, number>();
    for (const item of ITEMS.filter((i) => i.recipe !== null)) {
      expect(categoryOf(item), item.id).not.toBeNull();
      counts.set(categoryOf(item)!, (counts.get(categoryOf(item)!) ?? 0) + 1);
    }
    for (const c of ITEM_CATEGORIES) {
      expect(counts.get(c) ?? 0, c).toBeGreaterThan(0);
      expect(counts.get(c) ?? 0, c).toBeLessThanOrEqual(12);
    }
  });
});
