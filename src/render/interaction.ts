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

/** Temps pour ramasser une pile posée au sol (s). */
const PICKUP_SECONDS = 0.35;
const FEED_SECONDS = 2.2;
const ORE_HEIGHT_M = 0.1;
const TREE_HEIGHT_M = 2.6;
const ROCK_HEIGHT_M = 0.8;
const DROP_PICK_RADIUS_M = 0.5;

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

type Hit =
  | { type: 'target'; target: Target; distance: number }
  | { type: 'drop'; stack: DroppedStack; distance: number };

export interface InteractionOptions {
  /** Un chunk doit être redessiné (ressource entamée ou épuisée). */
  rebuildChunk(cx: number, cz: number): void;
  /** Distance jusqu'au premier mur / dalle sur le rayon : on ne vise rien derrière. */
  occlusion?(origin: THREE.Vector3, dir: THREE.Vector3): number;
}

export interface InteractionFrame {
  dt: number;
  player: { x: number; z: number };
  /** Vrai si la touche « Interagir / récolter » est maintenue. */
  active: boolean;
  paused: boolean;
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
  private holdingId: string | null = null;
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
        total: res.amount,
        left: o.amount,
        height: o.id === 'tree' ? TREE_HEIGHT_M : ROCK_HEIGHT_M,
        item: res.harvest.item,
        secondsPerUnit: res.harvest.secondsPerUnit,
      });
    }
    for (const o of data.ore) {
      const res = resourceById(o.id) as DepositResource;
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
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), this.dropMaterial(d.item));
      mesh.position.set(d.x, h / 2, d.z);
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

    const limit = this.options.occlusion?.(origin, dir) ?? Infinity;
    let best: Hit | null = null;
    // Ressources : on suit le rayon pas à pas (plus finement près du sol).
    let travelled = 0.2;
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
    for (const d of this.state.changes.drops) {
      w.set(d.x, 0.12, d.z).sub(origin);
      const along = w.dot(dir);
      if (along < 0 || along > limit) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      if (closest.distanceTo(new THREE.Vector3(d.x, 0.12, d.z)) < DROP_PICK_RADIUS_M) {
        if (!best || along < best.distance) best = { type: 'drop', stack: d, distance: along };
      }
    }
    return best;
  }

  private reach(hit: Hit, player: { x: number; z: number }): number {
    if (hit.type === 'drop') return Math.hypot(hit.stack.x - player.x, hit.stack.z - player.z);
    return distanceToFootprint(player, hit.target.gx, hit.target.gz, hit.target.cells);
  }

  private showHighlight(hit: Hit | null, inReach: boolean): void {
    if (!hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    (this.highlight.material as THREE.LineBasicMaterial).color.set(inReach ? 0xffffff : 0xff6a55);
    if (hit.type === 'drop') {
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
    if (this.feedTimer > 0) {
      this.feedTimer -= frame.dt;
      if (this.feedTimer <= 0) {
        this.feedTotals.clear();
        this.renderFeed();
      }
    }
    if (frame.paused) {
      this.hud.hidden = true;
      this.highlight.visible = false;
      this.holdingId = null;
      return;
    }

    const hit = this.pick(frame);
    const reachable = hit !== null && isWithinReach(this.reach(hit, frame.player), REACH_M);
    this.showHighlight(hit, reachable);

    if (!hit) {
      this.holdingId = null;
      this.hud.hidden = true;
      return;
    }

    const id = hit.type === 'drop' ? hit.stack.id : hit.target.key;
    const item = hit.type === 'drop' ? hit.stack.item : hit.target.item;
    const seconds = hit.type === 'drop' ? PICKUP_SECONDS : hit.target.secondsPerUnit;
    let bagFull = false;

    if (reachable && frame.active) {
      if (this.holdingId !== id) {
        this.holdingId = id;
        this.holdingTime = 0;
      }
      this.holdingTime += frame.dt;
      while (this.holdingTime >= seconds) {
        this.holdingTime -= seconds;
        const result =
          hit.type === 'drop'
            ? this.state.pickUp(hit.stack.id)
            : this.state.harvest(hit.target.key, hit.target.total, hit.target.item, 1);
        if (result.gained > 0) {
          this.addFeed(item, result.gained);
          if (hit.type === 'drop') playSfx('pickup');
          else {
            const done = result.left === 0;
            const res = hit.target.resId;
            if (res === 'tree') playSfx(done ? 'treeFall' : 'woodChop');
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
        : t(`target.${hit.target.resId}` as TranslationKey);
    this.hudName.textContent = name;
    if (!bagFull && !this.state.hasRoomFor(item)) bagFull = true;
    let status: string;
    if (!reachable) status = t('harvest.tooFar');
    else if (bagFull) status = t('harvest.bagFull');
    else if (hit.type === 'drop') status = t('harvest.pickup');
    else status = t('harvest.left', { n: String(hit.target.left), item: itemName(item) });
    this.hudDetail.textContent = status;
    this.hudDetail.classList.toggle('warn', !reachable || bagFull);
    const holding = reachable && frame.active && this.holdingId === id;
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
