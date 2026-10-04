# Passation — Terra Factory

> Fichier de transmission entre discussions. Mettre à jour à chaque fin de session.
> Dernière mise à jour : 2026-10-04

## Rôles
- **Utilisateur = Product Owner** : décide de l'avancement et donne les directives. Non développeur (aucun langage maîtrisé).
- **Claude = dev sénior** : propose, tranche les choix techniques, code, explique simplement et sans jargon inutile.

## Vision
Jeu 3D d'automatisation d'usinage (inspiration Factorio / Satisfactory), **dans le navigateur**.

## Exigences exprimées par le joueur/porteur du projet
- Vues au choix du joueur, changeables en jeu : 1ère personne, 3ème personne, vue du dessus.
- Contrôles clavier (ex. ZQSD), **tous remappables** par le joueur.
- Sauvegardes : restaurer une sauvegarde, ou démarrer une nouvelle partie **sans perdre les anciennes** (plusieurs slots).
- Monde **procédural, infini, déterministe via une seed** (même seed = même monde pour tous les joueurs).
- Sol **plat**, non creusable. Ressources épuisables posées au sol (minerais, arbres, nids de monstres…), récoltables à la main ou par des machines.
- Assets : le porteur du projet possède des packs Unity Asset Store et d'autres ; il en manquera, qu'il créera sous Blender avec accompagnement.
- Unity envisagé comme **évolution future** (pas de compétence actuelle).

## Documents de référence
- `docs/besoins.md` : cahier des charges (menu, édition de partie, paramètres, simulation).
- `docs/risques.md` : sujets à trancher tôt pour éviter de gros chantiers.

## Décisions
- Stack validée par le PO : TypeScript + Vite + Three.js.
- Multijoueur à prévoir dès l'architecture : d'abord **hôte = un joueur** (pas de serveur dédié), plus tard **mini serveur dédié**.
- Terrain : plat au départ, mais l'architecture doit permettre plus tard un **terrain creusable** : voxels par blocs (navigateur, profondeur limitée à ~3-5 couches) ; en Unity, creusage profond. Le sol plat = un monde voxel à une seule couche de hauteur utile.
- Stack technique : toujours à valider (voir ci-dessous).

## Règles d'architecture (pour garder ces portes ouvertes)
- Logique de jeu séparée du rendu ; l'état du monde est des **données** (sérialisables), pas des objets 3D.
- Tous les changements passent par des **commandes/événements** (ex. « construire X en position Y ») : base du multijoueur et des sauvegardes.
- Simulation déterministe à pas fixe (même seed + mêmes commandes = même résultat).
- Monde découpé en chunks avec une grille 3D (même si une seule couche utile au début).

## Proposition de stack (à valider)
- TypeScript + Vite
- Three.js (rendu WebGL) — alternative : Babylon.js
- Assets : glTF/GLB (export Blender natif ; les packs Unity doivent être convertis, vérifier les licences)
- Sauvegardes : IndexedDB (plusieurs slots) + export/import de fichier
- Monde : chunks générés par bruit déterministe (PRNG seedé), sol plat, ressources placées par hachage (seed, coord. chunk)
- Simulation usine : tick à pas fixe, séparée du rendu (Web Worker à terme)

## Points d'attention
- Les assets Unity/Asset Store ne sont pas utilisables tels quels : conversion vers glTF + vérification de la licence (certaines interdisent la redistribution en dehors de Unity).
- Performance : instancing (InstancedMesh) obligatoire pour les convoyeurs/machines en nombre.
- Déterminisme : ne jamais utiliser `Math.random()` dans la génération du monde.

## Prochaines étapes
0. Finir la discussion de cadrage (`docs/risques.md`) avant de coder.
1. Périmètre du prototype : menu d'accueil complet (Continuer/Nouvelle/Charger/Paramètres/Quitter), édition de partie, sol plat, 3 vues.
2. Prototype : scène Three.js, sol plat, caméra 3 vues, contrôles remappables.
3. Génération de chunks infinie avec seed + ressources.
4. Sauvegarde multi-slots.
5. Récolte manuelle, puis machines/convoyeurs.
