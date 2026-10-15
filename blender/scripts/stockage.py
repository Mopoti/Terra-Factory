"""Famille « stockage » : coffres en bois et en fer (et plus tard entrepôts, citernes…).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/stockage.py
Produit :  blender/stockage.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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

# Cotes communes (2 x 2 cases, 0,5 m de haut dans le jeu : modèle jusqu'à 1,3 unité, couvercle fermé).
DX, DY = 0.86, 0.64     # demi-largeur et demi-profondeur de la caisse
Z0, Z1 = 0.08, 0.76     # dessous de la caisse (sur ses patins), haut de la caisse
ZC = 1.22               # haut du couvercle bombé


def _contenu(lot, rnd):
    """Fond sombre et quelques marchandises, visibles quand le couvercle est ouvert."""
    lot.cube('noir', (2 * DX - 0.14, 2 * DY - 0.14, 0.02), (0, 0, Z1 - 0.1))
    for mat, x, y, s in (('cuivre', -0.42, -0.2, 0.2), ('acier', -0.05, 0.12, 0.22), ('pierre_claire', 0.4, -0.15, 0.18),
                         ('jaune', 0.15, -0.3, 0.14), ('bois', 0.48, 0.25, 0.2)):
        lot.cube(mat, (s, s * 0.7, 0.08), (x, y, Z1 - 0.05), 0.01, Matrix.Rotation(rnd.uniform(-0.4, 0.4), 3, 'Z'))


def _couvercle(cv, fer, leger):
    """Couvercle (groupe `couvercle_`) : cadre et dessus bombé à pans (planches ou tôles), renforts, moraillon."""
    n = 4 if leger else 6  # pans du bombé
    cadre = 'fonte' if not fer else 'acier_sombre'
    cv.cube(cadre if fer else 'bois_sombre', (2 * DX + 0.04, 2 * DY + 0.04, 0.1), (0, 0, Z1 + 0.05), 0.01)  # ceinture
    # Bombé : pans posés sur un arc (axe X), de l'arrière à l'avant.
    r = (DY + 0.02) / math.sin(math.radians(60))
    zc = ZC - r
    for k in range(n):
        a0 = math.radians(60) - k * math.radians(120) / n
        a1 = a0 - math.radians(120) / n
        p0 = Vector((0, r * math.sin(a0), zc + r * math.cos(a0)))
        p1 = Vector((0, r * math.sin(a1), zc + r * math.cos(a1)))
        m = (p0 + p1) / 2
        ang = math.atan2(p1.z - p0.z, p1.y - p0.y)
        rot = Matrix.Rotation(ang, 3, 'X')
        if fer:
            mat = 'acier' if k % 2 == 0 else 'gris_clair'
        else:
            mat = 'bois' if k % 2 == 0 else 'bois_sombre'
        cv.cube(mat, (2 * DX, (p1 - p0).length + 0.01, 0.06), tuple(m), 0.008, rot)
        for x in (-DX + 0.02, DX - 0.02):  # joues (flancs du bombé)
            cv.cube(cadre if fer else 'bois_sombre', (0.04, (p1 - p0).length + 0.01, 0.12), (x, m.y, m.z - 0.04), 0, rot)
        for x in (-0.5, 0.5):  # renforts qui passent sur le bombé
            cv.cube(cadre, (0.1, (p1 - p0).length + 0.012, 0.075), tuple(m + Vector((x, 0, 0.004))), 0, rot)
            if not leger or k % 2 == 0:
                cv.cube('acier', (0.035, 0.035, 0.035), tuple(m + Vector((x, 0, 0.05))), 0, rot)  # rivets
    # Comble les pignons sous le bombé : tranches de plus en plus étroites (la largeur suit l'arc à leur sommet).
    z = Z1 + 0.1
    while z < ZC - 0.06:
        z2 = min(ZC - 0.05, z + 0.08)
        y = r * math.sin(math.acos(max(-1.0, min(1.0, (z2 - zc) / r))))
        for x in (-DX + 0.02, DX - 0.02):
            cv.cube(cadre if fer else 'bois_sombre', (0.04, 2 * y, z2 - z), (x, 0, (z + z2) / 2))
        z = z2
    # Moraillon devant (pend sur la serrure).
    cv.cube('fonte', (0.12, 0.03, 0.2), (0, -DY - 0.035, Z1 + 0.04))
    cv.cube('acier', (0.05, 0.035, 0.05), (0, -DY - 0.045, Z1 - 0.03))


def _coffre(coll, leger, fer):
    rnd = random.Random(31 if fer else 30)
    sg = 8 if leger else 14
    lot, cv = T.Lot(coll, 'pieces'), T.Lot(coll, 'couvercle')
    renfort = 'acier_sombre' if fer else 'fonte'
    # --- Patins sous la caisse.
    for x in (-DX + 0.16, DX - 0.16):
        lot.cube(renfort if fer else 'bois_sombre', (0.18, 2 * DY + 0.06, Z0), (x, 0, Z0 / 2), 0.01)
    # --- Caisse.
    h = Z1 - Z0
    if fer:
        lot.cube('acier', (2 * DX, 2 * DY, h), (0, 0, Z0 + h / 2), 0.02)
        for k in range(3):  # tôles en relief (panneaux emboutis) sur chaque face
            z = Z0 + 0.12 + k * 0.2
            for s in (-1, 1):
                lot.cube('gris_clair', (2 * DX - 0.3, 0.02, 0.14), (0, s * (DY + 0.005), z), 0.005)
                lot.cube('gris_clair', (0.02, 2 * DY - 0.3, 0.14), (s * (DX + 0.005), 0, z), 0.005)
        lot.cube('jaune', (0.5, 0.012, 0.05), (-0.45, -DY - 0.012, Z1 - 0.07))  # bande de repérage
        lot.cube('noir', (0.5, 0.013, 0.02), (-0.45, -DY - 0.013, Z1 - 0.07))
    else:
        for k in range(4):  # planches horizontales en relief, teintes alternées
            z = Z0 + (k + 0.5) * h / 4
            for s in (-1, 1):
                mat = ('bois', 'bois_sombre')[(k + (s > 0)) % 2]
                lot.cube(mat, (2 * DX - 0.12, 0.05, h / 4 - 0.012), (0, s * (DY - 0.02), z), 0.008)
                lot.cube(mat, (0.05, 2 * DY - 0.12, h / 4 - 0.012), (s * (DX - 0.02), 0, z), 0.008)
        lot.cube('bois_sombre', (2 * DX - 0.1, 2 * DY - 0.1, 0.04), (0, 0, Z0 + 0.02))  # fond
    # Poteaux d'angle, renforts verticaux, rivets.
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.cube(renfort, (0.12, 0.12, h + 0.02), (sx * (DX - 0.03), sy * (DY - 0.03), Z0 + h / 2), 0.01)
            lot.cube('acier', (0.05, 0.05, 0.05), (sx * (DX + 0.02), sy * (DY - 0.03), Z1 - 0.06))
            lot.cube('acier', (0.05, 0.05, 0.05), (sx * (DX + 0.02), sy * (DY - 0.03), Z0 + 0.06))
    for x in (-0.5, 0.5):
        for s in (-1, 1):
            lot.cube(renfort, (0.1, 0.03, h), (x, s * (DY + 0.012), Z0 + h / 2))
            for z in (Z0 + 0.08, Z0 + h / 2, Z1 - 0.08):
                lot.cube('acier', (0.035, 0.035, 0.035), (x, s * (DY + 0.03), z))
    # Serrure et poignées.
    lot.cube('cuivre' if not fer else 'fonte', (0.22, 0.03, 0.2), (0, -DY - 0.02, Z1 - 0.14), 0.01)
    lot.cube('noir', (0.03, 0.035, 0.07), (0, -DY - 0.03, Z1 - 0.16))
    for s in (-1, 1):
        lot.cube('fonte', (0.03, 0.2, 0.05), (s * (DX + 0.02), 0, Z1 - 0.2))
        lot.tube('fonte', (s * (DX + 0.09), -0.09, Z1 - 0.24), (s * (DX + 0.09), 0.09, Z1 - 0.24), 0.02, 6)  # anse
        for dy in (-0.09, 0.09):
            lot.tube('fonte', (s * (DX + 0.02), dy, Z1 - 0.22), (s * (DX + 0.09), dy, Z1 - 0.24), 0.018, 6)
    _contenu(lot, rnd)
    # Charnières à l'arrière (fixes) et couvercle.
    for x in (-0.55, 0.55):
        lot.tube('fonte', (x - 0.1, DY + 0.03, Z1), (x + 0.1, DY + 0.03, Z1), 0.035, sg)
    _couvercle(cv, fer, leger)
    T.pivot(coll, 'pivot_couvercle', (0, DY + 0.03, Z1), (-1, 0, 0))
    lot.finir()
    cv.finir()
    T.poser_au_sol(coll, 1.0)


def coffre_bois(coll, leger=True):
    """Coffre en bois (`chest_wood`) : 2 x 2 cases, 0,5 m de haut (modèle jusqu'à 1,3 unité).

    Caisse en planches de teintes alternées, poteaux d'angle et renforts en fonte rivetés, serrure en cuivre, poignées,
    patins ; couvercle bombé en planches cerclé de fer, moraillon. Marchandises visibles couvercle ouvert.
    Pièce mobile : `couvercle_` (s'ouvre en basculant vers l'arrière autour des charnières).
    """
    _coffre(coll, leger, False)


def coffre_fer(coll, leger=True):
    """Coffre en fer (`chest_iron`) : même forme, en tôles d'acier embouties, renforts sombres rivetés, bande de
    repérage. Pièce mobile : `couvercle_`."""
    _coffre(coll, leger, True)


MODELES = {
    'coffre_bois': coffre_bois,
    'coffre_fer': coffre_fer,
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
    T.save(os.path.join(ROOT, 'blender', 'stockage.blend'))


if __name__ == '__main__':
    main()
