# Multijoueur — décisions et feuille de route

_Décisions du PO (Tour 116). Rien de réseau n'est codé : l'étape M0 ne fait que stocker les réglages d'une partie multijoueur._

## Décisions

- **5 joueurs maximum.** Pas de joueur contre joueur ; les ennemis visent le joueur le plus proche.
- **Architecture : l'hôte fait tourner la simulation** (un joueur), les autres envoient leurs **actions** ; pas de serveur dédié pour commencer (possible plus tard : le code du jeu, `core`, tourne tel quel côté serveur). La partie n'existe que tant que l'hôte est connecté.
- **Connexion** : directement entre navigateurs (WebRTC) avec un petit service de mise en relation. Un joueur rejoint avec un **code d'invitation à 6 caractères** ou un **lien** qui le contient.
- **Visibilité (réglée à la création de la partie, onglet / section « Multijoueur » de l'éditeur)** :
  - **Privée** : seuls les joueurs invités par l'hôte peuvent rejoindre ;
  - **Publique** : une adresse (URL), avec un **mot de passe optionnel** (n'importe qui peut venir, ou seulement ceux qui ont le mot de passe).
- **Ce qui est partagé** : **configurable à la création**, **tout partagé par défaut** : technologies (recherche), crédits du comptoir, sac. Le monde et les machines sont toujours communs. Chaque joueur garde sa position, sa vie, son cadavre, son point de réapparition et son tutoriel.
- **Tutoriel** : lancé à **la première entrée de chaque joueur** dans une partie, qu'il l'ait créée ou qu'il rejoigne celle d'un autre (voir `docs/refonte-objets.md` §10.1).

## Feuille de route

| Étape     | Contenu                                                                                                                                                                                                                                                                                                                      | Visible par le joueur |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **M0**    | Réglages multijoueur dans l'éditeur de partie (activer, privée / publique, mot de passe, ce qui est partagé), enregistrés avec la partie                                                                                                                                                                                     | oui, mais sans effet  |
| **M1**    | **Préparer** : séparer l'état **du joueur** (sac, outils, équipement, barre d'objets, vie, cadavre, réapparition, tutoriel, munitions) de l'état **du monde** (machines, pièces, ressources prises, technologies, ennemis, pollution, temps) ; faire passer **toutes** les actions par des commandes ; simulation à pas fixe | non (rien ne change)  |
| **M2**    | **Réseau à deux** : héberger / rejoindre par code, un hôte et un invité qui jouent ensemble (machines, récolte, ennemis, recherche)                                                                                                                                                                                          | oui                   |
| **M3**    | **Jusqu'à 5 joueurs**, déconnexion / reconnexion, joueurs enregistrés dans la sauvegarde de l'hôte, visibilité privée / publique et mot de passe appliqués, option « tout partagé » ou individuel                                                                                                                            | oui                   |
| plus tard | serveur dédié permanent ; liste de parties publiques ; chat                                                                                                                                                                                                                                                                  |                       |

## État du code (audit du Tour 116)

- `WorldChanges` mélange encore **monde** et **joueur** dans un seul objet enregistré : _joueur_ — `hotbar`, `tools`, `equipment`, `ammo`, `corpses`, `spawns`, `tutorialDone`, `tutorialSkipped`, sac (`GameState.inventory`) ; _monde_ — `machines`, `pieces`, `drops`, `taken`, `harvested`, `pollution`, `enemies`, `vehicles`, `time`, `beacon` ; _partagé selon réglage_ — `unlocked`, `researching`, `progress`, `packProgress`, `credits`, sac.
- Le jeu a un **point d'entrée unique** pour la plupart des actions (`GameState`) mais quelques règles modifient encore l'état directement depuis l'affichage (ex. dégâts d'acide, ennemis, certaines pièces) : à ranger en commandes (M1).
- La simulation avance au rythme de l'image (pas variable plafonné à 0,5 s) avec des sous-pas de 0,05 s : à rendre **à pas fixe** pour que l'hôte et ses invités voient la même chose (M1).
- Pas de `Math.random()` dans la simulation (générateur déterministe pour les ennemis) : bon point de départ.

## M1 — préparation (Tour 117) : fait

- **Simulation du monde à pas fixe** (`src/core/game/simulation.ts`, `WorldSimulation`) : usine, laboratoires, comptoir, pollution, ennemis, tourelles, temps du monde ; 20 pas par seconde quelle que soit la durée des images (un appel avance de 0,5 s au plus). Elle ne connaît les joueurs que par une liste `{ id, x, z }` et renvoie des **événements** (`playerHit`, `machineLost`, `machineAcid`, `pipeBurst`, `turretShot`, `produced`, `autoStudy`) que chaque joueur applique à lui-même (vie, sons, messages). Déterministe (testé). Plusieurs joueurs : un ennemi vise le plus proche, le gardien réveille ses nids pour chacun.
- **Joueur / monde** (`src/core/game/playerData.ts`) : `PLAYER_KEYS` (barre d'objets, outils, équipement, munitions, cadavres, réapparition, tutoriel), `RESEARCH_KEYS` et `CREDIT_KEYS` (individuels seulement si le partage est désactivé), `splitChanges` / `mergeChanges` : séparer puis recoller redonne exactement les mêmes changements ; le **format des sauvegardes ne change pas**.
- **Commandes** (`src/core/game/commands.ts`, `CommandBus`) : 12 commandes sérialisables (poser / démolir une machine, recette, ingrédients, réparer le réacteur, balise, vendre, acheter, recherche, étude, fabrication, annulation). Le terrain est fourni par l'hôte (`blockedFor`). Branchées dans le jeu, la fenêtre des machines, les technologies et le sac. Une commande survit à `JSON.stringify` (testé).
- **Pas encore passé par des commandes** (à faire en M2, quand on branche le réseau) : récolte et ramassage, pièces de construction, sac ↔ coffres et cases des machines (`putInChest`, `loadMachine`…, qui manipulent encore la machine elle-même), duvets / lits, véhicules, filtres, combat du joueur. Le bus est synchrone ; pour un invité il deviendra asynchrone (envoi à l'hôte).

## M2 — réseau à deux (Tour 118) : fait

**Fait et testé**

- **Protocole** (`src/core/net/protocol.ts`) : l'invité envoie `join`, `cmd` (une commande du bus), `pos`, `leave` ; l'hôte répond `welcome` (monde, règles, état du monde, fiche du joueur), `refused`, `result`, `snap` (état du monde, toutes les 0,5 s), `players` (positions, 10 fois par seconde), `me` (sa fiche après chaque commande), `hit` (coup reçu).
- **Transport** (`transport.ts`) : deux interfaces (`Link`, `Network`) ; un réseau **en mémoire** pour les tests et un réseau **réel** (`src/net/peerNetwork.ts`, WebRTC entre navigateurs avec le service de mise en relation gratuit de PeerJS ; `?peerServer=hôte:port` en choisit un autre pour les tests). Code d'invitation à 6 caractères, accepté seul ou dans un lien `?join=CODE`.
- **Hôte** (`host.ts`) : accueille ou refuse (version, partie fermée, 5 joueurs, mot de passe, refus de l'hôte pour une partie privée) ; applique chaque commande d'un invité **sur l'état de CE joueur** (`GameState.forPlayer` : même monde, fiche individuelle, sac commun ou non selon les réglages) avec **le terrain de l'hôte** ; ignore les commandes inconnues ; un joueur qui revient (même nom) retrouve sa fiche. La simulation voit tous les joueurs (`simPlayers`) et les coups reçus sont renvoyés au bon joueur.
- **Invité** (`guest.ts`) : rejoint par code, envoie des commandes (réponse attendue), reçoit le monde, les joueurs, sa fiche.
- **Menus** : pause → **Multijoueur** (ouvrir la partie aux invités, code et lien, liste des joueurs, fermer) ; menu principal → **Rejoindre une partie** (code, nom, mot de passe). Une partie privée demande à l'hôte d'accepter chaque arrivant (boîte de confirmation).
- **Vérifié avec deux vrais navigateurs** (service de mise en relation local) : l'hôte ouvre la partie, l'invité entre avec le code, l'hôte accepte, les deux voient la liste des joueurs. 13 tests en mémoire (refus, mot de passe, sac commun / individuel, technologies communes, commandes mal formées, retour d'un joueur…).

**Reste (voir M2c ci-dessous et M3)**

- Le service de mise en relation PeerJS est un tiers gratuit : sans lui on ne peut pas se trouver (une fois connectés, les joueurs échangent directement). Mot de passe encore stocké en clair dans la partie.

## M2c — l'invité joue vraiment (Tour 119) : fait

- **Vue invité** : en rejoignant, l'invité démarre une vraie partie (`startGuest` dans `main.ts`) avec la même seed et les mêmes règles ; **rien n'est enregistré** sur son appareil (pas de sauvegarde, menu pause sans « Sauvegarder », ni de menu Multijoueur). Sa vue 3D ne fait **pas tourner le monde** (ni simulation, ni fabrication à la main) : elle affiche ce que l'hôte envoie.
- **Monde reçu appliqué sur place** (`src/core/net/worldSync.ts`, `applyWorldPart`) : tableaux et objets gardent la même identité (l'usine, la menace, la pollution les tiennent par référence) ; si les machines changent, l'usine est ré-indexée et redessinée ; pièces, objets au sol et ressources récoltées se redessinent aussi.
- **Autres joueurs** (`src/render/remotePlayers.ts`) : une silhouette colorée avec le nom, lissée entre deux envois ; affichée chez l'hôte (invités) et chez les invités (hôte et autres invités). L'invité envoie sa position 10 fois par seconde.
- **Actions de l'invité = prédiction + hôte fait foi** : la commande est jouée tout de suite chez lui (`GuestBus`, même code que l'hôte), puis envoyée ; l'hôte la rejoue sur la fiche de ce joueur avec son terrain ; son état (monde toutes les 0,5 s, fiche après chaque action et chaque seconde) corrige tout écart, et un message prévient si l'hôte a refusé (« L'hôte n'a pas validé une de tes actions »).
- **Actions qui n'étaient pas des commandes** : au lieu de les réécrire une à une, les méthodes de `GameState` de la liste blanche `REMOTE_CALLS` (récolte, jeter / ramasser, portes, démolition, pièces, cadavres, duvets / lits, véhicules, coffres, cases des machines, filtres) sont **enveloppées côté invité** : jouées localement puis rejouées chez l'hôte (message `call`, machines et véhicules par identifiant, une seule fois même si une méthode en appelle une autre). Toute autre méthode est ignorée par l'hôte.
- **Fiche du joueur** : l'hôte fait avancer la file de fabrication à la main de chaque invité et lui renvoie sa fiche (`me` : sac, part individuelle, file) ; le sac n'est pas écrasé tant qu'un objet est tenu en main. Barre d'objets, outils, équipement, munitions et tutoriel sont décidés par l'invité et envoyés à l'hôte (`loadout`), qui en a besoin pour les limites du sac.
- **Coups reçus** : l'hôte renvoie les coups d'ennemis (`hit`) ; la vie est suivie chez l'invité. Le mot de passe de l'hôte n'est plus envoyé aux invités.
- **Vérifié avec deux navigateurs** : l'invité entre avec le code, voit les murs posés par l'hôte, et l'hôte voit « Ana ». 10 tests supplémentaires en mémoire (application en place, machine posée par l'hôte vue par l'invité, commande prédite puis rejouée, divergence signalée, jeter rejoué une fois, méthode hors liste ignorée, barre d'objets, fabrication à la main, mot de passe masqué).

**Limites connues (à traiter en M3)**

- **Combat de l'invité** : tirs et coups au corps à corps modifient la copie locale des ennemis, vite écrasée par l'état de l'hôte ; il faudra des commandes de tir.
- **Identifiants de machines posées** : une machine posée par prédiction reçoit l'identifiant prévu par l'invité ; si l'hôte ou un autre invité en pose une au même moment, l'état de l'hôte remplace tout au prochain envoi (la commande suivante vise alors la bonne machine).
- L'état du monde est encore envoyé **en entier** à chaque fois (différences en M3) ; mort de l'invité (cadavre, réapparition) non rejouée chez l'hôte ; reconnexion automatique, sauvegarde des joueurs dans la partie de l'hôte, mot de passe haché : M3.

## M3 — durcissement (Tour 120) : fait en partie

- **Joueurs gardés dans la sauvegarde de l'hôte** : `SaveSlot.players` (par nom : sac et part individuelle). `HostSession.exportProfiles()` (sac à jour des joueurs présents) est rangé à chaque sauvegarde, manuelle ou automatique, et à la fermeture de la partie aux invités ; au rechargement, `HostOptions.players` rend à chacun ses affaires. Le format reste lisible par les anciennes versions (champ facultatif).
- **Différences d'état** : l'hôte n'envoie à chaque invité que les champs du monde qui ont changé depuis son dernier envoi (comparaison par champ) ; l'invité fusionne dans sa copie. Un monde immobile ne coûte plus rien.
- **Reconnexion** : si la liaison est coupée sans que le joueur l'ait voulu, l'invité retente toutes les 3 s (10 essais) sous le même nom ; l'hôte lui rend sa fiche, l'invité reprend le monde et son sac (`GuestSync.rebind`). Refus net (partie fermée, mot de passe…) ou échec final : retour au menu. Un départ voulu ne déclenche rien. Un joueur qui part garde son sac dans sa fiche.
- **Règles de la partie appliquées** : 5 joueurs, privé (acceptation de l'hôte) / public (mot de passe), partage des technologies, crédits et sac (déjà en M2).

**Reste (hors M3)** : combat de l'invité par commandes (tirs, corps à corps), mort de l'invité rejouée chez l'hôte, mot de passe haché dans la sauvegarde, serveur de mise en relation propre, essai à 5 joueurs réels.

## M3b — combat et mort de l'invité (Tour 124) : fait

- **Tir et corps à corps** : l'invité joue son coup tout de suite (retour immédiat) et l'envoie (`fire` : origine et direction du rayon ; `melee`). L'hôte applique les dégâts à **ses** ennemis avec ses propres valeurs (portée 40 m, 10 et 12 de dégâts) ; il ignore un tir parti à plus de 5 m de la position connue du joueur ou avec une direction absurde, et le corps à corps part de la position connue. L'état des ennemis revient ensuite avec le monde. Les nids passent déjà par `takeFromWorld`.
- **Mort de l'invité** : `dieAt` et `consumeRespawn` rejoués chez l'hôte (cadavre dans le monde, réapparition au dernier lit).
- Reste à traiter : munitions de l'invité vérifiées par l'hôte, dégâts calculés à la position exacte du rayon avec la latence, mot de passe haché, serveur de mise en relation propre, essai à 5 joueurs réels.

## Mot de passe (Tour 128)

Le mot de passe d'une partie publique est rangé sous forme d'**empreinte SHA-256 salée** (`sha256:sel:empreinte`, `src/core/net/password.ts`) au moment de créer la partie ; l'hôte compare l'empreinte du mot de passe tapé par l'invité. Une ancienne sauvegarde avec un mot de passe en clair reste acceptée. Le mot de passe n'est jamais envoyé aux invités (ni en clair ni en empreinte).

## Sac individuel, récolte visible par tous, joueurs sur la carte (Tour 155)
- **Sac individuel** : le réglage « sac commun » n'existe plus (`share.inventory` est toujours faux, même dans une ancienne sauvegarde ; la case a disparu de l'éditeur de partie). Chaque joueur a sa fiche (sac, barre d'objets, équipement…) ; seuls les technologies et les crédits peuvent encore être partagés.
- **Récolte** : le bois va dans le sac de celui qui récolte. Quand un invité récolte, l'hôte redessine la zone (événement `harvest` marqué `remote`) ; quand quelqu'un récolte chez un invité, il ne redessine que les chunks dont `taken` a changé (au lieu de tous). Le reste d'un arbre est donc le même partout, et l'arbre disparaît pour tout le monde quand il est épuisé.
- **Carte** : les autres joueurs apparaissent comme un point à leur couleur avec leur nom (`MapOptions.others`, `GameViewHandle.otherPlayers`). Un système de groupe filtrera plus tard cette liste.

## Piles du sac et machines (Tour 155)
- Charger une machine (combustible, entrée, coffre, ingrédient) depuis une pile précise (glisser, Maj + clic, pile choisie) ne prend QUE dans cette pile, jusqu'à la limite de la machine (`loadMachine`, `putInChest`, `loadIngredient` avec `bagIndex` ; commande `loadIngredient.slot`). Les autres piles du même objet ne bougent plus.
- Dans la fenêtre d'une machine, choisir une pile choisit cette pile (plus de fusion en cliquant une seconde pile du même objet) ; on fusionne en glissant une pile sur une autre.
