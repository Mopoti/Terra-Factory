"""Famille « véhicules » : buggy (et plus tard d'autres véhicules).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
L'avant du véhicule est du côté -Y. Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/vehicules.py
Produit :  blender/vehicules.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


def _roue(coll, nom, c, r, larg, sg, seg):
    """Roue tout-terrain (groupe `nom`) : pneu, crampons, jante, moyeu ; pivot sur son axe (X)."""
    g = T.Lot(coll, nom)
    x, y, z = c
    g.tube('noir', (x - larg / 2, y, z), (x + larg / 2, y, z), r, seg)
    n = 12 if seg < 20 else 18
    for k in range(n):  # crampons
        a = 2 * math.pi * k / n
        g.cube('fonte', (larg * 0.9, 0.09, 0.05), (x, y + (r + 0.015) * math.cos(a), z + (r + 0.015) * math.sin(a)), 0,
               Matrix.Rotation(a + math.pi / 2, 3, 'X'))
    s = 1 if x > 0 else -1
    g.tube('acier', (x + s * (larg / 2 - 0.02), y, z), (x + s * (larg / 2 + 0.01), y, z), r * 0.6, seg)  # jante
    g.tube('jaune', (x + s * (larg / 2), y, z), (x + s * (larg / 2 + 0.03), y, z), r * 0.25, sg)  # moyeu
    for k in range(5):
        a = 2 * math.pi * k / 5
        g.cube('acier_sombre', (0.04, 0.04, 0.04), (x + s * (larg / 2 + 0.02), y + r * 0.42 * math.cos(a), z + r * 0.42 * math.sin(a)))
    g.finir()
    T.pivot(coll, 'pivot_' + nom, c, (1, 0, 0))


def buggy(coll, leger=True):
    """Buggy : environ 1 m de large, 1,6 m de long (avant = -Y).

    Châssis tubulaire, carrosserie jaune (capot, ailes au-dessus des roues), arceau de sécurité, deux sièges, volant,
    pare-buffle et phares devant ; moteur à l'arrière avec ses deux échappements, coffre en bois (le coffre du buggy) et
    jerrican rouge. Pièces mobiles : `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard` (tournent autour de X quand il roule).
    """
    sg = 8 if leger else 14
    seg = 14 if leger else 24
    lot = T.Lot(coll, 'pieces')
    r, larg = 0.42, 0.28
    xr, yr, zr = 0.8, 1.05, r
    # Châssis et carrosserie.
    lot.cube('acier_sombre', (1.2, 2.7, 0.18), (0, 0, 0.55), 0.02)
    lot.cube('jaune', (1.3, 0.85, 0.26), (0, -1.0, 0.76), 0.06)  # capot
    lot.cube('jaune', (1.25, 0.5, 0.16), (0, -1.38, 0.68), 0.05, Matrix.Rotation(-0.35, 3, 'X'))  # nez
    lot.cube('jaune', (1.3, 1.2, 0.22), (0, 0.15, 0.72), 0.05)  # baquet
    for sx in (-1, 1):  # ailes
        for y in (-yr, yr):
            lot.cube('jaune', (0.34, 0.85, 0.05), (sx * xr, y, zr + r + 0.08), 0.02)
            lot.cube('jaune', (0.34, 0.06, 0.25), (sx * xr, y + (0.42 if y > 0 else -0.42), zr + r - 0.04), 0.01)
        lot.barre('acier_sombre', (sx * 0.55, -yr, 0.55), (sx * (xr - 0.12), -yr, zr), 0.06)  # bras de suspension
        lot.barre('acier_sombre', (sx * 0.55, yr, 0.55), (sx * (xr - 0.12), yr, zr), 0.06)
    # Arceau de sécurité.
    for sx in (-1, 1):
        lot.barre('acier_sombre', (sx * 0.55, -0.4, 0.83), (sx * 0.5, -0.15, 1.7), 0.06)
        lot.barre('acier_sombre', (sx * 0.5, -0.15, 1.7), (sx * 0.5, 0.55, 1.7), 0.06)
        lot.barre('acier_sombre', (sx * 0.5, 0.55, 1.7), (sx * 0.55, 0.75, 0.83), 0.06)
    for y in (-0.15, 0.55):
        lot.barre('acier_sombre', (-0.5, y, 1.7), (0.5, y, 1.7), 0.06)
    lot.barre('acier_sombre', (-0.5, 0.55, 1.7), (0.5, -0.15, 1.7), 0.05)
    # Sièges, volant.
    for sx in (-1, 1):
        lot.cube('noir', (0.42, 0.4, 0.1), (sx * 0.27, 0.25, 0.88), 0.02)
        lot.cube('noir', (0.42, 0.1, 0.5), (sx * 0.27, 0.48, 1.1), 0.02, Matrix.Rotation(-0.15, 3, 'X'))
    lot.barre('acier_sombre', (-0.27, -0.45, 0.9), (-0.27, -0.2, 1.15), 0.04)  # colonne
    lot.tube('noir', (-0.27, -0.21, 1.14), (-0.27, -0.17, 1.2), 0.15, 12)  # volant
    lot.cube('panneau', (0.9, 0.05, 0.18), (0, -0.6, 0.98), 0.01, Matrix.Rotation(0.4, 3, 'X'))  # tableau de bord
    # Pare-buffle, phares.
    for sx in (-1, 1):
        lot.barre('acier_sombre', (sx * 0.5, -1.4, 0.5), (sx * 0.5, -1.6, 0.85), 0.06)
        lot.tube('acier_sombre', (sx * 0.38, -1.25, 0.95), (sx * 0.38, -1.32, 0.95), 0.1, 10)
        lot.tube('blanc', (sx * 0.38, -1.32, 0.95), (sx * 0.38, -1.335, 0.95), 0.08, 10)
    lot.barre('acier_sombre', (-0.5, -1.6, 0.85), (0.5, -1.6, 0.85), 0.06)
    lot.barre('acier_sombre', (-0.5, -1.55, 0.6), (0.5, -1.55, 0.6), 0.06)
    # Moteur, échappements, coffre, jerrican.
    lot.cube('acier', (0.8, 0.5, 0.36), (0, 1.15, 0.82), 0.03)
    for k in range(4):
        lot.cube('acier_sombre', (0.7, 0.04, 0.05), (0, 0.95 + k * 0.13, 1.02))  # ailettes
    for sx in (-1, 1):
        lot.tube('acier', (sx * 0.3, 1.35, 0.8), (sx * 0.3, 1.5, 1.2), 0.05, 8)
        lot.tube('fonte', (sx * 0.3, 1.5, 1.2), (sx * 0.3, 1.52, 1.3), 0.06, 8)
    lot.cube('bois', (0.9, 0.45, 0.32), (0, 1.12, 1.18), 0.02)  # coffre
    lot.cube('bois_sombre', (0.94, 0.49, 0.06), (0, 1.12, 1.36), 0.01)
    lot.cube('fonte', (0.08, 0.02, 0.1), (0, 0.885, 1.22))
    lot.cube('rouge', (0.12, 0.3, 0.38), (-0.62, 0.6, 0.85), 0.02)  # jerrican
    lot.cube('acier_sombre', (0.06, 0.08, 0.06), (-0.62, 0.55, 1.07))
    # Roues (une par groupe, pour qu'elles tournent chacune sur son axe).
    for nom, x, y in (('roue_avg', -xr, -yr), ('roue_avd', xr, -yr), ('roue_arg', -xr, yr), ('roue_ard', xr, yr)):
        _roue(coll, nom, (x, y, zr), r, larg, sg, seg)
    lot.finir()
    # Pas de repères d'emprise : le jeu pose le buggy à son échelle (mètres), centré sur son enveloppe.
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


MODELES = {
    'buggy': buggy,
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
    T.save(os.path.join(ROOT, 'blender', 'vehicules.blend'))


if __name__ == '__main__':
    main()
