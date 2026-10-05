# Génération du monde — proposition (chantier 3)

Statut : PROPOSITION à valider par le PO avant codage. Toutes les valeurs chiffrées sont des points de départ réglables dans des fichiers de données (`content/`), sans toucher au code.

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
