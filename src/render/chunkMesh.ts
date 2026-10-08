import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import { resourceById } from '../core/data/resources';
import { valueNoise } from '../core/world/noise';
import { hash01 } from '../core/world/rng';
import { BIOME_COLORS, type BiomeId } from '../core/world/biomes';
import type { ChunkData, WorldGenerator } from '../core/world/worldgen';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';
import { TREE_MODEL_HEIGHT_M, foliageMaterial, rockModel, treeModel } from './nature';

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
/** Teinte du sol selon la saison. */
export const setGroundTint = (
  tint: [number, number, number],
  snow: [number, number, number],
): void => {
  groundMaterial.color.setRGB(...tint);
  groundMaterial.emissive.setRGB(...snow);
};
export const propsMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
const ghostShader = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
  Object.assign(shader.uniforms, ghostUniforms);
  // Hauteur dans le monde : ce qui est bas (tapis, tuyaux, cailloux) ne cache pas le joueur, on ne le troue pas.
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vGhostY;')
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvGhostY = (modelMatrix * vec4(transformed, 1.0)).y;',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
uniform float uGhostOn;
uniform vec2 uGhostCenter;
uniform float uGhostDepth;
uniform float uGhostRadius;
varying float vGhostY;`,
    )
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
if (uGhostOn > 0.5 && vGhostY > 0.45 && -vViewPosition.z < uGhostDepth - 0.35) {
  float t = clamp(distance(gl_FragCoord.xy, uGhostCenter) / uGhostRadius, 0.0, 1.0);
  float opacity = 0.08 + 0.92 * (t * t * (3.0 - 2.0 * t));
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (opacity < noise) discard;
}`,
    );
};
propsMaterial.onBeforeCompile = ghostShader;
foliageMaterial.onBeforeCompile = ghostShader;

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

/** Feuillage texturé accumulé pendant la construction du décor (arbres du modèle). */
interface Foliage {
  positions: number[];
  normals: number[];
  uvs: number[];
  index: number[];
}

/** Ajoute un conifère du modèle : base du tronc en (x, z), tourné de `angle`, ramené à ~5,5 m × `scale`. */
function addTree(
  f: Foliage,
  m: NonNullable<ReturnType<typeof treeModel>>,
  x: number,
  z: number,
  angle: number,
  scale: number,
): void {
  const k = (TREE_MODEL_HEIGHT_M / m.height) * scale;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const first = f.positions.length / 3;
  for (let i = 0; i < m.positions.length / 3; i++) {
    const px = (m.positions[i * 3] - m.base.x) * k;
    const pz = (m.positions[i * 3 + 2] - m.base.z) * k;
    f.positions.push(
      x + px * c + pz * s,
      (m.positions[i * 3 + 1] - m.base.minY) * k,
      z - px * s + pz * c,
    );
    const nx = m.normals[i * 3];
    const nz = m.normals[i * 3 + 2];
    f.normals.push(nx * c + nz * s, m.normals[i * 3 + 1], -nx * s + nz * c);
    f.uvs.push(m.uvs[i * 2], m.uvs[i * 2 + 1]);
  }
  for (let i = 0; i < m.index.length; i++) f.index.push(first + m.index[i]);
}

function buildProps(
  data: ChunkData,
  blocked: string[],
  tall: [string, number][],
  foliage: Foliage,
): THREE.BufferGeometry | null {
  const b = new MeshBuilder();
  const treeMesh = treeModel();
  const rockMesh = rockModel();
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
    // Un buisson de fibres se traverse (comme de l'herbe haute) ; le reste bloque.
    if (o.id === 'tree') {
      // Seul le tronc bloque (une case) : on passe sous les branches.
      const tx = cxm + Math.cos(o.rotation) * 0.2 + ox;
      const tz = czm + Math.sin(o.rotation) * 0.2 + oz;
      blocked.push(`${Math.floor(tx / CELL_SIZE_M)},${Math.floor(tz / CELL_SIZE_M)}`);
    } else if (o.id !== 'fiber_bush') markBlocked(o.gx, o.gz, o.cells);
    // La caméra traverse le feuillage (l'aura de transparence gère la visibilité) ; elle ne traverse
    // pas les obstacles solides (rochers, nids, et plus tard les murs).
    if (o.id !== 'tree' && o.id !== 'fiber_bush') {
      for (let dx = 0; dx < o.cells; dx++) {
        for (let dz = 0; dz < o.cells; dz++) tall.push([`${o.gx + dx},${o.gz + dz}`, 0.9]);
      }
    }
    if (o.id === 'tree') {
      const x = cxm + Math.cos(o.rotation) * 0.2;
      const z = czm + Math.sin(o.rotation) * 0.2;
      // Tronc haut et fin (le personnage de 1,70 m passe dessous), feuillage au-dessus de 2 m.
      if (treeMesh) addTree(foliage, treeMesh, x, z, o.rotation, o.scale);
      else {
        b.cone(x, 0, z, 0.13 * o.scale, 2.3 * o.scale, 6, TRUNK, 0.09 * o.scale);
        const green = shade(base, jitter);
        b.cone(x, 2.0 * o.scale, z, 0.95 * o.scale, 1.7 * o.scale, 8, green);
        b.cone(x, 2.9 * o.scale, z, 0.65 * o.scale, 1.4 * o.scale, 8, shade(green, 1.12));
      }
    } else if (o.id === 'fiber_bush') {
      // Touffe de brins clairs.
      const x = cxm + Math.cos(o.rotation) * 0.1;
      const z = czm + Math.sin(o.rotation) * 0.1;
      for (let i = 0; i < 6; i++) {
        const a = o.rotation + (i / 6) * Math.PI * 2;
        const r = 0.12 * o.scale;
        b.cone(
          x + Math.cos(a) * r,
          0,
          z + Math.sin(a) * r,
          0.06 * o.scale,
          (0.45 + 0.12 * (i % 3)) * o.scale,
          4,
          shade(base, jitter * (0.9 + 0.08 * (i % 2))),
        );
      }
    } else if (o.id === 'rock') {
      const x = cxm + Math.cos(o.rotation) * 0.15;
      const z = czm + Math.sin(o.rotation) * 0.15;
      if (rockMesh) {
        const k = 0.26 * o.scale;
        b.model(rockMesh, x, 0, z, Math.round(o.rotation * 2) % 4, k, undefined, 0, false, k * 1.6);
      } else {
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
      }
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

  const foliage: Foliage = { positions: [], normals: [], uvs: [], index: [] };
  const propsGeometry = buildProps(data, blocked, tall, foliage);
  if (propsGeometry) {
    const props = new THREE.Mesh(propsGeometry, propsMaterial);
    props.castShadow = true;
    props.receiveShadow = true;
    group.add(props);
  }
  let foliageGeometry: THREE.BufferGeometry | null = null;
  if (foliage.positions.length > 0) {
    foliageGeometry = new THREE.BufferGeometry();
    foliageGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(foliage.positions, 3),
    );
    foliageGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(foliage.normals, 3));
    foliageGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(foliage.uvs, 2));
    foliageGeometry.setIndex(foliage.index);
    foliageGeometry.computeBoundingSphere();
    const leaves = new THREE.Mesh(foliageGeometry, foliageMaterial);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    group.add(leaves);
  }
  return {
    group,
    blocked,
    tall,
    dispose: () => {
      groundGeometry.dispose();
      propsGeometry?.dispose();
      foliageGeometry?.dispose();
    },
  };
}
