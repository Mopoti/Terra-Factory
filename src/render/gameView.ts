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
import { edgeKeysToRemove, parseKey, type PiecePos } from '../core/build/pieces';
import {
  BUILD_REACH_M,
  PIECES,
  resolveKind,
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  STOREY_HEIGHT_M,
  pieceDef,
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
import {
  bodyBlocked,
  ceilingAbove,
  groundAt,
  stepVertical,
  surfaceMaterialAt,
} from '../core/game/physics';
import { playSfx } from '../audio/sfx';
import { pickPiece } from '../core/build/pick';
import { riseFromDirection } from '../core/build/aim';
import { RISE_DIR } from '../core/data/buildings';
import { machineDef, machineForItem, type MachineDef } from '../core/data/machines';
import {
  Factory,
  dims,
  emptyMachine,
  outputCell,
  pickMachine,
  type Cell,
  type FactoryWorld,
  type Machine,
} from '../core/factory/factory';
import { cellKey } from '../core/game/worldChanges';
import { resourceById, type DepositResource } from '../core/data/resources';
import { FactoryView } from './factoryView';
import type { Structure } from './interaction';
import { BuildingView, type BuildAim } from './buildingView';
import { Interaction } from './interaction';

const PIXEL_RATIO_CAP = { low: 1, medium: 1.5, high: 3 } as const;
const SKY = 0x8fb8d8;

// Déplacement provisoire (le vrai personnage arrive plus tard).
const WALK_SPEED_M_S = 4.5;
const SPRINT_FACTOR = 1.7;
const PLAYER_RADIUS_M = 0.25;
const PLAYER_HEIGHT_M = 1.7;
const CAMERA_YAW_SPEED = 1.8;
/** Distance entre deux pas (m). */
const STRIDE_M = 1.35;
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
  /** Le joueur veut ouvrir l'interface de la machine visée (touche « Utiliser »). */
  onOpenMachine?: (id: number) => void;
}

export interface GameViewHandle {
  dispose(): void;
  /** État actuel du joueur et de la caméra, pour l'enregistrer dans une sauvegarde. */
  getState(): PlayerState;
  /** En pause, le joueur et la caméra ne bougent plus (le monde reste affiché). */
  setPaused(paused: boolean): void;
  /** Jette des objets du sac au sol, devant le joueur. */
  dropItem(item: string, count: number): void;
  /** L'usine (machines et tapis) de la partie, pour l'interface des machines. */
  factory: Factory;
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
    pickStructure: (o, d) => structureAt(o, d),
    demolish: (id) => demolishStructure(id),
  });

  // --- Usine : monde des minerais, simulation, affichage ---------------------------------------
  const oreCache = new Map<string, Map<string, { id: string; amount: number }>>();
  const oreCellAt = (gx: number, gz: number): { id: string; amount: number } | null => {
    const cx = Math.floor(gx / CHUNK_CELLS);
    const cz = Math.floor(gz / CHUNK_CELLS);
    const key = `${cx},${cz}`;
    let cells = oreCache.get(key);
    if (!cells) {
      cells = new Map(generator.chunk(cx, cz).ore.map((o) => [cellKey(o.gx, o.gz), o]));
      oreCache.set(key, cells);
    }
    return cells.get(cellKey(gx, gz)) ?? null;
  };
  const dirtyChunks = new Set<string>();
  const factoryWorld: FactoryWorld = {
    oreAt: (gx, gz) => {
      const ore = oreCellAt(gx, gz);
      if (!ore) return null;
      const left = ore.amount - (options.state.changes.taken[cellKey(gx, gz)] ?? 0);
      return left > 0
        ? { id: ore.id, item: (resourceById(ore.id) as DepositResource).harvest.item, amount: left }
        : null;
    },
    mineOre: (gx, gz, units) => {
      const ore = oreCellAt(gx, gz);
      if (!ore) return 0;
      const n = options.state.takeFromWorld(cellKey(gx, gz), ore.amount, units);
      if (n > 0) dirtyChunks.add(`${Math.floor(gx / CHUNK_CELLS)},${Math.floor(gz / CHUNK_CELLS)}`);
      return n;
    },
  };
  const factory = new Factory(options.state.changes.machines, factoryWorld);
  const factoryView = new FactoryView(scene, factory);
  let simAcc = 0;
  let itemsTimer = 0;
  let chunkTimer = 0;
  let panelTimer = 0;

  // --- Construction ------------------------------------------------------------------------
  const buildingView = new BuildingView(scene);
  buildingView.rebuild(options.state.changes.pieces);
  /** On construit tant qu'une case de la barre de raccourcis contenant une pièce est sélectionnée. */
  let building = false;
  let buildLevel = 0;
  /** Orientation en quarts de tour (touche R), `null` = automatique (le bord le plus proche, contre le mur visé). Pour un mur : pair = le long de x, impair = le long de z. */
  let buildRot: number | null = null;
  let lastBuildItem: string | null = null;
  let wallHeight = 1;
  let dragStart: BuildAim | null = null;
  let lastPlan: PlanItem[] = [];
  const selectedKind = (): PieceKind | null => {
    const item = options.state.selectedItem();
    const matches = PIECES.filter((p) => p.item === item);
    return (matches.find((p) => p.type === 'slab') ?? matches[0])?.id ?? null;
  };
  const buildKind = (): PieceKind => selectedKind() ?? 'wall_stone';
  const buildType = (): PieceType => pieceDef(buildKind()).type;
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
  const center = (g: number): number => (g + 0.5) * CELL_SIZE_M;
  function renderBuildHud(): void {
    if (buildingMachine) {
      const def = selectedMachine();
      if (!def) return;
      const n = options.state.inventory[def.item] ?? 0;
      const rot =
        buildRot === null
          ? t('build.rotationAuto')
          : t('build.rotation', { deg: String(buildRot * 90) });
      buildHud.innerHTML = `<strong>${itemLabel(def.item)} · ${rot}</strong><div>${t('build.stock', { n: String(n) })}</div><div class="msg">${buildMessage}</div><small>${t(def.id === 'conveyor' ? 'factory.helpConveyor' : 'factory.helpMachine')}</small>`;
      return;
    }
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
    const wall =
      buildType() === 'wall'
        ? `<div>${t('build.wallHeight', { n: String(wallHeight), cm: String(wallHeight * 50) })}</div>`
        : '';
    const ok = lastPlan.filter((i) => i.status === 'ok').length;
    const lack = lastPlan.filter(
      (i) => i.status === 'lack' || i.status === 'far' || i.status === 'unsupported',
    ).length;
    const plan = dragStart
      ? `<div>${t('build.plan', { ok: String(ok), lack: String(lack) })}</div>`
      : '';
    buildHud.innerHTML = `<strong>${itemLabel(pieceDef(kind).item)} · ${t('build.level', { n: String(buildLevel) })} · ${buildRot === null ? t('build.rotationAuto') : t('build.rotation', { deg: String(buildRot * 90) })}</strong><div>${t('build.stock', { n: String(stockOf(kind)) })}</div>${wall}${plan}<div>${t('build.rooms', { n: String(rooms) })}${here ? ` · ${t('build.inRoom')}` : ''}</div><div class="msg">${buildMessage}</div><small>${t('build.help')}</small>`;
  }
  const unsubscribeBuild = options.state.onChange((e) => {
    if (e.type === 'build') buildingView.rebuild(options.state.changes.pieces);
    if (e.type === 'hotbar') syncBuilding();
    if (e.type === 'factory') factoryView.rebuild();
    if (building && (e.type === 'build' || e.type === 'inventory')) renderBuildHud();
  });

  /** Calcule le rayon de visée (au centre de l'écran en 1ère personne, sinon sous le curseur). */
  function computeRay(): void {
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
  }

  function buildAim(mode: 'place' | 'remove' = 'place'): BuildAim | null {
    computeRay();
    return buildingView.aim(
      rayOrigin,
      rayDir,
      buildKind(),
      buildLevel,
      options.state.changes.pieces,
      rig.view === 'top' ? 120 : BUILD_REACH_M + 4,
      mode,
      buildRot === null ? undefined : buildRot % 2 === 0 ? 'x' : 'z',
      buildRot,
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
    const start = dragStart ?? aim;
    const kind = resolveKind(buildKind(), start.pos.slot);
    if (start.pos.slot === 'stairs') return [aim.pos];
    if (start.pos.slot !== 'edge') {
      if (start.pos.slot === 'ceiling' && dragStart) {
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
      // Un seul sol : là où le curseur s'accroche ; en glissant, un rectangle jusqu'à la case sous le curseur.
      if (!dragStart) return [aim.pos];
      return planRect(
        kind,
        buildLevel,
        { gx: start.pos.gx, gz: start.pos.gz },
        aim.cell,
        aim.pos.layer,
      );
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
    if (buildingMachine) {
      updateMachineBuild();
      return;
    }
    const aim = buildAim();
    const kind = aim ? resolveKind(buildKind(), (dragStart ?? aim).pos.slot) : buildKind();
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
            playSfx('demolish');
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
      const placed = options.state.placeMany(kind, ok, buildRot ?? 0);
      if (placed > 0) {
        const def = pieceDef(kind);
        playSfx(
          def.type === 'stairs'
            ? 'placeStairs'
            : def.material === 'stone'
              ? 'placeStone'
              : 'placeWood',
        );
      } else if (lastPlan.length > 0) playSfx('deny');
      buildMessage =
        placed > 0
          ? ''
          : floating > 0
            ? t(
                buildType() === 'ceiling' || buildType() === 'slab'
                  ? 'build.unsupportedCeiling'
                  : buildType() === 'stairs'
                    ? 'build.unsupportedStairs'
                    : 'build.unsupported',
              )
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

  /** Active ou coupe la construction selon la case sélectionnée dans la barre de raccourcis. */
  function syncBuilding(): void {
    const machine = selectedMachine() !== null;
    const value = selectedKind() !== null || machine;
    const item = options.state.selectedItem();
    if (item !== lastBuildItem) {
      lastBuildItem = item;
      buildRot = null; // une autre pièce : retour à l'orientation automatique
    }
    if (value !== building || machine !== buildingMachine) {
      building = value;
      buildingMachine = machine;
      dragStart = null;
      lastPlan = [];
      machinePath = [];
      buildMessage = '';
      buildingView.hideGhost();
      factoryView.hideGhost();
    }
    buildHud.hidden = !building;
    if (building) renderBuildHud();
  }

  // --- Viser une construction ou une machine ---------------------------------------------------
  const PIECE_BREAK_S = { wood: 0.5, stone: 0.8 } as const;

  /** Boîte englobante d'une pièce de construction (pour la mise en évidence). */
  function pieceBox(key: string): Structure['box'] {
    const pos = parseKey(key);
    const half = CELL_SIZE_M / 2;
    if (!pos) return { x: 0, y: 0, z: 0, sx: 0.5, sy: 0.5, sz: 0.5 };
    const y0 = pos.level * STOREY_HEIGHT_M;
    if (pos.slot === 'edge') {
      const alongX = pos.axis === 'x';
      const door = options.state.changes.pieces[key]?.startsWith('door');
      const layer = pos.layer ?? 0;
      return {
        x: alongX ? pos.gx * CELL_SIZE_M + half : pos.gx * CELL_SIZE_M,
        y: door ? y0 + STOREY_HEIGHT_M / 2 : y0 + (layer + 0.5) * LAYER_HEIGHT_M,
        z: alongX ? pos.gz * CELL_SIZE_M : pos.gz * CELL_SIZE_M + half,
        sx: alongX ? CELL_SIZE_M + 0.1 : 0.1,
        sy: door ? STOREY_HEIGHT_M : LAYER_HEIGHT_M,
        sz: alongX ? 0.1 : CELL_SIZE_M + 0.1,
      };
    }
    const base = {
      x: pos.gx * CELL_SIZE_M + half,
      z: pos.gz * CELL_SIZE_M + half,
      sx: CELL_SIZE_M,
      sz: CELL_SIZE_M,
    };
    if (pos.slot === 'floor') return { ...base, y: y0 + 0.05, sy: 0.1 };
    if (pos.slot === 'ceiling') {
      return { ...base, y: y0 + ((pos.layer ?? 0) + 1) * LAYER_HEIGHT_M - 0.05, sy: 0.1 };
    }
    return { ...base, y: y0 + ((pos.layer ?? 0) + 0.5) * LAYER_HEIGHT_M, sy: LAYER_HEIGHT_M };
  }

  function machineBox(m: Machine): Structure['box'] {
    const { w, d } = dims(m.type, m.rot);
    const h = machineDef(m.type).height;
    return {
      x: (m.gx + w / 2) * CELL_SIZE_M,
      y: h / 2,
      z: (m.gz + d / 2) * CELL_SIZE_M,
      sx: w * CELL_SIZE_M,
      sy: h,
      sz: d * CELL_SIZE_M,
    };
  }

  /** Le premier objet construit (pièce ou machine) que le rayon touche. */
  function structureAt(o: THREE.Vector3, d: THREE.Vector3): Structure | null {
    const piece = pickPiece(options.state.changes.pieces, o, d, 80);
    const hitM = pickMachine(factory, o, d, 80);
    if (!piece && !hitM) return null;
    if (hitM && (!piece || hitM.t < piece.t)) {
      const m = hitM.machine;
      return {
        id: `machine:${m.id}`,
        name: t(`item.${machineDef(m.type).item}` as TranslationKey),
        seconds: m.type === 'conveyor' ? 0.4 : 1.2,
        distance: hitM.t,
        box: machineBox(m),
      };
    }
    const kind = options.state.changes.pieces[piece!.key];
    const def = pieceDef(kind);
    return {
      id: `piece:${piece!.key}`,
      name: t(`item.${def.item}` as TranslationKey),
      seconds: def.type === 'door' ? 1 : PIECE_BREAK_S[def.material],
      distance: piece!.t,
      box: pieceBox(piece!.key),
    };
  }

  /** Démolit ce que le joueur vient de frapper : les ressources de fabrication lui reviennent. */
  function demolishStructure(id: string): void {
    const at = { x: playerX, z: playerZ };
    if (id.startsWith('piece:')) {
      options.state.removeKeys([id.slice(6)], at);
    } else if (id.startsWith('machine:')) {
      options.state.removeMachine(factory, Number(id.slice(8)), at);
    }
    playSfx('demolish');
  }

  // --- Poser machines et tapis -----------------------------------------------------------------
  const selectedMachine = (): MachineDef | null => machineForItem(options.state.selectedItem());
  let buildingMachine = false;
  let machinePath: Cell[] = [];
  let machineWasDown = false;
  const autoRot = (): number => riseFromDirection(-Math.sin(rig.yaw), -Math.cos(rig.yaw));
  const machineBlocked = (c: Cell): boolean => {
    if (blocked.has(`${c.gx},${c.gz}`)) return true;
    const pieces = options.state.changes.pieces;
    if (pieces[`f:0:${c.gx},${c.gz}`]) return true;
    return [0, 1, 2, 3].some((r) => pieces[`s:0:${c.gx},${c.gz}:0:${r}`]);
  };
  const dirIndex = (from: Cell, to: Cell): number =>
    RISE_DIR.findIndex(([dx, dz]) => dx === to.gx - from.gx && dz === to.gz - from.gz);

  function updateMachineBuild(): void {
    const def = selectedMachine();
    if (!def) return;
    computeRay();
    const c = cellOnPlane(rayOrigin, rayDir, 0);
    const down = input.isActionActive('interact');
    if (!c) {
      factoryView.hideGhost();
      return;
    }
    const player = { x: playerX, z: playerZ };
    const stock = options.state.inventory[def.item] ?? 0;
    const within = (cell: Cell): boolean =>
      Math.hypot(center(cell.gx) - player.x, center(cell.gz) - player.z) <= BUILD_REACH_M + 2;
    const baseRot = buildRot ?? autoRot();

    if (def.id !== 'conveyor') {
      const { w, d } = dims(def.id, baseRot);
      const gx = c.gx - Math.floor(w / 2);
      const gz = c.gz - Math.floor(d / 2);
      let ok =
        stock > 0 &&
        within({ gx: gx + Math.floor(w / 2), gz: gz + Math.floor(d / 2) }) &&
        factory.canPlace(def.id, gx, gz, baseRot, machineBlocked);
      let why = stock > 0 ? '' : t('build.missing');
      if (
        ok &&
        def.id === 'drill' &&
        factory.oreUnder(emptyMachine(0, 'drill', gx, gz, baseRot)).total === 0
      ) {
        ok = false;
        why = t('factory.needOre');
      } else if (!ok && stock > 0) why = t('factory.cannotPlace');
      factoryView.showGhost([{ type: def.id, gx, gz, rot: baseRot, ok }]);
      if (down && !machineWasDown) {
        if (
          ok &&
          options.state.placeMachine(factory, def.id, gx, gz, baseRot, machineBlocked) === 'ok'
        ) {
          playSfx('placeStone');
          buildMessage = '';
        } else {
          playSfx('deny');
          buildMessage = why;
        }
        renderBuildHud();
      }
      machineWasDown = down;
      return;
    }

    // Tapis : en gardant le clic, on trace un chemin case par case ; chaque élément s'oriente vers le suivant.
    if (down) {
      const last = machinePath[machinePath.length - 1];
      if (!last) machinePath = [c];
      else if (last.gx !== c.gx || last.gz !== c.gz) {
        const back = machinePath.findIndex((p) => p.gx === c.gx && p.gz === c.gz);
        if (back >= 0) machinePath.length = back + 1;
        else {
          const cur = { ...last };
          for (let guard = 0; guard < 60 && (cur.gx !== c.gx || cur.gz !== c.gz); guard++) {
            const dx = c.gx - cur.gx;
            const dz = c.gz - cur.gz;
            if (Math.abs(dx) >= Math.abs(dz)) cur.gx += Math.sign(dx);
            else cur.gz += Math.sign(dz);
            machinePath.push({ ...cur });
          }
          if (machinePath.length > 60) machinePath.length = 60;
        }
      }
    }
    const path = machinePath.length > 0 ? machinePath : [c];
    let left = stock;
    const ghosts = path.map((cell, i) => {
      const rot =
        i < path.length - 1
          ? dirIndex(cell, path[i + 1])
          : path.length > 1
            ? dirIndex(path[i - 1], cell)
            : baseRot;
      const free =
        factory.canPlace('conveyor', cell.gx, cell.gz, rot, machineBlocked) && within(cell);
      const ok = free && left > 0;
      if (ok) left--;
      return { type: 'conveyor' as const, gx: cell.gx, gz: cell.gz, rot, ok };
    });
    factoryView.showGhost(ghosts);
    if (!down && machinePath.length > 0) {
      let placed = 0;
      for (const g of ghosts) {
        if (
          g.ok &&
          options.state.placeMachine(factory, 'conveyor', g.gx, g.gz, g.rot, machineBlocked) ===
            'ok'
        )
          placed++;
      }
      if (placed > 0) playSfx('placeWood');
      else playSfx('deny');
      buildMessage =
        placed === 0 ? (stock > 0 ? t('factory.cannotPlace') : t('build.missing')) : '';
      machinePath = [];
      renderBuildHud();
    }
    machineWasDown = down;
  }

  // --- Panneau d'informations de la machine visée ----------------------------------------------
  const machinePanel = document.createElement('div');
  machinePanel.className = 'machine-panel';
  machinePanel.hidden = true;
  container.appendChild(machinePanel);
  let aimedMachine: Machine | null = null;

  const stackText = (stack: { item: string; count: number } | null, max?: number): string =>
    stack
      ? `${stack.count}${max ? ` / ${max}` : ''} × ${t(`item.${stack.item}` as TranslationKey)}`
      : t('factory.empty');
  const duration = (sec: number): string =>
    sec >= 60 ? `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s` : `${Math.round(sec)} s`;

  function refreshMachinePanel(): void {
    const m = aimedMachine;
    if (!m || building) {
      machinePanel.hidden = true;
      return;
    }
    const def = machineDef(m.type);
    const status = factory.status(m);
    const rows: string[] = [];
    rows.push(`<strong>${t(`item.${def.item}` as TranslationKey)}</strong>`);
    rows.push(`<div class="st ${status}">${t(`factory.status.${status}` as TranslationKey)}</div>`);
    if (m.type === 'drill') {
      const ore = factory.oreUnder(m);
      rows.push(
        `<div>${t('factory.production', { rate: t('factory.rateDrill', { n: String(1 / (def.mineSeconds ?? 1)) }) })}</div>`,
      );
      rows.push(`<div>${t('factory.ore', { n: String(ore.total) })}</div>`);
      for (const [item, n] of Object.entries(ore.byItem)) {
        rows.push(`<div class="sub">${t(`item.${item}` as TranslationKey)} : ${n}</div>`);
      }
      rows.push(`<div>${t('factory.stock', { v: stackText(m.stock, def.stockMax) })}</div>`);
    } else if (m.type === 'furnace') {
      rows.push(
        `<div>${t('factory.production', { rate: t('factory.rateFurnace', { s: '3' }) })}</div>`,
      );
      rows.push(`<div>${t('factory.input', { v: stackText(m.input, def.stockMax) })}</div>`);
      rows.push(`<div>${t('factory.output', { v: stackText(m.stock, def.stockMax) })}</div>`);
    } else {
      rows.push(
        `<div>${t('factory.belt', { n: String(m.belt.length), max: String(def.capacity ?? 3) })}</div>`,
      );
      rows.push(`<div>${t('factory.speed', { n: String(def.cellsPerSecond ?? 1) })}</div>`);
    }
    if (def.fuel) {
      const secs = factory.fuelSecondsLeft(m);
      rows.push(
        `<div>${t('factory.fuel', { v: stackText(m.fuel, def.stockMax), time: duration(secs) })}</div>`,
      );
    }
    rows.push(`<div>${t('factory.power', { v: t('factory.noPower') })}</div>`);
    if (m.type !== 'conveyor') {
      const out = outputCell(m.type, m.gx, m.gz, m.rot);
      const target = factory.machineAt(out.gx, out.gz);
      rows.push(
        `<div class="sub">${t('factory.outputTo', { v: target ? t(`item.${machineDef(target.type).item}` as TranslationKey) : t('factory.nothing') })}</div>`,
      );
      rows.push(`<small>${t('factory.useHint')}</small>`);
    }
    machinePanel.innerHTML = rows.join('');
    machinePanel.hidden = false;
  }

  /** Les machines et tapis à proximité du viseur (le panneau suit ce qu'on regarde). */
  function updateAimedMachine(): void {
    computeRay();
    const hit = structureAt(rayOrigin, rayDir);
    const id = hit?.id.startsWith('machine:') ? Number(hit.id.slice(8)) : null;
    const m = id === null ? null : (factory.machines.find((x) => x.id === id) ?? null);
    const near = m && Math.hypot(hit!.box.x - playerX, hit!.box.z - playerZ) <= 12;
    aimedMachine = near ? m : null;
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
  /** Distance parcourue au dernier pas : une pente d'escalier se monte même à faible nombre d'images/s. */
  let stepSlack = 0;
  const canStand = (x: number, z: number): boolean => {
    const pieces = options.state.changes.pieces;
    for (const dx of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
      for (const dz of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
        if (isBlockedAt(x + dx, z + dz)) return false;
        if (bodyBlocked(pieces, x + dx, z + dz, playerY, PLAYER_HEIGHT_M, stepSlack)) return false;
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
  let airTime = 0;
  /** Distance marchée depuis le dernier pas entendu. */
  let strideDist = 0;
  /** Saut, gravité, se tenir sur une dalle ou sur la tranche d'un mur. */
  function stepBody(dt: number): void {
    const pieces = options.state.changes.pieces;
    let ground = 0;
    for (const [dx, dz] of FOOT_SAMPLES) {
      ground = Math.max(ground, groundAt(pieces, playerX + dx, playerZ + dz, playerY, stepSlack));
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
    if (onGround && !next.onGround && next.vy > 0) playSfx('jump');
    if (!onGround && next.onGround && airTime > 0.25) {
      playSfx('land', Math.min(1.4, Math.abs(velY) / 8));
    }
    airTime = next.onGround ? 0 : airTime + dt;
    playerY = next.y;
    velY = next.vy;
    onGround = next.onGround;
  }

  /** Bruit d'un pas selon le sol : construction (bois, pierre) ou terrain du biome. */
  function footstep(sprinting: boolean): void {
    const material = surfaceMaterialAt(options.state.changes.pieces, playerX, playerZ, playerY);
    const biome = generator.biomeAt(playerX, playerZ);
    const id =
      material === 'stone'
        ? 'stepStone'
        : material === 'wood'
          ? 'stepWood'
          : biome === 'desert'
            ? 'stepSand'
            : biome === 'tundra'
              ? 'stepSnow'
              : 'stepGrass';
    playSfx(id, sprinting ? 1.25 : 1);
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
    if (forward === 0 && right === 0) {
      stepSlack = 0;
      return { speed: 0, strafe: 0 };
    }

    const len = Math.hypot(forward, right);
    const speed = WALK_SPEED_M_S * (input.isActionActive('sprint') ? SPRINT_FACTOR : 1);
    const yaw = rig.yaw;
    // « Avant » = la direction vers laquelle regarde la caméra.
    const dirX = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / len;
    const dirZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / len;
    stepSlack = speed * dt;
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
    if (onGround) {
      strideDist += moved;
      if (strideDist >= STRIDE_M) {
        strideDist = 0;
        footstep(input.isActionActive('sprint'));
      }
    }

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
      // Barre de raccourcis : 1 à 9 sélectionnent une case (une pièce de construction active la pose).
      for (let i = 1; i <= 9; i++) {
        if (pressed(`hotbar${i}` as ActionId)) {
          options.state.selectSlot(i - 1);
          playSfx('select');
        }
      }
      if (building) {
        if (pressed('rotate')) {
          buildRot = buildRot === null ? 0 : (buildRot + 1) % 4;
          renderBuildHud();
        }
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
    // Usine : 20 pas de simulation par seconde, affichage des objets sur les tapis 10 fois par seconde.
    if (!paused) {
      simAcc = Math.min(simAcc + dt, 0.5);
      while (simAcc >= 0.05) {
        factory.tick(0.05);
        simAcc -= 0.05;
      }
    }
    itemsTimer += realDt;
    if (itemsTimer >= 0.1) {
      itemsTimer = 0;
      factoryView.updateItems();
    }
    chunkTimer += realDt;
    if (chunkTimer >= 0.6 && dirtyChunks.size > 0) {
      chunkTimer = 0;
      for (const k of dirtyChunks) {
        const [cx, cz] = k.split(',').map(Number);
        if (chunks.has(k)) buildInto(cx, cz);
      }
      dirtyChunks.clear();
    }
    panelTimer += realDt;
    if (panelTimer >= 0.2) {
      panelTimer = 0;
      if (paused || building) aimedMachine = null;
      else updateAimedMachine();
      refreshMachinePanel();
    }
    if (!paused && !building && pressed('use') && aimedMachine)
      options.onOpenMachine?.(aimedMachine.id);
    interaction.update({
      // Temps réel : sur un ordinateur lent, la récolte ne doit pas ralentir.
      dt: realDt,
      player: { x: playerX, z: playerZ },
      active: !paused && !building && input.isActionActive('interact'),
      // En construction, la récolte est coupée (pas de ressource affichée derrière un mur).
      paused: paused || building,
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
    factory,
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
      factoryView.dispose();
      machinePanel.remove();
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
