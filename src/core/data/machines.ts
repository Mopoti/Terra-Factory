import raw from '../../../content/machines.json';

export type MachineType = 'drill' | 'furnace' | 'conveyor';

export interface MachineDef {
  id: MachineType;
  /** Emprise en cases de 50 cm, orientation 0 (largeur x profondeur). */
  w: number;
  d: number;
  /** Objet du sac consommé à la pose et rendu (en ressources de fabrication) à la démolition. */
  item: string;
  color: string;
  /** Brûle du combustible pour fonctionner. */
  fuel: boolean;
  burnPerSecond?: number;
  /** Foreuse : secondes par minerai extrait. */
  mineSeconds?: number;
  /** Capacité de la case de stockage. */
  stockMax?: number;
  /** Tapis : cases par seconde et nombre d'objets portés par case. */
  cellsPerSecond?: number;
  capacity?: number;
}

export interface SmeltRecipe {
  in: string;
  out: string;
  seconds: number;
}

export const MACHINES: MachineDef[] = raw.machines as MachineDef[];
export const SMELTING: SmeltRecipe[] = raw.smelting;

export function machineDef(type: MachineType): MachineDef {
  const def = MACHINES.find((m) => m.id === type);
  if (!def) throw new Error(`Machine inconnue : ${type}`);
  return def;
}

/** Quelle machine correspond à cet objet du sac, s'il en est une. */
export const machineForItem = (item: string | null): MachineDef | null =>
  MACHINES.find((m) => m.item === item) ?? null;

export const smeltRecipe = (input: string): SmeltRecipe | null =>
  SMELTING.find((r) => r.in === input) ?? null;
