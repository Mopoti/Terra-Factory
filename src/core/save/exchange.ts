import { normalizeGame, type GameSummary } from './saveIndex';

/** Format des fichiers d'échange (export / import d'une partie). */
export const EXCHANGE_FORMAT = 'terra-factory-game';
export const EXCHANGE_VERSION = 1;
/** Au-delà, on refuse le fichier (probablement pas une partie). */
export const MAX_IMPORT_BYTES = 80 * 1024 * 1024;

export interface ExchangeFile {
  format: typeof EXCHANGE_FORMAT;
  version: number;
  exportedAt: number;
  game: GameSummary;
}

export type ParseResult =
  | { ok: true; game: GameSummary }
  | { ok: false; reason: 'invalid' | 'format' | 'newer' | 'empty' | 'tooBig' };

export function buildExchange(game: GameSummary, now = Date.now()): ExchangeFile {
  return {
    format: EXCHANGE_FORMAT,
    version: EXCHANGE_VERSION,
    exportedAt: now,
    game: structuredClone(game),
  };
}

/** Lit et valide le texte d'un fichier d'échange. Ne modifie rien : renvoie une partie propre. */
export function parseExchange(text: string): ParseResult {
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, reason: 'tooBig' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'invalid' };
  const file = data as Record<string, unknown>;
  if (file.format !== EXCHANGE_FORMAT) return { ok: false, reason: 'format' };
  if (typeof file.version !== 'number' || !Number.isFinite(file.version))
    return { ok: false, reason: 'invalid' };
  if (file.version > EXCHANGE_VERSION) return { ok: false, reason: 'newer' };
  const game = file.game as { world?: { seed?: unknown } } | null;
  // Une partie sans seed ne peut pas être recréée : on ne devine rien.
  if (typeof game?.world?.seed !== 'string') return { ok: false, reason: 'invalid' };
  const [clean] = normalizeGame(file.game);
  return clean ? { ok: true, game: clean } : { ok: false, reason: 'invalid' };
}

const supportsGzip = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Contenu du fichier à télécharger : JSON compressé (gzip) si le navigateur sait le faire. */
export async function encodeExchange(file: ExchangeFile): Promise<Blob> {
  const json = new Blob([JSON.stringify(file)], { type: 'application/json' });
  if (!supportsGzip()) return json;
  const stream = json.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** Texte contenu dans un fichier d'échange, compressé ou non (détecté à son en-tête). */
export async function decodeExchange(bytes: ArrayBuffer): Promise<string> {
  if (bytes.byteLength > MAX_IMPORT_BYTES) return '';
  const head = new Uint8Array(bytes.slice(0, 2));
  const gzipped = head[0] === 0x1f && head[1] === 0x8b;
  if (gzipped) {
    if (!supportsGzip()) return '';
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}

/** Nom de fichier proposé : « terra-factory-ma-base.terra ». */
export function exchangeFileName(game: GameSummary): string {
  const slug = game.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `terra-factory-${slug || 'partie'}.terra`;
}
