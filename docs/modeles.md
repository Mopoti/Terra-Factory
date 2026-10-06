# Formes provisoires → vrais modèles

Tout ce qui est dessiné aujourd'hui est fait de boîtes, cônes et dalles construits en code (`src/render/factoryView.ts`, `gameView.ts`, `chunkMesh.ts`, `enemyView.ts`). Rien à remplacer tant qu'il n'y a pas d'assets : **il faut des modèles 3D fournis (glTF / GLB, licence redistribuable)**.

## Ce qui est provisoire

Personnage (capsule) et équipement porté, outil (pioche), pistolet, ennemis, buggy, arbres / rochers / buissons / minerais, toutes les machines (foreuse, four, générateur, poteau, coffres, séparateur, groupeur, bras, assembleur, laboratoire, tuyaux, pompe, chaudière, turbine, tourelle), tapis (rampes, tunnels, piliers).

## Plan quand les modèles existent

1. Déposer les fichiers dans `public/models/` (un GLB par objet, échelle en mètres, origine au centre de l'emprise au sol, avant = +z).
2. Chargeur `GLTFLoader` avec cache, instancié par `InstancedMesh` pour les tapis et les arbres (performance).
3. Remplacer les fonctions de dessin une à une (`addMachineBody` par type) : si le modèle manque, on garde la forme provisoire.
4. Garder les emprises et les ports (flèches) dessinés en code : ils ne dépendent pas du modèle.
