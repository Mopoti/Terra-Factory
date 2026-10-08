/**
 * Pollution et ennemis. Les machines qui travaillent polluent ; le nuage se répand lentement, les arbres
 * l'absorbent, et les nids qui en absorbent fabriquent des ennemis qui viennent attaquer les polluants.
 * Tout ici est sans rendu : la partie fournit le monde (nids, arbres) et applique les dégâts.
 */

/** Côté d'une cellule de pollution (m) : 4 × 4 chunks. */
export const POLLUTION_CELL_M = 32;

/** Variantes : éclaireur (léger, rapide), gardien (lourd, lent, protège le nid), cracheur (statique, acide à distance). */
export type EnemyKind = 'scout' | 'guard' | 'spitter';

export interface Enemy {
  id: number;
  x: number;
  z: number;
  hp: number;
  /** Secondes avant la prochaine attaque. */
  cooldown: number;
  /** Secondes passées sans cible. */
  idle: number;
  /** Cible suivie (identifiant), ou null. */
  target: string | null;
  /** Variante (absente dans une ancienne sauvegarde : gardien s'il a un nid, sinon éclaireur). */
  kind?: EnemyKind;
  /** Mutant : né près d'une tour d'évaporation, plus gros et plus résistant. */
  mutant?: boolean;
  /** Gardien ou cracheur : reste près de son nid. */
  home?: { x: number; z: number };
}

export interface ThreatWorld {
  /** Nids (positions en mètres) dans une cellule de pollution. */
  nestsIn(pcx: number, pcz: number): { x: number; z: number }[];
  /** Arbres dans une cellule de pollution (ils absorbent). */
  treesIn(pcx: number, pcz: number): number;
  /** Nids (positions en mètres) à moins de `radiusM` mètres du point. */
  nestsNear(x: number, z: number, radiusM: number): { x: number; z: number }[];
  /** Crée un nid près de ce point (m) ; le monde refuse s'il est trop près du départ, d'une base, de l'eau… */
  addNest?(x: number, z: number): boolean;
}

export interface ThreatTarget {
  /** « player » ou « machine:ID ». */
  id: string;
  x: number;
  z: number;
}

export interface ThreatOptions {
  /** Ennemis agressifs : ils attaquent aussi le joueur de loin et se fabriquent plus vite. */
  aggressive: boolean;
  /** Les colonies s'étendent : un nid qui se nourrit assez de pollution en fonde un autre. */
  expand?: boolean;
}

export interface Damage {
  target: string;
  amount: number;
  /** Acide de cracheur : abîme un tapis ou un tuyau (au lieu de le détruire). */
  acid?: boolean;
}

export const kindOf = (e: Enemy): EnemyKind => e.kind ?? (e.home ? 'guard' : 'scout');

/** Points de vie et vitesse (m/s) de chaque variante. */
export const ENEMY_STATS: Record<EnemyKind, { hp: number; speed: number }> = {
  scout: { hp: 25, speed: 4.5 },
  guard: { hp: 80, speed: 2 },
  spitter: { hp: 40, speed: 0 },
};

// Réglages (secondes, mètres, points de pollution).
const ABSORB_BASE = 0.05;
const ABSORB_PER_TREE = 0.01;
const SPREAD_MIN = 6;
const SPREAD_SHARE = 0.04;
const SPREAD_EVERY_S = 2;
const NEST_ABSORB_PER_S = 3;
const SPAWN_COST = 12;
const SPAWN_COST_AGGRESSIVE = 8;
const MAX_ENEMIES = 25;
/** Pollution absorbée par un nid avant qu'il fonde un nouveau nid, distance du nouveau nid (m). */
export const EXPAND_COST = 600;
const EXPAND_MIN_M = 25;
const EXPAND_MAX_M = 45;
/** Les nids à moins de cette distance (m) d'une vapeur toxique mutent ; points de vie des mutants ×. */
export const TOXIC_RANGE_M = 90;
export const MUTANT_HP_FACTOR = 2;
/** Part des ennemis nés de la pollution qui sont des cracheurs. */
const SPITTER_SHARE = 0.2;
const AGGRESSIVE_SPEED_FACTOR = 1.2;
/** Cracheur : portée de l'acide (m) et délai entre deux jets (s). */
const ACID_RANGE_M = 20;
const ACID_EVERY_S = 4;
/** Gardien : zone qu'il défend autour du nid (m) et dégâts par seconde sur une machine. */
const GUARD_ZONE_M = 90;
const GUARD_MACHINE_DPS = 10;
const SEE_MACHINE_M = 160;
const SEE_PLAYER_M = 24;
const SEE_PLAYER_AGGRESSIVE_M = 45;
const REACH_M = 1.1;
const MACHINE_DPS = 6;
const PLAYER_HIT = 10;
const PLAYER_HIT_EVERY_S = 1.2;
const GIVE_UP_S = 150;
const GROUND_ABSORB = 0.01;
const GUARDS_PER_NEST = 3;
const GUARD_WAKE_M = 90;
const GUARD_SEE_M = 30;
const GUARD_LEASH_M = GUARD_ZONE_M;
const GUARD_RESPAWN_S = 40;

export const cellOf = (m: number): number => Math.floor(m / POLLUTION_CELL_M);
const key = (pcx: number, pcz: number): string => `${pcx},${pcz}`;

export class Threat {
  /** Ennemis en vie : le tableau enregistré avec la partie (modifié sur place). */
  readonly enemies: Enemy[];
  /** Part de l'absorption des arbres (saison). */
  treeFactor = 1;
  private nextId = 1;
  private readonly charge = new Map<string, number>();
  private clock = 0;
  private spreadClock = 0;
  private rngState = 12345;

  /** `pollution` (air) et `ground` (sol) sont les objets enregistrés avec la partie (modifiés sur place). */
  constructor(
    readonly pollution: Record<string, number>,
    readonly ground: Record<string, number>,
    private readonly world: ThreatWorld,
    private readonly options: ThreatOptions,
    saved: Enemy[] = [],
  ) {
    this.enemies = saved;
    this.nextId = saved.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  /** Tours d'évaporation en marche (positions en mètres) : les nids proches donnent des mutants. */
  toxicSources: { x: number; z: number }[] = [];

  /** Secondes avant que le nid (clé) refasse un gardien. */
  private readonly guardTimer = new Map<string, number>();

  private random(): number {
    // Petit générateur déterministe : pas de Math.random() dans la simulation.
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 0x100000000;
  }

  at(pcx: number, pcz: number): number {
    return this.pollution[key(pcx, pcz)] ?? 0;
  }

  /** Une machine pollue à l'endroit (x, z) en mètres : `air` (fumées, se répand) ou `ground` (sol, reste sur place). */
  emit(x: number, z: number, amount: number, kind: 'air' | 'ground' = 'air'): void {
    if (amount <= 0) return;
    const map = kind === 'air' ? this.pollution : this.ground;
    const k = key(cellOf(x), cellOf(z));
    map[k] = (map[k] ?? 0) + amount;
  }

  groundAt(pcx: number, pcz: number): number {
    return this.ground[key(pcx, pcz)] ?? 0;
  }

  total(): number {
    return (
      Object.values(this.pollution).reduce((a, b) => a + b, 0) +
      Object.values(this.ground).reduce((a, b) => a + b, 0)
    );
  }

  /** Le joueur frappe : touche l'ennemi le plus proche à portée. Renvoie 'kill', 'hit' ou null. */
  hit(x: number, z: number, range: number, damage: number): 'kill' | 'hit' | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return null;
    best.hp -= damage;
    if (best.hp <= 0) {
      this.enemies.splice(this.enemies.indexOf(best), 1);
      return 'kill';
    }
    return 'hit';
  }

  /** Un tir (rayon) : touche l'ennemi le plus proche sur la ligne de tir. Renvoie le résultat et la distance parcourue. */
  shoot(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    range: number,
    damage: number,
  ): { result: 'kill' | 'hit' | null; distance: number } {
    let best: Enemy | null = null;
    let bestAlong = range;
    for (const e of this.enemies) {
      // Le corps de l'ennemi est autour de (x, 0,3, z) ; on cherche le point du rayon le plus proche.
      const wx = e.x - origin.x;
      const wy = 0.3 - origin.y;
      const wz = e.z - origin.z;
      const along = wx * dir.x + wy * dir.y + wz * dir.z;
      if (along < 0 || along > bestAlong) continue;
      const cx = origin.x + dir.x * along - e.x;
      const cy = origin.y + dir.y * along - 0.3;
      const cz = origin.z + dir.z * along - e.z;
      if (Math.hypot(cx, cy, cz) <= 0.6) {
        best = e;
        bestAlong = along;
      }
    }
    if (!best) return { result: null, distance: range };
    best.hp -= damage;
    if (best.hp <= 0) {
      this.enemies.splice(this.enemies.indexOf(best), 1);
      return { result: 'kill', distance: bestAlong };
    }
    return { result: 'hit', distance: bestAlong };
  }

  /** Avance de `dt` secondes ; renvoie les dégâts infligés par les ennemis. */
  update(dt: number, targets: ThreatTarget[], acidTargets: ThreatTarget[] = []): Damage[] {
    this.clock += dt;
    this.spreadClock += dt;
    while (this.clock >= 1) {
      this.clock -= 1;
      this.secondStep();
    }
    return this.moveEnemies(dt, targets, acidTargets);
  }

  /** Une seconde de pollution : absorption naturelle, nids, étalement. */
  private secondStep(): void {
    const cost = this.options.aggressive ? SPAWN_COST_AGGRESSIVE : SPAWN_COST;
    this.groundStep(cost);
    const cells = Object.keys(this.pollution);
    for (const k of cells) {
      const [pcx, pcz] = k.split(',').map(Number);
      let p = this.pollution[k];
      // Les nids des cellules voisines (3 × 3) absorbent et fabriquent des ennemis.
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const nest of this.world.nestsIn(pcx + dx, pcz + dz)) {
            if (p <= 0) break;
            const take = Math.min(p, NEST_ABSORB_PER_S);
            p -= take;
            const nk = `${Math.round(nest.x)},${Math.round(nest.z)}`;
            this.grow(nest, nk, take);
            const c = (this.charge.get(nk) ?? 0) + take;
            if (c >= cost && this.enemies.length < MAX_ENEMIES) {
              this.charge.set(nk, c - cost);
              this.spawn(nest.x, nest.z, this.random() < SPITTER_SHARE ? 'spitter' : 'scout');
            } else this.charge.set(nk, c);
          }
        }
      }
      p -= ABSORB_BASE + ABSORB_PER_TREE * this.treeFactor * this.world.treesIn(pcx, pcz);
      if (p < 0.05) delete this.pollution[k];
      else this.pollution[k] = p;
    }
    if (this.spreadClock >= SPREAD_EVERY_S) {
      this.spreadClock -= SPREAD_EVERY_S;
      const adds: [string, number][] = [];
      for (const k of Object.keys(this.pollution)) {
        const p = this.pollution[k];
        if (p <= SPREAD_MIN) continue;
        const [pcx, pcz] = k.split(',').map(Number);
        const share = p * SPREAD_SHARE;
        this.pollution[k] = p - share * 4;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          adds.push([key(pcx + dx, pcz + dz), share]);
        }
      }
      for (const [k, v] of adds) this.pollution[k] = (this.pollution[k] ?? 0) + v;
    }
  }

  /** Pollution du sol : ne se répand pas, le sol l'absorbe très lentement, les nids voisins s'en nourrissent aussi. */
  private groundStep(cost: number): void {
    for (const k of Object.keys(this.ground)) {
      const [pcx, pcz] = k.split(',').map(Number);
      let p = this.ground[k];
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const nest of this.world.nestsIn(pcx + dx, pcz + dz)) {
            if (p <= 0) break;
            const take = Math.min(p, NEST_ABSORB_PER_S * 0.5);
            p -= take;
            const nk = `${Math.round(nest.x)},${Math.round(nest.z)}`;
            this.grow(nest, nk, take);
            const c = (this.charge.get(nk) ?? 0) + take;
            if (c >= cost && this.enemies.length < MAX_ENEMIES) {
              this.charge.set(nk, c - cost);
              this.spawn(nest.x, nest.z, this.random() < SPITTER_SHARE ? 'spitter' : 'scout');
            } else this.charge.set(nk, c);
          }
        }
      }
      p -= GROUND_ABSORB;
      if (p < 0.05) delete this.ground[k];
      else this.ground[k] = p;
    }
  }

  /** Croissance de chaque colonie : pollution absorbée depuis la dernière fondation (par nid). */
  private readonly growth = new Map<string, number>();

  private grow(nest: { x: number; z: number }, nk: string, taken: number): void {
    if (!this.options.expand || !this.world.addNest) return;
    const g = (this.growth.get(nk) ?? 0) + taken;
    if (g < EXPAND_COST) {
      this.growth.set(nk, g);
      return;
    }
    const a = this.random() * Math.PI * 2;
    const d = EXPAND_MIN_M + this.random() * (EXPAND_MAX_M - EXPAND_MIN_M);
    // Si le monde refuse (eau, base, départ…), on réessaie un peu plus tard, ailleurs.
    const ok = this.world.addNest(nest.x + Math.cos(a) * d, nest.z + Math.sin(a) * d);
    this.growth.set(nk, ok ? 0 : EXPAND_COST * 0.7);
  }

  /** Les nids proches du joueur gardent quelques gardiens ; un gardien tué revient après un moment. */
  keepGuards(playerX: number, playerZ: number, dt: number): void {
    for (const nest of this.world.nestsNear(playerX, playerZ, GUARD_WAKE_M)) {
      const nk = `${Math.round(nest.x)},${Math.round(nest.z)}`;
      const mine = this.enemies.filter(
        (e) =>
          kindOf(e) === 'guard' &&
          e.home &&
          `${Math.round(e.home.x)},${Math.round(e.home.z)}` === nk,
      );
      if (mine.length >= GUARDS_PER_NEST) {
        this.guardTimer.set(nk, GUARD_RESPAWN_S);
        continue;
      }
      const wait = this.guardTimer.get(nk);
      if (wait === undefined) {
        // Première visite : tous les gardiens sont là.
        for (let i = mine.length; i < GUARDS_PER_NEST; i++) this.spawn(nest.x, nest.z, 'guard');
        this.guardTimer.set(nk, GUARD_RESPAWN_S);
      } else if (wait - dt <= 0) {
        this.spawn(nest.x, nest.z, 'guard');
        this.guardTimer.set(nk, GUARD_RESPAWN_S);
      } else this.guardTimer.set(nk, wait - dt);
    }
  }

  private spawn(x: number, z: number, kind: EnemyKind = 'scout'): void {
    const mutant = this.toxicSources.some((s) => Math.hypot(s.x - x, s.z - z) <= TOXIC_RANGE_M);
    this.enemies.push({
      id: this.nextId++,
      x: x + (this.random() - 0.5) * 2,
      z: z + (this.random() - 0.5) * 2,
      hp: ENEMY_STATS[kind].hp * (mutant ? MUTANT_HP_FACTOR : 1),
      kind,
      ...(mutant ? { mutant: true } : {}),
      cooldown: 0,
      idle: 0,
      target: null,
      ...(kind !== 'scout' ? { home: { x, z } } : {}),
    });
  }

  private moveEnemies(dt: number, targets: ThreatTarget[], acidTargets: ThreatTarget[]): Damage[] {
    const damage: Damage[] = [];
    const boost = this.options.aggressive ? AGGRESSIVE_SPEED_FACTOR : 1;
    const seePlayer = this.options.aggressive ? SEE_PLAYER_AGGRESSIVE_M : SEE_PLAYER_M;
    for (const e of [...this.enemies]) {
      e.cooldown = Math.max(0, e.cooldown - dt);
      const kind = kindOf(e);
      const speed = ENEMY_STATS[kind].speed * boost;
      if (kind === 'spitter') {
        // Statique : crache sur le tapis ou le tuyau le plus proche à portée.
        let near: ThreatTarget | null = null;
        let nearD = ACID_RANGE_M;
        for (const t of acidTargets) {
          const d = Math.hypot(t.x - e.x, t.z - e.z);
          if (d <= nearD) {
            near = t;
            nearD = d;
          }
        }
        e.target = near ? near.id : null;
        if (near && e.cooldown <= 0) {
          damage.push({ target: near.id, amount: 1, acid: true });
          e.cooldown = ACID_EVERY_S;
        }
        continue;
      }
      if (e.home) {
        const player = targets.find((t) => t.id === 'player');
        const dHome = Math.hypot(e.x - e.home.x, e.z - e.home.z);
        const dPlayer = player ? Math.hypot(player.x - e.x, player.z - e.z) : Infinity;
        const chase = player && dPlayer <= GUARD_SEE_M && dHome <= GUARD_LEASH_M;
        // Sans joueur à portée, le gardien attaque la machine polluante la plus proche dans sa zone.
        let raid: ThreatTarget | null = null;
        if (!chase) {
          let raidD = GUARD_ZONE_M;
          for (const t of targets) {
            if (t.id === 'player') continue;
            const d = Math.hypot(t.x - e.home.x, t.z - e.home.z);
            if (d <= raidD) {
              raid = t;
              raidD = d;
            }
          }
        }
        const goal = chase ? player : (raid ?? { id: 'home', x: e.home.x, z: e.home.z });
        e.target = chase ? 'player' : raid ? raid.id : null;
        const dx = goal.x - e.x;
        const dz = goal.z - e.z;
        const d = Math.hypot(dx, dz);
        if (chase && d <= REACH_M) {
          if (e.cooldown <= 0) {
            damage.push({ target: 'player', amount: PLAYER_HIT });
            e.cooldown = PLAYER_HIT_EVERY_S;
          }
        } else if (raid && d <= REACH_M) {
          damage.push({ target: raid.id, amount: GUARD_MACHINE_DPS * dt });
        } else if (d > (chase || raid ? REACH_M : 1.5)) {
          const step = Math.min(d, speed * dt);
          e.x += (dx / d) * step;
          e.z += (dz / d) * step;
        }
        continue;
      }
      // Cible : le joueur s'il est proche, sinon l'installation polluante la plus proche.
      let best: ThreatTarget | null = null;
      let bestD = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.x - e.x, t.z - e.z);
        const limit = t.id === 'player' ? seePlayer : SEE_MACHINE_M;
        const score = t.id === 'player' ? d - 6 : d; // le joueur passe un peu avant
        if (d <= limit && score < bestD) {
          best = t;
          bestD = score;
        }
      }
      if (!best) {
        e.target = null;
        e.idle += dt;
        if (e.idle > GIVE_UP_S) this.enemies.splice(this.enemies.indexOf(e), 1);
        continue;
      }
      e.idle = 0;
      e.target = best.id;
      const dx = best.x - e.x;
      const dz = best.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > REACH_M) {
        const step = Math.min(d - REACH_M * 0.9, speed * dt);
        e.x += (dx / d) * step;
        e.z += (dz / d) * step;
      } else if (best.id === 'player') {
        if (e.cooldown <= 0) {
          damage.push({ target: 'player', amount: PLAYER_HIT });
          e.cooldown = PLAYER_HIT_EVERY_S;
        }
      } else {
        damage.push({ target: best.id, amount: MACHINE_DPS * dt });
      }
    }
    return damage;
  }
}
