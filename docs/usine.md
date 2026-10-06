# Chantier 9 — Usine : foreuses, tapis, fourneau

Première couche de l'automatisation (voir `docs/architecture.md`). Données dans `content/machines.json` et `content/items.json`, simulation dans `src/core/factory/`.

## Ce qui est fait

- **Foreuse** (3 × 3 cases = 1,5 m) : fabriquée avec 3 lingots de fer + 3 pierres. Elle extrait **1 minerai par seconde** parmi les cases de minerai situées **sous elle** et les **épuise vraiment** (les tas de minerai rapetissent à l'écran). Il faut du **combustible** (1 case : charbon = 100 s, bois = 20 s). Case de **stock** (100 max, un seul type d'objet) ; si elle est pleine ou si la sortie est bloquée, la foreuse s'arrête.
- **Fourneau** (2 × 2 cases) : 5 pierres. Cuit le minerai de fer / de cuivre en **lingot de fer / de cuivre** (3 s pièce) en brûlant du combustible. 3 cases : combustible, minerai à cuire (entrée), lingots (sortie).
- **Tapis roulant** (1 case, 1 lingot de fer) : 1,5 case par seconde, 3 objets au plus par case, objets espacés. Les machines et les tapis ont une **sortie** : la case juste devant le milieu du côté choisi (R). Un tapis dépose dans la machine ou le tapis qui est devant lui ; un tapis qui débouche sur rien bloque ses objets. La foreuse et le fourneau poussent leur stock sur le tapis (ou la machine) placé sur leur case de sortie ; un tapis ou une foreuse peut alimenter l'entrée d'un fourneau.
- **Pose** : mêmes cases de barre que les pièces de construction. Foreuse et fourneau : aperçu vert/rouge, **R** oriente la sortie (par défaut dans le sens du regard). Tapis : **maintenir le clic et tracer** avec le curseur pose plusieurs tapis à la suite ; chaque élément s'oriente vers le suivant et la **forme** (droit / virage) s'adapte aux voisins.
- **Panneau d'informations** sur le bord droit de l'écran quand on vise une machine ou un tapis : état (en marche, panne de combustible, plus de minerai, stock plein…), production, minerai restant à miner dessous, stock, combustible restant (en secondes), consommation électrique (aucune pour l'instant), vers quoi elle sort.
- **Interface** (touche **F** sur la machine visée) : le **sac reste affiché à gauche** (à la place du panneau de fabrication) et les cases de la machine à droite (combustible, minerai brut en entrée et lingots en sortie pour le fourneau, stock pour la foreuse). On **glisse** un objet du sac sur une case, ou on clique l'objet puis la case ; on **reprend** le contenu d'une case en la glissant sur le sac ou avec « Reprendre ». Une case refuse ce qu'elle ne sait pas traiter (le charbon ne se cuit pas, la pierre ne brûle pas). Les nombres se mettent à jour sans redessiner la fenêtre, pour ne pas gêner le glisser-déposer.
- **Démolir en tapant** : maintenir le clic gauche sur n'importe quelle construction ou machine la détruit (barre de progression) et rend **l'objet lui-même** (plus les ressources de fabrication, depuis le tour 39) ainsi que le contenu de la machine ; plus besoin d'avoir l'objet en main. (X en mode construction reste disponible.)
- Tout est enregistré avec la partie (`changes.machines`, objets sur les tapis compris). Les foreuses et tapis tournent tant que le jeu n'est pas en pause.

## Choix par défaut (à confirmer par le PO)

1. Une foreuse doit être posée sur au moins une case de minerai ; elle mine d'abord les cases dans l'ordre, un seul type de minerai à la fois dans son stock.
2. Pas encore d'électricité : la ligne « Consommation électrique » indique « aucune ».
3. Le fourneau n'a pas d'autre recette que les deux minerais.
4. Machines à plat au rez-de-chaussée uniquement, pas de pente (le monde est plat).
5. Les tapis n'ont pas d'embranchement ni de tri : un tapis qui rejoint un autre par le côté s'insère.

## À faire ensuite

Électricité (foreuse électrique, panneau « consommation »), embranchements, tri, coffres, véhicules, technologies.

## Tour 34 — coffres, commandes, boussole

- **Coffres** : en bois (16 cases) et en fer (32 cases), 1 case de 50 cm, piles de 100 au plus, plusieurs types d'objets. Recettes : 8 bois / 8 lingots de fer. Un tapis (ou une foreuse / un fourneau) qui débouche sur un coffre y dépose ses objets. Interface : le sac à gauche, les cases du coffre à droite ; on dépose en glissant (ou clic objet puis clic sur une case), on reprend en cliquant une case ou en la glissant sur le sac ; démolir un coffre rend son contenu.
- **Souris** (hors construction) : **clic gauche** sur une machine ou un coffre = ouvrir son interface (F marche aussi) ; **clic droit maintenu sans bouger** = démolir ce qui est visé (barre de progression) et récupérer les ressources. Si on bouge la souris avec le clic droit enfoncé, on tourne la caméra comme avant. Le clic gauche continue de récolter les ressources du monde.
- **Boîte blanche de visée** : supprimée en première personne (le réticule suffit).
- **R** : la première pression part de l'orientation actuelle (celle du regard ou du bord visé) et passe à la suivante ; on ne retombe plus deux fois sur la même.
- **Boussole** en haut de l'écran : N, NE, E, SE, S, SO, O, NO avec le cap en degrés. Convention du monde : le **nord est vers −z** (devant au départ), l'**est vers +x**.

## Tour 36 — correctifs

- **Échap** pour fermer une interface (sac, machine, coffre) ne rouvre plus le menu pause : en 1ère personne, le navigateur libère la souris au même moment ; on ignore ce relâchement pendant 0,6 s après la reprise du jeu.
- **Longs tapis** : la portée de pose des machines passe à 20 m (80 m en vue du dessus), et un tapis accepté au moment où on le trace le reste même si l'on s'en éloigne en marchant (les premiers tapis d'une longue ligne se retrouvaient hors de portée). Tracé de 150 tapis au plus.

## Tour 37 — électricité
- Générateur (300 kW, brûle du combustible proportionnellement à la charge), poteau (fil 8 m entre poteaux, raccord machine à 4 m), foreuse électrique (90 kW, 1,5 minerai/s, ralentit si le réseau est insuffisant).
- Satisfaction du réseau = capacité / demande. Le panneau affiche consommation, production, charge, état du raccordement.
- Vérifié : tests unitaires (réseaux, générateur, foreuse), lint, tsc, build. Non vérifié à l'œil en navigateur.

## Tour 38 — séparateur et groupeur
- **Séparateur** (1 entrée, 3 sorties) : reçoit un objet d'un tapis (ou d'une machine) et le renvoie à tour de rôle devant, à gauche, à droite ; si une sortie est bloquée, il essaie la suivante. Pas de sortie derrière.
- **Groupeur** (3 entrées, 1 sortie) : prend à tour de rôle sur les tapis qui arrivent derrière, à gauche et à droite, et sort devant. Il reçoit aussi directement d'une foreuse ou d'un fourneau.
- Recette : 5 lingots de fer. R oriente la sortie (la flèche verte du fantôme montre les sorties). Les tapis voisins se courbent vers eux automatiquement.
- Vérifié par tests unitaires (4 nouveaux, 291 au total) ; non vérifié visuellement.

## Tour 39 — retours PO
- Les fenêtres (sac, machine) n'ont plus de bouton « Fermer » : une croix ✕ en haut à droite (Échap fonctionne toujours).
- Détruire une construction ou une machine rend **l'objet** (ex. Mur en pierre, Fourneau) et non plus ses ressources de fabrication ; le contenu des machines/coffres revient aussi. Ce qui ne tient pas dans le sac tombe au sol.

## Tour 40 — prendre une partie d'une pile
- Sac et fenêtre machine : **clic droit** sur une pile = en prendre la moitié (arrondie au-dessus) ; **Ctrl + clic gauche** = fenêtre pour choisir la quantité. La quantité choisie (« En main : … ×N ») est celle déposée ensuite dans une case de machine ou un coffre (clic sur la case) ; clic gauche normal = toute la pile comme avant.
- Dans la fenêtre machine, clic droit sur une case de la machine ou du coffre = reprendre la moitié.
- Limite : le glisser-déposer à la souris déplace toujours la pile selon l'ancien comportement, sauf si une quantité a été choisie juste avant (elle est alors utilisée). Non vérifié visuellement.
