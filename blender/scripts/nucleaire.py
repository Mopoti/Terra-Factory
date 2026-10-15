"""Famille « nucléaire » : centrifugeuse, réacteur à fission, réacteur à fusion (et plus tard vitrificateur…).

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

    def charge(g, k, p, d, w, n, rot):  # tasseau (la bande monte fort) et, un sur deux, un bloc de « yellowcake »
        g.cube('acier_sombre', (0.02, 0.28, 0.04), tuple(p + n * 0.015), 0, rot)
        if k % 2 == 0:
            q = p + d * 0.1 + n * 0.035
            g.cube('jaune', (0.1, 0.1, 0.06), tuple(q), 0, rot)
            g.cube('orange', (0.06, 0.06, 0.03), tuple(q + n * 0.045), 0, rot)
    en, _, _ = T.convoyeur_charge(coll, 'entree', lot, E0, E1, 0.3, 0.07, 0.24, charge, debut=0.15, rouleaux=1, sg=sg)
    for sx in (-1, 1):
        lot.cube('acier', (0.04, 0.04, 0.26), (cx + sx * 0.19, 1.36, 0.13), 0)
        lot.cube('acier', (0.04, 0.04, 0.6), (cx + sx * 0.19, 0.96, 0.3), 0)
    # --- Derrière à gauche : raccordement électrique. Borne (fonction commune : le câble du jeu s'accroche à sa boule)
    # -> transformateur -> caniveau.
    pt = Vector((-1.18, 1.3, 0.06))
    boule = T.borne_electrique(coll, lot, tuple(pt), 1.1, sg)
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
    for b in bornes:  # câbles de la borne aux traversées
        a = boule + Vector((0, 0, -0.17))
        m = (a + b) / 2 + Vector((0, 0, -0.1))  # léger fléchissement
        lot.tube('noir', a, m, 0.008, 4)
        lot.tube('noir', m, b, 0.008, 4)
    lot.cube('jaune', (0.2, 0.01, 0.1), (xt + 0.1, yt - 0.231, 0.55), 0)  # plaque « haute tension »
    lot.cube('noir', (0.02, 0.012, 0.07), (xt + 0.1, yt - 0.236, 0.55), 0, Matrix.Rotation(0.4, 3, 'Y'))
    lot.cube('acier_sombre', (0.12, 1.55, 0.04), (-1.32, -0.2, 0.08), 0)  # caniveau à câbles vers le pupitre
    lot.cube('acier_sombre', (0.4, 0.12, 0.04), (xt - 0.3 + 0.1, yt - 0.3, 0.08), 0)

    # --- Sortie : convoyeur sous la goulotte, entre les pieds, jusqu'au bord avant.
    S0, S1 = Vector((cx, cy + 0.12, 0.32)), Vector((cx, -1.42, 0.28))

    def fut(g, k, p, d, w, n, rot):  # capsule verte (enrichi) et conteneur gris (appauvri), en alternance
        q = p + n * 0.05
        if k % 2 == 0:
            g.tube('vert', q - w * 0.07, q + w * 0.07, 0.045, sg)
            g.tube('cyan', q - w * 0.075, q - w * 0.07, 0.03, sg)
        else:
            g.tube('acier_sombre', q - w * 0.09, q + w * 0.09, 0.05, sg)
            g.tube('acier', q - w * 0.095, q - w * 0.09, 0.035, sg)
    so, _, _ = T.convoyeur_charge(coll, 'sortie', lot, S0, S1, 0.36, 0.08, 0.36, fut, debut=0.5, rouleaux=2, sg=sg)
    for y in (-0.7, -1.38):
        for sx in (-1, 1):
            lot.cube('acier', (0.04, 0.04, 0.2), (sx * 0.22, y, 0.12), 0)

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


def _anneau_z(lot, mat, c, r, ep, n):
    """Anneau horizontal (plan XY), centre `c`, rayon `r`, section carrée `ep`."""
    c = Vector(c)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        lot.barre(mat, c + Vector((r * math.cos(a0), r * math.sin(a0), 0)), c + Vector((r * math.cos(a1), r * math.sin(a1), 0)), ep)


def _pompe_verticale(coll, lot, g, nom, p, sg, seg):
    """Pompe de circulation verticale (corps bleu, moteur, ventilateur du moteur dans le groupe `g`, axe Z)."""
    x, y = p
    T.cylinder(coll, nom + '_corps', 0.26, 0.5, (x, y, 0.2 + 0.25), 'bleu', segments=seg)
    lot.tube('acier_sombre', (x, y, 0.68), (x, y, 0.74), 0.28, seg)
    T.cylinder(coll, nom + '_moteur', 0.2, 0.5, (x, y, 0.74 + 0.25), 'acier', segments=seg)
    for k in range(4):
        lot.tube('acier', (x, y, 0.82 + k * 0.1), (x, y, 0.84 + k * 0.1), 0.22, seg)
    lot.tube('acier_sombre', (x, y, 1.24), (x, y, 1.3), 0.22, seg)
    g.tube('acier_sombre', (x, y, 1.3), (x, y, 1.36), 0.06, 8)
    for k in range(4):
        a = math.pi / 2 * k
        g.cube('jaune', (0.3, 0.07, 0.02), (x + 0.1 * math.cos(a), y + 0.1 * math.sin(a), 1.34), 0, Matrix.Rotation(a, 3, 'Z'))
    T.pivot(coll, 'pivot_' + g.name, (x, y, 1.33), (0, 0, 1))


def reacteur_fission_t4(coll, leger=True):
    """Réacteur à fission T4 (`fission_reactor`) : 4 x 4 cases, 2,5 m de haut (modèle jusqu'à 6,5 unités). Eau sous
    pression qui entre par le côté +X, eau contaminée rejetée par le côté -X ; combustible derrière (+Y), produits devant.

    Enceinte de confinement en béton à dôme, cerclages, hublots qui luisent en cyan (`voyant_hublot_*`, pulsent),
    mécanismes des barres de contrôle sur le dôme ; sas du personnel devant ; à droite la pompe d'alimentation, à gauche
    le générateur de vapeur et la pompe de rejet ; trappes de chargement (derrière) et de déchargement (devant) ;
    panneaux « danger radioactif » ; borne électrique.
    Pièces mobiles : `pompe1_`, `pompe2_` (ventilateurs des moteurs des pompes, axe Z).
    """
    sg = 10 if leger else 16
    seg = 20 if leger else 32
    lot, p1, p2 = T.Lot(coll, 'pieces'), T.Lot(coll, 'pompe1'), T.Lot(coll, 'pompe2')
    lot.cube('beton', (3.92, 3.92, 0.2), (0, 0, 0.1), 0.02)
    for s in (-1, 1):
        lot.cube('jaune', (3.6, 0.06, 0.012), (0, s * 1.8, 0.205))
        lot.cube('jaune', (0.06, 3.6, 0.012), (s * 1.8, 0, 0.205))
    # Enceinte et dôme.
    T.cylinder(coll, 'enceinte', 1.3, 3.0, (0, 0, 0.2 + 1.5), 'beton', segments=seg)
    T.tour(coll, 'enceinte_dome', [(1.3, 3.2), (1.22, 3.6), (1.0, 3.95), (0.6, 4.2), (0.0, 4.3)], 'beton', segments=seg)
    for z in (0.9, 1.8, 2.7):
        lot.tube('pierre_claire', (0, 0, z - 0.04), (0, 0, z + 0.04), 1.33, seg)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        o = T.box(coll, f'voyant_hublot_{k}', (0.05, 0.3, 0.5), (1.31 * math.cos(a), 1.31 * math.sin(a), 2.25), 'cyan')
        o.rotation_euler = (0, 0, a)
        f = T.box(coll, f'hublot_cadre_{k}', (0.04, 0.4, 0.6), (1.29 * math.cos(a), 1.29 * math.sin(a), 2.25), 'acier_sombre')
        f.rotation_euler = (0, 0, a)
    _trefle(lot, (0, -1.31, 1.35), (0, -1, 0), 0.32)
    # Mécanismes des barres de contrôle, portique.
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            lot.tube('acier', (i * 0.17, j * 0.17, 4.05), (i * 0.17, j * 0.17, 4.75), 0.05, 6)
    lot.cube('acier_sombre', (0.7, 0.7, 0.08), (0, 0, 4.8), 0.01)
    lot.cube('jaune', (1.6, 0.12, 0.12), (0, 0.5, 4.95), 0.01)
    for s in (-1, 1):
        lot.barre('jaune', (s * 0.75, 0.5, 4.95), (s * 0.95, 0.5, 3.75), 0.1)
    # Sas du personnel (devant), trappes de chargement et de déchargement.
    lot.cube('acier_sombre', (0.7, 0.5, 1.0), (-0.55, -1.4, 0.7), 0.02)
    lot.cube('jaune', (0.4, 0.02, 0.7), (-0.55, -1.66, 0.62))
    lot.cube('noir', (0.3, 0.025, 0.6), (-0.55, -1.665, 0.6))
    for y, s in ((1.62, 1), (-1.62, -1)):
        x = 0 if s > 0 else 0.6
        lot.cube('acier', (0.8, 0.5, 0.5), (x, y, 0.45), 0.02)
        lot.cube('jaune', (0.66, 0.02, 0.36), (x, y + s * 0.255, 0.45))
        lot.cube('noir', (0.5, 0.025, 0.24), (x, y + s * 0.26, 0.45))
    # Côté +X : pompe d'alimentation, eau sous pression qui entre.
    a = T.raccord_fluide(lot, (2.0, 0), (1, 0, 0), r=0.13, longueur=0.3, sg=sg)
    _pompe_verticale(coll, lot, p1, 'pompe_alim', (1.6, 0.75), sg, seg)
    _tuyau(lot, [tuple(a), (1.6, 0, 0.36), (1.6, 0.45, 0.36)], 'bleu', 0.12, sg)
    _tuyau(lot, [(1.6, 0.75, 0.6), (1.6, 0.4, 0.6), (1.25, 0.4, 0.6)], 'bleu', 0.1, sg)
    # Côté -X : générateur de vapeur, pompe de rejet, eau contaminée qui sort.
    T.cylinder(coll, 'generateur_vapeur', 0.32, 2.2, (-1.6, 0.75, 0.2 + 1.1), 'gris_clair', segments=seg)
    lot.boule('gris_clair', (-1.6, 0.75, 2.4), 0.32)
    for z in (0.8, 1.5, 2.1):
        lot.tube('acier_sombre', (-1.6, 0.75, z - 0.03), (-1.6, 0.75, z + 0.03), 0.34, seg)
    _trefle(lot, (-1.6, 0.42, 1.2), (0, -1, 0), 0.18)
    _tuyau(lot, [(-1.1, 0.75, 1.8), (-1.35, 0.75, 1.8)], 'gris_clair', 0.12, sg)
    _pompe_verticale(coll, lot, p2, 'pompe_rejet', (-1.6, -0.75), sg, seg)
    b = T.raccord_fluide(lot, (-2.0, 0), (-1, 0, 0), r=0.13, longueur=0.3, sg=sg)
    _tuyau(lot, [(-1.6, 0.75, 0.36), (-1.6, -0.45, 0.36)], 'vert', 0.12, sg)
    _tuyau(lot, [(-1.6, -0.75, 0.6), (-1.6, 0, 0.6), (-1.6, 0, 0.36), tuple(b)], 'vert', 0.12, sg)
    T.borne_electrique(coll, lot, (1.55, -1.55, 0.2), 0.9, sg)
    for l in (lot, p1, p2):
        l.finir()
    T.poser_au_sol(coll, 2.0)


def reacteur_fusion(coll, leger=True):
    """Réacteur à fusion magnétique (`fusion_reactor`) : 6 x 6 cases, 3 m de haut (modèle jusqu'à 7,8 unités).
    Combustible derrière (+Y).

    Tokamak : socle octogonal, cryostat, anneau de plasma rose qui luit (`voyant_plasma_*`, pulse quand le plasma est
    allumé) tenu par douze bobines toroïdales en cuivre et quatre anneaux en inox, solénoïde central, deux grandes
    bobines horizontales sur huit poteaux, deux injecteurs de neutres, trappe de chargement, armoire de commande,
    conduites cryogéniques, borne électrique.
    """
    sg = 10 if leger else 16
    seg = 24 if leger else 40
    n = 24 if leger else 36
    lot, pl = T.Lot(coll, 'pieces'), T.Lot(coll, 'voyant_plasma')
    zc, R = 2.2, 1.75
    # Socle, cryostat.
    T.cylinder(coll, 'socle', 2.95, 0.25, (0, 0, 0.125), 'acier_sombre', segments=8)
    T.cylinder(coll, 'socle_haut', 2.55, 0.2, (0, 0, 0.35), 'gris_clair', segments=8)
    T.cylinder(coll, 'cryostat', 2.3, 0.75, (0, 0, 0.45 + 0.375), 'inox', segments=seg)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        lot.cube('jaune', (0.5, 0.06, 0.012), (2.75 * math.cos(a), 2.75 * math.sin(a), 0.255), 0, Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    # Plasma (anneau rose).
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        pl.tube('plasma', (R * math.cos(a0), R * math.sin(a0), zc), (R * math.cos(a1), R * math.sin(a1), zc), 0.3, 10)
    # Anneaux en inox autour du plasma (enceinte à vide ajourée).
    for dr, dz in ((-0.55, 0.45), (0.55, 0.45), (-0.55, -0.45), (0.55, -0.45)):
        _anneau_z(lot, 'inox', (0, 0, zc + dz), R + dr, 0.1, n)
    # Bobines toroïdales (cadres en D, cuivre), entretoises.
    nb = 12
    for k in range(nb):
        a = 2 * math.pi * k / nb
        u = Vector((math.cos(a), math.sin(a), 0))
        c = Vector((0, 0, zc)) + u * R
        coins = [c - u * 0.75 - Vector((0, 0, 0.8)), c + u * 0.8 - Vector((0, 0, 0.7)), c + u * 0.8 + Vector((0, 0, 0.7)),
                 c - u * 0.75 + Vector((0, 0, 0.8))]
        for p, q in zip(coins, coins[1:] + coins[:1]):
            lot.barre('cuivre', p, q, 0.16)
        lot.cube('acier_sombre', (0.2, 0.2, zc - 0.8 - 1.2), tuple(c - u * 0.6 + Vector((0, 0, -(zc - 0.8 - 1.2) / 2 - 0.8 + 0.0))))
    # Solénoïde central.
    T.cylinder(coll, 'solenoide', 0.55, 3.4, (0, 0, 1.2 + 1.7 - 0.0), 'acier', segments=seg)
    for z in (1.6, 2.2, 2.8, 3.4):
        lot.tube('cuivre', (0, 0, z - 0.08), (0, 0, z + 0.08), 0.58, seg)
    lot.cube('acier_sombre', (0.8, 0.8, 0.1), (0, 0, 4.65), 0.01)
    # Grandes bobines horizontales sur huit poteaux.
    for z in (zc + 1.2, 1.25):
        _anneau_z(lot, 'acier_sombre', (0, 0, z), 2.6, 0.2, 32)
    for k in range(8):
        a = 2 * math.pi * k / 8
        lot.cube('acier', (0.16, 0.16, zc + 1.2 - 0.45), (2.6 * math.cos(a), 2.6 * math.sin(a), 0.45 + (zc + 1.2 - 0.45) / 2), 0.01)
    # Injecteurs de neutres (deux boîtes pointées vers le tore).
    for a in (math.radians(22.5 + 45), math.radians(22.5 + 225)):
        u = Vector((math.cos(a), math.sin(a), 0))
        rot = Matrix.Rotation(a, 3, 'Z')
        lot.cube('gris_clair', (1.0, 0.6, 0.6), tuple(u * 2.4 + Vector((0, 0, zc))), 0.02, rot)
        lot.tube('acier_sombre', u * 1.95 + Vector((0, 0, zc)), u * 1.82 + Vector((0, 0, zc)), 0.14, sg)
        lot.cube('jaune', (0.06, 0.62, 0.62), tuple(u * 1.93 + Vector((0, 0, zc))), 0, rot)
    # Trappe de chargement (derrière), armoire de commande (devant à droite), conduites cryogéniques.
    lot.cube('acier', (0.9, 0.4, 0.5), (0, 2.7, 0.5), 0.02)
    lot.cube('jaune', (0.76, 0.02, 0.36), (0, 2.91, 0.5))
    lot.cube('noir', (0.6, 0.025, 0.24), (0, 2.915, 0.5))
    lot.cube('gris_clair', (0.7, 0.45, 1.3), (2.1, -2.3, 0.25 + 0.65), 0.02)
    lot.cube('panneau', (0.56, 0.02, 0.4), (2.1, -2.53, 1.1))
    for k, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.06, 0.02, 0.06), (1.93 + k * 0.17, -2.53, 0.7))
    for dz in (0.0, 0.15):
        _tuyau(lot, [(1.9, -2.05, 0.6 + dz), (1.5, -1.6, 0.6 + dz), (1.5, -1.6, 1.0 + dz)], 'inox', 0.05, 8)
    T.borne_electrique(coll, lot, (-2.25, -2.25, 0.25), 1.0, sg)
    for l in (lot, pl):
        l.finir()
    T.poser_au_sol(coll, 3.0)


def tour_evaporation_t4(coll, leger=True):
    """Tour d'évaporation T4 (`evaporation_tower`) : 3 x 3 cases, 2 m de haut (modèle jusqu'à 5,2 unités). L'eau
    contaminée entre par derrière (+Y).

    Bassin de rétention en béton, haute cheminée qui s'affine (béton puis inox), quatre nervures, cerclages, échelle à
    crinoline et deux plateformes, couronne de bouches au sommet ; panache verdâtre (`jet_fumee_*`, vacille en marche) ;
    conduite d'arrivée, réchauffeur à la base, panneaux « danger radioactif ».
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot = T.Lot(coll, 'pieces')
    lot.cube('beton', (2.9, 2.9, 0.3), (0, 0, 0.15), 0.02)
    lot.cube('vert', (2.5, 2.5, 0.02), (0, 0, 0.305))  # fond du bassin (eau croupie)
    for s in (-1, 1):
        lot.cube('beton', (2.9, 0.2, 0.18), (0, s * 1.35, 0.39), 0.01)
        lot.cube('beton', (0.2, 2.9, 0.18), (s * 1.35, 0, 0.39), 0.01)
    # Cheminée qui s'affine.
    T.tour(coll, 'cheminee', [(0.95, 0.3), (0.85, 1.6), (0.7, 3.2), (0.6, 4.35)], 'beton', segments=seg, fond=False)
    T.tour(coll, 'cheminee_haut', [(0.62, 4.3), (0.62, 4.6), (0.72, 4.75)], 'inox', segments=seg, fond=False, dessus=False)
    for z, r in ((1.0, 0.9), (2.0, 0.81), (3.0, 0.72), (4.0, 0.64)):
        lot.tube('acier_sombre', (0, 0, z - 0.04), (0, 0, z + 0.04), r, seg)
    for k in range(4):  # nervures
        a = math.pi / 4 + k * math.pi / 2
        lot.barre('acier_sombre', (0.98 * math.cos(a), 0.98 * math.sin(a), 0.3), (0.62 * math.cos(a), 0.62 * math.sin(a), 4.3), 0.1)
    # Couronne de bouches et panache.
    for k in range(6):
        a = 2 * math.pi * k / 6
        lot.cube('acier_sombre', (0.16, 0.16, 0.14), (0.55 * math.cos(a), 0.55 * math.sin(a), 4.72), 0.01)
    # Panache : bouffées verdâtres (boules facettées, vacillent en marche) ; reste sous 5,2 unités (hauteur 2 m du jeu).
    for k, (x, y, z, r) in enumerate(((0, 0, 4.92, 0.27), (0.3, 0.18, 4.88, 0.19), (-0.28, -0.16, 4.9, 0.2), (0.05, -0.28, 5.03, 0.15))):
        jet = T.Lot(coll, f'jet_fumee_{k}')
        jet.boule('vert' if k % 2 == 0 else 'gris_clair', (x, y, z), r)
        jet.finir()
    # Échelle à crinoline et plateformes (côté -X).
    xe = -0.95
    for dy in (-0.15, 0.15):
        lot.barre('acier', (xe, dy, 0.48), (xe + 0.3, dy, 4.3), 0.04)
    for k in range(14):
        t = k / 13
        lot.barre('acier', (xe + 0.3 * t, -0.15, 0.48 + 3.82 * t), (xe + 0.3 * t, 0.15, 0.48 + 3.82 * t), 0.025)
    for z, r in ((2.4, 0.95), (4.3, 0.85)):
        _anneau_z(lot, 'jaune', (0, 0, z + 0.32), r + 0.2, 0.04, 16)
        T.cylinder(coll, f'plateforme_{z}', r + 0.2, 0.05, (0, 0, z), 'acier_sombre', segments=16)
    # Arrivée d'eau contaminée (derrière), réchauffeur.
    a = T.raccord_fluide(lot, (0, 1.5), (0, 1, 0), r=0.12, longueur=0.15, sg=sg)
    _tuyau(lot, [tuple(a), (0, 1.2, 0.36), (0, 1.2, 0.8), (0, 0.85, 0.8)], 'vert', 0.1, sg)
    lot.cube('acier', (0.7, 0.4, 0.45), (0.7, 0.95, 0.75), 0.02)  # réchauffeur
    lot.tube('rouge', (0.45, 0.95, 0.98), (0.45, 0.95, 1.3), 0.04, 6)
    _trefle(lot, (0, -0.86, 1.5), (0, -1, 0), 0.32)
    _trefle(lot, (0.7, 0.74, 0.8), (0, -1, 0), 0.2)
    lot.finir()
    T.poser_au_sol(coll, 1.5)


def station_vitrification_t4(coll, leger=True):
    """Station de vitrification T4 (`vitrifier`) : 3 x 3 cases, 1,2 m de haut (modèle jusqu'à 3,1 unités). Déchets
    liquides par le côté +X, matières (sable de verre) par derrière, conteneurs de verre devant.

    Four de fusion trapu (porte où le verre en fusion rougeoie : `lueur_coulee`), goulotte de coulée au-dessus du
    convoyeur de sortie qui emporte les conteneurs (groupe `sortie_`, cylindres de verre vert cerclés) ; trémie à
    l'arrière ; cheminée de traitement des fumées ; raccord du côté +X ; armoire et borne électrique ; trèfles.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot = T.Lot(coll, 'pieces')
    lot.cube('acier_sombre', (2.9, 2.9, 0.1), (0, 0, 0.05), 0.01)
    # Four de fusion.
    lot.cube('gris_clair', (1.5, 1.3, 1.25), (0, 0.25, 0.1 + 0.625), 0.03)
    lot.cube('acier_sombre', (1.56, 1.36, 0.1), (0, 0.25, 1.4), 0.01)
    for x in (-0.6, 0.6):
        lot.cube('acier_sombre', (0.08, 1.34, 1.25), (x, 0.25, 0.725))
    lot.cube('fonte', (0.6, 0.06, 0.5), (0, -0.42, 0.7), 0.01)  # porte de coulée
    lot.cube('noir', (0.46, 0.02, 0.36), (0, -0.455, 0.68))
    T.box(coll, 'lueur_coulee', (0.38, 0.01, 0.26), (0, -0.468, 0.66), 'braise')
    lot.cube('fonte', (0.22, 0.3, 0.06), (0, -0.6, 0.6), 0.005, Matrix.Rotation(0.4, 3, 'X'))  # goulotte
    _trefle(lot, (0.45, -0.405, 1.05), (0, -1, 0), 0.22)
    # Convoyeur de sortie et conteneurs de verre.
    def conteneur(g, k, p, d, w, n, rot):
        q = p + n * 0.02
        g.tube('vert', q, q + n * 0.34, 0.15, sg)
        for z in (0.04, 0.3):
            g.tube('inox', q + n * z, q + n * (z + 0.03), 0.16, sg)
        g.tube('inox', q + n * 0.34, q + n * 0.37, 0.1, sg)
    so, _, _ = T.convoyeur_charge(coll, 'sortie', lot, (0, -0.45, 0.33), (0, -1.38, 0.3), 0.42, 0.07, 0.4, conteneur,
                       debut=0.12, fin=-0.15, rouleaux=2, sg=sg)
    for sx in (-1, 1):
        lot.cube('acier', (0.05, 0.05, 0.2), (sx * 0.27, -1.35, 0.2))
    # Trémie à l'arrière (matières).
    T.tour(coll, 'tremie', [(0.18, 1.4), (0.45, 1.85), (0.47, 1.9)], 'acier', segments=4, centre=(0, 0.75), fond=False, dessus=False)
    lot.cube('pierre_claire', (0.55, 0.55, 0.05), (0, 0.75, 1.82))
    # Déchets liquides : raccord +X, conduite vers le four.
    a = T.raccord_fluide(lot, (1.5, 0.3), (1, 0, 0), r=0.11, longueur=0.15, sg=sg)
    _tuyau(lot, [tuple(a), (1.1, 0.3, 0.36), (1.1, 0.3, 1.0), (0.75, 0.3, 1.0)], 'vert', 0.09, sg)
    # Traitement des fumées : caisson et cheminée (derrière à gauche).
    lot.cube('inox', (0.55, 0.55, 0.8), (-1.05, 0.95, 0.5), 0.02)
    T.cylinder(coll, 'cheminee', 0.13, 1.9, (-1.05, 0.95, 0.9 + 0.95), 'inox', segments=10)
    _tuyau(lot, [(-0.75, 0.6, 1.2), (-0.95, 0.75, 1.2)], 'inox', 0.07, sg)
    # Armoire et borne.
    lot.cube('gris_clair', (0.5, 0.35, 0.9), (1.05, -1.1, 0.55), 0.02)
    lot.cube('panneau', (0.36, 0.02, 0.24), (1.05, -1.28, 0.75))
    for k, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (0.92 + k * 0.13, -1.28, 0.45))
    T.borne_electrique(coll, lot, (1.05, -1.1, 1.0), 0.45, sg)
    lot.finir()
    so.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'centrifugeuse_t4': centrifugeuse_t4, 'reacteur_fission_t4': reacteur_fission_t4,
           'reacteur_fusion': reacteur_fusion, 'tour_evaporation_t4': tour_evaporation_t4,
           'station_vitrification_t4': station_vitrification_t4}



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
