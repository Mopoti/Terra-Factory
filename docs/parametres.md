# Paramètres du joueur — proposition (chantier 2)

Statut : VALIDÉ par le PO (liste, onglet Jeu et réglages graphiques inclus) et IMPLÉMENTÉ au chantier 2. Seuls les réglages d'affichage (gamma, luminosité, taille de l'interface, daltonisme, qualité, ombres, limite d'images/s, distance, FPS), de son (test), d'unités, de format d'heure et de touches ont un effet réel pour l'instant ; les réglages de vues sont appliqués depuis le chantier 4 (sauf le masquage des étages, qui attend les bâtiments) ; les réglages de jeu (sauvegarde automatique, confirmations) sont appliqués depuis le tour 9. Les valeurs par défaut sont des suggestions.
Stockage : navigateur (localStorage), par appareil. Bouton « Réinitialiser » par onglet + « Tout réinitialiser ». 🔶 Plus tard : export/import des paramètres.
Les réglages s'appliquent immédiatement (pas de bouton « Appliquer »).

## Onglet Affichage
| Réglage | Type | Par défaut |
|---|---|---|
| Langue | Français / English | langue du navigateur |
| Plein écran | bouton / case | non |
| Gamma | curseur 0,5 – 2,0 | 1,0 |
| Luminosité | curseur | 100 % |
| Distance d'affichage (chunks) | curseur 2 – 16 | 8 |
| Qualité graphique | Basse / Moyenne / Haute | Moyenne |
| Ombres | Désactivées / Normales / Détaillées | Normales |
| Limite d'images/s | 30 / 60 / 120 / illimité | 60 |
| Taille de l'interface | curseur 80 – 150 % | 100 % |
| Unités | Distance (m / ft), Température (°C / °F / K), Poids (kg / lb), Pression (Pa / bar / psi), Énergie/puissance (J·W / kWh) | métrique, °C |
| Format date/heure | auto / 24 h / 12 h | auto |
| Daltonisme (palette de l'interface) | non / protanopie / deutéranopie / tritanopie | non |
| Afficher les FPS | case | non |

## Onglet Sons
| Réglage | Par défaut |
|---|---|
| Volume général | 80 % |
| Musique | 50 % |
| Ambiance (vent, nature, bruits de fond) | 70 % |
| Interactions (récolte, construction, interface) | 80 % |
| Machines et usine | 70 % |
| Voix / alertes 🔶 | 80 % |
| Couper le son quand l'onglet est inactif | oui |

(Chaque curseur 0–100 % + bouton muet. Les noms pourront être retravaillés. Les vrais sons arrivent plus tard : au chantier 2, on prépare le réglage et le test avec un son d'essai.)

## Onglet Vues (un sous-onglet par vue)
**Commun aux 3 vues**
- Sensibilité souris (curseur), inverser l'axe vertical (case), lissage de la caméra (curseur).

**Première personne**
- Champ de vision (FOV) 60° – 120° (défaut 90°)
- Mouvement de la tête (balancement en marchant) : oui/non + intensité
- Inclinaison dans les virages : oui/non
- Afficher les mains / l'outil : oui/non
- Réticule : style, taille, couleur

**Troisième personne**
- Champ de vision 50° – 100° (défaut 70°)
- Distance de la caméra (curseur), hauteur de la caméra
- Épaule gauche / droite / centrée
- Collision caméra avec le décor : oui/non
- Rotation automatique derrière le joueur : oui/non
- Transparence du personnage derrière un obstacle (aura) : oui/non, rayon

**Vue du dessus**
- Angle d'inclinaison 30° – 90° (défaut 60°)
- Zoom min / max, vitesse du zoom
- Rotation de la caméra : libre / par pas de 90° / bloquée
- Défilement par les bords de l'écran : oui/non
- Masquage automatique des étages et toits quand le joueur est dans un bâtiment : oui/non (défaut oui)
- Aura de transparence autour du joueur derrière un obstacle : oui/non, rayon

## Onglet Touches
- Liste d'actions, chacune avec **deux touches possibles** (principale + alternative), clic puis appui sur la touche pour la changer, « Échap » pour annuler.
- **Détection de conflits** : si la touche est déjà prise, on prévient et on propose d'échanger.
- Souris (clic gauche/droit/molette) et touches spéciales (Shift, Ctrl, Alt, espace) supportées. 🔶 Manette plus tard.
- Défaut selon la langue du navigateur : français → ZQSD, sinon WASD. Les touches sont retenues par **position physique** (Z d'un AZERTY = W d'un QWERTY) ; les touches à lettre mnémotechnique (E, M, B…) sont posées à l'endroit où la lettre est écrite sur le clavier du joueur (disposition lue via le navigateur si possible — Chrome/Edge —, sinon supposée AZERTY en français). **Échap est réservé** au menu et ne peut pas être réassigné. Clic gauche réassignable via le bouton « Clic gauche » affiché pendant l'écoute.

| Catégorie | Actions |
|---|---|
| Déplacement | Avancer, Reculer, Gauche, Droite, Sauter, Sprinter, S'accroupir |
| Vues | Changer de vue (cycle), Vue 1ère personne, Vue 3ème personne, Vue du dessus |
| Interaction | Interagir / récolter, Action secondaire, Lâcher l'objet |
| Interface | Inventaire, Carte, Menu / pause, Arbre technologique 🔶, Capture d'écran 🔶 |
| Construction | Mode construction, Pivoter l'objet, Supprimer, Copier 🔶, Annuler, Rétablir |
| Caméra (dessus) | Zoom +/−, Rotation gauche/droite |
| Barre rapide | Emplacements 1 à 9 |

(Les actions des chapitres futurs — véhicules, combat, etc. — s'ajouteront à la liste sans toucher au reste.)

## Onglet Jeu 🔶 (non demandé, proposé)
- Sauvegarde automatique : intervalle (désactivée / 5 / 10 / 15 / 30 min), nombre de sauvegardes auto conservées
- Afficher les infos-bulles / conseils
- Confirmation avant suppression : oui/non

## Questions pour le PO
1. Valides-tu cette liste ? Que retires-tu / ajoutes-tu ?
2. Le sous-onglet **« Jeu »** (sauvegarde auto, conseils) : on le garde ?
3. Les réglages **qualité/ombres/limite d'images** : on les code dès maintenant (ils n'auront d'effet réel qu'avec le monde 3D) ou on attend ?

## Précisions du PO — touches (tour 7)
- **Type de clavier** : un choix **ZQSD (AZERTY)** ou **WASD (QWERTY)**, exclusifs, plus un bouton « Réinitialiser les touches ». Défaut : ZQSD si le navigateur est en français, sinon WASD.
- **Modale d'avertissement** avant de perdre des personnalisations (changement de type de clavier, « Réinitialiser les touches », « Réinitialiser cet onglet » sur Touches). Elle n'apparaît que si le joueur a réellement modifié des touches. « Tout réinitialiser » a toujours sa propre confirmation.
- **Combinaisons** : 2 entrées maximum, n'importe lesquelles (touche + touche, touche + clic, touche + molette). Exemples par défaut : Copier = Ctrl + C, Coller = Ctrl + V, Annuler = Ctrl + Z, Rétablir = Ctrl + Y. Saisie : maintenir la première touche puis appuyer sur la seconde ; une touche seule est validée au relâchement. Modificateurs (Maj, Ctrl, Alt, Méta) : gauche ou droite indifférent dans une combinaison ; l'ordre n'a pas d'importance.
- **À prévoir plus tard (contextes de touches)** : une combinaison comme Ctrl + Z ne doit agir qu'en mode construction, sinon elle croise « S'accroupir = Ctrl » + déplacement. Le moteur d'entrées devra donner la priorité à la combinaison la plus précise et activer les actions selon le contexte (marche, construction, menu…).
- Réglages d'affichage, de sons et de vues : à tester en jeu (chantier 4) ; certains n'ont pas encore d'effet visible.
