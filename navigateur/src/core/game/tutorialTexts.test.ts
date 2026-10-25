import { describe, expect, it } from 'vitest';
import fr from '../../i18n/fr.json';
import en from '../../i18n/en.json';

/** Le tutoriel doit parler des objets avec leurs noms du jeu (hématite, fourneau…), pas avec d'anciens noms écrits en dur. */
describe('textes du tutoriel', () => {
  const texts = (d: Record<string, string>): [string, string][] =>
    Object.entries(d).filter(([k]) => k.startsWith('tutorial.step.'));

  it('n’emploient plus les anciens noms (minerai de fer, four, iron ore, furnace…)', () => {
    for (const [k, v] of texts(fr)) {
      expect(v, k).not.toMatch(/minerai|\bfour\b/i);
    }
    for (const [k, v] of texts(en)) {
      expect(v.replace(/\{\w+\}/g, ''), k).not.toMatch(/iron ore|furnace|stone tool/i);
    }
  });

  it('les étapes de la chaîne du fer citent les noms du jeu par paramètres', () => {
    expect(fr['tutorial.step.iron']).toContain('{ore}');
    expect(fr['tutorial.step.furnace']).toContain('{furnace}');
    expect(en['tutorial.step.iron']).toContain('{ore}');
  });
});
