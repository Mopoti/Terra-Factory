import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BakedModel, PartGroup } from './models';
import { rollWheels, vehicleFromModel } from './vehicleModel';

/** Triangle posé autour de (x, y, z), à `r` de ce point sur l'axe y. */
const tri = (x: number, y: number, z: number, r: number): Omit<PartGroup, 'pivot' | 'axis'> => ({
  positions: new Float32Array([x, y + r, z, x, y - r, z, x, y, z + r]),
  normals: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]),
  colors: new Float32Array(9).fill(0.5),
  index: new Uint32Array([0, 1, 2]),
});

describe('buggy en modèle maison', () => {
  const roue = (x: number, z: number): PartGroup => ({
    ...tri(x, 0.2, z, 0.2),
    pivot: { x, y: 0.2, z },
    axis: { x: 1, y: 0, z: 0 },
  });
  const model: BakedModel = {
    ...tri(0, 0.5, 0, 0.3),
    min: { x: -0.5, y: 0, z: -0.8 },
    size: { x: 1, y: 0.9, z: 1.6 },
    groups: { roue_avg: roue(-0.4, 0.5), roue_ard: roue(0.4, -0.5) },
  };

  it('pose une roue par groupe sur son pivot, et mesure leur rayon', () => {
    const v = vehicleFromModel(model, new THREE.MeshBasicMaterial());
    expect(v.wheels).toHaveLength(2);
    expect(v.wheels[0].position.toArray()).toEqual([-0.4, 0.2, 0.5]);
    expect(v.radius).toBeCloseTo(0.2);
    // La géométrie de la roue est centrée sur son pivot.
    const pos = (v.wheels[0].children[0] as THREE.Mesh).geometry.getAttribute('position');
    expect(pos.getY(0)).toBeCloseTo(0.2);
    expect(pos.getX(0)).toBeCloseTo(0);
  });

  it('seules les roues roulent : la tourelle d’un char reste en place', () => {
    const tank: BakedModel = {
      ...model,
      groups: { chenille_g: roue(-0.4, 0), tourelle: roue(0, 0), roue_avg: roue(0.4, 0.5) },
    };
    const v = vehicleFromModel(tank, new THREE.MeshBasicMaterial());
    expect(v.wheels).toHaveLength(1);
    expect(v.group.children).toHaveLength(4); // carrosserie + 3 pivots
  });

  it('fait rouler les roues de la distance parcourue', () => {
    const v = vehicleFromModel(model, new THREE.MeshBasicMaterial());
    rollWheels(v, 0.2 * Math.PI);
    expect(v.wheels[1].rotation.x).toBeCloseTo(Math.PI);
    rollWheels(v, -0.2 * Math.PI);
    expect(v.wheels[1].rotation.x).toBeCloseTo(0);
  });
});
