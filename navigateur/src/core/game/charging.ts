/** Bornes de recharge : elles remplissent les batteries des véhicules électriques et les batteries portables du joueur qui sont à portée. */
import { centerOf, type Factory } from '../factory/factory';
import { machineDef } from '../data/machines';
import { CARS } from '../data/trains';
import { VEHICLES } from '../data/vehicles';
import { carPoses } from '../rail/train';
import type { GameState } from './state';

/** Portée d'une borne (m), mesurée depuis son centre. */
export const CHARGE_RANGE_M = 4;

interface Target {
  /** Ajoute `kW × dt` d'énergie ; renvoie ce qui reste à charger (0 = plein). */
  give(kw: number, dt: number): void;
  needs(): boolean;
}

/**
 * Un pas de recharge : chaque borne alimentée partage sa puissance entre les cibles à portée qui ne sont pas pleines.
 * Elle ne consomme du courant que s'il y a une cible (`factory.chargerBusy`), avec un pas de retard sur la demande.
 */
export function stepChargers(
  state: GameState,
  factory: Factory,
  players: { x: number; z: number }[],
  dt: number,
): void {
  for (const m of factory.machines) {
    if (m.type !== 'charger') continue;
    const c = centerOf(m);
    const near = (x: number, z: number, extra = 0): boolean =>
      Math.hypot(x - c.x, z - c.z) <= CHARGE_RANGE_M + extra;
    const targets: Target[] = [];
    for (const v of state.changes.vehicles) {
      const spec = VEHICLES[v.kind];
      if (!spec.electric || !near(v.x, v.z, spec.widthM)) continue;
      const cap = spec.batterySeconds ?? 0;
      targets.push({
        needs: () => v.fuel < cap,
        give: (kw, step) => {
          v.fuel = Math.min(cap, v.fuel + (kw * step) / spec.burnKw);
        },
      });
    }
    // Locomotives électriques : la batterie (`heatKJ`) se remplit à la puissance de la borne.
    if (state.changes.trains.length > 0) {
      const graph = state.railGraph();
      for (const consist of state.changes.trains) {
        if (!consist.cars.some((car) => CARS[car.kind].loco?.electric)) continue;
        for (const pose of carPoses(graph, consist)) {
          const loco = CARS[pose.car.kind].loco;
          if (!loco?.electric || !near(pose.x, pose.z, 3)) continue;
          const car = pose.car;
          const cap = loco.batteryKJ ?? 0;
          targets.push({
            needs: () => car.heatKJ < cap,
            give: (kw, step) => {
              car.heatKJ = Math.min(cap, car.heatKJ + kw * step);
            },
          });
        }
      }
    }
    if (players.some((p) => near(p.x, p.z))) {
      targets.push({
        needs: () => state.hasChargeableBattery(),
        give: (kw, step) => {
          state.chargeBatteries(kw * step);
        },
      });
    }
    const needy = targets.filter((t) => t.needs());
    if (needy.length === 0) {
      factory.chargerBusy.delete(m.id);
      continue;
    }
    factory.chargerBusy.add(m.id);
    const share = ((machineDef('charger').chargeKw ?? 0) * factory.powerFactor(m)) / needy.length;
    for (const t of needy) t.give(share, dt);
  }
}
