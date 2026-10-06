# Dimensions du jeu (état du code, à valider avec le PO)

## La grille

- **Case = 50 cm** (`CELL_SIZE_M`), pas fin de placement 10 cm. **Chunk = 16 × 16 cases = 8 m.**
- Hauteur : une **couche de mur = 50 cm**, un **étage = 5 couches = 2,5 m** (dalle de sol 10 cm d'épaisseur, `content/buildings.json`).
- **Joueur** : rayon 25 cm (1 case de large), hauteur 1,7 m, marche de 35 cm montable sans sauter, saut ≈ 1,1 m.

## Tapis et tuyaux

- Une tuile = **2 × 2 cases = 1 m** de large et de long (les objets passent au milieu). Hauteur dessinée 12–15 cm. Tuyau : 2 × 2 cases, 30 cm.
- **Niveaux de tapis** : sol 0 m ; niveau 1 = **1,25 m** ; niveau 2 = **2,5 m** (= une dalle d'étage). Une rampe fait 1 tuile (1 m) de long : 0 → 1,25 m (≈ 51°), 1,25 → 2,5 m (≈ 51°). Tunnel : entrée et sortie 2 × 2 cases, jusqu'à 8 tuiles.

## Machines (emprise en cases → mètres, hauteur dessinée en m ; le corps dessiné est 10 cm plus grand dans chaque sens)

| Machine                                              | Emprise                  | Hauteur                     |
| ---------------------------------------------------- | ------------------------ | --------------------------- |
| Foreuse (brûleur / électrique)                       | 4 × 4 (2 m)              | 1,3                         |
| Four, générateur, assembleur, laboratoire, chaudière | 3 × 3 (1,5 m)            | 1,0 / 1,1 / 1,0 / 0,9 / 1,5 |
| Turbine                                              | 2 × 3                    | 1,1                         |
| Coffres, bras, pompe, séparateur, groupeur, tourelle | 2 × 2 (1 m)              | 0,6 / 0,7 / 0,8 / 0,4 / 0,9 |
| Poteau                                               | 2 × 2 (mât fin de 30 cm) | 3,6                         |

## Monde

Arbre 4,2 m (tronc seul bloquant), rocher 0,8 m, buisson de fibres 0,6 m, minerai 0,1 m ; portée de récolte 3 m ; pollution par cellules de 32 m.

## Points incohérents repérés

1. **Le niveau 1 (1,25 m) n'est pas un multiple de 50 cm** : il ne tombe pas sur la grille des blocs de mur, et les rampes font 51° au lieu de 45°.
2. **Hauteurs de machines arbitraires** (0,4 ; 0,6 ; 0,9 ; 1,1 ; 1,3 ; 3,6 m…) : pas alignées sur des blocs de 50 cm.
3. Emprises **impaires** (3 × 3) : leur centre tombe au milieu d'une case alors que celui des tuiles (2 × 2) tombe sur une arête ; les raccordements doivent alors se décaler d'une demi-case.
4. Le joueur (1,7 m) = 3,4 couches : un tapis à 1,25 m le bloque, à 2,5 m il passe dessous, mais un niveau intermédiaire à 2 m (= 4 couches) le laisserait aussi passer.

## Proposition (à valider)

- **Toutes les hauteurs en multiples de 50 cm** : machines arrondies (0,5 / 1,0 / 1,5 m), poteau 3,5 m.
- **Niveaux de tapis alignés sur les blocs** : sol 0 ; **niveau 1 = 1,0 m** (rampe à 45° sur une tuile) ; **niveau 2 = 2,5 m** (un étage, pour poser des machines sur les dalles existantes). La rampe 1 → 2 fait 1,5 m de dénivelé : soit sur **1,5 tuile (3 cases, 45°)**, soit sur 1 tuile (56°).
- Garder les tuiles de tapis à 1 m (2 × 2 cases) ; les emprises impaires restent (il n'y a pas de raison de les changer).
