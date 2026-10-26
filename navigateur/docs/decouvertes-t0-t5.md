# Découvertes T0 à T5 — proposition

Statut : **proposition à corriger avec le PO** (tour 235, généré par `tools/gen_decouvertes.py`). Rien n'est codé : l'arbre actuel des technologies reste en jeu.

Règles :
- Une découverte débloque **les recettes** d'un ou plusieurs objets (une seule est possible).
- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.
- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1. Palier 3 : paquets T3 **et** T2. Palier 4 : T4 **et** T3. Palier 5 : T5 **et** T4.
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
| **Paquet de science T3** | Paquet de science T3 | Acier, Fabrication | 100 × Paquet de science T2 + 100 × Paquet de science T1 |

## Palier 3 : paquets T3 + T2

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Presse lourde** | Presse hydraulique lourde (T3), Tuyau d'acier (T3) | Métallurgie, Acier, Béton, Fabrication | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Silicium** | Four électrique (T3), Silicium brut, Puce en silicium | Métallurgie, Acier, Presse lourde | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Barils** | Remplisseuse / videuse de barils (T3), Baril vide | Métallurgie, Chaudière et turbine, Acier, Fluides | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Pétrole** | Chevalet de pompage (T3), Baril de pétrole (100 L) | Métallurgie, Moteur simple, Acier, Presse lourde, Barils | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Plastique et caoutchouc** | Raffinerie (T3), Presse à plastique (T3), Isolant en plastique, Câble isolé, Caoutchouc | Métallurgie, Moteur simple, Acier, Béton, Silicium, Pétrole | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Moteur renforcé** | Moteur renforcé | Moteur simple, Acier, Fabrication, Plastique et caoutchouc | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Véhicules lourds** | Char, Camionnette | Métallurgie, Acier, Plastique et caoutchouc, Moteur renforcé | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Chemin de fer** | Rail (tuile de 2,5 m), Locomotive à vapeur, Wagon de fret, Wagon-citerne, Station | Métallurgie, Chaudière et turbine, Acier, Moteur renforcé | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Aluminium** | Lingot d'aluminium, Plaque d'aluminium, Mur en aluminium, Dalle en aluminium, Escalier en aluminium, Battant de porte en aluminium (2 par porte), Pilier en aluminium | Métallurgie, Silicium, Plastique et caoutchouc | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Porte de garage** | Porte de garage en aluminium | Métallurgie, Moteur renforcé, Aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Convoyeur T3** | Tapis express (T3), Bras filtrant (T3) | Métallurgie, Convoyeur rapide | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Trieur** | Trieur (T3) | Métallurgie, Convoyeur T3 | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Foreuse économe** | Foreuse économe (T3) | Métallurgie, Acier, Foreuse électrique | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Paquet de science T4** | Paquet de science T4 | Silicium, Plastique et caoutchouc | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Recherche III** | (effet : paquets plus rapides) | Recherche II | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Sniper** | Fusil de précision (sniper), Chargeur de sniper (5 balles) | Métallurgie, Acier, Fusil | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |
| **Tourelle laser** | Tourelle laser | Métallurgie, Moteur simple, Acier, Tourelle lourde, Silicium | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |

## Palier 4 : paquets T4 + T3

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Fission** | Centrifugeuse (T4), Lingot de zamak, Uranium enrichi, Uranium appauvri (déchet), Barre d'uranium | Métallurgie, Acier, Béton, Lavage, Silicium, Plastique et caoutchouc, Moteur renforcé, Aluminium | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Réacteur à fission** | Réacteur à fission (T4) | Acier, Béton, Silicium, Plastique et caoutchouc, Fission | 250 × Paquet de science T4 + 250 × Paquet de science T3 |
| **Paquet de science T5** | Paquet de science T5 | Acier, Silicium, Fission | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Déchets nucléaires** | Tour d'évaporation (T4), Station de vitrification (T4), Cylindre de verre contaminé | Métallurgie, Acier, Béton, Silicium, Plastique et caoutchouc, Réacteur à fission | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Armure 4** | Casque à blindage lourd, Plastron à blindage lourd, Jambières à blindage lourd, Bottes à blindage lourd | Acier, Armure 2, Silicium | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Tourelle plasma** | Tourelle à plasma | Acier, Silicium, Moteur renforcé, Tourelle laser | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Accumulateur** | Accumulateur (T3) | Acier, Silicium, Plastique et caoutchouc, Fission | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Recherche IV** | (effet : paquets plus rapides) | Recherche III | 100 × Paquet de science T4 + 100 × Paquet de science T3 |

## Palier 5 : paquets T5 + T4

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Fusion** | Réacteur à fusion magnétique | Acier, Béton, Silicium, Plastique et caoutchouc, Fission, Déchets nucléaires, Accumulateur | 300 × Paquet de science T5 + 300 × Paquet de science T4 |
| **Balise quantique** | Relais émetteur hyperfréquence, Antenne d'alignement quantique | Acier, Silicium, Plastique et caoutchouc, Fission, Fusion | 300 × Paquet de science T5 + 300 × Paquet de science T4 |

## Notes des paliers 3 à 5

- **Paquet de science Tn** : sa recette se découvre au palier précédent (T2 au palier 1, T3 au 2, T4 au 3, T5 au 4).
- **Chemin de fer** (rail, locomotive, wagons fret et citerne, gare) : une seule découverte, au palier 3 (la locomotive demande un moteur renforcé).
- **Camion benne** : moteur renforcé (validé). **Porte de garage** : séparée de l'Aluminium, elle demande le moteur renforcé.
- **Tourelle laser** : moteur simple (recette modifiée) ; **tourelle plasma** : moteur renforcé (recette modifiée).
- **Combat** : Sniper, Tourelle laser (30 paquets de combat), Armure 4 et Tourelle plasma (40).
- **Palier 4** : l'ancien arbre découpait l'armure 4 en deux (haut / bas) et le réacteur en trois (fission, réacteur, déchets) ; l'armure 4 est ici une seule découverte.
- **Accumulateur** passe au palier 4 : sa recette demande du zamak, qui vient de la Fission (dans l'ancien arbre il était au palier 3, sans pouvoir être fabriqué).
- **Palier 5** : Fusion et Balise quantique sont les seules découvertes (demandent Déchets nucléaires et Accumulateur).

## Points à confirmer

1. **Paliers 4 et 5** : regroupements et coûts (200 à 300 paquets : ils sont plus chers parce que la production de paquets T4 et T5 est plus lente).
2. Y a-t-il des objets ou machines sans découverte qu'on a oublié (la liste est contrôlée par le script : tout objet débloqué par l'ancien arbre a une case) ?
