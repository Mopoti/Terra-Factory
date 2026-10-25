# Terra Factory — version Unreal Engine (essai)

Dossier réservé au projet Unreal (`.uproject`, `Content/`, `Source/`…), à créer ici.

## Règles de la structure du dépôt
- Chaque version du jeu vit **dans son propre dossier** et n'utilise **aucun fichier d'un autre dossier** : `navigateur/` (TypeScript + three.js, version actuelle) et `unreal/` (cet essai).
- **Les modèles 3D ne sont pas partagés** : ceux du navigateur sont dans `navigateur/export/` (`.glb`, avec une version détaillée dans `export/unity/`) et `navigateur/blender/` ; pour Unreal, on les copie dans ce dossier ou on les refait. Aucune référence de l'un vers l'autre.
- **Les données de jeu** (`navigateur/content/*.json` : objets, recettes, technologies, machines) sont aussi propres à chaque version : copier ce dont on a besoin ici plutôt que de pointer vers `navigateur/`.
- Restent communs, à la racine : `docs/` (conception du jeu, décisions), `passation.md`, `CLAUDE.md`.
- Quand l'une des versions est abandonnée : supprimer son dossier suffit (et la ligne qui s'y rapporte dans `vercel.json` pour le navigateur).

## État
Rien n'est encore fait : à cadrer avec le PO (version d'Unreal, C++ ou Blueprints, périmètre du premier essai).
