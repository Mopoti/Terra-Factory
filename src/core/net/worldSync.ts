/**
 * Synchronisation côté invité : applique l'état du monde envoyé par l'hôte SUR PLACE (les tableaux et objets gardent
 * la même identité, car l'usine, la menace et l'affichage tiennent des références vers eux), et transmet à l'hôte les
 * actions qui changent le monde. Chez l'invité, l'action est jouée tout de suite (prédiction) ; l'hôte la rejoue avec son
 * terrain et son état fait foi : le prochain état reçu corrige l'écart éventuel.
 */
import type { Factory } from '../factory/factory';
import {
  CommandBus,
  type CommandContext,
  type CommandOf,
  type CommandSpecs,
  type CommandType,
} from '../game/commands';
import type { GameState } from '../game/state';
import type { CraftJob } from '../game/state';
import type { Inventory } from '../game/inventory';
import type { PlayerChanges, WorldPart } from '../game/playerData';
import type { GuestClient } from './guest';

/** Méthodes d'état que l'invité rejoue chez l'hôte (leurs arguments sont des données simples, machines/véhicules par identifiant). */
export const REMOTE_CALLS = [
  'harvest',
  'takeFromWorld',
  'drop',
  'pickUp',
  'toggleDoor',
  'removeKeys',
  'place',
  'placeMany',
  'recoverCorpse',
  'placeSpawn',
  'pickUpSpawn',
  'placeVehicle',
  'pickUpVehicle',
  'refuelVehicle',
  'loadMachine',
  'unloadMachine',
  'putInChest',
  'takeFromChest',
  'setFilterMode',
  'toggleFilterItem',
  'clearFilter',
] as const;
export type RemoteCall = (typeof REMOTE_CALLS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Remplace le contenu de `target` par celui de `source` sans changer l'identité de `target`. */
function replaceInPlace(target: unknown, source: unknown): boolean {
  if (Array.isArray(target) && Array.isArray(source)) {
    target.splice(0, target.length, ...source);
    return true;
  }
  if (isRecord(target) && isRecord(source)) {
    for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
    Object.assign(target, source);
    return true;
  }
  return false;
}

/** Applique l'état du monde de l'hôte aux changements locaux. Renvoie les clés dont la valeur a changé. */
export function applyWorldPart(
  changes: object,
  part: WorldPart,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const target = changes as Record<string, unknown>;
  const changed: string[] = [];
  for (const [key, value] of Object.entries(part)) {
    if (skip.has(key)) continue;
    if (JSON.stringify(target[key]) === JSON.stringify(value)) continue;
    if (!replaceInPlace(target[key], value)) target[key] = value;
    changed.push(key);
  }
  return changed;
}

/** Ce que l'invité décide seul et envoie à l'hôte (barre d'objets, outils, équipement, munitions, tutoriel). */
export const LOADOUT_KEYS = [
  'hotbar',
  'tools',
  'equipment',
  'ammo',
  'tutorialDone',
  'tutorialSkipped',
] as const;

export type Loadout = Partial<Pick<PlayerChanges, (typeof LOADOUT_KEYS)[number]>>;

/** Relie un `GuestClient` à l'état local d'un invité. */
export class GuestSync {
  private lastLoadout = '';
  private depth = 0;
  private snapped = false;
  /** Un objet tenu en main : on n'écrase pas le sac tant qu'il n'est pas reposé. */
  private pendingMe: { inventory: Inventory; changes: PlayerChanges; craft: CraftJob[] } | null =
    null;
  private offState: () => void;
  private worldCb: ((changed: string[]) => void) | null = null;
  private refusedCb: ((call: string) => void) | null = null;

  constructor(
    readonly client: GuestClient,
    readonly state: GameState,
    public factory: Factory | null = null,
  ) {
    client.onWorld((w) => this.applyWorld(w));
    client.onMe((me) => this.applyMe(me));
    this.offState = state.onChange((e) => {
      if (e.type === 'inventory' && this.pendingMe && !state.hand) this.flushMe();
    });
    this.wrapState();
  }

  /** L'usine est créée par la vue 3D (avec le terrain) : elle la confie ici. */
  attach(factory: Factory): void {
    this.factory = factory;
  }

  dispose(): void {
    this.offState();
  }

  /** Appelé quand l'état du monde reçu a changé quelque chose (clés modifiées). */
  onWorldChange(cb: (changed: string[]) => void): void {
    this.worldCb = cb;
  }

  /** Appelé quand l'hôte a refusé ou fait autrement une commande déjà jouée chez l'invité. */
  onDiverged(cb: (call: string) => void): void {
    this.refusedCb = cb;
  }

  /** Premier état reçu ? (sinon le monde affiché est celui de l'arrivée). */
  get synced(): boolean {
    return this.snapped;
  }

  private applyWorld(w: WorldPart): void {
    this.snapped = true;
    const changed = applyWorldPart(this.state.changes, w);
    if (changed.length === 0) return;
    if (changed.includes('machines')) this.factory?.reindex();
    this.state.relay({ type: 'factory' });
    if (changed.some((k) => k === 'pieces' || k === 'rotations'))
      this.state.relay({ type: 'build' });
    if (changed.includes('drops')) this.state.relay({ type: 'drops' });
    this.worldCb?.(changed);
  }

  private applyMe(me: { inventory: Inventory; changes: PlayerChanges; craft: CraftJob[] }): void {
    this.pendingMe = me;
    if (!this.state.hand) this.flushMe();
  }

  private flushMe(): void {
    const me = this.pendingMe;
    if (!me) return;
    this.pendingMe = null;
    const skip = new Set<string>(LOADOUT_KEYS);
    applyWorldPart(this.state.changes, me.changes as WorldPart, skip);
    this.state.inventory = me.inventory;
    this.state.craftQueue = me.craft;
    this.state.relay({ type: 'inventory' });
  }

  /** Envoie à l'hôte la barre d'objets, les outils, l'équipement… s'ils ont changé. */
  syncLoadout(): void {
    const c = this.state.changes as unknown as Record<string, unknown>;
    const loadout: Record<string, unknown> = {};
    for (const k of LOADOUT_KEYS) loadout[k] = c[k];
    const json = JSON.stringify(loadout);
    if (json === this.lastLoadout) return;
    this.lastLoadout = json;
    this.client.sendLoadout(loadout as Loadout);
  }

  private encode(arg: unknown): unknown {
    if (isRecord(arg)) {
      if (this.factory?.machines.includes(arg as never)) return { __m: arg.id };
      if (this.state.changes.vehicles.includes(arg as never)) return { __v: arg.id };
    }
    return arg;
  }

  /** Les actions du monde jouées sur l'état local sont aussi envoyées à l'hôte. */
  private wrapState(): void {
    const state = this.state as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const method of REMOTE_CALLS) {
      const original = state[method];
      if (typeof original !== 'function') continue;
      state[method] = (...args: unknown[]): unknown => {
        // Une méthode qui en appelle une autre (placeMany → place) n'est envoyée qu'une fois, au niveau le plus haut.
        const top = this.depth++ === 0;
        const sent = top ? args.map((a) => this.encode(a)) : null;
        try {
          return original.apply(this.state, args);
        } finally {
          this.depth--;
          if (sent) this.client.call(method, sent);
        }
      };
    }
  }

  /** Une commande du bus : jouée localement (prédiction) puis envoyée ; si l'hôte répond autrement, on le signale. */
  notifyDivergence(call: string): void {
    this.refusedCb?.(call);
  }
}

/** Bus de commandes de l'invité : la commande est jouée tout de suite chez lui, puis envoyée à l'hôte qui la rejoue. */
export class GuestBus extends CommandBus {
  constructor(
    ctx: CommandContext,
    private readonly sync: GuestSync,
  ) {
    super(ctx);
  }

  override dispatch<K extends CommandType>(cmd: CommandOf<K>): CommandSpecs[K]['result'] {
    const local = super.dispatch(cmd);
    void this.sync.client.command(cmd).then((remote) => {
      if (remote !== null && JSON.stringify(remote) !== JSON.stringify(local ?? null)) {
        this.sync.notifyDivergence(cmd.type);
      }
    });
    return local;
  }
}
