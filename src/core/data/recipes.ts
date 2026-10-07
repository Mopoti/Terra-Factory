import raw from '../../../content/recipes.json';

/** Machines à recette choisie dans leur fenêtre (comme l'assembleur, mais avec des recettes propres). */
export type SmithType = 'furnace' | 'stamper' | 'crusher';

export interface Recipe {
  id: string;
  machine: SmithType;
  /** Ingrédients : objet -> quantité par cycle. */
  in: Record<string, number>;
  /** Produit : un seul objet et sa quantité par cycle. */
  out: Record<string, number>;
  /** Durée d'un cycle (s). */
  seconds: number;
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

/** Produit (objet, quantité) d'une recette. */
export const recipeProduct = (r: Recipe): { item: string; count: number } => {
  const [item, count] = Object.entries(r.out)[0];
  return { item, count };
};

/** Les moules : objets fabriqués par une recette de fourneau et exigés par une recette d'estampeuse. */
export const MOULD_ITEMS: string[] = [
  ...new Set(RECIPES.flatMap((r) => (r.mould ? [r.mould] : []))),
];
