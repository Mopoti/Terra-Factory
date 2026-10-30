import { describe, expect, it } from 'vitest';
import { COMMANDS, findCommand, runChat, usageOf, type ChatContext } from './chatCommands';
import { DEFAULT_TIME, climateAt, dayLight } from './seasons';
import { GameState } from './state';

const ctx = (): ChatContext => ({ state: new GameState({ inventory: {} }), time: DEFAULT_TIME });

describe('commandes du chat', () => {
  it('une ligne sans / n’est pas une commande, une commande inconnue est refusée', () => {
    expect(runChat('bonjour', ctx()).ok).toBe(false);
    expect(runChat('/nimporte', ctx()).ok).toBe(false);
  });

  it('trouve une commande par son nom ou un alias, sans accents ni majuscules', () => {
    expect(findCommand('/Température')?.name).toBe('temperature');
    expect(findCommand('temp')?.name).toBe('temperature');
    expect(findCommand('WIND')?.name).toBe('vent');
  });

  it('/temperature impose une température puis revient à auto', () => {
    const c = ctx();
    expect(runChat('/temperature -12,5', c).ok).toBe(true);
    expect(c.state.changes.weather.tempC).toBe(-12.5);
    runChat('/temp auto', c);
    expect(c.state.changes.weather.tempC).toBeUndefined();
  });

  it('refuse une valeur hors bornes ou absente, en rappelant le mode d’emploi', () => {
    const c = ctx();
    const r = runChat('/vent 250', c);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('/vent');
    expect(runChat('/vent', c).ok).toBe(false);
    expect(c.state.changes.weather.windSpeed).toBeUndefined();
  });

  it('/vent règle la force (en %) et la direction (point cardinal)', () => {
    const c = ctx();
    runChat('/vent 80 no', c);
    expect(c.state.changes.weather.windSpeed).toBeCloseTo(0.8);
    expect(c.state.changes.weather.windDir).toBeCloseTo((5 * Math.PI) / 4);
    runChat('/vent auto', c);
    expect(c.state.changes.weather).toEqual({});
  });

  it('/saison et /jour /nuit déplacent le temps de jeu vers l’avant', () => {
    const c = ctx();
    runChat('/saison hiver', c);
    expect(climateAt(c.state.changes.time, DEFAULT_TIME).season.id).toBe('winter');
    runChat('/nuit', c);
    expect(dayLight(c.state.changes.time, DEFAULT_TIME).isDay).toBe(false);
    runChat('/jour', c);
    expect(dayLight(c.state.changes.time, DEFAULT_TIME).isDay).toBe(true);
  });

  it('/meteo remet tout à zéro', () => {
    const c = ctx();
    runChat('/temp 30', c);
    runChat('/vent 10', c);
    runChat('/meteo', c);
    expect(c.state.changes.weather).toEqual({});
  });

  it('une commande réussie marque la partie « admin »', () => {
    const c = ctx();
    expect(c.state.changes.admin).toBe(false);
    runChat('/jour', c);
    expect(c.state.changes.admin).toBe(true);
  });

  it('chaque commande a un mode d’emploi et l’aide les liste toutes', () => {
    for (const cmd of COMMANDS) expect(usageOf(cmd)).toContain(`/${cmd.name}`);
    const help = runChat('/aide', ctx()).text;
    for (const cmd of COMMANDS) expect(help).toContain(`/${cmd.name}`);
  });
});
