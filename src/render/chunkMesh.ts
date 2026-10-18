import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import { resourceById } from '../core/data/resources';
import { hash01 } from '../core/world/rng';
import type { BiomeId } from '../core/world/biomes';
import type { ChunkData, WorldGenerator } from '../core/world/worldgen';
import { WATER_TILE_M, oreAtlas, oreTile, waterTexture } from './groundTextures';
import { cellDiagonal, groundColor, groundNormal } from './groundStyle';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';
import {
  BUSH_HEIGHT_MODEL_M,
  BUSH_MAX_WIDTH_M,
  ROCK_MODEL_WIDTH_M,
  TREE_MODEL_HEIGHT_M,
  OWN_TREE_MAX_WIDTH,
  bushModelsFor,
  isOwnNature,
  oreClumpModels,
  rockModelsFor,
  treeModelsFor,
} from './nature';
import { bakedModel } from './models';

const TRUNK = hexToRgb('#6b4a2b');
/** Épaisseur maximale d'une case de minerai : 10 cm. */
const ORE_MAX_HEIGHT_M = 0.1;
const ORE_MIN_HEIGHT_M = 0.02;
const ORE_FULL_AMOUNT = 3500;
/** Pétrole : part des cases qui portent une flaque, au bord (pauvre), et en plus au cœur (riche). */
const OIL_SEEP_MIN = 0.2;
const OIL_SEEP_RICH = 0.4;
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

/** Gisements : texture de l'atlas × éclairage de la richesse (couleur de sommet). */
const oreMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
/** Eau : texture qui coule (voir `tickWater`). */
const waterMaterial = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.05 });
/** Les textures dessinées par le code n'existent qu'une fois la page prête : on les pose à la première construction. */
function ensureGroundTextures(): void {
  if (!oreMaterial.map) {
    oreMaterial.map = oreAtlas();
    oreMaterial.needsUpdate = true;
  }
  if (!waterMaterial.map) {
    waterMaterial.map = waterTexture();
    waterMaterial.needsUpdate = true;
  }
}

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

/**
 * Sol du chunk, en facettes low poly : deux triangles par case, chacun de sa couleur (palette et motifs du biome, voir
 * `groundStyle.ts`) avec une normale à peine penchée. Le sol reste plat (y = 0) sous les machines et les constructions.
 */
function buildGround(gen: WorldGenerator, data: ChunkData): THREE.BufferGeometry {
  const n = CHUNK_CELLS;
  const count = n * n * 6;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const gx0 = data.cx * n;
  const gz0 = data.cz * n;
  let v = 0;
  const put = (x: number, z: number, c: Rgb, nrm: [number, number, number]): void => {
    const k = v * 3;
    positions[k] = x;
    positions[k + 2] = z;
    normals[k] = nrm[0];
    normals[k + 1] = nrm[1];
    normals[k + 2] = nrm[2];
    colors[k] = c.r;
    colors[k + 1] = c.g;
    colors[k + 2] = c.b;
    v++;
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = gx0 + i;
      const gz = gz0 + j;
      const x0 = i * CELL_SIZE_M;
      const z0 = j * CELL_SIZE_M;
      const x1 = x0 + CELL_SIZE_M;
      const z1 = z0 + CELL_SIZE_M;
      // Deux triangles (sens antihoraire vu du dessus), coupés selon une diagonale tirée au hasard.
      const tris: [number, number][][] = cellDiagonal(gen.seed, gx, gz)
        ? [
            [
              [x0, z0],
              [x1, z1],
              [x1, z0],
            ],
            [
              [x0, z0],
              [x0, z1],
              [x1, z1],
            ],
          ]
        : [
            [
              [x0, z0],
              [x0, z1],
              [x1, z0],
            ],
            [
              [x1, z0],
              [x0, z1],
              [x1, z1],
            ],
          ];
      tris.forEach((tri, half) => {
        const cxL = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const czL = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const xM = gx0 * CELL_SIZE_M + cxL;
        const zM = gz0 * CELL_SIZE_M + czL;
        const c = groundColor(gen.biomeAt(xM, zM), gen.seed, xM, zM, gx, gz, half);
        const nrm = groundNormal(gen.seed, gx, gz, half);
        for (const [x, z] of tri) put(x, z, c, nrm);
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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

/** Maillage texturé avec couleurs de sommet (gisements). */
interface TexBuf extends Foliage {
  colors: number[];
}
const emptyTexBuf = (): TexBuf => ({ positions: [], normals: [], uvs: [], index: [], colors: [] });

/** Quatre sommets d'un rectangle : positions, normale, uv (4 paires), couleur. */
function quad(
  f: TexBuf,
  corners: [number, number, number][],
  normal: [number, number, number],
  uv: [number, number][],
  shadeColor: number,
): void {
  const first = f.positions.length / 3;
  corners.forEach((c, i) => {
    f.positions.push(...c);
    f.normals.push(...normal);
    f.uvs.push(...uv[i]);
    f.colors.push(shadeColor, shadeColor, shadeColor);
  });
  f.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

/** Fabrique le maillage texturé d'un feuillage (rien s'il est vide) et l'ajoute au groupe. */
function foliageMesh(
  group: THREE.Group,
  f: Foliage,
  material: THREE.Material,
  colors?: number[],
  flat = false,
): THREE.BufferGeometry | null {
  if (f.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(f.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(f.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(f.uvs, 2));
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(f.index);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = !flat;
  mesh.receiveShadow = true;
  group.add(mesh);
  return geometry;
}

function buildProps(
  data: ChunkData,
  blocked: string[],
  tall: [string, number][],
  ground: { ore: TexBuf; water: TexBuf },
  biomeAt: (xM: number, zM: number) => BiomeId,
): THREE.BufferGeometry | null {
  const b = new MeshBuilder();
  const rockCache = new Map<BiomeId, ReturnType<typeof rockModelsFor>>();
  const clumpCache = new Map<string, ReturnType<typeof oreClumpModels>>();
  const treeCache = new Map<BiomeId, ReturnType<typeof treeModelsFor>>();
  const bushCache = new Map<BiomeId, ReturnType<typeof bushModelsFor>>();
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
      // Arbre du pack propre au biome (feuillus, conifères, arbres secs, résineux givrés) ; taille = petit, moyen, grand.
      const biome = biomeAt(cxm + ox, czm + oz);
      let trees = treeCache.get(biome);
      if (!trees) treeCache.set(biome, (trees = treeModelsFor(biome)));
      if (trees.length > 0) {
        const model = trees[Math.floor(hash01(4, o.gx, o.gz, 11) * trees.length)];
        // Les arbres maison de la toundra sont déjà enneigés ; ceux du pack sont givrés par une teinte.
        const own = isOwnNature(model);
        const frost = biome === 'tundra' && !own ? { r: 0.92, g: 0.96, b: 1 } : undefined;
        // Les arbres larges sont ramenés à une emprise raisonnable (3 m au plus pour un arbre moyen du pack, 4 m
        // pour un arbre maison).
        const wide = Math.max(model.size.x, model.size.z) / model.size.y;
        const k =
          TREE_MODEL_HEIGHT_M * o.scale * Math.min(1, (own ? OWN_TREE_MAX_WIDTH : 0.6) / wide);
        b.model(model, x, 0, z, o.rotation / (Math.PI / 2), k, frost, frost ? 0.45 : 0);
      } else {
        b.cone(x, 0, z, 0.13 * o.scale, 2.3 * o.scale, 6, TRUNK, 0.09 * o.scale);
        const green = shade(base, jitter);
        b.cone(x, 2.0 * o.scale, z, 0.95 * o.scale, 1.7 * o.scale, 8, green);
        b.cone(x, 2.9 * o.scale, z, 0.65 * o.scale, 1.4 * o.scale, 8, shade(green, 1.12));
      }
    } else if (o.id === 'fiber_bush' && bushModelsFor(biomeAt(cxm + ox, czm + oz)).length > 0) {
      // Herbe ou plante du pack, propre au biome ; les larges sont ramenées à moins d'un mètre.
      const x = cxm + Math.cos(o.rotation) * 0.1;
      const z = czm + Math.sin(o.rotation) * 0.1;
      const biome = biomeAt(cxm + ox, czm + oz);
      let bushes = bushCache.get(biome);
      if (!bushes) bushCache.set(biome, (bushes = bushModelsFor(biome)));
      const model = bushes[Math.floor(hash01(2, o.gx, o.gz, 9) * bushes.length)];
      const wide = Math.max(model.size.x, model.size.z) / model.size.y;
      const k =
        BUSH_HEIGHT_MODEL_M *
        o.scale *
        Math.min(1, BUSH_MAX_WIDTH_M / (BUSH_HEIGHT_MODEL_M * o.scale * wide));
      const frost =
        biome === 'tundra' && !isOwnNature(model) ? { r: 0.92, g: 0.96, b: 1 } : undefined;
      b.model(model, x, 0, z, o.rotation / (Math.PI / 2), k, frost, frost ? 0.4 : 0);
    } else if (o.id === 'fiber_bush') {
      // Touffe de brins clairs (secours).
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
      // Rocher maison propre au biome (granite, blocs moussus, grès, granite enneigé), sinon ceux du pack.
      const biome = biomeAt(cxm + ox, czm + oz);
      let rockMeshes = rockCache.get(biome);
      if (!rockMeshes) rockCache.set(biome, (rockMeshes = rockModelsFor(biome)));
      if (rockMeshes.length > 0) {
        const model = rockMeshes[Math.floor(hash01(4, o.gx, o.gz, 12) * rockMeshes.length)];
        const k = ROCK_MODEL_WIDTH_M * o.scale;
        b.model(model, x, 0, z, o.rotation / (Math.PI / 2), k);
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
    } else if (o.id === 'nest' && bakedModel('nid')) {
      // Nid en modèle maison (4 unités = 2 m de diamètre pour 4 cases), agrandi selon sa taille.
      const m = bakedModel('nid')!;
      const k = (o.cells * 0.5) / Math.max(m.size.x, m.size.z);
      b.model(m, cxm, 0, czm, Math.floor(hash01(3, o.gx, o.gz, 9) * 4), k);
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
    const x0 = w.gx * CELL_SIZE_M - ox;
    const z0 = w.gz * CELL_SIZE_M - oz;
    const x1 = x0 + CELL_SIZE_M;
    const z1 = z0 + CELL_SIZE_M;
    // Coordonnées de texture dans le monde : l'eau se raccorde d'une case et d'un chunk à l'autre.
    const u0 = (w.gx * CELL_SIZE_M) / WATER_TILE_M;
    const v0 = (w.gz * CELL_SIZE_M) / WATER_TILE_M;
    const du = CELL_SIZE_M / WATER_TILE_M;
    quad(
      ground.water,
      [
        [x0, WATER_HEIGHT_M, z0],
        [x0, WATER_HEIGHT_M, z1],
        [x1, WATER_HEIGHT_M, z1],
        [x1, WATER_HEIGHT_M, z0],
      ],
      [0, 1, 0],
      [
        [u0, v0],
        [u0, v0 + du],
        [u0 + du, v0 + du],
        [u0 + du, v0],
      ],
      shadeW,
    );
  }
  for (const o of data.ore) {
    const richness = Math.min(1, o.amount / ORE_FULL_AMOUNT);
    const height = ORE_MIN_HEIGHT_M + (ORE_MAX_HEIGHT_M - ORE_MIN_HEIGHT_M) * richness;
    const x0 = o.gx * CELL_SIZE_M - ox;
    const z0 = o.gz * CELL_SIZE_M - oz;
    const x1 = x0 + CELL_SIZE_M;
    const z1 = z0 + CELL_SIZE_M;
    const tile = oreTile(o.id);
    if (!tile) {
      b.box(
        (o.gx + 0.5) * CELL_SIZE_M - ox,
        0,
        (o.gz + 0.5) * CELL_SIZE_M - oz,
        CELL_SIZE_M,
        height,
        CELL_SIZE_M,
        shade(hexToRgb(resourceById(o.id).color), 0.8 + 0.4 * richness),
      );
      continue;
    }
    const [tu0, tv0, tu1, tv1] = tile;
    // La vignette est tournée ou retournée au hasard pour que deux cases voisines ne se ressemblent pas.
    const corners: [number, number][] = [
      [tu0, tv0],
      [tu0, tv1],
      [tu1, tv1],
      [tu1, tv0],
    ];
    const turn = Math.floor(hash01(3, o.gx, o.gz, 21) * 4);
    const rotated = corners.map((_, i) => corners[(i + turn) % 4]);
    if (hash01(3, o.gx, o.gz, 22) < 0.5) rotated.reverse();
    let light = 0.85 + 0.25 * richness;
    const top = height;
    // Minerai maison : chaque case est couverte de ses cailloux (3 ou 4, ou des petits cailloux pour le sable), tournés
    // et retournés au hasard ; ils sont plus hauts là où la case est riche et s'aplatissent quand elle s'épuise. Le
    // pétrole n'a qu'une flaque sur une partie des cases.
    let clumps = clumpCache.get(o.id);
    if (!clumps) clumpCache.set(o.id, (clumps = oreClumpModels(o.id)));
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const pick = clumps[Math.floor(hash01(3, o.gx, o.gz, 24) * clumps.length)];
    if (o.id === 'oil') {
      if (pick && hash01(3, o.gx, o.gz, 23) < OIL_SEEP_MIN + OIL_SEEP_RICH * richness) {
        const jx = (hash01(3, o.gx, o.gz, 25) - 0.5) * 0.1;
        const jz = (hash01(3, o.gx, o.gz, 26) - 0.5) * 0.1;
        b.model(pick, cx + jx, top, cz + jz, hash01(3, o.gx, o.gz, 27) * 4, 0.9 + 0.5 * richness);
      }
    } else if (pick) {
      const turns = Math.floor(hash01(3, o.gx, o.gz, 27) * 4);
      const mirror = hash01(3, o.gx, o.gz, 28) < 0.5;
      b.model(pick, cx, top, cz, turns, 1, undefined, 0, mirror, 0.7 + 0.5 * richness);
      // Le fond entre les cailloux, assombri, se lit comme leur ombre.
      light *= 0.35;
    }
    quad(
      ground.ore,
      [
        [x0, top, z0],
        [x0, top, z1],
        [x1, top, z1],
        [x1, top, z0],
      ],
      [0, 1, 0],
      rotated as [number, number][],
      light,
    );
    // Flancs : couleur moyenne de la vignette (un point au centre), un peu plus sombres.
    const mid: [number, number] = [(tu0 + tu1) / 2, (tv0 + tv1) / 2];
    const flat: [number, number][] = [mid, mid, mid, mid];
    const side = light * 0.7;
    quad(
      ground.ore,
      [
        [x0, 0, z1],
        [x0, top, z1],
        [x1, top, z1],
        [x1, 0, z1],
      ],
      [0, 0, 1],
      flat,
      side,
    );
    quad(
      ground.ore,
      [
        [x1, 0, z0],
        [x1, top, z0],
        [x0, top, z0],
        [x0, 0, z0],
      ],
      [0, 0, -1],
      flat,
      side,
    );
    quad(
      ground.ore,
      [
        [x0, 0, z0],
        [x0, top, z0],
        [x0, top, z1],
        [x0, 0, z1],
      ],
      [-1, 0, 0],
      flat,
      side,
    );
    quad(
      ground.ore,
      [
        [x1, 0, z1],
        [x1, top, z1],
        [x1, top, z0],
        [x1, 0, z0],
      ],
      [1, 0, 0],
      flat,
      side,
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

  ensureGroundTextures();
  const cover = { ore: emptyTexBuf(), water: emptyTexBuf() };
  const propsGeometry = buildProps(data, blocked, tall, cover, (x, z) => gen.biomeAt(x, z));
  if (propsGeometry) {
    const props = new THREE.Mesh(propsGeometry, propsMaterial);
    props.castShadow = true;
    props.receiveShadow = true;
    group.add(props);
  }
  const foliageGeometries = [
    foliageMesh(group, cover.ore, oreMaterial, cover.ore.colors),
    foliageMesh(group, cover.water, waterMaterial, undefined, true),
  ];
  return {
    group,
    blocked,
    tall,
    dispose: () => {
      groundGeometry.dispose();
      propsGeometry?.dispose();
      for (const g of foliageGeometries) g?.dispose();
    },
  };
}
