/**
 * Simulation du monde à pas fixe (20 pas par seconde), sans aucun affichage : usine, laboratoires, comptoir,
 * pollution, ennemis, tourelles. C'est ce que l'hôte d'une partie multijoueur fait tourner ; chaque joueur n'y
 * apparaît que par sa position. Ce qui concerne UN joueur (ses points de vie, ses coups) reste côté joueur :
 * la simulation renvoie des événements (dégâts reçus, machine perdue…) que chacun applique.
 */
import { CELL_SIZE_M } from '../constants';
import { machineDef, isTurret, turretSpec } from '../data/machines';
import { dims, type Factory, type Machine } from '../factory/factory';
import { emptyFluid } from '../factory/fluids';
import type { GameState } from './state';
import type { Threat, ThreatTarget } from './threat';

/** Durée d'un pas de simulation (s) : fixe, pour que tous les joueurs voient la même chose. */
export const SIM_STEP_S = 0.05;
/** Points de vie d'une machine attaquée par des ennemis. */
export const MACHINE_HEALTH = 120;

export interface SimPlayer {
  id: string;
  x: number;
  z: number;
}

export type SimEvent =
  | { type: 'playerHit'; player: string; amount: number }
  | { type: 'machineLost'; id: number }
  | { type: 'machineAcid'; id: number }
  | { type: 'pipeBurst'; id: number }
  | { type: 'turretShot'; id: number; kill: boolean }
  | { type: 'produced'; item: string; count: number }
  | { type: 'autoStudy'; tech: string };

const centerOf = (m: Machine): { x: number; z: number } => {
  const { w, d } = dims(m.type, m.rot);
  return { x: (m.gx + w / 2) * CELL_SIZE_M, z: (m.gz + d / 2) * CELL_SIZE_M };
};

export class WorldSimulation {
  private acc = 0;
  private pollutionClock = 0;
  private targetClock = 0;
  private threatTargets: ThreatTarget[] = [];
  private acidTargets: ThreatTarget[] = [];
  private readonly machineHealth = new Map<number, number>();
  private readonly brokenSeen: Set<number>;

  constructor(
    readonly state: GameState,
    readonly factory: Factory,
    readonly threat: Threat,
  ) {
    this.brokenSeen = new Set(factory.machines.filter((m) => m.broken).map((m) => m.id));
  }

  /**
   * Avance de `dt` secondes réelles en pas fixes de 0,05 s (au plus 10 pas par appel). Renvoie les événements survenus.
   * `players` : position de chaque joueur connecté (un seul en solo).
   */
  advance(dt: number, players: SimPlayer[]): SimEvent[] {
    this.acc = Math.min(this.acc + dt, 0.5);
    const events: SimEvent[] = [];
    while (this.acc >= SIM_STEP_S) {
      this.acc -= SIM_STEP_S;
      this.step(players, events);
    }
    return events;
  }

  /** Un pas de simulation. */
  step(players: SimPlayer[], events: SimEvent[]): void {
    const { state, factory } = this;
    const dt = SIM_STEP_S;
    // Un laboratoire qui a des paquets mais pas d'étude choisie lance la première technologie disponible.
    if (
      !state.changes.researching &&
      factory.machines.some((m) => m.type === 'lab' && factory.hasPacks(m))
    ) {
      const tech = state.autoStudy();
      if (tech) events.push({ type: 'autoStudy', tech });
    }
    factory.tradeOpen = state.changes.beacon;
    factory.labDemand = state.studyRemaining();
    factory.labNeeds = state.studyNeeds();
    factory.tick(dt);
    state.addStudy(factory.takeLabPacks());
    for (const [item, n] of factory.takeSold()) state.creditSale(item, n);
    for (const [item, n] of factory.takeProduced()) {
      state.countProduced(item, n);
      events.push({ type: 'produced', item, count: n });
    }
    for (const m of factory.machines) {
      if (!m.broken) this.brokenSeen.delete(m.id);
      else if (!this.brokenSeen.has(m.id)) {
        this.brokenSeen.add(m.id);
        if (m.type === 'pipe') events.push({ type: 'pipeBurst', id: m.id });
      }
    }
    this.threatStep(dt, players, events);
    state.changes.time += dt;
  }

  private threatStep(dt: number, players: SimPlayer[], events: SimEvent[]): void {
    const { state, factory, threat } = this;
    // Les machines qui travaillent polluent (une fois par seconde).
    this.pollutionClock += dt;
    if (this.pollutionClock >= 1) {
      this.pollutionClock -= 1;
      for (const m of factory.machines) {
        const rate = factory.pollutionRate(m);
        if (rate > 0) {
          const c = centerOf(m);
          threat.emit(c.x, c.z, rate, machineDef(m.type).pollutionKind ?? 'air');
        }
        // L'extraction d'uraninite pollue le sol de radioactivité.
        if (m.stock?.item === 'uraninite' && factory.status(m) === 'running') {
          const c = centerOf(m);
          threat.emit(c.x, c.z, 2, 'ground');
        }
      }
      // Les tours d'évaporation en marche font muter les nids voisins.
      threat.toxicSources = factory.machines.filter((m) => factory.evaporating(m)).map(centerOf);
    }
    this.targetClock += dt;
    if (this.targetClock >= 0.5) {
      this.targetClock = 0;
      this.threatTargets = factory.machines
        .filter((m) => (machineDef(m.type).pollution ?? 0) > 0)
        .map((m) => ({ id: `machine:${m.id}`, ...centerOf(m) }));
      this.acidTargets = factory.machines
        .filter((m) => (m.type === 'conveyor' || m.type === 'pipe') && !m.broken)
        .map((m) => ({ id: `machine:${m.id}`, ...centerOf(m) }));
    }
    // Mode Créatif : les ennemis ignorent les joueurs.
    const targets: ThreatTarget[] = [
      ...this.threatTargets,
      ...(state.creative ? [] : players.map((p) => ({ id: p.id, x: p.x, z: p.z }))),
    ];
    for (const hit of threat.update(dt, targets, this.acidTargets)) {
      if (hit.acid) {
        const id = Number(hit.target.slice(8));
        const m = factory.machines.find((x) => x.id === id);
        if (m && !m.broken) {
          m.broken = true;
          m.fluid = emptyFluid();
          events.push({ type: 'machineAcid', id });
        }
      } else if (hit.target.startsWith('machine:')) {
        const id = Number(hit.target.slice(8));
        const left = (this.machineHealth.get(id) ?? MACHINE_HEALTH) - hit.amount;
        if (left <= 0) {
          this.machineHealth.delete(id);
          if (state.destroyMachine(factory, id)) events.push({ type: 'machineLost', id });
        } else this.machineHealth.set(id, left);
      } else events.push({ type: 'playerHit', player: hit.target, amount: hit.amount });
    }
    // Les nids proches de chaque joueur gardent leurs gardiens.
    if (!state.creative) for (const p of players) threat.keepGuards(p.x, p.z, dt);
    // Tourelles automatiques : elles tirent sur l'ennemi le plus proche à portée tant qu'elles ont des balles.
    if (threat.enemies.length > 0) {
      for (const m of factory.machines) {
        if (!isTurret(m.type)) continue;
        m.progress = Math.max(0, m.progress - dt);
        if (m.progress > 0 || !factory.turretReady(m)) continue;
        const c = centerOf(m);
        const spec = turretSpec(m.type);
        const result = threat.hit(c.x, c.z, spec.range, spec.damage);
        if (!result) continue;
        factory.turretTake(m);
        m.progress = spec.every;
        events.push({ type: 'turretShot', id: m.id, kill: result === 'kill' });
      }
    }
  }
}
