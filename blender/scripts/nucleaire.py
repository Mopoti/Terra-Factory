"""Famille « nucléaire » : centrifugeuse (et plus tard réacteur à fission, vitrificateur…).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/nucleaire.py
Produit :  blender/nucleaire.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


def _tuyau(lot, pts, mat, r, sg, coudes=True):
    """Tuyau à coudes passant par les points `pts`."""
    pts = [Vector(p) for p in pts]
    for a, b in zip(pts, pts[1:]):
        lot.tube(mat, a, b, r, sg)
    if coudes:
        for p in pts[1:-1]:
            lot.boule(mat, p, r * 1.2)


def _trefle(lot, p, normale, taille=0.16):
    """Panneau « danger radioactif » : carré jaune, trèfle noir stylisé (centre et trois pales)."""
    p, n = Vector(p), Vector(normale).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
    lot.cube('jaune', (taille, taille, 0.01), tuple(p), 0, rot)
    lot.cube('noir', (taille * 0.14, taille * 0.14, 0.012), tuple(p + n * 0.002), 0, rot)
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        q = rot @ Vector((math.cos(a), math.sin(a), 0)) * taille * 0.26
        lot.cube('noir', (taille * 0.22, taille * 0.2, 0.012), tuple(p + q + n * 0.002), 0, rot @ Matrix.Rotation(a, 3, 'Z'))


def centrifugeuse_t4(coll, leger=True):
    """Centrifugeuse d'enrichissement T4 (électrique, 120 kW) : 3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y).

    Une grosse centrifugeuse industrielle verticale au centre, montée sur quatre pieds : carter blanc à hublots
    lumineux cyan, couvercle bombé, moteur et volant d'inertie au sommet. Le minerai arrive par le convoyeur d'entrée
    (derrière) qui monte et entre dans la bouche d'alimentation au dos du carter. Sous la centrifugeuse, le cône de vidange et sa goulotte déposent les produits
    sur le convoyeur de sortie, qui passe entre les pieds (capsules d'uranium enrichi vertes, conteneurs d'uranium
    appauvri gris). Derrière à gauche : raccordement électrique (poteau T2 commun `T.poteau_electrique`, transformateur). Derrière à droite : groupe froid à ventilateur relié à la double enveloppe du carter. Devant :
    pupitre à écrans (gauche) et armoire du convertisseur de fréquence (droite). Panneaux « danger radioactif ».
    Pièces mobiles : `rotor_` (volant d'inertie et accouplement au sommet) tourne vite ; `voyant_` (hublots et anneau
    lumineux) pulse ; `ventilateur_` tourne ; `entree_` et `sortie_` (marchandises sur les convoyeurs) avancent.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    st = 6 if leger else 10
    lot = T.Lot(coll, 'pieces')
    if leger:
        lot.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(lot.cube)

    # --- Dalle technique sur toute l'emprise, bandes de sécurité autour du convoyeur de sortie.
    T.box(coll, 'dalle', (2.9, 2.9, 0.06), (0, 0, 0.03), 'acier_sombre', bevel=0.01)
    for k in range(6):
        lot.cube('acier', (2.86, 0.006, 0.004), (0, -1.2 + k * 0.48, 0.062), 0)
    for sx in (-1, 1):
        for k in range(12):
            lot.cube('jaune' if k % 2 == 0 else 'noir', (0.05, 0.12, 0.004), (sx * 0.3, -1.38 + k * 0.12, 0.063), 0)

    # --- Centrifugeuse : centre (0 ; 0,1), carter blanc sur quatre pieds.
    cx, cy = 0.0, -0.05
    rc, zb, zh = 0.62, 0.75, 1.6
    T.tour(coll, 'carter', [(0.12, 0.56), (0.5, zb - 0.06), (rc, zb), (rc, zh), (rc - 0.08, zh + 0.1), (0.3, zh + 0.18)],
           'blanc', segments=seg, centre=(cx, cy))
    for z in (zb + 0.04, zh - 0.04):  # cerclages
        T.tour(coll, f'cerclage_{int(z * 100)}', [(rc + 0.025, z - 0.03), (rc + 0.025, z + 0.03)], 'gris_clair',
               segments=seg, centre=(cx, cy))
    T.tour(coll, 'bride_couvercle', [(rc + 0.04, zh - 0.01), (rc + 0.04, zh + 0.03)], 'acier_sombre', segments=seg,
           centre=(cx, cy))
    nb = 8 if leger else 12
    for k in range(nb):  # boulons de la bride
        a = 2 * math.pi * (k + 0.5) / nb
        lot.cube('acier', (0.03, 0.03, 0.03), (cx + (rc + 0.03) * math.cos(a), cy + (rc + 0.03) * math.sin(a), zh + 0.045), 0)
    vo = T.Lot(coll, 'voyant')
    T.tour(coll, 'voyant_anneau', [(rc + 0.008, 1.32), (rc + 0.008, 1.36)], 'cyan', segments=seg, centre=(cx, cy))
    for k in range(6):  # hublots lumineux (pas derrière : bouche d'alimentation)
        if k == 3:
            continue
        a = math.radians(-90 + 60 * k)
        n = Vector((math.cos(a), math.sin(a), 0))
        p = Vector((cx, cy, 1.1)) + n * (rc + 0.005)
        rot = Matrix.Rotation(a, 3, 'Z')
        lot.cube('acier_sombre', (0.02, 0.2, 0.26), tuple(p), 0, rot)
        vo.cube('cyan', (0.012, 0.15, 0.2), tuple(p + n * 0.008), 0, rot)
    # Pieds, ceinture et contreventement : les pieds sont en diagonale pour laisser passer le convoyeur.
    for k in range(4):
        a = math.radians(45 + 90 * k)
        x, y = cx + 0.55 * math.cos(a), cy + 0.55 * math.sin(a)
        lot.cube('gris_clair', (0.1, 0.1, zb), (x, y, zb / 2), 0)
        lot.cube('acier_sombre', (0.2, 0.2, 0.04), (x, y, 0.08), 0)  # platine
        lot.cube('gris_clair', (0.14, 0.14, 0.08), (x, y, zb - 0.02), 0, Matrix.Rotation(a, 3, 'Z'))  # console
    # Cône de vidange et goulotte au-dessus du convoyeur de sortie.
    T.tour(coll, 'goulotte', [(0.1, 0.5), (0.12, 0.56)], 'acier', segments=sg, centre=(cx, cy), fond=False)
    lot.cube('acier', (0.3, 0.3, 0.02), (cx, cy, 0.5), 0)
    for sx in (-1, 1):  # joues de la goulotte
        lot.cube('acier_sombre', (0.02, 0.36, 0.12), (cx + sx * 0.16, cy - 0.04, 0.44), 0)
    _trefle(lot, (cx, cy - rc - 0.006, 1.48), (0, -1, 0), 0.16)

    # --- Sommet : support moteur, volant d'inertie (groupe `rotor_`), moteur.
    zt = zh + 0.18
    T.cylinder(coll, 'palier', 0.18, 0.08, (cx, cy, zt + 0.04), 'acier_sombre', segments=sg)
    ro = T.Lot(coll, 'rotor')
    ro.tube('acier', (cx, cy, zt + 0.08), (cx, cy, zt + 0.3), 0.05, sg)  # arbre
    ro.tube('gris_clair', (cx, cy, zt + 0.12), (cx, cy, zt + 0.18), 0.32, seg)  # volant
    ro.tube('acier_sombre', (cx, cy, zt + 0.18), (cx, cy, zt + 0.2), 0.12, sg)
    for k in range(4):  # repères bien visibles quand il tourne
        a = math.pi / 2 * k
        ro.cube('jaune' if k % 2 == 0 else 'noir', (0.12, 0.05, 0.01),
                (cx + 0.24 * math.cos(a), cy + 0.24 * math.sin(a), zt + 0.185), 0, Matrix.Rotation(a, 3, 'Z'))
    T.pivot(coll, 'pivot_rotor', (cx, cy, zt + 0.15), (0, 0, 1))
    for k in range(3):  # trépied du moteur
        a = math.radians(30 + 120 * k)
        lot.barre('acier_sombre', (cx + 0.42 * math.cos(a), cy + 0.42 * math.sin(a), zh + 0.1),
                  (cx + 0.16 * math.cos(a), cy + 0.16 * math.sin(a), zt + 0.36), 0.04)
    lot.tube('gris_clair', (cx, cy, zt + 0.3), (cx, cy, zt + 0.6), 0.17, sg)  # moteur
    lot.tube('acier_sombre', (cx, cy, zt + 0.32), (cx, cy, zt + 0.36), 0.185, sg)
    for k in range(8 if leger else 12):  # ailettes du moteur
        a = 2 * math.pi * k / (8 if leger else 12)
        lot.cube('acier_sombre', (0.03, 0.012, 0.22),
                 (cx + 0.175 * math.cos(a), cy + 0.175 * math.sin(a), zt + 0.47), 0, Matrix.Rotation(a, 3, 'Z'))
    lot.tube('acier_sombre', (cx, cy, zt + 0.6), (cx, cy, zt + 0.64), 0.12, sg)
    lot.cube('acier_sombre', (0.12, 0.1, 0.1), (cx + 0.2, cy, zt + 0.5), 0)  # boîte à bornes

    # --- Entrée : le convoyeur monte de l'arrière et entre dans la bouche d'alimentation, au dos du carter.
    yb = cy + rc  # dos du carter
    T.box(coll, 'bouche', (0.48, 0.26, 0.4), (cx, yb + 0.08, 0.98), 'gris_clair', bevel=0.015)
    lot.cube('acier_sombre', (0.52, 0.32, 0.04), (cx, yb + 0.1, 1.2), 0.005, Matrix.Rotation(math.radians(12), 3, 'X'))  # auvent
    lot.cube('noir', (0.38, 0.012, 0.28), (cx, yb + 0.212, 0.97), 0)  # ouverture
    for sx in (-1, 1):
        lot.cube('jaune', (0.035, 0.014, 0.3), (cx + sx * 0.21, yb + 0.214, 0.97), 0)  # cadre jaune
    lot.cube('jaune', (0.45, 0.014, 0.035), (cx, yb + 0.214, 1.13), 0)
    for k in range(3):  # rideau à lanières (laisse passer le minerai)
        lot.cube('acier_sombre', (0.1, 0.006, 0.12), (cx - 0.12 + k * 0.12, yb + 0.22, 1.05), 0)
    E0, E1 = Vector((cx, 1.42, 0.3)), Vector((cx, yb + 0.08, 0.93))
    de, we, ne, re_ = T.convoyeur(lot, E0, E1, 0.3, 0.07, rouleaux=1, sg=sg)
    for sx in (-1, 1):
        lot.cube('acier', (0.04, 0.04, 0.26), (cx + sx * 0.19, 1.36, 0.13), 0)
        lot.cube('acier', (0.04, 0.04, 0.6), (cx + sx * 0.19, 0.96, 0.3), 0)
    en = T.Lot(coll, 'entree')
    le = (E1 - E0).length
    for k in range(4):  # tasseaux (la bande monte fort)
        p = E0 + de * (le * (0.15 + 0.22 * k)) + ne * 0.085
        en.cube('acier_sombre', (0.02, 0.28, 0.04), tuple(p), 0, re_)
    for k in range(2):
        p = E0 + de * (le * (0.26 + 0.44 * k)) + ne * (0.07 + 0.035)
        en.cube('jaune', (0.1, 0.1, 0.06), tuple(p), 0, re_)  # « yellowcake »
        en.cube('orange', (0.06, 0.06, 0.03), tuple(p + ne * 0.045), 0, re_)
    T.pivot(coll, 'pivot_entree', tuple(E0 + ne * 0.07), tuple(de))
    # --- Derrière à gauche : raccordement électrique. Poteau T2 (fonction commune) -> transformateur -> caniveau.
    pt = Vector((-1.18, 1.3, 0.06))
    accroches = T.poteau_electrique(lot, tuple(pt), niveau=2, hauteur=2.3, sg=sg)
    xt, yt = -0.9, 0.75
    T.box(coll, 'transformateur', (0.5, 0.45, 0.62), (xt, yt, 0.06 + 0.31 + 0.04), 'vert_fonce', bevel=0.015)
    lot.cube('acier_sombre', (0.56, 0.5, 0.04), (xt, yt, 0.08), 0)  # socle
    lot.cube('acier_sombre', (0.54, 0.49, 0.03), (xt, yt, 0.735), 0.005)  # couvercle
    for k in range(5):  # radiateurs (ailettes) sur le côté gauche et devant
        lot.cube('vert_fonce', (0.12, 0.016, 0.46), (xt - 0.31, yt - 0.16 + k * 0.08, 0.38), 0)
        lot.cube('vert_fonce', (0.016, 0.1, 0.46), (xt - 0.16 + k * 0.08, yt - 0.275, 0.38), 0)
    lot.tube('vert_fonce', (xt - 0.2, yt + 0.12, 0.86), (xt + 0.2, yt + 0.12, 0.86), 0.07, sg)  # conservateur d'huile
    for dx in (-0.14, 0.14):
        lot.cube('acier_sombre', (0.03, 0.03, 0.12), (xt + dx, yt + 0.12, 0.79), 0)
    bornes = []
    for dx in (-0.15, 0.0, 0.15):  # traversées haute tension
        for k in range(4):
            lot.tube('blanc', (xt + dx, yt - 0.08, 0.75 + k * 0.05), (xt + dx, yt - 0.08, 0.78 + k * 0.05), 0.035 - k * 0.003, sg)
        lot.tube('acier', (xt + dx, yt - 0.08, 0.95), (xt + dx, yt - 0.08, 0.98), 0.012, 4)
        bornes.append(Vector((xt + dx, yt - 0.08, 0.98)))
    for a, b in zip(accroches, bornes):  # câbles du poteau aux traversées
        m = (a + b) / 2 + Vector((0, 0, -0.12))  # léger fléchissement
        lot.tube('noir', a, m, 0.008, 4)
        lot.tube('noir', m, b, 0.008, 4)
    lot.cube('jaune', (0.2, 0.01, 0.1), (xt + 0.1, yt - 0.231, 0.55), 0)  # plaque « haute tension »
    lot.cube('noir', (0.02, 0.012, 0.07), (xt + 0.1, yt - 0.236, 0.55), 0, Matrix.Rotation(0.4, 3, 'Y'))
    lot.cube('acier_sombre', (0.12, 1.55, 0.04), (-1.32, -0.2, 0.08), 0)  # caniveau à câbles vers le pupitre
    lot.cube('acier_sombre', (0.4, 0.12, 0.04), (xt - 0.3 + 0.1, yt - 0.3, 0.08), 0)

    # --- Sortie : convoyeur sous la goulotte, entre les pieds, jusqu'au bord avant.
    S0, S1 = Vector((cx, cy + 0.12, 0.32)), Vector((cx, -1.42, 0.28))
    ds, ws, ns, rs = T.convoyeur(lot, S0, S1, 0.36, 0.08, rouleaux=2, sg=sg)
    for y in (-0.7, -1.38):
        for sx in (-1, 1):
            lot.cube('acier', (0.04, 0.04, 0.2), (sx * 0.22, y, 0.12), 0)
    so = T.Lot(coll, 'sortie')
    ls = (S1 - S0).length
    p = S0 + ds * (ls * 0.42) + ns * 0.13
    so.tube('vert', p - ws * 0.07, p + ws * 0.07, 0.045, sg)  # capsule d'uranium enrichi
    so.tube('cyan', p - ws * 0.075, p - ws * 0.07, 0.03, sg)
    p = S0 + ds * (ls * 0.82) + ns * 0.13
    so.tube('acier_sombre', p - ws * 0.09, p + ws * 0.09, 0.05, sg)  # conteneur d'uranium appauvri
    so.tube('acier', p - ws * 0.095, p - ws * 0.09, 0.035, sg)
    T.pivot(coll, 'pivot_sortie', tuple(S0 + ns * 0.08), tuple(ds))

    # --- Derrière à droite : groupe froid à ventilateur, tuyaux vers la double enveloppe du carter.
    xf, yf = 1.05, 0.95
    T.box(coll, 'groupe_froid', (0.8, 0.9, 0.85), (xf, yf, 0.425), 'gris_clair', bevel=0.02)
    lot.cube('acier_sombre', (0.84, 0.94, 0.05), (xf, yf, 0.85), 0.005)
    T.cylinder(coll, 'ventilateur_cadre', 0.32, 0.06, (xf, yf, 0.88), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'ventilateur_fond', 0.29, 0.01, (xf, yf, 0.86), 'noir', segments=seg)
    ve = T.Lot(coll, 'ventilateur')
    for k in range(5):
        a = 2 * math.pi * k / 5
        ve.cube('blanc', (0.24, 0.08, 0.012), (xf + 0.14 * math.cos(a), yf + 0.14 * math.sin(a), 0.88), 0,
                Matrix.Rotation(a, 3, 'Z') @ Matrix.Rotation(0.4, 3, 'X'))
    ve.tube('acier_sombre', (xf, yf, 0.87), (xf, yf, 0.9), 0.05, sg)
    T.pivot(coll, 'pivot_ventilateur', (xf, yf, 0.88), (0, 0, 1))
    for k in range(5):
        lot.cube('acier_sombre', (0.6, 0.012, 0.012), (xf, yf - 0.26 + k * 0.13, 0.915), 0)  # grille
    for k in range(6):
        lot.cube('noir', (0.02, 0.7, 0.025), (xf + 0.402, yf, 0.15 + k * 0.08), 0)  # ailettes
    _trefle(lot, (xf, yf - 0.452, 0.55), (0, -1, 0), 0.16)
    for k, (mat, z) in enumerate((('bleu', 0.95), ('rouge', 1.45))):
        a = math.radians(30 + k * 12)
        q = Vector((cx + (rc + 0.03) * math.cos(a), cy + (rc + 0.03) * math.sin(a), z))
        x0 = xf - 0.4
        _tuyau(lot, [(x0, yf - 0.2 + k * 0.14, 0.5 + k * 0.15), (q.x + 0.12, yf - 0.2 + k * 0.14, 0.5 + k * 0.15),
                     (q.x + 0.12, q.y, 0.5 + k * 0.15), (q.x + 0.12, q.y, z), (q.x, q.y, z)], mat, 0.03, st, not leger)
        lot.tube('acier_sombre', tuple(q), tuple(q + (q - Vector((cx, cy, z))).normalized() * 0.04), 0.05, sg)  # piquage

    # --- Devant : pupitre à écrans (gauche), armoire du convertisseur de fréquence (droite).
    xa = -1.05
    yf0, yf1, zf0, zf1 = -1.33, -0.91, 0.72, 0.9  # pupitre : bas devant, haut derrière (face à l'opérateur)
    T.extrusion(coll, 'pupitre', [(yf0, 0.06), (yf1, 0.06), (yf1, zf1), (yf0, zf0)], xa - 0.3, xa + 0.3, 'gris_clair')
    ang = math.atan2(zf1 - zf0, yf1 - yf0)
    pente = Matrix.Rotation(ang, 3, 'X')
    nrm = pente @ Vector((0, 0, 1))
    c = Vector((xa, (yf0 + yf1) / 2, (zf0 + zf1) / 2)) + nrm * 0.02
    lot.cube('acier_sombre', (0.62, 0.47, 0.04), tuple(c), 0.008, pente)

    def sur_pupitre(u, v, h=0.0):
        return tuple(c + pente @ Vector((u, v, 0.02 + h)))
    lot.cube('panneau', (0.5, 0.2, 0.01), sur_pupitre(-0.02, -0.1, 0.005), 0, pente)  # clavier
    for r in range(4):
        for k in range(10 if r < 3 else 6):
            lw = 0.035 if r < 3 else 0.06
            u = -0.22 + k * 0.045 if r < 3 else -0.2 + k * 0.065
            if r == 3 and k == 2:
                lw = 0.16  # barre d'espace
                u = -0.05
            elif r == 3 and k in (3, 4):
                continue
            lot.cube('gris_clair', (lw, 0.035, 0.015), sur_pupitre(u, -0.03 - r * 0.045, 0.015), 0, pente)
    lot.tube('acier_sombre', sur_pupitre(0.25, -0.1, 0.0), sur_pupitre(0.25, -0.1, 0.02), 0.04, sg)  # boule de commande
    lot.boule('cyan', sur_pupitre(0.25, -0.1, 0.025), 0.025)
    for k in range(5):  # voyants et boutons en haut du pupitre
        lot.cube(('vert', 'vert', 'jaune', 'cyan', 'vert')[k], (0.03, 0.03, 0.012), sur_pupitre(-0.2 + k * 0.06, 0.13, 0.01), 0, pente)
    lot.tube('rouge', sur_pupitre(0.22, 0.12, 0.0), sur_pupitre(0.22, 0.12, 0.03), 0.03, sg)  # arrêt d'urgence
    lot.tube('jaune', sur_pupitre(0.22, 0.12, -0.005), sur_pupitre(0.22, 0.12, 0.004), 0.045, sg)
    lot.cube('acier_sombre', (0.06, 0.06, 0.2), (xa, -0.94, zf1 + 0.08), 0)  # pied de l'écran
    lot.cube('gris_clair', (0.5, 0.06, 0.36), (xa, -0.94, zf1 + 0.34), 0.01)  # écran
    lot.cube('cyan', (0.44, 0.012, 0.29), (xa, -0.975, zf1 + 0.34), 0)
    for k in range(3):  # courbes à l'écran
        lot.cube('vert', (0.3 - k * 0.07, 0.006, 0.015), (xa - 0.04 + k * 0.03, -0.983, zf1 + 0.26 + k * 0.08), 0)
    xr = 1.1
    T.box(coll, 'armoire', (0.55, 0.5, 1.5), (xr, -1.05, 0.75), 'gris_clair', bevel=0.02)
    lot.cube('acier_sombre', (0.57, 0.52, 0.04), (xr, -1.05, 1.52), 0.005)
    lot.cube('acier_sombre', (0.01, 0.012, 1.3), (xr, -1.306, 0.75), 0)
    for j in range(3):
        lot.cube('cyan' if j == 0 else 'vert', (0.05, 0.012, 0.03), (xr - 0.15 + j * 0.08, -1.306, 1.3), 0)
    for j in range(5):
        lot.cube('noir', (0.4, 0.012, 0.025), (xr, -1.306, 0.25 + j * 0.06), 0)  # ouïes
    _trefle(lot, (xr + 0.14, -1.307, 0.95), (0, -1, 0), 0.12)

    for l in (lot, vo, ro, en, so, ve):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'centrifugeuse_t4': centrifugeuse_t4}



# Emprises agrandies dans le jeu (content/machines.json) : ces modèles, dessinés pour l'ancienne emprise, sont agrandis
# (mêmes proportions) juste assez pour remplir la nouvelle (± demi-largeur en X, ± demi-profondeur en Y).
EMPRISES = {
    'centrifugeuse_t4': (2.0, 2.0, False),
}


def _dans_emprise(fabrique, demi_x, demi_y, recentrer):
    def f(coll, leger=True):
        fabrique(coll, leger)
        T.agrandir_auto(coll, demi_x, demi_y, recentrer)
    return f


MODELES = {nom: (_dans_emprise(fab, *EMPRISES[nom]) if nom in EMPRISES else fab) for nom, fab in MODELES.items()}

def construire():
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
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
    T.save(os.path.join(ROOT, 'blender', 'nucleaire.blend'))


if __name__ == '__main__':
    main()
