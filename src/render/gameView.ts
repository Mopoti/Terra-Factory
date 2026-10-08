import { itemById } from '../core/data/items';
import { scienceCost, techById } from '../core/data/techs';
import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS, CHUNK_SIZE_M } from '../core/constants';
import { cellOnPlane } from '../core/build/aim';
import {
  evaluatePlan,
  planSlabs,
  planWall,
  posCenter,
  rayOnEdgePlane,
  type PlanItem,
  type WallCoord,
} from '../core/build/plan';
import { edgeKeysToRemove, parseKey, slabAt, slabFace, type PiecePos } from '../core/build/pieces';
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
import { DISCOVERIES } from '../core/data/discoveries';
import { MOULD_CYCLES, recipeById } from '../core/data/recipes';
import { applyChanges, extraNestsIn, MAX_EXTRA_NESTS, NEST_HP } from '../core/game/worldChanges';
import { WorldGenerator } from '../core/world/worldgen';
import { t, type TranslationKey } from '../i18n';
import { Input } from '../input/input';
import type { ActionId } from '../settings/controls';
import type { Settings } from '../settings/schema';
import { getSettings, onSettingsChange } from '../settings/store';
import { edgePan, ghostRadiusPx } from './cameraMath';
import { CameraRig } from './cameraRig';
import { climateAt, dayLight } from '../core/game/seasons';
import { buildChunkMesh, ghostUniforms, setGroundTint, type ChunkMesh } from './chunkMesh';
import {
  STEP_UP_M,
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
import {
  hasOutput,
  isChest,
  isArm,
  isAssembler,
  GROW_M,
  hasWindow,
  isFluid,
  isLinear,
  isDrill,
  isSmith,
  isLab,
  isTurret,
  isRouter,
  machineDef,
  machineForItem,
  tierOfItem,
  itemOfTier,
  beltSpeed,
  visualHeight,
  type MachineDef,
} from '../core/data/machines';
import {
  Factory,
  levelY,
  UPPER_LEVEL,
  LIFTS,
  LIFT_NEXT,
  liftEnd,
  tunnelRange,
  POLE_HIT_M,
  centerOf,
  dims,
  emptyMachine,
  recipeOf,
  outputCell,
  pickMachine,
  type Cell,
  type FactoryWorld,
  type Machine,
} from '../core/factory/factory';
import { pipeMaxBar } from '../core/factory/fluids';
import { Tutorial } from '../core/game/tutorial';
import { WorldSimulation, type SimEvent } from '../core/game/simulation';
import { CommandBus, type CommandContext } from '../core/game/commands';
import type { HostSession } from '../core/net/host';
import { mountTutorialPanel } from '../ui/tutorialPanel';
import { showFinale } from '../ui/finale';
import { isTouchMode, mountTouchControls } from '../ui/touchControls';
import { mountGamepad } from '../input/gamepad';
import { onDeviceChange } from '../input/lastDevice';
import { cellKey } from '../core/game/worldChanges';
import { resourceById, type DepositResource } from '../core/data/resources';
import { FactoryView } from './factoryView';
import type { Structure } from './interaction';
import { BuildingView, type BuildAim } from './buildingView';
import { Interaction } from './interaction';
import { MAGAZINE_ROUNDS } from '../core/game/worldChanges';
import { EnemyView } from './enemyView';
import { RemotePlayersView } from './remotePlayers';
import { GuestBus, type GuestSync } from '../core/net/worldSync';
import { HOST_ID } from '../core/net/host';
import type { Vehicle } from '../core/game/worldChanges';
import { POLLUTION_CELL_M, Threat, type ThreatWorld } from '../core/game/threat';

const PIXEL_RATIO_CAP = { low: 1, medium: 1.5, high: 3 } as const;
const SKY = 0x8fb8d8;

// Déplacement provisoire (le vrai personnage arrive plus tard).
const WALK_SPEED_M_S = 4.5;
const SPRINT_FACTOR = 1.7;
/** Buggy : vitesse (par rapport à la marche) avec / sans carburant. */
const BUGGY_FACTOR = 2.6;
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
  /** La touche « Carte » a été pressée. */
  onToggleMap?: () => void;
  /** Le mode débogage change (le cadre « Partie / Sac / Menu » ne s'affiche qu'en débogage). */
  onDebugChange?: (on: boolean) => void;
  /** La touche « Arbre technologique » a été pressée. */
  onToggleTech?: () => void;
  /** Position et caméra de départ (sauvegarde chargée, ou mode test ?dev=1&at=x,z&dist=d). */
  start?: Partial<PlayerState>;
  /** Appelé quand le joueur change de vue avec le clavier. */
  onViewChange?: (view: ViewId) => void;
  /** Appelé quand le navigateur libère la souris (Échap en 1ère personne) : ouvrir la pause. */
  onRequestPause?: () => void;
  /** Un message court à montrer au joueur (toast). */
  onMessage?: (text: string) => void;
  /** Le joueur veut ouvrir l'interface de la machine visée (touche « Utiliser »). */
  onOpenMachine?: (id: number) => void;
  /** Partie rejointe chez un autre joueur : le monde vient de l'hôte (pas de simulation locale). */
  guest?: GuestSync;
}

export interface GameViewHandle {
  dispose(): void;
  /** État actuel du joueur et de la caméra, pour l'enregistrer dans une sauvegarde. */
  getState(): PlayerState;
  /** En pause, le joueur et la caméra ne bougent plus (le monde reste affiché). */
  setPaused(paused: boolean): void;
  /** Une fenêtre (sac) est ouverte sans figer le jeu : la souris est libre, mais on peut continuer à marcher. */
  setUiOpen(open: boolean): void;
  /** Jette des objets du sac au sol, devant le joueur. */
  dropItem(item: string, count: number): void;
  /** L'usine (machines et tapis) de la partie, pour l'interface des machines. */
  factory: Factory;
  /** Pollution et ennemis, pour la carte. */
  threat: Threat;
  /** Commandes du joueur (poser, démolir, fabriquer, vendre…). */
  bus: CommandBus;
  /** Terrain vu par les commandes : cases bloquées pour une machine à ce niveau (utilisé par l'hôte multijoueur). */
  blockedFor: CommandContext['blockedFor'];
  /** Branche (ou, avec null, débranche) la session d'hôte : la simulation et les envois aux invités la suivent. */
  setHost(session: HostSession | null): void;
  /** Le coffre d'un buggy vu comme une machine (identifiant négatif = −identifiant du buggy), ou null. */
  vehicleMachine(id: number): Machine | null;
  /** Identifiant (négatif, pour la fenêtre) du buggy que conduit le joueur, ou null. */
  mountedMachineId(): number | null;
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
  let skyNow = SKY;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 500);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x556655, 1.1);
  scene.add(hemi);
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
  // Corps des joueurs tombés (capsule grise couchée) et points de réapparition posés (duvet, lit).
  const corpseGeometry = new THREE.CapsuleGeometry(
    PLAYER_RADIUS_M,
    PLAYER_HEIGHT_M - 2 * PLAYER_RADIUS_M,
    4,
    10,
  );
  const corpseMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7f78 });
  const corpseMeshes = new Map<number, THREE.Mesh>();
  const spawnMeshes = new Map<number, THREE.Group>();
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
  const stoneHead = new THREE.MeshStandardMaterial({ color: 0x8a8f98 });
  const toolHeads: THREE.Mesh[] = [];
  function makeTool(): THREE.Group {
    const tool = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), metal);
    head.position.z = 0.32;
    toolHeads.push(head);
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
  // Main nue (1ère personne) : une petite forme couleur peau, en bas à droite.
  const bareHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.09, 0.17),
    new THREE.MeshStandardMaterial({ color: 0xe0b38a }),
  );
  bareHand.position.set(0.3, -0.3, -0.55);
  bareHand.rotation.set(0.3, -0.2, 0);
  camera.add(bareHand);
  const bodyTool = makeTool();
  bodyTool.scale.setScalar(1.15);
  // Le personnage regarde vers +z (son repère local) : l'outil est à droite et devant.
  bodyTool.position.set(-0.34, 0.1, 0.32);
  bodyTool.rotation.set(-0.5, 0, 0);
  player.add(bodyTool);

  // Équipement porté : formes simples sur le personnage (3ème personne et vue du dessus). Provisoire : plus tard, de vrais modèles.
  const worn = new THREE.Group();
  player.add(worn);
  let wornKey = '';
  function refreshWorn(): void {
    const eq = options.state.changes.equipment;
    const key = JSON.stringify(eq);
    if (key === wornKey) return;
    wornKey = key;
    for (const child of [...worn.children]) {
      worn.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    const add = (
      geo: THREE.BufferGeometry,
      item: string,
      x: number,
      y: number,
      z: number,
    ): void => {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(itemById(item).color) }),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      worn.add(mesh);
    };
    // Le personnage regarde vers +z (repère local) : le dos est vers -z. Capsule : y de -0,85 à +0,85.
    if (eq.torso) {
      add(new THREE.BoxGeometry(0.4, 0.5, 0.22), eq.torso, 0, 0.18, -0.32);
      add(new THREE.BoxGeometry(0.3, 0.14, 0.05), eq.torso, 0, 0.32, -0.45);
    }
    if (eq.head) {
      add(
        new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
        eq.head,
        0,
        0.6,
        -0.02,
      );
    }
    if (eq.legs) add(new THREE.CylinderGeometry(0.27, 0.26, 0.5, 12), eq.legs, 0, -0.5, 0);
    if (eq.feet) add(new THREE.CylinderGeometry(0.285, 0.285, 0.17, 12), eq.feet, 0, -0.77, 0);
    if (eq.hands) {
      add(new THREE.SphereGeometry(0.075, 8, 6), eq.hands, 0.29, 0.02, 0.05);
      add(new THREE.SphereGeometry(0.075, 8, 6), eq.hands, -0.29, 0.02, 0.05);
    }
  }
  refreshWorn();

  const rig = new CameraRig(camera, state);
  const interaction: Interaction = new Interaction(scene, camera, options.state, container, {
    rebuildChunk: (cx, cz) => buildInto(cx, cz),
    pickStructure: (o, d) => structureAt(o, d),
    demolish: (id) => demolishStructure(id),
    openStructure: (id) => {
      if (id.startsWith('machine:')) options.onOpenMachine?.(Number(id.slice(8)));
      else if (id.startsWith('piece:')) {
        const open = options.state.toggleDoor(id.slice(6));
        if (open !== null) playSfx(open ? 'doorOpen' : 'doorClose');
      }
    },
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
  const waterCache = new Map<string, Set<string>>();
  const waterCellAt = (gx: number, gz: number): boolean => {
    const cx = Math.floor(gx / CHUNK_CELLS);
    const cz = Math.floor(gz / CHUNK_CELLS);
    const key = `${cx},${cz}`;
    let cells = waterCache.get(key);
    if (!cells) {
      cells = new Set(generator.chunk(cx, cz).water.map((w) => cellKey(w.gx, w.gz)));
      waterCache.set(key, cells);
    }
    return cells.has(cellKey(gx, gz));
  };
  const dirtyChunks = new Set<string>();
  const factoryWorld: FactoryWorld = {
    waterAt: waterCellAt,
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
  /** Forme verticale du tapis qu'on pose (PageUp / PageDown) : voir `LIFTS`. */
  /** Inclinaison du patron de tapis (PageUp / PageDown) : −1 descend, 0 à plat, 1 monte. */
  let buildTilt = 0;
  /** Forme qui en résulte (selon le niveau du tapis visé), pour l'affichage. */
  let hudLift = 0;
  /** Machine : au sol (0) ou à l'étage sur une dalle (2), choisi avec PageUp / PageDown. */
  let buildMachineLevel = 0;
  /** Axe du dernier bord visé (pour que R parte de l'orientation actuelle d'un mur). */
  let lastAimAxis: 'x' | 'z' = 'x';
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
  // Les aides de pose suivent le dernier périphérique utilisé (clavier ou manette).
  const offDevice = onDeviceChange(() => {
    if (building) renderBuildHud();
  });
  function renderBuildHud(): void {
    if (buildingMachine) {
      const def = selectedMachine();
      if (!def) return;
      const n = options.state.inventory[selItem(def)] ?? 0;
      const rot =
        buildRot === null
          ? t('build.rotationAuto')
          : t('build.rotation', { deg: String(buildRot * 90) });
      const lift =
        def.id === 'conveyor' || def.id === 'pipe'
          ? ` · ${t(`factory.lift.${hudLift}` as TranslationKey)}`
          : '';
      const floor =
        !isLinear(def.id) && def.id !== 'pump' && buildMachineLevel === UPPER_LEVEL
          ? ` · ${t('factory.upperFloor')}`
          : '';
      buildHud.innerHTML = `<strong>${itemLabel(selItem(def))} · ${rot}${lift}${floor}</strong><div>${t('build.stock', { n: String(n) })}</div><div class="msg">${buildMessage}</div><small>${t(
        def.id === 'pipe'
          ? 'factory.helpPipe'
          : isLinear(def.id)
            ? 'factory.helpConveyor'
            : 'factory.helpMachine',
      )}</small>`;
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
    const lack = lastPlan.filter((i) => i.status === 'lack' || i.status === 'far').length;
    const plan = dragStart
      ? `<div>${t('build.plan', { ok: String(ok), lack: String(lack) })}</div>`
      : '';
    buildHud.innerHTML = `<strong>${itemLabel(pieceDef(kind).item)} · ${t('build.level', { n: String(buildLevel) })} · ${buildRot === null ? t('build.rotationAuto') : t('build.rotation', { deg: String(buildRot * 90) })}</strong><div>${t('build.stock', { n: String(stockOf(kind)) })}</div>${wall}${plan}<div>${t('build.rooms', { n: String(rooms) })}${here ? ` · ${t('build.inRoom')}` : ''}</div><div class="msg">${buildMessage}</div><small>${t('build.help')}</small>`;
  }
  const unsubscribeBuild = options.state.onChange((e) => {
    if (e.type === 'discovery') {
      const d = DISCOVERIES.find((x) => x.id === e.id);
      if (d)
        options.onMessage?.(
          t('discovery.unlocked', {
            name: t(`item.${d.unlocks[0]}` as TranslationKey),
            n: String(d.goal.count),
            item: t(`item.${d.goal.item}` as TranslationKey),
          }),
        );
    }
    if (e.type === 'inventory') refreshWorn();
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
    return rayOnEdgePlane(rayOrigin, rayDir, axis, line, edge.pos.level * STOREY_HEIGHT_M);
  }
  let dragLayer = 0;

  /** Pièces visées : une seule, ou toute la surface / le pan de mur tracé en gardant le clic enfoncé. */
  function planFor(aim: BuildAim): PiecePos[] {
    const start = dragStart ?? aim;
    const kind = resolveKind(buildKind(), start.pos.slot);
    const level = start.pos.level;
    if (start.pos.slot === 'stairs') return [aim.pos];
    if (start.pos.slot !== 'edge') {
      // Dalle : un seul emplacement avant d'appuyer ; en glissant, un rectangle dans le plan de la face de départ.
      if (!dragStart) return [aim.pos];
      const face = slabFace(start.pos);
      const end = cellOnPlane(rayOrigin, rayDir, face * LAYER_HEIGHT_M + 0.05) ?? aim.cell;
      return planSlabs(buildKind(), face, { gx: start.pos.gx, gz: start.pos.gz }, end);
    }
    const axis = start.pos.axis ?? 'x';
    const i0 = axis === 'x' ? start.pos.gx : start.pos.gz;
    const line = axis === 'x' ? start.pos.gz : start.pos.gx;
    const iGround = axis === 'x' ? aim.cell.gx : aim.cell.gz;
    if (!dragStart) {
      // Avant d'appuyer : le seul bloc visé.
      const layer = aim.pos.layer ?? 0;
      return planWall(kind, level, axis, line, { i: i0, layer }, { i: i0, layer });
    }
    const a = { i: i0, layer: dragLayer };
    if (rig.view === 'top') {
      // Vue du dessus : on ne vise pas en hauteur, la hauteur est celle réglée avec Début / Fin.
      const upTo = Math.min(LAYERS_PER_STOREY - 1, dragLayer + wallHeight - 1);
      return planWall(kind, level, axis, line, a, { i: iGround, layer: upTo });
    }
    // 1ère / 3ème personne : le pan de mur va du bloc de départ au bloc visé.
    const over = hoverCoord(start);
    return planWall(kind, level, axis, line, a, over ?? { i: iGround, layer: dragLayer });
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
    if (aim?.pos.axis) lastAimAxis = aim.pos.axis;
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
    const h = visualHeight(m.type);
    const grow = m.type === 'conveyor' ? 0 : GROW_M;
    // Le poteau a une emprise de 2 × 2 cases mais un mât fin : sa boîte de visée l'est aussi.
    const thin = m.type === 'pole';
    return {
      x: (m.gx + w / 2) * CELL_SIZE_M,
      y: h / 2 + (m.type === 'conveyor' ? 0 : levelY(m.lift)),
      z: (m.gz + d / 2) * CELL_SIZE_M,
      sx: thin ? 0.3 : w * CELL_SIZE_M + grow,
      sy: h,
      sz: thin ? 0.3 : d * CELL_SIZE_M + grow,
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
        seconds: isLinear(m.type) ? 0.4 : 1.2,
        usable: hasWindow(m.type),
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
      usable: def.type === 'door',
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
      bus.dispatch<'removeMachine'>({ type: 'removeMachine', id: Number(id.slice(8)), at });
    }
    demolishChain = true;
    playSfx('demolish');
  }

  // --- Poser machines et tapis -----------------------------------------------------------------
  const selectedMachine = (): MachineDef | null => machineForItem(options.state.selectedItem());
  /** Objet du sac de la machine choisie (pour un tapis : le palier tenu en main). */
  const selItem = (def: MachineDef): string =>
    options.state.selectedItem() && machineForItem(options.state.selectedItem())?.id === def.id
      ? (options.state.selectedItem() as string)
      : def.item;
  let buildingMachine = false;
  let machinePath: Cell[] = [];
  /** Tracé en cours : forme du premier tapis, et formes choisies en route (PageUp / PageDown) par rang. */
  let dragLift = 0;
  const liftOverride = new Map<number, number>();
  /** Formes du tracé en cours (−1 = sous terre : rien à poser, le tunnel passe là). */
  let dragLifts: number[] = [];
  const HIDDEN = -1;
  /** Niveau (0 sol, 1 en l'air, −1 sous terre) où l'on se trouve après un tapis de cette forme. */
  /** Forme du tapis qui part du niveau `level` avec cette inclinaison (1 monte, 0 à plat, −1 descend). */
  const tiltLift = (level: number, tilt: number): number => {
    if (level >= 2) return tilt < 0 ? 8 : 7;
    if (level === 1) return tilt > 0 ? 6 : tilt < 0 ? 3 : 2;
    return tilt > 0 ? 1 : tilt < 0 ? 4 : 0;
  };
  const levelAfter = (lift: number): number => [0, 1, 1, 0, -1, 0, 2, 2, 1][lift] ?? -1;
  const nextLift = (lift: number): number =>
    lift === HIDDEN || lift === 4 ? HIDDEN : LIFT_NEXT[lift];
  const pathReached = new Set<string>();
  const MACHINE_REACH_M = 20;
  /** Un tapis emporte le joueur à CARRY_BOOST fois la vitesse des objets (on le sent mieux en marchant dessus). */
  const CARRY_BOOST = 2;
  /** Série de poteaux : le dernier posé pendant que le clic gauche reste maintenu. */
  let poleChain: Machine | null = null;
  const MAX_BELT_PATH = 150;
  let machineWasDown = false;
  const autoRot = (): number => riseFromDirection(-Math.sin(rig.yaw), -Math.cos(rig.yaw));
  // Un pont : une dalle de sol posée sur une case d'eau la rend praticable (marche, tapis, tuyaux, poteaux).
  const bridgeAt = (gx: number, gz: number): boolean =>
    waterCellAt(gx, gz) && !!options.state.changes.pieces[`f:0:${gx},${gz}`];
  const machineBlocked = (c: Cell): boolean => {
    if (bridgeAt(c.gx, c.gz)) return false;
    if (blocked.has(`${c.gx},${c.gz}`)) return true;
    const pieces = options.state.changes.pieces;
    if (pieces[`f:0:${c.gx},${c.gz}`]) return true;
    return [0, 1, 2, 3].some((r) => pieces[`s:0:${c.gx},${c.gz}:0:${r}`]);
  };
  const dirIndex = (from: Cell, to: Cell): number =>
    RISE_DIR.findIndex(
      ([dx, dz]) => dx === Math.sign(to.gx - from.gx) && dz === Math.sign(to.gz - from.gz),
    );

  /** Bus de commandes : les actions qui changent le monde passent par lui (voir core/game/commands.ts). */
  const busContext: CommandContext = {
    state: options.state,
    factory,
    blockedFor: (type, level) => {
      if (!isLinear(type) && level === UPPER_LEVEL) {
        const pieces = options.state.changes.pieces;
        return (cell) =>
          !slabAt(pieces, Math.round(levelY(UPPER_LEVEL) / LAYER_HEIGHT_M), cell.gx, cell.gz);
      }
      if (type === 'pump') return (cell) => machineBlocked(cell) && !waterCellAt(cell.gx, cell.gz);
      return machineBlocked;
    },
  };
  const bus = options.guest ? new GuestBus(busContext, options.guest) : new CommandBus(busContext);

  function extendPoleLine(down: boolean): void {
    if (!down || !poleChain || !factory.machines.includes(poleChain)) {
      poleChain = null;
      return;
    }
    const reach = machineDef('pole').wireReachM ?? 8;
    const from = centerOf(poleChain);
    const dist = Math.hypot(playerX - from.x, playerZ - from.z);
    // Le joueur dépasse la portée du câble de ~1 m : le poteau se pose à la limite, derrière lui.
    if (dist < reach + 0.9 || (options.state.inventory[machineDef('pole').item] ?? 0) < 1) return;
    const k = (reach - 0.3) / dist;
    const px = from.x + (playerX - from.x) * k;
    const pz = from.z + (playerZ - from.z) * k;
    const { w, d } = dims('pole', 0);
    const gx = Math.floor(px / CELL_SIZE_M) - Math.floor(w / 2);
    const gz = Math.floor(pz / CELL_SIZE_M) - Math.floor(d / 2);
    // Un peu de marge si la case est prise : on cherche autour.
    for (const [ox, oz] of [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ]) {
      const c = { gx: gx + ox, gz: gz + oz };
      const at = { x: (c.gx + w / 2) * CELL_SIZE_M, z: (c.gz + d / 2) * CELL_SIZE_M };
      if (Math.hypot(at.x - from.x, at.z - from.z) > reach) continue;
      if (
        bus.dispatch<'placeMachine'>({
          type: 'placeMachine',
          machine: 'pole',
          gx: c.gx,
          gz: c.gz,
          rot: 0,
          lift: 0,
          tier: 1,
        }) === 'ok'
      ) {
        poleChain = factory.machines[factory.machines.length - 1];
        playSfx('placeStone');
        renderBuildHud();
        return;
      }
    }
  }

  function updateMachineBuild(): void {
    const def = selectedMachine();
    if (!def) return;
    computeRay();
    // Machine à l'étage : on vise le plan de la dalle (2 m) ; elle exige une dalle sous chacune de ses cases.
    const upper = !isLinear(def.id) && def.id !== 'pump' && buildMachineLevel === UPPER_LEVEL;
    const c = cellOnPlane(rayOrigin, rayDir, upper ? levelY(UPPER_LEVEL) : 0);
    const down = input.isActionActive('interact');
    if (!c) {
      factoryView.hideGhost();
      return;
    }
    const player = { x: playerX, z: playerZ };
    const stock = options.state.inventory[selItem(def)] ?? 0;
    const tier = tierOfItem(options.state.selectedItem());
    // Portée de pose des machines : large (on bâtit une ligne en marchant), illimitée ou presque en vue du dessus.
    const reach = rig.view === 'top' ? 80 : MACHINE_REACH_M;
    const near = (cell: Cell): boolean =>
      Math.hypot(center(cell.gx) - player.x, center(cell.gz) - player.z) <= reach;
    // Un tapis accepté quand on le trace le reste, même si l'on s'en éloigne ensuite en marchant.
    const within = (cell: Cell): boolean => near(cell) || pathReached.has(`${cell.gx},${cell.gz}`);
    const baseRot = buildRot ?? autoRot();

    if (!isLinear(def.id)) {
      // Une pompe se pose à moitié dans l'eau : ses cases dans l'étang ne comptent pas comme bloquées.
      const pieces = options.state.changes.pieces;
      const blockedHere = upper
        ? (cell: Cell): boolean =>
            !slabAt(pieces, Math.round(levelY(UPPER_LEVEL) / LAYER_HEIGHT_M), cell.gx, cell.gz)
        : def.id === 'pump'
          ? (cell: Cell): boolean => machineBlocked(cell) && !waterCellAt(cell.gx, cell.gz)
          : machineBlocked;
      const level = upper ? UPPER_LEVEL : 0;
      const { w, d } = dims(def.id, baseRot);
      const gx = c.gx - Math.floor(w / 2);
      const gz = c.gz - Math.floor(d / 2);
      let ok =
        stock > 0 &&
        within({ gx: gx + Math.floor(w / 2), gz: gz + Math.floor(d / 2) }) &&
        factory.canPlace(def.id, gx, gz, baseRot, blockedHere, level);
      let why = stock > 0 ? '' : t('build.missing');
      if (ok && upper && isDrill(def.id)) {
        ok = false;
        why = t('factory.needOre');
      } else if (
        ok &&
        isDrill(def.id) &&
        factory.oreUnder(emptyMachine(0, def.id, gx, gz, baseRot)).total === 0
      ) {
        ok = false;
        why = t('factory.needOre');
      } else if (!ok && stock > 0) {
        why = def.id === 'pump' ? t('factory.needWater') : t('factory.cannotPlace');
      }
      factoryView.showGhost([{ type: def.id, gx, gz, rot: baseRot, ok, lift: level }]);
      if (down && !machineWasDown) {
        if (
          ok &&
          bus.dispatch<'placeMachine'>({
            type: 'placeMachine',
            machine: def.id,
            gx,
            gz,
            rot: baseRot,
            lift: level,
            tier: 1,
          }) === 'ok'
        ) {
          if (def.id === 'pole') poleChain = factory.machines[factory.machines.length - 1];
          playSfx('placeStone');
          buildMessage = '';
        } else {
          playSfx('deny');
          buildMessage = why;
        }
        renderBuildHud();
      }
      // Poteaux : en gardant le clic et en marchant, un nouveau se pose à la limite du câble.
      if (def.id === 'pole') extendPoleLine(down);
      machineWasDown = down;
      return;
    }

    // Tapis et tuyaux : ils occupent des tuiles de 2 × 2 cases, posées où l'on vise (pas sur une grille fixe :
    // la tuile se cale pour toucher la sortie d'une machine). En gardant le clic, on trace un chemin tuile par
    // tuile ; chaque élément s'oriente vers le suivant.
    const tileNear = (t: Cell): boolean => near({ gx: t.gx + 1, gz: t.gz + 1 });
    const tileWithin = (t: Cell): boolean => tileNear(t) || pathReached.has(`${t.gx},${t.gz}`);
    const contains = (t: Cell, cell: Cell): boolean =>
      cell.gx >= t.gx && cell.gx < t.gx + 2 && cell.gz >= t.gz && cell.gz < t.gz + 2;
    /** Première tuile libre qui contient la case visée (4 positions possibles autour du curseur). */
    let baseLift = 0;
    const tileAround = (cell: Cell): Cell => {
      const options = [
        { gx: cell.gx, gz: cell.gz },
        { gx: cell.gx - 1, gz: cell.gz },
        { gx: cell.gx, gz: cell.gz - 1 },
        { gx: cell.gx - 1, gz: cell.gz - 1 },
      ];
      return (
        options.find((o) =>
          factory.canPlace(def.id, o.gx, o.gz, baseRot, machineBlocked, baseLift, tier),
        ) ?? options[0]
      );
    };
    /** Viser une rampe ou un tapis en l'air : le patron se cale à sa suite (même niveau, même sens). */
    const rampSnap = (cell: Cell): { cell: Cell; rot: number; level: number } | null => {
      if (def.id !== 'conveyor') return null;
      const shaped = (m: Machine | null): m is Machine =>
        !!m &&
        m.type === 'conveyor' &&
        m.lift !== 4 &&
        m.lift !== 5 &&
        (m.lift !== 0 || buildTilt !== 0);
      // Le rayon peut traverser un tapis en l'air bien avant d'atteindre la case visée au sol.
      const hit = pickMachine(factory, rayOrigin, rayDir, 80)?.machine ?? null;
      const found =
        (shaped(hit) ? hit : null) ??
        [0, 1, 2].map((layer) => factory.machineAt(cell.gx, cell.gz, layer)).find(shaped) ??
        null;
      if (!found) return null;
      // On suit la ligne déjà posée jusqu'à sa fin : le patron se cale sur la première tuile libre.
      const [dx, dz] = RISE_DIR[found.rot];
      let last: Machine = found;
      for (let guard = 0; guard < MAX_BELT_PATH; guard++) {
        const next = factory.machineAt(
          last.gx + dx * 2,
          last.gz + dz * 2,
          LIFTS[LIFT_NEXT[last.lift]].from,
        );
        if (!next || next.type !== 'conveyor' || next.rot !== found.rot) break;
        last = next;
      }
      return {
        cell: { gx: last.gx + dx * 2, gz: last.gz + dz * 2 },
        rot: found.rot,
        level: liftEnd(last),
      };
    };
    // En l'air, la case visée est celle du plan à 1 m (sinon le tracé dérive à cause de la perspective).
    const aimLevel = machinePath.length > 0 ? levelAfter(dragLifts[dragLifts.length - 1] ?? 0) : 0;
    const cAir = aimLevel >= 1 ? cellOnPlane(rayOrigin, rayDir, levelY(aimLevel)) : null;
    const snap = rampSnap(cAir ?? c);
    // Le patron suit l'inclinaison choisie, au niveau du tapis visé (sol si rien n'est visé).
    // Un tuyau n'a pas de rampes : seul PageDown (entrée de tunnel) change sa forme.
    baseLift = def.id === 'pipe' ? (buildTilt < 0 ? 4 : 0) : tiltLift(snap?.level ?? 0, buildTilt);
    if (baseLift !== hudLift) {
      hudLift = baseLift;
      renderBuildHud();
    }
    const aim = snap && machinePath.length === 0 ? c : (cAir ?? c);
    if (down) {
      const last = machinePath[machinePath.length - 1];
      if (!last) {
        const first = snap?.cell ?? tileAround(aim);
        dragLift = baseLift;
        liftOverride.clear();
        machinePath = [first];
        pathReached.clear();
        if (tileNear(first)) pathReached.add(`${first.gx},${first.gz}`);
      } else if (!contains(last, aim)) {
        const back = machinePath.findIndex((p) => contains(p, aim));
        if (back >= 0) machinePath.length = back + 1;
        else {
          const cur = { ...last };
          for (let guard = 0; guard < MAX_BELT_PATH && !contains(cur, aim); guard++) {
            const dx = aim.gx - (cur.gx + 0.5);
            const dz = aim.gz - (cur.gz + 0.5);
            if (Math.abs(dx) >= Math.abs(dz)) cur.gx += 2 * Math.sign(dx);
            else cur.gz += 2 * Math.sign(dz);
            machinePath.push({ ...cur });
            if (tileNear(cur)) pathReached.add(`${cur.gx},${cur.gz}`);
          }
          if (machinePath.length > MAX_BELT_PATH) machinePath.length = MAX_BELT_PATH;
        }
      }
    }
    const path = machinePath.length > 0 ? machinePath : [snap?.cell ?? tileAround(aim)];
    for (const k of [...liftOverride.keys()]) if (k >= path.length) liftOverride.delete(k);
    const lifts: number[] = [];
    const range = tunnelRange(def.id, tier);
    // Tunnel « à patron » : on tient une entrée de tunnel (PageDown) et on trace en avançant : une entrée, des
    // tuiles sous terre, une sortie à portée maximale, une nouvelle entrée juste après, etc. (jusqu'à la fin du tracé).
    const firstLift = machinePath.length > 0 ? dragLift : baseLift;
    const autoTunnel = firstLift === 4 && liftOverride.size === 0 && path.length > 1;
    path.forEach((_, i) => {
      if (autoTunnel && i > 0) {
        const k = i % (range + 1);
        const isLast = i === path.length - 1;
        lifts.push(k === 0 ? (isLast ? 0 : 4) : k === range || isLast ? 5 : HIDDEN);
        return;
      }
      lifts.push(liftOverride.get(i) ?? (i === 0 ? firstLift : nextLift(lifts[i - 1])));
    });
    // Aperçu (patron seul) : où tomberait la sortie à portée maximale devant l'entrée.
    const previewExit: { gx: number; gz: number; ok: boolean } | null =
      machinePath.length === 0 && baseLift === 4
        ? (() => {
            const [pdx, pdz] = RISE_DIR[snap?.rot ?? baseRot];
            const cell = { gx: path[0].gx + pdx * 2 * range, gz: path[0].gz + pdz * 2 * range };
            return {
              ...cell,
              ok: factory.canPlace(
                def.id,
                cell.gx,
                cell.gz,
                snap?.rot ?? baseRot,
                machineBlocked,
                5,
                tier,
              ),
            };
          })()
        : null;
    dragLifts = lifts;
    let left = stock;
    const rotAt = (i: number): number =>
      i < path.length - 1
        ? dirIndex(path[i], path[i + 1])
        : path.length > 1
          ? dirIndex(path[i - 1], path[i])
          : (snap?.rot ?? baseRot);
    // Tunnel : l'entrée et la sortie doivent être alignées, dans le même sens, et pas trop éloignées.
    const tunnelOk = (i: number): boolean => {
      if (lifts[i] !== 4 && lifts[i] !== 5) return true;
      // Patron seul : l'entrée est valable si la sortie à portée maximale peut se poser.
      if (previewExit && lifts[i] === 4 && path.length === 1) return previewExit.ok;
      if (lifts[i] === 4) {
        const out = lifts.findIndex((l, j) => j > i && l === 5);
        return out >= 0 && tunnelOk(out);
      }
      const inn = lifts.lastIndexOf(4, i);
      if (inn < 0) return false;
      const a = path[inn];
      const b = path[i];
      return (
        rotAt(inn) === rotAt(i) &&
        (a.gx === b.gx || a.gz === b.gz) &&
        Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gz - b.gz)) / 2 <= range
      );
    };
    const all = path.map((cell, i) => {
      const lift = lifts[i];
      const rot = rotAt(i);
      if (lift === HIDDEN) return { type: def.id, gx: cell.gx, gz: cell.gz, rot, ok: false, lift };
      const free =
        factory.canPlace(def.id, cell.gx, cell.gz, rot, machineBlocked, lift, tier) &&
        tileWithin(cell) &&
        tunnelOk(i);
      const ok = free && left > 0;
      if (ok) left--;
      return { type: def.id, gx: cell.gx, gz: cell.gz, rot, ok, lift };
    });
    const ghosts = all.filter((g) => g.lift !== HIDDEN);
    // La sortie du patron n'est qu'un aperçu : elle n'est pas posée avec l'entrée.
    const shown = previewExit
      ? [
          ...ghosts,
          {
            type: def.id,
            gx: previewExit.gx,
            gz: previewExit.gz,
            rot: snap?.rot ?? baseRot,
            ok: previewExit.ok,
            lift: 5,
          },
        ]
      : ghosts;
    factoryView.showGhost(shown);
    if (!down && machinePath.length > 0) {
      let placed = 0;
      for (const g of ghosts) {
        if (
          g.ok &&
          bus.dispatch<'placeMachine'>({
            type: 'placeMachine',
            machine: def.id,
            gx: g.gx,
            gz: g.gz,
            rot: g.rot,
            lift: g.lift,
            tier,
          }) === 'ok'
        )
          placed++;
      }
      if (placed > 0) playSfx('placeWood');
      else playSfx('deny');
      buildMessage =
        placed === 0 ? (stock > 0 ? t('factory.cannotPlace') : t('build.missing')) : '';
      machinePath = [];
      dragLifts = [];
      liftOverride.clear();
      pathReached.clear();
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
    rows.push(`<strong>${t(`item.${itemOfTier(def, m.tier)}` as TranslationKey)}</strong>`);
    rows.push(`<div class="st ${status}">${t(`factory.status.${status}` as TranslationKey)}</div>`);
    if (status === 'noPower') rows.push(`<div class="sub">${t('factory.hint.noPower')}</div>`);
    if (status === 'noWater' && m.type === 'boiler')
      rows.push(`<div class="sub">${t('factory.hint.noWater')}</div>`);
    if (isDrill(m.type)) {
      const ore = factory.oreUnder(m);
      rows.push(
        `<div>${t('factory.production', { rate: t('factory.rateDrill', { n: String(Math.round(10 / (def.mineSeconds ?? 1)) / 10) }) })}</div>`,
      );
      rows.push(`<div>${t('factory.ore', { n: String(ore.total) })}</div>`);
      for (const [item, n] of Object.entries(ore.byItem)) {
        rows.push(`<div class="sub">${t(`item.${item}` as TranslationKey)} : ${n}</div>`);
      }
      rows.push(`<div>${t('factory.stock', { v: stackText(m.stock, def.stockMax) })}</div>`);
    } else if (isSmith(m.type)) {
      const r = recipeById(m.recipe);
      rows.push(
        `<div>${t('machine.recipe')} : ${r ? t(`recipe.${r.id}` as TranslationKey) : t('machine.recipeNone')}</div>`,
      );
      if (r) {
        rows.push(
          `<div class="sub">${Object.entries(r.in)
            .map(
              ([item, n]) =>
                `${m.slots.find((x) => x.item === item)?.count ?? 0} / ${n} × ${t(`item.${item}` as TranslationKey)}`,
            )
            .join(' · ')} · ${r.seconds} s</div>`,
        );
        if (r.mould)
          rows.push(
            `<div class="sub">${t('machine.mould', { item: t(`item.${r.mould}` as TranslationKey) })} : ${m.input?.count ?? 0} · ${t('machine.mouldWear', { n: String(m.wear), max: String(MOULD_CYCLES) })}</div>`,
          );
      }
      rows.push(`<div>${t('factory.output', { v: stackText(m.stock, def.stockMax) })}</div>`);
      if (m.extra)
        rows.push(`<div>${t('machine.byproduct')} : ${stackText(m.extra, def.stockMax)}</div>`);
      if (status === 'noMould') rows.push(`<div class="sub">${t('factory.hint.noMould')}</div>`);
    } else if (isChest(m.type)) {
      rows.push(
        `<div>${t('factory.chest', { n: String(m.slots.length), max: String(def.slots ?? 0) })}</div>`,
      );
      const top = [...m.slots].sort((a, b) => b.count - a.count).slice(0, 4);
      for (const stack of top) {
        rows.push(
          `<div class="sub">${t(`item.${stack.item}` as TranslationKey)} : ${stack.count}</div>`,
        );
      }
      if (m.slots.length === 0) rows.push(`<div class="sub">${t('factory.chestEmpty')}</div>`);
    } else if (isFluid(m.type)) {
      rows.push(`<div class="sub">${t(`factory.router.${m.type}` as TranslationKey)}</div>`);
      const cap = def.fluidCap ?? 100;
      const fmt = (v: number): string =>
        v < 0.5 ? t('factory.fluid.empty') : `${Math.round(v)} / ${cap}`;
      if (m.type !== 'turbine')
        rows.push(`<div>${t('factory.fluid.water', { v: fmt(m.fluid.water) })}</div>`);
      if (m.fluid.dirty >= 0.5)
        rows.push(`<div>${t('factory.fluid.dirty', { v: fmt(m.fluid.dirty) })}</div>`);
      if (m.fluid.polymer >= 0.5)
        rows.push(`<div>${t('factory.fluid.polymer', { v: fmt(m.fluid.polymer) })}</div>`);
      if (m.fluid.oil >= 0.5)
        rows.push(`<div>${t('factory.fluid.oil', { v: fmt(m.fluid.oil) })}</div>`);
      if (m.type === 'accumulator') {
        rows.push(
          `<div>${Math.round(m.fuelLeft / 1000).toLocaleString()} / ${Math.round((def.storageKJ ?? 0) / 1000)} MJ</div>`,
        );
      }
      if (m.type === 'fusion_reactor') {
        const fuel = (item: string): number => m.slots.find((s) => s.item === item)?.count ?? 0;
        rows.push(
          `<div>${t('factory.fusion.fuel', { waste: String(fuel('nuclear_waste')), glass: String(fuel('contaminated_glass')) })}</div>`,
        );
        if (m.wear === 0 && !m.broken && m.progress > 0)
          rows.push(
            `<div>${t('factory.fusion.priming', { s: m.progress.toFixed(1), total: '10' })}</div>`,
          );
      }
      if (m.type === 'pumpjack')
        rows.push(`<div>${t('factory.ore', { n: String(factory.oreUnder(m).total) })}</div>`);
      if (m.fluid.hot >= 0.5)
        rows.push(`<div>${t('factory.fluid.hot', { v: fmt(m.fluid.hot) })}</div>`);
      if (m.type !== 'pump')
        rows.push(`<div>${t('factory.fluid.steam', { v: fmt(m.fluid.steam) })}</div>`);
      if (m.broken) rows.push(`<div class="warn">${t('factory.fluid.broken')}</div>`);
      else if (m.pressure > 0) {
        rows.push(
          m.type === 'pipe'
            ? `<div>${t('factory.fluid.bars', { v: m.pressure.toFixed(1), max: String(pipeMaxBar(m)) })}</div>`
            : `<div>${t('factory.fluid.bars.free', { v: m.pressure.toFixed(1) })}</div>`,
        );
      } else if (
        m.fluid.water +
          m.fluid.steam +
          m.fluid.hot +
          m.fluid.oil +
          m.fluid.polymer +
          m.fluid.dirty >
          0.5 &&
        m.type !== 'turbine'
      ) {
        rows.push(`<div class="sub">${t('factory.fluid.noPressure')}</div>`);
      }
      if (m.type === 'turbine') {
        rows.push(
          `<div>${t('factory.fluid.pressure', { v: String(Math.round((m.fluid.steam / cap) * 100)) })}</div>`,
          `<div>${t('factory.turbine.output', { kw: String(Math.round(factory.turbineKw(m))) })}</div>`,
          `<div class="sub">${t('factory.turbine.help')}</div>`,
        );
      }
    } else if (isTurret(m.type)) {
      rows.push(
        `<div>${t('factory.turret.ammo', { v: `${Math.floor(m.fuelLeft)} + ${stackText(m.input, def.stockMax)}` })}</div>`,
      );
    } else if (isLab(m.type)) {
      const id = options.state.changes.researching;
      rows.push(`<div class="sub">${t('factory.router.lab')}</div>`);
      rows.push(
        `<div>${t('factory.lab.target', { v: id ? `${t(`tech.${id}` as TranslationKey)} (${options.state.changes.progress[id] ?? 0} / ${scienceCost(techById(id))})` : t('factory.lab.none') })}</div>`,
      );
      const packs = m.slots.map((s) => `${t(`item.${s.item}` as TranslationKey)} ${s.count}`);
      rows.push(
        `<div>${t('factory.lab.packs', { v: packs.length > 0 ? packs.join(' · ') : t('factory.empty') })}</div>`,
      );
    } else if (isAssembler(m.type)) {
      const need = recipeOf(m);
      rows.push(
        `<div>${t('factory.assembler.recipe', { v: m.recipe ? t(`item.${m.recipe}` as TranslationKey) : t('factory.assembler.none') })}</div>`,
      );
      if (need) {
        rows.push(
          `<div class="sub">${Object.entries(need)
            .map(
              ([item, n]) =>
                `${m.slots.find((x) => x.item === item)?.count ?? 0}/${n} ${t(`item.${item}` as TranslationKey)}`,
            )
            .join(' · ')}</div>`,
        );
        rows.push(
          `<div>${t('factory.assembler.time', { s: String(def.craftSeconds ?? 2) })}</div>`,
        );
      }
      rows.push(`<div>${t('factory.stock', { v: stackText(m.stock, def.stockMax) })}</div>`);
    } else if (isArm(m.type)) {
      rows.push(`<div class="sub">${t(`factory.router.${m.type}` as TranslationKey)}</div>`);
      rows.push(
        `<div>${t('factory.arm.holding', { v: m.stock ? t(`item.${m.stock.item}` as TranslationKey) : t('factory.router.empty') })}</div>`,
      );
      if (!m.stock)
        rows.push(
          `<div class="sub">${t(`factory.arm.diag.${factory.armDiagnosis(m)}` as TranslationKey)}</div>`,
        );
    } else if (isRouter(m.type)) {
      rows.push(`<div class="sub">${t(`factory.router.${m.type}` as TranslationKey)}</div>`);
      rows.push(
        `<div>${t('factory.router.holding', { v: m.stock ? t(`item.${m.stock.item}` as TranslationKey) : t('factory.router.empty') })}</div>`,
      );
    } else if (m.type === 'pole') {
      const g = factory.gridInfo(m);
      if (g?.blackout) rows.push(`<div class="warn">${t('factory.power.blackout')}</div>`);
      else if (g && g.overloadS > 0)
        rows.push(
          `<div class="warn">${t('factory.power.overload', { s: String(Math.round(g.overloadS)) })}</div>`,
        );
      rows.push(
        g && g.machines > 0
          ? `<div>${t('factory.power.pole', { n: String(g.machines), cap: String(Math.round(g.capacityKw)), demand: String(Math.round(g.demandKw)) })}</div>`
          : `<div class="sub">${t('factory.power.unlinked')}</div>`,
      );
    } else if (m.type === 'generator') {
      const g = factory.gridInfo(m);
      const load =
        g && g.capacityKw > 0 ? Math.min(100, Math.round((g.demandKw / g.capacityKw) * 100)) : 0;
      rows.push(
        `<div>${
          g && load > 0
            ? t('factory.power.producer', { kw: String(def.producesKw ?? 0), load: String(load) })
            : t('factory.power.generatorOff')
        }</div>`,
      );
    } else {
      rows.push(
        `<div>${t('factory.belt', { n: String(m.belt.length), max: String(def.capacity ?? 3) })}</div>`,
      );
      rows.push(`<div>${t('factory.speed', { n: String(beltSpeed(m.tier)) })}</div>`);
      const block = factory.beltBlock(m);
      if (block) {
        const what = t(`item.${block.item}` as TranslationKey);
        rows.push(
          `<div class="sub">${
            !block.target
              ? t('factory.block.nothing', { item: what })
              : block.reason
                ? t('factory.block.refused', {
                    item: what,
                    target: t(`item.${machineDef(block.target.type).item}` as TranslationKey),
                    reason: t(`factory.refuse.${block.reason}` as TranslationKey),
                  })
                : t('factory.block.waiting')
          }</div>`,
        );
      }
    }
    if ((def.pollution ?? 0) > 0) {
      rows.push(
        `<div class="sub">${t(`threat.pollution.${def.pollutionKind ?? 'air'}` as TranslationKey, { v: String(Math.round(factory.pollutionRate(m) * 60)) })}</div>`,
      );
    }
    if (def.fuel) {
      const secs = factory.fuelSecondsLeft(m);
      rows.push(
        `<div>${t('factory.fuel', { v: stackText(m.fuel, def.stockMax), time: duration(secs) })}</div>`,
      );
      if (def.burnKw)
        rows.push(`<div class="sub">${t('factory.burn', { v: String(def.burnKw) })}</div>`);
    }
    if (def.consumesKw) {
      const g = factory.gridInfo(m);
      rows.push(
        `<div>${t('factory.power.line', {
          v: g
            ? t('factory.power.consumer', {
                kw: String(def.consumesKw),
                demand: String(Math.round(g.demandKw)),
                cap: String(Math.round(g.capacityKw)),
                pct: String(Math.round(g.satisfaction * 100)),
              })
            : t('factory.power.none', { m: String(machineDef('pole').linkReachM ?? 4) }),
        })}</div>`,
      );
    } else if (!def.producesKw && m.type !== 'pole' && !isRouter(m.type)) {
      rows.push(`<div>${t('factory.power', { v: t('factory.noPower') })}</div>`);
    }
    if (isChest(m.type)) rows.push(`<small>${t('factory.useHint')}</small>`);
    if (m.type === 'generator') rows.push(`<small>${t('factory.useHint')}</small>`);
    if (hasOutput(m.type) || isArm(m.type)) {
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
  let uiOpen = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  const isLocked = (): boolean => document.pointerLockElement === renderer.domElement;
  // Écran tactile : joystick, glissement pour la caméra et boutons à l'écran.
  const disposeTouch = isTouchMode()
    ? mountTouchControls(container, {
        input,
        onLook: (dx, dy) => {
          if (!paused && !uiOpen) rig.look(dx, dy, getSettings().views);
          signalLook(dx, dy);
        },
        onZoom: (step) => {
          if (!paused && !uiOpen) rig.zoom(step, getSettings().views);
        },
        onPause: () => options.onRequestPause?.(),
        canvas: renderer.domElement,
      })
    : null;

  // Manette : déplacement, regard, actions, et navigation dans les menus (voir input/gamepad.ts).
  const gamepad = mountGamepad({
    input,
    inMenu: () => paused || uiOpen,
    onLook: (dx, dy) => {
      rig.look(dx, dy, getSettings().views);
      signalLook(dx, dy, 0.5);
    },
    onHotbarStep: (step) => {
      const hotbar = options.state.changes.hotbar;
      let i = options.state.selectedSlot ?? (step > 0 ? -1 : 0);
      for (let n = 0; n < hotbar.length; n++) {
        i = (i + step + hotbar.length) % hotbar.length;
        if (hotbar[i]) {
          if (options.state.selectedSlot !== i) options.state.selectSlot(i);
          return;
        }
      }
    },
  });

  let rightMoved = 0;
  /** Après une démolition, le clic droit toujours maintenu continue de démolir les suivants (même en bougeant la souris). */
  let demolishChain = false;
  const onMouseMove = (e: MouseEvent): void => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (paused || uiOpen) return;
    // Clic droit maintenu sans bouger = démolir ; en bougeant, on tourne la caméra.
    if (input.isBindingActive('Mouse2')) rightMoved += Math.hypot(e.movementX, e.movementY);
    else rightMoved = 0;
    if (isLocked() || input.isBindingActive('Mouse2')) {
      rig.look(e.movementX, e.movementY, getSettings().views);
      signalLook(e.movementX, e.movementY);
    }
  };
  window.addEventListener('mousemove', onMouseMove);
  let rightDownAt = 0;
  const onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) rightDownAt = performance.now();
  };
  window.addEventListener('mousedown', onMouseDown);
  const onMouseUp = (e?: Event): void => {
    rig.endLook(getSettings().views);
    // Un clic droit bref, sans bouger : l'objet tenu en main est rangé (mains vides).
    if (
      e instanceof MouseEvent &&
      e.button === 2 &&
      !paused &&
      !uiOpen &&
      options.state.held &&
      performance.now() - rightDownAt < 300 &&
      rightMoved < 10 &&
      !demolishChain
    ) {
      options.state.setHeld(null);
      building = false;
    }
  };
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onMouseUp);

  const requestLock = (): void => {
    if (paused || uiOpen || rig.view !== 'first' || isLocked()) return;
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
  /** Après la fermeture d'une interface avec Échap, le navigateur libère la souris : ce n'est pas une demande de pause. */
  let ignoreUnlockUntil = 0;
  /** Après un Échap qui ferme une interface, le navigateur refuse de recapturer la souris sans geste : on réessaie à la touche / au clic suivant. */
  let wantLock = false;
  const onLockChange = (): void => {
    const locked = isLocked();
    if (!locked && releasingOnPurpose) {
      releasingOnPurpose = false;
    } else if (
      wasLocked &&
      !locked &&
      !paused &&
      !uiOpen &&
      performance.now() > ignoreUnlockUntil
    ) {
      // Le navigateur a libéré la souris (le joueur a appuyé sur Échap) : on ouvre la pause.
      options.onRequestPause?.();
    }
    if (locked) wantLock = false;
    wasLocked = locked;
  };
  document.addEventListener('pointerlockchange', onLockChange);
  const retryLock = (e: KeyboardEvent | MouseEvent): void => {
    if (!wantLock) return;
    if (isLocked() || paused || uiOpen || rig.view !== 'first') {
      wantLock = isLocked() ? false : wantLock && !paused && !uiOpen && rig.view === 'first';
      return;
    }
    if (e instanceof KeyboardEvent && e.key === 'Escape') return;
    requestLock();
  };
  window.addEventListener('keydown', retryLock, true);
  window.addEventListener('mousedown', retryLock, true);

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
    tutorial.signal(`view:${rig.view}`);
    if (rig.view !== 'first') releaseLock();
    if (rig.view === 'first') requestLock();
    options.onViewChange?.(rig.view);
  }

  /** Les machines et les tuyaux sont pleins (on ne les traverse pas) ; les tapis se marchent. */
  const machineSolidAt = (xM: number, zM: number): boolean => {
    const gx = Math.floor(xM / CELL_SIZE_M);
    const gz = Math.floor(zM / CELL_SIZE_M);
    // Sur une dalle d'étage, on est au-dessus des machines du sol ; en bas, on passe sous celles de l'étage.
    const above = playerY >= 1.5;
    const upstairs = factory.machineAt(gx, gz, UPPER_LEVEL);
    if (above && upstairs && upstairs.type !== 'conveyor') return true;
    const m = above ? null : factory.machineAt(gx, gz);
    if (m !== null && m.type === 'conveyor') return false;
    if (m === null) return false;
    // Un poteau ne bloque que près de son mât.
    if (m.type === 'pole') {
      const c = centerOf(m);
      return Math.hypot(xM - c.x, zM - c.z) <= POLE_HIT_M + 0.05;
    }
    return true;
  };
  const isBlockedAt = (xM: number, zM: number): boolean => {
    const gx = Math.floor(xM / CELL_SIZE_M);
    const gz = Math.floor(zM / CELL_SIZE_M);
    return (blocked.has(`${gx},${gz}`) && !bridgeAt(gx, gz)) || machineSolidAt(xM, zM);
  };
  /** Distance parcourue au dernier pas : une pente d'escalier se monte même à faible nombre d'images/s. */
  let stepSlack = 0;
  /** Les rampes inclinées montent d'environ 1,25 m par mètre : on tolère un peu plus de pas qu'un escalier. */
  const BELT_SLACK = 1.4;
  /** Un tapis surélevé ou une rampe barre le passage (côté, dessous) sauf s'il est assez bas pour le monter. */
  const beltBlocked = (x: number, z: number): boolean =>
    factory
      .beltSpansAt(x, z)
      .some(
        (s) =>
          s.top > playerY + STEP_UP_M + stepSlack * BELT_SLACK &&
          s.bottom < playerY + PLAYER_HEIGHT_M,
      );
  const canStand = (x: number, z: number): boolean => {
    const pieces = options.state.changes.pieces;
    for (const dx of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
      for (const dz of [-PLAYER_RADIUS_M, 0, PLAYER_RADIUS_M]) {
        if (isBlockedAt(x + dx, z + dz)) return false;
        if (bodyBlocked(pieces, x + dx, z + dz, playerY, PLAYER_HEIGHT_M, stepSlack)) return false;
        if (beltBlocked(x + dx, z + dz)) return false;
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
      // Se tenir sur un tapis surélevé ou monter une rampe.
      for (const s of factory.beltSpansAt(playerX + dx, playerZ + dz)) {
        if (s.top <= playerY + STEP_UP_M + stepSlack * BELT_SLACK && s.top > ground) ground = s.top;
      }
    }
    let roof = ceilingAbove(pieces, playerX, playerZ, playerY + PLAYER_HEIGHT_M, playerY);
    for (const s of factory.beltSpansAt(playerX, playerZ)) {
      if (s.bottom >= playerY + PLAYER_HEIGHT_M - 0.02 && s.bottom < roof) roof = s.bottom;
    }
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
  /** Un tapis emporte le joueur qui s'y tient (à la vitesse des objets), tant que rien ne le bloque. */
  function carryByBelt(dt: number): void {
    if (!onGround) return;
    // Un tapis surélevé ou une rampe emporte aussi quand on se tient dessus ; au sol, seulement les tapis à plat.
    let m: Machine | null = factory.beltUnder(playerX, playerZ, playerY);
    if (!m && playerY <= 0.2) {
      m = factory.machineAt(Math.floor(playerX / CELL_SIZE_M), Math.floor(playerZ / CELL_SIZE_M));
      if (!m || m.type !== 'conveyor' || m.lift !== 0) return;
    }
    if (!m) return;
    const [dx, dz] = RISE_DIR[m.rot];
    // Le tapis emporte un peu plus que la vitesse des objets : on le sent en marchant dessus.
    const dist = beltSpeed(m.tier) * 2 * CELL_SIZE_M * dt * CARRY_BOOST;
    const nx = playerX + dx * dist;
    const nz = playerZ + dz * dist;
    if (canStand(nx, nz)) {
      playerX = nx;
      playerZ = nz;
    } else if (canStand(nx, playerZ)) playerX = nx;
    else if (canStand(playerX, nz)) playerZ = nz;
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
    // Au volant d'un buggy : bien plus vite tant qu'il reste du carburant (on en prend dans le sac), très lent sinon.
    const driving =
      mounted !== null && (mounted.fuel > 0 || options.state.refuelVehicle(mounted) > 0);
    // Sans carburant le buggy ne bouge plus (on le quitte avec la touche d'utilisation).
    if (mounted && !driving) {
      if (!buggyWarned) options.onMessage?.(t('vehicle.noFuel'));
      buggyWarned = true;
      return { speed: 0, strafe: 0 };
    }
    buggyWarned = false;
    const base = mounted ? BUGGY_FACTOR : 1;
    if (mounted && driving) mounted.fuel = Math.max(0, mounted.fuel - dt);
    const speed =
      WALK_SPEED_M_S * base * (!mounted && input.isActionActive('sprint') ? SPRINT_FACTOR : 1);
    const yaw = rig.yaw;
    // « Avant » = la direction vers laquelle regarde la caméra.
    const dirX = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / len;
    const dirZ = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / len;
    stepSlack = speed * dt;
    const nx = playerX + dirX * speed * dt;
    const nz = playerZ + dirZ * speed * dt;
    const ox = playerX;
    const oz = playerZ;
    // Coincé dans une machine posée sur soi : on peut en sortir librement.
    const stuck = machineSolidAt(playerX, playerZ);
    if (stuck || canStand(nx, nz)) {
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

  // --- Saisons ---------------------------------------------------------------------------------
  const NIGHT_SKY = 0x0a1224;
  const timeCfg = game.options.time;
  let lastSkyMix = -1;
  function updateSeason(): void {
    const time = options.state.changes.time;
    const climate = climateAt(time, timeCfg);
    const day = dayLight(time, timeCfg);
    threat.treeFactor = climate.treeAbsorb;
    // Ambiance de la saison (interpolée : pas de changement brusque) et luminosité du jour / de la nuit.
    setGroundTint(climate.ground, climate.snow);
    hemi.intensity = 1.1 * (0.3 + 0.7 * day.light);
    sun.intensity = 1.6 * day.light;
    const mix = Math.round(day.light * 100) * 1000 + climate.sky;
    if (mix === lastSkyMix) return;
    lastSkyMix = mix;
    const sky = new THREE.Color(NIGHT_SKY).lerp(new THREE.Color(climate.sky), day.light);
    skyNow = sky.getHex();
    (scene.background as THREE.Color).copy(sky);
    if (scene.fog) scene.fog.color.copy(sky);
  }

  // --- Véhicules : buggy ------------------------------------------------------------------------
  let mounted: Vehicle | null = null;
  let buggyWarned = false;
  const vehicleMeshes = new Map<number, THREE.Group>();
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2b2d33 });
  const buggyMat = new THREE.MeshStandardMaterial({ color: 0xc9a227 });
  function makeBuggy(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.5), buggyMat);
    body.position.y = 0.35;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.6), buggyMat);
    cab.position.set(0, 0.65, -0.1);
    g.add(body, cab);
    for (const [x, z] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 10), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.22, z);
      g.add(wheel);
    }
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }
  const vehicleBox = document.createElement('div');
  vehicleBox.className = 'ammo-box';
  vehicleBox.hidden = true;
  container.appendChild(vehicleBox);
  let placeWasDown = false;
  let runOverCooldown = 0;
  const vehicleChests = new Map<number, Machine>();
  /** Le coffre d'un buggy, vu comme un coffre en bois qui partage le contenu du buggy. */
  function vehicleMachine(id: number): Machine | null {
    const v = options.state.changes.vehicles.find((x) => x.id === -id);
    if (!v) return null;
    let m = vehicleChests.get(v.id);
    if (!m) {
      m = emptyMachine(id, 'chest_wood', 0, 0, 0);
      vehicleChests.set(v.id, m);
    }
    m.slots = v.slots;
    // La case de carburant et les secondes de route restantes sont celles du buggy.
    // Redéfini à chaque appel : si la liste des buggys est remplacée (chargement), on pointe toujours le bon.
    Object.defineProperty(m, 'fuel', {
      configurable: true,
      get: () => v.fuelStack,
      set: (x) => (v.fuelStack = x),
    });
    Object.defineProperty(m, 'fuelLeft', {
      configurable: true,
      get: () => v.fuel,
      set: (x) => (v.fuel = x),
    });
    return m;
  }
  /** Le rayon de visée touche-t-il ce buggy (sphère autour de lui) ? */
  function aimsAt(v: Vehicle): boolean {
    computeRay();
    const cx = v.x - rayOrigin.x;
    const cy = 0.5 - rayOrigin.y;
    const cz = v.z - rayOrigin.z;
    const along = cx * rayDir.x + cy * rayDir.y + cz * rayDir.z;
    if (along < 0 || along > 8) return false;
    const d2 = cx * cx + cy * cy + cz * cz - along * along;
    return d2 <= 0.9 * 0.9;
  }
  /** Duvet : rouleau vert ; lit : cadre de métal et matelas. */
  function makeSpawnModel(kind: 'bag' | 'bed'): THREE.Group {
    const g = new THREE.Group();
    if (kind === 'bag') {
      const roll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0x3f5a3a }),
      );
      roll.rotation.z = Math.PI / 2;
      roll.position.y = 0.16;
      roll.castShadow = true;
      g.add(roll);
    } else {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.12, 1.9),
        new THREE.MeshStandardMaterial({ color: 0x6d6f73 }),
      );
      frame.position.y = 0.16;
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.12, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xcdd6dc }),
      );
      mattress.position.y = 0.28;
      frame.castShadow = true;
      g.add(frame, mattress);
    }
    return g;
  }
  let bodyHintId = -1;
  /** Le joueur est près de son corps : F récupère ses affaires ; Maj + F range un duvet ou un lit tout proche. */
  function bodyTick(pressedUse: boolean): void {
    const { corpses, spawns } = options.state.changes;
    const body = corpses.find((c) => Math.hypot(c.x - playerX, c.z - playerZ) <= 2.5);
    if (!body) bodyHintId = -1;
    else if (bodyHintId !== body.id) {
      bodyHintId = body.id;
      options.onMessage?.(t('corpse.hint'));
    }
    if (!pressedUse || aimedMachine || mounted) return;
    if (body && !input.isActionActive('sprint')) {
      const result = options.state.recoverCorpse(body.id);
      options.onMessage?.(
        t(
          result === 'recovered'
            ? 'corpse.recovered'
            : result === 'partial'
              ? 'corpse.bagFull'
              : 'corpse.empty',
        ),
      );
      playSfx('pickup');
      return;
    }
    const sp = spawns.find((s) => Math.hypot(s.x - playerX, s.z - playerZ) <= 2.5);
    if (sp && input.isActionActive('sprint')) {
      options.state.pickUpSpawn(sp.id, { x: playerX, z: playerZ });
      options.onMessage?.(t('spawn.pickedUp'));
    }
  }
  function vehicleTick(dt: number, pressedUse: boolean): void {
    const list = options.state.changes.vehicles;
    // Les modèles suivent la liste enregistrée.
    for (const v of list) {
      let mesh = vehicleMeshes.get(v.id);
      if (!mesh) {
        mesh = makeBuggy();
        scene.add(mesh);
        vehicleMeshes.set(v.id, mesh);
      }
      mesh.position.set(v.x, 0, v.z);
      mesh.rotation.y = v.yaw;
    }
    for (const [id, mesh] of vehicleMeshes) {
      if (!list.some((v) => v.id === id)) {
        scene.remove(mesh);
        vehicleMeshes.delete(id);
      }
    }
    if (mounted && !list.includes(mounted)) mounted = null;
    const near = list
      .filter((v) => Math.hypot(v.x - playerX, v.z - playerZ) <= 3)
      .sort(
        (a, b) =>
          Math.hypot(a.x - playerX, a.z - playerZ) - Math.hypot(b.x - playerX, b.z - playerZ),
      )[0];
    if (pressedUse && !aimedMachine) {
      if (mounted) {
        mounted = null;
        options.onMessage?.(t('vehicle.mount'));
      } else if (near) {
        if (input.isActionActive('sprint')) options.state.pickUpVehicle(near.id);
        else {
          mounted = near;
          if (near.fuel <= 0 && options.state.refuelVehicle(near) <= 0)
            options.onMessage?.(t('vehicle.noFuel'));
        }
      }
    }
    // Clic gauche sur un buggy : on ouvre son coffre (carburant et objets).
    const down = input.isActionActive('interact');
    if (down && !placeWasDown && !building && !uiOpen) {
      const target = list.find((v) => v !== mounted && aimsAt(v));
      if (target) options.onOpenMachine?.(-target.id);
    }
    // Poser un buggy : clic gauche avec le buggy choisi, quand rien d'autre n'est visé.
    if (
      down &&
      !placeWasDown &&
      !building &&
      options.state.selectedItem() === 'vehicle_buggy' &&
      !interaction.aimed
    ) {
      computeRay();
      const cell = cellOnPlane(rayOrigin, rayDir, 0);
      if (cell) {
        const x = center(cell.gx);
        const z = center(cell.gz);
        if (!isBlockedAt(x, z) && Math.hypot(x - playerX, z - playerZ) <= 12) {
          if (options.state.placeVehicle(x, z, facing)) {
            playSfx('placeStone');
            options.onMessage?.(t('vehicle.placed'));
          }
        } else playSfx('deny');
      }
    }
    // Poser un duvet ou un lit : clic gauche avec l'objet choisi, quand rien d'autre n'est visé.
    const spawnItem = options.state.selectedItem();
    if (
      down &&
      !placeWasDown &&
      !building &&
      (spawnItem === 'sleeping_bag' || spawnItem === 'bed') &&
      !interaction.aimed
    ) {
      computeRay();
      const cell = cellOnPlane(rayOrigin, rayDir, 0);
      if (cell) {
        const x = center(cell.gx);
        const z = center(cell.gz);
        if (!isBlockedAt(x, z) && Math.hypot(x - playerX, z - playerZ) <= 6) {
          const kind = spawnItem === 'bed' ? 'bed' : 'bag';
          if (options.state.placeSpawn(kind, x, z)) {
            playSfx('placeWood');
            options.onMessage?.(t(kind === 'bed' ? 'spawn.bedPlaced' : 'spawn.bagPlaced'));
          }
        } else playSfx('deny');
      }
    }
    placeWasDown = down;
    if (mounted) {
      mounted.x = playerX;
      mounted.z = playerZ;
      mounted.yaw = facing;
      // Écraser les ennemis sur la route.
      runOverCooldown = Math.max(0, runOverCooldown - dt);
      if (runOverCooldown <= 0 && mounted.fuel > 0 && threat.enemies.length > 0) {
        const result = threat.hit(playerX, playerZ, 1.8, 20);
        if (result) {
          runOverCooldown = 0.4;
          playSfx(result === 'kill' ? 'rockBreak' : 'enemyHurt');
        }
      }
      vehicleBox.hidden = false;
      vehicleBox.textContent = t('vehicle.fuel', { v: String(Math.round(mounted.fuel)) });
    } else vehicleBox.hidden = true;
  }

  // --- Réticule, indice, réglages, FPS, infos ----------------------------------------------
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  container.appendChild(crosshair);
  // Boussole : le nord est vers −z (devant au départ), l'est vers +x.
  const compass = document.createElement('div');
  compass.className = 'compass';
  const COMPASS_MARKS: { deg: number; key: TranslationKey; major: boolean }[] = [
    { deg: 0, key: 'compass.n', major: true },
    { deg: 45, key: 'compass.ne', major: false },
    { deg: 90, key: 'compass.e', major: true },
    { deg: 135, key: 'compass.se', major: false },
    { deg: 180, key: 'compass.s', major: true },
    { deg: 225, key: 'compass.sw', major: false },
    { deg: 270, key: 'compass.w', major: true },
    { deg: 315, key: 'compass.nw', major: false },
  ];
  const compassMarks = COMPASS_MARKS.map((mark) => {
    const node = document.createElement('span');
    node.className = mark.major ? 'compass-mark major' : 'compass-mark';
    node.textContent = t(mark.key);
    compass.append(node);
    return node;
  });
  const compassValue = document.createElement('span');
  compassValue.className = 'compass-value';
  compass.append(compassValue);
  container.appendChild(compass);
  /** Cap de la caméra en degrés : 0 = nord, 90 = est. */
  // Repère du corps sur la boussole (croix rouge ; au bord, une flèche quand il est hors du champ).
  const corpseMark = document.createElement('span');
  corpseMark.className = 'compass-mark corpse-mark';
  corpseMark.textContent = '✝';
  compass.append(corpseMark);
  /** Met à jour les modèles des corps et des points de réapparition, et le repère du corps le plus proche sur la boussole. */
  function updateCorpse(hasCompass: boolean, bearing: number): void {
    const { corpses, spawns } = options.state.changes;
    for (const c of corpses) {
      let mesh = corpseMeshes.get(c.id);
      if (!mesh) {
        mesh = new THREE.Mesh(corpseGeometry, corpseMaterial);
        mesh.rotation.z = Math.PI / 2;
        mesh.castShadow = true;
        scene.add(mesh);
        corpseMeshes.set(c.id, mesh);
      }
      mesh.position.set(c.x, PLAYER_RADIUS_M, c.z);
      mesh.rotation.y = c.yaw;
    }
    for (const [id, mesh] of corpseMeshes) {
      if (corpses.some((c) => c.id === id)) continue;
      scene.remove(mesh);
      corpseMeshes.delete(id);
    }
    for (const sp of spawns) {
      let g = spawnMeshes.get(sp.id);
      if (!g) {
        g = makeSpawnModel(sp.kind);
        scene.add(g);
        spawnMeshes.set(sp.id, g);
      }
      g.position.set(sp.x, 0, sp.z);
    }
    for (const [id, g] of spawnMeshes) {
      if (spawns.some((sp) => sp.id === id)) continue;
      scene.remove(g);
      spawnMeshes.delete(id);
    }
    // Corps le plus proche.
    const body = corpses.reduce<(typeof corpses)[number] | null>(
      (best, c) =>
        !best ||
        Math.hypot(c.x - playerX, c.z - playerZ) < Math.hypot(best.x - playerX, best.z - playerZ)
          ? c
          : best,
      null,
    );
    corpseMark.style.display = hasCompass && body ? '' : 'none';
    if (!hasCompass || !body) return;
    const target =
      ((Math.atan2(body.x - playerX, -(body.z - playerZ)) * 180) / Math.PI + 360) % 360;
    const diff = ((target - bearing + 540) % 360) - 180;
    const clamped = Math.max(-80, Math.min(80, diff));
    corpseMark.style.left = `calc(50% + ${(clamped / 80) * 160}px)`;
    corpseMark.textContent = diff < -80 ? '◄✝' : diff > 80 ? '✝►' : '✝';
  }
  function updateCompass(): void {
    // La boussole est une amélioration : elle n'apparaît qu'une fois la technologie « Navigation » recherchée.
    const hasCompass = options.state.changes.unlocked.includes('navigation');
    compass.hidden = !hasCompass;
    const bearing = ((((-rig.yaw * 180) / Math.PI) % 360) + 360) % 360;
    updateCorpse(hasCompass, bearing);
    if (!hasCompass) return;
    const half = 160;
    const span = 80;
    COMPASS_MARKS.forEach((mark, i) => {
      const diff = ((mark.deg - bearing + 540) % 360) - 180;
      const node = compassMarks[i];
      const visible = Math.abs(diff) < span;
      node.style.display = visible ? '' : 'none';
      if (visible) {
        node.style.left = `calc(50% + ${(diff / span) * half}px)`;
        node.style.opacity = String(1 - Math.abs(diff) / span);
      }
    });
    compassValue.textContent = `${Math.round(bearing)}°`;
  }
  // --- Pollution, ennemis, santé ---------------------------------------------------------------
  const cellChunks = POLLUTION_CELL_M / (CHUNK_CELLS * CELL_SIZE_M);
  interface NestPos {
    x: number;
    z: number;
    gx: number;
    gz: number;
    cells: number;
  }
  const nestCache = new Map<string, NestPos[]>();
  const treeCache = new Map<string, number>();
  const scanCell = (pcx: number, pcz: number): void => {
    const k = `${pcx},${pcz}`;
    if (nestCache.has(k)) return;
    const nests: NestPos[] = [];
    let trees = 0;
    for (let dz = 0; dz < cellChunks; dz++) {
      for (let dx = 0; dx < cellChunks; dx++) {
        for (const o of generator.chunk(pcx * cellChunks + dx, pcz * cellChunks + dz).objects) {
          if (o.id === 'nest') {
            // Un nid détruit (dégâts cumulés) n'existe plus.
            if ((options.state.changes.taken[cellKey(o.gx, o.gz)] ?? 0) >= NEST_HP) continue;
            nests.push({
              gx: o.gx,
              gz: o.gz,
              cells: o.cells,
              x: (o.gx + o.cells / 2) * CELL_SIZE_M,
              z: (o.gz + o.cells / 2) * CELL_SIZE_M,
            });
          } else if (o.id === 'tree') trees++;
        }
        for (const o of extraNestsIn(
          options.state.changes,
          pcx * cellChunks + dx,
          pcz * cellChunks + dz,
        )) {
          if ((options.state.changes.taken[cellKey(o.gx, o.gz)] ?? 0) >= NEST_HP) continue;
          nests.push({
            gx: o.gx,
            gz: o.gz,
            cells: o.cells,
            x: (o.gx + o.cells / 2) * CELL_SIZE_M,
            z: (o.gz + o.cells / 2) * CELL_SIZE_M,
          });
        }
      }
    }
    nestCache.set(k, nests);
    treeCache.set(k, trees);
  };
  const nestsNear = (x: number, z: number, radiusM: number): NestPos[] => {
    const out: NestPos[] = [];
    const r = Math.ceil(radiusM / POLLUTION_CELL_M);
    const cx = Math.floor(x / POLLUTION_CELL_M);
    const cz = Math.floor(z / POLLUTION_CELL_M);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        scanCell(cx + dx, cz + dz);
        for (const n of nestCache.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (Math.hypot(n.x - x, n.z - z) <= radiusM) out.push(n);
        }
      }
    }
    return out;
  };
  /** Inflige des dégâts à un nid ; à 0 point de vie il disparaît (et ses gardiens avec lui). */
  function damageNest(nest: NestPos, amount: number): 'hit' | 'kill' {
    options.state.takeFromWorld(cellKey(nest.gx, nest.gz), NEST_HP, amount);
    if ((options.state.changes.taken[cellKey(nest.gx, nest.gz)] ?? 0) < NEST_HP) return 'hit';
    const k = `${Math.floor(nest.x / POLLUTION_CELL_M)},${Math.floor(nest.z / POLLUTION_CELL_M)}`;
    nestCache.delete(k);
    dirtyChunks.add(`${Math.floor(nest.gx / CHUNK_CELLS)},${Math.floor(nest.gz / CHUNK_CELLS)}`);
    for (let i = threat.enemies.length - 1; i >= 0; i--) {
      const home = threat.enemies[i].home;
      if (home && Math.hypot(home.x - nest.x, home.z - nest.z) < 1) threat.enemies.splice(i, 1);
    }
    playSfx('rockBreak');
    options.onMessage?.(t('threat.nestDestroyed'));
    return 'kill';
  }
  /** Le tir touche-t-il un nid avant `maxAlong` m ? (cône de 1 m de haut centré sur le nid) */
  function shootNest(maxAlong: number, damage: number): number | null {
    let best: { nest: NestPos; along: number } | null = null;
    for (const n of nestsNear(rayOrigin.x, rayOrigin.z, maxAlong + 6)) {
      const wx = n.x - rayOrigin.x;
      const wy = 0.4 - rayOrigin.y;
      const wz = n.z - rayOrigin.z;
      const along = wx * rayDir.x + wy * rayDir.y + wz * rayDir.z;
      if (along < 0 || along > maxAlong || (best && along >= best.along)) continue;
      const cx = rayOrigin.x + rayDir.x * along - n.x;
      const cy = rayOrigin.y + rayDir.y * along - 0.4;
      const cz = rayOrigin.z + rayDir.z * along - n.z;
      if (Math.hypot(cx, cy, cz) <= Math.max(0.8, n.cells * 0.25)) best = { nest: n, along };
    }
    if (!best) return null;
    damageNest(best.nest, damage);
    return best.along;
  }
  const threatWorld: ThreatWorld = {
    nestsNear,
    nestsIn: (pcx, pcz) => (scanCell(pcx, pcz), nestCache.get(`${pcx},${pcz}`) ?? []),
    addNest: (x, z) => {
      const changes = options.state.changes;
      const gx = Math.floor(x / CELL_SIZE_M);
      const gz = Math.floor(z / CELL_SIZE_M);
      const clearM =
        (resourceById('nest') as { minDistanceFromSpawnM?: number }).minDistanceFromSpawnM ?? 250;
      if (changes.nests.length >= MAX_EXTRA_NESTS) return false;
      if (Math.hypot(x - DEFAULT_PLAYER_STATE.x, z - DEFAULT_PLAYER_STATE.z) < clearM) return false;
      if (waterCellAt(gx, gz) || waterCellAt(gx + 1, gz + 1)) return false;
      if (nestsNear(x, z, 10).length > 0) return false;
      // Jamais sur une base : à 15 m d'une machine ou d'un joueur, on ne fonde pas.
      if (
        factory.machines.some(
          (m) => Math.hypot((m.gx + 1) * CELL_SIZE_M - x, (m.gz + 1) * CELL_SIZE_M - z) < 15,
        )
      )
        return false;
      if (Math.hypot(playerX - x, playerZ - z) < 15) return false;
      changes.nests.push({ gx, gz, cells: 4 });
      nestCache.delete(`${Math.floor(x / POLLUTION_CELL_M)},${Math.floor(z / POLLUTION_CELL_M)}`);
      dirtyChunks.add(`${Math.floor(gx / CHUNK_CELLS)},${Math.floor(gz / CHUNK_CELLS)}`);
      return true;
    },
    treesIn: (pcx, pcz) => (scanCell(pcx, pcz), treeCache.get(`${pcx},${pcz}`) ?? 0),
  };
  const threat = new Threat(
    options.state.changes.pollution,
    options.state.changes.groundPollution,
    threatWorld,
    {
      aggressive: game.options.enemies.aggressive,
      expand: game.options.enemies.expand,
    },
    options.state.changes.enemies,
  );
  const sim = new WorldSimulation(options.state, factory, threat);
  const guest = options.guest ?? null;
  guest?.attach(factory);
  let guestClock = 0;
  const remotePlayers = new RemotePlayersView(scene);
  if (guest) {
    // L'état du monde reçu de l'hôte : les arbres et rochers récoltés, les nids… se redessinent.
    guest.onWorldChange((changed) => {
      if (changed.includes('taken') || changed.includes('nests')) {
        nestCache.clear();
        for (const k of chunks.keys()) dirtyChunks.add(k);
      }
    });
    guest.onHit((amount) => onSimEvent({ type: 'playerHit', player: guest.client.you.id, amount }));
  }
  /** Session d'hôte multijoueur (quand la partie est ouverte aux invités). */
  let hostSession: HostSession | null = null;
  const enemyView = new EnemyView(scene);
  const MAX_HEALTH = 100;
  let playerHealth = MAX_HEALTH;
  let sinceHurt = 99;
  let attackCooldown = 0;
  let tracerLife = 0;
  const tracer = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffe28a }),
  );
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  // Pistolet : en main (1ère personne) et au bout du bras du personnage.
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22 });
  /** Un pistolet est prêt : dans la case d'outils, ou choisi dans la barre de raccourcis. */
  const pistolReady = (): boolean =>
    options.state.toolItem() === 'pistol' || options.state.selectedItem() === 'pistol';
  function makeGun(): THREE.Group {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.34), gunMat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), gripMat);
    grip.position.set(0, -0.1, -0.1);
    grip.rotation.x = 0.25;
    g.add(barrel, grip);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }
  const gun = makeGun();
  gun.position.set(0.26, -0.24, -0.6);
  gun.visible = false;
  camera.add(gun);
  const gunBody = makeGun();
  gunBody.scale.setScalar(1.4);
  gunBody.position.set(-0.3, 0.1, 0.4);
  gunBody.visible = false;
  player.add(gunBody);
  const ammoBox = document.createElement('div');
  ammoBox.className = 'ammo-box';
  ammoBox.hidden = true;
  container.appendChild(ammoBox);
  function renderAmmo(): void {
    ammoBox.textContent = t('weapon.ammo', {
      n: String(options.state.changes.ammo),
      max: String(MAGAZINE_ROUNDS),
      mags: String(options.state.inventory.magazine ?? 0),
    });
  }
  let lastAcidMessage = -1e9;
  const hurtOverlay = document.createElement('div');
  hurtOverlay.className = 'hurt-overlay';
  container.appendChild(hurtOverlay);
  // --- Tutoriel pas à pas (en haut à droite) ---
  const tutorial = new Tutorial(options.state.changes, game.options.tutorial);
  const tutorialPanel = mountTutorialPanel(container, tutorial, () => {
    tutorial.skip();
    tutorialPanel.refresh();
  });
  // Séquence finale : montrée une seule fois, quand la balise est activée.
  let closeFinale: (() => void) | null = null;
  function checkFinale(): void {
    if (!options.state.changes.beacon || options.state.changes.finaleShown || closeFinale) return;
    options.state.changes.finaleShown = true;
    closeFinale = showFinale(container, () => {
      closeFinale = null;
    });
  }
  // Fabrication à la main en cours : petite barre au-dessus de la barre d'objets.
  const craftHud = document.createElement('div');
  craftHud.className = 'craft-hud';
  craftHud.hidden = true;
  craftHud.innerHTML = '<span></span><div class="craft-bar"><div></div></div>';
  container.appendChild(craftHud);
  const craftHudText = craftHud.querySelector('span') as HTMLElement;
  const craftHudFill = craftHud.querySelector('.craft-bar > div') as HTMLElement;
  function updateCraftHud(): void {
    const p = options.state.craftProgress();
    craftHud.hidden = !p;
    if (!p) return;
    craftHudText.textContent = `${t(`item.${p.item}` as TranslationKey)} (${p.queued})`;
    craftHudFill.style.width = `${Math.round(p.fraction * 100)}%`;
  }
  /** Tutoriel : la caméra doit tourner dans les deux sens, à l'horizontale comme à la verticale. */
  function signalLook(dx: number, dy: number, min = 2): void {
    if (Math.abs(dx) > min) tutorial.signal(dx < 0 ? 'lookLeft' : 'lookRight');
    if (Math.abs(dy) > min) tutorial.signal(dy < 0 ? 'lookUp' : 'lookDown');
  }
  let tutorialClock = 0;
  function updateTutorial(dt: number): void {
    if (!tutorial.current()) return;
    // La vue dans laquelle on est compte déjà pour l'étape « les 3 vues ».
    if (tutorial.current()?.id === 'view') tutorial.signal(`view:${rig.view}`);
    for (const dir of ['forward', 'backward', 'left', 'right'] as const)
      if (input.isActionActive(dir)) tutorial.signal(dir);
    if (input.isActionActive('jump')) tutorial.signal('jump');
    if (input.isActionActive('crouch')) tutorial.signal('crouch');
    if (input.isActionActive('sprint') && input.isActionActive('forward'))
      tutorial.signal('sprint');
    tutorialClock += dt;
    if (tutorialClock < 0.25) return;
    tutorialClock = 0;
    const finished = tutorial.update({
      inventory: options.state.inventory,
      hasTool: options.state.harvestTool() !== null,
      machines: factory.machines.map((m) => ({
        type: m.type,
        fuelCount: m.fuel?.count ?? 0,
        slots: m.slots,
        stockItem: m.stock?.item ?? null,
      })),
    });
    if (finished) playSfx('select');
    tutorialPanel.refresh(finished !== null && tutorial.current() === null);
  }
  const healthBar = document.createElement('div');
  healthBar.className = 'health-bar';
  healthBar.innerHTML = '<div class="health-fill"></div><span></span>';
  container.appendChild(healthBar);
  const healthFill = healthBar.querySelector('.health-fill') as HTMLElement;
  const healthText = healthBar.querySelector('span') as HTMLElement;
  const machineCenter = (m: Machine): { x: number; z: number } => {
    const { w, d } = dims(m.type, m.rot);
    return { x: (m.gx + w / 2) * CELL_SIZE_M, z: (m.gz + d / 2) * CELL_SIZE_M };
  };
  /** Ce que le monde signale au joueur : sons, messages, dégâts reçus. */
  function onSimEvent(e: SimEvent): void {
    switch (e.type) {
      case 'playerHit':
        playerHealth -= e.amount;
        sinceHurt = 0;
        playSfx('deny');
        break;
      case 'machineLost':
        playSfx('rockBreak');
        options.onMessage?.(t('threat.machineLost'));
        break;
      case 'machineAcid':
        factoryView.rebuild();
        playSfx('rockBreak');
        if (performance.now() - lastAcidMessage > 8000) {
          lastAcidMessage = performance.now();
          options.onMessage?.(t('threat.acid'));
        }
        break;
      case 'pipeBurst':
        playSfx('pipeBurst');
        options.onMessage?.(t('factory.pipeBurst'));
        break;
      case 'turretShot':
        playSfx(e.kill ? 'rockBreak' : 'shot');
        break;
      case 'produced':
        if (e.item === 'iron_ingot') tutorial.signal('iron');
        break;
      case 'autoStudy':
        options.onMessage?.(t('tech.autoStudy', { tech: t(`tech.${e.tech}` as TranslationKey) }));
        break;
    }
  }

  /** Combat du joueur (pistolet, corps à corps), santé et mort : ce qui ne concerne que LUI. */
  function updateThreat(dt: number): void {
    // Le joueur combat : au pistolet (clic gauche pour tirer, R pour recharger) ou, sinon, au corps à corps.
    attackCooldown = Math.max(0, attackCooldown - dt);
    tracerLife = Math.max(0, tracerLife - dt);
    tracer.visible = tracerLife > 0;
    const armed = pistolReady() && !building;
    // Le pistolet de la case d'outils ne sort que pendant l'action de tir ; celui de la barre reste en main.
    const gunOut =
      armed && (options.state.selectedItem() === 'pistol' || input.isActionActive('interact'));
    gun.visible = gunOut && rig.view === 'first';
    gunBody.visible = gunOut && rig.view !== 'first';
    if (armed) {
      if (pressed('rotate')) {
        const result = options.state.reload();
        if (result === 'ok') {
          playSfx('reload');
          options.onMessage?.(t('weapon.reloaded'));
        } else if (result === 'noMagazine') options.onMessage?.(t('weapon.noMagazine'));
      }
      // Pistolet de la case d'outils : on tire quand il n'y a rien à récolter sous la visée.
      const canShoot = options.state.selectedItem() === 'pistol' || !interaction.aimed;
      if (attackCooldown <= 0 && canShoot && input.isActionActive('interact')) {
        attackCooldown = 0.35;
        if (!options.state.fire()) {
          playSfx('deny');
          options.onMessage?.(t('weapon.empty'));
        } else {
          computeRay();
          const shot = threat.shoot(rayOrigin, rayDir, 40, 10);
          guest?.client.fire(rayOrigin, rayDir);
          // Un nid sur la ligne de tir (et plus près qu'un ennemi touché) encaisse le tir.
          const nestAt = shot.result === null ? shootNest(shot.distance, 10) : null;
          if (nestAt !== null) shot.distance = nestAt;
          playSfx('shot');
          const end = rayOrigin.clone().addScaledVector(rayDir, shot.distance);
          const start = rayOrigin.clone().addScaledVector(rayDir, 0.6);
          if (rig.view !== 'first') start.set(playerX, playerY + 1.1, playerZ);
          tracer.geometry.setFromPoints([start, end]);
          tracerLife = 0.07;
          if (shot.result === 'kill') playSfx('rockBreak');
          else if (shot.result === 'hit') playSfx('enemyHurt');
          renderAmmo();
        }
      }
    } else if (attackCooldown <= 0 && !building && input.isActionActive('interact')) {
      let result = threat.hit(playerX, playerZ, 2.6, 12);
      if (result) guest?.client.melee();
      if (!result) {
        const close = nestsNear(playerX, playerZ, 3.6)[0];
        if (close) result = damageNest(close, 12);
      }
      if (result) {
        attackCooldown = 0.45;
        playSfx(result === 'kill' ? 'rockBreak' : 'woodChop');
      }
    }
    // Santé : elle revient doucement ; à zéro, on se réveille au point de départ.
    sinceHurt += dt;
    if (sinceHurt > 5) playerHealth = Math.min(MAX_HEALTH, playerHealth + 4 * dt);
    if (playerHealth <= 0) {
      playerHealth = MAX_HEALTH;
      // Le corps reste sur place avec toutes les affaires ; on se réveille au dernier duvet / lit posé (un duvet
      // est consommé), sinon au premier point.
      options.state.dieAt(playerX, playerZ, facing);
      const spawn = options.state.consumeRespawn();
      playerX = spawn?.x ?? DEFAULT_PLAYER_STATE.x;
      playerZ = spawn?.z ?? DEFAULT_PLAYER_STATE.z;
      playerY = 0;
      velY = 0;
      options.onMessage?.(t('threat.knockedOut'));
    }
  }
  const hint = document.createElement('div');
  hint.className = 'look-hint';
  hint.textContent = t('hint.mouseLook');
  container.appendChild(hint);
  // Mode débogage (touche F3) : boîtes autour des cibles, infos de partie, compteur d'images.
  let debugOn = false;
  let showHealthSetting = false;
  let showFpsSetting = false;
  function applyDebug(): void {
    debugBox.hidden = !debugOn;
    fpsBox.hidden = !(debugOn || showFpsSetting);
    interaction.showBoxes = debugOn;
    options.onDebugChange?.(debugOn);
  }
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
    scene.fog = new THREE.Fog(skyNow, far * 0.55, far);
    fpsLimit = d.fpsLimit;
    showFpsSetting = d.showFps;
    showHealthSetting = d.showHealth;
    applyDebug();
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
      (() => {
        const clock = options.state.changes.time;
        const { season, day, year } = climateAt(clock, timeCfg);
        const light = dayLight(clock, timeCfg);
        return `${t('debug.season')} : ${t(`season.${season.id}` as TranslationKey)} · ${t('debug.seasonDay', { d: String(day), y: String(year) })} · ${t(light.isDay ? 'time.day' : 'time.night')}`;
      })(),
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
  const camPos = new THREE.Vector3();
  const toPlayer = new THREE.Vector3();
  /** Un mur, une dalle, une machine, un tronc ou un rocher cache-t-il le personnage depuis la caméra ? */
  function playerHidden(): boolean {
    camera.getWorldPosition(camPos);
    toPlayer.set(playerX - camPos.x, playerY + 1.0 - camPos.y, playerZ - camPos.z);
    const dist = toPlayer.length();
    if (dist < 0.8) return false;
    toPlayer.divideScalar(dist);
    const dir = { x: toPlayer.x, y: toPlayer.y, z: toPlayer.z };
    const origin = { x: camPos.x, y: camPos.y, z: camPos.z };
    const reach = dist - 0.35;
    const piece = pickPiece(options.state.changes.pieces, origin, dir, reach);
    if (piece && piece.t < reach) return true;
    const machine = pickMachine(factory, origin, dir, reach);
    if (machine && machine.t < reach) return true;
    for (let t = 0.3; t < reach; t += 0.15) {
      if (obstacleAt(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t)) return true;
    }
    return false;
  }
  function updateGhost(views: Settings['views']): void {
    const on =
      rig.view === 'third' ? views.third.ghost : rig.view === 'top' ? views.top.ghost : false;
    // L'aura ne s'allume que si quelque chose se trouve vraiment entre la caméra et le personnage.
    const show = on && playerHidden();
    ghostUniforms.uGhostOn.value = show ? 1 : 0;
    if (!show) return;
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
    if (pressed('map')) {
      tutorial.signal('map');
      options.onToggleMap?.();
    }
    if (pressed('debug')) {
      debugOn = !debugOn;
      applyDebug();
      if (debugOn && !options.state.changes.admin) {
        options.state.changes.admin = true;
        options.onMessage?.(t('debug.adminWarn'));
      }
    }
    if (pressed('techTree')) options.onToggleTech?.();
    updateTutorial(dt);
    checkFinale();
    if (!paused && !guest) options.state.tickCraft(dt);
    updateCraftHud();

    let motion = { speed: 0, strafe: 0 };
    if (!paused) {
      if (!uiOpen) {
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
            // Depuis l'automatique, on part de l'orientation actuelle : jamais deux fois la même.
            const base =
              buildingMachine || buildType() === 'stairs' ? autoRot() : lastAimAxis === 'z' ? 1 : 0;
            buildRot = ((buildRot ?? base) + 1) % 4;
            renderBuildHud();
          }
          const up = pressed('levelUp');
          const down = pressed('levelDown');
          if (buildingMachine) {
            // Tapis : change de forme (plat, rampe, surélevé, descente, tunnel).
            const tunnelable =
              selectedMachine()?.id === 'conveyor' || selectedMachine()?.id === 'pipe';
            if ((up || down) && selectedMachine() && !tunnelable) {
              if (!isLinear(selectedMachine()!.id)) {
                buildMachineLevel = up ? UPPER_LEVEL : 0;
                renderBuildHud();
              }
            } else if ((up || down) && tunnelable) {
              if (machinePath.length > 0) {
                // En traçant : monter / descendre à partir du tapis sous le curseur (rampe, entrée ou sortie de tunnel).
                const i = machinePath.length - 1;
                const before = i === 0 ? 0 : levelAfter(dragLifts[i - 1]);
                const set = liftOverride.get(i);
                if (up) {
                  // Monter : rampe (sol → 1 → 2) ou sortie de tunnel ; annule une descente choisie sur cette tuile.
                  if (set === 4 || set === 3 || set === 8) liftOverride.delete(i);
                  else if (before === 0 && selectedMachine()?.id === 'conveyor')
                    liftOverride.set(i, 1);
                  else if (before === 1) liftOverride.set(i, 6);
                  else if (before === -1) liftOverride.set(i, 5);
                } else if (set === 1 || set === 6) liftOverride.delete(i);
                else if (before === 0) liftOverride.set(i, 4);
                else if (before === 1) liftOverride.set(i, 3);
                else if (before === 2) liftOverride.set(i, 8);
              } else {
                // Patron : PageUp l'incline vers le haut, PageDown le remet à plat puis l'incline vers le bas
                // (un tuyau n'a pas de rampe : seulement à plat ou entrée de tunnel).
                const maxTilt = selectedMachine()?.id === 'pipe' ? 0 : 1;
                buildTilt = Math.max(-1, Math.min(maxTilt, buildTilt + (up ? 1 : -1)));
                renderBuildHud();
              }
              renderBuildHud();
            }
          } else if (up) {
            buildLevel = Math.min(9, buildLevel + 1);
            renderBuildHud();
          } else if (down) {
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
      }
      updateSeason();
      const useKey = pressed('use');
      vehicleTick(dt, useKey);
      bodyTick(useKey);
      motion = step(dt);
      stepBody(dt);
      carryByBelt(dt);
    }

    updateWanted(
      Math.floor(playerX / CHUNK_SIZE_M),
      Math.floor(playerZ / CHUNK_SIZE_M),
      viewDistance,
    );
    loadMissing();

    const edge =
      rig.view === 'top' && views.top.edgeScroll && !paused && !uiOpen && !isLocked()
        ? edgePan(mouseX, mouseY, window.innerWidth, window.innerHeight)
        : { x: 0, y: 0 };
    rig.update(dt, { x: playerX, y: playerY, z: playerZ }, motion, views, edge, obstacleAt);

    player.visible = rig.view !== 'first';
    player.position.set(playerX, playerY + PLAYER_HEIGHT_M / 2, playerZ);
    player.rotation.y = facing;
    const armedNow = pistolReady() && !building;
    // L'outil n'apparaît dans les mains que pendant l'action qui en a besoin (couper, casser, miner).
    const usingTool = interaction.working === 'tool' && !armedNow;
    const toolId = options.state.toolItem();
    for (const head of toolHeads) head.material = toolId === 'tool_iron' ? metal : stoneHead;
    hand.visible = rig.view === 'first' && views.first.showHands && usingTool;
    bodyTool.visible = rig.view !== 'first' && usingTool;
    bareHand.visible = rig.view === 'first' && views.first.showHands && !usingTool && !gun.visible;
    ammoBox.hidden = !armedNow;
    if (armedNow) renderAmmo();
    crosshair.hidden = rig.view !== 'first' || views.first.crosshairStyle === 'none';
    hint.hidden = !(rig.view === 'first' && !paused && !uiOpen && !isLocked());
    sun.position.set(playerX + 8, 16, playerZ + 6);
    sun.target.position.set(playerX, 0, playerZ);
    // Manette : pas de curseur, on vise au centre de l'écran.
    if (gamepad.active() && !isLocked()) {
      mouseX = window.innerWidth / 2;
      mouseY = window.innerHeight / 2;
    }
    updateGhost(views);
    updateCompass();
    // Les étages au-dessus du joueur sont masqués (sauf celui qu'on est en train de construire).
    const pcell = `${Math.floor(playerX / CELL_SIZE_M)},${Math.floor(playerZ / CELL_SIZE_M)}`;
    const inRoom = options.state.rooms().find((r) => r.level === 0 && r.cells.includes(pcell));
    // Construction libre : tous les étages restent visibles (une pièce posée haut ne disparaît jamais) ; seul le
    // plafond de la pièce où l'on se trouve est masqué.
    buildingView.setVisibility(99, inRoom && !building ? inRoom.level : null);
    if (building && !paused && !uiOpen) updateBuild(dt);
    // Monde : simulation à pas fixe (20 par seconde), la même que celle d'un hôte multijoueur.
    if (guest) {
      // Invité : le monde est simulé par l'hôte ; on lui envoie notre position et on affiche les autres joueurs.
      guestClock += dt;
      if (guestClock >= 0.1) {
        guestClock = 0;
        guest.client.sendPosition({ x: playerX, y: playerY, z: playerZ, yaw: facing });
        guest.syncLoadout();
      }
      remotePlayers.update(guest.client.players, guest.client.you.id, dt);
    } else if (!paused) {
      const me = { x: playerX, z: playerZ };
      const events = sim.advance(
        dt,
        hostSession ? hostSession.simPlayers(me) : [{ id: 'player', ...me }],
      );
      for (const e of events) onSimEvent(e);
      if (hostSession) {
        hostSession.routeEvents(events);
        hostSession.advance(dt, { x: playerX, y: playerY, z: playerZ, yaw: facing });
      }
    }
    if (hostSession) {
      remotePlayers.update(
        hostSession.players().filter((p) => p.id !== HOST_ID),
        HOST_ID,
        dt,
      );
    } else if (!guest) remotePlayers.update([], HOST_ID, dt);
    if (!paused) updateThreat(dt);
    factoryView.updateSmoke(now / 1000);
    enemyView.update(
      threat.enemies,
      (e) => {
        if (!e.target) return null;
        if (e.target === 'player') return { x: playerX, z: playerZ };
        const m = factory.machines.find((x) => `machine:${x.id}` === e.target);
        return m ? machineCenter(m) : null;
      },
      now / 1000,
    );
    healthBar.hidden = !showHealthSetting;
    // La rougeur de l'écran dit la gravité : elle monte avec les dégâts reçus et s'efface quand la santé revient.
    const hurt = Math.min(1, Math.max(0, (MAX_HEALTH - playerHealth) / MAX_HEALTH));
    hurtOverlay.style.opacity = String(
      Math.min(0.85, hurt * 0.9 + Math.max(0, 1 - sinceHurt) * 0.25),
    );
    healthFill.style.width = `${Math.max(0, Math.round(playerHealth))}%`;
    healthText.textContent = `${t('threat.health')} ${Math.max(0, Math.round(playerHealth))}`;
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
      if (paused || uiOpen) aimedMachine = null;
      else updateAimedMachine();
      refreshMachinePanel();
    }
    if (!paused && !uiOpen && pressed('use') && aimedMachine && hasWindow(aimedMachine.type))
      options.onOpenMachine?.(aimedMachine.id);
    if (!input.isActionActive('secondary')) demolishChain = false;
    interaction.update({
      // Temps réel : sur un ordinateur lent, la récolte ne doit pas ralentir.
      dt: realDt,
      player: { x: playerX, z: playerZ },
      active:
        !paused &&
        !uiOpen &&
        !building &&
        options.state.selectedItem() !== 'pistol' &&
        input.isActionActive('interact'),
      demolishing:
        !paused &&
        !uiOpen &&
        input.isActionActive('secondary') &&
        (rightMoved < 10 || demolishChain),
      // En construction, la récolte est coupée (pas de ressource affichée derrière un mur).
      paused: paused || uiOpen,
      structuresOnly: building,
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
    threat,
    bus,
    blockedFor: busContext.blockedFor,
    setHost: (session) => {
      hostSession = session;
    },
    vehicleMachine,
    mountedMachineId: () => (mounted ? -mounted.id : null),
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
      } else {
        ignoreUnlockUntil = performance.now() + 600;
        wantLock = rig.view === 'first';
        requestLock();
      }
    },
    setUiOpen: (value) => {
      uiOpen = value;
      if (value) {
        releaseLock();
      } else if (!paused) {
        ignoreUnlockUntil = performance.now() + 600;
        wantLock = rig.view === 'first';
        requestLock();
      }
    },
    dispose: () => {
      enemyView.dispose();
      remotePlayers.dispose();
      healthBar.remove();
      hurtOverlay.remove();
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
      tutorialPanel.dispose();
      disposeTouch?.();
      gamepad.dispose();
      offDevice();
      craftHud.remove();
      closeFinale?.();
      window.removeEventListener('blur', onMouseUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('keydown', retryLock, true);
      window.removeEventListener('mousedown', retryLock, true);
      renderer.domElement.removeEventListener('click', requestLock);
      ghostUniforms.uGhostOn.value = 0;
      for (const mesh of chunks.values()) mesh.dispose();
      chunks.clear();
      renderer.dispose();
      corpseGeometry.dispose();
      corpseMaterial.dispose();
      renderer.domElement.remove();
      crosshair.remove();
      compass.remove();
      hint.remove();
      fpsBox.remove();
      debugBox.remove();
    },
  };
}
