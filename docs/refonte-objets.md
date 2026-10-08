# Refonte des objets et du contenu — suivi point par point

> Document de travail créé au **Tour 85**. Il suit l'intégration des idées de `gdd_factorisation.md` (fourni par le PO) dans le jeu, **un point à la fois**. Rien n'est codé tant que le point n'est pas validé.
> Autres fichiers fournis : `prompts_assets.md` (prompts d'images pour Scenario.gg : sert de **vocabulaire d'objets** uniquement) et la `passation.md` externe (information).

## 0. Carte des points

| #   | Point                                                                                                            | Statut                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Cadre : tiers, technologies par type, paquets de science, noms réels, outil, tier 0 (roue à aubes)               | **validé (Tour 85)**                                                                                   |
| 2   | Monde : richesse selon la distance, nouveaux minerais, ponts sur les étangs                                      | **en discussion**                                                                                      |
| 3   | Métallurgie : fer + charbon, fonte, moules, estampeuse (3a, T1) ; Bessemer, béton, lavage, zinc, laiton (3b, T2) | **3a validé et codé (Tour 87)**, 3b à faire                                                            |
| 4   | Grille et structure : convoyeurs 1×1, piliers automatiques                                                       | **validé et codé (Tour 86)** : on garde le 2×2 ; piliers automatiques à 2,5 m (pièces) ; belts à faire |
| 5   | Logistique : foreuses et convoyeurs T1–T3, bras filtrants, trieur, barils, tunnels « à patron »                  | à faire                                                                                                |
| 6   | Réseaux Volts et Bars : blackout, pression, friction, tuyaux T1–T3, réparation, refroidissement                  | à faire                                                                                                |
| 7   | Pétrole, plastique, câbles isolés (T3)                                                                           | à faire                                                                                                |
| 8   | Ennemis : éclaireurs, gardiens, cracheurs ; réparation                                                           | à faire                                                                                                |
| 9   | Survie : duvet, lit fixe, sac laissé sur le cadavre                                                              | **validé et codé (Tour 86)**                                                                           |
| 10  | UX : tutoriel progressif, « Continuer » enrichi, ratio de distance, créatif/survie                               | à faire                                                                                                |
| 11  | Fin de partie : fission, fusion, balise, comptoir spatial                                                        | à faire (en dernier)                                                                                   |
| 12  | Multiplateforme : tactile, manettes, Steam                                                                       | à faire (en dernier)                                                                                   |

Les contradictions des points #4 et #9 ont été tranchées au Tour 86 (voir §4 et §9).

## 1. Point 1 — le cadre

### 1.1 Décisions du PO (réponses du Tour 85)

- **Technologies par type ET par tier.** Une technologie = un _type_ (équipement, construction, logistique, énergie, véhicule, etc.) × un _tier_ (T1 à T4). **Une technologie ne débloque que 2 objets par tier.** On la débloque avec des **paquets de science du même tier** (paquets T1 → technologie équipement T1 ; paquets T2 → équipement T2 ; etc.). Il faut **trouver les recettes des paquets T1, T2, T3, T4** de façon cohérente.
- **Un seul outil polyvalent** (pas de hache et de pioche séparées) : on garde le fonctionnement actuel (vitesse, rendement), on change noms et recettes.
- **Noms réels partout** pour les minerais (hématite, malachite, sphalérite, bauxite, uraninite…) ; les lingots gardent leur nom (lingot de fer, etc.).
- **Anciennes parties** : on **repart de zéro** (les parties existantes ne se chargeront plus après la refonte).

### 1.2 Proposition : les types de technologies

Dix types, à ajuster :

| Type                     | Contenu (exemples)                                                |
| ------------------------ | ----------------------------------------------------------------- |
| Équipement               | sac à dos, vêtements, outil                                       |
| Construction             | pièces bois / pierre / béton / acier, piliers                     |
| Extraction               | foreuses                                                          |
| Métallurgie              | fourneaux, estampeuse, Bessemer, lavage                           |
| Logistique               | tapis, bras, séparateur, groupeur, trieur, tunnels, barils        |
| Énergie                  | générateurs, poteaux, turbines, solaire, accumulateurs, nucléaire |
| Fluides                  | tuyaux, pompes, surpresseurs, raffinerie                          |
| Véhicules                | buggy, autres                                                     |
| Défense                  | pistolet, munitions, tourelles                                    |
| Recherche et information | laboratoires, boussole, balise                                    |

Règle : **chaque technologie (type, tier) débloque au plus 2 objets** ; un type sans objet à un tier n'a pas de technologie à ce tier.

### 1.3 Proposition : paquets de science T1 à T4

Principe : **le paquet de chaque tier est fait avec les matériaux typiques de ce tier**, et le T4 réutilise un déchet de la filière précédente (cohérence de la progression).

| Paquet | Recette cible                                                      | Matières demandées                    |
| ------ | ------------------------------------------------------------------ | ------------------------------------- |
| **T1** | 1 engrenage en fer + 1 fil de cuivre                               | fer, cuivre, estampeuse (point 3)     |
| **T2** | 1 plaque d'acier + 1 tuyau en laiton                               | acier (Bessemer), zinc + cuivre       |
| **T3** | 1 puce en silicium + 1 câble isolé                                 | silicium, plastique (pétrole), cuivre |
| **T4** | 1 puce en silicium + 1 plaque d'acier + 1 barre d'uranium appauvri | déchet de centrifugation              |

Tant que les objets n'existent pas, on branche une **recette provisoire** (paquet T1 actuel : 2 lingots de fer + 2 lingots de cuivre) et on la remplace quand l'objet arrive.

### 1.4 Décisions complémentaires (Tour 85, suite)

- **Types de technologies validés** (les dix de la table §1.2). Le tableau « type × tier → 2 objets » sera proposé quand on aura les objets de chaque tier (points 3 à 7).
- **Coût en paquets de science** : réglé en jouant (valeurs de départ simples, qui montent à chaque tier).
- **Tier 0 (âge de la récolte)** : déjà débloqué ou débloqué **par la récolte** (mécanisme « découverte » : récolter 10 minerais de cuivre débloque la **roue à aubes**). Il sert à démarrer **sans électricité**.
- **Roue à aubes (T0)** : grande roue en bois mue par le courant, axe mécanique relié à une petite dynamo primitive en cuivre. Recette : **12 bois + 4 pierre + 4 fils de cuivre**. Doit être posée sur une case **adjacente à un étang**. Produit **10 kW, constants à 100 %**.
  - Conséquences à traiter : il faut l'objet **fil de cuivre** (point 3) ; le laboratoire actuel consomme 30 kW (3 roues, ou un laboratoire T1 moins gourmand) ; une pompe électrique consomme 20 kW.
  - Nouveau mécanisme à coder : **déblocage par récolte cumulée** (compteur par ressource, enregistré avec la partie), distinct des technologies payées en paquets.

## 2. Point 2 — le monde (en discussion)

### 2.1 Ce que dit le document

- Richesse des gisements selon la distance D au point de départ : **quantité = Q_base × (1 + (D/100)^1,5)** (formule du document ; son LaTeX est cassé, à confirmer).
- Autour du départ (150 m garantis), ressources **faibles et limitées** pour forcer à partir.
- Les gisements **s'épuisent** (déjà le cas).
- Minerais : charbon, **hématite** (fer), **malachite** (cuivre), **sphalérite** (zinc), **bauxite** (aluminium), plus **silicium** (quartz) et **uraninite** (T4, « exclusivement très loin »).
- **Étangs** : inépuisables, ne bloquent plus la logistique : **dalles de sol (ponts)** en bois, pierre ou béton posées par-dessus l'eau pour y faire passer tapis et poteaux.

### 2.2 État actuel du jeu

- Quantité par case = `centerAmount` (3 500) × richesse (×0,8 à ×1,2) × densité × profil (9 % au bord) ; **identique partout** dans le monde.
- 3 minerais : fer, cuivre, charbon. Étangs : cases d'eau infranchissables, on ne peut pas y poser de machine.
- Zone de départ garantie : ≈ 150 m, aucun nid avant 250 m.

### 2.3 Décisions du PO (Tour 85) et réalisation

- **Base** : 1 000 au centre à D = 0 (au lieu de 3 500) × **1 + (D/100)^1,5** (D = distance du centre du gisement au départ). À 150 m : ×2,8 ; 500 m : ×12 ; 1 000 m : ×32.
- **Distance** : change aussi la **taille** (rayon ×1 → ×2 à 1 000 m) et l'**espacement** (÷ (1 + D/2000) sur la présence).
- **Nouveaux minerais par paliers** : sphalérite (zinc) et bauxite ≥ 300 m, quartz (silicium) ≥ 600 m, uraninite ≥ 1 200 m (`minDistanceM` dans `resources.json`) ; ils ne font pas partie des gisements garantis au départ.
- **Noms réels** : Hématite (iron_ore), Malachite (copper_ore) ; les identifiants ne changent pas. Les nouveaux minerais se récoltent mais **n'ont pas encore d'usage** (point 3).
- **Ponts** (codé) : une dalle de sol posée sur une case d'eau la rend **praticable** (joueur, tapis, tuyaux, poteaux, machines) ; sans pilier. Limite actuelle : les machines posées sur un pont ont leur base dans la dalle (10 cm) ; rendu à reprendre avec le point 4 (grille et structure).

## 4. Point 4 — grille et structure (Tour 86)

### 4.1 Décisions du PO

- **On garde le 2×2** (tuiles de 1 m pour tapis, tuyaux, bras, séparateurs…). **Note de conception** : la taille pourra être modifiée (1×1) **quand on aura mis un vrai modèle 3D** ; tout est piloté par `content/machines.json` (`w`, `d`) et par les constantes de tuile.
- **Piliers de soutènement automatiques** : un pilier compte comme **support** et est **posé automatiquement à 2,5 m de distance d'un support**. Un support est un mur qui touche le sol, un objet en contact avec le sol, ou un objet qui touche un objet en contact avec le sol, etc.

### 4.2 Règle codée (`src/core/build/support.ts`)

- **Aucune pièce n'est refusée** (la pose reste libre, comme au Tour 76) : c'est le **pilier qui est ajouté**, gratuitement et sans item.
- Une pièce en hauteur (dalle, plafond, marche d'escalier, mur ou porte à un étage ≥ 1) doit avoir un **support à moins de 2,5 m** (distance horizontale). Sinon, un **pilier** est posé automatiquement **sous la pièce** et, si besoin, d'autres en dessous (un par étage) jusqu'au sol ou jusqu'à une dalle soutenue.
- **Support** = colonne qui descend jusqu'au sol : **mur** dont les blocs sont empilés jusqu'au sol (ou posés sur une dalle elle-même soutenue), **pilier** (30 cm de large) posé au sol ou sur une dalle soutenue. Le dessus du support doit être à la face de la pièce (on ne soutient que par dessous).
- Le calcul est récursif et par face : un mur sur une dalle soutenue est soutenu, donc des étages empilés se soutiennent entre eux.
- Une grande dalle posée case par case reçoit un pilier tous les ≈ 3 m (6 cases) dès qu'elle dépasse 2,5 m d'un support.
- Le pilier est une pièce (`pillar_wood` / `pillar_stone`, du matériau de la pièce soutenue), visible, solide (collision), **démolissable** (clic droit maintenu) **sans rendre d'objet**.
- Rien ne s'effondre : si on démolit un support, les pièces au-dessus restent (pas de ruine) ; un nouveau pilier est ajouté seulement à la **prochaine pose** qui en a besoin.

### 4.3 Reste à faire (point 4b)

- **Tapis et tuyaux surélevés** : même règle (piliers automatiques tous les 2,5 m le long d'un niveau 1 ou 2). Le Tour 86 ne traite que les pièces de construction ; les tapis surélevés gardent leur support dessiné actuel.
- **Machines à l'étage** : elles exigent déjà une dalle ; la dalle reçoit ses piliers.
- **Ponts sur l'eau** : une dalle posée à la hauteur du sol sur l'eau est un sol (face 0), donc déjà « soutenue » ; pas de pilier.

## 9. Point 9 — survie : mort, corps, duvet et lit (Tour 86)

### 9.1 Décisions du PO

- **À la mort, tout reste sur le corps** : sac, ce qu'on tient, équipement. On retourne à la tombe **✝** (carte, et boussole si _Navigation_ est recherchée) et on **interagit (F)** pour tout reprendre d'un coup.
- **Réapparition** : **duvet d'exploration à usage unique** + **lit fixe permanent** ; la touche **H disparaît**.

### 9.2 Réalisation

- **Mort** : `GameState.dieAt` crée un **corps** (`changes.corpses`, plusieurs possibles) avec son contenu (sac + curseur + équipement) ; le joueur repart avec le sac **vide**. Le joueur réapparaît au **dernier duvet ou lit posé** ; un duvet est **détruit** à la réapparition, un lit reste ; sans rien de posé, au point de départ.
- **Récupération** : près du corps (≤ 2,5 m), **F** : l'équipement se remet sur le joueur (ou va au sac si l'emplacement est pris), puis le contenu passe au sac **tant que la place le permet** ; le reste attend sur le corps ; un corps vide disparaît.
- **Objets** : **Duvet d'exploration** (10 tissu ; consommable, 1,5 kg) et **Lit** (8 lingots de fer + 12 tissu ; 14 kg), débloqués provisoirement par _Textile_ (à reclasser dans la refonte). On les **pose au clic** (comme le buggy) à portée de 6 m ; **Maj + F** à moins de 2,5 m les range.
- **Carte** : ✝ (corps), ⚑ (lit), ⚐ (duvet) ; **boussole** : repère du corps le plus proche.
- **Sauvegarde** : `corpses` et `spawns` dans les changements ; les anciens `corpse` / `respawn` du Tour 83 n'existent plus (on repart de zéro).

## 3. Point 3 — métallurgie

### 3.1 Décisions du PO (Tour 87)

- **Le fourneau choisit sa recette dans sa fenêtre** (comme l'assembleur) ; il n'en a aucune par défaut.
- **T1 : cuivre** = 2 malachite → 2 lingots de cuivre. **T2 : zinc** = 2 sphalérite → 2 lingots de zinc ; **laiton** : 1 lingot de cuivre + 1 lingot de zinc → **2 tuyaux de laiton**.
- **Un moule par produit**, **8 cycles** avant de se briser.
- **Découpage** : **3a maintenant (T1)**, **3b ensuite (T2)**.

### 3.2 Réalisé (3a)

- **Recettes** dans `content/recipes.json` (ingrédients, produit, durée, moule ; `mouldCycles` = 8) :

| Machine    | Recette                                | Ingrédients                          | Produit             | Durée |
| ---------- | -------------------------------------- | ------------------------------------ | ------------------- | ----- |
| Fourneau   | Lingots de fer                         | 2 hématite + 1 charbon               | 2 lingots de fer    | 2 s   |
| Fourneau   | Lingots de fonte                       | 2 hématite + 3 charbon               | 2 lingots de fonte  | 4 s   |
| Fourneau   | Lingots de cuivre                      | 2 malachite                          | 2 lingots de cuivre | 3 s   |
| Fourneau   | Moule de plaque / d'engrenage / de fil | 2 / 3 / 2 lingots de fonte           | 1 moule             | 3 s   |
| Estampeuse | Plaque de fer                          | 2 lingots de fer + moule de plaque   | 1 plaque            | 2 s   |
| Estampeuse | Engrenage en fer                       | 2 lingots de fer + moule d'engrenage | 1 engrenage         | 2 s   |
| Estampeuse | Fil de cuivre                          | 1 lingot de cuivre + moule de fil    | 2 fils              | 1,5 s |

- **Le charbon d'une recette est un réactif** (il va dans les ingrédients) ; le combustible reste une case à part. Quand les ingrédients sont pleins, le charbon qui arrive devient du combustible.
- **Estampeuse T1** (3×3, 12 lingots de fer + 10 pierre, technologie provisoire _Métallurgie_ : 20 lingots de fer + 10 pierre) : brûle du combustible (60 kW), une case de **moules** ; chaque cycle use le moule de 1, il se brise après 8 cycles et le suivant (en réserve) est engagé ; sans moule : état **« Pas de moule »**. Changer de recette rend les ingrédients, le produit et les moules inutiles.
- **Nouveaux objets** : lingot de fonte, plaque de fer, engrenage en fer, fil de cuivre, trois moules (non fabricables à la main : seulement au fourneau).
- **Fenêtre** : recette, ingrédients, moule + usure, combustible, produit ; infobulle de la machine : recette, ingrédients en attente, moule.
- **Sauvegarde** : `recipe`, `slots`, moule (`input`) et usure (`wear`) ; les anciens fourneaux (sans recette) se rechargent sans recette.

### 3.3 À faire (3b, T2) et branchements

- Zinc, laiton (tuyau de laiton), acier (Bessemer, scories), béton (pierre écrasée + scorie), constructeur T2, station de lavage.
- **Roue à aubes** (tier 0) : demande le **fil de cuivre**, maintenant disponible ; à coder avec le mécanisme « débloquer en récoltant 10 cuivre ».
- **Paquets de science T1** : engrenage en fer + fil de cuivre (objets maintenant disponibles) ; la recette actuelle (2 lingots de fer + 2 de cuivre) reste provisoire.

### 3.4 Tier 0 : roue à aubes et paquets de science T1 (Tours 88 et 89)

- **Décisions du PO (Tour 89)** : **pas de laboratoire à combustible** ; la roue à aubes se débloque en **fabriquant 10 plaques de cuivre** ; elle apparaît **parmi les premières cartes de la fenêtre des technologies** avec son compteur « décompte / 10 plaques de cuivre » ; elle produit 10 kW, **il en faut 3 pour faire tourner un laboratoire** (30 kW).
- **Découvertes** (mécanisme, `content/discoveries.json`) : un objet se débloque quand un objectif cumulé est atteint, sans technologie ni laboratoire. `goal.kind` : `harvest` (récolté à la main) ou `produce` (fabriqué par une machine ou à la main). Compteurs `changes.harvested` / `changes.produced` et `changes.discovered`, sauvegardés. Notification au déblocage ; infobulle d'un objet verrouillé : « Se débloque en fabriquant 10 × plaque de cuivre (a / 10) ».
- **Plaque de cuivre** (nouvel objet) : estampeuse, 2 lingots de cuivre + moule de plaque (le même que la plaque de fer), 2 s. Les fabrications des machines (`Factory.takeProduced`) alimentent le compteur.
- **Fenêtre des technologies** : les découvertes sont affichées **en tête**, avec leur avancement, qui se met à jour pendant que la fenêtre est ouverte.
- **Roue à aubes** (`waterwheel`, 3×3, 12 bois + 4 pierre + 4 fils de cuivre) : doit être posée **contre un étang** (sans être dans l'eau). **10 kW constants**, sans combustible.
- **Paquet de science T1** : **1 engrenage en fer + 1 fil de cuivre** ; il faut donc l'estampeuse et ses moules.
- Reste pour le tier 0/1 : les paquets de science T2 à T4, et les technologies par type × tier.

### 3.5 Point 3b-1 : zinc, concasseur, tuyau de cuivre (Tour 90)

- **Décisions du PO** : le **moule de plaque sert au fer et au cuivre** ; **tuyaux** : T1 en **cuivre** = 1 plaque de cuivre, **à la main**, donne **2 tuyaux** (vitesse de fabrication selon l'outil) ; T2 en **laiton** = 1 lingot de cuivre + 1 lingot de zinc, dans un **constructeur T2**, donne 2 tuyaux ; T3 en **acier** = 2 lingots d'acier + électricité lourde, dans une **presse hydraulique lourde T3**, donne 2 tuyaux. **Concasseur** : machine à combustible T1, **1 pierre → 1 pierre écrasée**. **Constructeur T2 mis de côté** (donc le tuyau de laiton attend le 3b-3). Découpage : **3b-1** zinc, laiton, concasseur ; **3b-2** Bessemer, acier, scories, béton ; **3b-3** lavage et constructeur.
- **Codé** : recette de fabrication à plusieurs unités (`yield` dans `items.json`) ; **tuyau en cuivre** (objet `machine_pipe`, 1 plaque de cuivre → 2 tuyaux, à la main) ; **zinc** (fourneau : 2 sphalérite → 2 lingots de zinc en 3 s, sans charbon), débloqué par la technologie provisoire **Métallurgie T2** (30 paquets de science, après Métallurgie et Électricité) ; **concasseur** (3×3, 8 lingots de fer + 12 pierre, 60 kW de combustible, recette choisie d'office : pierre écrasée en 2 s), débloqué avec l'estampeuse par **Métallurgie** (T1) ; une recette dont le produit n'est pas débloqué n'apparaît pas dans la fenêtre.
- **À faire** : tuyau de laiton (constructeur T2, 3b-3), tuyau d'acier (presse hydraulique T3), **durée de fabrication à la main selon l'outil** (aujourd'hui instantanée), pression et friction par type de tuyau (point 6).

### 3.6 Point 3b-2 : acier, scorie, béton (Tour 91)

- **Machines à plusieurs sorties** : une recette peut avoir un **sous-produit** (second objet de `out`) : il va dans une case « sous-produit » et sort par la même face que le produit (produit d'abord, puis sous-produit). Une case de sous-produit pleine bloque le cycle (état « Plein »). Les machines **électriques** (`consumesKw`) n'ont pas de combustible : sans courant, état « Pas de courant », et elles demandent du courant seulement quand un cycle peut démarrer.
- **Convertisseur Bessemer** (3×3, 90 kW, 10 plaques de fer + 6 engrenages + 8 fils de cuivre) : recette unique **2 lingots de fonte → 2 lingots d'acier + 1 scorie** en 3 s ; pollue l'air (0,8/s). Débloqué par **Métallurgie T2** (avec le zinc).
- **Bétonnière** (3×3, 30 kW, 8 plaques de fer + 4 engrenages + 10 pierre) : recette unique **1 pierre écrasée + 1 scorie → 2 blocs de béton** en 2 s. Débloquée par la technologie provisoire **Construction T2** (30 paquets de science, après Métallurgie T2), avec le bloc de béton.
- **Boucle** : fonte (fourneau) → Bessemer → acier + scorie → bétonnière avec la pierre écrasée du concasseur.
- **À faire** : utilisations du béton (poteaux T2, fondations, pièces de construction en béton), de l'acier (plaque d'acier, tuyau d'acier), laiton (3b-3 : constructeur T2), lavage (3b-3), tableau « type × tier ».

## 5. Point 5 — logistique

### 5.1 Décisions du PO (Tour 92)

- **Foreuses** : chiffres du document : **T1 1/s** (combustible, 90 kW), **T2 4/s** (électrique, 90 kW), **T3 10/s** (« économe », 25 % d'électricité en moins que la T2, soit 67,5 kW).
- **Montée de tier** : objets **distincts**, et on **pose le palier supérieur par-dessus** pour améliorer (le tapis plus lent est remplacé en gardant ses objets ; l'ancien revient dans le sac). On ne pose pas un tapis plus lent sur un plus rapide.
- **Filtres** (bras T3, trieur) : **liste cochable des objets, liste blanche ou noire**, avec un filtre par sortie pour le trieur.
- **Découpage** : **5a** foreuses + tapis par tier ; **5b** bras et trieur filtrants ; **5c** tunnels à patron + piliers (tapis surélevés et machines en hauteur) ; **5d** barils (avec les fluides, point 6).

### 5.2 Réalisé (5a)

- **Tapis** : un objet par palier (`machine_conveyor`, `_2`, `_3`), même machine avec un champ `tier` (sauvegardé) : vitesses **0,75 / 1,5 / 3,0 cases/s**, couleurs gris foncé / bleu / clair. Recettes provisoires : **T2** 1 lingot d'acier + 1 engrenage → 2 tapis (technologie **Logistique T2**, 40 paquets de science, après Logistique et Métallurgie T2) ; **T3** 2 lingots d'acier + 2 engrenages + 2 fils de cuivre → 2 tapis (**Logistique T3**, 100 paquets de science ; les rouleaux en polymère viendront avec le plastique, point 7).
- **Foreuse T3 « économe »** (4×4, 12 lingots d'acier + 8 engrenages + 12 fils de cuivre ; technologie **Extraction T3**, 60 paquets de science ; l'aluminium viendra avec la bauxite).
- **Cadences** (`mineSeconds`) : T1 1 s, T2 0,25 s, T3 0,1 s. Un tapis T1 (≈ 2 minerais/s) sature avant une foreuse T2 (4/s) : c'est voulu, il faut passer au T2.
- Panneau d'infos et fenêtre : le nom et la vitesse suivent le palier ; le tapis qui emporte le joueur suit aussi son palier.
- **À reprendre** : les coûts des paliers (provisoires), les paquets de science T2/T3, les limites de débit par tuile (6 objets).

### 5.3 Réalisé (5b, Tour 93) : bras filtrant et trieur

- **Filtre** (`Machine.filters`, sauvegardé) : un mode (**liste noire** par défaut, vide = tout passe ; **liste blanche** = seuls les objets cochés passent) et une liste d'objets. Fenêtre de la machine : choix du mode, **grille d'objets à cocher** (recherche par nom, « Tout décocher »), résumé « Seulement N objet(s) » ou « Tout passe sauf N objet(s) ».
- **Bras filtrant T3** (`arm_filter`, 2×2, électrique 30 kW, cycle **0,3 s**, 1 filtre ; 4 lingots d'acier + 4 engrenages + 8 fils de cuivre) : il ne prend que les objets autorisés, même derrière un objet refusé ; diagnostic « rien à prendre » quand le filtre refuse tout. Débloqué par **Logistique T3** (avec le tapis T3).
- **Trieur T3** (`sorter`, 2×2, électrique 15 kW, **3 filtres : devant, gauche, droite** ; 3 lingots d'acier + 2 engrenages + 6 fils de cuivre) : comme le séparateur (1 entrée derrière, 3 sorties) mais chaque objet va vers la sortie dont le filtre l'accepte, à tour de rôle entre les sorties qui l'acceptent ; sans courant il n'aiguille rien (« Pas de courant ») ; un objet qu'aucune sortie n'accepte reste bloqué. Débloqué par **Tri T3** (120 paquets de science, après Logistique T3).
- **À faire** : filtrer sur d'autres critères (catégorie, « tout sauf »), copier-coller d'un filtre, voyants lumineux montrant les sorties actives.

### 5.4 Tunnels à patron et piliers (5c)

- **Portée du tunnel selon le tapis** : T1 4 tuiles, T2 8, T3 16 ; tuyaux 4 tuiles (`tunnelRange(type, tier)`).
- **Patron** : PageDown sans tracer = entrée de tunnel avec la sortie fantôme à portée max devant ; en traçant, les tunnels s'enchaînent par paires (entrée, sortie, entrée…). Les tuyaux ne sont que « à plat » ou « entrée de tunnel ».
- **Piliers de tapis** : un tapis surélevé (niveau 1 ou 2, rampes depuis le niveau 1 comprises) reçoit automatiquement et gratuitement un pilier de pierre s'il n'y a aucun support à moins de 2,5 m (`pillarsForFace`).
- **À faire** : piliers pour les machines surélevées.

### 5.5 Barils (5d)

- **Remplisseuse / videuse de barils T3** (`barreler`, 2×2, électrique 20 kW, réserve 200 L) : une seule machine, deux recettes choisies dans sa fenêtre (« Remplir » : baril vide + 100 L d'eau → baril d'eau ; « Vider » : l'inverse), 2 s par cycle. Eau par les côtés (tuyaux), objets : entrée derrière, sortie devant. 4 lingots d'acier + 4 engrenages + 8 fils de cuivre. Débloquée par **Logistique : barils T3** (80 paquets, après Vapeur et Logistique T3).
- **Baril vide** : 2 lingots d'acier (120 L de volume, 8 kg) ; **baril d'eau** : 100 L (108 kg). C'est un objet solide : tapis, coffre, sac.
- Seule l'eau se met en baril pour l'instant ; les autres fluides (pétrole…) arriveront avec les points 6/7 en ajoutant une recette (`fluid` dans `recipes.json`).

### 3.7 Point 3b-3 : constructeur T2, presse lourde T3, lavage, tuyaux laiton et acier (Tour 96)

- **Constructeur T2** (`builder`, 3×3, 40 kW électrique ; 10 plaques de fer + 6 engrenages + 10 fils de cuivre) : recette **tuyaux de laiton** = 1 lingot de cuivre + 1 lingot de zinc → 2 tuyaux, 2 s.
- **Presse hydraulique lourde T3** (`heavy_press`, 3×3, **150 kW** : « électricité lourde » ; 12 lingots d'acier + 8 engrenages + 12 fils) : **tuyaux d'acier** = 2 lingots d'acier → 2 tuyaux, 3 s.
- **Station de lavage T2** (`washer`, 3×3, 25 kW, réserve 200 L, eau par les côtés ; 8 plaques de fer + 4 engrenages + 10 pierre) : 2 minerais bruts + 20 L d'eau → **3 minerais purifiés** (fer, cuivre, zinc), 3 s. Le fourneau a des recettes équivalentes avec le minerai purifié (mêmes quantités et durées) : le rendement passe de 1 à 1,5 lingot par minerai brut.
- **Tuyaux par palier** : `machine_pipe` (cuivre, T1), `machine_pipe_2` (laiton, T2), `machine_pipe_3` (acier, T3) ; on pose un palier supérieur par-dessus pour améliorer sur place (le fluide reste). Couleurs cuivre / laiton / acier. **Pression, friction et portée de tunnel par palier : point 6** (aujourd'hui, seule la couleur change).
- Technologies : **Fabrication T2** (40 paquets, après Métallurgie T2 : constructeur, tuyau de laiton, lavage) ; **Presse lourde T3** (100 paquets, après Fabrication T2 et Construction T2 : presse, tuyau d'acier).
- **À faire** : durée de fabrication à la main selon l'outil ; eau « sous pression » du lavage et boost de vitesse du constructeur à l'eau froide (point 6).

## 6. Point 6 — réseaux Volts et Bars

- **Découpage (PO)** : **6a** Volts (surcharge, blackout, manivelle) ; **6b** Bars (pression, friction, paliers de tuyaux, surpresseur, rupture et réparation, valeurs du document : cuivre 5 bars / −0,1 par case, laiton 20 bars / −0,05, acier 50 bars / −0,02) ; **6c** refroidissement à l'eau (+50 % de vitesse) et eau sous pression du lavage.

### 6.1 Point 6a : surcharge et blackout (Tour 97)

- Demande entre 100 et 110 % de la production : les machines **ralentissent** (comme avant). Demande **au-delà de 110 % pendant 2 s**, ou **surcharge de plus de 10 s** : **blackout** du réseau (poteaux reliés) : plus aucune machine ne tourne (« Pas de courant »), les générateurs ne brûlent plus.
- **Manivelle de réamorçage** (`crank`, 2×2, 4 plaques de fer + 2 engrenages ; débloquée par Électricité) : posée près d'un poteau, sa fenêtre a un bouton « Actionner la manivelle ». Le réseau repart seulement si la production couvre la demande ; sinon « Demande trop forte » : couper des machines (les retirer) ou ajouter des générateurs.
- Le poteau affiche « BLACKOUT » ou « Surcharge depuis N s ». Le blackout n'est pas sauvegardé (un rechargement rallume le réseau).

### 6.2 Point 6b : pression, friction, rupture, surpresseur (Tour 98)

- **Pression de départ** : pompe **3 bar** (eau), chaudière **8 bar** (vapeur, tant qu'elle en contient). Elle baisse de la **perte de charge** de chaque tuile de tuyau traversée ; à **0 bar** le fluide s'immobilise (les tuyaux trop loin de la source ne se remplissent plus). Calcul toutes les 0,25 s.
- **Paliers de tuyaux** : cuivre T1 **5 bar max**, −0,1 bar/tuile ; laiton T2 **20 bar**, −0,05 ; acier T3 **50 bar**, −0,02. Un tunnel de tuyau compte autant de tuiles que sa longueur.
- **Rupture** : un tuyau qui dépasse son maximum se **rompt** (rouge sombre, état « Rompu ») : il se vide, ne laisse rien passer et coupe la pression en aval. **Réparation** : poser un tuyau neuf du même palier (ou supérieur) par-dessus ; le tuyau rompu est jeté, pas rendu. Conséquence : la **vapeur (8 bar) exige du laiton** dès la sortie de la chaudière (chaudière collée à la turbine : aucun tuyau, aucun problème).
- **Surpresseur T2** (`booster`, 2×2, 30 kW, 6 plaques de fer + 4 engrenages + 6 fils + 4 lingots de cuivre ; technologie Fabrication T2) : le fluide entre derrière et sort devant avec **+2 bar** ; sans courant il laisse passer sans rien ajouter. Attention : la pression ajoutée peut rompre des tuyaux de cuivre trop proches de leur maximum.
- **Rupture visible** (Tour 99) : gerbe de vapeur blanche avec étincelles orangées pendant 1,5 s, puis jet continu qui siffle ; bruit d'éclatement et message « Un tuyau vient d'éclater ». Non fait : la pression ne module pas le débit (seul le seuil 0 bar compte).

### 6.3 Point 6c : refroidissement à l'eau, eau chaude, eau sous pression (Tour 99)

- **Nouveau fluide : l'eau chaude** (orange dans les tuyaux). Un tuyau ne porte toujours qu'un fluide à la fois.
- **Refroidissement actif** : le **constructeur T2** a une entrée d'eau froide (côté gauche) et une sortie d'eau chaude (côté droit). Quand il travaille avec au moins 4 L d'eau par seconde et de la place pour rejeter l'eau chaude, sa vitesse passe à **+50 %**. Sans eau, il travaille à vitesse normale. (Le four électrique T3 du document n'existe pas encore : il reprendra le même mécanisme, champs `coolBoost` / `coolLitersPerS`.)
- **Tour de refroidissement T2** (`cooling_tower`, 3×3, sans énergie ; 12 plaques de fer + 4 engrenages + 10 pierre ; technologie Fabrication T2) : l'eau chaude entre derrière, ressort froide devant, 20 L/s.
- **Chaudière** : accepte l'eau chaude par ses côtés (comme l'eau) et la chauffe en premier avec **moitié moins de combustible**.
- **Eau sous pression pour le lavage** : les recettes de la station de lavage exigent **2 bar** au moins (`minBar`) ; état « Pression insuffisante » sinon.
