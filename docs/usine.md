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

## Tour 40 — pile au bout du curseur
- Sac et fenêtre machine : **clic droit** sur une pile = en prendre la moitié (arrondie au-dessus) ; **Ctrl + clic gauche** = fenêtre pour choisir la quantité. La quantité est retirée du sac et **suit le curseur** (« Bois ×10 », `GameState.hand`).
- Avec une pile au curseur : clic sur une case de machine (combustible/minerai) ou sur le coffre = dépôt (le reste demeure en main si la case est pleine ou refuse) ; clic dans le sac = on range ; fermer la fenêtre = on range aussi. Une sauvegarde compte la pile tenue dans le sac.
- Dans la fenêtre machine, clic droit sur une case de machine/coffre = en reprendre la moitié.
- Vérifié par test unitaire et script navigateur (curseur, dépôt dans un coffre, Ctrl+clic, fermeture).

## Tour 41 — retours PO (aspect des machines)
- **Générateur** : il tourne maintenant (R) et son carré clair indique la **face d'entrée du combustible** ; un tapis qui y débouche l'alimente (pas par les autres faces). Un fourneau accepte aussi le combustible par tapis (charbon, bois), en plus du minerai.
- **Séparateur / groupeur** : becs sombres = sorties, petits carrés clairs = entrées (1 pour le séparateur, 3 pour le groupeur). Les becs et carrés ne partagent plus de faces avec le boîtier (les motifs hachurés venaient de faces confondues).
- **Vérification des autres objets** : coffre — le fermoir ne tournait pas, corrigé ; poteau — symétrique, R ne change rien d'visible (normal) ; foreuses/fourneau/tapis — déjà orientés par leur bec de sortie. Le panneau d'un séparateur/groupeur n'affiche plus la ligne « consommation électrique ».
- Vérifié par tests (295) et capture navigateur (vue du dessus).

## Tour 42 — bras robotique et entrée de combustible
- **Bras robotique** (6 lingots de fer, R oriente) : prend l'objet de tête dans la case **derrière** (tapis, coffre, stock de sortie d'une foreuse/fourneau) et le dépose dans la case **devant** (machine, tapis, coffre, séparateur…), un aller-retour par 0,9 s. Il ne prend que ce que la destination accepte.
- Il fonctionne au **combustible** (fenêtre F : case combustible, 1 unité/s de combustion pendant qu'il travaille). Quand il lui reste moins de 15 s de combustible, il en prend un dans les cases voisines (derrière, côtés) — tapis ou coffre — au lieu de le transporter ; sans combustible du tout il s'arrête (« Panne de combustible ») mais en reprend dès qu'il en voit à côté.
- **Entrée de combustible** : foreuses à combustible et fourneaux ont un carré clair sur leur **face arrière** (opposée à la sortie) : un tapis ou un bras qui y débouche leur apporte du charbon/bois. Générateur : face avant (carré clair). Les autres faces refusent le combustible. Le minerai du fourneau reste accepté par toutes les faces.
- Vérifié : 5 tests d'unité (bras), capture navigateur (bras visibles). Équilibrage non testé.

## Tour 43 — bras sur 3 côtés, bras électrique, carte
- **Bras robotique** : prend maintenant sur **3 côtés** (derrière, gauche, droite — petits carrés clairs sur ces faces) à tour de rôle et dépose **devant**. Il peut prendre sur un tapis qui passe sur le côté (objet de tête de la case). Il prend uniquement ce que la destination accepte. Sans combustible (ou sans courant pour l'électrique) il ne fait rien : le panneau d'infos affiche « Panne de combustible » / « Pas de courant ».
- **Bras robotique électrique** (6 lingots de fer + 3 de cuivre) : même principe, 20 kW via un poteau (4 m), 0,45 s par aller-retour (×2), ralentit si le réseau manque de courant.
- **Carte (touche M)** : fenêtre avec le monde en pixels (1 pixel = 1 case de 50 cm) : biomes, eau, minerais (couleurs des gisements), arbres, rochers, nids, constructions, tapis et machines (contour doré si zoom ≥ ×4), flèche du joueur et nord. Glisser = déplacer, molette ou + / − = zoom (×1 à ×16), M / Échap / ✕ = fermer. Les zones sont dessinées au fur et à mesure (rayon de 28 chunks ≈ 225 m autour du joueur), le reste est « inexploré ». Le jeu est en pause pendant que la carte est ouverte.
- Limites : la carte ne montre pas l'épuisement des gisements (dessin figé à la génération) ; les zones « explorées » ne sont pas mémorisées entre deux ouvertures de partie.

## Tour 44 — assembleur
- **Assembleur** (2×2, 12 lingots de fer + 6 de cuivre, 60 kW via un poteau) : fabrique automatiquement un objet du jeu (tout objet ayant une recette : tapis, bras, coffres, pièces de construction…). On choisit la **recette** dans sa fenêtre (F) ; changer de recette rend ingrédients et produit au sac.
- **Entrées** : toutes les faces sauf la sortie (devant) acceptent, par tapis ou bras, uniquement les ingrédients de la recette (jusqu'à 4× la quantité nécessaire, 10 au minimum). Dans la fenêtre : glisser/cliquer un ingrédient du sac (ou la pile tenue au curseur) sur sa case ; clic sur la case = le reprendre.
- **Sortie** : 1 objet par 2 s à pleine puissance (plus lent si le réseau manque de courant), poussé vers la case devant (tapis, coffre, bras…). Un bras peut aussi y prendre le produit.
- Panneau d'infos : recette, ingrédients en attente (« 23/6 »), temps, stock, consommation. Vérifié : tests (fabrication, courant, ingrédients refusés, sauvegarde) et capture navigateur (bras électrique → assembleur → coffre).

## Tour 45 — correctif bras robotique
- **Cause du blocage constaté** : le bras ne regardait que l'objet de tête du tapis (ou la 1re pile du coffre). Si cet objet était refusé (ex. charbon devant du minerai), tout le reste restait coincé derrière. Le bras examine maintenant **tous** les objets du tapis / toutes les piles du coffre et prend le premier que la destination accepte.
- **Combustible** : un fourneau, une foreuse ou un générateur accepte désormais le combustible par **toutes les faces sauf leur sortie** (le carré clair reste l'entrée conseillée). Avant, seule la face arrière marchait, ce qui bloquait un bras posé sur le côté.
- Le panneau d'infos d'un bras indique la raison quand il ne bouge pas : rien devant, rien à prendre, ou « la destination refuse ces objets ».

## Tour 46 — retours PO
- **Flèches d'entrée et de sortie** : les petits/gros carrés sont remplacés par des flèches posées au sol dans la case voisine : **orange vers l'extérieur** = sortie, **bleu vers la machine** = entrée (fantôme de pose compris). Définies par `ports()` dans `factory.ts` : foreuse/fourneau (sortie devant, combustible derrière), générateur (combustible), séparateur (1 entrée, 3 sorties), groupeur / bras / assembleur (3 entrées, 1 sortie).
- **Tapis bloqué** : le panneau d'un tapis dit maintenant pourquoi son objet de tête ne passe pas (fourneau déjà rempli d'un autre minerai, entrée pleine, pas de combustible possible par cette face, coffre plein, rien devant…), via `Factory.refusal` / `beltBlock`.
- **Barre de raccourcis** : les quantités se mettent à jour quand on ramasse, récolte ou jette un objet (la pile ne prévenait pas le sac).
- **Échap dans une interface (1re personne)** : le navigateur refuse de recapturer la souris sans geste ; le jeu réessaie à la première touche (ou clic) suivante au lieu de laisser le curseur libre.

## Tour 47 — équipement, sac à dos, fibres, marcher avec le sac ouvert
- **Marcher avec le sac ouvert** : le sac ne fige plus le jeu (usine et déplacements continuent) ; la souris est libre pour l'utiliser, le clic ne récolte pas ni ne démolit et la caméra ne tourne pas. Les fenêtres machine, carte et pause figent toujours le jeu.
- **Équipement** (colonne à gauche du sac) : **Tête**, **Tronc** avec les **Mains** (une seule case pour les deux mains, collée à droite du tronc — facile à déplacer si le rendu ne plaît pas), **Jambes**, **Pieds**. On équipe en glissant, ou en sélectionnant l'objet du sac (ou la pile tenue au curseur) puis en cliquant la case ; un clic sur une case remplie retire l'objet ; un équipement déjà porté revient au sac (échange). Les objets équipés quittent le sac (ils ne comptent plus dans son poids). L'équipement est enregistré avec la partie.
- **Sac à dos** (6 tissus), emplacement Tronc : **+10 cases, +20 kg, +30 L**. On ne peut pas l'enlever si le sac contiendrait alors plus que sa capacité de base.
- **Fibres** : nouveau **buisson de fibres** dans le monde (se traverse, se récolte en 0,4 s, 3 fibres, plutôt en prairie/forêt) ; **Fibre** (combustible faible : 6 s) → **Tissu** (4 fibres) → **Sac à dos**, **Capuche** (tête), **Pantalon** (jambes), **Bottes** (pieds), **Gants** (mains). Les vêtements n'ont pas encore d'effet (emplacements et recettes seulement).
- Les mondes déjà créés reçoivent des buissons : quelques arbres/rochers très proches d'un buisson peuvent changer de place.

## Tour 48 — technologies (touche T)
- **Fenêtre Technologies** : une carte par technologie avec son coût (objets du sac, consommés à la recherche), ses prérequis et ce qu'elle débloque. Le jeu est en pause pendant qu'elle est ouverte ; T / Échap / ✕ pour fermer.
- **Technologies** (`content/techs.json`) : *Logistique* (20 lingots de fer → séparateur, groupeur, coffre en fer, bras), *Textile* (30 fibres → tissu, sac à dos, vêtements), *Électricité* (30 fer + 20 cuivre → poteau, générateur, foreuse électrique), *Automatisation* (40 fer + 30 cuivre, nécessite Électricité et Logistique → bras électrique, assembleur).
- **Effet** : seule la **fabrication** à la main est bloquée (case grisée en pointillés dans le panneau de fabrication, info-bulle « Technologie requise »). Un objet qui n'est dans aucune technologie (pièces de construction, foreuse, fourneau, tapis, coffre en bois) reste disponible dès le départ. Les objets déjà possédés ou posés ne sont pas touchés.
- **Sauvegardes** : enregistrées avec la partie (`changes.unlocked`) ; une ancienne partie, créée avant les technologies, a tout débloqué. Ajouter une technologie = ajouter une entrée dans `techs.json` + son nom `tech.<id>` dans les deux fichiers de langue.
- Vérifié : tests (fabrication refusée, coût, prérequis, sauvegarde) et script navigateur (T, recherche du Textile, cases verrouillées).

## Tour 49 — correctif : viser les buissons de fibres
- **Cause** : le nom du buisson affiché au survol (`target.fiber_bush`) manquait dans les fichiers de langue ; l'interface levait une erreur à chaque image tant que le curseur visait un buisson (d'où le lag et le curseur/le cadre qui « saute », et impossibilité de cibler).
- **Correctif** : texte ajouté en français et anglais ; `t()` ne plante plus sur une clé manquante (affiche la clé) ; un test vérifie que **chaque ressource du monde** a ses textes (`res.*`, `target.*`) dans les deux langues, pour ne plus oublier lors de l'ajout d'une ressource.

## Tour 50 — catégories de fabrication et équipement visible
- **Fabrication par catégories** (onglets au-dessus de la grille) : *Machines* (tout `machine_*` : foreuses, tapis, coffres, poteaux, bras, assembleur…), *Ustensiles* (tout le reste : matières, lingots, fibre, tissu — nom provisoire), *Constructions* (`piece_*`), *Équipements* (tout objet qui se porte). La catégorie est déduite par `categoryOf()` dans `items.ts` ; les noms sont dans `craft.cat.*` (fr/en) pour les renommer facilement.
- **Équipement visible** : ce qu'on porte apparaît sur le personnage (3ème personne / vue du dessus) sous forme de **formes simples** provisoires : sac à dos (boîte dans le dos + rabat), capuche (calotte sur la tête), pantalon (manchon sur le bas du corps), bottes (anneau aux pieds), gants (deux boules aux mains), à la couleur de l'objet. Mis à jour à chaque changement d'équipement (`refreshWorn` dans `gameView.ts`). Plus tard : de vrais modèles par objet.

## Tour 51 — laboratoire et paquets de science
- **Fabrication** : les matières récoltées ou produites en machine (bois, pierre, minerais, charbon, lingots, fibre…) n'apparaissent plus dans le panneau de fabrication (seulement ce qui a une recette).
- **Paquet de science** (1 lingot de fer + 1 lingot de cuivre, fabricable à la main ou à l'assembleur) et **Laboratoire** (2×2, 10 fer + 8 cuivre, débloqué par *Électricité*, 30 kW par poteau).
- **Étude** : la technologie *Automatisation* coûte maintenant **20 paquets de science** : dans la fenêtre T, « Étudier en laboratoire » la choisit (une seule étude à la fois, « Arrêter l'étude » pour changer). Chaque laboratoire alimenté en courant et en paquets (tapis, bras, ou à la main dans sa fenêtre F) consomme **1 paquet / 6 s** (plus lent si le réseau manque de courant) ; plusieurs laboratoires s'additionnent. À 20 paquets étudiés la technologie se débloque. L'avancement est enregistré avec la partie. Les technologies à coût en objets (Logistique, Textile, Électricité) restent instantanées dans la fenêtre T.
- Panneau d'infos du laboratoire : étude en cours (avancement), paquets en réserve, consommation. Flèches bleues = entrées sur les 4 côtés.
- Vérifié : tests (consommation, courant, entrée refusée si ce n'est pas un paquet, sauvegarde) et script navigateur (étude lancée, avancement après 14 s).
