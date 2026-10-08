/** Messages échangés entre l'hôte et ses invités (objets simples, passés en JSON). */
import type { Command } from '../game/commands';
import type { PlayerChanges, WorldPart } from '../game/playerData';
import type { Inventory } from '../game/inventory';
import type { CraftJob } from '../game/state';
import type { GameOptions } from '../save/saveIndex';
import type { WorldParams } from '../world/worldgen';

export const PROTOCOL_VERSION = 1;

export interface PlayerInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export type RefusalReason = 'version' | 'closed' | 'full' | 'password' | 'denied' | 'bad-request';

/** Invité → hôte. */
export type ToHost =
  | { t: 'join'; version: number; name: string; password?: string }
  | { t: 'cmd'; seq: number; cmd: Command }
  | { t: 'pos'; x: number; y: number; z: number; yaw: number }
  /** Action du monde jouée chez l'invité, à rejouer chez l'hôte (méthode de la liste blanche et ses arguments). */
  | { t: 'call'; method: string; args: unknown[] }
  /** Barre d'objets, outils, équipement, munitions, tutoriel : décidés par l'invité. */
  | { t: 'loadout'; loadout: Record<string, unknown> }
  | { t: 'leave' };

/** Hôte → invité. */
export type ToGuest =
  | {
      t: 'welcome';
      you: PlayerInfo;
      /** De quoi recréer le même monde : seed, réglages de génération, règles de la partie. */
      world: WorldParams;
      options: GameOptions;
      /** État du monde à l'arrivée, et la fiche individuelle du joueur (neuve ou retrouvée). */
      snapshot: WorldPart;
      profile: { inventory: Inventory; changes: PlayerChanges };
    }
  | { t: 'refused'; reason: RefusalReason }
  | { t: 'result'; seq: number; result: unknown }
  | { t: 'snap'; tick: number; world: WorldPart }
  | { t: 'players'; players: PlayerInfo[] }
  /** Sa fiche à jour (sac et part individuelle), renvoyée après chaque commande. */
  | { t: 'me'; inventory: Inventory; changes: PlayerChanges; craft: CraftJob[] }
  /** Un ennemi a touché ce joueur (sa vie est suivie de son côté). */
  | { t: 'hit'; amount: number };
