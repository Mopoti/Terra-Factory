/**
 * Session d'hôte : le joueur qui héberge fait tourner le monde ; chaque invité envoie ses commandes, l'hôte les
 * applique sur l'état de CE joueur (même monde, fiche individuelle) avec son propre terrain, puis répond. Il diffuse
 * régulièrement l'état du monde et la position des joueurs.
 */
import type { Threat } from '../game/threat';
import type { Factory } from '../factory/factory';
import { CommandBus, type Command, type CommandContext, type CommandType } from '../game/commands';
import type { Inventory } from '../game/inventory';
import { perPlayerKeys, splitChanges, type PlayerChanges } from '../game/playerData';
import type { SimEvent, SimPlayer } from '../game/simulation';
import { GameState } from '../game/state';
import { MAX_PLAYERS, type GameOptions, type SavedPlayer } from '../save/saveIndex';
import type { WorldParams } from '../world/worldgen';
import { LOADOUT_KEYS, REMOTE_CALLS } from './worldSync';
import {
  PROTOCOL_VERSION,
  type PlayerInfo,
  type RefusalReason,
  type ToGuest,
  type ToHost,
} from './protocol';
import type { HostEndpoint, Link, Network } from './transport';

export const HOST_ID = 'player';
/** Armes (mêmes valeurs que chez le joueur de l'hôte). */
const GUN_RANGE_M = 40;
const GUN_DAMAGE = 10;
const MELEE_RANGE_M = 2.6;
const MELEE_DAMAGE = 12;

export interface HostOptions {
  state: GameState;
  factory: Factory;
  blockedFor: CommandContext['blockedFor'];
  /** Ennemis du monde : sans eux, les tirs et coups des invités sont ignorés. */
  threat?: Threat;
  world: WorldParams;
  options: GameOptions;
  hostName: string;
  /** Partie privée : l'hôte accepte ou refuse chaque arrivant. Sans réponse, tout le monde est refusé. */
  approve?: (name: string) => boolean | Promise<boolean>;
  /** Secondes entre deux envois de l'état du monde / des positions. */
  snapshotEveryS?: number;
  playersEveryS?: number;
  /** Fiches de joueurs retrouvées dans la sauvegarde (par nom). */
  players?: Record<string, SavedPlayer>;
  /** Secondes entre deux envois de la fiche de chaque invité (sac, fabrications). */
  meEveryS?: number;
}

interface Remote {
  info: PlayerInfo;
  link: Link;
  state: GameState;
  bus: CommandBus;
  /** Dernière valeur envoyée de chaque champ du monde (JSON) : on n'envoie que les différences. */
  sent: Map<string, string>;
}

interface Profile {
  id: string;
  inventory: Inventory;
  changes: PlayerChanges;
}

const COMMAND_TYPES: ReadonlySet<string> = new Set<CommandType>([
  'placeMachine',
  'removeMachine',
  'setRecipe',
  'loadIngredient',
  'repairReactor',
  'activateBeacon',
  'sell',
  'buy',
  'research',
  'study',
  'queueCraft',
  'cancelCraft',
]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export class HostSession {
  readonly remotes = new Map<string, Remote>();
  /** Fiches des joueurs déjà venus (par nom) : un joueur qui revient retrouve son sac et son tutoriel. */
  readonly profiles = new Map<string, Profile>();
  private endpoint: HostEndpoint | null = null;
  private nextId = 2;
  private tick = 0;
  private snapClock = 0;
  private playersClock = 0;
  private meClock = 0;
  private hostInfo: PlayerInfo;
  private changeCb: (() => void) | null = null;

  constructor(private readonly opts: HostOptions) {
    this.hostInfo = { id: HOST_ID, name: opts.hostName, x: 0, y: 0, z: 0, yaw: 0 };
    for (const [name, p] of Object.entries(opts.players ?? {})) {
      this.profiles.set(name, {
        id: `p${this.nextId++}`,
        inventory: p.inventory,
        changes: p.changes as PlayerChanges,
      });
    }
  }

  /** Fiches de tous les joueurs venus (sac à jour pour ceux qui sont là), à ranger dans la sauvegarde. */
  exportProfiles(): Record<string, SavedPlayer> {
    const out: Record<string, SavedPlayer> = {};
    for (const [name, p] of this.profiles) {
      const live = [...this.remotes.values()].find((r) => r.info.id === p.id);
      out[name] = {
        inventory: structuredClone(live ? live.state.inventory : p.inventory),
        changes: structuredClone(p.changes) as Record<string, unknown>,
      };
    }
    return out;
  }

  /** Ouvre la partie aux invités et renvoie le code d'invitation. */
  async open(network: Network, code?: string): Promise<string> {
    this.endpoint = await network.host(code);
    this.endpoint.onConnection((link) => this.accept(link));
    return this.endpoint.code;
  }

  close(): void {
    this.endpoint?.close();
    for (const r of this.remotes.values()) r.link.close();
    this.remotes.clear();
  }

  /** Appelé quand un joueur arrive ou part. */
  onPlayersChange(cb: () => void): void {
    this.changeCb = cb;
  }

  get playerCount(): number {
    return this.remotes.size + 1;
  }

  /** Tous les joueurs (l'hôte d'abord) avec leur position. */
  players(): PlayerInfo[] {
    return [this.hostInfo, ...[...this.remotes.values()].map((r) => r.info)];
  }

  /** Positions pour la simulation du monde. */
  simPlayers(host: { x: number; z: number }): SimPlayer[] {
    this.hostInfo.x = host.x;
    this.hostInfo.z = host.z;
    return this.players().map((p) => ({ id: p.id, x: p.x, z: p.z }));
  }

  /** Transmet aux invités ce qui les concerne parmi les événements de la simulation (les coups reçus). */
  routeEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type !== 'playerHit') continue;
      this.remotes.get(e.player)?.link.send({ t: 'hit', amount: e.amount } satisfies ToGuest);
    }
  }

  /** À appeler à chaque image (ou à chaque pas) : diffuse l'état du monde et les positions. */
  advance(dt: number, host: { x: number; y: number; z: number; yaw: number }): void {
    Object.assign(this.hostInfo, host);
    if (this.remotes.size === 0) return;
    // Les fabrications à la main des invités avancent chez l'hôte ; leur fiche leur est renvoyée une fois par seconde.
    for (const r of this.remotes.values()) r.state.tickCraft(dt);
    this.meClock += dt;
    if (this.meClock >= (this.opts.meEveryS ?? 1)) {
      this.meClock = 0;
      for (const r of this.remotes.values()) this.sendMe(r);
    }
    this.snapClock += dt;
    this.playersClock += dt;
    if (this.playersClock >= (this.opts.playersEveryS ?? 0.1)) {
      this.playersClock = 0;
      this.broadcast({ t: 'players', players: this.players() });
    }
    if (this.snapClock >= (this.opts.snapshotEveryS ?? 0.5)) {
      this.snapClock = 0;
      this.tick++;
      const world = this.worldSnapshot() as unknown as Record<string, unknown>;
      const json = new Map(Object.entries(world).map(([k, v]) => [k, JSON.stringify(v)]));
      for (const r of this.remotes.values()) {
        const part: Record<string, unknown> = {};
        for (const [k, j] of json) {
          if (r.sent.get(k) === j) continue;
          r.sent.set(k, j);
          part[k] = world[k];
        }
        if (Object.keys(part).length > 0) {
          r.link.send({ t: 'snap', tick: this.tick, world: part } as ToGuest);
        }
      }
    }
  }

  private shareKeys() {
    return perPlayerKeys(this.opts.options.multiplayer.share);
  }

  private worldSnapshot() {
    return splitChanges(this.opts.state.changes, this.shareKeys()).world;
  }

  private broadcast(msg: ToGuest): void {
    for (const r of this.remotes.values()) r.link.send(msg);
  }

  private refuse(link: Link, reason: RefusalReason): void {
    link.send({ t: 'refused', reason } satisfies ToGuest);
    link.close();
  }

  private accept(link: Link): void {
    let player: Remote | null = null;
    let joining = false;
    link.onMessage((raw) => {
      if (!isObject(raw) || typeof raw.t !== 'string') return;
      const msg = raw as unknown as ToHost;
      if (msg.t === 'join') {
        if (player || joining) return;
        joining = true;
        void this.join(link, msg).then((p) => {
          player = p;
          joining = false;
        });
        return;
      }
      if (!player) return; // rien n'est accepté avant l'arrivée
      if (msg.t === 'cmd') this.command(player, msg.seq, msg.cmd);
      else if (msg.t === 'call') this.call(player, msg.method, msg.args);
      else if (msg.t === 'fire') this.fire(player, msg.origin, msg.dir);
      else if (msg.t === 'melee') this.melee(player);
      else if (msg.t === 'loadout') this.loadout(player, msg.loadout);
      else if (msg.t === 'pos') {
        const i = player.info;
        for (const k of ['x', 'y', 'z', 'yaw'] as const) {
          const v = msg[k];
          if (typeof v === 'number' && Number.isFinite(v)) i[k] = v;
        }
      } else if (msg.t === 'leave') link.close();
    });
    link.onClose(() => {
      if (player && this.remotes.get(player.info.id) === player) {
        const profile = this.profiles.get(player.info.name);
        if (profile) profile.inventory = structuredClone(player.state.inventory);
        this.remotes.delete(player.info.id);
        this.broadcast({ t: 'players', players: this.players() });
        this.changeCb?.();
      }
    });
  }

  private async join(link: Link, msg: Extract<ToHost, { t: 'join' }>): Promise<Remote | null> {
    const mp = this.opts.options.multiplayer;
    const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 24) : '';
    if (!name) return (this.refuse(link, 'bad-request'), null);
    if (msg.version !== PROTOCOL_VERSION) return (this.refuse(link, 'version'), null);
    if (!mp.enabled) return (this.refuse(link, 'closed'), null);
    if (this.playerCount >= MAX_PLAYERS) return (this.refuse(link, 'full'), null);
    if (mp.visibility === 'public') {
      if (mp.password && msg.password !== mp.password) return (this.refuse(link, 'password'), null);
    } else {
      const ok = this.opts.approve ? await this.opts.approve(name) : false;
      if (!ok) return (this.refuse(link, 'denied'), null);
    }
    if (this.playerCount >= MAX_PLAYERS) return (this.refuse(link, 'full'), null);
    // Un joueur qui revient (même nom) retrouve sa fiche ; sinon une fiche neuve.
    let profile = this.profiles.get(name);
    if (!profile) {
      profile = { id: `p${this.nextId++}`, inventory: {}, changes: {} };
      this.profiles.set(name, profile);
    }
    if (this.remotes.has(profile.id)) return (this.refuse(link, 'denied'), null);
    const state = GameState.forPlayer(this.opts.state, profile, mp.share);
    const bus = new CommandBus({
      state,
      factory: this.opts.factory,
      blockedFor: this.opts.blockedFor,
    });
    const info: PlayerInfo = { id: profile.id, name, x: 0, y: 0, z: 0, yaw: 0 };
    const snapshot = this.worldSnapshot();
    const sent = new Map(
      Object.entries(snapshot).map(([k, v]) => [k, JSON.stringify(v)] as [string, string]),
    );
    const remote: Remote = { info, link, state, bus, sent };
    this.remotes.set(info.id, remote);
    link.send({
      t: 'welcome',
      you: info,
      world: this.opts.world,
      // Le mot de passe de l'hôte n'est pas communiqué aux invités.
      options: {
        ...this.opts.options,
        multiplayer: { ...this.opts.options.multiplayer, password: '' },
      },
      snapshot,
      profile: { inventory: state.inventory, changes: profile.changes },
    } satisfies ToGuest);
    this.broadcast({ t: 'players', players: this.players() });
    this.changeCb?.();
    return remote;
  }

  private command(player: Remote, seq: number, cmd: Command): void {
    let result: unknown = null;
    if (isObject(cmd) && typeof cmd.type === 'string' && COMMAND_TYPES.has(cmd.type)) {
      try {
        result = player.bus.dispatch(cmd as never);
      } catch {
        result = null; // une commande mal formée ne doit jamais faire tomber l'hôte
      }
    }
    player.link.send({ t: 'result', seq, result: result ?? null } satisfies ToGuest);
    // Le sac d'un invité change à chaque action : on lui renvoie sa fiche avec la réponse.
    this.sendMe(player);
  }

  /** Tir d'un invité : le rayon part d'au plus 5 m de sa position connue ; portée et dégâts sont ceux de l'hôte. */
  private fire(player: Remote, origin: unknown, dir: unknown): void {
    const threat = this.opts.threat;
    const vec = (v: unknown): { x: number; y: number; z: number } | null =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? { x: v[0], y: v[1], z: v[2] }
        : null;
    const o = vec(origin);
    const d = vec(dir);
    if (!threat || !o || !d) return;
    if (Math.hypot(o.x - player.info.x, o.z - player.info.z) > 5) return;
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 0.5 || len > 1.5) return;
    threat.shoot(o, d, GUN_RANGE_M, GUN_DAMAGE);
  }

  private melee(player: Remote): void {
    this.opts.threat?.hit(player.info.x, player.info.z, MELEE_RANGE_M, MELEE_DAMAGE);
  }

  private sendMe(player: Remote): void {
    const profile = this.profiles.get(player.info.name);
    if (!profile) return;
    player.link.send({
      t: 'me',
      inventory: player.state.inventory,
      changes: profile.changes,
      craft: player.state.craftQueue,
    } satisfies ToGuest);
  }

  /** Barre d'objets, outils, équipement, munitions, tutoriel : l'invité décide, l'hôte garde la copie (limites du sac…). */
  private loadout(player: Remote, loadout: Record<string, unknown>): void {
    if (!isObject(loadout)) return;
    const own = player.state.changes as unknown as Record<string, unknown>;
    for (const k of LOADOUT_KEYS) {
      if (k in loadout && loadout[k] !== undefined) own[k] = loadout[k];
    }
  }

  /** Rejoue une action du monde d'un invité (liste blanche) ; machines et véhicules arrivent par identifiant. */
  private call(player: Remote, method: string, args: unknown[]): void {
    if (!(REMOTE_CALLS as readonly string[]).includes(method) || !Array.isArray(args)) return;
    const decode = (a: unknown): unknown => {
      if (!isObject(a)) return a;
      if (typeof a.__m === 'number') {
        return this.opts.factory.machines.find((m) => m.id === a.__m) ?? undefined;
      }
      if (typeof a.__v === 'number') {
        return this.opts.state.changes.vehicles.find((v) => v.id === a.__v) ?? undefined;
      }
      return a;
    };
    const decoded = args.map(decode);
    if (decoded.some((a, i) => a === undefined && isObject(args[i]))) return; // machine ou véhicule disparu
    try {
      const state = player.state as unknown as Record<string, (...a: unknown[]) => unknown>;
      state[method](...decoded);
    } catch {
      // Une action mal formée ne doit jamais faire tomber l'hôte.
    }
    this.sendMe(player);
  }
}
