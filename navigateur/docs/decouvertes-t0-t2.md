# Découvertes T0, T1 et T2 — première proposition

Statut : **proposition à corriger avec le PO** (tour 234). Rien n'est codé : l'arbre actuel des technologies reste en jeu.

Règles utilisées :
- Une découverte débloque **les recettes** d'un ou plusieurs objets.
- Ses **prérequis** sont les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur et il n'y a pas de boucle.
- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1.
- Le coût de 100 à 200 paquets est une première idée (les technologies actuelles coûtent bien moins).

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
| **Armure 1** | Casque renforcé, Plastron renforcé, Jambières renforcées, Bottes renforcées | Métallurgie, Textile | 100 × Paquet de science T1 |
| **Convoyeur** | Tapis roulant, Bras robotique | Métallurgie, Laboratoire | 100 × Paquet de science T1 |
| **Aiguillage** | Séparateur, Groupeur | Métallurgie, Convoyeur | 100 × Paquet de science T1 |
| **Manutention** | Coffre en fer, Balise | Métallurgie, Convoyeur | 100 × Paquet de science T1 |
| **Tourelle** | Tourelle légère | Métallurgie, Convoyeur | 100 × Paquet de science T1 |
| **Textile** | Tissu, Sac à dos, Capuche | Laboratoire | 100 × Paquet de science T1 |
| **Vêtements** | Pantalon, Bottes, Gants | Textile | 100 × Paquet de science T1 |
| **Couchage** | Duvet d'exploration, Lit | Textile | 100 × Paquet de science T1 |
| **Navigation** | Boussole | Laboratoire | 100 × Paquet de science T1 |
| **Eau** | Tuyau en cuivre, Pompe à eau électrique | Métallurgie, Laboratoire, Moteur simple | 150 × Paquet de science T1 |
| **Moteur simple** | Moteur | Métallurgie, Laboratoire | 150 × Paquet de science T1 |
| **Véhicules légers** | Buggy, Quad | Métallurgie, Moteur simple | 150 × Paquet de science T1 |
| **Chaudière et turbine** | Chaudière, Turbine à vapeur | Métallurgie, Eau | 150 × Paquet de science T1 |
| **Paquet de science T2** | Paquet de science T2 | Métallurgie | 100 × Paquet de science T1 |

## Palier 2 : paquets T2 + T1

| Découverte | Débloque | Prérequis | Coût |
| --- | --- | --- | --- |
| **Acier** | Convertisseur Bessemer, Plaque d'acier | Métallurgie, Paquet de science T2 | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Béton** | Bétonnière, Bloc de béton, Mur en béton, Dalle en béton, Escalier en béton, Pilier en béton | Métallurgie, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Fabrication** | Constructeur (T2), Tuyau de laiton (T2) | Métallurgie, Acier, Lavage | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Fluides** | Surpresseur (T2), Tour de refroidissement (T2) | Métallurgie, Fabrication | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Lavage** | Station de lavage (T2), Minerai de fer purifié, Minerai de cuivre purifié, Minerai de zinc purifié, Lingot de zinc | Métallurgie, Acier | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Convoyeur rapide** | Tapis rapide (T2) | Métallurgie, Convoyeur, Acier | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Automatisation** | Bras robotique électrique, Assembleur | Métallurgie, Convoyeur, Acier | 200 × Paquet de science T2 + 200 × Paquet de science T1 |
| **Générateur à combustible** | Générateur à combustible | Métallurgie, Électricité, Chaudière et turbine | 100 × Paquet de science T2 + 100 × Paquet de science T1 |
| **Foreuse électrique** | Foreuse électrique | Métallurgie, Générateur à combustible | 150 × Paquet de science T2 + 150 × Paquet de science T1 |
| **Chemin de fer** | Rail (tuile de 2,5 m), Locomotive à vapeur, Wagon de fret, Station | Métallurgie, Chaudière et turbine, Acier | 200 × Paquet de science T2 + 200 × Paquet de science T1 |
| **Recherche II** | (effet : paquets plus rapides) | Recherche I (paquets plus vite) | 100 × Paquet de science T2 + 100 × Paquet de science T1 |

## Points à décider

1. **Armes et armures avancées** (fusil, armures 2 et 4, tourelles lourde, laser, plasma) : branche « combat » payée en paquets de combat, ou intégrée aux paliers ?
2. **Le paquet T2 est une découverte du palier 1** (sans quoi on ne pourrait pas étudier le palier 2) : d'accord ? Même idée pour chaque palier suivant.
3. **Armure 1** passe en palier 1 : elle demande du tissu, donc Textile.
4. **Zinc** : le lingot de zinc est dans « Lavage » (il se fond à partir de minerai lavé), donc « Fabrication » (tuyau de laiton) demande Lavage, et Lavage demande Acier.
5. Regroupements : Vêtements = pantalon + bottes + gants ; Couchage = duvet + lit. Convient-il ?
6. **Moteur simple** au palier 1 ou 2 (il sert à la pompe, au buggy, au quad) ? **Chemin de fer** au palier 2 (locomotive en acier) ?
7. Coûts et nombre de découvertes.
