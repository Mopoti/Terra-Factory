# Terra Factory — Game Design Document (GDD)

> **Statut** : document de référence vivant, mis à jour sur l'état réel du jeu (données `content/*.json`, code `src/`, documents `docs/`) au **Tour 287** (30 octobre 2026). Il décrit les **règles du jeu** indépendamment de la technique ; la version navigateur est la version de référence, la version Unreal est un essai (`unreal/`).
> **Langue** : français. **Public** : le Product Owner (PO), les développeurs et les artistes qui rejoindront le projet.
> **Règle d'or** : en cas de contradiction, **les fichiers de données et le code font foi** ; ce GDD est mis à jour à chaque fin de session avec `passation.md`.
> Les tableaux de chiffres (objets, machines, découvertes) sont **générés depuis `content/*.json`**.
> Marqueurs : ✅ implémenté · 🔶 provisoire / à valider · ⏳ prévu, pas encore fait · ❌ hors périmètre pour l'instant.

---

## Sommaire

1. Vision et piliers
2. Boucle de jeu et progression
3. Le monde
4. Le personnage
5. Les objets
6. La construction
7. L'usine : machines, logistique, énergie, fluides
8. Découvertes et recherche
9. Pollution, ennemis et défense
10. Jour, nuit et saisons
11. Interface, commandes et paramètres
12. Parties, options et sauvegarde
13. Architecture technique (résumé)
14. Tableaux d'équilibrage
15. État d'avancement, feuille de route et questions ouvertes
16. Glossaire et sources

---

## 1. Vision et piliers

### 1.1 Pitch

**Terra Factory** est un jeu 3D d'**automatisation d'usinage** (dans l'esprit de _Factorio_ et _Satisfactory_) **jouable dans le navigateur**, à la première personne, à la troisième personne ou en vue du dessus. Le joueur démarre à mains nues dans un monde infini généré par une _seed_ : il récolte, fabrique, construit des machines et des tapis, produit de l'électricité (combustion, puis vapeur), mène des recherches, s'abrite et se défend contre des colonies d'ennemis que sa propre **pollution** attire et fait grossir.

### 1.2 Piliers de conception

1. **Automatiser** : tout geste répété à la main doit pouvoir être confié à une machine (extraction, fonte, transport, assemblage, recherche).
2. **Liberté de vue et de construction** : trois vues changeables en jeu ; construction libre, sans contrainte de support, étage par étage ; machines posées au sol ou à l'étage.
3. **Un monde déterministe et partageable** : même seed = même monde, pour tout le monde, sans rien stocker d'autre que les changements du joueur.
4. **Une simulation lisible, pas punitive** : physique « réaliste mais jouable » (énergie, pression, pollution) avec des réglages de partie ; ennemis non agressifs par défaut.
5. **Tout est donnée** : objets, machines, ressources, découvertes, pièces de construction dans des fichiers JSON ; textes en fichiers de traduction (fr/en) ; aucune valeur d'équilibrage en dur dans le code quand c'est évitable.
6. **Tout est remappable et configurable** : touches, vues, image, sons, unités.

### 1.3 Plateforme et technologie

- Navigateur (Chrome/Edge/Firefox récents), WebGL ; **TypeScript + Vite + Three.js + Vitest**. Aperçu en ligne déployé automatiquement (Vercel, branche de travail).
- Évolutions envisagées (non engagées) : application de bureau, port Unity (la séparation `core` / `render` / `ui` le permet).

### 1.4 Ce que le jeu n'est pas (pour l'instant)

- Pas de terrain creusable (sol plat, une seule couche utile) ❌.
- Pas de multijoueur ⏳ (**explicitement reporté par le PO : « il faut qu'on en parle avant »**).
- Pas de vrais modèles 3D ni de vrais sons : formes simples provisoires 🔶.

---

## 2. Boucle de jeu et progression

### 2.1 Boucle principale

```
Récolter à la main ──► Fabriquer outils / premières machines ──► Extraire (foreuses) ──► Fondre (fourneaux)
        ▲                                                                                      │
        │                                                                                      ▼
 Se défendre ◄── Pollution attire les ennemis ◄── Produire de l'énergie ◄── Transporter (tapis, bras, tunnels)
        │                                                                                      │
        └──────────────► Découvrir (recettes) ◄── Paquets de science ◄── Assembler ◄──────┘
```

### 2.2 Phases de progression (parcours type)

Le jeu est organisé en **six paliers (T0 à T5)**. Un palier se franchit en **découvrant** des recettes (§8), payées en **paquets de science** du palier et du palier précédent. Chaque palier a son propre paquet (T1 : 2 pierres + 1 minerai de fer ; T2 : engrenage + fil de cuivre ; T3 : plaque d'acier + tuyau de laiton ; T4 : puce de silicium + câble isolé ; T5 : puce + plaque d'acier + uranium appauvri), fabriqué avec des éléments du palier précédent.

| Palier | Thème                         | Ce que le joueur débloque / fait                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **T0** | Survie à mains nues           | Récolte du bois, de la pierre, des fibres (mains nues ×3 plus lentes), sac, fabrication à la main, outils de pierre puis de fer, foreuse et fourneau à combustible, coffres, **poteau électrique en bois et laboratoire**. Les 22 découvertes de ce palier se paient en objets du sac.                 |
| **T1** | Logistique, vapeur et défense | Tapis, bras, séparateurs, groupeurs, tunnels ; **vapeur** (pompe, chaudière, turbine) ; tourelle ; clôtures et portails en bois ; lampadaire ; kit de réparation.                                                                                                                                      |
| **T2** | Métallurgie et électricité    | Générateur, foreuse et bras électriques, assembleur, acier (Bessemer), béton, lavage des minerais, constructeur ; **poteau haute tension, transformateur, disjoncteur** ; éolienne ; barrières et portails en béton.                                                                                   |
| **T3** | Industrie                     | Foreuse économe, four électrique, presse lourde, plastique et silicium, pétrole et raffinerie, **locomotive à vapeur et rails**, assembleur avancé, poteau très haute tension, panneau solaire, accumulateur de base, barrières en béton armé et portail motorisé.                                     |
| **T4** | Énergie lourde et nucléaire   | Centrifugeuse, uranium, réacteur à fission, vitrification, batteries au lithium et accumulateur, borne de recharge, quad et locomotive électriques, batterie portable, propulseur dorsal, pile à combustible, foreuse à plasma, bras industriel, purificateur d'air, électrolyseur, mur holographique. |
| **T5** | Fin de partie                 | Fusion, compresseur d'air et azote liquide, coffre quantique, fabricateur universel, tourelle à rail, **balise quantique** (relais et antenne).                                                                                                                                                        |

La pollution, les ennemis et la défense (§9) accompagnent toute la partie : plus l'usine grossit, plus elle attire d'ennemis.

### 2.3 Conditions de fin

**Bac à sable** avec une fin de partie optionnelle : la découverte **Balise quantique** (T5, après la fusion) permet de monter un **relais émetteur** et une **antenne** ; une fois la balise activée (séquence finale), le **comptoir spatial** s'ouvre : le relais **achète et vend** des objets contre des **crédits galactiques** (vente à 50 % et achat à 150 % de la valeur d'un objet, déduite de ses recettes). ⏳ Objectifs et succès à définir (voir §15) ; le drapeau « admin » (mode débogage utilisé) est déjà enregistré pour désactiver les futurs succès.

---

## 3. Le monde

### 3.1 Principes ✅

- **Infini, déterministe, par seed** : la seed est n'importe quel texte ; même texte exact = même monde. Générateur pseudo-aléatoire maison, **jamais de `Math.random()`** dans le cœur du jeu.
- **Chunks** de 16 × 16 cases (**8 m × 8 m**), générés à partir de (seed, position) **indépendamment de l'ordre de découverte**.
- **Sol plat**, non creusable (une seule couche utile ; la structure garde la hauteur pour un futur terrain creusable).
- **On ne stocke que les changements** du joueur (arbre coupé, minerai épuisé, pièces posées, machines…) : sauvegardes minuscules.
- Échelle : **1 case = 50 cm** ; tuile de tapis/tuyau = 2 × 2 cases (1 m) ; **étage = 2,5 m**.

### 3.2 Biomes ✅

Deux bruits très étalés (température, humidité) donnent le biome ; transitions progressives sur plusieurs centaines de mètres.

| Biome   | Sol          | Végétation                                        |
| ------- | ------------ | ------------------------------------------------- |
| Prairie | vert clair   | arbres épars, rochers                             |
| Forêt   | vert foncé   | arbres très denses                                |
| Désert  | sable        | quasi aucun arbre, beaucoup de rochers, peu d'eau |
| Toundra | blanc / gris | arbres rares, rochers                             |

### 3.3 Ressources ✅

| Ressource                                         | Forme                                             | Quantité                                                                                                                          | Récolte              | Densité / répartition                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Arbre**                                         | objet isolé (≈ 1 m)                               | 4 bois                                                                                                                            | 0,8 s / unité        | forêt 0,32 · prairie 0,16 · toundra 0,12 · désert 0,06 ; en bosquets (≈ 40 m)                                                      |
| **Rocher**                                        | objet isolé                                       | 20 pierre                                                                                                                         | 0,5 s / unité        | désert 0,2 · toundra 0,18 · prairie 0,14 · forêt 0,12                                                                              |
| **Buisson de fibres**                             | objet isolé                                       | 3 fibres                                                                                                                          | 0,4 s / unité        | prairie 0,12 · forêt 0,10                                                                                                          |
| **Hématite (fer) / Malachite (cuivre) / Charbon** | **gisement** (tas de cases de minerai)            | **1 000 au centre à D = 0**, multiplié par **1 + (D/100)^1,5** selon la distance D au départ ; 9 % au bord ; richesse ×0,8 à ×1,2 | 0,4 s / unité        | candidat tous les ≈ 96 m, présence 40–45 %, rayon 6–16 m (**×1 à ×2 selon la distance**, un peu plus espacés au loin), tous biomes |
| **Sphalérite (zinc) / Bauxite (aluminium)**       | gisement                                          | idem                                                                                                                              | 0,4 s / unité        | **à partir de 300 m** du départ                                                                                                    |
| **Quartz (silicium)**                             | gisement                                          | idem                                                                                                                              | 0,4 s / unité        | **à partir de 600 m**                                                                                                              |
| **Uraninite (uranium)**                           | gisement                                          | idem                                                                                                                              | 0,4 s / unité        | **à partir de 1 200 m** (T4)                                                                                                       |
| **Étang**                                         | plan d'eau plat, **infranchissable**, inépuisable | —                                                                                                                                 | pompable             | candidat ≈ 80 m, présence 40 %, rayon 4–10 m ; rare en désert                                                                      |
| **Nid d'ennemis**                                 | structure (4 cases de base)                       | 150 PV (détruisable)                                                                                                              | tirs / corps à corps | candidat ≈ 160 m, présence 35 %, **jamais à moins de 250 m** du départ                                                             |

- Les gisements sont des **cases de minerai de 50 × 50 cm** (10 cm de haut max) ; chaque case a sa quantité, **plus riche au centre**, contour irrégulier par bruit.
- Un nid ou un étang n'est jamais posé sur un gisement.

> Sable, pierre de carrière (gisement de pierre) et pétrole sont aussi des gisements ; zinc, bauxite, quartz et uraninite servent aux paliers 2 à 4. Tour 85 : les ressources suivent désormais la refonte (voir `docs/refonte-objets.md`). Zinc, bauxite, quartz et uraninite se récoltent mais n'ont pas encore d'usage (fonderie : point 3). **Ponts** : une dalle de sol posée sur l'eau la rend praticable (marche, tapis, tuyaux, poteaux).

### 3.4 Zone de départ garantie ✅

Dans ≈ 150 m autour de l'apparition : au moins bois, pierre, fer, cuivre, charbon et eau **à portée de marche** ; aucun nid à moins de 250 m. Le monde varie selon la seed, mais on ne commence jamais coincé.

### 3.5 Réglages de génération (par partie) ✅

Pour chaque **famille** — arbres/végétation (_forests_), rochers, minerais, étangs, nids (_enemies_) — trois curseurs : **fréquence**, **taille**, **densité**, de ×0,25 (très peu) à ×3 (très abondant), ×1 par défaut. La seed et ces réglages sont enregistrés avec la partie (même seed, autres réglages = monde différent). Bouton de seed aléatoire dans l'éditeur.

### 3.6 La carte (touche M) ✅

- Dessinée par chunk (un pixel par case), fond coloré par biome, eau, arbres, rochers, gisements, **nids**, ennemis (points rouges), constructions, tapis.
- **Zones explorées** limitées à 28 chunks autour du joueur (le reste est « inexploré »), zoom ×1 à ×16, déplacement au glisser.
- **Voile de pollution** (air en rouge, sol en brun), **translucide et masquable** par case à cocher.
- **Repères** : flèche du joueur, **✝ corps du joueur tombé**, **⚑ point de réapparition**.
- **Redessinée à chaque ouverture** : un nid détruit, un arbre coupé ou un minerai épuisé disparaissent.

### 3.7 Zones éloignées

Décision de cadrage : l'usine continue de tourner ; dans le navigateur, un futur objet « chargeur de chunk » gardera une zone active ⏳. Aujourd'hui toute la simulation tourne tant que la partie est ouverte.

---

## 4. Le personnage

> **Apparence et personnalisation à venir** (modèle low poly homme / femme, combinaison, réglages du corps et du visage, écran de personnalisation à l'accueil) : voir [`personnage.md`](personnage.md).

### 4.1 Caractéristiques de base ✅

| Caractéristique      | Valeur                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Taille / rayon       | 1,70 m / 25 cm                                                                                                    |
| Marche               | 4,5 m/s                                                                                                           |
| Sprint (Maj)         | ×1,7                                                                                                              |
| Accroupi (C)         | oui                                                                                                               |
| Saut                 | 7 m/s, gravité 22 m/s² → **≈ 1,1 m** : **2 blocs de mur empilés (1 m) se montent d'un saut**, 3 blocs (1,5 m) non |
| Marche (sans sauter) | jusqu'à 35 cm (dalle de sol, marche d'escalier de 50 cm sur sa longueur)                                          |
| Santé                | 100 PV ; récupération de 4 PV/s après 5 s sans dégât                                                              |
| Portée d'action      | 3 m (récolte, ramassage) ; 6 m (construction)                                                                     |
| Buggy                | ×2,6 la marche, voir §4.8                                                                                         |

Il n'y a **ni niveaux ni points d'expérience** : le personnage progresse par ses **outils, son équipement et les découvertes** faites.

### 4.2 Vues ✅

- **1ʳᵉ personne**, **3ᵉ personne** (caméra à distance réglable, collision caméra), **vue du dessus** (inclinaison, zoom, rotation libre / par pas de 90° / bloquée, défilement par les bords). Touche **V** pour alterner, ou touches dédiées.
- Chaque vue a ses réglages (FOV, sensibilité, mouvement de tête, réticule, épaule…).
- **Aura de transparence** : le personnage devient visible à travers un obstacle **uniquement s'il y a quelque chose entre lui et la caméra** (pièce de construction, machine, tronc).
- **Masquage des étages** au-dessus du joueur quand il est dans une pièce fermée.

### 4.3 Santé, mort et réapparition ✅

- La barre de santé est **masquée par défaut** (réglage « Afficher la barre de santé ») ; la **rougeur des bords de l'écran** indique la gravité des dégâts.
- À **0 PV** : le joueur est assommé ; **son corps reste sur place** (capsule grise couchée) **avec tout ce qu'il portait** (sac, équipement) ; il réapparaît au **dernier duvet ou lit posé**, sinon au **premier point** (départ de la partie), **les mains vides**.
- Le corps est visible **sur la carte (✝, ainsi que ⚑ lit et ⚐ duvet)** et, si la découverte **Navigation** est faite, **repéré sur la boussole** (✝ ; flèche ◄✝ / ✝► s'il est hors du champ). Un nouveau corps remplace l'ancien.
- **Récupération** : près du corps (2,5 m), **F** reprend l'équipement et le contenu d'un coup (dans la limite de la place du sac ; le reste attend sur le corps).
- **Réapparition** : **duvet d'exploration** (usage unique, détruit après la réapparition) ou **lit** (permanent), posés au clic ; le dernier posé compte. Maj + F les range.

### 4.4 Sac à dos et inventaire ✅

- Base : **30 cases**, piles de **100** maximum (les objets à état : 1), limite de **50 kg et 60 L** (poids ET volume).
- Les **objets équipés quittent le sac**. Un sac à dos équipé ajoute +10 cases, +20 kg, +30 L.
- Gestes de souris unifiés (sac, coffres, machines, buggy) : clic = pile au curseur ; clic droit = la moitié ; **Ctrl** = quantité choisie ; **Maj** = transfert direct vers/depuis le sac ; glisser hors de la fenêtre = jeter ; glisser sur la barre = raccourci.
- Un objet **posable** peut rester « en main » à la fermeture du sac ; clic droit mains vides = vider les mains.
- **Fabrication à la main** (dans le sac) par les onglets du §5.1. Seuls les objets **découverts** (§8) sont fabricables ; les matières premières ne figurent pas dans le panneau. Les objets à état (§5.3) ne s'empilent qu'à égal niveau.
- **Barre de raccourcis** de 10 cases (touches 1 à 9 puis 0). Il n'y a plus de case d'outils dédiée : l'outil se range dans une case ordinaire.

### 4.5 Outils et récolte ✅

- **À mains nues**, la récolte est **×3 plus lente**.
- L'outil se place dans une **case de la barre** (il n'est en main, et ne récolte, que lorsqu'on appuie sur la touche de sa case ; sinon mains nues) (il n'apparaît dans les mains que pendant l'action) :

| Outil           | Vitesse de récolte | Unités par coup | Recette                      |
| --------------- | ------------------ | --------------- | ---------------------------- |
| Outil en pierre | ×2                 | 1               | 6 × bois + 4 × pierre        |
| Outil en fer    | ×3,5               | 2               | 6 × lingot de fer + 4 × bois |

- **Récolte** : maintenir le clic sur un arbre, un rocher, un buisson, une case de minerai, ou ramasser un objet au sol ; la vitesse dépend de la ressource (§3.3) et de l'outil.
- **Démolition** : clic droit maintenu (en chaîne).

### 4.6 Équipement ✅

Six emplacements : **Tête, Tronc, Dos, Mains, Jambes, Pieds** ; s'équipe par glisser-déposer ou sélection puis clic ; l'équipement porté est dessiné sur le personnage (modèles portés encore provisoires pour la plupart).

- **Vêtements** (tissu) : sac à dos (+10 cases, +20 kg, +30 L), capuche, pantalon, bottes, gants (cosmétiques pour l'instant ⏳).
- **Armures de 1 à 5** : casque, plastron, jambières et bottes de chaque palier ; chaque pièce réduit les dégâts reçus (somme des pièces, plafonnée). **Usure** : chaque coup reçu use les pièces portées (un niveau sur dix tous les 60 dégâts par pièce) ; une pièce usée protège moins ; à zéro elle **se brise**. Une armure neuve est pleine ; les pièces usées sont des objets à part (voir §5.3).
- **Exosquelette** (palier 4) et **propulseur dorsal** (palier 4, emplacement Dos) : le propulseur donne de brèves poussées verticales et brûle d'abord les **batteries portables** (rechargées à une borne), puis les batteries au lithium du sac (20 s chacune).

**Pièces d'armure et bonus** (protection en % / chaleur en points ; les armures remplacent le vêtement du même emplacement) :

| Emplacement | Vêtement             | T1        | T2        | T3         | T4                                                       | T5                                                                        |
| ----------- | -------------------- | --------- | --------- | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| Tête        | Capuche : chaleur 1  | 4 % / 1   | 8 % / 2   | 10 % / 2,5 | 13 % / 3,2 + batterie + **réalité augmentée**            | 16 % / 4 + batterie + **réalité augmentée** (−20 % d'énergie)             |
| Tronc       | Veste : chaleur 3    | 8 % / 2   | 16 % / 4  | 20 % / 5   | 26 % / 6,5 + batterie + barre de raccourcis ⏳           | 32 % / 8 + batterie + barre de raccourcis ⏳                              |
| Jambes      | Pantalon : chaleur 2 | 6 % / 1,5 | 12 % / 3  | 15 % / 3,8 | 19 % / 4,8 + batterie + **exosquelette** (+40 kg, +10 %) | 23 % / 5,8 + batterie + **exosquelette** (+80 kg, +20 %, −20 % d'énergie) |
| Pieds       | Bottes : chaleur 1   | 4 % / 1   | 9 % / 2,2 | 11 % / 2,8 | 14 % / 3,5 + batterie                                    | 17 % / 4,2 + batterie                                                     |
| Mains       | Gants : chaleur 1    | —         | —         | —          | outil intégré ⏳ (pièce à créer)                         | outil intégré ⏳ (pièce à créer)                                          |

La protection totale est plafonnée à 80 %. Le T3 « Exosquelette » (jambes, sans énergie) donne +40 kg et +10 % de vitesse. Les pièces T4 et T5 ont une **case de batterie portable** ; la réalité augmentée, l'exosquelette et (plus tard) l'outil des mains puisent dans la somme des batteries portées.

### 4.7 Armes et outils ✅

- **Armes à feu** : pistolet, fusil, sniper, chacun avec son **chargeur** (munitions fabriquées) ; recharge avec **R** ; le rayon de tir est visible. Le **corps à corps** (sans arme) fait 12 dégâts à 2,6 m.
- **Outils** (pierre, fer) : vitesse de récolte ×2 et ×3,5 (§4.5). Le **kit de réparation** est un outil de maintenance (§7.11).
- Les **nids** encaissent aussi les tirs (§9).

### 4.8 Véhicules ✅

Posés dans le monde, montés avec **F**, rangés avec **Maj + F**. Chacun a un coffre ou une case de carburant selon son type ; la position, l'orientation, la réserve d'énergie et le contenu sont sauvegardés. Ils **écrasent** les ennemis (cooldown).

| Véhicule            | Vitesse (× la marche) | Énergie                                                                       | Particularité                |
| ------------------- | --------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| Charrette           | ×0,8                  | aucune (poussée à pied)                                                       | sans moteur, grand coffre    |
| Buggy               | ×2,6                  | 180 kW de combustible                                                         | case de carburant et coffre  |
| Quad                | ×3,1                  | 110 kW de combustible                                                         | léger et sobre               |
| **Quad électrique** | ×3,3                  | batterie : 15 minutes de route, rechargée à une **borne de recharge** (§7.10) | pas de carburant, silencieux |
| Camionnette         | ×2,2                  | 300 kW                                                                        | coffre de 32 cases           |
| Char                | ×1,8                  | 450 kW                                                                        | lent, écrase tout            |

Les **trains** sont décrits au §7.8.

---

## 5. Les objets

Le jeu compte **253 objets**. Tout objet a un **identifiant texte stable** (ex. `iron_ingot`), un **poids**, un **volume**, éventuellement une **recette**, une **énergie de combustion**, un **emplacement d'équipement**, un **effet d'outil** et un **palier** (T0 à T5). Sources : `content/items.json` (données) et `docs/fiches-objets.html` (fiches générées, avec les paquets demandés).

### 5.1 Familles et onglets de fabrication ✅

Les objets fabricables sont classés en **15 onglets** (le sac, la fenêtre de fabrication à la main et l'assembleur partagent ce classement) : _Ressources, Extraction, Fonderie, Usinage, Logistique, Fluides, Énergie, Science, Construction lourde, Outils et défense, Équipements, Armures, Constructions, Rail, Véhicules_. Les **matières brutes** (récoltées) ne se fabriquent pas.

### 5.2 Règles de recette ✅

- **Trois types d'ingrédients au plus** par recette ; **quatre à partir du palier 3** (l'assembleur avancé et le fabricateur universel acceptent quatre types).
- Les objets avancés passent par des **intermédiaires** : châssis (simple, renforcé, léger, composite), kit circuit, circuit avancé, microcontrôleur, vitre, graphite, fibre de carbone, cellule photovoltaïque, batterie au lithium, etc. Un objet de palier n s'obtient avec des éléments des paliers inférieurs.
- Les **paquets de science** se fabriquent à la main (**5 s × le palier**) ou à l'assembleur.
- Les outils, le kit de réparation et les armures se fabriquent à la main ; les machines à l'assembleur ou à la main selon leur taille (§7.1).

### 5.3 Données par objet : charge et usure ✅

Certains objets ont un **état propre** à chaque exemplaire. Il est représenté par des **niveaux** : un même objet existe en plusieurs exemplaires de niveaux différents, qui **ne se mélangent pas** dans une pile (une pile = un seul exemplaire).

| Objet                            | Niveaux                                        | Neuf / fabriqué | Ce qui le fait changer                                                                      |
| -------------------------------- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| **Kit de réparation**            | 5 charges                                      | plein           | une charge par réparation (§7.11) ; ne se recharge pas, ne se répare pas ; disparaît à zéro |
| **Batterie portable**            | 10 niveaux (10 × 6 s de poussée du propulseur) | **vide**        | se recharge à une borne de recharge ; le propulseur la consomme                             |
| **Armures 1 à 5** (chaque pièce) | 10 niveaux d'usure                             | pleine          | usée par les coups reçus ; brisée à zéro                                                    |

L'état se lit sur l'**icône** : une jauge fine sous l'objet (verte, orange, rouge) et le nom indique le pourcentage (« Batterie portable (60 %) »). Les piles, coffres, objets au sol, échanges et sauvegardes les gardent. Une ancienne sauvegarde convertit son kit entamé en objet.

### 5.4 Combustibles et énergie ✅

L'énergie des combustibles est en **mégajoules par unité** ; les machines à combustible ont une consommation en **kilowatts** (1 kW = 1 kJ/s). Charbon 9 MJ, bois 1,8 MJ, fibre 0,54 MJ ; le **deutérium et le tritium** (500 MJ) ne servent qu'à la pile à combustible.

### 5.5 Mode Créatif ✅

En Créatif, **un seul exemplaire** d'un objet suffit pour le poser **autant de fois qu'on veut** ; casser un objet le rend. La fabrication est **gratuite** et le sac sans limite de poids ni de volume ; les ressources du monde (arbre, rocher, gisements) se posent depuis un onglet dédié.

En Créatif, l'onglet **Ennemis** de la fabrication permet de **poser un nid** (pas dans l'eau, pas contre un autre nid) et **chaque type d'ennemi** (éclaireur, gardien, cracheur) d'un clic, à portée. En Créatif, **les ennemis ignorent le joueur** (ils attaquent encore les machines). La commande **`/survie`** fait passer la partie en **survie** : les ennemis attaquent le joueur, la fabrication coûte, le sac a ses limites, mais les **avantages du Créatif restent** (les commandes du chat, le F9 complet) ; **`/creatif`** revient. Le mode choisi par commande est enregistré avec la partie. Les commandes sont **réservées au Créatif** (une partie lancée en Survie n'y a pas accès, sauf si elle en a déjà utilisé).

En Créatif, le bouton **« Rechercher »** reste actif même quand des prérequis manquent : le clic recherche **rapidement** (une découverte toutes les 0,11 s) tous les prérequis manquants, dans l'ordre de l'arbre, jusqu'à la découverte choisie, sans coût. L'arbre reste centré sur la découverte choisie ; les prérequis passent du **rouge** (en attente) au **vert** (recherché). ✅

L'arbre des découvertes a une **barre de recherche** (par nom de découverte ou d'objet débloqué) : choisir un résultat centre l'arbre dessus et la **fait clignoter**. ✅

---

## 6. La construction

### 6.1 Grille et dimensions ✅

| Élément               | Dimension                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Case                  | 50 × 50 cm                                                                                     |
| Bloc de mur           | 50 cm de haut, 10 cm d'épaisseur                                                               |
| Étage                 | **5 blocs = 2,5 m** (jusqu'à 10 étages / 25 m de colonne)                                      |
| Dalle (sol/plafond)   | 10 cm d'épaisseur ; **une seule dalle** entre deux étages (sol du dessus = plafond du dessous) |
| Chunk                 | 16 × 16 cases (8 m)                                                                            |
| Pièce fermée maximale | 400 cases                                                                                      |

### 6.2 Pièces ✅

**Murs**, **portes** (occupent tout l'étage ; laissent passer), **dalles**, **escaliers** (chaque marche monte de 50 cm), en **bois** ou en **pierre**, **mélangeables librement**. Chaque pièce posée consomme 1 objet `piece_*`. Les murs se posent sur les **bords de cases**, bloc par bloc (hauteur réglable : tout l'étage, ou un bloc à la fois pour fenêtres et trous).

### 6.3 Règles de pose ✅ (refonte du Tour 76)

- **Pose libre, mais piliers automatiques** : on peut poser en l'air, mais une pièce en hauteur à plus de **2,5 m** d'un support (mur ou pilier qui descend au sol) reçoit **automatiquement un pilier de soutènement** (gratuit, solide, démolissable) ; les piliers comptent comme supports. Détail : `docs/refonte-objets.md` §4.
- La visée choisit **la face libre la plus proche** de la première surface touchée par le rayon (pièce, sol ou plan de niveau).
- Pose en **traçant** (clic maintenu), **rotation** (R), **niveau d'étage** (PageUp/PageDown), **hauteur de mur** (Début/Fin).
- **Copier / coller** (Ctrl+C/V), **annuler / rétablir** (Ctrl+Z/Y), **démolition en chaîne** (clic droit maintenu, ou X / Suppr).
- Tous les étages sont affichés (hors étages masqués par la pièce où l'on se trouve).

### 6.4 Pièces fermées ✅

Les volumes clos sont détectés (pièces de ≤ 400 cases) ; ils servent au masquage des étages et serviront au chauffage / température d'abri ⏳.

### 6.5 Physique de la construction ✅

- Marche sur les dalles (< 35 cm), montée d'escaliers, appui sur la tranche d'un mur ; **saut sur un mur de 2 blocs** possible, pas de 3.
- Collision des pièces avec le joueur, la caméra (3ᵉ personne) et les tirs.

---

## 7. L'usine : machines, logistique, énergie, fluides

### 7.1 Catalogue des machines ✅

Le jeu compte **79 machines**. Les emprises sont en cases de 50 cm (largeur × profondeur, orientation 0) ; la rotation par pas de 90° les échange. Les machines **non linéaires** peuvent se poser **à l'étage** sur une dalle (PageUp). Le coût est celui de la fabrication (`content/items.json`, tableau généré). Les chiffres d'énergie sont des **valeurs de départ** à équilibrer (§14).

**Extraction et fonderie**

| Machine                               | Emprise (cases) | Hauteur | Coût                                                                                | Énergie / vie    |
| ------------------------------------- | --------------- | ------- | ----------------------------------------------------------------------------------- | ---------------- |
| Foreuse                               | 4×5             | 2 m     | 6 × Lingot de fer + 6 × Pierre                                                      | brûle 90 kW      |
| Foreuse électrique                    | 4×5             | 2 m     | 2 × Châssis simple + 1 × Moteur + 2 × Kit circuit                                   | consomme 90 kW   |
| Foreuse économe (T3)                  | 4×5             | 2 m     | 6 × Plaque d'acier + 12 × Tige en acier + 8 × Engrenage en fer + 12 × Fil de cuivre | consomme 67,5 kW |
| Foreuse à plasma                      | 6×6             | 2,5 m   | 2 × Moteur renforcé + 1 × Châssis composite + 1 × Microcontrôleur                   | consomme 1500 kW |
| Fourneau                              | 3×4             | 1 m     | 10 × Pierre                                                                         | brûle 90 kW      |
| Four électrique (T3)                  | 4×4             | 1 m     | 4 × Plaque d'acier + 8 × Tige en acier + 6 × Engrenage en fer + 12 × Fil de cuivre  | consomme 200 kW  |
| Estampeuse                            | 4×4             | 1,5 m   | 12 × Lingot de fer + 10 × Pierre                                                    | brûle 60 kW      |
| Concasseur                            | 4×4             | 1 m     | 8 × Lingot de fer + 12 × Pierre                                                     | brûle 60 kW      |
| Convertisseur Bessemer                | 4×4             | 1,5 m   | 10 × Plaque de fer + 6 × Engrenage en fer + 8 × Fil de cuivre                       | consomme 90 kW   |
| Bétonnière                            | 4×4             | 1 m     | 8 × Plaque de fer + 4 × Engrenage en fer + 10 × Pierre                              | consomme 30 kW   |
| Constructeur (T2)                     | 4×4             | 1 m     | 10 × Plaque de fer + 6 × Engrenage en fer + 10 × Fil de cuivre                      | consomme 40 kW   |
| Station de lavage (T2)                | 4×4             | 1 m     | 8 × Plaque de fer + 4 × Engrenage en fer + 10 × Pierre                              | consomme 25 kW   |
| Presse hydraulique lourde (T3)        | 4×4             | 1,5 m   | 6 × Plaque d'acier + 12 × Tige en acier + 8 × Engrenage en fer + 12 × Fil de cuivre | consomme 150 kW  |
| Centrifugeuse (T4)                    | 4×4             | 1,5 m   | 6 × Châssis renforcé + 1 × Moteur renforcé + 4 × Kit circuit + 4 × Bloc de béton    | consomme 120 kW  |
| Station de vitrification (T4)         | 3×3             | 1,2 m   | 16 × Plaque d'acier + 20 × Bloc de béton + 8 × Câble isolé + 4 × Puce en silicium   | consomme 100 kW  |
| Presse à plastique (T3)               | 3×3             | 1 m     | 4 × Châssis renforcé + 1 × Moteur + 3 × Kit circuit                                 | consomme 80 kW   |
| Remplisseuse / videuse de barils (T3) | 2×2             | 1 m     | 4 × Lingot d'acier + 4 × Engrenage en fer + 8 × Fil de cuivre                       | consomme 20 kW   |
| Compresseur d’air                     | 3×3             | 1,5 m   | 2 × Châssis renforcé + 1 × Moteur renforcé + 1 × Microcontrôleur                    | consomme 300 kW  |
| Électrolyseur                         | 3×3             | 1,5 m   | 2 × Châssis renforcé + 1 × Microcontrôleur + 4 × Graphite                           | consomme 200 kW  |

**Logistique**

| Machine                   | Emprise (cases) | Hauteur | Coût                                                                | Énergie / vie  |
| ------------------------- | --------------- | ------- | ------------------------------------------------------------------- | -------------- |
| Tapis roulant             | 2×2             | 0,15 m  | 2 × Lingot de fer                                                   | —              |
| Séparateur                | 2×2             | 0,5 m   | 3 × Plaque de fer + 8 × Tige en fer                                 | —              |
| Groupeur                  | 2×2             | 0,5 m   | 3 × Plaque de fer + 8 × Tige en fer                                 | —              |
| Trieur (T3)               | 2×2             | 0,5 m   | 3 × Lingot d'acier + 2 × Engrenage en fer + 6 × Fil de cuivre       | consomme 15 kW |
| Bras robotique            | 2×3             | 1 m     | 2 × Engrenage en fer + 2 × Plaque de fer + 8 × Tige en fer          | brûle 20 kW    |
| Bras robotique électrique | 2×3             | 1 m     | 2 × Châssis simple + 2 × Engrenage en fer + 3 × Kit circuit         | consomme 20 kW |
| Bras filtrant (T3)        | 2×3             | 1 m     | 4 × Lingot d'acier + 4 × Engrenage en fer + 8 × Fil de cuivre       | consomme 30 kW |
| Bras industriel           | 2×3             | 1,2 m   | 1 × Châssis composite + 1 × Moteur renforcé + 1 × Circuit avancé    | consomme 60 kW |
| Coffre en bois            | 2×2             | 0,5 m   | 16 × Bois                                                           | —              |
| Coffre en fer             | 2×2             | 0,5 m   | 7 × Plaque de fer + 4 × Tige en fer                                 | —              |
| Coffre quantique          | 2×2             | 0,9 m   | 1 × Cristal quantique + 1 × Microcontrôleur + 1 × Châssis composite | —              |

**Assemblage et recherche**

| Machine                | Emprise (cases) | Hauteur | Coût                                                                     | Énergie / vie    |
| ---------------------- | --------------- | ------- | ------------------------------------------------------------------------ | ---------------- |
| Assembleur             | 4×4             | 1,5 m   | 3 × Châssis simple + 4 × Engrenage en fer + 6 × Kit circuit              | consomme 60 kW   |
| Assembleur avancé (T3) | 4×4             | 1,5 m   | 3 × Châssis renforcé + 2 × Moteur + 3 × Circuit avancé                   | consomme 120 kW  |
| Fabricateur universel  | 4×4             | 2 m     | 4 × Microcontrôleur + 1 × Aimant supraconducteur + 1 × Châssis composite | consomme 1500 kW |
| Laboratoire            | 3×3             | 1 m     | 3 × Kit circuit + 3 × Châssis simple + 4 × Vitre                         | consomme 30 kW   |

**Énergie**

| Machine                      | Emprise (cases) | Hauteur | Coût                                                                                        | Énergie / vie                        |
| ---------------------------- | --------------- | ------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| Manivelle de réamorçage      | 2×2             | 1 m     | 4 × Plaque de fer + 2 × Engrenage en fer                                                    | —                                    |
| Générateur à combustible     | 3×3             | 1 m     | 2 × Châssis simple + 6 × Tige en fer + 12 × Pierre                                          | produit 300 kW, brûle 900 kW         |
| Roue à aubes                 | 3×3             | 1,5 m   | 12 × Bois + 4 × Pierre + 4 × Fil de cuivre                                                  | produit 10 kW                        |
| Chaudière                    | 3×3             | 1,5 m   | 6 × Plaque de fer + 16 × Tige en fer + 10 × Pierre                                          | brûle 700 kW                         |
| Turbine à vapeur             | 3×4             | 1 m     | 4 × Châssis simple + 4 × Engrenage en fer + 4 × Kit circuit                                 | produit 200 kW                       |
| Pile à combustible           | 3×3             | 1,4 m   | 1 × Châssis composite + 4 × Graphite + 1 × Microcontrôleur                                  | produit 2000 kW, brûle 2000 kW       |
| Réacteur à fission (T4)      | 4×4             | 2,5 m   | 15 × Châssis renforcé + 40 × Bloc de béton + 10 × Circuit avancé + 20 × Lingot de zamak     | produit 10000 kW                     |
| Réacteur à fusion magnétique | 6×6             | 3 m     | 100 × Châssis renforcé + 200 × Bloc de béton + 50 × Microcontrôleur + 100 × Lingot de zamak | consomme 50000 kW, produit 500000 kW |
| Éolienne                     | 2×2             | 6 m     | 2 × Châssis renforcé + 2 × Moteur + 1 × Kit circuit                                         | produit 40 kW                        |
| Panneau solaire              | 3×3             | 1,2 m   | 4 × Cellule photovoltaïque + 1 × Châssis léger + 1 × Vitre                                  | produit 60 kW                        |
| Accumulateur                 | 2×2             | 1 m     | 1 × Châssis renforcé + 2 × Isolant en plastique + 1 × Microcontrôleur                       | —                                    |
| Accumulateur (T3)            | 2×2             | 1,2 m   | 2 × Châssis renforcé + 4 × Batterie lithium + 1 × Microcontrôleur                           | —                                    |
| Poteau électrique            | 2×2             | 3,5 m   | 2 × Lingot de fer + 4 × Bois                                                                | —                                    |
| Poteau haute tension         | 2×2             | 6 m     | 1 × Châssis renforcé + 4 × Vitre + 1 × Kit circuit                                          | —                                    |
| Poteau très haute tension    | 2×2             | 10 m    | 2 × Châssis léger + 4 × Isolant en plastique + 1 × Microcontrôleur                          | —                                    |
| Transformateur               | 3×3             | 2,5 m   | 2 × Châssis renforcé + 24 × Fil de cuivre + 4 × Vitre                                       | —                                    |
| Disjoncteur                  | 2×2             | 1,5 m   | 1 × Châssis renforcé + 1 × Kit circuit + 1 × Vitre                                          | —                                    |
| Lampadaire électrique        | 1×1             | 3 m     | 1 × Châssis simple + 2 × Vitre + 1 × Kit circuit                                            | consomme 5 kW                        |
| Thermomètre                  | 1×1             | 1,2 m   | 1 × Vitre + 2 × Fil de cuivre + 1 × Plaque de fer                                           | affiche la température (fenêtre F)   |
| Girouette                    | 1×1             | 2,5 m   | 3 × Tige de fer + 1 × Engrenage de fer                                                      | affiche le vent (fenêtre F)          |
| Borne de recharge            | 3×3             | 1,8 m   | 1 × Châssis renforcé + 1 × Microcontrôleur + 2 × Isolant en plastique                       | consomme 400 kW                      |

**Fluides**

| Machine                      | Emprise (cases) | Hauteur | Coût                                                                    | Énergie / vie   |
| ---------------------------- | --------------- | ------- | ----------------------------------------------------------------------- | --------------- |
| Tuyau en cuivre              | 2×2             | 0,5 m   | 1 × Plaque de cuivre                                                    | —               |
| Pompe à eau électrique       | 2×2             | 1,5 m   | 2 × Châssis simple + 4 × Tige en fer + 1 × Moteur                       | consomme 20 kW  |
| Chevalet de pompage (T3)     | 4×4             | 3 m     | 4 × Châssis renforcé + 1 × Moteur + 2 × Kit circuit                     | consomme 60 kW  |
| Raffinerie (T3)              | 4×4             | 3 m     | 6 × Châssis renforcé + 8 × Bloc de béton + 1 × Moteur + 4 × Kit circuit | consomme 150 kW |
| Surpresseur (T2)             | 2×2             | 1 m     | 3 × Châssis simple + 4 × Engrenage en fer + 2 × Kit circuit             | consomme 30 kW  |
| Tour de refroidissement (T2) | 3×3             | 1,5 m   | 12 × Plaque de fer + 4 × Engrenage en fer + 10 × Pierre                 | —               |
| Tour d'évaporation (T4)      | 3×3             | 2 m     | 12 × Plaque d'acier + 20 × Bloc de béton + 6 × Engrenage en fer         | —               |

**Défense et protection**

| Machine                        | Emprise (cases) | Hauteur | Coût                                                                              | Énergie / vie            |
| ------------------------------ | --------------- | ------- | --------------------------------------------------------------------------------- | ------------------------ |
| Tourelle légère                | 3×2             | 1 m     | 3 × Châssis simple + 2 × Engrenage en fer + 3 × Kit circuit                       | —                        |
| Tourelle lourde                | 3×2             | 1 m     | 20 × Plaque de fer + 8 × Engrenage en fer + 8 × Lingot de cuivre                  | —                        |
| Tourelle laser                 | 3×2             | 1 m     | 10 × Plaque d'acier + 16 × Fil de cuivre + 4 × Puce en silicium + 1 × Moteur      | consomme 25 kW           |
| Tourelle à plasma              | 3×3             | 1 m     | 20 × Plaque d'acier + 10 × Puce en silicium + 10 × Carapace + 1 × Moteur renforcé | consomme 70 kW           |
| Tourelle à rail                | 3×3             | 1,4 m   | 1 × Aimant supraconducteur + 1 × Châssis composite + 1 × Batterie lithium         | consomme 1500 kW         |
| Clôture en bois                | 3×1             | 1 m     | 6 × Bois + 2 × Tige en fer                                                        | 150 PV                   |
| Barrière en béton              | 3×1             | 1 m     | 4 × Bloc de béton + 2 × Tige en fer                                               | 500 PV                   |
| Barrière en béton armé         | 3×1             | 1 m     | 4 × Bloc de béton + 4 × Tige en acier                                             | 1200 PV                  |
| Portail en bois                | 6×1             | 2,5 m   | 8 × Bois + 2 × Engrenage en fer + 2 × Tige en fer                                 | 200 PV                   |
| Portail en béton               | 6×1             | 2,5 m   | 6 × Bloc de béton + 2 × Engrenage en fer + 2 × Tige en fer                        | 600 PV                   |
| Portail en béton armé (moteur) | 6×1             | 2,5 m   | 6 × Bloc de béton + 4 × Tige en acier + 1 × Moteur                                | 1400 PV                  |
| Mur holographique              | 3×1             | 1 m     | 1 × Microcontrôleur + 4 × Vitre + 1 × Batterie lithium                            | consomme 80 kW, 800 PV   |
| Portail holographique          | 6×1             | 2,5 m   | 1 × Microcontrôleur + 6 × Vitre + 1 × Batterie lithium + 1 × Moteur               | consomme 120 kW, 1000 PV |
| Purificateur d’air             | 3×3             | 1,8 m   | 2 × Filtre en graphite + 1 × Châssis renforcé + 1 × Microcontrôleur               | consomme 150 kW          |

**Autres**

| Machine                        | Emprise (cases) | Hauteur | Coût                                                                                  | Énergie / vie    |
| ------------------------------ | --------------- | ------- | ------------------------------------------------------------------------------------- | ---------------- |
| Relais émetteur hyperfréquence | 2×2             | 1,5 m   | 10 × Plaque d'acier + 10 × Câble isolé + 6 × Puce en silicium                         | consomme 1000 kW |
| Antenne d'alignement quantique | 3×3             | 3 m     | 20 × Plaque d'acier + 10 × Lingot de zamak + 20 × Câble isolé + 10 × Puce en silicium | consomme 5000 kW |
| Balise                         | 1×1             | 2 m     | 4 × Lingot de fer + 2 × Fil de cuivre                                                 | —                |

Fonctionnement résumé :

- **Foreuse** (combustible, électrique, économe, à plasma) : mine les cases de minerai sous elle, stocke son extraction ; sa **sortie** est devant. L'économe et la foreuse à plasma extraient bien plus vite.
- **Fourneau, estampeuse, concasseur, Bessemer, bétonnière, constructeur, station de lavage, presse, centrifugeuse, compresseur d'air, électrolyseur…** : machines à **recette choisie dans leur fenêtre** ; elles consomment des ingrédients amenés par tapis ou bras. Un **seul type de minerai à la fois** dans un fourneau.
- **Assembleur / assembleur avancé / fabricateur universel** : on choisit la **recette** parmi les objets fabricables ; 3 types d'ingrédients au plus (4 pour l'avancé et le fabricateur) ; l'assembleur fait un cycle en 2 s, l'avancé en 1,5 s, le fabricateur en 0,5 s.
- **Laboratoire** : consomme des paquets de science pour étudier une découverte (§8) ; stock de 20 paquets ; les découvertes de recherche raccourcissent le temps par paquet.
- **Coffres** : bois (16 cases), fer (32), **quantique** (64 cases, §12.3).
- **Purificateur d'air** : retire 4 points de pollution par seconde autour de lui (air et sol).
- Chaque machine affiche un **état** (en marche, arrêt, panne de combustible, pas de courant, pas d'eau, plein, abîmée…) et une infobulle de diagnostic quand on la vise. Sa **vie** s'affiche dans sa fenêtre.

### 7.2 Transport : tapis, bras, séparateurs ✅

- **Tapis** : tuile 2 × 2, trois paliers de vitesse, **6 objets par tuile**, hauteur 15 cm. Le joueur peut **marcher dessus** et est **emporté**.
- **Formes** : plat, **rampes** à 45°, **niveaux surélevés** (1 m et 2 m ; le joueur passe sous le niveau 2), **descentes**, **tunnels** (entrée PageDown / sortie PageUp, jusqu'à **8 tuiles**, on peut construire par-dessus).
- **Tracé** : maintenir le clic et tracer pose plusieurs tuiles ; chaque élément s'oriente vers le suivant. PageUp / PageDown monte ou descend d'un niveau.
- **Séparateur** (1 entrée, 3 sorties), **groupeur** (3 entrées, 1 sortie) et **trieur** se posent **sur un tapis** et le remplacent ; le **bras filtrant** et le trieur ont des **listes blanche / noire**.
- **Bras** (combustible, électrique, filtrant, industriel) : prend sur 3 côtés, dépose devant ; cycle de 0,9 s (0,45 s électrique, 0,2 s industriel).
- **Flèches au sol** : **orange** = sortie, **bleu** = entrée. Les machines **touchant** un côté d'entrée / sortie se raccordent.

### 7.3 Énergie électrique ✅

Un **réseau** est un ensemble de poteaux de **même niveau** reliés par des câbles (visibles). Trois niveaux, qui forment une hiérarchie : **gros** poteaux pour de grosses centrales, **moyens**, puis **petits** poteaux près des machines.

| Poteau             | Palier | Prises | Câble entre poteaux | Puissance maximale du réseau |
| ------------------ | ------ | ------ | ------------------- | ---------------------------- |
| Bois               | T0     | 3      | 8 m                 | 500 kW                       |
| Haute tension      | T2     | 4      | 20 m                | 10 MW                        |
| Très haute tension | T3     | 5      | 40 m                | 600 MW                       |

- Chaque machine électrique (consommatrice ou productrice) se branche sur une **prise** du poteau le plus proche (à 4 m) qui en a encore ; les plus anciennes gardent leur prise. Sans prise libre, la machine n'est pas alimentée (l'infobulle le dit).
- **Limite de puissance** : la production d'un réseau ne dépasse jamais la limite de son niveau. Une machine dont la puissance (production ou consommation) dépasse celle des poteaux à portée **n'est pas raccordée** : un réacteur de 10 MW exige la haute tension, la fusion (500 MW) la très haute tension. Il faut donc **diviser** : plusieurs réseaux plus petits plutôt qu'un seul.
- **Transformateur** (T2, 3×3, 10 MW) : prend une prise sur un poteau de chaque niveau voisin (à moins de 4 m) ; **le courant passe par lui dans les deux sens** (il descend jusqu'à ce qui manque au réseau du bas ; le **surplus** du réseau du bas remonte vers le haut, dans la limite de sa puissance), jusqu'à ce qui manque au réseau du bas ; le réseau du haut voit cela comme de la demande. Jamais de remontée.
- **Disjoncteur** (T2) : relie les deux poteaux de même niveau les plus proches. Fermé, les deux réseaux n'en font qu'un ; ouvert (à la main), ils sont séparés. **Sur surcharge, les disjoncteurs fermés du réseau sautent** au lieu du blackout : le réseau se coupe en morceaux, à refermer à la main.
- **Compteur** : un clic sur un poteau affiche ses prises, le niveau et la limite, la production, la demande, la part satisfaite, une **courbe** de production et de demande (4 dernières minutes) et la liste des machines raccordées.
- **Satisfaction** : si la demande dépasse la production, toutes les machines du réseau ralentissent proportionnellement. Une surcharge durable provoque un **blackout** (le réseau s'éteint) : réduire la demande puis actionner une **manivelle** de réamorçage. Les générateurs ne brûlent que **la part de leur capacité demandée**.
- **Sources** : générateur à combustible (300 kW), roue à aubes (10 kW, à l'eau), turbine à vapeur (200 kW), **éolienne** (T2, jusqu'à 40 kW : le vent monte et retombe, 15 à 100 %), **panneau solaire** (T3, jusqu'à 60 kW, proportionnel à la lumière du jour, nul la nuit), réacteur à fission (10 MW), **pile à combustible** (T4, 2 MW, deutérium ou tritium), réacteur à fusion (500 MW, T5).
- **Stockage** : accumulateur de base (T3, 200 MJ, 400 kW) et accumulateur au lithium (T4, 1 GJ, 25 / 50 MW) : ils chargent avec le surplus et rendent leur énergie quand la demande dépasse la production, sans dépasser la limite du niveau.
- **Lampadaire** (T1, 5 kW) : éclaire la nuit (les lampadaires alimentés les plus proches du joueur).
- **Borne de recharge** : voir §7.10.

### 7.4 Fluides et vapeur ✅

- **Eau et vapeur** circulent par **équilibrage des niveaux** entre machines raccordées (le débit dépend de l'écart de pression : un long tuyau perd en débit). Un **tuyau ne porte qu'un fluide à la fois**. Des **barils** transportent eau et pétrole.
- **Pompe** : au bord d'un étang, 100 eau/s. **Tuyaux** : 2 × 2, posés en traçant, **enterrables** comme les tapis ; trois paliers de pression maximale ; un tuyau qui dépasse sa pression maximale **éclate**.
- **Chaudière** (3 × 3) : eau par les deux côtés (chaînage), combustible derrière, **vapeur devant**. **Turbine** (3 × 4) : vapeur en entrée derrière, le reste ressort devant ; une chaudière ≈ 3 turbines.
- **Pétrole** : pompe à pétrole, raffinerie, presse à plastique (isolant). **Surpresseur**, **tour de refroidissement** (eau chaude), **tour d'évaporation** (eau sale, fait muter les nids voisins).

### 7.5 Pollution et machines

Voir §9.1.

### 7.6 Énergie de combustion ✅

Items : énergie en **MJ par unité**. Machines : **`burnKw`** en kW à pleine charge. Foreuse et fourneau 90 kW, bras 20 kW, **générateur 900 kW de combustible pour 300 kW électriques** (rendement ≈ 33 %), **chaudière 700 kW** (→ 600 kW de vapeur), buggy 180 kW.

### 7.7 Poser et déplacer

Une machine se pose en **un clic**, la touche R la tourne ; **même case = ranger** (la machine revient au sac avec ses contenus, sauf le contenu du coffre quantique). Les tapis et tuyaux peuvent chevaucher partiellement une machine. Les machines à l'étage exigent une dalle sous chacune de leurs cases.

### 7.8 Voies ferrées et trains ✅

- **Pièces de voie** : un **droit** (2,5 m ; 3,54 m en diagonale), un **virage unique de 45°** (à gauche ou à droite, rayon 8,75 m, 3 rails) et une **rampe** (10 m, monte de 2,5 m, 4 rails). Huit virages de 45° font un cercle. Les pièces sont repérées par un point d'ancrage et un **cap** par pas de 45°.
- **Pose** : un **patron vert** (pose possible) ou **rouge** (impossible, avec la raison : chevauche une voie, trop loin, obstacle, pente, raccord non aligné) suit le curseur ; il se **colle** au bout libre le plus proche (moins de 2,6 m). **Clic maintenu** : le curseur qui avance ajoute des patrons à la suite (reculer en retire), **relâcher pose** toute la chaîne, **clic droit** retire les patrons. Un simple clic pose une pièce.
- **Embranchement** sans aiguillage : un bout de rail peut avoir plusieurs suites (Y) ; **au milieu d'une ligne** on propose un virage de chaque côté pour créer un Y. Le train va vers sa prochaine station, sinon **tout droit** ; **Q** ou **D** à l'approche choisit la voie de gauche ou de droite. **Croisement en « + »** pour traverser une voie.
- **Matériel** (rails et locomotive à vapeur : palier 3) : locomotive à vapeur (140 kW, charbon ou bois, soute de 50), **locomotive électrique** (T4, 260 kW, batterie de 180 MJ rechargée à une borne : **elle ne se recharge pas en roulant, même sur rails électrifiés**), wagon de fret (coffre de 32 cases), **wagon plateforme** (fret en vrac, coffre de 32 cases), wagon-citerne (10 000 L). Attelage automatique : deux véhicules attelés gardent toujours la même distance. Les véhicules sont des boîtes de collision pour le joueur.
- **Conduite** : **F** monte dans la locomotive, **Z / S** avancent et reculent, **Espace** freine, **C** attelle ou dételle. **Stations** nommées et **pilote automatique** (« va à la station X », itinéraire le plus court ou le plus rapide) ; programmes à base de règles « condition → action » (`docs/trains-programmation.md`). Signaux et cantons : ⏳.
- Les anciennes parties d'avant la refonte des rails sont **refusées** au chargement (version de voie incompatible).

### 7.9 Barrières et portails ✅

Les clôtures et barrières (1 m de haut) et les portails se posent **sur le bord de leurs cases** : deux rangées qui font un angle se rejoignent au coin, et **chaque pièce a un poteau à ses deux bouts** (jamais à l'intérieur : les poteaux restent visibles à la jonction de deux pièces, la rangée n'est pas un mur uni). **Pose à la suite** : en gardant le clic gauche enfoncé pendant que l'aperçu est visible, les clôtures, barrières et portails se posent les uns derrière les autres (la pièce suivante se cale bout à bout derrière la dernière, dans son sens, quand le curseur s'en approche) jusqu'au relâchement. **Angles** : une clôture, une barrière ou un portail peut se poser **contre l'angle de n'importe quel autre** (ils partagent alors une case, à condition d'être posés dans l'autre sens). **Portails** : manuels par défaut (**E** les ouvre et les ferme) ; ceux qui peuvent être automatiques (portail en béton armé à moteur, portail holographique) changent de mode quand on **garde E appuyée** (0,6 s) : en automatique ils s'ouvrent à l'approche et se referment après, et E ne les commande plus.

| Élément                          | Taille | Points de vie | Palier |
| -------------------------------- | ------ | ------------- | ------ |
| Clôture en bois                  | 1 m    | 150           | T1     |
| Barrière en béton                | 1 m    | 500           | T2     |
| Barrière en béton armé           | 1 m    | 1 200         | T3     |
| Portail en bois                  | 3 m    | 200           | T1     |
| Portail en béton                 | 3 m    | 600           | T2     |
| Portail en béton armé (motorisé) | 3 m    | 1 400         | T3     |
| Mur holographique                | 1 m    | 800           | T4     |
| Portail holographique            | 3 m    | 1 000         | T4     |

- Les barrières **bloquent le joueur et les ennemis**. **Les ennemis ne les contournent pas et ne les ouvrent pas : ils les attaquent** (et les détruisent s'ils les épuisent).
- Un **portail manuel** s'ouvre et se ferme avec la touche d'**activation (E)** ; le **portail en béton armé** est **motorisé** : il s'ouvre seul quand un joueur approche (4,5 m) et se referme ensuite.
- Le **mur et le portail holographiques** consomment de l'énergie **en continu** (80 et 120 kW) et ne barrent le passage **que s'ils sont alimentés**.

### 7.10 Véhicules électriques et recharge ✅

- La **borne de recharge** (T4, 3 × 3, 400 kW) recharge, dans un rayon de 4 m, les **véhicules électriques**, les **locomotives électriques** et les **batteries portables** du sac du joueur ; elle a aussi **4 emplacements** où l'on range des batteries portables (seules acceptées) : celles-ci se rechargent toutes seules, même si le joueur est loin. Elle ne réclame pas de courant fixe : elle **ne prend que le surplus** de son réseau (production moins ce que consomment les autres machines), au plus 400 kW, et ne peut donc jamais provoquer de surcharge ni de blackout. Elle partage sa puissance entre ses cibles et **ne consomme que s'il y en a une** à recharger. Les véhicules ne se rechargent jamais ailleurs.
- La **batterie portable** se range dans le sac ; chaque batterie a sa propre charge (§5.3) ; le propulseur la consomme avant les batteries au lithium.

### 7.11 Santé des machines et réparation ✅

- Les machines ont des **points de vie** (120 par défaut, plus pour les barrières) ; les ennemis les abîment (§9.5). Une machine abîmée **noircit par taches** selon son état (légèrement sous 75 % de vie, nettement sous 50 % avec une fumée noire, très fortement sous 25 % avec des étincelles) ; sa vie en pourcentage est dans sa fenêtre. La vie est **sauvegardée**.
- Le **kit de réparation** (T1, 5 charges) se prend **en main** (sac ou barre de raccourcis) ; un **clic** sur une machine abîmée consomme une charge (**+25 % de la vie maximale**) avec un bruit de clé à cliquet. On use d'abord le kit le plus entamé. **Un kit s'use mais ne se recharge ni ne se répare.**

---

## 8. Découvertes et recherche

### 8.1 Principe ✅

On ne recherche pas des « technologies » : on **découvre des recettes**. Une **découverte** débloque la fabrication d'un ou plusieurs objets (machines, constructions, intermédiaires, véhicules…). Elle exige d'avoir **découvert d'autres recettes** en amont (**prérequis**) : on peut partir d'un produit final et voir **tout ce qu'il faut avoir découvert avant**. Le jeu compte **164 découvertes** réparties sur six paliers (T0 : 22, T1 : 24, T2 : 30, T3 : 43, T4 : 32, T5 : 12). Un objet qui n'appartient à aucune découverte est disponible dès le départ.

### 8.2 Coûts et modes ✅

- **Palier 0** : payé en **objets du sac** (recherche à la main, sans laboratoire).
- **Paliers 1 à 5** : payé en **paquets de science** du palier **et** du palier précédent (palier 1 : paquets T1 seuls), de l'ordre de **100 à 200 paquets de chaque**. Il faut étudier la découverte dans un **laboratoire** alimenté en paquets (tapis, bras ou main) et en courant ; **sans étude choisie, les laboratoires étudient automatiquement** la première découverte disponible. L'avancement est sauvegardé.
- Avertissements : on ne peut pas mettre un paquet d'un palier sur une recette d'un palier qui n'est pas encore découvert ; des alertes signalent les conditions non respectées.
- Une ancienne sauvegarde reçoit toutes les découvertes dont les objets étaient déjà fabricables, avec leurs prérequis.

### 8.3 Arbre des découvertes ✅

L'écran **Découvertes (T)** montre l'**arbre entier** à droite (2/3 de l'écran : disposition par couches, liens orthogonaux, glisser pour déplacer, **Ctrl + molette** pour zoomer) et, à gauche (1/3), le détail de la découverte choisie et la **liste ordonnée** de ce qu'il faut découvrir pour y arriver (orange : prochaine étape ; rouge : prérequis proche ou manquant ; vert : déjà fait). Un **Ctrl + clic gauche** sur une recette ouvre une fenêtre par-dessus avec l'arbre et un filtre « prérequis proches / éloignés ». Le tableau détaillé est dans `docs/decouvertes-t0-t5.md` (généré) et les données dans `content/techs.json` (généré par `tools/gen_decouvertes.py --jeu`).

Quelques jalons : _Logistique_ (tapis, bras), _Électricité_ (poteau, générateur, laboratoire), _Acier_ puis _Vapeur_, _Poteau haute tension_ et _Transformateur_ (T2), _Plastique_ et _Silicium_ (T3), _Batterie au lithium_ (T4), _Réacteur à fission_ (T4), _Fusion_ (T5).

### 8.4 Effets de recherche ✅

Les découvertes de **Recherche** (I à IV) raccourcissent le temps d'étude par paquet : de 5 s à 4, 3, 2 puis 1 s pour les paquets des paliers concernés. Le paquet de combat reste à 5 s. La **boussole** n'apparaît qu'une fois la _Navigation_ découverte.

---

## 9. Pollution, ennemis et défense

### 9.1 Pollution ✅

- Les machines qui **travaillent** polluent (valeur par seconde dans `machines.json`) : foreuse 0,6 (sol), foreuse électrique 0,3 (sol), fourneau 0,5 (air), générateur 1 (air), **chaudière 2 (air)**, assembleur 0,2 (sol), laboratoire 0,1 (sol).
- **Deux types** : la **pollution d'air** (fumées) s'accumule par cellule de **32 m**, **s'étale** aux 4 voisines au-delà de 6 et est **absorbée** par le sol (0,05/s) et les **arbres** (0,01/s chacun) ; la **pollution du sol** reste sur place et ne s'efface presque pas (0,01/s).
- L'absorption des arbres varie avec la saison : ×1,2 en été, ×1 au printemps, ×0,7 en automne, ×0,35 en hiver (interpolée entre les saisons).
- Visible sur la **carte (M)** ; l'infobulle de chaque machine indique son débit par minute.

### 9.2 Nids et ennemis ✅

- Les **nids** voisins (cellules 3 × 3) **absorbent la pollution** (3/s pour l'air, 1,5/s pour le sol) et fabriquent des ennemis : **12 de pollution par ennemi** (8 si les ennemis sont agressifs), **25 ennemis maximum** en même temps.
- **Ennemi** : 25 PV, vitesse 3,2 m/s (4 m/s agressifs), attaque le joueur (**10 dégâts toutes les 1,2 s**) ou une **machine polluante** (6 dégâts/s ; une machine a 120 PV) ; porte de vue : machines 160 m, **joueur 24 m (45 m agressifs)** ; abandonne après 150 s sans cible.
- **Gardiens** : 3 par nid, apparaissent quand le joueur s'approche (90 m), le poursuivent jusqu'à **30 m** de visée et **90 m** de leur nid, **réapparaissent après 40 s**.
- Les **ennemis vivants sont sauvegardés** avec la partie.
- Les options de partie contrôlent le comportement : **agressifs** (non par défaut) et **expansion** des colonies (oui par défaut).

### 9.3 Détruire un nid ✅

Un nid a **150 PV de dégâts cumulés** (sauvegardés) : on le détruit **en tirant dessus** (10 par tir) ou au **corps à corps** (12). Il disparaît du monde et de la carte, ses gardiens avec lui, et ne reviendra pas.

### 9.4 Tourelle ✅

3 × 2 cases, 16 fer + 6 cuivre, découverte _Défense_ (T1). **Portée 22 m, 9 dégâts toutes les 0,6 s**, utilise des **chargeurs** (12 balles ; stock de 20) amenés par tapis, bras ou main ; tire sur l'ennemi le plus proche.

### 9.5 Attaque des installations ✅

- Les ennemis visent le joueur ou une **machine polluante** ; une machine a **120 PV** (plus pour les barrières, §7.9). Détruite par les ennemis, elle disparaît **avec son contenu** (contrairement à la démolition volontaire, qui rend tout au joueur). Les dégâts sont **sauvegardés**.
- Les ennemis **ne contournent pas les barrières** : face à une clôture, une barrière ou un portail fermé, ils l'attaquent. Les murs et portails holographiques ne bloquent que s'ils sont alimentés.
- Les machines abîmées se **réparent avec un kit de réparation** (§7.11).
- ⏳ Vagues d'ennemis, butin.

### 9.6 Tourelles étendues ✅

Cinq tourelles : légère et lourde (munitions), **laser**, **plasma** et **à rail** (électriques, sans munitions ; la tourelle à rail, T5, tire à 70 m pour 220 dégâts toutes les 1,6 s).

**Repérage et tir** : une tourelle qui a de quoi tirer (balles ou courant) **repère l'ennemi le plus proche dans sa portée**, **tourne sa tête vers lui** (4 rad/s ; sans cible, elle balaye l'horizon) et lui tire dessus à sa cadence. Chaque tir est montré par un **trait lumineux** de la tourelle à l'ennemi (jaune pour la légère, orange pour la lourde, bleu pour le laser, violet épais pour le plasma, blanc long pour le rail) avec son bruit de tir ; un ennemi tué fait un autre bruit. Une tourelle sans munitions ou sans courant ne vise pas.

---

## 10. Jour, nuit et saisons

### 10.1 Trois réglages indépendants ✅ (par partie, à la création)

| Réglage                                | Défaut                 | Bornes                                                                                                        |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Durée d'un **jour**                    | **10 min**             | 1 – 120                                                                                                       |
| Durée d'une **nuit**                   | **8 min**              | 1 – 120                                                                                                       |
| Durée d'une **saison**                 | **10 jours** (+ nuits) | 1 – 100 jours                                                                                                 |
| **Part de chaque saison** dans l'année | 25 % × 4               | **camembert** interactif : chaque part est agrandie/réduite à la souris, **minimum 5 %** chacune, total 100 % |

L'année dure 4 × (jours par saison) × (jour + nuit). Les réglages ne se modifient qu'à la création ; une partie existante prend les valeurs par défaut.

### 10.2 Effets ✅

- **Transitions progressives** : le sol, le ciel et l'absorption des arbres sont **interpolés entre les « centres » de saison** (pas de changement brusque).
- **Saisons** : printemps (sol légèrement verdi), été (neutre, arbres ×1,2), automne (sol roux, arbres ×0,7), hiver (sol terne, voile de neige, arbres ×0,35).
- **Jour/nuit** : luminosité lissée (aube et crépuscule d'au plus 1 min), la partie **commence en plein jour**. Éclairage hémisphérique + soleil dont l'intensité suit la lumière du jour ; ciel et brouillard suivent. Le soleil ne se déplace pas dans le ciel 🔶.
- Le **temps de jeu** (secondes) est enregistré avec la partie.

### 10.3 Climat : température et vent 🔶 (tour 290 : première version codée)

- **Température** ✅ : elle dépend du **biome** (de −5 °C à 30 °C), de la **saison** (±10 °C : l'hiver est le plus froid, l'été le plus chaud, transition progressive) et de l'**heure** (jusqu'à −8 °C en pleine nuit). Les valeurs sont à équilibrer (§14).
- **Froid** ✅ (réglage du tour 306) : chaque vêtement et pièce d'armure apporte des **points de chaleur** (veste 3, pantalon 2, capuche, bottes et gants 1 ; armure : un quart de sa protection, qui baisse avec l'usure). En dessous de **6 °C − 1 °C par point de chaleur**, le joueur perd **0,05 PV/s par °C** manquant (l'armure ne réduit pas ces dégâts ; rien en mode Créatif) ; sous 0,15 PV/s le froid est léger et la santé continue de remonter. Exemples : tout nu, il faut une nuit d'hiver en prairie (−6 °C) pour perdre 0,6 PV/s ; avec les vêtements, 0,18 PV/s ; en toundra l'hiver, la nuit (−16 °C), il faut une armure T3 pour descendre à 0,35 PV/s et une armure T5 pour ne rien perdre.
- **Thermomètre** ✅ : découverte **Station météo** (T1). Il ne se pose que **contre un mur** (une pièce de bord, mur ou porte, touche un côté de sa case) ; c'est un petit **écran fixé au mur, tourné vers sa case**, qui affiche la température de **cette case** (°C, °F ou K selon les paramètres) : placé dans une pièce close il donne la température de l'intérieur, de l'autre côté du mur celle de l'extérieur. Dessiné pour l'instant avec des formes simples (cadre et écran).
- **Abri** ✅ : dans une **pièce close**, la température se rapproche de 14 °C (la moitié de l'écart avec l'extérieur est compensée) ; cela vaut aussi pour le froid que ressent le joueur. Le chauffage ira plus loin ⏳.
- **Vent** ✅ : une **direction** qui dérive lentement (plusieurs minutes) et une **force** qui alterne calmes et rafales, **les mêmes pour toutes les éoliennes** et tous les joueurs d'une partie (fonction de la seed et du temps). L'éolienne produit de 15 % à 100 % de sa puissance selon la force.
- **Girouette** ✅ : même découverte ; elle ne se pose que **sur une dalle** (au sol ou à l'étage). Sa **flèche pointe vers l'endroit d'où vient le vent** et tourne plus vite quand il souffle fort ; sa fenêtre affiche la **force** (km/h) et la **direction** (point cardinal vers lequel souffle le vent). ✅ **Éolienne** : son rotor se tourne **face au vent** (lentement, c'est lourd) et tourne d'autant plus vite que le vent est fort. Modèles dessinés avec des formes simples, ⏳ à remplacer par de vrais modèles. (voir `docs/objets-sans-design.md`).
- **Pas d'affichage permanent** de la température ou du vent à l'écran par défaut. Les **armures T4 et T5** donnent un **affichage en réalité augmentée** ✅ (essai), que la touche **J** fait passer par trois modes : **désactivé**, **simple** et **complet** (la touche H, déjà prise par la destination du train, n'a pas pu servir ; tout est reconfigurable). Style **discret** : pas de barre de vie flottante.
  - **Simple** : la **température** locale (une ligne fine sous la boussole) et un **liseré lumineux au sol** autour des machines abîmées à moins de 40 m (vert, orange puis rouge selon la vie).
  - **Complet** : en plus, le **vent** (force et direction), le **réseau électrique** de la machine visée (production et demande) et des **anneaux rouges au sol sous les ennemis** à moins de 50 m (essai à juger).
  - **Condition** ✅ : il faut **porter le casque** T4 ou T5 ; sans casque, pas d'affichage et pas de consommation pour cette fonction. (Essai actuel : l'énergie vient des batteries du sac, voir ci-dessous pour la cible.)
- **Armures actives T4 et T5** (en cours) : ✅ chaque **pièce** de l'armure T4 ou T5 a sa **case de batterie portable** dans le sac (sous la pièce), la batterie revient au sac si on retire la pièce et reste sur le corps à la mort, la borne et les batteries du sac la rechargent ; ✅ le casque (réalité augmentée) puise dans ces batteries (la T5 consomme 20 % de moins) ; ✅ **jambes** : l'**exosquelette** des jambes T4 (puissance 1 : +40 kg portés, marche 10 % plus rapide, le tapis n'emporte plus) et T5 (puissance 2 : +80 kg, +20 %) s'allume dans le menu circulaire et puise dans les batteries **en marchant** (T4 2 s d'affichage simple par seconde, T5 1,6 ; il s'éteint à court d'énergie) ; l'ancienne pièce Exosquelette (T3) reste, sans énergie, puissance 1 ; ⏳ torse, mains. Cible : chaque **pièce** de l'armure reçoit sa **batterie** ; la **réserve d'énergie** de l'armure est la somme des batteries de toutes les pièces portées (plus de pièces, plus d'autonomie). Les fonctions de l'armure **consomment de l'énergie**, la **T5 un peu moins que la T4** :
  - **casque** : l'affichage en réalité augmentée (trois modes) ;
  - **jambes** : l'**exosquelette** s'active ou se désactive à volonté ; plus puissant en T5 qu'en T4 ;
  - **torse** : une **barre de raccourcis en plus**, qui ne consomme presque rien ;
  - **mains** : remplacent l'**outil** ; **chaque coup consomme** de l'énergie.
  - **Interface** (essai demandé par le PO) : un **menu circulaire** (un « camembert creux » au centre de l'écran) liste les **avantages** offerts par les pièces équipées. Choisir un avantage soit l'**active ou le désactive**, soit ouvre un **second anneau** identique avec les **options** de cet avantage (ex. casque : désactivé, simple, complet). Ouverture par la touche de l'armure (J pour l'instant). ✅ Premier jet : seul l'avantage du **casque** (réalité augmentée : désactivé, simple, complet) est dans le menu ; les autres pièces et la **batterie par pièce** ⏳ viendront une à une.
- **Chat et commandes** ✅ : la touche **Entrée** ouvre une ligne de saisie (le curseur y est) ; **Entrée** envoie, **Échap** ferme ; les dernières lignes restent affichées quelques secondes. Les commandes commencent par « / » : `/aide`, `/jour`, `/nuit`, `/saison <printemps|été|automne|hiver>`, `/temperature <°C|auto>`, `/vent <force 0-100|auto> [n|ne|e|se|s|so|o|no]`, `/meteo` (tout remettre en automatique), `/survie` et `/creatif` (changer de mode). Les commandes sont **réservées à l'hôte** (ou au joueur seul) **en mode Créatif** (ou dans une partie qui a quitté le Créatif par `/survie`), et marquent la partie « admin ». Elles sont toutes déclarées par `defineCommand` (nom, alias, arguments typés) : l'analyse, les erreurs et l'aide se font toutes seules, ce qui rend l'ajout d'une commande facile.
- ⏳ Reste à concevoir : chauffage des abris, combustible d'hiver, cultures ; le vent pourra plus tard orienter la fumée, la pollution ou les nuages.

---

## 11. Interface, commandes et paramètres

### 11.1 Écrans ✅

- **Menu d'accueil** : _Continuer_ (nom de la partie + date de sa dernière sauvegarde), _Nouvelle partie_, _Charger une partie_, _Paramètres_, _Quitter_ (masqué en version web).
- **Éditeur de partie** : nom, seed (avec mélange aléatoire), curseurs des familles du monde, options ennemis, réalisme, **jour/nuit/saisons + camembert**.
- **Gestion des parties** : charger, renommer, dupliquer, supprimer ; une partie = un dossier de sauvegardes manuelles et automatiques.
- **En jeu** : barre de raccourcis, fenêtre de sac / fabrication / équipement, fenêtres de machines, de coffres et du buggy, **carte (M)**, **découvertes (T)**, **pause (Échap)**, aides de construction à l'écran, notifications.

### 11.2 Mode débogage (F9) ✅

Touche **F9** (F3 est la recherche du navigateur) : affiche les **boîtes autour de la cible**, le **panneau d'infos** (seed, saison, vue, position, chunk, biome, chunks chargés, appels de dessin, repères de départ), le **compteur d'images/s** et le **cadre « Partie / Sac / Menu »** (cachés sinon). Utilisable en toute partie ; **au premier usage la partie est marquée « admin »** (`changes.admin`) : les futurs succès seront désactivés pour cette partie.

### 11.3 Boussole ✅

Bandeau avec cap en degrés, **débloquée par la découverte Navigation** ; affiche aussi le repère du corps du joueur.

### 11.4 Commandes (par défaut ; tout est remappable)

| Action                                                     | Touche                                   |
| ---------------------------------------------------------- | ---------------------------------------- |
| Avancer / reculer / gauche / droite                        | Z S Q D (AZERTY) ou W S A D (QWERTY)     |
| Sauter / sprinter / s'accroupir                            | Espace / Maj gauche / Ctrl gauche        |
| Changer de vue                                             | V                                        |
| Interagir, récolter, tirer                                 | Clic gauche ou E                         |
| Utiliser (ouvrir une machine, monter/descendre du buggy)   | F (Maj + F : ranger le buggy)            |
| Action secondaire (démolir maintenu, vider les mains bref) | Clic droit                               |
| Lâcher l'objet                                             | G                                        |
| Définir le point de réapparition                           | H                                        |
| Inventaire / carte / découvertes                           | Tab ou I / M / T                         |
| Débogage / capture d'écran                                 | F9 / F2                                  |
| Menu / pause                                               | Échap                                    |
| Pivoter / recharger                                        | R                                        |
| Construction : étage, niveau de tapis, étage de machine    | PageUp / PageDown                        |
| Mur : bloc au-dessus / en dessous                          | Début / Fin                              |
| Supprimer ; copier / coller / annuler / rétablir           | X ou Suppr ; Ctrl+C / V / Z / Y          |
| Zoom ; rotation de caméra                                  | Molette ou + / − ; flèches gauche/droite |
| Barre de raccourcis                                        | 1 … 9                                    |

Chaque action accepte **deux combinaisons** (touche + touche, touche + clic, touche + molette) ; **détection de conflits** ; clavier **ZQSD ou WASD** au choix. Le détail des gestes de souris par contexte est dans `docs/commandes.md`.

### 11.5 Paramètres ✅ (stockés dans le navigateur, effet immédiat)

- **Affichage** : langue (français / anglais), plein écran, **préréglage graphique** (adapté à mon ordinateur / bas / moyen / haut / personnalisé), gamma, luminosité, distance d'affichage (2–16 chunks), qualité (basse / moyenne / haute), ombres (désactivées / normales / détaillées), limite d'images/s (30 / 60 / 120 / illimité), taille de l'interface (80–150 %), **unités** (distance m/ft, température °C/°F/K, masse kg/lb, pression Pa/bar/psi, énergie J·W / kWh), format de l'heure, **daltonisme**, afficher les FPS, **afficher la barre de santé**.
- **Préréglage graphique** : _bas_ (qualité basse, sans ombres, vue 6 chunks), _moyen_ (moyenne, ombres normales, vue 8), _haut_ (haute, ombres détaillées, vue 12) règlent d'un coup la qualité, les ombres et la distance de vue ; _adapté_ choisit le meilleur niveau d'après la carte graphique, le processeur, la mémoire et l'écran de l'ordinateur (recalculé à chaque lancement) et **descend d'un niveau tout seul** si le jeu ne tient pas la cadence (il ne remonte pas sans que le joueur rechoisisse « adapté »). Changer à la main un des trois réglages passe en _personnalisé_. Le **rapport de bug** contient les images par seconde, leurs à-coups et la répartition du travail.
- **Sons** : général, musique, ambiance, interactions, machines, alertes (chaque curseur + muet).
- **Vues** : réglages par vue (voir §4.2) et communs (sensibilité, axe inversé, lissage).
- **Touches** : voir §11.4. **Jeu** : sauvegarde automatique (intervalle), confirmations.
- Bouton de réinitialisation par onglet.

### 11.6 Langues ✅

Français et anglais ; **aucun texte en dur** (fichiers `fr.json` / `en.json` aux clés identiques) ; langue par défaut = celle du navigateur.

---

## 12. Parties, options et sauvegarde

### 12.1 Options de partie ✅

| Option                                   | Défaut                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Ennemis agressifs                        | **non**                                                                            |
| Expansion des colonies                   | **oui**                                                                            |
| Réalisme (arcade / équilibré / réaliste) | équilibré (réserve : sera appliqué à mesure que les systèmes physiques arriveront) |
| Jour / nuit / saisons                    | voir §10                                                                           |
| Seed et familles du monde                | voir §3                                                                            |

Le mode **Créatif** (§5.5) et le mode Survie sont choisis à la création de la partie ; le **multijoueur** s'active dans l'éditeur de partie (§12.3). ⏳ Difficulté fine, état initial du joueur.

### 12.2 Sauvegarde ✅

- Une **partie** contient plusieurs **sauvegardes** (manuelles et automatiques) pour revenir loin en arrière sans perdre les anciennes.
- Ce qui est enregistré : joueur (position, orientation, vue, hauteur), **sac**, et tous les **changements du monde** : ressources prélevées, objets au sol, pièces de construction, machines (contenu, combustible, fluides, tapis), équipement, découvertes, recherche en cours, pollution (air et sol), **ennemis**, **temps de jeu**, véhicules, munitions, **corps et point de réapparition**, barre de raccourcis et d'outils.
- **Format versionné avec migrations** (ids texte stables, versions d'emprise des machines et d'unité d'énergie) : une ancienne sauvegarde se charge dans une version plus récente.
- Stockage : navigateur (**IndexedDB**, repli sur localStorage puis mémoire) ; **export / import de fichier** disponibles ✅ ; dossier sur disque / version bureau plus tard ⏳.
- **Versions incompatibles** : les parties d'avant la refonte des rails sont **refusées** (grisées dans le menu : « version incompatible, créer une nouvelle partie »). Les autres changements de format sont migrés.
- Sont aussi enregistrés : points de vie des machines abîmées, contenu du coffre quantique de chaque joueur, niveaux des objets à état, préréglage graphique (réglages du navigateur, pas de la partie).

### 12.3 Multijoueur ✅

- **5 joueurs au plus**, pas de joueur contre joueur ; les ennemis visent le joueur le plus proche. **L'hôte fait tourner la simulation** ; les autres envoient leurs actions. Une partie solo peut **devenir multijoueur** à tout moment (pause → Multijoueur).
- Connexion directement entre navigateurs avec un **code d'invitation à 6 caractères** ou un lien ; partie **privée** (l'hôte accepte chaque arrivant) ou **publique** (mot de passe facultatif, stocké sous forme d'empreinte).
- **Partagé** : le monde et les machines ; technologies (découvertes) et crédits du comptoir selon le réglage de la partie. **Individuel** : sac, barre d'objets, équipement, position, vie, cadavre, point de réapparition, tutoriel. Un joueur qui revient (même nom) retrouve sa fiche ; les joueurs sont enregistrés dans la sauvegarde de l'hôte.
- **Coffre quantique** : c'est le **contenu qui appartient au joueur**, pas le coffre. Tous les coffres quantiques d'un joueur montrent le même contenu (64 cases), que les autres joueurs ne voient pas ; démolir un coffre ne rend rien et le contenu reste enregistré ; une machine posée par un joueur alimente le contenu de ce joueur.

---

## 13. Architecture technique (résumé)

- **Séparation stricte** : `src/core` (règles, sans affichage ni navigateur ; testé), `src/render` (Three.js : scène, caméras, chunks, machines), `src/ui` (menus, fenêtres), `src/i18n`, `src/settings`. Contenu dans `content/*.json`.
- **Monde** : grille à deux niveaux (cases logistiques de 50 cm + pas fin de 10 cm), positions en **entiers**, chunks générés à la demande et mis en cache ; maillage fusionné et **instancié** pour la performance.
- **Simulation** : à **pas fixe de 20 ticks/s** (`WorldSimulation`), déterministe côté génération ; l'hôte la fait tourner pour tous les joueurs.
- **Commandes** : les actions du joueur passent par l'état de jeu (`GameState`) qui émet des événements ; base du futur multijoueur et de l'annulation.
- **Unités SI** en interne ; conversion à l'affichage selon les paramètres.
- **Tests** : Vitest (plus de 800 tests : génération, physique, construction, usine, énergie, fluides, rails, ennemis, sauvegarde, saisons, multijoueur, réglages) + vérifications navigateur (Playwright/Chromium) sur scènes injectées.
- **Fluidité** : les chunks sont fabriqués **par étapes** (un seul fini par image, décor réparti sur plusieurs images), les niveaux de détail du décor sont préparés à l'avance, les machines et objets se retrouvent par tables ; le **rapport de bug** mesure les images (voir §11.5).
- **Déploiement** : Vercel, branche de travail ; aperçu en ligne à chaque push.

---

## 14. Tableaux d'équilibrage

### 14.1 Cadences

| Élément                                                 | Valeur                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Foreuse à combustible / électrique / économe / à plasma | extraction de plus en plus rapide (1 minerai toutes les 2 s → 0,04 s pour la foreuse à plasma) |
| Fourneau                                                | 1 recette par cycle (3 s à 20 s selon la recette)                                              |
| Tapis                                                   | 3 paliers de vitesse (0,75 case/s au palier 1), 6 objets par tuile                             |
| Bras                                                    | 0,9 s / geste ; électrique 0,45 s ; industriel 0,2 s                                           |
| Assembleur / avancé / fabricateur                       | 2 s / 1,5 s / 0,5 s par cycle                                                                  |
| Paquet de science fait à la main                        | 5 s × le palier                                                                                |
| Laboratoire                                             | 5 s / paquet (4 à 1 s avec Recherche)                                                          |
| Pompe                                                   | 100 eau/s                                                                                      |
| Chaudière                                               | 60 vapeur/s                                                                                    |
| Turbine                                                 | 200 kW pour 20 vapeur/s                                                                        |

### 14.2 Combat

| Élément       | Valeur                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| Ennemi        | 25 PV, 3,2 m/s (4 agressif), 10 dégâts / 1,2 s au joueur, 6 dégâts/s aux machines |
| Pistolet      | 10 dégâts, 0,35 s, 12 balles par chargeur                                         |
| Corps à corps | 12 dégâts, 2,6 m                                                                  |
| Tourelle      | 9 dégâts / 0,6 s, portée 22 m, ≈ 15 dégâts/s                                      |
| Machine       | 120 PV                                                                            |
| Joueur        | 100 PV, +4 PV/s après 5 s                                                         |
| Nid           | 150 PV                                                                            |

### 14.3 Énergie

| Élément                                          | Valeur                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Charbon / bois / fibre                           | 9 MJ / 1,8 MJ / 0,54 MJ ; deutérium et tritium 500 MJ                                                                   |
| Foreuse, fourneau                                | 90 kW                                                                                                                   |
| Générateur                                       | 900 kW de combustible → 300 kW électriques                                                                              |
| Chaudière                                        | 700 kW de combustible → 60 vapeur/s                                                                                     |
| Poteau bois / haute tension / très haute tension | 500 kW / 10 MW / 600 MW maximum par réseau ; 3 / 4 / 5 prises ; câble 8 / 20 / 40 m                                     |
| Éolienne / panneau solaire                       | jusqu'à 40 kW (15–100 % selon le vent) / jusqu'à 60 kW (selon la lumière)                                               |
| Accumulateur de base / au lithium                | 200 MJ à 400 kW / 1 GJ à 25–50 MW                                                                                       |
| Pile à combustible, fission, fusion              | 2 MW, 10 MW, 500 MW                                                                                                     |
| Borne de recharge                                | 400 kW ; batterie portable 10 niveaux de 6 s de poussée ; quad électrique 900 s de route ; locomotive électrique 180 MJ |
| Buggy / quad / camionnette / char                | 180 / 110 / 300 / 450 kW de combustible                                                                                 |

### 14.4 Pollution

Voir §9.1. Rythme d'apparition des ennemis : coût 12 (agressif 8) de pollution par ennemi, 25 maximum.

> Toutes ces valeurs sont des **points de départ** à régler en jouant (`docs/equilibrage.md`). Où régler : `content/*.json`, constantes en tête de `src/core/game/threat.ts` et `src/core/game/seasons.ts`, `BARE_HANDS_FACTOR` dans `src/render/interaction.ts`.

---

## 15. État d'avancement, feuille de route et questions ouvertes

### 15.1 Réalisé (par chantier)

- Socle, menu, paramètres (dont le préréglage graphique), monde infini par seed, caméras, éditeur de partie, sauvegardes, récolte et inventaire ✅
- Construction (pièces, étages), machines, tapis, électricité à trois niveaux (transformateur, disjoncteur, énergies renouvelables, accumulateurs), fluides et vapeur, pétrole, nucléaire, laboratoire et **arbre de 164 découvertes (T0 à T5)**, assembleur avancé ✅
- Pollution, ennemis, tourelles (cinq), **barrières et portails**, **santé et réparation des machines**, équipement, armures avec usure, **données par objet**, véhicules (dont électriques et recharge), **voies ferrées et trains** (refonte des rails), stations et pilote automatique ✅
- Jour / nuit / saisons, éclairage des lampadaires, mort et réapparition, mode Créatif (un exemplaire suffit), **multijoueur** (jusqu'à 5, coffre quantique par joueur), rapport de bug avec mesure de fluidité ✅

### 15.2 Prévu / à décider

| Sujet                                                                                                                                      | Statut                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Vrais modèles 3D** pour les objets, machines et véhicules récents, modèles portés de l'équipement (liste : `docs/objets-sans-design.md`) | ⏳ faits dans la conversation des modèles |
| **Équilibrage** global (coûts, puissances, vie, vitesses) : toutes les valeurs sont des points de départ                                   | ⏳ après la version complète du jeu       |
| **Emplacements d'amélioration** sur les machines (consommation, production, vitesse, rendement ; un objet inséré)                          | ⏳ idée validée, à concevoir              |
| **Réparer une armure** avec un kit, **usure des armes**, portails ouverts aux véhicules, chargement d'un véhicule sur un wagon plateforme  | ⏳                                        |
| **Signaux et cantons** pour les trains, rails électrifiés (la locomotive électrique ne se recharge toujours qu'à la borne)                 | ⏳                                        |
| Température, froid (dégâts sans vêtements ni armure), vent réaliste, thermomètre et girouette (§10.3)                                      | ✅ première version                       |
| **Chauffage des abris**, combustible d'hiver, pose du thermomètre contre un mur et de la girouette sur une dalle                           | ⏳                                        |
| **Succès** (désactivés en mode admin), structure de réapparition                                                                           | ⏳                                        |
| **Terrain creusable** (voxels : gisements qui descendent, renforts sous les foreuses, terrain aplani par le joueur)                        | ⏳ prévu avec la version Unreal           |
| **Version Unreal** : après une version navigateur équilibrée (la démo = la version 1 complète)                                             | ⏳                                        |
| **Mods / données externes**, **mode photo**                                                                                                | ⏳ / ❌                                   |

### 15.3 Risques

Performance (nombre de triangles du décor lointain, chunks actifs, envoi de la géométrie à la carte graphique : suivi par le rapport de bug), équilibrage global à la fin, simulation d'usine dans les zones éloignées, cohérence entre la version navigateur et l'essai Unreal, licences des assets.

### 15.4 Questions ouvertes pour le PO

1. Pour l'équilibrage : quelles valeurs fixer en premier (coûts de découvertes, puissances, vie des barrières) ?
2. Conception des **emplacements d'amélioration** : un ou plusieurs par machine, quels producteurs en premier ?
3. Que doit faire le joueur « à la fin » : au-delà du comptoir spatial, objectifs, succès ?
4. **Température** : principe décidé (§10.3 : un objet pour la voir, un vent réaliste avec girouette). Effet du froid décidé (dégâts si trop peu de vêtements ou d'armure) ; noms : thermomètre et girouette. À concevoir : chauffage des abris, combustible d'hiver, cultures, valeurs d'isolation.
5. Signalisation ferroviaire : signaux simples ou cantons complets ?

---

## 16. Glossaire et sources

| Terme          | Sens                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| **Case**       | carré de 50 × 50 cm, unité de la grille                                             |
| **Tuile**      | 2 × 2 cases : unité des tapis et des tuyaux                                         |
| **Chunk**      | 16 × 16 cases (8 m), unité de génération                                            |
| **Bloc**       | 50 cm de mur (5 par étage)                                                          |
| **Gisement**   | tas de cases de minerai                                                             |
| **Seed**       | texte qui détermine le monde                                                        |
| **Tunnel**     | tapis ou tuyau enterré entre une entrée et une sortie                               |
| **kW / MJ**    | puissance consommée / énergie d'un combustible (même base : 1 kW = 1 kJ/s)          |
| **PO**         | Product Owner (le décideur du projet)                                               |
| **Palier**     | T0 à T5 : niveau de progression d'un objet ou d'une découverte                      |
| **Découverte** | recette(s) débloquée(s) en payant des paquets de science                            |
| **Niveau**     | état d'un objet suivi (charge d'une batterie, usure d'une armure, charges d'un kit) |

**Sources de vérité** : `content/items.json`, `machines.json`, `resources.json`, `techs.json`, `buildings.json` · `src/core/` (règles) · `src/i18n/` (textes) · `docs/` (décisions détaillées : `usine.md`, `rails-refonte.md`, `multijoueur.md`, `decouvertes-t0-t5.md`, `monde.md`, `construction-refonte.md`, `usine.md`, `dimensions.md`, `equilibrage.md`, `parametres.md`, `commandes.md`, `architecture.md`, `besoins.md`, `risques.md`, `modeles.md`) · `passation.md` (journal des tours).
