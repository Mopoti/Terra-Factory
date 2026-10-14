"""Famille « extraction » : foreuse, foreuse électrique, foreuse éco, chevalet de pompage (et plus tard pompe).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).

Lancer :  blender --background --python blender/scripts/extraction.py
Produit :  blender/extraction.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


# Emprise des foreuses dans le jeu : 4 x 5 cases (2 m de large, 2,5 m de profondeur). Les modèles sont dessinés pour
# 4 x 4 puis agrandis de ce facteur (mêmes proportions) : ils remplissent la largeur et la profondeur (de -2 à 2 en X,
# de -2,5 à 2,5 en Y) et montent jusqu’à 4,6 unités (2,3 m), ce qui demande une hauteur de 2 m dans machines.json.
ECHELLE_FOREUSE = 1.22

def foreuse_t1(coll, leger=True):
    """Foreuse à combustible : 4 x 4 cases, 3,9 unités max (1,95 m = 1,3 x 1,5 m). Sortie devant (-Y), combustible derrière.

    Tour de forage en poutres de bois (entretoises, croix, équerres de fonte, poulie au sommet) au-dessus du puits ;
    tige de forage suspendue à un crochet jaune, table rotative ; machine à vapeur à l'arrière (chaudière cerclée sur un
    socle de briques, cheminée, volant d'inertie, courroie vers la table) ; goulotte et tas de minerai devant ; trappe à
    combustible et charbon derrière. Tout reste dans l'emprise 4 x 4 (de -2 à 2) et entre Z = 0 et Z = 3,9.
    """
    rnd = random.Random(4)
    bv = 0.0 if leger else 1.0
    seg = 10 if leger else 20
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    cy = -0.35  # centre du puits (un peu vers l'avant)

    # Pas de sol : la machine est posée sur le terrain du jeu (voir T.poser_au_sol à la fin).

    # --- Plancher de bois autour du puits (z 0,2 -> 0,3).
    for k in range(8):
        y = cy - 1.05 + k * 0.3
        lot.cube(rnd.choice(('bois', 'bois', 'bois_sombre')), (2.5, 0.28, 0.08), (0, y, 0.24), 0.012 * bv)
    for x in (-1.2, 1.2):
        lot.cube('bois_sombre', (0.12, 2.45, 0.1), (x, cy, 0.25), 0.012 * bv)

    # --- Tour de forage : 4 poutres qui se rejoignent, entretoises, croix, équerres, poulie.
    zb, zh, db, dh = 0.3, 3.35, 1.1, 0.28

    def coin(sx, sy, z):
        d = db + (dh - db) * (z - zb) / (zh - zb)
        return (sx * d, cy + sy * d, z)

    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.barre('bois_sombre', coin(sx, sy, zb), coin(sx, sy, zh), 0.16, 0.025)
            lot.cube('fonte', (0.26, 0.26, 0.1), coin(sx, sy, 0.35), 0.015)  # sabot
    cotes = (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1)))
    niveaux = (0.3, 1.35, 2.35, 3.3)
    for z in niveaux[1:]:
        for (ax, ay), (bx, by) in cotes:
            lot.barre('bois', coin(ax, ay, z), coin(bx, by, z), 0.1, 0.015)
        for sx in (-1, 1):
            for sy in (-1, 1):
                lot.cube('fonte', (0.2, 0.2, 0.16), coin(sx, sy, z), 0.012)  # équerres
    # Croix sur les deux côtés et l'arrière (l'avant reste ouvert pour voir le forage).
    for z0, z1 in zip(niveaux, niveaux[1:]):
        for (ax, ay), (bx, by) in cotes[1:]:
            lot.barre('bois_sombre', coin(ax, ay, z0), coin(bx, by, z1), 0.07, 0)
            lot.barre('bois_sombre', coin(bx, by, z0), coin(ax, ay, z1), 0.07, 0)
    # Tête de tour et poulie.
    T.box(coll, 'tete', (0.8, 0.8, 0.14), (0, cy, 3.42), 'fonte', bevel=0.02)
    T.cylinder_at(coll, 'poulie_tete', 0.22, 0.1, (0, cy, 3.64), 'jaune', segments=seg, y=90)
    T.pivot(coll, 'pivot_poulie_tete', (0, cy, 3.64), (1, 0, 0))
    for x in (-0.12, 0.12):
        lot.cube('fonte', (0.05, 0.12, 0.3), (x, cy, 3.6), 0.01)

    # --- Forage : câble, tête motrice, gros foret hélicoïdal (tarière), table rotative et collier.
    for dx in (-0.06, 0.06):
        lot.tube('noir', (dx, cy, 3.45), (dx, cy, 2.3), 0.018, 6)
    T.box(coll, 'tete_motrice', (0.56, 0.46, 0.36), (0, cy, 2.06), 'jaune', bevel=0.04)
    T.box(coll, 'tete_motrice_capot', (0.42, 0.34, 0.08), (0, cy, 2.27), 'acier_sombre', bevel=0.02)
    for x in (-0.29, 0.29):  # moteurs latéraux
        T.cylinder_at(coll, f'tete_moteur_{x}', 0.1, 0.12, (x * 1.05, cy, 2.06), 'acier_sombre', segments=sg, y=90)
    # Pièces qui tournent avec le foret (groupe `foret_`, axe vertical) : mandrin, foret, table rotative.
    T.cylinder(coll, 'foret_mandrin', 0.18, 0.14, (0, cy, 1.81), 'acier', segments=sg)
    # Foret de perceuse XL : un bloc torsadé (deux listels, deux rainures), pointe dans le collier.
    T.foret(coll, 'foret_corps', (0, cy), 0.55, 1.74, 0.28, 0.12, 1.1, 'acier',
            n_angle=16 if leger else 32, n_z=10 if leger else 24, pointe=0.12)
    T.cylinder(coll, 'collier', 0.5, 0.12, (0, cy, 0.34), 'fonte', segments=seg)
    T.cylinder(coll, 'foret_table', 0.38, 0.1, (0, cy, 0.45), 'jaune', segments=seg)
    T.pivot(coll, 'pivot_foret', (0, cy, 1.0))
    # Boîte de vitesses posée sur la tête motrice (au-dessus de la poutre).
    zbv = 2.44
    T.box(coll, 'boite_vitesses', (0.4, 0.32, 0.26), (-0.06, cy, zbv), 'acier_sombre', bevel=0.03)
    T.box(coll, 'boite_vitesses_couvercle', (0.3, 0.24, 0.04), (-0.06, cy, zbv + 0.14), 'fonte', bevel=0.01)

    # --- Sortie devant : goulotte inclinée et tas de minerai.
    pente = Matrix.Rotation(math.radians(-14), 3, 'X')
    lot.cube('fonte', (0.6, 0.85, 0.05), (0, -1.55, 0.36), 0.01 * bv, pente)
    for x in (-0.31, 0.31):
        lot.cube('acier_sombre', (0.05, 0.85, 0.12), (x, -1.55, 0.41), 0, pente)
    for _ in range(6 if leger else 12):
        t = rnd.uniform(0.09, 0.15)
        lot.cube(rnd.choice(('brique_sombre', 'fonte', 'pierre')), (t, t, t * 0.8),
                 (rnd.uniform(-0.25, 0.25), rnd.uniform(-1.84, -1.68), 0.22 + t * 0.3), 0.02 * bv,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Machine à vapeur à l'arrière : socle de briques, chaudière, cheminée, volant, courroie.
    yb = 1.45
    T.box(coll, 'socle_briques', (3.2, 0.9, 0.5), (0, yb, 0.45), 'brique', bevel=0.02)
    T.parement(lot, [('y', yb - 0.45, -1.5, 1.5, -1), ('y', yb + 0.45, -1.5, -0.95, 1), ('y', yb + 0.45, -0.05, 1.5, 1)],
               (0.3, 0.48, 0.64), seed=7, densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    for x in (-0.45, 0.85):  # berceaux
        lot.cube('acier_sombre', (0.16, 0.62, 0.3), (x, yb, 0.82), 0.015)
    T.cylinder_at(coll, 'chaudiere', 0.38, 1.8, (0.2, yb, 1.1), 'fonte', segments=seg, y=90)
    for x in (-0.5, 0.2, 0.9):
        T.cylinder_at(coll, f'chaudiere_cercle_{x}', 0.41, 0.06, (x, yb, 1.1), 'acier_sombre', segments=seg, y=90)
    for x in (-0.72, 1.12):
        T.cylinder_at(coll, f'chaudiere_fond_{x}', 0.3, 0.04, (x, yb, 1.1), 'cuivre', segments=seg, y=90)
    T.cylinder(coll, 'dome_vapeur', 0.14, 0.18, (-0.2, yb, 1.52), 'cuivre', segments=sg)
    lot.tube('fonte', (0.85, yb, 1.4), (0.85, yb, 3.05), 0.13, sg)  # cheminée
    for z in (2.0, 2.6):
        lot.tube('acier_sombre', (0.85, yb, z - 0.03), (0.85, yb, z + 0.03), 0.15, sg)
    T.cylinder(coll, 'cheminee_chapeau', 0.15, 0.12, (0.85, yb, 3.1), 'fonte', segments=sg, radius_top=0.2)
    T.cylinder(coll, 'cheminee_trou', 0.13, 0.01, (0.85, yb, 3.162), 'noir', segments=sg)
    # Foyer rougeoyant au bout du socle (côté +X).
    T.box(coll, 'foyer', (0.04, 0.4, 0.26), (1.615, yb, 0.42), 'noir')
    T.box(coll, 'foyer_lueur', (0.03, 0.3, 0.16), (1.635, yb, 0.4), 'braise')
    # Volant d'inertie (côté -X), axe, palier.
    xv = -1.5
    # Groupe `volant_` (tourne autour de X) : jante, moyeu et rayons.
    T.cylinder_at(coll, 'volant', 0.46, 0.08, (xv, 1.2, 1.05), 'fonte', segments=seg, y=90)
    T.cylinder_at(coll, 'volant_moyeu', 0.1, 0.16, (xv, 1.2, 1.05), 'jaune', segments=sg, y=90)
    rayons = T.Lot(coll, 'volant_rayons')
    for a in (0, 45, 90, 135):
        t = math.radians(a)
        d = Vector((0, math.cos(t), math.sin(t))) * 0.4
        rayons.barre('fonte', tuple(Vector((xv, 1.2, 1.05)) + d), tuple(Vector((xv, 1.2, 1.05)) - d), 0.05, 0)
    rayons.finir()
    T.pivot(coll, 'pivot_volant', (xv, 1.2, 1.05), (1, 0, 0))
    lot.tube('acier', (xv, 1.2, 1.05), (-0.72, 1.2, 1.05), 0.04, sg)
    lot.cube('acier_sombre', (0.18, 0.2, 0.36), (-1.25, 1.2, 0.86), 0.015)
    # Courroie du volant vers la poulie ; l'arbre de la poulie entre dans le moteur gauche de la tête motrice.
    rp = 0.15
    pc = Vector((xv, cy, 2.06))  # centre de la poulie, à la hauteur du moteur gauche de la tête motrice
    T.cylinder_at(coll, 'poulie_boite', rp, 0.08, tuple(pc), 'jaune', segments=sg, y=90)
    T.pivot(coll, 'pivot_poulie_boite', tuple(pc), (1, 0, 0))
    lot.tube('acier', tuple(pc), (-0.37, cy, 2.06), 0.035, sg)  # arbre poulie -> moteur gauche de la tête
    # Vraie courroie fermée : s'enroule sur le volant et sur la poulie (plan X = xv).
    T.courroie(coll, 'courroie', xv, (1.2, 1.05), 0.46 + 0.025, (pc.y, pc.z), rp + 0.025, 0.07, 0.025, 'noir',
               n1=16 if leger else 32, n2=8 if leger else 16)

    # --- Derrière : trappe à combustible en planches et charbon.
    for k, x in enumerate((-0.74, -0.5, -0.26)):
        lot.cube(rnd.choice(('bois', 'bois_sombre')), (0.22, 0.06, 0.4), (x, yb + 0.48, 0.45), 0.012 * bv)
    for z in (0.33, 0.57):
        lot.cube('fonte', (0.74, 0.03, 0.05), (-0.5, yb + 0.52, z), 0)
    for _ in range(4 if leger else 9):
        s = rnd.uniform(0.08, 0.12)
        lot.cube('noir', (s, s, s * 0.8), (-0.5 + rnd.uniform(-0.3, 0.3), 1.86 + rnd.uniform(-0.01, 0.01), 0.22 + s * 0.3),
                 0.02 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    lot.finir()
    T.poser_au_sol(coll, 2.0)
    T.agrandir(coll, ECHELLE_FOREUSE, 2.0, 2.5)  # emprise 4 x 5 cases


def foreuse_electrique_t2(coll, leger=True):
    """Foreuse électrique : 4 x 4 cases, 3,9 unités max (1,95 m). Sortie devant (-Y).

    Socle carré aux angles arrondis (acier, grilles d'aération) ; au centre le foret de perceuse
    (bloc torsadé) qui plonge dans un trou percé jusqu'au sol ; petite tour sur 4 pieds en tubes d'acier qui porte le moteur
    électrique bleu au-dessus du foret ; petite antenne à isolateurs sur le moteur (câble électrique) ; goulotte et
    minerai devant. Tout reste dans l'emprise 4 x 4 (de -2 à 2) et entre Z = 0 et Z = 3,9.
    """
    rnd = random.Random(12)
    bv = 0.0 if leger else 1.0
    nc = 3 if leger else 6
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')

    # Pas de sol : la machine est posée sur le terrain du jeu (voir T.poser_au_sol à la fin).

    # --- Socle carré aux angles arrondis (demi 1,6 ; z 0,12 -> 0,78).
    # Percés au centre d'un trou un peu plus large que le foret, jusqu'au sol.
    r_trou = 0.34
    for nom, anneaux, mat in (('socle_plinthe', [(1.64, 0.32, 0.12), (1.64, 0.32, 0.2)], 'fonte'),
                              ('socle', [(1.6, 0.3, 0.2), (1.58, 0.29, 0.7)], 'acier'),
                              ('socle_dessus', [(1.62, 0.31, 0.68), (1.62, 0.31, 0.78)], 'acier_sombre')):
        T.percer(T.lissage(coll, nom, anneaux, mat, fond=True, n_coin=nc), r_trou, 0.1, 0.8, segments=seg)
    # Grilles d'aération (deux par face, sauf devant où est la sortie) et joints de panneaux.
    for ang, faces_u in ((90, (-0.7, 0.7)), (180, (-0.7, 0.7)), (-90, (-0.7, 0.7)), (0, (-1.0, 1.0))):
        rz = Matrix.Rotation(math.radians(ang), 3, 'Z')
        for u in faces_u:
            lot.cube('acier_sombre', (0.5, 0.03, 0.26), tuple(rz @ Vector((u, -1.605, 0.45))), 0.008, rz)
            for k in range(4):
                lot.cube('noir', (0.42, 0.02, 0.025), tuple(rz @ Vector((u, -1.62, 0.36 + k * 0.06))), 0, rz)
    # Sortie devant : bouche, goulotte inclinée, minerai.
    T.box(coll, 'sortie_bouche', (0.6, 0.04, 0.3), (0, -1.6, 0.42), 'noir')
    for x in (-0.36, 0.36):
        lot.cube('acier_sombre', (0.12, 0.1, 0.42), (x, -1.62, 0.45), 0.015)
    lot.cube('acier_sombre', (0.84, 0.1, 0.1), (0, -1.62, 0.62), 0.015)
    pente = Matrix.Rotation(math.radians(-18), 3, 'X')
    lot.cube('acier', (0.6, 0.4, 0.04), (0, -1.76, 0.24), 0.01 * bv, pente)
    for x in (-0.31, 0.31):
        lot.cube('acier_sombre', (0.04, 0.4, 0.1), (x, -1.76, 0.28), 0, pente)
    for _ in range(5 if leger else 10):
        t = rnd.uniform(0.08, 0.12)
        lot.cube(rnd.choice(('brique_sombre', 'fonte', 'pierre')), (t, t, t * 0.8),
                 (rnd.uniform(-0.22, 0.22), rnd.uniform(-1.86, -1.7), 0.27 + t * 0.3), 0.015 * bv,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Fond du trou (sol sombre) : le foret y descend.
    T.cylinder(coll, 'trou_fond', r_trou, 0.01, (0, 0, 0.125), 'noir', segments=seg)
    T.percer(T.cylinder(coll, 'trou_bord', r_trou + 0.09, 0.05, (0, 0, 0.8), 'acier', segments=seg), r_trou, 0.7, 0.9, segments=seg)

    # --- Tour sur 4 pieds (tubes d'acier), ceintures, plateau du moteur.
    zb, zh, db, dh = 0.78, 2.95, 1.2, 0.42

    def coin(sx, sy, z):
        d = db + (dh - db) * (z - zb) / (zh - zb)
        return (sx * d, sy * d, z)

    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.tube('acier_sombre', coin(sx, sy, zb), coin(sx, sy, zh), 0.07, sg)
            lot.cube('fonte', (0.24, 0.24, 0.06), coin(sx, sy, zb + 0.03), 0.01)  # platine
            for dx in (-1, 1):  # boulons
                for dy in (-1, 1):
                    p = coin(sx, sy, zb)
                    lot.cube('acier', (0.03, 0.03, 0.03), (p[0] + dx * 0.08, p[1] + dy * 0.08, zb + 0.075), 0)
    for z in (1.6, 2.35):
        pts = [coin(sx, sy, z) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for a, b in zip(pts, pts[1:] + pts[:1]):
            lot.tube('acier', a, b, 0.04, sg)
        for p in pts:
            lot.boule('acier_sombre', p, 0.08)
    T.lissage(coll, 'plateau', [(0.55, 0.12, 2.95), (0.55, 0.12, 3.05)], 'acier_sombre', fond=True, n_coin=nc)

    # --- Moteur électrique bleu, ailettes de refroidissement, chapeau.
    T.cylinder(coll, 'moteur', 0.3, 0.42, (0, 0, 3.26), 'bleu', segments=seg)
    for k in range(3):
        T.cylinder(coll, f'moteur_ailette_{k}', 0.33, 0.03, (0, 0, 3.13 + k * 0.1), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'moteur_chapeau', 0.32, 0.06, (0, 0, 3.5), 'acier', segments=seg, radius_top=0.24)
    T.box(coll, 'moteur_boitier', (0.2, 0.14, 0.18), (0.32, 0, 3.3), 'acier_sombre', bevel=0.02)

    # --- Foret : arbre sous le plateau, mandrin, bloc torsadé jusqu'à la table.
    # Groupe `foret_` (tourne autour de l'axe vertical) : arbre, mandrin, foret.
    T.cylinder(coll, 'foret_arbre', 0.09, 0.33, (0, 0, 2.785), 'acier', segments=sg)
    T.cylinder(coll, 'foret_mandrin', 0.17, 0.14, (0, 0, 2.55), 'acier_sombre', segments=sg)
    T.foret(coll, 'foret_corps', (0, 0), 0.42, 2.48, 0.28, 0.12, 1.7, 'acier',
            n_angle=16 if leger else 32, n_z=12 if leger else 28, pointe=0.12)
    T.pivot(coll, 'pivot_foret', (0, 0, 1.5))

    # --- Petite antenne à isolateurs sur le moteur, câble qui descend le long d'un pied vers un boîtier.
    lot.tube('acier_sombre', (0, 0, 3.53), (0, 0, 3.72), 0.03, sg)
    lot.cube('acier_sombre', (0.4, 0.05, 0.05), (0, 0, 3.7), 0.008)
    for x in (-0.17, 0.17):
        for k in range(2):
            T.cylinder(coll, f'isolateur_{x}_{k}', 0.045, 0.03, (x, 0, 3.75 + k * 0.04), 'blanc', segments=8)
        T.cylinder(coll, f'isolateur_tete_{x}', 0.02, 0.05, (x, 0, 3.85), 'cuivre', segments=6)
    cable = [(0.17, 0, 3.84), (0.5, 0.42, 3.0), coin(1, 1, 1.6), coin(1, 1, 0.95), (1.2, 1.38, 0.95)]
    for a, b in zip(cable, cable[1:]):
        lot.tube('noir', a, b, 0.02, 6)
    T.box(coll, 'boitier', (0.3, 0.2, 0.26), (1.2, 1.38, 0.92), 'acier_sombre', bevel=0.02)
    lot.cube('jaune', (0.12, 0.01, 0.12), (1.2, 1.275, 0.94), 0)

    lot.finir()
    T.poser_au_sol(coll, 2.0)
    T.agrandir(coll, ECHELLE_FOREUSE, 2.0, 2.5)  # emprise 4 x 5 cases


def foreuse_eco_t3(coll, leger=True):
    """Foreuse éco (T3) : version high-tech de la foreuse électrique, 4 x 4 cases, 3,9 unités max (1,95 m). Sortie devant.

    Même principe que la T2 (socle carré, tour à 4 pieds, foret au centre qui plonge dans un trou jusqu'au sol, moteur en
    haut) mais plus moderne et industriel (pas futuriste), blanc et gris clair avec accents jaunes : socle blanc bas à
    bande sombre et grilles d'aération, trou bordé d'un anneau ; 4 pieds en lames blanches à
    manchons jaunes ; collier carré à mi-hauteur poussé par deux vérins hydrauliques ; capsule moteur à dôme, bande
    jaune et ailettes ; gyrophare ; armoire de commande (écran, voyants) reliée au moteur par des flexibles ; antenne
    fine (câble électrique) ; goulotte blanche devant.
    Tout reste dans l'emprise 4 x 4 (de -2 à 2) et entre Z = 0 et Z = 3,9.
    """
    rnd = random.Random(33)
    bv = 0.0 if leger else 1.0
    nc = 4 if leger else 8
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    r_trou = 0.36

    # Pas de sol : la machine est posée sur le terrain du jeu (voir T.poser_au_sol à la fin).

    # --- Socle blanc bas, percé au centre et bande sombre.
    for nom, anneaux, mat in (('socle', [(1.55, 0.45, 0.12), (1.5, 0.42, 0.56)], 'blanc'),
                              ('socle_dessus', [(1.52, 0.43, 0.54), (1.48, 0.41, 0.62)], 'gris_clair')):
        T.percer(T.lissage(coll, nom, anneaux, mat, fond=True, n_coin=nc), r_trou, 0.1, 0.7, segments=seg)
    T.lissage(coll, 'socle_bande', [(1.56, 0.45, 0.2), (1.55, 0.45, 0.3)], 'acier_sombre', dessus=False, n_coin=nc)
    # Trou : fond sombre et anneau sur le bord.
    T.cylinder(coll, 'trou_fond', r_trou, 0.01, (0, 0, 0.125), 'noir', segments=seg)
    T.percer(T.cylinder(coll, 'trou_bord', r_trou + 0.1, 0.04, (0, 0, 0.64), 'gris_clair', segments=seg), r_trou, 0.5, 0.8, segments=seg)

    # --- 4 pieds en lames blanches effilées, manchons jaunes en bas.
    zb, zh, db, dh = 0.62, 2.8, 1.22, 0.46

    def coin(sx, sy, z, decal=0.0):
        d = db + (dh - db) * (z - zb) / (zh - zb) + decal
        return Vector((sx * d, sy * d, z))

    for sx in (-1, 1):
        for sy in (-1, 1):
            a, b = coin(sx, sy, zb), coin(sx, sy, zh)
            lot.barre('blanc', a, b, 0.16, 0.03)
            lot.cube('acier_sombre', (0.3, 0.3, 0.05), tuple(a + Vector((0, 0, 0.02))), 0.015)  # pied
            lot.barre('jaune', coin(sx, sy, zb + 0.04), coin(sx, sy, zb + 0.34), 0.19, 0.02)  # manchon
    # Collier carré à mi-hauteur (relie les pieds, guide le foret), autour du passage du foret.
    zc = 1.9
    dc = db + (dh - db) * (zc - zb) / (zh - zb)
    T.percer(T.lissage(coll, 'collier', [(dc + 0.06, 0.18, zc - 0.05), (dc + 0.06, 0.18, zc + 0.05)], 'blanc',
                       fond=True, n_coin=nc), 0.42, zc - 0.2, zc + 0.2, segments=seg)
    # Plateau supérieur.
    T.lissage(coll, 'plateau', [(0.58, 0.16, zh), (0.58, 0.16, zh + 0.08)], 'gris_clair', fond=True, n_coin=nc)

    # --- Foret au centre (plonge dans le trou).
    # Groupe `foret_` (tourne autour de l'axe vertical) : arbre, mandrin, foret.
    T.cylinder(coll, 'foret_arbre', 0.08, zh - 2.58, (0, 0, (zh + 2.58) / 2), 'acier', segments=sg)
    T.cylinder(coll, 'foret_mandrin', 0.16, 0.12, (0, 0, 2.52), 'acier_sombre', segments=sg)
    T.foret(coll, 'foret_corps', (0, 0), 0.42, 2.46, 0.28, 0.12, 1.7, 'acier',
            n_angle=16 if leger else 32, n_z=12 if leger else 28, pointe=0.12)
    T.pivot(coll, 'pivot_foret', (0, 0, 1.5))

    # --- Capsule moteur blanche et dôme.
    zm = zh + 0.08
    T.cylinder(coll, 'capsule', 0.42, 0.44, (0, 0, zm + 0.22), 'blanc', segments=seg)
    T.cylinder(coll, 'capsule_joint', 0.44, 0.03, (0, 0, zm + 0.04), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'capsule_dome', 0.42, 0.16, (0, 0, zm + 0.52), 'gris_clair', segments=seg, radius_top=0.18)

    # --- Antenne fine (câble électrique).
    za = zm + 0.6
    lot.tube('gris_clair', (0, 0, za), (0, 0, 3.78), 0.03, sg)
    for k in range(2):
        T.cylinder(coll, f'isolateur_{k}', 0.055, 0.03, (0, 0, za + 0.12 + k * 0.05), 'blanc', segments=8)
    lot.boule('gris_clair', (0, 0, 3.82), 0.06)

    # --- Sortie devant : bouche encadrée, goulotte blanche, minerai.
    T.box(coll, 'sortie_bouche', (0.6, 0.04, 0.24), (0, -1.5, 0.3), 'noir')
    for x in (-0.36, 0.36):
        lot.cube('gris_clair', (0.1, 0.08, 0.32), (x, -1.52, 0.3), 0.02)
    lot.cube('gris_clair', (0.82, 0.08, 0.08), (0, -1.52, 0.47), 0.02)
    pente = Matrix.Rotation(math.radians(-16), 3, 'X')
    lot.cube('blanc', (0.62, 0.46, 0.04), (0, -1.74, 0.21), 0.01 * bv, pente)
    for x in (-0.32, 0.32):
        lot.cube('gris_clair', (0.03, 0.46, 0.06), (x, -1.74, 0.24), 0, pente)
    for _ in range(5 if leger else 10):
        t = rnd.uniform(0.07, 0.11)
        lot.cube(rnd.choice(('brique_sombre', 'fonte', 'pierre')), (t, t, t * 0.8),
                 (rnd.uniform(-0.22, 0.22), rnd.uniform(-1.86, -1.68), 0.24 + t * 0.3), 0.015 * bv,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Détails industriels « avancés » (sans effet futuriste).
    # Grilles d'aération sur les côtés et l'arrière du socle.
    for ang in (90, 180, -90):
        rz = Matrix.Rotation(math.radians(ang), 3, 'Z')
        for u in (-0.55, 0.55):
            lot.cube('acier_sombre', (0.5, 0.03, 0.16), tuple(rz @ Vector((u, -1.5, 0.43))), 0.008, rz)
            for k in range(3):
                lot.cube('noir', (0.42, 0.02, 0.022), tuple(rz @ Vector((u, -1.515, 0.38 + k * 0.05))), 0, rz)
    # Deux vérins hydrauliques (corps jaune, tige chromée) entre le socle et le collier : ils poussent le foret.
    for x in (-0.62, 0.62):
        lot.cube('acier_sombre', (0.16, 0.2, 0.08), (x, 0, 0.66), 0.015)
        lot.tube('jaune', (x, 0, 0.7), (x, 0, 1.3), 0.075, sg)
        lot.tube('acier_sombre', (x, 0, 1.28), (x, 0, 1.33), 0.085, sg)
        lot.tube('acier', (x, 0, 1.33), (x, 0, zc - 0.06), 0.035, sg)
        lot.cube('acier_sombre', (0.16, 0.2, 0.08), (x, 0, zc - 0.07), 0.015)
        lot.tube('noir', (x - 0.08 * (1 if x > 0 else -1), 0, 0.75), (x - 0.08 * (1 if x > 0 else -1), 0, 1.2), 0.018, 6)  # flexible
    # Capsule moteur : bande jaune et ailettes de refroidissement.
    T.cylinder(coll, 'capsule_bande', 0.43, 0.06, (0, 0, zm + 0.3), 'jaune', segments=seg)
    for k in range(8):
        a = 2 * math.pi * k / 8
        lot.cube('gris_clair', (0.06, 0.03, 0.2), (0.44 * math.cos(a), 0.44 * math.sin(a), zm + 0.14), 0.008,
                 Matrix.Rotation(a, 3, 'Z'))
    # Gyrophare orange sur un coin du plateau.
    T.cylinder(coll, 'gyrophare_pied', 0.07, 0.04, (0.42, -0.42, zh + 0.1), 'acier_sombre', segments=sg)
    T.cylinder(coll, 'gyrophare', 0.06, 0.1, (0.42, -0.42, zh + 0.17), 'orange', segments=sg, radius_top=0.05)
    T.pivot(coll, 'pivot_gyrophare', (0.42, -0.42, zh + 0.17))
    # Armoire de commande sur le socle (avant droite) : écran et voyants.
    T.box(coll, 'armoire', (0.36, 0.24, 0.46), (0.88, -1.12, 0.85), 'gris_clair', bevel=0.03)
    T.box(coll, 'armoire_toit', (0.4, 0.28, 0.04), (0.88, -1.12, 1.09), 'acier_sombre', bevel=0.01)
    T.box(coll, 'armoire_ecran', (0.24, 0.01, 0.15), (0.88, -1.245, 0.93), 'panneau')
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.04, 0.015, 0.04), (0.8 + i * 0.08, -1.245, 0.76), 0)
    # Flexibles : de la capsule moteur, le long du pied avant droit, jusqu'à l'armoire.
    def le_long(z, rentre):
        p = coin(1, -1, z)
        return p - Vector((p.x, p.y, 0)).normalized() * rentre
    flex = [Vector((0.38, -0.18, zm + 0.2)), le_long(zh - 0.1, 0.12), le_long(1.6, 0.13), le_long(1.25, 0.13),
            Vector((0.88, -1.12, 1.11))]
    for dz in (0.0, 0.05):
        pts = [p + Vector((0, 0, dz)) for p in flex]
        for a, b in zip(pts, pts[1:]):
            lot.tube('noir', a, b, 0.022, 6)

    lot.finir()
    T.poser_au_sol(coll, 2.0)
    T.agrandir(coll, ECHELLE_FOREUSE, 2.0, 2.5)  # emprise 4 x 5 cases

def chevalet_t2(coll, leger=True):
    """Chevalet de pompage électrique (pétrole) : 3 x 3 cases, 3,9 unités max (1,95 m), aussi haut que permis. Sortie du fluide devant (-Y).

    Silhouette classique : balancier jaune sur chevalet en A, tête de cheval à l'avant (arc à gorge où courent les
    câbles, nervures, trous d'allègement, éclisses boulonnées, anneau de levage) au-dessus de la tête de puits (câbles,
    tige polie, presse-étoupe, vanne) ; sortie du fluide par une conduite noire droite jusqu'au bord avant (vanne rouge,
    bride de raccordement) ; à l'arrière réducteur, manivelles à contrepoids de fonte et bielles qui remontent au
    balancier ; moteur électrique bleu avec carter de courroie jaune ; petite antenne à isolateurs (câble électrique).
    Pièces mobiles séparées, chacune avec son pivot (voir blender/ANIMATIONS.md) : `balancier_*` (bascule),
    `tige_*` (monte et descend), `manivelle_*` (tourne), `bielle_*` (suit balancier et manivelles).
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 3,9.
    """
    bv = 0.0 if leger else 1.0
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')  # tout ce qui ne bouge pas
    bal = T.Lot(coll, 'balancier')  # bascule autour de l'axe du palier
    tige = T.Lot(coll, 'tige')  # câbles, barre porteuse, tige polie : montent et descendent
    man = T.Lot(coll, 'manivelle')  # manivelles et contrepoids : tournent autour de l'arbre du réducteur
    bie = T.Lot(coll, 'bielle')  # bielles : relient manivelles et balancier

    # --- Socle en acier (longerons et traverses), posé sur le terrain du jeu (pas de sol, voir T.poser_au_sol).
    for x in (-0.7, 0.7):
        lot.cube('acier_sombre', (0.18, 2.3, 0.18), (x, 0.3, 0.21), 0.02)
    for y in (-0.7, 0.3, 1.3):
        lot.cube('acier_sombre', (1.58, 0.16, 0.12), (0, y, 0.18), 0.02)
    T.box(coll, 'platine', (1.6, 0.95, 0.06), (0, 0.85, 0.33), 'acier_sombre', bevel=0.015)

    # --- Chevalet en A (4 pieds, traverses) et palier du balancier.
    zb = 3.5  # hauteur de la poutre du balancier
    yp = 0.05  # position de l'axe le long de Y
    za = zb - 0.1  # axe de bascule (palier)
    haut = (0.12, yp, zb - 0.22)
    for sx in (-1, 1):
        for y0, z0 in ((-0.5, 0.3), (0.55, 0.3)):
            lot.barre('acier_sombre', (sx * 0.62, y0, z0), (sx * haut[0], haut[1], haut[2]), 0.14, 0.02)
            lot.cube('fonte', (0.26, 0.26, 0.06), (sx * 0.62, y0, z0 + 0.03), 0.015)  # sabot du pied
        for z, dy in ((1.0, 0.85), (1.9, 0.5), (2.7, 0.22)):  # traverses de côté, plus courtes en montant
            k = (z - 0.3) / (haut[2] - 0.3)
            x = sx * (0.62 + (haut[0] - 0.62) * k)
            lot.barre('acier_sombre', (x, -0.5 + (yp + 0.5) * k, z), (x, 0.55 + (yp - 0.55) * k, z), 0.08, 0)
        k0, k1 = (1.0 - 0.3) / (haut[2] - 0.3), (1.9 - 0.3) / (haut[2] - 0.3)
        x0, x1 = sx * (0.62 + (haut[0] - 0.62) * k0), sx * (0.62 + (haut[0] - 0.62) * k1)
        lot.barre('acier_sombre', (x0, -0.5 + (yp + 0.5) * k0, 1.0), (x1, 0.55 + (yp - 0.55) * k1, 1.9), 0.06, 0)  # croix
    lot.barre('acier_sombre', (-0.55, -0.42, 0.8), (0.55, -0.42, 0.8), 0.08, 0)
    T.box(coll, 'palier', (0.44, 0.32, 0.2), (0, yp, zb - 0.2), 'fonte', bevel=0.025)
    T.cylinder_at(coll, 'palier_axe', 0.085, 0.52, (0, yp, za), 'acier', segments=sg, y=90)
    T.pivot(coll, 'pivot_balancier', (0, yp, za), (1, 0, 0))

    # --- Balancier (poutre jaune) et palonnier à l'arrière (là où s'accrochent les bielles).
    yt, yq = -0.25, 1.05  # avant (côté tête) et arrière (queue) de la poutre
    lb = 0.12  # demi-largeur de la poutre
    T.box(coll, 'balancier_poutre', (2 * lb, yq - yt, 0.3), (0, (yt + yq) / 2, zb), 'jaune', bevel=0.025)
    T.box(coll, 'balancier_semelle', (2 * lb + 0.08, yq - yt - 0.1, 0.05), (0, (yt + yq) / 2, zb - 0.165), 'acier_sombre', bevel=0.012)
    T.box(coll, 'balancier_chapeau', (2 * lb + 0.08, yq - yt - 0.1, 0.04), (0, (yt + yq) / 2, zb + 0.16), 'acier_sombre', bevel=0.01)
    for y in (0.3, 0.55, 0.8):  # raidisseurs sur l'âme de la poutre
        for s in (-1, 1):
            bal.cube('jaune', (0.025, 0.06, 0.26), (s * (lb + 0.0125), y, zb), 0)
    zpal = zb - 0.16
    T.box(coll, 'balancier_palonnier', (0.8, 0.14, 0.12), (0, yq - 0.05, zpal), 'acier_sombre', bevel=0.02)

    # --- Tête de cheval : corps jaune courbe, arc en acier à gorge (les câbles y courent), nervures, trous d'allègement,
    # éclisses boulonnées sur la poutre, anneau de levage.
    ct, rt = Vector((yt - 0.05, za)), 0.5  # centre (y, z) et rayon de l'arc
    lt = 0.16  # demi-largeur de la tête
    pas = 14 if leger else 7
    angles = list(range(70, -71, -pas))
    arc = [Vector((ct.x - rt * math.cos(math.radians(a)), ct.y + rt * math.sin(math.radians(a)))) for a in angles]
    profil = [(yt + 0.05, arc[0].y)] + [tuple(p) for p in arc] + [(yt + 0.05, arc[-1].y)]
    T.extrusion(coll, 'balancier_tete', profil, -lt, lt, 'jaune')

    def bande_arc(mat, x0, x1, r0, r1):
        """Bande pleine qui suit l'arc de la tête (de X = x0 à x1, entre les rayons r0 et r1 autour de `ct`)."""
        tmp = bmesh.new()
        cols = []
        for a in angles:
            u = Vector((-math.cos(math.radians(a)), math.sin(math.radians(a))))
            cols.append([tmp.verts.new((x, (ct + u * r).x, (ct + u * r).y)) for x, r in ((x0, r0), (x1, r0), (x1, r1), (x0, r1))])
        for c0, c1 in zip(cols, cols[1:]):
            for k in range(4):
                tmp.faces.new((c0[k], c0[(k + 1) % 4], c1[(k + 1) % 4], c1[k]))
        tmp.faces.new(cols[0])
        tmp.faces.new(list(reversed(cols[-1])))
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        T._verse(tmp, bal.bms.setdefault(mat, bmesh.new()))

    bande_arc('acier_sombre', -lt - 0.02, lt + 0.02, rt - 0.01, rt + 0.04)  # fond de la gorge
    for s in (-1, 1):
        bande_arc('acier_sombre', s * (lt + 0.005), s * (lt + 0.04), rt - 0.01, rt + 0.11)  # joues de la gorge
    # Nervures rayonnantes et trous d'allègement sur les deux faces.
    moyeu = Vector((yt + 0.02, ct.y))
    for s in (-1, 1):
        xs = s * (lt + 0.0125)
        for a in (50, 0, -50):
            bout = ct + Vector((-math.cos(math.radians(a)), math.sin(math.radians(a)))) * (rt - 0.03)
            d = bout - moyeu
            c = (bout + moyeu) / 2
            bal.cube('jaune', (0.025, d.length, 0.05), (xs, c.x, c.y), 0.008 * bv,
                     Matrix.Rotation(math.atan2(d.y, d.x), 3, 'X'))
        for a in (25, -25):
            c = ct + Vector((-math.cos(math.radians(a)), math.sin(math.radians(a)))) * 0.3
            bal.tube('noir', (s * (lt - 0.002), c.x, c.y), (s * (lt + 0.006), c.x, c.y), 0.075, sg)
        # Éclisse boulonnée qui tient la tête sur la poutre, cale entre les deux.
        bal.cube('acier_sombre', (0.02, 0.3, 0.26), (s * (lt + 0.02), yt + 0.1, zb), 0.006 * bv)
        bal.cube('acier_sombre', (lt + 0.01 - lb, 0.22, 0.22), (s * (lb + lt + 0.01) / 2, yt + 0.13, zb), 0)
        for dy in (-0.09, 0.09):
            for dz in (-0.08, 0.08):
                bal.cube('acier', (0.02, 0.035, 0.035), (s * (lt + 0.035), yt + 0.1 + dy, zb + dz), 0)
    # Anneau de levage sur le dessus de la tête.
    yo, zo = yt - 0.1, arc[0].y
    bal.cube('acier_sombre', (0.06, 0.1, 0.03), (0, yo, zo + 0.015), 0)
    anneau = [Vector((yo + 0.045 * math.cos(math.radians(a)), zo + 0.06 + 0.045 * math.sin(math.radians(a))))
              for a in range(-90, 271, 60)]
    for p0, p1 in zip(anneau, anneau[1:]):
        bal.barre('acier', (0, p0.x, p0.y), (0, p1.x, p1.y), 0.018, 0)

    # --- Câbles (dans la gorge, devant l'arc), barre porteuse, tige polie : groupe `tige_`.
    yc = ct.x - rt - 0.045  # aplomb des câbles = axe du puits
    zbar = 1.3
    for dx in (-0.06, 0.06):
        tige.tube('noir', (dx, yc, ct.y), (dx, yc, zbar), 0.018, 6)
    tige.cube('acier_sombre', (0.28, 0.09, 0.07), (0, yc, zbar), 0.01)
    for dx in (-0.1, 0.1):
        tige.cube('acier', (0.035, 0.035, 0.06), (dx, yc, zbar + 0.065), 0)  # serre-câbles
    tige.tube('acier', (0, yc, zbar), (0, yc, 0.62), 0.03, sg)
    T.pivot(coll, 'pivot_tige', (0, yc, ct.y))

    # --- Tête de puits (fixe).
    yw = yc
    T.cylinder(coll, 'puits_socle', 0.2, 0.08, (0, yw, 0.26), 'fonte', segments=seg)
    T.cylinder(coll, 'puits_tube', 0.12, 0.3, (0, yw, 0.35), 'acier_sombre', segments=sg)
    T.cylinder(coll, 'puits_te', 0.1, 0.16, (0, yw, 0.56), 'rouge', segments=sg)
    T.cylinder(coll, 'puits_presse_etoupe', 0.07, 0.1, (0, yw, 0.69), 'acier_sombre', segments=sg)
    T.cylinder_at(coll, 'puits_volant', 0.09, 0.025, (-0.17, yw, 0.56), 'rouge', segments=sg, y=90)
    lot.tube('acier_sombre', (-0.17, yw, 0.56), (-0.1, yw, 0.56), 0.02, 6)

    # --- Sortie du fluide : conduite noire qui part du té, droit vers l'avant (-Y), vanne rouge, bride au bord.
    zl = 0.56
    yb = -1.46  # face de la bride, au bord avant de l'emprise
    yv = (yw + yb) / 2  # vanne au milieu de la conduite
    lot.tube('noir', (0, yw - 0.08, zl), (0, yb + 0.03, zl), 0.075, sg)
    T.cylinder_at(coll, 'sortie_collet', 0.1, 0.05, (0, yw - 0.12, zl), 'fonte', segments=sg, x=90)
    T.cylinder_at(coll, 'sortie_vanne', 0.11, 0.16, (0, yv, zl), 'rouge', segments=sg, x=90)
    T.cylinder(coll, 'sortie_vanne_tige', 0.018, 0.16, (0, yv, zl + 0.16), 'acier', segments=6)
    T.cylinder(coll, 'sortie_vanne_volant', 0.09, 0.025, (0, yv, zl + 0.25), 'rouge', segments=sg)
    T.cylinder_at(coll, 'sortie_bride', 0.14, 0.05, (0, yb + 0.025, zl), 'fonte', segments=sg, x=90)
    T.cylinder_at(coll, 'sortie_bouche', 0.06, 0.012, (0, yb - 0.004, zl), 'noir', segments=sg, x=90)
    for k in range(6):
        a = 2 * math.pi * k / 6 + math.pi / 6
        lot.cube('acier', (0.03, 0.03, 0.03), (0.105 * math.cos(a), yb + 0.005, zl + 0.105 * math.sin(a)), 0)
    lot.cube('acier_sombre', (0.16, 0.1, zl - 0.2), (0, -1.36, (zl - 0.08 + 0.12) / 2), 0.01)  # support de la bride

    # --- Arrière : réducteur (fixe), manivelles et contrepoids (groupe `manivelle_`), bielles (groupe `bielle_`).
    yr, zr = 0.76, 0.9  # axe du réducteur
    T.box(coll, 'reducteur', (0.56, 0.56, 0.52), (0, yr, zr - 0.05), 'acier_sombre', bevel=0.045)
    T.box(coll, 'reducteur_capot', (0.48, 0.48, 0.06), (0, yr, zr + 0.24), 'fonte', bevel=0.015)
    T.cylinder_at(coll, 'reducteur_arbre', 0.07, 0.94, (0, yr, zr), 'acier', segments=sg, y=90)
    T.pivot(coll, 'pivot_manivelle', (0, yr, zr), (1, 0, 0))
    angle = math.radians(-125)  # manivelles tournées vers le bas et l'arrière
    pin_d = 0.44
    for s in (-1, 1):
        x = s * 0.39
        pin = Vector((x, yr + pin_d * math.cos(angle + math.pi / 2), zr + pin_d * math.sin(angle + math.pi / 2)))
        man.barre('acier_sombre', (x, yr, zr), tuple(pin), 0.13, 0.015)
        cp = Vector((x + s * 0.02, yr, zr)) + (pin - Vector((x, yr, zr))) * 1.05
        man.cube('fonte', (0.16, 0.58, 0.44), tuple(cp), 0.04,
                 Vector((0, 1, 0)).rotation_difference(Vector((0, cp.y - yr, cp.z - zr))).to_matrix())
        man.boule('acier_sombre', tuple(pin + Vector((s * 0.08, 0, 0))), 0.06)  # maneton
        bie.tube('jaune', tuple(pin + Vector((s * 0.08, 0, 0))), (s * 0.34, yq - 0.05, zpal), 0.05, sg)
    T.pivot(coll, 'pivot_bielle', (0, yq - 0.05, zpal), (1, 0, 0))

    # --- Moteur électrique bleu et carter de courroie jaune.
    T.box(coll, 'carter', (0.4, 0.15, 0.7), (0.58, yr, 0.7), 'jaune', bevel=0.03)
    T.cylinder_at(coll, 'moteur', 0.2, 0.46, (1.0, yr, 0.56), 'bleu', segments=seg, y=90)
    for k in range(3):
        T.cylinder_at(coll, f'moteur_ailette_{k}', 0.22, 0.03, (0.87 + k * 0.13, yr, 0.56), 'acier_sombre', segments=seg, y=90)
    lot.cube('acier_sombre', (0.4, 0.34, 0.12), (1.0, yr, 0.42), 0.015)  # plus court que le moteur (pas de faces confondues)
    T.box(coll, 'moteur_boitier', (0.16, 0.13, 0.16), (1.0, yr - 0.26, 0.7), 'acier_sombre', bevel=0.015)

    # --- Petite antenne à isolateurs (arrière droite) et câble vers le moteur.
    lot.tube('acier_sombre', (1.2, 1.25, 0.12), (1.2, 1.25, 1.55), 0.04, sg)
    lot.cube('acier_sombre', (0.36, 0.05, 0.05), (1.2, 1.25, 1.5), 0.008)
    for x in (1.06, 1.34):
        for k in range(2):
            T.cylinder(coll, f'isolateur_{x}_{k}', 0.045, 0.03, (x, 1.25, 1.55 + k * 0.04), 'blanc', segments=8)
        T.cylinder(coll, f'isolateur_tete_{x}', 0.02, 0.05, (x, 1.25, 1.65), 'cuivre', segments=6)
    for a, b in (((1.06, 1.25, 1.63), (1.17, 1.25, 1.3)), ((1.17, 1.25, 1.3), (1.03, yr - 0.26, 0.74))):
        lot.tube('noir', a, b, 0.018, 6)

    for l in (lot, bal, tige, man, bie):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'foreuse_t1': foreuse_t1, 'foreuse_electrique_t2': foreuse_electrique_t2, 'foreuse_eco_t3': foreuse_eco_t3,
           'chevalet_t2': chevalet_t2}


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
    T.save(os.path.join(ROOT, 'blender', 'extraction.blend'))


if __name__ == '__main__':
    main()
