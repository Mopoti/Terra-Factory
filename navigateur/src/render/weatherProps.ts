/**
 * Objets de météo dessinés avec des formes simples (en attendant des modèles faits dans Blender) : le thermomètre (un
 * écran fixé au mur), la girouette (une flèche qui pointe vers le vent) et l'éolienne (rotor face au vent).
 */
import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { levelY } from '../core/factory/factory';
import type { Machine } from '../core/factory/factory';
import type { Wind } from '../core/game/weather';

/** Ce que les objets de météo lisent dans le monde. */
export interface WeatherSource {
  wind(): Wind;
  /** Température de l'air (°C) à ce point, en mètres (déjà adoucie dans un abri). */
  tempAt(x: number, z: number): number;
  /** Côté du mur contre lequel est posé ce thermomètre : (dx, dz) vers le mur, ou null. */
  wallSide(m: Machine): [number, number] | null;
  /** Texte d'une température, dans l'unité choisie par le joueur. */
  format(celsius: number): string;
}

/** Types dessinés ici (leur corps habituel n'est pas dessiné). */
export const WEATHER_PROP_TYPES = ['thermometer', 'vane', 'wind_turbine'] as const;
export const isWeatherProp = (type: string): boolean =>
  (WEATHER_PROP_TYPES as readonly string[]).includes(type);

interface Prop {
  machine: Machine;
  group: THREE.Group;
  update(dt: number, time: number, src: WeatherSource): void;
  dispose(): void;
}

const box = (w: number, h: number, d: number, color: number): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 }),
  );

/** Angle (radians) le plus court de `from` vers `to`, avancé d'au plus `step`. */
function turnToward(from: number, to: number, step: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + Math.max(-step, Math.min(step, diff));
}

function centerOf(m: Machine, cells: number): [number, number, number] {
  return [(m.gx + cells / 2) * CELL_SIZE_M, levelY(m.lift), (m.gz + cells / 2) * CELL_SIZE_M];
}

function thermometer(m: Machine): Prop {
  const group = new THREE.Group();
  const [x, y, z] = centerOf(m, 1);
  const frame = box(0.36, 0.28, 0.04, 0x2b2f33);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.24),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  screen.position.z = 0.021;
  group.add(frame, screen);
  group.position.set(x, y + 1.2, z);
  let shown = '';
  let side: string | null = null;
  return {
    machine: m,
    group,
    update(_dt, time, src) {
      const wall = src.wallSide(m);
      const key = wall ? `${wall[0]},${wall[1]}` : 'none';
      if (key !== side) {
        side = key;
        // Fixé contre le mur, l'écran regarde vers la case ; sans mur (démoli) il garde sa dernière orientation.
        if (wall) {
          group.position.set(x + wall[0] * 0.18, y + 1.2, z + wall[1] * 0.18);
          group.rotation.y = Math.atan2(-wall[0], -wall[1]);
        }
      }
      const text = src.format(src.tempAt(x, z));
      if (text === shown) return;
      shown = text;
      const g = canvas.getContext('2d');
      if (!g) return;
      g.fillStyle = '#10222b';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#7fe6ff';
      g.font = 'bold 34px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, canvas.width / 2, canvas.height / 2);
      texture.needsUpdate = true;
      void time;
    },
    dispose() {
      texture.dispose();
      screen.geometry.dispose();
    },
  };
}

function vane(m: Machine): Prop {
  const group = new THREE.Group();
  const [x, y, z] = centerOf(m, 1);
  const mast = box(0.06, 1.9, 0.06, 0x8a8f94);
  mast.position.y = 0.95;
  const head = new THREE.Group();
  head.position.y = 1.95;
  const shaft = box(0.8, 0.04, 0.04, 0xb33a2e);
  const tip = box(0.14, 0.1, 0.03, 0xb33a2e);
  tip.position.x = 0.42;
  const fin = box(0.22, 0.24, 0.015, 0xd9d2c0);
  fin.position.x = -0.32;
  head.add(shaft, tip, fin);
  group.add(mast, head);
  group.position.set(x, y, z);
  let yaw = 0;
  return {
    machine: m,
    group,
    update(dt, _time, src) {
      const wind = src.wind();
      // La flèche pointe vers l'endroit d'où vient le vent : elle tourne plus vite quand il souffle fort.
      yaw = turnToward(yaw, -(wind.dir + Math.PI), dt * (0.8 + 3 * wind.speed));
      head.rotation.y = yaw;
    },
    dispose() {},
  };
}

function windTurbine(m: Machine): Prop {
  const group = new THREE.Group();
  const [x, y, z] = centerOf(m, 2);
  const tower = box(0.2, 5.2, 0.2, 0xdfe4e8);
  tower.position.y = 2.6;
  const nacelle = new THREE.Group();
  nacelle.position.y = 5.3;
  const body = box(0.7, 0.28, 0.28, 0xdfe4e8);
  body.position.x = 0.05;
  const hub = box(0.12, 0.16, 0.16, 0x9aa3aa);
  hub.position.x = 0.42;
  const rotor = new THREE.Group();
  rotor.position.x = 0.48;
  for (let i = 0; i < 3; i++) {
    const holder = new THREE.Group();
    holder.rotation.x = (i * Math.PI * 2) / 3;
    const blade = box(0.05, 1.9, 0.16, 0xf3f5f6);
    blade.position.y = 1.05;
    holder.add(blade);
    rotor.add(holder);
  }
  nacelle.add(body, hub, rotor);
  group.add(tower, nacelle);
  group.position.set(x, y, z);
  let yaw = 0;
  return {
    machine: m,
    group,
    update(dt, _time, src) {
      const wind = src.wind();
      // Le rotor se tourne face au vent (lentement : une éolienne est lourde), puis tourne d'autant plus vite que le vent est fort.
      yaw = turnToward(yaw, -(wind.dir + Math.PI), dt * 0.5);
      nacelle.rotation.y = yaw;
      rotor.rotation.x += dt * (0.3 + 5 * wind.speed);
    },
    dispose() {},
  };
}

/** Les objets de météo de la scène : créés et retirés avec les machines, animés à chaque image. */
export class WeatherProps {
  private readonly root = new THREE.Group();
  private readonly props = new Map<number, Prop>();
  source: WeatherSource | null = null;
  private clock = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** Met la liste des objets d'accord avec les machines posées. */
  sync(machines: readonly Machine[]): void {
    const wanted = new Map<number, Machine>();
    for (const m of machines) if (isWeatherProp(m.type)) wanted.set(m.id, m);
    for (const [id, prop] of this.props) {
      const m = wanted.get(id);
      if (m && m.type === prop.machine.type && m.gx === prop.machine.gx && m.gz === prop.machine.gz)
        continue;
      this.root.remove(prop.group);
      prop.dispose();
      this.props.delete(id);
    }
    for (const [id, m] of wanted) {
      if (this.props.has(id)) continue;
      const prop =
        m.type === 'thermometer' ? thermometer(m) : m.type === 'vane' ? vane(m) : windTurbine(m);
      this.props.set(id, prop);
      this.root.add(prop.group);
    }
  }

  update(dt: number): void {
    if (!this.source) return;
    this.clock += dt;
    for (const prop of this.props.values()) prop.update(dt, this.clock, this.source);
  }
}
