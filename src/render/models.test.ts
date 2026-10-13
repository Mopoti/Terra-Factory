import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ANIMATED_MESHES,
  bake,
  MACHINE_ANIM,
  MACHINE_MODELS,
  splitModel,
  type BakedModel,
} from './models';
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

describe('parties animées (flamme_*, coeur_*)', () => {
  const mesh = (name: string, geometry: THREE.BufferGeometry, y = 0): THREE.Mesh => {
    const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff8800 }));
    m.name = name;
    m.position.y = y;
    return m;
  };
  const scene = (): THREE.Group => {
    const g = new THREE.Group();
    g.add(mesh('cuve', new THREE.BoxGeometry(2, 1, 2), 0.5));
    g.add(mesh('flamme_1', new THREE.ConeGeometry(0.2, 0.6, 6), 0.3));
    g.add(mesh('flamme_2', new THREE.ConeGeometry(0.2, 0.6, 6), 0.3));
    g.add(mesh('coeur_1', new THREE.ConeGeometry(0.1, 0.3, 6), 0.15));
    return g;
  };
  const triangles = (g: THREE.BufferGeometry): number => (g.getIndex()?.count ?? 0) / 3;

  it('sépare les flammes du corps sans perdre un triangle', () => {
    const root = scene();
    const total = root.children.reduce((n, c) => n + triangles((c as THREE.Mesh).geometry), 0);
    const model = bake(root, ['flamme', 'coeur']) as BakedModel;
    const flames = model.flames;
    expect(flames).toBeDefined();
    expect(flames?.groups).toHaveLength(3);
    expect(model.index.length / 3 + (flames?.index.length ?? 0) / 3).toBe(total);
    expect(model.index.length / 3).toBe(triangles(new THREE.BoxGeometry(2, 1, 2)));
    // Les indices des flammes restent dans leurs propres sommets, chaque groupe a son pied.
    const count = (flames?.positions.length ?? 0) / 3;
    expect(Math.max(...(flames?.index ?? [0]))).toBeLessThan(count);
    for (const g of flames?.groups ?? []) {
      expect(g.py).toBeGreaterThan(-0.001);
      expect(g.first + g.count).toBeLessThanOrEqual(count);
    }
    // L'enveloppe reste celle du modèle entier.
    expect(model.size.y).toBeCloseTo(1, 5);
  });

  it('reconnaît aussi un maillage dont le parent porte le nom', () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    parent.name = 'Flamme_groupe';
    parent.add(mesh('cone', new THREE.ConeGeometry(0.2, 0.6, 6)));
    root.add(mesh('cuve', new THREE.BoxGeometry(1, 1, 1)), parent);
    expect(bake(root, ['flamme'])?.flames?.groups).toHaveLength(1);
  });

  it('un modèle sans flammes, ou sans préfixes, est inchangé', () => {
    const plain = new THREE.Group();
    plain.add(mesh('cuve', new THREE.BoxGeometry(2, 1, 2), 0.5));
    const a = bake(plain, ['flamme', 'coeur']) as BakedModel;
    const b = bake(plain) as BakedModel;
    expect(a.flames).toBeUndefined();
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.index)).toEqual(Array.from(b.index));
    // Sans préfixes, le même modèle avec flammes les garde dans le corps (rendu des modèles du kit inchangé).
    const c = bake(scene()) as BakedModel;
    expect(c.flames).toBeUndefined();
  });

  it('les préfixes animés sont en minuscules et visent de vraies machines', () => {
    const ids = new Set(MACHINES.map((m) => m.id as string));
    for (const [type, prefixes] of Object.entries(ANIMATED_MESHES)) {
      expect(ids.has(type), type).toBe(true);
      for (const p of prefixes ?? []) expect(p).toBe(p.toLowerCase());
    }
  });
});
