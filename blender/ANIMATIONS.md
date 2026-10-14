# Animations des modèles maison (à brancher dans le code du jeu)

Les modèles Blender sont prêts pour l'animation : chaque groupe de pièces mobiles est **séparé** du reste et repérable par
son **nom**, et un **pivot** dit au jeu autour de quoi il tourne. **Le code du jeu ne gère pas encore ces animations** (seules
les flammes du fourneau T1 bougent, via `ANIMATED_MESHES` dans `src/render/models.ts`). Ce document liste ce qui doit bouger.

## Convention

- **Groupe** : toutes les pièces dont le nom commence par `<groupe>_` bougent ensemble (ex. `balancier_poutre`,
  `balancier_tete`, `balancier_jaune`…). Tout le reste est fixe.
- **Pivot** : un objet vide `pivot_<groupe>` (sans maillage, ignoré par `bake()`), exporté comme nœud du `.glb`.
  Sa **position** est le centre de rotation ; son **axe Z local dans Blender** est l'axe de rotation (dans le `.glb`,
  axe **Y local** du nœud, à cause du passage en Y haut).
- **Repères** : coordonnées ci-dessous en unités Blender, modèle posé au sol (après `T.poser_au_sol`) (1 = 1 case = 50 cm, Z haut, avant = −Y). Dans le `.glb` / three.js :
  `(x, y, z)` Blender → `(x × 0,5 ; z × 0,5 ; −y × 0,5)` mètres. L'axe X est le même dans les deux.
- Côté code, il faudra : sortir ces groupes du maillage fusionné (comme les flammes), lire les nœuds `pivot_*` au
  chargement, puis faire tourner / déplacer chaque groupe autour de son pivot quand la machine est en marche
  (`factory.status(m) === 'running'`), en tenant compte de la rotation et de l'échelle de la machine.

## Foreuses

| Modèle | Groupe | Mouvement | Pivot (Blender) | Axe |
|---|---|---|---|---|
| `foreuse_t1` | `foret_` (foret, mandrin, table rotative) | tourne en continu | `pivot_foret` (0 ; −0,35 ; 0,8) | vertical |
| `foreuse_t1` | `volant_` (jante, moyeu, rayons) | tourne en continu | `pivot_volant` (−1,5 ; 1,2 ; 0,85) | X |
| `foreuse_t1` | `poulie_boite` (poulie de la courroie) | tourne, plus vite que le volant (rapport ≈ 3) | `pivot_poulie_boite` (−1,5 ; −0,35 ; 1,86) | X |
| `foreuse_t1` | `poulie_tete` (poulie en haut de la tour) | tourne lentement | `pivot_poulie_tete` (0 ; −0,35 ; 3,44) | X |
| `foreuse_electrique_t2` | `foret_` (arbre, mandrin, foret) | tourne en continu | `pivot_foret` (0 ; 0 ; 1,38) | vertical |
| `foreuse_eco_t3` | `foret_` (arbre, mandrin, foret) | tourne en continu | `pivot_foret` (0 ; 0 ; 1,38) | vertical |
| `foreuse_eco_t3` | `gyrophare` | tourne (ou clignote) en marche | `pivot_gyrophare` (0,42 ; −0,42 ; 2,85) | vertical |

La courroie de la T1 reste fixe (une courroie qui défile ne se voit pas en low poly).

## Chevalet de pompage (`chevalet_t2`)

Tout tourne autour d'axes parallèles à **X** : le mouvement se passe dans le plan (Y, Z).

| Groupe | Pièces | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `balancier_` | poutre, semelle, chapeau, raidisseurs, tête de cheval (arc à gorge, nervures, éclisses, anneau), palonnier | **bascule** autour de l'axe du palier : la tête descend quand l'arrière monte | `pivot_balancier` (0 ; 0,05 ; 3,28) |
| `tige_` | câbles, barre porteuse, serre-câbles, tige polie | **monte et descend tout droit** (sans tourner), avec le point de la tête où partent les câbles | `pivot_tige` (0 ; −0,845 ; 3,28) |
| `manivelle_` | deux manivelles, deux contrepoids, manetons | **tourne en continu** autour de l'arbre du réducteur | `pivot_manivelle` (0 ; 0,76 ; 0,78) |
| `bielle_` | deux bielles jaunes | **suit** : le haut reste accroché au palonnier (qui bouge avec le balancier), le bas suit les manetons | `pivot_bielle` (0 ; 1,0 ; 3,22) = haut des bielles |

Données utiles pour le calcul (unités Blender, plan Y-Z) :
- Manetons : rayon **0,44** autour de `pivot_manivelle`, au départ à −125° (vers le bas et l'arrière).
- Palonnier (haut des bielles) : à **0,95** derrière `pivot_balancier`.
- Câbles : à **0,895** devant `pivot_balancier`, donc la tige monte et descend de `0,895 × sin(angle du balancier)`.
- Mouvement simple qui marche : angle de manivelle `φ = ω t` ; angle du balancier `θ ≈ asin(Δz_maneton / 0,95)`
  (où `Δz_maneton` est la hauteur du maneton par rapport à l'arbre), ce qui donne environ ±28°. On peut réduire
  l'amplitude (±15 à 20°) pour un rendu plus calme. Bielles : rotation autour de `pivot_bielle` (déplacé avec le
  balancier) pour que leur bas pointe vers le maneton.

## Transformation

| Modèle | Groupe | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `estampeuse_t1` | `marteau_` (masse, plaque rivetée, matrice haute, crosse, tige du piston) | **descend et remonte tout droit** : course de **0,2** vers le bas jusqu'à la matrice basse (frappe en fin de cycle, comme `press`) | `pivot_marteau` (0 ; −0,15 ; 0,96) = bas de la matrice haute, marteau en haut |

Attention : l'estampeuse a encore l'animation `press` du kit (`MACHINE_ANIM.stamper` dans `models.ts`), qui coupe le
modèle à mi-hauteur et fait descendre toute la moitié haute (traverse, cylindre, cheminée…). À remplacer par le
mouvement du seul groupe `marteau_`.

## Fonderie

| Modèle | Groupe | Mouvement | État |
|---|---|---|---|
| `fourneau_t1` | `flamme_`, `coeur_` | vacillent | **fait** dans le jeu (`ANIMATED_MESHES.furnace`) |
| `fourneau_electrique_t2` | — | rien ne bouge | — |
