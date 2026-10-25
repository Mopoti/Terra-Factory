"""Famille « recherche » : laboratoire (et plus tard d'autres bâtiments de science).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/recherche.py
Produit :  blender/recherche.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


def _fiole(lot, p, h, r, liquide, sg):
    """Fiole en verre avec son liquide coloré."""
    x, y, z = p
    lot.tube('verre', (x, y, z), (x, y, z + h), r, sg)
    lot.tube(liquide, (x, y, z + 0.005), (x, y, z + h * 0.55), r * 1.03, sg)
    lot.tube('verre', (x, y, z + h), (x, y, z + h + 0.06), r * 0.45, sg)


def laboratoire(coll, leger=True):
    """Laboratoire (`lab`) : 3 x 3 cases, 1 m de haut (modèle jusqu'à 2,6 unités). Les paquets de science entrent par
    les quatre côtés (trappes jaunes).

    Plancher clair ; au centre, l'analyseur : socle, cage ajourée et carrousel de six fioles colorées qui tourne
    dedans, capteur à lampe cyan au-dessus ; paillasses en L (derrière et à gauche) avec fioles, microscope et écran ;
    hotte vitrée derrière à droite, avec la borne électrique ; armoire à droite.
    Pièces mobiles : `carrousel_` (tourne autour de Z) ; `voyant_*` (lampe du capteur, écran) pulsent.
    """
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    lot, ca = T.Lot(coll, 'pieces'), T.Lot(coll, 'carrousel')
    # Plancher, bordure, trappes d'entrée sur les quatre côtés.
    lot.cube('gris_clair', (2.94, 2.94, 0.08), (0, 0, 0.04), 0.01)
    lot.cube('acier_sombre', (2.98, 2.98, 0.03), (0, 0, 0.015))
    for a in range(4):
        rot = Matrix.Rotation(a * math.pi / 2, 3, 'Z')
        p = rot @ Vector((0, -1.36, 0.1))
        lot.cube('jaune', (0.6, 0.18, 0.04), tuple(p), 0, rot)
        lot.cube('noir', (0.46, 0.12, 0.045), tuple(p), 0, rot)
    # Analyseur central : socle, couronne, cloche de verre, carrousel (tourne), capteur.
    T.cylinder(coll, 'analyseur_socle', 0.62, 0.55, (0, 0, 0.08 + 0.275), 'acier', segments=seg)
    lot.tube('cyan', (0, 0, 0.6), (0, 0, 0.63), 0.64, seg)
    for k in range(6):  # cage ajourée (le verre du jeu n'est pas transparent : on voit le carrousel entre les montants)
        a = 2 * math.pi * (k + 0.5) / 6
        lot.tube('acier', (0.52 * math.cos(a), 0.52 * math.sin(a), 0.63), (0.52 * math.cos(a), 0.52 * math.sin(a), 1.25), 0.03, 6)
    lot.tube('acier_sombre', (0, 0, 1.25), (0, 0, 1.3), 0.55, seg)
    ca.tube('acier_sombre', (0, 0, 0.65), (0, 0, 0.69), 0.42, seg)
    for k, c in enumerate(('rouge', 'vert', 'bleu', 'jaune', 'cyan', 'violet')):
        a = 2 * math.pi * k / 6
        _fiole(ca, (0.3 * math.cos(a), 0.3 * math.sin(a), 0.69), 0.26, 0.05, c, sg)
    T.pivot(coll, 'pivot_carrousel', (0, 0, 0.67), (0, 0, 1))
    lot.tube('acier', (0, 0, 1.3), (0, 0, 1.55), 0.04, 6)
    lot.cube('acier_sombre', (0.3, 0.3, 0.14), (0, 0, 1.6), 0.01)
    T.cylinder(coll, 'voyant_capteur', 0.07, 0.06, (0, 0, 1.7), 'cyan', segments=10)
    # Paillasses en L (derrière et à gauche).
    zp = 0.78
    for (x, y, sx, sy) in ((-0.225, 1.1, 1.65, 0.55), (-1.1, -0.1, 0.55, 1.85)):
        lot.cube('blanc', (sx, sy, 0.06), (x, y, zp), 0.01)
        lot.cube('gris_clair', (sx - 0.08, sy - 0.08, zp - 0.12), (x, y, 0.08 + (zp - 0.14) / 2), 0.01)
    for k, (x, c) in enumerate(((-0.5, 'vert'), (-0.3, 'bleu'), (-0.12, 'rouge'))):
        _fiole(lot, (x, 1.15, zp + 0.03), 0.18 + 0.04 * k, 0.045, c, sg)
    # Microscope.
    lot.cube('acier_sombre', (0.18, 0.22, 0.04), (0.35, 1.12, zp + 0.05))
    lot.barre('acier', (0.35, 1.2, zp + 0.06), (0.35, 1.2, zp + 0.36), 0.05)
    lot.tube('noir', (0.35, 1.16, zp + 0.32), (0.35, 1.06, zp + 0.18), 0.035, 8)
    lot.tube('noir', (0.35, 1.16, zp + 0.32), (0.35, 1.2, zp + 0.42), 0.025, 8)
    # Écran et clavier sur la paillasse de gauche.
    lot.cube('acier_sombre', (0.06, 0.06, 0.2), (-1.2, -0.3, zp + 0.13))
    lot.cube('panneau', (0.04, 0.6, 0.38), (-1.2, -0.3, zp + 0.42))
    T.box(coll, 'voyant_ecran', (0.012, 0.52, 0.3), (-1.175, -0.3, zp + 0.42), 'cyan')
    lot.cube('noir', (0.2, 0.42, 0.02), (-0.98, -0.3, zp + 0.04))
    for k, c in enumerate(('vert', 'jaune', 'rouge')):
        _fiole(lot, (-1.05, -0.9 + k * 0.12, zp + 0.03), 0.16, 0.04, c, sg)
    # Hotte vitrée (derrière à droite) et borne électrique.
    xh, yh = 1.05, 1.0
    lot.cube('blanc', (0.8, 0.8, 0.12), (xh, yh, 0.14), 0.01)
    lot.cube('gris_clair', (0.8, 0.8, 0.6), (xh, yh, 0.5), 0.01)
    lot.cube('verre', (0.72, 0.02, 0.62), (xh, yh - 0.38, 1.12))
    lot.cube('blanc', (0.8, 0.06, 0.1), (xh, yh - 0.38, 0.86))
    for x in (xh - 0.38, xh + 0.38):
        lot.cube('blanc', (0.06, 0.8, 0.66), (x, yh, 1.13))
    lot.cube('blanc', (0.82, 0.82, 0.12), (xh, yh, 1.5), 0.01)
    lot.cube('blanc', (0.84, 0.06, 0.66), (xh, yh + 0.38, 1.13))
    _fiole(lot, (xh, yh, 0.81), 0.24, 0.06, 'violet', sg)
    T.cylinder(coll, 'hotte_gaine', 0.14, 0.4, (xh, yh, 1.56 + 0.2), 'acier', segments=10)
    T.borne_electrique(coll, lot, (xh + 0.25, yh + 0.2, 1.56), 0.45, sg)
    # Armoire à droite.
    lot.cube('blanc', (0.45, 0.9, 0.75), (1.2, -0.5, 0.08 + 0.375), 0.01)
    lot.cube('acier', (0.02, 0.86, 0.02), (0.97, -0.5, 0.46))
    for z in (0.3, 0.62):
        lot.cube('acier_sombre', (0.03, 0.12, 0.04), (0.965, -0.4, z))
    T.box(coll, 'voyant_armoire', (0.02, 0.06, 0.06), (0.97, -0.75, 0.75), 'vert')
    for l in (lot, ca):
        l.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {
    'laboratoire': laboratoire,
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
    T.save(os.path.join(ROOT, 'blender', 'recherche.blend'))


if __name__ == '__main__':
    main()
