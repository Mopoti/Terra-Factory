# Commande de modèles 3D (état du tour 280)

Liste faite sur le jeu en marche (`content/items.json`, `content/machines.json`, `dropModels.ts`, `models.ts`). **Règle : l'icône d'inventaire et le modèle au sol sont le même modèle** (l'icône est une vue isométrique du modèle au sol ; pour une machine, de sa miniature). Un seul modèle à fournir par objet pour les trois usages (sol, inventaire, posé quand c'est une machine / construction / véhicule). Les fichiers vont dans `blender/` → `export/` → `public/models/terra`. Les faces magenta des formes d'objets prennent la couleur de l'objet.

## 1. Dans le jeu avec un modèle provisoire ou dessiné par le code (à remplacer)

### 1a. Machines posées (modèle d'une autre machine réutilisé)

Fait le 30 octobre : poteaux haute et très haute tension, lampadaire, éolienne (icône ; en jeu elle est dessinée par
`weatherProps.ts`), transformateur, disjoncteur, panneau solaire, accumulateur, assembleur avancé, et les dix machines
avancées (`blender/scripts/avancees.py`, branchées dans `TERRA_MODELS`), thermomètre et girouette (31 octobre, branchés
avec l'éolienne dans `weatherProps.ts`).

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

Modèles prêts (`blender/scripts/clotures.py`), pas encore branchés : `cloture_bois`, `barriere_beton` et
`barriere_beton_arme` (avec `_abime1` / `_abime2`), `portail_bois`, `portail_beton`, `portail_beton_arme`,
`barriere_holographique`, `portail_holographique`, `projecteur_mur_holographique`. Un tronçon de modèle fait **une case**
(poteaux `poteau_g_` / `poteau_d_` à cacher quand un voisin touche), alors qu'un tronçon du jeu en fait trois : le rendu
(`addBarrierBody`) devra en poser trois côte à côte. Les portails font 3 m comme dans le jeu (battants et vantail animables).

Usure : les machines abîmées sont noircies par le code (suie par taches, fumée sous 50 %, étincelles sous 25 %) ; des modèles à états abîmés (3 niveaux) amélioreraient le rendu.

### 1c. Véhicules et matériel roulant

Fait le 30 octobre et branché : quad électrique (`quad_electrique`), locomotive électrique (`locomotive_electrique`, à
l'échelle de la voie, cabines vitrées), wagon plateforme (`wagon_plateforme`), mur et porte blindés.

### 1d. Objets (sac et sol) à forme partagée ou provisoire

Terminé le 30 octobre : chaque objet intermédiaire a sa forme propre (`OWN_SHAPES` dans `dropModels.ts`), batterie
portable comprise (`objet_batterie_portable` ; la jauge reste dessinée par l'interface). La tige d'aluminium garde la
forme `tige` (teinte de l'aluminium).

### 1e. Formes partagées

Fait le 30 octobre : paquets de science par palier, moules, lingots d'aluminium et de zamak, câble isolé, isolant
plastique, barils, barre d'uranium, déchets nucléaires. Restent partagés, volontairement : les lingots de fer, cuivre,
zinc, fonte et acier (même forme, teinte différente) et l'uranium enrichi et appauvri (même conteneur, hublot de couleur
différente).

### 1f. Équipement

- **Modèles portés** : faits pour tout l'équipement (vêtements, armures 1 à 5, exosquelette, propulseur ; `blender/scripts/porte.py`), les gants teintent les mains gantées.

### 1g. Rails

Le droit, la rampe, la **courbe 45°** (`rail_courbe`) et le **droit en diagonale** (`rail_diagonal`) ont leur modèle. Reste éventuellement : un **croisement en diagonale** (les deux droits se superposent) et un aiguillage visuel.

## 2. Résumé

- **À brancher dans le jeu** : barrières et portails (section 1b, rendu à adapter : trois tronçons par pièce du jeu).
- **Plus tard** : caténaires (avec les voies électrifiées), croisement en diagonale et aiguillage visuel.
