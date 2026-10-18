"""Famille « outils » : ce que le joueur tient en main (pioches, armes).

Style low poly stylisé (voir blender/README.md). Conventions (1 unité = 50 cm) :
- pioches : debout, le manche de Z = 0 vers le haut, la tête en haut, la pointe vers -Y ; le jeu les couche et les met
  à 0,75 m (`src/render/toolModel.ts`) ;
- armes : le canon vers l'avant (-Y), la crosse ou la poignée vers le bas ; origine à la poignée. Le jeu les tient
  dans la main droite. Pistolet ~0,25 m de long, fusil ~0,95 m.

Lancer :  blender --background --python blender/scripts/outils.py
Produit :  blender/outils.blend, export/<nom>.glb et export/unity/<nom>.glb
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

TEINTES = {
    'manche': '#9a7348',
    'manche_sombre': '#6e4f2e',
    'ficelle': '#d9c79a',
    'silex': '#7e7a74',
    'silex_clair': '#a39d94',
    'fer_outil': '#9aa3ad',
    'fer_sombre': '#5b636c',
    'arme': '#3d4248',
    'arme_claire': '#5a6068',
    'crosse': '#6b4528',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()


def _manche(lot, h, sg):
    lot.tube('manche', (0, 0, 0), (0, 0, h), 0.045, sg)
    lot.tube('manche_sombre', (0, 0, 0.0), (0, 0, 0.32), 0.052, sg)  # poignée
    lot.tube('manche_sombre', (0, 0, 0.0), (0, 0, 0.03), 0.06, sg)


def pioche_pierre(coll, leger=True):
    """Pioche de pierre : manche de bois, tête en silex taillé (pointe devant, talon derrière) ligaturée."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'pioche')
    h = 1.5
    _manche(lot, h, sg)
    z = h - 0.12
    lot.cube('silex', (0.12, 0.34, 0.14), (0, -0.12, z), 0.02)
    lot.cube('silex_clair', (0.09, 0.2, 0.1), (0, -0.36, z - 0.02), 0.015, Matrix.Rotation(-0.25, 3, 'X'))  # pointe
    lot.cube('silex', (0.11, 0.18, 0.12), (0, 0.14, z), 0.02)  # talon
    for k in range(3):  # ligature
        lot.cube('ficelle', (0.13, 0.03, 0.17), (0, -0.04 + k * 0.05, z), 0.005,
                 Matrix.Rotation(0.3 * (k - 1), 3, 'X'))
    lot.finir()


def pioche_fer(coll, leger=True):
    """Pioche de fer : manche de bois cerclé, tête en fer forgé (pic recourbé devant, panne plate derrière)."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'pioche')
    h = 1.5
    _manche(lot, h, sg)
    z = h - 0.1
    lot.tube('fer_sombre', (0, 0, z - 0.14), (0, 0, z + 0.1), 0.06, sg)  # douille
    lot.cube('fer_outil', (0.1, 0.24, 0.12), (0, -0.1, z), 0.015)
    lot.cube('fer_outil', (0.08, 0.2, 0.09), (0, -0.3, z - 0.04), 0.012, Matrix.Rotation(-0.3, 3, 'X'))
    lot.cube('fer_outil', (0.05, 0.12, 0.05), (0, -0.44, z - 0.12), 0.008, Matrix.Rotation(-0.6, 3, 'X'))  # pointe
    lot.cube('fer_outil', (0.1, 0.22, 0.1), (0, 0.12, z), 0.015)
    lot.cube('fer_outil', (0.18, 0.06, 0.12), (0, 0.24, z - 0.02), 0.012)  # panne
    lot.tube('fer_sombre', (0, 0, 0.32), (0, 0, 0.36), 0.056, sg)  # bague
    lot.finir()


def pistolet(coll, leger=True):
    """Pistolet : culasse anguleuse gris acier, canon devant (-Y), poignée inclinée à plaquettes de bois."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'pistolet')
    lot.cube('arme', (0.1, 0.42, 0.11), (0, -0.12, 0.13), 0.015)  # culasse
    lot.cube('arme_claire', (0.08, 0.38, 0.03), (0, -0.12, 0.2), 0.008)  # bande
    lot.tube('arme', (0, -0.33, 0.12), (0, -0.36, 0.12), 0.03, sg)  # bouche
    lot.cube('noir', (0.03, 0.01, 0.03), (0, -0.362, 0.12))
    lot.cube('crosse', (0.09, 0.12, 0.24), (0, 0.04, -0.03), 0.015, Matrix.Rotation(-0.25, 3, 'X'))  # poignée
    lot.cube('arme', (0.07, 0.1, 0.02), (0, -0.06, 0.04))  # pontet
    lot.cube('arme', (0.02, 0.02, 0.06), (0, -0.1, 0.06))  # détente
    lot.cube('arme_claire', (0.03, 0.03, 0.03), (0, -0.3, 0.21))  # guidon
    lot.finir()


def fusil(coll, leger=True):
    """Fusil : crosse et garde-main en bois, boîtier d'acier, long canon devant (-Y), chargeur courbe, lunette."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'fusil')
    lot.cube('crosse', (0.09, 0.5, 0.16), (0, 0.45, -0.02), 0.02, Matrix.Rotation(0.12, 3, 'X'))  # crosse
    lot.cube('arme', (0.1, 0.06, 0.22), (0, 0.72, -0.04), 0.01, Matrix.Rotation(0.12, 3, 'X'))  # plaque de couche
    lot.cube('arme', (0.1, 0.5, 0.13), (0, -0.05, 0.08), 0.015)  # boîtier
    lot.cube('crosse', (0.1, 0.5, 0.1), (0, -0.52, 0.06), 0.015)  # garde-main
    lot.tube('arme', (0, -0.3, 0.11), (0, -1.2, 0.11), 0.025, sg)  # canon
    lot.tube('arme_claire', (0, -1.2, 0.11), (0, -1.26, 0.11), 0.035, sg)  # cache-flamme
    lot.cube('arme', (0.07, 0.12, 0.2), (0, -0.12, -0.08), 0.01, Matrix.Rotation(0.3, 3, 'X'))  # chargeur
    lot.cube('crosse', (0.08, 0.1, 0.18), (0, 0.15, -0.06), 0.012, Matrix.Rotation(-0.3, 3, 'X'))  # poignée
    lot.tube('noir', (0, 0.12, 0.22), (0, -0.2, 0.22), 0.035, sg)  # lunette
    for y in (0.12, -0.2):
        lot.tube('arme', (0, y + 0.02, 0.22), (0, y - 0.02, 0.22), 0.045, sg)
    lot.cube('arme', (0.04, 0.05, 0.06), (0, -0.04, 0.17))
    lot.finir()


MODELES = {
    'pioche_pierre': pioche_pierre,
    'pioche_fer': pioche_fer,
    'pistolet': pistolet,
    'fusil': fusil,
}


def construire(noms=None):
    _palette()
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
    T.save(os.path.join(ROOT, 'blender', 'outils.blend'))


if __name__ == '__main__':
    main()
