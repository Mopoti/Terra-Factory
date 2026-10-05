import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import { cellOnPlane } from '../core/build/aim';
import {
  evaluatePlan,
  planRect,
  planWall,
  posCenter,
  rayOnEdgePlane,
  type PlanItem,
  type WallCoord,
} from '../core/build/plan';
import { edgeKeysToRemove, type PiecePos } from '../core/build/pieces';
import {
  BUILD_REACH_M,
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  MATERIALS,
  STOREY_HEIGHT_M,
  PIECE_TYPES,
  kindFor,
  pieceDef,
  type Material,
  type PieceKind,
  type PieceType,
} from '../core/data/buildings';
import {
  DEFAULT_PLAYER_STATE,
  type GameSummary,
  type PlayerState,
  type ViewId,
} from '../core/save/saveIndex';
import type { GameState } from '../core/game/state';
import { applyChanges } from '../core/game/worldChanges';
import { WorldGenerator } from '../core/world/worldgen';
import { t, type TranslationKey } from '../i18n';
import { Input } from '../input/input';
import type { ActionId } from '../settings/controls';
import type { Settings } from '../settings/schema';
import { getSettings, onSettingsChange } from '../settings/store';
import { edgePan, ghostRadiusPx } from './cameraMath';
import { CameraRig } from './cameraRig';
import { buildChunkMesh, ghostUniforms, type ChunkMesh } from './chunkMesh';
import { bodyBlocked, ceilingAbove, groundAt, stepVertical } from '../core/game/physics';
import { BuildingView, type BuildAim } from './buildingView';
import { Interaction } from './interaction';

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
  /** Sac et changements du monde (récolte, objets au sol). */
  state: GameState;
  /** La touche « Inventaire » a été pressée. */
  onToggleInventory?: () => void;
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
  /** Jette des objets du sac au sol, devant le joueur. */
  dropItem(item: string, count: number): void;
}

/** Vue 3D d'une partie : monde infini généré autour d'un joueur, avec trois caméras. */
export function startGameView(
  container: HTMLElement,
  game: GameSummary,
  options: GameViewOptions,
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
  sun.shadow.normalBias = 0.03;
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
  let playerY = state.y;
  let velY = 0;
  let onGround = playerY === 0;
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
  // En main, la tête de la pioche est loin devant (vers -z de la caméra), le manche vers soi.
  hand.position.set(0.34, -0.36, -0.85);
  hand.rotation.set(0.5, Math.PI + 0.35, 0);
  hand.scale.setScalar(0.85);
  camera.add(hand);
  const bodyTool = makeTool();
  bodyTool.scale.setScalar(1.15);
  // Le personnage regarde vers +z (son repère local) : l'outil est à droite et devant.
  bodyTool.position.set(-0.34, 0.1, 0.32);
  bodyTool.rotation.set(-0.5, 0, 0);
  player.add(bodyTool);

  const rig = new CameraRig(camera, state);
  const interaction: Interaction = new Interaction(scene, camera, options.state, container, {
    rebuildChunk: (cx, cz) => buildInto(cx, cz),
  });

  // --- Construction ------------------------------------------------------------------------
  const buildingView = new BuildingView(scene);
  buildingView.rebuild(options.state.changes.pieces);
  let building = false;
  let buildType: PieceType = 'wall';
  let buildMaterial: Material = 'stone';
  let buildLevel = 0;
  /** Bloc de mur visé (0 à 4), ou null = tout l'étage : sert à faire des fenêtres et des trous. */
  let wallHeight = 1;
  let dragStart: BuildAim | null = null;
  let lastPlan: PlanItem[] = [];
  const buildKind = (): PieceKind => kindFor(buildType, buildMaterial);
  const buildHud = document.createElement('div');
  buildHud.className = 'build-hud';
  buildHud.hidden = true;
  container.appendChild(buildHud);
  const buildRay = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  let buildMessage = '';
  const itemLabel = (id: string): string => t(`item.${id}` as TranslationKey);
  const stockOf = (kind: PieceKind): number => options.state.inventory[pieceDef(kind).item] ?? 0;
  function renderBuildHud(): void {
    const rooms = options.state.rooms().length;
    const here = options.state
      .rooms()
      .some(
        (r) =>
          r.level === 0 &&
          r.cells.includes(
            `${Math.floor(playerX / CELL_SIZE_M)},${Math.floor(playerZ / CELL_SIZE_M)}`,
          ),
      );
    const kind = buildKind();
    const types = PIECE_TYPES.map(
      (ty, i) =>
        `<span class="${ty === buildType ? 'sel' : ''}${stockOf(kindFor(ty, buildMaterial)) > 0 ? '' : ' poor'}">${i + 1} ${t(`build.piece.${ty}` as TranslationKey)}</span>`,
    ).join('');
    const mats = MATERIALS.map(
      (m, i) =>
        `<span class="${pieceDef(kind).material === m ? 'sel' : ''}">${i + 5} ${t(`build.material.${m}` as TranslationKey)}</span>`,
    ).join('');
    const wall =
      buildType === 'wall'
        ? `<div>${t('build.wallHeight', { n: String(wallHeight), cm: String(wallHeight * 50) })}</div>`
        : '';
    const ok = lastPlan.filter((i) => i.status === 'ok').length;
    const lack = lastPlan.filter(
      (i) => i.status === 'lack' || i.status === 'far' || i.status === 'unsupported',
    ).length;
    const plan = dragStart
      ? `<div>${t('build.plan', { ok: String(ok), lack: String(lack) })}</div>`
      : '';
    buildHud.innerHTML = `<strong>${t('build.title')} · ${t('build.level', { n: String(buildLevel) })}</strong><div class="pieces">${types}</div><div class="pieces">${mats}</div>${wall}<div>${t('build.owned', { item: `${itemLabel(pieceDef(kind).item)} : ${stockOf(kind)}` })}</div>${plan}<div>${t('build.rooms', { n: String(rooms) })}${here ? ` · ${t('build.inRoom')}` : ''}</div><div class="msg">${buildMessage}</div><small>${t('build.help')}</small>`;
  }
  const unsubscribeBuild = options.state.onChange((e) => {
    if (e.type === 'build') buildingView.rebuild(options.state.changes.pieces);
    if (building && (e.type === 'build' || e.type === 'inventory')) renderBuildHud();
  });

  function buildAim(mode: 'place' | 'remove' = 'place'): BuildAim | null {
    if (rig.view === 'first') {
      camera.getWorldPosition(rayOrigin);
      camera.getWorldDirection(rayDir);
    } else {
      buildRay.setFromCamera(
        new THREE.Vector2(
          (mouseX / window.innerWidth) * 2 - 1,
          -(mouseY / window.innerHeight) * 2 + 1,
        ),
        camera,
      );
      rayOrigin.copy(buildRay.ray.origin);
      rayDir.copy(buildRay.ray.direction);
    }
    return buildingView.aim(
      rayOrigin,
      rayDir,
      buildKind(),
      buildLevel,
      options.state.changes.pieces,
      rig.view === 'top' ? 120 : BUILD_REACH_M + 4,
      mode,
    );
  }

  /** Bloc de mur sous le curseur (hauteur), en 1ère et 3ème personne ; en vue du dessus on ne peut pas viser en hauteur. */
  function hoverCoord(edge: BuildAim): WallCoord | null {
    if (rig.view === 'top') return null;
    const axis = edge.pos.axis ?? 'x';
    const line = axis === 'x' ? edge.pos.gz : edge.pos.gx;
    return rayOnEdgePlane(rayOrigin, rayDir, axis, line, buildLevel * STOREY_HEIGHT_M);
  }
  let dragLayer = 0;

  /** Pièces visées : une seule, ou toute la surface / le pan de mur tracé en gardant le clic enfoncé. */
  function planFor(aim: BuildAim): PiecePos[] {
    const kind = buildKind();
    const start = dragStart ?? aim;
    if (aim.pos.slot !== 'edge') {
      if (aim.pos.slot === 'ceiling' && dragStart) {
        // La dalle reste à la hauteur du mur choisi au départ : on prolonge dans ce plan.
        const layer = start.pos.layer ?? 0;
        const end =
          cellOnPlane(
            rayOrigin,
            rayDir,
            buildLevel * STOREY_HEIGHT_M + (layer + 1) * LAYER_HEIGHT_M,
          ) ?? aim.cell;
        return planRect(kind, buildLevel, start.cell, end, layer);
      }
      return planRect(kind, buildLevel, start.cell, aim.cell, aim.pos.layer);
    }
    const axis = start.pos.axis ?? 'x';
    const i0 = axis === 'x' ? start.pos.gx : start.pos.gz;
    const line = axis === 'x' ? start.pos.gz : start.pos.gx;
    const iGround = axis === 'x' ? aim.cell.gx : aim.cell.gz;
    if (!dragStart) {
      // Avant d'appuyer : le seul bloc visé.
      const layer = aim.pos.layer ?? 0;
      return planWall(kind, buildLevel, axis, line, { i: i0, layer }, { i: i0, layer });
    }
    const a = { i: i0, layer: dragLayer };
    if (rig.view === 'top') {
      // Vue du dessus : on ne vise pas en hauteur, la hauteur est celle réglée avec Début / Fin.
      const upTo = Math.min(LAYERS_PER_STOREY - 1, dragLayer + wallHeight - 1);
      return planWall(kind, buildLevel, axis, line, a, { i: iGround, layer: upTo });
    }
    // 1ère / 3ème personne : le pan de mur va du bloc de départ au bloc visé.
    const over = hoverCoord(start);
    return planWall(kind, buildLevel, axis, line, a, over ?? { i: iGround, layer: dragLayer });
  }

  let removeCooldown = 0;
  function updateBuild(dt: number): void {
    const kind = buildKind();
    const aim = buildAim();
    const down = input.isActionActive('interact');
    const player = { x: playerX, z: playerZ };
    if (!aim) {
      buildingView.hideGhost();
      if (!down) dragStart = null;
      return;
    }

    // Démolir en maintenant la touche : on balaie avec le curseur, bloc par bloc.
    if (input.isActionActive('remove')) {
      buildingView.hideGhost();
      removeCooldown -= dt;
      const target = buildAim('remove');
      if (target && removeCooldown <= 0) {
        const c = posCenter(target.pos);
        if (Math.hypot(c.x - playerX, c.z - playerZ) <= BUILD_REACH_M) {
          const keys =
            target.pos.slot === 'edge'
              ? edgeKeysToRemove(options.state.changes.pieces, target.pos, [target.pos.layer ?? 0])
              : options.state.changes.pieces[target.key]
                ? [target.key]
                : [];
          if (keys.length > 0) {
            options.state.removeKeys(keys, player);
            removeCooldown = 0.08;
          }
        }
      }
      return;
    }
    removeCooldown = 0;

    if (down && !dragStart) {
      dragStart = aim;
      dragLayer = aim.pos.layer ?? 0;
    }
    lastPlan = evaluatePlan(
      kind,
      planFor(aim),
      options.state.changes.pieces,
      stockOf(kind),
      player,
      BUILD_REACH_M,
    );
    buildingView.showGhosts(lastPlan, kind);
    if (!down && dragStart) {
      // Relâchement : on pose tout ce qui est en vert.
      const ok = lastPlan
        .filter((i) => i.status === 'ok')
        .sort((p, q) => (p.seq ?? 0) - (q.seq ?? 0))
        .map((i) => i.pos);
      const lacking = lastPlan.filter((i) => i.status === 'lack').length;
      const floating = lastPlan.filter((i) => i.status === 'unsupported').length;
      const placed = options.state.placeMany(kind, ok);
      buildMessage =
        placed > 0
          ? ''
          : floating > 0
            ? t(buildType === 'ceiling' ? 'build.unsupportedCeiling' : 'build.unsupported')
            : lacking > 0
              ? t('build.missing')
              : lastPlan.length > 0
                ? t('build.tooFar')
                : '';
      dragStart = null;
      lastPlan = [];
      renderBuildHud();
    } else if (down) {
      renderBuildHud();
    }
  }

  function setBuilding(value: boolean): void {
    building = value;
    buildHud.hidden = !value;
    dragStart = null;
    lastPlan = [];
    if (!value) buildingView.hideGhost();
    else renderBuildHud();
  }

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
        interaction.unregisterChunk(k);
        chunks.delete(k);
      }
    }
  }

  /** Fabrique (ou refabrique) un chunk en tenant compte de ce que le joueur a changé. */
  function buildInto(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    const old = chunks.get(key);
    if (old) {
      scene.remove(old.group);
      old.dispose();
      for (const cell of old.blocked) blocked.delete(cell);
      for (const [cell] of old.tall) obstacles.delete(cell);
    }
    const data = applyChanges(generator.chunk(cx, cz), options.state.changes);
    const mesh = buildChunkMesh(generator, data);
    scene.add(mesh.group);
    for (const cell of mesh.blocked) blocked.add(cell);
    for (const [cell, height] of mesh.tall) obstacles.set(cell, height);
    chunks.set(key, mesh);
    interaction.registerChunk(key, data);
  }

  function loadMissing(): void {
    const start = performance.now();
    for (const { cx, cz } of wanted) {
      if (performance.now() - start > CHUNK_BUDGET_MS) return;
      if (!chunks.has(`${cx},${cz}`)) buildInto(cx, cz);
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
  const canStand = (x: number, z: number): boolean => {
    const pieces = options.state.changes.pieces;
    for (const dx of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
      for (const dz of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
        if (isBlockedAt(x + dx, z + dz)) return false;
        if (bodyBlocked(pieces, x + dx, z + dz, playerY, PLAYER_HEIGHT_M)) return false;
      }
    }
    return true;
  };
  const FOOT_SAMPLES: [number, number][] = [
    [0, 0],
    [0.2, 0],
    [-0.2, 0],
    [0, 0.2],
    [0, -0.2],
  ];
  /** Saut, gravité, se tenir sur une dalle ou sur la tranche d'un mur. */
  function stepBody(dt: number): void {
    const pieces = options.state.changes.pieces;
    let ground = 0;
    for (const [dx, dz] of FOOT_SAMPLES) {
      ground = Math.max(ground, groundAt(pieces, playerX + dx, playerZ + dz, playerY));
    }
    const roof = ceilingAbove(pieces, playerX, playerZ, playerY + PLAYER_HEIGHT_M, playerY);
    const next = stepVertical(
      { y: playerY, vy: velY, onGround },
      dt,
      ground,
      roof,
      PLAYER_HEIGHT_M,
      input.isActionActive('jump'),
    );
    playerY = next.y;
    velY = next.vy;
    onGround = next.onGround;
  }
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
      `${t('debug.position')} : ${playerX.toFixed(1)} m, ${playerZ.toFixed(1)} m · ${t('debug.height')} ${playerY.toFixed(2)} m`,
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
    chest.set(playerX, playerY + 1.0, playerZ);
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
    const realDt = Math.min(0.5, (now - last) / 1000);
    const dt = Math.min(0.1, realDt);
    last = now;
    const views = getSettings().views;

    if (pressed('inventory')) options.onToggleInventory?.();

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
      if (pressed('buildMode')) setBuilding(!building);
      if (building) {
        PIECE_TYPES.forEach((ty, i) => {
          if (pressed(`hotbar${i + 1}` as ActionId)) {
            buildType = ty;
            buildMessage = '';
            renderBuildHud();
          }
        });
        MATERIALS.forEach((m, i) => {
          if (pressed(`hotbar${i + 5}` as ActionId)) {
            buildMaterial = m;
            renderBuildHud();
          }
        });
        if (pressed('levelUp')) {
          buildLevel = Math.min(9, buildLevel + 1);
          renderBuildHud();
        }
        if (pressed('levelDown')) {
          buildLevel = Math.max(0, buildLevel - 1);
          renderBuildHud();
        }
        // Hauteur du mur : tout l'étage, puis un bloc à la fois (pour les fenêtres et les trous).
        if (pressed('layerUp')) {
          wallHeight = Math.min(LAYERS_PER_STOREY, wallHeight + 1);
          renderBuildHud();
        }
        if (pressed('layerDown')) {
          wallHeight = Math.max(1, wallHeight - 1);
          renderBuildHud();
        }
      }
      if (repeating('zoomIn', dt)) rig.zoom(1, views);
      if (repeating('zoomOut', dt)) rig.zoom(-1, views);
      motion = step(dt);
      stepBody(dt);
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
    rig.update(dt, { x: playerX, y: playerY, z: playerZ }, motion, views, edge, obstacleAt);

    player.visible = rig.view !== 'first';
    player.position.set(playerX, playerY + PLAYER_HEIGHT_M / 2, playerZ);
    player.rotation.y = facing;
    hand.visible = rig.view === 'first' && views.first.showHands;
    bodyTool.visible = rig.view !== 'first';
    crosshair.hidden = rig.view !== 'first' || views.first.crosshairStyle === 'none';
    hint.hidden = !(rig.view === 'first' && !paused && !isLocked());
    sun.position.set(playerX + 8, 16, playerZ + 6);
    sun.target.position.set(playerX, 0, playerZ);
    updateGhost(views);
    // Les étages au-dessus du joueur sont masqués (sauf celui qu'on est en train de construire).
    const pcell = `${Math.floor(playerX / CELL_SIZE_M)},${Math.floor(playerZ / CELL_SIZE_M)}`;
    const inRoom = options.state.rooms().find((r) => r.level === 0 && r.cells.includes(pcell));
    buildingView.setVisibility(
      building ? buildLevel : 0,
      inRoom && !building ? inRoom.level : null,
    );
    if (building && !paused) updateBuild(dt);
    interaction.update({
      // Temps réel : sur un ordinateur lent, la récolte ne doit pas ralentir.
      dt: realDt,
      player: { x: playerX, z: playerZ },
      active: !paused && !building && input.isActionActive('interact'),
      paused,
      aimAtCenter: rig.view === 'first',
      mouse: { x: mouseX, y: mouseY },
      viewport: { w: window.innerWidth, h: window.innerHeight },
    });

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
      if (building) renderBuildHud();
    }
  });

  return {
    getState: () => ({ x: playerX, y: playerY, z: playerZ, ...rig.getState() }),
    dropItem: (item, count) => {
      // Devant le joueur ; sur place si l'emplacement est bloqué.
      const heading = rig.view === 'first' ? rig.yaw : facing + Math.PI;
      let x = playerX - Math.sin(heading) * 1.1;
      let z = playerZ - Math.cos(heading) * 1.1;
      if (isBlockedAt(x, z)) {
        x = playerX;
        z = playerZ;
      }
      interaction.dropItem(item, count, x, z);
    },
    setPaused: (value) => {
      paused = value;
      if (value) {
        releaseLock();
      } else requestLock();
    },
    dispose: () => {
      unsubscribe();
      interaction.dispose();
      unsubscribeBuild();
      buildingView.dispose();
      buildHud.remove();
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
