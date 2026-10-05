# Besoins — Terra Factory (cahier des charges vivant)

Statut : EN DISCUSSION. Les points marqués 🔶 sont des propositions de Claude à valider par le PO.

## 1. Menu d'accueil (dès le prototype)
- **Continuer** : affiché seulement si ≥ 1 partie existe. Sous le bouton : nom de la partie + date/heure de sa dernière sauvegarde. Charge la sauvegarde la plus récente.
- **Nouvelle partie** : ouvre l'écran d'édition de partie (§2).
- **Charger une partie** : gestionnaire de sauvegardes façon Space Engineers. Une partie = un « dossier » ; dedans, la liste de ses sauvegardes (manuelles + auto) pour revenir loin en arrière. 🔶 Actions : charger, supprimer, renommer, dupliquer une partie.
- **Paramètres** (§3).
- **Quitter** : ferme le jeu. ⚠ Un navigateur ne peut pas toujours fermer un onglet par script ; en version web, 🔶 « Quitter » = retour à un écran de fin / tentative de fermeture. Sera un vrai « quitter » en application desktop (Electron/Tauri) ou Unity.

## 2. Édition de partie
- Seed de la carte (saisie libre, bouton aléatoire).
- Pour chaque famille de ressources (minerais, forêts, rochers, ennemis…) trois curseurs : **fréquence** (plus/moins souvent), **taille** (plus/moins grand), **densité**.
- 🔶 Plus tard : mode de jeu (créatif/survie), difficulté, multijoueur on/off, état initial du joueur. (Voir §12 pour ce qui est fait.)

## 3. Paramètres (le plus complet possible)
- **Sons** : général, musique, ambiance, interactions (noms à retravailler).
- **Vues** (réglages séparés par vue : 1ère personne, 3ème personne, dessus) : ex. mouvement de la tête oui/non, champ de vision (curseur min–max), angles, sensibilité souris…
- **Image** : gamma, 🔶 qualité graphique, distance d'affichage, plein écran.
- **Touches** : toutes remappables (et plusieurs touches par action, manette plus tard 🔶).
- **Langue** : français / anglais, défaut = langue de l'ordinateur ; textes jamais écrits « en dur » dans le code (fichiers de traduction).

## 4. Grandeurs physiques / simulation à prévoir
- Chaleur (eau, minerais en fusion, air selon l'heure de la journée), pression (liquides dans tuyaux, minerais), pollution (émise par les machines), poids des objets.
- Vie (joueur, ennemis, objets destructibles), endurance, dégâts, vitesse/vélocité, puissance.
- Combustion : chaque combustible a une énergie (un bout de bois < un charbon).
- 🔶 Voir `docs/risques.md` pour les compléments proposés.

## 5. Décisions du PO — cadrage tour 2
- **Échelle** : 1 case = 50×50×50 cm. Unités affichées configurables (métrique/impérial, °C/°F/K, etc.) ; le jeu stocke toujours en unités SI et ne convertit qu'à l'affichage.
- **Construction** : sur grille (type Factorio). À prévoir : placement libre sans grille en fin de projet (navigateur puis Unity).
- **Sauvegardes** : survivent aux mises à jour (ids stables + format versionné + migrations). Données de jeu séparées du code.
- **Zones éloignées** : l'usine continue de tourner. Navigateur : un objet « chargeur de chunk » (difficile à fabriquer) garde une zone active ; Unity : tout tourne partout.
- **Énergie** : réseaux électriques (volt, ampère, watt). Exemple de chaîne : eau douce → chauffée à 100 °C → vapeur → tuyaux → turbines → électricité.
- **Inventaire** : limité en poids ET en volume/taille. Véhicules (brouette, voiture à combustible, voiture électrique, tank, camion, train…) avec carburant/munitions. Optionnel : usure par pièce (chaque véhicule a un inventaire d'équipement ; retirer le pneu = plus de roulage).
- **Arbre des technologies** : oui.
- **Sous-produits** : chaleur, pollution, résidus.
- **Pollution** : fait grossir plus vite les ennemis. Cycle : reproduction → bébés → croissance → nid plus gros → départ d'essaims qui fondent de nouveaux nids.
- **Physique** : la plus réaliste possible, **niveau de réalisme configurable** dans l'écran d'édition de partie.
- **Saisons et météo** : influencent la température extérieure et l'humidité ; l'intérieur d'un abri chauffé dépend de la saison. Climat par **biome**.
- **Quitter** : bouton affiché seulement quand il est utilisable (version bureau/Unity).
- **Stockage des sauvegardes** : choix de Claude (voir passation.md).

## 6. Décisions du PO — cadrage tour 3
- **Tick** : 20 ticks/s (1 tick = 0,05 s) pour démarrer, ajustable plus tard.
- **Multijoueur** : 5 joueurs maximum en simultané.
- **Version bureau** : plus tard.
- **Ennemis** : options dans l'écran d'édition de partie : agressifs oui/non, expansion (création de nouveaux nids) oui/non. **Par défaut : non agressifs mais s'étendent.**

## 7. Décisions du PO — grille à deux niveaux
- Cases logistiques de 50 cm (alignement des réseaux : convoyeurs, tuyaux…) + **placement fin au pas de 10 cm** pour murs (10 cm d'épaisseur), machines et décor.
- Un écart de moins de 50 cm entre une machine et la case logistique suivante peut consommer un élément de convoyeur : l'ensemble reste aligné sur la base 50 cm. Règle précisée au §8 (le convoyeur se pose sur la case complète, 10 cm dans la machine).
- Les pièces fermées (chauffage, température d'abri) devront tenir compte des murs de 10 cm.

## 8. Construction, machines, convoyeurs, pièces, visibilité (PO, tour 5)
### Blocs du monde et constructions
- Le terrain/les ressources sont en blocs de 50 cm (faciles à retirer). Les bâtiments utilisent des **pièces de construction fines** : mur de 50 cm de haut × 50 cm de long × **10 cm d'épaisseur** ; 🔶 sol et plafond : dalles 50×50 cm de 10 cm d'épaisseur ; portes, escaliers.
- 🔶 Les murs se posent sur les bords des cases de 50 cm.
- Une machine peut se coller à un mur : sur la case voisine elle occupe alors 10 cm (ou 40 cm…) et laisse du vide.

### Machines et ports
- Chaque modèle de machine a un **trou d'entrée** et un **trou de sortie** (ports définis dans les données : position au pas de 10 cm, direction, type entrée/sortie).
- On connecte les convoyeurs à ces ports. Ajouter/retirer des ressources par un autre côté = **bras robotique**.
- **Raccordement** : l'objet convoyeur se pose toujours sur la **case complète de 50 cm** ; si la machine laisse un écart, 10 cm du convoyeur se retrouvent dans la machine (pas de tronçon automatique). Tout reste aligné sur la base 50 cm.

### Convoyeurs
- Objet de 50×50 cm de base, 50 cm de haut. Tapis droit à mi-hauteur : épaisseur de chemin 10 cm, 20 cm libres au-dessus, 20 cm de pied en dessous. Largeur 50 cm, longueur 50 cm.
- Formes : droit, virage 90° gauche et droite, **diagonale montante et descendante** (style rails Minecraft, mais pas collée au sol). À étudier : pieds/supports pour monter dans les airs ou descendre sous terre.

### Pièces (bâtiments)
- À la pose d'une **porte**, test automatique : murs fermés + sol complet + plafond complet. Si tout est complet → création d'une **entité « pièce »** (simple à compter, à chauffer, à gérer).
- Si un des éléments est retiré/modifié → la pièce est défaite.
- 🔶 Précision de Claude : le test est relancé à chaque modification de mur/sol/plafond/porte autour (pas seulement à la pose de la porte), pour qu'une pièce se crée aussi quand on ferme le dernier trou.

### Visibilité en vue du dessus (et 3ème personne)
- Joueur dans une pièce/bâtiment : le plafond et **tout ce qui est au-dessus** (étages supérieurs, toit) devient invisible/transparent. Exemple 2 étages : au RDC, plafond RDC + 1er + plafond 1er + 2ème + toit 2ème masqués. Au 1er : le RDC est caché (sol du 1er), plafond 1er, 2ème et toit masqués.
- **Aura de transparence** quand le joueur est derrière un arbre (ou autre obstacle) : disque autour du joueur, très transparent au bord du personnage, de moins en moins vers l'extérieur jusqu'à redevenir opaque.

## 9. Précisions du PO — murs, sols, plafonds (tour 6)
- **Murs** : navigateur = uniquement sur les **bords des cases** (extérieur de la case) ; Unity = n'importe où (pas de 10 cm).
- **Angles** : deux murs d'épaisseur 10 cm qui se rejoignent laissent un petit vide de 10×10 cm à l'extérieur de l'angle. **Décision PO : on accepte le vide.** Le joueur peut ajouter ou non un pilier de 10×10×50 cm (optionnel, décoratif) ; la pièce compte comme **fermée dans les deux cas**.
- **Sols et plafonds** : dalles de 50×50 cm, 10 cm d'épaisseur.

## 10. Menu pause et sauvegardes (PO, tour 9)
- **Échap en partie** ouvre le **menu pause** (le jeu est figé) : Reprendre, Sauvegarder, Paramètres, **Quitter**.
- **Quitter** = retour au menu principal avec une **sauvegarde automatique** (conservées au nombre réglé dans Paramètres > Jeu). Une sauvegarde automatique périodique existe aussi (intervalle réglable, 0 = désactivée).
- **Sauvegarder** : le nom proposé est celui de la dernière sauvegarde manuelle ; **même nom = remplacement**, **autre nom = nouvelle sauvegarde à côté** (le jeu prévient dans les deux cas).
- **Une partie = un dossier** contenant ses sauvegardes (manuelles et automatiques), comme dans Space Engineers. « Continuer » reprend la plus récente ; « Charger une partie » liste les parties, puis les sauvegardes de la partie choisie. Une sauvegarde retient pour l'instant la position du joueur et la caméra (le monde se recalcule depuis la seed).
- **Suppression d'une partie** (tour 10) : icône corbeille à droite de chaque partie dans « Charger une partie », avec fenêtre de confirmation (nom de la partie et nombre de sauvegardes perdues). La confirmation suit le réglage Paramètres > Jeu > « Confirmer avant de supprimer » (activé par défaut).
- **Chantier 6 (réalisé, tour 14)** : voir §13.

## 11. Les trois caméras (chantier 4)
- **Bascule en jeu** : touche « Changer de vue » (V par défaut) en cycle 1ère personne → 3ème personne → vue du dessus, ou touches directes (non assignées par défaut, à configurer dans Touches). Un message rappelle la vue active. La vue choisie est enregistrée dans la sauvegarde.
- **1ère personne** : regard à la souris (la souris est capturée au clic ; Échap la libère et ouvre la pause ; à défaut, clic droit maintenu), champ de vision réglable, balancement de la tête en marchant (intensité réglable), inclinaison dans les virages, outil tenu en main (une pioche provisoire, aussi visible dans la main du personnage en 3ème personne et en vue du dessus), réticule (style, taille, couleur réglables). Le personnage est masqué.
- **3ème personne** : caméra derrière le joueur à distance et hauteur réglables, épaule gauche / droite / centrée, rotation à la souris (clic droit maintenu) ou aux touches de rotation, zoom molette, rotation automatique derrière le joueur (option), collision de la caméra avec les obstacles solides (rochers, nids ; les arbres sont traversés car l'aura gère la visibilité).
- **Vue du dessus** : angle réglable (30° à 90°), zoom molette entre un minimum et un maximum, rotation libre (par défaut) / par pas de 90° / bloquée — le clic droit maintenu fait tourner la caméra dans les modes libre et par pas (dans ce dernier, le cap s'aimante au relâchement), seul le mode bloqué l'interdit, défilement par les bords de l'écran (option), la caméra suit le joueur.
- **Aura de transparence** (3ème personne et vue du dessus) : le décor placé entre la caméra et le joueur devient très transparent autour du joueur puis de moins en moins en s'éloignant, jusqu'à redevenir opaque (rayon réglable, désactivable). Pour l'instant elle concerne arbres, rochers, nids et minerais ; elle servira aussi aux murs et toits.
- **Réglages de vues** : tous ceux de `docs/parametres.md` (Vues) sont désormais appliqués, sauf « Masquer étages et toits dans un bâtiment » qui attend les bâtiments.
- **Lissage de la caméra** : réglage commun (0 % = instantané).
- Provisoire : le personnage est une capsule ; la souris en vue du dessus et à la 3ème personne se contrôle avec le clic droit maintenu.
- **Correctifs du tour 11** : rotation à la souris en vue du dessus (le mode « par pas de 90° » par défaut l'empêchait ; le défaut est maintenant « libre ») ; l'outil est désormais aussi dans la main du personnage. Les réglages enregistrés par une version antérieure sont migrés (version des réglages passée à 2) : l'ancien défaut « par pas » est abandonné, un choix « par pas » fait ensuite par le joueur est respecté.

## 12. Écran d'édition de partie (chantier 5)
Affiché par « Nouvelle partie ». Contenu :
- **Nom de la partie** et **seed** (texte libre) avec l'icône de mélange pour tirer une seed aléatoire.
- **Ressources du monde** — cinq familles, chacune avec trois curseurs **Fréquence / Taille / Densité** de ×0,25 à ×3 (×1 par défaut), avec un mot qui qualifie la valeur (très faible → très élevé) :
  - Forêts (arbres) : nombre de bosquets · étendue · arbres par bosquet ;
  - Rochers : nombre d'affleurements · étendue · rochers par affleurement ;
  - Minerais : nombre de gisements · étendue des tas · quantité de minerai par case ;
  - Étangs d'eau douce : nombre d'étangs · surface · chance d'un étang par zone ;
  - Ennemis (nids) : nombre de nids · **taille des colonies de départ** (emprise des nids de 1 m à 6 m) · chance d'un nid par zone.
- **Ennemis** : « agressifs » (défaut : non) et « les colonies s'étendent » (défaut : oui). Stockés dans la partie ; leur effet arrivera avec les ennemis.
- **Réalisme de la physique** : Arcade / Équilibré (défaut) / Réaliste. Stocké dans la partie ; effet quand chaleur, pression et électricité existeront.
- **Aperçu du monde en direct** : carte vue du dessus de 320 m autour du départ (biomes, arbres, rochers, minerais, étangs, nids), recalculée pendant qu'on règle les curseurs ou la seed ; le cercle blanc marque la zone de départ garantie (150 m).
- « Réinitialiser les réglages du monde » remet tous les curseurs à ×1.
- La seed, les réglages du monde et les règles sont enregistrés avec la partie (même seed + mêmes réglages = même monde).
- **Règle (PO, tour 13) : les réglages de génération d'un monde déjà créé ne sont pas modifiables** (seed, curseurs fréquence / taille / densité). Seules des règles qui ne touchent pas à la forme du monde pourront être ajustées plus tard. Retours détaillés du PO attendus quand il y aura plus de contenu à tester.

## 13. Gestion complète des sauvegardes (chantier 6)
- **Stockage définitif** : IndexedDB (un enregistrement par partie, écritures en arrière-plan dans l'ordre). Les parties de l'ancien stockage du navigateur sont reprises automatiquement une fois, puis retirées de l'ancien. Le jeu demande au navigateur de ne pas effacer les parties quand l'espace manque. Secours : stockage navigateur classique, puis mémoire (dans ce cas un **avertissement** s'affiche, car rien ne sera conservé : navigation privée).
- **« Charger une partie »** (partie = dossier de sauvegardes) :
  - par partie : **renommer**, **dupliquer** (partie entière avec toutes ses sauvegardes), **exporter en fichier**, **supprimer** ; en haut : **importer** un fichier ;
  - par sauvegarde : **charger**, **renommer** (manuelles seulement ; deux sauvegardes manuelles d'une même partie ne peuvent pas avoir le même nom), **dupliquer**, **supprimer** (avec confirmation, selon le réglage « Confirmer avant de supprimer ») ; la seed de la partie est rappelée.
  - Les sauvegardes automatiques ne se renomment pas (elles sont gérées par le jeu, 5 conservées par défaut).
  - Si aucune partie n'existe, le menu principal propose « Importer une partie ».
- **Fichier d'échange** `.terra` : JSON compressé (gzip) contenant la partie entière (seed, réglages du monde, options, sauvegardes avec sac et changements du monde). À l'import : validation et nettoyage des données (multiplicateurs bornés, objets inconnus ignorés), refus des fichiers vides, illisibles, d'un autre format, trop gros (> 80 Mo) ou d'une version plus récente du jeu, et **nouvelle partie toujours créée** (jamais d'écrasement).
- Noms limités à 40 caractères.
- Pas encore : stockage sur disque via dossier (option Chrome), synchronisation en ligne, export de toutes les parties d'un coup.
