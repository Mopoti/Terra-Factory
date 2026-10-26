# Découvertes T0, T1 et T2 — proposition

Statut : **proposition à corriger avec le PO** (tour 235, généré par `tools/gen_decouvertes.py`). Rien n'est codé : l'arbre actuel des technologies reste en jeu.

Règles :
- Une découverte débloque **les recettes** d'un ou plusieurs objets (une seule est possible).
- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.
- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1.
- **Armes, armures et tourelles** sont dans l'arbre : elles se paient aussi en **paquets de combat** en plus des paquets de leur palier.

Connu dès le départ, sans découverte : bois, pierre, fibre, minerais, fourneau T1, foreuse T1, coffre en bois, outil en pierre, charrette, pièces de construction en bois et en pierre, moules, lingots, fonte.

## Palier 0 : payé en ressources

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Métallurgie** | Estampeuse, Concasseur, Plaque de fer, Plaque de cuivre, Engrenage en fer, Fil de cuivre, Tige en fer | — | 20 × Lingot de fer + 10 × Pierre |
| **Électricité** | Poteau électrique, Manivelle de réamorçage | Métallurgie | 15 × Lingot de fer + 10 × Lingot de cuivre |
| **Laboratoire** | Laboratoire, Paquet de science T1 | Métallurgie, Électricité | 10 × Lingot de fer + 10 × Lingot de cuivre |
| **Outil en fer** | Outil en fer | — | 10 × Lingot de fer |
| **Roue à aubes** | Roue à aubes | Métallurgie | 10 × Plaque de cuivre |
| **Pistolet** | Pistolet, Chargeur (12 balles) | Métallurgie | 10 × Plaque de fer |
| **Recherche I (paquets plus vite)** | (effet : paquets plus rapides) | Laboratoire | 20 × Lingot de fer + 20 × Lingot de cuivre |

## Palier 1 : paquets T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Convoyeur** | Tapis roulant, Bras robotique | Métallurgie, Laboratoire | 100 × Paquet de science T1 |
| **Aiguillage** | Séparateur, Groupeur | Métallurgie, Convoyeur | 100 × Paquet de science T1 |
| **Manutention** | Coffre en fer, Balise | Métallurgie, Convoyeur | 100 × Paquet de science T1 |
| **Textile** | Tissu | Laboratoire | 100 × Paquet de science T1 |
| **Vêtements** | Pantalon, Bottes, Gants, Capuche, Veste | Textile | 100 × Paquet de science T1 |
| **Sac à dos** | Sac à dos | Textile | 100 × Paquet de science T1 |
| **Couchage de survie** | Duvet d'exploration | Textile | 100 × Paquet de science T1 |
| **Navigation** | Boussole | Laboratoire | 100 × Paquet de science T1 |
| **Eau** | Tuyau en cuivre, Pompe à eau électrique | Métallurgie, Laboratoire, Moteur simple | 150 × Paquet de science T1 |
| **Moteur simple** | Moteur | Métallurgie, Laboratoire | 150 × Paquet de science T1 |
| **Véhicules légers** | Buggy, Quad | Métallurgie, Moteur simple | 150 × Paquet de science T1 |
| **Chaudière et turbine** | Chaudière, Turbine à vapeur | Métallurgie, Eau | 150 × Paquet de science T1 |
| **Paquet de science T2** | Paquet de science T2 | Métallurgie | 100 × Paquet de science T1 |
| **Armure 1** | Casque renforcé, Plastron renforcé, Jambières renforcées, Bottes renforcées | Métallurgie, Pistolet, Textile, Vêtements | 100 × Paquet de science T1 + 10 × Paquet de combat |
| **Tourelle** | Tourelle légère | Métallurgie, Pistolet, Convoyeur | 100 × Paquet de science T1 + 10 × Paquet de combat |

## Palier 2 : paquets T2 + T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Acier** | Convertisseur Bessemer, Plaque d'acier | Métallurgie, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Béton** | Bétonnière, Bloc de béton, Mur en béton, Dalle en béton, Escalier en béton, Pilier en béton | Métallurgie, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Lavage** | Station de lavage (T2), Minerai de fer purifié, Minerai de cuivre purifié, Minerai de zinc purifié, Lingot de zinc | Métallurgie, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Fabrication** | Constructeur (T2), Tuyau de laiton (T2) | Métallurgie, Acier, Lavage | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Fluides** | Surpresseur (T2), Tour de refroidissement (T2) | Métallurgie, Fabrication | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Convoyeur rapide** | Tapis rapide (T2) | Métallurgie, Convoyeur, Acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Automatisation** | Bras robotique électrique, Assembleur | Métallurgie, Convoyeur, Acier | 200 × Paquet de science T2 + 200 × Paquet de science T1 |
| **Générateur à combustible** | Générateur à combustible | Métallurgie, Électricité, Chaudière et turbine | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Foreuse électrique** | Foreuse électrique | Métallurgie, Générateur à combustible | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Couchage de confort** | Lit | Textile, Couchage de survie | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Recherche II** | (effet : paquets plus rapides) | Recherche I (paquets plus vite) | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Fusil** | Fusil automatique, Chargeur de fusil (30 balles) | Métallurgie, Pistolet, Acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 + 20 × Paquet de combat |
| **Armure 2** | Casque blindé, Plastron blindé, Jambières blindées, Bottes blindées | Armure 1, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |
| **Tourelle lourde** | Tourelle lourde | Métallurgie, Tourelle, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |

## Annoncé pour le palier 3 (à voir ensuite)

- **Moteur renforcé** : il se fabrique avec du caoutchouc (presse à plastique, palier 3) ; la **locomotive** en a besoin. Le **chemin de fer** reste une seule découverte (rail, locomotive, wagons, gare) et passe donc au palier 3, et non 2.
- **Tourelle laser** : sa recette demande maintenant 1 moteur simple ; **tourelle plasma** : 1 moteur renforcé (fait au tour 236). Leurs découvertes dépendront donc des moteurs.

## Points à confirmer

1. **Moteur simple** laissé au palier 1 (il sert à la pompe, au buggy, au quad ; sinon la vapeur passerait au palier 2). Dites-moi si vous préférez le palier 2.
2. **Vêtements** = pantalon, bottes, gants, capuche et **veste** (nouvel objet : tissu, emplacement tronc, cosmétique, en attendant son modèle 3D) ; **Sac à dos** est une découverte à part (emplacement dos) ; **Textile** = le tissu seul.
3. **Paquets de combat** : 10 au palier 1, 20 au palier 2 (valeurs de départ ; ils viennent des dépouilles des ennemis).
4. **Coûts** (100 à 200 paquets) : pas de réponse au point 5, je les garde tels quels.
