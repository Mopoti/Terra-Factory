# Discussions en cours

Deux colonnes : **mes remarques** (Claude, avec ma recommandation) et **tes remarques** (à remplir ; une phrase suffit, « ok » si tu valides ma recommandation). Je retire une ligne quand elle est réglée et je note la décision dans `passation.md`.

Mis à jour au tour 260.

## 1. Cohérence de l'arbre des découvertes

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 1.1 | Lingot d'aluminium après la presse à plastique | Le lingot d'aluminium (T3) a pour prérequis la **presse à plastique**, parce que c'est la machine de sa recette actuelle. Pas logique : l'aluminium se fond au four électrique. **Recommandation** : garder la recette au four électrique et retirer la presse à plastique des prérequis (le plastique reste nécessaire pour l'isolant). | |
| 1.2 | « Laboratoire » partout en T1 | Presque toutes les découvertes T1 listent le laboratoire comme prérequis direct, alors que la recette du paquet T1 l'implique déjà. **Recommandation** : le retirer des liens explicites, il reste dans la chaîne. | |
| 1.3 | Chaîne du pétrole trop longue | Tuyau de laiton → Surpresseur → Remplisseuse de barils → Chevalet de pompage → Raffinerie. Cinq étapes avant le plastique. **Recommandation** : sortir la remplisseuse de la chaîne (elle sert aux barils, pas au pompage). | |
| 1.4 | Convertisseur Bessemer très haut | L'acier passe avant presque tout dans l'arbre du coffre quantique (T2 en tête). Voulu ? **Recommandation** : oui, l'acier est la base des châssis renforcés ; rien à changer. | |
| 1.5 | Armures 3 et 5 sans carapace | Les armures 1, 2 et 4 demandent des carapaces (butin des ennemis) ; les armures 3 et 5 que tu as validées n'en demandent pas (aluminium, tissu, isolant ; fibre de carbone, aluminium, microcontrôleur). Les paquets de combat les paient déjà. **Recommandation** : laisser comme validé. | |
| 1.6 | Recettes à plus de 3 ou 4 types | Règle validée (3 types, 4 pour les recettes avancées). Laboratoire et accumulateur sont refaits. Il reste une dizaine de recettes à revoir avec les intermédiaires (liste dans la page réponse). | |

## 2. Objets ajoutés au tour 259 (écarts provisoires)

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 2.1 | Sel de lithium, deutérium, tritium, azote liquide | Ils sortent de la **centrifugeuse** faute de comportement pour la tour d'évaporation et le compresseur d'air. **Recommandation** : coder la tour (sel de lithium) et le compresseur (azote) avec le réseau électrique, et garder la centrifugeuse pour le deutérium et le tritium. | |
| 2.2 | Exosquelette | Il se porte à l'emplacement du pantalon et donne +40 kg de sac, rien d'autre. Faut-il aussi un bonus de vitesse de marche ? | |
| 2.3 | Propulseur dorsal | Pas ajouté : il prendrait l'emplacement du **sac à dos** et le vol n'est pas codé. Options : (a) un emplacement dédié, (b) l'intégrer au sac à dos T4, (c) abandonner. **Recommandation** : (a) avec vol plané limité par une batterie. | |
| 2.4 | Clôture et barrières | Pièces basses (1 m) : passables en sautant ? Ferment-elles une pièce pour le calcul d'intérieur ? Bloquent-elles les ennemis ? **Recommandation** : non passables, ne ferment pas une pièce, bloquent les ennemis. | |
| 2.5 | Quad électrique, locomotive électrique, wagon plateforme | Rien de codé. La locomotive demande la borne de recharge et la charge progressive que tu as validées. **Recommandation** : les faire après le réseau électrique. | |
| 2.6 | Formes provisoires | Les 33 nouveaux objets utilisent des formes voisines (tige, verre, puce…) ; les quatre châssis ont la forme du moteur. La liste des modèles à demander à la session Blender est dans `docs/objets-sans-design.md`. | |

## 3. Énergie (chantier non commencé)

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 3.1 | Par où commencer | Validé : trois poteaux (bois 3 prises / 8 m, haute tension 4 / 20 m, très haute tension 5 / 40 m), chaque machine consomme une prise, réseaux mixtes, transformateur, compteur au clic, disjoncteur, lampadaire, quad électrique. **Recommandation** : lot 1 = prises sur le poteau bois + compteur au clic ; lot 2 = poteaux HT/THT + transformateur ; lot 3 = éolienne, solaire, accumulateurs. | |
| 3.2 | Compatibilité des sauvegardes | Les poteaux existants ont un nombre de prises libre aujourd'hui. Passer à 3 prises peut casser des usines posées. **Recommandation** : appliquer la limite seulement aux poteaux posés après la mise à jour. | |

## 4. Paquets de science et laboratoire

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 4.1 | Machine de fabrication des paquets | Constructeur ou assembleur ? Quels paquets se font à la main ? Sans réponse j'ai gardé : T1 à la main, les autres à la machine. | |
| 4.2 | Recette du paquet T1 | « On va en reparler » : recette provisoire 2 fibres + 1 pierre + 1 bois. | |
| 4.3 | Visuel des paquets | Les six paquets ont la même forme, seule la couleur change. Un symbole par palier serait plus lisible. | |

## 5. Écran des découvertes en jeu

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 5.1 | Vue d'ensemble | L'arbre entier tient à l'écran mais reste illisible de loin (135 cases). **Recommandation** : zoom automatique sur la découverte choisie et ses prérequis, bouton « tout voir » pour l'ensemble. | |
| 5.2 | Téléphone | Mise en page à une colonne seulement ébauchée. | |
| 5.3 | Liste | Pas de tri ni de filtre par palier ; en rouge je ne montre que les découvertes qui ont déjà un prérequis connu. Trop restrictif ? | |
| 5.4 | Étapes déjà faites dans la fenêtre des prérequis | Dans le jeu, la fenêtre « chemin complet » devrait griser les étapes faites (en attendant, simulation par palier dans la page de test). **Recommandation** : l'ajouter à l'écran en jeu au prochain lot. | |

## 6. Projet et documents

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 6.1 | GDD | Seul fichier commun aux deux versions. **Proposition** : décrire les règles seulement (sans technique), une section à la fois, validée avec toi avant la suivante. Par laquelle commencer ? | |
| 6.2 | Unreal | Dossier `unreal/` avec le README seulement. Quel est l'objectif de l'essai (rendu, mécanique d'usine, performances) ? Je propose de commencer par une scène avec le personnage et une machine. | |
| 6.3 | Rails : grands virages | Les virages grand et géant sont retirés du tracé automatique (essai). À remettre ou à supprimer ? | |
| 6.4 | Bug « D ne prend pas la branche marron » | Impossible à reproduire sans fichier. Il me faut le rapport (bouton de rapport, 60 s d'actions). | |

## 7. Design à demander à la session Blender

| # | Sujet | Mes remarques | Tes remarques |
| --- | --- | --- | --- |
| 7.1 | Ordre des modèles | **Recommandation** : (1) modèles portés de l'équipement (aujourd'hui des boîtes), (2) visuels des paquets par palier et des moules, (3) poteaux, transformateur, panneau solaire, éolienne, (4) le reste des 59 objets prévus. | |
| 7.2 | Veste | Seul objet du jeu sans icône ni modèle. | |
