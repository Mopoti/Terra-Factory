"""Famille « transformation » : machines qui transforment les lingots et le minerai (estampeuse, assembleur, concasseur,
bétonnière, station de lavage, constructeur, presse lourde, et plus tard centrifugeuse…).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/transformation.py
Produit :  blender/transformation.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


def estampeuse_t1(coll, leger=True):
    """Estampeuse à combustible (marteau-pilon à vapeur) : 3 x 3 cases, 2,6 unités max (1,3 m) ; le corps occupe le plus possible de l'emprise. Sortie devant (-Y).

    Massif de pierre ; bâti en fonte peinte en vert foncé à deux jambes inclinées, glissières et traverse ; cylindre à
    vapeur sur la traverse ; marteau (masse, matrice haute, tige du piston) au-dessus de la chabotte, de l'enclume et de
    la matrice basse ; convoyeurs avec lingots sur les deux côtés X (entrées) ; goulotte et plaques estampées
    devant (sortie) ; chaudière verticale derrière à droite (foyer rougeoyant côté +Y, cheminée, manomètre, conduite de
    vapeur en cuivre vers le cylindre), charbon ; râtelier à moules (plaque, engrenage) derrière à gauche ; levier.
    Massive : elle occupe presque toute l'emprise et monte jusqu'à la limite de hauteur.
    Pièce mobile : groupe `marteau_` (monte et descend), pivot `pivot_marteau`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(41)
    bv = 0.0 if leger else 1.0
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    mar = T.Lot(coll, 'marteau')  # pièces du marteau (bougent avec lui)
    y0 = -0.1  # plan du bâti et de l'enclume

    # --- Massif de pierre (z 0 -> 0,34 ; x ±1,35 ; y -0,85 -> 0,65) : pierres en relief sur les faces.
    T.box(coll, 'massif', (2.7, 1.5, 0.34), (0, y0, 0.17), 'pierre_sombre', bevel=0.03)
    T.parement(lot, [('y', y0 - 0.75, -1.3, 1.3, -1), ('y', y0 + 0.75, -1.3, 1.3, 1),
                     ('x', -1.35, y0 - 0.7, y0 + 0.7, -1), ('x', 1.35, y0 - 0.7, y0 + 0.7, 1)],
               (0.09, 0.25), seed=5, densite=0.5 if leger else 0.75, teintes=T.PIERRES, haut=(0.12, 0.14),
               bevel=0.012 * bv)

    # --- Chabotte, enclume, matrice basse et lopin en cours d'estampage (dessus de la matrice : z 0,87).
    T.box(coll, 'chabotte', (1.2, 1.0, 0.36), (0, y0, 0.52), 'fonte', bevel=0.035)
    T.box(coll, 'enclume', (0.84, 0.68, 0.12), (0, y0, 0.76), 'acier', bevel=0.018)
    T.box(coll, 'matrice_basse', (0.5, 0.44, 0.05), (0, y0, 0.845), 'acier_sombre', bevel=0.01)
    lot.cube('braise', (0.24, 0.24, 0.025), (0, y0, 0.882), 0)  # lopin chauffé au rouge
    for sx in (-1, 1):  # clavettes qui serrent l'enclume
        lot.cube('acier_sombre', (0.07, 0.72, 0.07), (sx * 0.45, y0, 0.75), 0.008 * bv)

    # --- Bâti en fonte peinte : deux jambes inclinées (semelles boulonnées), nervures, glissières, consoles, traverse.
    zb0, zb1, xb0, xb1 = 0.34, 1.95, 1.15, 0.6
    for s in (-1, 1):
        a, b = Vector((s * xb0, y0, zb0)), Vector((s * xb1, y0, zb1))
        d = b - a
        rot = Matrix.Rotation(math.atan2(d.x, d.z), 3, 'Y')
        T.box(coll, f'jambe_{s}', (0.32, 0.56, d.length), (0, 0, 0), 'vert_fonce', bevel=0.035).matrix_basis = \
            Matrix.Translation((a + b) / 2) @ rot.to_4x4()
        lot.cube('acier_sombre', (0.07, 0.14, d.length - 0.24), tuple((a + b) / 2 + rot @ Vector((s * 0.18, 0, 0))),
                 0.01 * bv, rot)  # nervure extérieure
        lot.cube('fonte', (0.6, 0.74, 0.1), (s * xb0, y0, zb0 + 0.05), 0.015)  # semelle
        for dx in (-0.22, 0.22):
            for dy in (-0.28, 0.28):
                lot.cube('acier', (0.06, 0.06, 0.05), (s * xb0 + dx, y0 + dy, zb0 + 0.12), 0)  # boulons
        # Glissière du marteau et consoles qui la tiennent à la jambe.
        lot.cube('acier', (0.07, 0.18, 1.1), (s * 0.37, y0, 1.45), 0.01 * bv)
        for z in (1.2, 1.75):
            xj = xb0 + (xb1 - xb0) * (z - zb0) / (zb1 - zb0) - 0.16
            lot.cube('fonte', (xj - 0.405, 0.16, 0.12), (s * (0.405 + xj) / 2, y0, z), 0.01 * bv)
    T.box(coll, 'traverse', (1.85, 0.64, 0.24), (0, y0, 2.06), 'vert_fonce', bevel=0.035)
    T.box(coll, 'traverse_chapeau', (1.6, 0.54, 0.04), (0, y0, 2.2), 'acier_sombre', bevel=0.01)
    for x in (-0.78, -0.55, 0.55, 0.78):
        for z in (1.99, 2.13):
            lot.cube('acier', (0.045, 0.03, 0.045), (x, y0 - 0.33, z), 0)  # rivets
    T.cylinder(coll, 'presse_etoupe', 0.12, 0.08, (0, y0, 1.9), 'acier_sombre', segments=sg)

    # --- Cylindre à vapeur sur la traverse : cerclages, couvercle boulonné, boîte à tiroir.
    zc0, zc1 = 2.22, 2.52
    T.cylinder(coll, 'cylindre', 0.31, zc1 - zc0, (0, y0, (zc0 + zc1) / 2), 'fonte', segments=seg)
    for z in (zc0 + 0.04, zc1 - 0.04):
        T.cylinder(coll, f'cylindre_cercle_{z}', 0.335, 0.045, (0, y0, z), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'cylindre_couvercle', 0.28, 0.04, (0, y0, zc1 + 0.02), 'acier', segments=seg)
    for k in range(8):
        t = 2 * math.pi * k / 8
        lot.cube('acier_sombre', (0.04, 0.04, 0.03), (0.23 * math.cos(t), y0 + 0.23 * math.sin(t), zc1 + 0.05), 0)
    T.box(coll, 'boite_tiroir', (0.24, 0.3, 0.28), (0.4, y0, (zc0 + zc1) / 2), 'acier_sombre', bevel=0.02)

    # --- Marteau (groupe `marteau_`) : masse, plaque avant rivetée, matrice haute, crosse, tige du piston.
    zm0 = 1.07  # bas de la matrice haute (course de 0,2 jusqu'à la matrice basse)
    T.box(coll, 'marteau_masse', (0.62, 0.52, 0.5), (0, y0, zm0 + 0.34), 'acier_sombre', bevel=0.035)
    T.box(coll, 'marteau_matrice', (0.48, 0.42, 0.09), (0, y0, zm0 + 0.045), 'acier', bevel=0.012)
    mar.cube('fonte', (0.44, 0.03, 0.34), (0, y0 - 0.275, zm0 + 0.34), 0.008 * bv)
    for dx in (-0.16, 0.16):
        for dz in (-0.12, 0.12):
            mar.cube('acier', (0.04, 0.03, 0.04), (dx, y0 - 0.295, zm0 + 0.34 + dz), 0)
    mar.cube('fonte', (0.3, 0.24, 0.1), (0, y0, zm0 + 0.64), 0.01 * bv)  # crosse
    mar.tube('acier', (0, y0, zm0 + 0.68), (0, y0, 2.4), 0.06, sg)  # tige du piston (entre dans le cylindre)
    T.pivot(coll, 'pivot_marteau', (0, y0, zm0))

    # --- Convoyeurs (convoyeur commun) sur les deux côtés X (entrées des lingots) : fer à gauche, cuivre à droite.
    yt, zt = y0 - 0.56, 0.72
    for s, mat in ((-1, 'acier'), (1, 'cuivre')):
        a, b = Vector((s * 1.42, yt, zt - 0.04)), Vector((s * 0.55, yt, zt - 0.04))
        T.convoyeur(lot, a, b, 0.3, 0.08, rouleaux=2, sg=sg)
        for x in (s * 0.75, s * 1.38):
            for dy in (-0.2, 0.2):
                lot.cube('acier_sombre', (0.05, 0.05, zt - 0.14), (x, yt + dy, (zt - 0.14) / 2), 0)  # pieds
        for x in (s * 0.85, s * 1.2):
            lot.cube(mat, (0.3, 0.14, 0.08), (x, yt + rnd.uniform(-0.03, 0.03), zt + 0.09), 0.01 * bv,
                     Matrix.Rotation(rnd.uniform(-0.1, 0.1), 3, 'Z'))  # lingots

    # --- Sortie devant : goulotte inclinée et plaques estampées.
    yg0, yg1, zg0, zg1 = y0 - 0.5, -1.45, 0.7, 0.22
    d = Vector((0, yg1 - yg0, zg1 - zg0))
    pente = Matrix.Rotation(math.atan2(d.z, d.y), 3, 'X')
    c = Vector((0, (yg0 + yg1) / 2, (zg0 + zg1) / 2))
    lot.cube('fonte', (0.6, d.length, 0.045), tuple(c), 0.01 * bv, pente)
    for x in (-0.32, 0.32):
        lot.cube('acier_sombre', (0.045, d.length, 0.11), tuple(c + Vector((x, 0, 0.03))), 0, pente)
    lot.cube('acier_sombre', (0.6, 0.06, zg1), (0, yg1 + 0.06, zg1 / 2), 0)  # pied de la goulotte
    for k in range(3):
        lot.cube('acier', (0.26, 0.26, 0.02), (rnd.uniform(-0.05, 0.05), -1.3 + rnd.uniform(-0.03, 0.03), 0.33 + k * 0.025),
                 0, pente @ Matrix.Rotation(rnd.uniform(-0.2, 0.2), 3, 'Z'))

    # --- Chaudière verticale derrière à droite : foyer côté +Y, cerclages, dôme, cheminée, manomètre.
    xc, yc, rc = 0.9, 1.05, 0.38
    T.cylinder(coll, 'chaudiere_socle', rc + 0.05, 0.14, (xc, yc, 0.07), 'pierre_sombre', segments=seg)
    T.cylinder(coll, 'chaudiere', rc, 1.46, (xc, yc, 0.14 + 0.73), 'fonte', segments=seg)
    for z in (0.45, 1.0, 1.5):
        T.cylinder(coll, f'chaudiere_cercle_{z}', rc + 0.02, 0.05, (xc, yc, z), 'cuivre', segments=seg)
    T.cylinder(coll, 'chaudiere_dome', rc, 0.2, (xc, yc, 1.7), 'fonte', segments=seg, radius_top=0.14)
    T.box(coll, 'foyer', (0.34, 0.06, 0.26), (xc, yc + rc - 0.01, 0.45), 'noir')
    T.box(coll, 'foyer_lueur', (0.26, 0.04, 0.16), (xc, yc + rc + 0.01, 0.43), 'braise')
    lot.cube('acier_sombre', (0.4, 0.04, 0.04), (xc, yc + rc + 0.02, 0.6), 0)
    lot.tube('fonte', (xc, yc, 1.78), (xc, yc, 2.45), 0.1, sg)  # cheminée
    T.cylinder(coll, 'cheminee_chapeau', 0.11, 0.1, (xc, yc, 2.5), 'fonte', segments=sg, radius_top=0.17)
    T.cylinder_at(coll, 'manometre', 0.08, 0.03, (xc - rc - 0.02, yc, 1.2), 'acier_sombre', segments=sg, y=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.065, 0.01, (xc - rc - 0.04, yc, 1.2), 'blanc', segments=sg, y=90)
    lot.cube('rouge', (0.008, 0.012, 0.06), (xc - rc - 0.046, yc, 1.22), 0)  # aiguille
    # Conduite de vapeur en cuivre : du dôme (à côté de la cheminée) jusqu'à la boîte à tiroir du cylindre.
    xv = xc - 0.2
    pts = [Vector((xv, yc, 1.72)), Vector((xv, yc, 2.42)), Vector((xv, y0, 2.42)), Vector((0.52, y0, 2.42))]
    for p, q in zip(pts, pts[1:]):
        lot.tube('cuivre', p, q, 0.05, sg)
    for p in pts[1:3]:
        lot.boule('cuivre', p, 0.06)
    T.cylinder(coll, 'vanne_vapeur', 0.08, 0.04, (xv, yc, 2.1), 'rouge', segments=sg)
    # Charbon à côté de la chaudière.
    for _ in range(4 if leger else 9):
        s = rnd.uniform(0.08, 0.12)
        lot.cube('noir', (s, s, s * 0.8), (xc - 0.6 + rnd.uniform(-0.15, 0.15), 1.3 + rnd.uniform(-0.08, 0.08), s * 0.4),
                 0.02 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Râtelier à moules derrière à gauche : moule à plaque et moule à engrenage.
    xr, yr = -0.9, 1.05
    for dx in (-0.4, 0.4):
        lot.cube('bois_sombre', (0.09, 0.09, 1.3), (xr + dx, yr, 0.65), 0.01 * bv)
    lot.cube('bois', (0.92, 0.08, 0.08), (xr, yr, 1.25), 0.01 * bv)
    lot.cube('bois', (0.92, 0.08, 0.08), (xr, yr, 0.25), 0.01 * bv)
    lot.cube('acier_sombre', (0.32, 0.06, 0.32), (xr - 0.19, yr - 0.07, 0.97), 0.01 * bv)  # moule à plaque
    lot.cube('noir', (0.2, 0.01, 0.2), (xr - 0.19, yr - 0.105, 0.97), 0)
    T.cylinder_at(coll, 'moule_engrenage', 0.15, 0.06, (xr + 0.19, yr - 0.07, 0.97), 'fonte', segments=sg, x=90)
    for k in range(8):
        t = 2 * math.pi * k / 8
        lot.cube('fonte', (0.055, 0.06, 0.055), (xr + 0.19 + 0.17 * math.cos(t), yr - 0.07, 0.97 + 0.17 * math.sin(t)), 0,
                 Matrix.Rotation(-t, 3, 'Y'))
    for x in (xr - 0.19, xr + 0.19):
        lot.cube('acier', (0.03, 0.03, 0.1), (x, yr - 0.045, 1.17), 0)  # crochets

    # --- Levier de commande (derrière le bâti, à gauche).
    lot.cube('fonte', (0.16, 0.16, 0.12), (-0.6, y0 + 0.6, 0.4), 0.01 * bv)
    lot.barre('acier', (-0.6, y0 + 0.6, 0.44), (-0.6, y0 + 0.45, 1.05), 0.045, 0)
    lot.boule('rouge', (-0.6, y0 + 0.45, 1.08), 0.055)

    for l in (lot, mar):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def _bras_robot(lot, base, cible, ze, sg, seg, bv):
    """Bras robot jaune articulé posé sur l'établi en `base` (x, y), pince au-dessus de `cible` (x, y, z) : embase,
    tourelle, épaule, bras, coude, avant-bras, poignet, pince à deux doigts, câble. Tout va dans `lot` sauf l'embase
    (renvoyée à part : elle reste fixe)."""
    b = Vector((base[0], base[1], ze + 0.06))
    c = Vector(cible)
    d = Vector((c.x - b.x, c.y - b.y, 0)).normalized()  # direction de travail
    n = Vector((-d.y, d.x, 0))  # axe des articulations
    epaule = b + Vector((0, 0, 0.3))
    coude = b + d * 0.1 + Vector((0, 0, 0.58))
    poignet = Vector((c.x, c.y, c.z + 0.3)) - d * 0.03
    lot.tube('acier_sombre', b, b + Vector((0, 0, 0.1)), 0.15, seg)  # tourelle
    lot.tube('jaune', b + Vector((0, 0, 0.1)), epaule, 0.1, sg)
    for p, r in ((epaule, 0.085), (coude, 0.07)):
        lot.tube('acier_sombre', p - n * 0.1, p + n * 0.1, r, sg)  # articulations
        lot.tube('acier', p - n * 0.115, p + n * 0.115, r * 0.5, sg)  # axes
    lot.barre('jaune', epaule, coude, 0.12, 0.02 * bv)
    lot.barre('jaune', coude, poignet, 0.09, 0.02 * bv)
    lot.cube('acier_sombre', (0.05, 0.05, 0.1), tuple(epaule + (coude - epaule) * 0.5 + n * 0.065), 0)  # vérin
    lot.boule('acier_sombre', poignet, 0.065)
    lot.tube('acier', poignet, poignet + Vector((0, 0, -0.11)), 0.035, sg)
    pince = poignet + Vector((0, 0, -0.13))
    lot.cube('acier_sombre', (0.15, 0.06, 0.04), tuple(pince), 0, Matrix.Rotation(math.atan2(d.y, d.x), 3, 'Z'))
    for s in (-1, 1):
        lot.cube('acier', (0.025, 0.04, 0.11), tuple(pince + d * (s * 0.05) + Vector((0, 0, -0.07))), 0,
                 Matrix.Rotation(math.atan2(d.y, d.x), 3, 'Z'))  # doigts
    lot.tube('noir', epaule - n * 0.07 + Vector((0, 0, -0.12)), coude - n * 0.07, 0.018, 6)  # câble du bras
    lot.tube('noir', coude - n * 0.06, poignet - n * 0.05, 0.015, 6)
    return b


def assembleur_t2(coll, leger=True):
    """Assembleur électrique (T2) : 3 x 3 cases, 2,6 unités max (1,3 m) ; le corps occupe le plus possible de l'emprise. Sortie devant (-Y).

    Même famille que la foreuse électrique T2 (acier, moteur bleu, antenne à isolateurs). Socle aux angles arrondis
    bordé de bandes de sécurité. Caisson de la machine à l'arrière, structuré : montants d'angle et lisses, panneaux en
    relief boulonnés, grilles d'aération, armoire électrique à l'arrière (porte, poignée, triangle d'avertissement),
    hublot et pupitre (écran, boutons) en façade.
    Cellule de travail devant : établi à tiroirs, plateau tournant au centre avec la pièce en cours de montage (engrenage
    sur une plaque), deux bras robots jaunes qui travaillent dessus, bacs de pièces, portique avec rampe d'éclairage et
    gyrophare. Sortie : bouche dans l'établi et goulotte avec un engrenage fini. Toit : bloc transformateur à ailettes
    de refroidissement, ventilateur sous grille, deux évents, moteur électrique bleu, chemin de câbles et antenne à
    isolateurs.
    Pièces mobiles : `bras1_` (bras gauche) et `bras2_` (bras droit) pivotent sur leur tourelle, `plateau_` tourne,
    `ventilateur_` tourne ; pivots `pivot_bras1`, `pivot_bras2`, `pivot_plateau`, `pivot_ventilateur`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(52)
    bv = 0.0 if leger else 1.0
    nc = 3 if leger else 6
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    bras1 = T.Lot(coll, 'bras1')
    bras2 = T.Lot(coll, 'bras2')
    plateau = T.Lot(coll, 'plateau')
    vent = T.Lot(coll, 'ventilateur')

    # --- Socle aux angles arrondis (z 0 -> 0,3) et bandes de sécurité sur sa face avant.
    T.lissage(coll, 'socle_plinthe', [(1.42, 0.3, 0.0), (1.42, 0.3, 0.08)], 'fonte', fond=True, n_coin=nc)
    T.lissage(coll, 'socle', [(1.38, 0.28, 0.08), (1.36, 0.27, 0.3)], 'acier_sombre', fond=True, n_coin=nc)
    for k in range(10):
        x = -1.0 + 2.0 * (k + 0.5) / 10
        if abs(x) > 0.35:
            lot.cube('jaune' if k % 2 == 0 else 'noir', (0.2, 0.02, 0.08), (x, -1.37, 0.19), 0)

    # --- Caisson de la machine (y -0,25 -> 1,25 ; x ±1,2 ; z 0,3 -> 1,74).
    yf, yb, xc, z0, z1 = -0.25, 1.25, 1.2, 0.3, 1.74
    ym = (yf + yb) / 2
    T.box(coll, 'caisson', (2 * xc - 0.08, yb - yf - 0.08, z1 - z0), (0, ym, (z0 + z1) / 2), 'acier', bevel=0.02)
    for sx in (-1, 1):  # montants d'angle
        for y in (yf, yb):
            lot.cube('acier_sombre', (0.14, 0.14, z1 - z0 + 0.06), (sx * (xc - 0.05), y + (0.05 if y == yf else -0.05),
                                                                    (z0 + z1) / 2), 0.015)
    for z in (z0 + 0.08, z1 - 0.04):  # lisses haute et basse
        lot.cube('acier_sombre', (2 * xc, 0.1, 0.08), (0, yf + 0.02, z), 0.01)
        lot.cube('acier_sombre', (2 * xc, 0.1, 0.08), (0, yb - 0.02, z), 0.01)
        for sx in (-1, 1):
            lot.cube('acier_sombre', (0.1, yb - yf, 0.08), (sx * (xc - 0.02), ym, z), 0.01)
    T.box(coll, 'caisson_toit', (2 * xc + 0.1, yb - yf + 0.1, 0.08), (0, ym, z1 + 0.04), 'acier_sombre', bevel=0.02)
    # Panneaux en relief boulonnés sur les côtés, l'un avec une grille d'aération.
    for sx in (-1, 1):
        for y, grille in ((0.15, True), (0.85, False)):
            lot.cube('acier', (0.03, 0.5, 0.5), (sx * (xc - 0.02), y, 0.72), 0.008 * bv)
            for dy in (-0.21, 0.21):
                for dz in (-0.21, 0.21):
                    lot.cube('acier_sombre', (0.02, 0.03, 0.03), (sx * (xc + 0.0), y + dy, 0.72 + dz), 0)
            if grille:
                for k in range(5):
                    lot.cube('noir', (0.02, 0.38, 0.03), (sx * (xc + 0.0), y, 0.6 + k * 0.06), 0)
    # Armoire électrique à l'arrière : porte, charnières, poignée, triangle d'avertissement, grilles.
    T.box(coll, 'armoire_porte', (0.9, 0.04, 1.0), (0.5, yb + 0.0, 0.95), 'acier', bevel=0.015)
    for z in (0.6, 1.3):
        lot.cube('acier_sombre', (0.04, 0.05, 0.1), (0.07, yb + 0.02, z), 0)  # charnières
    lot.cube('acier_sombre', (0.04, 0.05, 0.18), (0.88, yb + 0.03, 0.95), 0)  # poignée
    tri = T.cylinder(coll, 'armoire_danger', 0.11, 0.01, (0, 0, 0), 'jaune', segments=3)
    T.rotate(tri, x=90, y=90)
    tri.location = (0.5, yb + 0.025, 1.22)
    lot.cube('noir', (0.02, 0.01, 0.07), (0.5, yb + 0.032, 1.22), 0)
    for k in range(4):
        lot.cube('noir', (0.5, 0.02, 0.025), (-0.55, yb + 0.01, 0.75 + k * 0.07), 0)
    lot.cube('acier_sombre', (0.6, 0.02, 0.36), (-0.55, yb + 0.0, 0.85), 0.008)
    # Façade : hublot au centre, pupitre à droite.
    T.box(coll, 'hublot_cadre', (0.7, 0.04, 0.46), (0, yf - 0.01, 1.3), 'acier_sombre', bevel=0.02)
    T.box(coll, 'hublot', (0.58, 0.02, 0.34), (0, yf - 0.03, 1.3), 'verre')
    lot.cube('acier_sombre', (0.02, 0.02, 0.34), (0, yf - 0.04, 1.3), 0)  # meneau
    T.box(coll, 'pupitre', (0.42, 0.14, 0.36), (0.75, yf - 0.07, 1.28), 'acier_sombre', bevel=0.02)
    T.box(coll, 'pupitre_ecran', (0.3, 0.01, 0.18), (0.75, yf - 0.145, 1.33), 'panneau')
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.045), (0.65 + i * 0.1, yf - 0.145, 1.17), 0)

    # --- Établi devant (y -1,22 -> -0,25 ; dessus z 0,86) : tiroirs, plinthe sombre, bandes de sécurité.
    ye0, ye1, ze = -1.22, yf, 0.86
    yec = (ye0 + ye1) / 2
    T.box(coll, 'etabli', (2.3, ye1 - ye0, ze - 0.36), (0, yec, (0.3 + ze - 0.04) / 2 + 0.01), 'acier_sombre', bevel=0.02)
    T.box(coll, 'etabli_plateau', (2.4, ye1 - ye0 + 0.06, 0.05), (0, yec, ze - 0.025), 'gris_clair', bevel=0.01)
    lot.cube('noir', (2.2, 0.02, 0.08), (0, ye0 - 0.005, 0.36), 0)  # plinthe
    for x in (-0.8, 0.8):  # tiroirs
        for z in (0.5, 0.68):
            lot.cube('acier', (0.5, 0.03, 0.15), (x, ye0 - 0.01, z), 0.006 * bv)
            lot.cube('acier_sombre', (0.16, 0.03, 0.025), (x, ye0 - 0.03, z + 0.03), 0)
    for k in range(12):
        x = -1.15 + 2.3 * (k + 0.5) / 12
        if abs(x) > 0.35:
            lot.cube('jaune' if k % 2 == 0 else 'noir', (2.3 / 12, 0.02, 0.05), (x, ye0 - 0.02, ze - 0.06), 0)

    # --- Plateau tournant au centre (groupe `plateau_`) : la pièce en cours de montage.
    pc = Vector((0, -0.72, ze))
    T.cylinder(coll, 'plateau_socle', 0.27, 0.04, (pc.x, pc.y, ze + 0.02), 'fonte', segments=seg)
    plateau.tube('acier_sombre', pc + Vector((0, 0, 0.04)), pc + Vector((0, 0, 0.08)), 0.24, seg)
    plateau.cube('fonte', (0.34, 0.3, 0.05), tuple(pc + Vector((0, 0, 0.105))), 0.008 * bv)  # gabarit
    plateau.cube('acier', (0.26, 0.22, 0.02), tuple(pc + Vector((0, 0, 0.14))), 0)  # plaque
    plateau.tube('acier', pc + Vector((0, 0, 0.15)), pc + Vector((0, 0, 0.19)), 0.1, sg)  # engrenage
    for k in range(8):
        t = 2 * math.pi * k / 8
        plateau.cube('acier', (0.035, 0.035, 0.04), (pc.x + 0.115 * math.cos(t), pc.y + 0.115 * math.sin(t), ze + 0.17), 0,
                     Matrix.Rotation(t, 3, 'Z'))
    plateau.tube('cuivre', pc + Vector((0, 0, 0.19)), pc + Vector((0, 0, 0.24)), 0.035, sg)  # moyeu
    T.pivot(coll, 'pivot_plateau', tuple(pc + Vector((0, 0, 0.04))))

    # --- Deux bras robots (groupes `bras1_` à gauche, `bras2_` à droite) qui travaillent sur la pièce.
    for lt, nom, x in ((bras1, 'bras1', -0.72), (bras2, 'bras2', 0.72)):
        b = _bras_robot(lt, (x, -0.78), (pc.x + (-0.11 if x < 0 else 0.11), pc.y, ze + 0.2), ze, sg, seg, bv)
        lot.tube('fonte', (x, -0.78, ze), (x, -0.78, ze + 0.06), 0.18, seg)  # embase fixe
        T.pivot(coll, f'pivot_{nom}', tuple(b))
        lot.tube('noir', (x, -0.62, ze + 0.03), (x, ye1, ze + 0.03), 0.028, 6)  # alimentation du bras
    # Bacs de pièces sur l'établi (plaques à gauche, pièces de cuivre à droite).
    for x, mat in ((-0.3, 'acier'), (0.3, 'cuivre')):
        lot.cube('bleu', (0.22, 0.18, 0.08), (x, -1.05, ze + 0.04), 0.008 * bv)
        lot.cube('noir', (0.18, 0.14, 0.01), (x, -1.05, ze + 0.08), 0)
        for k in range(2):
            lot.cube(mat, (0.1, 0.08, 0.02), (x + rnd.uniform(-0.03, 0.03), -1.05 + rnd.uniform(-0.02, 0.02), ze + 0.09 + k * 0.02),
                     0, Matrix.Rotation(rnd.uniform(-0.4, 0.4), 3, 'Z'))

    # --- Portique devant l'établi : poteaux rayés, poutre, rampe d'éclairage, gyrophare, chaîne de câbles.
    yp, zp = -1.12, 1.62
    for sx in (-1, 1):
        x = sx * 1.12
        n = 8
        for k in range(n):
            z0p = ze + (zp - ze) * k / n
            lot.cube('jaune' if k % 2 == 0 else 'noir', (0.09, 0.09, (zp - ze) / n), (x, yp, z0p + (zp - ze) / n / 2), 0)
        lot.cube('acier_sombre', (0.16, 0.16, 0.04), (x, yp, ze + 0.02), 0.01)
    lot.cube('acier_sombre', (2.34, 0.12, 0.12), (0, yp, zp + 0.06), 0.015)  # poutre
    for x in (-0.45, 0.45):
        lot.barre('acier_sombre', (x, yp, zp + 0.06), (x, yf - 0.05, z1 - 0.1), 0.06, 0)  # liaison au caisson
    lot.cube('acier_sombre', (1.6, 0.1, 0.05), (0, yp, zp - 0.025), 0)  # rampe d'éclairage
    lot.cube('blanc', (1.5, 0.06, 0.02), (0, yp, zp - 0.055), 0)
    T.cylinder(coll, 'gyrophare_pied', 0.06, 0.04, (0, yp, zp + 0.14), 'acier_sombre', segments=sg)
    T.cylinder(coll, 'gyrophare', 0.05, 0.1, (0, yp, zp + 0.21), 'orange', segments=sg, radius_top=0.04)
    for k in range(5):  # chaîne porte-câbles le long de la poutre
        lot.cube('noir', (0.1, 0.07, 0.06), (0.5 + k * 0.11, yp, zp + 0.15), 0)

    # --- Sortie devant : bouche dans l'établi et goulotte avec un engrenage fini.
    T.box(coll, 'sortie_bouche', (0.6, 0.04, 0.22), (0, ye0 - 0.01, 0.54), 'noir')
    for x in (-0.36, 0.36):
        lot.cube('acier', (0.1, 0.08, 0.32), (x, ye0 - 0.03, 0.54), 0.015)
    lot.cube('acier', (0.82, 0.08, 0.08), (0, ye0 - 0.03, 0.7), 0.015)
    pente = Matrix.Rotation(math.radians(-22), 3, 'X')
    lot.cube('acier', (0.6, 0.28, 0.04), (0, -1.34, 0.38), 0.01 * bv, pente)
    for x in (-0.31, 0.31):
        lot.cube('acier_sombre', (0.04, 0.28, 0.1), (x, -1.34, 0.42), 0, pente)
    T.cylinder(coll, 'sortie_engrenage', 0.1, 0.04, (0.05, -1.36, 0.43), 'acier', segments=sg)

    # --- Toit : bloc transformateur à ailettes, ventilateur, évents, moteur bleu, chemin de câbles, antenne.
    zt = z1 + 0.08
    xh, yh, lh, ph, hh = -0.25, 0.75, 1.5, 0.66, 0.3
    T.box(coll, 'transformateur', (lh, ph, hh), (xh, yh, zt + hh / 2), 'acier', bevel=0.02)
    T.box(coll, 'transformateur_toit', (lh + 0.06, ph + 0.06, 0.04), (xh, yh, zt + hh + 0.02), 'acier_sombre', bevel=0.01)
    for k in range(5 if leger else 9):  # ailettes de refroidissement devant et derrière
        x = xh - lh / 2 + 0.12 + (lh - 0.24) * k / ((5 if leger else 9) - 1)
        for sy in (-1, 1):
            lot.cube('acier_sombre', (0.025, 0.08, hh - 0.08), (x, yh + sy * (ph / 2 + 0.04), zt + hh / 2), 0)
    zv = zt + hh + 0.04
    xf, yf2 = xh - 0.35, yh
    T.percer(T.cylinder(coll, 'couronne_ventilateur', 0.26, 0.08, (xf, yf2, zv + 0.04), 'fonte', segments=seg),
             0.21, zv - 0.1, zv + 0.2, (xf, yf2), segments=seg)
    lot.tube('noir', (xf, yf2, zv - 0.005), (xf, yf2, zv + 0.005), 0.21, seg)
    for k in range(4):
        t = math.radians(45 + 90 * k)
        vent.cube('acier', (0.18, 0.06, 0.012), (xf + 0.1 * math.cos(t), yf2 + 0.1 * math.sin(t), zv + 0.03), 0,
                  Matrix.Rotation(t, 3, 'Z') @ Matrix.Rotation(math.radians(20), 3, 'X'))
    vent.tube('acier_sombre', (xf, yf2, zv + 0.005), (xf, yf2, zv + 0.06), 0.045, sg)
    for k in range(-2, 3):
        lot.cube('acier_sombre', (0.02, 2 * math.sqrt(0.24 ** 2 - (k * 0.09) ** 2), 0.02), (xf + k * 0.09, yf2, zv + 0.08), 0)
    T.pivot(coll, 'pivot_ventilateur', (xf, yf2, zv + 0.03))
    for x in (xh + 0.25, xh + 0.5):  # évents
        lot.tube('acier', (x, yh, zv), (x, yh, zv + 0.12), 0.05, sg)
        lot.tube('acier_sombre', (x, yh, zv + 0.12), (x, yh, zv + 0.15), 0.075, sg)
    # Moteur électrique bleu (devant à droite du toit).
    xm, ym2 = 0.62, 0.08
    lot.cube('acier_sombre', (0.6, 0.36, 0.06), (xm, ym2, zt + 0.03), 0.01)
    T.cylinder_at(coll, 'moteur', 0.17, 0.5, (xm, ym2, zt + 0.23), 'bleu', segments=seg, y=90)
    for k in range(3):
        T.cylinder_at(coll, f'moteur_ailette_{k}', 0.19, 0.03, (xm - 0.15 + k * 0.15, ym2, zt + 0.23), 'acier_sombre',
                      segments=seg, y=90)
    T.cylinder_at(coll, 'moteur_flasque', 0.12, 0.04, (xm + 0.27, ym2, zt + 0.23), 'acier', segments=sg, y=90)
    T.box(coll, 'moteur_boitier', (0.16, 0.12, 0.14), (xm, ym2 - 0.2, zt + 0.3), 'acier_sombre', bevel=0.015)
    # Chemin de câbles du transformateur au moteur, et voyant vert.
    lot.cube('acier_sombre', (0.08, 0.5, 0.04), (xm - 0.2, yh - ph / 2 - 0.15, zt + 0.06), 0)
    lot.tube('noir', (xm - 0.2, yh - ph / 2, zt + 0.1), (xm - 0.2, ym2 + 0.1, zt + 0.1), 0.025, 6)
    T.cylinder(coll, 'voyant_pied', 0.05, 0.04, (1.05, -0.12, zt + 0.02), 'acier_sombre', segments=sg)
    T.cylinder(coll, 'voyant', 0.045, 0.09, (1.05, -0.12, zt + 0.085), 'vert', segments=sg, radius_top=0.035)
    # Antenne à isolateurs (arrière droite) et câble vers le transformateur.
    xa, ya = 1.02, 1.05
    lot.tube('acier_sombre', (xa, ya, zt), (xa, ya, 2.32), 0.035, sg)
    lot.cube('acier_sombre', (0.36, 0.05, 0.05), (xa, ya, 2.3), 0.008)
    for x in (xa - 0.14, xa + 0.14):
        for k in range(2):
            T.cylinder(coll, f'isolateur_{x}_{k}', 0.045, 0.03, (x, ya, 2.35 + k * 0.04), 'blanc', segments=8)
        T.cylinder(coll, f'isolateur_tete_{x}', 0.02, 0.05, (x, ya, 2.45), 'cuivre', segments=6)
    cable = [(xa - 0.14, ya, 2.43), (xa - 0.35, ya - 0.1, 2.15), (xh + lh / 2, yh + 0.1, zt + 0.2)]
    for a, b in zip(cable, cable[1:]):
        lot.tube('noir', a, b, 0.018, 6)

    for l in (lot, bras1, bras2, plateau, vent):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def _roue(lot, x, c, r, larg, nb, mat, mat_rayon, sg, seg):
    """Roue à rayons dans le plan X = x (centre c = (y, z), rayon r) : jante (anneau de `seg` segments), moyeu,
    `nb` rayons diamétraux."""
    p = Vector((x, c[0], c[1]))
    ep = 0.08  # épaisseur radiale de la jante
    corde = 2 * (r - ep / 2) * math.sin(math.pi / seg) * 1.04
    for k in range(seg):
        t = 2 * math.pi * (k + 0.5) / seg
        m = p + Vector((0, math.cos(t), math.sin(t))) * (r - ep / 2)
        lot.cube(mat, (larg, corde, ep), tuple(m), 0, Matrix.Rotation(t - math.pi / 2, 3, 'X'))
    lot.tube(mat, (x - larg / 2 - 0.03, c[0], c[1]), (x + larg / 2 + 0.03, c[0], c[1]), 0.1, sg)  # moyeu
    for k in range(nb):
        t = math.pi * k / nb
        d = Vector((0, math.cos(t), math.sin(t))) * (r - 0.06)
        lot.barre(mat_rayon, p + d, p - d, 0.06, 0)


def concasseur_t1(coll, leger=True):
    """Concasseur à mâchoires à combustible : 3 x 3 cases, 2,6 unités max (1,3 m) ; le corps occupe le plus possible de l'emprise. Sortie devant (-Y).

    Même époque que l'estampeuse (massif de pierre, fonte peinte en vert foncé, vapeur) : bâti en caisson à nervures
    boulonnées ; sur le dessus, broyeur à deux rouleaux dentés (sens contraires, engrenages à droite) dans un cadre
    ouvert, avec des pierres entre les rouleaux ; ouverture dentée en façade ; paliers graisseurs sur montants,
    poulie à droite sur l'arbre du rouleau arrière ; goulotte de sortie et tas de gravier devant ; plaque de
    constructeur en cuivre. Combustible : bac à charbon sur toute la largeur de l'arrière (un tapis peut arriver
    n'importe où) ; petite machine à vapeur (cylindre, glissières, manivelle, poulie) surélevée sur une console
    au-dessus du bac, qui entraîne la poulie par une courroie ; chaudière verticale sur le côté gauche (foyer tourné
    vers le bac, vis sans fin qui monte le charbon du bac jusqu'au foyer, cheminée sur le côté, manomètre),
    conduite de vapeur en cuivre.
    Pièces mobiles : `volant_` (rouleau arrière, son engrenage, poulie et arbre, tournent ensemble), `rouleau_`
    (rouleau avant et son engrenage, en sens contraire), `moteur_` (poulie et manivelle de la machine à vapeur), `vis_` (vis
    sans fin du charbon) ; pivots `pivot_volant`, `pivot_rouleau`, `pivot_moteur`, `pivot_vis`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(63)
    bv = 0.0 if leger else 1.0
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    vol = T.Lot(coll, 'volant')
    mot = T.Lot(coll, 'moteur')

    # --- Massif de pierre sur toute la largeur (z 0 -> 0,3 ; x ±1,45 ; y -0,9 -> 0,75).
    T.box(coll, 'massif', (2.9, 1.65, 0.3), (0, -0.075, 0.15), 'pierre_sombre', bevel=0.03)
    T.parement(lot, [('y', -0.9, -1.4, 1.4, -1), ('y', 0.75, -1.4, 1.4, 1),
                     ('x', -1.45, -0.85, 0.7, -1), ('x', 1.45, -0.85, 0.7, 1)],
               (0.08, 0.22), seed=9, densite=0.5 if leger else 0.75, teintes=T.PIERRES, haut=(0.11, 0.13),
               bevel=0.012 * bv)

    # --- Bâti en caisson (x ±0,5 ; y -0,55 -> 0,75 ; z 0,3 -> 1,5) : nervures, boulons, ouverture des mâchoires.
    x0 = 0.2  # le bâti et le broyeur sont décalés à droite : la chaudière occupe la gauche
    yb0, yb1, zb1 = -0.55, 0.75, 1.85
    T.box(coll, 'bati', (1.4, yb1 - yb0, zb1 - 0.3), (x0, (yb0 + yb1) / 2, (0.3 + zb1) / 2), 'vert_fonce', bevel=0.04)
    T.box(coll, 'bati_semelle', (1.6, yb1 - yb0 + 0.16, 0.08), (x0, (yb0 + yb1) / 2, 0.34), 'fonte', bevel=0.015)
    for s in (-1, 1):
        for y in (-0.35, 0.05, 0.45):  # nervures des flancs
            lot.cube('vert_fonce', (0.05, 0.08, zb1 - 0.42), (x0 + s * 0.72, y, (0.38 + zb1) / 2), 0.01 * bv)
        for y in (-0.48, 0.68):
            for z in (0.45, zb1 - 0.1):
                lot.cube('acier', (0.03, 0.05, 0.05), (x0 + s * 0.715, y, z), 0)  # boulons
    T.box(coll, 'bouche_machoires', (0.72, 0.03, 0.7), (0, yb0 - 0.005, 1.1), 'noir')
    for k in range(6):  # dents de la mâchoire fixe
        lot.cube('acier', (0.68, 0.03, 0.04), (0, yb0 - 0.02, 0.84 + k * 0.105), 0)
    for x in (-0.41, 0.41):
        lot.cube('fonte', (0.1, 0.06, 0.8), (x, yb0 - 0.02, 1.1), 0.01 * bv)
    lot.cube('fonte', (0.92, 0.06, 0.1), (0, yb0 - 0.02, 1.52), 0.01 * bv)
    lot.cube('cuivre', (0.3, 0.02, 0.1), (0, yb0 - 0.05, 1.67), 0)  # plaque de constructeur
    # Sortie basse : bouche de décharge, goulotte, gravier.
    T.box(coll, 'bouche_sortie', (0.56, 0.03, 0.16), (0, yb0 - 0.005, 0.5), 'noir')
    yg0, yg1, zg0, zg1 = yb0 - 0.02, -1.45, 0.46, 0.14
    d = Vector((0, yg1 - yg0, zg1 - zg0))
    pente = Matrix.Rotation(math.atan2(d.z, d.y), 3, 'X')
    c = Vector((0, (yg0 + yg1) / 2, (zg0 + zg1) / 2))
    lot.cube('fonte', (0.6, d.length, 0.04), tuple(c), 0.01 * bv, pente)
    for x in (-0.32, 0.32):
        lot.cube('acier_sombre', (0.04, d.length, 0.12), tuple(c + Vector((x, 0, 0.04))), 0, pente)
    lot.cube('acier_sombre', (0.6, 0.06, zg1), (0, yg1 + 0.06, zg1 / 2), 0)
    for _ in range(8 if leger else 16):  # gravier sur la goulotte
        t = rnd.uniform(0.04, 0.07)
        y = rnd.uniform(-1.35, -0.85)
        z = zg0 + (zg1 - zg0) * (y - yg0) / (yg1 - yg0) + 0.03
        lot.cube(rnd.choice(('pierre_claire', 'pierre', 'beton')), (t, t, t * 0.8), (rnd.uniform(-0.22, 0.22), y, z),
                 0, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Broyeur sur le dessus : deux rouleaux dentés qui tournent en sens contraire (groupes `rouleau_` et `volant_`),
    # dans un cadre ouvert ; paliers sur des montants, engrenages et poulie à droite.
    za = 2.07  # axe des rouleaux
    y1, y2 = -0.2, 0.3  # rouleau avant (groupe `rouleau_`) et arrière (sur l'arbre du volant, groupe `volant_`)
    ya = y2
    rr, dent = 0.19, 0.06
    rou = T.Lot(coll, 'rouleau')
    for lt, y in ((rou, y1), (vol, y2)):
        lt.tube('acier_sombre', (x0 - 0.76, y, za), (x0 + 0.76, y, za), rr, seg)
        n_a, n_x = (8, 4) if leger else (12, 6)
        for k in range(n_a):
            t = 2 * math.pi * (k + (0.5 if y == y2 else 0)) / n_a
            for j in range(n_x):
                x = x0 - 0.6 + 1.2 * j / (n_x - 1) + (0.07 if k % 2 else 0)
                lt.cube('acier', (0.12, 0.07, dent * 2), (x, y + rr * math.cos(t), za + rr * math.sin(t)), 0,
                        Matrix.Rotation(t - math.pi / 2, 3, 'X'))  # dents
        lt.tube('acier', (x0 - 1.06, y, za), (x0 + 1.24 if y == y2 else x0 + 1.18, y, za), 0.055, sg)  # arbre
        r_eng = (y2 - y1) / 2
        lt.tube('fonte', (x0 + 1.08, y, za), (x0 + 1.14, y, za), r_eng - 0.03, sg)  # engrenage
        n_d = 10 if leger else 16
        for k in range(n_d):
            t = 2 * math.pi * (k + (0.5 if y == y2 else 0)) / n_d
            lt.cube('fonte', (0.06, 0.05, 0.06), (x0 + 1.11, y + (r_eng - 0.01) * math.cos(t), za + (r_eng - 0.01) * math.sin(t)), 0,
                    Matrix.Rotation(t - math.pi / 2, 3, 'X'))
    T.pivot(coll, 'pivot_rouleau', (x0, y1, za), (1, 0, 0))
    # Cadre ouvert autour des rouleaux.
    yc0, yc1, zc0, zc1 = y1 - 0.31, y2 + 0.31, zb1, za + 0.14
    for x in (x0 - 0.84, x0 + 0.84):
        lot.cube('vert_fonce', (0.08, yc1 - yc0, zc1 - zc0), (x, (yc0 + yc1) / 2, (zc0 + zc1) / 2), 0.015)
    for y in (yc0, yc1):
        lot.cube('vert_fonce', (1.76, 0.08, zc1 - zc0), (x0, y, (zc0 + zc1) / 2), 0.015)
    for x in (x0 - 0.84, x0 + 0.84):
        for y in (yc0, yc1):
            lot.cube('fonte', (0.12, 0.12, 0.06), (x, y, zc1 + 0.03), 0.01)  # coins
    T.box(coll, 'broyeur_fond', (1.6, yc1 - yc0 - 0.08, 0.02), (x0, (yc0 + yc1) / 2, zb1 + 0.01), 'noir')
    # Pierres entre les rouleaux.
    for _ in range(6 if leger else 10):
        t = rnd.uniform(0.12, 0.18)
        lot.cube(rnd.choice(('pierre', 'pierre_claire')), (t, t * 0.9, t * 0.75),
                 (x0 + rnd.uniform(-0.58, 0.58), (y1 + y2) / 2 + rnd.uniform(-0.06, 0.06), za + rr + rnd.uniform(-0.02, 0.04)),
                 0.02 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    # Paliers sur montants (deux par côté), graisseurs.
    for s in (-1, 1):
        for y in (y1, y2):
            lot.cube('fonte', (0.14, 0.24, za - 0.34), (x0 + s * 0.95, y, (za + 0.3) / 2 - 0.02), 0.01 * bv)  # montant
            lot.cube('fonte', (0.18, 0.28, 0.16), (x0 + s * 0.95, y, za), 0.02)  # palier
            lot.tube('cuivre', (x0 + s * 0.95, y, za + 0.08), (x0 + s * 0.95, y, za + 0.15), 0.03, 6)  # graisseur
    xp = x0 + 1.2  # plan de la courroie (poulie du volant et poulie motrice)
    _roue(vol, xp, (ya, za), 0.45, 0.12, 2, 'vert_fonce', 'vert_fonce', sg, seg)  # poulie
    T.pivot(coll, 'pivot_volant', (x0, ya, za), (1, 0, 0))

    # --- Entrée du combustible : bac à charbon sur toute la largeur de l'arrière (un tapis peut arriver n'importe où).
    yt0, yt1, xt = 0.78, 1.46, 1.46
    T.box(coll, 'bac_fond', (2 * xt, yt1 - yt0, 0.06), (0, (yt0 + yt1) / 2, 0.03), 'fonte', bevel=0.01)
    T.box(coll, 'bac_charbon', (2 * xt - 0.12, yt1 - yt0 - 0.12, 0.05), (0, (yt0 + yt1) / 2, 0.085), 'acier_sombre')
    for x in (-xt + 0.03, xt - 0.03):
        lot.cube('fonte', (0.06, yt1 - yt0, 0.36), (x, (yt0 + yt1) / 2, 0.18), 0.01)  # joues
    xg = -1.18  # passage de la vis sans fin (au droit de la chaudière)
    for x0, x1 in ((-xt, xg - 0.16), (xg + 0.16, xt)):
        lot.cube('fonte', (x1 - x0, 0.06, 0.46), ((x0 + x1) / 2, yt0 + 0.03, 0.23), 0.01)  # paroi contre le bâti
    lot.cube('fonte', (0.32, 0.06, 0.12), (xg, yt0 + 0.03, 0.06), 0.01)  # seuil sous la vis
    for dx in (-0.16, 0.16):
        lot.cube('acier_sombre', (0.05, 0.1, 0.5), (xg + dx, yt0 + 0.03, 0.25), 0.01)  # montants du passage
    lot.cube('fonte', (2 * xt, 0.06, 0.2), (0, yt1 - 0.03, 0.1), 0.01)  # rebord bas, côté tapis
    for k in range(14):
        x = -xt + 2 * xt * (k + 0.5) / 14
        lot.cube('jaune' if k % 2 == 0 else 'noir', (2 * xt / 14, 0.065, 0.03), (x, yt1 - 0.03, 0.215), 0)
    for _ in range(10 if leger else 20):  # morceaux de charbon
        t = rnd.uniform(0.07, 0.12)
        lot.cube('noir', (t, t, t * 0.8), (rnd.uniform(-1.3, 1.3), rnd.uniform(yt0 + 0.12, yt1 - 0.12), 0.12 + t * 0.3),
                 0.015 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    T.box(coll, 'bouche_charbon', (0.9, 0.02, 0.2), (0, yb1 + 0.005, 0.5), 'noir')  # passage vers le foyer
    lot.cube('fonte', (1.04, 0.05, 0.06), (0, yb1 + 0.02, 0.63), 0)

    # --- Machine à vapeur surélevée derrière à droite, sur une console au-dessus du bac (le tapis passe dessous) :
    # cylindre, glissières, manivelle et poulie (groupe `moteur_`), dans le plan de la courroie.
    ye, ze, zp = 1.08, 1.42, 1.3  # axe de la manivelle, dessus de la console
    lot.cube('fonte', (0.86, yt1 - 0.08 - yb1, 0.08), (xp - 0.42, (yb1 + yt1 - 0.08) / 2, zp - 0.04), 0.015)  # console
    for x in (xp - 0.72, xp - 0.04):
        lot.barre('fonte', (x, yb1 + 0.02, 0.7), (x, yt1 - 0.15, zp - 0.08), 0.07, 0)  # jambes de force
    lot.cube('fonte', (0.8, 0.42, 0.06), (xp - 0.4, ye, zp + 0.03), 0.015)
    T.cylinder_at(coll, 'machine_cylindre', 0.15, 0.36, (xp - 0.64, ye, ze), 'vert_fonce', segments=sg, y=90)
    for x in (xp - 0.8, xp - 0.48):
        T.cylinder_at(coll, f'machine_cercle_{x}', 0.165, 0.04, (x, ye, ze), 'acier_sombre', segments=sg, y=90)
    for dz in (-0.06, 0.06):
        lot.cube('acier', (0.3, 0.04, 0.03), (xp - 0.32, ye, ze + dz), 0)  # glissières
    lot.cube('acier_sombre', (0.06, 0.1, 0.1), (xp - 0.3, ye, ze), 0)  # crosse
    lot.cube('fonte', (0.08, 0.2, ze - zp), (xp - 0.14, ye, (ze + zp) / 2), 0.01 * bv)  # palier de la manivelle
    mot.tube('acier_sombre', (xp - 0.18, ye, ze), (xp - 0.1, ye, ze), 0.12, sg)  # plateau de manivelle
    mot.tube('acier', (xp - 0.1, ye, ze), (xp + 0.05, ye, ze), 0.03, 6)
    mot.tube('vert_fonce', (xp - 0.05, ye, ze), (xp + 0.05, ye, ze), 0.17, sg)  # poulie motrice
    mot.cube('acier', (0.3, 0.035, 0.035), (xp - 0.3, ye, ze), 0)  # bielle (simplifiée)
    T.pivot(coll, 'pivot_moteur', (xp, ye, ze), (1, 0, 0))
    T.courroie(coll, 'courroie', xp, (ya, za), 0.45 + 0.02, (ye, ze), 0.17 + 0.02, 0.08, 0.025, 'noir',
               n1=16 if leger else 32, n2=8 if leger else 16)

    # --- Chaudière verticale sur le côté gauche (fumée sur le côté) : foyer tourné vers le bac, vis sans fin,
    # cerclages, dôme, cheminée, manomètre, conduite de vapeur vers la machine.
    xc, yc, rc = -1.18, 0.12, 0.27
    T.cylinder(coll, 'chaudiere_socle', rc + 0.03, 0.12, (xc, yc, 0.06), 'pierre_sombre', segments=seg)
    T.cylinder(coll, 'chaudiere', rc, 1.5, (xc, yc, 0.12 + 0.75), 'fonte', segments=seg)
    for z in (0.35, 1.3, 1.55):
        T.cylinder(coll, f'chaudiere_cercle_{z}', rc + 0.02, 0.05, (xc, yc, z), 'cuivre', segments=seg)
    T.cylinder(coll, 'chaudiere_dome', rc, 0.18, (xc, yc, 1.71), 'fonte', segments=seg, radius_top=0.13)
    zf = 0.74  # porte du foyer, à la hauteur de la sortie de la vis
    T.box(coll, 'foyer_cadre', (0.36, 0.05, 0.3), (xc, yc + rc - 0.005, zf), 'acier_sombre', bevel=0.01)
    T.box(coll, 'foyer', (0.28, 0.04, 0.22), (xc, yc + rc + 0.01, zf), 'noir')
    T.box(coll, 'foyer_lueur', (0.2, 0.03, 0.12), (xc, yc + rc + 0.025, zf - 0.03), 'braise')
    lot.cube('acier', (0.12, 0.04, 0.03), (xc + 0.1, yc + rc + 0.04, zf + 0.08), 0)  # poignée
    # Vis sans fin inclinée : monte le charbon du bac jusqu'au-dessus de la porte du foyer (groupe `vis_` qui tourne).
    va, vb = Vector((xc, 1.05, 0.16)), Vector((xc, 0.57, 0.68))
    dv = vb - va
    rot_v = Vector((0, 0, 1)).rotation_difference(dv).to_matrix()
    lg = dv.length
    pose = Matrix.Translation(va) @ rot_v.to_4x4()
    T.helice(coll, 'vis_helice', (0, 0), 0.03, lg - 0.03, 0.022, 0.06, 4, 0.01, 'acier',
             pas_par_tour=12 if leger else 20).matrix_basis = pose
    T.cylinder(coll, 'vis_arbre', 0.022, lg + 0.04, (0, 0, lg / 2), 'acier_sombre', segments=6).matrix_basis = pose
    T.pivot(coll, 'pivot_vis', tuple(va), tuple(dv.normalized()))
    haut = rot_v @ Vector((0, 1, 0))  # perpendiculaire à la vis, vers le haut
    milieu = (va + vb) / 2
    lot.cube('fonte', (0.16, 0.025, lg), tuple(milieu - haut * 0.075), 0, rot_v)  # fond de l'auge
    for sx in (-1, 1):
        lot.cube('fonte', (0.025, 0.1, lg), tuple(milieu - haut * 0.03 + Vector((sx * 0.08, 0, 0))), 0, rot_v)  # joues
    lot.cube('acier_sombre', (0.2, 0.035, 0.035), tuple(va + dv * 0.5 - haut * 0.02), 0, rot_v)  # collier
    lot.cube('acier_sombre', (0.18, 0.15, 0.12), tuple(vb + dv.normalized() * 0.04), 0.012, rot_v)  # carter d'entraînement
    lot.tube('cuivre', vb + dv.normalized() * 0.1, vb + dv.normalized() * 0.14, 0.045, 8)  # petit moteur
    pente = Matrix.Rotation(math.radians(-35), 3, 'X')
    lot.cube('fonte', (0.16, 0.16, 0.025), (xc, yc + rc + 0.07, zf - 0.02), 0, pente)  # bec qui verse dans la porte
    lot.tube('fonte', (xc, yc, 1.79), (xc, yc, 2.4), 0.09, sg)  # cheminée
    T.cylinder(coll, 'cheminee_chapeau', 0.1, 0.1, (xc, yc, 2.45), 'fonte', segments=sg, radius_top=0.15)
    T.cylinder_at(coll, 'manometre', 0.07, 0.03, (xc - rc - 0.02, yc, 1.2), 'acier_sombre', segments=sg, y=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.055, 0.01, (xc - rc - 0.04, yc, 1.2), 'blanc', segments=sg, y=90)
    lot.cube('rouge', (0.008, 0.01, 0.05), (xc - rc - 0.046, yc, 1.22), 0)
    zt = 1.92  # conduite de vapeur, au-dessus de la console
    pts = [Vector((xc + 0.12, yc, 1.75)), Vector((xc + 0.12, yc, zt)), Vector((xc + 0.12, ye, zt)), Vector((xp - 0.64, ye, zt)),
           Vector((xp - 0.64, ye, ze + 0.15))]
    for p, q in zip(pts, pts[1:]):
        lot.tube('cuivre', p, q, 0.04, sg)
    for p in pts[1:4]:
        lot.boule('cuivre', p, 0.05)
    T.cylinder(coll, 'vanne_vapeur', 0.07, 0.04, (-0.3, ye, zt), 'rouge', segments=sg)

    for l in (lot, vol, mot, rou):
        l.finir()
    T.poser_au_sol(coll, 1.5)



def betonniere_t2(coll, leger=True):
    """Bétonnière industrielle (électrique) : 3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y).

    Grand tambour orange incliné (entrée en haut à l'arrière, vidange en bas à l'avant) qui tourne sur deux bandages
    portés par quatre galets, entraîné par une couronne dentée et un pignon (réducteur et moteur électrique bleu à
    droite). Derrière, en hauteur sur un portique : deux trémies (gravier concassé et laitier) qui versent dans un
    entonnoir à l'entrée du tambour ; réservoir d'eau bleu à gauche, conduite jusqu'à l'entonnoir. Devant : presse à
    blocs (petite trémie sous la bouche du tambour, tiroir d'alimentation, moule, table vibrante, tête de presse et vérin)
    et convoyeur où sortent les blocs de béton. Armoire électrique à l'avant gauche.
    Pièces mobiles : `tambour_` (tambour, bandages, couronne) tourne autour de son axe incliné ; `pignon_` tourne en
    sens contraire, plus vite ; `tiroir_` avance au-dessus du moule et revient ; `presse_` descend dans le moule ;
    `blocs_` sortent vers l'avant. Pivots `pivot_tambour`, `pivot_pignon`, `pivot_tiroir`, `pivot_presse`, `pivot_blocs`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(77)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    tam = T.Lot(coll, 'tambour')

    # --- Châssis en poutrelles (z 0 -> 0,14).
    for x in (-0.45, 0.45):
        lot.cube('acier_sombre', (0.14, 2.05, 0.14), (x, 0.42, 0.07), 0.01 * bv)
    for y in (-0.55, 0.62, 1.4):
        lot.cube('acier_sombre', (2.8, 0.12, 0.12), (0, y, 0.06), 0.01 * bv)
    for x in (-0.45, 0.45):
        for y in (-0.55, 0.62, 1.4):
            lot.cube('fonte', (0.2, 0.2, 0.02), (x, y, 0.13), 0)  # goussets

    # --- Tambour incliné (groupe `tambour_`) : axe de F (bouche, en bas devant) à B (entrée, en haut derrière).
    F, B = Vector((0, -0.55, 1.05)), Vector((0, 1.0, 1.45))
    d = (B - F).normalized()
    L = (B - F).length
    ex = Vector((1, 0, 0))
    u = d.cross(ex).normalized()  # perpendiculaire à l'axe, vers le haut
    if u.z < 0:
        u = -u
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()

    def sur_axe(s):
        return F + d * s

    def autour(s, r, a):  # point à la distance r de l'axe, angle a (0 = côté +X, pi/2 = dessus)
        return sur_axe(s) + ex * (r * math.cos(a)) + u * (r * math.sin(a))

    def pose(o):
        o.matrix_basis = Matrix.Translation(F) @ rot
        return o

    prof = [(0.36, 0.0), (0.59, 0.3), (0.68, 0.55), (0.68, 1.1), (0.59, 1.35), (0.38, L)]
    pose(T.tour(coll, 'tambour_corps', prof, 'orange', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_bouche', [(0.37, -0.03), (0.37, 0.03)], 'acier_sombre', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_fond', [(0.34, 0.06), (0.34, 0.065)], 'noir', seg))  # intérieur sombre
    pose(T.tour(coll, 'tambour_beton', [(0.24, 0.065), (0.24, 0.07)], 'beton', seg))
    pose(T.tour(coll, 'tambour_entree', [(0.39, L - 0.03), (0.39, L + 0.02)], 'acier_sombre', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_entree_fond', [(0.36, L - 0.06), (0.36, L - 0.055)], 'noir', seg))
    for s in (0.45, 1.2):  # bandages
        pose(T.tour(coll, f'tambour_bandage_{s}', [(0.74, s - 0.05), (0.74, s + 0.05)], 'acier', seg))
    for s in (0.42, 0.48, 1.17, 1.23):
        pose(T.tour(coll, f'tambour_cale_{s}', [(0.7, s - 0.01), (0.7, s + 0.01)], 'acier_sombre', seg))
    sc, rc = 0.82, 0.79  # couronne dentée
    pose(T.tour(coll, 'tambour_couronne', [(rc, sc - 0.04), (rc, sc + 0.04)], 'acier_sombre', seg))
    n_d = 24 if leger else 40
    for k in range(n_d):
        a = 2 * math.pi * k / n_d
        p = autour(sc, rc + 0.02, a)
        r3 = rot.to_3x3() @ Matrix.Rotation(a, 3, 'Z')
        tam.cube('acier', (0.05, 0.05, 0.08), tuple(p), 0, r3)
    for k in range(3):  # bandes de soudure en spirale (décor)
        for j in range(6 if leger else 12):
            s = 0.6 + j * 0.85 / (6 if leger else 12)
            if abs(s - sc) < 0.07 or abs(s - 1.2) < 0.08:
                continue
            a = 2 * math.pi * k / 3 + (s - 0.6) * 2.4
            r3 = rot.to_3x3() @ Matrix.Rotation(a, 3, 'Z')
            tam.cube('jaune', (0.02, 0.1, 0.16), tuple(autour(s, 0.685, a)), 0, r3 @ Matrix.Rotation(0.5, 3, 'X'))
    T.pivot(coll, 'pivot_tambour', tuple(F), tuple(d))

    # --- Galets (2 par bandage) sur chaises, fixés au châssis.
    for s in (0.45, 1.2):
        for a in (math.radians(-90 + 38), math.radians(-90 - 38)):
            c = autour(s, 0.74 + 0.09, a)
            lot.tube('acier_sombre', c - d * 0.07, c + d * 0.07, 0.09, sg)
            lot.tube('acier', c - d * 0.12, c + d * 0.12, 0.03, 6)  # axe
            for e in (-0.11, 0.11):
                p = c + d * e
                lot.cube('fonte', (0.12, 0.05, p.z - 0.12), (p.x, p.y, (p.z + 0.12) / 2), 0.01 * bv)  # chaise
    # --- Pignon (groupe `pignon_`), réducteur et moteur à droite.
    ap = math.radians(-30)
    rp = 0.13
    cp = autour(sc, rc + 0.02 + rp + 0.03, ap)
    pg = T.Lot(coll, 'pignon')
    pg.tube('acier_sombre', cp - d * 0.04, cp + d * 0.04, rp, sg)
    for k in range(10):
        a = 2 * math.pi * k / 10
        q = cp + ex * ((rp + 0.02) * math.cos(a)) + u * ((rp + 0.02) * math.sin(a))
        pg.cube('acier', (0.045, 0.045, 0.07), tuple(q), 0, rot.to_3x3() @ Matrix.Rotation(a, 3, 'Z'))
    pg.tube('acier', cp - d * 0.06, cp + d * 0.3, 0.035, 6)  # arbre
    T.pivot(coll, 'pivot_pignon', tuple(cp), tuple(d))
    cr = cp + d * 0.42  # réducteur
    lot.cube('acier_sombre', (0.3, 0.26, 0.3), tuple(cr), 0.02, rot.to_3x3())
    lot.cube('fonte', (0.36, 0.3, 0.05), tuple(cr + u * 0.17), 0.01, rot.to_3x3())
    cm = cr + d * 0.36  # moteur
    lot.tube('bleu', cm - d * 0.2, cm + d * 0.2, 0.14, sg)
    for k in range(6 if leger else 10):
        a = 2 * math.pi * k / (6 if leger else 10)
        q = cm + ex * (0.145 * math.cos(a)) + u * (0.145 * math.sin(a))
        lot.cube('acier_sombre', (0.025, 0.025, 0.34), tuple(q), 0, rot.to_3x3() @ Matrix.Rotation(a, 3, 'Z'))
    lot.cube('acier_sombre', (0.1, 0.1, 0.08), tuple(cm + u * 0.17), 0)  # boîte à bornes
    for p in (cr, cm):
        lot.cube('acier_sombre', (0.2, 0.2, p.z - 0.3), (p.x, p.y, (p.z - 0.3) / 2 + 0.07), 0.01 * bv)  # pieds
    lot.cube('fonte', (0.34, 1.0, 0.04), (cp.x, (cr.y + cm.y) / 2, 0.15), 0.01)

    # --- Portique des trémies (derrière, en hauteur) : gravier concassé à gauche, laitier à droite.
    zb = 2.1
    for x in (-1.36, 1.36):
        for y in (0.78, 1.42):
            lot.cube('acier', (0.1, 0.1, zb), (x, y, zb / 2), 0.01 * bv)
            lot.cube('fonte', (0.14, 0.14, 0.03), (x, y, 0.015), 0)
        lot.barre('acier', (x, 0.78, 0.4), (x, 1.42, 1.5), 0.06, 0)  # croix de contreventement
        lot.barre('acier', (x, 1.42, 0.4), (x, 0.78, 1.5), 0.06, 0)
    for y in (0.78, 1.42):
        lot.cube('acier', (2.82, 0.1, 0.1), (0, y, zb), 0.01 * bv)
    for x, mat, matf in ((-0.62, 'pierre_claire', 'pierre'), (0.62, 'acier_sombre', 'noir')):
        o = T.lissage(coll, f'tremie_{x}', [(0.08, 0.02, zb + 0.06), (0.37, 0.04, zb + 0.28), (0.37, 0.04, 2.55)], 'acier',
                      fond=True, dessus=False, n_coin=2)
        for v in o.data.vertices:
            v.co.x += x
            v.co.y += 1.1
        T.box(coll, f'tremie_bord_{x}', (0.8, 0.66, 0.04), (x, 1.1, 2.56), 'acier_sombre', bevel=0.01)
        T.box(coll, f'tremie_contenu_{x}', (0.68, 0.56, 0.02), (x, 1.1, 2.5), mat)
        for _ in range(5 if leger else 10):
            t = rnd.uniform(0.05, 0.09)
            lot.cube(rnd.choice((mat, matf)), (t, t, t * 0.8), (x + rnd.uniform(-0.26, 0.26), 1.1 + rnd.uniform(-0.2, 0.2), 2.52),
                     0, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
        lot.tube('acier_sombre', (x, 1.1, zb + 0.06), (x * 0.2, 1.15, 1.98), 0.06, sg)  # goulotte vers l'entonnoir
        lot.cube('jaune', (0.05, 0.14, 0.14), (x * 0.7, 1.1, zb + 0.03), 0)  # vanne
    # Entonnoir à l'entrée du tambour.
    T.tour(coll, 'entonnoir', [(0.08, 1.62), (0.24, 1.9), (0.26, 1.96)], 'acier', seg, centre=(0, 1.16), dessus=False)
    lot.tube('acier_sombre', (0, 1.16, 1.64), (0, B.y + 0.02, B.z + 0.04), 0.07, sg)

    # --- Réservoir d'eau (gauche) et conduite jusqu'à l'entonnoir.
    xw, yw = -1.2, 0.12
    T.cylinder(coll, 'reservoir', 0.28, 1.2, (xw, yw, 0.78), 'bleu', segments=seg)
    T.cylinder(coll, 'reservoir_dome', 0.28, 0.1, (xw, yw, 1.43), 'bleu', segments=seg, radius_top=0.16)
    for z in (0.45, 1.05):
        T.cylinder(coll, f'reservoir_cercle_{z}', 0.295, 0.04, (xw, yw, z), 'acier_sombre', segments=seg)
    for a in range(4):
        t = math.pi / 4 + a * math.pi / 2
        lot.cube('acier_sombre', (0.06, 0.06, 0.22), (xw + 0.24 * math.cos(t), yw + 0.24 * math.sin(t), 0.11), 0)
    lot.cube('acier_sombre', (0.56, 0.56, 0.04), (xw, yw, 0.2), 0.01)
    lot.cube('blanc', (0.02, 0.06, 0.8), (xw + 0.285, yw, 0.8), 0)  # niveau
    lot.cube('bleu', (0.025, 0.04, 0.5), (xw + 0.29, yw, 0.7), 0)
    eau = [Vector((xw, yw, 1.48)), Vector((xw, yw, 1.75)), Vector((xw, 1.16, 1.75)), Vector((-0.2, 1.16, 1.75)),
           Vector((-0.2, 1.16, 1.85))]
    for a, b in zip(eau, eau[1:]):
        lot.tube('acier', a, b, 0.04, sg)
    for p in eau[1:4]:
        lot.boule('acier', p, 0.05)
    T.cylinder(coll, 'vanne_eau', 0.07, 0.03, (xw, 0.7, 1.82), 'rouge', segments=sg)

    # --- Presse à blocs, devant : petite trémie sous la bouche, tiroir (groupe `tiroir_`), moule, table vibrante,
    # tête de presse (groupe `presse_`) et vérin.
    ym, zm = -0.95, 0.42  # moule (centre, dessus)
    o = T.lissage(coll, 'tremie_presse', [(0.08, 0.02, 0.6), (0.18, 0.03, 0.72)], 'acier', fond=True, dessus=False, n_coin=2)
    for v in o.data.vertices:
        v.co.y += -0.68
    lot.cube('fonte', (0.36, 0.36, 0.03), (0, -0.68, 0.73), 0.005)
    lot.cube('acier', (0.3, 0.26, 0.04), (0, -0.56, 0.76), 0, Matrix.Rotation(math.radians(-30), 3, 'X'))  # bec
    ti = T.Lot(coll, 'tiroir')
    ti.cube('acier_sombre', (0.42, 0.24, 0.08), (0, -0.7, 0.53), 0.01 * bv)
    ti.cube('beton', (0.36, 0.18, 0.01), (0, -0.7, 0.575), 0)
    T.pivot(coll, 'pivot_tiroir', (0, -0.7, 0.49), (0, 1, 0))
    lot.cube('acier', (0.5, 0.3, 0.03), (0, -0.7, 0.475), 0)  # glissière du tiroir
    lot.cube('acier_sombre', (0.62, 0.42, 0.2), (0, ym, 0.24), 0.015)  # table vibrante
    for x in (-0.24, 0.24):
        for y in (ym - 0.14, ym + 0.14):
            lot.cube('noir', (0.08, 0.08, 0.1), (x, y, 0.09), 0)  # silentblocs
    lot.cube('fonte', (0.52, 0.32, zm - 0.34), (0, ym, (zm + 0.34) / 2), 0.01)  # moule
    for x in (-0.12, 0.12):
        lot.cube('noir', (0.18, 0.2, 0.005), (x, ym, zm + 0.002), 0)
    for x in (-0.38, 0.38):  # montants
        for y in (ym + 0.17, ym - 0.17):
            lot.cube('acier', (0.07, 0.07, 1.24), (x, y, 0.62), 0.01 * bv)
    for y in (ym + 0.17, ym - 0.17):
        lot.cube('acier', (0.86, 0.08, 0.1), (0, y, 1.24), 0.01 * bv)
    lot.cube('acier', (0.18, 0.42, 0.06), (0, ym, 1.27), 0.01)
    lot.tube('acier', (0, ym, 1.3), (0, ym, 1.6), 0.09, sg)  # vérin
    lot.tube('acier_sombre', (0, ym, 1.58), (0, ym, 1.64), 0.11, sg)
    lot.tube('noir', (0.06, ym, 1.62), (0.42, ym - 0.05, 1.0), 0.02, 6)  # flexible
    pr = T.Lot(coll, 'presse')
    pr.tube('acier', (0, ym, 1.3), (0, ym, 0.86), 0.04, sg)  # tige
    pr.cube('acier_sombre', (0.5, 0.3, 0.06), (0, ym, 0.83), 0.01)  # tête
    for x in (-0.12, 0.12):
        pr.cube('acier', (0.17, 0.19, 0.08), (x, ym, 0.76), 0)  # poinçons
    T.pivot(coll, 'pivot_presse', (0, ym, 0.72), (0, 0, 1))
    for k in range(5):
        lot.cube('jaune' if k % 2 == 0 else 'noir', (0.1, 0.082, 0.102), (-0.2 + k * 0.1, ym - 0.17, 1.24), 0)

    # --- Convoyeur de sortie (convoyeur commun) et blocs de béton (groupe `blocs_`).
    zr = 0.38  # dessus de la bande
    T.convoyeur(lot, (0, -1.1, zr - 0.09), (0, -1.42, zr - 0.09), 0.44, 0.08, rouleaux=1, sg=sg)
    for sx in (-1, 1):
        lot.cube('acier_sombre', (0.05, 0.05, zr - 0.19), (sx * 0.27, -1.4, (zr - 0.19) / 2), 0)  # pieds
    bl = T.Lot(coll, 'blocs')
    for x in (-0.12, 0.12):
        bl.cube('beton', (0.2, 0.2, 0.14), (x, -1.3, zr + 0.07), 0.01 * bv)
        for dx in (-0.045, 0.045):
            bl.cube('pierre_sombre', (0.06, 0.12, 0.005), (x + dx, -1.3, zr + 0.142), 0)  # alvéoles
    T.pivot(coll, 'pivot_blocs', (0, -1.3, zr), (0, 1, 0))

    # --- Armoire électrique (avant droite) et câble vers le moteur.
    xa = 1.18
    T.box(coll, 'armoire', (0.42, 0.3, 0.9), (xa, -1.05, 0.59), 'acier', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.48, 0.36, 0.05), (xa, -1.05, 1.065), 'acier_sombre', bevel=0.01)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (xa - 0.12 + i * 0.08, -1.205, 0.92), 0)
    lot.cube('noir', (0.03, 0.06, 0.2), (xa + 0.15, -1.22, 0.7), 0, Matrix.Rotation(-0.4, 3, 'X'))
    lot.cube('jaune', (0.14, 0.01, 0.12), (xa, -1.203, 0.75), 0)
    lot.cube('acier_sombre', (0.36, 0.24, 0.14), (xa, -1.05, 0.07), 0)
    lot.barre('noir', (xa, -0.88, 0.16), (cm.x, cr.y, 0.16), 0.04, 0)

    # --- Palette de blocs finis (avant gauche).
    xs, ys = -1.12, -1.08
    for k in range(3):
        lot.cube('bois' if k % 2 == 0 else 'bois_sombre', (0.6, 0.1, 0.05), (xs, ys - 0.2 + k * 0.2, 0.025), 0)
    for k in range(3):
        lot.cube('bois_sombre', (0.1, 0.56, 0.05), (xs - 0.24 + k * 0.24, ys, 0.075), 0)
    lot.cube('bois', (0.62, 0.56, 0.03), (xs, ys, 0.115), 0)
    for i in range(2):
        for j in range(2):
            for k in range(2 if i + j < 2 else 1):
                x, y, z = xs - 0.14 + i * 0.28, ys - 0.13 + j * 0.26, 0.2 + k * 0.15
                lot.cube('beton', (0.25, 0.24, 0.14), (x, y, z), 0.01 * bv)
                for dx in (-0.055, 0.055):
                    lot.cube('pierre_sombre', (0.07, 0.15, 0.005), (x + dx, y, z + 0.071), 0)

    for l in (lot, tam, pg, ti, pr, bl):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def station_lavage_t2(coll, leger=True):
    """Station de lavage du minerai (électrique, alimentée en eau sous pression) : 3 x 3 cases, 2,6 unités max (1,3 m).
    Sortie devant (-Y), minerai brut amené par un convoyeur à l'arrière.

    Bassin de décantation en béton (eau, boue, écume, trop-plein). Au-dessus, un trommel presque horizontal : partie
    arrière fermée (débourbeur, cordons de soudure), partie avant en tôle perforée (crible), deux bandages ; il roule sur
    quatre galets dont deux sont moteurs (entraînement par friction : arbre, réducteur et moteur électrique à
    l'arrière droite). Réseau d'arrosage en tuyaux bleus (deux arceaux, rampe au-dessus et rampes sur les côtés) : buses et jets
    d'eau, eau qui ruisselle sous le crible.
    Derrière : convoyeur à bande à tasseaux qui monte tout droit le minerai brut du bord arrière (là où arrive le tapis
    du jeu) jusqu'au centre de l'ouverture du trommel. Devant : convoyeur de sortie qui part de l'intérieur du crible, chargé de minerai lavé.
    Arrivée d'eau à l'avant gauche (bride, vanne, manomètre) jusqu'à la rampe ; armoire électrique à l'avant droite.
    Pièces mobiles : `tambour_` (trommel et bandages) tourne autour de son axe ; `galets_` (deux galets moteurs et leur
    arbre) tournent en sens contraire, plus vite ; `bande_` (minerai et tasseaux de la bande) avance le long du
    convoyeur ; `jet_` et `ruissellement_` (eau) peuvent vaciller. Pivots `pivot_tambour`, `pivot_galets`,
    `pivot_bande`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(91)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    tam = T.Lot(coll, 'tambour')
    if leger:  # version web : aucune arête biseautée sur les petites pièces (beaucoup moins de triangles)
        for l_ in (lot, tam):
            l_.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(l_.cube)

    # --- Bassin de décantation en béton (x ±1,42 ; y -1,0 -> 1,0 ; z 0 -> 0,35), eau et boue.
    xb, yb0, yb1, hb, ep = 1.42, -1.0, 1.0, 0.35, 0.1
    T.box(coll, 'bassin_fond', (2 * xb, yb1 - yb0, 0.06), (0, (yb0 + yb1) / 2, 0.03), 'beton', bevel=0.02)
    for sx in (-1, 1):
        lot.cube('beton', (ep, yb1 - yb0, hb), (sx * (xb - ep / 2), (yb0 + yb1) / 2, hb / 2), 0.015)
    for y in (yb0 + ep / 2, yb1 - ep / 2):
        lot.cube('beton', (2 * xb - 2 * ep, ep, hb), (0, y, hb / 2), 0.015)
    for sx in (-1, 1):  # couronnement
        lot.cube('pierre', (ep + 0.04, yb1 - yb0 + 0.04, 0.04), (sx * (xb - ep / 2), (yb0 + yb1) / 2, hb + 0.02), 0)
    for y in (yb0 + ep / 2, yb1 - ep / 2):
        lot.cube('pierre', (2 * xb, ep + 0.04, 0.04), (0, y, hb + 0.02), 0)
    zo = 0.27  # niveau de l'eau
    T.box(coll, 'bassin_eau', (2 * xb - 2 * ep, yb1 - yb0 - 2 * ep, 0.02), (0, (yb0 + yb1) / 2, zo), 'eau')
    for _ in range(6 if leger else 12):  # nappes de boue
        w = rnd.uniform(0.25, 0.5)
        lot.cube('boue', (w, w * rnd.uniform(0.5, 0.9), 0.01), (rnd.uniform(-0.9, 0.9), rnd.uniform(-0.7, 0.7), zo + 0.012), 0,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    for k in range(3):  # écume
        lot.cube('blanc', (0.2, 0.2, 0.008), (rnd.uniform(-0.3, 0.3), -0.55 + k * 0.3, zo + 0.015), 0,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    # Trop-plein d'eau boueuse à droite.
    lot.cube('noir', (0.02, 0.3, 0.06), (xb + 0.002, 0.3, hb - 0.05), 0)
    lot.tube('acier_sombre', (xb - 0.02, 0.3, 0.28), (1.47, 0.3, 0.28), 0.05, sg)
    lot.tube('acier_sombre', (1.44, 0.3, 0.28), (1.44, 0.3, 0.05), 0.05, sg)
    lot.boule('acier_sombre', (1.44, 0.3, 0.28), 0.06)
    lot.cube('boue', (0.24, 0.3, 0.01), (1.36, 0.3, 0.005), 0)

    # --- Trommel (groupe `tambour_`) : axe de F (sortie, devant) à B (entrée, derrière), légèrement incliné.
    F, B = Vector((0, -0.8, 0.85)), Vector((0, 0.85, 1.0))
    d = (B - F).normalized()
    L = (B - F).length
    ex = Vector((1, 0, 0))
    u = d.cross(ex).normalized()
    if u.z < 0:
        u = -u
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    r3 = rot.to_3x3()

    def autour(s, r, a):
        return F + d * s + ex * (r * math.cos(a)) + u * (r * math.sin(a))

    def pose(o):
        o.matrix_basis = Matrix.Translation(F) @ rot
        return o

    rt = 0.52
    sm = L * 0.48  # limite crible (devant) / débourbeur (derrière)
    pose(T.tour(coll, 'tambour_crible', [(0.4, 0.0), (rt, 0.06), (rt, sm)], 'acier', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_debourbeur', [(rt + 0.01, sm), (rt + 0.01, L - 0.06), (0.4, L)], 'acier_sombre', seg,
                fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_sortie', [(0.41, -0.03), (0.41, 0.03)], 'acier_sombre', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_sortie_fond', [(0.38, 0.08), (0.38, 0.085)], 'noir', seg))
    pose(T.tour(coll, 'tambour_entree', [(0.41, L - 0.03), (0.41, L + 0.02)], 'acier_sombre', seg, fond=False, dessus=False))
    pose(T.tour(coll, 'tambour_entree_fond', [(0.38, L - 0.25), (0.38, L - 0.245)], 'noir', seg))
    sb = (0.3, L - 0.3)
    for s in sb:  # bandages
        pose(T.tour(coll, f'tambour_bandage_{s:.2f}', [(rt + 0.06, s - 0.05), (rt + 0.06, s + 0.05)], 'fonte', seg))
        pose(T.tour(coll, f'tambour_bandage_bord_{s:.2f}', [(rt + 0.03, s - 0.07), (rt + 0.03, s + 0.07)], 'acier_sombre',
                    seg))
    for s in (sm, sm + 0.01, L * 0.75):  # raidisseurs et cordons de soudure
        pose(T.tour(coll, f'tambour_cordon_{s:.2f}', [(rt + 0.02, s - 0.015), (rt + 0.02, s + 0.015)], 'fonte', seg))
    # Crible : tôle perforée (rangées de trous) entre la sortie et le débourbeur.
    n_a, n_s = (10, 3) if leger else (24, 7)
    for k in range(n_a):
        a = 2 * math.pi * (k + 0.5) / n_a
        for j in range(n_s):
            s = 0.42 + (sm - 0.5) * (j + 0.5) / n_s
            if abs(s - sb[0]) < 0.1:
                continue
            tam.cube('noir', (0.06, 0.006, 0.06), tuple(autour(s, rt + 0.002, a)), 0, r3 @ Matrix.Rotation(a - math.pi / 2, 3, 'Z'))
    for k in range(4):  # barres longitudinales du crible
        a = 2 * math.pi * k / 4 + math.pi / 4
        p0, p1 = autour(0.06, rt + 0.015, a), autour(sm, rt + 0.015, a)
        tam.cube('acier_sombre', (0.04, 0.03, (p1 - p0).length), tuple((p0 + p1) / 2), 0, r3 @ Matrix.Rotation(a - math.pi / 2, 3, 'Z'))
    if not leger:  # boulons des releveurs, sur le débourbeur
        for k in range(8):
            a = 2 * math.pi * k / 8
            for j in range(4):
                s = sm + 0.08 + j * (L - sm - 0.2) / 3
                tam.cube('acier', (0.025, 0.025, 0.025), tuple(autour(s, rt + 0.015, a)), 0, r3 @ Matrix.Rotation(a, 3, 'Z'))
    T.pivot(coll, 'pivot_tambour', tuple(F), tuple(d))

    # --- Galets : à gauche, folles ; à droite, deux galets moteurs sur un même arbre (groupe `galets_`).
    ga = T.Lot(coll, 'galets')
    rg = 0.09
    cg = {}
    for s in sb:
        for cote, a in ((1, math.radians(-90 + 42)), (-1, math.radians(-90 - 42))):
            c = autour(s, rt + 0.06 + rg, a)
            cg[(cote, s)] = c
            (ga if cote == 1 else lot).tube('acier', c - d * 0.06, c + d * 0.06, rg, sg)
            (ga if cote == 1 else lot).tube('acier_sombre', c - d * 0.07, c + d * 0.07, rg * 0.45, sg)  # moyeu
            for e in (-0.11, 0.11):  # paliers
                p = c + d * e
                lot.cube('fonte', (0.12, 0.06, 0.08), tuple(p), 0.01 * bv, r3)
                lot.cube('fonte', (0.1, 0.05, p.z - 0.06), (p.x, p.y, (p.z + 0.06) / 2), 0.01 * bv)
        lot.cube('acier_sombre', (1.0, 0.34, 0.05), (0, (F + d * s).y, 0.08), 0.01)  # semelle dans le bassin
    a0, a1 = cg[(1, sb[0])], cg[(1, sb[1])]
    ga.tube('acier', a0, a1 + d * 0.5, 0.03, 6)  # arbre moteur
    T.pivot(coll, 'pivot_galets', tuple(a0), tuple(d))
    cr = a1 + d * 0.32  # réducteur et moteur à l'arrière droite, derrière le bassin
    lot.cube('acier_sombre', (0.26, 0.22, 0.26), tuple(cr), 0.02, r3)
    cm = cr + d * 0.32
    lot.tube('bleu', cm - d * 0.16, cm + d * 0.16, 0.12, sg)
    for k in range(6 if leger else 10):
        a = 2 * math.pi * k / (6 if leger else 10)
        q = cm + ex * (0.125 * math.cos(a)) + u * (0.125 * math.sin(a))
        lot.cube('acier_sombre', (0.02, 0.02, 0.28), tuple(q), 0, r3 @ Matrix.Rotation(a, 3, 'Z'))
    lot.cube('acier_sombre', (0.09, 0.09, 0.07), tuple(cm + u * 0.15), 0)
    for p in (cr, cm):
        lot.cube('acier_sombre', (0.2, 0.18, p.z - 0.15), (p.x, p.y, (p.z - 0.15) / 2), 0.01 * bv)

    # --- Réseau d'arrosage en tuyaux bleus (il sert aussi de support) : deux arceaux autour du tambour, rampe au-dessus,
    # deux rampes sur les côtés ; jets d'eau en éventail (groupe `jet_`).
    xa, zr, zl = 0.75, 1.8, 1.0  # demi-largeur des arceaux, rampe du haut, rampes des côtés
    rt_ = 0.045
    st = 6 if leger else sg  # tuyaux à 6 pans en version web (plus léger)
    noeuds = []
    for ya in (-0.55, 0.45):  # arceaux, posés au fond du bassin
        arc = [Vector((-xa, ya, 0.06)), Vector((-xa, ya, zr)), Vector((xa, ya, zr)), Vector((xa, ya, 0.06))]
        for a, b in zip(arc, arc[1:]):
            lot.tube('bleu', a, b, rt_, st)
        noeuds += arc[1:3] + [Vector((0, ya, zr)), Vector((-xa, ya, zl)), Vector((xa, ya, zl))]
        for sx in (-1, 1):
            lot.cube('fonte', (0.16, 0.16, 0.03), (sx * xa, ya, 0.075), 0)  # platines
            lot.tube('fonte', (sx * xa, ya, 0.09), (sx * xa, ya, 0.14), rt_ * 1.35, st)
    lot.tube('bleu', (0, -0.78, zr), (0, 0.6, zr), rt_, st)  # rampe du haut
    for sx in (-1, 1):
        lot.tube('bleu', (sx * xa, -0.75, zl), (sx * xa, 0.6, zl), rt_, st)  # rampes des côtés
    for y in (-0.78, 0.6):
        lot.tube('acier_sombre', (0, y - 0.02, zr), (0, y + 0.02, zr), rt_ * 1.4, st)  # bouchons
    if not leger:
        for p in noeuds:
            lot.boule('bleu', p, rt_ * 1.3)  # coudes et tés
    # Jets du haut.
    for k in range(6):
        y = -0.7 + k * 1.2 / 5
        lot.cube('acier_sombre', (0.05, 0.05, 0.05), (0, y, zr - 0.06), 0)  # buse
        za = F.z + (y - F.y) * d.z / d.y + rt
        h = zr - 0.08 - za
        tmp = T.cylinder(coll, f'jet_{k}', 0.14, h, (0, y, za + h / 2), 'eau', segments=4, radius_top=0.015)
        for v in tmp.data.vertices:  # jet en éventail
            v.co.y = y + (v.co.y - y) * 0.35
    # Jets des côtés, vers le tambour.
    for sx in (-1, 1):
        for k in range(4):
            y = -0.62 + k * 1.05 / 3
            if abs(y - 0.45) < 0.08 or abs(y + 0.55) < 0.08:
                y += 0.1
            lot.cube('acier_sombre', (0.05, 0.05, 0.05), (sx * (xa - 0.06), y, zl), 0)  # buse
            zc = F.z + (y - F.y) * d.z / d.y
            xd = math.sqrt(max(rt ** 2 - (zl - zc) ** 2, 0)) + 0.01
            h = xa - 0.09 - xd
            tmp = T.cylinder(coll, f'jet_cote_{sx}_{k}', 0.11, h, (0, 0, 0), 'eau', segments=4, radius_top=0.012)
            for v in tmp.data.vertices:
                lx, ly, lz = v.co.x, v.co.y, v.co.z
                v.co.x = sx * (xd + h / 2 + lz)
                v.co.y = y + ly * 0.35
                v.co.z = zl + lx
    ru = T.Lot(coll, 'ruissellement')  # eau qui tombe du crible
    for k in range(5 if leger else 9):
        s = 0.45 + k * (sm - 0.55) / ((5 if leger else 9) - 1)
        x = rnd.uniform(-0.25, 0.25)
        p = F + d * s
        zb_ = p.z - math.sqrt(max(rt ** 2 - x * x, 0)) + 0.01
        ru.cube('eau', (0.02, 0.02, zb_ - zo), (x, p.y, (zb_ + zo) / 2), 0)

    # --- Arrivée d'eau (avant gauche) : bride, vanne, manomètre, conduite jusqu'à l'arceau avant.
    xw, yw = -1.24, -1.24
    lot.cube('fonte', (0.26, 0.26, 0.04), (xw, yw, 0.02), 0.01)
    eau = [Vector((xw, yw, 0.04)), Vector((xw, yw, 0.55)), Vector((-xa, yw, 0.55)), Vector((-xa, -0.55, 0.55))]
    for a, b in zip(eau, eau[1:]):
        lot.tube('bleu', a, b, 0.05, st)
    if not leger:
        for p in eau[1:]:
            lot.boule('bleu', p, 0.06)
    lot.tube('fonte', (xw, yw, 0.12), (xw, yw, 0.18), 0.08, sg)
    T.cylinder(coll, 'vanne_eau', 0.09, 0.03, (xw, yw, 0.42), 'rouge', segments=sg)
    lot.tube('acier', (xw, yw, 0.36), (xw, yw, 0.42), 0.015, 6)
    T.cylinder_at(coll, 'manometre', 0.07, 0.03, (xw, yw - 0.07, 0.3), 'acier_sombre', segments=sg, x=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.055, 0.01, (xw, yw - 0.09, 0.3), 'blanc', segments=sg, x=90)
    lot.cube('rouge', (0.01, 0.008, 0.05), (xw + 0.01, yw - 0.096, 0.32), 0)

    # --- Convoyeur à bande, derrière : une seule montée droite, du bord arrière jusqu'au centre de l'entrée du trommel
    # (le minerai tombe directement dans le tambour).
    wb, rp = 0.36, 0.08
    Q, H = Vector((0, 1.34, 0.35)), Vector((0, B.y - 0.07, B.z))  # tambours de queue et de tête
    dc = (H - Q).normalized()
    lc = (H - Q).length
    nc = Vector((0, 0, 1)) - dc * dc.z
    nc.normalize()  # normale à la bande, vers le haut
    rb = Matrix.Rotation(math.atan2(dc.z, -dc.y), 3, 'X').inverted()  # couche une pièce (longueur en Y) le long de la bande
    T.convoyeur(lot, Q, H, wb, rp, rouleaux=2 if leger else 3, sg=sg)  # convoyeur commun (voir terra.py)
    # Pieds sous le haut de la montée, posés sur le mur arrière du bassin, et chevalet à la queue.
    yp = yb1 - ep / 2
    pz = Q.z + (Q.y - yp) / (Q.y - H.y) * (H.z - Q.z)
    for sx in (-1, 1):
        x = sx * (wb / 2 + 0.05)
        lot.cube('acier', (0.06, 0.06, pz - 0.06 - hb), (x, yp, (pz - 0.06 + hb) / 2), 0.01 * bv)
        lot.cube('fonte', (0.12, 0.12, 0.02), (x, yp, hb + 0.05), 0)
    lot.cube('acier', (wb + 0.1, 0.05, 0.05), (0, yp, hb + 0.3), 0)
    # Caisson de chargement à la queue, posé au sol : il enferme le bas du convoyeur ; ouverture à l'arrière pour le
    # tapis du jeu. Moteur du convoyeur contre le flanc.
    xi = wb / 2 + 0.1  # demi-largeur intérieure (bande + longerons)
    ec, hc = 0.04, 0.66  # épaisseur des tôles, hauteur
    yf, yr = 1.08, 1.48  # face avant, face arrière
    for sx in (-1, 1):
        lot.cube('acier_sombre', (ec, yr - yf, hc), (sx * (xi + ec / 2), (yf + yr) / 2, hc / 2), 0.008)  # flancs
        for z in (0.2, 0.45):
            lot.cube('fonte', (0.015, yr - yf - 0.04, 0.03), (sx * (xi + ec + 0.007), (yf + yr) / 2, z), 0)  # raidisseurs
    lot.cube('acier_sombre', (2 * xi + 2 * ec, ec, 0.45), (0, yf + ec / 2, 0.225), 0.008)  # face avant (sous la bande)
    lo, ho = 0.42, 0.26  # ouverture d'entrée, à l'arrière
    lot.cube('acier_sombre', (2 * xi + 2 * ec, ec, hc - ho), (0, yr - ec / 2, (hc + ho) / 2), 0.008)  # au-dessus
    for sx in (-1, 1):
        w_ = xi + ec - lo / 2
        lot.cube('acier_sombre', (w_, ec, ho), (sx * (lo / 2 + w_ / 2), yr - ec / 2, ho / 2), 0.008)
    lot.cube('noir', (lo, 0.01, ho), (0, yr - ec - 0.02, ho / 2), 0)  # intérieur sombre
    lot.cube('jaune', (lo + 0.08, 0.02, 0.04), (0, yr + 0.005, ho + 0.02), 0)  # linteau
    for sx in (-1, 1):
        lot.cube('jaune', (0.04, 0.02, ho), (sx * (lo / 2 + 0.02), yr + 0.005, ho / 2), 0)
    for sx in (-1, 1):  # rebord haut (cadre ouvert)
        lot.cube('fonte', (0.06, yr - yf + 0.04, 0.03), (sx * (xi + ec / 2), (yf + yr) / 2, hc + 0.015), 0.005)
    lot.cube('fonte', (2 * xi + 2 * ec + 0.04, 0.06, 0.03), (0, yr - ec / 2, hc + 0.015), 0.005)
    lot.cube('fonte', (2 * xi + 2 * ec + 0.04, 0.06, 0.03), (0, yf + ec / 2, 0.465), 0.005)
    for _ in range(3):  # minerai visible dans le caisson
        t = rnd.uniform(0.06, 0.09)
        lot.cube(rnd.choice(('brique_sombre', 'boue')), (t, t, t * 0.8), (rnd.uniform(-0.15, 0.15), rnd.uniform(1.3, 1.42), Q.z + rp + 0.04),
                 0, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    xm = -(xi + ec)
    lot.cube('acier_sombre', (0.14, 0.18, 0.18), (xm - 0.07, Q.y, Q.z), 0.015)  # réducteur
    lot.tube('bleu', (xm - 0.14, Q.y, Q.z), (xm - 0.34, Q.y, Q.z), 0.08, sg)  # moteur
    lot.cube('acier_sombre', (0.3, 0.16, 0.04), (xm - 0.18, Q.y, Q.z - 0.1), 0)
    lot.cube('acier_sombre', (0.04, 0.12, Q.z - 0.12), (xm - 0.3, Q.y, (Q.z - 0.12) / 2), 0)
    # Tasseaux et minerai brut sur la bande (groupe `bande_`).
    ba = T.Lot(coll, 'bande')
    n_t = 5 if leger else 7
    for k in range(n_t):
        f = 0.12 + k * 0.78 / (n_t - 1)
        p = Q + dc * (lc * f) + nc * (rp + 0.03)
        ba.cube('noir', (wb - 0.04, 0.03, 0.05), tuple(p), 0, rb)
        if k < n_t - 1:
            q = Q + dc * (lc * (f + 0.39 / (n_t - 1))) + nc * (rp + 0.04)
            for j_ in range(2):
                t = rnd.uniform(0.05, 0.08)
                ba.cube(rnd.choice(('brique_sombre', 'boue', 'pierre')), (t, t, t * 0.8),
                        tuple(q + Vector((rnd.uniform(-0.1, 0.1), 0, 0))), 0, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    T.pivot(coll, 'pivot_bande', tuple(Q + nc * rp), tuple(dc))

    # --- Convoyeur de sortie (devant) : il part de l'intérieur du crible, sous la bouche du trommel, et descend
    # doucement jusqu'au bord avant, chargé de minerai lavé (groupe `sortie_`).
    S0, S1 = Vector((0, F.y + 0.16, 0.62)), Vector((0, -1.4, 0.34))
    ds, ws, ns, rs = T.convoyeur(lot, S0, S1, wb, rp, rouleaux=2 if leger else 3, sg=sg)
    ls = (S1 - S0).length
    for sx in (-1, 1):  # pieds : sur le mur avant du bassin et au sol, au bout
        for y in (yb0 + ep / 2, S1.y + 0.04):
            z = S0.z + (S1.z - S0.z) * (y - S0.y) / (S1.y - S0.y) - rp - 0.02
            z0 = hb + 0.04 if y > yb0 else 0.0
            lot.cube('acier', (0.05, 0.05, z - z0), (sx * (wb / 2 + 0.05), y, (z + z0) / 2), 0)
            lot.cube('fonte', (0.1, 0.1, 0.02), (sx * (wb / 2 + 0.05), y, z0 + 0.01), 0)
    so = T.Lot(coll, 'sortie')
    for k in range(5 if leger else 9):
        t = rnd.uniform(0.05, 0.08)
        p = S0 + ds * (ls * (0.3 + 0.62 * k / (4 if leger else 8))) + ns * (rp + 0.04) + ws * rnd.uniform(-0.12, 0.12)
        so.cube(rnd.choice(('cuivre', 'acier', 'pierre_claire', 'gris_clair')), (t, t, t * 0.8), tuple(p), 0,
                Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    T.pivot(coll, 'pivot_sortie', tuple(S0 + ns * rp), tuple(ds))
    for k in range(3):  # gouttes qui tombent de la bande dans le bassin
        lot.cube('eau', (0.015, 0.015, 0.1), (-0.12 + k * 0.12, -0.9, zo + 0.08), 0)

    # --- Armoire électrique (avant droite), câbles vers les moteurs.
    xa = 1.15
    T.box(coll, 'armoire', (0.42, 0.28, 0.85), (xa, -1.24, 0.425), 'acier', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.48, 0.34, 0.05), (xa, -1.24, 0.875), 'acier_sombre', bevel=0.01)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.05, 0.02, 0.05), (xa - 0.12 + i * 0.08, -1.385, 0.72), 0)
    lot.cube('noir', (0.03, 0.06, 0.2), (xa + 0.15, -1.4, 0.5), 0, Matrix.Rotation(-0.4, 3, 'X'))
    lot.cube('jaune', (0.14, 0.01, 0.12), (xa, -1.383, 0.55), 0)
    lot.barre('noir', (xa, -1.1, 0.1), (xa, -1.03, 0.1), 0.035, 0)
    lot.barre('noir', (xb + 0.03, -1.03, 0.1), (xb + 0.03, 1.08, 0.1), 0.035, 0)  # le long du bassin
    lot.barre('noir', (xa, -1.03, 0.1), (xb + 0.03, -1.03, 0.1), 0.035, 0)
    lot.barre('noir', (xb + 0.03, 1.08, 0.1), (cm.x, 1.08, 0.1), 0.035, 0)

    for l in (lot, tam, ga, ba, ru, so):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def constructeur_t2(coll, leger=True):
    """Constructeur (électrique, refroidi à l'eau) : 3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y).

    Cellule de fabrication à portique : bâti carrossé (portes, ouïes, bandes de sécurité), table de travail à rainures
    avec une pièce en laiton en cours (tube coudé). Au-dessus, un portique jaune roule sur deux rails (axe Y) ; un
    chariot roule sur la poutre (axe X) et porte la tête d'outil (broche, moteur, torche, étincelles) qui monte et
    descend. Convoyeur d'entrée derrière (lingots de cuivre et de zinc) et convoyeur de sortie devant (tubes en laiton),
    par des trappes du bâti. À droite : groupe de refroidissement (radiateur, ventilateur, tuyaux aller et retour,
    arrivée d'eau avec vanne et manomètre). À gauche : pupitre de commande devant, armoire électrique derrière, colonne
    lumineuse sur le bâti.
    Pièces mobiles : `portique_` (va-et-vient en Y), `chariot_` (va-et-vient en X, porté par le portique), `outil_`
    (monte et descend, porté par le chariot), `ventilateur_` (tourne), `entree_` et `sortie_` (marchandises sur les
    convoyeurs). Pivots `pivot_portique`, `pivot_chariot`, `pivot_outil`, `pivot_ventilateur`, `pivot_entree`,
    `pivot_sortie`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(55)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    if leger:  # version web : pas de biseau sur les petites pièces
        lot.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(lot.cube)

    # --- Bâti carrossé (x ±0,95 ; y -0,75 -> 0,95 ; z 0 -> 0,72).
    xb, yb0, yb1, zb = 0.95, -0.75, 0.95, 0.72
    yc_ = (yb0 + yb1) / 2
    T.box(coll, 'bati', (2 * xb, yb1 - yb0, zb - 0.12), (0, yc_, (zb + 0.12) / 2), 'gris_clair', bevel=0.02)
    T.box(coll, 'bati_socle', (2 * xb + 0.04, yb1 - yb0 + 0.04, 0.12), (0, yc_, 0.06), 'acier_sombre', bevel=0.01)
    for sx in (-1, 1):
        for y in (yb0 + 0.1, yb1 - 0.1):
            lot.cube('noir', (0.1, 0.1, 0.03), (sx * (xb - 0.1), y, 0.015), 0)  # vérins de calage
    T.box(coll, 'bati_bandeau', (2 * xb + 0.01, yb1 - yb0 + 0.01, 0.05), (0, yc_, zb - 0.05), 'bleu', bevel=0.005)
    for k in range(14):  # bande de sécurité jaune et noire sur le socle, devant
        lot.cube('jaune' if k % 2 == 0 else 'noir', (2 * xb / 14, 0.01, 0.05), (-xb + (k + 0.5) * 2 * xb / 14, yb0 - 0.025, 0.08), 0)
    for sx in (-1, 1):  # portes en façade, de part et d'autre de la trappe de sortie
        x = sx * 0.6
        lot.cube('acier', (0.6, 0.015, 0.4), (x, yb0 - 0.008, 0.38), 0)
        lot.cube('acier_sombre', (0.03, 0.03, 0.14), (x - sx * 0.24, yb0 - 0.025, 0.4), 0)  # poignée
        for k in range(4):  # ouïes d'aération
            lot.cube('noir', (0.3, 0.01, 0.02), (x, yb0 - 0.018, 0.28 + k * 0.05), 0)
    for sx in (-1, 1):  # ouïes sur les côtés
        for k in range(5):
            lot.cube('noir', (0.01, 0.6, 0.025), (sx * (xb + 0.005), yc_ - 0.2, 0.3 + k * 0.06), 0)

    # --- Table de travail à rainures et pièce en cours (tube de laiton coudé).
    T.box(coll, 'table', (1.3, 1.2, 0.06), (0, 0.1, zb + 0.03), 'fonte', bevel=0.01)
    for k in range(5):
        lot.cube('noir', (1.26, 0.02, 0.005), (0, -0.35 + k * 0.22, zb + 0.062), 0)
    lot.cube('acier_sombre', (0.24, 0.16, 0.1), (-0.25, 0.0, zb + 0.11), 0.01)  # étau
    lot.cube('acier_sombre', (0.24, 0.04, 0.12), (-0.25, -0.1, zb + 0.12), 0)
    p0, p1, p2 = Vector((-0.45, 0.0, zb + 0.13)), Vector((0.1, 0.0, zb + 0.13)), Vector((0.1, 0.35, zb + 0.13))
    lot.tube('orange', p0, p1, 0.035, sg)
    lot.tube('orange', p1, p2, 0.035, sg)
    lot.boule('orange', p1, 0.04)

    # --- Rails et portique (groupe `portique_`), chariot (`chariot_`), tête d'outil (`outil_`).
    xr, zr = 0.86, zb + 0.06
    for sx in (-1, 1):
        lot.cube('acier_sombre', (0.1, yb1 - yb0 - 0.06, 0.06), (sx * xr, yc_, zr + 0.03), 0)
        lot.cube('acier', (0.04, yb1 - yb0 - 0.06, 0.03), (sx * xr, yc_, zr + 0.075), 0)
        for y in (yb0 + 0.05, yb1 - 0.05):
            lot.cube('noir', (0.12, 0.04, 0.1), (sx * xr, y, zr + 0.05), 0)  # butées
    po = T.Lot(coll, 'portique')
    yg, zp = 0.15, 1.42  # position du portique, axe de la poutre
    for sx in (-1, 1):
        po.cube('acier_sombre', (0.16, 0.24, 0.08), (sx * xr, yg, zr + 0.13), 0)  # patins
        po.cube('jaune', (0.12, 0.18, zp - zr - 0.17), (sx * xr, yg, (zp + zr + 0.17) / 2), 0)  # montants
        po.cube('noir', (0.13, 0.02, 0.3), (sx * xr, yg - 0.1, zr + 0.4), 0)
    po.cube('jaune', (2 * xr + 0.16, 0.2, 0.16), (0, yg, zp), 0)  # poutre
    po.cube('acier', (2 * xr - 0.1, 0.03, 0.03), (0, yg - 0.11, zp + 0.04), 0)  # rail du chariot
    po.cube('noir', (2 * xr - 0.2, 0.08, 0.05), (0, yg + 0.04, zp + 0.105), 0)  # chaîne porte-câbles
    T.pivot(coll, 'pivot_portique', (0, yg, zr), (0, 1, 0))
    ch = T.Lot(coll, 'chariot')
    xc = 0.1
    ch.cube('acier_sombre', (0.26, 0.12, 0.3), (xc, yg - 0.17, zp), 0)
    ch.tube('bleu', (xc, yg - 0.17, zp + 0.15), (xc, yg - 0.17, zp + 0.36), 0.08, sg)  # moteur de broche
    ch.cube('acier_sombre', (0.12, 0.1, 0.06), (xc, yg - 0.17, zp + 0.39), 0)
    T.pivot(coll, 'pivot_chariot', (xc, yg - 0.17, zp), (1, 0, 0))
    ou = T.Lot(coll, 'outil')
    zo = zp - 0.15
    ou.tube('acier', (xc, yg - 0.17, zo), (xc, yg - 0.17, zb + 0.32), 0.035, sg)  # broche
    ou.tube('acier_sombre', (xc, yg - 0.17, zb + 0.34), (xc, yg - 0.17, zb + 0.28), 0.06, sg)  # porte-outil
    ou.tube('cuivre', (xc, yg - 0.17, zb + 0.28), (xc, yg - 0.17, zb + 0.2), 0.025, 6)  # torche
    ou.boule('flamme', (xc, yg - 0.17, zb + 0.185), 0.025)
    for _ in range(6 if leger else 12):  # étincelles
        a, r = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.04, 0.15)
        t = rnd.uniform(0.012, 0.022)
        ou.cube(rnd.choice(('flamme', 'braise')), (t, t, t), (xc + r * math.cos(a), yg - 0.17 + r * math.sin(a), zb + 0.15 + rnd.uniform(0, 0.08)), 0)
    T.pivot(coll, 'pivot_outil', (xc, yg - 0.17, zb + 0.18), (0, 0, 1))

    # --- Convoyeurs (convoyeur commun) : entrée derrière (lingots), sortie devant (tubes en laiton), par des trappes.
    wb, rp = 0.36, 0.08
    for y, z in ((yb1 + 0.005, 0.4), (yb0 - 0.005, 0.32)):
        lot.cube('noir', (0.5, 0.01, 0.3), (0, y, z + 0.1), 0)  # trappes
        lot.cube('jaune', (0.58, 0.02, 0.04), (0, y + (0.005 if y > 0 else -0.005), z + 0.27), 0)
    E0, E1 = Vector((0, 1.42, 0.3)), Vector((0, yb1 - 0.05, 0.46))
    de, we, ne, re_ = T.convoyeur(lot, E0, E1, wb, rp, rouleaux=2, sg=sg)
    S0, S1 = Vector((0, yb0 + 0.05, 0.38)), Vector((0, -1.42, 0.3))
    ds, ws, ns, _ = T.convoyeur(lot, S0, S1, wb, rp, rouleaux=2, sg=sg)
    for sx in (-1, 1):  # pieds
        for p in (E0, S1):
            lot.cube('acier', (0.05, 0.05, p.z - rp - 0.02), (sx * (wb / 2 + 0.05), p.y, (p.z - rp - 0.02) / 2), 0)
    en = T.Lot(coll, 'entree')
    le = (E1 - E0).length
    for k in range(3):
        p = E0 + de * (le * (0.22 + 0.27 * k)) + ne * (rp + 0.04)
        en.cube('cuivre' if k % 2 == 0 else 'gris_clair', (0.16, 0.1, 0.06), tuple(p), 0, re_)  # lingots
        en.cube('cuivre' if k % 2 == 0 else 'gris_clair', (0.12, 0.07, 0.03), tuple(p + ne * 0.04), 0, re_)
    T.pivot(coll, 'pivot_entree', tuple(E0 + ne * rp), tuple(de))
    so = T.Lot(coll, 'sortie')
    ls = (S1 - S0).length
    for k in range(2):
        p = S0 + ds * (ls * (0.3 + 0.4 * k)) + ns * (rp + 0.04)
        a = p + Vector((-0.12, 0, 0))
        b = p + Vector((0.08, 0, 0))
        c = b + ds * 0.14
        so.tube('orange', a, b, 0.03, sg)
        so.tube('orange', b, c, 0.03, sg)
        so.boule('orange', b, 0.034)
    T.pivot(coll, 'pivot_sortie', tuple(S0 + ns * rp), tuple(ds))

    # --- Groupe de refroidissement (droite) : radiateur, ventilateur (groupe `ventilateur_`), tuyaux, arrivée d'eau.
    xf, yf, zf = 1.23, 0.15, 0.5
    T.box(coll, 'refroidisseur', (0.42, 0.95, 0.9), (xf, yf, 0.45), 'acier', bevel=0.02)
    T.box(coll, 'refroidisseur_toit', (0.46, 0.99, 0.04), (xf, yf, 0.92), 'acier_sombre', bevel=0.01)
    T.cylinder_at(coll, 'ventilateur_cadre', 0.3, 0.04, (xf + 0.21, yf, zf), 'acier_sombre', segments=seg, y=90)
    T.cylinder_at(coll, 'ventilateur_fond', 0.27, 0.01, (xf + 0.225, yf, zf), 'noir', segments=seg, y=90)
    ve = T.Lot(coll, 'ventilateur')
    for k in range(5):
        a = 2 * math.pi * k / 5
        ve.cube('gris_clair', (0.015, 0.09, 0.24), (xf + 0.235, yf + 0.13 * math.cos(a), zf + 0.13 * math.sin(a)), 0,
                Matrix.Rotation(a - math.pi / 2, 3, 'X') @ Matrix.Rotation(0.4, 3, 'Z'))
    ve.tube('acier_sombre', (xf + 0.225, yf, zf), (xf + 0.26, yf, zf), 0.05, sg)
    T.pivot(coll, 'pivot_ventilateur', (xf + 0.235, yf, zf), (1, 0, 0))
    for k in range(5):  # grille de protection
        lot.cube('acier_sombre', (0.01, 0.6, 0.012), (xf + 0.262, yf, zf - 0.24 + k * 0.12), 0)
    for k in range(4):  # ailettes du radiateur, devant et derrière le ventilateur
        for y in (yf - 0.4, yf + 0.4):
            lot.cube('noir', (0.01, 0.12, 0.6), (xf + 0.215, y + (k - 1.5) * 0.025, 0.5), 0)
    for k, (mat, z) in enumerate((('bleu', 0.62), ('rouge', 0.5))):  # aller et retour vers le bâti
        pts = [Vector((xf - 0.21, yf - 0.3 + k * 0.12, z)), Vector((xb + 0.01, yf - 0.3 + k * 0.12, z))]
        lot.tube(mat, pts[0], pts[1], 0.035, sg)
        lot.tube('fonte', pts[1] - Vector((0.02, 0, 0)), pts[1] + Vector((0.02, 0, 0)), 0.05, sg)
    ww = [Vector((1.3, 1.36, 0.04)), Vector((1.3, 1.36, 0.6)), Vector((1.3, yf + 0.48, 0.6))]  # arrivée d'eau
    for a, b in zip(ww, ww[1:]):
        lot.tube('bleu', a, b, 0.045, sg)
    if not leger:
        lot.boule('bleu', ww[1], 0.055)
    lot.cube('fonte', (0.2, 0.2, 0.04), (1.3, 1.36, 0.02), 0)
    lot.tube('fonte', (1.3, 1.36, 0.1), (1.3, 1.36, 0.15), 0.07, sg)
    T.cylinder(coll, 'vanne_eau', 0.08, 0.03, (1.3, 1.36, 0.4), 'rouge', segments=sg)
    T.cylinder_at(coll, 'manometre', 0.06, 0.03, (1.37, 1.36, 0.28), 'acier_sombre', segments=sg, y=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.048, 0.01, (1.39, 1.36, 0.28), 'blanc', segments=sg, y=90)

    # --- Gauche : pupitre de commande (devant), armoire électrique (derrière), colonne lumineuse.
    xp, yp = -1.2, -0.95
    lot.cube('acier', (0.42, 0.36, 0.7), (xp, yp, 0.35), 0.015)
    pente = Matrix.Rotation(math.radians(-30), 3, 'X')
    lot.cube('acier_sombre', (0.44, 0.38, 0.05), (xp, yp - 0.02, 0.75), 0.01, pente)
    lot.cube('panneau', (0.2, 0.14, 0.01), (xp - 0.08, yp - 0.03, 0.785), 0, pente)  # écran
    lot.cube('cyan', (0.16, 0.08, 0.005), (xp - 0.08, yp - 0.03, 0.791), 0, pente)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.035, 0.035, 0.02), (xp + 0.09 + (i % 2) * 0.05, yp - 0.06 + (i // 2) * 0.06, 0.78), 0, pente)
    lot.cube('rouge', (0.06, 0.06, 0.03), (xp + 0.14, yp + 0.06, 0.82), 0, pente)  # arrêt d'urgence
    xa, ya = -1.2, 0.85
    T.box(coll, 'armoire', (0.42, 0.34, 1.1), (xa, ya, 0.55), 'acier', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.48, 0.4, 0.05), (xa, ya, 1.125), 'acier_sombre', bevel=0.01)
    lot.cube('acier_sombre', (0.01, 0.01, 0.95), (xa + 0.211, ya, 0.55), 0)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.02, 0.05, 0.05), (xa + 0.215, ya - 0.08 + i * 0.08, 0.95), 0)
    lot.cube('jaune', (0.01, 0.14, 0.12), (xa + 0.213, ya, 0.75), 0)
    lot.barre('noir', (xa + 0.1, ya - 0.17, 0.08), (-xb - 0.01, ya - 0.2, 0.08), 0.04, 0)  # câble vers le bâti
    lot.barre('noir', (xp + 0.1, yp + 0.18, 0.06), (-xb - 0.01, yb0 + 0.15, 0.06), 0.035, 0)
    xt, yt = -xb + 0.1, yb1 - 0.1  # colonne lumineuse
    lot.tube('acier_sombre', (xt, yt, zb), (xt, yt, zb + 0.35), 0.02, 6)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.tube(c, (xt, yt, zb + 0.35 + i * 0.07), (xt, yt, zb + 0.41 + i * 0.07), 0.04, sg)
    lot.tube('acier_sombre', (xt, yt, zb + 0.56), (xt, yt, zb + 0.58), 0.04, sg)

    for l in (lot, po, ch, ou, en, so, ve):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def presse_lourde_t3(coll, leger=True):
    """Presse hydraulique lourde T3 (électrique, 150 kW) : 3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y).

    Grosse presse à bâti en H peint en bleu nuit : deux flasques ajourées, sommier en bas, couronne en haut tenue par
    quatre tirants à écrous ; vérin principal sur la couronne. Coulisseau guidé entre les flasques (outil du haut),
    table et outil du bas avec un tube d'acier en cours de formage. Barrières immatérielles jaunes devant la zone de
    travail. Convoyeurs communs : lingots d'acier derrière, tubes d'acier devant. À droite : centrale hydraulique (bâche
    à huile, moteur électrique et pompe, refroidisseur à ventilateur, deux accumulateurs, flexibles qui montent au
    vérin). À gauche : armoire de commande à écran tactile et colonne lumineuse, pupitre de commande bimanuelle devant.
    Pièces mobiles : `coulisseau_` (coulisseau, outil du haut, tige du vérin) descend et remonte ; `ventilateur_`
    (refroidisseur d'huile) tourne ; `entree_` et `sortie_` (lingots et tubes sur les convoyeurs). Pivots
    `pivot_coulisseau`, `pivot_ventilateur`, `pivot_entree`, `pivot_sortie`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(31)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    if leger:
        lot.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(lot.cube)

    cadre = 'panneau'
    xf, ef, yf = 0.72, 0.22, 0.55  # flasques : position, épaisseur, demi-profondeur
    zc0, zc1 = 2.0, 2.42  # couronne
    zs = 0.75  # dessus du sommier
    # --- Flasques ajourées, sommier, couronne, tirants.
    for sx in (-1, 1):
        x = sx * xf
        T.box(coll, f'flasque_{sx}', (ef, 2 * yf, zc0), (x, 0, zc0 / 2), cadre, bevel=0.02)
        lot.cube('noir', (ef + 0.004, 0.5, 0.55), (x, 0, 1.45), 0)  # fenêtre de la flasque
        lot.cube('gris_clair', (ef + 0.01, 2 * yf + 0.01, 0.04), (x, 0, 0.1), 0)  # liseré
        for y in (-yf + 0.08, yf - 0.08):
            lot.cube('acier', (0.05, 0.05, zc0 - zs - 0.1), (x - sx * (ef / 2 + 0.02), y * 0.8, (zc0 + zs) / 2), 0)  # glissières
        lot.cube('jaune', (0.01, 0.3, 0.12), (x + sx * (ef / 2 + 0.003), 0, 1.0), 0)  # plaque de charge
        for k in range(4):
            lot.cube('noir', (0.012, 0.05, 0.12), (x + sx * (ef / 2 + 0.006), -0.11 + k * 0.073, 1.0), 0)
    T.box(coll, 'sommier', (2 * xf - ef, 2 * yf, zs), (0, 0, zs / 2), cadre, bevel=0.02)
    T.box(coll, 'couronne', (2 * xf + ef + 0.12, 2 * yf + 0.1, zc1 - zc0), (0, 0, (zc0 + zc1) / 2), cadre, bevel=0.03)
    lot.cube('gris_clair', (2 * xf + ef + 0.13, 2 * yf + 0.11, 0.04), (0, 0, zc1 - 0.08), 0)
    lot.cube('jaune', (0.9, 0.012, 0.14), (0, -yf - 0.056, (zc0 + zc1) / 2), 0)  # plaque du constructeur
    lot.cube('noir', (0.7, 0.014, 0.06), (0, -yf - 0.058, (zc0 + zc1) / 2), 0)
    for sx in (-1, 1):  # tirants et écrous
        for sy in (-1, 1):
            p = (sx * (xf + 0.04), sy * (yf - 0.08))
            lot.tube('acier', (p[0], p[1], zc1), (p[0], p[1], 2.53), 0.045, sg)
            lot.cube('acier_sombre', (0.13, 0.13, 0.07), (p[0], p[1], zc1 + 0.035), 0)
            lot.cube('acier_sombre', (0.11, 0.11, 0.06), (p[0], p[1], 2.5), 0)
    # Vérin principal sur la couronne.
    T.cylinder(coll, 'verin', 0.3, 0.1, (0, 0, zc1 + 0.05), 'acier', segments=seg)
    T.cylinder(coll, 'verin_tete', 0.24, 0.06, (0, 0, zc1 + 0.13), 'acier_sombre', segments=seg)
    for a in range(6 if leger else 10):
        t = 2 * math.pi * a / (6 if leger else 10)
        lot.cube('acier_sombre', (0.04, 0.04, 0.04), (0.27 * math.cos(t), 0.27 * math.sin(t), zc1 + 0.12), 0)

    # --- Table, outil du bas, tube en cours de formage.
    lot.cube('acier_sombre', (1.1, 0.95, 0.08), (0, 0, zs + 0.04), 0.01)
    for k in range(3):
        lot.cube('noir', (1.06, 0.03, 0.005), (0, -0.3 + k * 0.3, zs + 0.081), 0)
    lot.cube('fonte', (0.7, 0.6, 0.12), (0, 0, zs + 0.14), 0.01)  # outil du bas
    lot.cube('noir', (0.18, 0.62, 0.02), (0, 0, zs + 0.195), 0)  # gorge
    lot.tube('gris_clair', (0, -0.3, zs + 0.24), (0, 0.3, zs + 0.24), 0.07, sg)  # tube en cours
    # --- Coulisseau (groupe `coulisseau_`) : tige du vérin, coulisseau, outil du haut.
    co = T.Lot(coll, 'coulisseau')
    zk = 1.42
    co.tube('acier', (0, 0, zc0 + 0.02), (0, 0, zk + 0.2), 0.17, seg)  # tige
    co.cube('gris_clair', (2 * xf - ef - 0.04, 0.8, 0.36), (0, 0, zk), 0.02)  # coulisseau
    co.cube('jaune', (2 * xf - ef - 0.03, 0.012, 0.06), (0, -0.405, zk + 0.1), 0)
    for k in range(6):
        co.cube('noir', (0.06, 0.014, 0.06), (-0.4 + k * 0.16, -0.406, zk + 0.1), 0)
    co.cube('acier_sombre', (0.7, 0.6, 0.12), (0, 0, zk - 0.24), 0.01)  # outil du haut
    co.cube('fonte', (0.18, 0.6, 0.04), (0, 0, zk - 0.32), 0)
    T.pivot(coll, 'pivot_coulisseau', (0, 0, zk - 0.34), (0, 0, 1))
    # Barrières immatérielles devant la zone de travail.
    for sx in (-1, 1):
        x = sx * (xf - ef / 2 - 0.06)
        lot.cube('jaune', (0.05, 0.05, 0.9), (x, -yf - 0.03, zs + 0.55), 0)
        for k in range(5):
            lot.cube('rouge' if sx < 0 else 'cyan', (0.012, 0.01, 0.02), (x - sx * 0.026, -yf - 0.055, zs + 0.2 + k * 0.17), 0)

    # --- Convoyeurs communs : lingots d'acier derrière, tubes d'acier devant.
    wb, rp = 0.36, 0.08
    E0, E1 = Vector((0, 1.42, 0.3)), Vector((0, yf + 0.06, zs + 0.06))
    de, we, ne, re_ = T.convoyeur(lot, E0, E1, wb, rp, rouleaux=2, sg=sg)
    S0, S1 = Vector((0, -yf - 0.06, zs + 0.06)), Vector((0, -1.42, 0.3))
    ds, ws, ns, rs = T.convoyeur(lot, S0, S1, wb, rp, rouleaux=2, sg=sg)
    for sx in (-1, 1):
        for p in (E0, S1):
            lot.cube('acier', (0.05, 0.05, p.z - rp - 0.02), (sx * (wb / 2 + 0.05), p.y, (p.z - rp - 0.02) / 2), 0)
    en = T.Lot(coll, 'entree')
    le = (E1 - E0).length
    for k in range(2):
        p = E0 + de * (le * (0.3 + 0.38 * k)) + ne * (rp + 0.045)
        en.cube('acier', (0.2, 0.12, 0.07), tuple(p), 0, re_)
        en.cube('acier', (0.15, 0.09, 0.03), tuple(p + ne * 0.045), 0, re_)
    T.pivot(coll, 'pivot_entree', tuple(E0 + ne * rp), tuple(de))
    so = T.Lot(coll, 'sortie')
    ls = (S1 - S0).length
    for k in range(2):
        p = S0 + ds * (ls * (0.3 + 0.4 * k)) + ns * (rp + 0.05)
        so.tube('gris_clair', p - ws * 0.14, p + ws * 0.14, 0.05, sg)
        so.tube('noir', p - ws * 0.145, p - ws * 0.14, 0.035, sg)
    T.pivot(coll, 'pivot_sortie', tuple(S0 + ns * rp), tuple(ds))

    # --- Centrale hydraulique (droite) : bâche, moteur et pompe, refroidisseur, accumulateurs, flexibles.
    xh = 1.2
    T.box(coll, 'bache', (0.5, 1.15, 0.5), (xh, 0.3, 0.25), 'gris_clair', bevel=0.02)
    lot.cube('acier_sombre', (0.52, 1.17, 0.04), (xh, 0.3, 0.52), 0.005)
    lot.cube('jaune', (0.01, 0.2, 0.12), (xh + 0.252, 0.6, 0.3), 0)  # niveau d'huile
    lot.cube('orange', (0.012, 0.03, 0.08), (xh + 0.255, 0.6, 0.29), 0)
    lot.tube('bleu', (xh, -0.1, 0.72), (xh, 0.4, 0.72), 0.16, sg)  # moteur
    for k in range(6 if leger else 10):
        a = 2 * math.pi * k / (6 if leger else 10)
        lot.cube('acier_sombre', (0.02, 0.48, 0.02), (xh + 0.165 * math.cos(a), 0.15, 0.72 + 0.165 * math.sin(a)), 0)
    lot.cube('bleu', (0.3, 0.4, 0.04), (xh, 0.15, 0.56), 0)
    lot.tube('acier_sombre', (xh, 0.4, 0.72), (xh, 0.5, 0.72), 0.1, sg)  # accouplement
    lot.cube('acier_sombre', (0.22, 0.2, 0.22), (xh, 0.62, 0.68), 0.015)  # pompe
    lot.cube('acier_sombre', (0.12, 0.12, 0.07), (xh, -0.1, 0.92), 0)
    # Refroidisseur d'huile à ventilateur (derrière), groupe `ventilateur_`.
    yv, zv = 1.12, 0.62
    lot.cube('acier', (0.5, 0.2, 0.62), (xh, yv, 0.31), 0.015)
    T.cylinder_at(coll, 'ventilateur_cadre', 0.21, 0.04, (xh, yv + 0.1, zv - 0.25), 'acier_sombre', segments=seg, x=90)
    ve = T.Lot(coll, 'ventilateur')
    for k in range(5):
        a = 2 * math.pi * k / 5
        ve.cube('gris_clair', (0.07, 0.012, 0.17), (xh + 0.09 * math.cos(a), yv + 0.125, zv - 0.25 + 0.09 * math.sin(a)), 0,
                Matrix.Rotation(-a + math.pi / 2, 3, 'Y') @ Matrix.Rotation(0.4, 3, 'Z'))
    ve.tube('acier_sombre', (xh, yv + 0.11, zv - 0.25), (xh, yv + 0.14, zv - 0.25), 0.04, sg)
    T.pivot(coll, 'pivot_ventilateur', (xh, yv + 0.125, zv - 0.25), (0, 1, 0))
    for k in range(4):
        lot.cube('acier_sombre', (0.42, 0.01, 0.012), (xh, yv + 0.15, zv - 0.4 + k * 0.1), 0)
    # Accumulateurs (devant la bâche).
    for k, y in enumerate((-0.55, -0.85)):
        T.cylinder(coll, f'accumulateur_{k}', 0.11, 0.8, (xh + 0.05, y, 0.45), 'rouge', segments=sg)
        T.cylinder(coll, f'accumulateur_dome_{k}', 0.11, 0.06, (xh + 0.05, y, 0.88), 'rouge', segments=sg, radius_top=0.05)
        lot.tube('acier', (xh + 0.05, y, 0.91), (xh + 0.05, y, 0.97), 0.025, 6)
        lot.cube('acier_sombre', (0.28, 0.28, 0.05), (xh + 0.05, y, 0.025), 0)
    # Raccordement des accumulateurs : collecteur au-dessus des bouteilles, bloc de distribution sur la bâche, tuyau
    # jusqu'à la pompe.
    xq, zq = xh + 0.05, 1.05
    for y in (-0.55, -0.85):
        lot.tube('acier', (xq, y, 0.97), (xq, y, zq), 0.022, 6)
        lot.cube('rouge', (0.05, 0.05, 0.04), (xq, y, 1.0), 0)  # robinet
    lot.tube('acier', (xq, -0.85, zq), (xq, -0.32, zq), 0.025, 6)  # collecteur
    lot.tube('acier', (xq, -0.32, zq), (xq, -0.32, 0.67), 0.025, 6)
    lot.cube('acier_sombre', (0.22, 0.16, 0.14), (xq, -0.32, 0.6), 0.01)  # bloc de distribution
    for p in ((xq, -0.85, zq), (xq, -0.55, zq), (xq, -0.32, zq)):
        lot.cube('acier_sombre', (0.06, 0.06, 0.06), p, 0)  # raccords
    lot.tube('acier', (xq + 0.11, -0.32, 0.6), (xq + 0.15, -0.32, 0.6), 0.025, 6)
    lot.tube('acier', (xq + 0.15, -0.32, 0.6), (xq + 0.15, 0.62, 0.6), 0.025, 6)  # vers la pompe
    lot.tube('acier', (xq + 0.15, 0.62, 0.6), (xh + 0.11, 0.62, 0.6), 0.025, 6)
    # Flexibles et tuyauterie : de la pompe au vérin, le long de la flasque droite.
    for k, (mat, dy) in enumerate((('acier', -0.08), ('noir', 0.08))):
        pts = [Vector((xh, 0.62 + dy, 0.79)), Vector((xh, 0.62 + dy, 0.95)), Vector((xf + ef / 2 + 0.06, 0.62 + dy, 0.95)),
               Vector((xf + ef / 2 + 0.06, 0.62 + dy, zc1 + 0.06)), Vector((0.32, 0.2 + dy, zc1 + 0.06))]
        for a, b in zip(pts, pts[1:]):
            lot.tube(mat, a, b, 0.032, 6 if leger else sg)
        if not leger:
            for p in pts[1:-1]:
                lot.boule(mat, p, 0.04)
    for z in (1.2, 1.8):  # colliers
        lot.cube('acier_sombre', (0.06, 0.3, 0.05), (xf + ef / 2 + 0.03, 0.62, z), 0)
    T.cylinder_at(coll, 'manometre', 0.07, 0.03, (xh + 0.26, 0.0, 0.32), 'acier_sombre', segments=sg, y=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.055, 0.01, (xh + 0.28, 0.0, 0.32), 'blanc', segments=sg, y=90)

    # --- Gauche : armoire de commande (écran, colonne lumineuse) et pupitre bimanuel devant.
    xa, ya = -1.2, 0.45
    T.box(coll, 'armoire', (0.46, 0.6, 1.5), (xa, ya, 0.75), 'gris_clair', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.5, 0.64, 0.05), (xa, ya, 1.525), cadre, bevel=0.01)
    yv_ = ya - 0.3  # façade de l'armoire, tournée vers l'avant
    lot.cube('acier_sombre', (0.01, 0.01, 1.3), (xa, yv_ - 0.001, 0.75), 0)
    lot.cube('panneau', (0.3, 0.012, 0.24), (xa, yv_ - 0.004, 1.15), 0)  # écran tactile
    lot.cube('cyan', (0.26, 0.006, 0.2), (xa, yv_ - 0.01, 1.15), 0)
    for i, c in enumerate(('vert', 'jaune', 'rouge', 'blanc')):
        lot.cube(c, (0.04, 0.02, 0.04), (xa - 0.12 + i * 0.08, yv_ - 0.005, 0.92), 0)
    lot.cube('jaune', (0.14, 0.01, 0.14), (xa, yv_ - 0.003, 0.6), 0)
    for k in range(4):
        lot.cube('noir', (0.32, 0.012, 0.02), (xa, yv_ - 0.003, 0.2 + k * 0.05), 0)  # ouïes
    xt, yt = xa, ya + 0.2
    lot.tube('acier_sombre', (xt, yt, 1.55), (xt, yt, 1.75), 0.02, 6)
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.tube(c, (xt, yt, 1.75 + i * 0.07), (xt, yt, 1.81 + i * 0.07), 0.04, sg)
    xp, yp = -1.15, -1.0
    lot.tube('acier_sombre', (xp, yp, 0.0), (xp, yp, 0.85), 0.04, sg)
    lot.cube('acier_sombre', (0.3, 0.3, 0.03), (xp, yp, 0.015), 0)
    lot.cube('jaune', (0.5, 0.2, 0.14), (xp, yp, 0.92), 0.015)
    for dx in (-0.16, 0.16):
        lot.tube('vert', (xp + dx, yp, 0.99), (xp + dx, yp, 1.02), 0.04, sg)
    lot.tube('rouge', (xp, yp, 0.99), (xp, yp, 1.04), 0.035, sg)  # arrêt d'urgence
    lot.barre('noir', (xp + 0.04, yp + 0.04, 0.05), (-xf - ef / 2 - 0.01, -0.4, 0.05), 0.035, 0)
    lot.barre('noir', (xa + 0.23, ya - 0.2, 0.06), (-xf - ef / 2 - 0.01, ya - 0.2, 0.06), 0.04, 0)

    for l in (lot, co, en, so, ve):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'estampeuse_t1': estampeuse_t1, 'assembleur_t2': assembleur_t2, 'concasseur_t1': concasseur_t1,
           'betonniere_t2': betonniere_t2, 'station_lavage_t2': station_lavage_t2, 'constructeur_t2': constructeur_t2,
           'presse_lourde_t3': presse_lourde_t3}


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
    T.save(os.path.join(ROOT, 'blender', 'transformation.blend'))


if __name__ == '__main__':
    main()
