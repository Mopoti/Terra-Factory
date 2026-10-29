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
| **Concasseur** | Concasseur, Pierre écrasée, Sable siliceux | — | 10 × Lingot de fer + 10 × Pierre |
| **Vitre** | Vitre | Concasseur | 10 × Pierre |
| **Kit circuit** | Kit circuit | Plaques de fer et de cuivre, Fil de cuivre | 10 × Lingot de cuivre |
| **Châssis simple** | Châssis simple | Plaques de fer et de cuivre, Tige de fer | 10 × Lingot de fer |
| **Électricité** | Poteau électrique | — | 15 × Lingot de fer + 10 × Lingot de cuivre |
| **Manivelle de réamorçage** | Manivelle de réamorçage | Plaques de fer et de cuivre, Engrenage, Électricité | 10 × Lingot de fer |
| **Laboratoire** | Laboratoire | Vitre, Kit circuit, Châssis simple, Électricité, Paquet de science T1 | 10 × Lingot de fer + 10 × Lingot de cuivre |
| **Paquet de science T1** | Paquet de science T1 | — | 5 × Pierre + 5 × Fibre |
| **Outil en fer** | Outil en fer | — | 10 × Lingot de fer |
| **Roue à aubes** | Roue à aubes | Fil de cuivre | 10 × Plaque de cuivre |
| **Pistolet** | Pistolet | Plaques de fer et de cuivre, Engrenage, Tige de fer | 10 × Plaque de fer |
| **Chargeur de pistolet** | Chargeur (12 balles) | Pistolet | 10 × Lingot de fer |
| **Recherche I (paquets plus vite)** | (effet : paquets plus rapides) | Laboratoire | 20 × Lingot de fer + 20 × Lingot de cuivre |

## Palier 1 : paquets T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Tapis roulant** | Tapis roulant | Laboratoire, Paquet de science T1 | 50 × Paquet de science T1 |
| **Bras robotique** | Bras robotique | Plaques de fer et de cuivre, Engrenage, Tige de fer, Laboratoire, Paquet de science T1, Tapis roulant | 100 × Paquet de science T1 |
| **Séparateur** | Séparateur | Plaques de fer et de cuivre, Tige de fer, Laboratoire, Paquet de science T1, Tapis roulant | 100 × Paquet de science T1 |
| **Groupeur** | Groupeur | Plaques de fer et de cuivre, Tige de fer, Laboratoire, Paquet de science T1, Tapis roulant | 100 × Paquet de science T1 |
| **Coffre en fer** | Coffre en fer | Plaques de fer et de cuivre, Tige de fer, Laboratoire, Paquet de science T1 | 50 × Paquet de science T1 |
| **Balise** | Balise | Fil de cuivre, Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Textile** | Tissu | Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Vêtements** | Pantalon, Bottes, Gants, Capuche, Veste | Laboratoire, Paquet de science T1, Textile | 100 × Paquet de science T1 |
| **Sac à dos** | Sac à dos | Laboratoire, Paquet de science T1, Textile | 100 × Paquet de science T1 |
| **Couchage de survie** | Duvet d'exploration | Laboratoire, Paquet de science T1, Textile | 100 × Paquet de science T1 |
| **Navigation** | Boussole | Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Tuyau** | Tuyau en cuivre | Plaques de fer et de cuivre, Laboratoire, Paquet de science T1 | 50 × Paquet de science T1 |
| **Moteur simple** | Moteur | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1 | 150 × Paquet de science T1 |
| **Pompe à eau** | Pompe à eau électrique | Tige de fer, Châssis simple, Laboratoire, Paquet de science T1, Tuyau, Moteur simple | 100 × Paquet de science T1 |
| **Buggy** | Buggy | Châssis simple, Laboratoire, Paquet de science T1, Moteur simple | 100 × Paquet de science T1 |
| **Quad** | Quad | Châssis simple, Laboratoire, Paquet de science T1, Moteur simple | 100 × Paquet de science T1 |
| **Chaudière** | Chaudière | Plaques de fer et de cuivre, Tige de fer, Laboratoire, Paquet de science T1, Tuyau | 100 × Paquet de science T1 |
| **Turbine à vapeur** | Turbine à vapeur | Engrenage, Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Chaudière | 100 × Paquet de science T1 |
| **Clôtures et portails de bois** | Clôture en bois, Portail en bois | Engrenage, Tige de fer, Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Kit de réparation** | Kit de réparation | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Lampadaire électrique** | Lampadaire électrique | Vitre, Kit circuit, Châssis simple, Électricité, Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Paquet de science T2** | Paquet de science T2 | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1 | 100 × Paquet de science T1 |
| **Armure 1** | Casque renforcé, Plastron renforcé, Jambières renforcées, Bottes renforcées | Plaques de fer et de cuivre, Laboratoire, Paquet de science T1, Pistolet, Textile, Vêtements | 100 × Paquet de science T1 + 10 × Paquet de combat |
| **Tourelle** | Tourelle légère | Engrenage, Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Chargeur de pistolet, Tapis roulant | 100 × Paquet de science T1 + 10 × Paquet de combat |

## Palier 2 : paquets T2 + T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Barrières et portails en béton** | Barrière en béton, Portail en béton | Engrenage, Tige de fer, Laboratoire, Paquet de science T1, Paquet de science T2, Bétonnière, Constructions en béton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Convertisseur Bessemer** | Convertisseur Bessemer, Lingot d'acier, Scorie | Fonte, Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Plaque d'acier** | Plaque d'acier | Estampeuse, Moule de plaque, Laboratoire, Paquet de science T1, Paquet de science T2, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tige d'acier** | Tige en acier | Estampeuse, Laboratoire, Paquet de science T1, Paquet de science T2, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Châssis renforcé** | Châssis renforcé | Laboratoire, Paquet de science T1, Paquet de science T2, Plaque d'acier, Tige d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Bétonnière** | Bétonnière, Bloc de béton | Plaques de fer et de cuivre, Engrenage, Concasseur, Laboratoire, Paquet de science T1, Paquet de science T2, Convertisseur Bessemer, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Constructions en béton** | Mur en béton, Dalle en béton, Escalier en béton, Pilier en béton | Laboratoire, Paquet de science T1, Paquet de science T2, Bétonnière | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Station de lavage** | Station de lavage (T2) | Plaques de fer et de cuivre, Engrenage, Laboratoire, Paquet de science T1, Paquet de science T2, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Minerais lavés** | Minerai de fer purifié, Minerai de cuivre purifié, Minerai de zinc purifié | Laboratoire, Paquet de science T1, Paquet de science T2, Station de lavage | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Lingot de zinc** | Lingot de zinc | Laboratoire, Paquet de science T1, Paquet de science T2, Minerais lavés | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Constructeur** | Constructeur (T2) | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1, Paquet de science T2, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Tuyau de laiton** | Tuyau de laiton (T2) | Laboratoire, Paquet de science T1, Paquet de science T2, Lingot de zinc, Constructeur | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Surpresseur** | Surpresseur (T2) | Engrenage, Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Paquet de science T2, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tour de refroidissement** | Tour de refroidissement (T2) | Plaques de fer et de cuivre, Engrenage, Laboratoire, Paquet de science T1, Paquet de science T2, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Tapis rapide** | Tapis rapide (T2) | Engrenage, Laboratoire, Paquet de science T1, Tapis roulant, Paquet de science T2, Convertisseur Bessemer | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Bras robotique électrique** | Bras robotique électrique | Engrenage, Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Bras robotique, Paquet de science T2, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Assembleur** | Assembleur | Engrenage, Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Paquet de science T2, Bras robotique électrique | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Générateur à combustible** | Générateur à combustible | Tige de fer, Châssis simple, Électricité, Laboratoire, Paquet de science T1, Turbine à vapeur, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Foreuse électrique** | Foreuse électrique | Kit circuit, Châssis simple, Laboratoire, Paquet de science T1, Moteur simple, Paquet de science T2, Générateur à combustible | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Poteau haute tension** | Poteau haute tension | Vitre, Kit circuit, Laboratoire, Paquet de science T1, Paquet de science T2, Châssis renforcé | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Disjoncteur** | Disjoncteur | Vitre, Kit circuit, Laboratoire, Paquet de science T1, Paquet de science T2, Châssis renforcé, Poteau haute tension | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Éolienne** | Éolienne | Kit circuit, Laboratoire, Paquet de science T1, Moteur simple, Paquet de science T2, Châssis renforcé | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Couchage de confort** | Lit | Laboratoire, Paquet de science T1, Textile, Couchage de survie, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Recherche II** | (effet : paquets plus rapides) | Laboratoire, Paquet de science T1, Recherche I (paquets plus vite), Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Fusil** | Fusil automatique | Plaques de fer et de cuivre, Engrenage, Fil de cuivre, Laboratoire, Paquet de science T1, Pistolet, Paquet de science T2, Plaque d'acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 + 20 × Paquet de combat |
| **Chargeur de fusil** | Chargeur de fusil (30 balles) | Laboratoire, Paquet de science T1, Paquet de science T2, Fusil | 100 × Paquet de science T2 + 100 × Paquet de science T1 + 10 × Paquet de combat |
| **Armure 2** | Casque blindé, Plastron blindé, Jambières blindées, Bottes blindées | Laboratoire, Paquet de science T1, Paquet de science T2, Armure 1, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |
| **Tourelle lourde** | Tourelle lourde | Plaques de fer et de cuivre, Engrenage, Laboratoire, Paquet de science T1, Paquet de science T2, Tourelle, Plaque d'acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 + 20 × Paquet de combat |
| **Paquet de science T3** | Paquet de science T3 | Laboratoire, Paquet de science T1, Paquet de science T2, Plaque d'acier, Tuyau de laiton | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Transformateur** | Transformateur | Fil de cuivre, Vitre, Laboratoire, Paquet de science T1, Paquet de science T2, Châssis renforcé, Poteau haute tension | 100 × Paquet de science T2 + 100 × Paquet de science T1 |

## Palier 3 : paquets T3 + T2

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Béton armé et portail motorisé** | Barrière en béton armé, Portail en béton armé (moteur) | Laboratoire, Moteur simple, Paquet de science T2, Barrières et portails en béton, Tige d'acier, Bétonnière, Paquet de science T3 | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Assembleur avancé** | Assembleur avancé (T3) | Laboratoire, Moteur simple, Paquet de science T2, Châssis renforcé, Assembleur, Paquet de science T3, Circuit avancé | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Presse lourde** | Presse hydraulique lourde (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Plaque d'acier, Tige d'acier, Constructions en béton, Constructeur, Paquet de science T3 | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Tuyau T3** | Tuyau d'acier (T3) | Laboratoire, Paquet de science T2, Convertisseur Bessemer, Paquet de science T3, Presse lourde | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Four électrique** | Four électrique (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Plaque d'acier, Tige d'acier, Paquet de science T3, Presse lourde | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Silicium brut** | Silicium brut | Concasseur, Laboratoire, Paquet de science T2, Paquet de science T3, Four électrique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Puce de silicium** | Puce en silicium | Fil de cuivre, Laboratoire, Paquet de science T2, Paquet de science T3, Silicium brut | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Remplisseuse de barils** | Remplisseuse / videuse de barils (T3), Baril vide, Baril d'eau (100 L) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Convertisseur Bessemer, Plaque d'acier, Tuyau de laiton, Surpresseur, Paquet de science T3 | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Chevalet de pompage** | Chevalet de pompage (T3) | Kit circuit, Laboratoire, Moteur simple, Paquet de science T2, Châssis renforcé, Paquet de science T3, Presse lourde | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Baril de pétrole** | Baril de pétrole (100 L) | Laboratoire, Paquet de science T2, Paquet de science T3, Remplisseuse de barils, Chevalet de pompage | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Raffinerie** | Raffinerie (T3) | Kit circuit, Laboratoire, Moteur simple, Paquet de science T2, Châssis renforcé, Bétonnière, Constructions en béton, Paquet de science T3, Chevalet de pompage | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Presse à plastique** | Presse à plastique (T3) | Kit circuit, Laboratoire, Moteur simple, Paquet de science T2, Châssis renforcé, Paquet de science T3, Raffinerie | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Isolant plastique** | Isolant en plastique | Laboratoire, Paquet de science T2, Paquet de science T3, Presse à plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Circuit avancé** | Circuit avancé | Kit circuit, Laboratoire, Paquet de science T2, Paquet de science T3, Puce de silicium | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Microcontrôleur** | Microcontrôleur | Kit circuit, Laboratoire, Paquet de science T2, Paquet de science T3, Puce de silicium, Isolant plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Câble isolé** | Câble isolé | Fil de cuivre, Laboratoire, Paquet de science T2, Paquet de science T3, Isolant plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Caoutchouc** | Caoutchouc | Laboratoire, Paquet de science T2, Paquet de science T3, Presse à plastique | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Moteur renforcé** | Moteur renforcé | Laboratoire, Moteur simple, Paquet de science T2, Plaque d'acier, Constructeur, Paquet de science T3, Caoutchouc | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Char** | Char | Laboratoire, Paquet de science T2, Plaque d'acier, Châssis renforcé, Paquet de science T3, Caoutchouc, Moteur renforcé | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Camion benne** | Camionnette | Laboratoire, Paquet de science T2, Plaque d'acier, Châssis renforcé, Paquet de science T3, Caoutchouc, Moteur renforcé | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Chemin de fer** | Rail (tuile de 2,5 m), Locomotive à vapeur, Wagon de fret, Wagon-citerne, Station | Engrenage, Laboratoire, Turbine à vapeur, Paquet de science T2, Convertisseur Bessemer, Plaque d'acier, Châssis renforcé, Paquet de science T3, Moteur renforcé | 200 × Paquet de science T3 + 200 × Paquet de science T2 |
| **Lingot d'aluminium** | Lingot d'aluminium | Laboratoire, Paquet de science T2, Paquet de science T3, Four électrique | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Plaque d'aluminium** | Plaque d'aluminium | Estampeuse, Moule de plaque, Laboratoire, Paquet de science T2, Paquet de science T3, Lingot d'aluminium | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Tige d'aluminium** | Tige d'aluminium | Estampeuse, Laboratoire, Paquet de science T2, Paquet de science T3, Lingot d'aluminium | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Châssis léger** | Châssis léger | Laboratoire, Paquet de science T2, Paquet de science T3, Plaque d'aluminium, Tige d'aluminium | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Constructions en aluminium** | Mur en aluminium, Dalle en aluminium, Escalier en aluminium, Battant de porte en aluminium (2 par porte), Pilier en aluminium | Laboratoire, Paquet de science T2, Paquet de science T3, Plaque d'aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Poteau très haute tension** | Poteau très haute tension | Laboratoire, Paquet de science T2, Poteau haute tension, Paquet de science T3, Isolant plastique, Microcontrôleur, Châssis léger | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Accumulateur** | Accumulateur | Laboratoire, Paquet de science T2, Châssis renforcé, Paquet de science T3, Isolant plastique, Microcontrôleur | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Cellule photovoltaïque** | Cellule photovoltaïque | Fil de cuivre, Vitre, Laboratoire, Paquet de science T2, Paquet de science T3, Silicium brut | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Panneau solaire** | Panneau solaire | Vitre, Laboratoire, Paquet de science T2, Paquet de science T3, Châssis léger, Cellule photovoltaïque | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Graphite** | Graphite | Laboratoire, Paquet de science T2, Paquet de science T3, Four électrique, Raffinerie | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Armure 3** | Casque composite, Plastron composite, Jambières composites, Bottes composites | Laboratoire, Textile, Paquet de science T2, Armure 2, Paquet de science T3, Isolant plastique, Plaque d'aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |
| **Exosquelette** | Exosquelette | Laboratoire, Moteur simple, Paquet de science T2, Paquet de science T3, Microcontrôleur, Châssis léger | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Porte de garage** | Porte de garage en aluminium | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Paquet de science T3, Moteur renforcé, Plaque d'aluminium, Constructions en aluminium | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Tapis T3** | Tapis express (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Convertisseur Bessemer, Tapis rapide, Paquet de science T3 | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Bras filtrant** | Bras filtrant (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Convertisseur Bessemer, Paquet de science T3, Tapis T3 | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Trieur** | Trieur (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Convertisseur Bessemer, Paquet de science T3, Bras filtrant | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Foreuse économe** | Foreuse économe (T3) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Plaque d'acier, Tige d'acier, Foreuse électrique, Paquet de science T3 | 150 × Paquet de science T3 + 150 × Paquet de science T2 |
| **Paquet de science T4** | Paquet de science T4 | Laboratoire, Paquet de science T2, Paquet de science T3, Puce de silicium, Câble isolé | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Recherche III** | (effet : paquets plus rapides) | Laboratoire, Paquet de science T2, Recherche II, Paquet de science T3 | 100 × Paquet de science T3 + 100 × Paquet de science T2 |
| **Sniper** | Fusil de précision (sniper) | Engrenage, Fil de cuivre, Laboratoire, Paquet de science T2, Plaque d'acier, Fusil, Paquet de science T3 | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |
| **Chargeur de sniper** | Chargeur de sniper (5 balles) | Laboratoire, Paquet de science T2, Paquet de science T3, Sniper | 100 × Paquet de science T3 + 100 × Paquet de science T2 + 15 × Paquet de combat |
| **Tourelle laser** | Tourelle laser | Fil de cuivre, Laboratoire, Moteur simple, Paquet de science T2, Plaque d'acier, Tourelle lourde, Paquet de science T3, Puce de silicium | 150 × Paquet de science T3 + 150 × Paquet de science T2 + 30 × Paquet de combat |

## Palier 4 : paquets T4 + T3

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Centrifugeuse** | Centrifugeuse (T4) | Kit circuit, Laboratoire, Châssis renforcé, Bétonnière, Paquet de science T3, Câble isolé, Moteur renforcé, Plaque d'aluminium, Paquet de science T4 | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Zamak** | Lingot de zamak | Laboratoire, Lingot de zinc, Paquet de science T3, Four électrique, Lingot d'aluminium, Paquet de science T4 | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Uranium enrichi** | Uranium enrichi | Laboratoire, Paquet de science T3, Paquet de science T4, Centrifugeuse | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Uranium appauvri** | Uranium appauvri (déchet) | Laboratoire, Paquet de science T3, Paquet de science T4, Centrifugeuse | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Barre d'uranium** | Barre d'uranium | Laboratoire, Plaque d'acier, Paquet de science T3, Paquet de science T4, Zamak, Uranium enrichi | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Réacteur à fission** | Réacteur à fission (T4) | Laboratoire, Châssis renforcé, Bétonnière, Paquet de science T3, Circuit avancé, Paquet de science T4, Zamak, Barre d'uranium | 250 × Paquet de science T4 + 250 × Paquet de science T3 |
| **Paquet de science T5** | Paquet de science T5 | Laboratoire, Plaque d'acier, Paquet de science T3, Puce de silicium, Paquet de science T4, Uranium appauvri | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Tour d'évaporation** | Tour d'évaporation (T4) | Engrenage, Laboratoire, Plaque d'acier, Bétonnière, Paquet de science T3, Paquet de science T4, Réacteur à fission | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Vitrificateur** | Station de vitrification (T4), Cylindre de verre contaminé | Laboratoire, Plaque d'acier, Bétonnière, Paquet de science T3, Puce de silicium, Isolant plastique, Câble isolé, Paquet de science T4, Réacteur à fission | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Armure 4** | Casque à blindage lourd, Plastron à blindage lourd, Jambières à blindage lourd, Bottes à blindage lourd | Laboratoire, Plaque d'acier, Paquet de science T3, Puce de silicium, Armure 3, Paquet de science T4 | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Tourelle plasma** | Tourelle à plasma | Laboratoire, Plaque d'acier, Paquet de science T3, Puce de silicium, Moteur renforcé, Paquet de science T4, Tourelle laser | 150 × Paquet de science T4 + 150 × Paquet de science T3 + 40 × Paquet de combat |
| **Sel de lithium** | Sel de lithium | Concasseur, Laboratoire, Paquet de science T3, Paquet de science T4, Centrifugeuse, Tour d'évaporation | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Batterie lithium** | Batterie lithium | Laboratoire, Paquet de science T3, Isolant plastique, Graphite, Paquet de science T4, Sel de lithium | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Batterie portable** | Batterie portable | Laboratoire, Paquet de science T3, Paquet de science T4, Batterie lithium, Châssis composite | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Borne de recharge** | Borne de recharge | Laboratoire, Châssis renforcé, Paquet de science T3, Isolant plastique, Microcontrôleur, Paquet de science T4, Batterie lithium | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Quad électrique** | Quad électrique | Laboratoire, Moteur simple, Quad, Paquet de science T3, Châssis léger, Paquet de science T4, Batterie lithium | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Accumulateur lithium** | Accumulateur (T3) | Laboratoire, Châssis renforcé, Paquet de science T3, Microcontrôleur, Accumulateur, Paquet de science T4, Batterie lithium | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Locomotive électrique** | Locomotive électrique | Laboratoire, Paquet de science T3, Microcontrôleur, Moteur renforcé, Chemin de fer, Paquet de science T4, Batterie lithium, Borne de recharge | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Fibre de carbone** | Fibre de carbone | Laboratoire, Paquet de science T3, Four électrique, Graphite, Paquet de science T4 | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Châssis composite** | Châssis composite | Laboratoire, Paquet de science T3, Tige d'aluminium, Paquet de science T4, Fibre de carbone | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Électrolyseur** | Électrolyseur | Laboratoire, Châssis renforcé, Paquet de science T3, Microcontrôleur, Graphite, Paquet de science T4 | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Pile à combustible** | Pile à combustible | Laboratoire, Paquet de science T3, Microcontrôleur, Graphite, Paquet de science T4, Châssis composite, Électrolyseur | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Filtre en graphite** | Filtre en graphite | Laboratoire, Paquet de science T3, Isolant plastique, Graphite, Paquet de science T4 | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Purificateur d'air** | Purificateur d'air | Laboratoire, Châssis renforcé, Paquet de science T3, Microcontrôleur, Paquet de science T4, Filtre en graphite | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Foreuse à plasma** | Foreuse à plasma | Laboratoire, Paquet de science T3, Microcontrôleur, Moteur renforcé, Foreuse économe, Paquet de science T4, Châssis composite | 200 × Paquet de science T4 + 200 × Paquet de science T3 |
| **Bras industriel** | Bras industriel | Laboratoire, Bras robotique électrique, Paquet de science T3, Circuit avancé, Moteur renforcé, Paquet de science T4, Châssis composite | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Projecteur de mur holographique** | Projecteur de mur holographique | Vitre, Laboratoire, Paquet de science T3, Microcontrôleur, Paquet de science T4, Batterie lithium | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Propulseur dorsal** | Propulseur dorsal | Laboratoire, Moteur simple, Paquet de science T3, Paquet de science T4, Batterie lithium, Châssis composite | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Vitre blindée** | Vitre blindée | Vitre, Laboratoire, Paquet de science T3, Isolant plastique, Paquet de science T4 | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Constructions blindées** | Mur blindé, Porte blindée | Laboratoire, Moteur simple, Plaque d'acier, Bétonnière, Constructions en béton, Paquet de science T3, Moteur renforcé, Paquet de science T4, Vitre blindée | 150 × Paquet de science T4 + 150 × Paquet de science T3 |
| **Wagon plateforme** | Wagon plateforme | Engrenage, Laboratoire, Plaque d'acier, Châssis renforcé, Paquet de science T3, Chemin de fer, Paquet de science T4 | 100 × Paquet de science T4 + 100 × Paquet de science T3 |
| **Recherche IV** | (effet : paquets plus rapides) | Laboratoire, Paquet de science T3, Paquet de science T4, Recherche III | 100 × Paquet de science T4 + 100 × Paquet de science T3 |

## Palier 5 : paquets T5 + T4

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Deutérium** | Deutérium | Laboratoire, Remplisseuse de barils, Paquet de science T4, Centrifugeuse, Paquet de science T5 | 200 × Paquet de science T5 + 200 × Paquet de science T4 |
| **Tritium** | Tritium | Laboratoire, Paquet de science T4, Centrifugeuse, Réacteur à fission, Paquet de science T5, Sel de lithium | 200 × Paquet de science T5 + 200 × Paquet de science T4 |
| **Compresseur d'air** | Compresseur d'air, Azote liquide | Laboratoire, Châssis renforcé, Remplisseuse de barils, Microcontrôleur, Moteur renforcé, Paquet de science T4, Centrifugeuse, Paquet de science T5 | 200 × Paquet de science T5 + 200 × Paquet de science T4 |
| **Aimant supraconducteur** | Aimant supraconducteur | Fil de cuivre, Laboratoire, Microcontrôleur, Paquet de science T4, Paquet de science T5, Compresseur d'air | 250 × Paquet de science T5 + 250 × Paquet de science T4 |
| **Capsule de fusion** | Capsule de fusion | Laboratoire, Paquet de science T4, Paquet de science T5, Châssis composite, Deutérium, Tritium | 250 × Paquet de science T5 + 250 × Paquet de science T4 |
| **Cristal quantique** | Cristal quantique | Vitre, Laboratoire, Puce de silicium, Paquet de science T4, Paquet de science T5, Aimant supraconducteur | 250 × Paquet de science T5 + 250 × Paquet de science T4 |
| **Coffre quantique** | Coffre quantique | Laboratoire, Microcontrôleur, Paquet de science T4, Paquet de science T5, Châssis composite, Cristal quantique | 300 × Paquet de science T5 + 300 × Paquet de science T4 |
| **Fabricateur universel** | Fabricateur universel | Laboratoire, Assembleur, Microcontrôleur, Paquet de science T4, Paquet de science T5, Châssis composite, Aimant supraconducteur | 300 × Paquet de science T5 + 300 × Paquet de science T4 |
| **Armure 5** | Casque nano, Plastron nano, Jambières nano, Bottes nano | Laboratoire, Microcontrôleur, Plaque d'aluminium, Paquet de science T4, Paquet de science T5, Armure 4, Fibre de carbone | 250 × Paquet de science T5 + 250 × Paquet de science T4 + 60 × Paquet de combat |
| **Tourelle à rail** | Tourelle à rail | Laboratoire, Paquet de science T4, Paquet de science T5, Tourelle plasma, Batterie lithium, Châssis composite, Wagon plateforme, Aimant supraconducteur | 300 × Paquet de science T5 + 300 × Paquet de science T4 + 60 × Paquet de combat |
| **Fusion** | Réacteur à fusion magnétique | Laboratoire, Châssis renforcé, Bétonnière, Microcontrôleur, Paquet de science T4, Zamak, Paquet de science T5, Vitrificateur, Accumulateur lithium | 300 × Paquet de science T5 + 300 × Paquet de science T4 |
| **Balise quantique** | Relais émetteur hyperfréquence, Antenne d'alignement quantique | Laboratoire, Plaque d'acier, Puce de silicium, Câble isolé, Paquet de science T4, Zamak, Paquet de science T5, Fusion | 300 × Paquet de science T5 + 300 × Paquet de science T4 |

## Notes des paliers 3 à 5

- **Paquet de science Tn** : sa recette se découvre au palier précédent (T2 au palier 1, T3 au 2, T4 au 3, T5 au 4).
- **Chemin de fer** (rail, locomotive, wagons fret et citerne, gare) : une seule découverte, au palier 3 (la locomotive demande un moteur renforcé).
- **Camion benne** : moteur renforcé (validé). **Porte de garage** : séparée de l'Aluminium, elle demande le moteur renforcé.
- **Tourelle laser** : moteur simple (recette modifiée) ; **tourelle plasma** : moteur renforcé (recette modifiée).
- **Combat** : Sniper, Tourelle laser (30 paquets de combat), Armure 4 et Tourelle plasma (40).
- **Palier 4** : l'ancien arbre découpait l'armure 4 en deux (haut / bas) et le réacteur en trois (fission, réacteur, déchets) ; l'armure 4 est ici une seule découverte.
- **Accumulateur** passe au palier 4 : sa recette demande du zamak, qui vient de la Fission (dans l'ancien arbre il était au palier 3, sans pouvoir être fabriqué).
- **Palier 5** : Fusion et Balise quantique sont les seules découvertes (demandent Déchets nucléaires et Accumulateur).

## Énergie : règles proposées (pas encore dans le jeu)

- **Trois poteaux** : bois (3 prises, 8 m, 500 kW), haute tension (4 prises, 20 m, 10 MW), très haute tension (5 prises, 40 m, 600 MW). Valeurs de départ à ajuster.
- **Prises** : un câble entre deux poteaux prend une prise à chaque bout ; **chaque machine raccordée prend aussi une prise** (validé). Un poteau en bois alimente donc 3 machines au plus, ou 2 machines et un câble vers le poteau suivant.
- **Réseau mixte** (validé) : un même réseau peut mélanger les trois poteaux ; chacun a son rôle (bois : distribution locale, haute tension : lignes moyennes, très haute tension : longues lignes et grosses centrales). Une surcharge ralentit les machines au lieu de détruire quoi que ce soit.
- **Transformateur** : relie un poteau très haute tension à un poteau d'un niveau inférieur, avec sa propre limite de puissance.
- **Compteur** (au clic sur un poteau) : graphique de production par machine productrice, graphique de consommation par machine ; un clic sur une machine de la liste en détaille la consommation. Pas d'objet à fabriquer.
- **Disjoncteur** : coupe un réseau en surcharge, se réarme avec la touche d'activation ; il prend deux prises. **Lampadaire électrique** : consomme peu, éclaire la nuit. **Quad électrique** : roule avec des batteries lithium, rechargées à la borne de recharge.
- **Éolienne** (palier 2, 2 moteurs) : puissance variable selon le vent. **Panneau solaire** (palier 3) : suit le jour et la nuit, d'où le besoin d'accumulateurs ; l'**accumulateur** passe au palier 3 (sans zamak) et la version à batteries lithium au palier 4.

## Points à confirmer

0. **Règle des recettes** (validée) : 3 types d'ingrédients au plus, 4 pour les recettes avancées. Les intermédiaires proposés (Kit circuit, Châssis simple/renforcé/léger, Vitre, Circuit avancé, Microcontrôleur) sont dans l'arbre mais **pas dans le jeu** ; seule la recette du laboratoire est montrée avec sa version proposée (3 kits circuit + 3 châssis simples + 4 vitres).
1. **Paliers 4 et 5** : regroupements et coûts (200 à 300 paquets : ils sont plus chers parce que la production de paquets T4 et T5 est plus lente).
2. Y a-t-il des objets ou machines sans découverte qu'on a oublié (la liste est contrôlée par le script : tout objet débloqué par l'ancien arbre a une case) ?
