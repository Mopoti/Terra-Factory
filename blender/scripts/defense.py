"""Famille « défense » : tourelles de base, lourde, laser et à plasma.

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md. Le canon vise l'avant (-Y) au repos.

Lancer :  blender --background --python blender/scripts/defense.py
Produit :  blender/defense.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


def _socle(lot, dx, dy, mat='acier_sombre', bande=True):
    """Dalle blindée sur toute l'emprise, chanfrein, bandes de danger devant."""
    lot.cube(mat, (2 * dx - 0.08, 2 * dy - 0.08, 0.22), (0, 0, 0.11), 0.04)
    lot.cube('fonte', (2 * dx - 0.3, 2 * dy - 0.3, 0.06), (0, 0, 0.25), 0.02)
    if bande:
        for k in range(int(2 * dx / 0.3)):
            x = -dx + 0.2 + k * 0.3
            if abs(x) > dx - 0.15:
                continue
            lot.cube('jaune' if k % 2 == 0 else 'noir', (0.15, 0.06, 0.05), (x, -dy + 0.06, 0.2))


def _fut(coll, lot, c, z0, z1, seg, mat='acier_sombre', liseré='jaune'):
    """Fût qui surélève la tourelle (de la couronne z0 au plateau z1) : colonne à pans, contreforts, bague colorée."""
    x, y = c
    T.cylinder(coll, 'fut', 0.42, z1 - z0, (x, y, (z0 + z1) / 2), mat, segments=8)
    lot.tube('fonte', (x, y, z1 - 0.06), (x, y, z1), 0.5, seg)  # couronne d'orientation
    lot.tube(liseré, (x, y, z0 + 0.12), (x, y, z0 + 0.17), 0.43, 8)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        lot.barre(mat, (x + 0.62 * math.cos(a), y + 0.62 * math.sin(a), z0 - 0.02),
                  (x + 0.36 * math.cos(a), y + 0.36 * math.sin(a), z1 - 0.12), 0.09)


def _canon(g, a, b, r, sg, mat='acier_sombre', frein=True):
    """Tube de canon de `a` vers `b`, frein de bouche au bout."""
    a, b = Vector(a), Vector(b)
    g.tube(mat, a, b, r, sg)
    d = (b - a).normalized()
    if frein:
        g.tube('fonte', b - d * 0.14, b, r * 1.6, sg)
        g.tube('noir', b - d * 0.005, b + d * 0.002, r * 0.7, sg)


def tourelle_lourde(coll, leger=True):
    """Tourelle lourde (`turret_heavy`) : 3 x 2 cases (X : 3, Y : 2), 1 m de haut (modèle jusqu'à 2,6 unités).

    Dalle blindée, caisses de munitions sur les côtés, couronne ; tourelle (groupe `tourelle_`, balaye l'horizon quand
    elle est prête) : caisse verte blindée, masque, deux canons à frein de bouche, bande de munitions, viseur, trappe.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, tr = T.Lot(coll, 'pieces'), T.Lot(coll, 'tourelle')
    _socle(lot, 1.5, 1.0)
    T.cylinder(coll, 'couronne', 0.8, 0.18, (0, 0.1, 0.37), 'acier_sombre', segments=seg)
    for sx in (-1, 1):  # caisses de munitions
        for k in range(2):
            y = -0.35 + k * 0.6
            lot.cube('vert_fonce', (0.5, 0.42, 0.34), (sx * 1.1, y, 0.45), 0.02)
            lot.cube('jaune', (0.3, 0.012, 0.1), (sx * 1.1, y - 0.215, 0.5))
            lot.cube('acier', (0.3, 0.06, 0.04), (sx * 1.1, y, 0.64))
    zt = 0.95
    _fut(coll, lot, (0, 0.1), 0.46, zt, seg)
    tr.tube('fonte', (0, 0.1, zt), (0, 0.1, zt + 0.08), 0.75, seg)  # plateau
    tr.cube('vert_fonce', (1.1, 0.95, 0.55), (0, 0.18, zt + 0.36), 0.05)  # caisse blindée
    tr.cube('vert_fonce', (0.9, 0.7, 0.18), (0, 0.22, zt + 0.72), 0.04)  # toit
    tr.cube('fonte', (0.8, 0.14, 0.42), (0, -0.33, zt + 0.36), 0.03)  # masque
    for sx in (-1, 1):
        _canon(tr, (sx * 0.2, -0.38, zt + 0.38), (sx * 0.2, -0.98, zt + 0.38), 0.065, sg)
        tr.tube('fonte', (sx * 0.2, -0.38, zt + 0.38), (sx * 0.2, -0.55, zt + 0.38), 0.1, sg)  # manchon
    tr.cube('acier_sombre', (0.2, 0.5, 0.3), (0.62, 0.15, zt + 0.35), 0.02)  # boîte d'alimentation
    for k in range(6):
        tr.cube('jaune', (0.04, 0.06, 0.1), (0.48 - k * 0.05, -0.1 + k * 0.02, zt + 0.54))  # bande de munitions
    tr.cube('acier', (0.12, 0.2, 0.12), (-0.3, -0.05, zt + 0.86), 0.01)  # viseur
    tr.cube('noir', (0.1, 0.02, 0.07), (-0.3, -0.155, zt + 0.86))
    tr.tube('acier_sombre', (0.18, 0.35, zt + 0.81), (0.18, 0.35, zt + 0.86), 0.16, 12)  # trappe
    T.pivot(coll, 'pivot_tourelle', (0, 0.1, zt), (0, 0, 1))
    for l in (lot, tr):
        l.finir()
    T.poser_au_sol(coll, 1.5, 1.0)


def tourelle_laser(coll, leger=True):
    """Tourelle laser (`turret_laser`) : 3 x 2 cases, 1 m de haut (modèle jusqu'à 2,6 unités), électrique.

    Socle clair avec bancs de condensateurs à bagues cyan (`voyant_*` pulsent quand elle est alimentée), borne
    électrique ; tourelle (groupe `tourelle_`) : tête arrondie blanche, émetteur long à ailettes de refroidissement,
    lentille cyan au bout.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, tr = T.Lot(coll, 'pieces'), T.Lot(coll, 'tourelle')
    _socle(lot, 1.5, 1.0, mat='gris_clair')
    T.cylinder(coll, 'couronne', 0.7, 0.2, (0, 0.05, 0.38), 'acier_sombre', segments=seg)
    for sx in (-1, 1):  # condensateurs
        for k in range(2):
            y = -0.3 + k * 0.55
            T.cylinder(coll, f'condensateur_{sx}_{k}', 0.18, 0.55, (sx * 1.12, y, 0.28 + 0.275), 'blanc', segments=12)
            T.cylinder(coll, f'voyant_condensateur_{sx}_{k}', 0.19, 0.06, (sx * 1.12, y, 0.62), 'cyan', segments=12)
            lot.tube('acier_sombre', (sx * 1.12, y, 0.83), (sx * 1.12, y, 0.88), 0.12, 12)
    T.borne_electrique(coll, lot, (1.3, 0.75, 0.25), 0.7, sg)
    zt = 0.95
    _fut(coll, lot, (0, 0.05), 0.48, zt, seg, mat='gris_clair', liseré='cyan')
    tr.tube('acier_sombre', (0, 0.05, zt), (0, 0.05, zt + 0.08), 0.62, seg)
    tr.cube('blanc', (0.8, 0.8, 0.45), (0, 0.12, zt + 0.32), 0.12)  # tête arrondie (biseau fort)
    tr.cube('gris_clair', (0.5, 0.5, 0.15), (0, 0.15, zt + 0.6), 0.05)
    tr.tube('blanc', (0, -0.25, zt + 0.34), (0, -0.98, zt + 0.34), 0.08, sg)  # émetteur
    for k in range(5 if leger else 8):  # ailettes
        y = -0.35 - k * 0.45 / ((5 if leger else 8) - 1)
        tr.tube('acier', (0, y - 0.015, zt + 0.34), (0, y + 0.015, zt + 0.34), 0.13, sg)
    tr.tube('cyan', (0, -0.93, zt + 0.34), (0, -0.99, zt + 0.34), 0.06, sg)  # lentille
    tr.cube('cyan', (0.5, 0.02, 0.06), (0, -0.29, zt + 0.5))  # liseré
    T.pivot(coll, 'pivot_tourelle', (0, 0.05, zt), (0, 0, 1))
    for l in (lot, tr):
        l.finir()
    T.poser_au_sol(coll, 1.5, 1.0)


def tourelle_plasma(coll, leger=True):
    """Tourelle à plasma (`turret_plasma`) : 3 x 3 cases, 1 m de haut (modèle jusqu'à 2,6 unités), électrique.

    Socle octogonal, réservoirs de gaz, voyants roses (`voyant_*`, pulsent alimentée), borne électrique ; tourelle
    (groupe `tourelle_`) massive : chambre à plasma rose à l'arrière du canon, trois bobines d'accélération en cuivre
    autour du tube, bouche évasée.
    """
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot, tr = T.Lot(coll, 'pieces'), T.Lot(coll, 'tourelle')
    T.cylinder(coll, 'socle', 1.48, 0.25, (0, 0, 0.125), 'acier_sombre', segments=8)
    T.cylinder(coll, 'socle_haut', 1.2, 0.1, (0, 0, 0.3), 'fonte', segments=8)
    T.cylinder(coll, 'couronne', 0.85, 0.18, (0, 0, 0.44), 'acier_sombre', segments=seg)
    for k in range(4):  # réservoirs de gaz et voyants
        a = math.pi / 4 + k * math.pi / 2
        x, y = 1.05 * math.cos(a), 1.05 * math.sin(a)
        T.cylinder(coll, f'reservoir_{k}', 0.16, 0.6, (x, y, 0.35 + 0.3), 'inox', segments=10)
        lot.boule('inox', (x, y, 0.95), 0.16)
        T.box(coll, f'voyant_{k}', (0.1, 0.1, 0.06), (x * 0.82, y * 0.82, 0.38), 'plasma')
    T.borne_electrique(coll, lot, (1.05, 0.0, 0.25), 0.8, sg)
    zt = 0.92
    _fut(coll, lot, (0, 0), 0.53, zt, seg, liseré='plasma')
    tr.tube('fonte', (0, 0, zt), (0, 0, zt + 0.08), 0.8, seg)
    tr.cube('acier_sombre', (1.0, 1.0, 0.5), (0, 0.15, zt + 0.33), 0.06)
    tr.cube('violet', (0.7, 0.6, 0.12), (0, 0.2, zt + 0.64), 0.03)
    tr.boule('plasma', (0, 0.25, zt + 0.82), 0.22)  # chambre à plasma
    tr.tube('inox', (0, 0.25, zt + 0.6), (0, 0.25, zt + 0.7), 0.2, 12)
    tr.tube('acier_sombre', (0, -0.3, zt + 0.42), (0, -1.38, zt + 0.42), 0.12, sg)  # canon
    for k in range(3):  # bobines d'accélération
        y = -0.55 - k * 0.3
        tr.tube('cuivre', (0, y - 0.05, zt + 0.42), (0, y + 0.05, zt + 0.42), 0.22, sg)
        tr.tube('plasma', (0, y - 0.06, zt + 0.42), (0, y + 0.06, zt + 0.42), 0.14, sg)
    T.cylinder_at(coll, 'tourelle_bouche', 0.14, 0.16, (0, -1.42, zt + 0.42), 'acier_sombre', segments=sg, x=90, radius_top=0.22)
    T.pivot(coll, 'pivot_tourelle', (0, 0, zt), (0, 0, 1))
    for l in (lot, tr):
        l.finir()
    T.poser_au_sol(coll, 1.5)


def tourelle_base(coll, leger=True):
    """Tourelle de base (`turret`) : 3 x 2 cases, 1 m de haut (modèle jusqu'à 2,6 unités), munitions simples.

    Premier palier, bricolée : plancher de madriers, ceinture de sacs de sable, caisse de munitions en bois ; trépied
    en acier qui porte la tourelle (groupe `tourelle_`, balaye l'horizon quand elle est prête) : mitrailleuse à
    manchon de refroidissement percé, bouclier d'acier, boîte de munitions et bande de cartouches.
    """
    sg = 8 if leger else 14
    lot, tr = T.Lot(coll, 'pieces'), T.Lot(coll, 'tourelle')
    # Plancher de madriers sur deux traverses.
    for y in (-0.6, 0.6):
        lot.cube('bois_sombre', (2.9, 0.18, 0.1), (0, y, 0.05), 0.01)
    for k in range(7):
        x = -1.29 + k * 0.43
        lot.cube('bois' if k % 2 == 0 else 'bois_sec', (0.4, 1.9, 0.08), (x, 0, 0.14), 0.012)
    # Sacs de sable en arc devant et sur les côtés (deux rangs).
    for rang in range(2):
        z = 0.27 + rang * 0.17
        n = 9 if rang == 0 else 8
        for k in range(n):
            a = math.pi * (0.08 + 0.84 * (k + (0.5 if rang else 0)) / (n - 1 + (1 if rang else 0)))
            x, y = 1.05 * math.cos(a), -0.12 - 0.72 * math.sin(a)
            lot.cube('sable' if (k + rang) % 2 == 0 else 'herbe_seche', (0.36, 0.2, 0.16), (x, y, z), 0.06,
                     Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    # Caisse de munitions en bois à l'arrière.
    lot.cube('bois', (0.55, 0.36, 0.3), (1.0, 0.62, 0.33), 0.02)
    lot.cube('vert_fonce', (0.3, 0.012, 0.12), (1.0, 0.44, 0.35))
    lot.cube('bois_sombre', (0.57, 0.38, 0.04), (1.0, 0.62, 0.47))
    # Trépied et pivot.
    zt = 0.95
    c = Vector((0, 0.15, 0))
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        lot.barre('acier_sombre', (c.x + 0.55 * math.cos(a), c.y + 0.55 * math.sin(a), 0.18), (c.x, c.y, zt - 0.1), 0.06)
        lot.cube('fonte', (0.12, 0.12, 0.04), (c.x + 0.55 * math.cos(a), c.y + 0.55 * math.sin(a), 0.2))
    lot.tube('acier_sombre', (c.x, c.y, zt - 0.2), (c.x, c.y, zt), 0.09, sg)
    # Tourelle : berceau, mitrailleuse, bouclier.
    tr.tube('fonte', (c.x, c.y, zt), (c.x, c.y, zt + 0.06), 0.16, sg)
    tr.cube('acier_sombre', (0.24, 0.5, 0.2), (c.x, c.y - 0.05, zt + 0.16), 0.02)  # boîte de culasse
    tr.tube('vert_fonce', (c.x, c.y - 0.3, zt + 0.18), (c.x, c.y - 0.85, zt + 0.18), 0.075, sg)  # manchon
    for k in range(4 if leger else 7):
        y = c.y - 0.38 - k * (0.4 / (3 if leger else 6))
        tr.tube('noir', (c.x, y, zt + 0.18), (c.x, y - 0.03, zt + 0.18), 0.078, sg)  # trous du manchon
    _canon(tr, (c.x, c.y - 0.85, zt + 0.18), (c.x, c.y - 1.0, zt + 0.18), 0.03, sg)
    tr.cube('acier', (0.75, 0.04, 0.42), (c.x, c.y - 0.42, zt + 0.22), 0.01)  # bouclier
    tr.cube('noir', (0.12, 0.05, 0.08), (c.x, c.y - 0.42, zt + 0.2))  # embrasure
    tr.cube('vert_fonce', (0.18, 0.24, 0.16), (c.x + 0.2, c.y + 0.0, zt + 0.12), 0.015)  # boîte de munitions
    for k in range(5):
        tr.cube('laiton', (0.03, 0.05, 0.07), (c.x + 0.13 - k * 0.025, c.y - 0.08, zt + 0.22 - k * 0.01))
    tr.barre('acier_sombre', (c.x, c.y + 0.2, zt + 0.15), (c.x, c.y + 0.42, zt + 0.05), 0.04)  # poignées
    tr.cube('noir', (0.24, 0.05, 0.05), (c.x, c.y + 0.43, zt + 0.05))
    T.pivot(coll, 'pivot_tourelle', (c.x, c.y, zt), (0, 0, 1))
    for l in (lot, tr):
        l.finir()
    T.poser_au_sol(coll, 1.5, 1.0)


MODELES = {
    'tourelle_base': tourelle_base,
    'tourelle_lourde': tourelle_lourde,
    'tourelle_laser': tourelle_laser,
    'tourelle_plasma': tourelle_plasma,
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
    T.save(os.path.join(ROOT, 'blender', 'defense.blend'))


if __name__ == '__main__':
    main()
