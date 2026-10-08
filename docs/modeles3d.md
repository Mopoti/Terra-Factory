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

## Pas encore (à décider avec le PO)

- **Tapis** : le kit a des tapis droits, coudes, jonctions et pentes (`conveyor-*`) ; nos tapis portent des objets animés, à traiter à part (courbes, pentes, tunnels).
- **Tuyaux** (`pipe-large-*`), foreuses (`crane`, aimant), poteaux, tourelle, réacteurs, accumulateurs : formes simples pour l'instant.
- **Objets du sac et ressources** posés au sol (caisses `box-*`, engrenages `cog-*`), **panneaux, portes, passerelles** (`catwalk-*`, `structure-*`, `door-*`) pour les pièces de construction.
- **Animations** (bras qui pivotent, pistons, engrenages) : les modèles sont statiques.
