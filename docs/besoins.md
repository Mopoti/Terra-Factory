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
