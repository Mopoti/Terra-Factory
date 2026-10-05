import * as THREE from 'three';
import { CELL_SIZE_M, CHUNK_SIZE_M } from '../core/constants';
import type { Settings } from '../settings/schema';
import { getSettings, onSettingsChange } from '../settings/store';

const PIXEL_RATIO_CAP = { low: 1, medium: 1.5, high: 3 } as const;

/** Vue 3D provisoire d'une partie (sol plat + case de 50 cm). Remplacée aux chantiers 3 et 4. */
export function startGameView(container: HTMLElement): () => void {
  const initial = getSettings().display;
  const renderer = new THREE.WebGLRenderer({ antialias: initial.quality !== 'low' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14181d);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camera.position.set(2, 1.6, 2.5);
  camera.lookAt(0, 0.25, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 5, 2);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b4a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.GridHelper(20, 40, 0x667766, 0x445544));

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE_M, CELL_SIZE_M, CELL_SIZE_M),
    new THREE.MeshStandardMaterial({ color: 0xd9822b }),
  );
  cube.position.y = CELL_SIZE_M / 2;
  cube.castShadow = true;
  scene.add(cube);

  const fpsBox = document.createElement('div');
  fpsBox.className = 'fps-counter';
  container.appendChild(fpsBox);

  let fpsLimit = initial.fpsLimit;

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
    const far = d.viewDistance * CHUNK_SIZE_M;
    camera.far = far;
    camera.updateProjectionMatrix();
    scene.fog = new THREE.Fog(0x14181d, far * 0.6, far);
    fpsLimit = d.fpsLimit;
    fpsBox.hidden = !d.showFps;
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

  let last = 0;
  let frames = 0;
  let fpsSince = 0;
  renderer.setAnimationLoop((t) => {
    if (fpsLimit > 0 && t - last < 1000 / fpsLimit - 1) return;
    last = t;
    cube.rotation.y = t / 1500;
    renderer.render(scene, camera);
    frames++;
    if (t - fpsSince >= 500) {
      fpsBox.textContent = `${Math.round((frames * 1000) / (t - fpsSince))} FPS`;
      frames = 0;
      fpsSince = t;
    }
  });

  return () => {
    unsubscribe();
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    renderer.domElement.remove();
    fpsBox.remove();
  };
}
