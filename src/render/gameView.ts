import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';

/** Vue 3D provisoire d'une partie (sol plat + case de 50 cm). Remplacée aux chantiers 3 et 4. */
export function startGameView(container: HTMLElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14181d);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(2, 1.6, 2.5);
  camera.lookAt(0, 0.25, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b4a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.GridHelper(20, 40, 0x667766, 0x445544));

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE_M, CELL_SIZE_M, CELL_SIZE_M),
    new THREE.MeshStandardMaterial({ color: 0xd9822b }),
  );
  cube.position.y = CELL_SIZE_M / 2;
  scene.add(cube);

  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop((t) => {
    cube.rotation.y = t / 1500;
    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
