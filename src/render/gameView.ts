import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import type { GameSummary, PlayerState } from '../core/save/saveIndex';
import { WorldGenerator } from '../core/world/worldgen';
import { Input } from '../input/input';
import { t, type TranslationKey } from '../i18n';
import type { Settings } from '../settings/schema';
import { getSettings, onSettingsChange } from '../settings/store';
import { buildChunkMesh, type ChunkMesh } from './chunkMesh';

const PIXEL_RATIO_CAP = { low: 1, medium: 1.5, high: 3 } as const;
const SKY = 0x8fb8d8;

// Déplacement provisoire (les vraies caméras et le vrai personnage arrivent au chantier 4).
const WALK_SPEED_M_S = 4.5;
const SPRINT_FACTOR = 1.7;
const PLAYER_RADIUS_M = 0.25;
const PLAYER_HEIGHT_M = 1.75;
const CAMERA_YAW_SPEED = 1.8;
const ZOOM_MIN_M = 3;
const ZOOM_MAX_M = 30;
/** Temps maximum passé à fabriquer des chunks par image (ms), pour éviter les saccades. */
const CHUNK_BUDGET_MS = 6;

interface LoadedChunk {
  mesh: ChunkMesh;
}

/** Vue 3D d'une partie : monde infini généré autour d'un joueur provisoire. */
export interface GameViewOptions {
  /** Position et caméra de départ (sauvegarde chargée, ou mode test ?dev=1&at=x,z&dist=d). */
  start?: Partial<PlayerState>;
}

export interface GameViewHandle {
  dispose(): void;
  /** État actuel du joueur, pour l'enregistrer dans une sauvegarde. */
  getState(): PlayerState;
  /** En pause, le joueur et la caméra ne bougent plus (le monde reste affiché). */
  setPaused(paused: boolean): void;
}

export function startGameView(
  container: HTMLElement,
  game: GameSummary,
  options: GameViewOptions = {},
): GameViewHandle {
  const initial = getSettings().display;
  const renderer = new THREE.WebGLRenderer({ antialias: initial.quality !== 'low' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -28;
  sun.shadow.camera.right = sun.shadow.camera.top = 28;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const generator = new WorldGenerator(game.world);
  const starterSites = generator.starterSites();

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS_M, PLAYER_HEIGHT_M - 2 * PLAYER_RADIUS_M, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xd9822b }),
  );
  player.castShadow = true;
  scene.add(player);
  let playerX = options.start?.x ?? 0;
  let playerZ = options.start?.z ?? 0;
  let facing = 0;

  // --- Chunks ------------------------------------------------------------------------------
  const chunks = new Map<string, LoadedChunk>();
  const blocked = new Set<string>();
  let wanted: { cx: number; cz: number }[] = [];
  let wantedKey = '';

  function chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  function updateWanted(pcx: number, pcz: number, radius: number): void {
    const key = `${pcx},${pcz},${radius}`;
    if (key === wantedKey) return;
    wantedKey = key;
    wanted = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz <= radius * radius) wanted.push({ cx: pcx + dx, cz: pcz + dz });
      }
    }
    wanted.sort(
      (a, b) => (a.cx - pcx) ** 2 + (a.cz - pcz) ** 2 - ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2),
    );
    const keep = (radius + 1.5) ** 2;
    for (const [k, loaded] of chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > keep) {
        scene.remove(loaded.mesh.group);
        loaded.mesh.dispose();
        for (const cell of loaded.mesh.blocked) blocked.delete(cell);
        chunks.delete(k);
      }
    }
  }

  function loadMissing(): void {
    const start = performance.now();
    for (const { cx, cz } of wanted) {
      if (performance.now() - start > CHUNK_BUDGET_MS) return;
      const key = chunkKey(cx, cz);
      if (chunks.has(key)) continue;
      const mesh = buildChunkMesh(generator, generator.chunk(cx, cz));
      scene.add(mesh.group);
      for (const cell of mesh.blocked) blocked.add(cell);
      chunks.set(key, { mesh });
    }
  }

  // --- Entrées et déplacement --------------------------------------------------------------
  const input = new Input(renderer.domElement);
  input.attach();
  let paused = false;
  let yaw = options.start?.yaw ?? Math.PI / 4;
  let pitch = options.start?.pitch ?? 0.75;
  let distance = options.start?.distance ?? 9;

  const onMouseMove = (e: MouseEvent): void => {
    if (paused || !input.isBindingActive('Mouse2')) return;
    const { mouseSensitivity, invertY } = getSettings().views.common;
    const k = 0.005 * (mouseSensitivity / 50);
    yaw -= e.movementX * k;
    pitch = Math.min(1.35, Math.max(0.25, pitch + e.movementY * k * (invertY ? -1 : 1)));
  };
  window.addEventListener('mousemove', onMouseMove);

  const isBlockedAt = (xM: number, zM: number): boolean =>
    blocked.has(`${Math.floor(xM / CELL_SIZE_M)},${Math.floor(zM / CELL_SIZE_M)}`);
  const canStand = (x: number, z: number): boolean =>
    !isBlockedAt(x - PLAYER_RADIUS_M, z - PLAYER_RADIUS_M) &&
    !isBlockedAt(x + PLAYER_RADIUS_M, z - PLAYER_RADIUS_M) &&
    !isBlockedAt(x - PLAYER_RADIUS_M, z + PLAYER_RADIUS_M) &&
    !isBlockedAt(x + PLAYER_RADIUS_M, z + PLAYER_RADIUS_M);

  function step(dt: number): void {
    if (input.isActionActive('rotateLeft')) yaw += CAMERA_YAW_SPEED * dt;
    if (input.isActionActive('rotateRight')) yaw -= CAMERA_YAW_SPEED * dt;
    if (input.isActionActive('zoomIn')) distance *= 0.9;
    if (input.isActionActive('zoomOut')) distance *= 1.1;
    distance = Math.min(ZOOM_MAX_M, Math.max(ZOOM_MIN_M, distance));

    let forward = 0;
    let right = 0;
    if (input.isActionActive('forward')) forward += 1;
    if (input.isActionActive('backward')) forward -= 1;
    if (input.isActionActive('right')) right += 1;
    if (input.isActionActive('left')) right -= 1;
    if (forward !== 0 || right !== 0) {
      const len = Math.hypot(forward, right);
      const speed = WALK_SPEED_M_S * (input.isActionActive('sprint') ? SPRINT_FACTOR : 1) * dt;
      // « Avant » = s'éloigner de la caméra.
      const dirX = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / len;
      const dirZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / len;
      const nx = playerX + dirX * speed;
      const nz = playerZ + dirZ * speed;
      if (canStand(nx, nz)) {
        playerX = nx;
        playerZ = nz;
      } else if (canStand(nx, playerZ)) playerX = nx;
      else if (canStand(playerX, nz)) playerZ = nz;
      const target = Math.atan2(dirX, dirZ);
      let delta = target - facing;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      facing += delta * Math.min(1, dt * 14);
    }
  }

  // --- Réglages, FPS, infos ----------------------------------------------------------------
  const fpsBox = document.createElement('div');
  fpsBox.className = 'fps-counter';
  container.appendChild(fpsBox);
  const debugBox = document.createElement('div');
  debugBox.className = 'debug-panel';
  container.appendChild(debugBox);
  let shadowsWereOn = initial.shadows !== 'off';
  let fpsLimit = initial.fpsLimit;
  let viewDistance = initial.viewDistance;

  function applySettings(s: Settings): void {
    const d = s.display;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP[d.quality]));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = d.shadows !== 'off';
    sun.castShadow = d.shadows !== 'off';
    const size = d.shadows === 'detailed' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    viewDistance = d.viewDistance;
    const far = d.viewDistance * CHUNK_SIZE_M;
    camera.far = far + CHUNK_SIZE_M;
    camera.updateProjectionMatrix();
    scene.fog = new THREE.Fog(SKY, far * 0.55, far);
    fpsLimit = d.fpsLimit;
    fpsBox.hidden = !d.showFps;
    debugBox.hidden = !d.showDebug;
    if (shadowsWereOn !== (d.shadows !== 'off')) {
      shadowsWereOn = d.shadows !== 'off';
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material.needsUpdate = true;
      });
    }
  }

  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  applySettings(getSettings());
  resize();
  const unsubscribe = onSettingsChange(applySettings);

  function updateDebug(): void {
    const gx = Math.floor(playerX / CELL_SIZE_M);
    const gz = Math.floor(playerZ / CELL_SIZE_M);
    const biome = generator.biomeAt(playerX, playerZ);
    const info = renderer.info;
    const lines = [
      `${t('debug.seed')} : ${game.world.seed}`,
      `${t('debug.position')} : ${playerX.toFixed(1)} m, ${playerZ.toFixed(1)} m`,
      `${t('debug.cell')} : ${gx}, ${gz}`,
      `${t('debug.chunk')} : ${Math.floor(gx / CHUNK_CELLS)}, ${Math.floor(gz / CHUNK_CELLS)}`,
      `${t('debug.biome')} : ${t(`biome.${biome}` as TranslationKey)}`,
      `${t('debug.chunks')} : ${chunks.size} / ${wanted.length}`,
      `${t('debug.draw')} : ${info.render.calls} · ${t('debug.tris')} : ${info.render.triangles}`,
      `${t('debug.starter')} :`,
      ...starterSites.map((site) => {
        const d = Math.hypot(site.xM - playerX, site.zM - playerZ);
        return `  ${t(`res.${site.id}` as TranslationKey)} : ${Math.round(site.xM)}, ${Math.round(site.zM)} (${Math.round(d)} m)`;
      }),
    ];
    debugBox.textContent = lines.join('\n');
  }

  // --- Boucle ------------------------------------------------------------------------------
  let last = 0;
  let lastFrame = 0;
  let frames = 0;
  let fpsSince = 0;
  let debugSince = 0;
  renderer.setAnimationLoop((now) => {
    if (fpsLimit > 0 && now - lastFrame < 1000 / fpsLimit - 1) return;
    lastFrame = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (!paused) step(dt);
    updateWanted(
      Math.floor(playerX / CHUNK_SIZE_M),
      Math.floor(playerZ / CHUNK_SIZE_M),
      viewDistance,
    );
    loadMissing();

    player.position.set(playerX, PLAYER_HEIGHT_M / 2, playerZ);
    player.rotation.y = facing;
    camera.position.set(
      playerX + Math.sin(yaw) * Math.cos(pitch) * distance,
      1 + Math.sin(pitch) * distance,
      playerZ + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(playerX, 1, playerZ);
    sun.position.set(playerX + 8, 16, playerZ + 6);
    sun.target.position.set(playerX, 0, playerZ);

    renderer.render(scene, camera);
    input.endFrame();

    frames++;
    if (now - fpsSince >= 500) {
      fpsBox.textContent = `${Math.round((frames * 1000) / (now - fpsSince))} FPS`;
      frames = 0;
      fpsSince = now;
    }
    if (now - debugSince >= 250) {
      debugSince = now;
      updateDebug();
    }
  });

  return {
    getState: () => ({ x: playerX, z: playerZ, yaw, pitch, distance }),
    setPaused: (value) => {
      paused = value;
    },
    dispose: () => {
      unsubscribe();
      input.detach();
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      for (const loaded of chunks.values()) loaded.mesh.dispose();
      chunks.clear();
      renderer.dispose();
      renderer.domElement.remove();
      fpsBox.remove();
      debugBox.remove();
    },
  };
}
