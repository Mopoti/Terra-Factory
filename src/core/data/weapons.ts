/** Armes à feu du joueur : munitions (chargeur), balles par chargeur, dégâts par balle et cadence. */
export interface WeaponSpec {
  id: 'pistol' | 'rifle';
  /** Objet « chargeur » consommé à la recharge. */
  magazine: string;
  rounds: number;
  damage: number;
  /** Secondes entre deux tirs (maintenir le clic tire en continu). */
  every: number;
  /** Portée du tir (m). */
  range: number;
}

export const WEAPONS: Record<WeaponSpec['id'], WeaponSpec> = {
  pistol: { id: 'pistol', magazine: 'magazine', rounds: 12, damage: 10, every: 0.35, range: 40 },
  rifle: { id: 'rifle', magazine: 'rifle_magazine', rounds: 30, damage: 9, every: 0.12, range: 55 },
};

export const isWeapon = (id: unknown): id is WeaponSpec['id'] => id === 'pistol' || id === 'rifle';
