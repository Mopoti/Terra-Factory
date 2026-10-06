import { CELL_SIZE_M, CHUNK_CELLS } from '../core/constants';
import { machineDef } from '../core/data/machines';
import { resourceById } from '../core/data/resources';
import type { Factory } from '../core/factory/factory';
import type { GameState } from '../core/game/state';
import { BIOME_COLORS } from '../core/world/biomes';
import { WorldGenerator, type WorldParams } from '../core/world/worldgen';
import { t, type TranslationKey } from '../i18n';
import './menu.css';

export interface MapWindow {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

export interface MapOptions {
  world: WorldParams;
  state: GameState;
  factory: Factory;
  /** Position et cap du joueur (x, z en mètres ; yaw comme la caméra). */
  player(): { x: number; z: number; yaw: number };
  onOpenChange(open: boolean): void;
}

/** Chunks dessinés autour du joueur : au-delà, c'est « inexploré » (comme la carte de Factorio). */
const EXPLORED_RADIUS_CHUNKS = 28;
/** Temps maximum passé à dessiner des chunks par image (ms). */
const BUDGET_MS = 8;
/** Pixels écran par case de 50 cm (puissances de 2 : pixels nets). */
const ZOOMS = [1, 2, 4, 8, 16];
const UNEXPLORED = '#0b0e12';

const OBJECT_COLORS: Record<string, string> = {
  tree: '#1f5d25',
  rock: '#9aa0a8',
  nest: '#b0306f',
};

const hex = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

/** Carte pixelisée : terrain, minerais, eau, arbres, rochers, nids, constructions et machines. */
export function mountMap(root: HTMLElement, options: MapOptions): MapWindow {
  const generator = new WorldGenerator(options.world);
  const chunkCache = new Map<string, HTMLCanvasElement>();
  let isOpenNow = false;
  let zoomIndex = 2;
  /** Centre de la vue (en cases). */
  let center = { gx: 0, gz: 0 };
  let raf = 0;
  let canvas: HTMLCanvasElement | null = null;
  let info: HTMLElement | null = null;
  let hoverCell: { gx: number; gz: number } | null = null;
  let drag: { x: number; y: number } | null = null;

  const key = (cx: number, cz: number): string => `${cx},${cz}`;

  /** Une case de chunk = un pixel. */
  function drawChunk(cx: number, cz: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = CHUNK_CELLS;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const img = ctx.createImageData(CHUNK_CELLS, CHUNK_CELLS);
    const put = (lx: number, lz: number, rgb: [number, number, number]): void => {
      if (lx < 0 || lz < 0 || lx >= CHUNK_CELLS || lz >= CHUNK_CELLS) return;
      const i = (lz * CHUNK_CELLS + lx) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    };
    const data = generator.chunk(cx, cz);
    // Fond : biome (un échantillon par bloc de 4 x 4 cases).
    const block = 4;
    for (let bz = 0; bz < CHUNK_CELLS; bz += block) {
      for (let bx = 0; bx < CHUNK_CELLS; bx += block) {
        const xM = (cx * CHUNK_CELLS + bx + block / 2) * CELL_SIZE_M;
        const zM = (cz * CHUNK_CELLS + bz + block / 2) * CELL_SIZE_M;
        const rgb = hex(BIOME_COLORS[generator.biomeAt(xM, zM)]);
        const dim: [number, number, number] = [rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55];
        for (let z = 0; z < block; z++) for (let x = 0; x < block; x++) put(bx + x, bz + z, dim);
      }
    }
    const baseX = cx * CHUNK_CELLS;
    const baseZ = cz * CHUNK_CELLS;
    for (const w of data.water) put(w.gx - baseX, w.gz - baseZ, hex('#2f6fb0'));
    for (const o of data.objects) {
      const rgb = hex(OBJECT_COLORS[o.id] ?? '#888888');
      for (let z = 0; z < o.cells; z++)
        for (let x = 0; x < o.cells; x++) put(o.gx - baseX + x, o.gz - baseZ + z, rgb);
    }
    for (const ore of data.ore) {
      if (ore.amount <= 0) continue;
      put(ore.gx - baseX, ore.gz - baseZ, hex(resourceById(ore.id).color));
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Dessine des chunks manquants autour du centre de la vue, les plus proches d'abord. */
  function fillCache(visible: { x0: number; x1: number; z0: number; z1: number }): void {
    const p = options.player();
    const pcx = Math.floor(p.x / CELL_SIZE_M / CHUNK_CELLS);
    const pcz = Math.floor(p.z / CELL_SIZE_M / CHUNK_CELLS);
    const missing: { cx: number; cz: number; d: number }[] = [];
    const ccx = center.gx / CHUNK_CELLS;
    const ccz = center.gz / CHUNK_CELLS;
    for (let cz = visible.z0; cz <= visible.z1; cz++) {
      for (let cx = visible.x0; cx <= visible.x1; cx++) {
        if (chunkCache.has(key(cx, cz))) continue;
        if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > EXPLORED_RADIUS_CHUNKS) continue;
        missing.push({ cx, cz, d: Math.hypot(cx - ccx, cz - ccz) });
      }
    }
    missing.sort((a, b) => a.d - b.d);
    const start = performance.now();
    for (const m of missing) {
      chunkCache.set(key(m.cx, m.cz), drawChunk(m.cx, m.cz));
      if (performance.now() - start > BUDGET_MS) break;
    }
  }

  function draw(): void {
    if (!isOpenNow || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const zoom = ZOOMS[zoomIndex];
    const w = canvas.width;
    const h = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = UNEXPLORED;
    ctx.fillRect(0, 0, w, h);
    // Cases visibles.
    const halfX = w / 2 / zoom;
    const halfZ = h / 2 / zoom;
    const gx0 = center.gx - halfX;
    const gz0 = center.gz - halfZ;
    const visible = {
      x0: Math.floor(gx0 / CHUNK_CELLS),
      x1: Math.floor((center.gx + halfX) / CHUNK_CELLS),
      z0: Math.floor(gz0 / CHUNK_CELLS),
      z1: Math.floor((center.gz + halfZ) / CHUNK_CELLS),
    };
    fillCache(visible);
    const sx = (gx: number): number => Math.round((gx - gx0) * zoom);
    const sz = (gz: number): number => Math.round((gz - gz0) * zoom);
    for (let cz = visible.z0; cz <= visible.z1; cz++) {
      for (let cx = visible.x0; cx <= visible.x1; cx++) {
        const c = chunkCache.get(key(cx, cz));
        if (!c) continue;
        const x = sx(cx * CHUNK_CELLS);
        const z = sz(cz * CHUNK_CELLS);
        ctx.drawImage(c, x, z, CHUNK_CELLS * zoom, CHUNK_CELLS * zoom);
      }
    }
    // Constructions : un pixel par case.
    const cell = Math.max(1, zoom);
    for (const [pk, kind] of Object.entries(options.state.changes.pieces)) {
      const m = /^[a-z]:-?\d+:(-?\d+),(-?\d+)/.exec(pk);
      if (!m) continue;
      ctx.fillStyle = kind.endsWith('stone') ? '#c9ced6' : '#c79a5d';
      ctx.fillRect(sx(Number(m[1])), sz(Number(m[2])), cell, cell);
    }
    for (const mc of options.factory.machines) {
      const def = machineDef(mc.type);
      const w2 = mc.rot % 2 === 0 ? def.w : def.d;
      const d2 = mc.rot % 2 === 0 ? def.d : def.w;
      ctx.fillStyle = mc.type === 'conveyor' ? '#e2e6ea' : def.color;
      ctx.fillRect(sx(mc.gx), sz(mc.gz), w2 * zoom, d2 * zoom);
      if (mc.type !== 'conveyor' && zoom >= 4) {
        ctx.strokeStyle = '#ffd36b';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx(mc.gx) + 0.5, sz(mc.gz) + 0.5, w2 * zoom - 1, d2 * zoom - 1);
      }
    }
    // Joueur : flèche blanche dans le sens du regard.
    const p = options.player();
    const px = (p.x / CELL_SIZE_M - gx0) * zoom;
    const pz = (p.z / CELL_SIZE_M - gz0) * zoom;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const r = 7;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + fx * r * 1.4, pz + fz * r * 1.4);
    ctx.lineTo(px - fx * r + -fz * r * 0.8, pz - fz * r + fx * r * 0.8);
    ctx.lineTo(px - fx * r - -fz * r * 0.8, pz - fz * r - fx * r * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    // Nord.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('N ↑', w - 44, 22);
    if (info) {
      const cellText = hoverCell
        ? `${t('map.coords')} : ${Math.round(hoverCell.gx * CELL_SIZE_M)} m, ${Math.round(hoverCell.gz * CELL_SIZE_M)} m`
        : '';
      info.textContent = `${cellText}   ${t('map.zoom', { n: String(zoom) })}`;
    }
    raf = requestAnimationFrame(draw);
  }

  function legendItem(color: string, label: string): HTMLElement {
    const item = document.createElement('span');
    item.className = 'map-legend-item';
    const swatch = document.createElement('i');
    swatch.style.background = color;
    item.append(swatch, document.createTextNode(label));
    return item;
  }

  function build(): void {
    const panel = document.createElement('div');
    panel.className = 'panel map-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('map.title'));
    const title = document.createElement('h2');
    title.textContent = t('map.title');
    canvas = document.createElement('canvas');
    canvas.className = 'map-canvas';
    canvas.width = Math.min(1100, window.innerWidth - 80);
    canvas.height = Math.min(600, window.innerHeight - 300);
    info = document.createElement('div');
    info.className = 'map-info';
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.append(
      legendItem('#2f6fb0', t('map.water')),
      legendItem(resourceById('iron_ore').color, t('item.iron_ore' as TranslationKey)),
      legendItem(resourceById('copper_ore').color, t('item.copper_ore' as TranslationKey)),
      legendItem(resourceById('coal').color, t('item.coal' as TranslationKey)),
      legendItem(OBJECT_COLORS.tree, t('map.trees')),
      legendItem(OBJECT_COLORS.rock, t('map.rocks')),
      legendItem(OBJECT_COLORS.nest, t('map.nests')),
      legendItem('#c79a5d', t('map.buildings')),
      legendItem('#e2e6ea', t('map.belts')),
    );
    const help = document.createElement('small');
    help.className = 'help';
    help.textContent = t('map.help');
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'panel-close';
    x.textContent = '✕';
    x.title = t('inv.close');
    x.setAttribute('aria-label', t('inv.close'));
    x.addEventListener('click', closeWindow);
    panel.append(title, canvas, info, legend, help, x);
    root.replaceChildren(panel);

    const cellAt = (e: MouseEvent): { gx: number; gz: number } => {
      const rect = canvas!.getBoundingClientRect();
      const zoom = ZOOMS[zoomIndex];
      const px = ((e.clientX - rect.left) * canvas!.width) / rect.width;
      const pz = ((e.clientY - rect.top) * canvas!.height) / rect.height;
      return {
        gx: Math.floor(center.gx + (px - canvas!.width / 2) / zoom),
        gz: Math.floor(center.gz + (pz - canvas!.height / 2) / zoom),
      };
    };
    canvas.addEventListener('mousedown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => (drag = null));
    canvas.addEventListener('mousemove', (e) => {
      hoverCell = cellAt(e);
      if (!drag) return;
      const zoom = ZOOMS[zoomIndex];
      const rect = canvas!.getBoundingClientRect();
      const scale = canvas!.width / rect.width;
      center = {
        gx: center.gx - ((e.clientX - drag.x) * scale) / zoom,
        gz: center.gz - ((e.clientY - drag.y) * scale) / zoom,
      };
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mouseleave', () => (hoverCell = null));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, zoomIndex + (e.deltaY < 0 ? 1 : -1)));
      },
      { passive: false },
    );
  }

  function openWindow(): void {
    if (isOpenNow) return;
    isOpenNow = true;
    const p = options.player();
    center = { gx: p.x / CELL_SIZE_M, gz: p.z / CELL_SIZE_M };
    root.hidden = false;
    build();
    options.onOpenChange(true);
    raf = requestAnimationFrame(draw);
  }

  function closeWindow(): void {
    if (!isOpenNow) return;
    isOpenNow = false;
    cancelAnimationFrame(raf);
    canvas = null;
    info = null;
    root.hidden = true;
    root.replaceChildren();
    options.onOpenChange(false);
  }

  // Échap ferme d'abord la carte, sans ouvrir le menu pause ; M / + / - comme dans les autres fenêtres.
  const onKey = (e: KeyboardEvent): void => {
    if (!isOpenNow) return;
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      closeWindow();
    } else if (e.key === '+' || e.key === '=') {
      zoomIndex = Math.min(ZOOMS.length - 1, zoomIndex + 1);
    } else if (e.key === '-') {
      zoomIndex = Math.max(0, zoomIndex - 1);
    }
  };
  window.addEventListener('keydown', onKey, true);
  root.hidden = true;

  return {
    open: openWindow,
    close: closeWindow,
    toggle: () => (isOpenNow ? closeWindow() : openWindow()),
    isOpen: () => isOpenNow,
    dispose: () => {
      closeWindow();
      window.removeEventListener('keydown', onKey, true);
    },
  };
}
