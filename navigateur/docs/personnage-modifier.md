# Modifier le personnage : mode d'emploi

Note pratique pour changer l'apparence du personnage du joueur (homme et femme). Le contexte et les étapes à venir
sont dans [`personnage.md`](personnage.md).

## Où se trouve quoi

| Quoi                                                     | Fichier                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Le modèle (forme, couleurs par défaut, squelette)        | `blender/scripts/personnage.py`                                                     |
| Le fichier Blender (refait par le script, non versionné) | `blender/personnage.blend`                                                          |
| Les modèles exportés                                     | `export/personnage_homme.glb`, `export/personnage_femme.glb` (+ `export/unity/`)    |
| La copie que charge le jeu                               | `public/models/terra/personnage_*.glb` (copiée par `node scripts/sync-modeles.mjs`) |
| L'animation dans le jeu (marche, frappe, outil en main)  | `src/render/avatarModel.ts`                                                         |
| La couleur de la combinaison et la taille du joueur      | `src/render/gameView.ts` (`0xd9822b`, `PLAYER_HEIGHT_M`)                            |

**Important** : le personnage est fabriqué par le script. Une retouche faite à la main dans `personnage.blend` est
perdue la prochaine fois que le script est relancé. Pour qu'une modification dure, elle doit être faite dans le
script (ou demandée à Claude, qui la fera dans le script).

## Façon la plus simple : demander à Claude

Décrire ce qu'on veut changer, avec une capture si possible. Exemples :

- « Le cou est trop long, raccourcis-le. »
- « Ajoute une coupe de cheveux longs pour la femme. »
- « Les épaules de l'homme sont trop larges. »
- « La combinaison par défaut doit être verte, les bandes blanches. »

Claude modifie `personnage.py`, relance la construction dans Blender, exporte, copie dans le jeu et vérifie le rendu.
Il reste ensuite à recharger la page du jeu (**Ctrl + F5**) et à envoyer sur GitHub.

## Le faire soi-même, pas à pas

### 1. Ouvrir le script

Ouvrir `blender/scripts/personnage.py` dans l'éditeur (VS Code par exemple). Les réglages se trouvent ici :

- **Couleurs par défaut** : le dictionnaire `TEINTES` en haut du fichier (`combinaison`, `bande`, `peau`, `cheveux`,
  `iris`, `oeil`, `levres`, `semelle`, `couture`), en code couleur `#rrvvbb`.
- **Hauteurs du corps** : les constantes `Z_CHEVILLE`, `Z_GENOU`, `Z_HANCHE`, `Z_TAILLE`, `Z_POITRINE`, `Z_EPAULE`,
  `Z_COU`, `Z_TETE`. Elles sont en unités Blender (1 unité = 50 cm ; le personnage fait 3,6 unités = 1,80 m). Par
  exemple, baisser `Z_TETE` raccourcit le cou.
- **Corps** (jambes, bassin, torse, bras, mains, bandes) : la fonction `corps(...)`. Les largeurs dépendent de
  `femme` : `ep` (épaules), `hx` (écart des hanches), `hanche`, `taille`, `poit`, `rb` (épaisseur des bras)…
- **Visage** (crâne, nez, yeux, sourcils, bouche, oreilles) : la fonction `tete(...)`.
- **Cheveux** : une fonction par coupe (`coupe_courte`, `coupe_longue`, `coupe_afro`…), listées dans le dictionnaire `COUPES`. Pour ajouter une coupe : écrire une fonction `coupe_<nom>(m, femme, seg)`, l'ajouter à `COUPES`, et ajouter son nom à la liste `HAIR_STYLES` de `src/core/profile/appearance.ts` et sa traduction `char.hair.<nom>` dans `src/i18n/fr.json` et `en.json`.
- **Taille de la tête** : `TETE_ECHELLE` (agrandissement de la tête et des cheveux autour du menton) et `MENTON_NOUVEAU` (plus bas = cou plus court).
- **Squelette** : la fonction `os_du_squelette(...)` (position des os). Si on déplace une articulation du corps
  (épaule, coude, genou…), il faut déplacer l'os correspondant de la même façon.

Les pièces s'ajoutent avec quelques briques :

| Brique                                             | Ce qu'elle fait                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `m.tronc(teinte, os, anneaux, ...)`                | Tronc ou membre fait d'anneaux `(hauteur, demi-largeur, demi-profondeur, décalage avant/arrière)` |
| `m.membre(teinte, os, a, b, ra, rb)`               | Segment rond d'un point `a` à un point `b`, rayon `ra` puis `rb`                                  |
| `m.boule(teinte, os, centre, rayon, ..., echelle)` | Boule à facettes, étirable avec `echelle`                                                         |
| `m.boite(teinte, os, centre, taille, rot)`         | Boîte (pour les bandes, sourcils, yeux, bouche…)                                                  |

Chaque pièce indique une **teinte** (une des couleurs de `TEINTES`) et l'**os** qu'elle suit quand le personnage
bouge (`tete`, `bras_d`, `cuisse_g`…). Rappel : `_g` = gauche du personnage, `_d` = droite ; le personnage regarde
vers -Y.

### 2. Règles à respecter

- **Ne pas renommer les os** : le jeu les retrouve par leur nom (`bassin`, `ventre`, `poitrine`, `cou`, `tete`,
  `epaule_*`, `bras_*`, `avantbras_*`, `main_*`, `cuisse_*`, `jambe_*`, `pied_*`). Les deux silhouettes gardent le même
  squelette.
- **Ne pas renommer les teintes** `combinaison`, `bande`, `peau`, `cheveux`, `iris` : le jeu les recolore (couleur du
  joueur, et plus tard le profil). On peut en ajouter de nouvelles.
- **Une pièce suit un seul os** : une pièce qui chevauche une articulation (par exemple un genou) doit être attachée à
  l'os du dessous, et une petite boule cache la jointure.
- **Rester low poly** : 8 côtés pour les membres (`seg`), quelques centaines de faces de plus au maximum.
- Pieds au sol (Z = 0), personnage debout, bras le long du corps.

### 3. Reconstruire et exporter

Dans un terminal (PowerShell), depuis le dossier `Terra-Factory` :

```
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python blender/scripts/personnage.py
```

Le script refait `blender/personnage.blend` et exporte les deux personnages dans `export/`.
Pour regarder le résultat avant de l'envoyer dans le jeu, ouvrir `blender/personnage.blend` dans Blender.

### 4. Copier dans le jeu et regarder

```
node scripts/sync-modeles.mjs
```

Puis, avec le jeu lancé (`npm run dev`), recharger la page avec **Ctrl + F5**.

### 5. Envoyer sur GitHub

```
git add blender/scripts/personnage.py export/ public/models/terra/
git commit -m "Personnage : <ce qui a changé>"
git push
```

## Changer seulement dans le jeu (sans Blender)

- **Couleur de la combinaison** du joueur : `0xd9822b` dans la fonction `make` de `src/render/gameView.ts` (elle sert au
  corps et aux bras en vue subjective). Les bandes prennent automatiquement une teinte plus claire de la même couleur.
- **Taille** du personnage : `PLAYER_HEIGHT_M` (le modèle est mis à cette taille).
- **Coupe et couleur des cheveux** du joueur : le joueur les choisit dans l'écran « Personnage » de l'accueil (onglet Cheveux) ; sans profil, option `hairStyle` de l'`Avatar`.
- **Homme ou femme** pour le joueur : dans la même fonction `make`, écrire `{ firstPerson, silhouette: 'femme' }` à
  la création de l'`Avatar` (en attendant l'écran de personnalisation).
- **Mouvements** (amplitude de la marche, geste de frappe, écart des bras) : méthodes `update`, `arm` et `leg` de
  `src/render/avatarModel.ts`.
