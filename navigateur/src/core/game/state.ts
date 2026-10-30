import { VEHICLES, type VehicleKind } from '../data/vehicles';
import {
  CARS,
  RAIL_COST,
  RAIL_ITEM,
  STATION_ITEM,
  BARREL_L,
  BARREL_OF,
  carIdOfCargo,
  isCargoWindow,
  isLocoWindow,
  type LiquidKind,
  type CarKind,
} from '../data/trains';
import { MAX_STATIONS, cleanStationName, type Station } from '../rail/station';
import { normalizeProgram, stepProgram, type ProgramEnv, type ProgramEvent } from '../rail/program';
import { SOUTE_MAX } from '../rail/normalize';
import {
  TrackGraph,
  baseId,
  flip,
  neighbours,
  sharesOrigin,
  crossesAtLevel,
  trackCellsOf,
  mm,
  type RailKind,
  type RailPiece,
  type TrackPos,
} from '../rail/track';
import {
  anchorOffset,
  preferOf,
  carPoses,
  cargoMassKg,
  cargoVolumeL,
  coupleConsists,
  piecesUnder,
  findCoupling,
  splitConsist,
  type Car,
  type Consist,
} from '../rail/train';
import { CELL_SIZE_M } from '../constants';
import {
  chestPut,
  chestRoom,
  emptyMachine,
  ingredientCap,
  LIFTS,
  levelY,
  recipeOf,
  type Cell,
  Factory,
  type Machine,
  type Stack,
} from '../factory/factory';
import { DISCOVERIES, discoveryFor } from '../data/discoveries';
import {
  SCIENCE_PACKS,
  TECHS,
  isSciencePack,
  scienceCost,
  techById,
  techFor,
  type TechDef,
} from '../data/techs';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../save/saveIndex';
import { WEAPONS, type WeaponSpec } from '../data/weapons';
import {
  assemblerMaxTypes,
  isAssembler,
  isSmith,
  isTurret,
  itemOfTier,
  machineDef,
  turretSpec,
  type MachineType,
  slotCap,
} from '../data/machines';
import { buyPrice, sellPrice } from './trade';
import { perPlayerKeys, splitChanges, type PlayerChanges, type PlayerKey } from './playerData';
import { recipeById } from '../data/recipes';
import { resourceById } from '../data/resources';
import { isFree, pieceKey, type PiecePos, type Pieces } from '../build/pieces';
import { isSupported, pillarsForFace } from '../build/support';
import { distanceToGarage, garageGroup, openKeyOf } from '../build/garage';
import { detectRooms, type Room } from '../build/rooms';
import { GARAGE_KIND, pieceDef, resolveKind, slotOf, type PieceKind } from '../data/buildings';
import {
  BAG_LIMITS,
  ITEMS,
  energyKJ,
  itemById,
  type BagLimits,
  type EquipSlot,
} from '../data/items';
import { allLevels, levelInfo, variantId } from '../data/itemData';
import {
  add,
  maxAddable,
  normalizeInventory,
  remove,
  slotsUsed,
  stackOf,
  totals,
  type Inventory,
} from './inventory';
import {
  MAX_LOG,
  GARAGE_RANGES,
  MAX_PLACED,
  cellKey,
  emptyChanges,
  normalizeChanges,
  hasOldPacks,
  renamePacks,
  type Corpse,
  type LogEntry,
  type DroppedStack,
  type PlacedResource,
  type SpawnPoint,
  type Vehicle,
  type WorldChanges,
} from './worldChanges';

export type StateEvent = (
  | { type: 'harvest'; key: string }
  | { type: 'drops' }
  | { type: 'inventory' }
  | { type: 'build' }
  | { type: 'hotbar' }
  | { type: 'factory' }
  | { type: 'rails' }
  | { type: 'discovery'; id: string }
) & {
  /** L'événement vient d'un autre joueur (invité) : la vue locale doit se mettre à jour. */
  remote?: boolean;
};

export interface HarvestResult {
  /** Unités réellement ajoutées au sac. */
  gained: number;
  /** Ce qu'il reste dans la ressource après la récolte. */
  left: number;
  /** Le sac n'a pas pu tout recevoir. */
  bagFull: boolean;
}

/**
 * État de jeu modifiable par le joueur : sac et changements du monde. Toute modification passe par
 * une méthode (« commande ») : c'est ce que le multijoueur et l'annulation rejoueront plus tard.
 */
/** Composants T3 qu'exige la réparation d'un réacteur en panne. */
export const REACTOR_REPAIR: Record<string, number> = {
  steel_plate: 30,
  cable_insulated: 10,
  silicon_chip: 5,
};

/** Composants qu'exige la réparation du réacteur à fusion après l'effondrement du plasma. */
export const FUSION_REPAIR: Record<string, number> = {
  steel_plate: 100,
  zamak_ingot: 40,
  cable_insulated: 40,
};

/** Cases du sac en mode Créatif (le poids et le volume n'ont plus de limite). */
export const CREATIVE_SLOTS = 120;

/** Une fabrication à la main en file d'attente. */
export interface CraftJob {
  item: string;
  /** Fabrications qui restent (celle en cours comprise). */
  left: number;
  /** La fabrication en cours a déjà consommé ses ingrédients. */
  running: boolean;
  elapsed: number;
  duration: number;
}

/** Secondes de fabrication à la main par ingrédient, à vitesse d'outil ×1. */
export const CRAFT_SECONDS_PER_INGREDIENT = 0.5;
/** Un paquet de science fait à la main prend 5 s par palier (l'assembleur est plus rapide). */
export const PACK_HAND_SECONDS_PER_TIER = 5;
/** Mode Créatif : quantité tirée au hasard d'une case de minerai posée. */
export const CREATIVE_ORE_MIN = 300;
export const CREATIVE_ORE_MAX = 3000;
/** Mode Créatif : durée pour détruire une ressource au clic droit maintenu (s). */
export const CREATIVE_DESTROY_SECONDS = 0.4;
/** Mode Créatif : une construction se démolit en ce quotient du temps normal. */
export const CREATIVE_DEMOLISH_FACTOR = 0.3;

/** Charges d'un kit de réparation neuf, et part de la vie maximale rendue par charge. */
export const REPAIR_KIT_CHARGES = 5;
export const REPAIR_KIT_STEP = 0.25;

export class GameState {
  inventory: Inventory;
  changes: WorldChanges;
  /** Case de la barre de raccourcis sélectionnée (0 à 8), ou null. */
  selectedSlot: number | null = null;
  /** Objet « en main » depuis le sac, à poser dans une case de la barre au prochain clic. */
  carried: string | null = null;
  /** Objet sous le curseur dans le sac ou la fabrication : une touche 1 à 9 le range dans cette case de la barre. */
  pointed: string | null = null;
  /** Objet posable tenu en main (choisi dans le sac) : clic droit = mains vides. */
  held: string | null = null;
  /** Pile tenue au bout du curseur (retirée du sac) pour la déplacer dans une case de machine ou un coffre. */
  hand: { item: string; count: number } | null = null;
  private roomCache: Room[] | null = null;
  private readonly listeners = new Set<(e: StateEvent) => void>();

  constructor(
    saved?: { inventory?: unknown; changes?: unknown },
    private readonly baseLimits: BagLimits = BAG_LIMITS,
  ) {
    // Une ancienne sauvegarde a ses paquets de science décalés d'un cran (voir `PACK_VERSION`).
    const old = saved !== undefined && hasOldPacks(saved.changes);
    this.inventory = normalizeInventory(old ? renamePacks(saved?.inventory) : saved?.inventory);
    this.changes = saved
      ? normalizeChanges(old ? renamePacks(saved.changes) : saved.changes)
      : emptyChanges();
    // Ancienne sauvegarde : le kit entamé devient un objet à son niveau.
    if (this.changes.kitCharges > 0) {
      this.inventory = add(this.inventory, variantId('repair_kit', this.changes.kitCharges), 1);
      this.changes.kitCharges = 0;
    }
    this.migrateToolSlot();
  }

  /** Ancienne case d'outils : l'outil rejoint le sac et une case ordinaire de la barre (de préférence la dernière). */
  private migrateToolSlot(): void {
    const legacy = this.changes.tools.filter((id): id is string => !!id);
    const held = this.changes.toolsHeld;
    this.changes.tools = this.changes.tools.map(() => null);
    this.changes.toolsHeld = true;
    for (const id of legacy) {
      if (held) this.inventory = add(this.inventory, id, 1);
      if (this.changes.hotbar.includes(id)) continue;
      const bar = this.changes.hotbar;
      const free = bar[bar.length - 1] === null ? bar.length - 1 : bar.indexOf(null);
      if (free >= 0) bar[free] = id;
    }
  }

  /** Rejoue chez l'hôte un événement venu de l'état d'un joueur invité (le monde a changé : affichage à refaire). */
  relay(e: StateEvent): void {
    if (e.type === 'build') this.roomCache = null;
    this.emit(e);
  }

  /**
   * État d'un joueur invité vu par l'hôte : le MONDE est celui de l'hôte (même objet, modifié sur place) et les champs
   * individuels (barre d'objets, outils, tutoriel… et, si le partage est désactivé, technologies et crédits) sont ceux
   * de sa fiche. Les actions du joueur s'exécutent sur cet état avec le même code que pour l'hôte.
   */
  static forPlayer(
    host: GameState,
    profile: { inventory: Inventory; changes: PlayerChanges },
    share: { research: boolean; credits: boolean; inventory: boolean },
    name = '',
  ): GameState {
    const guest = new GameState(undefined, host.baseLimits);
    guest.playerKey = name;
    const keys = new Set<string>(perPlayerKeys(share));
    const own = profile.changes as Record<string, unknown>;
    const fresh = splitChanges(emptyChanges(), [...keys] as PlayerKey[]).player as Record<
      string,
      unknown
    >;
    for (const k of keys) if (own[k] === undefined) own[k] = fresh[k];
    guest.changes = new Proxy(host.changes, {
      get: (target, k) => (typeof k === 'string' && keys.has(k) ? own[k] : Reflect.get(target, k)),
      set: (target, k, v) => {
        if (typeof k === 'string' && keys.has(k)) own[k] = v;
        else Reflect.set(target, k, v);
        return true;
      },
    });
    guest.inventory = profile.inventory;
    if (share.inventory) {
      Object.defineProperty(guest, 'inventory', {
        get: () => host.inventory,
        set: (v: Inventory) => {
          host.inventory = v;
        },
      });
    }
    guest.creative = host.creative;
    guest.costs = host.costs;
    guest.onChange((e) => {
      if (e.type === 'inventory' || e.type === 'hotbar') {
        if (share.inventory) host.relay({ ...e, remote: true });
      } else host.relay({ ...e, remote: true });
    });
    return guest;
  }

  /**
   * Consomme `n` unités d'un objet qu'on pose. En mode Créatif, un seul exemplaire suffit : on en pose autant qu'on veut
   * (casser l'objet le rend, ce qui garde au moins ce que le joueur avait).
   */
  private spend(item: string, n: number): void {
    if (this.creative && this.creativeStock && (this.inventory[item] ?? 0) >= 1) return;
    this.inventory = remove(this.inventory, item, n).inventory;
  }

  /** Nom du joueur dont c'est la fiche ('' pour l'hôte ou une partie solo) : décide quel contenu du coffre quantique il voit. */
  playerKey = '';

  /**
   * Coffre quantique : le contenu appartient au joueur, pas au coffre. Tous ses coffres quantiques montrent le même
   * contenu, que personne d'autre ne voit ; il reste enregistré même si les coffres sont démolis. Renvoie la machine à
   * manipuler (une vue dont `slots` est le contenu de ce joueur).
   */
  chestOf(m: Machine): Machine {
    if (m.type !== 'quantum_chest') return m;
    return { ...m, slots: (this.changes.quantum[this.playerKey] ??= []) };
  }

  /** Mode Créatif : un exemplaire suffit pour poser à l'infini (désactivé dans les tests qui comptent les objets). */
  creativeStock = true;

  /** Mode Créatif : recherche et fabrication gratuites, sac sans limite de poids ni de volume. */
  creative = false;
  /** Multiplicateurs de difficulté de la partie (coûts des technologies et de la fabrication). */
  costs: Difficulty = DEFAULT_DIFFICULTY;

  /** Capacité du sac : de base, plus les bonus de l'équipement porté (sac à dos…). */
  get limits(): BagLimits {
    const l = { ...this.baseLimits };
    if (this.creative)
      return { ...l, maxSlots: CREATIVE_SLOTS, maxWeightG: Infinity, maxVolumeMl: Infinity };
    for (const id of Object.values(this.changes.equipment)) {
      const bonus = itemById(id).equip?.bonus;
      if (!bonus) continue;
      l.maxSlots += bonus.slots;
      l.maxWeightG += bonus.weightG;
      l.maxVolumeMl += bonus.volumeMl;
    }
    return l;
  }

  /** Capacité de base du sac, sans équipement. */
  baseLimitsView(): BagLimits {
    return { ...this.baseLimits };
  }

  onChange(listener: (e: StateEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: StateEvent): void {
    this.listeners.forEach((l) => l(e));
  }

  /** Copie à enregistrer dans une sauvegarde. */
  snapshot(): { inventory: Inventory; changes: WorldChanges } {
    // Ce que le joueur tient au bout du curseur fait partie de son sac.
    const inventory = structuredClone(this.inventory);
    return {
      inventory: this.hand ? add(inventory, this.hand.item, this.hand.count) : inventory,
      changes: structuredClone(this.changes),
    };
  }

  // --- Cases du sac : des piles de quantités différentes, déplaçables ----------------------------

  /** Cases du sac (l'ordre et le découpage des piles). Le contenu total reste `inventory`. */
  private bag: ({ item: string; count: number } | null)[] = [];

  /** Les cases du sac, remises d'accord avec le contenu (ajouts : piles entamées d'abord, puis cases libres). */
  bagSlots(): ({ item: string; count: number } | null)[] {
    const n = this.limits.maxSlots;
    while (this.bag.length < n) this.bag.push(null);
    for (let i = n; i < this.bag.length; i++) this.bag[i] = null;
    this.bag.length = n;
    const sum = new Map<string, number>();
    for (const s of this.bag) if (s) sum.set(s.item, (sum.get(s.item) ?? 0) + s.count);
    // Trop dans les cases : on retire depuis la dernière.
    for (const [item, have] of sum) {
      let extra = have - (this.inventory[item] ?? 0);
      for (let i = n - 1; i >= 0 && extra > 0; i--) {
        const s = this.bag[i];
        if (!s || s.item !== item) continue;
        const cut = Math.min(extra, s.count);
        s.count -= cut;
        extra -= cut;
        if (s.count <= 0) this.bag[i] = null;
      }
    }
    // Pas assez : on complète les piles entamées, puis on prend des cases libres (dans l'ordre du catalogue).
    const ids = [
      ...ITEMS.map((d) => d.id),
      ...Object.keys(this.inventory).filter((k) => k.includes('~')),
    ];
    for (const id of ids) {
      const def = { id };
      const max = stackOf(def.id, this.limits);
      let need =
        (this.inventory[def.id] ?? 0) -
        this.bag.reduce((a, s) => a + (s && s.item === def.id ? s.count : 0), 0);
      for (let i = 0; i < n && need > 0; i++) {
        const s = this.bag[i];
        if (s && s.item === def.id && s.count < max) {
          const put = Math.min(need, max - s.count);
          s.count += put;
          need -= put;
        }
      }
      while (need > 0) {
        let free = this.bag.indexOf(null);
        if (free < 0) {
          this.compactBag();
          free = this.bag.indexOf(null);
          if (free < 0) break;
        }
        const put = Math.min(need, max);
        this.bag[free] = { item: def.id, count: put };
        need -= put;
      }
    }
    return this.bag;
  }

  /** Regroupe les piles du même objet (quand il n'y a plus de case libre). */
  private compactBag(): void {
    const totals = new Map<string, number>();
    for (const s of this.bag) if (s) totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
    this.bag = this.bag.map(() => null);
    let i = 0;
    for (const [item, total] of totals) {
      const max = stackOf(item, this.limits);
      for (let left = total; left > 0; left -= max)
        this.bag[i++] = { item, count: Math.min(left, max) };
    }
  }

  /** Déplace une pile d'une case à l'autre : case vide = déplacée, même objet = fusionnée, sinon échange. */
  moveBagSlot(from: number, to: number): void {
    const bag = this.bagSlots();
    const a = bag[from];
    if (!a || from === to || to < 0 || to >= bag.length) return;
    const b = bag[to];
    const max = stackOf(a.item, this.limits);
    if (!b) {
      bag[to] = a;
      bag[from] = null;
    } else if (b.item === a.item) {
      const put = Math.min(a.count, max - b.count);
      b.count += put;
      a.count -= put;
      if (a.count <= 0) bag[from] = null;
    } else {
      bag[to] = a;
      bag[from] = b;
    }
    this.emit({ type: 'inventory' });
  }

  /** Unités disponibles : celles de la pile `bagIndex` si on la désigne, sinon tout le sac. */
  private availableIn(item: string, bagIndex?: number): number {
    if (bagIndex === undefined) return this.inventory[item] ?? 0;
    const s = this.bagSlots()[bagIndex];
    return s && s.item === item ? s.count : 0;
  }

  /** Retire `n` unités du sac, en commençant par la pile `bagIndex` si on la désigne (les autres piles restent intactes). */
  private takeUnits(item: string, n: number, bagIndex?: number): void {
    if (bagIndex !== undefined) {
      const s = this.bagSlots()[bagIndex];
      if (s && s.item === item) {
        const cut = Math.min(n, s.count);
        s.count -= cut;
        if (s.count <= 0) this.bag[bagIndex] = null;
      }
    }
    this.inventory = remove(this.inventory, item, n).inventory;
  }

  /** Vide la case du sac (avant de retirer ses objets du contenu, par exemple pour les jeter). */
  clearBagSlot(index: number): { item: string; count: number } | null {
    const bag = this.bagSlots();
    const s = bag[index] ?? null;
    if (s) bag[index] = null;
    return s;
  }

  /** Pose la pile tenue au curseur dans cette case du sac (vide : nouvelle pile ; même objet : on complète ; sinon échange). */
  placeHand(index: number): number {
    const h = this.hand;
    if (!h) return 0;
    const bag = this.bagSlots();
    if (index < 0 || index >= bag.length) return 0;
    const max = stackOf(h.item, this.limits);
    const slot = bag[index];
    const room = maxAddable(this.inventory, h.item, this.limits);
    if (slot && slot.item !== h.item) {
      // Échange : la pile de la case passe au curseur.
      if (h.count > max) return 0;
      const old = { ...slot };
      bag[index] = { item: h.item, count: h.count };
      this.inventory = add(this.inventory, h.item, h.count);
      this.inventory = remove(this.inventory, old.item, old.count).inventory;
      this.hand = old;
    } else {
      const n = Math.min(h.count, room, max - (slot?.count ?? 0));
      if (n <= 0) return 0;
      if (slot) slot.count += n;
      else bag[index] = { item: h.item, count: n };
      this.inventory = add(this.inventory, h.item, n);
      h.count -= n;
      if (h.count <= 0) this.hand = null;
    }
    this.emit({ type: 'inventory' });
    return 1;
  }

  /** Prend `count` unités du sac au bout du curseur (la pile tenue est d'abord rangée si c'est un autre objet). */
  takeToHand(item: string, count: number, slot?: number): number {
    if (this.hand && this.hand.item !== item) this.returnHand();
    let n = Math.min(count, this.inventory[item] ?? 0);
    if (n <= 0) return 0;
    if (slot !== undefined) {
      // La pile cliquée est celle qui diminue.
      const s = this.bagSlots()[slot];
      if (s && s.item === item) {
        n = Math.min(n, s.count);
        s.count -= n;
        if (s.count <= 0) this.bag[slot] = null;
      }
    }
    this.inventory = remove(this.inventory, item, n).inventory;
    this.hand = { item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Prend des objets d'une case de coffre (ou d'ingrédient d'assembleur) au bout du curseur. */
  takeChestToHand(machine: Machine, index: number, count: number): number {
    const m = this.chestOf(machine);
    const st = m.slots[index];
    if (!st || (this.hand && this.hand.item !== st.item)) return 0;
    const n = Math.min(count, st.count);
    if (n <= 0) return 0;
    st.count -= n;
    if (st.count <= 0) m.slots.splice(index, 1);
    this.hand = { item: st.item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Prend des objets d'une case de machine (combustible, entrée, sortie) au bout du curseur. */
  takeSlotToHand(m: Machine, slot: 'fuel' | 'input' | 'stock' | 'extra', count: number): number {
    const st = m[slot];
    if (!st || (this.hand && this.hand.item !== st.item)) return 0;
    const n = Math.min(count, st.count);
    if (n <= 0) return 0;
    st.count -= n;
    if (st.count <= 0) m[slot] = null;
    this.hand = { item: st.item, count: (this.hand?.count ?? 0) + n };
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Range dans le sac la pile tenue (tout ce qui tient). Renvoie la quantité rangée. */
  returnHand(): number {
    if (!this.hand) return 0;
    const n = Math.min(this.hand.count, maxAddable(this.inventory, this.hand.item, this.limits));
    if (n > 0) this.inventory = add(this.inventory, this.hand.item, n);
    this.hand.count -= n;
    if (this.hand.count <= 0) this.hand = null;
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Dépose la pile tenue via `use(item, count)` (qui renvoie la quantité acceptée) ; le reste reste en main. */
  useHand(use: (item: string, count: number) => number): number {
    const h = this.hand;
    if (!h) return 0;
    // Les actions de la machine puisent dans le sac : on y remet la pile le temps du geste.
    this.hand = null;
    this.inventory = add(this.inventory, h.item, h.count);
    const moved = use(h.item, h.count);
    const left = h.count - moved;
    if (left > 0) {
      this.inventory = remove(this.inventory, h.item, left).inventory;
      this.hand = { item: h.item, count: left };
    }
    this.emit({ type: 'inventory' });
    return moved;
  }

  /**
   * Équipe 1 objet du sac sur son emplacement ; celui qui y était retourne au sac (échange).
   * Renvoie 'ok', 'notEquipment' (pas un équipement) ou 'bagFull' (l'échange ne tient pas).
   */
  equip(item: string): 'ok' | 'notEquipment' | 'bagFull' {
    const slot = itemById(item).equip?.slot;
    if (!slot) return 'notEquipment';
    if ((this.inventory[item] ?? 0) <= 0) return 'notEquipment';
    const previous = this.changes.equipment[slot];
    const saved = { inventory: this.inventory, equipment: { ...this.changes.equipment } };
    this.inventory = remove(this.inventory, item, 1).inventory;
    this.changes.equipment[slot] = item;
    if (previous) {
      if (maxAddable(this.inventory, previous, this.limits) < 1) {
        this.inventory = saved.inventory;
        this.changes.equipment = saved.equipment;
        return 'bagFull';
      }
      this.inventory = add(this.inventory, previous, 1);
    }
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Retire l'équipement d'un emplacement vers le sac, si le sac (sans le bonus de l'objet) le contient encore. */
  unequip(slot: EquipSlot): 'ok' | 'empty' | 'bagFull' {
    const item = this.changes.equipment[slot];
    if (!item) return 'empty';
    const saved = { ...this.changes.equipment };
    delete this.changes.equipment[slot];
    const lim = this.limits;
    const withItem = add(this.inventory, item, 1);
    const used = totals(withItem);
    const slots = slotsUsed(withItem, lim);
    if (used.weightG > lim.maxWeightG || used.volumeMl > lim.maxVolumeMl || slots > lim.maxSlots) {
      this.changes.equipment = saved;
      return 'bagFull';
    }
    this.inventory = withItem;
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Le sac peut-il encore recevoir au moins une unité de cet objet ? */
  hasRoomFor(item: string): boolean {
    return maxAddable(this.inventory, item, this.limits) > 0;
  }

  /** Reste dans une ressource dont le contenu d'origine est `total`. */
  remaining(key: string, total: number): number {
    return Math.max(0, total - (this.changes.taken[key] ?? 0));
  }

  /** Compte une récolte à la main et déclenche les découvertes atteintes. */
  private countHarvest(item: string, n: number): void {
    this.changes.harvested[item] = (this.changes.harvested[item] ?? 0) + n;
    this.checkDiscoveries('harvest');
  }

  /** Quelque chose a été fabriqué (par une machine ou à la main) : compteur des découvertes. */
  countProduced(item: string, n: number): void {
    if (n <= 0) return;
    this.changes.produced[item] = (this.changes.produced[item] ?? 0) + n;
    this.checkDiscoveries('produce');
    this.emit({ type: 'inventory' });
  }

  /** Avancement d'une découverte (plafonné à son objectif). */
  discoveryProgress(d: (typeof DISCOVERIES)[number]): number {
    const counter = d.goal.kind === 'harvest' ? this.changes.harvested : this.changes.produced;
    return Math.min(d.goal.count, counter[d.goal.item] ?? 0);
  }

  private checkDiscoveries(kind: 'harvest' | 'produce'): void {
    for (const d of DISCOVERIES) {
      if (d.goal.kind !== kind || this.changes.discovered.includes(d.id)) continue;
      if (this.discoveryProgress(d) < d.goal.count) continue;
      this.changes.discovered.push(d.id);
      this.addLog('discovery', d.id);
      this.emit({ type: 'discovery', id: d.id });
    }
  }

  /** Récolte jusqu'à `units` unités d'une ressource (arbre, rocher, case de minerai). */
  harvest(key: string, total: number, item: string, units = 1): HarvestResult {
    const available = this.remaining(key, total);
    const fits = maxAddable(this.inventory, item, this.limits);
    const gained = Math.max(0, Math.min(units, available, fits));
    if (gained > 0) {
      this.inventory = add(this.inventory, item, gained);
      this.changes.taken[key] = (this.changes.taken[key] ?? 0) + gained;
      this.countHarvest(item, gained);
      this.emit({ type: 'harvest', key });
      this.emit({ type: 'inventory' });
    }
    return { gained, left: available - gained, bagFull: gained < Math.min(units, available) };
  }

  /** Pose des objets du sac au sol. Renvoie la pile créée, ou null s'il n'y a rien à jeter. */
  drop(item: string, count: number, x: number, z: number): DroppedStack | null {
    const { inventory, removed } = remove(this.inventory, item, count);
    if (removed === 0) return null;
    this.inventory = inventory;
    const stack: DroppedStack = {
      id: `drop-${this.changes.nextDropId++}`,
      item,
      count: removed,
      x,
      z,
    };
    this.changes.drops.push(stack);
    this.emit({ type: 'drops' });
    this.emit({ type: 'inventory' });
    return stack;
  }

  /** Laisse au sol des objets qui n'appartiennent à personne (dépouilles d'ennemis) : rien n'est retiré du sac. */
  dropLoot(item: string, count: number, x: number, z: number): void {
    if (count <= 0) return;
    this.changes.drops.push({ id: `drop-${this.changes.nextDropId++}`, item, count, x, z });
    this.emit({ type: 'drops' });
  }

  /** Ramasse (tout ou en partie, selon la place) une pile posée au sol. */
  pickUp(stackId: string): HarvestResult {
    const stack = this.changes.drops.find((d) => d.id === stackId);
    if (!stack) return { gained: 0, left: 0, bagFull: false };
    const gained = Math.min(stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (gained > 0) {
      this.inventory = add(this.inventory, stack.item, gained);
      stack.count -= gained;
      if (stack.count <= 0) this.changes.drops = this.changes.drops.filter((d) => d.id !== stackId);
      this.emit({ type: 'drops' });
      this.emit({ type: 'inventory' });
    }
    return { gained, left: stack.count, bagFull: stack.count > 0 };
  }

  /**
   * Ouvre ou ferme une porte (clé du bloc 0 d'un battant) : tous les battants côte à côte s'ouvrent ensemble
   * (une porte = deux battants de 50 cm). Renvoie vrai si elle est ouverte ensuite.
   */
  toggleDoor(key: string): boolean | null {
    const kind = this.changes.pieces[key];
    const m = /^e:(-?\d+):(-?\d+),(-?\d+):([xz]):0$/.exec(key);
    if (!kind?.startsWith('door') || !m) return null;
    if (kind === GARAGE_KIND) {
      // Porte de garage : la touche « Activer » ne la manœuvre qu'en mode manuel.
      const g = this.garageAt(key);
      if (!g || g.mode === 'auto') return null;
      return this.setGarageOpen(key, !this.changes.pieces[openKeyOf(g.anchor) as string]);
    }
    const level = m[1];
    const axis = m[4];
    const at = (gx: number, gz: number): string => `e:${level}:${gx},${gz}:${axis}:0`;
    const openOf = (gx: number, gz: number): string => `o:${level}:${gx},${gz}:${axis}`;
    const nowOpen = !this.changes.pieces[openOf(Number(m[2]), Number(m[3]))];
    // Les battants contigus le long du mur, de part et d'autre.
    const leaves: [number, number][] = [[Number(m[2]), Number(m[3])]];
    for (const dir of [-1, 1]) {
      for (let k = 1; k < 8; k++) {
        const gx = axis === 'x' ? Number(m[2]) + dir * k : Number(m[2]);
        const gz = axis === 'z' ? Number(m[3]) + dir * k : Number(m[3]);
        const next = this.changes.pieces[at(gx, gz)];
        if (!next?.startsWith('door') || next === GARAGE_KIND) break;
        leaves.push([gx, gz]);
      }
    }
    for (const [gx, gz] of leaves) {
      if (nowOpen) this.changes.pieces[openOf(gx, gz)] = this.changes.pieces[at(gx, gz)];
      else delete this.changes.pieces[openOf(gx, gz)];
    }
    this.emit({ type: 'build' });
    return nowOpen;
  }

  // --- Barre de raccourcis ---------------------------------------------------------------------

  /** Sélectionne la case (ou la désélectionne si elle l'était déjà). Une case vide ne se sélectionne pas. */
  selectSlot(index: number): void {
    if (index < 0 || index >= this.changes.hotbar.length) return;
    this.held = null;
    this.selectedSlot = this.selectedSlot === index || !this.changes.hotbar[index] ? null : index;
    this.emit({ type: 'hotbar' });
  }

  /** Objet de la case sélectionnée. */
  selectedItem(): string | null {
    if (this.held) {
      if ((this.inventory[this.held] ?? 0) > 0) return this.held;
      // Le dernier exemplaire est posé : la main redevient vide (pas de patron fantôme).
      this.held = null;
      this.selectedSlot = null;
      return null;
    }
    if (this.selectedSlot === null) return null;
    const item = this.changes.hotbar[this.selectedSlot];
    if (item && (this.inventory[item] ?? 0) <= 0) {
      // Une case de la barre sans plus aucun exemplaire ne garde pas son patron actif.
      this.selectedSlot = null;
      return null;
    }
    return item;
  }

  /** Mains vides : plus d'objet tenu ni de case sélectionnée. */
  clearHand(): void {
    this.held = null;
    this.selectedSlot = null;
    this.emit({ type: 'hotbar' });
  }

  /** Prend en main un objet posable choisi dans le sac (prioritaire sur la barre de raccourcis). */
  setHeld(item: string | null): void {
    this.held = item && (this.inventory[item] ?? 0) > 0 ? item : null;
    this.emit({ type: 'hotbar' });
  }

  /** Outil de récolte en main : celui de la case choisie dans la barre (visible en main), sinon null : mains nues. */
  toolItem(): string | null {
    const picked = this.selectedItem();
    return picked !== null && (this.inventory[picked] ?? 0) > 0 && itemById(picked).tool
      ? picked
      : null;
  }

  /** Protection totale des pièces portées (%), plafonnée à 80 : part des dégâts que l'armure absorbe. */
  /**
   * Répare une machine abîmée avec un kit de réparation : chaque kit a 5 charges, chacune rend 25 % de la vie maximale.
   * Chaque kit est un objet à part (`repair_kit~4`…) : on use d'abord le plus entamé ; le dernier disparaît.
   */
  repairMachine(factory: Factory, id: number): 'ok' | 'full' | 'noKit' | 'missing' {
    const machine = factory.machines.find((m) => m.id === id);
    if (!machine) return 'missing';
    const max = Factory.maxHealth(machine.type);
    const hp = factory.health.get(id) ?? max;
    if (hp >= max) return 'full';
    const kit = allLevels('repair_kit')
      .map((k) => ({ k, level: levelInfo(k)!.level }))
      .filter((x) => x.level > 0 && (this.inventory[x.k] ?? 0) > 0)
      .sort((a, b) => a.level - b.level)[0];
    if (!kit) return 'noKit';
    this.wearItem(kit.k, 1);
    const next = hp + max * REPAIR_KIT_STEP;
    if (next >= max) factory.health.delete(id);
    else factory.health.set(id, next);
    return 'ok';
  }

  /** Charges de réparation disponibles dans le sac. */
  repairCharges(): number {
    return allLevels('repair_kit').reduce(
      (n, k) => n + (this.inventory[k] ?? 0) * (levelInfo(k)?.level ?? 0),
      0,
    );
  }

  /**
   * Fait passer une unité de `id` à `to` (autre niveau du même objet, ou rien si `to` est null), à sa place dans le sac.
   * Faux s'il n'y en a pas dans le sac.
   */
  transformItem(id: string, to: string | null): boolean {
    if ((this.inventory[id] ?? 0) < 1) return false;
    const bag = this.bagSlots();
    const i = bag.findIndex((s) => s?.item === id && s.count === 1);
    this.inventory = remove(this.inventory, id, 1).inventory;
    if (to) this.inventory = add(this.inventory, to, 1);
    if (i >= 0) bag[i] = to ? { item: to, count: 1 } : null;
    // La main et la barre de raccourcis suivent l'objet qui change de niveau (un kit reste en main d'une charge à l'autre).
    if ((this.inventory[id] ?? 0) === 0 && to) {
      if (this.held === id) this.held = to;
      this.changes.hotbar = this.changes.hotbar.map((x) => (x === id ? to : x));
    }
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Use une unité de `id` de `steps` niveaux (la détruit au niveau 0). Renvoie le niveau restant. */
  wearItem(id: string, steps: number): number {
    const info = levelInfo(id);
    if (!info) return 0;
    const level = Math.max(0, info.level - steps);
    this.transformItem(id, level > 0 ? variantId(info.base, level) : null);
    return level;
  }

  armorPercent(): number {
    let total = 0;
    for (const id of Object.values(this.changes.equipment)) total += itemById(id).equip?.armor ?? 0;
    return Math.min(80, total);
  }

  /** Chaleur apportée par les vêtements et armures portés (points, voir `weather.ts`). */
  warmth(): number {
    let total = 0;
    for (const id of Object.values(this.changes.equipment))
      total += itemById(id).equip?.warmth ?? 0;
    return total;
  }

  /** Dégâts réellement subis après l'armure. */
  mitigate(amount: number): number {
    if (this.creative) return amount;
    const taken = amount * (1 - this.armorPercent() / 100);
    this.wearArmor(amount);
    return taken;
  }

  /** Dégâts encaissés par chaque pièce d'armure portée avant de perdre un niveau d'usure (non enregistrés). */
  static readonly ARMOR_WEAR_PER_STEP = 60;
  private readonly armorWear = new Map<string, number>();

  /** Un coup reçu use les pièces d'armure portées : un niveau de moins tous les `ARMOR_WEAR_PER_STEP` dégâts ; à zéro elle se brise. */
  private wearArmor(amount: number): void {
    for (const [slot, id] of Object.entries(this.changes.equipment)) {
      const info = id ? levelInfo(id) : null;
      if (!id || !info || !itemById(id).equip?.armor) continue;
      const total = (this.armorWear.get(slot) ?? 0) + amount;
      if (total < GameState.ARMOR_WEAR_PER_STEP) {
        this.armorWear.set(slot, total);
        continue;
      }
      this.armorWear.set(slot, total - GameState.ARMOR_WEAR_PER_STEP);
      const level = info.level - 1;
      const next = level > 0 ? variantId(info.base, level) : null;
      // L'équipement porté change de niveau en place ; à zéro, la pièce est détruite.
      this.inventory = remove(this.inventory, id, 1).inventory;
      if (next) {
        this.inventory = add(this.inventory, next, 1);
        (this.changes.equipment as Record<string, string | null>)[slot] = next;
      } else delete (this.changes.equipment as Record<string, string | null>)[slot];
      this.emit({ type: 'inventory' });
    }
  }

  /** Bonus de récolte de l'outil en place (null = mains nues). */
  harvestTool(): { speed: number; yield: number } | null {
    const id = this.toolItem();
    return id ? itemById(id).tool : null;
  }

  /** Range un objet dans une case (un objet n'occupe qu'une case) ou la vide (`null`). */
  assignSlot(index: number, item: string | null): void {
    if (index < 0 || index >= this.changes.hotbar.length) return;
    if (item !== null) {
      this.changes.hotbar = this.changes.hotbar.map((x) => (x === item ? null : x));
    }
    this.changes.hotbar[index] = item;
    if (this.selectedSlot !== null && !this.changes.hotbar[this.selectedSlot]) {
      this.selectedSlot = null;
    }
    this.carried = null;
    this.emit({ type: 'hotbar' });
  }

  // --- Construction ----------------------------------------------------------------------------

  /** Les pièces (espaces fermés) du moment, recalculées seulement après une modification. */
  rooms(): Room[] {
    this.roomCache ??= detectRooms(this.changes.pieces);
    return this.roomCache;
  }

  /** Le sac contient-il l'objet nécessaire pour poser cette pièce ? */
  canAfford(kind: PieceKind): boolean {
    return (this.inventory[pieceDef(kind).item] ?? 0) >= 1;
  }

  /** Pose une pièce (consomme 1 objet du sac). Refuse si l'emplacement est pris ou si le sac n'en a pas. */
  place(
    kind: PieceKind,
    pos: PiecePos,
    rotation = 0,
  ): 'ok' | 'occupied' | 'missing' | 'invalid' | 'unsupported' {
    const def = pieceDef(kind);
    // Une dalle devient un sol ou un plafond selon l'emplacement.
    const placed = resolveKind(kind, pos.slot);
    if (slotOf(pieceDef(placed).type) !== pos.slot) return 'invalid';
    if (!isFree(this.changes.pieces, placed, pos)) return 'occupied';
    if (!this.canAfford(kind)) return 'missing';
    // Pièce en hauteur sans appui à moins de 5 m : refusée (un mur ou un pilier doit la soutenir).
    if (!isSupported(this.changes.pieces, placed, pos)) return 'unsupported';
    this.spend(def.item, 1);
    this.changes.pieces[pieceKey(pos)] = placed;
    if (rotation % 4 !== 0) this.changes.rotations[pieceKey(pos)] = ((rotation % 4) + 4) % 4;
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /**
   * Pose une porte de garage : tous ses segments d'un coup pour un seul objet. Refusée si un segment est pris ou sans
   * appui. Elle démarre en mode manuel (touche « Activer »).
   */
  placeGarage(positions: PiecePos[]): number {
    const def = pieceDef(GARAGE_KIND);
    if (positions.length === 0 || (this.inventory[def.item] ?? 0) < 1) return 0;
    const trial: Pieces = Object.create(this.changes.pieces) as Pieces;
    for (const pos of positions) {
      if (!isFree(trial, GARAGE_KIND, pos) || !isSupported(trial, GARAGE_KIND, pos)) return 0;
      trial[pieceKey(pos)] = GARAGE_KIND;
    }
    this.spend(def.item, 1);
    for (const pos of positions) this.changes.pieces[pieceKey(pos)] = GARAGE_KIND;
    const group = garageGroup(this.changes.pieces, pieceKey(positions[0]));
    if (group) this.changes.garages[group.anchor] = { mode: 'manual', range: GARAGE_RANGES[0] };
    this.roomCache = null;
    this.emit({ type: 'build' });
    this.emit({ type: 'inventory' });
    return positions.length;
  }

  /** Réglages de la porte de garage dont fait partie ce segment (mode et distance de détection), ou null. */
  garageAt(key: string): { anchor: string; mode: 'manual' | 'auto'; range: number } | null {
    const group = garageGroup(this.changes.pieces, key);
    if (!group) return null;
    const g = this.changes.garages[group.anchor] ?? { mode: 'manual', range: GARAGE_RANGES[0] };
    return { anchor: group.anchor, mode: g.mode, range: g.range };
  }

  /** Choisit comment s'ouvre la porte de garage : à la touche « Activer » (manuel) ou quand un véhicule approche. */
  setGarage(key: string, mode: 'manual' | 'auto', range: number): boolean {
    const group = garageGroup(this.changes.pieces, key);
    if (!group) return false;
    const r = GARAGE_RANGES.includes(range) ? range : GARAGE_RANGES[0];
    this.changes.garages[group.anchor] = { mode: mode === 'auto' ? 'auto' : 'manual', range: r };
    this.emit({ type: 'build' });
    return true;
  }

  /** Ouvre ou ferme tous les segments de la porte de garage (le capteur et la touche passent par là). */
  setGarageOpen(key: string, open: boolean): boolean | null {
    const group = garageGroup(this.changes.pieces, key);
    if (!group) return null;
    const isOpen = !!this.changes.pieces[openKeyOf(group.anchor) as string];
    if (isOpen === open) return open;
    for (const k of group.keys) {
      const ok = openKeyOf(k) as string;
      if (open) this.changes.pieces[ok] = GARAGE_KIND;
      else delete this.changes.pieces[ok];
    }
    this.emit({ type: 'build' });
    return open;
  }

  /** Portes de garage en mode automatique : ouvertes tant qu'un des points (véhicules) est à portée. */
  senseGarages(points: { x: number; z: number }[]): void {
    for (const [anchor, g] of Object.entries(this.changes.garages)) {
      if (g.mode !== 'auto') continue;
      const group = garageGroup(this.changes.pieces, anchor);
      if (!group) continue;
      const near = points.some((p) => distanceToGarage(group, p.x, p.z) <= g.range);
      this.setGarageOpen(anchor, near);
    }
  }

  /** Pose plusieurs pièces d'un coup ; renvoie combien ont pu l'être (selon le stock et les emplacements libres). */
  placeMany(kind: PieceKind, positions: PiecePos[], rotation = 0): number {
    if (kind === GARAGE_KIND) return this.placeGarage(positions);
    let n = 0;
    for (const pos of positions) if (this.place(kind, pos, rotation) === 'ok') n++;
    return n;
  }

  /**
   * Fabrique à la main jusqu'à `times` unités d'un objet. Ne fabrique que ce que les ressources et la
   * place dans le sac permettent. Renvoie le nombre fabriqué et la raison de l'arrêt éventuel.
   */
  /** Cet objet peut-il être fabriqué (sa technologie est-elle recherchée) ? */
  isUnlocked(item: string): boolean {
    if (!this.creative && ITEMS.some((i) => i.id === item && i.creativeOnly)) return false;
    const tech = techFor(item);
    const discovery = discoveryFor(item);
    return (
      (!tech || this.changes.unlocked.includes(tech.id)) &&
      (!discovery || this.changes.discovered.includes(discovery.id))
    );
  }

  /** Coût d'une technologie, multiplié par la difficulté (au moins 1 de chaque). */
  techCost(tech: TechDef): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [item, n] of Object.entries(tech.cost)) {
      const k = isSciencePack(item) ? this.costs.researchPacks : this.costs.researchItems;
      out[item] = Math.max(1, Math.round(n * k));
    }
    return out;
  }

  /** Paquets de science demandés par une technologie (difficulté comprise). */
  packCostOf(tech: TechDef): Record<string, number> {
    return Object.fromEntries(
      Object.entries(this.techCost(tech)).filter(([item]) => isSciencePack(item)),
    );
  }

  /** Recette de fabrication à la main d'un objet (ingrédients multipliés par la difficulté), ou null. */
  recipeFor(item: string): Record<string, number> | null {
    const recipe = itemById(item).recipe;
    if (!recipe) return null;
    if (this.costs.crafting === 1) return recipe;
    return Object.fromEntries(
      Object.entries(recipe).map(([id, n]) => [
        id,
        Math.max(1, Math.round(n * this.costs.crafting)),
      ]),
    );
  }

  /** Recherche une technologie : consomme son coût dans le sac. */
  research(id: string): 'ok' | 'done' | 'locked' | 'missing' | 'lab' {
    const tech = techById(id);
    if (this.changes.unlocked.includes(id)) return 'done';
    if (scienceCost(tech) > 0 && !this.creative) return 'lab';
    if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) return 'locked';
    const cost = this.techCost(tech);
    if (
      !this.creative &&
      !Object.entries(cost).every(([item, n]) => (this.inventory[item] ?? 0) >= n)
    )
      return 'missing';
    if (!this.creative)
      for (const [item, n] of Object.entries(cost))
        this.inventory = remove(this.inventory, item, n).inventory;
    this.changes.unlocked.push(id);
    this.addLog(this.creative ? 'creative' : 'research', id);
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Ajoute une ligne au journal de la partie (les plus anciennes sont oubliées au-delà de `MAX_LOG`). */
  addLog(kind: LogEntry['kind'], id: string): void {
    this.changes.log.push({ t: Date.now(), kind, id });
    if (this.changes.log.length > MAX_LOG)
      this.changes.log.splice(0, this.changes.log.length - MAX_LOG);
  }

  /** Choisit (ou, avec null, arrête) la technologie étudiée par les laboratoires. */
  study(id: string | null): 'ok' | 'done' | 'locked' | 'notLab' {
    if (id === null) {
      this.changes.researching = null;
      this.emit({ type: 'factory' });
      return 'ok';
    }
    const tech = techById(id);
    if (scienceCost(tech) <= 0) return 'notLab';
    if (this.changes.unlocked.includes(id)) return 'done';
    if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) return 'locked';
    this.changes.researching = id;
    this.emit({ type: 'factory' });
    return 'ok';
  }

  /** Sans étude choisie, les laboratoires qui ont des paquets étudient la première technologie disponible. */
  autoStudy(): string | null {
    if (this.changes.researching) return null;
    for (const tech of TECHS) {
      if (scienceCost(tech) <= 0 || this.changes.unlocked.includes(tech.id)) continue;
      if (!tech.requires.every((r) => this.changes.unlocked.includes(r))) continue;
      this.study(tech.id);
      return tech.id;
    }
    return null;
  }

  /** Paquets déjà étudiés pour une technologie, par type (une ancienne sauvegarde ne connaît que le paquet T1). */
  private packsDone(id: string): Record<string, number> {
    const done = this.changes.packProgress[id];
    if (done) return done;
    const legacy = this.changes.progress[id] ?? 0;
    return legacy > 0 ? { science_pack: legacy } : {};
  }

  /** Paquets de science encore à étudier pour la technologie en cours, par type. */
  studyNeeds(): Record<string, number> {
    const id = this.changes.researching;
    if (!id) return {};
    const done = this.packsDone(id);
    const needs: Record<string, number> = {};
    for (const [pack, n] of Object.entries(this.packCostOf(techById(id)))) {
      const left = n - (done[pack] ?? 0);
      if (left > 0) needs[pack] = left;
    }
    return needs;
  }

  /** Total de paquets encore à étudier pour la technologie en cours. */
  studyRemaining(): number {
    return Object.values(this.studyNeeds()).reduce((x, y) => x + y, 0);
  }

  /** Les laboratoires ont étudié ces paquets : la technologie avance, et se débloque à la fin. */
  addStudy(packs: Record<string, number>): void {
    const id = this.changes.researching;
    if (!id) return;
    const wanted = this.packCostOf(techById(id));
    const done = { ...this.packsDone(id) };
    let added = 0;
    for (const [pack, n] of Object.entries(packs)) {
      const room = (wanted[pack] ?? 0) - (done[pack] ?? 0);
      const used = Math.min(n, room);
      if (used <= 0) continue;
      done[pack] = (done[pack] ?? 0) + used;
      added += used;
    }
    if (added <= 0) return;
    this.changes.packProgress[id] = done;
    this.changes.progress[id] = Object.values(done).reduce((x, y) => x + y, 0);
    if (Object.entries(wanted).every(([pack, n]) => (done[pack] ?? 0) >= n)) {
      this.changes.unlocked.push(id);
      this.addLog('study', id);
      this.changes.researching = null;
    }
    this.emit({ type: 'inventory' });
  }

  /** Fabrications à la main en attente (non enregistrées : on les relance après un chargement). */
  craftQueue: CraftJob[] = [];

  /**
   * Durée (s) d'une fabrication à la main : 0,5 s par ingrédient, divisée par la vitesse de l'outil ; instantanée en
   * Créatif. Un paquet de science prend 5 s par palier (T1 5 s … T5 25 s), plus qu'à l'assembleur.
   */
  craftSeconds(item: string): number {
    const recipe = this.recipeFor(item);
    if (!recipe || this.creative) return 0;
    const pack = SCIENCE_PACKS.indexOf(item as (typeof SCIENCE_PACKS)[number]);
    if (pack >= 0 && pack < 5)
      return (PACK_HAND_SECONDS_PER_TIER * (pack + 1)) / (this.harvestTool()?.speed ?? 1);
    const count = Object.values(recipe).reduce((a, b) => a + b, 0);
    return Math.max(
      0.25,
      (count * CRAFT_SECONDS_PER_INGREDIENT) / (this.harvestTool()?.speed ?? 1),
    );
  }

  /**
   * Met `times` fabrications en file d'attente (elles se font l'une après l'autre en continuant à jouer).
   * Refuse si l'objet est verrouillé ou si la première ne peut pas démarrer.
   */
  queueCraft(item: string, times: number): 'ok' | 'locked' | 'resources' | 'bag' {
    const recipe = this.recipeFor(item);
    if (!recipe) return 'resources';
    if (!this.isUnlocked(item)) return 'locked';
    if (
      !this.creative &&
      !Object.entries(recipe).every(([id, n]) => (this.inventory[id] ?? 0) >= n)
    )
      return 'resources';
    if (this.canStartCraft(item) === 'bag') return 'bag';
    const last = this.craftQueue[this.craftQueue.length - 1];
    if (last && last.item === item) last.left += times;
    else this.craftQueue.push({ item, left: times, running: false, elapsed: 0, duration: 0 });
    this.tickCraft(0);
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  private canStartCraft(item: string): 'ok' | 'resources' | 'bag' {
    const recipe = this.recipeFor(item) ?? {};
    if (
      !this.creative &&
      !Object.entries(recipe).every(([id, n]) => (this.inventory[id] ?? 0) >= n)
    )
      return 'resources';
    let after = this.inventory;
    if (!this.creative)
      for (const [id, n] of Object.entries(recipe)) after = remove(after, id, n).inventory;
    return maxAddable(after, item, this.limits) < itemById(item).yield ? 'bag' : 'ok';
  }

  /** Fait avancer la fabrication en cours ; une fabrication terminée donne ses objets. */
  tickCraft(dt: number): void {
    let budget = dt;
    for (let guard = 0; guard < 1000; guard++) {
      const job = this.craftQueue[0];
      if (!job) return;
      if (!job.running) {
        // Démarrage : les ingrédients sont pris dans le sac.
        const recipe = this.recipeFor(job.item) ?? {};
        if (this.canStartCraft(job.item) !== 'ok') {
          if (this.canStartCraft(job.item) === 'resources') this.craftQueue.shift();
          return; // sac plein : on attend de la place
        }
        if (!this.creative)
          for (const [id, n] of Object.entries(recipe))
            this.inventory = remove(this.inventory, id, n).inventory;
        job.running = true;
        job.elapsed = 0;
        job.duration = this.craftSeconds(job.item);
        this.emit({ type: 'inventory' });
      }
      const step = Math.min(budget, job.duration - job.elapsed);
      job.elapsed += step;
      budget -= step;
      if (job.elapsed < job.duration - 1e-9) return;
      this.finishCraft(job.item);
      job.running = false;
      job.left--;
      if (job.left <= 0) this.craftQueue.shift();
    }
  }

  /** Donne le résultat d'une fabrication à la main terminée. */
  private finishCraft(item: string): void {
    const per = itemById(item).yield;
    this.inventory = add(this.inventory, item, per);
    this.changes.produced[item] = (this.changes.produced[item] ?? 0) + per;
    this.checkDiscoveries('produce');
    this.emit({ type: 'inventory' });
  }

  /** Annule la fabrication n° `index` de la file : la fabrication en cours rend ses ingrédients. */
  cancelCraft(index: number): void {
    const job = this.craftQueue[index];
    if (!job) return;
    if (job.running && !this.creative) {
      for (const [id, n] of Object.entries(this.recipeFor(job.item) ?? {}))
        this.inventory = add(this.inventory, id, n);
    }
    this.craftQueue.splice(index, 1);
    this.emit({ type: 'inventory' });
  }

  /** Progression de la fabrication en cours (0 à 1) et nombre de fabrications en attente. */
  craftProgress(): { item: string; fraction: number; queued: number } | null {
    const job = this.craftQueue[0];
    if (!job) return null;
    return {
      item: job.item,
      fraction: job.duration > 0 ? Math.min(1, job.elapsed / job.duration) : 0,
      queued: this.craftQueue.reduce((a, j) => a + j.left, 0),
    };
  }

  craft(
    item: string,
    times: number,
  ): { made: number; stopped: 'resources' | 'bag' | 'locked' | null } {
    const recipe = this.recipeFor(item);
    if (!recipe) return { made: 0, stopped: 'resources' };
    if (!this.isUnlocked(item)) return { made: 0, stopped: 'locked' };
    let made = 0;
    let stopped: 'resources' | 'bag' | null = null;
    while (made < times) {
      if (
        !this.creative &&
        !Object.entries(recipe).every(([id, n]) => (this.inventory[id] ?? 0) >= n)
      ) {
        stopped = 'resources';
        break;
      }
      let after = this.inventory;
      if (!this.creative)
        for (const [id, n] of Object.entries(recipe)) after = remove(after, id, n).inventory;
      const per = itemById(item).yield;
      if (maxAddable(after, item, this.limits) < per) {
        stopped = 'bag';
        break;
      }
      this.inventory = add(after, item, per);
      made += per;
    }
    if (made > 0) {
      this.changes.produced[item] = (this.changes.produced[item] ?? 0) + made;
      this.checkDiscoveries('produce');
      this.emit({ type: 'inventory' });
    }
    return { made, stopped };
  }

  /**
   * Démolit des pièces et rend les objets correspondants (ce qui ne tient pas dans le sac tombe au sol
   * aux coordonnées données). Renvoie le nombre de pièces démontées.
   */
  removeKeys(keys: string[], drop: { x: number; z: number }): number {
    let n = 0;
    // Une porte de garage se démolit en entier (un seul objet rendu).
    const expanded: string[] = [];
    for (const key of keys) {
      const group = garageGroup(this.changes.pieces, key);
      if (group) {
        expanded.push(...group.keys);
        delete this.changes.garages[group.anchor];
      } else expanded.push(key);
    }
    let garageRefund = new Set<string>();
    for (const key of expanded)
      if (this.changes.pieces[key] === GARAGE_KIND) garageRefund = garageRefund.add(key);
    keys = expanded;
    for (const key of keys) {
      const kind = this.changes.pieces[key];
      if (!kind) continue;
      delete this.changes.pieces[key];
      delete this.changes.rotations[key];
      const door = /^e:(-?\d+):(-?\d+),(-?\d+):([xz]):0$/.exec(key);
      if (door) delete this.changes.pieces[`o:${door[1]}:${door[2]},${door[3]}:${door[4]}`];
      n++;
      // Démolir rend la pièce elle-même (l'objet), pas ses ressources de fabrication. Un pilier
      // automatique ne rend rien.
      // Un pilier automatique ne rend rien ; une porte de garage rend un seul objet pour tous ses segments.
      if (kind === GARAGE_KIND) {
        if (garageRefund.size > 0) {
          garageRefund.clear();
          this.giveBack(pieceDef(kind).item, 1, drop);
        }
      } else if (pieceDef(kind).type !== 'pillar') this.giveBack(pieceDef(kind).item, 1, drop);
    }
    if (n > 0) {
      this.roomCache = null;
      this.emit({ type: 'build' });
      this.emit({ type: 'inventory' });
    }
    return n;
  }

  // --- Véhicules ---------------------------------------------------------------------------------

  /** Pose un buggy (consomme l'objet du sac). */
  // --- Mort, corps et réapparition ---------------------------------------------------------------

  /** Le joueur tombe : tout ce qu'il porte (sac, curseur, équipement) reste sur son corps, à récupérer. */
  dieAt(x: number, z: number, yaw: number): Corpse {
    const inventory = this.hand
      ? add(structuredClone(this.inventory), this.hand.item, this.hand.count)
      : structuredClone(this.inventory);
    const corpse: Corpse = {
      id: this.changes.nextCorpseId++,
      x,
      z,
      yaw,
      inventory,
      equipment: { ...this.changes.equipment },
    };
    for (const tool of this.changes.tools) if (tool) inventory[tool] = (inventory[tool] ?? 0) + 1;
    this.changes.tools = this.changes.tools.map(() => null);
    this.inventory = {};
    this.hand = null;
    this.held = null;
    this.carried = null;
    this.bag = [];
    this.changes.equipment = {};
    this.changes.corpses.push(corpse);
    this.emit({ type: 'inventory' });
    return corpse;
  }

  /**
   * Le joueur interagit avec un corps : l'équipement se remet sur lui (ou va au sac si l'emplacement est pris),
   * puis le contenu passe dans le sac autant que la place le permet. Le corps disparaît quand il est vide.
   */
  recoverCorpse(id: number): 'recovered' | 'partial' | 'empty' | 'none' {
    const corpse = this.changes.corpses.find((c) => c.id === id);
    if (!corpse) return 'none';
    const hadStuff =
      Object.keys(corpse.inventory).length > 0 || Object.keys(corpse.equipment).length > 0;
    for (const [slot, item] of Object.entries(corpse.equipment) as [EquipSlot, string][]) {
      if (!this.changes.equipment[slot]) this.changes.equipment[slot] = item;
      else corpse.inventory = add(corpse.inventory, item, 1);
      delete corpse.equipment[slot];
    }
    for (const [item, count] of Object.entries(corpse.inventory)) {
      const n = Math.min(count, maxAddable(this.inventory, item, this.limits));
      if (n <= 0) continue;
      this.inventory = add(this.inventory, item, n);
      corpse.inventory = remove(corpse.inventory, item, n).inventory;
    }
    const left = Object.keys(corpse.inventory).length > 0;
    if (!left) this.changes.corpses.splice(this.changes.corpses.indexOf(corpse), 1);
    this.emit({ type: 'inventory' });
    return !hadStuff ? 'empty' : left ? 'partial' : 'recovered';
  }

  /** Pose un duvet (usage unique) ou un lit (permanent) : le dernier posé est le point de réapparition. */
  placeSpawn(kind: 'bag' | 'bed', x: number, z: number): SpawnPoint | null {
    const item = kind === 'bag' ? 'sleeping_bag' : 'bed';
    if ((this.inventory[item] ?? 0) < 1) return null;
    this.spend(item, 1);
    const point: SpawnPoint = { id: this.changes.nextSpawnId++, x, z, kind };
    this.changes.spawns.push(point);
    this.emit({ type: 'inventory' });
    return point;
  }

  /** Range un duvet ou un lit : il revient dans le sac (ou tombe au sol si le sac est plein). */
  pickUpSpawn(id: number, at: { x: number; z: number }): boolean {
    const i = this.changes.spawns.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const [point] = this.changes.spawns.splice(i, 1);
    this.giveBack(point.kind === 'bag' ? 'sleeping_bag' : 'bed', 1, at);
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Où le joueur se réveille : le dernier duvet ou lit posé (un duvet est consommé), sinon `null` (point de départ). */
  consumeRespawn(): { x: number; z: number } | null {
    const spawns = this.changes.spawns;
    const last = spawns[spawns.length - 1];
    if (!last) return null;
    if (last.kind === 'bag') spawns.pop();
    return { x: last.x, z: last.z };
  }

  /**
   * Un tapis surélevé (niveau 1 ou 2, y compris les rampes qui montent du niveau 1) doit avoir un support à moins de
   * 2,5 m : sinon un pilier de soutènement est posé sous lui, automatiquement et sans coût (comme pour la construction).
   */
  private supportBelt(type: MachineType, gx: number, gz: number, lift: number): void {
    if (type !== 'conveyor') return;
    const shape = LIFTS[lift];
    const low = shape ? Math.min(shape.from, shape.to) : 0;
    if (low < 1) return;
    const added = pillarsForFace(
      this.changes.pieces,
      Math.round(levelY(low) / CELL_SIZE_M),
      gx,
      gz,
      'stone',
    );
    if (Object.keys(added).length === 0) return;
    Object.assign(this.changes.pieces, added);
    this.roomCache = null;
    this.emit({ type: 'build' });
  }

  /** Filtre d'un bras filtrant ou d'un trieur : passe de liste blanche à liste noire (ou l'inverse). */
  setFilterMode(m: Machine, index: number, mode: 'allow' | 'deny'): boolean {
    const f = m.filters[index];
    if (!f) return false;
    f.mode = mode;
    this.emit({ type: 'factory' });
    return true;
  }

  /** Coche ou décoche un objet dans un filtre. Renvoie vrai s'il est maintenant coché. */
  toggleFilterItem(m: Machine, index: number, item: string): boolean {
    const f = m.filters[index];
    if (!f) return false;
    const at = f.items.indexOf(item);
    if (at >= 0) f.items.splice(at, 1);
    else f.items.push(item);
    this.emit({ type: 'factory' });
    return at < 0;
  }

  /** Vide un filtre (liste noire vide : tout passe). */
  clearFilter(m: Machine, index: number): void {
    const f = m.filters[index];
    if (!f) return;
    f.items = [];
    this.emit({ type: 'factory' });
  }

  placeVehicle(x: number, z: number, yaw: number, kind: VehicleKind = 'buggy'): Vehicle | null {
    const item = VEHICLES[kind].item;
    if ((this.inventory[item] ?? 0) < 1) return null;
    this.inventory = remove(this.inventory, item, 1).inventory;
    const id = this.changes.vehicles.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    const v: Vehicle = { id, kind, x, z, yaw, fuel: 0, fuelStack: null, slots: [] };
    this.changes.vehicles.push(v);
    this.emit({ type: 'inventory' });
    return v;
  }

  // --- Voies ferrées et trains -------------------------------------------------------------------

  private graph: TrackGraph | null = null;
  private graphFor = '';

  /** Les voies posées et leurs raccords (recalculés quand la voie change). */
  railGraph(): TrackGraph {
    const rails = this.changes.rails;
    const key = `${rails.length}:${rails.length > 0 ? rails[rails.length - 1].id : 0}:${this.railRevision}`;
    if (!this.graph || key !== this.graphFor) {
      this.graph = new TrackGraph(rails);
      this.graphFor = key;
    }
    return this.graph;
  }
  private railRevision = 0;
  private railsChanged(): void {
    this.railRevision++;
    this.emit({ type: 'rails' });
    this.emit({ type: 'inventory' });
  }

  /**
   * Pourquoi une pièce ne se poserait pas là : `terrain` (une de ses cases est bloquée : machine, mur, arbre…), `overlap`
   * (elle chevauche la voie existante), ou null si elle tient. Un raccord, un départ commun d'embranchement et un
   * croisement en travers ne comptent pas comme un chevauchement.
   */
  railProblem(
    piece: RailPiece,
    blocked: (c: Cell) => boolean,
    extra: readonly RailPiece[] = [],
  ): 'terrain' | 'overlap' | null {
    if (!trackCellsOf(piece).every(([x, z]) => !blocked({ gx: x, gz: z }))) return 'terrain';
    return this.railsOverlapping(piece, extra).length > 0 ? 'overlap' : null;
  }

  /** La pièce tient-elle là ? */
  railFits(piece: RailPiece, blocked: (c: Cell) => boolean): boolean {
    return this.railProblem(piece, blocked) === null;
  }

  /** Pièces de voie qui gênent une nouvelle pièce : celles dont une case est prise, hors raccords et croisements. */
  railsOverlapping(piece: RailPiece, extra: readonly RailPiece[] = []): RailPiece[] {
    const cells = new Set(trackCellsOf(piece).map(([x, z]) => `${x},${z}`));
    const all = extra.length > 0 ? [...this.changes.rails, ...extra] : this.changes.rails;
    return all.filter(
      (p) =>
        trackCellsOf(p).some(([x, z]) => cells.has(`${x},${z}`)) &&
        !neighbours(piece, p) &&
        !sharesOrigin(piece, p, all) &&
        !crossesAtLevel(piece, p),
    );
  }

  /** La même pièce est-elle déjà posée exactement là ? */
  railAlready(kind: RailKind, x: number, z: number, h: number, level: number): boolean {
    const hh = ((h % 8) + 8) % 8;
    return this.changes.rails.some(
      (p) =>
        p.kind === kind &&
        Math.abs(p.x - x) < 0.01 &&
        Math.abs(p.z - z) < 0.01 &&
        p.h === hh &&
        Math.abs(p.level - level) < 0.05,
    );
  }

  /**
   * Pose une pièce de voie (consomme les rails du sac) ; refuse si le terrain la bloque, si elle chevauche la voie
   * existante ou s'il manque des rails.
   */
  placeRail(
    kind: RailKind,
    x: number,
    z: number,
    h: number,
    level: number,
    blocked: (c: Cell) => boolean,
  ): 'ok' | 'missing' | 'blocked' {
    const id = this.changes.rails.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const piece: RailPiece = {
      id,
      kind,
      x: mm(x),
      z: mm(z),
      h: ((h % 8) + 8) % 8,
      level: mm(level),
    };
    const cost = RAIL_COST[kind];
    if ((this.inventory[RAIL_ITEM] ?? 0) < (this.creative && this.creativeStock ? 1 : cost))
      return 'missing';
    if (this.railAlready(kind, piece.x, piece.z, piece.h, piece.level)) return 'blocked';
    if (!this.railFits(piece, blocked)) return 'blocked';
    this.spend(RAIL_ITEM, cost);
    this.changes.rails.push(piece);
    this.railsChanged();
    return 'ok';
  }

  /** Un convoi roule ou stationne-t-il sur cette pièce (sur l'une ou l'autre voie d'un aiguillage) ? */
  railOccupied(id: number): boolean {
    const graph = this.railGraph();
    return this.changes.trains.some((c) => {
      const under = piecesUnder(graph, c);
      return under.has(id);
    });
  }

  /** Reprend une pièce de voie (l'objet revient dans le sac) ; refusé tant qu'un convoi est dessus. */
  removeRail(id: number, at: { x: number; z: number }): boolean {
    const i = this.changes.rails.findIndex((p) => p.id === id);
    if (i < 0 || this.railOccupied(id)) return false;
    const [piece] = this.changes.rails.splice(i, 1);
    this.giveBack(RAIL_ITEM, RAIL_COST[piece.kind], at);
    // Une station posée sur cette pièce n'a plus de voie : elle revient dans le sac.
    for (const st of this.changes.stations.filter((x) => baseId(x.piece) === id)) {
      this.changes.stations.splice(this.changes.stations.indexOf(st), 1);
      this.giveBack(STATION_ITEM, 1, at);
      this.dropOrders(st.id);
    }
    this.railsChanged();
    return true;
  }

  private newConsistId(): number {
    return this.changes.trains.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  }
  private newCarId(): number {
    let max = 0;
    for (const c of this.changes.trains) for (const k of c.cars) max = Math.max(max, k.id);
    return max + 1;
  }

  /** Un véhicule de ce type peut-il se poser là : un en stock, sur la voie, sans toucher un autre ? */
  canPlaceCar(kind: CarKind, pos: TrackPos): boolean {
    const spec = CARS[kind];
    if ((this.inventory[spec.item] ?? 0) < 1) return false;
    const graph = this.railGraph();
    if (!graph.has(pos.piece)) return false;
    const head = graph.advance(pos, spec.frontM).pos;
    const mine = carPoses(graph, {
      id: -1,
      head,
      v: 0,
      cars: [{ id: -1, kind, rev: false, heatKJ: 0, fuel: null }],
    })[0];
    for (const other of this.changes.trains)
      for (const p of carPoses(graph, other)) {
        const need = (spec.lengthM + CARS[p.car.kind].lengthM) / 2 - 0.1;
        if (Math.hypot(p.x - mine.x, p.z - mine.z) < need && Math.abs(p.y - mine.y) < 1.5)
          return false;
      }
    return true;
  }

  /** Pose un véhicule sur la voie, au centre de `pos`, l'avant dans le sens `pos.dir` ; refuse s'il touche un autre. */
  placeCar(kind: CarKind, pos: TrackPos): Consist | null {
    if (!this.canPlaceCar(kind, pos)) return null;
    const spec = CARS[kind];
    const graph = this.railGraph();
    const head = graph.advance(pos, spec.frontM).pos;
    const consist: Consist = {
      id: this.newConsistId(),
      head,
      v: 0,
      cars: [{ id: this.newCarId(), kind, rev: false, heatKJ: 0, fuel: null }],
    };
    this.spend(spec.item, 1);
    this.changes.trains.push(consist);
    this.railsChanged();
    return consist;
  }

  /** Reprend un véhicule seul (pas attelé) : l'objet et la soute reviennent dans le sac. */
  pickUpCar(consistId: number): 'ok' | 'coupled' | 'none' {
    const i = this.changes.trains.findIndex((c) => c.id === consistId);
    if (i < 0) return 'none';
    const c = this.changes.trains[i];
    if (c.cars.length !== 1) return 'coupled';
    this.changes.trains.splice(i, 1);
    const graph = this.railGraph();
    const p = graph.pose(c.head);
    const at = { x: p?.x ?? 0, z: p?.z ?? 0 };
    this.giveBack(CARS[c.cars[0].kind].item, 1, at);
    const fuel = c.cars[0].fuel;
    if (fuel) this.giveBack(fuel.item, fuel.count, at);
    this.railsChanged();
    return 'ok';
  }

  /** Démonte un véhicule, même attelé : il revient dans le sac avec sa soute, le reste du convoi se scinde. */
  removeCar(carId: number): boolean {
    const i = this.changes.trains.findIndex((c) => c.cars.some((k) => k.id === carId));
    if (i < 0) return false;
    const c = this.changes.trains[i];
    const graph = this.railGraph();
    const idx = c.cars.findIndex((k) => k.id === carId);
    const pose = carPoses(graph, c)[idx];
    const at = { x: pose?.x ?? 0, z: pose?.z ?? 0 };
    // Derrière le véhicule : un nouveau convoi ; devant : le convoi d'origine, raccourci.
    if (idx + 1 < c.cars.length) {
      const rear = splitConsist(graph, c, idx + 1, this.newConsistId());
      if (rear) this.changes.trains.push(rear);
    }
    const [car] = c.cars.splice(idx, 1);
    if (c.cars.length === 0) this.changes.trains.splice(this.changes.trains.indexOf(c), 1);
    this.giveBack(CARS[car.kind].item, 1, at);
    if (car.fuel) this.giveBack(car.fuel.item, car.fuel.count, at);
    this.railsChanged();
    return true;
  }

  /** Enregistre le programme d'un convoi (rien : on l'efface) ; il est en pause tant qu'on ne le lance pas. */
  setProgram(consistId: number, raw: unknown): boolean {
    const c = this.changes.trains.find((x) => x.id === consistId);
    if (!c) return false;
    const program = raw === null ? null : normalizeProgram(raw);
    if (raw !== null && !program) return false;
    delete c.goTo;
    if (program) c.program = { ...program, index: 0, phase: 'waiting', timer: 0, running: false };
    else delete c.program;
    this.emit({ type: 'rails' });
    return true;
  }

  /** Lance ou arrête le programme d'un convoi (arrêter lui rend la conduite à la main). */
  setProgramRunning(consistId: number, running: boolean): boolean {
    const c = this.changes.trains.find((x) => x.id === consistId);
    if (!c?.program) return false;
    c.program.running = running;
    c.program.phase = 'waiting';
    c.program.timer = 0;
    if (!running) delete c.goTo;
    this.emit({ type: 'rails' });
    return true;
  }

  /** Fait avancer les programmes de `dt` secondes ; renvoie les événements à annoncer (pause, ordre donné). */
  tickPrograms(dt: number): { consist: number; event: ProgramEvent }[] {
    const out: { consist: number; event: ProgramEvent }[] = [];
    if (!this.changes.trains.some((c) => c.program?.running)) return out;
    const graph = this.railGraph();
    const stations = new Set(this.changes.stations.map((s) => s.id));
    const env: ProgramEnv = {
      stations,
      atStation: (c, id) => {
        const st = this.changes.stations.find((s) => s.id === id);
        const a = st ? graph.pose({ piece: st.piece, u: st.u, dir: 1 }) : null;
        // C'est la locomotive qui se tient au repère de la station.
        const anchor = graph.advance(flip(c.head), anchorOffset(c), preferOf(c)).pos;
        const b = graph.pose(flip(anchor));
        return !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < 1.5;
      },
    };
    for (const c of this.changes.trains) {
      const event = stepProgram(c, dt, env);
      if (event.goTo !== undefined) c.goTo = event.goTo;
      if (event.goTo !== undefined || event.paused) {
        this.emit({ type: 'rails' });
        out.push({ consist: c.id, event });
      }
    }
    return out;
  }

  /** Les convois qui allaient à cette station reprennent la conduite à la main. */
  private dropOrders(stationId: number): void {
    for (const c of this.changes.trains) if (c.goTo === stationId) delete c.goTo;
  }

  /** Pose une station sur la voie (consomme l'objet) : refusé hors voie, trop près d'une autre station, ou sans objet. */
  placeStation(pos: { piece: number; u: number }, name = ''): Station | null {
    if ((this.inventory[STATION_ITEM] ?? 0) < 1) return null;
    const graph = this.railGraph();
    if (!graph.has(pos.piece)) return null;
    if (this.changes.stations.some((s) => s.piece === pos.piece && Math.abs(s.u - pos.u) < 3))
      return null;
    if (this.changes.stations.length >= MAX_STATIONS) return null;
    const id = this.changes.stations.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const station: Station = {
      id,
      name: cleanStationName(name) || `Station ${id}`,
      piece: pos.piece,
      u: pos.u,
    };
    this.spend(STATION_ITEM, 1);
    this.changes.stations.push(station);
    this.railsChanged();
    return station;
  }

  renameStation(id: number, name: string): boolean {
    const st = this.changes.stations.find((s) => s.id === id);
    const clean = cleanStationName(name);
    if (!st || !clean) return false;
    st.name = clean;
    this.emit({ type: 'rails' });
    return true;
  }

  /** Reprend une station (l'objet revient dans le sac). */
  removeStation(id: number): boolean {
    const i = this.changes.stations.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const [st] = this.changes.stations.splice(i, 1);
    const p = this.railGraph().pose({ piece: st.piece, u: st.u, dir: 1 });
    this.giveBack(STATION_ITEM, 1, { x: p?.x ?? 0, z: p?.z ?? 0 });
    this.dropOrders(id);
    this.railsChanged();
    return true;
  }

  /** Envoie un convoi à une station (pilote automatique), ou lui rend la conduite à la main (`null`). */
  sendTrain(consistId: number, stationId: number | null): boolean {
    const c = this.changes.trains.find((x) => x.id === consistId);
    if (!c) return false;
    if (stationId === null) delete c.goTo;
    else if (this.changes.stations.some((s) => s.id === stationId)) c.goTo = stationId;
    else return false;
    this.emit({ type: 'rails' });
    return true;
  }

  /** Le véhicule de cet identifiant (dans l'un des convois), ou null. */
  carById(id: number): Car | null {
    for (const c of this.changes.trains) {
      const k = c.cars.find((x) => x.id === id);
      if (k) return k;
    }
    return null;
  }

  /** Combien d'unités de cet objet un wagon de fret peut encore recevoir, selon sa charge utile et son volume. */
  cargoRoom(car: Car, item: string): number {
    const spec = CARS[car.kind].cargo;
    if (!spec) return 0;
    const def = itemById(item);
    const byKg = Math.floor((spec.maxKg - cargoMassKg(car)) / (def.weightG / 1000));
    const byL = Math.floor((spec.maxL - cargoVolumeL(car)) / (def.volumeMl / 1000));
    return Math.max(0, Math.min(byKg, byL));
  }

  /** Verse un baril plein du sac dans une citerne (100 L) : le baril vide revient dans le sac. */
  pourBarrel(carId: number): 'ok' | 'noBarrel' | 'full' | 'mismatch' | 'none' {
    const car = this.carById(carId);
    const cap = car ? CARS[car.kind].tankL : undefined;
    if (!car || !cap) return 'none';
    const kinds = car.liquid
      ? [car.liquid.kind]
      : (Object.keys(BARREL_OF) as LiquidKind[]).filter(
          (k) => (this.inventory[BARREL_OF[k] ?? ''] ?? 0) > 0,
        );
    const kind = kinds.find((k) => (this.inventory[BARREL_OF[k] ?? ''] ?? 0) > 0);
    if (!kind) {
      const other = (Object.keys(BARREL_OF) as LiquidKind[]).some(
        (k) => (this.inventory[BARREL_OF[k] ?? ''] ?? 0) > 0,
      );
      return other && car.liquid ? 'mismatch' : 'noBarrel';
    }
    if ((car.liquid?.liters ?? 0) + BARREL_L > cap) return 'full';
    this.inventory = remove(this.inventory, BARREL_OF[kind] as string, 1).inventory;
    this.inventory = add(this.inventory, 'barrel_empty', 1);
    car.liquid = { kind, liters: (car.liquid?.liters ?? 0) + BARREL_L };
    this.emit({ type: 'rails' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Remplit un baril vide du sac avec 100 L de la citerne (eau ou pétrole). */
  drawBarrel(carId: number): 'ok' | 'noBarrel' | 'empty' | 'unsupported' | 'none' {
    const car = this.carById(carId);
    if (!car || !CARS[car.kind].tankL) return 'none';
    if (!car.liquid || car.liquid.liters < BARREL_L) return 'empty';
    const full = BARREL_OF[car.liquid.kind];
    if (!full) return 'unsupported';
    if ((this.inventory.barrel_empty ?? 0) < 1) return 'noBarrel';
    this.inventory = remove(this.inventory, 'barrel_empty', 1).inventory;
    this.inventory = add(this.inventory, full, 1);
    car.liquid.liters -= BARREL_L;
    if (car.liquid.liters <= 0) car.liquid = null;
    this.emit({ type: 'rails' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Remplit la soute d'une locomotive avec du charbon ou du bois du sac (renvoie le nombre de pièces chargées). */
  refuelLocomotive(car: Car): number {
    if (!CARS[car.kind].loco || CARS[car.kind].loco?.electric) return 0;
    for (const item of ['coal', 'wood']) {
      const have = this.inventory[item] ?? 0;
      if (have < 1 || (car.fuel && car.fuel.item !== item)) continue;
      const room = SOUTE_MAX - (car.fuel?.count ?? 0);
      const n = Math.min(have, room, 20);
      if (n <= 0) continue;
      this.inventory = remove(this.inventory, item, n).inventory;
      car.fuel = { item, count: (car.fuel?.count ?? 0) + n };
      this.emit({ type: 'inventory' });
      return n;
    }
    return 0;
  }

  /** Attelle le convoi à celui dont l'attelage est tout près ; renvoie le convoi réuni, ou null s'il n'y en a pas. */
  coupleTrain(consistId: number): Consist | null {
    const c = this.changes.trains.find((x) => x.id === consistId);
    if (!c) return null;
    const graph = this.railGraph();
    const found = findCoupling(graph, this.changes.trains, c);
    if (!found) return null;
    const merged = coupleConsists(graph, c, found.mine, found.other, found.theirs);
    delete merged.goTo; // un nouveau convoi : le pilote reprend à zéro
    delete merged.program;
    delete found.other.goTo;
    this.changes.trains.splice(this.changes.trains.indexOf(found.other), 1);
    this.railsChanged();
    return merged;
  }

  /** Dételle entre le véhicule `index − 1` et le véhicule `index` ; le convoi arrière est garé. */
  uncoupleTrain(consistId: number, index: number): Consist | null {
    const c = this.changes.trains.find((x) => x.id === consistId);
    if (!c) return null;
    const rear = splitConsist(this.railGraph(), c, index, this.newConsistId());
    if (!rear) return null;
    delete c.goTo;
    delete c.program;
    this.changes.trains.push(rear);
    this.railsChanged();
    return rear;
  }

  /** Range un véhicule dans le sac (ou au sol s'il est plein). */
  pickUpVehicle(id: number): boolean {
    const i = this.changes.vehicles.findIndex((v) => v.id === id);
    if (i < 0) return false;
    const [v] = this.changes.vehicles.splice(i, 1);
    this.giveBack(VEHICLES[v.kind].item, 1, { x: v.x, z: v.z });
    for (const st of [v.fuelStack, ...v.slots])
      if (st) this.giveBack(st.item, st.count, { x: v.x, z: v.z });
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Remplit le réservoir du buggy avec un combustible du sac (renvoie les secondes de route ajoutées, 0 s'il n'y en a pas). */
  refuelVehicle(v: Vehicle): number {
    const burn = VEHICLES[v.kind].burnKw;
    // Un véhicule électrique n'a pas de réservoir : sa batterie se recharge à une borne.
    if (VEHICLES[v.kind].electric) return 0;
    // D'abord la case de carburant, puis le coffre du buggy, puis le sac.
    const take = (): { seconds: number } | null => {
      const f = v.fuelStack;
      if (f && itemById(f.item).energyMJ) {
        f.count--;
        if (f.count <= 0) v.fuelStack = null;
        return { seconds: energyKJ(f.item) / burn };
      }
      for (const item of ['coal', 'wood']) {
        const seconds = energyKJ(item) / burn;
        const stack = v.slots.find((x) => x.item === item);
        if (stack) {
          stack.count--;
          if (stack.count <= 0) v.slots.splice(v.slots.indexOf(stack), 1);
          return { seconds };
        }
      }
      for (const item of ['coal', 'wood']) {
        const seconds = energyKJ(item) / burn;
        if ((this.inventory[item] ?? 0) >= 1) {
          this.inventory = remove(this.inventory, item, 1).inventory;
          return { seconds };
        }
      }
      return null;
    };
    const got = take();
    if (got) {
      v.fuel += got.seconds;
      this.emit({ type: 'inventory' });
      return got.seconds;
    }
    return 0;
  }

  /** Secondes de poussée restantes dans la batterie du propulseur en cours (non sauvegardées : une batterie par rechargement). */
  private jetpackSeconds = 0;
  /** Secondes restantes sur le niveau de batterie portable en cours (non enregistrées). */
  private portableSeconds = 0;
  /** Durée de poussée d'une batterie lithium. */
  static readonly JETPACK_BATTERY_S = 20;

  /** Secondes de poussée d'un niveau de batterie portable (10 niveaux : 60 s pour une batterie pleine). */
  static readonly BATTERY_STEP_S = 6;
  /** Énergie d'un niveau de batterie portable (kJ) : la poussée consomme `THRUST_KW`. */
  static readonly BATTERY_STEP_KJ = 600;
  /** Énergie reçue d'une borne qui n'a pas encore rempli un niveau (non enregistrée). */
  private batteryBufferKJ = 0;

  /** Une batterie portable du sac n'est pas pleine. */
  hasChargeableBattery(): boolean {
    return allLevels('battery_portable').some(
      (k) => (levelInfo(k)?.level ?? 0) < 10 && (this.inventory[k] ?? 0) > 0,
    );
  }

  /** Reçoit de l'énergie (kJ) : remplit d'abord la batterie portable la plus chargée qui n'est pas pleine. */
  chargeBatteries(kj: number): void {
    this.batteryBufferKJ += kj;
    while (this.batteryBufferKJ >= GameState.BATTERY_STEP_KJ) {
      const unit = allLevels('battery_portable')
        .map((k) => ({ k, level: levelInfo(k)?.level ?? 0 }))
        .filter((x) => x.level < 10 && (this.inventory[x.k] ?? 0) > 0)
        .sort((a, b) => b.level - a.level)[0];
      if (!unit) {
        this.batteryBufferKJ = 0;
        return;
      }
      this.batteryBufferKJ -= GameState.BATTERY_STEP_KJ;
      this.transformItem(unit.k, variantId('battery_portable', unit.level + 1));
    }
  }

  /** Le propulseur dorsal est-il porté ? */
  wearsJetpack(): boolean {
    return this.changes.equipment.back === 'jetpack';
  }

  /** Une poussée de `dt` secondes : prend une batterie lithium du sac quand la précédente est vide. */
  useJetpack(dt: number): boolean {
    if (!this.wearsJetpack()) return false;
    if (this.creative) return true;
    // Les batteries portables (rechargées à une borne) d'abord, puis les batteries lithium du sac.
    if (this.portableSeconds <= 0) {
      const unit = allLevels('battery_portable')
        .map((k) => ({ k, level: levelInfo(k)?.level ?? 0 }))
        .filter((x) => x.level > 0 && (this.inventory[x.k] ?? 0) > 0)
        .sort((a, b) => a.level - b.level)[0];
      if (unit) {
        this.wearItem(unit.k, 1);
        this.portableSeconds = GameState.BATTERY_STEP_S;
      }
    }
    if (this.portableSeconds > 0) {
      this.portableSeconds -= dt;
      return true;
    }
    if (this.jetpackSeconds <= 0) {
      if ((this.inventory.battery_lithium ?? 0) < 1) return false;
      this.inventory = remove(this.inventory, 'battery_lithium', 1).inventory;
      this.jetpackSeconds = GameState.JETPACK_BATTERY_S;
      this.emit({ type: 'inventory' });
    }
    this.jetpackSeconds -= dt;
    return true;
  }

  // --- Machines ------------------------------------------------------------------------------------

  /** Pose une machine ou un élément de tapis (consomme l'objet du sac). */
  placeMachine(
    factory: Factory,
    type: MachineType,
    gx: number,
    gz: number,
    rot: number,
    blocked: (c: Cell) => boolean,
    lift = 0,
    tier = 1,
  ): 'ok' | 'missing' | 'blocked' {
    const def = machineDef(type);
    const item = itemOfTier(def, tier);
    if ((this.inventory[item] ?? 0) < 1) return 'missing';
    if (!factory.canPlace(type, gx, gz, rot, blocked, lift, tier)) return 'blocked';
    this.spend(item, 1);
    // Remplacement d'un tapis (palier, sens, forme gardée) : l'ancien revient dans le sac, ses objets restent sur le nouveau.
    const target = factory.replaceTarget(type, gx, gz, lift, tier, rot);
    if (target) {
      const old = target.old;
      factory.remove(old.id);
      // Un tuyau rompu est jeté : le neuf posé par-dessus est la réparation.
      if (!old.broken)
        this.giveBack(itemOfTier(def, old.tier), 1, {
          x: (gx + 0.5) * CELL_SIZE_M,
          z: (gz + 0.5) * CELL_SIZE_M,
        });
      const fresh = emptyMachine(
        this.changes.nextMachineId++,
        type,
        gx,
        gz,
        rot,
        target.lift,
        tier,
      );
      fresh.belt = old.belt;
      fresh.fluid = old.broken ? fresh.fluid : old.fluid;
      factory.add(fresh);
      this.emit({ type: 'factory' });
      this.emit({ type: 'inventory' });
      return 'ok';
    }
    // Les tapis remplacés (séparateur / groupeur posé sur une ligne) reviennent dans le sac avec leur contenu.
    const at = { x: (gx + 0.5) * CELL_SIZE_M, z: (gz + 0.5) * CELL_SIZE_M };
    for (const belt of factory.replacedBelts(type, gx, gz, rot, lift))
      this.removeMachine(factory, belt.id, at);
    const placed = emptyMachine(this.changes.nextMachineId++, type, gx, gz, rot, lift, tier);
    if (type === 'quantum_chest' && this.playerKey) placed.owner = this.playerKey;
    factory.add(placed);
    this.supportBelt(type, gx, gz, lift);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Remet dans le sac (ou au sol si plein) un tas qui sort d'une machine ou d'une démolition. */
  private giveBack(item: string, count: number, at: { x: number; z: number }): void {
    if (count <= 0) return;
    const fits = Math.min(count, maxAddable(this.inventory, item, this.limits));
    if (fits > 0) this.inventory = add(this.inventory, item, fits);
    if (count - fits > 0) {
      this.changes.drops.push({
        id: `drop-${this.changes.nextDropId++}`,
        item,
        count: count - fits,
        x: at.x,
        z: at.z,
      });
      this.emit({ type: 'drops' });
    }
  }

  /** Assembleur : choisit l'objet à fabriquer ; les ingrédients et le produit en cours reviennent au sac. */
  setRecipe(m: Machine, item: string | null): boolean {
    if (!isAssembler(m.type) && !isSmith(m.type)) return false;
    if (item !== null) {
      if (isSmith(m.type) ? recipeById(item)?.machine !== m.type : !itemById(item).recipe)
        return false;
      // L'assembleur simple fait des recettes à 3 types d'ingrédients au plus, l'avancé à 4.
      if (
        !isSmith(m.type) &&
        Object.keys(itemById(item).recipe ?? {}).length > assemblerMaxTypes(m.type)
      )
        return false;
      // Une recette dont le produit n'est pas encore débloqué (technologie) reste fermée.
      const product = isSmith(m.type) ? Object.keys(recipeById(item)?.out ?? {})[0] : item;
      if (product && !this.isUnlocked(product)) return false;
    }
    const at = { x: m.gx * CELL_SIZE_M, z: m.gz * CELL_SIZE_M };
    for (const stack of [...m.slots, m.stock, m.extra])
      if (stack) this.giveBack(stack.item, stack.count, at);
    m.slots = [];
    m.stock = null;
    m.extra = null;
    m.progress = 0;
    m.recipe = item;
    // Changer de recette rend aussi le moule en réserve (celui qui est engagé se perd).
    if (isSmith(m.type) && m.input && m.input.item !== recipeById(item)?.mould) {
      this.giveBack(m.input.item, m.input.count, at);
      m.input = null;
    }
    m.wear = 0;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return true;
  }

  /** Assembleur : met des ingrédients du sac dans la machine (seulement ceux de la recette). Renvoie la quantité. */
  loadIngredient(m: Machine, item: string, count: number, bagIndex?: number): number {
    const need = recipeOf(m)?.[item];
    if ((m.type !== 'assembler' && !isSmith(m.type)) || !need) return 0;
    const stack = m.slots.find((x) => x.item === item);
    const room = ingredientCap(need) - (stack?.count ?? 0);
    const moved = Math.min(count, this.availableIn(item, bagIndex), room);
    if (moved <= 0) return 0;
    this.takeUnits(item, moved, bagIndex);
    if (stack) stack.count += moved;
    else m.slots.push({ item, count: moved });
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Balles restantes dans l'arme. */
  ammoOf(weapon: WeaponSpec['id'] = 'pistol'): number {
    if (weapon === 'rifle') return this.changes.rifleAmmo;
    if (weapon === 'sniper') return this.changes.sniperAmmo;
    return this.changes.ammo;
  }

  /** Recharge l'arme avec un chargeur du sac. */
  reload(weapon: WeaponSpec['id'] = 'pistol'): 'ok' | 'noMagazine' | 'full' {
    const spec = WEAPONS[weapon];
    if (this.ammoOf(weapon) >= spec.rounds) return 'full';
    if ((this.inventory[spec.magazine] ?? 0) <= 0) return 'noMagazine';
    this.inventory = remove(this.inventory, spec.magazine, 1).inventory;
    if (weapon === 'rifle') this.changes.rifleAmmo = spec.rounds;
    else if (weapon === 'sniper') this.changes.sniperAmmo = spec.rounds;
    else this.changes.ammo = spec.rounds;
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /** Tire une balle ; renvoie faux si l'arme est vide. */
  fire(weapon: WeaponSpec['id'] = 'pistol'): boolean {
    if (this.ammoOf(weapon) <= 0) return false;
    if (weapon === 'rifle') this.changes.rifleAmmo--;
    else if (weapon === 'sniper') this.changes.sniperAmmo--;
    else this.changes.ammo--;
    return true;
  }

  /** Répare un réacteur (fission ou fusion) en panne : demande des composants dans le sac. */
  repairReactor(m: Machine): 'ok' | 'missing' | 'notBroken' {
    if ((m.type !== 'fission_reactor' && m.type !== 'fusion_reactor') || !m.broken)
      return 'notBroken';
    const cost = m.type === 'fusion_reactor' ? FUSION_REPAIR : REACTOR_REPAIR;
    if (!this.creative) {
      for (const [item, n] of Object.entries(cost)) {
        if ((this.inventory[item] ?? 0) < n) return 'missing';
      }
      for (const [item, n] of Object.entries(cost))
        this.inventory = remove(this.inventory, item, n).inventory;
    }
    m.broken = false;
    m.fuelLeft = 0;
    m.progress = 0;
    m.wear = 0;
    m.fluid.dirty = 0;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return 'ok';
  }

  /**
   * Balise hyperfréquence : le relais lance la séquence finale si le plasma de fusion brûle et qu'une antenne est sur
   * le même réseau. Une seule fois par partie ; ensuite la partie continue (le relais devient un comptoir, point 11d).
   */
  activateBeacon(factory: Factory, relay: Machine): 'ok' | 'done' | 'noPlasma' | 'noAntenna' {
    if (this.changes.beacon) return 'done';
    const grid = factory.gridInfo(relay);
    const sameGrid = (m: Machine): boolean => !!grid && factory.gridInfo(m)?.id === grid.id;
    if (!factory.machines.some((m) => factory.fusionOn(m) && sameGrid(m))) return 'noPlasma';
    if (!factory.machines.some((m) => m.type === 'antenna' && sameGrid(m))) return 'noAntenna';
    this.changes.beacon = true;
    this.emit({ type: 'factory' });
    return 'ok';
  }

  /** Vend au comptoir spatial (après la balise) : renvoie les crédits gagnés. */
  sellItem(item: string, count: number): number {
    if (!this.changes.beacon) return 0;
    const n = Math.min(count, this.inventory[item] ?? 0);
    if (n <= 0) return 0;
    this.inventory = remove(this.inventory, item, n).inventory;
    const earned = n * sellPrice(item);
    this.changes.credits += earned;
    this.emit({ type: 'inventory' });
    return earned;
  }

  /** Crédits gagnés par des objets que des tapis ont déposés au relais. */
  creditSale(item: string, count: number): void {
    if (!this.changes.beacon || count <= 0) return;
    this.changes.credits += count * sellPrice(item);
  }

  /** Achète au comptoir : renvoie la quantité achetée (limitée par les crédits et la place dans le sac). */
  buyItem(item: string, count: number): number {
    if (!this.changes.beacon) return 0;
    const price = buyPrice(item);
    const n = Math.min(
      count,
      Math.floor(this.changes.credits / price),
      maxAddable(this.inventory, item, this.limits),
    );
    if (n <= 0) return 0;
    this.changes.credits -= n * price;
    this.inventory = add(this.inventory, item, n);
    this.emit({ type: 'inventory' });
    return n;
  }

  /** Une machine détruite (par des ennemis) : elle disparaît avec son contenu, sans rien rendre. */
  destroyMachine(factory: Factory, id: number): boolean {
    const m = factory.remove(id);
    if (!m) return false;
    this.emit({ type: 'factory' });
    return true;
  }

  /** Démolit une machine : l'objet et son contenu reviennent au joueur. */
  removeMachine(factory: Factory, id: number, at: { x: number; z: number }): boolean {
    const m = factory.remove(id);
    if (!m) return false;
    this.giveBack(itemOfTier(machineDef(m.type), m.tier), 1, at);
    // Le contenu d'un coffre quantique n'est pas dans le coffre : il reste à son joueur.
    const inside = m.type === 'quantum_chest' ? [] : m.slots;
    for (const stack of [m.fuel, m.input, m.stock, m.extra, ...inside])
      if (stack) this.giveBack(stack.item, stack.count, at);
    for (const b of m.belt) this.giveBack(b.item, 1, at);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return true;
  }

  /**
   * Met des objets du sac dans la case de combustible ou d'entrée d'une machine (un seul type par case).
   * Renvoie la quantité déplacée.
   */
  loadMachine(
    m: Machine,
    slot: 'fuel' | 'input',
    item: string,
    count: number,
    bagIndex?: number,
  ): number {
    // Soute d'une locomotive (fenêtre à identifiant spécial) : 50 pièces ; sinon la capacité de la machine.
    const max = isLocoWindow(m.id) ? SOUTE_MAX : slotCap(machineDef(m.type), slot);
    const only = machineDef(m.type).fuelOnly;
    if (
      slot === 'fuel' &&
      ((!machineDef(m.type).fuel && m.id >= 0) ||
        !itemById(item).energyMJ ||
        (only && !only.includes(item)))
    )
      return 0;
    if (
      slot === 'input' &&
      !(isSmith(m.type) && !!item && recipeById(m.recipe)?.mould === item) &&
      !(isTurret(m.type) && item === turretSpec(m.type).ammo) &&
      !(m.type === 'fission_reactor' && item === 'uranium_rod')
    )
      return 0;
    const current: Stack | null = slot === 'fuel' ? m.fuel : m.input;
    if (current && current.item !== item) return 0;
    const moved = Math.min(count, this.availableIn(item, bagIndex), max - (current?.count ?? 0));
    if (moved <= 0) return 0;
    this.takeUnits(item, moved, bagIndex);
    const next = { item, count: (current?.count ?? 0) + moved };
    if (slot === 'fuel') m.fuel = next;
    else m.input = next;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Reprend dans le sac le contenu d'une case de machine (tout ce qui tient). Renvoie la quantité. */
  unloadMachine(m: Machine, slot: 'fuel' | 'input' | 'stock' | 'extra', count = Infinity): number {
    const stack = m[slot];
    if (!stack) return 0;
    const moved = Math.min(count, stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (moved <= 0) return 0;
    this.inventory = add(this.inventory, stack.item, moved);
    stack.count -= moved;
    if (stack.count <= 0) m[slot] = null;
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }

  /** Retire du monde du minerai (l'usine épuise vraiment les cases) ; renvoie la quantité retirée. */
  takeFromWorld(key: string, total: number, units: number): number {
    const n = Math.max(0, Math.min(units, this.remaining(key, total)));
    if (n > 0) this.changes.taken[key] = (this.changes.taken[key] ?? 0) + n;
    return n;
  }

  // --- Mode Créatif : poser et détruire des ressources, corbeille ------------------------------------

  /**
   * Mode Créatif : pose la ressource `resId` (minerai, arbre, rocher, buisson, `water`) avec une quantité tirée au
   * hasard, ancrée en `gx, gz` (la vue a vérifié que la place est libre). Renvoie ce qui a été posé, ou null.
   */
  placeResource(
    resId: string,
    gx: number,
    gz: number,
    seed = Math.random(),
  ): PlacedResource | null {
    if (!this.creative || this.changes.placed.length >= MAX_PLACED) return null;
    const key = cellKey(gx, gz);
    const rnd = (salt: number): number => {
      const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
      return x - Math.floor(x);
    };
    let placed: PlacedResource;
    if (resId === 'water') {
      placed = { id: 'water', gx, gz, amount: 0 };
      // Eau d'origine supprimée plus tôt : elle revient simplement.
      if (this.changes.dried.includes(key)) {
        this.changes.dried = this.changes.dried.filter((k) => k !== key);
        this.emit({ type: 'harvest', key });
        return placed;
      }
    } else {
      let res;
      try {
        res = resourceById(resId);
      } catch {
        return null;
      }
      // Ce qui avait déjà été prélevé sur cette case compte dans la quantité : le reste est celui tiré au hasard.
      const before = this.changes.taken[key] ?? 0;
      if (res.kind === 'deposit') {
        const amount = Math.round(
          CREATIVE_ORE_MIN + rnd(1) * (CREATIVE_ORE_MAX - CREATIVE_ORE_MIN),
        );
        placed = { id: resId, gx, gz, amount: amount + before };
      } else if (res.kind === 'object') {
        let size = 1;
        let amount = res.amount;
        let scale = 0.8 + 0.45 * rnd(2);
        if (res.sizes) {
          const total = res.sizes.reduce((a, x) => a + x.weight, 0);
          let pick = rnd(3) * total;
          size = res.sizes.findIndex((x) => (pick -= x.weight) < 0);
          if (size < 0) size = res.sizes.length - 1;
          amount = res.sizes[size].amount;
          scale = res.sizes[size].scale * (0.92 + 0.16 * rnd(2));
        }
        placed = {
          id: resId,
          gx,
          gz,
          amount: amount + before,
          size,
          scale,
          rotation: rnd(4) * Math.PI * 2,
        };
      } else return null;
    }
    // Une seule ressource posée par case d'ancrage : la nouvelle remplace l'ancienne.
    this.changes.placed = this.changes.placed.filter((p) => !(p.gx === gx && p.gz === gz));
    this.changes.placed.push(placed);
    this.emit({ type: 'harvest', key });
    return placed;
  }

  /**
   * Mode Créatif : détruit la ressource ancrée en `gx, gz` (`total` = sa quantité d'origine) : celle posée en Créatif
   * disparaît, celle du monde d'origine est vidée ; `water` supprime la case d'eau.
   */
  destroyResource(
    kind: 'object' | 'ore' | 'water',
    gx: number,
    gz: number,
    total: number,
  ): boolean {
    if (!this.creative) return false;
    const key = cellKey(gx, gz);
    const i = this.changes.placed.findIndex(
      (p) => p.gx === gx && p.gz === gz && (kind === 'water') === (p.id === 'water'),
    );
    if (i >= 0) this.changes.placed.splice(i, 1);
    else if (kind === 'water') {
      if (!this.changes.dried.includes(key)) this.changes.dried.push(key);
    } else this.changes.taken[key] = Math.max(this.changes.taken[key] ?? 0, total);
    this.emit({ type: 'harvest', key });
    return true;
  }

  /** Corbeille : détruit la pile tenue au bout du curseur. Renvoie la quantité détruite. */
  trashHand(): number {
    const h = this.hand;
    if (!h) return 0;
    this.hand = null;
    this.emit({ type: 'inventory' });
    return h.count;
  }

  /** Corbeille : détruit la pile n° `index` du sac. Renvoie la quantité détruite. */
  trashBagSlot(index: number): number {
    const s = this.clearBagSlot(index);
    if (!s) return 0;
    this.inventory = remove(this.inventory, s.item, s.count).inventory;
    this.emit({ type: 'inventory' });
    return s.count;
  }

  /** Range des objets du sac dans un coffre (jusqu'à `count`). Renvoie la quantité rangée. */
  putInChest(machine: Machine, item: string, count: number, bagIndex?: number): number {
    const m = this.chestOf(machine);
    // Un wagon de fret : la charge utile et le volume limitent, en plus des cases.
    const car = isCargoWindow(m.id) ? this.carById(carIdOfCargo(m.id)) : null;
    const n = Math.min(
      count,
      this.availableIn(item, bagIndex),
      chestRoom(m, item),
      car ? this.cargoRoom(car, item) : Infinity,
    );
    if (n <= 0) return 0;
    const stored = chestPut(m, item, n);
    this.takeUnits(item, stored, bagIndex);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return stored;
  }

  /** Reprend dans le sac la pile n° `index` d'un coffre (tout ce qui tient). Renvoie la quantité. */
  takeFromChest(machine: Machine, index: number, count = Infinity): number {
    const m = this.chestOf(machine);
    const stack = m.slots[index];
    if (!stack) return 0;
    const moved = Math.min(count, stack.count, maxAddable(this.inventory, stack.item, this.limits));
    if (moved <= 0) return 0;
    this.inventory = add(this.inventory, stack.item, moved);
    stack.count -= moved;
    if (stack.count <= 0) m.slots.splice(index, 1);
    this.emit({ type: 'factory' });
    this.emit({ type: 'inventory' });
    return moved;
  }
}
