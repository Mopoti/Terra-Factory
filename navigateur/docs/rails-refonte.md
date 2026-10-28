# Refonte des rails (cahier des charges)

Statut : **validé par le PO le 28/10/2026** (page de discussion, onglet « Rails : ce que montre la vidéo »), à coder par étapes. Référence : la vidéo de pose de rails de Factorio du PO, images dans `docs/rails-reference/`. Le principe : le comportement de Factorio, **dans l'esprit de Terra Factory** (nos échelles, nos règles de stations et de programmes). Les signaux, passages à niveau, ponts, etc. viennent plus tard, quand les rails seront parfaitement fonctionnels.

## Décisions
| Sujet | Décision |
| --- | --- |
| Vocabulaire | « Patron vert » = pose possible, « patron rouge » = pose impossible (le patron rouge dit pourquoi). Pas de « fantôme », pas de croix. |
| Pièces | Peu de pièces, toutes de même taille : un **droit**, un **virage unique de 45°**, des **droits en diagonale** ; plus de virages serré / large / très large / grand / géant. Huit virages de 45° font un cercle. |
| Accrochage | Le patron se colle au bout libre le plus proche et prend l'orientation qui prolonge la voie ; loin d'un rail, il suit la grille. Une touche tourne le patron. |
| Embranchement | Sans pièce d'aiguillage : un bout de rail peut avoir plusieurs suites (un droit qui continue + un virage qui s'écarte). Le train va vers sa prochaine station, sinon tout droit. |
| Croisement | **On garde nos rails en « + »** (croisement perpendiculaire) pour traverser une voie. |
| Patron rouge : causes | Chevauche une voie, trop loin du joueur, obstacle (machine, mur, arbre), pente trop forte, raccord non aligné. |
| Sélection et retrait | Survol : crochets jaunes + infos (trains dans le tronçon, santé) ; retrait à la pioche, l'objet est rendu. |
| Anciennes parties | **Option C** : on bloque l'accès aux parties d'avant la refonte (menu : « version incompatible, créer une nouvelle partie »). Aucune conversion. |
| Plus tard | Signaux, gares, trains en marche, ponts : fonctionnement de Factorio « dans l'esprit de Terra Factory », une fois les rails parfaits. |

## Étapes de réalisation (une validation du PO entre chaque)
1. **Pièces** : droit, droit diagonal, virage 45° (les deux demi-modèles `rail_virage_45` / `rail_virage_45_b` existent, rayon 8,75 m) ; retrait des autres virages du jeu ; version de voie incrémentée et blocage des anciennes parties.
2. **Patron** : patron vert / rouge avec la raison, accrochage au bout libre, rotation par une touche, pose pièce par pièce (le nombre de rails restants suit le curseur).
3. **Embranchement** : un bout de rail avec plusieurs suites ; le pilote choisit selon l'itinéraire.
4. **Croisement en +** : à garder, vérifier qu'il se raccorde aux nouvelles pièces.
5. **Survol et retrait** : crochets jaunes, panneau d'infos, retrait à la pioche.
6. Tests automatiques de chaque étape (alignement des bouts, cercle fermé en 8 virages, Y, croisement) et vérification par captures.

## À fixer avant l'étape 1
- Longueur du droit (aujourd'hui une tuile de 2,5 m) et grille des diagonales (un droit diagonal avance d'une tuile en x et en z).
- Rampes (montée de 2,5 m sur 10 m) : on les garde telles quelles pour l'instant.
- Les trains existants (locomotive, wagons) gardent leurs règles de conduite ; seul le tracé change.
