/** Modèle de la pioche tenue en main : un piolet (voir `docs/modeles3d.md`). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Longueur de l'outil en jeu (m). */
export const TOOL_LENGTH_M = 0.75;

let loading: Promise<THREE.Group | null> | null = null;

/**
 * Charge le piolet (une seule fois) et le met à l'échelle du jeu : manche vers -z, pointe vers +z, centré sur l'origine
 * comme les anciennes formes simples. Un échec donne null : l'outil garde ses formes simples.
 */
export function loadPickModel(
  baseUrl = import.meta.env.BASE_URL ?? './',
): Promise<THREE.Group | null> {
  loading ??= new Promise((resolve) => {
    new GLTFLoader().load(
      `${baseUrl}models/tool/icepick.glb`,
      (gltf) => {
        const raw = gltf.scene;
        const box = new THREE.Box3().setFromObject(raw);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        // Le fichier est debout (axe y) : on le couche sur l'axe z.
        const inner = new THREE.Group();
        raw.position.sub(center);
        inner.add(raw);
        inner.rotation.x = Math.PI / 2;
        const outer = new THREE.Group();
        outer.add(inner);
        outer.scale.setScalar(TOOL_LENGTH_M / Math.max(size.x, size.y, size.z));
        outer.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            const material = mesh.material as THREE.MeshStandardMaterial;
            material.metalness = Math.min(material.metalness, 0.3);
          }
        });
        resolve(outer);
      },
      undefined,
      () => resolve(null),
    );
  });
  return loading;
}
