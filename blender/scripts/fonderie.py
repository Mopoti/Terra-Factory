"""Famille « fonderie » : fourneau, fourneau électrique, convertisseur Bessemer.

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.

Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `fourneau_t1` -> export/fourneau_t1.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `fourneau_t1_unity` -> export/unity/fourneau_t1.glb (non copiée dans le jeu).

Lancer :  blender --background --python blender/scripts/fonderie.py
Produit :  blender/fonderie.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def entree_laterale(lot, s, xf, yc, z0, rnd, bv, w=0.6, h=0.4, cadre='pierre_sombre', goulotte='fonte'):
    """Entrée de la matière brute sur une face X : ouverture sombre encadrée, goulotte inclinée vers l'extérieur et
    quelques morceaux de minerai. `s` = +1 (côté +X) ou -1 (côté -X) ; `xf` = position X de la face ; `yc` = centre en Y ;
    `z0` = bas de l'ouverture. Reste dans l'emprise : rien ne dépasse |x| = xf + 0,2.
    """
    for dy in (-1, 1):  # piédroits
        lot.cube(cadre, (0.1, 0.12, h + 0.12), (xf + s * 0.05, yc + dy * (w / 2 + 0.06), z0 + h / 2), 0.015 * bv)
    lot.cube(cadre, (0.1, w + 0.24, 0.12), (xf + s * 0.05, yc, z0 + h + 0.06), 0.015 * bv)  # linteau
    lot.cube('noir', (0.04, w, h), (xf + s * 0.02, yc, z0 + h / 2))
    pente = Matrix.Rotation(-s * math.radians(28), 3, 'Y')  # l'extrémité extérieure remonte
    cx, cz = xf + s * 0.085, z0 + 0.06
    lot.cube(goulotte, (0.18, w, 0.04), (cx, yc, cz), 0.01 * bv, pente)
    for dy in (-1, 1):
        lot.cube('acier_sombre', (0.18, 0.04, 0.08), (cx, yc + dy * (w / 2 - 0.02), cz + 0.03), 0, pente)
    for k in range(3):  # minerai sur la goulotte
        t = rnd.uniform(0.07, 0.1)
        lot.cube(rnd.choice(('brique_sombre', 'fonte', 'pierre')), (t, t, t * 0.8),
                 (xf + s * rnd.uniform(0.04, 0.1), yc + (k - 1) * 0.16 + rnd.uniform(-0.03, 0.03), cz + 0.05),
                 0.015 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))


def fourneau_t1(coll, leger=True):
    """Fourneau à combustible : 3 x 3 cases, 2,6 unités de haut (1,3 m = 1,3 x la hauteur de machines.json, le maximum
    accepté par le jeu sans réduire le modèle). Sortie devant (-Y), combustible derrière (+Y).

    Corps en briques posé sur le terrain (pas de sol), chaînages d'angle en pierre, gueule du foyer en arc avec flammes,
    réserve de bûches en dessous, corniche, hotte en pyramide et cheminée ; trappe en planches et charbon derrière ;
    entrée de la matière brute sur chaque côté X.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    `leger` (version web) : briques moins nombreuses et sans biseau, moins de charbon ;
    la version détaillée (leger=False) est gardée pour Unity.
    """
    rnd = random.Random(3)
    bv = 0.0 if leger else 1.0  # biseau des petites pièces : aucun en version légère
    lot = T.Lot(coll, 'pieces')

    # Pas de sol : la machine est posée sur le terrain du jeu (voir T.poser_au_sol à la fin).

    # --- Corps en briques (x ±1,3 ; y -1,1 -> 1,3 ; z 0,2 -> 1,68) et soubassement de pierre.
    T.box(coll, 'corps', (2.6, 2.4, 1.48), (0, 0.1, 0.94), 'brique', bevel=0.02)
    T.box(coll, 'soubassement', (2.68, 2.48, 0.12), (0, 0.1, 0.26), 'pierre_sombre', bevel=0.03)
    rangs = (0.41, 0.59, 0.77, 0.95, 1.13, 1.31, 1.49, 1.65)
    T.parement(lot, [
        ('y', -1.1, -1.12, -0.66, -1), ('y', -1.1, 0.66, 1.12, -1),  # devant, de part et d'autre de la gueule
        ('x', -1.3, -0.92, -0.36, -1), ('x', -1.3, 0.56, 1.12, -1),  # côtés, de part et d'autre de l'entrée
        ('x', 1.3, -0.92, -0.36, 1), ('x', 1.3, 0.56, 1.12, 1),
        ('y', 1.3, -1.12, -0.98, 1), ('y', 1.3, -0.02, 1.12, 1),  # derrière, de part et d'autre de la trappe
    ], rangs, seed=7, densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    # Côtés : au-dessus et au-dessous des entrées de matière brute.
    T.parement(lot, [('x', -1.3, -0.36, 0.56, -1), ('x', 1.3, -0.36, 0.56, 1)], (0.41, 0.59, 1.49, 1.65), seed=13,
               densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    # Entrées de la matière brute, une sur chaque côté X.
    for s in (-1, 1):
        entree_laterale(lot, s, s * 1.3, 0.1, 0.78, rnd, bv)
    # Au-dessus de l'arc de la gueule.
    T.parement(lot, [('y', -1.1, -0.66, 0.66, -1)], rangs[-2:], seed=11, densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    # Chaînages d'angle : pierres alternées (longue / courte) sur les 4 coins.
    for cx, cy in ((-1.3, -1.1), (1.3, -1.1), (-1.3, 1.3), (1.3, 1.3)):
        sx, sy = math.copysign(1, cx), math.copysign(1, cy)
        for k, z in enumerate(rangs):
            lx, ly = (0.34, 0.2) if k % 2 == 0 else (0.2, 0.34)
            lot.cube(rnd.choices(*zip(*T.PIERRES))[0], (lx, ly, 0.165),
                     (cx - sx * (lx / 2 - 0.04), cy - sy * (ly / 2 - 0.04), z), bevel=0.02 * bv)

    # --- Gueule du foyer (devant) : fond noir, piédroits et arc de pierres, flammes et braises.
    T.box(coll, 'gueule_fond', (0.8, 0.04, 0.5), (0, -1.115, 0.97), 'noir')
    for x in (-0.5, 0.5):
        lot.cube(rnd.choice(('pierre_sombre', 'pierre')), (0.2, 0.15, 0.17), (x, -1.17, 0.8), bevel=0.02 * bv)
    for a in (180, 150, 120, 90, 60, 30, 0):
        t = math.radians(a)
        lot.cube('pierre_sombre' if a % 60 else 'pierre', (0.2, 0.15, 0.15),
                 (0.5 * math.cos(t), -1.17, 0.99 + 0.28 * math.sin(t)),
                 bevel=0.02 * bv, rot=Matrix.Rotation(math.radians(90 - a), 3, 'Y'))
    for x, h, r in ((-0.2, 0.26, 0.11), (0.03, 0.34, 0.13), (0.23, 0.24, 0.1)):
        T.cylinder(coll, f'flamme_{x}', r, h, (x, -1.17, 0.78 + h / 2), 'braise', segments=5, radius_top=0.0)
        T.cylinder(coll, f'coeur_{x}', r * 0.55, h * 0.6, (x, -1.24, 0.78 + h * 0.3), 'flamme', segments=5, radius_top=0.0)
    for x in (-0.25, 0.0, 0.25):
        lot.cube('braise', (0.18, 0.12, 0.06), (x + rnd.uniform(-0.03, 0.03), -1.17, 0.76), bevel=0.02 * bv,
                 rot=Matrix.Rotation(rnd.uniform(-0.3, 0.3), 3, 'Z'))
    # Rebord de pierre sous la gueule (sortie des lingots, côté -Y).
    T.box(coll, 'rebord', (1.25, 0.34, 0.09), (0, -1.27, 0.69), 'pierre_claire', bevel=0.025)

    # --- Réserve de bûches sous le rebord.
    T.box(coll, 'reserve_fond', (0.72, 0.04, 0.3), (0, -1.115, 0.45), 'noir')
    T.box(coll, 'reserve_linteau', (0.92, 0.14, 0.08), (0, -1.16, 0.6), 'pierre_sombre', bevel=0.02)
    for x in (-0.43, 0.43):
        lot.cube('pierre', (0.14, 0.14, 0.3), (x, -1.16, 0.45), bevel=0.02 * bv)
    for x, z in ((-0.2, 0.39), (0.0, 0.39), (0.2, 0.39), (-0.1, 0.51), (0.1, 0.51)):
        b = T.cylinder(coll, f'buche_{x}_{z}', 0.065, 0.26, (0, 0, 0), rnd.choice(('bois', 'bois_sombre')), segments=6)
        T.rotate(b, x=90)
        b.location = (x, -1.2, z)

    # --- Corniche, hotte en pyramide et cheminée (z 1,68 -> 2,6).
    T.box(coll, 'corniche', (2.76, 2.56, 0.12), (0, 0.1, 1.74), 'pierre_sombre', bevel=0.03)
    # Dessus de la corniche en briques, puis hotte étroite et pentue (z 1,8 -> 2,14).
    T.box(coll, 'dessus', (2.5, 2.3, 0.04), (0, 0.1, 1.82), 'brique_sombre', bevel=0.01)
    hotte = T.cylinder(coll, 'hotte', 0.95 * math.sqrt(2), 0.34, (0, 0, 0), 'brique', segments=4,
                       radius_top=0.34 * math.sqrt(2))
    T.rotate(hotte, z=45)
    hotte.location = (0, 0.1, 1.97)
    T.box(coll, 'hotte_bande', (1.5, 1.5, 0.07), (0, 0.1, 1.9), 'pierre', bevel=0.02)
    T.box(coll, 'hotte_bande_haut', (0.98, 0.98, 0.06), (0, 0.1, 2.06), 'pierre_sombre', bevel=0.02)
    # Cheminée plus haute (z 2,04 -> 2,54), avec une bague de pierre à mi-hauteur.
    T.box(coll, 'cheminee', (0.62, 0.62, 0.5), (0, 0.1, 2.29), 'brique', bevel=0.02)
    T.box(coll, 'cheminee_bague', (0.68, 0.68, 0.06), (0, 0.1, 2.3), 'pierre', bevel=0.015)
    T.box(coll, 'cheminee_chapeau', (0.76, 0.76, 0.05), (0, 0.1, 2.565), 'pierre_sombre', bevel=0.015)
    T.box(coll, 'cheminee_trou', (0.4, 0.4, 0.01), (0, 0.1, 2.595), 'noir')

    # --- Derrière : trappe en planches avec pentures, tas de charbon.
    for k, x in enumerate((-0.74, -0.5, -0.26)):
        lot.cube(rnd.choice(('bois', 'bois_sombre')), (0.22, 0.06, 0.52), (x, 1.33, 0.78), bevel=0.015 * bv)
    for z in (0.62, 0.94):
        lot.cube('fonte', (0.74, 0.03, 0.06), (-0.5, 1.37, z), bevel=0.01 * bv)
    for _ in range(4 if leger else 9):
        s = rnd.uniform(0.08, 0.12)
        lot.cube('noir', (s, s, s * 0.8), (-0.5 + rnd.uniform(-0.3, 0.3), 1.38 + rnd.uniform(-0.02, 0.02), 0.22 + s * 0.3),
                 bevel=0.02 * bv, rot=Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    lot.finir()
    T.poser_au_sol(coll, 1.5)


def fourneau_electrique_t2(coll, leger=True):
    """Fourneau électrique : corps presque carré aux angles arrondis, palier, étage pyramidal et grille d'évacuation.

    3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y). De haut en bas : grille ronde d'évacuation des fumées
    (son diamètre donne la largeur du haut), étage en pyramide aux coins arrondis qui s'élargit en descendant, petit
    palier en débord, corps presque carré aux angles arrondis, socle (entrées de la matière brute sur les deux côtés X,
    sortie avec goulotte et lingot devant, écran de contrôle). Quelques tuyaux à coudes et brides, antenne à isolateurs
    (câble électrique) à l'arrière gauche.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(21)
    bv = 0.0 if leger else 1.0
    seg = 12 if leger else 24
    nc = 3 if leger else 6  # segments par coin arrondi
    lot = T.Lot(coll, 'pieces')

    # Cotes : grille (rayon 0,5) -> haut de la pyramide demi 0,56 ; pyramide jusqu'à demi 1,0 ; palier ; corps demi 1,18.
    r_grille = 0.5
    z_corps0, z_corps1, d_corps = 0.62, 1.42, 1.18
    z_pal0, z_pal1, d_pal = 1.42, 1.5, 1.26
    z_pyr0, z_pyr1, d_pyr0, d_pyr1 = 1.5, 2.08, 1.0, r_grille + 0.06

    def demi_corps(z):
        return d_corps - 0.04 * (z - z_corps0) / (z_corps1 - z_corps0)  # très légère dépouille

    def demi_pyr(z):
        return d_pyr0 + (d_pyr1 - d_pyr0) * (z - z_pyr0) / (z_pyr1 - z_pyr0)

    # Pas de sol : la machine est posée sur le terrain du jeu (voir T.poser_au_sol à la fin).

    # --- Socle aux angles arrondis (demi 1,3 ; z 0,12 -> 0,62) : entrées, sortie, écran.
    T.lissage(coll, 'socle', [(1.3, 0.22, 0.12), (1.3, 0.22, 0.56)], 'acier_sombre', n_coin=nc)
    T.lissage(coll, 'socle_bandeau', [(1.34, 0.24, 0.54), (1.34, 0.24, 0.62)], 'fonte', n_coin=nc)
    T.lissage(coll, 'socle_plinthe', [(1.33, 0.24, 0.12), (1.33, 0.24, 0.18)], 'fonte', n_coin=nc)
    for s in (-1, 1):
        entree_laterale(lot, s, s * 1.3, 0.0, 0.2, rnd, bv, h=0.22, cadre='acier', goulotte='acier')
    T.box(coll, 'sortie_bouche', (0.56, 0.04, 0.22), (0, -1.32, 0.31), 'noir')
    T.box(coll, 'lueur_bouche', (0.44, 0.006, 0.14), (0, -1.343, 0.3), 'braise')  # four chaud : rougeoie en marche
    for x in (-0.34, 0.34):
        lot.cube('acier', (0.12, 0.1, 0.32), (x, -1.35, 0.33), 0.015)
    lot.cube('acier', (0.8, 0.1, 0.08), (0, -1.35, 0.47), 0.015)
    g = T.box(coll, 'sortie_goulotte', (0.56, 0.2, 0.04), (0, 0, 0), 'acier', bevel=0.01)
    g.rotation_euler = (math.radians(20), 0, 0)
    g.location = (0, -1.4, 0.22)
    pente = Matrix.Rotation(math.radians(-20), 3, 'X')
    lingot = T.Lot(coll, 'lingot')
    lingot.cube('acier', (0.24, 0.14, 0.07), (0, -1.4, 0.28), 0.015 * bv, pente)
    lingot.cube('acier', (0.18, 0.09, 0.03), (0, -1.405, 0.325), 0, pente)
    lingot.finir()
    T.box(coll, 'ecran_cadre', (0.5, 0.06, 0.3), (0.82, -1.32, 0.36), 'acier', bevel=0.02)
    T.box(coll, 'ecran', (0.42, 0.02, 0.22), (0.82, -1.355, 0.36), 'bleu')
    for i, (c, h) in enumerate((('jaune', 0.14), ('braise', 0.09), ('vert', 0.12))):
        lot.cube(c, (0.06, 0.01, h), (0.7 + i * 0.09, -1.368, 0.28 + h / 2), 0)
    lot.cube('braise', (0.12, 0.01, 0.04), (0.95, -1.368, 0.43), 0)

    # --- Corps presque carré aux angles arrondis, palier en débord, étage pyramidal.
    T.lissage(coll, 'corps', [(d_corps, 0.24, z_corps0), (demi_corps(z_corps1), 0.22, z_corps1)], 'acier', n_coin=nc)
    T.lissage(coll, 'palier', [(d_pal, 0.26, z_pal0), (d_pal, 0.26, z_pal1)], 'acier_sombre', fond=True, n_coin=nc)
    T.lissage(coll, 'pyramide', [(d_pyr0, 0.2, z_pyr0), (d_pyr1, 0.12, z_pyr1)], 'acier', n_coin=nc)
    T.lissage(coll, 'pyramide_rebord', [(d_pyr1 + 0.03, 0.14, z_pyr1 - 0.04), (d_pyr1 + 0.03, 0.14, z_pyr1 + 0.02)],
              'acier_sombre', n_coin=nc)
    # Joints de panneaux discrets sur le corps (une ligne horizontale à mi-hauteur).
    T.lissage(coll, 'corps_joint', [(demi_corps(1.0) + 0.012, 0.23, 0.99), (demi_corps(1.0) + 0.012, 0.23, 1.01)],
              'acier_sombre', dessus=False, n_coin=nc)

    # --- Grille ronde d'évacuation des fumées au sommet.
    T.cylinder(coll, 'grille_socle', r_grille, 0.08, (0, 0, z_pyr1 + 0.04), 'fonte', segments=seg)
    T.cylinder(coll, 'grille_bord', r_grille + 0.03, 0.04, (0, 0, z_pyr1 + 0.08), 'acier_sombre', segments=seg)
    for i in range(-2, 3):
        lot.cube('noir', (0.06, 2 * math.sqrt(max(r_grille ** 2 - (i * 0.15) ** 2, 0)) - 0.1, 0.02),
                 (i * 0.15, 0, z_pyr1 + 0.105), 0)

    # --- Tuyaux ronds : platine au sol, coudes arrondis, colliers de fixation, bride plaquée contre le mur.
    sg = 8 if leger else 14

    def tuyau(points, mat, r, colliers=()):
        pts = [Vector(p) for p in points]
        for a, b in zip(pts, pts[1:]):
            lot.tube(mat, a, b, r, sg)
        for p in pts[1:-1]:
            lot.boule(mat, p, r * 1.18)  # coude
        # Départ au sol : platine carrée boulonnée et manchon.
        p0 = pts[0]
        lot.cube('fonte', (r * 2 + 0.06, r * 2 + 0.06, 0.03), (p0.x, p0.y, p0.z + 0.015), 0.008)
        for dx in (-1, 1):
            for dy in (-1, 1):
                lot.cube('acier_sombre', (0.025, 0.025, 0.02), (p0.x + dx * (r + 0.015), p0.y + dy * (r + 0.015), p0.z + 0.035), 0)
        lot.tube('fonte', p0 + Vector((0, 0, 0.03)), p0 + Vector((0, 0, 0.09)), r * 1.3, sg)
        # Arrivée dans le mur : manchon et bride carrée plaquée contre la paroi.
        a, b = pts[-2], pts[-1]
        d = (b - a).normalized()
        lot.tube('fonte', b - d * 0.07, b - d * 0.01, r * 1.3, sg)
        lot.cube('fonte', (0.03, r * 2 + 0.1, r * 2 + 0.1), tuple(b - d * 0.015), 0.008,
                 Vector((1, 0, 0)).rotation_difference(d).to_matrix())
        # Colliers : bague autour du tuyau et patte jusqu'au mur.
        for p, mur in colliers:
            p, mur = Vector(p), Vector(mur)
            lot.tube('acier_sombre', p - Vector((0, 0, 0.025)), p + Vector((0, 0, 0.025)), r * 1.25, sg)
            lot.barre('acier_sombre', tuple(p), tuple(mur), 0.04, 0)

    mur = demi_corps  # position du mur du corps selon la hauteur
    # Eau de refroidissement (bleu), arrière droite : du sol, coude vers le corps.
    tuyau([(0.65, 1.38, 0.12), (0.65, 1.38, 0.8), (0.65, 1.3, 0.88), (0.65, mur(0.88), 0.88)], 'bleu', 0.05,
          colliers=[((0.65, 1.38, 0.36), (0.65, 1.3, 0.36))])
    T.cylinder_at(coll, 'vanne', 0.08, 0.03, (0.65, 1.45, 0.55), 'rouge', segments=8, x=90)
    lot.tube('acier_sombre', (0.65, 1.38, 0.55), (0.65, 1.44, 0.55), 0.015, 6)
    # Gros conduit (arrière gauche) : sort du corps, monte, passe par-dessus le palier et rentre dans la pyramide.
    tuyau([(-0.35, 1.4, 0.12), (-0.35, 1.4, 1.56), (-0.35, 1.3, 1.64), (-0.35, demi_pyr(1.64) + 0.01, 1.64)], 'acier_sombre', 0.065,
          colliers=[((-0.35, 1.4, 0.36), (-0.35, 1.3, 0.36)), ((-0.35, 1.4, 1.05), (-0.35, mur(1.05), 1.05))])
    # Deux tuyaux de cuivre côte à côte sur le côté droit (+X), derrière l'entrée.
    for k, y in enumerate((0.62, 0.8)):
        zc = 1.0 + 0.1 * k
        tuyau([(1.4, y, 0.12), (1.4, y, zc - 0.08), (1.32, y, zc), (mur(zc), y, zc)], 'cuivre', 0.035,
              colliers=[((1.4, y, 0.36), (1.3, y, 0.36))])
    # Un tuyau sur le côté gauche (-X), devant l'entrée.
    tuyau([(-1.4, -0.7, 0.12), (-1.4, -0.7, 0.92), (-1.32, -0.7, 1.0), (-mur(1.0), -0.7, 1.0)], 'acier_sombre', 0.05,
          colliers=[((-1.4, -0.7, 0.36), (-1.3, -0.7, 0.36))])

    # --- Borne électrique (arrière gauche, sur le socle ; le câble du jeu s'accroche à sa boule) et câble vers la pyramide.
    T.borne_electrique(coll, lot, (-1.22, 1.22, 0.62), 1.75, seg)
    lot.barre('noir', (-1.22, 1.22, 1.9), (-0.5, demi_pyr(1.85) + 0.03, 1.85), 0.03, 0)

    lot.finir()
    T.poser_au_sol(coll, 1.5)


def convertisseur_t2(coll, leger=True):
    """Convertisseur Bessemer (électrique) : 3 x 3 cases, 3,9 unités max (1,95 m = 1,3 x 1,5). Sortie devant (-Y).

    Grande cornue en forme d'œuf en tôle rivetée, au nez recourbé vers l'avant, posée sur deux tourillons entre deux
    piliers d'acier : ceinture des tourillons, cerclages, boîte à vent sous le fond, conduite d'air qui descend du
    tourillon gauche jusqu'à la boîte à vent. Gerbe de flammes et d'étincelles qui sort de la gueule. Couronne dentée sur le
    tourillon droit et crémaillère à vérin (basculement d'entretien, fixes en jeu). Devant, en bas de la cornue : trou de
    coulée avec une trappe qui s'ouvre au-dessus de la lingotière et laisse couler le métal en fusion. Soufflante
    électrique (volute et moteur) à l'arrière gauche, qui envoie l'air dans le tourillon gauche par un joint tournant ;
    armoire électrique à l'arrière droite. Devant (sortie) : convoyeur ; la cornue verse dans une lingotière qui
    passe sous un petit portique de démoulage (poinçon, arrosage) et en ressort en un lingot.
    La cornue est fixe. Pièces mobiles : `trappe_` (trappe du trou de coulée, dessinée ouverte) ; `coulee_` (filet de
    métal en fusion, visible quand la trappe est ouverte) ; `moule_`
    (lingotière) avance sous le portique ; `poincon_` descend chasser le lingot ; `lingot_` sort ; flammes
    `flamme_` / `coeur_` (vacillent, comme celles du fourneau). Pivots `pivot_trappe`, `pivot_moule`, `pivot_poincon`, `pivot_lingot`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 3,9.
    """
    rnd = random.Random(41)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    cor = T.Lot(coll, 'cornue')
    zt = 1.9  # axe des tourillons
    xp = 1.06  # piliers

    # --- Socle en béton avec la fosse sous la cornue (z 0 -> 0,22).
    T.box(coll, 'socle', (2.6, 1.9, 0.22), (0, 0.2, 0.11), 'pierre_sombre', bevel=0.03)
    T.box(coll, 'fosse', (1.0, 1.0, 0.01), (0, 0.1, 0.222), 'noir')
    for s in (-1, 1):
        lot.cube('fonte', (1.12, 0.06, 0.03), (0, 0.1 + s * 0.53, 0.235), 0)
        lot.cube('fonte', (0.06, 1.12, 0.03), (s * 0.53, 0.1, 0.235), 0)

    # --- Piliers d'acier, paliers des tourillons, contreventements.
    for s in (-1, 1):
        x = s * xp
        lot.cube('fonte', (0.4, 0.7, 0.04), (x, 0, 0.24), 0.01)  # semelle
        lot.cube('acier', (0.2, 0.18, zt - 0.38), (x, 0, 0.22 + (zt - 0.38) / 2), 0.01 * bv)  # âme
        for dy in (-1, 1):
            lot.cube('acier', (0.26, 0.04, zt - 0.38), (x, dy * 0.11, 0.22 + (zt - 0.38) / 2), 0)  # ailes
            lot.barre('acier', (x, dy * 0.32, 0.26), (x, dy * 0.1, 1.15), 0.08, 0)  # jambes de force
        lot.cube('fonte', (0.3, 0.4, 0.26), (x, 0, zt - 0.08), 0.02)  # palier
        lot.cube('acier', (0.32, 0.3, 0.08), (x, 0, zt + 0.1), 0.015)  # chapeau
        for dy in (-0.13, 0.13):
            lot.cube('acier', (0.05, 0.05, 0.06), (x, dy, zt + 0.17), 0)  # écrous
        lot.tube('cuivre', (x, 0, zt + 0.14), (x, 0, zt + 0.22), 0.025, 6)  # graisseur
    # --- Cornue (groupe `cornue_`) : œuf en tôle, nez recourbé vers l'avant (-Y).
    prof = [(0.42, 0.62), (0.6, 0.72), (0.74, 0.95), (0.8, 1.3), (0.8, 2.0), (0.74, 2.35), (0.6, 2.7), (0.45, 2.98),
            (0.35, 3.16)]
    z_nez, k_nez = 2.35, 0.55

    def rayon(z):
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            if z0 <= z <= z1:
                return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        return prof[-1][0]

    def nez(z):  # décalage vers l'avant du nez recourbé
        return -k_nez * max(z - z_nez, 0) ** 2

    def courber(o):
        for v in o.data.vertices:
            v.co.y += nez(v.co.z)

    courber(T.tour(coll, 'cornue_corps', prof, 'fonte', seg, fond=True, dessus=False))
    courber(T.tour(coll, 'cornue_levre', [(0.38, 3.1), (0.38, 3.2), (0.3, 3.2)], 'fonte', seg, fond=False, dessus=False))
    courber(T.tour(coll, 'cornue_gueule', [(0.3, 3.19), (0.3, 3.195)], 'noir', seg, fond=False))
    courber(T.tour(coll, 'cornue_bain', [(0.2, 3.195), (0.2, 3.2)], 'braise', seg, fond=False))
    for z in (0.95, 1.45, 2.3, 2.75):  # cerclages
        r = rayon(z) + 0.02
        courber(T.tour(coll, f'cornue_cercle_{z}', [(r, z - 0.03), (r, z + 0.03)], 'acier_sombre', seg))
        if not leger:
            for i in range(20):  # rivets
                a = 2 * math.pi * i / 20
                cor.cube('acier', (0.03, 0.03, 0.03), (r * math.cos(a), r * math.sin(a) + nez(z), z), 0,
                         Matrix.Rotation(a, 3, 'Z'))
    T.tour(coll, 'cornue_ceinture', [(0.86, zt - 0.15), (0.86, zt + 0.15)], 'rouge', seg)
    for dz in (-0.15, 0.15):
        T.tour(coll, f'cornue_ceinture_bord_{dz}', [(0.89, zt + dz - 0.025), (0.89, zt + dz + 0.025)], 'fonte', seg)
    cor.tube('acier', (-1.24, 0, zt), (1.26, 0, zt), 0.1, sg)  # tourillons
    for s in (-1, 1):
        cor.tube('fonte', (s * 0.86, 0, zt), (s * 0.94, 0, zt), 0.17, sg)  # moyeux des tourillons
    # Boîte à vent sous le fond, boulonnée.
    T.tour(coll, 'cornue_boite', [(0.36, 0.48), (0.36, 0.63)], 'acier_sombre', seg)
    T.tour(coll, 'cornue_fond', [(0.42, 0.45), (0.42, 0.5)], 'fonte', seg)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        cor.cube('acier', (0.04, 0.04, 0.03), (0.39 * math.cos(a), 0.39 * math.sin(a), 0.515), 0)
    # Conduite d'air : du tourillon gauche (creux) jusqu'à la boîte à vent.
    pts = [Vector((-0.94, 0, zt - 0.16)), Vector((-0.92, 0, 1.12)), Vector((-0.62, 0, 0.62)), Vector((-0.36, 0, 0.56))]
    for a, b in zip(pts, pts[1:]):
        cor.tube('fonte', a, b, 0.07, sg)
    for p in pts[1:3]:
        cor.boule('fonte', p, 0.08)
    cor.cube('fonte', (0.2, 0.22, 0.08), (-0.94, 0, zt - 0.16), 0.01)  # coude sur le tourillon
    # Couronne dentée sur le tourillon droit.
    rg = 0.4
    cor.tube('rouge', (1.2, 0, zt), (1.28, 0, zt), rg, seg)
    cor.tube('acier_sombre', (1.18, 0, zt), (1.36, 0, zt), 0.16, sg)  # moyeu (couvre le bout du tourillon)
    cor.tube('acier', (1.36, 0, zt), (1.39, 0, zt), 0.09, sg)  # chapeau du moyeu
    for k in range(4):  # bras, du moyeu à la jante, plaqués sur la face extérieure
        a = math.pi / 4 + k * math.pi / 2
        d = Matrix.Rotation(a, 3, 'X') @ Vector((0, 0, 1))
        m = (0.16 + rg - 0.04) / 2
        cor.cube('acier_sombre', (0.05, 0.06, rg - 0.2), (1.305, d.y * m, zt + d.z * m), 0, Matrix.Rotation(a, 3, 'X'))
    n_d = 18 if leger else 28
    for k in range(n_d):
        a = 2 * math.pi * k / n_d
        cor.cube('acier', (0.08, 0.06, 0.06), (1.24, (rg + 0.02) * math.cos(a), zt + (rg + 0.02) * math.sin(a)), 0,
                 Matrix.Rotation(a - math.pi / 2, 3, 'X'))

    # --- Crémaillère verticale derrière la couronne, sur un vérin (basculement d'entretien : fixe en jeu).
    xr, yr = 1.24, rg + 0.08
    lot.cube('acier_sombre', (0.08, 0.08, 1.25), (xr, yr, 1.88), 0.01 * bv)
    for k in range(17):
        lot.cube('acier', (0.07, 0.04, 0.03), (xr, yr - 0.055, 1.32 + k * 0.07), 0)
    lot.tube('acier', (xr, yr, 0.95), (xr, yr, 1.27), 0.035, sg)  # tige du vérin
    lot.tube('acier', (xr, yr, 0.26), (xr, yr, 0.98), 0.09, sg)  # corps du vérin
    lot.tube('acier_sombre', (xr, yr, 0.94), (xr, yr, 1.0), 0.11, sg)
    lot.tube('acier_sombre', (xr, yr, 0.24), (xr, yr, 0.3), 0.11, sg)
    lot.cube('fonte', (0.26, 0.26, 0.04), (xr, yr, 0.24), 0.01)
    for z in (1.55, 2.25):  # guides fixés au pilier
        lot.cube('fonte', (0.14, 0.04, 0.1), (xr, yr + 0.06, z), 0)
        lot.barre('fonte', (xp + 0.06, 0.11, z), (xr, yr + 0.06, z), 0.05, 0)
    lot.tube('noir', (xr, yr + 0.09, 0.4), (xr, 1.2, 0.4), 0.025, 6)  # flexible vers l'armoire

    # --- Soufflante électrique (arrière gauche) et conduite d'air vers le tourillon gauche (joint tournant).
    yv = 1.12
    T.cylinder_at(coll, 'soufflante_volute', 0.34, 0.26, (-0.95, yv, 0.62), 'acier_sombre', segments=seg, y=90)
    T.cylinder_at(coll, 'soufflante_flasque', 0.2, 0.3, (-0.95, yv, 0.62), 'fonte', segments=sg, y=90)
    lot.cube('fonte', (0.46, 0.5, 0.06), (-0.85, yv, 0.25), 0.01)  # semelle
    lot.cube('acier_sombre', (0.2, 0.3, 0.26), (-0.95, yv, 0.36), 0.01)  # pied de la volute
    T.cylinder_at(coll, 'moteur', 0.17, 0.34, (-0.6, yv, 0.5), 'bleu', segments=sg, y=90)
    for k in range(6 if leger else 10):  # ailettes
        a = 2 * math.pi * k / (6 if leger else 10)
        lot.cube('acier_sombre', (0.3, 0.025, 0.04), (-0.6, yv + 0.18 * math.cos(a), 0.5 + 0.18 * math.sin(a)), 0,
                 Matrix.Rotation(a - math.pi / 2, 3, 'X'))
    lot.cube('bleu', (0.3, 0.3, 0.16), (-0.6, yv, 0.33), 0.01)  # pattes du moteur
    lot.cube('acier_sombre', (0.1, 0.12, 0.08), (-0.6, yv, 0.71), 0)  # boîte à bornes
    lot.tube('acier', (-0.82, yv, 0.62), (-0.77, yv, 0.62), 0.05, sg)  # accouplement
    air = [Vector((-1.08, yv, 0.62)), Vector((-1.32, yv, 0.62)), Vector((-1.32, yv, zt)), Vector((-1.32, 0, zt)),
           Vector((-1.24, 0, zt))]
    for a, b in zip(air, air[1:]):
        lot.tube('acier', a, b, 0.08, sg)
    for p in air[1:4]:
        lot.boule('acier', p, 0.095)
    lot.tube('fonte', (-1.3, 0, zt), (-1.2, 0, zt), 0.14, sg)  # joint tournant
    lot.tube('fonte', (-1.32, yv, 1.2), (-1.32, yv, 1.26), 0.11, sg)  # bride
    lot.barre('acier_sombre', (-1.32, yv - 0.09, 1.5), (-xp, 0.11, 1.5), 0.05, 0)  # collier fixé au pilier

    # --- Armoire électrique (arrière droite) : portes, voyants, levier, câble vers la soufflante.
    T.box(coll, 'armoire', (0.56, 0.3, 0.86), (0.62, 1.28, 0.65), 'acier', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.62, 0.36, 0.05), (0.62, 1.28, 1.105), 'acier_sombre', bevel=0.01)
    T.borne_electrique(coll, lot, (0.8, 1.28, 1.13), 0.4, sg)  # borne électrique : le câble du jeu s'accroche à sa boule
    lot.cube('acier_sombre', (0.01, 0.01, 0.74), (0.62, 1.12, 0.65), 0)  # joint des portes
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (0.44 + i * 0.08, 1.125, 0.95), 0)
    lot.cube('noir', (0.03, 0.06, 0.2), (0.82, 1.1, 0.68), 0, Matrix.Rotation(0.4, 3, 'X'))  # levier
    lot.cube('jaune', (0.14, 0.01, 0.12), (0.62, 1.123, 0.8), 0)  # plaque « danger »
    lot.barre('noir', (0.34, 1.24, 0.26), (-0.42, yv, 0.26), 0.04, 0)  # câble vers le moteur

    # --- Devant (sortie, -Y) : convoyeur ; la cornue verse dans une lingotière (groupe `moule_`), qui passe
    # sous un petit portique (démoulage : un poinçon, groupe `poincon_`, chasse le lingot) et en ressort en lingot.
    xt, zr = 0.3, 0.42  # demi-largeur (pieds, portique), dessus de la bande
    y0, y1 = -0.55, -1.47
    # Convoyeur commun qui avance : lames en flèche et lingot sorti du portique (groupe `lingot_`, y = -1,32).
    def lingot(g, k, p, d, w, n, rot):
        if k != 3:
            return
        yl = p.y
        g.cube('acier', (0.3, 0.2, 0.12), (0, yl, zr + 0.06), 0.02 * bv)
        g.cube('acier', (0.24, 0.14, 0.04), (0, yl, zr + 0.13), 0.01 * bv)
        g.cube('braise', (0.2, 0.01, 0.06), (0, yl - 0.101, zr + 0.06), 0)  # encore chaud au cœur
    li, _, _ = T.convoyeur_charge(coll, 'lingot', lot, (0, y0 - 0.05, zr - 0.09), (0, y1 + 0.05, zr - 0.09), 0.5, 0.08,
                                  0.22, lingot, debut=0.06, fin=-0.2, rouleaux=3, sg=sg)
    for sx in (-1, 1):
        for y in (-0.66, -1.38):
            lot.cube('acier_sombre', (0.05, 0.05, zr - 0.2), (sx * 0.31, y, (zr - 0.2) / 2), 0)  # pieds
            lot.cube('fonte', (0.1, 0.1, 0.02), (sx * 0.31, y, 0.01), 0)
    # Lingotière pleine de métal en fusion, sous le bec de la cornue.
    mo = T.Lot(coll, 'moule')
    ym = -0.78
    mo.cube('fonte', (0.4, 0.34, 0.26), (0, ym, zr + 0.13), 0.02 * bv)
    for dy in (-0.19, 0.19):
        mo.cube('fonte', (0.46, 0.04, 0.06), (0, ym + dy, zr + 0.2), 0)  # oreilles
    mo.cube('noir', (0.3, 0.24, 0.01), (0, ym, zr + 0.262), 0)
    mo.cube('braise', (0.26, 0.2, 0.01), (0, ym, zr + 0.266), 0)
    T.pivot(coll, 'pivot_moule', (0, ym, zr), (0, 1, 0))
    # Petit portique de démoulage, poinçon et rampe d'arrosage.
    yq, zq = -1.1, 1.0
    for sx in (-1, 1):
        lot.cube('acier', (0.08, 0.1, zq - 0.02), (sx * (xt + 0.08), yq, (zq - 0.02) / 2), 0.01 * bv)
        lot.cube('fonte', (0.16, 0.18, 0.03), (sx * (xt + 0.08), yq, 0.015), 0)
    lot.cube('acier', (2 * xt + 0.32, 0.14, 0.12), (0, yq, zq), 0.015)  # traverse
    for k in range(5):
        lot.cube('jaune' if k % 2 == 0 else 'noir', (0.1, 0.142, 0.08), (-0.2 + k * 0.1, yq, zq), 0)
    lot.cube('acier_sombre', (0.24, 0.18, 0.16), (0, yq, zq + 0.14), 0.015)  # vérin du poinçon
    lot.tube('acier_sombre', (0, yq, zq - 0.06), (0, yq, zq - 0.12), 0.07, sg)
    po = T.Lot(coll, 'poincon')
    po.tube('acier', (0, yq, zq - 0.12), (0, yq, zr + 0.44), 0.035, sg)  # tige
    po.cube('acier_sombre', (0.26, 0.2, 0.05), (0, yq, zr + 0.41), 0.01)  # tête du poinçon
    T.pivot(coll, 'pivot_poincon', (0, yq, zr + 0.385), (0, 0, 1))
    lot.tube('bleu', (-xt - 0.08, yq + 0.09, zq - 0.08), (xt + 0.08, yq + 0.09, zq - 0.08), 0.025, 6)  # arrosage
    for x in (-0.15, 0.0, 0.15):
        lot.cube('acier_sombre', (0.03, 0.03, 0.04), (x, yq + 0.09, zq - 0.12), 0)  # buses
    lot.barre('bleu', (xt + 0.08, yq + 0.09, zq - 0.08), (xt + 0.08, yq + 0.09, 0.05), 0.04, 0)

    # --- Trou de coulée en bas de la cornue, côté sortie : boîtier boulonné, busette, trappe (groupe `trappe_`, dessinée
    # ouverte) et filet de métal en fusion (groupe `coulee_`) qui tombe dans la lingotière.
    yc, zc = ym, 0.92  # axe de la busette (au-dessus du centre de la lingotière), bas de la busette
    lot.cube('acier_sombre', (0.28, 0.16, 0.22), (0, yc - 0.02, 1.08), 0.015)  # boîtier contre la cornue
    lot.cube('fonte', (0.36, 0.04, 0.3), (0, yc + 0.03, 1.08), 0.01)  # bride
    for dx in (-0.13, 0.13):
        for dz in (-0.1, 0.1):
            lot.cube('acier', (0.035, 0.03, 0.035), (dx, yc + 0.005, 1.08 + dz), 0)
    lot.tube('fonte', (0, yc, 0.97), (0, yc, zc), 0.065, sg)  # busette
    lot.tube('braise', (0, yc, zc + 0.002), (0, yc, zc - 0.001), 0.04, sg)
    tr = T.Lot(coll, 'trappe')
    xh, ang = 0.08, math.radians(-75)  # charnière côté +X ; trappe ouverte, rabattue vers le bas
    ouv = Matrix.Rotation(ang, 3, 'Y')
    pl = Vector((xh, yc, zc - 0.015)) + ouv @ Vector((-0.08, 0, 0))
    tr.cube('acier', (0.16, 0.16, 0.025), tuple(pl), 0, ouv)
    tr.tube('acier_sombre', (xh, yc - 0.1, zc - 0.015), (xh, yc + 0.09, zc - 0.015), 0.02, 6)  # axe de la charnière
    bl = Vector((xh, yc - 0.1, zc - 0.015)) + ouv @ Vector((0.1, 0, 0))
    tr.barre('acier_sombre', (xh, yc - 0.1, zc - 0.015), tuple(bl), 0.03, 0)  # levier
    T.pivot(coll, 'pivot_trappe', (xh, yc, zc - 0.015), (0, 1, 0))
    lot.tube('acier', (0.2, yc - 0.1, 1.1), (0.2, yc - 0.1, 1.0), 0.03, sg)  # petit vérin de la trappe
    lot.tube('acier_sombre', (0.2, yc - 0.1, 1.0), tuple(bl), 0.014, 6)
    cl = T.Lot(coll, 'coulee')
    cl.tube('braise', (0, yc, zc - 0.005), (0, yc, zr + 0.27), 0.03, sg)
    cl.tube('flamme', (0, yc, zc - 0.04), (0, yc, zr + 0.3), 0.016, 6)

    # --- Gerbe de flammes et d'étincelles au-dessus de la gueule.
    zg, yg = 3.2, nez(3.2)
    for x, y, h, r in ((0.0, 0.0, 0.5, 0.22), (-0.1, 0.06, 0.36, 0.13), (0.11, -0.05, 0.4, 0.14)):
        T.cylinder(coll, f'flamme_{x}', r, h, (x, yg + y, zg + h / 2), 'braise', segments=6, radius_top=0.0)
        T.cylinder(coll, f'coeur_{x}', r * 0.55, h * 0.65, (x, yg + y, zg + h * 0.33), 'flamme', segments=6,
                   radius_top=0.0)
    et = T.Lot(coll, 'flamme_etincelles')
    for _ in range(10 if leger else 22):
        a, d = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.15, 0.5)
        t = rnd.uniform(0.025, 0.045)
        et.cube(rnd.choice(('flamme', 'braise')), (t, t, t), (d * math.cos(a), yg + d * math.sin(a), zg + rnd.uniform(0.2, 0.62)),
                0, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    for l in (lot, cor, et, mo, po, li, tr, cl):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'fourneau_t1': fourneau_t1, 'fourneau_electrique_t2': fourneau_electrique_t2,
           'convertisseur_t2': convertisseur_t2}


def construire():
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        # Masquée avec l'œil de l'Outliner (et non « désactiver dans les vues », qui grise l'œil).
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter():
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'fonderie.blend'))


if __name__ == '__main__':
    main()
