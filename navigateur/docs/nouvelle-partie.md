# Écran de création d'une nouvelle partie

Fenêtre large : à gauche les réglages (défilement), à droite l'aperçu du monde (carré de 512 m), la légende et **les boutons « Créer et lancer », « Réinitialiser les réglages du monde » et « Retour »** (toujours visibles sous la carte).

## En haut : le monde

- Nom, **seed** (bouton « mélanger »), puis **Mode de jeu** (cartes Survie / Créatif) et **Accès** (Privée / Publique, avec mot de passe facultatif pour une partie publique).

## Onglet Minerais

Tableau : une ligne par gisement (hématite, malachite, charbon, sable, pierre, sphalérite, bauxite, pétrole, uraninite) × trois curseurs **Fréquence** (nombre de gisements), **Taille** (étendue), **Densité** (minerai par case), de ×0,25 à ×3, et la colonne **Apparition** (distance minimale du départ). En dessous : le **ratio de distance** (filons lointains plus massifs mais espacés).

Tous les minerais se génèrent (test `worldgen.test.ts`), mais certains seulement loin du départ : sphalérite et bauxite à partir de **300 m**, pétrole **500 m**, uraninite **1 200 m**. L'aperçu (256 m de rayon) et la carte du jeu (224 m autour du joueur) ne les montrent donc pas près du départ.

## Onglet Environnement

- Tableau Nature : arbres, buisson de fibres, rochers, étangs, nids (mêmes trois curseurs). **×1 = peu de rochers** (couverture des affleurements réduite d'environ moitié par rapport aux anciennes parties).
- **Ennemis** : agressifs, colonies qui s'étendent, **vitesse d'expansion** (×0,25 à ×4 : pollution nécessaire pour fonder un nid), **sensibilité à la pollution** (×0,25 à ×4 : pollution par ennemi fabriqué), **ennemis maximum** (0 à 100, 25 par défaut), **gardiens par nid** (0 à 8, 3 par défaut).

## Onglet Jouabilité

- **Quantités demandées** (×0,25 à ×4) : paquets de science des recherches, objets des recherches manuelles, ingrédients de la fabrication à la main. Jamais moins de 1 de chaque ; arrondi au plus proche. Les recettes des machines (fourneau, assembleur…) ne changent pas.
- **Taille de la zone sûre** (50 à 1 000 m) : aucun nid ennemi dans ce rayon ; elle règle aussi le cercle blanc de l'aperçu.
- Réalisme de la physique, **jour / nuit / durée des saisons** et le **camembert** des saisons, tutoriel, multijoueur (partage des technologies et des crédits).

## Info-bulles

- **Aperçu** : au survol, le nom de la ressource (minerai, rocher, nid, étang ; pas les arbres).
- **Carte du jeu** : même chose, et pour un minerai **la quantité totale restante du filon** (les cases voisines du même minerai, `src/core/world/deposits.ts`).

## Données

`WorldParams` : `resources` (réglages par ressource, multipliés par ceux de la famille), `safeZoneM`. `GameOptions` : `enemies` (+ 4 réglages), `difficulty`. Les anciennes sauvegardes reprennent les valeurs par défaut (monde identique, sauf la couverture des rochers).
