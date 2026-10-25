# Construction : analyse et refonte (à valider avec le PO)

## 1. Ce qui existe aujourd'hui

Grille de blocs de 50 cm ; étage = 5 blocs (2,5 m). Matériaux **bois** et **pierre** (les mêmes pièces existent déjà dans les deux, sauf la porte, en bois seulement ; ils se combinent librement : le matériau n'intervient pas dans les règles de fixation).

| Pièce                     | Où elle se pose                                         | Règle de fixation actuelle                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mur** (bloc de 50 cm)   | sur un **bord** de case, à un des 5 hauteurs d'un étage | rez-de-chaussée, bloc du bas : toujours ; sinon sur un sol d'étage, sur le mur de l'étage du dessous, sur une dalle de plafond juste dessous, ou **accolé à un autre bloc** |
| **Porte**                 | bord, étage entier                                      | bloc du bas au rez-de-chaussée ; sinon sur un sol d'étage ou un mur du dessous                                                                                              |
| **Sol** (dalle basse)     | case, au niveau du sol de l'étage                       | **toujours** (aucune condition)                                                                                                                                             |
| **Plafond** (dalle haute) | case, sur le haut d'un bloc de mur                      | doit toucher la tranche haute d'un mur / le haut d'une marche, ou prolonger une dalle à ≤ 3 cases d'un mur                                                                  |
| **Escalier**              | case, une marche de 50 cm                               | au sol, sur un sol d'étage, ou dans le prolongement d'une marche de même sens                                                                                               |

## 2. Matrice réelle des fixations (nombre d'emplacements où chaque pièce peut s'accrocher contre une pièce déjà posée, hors ce qui tient seul)

| Pièce déjà posée             | mur (bloc) | porte | sol | plafond | escalier |
| ---------------------------- | ---------- | ----- | --- | ------- | -------- |
| mur, bloc du bas (étage 0)   | 1          | 0     | 0   | 2       | 0        |
| mur, bloc à 1 m (étage 0)    | 8          | 0     | 0   | 2       | 0        |
| mur entier (5 blocs)         | 25         | 1     | 0   | 2       | 0        |
| porte                        | 25         | 1     | 0   | 2       | 0        |
| sol, étage 0                 | 0          | 0     | 0   | 0       | 0        |
| sol, étage 1                 | 4          | 4     | 0   | 0       | 4        |
| plafond, bloc du haut        | 0          | 0     | 0   | 0       | 0        |
| plafond, bloc 2              | 4          | 0     | 0   | 0       | 0        |
| escalier, marche du bas      | 0          | 0     | 0   | 1       | 1        |
| escalier, marche à 1 m       | 0          | 0     | 0   | 1       | 1        |
| (rien : ce qui se pose seul) | 1          | 1     | 2   | 0       | 4        |

La dernière ligne : ce qui tient **sans rien** (mur du bas du rez-de-chaussée, sols, escaliers de départ).

## 3. Défauts constatés

1. **Sol et plafond sont deux pièces différentes** avec des règles différentes : un sol ne porte rien (aucun mur, escalier ni dalle ne s'accroche à un sol du rez-de-chaussée), un plafond ne s'accroche qu'à un mur ; une dalle ne s'accroche pas à une autre dalle sans mur porteur à ≤ 3 cases, ni à un escalier par le côté.
2. **Un escalier ne porte presque rien** : seules la marche suivante et une dalle au bout (ajouté au Tour 70) ; pas de mur à côté, pas de dalle sur le côté, pas de plafond au-dessus.
3. **Une porte et un mur ne se rejoignent pas librement** (une porte occupe l'étage entier, un mur ne se pose pas dans son encadrement par le haut).
4. **La visée choisit la pièce selon des cas particuliers** (`aimEdge` / `aimCeiling` / `aimFloor` / `aimStairs`), d'où des endroits où rien ne se pose alors que le curseur est sur une pièce (capture : dalle visée contre l'escalier).
5. **Hauteur de dalle limitée** : un sol seulement au niveau de l'étage, un plafond sur un mur existant : pas de dalle libre à 1 m, 1,5 m…
6. Les pièces fermées exigent sol + plafond + porte (bloc du haut).

## 4. Proposition de refonte (modèle unique « blocs de 50 cm »)

Tout est posé sur une grille de **cubes de 50 cm** (le monde entier, étages compris, hauteur libre) ; une pièce occupe une **face** ou un **cube** :

- **Mur** = une face verticale entre deux cubes (n'importe où, n'importe quelle hauteur).
- **Dalle** = une face horizontale entre deux cubes (sol et plafond deviennent **la même pièce**, à n'importe quelle hauteur ; épaisseur 10 cm centrée sur la face).
- **Escalier** = un cube en pente (4 sens), à n'importe quelle hauteur.
- **Porte** = pièce de 4 blocs de haut (2 m) sur une face verticale, à n'importe quelle hauteur.
- **Matériau** = simple attribut (bois / pierre / futurs) : une même ligne peut mélanger les deux.
- **Fixation** : la pièce se pose **sur la face du cube que vise le curseur** (la face la plus proche du point touché sur la première surface : terrain, pièce, machine). Aucune règle de support obligatoire (« le joueur est complètement libre ») ; on peut ajouter plus tard une option « stabilité » (les pièces flottantes tombent / s'effondrent).
- **Visée** : un seul algorithme pour toutes les pièces : rayon → première surface touchée → face de cube la plus proche → pièce posée selon le type et l'orientation (R) ; glisser = remplir une ligne / un plan / un volume.
- **Pièces fermées** : calculées sur les faces (cube entouré de faces ou de portes), sans condition d'étage.
- **Sauvegardes** : conversion automatique des pièces actuelles vers ce modèle.

## 5. Décisions du PO (Tour 76)

1. **Pièces libres, sans appui** : une pièce peut flotter dans le vide ; aucune règle de support.
2. **Une seule dalle** (sol et plafond sont la même pièce) posable à n'importe quelle hauteur de bloc (50 cm).
3. **Mêmes pièces en bois et en pierre** : mur, porte (ajout de la **porte en pierre**), dalle, escalier ; le matériau n'intervient dans aucune règle de fixation (on mélange librement).
4. **Anciennes constructions** : conservées telles quelles (le format des pièces n'a pas changé, donc rien à convertir ni à rendre).

## 6. Ce qui a été fait (Tour 76)

- **Une seule visée pour toutes les pièces** (`aimBuild`, `src/core/build/aim.ts`) : on suit le rayon jusqu'à la première surface touchée (pièce posée, terrain, ou plan de construction de l'étage choisi si rien n'est touché), puis on choisit l'**emplacement libre le plus proche du point touché** parmi toutes les faces de blocs de 50 cm possibles de la pièce (mur : bord vertical à n'importe quelle hauteur ; dalle : face horizontale ; escalier : cube ; porte : base d'un étage). À égalité, l'emplacement du côté de l'œil gagne. Plus de cas particuliers par pièce : les anciennes visées `aimEdge` / `aimCeiling` / `aimFloor` / `aimStairs` sont supprimées.
- **Plus de règle d'appui** (`isSupported` supprimée) ; les statuts de tracé « flottant » aussi.
- **Dalle unifiée** : `slabFace` / `slabPos` / `slabAt` : le sol d'un étage et le plafond posé sur le dernier bloc de l'étage du dessous sont la même face (une seule dalle par face). Les pièces fermées acceptent un plafond ou le sol de l'étage du dessus.
- **Glisser** : une dalle trace un rectangle dans le plan de sa face de départ (`planSlabs`) ; un mur trace un pan dans le plan de son bord, à son étage.
- **Démolition** : vise la première pièce touchée (`aimExisting`).
- Tests : visée libre (mur au sol, dalle sur un mur, bloc au-dessus d'un mur, bois = pierre, plan de construction dans le vide), face unique sol/plafond ; tests des anciennes règles d'appui retirés.
- Non fait / à surveiller : les marches d'escalier ne s'enchaînent plus automatiquement (on les place où on vise), la visée en vue du dessus suit le plan de l'étage choisi (Page↑/↓), pas encore de pièces d'angle ni de fenêtres (mur sans bloc).
