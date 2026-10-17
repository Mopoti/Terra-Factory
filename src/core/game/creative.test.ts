import { describe, expect, it } from 'vitest';
import { creativeResourceOf, itemById } from '../data/items';
import { GameState, CREATIVE_ORE_MAX, CREATIVE_ORE_MIN } from './state';
import { applyChanges, normalizeChanges, withPlaced } from './worldChanges';
import type { ChunkData } from '../world/worldgen';

const emptyChunk = (): ChunkData => ({ cx: 0, cz: 0, objects: [], ore: [], water: [] });

describe('mode Créatif : ressources posées', () => {
  const creative = (): GameState => {
    const s = new GameState();
    s.creative = true;
    return s;
  };

  it('l’onglet Ressources n’existe qu’en Créatif', () => {
    const s = new GameState();
    expect(itemById('res_iron_ore').creativeOnly).toBe(true);
    expect(s.isUnlocked('res_iron_ore')).toBe(false);
    s.creative = true;
    expect(s.isUnlocked('res_iron_ore')).toBe(true);
    expect(creativeResourceOf('res_water')).toBe('water');
    expect(creativeResourceOf('iron_ore')).toBeNull();
  });

  it('pose une case de minerai à quantité aléatoire, un arbre de 2 × 2 cases, une case d’eau', () => {
    const s = creative();
    const ore = s.placeResource('iron_ore', 3, 4, 0.37)!;
    expect(ore.amount).toBeGreaterThanOrEqual(CREATIVE_ORE_MIN);
    expect(ore.amount).toBeLessThanOrEqual(CREATIVE_ORE_MAX);
    s.placeResource('tree', 8, 8, 0.5);
    s.placeResource('water', 1, 1);
    const data = applyChanges(emptyChunk(), s.changes);
    expect(data.ore).toEqual([{ id: 'iron_ore', gx: 3, gz: 4, amount: ore.amount }]);
    expect(data.objects).toHaveLength(1);
    expect(data.objects[0]).toMatchObject({ id: 'tree', gx: 8, gz: 8, cells: 2 });
    expect(data.objects[0].amount).toBeGreaterThan(0);
    expect(data.water).toEqual([{ gx: 1, gz: 1 }]);
  });

  it('refuse en Survie', () => {
    expect(new GameState().placeResource('iron_ore', 0, 0)).toBeNull();
  });

  it('une case déjà prélevée garde la quantité tirée au hasard', () => {
    const s = creative();
    s.changes.taken['3,4'] = 500;
    const p = s.placeResource('coal', 3, 4, 0.2)!;
    const left = applyChanges(emptyChunk(), s.changes).ore[0].amount;
    expect(left).toBe(p.amount - 500);
    expect(left).toBeGreaterThanOrEqual(CREATIVE_ORE_MIN);
  });

  it('détruit ce qui a été posé, vide une ressource d’origine, supprime une case d’eau d’origine', () => {
    const s = creative();
    s.placeResource('rock', 2, 2, 0.1);
    expect(s.destroyResource('object', 2, 2, 20)).toBe(true);
    expect(s.changes.placed).toHaveLength(0);
    const world: ChunkData = {
      ...emptyChunk(),
      ore: [{ id: 'coal', gx: 5, gz: 5, amount: 900 }],
      water: [{ gx: 6, gz: 6 }],
    };
    s.destroyResource('ore', 5, 5, 900);
    s.destroyResource('water', 6, 6, 0);
    const data = applyChanges(world, s.changes);
    expect(data.ore).toHaveLength(0);
    expect(data.water).toHaveLength(0);
    // Reposer de l'eau la fait revenir.
    s.placeResource('water', 6, 6);
    expect(withPlaced(world, s.changes).water).toEqual([{ gx: 6, gz: 6 }]);
  });

  it('les ressources posées sont enregistrées avec la partie', () => {
    const s = creative();
    s.placeResource('tree', 1, 2, 0.9);
    s.destroyResource('water', 7, 7, 0);
    const back = normalizeChanges(JSON.parse(JSON.stringify(s.changes)));
    expect(back.placed).toEqual(s.changes.placed);
    expect(back.dried).toEqual(['7,7']);
  });
});

describe('corbeille', () => {
  it('détruit une pile du sac ou la pile tenue', () => {
    const s = new GameState({ inventory: { wood: 30, stone: 10 } });
    const slots = s.bagSlots();
    const i = slots.findIndex((x) => x?.item === 'wood');
    expect(s.trashBagSlot(i)).toBe(30);
    expect(s.inventory.wood ?? 0).toBe(0);
    s.takeToHand('stone', 4);
    expect(s.trashHand()).toBe(4);
    expect(s.hand).toBeNull();
    expect(s.inventory.stone).toBe(6);
  });
});
