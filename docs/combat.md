# Combat, dépouilles et paquets de combat

Décisions du PO (Tour 152) et état de l'implémentation.

## Butin
- **Carapace** : chaque ennemi tué laisse 1 ou 2 carapaces au sol (toujours 2 pour un mutant), à ramasser comme un objet posé. Pas de corps persistant : le butin est directement la pile au sol.
- **Tissu vivant** : un nid détruit en laisse 4 à 6 morceaux. Nom provisoire, à confirmer (alternatives : noyau de ruche, chair de ruche).
- **Paquet de combat** : 2 carapaces + 1 tissu vivant → 2 paquets. Cinquième type de paquet de science, indépendant des paliers T1 à T4, étudié en laboratoire comme les autres.

## Technologies de combat
| Palier | Technologies | Coût |
|---|---|---|
| 1 | Tourelle légère (`defense`), Pistolet + chargeur (`weapons_1`), Armure renforcée casque/plastron (`armor_1a`), jambes/bottes (`armor_1b`) | 10 plaques de fer chacune |
| 2 | Fusil automatique + chargeur (`weapons_2`), Armure blindée ×2 (`armor_2a`, `armor_2b`), Tourelle lourde (`turret_2`) | 5 paquets de combat chacune |
| 3 | Tourelle laser (`turret_3`) | 10 paquets de combat |
| 4 | Armure à blindage lourd ×2 (`armor_4a`, `armor_4b`), Tourelle à plasma (`turret_4`) | 20 paquets de combat chacune |

Une technologie de palier 2 et plus n'apparaît que lorsque son équivalent du palier inférieur est étudié (même règle que le reste de l'arbre). Les armures sont coupées en deux technologies (casque + plastron, jambes + bottes) à cause de la limite de 2 équipements par technologie. Le pistolet n'est plus disponible dès le départ : il faut `weapons_1`.

## Équipement
- Nouvel emplacement **Dos** pour le sac à dos, afin que le plastron d'armure et le sac se portent ensemble. Les anciennes sauvegardes qui rangeaient le sac dans « Tronc » le retrouvent dans « Dos ».
- **Protection** : somme des pièces portées, plafonnée à 80 %, retirée de tous les dégâts reçus (ennemis, acide). Jeu complet : renforcé 22 %, blindé 45 %, blindage lourd 72 %.
- Armures : carapaces + plaques de fer et tissu (renforcée), acier (blindée), acier + puces (blindage lourd).

## Armes et tourelles
- Pistolet : 12 balles, 10 dégâts, un tir toutes les 0,35 s. Fusil automatique : chargeur de fusil de 30 balles, 9 dégâts, 0,12 s (clic maintenu), portée 55 m. Les invités tirent avec leur arme (message `fire` avec `weapon`).
- Tourelle légère (chargeurs de pistolet), lourde (chargeurs de fusil), laser (25 kW) et plasma (70 kW) : les deux dernières n'ont pas de munitions mais ont besoin d'électricité. Données : `TURRETS` dans `src/core/data/machines.ts`.

## Pas encore fait (palier 3 et 4)
- **Grenades** (palier 3) : demandent un jet d'objet et une explosion à zone.
- **Véhicule blindé** (palier 3) et **tank** (palier 4) : il existe déjà un véhicule à monter dans le jeu ; à préciser avec le PO (stats, armement, coût).
