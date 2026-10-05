import { describe, expect, it } from 'vitest';
import fr from './fr.json';
import en from './en.json';
import { detectLocale } from './index';

describe('detectLocale', () => {
  it('prend le français pour fr-FR', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
  });
  it("prend l'anglais pour en-GB", () => {
    expect(detectLocale(['en-GB'])).toBe('en');
  });
  it('ignore les langues non gérées et prend la suivante', () => {
    expect(detectLocale(['de-DE', 'fr'])).toBe('fr');
  });
  it("retombe sur l'anglais si aucune langue gérée", () => {
    expect(detectLocale(['de-DE', 'es'])).toBe('en');
  });
});

describe('traductions', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});
