/**
 * Commandes : tout ce que fait un joueur et qui change le MONDE passe par ici, sous une forme simple et
 * sérialisable (des nombres, des textes, des identifiants de machine). En solo (ou pour l'hôte) le bus les applique
 * tout de suite ; en multijoueur (étape M2), un invité les enverra à l'hôte, qui les applique avec sa propre
 * simulation et son propre terrain, puis renvoie le résultat.
 */
import type { MachineType } from '../data/machines';
import { WAYPOINT_NAME_MAX, type Cell, type Factory, type Machine } from '../factory/factory';
import type { GameState } from './state';

/** Chaque commande : ses arguments et le type de son résultat. */
export interface CommandSpecs {
  placeMachine: {
    args: { machine: MachineType; gx: number; gz: number; rot: number; lift: number; tier: number };
    result: 'ok' | 'missing' | 'blocked';
  };
  removeMachine: { args: { id: number; at: { x: number; z: number } }; result: boolean };
  setRecipe: { args: { id: number; item: string | null }; result: boolean };
  loadIngredient: {
    args: { id: number; item: string; count: number; slot?: number };
    result: number;
  };
  repairReactor: { args: { id: number }; result: 'ok' | 'missing' | 'notBroken' };
  activateBeacon: {
    args: { id: number };
    result: 'ok' | 'done' | 'noPlasma' | 'noAntenna' | 'unknown';
  };
  setWaypoint: { args: { id: number; label: string; tint: string }; result: boolean };
  sell: { args: { item: string; count: number }; result: number };
  buy: { args: { item: string; count: number }; result: number };
  research: {
    args: { tech: string };
    result: 'ok' | 'done' | 'locked' | 'missing' | 'lab';
  };
  study: { args: { tech: string | null }; result: 'ok' | 'done' | 'locked' | 'notLab' };
  queueCraft: {
    args: { item: string; times: number };
    result: 'ok' | 'locked' | 'resources' | 'bag';
  };
  cancelCraft: { args: { index: number }; result: void };
}

export type CommandType = keyof CommandSpecs;
export type CommandOf<K extends CommandType> = { type: K } & CommandSpecs[K]['args'];
/** Toute commande possible (ce qu'un invité enverrait à l'hôte). */
export type Command = { [K in CommandType]: CommandOf<K> }[CommandType];

/** Ce que l'hôte sait du terrain : quelles cases sont bloquées pour une machine à ce niveau. */
export interface CommandContext {
  state: GameState;
  factory: Factory;
  blockedFor(machine: MachineType, level: number): (c: Cell) => boolean;
}

export class CommandBus {
  constructor(private readonly ctx: CommandContext) {}

  private machine(id: number): Machine | null {
    return this.ctx.factory.machines.find((m) => m.id === id) ?? null;
  }

  /** Applique une commande et renvoie son résultat (les identifiants inconnus sont refusés). */
  dispatch<K extends CommandType>(cmd: CommandOf<K>): CommandSpecs[K]['result'] {
    const { state, factory } = this.ctx;
    const c = cmd as Command;
    switch (c.type) {
      case 'placeMachine':
        return state.placeMachine(
          factory,
          c.machine,
          c.gx,
          c.gz,
          c.rot,
          this.ctx.blockedFor(c.machine, c.lift),
          c.lift,
          c.tier,
        ) as CommandSpecs[K]['result'];
      case 'removeMachine':
        return state.removeMachine(factory, c.id, c.at) as CommandSpecs[K]['result'];
      case 'setRecipe': {
        const m = this.machine(c.id);
        return (m ? state.setRecipe(m, c.item) : false) as CommandSpecs[K]['result'];
      }
      case 'loadIngredient': {
        const m = this.machine(c.id);
        return (
          m ? state.loadIngredient(m, c.item, c.count, c.slot) : 0
        ) as CommandSpecs[K]['result'];
      }
      case 'repairReactor': {
        const m = this.machine(c.id);
        return (m ? state.repairReactor(m) : 'notBroken') as CommandSpecs[K]['result'];
      }
      case 'activateBeacon': {
        const m = this.machine(c.id);
        return (m ? state.activateBeacon(factory, m) : 'unknown') as CommandSpecs[K]['result'];
      }
      case 'setWaypoint': {
        const m = this.machine(c.id);
        if (!m || m.type !== 'waypoint' || !/^#[0-9a-fA-F]{6}$/.test(String(c.tint)))
          return false as CommandSpecs[K]['result'];
        m.label = String(c.label).trim().slice(0, WAYPOINT_NAME_MAX) || undefined;
        m.tint = c.tint;
        state.relay({ type: 'factory' });
        return true as CommandSpecs[K]['result'];
      }
      case 'sell':
        return state.sellItem(c.item, c.count) as CommandSpecs[K]['result'];
      case 'buy':
        return state.buyItem(c.item, c.count) as CommandSpecs[K]['result'];
      case 'research':
        return state.research(c.tech) as CommandSpecs[K]['result'];
      case 'study':
        return state.study(c.tech) as CommandSpecs[K]['result'];
      case 'queueCraft':
        return state.queueCraft(c.item, c.times) as CommandSpecs[K]['result'];
      case 'cancelCraft':
        state.cancelCraft(c.index);
        return undefined as CommandSpecs[K]['result'];
    }
  }
}
