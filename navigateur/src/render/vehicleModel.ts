/**
 * Buggy en modèle maison (`blender/scripts/vehicules.py`) : un maillage fixe (châssis, carrosserie, arceau…) et une roue
 * par groupe (`roue_avg`, `roue_avd`, `roue_arg`, `roue_ard`), chacune sur son pivot, qui tourne autour de l'axe X quand
 * le buggy roule. Le modèle est en mètres, l'avant vers +z (comme le personnage).
 */
import * as THREE from 'three';
import type { BakedModel } from './models';

export interface VehicleMesh {
  group: THREE.Group;
  /** Pivots des roues : `rotation.x` les fait rouler. */
  wheels: THREE.Object3D[];
  /** Rayon des roues (m), pour convertir la distance parcourue en angle. */
  radius: number;
  /** Coussin du siège du conducteur dans le repère du groupe (m), si le modèle en a un (nœud `siege`). */
  seat: { x: number; y: number; z: number } | null;
  /** Pivot de chaque groupe mobile, par nom (roues comprises) : attelages des trains, tourelle du char… */
  parts: Map<string, THREE.Object3D>;
}

function geometry(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  colors: ArrayLike<number>,
  index: ArrayLike<number>,
  dx: number,
  dy: number,
  dz: number,
): THREE.BufferGeometry {
  const p = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    p[i] = positions[i] - dx;
    p[i + 1] = positions[i + 1] - dy;
    p[i + 2] = positions[i + 2] - dz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from(normals), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from(colors), 3));
  g.setIndex(Array.from(index));
  g.computeBoundingSphere();
  return g;
}

/**
 * Construit le véhicule (posé au sol, centré sur son enveloppe) et ses roues mobiles. `atOrigin` : centré sur l'origine
 * du modèle et non sur son enveloppe (trains : l'origine est au milieu des essieux, les attelages ne sont pas
 * symétriques).
 */
export function vehicleFromModel(
  model: BakedModel,
  material: THREE.Material,
  atOrigin = false,
): VehicleMesh {
  const cx = atOrigin ? 0 : model.min.x + model.size.x / 2;
  const cz = atOrigin ? 0 : model.min.z + model.size.z / 2;
  const y0 = model.min.y;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    geometry(model.positions, model.normals, model.colors, model.index, cx, y0, cz),
    material,
  );
  body.castShadow = true;
  group.add(body);
  const wheels: THREE.Object3D[] = [];
  const parts = new Map<string, THREE.Object3D>();
  let radius = 0;
  for (const [name, part] of Object.entries(model.groups ?? {})) {
    const pivot = new THREE.Object3D();
    pivot.position.set(part.pivot.x - cx, part.pivot.y - y0, part.pivot.z - cz);
    const wheel = new THREE.Mesh(
      geometry(
        part.positions,
        part.normals,
        part.colors,
        part.index,
        part.pivot.x,
        part.pivot.y,
        part.pivot.z,
      ),
      material,
    );
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    parts.set(name, pivot);
    // Seules les roues roulent ; chenilles et tourelle du char restent en place.
    if (!name.startsWith('roue')) continue;
    wheels.push(pivot);
    // Rayon : sommet le plus éloigné de l'axe (dans le plan y, z), crampons compris.
    for (let i = 0; i < part.positions.length; i += 3)
      radius = Math.max(
        radius,
        Math.hypot(part.positions[i + 1] - part.pivot.y, part.positions[i + 2] - part.pivot.z),
      );
  }
  const seat = model.seat
    ? { x: model.seat.x - cx, y: model.seat.y - y0, z: model.seat.z - cz }
    : null;
  return { group, wheels, radius: radius || 0.2, seat, parts };
}

/** Fait rouler les roues de `distance` mètres vers l'avant (négatif : en arrière). */
export function rollWheels(mesh: VehicleMesh, distance: number): void {
  const angle = distance / mesh.radius;
  for (const w of mesh.wheels) w.rotation.x += angle;
}
