import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_CELLS } from '../core/constants';
import { REACH_M, itemById } from '../core/data/items';
import { resourceById, type DepositResource, type ObjectResource } from '../core/data/resources';
import { distanceToFootprint, isWithinReach } from '../core/game/reach';
import type { GameState } from '../core/game/state';
import { cellKey, type DroppedStack } from '../core/game/worldChanges';
import type { ChunkData } from '../core/world/worldgen';
import { playSfx } from '../audio/sfx';
import { t, type TranslationKey } from '../i18n';
import { MeshBuilder } from './meshBuilder';
import type { BakedModel } from './models';
import { LOG, LOG_PAIR, loadNature, lowModel } from './nature';

/** Temps pour ramasser une pile posée au sol (s). */
const PICKUP_SECONDS = 0.35;
/** Durée de la récolte à mains nues, par rapport à la durée de base (qui suppose un outil de vitesse 3). */
const BARE_HANDS_FACTOR = 3;
const FEED_SECONDS = 2.2;
const ORE_HEIGHT_M = 0.1;
const logMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
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
/** Portée pour frapper une construction (m). */
const STRUCTURE_REACH_M = 4;

/** Une ressource que le joueur peut récolter à la main. */
export interface Target {
  kind: 'object' | 'ore';
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
  private holdingId: string | null = null;
  /** En train de récolter une ressource : avec l'outil, à mains nues, ou rien. */
  working: 'tool' | 'hands' | null = null;
  /** Quelque chose de récoltable, de ramassable ou de démolissable est à portée sous la visée. */
  aimed = false;
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
      if (res.liquid) continue;
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
      });
    }
    this.byChunk.set(chunkKey, keys);
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
      const h = 0.1 + Math.min(0.25, d.count * 0.01);
      // Le bois se pose sous forme de bûche (une seule, ou une paire à partir de trois) ; le reste, en petit bloc.
      const log = d.item === 'wood' ? lowModel(d.count >= 3 ? LOG_PAIR : LOG) : null;
      const mesh = log
        ? new THREE.Mesh(logGeometry(log, d.count >= 3 ? 0.7 : 0.9), logMaterial)
        : new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), this.dropMaterial(d.item));
      mesh.position.set(d.x, log ? 0 : h / 2, d.z);
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
    if (this.feedTimer > 0) {
      this.feedTimer -= frame.dt;
      if (this.feedTimer <= 0) {
        this.feedTotals.clear();
        this.renderFeed();
      }
    }
    this.working = null;
    this.aimed = false;
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
        hit.type === 'structure' ? STRUCTURE_REACH_M : REACH_M,
      );
    this.aimed = reachable;
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
      hit.type === 'drop' ? hit.stack.item : hit.type === 'structure' ? '' : hit.target.item;
    // À mains nues, abattre, casser ou miner est long ; l'outil de la case d'outils va plus vite (et le fer donne plus).
    const needsTool = hit.type === 'target' && hit.target.resId !== 'fiber_bush';
    const tool = needsTool ? this.state.harvestTool() : null;
    const seconds =
      hit.type === 'drop'
        ? PICKUP_SECONDS
        : hit.type === 'structure'
          ? hit.structure.seconds
          : needsTool
            ? (hit.target.secondsPerUnit * BARE_HANDS_FACTOR) / (tool?.speed ?? 1)
            : hit.target.secondsPerUnit;
    let bagFull = false;

    // Clic gauche sur une machine ou un coffre : on ouvre son interface.
    if (reachable && leftPressed && hit.type === 'structure' && hit.structure.usable) {
      this.options.openStructure?.(hit.structure.id);
      return;
    }
    // Les constructions se démolissent au clic droit maintenu ; le reste se récolte au clic gauche.
    const holdingNow = hit.type === 'structure' ? frame.demolishing : frame.active;
    if (reachable && holdingNow) {
      this.working = hit.type === 'target' ? (tool ? 'tool' : 'hands') : null;
      if (this.holdingId !== id) {
        this.holdingId = id;
        this.holdingTime = 0;
      }
      this.holdingTime += frame.dt;
      while (hit.type === 'structure' && this.holdingTime >= seconds) {
        // Frappée assez longtemps : la construction est démolie et ses ressources reviennent.
        this.holdingTime = 0;
        this.holdingId = null;
        this.options.demolish?.(hit.structure.id);
        break;
      }
      while (hit.type !== 'structure' && this.holdingTime >= seconds) {
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
    this.hudName.textContent = name;
    if (item && !bagFull && !this.state.hasRoomFor(item)) bagFull = true;
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
    } else status = t('harvest.left', { n: String(hit.target.left), item: itemName(item) });
    this.hudDetail.textContent = status;
    this.hudDetail.classList.toggle('warn', !reachable || bagFull);
    const holding = reachable && holdingNow && this.holdingId === id;
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
