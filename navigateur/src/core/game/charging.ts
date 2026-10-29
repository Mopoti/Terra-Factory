/** Bornes de recharge : elles remplissent les batteries des véhicules électriques et les batteries portables du joueur qui sont à portée. */
import { centerOf, type Factory } from '../factory/factory';
import { machineDef } from '../data/machines';
import { VEHICLES } from '../data/vehicles';
import type { GameState } from './state';

/** Portée d'une borne (m), mesurée depuis son centre. */
export const CHARGE_RANGE_M = 4;
/** Puissance (kW) que consomme la poussée du propulseur : une batterie portable de 60 s tient 6 MJ. */
export const THRUST_KW = 100;

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
    if (players.some((p) => near(p.x, p.z))) {
      targets.push({
        needs: () => state.changes.batteryS < state.batteryCapacityS(),
        give: (kw, step) => {
          state.chargeBatteries((kw * step) / THRUST_KW);
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
