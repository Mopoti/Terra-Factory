import { describe, expect, it } from 'vitest';
import { parseTree } from './nature';

const files = import.meta.glob('../../public/models/nature/tree.obj', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('arbre du décor', () => {
  it('lit le fichier OBJ : sommets, coordonnées de texture, faces, hauteur et pied du tronc', () => {
    const tree = parseTree(Object.values(files)[0]);
    expect(tree.positions.length / 3).toBe(tree.uvs.length / 2);
    expect(tree.index.length % 3).toBe(0);
    expect(Math.max(...tree.index)).toBeLessThan(tree.positions.length / 3);
    expect(tree.height).toBeGreaterThan(10);
    expect(tree.normals.every(Number.isFinite)).toBe(true);
  });
});
