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
- 🔶 Plus tard : mode de jeu (créatif/survie), difficulté, multijoueur on/off, état initial du joueur.

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
- Un écart de moins de 50 cm entre une machine et la case logistique suivante peut consommer un élément de convoyeur : l'ensemble reste aligné sur la base 50 cm. 🔶 Règle exacte à confirmer (voir passation.md).
- Les pièces fermées (chauffage, température d'abri) devront tenir compte des murs de 10 cm.
