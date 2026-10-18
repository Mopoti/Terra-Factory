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
- **Outils et armes** (`outils.py`) : `pioche_pierre`, `pioche_fer` (celle de l'outil équipé est visible, `toolModel.ts`), `pistolet`, `fusil` (vraie grandeur, canon vers +z). Le piolet importé reste en secours.

## Véhicules à l'échelle du personnage
- `vehicules.py` : `buggy` (agrandi ×1,7 : 2,7 m × 1,7 m, arceau à 1,6 m, siège à 0,6 m), `quad` (2 m, selle à 0,85 m), `tank` (4,2 m ; le pilote se tient dans la trappe de la tourelle). Chaque véhicule a un nœud vide `siege` (coussin du conducteur), lu par `bake` (`BakedModel.seat`) et `vehicleFromModel` (`VehicleMesh.seat`).
- **Au volant** (`gameView.ts`) : le personnage s'assied (`Avatar.seated` : cuisses à l'horizontale, genoux pliés, mains devant), ses hanches 8 cm au-dessus du coussin (`Avatar.hipOffset`) ; la caméra descend d'autant ; l'outil est rangé. On vise le buggy dans un rayon de 1,3 m.
- **Dans le jeu** : quad (`vehicle_quad`, plus rapide, sobre) et char (`vehicle_tank`, lent, gourmand, écrase fort) sont des véhicules comme le buggy (`src/core/data/vehicles.ts` : vitesse, consommation, écrasement, visée ; `Vehicle.kind`). Seules les roues (`roue_*`) roulent : chenilles et tourelle du char restent fixes pour l'instant (à animer plus tard).

## Voies ferrées et trains (anticipés, pas encore dans le jeu)
- `ferroviaire.py` : voie étroite industrielle, écartement 60 cm, dessus des rails à 12 cm. Pièces sans sens (un train roule dans les deux sens) : `rail_droit` (tuile 2 × 2 cases), `rail_virage` (tuile 6 × 6 cases, rayon 1,5 m, du milieu d'un bord au milieu du bord voisin ; le virage à gauche est le virage à droite tourné), `rail_rampe` (2 × 8 cases, monte d'un niveau de 1 m ; la descente est la même pièce tournée). Pas de tunnel.
- Trains (roues à Z = 0 du fichier, à poser sur le dessus des rails ; attelages à 45 cm ; roues en groupes `roues_av`, `roues_ar`, `roues_motrices`) : `locomotive_vapeur` (à combustible, 6 m : chaudière, cheminée, trois roues motrices rouges par côté avec bielle, abri du mécanicien, soute à charbon), `locomotive_electrique` (moderne, 8 m : caisse lisse, deux cabines à nez incliné, pantographes à un bras) — siège `siege` à 1,3 m dans chacune —, `wagon_fret` (wagon couvert à porte coulissante, 5 m, sur bogies), `wagon_citerne` (5 m, sur bogies ; bande et dôme de la teinte magenta `teinte`, à peindre de la couleur du fluide ou du gaz).
- Ces fichiers ne sont pas chargés par le jeu tant qu'ils ne servent pas (pas dans `TERRA_NAMES`).

## Tuyaux (octobre 2026)
- `fluides.py`, une tuile de 2 × 2 cases par forme (`tuyau_<forme>_t<palier>` : droit, coude, té, croix, bout, seul, regard). La vanne du bout et le raccord vertical des jonctions sont retirés (on croyait voir une vanne sur chaque tuyau).
- **Laiton (T2), dessin moderne** (`_tuyau_moderne`) : tube lisse un peu plus fin, manchons sertis au bord de chaque tuile (joint noir, sans boulons), bague orange du palier, coude cintré en quart de cercle, té et croix à manchon de jonction lisse, supports fins à collier, bouchon bombé. Cuivre (T1) et inox (T3) gardent les brides boulonnées.

