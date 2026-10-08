import { describe, expect, it } from 'vitest';
import { MACHINE_MODELS } from './models';
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
});
