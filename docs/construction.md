# Chantier 8 — Pièces de construction et pièces fermées

Étape 1 de « Après le prototype » : murs, portes, sols, plafonds, détection des pièces, étages masqués. Les machines et convoyeurs viennent ensuite.

## Ce qui est fait

- **Pièces** (`content/buildings.json`, `src/core/build/`) : mur et porte sur un **bord de case**, sol et plafond sur une **case** (50 × 50 cm, 10 cm d'épaisseur). Un emplacement = une pièce. Étage 0 = rez-de-chaussée, hauteur d'un étage **2,5 m**.
- **Coûts** (rendus à 100 % au démontage) : mur 4 pierres, porte 3 bois, sol 2 bois, plafond 2 bois. Le sac plein laisse le surplus au sol.
- **Pièces fermées** (`rooms.ts`) : recalculées après chaque pose/démontage. Une pièce = cases avec sol + plafond, entourées de murs/portes, avec **au moins une porte**, de **400 cases max** (100 m²). Les étages sont indépendants.
- **Mode construction** (touche B) : 1–4 choisissent la pièce, Page↑/Page↓ l'étage, clic gauche pose, X démonte, portée 6 m. Aperçu vert (posable) ou rouge. Un mur se pose sur le bord de case le plus proche du curseur / du réticule.
- **Visibilité** : au sol, les étages au-dessus du joueur sont masqués ; dans une pièce fermée, son plafond l'est aussi. En construction, on voit jusqu'à l'étage choisi. L'aura de transparence s'applique aux pièces.
- **Collisions** : les murs bloquent le joueur ; les portes laissent passer.
- Sauvegarde : `changes.pieces` (clé d'emplacement → type), validé au chargement.

## Choix par défaut (à confirmer par le PO)

1. Mur = **toute la hauteur d'un étage** d'un seul geste (pas 5 blocs de 50 cm empilés).
2. Mur centré sur la ligne du bord de case (déborde de 5 cm de chaque côté, ce qui ferme les angles visuellement).
3. Porte = encadrement bois avec passage libre de 40 cm (pas encore de battant qui s'ouvre).
4. Le joueur reste au sol (pas encore d'escaliers) : on peut construire à l'étage mais pas y monter ; sols posés à 10 cm au-dessus du terrain.
5. Matériaux provisoires (pierre/bois) tant que l'artisanat n'existe pas.

## Reste à faire

Escaliers/montée, battant de porte, chauffage des pièces, pilier d'angle optionnel, copier/coller/annuler (touches déjà prévues), puis machines + convoyeurs.
