/**
 * Objets de météo animés : le thermomètre (un écran fixé au mur), la girouette (une flèche qui pointe vers le vent) et
 * l'éolienne (rotor face au vent). Ils utilisent leurs modèles maison (`thermometre`, `girouette`, `eolienne` de
 * `blender/scripts/energie.py`) quand ils sont chargés, sinon des formes simples.
 */
import * as THREE from 'three';
import { propsMaterial } from './chunkMesh';
import { bakedModel } from './models';
import { vehicleFromModel } from './vehicleModel';
import { CELL_SIZE_M } from '../core/constants';
import { levelY } from '../core/factory/factory';
import type { Machine } from '../core/factory/factory';
import type { Wind } from '../core/game/weather';
import { turnToward } from './angles';

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

/** Modèle maison posé à son origine (pièces mobiles sur leurs pivots), ou null s'il n'est pas chargé. */
function modelMesh(
  name: string,
): { group: THREE.Group; parts: Map<string, THREE.Object3D>; y0: number } | null {
  const model = bakedModel(name);
  if (!model) return null;
  const mesh = vehicleFromModel(model, propsMaterial, true);
  return { group: mesh.group, parts: mesh.parts, y0: model.min.y };
}

function centerOf(m: Machine, cells: number): [number, number, number] {
  return [(m.gx + cells / 2) * CELL_SIZE_M, levelY(m.lift), (m.gz + cells / 2) * CELL_SIZE_M];
}

function thermometer(m: Machine): Prop {
  const group = new THREE.Group();
  const [x, y, z] = centerOf(m, 1);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.24),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  // Modèle : boîtier dont le dos est à 0,245 m derrière l'origine (côté mur, -z), écran de 0,32 x 0,24 m centré à
  // 1,2 m de haut, sa face à 0,17 m derrière l'origine. On recule le tout pour que le dos touche le mur (à 0,2 m).
  const own = modelMesh('thermometre');
  const back = own ? -0.045 : 0.18;
  if (own) {
    own.group.position.y = own.y0;
    screen.position.set(0, 1.2, -0.165);
    group.add(own.group, screen);
  } else {
    const frame = box(0.36, 0.28, 0.04, 0x2b2f33);
    screen.position.z = 0.021;
    frame.position.y = 1.2;
    screen.position.y = 1.2;
    group.add(frame, screen);
  }
  group.position.set(x, y, z);
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
          group.position.set(x + wall[0] * back, y, z + wall[1] * back);
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
  // Flèche : au repos, la pointe du modèle regarde vers +z (celle des formes simples vers +x) ; anémomètre en haut.
  let head: THREE.Object3D;
  let headTurn = 0;
  let cups: THREE.Object3D | null = null;
  const own = modelMesh('girouette');
  const arrow = own?.parts.get('fleche');
  if (own && arrow) {
    own.group.position.y = own.y0;
    group.add(own.group);
    head = arrow;
    headTurn = Math.PI / 2;
    cups = own.parts.get('anemometre') ?? null;
  } else {
    const mast = box(0.06, 1.9, 0.06, 0x8a8f94);
    mast.position.y = 0.95;
    head = new THREE.Group();
    head.position.y = 1.95;
    const shaft = box(0.8, 0.04, 0.04, 0xb33a2e);
    const tip = box(0.14, 0.1, 0.03, 0xb33a2e);
    tip.position.x = 0.42;
    const fin = box(0.22, 0.24, 0.015, 0xd9d2c0);
    fin.position.x = -0.32;
    head.add(shaft, tip, fin);
    group.add(mast, head);
  }
  group.position.set(x, y, z);
  let yaw = 0;
  return {
    machine: m,
    group,
    update(dt, _time, src) {
      const wind = src.wind();
      // La flèche pointe vers l'endroit d'où vient le vent : elle tourne plus vite quand il souffle fort.
      yaw = turnToward(yaw, -(wind.dir + Math.PI), dt * (0.8 + 3 * wind.speed));
      head.rotation.y = yaw + headTurn;
      if (cups) cups.rotation.y += dt * (0.5 + 9 * wind.speed);
    },
    dispose() {},
  };
}

function windTurbine(m: Machine): Prop {
  const group = new THREE.Group();
  const [x, y, z] = centerOf(m, 2);
  // Modèle : nacelle sur pivot vertical, rotor (son enfant) vers +z qui tourne autour de z ; formes simples : rotor
  // vers +x qui tourne autour de x.
  let nacelle: THREE.Object3D;
  let rotor: THREE.Object3D;
  let nacelleTurn = 0;
  let spinAxis: 'x' | 'z' = 'x';
  const own = modelMesh('eolienne');
  const ownNacelle = own?.parts.get('nacelle');
  const ownRotor = own?.parts.get('rotor');
  if (own && ownNacelle && ownRotor) {
    own.group.position.y = own.y0;
    group.add(own.group);
    ownNacelle.attach(ownRotor);
    nacelle = ownNacelle;
    rotor = ownRotor;
    nacelleTurn = Math.PI / 2;
    spinAxis = 'z';
  } else {
    const tower = box(0.2, 5.2, 0.2, 0xdfe4e8);
    tower.position.y = 2.6;
    nacelle = new THREE.Group();
    nacelle.position.y = 5.3;
    const body = box(0.7, 0.28, 0.28, 0xdfe4e8);
    body.position.x = 0.05;
    const hub = box(0.12, 0.16, 0.16, 0x9aa3aa);
    hub.position.x = 0.42;
    rotor = new THREE.Group();
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
  }
  group.position.set(x, y, z);
  let yaw = 0;
  return {
    machine: m,
    group,
    update(dt, _time, src) {
      const wind = src.wind();
      // Le rotor se tourne face au vent (lentement : une éolienne est lourde), puis tourne d'autant plus vite que le vent est fort.
      yaw = turnToward(yaw, -(wind.dir + Math.PI), dt * 0.5);
      nacelle.rotation.y = yaw + nacelleTurn;
      rotor.rotation[spinAxis] += dt * (0.3 + 5 * wind.speed);
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
