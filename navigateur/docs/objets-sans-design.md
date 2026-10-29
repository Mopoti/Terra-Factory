# Commande de modèles 3D (état du tour 279)

Liste faite par script sur le jeu en marche (`content/items.json`, `content/machines.json`, `dropModels.ts`, `models.ts`). **Règle : l'icône d'inventaire et le modèle au sol sont le même modèle** (l'icône est une vue isométrique du modèle au sol ; pour une machine, de sa miniature). Donc un seul modèle à fournir par objet pour les trois usages (sol, inventaire, et posé quand c'est une machine / construction / véhicule). Les fichiers vont dans `blender/` → `export/` → `public/models/terra` (voir `blender/scripts/`). Les faces magenta des formes d'objets prennent la couleur de l'objet.

## 1. Dans le jeu, avec un modèle provisoire (à remplacer)

### 1a. Machines et constructions posées (modèle réutilisé d'une autre machine)

| Objet | Modèle provisoire | Taille (cases de 50 cm) | Remarque |
| --- | --- | --- | --- |
| Poteau haute tension (`machine_pole_hv`) | `poteau_electrique` | 2×2, haut. 6 m | Poteau haute tension : mât de 6 m, 3 bras, grands isolateurs |
| Poteau très haute tension (`machine_pole_uhv`) | `poteau_electrique` | 2×2, haut. 10 m | Poteau très haute tension : pylône de 10 m, 3 bras larges |
| Lampadaire électrique (`machine_lamp`) | `poteau_electrique` | 1×1, haut. 3 m | Lampadaire : mât 3 m avec une lampe qui s'allume la nuit (pièce lumineuse nommée `lueur`) |
| Éolienne (`machine_wind_turbine`) | `poteau_electrique` | 2×2, haut. 6 m | Éolienne : mât 6 m et rotor à trois pales qui tourne (pièce animée) |
| Transformateur (`machine_transformer`) | `accumulateur_t3` | 3×3, haut. 2.5 m | Transformateur : cuve, 3 isolateurs, ailettes |
| Disjoncteur (`machine_breaker`) | `accumulateur_t3` | 2×2, haut. 1.5 m | Disjoncteur : coffret avec levier ; deux états (fermé / ouvert) si possible |
| Panneau solaire (`machine_solar_panel`) | `accumulateur_t3` | 3×3, haut. 1.2 m | Panneau solaire : panneau incliné bleu sur pied |
| Accumulateur (`machine_accumulator_basic`) | `accumulateur_t3` | 2×2, haut. 1.0 m | Accumulateur de base : plus petit et plus simple que l'accumulateur lithium T4 |
| Assembleur avancé (T3) (`machine_assembler_advanced`) | `assembleur_t2` | 4×4, haut. 1.5 m | Assembleur avancé : variante visible de l'assembleur T2 (4 types) |
| Mur blindé, porte blindée (`piece_wall_armored`, `piece_door_armored`) | modèles de l'aluminium | comme le mur / la porte | variante blindée (plaques rivetées) |

### 1b. Objets (sac et sol) dont la forme est partagée ou provisoire

Forme actuelle → ce qu'il faudrait. Les objets marqués « provisoire » ont été ajoutés avec la forme d'un voisin.

| Objet | Forme actuelle | Il faudrait |
| --- | --- | --- |
| Tige d'aluminium (`aluminium_rod`) | forme `tige` | tige (aluminium, plus claire) |
| Châssis simple (`chassis_simple`) | forme `moteur` | petit châssis soudé |
| Châssis renforcé (`chassis_steel`) | forme `moteur` | châssis renforcé |
| Châssis léger (`chassis_alu`) | forme `moteur` | châssis léger |
| Châssis composite (`chassis_composite`) | forme `moteur` | châssis composite noir |
| Vitre (`glass`) | forme `verre` | vitre (plaque transparente) |
| Vitre blindée (`armored_glass`) | forme `verre` | vitre blindée (épaisse, croisillons) |
| Graphite (`graphite`) | forme `caillou` | bloc de graphite noir brillant |
| Sel de lithium (`lithium_salt`) | forme `sable` | tas de sel blanc-rosé |
| Fibre de carbone (`carbon_fiber`) | forme `bobine` | rouleau de fibre noire tressée |
| Kit circuit (`kit_circuit`) | forme `puce` | petite carte avec composants |
| Kit de réparation (`repair_kit`) | forme `conteneur` | boîte à outils rouge-orange (clé, tournevis) |
| Circuit avancé (`circuit_advanced`) | forme `puce` | carte plus dense, dorée |
| Microcontrôleur (`microcontroller`) | forme `puce` | puce carrée à broches |
| Cellule photovoltaïque (`solar_cell`) | forme `plaque` | cellule bleue quadrillée |
| Filtre en graphite (`graphite_filter`) | forme `bloc` | filtre en nid d'abeille |
| Batterie lithium (`battery_lithium`) | forme `conteneur` | pile cylindrique / bloc batterie |
| Capsule de fusion (`fusion_capsule`) | forme `conteneur` | capsule sphérique brillante |
| Aimant supraconducteur (`supra_magnet`) | forme `conteneur` | aimant en U / tore supraconducteur |
| Cristal quantique (`quantum_crystal`) | forme `conteneur` | cristal violet facetté |
| Deutérium (`deuterium`) | forme `baril` | bonbonne de gaz (étiquette D) |
| Tritium (`tritium`) | forme `baril` | bonbonne de gaz (étiquette T) |
| Azote liquide (`liquid_nitrogen`) | forme `baril` | bonbonne cryogénique givrée |

### 1c. Objets qui partagent une forme sans être provisoires (à distinguer un jour)

| Forme | Objets | Proposition |
| --- | --- | --- |
| lingot | fer, cuivre, zinc, fonte, acier, aluminium, zamak | différencier l'aluminium et le zamak (teinte, marquage) |
| plaque / engrenage / bobine | moules de plaque, d'engrenage, de fil | un vrai **moule** (cadre creux) pour chacun |
| bobine | fil de cuivre, câble isolé | gaine visible sur le câble isolé |
| puce | puce de silicium, isolant plastique | l'isolant n'est pas une puce (manchon / plaque blanche) |
| science | paquets T1 à T5 et de combat (6) | **un visuel par palier** (couleur et symbole) |
| baril | vide, d'eau, de pétrole, pétrole brut | le contenu ou l'étiquette se voit |
| conteneur | uranium enrichi, appauvri, barre d'uranium, déchets nucléaires | barre (tige jaune) et fût de déchets distincts |
| bloc | béton, filtre en graphite | suffisant |

### 1d. Équipement

- **Veste** (`jacket`) : tout (modèle d'objet et modèle porté ; garde la forme de caisse).
- **Armures composite (3) et nano (5)** (casque, plastron, jambières, bottes) : modèles d'objet + portés ; elles prennent les formes des armures 2 et 4.
- **Exosquelette** (forme du pantalon) et **propulseur dorsal** (`jetpack`, forme du sac à dos) : modèles propres.
- **Modèles portés de tout l'équipement** (sac à dos, capuche, pantalon, bottes, gants, armures 1 à 5, veste) : sur le personnage ce sont encore des boîtes colorées (`refreshWorn` dans `gameView.ts`).

### 1e. Rails (nouvelle géométrie du tour 255 et suivants)

Le droit cardinal et la rampe ont leur modèle ; la **courbe 45° (rayon 8,75 m)**, le **droit en diagonale (3,54 m)** et le **croisement en diagonale** sont dessinés par une forme simple (`addProcedural`). À modéliser : rail courbe, rail diagonal, éventuellement aiguillage visuel.

## 2. Pas encore dans le jeu (chantiers en cours ou prévus)

Aucun design n'existe. Dimensions indicatives ; à confirmer avec le PO.

| Objet | Genre | Ce qu'il faut | Notes |
| --- | --- | --- | --- |
| Clôture en bois | construction | modèle de pièce 1,5 m (non franchissable) | un par palier : bois, béton, béton armé |
| Barrière en béton | construction | pièce 1,5 m | vie et usure : prévoir 3 états abîmés |
| Barrière en béton armé | construction | pièce 1,5 m | idem |
| Portails (bois, béton, béton armé) | construction | portail de 3 m, ouvert et fermé | mode automatique du béton armé : moteur visible |
| Barrière holographique + portail holographique | construction | mur de lumière 1,5 m / 3 m (T5) + projecteur | énergie continue |
| Projecteur de mur holographique | machine | modèle posé |  |
| Quad électrique | véhicule | modèle posé (variante du quad) | batterie visible |
| Locomotive électrique | véhicule | modèle posé (variante de la locomotive) | pantographe / batterie |
| Wagon plateforme | véhicule | modèle posé | plat, pour charger un véhicule |
| Batterie portable | objet | modèle au sol / icône | pile de poche ; jauge de charge sur l'icône (prévoir une barre en superposition) |
| Borne de recharge | machine | modèle posé | place pour un véhicule / le propulseur |
| Compresseur d'air | machine | modèle posé |  |
| Purificateur d'air | machine | modèle posé |  |
| Bras industriel | machine | modèle posé | bras robotique grand format |
| Foreuse à plasma | machine | modèle posé | variante de la foreuse |
| Électrolyseur | machine | modèle posé |  |
| Fabricateur universel | machine | modèle posé | T5 |
| Pile à combustible | machine | modèle posé |  |
| Coffre quantique | machine | modèle posé | T5 |
| Tourelle à rail | machine | modèle posé |  |

## 3. Résumé

- **Priorité (vu en jeu tout de suite)** : modèles portés de l'équipement, veste, paquets de science par palier, moules, nouveaux rails (courbe, diagonale).
- **Provisoires à remplacer** : 9 machines / constructions (1a), 23 objets (1b), armures 3 et 5, exosquelette, propulseur.
- **Nouveaux chantiers** : barrières et portails, véhicules et loco électriques, batterie portable, 11 machines.
