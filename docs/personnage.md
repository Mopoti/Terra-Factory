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
   mannequin (`minerModel.ts`) reste en secours si les fichiers manquent. **À regarder en jouant** : proportions, cou,
   visage, cheveux (une seule coupe par silhouette pour l'instant).
2. Formes de déformation (corps et visage), coupes de cheveux, couleurs.
3. Écran de personnalisation à l'accueil, enregistrement du profil, envoi aux autres joueurs.
4. Animations sur le squelette commun.
