# Passation — Terra Factory

> Fichier de transmission entre discussions. Mettre à jour à chaque fin de session.
> Dernière mise à jour : 2026-10-04

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

## Décisions
- (aucune encore — stack technique à valider, voir ci-dessous)

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
1. Valider la stack et le périmètre du MVP.
2. Prototype : scène Three.js, sol plat, caméra 3 vues, contrôles remappables.
3. Génération de chunks infinie avec seed + ressources.
4. Sauvegarde multi-slots.
5. Récolte manuelle, puis machines/convoyeurs.
