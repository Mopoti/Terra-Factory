import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import {
  DEFAULT_PLAYER_STATE,
  type GameSummary,
  type PlayerState,
  type ViewId,
} from '../core/save/saveIndex';
import { WorldGenerator } from '../core/world/worldgen';
import { t, type TranslationKey } from '../i18n';
import { Input } from '../input/input';
import type { ActionId } from '../settings/controls';
import type { Settings } from '../settings/schema';
import { getSettings, onSettingsChange } from '../settings/store';
import { edgePan, ghostRadiusPx } from './cameraMath';
import { CameraRig } from './cameraRig';
import { buildChunkMesh, ghostUniforms, type ChunkMesh } from './chunkMesh';

const PIXEL_RATIO_CAP = { low: 1, medium: 1.5, high: 3 } as const;
const SKY = 0x8fb8d8;

// Déplacement provisoire (le vrai personnage arrive plus tard).
const WALK_SPEED_M_S = 4.5;
const SPRINT_FACTOR = 1.7;
const PLAYER_RADIUS_M = 0.25;
const PLAYER_HEIGHT_M = 1.75;
const CAMERA_YAW_SPEED = 1.8;
/** Intervalle de répétition d'une action maintenue (zoom au clavier), en secondes. */
const REPEAT_S = 0.09;
/** Temps maximum passé à fabriquer des chunks par image (ms), pour éviter les saccades. */
const CHUNK_BUDGET_MS = 6;

export interface GameViewOptions {
  /** Position et caméra de départ (sauvegarde chargée, ou mode test ?dev=1&at=x,z&dist=d). */
  start?: Partial<PlayerState>;
  /** Appelé quand le joueur change de vue avec le clavier. */
  onViewChange?: (view: ViewId) => void;
  /** Appelé quand le navigateur libère la souris (Échap en 1ère personne) : ouvrir la pause. */
  onRequestPause?: () => void;
}

export interface GameViewHandle {
  dispose(): void;
  /** État actuel du joueur et de la caméra, pour l'enregistrer dans une sauvegarde. */
  getState(): PlayerState;
  /** En pause, le joueur et la caméra ne bougent plus (le monde reste affiché). */
  setPaused(paused: boolean): void;
}

/** Vue 3D d'une partie : monde infini généré autour d'un joueur, avec trois caméras. */
export function startGameView(
  container: HTMLElement,
  game: GameSummary,
  options: GameViewOptions = {},
): GameViewHandle {
  const state: PlayerState = { ...DEFAULT_PLAYER_STATE, ...options.start };
  const initial = getSettings().display;
  const renderer = new THREE.WebGLRenderer({ antialias: initial.quality !== 'low' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 500);
  scene.add(camera);

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
  let playerX = state.x;
  let playerZ = state.z;
  let facing = 0;

  // Outil (provisoire : une pioche simple). Tenu à la main du personnage (3ème personne, vue du
  // dessus) et, en 1ère personne, fixé à la caméra.
  const handle = new THREE.MeshStandardMaterial({ color: 0x7a4e24 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa9b2bb });
  function makeTool(): THREE.Group {
    const tool = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), metal);
    head.position.z = 0.32;
    tool.add(shaft, head);
    tool.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return tool;
  }
  const hand = makeTool();
  hand.position.set(0.28, -0.26, -0.55);
  hand.rotation.set(0.15, -0.25, 0);
  camera.add(hand);
  const bodyTool = makeTool();
  bodyTool.scale.setScalar(1.15);
  // Le personnage regarde vers +z (son repère local) : l'outil est à droite et devant.
  bodyTool.position.set(-0.34, 0.1, 0.32);
  bodyTool.rotation.set(-0.5, 0, 0);
  player.add(bodyTool);

  const rig = new CameraRig(camera, state);

  // --- Chunks ------------------------------------------------------------------------------
  const chunks = new Map<string, ChunkMesh>();
  const blocked = new Set<string>();
  const obstacles = new Map<string, number>();
  let wanted: { cx: number; cz: number }[] = [];
  let wantedKey = '';

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
    for (const [k, mesh] of chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > keep) {
        scene.remove(mesh.group);
        mesh.dispose();
        for (const cell of mesh.blocked) blocked.delete(cell);
        for (const [cell] of mesh.tall) obstacles.delete(cell);
        chunks.delete(k);
      }
    }
  }

  function loadMissing(): void {
    const start = performance.now();
    for (const { cx, cz } of wanted) {
      if (performance.now() - start > CHUNK_BUDGET_MS) return;
      const key = `${cx},${cz}`;
      if (chunks.has(key)) continue;
      const mesh = buildChunkMesh(generator, generator.chunk(cx, cz));
      scene.add(mesh.group);
      for (const cell of mesh.blocked) blocked.add(cell);
      for (const [cell, height] of mesh.tall) obstacles.set(cell, height);
      chunks.set(key, mesh);
    }
  }

  // --- Entrées -----------------------------------------------------------------------------
  const input = new Input(renderer.domElement);
  input.attach();
  let paused = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  const isLocked = (): boolean => document.pointerLockElement === renderer.domElement;

  const onMouseMove = (e: MouseEvent): void => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (paused) return;
    if (isLocked() || input.isBindingActive('Mouse2')) {
      rig.look(e.movementX, e.movementY, getSettings().views);
    }
  };
  window.addEventListener('mousemove', onMouseMove);
  const onMouseUp = (): void => rig.endLook(getSettings().views);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onMouseUp);

  const requestLock = (): void => {
    if (paused || rig.view !== 'first' || isLocked()) return;
    void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => undefined);
  };
  renderer.domElement.addEventListener('click', requestLock);
  let wasLocked = false;
  /** Vrai quand c'est le jeu qui libère la souris (changement de vue, pause) : ce n'est pas un Échap. */
  let releasingOnPurpose = false;
  function releaseLock(): void {
    if (!isLocked()) return;
    releasingOnPurpose = true;
    document.exitPointerLock();
  }
  const onLockChange = (): void => {
    const locked = isLocked();
    if (!locked && releasingOnPurpose) {
      releasingOnPurpose = false;
    } else if (wasLocked && !locked && !paused) {
      // Le navigateur a libéré la souris (le joueur a appuyé sur Échap) : on ouvre la pause.
      options.onRequestPause?.();
    }
    wasLocked = locked;
  };
  document.addEventListener('pointerlockchange', onLockChange);

  const previouslyActive = new Set<ActionId>();
  /** Vrai à l'appui sur la touche (une seule fois par appui). */
  function pressed(action: ActionId): boolean {
    const now = input.isActionActive(action);
    const was = previouslyActive.has(action);
    if (now) previouslyActive.add(action);
    else previouslyActive.delete(action);
    return now && !was;
  }
  const repeatTimers = new Map<ActionId, number>();
  /** Vrai à l'appui puis à intervalle régulier tant que la touche est maintenue. */
  function repeating(action: ActionId, dt: number): boolean {
    if (!input.isActionActive(action)) {
      repeatTimers.delete(action);
      return false;
    }
    const left = repeatTimers.get(action);
    if (left === undefined) {
      repeatTimers.set(action, REPEAT_S);
      return true;
    }
    if (left - dt <= 0) {
      repeatTimers.set(action, REPEAT_S);
      return true;
    }
    repeatTimers.set(action, left - dt);
    return false;
  }

  function switchView(view: ViewId | 'cycle'): void {
    const views = getSettings().views;
    const before = rig.view;
    if (view === 'cycle') rig.cycleView(views);
    else rig.setView(view, views);
    if (rig.view === before) return;
    if (rig.view !== 'first') releaseLock();
    if (rig.view === 'first') requestLock();
    options.onViewChange?.(rig.view);
  }

  const isBlockedAt = (xM: number, zM: number): boolean =>
    blocked.has(`${Math.floor(xM / CELL_SIZE_M)},${Math.floor(zM / CELL_SIZE_M)}`);
  const canStand = (x: number, z: number): boolean =>
    !isBlockedAt(x - PLAYER_RADIUS_M, z - PLAYER_RADIUS_M) &&
    !isBlockedAt(x + PLAYER_RADIUS_M, z - PLAYER_RADIUS_M) &&
    !isBlockedAt(x - PLAYER_RADIUS_M, z + PLAYER_RADIUS_M) &&
    !isBlockedAt(x + PLAYER_RADIUS_M, z + PLAYER_RADIUS_M);
  const obstacleAt = (x: number, y: number, z: number): boolean => {
    const h = obstacles.get(`${Math.floor(x / CELL_SIZE_M)},${Math.floor(z / CELL_SIZE_M)}`);
    return h !== undefined && y < h;
  };

  /** Déplace le joueur ; renvoie sa vitesse (m/s) et son mouvement latéral. */
  function step(dt: number): { speed: number; strafe: number } {
    const views = getSettings().views;
    let forward = 0;
    let right = 0;
    if (input.isActionActive('forward')) forward += 1;
    if (input.isActionActive('backward')) forward -= 1;
    if (input.isActionActive('right')) right += 1;
    if (input.isActionActive('left')) right -= 1;
    if (forward === 0 && right === 0) return { speed: 0, strafe: 0 };

    const len = Math.hypot(forward, right);
    const speed = WALK_SPEED_M_S * (input.isActionActive('sprint') ? SPRINT_FACTOR : 1);
    const yaw = rig.yaw;
    // « Avant » = la direction vers laquelle regarde la caméra.
    const dirX = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / len;
    const dirZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / len;
    const nx = playerX + dirX * speed * dt;
    const nz = playerZ + dirZ * speed * dt;
    const ox = playerX;
    const oz = playerZ;
    if (canStand(nx, nz)) {
      playerX = nx;
      playerZ = nz;
    } else if (canStand(nx, playerZ)) playerX = nx;
    else if (canStand(playerX, nz)) playerZ = nz;
    const moved = Math.hypot(playerX - ox, playerZ - oz);

    const target = Math.atan2(dirX, dirZ);
    let delta = target - facing;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    facing += delta * Math.min(1, dt * 14);
    if (rig.view === 'third' && views.third.autoRotate && moved > 0)
      rig.followHeading(dirX, dirZ, dt);
    return { speed: dt > 0 ? moved / dt : 0, strafe: right / len };
  }

  // --- Réticule, indice, réglages, FPS, infos ----------------------------------------------
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  container.appendChild(crosshair);
  const hint = document.createElement('div');
  hint.className = 'look-hint';
  hint.textContent = t('hint.mouseLook');
  container.appendChild(hint);
  const fpsBox = document.createElement('div');
  fpsBox.className = 'fps-counter';
  container.appendChild(fpsBox);
  const debugBox = document.createElement('div');
  debugBox.className = 'debug-panel';
  container.appendChild(debugBox);
  let shadowsWereOn = initial.shadows !== 'off';
  let fpsLimit = initial.fpsLimit;
  let viewDistance = initial.viewDistance;

  const CROSSHAIR_COLORS = {
    white: '#ffffff',
    orange: '#ff9d3a',
    green: '#5fe06a',
    red: '#ff5a4d',
    cyan: '#55e0ff',
  } as const;

  function applyCrosshair(s: Settings): void {
    const c = s.views.first;
    crosshair.dataset.style = c.crosshairStyle;
    const size = 8 + (36 * (c.crosshairSize - 10)) / 90;
    crosshair.style.setProperty('--size', `${size}px`);
    crosshair.style.setProperty('--color', CROSSHAIR_COLORS[c.crosshairColor]);
  }

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
    rig.applyViewSettings(s.views);
    applyCrosshair(s);
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
      `${t('debug.view')} : ${t(`view.${rig.view}` as TranslationKey)}`,
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

  /** Aura de transparence autour du joueur (3ème personne et vue du dessus). */
  const chest = new THREE.Vector3();
  function updateGhost(views: Settings['views']): void {
    const on =
      rig.view === 'third' ? views.third.ghost : rig.view === 'top' ? views.top.ghost : false;
    ghostUniforms.uGhostOn.value = on ? 1 : 0;
    if (!on) return;
    const pct = rig.view === 'third' ? views.third.ghostRadius : views.top.ghostRadius;
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    chest.set(playerX, 1.0, playerZ);
    const ndc = chest.clone().project(camera);
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    ghostUniforms.uGhostCenter.value.set((ndc.x * 0.5 + 0.5) * w, (ndc.y * 0.5 + 0.5) * h);
    ghostUniforms.uGhostDepth.value = -chest.applyMatrix4(camera.matrixWorldInverse).z;
    ghostUniforms.uGhostRadius.value = Math.max(1, ghostRadiusPx(pct, h));
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
    const views = getSettings().views;

    let motion = { speed: 0, strafe: 0 };
    if (!paused) {
      if (pressed('cycleView')) switchView('cycle');
      if (pressed('viewFirst')) switchView('first');
      if (pressed('viewThird')) switchView('third');
      if (pressed('viewTop')) switchView('top');

      const stepRotation = rig.view === 'top' && views.top.rotation === 'step';
      if (stepRotation) {
        if (pressed('rotateLeft')) rig.rotateStep(-1, views);
        if (pressed('rotateRight')) rig.rotateStep(1, views);
      } else {
        if (input.isActionActive('rotateLeft')) rig.rotate(CAMERA_YAW_SPEED * dt, views);
        if (input.isActionActive('rotateRight')) rig.rotate(-CAMERA_YAW_SPEED * dt, views);
      }
      if (repeating('zoomIn', dt)) rig.zoom(1, views);
      if (repeating('zoomOut', dt)) rig.zoom(-1, views);
      motion = step(dt);
    }

    updateWanted(
      Math.floor(playerX / CHUNK_SIZE_M),
      Math.floor(playerZ / CHUNK_SIZE_M),
      viewDistance,
    );
    loadMissing();

    const edge =
      rig.view === 'top' && views.top.edgeScroll && !paused && !isLocked()
        ? edgePan(mouseX, mouseY, window.innerWidth, window.innerHeight)
        : { x: 0, y: 0 };
    rig.update(dt, { x: playerX, z: playerZ }, motion, views, edge, obstacleAt);

    player.visible = rig.view !== 'first';
    player.position.set(playerX, PLAYER_HEIGHT_M / 2, playerZ);
    player.rotation.y = facing;
    hand.visible = rig.view === 'first' && views.first.showHands;
    bodyTool.visible = rig.view !== 'first';
    crosshair.hidden = rig.view !== 'first' || views.first.crosshairStyle === 'none';
    hint.hidden = !(rig.view === 'first' && !paused && !isLocked());
    sun.position.set(playerX + 8, 16, playerZ + 6);
    sun.target.position.set(playerX, 0, playerZ);
    updateGhost(views);

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
    getState: () => ({ x: playerX, z: playerZ, ...rig.getState() }),
    setPaused: (value) => {
      paused = value;
      if (value) {
        releaseLock();
      } else requestLock();
    },
    dispose: () => {
      unsubscribe();
      input.detach();
      renderer.setAnimationLoop(null);
      releaseLock();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      renderer.domElement.removeEventListener('click', requestLock);
      ghostUniforms.uGhostOn.value = 0;
      for (const mesh of chunks.values()) mesh.dispose();
      chunks.clear();
      renderer.dispose();
      renderer.domElement.remove();
      crosshair.remove();
      hint.remove();
      fpsBox.remove();
      debugBox.remove();
    },
  };
}
