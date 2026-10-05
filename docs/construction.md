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

### Règle de soutien (tour 17)

Un bloc de mur ne se pose pas dans le vide : il doit être **posé au sol** (bloc du bas au rez-de-chaussée), **sur un sol d'étage** ou sur le mur de l'étage du dessous, ou **accolé à un bloc existant** (au-dessus, en dessous, à côté, ou dans l'angle d'un mur perpendiculaire) — ce qui permet les encadrements de fenêtres. Dans un tracé, un bloc peut s'appuyer sur un autre du même tracé ; les blocs qui flotteraient sont rouges. Retirer un bloc plus tard est libre (c'est ce qui fait les fenêtres) : les blocs restent tant qu'on ne les démonte pas.

### Tour 18 — visée, hauteur, jours entre blocs, démolition

- **Visée assistée** (`core/build/aim.ts`) : le curseur suit le rayon et « colle » au premier bloc de mur réellement posable (au sol, ou accolé à un mur existant). Le bloc du bas est toujours calé au niveau du sol ; on n'a plus à viser précisément en l'air. Si rien n'est touché, retombée sur le bloc du bas du bord le plus proche.
- **Hauteur** : un clic simple = 1 bloc ; en 1ère/3ème personne, glisser trace un pan largeur × hauteur (la hauteur jusqu'au bloc visé) ; si le rayon ne coupe pas le plan du mur, on reste sur la hauteur de départ (plus de mur géant d'un coup). En vue du dessus : **Début / Fin** règlent la hauteur (1 à 5 blocs, 50 cm chacun), 1 par défaut.
- **Plus de jour** entre les blocs : ils font exactement 50 cm (seul le bloc du haut garde 1 cm de retrait sous le plafond).
- **Démolition** (X maintenu) : vise les blocs existants un par un et rend les **ressources de fabrication** (pierre, bois), pas la pièce ; ce qui ne tient pas dans le sac tombe au sol.
- À préciser avec le PO : « blocs de 10 × 10 cm » (pas de 10 cm en hauteur/largeur de mur ?) — voir question posée.

### Tour 19 — plafonds accrochés aux murs, bande grise

- **Plafonds** : même geste que les sols (glisser un rectangle, vert/rouge), mais une dalle doit **s'accrocher au bloc du haut d'un mur** (ou d'une porte) sur l'un de ses 4 bords, ou **prolonger une dalle déjà posée**, sans dépasser **3 cases** d'un mur porteur (`MAX_CEILING_SPAN`). Les dalles hors de ces limites sont rouges ; un mur trop bas ne porte rien.
- **Bande grise près des murs** : c'étaient des ombres en escalier que les blocs projetaient sur eux-mêmes ; les blocs ne reçoivent plus d'ombre et le biais d'ombre du soleil est augmenté (`normalBias`). Les blocs continuent de projeter leur ombre au sol.

### Tour 20 — viser un plafond depuis la face ou la tranche d'un mur

La visée d'un plafond (`aimCeiling`) suit le rayon dans la bande de hauteur du haut des murs : viser la face ou la tranche du bloc du haut accroche la dalle du côté de l'œil, même si le rayon traverserait le plan du plafond derrière le mur. Sans mur à portée, retombée sur la case du plan du plafond (rouge si elle ne tient pas). Le bloc du haut du mur (bloc 5) doit exister.

### Tour 21 — plafond sur n'importe quelle hauteur de mur

Le plafond n'est plus forcément à 2,50 m : une dalle se pose **sur la tranche haute d'un mur, à la hauteur de ce mur**, même s'il ne fait qu'un bloc de haut (clé `c:étage:gx,gz:bloc`). Seule condition : le bloc visé est le dernier de la colonne (la dalle ne traverse pas un bloc au-dessus). Une dalle par case ; le glisser prolonge dans le même plan (3 cases max depuis un mur). Les pièces fermées demandent un plafond posé sur le bloc du haut (bloc 5). Anciennes sauvegardes : les plafonds sont convertis au bloc du haut.

### Tour 22 — saut et marche sur les constructions

- **Saut** (touche « Sauter », Espace par défaut) : apex ≈ 1,1 m, soit 2 blocs de mur de 50 cm. Gravité simple (`core/game/physics.ts`, testé).
- Le joueur se tient sur le **sol du terrain, une dalle de sol (marche de 10 cm montée sans sauter), la tranche d'un mur ou le dessus d'une dalle de plafond**. Il tombe en quittant un bord. Les murs bloquent à hauteur du corps (un mur de plus de 35 cm ne se monte qu'en sautant), et la tête cogne le dessous d'un plafond.
- La hauteur des pieds est affichée dans le panneau de debug (`display.showDebug`), la caméra suit, et la hauteur est enregistrée dans la sauvegarde (`PlayerState.y`).
- Limites actuelles : un mur de 2,5 m ne peut pas être escaladé (il faudra des escaliers/échelles) ; il n'y a pas encore de dégâts de chute ; les arbres et rochers restent infranchissables même en sautant.
- Rendu : la dalle de plafond dépasse de 5 mm le haut du bloc de mur qui la porte pour éviter que deux faces se confondent à l'écran.

### Tour 23 — jointure plafond/mur « d'un seul bloc »

La dalle de plafond recouvre maintenant la tranche du mur qui la porte (elle déborde de la demi-épaisseur du mur, +2 mm, quand la dalle voisine ne recouvre pas l'autre moitié) et ne dépasse le haut du mur que de 3 mm : dessus continu, plus de marche ni de bande de mur visible à côté de la dalle. Le bloc du haut du mur n'est plus rogné de 1 cm.

### Tour 24 — dessous des dalles

Les dalles, blocs de mur et portes sont maintenant fermés par le **dessous** (`MeshBuilder.box(..., bottom)`) : vu d'en bas, un plafond ou un bloc en hauteur n'est plus transparent (on voyait le ciel à travers).

### Tour 25 — barre de raccourcis, orientation (R)

- **Plus de menu B.** Une **barre de raccourcis** de 9 cases est affichée en bas de l'écran (`src/ui/hotbar.ts`). Cliquer une case, ou la touche 1 à 9 (réglable), la sélectionne ; si elle contient une pièce (mur, porte, sol, plafond en bois/pierre) on passe en pose avec cette pièce, sinon rien ; même case de nouveau = on range. Les matériaux ne sont plus des touches : chaque matériau est un objet, donc une case.
- **Remplir la barre** : fabriquer une pièce la range dans la première case libre ; on peut aussi glisser un objet du sac ou du panneau de fabrication sur une case, ou le choisir dans le sac puis cliquer une case. Clic droit sur une case : la vider. La barre est enregistrée avec la partie (`changes.hotbar`).
- **Orientation (R)** : tourne la pièce de 90° à chaque pression, pour tous les éléments. Pour un mur ou une porte, orientation paire = le long de x, impaire = le long de z : la visée ne cherche que les bords de cet axe (ce qui évite que le mur « se bloque » sur le mauvais bord). L'orientation (0 à 3) est enregistrée avec la pièce (`changes.rotations`) pour les futurs habillages (sens d'ouverture d'une porte, face d'un mur…).
- Touches : `buildMode` (B) supprimée ; `rotate` (R), `remove` (X), étage, hauteur de mur inchangées.

### Tour 26 — poser contre le mur visé (3ème personne)

Quand le rayon de visée touche un bloc de mur existant, on pose **contre ce bloc** (et non au sol derrière lui) : le côté visé du bloc décide — haut → bloc au-dessus, bas → en dessous, bords gauche/droite → voisin dans la ligne ; si l'orientation imposée avec R est perpendiculaire au mur visé, un bloc d'angle est posé au bout le plus proche (du côté de l'œil). Un bloc de sol posable juste devant le mur (moins de 0,8 m avant le point touché) ne l'emporte plus sur le mur visé.
