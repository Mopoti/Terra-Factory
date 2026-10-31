# Modèles 3D

## Source : Factory Kit de Kenney (CC0)

- Pack fourni par le PO (`kenney_factory-kit_3.0.zip`, licence **CC0**, crédit « Kenney / www.kenney.nl » apprécié mais facultatif). 143 modèles ; on n'en garde que ce qui sert : **24 fichiers** dans `public/models/kenney/` (+ `Textures/colormap.png` et `License.txt`). Tout le reste du pack est dans l'archive d'origine, à ajouter au besoin.
- Les fichiers `.glb` sont chargés au démarrage de la partie (`src/render/models.ts`, `loadModels`). Chacun est « cuit » en sommets colorés (la couleur vient de la palette `colormap`, convertie de sRGB) puis **fusionné dans le maillage des machines** (`MeshBuilder.model`) : un seul objet pour toute l'usine, comme avant. Tant que les modèles ne sont pas chargés (ou si un fichier manque), la machine garde sa forme simple.
- Ajustement : le modèle est mis à l'échelle (uniforme) pour tenir dans l'emprise de la machine et sa hauteur ×1,3, centré, posé au sol, tourné d'un quart de tour par orientation ; 12 % de la couleur de la machine est mélangée pour les distinguer.

## Machines qui utilisent un modèle (table `MACHINE_MODELS`)

| Machine | Modèle |
|---|---|
| Fourneau | `machine-window` |
| Four électrique, assembleur | `machine-window-bar` |
| Estampeuse, presse lourde | `piston-square` |
| Concasseur | `hopper-square` |
| Bessemer, tour de refroidissement, tour d'évaporation | `hopper-high-round` |
| Bétonnière, centrifugeuse | `piston-round` |
| Générateur | `machine-fortified` |
| Constructeur | `machine-bed` |
| Laboratoire | `machine` |
| Station de lavage | `machine-connection-pipe` |
| Presse à plastique | `piston-thin-round` |
| Raffinerie | `hopper-high-square` |
| Chaudière | `hopper-round` |
| Station de vitrification | `machine-connection-hole` |
| Bras (mécanique, électrique, filtrant) | `robot-arm-a` / `robot-arm-b` |
| Coffres (bois, fer) | `box-small` / `box-large` |

## Tapis (Tour 139)

- **Tapis droit et coude** en modèles du kit, pour les 3 paliers (T1 et T2 : `conveyor-sides`, T3 : `conveyor-stripe-sides` ; coudes `conveyor-corner` / `conveyor-stripe-corner`). Le modèle est aplati pour que le dessus soit à 20 cm (hauteur où roulent les objets, `BELT_H`, passée de 12 à 20 cm). Le coude relie la sortie au côté d'où arrivent les objets ; il est tourné pour couvrir la bonne paire de côtés, sans miroir. Une **flèche claire** marque le sens (les modèles n'en ont pas) ; un tapis abîmé est teinté de rouge.
- Les tapis surélevés prennent aussi ces modèles, avec nos piliers. **Les pentes et les tunnels gardent leurs formes simples** : la pente du kit ne monte que de 40 cm (la nôtre, 1 m), l'étirer la déformerait trop.

- **Couleurs (Tour 141)** : le tapis droit `conveyor` du kit est la variante sombre, alors que les coudes n'existent qu'en clair (lavande) : le premier palier avait des droits sombres et des coudes clairs. Les trois paliers utilisent maintenant des droits « sides » (clairs), assortis aux coudes.

## Modèles articulés (Tour 139)

- Un modèle peut être coupé en deux (`splitModel`, selon la hauteur) : la partie basse reste dans le maillage fixe de l'usine, la partie haute devient un objet mobile (`FactoryView.movers`, mis à jour à chaque image par `updateMovers`). Table `MACHINE_ANIM` :

| Machine | Animation |
|---|---|
| Estampeuse, presse lourde, presse à plastique | **piston** : reste en haut, puis s'abat de 14 cm sur le dernier quart du cycle (suit la barre de progression) |
| Bras (mécanique, électrique, filtrant) | **pivote** de ±0,9 rad tant que la machine est « en marche », puis revient droit |

- Testé en code (`movers.test.ts` : le piston descend en fin de cycle, le bras pivote puis se redresse, la tête s'arrête au repos). **Pas encore vérifié à l'œil en mouvement** : à regarder en jouant (amplitudes, vitesses, coupe du piston).
- Les modèles du kit sont d'un seul bloc : on ne peut pas articuler les doigts de la pince ou les segments du bras séparément. Pour cela il faudrait des modèles découpés en pièces (ou les fabriquer).

## Pas encore (à décider avec le PO)

- **Pentes et tunnels de tapis**, séparateurs et groupeurs (`conveyor-junction-t`, `conveyor-cross`).
- **Tuyaux** (`pipe-large-*`), foreuses (`crane`, aimant), poteaux, tourelle, réacteurs, accumulateurs : formes simples pour l'instant.
- **Objets du sac et ressources** posés au sol (caisses `box-*`, engrenages `cog-*`), **panneaux, portes, passerelles** (`catwalk-*`, `structure-*`, `door-*`) pour les pièces de construction.
- **Autres animations** (engrenages `cog-*` sur les machines, ventilateurs, foreuses).

## Arbres et cailloux (Tour 145)
- **Sources** (fournies par le PO) : « Stylized Nature Pack Vol.1 – 3D Tree » (scène OBJ exportée de Nomad Sculpt, textures peintes) et « Pebbles » (glTF Unity, une couleur unie). **Licence non précisée dans les archives** : à vérifier sur la page d'origine avant toute publication (mention d'auteur éventuelle à ajouter ici).
- `public/models/nature/tree.obj` + `tree.png` : un seul conifère extrait de la scène (objet `default_54`, 1050 sommets, 1264 triangles). Le feuillage est fait de cartes à transparence, donc il garde la texture (matériau `foliageMaterial`, `alphaTest`, double face) au lieu des couleurs par sommet. Ramené à 5,5 m × l'échelle de l'arbre, tourné au hasard ; le tronc bloque toujours une seule case.
- `public/models/nature/pebbles.gltf` + `pebbles.bin` : tas de cailloux, cuit en couleurs par sommet et fusionné au décor ; remplace les deux octaèdres des rochers.
- `src/render/nature.ts` charge le tout en arrière-plan ; les chunks déjà construits sont refaits quand c'est prêt. Sans fichier, les anciennes formes simples servent de secours. L'aura de transparence du décor s'applique aussi au feuillage.
- **Plantes (Tour 148)** : `plant1.obj` à `plant4.obj` + `plants.png` (herbe, buisson fleuri, fougère, autre texture de la même archive) remplacent les touffes de cônes des buissons de fibres, une forme au hasard par buisson, ~1,1 m de large (`plantMaterial`, même découpe de transparence que les arbres).
- Non utilisés pour l'instant : les autres conifères, les autres herbes et les tas de feuilles de la scène.

## Pioche : piolet (Tour 146)
- **Source** (fournie par le PO) : « Ice climbing pick » (FBX, 3 438 sommets, textures PBR). **Licence non précisée** : à vérifier comme pour les arbres.
- `public/models/tool/icepick.glb` : converti depuis le FBX, texture de couleur réduite à 512 px (les cartes normale/rugosité/métal, très lourdes, ne sont pas reprises). Modèle redressé et mis à 0,75 m, manche vers soi, pointe vers l'avant (`src/render/toolModel.ts`).
- Il remplace la pioche en boîtes tenue en main (1re personne) et portée par le personnage ; l'outil en pierre est teinté brun, l'outil en fer garde les couleurs d'origine. Sans fichier, les formes simples servent de secours.
- Le style (piolet moderne noir et orange) détonne avec le reste ; à remplacer par un outil de pierre/fer plus rustique quand on en trouvera un.

## Personnage : mineur articulé (Tour 147)
- **Source** (fournie par le PO) : « 3D Rigged Character » (itch.io, **CC0**), fichier `characterRIGGED.glb` copié dans `public/models/character/miner.glb`. Mannequin de 15 os, sans matériau ni animation.
- `src/render/minerModel.ts` : couleurs par région calculées d'après la hauteur des sommets (tête et mains = peau, jambes = pantalon, torse et bras = combinaison, teintée par joueur), casque jaune avec lampe émissive posé sur le modèle, animations calculées en tournant les os (marche proportionnelle à la vitesse, bras abaissés le long du corps, geste de frappe bras levé puis abattu pendant une récolte).
- Le piolet de la main droite est fixé à l'os de la main (il suit le bras). En 1re personne, rien ne change (le personnage est masqué).
- Les autres joueurs utilisent le même mannequin, teinté par joueur, animé d'après leur vitesse de déplacement ; avant le chargement (ou sans fichier), la capsule sert de secours.
- Le mannequin du fichier regarde vers -z : il est tourné d'un demi-tour (Tour 148) ; ses côtés gauche et droit sont donc inversés par rapport au fichier (`BONES`).
- Limites : le mannequin n'a pas de visage (le casque et la lampe indiquent l'avant), pas d'animation de repos ni de saut, et les mouvements des genoux et coudes sont simples.

## Bras en vue subjective, eau et gisements texturés (Tour 149)
- **Main à la 1re personne** : la boîte couleur peau est remplacée par le vrai bras du personnage (une seconde instance du mannequin, `firstPerson`, accrochée à la caméra, réduite à 80 %). Tout ce qui est derrière la caméra (tête, torse) est découpé par un plan de coupe mis à jour à chaque image ; le bras se tend devant soi et le piolet est fixé à sa main. Les couleurs sont maintenant propres à chaque instance : peau et pantalon ne sont plus teintés par la combinaison.
- **Eau** (`src/render/groundTextures.ts`) : texture de vagues dessinée par le code (somme de sinus à fréquences entières, donc sans raccord visible), en coordonnées du monde (3 m par répétition), qui coule doucement (`tickWater`, décalage de la texture).
- **Gisements** : atlas de 8 vignettes de 128 px dessinées par le code (fer, cuivre, charbon, zinc, bauxite, sable, pétrole, uraninite : éclats, paillettes, grains). Chaque case pose sa vignette tournée ou retournée au hasard, éclairée selon la richesse ; les flancs prennent la couleur moyenne de la vignette. Pas de fichier image ni de licence à gérer ; les couleurs d'origine servent de repli sans navigateur.
- Idées suivantes : texture de l'herbe et du sol par biome, normales pour donner du relief.

## Arbres par biome, rochers et bûches du pack « Low Poly Nature » (Tour 150)
- **Source** (fournie par le PO) : « Low Poly Nature Free » (`P.fbx` + palette `New_color.png`, dossier `low-poly-nature-free.zip`). **Licence non précisée** : à vérifier. Remplace le conifère texturé et les cailloux des Tours 145 : `tree.obj`, `tree.png` et `pebbles.*` sont supprimés. Les plantes à cartes texturées (Tour 148) restent.
- `public/models/nature/lowpoly.json` : 27 modèles choisis dans le pack, convertis en sommets dédoublonnés avec couleur lue dans la palette (pied du tronc à l'origine, hauteur ou largeur ramenée à 1). Chargés par `src/render/nature.ts` (`parseLowpoly`, `TREES_BY_BIOME`, `ROCKS`, `LOG`, `LOG_PAIR`) et fusionnés dans le décor (`MeshBuilder.model`).
- **Arbres par biome** : prairie = feuillus (Tree016, 019, 012, 013), forêt = conifères (009, 017, 018, 010, 001, 004), désert = arbres secs (022, 024, 026), toundra = résineux élancés (007, 008, 005, 003) givrés (teinte blanche à 45 %). Le biome est lu à l'emplacement de l'arbre ; les feuillus larges sont réduits pour garder une emprise raisonnable.
- **Tailles** (`content/resources.json`, clé `sizes`, tirage pondéré fixe par emplacement) : arbre petit (40 %) = 4 bois, moyen (40 %) = 6, grand (20 %) = 8, de 0,7 / 1 / 1,3 × 5,5 m. Rocher petit (50 %) = 10 pierres, moyen (35 %) = 20, grand (15 %) = 32, de 0,55 / 1 / 1,6 × 0,95 m. Densité des rochers à 60 % de l'ancienne (moins fréquents) ; la pierre moyenne par rocher passe de 20 à environ 17. La quantité et la hauteur de survol suivent la taille (`PlacedObject.size`, `amount`).
- **Bois au sol** : une bûche du pack (Tree025) pour 1 ou 2 bois, une paire de bûches (Stump) à partir de 3 (repli tant que les objets maison ne sont pas chargés, voir « Objets posés au sol »).
- Non utilisés : les autres arbres (arbres à champignon, cactus, etc.), souches, champignons, herbes et fleurs du pack ; ils pourraient décorer certains biomes.

## Buissons du pack (Tour 151)
- Les buissons de fibres utilisent maintenant les herbes et plantes du pack « Low Poly Nature » (couleur par sommet, comme les arbres), par biome : prairie (Grass007, 005, 011, 003), forêt (004, 012, 005, 008), désert (006, 011, 010), toundra (012, 006, 003, givrées). Hauteur moyenne 0,6 m, largeur limitée à 0,95 m.
- Le système de plantes à cartes texturées du Tour 148 est supprimé (`plant1-4.obj`, `plants.png`, `plantMaterial`) : `lowpoly.json` contient maintenant 36 modèles.

## Modèles faits maison (Blender)

Dossier `blender/` (un `.blend` par famille, **non versionné** : seuls les `.glb` et les scripts sont dans Git ; scripts, outils), `export/` (un `.glb` par modèle, noms en minuscules : `foreuse_t1.glb`). Échelle : 1 unité Blender = 1 case (50 cm) ; l'export divise par deux pour avoir des mètres. Le jeu charge `public/models/terra/` (copié par `node scripts/sync-modeles.mjs`) et ces modèles passent avant ceux du kit (`TERRA_MODELS`). Détails et règles : `blender/README.md`. Premier modèle : `foreuse_t1`.

### Parties animées d'un modèle maison : `flamme_*` et `coeur_*`

Convention : dans un `.glb` maison, tout maillage dont le **nom** (ou celui d'un de ses parents) commence par un préfixe de `ANIMATED_MESHES` (`src/render/models.ts`) est retiré du corps fixe et animé à part. Pour le fourneau : `flamme_*` (cônes orange) et `coeur_*` (cœurs jaunes). `bake()` les range dans `BakedModel.flames` (sommets propres, un groupe par maillage avec son pied) ; l'enveloppe du modèle les inclut, l'échelle dans le jeu reste donc celle voulue par l'auteur.

`FactoryView.updateFlames` fait vaciller chaque flamme autour de son pied (échelle verticale ≈ 0,8 à 1,15, léger élargissement, deux sinus + déphasage par machine et par flamme, luminosité ±12 %). Pleines quand la machine travaille, 20 % (braises) si elle a du combustible sans travailler, cachées sans combustible. Un seul objet par machine, seuls les sommets des flammes sont réécrits, et seulement à moins de 70 m du joueur. Pour animer d'autres parties d'une autre machine : ajouter ses préfixes à `ANIMATED_MESHES`.

### Pièces mobiles des modèles maison (groupes + pivots)

Code : `src/render/partMotions.ts` (table `MOTIONS` : quel groupe fait quoi, fonctions pures testées), `bake()` (`models.ts`, sort les groupes du maillage fixe et lit les nœuds `pivot_<groupe>` du `.glb`), `FactoryView.updateParts` (un objet par groupe et par machine ; seules les matrices changent ; machines à plus de 70 m ignorées). Une machine « en marche » (`status === 'running'`) anime ses pièces avec un démarrage et un arrêt doux ; à l'arrêt elles se figent.

Types de mouvements : `spin` (rotation continue, vitesse en rad/s, négative = sens contraire), `swing` (va-et-vient, éventuellement d'un seul côté), `step` (quarts de tour), `press` (descente en fin de cycle de travail), `slide` (glissement en bosse ou en boucle, le long de l'axe du pivot ou d'une direction du modèle), `rocker` (chevalet : cinématique bielle-manivelle calculée avec les pivots et le bas des bielles). Une pièce `parent` suit le déplacement de son parent (chariot sur portique, outil sur chariot).

Faits : foreuses (foret, volant, poulies, gyrophare), chevalet (manivelle, balancier, tige, bielles), estampeuse, assembleur, concasseur, bétonnière, station de lavage (+ jets d'eau en vacillement), constructeur, presse lourde, centrifugeuse, Bessemer (trappe, moule, poinçon, lingot), bras T1/T2/T3 (modèles maison désormais branchés). **À vérifier et rectifier à l'œil** : les sens de rotation, les amplitudes et les durées sont des estimations à partir de `blender/ANIMATIONS.md`. Pas encore faits : pièces qui apparaissent/disparaissent (`coulee_`, `blocs_`/`lingot_` à masquer en bout de course), `voyant_` et `scanner_` (clignotement), bandes des convoyeurs, séparateur / trieur / groupeur (non branchés).

## Végétation, véhicule, tourelles et sol maison (octobre 2026)
- **Arbres et buissons** : modèles maison (`blender/scripts/vegetation.py`), 3 arbres et 3 buissons par biome : prairie (chêne, bouleau, pommier ; herbes fleuries, buisson rond, touffe), forêt (deux conifères, grand feuillu ; fougère, buisson à baies, souche à champignons), désert (acacia, arbre mort, saguaro ; touffe sèche, petit cactus, branchages), toundra (épicéa enneigé, bouleau givré, pin aux plaques de neige ; bruyère, lichen, carex). Fichiers `arbre_<biome>_<n>.glb` et `buisson_<biome>_<n>.glb` (biomes `prairie`, `foret`, `desert`, `toundra`), chargés avec les machines (`models.ts`) et mis à la taille du jeu par `nature.ts` (`ownNatureModel` : hauteur ramenée à 1, posé par le pied). Ils remplacent ceux du pack « Low Poly Nature » dès qu'ils sont chargés ; ils sont déjà enneigés en toundra (pas de teinte de givre) et peuvent être un peu plus larges (0,75 × la hauteur au lieu de 0,6). Les bûches restent celles du pack.
- **Rochers** : modèles maison (`blender/scripts/mineraux.py`), 3 par biome : prairie (gros bloc gris avec touffes d'herbe, trois galets, dalle à lichen), forêt (bloc couvert de mousse, bloc fendu avec fougère, tas de pierres moussues avec champignons), désert (grès rouge en strates, rocher en équilibre, galets à moitié ensablés), toundra (granite coiffé de neige, deux blocs enneigés et cristaux de glace, dalles empilées). Fichiers `rocher_<biome>_<n>.glb`, ramenés à 1 m de large par `nature.ts` (`rockModelsFor`), puis à la taille du tas (petit, moyen, grand) comme ceux du pack, qui restent en secours.
- **Minerai** : modèles maison d'une case (`minerai_<gisement>_<n>.glb`, `blender/scripts/mineraux.py`), posés sur la texture du gisement (`chunkMesh.ts`). Minerais solides : chaque case est couverte de 4 (`_1`) ou 3 (`_2`) gros cailloux, tournés et retournés au hasard, avec la couleur et l'effet de leur minerai : fer (hématite rouge sombre, facettes rouille et éclats métalliques), cuivre (malachite en bandes de verts), pierre (grise, mouchetée de blanc et de noir), charbon (noir, facettes brillantes), zinc (blende ocre et miel, petits cristaux gris acier), bauxite (argile rouge, billes orangées), uraninite (noir de poix, veines jaune-vert). Sable : la case couverte de petits cailloux blonds, rosés et gris. Pétrole : une flaque sur 20 à 60 % des cases. Les cailloux sont plus hauts là où la case est riche et s'aplatissent quand elle s'épuise (la case est redessinée après chaque récolte) ; le fond entre eux est assombri. Hauteur ≤ 22 cm, pour rester sous le plancher des foreuses.
- **Buggy** : modèle maison (`blender/scripts/vehicules.py`, `export/buggy.glb`), une roue par groupe (`roue_avg`, `roue_avd`, `roue_arg`, `roue_ard`) qui tourne de la distance parcourue (`src/render/vehicleModel.ts`). Les boîtes jaunes restent en secours tant que le fichier n'est pas chargé.
- **Tourelles lourde, laser, plasma** : modèles maison (`blender/scripts/defense.py`) ; la tête (`tourelle_`) balaye l'horizon tant que la tourelle est prête à tirer.
- **Sol des biomes** : dessiné par le code, en facettes low poly (`src/render/groundStyle.ts`) : deux triangles par case, chacun de sa couleur, avec une normale à peine penchée (le sol reste plat sous les machines). Palettes et motifs par biome : prairie (verts mêlés, taches plus claires et sèches), forêt (mousse sombre, plaques d'humus et de feuilles mortes), désert (sable en rides, plaques de roche rouille), toundra (neige bleutée, plaques de gravier et de glace). La teinte de saison s'applique par-dessus, comme avant.

## Objets posés au sol (octobre 2026)
- **Formes maison** : `blender/scripts/objets.py` (`objets.blend`) fabrique 17 formes `objet_<forme>` : `bois` (bûches), `caillou`, `minerai`, `sable` (tas), `lingot`, `plaque` (pile), `engrenage`, `bobine` (fil), `fibre` (botte), `tissu` (rouleau), `baril`, `science` (caisse avec fiole), `puce`, `bloc` (béton), `conteneur` (uranium, déchets), `verre`, `caisse` (tout le reste). Les faces au matériau `teinte` (magenta `#ff00ff`) prennent la couleur de l'objet (`items.json`, `color`) ; le reste garde ses couleurs.
- **Choix de la forme** : `dropShape(item)` dans `src/render/dropModels.ts` (règles sur l'identifiant : `_ingot` → lingot, `barrel_` → baril, `science_pack` → science…). Minerai et caillou sont grossis ×1,5 (`SHAPE_SCALE`) ; une grosse pile grossit jusqu'à +25 %.
- **Machines au sol** : leur propre modèle en miniature, plus grande dimension 45 cm (`MINI_MACHINE_M`) ; tapis = tapis droit du palier, buggy = son modèle.
- Utilisé par `refreshDrops` (`interaction.ts`) ; carapace et tissu vivant gardent leur forme à part. Tant que les modèles ne sont pas chargés, l'ancien petit bloc coloré reste.
- Ajouter une forme : la fabriquer dans `objets.py`, l'ajouter à `DROP_SHAPES` (`models.ts`) et à `dropShape`, exporter puis `node scripts/sync-modeles.mjs`.

## Pièces de construction (octobre 2026)
- **Modèles maison** : `blender/scripts/construction.py` (`construction.blend`), bois et pierre : `mur_<mat>` (bloc de 50 cm, planches ou moellons), `dalle_<mat>` (sol et plafond : lames ou dalles 2 × 2), `porte_<mat>` (cadre sur tout l'étage) et `porte_<mat>_battant` (battant seul, tourné quand la porte est ouverte), `escalier_<mat>` (3 marches dans la pièce de 50 cm), `pilier_<mat>_bas` / `_fut` / `_haut` / `_seul` (tronçons de 50 cm empilés selon la hauteur du pilier).
- **Dans le jeu** : `addPieceModel` dans `src/render/buildingView.ts` ; l'aperçu de pose (vert / rouge) garde les formes simples, comme les pièces tant que les modèles ne sont pas chargés (le maillage est refait à la fin du chargement).
- **Pas de recouvrement** : un bloc de mur va de bord de case à bord de case ; un bout libre déborde de 5 cm pour fermer l'angle. Dans un angle, seul le mur le long de x déborde (2 mm de plus), celui le long de z s'arrête dedans. Les montants de porte sont un peu plus épais que le mur et recouvrent le bout du mur voisin ; le battant ouvert est décollé de 3 mm. Sans cela, les faces confondues scintillent.
- Plafond qui déborde sur un mur : la dalle est étirée (même règle que la forme simple).

## Derniers modèles (octobre 2026)
- **Machines** : tourelle de base `tourelle_base` (`defense.py` : plancher, sacs de sable, trépied ; groupe `tourelle_` qui balaye), balise `balise` (`logistique.py` : fanion et lanterne de la teinte magenta `teinte`, repeints à la couleur choisie par le joueur dans `addMachineBody`), presse à plastique `presse_plastique_t2` (`transformation.py` : presse à injection verticale, groupe `coulisseau_` qui descend, colliers chauffants `lueur_*`, isolateurs sur le convoyeur `sortie_`). Branchées dans `TERRA_MODELS`, animations dans `MOTIONS`.
- **Ennemis** (`creatures.py`, chargés par `enemyView.ts`) : `ennemi_eclaireur` (~0,8 m), `ennemi_gardien` (~1,3 m, piquants et pinces), `ennemi_cracheur` (~1 m, sac d'acide). Pattes en deux trépieds `pattes_a_*` / `pattes_b_*` qui balancent en sens contraires quand l'ennemi avance ; le corps sautille. Mutant : ×1,4. Formes simples tant que les fichiers ne sont pas chargés.
- **Nid** `nid` (`creatures.py`) : monticule de 2 m de diamètre pour 4 cases, agrandi selon la taille du nid (`chunkMesh.ts`).
- **Dépouilles** : `objet_carapace`, `objet_tissu_vivant` (`objets.py`), formes d'objets au sol comme les autres.
- **Outils et armes** (`outils.py`) : `pioche_hache` (fer) et `pioche_hache_pierre`, l'outil tenu en main (celui de l'outil équipé est visible, `toolModel.ts`) ; `pistolet`, `fusil` (vraie grandeur, canon vers +z). Les anciennes `pioche_pierre`, `pioche_fer` puis le piolet importé restent en secours.
- **Pioche-hache, premier modèle au « style doux »** (la direction visée pour tout le jeu) : formes lisses aux coins arrondis (fonction `_loft` d'`outils.py` : un volume passe par des sections en rectangle arrondi, flancs lissés, bouts plats), métal clair lavande un peu brillant, plaque sombre boulonnée sur l'œil, bague sous la tête, manche orangé veiné. Le pic est côté -Y, la lame de hache côté +Y. En jeu, l'outil fait un demi-tour sur son manche : la hache passe devant quand on vise un arbre, la pioche pour le reste (`interaction.aimedRes`).
- **Modèles en pièces séparées** (`EN_PIECES` d'`outils.py`, classe `Piece`, export `_export_hier`) : chaque pièce est un nœud du `.glb` avec son pivot, la hiérarchie est gardée, pour animer ou changer les pièces dans le code.
  - `pioche_hache`, `pioche_hache_pierre` : `manche` (pivot au pied du manche) > `bague`, `oeil` (pivot au centre de la tête) > `pic`, `lame`.
  - `main_gantee` : main droite pour la vue subjective (portée en jeu, voir `docs/personnage.md`). Poignet à l'origine, doigts vers -Y, dos de la main en haut. Doigts nus (teinte `peau_main`, à remplacer par la couleur de peau du joueur), gant gris sans doigts, sangle de cuir, manchette. Pièces : `main` > `manchette` (pivot au poignet, plie avec l'avant-bras), `index_1` > `index_2` > `index_3` (idem `majeur`, `annulaire`, `auriculaire`) et `pouce_1` > `pouce_2` > `pouce_3`, pivot à chaque articulation ; une rotation positive autour de l'axe X local referme le doigt vers la paume.
  - `pistolet` (pistolet simple, culasse longue et fine, poignée courte à plaquettes de bois), `fusil` (fusil automatique, type fusil d'assaut à bois orangé et chargeur courbe), `sniper` (verrou, lunette, bipied ; arme du jeu, visée à la lunette au clic droit, voir `docs/combat.md`) : origine au milieu de la poignée, canon vers -Y. Pièces `corps` > `culasse` (pistolet ; verrou du sniper), `levier` (levier d'armement du fusil), `chargeur`, `detente`, `bipied_g` / `bipied_d` ; repères vides `bouche` et `ejection`. Animés par `src/render/gunAnim.ts` (voir plus bas).
  - `avant_bras` : manche de combinaison (teintes `combinaison`, `bande`, `couture` recolorées en jeu), du coude (origine) au poignet, 25 cm.
- **Style doux étendu (23 octobre)** : `T.adoucir(coll)` (`terra.py`) lisse l'ombrage (normales pondérées par l'aire : biseaux arrondis, grandes faces planes, arêtes plus vives que 57° gardées nettes).
  - Rochers et amas de minerai (`mineraux.py`) : moins de points par bloc (grandes facettes), arêtes biseautées (`BISEAU`, `_biseauter`), mousse / neige / lichen qui épousent le rocher, teinte des minerais choisie par grande facette.
  - Arbres et buissons (`vegetation.py`) : boules de feuillage plus fines et un peu aplaties (`Lot.boule`, `FINESSE`), troncs et cônes à plus de côtés, ombrage lissé.

## Véhicules à l'échelle du personnage
- `vehicules.py` : `buggy` (agrandi ×1,7 : 2,7 m × 1,7 m, arceau à 1,6 m, siège à 0,6 m), `quad` (2 m, selle à 0,85 m ; coques à pans, garde-boues enveloppants, suspension à amortisseurs, moteur à ailettes, porte-bagages, pneus ballon à chevrons), `tank` (4,6 m ; caisse à plaques inclinées, chenilles à patins autour de cinq galets doubles par côté, barbotin, roue tendeuse, jupes, tourelle à flancs inclinés, canon à évacuateur et frein de bouche, tourelleau du chef où se tient le pilote, panier arrière). `quad_electrique` : même châssis que le quad, carrosserie blanche à liserés bleus, bloc batterie sous la selle avec bande lumineuse `quad_lueur`, moteur électrique sur l'essieu arrière et prise de recharge (pas de pot d'échappement). Le conducteur est à gauche (+X). Chaque véhicule a un nœud vide `siege` (coussin du conducteur), lu par `bake` (`BakedModel.seat`) et `vehicleFromModel` (`VehicleMesh.seat`).
- **Au volant** (`gameView.ts`) : le personnage s'assied (`Avatar.seated` : cuisses à l'horizontale, genoux pliés, mains devant), ses hanches 8 cm au-dessus du coussin (`Avatar.hipOffset`) ; la caméra descend d'autant ; l'outil est rangé. On vise le buggy dans un rayon de 1,3 m.
- **Dans le jeu** : quad (`vehicle_quad`, plus rapide, sobre) et char (`vehicle_tank`, lent, gourmand, écrase fort) sont des véhicules comme le buggy (`src/core/data/vehicles.ts` : vitesse, consommation, écrasement, visée ; `Vehicle.kind`). Seules les roues (`roue_*`) roulent : les galets du char (`roue_g1`… `roue_d5`) roulent aussi ; la bande des chenilles et la tourelle restent fixes pour l'instant.

## Voies ferrées et trains (dans le jeu : voir `docs/trains.md`)
- `ferroviaire.py` : voie étroite industrielle, écartement 60 cm, dessus des rails à 12 cm. Pièces sans sens (un train roule dans les deux sens) : `rail_droit` (tuile 2 × 2 cases), `rail_virage` (tuile 6 × 6 cases, rayon 1,5 m, du milieu d'un bord au milieu du bord voisin ; le virage à gauche est le virage à droite tourné), `rail_rampe` (2 × 8 cases, monte d'un niveau de 1 m ; la descente est la même pièce tournée). Pas de tunnel.
- Les voies sont agrandies ×2,5 dans le jeu (écartement 1,5 m). Trains dessinés à cette échelle (voie normale) : roues sur les rails à ±0,75 m, bas des roues à Z = 0 (posé sur le dessus des rails), tampons et attelages à 1,05 m, caisses de 2,6 m de large, origine au milieu des essieux, un groupe de roues par essieu ; attelages automatiques à mâchoire en groupes `attelage_av` / `attelage_ar` (pivot vertical sur la traverse de tête, le jeu les tourne vers le voisin). `locomotive_vapeur` (030T, tampons à l'avant à 3,6 m, attelage de 1,1 m à l'arrière jusqu'à 3,9 m, abri à deux vraies fenêtres frontales vitrées par le jeu et deux à l'arrière, soute au fond de l'abri, siège à gauche à 2,25 m), `wagon_fret` et `wagon_citerne` (caisse de 5 m, deux essieux, attelages de 0,8 m aux deux bouts : 6,6 m). `wagon_plateforme` : même châssis, plancher en bois à rails d'arrimage, ranchers aux coins et anneaux de sanglage, pour charger un véhicule. `locomotive_electrique` (30 octobre, à l'échelle de la voie posée, pas encore dans le jeu) : caisse de 7,6 m, deux
bogies de deux essieux (centres à ±2,7 m ; groupes `roues_av`, `roues_av2`, `roues_ar2`, `roues_ar`), attelages
automatiques `attelage_av` / `attelage_ar` (points d'attelage à ±4,5 m : 9 m), deux cabines creuses à baie frontale
ouverte en deux vitres (repère pour `CAB_GLASS`, dans le repère du fichier en m : centres x = ±0,66, y = 2,78, face
z = 3,59 pour la cabine avant (-3,59 pour l'arrière), 1,16 m de large, 0,65 m de haut), siège `siege` dans la cabine
avant, feux `voyant_feux`, deux pantographes `pantographe_av` / `pantographe_ar` (pivots axe X à leur charnière, le jeu
les lèvera vers la caténaire). Fiche à prévoir dans `trains.ts` : longueur 9 m, `frontM` 4,5, caisse ±3,8 m,
`halfBaseM` 2,7.
- Voies : `rail_croisement` (tuile de 2 × 2 cases, deux voies droites à angle droit : rails coupés par les ornières, cœurs en fonte, contre-rails, plaque d'acier au centre), `rail_virage` (3 × 3 tuiles, rayon 3 unités), `rail_virage_large` (5 × 5, rayon 5) et `rail_virage_tres_large` (7 × 7, rayon 7), `rail_virage_grand` (11 × 11, rayon 11), `rail_virage_geant` (15 × 15, rayon 15) et les demi-virages `rail_virage_45` / `rail_virage_45_b` (les deux moitiés du très large), tous tracés par `_virage` ; aiguillages `rail_aiguillage_<d|g>_<droit|devie>` (bloc de 3 × 3 tuiles, voie directe et voie déviée en virage serré, un modèle par côté et par position des lames, levier près de la pointe, du côté opposé à la branche : le jeu le manœuvre à cet endroit, `leverOf`).

## Tuyaux (octobre 2026)
- `fluides.py`, une tuile de 2 × 2 cases par forme (`tuyau_<forme>_t<palier>` : droit, coude, té, croix, bout, seul, regard). La vanne du bout et le raccord vertical des jonctions sont retirés (on croyait voir une vanne sur chaque tuyau).
- **Laiton (T2), dessin moderne** (`_tuyau_moderne`) : tube lisse un peu plus fin, manchons sertis au bord de chaque tuile (joint noir, sans boulons), bague orange du palier, coude cintré en quart de cercle, té et croix à manchon de jonction lisse, supports fins à collier, bouchon bombé. Cuivre (T1) et inox (T3) gardent les brides boulonnées.


## Animations des armes à feu (24 octobre)

`src/render/gunAnim.ts` (`GunRig`, poses testées dans `gunAnim.test.ts`), branché dans `gameView.ts` :
- **tir** : recul de l'arme (en arrière, canon relevé), culasse du pistolet ou levier du fusil qui recule puis revient, éclair au bout du canon (repère `bouche`), traînée partant du canon ; sniper : cycle du verrou (lever, tirer, pousser, rabattre) après chaque tir ;
- **rechargement** (touche Recharger) : l'arme se relève et tourne pour montrer le logement, le chargeur sort le long de son axe et disparaît, un plein remonte, puis on réarme (culasse, levier ou verrou). Pistolet 1,1 s, fusil 1,6 s, sniper 1,8 s ; on ne tire pas pendant le rechargement (les munitions sont rechargées dès le début du geste).
- Réglages par arme : `GUN_PROFILES` (durées, recul, course de la culasse, direction et course du chargeur) ; place en vue subjective : `GUN_FIRST_OFFSET` (`gameView.ts`).

## Modèles ajoutés le 25 octobre (objets qui n'avaient pas de modèle)

Tous au style doux (`T.adoucir`, formes de `outils.py`).
- **Véhicules** (`vehicules.py`) : `camionnette` (camion à benne : cabine orangée, benne d'acier à ridelles, roues
  `roue_avg`… qui roulent, siège à gauche) et `charrette` (charrette à bras en bois, roues à rayons `roue_g` / `roue_d`,
  brancards vers l'arrière). Plateaux de chargement alignés dans `gameView.ts` (`CARGO_BED`).
- **Gare** (`ferroviaire.py`, `gare`) : quai de 2,4 × 9 m (bordure, bande jaune), abri vitré avec banc, lampadaires,
  poubelle ; dessiné par `stationView.ts` (le panneau au nom de la station reste fait par le code). Icône de l'objet.
- **Pièces béton et aluminium** (`construction.py`) : `mur_`, `dalle_`, `escalier_`, `pilier_*_{bas,fut,haut,seul}` pour
  `beton` et `aluminium`, `porte_aluminium` (+ `_battant` vitré) ; `porte_garage_aluminium` sert d'icône (la porte de
  garage du jeu est dessinée par segments). `buildingView.ts` les pose comme le bois et la pierre.
- **Matériaux** (`objets.py`) : `objet_caoutchouc`, `objet_tige` (fer et acier, à leur couleur), `objet_moteur`,
  `objet_moteur_renforce`, et `objet_eau` (icône de la ressource eau).
- **Équipement, munitions, armures** (nouvelle famille `equipement.py`) : `objet_boussole`, `objet_sac_a_dos`,
  `objet_capuche`, `objet_pantalon`, `objet_bottes`, `objet_gants`, `objet_sac_couchage`, `objet_lit`,
  `objet_chargeur_pistolet`, `objet_chargeur_fusil`, `objet_chargeur_sniper`, et `objet_armure{1,2,4}_{casque,plastron,
  jambieres,bottes}` (palier 1 : cuir et rivets ; 2 : plaques d'acier ; 4 : alliage sombre et lignes lumineuses). Faces
  magenta = couleur de l'objet (`dropShape`, `dropModels.ts`). Ce sont les modèles au sol et en icône ; l'équipement
  porté sur le personnage garde ses formes simples pour l'instant.
- **Ressources du monde** (`res_*`, mode Créatif) : icône du décor qu'elles posent (arbre, rocher, buisson, amas de
  minerai du gisement, flaque d'eau).
- **Icônes des outils** : la pioche-hache est montrée dressée en diagonale, tête en haut (`itemIcon.ts`).
- `NO_MODEL_ITEMS` est vide : plus aucun objet ne garde la caisse.

## Lot énergie au style doux (29 octobre)

Quatre machines de l'énergie ont leur modèle (`blender/scripts/energie.py`, style doux : `outils.py` et `T.adoucir`) :

- `poteau_haute_tension` (`pole_hv`) : mât d'acier de 6 m, trois bras en escalier, chaînes d'isolateurs en verre ;
- `poteau_tres_haute_tension` (`pole_uhv`) : pylône en treillis de 10 m, trois bras larges, pointe et câble de garde ;
- `lampadaire` (`lamp`) : mât vert de 3 m, crosse, globe `voyant_lampe_*` qui s'éclaire quand il est alimenté ;
- `eolienne` (`wind_turbine`) : tour de 5 m, rotor de 3 m (groupe `rotor_`, `pivot_rotor`, tourne quand elle produit).

Les câbles partent du repère `accroche_cable` (tête des poteaux). Ces modèles dépassent de leur emprise (bras, crosse,
rotor) : le jeu les règle sur leur seule hauteur (`OVERHANG_MODELS` dans `src/render/factoryView.ts`).

Deuxième lot (30 octobre), même fichier et même style :

- `transformateur` (`transformer`) : cuve arrondie, radiateurs, conservateur d'huile, traversées haute et basse tension ;
  voyants verts `voyant_flux_*` allumés quand de l'énergie le traverse ;
- `disjoncteur` (`breaker`) : coffret gris, levier rouge (groupe `levier_`, `pivot_levier`, mouvement `open`) qui bascule
  vers le bas quand le disjoncteur s'ouvre ; voyant ambre `voyant_etat_*` allumé quand il est ouvert ;
- `panneau_solaire` (`solar_panel`) : panneau bleu incliné vers l'avant sur un pied, boîtier de raccordement ;
- `accumulateur_base` (`accumulator_basic`) : trois cellules vertes sanglées, jauge `voyant_charge_*`.

Troisième lot (30 octobre) :

- `assembleur_avance` (`assembler_advanced`, `blender/scripts/transformation.py`) : même base que l'assembleur T2,
  caisson bleu nuit, bras et moteur orange, bandeau lumineux cyan (`voyant_bandeau_*`) et quatre voyants de couleur pour
  ses quatre types de recettes (`voyant_types_*`) ; mêmes pièces mobiles que l'assembleur T2 ;
- `mur_blinde`, `porte_blinde`, `porte_blinde_battant` (`blender/scripts/construction.py`, matériau `blinde`) : plaques
  d'acier rivetées, montants à bande de danger jaune et noire, battant à renforts en croix, hublot et volant de
  verrouillage. Le blindé n'a ni dalle, ni escalier, ni pilier dans le jeu (`MUR_ET_PORTE`).

## Paquets de science (30 octobre)

Un flacon par palier (`blender/scripts/objets.py`, formes `objet_science_<palier>`) : le liquide prend la couleur de
l'objet, la forme change à chaque palier. T1 : ballon dans un casier en bois ; T2 : fiole conique sur un trépied ;
T3 : un grand tube à essai tenu par une pince sur un support ; T4 : fiole à six pans dans une armature de laiton ; T5 : capsule sphérique
tenue par deux anneaux ; combat (`objet_science_combat`) : fiole en forme d'obus sur un étui à croix. `dropShape` choisit
la forme d'après l'objet (`science_pack`, `science_pack_2` à `_5`, `combat_pack`) ; l'ancienne forme `science` reste en secours.

## Moules (30 octobre)

Trois formes propres (`objets.py`) : bloc d'acier bleuté (même couleur pour les trois), poignées et goupilles de centrage claires,
empreinte sombre de la pièce produite. `objet_moule_plaque` (empreinte rectangulaire et canal de coulée),
`objet_moule_engrenage` (empreinte de roue dentée), `objet_moule_fil` (filière : disque serti, trou conique, bout de fil
de cuivre qui en sort).

## Veste (30 octobre)

`objet_veste` (`equipement.py`) : veste de la teinte sur un cintre, debout face au joueur (col et poignets sombres,
fermeture éclair, deux poches à rabat, pied rond). Le modèle porté sur le personnage reste à faire.

## Voie de la refonte : virage de 45° et diagonale (30 octobre)

`ferroviaire.py` : `rail_courbe` (virage de 45°, rayon 7 unités = 8,75 m ; origine au port 0, part vers -Y et tourne à
gauche vers +X) et `rail_diagonal` (droit de 2√2 unités = 3,54 m, centré, le long de Y). `trainView.ts` pose le virage
par son port 0, tourné du cap de la pièce par pas de 45°, en miroir pour le virage à droite ; la diagonale par son
milieu, tournée de 45°. Le dessin par le code (`addProcedural`) ne sert plus que tant que les modèles ne sont pas chargés.

## Intermédiaires des paliers 3 à 5, lot 1 (30 octobre)

Formes propres (`objets.py`, table `OWN_SHAPES` de `dropModels.ts`) : `objet_chassis_simple` (cadre soudé),
`objet_chassis_renforce` (croix de renfort, goussets boulonnés), `objet_chassis_leger` (longerons percés),
`objet_chassis_composite` (coque moulée à trame tissée), `objet_vitre` (plaque debout dans deux cales),
`objet_vitre_blindee` (verre épais, cadre boulonné à croisillons), `objet_graphite` (pains noirs empilés),
`objet_sel_lithium` (tas couvert de cristaux). La tige d'aluminium prend la forme des tiges (couleur plus claire).

Lot 2 (30 octobre) : `objet_fibre_carbone` (rouleau tressé sur mandrin), `objet_kit_circuit` (petite carte, puce,
condensateurs, broches), `objet_circuit_avance` (carte dense à liseré doré, processeur à radiateur), `objet_microcontroleur`
(grosse puce à broches), `objet_cellule_solaire` (plaque bleue quadrillée), `objet_filtre_graphite` (cartouche à nid
d'abeille), `objet_batterie_lithium` (bloc à deux bornes et jauge). Astuce : un grand dessus plat de la teinte se fait
avec `lot.cube` (un `_rond` vertical très plat donnait un dessus trop clair en jeu).

Lot 3 (30 octobre) : `objet_kit_reparation` (boîte à outils, clé et tournevis), `objet_capsule_fusion` (sphère lumineuse
entre deux demi-coques), `objet_aimant_supra` (aimant en U, bobinages, givre), `objet_cristal_quantique` (cristaux facettés
sur une pierre), `objet_deuterium` et `objet_tritium` (bonbonnes à étiquette D et T), `objet_azote_liquide` (bonbonne
cryogénique givrée). Tous les intermédiaires ont maintenant leur forme ; la table des formes provisoires a disparu.

## Armures 3 et 5, exosquelette, propulseur (30 octobre)

`equipement.py` : les quatre pièces des armures 3 (composite : visière sombre, bandes orange, plaques en écailles) et 5
(nano : visière bombée lumineuse, lignes lumineuses cyan), `objet_exosquelette` (deux jambes articulées, genoux à moteur
vert, ceinture) et `objet_propulseur` (deux réservoirs, tuyères et petite flamme, bretelles). Plus aucune forme
provisoire dans `dropModels.ts`.

## Équipement porté sur le personnage (30 octobre)

Nouvelle famille `blender/scripts/porte.py` (fichier `porte.blend`) : `porte_sac_a_dos`, `porte_capuche`, `porte_veste`,
`porte_pantalon`, `porte_bottes`. Chaque modèle est construit dans le repère du personnage homme (m, Z en haut, avant
vers -Y) et rangé par os : les objets `<os>__<pièce>_<teinte>` suivent l'os `<os>` (`poitrine`, `tete`, `bras_g`,
`cuisse_d`, `pied_g`…). Dans le jeu, `Avatar.wear(emplacement, modèle, couleur, cacherCheveux)` accroche chaque pièce à
son os en gardant sa place par rapport à l'os sur l'homme (sur la femme, elle suit ses os). Les faces `teinte` prennent
la couleur de l'objet. La capuche cache les cheveux. Les gants n'ont pas de modèle porté : `Avatar.setGloveColor` teinte
les mains gantées. Correspondance objet → modèle : `src/render/wornModels.ts`. Les vêtements recouvrent un peu les genoux
et les coudes (calottes) pour que la combinaison ne se voie pas quand ils plient.

Armures portées (30 octobre) : `porte_armure<palier>_casque`, `_plastron` (avec brassards sur les bras et avant-bras),
`_jambieres`, `_bottes` pour les paliers 1 à 5, `porte_exosquelette` (barres le long des jambes, moteurs aux genoux) et
`porte_propulseur` (réservoirs dans le dos, bretelles). Les armures sont dans `blender/scripts/porte_armures.py` : plaques
superposées (`coquille`, part de manchon à section elliptique) sur une sous-couche sombre — gorgerin, plastron bombé à
arête, ventre en lames, dossière en lames, épaulières à lames, canon de bras, cubitière, avant-bras, tassettes, cuissot,
genouillère, grève, solerets en lames. Finitions par palier (`STYLE`) : 1 cuir et rivets, 2 acier à liserés clairs,
3 composite à bandes orange, 4 blindage lourd (deux yeux ronds, grille de respiration, lumières bleues), 5 nano (deux
fentes lumineuses, liserés cyan). Casques 1 à 3 ouverts sur le visage, 4 et 5 fermés. Les casques cachent les cheveux.

## Formes qui étaient partagées (30 octobre)

`objets.py` : `objet_lingot_alu`, `objet_lingot_zamak`, `objet_cable`, `objet_isolant`, `objet_baril_vide`,
`objet_baril_eau`, `objet_baril_petrole`, `objet_petrole_brut`, `objet_barre_uranium`, `objet_dechets_nucleaires`
(table `OWN_SHAPES` de `dropModels.ts`, vérifiée en premier par `dropShape`).

Icônes des armures (30 octobre) : les formes `objet_armure<palier>_<pièce>` (`equipement.py`, `_armure_icone`) sont
tirées des pièces portées (`porte_armures.py`) : même design, posées au sol (plastron sans brassards, casque relevé et
tourné vers la caméra, jambières tournées pour qu'on voie les deux). Les casques ouverts ont un bord roulé autour du
visage.

## Clôtures, barrières et portails (30 octobre ; branchés dans le jeu le 31 octobre)

Nouvelle famille `blender/scripts/clotures.py` (`clotures.blend`). Dimensions proposées, à confirmer : tronçon de clôture
d'une case (1,2 × 0,3 × 2 unités, 1 m de haut) ; portail de 3 m (6 × 0,4 × 3,4) entre deux piliers.
`cloture_bois` ; `barriere_beton` et `barriere_beton_arme` avec `_abime1` (éclats) et `_abime2` (fissures, morceau
tombé, fers visibles pour le béton armé) ; `portail_bois` et `portail_beton` (battants `battant_g_` / `battant_d_`,
pivots verticaux aux gonds) ; `portail_beton_arme` (vantail coulissant `vantail_`, `pivot_vantail` axe -X, moteur et voyant
`voyant_moteur`). Fichiers chargés par le jeu (`TERRA_MODELS`, `EXTRA_GROUPS` dans `models.ts` ; dessin dans `addBarrierModel`, `factoryView.ts`) : tronçons d'une case posés par trois (poteaux cachés entre eux et là où une autre barrière prolonge la rangée), versions `_abime1` / `_abime2` selon la vie, portails mis à la largeur de l'emprise (battants tournés de 90° vers l'extérieur, vantail glissé sur son rail, nappe holographique éteinte à l'ouverture). `projecteur_mur_holographique` n'est pas utilisé (le mur holographique du jeu est une rangée de trois tronçons).
Rangées de barrières (béton, béton armé, holographique) : les deux poteaux d'un tronçon sont des groupes à part,
`poteau_g_` (-X) et `poteau_d_` (+X), centrés sur le bord de la case ; ceux de la clôture en bois sont dans le maillage, aux
mêmes places. Le jeu cache le poteau d'un côté où touche une barrière **de même orientation** : une rangée n'a alors de
poteaux qu'à ses deux bouts. Les barrières et portails sont posés **sur le bord de leurs cases** (côté dos du modèle,
choisi en tournant la pièce), pas au milieu : deux rangées qui font un angle se rejoignent au coin des cases et leurs deux
poteaux d'angle tombent au même endroit (31 octobre). Hauteur des clôtures et barrières : 1 m (`H` = 2 unités ; les
portails gardent la leur). Holographiques : la nappe de lumière (`holo_mur`, `holo_portail`) est un maillage à part,
translucide, visible seulement quand la machine est alimentée (et le portail fermé) : `FactoryView.updateHolos`.

Holographique (palier 5, même famille) : `barriere_holographique` (rail et demi-poteaux émetteurs, nappe de lumière
`holo_mur`), `portail_holographique` (piliers émetteurs, seuil à chevrons, nappe `holo_portail` que le jeu éteint pour
ouvrir, voyant `voyant_portail`), `projecteur_mur_holographique` (machine d'une case, 1,65 m : socle, fût à ailettes,
lentille `holo_noyau`, anneau de focalisation `anneau_` qui tourne autour de `pivot_anneau`, voyant `voyant_projecteur`).
Les maillages `holo_*` sont faits pour être dessinés translucides et lumineux (matériau à prévoir dans le jeu).

Batterie portable : `objet_batterie_portable` (`objets.py`), pile de poche de la teinte, face sombre à éclair et jauge de
quatre barres, clip de ceinture ; la vraie jauge de charge sera une barre dessinée par-dessus l'icône.

## Machines avancées (30 octobre, pas encore dans le jeu)

Nouvelle famille `blender/scripts/avancees.py` (`avancees.blend`), pour les machines des nouveaux chantiers. Dimensions
proposées, à confirmer : `borne_recharge` (1 x 1 case, 1,6 m ; écran `voyant_ecran`, anneau lumineux `voyant_charge`,
pistolet et câble sur le flanc droit), `compresseur_air` (2 x 2, 0,9 m ; réservoir rouge couché, moteur bleu, bloc à
ailettes, volant `volant_` qui tourne autour de `pivot_volant` (axe X), manomètre, voyant `voyant_compresseur`),
`purificateur_air` (2 x 2, 1,75 m ; grille d'aspiration en façade, cartouches filtrantes à droite, pupitre `voyant_ecran`
à gauche, deux ventilateurs `helice_g_` / `helice_d_` sur le toit (pivots verticaux), bandeau `voyant_air`).
`bras_industriel` (2 x 2, robot orange à six axes, dépasse un peu de son emprise vers l'avant : chaîne de groupes
`tourelle_` (`pivot_tourelle`, axe Z) > `epaule_` (`pivot_epaule`, axe X) > `coude_` (`pivot_coude`, axe X) > `poignet_`
(`pivot_poignet`, axe de l'outil), colonne lumineuse `voyant_bras`), `foreuse_plasma` (4 x 4, 1,9 m, variante high-tech de
la foreuse : tour à quatre pieds, générateur sur le plateau, lance à bobines de cuivre, dard lumineux `plasma_` dans
l'ouverture, condensateurs violets, radiateur, goulotte devant, écran `voyant_ecran`), `electrolyseur` (3 x 3, 1,6 m :
empilement de cellules couché devant avec fenêtre `voyant_electrolyse`, réservoirs d'hydrogène (blanc) et d'oxygène
(bleu) derrière, arrivée d'eau à gauche).
`fabricateur_universel` (3 x 3, 1,6 m : podium rond, chambre vitrée `vitre_chambre` (à dessiner translucide), plateau
tournant `plateau_` (`pivot_plateau`, Z), objet en cours d'impression lumineux `voyant_impression`, tête d'impression,
couronne à bandeau `voyant_fab`, trémies sur les côtés, trappe de sortie devant), `pile_combustible` (2 x 2, 1,4 m :
armoire à quatre modules de cellules et leurs voyants `voyant_modules`, ventilateur `helice_pile_` sur le toit, bornes en
cuivre avec `accroche_cable`, bouteilles d'hydrogène à droite, rejet d'eau à gauche), `coffre_quantique` (2 x 2 : caisson
violet nuit, piliers d'angle et serrure lumineux `voyant_quantique`, couvercle `couvercle_` qui s'ouvre vers l'arrière
(`pivot_couvercle`, comme les coffres), cristal flottant `cristal_` qui tourne (`pivot_cristal`)), `tourelle_rail` (3 x 2
comme les autres tourelles : batteries de condensateurs, tourelle `tourelle_` (`pivot_tourelle`, Z) à deux rails, bobines
d'accélération et rail lumineux `voyant_rail`).

## Météo (31 octobre)

`energie.py` : `thermometre` (boîtier mural : dos sur le bord +Y de la case, écran vers -Y, centre de l'écran à 1,2 m ;
surface d'affichage `ecran_affichage` de 0,32 x 0,24 m avec coordonnées de texture de 0 à 1 : le jeu y plaque l'image
de la température, par exemple la `CanvasTexture` de `weatherProps.ts`, avec `flipY = false` comme toute texture glTF ;
repère `ecran` en son centre), `girouette`
(2,6 m : dalle, mât, croix des points cardinaux, flèche `fleche_` sur `pivot_fleche` (vertical, 1,95 m ; au repos la
pointe regarde vers -Y), anémomètre `anemometre_` sur `pivot_anemometre`). L'éolienne a maintenant une nacelle mobile
(`nacelle_`, `pivot_nacelle` vertical) dont le rotor est l'enfant. Branchés dans `weatherProps.ts` (31 octobre) : le
thermomètre affiche la température sur son écran, la flèche de la girouette et la nacelle de l'éolienne se tournent vers
le vent, l'anémomètre et le rotor tournent selon sa force (formes simples gardées si un modèle n'est pas chargé).
Groupes déclarés dans `EXTRA_GROUPS` (`models.ts`).

Icônes des machines (31 octobre) : `dropGeometry` ajoute les pièces mobiles dans leur position de repos (tourelles,
bras, couvercles, rotor…), qui manquaient jusque-là.

## Gantelets d'armure (31 octobre)

Nouvel objet du jeu `armor<n>_hands` (emplacement « mains », un par palier, débloqué avec l'armure du palier ; batterie
portable possible aux paliers 4 et 5 comme les autres pièces). Modèles : `blender/scripts/gantelets.py`
(`gantelets.blend`), `gantelet_armure1` … `gantelet_armure5`, dans le repère et à l'échelle de la main gantée
(`outils.main_gantee`) : plaques `main__…` (dos de la main en lames, garde des jointures) et `manchette__…` (bracelet au
poignet), finitions du palier comme les armures portées. Le jeu les accroche aux nœuds `main` / `manchette` de chaque
main gantée (`Avatar.setGauntlets`, vues extérieures, vue subjective et armes), assombrit le gant à la couleur de
l'armure et couvre les doigts (gant sans doigts). Icônes `objet_armure<n>_gants` (`equipement.py`) : paire de mains
gantées couchées, avec les mêmes plaques.
