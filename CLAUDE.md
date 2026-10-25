# Terra Factory

Jeu 3D d'automatisation d'usinage (type Factorio / Satisfactory), en deux versions indépendantes.

## Structure du dépôt (rien d'autre à la racine)
- `GDD.md` : le Game Design Document, **seul fichier commun** aux deux versions (à travailler à fond ; les règles du jeu y sont décrites indépendamment de la technique).
- `navigateur/` : la version actuelle (TypeScript, three.js, Vite, Vitest), avec ses modèles 3D (`blender/`, `export/`, `public/models/`), ses données (`content/`), ses docs techniques (`docs/`), sa passation (`passation.md`), ses outils (`scripts/`, `tools/`). **Toutes les commandes npm se lancent depuis ce dossier** : `cd navigateur && npx tsc --noEmit && npx eslint src && npx vitest run`. Les chemins `src/…`, `content/…`, `docs/…` cités dans les docs sont relatifs à `navigateur/`.
- `unreal/` : essai Unreal Engine (voir son `README.md`).
- `CLAUDE.md` : ce fichier, obligatoirement à la racine pour être lu au lancement de la session.
- **Aucun fichier partagé entre les versions** (modèles 3D et données compris : copiés ou refaits). Abandonner une version = supprimer son dossier.

## Lire en premier
- `navigateur/passation.md` : état du projet navigateur, décisions prises, prochaines étapes. À mettre à jour à chaque fin de session. (Pour Unreal : `unreal/passation.md`, à créer avec le projet.)

## Conventions
- Langue de discussion et de documentation : français.
- Pas de PR sans demande explicite. Développement sur la branche désignée par la session.
