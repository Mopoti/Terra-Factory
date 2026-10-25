import { isAssembler, isDrill, isSmith, machineDef, type MachineType } from '../data/machines';
import { itemById } from '../data/items';
import { recipeById } from '../data/recipes';

/** Une ligne de flux : un objet ou un fluide, en unités par seconde. */
export interface FlowLine {
  kind: 'item' | 'fluid';
  /** Identifiant de l'objet, ou du fluide (`water`, `oil`, `polymer`, `steam`, `hot`, `dirty`). */
  id: string;
  perSec: number;
}

/** Ce que consomme, travaille et rejette une machine à pleine marche (débits théoriques par seconde). */
export interface MachineRates {
  /** Électricité consommée (kW) et produite (kW), combustible brûlé (kW) : 0 s'il n'y en a pas. */
  consumeKw: number;
  produceKw: number;
  burnKw: number;
  /** Recette en cours : identifiant (ou objet fabriqué pour l'assembleur) et durée d'un cycle (s). */
  recipe: { id: string; seconds: number } | null;
  inputs: FlowLine[];
  outputs: FlowLine[];
  /** Pollution émise (points par seconde) et son type. */
  pollution: { kind: 'air' | 'ground'; perSec: number } | null;
  /** Eau contaminée rejetée (L/s). */
  dirtyWaterPerSec: number;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const item = (id: string, perSec: number): FlowLine => ({
  kind: 'item',
  id,
  perSec: round(perSec),
});
const fluid = (id: string, perSec: number): FlowLine => ({
  kind: 'fluid',
  id,
  perSec: round(perSec),
});

/**
 * Débits d'une machine à pleine marche, tirés des définitions (`machines.json`, `recipes.json`) et de la recette
 * choisie. `recipe` : la recette de la machine (fourneau, estampeuse, presse… : identifiant de `recipes.json` ;
 * assembleur : objet fabriqué).
 */
export function machineRates(type: MachineType, recipe: string | null, tier = 1): MachineRates {
  const def = machineDef(type);
  const out: MachineRates = {
    consumeKw: def.consumesKw ?? 0,
    produceKw: def.producesKw ?? 0,
    burnKw: def.fuel ? (def.burnKw ?? 0) : 0,
    recipe: null,
    inputs: [],
    outputs: [],
    pollution:
      (def.pollution ?? 0) > 0
        ? { kind: def.pollutionKind ?? 'air', perSec: def.pollution ?? 0 }
        : null,
    dirtyWaterPerSec: 0,
  };
  const dirty = (n: number): void => {
    out.dirtyWaterPerSec = n;
    out.outputs.push(fluid('dirty', n));
  };
  if (isSmith(type)) {
    const r = recipeById(recipe);
    if (r) {
      out.recipe = { id: r.id, seconds: r.seconds };
      for (const [id, n] of Object.entries(r.in)) out.inputs.push(item(id, n / r.seconds));
      for (const [id, n] of Object.entries(r.out)) out.outputs.push(item(id, n / r.seconds));
      if (r.fluid) {
        const flow = fluid(r.fluid.kind, Math.abs(r.fluid.amount) / r.seconds);
        (r.fluid.amount > 0 ? out.inputs : out.outputs).push(flow);
        if (r.fluid.kind === 'dirty' && r.fluid.amount < 0) out.dirtyWaterPerSec = flow.perSec;
      }
    }
  } else if (isAssembler(type) && recipe) {
    const seconds = def.craftSeconds ?? 2;
    const need = itemById(recipe).recipe ?? {};
    out.recipe = { id: recipe, seconds };
    for (const [id, n] of Object.entries(need)) out.inputs.push(item(id, n / seconds));
    out.outputs.push(item(recipe, itemById(recipe).yield / seconds));
  } else if (isDrill(type)) {
    out.outputs.push({ kind: 'item', id: 'ore', perSec: round(1 / (def.mineSeconds ?? 1)) });
  } else if (type === 'pump') out.outputs.push(fluid('water', def.pumpRate ?? 100));
  else if (type === 'pumpjack') out.outputs.push(fluid('oil', def.pumpRate ?? 1));
  else if (type === 'refinery') {
    out.inputs.push(fluid('oil', def.pumpRate ?? 10));
    out.outputs.push(fluid('polymer', def.pumpRate ?? 10));
  } else if (type === 'boiler') {
    out.inputs.push(fluid('water', def.boilRate ?? 60));
    out.outputs.push(fluid('steam', def.boilRate ?? 60));
  } else if (type === 'turbine') out.inputs.push(fluid('steam', def.steamUse ?? 20));
  else if (type === 'fission_reactor') {
    out.inputs.push(fluid('water', 20));
    dirty(20);
  } else if (type === 'evaporation_tower') out.inputs.push(fluid('dirty', def.coolRate ?? 20));
  else if (type === 'cooling_tower') {
    out.inputs.push(fluid('hot', def.coolRate ?? 20));
    out.outputs.push(fluid('water', def.coolRate ?? 20));
  } else if (type === 'conveyor') {
    const speeds = def.tierSpeeds ?? [def.cellsPerSecond ?? 1];
    const cells = speeds[Math.min(tier, speeds.length) - 1] ?? 1;
    // Un objet par case et par seconde environ : l'ordre de grandeur suffit pour comparer les paliers.
    out.outputs.push({ kind: 'item', id: 'belt', perSec: round(cells * (def.capacity ?? 1)) });
  }
  // Refroidissement à l'eau (four électrique, constructeur) : de l'eau froide entre, de l'eau chaude sort.
  if (def.coolLitersPerS && def.coolBoost) {
    out.inputs.push(fluid('water', def.coolLitersPerS));
    out.outputs.push(fluid('hot', def.coolLitersPerS));
  }
  return out;
}
