# Stations, programmation des trains et signalisation (conception)

État : **étape 1 codée** (stations + « va à la station » avec pilote automatique, voir `docs/trains.md`) ; le reste est de la conception (octobre 2026). Demande du PO : un système simple mais très modulable, « quand… alors… », réutilisable plus tard pour les signaux et l'automatisation des lignes de production. À valider avant de coder.

## 1. Idée générale : des règles « sujet – verbe – valeur → action »

Un même moteur de règles sert aux trains (maintenant) et plus tard aux signaux, portes, machines, lignes de production.

- **Condition** = _quoi_ (sujet) + _comment_ (verbe) + _combien / quel objet_ (valeur).
  - Sujet : un wagon précis (« wagon 2 »), « n wagons », « tous les wagons », « un wagon », la locomotive (combustible), le convoi, le temps, une station, plus tard un coffre, une machine, un tronçon de voie.
  - Verbe : est vide, est plein, contient (≥, ≤, =), est arrivé, est passé, a attendu, est occupé…
  - Valeur : un nombre, un objet (« minerai de fer »), une durée en secondes, un pourcentage.
  - Exemples : _« 2 wagons sont vides »_, _« le wagon 1 contient ≥ 40 minerai de fer »_, _« j'ai attendu 30 s »_, _« la locomotive a < 10 % de combustible »_.
- **Règle** = une liste de conditions (toutes / au moins une) → une **action**.
  - Actions du train : aller à la station X (itinéraire _le plus court_ ou _le plus rapide_), attendre N secondes, (plus tard) ouvrir / fermer les portes, passer à une autre règle.
- **Programme d'un convoi** = une liste de règles lue en boucle : « va à A quand (conditions) ; va à B quand (conditions) ; recommence ». Le convoi garde l'étape en cours ; il évalue les conditions de l'étape quand il est à l'arrêt à sa station (ou en roulant, pour les conditions de temps).
- Stockage : un arbre de données simple (`{ all: [...] }` / `{ any: [...] }` de feuilles `{ subject, verb, value }`) sauvegardé avec le convoi : ajouter un sujet, un verbe ou une action = ajouter une entrée dans des tables (pas de code par règle). Les noms et listes de choix de l'interface viennent de ces mêmes tables.

## 2. Stations

- Objet posé sur la voie (comme un wagon), orienté dans le sens de la voie ; **nom personnalisable** (fenêtre de renommage comme pour les coffres).
- Un quai = un point d'arrêt sur la voie (pièce, abscisse, sens) ; un convoi s'arrête quand sa **tête** (ou sa locomotive) atteint le repère. Plusieurs stations peuvent porter le même nom (groupe : le train va à la première libre, plus tard).
- Aperçu 3D simple (quai + panneau avec le nom) fait par le code en attendant un modèle Blender.

## 3. Itinéraire et pilotage automatique

- **Recherche de chemin** (Dijkstra sur le graphe de voie, états = (pièce, sens)) : coût = longueur (_plus court_) ou temps estimé (_plus rapide_ : longueur / vitesse permise, plus lente dans les virages serrés et sur la rampe). Un train ne fait pas demi-tour sur la voie ; il peut repartir en sens inverse à un cul-de-sac (butoir) si le programme l'autorise.
- **Embranchements** : le pilote prend, à chaque embranchement de son itinéraire (60 m avant), la voie du chemin le plus court (`Consist.pick`) ; il n'y a plus d'aiguillage ni de levier.
- **Conduite** : le pilote commande la poussée et le frein existants (`Control`), avec un profil de vitesse : limite en virage (racine du rayon), freinage pour s'arrêter sur le repère de la station, sans dépasser la vitesse maximale de la locomotive. Il demande du combustible (alerte) quand la soute est vide.
- Un convoi sous programme peut être repris à la main (monter dans la locomotive suspend le programme).

## 4. Chargement des wagons (préalable aux conditions « vide / plein »)

Aujourd'hui les wagons n'ont pas de contenu. À prévoir : coffre du wagon de fret (cases comme un coffre, remplissage à la main depuis le sac par une fenêtre, plus tard par des machines à la station) et réservoir de la citerne (fluides). Les conditions « vide / plein / contient » lisent ces contenus.

## 5. Signalisation (plus tard)

- Signaux lumineux simplifiés (rouge / vert) et **détecteurs de présence** sur un tronçon : modèles 3D simples (mât + feu coloré) que le code peut dessiner sans Blender ; ils utilisent le même moteur de règles (« si le tronçon est occupé → rouge »).
- Le pilote automatique respecte les signaux qu'il rencontre (arrêt au rouge, reprise au vert) ; réservation de tronçons (cantons) pour éviter les collisions.

## 6. Repères de tracé (formes régulières)

- Les virages sont des quarts de cercle de 90° (rayons 6,25 / 8,75 / 13,75 / 18,75 m). Un rond-point = 4 virages bout à bout.
- Pendant le tracé, une ligne d'infos donne le nombre de rails, la longueur et les virages (angle, rayon).
- À décider : ajouter des virages de **45°** (et 22,5°) de mêmes rayons pour pouvoir faire des ronds-points à 8 pans, des changements de direction doux et des raccordements en diagonale (nouveaux modèles et nouvelle grille d'angles).

## 7. Ordre de travail proposé (le PO a choisi de commencer par l'étape 1 ; virages de 45° à part, voir §6)

1. (fait) Stations (pose, nom, repère d'arrêt) + pilotage automatique « va à la station X » (plus court) avec réglage des aiguillages et arrêt précis.
2. (fait) Programme en boucle (liste d'étapes) avec la condition de temps (« attendre N s ») + fenêtre de programmation.
3. (fait) Contenu des wagons (coffre, citerne) + conditions « vide / plein / contient ».
4. (en grande partie fait : sujets wagons / locomotive / temps, et / ou) Reste : choix « plus court / plus rapide », autres sujets (station, coffre, machine, tronçon de voie).
5. Signaux et détecteurs, puis réutilisation du moteur pour les lignes de production.
