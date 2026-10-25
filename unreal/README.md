# Terra Factory — version Unreal Engine (essai)

Dossier réservé au projet Unreal (`.uproject`, `Content/`, `Source/`…), à créer ici.

## Règles de la structure du dépôt
- Chaque version du jeu vit **dans son propre dossier** et n'utilise **aucun fichier d'un autre dossier** : `navigateur/` (TypeScript + three.js, version actuelle) et `unreal/` (cet essai).
- **Les modèles 3D ne sont pas partagés** : ceux du navigateur sont dans `navigateur/export/` (`.glb`, avec une version détaillée dans `export/unity/`) et `navigateur/blender/` ; pour Unreal, on les copie dans ce dossier ou on les refait. Aucune référence de l'un vers l'autre.
- **Les données de jeu** (`navigateur/content/*.json` : objets, recettes, technologies, machines) sont aussi propres à chaque version : copier ce dont on a besoin ici plutôt que de pointer vers `navigateur/`.
- Seul fichier commun, à la racine : `GDD.md` (conception du jeu). `CLAUDE.md` y est aussi, car l'outil le lit à cet endroit. Les docs techniques et la passation de chaque version sont dans son dossier (`navigateur/docs/`, `navigateur/passation.md` ; `unreal/passation.md` à créer).
- Quand l'une des versions est abandonnée : supprimer son dossier suffit .

## État
Rien n'est encore fait : à cadrer avec le PO (version d'Unreal, C++ ou Blueprints, périmètre du premier essai).
