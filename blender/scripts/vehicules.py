"""Famille « véhicules » : buggy, quad et tank, à l'échelle du personnage (1,7 m).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
L'avant du véhicule est du côté -Y. Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Échelle : le personnage (1,7 m) monte dedans. Assis, ses hanches sont à ~8 cm au-dessus du coussin et sa tête à
~0,88 m au-dessus ; les arceaux et les toits passent au-dessus. La place du conducteur de chaque véhicule (point du
coussin) est un nœud vide `siege` du fichier, lu par le jeu (`BakedModel.seat`).

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


#: Buggy : dessiné petit puis agrandi de K_BUGGY ; hauteur de l'arceau et du coussin du siège avant agrandissement.
K_BUGGY = 1.7
H_ARCEAU = 1.9
Z_SIEGE = 0.71


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
    """Buggy : environ 1,7 m de large, 2,7 m de long (avant = -Y), arceau à 1,6 m ; siège du conducteur à 0,6 m.

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
        lot.barre('acier_sombre', (sx * 0.55, -0.4, 0.83), (sx * 0.5, -0.15, H_ARCEAU), 0.06)
        lot.barre('acier_sombre', (sx * 0.5, -0.15, H_ARCEAU), (sx * 0.5, 0.55, H_ARCEAU), 0.06)
        lot.barre('acier_sombre', (sx * 0.5, 0.55, H_ARCEAU), (sx * 0.55, 0.75, 0.83), 0.06)
    for y in (-0.15, 0.55):
        lot.barre('acier_sombre', (-0.5, y, H_ARCEAU), (0.5, y, H_ARCEAU), 0.06)
    lot.barre('acier_sombre', (-0.5, 0.55, H_ARCEAU), (0.5, -0.15, H_ARCEAU), 0.05)
    # Sièges, volant.
    for sx in (-1, 1):
        lot.cube('noir', (0.42, 0.4, 0.1), (sx * 0.27, 0.25, Z_SIEGE - 0.05), 0.02)
        lot.cube('noir', (0.42, 0.1, 0.55), (sx * 0.27, 0.48, Z_SIEGE + 0.22), 0.02, Matrix.Rotation(-0.15, 3, 'X'))
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
    T.reperer(coll, 'siege', (-0.27, 0.25, Z_SIEGE))  # coussin du conducteur (lu par le jeu)
    lot.finir()
    # Dessiné petit, puis agrandi à l'échelle du personnage.
    _agrandir(coll, K_BUGGY)
    _au_sol(coll)


def _agrandir(coll, k):
    m = Matrix.Scale(k, 4)
    for o in coll.objects:
        if o.type == 'MESH':
            o.data.transform(m)
        o.location = o.location * k


def _au_sol(coll):
    """Pas de repères d'emprise : le jeu pose le véhicule à son échelle (mètres), centré sur son enveloppe."""
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


def _chenille(coll, lot, x, y0, y1, z0, h, larg, sg, nom):
    """Chenille de char le long de Y (de y0 à y1) : bande à patins, galets porteurs (groupe `nom`), barbotin."""
    r = h / 2
    zc = z0 + r
    lg = abs(y1 - y0) - 2 * r
    lot.cube('fonte', (larg, lg, 0.06), (x, (y0 + y1) / 2, z0 + 0.03))
    lot.cube('fonte', (larg, lg, 0.06), (x, (y0 + y1) / 2, z0 + h - 0.03))
    n = 18 if sg < 10 else 30
    for k in range(n):  # patins sur le dessus et le dessous
        y = y0 + r + (k + 0.5) * lg / n
        lot.cube('acier_sombre', (larg + 0.02, 0.06, 0.04), (x, y, z0 + 0.01))
        lot.cube('acier_sombre', (larg + 0.02, 0.06, 0.04), (x, y, z0 + h - 0.01))
    for yb in (y0 + r, y1 - r):  # bouts arrondis
        lot.tube('fonte', (x - larg / 2, yb, zc), (x + larg / 2, yb, zc), r, sg + 4)
        lot.tube('acier_sombre', (x - larg / 2 - 0.02, yb, zc), (x + larg / 2 + 0.02, yb, zc), r * 0.55, sg)
    g = T.Lot(coll, nom)
    for k in range(5):  # galets
        y = y0 + r + (k + 0.5) * lg / 5
        g.tube('acier', (x - larg / 2 - 0.03, y, z0 + r * 0.8), (x + larg / 2 + 0.03, y, z0 + r * 0.8), r * 0.62, sg)
        g.tube('acier_sombre', (x - larg / 2 - 0.05, y, z0 + r * 0.8), (x + larg / 2 + 0.05, y, z0 + r * 0.8), r * 0.2, sg)
    g.finir()
    T.pivot(coll, 'pivot_' + nom, (x, (y0 + y1) / 2, z0 + r * 0.8), (1, 0, 0))


def quad(coll, leger=True):
    """Quad : 2 m de long, 1,15 m de large ; selle à 0,85 m (le pilote est à califourchon), guidon à 1,05 m.

    Châssis tubulaire, carénages verts avec garde-boues, porte-bagages avant et arrière (caisse), phares, échappement.
    Pièces mobiles : `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard` (tournent autour de X).
    """
    sg = 8 if leger else 14
    seg = 14 if leger else 24
    lot = T.Lot(coll, 'pieces')
    r, larg = 0.56, 0.42
    xr, yr = 0.9, 1.32
    lot.cube('acier_sombre', (0.7, 2.6, 0.2), (0, 0, 0.8), 0.03)  # châssis
    lot.cube('vert', (1.0, 1.0, 0.36), (0, -0.85, 1.25), 0.08)  # carénage avant
    lot.cube('vert', (1.0, 0.9, 0.3), (0, 0.95, 1.2), 0.08)  # carénage arrière
    lot.cube('vert_fonce', (0.62, 0.9, 0.42), (0, 0.0, 1.15), 0.06)  # réservoir et moteur
    lot.cube('noir', (0.56, 1.0, 0.16), (0, 0.25, 1.62), 0.06)  # selle (dessus à 1,7)
    lot.cube('acier', (0.5, 0.6, 0.32), (0, -0.05, 0.75), 0.03)  # moteur
    for sx in (-1, 1):
        for y in (-yr, yr):  # garde-boues
            lot.cube('vert', (0.5, 1.15, 0.06), (sx * xr, y, r * 2 + 0.12), 0.02)
            lot.cube('vert', (0.5, 0.06, 0.3), (sx * xr, y + (0.56 if y > 0 else -0.56), r * 2 - 0.02), 0.02)
            lot.barre('acier_sombre', (sx * 0.3, y * 0.8, 0.8), (sx * (xr - 0.15), y, r), 0.07)  # bras
        lot.barre('acier_sombre', (sx * 0.25, 0.25, 1.4), (sx * 0.2, 0.25, 0.9), 0.06)
        lot.tube('acier_sombre', (sx * 0.28, -1.72, 1.32), (sx * 0.28, -1.78, 1.32), 0.1, 10)  # phares
        lot.tube('blanc', (sx * 0.28, -1.78, 1.32), (sx * 0.28, -1.8, 1.32), 0.08, 10)
        lot.cube('acier_sombre', (0.12, 0.2, 0.06), (sx * 0.3, -0.25, 0.6))  # repose-pieds
    # Guidon.
    lot.barre('acier_sombre', (0, -0.55, 1.42), (0, -0.62, 2.0), 0.07)
    lot.barre('acier_sombre', (-0.42, -0.62, 2.08), (0.42, -0.62, 2.08), 0.05)
    lot.barre('acier_sombre', (0, -0.62, 2.0), (0, -0.62, 2.08), 0.06)
    for sx in (-1, 1):
        lot.tube('noir', (sx * 0.34, -0.62, 2.08), (sx * 0.46, -0.62, 2.08), 0.04, 8)
    # Porte-bagages et caisse, échappement.
    for y0 in (-1.35, 1.4):
        lot.cube('acier_sombre', (0.9, 0.5, 0.04), (0, y0, 1.48))
    lot.cube('bois', (0.6, 0.4, 0.3), (0, 1.42, 1.65), 0.02)
    lot.tube('acier', (0.3, 1.0, 0.95), (0.3, 1.7, 1.05), 0.06, sg)
    for nom, x, y in (('roue_avg', -xr, -yr), ('roue_avd', xr, -yr), ('roue_arg', -xr, yr), ('roue_ard', xr, yr)):
        _roue(coll, nom, (x, y, r), r, larg, sg, seg)
    T.reperer(coll, 'siege', (0, 0.25, 1.7))
    lot.finir()
    _au_sol(coll)


def tank(coll, leger=True):
    """Tank léger : 4,2 m de long, 2,4 m de large, 2 m de haut. Le pilote se tient dans la trappe de la tourelle
    (le haut du corps dépasse). Caisse kaki, chenilles (galets en groupes `chenille_g` et `chenille_d`, tournent
    autour de X), tourelle (groupe `tourelle`, pivot vertical) avec canon, mitrailleuse et trappe ouverte.
    """
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    T.PALETTE.setdefault('kaki', '#6b6b3a')
    T.PALETTE.setdefault('kaki_clair', '#85854a')
    T.PALETTE.setdefault('kaki_sombre', '#4a4a28')
    lot = T.Lot(coll, 'pieces')
    for sx, nom in ((-1, 'chenille_g'), (1, 'chenille_d')):
        _chenille(coll, lot, sx * 1.95, -4.1, 4.1, 0.0, 1.1, 0.8, sg, nom)
        lot.cube('kaki_sombre', (0.85, 8.2, 0.08), (sx * 1.95, 0, 1.18), 0.02)  # garde-boue
    lot.cube('kaki', (3.0, 7.6, 1.2), (0, 0, 1.3), 0.08)  # caisse
    lot.cube('kaki_clair', (2.9, 1.4, 0.5), (0, -3.6, 1.05), 0.06, Matrix.Rotation(0.6, 3, 'X'))  # glacis
    lot.cube('kaki_sombre', (3.1, 7.7, 0.08), (0, 0, 1.92), 0.02)
    for sx in (-1, 1):
        lot.tube('acier_sombre', (sx * 1.1, -3.85, 1.6), (sx * 1.1, -3.92, 1.6), 0.12, 10)  # phares
        lot.tube('blanc', (sx * 1.1, -3.92, 1.6), (sx * 1.1, -3.94, 1.6), 0.09, 10)
        lot.cube('rouge', (0.3, 0.6, 0.4), (sx * 1.15, 3.2, 2.15), 0.03)  # jerricans
    for k in range(5):
        lot.cube('acier_sombre', (2.2, 0.08, 0.04), (0, 2.4 + k * 0.25, 1.96))  # grille moteur
    lot.tube('acier', (0.9, 3.6, 2.0), (0.9, 3.95, 2.35), 0.1, sg)  # échappement
    lot.cube('bois', (2.4, 0.18, 0.18), (0, 3.85, 1.5), 0.02)  # rondin de désembourbage
    lot.cube('kaki_sombre', (0.7, 0.5, 0.06), (-0.75, -2.2, 1.96), 0.02)  # trappe du pilote (fermée)
    # Tourelle.
    tr = T.Lot(coll, 'tourelle')
    zt = 1.96
    tr.tube('kaki_sombre', (0, 0.2, zt), (0, 0.2, zt + 0.12), 1.15, seg)
    tr.cube('kaki', (2.1, 2.4, 0.75), (0, 0.3, zt + 0.48), 0.12)
    tr.cube('kaki_clair', (1.7, 0.6, 0.6), (0, -0.95, zt + 0.45), 0.1)  # masque
    tr.tube('kaki_sombre', (0, -1.2, zt + 0.45), (0, -1.6, zt + 0.45), 0.2, sg)
    tr.tube('acier_sombre', (0, -1.6, zt + 0.45), (0, -4.6, zt + 0.45), 0.09, sg)  # canon
    tr.tube('acier_sombre', (0, -4.4, zt + 0.45), (0, -4.7, zt + 0.45), 0.14, sg)  # frein de bouche
    tr.cube('kaki_sombre', (0.6, 0.9, 0.3), (0, 1.6, zt + 0.5), 0.05)  # nuque
    # Trappe ouverte (le pilote se tient dedans) et mitrailleuse.
    tr.tube('kaki_sombre', (0.45, 0.6, zt + 0.86), (0.45, 0.6, zt + 0.95), 0.42, seg)
    tr.tube('noir', (0.45, 0.6, zt + 0.95), (0.45, 0.6, zt + 0.96), 0.34, seg)
    tr.cube('kaki', (0.7, 0.08, 0.7), (0.45, 1.05, zt + 1.28), 0.02)  # couvercle relevé
    tr.barre('acier_sombre', (-0.45, 0.4, zt + 0.86), (-0.45, 0.4, zt + 1.15), 0.06)
    tr.tube('acier_sombre', (-0.45, 0.5, zt + 1.2), (-0.45, -0.5, zt + 1.2), 0.04, sg)
    tr.cube('acier_sombre', (0.14, 0.3, 0.16), (-0.45, 0.45, zt + 1.18), 0.01)
    tr.barre('acier_sombre', (0.8, 1.2, zt + 0.86), (0.85, 1.35, zt + 2.0), 0.03)  # antenne
    tr.finir()
    T.pivot(coll, 'pivot_tourelle', (0, 0.2, zt), (0, 0, 1))
    # Pilote debout dans la trappe : « siège » placé pour que ses hanches soient 30 cm sous le bord de la trappe.
    T.reperer(coll, 'siege', (0.45, 0.6, zt + 0.95 - 0.76))
    lot.finir()
    _au_sol(coll)


MODELES = {
    'buggy': buggy,
    'quad': quad,
    'tank': tank,
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
