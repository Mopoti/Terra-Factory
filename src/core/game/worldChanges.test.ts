import { describe, expect, it } from 'vitest';
import { CHUNK_CELLS } from '../constants';
import { energyKJ } from '../data/items';
import { machineDef } from '../data/machines';
import { emptyMachine } from '../factory/factory';
import type { ChunkData } from '../world/worldgen';
import { NEST_HP, applyChanges, cellKey, emptyChanges, normalizeChanges } from './worldChanges';

const chunkWithNest = (): ChunkData =>
  ({
    objects: [{ id: 'nest', gx: 4, gz: 6, cells: 4, scale: 1, rotation: 0, amount: 0 }],
    ore: [],
    water: [],
  }) as unknown as ChunkData;

describe('nids détruits et mode débogage', () => {
  it('un nid disparaît quand il a reçu tous ses points de dégâts', () => {
    const changes = emptyChanges();
    changes.taken[cellKey(4, 6)] = NEST_HP - 1;
    expect(applyChanges(chunkWithNest(), changes).objects).toHaveLength(1);
    changes.taken[cellKey(4, 6)] = NEST_HP;
    expect(applyChanges(chunkWithNest(), changes).objects).toHaveLength(0);
  });

  it('le drapeau « admin » (débogage utilisé) est enregistré', () => {
    expect(normalizeChanges({}).admin).toBe(false);
    expect(normalizeChanges({ admin: true }).admin).toBe(true);
  });
});

describe('corps et points de réapparition', () => {
  it('sont enregistrés avec leur contenu, ignorés s’ils sont invalides', () => {
    const c = normalizeChanges({
      // Ancienne sauvegarde : le sac à dos rangé dans « torse » passe dans « dos ».
      corpses: [
        { id: 4, x: 3, z: -4, yaw: 1, inventory: { coal: 7 }, equipment: { torso: 'backpack' } },
        { x: 'a' },
      ],
      spawns: [
        { id: 2, x: 10, z: 12, kind: 'bed' },
        { id: 3, x: 1, z: 1, kind: 'tent' },
      ],
    });
    expect(c.corpses).toHaveLength(1);
    expect(c.corpses[0].inventory).toEqual({ coal: 7 });
    expect(c.corpses[0].equipment).toEqual({ back: 'backpack' });
    expect(c.nextCorpseId).toBe(5);
    expect(c.spawns).toEqual([{ id: 2, x: 10, z: 12, kind: 'bed' }]);
    expect(c.nextSpawnId).toBe(3);
  });
});

describe('énergie des combustibles', () => {
  const drill = (fuelLeft: number): unknown => ({
    ...emptyMachine(1, 'drill', 0, 0, 0),
    fuelLeft,
  });
  it('une ancienne sauvegarde (secondes de combustion) est convertie en kilojoules', () => {
    const old = normalizeChanges({ machines: [drill(10)] });
    expect(old.machines[0].fuelLeft).toBe(10 * 90);
    const now = normalizeChanges({ machines: [drill(900)], energyVersion: 1 });
    expect(now.machines[0].fuelLeft).toBe(900);
  });
  it('chaque combustible a une énergie en MJ, chaque machine à combustible une puissance en kW', () => {
    expect(energyKJ('coal')).toBe(9000);
    expect(energyKJ('wood')).toBe(1800);
    expect(energyKJ('stone')).toBe(0);
    for (const type of ['drill', 'furnace', 'generator', 'arm', 'boiler'] as const)
      expect(machineDef(type).burnKw).toBeGreaterThan(0);
    // un charbon fait tourner une foreuse (90 kW) pendant 100 s
    expect(energyKJ('coal') / (machineDef('drill').burnKw ?? 1)).toBe(100);
  });
});

describe('nids créés par l’expansion', () => {
  it('sont enregistrés, relus, et apparaissent dans leur bloc comme des objets du monde', () => {
    const c = emptyChanges();
    c.nests.push({ gx: 70, gz: 5, cells: 4 });
    const back = normalizeChanges(JSON.parse(JSON.stringify(c)));
    expect(back.nests).toEqual([{ gx: 70, gz: 5, cells: 4 }]);
    const cx = Math.floor(70 / CHUNK_CELLS);
    const chunk = applyChanges({ cx, cz: 0, objects: [], ore: [], water: [] }, back);
    expect(chunk.objects.map((o) => o.id)).toEqual(['nest']);
    // Détruit (dégâts cumulés) : il disparaît.
    back.taken[cellKey(70, 5)] = NEST_HP;
    expect(applyChanges({ cx, cz: 0, objects: [], ore: [], water: [] }, back).objects).toEqual([]);
  });
});
