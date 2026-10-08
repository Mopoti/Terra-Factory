import { describe, expect, it } from 'vitest';
import { Factory, type FactoryWorld } from '../factory/factory';
import { GameState } from '../game/state';
import { DEFAULT_GAME_OPTIONS, normalizeMultiplayer, type GameOptions } from '../save/saveIndex';
import { defaultWorldParams } from '../world/worldgen';
import { GuestClient } from './guest';
import { HostSession } from './host';
import { MemoryNetwork } from './transport';
import { applyWorldPart, GuestBus, GuestSync } from './worldSync';

const flat: FactoryWorld = { oreAt: () => null, mineOre: () => 0 };
const flush = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

async function setup() {
  const state = new GameState({ inventory: { machine_furnace: 3 } });
  const factory = new Factory(state.changes.machines, flat);
  const options: GameOptions = {
    ...DEFAULT_GAME_OPTIONS,
    multiplayer: normalizeMultiplayer({
      enabled: true,
      visibility: 'public',
      share: { research: true, credits: true, inventory: false },
    }),
  };
  const host = new HostSession({
    state,
    factory,
    blockedFor: () => () => false,
    world: defaultWorldParams('seed'),
    options,
    hostName: 'Hôte',
  });
  const net = new MemoryNetwork();
  const code = await host.open(net, 'ABC234');
  const client = await GuestClient.connect(net, code, { name: 'Ana' });
  const local = new GameState({ inventory: client.inventory, changes: client.changes });
  const localFactory = new Factory(local.changes.machines, flat);
  const sync = new GuestSync(client, local, localFactory);
  return { host, state, factory, client, local, localFactory, sync };
}

describe('applyWorldPart', () => {
  it('remplace sur place : les références gardées ailleurs restent valides', () => {
    const changes = { machines: [{ id: 1 }], pollution: { a: 1 }, time: 5 };
    const machines = changes.machines;
    const pollution = changes.pollution;
    const changed = applyWorldPart(changes, {
      machines: [{ id: 2 }, { id: 3 }],
      pollution: { b: 2 },
      time: 9,
    } as never);
    expect(changed.sort()).toEqual(['machines', 'pollution', 'time']);
    expect(changes.machines).toBe(machines);
    expect(machines.map((m) => m.id)).toEqual([2, 3]);
    expect(changes.pollution).toBe(pollution);
    expect(pollution).toEqual({ b: 2 });
    expect(changes.time).toBe(9);
  });

  it('ne signale rien quand rien ne change', () => {
    const changes = { time: 5, drops: [] };
    expect(applyWorldPart(changes, { time: 5, drops: [] } as never)).toEqual([]);
  });
});

describe('invité : copie locale du monde', () => {
  it('une machine posée par l’hôte apparaît dans la copie de l’invité (usine ré-indexée)', async () => {
    const { host, state, factory, localFactory, sync } = await setup();
    const gx = 4;
    state.placeMachine(factory, 'furnace', gx, 4, 0, () => false, 0, 1);
    host.advance(0.6, { x: 0, y: 0, z: 0, yaw: 0 });
    await flush();
    expect(sync.synced).toBe(true);
    expect(localFactory.machines).toHaveLength(1);
    expect(localFactory.machines[0].type).toBe('furnace');
  });

  it('commande de l’invité : jouée tout de suite chez lui, rejouée par l’hôte, sac corrigé par l’hôte', async () => {
    const { host, factory, local, localFactory, client, sync } = await setup();
    local.inventory = { machine_furnace: 1 };
    host.remotes.get(client.you.id)!.state.inventory = { machine_furnace: 1 };
    const bus = new GuestBus(
      { state: local, factory: localFactory, blockedFor: () => () => false },
      sync,
    );
    const r = bus.dispatch<'placeMachine'>({
      type: 'placeMachine',
      machine: 'furnace',
      gx: 6,
      gz: 6,
      rot: 0,
      lift: 0,
      tier: 1,
    });
    expect(r).toBe('ok');
    expect(localFactory.machines).toHaveLength(1);
    await flush();
    expect(factory.machines).toHaveLength(1);
    expect(local.inventory.machine_furnace ?? 0).toBe(0);
  });

  it('divergence : l’hôte refuse ce que l’invité avait joué', async () => {
    const { local, localFactory, sync } = await setup();
    local.inventory = { machine_furnace: 1 }; // l'hôte, lui, ne lui a rien donné
    const seen: string[] = [];
    sync.onDiverged((c) => seen.push(c));
    const bus = new GuestBus(
      { state: local, factory: localFactory, blockedFor: () => () => false },
      sync,
    );
    bus.dispatch<'placeMachine'>({
      type: 'placeMachine',
      machine: 'furnace',
      gx: 2,
      gz: 2,
      rot: 0,
      lift: 0,
      tier: 1,
    });
    await flush();
    expect(seen).toEqual(['placeMachine']);
  });

  it('actions du monde (jeter, ramasser) rejouées chez l’hôte, une seule fois même si elles s’appellent entre elles', async () => {
    const { host, state, local, client } = await setup();
    local.inventory = { wood: 5 };
    host.remotes.get(client.you.id)!.state.inventory = { wood: 5 };
    local.drop('wood', 3, 1, 1);
    await flush();
    expect(state.changes.drops).toHaveLength(1);
    expect(state.changes.drops[0].count).toBe(3);
  });

  it('une méthode hors liste blanche est ignorée', async () => {
    const { state, client } = await setup();
    client.call('creative', [true]);
    client.call('constructor', []);
    await flush();
    expect(state.creative).toBe(false);
  });

  it('la barre d’objets de l’invité est envoyée à l’hôte', async () => {
    const { host, local, client, sync } = await setup();
    local.changes.hotbar[0] = 'wood';
    sync.syncLoadout();
    await flush();
    const own = host.remotes.get(client.you.id)!.state.changes;
    expect(own.hotbar[0]).toBe('wood');
  });

  it('l’hôte fait avancer les fabrications de l’invité et lui renvoie sa fiche', async () => {
    const { host, local, client, sync } = await setup();
    const remote = host.remotes.get(client.you.id)!;
    remote.state.creative = true;
    remote.state.inventory = { wood: 20, stone: 20 };
    local.inventory = { wood: 10 };
    expect(sync.synced).toBe(false);
    const result = await client.command<'queueCraft'>({
      type: 'queueCraft',
      item: 'tool_stone',
      times: 1,
    });
    expect(['ok', 'locked', 'resources']).toContain(result);
    host.advance(1.1, { x: 0, y: 0, z: 0, yaw: 0 });
    await flush();
    expect(local.craftQueue).toEqual(remote.state.craftQueue);
  });

  it('le mot de passe de l’hôte n’est pas envoyé aux invités', async () => {
    const { client } = await setup();
    expect(client.options.multiplayer.password).toBe('');
  });
});
