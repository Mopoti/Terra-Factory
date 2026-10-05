# Génération du monde — proposition (chantier 3)

Statut : VALIDÉ par le PO (tour 8) et IMPLÉMENTÉ au chantier 3. Précisions du PO : gisements en cases de minerai de 50 × 50 cm et 10 cm de haut maximum, regroupées en tas ; chaque case contient une quantité déterminée, plus riche au centre du tas (exemple du PO : ~3 500 au centre, ~315 au bord) ; fréquence / taille / densité règlent les tas ; la seed aura une icône de mélange pour en générer. Questions 3 à 5 : CONFIRMÉES par le PO au tour 9 (étangs infranchissables ; zone de départ avec toutes les ressources et sans ennemis ; déplacement provisoire accepté). Toutes les valeurs chiffrées sont des points de départ réglables dans des fichiers de données (`content/`), sans toucher au code.

## 1. Principes
- **Seed** : n'importe quel texte (« 12345 », « mon monde »). Même texte exact = même monde, pour tous les joueurs et sur tous les appareils. Aucun `Math.random()` : un générateur pseudo-aléatoire maison, déterministe.
- **Infini** : le monde est découpé en **chunks** de 16 × 16 cases (8 m × 8 m). Un chunk est généré uniquement à partir de (seed, position du chunk), **indépendamment de l'ordre** dans lequel le joueur les découvre. On peut donc marcher dans n'importe quelle direction et revenir : on retrouve exactement la même chose.
- **Sol plat** : une seule couche utile. La structure de données garde déjà la hauteur (grille 3D) pour le terrain creusable plus tard.
- **La génération ne stocke jamais le monde entier** : le monde « d'origine » se recalcule à la demande. Une sauvegarde ne contient que ce qui a **changé** (arbre coupé, minerai épuisé, bâtiments). Sauvegardes minuscules, et compatibles avec le multijoueur.

## 2. Biomes (climat par zone)
Deux bruits très étalés (température, humidité) donnent le biome ; les transitions sont progressives (grandes zones de plusieurs centaines de mètres).
| Biome | Sol | Végétation | Pour plus tard |
|---|---|---|---|
| Prairie | vert clair | arbres épars, rochers | climat tempéré |
| Forêt | vert foncé | arbres très denses | humide |
| Désert | sable | quasi aucun arbre, beaucoup de rochers, peu d'eau | chaud et sec |
| Toundra | blanc/gris | arbres rares et petits, rochers | froid (chauffage plus cher) |
Chaque biome aura plus tard sa température moyenne et son humidité (saisons, météo).

## 3. Ressources de départ (liste initiale, extensible)
| Id (stable) | Quoi | Forme | Où |
|---|---|---|---|
| `tree` | Arbre : bois | objet isolé (1 m), forêts denses selon biome | surtout forêt/prairie |
| `rock` | Rocher : pierre | objet isolé (1 à 1,5 m) | partout, plus dans désert/toundra |
| `iron_ore` | Minerai de fer | **gisement** (plaque de cases) | tous biomes |
| `copper_ore` | Minerai de cuivre | gisement | tous biomes |
| `coal` | Charbon | gisement | tous biomes |
| `water` | Étang d'eau douce | plan d'eau plat (pompable plus tard) | surtout prairie/forêt/marais |
| `nest` | Nid d'ennemis | structure (voir chantier ennemis) | à distance du départ |
Plus tard : sable, argile, pétrole, soufre, etc. — il suffira d'ajouter une ligne dans les données.

## 4. Comment les ressources sont posées
- **Gisements (minerais, charbon)** : le monde est découpé en grandes cases-candidates (≈ 96 m). Pour chaque type de ressource, chaque case-candidate décide, par calcul déterministe, **s'il y a un gisement**, où est son centre, sa **taille** (rayon ≈ 6 à 18 m) et sa **richesse**. Le contour est irrégulier (bruit), plus riche au centre. Chaque case du gisement a une **quantité** (ex. 200 à 1500) qui diminue quand on mine.
- **Objets isolés (arbres, rochers)** : chaque case a une probabilité d'en contenir un, selon le biome et un bruit de densité (clairières, bosquets).
- **Étangs** : taches de bruit, pas de collision avec les gisements.
- **Nids** : rares, jamais près du départ ; ils forment des colonies dont la taille grossit plus tard.

## 5. Zone de départ garantie
Autour du point d'apparition (rayon ≈ 150 m) : au moins du bois, de la pierre, du fer, du cuivre, du charbon et de l'eau **à portée de marche**, aucun nid à moins de ≈ 250 m. Le monde reste différent selon la seed, mais on ne commence jamais coincé.

## 6. Réglages de la partie (écran d'édition, chantier 5)
Pour chaque famille (arbres, rochers, minerais, étangs, nids) : **fréquence**, **taille**, **densité**, chacune de ×0,25 (très peu) à ×3 (très abondant), ×1 par défaut. Le générateur les accepte dès le chantier 3 : une partie enregistre la seed ET ces réglages (la même seed avec d'autres réglages donne un monde différent).

## 7. Quantités et récolte (valeurs initiales, dans `content/resources.json`)
Arbre : 4 bois · Rocher : 20 pierre · Case de minerai : 200 à 1500 · Étang : inépuisable. À régler à l'équilibrage, pas dans le code.

## 8. Ce que le PO verra à la fin du chantier 3
- Marcher (avec **tes touches configurées**) dans un monde infini : sol coloré par biome, arbres, rochers, gisements colorés (fer, cuivre, charbon), étangs, nids (à distance).
- Des formes simples provisoires (cônes, cubes colorés) en attendant les vrais modèles.
- Un panneau d'infos (touche à basculer dans Paramètres) : seed, position, chunk, biome, nombre de chunks chargés.
- Même seed = même monde (testable en créant deux parties de même seed) ; seeds différentes = mondes différents.
- Déplacement provisoire en 3ème personne simple ; les trois vraies caméras arrivent au chantier 4.

## 9. Techniques (pour mémoire)
- Chunks chargés/déchargés autour du joueur selon la « distance d'affichage » des paramètres, avec un budget par image pour éviter les saccades.
- Objets identiques dessinés en lots (instancing) pour tenir des dizaines de milliers d'éléments.
- Tests automatiques : même seed → mêmes résultats ; indépendance de l'ordre de génération ; continuité des gisements d'un chunk à l'autre ; zone de départ toujours garantie ; densités conformes.

## Questions pour le PO
1. **Biomes** : Prairie / Forêt / Désert / Toundra pour commencer ? (reco : oui)
2. **Minerais en gisements** (plaques de cases à la Factorio, que des machines couvriront) plutôt qu'en blocs isolés à la Satisfactory ? (reco : gisements)
3. **Étangs** : non traversables à pied pour l'instant (pas de nage), pompables plus tard ? (reco : oui)
4. **Zone de départ garantie** (tous les types de ressources de base à moins de ≈ 150 m, pas de nid à moins de ≈ 250 m) ? (reco : oui)
5. **Déplacement provisoire** dans ce chantier pour pouvoir explorer ? (reco : oui)


## Implémentation (chantier 3) — ce qui a été décidé en codant
- **Quantités de minerai** : `centerAmount` 3 500 et `edgeRatio` 0,09 (donc ≈ 315 au bord) dans `content/resources.json` ; richesse du tas ±20 % (centre entre ≈ 2 800 et 4 200) ; quantités arrondies à 5. Profil : `bord + (centre − bord) × (1 − t²)` où t = distance normalisée au centre (0 centre, 1 bord), avec un contour irrégulier. Hauteur affichée de la case : 2 cm (pauvre) à 10 cm (riche).
- **Réglages** : *fréquence* = nombre de tas / bosquets / étangs / nids (taille des cases-candidates divisée par √fréquence) ; *taille* = rayon des tas, longueur d'onde des bosquets ; *densité* = quantité par case pour les minerais, arbres/rochers par emplacement dans les bosquets, probabilité d'un étang ou d'un nid par case-candidate. Limites ×0,25 à ×3.
- **Zone de départ** : climat ramené à « prairie » dans un rayon de 150 m (retour progressif jusqu'à 350 m) ; un tas de fer, cuivre, charbon et un étang garantis à 60–110 m ; rien dans les 8 m autour du point d'apparition ; aucun nid à moins de 250 m. Tests sur 10 seeds.
- **Performance** : ≈ 0,25 ms par chunk côté génération ; l'affichage fusionne chaque chunk en 2 objets 3D (sol + éléments).
- **Précision des nombres** : chaque chunk est affiché relativement à sa propre origine ; au-delà de plusieurs dizaines de km, il faudra recentrer le monde autour du joueur (à faire plus tard).
- **Hors chantier** : le joueur provisoire ne se souvient pas de sa position entre deux lancements (chantier 6).

## Ajustement au tour 9 : regroupement des arbres et des rochers
Retour du PO : « les ressources ne sont pas regroupées par tas mais complètement dispersées ». Mesures : les minerais étaient déjà en tas (7 tas, aucun fragment de moins de 10 cases) ; ce sont les **arbres et rochers** qui étaient éparpillés (jusqu'à 29 % d'objets isolés). Correction : bosquets d'arbres et affleurements de rochers très marqués (`clusterWavelengthM`, `biomeCover`, `outsideFactor` dans `content/resources.json`), plus un **bosquet et un affleurement garantis** près du départ. Après correction : 2 à 10 % d'objets isolés (test automatique < 12 % pour les arbres, < 18 % pour les rochers). Le panneau d'infos de jeu liste les positions des tas, bosquets et étangs garantis près du départ.

## Réglages de partie branchés (chantier 5)
Les trois curseurs de chaque famille agissent sur la génération comme décrit ci-dessus ; pour les ennemis, « taille » règle l'emprise des nids (4 cases = 2 m à ×1, de 2 à 12 cases). L'aperçu de l'écran d'édition utilise le même générateur que le jeu (`src/core/world/preview.ts`).
