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
