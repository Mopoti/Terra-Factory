# Paliers, paquets de science et arbre de découvertes

Statut : règle des paquets **appliquée** (tour 234) ; arbre de découvertes **à concevoir avec le PO** (remplacera les technologies).

## Les paliers
T0 (disponible dès le départ, ou débloqué avec des ressources du début de partie), T1, T2, T3, T4, T5. Un objet appartient à un palier ; les machines ont leur palier dans leur nom (`_t1`…`_t4`).

## Un paquet de science par palier
| Paquet | Fabriqué avec des éléments du palier | Recette actuelle |
| --- | --- | --- |
| T1 `science_pack` | T0 | 2 fibres + 1 pierre + 1 bois (**provisoire**, « on en reparlera ») |
| T2 `science_pack_2` | T1 | 1 engrenage de fer + 1 fil de cuivre |
| T3 `science_pack_3` | T2 | 1 plaque d'acier + 1 tuyau de laiton |
| T4 `science_pack_4` | T3 | 1 puce de silicium + 1 câble isolé |
| T5 `science_pack_5` | T4 | 1 puce de silicium + 1 plaque d'acier + 1 uranium appauvri |

Le paquet de combat (`combat_pack`) reste à part (dépouilles des ennemis).

**Règle de coût** : un objet (ou une découverte) de palier n coûte des paquets **Tn et T(n-1)** ; palier 1 : paquets T1 seuls. Ordre de grandeur voulu par le PO : **100 à 200 paquets de chaque palier** par découverte (les technologies actuelles sont des valeurs de transition, converties une à une : même nombre de paquets du palier et du palier précédent).

## Ce qui a changé dans le jeu (tour 234)
- Cinq paquets au lieu de quatre. L'ancien « paquet de science » (engrenage + fil) est devenu le T2, l'ancien T2 le T3, etc. ; `science_pack` est maintenant le T1. Les coûts des technologies ont été convertis (`content/techs.json`).
- Les sauvegardes anciennes sont migrées (`PACK_VERSION`, `renamePacks` dans `worldChanges.ts`) : sac, machines, étude en cours, tout paquet est renommé.
- Les technologies Recherche accélèrent les paquets T1 à T4 (le T5 reste à 5 s).
- Le fichier des objets (`docs/fiches-objets.html`, `docs/arbre-objets.json`, généré par `tools/gen_fiches.py`) ne montre plus les technologies : chaque fiche affiche le **palier** de l'objet (provisoire, d'après l'ancien arbre) et les paquets qu'il demande.

## Arbre de découvertes (à concevoir)
Principe donné par le PO : on **découvre des recettes** (pas des technologies). Une découverte peut regrouper plusieurs recettes (ex. « train » : rail + locomotive). Chaque découverte exige d'avoir découvert d'autres recettes (ex. « fourneau T2 » : fourneau T1 + recette du moteur simple ; « moteur simple » : lingot de fer + plaque d'acier ; exemple fictif). On paie en paquets Tn et T(n-1). Le but : partir d'un produit final et voir **tout ce qu'il faut avoir découvert en amont**. La fenêtre Technologies et `content/techs.json` seront remplacés ; `content/discoveries.json` (vide aujourd'hui) est le point de départ.

Questions à trancher ensemble avant de coder : recette du paquet T1 ; liste des découvertes et regroupement des recettes ; coût de chacune (100 à 200 paquets) ; ce qui reste disponible sans découverte (T0) ; sort des technologies d'effets (Recherche, Navigation) ; affichage de l'arbre.
