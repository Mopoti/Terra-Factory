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
| Laboratoire | `scanner-high` |
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
| Laboratoire | la **tête du scanner tourne** tant qu'il étudie |

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
