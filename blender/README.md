# Modèles 3D de Terra Factory (Blender)

Pour le PC avec Blender (testé avec les scripts sous bpy 4.2 ; prévus pour 5.x : seuls `bpy`, `bmesh` et l'export glTF sont utilisés).

## Organisation

- `blender/*.blend` : **un fichier par petite famille** (`extraction.blend`, plus tard `fonderie.blend`, `energie.blend`…). Chaque modèle y est une **collection** nommée comme son fichier exporté.
- `blender/scripts/<famille>.py` : le script qui fabrique la famille (modèles, matériaux, export). Les `.blend` sont régénérables ; on peut aussi les retoucher à la main, mais alors **ne relancez plus le script** de cette famille (il écraserait vos retouches).
- `blender/lib/terra.py` : outils communs (palette, boîtes, cylindres, export).
- `export/` : **un `.glb` par modèle**, nom simple en minuscules sans accents : `foreuse_t1.glb`, `fourneau_t1.glb`…
- `scripts/sync-modeles.mjs` : copie `export/*.glb` vers `public/models/terra/` (ce que charge le jeu).

## Règles de dessin

- **Échelle** : 1 unité Blender = 1 case du jeu = 50 cm × 50 cm. Une foreuse de 4 × 4 cases mesure 4 × 4 unités.
- **Axes** : Z en haut ; modèle centré sur (0, 0) et posé sur Z = 0 ; tout reste dans l'emprise de la machine (le jeu cadre le modèle sur son enveloppe : une pièce qui dépasse le réduit).
- **Avant** : la sortie de la machine est du côté **−Y** (vue de face, touche 1). À l'export (Y haut) c'est +Z = orientation 0 du jeu.
- **Style** : formes simples, peu de faces, ombrage plat, **matériaux unis de la palette** (`PALETTE` dans `terra.py`), pas de texture.
- **Export** : le script met le modèle à l'échelle 0,5 : le `.glb` est en **mètres** (1 unité = 1 m), comme attendu par three.js et Unity.

## Lancer un script

Avec Blender installé : `blender --background --python blender/scripts/extraction.py` (depuis la racine du dépôt), puis `node scripts/sync-modeles.mjs`.

## Brancher un modèle dans le jeu

Ajouter la machine dans `TERRA_MODELS` (`src/render/models.ts`) : `drill: 'foreuse_t1'`. Il passe avant le modèle du kit Kenney.

## Nommage

`<objet>_<palier>` : `foreuse_t1`, `foreuse_electrique_t2`, `tapis_t1`… Mots séparés par `_`, sans accents ni majuscules.
