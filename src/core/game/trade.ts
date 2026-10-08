/**
 * Comptoir commercial spatial (après la balise) : tous les objets et toutes les ressources se vendent et s'achètent
 * contre des crédits galactiques. La valeur d'un objet se déduit de sa fabrication ; on vend à la moitié de la valeur
 * et on achète à une fois et demie (arrondis dans le sens du comptoir), donc jamais de gain en achetant puis revendant.
 */
import { ITEMS, itemById } from '../data/items';
import { RECIPES } from '../data/recipes';

/** Valeur de base (crédits) des ressources brutes ; toute autre ressource brute vaut `DEFAULT_RAW`. */
const RAW_VALUE: Record<string, number> = {
  wood: 1,
  stone: 1,
  fiber: 1,
  silica_sand: 1,
  coal: 2,
  iron_ore: 2,
  copper_ore: 2,
  zinc_ore: 3,
  bauxite: 4,
  crude_oil: 2,
  uraninite: 25,
  slag: 1,
  nuclear_waste: 30,
  uranium_depleted: 5,
};
const DEFAULT_RAW = 3;
const SMITH_MARKUP = 1.3;
const CRAFT_MARKUP = 1.25;

const cache = new Map<string, number>();

/** Valeur (crédits, non arrondie) d'une unité de cet objet. */
export function itemValue(id: string, depth = 0): number {
  const known = cache.get(id);
  if (known !== undefined) return known;
  if (depth > 12) return DEFAULT_RAW;
  let value: number;
  const def = itemById(id);
  if (RAW_VALUE[id] !== undefined) value = RAW_VALUE[id];
  else if (def.recipe) {
    const sum = Object.entries(def.recipe).reduce(
      (s, [i, n]) => s + n * itemValue(i, depth + 1),
      0,
    );
    value = (sum / def.yield) * CRAFT_MARKUP + 1;
  } else {
    // Produit d'une machine à recette (lingots, plaques, uranium…) : ingrédients / quantité produite.
    const r = RECIPES.find((x) => Object.keys(x.out)[0] === id || x.out[id] !== undefined);
    if (r) {
      const sum = Object.entries(r.in).reduce((s, [i, n]) => s + n * itemValue(i, depth + 1), 0);
      value = (sum / (r.out[id] ?? 1)) * SMITH_MARKUP;
    } else value = DEFAULT_RAW;
  }
  value = Math.max(1, value);
  if (depth === 0) cache.set(id, value);
  return value;
}

/** Crédits obtenus en vendant une unité. */
export const sellPrice = (id: string): number => Math.max(1, Math.floor(itemValue(id) * 0.5));
/** Crédits demandés pour acheter une unité. */
export const buyPrice = (id: string): number => Math.max(1, Math.ceil(itemValue(id) * 1.5));

/** Tout est en vente, sauf les machines au sol déjà posées : le catalogue du comptoir. */
export const TRADABLE: string[] = ITEMS.map((i) => i.id);
