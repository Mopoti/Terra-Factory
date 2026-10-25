import raw from '../../../content/recipes.json';

/** Machines à recette choisie dans leur fenêtre (comme l'assembleur, mais avec des recettes propres). */
export type SmithType =
  | 'furnace'
  | 'stamper'
  | 'crusher'
  | 'bessemer'
  | 'mixer'
  | 'barreler'
  | 'builder'
  | 'furnace_electric'
  | 'plastic_press'
  | 'centrifuge'
  | 'vitrifier'
  | 'heavy_press'
  | 'washer';

export interface Recipe {
  id: string;
  machine: SmithType;
  /** Ingrédients : objet -> quantité par cycle. */
  in: Record<string, number>;
  /** Produit : un seul objet et sa quantité par cycle. */
  out: Record<string, number>;
  /** Durée d'un cycle (s). */
  seconds: number;
  /** Fluide de la recette : `amount` > 0 est puisé dans la machine, < 0 y est versé (remplisseuse de barils). */
  fluid?: {
    kind: 'water' | 'steam' | 'hot' | 'oil' | 'polymer' | 'dirty';
    amount: number;
    minBar?: number;
  };
  /** Moule exigé (estampeuse). */
  mould?: string;
}

export const RECIPES: Recipe[] = raw.recipes as unknown as Recipe[];
/** Nombre de cycles qu'un moule supporte avant de se briser. */
export const MOULD_CYCLES: number = raw.mouldCycles;

export const recipeById = (id: string | null | undefined): Recipe | null =>
  RECIPES.find((r) => r.id === id) ?? null;

export const recipesFor = (machine: string): Recipe[] =>
  RECIPES.filter((r) => r.machine === machine);

/** Sous-produit (second objet de `out`, ex. la scorie du Bessemer), s'il y en a un. */
export const recipeByproduct = (r: Recipe): { item: string; count: number } | null => {
  const second = Object.entries(r.out)[1];
  return second ? { item: second[0], count: second[1] } : null;
};

/** Machines qui n'ont qu'une recette : elle est choisie d'office. */
export const AUTO_RECIPE: Partial<Record<string, string>> = {
  crusher: 'crushed_stone',
  bessemer: 'steel',
  plastic_press: 'plastic',
  mixer: 'concrete',
};

/** Produit (objet, quantité) d'une recette. */
export const recipeProduct = (r: Recipe): { item: string; count: number } => {
  const [item, count] = Object.entries(r.out)[0];
  return { item, count };
};

/** Les moules : objets fabriqués par une recette de fourneau et exigés par une recette d'estampeuse. */
export const MOULD_ITEMS: string[] = [
  ...new Set(RECIPES.flatMap((r) => (r.mould ? [r.mould] : []))),
];
