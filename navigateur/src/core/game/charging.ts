/** Bornes de recharge : elles remplissent les batteries des véhicules électriques et les batteries portables du joueur qui sont à portée. */
import { centerOf, type Factory, type Machine } from '../factory/factory';
import { baseOf, levelInfo, variantId } from '../data/itemData';
import { machineDef } from '../data/machines';
import { CARS } from '../data/trains';
import { VEHICLES } from '../data/vehicles';
import { carPoses } from '../rail/train';
import { GameState } from './state';

/** Portée d'une borne (m), mesurée depuis son centre. */
export const CHARGE_RANGE_M = 4;

interface Target {
  /** Ajoute `kW × dt` d'énergie ; renvoie ce qui reste à charger (0 = plein). */
  give(kw: number, dt: number): void;
  needs(): boolean;
}

/** Énergie reçue (kJ) par chaque borne qui n'a pas encore rempli un niveau d'une batterie rangée dedans. */
const slotBuffer = new WeakMap<Machine, number>();

/** Une batterie portable rangée dans la borne n'est pas pleine. */
const slotBatteryNeeds = (m: Machine): boolean =>
  m.slots.some(
    (s) => baseOf(s.item) === 'battery_portable' && (levelInfo(s.item)?.level ?? 10) < 10,
  );

/** Reçoit de l'énergie (kJ) : remplit d'abord la batterie rangée dans la borne qui est la plus chargée sans être pleine. */
function chargeSlots(m: Machine, kj: number): void {
  let buffer = (slotBuffer.get(m) ?? 0) + kj;
  while (buffer >= GameState.BATTERY_STEP_KJ) {
    const unit = m.slots
      .filter((s) => baseOf(s.item) === 'battery_portable' && (levelInfo(s.item)?.level ?? 10) < 10)
      .sort((a, b) => (levelInfo(b.item)?.level ?? 0) - (levelInfo(a.item)?.level ?? 0))[0];
    if (!unit) {
      buffer = 0;
      break;
    }
    buffer -= GameState.BATTERY_STEP_KJ;
    unit.item = variantId('battery_portable', (levelInfo(unit.item)?.level ?? 0) + 1);
  }
  slotBuffer.set(m, buffer);
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
    // Les batteries rangées dans la borne se rechargent en tout temps ; celles du sac, quand le joueur est à portée.
    targets.push({
      needs: () => slotBatteryNeeds(m),
      give: (kw, step) => chargeSlots(m, kw * step),
    });
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
    const share =
      Math.min(machineDef('charger').chargeKw ?? 0, factory.chargerKw(m)) / needy.length;
    for (const t of needy) t.give(share, dt);
  }
}
