import { describe, expect, it } from 'vitest';
import { Factory, emptyMachine, type FactoryWorld } from '../factory/factory';
import { CommandBus, type Command } from './commands';
import { GameState } from './state';

const flat: FactoryWorld = { oreAt: () => null, mineOre: () => 0 };

const make = (inventory: Record<string, number>, blockedCells = new Set<string>()) => {
  const state = new GameState({ inventory });
  const factory = new Factory(state.changes.machines, flat);
  const bus = new CommandBus({
    state,
    factory,
    blockedFor: () => (c) => blockedCells.has(`${c.gx},${c.gz}`),
  });
  return { state, factory, bus };
};

describe('commandes (bus)', () => {
  it('poser puis démolir une machine : mêmes résultats qu’en appelant l’état directement', () => {
    const { state, bus, factory } = make({ machine_furnace: 1 });
    expect(
      bus.dispatch<'placeMachine'>({
        type: 'placeMachine',
        machine: 'furnace',
        gx: 4,
        gz: 4,
        rot: 0,
        lift: 0,
        tier: 1,
      }),
    ).toBe('ok');
    expect(factory.machines).toHaveLength(1);
    expect(state.inventory.machine_furnace ?? 0).toBe(0);
    expect(
      bus.dispatch<'placeMachine'>({
        type: 'placeMachine',
        machine: 'furnace',
        gx: 4,
        gz: 4,
        rot: 0,
        lift: 0,
        tier: 1,
      }),
    ).toBe('missing');
    const id = factory.machines[0].id;
    expect(bus.dispatch<'removeMachine'>({ type: 'removeMachine', id, at: { x: 0, z: 0 } })).toBe(
      true,
    );
    expect(state.inventory.machine_furnace).toBe(1);
  });

  it('le terrain est celui de l’hôte : une case bloquée refuse la pose', () => {
    const { bus } = make({ machine_furnace: 1 }, new Set(['4,4']));
    expect(
      bus.dispatch<'placeMachine'>({
        type: 'placeMachine',
        machine: 'furnace',
        gx: 4,
        gz: 4,
        rot: 0,
        lift: 0,
        tier: 1,
      }),
    ).toBe('blocked');
  });

  it('une commande est un objet simple : elle survit à JSON (envoi par le réseau)', () => {
    const { state, bus } = make({ wood: 20, stone: 20 });
    const sent = JSON.stringify({
      type: 'queueCraft',
      item: 'tool_stone',
      times: 1,
    } satisfies Command);
    const cmd = JSON.parse(sent) as Command;
    expect(bus.dispatch(cmd as never)).toBe('ok');
    expect(state.craftQueue).toHaveLength(1);
  });

  it('un identifiant de machine inconnu est refusé sans erreur', () => {
    const { bus } = make({});
    expect(bus.dispatch<'setRecipe'>({ type: 'setRecipe', id: 999, item: null })).toBe(false);
    expect(
      bus.dispatch<'loadIngredient'>({
        type: 'loadIngredient',
        id: 999,
        item: 'iron_ingot',
        count: 3,
      }),
    ).toBe(0);
    expect(bus.dispatch<'repairReactor'>({ type: 'repairReactor', id: 999 })).toBe('notBroken');
    expect(bus.dispatch<'activateBeacon'>({ type: 'activateBeacon', id: 999 })).toBe('unknown');
  });

  it('recette et ingrédients d’un assembleur par commande', () => {
    const { state, bus, factory } = make({ iron_ingot: 10 });
    state.changes.unlocked.push('electricity', 'logistics', 'automation');
    const asm = emptyMachine(5, 'assembler', 10, 10, 0);
    factory.add(asm);
    expect(bus.dispatch<'setRecipe'>({ type: 'setRecipe', id: 5, item: 'machine_conveyor' })).toBe(
      true,
    );
    expect(
      bus.dispatch<'loadIngredient'>({
        type: 'loadIngredient',
        id: 5,
        item: 'iron_ingot',
        count: 5,
      }),
    ).toBe(5);
    expect(asm.slots[0]).toEqual({ item: 'iron_ingot', count: 5 });
  });
});
