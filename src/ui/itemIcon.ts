/**
 * Icône d'un objet : son modèle 3D (celui qu'il a posé au sol, ou la miniature de la machine) vu en perspective
 * isométrique, dessiné une fois puis gardé en image. Tant que les modèles ne sont pas chargés, la case garde sa couleur.
 */
import * as THREE from 'three';
import { machineForItem } from '../core/data/machines';
import { HELD_MODELS, dropGeometry, dropMachine, iconModelName } from '../render/dropModels';
import { loadPickModel, loadWeaponModel } from '../render/toolModel';

const SIZE = 96;
const RETRY_MS = 400;
const RETRY_MAX = 50;

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  material: THREE.MeshStandardMaterial;
}

let studio: Studio | null | undefined;
const cache = new Map<string, string>();

function getStudio(): Studio | null {
  if (studio !== undefined) return studio;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7078, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    studio = { renderer, scene, camera, material };
  } catch {
    studio = null;
  }
  return studio;
}

/** Dessine un objet 3D (centré, cadré d'après sa boîte) et renvoie l'image. */
function snapshot(object: THREE.Object3D, fit = 0.82): string | null {
  const s = getStudio();
  if (!s) return null;
  s.scene.add(object);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-4);
  s.camera.left = -radius * fit;
  s.camera.right = radius * fit;
  s.camera.top = radius * fit;
  s.camera.bottom = -radius * fit;
  s.camera.updateProjectionMatrix();
  s.camera.position
    .copy(center)
    .add(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(radius * 4));
  s.camera.lookAt(center);
  s.renderer.render(s.scene, s.camera);
  const url = s.renderer.domElement.toDataURL('image/png');
  s.scene.remove(object);
  return url;
}

const held = new Map<string, THREE.Object3D | null>();
const heldRequested = new Set<string>();

/** Outil ou arme tenu : son modèle, chargé à la demande. */
function heldObject(item: string): THREE.Object3D | null {
  const spec = HELD_MODELS[item];
  if (!spec) return null;
  if (!heldRequested.has(item)) {
    heldRequested.add(item);
    const load = spec.kind === 'pick' ? loadPickModel(spec.file) : loadWeaponModel(spec.file);
    void load.then((m) => held.set(item, m));
  }
  return held.get(item) ?? null;
}

/** Image de l'icône de cet objet, ou null tant que son modèle n'est pas prêt. */
export function itemIconUrl(item: string): string | null {
  const known = cache.get(item);
  if (known) return known;
  let url: string | null = null;
  if (HELD_MODELS[item]) {
    const model = heldObject(item);
    if (model) {
      const copy = model.clone();
      copy.rotation.y = HELD_MODELS[item].kind === 'pick' ? -Math.PI / 4 : -Math.PI / 5;
      const holder = new THREE.Group();
      holder.add(copy);
      url = snapshot(holder, HELD_MODELS[item].kind === 'pick' ? 0.4 : 0.6);
    }
  } else {
    // Un objet dont le modèle n'est pas encore chargé n'a pas d'icône (et pas la caisse par défaut).
    const own = iconModelName(item);
    const waiting = (machineForItem(item) || own) && !dropMachine(item);
    const geometry = waiting ? null : dropGeometry(item, 1);
    const s = geometry ? getStudio() : null;
    if (geometry && s) url = snapshot(new THREE.Mesh(geometry, s.material));
  }
  if (url) cache.set(item, url);
  return url;
}

/** Case d'icône d'un objet : l'image quand elle est prête (on réessaie un moment), sinon un fond de sa couleur. */
export function itemIcon(item: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'slot-icon';
  const fill = (tries: number): void => {
    const url = itemIconUrl(item);
    if (url) {
      span.style.backgroundImage = `url(${url})`;
      span.classList.add('ready');
    } else if (tries < RETRY_MAX) setTimeout(() => fill(tries + 1), RETRY_MS);
  };
  fill(0);
  return span;
}
