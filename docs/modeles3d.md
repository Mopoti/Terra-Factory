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

- **Tapis droit et coude** en modèles du kit, pour les 3 paliers (T1 : `conveyor`, T2 : `conveyor-sides`, T3 : `conveyor-stripe-sides` ; coudes `conveyor-corner` / `conveyor-stripe-corner`). Le modèle est aplati pour que le dessus soit à 20 cm (hauteur où roulent les objets, `BELT_H`, passée de 12 à 20 cm). Le coude relie la sortie au côté d'où arrivent les objets ; il est tourné pour couvrir la bonne paire de côtés, sans miroir. Une **flèche claire** marque le sens (les modèles n'en ont pas) ; un tapis abîmé est teinté de rouge.
- Les tapis surélevés prennent aussi ces modèles, avec nos piliers. **Les pentes et les tunnels gardent leurs formes simples** : la pente du kit ne monte que de 40 cm (la nôtre, 1 m), l'étirer la déformerait trop.

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
