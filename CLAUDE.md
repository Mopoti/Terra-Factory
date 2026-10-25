# Terra Factory

Jeu 3D d'automatisation d'usinage (type Factorio / Satisfactory), en deux versions indépendantes.

## Structure du dépôt
- `navigateur/` : la version actuelle (TypeScript, three.js, Vite, Vitest), avec ses modèles 3D (`blender/`, `export/`, `public/models/`), ses données (`content/`) et ses outils (`scripts/`, `tools/`). **Toutes les commandes npm se lancent depuis ce dossier** : `cd navigateur && npx tsc --noEmit && npx eslint src && npx vitest run`. Les chemins `src/…`, `content/…`, `blender/…` cités dans `docs/` et `passation.md` sont relatifs à `navigateur/`.
- `unreal/` : essai Unreal Engine (voir son `README.md`).
- Racine : `docs/` (conception, commune), `passation.md`, `CLAUDE.md`, `vercel.json` (déploiement du navigateur).
- **Aucun fichier partagé entre les versions** (modèles 3D et données compris : copiés ou refaits). Abandonner une version = supprimer son dossier.

## Lire en premier
- `passation.md` : état du projet, décisions prises, prochaines étapes. À mettre à jour à chaque fin de session.

## Conventions
- Langue de discussion et de documentation : français.
- Pas de PR sans demande explicite. Développement sur la branche désignée par la session.
