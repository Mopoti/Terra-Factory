# Personnage du joueur : modèle et personnalisation

Pour modifier le personnage (forme, couleurs, cheveux…), voir le mode d'emploi [`personnage-modifier.md`](personnage-modifier.md).

Proposition validée par le porteur du projet (15 octobre 2026), **à réaliser après les machines et les éléments du
monde** (arbres, rochers, minerais). Elle remplacera le mannequin provisoire actuel (`src/render/minerModel.ts`, avec
casque à lampe).

## Modèle de base

- **Style** : low poly détaillé, dans l'esprit des machines (facettes visibles, couleurs unies de la palette, pas de
  texture). Fait dans Blender, nouvelle famille `blender/scripts/personnage.py` (`personnage.blend`), exporté en
  `export/personnage_homme.glb` et `export/personnage_femme.glb`.
- **Taille** : environ 1,8 m au réglage moyen (le personnage du jeu fait aujourd'hui 1,70 m, voir `docs/gdd.md` §4).
- **Deux silhouettes**, homme et femme, qui partagent le **même squelette** : toutes les animations (marche, course,
  saut, frappe, pose d'objets…) servent aux deux.
- **Pas de casque** sur le modèle de base. Les pièces d'équipement (tête, tronc, mains, jambes, pieds) s'ajoutent
  par-dessus quand le joueur les porte, comme aujourd'hui.

## Tenue

- **Sous-vêtement une pièce** : une combinaison fine et ajustée sur tout le corps, très légère.
- Coutures en relief, bandes de couleur aux épaules et sur les flancs.
- **Couleur de la combinaison réglable** (et couleur des bandes).

## Personnalisation (réglages par morphing)

Le même maillage est déformé par des curseurs (formes de déformation, *shape keys* dans Blender), plutôt que des
modèles séparés : léger à charger, et chaque réglage se combine avec les autres. Complet mais pas trop chargé.

| Partie | Réglages |
|---|---|
| Corps | silhouette (homme / femme), taille, carrure, musculature, corpulence, poitrine, longueur des jambes |
| Nez | taille, largeur, hauteur (placement) |
| Bouche | largeur, épaisseur des lèvres, hauteur (placement) |
| Yeux | forme, écart, couleur |
| Cheveux | coupe (une dizaine de coupes, pièces séparées interchangeables), couleur libre |
| Tenue | couleur de la combinaison, couleur des bandes |

## Écran de personnalisation

- Accessible depuis l'**écran d'accueil**.
- Le personnage au centre, qui **tourne sur lui-même** (on peut aussi le faire tourner à la souris), curseurs et
  choix (coupes, couleurs) sur le côté, par onglets : Corps, Visage, Cheveux, Tenue.
- Boutons : aléatoire, réinitialiser, valider.
- Le **profil** est enregistré (comme les paramètres) et **repris dans chaque partie**, y compris en multijoueur : les
  autres joueurs voient le personnage tel qu'il a été réglé.

## Étapes

1. ✅ (17 octobre 2026) Modèle de base homme et femme, squelette commun, combinaison (Blender), premier essai dans le
   jeu à la place du mannequin. Fait : `blender/scripts/personnage.py` (16 os : `bassin`, `ventre`, `poitrine`, `cou`,
   `tete`, `epaule/bras/avantbras/main_g/d`, `cuisse/jambe/pied_g/d` ; pièces rigides par os, rotules aux
   articulations ; teintes `combinaison`, `bande`, `peau`, `cheveux`, `iris`, `oeil`, `levres`, `semelle`, `couture`),
   exports `personnage_homme.glb` et `personnage_femme.glb` (1,80 m, en mètres, l'avant vers +z). Dans le jeu :
   `src/render/avatarModel.ts` (classe `Avatar`, même usage que le mannequin : marche, frappe, outil dans la main
   droite, bras en vue subjective) ; la combinaison prend la couleur du joueur, les bandes une teinte plus claire. Le
   joueur est un homme en attendant le profil ; les autres joueurs sont homme ou femme selon leur identifiant. Le
   mannequin (`minerModel.ts`) reste en secours si les fichiers manquent.
   Animation retravaillée le 21 octobre (le PO la trouvait trop rigide, outils mal tenus) : animation procédurale
   lissée (chaque articulation glisse vers sa pose visée) ; marche et course avec genoux qui plient quand le pied passe
   devant, bassin qui tourne et descend à chaque pas, buste qui compense et se penche en courant, chevilles, tête
   stable ; respiration au repos ; outil tenu par le bas du manche, manche relevé devant soi ; coup de pioche à deux
   mains en poses clés lissées (`STRIKE_KEYS` : préparation, élan au-dessus de la tête, frappe vers l'avant et le bas
   en se penchant, genoux pliés, retour) ; vue subjective : placement du bras inchangé (même point de vue qu'avant), outil plus
   court (×0,85) tourné sur son manche, dressé à droite, tête vers l'avant, qui s'abat au centre de l'écran (`FP_ROWS`). Le geste en cours se termine en douceur quand on arrête de frapper.
   Saut et accroupi (21 octobre) : en l'air, jambes repliées à la montée et tendues vers le sol à la descente, bras
   écartés, réception genoux fléchis selon la vitesse de chute ; accroupi (touche Accroupi, Ctrl gauche, au sol et à
   pied) : genoux pliés, pieds à plat, buste penché, corps abaissé de 42 cm, on avance à 45 % de la marche (pas de
   course) et la vue descend de 45 cm (`CROUCH_FACTOR`, `CROUCH_EYE_DROP_M` dans `gameView.ts`). Outil raccourci : ×1
   en vue extérieure, ×0,75 en vue subjective.
   Retouches du 17 octobre (retours du PO) : **tête et cheveux agrandis** (×1,18 autour du menton, menton plus bas :
   le cou est plus court) ; **10 coupes de cheveux** pour les deux silhouettes, pièces séparées dans le même fichier
   (`<modèle>_coupe_<nom>`) : courte, rasée, en brosse, iroquoise, mi-longue, longue, carré, queue de cheval, chignon,
   afro, plus « chauve » (aucune pièce). Dans le jeu : réglage `hairStyle` du profil (`HAIR_STYLES` dans
   `src/core/profile/appearance.ts`, onglet Cheveux de l'écran Personnage) ; par défaut courte (homme) et queue de
   cheval (femme) ; un joueur sans profil reçoit une coupe selon son identifiant. **À regarder en jouant** :
   proportions, cou, visage, cheveux.
2. 🟡 Corps et couleurs faits côté jeu ; visage et coupes dépendent de Blender. Le corps est déformé par **échelle des
   os** (taille, carrure, corpulence, longueur des jambes, poitrine : `bodyScales` dans
   `src/core/profile/appearance.ts`, appliqué par `Avatar.look`). Couleurs libres (combinaison, bandes, peau, cheveux,
   yeux). Coupes de cheveux : les 10 coupes ou `none` (anciens profils `model` → coupe de la silhouette). **À faire dans Blender** : formes de
   déformation (*shape keys*) nommées `nez_taille`, `nez_largeur`, `nez_hauteur`, `bouche_largeur`, `levres`,
   `bouche_hauteur`, `yeux_forme`, `yeux_ecart` (valeur positive = `<nom>`, négative = `<nom>_moins`). Le jeu les
   détecte seul : les curseurs du visage n'apparaissent que pour celles que le modèle contient.
3. ✅ Écran « Personnage » à l'accueil (onglets Corps / Visage / Cheveux / Tenue, rotation, aléatoire, réinitialiser,
   valider), profil enregistré (`terra.character`, `src/core/profile/store.ts`), repris dans chaque partie et envoyé aux
   autres joueurs (champ `look`, chaîne courte `encodeLook`/`decodeLook`).
4. Animations sur le squelette commun.
