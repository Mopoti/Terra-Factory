/** Modèle de la pioche tenue en main : un piolet (voir `docs/modeles3d.md`). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Longueur de l'outil en jeu (m). */
export const TOOL_LENGTH_M = 0.75;

const loading = new Map<string, Promise<THREE.Group | null>>();

/**
 * Charge une pioche (une seule fois par fichier) et la met à l'échelle du jeu : manche vers -z, tête vers +z, pointe
 * vers -y, centrée sur l'origine comme les anciennes formes simples. Le fichier est debout (axe y), pointe vers +z :
 * pioches maison (`blender/scripts/outils.py` : `pioche_pierre`, `pioche_fer`) ou l'ancien piolet (`tool/icepick`).
 * Un échec donne null : l'outil garde ses formes simples.
 */
export function loadPickModel(
  file = 'tool/icepick',
  baseUrl = import.meta.env.BASE_URL ?? './',
): Promise<THREE.Group | null> {
  const known = loading.get(file);
  if (known) return known;
  const promise = new Promise<THREE.Group | null>((resolve) => {
    new GLTFLoader().load(
      `${baseUrl}models/${file}.glb`,
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
  loading.set(file, promise);
  return promise;
}

const weapons = new Map<string, Promise<THREE.Group | null>>();

/**
 * Charge une arme tenue en main (`blender/scripts/outils.py` : `pistolet`, `fusil`), en mètres, le canon vers +z et
 * la poignée vers -y, l'origine à la poignée. Null si le fichier manque (formes simples).
 */
export function loadWeaponModel(
  name: string,
  baseUrl = import.meta.env.BASE_URL ?? './',
): Promise<THREE.Group | null> {
  const known = weapons.get(name);
  if (known) return known;
  const promise = new Promise<THREE.Group | null>((resolve) => {
    new GLTFLoader().load(
      `${baseUrl}models/terra/${name}.glb`,
      (gltf) => {
        gltf.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true;
        });
        resolve(gltf.scene);
      },
      undefined,
      () => resolve(null),
    );
  });
  weapons.set(name, promise);
  return promise;
}
