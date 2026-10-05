/**
 * Hasard déterministe : même entrée = même résultat, partout. Aucun Math.random() dans le core.
 * Les positions (cases, chunks, candidats) sont des entiers 32 bits.
 */

/** Transforme le texte de seed en nombre 32 bits (algorithme xmur3). Espaces de bord ignorés. */
export function hashSeed(seed: string): number {
  const text = seed.trim().normalize('NFC');
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function finalMix(input: number): number {
  let h = input;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Entier 32 bits non signé dépendant de (seed, a, b, salt). */
export function hash(seed: number, a: number, b: number, salt: number): number {
  let h = (seed ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
  h = finalMix(h ^ Math.imul(a | 0, 0x27d4eb2d));
  h = finalMix(h ^ Math.imul(b | 0, 0x165667b1));
  return h;
}

/** Nombre dans [0, 1) dépendant de (seed, a, b, salt). */
export function hash01(seed: number, a: number, b: number, salt: number): number {
  return hash(seed, a, b, salt) / 4294967296;
}

/** Sel stable à partir d'un texte (par exemple l'id d'une ressource). */
export function saltOf(text: string): number {
  return hashSeed(`salt:${text}`);
}
