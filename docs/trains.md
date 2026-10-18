# Voies ferrées et trains

Première version (octobre 2026) : le joueur pose des rails, des véhicules, conduit la locomotive, attelle et dételle. Pas encore de signalisation ni d'aiguillages ; plus tard les trains seront automatisés par des signaux.

## Matériel
- **Rail** (onglet « Rail ») : un seul objet, `rail` = une tuile de voie. La voie se pose comme un convoyeur (voir ci-dessous) et le jeu choisit la forme de chaque pièce. **Échelle réelle** : les modèles de voie (faits pour 60 cm) sont agrandis ×2,5 (`RAIL_SCALE`), écartement de 1,5 m comme les trains. Tuile droite de 2,5 m (5 × 5 cases, 1 rail) ; virage de 3 × 3 tuiles à chaque coin, quart de cercle de 3,75 m de rayon (3 rails) ; rampe de 1 × 4 tuiles (10 m) qui monte de 2,5 m (4 rails). Une voie posée avant l'agrandissement (version 1) est abandonnée au chargement.
- **Véhicules** : locomotive à vapeur (`train_locomotive`, 6,45 m), wagon de fret, wagon-citerne (5,4 m). La locomotive électrique (modèle prêt) viendra avec les caténaires.

## Pose (comme les convoyeurs et les tuyaux)
- Rail en main : **maintenir le clic et glisser** de tuile en tuile ; un aperçu vert / rouge montre ce qui sera posé ; on relâche pour poser. Un coin dans le tracé devient un virage (il faut au moins 3 tuiles entre deux coins). Revenir en arrière dans le glissé raccourcit le tracé.
- La voie se **raccorde toute seule** au bout de voie libre le plus proche (à moins de 4 m) et suit sa hauteur.
- **PageUp / PageDown** : la voie commence par une rampe qui monte / descend (4 tuiles droites, puis la voie continue au niveau atteint) ; une autre pression revient à plat.
- **Clic droit maintenu** sur la voie : la démolit (les rails reviennent dans le sac), comme les autres constructions.
- Véhicule en main : viser la voie, clic ; il regarde du côté où regarde le joueur. **Maj + F** reprend un véhicule (seul, pas attelé).

## Conduite
- **Pare-brise** : la façade de la cabine est découpée à l'écran (plans de coupe sur le matériau de la locomotive, `CAB_WINDOWS` dans `src/render/trainView.ts`) et fermée par une vitre translucide : en vue subjective on voit la voie par-dessus la chaudière. Quand le modèle Blender aura de vraies fenêtres vitrées, cette découpe se retirera.
- **F** près de la locomotive : monter ; F de nouveau : descendre. Le joueur est assis dans la cabine.
- **Z / S** (avancer / reculer), le levier est dans le sens où regarde la locomotive ; **Espace** : frein ; la locomotive prend le charbon ou le bois du sac quand sa soute est vide.
- **C** : attelle au véhicule dont l'attelage est à moins de 1,6 m (on recule vers un wagon, on s'arrête, on appuie) ; sinon, dételle derrière la locomotive (devant elle si elle est en queue). Un convoi dételé est garé (frein à main).

## Simulation (`src/core/rail/`)
- Un **convoi** est un corps rigide qui suit la voie : tête repérée par (pièce, abscisse, sens), vitesse, véhicules dans l'ordre. Chaque véhicule est placé derrière la tête selon la longueur de ceux qui le précèdent ; le centre est entre les deux essieux, qui suivent les courbes.
- **Traction** : effort = min(effort de démarrage, puissance / vitesse), nul au-delà de la vitesse maximale (140 kW, 36 kN, 12 m/s pour la locomotive à vapeur). **Résistances** : roulement (0,35 %), air, pente (la rampe est à 25 %). **Freins** : frein de service 1,1 m/s², frein à main d'un convoi garé qui le retient même sur la rampe. La masse de toute la rame compte : plus de wagons, plus d'inertie.
- **Combustible** : la chaudière brûle un peu à vide et beaucoup à pleine puissance (charbon 9 MJ) ; soute de 50 pièces.
- **Chocs** : deux convois qui se touchent sans être attelés se transmettent leur vitesse (choc mou). Au bout de la voie, un butoir arrête le convoi.
- Les convois sont enregistrés avec la partie (`changes.rails`, `changes.trains`).

## Soute et attelage
- Tab en conduisant ouvre la fenêtre de la locomotive : on y glisse du charbon ou du bois depuis le sac (soute de 50 pièces). La chaudière brûle la soute selon la puissance demandée ; la jauge montre la chaleur.
- C attèle (wagon à moins de 1,6 m derrière) ou dételle ; la ligne de HUD et un bouton tactile le rappellent.

## À faire / à discuter
- Multijoueur : un invité ne peut pas encore poser de voie ni conduire (seul l'hôte simule les convois).
- Aiguillages et croisements ; signalisation ; locomotive électrique ; chargement des wagons (coffre de fret, citerne à fluides, peinture de la citerne) ; sifflet, bruit de roulement, fumée ; démolition d'une voie sous un convoi ; tunnels (non prévus par les modèles).
