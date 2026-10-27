import { describe, expect, it } from 'vitest';
import {
  WAYPOINT_COLORS,
  WAYPOINT_NAME_MAX,
  emptyMachine,
  normalizeMachines,
} from '../factory/factory';
import { itemById } from '../data/items';
import { techFor, discoveriesFromLegacy } from '../data/techs';

describe('balise', () => {
  it('se débloque avec la découverte Balise', () => {
    expect(techFor('waypoint')?.id).toBe('waypoint');
    expect(itemById('waypoint').recipe).not.toBeNull();
  });

  it('le nom (24 caractères au plus) et la couleur sont enregistrés ; une couleur invalide est ignorée', () => {
    const m = emptyMachine(1, 'waypoint', 3, 4, 0);
    m.label = 'x'.repeat(40);
    m.tint = WAYPOINT_COLORS[3];
    const [back] = normalizeMachines(JSON.parse(JSON.stringify([m])));
    expect(back.label).toHaveLength(WAYPOINT_NAME_MAX);
    expect(back.tint).toBe(WAYPOINT_COLORS[3]);
    const bad = normalizeMachines([{ ...m, tint: 'rouge' }]);
    expect(bad[0].tint).toBeUndefined();
  });
});

describe('tapis et aiguillage', () => {
  it('le tapis, le séparateur et le groupeur sont trois découvertes', () => {
    expect(techFor('machine_conveyor')?.id).toBe('conveyor');
    expect(techFor('machine_splitter')?.id).toBe('splitter');
    expect(techFor('machine_merger')?.id).toBe('merger');
  });

  it('une ancienne sauvegarde qui avait Logistique garde l’aiguillage', () => {
    expect(discoveriesFromLegacy(['logistics'])).toEqual(
      expect.arrayContaining(['conveyor', 'splitter', 'merger', 'waypoint']),
    );
  });
});
