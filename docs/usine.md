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
- **Carte (touche M)** : fenêtre avec le monde en pixels (1 pixel = 1 case de 50 cm) : biomes, eau, minerais (couleurs des gisements), arbres, rochers, nids, constructions, tapis et machines (contour doré si zoom ≥ ×4), flèche du joueur et nord. Glisser = déplacer, molette ou + / − = zoom (×1 à ×16), M / Échap / ✕ = fermer. Les zones sont dessinées au fur et à mesure (rayon de 28 chunks ≈ 225 m autour du joueur), le reste est « inexploré ». Le jeu continue pendant que la carte est ouverte (tour 59).
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

- **Fenêtre Technologies** : une carte par technologie avec son coût (objets du sac, consommés à la recherche), ses prérequis et ce qu'elle débloque. Le jeu continue pendant qu'elle est ouverte (tour 59) ; T / Échap / ✕ pour fermer.
- **Technologies** (`content/techs.json`) : _Logistique_ (20 lingots de fer → séparateur, groupeur, coffre en fer, bras), _Textile_ (30 fibres → tissu, sac à dos, vêtements), _Électricité_ (30 fer + 20 cuivre → poteau, générateur, foreuse électrique), _Automatisation_ (40 fer + 30 cuivre, nécessite Électricité et Logistique → bras électrique, assembleur).
- **Effet** : seule la **fabrication** à la main est bloquée (case grisée en pointillés dans le panneau de fabrication, info-bulle « Technologie requise »). Un objet qui n'est dans aucune technologie (pièces de construction, foreuse, fourneau, tapis, coffre en bois) reste disponible dès le départ. Les objets déjà possédés ou posés ne sont pas touchés.
- **Sauvegardes** : enregistrées avec la partie (`changes.unlocked`) ; une ancienne partie, créée avant les technologies, a tout débloqué. Ajouter une technologie = ajouter une entrée dans `techs.json` + son nom `tech.<id>` dans les deux fichiers de langue.
- Vérifié : tests (fabrication refusée, coût, prérequis, sauvegarde) et script navigateur (T, recherche du Textile, cases verrouillées).

## Tour 49 — correctif : viser les buissons de fibres

- **Cause** : le nom du buisson affiché au survol (`target.fiber_bush`) manquait dans les fichiers de langue ; l'interface levait une erreur à chaque image tant que le curseur visait un buisson (d'où le lag et le curseur/le cadre qui « saute », et impossibilité de cibler).
- **Correctif** : texte ajouté en français et anglais ; `t()` ne plante plus sur une clé manquante (affiche la clé) ; un test vérifie que **chaque ressource du monde** a ses textes (`res.*`, `target.*`) dans les deux langues, pour ne plus oublier lors de l'ajout d'une ressource.

## Tour 50 — catégories de fabrication et équipement visible

- **Fabrication par catégories** (onglets au-dessus de la grille) : _Machines_ (tout `machine_*` : foreuses, tapis, coffres, poteaux, bras, assembleur…), _Ustensiles_ (tout le reste : matières, lingots, fibre, tissu — nom provisoire), _Constructions_ (`piece_*`), _Équipements_ (tout objet qui se porte). La catégorie est déduite par `categoryOf()` dans `items.ts` ; les noms sont dans `craft.cat.*` (fr/en) pour les renommer facilement.
- **Équipement visible** : ce qu'on porte apparaît sur le personnage (3ème personne / vue du dessus) sous forme de **formes simples** provisoires : sac à dos (boîte dans le dos + rabat), capuche (calotte sur la tête), pantalon (manchon sur le bas du corps), bottes (anneau aux pieds), gants (deux boules aux mains), à la couleur de l'objet. Mis à jour à chaque changement d'équipement (`refreshWorn` dans `gameView.ts`). Plus tard : de vrais modèles par objet.

## Tour 51 — laboratoire et paquets de science

- **Fabrication** : les matières récoltées ou produites en machine (bois, pierre, minerais, charbon, lingots, fibre…) n'apparaissent plus dans le panneau de fabrication (seulement ce qui a une recette).
- **Paquet de science** (1 lingot de fer + 1 lingot de cuivre, fabricable à la main ou à l'assembleur) et **Laboratoire** (2×2, 10 fer + 8 cuivre, débloqué par _Électricité_, 30 kW par poteau).
- **Étude** : la technologie _Automatisation_ coûte maintenant **20 paquets de science** : dans la fenêtre T, « Étudier en laboratoire » la choisit (une seule étude à la fois, « Arrêter l'étude » pour changer). Chaque laboratoire alimenté en courant et en paquets (tapis, bras, ou à la main dans sa fenêtre F) consomme **1 paquet / 6 s** (plus lent si le réseau manque de courant) ; plusieurs laboratoires s'additionnent. À 20 paquets étudiés la technologie se débloque. L'avancement est enregistré avec la partie. Les technologies à coût en objets (Logistique, Textile, Électricité) restent instantanées dans la fenêtre T.
- Panneau d'infos du laboratoire : étude en cours (avancement), paquets en réserve, consommation. Flèches bleues = entrées sur les 4 côtés.
- Vérifié : tests (consommation, courant, entrée refusée si ce n'est pas un paquet, sauvegarde) et script navigateur (étude lancée, avancement après 14 s).

## Tour 52 — vapeur : pompe, tuyaux, chaudière, turbine

- **Technologie « Vapeur »** (30 fer + 15 cuivre + 10 pierre, après Électricité) débloque : **Tuyau** (1 lingot de fer), **Pompe à eau électrique** (5 fer + 3 cuivre), **Chaudière** (10 fer + 5 pierre), **Turbine à vapeur** (12 fer + 8 cuivre).
- **Fluides** (`src/core/factory/fluids.ts`) : eau et vapeur circulent par **équilibrage des niveaux** entre machines raccordées (le débit dépend de l'écart de pression : un long tuyau perd en débit). Un tuyau porte **un seul fluide à la fois**. Prises : _pompe_ = sortie d'eau devant ; _chaudière_ (2×2) = eau en entrée derrière, vapeur en sortie devant, **combustible par les côtés** (tapis, bras, main) ; _turbine_ (1×2) = vapeur en entrée derrière, **le reste ressort devant** pour la turbine suivante ; _tuyau_ = les 4 côtés. Les prises se raccordent quand elles se font face (flèches bleues = eau, blanches = vapeur). Tuyaux posés **en traçant un chemin** comme les tapis.
- **Pompe** : se pose **au bord de l'eau** (une case d'étang voisine), 20 kW, 100 unités/s, réserve 100.
- **Chaudière** : transforme jusqu'à 60 eau/s en vapeur tant qu'il y a du combustible et de la place (réserve 200) ; brûle proportionnellement à la vapeur produite.
- **Turbine** : jusqu'à **200 kW**, rendement selon la pression de sa réserve (0 sous 20 %, plein à 60 %) ; consomme jusqu'à 20 vapeur/s proportionnellement au courant demandé. En **file indienne**, chaque turbine laisse passer le reste : si la vapeur manque, la pression baisse le long de la file et les dernières produisent moins ou plus du tout. Se raccorde au réseau par un poteau comme un générateur.
- Panneau d'infos : eau/vapeur contenues, pression (%), production de la turbine. Pas de fenêtre F pour tuyau/pompe/turbine (seule la chaudière a un emplacement de combustible).
- Vérifié : tests (pompe au bord de l'eau, circulation, chaudière sans combustible, file de turbines) + scène navigateur (pompe → 3 tuyaux → chaudière → tuyau → turbine : 200 kW, pression 100 %).

## Tour 53 — pollution et ennemis (`src/core/game/threat.ts`)

- **Pollution** : les machines qui **travaillent** polluent (valeur `pollution` par seconde dans `content/machines.json` : foreuse 0,6, foreuse électrique 0,3, fourneau 0,5, générateur 1, chaudière 2, assembleur 0,2, laboratoire 0,1 ; le panneau d'infos l'indique par minute). Elle s'accumule par **cellule de 32 m** (4×4 chunks), **s'étale** lentement aux 4 voisines quand elle dépasse 6, et est **absorbée** par le sol (0,05/s) et par les **arbres** (0,01/s chacun). Elle est enregistrée avec la partie (`changes.pollution`) et visible sur la **carte (M)** en voile rouge.
- **Nids** : un nid absorbe jusqu'à 1,5 pollution/s dans sa cellule et les 8 voisines ; tous les 20 points absorbés (12 si « ennemis agressifs ») il fabrique **un ennemi** (25 PV, au plus 25 en même temps).
- **Ennemis** (punaises rouges, points rouges sur la carte) : marchent vers l'**installation polluante** la plus proche (jusqu'à 160 m) et la détruisent (6 PV/s ; une machine a 120 PV, détruite sans rien rendre ; les PV des machines ne sont pas enregistrés). Ils s'en prennent au **joueur** s'il passe à moins de 9 m (28 m et plus rapides en mode « agressifs »). Sans cible pendant 90 s, ils disparaissent.
- **Joueur** : 100 PV (barre rouge en bas, visible quand blessé ou quand des ennemis sont là), +4 PV/s après 5 s sans coup ; à zéro, retour au point de départ avec tout son sac. **Clic gauche** à moins de 2,6 m d'un ennemi = coup (12 dégâts, 0,45 s) : à proximité d'un ennemi le clic frappe aussi bien qu'il récolte.
- Pas encore : expansion des nids (`enemies.expand`), armes/tourelles, sons dédiés, sauvegarde des ennemis. Équilibrage à faire.
- Vérifié : 6 tests (pollution, arbres, nids, cibles, agressivité, sauvegarde) et scène navigateur (pollution préchargée près d'un nid → 4 ennemis marchent vers 2 fourneaux).

## Tour 54 — pistolet, gardiens, deux pollutions, arbres

- **Gardiens de nid** : un nid ne reste plus vide. Quand le joueur s'approche à moins de 90 m, **3 gardiens** apparaissent (un gardien tué revient 2 min plus tard). Ils restent près du nid et ne poursuivent que le joueur qui passe à moins de 14 m (ils rentrent chez eux au-delà de 40 m). Les **vagues** (nées de la pollution) restent séparées : elles marchent vers les installations polluantes.
- **Pistolet** (8 lingots de fer) et **Chargeur** (2 lingots de fer, **12 balles**) dans l'onglet Ustensiles. Mettre le pistolet dans la barre de raccourcis et le sélectionner : **clic gauche = tirer** (10 dégâts, 3 balles pour tuer un ennemi de 25 PV, 0,35 s entre deux tirs, portée 40 m, visée au centre en 1ère personne, sous le curseur sinon, trait lumineux), **R = recharger** (consomme un chargeur, le reste des balles est perdu). Compteur « Balles 7 / 12 · chargeurs : 3 » ; en main il remplace la pioche, et le clic ne récolte plus. Sans pistolet, le coup de poing de proximité reste. Balles chargées enregistrées avec la partie. Sons : tir, rechargement, ennemi touché.
- **Deux pollutions** (`pollutionKind` dans `machines.json`) : **fumées (air)** pour fourneaux, générateurs et chaudières : elles se répandent et les arbres les absorbent ; **pollution du sol** pour foreuses, assembleur, laboratoire : elle reste sur place (cellule de 32 m) et ne s'efface que très lentement (0,01/s). Les deux nourrissent les nids. Carte : voile rouge pour l'air, brun pour le sol. Les panneaux d'infos indiquent le type.
- **Arbres** : tronc haut et fin, **feuillage au-dessus de 2 m** : le personnage (1,70 m) passe sous les branches et ne **bute que sur le tronc** (une case de 50 cm). Hauteur de visée portée à 4,2 m.
- Vérifié : tests (gardiens, pollution du sol, tir par rayon via `Threat.shoot` indirectement par le jeu) + scène navigateur (barre de santé car gardiens proches, tir 12 → 7 balles, R remet 12 et décompte un chargeur).

## Tour 55 — machines plus grandes (+10 cm)

- Toutes les machines (sauf les tapis) sont **dessinées 10 cm plus larges, plus longues et plus hautes** que leur emprise (`GROW_M` dans `machines.ts` ; `growBody` dans `factoryView.ts` agrandit le modèle autour de son centre au sol). L'emprise sur la grille (cases de 50 cm), les collisions et les raccords ne changent pas ; la hauteur de visée suit (`visualHeight`).
- Les **tapis** gardent leur hauteur et sont **10 cm plus larges** (52 cm : ils se touchent d'une case à l'autre).

## Tour 56 — emprises agrandies (+1 case) et tapis en tuiles de 2 × 2

- **Machines** : chaque machine gagne **1 case** en largeur et en profondeur (`content/machines.json`) : foreuses **4×4**, fourneau / générateur / chaudière / assembleur / laboratoire **3×3**, turbine **2×3**, coffres / pompe / tuyau / séparateur / groupeur / bras / poteau **2×2**. L'emprise sur la grille (et donc les collisions, le minerai sous la foreuse, les raccords) suit ; le dessin garde en plus les +10 cm du tour 55. Les sorties/entrées restent « au milieu du côté » (case du milieu, ou la seconde des deux pour une largeur paire) : les flèches au sol montrent la case exacte.
- **Tapis (et tuyaux)** : un élément occupe une **tuile de 2 × 2 cases (1 m)** alignée sur une grille de 2 cases ; les objets passent par le **milieu** du tapis. On les trace comme avant (clic maintenu, le chemin se fait tuile par tuile, virages automatiques). Vitesse conservée en mètres par seconde (0,75 tuile/s), 6 objets par tuile.
- **Anciennes parties** : à l'ouverture, les tapis sont recalés sur la grille de tuiles ; les machines gardent leur coin, et celles qui se chevauchent maintenant sont **retirées et posées au sol** (à ramasser). Marqueur `footprintVersion` dans la sauvegarde.
- Vérifié : tests (emprises 4×4/3×3/2×2, sorties, migration d'ancienne partie, vapeur et fluides en 2×2) et scène navigateur (foreuse 4×4 → tuiles de tapis → fourneau).
- Limite : plusieurs anciens tests de bras, laboratoire, assembleur et réseau électrique sont posés sur des coordonnées de l'ancienne taille (ils se chevauchent) mais passent encore ; ils seront remis en géométrie propre.

## Tour 57 — correctif : poser un tapis contre la sortie d'une machine

- Les tuiles de tapis/tuyau ne sont plus calées sur une grille fixe de 2 cases : la tuile se pose **là où l'on vise** et se décale d'une case si besoin (4 positions autour du curseur, la première libre) pour **toucher la sortie** de la machine (qui tombait avant sur une tuile chevauchant la foreuse : case rouge). Les tuiles suivantes d'un chemin avancent de 2 cases à partir de la précédente.
- Vérifié en navigateur : foreuse 4×4, tuile verte contre sa sortie, tracé de 2 tuiles posées (sac 20 → 18).

## Tour 58 — tapis et tuyaux à cheval sur une machine

- Un **tapis ou un tuyau** peut maintenant être posé **à moitié dans une machine** (la partie dans la machine est cachée) : il suffit qu'au moins une de ses 4 cases soit libre et visible. Il reste interdit entièrement dans une machine (rien de visible), sur un autre tapis/tuyau, ou sur un terrain bloqué ; une **machine** ne peut pas se poser sur un tapis ou un tuyau (même caché en partie).
- Sur les cases partagées, c'est la machine qui répond (sorties, raccords, visée) ; la tuile ne « possède » que ses cases libres. Vérifié par test et en navigateur (tuile verte à moitié sous la foreuse, posée : sac 20 → 19).

## Tour 59 — seul le menu pause fige le jeu

- Les fenêtres **machine / coffre**, **sac**, **carte (M)** et **technologies (T)** ne mettent plus le jeu en pause : l'usine, les ennemis et la pollution continuent, et le joueur peut marcher (la souris est libre, le clic ne récolte ni ne démolit, la caméra ne tourne pas). **Seul le menu ouvert par Échap fige le jeu.**
- Vérifié en navigateur : étude d'une technologie en laboratoire pendant que la fenêtre Technologies reste ouverte (l'avancement progresse).

## Tour 60 — machines pleines, tapis qui emportent

- Le joueur **ne traverse plus les machines ni les tuyaux** (toute leur emprise bloque, comme un mur) ; les **tapis se marchent**. Si une machine est posée sur le joueur, il peut en sortir librement.
- Un **tapis emporte le joueur** qui s'y tient (au sol), dans le sens du tapis, à la vitesse des objets (0,75 m/s), tant qu'aucun obstacle ne bloque ; marcher dans le sens contraire ralentit, dans le même sens accélère.
- Vérifié en navigateur : le joueur posé sur deux tuiles de tapis est emmené jusqu'au bout (21,2 → 23,0 m) puis s'arrête avant le fourneau (en marchant vers lui il reste à 23,5 m, devant la machine qui commence à 24 m).

## Tour 61 — pompe au bord de l'eau, démolir en construisant, angles de tapis

- **Pompe** : elle se pose **à cheval sur la rive** : la ligne côté sortie sur la **terre**, le reste de son emprise dans l'**eau** (ses cases dans l'étang ne sont plus « bloquées »). Tout sur la terre ou tout dans l'eau est refusé.
- **Démolir pendant la construction** : avec un objet sélectionné dans la barre de raccourcis, le **clic droit maintenu** (sans bouger) démolit la construction ou machine visée ; le fantôme de pose reste actif. En construction, la visée ne cible que les constructions et machines (pas les ressources) et le clic gauche ne fait que poser.
- **Angles de tapis** : correctif : l'entrée d'un tapis qui tourne était prise du mauvais côté (gauche/droite inversés), d'où des objets qui arrivaient « de l'autre côté ». Les tapis dessinent maintenant une **voie centrale foncée** de l'entrée à la sortie (en L dans un angle) avec la flèche à la sortie.
- Vérifié : tests (pompe), scène navigateur (angle en L, démolition d'un tapis avec le tapis en main : sac 5 → 6).

## Tour 62 — raccords souples, tuyaux continus, poteau fin, texture des tapis

- **Chaudière « Pas d'eau » malgré des tuyaux pleins** : les raccords de fluides exigeaient que la case du **milieu** de chaque côté tombe exactement dans l'autre machine, impossible à viser avec des tuiles posées librement. Maintenant deux machines se raccordent dès que leurs côtés **se touchent** et que chacune a une prise sur le côté qui fait face à l'autre (décalage libre). Même souplesse pour les **tapis, sorties de machines, séparateurs et bras** : toute machine qui touche le côté de sortie (ou d'entrée) convient. Test : tuyau décalé → la chaudière se remplit.
- **Tuyaux** : le moyeu est plus gros et les manchons vont **jusqu'au bord de la tuile** (tuyau continu, plus de blocs séparés) ; le contenu (bleu = eau, blanc = vapeur) se voit en bande sur le dessus.
- **Poteau** : mât plus **haut** (3,6 m) et boîte de visée **fine** (30 cm) ; on ne le vise ni ne bute dessus que près du mât (18 cm), pas sur toute son emprise de 2 × 2 cases. Fil raccordé en haut.
- **Tapis (texture)** : la voie centrale et la flèche étaient des faces superposées (scintillement) ; la voie est maintenant en deux morceaux qui ne se recouvrent pas et la flèche est un peu au-dessus.

## Tour 63 — tapis en hauteur, ponts et tunnels

- **7 formes de tapis** (champ `lift`, enregistré avec la partie) choisies en construction avec **PageUp / PageDown** (affichées dans le HUD) : 0 à plat (sol) · 1 **rampe montante** (45°, 1 m de dénivelé sur une tuile) · 2 **surélevé** (1 m) · 3 **rampe descendante** · 4 **entrée de tunnel** · 5 **souterrain** · 6 **sortie de tunnel**. C'est le même objet « tapis » : aucun nouvel objet à fabriquer.
- **Couches d'espace** : chaque forme occupe des couches (sol 0, air 1, sous terre −1). Un tapis surélevé laisse le sol libre dessous (on peut passer **par-dessus** un tapis, un tuyau, une machine) ; un tunnel laisse libre la surface au-dessus (on passe **sous** tout). Deux tapis ne se chevauchent que s'ils sont dans des couches différentes.
- **Raccords** : un tapis ne reçoit que d'un tapis dont le niveau de sortie est son niveau d'entrée (sol→rampe→air→rampe→sol ; sol→entrée→sous terre→sortie→sol). Les machines, séparateurs, groupeurs et bras ne se branchent qu'au sol. Les pentes avancent à 70 % de la vitesse (trajet plus long).
- **Piliers (à valider)** : purement visuels pour l'instant, un pilier sous un tapis surélevé toutes les 5 tuiles dans l'axe, sauf quand un tapis passe dessous. Rien n'est exigé pour poser (à décider avec le PO). Les tunnels sont dessinés comme une plaque sombre avec un portail ; les objets y disparaissent.
- Joueur : les rampes sont pleines (on les contourne) ; on marche toujours sur les tapis à plat ; on passe **sous** un tapis surélevé sans le heurter (hauteur 1 m, pas de collision pour l'instant). Visée : on cible un tapis en l'air entre 0,85 et 1,3 m, un tunnel par sa plaque à ras du sol.
- À faire plus tard (demande du PO) : retirer les tunnels au profit de tapis qui descendent sous terre (la rampe descendante existe déjà côté air).
- Vérifié : 4 tests (pont au-dessus d'un tapis, raccord refusé sans rampe, tunnel sous un coffre, enregistrement), scène navigateur (pont et tunnel, aucune erreur console). Non vérifié : pose à la souris en jeu (PageUp/PageDown), rendu de tous les angles.

## Tour 64 — tunnels « à la Factorio », calage des rampes, Maj + clic, halo

- **Tunnels** : plus de tapis souterrains. Deux pièces seulement (formes 4 et 5 de PageUp/PageDown) : une **entrée** et une **sortie** alignées (même sens, jusqu'à 8 tuiles) ; entre les deux **il n'y a rien** (on passe sous tout : tapis, tuyaux, machines). Les objets disparaissent dans le portail de l'entrée et ressortent à celui de la sortie après le temps du trajet. Une sortie ne reçoit que de son entrée ; une entrée sans sortie bloque. Les anciennes formes souterraines (5/6 du Tour 63) sont perdues.
- **Calage des rampes** : viser une rampe (base ou sommet) cale le patron **à sa suite** (au sommet d'une montée → tapis surélevé ; au pied d'une descente → tapis au sol). En traçant, la forme **s'enchaîne** (rampe montante → surélevé → …) au lieu de répéter la rampe ; PageUp / PageDown pendant le tracé change la forme du tapis sous le curseur, la suite suit.
- **Ouvrir un coffre / une machine avec un objet en main** (barre de raccourcis) : la touche d'utilisation fonctionne aussi en construction.
- **Maj + clic** : sur une pile du sac dans la fenêtre d'une machine, elle part dans la bonne case (coffre, ingrédient d'assembleur, combustible ou minerai ; rien si la machine ne la veut pas, jamais dans une case de sortie) ; sur une case de la machine / du coffre, elle revient dans le sac.
- **Halo de transparence** : il ne troue plus que ce qui dépasse de 45 cm (murs, arbres, machines) ; les tapis, tuyaux et cailloux au sol ne le déclenchent plus, d'où plus de halo vert permanent.
- **Pas encore fait** : installation complète en hauteur (séparateurs, bras et machines posés sur des **dalles** à l'étage) ; il faudra des machines à un niveau ≠ 0.
- Vérifié : tests tunnels, scène navigateur sans erreur. Non vérifié à la souris : calage des rampes, Maj + clic, ouverture d'un coffre avec un objet en main. Test `worldgen` « aucun nid à moins de 250 m » : dépasse 5 s (échoue aussi sans mes changements).

## Tour 65 — tracer un tunnel d'un seul geste

- En **traçant** des tapis (clic maintenu), **PageDown** sur le tapis sous le curseur y met une **entrée de tunnel** (ou une rampe descendante si on est en l'air) ; les tuiles suivantes ne sont **pas posées** (le tunnel passe dessous, le ghost ne les montre pas) ; **PageUp** met une **sortie de tunnel** (ou une rampe montante si on est au sol) et le tracé continue à plat. Rappuyer en sens inverse sur la même tuile annule. Hors tracé, PageUp / PageDown garde le choix de la forme du premier tapis.
- Validation du tunnel : entrée et sortie alignées, même sens, au plus 8 tuiles ; sinon elles restent rouges et ne sont pas posées (une entrée sans sortie non plus). Ne pas poser l'entrée sur un tapis existant : elle se met avant le croisement.
- Vérifié en navigateur (vue du dessus) : tracé à travers un tapis → entrée, trou, sortie, tapis à plat ; 3 tapis consommés, tapis du croisement intact.

## Tour 66 — démolition en chaîne, piles du sac, objet en main, outils, poteaux en série

- **Démolition** : après une démolition, le clic droit toujours maintenu continue de démolir les suivants (même en bougeant la souris).
- **Sac** : boutons jeter 1 / 10 / tout retirés. Le sac a maintenant de **vraies cases** (`GameState.bagSlots`) : plusieurs piles du même objet avec des quantités différentes ; clic droit / Ctrl+clic prennent dans la pile cliquée ; cliquer une case avec la pile au curseur la pose (vide : nouvelle pile, même objet : on complète, autre objet : échange) ; glisser une pile sur une autre case la déplace / fusionne / échange ; **glisser une pile hors de la fenêtre la jette par terre**. Les cases du sac sont recalculées d'après le contenu (le découpage en piles n'est pas sauvegardé : au chargement les piles sont regroupées).
- **Objet en main** : un objet posable (machine, pièce) sélectionné dans le sac reste **en main** quand on ferme le sac (✕ ou Échap) et passe avant la barre de raccourcis ; un **clic droit bref** vide les mains. Choisir une case de la barre reprend la main.
- **Outils** : nouvelle **case d'outils** à droite de la barre (après un espace) — on y glisse un outil ou le pistolet (sauvegardé : `changes.tools`, 1 case, extensible par un futur vêtement). Nouveaux objets **Outil en pierre** (vitesse ×2) et **Outil en fer** (×3,5 et 2 unités par coup) ; **mains nues = ×3 plus long**. L'outil ne se voit dans les mains que **pendant l'action** (couper, casser, miner) ; le marteau permanent est remplacé par une **main nue** en 1ère personne. Pistolet dans la case d'outils : il tire (clic gauche) quand il n'y a rien à récolter sous la visée, et n'apparaît que pendant le tir. Le pistolet choisi dans la barre marche toujours comme avant.
- **Prix** : toutes les recettes existantes sont **doublées**. Outil en pierre : 6 bois + 4 pierres ; outil en fer : 6 lingots de fer + 4 bois.
- **Poteaux en série** : en gardant le clic gauche et en marchant, un nouveau poteau se pose à la limite du câble (8 m) derrière le joueur, tant qu'il en a.
- **Tapis** : emportent le joueur 2× plus vite (`CARRY_BOOST`).
- Vérifié : tests (piles, main, outils ; recettes mises à jour), scène navigateur (case d'outils affichée, 2 poteaux posés en marchant 12 m, aucune erreur). Non vérifié à la souris : glisser-déposer des piles, jet hors fenêtre, objet en main après fermeture du sac, clic droit bref, récolte avec outil visible dans les mains. Non équilibré : vitesses, rendement, prix.

## Tour 67 — pile posée dans une case vide (fenêtre de machine), séparateur / groupeur sur un tapis

- **Piles** : dans la colonne « sac » de la **fenêtre d'une machine / d'un coffre**, poser la pile du curseur dans une case vide la refusionnait avec la première pile (ancien code). Elle utilise maintenant `placeHand` comme le sac : case vide = nouvelle pile, même objet = on complète, autre objet = échange.
- **Séparateur / groupeur sur une ligne** : on peut les poser **sur des tapis à plat** ; les tapis recouverts sont **remplacés** (ils reviennent dans le sac avec leur contenu) et la chaîne continue de part et d'autre (`Factory.replacedBelts`, `canPlace` accepte les tapis pour les routeurs). Test : un objet traverse un groupeur posé au milieu d'une ligne. Les autres machines et les tapis surélevés / rampes / tunnels ne sont pas remplaçables.

## Tour 68 — continuer un chemin en l'air

- **Cause** : la case visée était toujours celle du **sol** sous le curseur ; un tapis à 1 m de haut se projette ailleurs (perspective), donc le patron ne se calait pas à sa suite. Maintenant : le rayon de visée est testé contre les tapis en l'air / rampes (`pickMachine`) et, en traçant en l'air, la case visée est celle du **plan à 1 m**.
- Viser un tapis en l'air ou une rampe cale le patron sur la **première tuile libre au bout de la ligne** déjà posée (même sens, forme qui prolonge : surélevé après une montée ou un surélevé, sol après une descente). Le tracé en l'air ne dérive plus.
- Vérifié en navigateur : vue du dessus et 3e personne (patron vert calé juste après le dernier tapis surélevé). 1ère personne : même code, non vérifié visuellement.

## Tour 69 — niveau 2 (2 m) et joueur qui ne traverse plus les tapis en l'air

- **Niveau 2** : trois formes de plus, au même principe que le niveau 1 : rampe montante 1 → 2 (forme 6), **tapis surélevé niveau 2 à 2 m** (forme 7, on passe dessous), rampe descendante 2 → 1 (forme 8). Dans un tracé, PageUp / PageDown montent / descendent d'un niveau à partir du tapis sous le curseur (sol → 1 → 2 et retour) ; la suite s'enchaîne (surélevé après une montée) ; viser une ligne en l'air cale le patron à sa suite et la visée utilise le plan du bon niveau (1 m ou 2 m). Un pont de niveau 2 passe au-dessus d'un pont de niveau 1 (couches séparées). Piliers : à la hauteur du tapis, jamais à travers un tapis dessous.
- **Joueur** : les tapis à **1 m** et toutes les rampes sont **pleins** (`Factory.solidAt`) : on ne les traverse plus ; ceux à **2 m** laissent passer dessous (personnage de 1,7 m).
- Rendu : objets qui montent / descendent le long des pentes de niveau 2, visée (`pickMachine`) de 0,85 m à 2,3 m.
- Vérifié : test (pont niveau 2 sur pont niveau 1, objet transporté, solidité), scène navigateur (rampe, 1 m, rampe, 2 m, rampe). Non vérifié à la souris : tracé complet jusqu'au niveau 2, marche sous un tapis de niveau 2.

## Tour 70 — dalle au bout d'un escalier, installations à l'étage sur dalles existantes

- **Dalle contre un escalier** : viser un escalier avec une dalle pose maintenant la dalle **au bout de la marche, à la hauteur de son sommet** (palier). Cause du refus : une dalle de plafond ne s'accrochait qu'à un mur ou à une autre dalle. Le haut d'une marche la porte désormais (`carriedByStairs`) et la visée cherche ce palier (`aimCeiling`). Test.
- **Pas de dalles / escaliers d'1 m** (décision du PO) : on utilise les pièces existantes. Pour que ça colle, **le niveau 2 des tapis est à 2,5 m** (une dalle d'étage) et le niveau 1 à 1,25 m (`LEVEL_M` = 1,25 : les rampes font ~51° au lieu de 45°). Le joueur passe sous un tapis de niveau 2, pas sous le niveau 1.
- **Machines à l'étage** : toute machine (sauf pompe ; une foreuse doit rester sur son minerai donc pas à l'étage) se pose **sur une dalle d'étage** (dalle de sol du niveau 1) : PageUp = à l'étage, PageDown = au sol (affiché dans le HUD). Le patron se vise sur le plan de la dalle ; chaque case doit avoir une dalle dessous. Elle occupe le niveau 2 (champ `lift` = 2) : elle ne gêne pas ce qui est au sol dessous, se raccorde aux tapis de niveau 2 (rampe montante 1 → 2, surélevé niveau 2), un séparateur / groupeur à l'étage remplace un tapis de niveau 2. Joueur : sur la dalle on est au-dessus des machines du sol, en bas on passe sous celles de l'étage.
- Vérifié : tests (coffre à l'étage alimenté par un tapis de niveau 2 sans toucher au coffre du sol, collisions séparées), scène navigateur (rampes, niveau 2, coffre et fourneau à l'étage, aucune erreur). Non vérifié à la souris : pose à l'étage, marche sur la dalle près des machines.

## Tour 71 — ennemis enregistrés, tourelle, buggy, saisons, équilibrage

- **Ennemis enregistrés** : `changes.enemies` (position, PV, cible, nid d'attache) est le tableau même utilisé par `Threat` ; il est nettoyé au chargement (doublons, morts). Ajouts dans la sauvegarde : `time` (secondes de jeu, saisons) et `vehicles`.
- **Tourelle automatique** (`machine_turret`, technologie « Défense ») : reçoit des **chargeurs** par tapis, bras ou à la main (fenêtre), tire sur l'ennemi le plus proche à 22 m (9 dégâts / 0,6 s) ; statut « Plus de munitions » sans balles. Se pose aussi à l'étage.
- **Buggy** (objet `vehicle_buggy`, fer + cuivre + bois) : clic gauche avec le buggy choisi (rien d'autre visé) → il est posé ; **F** près de lui pour monter / descendre, **Maj + F** pour le ranger. Au volant : 2,6 × la vitesse de marche tant qu'il a du carburant (il prend du charbon ou du bois dans le sac tout seul), 0,5 × sinon ; il écrase les ennemis (20 dégâts). Sauvegardé avec sa position et son carburant.
- **Saisons** : printemps → été → automne → hiver, 6 minutes chacune (`seasons.ts`). Teinte du sol et du ciel (neige l'hiver) ; absorption de la pollution par les arbres ×1 / ×1,2 / ×0,7 / ×0,35. La saison s'affiche dans le panneau de débogage.
- **Équilibrage** : foreuses 2 × plus lentes ; tableau des valeurs et principes dans `docs/equilibrage.md`.
- **Modèles** : rien à remplacer sans assets, voir `docs/modeles.md`.
- Vérifié : tests (tourelle, saisons, ennemis / temps / véhicules enregistrés), scènes navigateur (buggy qui roule et se ravitaille, hiver enneigé). Non vérifié à la souris : pose du buggy au clic, tir réel des tourelles sur des ennemis, équilibrage ressenti.

## Tour 72 — coffre du buggy, tilt du patron, marcher sur les tapis en l'air

- **Buggy** : clic gauche dessus (à ≤ 8 m, visé) ou **inventaire au volant** → ouvre son coffre (16 cases, comme un coffre en bois ; objet `vehicles[].slots` sauvegardé) pour mettre du carburant (charbon / bois, consommés d'abord dans le coffre puis dans le sac) et des objets ; rangé, tout revient dans le sac.
- **Patron incliné** : PageUp incline le patron vers le haut, PageDown le remet à plat puis l'incline vers le bas (au sol : entrée de tunnel). Le patron se cale sur la **tranche** du tapis visé (au niveau de son extrémité) et prend la forme qui convient : du niveau 1 on peut monter au niveau 2 (rampe 1 → 2), du niveau 2 redescendre. Viser un tapis au sol avec une inclinaison le prolonge par une rampe. (Pendant un tracé à la souris, PageUp / PageDown gardent leur rôle « monter / descendre d'un niveau ».)
- **Marcher sur les tapis en l'air** : le joueur monte les rampes, marche sur les tapis de niveau 1 et 2 (dessus, physique `beltSpansAt`), s'y cogne par le côté / se cogne la tête sous un tapis, passe dessous au niveau 2, et est emporté par le tapis sur lequel il se tient.
- **Dimensions** : état et incohérences repérées dans `docs/dimensions.md` ; en attente de la validation du PO avant de changer les hauteurs.
- Vérifié : tests (coffre du buggy enregistré, surfaces des tapis), scènes navigateur (le joueur monte la rampe et marche à 1,37 m ; le patron incliné devient « rampe montante vers le niveau 2 » sur un tapis de niveau 1). Non vérifié à la souris : clic sur le buggy, pose complète d'une rampe vers le niveau 2.

## Tour 73 — hauteurs en multiples de 50 cm, laboratoire, fumée de turbine, gestes d'inventaire

- **Dimensions** (validées par le PO) : niveaux de tapis **0 / 1 m / 2,5 m** (`levelY`) ; rampe 1 → 2,5 m sur une tuile (≈ 56°) ; hauteurs des machines arrondies à 50 cm (`content/machines.json`), formes redessinées pour garder le même aspect. Emprises impaires conservées. Voir `docs/dimensions.md`.
- **Laboratoire** : les paquets n'étaient pas consommés parce qu'**aucune recherche n'était choisie** (la fenêtre des technologies, T, lance l'étude). Maintenant : un laboratoire qui a des paquets lance seul la première technologie à paquets disponible (message), et son statut dit « Aucune étude choisie » quand il attend.
- **Électricité** : le panneau affichait « réseau : 150 / 1,05e-12 kW » (puissance de turbine quasi nulle par erreur d'arrondi : la turbine sans pression suffisante). Corrigé : sous 1 % de rendement la turbine produit 0, les nombres sont arrondis et le texte dit « le réseau produit X kW pour Y kW demandés (Z % alimenté) ». Le panneau de la turbine explique la pression (produit dès 20 %, pleine puissance à 60 %).
- **Fumée** : de la vapeur blanche monte des turbines en marche (`updateSmoke`).
- **Gestes de la fenêtre de machine / coffre / buggy** alignés sur le sac : clic = la pile au curseur (ou on y dépose la pile tenue), clic droit = la moitié au curseur, Ctrl + clic = une quantité, Maj + clic = directement dans le sac. Plus de clic droit qui vide dans le sac. Liste complète des commandes à valider : `docs/commandes.md`.
- **Pas reproduit** : « impossible de poser un tapis jusqu'au bout » contre la chaudière et la foreuse électrique : les tuiles de tapis se posent bien jusque sous ces machines (vérifié en scène). À préciser avec le PO (capture ou description du geste).
- Vérifié : tests, scène navigateur (fumée de turbine, panneau d'aide). Non vérifié à la souris : nouveaux gestes de coffre / machine, lancement automatique de la recherche.
