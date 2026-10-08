import { describe, expect, it } from 'vitest';
import { Factory, type FactoryWorld } from '../factory/factory';
import { GameState } from '../game/state';
import { DEFAULT_GAME_OPTIONS, normalizeMultiplayer, type GameOptions } from '../save/saveIndex';
import { defaultWorldParams } from '../world/worldgen';
import { GuestClient, RefusedError } from './guest';
import { HostSession } from './host';
import { MemoryNetwork, newInviteCode, parseInviteCode } from './transport';

const flat: FactoryWorld = { oreAt: () => null, mineOre: () => 0 };
const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

interface Setup {
  net: MemoryNetwork;
  state: GameState;
  factory: Factory;
  host: HostSession;
  code: string;
}

async function setup(
  mp: Partial<GameOptions['multiplayer']> = {},
  approve?: (name: string) => boolean,
): Promise<Setup> {
  const state = new GameState({ inventory: { machine_furnace: 3 } });
  const factory = new Factory(state.changes.machines, flat);
  const options: GameOptions = {
    ...DEFAULT_GAME_OPTIONS,
    multiplayer: normalizeMultiplayer({ enabled: true, visibility: 'public', ...mp }),
  };
  const host = new HostSession({
    state,
    factory,
    blockedFor: () => () => false,
    world: defaultWorldParams('seed'),
    options,
    hostName: 'Hôte',
    approve,
  });
  const net = new MemoryNetwork();
  const code = await host.open(net, 'ABC234');
  return { net, state, factory, host, code };
}

describe('code d’invitation', () => {
  it('6 caractères ; on accepte le code seul ou dans un lien, en minuscules', () => {
    expect(newInviteCode(() => 0.5)).toHaveLength(6);
    expect(parseInviteCode(' abc234 ')).toBe('ABC234');
    expect(parseInviteCode('https://exemple.fr/?join=abc234')).toBe('ABC234');
    expect(parseInviteCode('ABC0O1')).toBeNull();
    expect(parseInviteCode('xx')).toBeNull();
  });
});

describe('rejoindre une partie', () => {
  it('une partie publique sans mot de passe accueille l’invité', async () => {
    const { net, host, code } = await setup();
    const guest = await GuestClient.connect(net, code, { name: 'Ana' });
    await flush();
    expect(guest.you.name).toBe('Ana');
    expect(host.playerCount).toBe(2);
    expect(guest.players.map((p) => p.name)).toEqual(['Hôte', 'Ana']);
    expect(guest.worldParams.seed).toBe('seed');
  });

  it('mot de passe : refusé s’il est faux, accepté s’il est bon', async () => {
    const { net, code } = await setup({ password: 'secret' });
    await expect(
      GuestClient.connect(net, code, { name: 'Ana', password: 'x' }),
    ).rejects.toMatchObject({
      reason: 'password',
    });
    const ok = await GuestClient.connect(net, code, { name: 'Ana', password: 'secret' });
    expect(ok.you.name).toBe('Ana');
  });

  it('partie privée : l’hôte doit accepter chaque arrivant', async () => {
    const asked: string[] = [];
    const { net, code } = await setup({ visibility: 'private' }, (name) => {
      asked.push(name);
      return name === 'Ami';
    });
    await expect(GuestClient.connect(net, code, { name: 'Inconnu' })).rejects.toBeInstanceOf(
      RefusedError,
    );
    const ami = await GuestClient.connect(net, code, { name: 'Ami' });
    expect(ami.you.name).toBe('Ami');
    expect(asked).toEqual(['Inconnu', 'Ami']);
  });

  it('une partie sans multijoueur, ou avec 5 joueurs, refuse', async () => {
    const closed = await setup({ enabled: false });
    await expect(GuestClient.connect(closed.net, closed.code, { name: 'A' })).rejects.toMatchObject(
      {
        reason: 'closed',
      },
    );
    const full = await setup();
    for (const n of ['B', 'C', 'D', 'E'])
      await GuestClient.connect(full.net, full.code, { name: n });
    expect(full.host.playerCount).toBe(5);
    await expect(GuestClient.connect(full.net, full.code, { name: 'F' })).rejects.toMatchObject({
      reason: 'full',
    });
  });

  it('un mauvais code ne mène nulle part', async () => {
    const { net } = await setup();
    await expect(GuestClient.connect(net, 'ZZZZZZ', { name: 'A' })).rejects.toThrow();
  });
});

describe('jouer ensemble', () => {
  it('l’invité pose une machine : elle consomme SON sac et apparaît chez l’hôte puis dans sa copie du monde', async () => {
    const { net, host, factory, state, code } = await setup({
      share: { research: true, credits: true, inventory: false },
    });
    const guest = await GuestClient.connect(net, code, { name: 'Ana' });
    // On donne un four à l'invité (sa fiche) : celui de l'hôte reste intact.
    host.remotes.get(guest.you.id)!.state.inventory = { machine_furnace: 1 };
    const r = await guest.command<'placeMachine'>({
      type: 'placeMachine',
      machine: 'furnace',
      gx: 6,
      gz: 6,
      rot: 0,
      lift: 0,
      tier: 1,
    });
    expect(r).toBe('ok');
    expect(factory.machines).toHaveLength(1);
    expect(state.inventory.machine_furnace).toBe(3);
    expect(host.remotes.get(guest.you.id)!.state.inventory.machine_furnace ?? 0).toBe(0);
    expect(guest.inventory.machine_furnace ?? 0).toBe(0);
    host.advance(1, { x: 0, y: 0, z: 0, yaw: 0 });
    await flush();
    expect(guest.world.machines).toHaveLength(1);
    expect(guest.snapshots).toBeGreaterThan(0);
  });

  it('sac commun : l’invité dépense le sac de l’hôte', async () => {
    const { net, state, factory, code } = await setup({
      share: { research: true, credits: true, inventory: true },
    });
    const guest = await GuestClient.connect(net, code, { name: 'Ana' });
    const r = await guest.command<'placeMachine'>({
      type: 'placeMachine',
      machine: 'furnace',
      gx: 6,
      gz: 6,
      rot: 0,
      lift: 0,
      tier: 1,
    });
    expect(r).toBe('ok');
    expect(state.inventory.machine_furnace).toBe(2);
    expect(factory.machines).toHaveLength(1);
  });

  it('technologies communes : une recherche de l’invité profite à l’hôte ; individuelle sinon', async () => {
    const shared = await setup();
    const a = await GuestClient.connect(shared.net, shared.code, { name: 'Ana' });
    shared.state.inventory = { iron_ingot: 50, copper_ingot: 50 };
    expect(await a.command<'research'>({ type: 'research', tech: 'electricity' })).toBe('ok');
    expect(shared.state.changes.unlocked).toContain('electricity');
    const own = await setup({ share: { research: false, credits: true, inventory: true } });
    const b = await GuestClient.connect(own.net, own.code, { name: 'Bob' });
    own.state.inventory = { iron_ingot: 50, copper_ingot: 50 };
    expect(await b.command<'research'>({ type: 'research', tech: 'electricity' })).toBe('ok');
    expect(own.state.changes.unlocked).not.toContain('electricity');
  });

  it('une commande inconnue ou mal formée ne fait pas tomber l’hôte', async () => {
    const { net, host, code } = await setup();
    const guest = await GuestClient.connect(net, code, { name: 'Ana' });
    const bad = await guest.command({ type: 'detruireTout' } as never);
    expect(bad).toBeNull();
    const broken = await guest.command({ type: 'placeMachine' } as never);
    expect(broken === null || typeof broken === 'string').toBe(true);
    expect(host.playerCount).toBe(2);
  });

  it('les positions des joueurs sont diffusées ; les coups reçus ne vont qu’au bon joueur', async () => {
    const { net, host, code } = await setup();
    const a = await GuestClient.connect(net, code, { name: 'Ana' });
    const b = await GuestClient.connect(net, code, { name: 'Bob' });
    a.sendPosition({ x: 4, y: 0, z: 5, yaw: 1 });
    await flush();
    host.advance(0.2, { x: 1, y: 0, z: 2, yaw: 0 });
    await flush();
    expect(b.players.find((p) => p.name === 'Ana')).toMatchObject({ x: 4, z: 5 });
    expect(host.simPlayers({ x: 1, z: 2 }).map((p) => p.id)).toEqual([
      'player',
      a.you.id,
      b.you.id,
    ]);
    host.routeEvents([{ type: 'playerHit', player: a.you.id, amount: 10 }]);
    await flush();
    expect(a.hits).toEqual([10]);
    expect(b.hits).toEqual([]);
  });

  it('un joueur qui part est retiré ; s’il revient il retrouve sa fiche', async () => {
    const { net, host, code } = await setup({
      share: { research: true, credits: true, inventory: false },
    });
    const first = await GuestClient.connect(net, code, { name: 'Ana' });
    const id = first.you.id;
    host.remotes.get(id)!.state.inventory = { wood: 7 };
    host.profiles.get('Ana')!.inventory = host.remotes.get(id)!.state.inventory;
    first.leave();
    await flush();
    expect(host.playerCount).toBe(1);
    const back = await GuestClient.connect(net, code, { name: 'Ana' });
    expect(back.you.id).toBe(id);
    expect(back.inventory.wood).toBe(7);
  });

  it('avant d’être accepté, un client ne peut rien envoyer', async () => {
    const { net, factory, code } = await setup();
    const link = await net.join(code);
    link.send({ t: 'cmd', seq: 1, cmd: { type: 'sell', item: 'wood', count: 1 } });
    link.send({ t: 'pos', x: 9, y: 0, z: 9, yaw: 0 });
    await flush();
    expect(factory.machines).toHaveLength(0);
  });
});
