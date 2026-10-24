/** Armes à feu du joueur : munitions (chargeur), balles par chargeur, dégâts par balle et cadence. */
export interface WeaponSpec {
  id: 'pistol' | 'rifle' | 'sniper';
  /** Objet « chargeur » consommé à la recharge. */
  magazine: string;
  rounds: number;
  damage: number;
  /** Secondes entre deux tirs (maintenir le clic tire en continu). */
  every: number;
  /** Portée du tir (m). */
  range: number;
  /** Dispersion du tir sans visée (rad) : 0 = toujours précis. Le clic droit maintenu (visée) l'annule. */
  hipSpread: number;
  /** Champ de vision (°) en visée à la lunette, ou null si l'arme ne permet pas de viser. */
  scopeFov: number | null;
}

export const WEAPONS: Record<WeaponSpec['id'], WeaponSpec> = {
  pistol: {
    id: 'pistol',
    magazine: 'magazine',
    rounds: 12,
    damage: 10,
    every: 0.35,
    range: 40,
    hipSpread: 0,
    scopeFov: null,
  },
  rifle: {
    id: 'rifle',
    magazine: 'rifle_magazine',
    rounds: 30,
    damage: 9,
    every: 0.12,
    range: 55,
    hipSpread: 0,
    scopeFov: null,
  },
  sniper: {
    id: 'sniper',
    magazine: 'sniper_magazine',
    rounds: 5,
    damage: 60,
    every: 1.3,
    range: 140,
    hipSpread: 0.09,
    scopeFov: 14,
  },
};

export const isWeapon = (id: unknown): id is WeaponSpec['id'] =>
  id === 'pistol' || id === 'rifle' || id === 'sniper';
