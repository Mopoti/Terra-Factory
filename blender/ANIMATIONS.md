# Animations des modèles maison (à brancher dans le code du jeu)

Les modèles Blender sont prêts pour l'animation : chaque groupe de pièces mobiles est **séparé** du reste et repérable par
son **nom**, et un **pivot** dit au jeu autour de quoi il tourne. **Le code du jeu ne gère pas encore ces animations** (seules
les flammes du fourneau T1 bougent, via `ANIMATED_MESHES` dans `src/render/models.ts`). Ce document liste ce qui doit bouger.

## Convention

- **Groupe** : toutes les pièces dont le nom commence par `<groupe>_` bougent ensemble (ex. `balancier_poutre`,
  `balancier_tete`, `balancier_jaune`…). Tout le reste est fixe.
- **Pivot** : un objet vide `pivot_<groupe>` (dans le `.glb`, son nom peut finir par `.002`, etc. : chercher le nœud dont le nom **commence** par `pivot_<groupe>`) (sans maillage, ignoré par `bake()`), exporté comme nœud du `.glb`.
  Sa **position** est le centre de rotation ; son **axe Z local dans Blender** est l'axe de rotation (dans le `.glb`,
  axe **Y local** du nœud, à cause du passage en Y haut).
- **Repères** : coordonnées ci-dessous en unités Blender, modèle posé au sol (après `T.poser_au_sol`) (1 = 1 case = 50 cm, Z haut, avant = −Y). Dans le `.glb` / three.js :
  `(x, y, z)` Blender → `(x × 0,5 ; z × 0,5 ; −y × 0,5)` mètres. L'axe X est le même dans les deux.
- Côté code, il faudra : sortir ces groupes du maillage fusionné (comme les flammes), lire les nœuds `pivot_*` au
  chargement, puis faire tourner / déplacer chaque groupe autour de son pivot quand la machine est en marche
  (`factory.status(m) === 'running'`), en tenant compte de la rotation et de l'échelle de la machine.

## Modèles agrandis pour les nouvelles emprises (octobre 2026)

Les machines dont l'emprise a grandi ont été agrandies dans Blender en gardant leurs proportions (`T.agrandir` /
`T.agrandir_auto`, tables `EMPRISES` des scripts). **Les pivots des tableaux ci-dessous sont ceux d'avant
l'agrandissement, sauf pour les foreuses** : multiplier X, Y et Z par le facteur (le jeu, lui, lit les pivots dans le `.glb`).

| Modèle | Emprise | Facteur |
|---|---|---|
| foreuses T1, T2, T3 | 4 × 5 | ×1,22 (pivots déjà à jour) |
| `chevalet_t2` | 4 × 4 | ×1,35 (recentré en X), puis élargi et rehaussé de ×1,33 (X et Z seulement) |
| `assembleur_t2`, `constructeur_t2`, `presse_lourde_t3`, `raffinerie_t3`, `centrifugeuse_t4`, `estampeuse_t1` | 4 × 4 | ×1,33 environ |
| `bras_t1`, `bras_t2`, `bras_t3` | 2 × 3 | ×1,53 (T1) et ×1,57 (T2, T3) environ |

Les courses en mètres de `src/render/partMotions.ts` (constructeur, presse lourde, centrifugeuse) ont été multipliées par 1,33.

## Foreuses

| Modèle | Groupe | Mouvement | Pivot (Blender) | Axe |
|---|---|---|---|---|
| `foreuse_t1` | `foret_` (foret, mandrin, table rotative) | tourne en continu | `pivot_foret` (0 ; −0,43 ; 0,98) | vertical |
| `foreuse_t1` | `volant_` (jante, moyeu, rayons) | tourne en continu | `pivot_volant` (−1,83 ; 1,46 ; 1,04) | X |
| `foreuse_t1` | `poulie_boite` (poulie de la courroie) | tourne, plus vite que le volant (rapport ≈ 3) | `pivot_poulie_boite` (−1,83 ; −0,43 ; 2,27) | X |
| `foreuse_t1` | `poulie_tete` (poulie en haut de la tour) | tourne lentement | `pivot_poulie_tete` (0 ; −0,43 ; 4,2) | X |
| `foreuse_electrique_t2` | `foret_` (arbre, mandrin, foret) | tourne en continu | `pivot_foret` (0 ; 0 ; 1,68) | vertical |
| `foreuse_eco_t3` | `foret_` (arbre, mandrin, foret) | tourne en continu | `pivot_foret` (0 ; 0 ; 1,68) | vertical |
| `foreuse_eco_t3` | `gyrophare` | tourne (ou clignote) en marche | `pivot_gyrophare` (0,51 ; −0,51 ; 3,48) | vertical |

La courroie de la T1 reste fixe (une courroie qui défile ne se voit pas en low poly).

Les foreuses sont agrandies de ×1,22 (emprise 4 × 5 cases) : les pivots ci-dessus tiennent compte de cet agrandissement.

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
| `estampeuse_t1` | `marteau_` (masse, plaque rivetée, matrice haute, crosse, tige du piston) | **descend et remonte tout droit** : course de **0,2** vers le bas jusqu'à la matrice basse (frappe en fin de cycle, comme `press`) | `pivot_marteau` (0 ; −0,1 ; 1,07) = bas de la matrice haute, marteau en haut |
| `estampeuse_t1` | `sortie_` (deux plaques estampées sur le convoyeur de sortie) | **avancent** vers l'avant, en boucle (pas = 0,4 de la longueur du convoyeur) : **fait** dans le jeu | `pivot_sortie` (0 ; −0,91 ; 0,92), axe = sens du convoyeur |
| `estampeuse_t1` | `lueur_foyer` (braises du foyer de la chaudière, derrière) | **rougeoie** (couleur entre rouge sombre et orange) quand il y a du combustible : **fait** dans le jeu (`ANIMATED_MESHES.stamper`, préfixe `lueur`) | — |
| `assembleur_t2` | `bras1_` (bras gauche : tourelle, bras, avant-bras, poignet, pince, câbles) | **pivote** autour de l'axe vertical de sa tourelle (va-et-vient entre la pièce au centre et le bac de plaques, comme `swing`) | `pivot_bras1` (−0,72 ; −0,78 ; 0,92), axe vertical |
| `assembleur_t2` | `bras2_` (bras droit, symétrique) | idem, en décalé avec le bras gauche | `pivot_bras2` (0,72 ; −0,78 ; 0,92), axe vertical |
| `assembleur_t2` | `plateau_` (plateau tournant, gabarit, plaque, engrenage) | **tourne** par quarts de tour entre deux passes des bras | `pivot_plateau` (0 ; −0,72 ; 0,9), axe vertical |
| `assembleur_t2` | `ventilateur_` (pales, moyeu) | **tourne** en continu en marche | `pivot_ventilateur` (−0,6 ; 0,75 ; 2,19), axe vertical |
| `concasseur_t1` | `volant_` (rouleau denté arrière, son engrenage, poulie à droite, arbre) | **tourne** en continu en marche | `pivot_volant` (0,2 ; 0,3 ; 2,07), axe X |
| `concasseur_t1` | `rouleau_` (rouleau denté avant et son engrenage) | **tourne en sens contraire** de `volant_`, même vitesse (les deux rouleaux broient la pierre entre eux) | `pivot_rouleau` (0,2 ; −0,2 ; 2,07), axe X |
| `concasseur_t1` | `moteur_` (poulie motrice, plateau de manivelle, bielle de la machine à vapeur) | **tourne** environ 2,6 fois plus vite que le volant (rapport des poulies) | `pivot_moteur` (1,4 ; 1,08 ; 1,42), axe X |
| `concasseur_t1` | `vis_` (hélice et arbre de la vis sans fin qui monte le charbon du bac au foyer) | **tourne** en continu en marche, autour de son axe incliné | `pivot_vis` (−1,18 ; 1,05 ; 0,16), axe (0 ; −0,68 ; 0,74) = le long de la vis ; sens réglé dans le jeu (`spin(-3)`) pour que l'hélice fasse monter le charbon |
| `concasseur_t1` | `gravier_` (rangées de pierres sur la goulotte, une tous les 0,12) | **dévale** la goulotte vers l'avant : glisse d'un pas de rangée (0,12) et revient, en boucle (0,4 s) | `pivot_gravier` (0 ; −0,57 ; 0,46), axe (0 ; −0,94 ; −0,34) = sens de la pente |
| `betonniere_t2` | `tambour_` (tambour orange, bandages, couronne dentée, bandes en spirale) | **tourne** en continu en marche, autour de son axe incliné | `pivot_tambour` (0 ; −0,55 ; 1,05) = centre de la bouche, axe (0 ; 0,97 ; 0,25) = le long du tambour |
| `betonniere_t2` | `pignon_` (pignon et son arbre) | **tourne en sens contraire** du tambour, environ 5 fois plus vite (rapport 0,81 / 0,15) | `pivot_pignon` (0,84 ; 0,365 ; 0,785), même axe que le tambour |
| `betonniere_t2` | `tiroir_` (tiroir d'alimentation, plein de béton) | **avance tout droit vers −Y** (≈ 0,25) jusqu'au-dessus du moule, puis revient sous la petite trémie | `pivot_tiroir` (0 ; −0,7 ; 0,49) = dessous du tiroir |
| `betonniere_t2` | `presse_` (tige, tête et poinçons de la presse à blocs) | **descend et remonte tout droit** (≈ 0,3) dans le moule, une fois le tiroir revenu | `pivot_presse` (0 ; −0,95 ; 0,72) = dessous des poinçons |
| `betonniere_t2` | `blocs_` (deux blocs de béton) | **apparaissent** en sortie de presse et **glissent vers −Y** jusqu'au bout du convoyeur (≈ 0,15), puis disparaissent (pris par le bras de sortie) | `pivot_blocs` (0 ; −1,3 ; 0,38) = dessous des blocs |
| `station_lavage_t2` | `tambour_` (trommel : crible perforé devant, débourbeur fermé derrière, bandages) | **tourne** en continu en marche, autour de son axe presque horizontal | `pivot_tambour` (0 ; −0,8 ; 0,85) = centre de la sortie, axe (0 ; 0,996 ; 0,091) = le long du tambour |
| `station_lavage_t2` | `galets_` (deux galets moteurs à droite et leur arbre) | **tournent en sens contraire** du tambour, environ 6,5 fois plus vite (rapport 0,58 / 0,09) : entraînement par friction | `pivot_galets` (0,448 ; −0,456 ; 0,381), même axe que le tambour |
| `station_lavage_t2` | `bande_` (tasseaux et minerai brut sur la bande du convoyeur) | **avance** le long de la montée, du bord arrière jusqu'au centre de l'entrée du trommel : glisser le long de l'axe et revenir d'un pas de tasseau (≈ 0,13) en boucle | `pivot_bande` (0 ; 1,401 ; 0,402), axe (0 ; −0,65 ; 0,76) = sens de la montée |
| `station_lavage_t2` | `sortie_` (minerai lavé sur le convoyeur de sortie, qui part de l'intérieur du crible) | **avance** le long du convoyeur vers l'avant (−Y), en boucle | `pivot_sortie` (0 ; −0,668 ; 0,695), axe (0 ; −0,94 ; −0,35) = sens de la bande |
| `station_lavage_t2` | `jet_` (jets d'eau en éventail : `jet_0`…`jet_5` sous la rampe du haut, `jet_cote_*` des rampes des côtés), `ruissellement_` (filets d'eau sous le crible) | **vacillent** en marche (comme les flammes), invisibles à l'arrêt | — |
| `constructeur_t2` | `portique_` (portique jaune, patins, chaîne porte-câbles) | **va-et-vient** tout droit en Y sur ses rails (≈ ±0,6) | `pivot_portique` (0 ; 0,15 ; 0,78), axe Y |
| `constructeur_t2` | `chariot_` (chariot et moteur de broche), **porté par le portique** | **va-et-vient** en X le long de la poutre (≈ ±0,6) | `pivot_chariot` (0,1 ; −0,02 ; 1,42), axe X |
| `constructeur_t2` | `outil_` (broche, porte-outil, torche, étincelles), **porté par le chariot** | **descend et remonte** (≈ 0,1) au-dessus de la pièce ; les étincelles peuvent vaciller | `pivot_outil` (0,1 ; −0,02 ; 0,9), axe Z |
| `constructeur_t2` | `ventilateur_` (pales et moyeu du groupe de refroidissement) | **tourne** en continu en marche | `pivot_ventilateur` (1,465 ; 0,15 ; 0,5), axe X |
| `constructeur_t2` | `entree_` (lingots de cuivre et de zinc) / `sortie_` (tubes en laiton) | **avancent** le long des convoyeurs, en boucle | `pivot_entree` (0 ; 1,444 ; 0,376) axe (0 ; −0,96 ; 0,29) ; `pivot_sortie` (0 ; −0,709 ; 0,46) axe (0 ; −0,99 ; −0,11) |
| `presse_lourde_t3` | `coulisseau_` (tige du vérin, coulisseau, outil du haut) | **descend et remonte tout droit** : course de **0,22** jusqu'à l'outil du bas (frappe en fin de cycle, comme `press`) | `pivot_coulisseau` (0 ; 0 ; 1,08) = dessous de l'outil du haut, coulisseau en haut |
| `presse_lourde_t3` | `ventilateur_` (refroidisseur d'huile de la centrale hydraulique) | **tourne** en continu en marche | `pivot_ventilateur` (1,2 ; 1,245 ; 0,37), axe Y |
| `presse_lourde_t3` | `entree_` (lingots d'acier) / `sortie_` (tubes d'acier) | **avancent** le long des convoyeurs, en boucle | `pivot_entree` (0 ; 1,463 ; 0,368) axe (0 ; −0,85 ; 0,53) ; `pivot_sortie` (0 ; −0,653 ; 0,878) axe (0 ; −0,85 ; −0,53) |
| `raffinerie_t3` | `flamme_` / `coeur_` (flamme de la torchère, flammes des deux brûleurs du four) | **vacillent** en marche | **fait** dans le jeu (`ANIMATED_MESHES.refinery`) |

Depuis la correction de `animatedParts` (`models.ts`), un modèle maison n'est plus coupé à mi-hauteur comme ceux du kit :
l'estampeuse est fixe en jeu tant que le mouvement du groupe `marteau_` n'est pas codé.

## Fonderie

| Modèle | Groupe | Mouvement | État |
|---|---|---|---|
| `fourneau_t1` | `flamme_`, `coeur_` | vacillent | **fait** dans le jeu (`ANIMATED_MESHES.furnace`) |
| `fourneau_electrique_t2` | — | rien ne bouge | — |
| `convertisseur_t2` (Bessemer) | `flamme_`, `coeur_` (gerbe de flammes et étincelles au-dessus de la gueule) | vacillent | **fait** dans le jeu (`ANIMATED_MESHES.bessemer`) |

### Convertisseur Bessemer (`convertisseur_t2`) : coulée et démoulage

La cornue est **fixe** (la couronne dentée et la crémaillère ne bougent pas : basculement d'entretien, pour le décor).

| Groupe | Pièces | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `trappe_` | trappe du trou de coulée, axe de charnière, levier | **pivote** autour de sa charnière : fermée = horizontale sous la busette ; **dessinée ouverte** (rabattue de 75° vers le bas). S'ouvre quand la lingotière est dessous, se referme quand elle est pleine | `pivot_trappe` (0,08 ; −0,78 ; 0,905), axe Y |
| `coulee_` | filet de métal en fusion, de la busette à la lingotière | **visible seulement trappe ouverte** (à masquer sinon) | — |
| `moule_` | lingotière (métal en fusion dessus) | **avance tout droit vers −Y** sur le convoyeur, de sous la busette jusque sous le portique (≈ 0,32), puis revient vide | `pivot_moule` (0 ; −0,78 ; 0,42) = dessous de la lingotière |
| `poincon_` | tige et tête du poinçon du portique | **descend et remonte tout droit** (≈ 0,15) quand la lingotière est dessous : il chasse le lingot | `pivot_poincon` (0 ; −1,1 ; 0,805) = dessous de la tête |
| `lingot_` | lingot sorti du portique | **apparaît** sous le portique et **glisse vers −Y** jusqu'au bout du convoyeur (≈ 0,22), puis disparaît (pris par le bras de sortie) | `pivot_lingot` (0 ; −1,32 ; 0,42) = dessous du lingot |

Cycle conseillé : la trappe s'ouvre et le métal coule → la trappe se ferme → la lingotière avance sous le portique → le poinçon frappe → le lingot sort.

## Nucléaire

| Modèle | Groupe | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `centrifugeuse_t4` | `rotor_` (volant d'inertie à repères jaunes et noirs, arbre, au sommet de la centrifugeuse) | **tourne vite** en continu en marche | `pivot_rotor` (0 ; −0,05 ; 1,93), axe Z |
| `centrifugeuse_t4` | `voyant_` (anneau lumineux cyan et six hublots du carter) | **pulsent** en marche (émissif), éteints à l'arrêt | — |
| `centrifugeuse_t4` | `ventilateur_` (pales et moyeu du groupe froid, derrière à droite) | **tourne** en continu en marche | `pivot_ventilateur` (1,05 ; 0,95 ; 0,88), axe Z |
| `centrifugeuse_t4` | `entree_` (tasseaux et blocs de minerai sur le convoyeur qui monte dans la bouche d'alimentation, au dos du carter) / `sortie_` (capsule verte d'uranium enrichi, conteneur gris d'uranium appauvri, partis de sous la goulotte) | **avancent** le long des convoyeurs, en boucle | `pivot_entree` (0 ; 1,46 ; 0,35) axe (0 ; −0,77 ; 0,63) ; `pivot_sortie` (0 ; 0,07 ; 0,4) axe (0 ; −1 ; −0,03) |

## Logistique (convoyeurs T1)

Une tuile de tapis = 2 unités Blender (1 m), dessus de la bande à Z = 0,4. Le jeu fait déjà avancer les objets sur les
tapis ; seule la bande elle-même pourrait défiler. Les lames de la bande ont une **forme de flèche** qui montre le sens :
tous les modèles font avancer les objets vers **+X**, sauf les virages. Chaque forme existe en T1 (`…_t1`, jaune, flèches
simples), T2 rapide (`…_t2`, orange, flèches doubles) et T3 express (`…_t3`, rouge, flèches triples) : mêmes groupes,
mêmes pivots ; la bande défile à la vitesse du palier (×1, ×2, ×4, comme `tierSpeeds`).

| Modèle | Groupe | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `convoyeur_t1` (droit, branché dans le jeu) | `bande_` (lames en flèche) | **défile** vers +X à la vitesse du tapis, en boucle sur un pas de **0,5** | — |
| `convoyeur_virage_t1` (virage −X → −Y, branché : forme `corner`) | `bande_` (3 lames en flèche) | **tourne** autour de l'axe Z du centre de la courbe, angle **décroissant**, en boucle sur un pas de **22,5°** | `pivot_bande` (−1 ; −1 ; 0,37), axe Z |
| `convoyeur_virage_inverse_t1` (virage −Y → −X, branché : forme `cornerBack`) | `bande_` | idem, angle **croissant** | `pivot_bande` (−1 ; −1 ; 0,37), axe Z |
| `convoyeur_rampe_t1` (montée, pas encore branchée) | `bande_` (lames en flèche et tasseaux) | **glisse** vers le haut de la pente, pas de **0,4 × √2** | `pivot_bande` (−1 ; 0 ; 0,37), axe (0,71 ; 0 ; 0,71) |
| `convoyeur_rampe_descente_t1` (descente, pas encore branchée) | `bande_` | **glisse** vers le bas de la pente, même pas | `pivot_bande` (−1 ; 0 ; 2,37), axe (0,71 ; 0 ; −0,71) |
| `convoyeur_tunnel_entree_t1` / `convoyeur_tunnel_sortie_t1` (pas encore branchés) | `bande_` (lames de la partie visible) | **défile** vers +X, pas de **0,5** | — |

### Séparateur, groupeur, trieur, bras (famille logistique)

| Modèle | Groupe | Mouvement | Pivot (Blender) |
|---|---|---|---|
| `separateur` (`splitter`) | `aiguillage_` (moyeu et pales au centre) | **pivote** par tiers de tour vers la sortie servie (devant, gauche, droite) | `pivot_aiguillage` (0 ; 0 ; 0,37), axe Z |
| `trieur` (`sorter`) | `aiguillage_` | **pivote** vers la sortie choisie par le filtre | `pivot_aiguillage` (0 ; 0 ; 0,37), axe Z |
| `trieur` | `scanner_` (nappe lumineuse cyan du portique d'entrée) | **clignote** quand un objet passe dessous | — |
| `separateur`, `groupeur`, `trieur` | `bande_` (flèches des bouts de tapis) | défilent comme les tapis (sortie : vers l'extérieur, entrée : vers le centre) | — |
| `bras_t1`, `bras_t2`, `bras_t3` (`arm`, `arm_electric`, `arm_filter`) | `tourelle_` (tourelle et bras) | **pivote** autour de l'axe de la tourelle : **fait** dans le jeu (`MACHINE_ANIM`, « swing ») ; le jeu prend les maillages `tourelle_*` comme partie mobile (`BakedModel.parts`), tout le reste est fixe | `pivot_tourelle` (0 ; 0 ; 0,28), axe Z |
| `bras_t1` | `volant_` (volant du petit moteur thermique, à droite du foyer) | **tourne** en continu en marche | `pivot_volant` (0,53 ; 0,62 ; 0,2), axe X |
