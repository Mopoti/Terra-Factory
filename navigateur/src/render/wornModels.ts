/**
 * Équipement porté sur le personnage (`blender/scripts/porte.py`) : le modèle `porte_<forme>.glb` de chaque objet qui
 * en a un. Ses pièces sont accrochées aux os du personnage (`Avatar.wear`) ; les objets sans modèle porté gardent leur
 * forme simple (boîte colorée, `gameView.ts`).
 */
const WORN_MODELS: Record<string, string> = {
  backpack: 'porte_sac_a_dos',
  hood: 'porte_capuche',
  jacket: 'porte_veste',
  trousers: 'porte_pantalon',
  boots: 'porte_bottes',
  exoskeleton: 'porte_exosquelette',
  jetpack: 'porte_propulseur',
  // Armures 1 à 5 : casque, plastron, jambières, bottes.
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].flatMap((n) =>
      (
        [
          ['head', 'casque'],
          ['torso', 'plastron'],
          ['legs', 'jambieres'],
          ['feet', 'bottes'],
        ] as const
      ).map(([slot, shape]) => [`armor${n}_${slot}`, `porte_armure${n}_${shape}`]),
    ),
  ),
};

/** Objets portés à la tête qui cachent les cheveux. */
const HIDES_HAIR = new Set(['hood', ...[1, 2, 3, 4, 5].map((n) => `armor${n}_head`)]);

/** Nom du modèle porté d'un objet (sans dossier ni extension), ou null s'il n'en a pas. */
export const wornModelName = (item: string): string | null => WORN_MODELS[item] ?? null;

/** Cet objet porté cache-t-il les cheveux ? */
export const wornHidesHair = (item: string): boolean => HIDES_HAIR.has(item);

/** Les gants n'ont pas de modèle à part : ils teintent les mains gantées du personnage. */
export const isGloves = (item: string): boolean => item === 'gloves';
