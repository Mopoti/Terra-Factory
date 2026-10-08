import { describe, expect, it } from 'vitest';
import { MACHINE_ANIM, MACHINE_MODELS, splitModel, type BakedModel } from './models';
import { MACHINES } from '../core/data/machines';

const files = Object.keys(import.meta.glob('../../public/models/kenney/**/*', { query: '?url' }));
const has = (name: string): boolean => files.some((f) => f.endsWith(`/kenney/${name}`));

describe('modèles 3D des machines', () => {
  it('chaque modèle cité existe dans public/models/kenney, avec la licence et la palette', () => {
    for (const [type, name] of Object.entries(MACHINE_MODELS)) {
      expect(has(`${name}.glb`), `${type} → ${name}`).toBe(true);
    }
    expect(has('License.txt')).toBe(true);
    expect(has('Textures/colormap.png')).toBe(true);
  });

  it('seules des machines qui existent ont un modèle', () => {
    const ids = new Set(MACHINES.map((m) => m.id as string));
    for (const type of Object.keys(MACHINE_MODELS)) expect(ids.has(type), type).toBe(true);
  });

  it('une machine articulée a un modèle', () => {
    for (const type of Object.keys(MACHINE_ANIM)) expect(MACHINE_MODELS, type).toHaveProperty(type);
  });

  it('couper un modèle en deux ne perd aucun triangle et sépare le haut du bas', () => {
    // Deux triangles : l'un posé au sol, l'autre à 1 m.
    const model: BakedModel = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1]),
      normals: new Float32Array(18),
      colors: new Float32Array(18),
      index: new Uint32Array([0, 1, 2, 3, 4, 5]),
      size: { x: 1, y: 1, z: 1 },
      min: { x: 0, y: 0, z: 0 },
    };
    const { low, high } = splitModel(model, 0.5);
    expect([...low.index]).toEqual([0, 1, 2]);
    expect([...high.index]).toEqual([3, 4, 5]);
    expect(low.size).toEqual(model.size); // même repère : les deux parties s'ajustent comme le modèle entier
  });
});
