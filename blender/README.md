# Modèles 3D de Terra Factory (Blender)

Pour le PC avec Blender (testé avec les scripts sous bpy 4.2 ; prévus pour 5.x : seuls `bpy`, `bmesh` et l'export glTF sont utilisés).

## Organisation

- `blender/*.blend` : **un fichier par petite famille** (`extraction.blend`, plus tard `fonderie.blend`, `energie.blend`…). Chaque modèle y est une **collection** nommée comme son fichier exporté. **Les `.blend` ne sont pas dans Git** (`.gitignore`) : seuls les `.glb` d'`export/` et les scripts y sont. Chacun garde ses `.blend` en local.
- `blender/scripts/<famille>.py` : le script qui fabrique la famille (modèles, matériaux, export). Les `.blend` sont régénérables ; on peut aussi les retoucher à la main, mais alors **ne relancez plus le script** de cette famille (il écraserait vos retouches).
- `blender/lib/terra.py` : outils communs (palette, boîtes, cylindres, export).
- `export/` : **un `.glb` par modèle**, nom simple en minuscules sans accents : `foreuse_t1.glb`, `fourneau_t1.glb`…
- `scripts/sync-modeles.mjs` : copie `export/*.glb` vers `public/models/terra/` (ce que charge le jeu).
- **Deux versions par modèle**, faites par la même fonction (`leger=True` / `False`) et rangées dans le même `.blend` : la version **web** (navigateur, légère : petites pièces sans biseau, moins de briques) dans la collection `<nom>` → `export/<nom>.glb`, et la version **Unity** (détaillée) dans la collection `<nom>_unity` (masquée) → `export/unity/<nom>.glb`. Seule la version web est copiée dans le jeu.

## Règles de dessin

- **Échelle** : 1 unité Blender = 1 case du jeu = 50 cm × 50 cm. Une foreuse de 4 × 4 cases mesure 4 × 4 unités.
- **Axes** : Z en haut ; modèle centré sur (0, 0) et posé sur Z = 0 ; tout reste dans l'emprise de la machine (le jeu cadre le modèle sur son enveloppe : une pièce qui dépasse le réduit).
- **Hauteur** : le jeu accepte un modèle jusqu'à **1,3 × la hauteur** de la machine dans `content/machines.json` (`height`, en mètres) sans le réduire (`factoryView.ts`). Ex. fourneau : `height` 1,0 m → modèle jusqu'à 1,3 m = 2,6 unités Blender.
- **Avant** : la sortie de la machine est du côté **−Y** (vue de face, touche 1). À l'export (Y haut) c'est +Z = orientation 0 du jeu.
- **Style : low poly stylisé** (*stylized low-poly*) : formes simples et un peu irrégulières, arêtes biseautées, facettes visibles (ombrage plat), **couleurs unies de la palette** (`PALETTE` dans `terra.py`). Le côté « vrai » vient du **relief et des variations de teinte**, pas d'images : pierres et briques en relief de plusieurs teintes (`parement`), dalles au sol, rivets, planches, braises… Référence : un fourneau en pierres et briques, chaleureux, aux formes un peu massives.
- **Pas d'image de texture** : le jeu « cuit » chaque modèle en couleurs par sommet (`bake()` dans `src/render/models.ts`) pour fusionner les machines en un seul maillage ; une texture y serait réduite à une couleur par sommet. Une teinte = un matériau de la palette (en ajouter si besoin).
- **Export** : le script met le modèle à l'échelle 0,5 : le `.glb` est en **mètres** (1 unité = 1 m), comme attendu par three.js et Unity.

## Lancer un script

Avec Blender installé : `blender --background --python blender/scripts/extraction.py` (depuis la racine du dépôt), puis `node scripts/sync-modeles.mjs`.

## Brancher un modèle dans le jeu

Ajouter la machine dans `TERRA_MODELS` (`src/render/models.ts`) : `drill: 'foreuse_t1'`. Il passe avant le modèle du kit Kenney.

## Nommage

`<objet>_<palier>` : `foreuse_t1`, `foreuse_electrique_t2`, `tapis_t1`… Mots séparés par `_`, sans accents ni majuscules.
