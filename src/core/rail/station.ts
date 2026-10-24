/**
 * Stations : un point d'arrêt nommé sur la voie, où un convoi sous pilote automatique vient s'arrêter (voir
 * `docs/trains-programmation.md`). Le point est repéré comme un train : une pièce du graphe et une abscisse.
 */
import { baseId, lengthOfPiece, type RailPiece } from './track';

export interface Station {
  id: number;
  name: string;
  /** Pièce du graphe (identifiant négatif : voie déviée d'un aiguillage). */
  piece: number;
  /** Abscisse (m) depuis le port 0 de la pièce. */
  u: number;
}

export const MAX_STATIONS = 200;
export const STATION_NAME_MAX = 24;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Nom nettoyé : espaces en trop retirés, longueur limitée. */
export const cleanStationName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().slice(0, STATION_NAME_MAX);

/** Relit les stations enregistrées ; ignore celles qui ne sont plus sur une pièce de voie. */
export function normalizeStations(raw: unknown, rails: readonly RailPiece[]): Station[] {
  if (!Array.isArray(raw)) return [];
  const out: Station[] = [];
  const ids = new Set<number>();
  for (const r of raw.slice(0, MAX_STATIONS)) {
    if (typeof r !== 'object' || r === null) continue;
    const s = r as Record<string, unknown>;
    const { id, piece, u } = s;
    if (!isNum(id) || !isNum(piece) || !isNum(u) || ids.has(id) || id < 1) continue;
    const base = rails.find((p) => p.id === baseId(piece));
    if (!base) continue;
    ids.add(id);
    out.push({
      id: Math.floor(id),
      name: cleanStationName(typeof s.name === 'string' ? s.name : '') || `Station ${id}`,
      piece: base.id,
      u: Math.max(0, Math.min(lengthOfPiece(base), u)),
    });
  }
  return out;
}
