import raw from '../../../content/buildings.json';

export type PieceKind = 'wall' | 'door' | 'floor' | 'ceiling';
/** Emplacement occupé : un bord de case (mur ou porte), le sol ou le plafond d'une case. */
export type PieceSlot = 'edge' | 'floor' | 'ceiling';

export interface PieceDef {
  kind: PieceKind;
  slot: PieceSlot;
  color: string;
  /** Objet du sac consommé à la pose (1 unité) et rendu au démontage. */
  item: string;
}

export const PIECES: PieceDef[] = raw.pieces as unknown as PieceDef[];
export const PIECE_KINDS: PieceKind[] = PIECES.map((p) => p.kind);
/** Hauteur d'un étage (m). */
export const STOREY_HEIGHT_M: number = raw.storeyHeightM;
/** Épaisseur des murs, sols et plafonds (m). */
export const THICKNESS_M: number = raw.thicknessM;
/** Portée de construction (m). */
export const BUILD_REACH_M: number = raw.reachM;
/** Au-delà, un espace fermé n'est plus considéré comme une pièce (calcul borné). */
export const MAX_ROOM_CELLS: number = raw.maxRoomCells;

export function pieceDef(kind: PieceKind): PieceDef {
  const def = PIECES.find((p) => p.kind === kind);
  if (!def) throw new Error(`Pièce inconnue : ${kind}`);
  return def;
}
