# Objets sans design (état du tour 258)

Audit fait par script sur le jeu en marche (`content/items.json`, modèles de `public/models/terra`, `dropModels.ts`, `models.ts`) et sur les propositions de `tools/gen_decouvertes.py`. « Design » = icône 3D, modèle au sol, modèle posé (machine, construction, véhicule), modèle porté (équipement).

## Dans le jeu aujourd'hui (161 objets)

Tous les objets en jeu ont une icône et un modèle, sauf deux écarts. Les machines (48) ont un modèle Terra propre ; les convoyeurs et tuyaux ont leurs modèles par tronçons.

| Objet | Ce qui manque |
| --- | --- |
| Veste (`jacket`) | tout : icône et modèle au sol (garde la caisse), modèle porté (seulement une boîte de couleur sur le torse) |
| Tout l'équipement porté (sac à dos, capuche, pantalon, bottes, gants, armures 1, 2, 4) | **modèle porté** : sur le personnage ce sont des boîtes, sphères et cylindres colorés (`gameView.ts`, `refreshWorn`). Les objets au sol et les icônes existent. |
| Pistolet, fusil, sniper, outils de pierre et de fer | icône et modèle tenu existent (`HELD_MODELS`) ; le modèle au sol n'est pas à part |

### Objets qui partagent une forme (pas de design propre, seulement la couleur change)

| Forme | Objets | Proposition |
| --- | --- | --- |
| lingot | fer, cuivre, zinc, fonte, acier, aluminium, zamak | différencier au moins l'aluminium et le zamak (teinte et marquage) |
| plaque | plaque de fer, cuivre, moule de plaque, acier, aluminium | le moule de plaque devrait ressembler à un moule |
| tige | tige de fer, tige d'acier | suffisant |
| engrenage | engrenage, moule d'engrenage | le moule devrait ressembler à un moule |
| bobine | fil de cuivre, moule de fil, câble isolé | moule de fil et câble isolé à distinguer |
| paquets de science | paquets T1 à T5 et de combat (6) | **un visuel par palier** (couleur et symbole) |
| puce | puce de silicium, isolant plastique | l'isolant n'est pas une puce |
| baril | baril vide, d'eau, de pétrole | le contenu pourrait se voir |
| minerai | fer, cuivre, zinc lavés | suffisant (teinte) |
| conteneur | uranium enrichi, appauvri, barre d'uranium, déchets nucléaires | à distinguer (barre, déchets) |
| caillou | pierre concassée, scories | suffisant |

## Ajoutés au jeu avec une forme provisoire (tour 259)

Ces 33 objets sont maintenant dans le jeu (recette, découverte, icône) mais **sans modèle propre** : 22 intermédiaires (formes partagées : tige, verre, caillou, sable, bobine, puce, plaque, bloc, conteneur, baril ; les quatre châssis prennent la forme du moteur), 8 pièces d'armures 3 et 5 (formes des armures 2 et 4), l'exosquelette (forme du pantalon), le mur et la porte blindés (modèles de l'aluminium).

## Objets prévus mais pas encore dans le jeu (59)

Ils sortent des propositions (intermédiaires, paliers 3 à 5, énergie). Aucun n'a de design.

| Objet | Genre | Ce qu'il faut | Forme existante réutilisable |
| --- | --- | --- | --- |
| Tige d'aluminium (`aluminium_rod`) | objet | icône 3D + modèle au sol | forme « tige » (couleur aluminium) |
| Bottes composites (`armor3_feet`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Casque composite (`armor3_head`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Jambières composites (`armor3_legs`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Plastron composite (`armor3_torso`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Bottes nano (`armor5_feet`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Casque nano (`armor5_head`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Jambières nano (`armor5_legs`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Plastron nano (`armor5_torso`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Vitre blindée (`armored_glass`) | objet | icône 3D + modèle au sol | forme « verre » (variante) |
| Batterie lithium (`battery_lithium`) | objet | icône 3D + modèle au sol | à créer (pile) |
| Fibre de carbone (`carbon_fiber`) | objet | icône 3D + modèle au sol | forme « bobine » ou « plaque » (noir) |
| Châssis léger (`chassis_alu`) | objet | icône 3D + modèle au sol | à créer (variante) |
| Châssis composite (`chassis_composite`) | objet | icône 3D + modèle au sol | à créer (variante) |
| Châssis simple (`chassis_simple`) | objet | icône 3D + modèle au sol | à créer (petit châssis) |
| Châssis renforcé (`chassis_steel`) | objet | icône 3D + modèle au sol | à créer (variante du châssis simple) |
| Circuit avancé (`circuit_advanced`) | objet | icône 3D + modèle au sol | forme « puce » (variante) |
| Deutérium (`deuterium`) | objet | icône 3D + modèle au sol | forme « baril » ou bonbonne |
| Exosquelette (`exoskeleton`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Capsule de fusion (`fusion_capsule`) | objet | icône 3D + modèle au sol | à créer (capsule) |
| Vitre (`glass`) | objet | icône 3D + modèle au sol | forme « verre » existante |
| Graphite (`graphite`) | objet | icône 3D + modèle au sol | forme « caillou » (noir) |
| Filtre en graphite (`graphite_filter`) | objet | icône 3D + modèle au sol | forme « bloc » ou « plaque » |
| Propulseur dorsal (`jetpack`) | équipement | modèle d'objet (icône) + modèle porté | — |
| Kit circuit (`kit_circuit`) | objet | icône 3D + modèle au sol | forme « puce » ou à créer (carte) |
| Azote liquide (`liquid_nitrogen`) | objet | icône 3D + modèle au sol | forme « baril » |
| Sel de lithium (`lithium_salt`) | objet | icône 3D + modèle au sol | forme « sable » |
| Accumulateur (`machine_accumulator_basic`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Compresseur d'air (`machine_air_compressor`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Purificateur d'air (`machine_air_purifier`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Bras industriel (`machine_arm_industrial`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Disjoncteur (`machine_breaker`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Borne de recharge (`machine_charger`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Foreuse à plasma (`machine_drill_plasma`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Électrolyseur (`machine_electrolyzer`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Fabricateur universel (`machine_fabricator`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Pile à combustible (`machine_fuel_cell`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Projecteur de mur holographique (`machine_hologram_projector`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Lampadaire électrique (`machine_lamp`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Poteau haute tension (`machine_pole_hv`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Poteau très haute tension (`machine_pole_uhv`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Coffre quantique (`machine_quantum_chest`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Panneau solaire (`machine_solar_panel`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Transformateur (`machine_transformer`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Tourelle à rail (`machine_turret_rail`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Éolienne (`machine_wind_turbine`) | machine | modèle posé (la miniature d'icône s'en déduit) + fenêtre machine | — |
| Microcontrôleur (`microcontroller`) | objet | icône 3D + modèle au sol | forme « puce » (variante) |
| Barrière en béton (`piece_barrier_concrete`) | construction | modèle de la pièce (+ icône) | — |
| Barrière en béton armé (`piece_barrier_reinforced`) | construction | modèle de la pièce (+ icône) | — |
| Porte blindée (`piece_door_armored`) | construction | modèle de la pièce (+ icône) | — |
| Clôture en bois (`piece_fence_wood`) | construction | modèle de la pièce (+ icône) | — |
| Mur blindé (`piece_wall_armored`) | construction | modèle de la pièce (+ icône) | — |
| Cristal quantique (`quantum_crystal`) | objet | icône 3D + modèle au sol | à créer (cristal) |
| Cellule photovoltaïque (`solar_cell`) | objet | icône 3D + modèle au sol | forme « plaque » (bleu) |
| Aimant supraconducteur (`supra_magnet`) | objet | icône 3D + modèle au sol | à créer (aimant) |
| Locomotive électrique (`train_locomotive_electric`) | véhicule | modèle posé (+ icône) | — |
| Wagon plateforme (`train_wagon_flat`) | véhicule | modèle posé (+ icône) | — |
| Tritium (`tritium`) | objet | icône 3D + modèle au sol | forme « baril » ou bonbonne |
| Quad électrique (`vehicle_quad_electric`) | véhicule | modèle posé (+ icône) | — |

## Résumé

- **À faire en priorité** (vu en jeu) : modèles portés de l'équipement, visuels propres aux paquets de science par palier, moules (plaque, engrenage, fil), veste.
- **À créer pour les paliers 3 à 5** : 22 objets, 19 machines, 5 constructions, 3 véhicules et trains, 10 équipements.
- Les modèles 3D sont faits par la session Blender parallèle (`blender/`, `export/`, `public/models/terra`) : ce fichier sert de commande.
