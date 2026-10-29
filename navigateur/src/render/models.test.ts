import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ANIMATED_MESHES,
  bake,
  MACHINE_ANIM,
  MACHINE_MODELS,
  pipeShape,
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

describe('groupes mobiles (pivot_*)', () => {
  const named = (name: string, y = 0): THREE.Mesh => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    m.name = name;
    m.position.y = y;
    return m;
  };
  const scene = (): THREE.Group => {
    const g = new THREE.Group();
    g.add(named('socle', 0.1));
    g.add(named('foret_mandrin003', 0.5));
    g.add(named('foret_pointe', 0.3));
    g.add(named('foretage', 0.2)); // ressemble, mais n'est pas du groupe
    g.add(named('poulie_boite', 0.9));
    const pivot = new THREE.Object3D();
    pivot.name = 'pivot_foret002';
    pivot.position.set(0.1, 0.4, 0.2);
    pivot.rotation.z = Math.PI / 2; // son axe Y local pointe alors vers −X
    g.add(pivot);
    return g;
  };

  it('sort les groupes du corps fixe et lit leur pivot et leur axe', () => {
    const model = bake(scene(), [], ['foret', 'poulie_boite']) as BakedModel;
    expect(Object.keys(model.groups ?? {}).sort()).toEqual(['foret', 'poulie_boite']);
    const foret = model.groups?.foret;
    expect(foret?.index.length).toBe(2 * 36); // deux boîtes de 12 triangles x 3
    expect(foret?.pivot).toMatchObject({ x: 0.1, y: 0.4, z: 0.2 });
    expect(foret?.axis.x).toBeCloseTo(-1, 5);
    // Le corps garde le socle et « foretage », rien d'autre.
    expect(model.index.length / 3).toBe(2 * 12);
    // Sans nœud pivot : centre des pièces, axe vertical.
    expect(model.groups?.poulie_boite.axis).toMatchObject({ x: 0, y: 1, z: 0 });
    expect(model.groups?.poulie_boite.pivot.y).toBeCloseTo(0.9, 5);
  });

  it('lit le pas d’une boucle (échelle du pivot) et l’accroche du câble', () => {
    const g = scene();
    const pivot = g.getObjectByName('pivot_foret002') as THREE.Object3D;
    pivot.scale.setScalar(0.25);
    const accroche = new THREE.Object3D();
    accroche.name = 'accroche_cable';
    accroche.position.set(0.3, 1.2, -0.1);
    g.add(accroche);
    const model = bake(g, [], ['foret', 'poulie_boite']) as BakedModel;
    expect(model.groups?.foret.step).toBeCloseTo(0.25, 5);
    expect(model.groups?.poulie_boite.step).toBeUndefined();
    expect(model.anchor).toMatchObject({ x: 0.3, y: 1.2, z: -0.1 });
    expect(bake(scene())?.anchor).toBeUndefined();
  });

  it('lit le siège d’un véhicule (nœud vide « siege »)', () => {
    const g = scene();
    const siege = new THREE.Object3D();
    siege.name = 'siege';
    siege.position.set(-0.23, 0.6, -0.2);
    g.add(siege);
    expect(bake(g)?.seat).toMatchObject({ x: -0.23, y: 0.6, z: -0.2 });
    expect(bake(scene())?.seat).toBeUndefined();
  });

  it('sans noms de groupes, le modèle est inchangé', () => {
    const a = bake(scene()) as BakedModel;
    expect(a.groups).toBeUndefined();
    expect(a.index.length / 3).toBe(5 * 12);
  });
});

describe('formes des tuyaux', () => {
  it('choisit la forme et la tourne pour couvrir les côtés raccordés', () => {
    expect(pipeShape([], 0, 2)).toEqual({ form: 'seul', turns: 2 });
    expect(pipeShape([3, 1], 0, 0)).toEqual({ form: 'droit', turns: 0 });
    expect(pipeShape([0, 2], 0, 0).form).toBe('droit');
    expect(pipeShape([2, 0], 0, 0).turns % 2).toBe(1);
    expect(pipeShape([3, 0], 0, 0)).toEqual({ form: 'coude', turns: 0 });
    expect(pipeShape([0, 1], 0, 0)).toEqual({ form: 'coude', turns: 1 });
    expect(pipeShape([1], 0, 0)).toEqual({ form: 'bout', turns: 2 });
    expect(pipeShape([0, 1, 3], 0, 0)).toEqual({ form: 'te', turns: 0 });
    expect(pipeShape([0, 1, 2, 3], 0, 0).form).toBe('croix');
    // Tunnel : entrée (raccord derrière) et sortie (raccord devant).
    expect(pipeShape([], 4, 0)).toEqual({ form: 'regard', turns: 3 });
    expect(pipeShape([], 5, 0)).toEqual({ form: 'regard', turns: 1 });
  });
});

describe('icônes des objets', () => {
  it('chaque objet a son modèle 3D, sauf ceux qui n’en ont pas encore (liste explicite)', async () => {
    const { ITEMS } = await import('../core/data/items');
    const { machineForItem } = await import('../core/data/machines');
    const { HELD_MODELS, NO_MODEL_ITEMS, dropShape, iconModelName } = await import('./dropModels');
    const crates = ITEMS.filter(
      (i) =>
        !i.id.startsWith('res_') &&
        !machineForItem(i.id) &&
        !iconModelName(i.id) &&
        !HELD_MODELS[i.id] &&
        dropShape(i.id) === 'caisse',
    ).map((i) => i.id);
    expect(crates.sort()).toEqual([...NO_MODEL_ITEMS].sort());
  });
});

describe('icônes des machines', () => {
  it('chaque machine du jeu a un modèle prévu (ou une forme à plusieurs modèles : tapis, tuyau)', async () => {
    const { ITEMS } = await import('../core/data/items');
    const { machineForItem } = await import('../core/data/machines');
    const { hasModelPlanned } = await import('./models');
    const missing = ITEMS.flatMap((i) => {
      const m = machineForItem(i.id);
      return m &&
        m.id !== 'conveyor' &&
        m.id !== 'pipe' &&
        !m.barrier &&
        !hasModelPlanned(m.id as never)
        ? [m.id]
        : [];
    });
    expect([...new Set(missing)]).toEqual([]);
  });
});
