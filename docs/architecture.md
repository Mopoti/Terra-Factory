# Architecture technique et plan du prototype

Statut : PROPOSITION, à valider par le PO avant tout code.

## Méthode de travail (décidée avec le PO)

- Une étape à la fois : Claude réalise → le PO teste/valide → on continue. En cas de blocage : on analyse ensemble.
- Quand une action revient au PO (Claude ne peut pas la faire), Claude la guide **pas à pas**, sans jargon, avec captures/commandes exactes et le résultat attendu.
- Après chaque étape : `passation.md` mis à jour, commit, push sur la branche désignée.

## Principes (issus du cadrage)

1. **Séparation stricte** : `core` (règles du jeu, sans aucun affichage) / `render` (Three.js) / `ui` (menus). Le `core` ne connaît ni le navigateur ni Three.js → réutilisable en serveur (multi) et porté plus tard vers Unity.
2. **Monde = données** : grille 3D à **deux niveaux**, découpée en chunks. Niveau « logistique » = cases de 50 cm (convoyeurs, tuyaux, rails, câbles, alignement général). Niveau « fin » = pas de 10 cm (murs 10 cm d'épaisseur, machines, décor, placement fin). Positions stockées en **entiers en unités de 10 cm** (déterministe, sans erreur d'arrondi). Le niveau fin est creux (on ne stocke que ce qui est posé). Une seule couche utile pour l'instant ; les couches du dessous existent déjà dans la structure (terrain creusable plus tard).
3. **Commandes** : toute action (construire, récolter…) est une commande envoyée au core. Base du multijoueur (5 joueurs max), des sauvegardes et de l'annulation.
4. **Simulation déterministe à pas fixe** : 20 ticks/s, PRNG seedé, jamais de `Math.random()` dans le core.
5. **Contenu en fichiers de données** (objets, ressources, recettes, combustibles, biomes) avec **ids texte stables**. Rien d'équilibrage en dur dans le code.
6. **Unités SI en interne** (m, kg, °C, Pa, J, W, V, A) ; conversion à l'affichage seulement selon les paramètres du joueur.
7. **Textes traduisibles** (fr/en) dès le premier bouton ; langue par défaut = celle du navigateur.
8. **Sauvegardes** : format versionné + migrations ; IndexedDB + export/import .zip. Une « partie » contient plusieurs « sauvegardes » (manuelles + auto).
9. **Positions en coordonnées continues** (la grille est une règle de placement, pas une contrainte de stockage) → placement libre possible plus tard.

## Organisation du code (prévue)

```
src/
  core/        règles du jeu (pur TypeScript, testé)
    world/     chunks, seed, génération, ressources
    sim/       boucle de ticks, commandes
    data/      chargeurs de données de contenu
    save/      format de sauvegarde, versions, migrations
  render/      Three.js : scène, caméras (1ère/3ème/dessus), chunks affichés
  ui/          menus : accueil, édition de partie, sauvegardes, paramètres
  i18n/        fr.json, en.json
  settings/    paramètres joueur (sons, vues, touches, image, langue, unités)
content/       données de jeu (JSON) : ressources, biomes…
docs/          cahier des besoins, risques, architecture
```

Outils : TypeScript, Vite, Three.js, Vitest (tests du core), ESLint/Prettier.

## Chantiers du prototype (ordre proposé)

| #   | Chantier                                                                                                                               | Ce que le PO peut tester                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 0   | **Socle** : projet Vite+TS, lint, tests, mise en ligne d'un aperçu                                                                     | Ouvrir un lien et voir une page « Terra Factory »              |
| 1   | **Menu d'accueil** (Continuer/Nouvelle/Charger/Paramètres), i18n fr/en, bouton Quitter masqué                                          | Naviguer dans les menus, changer la langue                     |
| 2   | **Paramètres** : sons (curseurs), touches remappables, réglages par vue, image, unités                                                 | Modifier, recharger la page : tout est retenu                  |
| 3   | **Monde** : seed, chunks infinis, sol plat, ressources posées (minerais, arbres, rochers, nids)                                        | Marcher sans fin ; même seed = même monde                      |
| 4   | **Caméras** : 1ère/3ème personne/dessus, bascule en jeu, déplacement ZQSD                                                              | Changer de vue, régler FOV/sensibilité                         |
| 5   | **Édition de partie** : seed + curseurs (fréquence/taille/densité par ressource), options ennemis                                      | Créer 2 parties différentes, voir la différence                |
| 6   | **Sauvegardes** : sauvegarde manuelle/auto, dossier par partie, charger/supprimer/renommer, export/import, « Continuer » avec nom+date | Quitter, revenir, reprendre ; revenir à une vieille sauvegarde |
| 7   | **Récolte manuelle** + inventaire (poids/volume)                                                                                       | Casser un arbre/minerai, voir l'inventaire se remplir          |

Après le prototype (hors périmètre, planifié dans l'ordre) : pièces de construction (murs/sol/plafond/portes) + détection de pièces + masquage des étages/aura de transparence → machines (ports) + convoyeurs (droit/virage/montée/descente) → combustion/chaleur → fluides/pression → électricité → véhicules → technologies → ennemis/nids/pollution → saisons/biomes → multijoueur.

## Ce que le cadrage de construction impose dès le prototype

- Les objets posés (murs, machines, convoyeurs) ont : position en unités de 10 cm, orientation (pas de 90°), niveau (hauteur), type (id stable) — même si on n'en pose pas encore.
- Les modèles 3D déclarent des **ports** (machines) et des **points d'ancrage** dans leurs données, pas dans le code.
- Le rendu prévoit un système de **transparence par shader** (étages masqués, aura autour du joueur) : la caméra et les matériaux sont écrits dès le chantier 4 pour l'accepter.
- Les « pièces » sont des entités du core (liste de cases/pièces de construction), recalculées localement à chaque modification.

## Comment le PO verra le jeu

Option recommandée : **aperçu en ligne** (déploiement automatique, un simple lien, rien à installer). Le chantier 0 mettra cela en place et Claude guidera le PO pas à pas pour toute action de son côté (compte, autorisations).

## Risques identifiés

- Performance (instancing obligatoire, chunks actifs limités).
- Ampleur de la physique réaliste → par couches, curseur de réalisme.
- Licences des assets Unity (conversion glTF + vérification).
