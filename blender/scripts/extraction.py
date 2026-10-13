"""Famille « extraction » : foreuses (et plus tard pompe, chevalet de pompage).

Lancer :  blender --background --python blender/scripts/extraction.py
Produit :  blender/extraction.blend  et  export/foreuse_t1.glb
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402


def foreuse_t1(coll):
    """Foreuse à combustible : 4 x 4 cases, 3 unités de haut (1,5 m). Sortie devant (-Y), combustible derrière (+Y).

    Tout reste dans l'emprise 4 x 4 et au-dessus du sol : le jeu cadre le modèle sur son enveloppe.
    """
    T.box(coll, 'socle', (4, 4, 0.3), (0, 0, 0.15), 'acier_sombre')
    # Tête de puits au centre (un peu vers l'avant) : collier, table de rotation, tige.
    cy = -0.5
    T.cylinder(coll, 'collier', 0.95, 0.4, (0, cy, 0.5), 'acier', segments=14)
    T.cylinder(coll, 'table', 0.55, 0.3, (0, cy, 0.85), 'jaune', segments=12)
    T.cylinder(coll, 'tige', 0.2, 1.6, (0, cy, 1.8), 'acier_sombre', segments=8)
    # Mât à quatre montants, traverses et tête d'entraînement.
    for i, (x, y) in enumerate(((-0.9, cy - 0.9), (0.9, cy - 0.9), (-0.9, cy + 0.9), (0.9, cy + 0.9))):
        T.box(coll, f'montant_{i}', (0.16, 0.16, 2.5), (x, y, 1.55), 'acier')
    T.box(coll, 'traverse_avant', (1.96, 0.16, 0.16), (0, cy - 0.9, 2.6), 'acier')
    T.box(coll, 'traverse_arriere', (1.96, 0.16, 0.16), (0, cy + 0.9, 2.6), 'acier')
    T.box(coll, 'traverse_gauche', (0.16, 1.96, 0.16), (-0.9, cy, 2.6), 'acier')
    T.box(coll, 'traverse_droite', (0.16, 1.96, 0.16), (0.9, cy, 2.6), 'acier')
    T.box(coll, 'tete', (1.0, 1.0, 0.45), (0, cy, 2.65), 'orange')
    T.box(coll, 'poulie', (0.4, 0.4, 0.3), (0, cy, 2.95), 'jaune')
    # Moteur à combustible, à l'arrière, avec cheminée et courroie vers la tête.
    T.box(coll, 'moteur', (3.0, 1.0, 1.2), (0, 1.4, 0.9), 'orange')
    T.box(coll, 'capot', (2.6, 0.8, 0.25), (0, 1.4, 1.6), 'rouge')
    T.box(coll, 'grille', (1.0, 0.06, 0.6), (-0.6, 0.89, 0.95), 'noir')
    T.cylinder(coll, 'cheminee', 0.17, 1.0, (0.9, 1.5, 2.25), 'fonte', segments=8)
    T.cylinder(coll, 'cheminee_bord', 0.25, 0.1, (0.9, 1.5, 2.8), 'fonte', segments=8)
    courroie = T.box(coll, 'courroie', (0.1, 1.45, 0.1), (0, 0.55, 2.3), 'noir')
    T.rotate(courroie, x=-9)
    # Trémie de combustible (derrière) et goulotte de sortie (devant).
    T.cylinder(coll, 'tremie', 0.5, 0.5, (-0.9, 1.55, 1.95), 'acier', segments=8, radius_top=0.22)
    T.box(coll, 'goulotte', (1.0, 0.75, 0.2), (0, -1.62, 0.4), 'acier')
    T.box(coll, 'goulotte_bord_g', (0.12, 0.75, 0.3), (-0.56, -1.62, 0.55), 'acier_sombre')
    T.box(coll, 'goulotte_bord_d', (0.12, 0.75, 0.3), (0.56, -1.62, 0.55), 'acier_sombre')
    T.box(coll, 'goulotte_fond', (1.0, 0.12, 0.35), (0, -1.0, 0.5), 'acier_sombre')


def main():
    T.reset()
    c = T.collection('foreuse_t1')
    foreuse_t1(c)
    os.makedirs(os.path.join(ROOT, 'export'), exist_ok=True)
    print('export :', T.export_glb(c, os.path.join(ROOT, 'export')))
    T.save(os.path.join(ROOT, 'blender', 'extraction.blend'))


main()
