# Refonte des objets et du contenu — suivi point par point

> Document de travail créé au **Tour 85**. Il suit l'intégration des idées de `gdd_factorisation.md` (fourni par le PO) dans le jeu, **un point à la fois**. Rien n'est codé tant que le point n'est pas validé.
> Autres fichiers fournis : `prompts_assets.md` (prompts d'images pour Scenario.gg : sert de **vocabulaire d'objets** uniquement) et la `passation.md` externe (information).

## 0. Carte des points

| #   | Point                                                                                              | Statut                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Cadre : tiers, technologies par type, paquets de science, noms réels, outil, tier 0 (roue à aubes) | **validé (Tour 85)**                                                                                   |
| 2   | Monde : richesse selon la distance, nouveaux minerais, ponts sur les étangs                        | **en discussion**                                                                                      |
| 3   | Métallurgie : fer + charbon, fonte, moules, estampeuse, Bessemer, béton, lavage                    | à faire                                                                                                |
| 4   | Grille et structure : convoyeurs 1×1, piliers automatiques                                         | **validé et codé (Tour 86)** : on garde le 2×2 ; piliers automatiques à 2,5 m (pièces) ; belts à faire |
| 5   | Logistique : foreuses et convoyeurs T1–T3, bras filtrants, trieur, barils, tunnels « à patron »    | à faire                                                                                                |
| 6   | Réseaux Volts et Bars : blackout, pression, friction, tuyaux T1–T3, réparation, refroidissement    | à faire                                                                                                |
| 7   | Pétrole, plastique, câbles isolés (T3)                                                             | à faire                                                                                                |
| 8   | Ennemis : éclaireurs, gardiens, cracheurs ; réparation                                             | à faire                                                                                                |
| 9   | Survie : duvet, lit fixe, sac laissé sur le cadavre                                                | **validé et codé (Tour 86)**                                                                           |
| 10  | UX : tutoriel progressif, « Continuer » enrichi, ratio de distance, créatif/survie                 | à faire                                                                                                |
| 11  | Fin de partie : fission, fusion, balise, comptoir spatial                                          | à faire (en dernier)                                                                                   |
| 12  | Multiplateforme : tactile, manettes, Steam                                                         | à faire (en dernier)                                                                                   |

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
