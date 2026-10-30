import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { DEFAULT_TIME, cycleSeconds } from './seasons';
import {
  airTempWith,
  coldDamagePerS,
  comfortLimitC,
  shelterTempC,
  temperatureAt,
  windAt,
  windWith,
} from './weather';

describe('vent', () => {
  it('est le même pour la même seed et le même temps', () => {
    expect(windAt(42, 1234)).toEqual(windAt(42, 1234));
    expect(windAt(42, 1234)).not.toEqual(windAt(43, 1234));
  });

  it('reste borné et varie : calmes et rafales', () => {
    const speeds: number[] = [];
    for (let t = 0; t < 3600; t += 5) {
      const w = windAt(7, t);
      expect(w.speed).toBeGreaterThanOrEqual(0);
      expect(w.speed).toBeLessThanOrEqual(1);
      speeds.push(w.speed);
    }
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(0.4);
  });

  it('évolue en douceur : pas de saut d’une seconde à l’autre', () => {
    for (let t = 0; t < 1800; t++) {
      const a = windAt(9, t);
      const b = windAt(9, t + 1);
      expect(Math.abs(b.speed - a.speed)).toBeLessThan(0.05);
      expect(Math.abs(b.dir - a.dir)).toBeLessThan(0.1);
    }
  });
});

describe('température', () => {
  const day = DEFAULT_TIME.dayMinutes * 30; // milieu du premier jour (printemps)
  const winter = (cycleSeconds(DEFAULT_TIME) * DEFAULT_TIME.seasonDays * 3 + day) | 0;
  const summer = (cycleSeconds(DEFAULT_TIME) * DEFAULT_TIME.seasonDays * 1.5) | 0;

  it('est plus froide en hiver qu’en été', () => {
    expect(temperatureAt(1, 2000, 2000, winter)).toBeLessThan(temperatureAt(1, 2000, 2000, summer));
  });

  it('est plus froide la nuit que le jour', () => {
    const night = DEFAULT_TIME.dayMinutes * 60 + 120;
    expect(temperatureAt(1, 2000, 2000, night)).toBeLessThan(temperatureAt(1, 2000, 2000, day));
  });

  it('est plausible partout (-40 à 50 °C)', () => {
    for (let x = -5000; x <= 5000; x += 1250) {
      const c = temperatureAt(3, x, -x / 2, winter);
      expect(c).toBeGreaterThan(-40);
      expect(c).toBeLessThan(50);
    }
  });
});

describe('froid', () => {
  it('ne blesse pas au-dessus du seuil de confort', () => {
    expect(coldDamagePerS(comfortLimitC(0) + 1, 0)).toBe(0);
  });

  it('blesse d’autant plus qu’il fait froid, et moins avec plus de chaleur portée', () => {
    expect(coldDamagePerS(-10, 0)).toBeGreaterThan(coldDamagePerS(0, 0));
    expect(coldDamagePerS(-10, 8)).toBeLessThan(coldDamagePerS(-10, 0));
    expect(coldDamagePerS(-10, 30)).toBe(0);
  });
});

describe('chaleur de l’équipement', () => {
  it('les vêtements et l’armure apportent de la chaleur, l’usure la réduit', () => {
    expect(itemById('jacket').equip?.warmth).toBeGreaterThan(0);
    expect(itemById('armor3_torso').equip?.warmth).toBeGreaterThan(
      itemById('jacket').equip!.warmth,
    );
    expect(itemById('armor3_torso~5').equip!.warmth).toBeLessThan(
      itemById('armor3_torso').equip!.warmth,
    );
  });
});

describe('abri et commandes', () => {
  it('un abri clos adoucit le froid comme la chaleur', () => {
    expect(shelterTempC(-16)).toBeGreaterThan(-16);
    expect(shelterTempC(-16)).toBeLessThan(14);
    expect(shelterTempC(40)).toBeLessThan(40);
    expect(shelterTempC(14)).toBe(14);
  });

  it('les valeurs imposées remplacent le calcul, le reste est inchangé', () => {
    expect(airTempWith(7, undefined)).toBe(7);
    expect(airTempWith(7, { tempC: -3 })).toBe(-3);
    const normal = windAt(5, 100);
    expect(windWith(5, 100, {})).toEqual(normal);
    expect(windWith(5, 100, { windSpeed: 0.9 })).toEqual({ dir: normal.dir, speed: 0.9 });
    expect(windWith(5, 100, { windDir: 1 }).dir).toBe(1);
  });
});
