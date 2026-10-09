# Équilibrage — état des lieux (Tour 126)

Mesures faites par calcul sur les données du jeu (valeur d'un objet = celle du comptoir spatial, `itemValue`, déduite des recettes ; temps de laboratoire = 5 s par paquet de base et par laboratoire). **Aucune valeur n'a été changée** : les choix sont à valider.

## Paquets de science (valeur en crédits)

| Paquet | Recette | Valeur |
|---|---|---|
| T1 | engrenage + fil de cuivre | 15,8 |
| T2 | plaque d'acier + tuyau de laiton | 20,0 |
| T3 | puce + câble isolé | 17,9 |
| T4 | puce + plaque d'acier + uranium appauvri | 33,6 |

## Technologies

| Technologie | Paquets | Valeur des paquets | Valeur des objets | 1 labo | 4 labos |
|---|---|---|---|---|---|
| logistics | 0 | 0 | 78 | 0 min | 0.0 min |
| handling | 0 | 0 | 78 | 0 min | 0.0 min |
| metallurgy | 0 | 0 | 88 | 0 min | 0.0 min |
| metallurgy_2 | 30 | 474 | 0 | 3 min | 0.8 min |
| construction_2 | 30 | 474 | 0 | 3 min | 0.8 min |
| manufacturing_2 | 40 | 632 | 0 | 4 min | 1.0 min |
| fluids_2 | 40 | 632 | 0 | 4 min | 1.0 min |
| washing_2 | 40 | 632 | 0 | 4 min | 1.0 min |
| heavy_press_3 | 100 | 2001 | 0 | 10 min | 2.5 min |
| silicon_3 | 120 | 2402 | 0 | 12 min | 3.0 min |
| oil_3 | 140 | 2802 | 0 | 14 min | 3.5 min |
| plastic_3 | 160 | 3202 | 0 | 16 min | 4.0 min |
| fission_4 | 200 | 3581 | 0 | 20 min | 5.0 min |
| reactor_4 | 300 | 5372 | 0 | 30 min | 7.5 min |
| waste_4 | 250 | 4477 | 0 | 25 min | 6.3 min |
| storage_3 | 120 | 2402 | 0 | 12 min | 3.0 min |
| fusion_5 | 300 | 8512 | 0 | 30 min | 7.5 min |
| beacon_5 | 450 | 12768 | 0 | 45 min | 11.3 min |
| logistics_2 | 40 | 632 | 0 | 4 min | 1.0 min |
| logistics_3 | 100 | 2001 | 0 | 10 min | 2.5 min |
| sorting_3 | 120 | 2402 | 0 | 12 min | 3.0 min |
| extraction_3 | 60 | 1201 | 0 | 6 min | 1.5 min |
| textile | 0 | 0 | 20 | 0 min | 0.0 min |
| clothing | 0 | 0 | 20 | 0 min | 0.0 min |
| handwear | 0 | 0 | 20 | 0 min | 0.0 min |
| bedding | 0 | 0 | 20 | 0 min | 0.0 min |
| electricity | 0 | 0 | 85 | 0 min | 0.0 min |
| power_generation | 0 | 0 | 85 | 0 min | 0.0 min |
| laboratory | 0 | 0 | 65 | 0 min | 0.0 min |
| automation | 20 | 316 | 0 | 2 min | 0.5 min |
| steam | 0 | 0 | 84 | 0 min | 0.0 min |
| steam_power | 0 | 0 | 82 | 0 min | 0.0 min |
| barrels_3 | 80 | 1601 | 0 | 8 min | 2.0 min |
| navigation | 0 | 0 | 52 | 0 min | 0.0 min |
| defense | 0 | 0 | 143 | 0 min | 0.0 min |

## Ce que ça montre

1. **Courbe de coût cohérente** : environ ×4 à chaque tier (T1 : ~20–140 crédits d'objets ; T2 : 470–630 ; T3 : 1 600–3 200 ; T4 : 3 600–5 400 ; T5 : 8 500–12 800). Le temps de laboratoire reste raisonnable (45 min au pire avec un seul laboratoire, 11 min avec 4).
2. **Écart brutal entre T1 et T2** : toute la filière T1 (objets) vaut ~80 crédits par technologie, alors que la première technologie à paquets (Métallurgie T2, 30 paquets) en vaut 474 : le paquet T1 (15,8) coûte presque autant qu'une technologie T1 entière.
3. **Paquets non monotones** : le paquet T3 (17,9) vaut moins que le T2 (20,0) alors que les technologies T3 coûtent 4 fois plus de crédits ; le T4 (33,6) est le seul à se démarquer.
4. **Fin de partie** : Fusion + Balise = ~21 000 crédits de paquets, soit 3 fois tout le reste du T4.

## Propositions (à valider)

- **A. Adoucir le palier T1 → T2** : ramener Métallurgie T2, Construction T2 à 20 paquets et les autres techs T2 à 30.
- **B. Lisser les paquets** : donner au paquet T3 une recette plus riche (par exemple + 1 plaque d'acier) pour qu'il vaille ~35 crédits, et au T4 ~60 en doublant l'uranium appauvri ; les coûts en nombre de paquets des techs T3/T4 baissent alors d'un tiers pour garder le même total.
- **C. Fin de partie** : Fusion 150 T4 + 75 T3 ; Balise 200 T4 + 100 T3.
- **D. Prix du comptoir** : inchangés (vente 50 %, achat 150 % de la valeur) ; seule la valeur des paquets monte avec B.

Autres réglages (portées, rendements, vitesses de foreuse, taux de pollution) : pas d'anomalie visible sans partie jouée ; à retoucher après des essais en conditions réelles.

## Délais de fabrication : le fourneau primitif (Tour 136)

Décision du PO : le fer se produit trop vite avec un four primitif ; il faut faire attendre le joueur. Une fois **le bon délai du fourneau trouvé**, on en déduit les délais de chaque recette de chaque machine, pour que construire une chaîne de production soit un casse-tête et une satisfaction de l'optimiser.

- **Valeurs de départ** (à ajuster en jouant, `content/recipes.json`, champ `seconds`) : lingots de fer **10 s** (avant : 2 s), fonte **15 s** (4 s), cuivre et zinc **8 s** (3 s), moules **8 s** (3 s) ; mêmes valeurs pour les versions « minerai lavé ». Les machines électriques (four électrique T3) gardent leurs 4 s : elles sont plus rapides que le four primitif.
- Les tests lisent les durées dans les recettes : changer un délai ne casse plus rien.
- **Méthode proposée pour les autres machines** : fixer d'abord le débit d'un fourneau primitif (ici 2 lingots / 10 s = 0,2 lingot/s), puis donner à chaque machine un débit par paliers cohérent avec le tapis (T1 ≈ 2 objets/s, T2 ≈ 4, T3 ≈ 8) : il faut plusieurs machines pour saturer un tapis au palier 1, et des machines plus chères pour le palier suivant. Le calcul se fait sur « objets par seconde par machine » plutôt que sur des secondes de recette.
