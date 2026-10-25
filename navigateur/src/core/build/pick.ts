import { CELL_SIZE_M } from '../constants';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  RISE_DIR,
  STOREY_HEIGHT_M,
  THICKNESS_M,
} from '../data/buildings';
import { pieceKey, type Pieces } from './pieces';

type Vec = { x: number; y: number; z: number };

export interface PickedPiece {
  /** Distance le long du rayon (m). */
  t: number;
  key: string;
  /** Centre approximatif (m), pour la portée. */
  x: number;
  z: number;
}

/**
 * Premier élément de construction touché par un rayon : bloc de mur, porte, dalle de sol ou de plafond,
 * marche d'escalier. Sert à viser un objet pour le démolir en le frappant.
 */
export function pickPiece(
  pieces: Pieces,
  origin: Vec,
  dir: Vec,
  maxDist: number,
): PickedPiece | null {
  if (Object.keys(pieces).length === 0) return null;
  const margin = THICKNESS_M / 2 + 0.01;
  for (let t = 0.1; t <= maxDist; t += 0.04) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    if (y < 0) return null;
    const level = Math.floor(y / STOREY_HEIGHT_M);
    if (level > 9) continue;
    const rel = y - level * STOREY_HEIGHT_M;
    const layer = Math.min(LAYERS_PER_STOREY - 1, Math.floor(rel / LAYER_HEIGHT_M));
    const gx = Math.floor(x / CELL_SIZE_M);
    const gz = Math.floor(z / CELL_SIZE_M);
    const hit = (key: string): PickedPiece => ({ t, key, x, z });

    // Murs et portes : bords de case à moins de la demi-épaisseur.
    const gxn = Math.round(x / CELL_SIZE_M);
    const gzn = Math.round(z / CELL_SIZE_M);
    const edges: Array<[string, number]> = [];
    if (Math.abs(x - gxn * CELL_SIZE_M) <= margin) {
      edges.push([`e:${level}:${gxn},${gz}:z`, Math.abs(x - gxn * CELL_SIZE_M)]);
    }
    if (Math.abs(z - gzn * CELL_SIZE_M) <= margin) {
      edges.push([`e:${level}:${gx},${gzn}:x`, Math.abs(z - gzn * CELL_SIZE_M)]);
    }
    for (const [base] of edges.sort((a, b) => a[1] - b[1])) {
      const door = `${base}:0`;
      if (pieces[door]?.startsWith('door')) return hit(door);
      const block = `${base}:${layer}`;
      if (pieces[block]) return hit(block);
    }
    // Pilier de soutènement (colonne de 30 cm au centre de la case).
    if (
      Math.abs(x - (gx + 0.5) * CELL_SIZE_M) <= 0.17 &&
      Math.abs(z - (gz + 0.5) * CELL_SIZE_M) <= 0.17
    ) {
      for (let l = LAYERS_PER_STOREY - 1; l >= 0; l--) {
        const key = pieceKey({ slot: 'pillar', level, gx, gz, layer: l });
        if (pieces[key] && rel <= (l + 1) * LAYER_HEIGHT_M) return hit(key);
      }
    }
    // Dalles : plafond (dessus du bloc `l`), sol.
    for (let l = 0; l < LAYERS_PER_STOREY; l++) {
      const top = (l + 1) * LAYER_HEIGHT_M + 0.003;
      if (rel <= top && rel >= top - THICKNESS_M) {
        const key = pieceKey({ slot: 'ceiling', level, gx, gz, layer: l });
        if (pieces[key]) return hit(key);
      }
    }
    if (rel <= THICKNESS_M) {
      const key = pieceKey({ slot: 'floor', level, gx, gz });
      if (pieces[key]) return hit(key);
    }
    // Marches : sous la pente de la case.
    for (let r = 0; r < 4; r++) {
      const key = pieceKey({ slot: 'stairs', level, gx, gz, layer, rot: r });
      if (!pieces[key]) continue;
      const [dx, dz] = RISE_DIR[r];
      const fx = x / CELL_SIZE_M - gx;
      const fz = z / CELL_SIZE_M - gz;
      const along = dx !== 0 ? (dx > 0 ? fx : 1 - fx) : dz > 0 ? fz : 1 - fz;
      if (rel <= (layer + along) * LAYER_HEIGHT_M) return hit(key);
    }
  }
  return null;
}
