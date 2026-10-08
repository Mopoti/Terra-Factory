# Refonte des objets et du contenu — suivi point par point

> Document de travail créé au **Tour 85**. Il suit l'intégration des idées de `gdd_factorisation.md` (fourni par le PO) dans le jeu, **un point à la fois**. Rien n'est codé tant que le point n'est pas validé.
> Autres fichiers fournis : `prompts_assets.md` (prompts d'images pour Scenario.gg : sert de **vocabulaire d'objets** uniquement) et la `passation.md` externe (information).

## 0. Carte des points

| #   | Point                                                                                                            | Statut                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Cadre : tiers, technologies par type, paquets de science, noms réels, outil, tier 0 (roue à aubes)               | **validé et codé (Tour 85)**                                           |
| 2   | Monde : richesse selon la distance, nouveaux minerais, ponts sur les étangs                                      | **codé** (richesse selon la distance, minerais par paliers, ponts)     |
| 3   | Métallurgie : fer + charbon, fonte, moules, estampeuse (3a, T1) ; Bessemer, béton, lavage, zinc, laiton (3b, T2) | **codé** (3a Tour 87, 3b Tours 90–96)                                  |
| 4   | Grille et structure : convoyeurs 1×1, piliers automatiques                                                       | **codé** (4b : les tapis surélevés ont leurs piliers depuis le Tour 94 ; les tuyaux restent au sol) |
| 5   | Logistique : foreuses et convoyeurs T1–T3, bras filtrants, trieur, barils, tunnels « à patron »                  | **codé** (5a–5d, Tours 92–95)                                          |
| 6   | Réseaux Volts et Bars : blackout, pression, friction, tuyaux T1–T3, réparation, refroidissement                  | **codé** (6a–6c, Tours 97–99)                                          |
| 7   | Pétrole, plastique, câbles isolés (T3)                                                                           | **codé** (7a–7d, Tours 100–103)                                        |
| 8   | Ennemis : éclaireurs, gardiens, cracheurs ; réparation                                                           | **codé** (Tour 106) ; expansion des colonies (Tour 127)                 |
| 9   | Survie : duvet, lit fixe, sac laissé sur le cadavre                                                              | **validé et codé (Tour 86)**                                           |
| 10  | UX : tutoriel progressif, « Continuer » enrichi, ratio de distance, créatif/survie                               | **codé** (10a–10c, Tours 107–109)                                      |
| 11  | Fin de partie : fission, fusion, balise, comptoir spatial                                                        | **codé** (11a–11d, Tours 110–113)                                      |
| 12  | Multiplateforme : tactile, manettes, Steam                                                                       | **codé** : 12a tactile, 12b manette ; Steam plus tard                  |

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
- **Nouveaux minerais par paliers** : sphalérite (zinc) et bauxite ≥ 300 m, uraninite ≥ 1 200 m (`minDistanceM` dans `resources.json`) ; ils ne font pas partie des gisements garantis au départ.
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

## 7. Point 7 — pétrole, plastique, câbles isolés, silicium

- **Découpage (PO)** : **7a** sable et silicium (le PO a précisé la filière en détail) ; **7b** pétrole (gisement liquide comme les minerais, ≥ 500 m, chevalet de pompage 1 L/s, fluide pétrole, barils de pétrole) ; **7c** raffinerie T3 + presse → isolants en plastique ; **7d** câble isolé (4 fils de cuivre + 1 isolant → 4 câbles) et paquet de science T3 (1 puce en silicium + 1 câble isolé).

### 7.1 Point 7a : sable et silicium (Tour 100)

- **Quartz supprimé** du jeu (ressource, objet, légende de la carte).
- **Sable sur la carte** : gisements de sable (ressource `sand`, ultra-abondants dans le **désert** : poids ×2,4 ; rares ailleurs ; un gisement de départ près du point d'apparition) + **bande de sable de 2 à 4 m (4 à 8 cases) autour des étangs**, 400 par case. Finis et épuisables. Récolte à la main (objet **sable siliceux**) ou à la **foreuse électrique** (T2, T3 éco) ; la **foreuse à combustible T1 ne sait pas le miner**.
- **Sur-broyage** : seconde recette du concasseur, **2 pierres écrasées → 1 sable siliceux** (3 s), pour les joueurs sans eau ni désert à proximité. (Le concasseur reste à 100 % : 1 pierre → 1 pierre écrasée.)
- **Four électrique T3** (`furnace_electric`, 3×3, 200 kW, 8 lingots d'acier + 6 engrenages + 12 fils ; technologie **Silicium T3**, 120 paquets, après Presse lourde T3) : **4 sable siliceux + 1 charbon (réactif) → 2 silicium brut** (4 s) ; pollue l'air. Il a aussi le **refroidissement à l'eau** du 6c (+50 %).

### 7.2 Point 7b : pétrole, chevalet de pompage, barils de pétrole (Tour 101)

- **Gisements de pétrole** (`oil`, liquide) : à partir de **500 m** du départ, même formule de richesse et de taille que les minerais (plus riche loin) ; un peu plus fréquents dans le désert. **Non récoltables à la main** ; invisibles pour les foreuses. Sur la carte : légende « Pétrole ».
- **Nouveau fluide : le pétrole** (noir dans les tuyaux ; un seul fluide par tuyau).
- **Chevalet de pompage T3** (`pumpjack`, 3×3, 60 kW, réserve 200 L, 10 lingots d'acier + 8 engrenages + 10 plaques de fer + 6 fils) : se pose sur le gisement, **1 L/s**, **4 bar** (supporte le cuivre), sortie devant ; le gisement diminue d'1 par litre. Technologie **Pétrole T3** (140 paquets, après Barils T3 et Presse lourde T3).
- **Barils de pétrole** : la remplisseuse/videuse accepte aussi le pétrole (recettes « Remplir / Vider un baril de pétrole », 100 L, objet `barrel_oil`).
- À venir (7c) : raffinerie T3, qui exigera une haute pression (surpresseurs, tuyaux de laiton ou d'acier).

### 7.3 Point 7c : raffinerie et plastique (Tour 102)

- **Nouveau fluide : le polymère liquide** (violet dans les tuyaux).
- **Raffinerie T3** (`refinery`, 3×3, 150 kW, réserve 200 L ; 16 lingots d'acier + 10 engrenages + 16 fils + 8 blocs de béton) : pétrole par le côté gauche, polymère par le côté droit, **1 L de pétrole → 1 L de polymère, 10 L/s**, pollue l'air. **Exige 8 bar** sur le pétrole (le chevalet n'en donne que 4 : deux surpresseurs en ligne, ou des tuyaux qui perdent peu) ; sinon état « Pression insuffisante ». Choix par défaut du PO non précisé : 8 bar.
- **Presse à plastique T3** (`plastic_press`, 3×3, 80 kW ; 8 lingots d'acier + 6 engrenages + 10 fils) : recette unique **20 L de polymère (côté gauche) → 4 isolants en plastique** en 3 s ; les isolants sortent devant.
- Technologie **Plastique T3** (160 paquets, après Pétrole T3).
- À venir (7d) : câble isolé (4 fils de cuivre + 1 isolant → 4 câbles), puce en silicium, paquet de science T3.

### 7.4 Point 7d : câble isolé, puce en silicium, paquet de science T3 (Tour 103)

- **Câble isolé** : 4 fils de cuivre + 1 isolant en plastique → **4 câbles isolés** (technologie Plastique T3, qui demande maintenant aussi Silicium T3).
- **Puce en silicium** (recette provisoire du PO à confirmer) : 1 silicium brut + 2 fils de cuivre → 1 puce (technologie Silicium T3).
- **Paquet de science T3** : 1 puce en silicium + 1 câble isolé → 1 paquet (comme le tableau du §1.3). Le laboratoire l'accepte (un seul type de paquet à la fois dans sa case) et **1 paquet T3 compte pour 3 études** : valeur provisoire en attendant le tableau type × tier (technologies qui exigent chacune leur paquet).
- Point 7 terminé. Reste à faire : paquets T2 (plaque d'acier + tuyau de laiton) et T4, tableau type × tier.

### 7.5 Laboratoire à plusieurs emplacements (Tour 104)

- Demande du PO : le laboratoire a **plusieurs emplacements** pour des piles de paquets, et les piles peuvent être de **types différents** (plus tard, des recherches demanderont plusieurs types de paquets à la fois).
- **4 emplacements**, piles de **20** ; seuls les paquets de science y entrent (à la main, par tapis ou bras). Même fenêtre qu'un coffre (glisser, clic, Maj + clic).
- Pour l'instant une étude consomme **un paquet par cycle, le moins précieux d'abord** (un paquet T3 ne sert pas tant qu'il reste des T1) ; le tableau type × tier remplacera cette règle par les besoins de chaque recherche.
- Les anciennes sauvegardes gardent leurs paquets (l'ancienne case unique passe dans le premier emplacement).

## 8. Technologies par type × tier et paquets de science (Tour 105)

- **Décisions du PO** : une technologie du **tier N se paie en paquets du tier N−1** (T1 : en objets, comme avant ; T2 : paquets T1 ; T3 : paquets **T2** ; T4 : paquets T3) — cela évite le cercle (l'acier des paquets T2 vient d'une technologie T2). On **ne compte que les machines et équipements** dans la limite de 2 objets par technologie. **Une seule recherche à la fois.** Plaque d'acier ajoutée.
- **Paquets** : `science_pack` (T1 : engrenage + fil), **`science_pack_2` (T2 : 1 plaque d'acier + 1 tuyau de laiton)**, `science_pack_3` (T3 : puce + câble isolé). T4 plus tard (fission). **Plaque d'acier** : estampeuse, 1 lingot d'acier → 1 plaque, moule de plaque (le même que le fer et le cuivre).
- **Coûts** : les technologies T3 (Presse lourde, Silicium, Pétrole, Plastique, Logistique T3, Tri, Extraction T3, Barils) coûtent maintenant des paquets **T2** (mêmes quantités, à rééquilibrer en jouant). Une technologie peut demander **plusieurs types de paquets** (`cost` avec plusieurs `science_pack*`) : le laboratoire ne consomme que les paquets que l'étude réclame, par type ; sinon « Ces paquets ne servent pas à l'étude en cours ». Sauvegarde : `packProgress` par technologie (une ancienne sauvegarde compte ses études comme des paquets T1).
- **Technologies scindées** pour respecter les 2 machines : **Fabrication T2** (constructeur, tuyau de laiton, paquet T2), **Fluides T2** (surpresseur, tour de refroidissement), **Métallurgie : lavage T2** (station de lavage et minerais purifiés).
- **Exceptions de tier 1 : tranchées et codées (Tour 122)** — chaque technologie de tier 1 est découpée pour ne débloquer que **2 machines ou équipements** (les matériaux, comme le tissu, ne comptent pas ; testé pour toutes les technologies). Logistique : séparateur + groupeur, puis **Manutention** (coffre de fer, bras). Électricité : poteau + manivelle, puis **Production d'énergie** (générateur, foreuse électrique) et **Laboratoire** (15 / 10 / 10 lingots de fer, cuivre en coûts réduits : 15+10, 15+10, 10+10). Vapeur : tuyau + pompe, puis **Vapeur : chaudière et turbine**. Textile : tissu, sac à dos, capuche ; puis **Vêtements** (pantalon, bottes), **Gants**, **Couchage** (duvet, lit), 20 fibres chacune. Métallurgie T2 exige maintenant le Laboratoire, Extraction T3 la Production d'énergie. Une ancienne sauvegarde qui avait recherché une technologie découpée garde tout ce qu'elle débloquait (`expandLegacyTechs`). Coûts à rééquilibrer en jouant.

## 9. Point 8 — ennemis : variantes et réparation (Tour 106)

- **Trois variantes** (`kind` de l'ennemi) : **éclaireur** (25 PV, 4,5 m/s, attaque le joueur à vue et les installations polluantes), **gardien** (80 PV, 2 m/s, lent), **cracheur** (40 PV, **statique**, jet d'acide à 20 m toutes les 4 s). Vitesses ×1,2 en mode agressif.
- **Naissances (choix du PO)** : chaque nid proche du joueur garde **3 gardiens fixes** (remplacés en 40 s s'ils sont tués) ; la pollution absorbée fait naître des attaquants : **4 éclaireurs sur 5, 1 cracheur sur 5** (le cracheur reste près du nid).
- **Gardiens** : poursuivent le joueur à moins de 30 m ; sinon **attaquent les machines polluantes dans leur zone de 90 m** autour du nid (10 dégâts/s), puis rentrent.
- **Acide (choix du PO)** : le jet **abîme** un tapis ou un tuyau (rouge sombre, état « Abîmé / Rompu », il ne transporte plus et un tuyau se vide) ; **réparation = poser un élément neuf du même palier (ou supérieur) par-dessus** ; l'ancien est jeté. Un message prévient (au plus un toutes les 8 s). Les anciennes sauvegardes gardent leurs ennemis (gardien s'ils ont un nid, sinon éclaireur).
- Non fait : projectile d'acide visible ; cracheurs qui visent le joueur ; réparation au lingot (remplacée par la pose d'un élément neuf).

## 10. Point 10 — interface et tutoriel

- **Découpage (PO)** : **10a** tutoriel ; **10b** menu « Continuer » (tier technologique et miniature de l'usine) ; **10c** éditeur de partie (ratio de distance des ressources, mode Survie / Créatif). Mode Créatif voulu par le PO : **recherche gratuite, coût des fabrications gratuit, poids et espace du sac illimités, pas de faim, ignoré par les ennemis**.

### 10.1 Point 10a : tutoriel pas à pas (Tour 107)

- Panneau **en haut à droite**, étape par étape (la suivante n'est testée que quand la précédente est validée) : **1 fondations** (se déplacer, sauter, s'accroupir, courir, tourner la caméra, changer de vue, ouvrir la carte) ; **2 récolte** (bois, pierre, première hache en pierre fabriquée à la main) ; **3 premier réseau** (fabriquer et poser un four, y mettre du charbon, obtenir un lingot de fer). Les touches affichées suivent les commandes choisies dans les réglages.
- **Quand** : activé par défaut dans une **nouvelle partie** (case « Tutoriel pas à pas » de l'éditeur), jamais dans une ancienne ; bouton **« Passer le tutoriel »** à tout moment ; la progression est enregistrée avec la partie (`tutorialDone`, `tutorialSkipped`).
- **Un seul outil** (décision du point 1) : l'étape de récolte demande de fabriquer **l'outil en pierre**, pas une hache.
- **Règle du PO pour le multijoueur** : le tutoriel se lance pour **chaque joueur qui entre pour la première fois** dans une partie, que ce soit une partie qu'il crée ou la partie / le serveur d'un autre joueur. Aujourd'hui (un seul joueur) la progression est enregistrée avec la partie ; au multijoueur elle devra suivre **le joueur** dans chaque monde.
- À venir : adaptation tactile / manette (le texte parlera des icônes de boutons au point 12).

### 10.2 Point 10b : menu « Continuer » (Tour 108)

- **Décision du PO** : on n'affiche **pas le tier** mais le **temps de jeu** (heures, minutes, secondes) ; **pas de miniature** pour l'instant.
- Le bouton « Continuer » montre le nom de la partie, la sauvegarde, la date et « 2 h 05 min 09 s de jeu » ; la liste des sauvegardes de « Charger une partie » affiche aussi le temps de jeu de chacune. Le temps de jeu est l'horloge du monde (celle des saisons), qui n'avance pas en pause.

### 10.3 Point 10c : ratio de distance et mode Créatif (Tour 109)

- **Ratio de distance** (curseur ×0,25 à ×3 dans l'éditeur, enregistré avec le monde, `distanceRatio`, ×1 par défaut = comportement d'avant) : multiplie l'effet de l'éloignement du départ sur les gisements — **richesse** `1 + ratio × (D/100)^1,5`, **taille** `1 + ratio × min(1, D/1000)`, **espacement** `1 / (1 + ratio × D/2000)`. Plus il est haut, plus les filons lointains sont massifs mais espacés. L'aperçu de l'éditeur en tient compte.
- **Mode de jeu** (liste « Survie / Créatif » dans l'éditeur, `options.mode`) : en **Créatif**, selon la définition du PO — **recherche gratuite** (toute technologie se débloque d'un clic dès que ses prérequis sont là, sans objets ni paquets), **fabrication gratuite** (aucun ingrédient), **poids et volume du sac sans limite** (affiché « illimité » ; le nombre de cases passe à 120 pour l'affichage), **ignoré par les ennemis** (ni ciblé, ni gardiens réveillés). « Pas de faim » : le jeu n'a pas de faim pour l'instant, rien à désactiver.

## 11. Point 11 — fin de partie

- **Découpage (PO)** : **11a** fission ; **11b** déchets (eau contaminée, tour d'évaporation, vitrification) ; **11c** fusion + balise + séquence finale (avec accumulateurs T3) ; **11d** comptoir spatial. **Zamak, accumulateurs T3, etc. : ajoutés quand on en a besoin.** **Fin (choix du PO)** : la séquence du document (messages système + « Station Orion »), puis la partie **continue sans « Gestion Infinie »** : le relais devient un **comptoir commercial où tous les objets et toutes les ressources se vendent et s'achètent**.

### 11.1 Point 11a : fission (Tour 110)

- **Aluminium et zamak** : lingot d'aluminium (four électrique : 2 bauxite → 1) ; **zamak** (four électrique : 1 zinc + 1 cuivre + 1 aluminium → 2).
- **Centrifugeuse T4** (`centrifuge`, 3×3, 120 kW ; 14 lingots d'acier + 10 engrenages + 14 fils + 4 blocs de béton) : **4 uraninite → 1 uranium enrichi + 3 uranium appauvri** (6 s). L'extraction d'uraninite pollue le sol (radioactivité, 2/s).
- **Barre d'uranium** (assembleur) : 2 uranium enrichi + 2 zamak + 2 plaques d'acier.
- **Réacteur à fission T4** (`fission_reactor`, 4×4, **10 MW**) : une barre dure **2 minutes** (déposée à la main ou par tapis, derrière). Une barre ne s'allume que si le refroidissement est prêt : **eau à 12 bar minimum** (côté gauche, 20 L/s, d'où surpresseurs et tuyaux d'acier) et place pour les rejets. Il rejette de l'**eau contaminée** (nouveau fluide, côté droit) et, à chaque barre usée, **1 déchet nucléaire solide** (sortie devant, évacuée par tapis). **Surchauffe** : si l'eau manque, si la pression tombe, ou si un rejet est plein pendant 5 s, il tombe en panne (« Rompu », plus de courant) ; **réparation** dans sa fenêtre : 30 plaques d'acier + 10 câbles isolés + 5 puces en silicium (composants T3).
- **Paquet T4** : 1 puce + 1 plaque d'acier + 1 uranium appauvri (le déchet de la centrifugation). Technologies **Fission T4** (200 paquets T3 : centrifugeuse, aluminium, zamak, uranium, barre) et **Réacteur T4** (300 paquets T3 : réacteur, paquet T4).
- **En attendant le 11b** : l'eau contaminée n'a pas encore de traitement (il faut la vider, par exemple en baril) ; sans évacuation le réacteur finit par surchauffer.

### 11.2 Point 11b : déchets (Tour 111)

- **Tour d'évaporation T4** (`evaporation_tower`, 3×3, sans énergie ; 12 plaques d'acier + 20 blocs de béton + 6 engrenages) : évapore **20 L/s** d'eau contaminée (entrée derrière) mais rejette une **vapeur violette toxique** : forte pollution de l'air (6/s) et **les nids à moins de 90 m donnent des ennemis mutants** (PV ×2, 1,4 fois plus gros), y compris les gardiens. À poser loin des nids. (Pas encore : les nids qui grossissent par eux-mêmes — l'« expansion des colonies » n'est pas codée.)
- **Station de vitrification T4** (`vitrifier`, 3×3, 100 kW ; 16 plaques d'acier + 20 blocs de béton + 8 câbles isolés + 4 puces) : **100 L d'eau contaminée + 4 pierres + 2 isolants en plastique → 1 cylindre de verre contaminé** (8 s), solide stockable. Eau contaminée par le côté gauche, objets derrière. Technologie **Déchets T4** (250 paquets T3).
- Les déchets nucléaires solides et les cylindres serviront de combustible au réacteur à fusion (11c).

### 11.3 Point 11c : fusion, balise et séquence finale (Tour 112)

- **Accumulateur T3** (`accumulator`, 2×2 ; 8 plaques d'acier + 6 câbles isolés + 4 zamak + 2 puces ; technologie **Stockage T3**, 120 paquets T2) : stocke **1 GJ**, se charge avec le **surplus du réseau** (25 MW max) et le rend quand la demande dépasse la production (50 MW max chacun). L'énergie stockée est enregistrée avec la partie.
- **Réacteur à fusion magnétique** (`fusion_reactor`, **6×6 cases**, 3 m ; 200 plaques d'acier + 200 béton + 100 câbles isolés + 50 puces + 100 zamak ; technologie **Fusion**, 200 paquets T4) : **amorçage 500 MW pendant 10 s d'affilée** (il faut ~10 accumulateurs pleins, sinon l'amorçage recommence) ; une fois le plasma allumé : aimants 50 MW, **production 500 MW (Q = 10)**. Il brûle **1 déchet nucléaire solide + 1 cylindre de verre contaminé toutes les 30 s** (combustible dans ses 2 emplacements, par tapis ou à la main). Sans combustible, ou si le réseau disjoncte : le **plasma s'effondre** (« Rompu ») ; réparation dans sa fenêtre : 100 plaques d'acier + 40 zamak + 40 câbles isolés.
- **Relais émetteur hyperfréquence** (2×2, 1 MW) et **antenne d'alignement quantique** (3×3, 5 MW), technologie **Balise hyperfréquence** (300 paquets T4) : le bouton **« Activer la balise »** du relais lance la séquence finale si le plasma brûle et qu'une antenne est sur le même réseau.
- **Séquence finale (une seule fois)** : messages système, « Ici la Station Orion… Félicitations, Ingénieur. », « Mission principale réussie. », puis **la partie continue** (choix du PO : pas de mode Gestion Infinie). Le relais deviendra un comptoir commercial où tout se vend et s'achète (11d).

### 11.4 Point 11d : comptoir commercial spatial (Tour 113)

- Une fois la **balise activée**, le **relais** devient un **comptoir commercial** (sa fenêtre montre alors les crédits et le commerce). Monnaie : **crédits galactiques** (enregistrés avec la partie).
- **Tout se vend et s'achète** (choix du PO) : tous les objets et toutes les ressources, machines comprises. **Valeur** déduite de la fabrication (ingrédients ÷ quantité produite, avec une marge ; matières brutes à un prix de base, ex. bois 1, charbon 2, minerai 2, bauxite 4, uraninite 25, déchet nucléaire 30). **On vend à la moitié de la valeur et on achète à une fois et demie** : jamais de gain à acheter puis revendre.
- **Vente** : depuis la fenêtre (×1, ×10, tout, pour chaque pile du sac) ou **automatique** — tout tapis ou bras qui arrive au relais vend son contenu (les 4 côtés acceptent). **Achat** : catalogue de tous les objets avec recherche, ×1 / ×10 / ×100, limité par les crédits et la place du sac.
- Prix et marges à rééquilibrer en jouant ; le plafonnement de ce qu'on peut acheter (pour éviter de tout acheter dès le début) n'est pas fait.

## 12. Fabrication à la main et multiplateforme

### 12.1 Temps de fabrication à la main (Tour 114)

- **Durée (choix du PO)** : **0,5 s par ingrédient**, **divisée par la vitesse de l'outil** (outil en pierre ×2…) ; sans outil ×1 ; minimum 0,25 s ; **instantanée en Créatif**. Ex. outil en pierre (6 bois + 4 pierre) = 5 s à mains nues.
- **File d'attente avec barre de progression** (choix du PO) : clic gauche / droit sur un objet = 1 / 5 fabrications mises en file ; elles se font l'une après l'autre **en continuant à jouer** ; les ingrédients sont pris au **démarrage** de chaque fabrication et l'objet arrive à la fin (attend de la place si le sac est plein). Barre dans la fenêtre du sac (avec ✕ pour annuler : la fabrication en cours rend ses ingrédients) et petite barre au-dessus de la barre d'objets. La file n'est pas enregistrée.

### 12.2 Point 12a : commandes tactiles (Tour 115)

- **Choix du PO** : le **tactile d'abord** (joysticks virtuels), la manette ensuite, sans le multijoueur. Steam et consoles : plus tard.
- **Détection** : écran tactile (`pointer: coarse`) ; `?touch=1` / `?touch=0` dans l'adresse force le choix pour tester.
- **Commandes à l'écran** : **joystick** à gauche (marche, 4 directions), **glissement du doigt** sur la moitié droite pour la caméra, **appui bref** sur le monde = clic (poser une machine, viser), boutons **Saut, Agir (maintenir), Utiliser, Accroupi (bascule), Courir (bascule), Vue, Sac, Carte, Tech** et **☰ Menu** (pause). Les boutons passent par des **actions virtuelles** (`Input.setVirtual`) : tout le jeu les lit comme des touches, donc les commandes configurées restent valables.
- **Tutoriel** : en mode tactile il parle du joystick et des boutons au lieu des touches.
- **Pas encore** : réglage dans les paramètres (taille, position, gauchers), appui long = clic droit (démolir), pincement pour le zoom, interface des fenêtres adaptée aux petits écrans, manette (12b).

## 13. Multijoueur (Tour 116)

Voir **`docs/multijoueur.md`** : décisions du PO (hôte = un joueur, 5 joueurs max, code d'invitation, partie privée ou publique avec mot de passe facultatif, partage configurable et tout partagé par défaut) et feuille de route M0 → M3. **M0 codé** : section « Multijoueur » de l'éditeur de partie, réglages enregistrés (`options.multiplayer`), sans effet pour l'instant.

## Point 12b — manette (Tour 121)

- **Module** `src/input/gamepad.ts` (disposition « standard » des navigateurs, branchée dans la vue 3D) : `readPad` traduit l'état d'une manette en actions maintenues, regard et appuis (testé) ; `mountGamepad` lit les manettes à chaque image et agit sur `Input.setVirtual`, comme le tactile.
- **Jeu** : stick gauche = déplacement ; stick droit = caméra (zone morte 20 %, 700 px/s) ; A saut, X utiliser, B s'accroupir, Y changer de vue, gâchette droite = clic (récolter, tirer, poser), gâchette gauche = clic droit (démolir), clic du stick gauche = courir, clic du stick droit = tourner la pièce, Retour = carte, croix haut = technologies, croix bas = sac, croix gauche / droite = étage −/+, épaules = case précédente / suivante de la barre d'objets, Start = pause.
- **Menus** (pause, sac, machines, technologies…) : la croix ou le stick gauche déplace le focus, A valide, B / Start ferment (ils envoient Échap). Le jeu ne bouge pas pendant ce temps.
- **Visée** : sans curseur, la manette vise le centre de l'écran (en vue de dessus et à la 3e personne aussi).
- Vérifié dans un navigateur avec une fausse manette (Start ouvre la pause, la croix déplace le focus) ; 5 tests.
- **Pas encore** : réglages de la manette (sensibilité, zone morte, remappage des boutons), menu principal et écran de création navigables à la manette, icônes de boutons dans les textes, vibrations.

## Paquet T4 dans les coûts multi-paquets (Tour 123)

- Le paquet T4 (`science_pack_4`, débloqué par Réacteur T4) existait déjà ; il sert maintenant à **mélanger les types de paquets** dans les technologies de fin de partie : **Fusion** = 200 paquets T4 + 100 paquets T3 ; **Balise hyperfréquence** = 300 paquets T4 + 150 paquets T3. Les autres technologies gardent le paquet du tier précédent.
- Mécanique déjà en place, testée pour ce cas : le laboratoire (4 emplacements, donc 4 types de paquets à la fois) ne consomme que les types réclamés par l'étude ; un paquet d'un autre type (T2) est refusé ; l'étude n'est finie que quand **tous** les types sont complets, et la progression est enregistrée par type.
- Quantités à rééquilibrer en jouant.

## Point 12 — réglages tactiles / manette, petits écrans (Tour 125)

- **Réglages** (Paramètres → Jeu) : taille des commandes tactiles (70–150 %), commandes pour gaucher (joystick à droite, boutons et caméra à gauche), vitesse du regard à la manette (20–200 %), zone morte des sticks (5–40 %). Appliqués tout de suite (variables CSS / classe `touch-left`, lus à chaque image par la manette).
- **Tactile** : **appui long** (0,5 s sans bouger) sur le monde = démolir ce qui est visé (clic droit maintenu) ; **pincement** à deux doigts = zoom de la caméra. Correction : un appui très bref sur un bouton passait parfois inaperçu (relâché avant l'image suivante) ; il dure maintenant au moins 60 ms.
- **Petits écrans** (largeur ≤ 700 px ou hauteur ≤ 520 px) : sac, machines, carte et technologies occupent tout l'écran, boutons de 40 px minimum, une seule colonne de technologies. Vérifié à 660 × 360 avec un écran tactile simulé.
- **Pas encore** : remappage des boutons de la manette, menu principal navigable à la manette, icônes de boutons dans les textes.

## Expansion des colonies (Tour 127)

- Option de partie `enemies.expand` (activée par défaut, déjà dans l'éditeur) : un nid qui a absorbé **600 points de pollution** fonde un **nouveau nid à 25–45 m** (direction tirée au hasard, générateur déterministe de la menace). Plus la pollution est forte près d'un nid, plus la colonie s'étend.
- Le monde refuse la fondation : à moins de **250 m du départ** (comme les nids d'origine), sur l'eau, à moins de 10 m d'un autre nid, à moins de **15 m d'une machine ou du joueur**, ou au-delà de **60 nids créés**. Après un refus, le nid réessaie plus tôt (70 % du coût).
- Les nids créés sont enregistrés dans la partie (`changes.nests`, ancienne sauvegarde sans le champ = aucun), s'affichent comme les autres nids, se détruisent de la même façon (150 PV) et sont envoyés aux invités avec l'état du monde.
- Équilibrage à affiner en jouant (coût 600, distance, plafond 60).

## Manette : remappage et menus (Tour 128)

- **Remappage** : Paramètres → Jeu → « Manette : … » (13 actions : saut, utiliser, s'accroupir, changer de vue, agir, démolir, courir, tourner, carte, sac, technologies, étage −/+). Chaque action choisit un bouton de la disposition standard (A, B, X, Y, LB, RB, LT, RT, Retour, L3, R3, croix) ou « Aucun » ; Start reste la pause, les épaules servent encore à parcourir la barre d'objets. Par défaut : voir `DEFAULT_PAD`.
- **Menus** : la manette navigue aussi dans les menus avant la partie (principal, création, chargement, paramètres, rejoindre…) : croix ou stick = focus, A = valider, B / Start = retour. Vérifié avec une fausse manette.
- **Pas fait (cosmétique)** : icônes de boutons de manette dans les textes d'aide et le tutoriel (ils parlent encore de touches de clavier ou d'appuis tactiles).

## Icônes de manette dans les textes (Tour 129)

- **Dernier périphérique utilisé** (`src/input/lastDevice.ts`) : clavier / souris ou manette. Une touche ou un clic (événement réel, pas ceux que la manette fabrique) passe en clavier ; un bouton de manette ou un stick poussé passe en manette. Le joueur peut mélanger les deux à volonté.
- **Textes dynamiques** : `{@action}` dans une traduction (par exemple `{@rotate}`, `{@interact}`, `{@techTree}`) est remplacé à l'affichage par la touche du clavier (selon ses réglages) ou par le bouton de la manette (selon son remappage : A, X, RT, L3, ↑…) ; le déplacement donne « le stick gauche », la barre d'objets « LB / RB ». Une action sans bouton de manette garde sa touche. En mode tactile, ce sont les noms des boutons à l'écran.
- **Textes convertis** : tutoriel (en entier), aides de pose (pièces, machines, tuyaux, tapis), « technologie requise », laboratoire, démolition et ouverture des structures et portes, aide de la carte. L'aide du sac (glisser, clic droit, Ctrl / Maj) reste pour la souris : on ne peut pas déplacer les piles à la manette.
- Les textes affichés en continu (tutoriel, aide de pose) se mettent à jour dès qu'on change de périphérique ; les autres, à leur prochaine ouverture.

## Tutoriel : barre de progression (Tour 130)

- Les étapes qui demandent plusieurs gestes affichent une **barre de progression** (« 2 / 4 ») sous le texte ; chaque geste ne compte qu'une fois.
  - **Déplacement** : les 4 directions (avant, gauche, arrière, droite).
  - **Caméra** : à gauche, à droite, vers le haut, vers le bas (souris, doigt ou stick de la manette).
  - **Vues** : les 3 vues (la vue de départ compte d'office).
  - **Récolte** : 3 bois, puis 3 pierres (la barre suit le contenu du sac).
- Les autres étapes (saut, accroupi, course, carte, outil, four…) restent simples : pas de barre.
- Le texte de chaque étape dit ce qu'il faut faire (« dans les 4 directions », « 3 bois »…). Testé : l'avancement par étape, les gestes en double, les signaux en avance.

## Panneau de fabrication : objets cachés et nouveaux onglets (Tour 131)

- **Objets non débloqués cachés** : le panneau de fabrication du sac ne montre que ce qui est déjà débloqué (technologie recherchée ou découverte faite). Un onglet sans objet visible disparaît.
- **10 onglets par usage** (champ `category` de `items.json`, 5 à 12 objets chacun, testé) : Extraction (foreuses, pompes), Fonderie (fours, estampeuse, concasseur, Bessemer, bétonnière, lavage), Usinage (assembleur, constructeur, presse, raffinerie, centrifugeuse), Logistique (tapis, séparateur, bras, trieur, coffres), Fluides (tuyau, surpresseur, tour de refroidissement, barils, évaporation, vitrification), Énergie (manivelle, poteau, générateurs, accumulateur, réacteurs, balise), Science (laboratoire, paquets, puce, câble isolé), Constructions, Équipements (vêtements, sac, boussole, duvet, lit), Outils et défense (outils, pistolet, chargeur, tourelle, buggy).
- Le paquet de science T1 est débloqué avec la technologie **Laboratoire** et le baril vide avec **Barils T3** (ils étaient fabricables dès le départ).
