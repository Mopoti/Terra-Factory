import raw from '../../../content/buildings.json';

export type PieceType = 'wall' | 'door' | 'floor' | 'ceiling' | 'slab' | 'stairs';
export type Material = 'wood' | 'stone';
/** Identifiant d'une pièce : type + matériau, par exemple « wall_stone ». */
export type PieceKind = `${PieceType}_${Material}`;
/** Emplacement occupé : un bord de case (mur ou porte), le sol ou le plafond d'une case. */
export type PieceSlot = 'edge' | 'floor' | 'ceiling' | 'stairs';

export interface PieceDef {
  id: PieceKind;
  type: PieceType;
  material: Material;
  color: string;
  /** Objet du sac consommé à la pose (1 unité) et rendu au démontage. */
  item: string;
}

export const PIECES: PieceDef[] = raw.pieces as PieceDef[];
export const PIECE_TYPES: PieceType[] = ['wall', 'door', 'slab', 'stairs'];
export const MATERIALS: Material[] = ['wood', 'stone'];
/** Hauteur d'un étage (m) et d'un bloc de mur (m) : 5 blocs par étage. */
export const STOREY_HEIGHT_M: number = raw.storeyHeightM;
export const LAYER_HEIGHT_M: number = raw.layerHeightM;
export const LAYERS_PER_STOREY = Math.round(raw.storeyHeightM / raw.layerHeightM);
/** Épaisseur des murs, sols et plafonds (m). */
export const THICKNESS_M: number = raw.thicknessM;
/** Portée de construction (m). */
export const BUILD_REACH_M: number = raw.reachM;
/** Au-delà, un espace fermé n'est plus considéré comme une pièce (calcul borné). */
export const MAX_ROOM_CELLS: number = raw.maxRoomCells;

export function pieceDef(kind: PieceKind): PieceDef {
  const def = PIECES.find((p) => p.id === kind);
  if (!def) throw new Error(`Pièce inconnue : ${kind}`);
  return def;
}

export const isPieceKind = (v: unknown): v is PieceKind => PIECES.some((p) => p.id === v);

export const slotOf = (type: PieceType): PieceSlot =>
  type === 'wall' || type === 'door' ? 'edge' : type === 'slab' ? 'floor' : type;

/**
 * Une dalle est un seul objet : posée au sol ou entre des murs elle fait un sol, posée sur le haut d'un mur un
 * plafond. Renvoie la pièce réellement posée (sol ou plafond) pour l'emplacement visé ; les autres pièces
 * restent telles quelles.
 */
export function resolveKind(kind: PieceKind, slot: PieceSlot): PieceKind {
  const def = pieceDef(kind);
  if (def.type !== 'slab') return kind;
  return `${slot === 'ceiling' ? 'ceiling' : 'floor'}_${def.material}` as PieceKind;
}

/** Direction de montée d'une marche selon son orientation (quarts de tour) : [dx, dz] en cases. */
export const RISE_DIR: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** La pièce de ce type dans ce matériau, ou à défaut dans un autre (une porte n'existe qu'en bois). */
export function kindFor(type: PieceType, material: Material): PieceKind {
  const found =
    PIECES.find((p) => p.type === type && p.material === material) ??
    PIECES.find((p) => p.type === type);
  if (!found) throw new Error(`Type inconnu : ${type}`);
  return found.id;
}
