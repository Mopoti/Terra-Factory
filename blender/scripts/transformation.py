"""Famille « transformation » : machines qui transforment les lingots et le minerai (estampeuse, et plus tard
concasseur, presse lourde, laveur, centrifugeuse…).

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
    """Estampeuse à combustible (marteau-pilon à vapeur) : 3 x 3 cases, 2,6 unités max (1,3 m). Sortie devant (-Y).

    Massif de pierre ; bâti en fonte peinte en vert foncé à deux jambes inclinées, glissières et traverse ; cylindre à vapeur sur la
    traverse ; marteau (masse, matrice haute, tige du piston) au-dessus de la chabotte, de l'enclume et de la matrice
    basse ; tables à rouleaux avec lingots sur les deux côtés X (entrées) ; goulotte et plaques estampées devant
    (sortie) ; petite chaudière verticale derrière à droite (foyer rougeoyant côté +Y, cheminée, manomètre, conduite de
    vapeur en cuivre vers le cylindre), charbon ; râtelier à moules (plaque, engrenage) derrière à gauche ; levier.
    Pièce mobile : groupe `marteau_` (monte et descend), pivot `pivot_marteau`.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    """
    rnd = random.Random(41)
    bv = 0.0 if leger else 1.0
    seg = 12 if leger else 24
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'pieces')
    mar = T.Lot(coll, 'marteau')  # pièces du marteau (bougent avec lui)
    y0 = -0.15  # plan du bâti et de l'enclume

    # --- Massif de pierre (z 0 -> 0,3) : pierres en relief sur les faces.
    T.box(coll, 'massif', (2.5, 1.3, 0.3), (0, y0, 0.15), 'pierre_sombre', bevel=0.03)
    T.parement(lot, [('y', y0 - 0.65, -1.2, 1.2, -1), ('y', y0 + 0.65, -1.2, 1.2, 1),
                     ('x', -1.25, y0 - 0.6, y0 + 0.6, -1), ('x', 1.25, y0 - 0.6, y0 + 0.6, 1)],
               (0.08, 0.22), seed=5, densite=0.5 if leger else 0.75, teintes=T.PIERRES, haut=(0.11, 0.13),
               bevel=0.012 * bv)

    # --- Chabotte, enclume, matrice basse et lopin en cours d'estampage.
    T.box(coll, 'chabotte', (1.0, 0.8, 0.32), (0, y0, 0.46), 'fonte', bevel=0.03)
    T.box(coll, 'enclume', (0.7, 0.56, 0.1), (0, y0, 0.67), 'acier', bevel=0.015)
    T.box(coll, 'matrice_basse', (0.42, 0.36, 0.04), (0, y0, 0.74), 'acier_sombre', bevel=0.008)
    lot.cube('braise', (0.2, 0.2, 0.02), (0, y0, 0.77), 0)  # lopin chauffé au rouge
    for sx in (-1, 1):  # clavettes qui serrent l'enclume
        lot.cube('acier_sombre', (0.06, 0.6, 0.06), (sx * 0.38, y0, 0.66), 0.008 * bv)

    # --- Bâti en fonte : deux jambes inclinées (semelles boulonnées), nervures, glissières, consoles, traverse.
    zb0, zb1, xb0, xb1 = 0.3, 1.95, 0.98, 0.5
    for s in (-1, 1):
        a, b = Vector((s * xb0, y0, zb0)), Vector((s * xb1, y0, zb1))
        d = b - a
        rot = Matrix.Rotation(math.atan2(d.x, d.z), 3, 'Y')
        T.box(coll, f'jambe_{s}', (0.26, 0.46, d.length), (0, 0, 0), 'vert_fonce', bevel=0.03).matrix_basis = \
            Matrix.Translation((a + b) / 2) @ rot.to_4x4()
        lot.cube('acier_sombre', (0.06, 0.12, d.length - 0.2), tuple((a + b) / 2 + rot @ Vector((s * 0.15, 0, 0))), 0.01 * bv,
                 rot)  # nervure extérieure
        lot.cube('fonte', (0.5, 0.62, 0.08), (s * xb0, y0, zb0 + 0.04), 0.015)  # semelle
        for dx in (-0.18, 0.18):
            for dy in (-0.24, 0.24):
                lot.cube('acier', (0.05, 0.05, 0.04), (s * xb0 + dx, y0 + dy, zb0 + 0.1), 0)  # boulons
        # Glissière du marteau et consoles qui la tiennent à la jambe.
        lot.cube('acier', (0.06, 0.16, 1.2), (s * 0.3, y0, 1.35), 0.01 * bv)
        for z in (1.1, 1.7):
            xj = xb0 + (xb1 - xb0) * (z - zb0) / (zb1 - zb0) - 0.13
            lot.cube('fonte', (xj - 0.33, 0.14, 0.1), (s * (0.33 + xj) / 2, y0, z), 0.01 * bv)
    T.box(coll, 'traverse', (1.5, 0.52, 0.22), (0, y0, 2.05), 'vert_fonce', bevel=0.03)
    T.box(coll, 'traverse_chapeau', (1.3, 0.44, 0.04), (0, y0, 2.18), 'acier_sombre', bevel=0.01)
    for x in (-0.6, -0.4, 0.4, 0.6):
        for z in (1.99, 2.11):
            lot.cube('acier', (0.04, 0.03, 0.04), (x, y0 - 0.27, z), 0)  # rivets
    T.cylinder(coll, 'presse_etoupe', 0.1, 0.08, (0, y0, 1.9), 'acier_sombre', segments=sg)

    # --- Cylindre à vapeur sur la traverse : cerclages, couvercle boulonné, boîte à tiroir.
    zc0, zc1 = 2.2, 2.5
    T.cylinder(coll, 'cylindre', 0.25, zc1 - zc0, (0, y0, (zc0 + zc1) / 2), 'fonte', segments=seg)
    for z in (zc0 + 0.04, zc1 - 0.04):
        T.cylinder(coll, f'cylindre_cercle_{z}', 0.27, 0.04, (0, y0, z), 'acier_sombre', segments=seg)
    T.cylinder(coll, 'cylindre_couvercle', 0.22, 0.04, (0, y0, zc1 + 0.02), 'acier', segments=seg)
    for k in range(8):
        t = 2 * math.pi * k / 8
        lot.cube('acier_sombre', (0.035, 0.035, 0.03), (0.18 * math.cos(t), y0 + 0.18 * math.sin(t), zc1 + 0.05), 0)
    T.box(coll, 'boite_tiroir', (0.2, 0.24, 0.26), (0.32, y0, (zc0 + zc1) / 2), 'acier_sombre', bevel=0.02)

    # --- Marteau (groupe `marteau_`) : masse, plaque avant rivetée, matrice haute, tige du piston, crosse.
    zm0 = 0.96  # bas de la matrice haute (course de 0,2 jusqu'à la matrice basse)
    T.box(coll, 'marteau_masse', (0.5, 0.42, 0.45), (0, y0, zm0 + 0.08 + 0.225), 'acier_sombre', bevel=0.03)
    T.box(coll, 'marteau_matrice', (0.4, 0.34, 0.08), (0, y0, zm0 + 0.04), 'acier', bevel=0.01)
    mar.cube('fonte', (0.36, 0.03, 0.3), (0, y0 - 0.22, zm0 + 0.3), 0.008 * bv)
    for dx in (-0.13, 0.13):
        for dz in (-0.1, 0.1):
            mar.cube('acier', (0.035, 0.03, 0.035), (dx, y0 - 0.24, zm0 + 0.3 + dz), 0)
    mar.cube('fonte', (0.24, 0.2, 0.08), (0, y0, zm0 + 0.57), 0.01 * bv)  # crosse
    mar.tube('acier', (0, y0, zm0 + 0.6), (0, y0, 2.3), 0.05, sg)  # tige du piston (entre dans le cylindre)
    T.pivot(coll, 'pivot_marteau', (0, y0, zm0))

    # --- Tables à rouleaux sur les deux côtés X (entrées des lingots) : fer à gauche, cuivre à droite.
    yt, zt = y0 - 0.45, 0.62
    for s, mat in ((-1, 'acier'), (1, 'cuivre')):
        x0, x1 = s * 0.42, s * 1.45
        for dy in (-0.15, 0.15):
            lot.cube('acier_sombre', (abs(x1 - x0), 0.04, 0.08), ((x0 + x1) / 2, yt + dy, zt), 0.006 * bv)
        n = 7
        for k in range(n):
            x = x0 + (x1 - x0) * (k + 0.5) / n
            lot.tube('acier', (x, yt - 0.13, zt + 0.01), (x, yt + 0.13, zt + 0.01), 0.03, 6)
        for x in (s * 0.6, s * 1.35):
            for dy in (-0.15, 0.15):
                lot.cube('acier_sombre', (0.05, 0.05, zt - 0.04), (x, yt + dy, (zt - 0.04) / 2), 0)  # pieds
        for k, x in enumerate((s * 0.75, s * 1.1)):
            lot.cube(mat, (0.26, 0.12, 0.07), (x, yt + rnd.uniform(-0.03, 0.03), zt + 0.08), 0.01 * bv,
                     Matrix.Rotation(rnd.uniform(-0.1, 0.1), 3, 'Z'))  # lingots

    # --- Sortie devant : goulotte inclinée et plaques estampées.
    yg0, yg1, zg0, zg1 = y0 - 0.42, -1.45, 0.6, 0.2
    d = Vector((0, yg1 - yg0, zg1 - zg0))
    pente = Matrix.Rotation(math.atan2(d.z, d.y), 3, 'X')
    c = Vector((0, (yg0 + yg1) / 2, (zg0 + zg1) / 2))
    lot.cube('fonte', (0.5, d.length, 0.04), tuple(c), 0.01 * bv, pente)
    for x in (-0.27, 0.27):
        lot.cube('acier_sombre', (0.04, d.length, 0.1), tuple(c + Vector((x, 0, 0.03))), 0, pente)
    lot.cube('acier_sombre', (0.5, 0.06, zg1), (0, yg1 + 0.06, zg1 / 2), 0)  # pied de la goulotte
    for k in range(3):
        lot.cube('acier', (0.22, 0.22, 0.02), (rnd.uniform(-0.05, 0.05), -1.3 + rnd.uniform(-0.03, 0.03), 0.29 + k * 0.025),
                 0, pente @ Matrix.Rotation(rnd.uniform(-0.2, 0.2), 3, 'Z'))

    # --- Chaudière verticale derrière à droite : foyer côté +Y, cerclages, dôme, cheminée, manomètre.
    xc, yc, rc = 0.82, 0.95, 0.34
    T.cylinder(coll, 'chaudiere_socle', rc + 0.05, 0.14, (xc, yc, 0.07), 'pierre_sombre', segments=seg)
    T.cylinder(coll, 'chaudiere', rc, 1.3, (xc, yc, 0.14 + 0.65), 'fonte', segments=seg)
    for z in (0.4, 0.9, 1.35):
        T.cylinder(coll, f'chaudiere_cercle_{z}', rc + 0.02, 0.05, (xc, yc, z), 'cuivre', segments=seg)
    T.cylinder(coll, 'chaudiere_dome', rc, 0.18, (xc, yc, 1.53), 'fonte', segments=seg, radius_top=0.12)
    T.box(coll, 'foyer', (0.3, 0.06, 0.24), (xc, yc + rc - 0.01, 0.42), 'noir')
    T.box(coll, 'foyer_lueur', (0.22, 0.04, 0.14), (xc, yc + rc + 0.01, 0.4), 'braise')
    lot.cube('acier_sombre', (0.36, 0.04, 0.04), (xc, yc + rc + 0.02, 0.56), 0)
    lot.tube('fonte', (xc, yc, 1.6), (xc, yc, 2.42), 0.09, sg)  # cheminée
    T.cylinder(coll, 'cheminee_chapeau', 0.1, 0.1, (xc, yc, 2.47), 'fonte', segments=sg, radius_top=0.15)
    T.cylinder_at(coll, 'manometre', 0.07, 0.03, (xc - rc - 0.02, yc, 1.1), 'acier_sombre', segments=sg, y=90)
    T.cylinder_at(coll, 'manometre_cadran', 0.055, 0.01, (xc - rc - 0.04, yc, 1.1), 'blanc', segments=sg, y=90)
    lot.cube('rouge', (0.008, 0.01, 0.05), (xc - rc - 0.046, yc, 1.12), 0)  # aiguille
    # Conduite de vapeur en cuivre : du dôme jusqu'à la boîte à tiroir du cylindre.
    pts = [Vector((xc, yc, 1.62)), Vector((xc, yc, 2.35)), Vector((xc, y0, 2.35)), Vector((0.42, y0, 2.35))]
    for p, q in zip(pts, pts[1:]):
        lot.tube('cuivre', p, q, 0.045, sg)
    for p in pts[1:3]:
        lot.boule('cuivre', p, 0.055)
    T.cylinder(coll, 'vanne_vapeur', 0.07, 0.04, (xc, yc, 2.1), 'rouge', segments=sg)
    # Charbon derrière le foyer.
    for _ in range(4 if leger else 9):
        s = rnd.uniform(0.08, 0.12)
        lot.cube('noir', (s, s, s * 0.8), (xc + rnd.uniform(-0.25, 0.25), 1.36 + rnd.uniform(-0.02, 0.02), s * 0.4),
                 0.02 * bv, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    # --- Râtelier à moules derrière à gauche : moule à plaque et moule à engrenage.
    xr, yr = -0.85, 0.95
    for dx in (-0.35, 0.35):
        lot.cube('bois_sombre', (0.08, 0.08, 1.2), (xr + dx, yr, 0.6), 0.01 * bv)
    lot.cube('bois', (0.82, 0.07, 0.07), (xr, yr, 1.15), 0.01 * bv)
    lot.cube('bois', (0.82, 0.07, 0.07), (xr, yr, 0.25), 0.01 * bv)
    lot.cube('acier_sombre', (0.28, 0.06, 0.28), (xr - 0.17, yr - 0.06, 0.9), 0.01 * bv)  # moule à plaque
    lot.cube('noir', (0.18, 0.01, 0.18), (xr - 0.17, yr - 0.095, 0.9), 0)
    T.cylinder_at(coll, 'moule_engrenage', 0.13, 0.06, (xr + 0.17, yr - 0.06, 0.9), 'fonte', segments=sg, x=90)
    for k in range(8):
        t = 2 * math.pi * k / 8
        lot.cube('fonte', (0.05, 0.06, 0.05), (xr + 0.17 + 0.15 * math.cos(t), yr - 0.06, 0.9 + 0.15 * math.sin(t)), 0,
                 Matrix.Rotation(-t, 3, 'Y'))
    for x in (xr - 0.17, xr + 0.17):
        lot.cube('acier', (0.03, 0.03, 0.1), (x, yr - 0.04, 1.08), 0)  # crochets

    # --- Levier de commande (derrière le bâti, à gauche).
    lot.cube('fonte', (0.14, 0.14, 0.12), (-0.55, y0 + 0.45, 0.36), 0.01 * bv)
    lot.barre('acier', (-0.55, y0 + 0.45, 0.4), (-0.55, y0 + 0.3, 0.95), 0.04, 0)
    lot.boule('rouge', (-0.55, y0 + 0.3, 0.97), 0.05)

    for l in (lot, mar):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'estampeuse_t1': estampeuse_t1}


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
