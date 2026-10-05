# Sujets à trancher tôt (pour éviter de gros chantiers plus tard)

Classés par coût si on les ajoute APRÈS le prototype. À valider avec le PO.

## A. Très coûteux à ajouter tard (à décider avant le prototype)

1. Unités et échelle : 1 case = ? mètre ; 1 tick = ? seconde ; unités de température/pression/énergie (SI).
2. Grille de construction : machines posées sur grille (Factorio) ou libres (Satisfactory) ? Rotation par pas de 90° ?
3. Identifiants stables : chaque objet/ressource/recette a un id texte (« iron_ore ») et non un numéro, pour que les anciennes sauvegardes survivent aux mises à jour.
4. Format de sauvegarde versionné + migrations (une sauvegarde de la v1 doit charger en v5).
5. Données de jeu dans des fichiers (objets, recettes, ressources) et non dans le code : permet l'équilibrage et les mods.
6. Multijoueur : commandes + simulation déterministe (déjà acté).
7. Textes traduisibles dès le premier bouton (déjà acté).
8. Cycle jour/nuit et temps : horloge unique du monde.

## B. Systèmes à anticiper (l'architecture doit les permettre, pas forcément les coder)

- Transport : convoyeurs, tuyaux (liquides/gaz), rails ? câbles électriques ? Réseau de chaleur ?
- Énergie : électricité (production, réseau, batteries) en plus de la combustion.
- Inventaire : taille, poids max (lié au poids des objets), coffres, piles d'objets.
- Recherche / arbre technologique ? Déblocage progressif des machines.
- Artisanat à la main vs machines ; recettes avec plusieurs entrées/sorties, sous-produits (pollution, chaleur).
- Pollution : effet sur quoi ? (ennemis plus agressifs, végétation, santé du joueur)
- Ennemis : nids qui apparaissent, vagues, IA, armes/défense, loot.
- Météo / saisons ? (affecte température, solaire)
- Fluides : simulation de pression simplifiée (par réseau) plutôt que physique réelle, sinon trop lourd.
- Chunks : ce qui se passe dans les zones éloignées (simulation gelée ? usine qui continue de tourner ?). Gros impact performance.
- Limites de monde pratiques malgré « infini » (précision des nombres loin de l'origine).

## C. Confort / qualité

- Annuler/refaire en construction, copier-coller de plans (blueprints), mode photo, mini-carte/carte.
- Accessibilité : taille du texte, daltonisme, sous-titres.
- Succès / statistiques (production/min), graphiques de flux.
- Mods (données externes), outils de débogage intégrés (mode dev).
- Manette de jeu, écrans tactiles ?
- Propriété de la sauvegarde : stockage navigateur = fragile ; export fichier + sync cloud plus tard.

## D. Technique

- Premier chargement navigateur : poids des assets, écran de chargement.
- Audio : navigateurs bloquent le son avant un clic (le menu règle ça naturellement).
- Version bureau (Electron/Tauri) à garder en tête pour « Quitter » et sauvegardes sur disque.
