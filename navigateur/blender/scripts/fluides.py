"""Famille « fluides » : pompe à eau électrique, tuyaux (toutes les formes, trois paliers) ; plus tard surpresseur…

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/fluides.py
Produit :  blender/fluides.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def _conduite(lot, pts, mat, r, sg, brides=True):
    """Conduite à coudes : tubes entre les points, boule à chaque coude, brides (anneaux sombres) aux bouts."""
    pts = [Vector(p) for p in pts]
    for a, b in zip(pts, pts[1:]):
        lot.tube(mat, a, b, r, sg)
    for p in pts[1:-1]:
        lot.boule(mat, p, r * 1.08)
    if brides:
        for a, b in zip(pts, pts[1:]):
            d = (b - a).normalized()
            for p in (a + d * 0.03, b - d * 0.03):
                if (p - pts[0]).length > 0.05 and (p - pts[-1]).length > 0.05:
                    continue
                lot.tube('acier_sombre', p - d * 0.025, p + d * 0.025, r * 1.3, sg)


def pompe_eau(coll, leger=True):
    """Pompe à eau électrique (`pump`) : 2 x 2 cases, posée au bord de l'eau (rangée arrière dans l'eau, rangée avant
    à terre). Sortie de l'eau devant (-Y), à la hauteur des tuyaux du jeu.

    Derrière, sur l'eau : plateforme en caillebotis sur pieux, garde-corps, conduite d'aspiration plongée dans l'eau
    avec sa crépine. Devant, sur une dalle : grosse pompe centrifuge (volute bleue) accouplée à un moteur électrique
    (ailettes, capot de ventilateur, boîte à bornes et borne électrique) ; refoulement de gros diamètre qui monte, passe
    par un voyant de débit (manchon de verre), une vanne à volant et un manomètre, puis redescend vers la sortie ;
    réservoir anti-bélier haut et rouge pour bien montrer la pression.
    Pièces mobiles : `arbre_` (accouplement, tourne vite, axe X), `debit_` (bagues d'eau dans le voyant, montent en
    boucle) ; l'aiguille du manomètre est fixe.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, ar, de = T.Lot(coll, 'pieces'), T.Lot(coll, 'arbre'), T.Lot(coll, 'debit')
    za = 0.72  # axe de la pompe et du moteur
    yp = -0.32  # plan de la pompe et du moteur

    # --- Dalle en béton (devant, à terre) et plateforme sur pieux (derrière, sur l'eau).
    lot.cube('beton', (1.96, 1.12, 0.14), (0, -0.42, 0.07), 0.02)
    lot.cube('pierre_sombre', (2.0, 0.06, 0.16), (0, 0.13, 0.08), 0.01)  # rive (bord de la dalle)
    for x in (-0.85, 0.85):
        for y in (0.3, 0.92):
            lot.tube('acier_sombre', (x, y, 0.0), (x, y, 0.36), 0.06, sg)  # pieux
    lot.cube('acier_sombre', (1.96, 0.86, 0.05), (0, 0.6, 0.38))  # cadre
    for k in range(8 if leger else 14):  # caillebotis
        x = -0.88 + k * 1.76 / ((8 if leger else 14) - 1)
        lot.cube('acier', (0.05, 0.82, 0.02), (x, 0.6, 0.415))
    for x in (-0.94, 0.94):  # garde-corps jaune sur les côtés et l'arrière
        for y in (0.22, 0.96):
            lot.tube('jaune', (x, y, 0.42), (x, y, 1.05), 0.025, 6)
        lot.tube('jaune', (x, 0.22, 1.05), (x, 0.96, 1.05), 0.025, 6)
        lot.tube('jaune', (x, 0.22, 0.75), (x, 0.96, 0.75), 0.02, 6)
    lot.tube('jaune', (-0.94, 0.96, 1.05), (0.94, 0.96, 1.05), 0.025, 6)

    # --- Aspiration : crépine dans l'eau sous la plateforme, conduite qui monte puis vient dans l'œil de la pompe.
    xs = -0.55
    T.cylinder(coll, 'crepine', 0.22, 0.3, (xs, 0.62, 0.15), 'acier_sombre', segments=seg)
    for z in (0.05, 0.15, 0.25):
        lot.tube('acier', (xs, 0.62, z - 0.012), (xs, 0.62, z + 0.012), 0.23, seg)
    _conduite(lot, [(xs, 0.62, 0.3), (xs, 0.62, za), (xs, yp, za), (-0.2, yp, za)], 'bleu', 0.13, sg)

    # --- Pompe centrifuge : volute (bleu), pied, bouchons.
    T.cylinder_at(coll, 'volute', 0.42, 0.34, (0, yp, za), 'bleu', segments=seg, y=90)
    T.cylinder_at(coll, 'volute_joue', 0.36, 0.38, (0, yp, za), 'acier_sombre', segments=seg, y=90)
    lot.cube('bleu', (0.34, 0.5, 0.32), (0, yp - 0.14, za + 0.32), 0.02)  # bec de la volute (vers le haut)
    lot.cube('acier_sombre', (0.5, 0.6, 0.14), (0, yp, 0.21), 0.01)  # pied
    nb = 8 if leger else 12
    for k in range(nb):  # boulons du plan de joint
        a = 2 * math.pi * k / nb
        for x in (-0.19, 0.19):
            lot.cube('acier', (0.04, 0.04, 0.04), (x, yp + 0.39 * math.cos(a), za + 0.39 * math.sin(a)))

    # --- Accouplement et arbre (groupe `arbre_`), sous un carter grillagé ouvert sur le dessus.
    ar.tube('acier', (0.17, yp, za), (0.42, yp, za), 0.05, sg)
    for x in (0.25, 0.33):
        ar.tube('acier_sombre', (x - 0.03, yp, za), (x + 0.03, yp, za), 0.13, sg)  # plateaux
        for k in range(6):
            a = 2 * math.pi * k / 6
            ar.cube('jaune', (0.07, 0.035, 0.035), (x, yp + 0.1 * math.cos(a), za + 0.1 * math.sin(a)))
    T.pivot(coll, 'pivot_arbre', (0.29, yp, za), (1, 0, 0))
    for y in (yp - 0.18, yp + 0.18):
        lot.cube('jaune', (0.28, 0.02, 0.3), (0.29, y, za - 0.02))  # flancs du carter
    lot.cube('acier_sombre', (0.6, 0.62, 0.1), (0.38, yp, za - 0.38), 0.01)  # chaise du moteur

    # --- Moteur électrique (ailettes, capot de ventilateur, boîte à bornes, borne électrique).
    xm0, xm1, rm = 0.44, 0.9, 0.3
    T.cylinder_at(coll, 'moteur', rm, xm1 - xm0, ((xm0 + xm1) / 2, yp, za), 'bleu', segments=seg, y=90)
    for k in range(5 if leger else 8):
        x = xm0 + 0.05 + k * (xm1 - xm0 - 0.1) / ((5 if leger else 8) - 1)
        lot.tube('bleu', (x - 0.012, yp, za), (x + 0.012, yp, za), rm + 0.03, seg)
    T.cylinder_at(coll, 'moteur_capot', rm - 0.02, 0.1, (xm1 + 0.05, yp, za), 'acier_sombre', segments=seg, y=90)
    for k in range(3):
        lot.tube('noir', (xm1 + 0.1, yp, za), (xm1 + 0.102, yp, za), 0.08 + k * 0.07, seg)  # grille
    for y in (yp - 0.22, yp + 0.22):
        lot.cube('bleu', (0.36, 0.08, 0.14), ((xm0 + xm1) / 2, y, za - 0.27))  # pattes
    lot.cube('acier', (0.22, 0.2, 0.14), ((xm0 + xm1) / 2, yp, za + rm + 0.05), 0.01)  # boîte à bornes
    lot.cube('cuivre', (0.14, 0.012, 0.08), ((xm0 + xm1) / 2, yp - rm - 0.005, za + 0.05))  # plaque
    T.borne_electrique(coll, lot, ((xm0 + xm1) / 2 + 0.05, yp, za + rm + 0.12), 0.5, sg)

    # --- Refoulement : monte du bec, voyant de débit, vanne, coude, redescend vers la sortie (devant, -Y).
    rr = 0.15  # gros diamètre
    zh = 2.0
    zs = 0.36  # hauteur des tuyaux du jeu (axe)
    ys = -0.78
    # Sortie : raccord commun au bord avant (bride boulonnée, sans face confondue avec le bout du tube).
    sortie = T.raccord_fluide(lot, (0, -1.0), (0, -1, 0), r=rr, longueur=0.12, sg=sg)
    pts = [(0, yp - 0.14, 1.18), (0, yp - 0.14, zh), (0, ys, zh), (0, ys, zs), tuple(sortie)]
    lot.tube('bleu', pts[0], (0, yp - 0.14, 1.25), rr, sg)
    lot.tube('bleu', (0, yp - 0.14, 1.65), pts[1], rr, sg)
    for a, b in zip(pts[1:], pts[2:]):
        lot.tube('bleu', a, b, rr, sg)
    for p in pts[1:4]:
        lot.boule('bleu', p, rr * 1.1)
    # Voyant de débit : manchon de verre entre deux brides, bagues d'eau qui montent (groupe `debit_`).
    yv = yp - 0.14
    for z in (1.25, 1.65):
        lot.tube('acier_sombre', (0, yv, z - 0.03), (0, yv, z + 0.03), rr * 1.35, sg)
    lot.tube('verre', (0, yv, 1.28), (0, yv, 1.62), rr * 1.05, sg)
    for k in range(3):
        z = 1.3 + k * 0.1
        de.tube('eau', (0, yv, z), (0, yv, z + 0.035), rr * 1.07, sg)
        de.tube('blanc', (0, yv, z + 0.035), (0, yv, z + 0.045), rr * 1.075, sg)  # écume
    T.pivot(coll, 'pivot_debit', (0, yv, 1.3), (0, 0, 1), pas=0.1)
    # Vanne à volant sur la descente.
    lot.cube('acier_sombre', (0.36, 0.36, 0.2), (0, ys, 1.2), 0.02)
    lot.tube('acier', (0.18, ys, 1.2), (0.36, ys, 1.2), 0.025, 6)
    lot.tube('rouge', (0.36, ys, 1.2), (0.39, ys, 1.2), 0.17, 12)
    lot.tube('acier_sombre', (0.355, ys, 1.2), (0.395, ys, 1.2), 0.13, 12)
    # Manomètre sur le coude haut.
    lot.tube('acier', (0, yp - 0.14, zh + 0.15), (0, yp - 0.14, zh + 0.22), 0.02, 6)
    T.cylinder_at(coll, 'manometre', 0.11, 0.05, (0, yp - 0.14 - 0.02, zh + 0.32), 'acier_sombre', segments=16, x=90)
    lot.tube('blanc', (0, yp - 0.14 - 0.05, zh + 0.32), (0, yp - 0.14 - 0.046, zh + 0.32), 0.09, 16)
    lot.cube('rouge', (0.012, 0.006, 0.08), (0.02, yp - 0.14 - 0.053, zh + 0.34), 0, Matrix.Rotation(-0.6, 3, 'Y'))

    # --- Réservoir anti-bélier (rouge, haut) branché sur le refoulement.
    xr, yr = -0.66, -0.74
    T.cylinder(coll, 'reservoir', 0.25, 2.5, (xr, yr, 0.14 + 1.25), 'rouge', segments=seg)
    T.cylinder(coll, 'reservoir_dome', 0.25, 0.16, (xr, yr, 2.72), 'rouge', segments=seg, radius_top=0.12)
    for z in (0.5, 1.4, 2.3):
        lot.tube('acier_sombre', (xr, yr, z - 0.02), (xr, yr, z + 0.02), 0.265, seg)  # cerclages
    lot.cube('blanc', (0.2, 0.012, 0.3), (xr, yr - 0.25, 1.45))  # étiquette
    lot.cube('noir', (0.14, 0.014, 0.03), (xr, yr - 0.252, 1.5))
    lot.cube('noir', (0.14, 0.014, 0.03), (xr, yr - 0.252, 1.4))
    lot.tube('acier', (xr, yr, 2.8), (xr, yr, 2.92), 0.025, 6)  # purgeur
    lot.boule('jaune', (xr, yr, 2.95), 0.04)
    _conduite(lot, [(xr + 0.22, yr, 1.8), (-0.12, yp - 0.14, 1.8)], 'bleu', 0.07, sg, brides=False)

    for l in (lot, ar, de):
        l.finir()
    T.poser_au_sol(coll, 1.0)


# ---------------------------------------------------------------------------------------------------------------------
# Tuyaux (`pipe`) : une tuile (2 x 2 cases), axe à Z = 0,36 (hauteur des raccords des machines), bride au ras de chaque
# côté raccordé. Une forme par nombre de raccords, tournée par le jeu : droit (-X, +X), coude (-X, -Y), té (-X, +X, -Y),
# croix, bout (-X, bouchon), seul (aucun raccord) et regard (tuyau enterré : -X puis plonge dans le sol). Pas de vanne
# ni de raccord vertical : sur une ligne de tuyaux, ils faisaient croire qu'il y avait une vanne partout.
# Trois paliers : cuivre (T1), laiton (T2), inox (T3), avec une bague de la couleur du palier (comme les tapis).
# Le laiton (T2) a un dessin plus moderne : manchons sertis lisses au lieu des brides boulonnées, coude cintré, pièces
# de jonction lisses, supports fins à collier (`_tuyau_moderne`).

PALIERS_TUYAU = {1: ('cuivre', 'rive_t1'), 2: ('laiton', 'rive_t2'), 3: ('inox', 'rive_t3')}
DIRS = {'E': (1, 0, 0), 'O': (-1, 0, 0), 'N': (0, 1, 0), 'S': (0, -1, 0)}
FORMES_TUYAU = {'droit': 'OE', 'coude': 'OS', 'te': 'OES', 'croix': 'OENS', 'bout': 'O', 'seul': '', 'regard': 'O'}
Z_TUYAU, R_TUYAU = 0.36, 0.2


def _support(lot, x, y):
    """Plot en béton et selle en acier sous le tuyau."""
    lot.cube('beton', (0.34, 0.4, 0.12), (x, y, 0.06), 0.01)
    lot.cube('acier_sombre', (0.08, 0.46, Z_TUYAU - 0.12), (x, y, 0.12 + (Z_TUYAU - 0.12) / 2 - 0.04))


def _support_fin(lot, x, y, z0, r, sg):
    """Support moderne : platine, pied fin et collier autour du tuyau."""
    lot.cube('acier_sombre', (0.26, 0.26, 0.03), (x, y, 0.015), 0.005)
    lot.tube('gris_clair', (x, y, 0.03), (x, y, z0 - r - 0.02), 0.035, 8)
    lot.cube('gris_clair', (0.06, 0.06, 0.05), (x, y, z0 - r - 0.03))


def _collier(lot, a, d, r, sg):
    """Collier fin (bande gris clair) autour du tuyau, au point `a`, axe `d`."""
    lot.tube('gris_clair', a - d * 0.025, a + d * 0.025, r * 1.12, sg)


def _tuyau_moderne(coll, leger, forme):
    """Tuyau en laiton au dessin moderne (T2) : tube lisse un peu plus fin, manchons sertis au bord de la tuile (pas de
    boulons), joint noir, bague orange du palier ; coude cintré en quart de cercle ; té et croix à manchon de jonction
    lisse ; supports fins à collier ; bouchon bombé."""
    sg = 12 if leger else 20
    T.PALETTE.setdefault('laiton_sombre', '#a8862e')
    lot = T.Lot(coll, 'pieces')
    z0, r = Z_TUYAU, R_TUYAU * 0.85
    c = Vector((0, 0, z0))
    up = Vector((0, 0, 1))

    def manchon(bord, d):
        # Manchon serti au ras du bord (pas au ras exact : pas de face confondue avec la tuile voisine), joint noir.
        lot.tube('laiton_sombre', bord - d * 0.2, bord - d * 0.012, r * 1.22, sg)
        lot.tube('noir', bord - d * 0.215, bord - d * 0.2, r * 1.1, sg)
        lot.tube('rive_t2', bord - d * 0.36, bord - d * 0.32, r * 1.03, sg)  # bague du palier

    if forme == 'coude':
        # Quart de cercle du bord -X au bord -Y, centre au coin (-1, -1), rayon 1.
        cc = Vector((-1, -1, z0))
        n = 8 if leger else 14
        pts = [cc + Vector((math.sin(math.pi / 2 * k / n), math.cos(math.pi / 2 * k / n), 0)) for k in range(n + 1)]
        for a, b in zip(pts, pts[1:]):
            d = (b - a).normalized()
            lot.tube('laiton', a - d * 0.01, b + d * 0.01, r, sg)
        for p in pts[1:-1]:
            lot.boule('laiton', p, r * 1.005)
        manchon(Vector((-1, 0, z0)), Vector((-1, 0, 0)))
        manchon(Vector((0, -1, z0)), Vector((0, -1, 0)))
        m = cc + Vector((math.cos(math.pi / 4), math.cos(math.pi / 4), 0))
        _collier(lot, m, Vector((1, -1, 0)).normalized(), r, sg)
        _support_fin(lot, m.x, m.y, z0, r, sg)
    else:
        for p in FORMES_TUYAU[forme]:
            d = Vector(DIRS[p])
            bord = c + d * 1.0
            lot.tube('laiton', c, bord - d * 0.05, r, sg)
            manchon(bord, d)
        if forme in ('te', 'croix'):
            # Manchon de jonction lisse le long de X, et départs des branches.
            lot.tube('laiton_sombre', c - Vector((0.32, 0, 0)), c + Vector((0.32, 0, 0)), r * 1.3, sg)
            for p in FORMES_TUYAU[forme]:
                d = Vector(DIRS[p])
                if abs(d.y) > 0.5:
                    lot.tube('laiton_sombre', c + d * (r * 1.2), c + d * 0.34, r * 1.18, sg)
            lot.tube('noir', c - Vector((0.335, 0, 0)), c - Vector((0.32, 0, 0)), r * 1.2, sg)
            lot.tube('noir', c + Vector((0.32, 0, 0)), c + Vector((0.335, 0, 0)), r * 1.2, sg)
            _support_fin(lot, 0, 0, z0 - r * 0.3, r, sg)
        elif forme == 'droit':
            for x in (-0.45, 0.45):
                _collier(lot, Vector((x, 0, z0)), Vector((1, 0, 0)), r, sg)
                _support_fin(lot, x, 0, z0, r, sg)
        elif forme == 'bout':
            lot.tube('laiton_sombre', c - Vector((0.18, 0, 0)), c, r * 1.15, sg)  # bouchon bombé
            lot.boule('laiton_sombre', c, r * 1.1)
            _collier(lot, Vector((-0.45, 0, z0)), Vector((1, 0, 0)), r, sg)
            _support_fin(lot, -0.45, 0, z0, r, sg)
        elif forme == 'seul':
            lot.tube('laiton', (-0.5, 0, z0), (0.5, 0, z0), r, sg)
            for sx in (-1, 1):
                lot.tube('laiton_sombre', (sx * 0.5, 0, z0), (sx * 0.62, 0, z0), r * 1.15, sg)
                lot.boule('laiton_sombre', (sx * 0.62, 0, z0), r * 1.1)
            lot.tube('rive_t2', (-0.02, 0, z0), (0.02, 0, z0), r * 1.03, sg)
            for x in (-0.3, 0.3):
                _collier(lot, Vector((x, 0, z0)), Vector((1, 0, 0)), r, sg)
                _support_fin(lot, x, 0, z0, r, sg)
        elif forme == 'regard':
            lot.cube('gris_clair', (0.9, 0.9, 0.12), (0.15, 0, 0.06), 0.03)  # trappe de visite
            lot.cube('acier_sombre', (0.7, 0.7, 0.02), (0.15, 0, 0.125))
            for k in range(4):
                lot.cube('acier', (0.6, 0.04, 0.012), (0.15, -0.21 + k * 0.14, 0.136))
            lot.boule('laiton', c, r * 1.02)
            lot.tube('laiton', c, (0, 0, 0.1), r, sg)  # plonge dans le sol
            lot.tube('laiton_sombre', (0, 0, 0.12), (0, 0, 0.2), r * 1.2, sg)
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def _tuyau(coll, leger, palier, forme):
    if palier == 2:
        _tuyau_moderne(coll, leger, forme)
        return
    sg = 10 if leger else 18
    mat, bague = PALIERS_TUYAU[palier]
    lot = T.Lot(coll, 'pieces')
    z0, r = Z_TUYAU, R_TUYAU
    c = Vector((0, 0, z0))
    for p in FORMES_TUYAU[forme]:
        d = Vector(DIRS[p])
        bord = c + d * 1.0
        lot.tube(mat, c, bord - d * 0.07, r, sg)
        lot.tube('acier_sombre', bord - d * 0.07, bord - d * 0.012, r * 1.38, sg)  # bride (pas au ras exact)
        w = Vector((-d.y, d.x, 0))
        for k in range(6):
            a = 2 * math.pi * k / 6 + 0.5
            lot.cube('acier', (0.035, 0.035, 0.035), tuple(bord - d * 0.04 + (w * math.cos(a) + Vector((0, 0, 1)) * math.sin(a)) * r * 1.2))
        lot.tube(bague, bord - d * 0.32, bord - d * 0.27, r * 1.04, sg)  # bague du palier
    if forme in ('coude', 'te', 'croix'):
        lot.boule(mat, c, r * 1.12)
        _support(lot, 0, 0)
    elif forme == 'droit':
        for x in (-0.5, 0.5):
            lot.tube('acier_sombre', (x - 0.03, 0, z0), (x + 0.03, 0, z0), r * 1.1, sg)  # colliers
            _support(lot, x, 0)
    elif forme == 'bout':
        lot.tube('acier_sombre', c, c + Vector((0.07, 0, 0)), r * 1.35, sg)  # bouchon
        lot.boule('acier_sombre', c + Vector((0.07, 0, 0)), r * 0.9)
        _support(lot, -0.15, 0)
    elif forme == 'seul':
        lot.tube(mat, (-0.55, 0, z0), (0.55, 0, z0), r, sg)
        for x in (-0.55, 0.55):
            lot.tube('acier_sombre', (x - 0.04, 0, z0), (x + 0.04, 0, z0), r * 1.35, sg)
        lot.tube(bague, (-0.02, 0, z0), (0.02, 0, z0), r * 1.04, sg)
        for x in (-0.35, 0.35):
            _support(lot, x, 0)
    elif forme == 'regard':
        lot.cube('beton', (1.0, 1.0, 0.22), (0.15, 0, 0.11), 0.02)  # regard en béton
        lot.cube('acier_sombre', (0.62, 0.62, 0.02), (0.15, 0, 0.225))
        lot.cube('noir', (0.5, 0.5, 0.025), (0.15, 0, 0.228))
        lot.boule(mat, c, r * 1.1)
        lot.tube(mat, c, (0, 0, 0.1), r, sg)  # plonge dans le sol
        for s in (-1, 1):
            lot.cube('jaune', (0.08, 0.9, 0.012), (0.15 + s * 0.46, 0, 0.226))
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def _fabrique_tuyau(palier, forme):
    def f(coll, leger=True):
        _tuyau(coll, leger, palier, forme)
    f.__doc__ = f"Tuyau {forme} T{palier} (`pipe`)."
    return f


def remplisseuse_barils(coll, leger=True):
    """Remplisseuse / videuse de barils (`barreler`) : 2 x 2 cases, 1 m de haut (modèle jusqu'à 2,6 unités). Eau ou
    pétrole par les côtés X ; barils vides derrière (+Y), pleins devant (-Y).

    Dalle, convoyeur commun qui fait avancer les barils (bleus = eau, noirs = pétrole) et ses lames ; portique à deux
    montants avec la tête de remplissage (groupe `buse_`, descend sur le baril puis remonte), flexibles reliés aux deux
    raccords ; borne électrique sur un montant.
    Pièces mobiles : `barils_` (barils et lames, avancent d'un pas en boucle), `buse_` (monte et descend).
    """
    sg = 10 if leger else 16
    lot, bu = T.Lot(coll, 'pieces'), T.Lot(coll, 'buse')
    lot.cube('acier_sombre', (1.9, 1.9, 0.1), (0, 0, 0.05), 0.01)
    for s in (-1, 1):
        lot.cube('jaune', (0.06, 1.8, 0.012), (s * 0.88, 0, 0.105))
    zr, rp = 0.42, 0.07

    def baril(g, k, p, d, w, n, rot):
        mat = 'bleu' if k % 2 == 0 else 'noir'
        q = p + n * 0.02
        g.tube(mat, q, q + n * 0.4, 0.17, sg)
        for z in (0.1, 0.3):
            g.tube('acier', q + n * (z - 0.015), q + n * (z + 0.015), 0.178, sg)  # cerclages
        g.tube('acier_sombre', q + n * 0.4, q + n * 0.42, 0.05, 8)  # bonde
    ba, _, _ = T.convoyeur_charge(coll, 'barils', lot, (0, 0.98, zr - rp), (0, -0.98, zr - rp), 0.5, rp, 0.5, baril,
                       debut=0.24, fin=-0.2, rouleaux=2, sg=sg)
    for sx in (-1, 1):
        for y in (0.85, -0.85):
            lot.cube('acier', (0.05, 0.05, zr - rp - 0.12), (sx * 0.3, y, 0.1 + (zr - rp - 0.12) / 2))
    # Portique et tête de remplissage (au-dessus du milieu du convoyeur).
    zb = 1.75
    for sx in (-1, 1):
        lot.cube('acier_sombre', (0.12, 0.16, zb), (sx * 0.62, 0, zb / 2 + 0.05), 0.01)
    lot.cube('jaune', (1.4, 0.2, 0.16), (0, 0, zb + 0.05), 0.01)
    lot.cube('acier', (0.3, 0.26, 0.24), (0, 0, zb - 0.12), 0.015)  # vérin
    bu.tube('acier', (0, 0, zb - 0.24), (0, 0, 1.05), 0.04, 8)  # tige
    bu.cube('acier_sombre', (0.2, 0.2, 0.12), (0, 0, 1.05), 0.01)  # tête
    bu.tube('rouge', (0, 0, 0.99), (0, 0, 0.93), 0.05, 8)  # buse
    T.pivot(coll, 'pivot_buse', (0, 0, 0.93), (0, 0, 1))
    # Raccords des deux côtés, conduites qui montent vers le portique.
    for sx in (-1, 1):
        a = T.raccord_fluide(lot, (sx * 1.0, 0.45), (sx, 0, 0), r=0.1, longueur=0.15, sg=sg)
        _conduite(lot, [tuple(a), (sx * 0.75, 0.45, 0.36), (sx * 0.75, 0.45, 1.6), (sx * 0.62, 0.2, 1.6)], 'bleu' if sx > 0 else 'noir', 0.07, sg, brides=False)
        lot.tube('acier_sombre', (sx * 0.75, 0.45, 1.0), (sx * 0.75, 0.45, 1.06), 0.1, sg)  # vanne
        lot.tube('rouge', (sx * 0.75, 0.45 - 0.12, 1.03), (sx * 0.75, 0.45 - 0.15, 1.03), 0.08, 10)
    T.borne_electrique(coll, lot, (-0.62, -0.3, 0.05), 1.0, sg)
    for l in (lot, bu, ba):
        l.finir()
    T.poser_au_sol(coll, 1.0)


def surpresseur_t2(coll, leger=True):
    """Surpresseur T2 (`booster`) : 2 x 2 cases, 1 m de haut (modèle jusqu'à 2,6 unités). Le fluide entre derrière
    (+Y) et ressort devant (-Y) avec plus de pression.

    Châssis ; conduite en ligne avec deux manomètres (avant / après) et un clapet ; pompe verticale au milieu (corps vert,
    bandes orange du palier T2), gros moteur au-dessus avec le capot de ventilateur (groupe `ventilateur_`, tourne),
    boîte à bornes et borne électrique.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, ve = T.Lot(coll, 'pieces'), T.Lot(coll, 'ventilateur')
    lot.cube('acier_sombre', (1.6, 1.9, 0.12), (0, 0, 0.06), 0.01)
    for s in (-1, 1):
        lot.cube('rive_t2', (0.05, 1.9, 0.02), (s * 0.78, 0, 0.13))
    a = T.raccord_fluide(lot, (0, 1.0), (0, 1, 0), r=0.13, longueur=0.2, sg=sg)
    b = T.raccord_fluide(lot, (0, -1.0), (0, -1, 0), r=0.13, longueur=0.2, sg=sg)
    lot.tube('vert_fonce', a, (0, 0.3, 0.36), 0.13, sg)
    lot.tube('vert_fonce', (0, -0.3, 0.36), b, 0.13, sg)
    # Corps de pompe (vertical) et moteur.
    T.cylinder(coll, 'pompe_corps', 0.36, 0.5, (0, 0, 0.12 + 0.25), 'vert_fonce', segments=seg)
    for z in (0.2, 0.55):
        lot.tube('rive_t2', (0, 0, z - 0.02), (0, 0, z + 0.02), 0.37, seg)
    lot.tube('acier_sombre', (0, 0, 0.62), (0, 0, 0.7), 0.32, seg)  # lanterne
    T.cylinder(coll, 'moteur', 0.3, 0.75, (0, 0, 0.7 + 0.375), 'vert_fonce', segments=seg)
    for k in range(5 if leger else 8):
        z = 0.78 + k * 0.6 / ((5 if leger else 8) - 1)
        lot.tube('vert_fonce', (0, 0, z - 0.012), (0, 0, z + 0.012), 0.33, seg)
    lot.tube('acier_sombre', (0, 0, 1.45), (0, 0, 1.6), 0.31, seg)  # capot
    for k in range(3):
        lot.tube('noir', (0, 0, 1.6), (0, 0, 1.605), 0.08 + k * 0.08, seg)
    ve.tube('acier', (0, 0, 1.47), (0, 0, 1.52), 0.05, 8)
    for k in range(5):
        ang = 2 * math.pi * k / 5
        ve.cube('acier', (0.22, 0.06, 0.015), (0.12 * math.cos(ang), 0.12 * math.sin(ang), 1.5), 0, Matrix.Rotation(ang, 3, 'Z'))
    T.pivot(coll, 'pivot_ventilateur', (0, 0, 1.5), (0, 0, 1))
    lot.cube('acier', (0.22, 0.2, 0.18), (0.35, 0, 1.2), 0.01)  # boîte à bornes
    T.borne_electrique(coll, lot, (0.55, 0.55, 0.12), 1.2, sg)
    lot.barre('noir', (0.55, 0.5, 0.5), (0.4, 0.05, 1.12), 0.025)
    # Manomètres avant / après, clapet.
    for y, z in ((0.6, 0.36), (-0.6, 0.36)):
        lot.tube('acier', (0, y, z + 0.13), (0, y, z + 0.3), 0.02, 6)
        T.cylinder_at(coll, f'manometre_{"amont" if y > 0 else "aval"}', 0.09, 0.04, (0, y - 0.0, z + 0.38), 'acier_sombre', segments=12, x=90)
        lot.tube('blanc', (0, y - 0.02, z + 0.38), (0, y - 0.024, z + 0.38), 0.075, 12)
    lot.cube('acier_sombre', (0.3, 0.2, 0.3), (0, -0.45, 0.36), 0.02)  # clapet
    lot.tube('rouge', (0.15, -0.45, 0.36), (0.22, -0.45, 0.36), 0.05, 8)
    for l in (lot, ve):
        l.finir()
    T.poser_au_sol(coll, 1.0)


def tour_refroidissement_t2(coll, leger=True):
    """Tour de refroidissement T2 (`cooling_tower`) : 3 x 3 cases, 1,5 m de haut (modèle jusqu'à 3,9 unités). Eau chaude
    par derrière (+Y), eau refroidie devant (-Y).

    Coque en béton hyperbolique ouverte en haut (paroi intérieure sombre), sur des pieds en V, bassin d'eau au pied,
    échelle, conduite d'eau chaude qui monte le long de la coque, sortie d'eau froide depuis le bassin ; ventilateur dans
    le col (groupe `ventilateur_`, tourne) ; panache de vapeur (`jet_vapeur_*`, vacille en marche).
    """
    sg = 10 if leger else 16
    seg = 20 if leger else 32
    lot, ve = T.Lot(coll, 'pieces'), T.Lot(coll, 'ventilateur')
    # Bassin.
    T.cylinder(coll, 'bassin', 1.45, 0.25, (0, 0, 0.125), 'beton', segments=seg)
    T.cylinder(coll, 'bassin_eau', 1.3, 0.02, (0, 0, 0.255), 'eau', segments=seg)
    # Pieds en V et coque.
    z0 = 0.55
    n = 10 if leger else 16
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = 2 * math.pi * (k + 0.5) / n
        lot.barre('beton', (1.25 * math.cos(a0), 1.25 * math.sin(a0), 0.25), (1.28 * math.cos(a1), 1.28 * math.sin(a1), z0 + 0.02), 0.08)
        lot.barre('beton', (1.25 * math.cos(a0 + 2 * math.pi / n), 1.25 * math.sin(a0 + 2 * math.pi / n), 0.25),
                  (1.28 * math.cos(a1), 1.28 * math.sin(a1), z0 + 0.02), 0.08)
    profil = [(1.3, z0), (1.12, 1.25), (0.95, 2.0), (0.92, 2.45), (0.98, 2.95), (1.08, 3.3)]
    T.tour(coll, 'coque', profil, 'beton', segments=seg, fond=False, dessus=False)
    # Paroi intérieure sombre (la tour est ouverte en haut : on voit dedans), lèvre au sommet.
    dedans = T.tour(coll, 'coque_dedans', [(r - 0.07, z) for r, z in profil[2:]], 'pierre_sombre', segments=seg,
                    fond=False, dessus=False)
    # Faces tournées vers l'axe : vue d'en haut, on voit la paroi intérieure (sinon le jeu, qui ne dessine qu'un côté
    # des faces, la cache, et on voit à travers la tour quand la caméra passe à côté).
    for poly in dedans.data.polygons:
        c = poly.center
        if poly.normal.x * c.x + poly.normal.y * c.y > 0:
            poly.flip()
    dedans.data.update()
    T.tour(coll, 'coque_levre', [(1.01, 3.3), (1.08, 3.3), (1.08, 3.36), (1.01, 3.36)], 'pierre_claire', segments=seg,
           fond=False, dessus=False)
    T.cylinder(coll, 'coque_fond', 0.88, 0.03, (0, 0, 2.0), 'noir', segments=seg)  # pénombre sous le ventilateur
    for k, (z, r) in enumerate(((z0 + 0.03, 1.3), (1.6, 1.03), (2.6, 0.94))):  # cerclages (anneaux, pas des disques)
        T.tour(coll, f'cerclage_{k}', [(r, z - 0.035), (r + 0.04, z - 0.035), (r + 0.04, z + 0.035), (r, z + 0.035)],
               'pierre_claire', segments=seg, fond=False, dessus=False)
    # Ventilateur dans le col : poutre en travers, moyeu, pales (tournent).
    lot.cube('acier_sombre', (0.16, 2.14, 0.08), (0, 0, 3.2))  # poutre
    lot.tube('acier_sombre', (0, 0, 3.0), (0, 0, 3.17), 0.13, sg)  # moteur sous la poutre
    ve.tube('acier', (0, 0, 2.94), (0, 0, 3.0), 0.1, 8)
    for k in range(6):
        ang = 2 * math.pi * k / 6
        ve.cube('gris_clair', (0.72, 0.16, 0.02), (0.42 * math.cos(ang), 0.42 * math.sin(ang), 2.97), 0,
                Matrix.Rotation(ang, 3, 'Z') @ Matrix.Rotation(0.3, 3, 'X'))
    T.pivot(coll, 'pivot_ventilateur', (0, 0, 2.97), (0, 0, 1))
    # Échelle extérieure (côté +X) jusqu'à la lèvre.
    for dy in (-0.12, 0.12):
        lot.barre('acier', (1.31, dy, 0.6), (1.1, dy, 3.32), 0.035)
    for k in range(12):
        t = k / 11
        lot.barre('acier', (1.31 - 0.21 * t, -0.12, 0.6 + 2.72 * t), (1.31 - 0.21 * t, 0.12, 0.6 + 2.72 * t), 0.02)
    # Panache de vapeur.
    # Panache : bouffées de vapeur (boules facettées, vacillent en marche) ; reste sous 3,9 unités.
    for k, (x, y, z, r) in enumerate(((0, 0, 3.62, 0.27), (0.32, 0.16, 3.58, 0.19), (-0.3, -0.18, 3.6, 0.2), (0.06, -0.3, 3.72, 0.16))):
        jet = T.Lot(coll, f'jet_vapeur_{k}')
        jet.boule('blanc', (x, y, z), r)
        jet.finir()
    # Eau chaude : raccord derrière, conduite qui monte le long de la coque et entre en haut.
    a = T.raccord_fluide(lot, (0, 1.5), (0, 1, 0), r=0.12, longueur=0.2, sg=sg)
    _conduite(lot, [tuple(a), (0, 1.28, 0.36), (0, 1.28, 2.4), (0, 0.9, 2.4)], 'rouge', 0.1, sg, brides=False)
    for z in (1.0, 1.8):
        lot.cube('acier_sombre', (0.1, 0.25, 0.06), (0, 1.15, z))  # colliers
    # Eau froide : du bassin vers le raccord devant.
    b = T.raccord_fluide(lot, (0, -1.5), (0, -1, 0), r=0.12, longueur=0.2, sg=sg)
    _conduite(lot, [(0, -1.2, 0.18), (0, -1.3, 0.36), tuple(b)], 'bleu', 0.1, sg, brides=False)
    lot.cube('acier_sombre', (0.36, 0.3, 0.36), (0, -1.25, 0.3), 0.02)  # pompe de reprise
    for l in (lot, ve):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {
    'pompe_eau': pompe_eau,
    'remplisseuse_barils': remplisseuse_barils,
    'surpresseur_t2': surpresseur_t2,
    'tour_refroidissement_t2': tour_refroidissement_t2,
}
for _p in (1, 2, 3):
    for _f in FORMES_TUYAU:
        MODELES[f'tuyau_{_f}_t{_p}'] = _fabrique_tuyau(_p, _f)


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
    T.save(os.path.join(ROOT, 'blender', 'fluides.blend'))


if __name__ == '__main__':
    main()
