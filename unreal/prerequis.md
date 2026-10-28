# Unreal : prérequis à lister avant de commencer

Statut : **brouillon à valider avec le PO** (tour 262). Rien n'est installé ni créé. À compléter et vérifier sur le site d'Epic avant de s'engager (les versions et les plugins changent vite).

Le choix du moteur dépend d'abord du **monde creusable** (voxels, 50 blocs de profondeur réglables, voir `navigateur/docs/discussions.json`) : à trancher avec la section « Monde » du GDD.

## 1. Matériel et outils
- [ ] Machine de développement : processeur et carte graphique récents, 32 Go de mémoire conseillés, 100 Go de disque ou plus.
- [ ] Epic Games Launcher et la version d'Unreal à choisir (la dernière version stable, à vérifier au moment du lancement du projet).
- [ ] Visual Studio (charge de travail C++ pour les jeux) ou Rider, si on programme en C++ ; inutile en Blueprints seuls.
- [ ] Git avec Git LFS (les modèles, textures et cartes ne se versionnent pas en texte).
- [ ] Blender (déjà utilisé pour les modèles) et export vers Unreal (fichiers `.fbx` ou `.glb`, échelle et axes à fixer une fois pour toutes).

## 2. Décisions de projet
- [ ] C++, Blueprints, ou les deux (proposition : logique de l'usine en C++, interface et réglages en Blueprints).
- [ ] Modèle réseau : solo seul au début, ou multijoueur dès le départ (le navigateur a déjà un mode « rejoindre une partie »).
- [ ] Unité de grille : le navigateur utilise des cases de 50 cm ; à garder pour pouvoir copier les règles du GDD.
- [ ] Monde : terrain par voxels modifiables (plugin à choisir) ou terrain classique avec cavités locales.

## 3. Plugins à étudier
| Besoin | Piste | À vérifier |
| --- | --- | --- |
| Terrain en voxels creusable | un plugin voxel du Marketplace (par exemple Voxel Plugin) ou le terrain dynamique du moteur (Geometry Script) | licence, prix, maintenance, sauvegarde des modifications |
| Entrées clavier / manette | Enhanced Input (fourni) | actions du GDD (marcher, sprinter, construire, interagir) |
| Interface | UMG, éventuellement Common UI | écran des découvertes, inventaire, fenêtres de machine |
| Usine avec beaucoup d'éléments | Mass Entity ou système d'acteurs simples avec mise à jour groupée | nombre d'objets sur les tapis, performance |
| Effets (fumée, étincelles) | Niagara (fourni) | pollution visible |
| Sons | MetaSounds (fourni) | |
| Sauvegarde | SaveGame (fourni) ou format maison | diffs du terrain creusé |
| Multijoueur | réseau natif du moteur | réplication des machines et du terrain |

## 4. Configuration de l'éditeur et du projet
- [ ] Modèle de départ (vide en C++ ou « Third Person » à adapter), qualité (Scalable) et plateforme cible (PC seulement au début).
- [ ] Rendu : Lumen et Nanite ou rendu simple (le style du jeu est doux, volumes simples) ; coût sur les machines modestes.
- [ ] Interface de l'éditeur : mise en page des fenêtres, thème, raccourcis, dossier `Content/` organisé comme `navigateur/` (machines, objets, construction, personnages, nature).
- [ ] Conventions de nommage (préfixes `BP_`, `SM_`, `M_`, `T_`) et langue des noms (français pour les objets du jeu, comme dans les données).
- [ ] Données de jeu : copier et adapter `navigateur/content/*.json` dans `unreal/` (objets, recettes, découvertes, machines), importées en Data Tables.
- [ ] Gestion de version : `.gitignore` (Intermediate, Saved, Binaries, DerivedDataCache), Git LFS pour les assets.

## 5. Premier essai proposé (une fois les points ci-dessus réglés)
1. Un terrain de test avec un personnage et un bloc creusable.
2. Une machine posée sur la grille de 50 cm, avec un tapis et un objet qui avance.
3. Mesurer la performance avec 1 000 objets sur les tapis, puis décider de continuer ou non.
