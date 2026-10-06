/**
 * Pollution et ennemis. Les machines qui travaillent polluent ; le nuage se répand lentement, les arbres
 * l'absorbent, et les nids qui en absorbent fabriquent des ennemis qui viennent attaquer les polluants.
 * Tout ici est sans rendu : la partie fournit le monde (nids, arbres) et applique les dégâts.
 */

/** Côté d'une cellule de pollution (m) : 4 × 4 chunks. */
export const POLLUTION_CELL_M = 32;

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
}

export interface ThreatWorld {
  /** Nids (positions en mètres) dans une cellule de pollution. */
  nestsIn(pcx: number, pcz: number): { x: number; z: number }[];
  /** Arbres dans une cellule de pollution (ils absorbent). */
  treesIn(pcx: number, pcz: number): number;
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
}

export interface Damage {
  target: string;
  amount: number;
}

// Réglages (secondes, mètres, points de pollution).
const ABSORB_BASE = 0.05;
const ABSORB_PER_TREE = 0.01;
const SPREAD_MIN = 6;
const SPREAD_SHARE = 0.04;
const SPREAD_EVERY_S = 2;
const NEST_ABSORB_PER_S = 1.5;
const SPAWN_COST = 20;
const SPAWN_COST_AGGRESSIVE = 12;
const MAX_ENEMIES = 25;
export const ENEMY_HP = 25;
const ENEMY_SPEED = 3.2;
const ENEMY_SPEED_AGGRESSIVE = 4;
const SEE_MACHINE_M = 160;
const SEE_PLAYER_M = 9;
const SEE_PLAYER_AGGRESSIVE_M = 28;
const REACH_M = 1.1;
const MACHINE_DPS = 6;
const PLAYER_HIT = 10;
const PLAYER_HIT_EVERY_S = 1.2;
const GIVE_UP_S = 90;

export const cellOf = (m: number): number => Math.floor(m / POLLUTION_CELL_M);
const key = (pcx: number, pcz: number): string => `${pcx},${pcz}`;

export class Threat {
  readonly enemies: Enemy[] = [];
  private nextId = 1;
  private readonly charge = new Map<string, number>();
  private clock = 0;
  private spreadClock = 0;
  private rngState = 12345;

  /** `pollution` est l'objet enregistré avec la partie (modifié sur place). */
  constructor(
    readonly pollution: Record<string, number>,
    private readonly world: ThreatWorld,
    private readonly options: ThreatOptions,
  ) {}

  private random(): number {
    // Petit générateur déterministe : pas de Math.random() dans la simulation.
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 0x100000000;
  }

  at(pcx: number, pcz: number): number {
    return this.pollution[key(pcx, pcz)] ?? 0;
  }

  /** Une machine pollue à l'endroit (x, z) en mètres. */
  emit(x: number, z: number, amount: number): void {
    if (amount <= 0) return;
    const k = key(cellOf(x), cellOf(z));
    this.pollution[k] = (this.pollution[k] ?? 0) + amount;
  }

  total(): number {
    return Object.values(this.pollution).reduce((a, b) => a + b, 0);
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

  /** Avance de `dt` secondes ; renvoie les dégâts infligés par les ennemis. */
  update(dt: number, targets: ThreatTarget[]): Damage[] {
    this.clock += dt;
    this.spreadClock += dt;
    while (this.clock >= 1) {
      this.clock -= 1;
      this.secondStep();
    }
    return this.moveEnemies(dt, targets);
  }

  /** Une seconde de pollution : absorption naturelle, nids, étalement. */
  private secondStep(): void {
    const cost = this.options.aggressive ? SPAWN_COST_AGGRESSIVE : SPAWN_COST;
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
            const c = (this.charge.get(nk) ?? 0) + take;
            if (c >= cost && this.enemies.length < MAX_ENEMIES) {
              this.charge.set(nk, c - cost);
              this.spawn(nest.x, nest.z);
            } else this.charge.set(nk, c);
          }
        }
      }
      p -= ABSORB_BASE + ABSORB_PER_TREE * this.world.treesIn(pcx, pcz);
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

  private spawn(x: number, z: number): void {
    this.enemies.push({
      id: this.nextId++,
      x: x + (this.random() - 0.5) * 2,
      z: z + (this.random() - 0.5) * 2,
      hp: ENEMY_HP,
      cooldown: 0,
      idle: 0,
      target: null,
    });
  }

  private moveEnemies(dt: number, targets: ThreatTarget[]): Damage[] {
    const damage: Damage[] = [];
    const speed = this.options.aggressive ? ENEMY_SPEED_AGGRESSIVE : ENEMY_SPEED;
    const seePlayer = this.options.aggressive ? SEE_PLAYER_AGGRESSIVE_M : SEE_PLAYER_M;
    for (const e of [...this.enemies]) {
      e.cooldown = Math.max(0, e.cooldown - dt);
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
