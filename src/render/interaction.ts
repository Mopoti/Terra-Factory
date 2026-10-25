import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS } from '../core/constants';
import { REACH_M, itemById } from '../core/data/items';
import { resourceById, type DepositResource, type ObjectResource } from '../core/data/resources';
import { distanceToFootprint, isWithinReach } from '../core/game/reach';
import {
  CREATIVE_DEMOLISH_FACTOR,
  CREATIVE_DESTROY_SECONDS,
  type GameState,
} from '../core/game/state';
import { cellKey, type DroppedStack } from '../core/game/worldChanges';
import type { ChunkData } from '../core/world/worldgen';
import { playSfx } from '../audio/sfx';
import { t, type TranslationKey } from '../i18n';
import { MeshBuilder } from './meshBuilder';
import { loadModels, type BakedModel } from './models';
import { dropGeometry } from './dropModels';
import { LOG, LOG_PAIR, loadNature, lowModel } from './nature';

/** Temps pour ramasser une pile posée au sol (s). */
const PICKUP_SECONDS = 0.35;
/** Durée de la récolte à mains nues, par rapport à la durée de base (qui suppose un outil de vitesse 3). */
const BARE_HANDS_FACTOR = 3;
const FEED_SECONDS = 2.2;
const ORE_HEIGHT_M = 0.1;
const logMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
/** Objets posés au sol en modèle (couleurs de sommet). */
const dropModelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
/** Géométrie d'une bûche du pack, ramenée à `length` mètres de long. */
function logGeometry(model: BakedModel, length: number): THREE.BufferGeometry {
  const b = new MeshBuilder();
  b.model(model, 0, 0, 0, 0, length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  return g;
}

/** Hauteur des arbres (petit, moyen, grand), m. */
const TREE_HEIGHTS_M = [3.9, 5.5, 7.2];
/** Hauteur des rochers (petit, moyen, grand), m. */
const ROCK_HEIGHTS_M = [0.45, 0.8, 1.3];
const BUSH_HEIGHT_M = 0.6;
const DROP_PICK_RADIUS_M = 0.5;
/** Mode Créatif : portée pour récolter ou détruire une ressource (m). */
const CREATIVE_REACH_M = 24;
/** Portée pour frapper une construction (m). */
const STRUCTURE_REACH_M = 4;

/** Une ressource que le joueur peut récolter à la main. */
export interface Target {
  kind: 'object' | 'ore' | 'water';
  resId: string;
  key: string;
  gx: number;
  gz: number;
  /** Côté de l'emprise, en cases. */
  cells: number;
  /** Contenu d'origine. */
  total: number;
  /** Ce qu'il reste. */
  left: number;
  height: number;
  item: string;
  secondsPerUnit: number;
  /** Mode Créatif : ne se récolte pas, se détruit seulement (eau, pétrole). */
  destroyOnly?: boolean;
}

/** Une construction ou une machine que l'on peut frapper pour la démolir et récupérer ses ressources. */
export interface Structure {
  id: string;
  name: string;
  /** Temps pour la démolir en la frappant (s). */
  seconds: number;
  /** Distance le long du rayon (m). */
  distance: number;
  /** Peut s'ouvrir d'un clic gauche (machine, coffre). */
  usable?: boolean;
  /** Se démolit à la hache (construction en bois) plutôt qu'à la pioche. */
  axe?: boolean;
  /** Boîte englobante (m), pour la mise en évidence et la portée. */
  box: { x: number; y: number; z: number; sx: number; sy: number; sz: number };
}

type Hit =
  | { type: 'target'; target: Target; distance: number }
  | { type: 'drop'; stack: DroppedStack; distance: number }
  | { type: 'structure'; structure: Structure; distance: number };

export interface InteractionOptions {
  /** Un chunk doit être redessiné (ressource entamée ou épuisée). */
  rebuildChunk(cx: number, cz: number): void;
  /** Première construction ou machine touchée par le rayon : on ne vise rien derrière. */
  pickStructure?(origin: THREE.Vector3, dir: THREE.Vector3): Structure | null;
  /** La construction a été démolie (le joueur l'a frappée assez longtemps). */
  demolish?(id: string): void;
  /** Clic gauche sur une machine ou un coffre : ouvrir son interface. */
  openStructure?(id: string): void;
}

export interface InteractionFrame {
  dt: number;
  player: { x: number; z: number };
  /** Vrai si la touche « Interagir / récolter » (clic gauche) est maintenue. */
  active: boolean;
  /** Vrai si la touche « Activer » (E) est maintenue : portes, leviers (n'ouvre pas les fenêtres des machines). */
  activate?: boolean;
  /** Vrai si le clic droit est maintenu sans bouger : démolir ce qui est visé. */
  demolishing: boolean;
  paused: boolean;
  /** Construction en cours : on ne vise que les constructions et machines (pour les démolir), pas les ressources. */
  structuresOnly?: boolean;
  /** 1ère personne : on vise au centre de l'écran ; sinon sous le curseur. */
  aimAtCenter: boolean;
  mouse: { x: number; y: number };
  viewport: { w: number; h: number };
}

const itemName = (id: string): string => t(`item.${id}` as TranslationKey);

/** Viser, mettre en évidence, récolter et ramasser. */
export class Interaction {
  private readonly targets = new Map<string, Target>();
  private readonly byChunk = new Map<string, string[]>();
  private readonly dropGroup = new THREE.Group();
  private readonly dropMaterials = new Map<string, THREE.MeshStandardMaterial>();
  /** Boîte blanche autour de la cible : seulement en mode débogage. */
  showBoxes = false;
  private readonly highlight: THREE.LineSegments;
  private readonly raycaster = new THREE.Raycaster();
  private readonly hud: HTMLElement;
  private readonly hudName: HTMLElement;
  private readonly hudDetail: HTMLElement;
  private readonly hudBar: HTMLElement;
  private readonly hudFill: HTMLElement;
  private readonly feed: HTMLElement;
  private feedTotals = new Map<string, number>();
  private feedTimer = 0;
  private wasActive = false;
  private wasActivate = false;
  private holdingId: string | null = null;
  /** En train de récolter une ressource : avec l'outil, à mains nues, ou rien. */
  working: 'tool' | 'hands' | null = null;
  /** Quelque chose de récoltable, de ramassable ou de démolissable est à portée sous la visée. */
  aimed = false;
  /** Ce que vise le joueur demande la hache (true), la pioche (false), ou rien de particulier (null). */
  aimedAxe: boolean | null = null;
  private holdingTime = 0;
  private unsubscribe: () => void;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly state: GameState,
    container: HTMLElement,
    private readonly options: InteractionOptions,
  ) {
    scene.add(this.dropGroup);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }),
    );
    this.highlight.renderOrder = 10;
    this.highlight.visible = false;
    scene.add(this.highlight);

    this.hud = document.createElement('div');
    this.hud.className = 'interact-hud';
    this.hudName = document.createElement('div');
    this.hudName.className = 'interact-name';
    this.hudDetail = document.createElement('div');
    this.hudDetail.className = 'interact-detail';
    this.hudBar = document.createElement('div');
    this.hudBar.className = 'interact-bar';
    this.hudFill = document.createElement('div');
    this.hudBar.append(this.hudFill);
    this.hud.append(this.hudName, this.hudDetail, this.hudBar);
    this.hud.hidden = true;
    this.feed = document.createElement('div');
    this.feed.className = 'pickup-feed';
    container.append(this.hud, this.feed);

    this.refreshDrops();
    // Les bûches du pack arrivent après le chargement : on redessine alors le bois déjà posé au sol.
    void loadNature().then(() => this.refreshDrops());
    void loadModels().then(() => this.refreshDrops());
    this.unsubscribe = state.onChange((e) => {
      if (e.type === 'drops') this.refreshDrops();
    });
  }

  // --- Ressources du monde -------------------------------------------------------------------

  /** Enregistre les ressources récoltables d'un chunk (déjà modifié par les actions du joueur). */
  registerChunk(chunkKey: string, data: ChunkData): void {
    this.unregisterChunk(chunkKey);
    const keys: string[] = [];
    const add = (target: Target): void => {
      for (let dx = 0; dx < target.cells; dx++) {
        for (let dz = 0; dz < target.cells; dz++) {
          const k = cellKey(target.gx + dx, target.gz + dz);
          this.targets.set(k, target);
          keys.push(k);
        }
      }
    };
    for (const o of data.objects) {
      if (o.id === 'nest') continue;
      const res = resourceById(o.id) as ObjectResource;
      add({
        kind: 'object',
        resId: o.id,
        key: cellKey(o.gx, o.gz),
        gx: o.gx,
        gz: o.gz,
        cells: o.cells,
        total: o.amount + (this.state.changes.taken[cellKey(o.gx, o.gz)] ?? 0),
        left: o.amount,
        height:
          o.id === 'tree'
            ? TREE_HEIGHTS_M[o.size ?? 1]
            : o.id === 'fiber_bush'
              ? BUSH_HEIGHT_M
              : ROCK_HEIGHTS_M[o.size ?? 1],
        item: res.harvest.item,
        secondsPerUnit: res.harvest.secondsPerUnit,
      });
    }
    for (const o of data.ore) {
      const res = resourceById(o.id) as DepositResource;
      // Le pétrole ne se récolte pas à la main ; en Créatif, on peut le détruire.
      if (res.liquid && !this.state.creative) continue;
      const key = cellKey(o.gx, o.gz);
      add({
        kind: 'ore',
        resId: o.id,
        key,
        gx: o.gx,
        gz: o.gz,
        cells: 1,
        total: o.amount + (this.state.changes.taken[key] ?? 0),
        left: o.amount,
        height: ORE_HEIGHT_M,
        item: res.harvest.item,
        secondsPerUnit: res.harvest.secondsPerUnit,
        ...(res.liquid ? { destroyOnly: true } : {}),
      });
    }
    // Mode Créatif : les cases d'eau se visent pour être détruites.
    if (this.state.creative) {
      for (const w of data.water) {
        add({
          kind: 'water',
          resId: 'water',
          key: cellKey(w.gx, w.gz),
          gx: w.gx,
          gz: w.gz,
          cells: 1,
          total: 0,
          left: 0,
          height: 0.06,
          item: '',
          secondsPerUnit: 1,
          destroyOnly: true,
        });
      }
    }
    this.byChunk.set(chunkKey, keys);
  }

  /** Ressource (arbre, rocher, buisson, case de minerai ou d'eau) qui occupe cette case, ou null. */
  targetAt(gx: number, gz: number): Target | null {
    return this.targets.get(cellKey(gx, gz)) ?? null;
  }

  unregisterChunk(chunkKey: string): void {
    for (const k of this.byChunk.get(chunkKey) ?? []) this.targets.delete(k);
    this.byChunk.delete(chunkKey);
  }

  // --- Objets au sol -------------------------------------------------------------------------

  private dropMaterial(item: string): THREE.MeshStandardMaterial {
    let m = this.dropMaterials.get(item);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: itemById(item).color });
      this.dropMaterials.set(item, m);
    }
    return m;
  }

  private refreshDrops(): void {
    for (const child of [...this.dropGroup.children]) {
      this.dropGroup.remove(child);
      (child as THREE.Mesh).geometry.dispose();
    }
    for (const d of this.state.changes.drops) {
      // Forme de l'objet (lingots, baril, paquet de science…) ou machine en miniature, dès que les modèles sont chargés.
      const own = dropGeometry(d.item, d.count);
      if (own) {
        const mesh = new THREE.Mesh(own, dropModelMaterial);
        mesh.position.set(d.x, 0, d.z);
        mesh.rotation.y = (Number(d.id.replace(/\D/g, '')) * 0.9) % Math.PI;
        mesh.castShadow = true;
        this.dropGroup.add(mesh);
        continue;
      }
      const h = 0.1 + Math.min(0.25, d.count * 0.01);
      // Le bois se pose sous forme de bûche (une seule, ou une paire à partir de trois) ; le reste, en petit bloc.
      const log = d.item === 'wood' ? lowModel(d.count >= 3 ? LOG_PAIR : LOG) : null;
      // Dépouilles : une carapace en demi-coque bombée, du tissu vivant en grosse goutte.
      const shell = d.item === 'carapace' || d.item === 'living_tissue';
      const mesh = log
        ? new THREE.Mesh(logGeometry(log, d.count >= 3 ? 0.7 : 0.9), logMaterial)
        : shell
          ? new THREE.Mesh(
              new THREE.SphereGeometry(
                d.item === 'carapace' ? 0.26 : 0.2,
                10,
                6,
                0,
                Math.PI * 2,
                0,
                d.item === 'carapace' ? Math.PI / 2 : Math.PI,
              ).scale(1, d.item === 'carapace' ? 0.6 : 0.7, 1.25),
              this.dropMaterial(d.item),
            )
          : new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), this.dropMaterial(d.item));
      mesh.position.set(d.x, log ? 0 : shell ? (d.item === 'carapace' ? 0 : 0.14) : h / 2, d.z);
      mesh.rotation.y = (Number(d.id.replace(/\D/g, '')) * 0.9) % Math.PI;
      mesh.castShadow = true;
      this.dropGroup.add(mesh);
    }
  }

  /** Jette des objets du sac au sol. */
  dropItem(item: string, count: number, x: number, z: number): void {
    const stack = this.state.drop(item, count, x, z);
    if (stack) {
      this.addFeed(item, -stack.count);
      playSfx('drop');
    }
  }

  // --- Viser -----------------------------------------------------------------------------------

  private pick(frame: InteractionFrame): Hit | null {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (frame.aimAtCenter) {
      this.camera.getWorldPosition(origin);
      this.camera.getWorldDirection(dir);
    } else {
      const ndc = new THREE.Vector2(
        (frame.mouse.x / frame.viewport.w) * 2 - 1,
        -(frame.mouse.y / frame.viewport.h) * 2 + 1,
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      origin.copy(this.raycaster.ray.origin);
      dir.copy(this.raycaster.ray.direction);
    }

    const structure = this.options.pickStructure?.(origin, dir) ?? null;
    const limit = structure?.distance ?? Infinity;
    let best: Hit | null = null;
    // Ressources : on suit le rayon pas à pas (plus finement près du sol).
    let travelled = frame.structuresOnly ? Infinity : 0.2;
    const p = new THREE.Vector3();
    while (travelled < Math.min(80, limit)) {
      p.copy(origin).addScaledVector(dir, travelled);
      if (p.y <= 0) {
        // Point d'entrée au sol : vérifier la case touchée.
        const back = dir.y !== 0 ? origin.y / -dir.y : travelled;
        p.copy(origin).addScaledVector(dir, back);
        const t0 = this.targets.get(
          cellKey(Math.floor(p.x / CELL_SIZE_M), Math.floor(p.z / CELL_SIZE_M)),
        );
        if (t0 && back < limit) best = { type: 'target', target: t0, distance: back };
        break;
      }
      const target = this.targets.get(
        cellKey(Math.floor(p.x / CELL_SIZE_M), Math.floor(p.z / CELL_SIZE_M)),
      );
      if (target && p.y <= target.height) {
        best = { type: 'target', target, distance: travelled };
        break;
      }
      travelled += p.y < 1 ? 0.03 : 0.12;
    }
    // Objets au sol : distance au rayon.
    const w = new THREE.Vector3();
    for (const d of frame.structuresOnly ? [] : this.state.changes.drops) {
      w.set(d.x, 0.12, d.z).sub(origin);
      const along = w.dot(dir);
      if (along < 0 || along > limit) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      if (closest.distanceTo(new THREE.Vector3(d.x, 0.12, d.z)) < DROP_PICK_RADIUS_M) {
        if (!best || along < best.distance) best = { type: 'drop', stack: d, distance: along };
      }
    }
    if (!best && structure) best = { type: 'structure', structure, distance: structure.distance };
    return best;
  }

  private reach(hit: Hit, player: { x: number; z: number }): number {
    if (hit.type === 'drop') return Math.hypot(hit.stack.x - player.x, hit.stack.z - player.z);
    if (hit.type === 'structure') {
      const b = hit.structure.box;
      return Math.max(0, Math.hypot(b.x - player.x, b.z - player.z) - Math.max(b.sx, b.sz) / 2);
    }
    return distanceToFootprint(player, hit.target.gx, hit.target.gz, hit.target.cells);
  }

  private showHighlight(hit: Hit | null, inReach: boolean): void {
    if (!hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    (this.highlight.material as THREE.LineBasicMaterial).color.set(inReach ? 0xffffff : 0xff6a55);
    if (hit.type === 'structure') {
      const b = hit.structure.box;
      this.highlight.scale.set(b.sx + 0.06, b.sy + 0.06, b.sz + 0.06);
      this.highlight.position.set(b.x, b.y, b.z);
    } else if (hit.type === 'drop') {
      this.highlight.scale.set(0.5, 0.4, 0.5);
      this.highlight.position.set(hit.stack.x, 0.2, hit.stack.z);
    } else {
      const t0 = hit.target;
      const size = t0.cells * CELL_SIZE_M;
      const h = Math.max(t0.height, 0.12);
      this.highlight.scale.set(size + 0.06, h + 0.04, size + 0.06);
      this.highlight.position.set(
        t0.gx * CELL_SIZE_M + size / 2,
        h / 2,
        t0.gz * CELL_SIZE_M + size / 2,
      );
    }
  }

  // --- Récolter / ramasser ---------------------------------------------------------------------

  update(frame: InteractionFrame): void {
    const leftPressed = frame.active && !this.wasActive;
    this.wasActive = frame.active;
    const activatePressed = !!frame.activate && !this.wasActivate;
    this.wasActivate = !!frame.activate;
    if (this.feedTimer > 0) {
      this.feedTimer -= frame.dt;
      if (this.feedTimer <= 0) {
        this.feedTotals.clear();
        this.renderFeed();
      }
    }
    this.working = null;
    this.aimed = false;
    this.aimedAxe = null;
    if (frame.paused) {
      this.hud.hidden = true;
      this.highlight.visible = false;
      this.holdingId = null;
      return;
    }

    const hit = this.pick(frame);
    const reachable =
      hit !== null &&
      isWithinReach(
        this.reach(hit, frame.player),
        hit.type === 'structure'
          ? STRUCTURE_REACH_M
          : this.state.creative
            ? CREATIVE_REACH_M
            : REACH_M,
      );
    this.aimed = reachable;
    // L'outil se retourne selon ce qu'on a devant, à portée ou non : hache pour un arbre ou du bois, pioche sinon.
    this.aimedAxe =
      hit === null
        ? null
        : hit.type === 'target'
          ? hit.target.resId === 'tree'
          : hit.type === 'structure'
            ? hit.structure.axe === true
            : null;
    this.showHighlight(hit, reachable);
    // En première personne le réticule suffit : pas de boîte blanche autour de la cible.
    if (frame.aimAtCenter || !this.showBoxes) this.highlight.visible = false;

    if (!hit) {
      this.holdingId = null;
      this.hud.hidden = true;
      return;
    }

    const id =
      hit.type === 'drop'
        ? hit.stack.id
        : hit.type === 'structure'
          ? hit.structure.id
          : hit.target.key;
    const item =
      hit.type === 'drop'
        ? hit.stack.item
        : hit.type === 'structure' || hit.target.destroyOnly
          ? ''
          : hit.target.item;
    // Mode Créatif : clic droit maintenu sur une ressource (arbre, rocher, minerai, eau) pour la détruire en 1 s.
    const destroying = hit.type === 'target' && this.state.creative && frame.demolishing;
    // À mains nues, abattre, casser ou miner est long ; l'outil de la case d'outils va plus vite (et le fer donne plus).
    const needsTool = hit.type === 'target' && hit.target.resId !== 'fiber_bush';
    const tool = needsTool ? this.state.harvestTool() : null;
    const seconds = destroying
      ? CREATIVE_DESTROY_SECONDS
      : hit.type === 'drop'
        ? PICKUP_SECONDS
        : hit.type === 'structure'
          ? hit.structure.seconds * (this.state.creative ? CREATIVE_DEMOLISH_FACTOR : 1)
          : needsTool
            ? (hit.target.secondsPerUnit * BARE_HANDS_FACTOR) / (tool?.speed ?? 1)
            : hit.target.secondsPerUnit;
    let bagFull = false;

    // Clic gauche sur une machine ou un coffre : on ouvre son interface.
    if (
      reachable &&
      (leftPressed ||
        (activatePressed && hit.type === 'structure' && hit.structure.id.startsWith('piece:'))) &&
      hit.type === 'structure' &&
      hit.structure.usable
    ) {
      this.options.openStructure?.(hit.structure.id);
      return;
    }
    // Les constructions se démolissent au clic droit maintenu ; le reste se récolte au clic gauche.
    const holdingNow =
      hit.type === 'structure'
        ? frame.demolishing
        : destroying || (frame.active && !(hit.type === 'target' && hit.target.destroyOnly));
    if (reachable && holdingNow) {
      this.working = hit.type === 'target' ? (tool ? 'tool' : 'hands') : null;
      if (this.holdingId !== (destroying ? `x:${id}` : id)) {
        this.holdingId = destroying ? `x:${id}` : id;
        this.holdingTime = 0;
      }
      this.holdingTime += frame.dt;
      if (destroying && hit.type === 'target') {
        if (this.holdingTime >= seconds) {
          this.holdingTime = 0;
          this.holdingId = null;
          const t0 = hit.target;
          if (this.state.destroyResource(t0.kind, t0.gx, t0.gz, t0.total)) {
            playSfx(
              t0.resId === 'tree' ? 'treeFall' : t0.kind === 'ore' ? 'oreBreak' : 'rockBreak',
            );
            this.options.rebuildChunk(
              Math.floor(t0.gx / CHUNK_CELLS),
              Math.floor(t0.gz / CHUNK_CELLS),
            );
          }
        }
      }
      while (!destroying && hit.type === 'structure' && this.holdingTime >= seconds) {
        // Frappée assez longtemps : la construction est démolie et ses ressources reviennent.
        this.holdingTime = 0;
        this.holdingId = null;
        this.options.demolish?.(hit.structure.id);
        break;
      }
      while (!destroying && hit.type !== 'structure' && this.holdingTime >= seconds) {
        this.holdingTime -= seconds;
        const result =
          hit.type === 'drop'
            ? this.state.pickUp(hit.stack.id)
            : this.state.harvest(
                hit.target.key,
                hit.target.total,
                hit.target.item,
                tool?.yield ?? 1,
              );
        if (result.gained > 0) {
          this.addFeed(item, result.gained);
          if (hit.type === 'drop') playSfx('pickup');
          else {
            const done = result.left === 0;
            const res = hit.target.resId;
            if (res === 'tree') playSfx(done ? 'treeFall' : 'woodChop');
            else if (res === 'fiber_bush') playSfx('pickup');
            else if (hit.target.kind === 'ore') playSfx(done ? 'oreBreak' : 'oreHit');
            else playSfx(done ? 'rockBreak' : 'stoneHit');
          }
          if (hit.type === 'target') {
            this.options.rebuildChunk(
              Math.floor(hit.target.gx / CHUNK_CELLS),
              Math.floor(hit.target.gz / CHUNK_CELLS),
            );
          }
        }
        if (result.gained === 0 || result.left === 0) {
          bagFull = result.bagFull;
          this.holdingTime = 0;
          break;
        }
        if (result.bagFull) {
          bagFull = true;
          this.holdingTime = 0;
          break;
        }
      }
    } else {
      this.holdingId = null;
      this.holdingTime = 0;
    }

    // Affichage.
    const name =
      hit.type === 'drop'
        ? `${itemName(hit.stack.item)} ×${hit.stack.count}`
        : hit.type === 'structure'
          ? hit.structure.name
          : t(`target.${hit.target.resId}` as TranslationKey);
    if (item && !bagFull && !this.state.hasRoomFor(item)) bagFull = true;
    // Ressource récoltable : « [icône] Pierre : 309 » sur une seule ligne (l'état n'apparaît que s'il y a un souci).
    const compact = hit.type === 'target' && reachable && !bagFull && !hit.target.destroyOnly;
    if (compact && hit.type === 'target') {
      const swatch = document.createElement('i');
      swatch.className = 'interact-icon';
      swatch.style.background = itemById(item).color;
      this.hudName.replaceChildren(swatch, `${itemName(item)} : ${hit.target.left}`);
    } else this.hudName.textContent = name;
    let status: string;
    if (!reachable) status = t('harvest.tooFar');
    else if (bagFull) status = t('harvest.bagFull');
    else if (hit.type === 'drop') status = t('harvest.pickup');
    else if (hit.type === 'structure') {
      status = t(
        hit.structure.usable
          ? hit.structure.id.startsWith('piece:')
            ? 'harvest.doorUse'
            : 'harvest.structureUse'
          : 'harvest.demolish',
      );
    } else if (destroying || hit.target.destroyOnly) status = t('creative.destroy');
    else status = t('harvest.left', { n: String(hit.target.left), item: itemName(item) });
    this.hudDetail.textContent = compact ? '' : status;
    this.hudDetail.hidden = compact;
    this.hudDetail.classList.toggle('warn', !reachable || bagFull);
    const holding = reachable && holdingNow && this.holdingId === (destroying ? `x:${id}` : id);
    this.hudBar.hidden = !holding;
    this.hudFill.style.width = `${Math.min(100, (this.holdingTime / seconds) * 100)}%`;
    this.hud.hidden = false;
    if (frame.aimAtCenter) {
      this.hud.style.left = '50%';
      this.hud.style.top = `${frame.viewport.h / 2 + 34}px`;
      this.hud.style.transform = 'translateX(-50%)';
    } else {
      this.hud.style.left = `${Math.min(frame.mouse.x + 18, frame.viewport.w - 230)}px`;
      this.hud.style.top = `${Math.min(frame.mouse.y + 18, frame.viewport.h - 90)}px`;
      this.hud.style.transform = 'none';
    }
  }

  // --- Messages « +4 Bois » ----------------------------------------------------------------------

  private addFeed(item: string, n: number): void {
    this.feedTotals.set(item, (this.feedTotals.get(item) ?? 0) + n);
    this.feedTimer = FEED_SECONDS;
    this.renderFeed();
  }

  private renderFeed(): void {
    this.feed.replaceChildren(
      ...[...this.feedTotals]
        .filter(([, n]) => n !== 0)
        .map(([item, n]) => {
          const line = document.createElement('div');
          line.textContent = `${n > 0 ? '+' : '−'}${Math.abs(n)} ${itemName(item)}`;
          line.className = n > 0 ? 'gain' : 'loss';
          return line;
        }),
    );
  }

  dispose(): void {
    this.unsubscribe();
    this.scene.remove(this.dropGroup, this.highlight);
    for (const child of this.dropGroup.children) (child as THREE.Mesh).geometry.dispose();
    for (const m of this.dropMaterials.values()) m.dispose();
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();
    this.hud.remove();
    this.feed.remove();
  }
}
