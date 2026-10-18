# Modes de jeu et commandes d'administration : proposition

## Règle de changement de mode (proposition du PO, à valider)

| Partie créée en | Peut passer en | Condition |
|---|---|---|
| Créatif | Survie, et retour en Créatif | libre : le joueur alterne quand il veut |
| Survie | Créatif | seulement si, dans les paramètres de la partie, la case **« Autoriser le changement de mode »** (oui / non) a été cochée volontairement |

Idées d'application :
- Un champ `allowModeSwitch` dans les options de la partie (défaut : oui pour une partie créée en Créatif, non en
  Survie), modifiable depuis les paramètres de la partie (pause) ; le mode en cours (`mode`) devient modifiable seulement
  quand le champ est vrai.
- Bouton « Mode : Survie / Créatif » dans le menu pause, visible seulement si le changement est autorisé ; en
  multijoueur, réservé à l'hôte (le mode concerne toute la partie).
- Passer en Survie depuis le Créatif garde le monde et les constructions ; le sac illimité du Créatif est ramené aux
  limites normales (les objets en trop restent au sol près du joueur ou dans un coffre à choisir).
- Les technologies recherchées gratuitement en Créatif restent débloquées.

## Commandes d'administration (à discuter)

Pistes : une console (touche `/`) réservée à l'hôte, avec des commandes sobres : `/mode survie|creatif`, `/temps jour|nuit`,
`/donner <objet> <n>`, `/aller x z`, `/graine`, `/ennemis on|off`. Elles passeraient par le même bus de commandes que les
actions du joueur (`CommandBus`), donc compatibles multijoueur.

Questions :
1. Console textuelle, ou seulement des boutons dans un menu « Administrateur » (plus simple sur mobile) ?
2. Les commandes `/donner` et `/aller` en Survie : permises (avec un marqueur dans la partie) ou réservées au Créatif ?
3. Le mode débogage (F9) n'affecte plus les succès : plus d'avertissement « succès désactivés ». Les succès restent
   à définir ; si certaines commandes devaient les bloquer, ce serait ces commandes, pas F9.

## Ce qui est déjà fait

- F9 n'active plus le drapeau « admin » et n'affiche plus d'avertissement.
- Débogage : en Survie, seulement la graine, la date, la vue, la position et le biome (le compteur d'images reste en haut
  à droite) ; en Créatif, toutes les informations.
