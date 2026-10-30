"""Famille « énergie » : poteau électrique, roue à aubes, manivelle de réamorçage, chaudière, turbine à vapeur,
générateur à combustible, accumulateur, relais hyperfréquence, antenne quantique.

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/energie.py
Produit :  blender/energie.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def _isolateur(lot, p, sg, disques=3):
    """Isolateur en porcelaine (disques blancs empilés) sur une tige d'acier, chapeau en cuivre ; retourne le haut."""
    x, y, z = p
    lot.tube('acier', (x, y, z), (x, y, z + 0.08), 0.025, 6)
    for k in range(disques):
        zk = z + 0.08 + k * 0.07
        lot.tube('blanc', (x, y, zk), (x, y, zk + 0.035), 0.085 - 0.01 * (k % 2), sg)
        lot.tube('blanc', (x, y, zk + 0.035), (x, y, zk + 0.07), 0.045, sg)
    zt = z + 0.08 + disques * 0.07
    lot.boule('cuivre', (x, y, zt + 0.02), 0.05)
    return Vector((x, y, zt + 0.02))


def poteau_electrique(coll, leger=True):
    """Poteau électrique (`pole`) : 2 x 2 cases, 3,5 m de haut dans le jeu (modèle jusqu'à 9,1 unités).

    Fût en bois effilé sur un massif en béton, sabot d'acier cerclé, pointes de montée, plaque de repérage jaune ;
    en haut, traverse en bois avec jambes de force, deux isolateurs sur la traverse et un sur la tête du poteau. Les
    câbles du jeu partent de l'isolateur de tête : repère `accroche_cable`. Rien ne bouge.
    """
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    H = 7.9  # haut du fût

    # --- Massif en béton et sabot d'acier.
    lot.cube('pierre_sombre', (0.7, 0.7, 0.06), (0, 0, 0.03), 0.01)
    lot.cube('beton', (0.56, 0.56, 0.22), (0, 0, 0.17), 0.02)
    T.cylinder(coll, 'sabot', 0.2, 0.62, (0, 0, 0.28 + 0.31), 'acier_sombre', segments=8)
    for z in (0.42, 0.78):
        lot.tube('fonte', (0, 0, z - 0.025), (0, 0, z + 0.025), 0.215, 8)  # cerclages
    for k in range(4):  # boulons du sabot
        a = math.pi / 4 + k * math.pi / 2
        lot.cube('acier', (0.05, 0.05, 0.05), (0.3 * math.cos(a), 0.3 * math.sin(a), 0.3))

    # --- Fût en bois effilé (octogonal), bagues, pointes de montée en quinconce, plaque.
    T.cylinder(coll, 'fut', 0.16, H - 0.28, (0, 0, 0.28 + (H - 0.28) / 2), 'bois', segments=8, radius_top=0.11)
    for z in (2.0, 4.6):
        r = 0.16 - 0.05 * (z - 0.28) / (H - 0.28)
        lot.tube('bois_sombre', (0, 0, z - 0.03), (0, 0, z + 0.03), r + 0.012, 8)
    for k in range(10 if leger else 12):
        z = 1.5 + k * 0.48
        a = math.pi / 2 * (k % 2) + math.pi / 4
        r = 0.16 - 0.05 * (z - 0.28) / (H - 0.28)
        lot.tube('acier', (r * math.cos(a), r * math.sin(a), z), ((r + 0.2) * math.cos(a), (r + 0.2) * math.sin(a), z), 0.018, 6)
    lot.cube('jaune', (0.18, 0.012, 0.24), (0, -0.155, 2.3))  # plaque de repérage
    lot.cube('noir', (0.1, 0.014, 0.03), (0, -0.157, 2.35))
    lot.cube('noir', (0.1, 0.014, 0.03), (0, -0.157, 2.27))

    # --- Traverse, jambes de force, isolateurs.
    zt = H - 0.5
    lot.cube('bois_sombre', (1.8, 0.14, 0.14), (0, 0, zt), 0.01)
    for s in (-1, 1):
        lot.barre('bois_sombre', (s * 0.62, 0, zt - 0.07), (0, 0, zt - 0.62), 0.07)  # jambes de force
        lot.cube('acier', (0.06, 0.18, 0.06), (s * 0.62, 0, zt - 0.08))  # ferrures
        _isolateur(lot, (s * 0.72, 0, zt + 0.07), sg)
    lot.cube('acier', (0.2, 0.2, 0.04), (0, 0, H + 0.02))  # chapeau de tête
    tete = _isolateur(lot, (0, 0, H + 0.04), sg, disques=4)
    # Fils courts entre les isolateurs de la traverse et celui de la tête (aspect « ligne »).
    for s in (-1, 1):
        a = Vector((s * 0.72, 0, zt + 0.07 + 0.08 + 3 * 0.07 + 0.02))
        m = (a + tete) / 2 + Vector((0, 0, -0.08))
        lot.tube('noir', a, m, 0.012, 4)
        lot.tube('noir', m, tete, 0.012, 4)
    T.reperer(coll, 'accroche_cable', tuple(tete))
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def roue_a_aubes(coll, leger=True):
    """Roue à aubes (`waterwheel`) : 3 x 3 cases, 1,5 m de haut (modèle jusqu'à 3,9 unités). Posée au bord de l'eau.

    Grande roue en bois (deux jantes, rayons, aubes, moyeux et axe en fonte) entre deux piles en pierre à paliers ; sur la
    pile de droite, une génératrice entraînée par une couronne dentée sur l'axe et un pignon ; borne électrique sur la
    génératrice (le câble du jeu s'accroche à sa boule). Éclaboussures sous la roue.
    Pièces mobiles : `roue_` (tourne autour de l'axe X), `pignon_` (tourne en sens contraire, 3,75 fois plus vite) ;
    `jet_*` (éclaboussures) vacillent en marche. La roue ne tourne que quand le réseau demande de l'énergie.
    """
    sg = 8 if leger else 14
    n = 12 if leger else 16  # aubes
    lot, roue, pg = T.Lot(coll, 'pieces'), T.Lot(coll, 'roue'), T.Lot(coll, 'pignon')
    R, zc, demi = 1.36, 1.5, 0.7  # rayon, hauteur de l'axe, demi-largeur de la roue
    xp = 1.22  # axe des piles

    # --- Piles en pierre (chaperon, paliers en fonte).
    for s in (-1, 1):
        lot.cube('pierre', (0.42, 1.1, zc - 0.16), (s * xp, 0, (zc - 0.16) / 2), 0.03)
        for k in range(4 if leger else 6):  # assises de pierres en relief
            z = 0.15 + k * (zc - 0.3) / (3 if leger else 5)
            lot.cube('pierre_claire' if k % 2 else 'pierre_sombre', (0.44, 1.12, 0.05), (s * xp, 0, z), 0.01)
        lot.cube('pierre_sombre', (0.5, 1.18, 0.08), (s * xp, 0, zc - 0.12), 0.02)  # chaperon
        lot.cube('fonte', (0.3, 0.34, 0.2), (s * xp, 0, zc - 0.02), 0.02)  # palier
        lot.cube('fonte', (0.34, 0.2, 0.06), (s * xp, 0, zc + 0.1), 0.01)  # chapeau du palier
        for dy in (-0.13, 0.13):
            lot.cube('acier', (0.05, 0.05, 0.05), (s * xp, dy, zc + 0.14))
        lot.cube('acier_sombre', (0.5, 0.12, 0.14), (s * xp, -0.5, 0.07), 0)  # semelle

    # --- Roue (groupe `roue_`) : axe, moyeux, jantes, rayons, aubes, couronne dentée.
    roue.tube('fonte', (-xp - 0.18, 0, zc), (xp + 0.18, 0, zc), 0.07, sg)
    rang = lambda r, a, x: Vector((x, r * math.cos(a), zc + r * math.sin(a)))  # noqa: E731
    for s in (-1, 1):
        x = s * demi
        roue.tube('fonte', (x - 0.07, 0, zc), (x + 0.07, 0, zc), 0.17, sg)  # moyeu
        for k in range(n):  # jantes extérieure et intérieure
            a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            roue.barre('bois_sombre', rang(R, a0, x), rang(R, a1, x), 0.1)
            roue.barre('bois_sombre', rang(R * 0.6, a0, x), rang(R * 0.6, a1, x), 0.07)
        for k in range(n // 2):  # rayons
            a = 2 * math.pi * (k + 0.25) / (n // 2)
            roue.barre('bois', rang(0.12, a, x), rang(R, a, x), 0.075)
        for k in range(n):  # boulons des jantes
            a = 2 * math.pi * (k + 0.5) / n
            roue.cube('acier', (0.13, 0.03, 0.03), tuple(rang(R, a, x)), 0, Matrix.Rotation(a, 3, 'X'))
    for k in range(n):  # aubes : planches radiales entre les jantes, liteau de renfort
        a = 2 * math.pi * k / n
        rot = Matrix.Rotation(a, 3, 'X')
        roue.cube('bois', (2 * demi + 0.06, 0.5, 0.06), tuple(rang(R * 0.8 + 0.06, a, 0)), 0.01, rot)
        roue.cube('bois_sombre', (2 * demi + 0.08, 0.06, 0.05), tuple(rang(R + 0.02, a, 0) + rot @ Vector((0, 0, 0.04))), 0, rot)
    # Couronne dentée sur l'axe, côté génératrice.
    xc, rc = demi + 0.24, 0.45
    roue.tube('fonte', (xc - 0.05, 0, zc), (xc + 0.05, 0, zc), rc, 16 if leger else 24)
    roue.tube('acier_sombre', (xc - 0.06, 0, zc), (xc + 0.06, 0, zc), 0.12, sg)
    nd = 18 if leger else 28
    for k in range(nd):
        a = 2 * math.pi * k / nd
        roue.cube('fonte', (0.1, 0.07, 0.07), tuple(rang(rc + 0.03, a, xc)), 0, Matrix.Rotation(a, 3, 'X'))
    T.pivot(coll, 'pivot_roue', (0, 0, zc), (1, 0, 0))

    # --- Génératrice sur la pile de droite, pignon (groupe `pignon_`), borne électrique.
    zg = zc + rc + 0.12 + 0.04  # axe du pignon : la couronne (rc) + le pignon (0,12) + les dents
    lot.cube('acier_sombre', (0.5, 0.64, 0.06), (xp, 0, zc + 0.16), 0.01)  # platine sur le chaperon
    for dy in (-0.26, 0.26):
        lot.cube('acier_sombre', (0.08, 0.06, zg - zc - 0.2), (xp - 0.18, dy, (zg + zc + 0.2) / 2 - 0.03), 0)  # flasques
    T.cylinder_at(coll, 'generatrice', 0.24, 0.42, (xp + 0.05, 0, zg), 'vert_fonce', segments=12 if leger else 20, y=90)
    for k in range(5):  # ailettes de refroidissement
        lot.tube('vert_fonce', (xp - 0.13 + k * 0.09, 0, zg), (xp - 0.11 + k * 0.09, 0, zg), 0.265, 12 if leger else 20)
    lot.cube('cuivre', (0.16, 0.012, 0.1), (xp + 0.05, -0.25, zg + 0.04))  # plaque
    lot.tube('acier', (xp - 0.3, 0, zg), (xp - 0.16, 0, zg), 0.035, 6)  # arbre
    pg.tube('acier_sombre', (xc - 0.05, 0, zg), (xc + 0.05, 0, zg), 0.12, sg)
    for k in range(8):
        a = 2 * math.pi * k / 8
        pg.cube('acier_sombre', (0.1, 0.05, 0.05), (xc, 0.15 * math.cos(a), zg + 0.15 * math.sin(a)), 0,
                Matrix.Rotation(a, 3, 'X'))
    T.pivot(coll, 'pivot_pignon', (xc, 0, zg), (1, 0, 0))
    lot.cube('acier', (0.06, 0.32, 0.04), (xc, 0, zg + 0.2))  # carter (protection) au-dessus du pignon
    lot.cube('jaune', (0.07, 0.33, 0.012), (xc, 0, zg + 0.226))
    T.borne_electrique(coll, lot, (xp + 0.05, 0.12, zg + 0.24), 0.55, sg)
    lot.barre('noir', (xp + 0.05, 0.12, zg + 0.24), (xp + 0.05, 0.05, zg + 0.22), 0.02)

    # --- Éclaboussures sous la roue (vacillent en marche, cachées à l'arrêt).
    for k, (y, h) in enumerate(((-0.35, 0.28), (0.0, 0.36), (0.35, 0.24), (-0.15, 0.2))):
        x = (-0.4, 0.15, 0.45, -0.1)[k]
        T.cylinder(coll, f'jet_eclaboussure_{k}', 0.07, h, (x, y, 0.02 + h / 2), 'eau', segments=5, radius_top=0.0)

    for l in (lot, roue, pg):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def _conduite(lot, pts, mat, r, sg):
    """Conduite à coudes : tubes entre les points, boule à chaque coude."""
    pts = [Vector(p) for p in pts]
    for a, b in zip(pts, pts[1:]):
        lot.tube(mat, a, b, r, sg)
    for p in pts[1:-1]:
        lot.boule(mat, p, r * 1.1)


def _anneau_x(lot, mat, c, r, ep, n, x_ep=None):
    """Anneau (jante) dans un plan perpendiculaire à X, centre `c`, rayon `r`, section carrée `ep`."""
    c = Vector(c)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        lot.barre(mat, c + Vector((0, r * math.cos(a0), r * math.sin(a0))), c + Vector((0, r * math.cos(a1), r * math.sin(a1))), ep)


def _anneau_z(lot, mat, c, r, ep, n):
    """Anneau horizontal (plan XY), centre `c`, rayon `r`, section carrée `ep`."""
    c = Vector(c)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        lot.barre(mat, c + Vector((r * math.cos(a0), r * math.sin(a0), 0)), c + Vector((r * math.cos(a1), r * math.sin(a1), 0)), ep)


def _volant_x(g, c, r, mat_jante, mat_rayon, nb, sg, larg=0.08):
    """Volant (jante, rayons, moyeu) dans le plan perpendiculaire à X, dans le groupe `g`."""
    c = Vector(c)
    _anneau_x(g, mat_jante, c, r, larg, 16)
    for k in range(nb):
        a = 2 * math.pi * (k + 0.5) / nb
        g.barre(mat_rayon, c, c + Vector((0, r * math.cos(a), r * math.sin(a))), larg * 0.6)
    g.tube('fonte', c - Vector((0.05, 0, 0)), c + Vector((0.05, 0, 0)), r * 0.2, sg)


def _manometre(coll, lot, nom, p, face, r=0.09):
    """Cadran rond (manomètre, voltmètre) au point `p`, tourné vers `face` ('-Y' ou '+X'…)."""
    x, y, z = p
    if face in ('-Y', '+Y'):
        s = -1 if face == '-Y' else 1
        T.cylinder_at(coll, nom, r, 0.04, (x, y, z), 'acier_sombre', segments=12, x=90)
        lot.tube('blanc', (x, y + s * 0.02, z), (x, y + s * 0.024, z), r * 0.82, 12)
        lot.cube('rouge', (0.01, 0.006, r * 0.75), (x + 0.015, y + s * 0.027, z + 0.02), 0, Matrix.Rotation(-0.5, 3, 'Y'))
    else:
        s = -1 if face == '-X' else 1
        T.cylinder_at(coll, nom, r, 0.04, (x, y, z), 'acier_sombre', segments=12, y=90)
        lot.tube('blanc', (x + s * 0.02, y, z), (x + s * 0.024, y, z), r * 0.82, 12)
        lot.cube('rouge', (0.006, 0.01, r * 0.75), (x + s * 0.027, y + 0.015, z + 0.02), 0, Matrix.Rotation(0.5, 3, 'X'))


def manivelle_reamorcage(coll, leger=True):
    """Manivelle de réamorçage (`crank`) : 2 x 2 cases, 1 m de haut (modèle jusqu'à 2,6 unités).

    Socle en planches, pied en fonte, petite dynamo verte avec voltmètre ; sur le même arbre, un volant rouge à droite
    et la manivelle (bras et poignée en bois) à gauche. Borne électrique sur le socle (le câble s'y accroche).
    Pièces mobiles : `manivelle_` (volant, arbre, manivelle : tournent ensemble autour de X, quand on l'actionne) ;
    `voyant_` (lampe du voltmètre) pulse.
    """
    sg = 8 if leger else 14
    seg = 12 if leger else 20
    lot, mv = T.Lot(coll, 'pieces'), T.Lot(coll, 'manivelle')
    za = 1.25
    # Socle en planches et pied en fonte.
    for k in range(4):
        lot.cube('bois' if k % 2 == 0 else 'bois_sombre', (1.7, 0.3, 0.1), (0, -0.45 + k * 0.3, 0.05), 0.01)
    lot.cube('fonte', (0.7, 0.7, 0.1), (0, 0, 0.15), 0.02)
    lot.cube('fonte', (0.46, 0.46, 0.7), (0, 0, 0.55), 0.02)
    lot.cube('fonte', (0.56, 0.56, 0.08), (0, 0, 0.9), 0.01)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.cube('acier', (0.05, 0.05, 0.04), (sx * 0.28, sy * 0.28, 0.21))
    # Dynamo (axe X), bagues, plaque, voltmètre.
    T.cylinder_at(coll, 'dynamo', 0.3, 0.6, (0.05, 0, za), 'vert_fonce', segments=seg, y=90)
    for x in (-0.22, 0.32):
        lot.tube('fonte', (x - 0.02, 0, za), (x + 0.02, 0, za), 0.32, seg)
    lot.cube('fonte', (0.4, 0.4, 0.3), (0.05, 0, za - 0.25), 0.01)  # chaise
    lot.cube('cuivre', (0.16, 0.01, 0.08), (0.05, -0.3, za + 0.05))
    lot.cube('acier_sombre', (0.24, 0.16, 0.16), (0.05, 0, za + 0.36), 0.01)
    _manometre(coll, lot, 'voltmetre', (0.05, -0.085, za + 0.38), '-Y', 0.07)
    T.cylinder(coll, 'voyant_lampe', 0.035, 0.05, (0.15, 0, za + 0.465), 'jaune', segments=8)
    # Volant, arbre et manivelle (groupe `manivelle_`).
    mv.tube('acier', (-0.7, 0, za), (0.72, 0, za), 0.045, sg)
    _volant_x(mv, (0.6, 0, za), 0.5, 'rouge', 'rouge', 6, sg)
    xm = -0.55
    mv.tube('fonte', (xm - 0.04, 0, za), (xm + 0.04, 0, za), 0.09, sg)
    mv.barre('acier', (xm, 0, za), (xm, 0, za - 0.42), 0.07)  # bras
    mv.tube('acier', (xm, 0, za - 0.42), (xm - 0.25, 0, za - 0.42), 0.025, 6)
    mv.tube('bois', (xm - 0.08, 0, za - 0.42), (xm - 0.26, 0, za - 0.42), 0.045, sg)  # poignée
    T.pivot(coll, 'pivot_manivelle', (0, 0, za), (1, 0, 0))
    lot.cube('fonte', (0.12, 0.2, 0.3), (-0.32, 0, za - 0.12), 0.01)  # palier gauche
    # Borne électrique et câble vers la dynamo.
    T.borne_electrique(coll, lot, (0.62, 0.55, 0.1), 1.0, sg)
    lot.barre('noir', (0.62, 0.5, 0.25), (0.1, 0.1, za - 0.1), 0.025)
    for l in (lot, mv):
        l.finir()
    T.poser_au_sol(coll, 1.0)


def chaudiere(coll, leger=True):
    """Chaudière (`boiler`) : 3 x 3 cases, 1,5 m de haut (modèle jusqu'à 3,9 unités). Eau par les côtés X, vapeur
    devant (-Y), combustible derrière (+Y).

    Foyer en briques ; corps cylindrique vert riveté couché le long de Y, fond bombé devant, dôme de vapeur avec soupape
    et manomètre ; la vapeur sort par une conduite qui redescend devant à la hauteur des tuyaux ; arrivées d'eau sur les
    deux côtés ; derrière, porte du foyer (braises qui rougeoient : `lueur_foyer`), goulotte à charbon, cheminée.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot = T.Lot(coll, 'pieces')
    zc, rc = 1.55, 0.8
    # Foyer en briques (assises en relief).
    lot.cube('brique', (2.4, 2.3, 0.9), (0, 0.1, 0.45), 0.02)
    for k in range(5 if leger else 8):
        z = 0.08 + k * 0.82 / (4 if leger else 7)
        mat = ('brique_claire', 'brique_sombre')[k % 2]
        lot.cube(mat, (2.42, 2.32, 0.05), (0, 0.1, z), 0.005)
    lot.cube('pierre_sombre', (2.5, 2.4, 0.08), (0, 0.1, 0.92), 0.01)  # chaperon
    # Corps de la chaudière (axe Y), cerclages, fond bombé.
    T.cylinder_at(coll, 'corps', rc, 2.6, (0, 0.05, zc), 'vert_fonce', segments=seg, x=90)
    for y in (-1.0, -0.35, 0.35, 1.0):
        lot.tube('acier_sombre', (0, y - 0.03, zc), (0, y + 0.03, zc), rc + 0.03, seg)
    lot.tube('fonte', (0, -1.25, zc), (0, -1.29, zc), rc - 0.08, seg)
    lot.cube('cuivre', (0.4, 0.012, 0.2), (0, -1.295, zc + 0.35))  # plaque
    lot.tube('verre', (0.45, -1.3, zc - 0.35), (0.45, -1.3, zc + 0.2), 0.03, 6)  # niveau d'eau
    lot.tube('eau', (0.45, -1.305, zc - 0.33), (0.45, -1.305, zc - 0.05), 0.032, 6)
    # Dôme de vapeur, soupape, manomètre.
    T.cylinder(coll, 'dome', 0.3, 0.5, (0, -0.45, zc + rc + 0.1), 'vert_fonce', segments=seg)
    lot.boule('vert_fonce', (0, -0.45, zc + rc + 0.35), 0.3)
    lot.tube('acier', (0.2, -0.3, zc + rc + 0.3), (0.2, -0.3, zc + rc + 0.62), 0.04, 6)  # soupape
    lot.boule('jaune', (0.2, -0.3, zc + rc + 0.66), 0.05)
    lot.tube('acier', (-0.15, -0.6, zc + rc + 0.3), (-0.15, -0.6, zc + rc + 0.5), 0.02, 6)
    _manometre(coll, lot, 'manometre', (-0.15, -0.63, zc + rc + 0.6), '-Y', 0.1)
    # Vapeur : du dôme vers l'avant, redescend devant, raccord au bord (-Y).
    zv = zc + rc + 0.2
    debut = T.raccord_fluide(lot, (0, -1.5), (0, -1, 0), r=0.13, longueur=0.1, sg=sg)
    _conduite(lot, [(0, -0.6, zv), (0, -1.42, zv), (0, -1.42, 0.36), tuple(debut)], 'acier', 0.12, sg)
    lot.tube('acier_sombre', (0, -1.0, zv), (0, -1.0, zv + 0.2), 0.03, 6)  # vanne
    lot.tube('rouge', (0, -1.0, zv + 0.2), (0, -1.0, zv + 0.23), 0.13, 12)
    # Eau : arrivées sur les deux côtés X.
    for s in (-1, 1):
        a = T.raccord_fluide(lot, (s * 1.5, 0), (s, 0, 0), r=0.1, longueur=0.15, sg=sg)
        _conduite(lot, [tuple(a), (s * 1.33, 0, 1.35), (s * 0.7, 0, 1.35)], 'bleu', 0.09, sg)
    # Derrière : porte du foyer, braises, grille, goulotte à charbon.
    yb = 1.25
    lot.cube('fonte', (0.9, 0.08, 0.62), (0, yb + 0.02, 0.42), 0.02)
    lot.cube('noir', (0.66, 0.02, 0.42), (0, yb + 0.065, 0.4))
    T.box(coll, 'lueur_foyer', (0.56, 0.01, 0.26), (0, yb + 0.078, 0.34), 'braise')  # rougeoie en marche
    for k in range(5):
        lot.cube('acier_sombre', (0.03, 0.02, 0.4), (-0.24 + k * 0.12, yb + 0.09, 0.4))  # grille
    lot.cube('fonte', (0.64, 0.4, 0.04), (0, 1.36, 0.82), 0.005, Matrix.Rotation(-0.5, 3, 'X'))  # goulotte
    for x in (-0.31, 0.31):
        lot.cube('fonte', (0.03, 0.4, 0.12), (x, 1.36, 0.86), 0, Matrix.Rotation(-0.5, 3, 'X'))
    for k in range(4):
        lot.cube('noir', (0.1, 0.1, 0.07), (-0.18 + k * 0.12, 1.33 + (k % 2) * 0.05, 0.86), 0, Matrix.Rotation(k, 3, 'Z'))
    # Cheminée (derrière à droite).
    T.cylinder(coll, 'cheminee', 0.2, 2.9, (0.85, 0.85, 0.9 + 1.45), 'fonte', segments=12)
    T.cylinder(coll, 'cheminee_tete', 0.26, 0.15, (0.85, 0.85, 3.8 - 0.07), 'fonte', segments=12, radius_top=0.2)
    for z in (1.6, 2.6):
        lot.tube('acier_sombre', (0.85, 0.85, z - 0.02), (0.85, 0.85, z + 0.02), 0.22, 12)
    lot.finir()
    T.poser_au_sol(coll, 1.5)


def turbine_vapeur(coll, leger=True):
    """Turbine à vapeur (`turbine`) : 3 x 4 cases (X : 3, Y : 4), 1 m de haut (modèle jusqu'à 2,6 unités). Vapeur qui
    entre derrière (+Y), ressort devant (-Y).

    Massif en béton ; corps de turbine conique couché le long de X (petit côté haute pression à gauche), boîte à vapeur
    et vanne de réglage dessus ; accouplement (tourne) puis alternateur bleu à droite, boîte à bornes et borne
    électrique ; conduite d'arrivée qui passe au-dessus, échappement de gros diamètre vers l'avant ; pupitre.
    Pièce mobile : `arbre_` (arbre et plateaux d'accouplement, tourne vite autour de X).
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, ar = T.Lot(coll, 'pieces'), T.Lot(coll, 'arbre')
    y0, zc = 0.2, 1.05
    # Massif.
    lot.cube('beton', (2.7, 3.5, 0.3), (0, 0, 0.15), 0.02)
    lot.cube('acier_sombre', (2.5, 1.5, 0.06), (0, y0, 0.33), 0.005)  # semelle
    # Corps conique (HP à gauche, BP à droite), brides, paliers.
    T.cylinder_at(coll, 'corps', 0.42, 1.5, (-0.5, y0, zc), 'gris_clair', segments=seg, y=90, radius_top=0.62)
    for x, r in ((-1.25, 0.46), (-0.5, 0.56), (0.25, 0.66)):
        lot.tube('acier_sombre', (x - 0.03, y0, zc), (x + 0.03, y0, zc), r, seg)
    for x in (-1.4, 0.45):
        lot.cube('fonte', (0.18, 0.5, zc - 0.36), (x, y0, 0.36 + (zc - 0.36) / 2), 0.01)
        lot.cube('fonte', (0.22, 0.34, 0.12), (x, y0, zc), 0.01)
    # Boîte à vapeur, vanne de réglage.
    lot.cube('acier', (0.4, 0.42, 0.3), (-1.0, y0, zc + 0.48), 0.02)
    lot.tube('acier_sombre', (-1.0, y0, zc + 0.63), (-1.0, y0, zc + 0.75), 0.05, 6)
    lot.tube('rouge', (-1.0, y0, zc + 0.75), (-1.0, y0, zc + 0.78), 0.14, 12)
    # Accouplement (groupe `arbre_`).
    ar.tube('acier', (0.2, y0, zc), (0.66, y0, zc), 0.06, sg)
    for x in (0.36, 0.5):
        ar.tube('acier_sombre', (x - 0.03, y0, zc), (x + 0.03, y0, zc), 0.2, sg)
        for k in range(6):
            a = 2 * math.pi * k / 6
            ar.cube('jaune', (0.08, 0.04, 0.04), (x, y0 + 0.15 * math.cos(a), zc + 0.15 * math.sin(a)))
    T.pivot(coll, 'pivot_arbre', (0.43, y0, zc), (1, 0, 0))
    lot.cube('jaune', (0.3, 0.02, 0.36), (0.43, y0 - 0.24, zc - 0.02))  # carter ouvert
    lot.cube('jaune', (0.3, 0.02, 0.36), (0.43, y0 + 0.24, zc - 0.02))
    # Alternateur, ailettes, boîte à bornes, borne électrique.
    T.cylinder_at(coll, 'alternateur', 0.5, 0.8, (1.0, y0, zc), 'bleu', segments=seg, y=90)
    for k in range(5):
        x = 0.68 + k * 0.16
        lot.tube('bleu', (x - 0.015, y0, zc), (x + 0.015, y0, zc), 0.53, seg)
    lot.tube('acier_sombre', (1.4, y0, zc), (1.44, y0, zc), 0.4, seg)
    lot.cube('bleu', (0.7, 0.8, 0.12), (1.0, y0, 0.42), 0.01)  # pattes
    lot.cube('acier', (0.3, 0.3, 0.18), (1.0, y0, zc + 0.56), 0.01)
    lot.cube('cuivre', (0.2, 0.012, 0.1), (1.0, y0 - 0.505, zc + 0.05))
    T.borne_electrique(coll, lot, (1.05, y0, zc + 0.65), 0.45, sg)
    # Arrivée de vapeur (derrière, +Y) : monte et passe au-dessus jusqu'à la boîte à vapeur.
    a = T.raccord_fluide(lot, (0, 2.0), (0, 1, 0), r=0.12, longueur=0.2, sg=sg)
    _conduite(lot, [tuple(a), (0, 1.8, 1.85), (-1.0, 1.8, 1.85), (-1.0, y0, 1.85), (-1.0, y0, zc + 0.6)], 'acier', 0.11, sg)
    for y in (1.8,):
        lot.cube('acier_sombre', (0.1, 0.1, 1.5), (0.2, y, 1.05), 0.005)  # support
    # Échappement (devant, -Y) : gros diamètre sous la turbine.
    e = T.raccord_fluide(lot, (0, -2.0), (0, -1, 0), r=0.15, longueur=0.25, sg=sg)
    _conduite(lot, [(0, y0, zc - 0.4), (0, y0, 0.55), (0, -1.75, 0.55), tuple(e)], 'gris_clair', 0.15, sg)
    # Pupitre (devant à gauche).
    lot.cube('acier', (0.5, 0.35, 0.8), (-1.0, -1.45, 0.7), 0.02)
    lot.cube('panneau', (0.42, 0.3, 0.04), (-1.0, -1.5, 1.12), 0, Matrix.Rotation(-0.5, 3, 'X'))
    _manometre(coll, lot, 'tachymetre', (-1.1, -1.66, 0.85), '-Y', 0.08)
    for k, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (-0.88 + k * 0.0, -1.63, 0.95 - k * 0.09))
    for l in (lot, ar):
        l.finir()
    T.poser_au_sol(coll, 1.5, 2.0)


def generateur_combustible(coll, leger=True):
    """Générateur à combustible (`generator`) : 3 x 3 cases, 1 m de haut (modèle jusqu'à 2,6 unités). Le combustible
    entre DEVANT (-Y).

    Châssis ; devant, un gazogène (foyer vertical en fonte, porte où les braises rougeoient : `lueur_foyer`) surmonté
    d'une trémie pleine de charbon ; derrière, moteur vert à quatre culasses, collecteur et silencieux, cheminée
    d'échappement ; volant d'inertie (tourne), alternateur bleu à droite avec borne électrique ; radiateur et ventilateur
    (tourne) à gauche ; pupitre.
    Pièces mobiles : `volant_` (axe X), `ventilateur_` (axe X).
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, vo, ve = T.Lot(coll, 'pieces'), T.Lot(coll, 'volant'), T.Lot(coll, 'ventilateur')
    ym, zm = 0.4, 0.62  # axe du moteur
    # Châssis.
    lot.cube('acier_sombre', (2.8, 2.6, 0.14), (0, 0.05, 0.07), 0.01)
    for x in (-1.3, 1.3):
        lot.cube('jaune', (0.06, 2.6, 0.06), (x, 0.05, 0.15))
    # Gazogène et trémie (devant).
    T.cylinder(coll, 'gazogene', 0.48, 1.1, (0, -0.85, 0.14 + 0.55), 'fonte', segments=seg)
    for z in (0.4, 0.95):
        lot.tube('acier_sombre', (0, -0.85, z - 0.02), (0, -0.85, z + 0.02), 0.5, seg)
    lot.cube('fonte', (0.42, 0.06, 0.34), (0, -1.33, 0.5), 0.01)  # porte
    lot.cube('noir', (0.3, 0.02, 0.22), (0, -1.36, 0.5))
    T.box(coll, 'lueur_foyer', (0.24, 0.01, 0.14), (0, -1.372, 0.47), 'braise')  # rougeoie en marche
    T.tour(coll, 'tremie', [(0.3, 1.24), (0.62, 1.7), (0.64, 1.75)], 'acier_sombre', segments=4 if leger else 8,
           centre=(0, -0.85), fond=False, dessus=False)
    for k in range(6):
        a = k * 1.05
        lot.cube('noir', (0.14, 0.14, 0.1), (0.25 * math.cos(a), -0.85 + 0.25 * math.sin(a), 1.62), 0, Matrix.Rotation(a, 3, 'Z'))
    _conduite(lot, [(0.3, -0.6, 1.0), (0.3, -0.1, 1.0), (0.1, 0.1, zm + 0.3)], 'fonte', 0.07, sg)  # gaz vers le moteur
    # Moteur (axe X), culasses, collecteur, silencieux, cheminée.
    lot.cube('vert_fonce', (1.2, 0.7, 0.62), (-0.25, ym, zm), 0.03)
    lot.cube('vert_fonce', (1.05, 0.5, 0.2), (-0.25, ym, zm + 0.4), 0.02)
    for k in range(4):
        lot.cube('acier', (0.22, 0.4, 0.12), (-0.66 + k * 0.27, ym, zm + 0.56), 0.015)
        lot.tube('fonte', (-0.66 + k * 0.27, ym + 0.2, zm + 0.45), (-0.66 + k * 0.27, ym + 0.42, zm + 0.45), 0.05, 6)
    _conduite(lot, [(-0.75, ym + 0.42, zm + 0.45), (0.15, ym + 0.42, zm + 0.45)], 'fonte', 0.07, sg)  # collecteur
    T.cylinder_at(coll, 'silencieux', 0.18, 0.9, (-0.6, 1.1, zm + 0.45), 'acier', segments=12, y=90)
    _conduite(lot, [(-1.05, 1.1, zm + 0.45), (-1.15, 1.1, zm + 0.45), (-1.15, 1.1, 2.35)], 'fonte', 0.08, sg)
    T.cylinder(coll, 'cheminee_chapeau', 0.15, 0.06, (-1.15, 1.1, 2.42), 'fonte', segments=8)
    # Volant (groupe `volant_`) et alternateur.
    _volant_x(vo, (0.5, ym, zm), 0.42, 'fonte', 'acier_sombre', 6, sg, larg=0.09)
    vo.tube('acier', (0.35, ym, zm), (0.68, ym, zm), 0.04, sg)
    T.pivot(coll, 'pivot_volant', (0.5, ym, zm), (1, 0, 0))
    T.cylinder_at(coll, 'alternateur', 0.38, 0.65, (1.02, ym, zm), 'bleu', segments=seg, y=90)
    for k in range(4):
        lot.tube('bleu', (0.76 + k * 0.17 - 0.015, ym, zm), (0.76 + k * 0.17 + 0.015, ym, zm), 0.41, seg)
    lot.cube('bleu', (0.6, 0.6, 0.12), (1.02, ym, 0.2), 0.01)
    lot.cube('acier', (0.26, 0.26, 0.16), (1.02, ym, zm + 0.46), 0.01)
    T.borne_electrique(coll, lot, (1.05, ym, zm + 0.54), 0.5, sg)
    # Radiateur et ventilateur (groupe `ventilateur_`), à gauche.
    lot.cube('acier_sombre', (0.14, 0.8, 0.8), (-1.18, ym, zm + 0.1), 0.01)
    for k in range(6 if leger else 10):
        lot.cube('noir', (0.15, 0.72, 0.015), (-1.18, ym, zm - 0.22 + k * 0.64 / (5 if leger else 9)))
    ve.tube('acier', (-1.03, ym, zm + 0.1), (-0.98, ym, zm + 0.1), 0.06, 8)
    for k in range(4):
        a = math.pi / 2 * k + 0.4
        ve.cube('acier', (0.02, 0.3, 0.08), (-1.0, ym + 0.15 * math.cos(a), zm + 0.1 + 0.15 * math.sin(a)), 0,
                Matrix.Rotation(a, 3, 'X'))
    T.pivot(coll, 'pivot_ventilateur', (-1.0, ym, zm + 0.1), (1, 0, 0))
    # Pupitre (devant à droite) et réservoir d'huile.
    lot.cube('acier', (0.45, 0.32, 0.75), (0.95, -1.15, 0.52), 0.02)
    _manometre(coll, lot, 'compteur', (0.95, -1.315, 0.72), '-Y', 0.08)
    for k, c in enumerate(('vert', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (0.85 + k * 0.2, -1.315, 0.5))
    T.cylinder_at(coll, 'reservoir', 0.16, 0.6, (-0.9, -0.85, 0.32), 'rouge', segments=12, y=90)
    for l in (lot, vo, ve):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def accumulateur_t3(coll, leger=True):
    """Accumulateur T3 (`accumulator`) : 2 x 2 cases, 1,2 m de haut (modèle jusqu'à 3,1 unités).

    Armoire de modules de batteries (rangées grises à liseré cyan) dans un cadre d'acier, jauge de charge à six segments
    (`voyant_*`, pulsent), ouïes, radiateurs à ailettes sur les côtés, deux grosses bornes (+ rouge, - noire) et la borne
    électrique sur le dessus.
    """
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    lot.cube('acier_sombre', (1.9, 1.9, 0.14), (0, 0, 0.07), 0.01)
    lot.cube('panneau', (1.6, 1.4, 2.1), (0, 0, 0.14 + 1.05), 0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.cube('acier', (0.1, 0.1, 2.16), (sx * 0.78, sy * 0.68, 0.14 + 1.08), 0.01)
    # Modules de batteries en façade (5 rangées), liserés cyan.
    for k in range(5):
        z = 0.38 + k * 0.38
        lot.cube('gris_clair', (1.2, 0.04, 0.3), (-0.12, -0.71, z), 0.01)
        lot.cube('cyan', (1.1, 0.045, 0.025), (-0.12, -0.715, z + 0.1))
        for x in (-0.55, 0.31):
            lot.cube('acier_sombre', (0.06, 0.05, 0.08), (x, -0.735, z - 0.05))  # poignées
    # Jauge de charge (six segments qui pulsent).
    lot.cube('noir', (0.18, 0.04, 1.9), (0.62, -0.71, 1.2))
    for k in range(6):
        T.box(coll, f'voyant_charge_{k}', (0.12, 0.02, 0.24), (0.62, -0.735, 0.4 + k * 0.3), 'cyan')
    # Radiateurs à ailettes sur les côtés.
    for s in (-1, 1):
        for k in range(6 if leger else 9):
            lot.cube('acier', (0.08, 1.1, 0.03), (s * 0.84, 0, 0.5 + k * 1.4 / (5 if leger else 8)))
    # Dessus : ouïes, grosses bornes, borne électrique.
    lot.cube('acier_sombre', (1.66, 1.46, 0.08), (0, 0, 2.28), 0.01)
    for k in range(4):
        lot.cube('noir', (0.9, 0.06, 0.02), (-0.2, -0.45 + k * 0.3, 2.33))
    for y, c in ((-0.35, 'rouge'), (0.35, 'noir')):
        lot.tube('blanc', (0.55, y, 2.32), (0.55, y, 2.42), 0.08, sg)
        lot.tube(c, (0.55, y, 2.42), (0.55, y, 2.55), 0.06, sg)
        lot.boule('cuivre', (0.55, y, 2.58), 0.05)
    T.borne_electrique(coll, lot, (-0.45, 0.35, 2.32), 0.5, sg)
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def relais_hyperfrequence(coll, leger=True):
    """Relais émetteur hyperfréquence (`relay`) : 2 x 2 cases, 1,5 m de haut (modèle jusqu'à 3,9 unités).

    Dalle, abri technique (porte, ouïes, voyant), pylône en treillis avec plateforme, et en haut une parabole avec son
    cornet et la lampe de l'émetteur. Pièces mobiles : `parabole_` (balaye doucement de gauche à droite autour de Z) ;
    `voyant_abri` pulse. Borne électrique sur l'abri.
    """
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    lot, pa = T.Lot(coll, 'pieces'), T.Lot(coll, 'parabole')
    lot.cube('beton', (1.9, 1.9, 0.12), (0, 0, 0.06), 0.02)
    # Abri technique (derrière).
    lot.cube('gris_clair', (1.2, 0.7, 0.9), (0, 0.55, 0.57), 0.02)
    lot.cube('acier_sombre', (1.26, 0.76, 0.06), (0, 0.55, 1.05), 0.01)
    lot.cube('acier', (0.36, 0.02, 0.7), (0.3, 0.19, 0.5))  # porte
    for k in range(4):
        lot.cube('noir', (0.4, 0.02, 0.03), (-0.3, 0.19, 0.4 + k * 0.1))  # ouïes
    T.box(coll, 'voyant_abri', (0.06, 0.02, 0.06), (0.3, 0.17, 0.95), 'vert')
    T.borne_electrique(coll, lot, (-0.4, 0.6, 1.08), 0.45, sg)
    # Pylône en treillis (devant), plateforme.
    yp, h = -0.45, 2.75
    pieds = [(-0.32, yp - 0.3), (0.32, yp - 0.3), (0.32, yp + 0.3), (-0.32, yp + 0.3)]
    tete = [(x * 0.5, yp + (y - yp) * 0.5) for x, y in pieds]
    for (x0, y0), (x1, y1) in zip(pieds, tete):
        lot.barre('acier', (x0, y0, 0.12), (x1, y1, h), 0.06)
    niveaux = 5
    for j in range(niveaux):
        t0, t1 = j / niveaux, (j + 1) / niveaux
        z0, z1 = 0.12 + (h - 0.12) * t0, 0.12 + (h - 0.12) * t1
        pts0 = [(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0) for (x0, y0), (x1, y1) in zip(pieds, tete)]
        pts1 = [(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1) for (x0, y0), (x1, y1) in zip(pieds, tete)]
        for k in range(4):
            a, b = pts0[k], pts1[(k + 1) % 4]
            lot.barre('acier', (a[0], a[1], z0), (b[0], b[1], z1), 0.03)  # diagonales
            c, d = pts1[k], pts1[(k + 1) % 4]
            lot.barre('acier', (c[0], c[1], z1), (d[0], d[1], z1), 0.035)  # ceintures
    lot.cube('acier_sombre', (0.7, 0.7, 0.05), (0, yp, h + 0.02), 0.005)  # plateforme
    for sx in (-1, 1):
        lot.tube('jaune', (sx * 0.33, yp - 0.33, h + 0.04), (sx * 0.33, yp - 0.33, h + 0.3), 0.015, 6)
        lot.tube('jaune', (sx * 0.33, yp + 0.33, h + 0.04), (sx * 0.33, yp + 0.33, h + 0.3), 0.015, 6)
        lot.tube('jaune', (sx * 0.33, yp - 0.33, h + 0.3), (sx * 0.33, yp + 0.33, h + 0.3), 0.015, 6)
    lot.barre('noir', (-0.4, 0.4, 0.5), (-0.1, yp + 0.15, 0.5), 0.03)  # câble vers le pylône
    lot.barre('noir', (-0.1, yp + 0.15, 0.5), (-0.1, yp + 0.15, h), 0.03)
    # Parabole (groupe `parabole_`) : mât court, coque tournée vers l'avant, cornet et lampe.
    zp = h + 0.55
    pa.tube('acier_sombre', (0, yp, h + 0.04), (0, yp, zp), 0.06, sg)
    pa.cube('acier_sombre', (0.2, 0.2, 0.2), (0, yp + 0.05, zp), 0.01)
    T.cylinder_at(coll, 'parabole_coque', 0.14, 0.18, (0, yp - 0.12, zp), 'blanc', segments=seg, x=90, radius_top=0.5)
    T.cylinder_at(coll, 'parabole_bord', 0.52, 0.03, (0, yp - 0.2, zp), 'gris_clair', segments=seg, x=90)
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        pa.barre('acier', (0.45 * math.cos(a), yp - 0.2, zp + 0.45 * math.sin(a)), (0, yp - 0.62, zp), 0.02)
    pa.tube('acier_sombre', (0, yp - 0.55, zp), (0, yp - 0.68, zp), 0.05, sg)  # cornet
    T.pivot(coll, 'pivot_parabole', (0, yp, zp), (0, 0, 1))
    pa.tube('cyan', (0, yp - 0.68, zp), (0, yp - 0.72, zp), 0.035, 8)  # lampe de l'émetteur
    for l in (lot, pa):
        l.finir()
    T.poser_au_sol(coll, 1.0)


def antenne_quantique(coll, leger=True):
    """Antenne d'alignement quantique (`antenna`) : 3 x 3 cases, 3 m de haut (modèle jusqu'à 7,8 unités).

    Socle hexagonal à deux étages, conduits lumineux, quatre contreforts ; colonne centrale cerclée de cyan qui porte un
    cristal violet en double pointe (`voyant_cristal_*`, pulse) et une flèche en acier ; trois anneaux qui flottent
    autour de la colonne et tournent : `anneaux_` (anneaux bas et haut, sens direct) et `contre_` (anneau du milieu,
    sens inverse). Borne électrique sur le socle.
    """
    sg = 8 if leger else 14
    seg = 6
    lot, an, ct = T.Lot(coll, 'pieces'), T.Lot(coll, 'anneaux'), T.Lot(coll, 'contre')
    T.cylinder(coll, 'socle', 1.45, 0.3, (0, 0, 0.15), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'socle_haut', 1.05, 0.32, (0, 0, 0.46), 'gris_clair', segments=seg)
    for k in range(6):  # conduits lumineux du socle
        a = 2 * math.pi * (k + 0.5) / 6
        lot.barre('cyan', (1.0 * math.cos(a), 1.0 * math.sin(a), 0.31), (1.4 * math.cos(a), 1.4 * math.sin(a), 0.31), 0.05)
    for k in range(4):  # contreforts
        a = math.pi / 4 + k * math.pi / 2
        lot.barre('acier', (1.15 * math.cos(a), 1.15 * math.sin(a), 0.3), (0.3 * math.cos(a), 0.3 * math.sin(a), 2.2), 0.12)
    T.cylinder(coll, 'colonne', 0.3, 4.9, (0, 0, 0.62 + 2.45), 'panneau', segments=8)
    for z in (1.2, 2.0, 2.8, 3.6, 4.4, 5.2):
        lot.tube('cyan', (0, 0, z - 0.03), (0, 0, z + 0.03), 0.32, 8)
    # Cristal en double pointe, flèche.
    zc = 5.95
    T.cylinder(coll, 'voyant_cristal_bas', 0.42, 0.45, (0, 0, zc - 0.225), 'violet', segments=6, radius_top=0.42)
    T.cylinder(coll, 'voyant_cristal_pointe_bas', 0.0, 0.4, (0, 0, zc - 0.45 - 0.2), 'violet', segments=6, radius_top=0.42)
    T.cylinder(coll, 'voyant_cristal_haut', 0.42, 0.6, (0, 0, zc + 0.3), 'violet', segments=6, radius_top=0.0)
    for k in range(3):
        a = 2 * math.pi * k / 3
        lot.barre('acier_sombre', (0.2 * math.cos(a), 0.2 * math.sin(a), 5.4), (0.45 * math.cos(a), 0.45 * math.sin(a), zc), 0.05)
    T.cylinder(coll, 'fleche', 0.06, 0.8, (0, 0, zc + 0.6 + 0.4), 'acier', segments=6, radius_top=0.0)
    # Anneaux flottants (tournent) : bras de liaison invisibles (les anneaux « flottent »).
    for (z, r, g, inc) in ((2.4, 1.15, an, 0.12), (3.6, 0.95, ct, -0.15), (4.8, 0.75, an, 0.1)):
        n = 16 if leger else 24
        rot = Matrix.Rotation(inc, 3, 'X')
        for k in range(n):
            a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
            p0 = rot @ Vector((r * math.cos(a0), r * math.sin(a0), 0)) + Vector((0, 0, z))
            p1 = rot @ Vector((r * math.cos(a1), r * math.sin(a1), 0)) + Vector((0, 0, z))
            g.barre('acier' if k % 4 else 'cyan', p0, p1, 0.07)
        for k in range(4):  # nœuds
            a = math.pi / 2 * k
            g.cube('cyan', (0.12, 0.12, 0.12), tuple(rot @ Vector((r * math.cos(a), r * math.sin(a), 0)) + Vector((0, 0, z))))
    T.pivot(coll, 'pivot_anneaux', (0, 0, 3.6), (0, 0, 1))
    T.pivot(coll, 'pivot_contre', (0, 0, 3.6), (0, 0, 1))
    T.borne_electrique(coll, lot, (0.75, -0.75, 0.3), 0.7, sg)
    for l in (lot, an, ct):
        l.finir()
    T.poser_au_sol(coll, 1.5)


# --- Lot énergie au style doux (octobre 2026) : poteaux haute et très haute tension, lampadaire, éolienne. -----------
# Formes arrondies et ombrage lisse (aides de `outils.py`, `T.adoucir`). Ces modèles dépassent un peu de leur emprise
# (bras, rotor) : le jeu les met à l'échelle sur leur seule hauteur (`OVERHANG_MODELS` dans `factoryView.ts`).

TEINTES_DOUX = {
    'socle_beton': '#b9b2a4',
    'socle_beton_sombre': '#958e80',
    'pylone': '#9aa6b2',
    'pylone_sombre': '#6f7b88',
    'isolateur_verre': '#7fc4cf',
    'isolateur_cuivre': '#d08a4a',
    'panneau_jaune': '#e9b949',
    'panneau_noir': '#2e3138',
    'lampadaire': '#3e5249',
    'lampadaire_clair': '#5b7266',
    'lampe_globe': '#ffe7a3',
    'eolienne': '#eef1f4',
    'eolienne_gris': '#c5ccd4',
    'eolienne_rouge': '#d0533f',
}
for _k, _v in TEINTES_DOUX.items():
    T.PALETTE.setdefault(_k, _v)
BRILLANTS_DOUX = {'isolateur_verre': 0.15, 'isolateur_cuivre': 0.35, 'pylone': 0.5, 'eolienne': 0.4, 'lampe_globe': 0.2}


def _doux(coll):
    """Finition du style doux : métal et verre un peu brillants, ombrage lisse."""
    for nom, rugosite in BRILLANTS_DOUX.items():
        m = bpy.data.materials.get(nom)
        if m:
            bsdf = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Roughness'].default_value = rugosite
    T.adoucir(coll)


def _fut(lot, mat, z0, z1, r0, r1, n, xy=(0.0, 0.0)):
    """Fût rond effilé (rayon r0 en bas, r1 en haut), bouts légèrement chanfreinés."""
    import outils as O
    x, y = xy
    k = min(r0, r1) * 0.25
    _sec = lambda z, r: ((x, y, z), O.X, O.Y, r, r, r)  # noqa: E731
    O._loft(lot, mat, [_sec(z0, r0 - k), _sec(z0 + k, r0), _sec(z1 - k, r1), _sec(z1, r1 - k)], n + 1)


def _socle(lot, demi, h, n):
    """Socle en béton arrondi, avec un léger gradin."""
    import outils as O
    O._rond(lot, 'socle_beton_sombre', (0, 0, 0), (0, 0, 0.08), demi + 0.06, demi + 0.06, n, k=0.03, r=0.12)
    O._rond(lot, 'socle_beton', (0, 0, 0.06), (0, 0, h), demi, demi, n, k=0.06, r=0.14)


def _chaine(lot, p, disques, r, n):
    """Chaîne d'isolateurs suspendue sous le point `p` (disques de verre, chapeau et pince en cuivre) ; renvoie le bas."""
    import outils as O
    x, y, z = p
    O._cyl(lot, 'pylone_sombre', (x, y, z), (x, y, z - 0.12), 0.035, n)
    zk = z - 0.12
    m = max(2, n - 1)
    for _ in range(disques):
        O._cyl(lot, 'isolateur_verre', (x, y, zk), (x, y, zk - 0.06), r, m, k=0.02)
        O._cyl(lot, 'isolateur_verre', (x, y, zk - 0.06), (x, y, zk - 0.11), r * 0.45, m)
        zk -= 0.11
    O._cyl(lot, 'isolateur_cuivre', (x, y, zk), (x, y, zk - 0.1), 0.06, n)
    return Vector((x, y, zk - 0.1))


def _panneau_danger(lot, p, n):
    """Petit panneau jaune « danger électrique » (éclair noir) posé sur une face tournée vers -Y."""
    import outils as O
    x, y, z = p
    O._rond(lot, 'panneau_jaune', (x, y, z - 0.16), (x, y, z + 0.16), 0.14, 0.012, n, k=0.004, r=0.03)
    for a, b in (((x + 0.04, z + 0.11), (x - 0.02, z)), ((x - 0.02, z), (x + 0.03, z)), ((x + 0.03, z), (x - 0.04, z - 0.11))):
        O._rond(lot, 'panneau_noir', (a[0], y - 0.014, a[1]), (b[0], y - 0.014, b[1]), 0.018, 0.004, 2, k=0.002, r=0.004)


def poteau_haute_tension(coll, leger=True):
    """Poteau haute tension (`pole_hv`) : 2 x 2 cases, 6 m (12 unités) de haut.

    Mât d'acier effilé sur un socle en béton, trois bras en escalier (plus larges vers le bas), une chaîne d'isolateurs
    en verre au bout de chaque bras et une sur la tête du mât ; panneau « danger » sur le mât. Les câbles du jeu partent
    de l'isolateur de tête (repère `accroche_cable`). Rien ne bouge.
    """
    import outils as O
    n = 3 if leger else 5
    lot = T.Lot(coll, 'pieces')
    _socle(lot, 0.55, 0.45, n)
    _fut(lot, 'pylone', 0.45, 11.6, 0.2, 0.11, n)
    for z in (0.75, 3.5):
        r = 0.2 - 0.09 * (z - 0.45) / 11.15
        _fut(lot, 'pylone_sombre', z - 0.05, z + 0.05, r + 0.03, r + 0.03, n)
    _panneau_danger(lot, (0, -0.18, 2.4), n)
    for i, (z, w) in enumerate(((11.0, 0.9), (10.1, 1.25), (9.2, 1.6))):
        O._rond(lot, 'pylone', (-w, 0, z), (w, 0, z), 0.07, 0.09, n, k=0.03)
        for s in (-1, 1):
            O._rond(lot, 'pylone_sombre', (s * w * 0.55, 0, z - 0.07), (s * 0.08, 0, z - 0.55), 0.04, 0.04, n, k=0.015)
            _chaine(lot, (s * (w - 0.08), 0, z - 0.06), 3 if i else 2, 0.13, n)
    O._cyl(lot, 'pylone_sombre', (0, 0, 11.6), (0, 0, 11.68), 0.16, n)
    tete = Vector((0, 0, 11.68))
    zk = tete.z
    for _ in range(3):  # isolateur de tête, debout
        O._cyl(lot, 'isolateur_verre', (0, 0, zk), (0, 0, zk + 0.06), 0.13, n, k=0.02)
        O._cyl(lot, 'isolateur_verre', (0, 0, zk + 0.06), (0, 0, zk + 0.11), 0.06, n)
        zk += 0.11
    O._cyl(lot, 'isolateur_cuivre', (0, 0, zk), (0, 0, zk + 0.1), 0.06, n)
    T.reperer(coll, 'accroche_cable', (0, 0, zk + 0.1))
    lot.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


def poteau_tres_haute_tension(coll, leger=True):
    """Poteau très haute tension (`pole_uhv`) : 2 x 2 cases, pylône de 10 m (20 unités).

    Pylône en treillis : quatre montants arrondis qui se resserrent vers le haut, croisillons sur les quatre faces, trois
    bras larges (le milieu est le plus large), chaînes d'isolateurs suspendues au bout des bras, pointe avec le câble de
    garde. Plots en béton sous les montants. Les câbles du jeu partent de la pointe (repère `accroche_cable`).
    """
    import outils as O
    n = 3 if leger else 5
    lot = T.Lot(coll, 'pieces')
    H, ZB = 19.2, 13.6  # haut des montants, début du fût droit (au-dessus, les montants restent parallèles)
    demi = lambda z: 0.85 - 0.55 * min(z, ZB) / ZB  # noqa: E731  (demi-écart des montants à la hauteur z)
    coins = ((1, 1), (-1, 1), (-1, -1), (1, -1))
    for sx, sy in coins:
        O._rond(lot, 'socle_beton', (sx * 0.85, sy * 0.85, 0), (sx * 0.85, sy * 0.85, 0.35), 0.17, 0.17, n, k=0.04)
    # Montants (deux tronçons : la partie qui se resserre, puis le fût droit).
    for sx, sy in coins:
        for z0, z1 in ((0.3, ZB), (ZB, H)):
            O._rond(lot, 'pylone', (sx * demi(z0), sy * demi(z0), z0), (sx * demi(z1), sy * demi(z1), z1), 0.06, 0.06, n,
                    k=0.02)
    # Croisillons en X et entretoises, sur les quatre faces.
    niveaux = [0.4, 2.6, 4.9, 7.0, 8.9, 10.6, 12.2, ZB, 15.0, 16.8, 18.0, H]
    faces = (((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1)), ((-1, -1), (1, -1)))
    for z0, z1 in zip(niveaux, niveaux[1:]):
        for (ax, ay), (bx, by) in faces:
            a0 = (ax * demi(z0), ay * demi(z0), z0)
            b0 = (bx * demi(z0), by * demi(z0), z0)
            a1 = (ax * demi(z1), ay * demi(z1), z1)
            b1 = (bx * demi(z1), by * demi(z1), z1)
            lot.barre('pylone_sombre', a0, b1, 0.05, 0.01)
            lot.barre('pylone_sombre', b0, a1, 0.05, 0.01)
            lot.barre('pylone', a1, b1, 0.06, 0.012)
    # Bras : poutre principale, poutre basse en biais, croisillons ; chaîne d'isolateurs au bout.
    w0 = demi(ZB)
    for z, w in ((15.0, 2.2), (16.8, 2.7), (18.6, 1.7)):
        for s in (-1, 1):
            for y in (-w0, w0):
                O._rond(lot, 'pylone', (s * w0, y, z), (s * w, y * 0.3, z), 0.05, 0.05, n, k=0.02)
                lot.barre('pylone_sombre', (s * w0, y, z - 0.75), (s * w, y * 0.3, z - 0.05), 0.06, 0.01)
            for k in range(1, 4):
                x = s * (w0 + (w - w0) * k / 4)
                lot.barre('pylone_sombre', (x, -w0 * 0.8, z), (x, w0 * 0.8, z), 0.045, 0.008)
            _chaine(lot, (s * (w - 0.1), 0, z - 0.04), 4 if leger else 6, 0.15, n)
    # Pointe et câble de garde.
    for sx, sy in coins:
        O._rond(lot, 'pylone', (sx * w0, sy * w0, H), (0, 0, H + 0.75), 0.04, 0.04, n, k=0.015)
    O._cyl(lot, 'isolateur_cuivre', (0, 0, H + 0.7), (0, 0, H + 0.82), 0.07, n)
    T.reperer(coll, 'accroche_cable', (0, 0, H + 0.82))
    _panneau_danger(lot, (0, -demi(1.6) - 0.07, 1.6), n)
    lot.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


def lampadaire(coll, leger=True):
    """Lampadaire (`lamp`) : 1 x 1 case, 3 m (6 unités) de haut.

    Socle en béton, mât vert sombre effilé avec une bague décorative, crosse qui avance la tête vers l'avant (-Y), tête en
    chapeau arrondi. Le globe s'allume quand le lampadaire est alimenté : pièce `voyant_lampe_*` (préfixe `voyant`, sa
    couleur pâlit à l'arrêt et s'éclaire en marche) ; la lumière de nuit est ajoutée par le jeu.
    """
    import outils as O
    n = 3 if leger else 5
    lot, globe = T.Lot(coll, 'pieces'), T.Lot(coll, 'voyant_lampe')
    O._rond(lot, 'socle_beton', (0, 0, 0), (0, 0, 0.22), 0.3, 0.3, n, k=0.04, r=0.1)
    _fut(lot, 'lampadaire', 0.22, 0.75, 0.13, 0.11, n)
    _fut(lot, 'lampadaire_clair', 0.75, 0.85, 0.135, 0.135, n)
    _fut(lot, 'lampadaire', 0.85, 5.3, 0.08, 0.055, n)
    _fut(lot, 'lampadaire_clair', 2.6, 2.68, 0.085, 0.085, n)
    # Crosse : quelques segments arrondis qui décrivent un quart de cercle vers -Y.
    R, zc = 0.55, 5.3
    pts = [Vector((0, 0, zc - 0.02))] + [Vector((0, -(R - R * math.cos(a)), zc + R * math.sin(a)))
                                           for a in [k * math.pi / 2 / 6 for k in range(1, 7)]]
    for a, b in zip(pts, pts[1:]):
        O._cyl(lot, 'lampadaire', a, b + (b - a).normalized() * 0.02, 0.05, n, k=0.005)
    bout = pts[-1]  # (0, -0.55, 5.85) : la crosse redescend un peu vers la tête
    tete = Vector((0, -0.62, 5.72))
    O._cyl(lot, 'lampadaire', bout, tete, 0.045, n)
    # Tête : chapeau arrondi, globe dessous.
    O._loft(lot, 'lampadaire', [((tete.x, tete.y, tete.z + 0.08), O.X, O.Y, 0.06, 0.06, 0.06),
                                ((tete.x, tete.y, tete.z), O.X, O.Y, 0.18, 0.18, 0.18),
                                ((tete.x, tete.y, tete.z - 0.08), O.X, O.Y, 0.25, 0.25, 0.25),
                                ((tete.x, tete.y, tete.z - 0.11), O.X, O.Y, 0.23, 0.23, 0.23)], n + 1)
    O._loft(globe, 'lampe_globe', [((tete.x, tete.y, tete.z - 0.1), O.X, O.Y, 0.17, 0.17, 0.17),
                                   ((tete.x, tete.y, tete.z - 0.22), O.X, O.Y, 0.15, 0.15, 0.15),
                                   ((tete.x, tete.y, tete.z - 0.3), O.X, O.Y, 0.06, 0.06, 0.06)], n + 1)
    for l in (lot, globe):
        l.finir()
    T.poser_au_sol(coll, 0.5)
    _doux(coll)


def eolienne(coll, leger=True):
    """Éolienne (`wind_turbine`) : 2 x 2 cases ; tour de 5 m, rotor de 3 m de diamètre (tout en haut : 6,3 m).

    Socle en béton, tour blanche effilée, nacelle arrondie, moyeu en ogive vers l'avant (-Y), trois pales fines et un peu
    vrillées, bout des pales rouge. Pièce mobile : groupe `rotor_` (moyeu et pales), qui tourne autour de l'axe Y du
    `pivot_rotor` quand l'éolienne produit.
    """
    import outils as O
    n = 3 if leger else 5
    lot, rotor = T.Lot(coll, 'pieces'), T.Lot(coll, 'rotor')
    _socle(lot, 0.7, 0.35, n)
    ZN = 9.6  # axe du rotor
    _fut(lot, 'eolienne', 0.35, ZN - 0.25, 0.28, 0.14, n)
    _fut(lot, 'eolienne_gris', 0.35, 0.5, 0.31, 0.31, n)
    _fut(lot, 'eolienne_gris', ZN - 0.45, ZN - 0.3, 0.17, 0.17, n)
    # Nacelle : volume arrondi allongé selon Y, un peu plus haut derrière.
    O._loft(lot, 'eolienne', [((0, -0.5, ZN), O.X, O.Z, 0.17, 0.17, 0.15),
                              ((0, -0.38, ZN), O.X, O.Z, 0.24, 0.25, 0.2),
                              ((0, 0.3, ZN + 0.02), O.X, O.Z, 0.26, 0.28, 0.22),
                              ((0, 0.75, ZN + 0.02), O.X, O.Z, 0.2, 0.22, 0.17),
                              ((0, 0.86, ZN + 0.02), O.X, O.Z, 0.1, 0.12, 0.09)], n + 1)
    O._rond(lot, 'eolienne_gris', (0, -0.1, ZN + 0.28), (0, 0.55, ZN + 0.28), 0.12, 0.025, n, k=0.01)  # trappe
    # Rotor : ogive du moyeu et trois pales.
    yh = -0.62
    O._loft(rotor, 'eolienne', [((0, yh + 0.14, ZN), O.X, O.Z, 0.16, 0.16, 0.16),
                                ((0, yh, ZN), O.X, O.Z, 0.19, 0.19, 0.19),
                                ((0, yh - 0.18, ZN), O.X, O.Z, 0.14, 0.14, 0.14),
                                ((0, yh - 0.3, ZN), O.X, O.Z, 0.05, 0.05, 0.05)], n + 1)
    Ry = Vector((0, 1, 0))
    L = 2.95
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        d = Vector((math.cos(a), 0, math.sin(a)))
        corde = Vector((-math.sin(a), 0, math.cos(a)))
        sections = []
        for t, c, e in ((0.12, 0.08, 0.06), (0.35, 0.2, 0.05), (0.7, 0.24, 0.04), (1.6, 0.17, 0.03), (2.5, 0.1, 0.02),
                        (L, 0.05, 0.012)):
            tw = 0.5 - 0.35 * t / L  # vrillage : la pale se met à plat vers le bout
            u = (corde * math.cos(tw) + Ry * math.sin(tw)).normalized()
            v = d.cross(u).normalized()
            sections.append((Vector((0, yh, ZN)) + d * t, u, v, c, e, e))
        coupe = 4
        O._loft(rotor, 'eolienne', [(Vector(s[0]), s[1], s[2], s[3], s[4], s[5]) for s in sections[:coupe + 1]], n, (True, False))
        O._loft(rotor, 'eolienne_rouge', [(Vector(s[0]), s[1], s[2], s[3], s[4], s[5]) for s in sections[coupe:]], n,
                (False, True))
    T.pivot(coll, 'pivot_rotor', (0, yh, ZN), (0, 1, 0))
    for l in (lot, rotor):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Lot énergie 2 au style doux : transformateur, disjoncteur, panneau solaire, accumulateur de base. -------------
TEINTES_DOUX2 = {
    'transfo': '#6f8796',
    'transfo_sombre': '#4f6371',
    'transfo_clair': '#93aab8',
    'coffret': '#c9cdd2',
    'coffret_sombre': '#8f969e',
    'levier_rouge': '#d0533f',
    'solaire': '#2f5a9e',
    'solaire_ligne': '#8fb4e6',
    'solaire_cadre': '#d3d8de',
    'accu': '#5f7a5a',
    'accu_sombre': '#435740',
    'voyant_vert': '#6be08f',
    'voyant_ambre': '#f2b33d',
}
for _k, _v in TEINTES_DOUX2.items():
    T.PALETTE.setdefault(_k, _v)
BRILLANTS_DOUX.update({'solaire': 0.12, 'transfo': 0.45, 'coffret': 0.4, 'levier_rouge': 0.35})


def _borne_douce(coll, lot, p, h, n):
    """Borne de raccordement arrondie (tige, isolateur en verre, boule en cuivre) ; repère `accroche_cable` sur la boule."""
    import outils as O
    x, y, z = p
    O._cyl(lot, 'pylone_sombre', (x, y, z), (x, y, z + 0.05), 0.07, n)
    O._cyl(lot, 'pylone', (x, y, z + 0.05), (x, y, z + h), 0.025, n)
    for k in range(2):
        zk = z + h - 0.14 + k * 0.06
        O._cyl(lot, 'isolateur_verre', (x, y, zk), (x, y, zk + 0.035), 0.06, n, k=0.012)
    c = (x, y, z + h + 0.05)
    O._loft(lot, 'isolateur_cuivre', [((x, y, z + h), O.X, O.Y, 0.03, 0.03, 0.03), ((x, y, z + h + 0.05), O.X, O.Y, 0.06, 0.06, 0.06),
                                      ((x, y, z + h + 0.1), O.X, O.Y, 0.03, 0.03, 0.03)], n + 1)
    T.reperer(coll, 'accroche_cable', c)


def transformateur(coll, leger=True):
    """Transformateur (`transformer`) : 3 x 3 cases, 2,5 m (5 unités) de haut.

    Cuve arrondie sur un socle en béton, radiateurs à ailettes sur les deux côtés, conservateur d'huile (petit cylindre
    couché) sur le dessus, trois traversées en verre côté haute tension (derrière, plus hautes) et trois côté basse tension
    (devant, plus petites) ; plaque et panneau « danger » en façade. Le câble s'accroche à la traversée centrale haute.
    Voyants `voyant_*` (vert) en façade : allumés quand de l'énergie traverse.
    """
    import outils as O
    n = 3 if leger else 5
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'socle_beton', (0, 0, 0), (0, 0, 0.3), 1.42, 1.3, n, k=0.05, r=0.14)
    O._rond(lot, 'transfo', (0, 0, 0.3), (0, 0, 3.3), 0.85, 0.75, n, k=0.1, r=0.22)
    O._rond(lot, 'transfo_clair', (0, 0, 3.25), (0, 0, 3.45), 0.92, 0.82, n, k=0.06, r=0.24)  # couvercle
    # Radiateurs : ailettes arrondies sur les flancs ±X, deux collecteurs.
    for s in (-1, 1):
        for zc in (0.7, 2.9):
            O._cyl(lot, 'transfo_sombre', (s * 0.85, 0, zc), (s * 1.3, 0, zc), 0.06, n)
        for k in range(6 if leger else 9):
            y = -0.55 + k * 1.1 / (5 if leger else 8)
            O._rond(lot, 'transfo_clair', (s * 1.07, y, 0.6), (s * 1.07, y, 3.0), 0.22, 0.03, n, k=0.02, r=0.03)
    # Conservateur d'huile couché sur le dessus, avec son support.
    O._cyl(lot, 'transfo', (-0.6, 0.45, 4.05), (0.6, 0.45, 4.05), 0.24, n + 1, k=0.08)
    for x in (-0.4, 0.4):
        O._rond(lot, 'transfo_sombre', (x, 0.45, 3.45), (x, 0.45, 3.85), 0.05, 0.05, n, k=0.015)
    # Traversées haute tension (derrière, +Y) et basse tension (devant, -Y).
    for x in (-0.5, 0, 0.5):
        y = -0.1
        O._cyl(lot, 'transfo_sombre', (x, y, 3.45), (x, y, 3.55), 0.11, n)
        zk = 3.55
        for _ in range(4):
            O._cyl(lot, 'isolateur_verre', (x, y, zk), (x, y, zk + 0.06), 0.11, max(2, n - 1), k=0.02)
            O._cyl(lot, 'isolateur_verre', (x, y, zk + 0.06), (x, y, zk + 0.12), 0.05, max(2, n - 1))
            zk += 0.12
        O._cyl(lot, 'isolateur_cuivre', (x, y, zk), (x, y, zk + 0.1), 0.05, n)
        if x == 0:
            T.reperer(coll, 'accroche_cable', (x, y, zk + 0.1))
        yb = -0.55
        O._cyl(lot, 'transfo_sombre', (x, yb, 3.45), (x, yb, 3.52), 0.08, n)
        O._cyl(lot, 'isolateur_verre', (x, yb, 3.52), (x, yb, 3.75), 0.06, max(2, n - 1), k=0.02)
        O._cyl(lot, 'isolateur_cuivre', (x, yb, 3.75), (x, yb, 3.83), 0.04, n)
    # Façade : plaque, panneau danger, voyants.
    O._rond(lot, 'transfo_clair', (0, -0.76, 1.3), (0, -0.76, 1.8), 0.35, 0.015, n, k=0.005, r=0.04)
    _panneau_danger(lot, (0, -0.765, 2.4), n)
    vo = T.Lot(coll, 'voyant_flux')
    for x in (-0.18, 0, 0.18):
        O._cyl(vo, 'voyant_vert', (x, -0.75, 1.05), (x, -0.8, 1.05), 0.045, n)
    for l in (lot, vo):
        l.finir()
    T.poser_au_sol(coll, 1.5)
    _doux(coll)


def disjoncteur(coll, leger=True):
    """Disjoncteur (`breaker`) : 2 x 2 cases, 1,5 m (3 unités) de haut.

    Coffret gris arrondi sur deux pieds, toit débordant, gros levier rouge en façade (groupe `levier_`, pivot `pivot_levier`
    axe X) : levé quand le disjoncteur est fermé, il bascule vers le bas quand il s'ouvre (surcharge ou à la main). Voyant
    ambre `voyant_*`, deux bornes sur le toit (le câble s'accroche à celle de gauche).
    """
    import outils as O
    n = 3 if leger else 5
    lot, lev = T.Lot(coll, 'pieces'), T.Lot(coll, 'levier')
    O._rond(lot, 'socle_beton', (0, 0, 0), (0, 0, 0.16), 0.95, 0.75, n, k=0.04, r=0.1)
    for x in (-0.55, 0.55):
        O._rond(lot, 'coffret_sombre', (x, 0.1, 0.16), (x, 0.1, 0.55), 0.1, 0.1, n, k=0.03)
    O._rond(lot, 'coffret', (0, 0.1, 0.55), (0, 0.1, 2.55), 0.8, 0.5, n, k=0.08, r=0.18)
    O._rond(lot, 'coffret_sombre', (0, 0.05, 2.5), (0, 0.05, 2.66), 0.9, 0.62, n, k=0.05, r=0.16)  # toit
    # Porte : cadre en relief, plaque, panneau danger.
    O._rond(lot, 'coffret_sombre', (0, -0.41, 0.75), (0, -0.41, 2.35), 0.66, 0.02, n, k=0.01, r=0.08)
    O._rond(lot, 'coffret', (0, -0.43, 0.8), (0, -0.43, 2.3), 0.62, 0.02, n, k=0.01, r=0.07)
    _panneau_danger(lot, (0.38, -0.46, 2.0), n)
    # Levier : palier, bras et poignée.
    zp = 1.45
    O._cyl(lot, 'coffret_sombre', (-0.22, -0.45, zp), (-0.22, -0.56, zp), 0.13, n)
    O._cyl(lev, 'levier_rouge', (-0.32, -0.6, zp), (-0.12, -0.6, zp), 0.07, n)
    O._rond(lev, 'levier_rouge', (-0.22, -0.6, zp), (-0.22, -0.66, zp + 0.5), 0.04, 0.04, n, k=0.015)
    O._loft(lev, 'levier_rouge', [((-0.32, -0.67, zp + 0.53), O.X, O.Y, 0.0, 0.05, 0.05),
                                  ((-0.3, -0.67, zp + 0.53), O.X, O.Y, 0.0, 0.07, 0.07),
                                  ((-0.14, -0.67, zp + 0.53), O.X, O.Y, 0.0, 0.07, 0.07),
                                  ((-0.12, -0.67, zp + 0.53), O.X, O.Y, 0.0, 0.05, 0.05)], n + 1)
    T.pivot(coll, 'pivot_levier', (-0.22, -0.6, zp), (1, 0, 0))
    # Voyant ambre et repères « I / O ».
    vo = T.Lot(coll, 'voyant_etat')
    O._cyl(vo, 'voyant_ambre', (0.3, -0.44, 1.35), (0.3, -0.5, 1.35), 0.07, n)
    O._rond(lot, 'panneau_noir', (-0.5, -0.455, zp + 0.42), (-0.5, -0.455, zp + 0.56), 0.012, 0.004, 2, k=0.002, r=0.004)
    O._cyl(lot, 'panneau_noir', (-0.5, -0.45, zp - 0.45), (-0.5, -0.46, zp - 0.45), 0.06, n)
    O._cyl(lot, 'coffret', (-0.5, -0.452, zp - 0.45), (-0.5, -0.465, zp - 0.45), 0.04, n)
    _borne_douce(coll, lot, (-0.45, 0.15, 2.66), 0.35, n)
    O._cyl(lot, 'pylone_sombre', (0.45, 0.15, 2.66), (0.45, 0.15, 2.71), 0.07, n)
    O._cyl(lot, 'pylone', (0.45, 0.15, 2.71), (0.45, 0.15, 2.9), 0.025, n)
    O._cyl(lot, 'isolateur_cuivre', (0.45, 0.15, 2.9), (0.45, 0.15, 2.98), 0.05, n)
    for l in (lot, lev, vo):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


def panneau_solaire(coll, leger=True):
    """Panneau solaire (`solar_panel`) : 3 x 3 cases, 1,2 m (2,4 unités) de haut.

    Grand panneau bleu incliné vers l'avant (-Y), cadre clair arrondi, cellules séparées par des lignes claires, sur un
    pied central et deux jambes de force ; boîtier de raccordement au pied avec sa borne (le câble s'y accroche).
    """
    import outils as O
    n = 3 if leger else 5
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'socle_beton', (0, 0.3, 0), (0, 0.3, 0.14), 0.45, 0.45, n, k=0.03, r=0.1)
    O._rond(lot, 'pylone', (0, 0.3, 0.14), (0, 0.3, 1.45), 0.08, 0.08, n, k=0.02)
    a = 0.55  # inclinaison (rad)
    c = Vector((0, 0.05, 1.6))
    u = Vector((1, 0, 0))
    v = Vector((0, math.cos(a), math.sin(a)))  # vers le haut du panneau (derrière)
    w = u.cross(v)  # normale (vers le ciel et l'avant)
    W, Hh = 1.44, 1.2
    for s in (-1, 1):  # jambes de force vers les coins arrière
        O._rond(lot, 'pylone_sombre', (s * 0.2, 0.3, 0.6), tuple(c + u * s * 0.9 + v * 0.6 - w * 0.06), 0.035, 0.035, n,
                k=0.01)
    O._rond(lot, 'pylone_sombre', tuple(c - w * 0.12 - u * 1.0), tuple(c - w * 0.12 + u * 1.0), 0.05, 0.05, n, k=0.015)
    # Cadre et vitrage : deux plaques arrondies (le loft se fait le long de la normale).
    O._loft(lot, 'solaire_cadre', [(c - w * 0.06, u, v, W - 0.02, Hh - 0.02, 0.06), (c - w * 0.04, u, v, W, Hh, 0.07),
                                   (c + w * 0.02, u, v, W, Hh, 0.07), (c + w * 0.035, u, v, W - 0.02, Hh - 0.02, 0.06)], n)
    O._loft(lot, 'solaire', [(c + w * 0.03, u, v, W - 0.07, Hh - 0.07, 0.03), (c + w * 0.045, u, v, W - 0.08, Hh - 0.08, 0.03)],
            n)
    for k in range(1, 6):  # lignes entre les cellules
        x = -W + 0.07 + k * (2 * W - 0.14) / 6
        p0, p1 = c + u * x - v * (Hh - 0.08) + w * 0.05, c + u * x + v * (Hh - 0.08) + w * 0.05
        lot.barre('solaire_ligne', tuple(p0), tuple(p1), 0.018)
    for k in range(1, 4):
        y = -Hh + 0.07 + k * (2 * Hh - 0.14) / 4
        p0, p1 = c - u * (W - 0.08) + v * y + w * 0.05, c + u * (W - 0.08) + v * y + w * 0.05
        lot.barre('solaire_ligne', tuple(p0), tuple(p1), 0.018)
    # Boîtier de raccordement au pied, borne.
    O._rond(lot, 'coffret', (0.0, 0.62, 0.14), (0.0, 0.62, 0.55), 0.22, 0.13, n, k=0.03, r=0.05)
    _borne_douce(coll, lot, (0.08, 0.62, 0.55), 0.3, n)
    lot.finir()
    T.poser_au_sol(coll, 1.5)
    _doux(coll)


def accumulateur_base(coll, leger=True):
    """Accumulateur de base (`accumulator_basic`) : 2 x 2 cases, 1 m (2 unités) de haut.

    Plus simple que l'accumulateur lithium : trois grosses cellules arrondies vert sombre côte à côte sur un châssis,
    sangle claire, jauge à quatre segments en façade (`voyant_*`, vert, pulsent quand il est relié), deux bornes + / -
    sur le dessus et la borne de raccordement (le câble s'y accroche).
    """
    import outils as O
    n = 3 if leger else 5
    lot, vo = T.Lot(coll, 'pieces'), T.Lot(coll, 'voyant_charge')
    O._rond(lot, 'coffret_sombre', (0, 0, 0), (0, 0, 0.18), 0.95, 0.85, n, k=0.04, r=0.1)
    for k, x in enumerate((-0.6, 0, 0.6)):
        O._rond(lot, 'accu', (x, 0.05, 0.18), (x, 0.05, 1.55), 0.27, 0.62, n, k=0.08, r=0.14)
        O._rond(lot, 'accu_sombre', (x, 0.05, 1.5), (x, 0.05, 1.62), 0.22, 0.55, n, k=0.04, r=0.1)
        O._cyl(lot, 'levier_rouge' if k == 2 else 'panneau_noir', (x, 0.35, 1.62), (x, 0.35, 1.74), 0.07, n)
        O._cyl(lot, 'isolateur_cuivre', (x, 0.35, 1.74), (x, 0.35, 1.8), 0.045, n)
    for z in (0.5, 1.25):  # sangles
        O._rond(lot, 'coffret', (-0.9, 0.05, z), (0.9, 0.05, z), 0.66, 0.06, n, k=0.02, r=0.05)
    O._rond(lot, 'panneau_noir', (0, -0.6, 0.62), (0, -0.6, 1.12), 0.12, 0.015, n, k=0.005, r=0.03)
    for k in range(4):
        O._rond(vo, 'voyant_vert', (0, -0.62, 0.68 + k * 0.11), (0, -0.62, 0.76 + k * 0.11), 0.08, 0.012, 2, k=0.004, r=0.01)
    _borne_douce(coll, lot, (-0.3, -0.25, 1.62), 0.35, n)
    for l in (lot, vo):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


MODELES = {
    'transformateur': transformateur,
    'disjoncteur': disjoncteur,
    'panneau_solaire': panneau_solaire,
    'accumulateur_base': accumulateur_base,
    'poteau_electrique': poteau_electrique,
    'poteau_haute_tension': poteau_haute_tension,
    'poteau_tres_haute_tension': poteau_tres_haute_tension,
    'lampadaire': lampadaire,
    'eolienne': eolienne,
    'roue_a_aubes': roue_a_aubes,
    'manivelle_reamorcage': manivelle_reamorcage,
    'chaudiere': chaudiere,
    'turbine_vapeur': turbine_vapeur,
    'generateur_combustible': generateur_combustible,
    'accumulateur_t3': accumulateur_t3,
    'relais_hyperfrequence': relais_hyperfrequence,
    'antenne_quantique': antenne_quantique,
}


def construire(noms=None):
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter(noms=None):
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        if noms and nom not in noms:
            continue
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'energie.blend'))


if __name__ == '__main__':
    main()
