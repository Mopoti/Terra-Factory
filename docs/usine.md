# Chantier 9 — Usine : foreuses, tapis, fourneau

Première couche de l'automatisation (voir `docs/architecture.md`). Données dans `content/machines.json` et `content/items.json`, simulation dans `src/core/factory/`.

## Ce qui est fait

- **Foreuse** (3 × 3 cases = 1,5 m) : fabriquée avec 3 lingots de fer + 3 pierres. Elle extrait **1 minerai par seconde** parmi les cases de minerai situées **sous elle** et les **épuise vraiment** (les tas de minerai rapetissent à l'écran). Il faut du **combustible** (1 case : charbon = 100 s, bois = 20 s). Case de **stock** (100 max, un seul type d'objet) ; si elle est pleine ou si la sortie est bloquée, la foreuse s'arrête.
- **Fourneau** (2 × 2 cases) : 5 pierres. Cuit le minerai de fer / de cuivre en **lingot de fer / de cuivre** (3 s pièce) en brûlant du combustible. 3 cases : combustible, minerai à cuire (entrée), lingots (sortie).
- **Tapis roulant** (1 case, 1 lingot de fer) : 1,5 case par seconde, 3 objets au plus par case, objets espacés. Les machines et les tapis ont une **sortie** : la case juste devant le milieu du côté choisi (R). Un tapis dépose dans la machine ou le tapis qui est devant lui ; un tapis qui débouche sur rien bloque ses objets. La foreuse et le fourneau poussent leur stock sur le tapis (ou la machine) placé sur leur case de sortie ; un tapis ou une foreuse peut alimenter l'entrée d'un fourneau.
- **Pose** : mêmes cases de barre que les pièces de construction. Foreuse et fourneau : aperçu vert/rouge, **R** oriente la sortie (par défaut dans le sens du regard). Tapis : **maintenir le clic et tracer** avec le curseur pose plusieurs tapis à la suite ; chaque élément s'oriente vers le suivant et la **forme** (droit / virage) s'adapte aux voisins.
- **Panneau d'informations** sur le bord droit de l'écran quand on vise une machine ou un tapis : état (en marche, panne de combustible, plus de minerai, stock plein…), production, minerai restant à miner dessous, stock, combustible restant (en secondes), consommation électrique (aucune pour l'instant), vers quoi elle sort.
- **Interface** (touche **F** sur la machine visée) : combustible, minerai brut en entrée et lingots en sortie (fourneau), stock (foreuse) ; boutons « Ajouter du sac » / « Reprendre ».
- **Démolir en tapant** : maintenir le clic gauche sur n'importe quelle construction ou machine la détruit (barre de progression) et rend les **ressources de fabrication** ainsi que le contenu de la machine ; plus besoin d'avoir l'objet en main. (X en mode construction reste disponible.)
- Tout est enregistré avec la partie (`changes.machines`, objets sur les tapis compris). Les foreuses et tapis tournent tant que le jeu n'est pas en pause.

## Choix par défaut (à confirmer par le PO)

1. Une foreuse doit être posée sur au moins une case de minerai ; elle mine d'abord les cases dans l'ordre, un seul type de minerai à la fois dans son stock.
2. Pas encore d'électricité : la ligne « Consommation électrique » indique « aucune ».
3. Le fourneau n'a pas d'autre recette que les deux minerais.
4. Machines à plat au rez-de-chaussée uniquement, pas de pente (le monde est plat).
5. Les tapis n'ont pas d'embranchement ni de tri : un tapis qui rejoint un autre par le côté s'insère.

## À faire ensuite

Électricité (foreuse électrique, panneau « consommation »), embranchements, tri, coffres, véhicules, technologies.
