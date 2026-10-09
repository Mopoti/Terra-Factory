# Terra Factory — Game Design Document (GDD)

> **Statut** : document de référence vivant, rédigé à partir de l'état réel du jeu (données `content/*.json`, code `src/`, documents `docs/`) au **Tour 83**.
> **Langue** : français. **Public** : le Product Owner (PO), les développeurs et les artistes qui rejoindront le projet.
> **Règle d'or** : en cas de contradiction, **les fichiers de données et le code font foi** ; ce GDD est mis à jour à chaque fin de session avec `passation.md`.
> Les tableaux de chiffres (objets, machines, technologies) sont **générés depuis `content/*.json`**.
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
8. Technologies et recherche
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
5. **Tout est donnée** : objets, machines, ressources, technologies, pièces de construction dans des fichiers JSON ; textes en fichiers de traduction (fr/en) ; aucune valeur d'équilibrage en dur dans le code quand c'est évitable.
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
        └──────────────► Rechercher (technologies) ◄── Paquets de science ◄── Assembler ◄──────┘
```

### 2.2 Phases de progression (parcours type)

| Phase                              | Objectif                                              | Ce que le joueur débloque / fait                                                      |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **0. Survie à mains nues**         | Récolter bois, pierre, fibres (récolte ×3 plus lente) | Sac, fabrication à la main, premier outil                                             |
| **1. Outillage**                   | Outil en pierre puis en fer                           | Récolte plus rapide (×2 puis ×3,5), 2 unités par coup avec le fer                     |
| **2. Premières machines**          | Foreuse + fourneau au combustible                     | Minerais → lingots sans effort manuel ; coffres                                       |
| **3. Logistique**                  | Tapis, bras, séparateurs, groupeurs, tunnels, niveaux | Technologie _Logistique_ (20 lingots de fer)                                          |
| **4. Électricité**                 | Générateur, poteaux, foreuse électrique, laboratoire  | Technologie _Électricité_ ; la **pollution** devient un enjeu                         |
| **5. Recherche et automatisation** | Paquets de science → laboratoires                     | _Automatisation_ : assembleur, bras électrique ; fabrication automatique              |
| **6. Vapeur**                      | Pompe, tuyaux (enterrables), chaudières, turbines     | Électricité « propre » en infrastructure, mais grosse source de pollution (chaudière) |
| **7. Défense et expansion**        | Pistolet, tourelles, buggy, destruction des nids      | _Défense_, _Navigation_ ; contrôle de la pollution                                    |

### 2.3 Conditions de fin

Pas de victoire scriptée à ce stade : **bac à sable** avec progression technologique. ⏳ Objectifs / succès à définir (voir §15) ; le drapeau « admin » (mode débogage utilisé) est déjà enregistré pour désactiver les futurs succès.

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

> Tour 85 : les ressources suivent désormais la refonte (voir `docs/refonte-objets.md`). Zinc, bauxite, quartz et uraninite se récoltent mais n'ont pas encore d'usage (fonderie : point 3). **Ponts** : une dalle de sol posée sur l'eau la rend praticable (marche, tapis, tuyaux, poteaux).

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

### 4.1 Caractéristiques de base ✅

| Caractéristique      | Valeur                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Taille / rayon       | 1,70 m / 25 cm                                                                                                    |
| Marche               | 4,5 m/s                                                                                                           |
| Sprint (Maj)         | ×1,7                                                                                                              |
| Accroupi (Ctrl)      | oui                                                                                                               |
| Saut                 | 7 m/s, gravité 22 m/s² → **≈ 1,1 m** : **2 blocs de mur empilés (1 m) se montent d'un saut**, 3 blocs (1,5 m) non |
| Marche (sans sauter) | jusqu'à 35 cm (dalle de sol, marche d'escalier de 50 cm sur sa longueur)                                          |
| Santé                | 100 PV ; récupération de 4 PV/s après 5 s sans dégât                                                              |
| Portée d'action      | 3 m (récolte, ramassage) ; 6 m (construction)                                                                     |
| Buggy                | ×2,6 la marche, voir §4.8                                                                                         |

Il n'y a **ni niveaux ni points d'expérience** : le personnage progresse par ses **outils, son équipement et les technologies** débloquées.

### 4.2 Vues ✅

- **1ʳᵉ personne**, **3ᵉ personne** (caméra à distance réglable, collision caméra), **vue du dessus** (inclinaison, zoom, rotation libre / par pas de 90° / bloquée, défilement par les bords). Touche **V** pour alterner, ou touches dédiées.
- Chaque vue a ses réglages (FOV, sensibilité, mouvement de tête, réticule, épaule…).
- **Aura de transparence** : le personnage devient visible à travers un obstacle **uniquement s'il y a quelque chose entre lui et la caméra** (pièce de construction, machine, tronc).
- **Masquage des étages** au-dessus du joueur quand il est dans une pièce fermée.

### 4.3 Santé, mort et réapparition ✅

- La barre de santé est **masquée par défaut** (réglage « Afficher la barre de santé ») ; la **rougeur des bords de l'écran** indique la gravité des dégâts.
- À **0 PV** : le joueur est assommé ; **son corps reste sur place** (capsule grise couchée) **avec tout ce qu'il portait** (sac, équipement) ; il réapparaît au **dernier duvet ou lit posé**, sinon au **premier point** (départ de la partie), **les mains vides**.
- Le corps est visible **sur la carte (✝, ainsi que ⚑ lit et ⚐ duvet)** et, si la technologie **Navigation** est recherchée, **repéré sur la boussole** (✝ ; flèche ◄✝ / ✝► s'il est hors du champ). Un nouveau corps remplace l'ancien.
- **Récupération** : près du corps (2,5 m), **F** reprend l'équipement et le contenu d'un coup (dans la limite de la place du sac ; le reste attend sur le corps).
- **Réapparition** : **duvet d'exploration** (usage unique, détruit après la réapparition) ou **lit** (permanent), posés au clic ; le dernier posé compte. Maj + F les range.

### 4.4 Sac à dos et inventaire ✅

- Base : **30 cases**, piles de **100** maximum, limite de **50 kg et 60 L** (poids ET volume).
- Les **objets équipés quittent le sac**. Un sac à dos équipé ajoute +10 cases, +20 kg, +30 L.
- Gestes de souris unifiés (sac, coffres, machines, buggy) : clic = pile au curseur ; clic droit = la moitié ; **Ctrl** = quantité choisie ; **Maj** = transfert direct vers/depuis le sac ; glisser hors de la fenêtre = jeter ; glisser sur la barre = raccourci.
- Un objet **posable** peut rester « en main » à la fermeture du sac ; clic droit mains vides = vider les mains.
- **Fabrication à la main** (dans le sac) par onglets : _Machines_, _Ustensiles_, _Constructions_, _Équipements_. Seuls les objets **débloqués** (technologie) sont fabricables ; les matières premières ne figurent pas dans le panneau.
- **Barre de raccourcis** (touches 1 à 9) et **case d'outils** dédiée.

### 4.5 Outils et récolte ✅

- **À mains nues**, la récolte est **×3 plus lente**.
- L'outil se place dans la **case d'outils** (il n'apparaît dans les mains que pendant l'action) :

| Outil           | Vitesse de récolte | Unités par coup | Recette                      |
| --------------- | ------------------ | --------------- | ---------------------------- |
| Outil en pierre | ×2                 | 1               | 6 × bois + 4 × pierre        |
| Outil en fer    | ×3,5               | 2               | 6 × lingot de fer + 4 × bois |

- **Récolte** : maintenir le clic sur un arbre, un rocher, un buisson, une case de minerai, ou ramasser un objet au sol ; la vitesse dépend de la ressource (§3.3) et de l'outil.
- **Démolition** : clic droit maintenu (en chaîne).

### 4.6 Équipement ✅

Cinq emplacements : **Tête, Tronc, Mains, Jambes, Pieds** ; s'équipe par glisser-déposer ou sélection puis clic ; mis à jour visuellement sur le personnage (formes simples provisoires).

| Équipement | Emplacement | Recette              | Effet                      |
| ---------- | ----------- | -------------------- | -------------------------- |
| Sac à dos  | Tronc       | 12 × tissu           | +10 cases, +20 kg, +30 L   |
| Capuche    | Tête        | 6 × tissu            | cosmétique (effet à venir) |
| Pantalon   | Jambes      | 8 × tissu            | cosmétique (effet à venir) |
| Bottes     | Pieds       | 6 × tissu + 2 × bois | cosmétique (effet à venir) |
| Gants      | Mains       | 4 × tissu            | cosmétique (effet à venir) |

Tous se fabriquent à partir de **tissu** (8 fibres par tissu, technologie _Textile_). Seul le sac à dos agit pour l'instant ; les autres vêtements sont cosmétiques (effets prévus avec la refonte : protection, endurance…) ⏳.

### 4.7 Armes ✅

- **Pistolet** (16 lingots de fer) : 10 dégâts par tir (rayon, portée 40 m), cadence 0,35 s ; **chargeur** (4 lingots de fer) = **12 balles** ; recharge avec **R**. Tracé de tir visible, bruitages.
- **Corps à corps** (sans pistolet) : 12 dégâts, portée 2,6 m.
- Le pistolet de la case d'outils ne sort que pendant l'action de tir. Les **nids** encaissent aussi les tirs (§9).

### 4.8 Le buggy ✅

- Véhicule posé dans le monde (**24 fer + 8 cuivre + 6 bois**, 30 kg), monté avec **F**, rangé avec **Maj + F**.
- **Vitesse ×2,6** la marche ; consomme **180 kW** de combustible (un charbon = 50 s de route) ; **sans carburant il ne bouge plus**.
- Possède une **case de carburant** et un **coffre** (fenêtre ouverte par clic sur le buggy ou touche inventaire au volant) ; il puise d'abord dans sa case, puis son coffre, puis le sac.
- Il peut **écraser les ennemis** (cooldown). Position, orientation, carburant et contenu sont sauvegardés.

---

## 5. Les objets

Tout objet a un **identifiant texte stable** (ex. `iron_ingot`), un **poids**, un **volume**, éventuellement une **recette**, une **énergie de combustion**, un **emplacement d'équipement** ou un **effet d'outil**. Source : `content/items.json`.

> 🔶 **Refonte annoncée** : le PO prévoit une **grosse refonte des objets** (poids, volumes, énergies, recettes, catalogue). Les valeurs ci-dessous sont celles d'aujourd'hui, **à ne pas équilibrer avant cette refonte**.

### 5.1 Matières premières et combustibles

| Objet             | Poids   | Volume | Énergie (combustible) | Obtention |
| ----------------- | ------- | ------ | --------------------- | --------- |
| Bois              | 0,8 kg  | 3 L    | 1,8 MJ                | récolte   |
| Pierre            | 1,2 kg  | 0,6 L  | —                     | récolte   |
| Minerai de fer    | 0,4 kg  | 0,3 L  | —                     | récolte   |
| Minerai de cuivre | 0,45 kg | 0,3 L  | —                     | récolte   |
| Charbon           | 0,25 kg | 0,3 L  | 9 MJ                  | récolte   |
| Fibre             | 0,05 kg | 0,3 L  | 0,54 MJ               | récolte   |

**Énergie des combustibles** : exprimée en **mégajoules (MJ) par unité** ; les machines à combustible ont une consommation en **kilowatts (kW = kJ/s)** dans la même unité (§7.6). Un charbon (9 MJ) fait tourner une foreuse (90 kW) 100 s ; le bois (1,8 MJ) 20 s. Le bois est volontairement faible (valeur de jeu, non réaliste) en attendant la refonte.

### 5.2 Produits intermédiaires

| Objet             | Poids   | Volume | Recette                                  |
| ----------------- | ------- | ------ | ---------------------------------------- |
| Lingot de fer     | 0,35 kg | 0,15 L | fonte au fourneau                        |
| Lingot de cuivre  | 0,4 kg  | 0,15 L | fonte au fourneau                        |
| Tissu             | 0,1 kg  | 0,3 L  | 8 × fibre                                |
| Paquet de science | 0,1 kg  | 0,2 L  | 2 × lingot de fer + 2 × lingot de cuivre |
| Boussole          | 0,2 kg  | 0,2 L  | 2 × lingot de fer + 1 × lingot de cuivre |

- **Fourneau** (recette choisie dans la fenêtre) : lingots de fer (2 hématite + 1 charbon, 2 s), **fonte** (2 hématite + 3 charbon, 4 s), lingots de cuivre (2 malachite, 3 s) ; moules en fonte (plaque, engrenage, fil). **Estampeuse** (moule exigé, 8 cycles) : plaque de fer, engrenage, fil de cuivre. Détail : `docs/refonte-objets.md` §3.
- Le **paquet de science** se fabrique à la main ou à l'assembleur ; il alimente les laboratoires (§8).

### 5.3 Pièces de construction

| Pièce              | Poids  | Volume | Recette    |
| ------------------ | ------ | ------ | ---------- |
| Mur en bois        | 1,0 kg | 1,0 L  | 2 × bois   |
| Porte en bois      | 4,0 kg | 4,0 L  | 8 × bois   |
| Porte en pierre    | 4,0 kg | 4,0 L  | 8 × pierre |
| Mur en pierre      | 1,0 kg | 1,0 L  | 2 × pierre |
| Escalier en bois   | 1,5 kg | 1,5 L  | 4 × bois   |
| Escalier en pierre | 1,5 kg | 1,5 L  | 4 × pierre |
| Dalle en bois      | 1,0 kg | 1,0 L  | 2 × bois   |
| Dalle en pierre    | 1,0 kg | 1,0 L  | 2 × pierre |

### 5.4 Machines (objets à poser)

Les objets-machines et leurs coûts figurent au §7.1.

### 5.5 Autres objets

| Objet                | Poids  | Volume | Recette                                              |
| -------------------- | ------ | ------ | ---------------------------------------------------- |
| Pistolet             | 1,1 kg | 1,2 L  | 16 × lingot de fer                                   |
| Chargeur (12 balles) | 0,3 kg | 0,3 L  | 4 × lingot de fer                                    |
| Buggy                | 30 kg  | 40 L   | 24 × lingot de fer + 8 × lingot de cuivre + 6 × bois |

### 5.6 Catégories de fabrication

`Machines` (tout objet `machine_*` et le buggy), `Ustensiles` (le reste), `Constructions` (`piece_*`), `Équipements` (objets portables). La catégorie est déduite par `categoryOf()` ; les noms d'onglets sont dans `craft.cat.*`.

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

Les emprises sont données en cases (largeur × profondeur, orientation 0) ; la rotation par pas de 90° échange les deux. Les **machines non linéaires** peuvent se poser **à l'étage** sur une dalle (PageUp).

| Machine                   | Emprise (cases) | Hauteur | Coût                                                   | Énergie                      |
| ------------------------- | --------------- | ------- | ------------------------------------------------------ | ---------------------------- |
| Foreuse                   | 4×4             | 1,5 m   | 6 × lingot de fer + 6 × pierre                         | brûle 90 kW                  |
| Fourneau                  | 3×3             | 1,0 m   | 10 × pierre                                            | brûle 90 kW                  |
| Tapis roulant             | 2×2             | 0,15 m  | 2 × lingot de fer                                      | —                            |
| Coffre en bois            | 2×2             | 0,5 m   | 16 × bois                                              | —                            |
| Coffre en fer             | 2×2             | 0,5 m   | 16 × lingot de fer                                     | —                            |
| Générateur à combustible  | 3×3             | 1,0 m   | 12 × lingot de fer + 12 × pierre                       | produit 300 kW, brûle 900 kW |
| Poteau électrique         | 2×2             | 3,5 m   | 2 × lingot de fer + 4 × bois                           | —                            |
| Foreuse électrique        | 4×4             | 1,5 m   | 12 × lingot de fer + 8 × lingot de cuivre + 4 × pierre | consomme 90 kW               |
| Séparateur                | 2×2             | 0,5 m   | 10 × lingot de fer                                     | —                            |
| Groupeur                  | 2×2             | 0,5 m   | 10 × lingot de fer                                     | —                            |
| Bras robotique            | 2×2             | 0,5 m   | 12 × lingot de fer                                     | brûle 20 kW                  |
| Bras robotique électrique | 2×2             | 0,5 m   | 12 × lingot de fer + 6 × lingot de cuivre              | consomme 20 kW               |
| Assembleur                | 3×3             | 1,0 m   | 24 × lingot de fer + 12 × lingot de cuivre             | consomme 60 kW               |
| Laboratoire               | 3×3             | 1,0 m   | 20 × lingot de fer + 16 × lingot de cuivre             | consomme 30 kW               |
| Tuyau                     | 2×2             | 0,5 m   | 2 × lingot de fer                                      | —                            |
| Pompe à eau électrique    | 2×2             | 1,0 m   | 10 × lingot de fer + 6 × lingot de cuivre              | consomme 20 kW               |
| Chaudière                 | 3×3             | 1,5 m   | 20 × lingot de fer + 10 × pierre                       | brûle 700 kW                 |
| Turbine à vapeur          | 3×4             | 1,0 m   | 24 × lingot de fer + 16 × lingot de cuivre             | produit 200 kW               |
| Tourelle automatique      | 3×2             | 1,0 m   | 16 × lingot de fer + 6 × lingot de cuivre              | —                            |

Fonctionnement résumé :

- **Foreuse** (à combustible ou électrique) : mine les cases de minerai sous elle (4 × 4), stocke jusqu'à 100 unités ; sa **sortie** est devant, le combustible entre derrière.
- **Fourneau** : une entrée (minerai), un combustible, une sortie ; **un seul minerai à la fois**.
- **Coffres** : 16 cases (bois), 32 cases (fer).
- **Assembleur** : on choisit la **recette** (n'importe quel objet à recette : tapis, bras, coffres, pièces…) ; consomme les ingrédients amenés par tapis/bras ; 2 s par cycle ; 60 kW.
- **Laboratoire** : consomme des paquets de science pour étudier une technologie ; 30 kW, **5 s par paquet** (barre de progression dans la fenêtre), stock de 20 paquets ; les technologies _Recherche T1 à T4_ retirent 1 s par niveau aux paquets des paliers 1 à n (T1 : 4 s ; T2 : T1 3 s, T2 4 s ; T3 : 2/3/4 s ; T4 : 1/2/3/4 s). Le paquet de combat reste à 5 s.
- **Poteau** : porte le courant (câble de **8 m**, raccord machine à **4 m**).
- **Tourelle** : voir §9.4.
- Chaque machine affiche un **état** (en marche, arrêt, panne de combustible, pas de courant, pas d'eau, plein, pas d'étude, etc.) et une infobulle de diagnostic quand on la vise.

### 7.2 Transport : tapis, bras, séparateurs ✅

- **Tapis** : tuile 2 × 2, **0,75 case/s**, **6 objets par tuile**, hauteur 15 cm. Le joueur peut **marcher dessus** et est **emporté** (×2 la vitesse des objets).
- **Formes** (`LIFTS`) : plat, **rampes** 0 → 1 m → 2 m (toutes à **45°**), **niveaux surélevés** (1 m et 2 m ; le joueur passe sous le niveau 2), **descentes**, **tunnels** (entrée PageDown / sortie PageUp, jusqu'à **8 tuiles**, objets invisibles entre les deux, on peut construire par-dessus).
- **Tracé** : maintenir le clic et tracer pose plusieurs tuiles ; chaque élément s'oriente vers le suivant. PageUp/PageDown en traçant monte/descend d'un niveau ; sur un patron seul, il l'incline (haut / plat / bas).
- **Séparateur** : 1 entrée, 3 sorties (devant, gauche, droite). **Groupeur** : 3 entrées, 1 sortie. Ils se posent **sur un tapis** et le remplacent.
- **Bras** (à combustible ou électrique) : prend sur 3 côtés (derrière, gauche, droite) et dépose devant ; cycle de 0,9 s (0,45 s en électrique). Un bras à combustible se réapprovisionne seul s'il y en a à côté.
- **Flèches au sol** (relevées à 20 cm) : **orange** = sortie, **bleu** = entrée ; **eau en bleu, vapeur en blanc, charbon en noir** sur la chaudière.
- Les machines **touchant** le côté d'entrée/sortie se raccordent (décalage libre, pas de grille imposée).

### 7.3 Électricité ✅

- **Production** : générateur (300 kW), turbine (200 kW). **Réseau** : poteaux reliés par câbles visibles ; machines raccordées par poteau.
- **Consommateurs** : foreuse électrique (90 kW), bras électrique (20 kW), assembleur (60 kW), laboratoire (30 kW), pompe (20 kW).
- **Satisfaction** : si la demande dépasse la capacité, toutes les machines du réseau ralentissent proportionnellement (facteur de puissance). Sans courant, une machine est à l'arrêt (la pompe tourne à 20 % pour amorcer).
- Les générateurs ne brûlent que **la part de leur capacité demandée** (charge).
- Aucune batterie ni panneau solaire pour l'instant ⏳.

### 7.4 Fluides et vapeur ✅

- **Eau et vapeur** circulent par **équilibrage des niveaux** entre machines raccordées (le débit dépend de l'écart de pression : un long tuyau perd en débit). Un **tuyau ne porte qu'un fluide à la fois**.
- **Pompe** : au bord d'un étang (sa ligne de sortie sur la terre, l'autre dans l'eau), 100 eau/s, 20 kW.
- **Tuyaux** : 2 × 2, posés en traçant ; **enterrables comme les tapis** (PageDown = entrée de tunnel, PageUp = sortie, jusqu'à 8 tuiles ; on peut construire par-dessus).
- **Chaudière** (3 × 3) : **eau par les deux côtés** (elle **traverse** : chaînage de plusieurs chaudières, chaque côté entre et sort), **combustible derrière** (tapis/bras), **vapeur devant**. 60 vapeur/s à pleine chauffe (réserve 200), 700 kW de combustible, 2 pollution/s.
- **Turbine** (3 largeur × 4 longueur) : vapeur en entrée derrière, **le reste ressort devant** pour la turbine suivante ; rendement 0 sous 20 % de pression, plein à 60 % ; 20 vapeur/s ; en file indienne, la pression baisse le long de la file. Une chaudière ≈ 3 turbines.
- Fumée blanche animée sur les turbines en marche.

### 7.5 Pollution et machines

Voir §9.1.

### 7.6 Énergie de combustion ✅ (Tour 83)

- Items : **énergie en MJ par unité**. Machines : **`burnKw` en kW** (kJ/s) à pleine charge. `fuelLeft` est en **kJ**.
- Valeurs : foreuse 90 kW, fourneau 90 kW, bras 20 kW, **générateur 900 kW** (→ 300 kW électriques, rendement ≈ 33 %), **chaudière 700 kW** (→ 600 kW de vapeur, rendement ≈ 86 %), buggy 180 kW.
- Les infobulles montrent l'énergie des objets et la consommation des machines ; le temps restant est calculé à pleine charge.

### 7.7 Poser et déplacer

Une machine se pose en **un clic**, la touche R la tourne ; **même case = ranger** (la machine revient au sac avec ses contenus). Les tapis et tuyaux peuvent chevaucher partiellement une machine (une case au moins visible). Les machines à l'étage exigent une dalle sous chacune de leurs cases.

---

## 8. Technologies et recherche

### 8.1 Principe ✅

Un objet qui n'appartient à aucune technologie est disponible dès le départ. Les autres exigent la technologie qui les débloque (fabrication à la main ou à l'assembleur). Fenêtre **Technologies (T)** : une carte par technologie (coût, prérequis, déblocages).

### 8.2 Deux modes de recherche

- **À la main** : le coût (objets du sac) est consommé immédiatement.
- **En laboratoire** : le coût est en **paquets de science** ; on choisit la technologie étudiée ; un laboratoire alimenté (tapis, bras ou main) et en courant consomme les paquets (5 s chacun, moins avec les technologies Recherche) ; **sans étude choisie, les laboratoires étudient automatiquement** la première technologie disponible. L'avancement est sauvegardé.

### 8.3 Arbre actuel

| Technologie    | Coût                                                     | Prérequis               | Débloque                                                                     |
| -------------- | -------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Logistique     | 20 × lingot de fer                                       | —                       | Séparateur, Groupeur, Coffre en fer, Bras robotique                          |
| Textile        | 30 × fibre                                               | —                       | Tissu, Sac à dos, Capuche, Pantalon, Bottes, Gants                           |
| Électricité    | 30 × lingot de fer + 20 × lingot de cuivre               | —                       | Poteau électrique, Générateur à combustible, Foreuse électrique, Laboratoire |
| Automatisation | 20 × paquet de science                                   | Électricité, Logistique | Bras robotique électrique, Assembleur                                        |
| Vapeur         | 30 × lingot de fer + 15 × lingot de cuivre + 10 × pierre | Électricité             | Tuyau, Pompe à eau électrique, Chaudière, Turbine à vapeur                   |
| Navigation     | 10 × lingot de fer + 5 × lingot de cuivre                | —                       | Boussole                                                                     |
| Défense        | 30 × lingot de fer + 10 × lingot de cuivre               | Logistique              | Tourelle automatique                                                         |

Le tableau complet et le détail de l'arbre se trouvent dans `content/techs.json`. **La boussole** de l'interface n'apparaît qu'une fois _Navigation_ recherchée. ⏳ Les technologies seront étendues avec la refonte des objets.

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

3 × 2 cases, 16 fer + 6 cuivre, technologie _Défense_. **Portée 22 m, 9 dégâts toutes les 0,6 s**, utilise des **chargeurs** (12 balles ; stock de 20) amenés par tapis, bras ou main ; tire sur l'ennemi le plus proche.

### 9.5 Attaque des installations

Les ennemis détruisent les machines polluantes (120 PV) ; une machine détruite par les ennemis disparaît avec son contenu (contrairement à la démolition volontaire, qui rend tout au joueur). ⏳ Réparation, murs défensifs, vagues, loot.

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

---

## 11. Interface, commandes et paramètres

### 11.1 Écrans ✅

- **Menu d'accueil** : _Continuer_ (nom de la partie + date de sa dernière sauvegarde), _Nouvelle partie_, _Charger une partie_, _Paramètres_, _Quitter_ (masqué en version web).
- **Éditeur de partie** : nom, seed (avec mélange aléatoire), curseurs des familles du monde, options ennemis, réalisme, **jour/nuit/saisons + camembert**.
- **Gestion des parties** : charger, renommer, dupliquer, supprimer ; une partie = un dossier de sauvegardes manuelles et automatiques.
- **En jeu** : barre de raccourcis, case d'outils, fenêtre de sac / fabrication / équipement, fenêtres de machines, de coffres et du buggy, **carte (M)**, **technologies (T)**, **pause (Échap)**, aides de construction à l'écran, notifications.

### 11.2 Mode débogage (F9) ✅

Touche **F9** (F3 est la recherche du navigateur) : affiche les **boîtes autour de la cible**, le **panneau d'infos** (seed, saison, vue, position, chunk, biome, chunks chargés, appels de dessin, repères de départ), le **compteur d'images/s** et le **cadre « Partie / Sac / Menu »** (cachés sinon). Utilisable en toute partie ; **au premier usage la partie est marquée « admin »** (`changes.admin`) : les futurs succès seront désactivés pour cette partie.

### 11.3 Boussole ✅

Bandeau avec cap en degrés, **débloquée par la technologie Navigation** ; affiche aussi le repère du corps du joueur.

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
| Inventaire / carte / technologies                          | Tab ou I / M / T                         |
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

- **Affichage** : langue (français / anglais), plein écran, gamma, luminosité, distance d'affichage (2–16 chunks, défaut 8), qualité (basse / moyenne / haute), ombres (désactivées / normales / détaillées), limite d'images/s (30 / 60 / 120 / illimité), taille de l'interface (80–150 %), **unités** (distance m/ft, température °C/°F/K, masse kg/lb, pression Pa/bar/psi, énergie J·W / kWh), format de l'heure, **daltonisme**, afficher les FPS, **afficher la barre de santé** (non par défaut).
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

⏳ Types de partie **créatif / survie**, difficulté, multijoueur on/off, état initial du joueur : « on en reparlera bientôt » (PO).

### 12.2 Sauvegarde ✅

- Une **partie** contient plusieurs **sauvegardes** (manuelles et automatiques) pour revenir loin en arrière sans perdre les anciennes.
- Ce qui est enregistré : joueur (position, orientation, vue, hauteur), **sac**, et tous les **changements du monde** : ressources prélevées, objets au sol, pièces de construction, machines (contenu, combustible, fluides, tapis), équipement, technologies, recherche en cours, pollution (air et sol), **ennemis**, **temps de jeu**, véhicules, munitions, **corps et point de réapparition**, barre de raccourcis et d'outils.
- **Format versionné avec migrations** (ids texte stables, versions d'emprise des machines et d'unité d'énergie) : une ancienne sauvegarde se charge dans une version plus récente.
- Stockage : navigateur (**IndexedDB**, repli sur localStorage puis mémoire) ; **export / import de fichier** disponibles ✅ ; dossier sur disque / version bureau plus tard ⏳.

---

## 13. Architecture technique (résumé)

- **Séparation stricte** : `src/core` (règles, sans affichage ni navigateur ; testé), `src/render` (Three.js : scène, caméras, chunks, machines), `src/ui` (menus, fenêtres), `src/i18n`, `src/settings`. Contenu dans `content/*.json`.
- **Monde** : grille à deux niveaux (cases logistiques de 50 cm + pas fin de 10 cm), positions en **entiers**, chunks générés à la demande et mis en cache ; maillage fusionné et **instancié** pour la performance.
- **Simulation** : déterministe côté génération ; la simulation d'usine avance avec le temps réel de l'image (pas variable, plafonné à 0,5 s) 🔶 — la décision de cadrage d'un **pas fixe à 20 ticks/s** reste à implémenter avec le multijoueur.
- **Commandes** : les actions du joueur passent par l'état de jeu (`GameState`) qui émet des événements ; base du futur multijoueur et de l'annulation.
- **Unités SI** en interne ; conversion à l'affichage selon les paramètres.
- **Tests** : Vitest (≈ 350 tests : génération, physique, construction, usine, fluides, ennemis, sauvegarde, saisons) + vérifications navigateur (Playwright/Chromium) sur scènes injectées.
- **Déploiement** : Vercel, branche de travail ; aperçu en ligne à chaque push.

---

## 14. Tableaux d'équilibrage

### 14.1 Cadences

| Élément               | Valeur                                 |
| --------------------- | -------------------------------------- |
| Foreuse à combustible | 0,5 minerai/s (1 toutes les 2 s)       |
| Foreuse électrique    | 0,75 minerai/s (1 toutes les 1,33 s)   |
| Fourneau              | 1 lingot / 3 s (≈ 1,5 foreuse brûleur) |
| Tapis                 | 0,75 case/s, 6 objets par tuile        |
| Bras                  | 0,9 s / geste (0,45 s électrique)      |
| Assembleur            | 2 s / cycle                            |
| Laboratoire           | 5 s / paquet de science (4 → 1 s avec Recherche) |
| Pompe                 | 100 eau/s                              |
| Chaudière             | 60 vapeur/s                            |
| Turbine               | 200 kW pour 20 vapeur/s                |

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

| Élément                | Valeur                                     |
| ---------------------- | ------------------------------------------ |
| Charbon / bois / fibre | 9 MJ / 1,8 MJ / 0,54 MJ                    |
| Foreuse, fourneau      | 90 kW                                      |
| Bras à combustible     | 20 kW                                      |
| Générateur             | 900 kW de combustible → 300 kW électriques |
| Chaudière              | 700 kW de combustible → 60 vapeur/s        |
| Buggy                  | 180 kW                                     |

### 14.4 Pollution

Voir §9.1. Rythme d'apparition des ennemis : coût 12 (agressif 8) de pollution par ennemi, 25 maximum.

> Toutes ces valeurs sont des **points de départ** à régler en jouant (`docs/equilibrage.md`). Où régler : `content/*.json`, constantes en tête de `src/core/game/threat.ts` et `src/core/game/seasons.ts`, `BARE_HANDS_FACTOR` dans `src/render/interaction.ts`.

---

## 15. État d'avancement, feuille de route et questions ouvertes

### 15.1 Réalisé (par chantier)

- Socle, menu, paramètres, monde infini par seed, caméras, éditeur de partie, sauvegardes, récolte et inventaire (chantiers 0 à 7 du prototype) ✅
- Construction (pièces, pièces fermées, étages, aura), machines, tapis (niveaux, rampes, tunnels), électricité, laboratoire et technologies, assembleur, fluides et vapeur (tuyaux enterrables), pollution et ennemis, tourelles, véhicule (buggy), équipement et outils, jour/nuit et saisons, mort et réapparition, mode débogage ✅

### 15.2 Prévu / à décider

| Sujet                                                                                 | Statut                                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Refonte des objets** (catalogue, poids, volumes, énergies, recettes)                | 🔶 annoncée par le PO ; **à cadrer avant tout équilibrage** |
| **Multijoueur** (5 joueurs max, hôte = un joueur puis mini-serveur)                   | ⏳ **à discuter avec le PO** avant de commencer             |
| **Types de partie** (créatif / survie), difficulté                                    | ⏳ « bientôt »                                              |
| **Succès** (désactivés en mode admin)                                                 | ⏳                                                          |
| **Structure de réapparition** (lit, balise) à la place de la touche H                 | ⏳                                                          |
| **Vrais modèles 3D** et **vrais sons**                                                | ⏳ nécessite des assets (`docs/modeles.md`)                 |
| **Effets des vêtements** (protection, endurance, froid)                               | ⏳                                                          |
| **Température, chaleur, météo, chauffage des abris** (pièces fermées + saisons)       | ⏳                                                          |
| **Réalisme** (niveaux arcade / équilibré / réaliste appliqués aux systèmes physiques) | ⏳                                                          |
| **Pas fixe de simulation à 20 ticks/s**, chargeur de chunk                            | ⏳ avec le multijoueur                                      |
| **Autres véhicules** (brouette, voiture électrique, camion, train…)                   | ⏳                                                          |
| **Terrain creusable** (voxels, profondeur limitée)                                    | ❌ pour l'instant                                           |
| **Mods / données externes**, **mode photo**, **version bureau / Unity**               | ⏳ / ❌                                                     |

### 15.3 Risques

Performance (instancing, chunks actifs), ampleur de la physique réaliste (par couches, curseur de réalisme), licences des assets Unity (conversion glTF), équilibrage global après la refonte des objets, simulation d'usine dans les zones éloignées.

### 15.4 Questions ouvertes pour le PO

1. Contenu exact de la **refonte des objets** : quel catalogue, quelles familles, quelles unités de référence ?
2. Calendrier du **multijoueur** et du mode créatif / survie.
3. Souhait pour la **structure de réapparition** (lit unique ? balise multiple ? consommable ?).
4. Que doit faire le joueur « à la fin » : objectifs, succès, campagne ou bac à sable pur ?
5. Place de la **température** et des saisons dans le gameplay (chauffage, combustible d'hiver, cultures ?).

---

## 16. Glossaire et sources

| Terme        | Sens                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| **Case**     | carré de 50 × 50 cm, unité de la grille                                    |
| **Tuile**    | 2 × 2 cases : unité des tapis et des tuyaux                                |
| **Chunk**    | 16 × 16 cases (8 m), unité de génération                                   |
| **Bloc**     | 50 cm de mur (5 par étage)                                                 |
| **Gisement** | tas de cases de minerai                                                    |
| **Seed**     | texte qui détermine le monde                                               |
| **Tunnel**   | tapis ou tuyau enterré entre une entrée et une sortie                      |
| **kW / MJ**  | puissance consommée / énergie d'un combustible (même base : 1 kW = 1 kJ/s) |
| **PO**       | Product Owner (le décideur du projet)                                      |

**Sources de vérité** : `content/items.json`, `machines.json`, `resources.json`, `techs.json`, `buildings.json` · `src/core/` (règles) · `src/i18n/` (textes) · `docs/` (décisions détaillées : `monde.md`, `construction-refonte.md`, `usine.md`, `dimensions.md`, `equilibrage.md`, `parametres.md`, `commandes.md`, `architecture.md`, `besoins.md`, `risques.md`, `modeles.md`) · `passation.md` (journal des tours).
