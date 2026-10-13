"""Famille « fonderie » : fourneaux (et plus tard fourneau électrique, convertisseur Bessemer).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.

Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `fourneau_t1` -> export/fourneau_t1.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `fourneau_t1_unity` -> export/unity/fourneau_t1.glb (non copiée dans le jeu).

Lancer :  blender --background --python blender/scripts/fonderie.py
Produit :  blender/fonderie.blend, export/fourneau_t1.glb et export/unity/fourneau_t1.glb
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
from mathutils import Matrix  # noqa: E402


def fourneau_t1(coll, leger=True):
    """Fourneau à combustible : 3 x 3 cases, 2,6 unités de haut (1,3 m = 1,3 x la hauteur de machines.json, le maximum
    accepté par le jeu sans réduire le modèle). Sortie devant (-Y), combustible derrière (+Y).

    Corps en briques sur un dallage de pierre, chaînages d'angle en pierre, gueule du foyer en arc avec flammes,
    réserve de bûches en dessous, corniche, hotte en pyramide et cheminée ; trappe en planches et charbon derrière.
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 2,6.
    `leger` (version web) : briques moins nombreuses et sans biseau, dallage plus simple, moins de charbon ;
    la version détaillée (leger=False) est gardée pour Unity.
    """
    rnd = random.Random(3)
    bv = 0.0 if leger else 1.0  # biseau des petites pièces : aucun en version légère
    lot = T.Lot(coll, 'pieces')

    # --- Sol : dalle sombre + dallage irrégulier (z 0 -> 0,2).
    T.box(coll, 'dalle', (3, 3, 0.12), (0, 0, 0.06), 'pierre_sombre', bevel=0.03)
    n = 3 if leger else 4
    pas = 3.0 / n
    for i in range(n):
        for j in range(n):
            sx, sy = rnd.uniform(pas - 0.15, pas - 0.05), rnd.uniform(pas - 0.15, pas - 0.05)
            lot.cube(rnd.choice(('pierre', 'pierre_claire', 'pierre')), (sx, sy, rnd.uniform(0.06, 0.08)),
                     (-1.5 + pas * (i + 0.5) + rnd.uniform(-0.03, 0.03), -1.5 + pas * (j + 0.5) + rnd.uniform(-0.03, 0.03), 0.155),
                     bevel=0.025 * bv, rot=Matrix.Rotation(rnd.uniform(-0.04, 0.04), 3, 'Z'))

    # --- Corps en briques (x ±1,3 ; y -1,1 -> 1,3 ; z 0,2 -> 1,68) et soubassement de pierre.
    T.box(coll, 'corps', (2.6, 2.4, 1.48), (0, 0.1, 0.94), 'brique', bevel=0.02)
    T.box(coll, 'soubassement', (2.68, 2.48, 0.12), (0, 0.1, 0.26), 'pierre_sombre', bevel=0.03)
    rangs = (0.41, 0.59, 0.77, 0.95, 1.13, 1.31, 1.49, 1.65)
    T.parement(lot, [
        ('y', -1.1, -1.12, -0.66, -1), ('y', -1.1, 0.66, 1.12, -1),  # devant, de part et d'autre de la gueule
        ('x', -1.3, -0.92, 1.12, -1), ('x', 1.3, -0.92, 1.12, 1),  # côtés
        ('y', 1.3, -1.12, -0.98, 1), ('y', 1.3, -0.02, 1.12, 1),  # derrière, de part et d'autre de la trappe
    ], rangs, seed=7, densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    # Au-dessus de l'arc de la gueule.
    T.parement(lot, [('y', -1.1, -0.66, 0.66, -1)], rangs[-2:], seed=11, densite=0.45 if leger else 0.7, bevel=0.012 * bv)
    # Chaînages d'angle : pierres alternées (longue / courte) sur les 4 coins.
    for cx, cy in ((-1.3, -1.1), (1.3, -1.1), (-1.3, 1.3), (1.3, 1.3)):
        sx, sy = math.copysign(1, cx), math.copysign(1, cy)
        for k, z in enumerate(rangs):
            lx, ly = (0.34, 0.2) if k % 2 == 0 else (0.2, 0.34)
            lot.cube(rnd.choices(*zip(*T.PIERRES))[0], (lx, ly, 0.165),
                     (cx - sx * (lx / 2 - 0.04), cy - sy * (ly / 2 - 0.04), z), bevel=0.02 * bv)

    # --- Gueule du foyer (devant) : fond noir, piédroits et arc de pierres, flammes et braises.
    T.box(coll, 'gueule_fond', (0.8, 0.04, 0.5), (0, -1.115, 0.97), 'noir')
    for x in (-0.5, 0.5):
        lot.cube(rnd.choice(('pierre_sombre', 'pierre')), (0.2, 0.15, 0.17), (x, -1.17, 0.8), bevel=0.02 * bv)
    for a in (180, 150, 120, 90, 60, 30, 0):
        t = math.radians(a)
        lot.cube('pierre_sombre' if a % 60 else 'pierre', (0.2, 0.15, 0.15),
                 (0.5 * math.cos(t), -1.17, 0.99 + 0.28 * math.sin(t)),
                 bevel=0.02 * bv, rot=Matrix.Rotation(math.radians(90 - a), 3, 'Y'))
    for x, h, r in ((-0.2, 0.26, 0.11), (0.03, 0.34, 0.13), (0.23, 0.24, 0.1)):
        T.cylinder(coll, f'flamme_{x}', r, h, (x, -1.17, 0.78 + h / 2), 'braise', segments=5, radius_top=0.0)
        T.cylinder(coll, f'coeur_{x}', r * 0.55, h * 0.6, (x, -1.24, 0.78 + h * 0.3), 'flamme', segments=5, radius_top=0.0)
    for x in (-0.25, 0.0, 0.25):
        lot.cube('braise', (0.18, 0.12, 0.06), (x + rnd.uniform(-0.03, 0.03), -1.17, 0.76), bevel=0.02 * bv,
                 rot=Matrix.Rotation(rnd.uniform(-0.3, 0.3), 3, 'Z'))
    # Rebord de pierre sous la gueule (sortie des lingots, côté -Y).
    T.box(coll, 'rebord', (1.25, 0.34, 0.09), (0, -1.27, 0.69), 'pierre_claire', bevel=0.025)

    # --- Réserve de bûches sous le rebord.
    T.box(coll, 'reserve_fond', (0.72, 0.04, 0.3), (0, -1.115, 0.45), 'noir')
    T.box(coll, 'reserve_linteau', (0.92, 0.14, 0.08), (0, -1.16, 0.6), 'pierre_sombre', bevel=0.02)
    for x in (-0.43, 0.43):
        lot.cube('pierre', (0.14, 0.14, 0.3), (x, -1.16, 0.45), bevel=0.02 * bv)
    for x, z in ((-0.2, 0.39), (0.0, 0.39), (0.2, 0.39), (-0.1, 0.51), (0.1, 0.51)):
        b = T.cylinder(coll, f'buche_{x}_{z}', 0.065, 0.26, (0, 0, 0), rnd.choice(('bois', 'bois_sombre')), segments=6)
        T.rotate(b, x=90)
        b.location = (x, -1.2, z)

    # --- Corniche, hotte en pyramide et cheminée (z 1,68 -> 2,6).
    T.box(coll, 'corniche', (2.76, 2.56, 0.12), (0, 0.1, 1.74), 'pierre_sombre', bevel=0.03)
    # Dessus de la corniche en briques, puis hotte étroite et pentue (z 1,8 -> 2,14).
    T.box(coll, 'dessus', (2.5, 2.3, 0.04), (0, 0.1, 1.82), 'brique_sombre', bevel=0.01)
    hotte = T.cylinder(coll, 'hotte', 0.95 * math.sqrt(2), 0.34, (0, 0, 0), 'brique', segments=4,
                       radius_top=0.34 * math.sqrt(2))
    T.rotate(hotte, z=45)
    hotte.location = (0, 0.1, 1.97)
    T.box(coll, 'hotte_bande', (1.5, 1.5, 0.07), (0, 0.1, 1.9), 'pierre', bevel=0.02)
    T.box(coll, 'hotte_bande_haut', (0.98, 0.98, 0.06), (0, 0.1, 2.06), 'pierre_sombre', bevel=0.02)
    # Cheminée plus haute (z 2,04 -> 2,54), avec une bague de pierre à mi-hauteur.
    T.box(coll, 'cheminee', (0.62, 0.62, 0.5), (0, 0.1, 2.29), 'brique', bevel=0.02)
    T.box(coll, 'cheminee_bague', (0.68, 0.68, 0.06), (0, 0.1, 2.3), 'pierre', bevel=0.015)
    T.box(coll, 'cheminee_chapeau', (0.76, 0.76, 0.05), (0, 0.1, 2.565), 'pierre_sombre', bevel=0.015)
    T.box(coll, 'cheminee_trou', (0.4, 0.4, 0.01), (0, 0.1, 2.595), 'noir')

    # --- Derrière : trappe en planches avec pentures, tas de charbon.
    for k, x in enumerate((-0.74, -0.5, -0.26)):
        lot.cube(rnd.choice(('bois', 'bois_sombre')), (0.22, 0.06, 0.52), (x, 1.33, 0.78), bevel=0.015 * bv)
    for z in (0.62, 0.94):
        lot.cube('fonte', (0.74, 0.03, 0.06), (-0.5, 1.37, z), bevel=0.01 * bv)
    for _ in range(4 if leger else 9):
        s = rnd.uniform(0.08, 0.12)
        lot.cube('noir', (s, s, s * 0.8), (-0.5 + rnd.uniform(-0.3, 0.3), 1.38 + rnd.uniform(-0.02, 0.02), 0.22 + s * 0.3),
                 bevel=0.02 * bv, rot=Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))

    lot.finir()


MODELES = {'fourneau_t1': fourneau_t1}


def construire():
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        unity.hide_viewport = True  # masquée dans la vue : on travaille sur la version web


def exporter():
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'fonderie.blend'))


if __name__ == '__main__':
    main()
