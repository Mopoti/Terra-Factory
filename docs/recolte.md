# Récolte manuelle et inventaire — proposition (chantier 7)

Statut : VALIDÉ par le PO (tour 14) et IMPLÉMENTÉ au chantier 7. Valeurs de départ réglables dans `content/items.json` (sans toucher au code).

## 1. Objectif
Donner au joueur de quoi **faire** dans le monde : aller chercher du bois, de la pierre, du minerai, les ramasser à la main, voir son sac se remplir (poids et taille limités), et retrouver l'effet de ses actions (arbre abattu, tas de minerai qui s'amenuise) après avoir sauvegardé et rechargé. C'est aussi la base des machines et des convoyeurs qui viendront ensuite.

## 2. Viser et récolter
- **Cible** : en 1ère personne, la ressource visée par le **réticule** ; en 3ème personne et en vue du dessus, la ressource **sous le curseur**. Portée : 3 m autour du joueur. La cible est mise en évidence (contour clair) et son nom + quantité restante s'affichent.
- **Action** : « Interagir / récolter » (clic gauche ou E par défaut, remappable) **maintenue** : une barre de progression se remplit, puis les unités arrivent dans le sac une par une.
- **Valeurs de départ** :
  | Ressource | Contenu | Cadence manuelle | Fin |
  |---|---|---|---|
  | Arbre | 4 bois | 1 bois / 0,8 s | l'arbre est abattu et disparaît |
  | Rocher | 20 pierre | 1 pierre / 0,5 s | le rocher disparaît |
  | Case de minerai (fer, cuivre, charbon) | 315 à 3 500 (selon la place dans le tas) | 1 minerai / 0,4 s | la case s'aplatit puis disparaît ; le tas s'amenuise par le bord |
  | Étang | inépuisable | — (pompes plus tard) | — |
  | Nid | — | non récoltable | — |
- Les ressources sont **épuisables, sans repousse**. L'outil n'apporte pas encore de bonus (il viendra avec les technologies).

## 3. Objets et sac
- Chaque objet a un **poids (kg)** et un **volume (L)** par unité (fichier de données).
  | Objet | Poids | Volume |
  |---|---|---|
  | Bois | 0,8 kg | 3 L |
  | Pierre | 1,2 kg | 0,6 L |
  | Minerai de fer | 0,4 kg | 0,3 L |
  | Minerai de cuivre | 0,45 kg | 0,3 L |
  | Charbon | 0,25 kg | 0,3 L |
- **Capacité du sac au départ : 50 kg et 60 L.** Exemple : 100 minerais de fer = 40 kg et 30 L. Les capacités augmenteront avec les sacs, brouettes, véhicules (plus tard).
- Quand le sac est plein (poids **ou** volume), on ne peut plus ramasser : message clair, et la récolte s'arrête. Pas de ralentissement du joueur.
- **Fenêtre d'inventaire** (touche Tab ou I, remappable) : liste des objets avec quantité, poids et volume, deux jauges (poids, volume), bouton « Jeter » pour détruire une quantité (les objets posés au sol viendront plus tard).
- Petit message à chaque récolte (« +4 bois »).

## 4. Le monde garde la trace de ce qu'on fait
- Le monde d'origine se recalcule toujours depuis la seed ; ce que le joueur change est enregistré à part : **liste des arbres/rochers récoltés, quantités de minerai prélevées par case**.
- Ces changements, l'**inventaire** et la position sont dans chaque sauvegarde (manuelle ou automatique). Charger une ancienne sauvegarde remet donc le monde (arbres debout, minerai restant) tel qu'il était à ce moment-là.
- Techniquement, chaque action passe par une **commande** (« récolter 1 minerai en case X ») appliquée par le moteur du jeu : c'est la base du multijoueur à 5 et de l'annulation.

## 5. Ce que le PO pourra tester à la fin du chantier
Abattre un arbre, casser un rocher, miner dans un tas de fer en regardant la case s'aplatir, remplir son sac jusqu'à la limite, ouvrir l'inventaire, sauvegarder, recharger une ancienne sauvegarde et retrouver l'arbre debout.

## 6. Hors périmètre (volontairement)
Objets posés au sol, coffres, fabrication, machines, outils améliorés, repousse des arbres, sons dédiés.

## Questions pour le PO
1. **Cible au curseur / au réticule, portée 3 m, mise en évidence** : OK ? (reco : oui)
2. **Récolte maintenue** avec barre de progression (plutôt qu'un clic = 1 unité) ? (reco : maintenue)
3. **Capacité du sac 50 kg / 60 L** et les poids/volumes ci-dessus ? (reco : oui, tout est réglable ensuite)
4. **Sac plein = on ne ramasse plus** (sans ralentissement) ? (reco : oui)
5. **« Jeter » = détruire** pour l'instant ? (reco : oui)
6. **Pas de repousse** des arbres (ressources épuisables comme tu l'as demandé) ? (reco : oui)
7. **Ordre des chantiers** : faire ce chantier **avant** la gestion complète des sauvegardes (suppression/renommage d'une sauvegarde, export, IndexedDB), car il donne du contenu à tester ; la gestion complète viendra juste après et protègera des données plus précieuses. (reco : 7 puis 6)

## Décisions du PO (tour 14) et réalisation
- Cible au curseur / réticule, récolte maintenue avec barre de progression, capacité du sac (50 kg / 60 L) et poids/volumes proposés : **acceptés**.
- **Sac plein** : non répondu explicitement, recommandation appliquée (on ne ramasse plus, message « Sac plein » affiché, sans ralentissement).
- **Objets jetés** : le PO demande de les poser **au sol dès maintenant si possible** → fait. « Jeter » (1, 10 ou tout) pose une pile devant le joueur ; on la ramasse en maintenant « Interagir » dessus ; les piles font partie de la sauvegarde.
- **Arbres** : sans repousse pour l'instant ; **la repousse est une idée à reprendre plus tard** (le format des changements du monde est extensible : on pourra y ajouter la date de récolte).
- **Ordre** : chantier 7 puis chantier 6, **enchaînés sans attendre de validation intermédiaire**.

### Ce qui a été construit
- Données : `content/items.json` (objets, sac, portée de 3 m) et champ `harvest` des ressources dans `content/resources.json`.
- Moteur (`src/core/game/`) : sac limité en poids ET en volume (`inventory.ts`), changements du monde (`worldChanges.ts` : quantités prélevées par case, piles au sol), commandes récolter / jeter / ramasser (`state.ts`), portée (`reach.ts`).
- Affichage : visée par rayon (`src/render/interaction.ts`), contour de la cible, nom et quantité restante, barre de progression, messages « +4 Bois », piles au sol, redessin du chunk modifié (case de minerai qui s'aplatit puis disparaît).
- Fenêtre « Sac » (Tab ou I, remappable ; bouton « Sac » dans le jeu) avec jauges de poids et volume (unités du joueur) et boutons « Jeter ». Elle fige le jeu ; Échap la ferme.
- Les sauvegardes retiennent le sac et les changements du monde : charger une ancienne sauvegarde remet le monde tel qu'il était (arbre debout, minerai non entamé, piles au sol).
- Correctif trouvé en cours de route : les touches du jeu (Espace, flèches, Tab) étaient bloquées partout, y compris dans les champs de saisie et les menus → impossible de taper une espace dans le nom d'une sauvegarde. Corrigé (`src/input/input.ts`). Les clics sur l'interface ne comptent plus comme des actions de jeu.
