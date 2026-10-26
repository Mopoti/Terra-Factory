# Découvertes T0 à T5 — proposition

Statut : **proposition à corriger avec le PO** (tour 235, généré par `tools/gen_decouvertes.py`). Rien n'est codé : l'arbre actuel des technologies reste en jeu.

Règles :
- Une découverte débloque **la recette** d'un objet ou d'un petit groupe d'objets proches. Le moule et son produit sont deux découvertes, comme la machine et ses variantes.
- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.
- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1. Palier 3 : paquets T3 **et** T2. Palier 4 : T4 **et** T3. Palier 5 : T5 **et** T4.
- **Armes, armures et tourelles** sont dans l'arbre : elles se paient aussi en **paquets de combat** en plus des paquets de leur palier.

Connu dès le départ, sans découverte : bois, pierre, fibre, minerais, charbon, lingots de fer et de cuivre, fourneau T1, foreuse T1, coffre en bois, outil en pierre, charrette, pièces de construction en bois et en pierre, butin des créatures.

## Palier 0 : payé en ressources

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Fonte** | Lingot de fonte | — | 10 × Lingot de fer |
| **Estampeuse** | Estampeuse | — | 10 × Lingot de fer + 10 × Pierre |
| **Moule de plaque** | Moule de plaque (fonte) | Fonte | 4 × Lingot de fonte |
| **Plaques de fer et de cuivre** | Plaque de fer, Plaque de cuivre | Estampeuse, Moule de plaque | 10 × Lingot de fer + 10 × Lingot de cuivre |
| **Moule d'engrenage** | Moule d'engrenage (fonte) | Fonte | 6 × Lingot de fonte |
| **Engrenage** | Engrenage en fer | Estampeuse, Moule d'engrenage | 10 × Lingot de fer |
| **Moule de fil** | Moule de fil (fonte) | Fonte | 4 × Lingot de fonte |
| **Fil de cuivre** | Fil de cuivre | Estampeuse, Moule de fil | 10 × Lingot de cuivre |
| **Tige de fer** | Tige en fer | Estampeuse | 10 × Lingot de fer |
| **Concasseur** | Concasseur, Pierre écrasée | — | 10 × Lingot de fer + 10 × Pierre |
| **Électricité** | Poteau électrique | — | 15 × Lingot de fer + 10 × Lingot de cuivre |
| **Manivelle de réamorçage** | Manivelle de réamorçage | Plaques de fer et de cuivre, Engrenage, Électricité | 10 × Lingot de fer |
| **Laboratoire** | Laboratoire | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Électricité | 10 × Lingot de fer + 10 × Lingot de cuivre |
| **Paquet de science T1** | Paquet de science T1 | Laboratoire | 5 × Pierre + 5 × Fibre |
| **Outil en fer** | Outil en fer | — | 10 × Lingot de fer |
| **Roue à aubes** | Roue à aubes | Fil de cuivre | 10 × Plaque de cuivre |
| **Pistolet** | Pistolet | Plaques de fer et de cuivre, Engrenage, Tige de fer | 10 × Plaque de fer |
| **Chargeur de pistolet** | Chargeur (12 balles) | Pistolet | 10 × Lingot de fer |
| **Recherche I (paquets plus vite)** | (effet : paquets plus rapides) | Laboratoire | 20 × Lingot de fer + 20 × Lingot de cuivre |

## Palier 1 : paquets T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Tapis roulant** | Tapis roulant | Paquet de science T1 | 50 × Paquet de science T1 |
| **Bras robotique** | Bras robotique | Plaques de fer et de cuivre, Engrenage, Tige de fer, Tapis roulant | 100 × Paquet de science T1 |
| **Séparateur** | Séparateur | Plaques de fer et de cuivre, Tige de fer, Tapis roulant | 100 × Paquet de science T1 |
| **Groupeur** | Groupeur | Plaques de fer et de cuivre, Tige de fer, Tapis roulant | 100 × Paquet de science T1 |
| **Coffre en fer** | Coffre en fer | Plaques de fer et de cuivre, Tige de fer, Paquet de science T1 | 50 × Paquet de science T1 |
| **Balise** | Balise | Fil de cuivre, Paquet de science T1 | 100 × Paquet de science T1 |
| **Textile** | Tissu | Paquet de science T1 | 100 × Paquet de science T1 |
| **Vêtements** | Pantalon, Bottes, Gants, Capuche, Veste | Textile | 100 × Paquet de science T1 |
| **Sac à dos** | Sac à dos | Textile | 100 × Paquet de science T1 |
| **Couchage de survie** | Duvet d'exploration | Textile | 100 × Paquet de science T1 |
| **Navigation** | Boussole | Paquet de science T1 | 100 × Paquet de science T1 |
| **Tuyau** | Tuyau en cuivre | Plaques de fer et de cuivre, Paquet de science T1 | 50 × Paquet de science T1 |
| **Moteur simple** | Moteur | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Paquet de science T1 | 150 × Paquet de science T1 |
| **Pompe à eau** | Pompe à eau électrique | Plaques de fer et de cuivre, Tige de fer, Tuyau, Moteur simple | 100 × Paquet de science T1 |
| **Buggy** | Buggy | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Moteur simple | 100 × Paquet de science T1 |
| **Quad** | Quad | Plaques de fer et de cuivre, Tige de fer, Moteur simple | 100 × Paquet de science T1 |
| **Chaudière** | Chaudière | Plaques de fer et de cuivre, Tige de fer, Tuyau | 100 × Paquet de science T1 |
| **Turbine à vapeur** | Turbine à vapeur | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Chaudière | 100 × Paquet de science T1 |
| **Paquet de science T2** | Paquet de science T2 | Engrenage, Fil de cuivre, Paquet de science T1 | 100 × Paquet de science T1 |
| **Armure 1** | Casque renforcé, Plastron renforcé, Jambières renforcées, Bottes renforcées | Plaques de fer et de cuivre, Pistolet, Textile, Vêtements | 100 × Paquet de science T1 + 10 × Paquet de combat |
| **Tourelle** | Tourelle légère | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Chargeur de pistolet, Tapis roulant | 100 × Paquet de science T1 + 10 × Paquet de combat |

## Palier 2 : paquets T2 + T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Convertisseur Bessemer** | Convertisseur Bessemer, Lingot d'acier, Scorie | Fonte, Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Plaque d'acier** | Plaque d'acier | Estampeuse, Moule de plaque, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tige d'acier** | Tige en acier | Estampeuse, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Bétonnière** | Bétonnière, Bloc de béton | Plaques de fer et de cuivre, Engrenage, Concasseur, Convertisseur Bessemer, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Constructions en béton** | Mur en béton, Dalle en béton, Escalier en béton, Pilier en béton | Bétonnière | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Station de lavage** | Station de lavage (T2) | Plaques de fer et de cuivre, Engrenage, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Minerais lavés** | Minerai de fer purifié, Minerai de cuivre purifié, Minerai de zinc purifié | Station de lavage | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Lingot de zinc** | Lingot de zinc | Minerais lavés | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Constructeur** | Constructeur (T2) | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Tuyau de laiton** | Tuyau de laiton (T2) | Lingot de zinc, Constructeur | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Surpresseur** | Surpresseur (T2) | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tour de refroidissement** | Tour de refroidissement (T2) | Plaques de fer et de cuivre, Engrenage, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tapis rapide** | Tapis rapide (T2) | Engrenage, Tapis roulant, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Bras robotique électrique** | Bras robotique électrique | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Bras robotique, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Assembleur** | Assembleur | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Bras robotique électrique | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Générateur à combustible** | Générateur à combustible | Plaques de fer et de cuivre, Engrenage, Tige de fer, Électricité, Turbine à vapeur | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Foreuse électrique** | Foreuse électrique | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Tige de fer, Générateur à combustible | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Couchage de confort** | Lit | Textile, Couchage de survie | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Recherche II** | (effet : paquets plus rapides) | Recherche I (paquets plus vite) | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Fusil** | Fusil automatique | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Pistolet, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 + 20 × Paquet de combat |
| **Chargeur de fusil** | Chargeur de fusil (30 balles) | Fusil | 100 × Paquet de science T2 + 100 × Paquet de science T1 + 10 × Paquet de combat |
| **Armure 2** | Casque blindé, Plastron blindé, Jambières blindées, Bottes blindées | Armure 1, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |
| **Tourelle lourde** | Tourelle lourde | Plaques de fer et de cuivre, Engrenage, Tourelle, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |
| **Paquet de science T3** | Paquet de science T3 | Plaque d'acier, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |

## Palier 3 : paquets T3 + T2

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Presse lourde** | Presse hydraulique lourde (T3) | Engrenage, Fil de cuivre, Plaque d'acier, Tige d'acier, Constructions en béton, Constructeur | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Tuyau T3** | Tuyau d'acier (T3) | Convertisseur Bessemer, Presse lourde | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Four électrique** | Four électrique (T3) | Engrenage, Fil de cuivre, Plaque d'acier, Tige d'acier, Presse lourde | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Silicium brut** | Silicium brut | Four électrique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Puce de silicium** | Puce en silicium | Fil de cuivre, Silicium brut | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Remplisseuse de barils** | Remplisseuse / videuse de barils (T3), Baril vide, Baril d'eau (100 L) | Engrenage, Fil de cuivre, Convertisseur Bessemer, Plaque d'acier, Tuyau de laiton, Surpresseur | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Chevalet de pompage** | Chevalet de pompage (T3) | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Moteur simple, Plaque d'acier, Tige d'acier, Presse lourde, Remplisseuse de barils | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Baril de pétrole** | Baril de pétrole (100 L) | Remplisseuse de barils, Chevalet de pompage | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Raffinerie** | Raffinerie (T3) | Engrenage, Fil de cuivre, Moteur simple, Plaque d'acier, Tige d'acier, Bétonnière, Constructions en béton, Chevalet de pompage | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Presse à plastique** | Presse à plastique (T3) | Engrenage, Fil de cuivre, Moteur simple, Plaque d'acier, Tige d'acier, Raffinerie | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Isolant plastique** | Isolant en plastique | Presse à plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Câble isolé** | Câble isolé | Fil de cuivre, Isolant plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Caoutchouc** | Caoutchouc | Presse à plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Moteur renforcé** | Moteur renforcé | Moteur simple, Plaque d'acier, Constructeur, Caoutchouc | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Char** | Char | Plaques de fer et de cuivre, Engrenage, Plaque d'acier, Tige d'acier, Caoutchouc, Moteur renforcé | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Camion benne** | Camionnette | Plaques de fer et de cuivre, Engrenage, Plaque d'acier, Tige d'acier, Caoutchouc, Moteur renforcé | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Chemin de fer** | Rail (tuile de 2,5 m), Locomotive à vapeur, Wagon de fret, Wagon-citerne, Station | Plaques de fer et de cuivre, Engrenage, Turbine à vapeur, Convertisseur Bessemer, Plaque d'acier, Tige d'acier, Moteur renforcé | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Lingot d'aluminium** | Lingot d'aluminium | Four électrique, Presse à plastique | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Plaque d'aluminium** | Plaque d'aluminium | Estampeuse, Moule de plaque, Lingot d'aluminium | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Constructions en aluminium** | Mur en aluminium, Dalle en aluminium, Escalier en aluminium, Battant de porte en aluminium (2 par porte), Pilier en aluminium | Plaque d'aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Porte de garage** | Porte de garage en aluminium | Engrenage, Fil de cuivre, Moteur renforcé, Plaque d'aluminium, Constructions en aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Tapis T3** | Tapis express (T3) | Engrenage, Fil de cuivre, Convertisseur Bessemer, Tapis rapide | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Bras filtrant** | Bras filtrant (T3) | Engrenage, Fil de cuivre, Convertisseur Bessemer, Tapis T3 | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Trieur** | Trieur (T3) | Engrenage, Fil de cuivre, Convertisseur Bessemer, Bras filtrant | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Foreuse économe** | Foreuse économe (T3) | Engrenage, Fil de cuivre, Plaque d'acier, Tige d'acier, Foreuse électrique | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Paquet de science T4** | Paquet de science T4 | Puce de silicium, Câble isolé | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Recherche III** | (effet : paquets plus rapides) | Recherche II | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Sniper** | Fusil de précision (sniper) | Engrenage, Fil de cuivre, Plaque d'acier, Fusil | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |
| **Chargeur de sniper** | Chargeur de sniper (5 balles) | Sniper | 100 × Paquet de science T3 + 100 × Paquet de science T2 + 15 × Paquet de combat |
| **Tourelle laser** | Tourelle laser | Fil de cuivre, Moteur simple, Plaque d'acier, Tourelle lourde, Puce de silicium | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |

## Palier 4 : paquets T4 + T3

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Centrifugeuse** | Centrifugeuse (T4) | Engrenage, Fil de cuivre, Plaque d'acier, Tige d'acier, Bétonnière, Câble isolé, Moteur renforcé, Constructions en aluminium | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Zamak** | Lingot de zamak | Lingot de zinc, Four électrique, Lingot d'aluminium | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Uranium enrichi** | Uranium enrichi | Centrifugeuse | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Uranium appauvri** | Uranium appauvri (déchet) | Centrifugeuse | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Barre d'uranium** | Barre d'uranium | Plaque d'acier, Zamak, Uranium enrichi | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Réacteur à fission** | Réacteur à fission (T4) | Plaque d'acier, Bétonnière, Puce de silicium, Câble isolé, Zamak, Barre d'uranium | 250 × Paquet de science T4 + 250 × Paquet de science T3 |
| **Paquet de science T5** | Paquet de science T5 | Plaque d'acier, Puce de silicium, Uranium appauvri | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Tour d'évaporation** | Tour d'évaporation (T4) | Engrenage, Plaque d'acier, Bétonnière, Réacteur à fission | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Vitrificateur** | Station de vitrification (T4), Cylindre de verre contaminé | Plaque d'acier, Bétonnière, Puce de silicium, Isolant plastique, Câble isolé, Réacteur à fission | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Armure 4** | Casque à blindage lourd, Plastron à blindage lourd, Jambières à blindage lourd, Bottes à blindage lourd | Plaque d'acier, Armure 2, Puce de silicium | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Tourelle plasma** | Tourelle à plasma | Plaque d'acier, Puce de silicium, Moteur renforcé, Tourelle laser | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Accumulateur** | Accumulateur (T3) | Plaque d'acier, Puce de silicium, Câble isolé, Zamak | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Recherche IV** | (effet : paquets plus rapides) | Recherche III | 100 × Paquet de science T4 + 100 × Paquet de science T3 |

## Palier 5 : paquets T5 + T4

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Fusion** | Réacteur à fusion magnétique | Plaque d'acier, Bétonnière, Puce de silicium, Câble isolé, Zamak, Vitrificateur, Accumulateur | 300 × Paquet de science T5 + 300 × Paquet de science T4 |
| **Balise quantique** | Relais émetteur hyperfréquence, Antenne d'alignement quantique | Plaque d'acier, Puce de silicium, Câble isolé, Zamak, Fusion | 300 × Paquet de science T5 + 300 × Paquet de science T4 |

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
