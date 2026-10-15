/**
 * Bande des tapis maison qui défile (groupe `bande_` des modèles `convoyeur_*`, voir `blender/ANIMATIONS.md`).
 *
 * Toutes les lames de tous les tapis sont dans UN maillage ; c'est le shader qui les fait avancer (aucun calcul par image
 * côté processeur). Chaque sommet porte la façon dont sa tuile bouge :
 * - tapis droit : glisse le long du sens du tapis, de `mod(t × vitesse, pas)` ;
 * - virage : tourne autour du coin de la tuile, de `mod(t × vitesse angulaire, pas angulaire)`.
 * Le motif se répète d'un pas à l'autre : le retour en arrière à chaque pas ne se voit pas. Une lame de plus, un pas en
 * amont, entre dans la tuile pendant que les autres avancent ; ce qui sort de la tuile est découpé (fragment jeté).
 */
import * as THREE from 'three';
import { MeshBuilder, type Rgb } from './meshBuilder';
import type { BeltShape, PartGroup } from './models';

/** Pas des lames du tapis droit (m du modèle : 0,5 unité Blender). */
export const BAND_PITCH_M = 0.25;
/** Pas des lames du virage (rad : 22,5°). */
export const BAND_STEP_RAD = Math.PI / 8;
/** Rayon du milieu de la bande dans le virage (m du modèle : 1 unité Blender). */
export const BAND_RADIUS_M = 0.5;

/** Sens de rotation des lames d'un virage, autour de l'axe vertical (+1 : angle croissant). */
export const bandSign = (shape: BeltShape): number => (shape === 'cornerBack' ? 1 : -1);

/** Tourne (x, z) autour de l'axe vertical, comme `MeshBuilder.model` (x' = x cos + z sin, z' = −x sin + z cos). */
const turnXZ = (x: number, z: number, a: number): [number, number] => [
  x * Math.cos(a) + z * Math.sin(a),
  -x * Math.sin(a) + z * Math.cos(a),
];

/**
 * Lames du groupe plus une copie un pas en amont (repère du modèle) : en avançant d'un pas, la copie prend la place de la
 * première lame, et la dernière sort de la tuile.
 */
export function withUpstream(group: PartGroup, shape: BeltShape): PartGroup {
  const n = group.positions.length / 3;
  const positions = new Float32Array(n * 6);
  const normals = new Float32Array(n * 6);
  positions.set(group.positions);
  normals.set(group.normals);
  const back = -bandSign(shape) * BAND_STEP_RAD;
  for (let i = 0; i < n; i++) {
    const k = (n + i) * 3;
    let x = group.positions[i * 3];
    let z = group.positions[i * 3 + 2];
    let nx = group.normals[i * 3];
    let nz = group.normals[i * 3 + 2];
    if (shape === 'straight') x -= BAND_PITCH_M;
    else {
      const [rx, rz] = turnXZ(x - group.pivot.x, z - group.pivot.z, back);
      x = group.pivot.x + rx;
      z = group.pivot.z + rz;
      [nx, nz] = turnXZ(nx, nz, back);
    }
    positions[k] = x;
    positions[k + 1] = group.positions[i * 3 + 1];
    positions[k + 2] = z;
    normals[k] = nx;
    normals[k + 1] = group.normals[i * 3 + 1];
    normals[k + 2] = nz;
  }
  const index = new Uint32Array(group.index.length * 2);
  index.set(group.index);
  for (let i = 0; i < group.index.length; i++) index[group.index.length + i] = group.index[i] + n;
  const colors = new Float32Array(n * 6);
  colors.set(group.colors);
  colors.set(group.colors, n * 3);
  return { ...group, positions, normals, colors, index };
}

/** Lames de tous les tapis : sommets posés dans le monde et, pour chacun, comment sa tuile les fait bouger. */
export class BandBuilder {
  readonly mb = new MeshBuilder();
  /** (x, z) du point de référence : sens du tapis (droit) ou pivot (virage) ; puis 2 valeurs. */
  readonly flowA: number[] = [];
  /** genre (0 droit, 1 virage), vitesse (m/s ou rad/s), pas (m ou rad), sens (virage). */
  readonly flowB: number[] = [];
  /** Centre de la tuile (x, z) et demi-côté : ce qui dépasse est découpé. */
  readonly tile: number[] = [];
  private readonly cache = new Map<PartGroup, Map<BeltShape, PartGroup>>();

  /**
   * Ajoute la bande d'un tapis posé comme `MeshBuilder.model(model, x, y, z, turns, scale, …)`.
   * @param speed vitesse des objets sur le tapis (m/s) ; 0 = bande arrêtée (tapis cassé)
   * @param half demi-côté de la tuile (m)
   */
  add(
    group: PartGroup,
    model: { min: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } },
    shape: BeltShape,
    x: number,
    y: number,
    z: number,
    turns: number,
    scale: number,
    scaleY: number,
    half: number,
    speed: number,
    tint?: Rgb,
    mix = 0,
  ): void {
    let byShape = this.cache.get(group);
    if (!byShape) {
      byShape = new Map();
      this.cache.set(group, byShape);
    }
    let band = byShape.get(shape);
    if (!band) {
      band = withUpstream(group, shape);
      byShape.set(shape, band);
    }
    const first = this.mb.positions.length / 3;
    this.mb.model(
      { ...band, min: model.min, size: model.size },
      x,
      y,
      z,
      turns,
      scale,
      tint,
      mix,
      false,
      scaleY,
    );
    const count = this.mb.positions.length / 3 - first;
    const a = (turns * Math.PI) / 2;
    let A: [number, number, number, number];
    let B: [number, number, number, number];
    if (shape === 'straight') {
      // Le modèle circule vers +x ; une fois tourné, vers (cos a, −sin a).
      A = [Math.cos(a), -Math.sin(a), 0, 0];
      B = [0, speed, BAND_PITCH_M * scale, 0];
    } else {
      const cx = model.min.x + model.size.x / 2;
      const cz = model.min.z + model.size.z / 2;
      const [px, pz] = turnXZ((group.pivot.x - cx) * scale, (group.pivot.z - cz) * scale, a);
      A = [x + px, z + pz, 0, 0];
      B = [1, speed / (BAND_RADIUS_M * scale), BAND_STEP_RAD, bandSign(shape)];
    }
    for (let i = 0; i < count; i++) {
      this.flowA.push(...A);
      this.flowB.push(...B);
      this.tile.push(x, z, half);
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.mb.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.mb.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.mb.colors, 3));
    g.setAttribute('aBandA', new THREE.Float32BufferAttribute(this.flowA, 4));
    g.setAttribute('aBandB', new THREE.Float32BufferAttribute(this.flowB, 4));
    g.setAttribute('aBandTile', new THREE.Float32BufferAttribute(this.tile, 3));
    return g;
  }
}

/** Temps du défilement (s), le même pour tous les tapis. */
const uniforms = { uBandTime: { value: 0 } };

/** Avance le défilement (à appeler à chaque image). Ramené dans [0 ; 3600[ pour garder la précision du shader. */
export const setBandTime = (seconds: number): void => {
  uniforms.uBandTime.value = seconds % 3600;
};

/** Matériau des lames : celui des machines, plus le déplacement et la découpe. */
export const bandMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
bandMaterial.onBeforeCompile = (shader): void => {
  Object.assign(shader.uniforms, uniforms);
  const head = `
uniform float uBandTime;
attribute vec4 aBandA;
attribute vec4 aBandB;
attribute vec3 aBandTile;
varying vec3 vBandTile;
vec2 bandTurn(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(v.x * c + v.y * s, -v.x * s + v.y * c); }
float bandShift() { return mod(uBandTime * aBandB.y, aBandB.z); }`;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>${head}`)
    .replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
if (aBandB.x > 0.5) objectNormal.xz = bandTurn(objectNormal.xz, aBandB.w * bandShift());`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
if (aBandB.x > 0.5) transformed.xz = aBandA.xy + bandTurn(transformed.xz - aBandA.xy, aBandB.w * bandShift());
else transformed.xz += aBandA.xy * bandShift();
vBandTile = vec3(transformed.xz - aBandTile.xy, aBandTile.z);`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vBandTile;')
    .replace(
      '#include <clipping_planes_fragment>',
      `if (max(abs(vBandTile.x), abs(vBandTile.y)) > vBandTile.z) discard;
#include <clipping_planes_fragment>`,
    );
};
