# Chantier 8 — Pièces de construction et pièces fermées

Étape 1 de « Après le prototype » : murs, portes, sols, plafonds, détection des pièces, étages masqués. Les machines et convoyeurs viennent ensuite.

## Ce qui est fait

- **Pièces** (`content/buildings.json`, `src/core/build/`) : mur et porte sur un **bord de case**, sol et plafond sur une **case** (50 × 50 cm, 10 cm d'épaisseur). Un emplacement = une pièce. Étage 0 = rez-de-chaussée, hauteur d'un étage **2,5 m**.
- **Objets** : les pièces sont des objets du sac (`piece_wall`…), fabriqués dans l'inventaire (mur 4 pierres, porte 3 bois, sol 2 bois, plafond 2 bois) ; poser consomme 1 objet, démonter le rend (au sol si le sac est plein).
- **Pièces fermées** (`rooms.ts`) : recalculées après chaque pose/démontage. Une pièce = cases avec sol + plafond, entourées de murs/portes, avec **au moins une porte**, de **400 cases max** (100 m²). Les étages sont indépendants.
- **Mode construction** (touche B) : 1–4 choisissent la pièce, Page↑/Page↓ l'étage, clic gauche pose, X démonte, portée 6 m. Aperçu vert (posable) ou rouge. Un mur se pose sur le bord de case le plus proche du curseur / du réticule.
- **Visibilité** : au sol, les étages au-dessus du joueur sont masqués ; dans une pièce fermée, son plafond l'est aussi. En construction, on voit jusqu'à l'étage choisi. L'aura de transparence s'applique aux pièces.
- **Collisions** : les murs bloquent le joueur ; les portes laissent passer.
- Sauvegarde : `changes.pieces` (clé d'emplacement → type), validé au chargement.

## Choix par défaut (à confirmer par le PO)

1. ~~Mur = toute la hauteur~~ → remplacé (tour 15) : un mur est fait de **blocs de 50 cm** (5 par étage), voir ci-dessous.
2. Mur centré sur la ligne du bord de case (déborde de 5 cm de chaque côté, ce qui ferme les angles visuellement).
3. Porte = encadrement bois avec passage libre de 50 cm (pas encore de battant qui s'ouvre).
4. Le joueur reste au sol (pas encore d'escaliers) : on peut construire à l'étage mais pas y monter ; sols posés à 10 cm au-dessus du terrain.
5. Matériaux provisoires (pierre/bois) tant que l'artisanat n'existe pas.

## Reste à faire

Escaliers/montée, battant de porte, chauffage des pièces, pilier d'angle optionnel, copier/coller/annuler (touches déjà prévues), puis machines + convoyeurs.

## Inventaire et fabrication

30 cases, piles de 100 max (une pile de 100 n'est atteignable que pour les objets légers : les limites 50 kg / 60 L restent). Panneau « Fabrication » : tous les objets, survol = recette et quantités possédées, clic gauche = 1, clic droit = 5, s'arrête dès qu'une ressource ou la place manque. Autres raccourcis (maj, etc.) à définir plus tard.

## Matériaux, pose par glisser, murs en blocs (tour 15)

- **Matériaux** : bois et pierre (touches 5 et 6). Mur, sol, plafond existent dans les deux ; la porte n'existe qu'en bois. Chaque pièce est un objet du sac (`piece_wall_stone`, …) fabriqué dans l'inventaire : 1 pierre = 1 bloc/dalle de pierre, 1 bois = 1 bloc/dalle de bois, porte = 4 bois.
- **Sols et plafonds** : clic maintenu + glisser = rectangle de dalles. Vert = sera posé, rouge = manque de stock (ou hors de portée). Relâcher pose tout le vert. Les cases déjà occupées ne sont pas comptées.
- **Murs** : un mur est une colonne de 5 blocs de 50 cm. Clic maintenu + glisser le long d'une ligne pose la longueur voulue (même code couleur). Par défaut tout l'étage ; **Début/Fin** choisissent un seul bloc (« bloc 1 à 5 ») pour poser ou démonter à cette hauteur seulement : on fait ainsi fenêtres, trous, murs bas.
- **Démonter** : maintenir X et balayer avec le curseur ; avec un bloc sélectionné, seul ce bloc part. Les objets sont rendus.
- **Pièces fermées** : un bord compte comme fermé seulement si les 5 blocs sont présents (ou une porte). Une fenêtre sans vitre ouvre donc la pièce (le verre viendra plus tard).
- **Collision** : un bloc de mur parmi les 4 du bas arrête le joueur (1,75 m).
- Les anciennes parties sont converties (ancien mur → 5 blocs de pierre, anciens objets → pierre/bois).

### Correctif (tour 16) — murs en pan vertical

Le mur se pose comme un sol, mais dans le plan vertical : avant d'appuyer, **un seul bloc** (celui sous le curseur) est en surbrillance ; en gardant le clic, on glisse vers la largeur ET la hauteur, les blocs de 50 cm apparaissent en carreaux séparés (vert = posé, rouge = pas de stock / hors de portée). En **vue du dessus** on ne peut pas viser en hauteur : le clic simple pose un bloc au sol, le glisser pose des colonnes entières. **Début/Fin** fixent une hauteur précise (un seul rang) dans toutes les vues ; X balaie et retire le bloc visé.
