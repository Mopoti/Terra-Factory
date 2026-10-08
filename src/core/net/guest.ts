/**
 * Client d'invité : rejoint une partie par son code, envoie ses commandes à l'hôte et garde une copie du monde que
 * l'hôte lui diffuse. L'affichage du monde reçu (étape M2c) se branche sur `onWorld`.
 */
import type { Command, CommandOf, CommandSpecs, CommandType } from '../game/commands';
import type { Inventory } from '../game/inventory';
import type { PlayerChanges, WorldPart } from '../game/playerData';
import type { GameOptions } from '../save/saveIndex';
import type { WorldParams } from '../world/worldgen';
import {
  PROTOCOL_VERSION,
  type PlayerInfo,
  type RefusalReason,
  type ToGuest,
  type ToHost,
} from './protocol';
import type { Link, Network } from './transport';

export class RefusedError extends Error {
  constructor(readonly reason: RefusalReason | 'closed-link') {
    super(reason);
  }
}

export class GuestClient {
  /** Dernier état du monde reçu de l'hôte. */
  world: WorldPart;
  inventory: Inventory;
  changes: PlayerChanges;
  players: PlayerInfo[] = [];
  /** Nombre d'états du monde reçus (sert à savoir si le monde a changé). */
  snapshots = 0;
  hits: number[] = [];
  private seq = 0;
  private readonly pending = new Map<number, (result: unknown) => void>();
  private worldCb: ((w: WorldPart) => void) | null = null;
  private playersCb: ((p: PlayerInfo[]) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private closed = false;

  private constructor(
    private readonly link: Link,
    readonly you: PlayerInfo,
    readonly worldParams: WorldParams,
    readonly options: GameOptions,
    welcome: Extract<ToGuest, { t: 'welcome' }>,
  ) {
    this.world = welcome.snapshot;
    this.inventory = welcome.profile.inventory;
    this.changes = welcome.profile.changes;
    link.onMessage((raw) => this.receive(raw));
    link.onClose(() => this.lost());
  }

  /** Rejoint la partie `code` ; échoue avec `RefusedError` si l'hôte refuse (mot de passe, partie pleine…). */
  static async connect(
    network: Network,
    code: string,
    who: { name: string; password?: string },
  ): Promise<GuestClient> {
    const link = await network.join(code);
    return new Promise<GuestClient>((resolve, reject) => {
      link.onClose(() => reject(new RefusedError('closed-link')));
      link.onMessage((raw) => {
        const msg = raw as ToGuest;
        if (msg?.t === 'welcome') {
          resolve(new GuestClient(link, msg.you, msg.world, msg.options, msg));
        } else if (msg?.t === 'refused') reject(new RefusedError(msg.reason));
      });
      link.send({
        t: 'join',
        version: PROTOCOL_VERSION,
        name: who.name,
        password: who.password,
      } satisfies ToHost);
    });
  }

  private receive(raw: unknown): void {
    const msg = raw as ToGuest;
    switch (msg?.t) {
      case 'result':
        this.pending.get(msg.seq)?.(msg.result);
        this.pending.delete(msg.seq);
        break;
      case 'snap':
        this.world = msg.world;
        this.snapshots++;
        this.worldCb?.(msg.world);
        break;
      case 'players':
        this.players = msg.players;
        this.playersCb?.(msg.players);
        break;
      case 'me':
        this.inventory = msg.inventory;
        this.changes = msg.changes;
        break;
      case 'hit':
        this.hits.push(msg.amount);
        break;
      default:
        break;
    }
  }

  private lost(): void {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
    this.closeCb?.();
  }

  onWorld(cb: (w: WorldPart) => void): void {
    this.worldCb = cb;
  }
  onPlayers(cb: (p: PlayerInfo[]) => void): void {
    this.playersCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  /** Envoie une commande à l'hôte et attend son résultat (`null` si l'hôte a refusé ou si la liaison est coupée). */
  command<K extends CommandType>(cmd: CommandOf<K>): Promise<CommandSpecs[K]['result'] | null> {
    if (this.closed) return Promise.resolve(null);
    const seq = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(seq, resolve as (r: unknown) => void);
      this.link.send({ t: 'cmd', seq, cmd: cmd as Command } satisfies ToHost);
    });
  }

  /** Position du joueur (à envoyer une dizaine de fois par seconde). */
  sendPosition(p: { x: number; y: number; z: number; yaw: number }): void {
    if (!this.closed) this.link.send({ t: 'pos', ...p } satisfies ToHost);
  }

  leave(): void {
    if (!this.closed) this.link.send({ t: 'leave' } satisfies ToHost);
    this.link.close();
  }
}
