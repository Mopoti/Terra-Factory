import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import { resourceById } from '../core/data/resources';
import { valueNoise } from '../core/world/noise';
import { hash01 } from '../core/world/rng';
import { BIOME_COLORS, type BiomeId } from '../core/world/biomes';
import type { ChunkData, WorldGenerator } from '../core/world/worldgen';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';

const GROUND_COLORS = Object.fromEntries(
  Object.entries(BIOME_COLORS).map(([id, hex]) => [id, hexToRgb(hex)]),
) as Record<BiomeId, Rgb>;
const TRUNK = hexToRgb('#6b4a2b');
/** Épaisseur maximale d'une case de minerai : 10 cm. */
const ORE_MAX_HEIGHT_M = 0.1;
const ORE_MIN_HEIGHT_M = 0.02;
const ORE_FULL_AMOUNT = 3500;
const WATER_HEIGHT_M = 0.04;

export interface ChunkMesh {
  group: THREE.Group;
  /** Cases bloquantes (arbres, rochers, nids, eau) sous la forme « gx,gz ». */
  blocked: string[];
  /** Obstacles solides pour la caméra (rochers, nids) : case « gx,gz » et hauteur en m. */
  tall: [string, number][];
  dispose(): void;
}

/**
 * Aura de transparence : les éléments du décor placés entre la caméra et le joueur deviennent
 * très transparents autour du joueur, puis de moins en moins en s'éloignant, jusqu'à être opaques.
 * Valeurs mises à jour à chaque image par la vue de jeu.
 */
export const ghostUniforms = {
  uGhostOn: { value: 0 },
  uGhostCenter: { value: new THREE.Vector2() },
  uGhostDepth: { value: 0 },
  uGhostRadius: { value: 100 },
};

const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
export const propsMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
propsMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, ghostUniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
uniform float uGhostOn;
uniform vec2 uGhostCenter;
uniform float uGhostDepth;
uniform float uGhostRadius;`,
    )
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
if (uGhostOn > 0.5 && -vViewPosition.z < uGhostDepth - 0.35) {
  float t = clamp(distance(gl_FragCoord.xy, uGhostCenter) / uGhostRadius, 0.0, 1.0);
  float opacity = 0.08 + 0.92 * (t * t * (3.0 - 2.0 * t));
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (opacity < noise) discard;
}`,
    );
};

function buildGround(gen: WorldGenerator, data: ChunkData): THREE.BufferGeometry {
  const n = CHUNK_CELLS;
  const side = n + 1;
  const positions = new Float32Array(side * side * 3);
  const colors = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  const gx0 = data.cx * n;
  const gz0 = data.cz * n;
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const k = (j * side + i) * 3;
      positions[k] = i * CELL_SIZE_M;
      positions[k + 1] = 0;
      positions[k + 2] = j * CELL_SIZE_M;
      normals[k + 1] = 1;
      const xM = (gx0 + i) * CELL_SIZE_M;
      const zM = (gz0 + j) * CELL_SIZE_M;
      const base = GROUND_COLORS[gen.biomeAt(xM, zM)];
      const variation = 0.93 + 0.14 * valueNoise(gen.seed, xM / 1.5, zM / 1.5, 77);
      const c = shade(base, variation);
      colors[k] = c.r;
      colors[k + 1] = c.g;
      colors[k + 2] = c.b;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * side + i;
      const b = a + 1;
      const c = a + side;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildProps(
  data: ChunkData,
  blocked: string[],
  tall: [string, number][],
): THREE.BufferGeometry | null {
  const b = new MeshBuilder();
  const ox = data.cx * CHUNK_SIZE_M;
  const oz = data.cz * CHUNK_SIZE_M;
  const markBlocked = (gx: number, gz: number, cells: number): void => {
    for (let dx = 0; dx < cells; dx++)
      for (let dz = 0; dz < cells; dz++) blocked.push(`${gx + dx},${gz + dz}`);
  };

  for (const o of data.objects) {
    const res = resourceById(o.id);
    const base = hexToRgb(res.color);
    const jitter = 0.85 + 0.3 * hash01(1, o.gx, o.gz, 5);
    const cxm = (o.gx + o.cells / 2) * CELL_SIZE_M - ox;
    const czm = (o.gz + o.cells / 2) * CELL_SIZE_M - oz;
    markBlocked(o.gx, o.gz, o.cells);
    // La caméra traverse le feuillage (l'aura de transparence gère la visibilité) ; elle ne traverse
    // pas les obstacles solides (rochers, nids, et plus tard les murs).
    if (o.id !== 'tree') {
      for (let dx = 0; dx < o.cells; dx++) {
        for (let dz = 0; dz < o.cells; dz++) tall.push([`${o.gx + dx},${o.gz + dz}`, 0.9]);
      }
    }
    if (o.id === 'tree') {
      const x = cxm + Math.cos(o.rotation) * 0.2;
      const z = czm + Math.sin(o.rotation) * 0.2;
      b.cone(x, 0, z, 0.12 * o.scale, 0.5 * o.scale, 5, TRUNK, 0.09 * o.scale);
      const green = shade(base, jitter);
      b.cone(x, 0.35 * o.scale, z, 0.6 * o.scale, 1.3 * o.scale, 7, green);
      b.cone(x, 0.95 * o.scale, z, 0.42 * o.scale, 1.0 * o.scale, 7, shade(green, 1.12));
    } else if (o.id === 'rock') {
      const x = cxm + Math.cos(o.rotation) * 0.15;
      const z = czm + Math.sin(o.rotation) * 0.15;
      b.octahedron(
        x,
        0,
        z,
        0.45 * o.scale,
        0.34 * o.scale,
        0.38 * o.scale,
        shade(base, jitter),
        o.rotation,
      );
      b.octahedron(
        x + 0.3 * o.scale,
        0,
        z - 0.2 * o.scale,
        0.2 * o.scale,
        0.15 * o.scale,
        0.18 * o.scale,
        shade(base, jitter * 0.9),
        o.rotation + 1,
      );
    } else if (o.id === 'nest') {
      const radius = o.cells * 0.25;
      const k = radius; // 1 m de rayon pour l'emprise de départ (4 cases)
      b.cone(cxm, 0, czm, radius, 0.7 * k, 9, shade(base, 0.9));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.cone(
          cxm + Math.cos(a) * 0.65 * k,
          0.3 * k,
          czm + Math.sin(a) * 0.65 * k,
          0.18 * k,
          0.7 * k,
          5,
          shade(base, 1.3),
        );
      }
    }
  }

  for (const w of data.water) {
    markBlocked(w.gx, w.gz, 1);
    const shadeW = 0.92 + 0.16 * (((w.gx * 7 + w.gz * 13) % 5) / 5);
    b.box(
      (w.gx + 0.5) * CELL_SIZE_M - ox,
      0,
      (w.gz + 0.5) * CELL_SIZE_M - oz,
      CELL_SIZE_M,
      WATER_HEIGHT_M,
      CELL_SIZE_M,
      shade(hexToRgb(resourceById('water').color), shadeW),
    );
  }
  for (const o of data.ore) {
    const richness = Math.min(1, o.amount / ORE_FULL_AMOUNT);
    const height = ORE_MIN_HEIGHT_M + (ORE_MAX_HEIGHT_M - ORE_MIN_HEIGHT_M) * richness;
    b.box(
      (o.gx + 0.5) * CELL_SIZE_M - ox,
      0,
      (o.gz + 0.5) * CELL_SIZE_M - oz,
      CELL_SIZE_M,
      height,
      CELL_SIZE_M,
      shade(hexToRgb(resourceById(o.id).color), 0.8 + 0.4 * richness),
    );
  }

  if (b.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.normals), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(b.colors), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Fabrique les maillages d'un chunk. Le groupe est placé à l'origine du chunk (précision des nombres). */
export function buildChunkMesh(gen: WorldGenerator, data: ChunkData): ChunkMesh {
  const group = new THREE.Group();
  group.position.set(data.cx * CHUNK_SIZE_M, 0, data.cz * CHUNK_SIZE_M);
  const blocked: string[] = [];
  const tall: [string, number][] = [];

  const groundGeometry = buildGround(gen, data);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;
  group.add(ground);

  const propsGeometry = buildProps(data, blocked, tall);
  if (propsGeometry) {
    const props = new THREE.Mesh(propsGeometry, propsMaterial);
    props.castShadow = true;
    props.receiveShadow = true;
    group.add(props);
  }
  return {
    group,
    blocked,
    tall,
    dispose: () => {
      groundGeometry.dispose();
      propsGeometry?.dispose();
    },
  };
}
