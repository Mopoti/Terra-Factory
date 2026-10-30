# Commande de modèles 3D (état du tour 280)

Liste faite sur le jeu en marche (`content/items.json`, `content/machines.json`, `dropModels.ts`, `models.ts`). **Règle : l'icône d'inventaire et le modèle au sol sont le même modèle** (l'icône est une vue isométrique du modèle au sol ; pour une machine, de sa miniature). Un seul modèle à fournir par objet pour les trois usages (sol, inventaire, posé quand c'est une machine / construction / véhicule). Les fichiers vont dans `blender/` → `export/` → `public/models/terra`. Les faces magenta des formes d'objets prennent la couleur de l'objet.

## 1. Dans le jeu avec un modèle provisoire ou dessiné par le code (à remplacer)

### 1a. Machines posées (modèle d'une autre machine réutilisé)

| Objet | Modèle provisoire | Emprise (cases de 50 cm) | Ce qu'il faut |
| --- | --- | --- | --- |
| Thermomètre (`machine_thermometer`) | `poteau_electrique` | 1×1, haut. 1.2 m | petit thermomètre à cadran sur pied, 1,3 m |
| Girouette (`machine_vane`) | `poteau_electrique` | 1×1, haut. 2.5 m | mât de 2,6 m, girouette qui tourne dans le sens du vent (pièce animée) |
| Poteau haute tension (`machine_pole_hv`) | `poteau_electrique` | 2×2, haut. 6 m | mât de 6 m, 3 bras, grands isolateurs |
| Poteau très haute tension (`machine_pole_uhv`) | `poteau_electrique` | 2×2, haut. 10 m | pylône de 10 m, 3 bras larges |
| Lampadaire électrique (`machine_lamp`) | `poteau_electrique` | 1×1, haut. 3 m | mât de 3 m, lampe qui s'allume la nuit (pièce `lueur`) |
| Éolienne (`machine_wind_turbine`) | `poteau_electrique` | 2×2, haut. 6 m | mât de 6 m, rotor à trois pales qui tourne (pièce animée) |
| Transformateur (`machine_transformer`) | `accumulateur_t3` | 3×3, haut. 2.5 m | cuve, 3 isolateurs, ailettes |
| Disjoncteur (`machine_breaker`) | `accumulateur_t3` | 2×2, haut. 1.5 m | coffret à levier ; fermé / ouvert si possible |
| Panneau solaire (`machine_solar_panel`) | `accumulateur_t3` | 3×3, haut. 1.2 m | panneau incliné bleu sur pied |
| Accumulateur (`machine_accumulator_basic`) | `accumulateur_t3` | 2×2, haut. 1.0 m | plus petit et plus simple que l'accumulateur lithium T4 |
| Borne de recharge (`machine_charger`) | `accumulateur_t3` | 3×3, haut. 1.8 m | borne avec câble et prise pour véhicule, voyant de charge |
| Assembleur avancé (T3) (`machine_assembler_advanced`) | `assembleur_t2` | 4×4, haut. 1.5 m | variante visible de l'assembleur T2 |
| Fabricateur universel (`machine_fabricator`) | `assembleur_t2` | 4×4, haut. 2.0 m | assembleur futuriste (T5), 4×4 |
| Compresseur d’air (`machine_air_compressor`) | `centrifugeuse_t4` | 3×3, haut. 1.5 m | cuve horizontale et compresseur |
| Électrolyseur (`machine_electrolyzer`) | `centrifugeuse_t4` | 3×3, haut. 1.5 m | cuves et électrodes, prise d'eau |
| Purificateur d’air (`machine_air_purifier`) | `centrifugeuse_t4` | 3×3, haut. 1.8 m | tour à filtres, aérations |
| Pile à combustible (`machine_fuel_cell`) | `generateur_combustible` | 3×3, haut. 1.4 m | empilement de cellules, réservoir de deutérium |
| Foreuse à plasma (`machine_drill_plasma`) | `foreuse_eco_t3` | 6×6, haut. 2.5 m | grande foreuse 6×6, tête à plasma |
| Bras industriel (`machine_arm_industrial`) | `bras_t3` | 2×3, haut. 1.2 m | bras robotique grand format et rapide |
| Coffre quantique (`machine_quantum_chest`) | `coffre_fer` | 2×2, haut. 0.9 m | coffre violet lumineux, motif quantique |
| Tourelle à rail (`machine_turret_rail`) | `tourelle_plasma` | 3×3, haut. 1.4 m | canon à rails long, rails visibles |

### 1b. Barrières et portails (dessinés par le code : poteaux et lisses, aucun modèle)

| Objet | Emprise | Ce qu'il faut |
| --- | --- | --- |
| Clôture en bois (`machine_fence_wood`) | 3×1, haut. 1.5 m | clôture à lattes, 1,5 m ; 3 états d'usure |
| Barrière en béton (`machine_barrier_concrete`) | 3×1, haut. 1.5 m | mur bas en béton, 1,5 m ; fissures selon l'usure |
| Barrière en béton armé (`machine_barrier_reinforced`) | 3×1, haut. 1.5 m | béton armé avec armatures apparentes ; usure |
| Portail en bois (`machine_gate_wood`) | 6×1, haut. 2.5 m | portail à deux vantaux ou coulissant, 3 m ; fermé / ouvert |
| Portail en béton (`machine_gate_concrete`) | 6×1, haut. 2.5 m | portail béton, 3 m ; fermé / ouvert |
| Portail en béton armé (moteur) (`machine_gate_reinforced`) | 6×1, haut. 2.5 m | portail blindé à moteur visible, 3 m ; ouvre seul à l'approche |
| Mur holographique (`machine_hologram_projector`) | 3×1, haut. 1.5 m | deux émetteurs et un voile de lumière, 1,5 m |
| Portail holographique (`machine_hologram_gate`) | 6×1, haut. 2.5 m | émetteurs et voile de lumière, 3 m ; ouvert / fermé |
Usure : les machines abîmées sont noircies par le code (suie par taches, fumée sous 50 %, étincelles sous 25 %) ; des modèles à états abîmés (3 niveaux) amélioreraient le rendu.

### 1c. Véhicules et matériel roulant (modèle d'un autre véhicule réutilisé)

| Objet | Modèle provisoire | Ce qu'il faut |
| --- | --- | --- |
| Quad électrique (`vehicle_quad_electric`) | `quad` | variante électrique : batterie visible, pas d'échappement |
| Locomotive électrique (`train_locomotive_electric`) | `locomotive_vapeur` | loco électrique à batterie, sans cheminée |
| Wagon plateforme (`train_wagon_flat`) | `wagon_fret` | plateau ouvert avec ridelles basses |
| Mur blindé, porte blindée | modèles de l'aluminium | variante blindée (plaques rivetées) |

### 1d. Objets (sac et sol) à forme partagée ou provisoire

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
| Batterie portable (`battery_portable`) | forme `conteneur` | pile de poche ; prévoir la zone où la jauge s'affiche sous l'icône |
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

### 1e. Formes partagées sans être provisoires (à distinguer un jour)

| Forme | Objets | Proposition |
| --- | --- | --- |
| lingot | fer, cuivre, zinc, fonte, acier, aluminium, zamak | différencier l'aluminium et le zamak |
| plaque / engrenage / bobine | moules de plaque, d'engrenage, de fil | un vrai **moule** (cadre creux) pour chacun |
| bobine | fil de cuivre, câble isolé | gaine visible sur le câble isolé |
| puce | puce de silicium, isolant plastique | l'isolant n'est pas une puce |
| science | paquets T1 à T5 et de combat (6) | **un visuel par palier** (couleur et symbole) |
| baril | vide, d'eau, de pétrole, pétrole brut | le contenu ou l'étiquette se voit |
| conteneur | uranium enrichi, appauvri, barre d'uranium, déchets nucléaires | barre (tige jaune) et fût de déchets distincts |

### 1f. Équipement

- **Veste** (`jacket`) : tout (modèle d'objet et modèle porté ; garde la forme de caisse).
- **Armures composite (3) et nano (5)** (casque, plastron, jambières, bottes) : modèles d'objet + portés ; elles prennent les formes des armures 2 et 4.
- **Exosquelette** (forme du pantalon) et **propulseur dorsal** (`jetpack`, forme du sac à dos) : modèles propres.
- **Modèles portés de tout l'équipement** (sac à dos, capuche, pantalon, bottes, gants, armures 1 à 5, veste) : sur le personnage ce sont encore des boîtes colorées (`refreshWorn` dans `gameView.ts`).

### 1g. Rails

Le droit cardinal et la rampe ont leur modèle ; la **courbe 45° (rayon 8,75 m)**, le **droit en diagonale (3,54 m)** et le **croisement en diagonale** sont dessinés par une forme simple. À modéliser : rail courbe, rail diagonal, éventuellement aiguillage visuel.

## 2. Résumé

- **Priorité (vu en jeu tout de suite)** : modèles portés de l'équipement, veste, paquets de science par palier, moules, nouveaux rails (courbe, diagonale), barrières et portails.
- **Tout le reste du contenu prévu est maintenant dans le jeu** avec un modèle provisoire (sections 1a à 1d) : il n'y a plus d'objet « prévu sans design » hors ces listes.
