import { describe, expect, it } from 'vitest';
import { itemById } from './items';
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
