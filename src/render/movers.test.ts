import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emptyMachine, Factory } from '../core/factory/factory';
import { FactoryView } from './factoryView';
import { MACHINE_MODELS, registerModel, type BakedModel } from './models';

/** Un petit bloc de 1 m (deux étages de triangles : bas et haut) pour remplacer le vrai modèle. */
const block = (): BakedModel => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1]),
  normals: new Float32Array(18).fill(0.5),
  colors: new Float32Array(18).fill(0.5),
  index: new Uint32Array([0, 1, 2, 3, 4, 5]),
  size: { x: 1, y: 1, z: 1 },
  min: { x: 0, y: 0, z: 0 },
});

const world = { oreAt: () => null, mineOre: () => 0 };

describe('modèles articulés', () => {
  it('le piston de l’estampeuse reste en haut puis s’abat en fin de cycle', () => {
    registerModel(MACHINE_MODELS.stamper as string, block());
    const m = emptyMachine(1, 'stamper', 0, 0, 0);
    m.recipe = 'iron_plate';
    m.fuel = { item: 'coal', count: 30 };
    m.input = { item: 'mould_plate', count: 3 };
    m.slots.push({ item: 'iron_ingot', count: 40 });
    const factory = new Factory([m], world);
    const view = new FactoryView(new THREE.Scene(), factory);
    const mover = (view as unknown as { moverList: { mesh: THREE.Mesh }[] }).moverList[0];
    expect(mover).toBeDefined();
    let low = 0;
    let lowest = 0;
    for (let i = 0; i < 70; i++) {
      factory.tick(0.05);
      view.updateMovers(i * 0.05);
      const f = factory.cycleFraction(m) ?? 0;
      if (f > 0 && f < 0.7) low = Math.min(low, mover.mesh.position.y);
      lowest = Math.min(lowest, mover.mesh.position.y);
    }
    expect(low).toBe(0); // en début de cycle le piston est en haut
    expect(lowest).toBeLessThan(0); // il s'abat à un moment du cycle
    view.dispose();
  });

  it('le bras pivote quand il travaille et revient droit au repos ; la tête du scanner tourne', () => {
    registerModel(MACHINE_MODELS.arm as string, block());
    registerModel(MACHINE_MODELS.lab as string, block());
    const arm = emptyMachine(1, 'arm', 0, 0, 0);
    const lab = emptyMachine(2, 'lab', 6, 0, 0);
    const factory = new Factory([arm, lab], world);
    let state: 'running' | 'idle' = 'running';
    factory.status = () => state;
    const view = new FactoryView(new THREE.Scene(), factory);
    const [armMover, labMover] = (view as unknown as { moverList: { mesh: THREE.Mesh }[] })
      .moverList;
    for (let i = 0; i < 40; i++) view.updateMovers(0.5 + i * 0.05);
    expect(Math.abs(armMover.mesh.rotation.y)).toBeGreaterThan(0.05);
    expect(labMover.mesh.rotation.y).toBeGreaterThan(1);
    const turned = labMover.mesh.rotation.y;
    state = 'idle';
    for (let i = 0; i < 80; i++) view.updateMovers(3 + i * 0.05);
    expect(Math.abs(armMover.mesh.rotation.y)).toBeLessThan(0.01);
    expect(labMover.mesh.rotation.y).toBe(turned); // la tête s'arrête
    view.dispose();
  });
});
