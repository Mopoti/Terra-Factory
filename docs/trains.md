# Voies ferrées et trains

Première version (octobre 2026) : le joueur pose des rails, des véhicules, conduit la locomotive, attelle et dételle. Aiguillages manœuvrés à la main (levier, ou depuis la locomotive) ; pas encore de signalisation : plus tard les trains seront automatisés par des signaux.

## Matériel
- **Rail** (onglet « Rail ») : un seul objet, `rail` = une tuile de voie. La voie se pose comme un convoyeur (voir ci-dessous) et le jeu choisit la forme de chaque pièce. **Échelle réelle** : les modèles de voie (faits pour 60 cm) sont agrandis ×2,5 (`RAIL_SCALE`), écartement de 1,5 m comme les trains. Tuile droite de 2,5 m (5 × 5 cases, 1 rail) ; virage à chaque coin, quart de cercle : serré (3 × 3 tuiles, rayon 3,75 m, 3 rails), large (5 × 5 tuiles, 6,25 m, 4 rails) ou très large (7 × 7 tuiles, 8,75 m, 6 rails) ; aiguillage de 3 × 3 tuiles (6 rails) ; rampe de 1 × 4 tuiles (10 m) qui monte de 2,5 m (4 rails). Une voie posée avant l'agrandissement (version 1) est abandonnée au chargement.
- **Véhicules** (à l'échelle de la voie : roues sur les rails à ±0,75 m, tampons à 1,05 m, caisses de 2,6 m de large) : locomotive à vapeur (`train_locomotive`, type 030T, essieux extrêmes à ±1,5 m, tampons à l'avant, attelage automatique à l'arrière : 7,5 m d'attelage à attelage), wagon de fret couvert et wagon-citerne (caisse de 5 m, deux essieux à ±1,7 m, attelage automatique à chaque bout : 6,6 m). La locomotive électrique (modèle prêt) viendra avec les caténaires.

## Pose (comme les convoyeurs et les tuyaux)
- Rail en main : **maintenir le clic et glisser** de tuile en tuile ; un aperçu vert / rouge montre ce qui sera posé ; on relâche pour poser. Un coin dans le tracé devient un virage de la taille choisie (il faut au moins 3, 5 ou 7 tuiles entre deux coins, et 1, 2 ou 3 tuiles entre le départ et le premier coin). Revenir en arrière dans le glissé raccourcit le tracé.
- La voie se **raccorde toute seule** au bout de voie libre le plus proche du curseur et suit sa hauteur : à moins de 7 m, ou jusqu'à 30 m s'il est devant le bout de voie (pas derrière). L'aperçu montre le tracé qui irait du bout de voie jusqu'au curseur, et un simple clic le pose en entier (inutile de viser exactement la fin). **Route au mieux** (`routeTo`, recalculée à chaque image tant qu'on garde le clic, sans mémoire du chemin) : tout droit devant soi, puis un seul virage vers le côté du curseur. Le virage a besoin de 2 tuiles droites avant et 2 après : curseur de côté ou un peu derrière (jusqu'à 7,5 m), la voie va plus loin tout droit avant de tourner ; un décalage de moins de 2 tuiles est ignoré (la voie reste droite). Le virage est de la plus grande taille qui tient (**essai en cours** : les virages « grand » 11 × 11 et « géant » 15 × 15 sont désactivés dans le tracé automatique, le très large 7 × 7 est le maximum ; voir `AUTO` dans `plan.ts` pour les rétablir). Un tracé qui ne part pas d'un bout de voie garde le comportement tuile par tuile.
- **PageUp / PageDown** : la voie commence par une rampe qui monte / descend (4 tuiles droites, puis la voie continue au niveau atteint) ; une autre pression revient à plat.
- **Virages automatiques** : au coin du tracé, le jeu prend le plus grand virage que les deux branches permettent, comme pour les convoyeurs ; l'aperçu s'élargit quand on allonge la branche. Tailles (demi-bloc de chaque côté du coin) : large 2 tuiles (rayon 6,25 m, 4 rails), très large 3 (8,75 m, 6 rails), grand `curve_big` 5 (13,75 m, 9 rails), géant `curve_huge` 7 (18,75 m, 12 rails). **Les virages serrés (3,75 m) sont retirés du tracé pour l'instant** (le type `curve` existe toujours : les anciens virages posés fonctionnent) : un coin avec moins de 2 tuiles de chaque côté n'est pas posé. Les deux grands virages n'ont pas encore de modèle (`rail_virage_grand`, `rail_virage_geant`, à faire dans Blender) : un ruban de dalles est dessiné à la place. Ils fonctionnent comme les autres pour les embranchements tangents.
- **Embranchement automatique** (plus de pièce « aiguillage », plus de levier) : quand le tracé quitte une ligne droite déjà posée de côté (on commence sur une tuile de la ligne et on glisse perpendiculairement), le jeu pose un **virage serré tangent** dans le prolongement de la ligne (R : de quel bout de la ligne il part). La ligne reste entière.
- **Embranchement tangent** : plusieurs voies partent d'un même point dans le même sens. Aucune n'est « ouverte » ou « fermée » : c'est le **train** qui choisit. Sans consigne, il va **tout droit** (la voie la plus droite) ; le conducteur qui maintient **Q / D** (gauche / droite) avant l'embranchement prend la voie qui tourne de ce côté ; le pilote automatique prend les voies de son itinéraire. La queue du convoi suit la voie parcourue par la tête (`Consist.trail`).
- **Choisir sa voie en conduisant** : maintenir **Q** (gauche) ou **D** (droite) en approchant d'un embranchement (60 m) ; sinon tout droit. `Consist.pick` (non sauvegardé) est recalculé à chaque image (`TrainView.steerPicks` / `routePicks`) ; `TrackGraph.advance(pos, dist, prefer)` suit en priorité les pièces de `prefer`.
- **Croisement à niveau** : une droite posée en travers d'une autre droite (même tuile, même hauteur, axes perpendiculaires) ne la remplace pas : les deux voies se superposent et chacune traverse l'autre, dans les deux sens (`crossesStraight`). Dessin : le modèle `rail_croisement` (rails coupés par les ornières, cœurs, contre-rails) remplace les deux tuiles ; tant qu'il n'est pas chargé, la plus ancienne garde son lit et l'autre n'y ajoute que ses deux rails. Pas de raccord entre les deux voies (on ne passe de l'une à l'autre que par un aiguillage), pas encore de gestion des collisions entre deux trains qui se croisent au même moment.
- **Retracer par-dessus** : poser une voie sur une voie existante la remplace (les rails remplacés reviennent dans le sac, une pièce identique ne coûte rien) : on change ainsi une droite en virage, en rampe, etc. Refusé sous un convoi.
- **Demi-virage (45°)** : au bout d'une voie, **R** fait défiler, après le tracé normal, un demi-virage à gauche puis à droite (moitié du virage très large, rayon 8,75 m, 3 rails) ; un clic le pose. Son bout est en diagonale : on n'y pose que l'autre moitié, qui complète le quart de tour (le tracé en tuiles ne part pas en diagonale). Pièces `curve45` / `curve45_b` (`isHalfCurve`), dans le même bloc de 7 × 7 tuiles coupé par sa diagonale (`trackCellsOf` : aucune case commune).
- **Clic droit maintenu** sur la voie : la démolit (les rails reviennent dans le sac), comme les autres constructions.
- Véhicule en main : viser la voie, clic ; il regarde dans le sens de la voie, et **R** l'inverse (il ne dépend plus du sens du joueur). **Maj + F** reprend un véhicule (seul, pas attelé).

## Conduite
- **Vitres** : la façade de l'abri a deux vraies fenêtres, de part et d'autre de la chaudière (modèle `locomotive_vapeur`) ; le jeu les ferme par une vitre translucide (`CAB_GLASS` dans `src/render/trainView.ts`). Assis à gauche, le mécanicien voit la voie par la fenêtre gauche, au-dessus de la caisse à eau et à côté de la chaudière.
- **F** près de la locomotive : monter ; F de nouveau : descendre. Le joueur est assis dans la cabine.
- **Z / S** (avancer / reculer), le levier est dans le sens où regarde la locomotive ; **Espace** : frein ; la locomotive prend le charbon ou le bois du sac quand sa soute est vide.
- **Tableau de bord** : il indique l'embranchement devant la locomotive et la touche à presser (Q / D). On ne manœuvre pas un aiguillage sous un train (sauf s'il est déjà dans la bonne position).
- **Descendre** : le joueur est posé du côté du siège (la porte de l'abri), hors de la boîte de collision et du marchepied ; un joueur déjà un peu dans une boîte peut toujours en sortir (`trainBlocked` compare chaque point de son corps à sa position actuelle).
- **C** : attelle au véhicule dont l'attelage est à moins de 1,6 m (on recule vers un wagon, on s'arrête, on appuie) ; sinon, dételle derrière la locomotive (devant elle si elle est en queue). Un convoi dételé est garé (frein à main).

## Simulation (`src/core/rail/`)
- Un **convoi** est un corps rigide qui suit la voie : tête repérée par (pièce, abscisse, sens), vitesse, véhicules dans l'ordre. Chaque véhicule est placé derrière la tête selon la longueur de ceux qui le précèdent ; le centre est entre les deux essieux, qui suivent les courbes.
- **Traction** : effort = min(effort de démarrage, puissance / vitesse), nul au-delà de la vitesse maximale (140 kW, 36 kN, 12 m/s pour la locomotive à vapeur). **Résistances** : roulement (0,35 %), air, pente (la rampe est à 25 %). **Freins** : frein de service 1,1 m/s², frein à main d'un convoi garé qui le retient même sur la rampe. La masse de toute la rame compte : plus de wagons, plus d'inertie.
- **Combustible** : la chaudière brûle un peu à vide et beaucoup à pleine puissance (charbon 9 MJ) ; soute de 50 pièces.
- **Chocs** : deux convois qui se touchent sans être attelés se transmettent leur vitesse (choc mou). Au bout de la voie, un butoir arrête le convoi.
- Les convois sont enregistrés avec la partie (`changes.rails`, `changes.trains`).

- Une pièce de voie ne se démonte pas tant qu'un convoi roule ou stationne dessus.
- **Anciens aiguillages** : supprimés. À la lecture d'une sauvegarde, `normalizeRails` les remplace par trois tuiles droites sur leur voie directe (les convois sur la voie déviée disparaissent).

- Clic droit maintenu sur un véhicule : il est démonté (même attelé, le reste du convoi se scinde) et revient dans le sac avec sa soute.

## Collisions et courbes
- **Boîtes de collision** : chaque locomotive et chaque wagon est une boîte (d'attelage à attelage : on ne passe pas entre deux véhicules attelés ; 2,6 m de large, du rail au toit) que le joueur ne traverse pas à pied (`TrainView.solidAt`, utilisé par `canStand` dans `gameView.ts`). Si un train arrive sur le joueur, celui-ci peut en sortir. Rien ne bloque quand on conduit.
- **Attelages automatiques, distance constante** : à l'arrière de la locomotive et aux deux bouts des wagons, un attelage à mâchoire (type « knuckle ») sur un long bras (1,1 m sur la locomotive, 0,8 m sur les wagons) écarte les caisses. Deux véhicules attelés gardent toujours la même distance le long de la voie (`carOffsets` : les points d'attelage se touchent ; `CarSpec.frontM` donne l'avant, `lengthM` la longueur d'attelage à attelage, `bodyM` les bouts des caisses), et leurs caisses ne se touchent pas dans les virages, les S et les demi-tours de la voie (tests « véhicules en courbe »). L'origine des modèles est au milieu des essieux (les attelages ne sont pas symétriques sur la locomotive) : `vehicleFromModel(..., true)`. Les bras pivotent sur leur traverse (`pivot_attelage_av` / `pivot_attelage_ar`) : `TrainView.alignCouplers` les tourne l'un vers l'autre à chaque image et les allonge à peine pour que les têtes se rejoignent ; aux bouts du convoi ils restent droits.
- **Sécurité anti « effet portefeuille »** : seul cas sans long attelage, l'avant de la locomotive (tampons) contre un wagon, quand elle est retournée. `carPoses` vérifie alors que les caisses (rectangles vus du dessus, `overlapBetween` : axes séparateurs) ne se chevauchent pas et recule le véhicule suivant juste assez si besoin. Seul l'affichage (et la collision) est concerné : la simulation garde les longueurs nominales.
- Limite connue : dans le virage de 3,75 m de rayon, l'essieu du milieu de la locomotive (empattement rigide de 3 m) sort d'environ 30 cm du rail.

## Monter, descendre, bruits, collisions
- À l'arrêt dans une station (quai à moins de 7 m), le joueur qui descend de la locomotive est posé **sur le quai** ; sans quai, du côté du conducteur.
- **F** monte dans le véhicule le plus proche (quad, buggy, char ou locomotive), jamais dans deux à la fois : le plus près reçoit la touche (`vehicleClaimsUse`, `TrainView.useDistance`). Le véhicule **ne bouge pas** : le joueur marche jusqu'à lui (jusqu'à 6 m) et s'y assoit ; bouger ou ré-appuyer sur F annule. En descendant, le joueur est posé **à côté** (premier côté libre, puis derrière ou devant), jamais dedans.
- **Bruit de moteur** (`src/audio/engine.ts`, volume « Machines ») : ronronnement continu dont la hauteur suit la vitesse (quad aigu, buggy rond, char grave), « chuffs » de vapeur au rythme des roues pour la locomotive. Plus de bruits de pas au volant.
- **Collision** : un convoi qui roule à plus de 1,5 m/s et percute le joueur à pied lui fait des dégâts selon sa vitesse (5 points par m/s, jusqu'à 100, armure déduite ; un coup toutes les 0,7 s). Les véhicules conduits par un autre joueur ne blessent pas encore.
- **Posture** : sur un quad, le pilote est penché en avant, cuisses un peu relevées, pieds vers les repose-pieds, bras tendus au guidon (`Avatar.seatStyle`).

## Carte et embranchements
- **Carte** (M) : les voies sont tracées en traits clairs discrets, les stations en carrés bleus (nom visible à partir du zoom ×4), chaque locomotive est une **flèche orange dans le sens de circulation** du convoi (retournée en marche arrière) et chaque wagon un petit carré.
- **Queue du convoi aux embranchements** : un convoi note les pièces que sa tête a parcourues (`Consist.trail`, 80 au plus) ; en plaçant ses véhicules en remontant derrière la tête (`preferOf`), il suit à chaque embranchement la voie d'où il vient, quelle que soit la position des lames. Avant, la queue « se téléportait » sur l'autre branche dès que la tête franchissait le Y.

## Contenu des wagons et poids
- **Wagon de fret** : un coffre de 32 cases, limité par la **charge utile** (20 000 kg) et le **volume** (30 000 L). **F** près du wagon ouvre sa fenêtre (jauge de charge) ; on y glisse des objets du sac comme dans un coffre.
- **Wagon-citerne** : 10 000 L d'un seul liquide (eau, pétrole, polymère, eau sale ; masse volumique 1 / 0,9 / 0,95 / 1,1 kg/L). **F** près de la citerne ouvre sa fenêtre : jauge de remplissage, « Verser un baril plein » (100 L, le baril vide revient dans le sac) et « Remplir un baril vide ». Les machines (stations de chargement) viendront plus tard.
- **Poids réel** : la masse d'un véhicule est sa masse à vide plus son contenu (`massOfCar`, `cargoMassKg`) ; celle du convoi décide de la traction (accélération), de l'inertie, du freinage et du pilote automatique. La masse du convoi s'affiche en tonnes au tableau de bord. `Car.cargo` / `Car.liquid` sont enregistrés (bornés aux limites du wagon au chargement).

## Stations et pilote automatique (première étape)
- **Station** (`train_station`, onglet « Rail », 20 lingots de fer + 12 bois) : on la tient en main, on vise la voie (fantôme vert / rouge) et on clique. Un quai bas et un panneau avec le nom (dessinés par le code) sont posés le long de la voie. Au moins 3 m entre deux stations d'une même pièce. **F** près du panneau : renommer (nom de 24 caractères au plus) ; **clic droit maintenu** : la reprendre. Démonter la voie qui la porte la rend dans le sac.
- **H** en conduisant (bouton « Destination » au tactile) : liste des stations ; le convoi part en pilote automatique (`Consist.goTo`). Le chemin est le plus court en mètres de voie (`findRoute`, `src/core/rail/route.ts`) ; le convoi ne fait pas demi-tour (il roule vers sa tête). Le pilote règle les aiguillages et embranchements de l'itinéraire dans les 60 m devant lui, accélère jusqu'à 9 m/s puis freine pour s'arrêter pile sur le repère : c'est le **centre de la locomotive** (`anchorOffset`) qui se tient au milieu du quai, la tête du convoi le dépasse donc d'autant (à 25 cm près), puis rend la main (« Arrivé à… »). Avancer, reculer ou le frein reprennent la conduite à la main. Sans combustible, ou sans chemin, l'ordre est annulé avec un message. Un train déjà à sa station ne l'annonce pas, et une étape ne s'exécute qu'après 1 s (`MIN_DWELL_S`) : un programme « va à X » sans condition ne boucle plus à chaque image.
- L'itinéraire est recalculé toutes les 3 s et dès que la voie change.
- **Programme en boucle** (onglet « Programme » de la fenêtre de la locomotive, ouverte avec Tab en conduisant ; plus de touche dédiée) : une liste d'étapes lue en boucle (`src/core/rail/program.ts`). Chaque étape = *Quand* (toutes / au moins une des conditions) *Alors* (va à la station X, ou attend N secondes). Condition = sujet + verbe + valeur : **les wagons** (tous / au moins un / au moins N / le wagon n° N, de tout type / de fret / citerne) **sont vides / pleins / contiennent** au moins N d'un objet ou d'un liquide ; **la locomotive** a moins de / au moins N pièces de combustible ; **le temps** : a attendu N secondes. Sans condition, l'étape part tout de suite. « Enregistrer et lancer » démarre le programme ; une étape qui demande une station disparue, ou un train qui n'arrive pas (pas de chemin, plus de combustible) met le programme en pause. Toucher aux commandes (avancer, reculer, frein) le met aussi en pause. Le tableau de bord indique l'étape en cours. Le programme est enregistré avec le convoi ; il est effacé quand on attelle ou dételle.
- À faire : choix « plus court / plus rapide », demi-tour en bout de voie, programme éditable sans monter dans la locomotive.

## Soute et attelage
- Tab en conduisant ouvre la fenêtre de la locomotive : on y glisse du charbon ou du bois depuis le sac (soute de 50 pièces). La chaudière brûle la soute selon la puissance demandée ; la jauge montre la chaleur.
- C attèle (wagon à moins de 1,6 m derrière) ou dételle ; la ligne de HUD et un bouton tactile le rappellent.

## À faire / à discuter
- Multijoueur : un invité ne peut pas encore poser de voie ni conduire (seul l'hôte simule les convois).
- Signalisation ; locomotive électrique ; chargement des wagons (coffre de fret, citerne à fluides, peinture de la citerne) ; sifflet, bruit de roulement, fumée ; tunnels (non prévus par les modèles).

## Croisements à niveau généralisés (24 octobre)

`crossesAtLevel(a, b)` (track.ts) : deux pièces (droites ou virages, hors aiguillages et rampes) à la même hauteur dont les lignes de voie se coupent en travers (plus de 30°) loin de leurs bouts peuvent se chevaucher : `railsOverlapping` ne les compte plus comme collision. Les voies ne se raccordent pas (le graphe ne suit que les ports) : chaque convoi traverse. Un bout qui touche l'autre voie reste un raccord ou un embranchement tangent, pas un croisement.

## Tracé : arrêt avant l'obstacle et annulation

Clic gauche maintenu depuis le point choisi, patron vert (possible) puis rouge à partir du premier obstacle ; au relâchement seule la partie verte est posée. Clic droit pendant le tracé : annulation (patron et départ). Départ : une tuile libre, ou le bout de voie le plus proche s'il est à portée.

## Départ du tracé et patron au repos (25 octobre)

- Le départ s'accroche à un bout de voie seulement si le curseur est sur sa tuile ou la suivante (≈ 1,9 m, `SNAP_M`). Sur un terrain sans voie, un clic loin devant un bout de voie le prolonge toujours (portée 30 m) ; au milieu de la voie (curseur à moins de 2,2 m d'un rail), le départ est la tuile visée.
- Après une pose, ou après un clic droit au repos, le patron sous le curseur disparaît jusqu'à ce qu'on change de tuile (`TrainView.hideHover`).


### Quai de gare : collisions et panneau (25 octobre)

Le quai a des boîtes de collision (`SOLIDS` dans `stationView.ts`, repère du quai) : parois de l'abri, banc, lampadaires, poubelle et mât du panneau ; le quai lui-même se monte à pied. Le mât du panneau s'arrête sous le panneau (2,2 m), qui n'est plus coupé. Les boîtes sont estimées d'après `ferroviaire.py` (échelle ½) : à ajuster à l'œil en jeu.


### Couleur des virages (25 octobre)

Chaque taille de virage a sa teinte (`CURVE_TINT` dans `trainView.ts`), identique pour la pièce posée et pour son patron : serré bleu, large violet, très large (et demi-virages 45°) marron, grand orange, géant turquoise. Un patron non posable reste rouge ; les droites et rampes gardent leur couleur.
