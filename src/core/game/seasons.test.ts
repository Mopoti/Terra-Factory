import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME,
  climateAt,
  cycleSeconds,
  dayLight,
  normalizeTime,
  yearSeconds,
  seasonAt,
} from './seasons';

const cycle = cycleSeconds(DEFAULT_TIME); // 18 min
const seasonSeconds = cycle * DEFAULT_TIME.seasonDays; // 10 jours + 10 nuits

describe('jour et nuit', () => {
  it('par défaut : 10 min de jour, 8 min de nuit', () => {
    expect(DEFAULT_TIME).toMatchObject({ dayMinutes: 10, nightMinutes: 8, seasonDays: 10 });
    expect(dayLight(5 * 60).isDay).toBe(true);
    expect(dayLight(10 * 60).isDay).toBe(false);
    expect(dayLight(18 * 60 + 5 * 60).isDay).toBe(true);
    expect(dayLight(0).light).toBe(1); // la partie commence en plein jour
  });
  it('la lumière monte à l’aube et descend au crépuscule, et la nuit reste un peu éclairée', () => {
    const noon = dayLight(5 * 60).light;
    const dawn = dayLight(17 * 60 + 30).light; // fin de nuit, l'aube se lève
    const night = dayLight(13 * 60).light;
    expect(noon).toBe(1);
    expect(dawn).toBeGreaterThan(night);
    expect(dawn).toBeLessThan(noon);
    expect(night).toBeGreaterThan(0);
  });
});

describe('saisons', () => {
  it('une saison dure 10 jours et 10 nuits par défaut ; quatre saisons font une année', () => {
    expect(seasonAt(0).season.id).toBe('spring');
    expect(seasonAt(seasonSeconds + 1).season.id).toBe('summer');
    expect(seasonAt(seasonSeconds * 2 + 1).season.id).toBe('autumn');
    expect(seasonAt(seasonSeconds * 3 + 1).season.id).toBe('winter');
    expect(yearSeconds(DEFAULT_TIME)).toBe(seasonSeconds * 4);
    const next = seasonAt(seasonSeconds * 4 + cycle + 1);
    expect(next.season.id).toBe('spring');
    expect(next.year).toBe(2);
    expect(next.day).toBe(2);
  });
  it('le changement est progressif : la teinte varie peu d’une minute à l’autre', () => {
    let biggest = 0;
    let last = climateAt(seasonSeconds * 2.5).ground[0];
    for (let t = seasonSeconds * 2.5; t < seasonSeconds * 3.5; t += 60) {
      const g = climateAt(t).ground[0];
      biggest = Math.max(biggest, Math.abs(g - last));
      last = g;
    }
    expect(biggest).toBeLessThan(0.02);
    // Au centre de l'hiver, on est bien en hiver ; au centre de l'été, pas de neige.
    expect(climateAt(seasonSeconds * 3.5).snow[0]).toBeCloseTo(0.5, 2);
    expect(climateAt(seasonSeconds * 1.5).snow[0]).toBeCloseTo(0, 2);
  });
  it('les parts de l’année se règlent : une saison plus grande dure plus longtemps', () => {
    const cfg = normalizeTime({ shares: [10, 10, 10, 70] });
    expect(cfg.shares).toEqual([10, 10, 10, 70]);
    const y = yearSeconds(cfg);
    expect(seasonAt(y * 0.35, cfg).season.id).toBe('winter');
    expect(seasonAt(y * 0.95, cfg).season.id).toBe('winter');
    expect(seasonAt(y * 0.05, cfg).season.id).toBe('spring');
  });
  it('les réglages sont bornés et les parts totalisent 100 avec au moins 5 % chacune', () => {
    const cfg = normalizeTime({
      dayMinutes: 9999,
      nightMinutes: -3,
      seasonDays: 0,
      shares: [0, 0, 0, 500],
    });
    expect(cfg.dayMinutes).toBe(120);
    expect(cfg.nightMinutes).toBe(1);
    expect(cfg.seasonDays).toBe(1);
    expect(cfg.shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.min(...cfg.shares)).toBeGreaterThanOrEqual(5);
    expect(normalizeTime(undefined)).toEqual(DEFAULT_TIME);
  });
  it('les arbres absorbent moins l’hiver', () => {
    expect(climateAt(seasonSeconds * 3.5).treeAbsorb).toBeLessThan(
      climateAt(seasonSeconds * 1.5).treeAbsorb,
    );
  });
});
