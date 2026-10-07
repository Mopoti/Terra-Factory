# Refonte des objets et du contenu — suivi point par point

> Document de travail créé au **Tour 85**. Il suit l'intégration des idées de `gdd_factorisation.md` (fourni par le PO) dans le jeu, **un point à la fois**. Rien n'est codé tant que le point n'est pas validé.
> Autres fichiers fournis : `prompts_assets.md` (prompts d'images pour Scenario.gg : sert de **vocabulaire d'objets** uniquement) et la `passation.md` externe (information).

## 0. Carte des points

| #   | Point                                                                                              | Statut                                           |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Cadre : tiers, technologies par type, paquets de science, noms réels, outil, tier 0 (roue à aubes) | **validé (Tour 85)**                             |
| 2   | Monde : richesse selon la distance, nouveaux minerais, ponts sur les étangs                        | **en discussion**                                |
| 3   | Métallurgie : fer + charbon, fonte, moules, estampeuse, Bessemer, béton, lavage                    | à faire                                          |
| 4   | Grille et structure : convoyeurs 1×1, piliers automatiques                                         | ⚠️ contredit des décisions antérieures           |
| 5   | Logistique : foreuses et convoyeurs T1–T3, bras filtrants, trieur, barils, tunnels « à patron »    | à faire                                          |
| 6   | Réseaux Volts et Bars : blackout, pression, friction, tuyaux T1–T3, réparation, refroidissement    | à faire                                          |
| 7   | Pétrole, plastique, câbles isolés (T3)                                                             | à faire                                          |
| 8   | Ennemis : éclaireurs, gardiens, cracheurs ; réparation                                             | à faire                                          |
| 9   | Survie : duvet, lit fixe, sac laissé sur le cadavre                                                | ⚠️ contredit le Tour 83 (touche H, sac conservé) |
| 10  | UX : tutoriel progressif, « Continuer » enrichi, ratio de distance, créatif/survie                 | à faire                                          |
| 11  | Fin de partie : fission, fusion, balise, comptoir spatial                                          | à faire (en dernier)                             |
| 12  | Multiplateforme : tactile, manettes, Steam                                                         | à faire (en dernier)                             |

Contradictions à trancher avant d'y toucher : **#4** (tapis 2×2 acquis, aucune contrainte de support acquise au Tour 76 ; le document propose l'inverse), **#9** (touche H et sac conservé au Tour 83 ; le document propose lit/duvet et sac laissé sur le corps).

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
