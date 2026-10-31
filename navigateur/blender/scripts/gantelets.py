"""Gantelets d'armure, paliers 1 à 5 : plaques posées sur la main gantée du personnage (`outils.main_gantee`).

Repère et unités de `main_gantee` : poignet à l'origine, doigts vers -Y, dos de la main vers +Z, pouce vers +X (unités
Blender, exportées à l'échelle 0,5 comme la main gantée). Les pièces sont rangées par nœud de la main gantée sur lequel
le jeu les accroche (`Avatar.setGauntlets`) : `main__…` (dos de la main, jointures), `manchette__…` (poignet). Les faces
`teinte` prennent la couleur de l'objet ; le gant lui-même est assombri à la couleur de l'armure par le jeu.

Même style que les armures portées (`porte_armures.py`) : 1 cuir et rivets, 2 acier à liserés clairs et rivets,
3 composite à bande orange, 4 blindage lourd à lumière bleue, 5 nano à lignes lumineuses cyan.

Modèles : `gantelet_armure1` … `gantelet_armure5` (portés). Les icônes sont dans `equipement.py`
(`objet_armure<n>_gants`).

Lancer :  blender --background --python blender/scripts/gantelets.py
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
sys.path.insert(0, HERE)
import terra as T  # noqa: E402
import outils as O  # noqa: E402
import porte  # noqa: E402,F401  (palette des armures)
from porte_armures import STYLE  # noqa: E402

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

TEINTE = 'teinte'


def plaque(lot, mat, sections, t0, t1, ep=0.008, m=10):
    """Plaque courbe autour de l'axe Y (celui de la main) : sections (y, cx, cz, demi-largeur X, demi-hauteur Z), entre
    les angles t0 et t1 (0 = dessus +Z, positif vers +X), épaisseur `ep` vers l'intérieur. Bords nets."""
    tmp = bmesh.new()
    ext_r, int_r = [], []
    for y, cx, cz, a, b in sections:
        ext, inn = [], []
        for i in range(m + 1):
            t = t0 + (t1 - t0) * i / m
            ext.append(tmp.verts.new((cx + a * math.sin(t), y, cz + b * math.cos(t))))
            inn.append(tmp.verts.new((cx + (a - ep) * math.sin(t), y, cz + (b - ep) * math.cos(t))))
        ext_r.append(ext)
        int_r.append(inn)
    for r0, r1, q0, q1 in zip(ext_r, ext_r[1:], int_r, int_r[1:]):
        for i in range(m):
            tmp.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i])).smooth = True
            tmp.faces.new((q0[i + 1], q0[i], q1[i], q1[i + 1])).smooth = True
    for e, n_ in ((ext_r[0], int_r[0]), (ext_r[-1], int_r[-1])):
        for i in range(m):
            tmp.faces.new((e[i], e[i + 1], n_[i + 1], n_[i]))
    if abs((t1 - t0) - 2 * math.pi) > 1e-6:
        for i in (0, m):
            for k in range(len(sections) - 1):
                tmp.faces.new((ext_r[k][i], ext_r[k + 1][i], int_r[k + 1][i], int_r[k][i]))
    bmesh.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def sur(y, a, b, t, cz=0.0):
    """Point de la surface (ellipse a, b à la hauteur y) à l'angle t, et sa normale."""
    p = Vector((a * math.sin(t), y, cz + b * math.cos(t)))
    nrm = Vector((math.sin(t) / a, 0, math.cos(t) / b)).normalized()
    return p, nrm


def rivet(lot, p, nrm, r=0.006):
    O._cyl(lot, 'rivet', tuple(p - nrm * 0.002), tuple(p + nrm * 0.004), r, 2, k=r * 0.4)


def ligne(lot, mat, pts, larg, ep):
    secs = []
    for i, (p, nrm) in enumerate(pts):
        q = pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]
        u = q.cross(nrm).normalized()
        secs.append((p, u, nrm, larg, ep, min(larg, ep) * 0.9))
    O._loft(lot, mat, secs, 2)


def plaques(coll, leger, p):
    """Plaques du gantelet du palier p (repère de la main gantée) ; renvoie les lots (à finir)."""
    st = STYLE[p]
    n = 3 if leger else 5
    main = T.Lot(coll, 'main__gantelet')
    manchette = T.Lot(coll, 'manchette__gantelet')
    # Dos de la main : plaque bombée du poignet aux jointures (au-dessus du gant : rayons un peu plus grands).
    dos = [(-0.03, 0, 0.004, 0.084, 0.05), (-0.09, 0, 0.004, 0.094, 0.046), (-0.16, 0, 0.004, 0.098, 0.04)]
    lames = 2 if p == 1 else 3
    ys = [-0.03 - 0.13 * k / lames for k in range(lames + 1)]
    for k in range(lames):  # lames qui se chevauchent (la plus proche du poignet par-dessus)
        y0, y1 = ys[k] + 0.006, ys[k + 1]
        g = 0.003 * (lames - k)
        a0 = 0.084 + 0.014 * (k / lames)
        a1 = 0.084 + 0.014 * ((k + 1) / lames)
        b0 = 0.05 - 0.01 * (k / lames)
        b1 = 0.05 - 0.01 * ((k + 1) / lames)
        plaque(main, TEINTE, [(y0, 0, 0.004, a0 + g, b0 + g), (y1, 0, 0.004, a1 + g, b1 + g)], -1.15, 1.15, 0.007, 12)
        plaque(main, st['liseré'], [(y1 + 0.006, 0, 0.004, a1 + g + 0.002, b1 + g + 0.002),
                                    (y1, 0, 0.004, a1 + g + 0.002, b1 + g + 0.002)], -1.13, 1.13, 0.004, 12)
    # Garde des jointures : barre bombée en travers, avec des bossettes.
    plaque(main, TEINTE, [(-0.168, 0, 0.004, 0.102, 0.044), (-0.205, 0, 0.004, 0.1, 0.04)], -1.2, 1.2, 0.009, 12)
    plaque(main, st['liseré'], [(-0.2, 0, 0.004, 0.103, 0.042), (-0.208, 0, 0.004, 0.102, 0.041)], -1.18, 1.18, 0.004, 12)
    for k in range(4):
        x = -0.057 + k * 0.039
        t = math.asin(max(-1.0, min(1.0, x / 0.104)))
        q, nrm = sur(-0.186, 0.104, 0.046, t, 0.004)
        if p in (1, 2, 4):
            rivet(main, q, nrm, 0.007)
        else:
            O._cyl(main, st['accent'] if p == 3 else st['lumiere'], tuple(q - nrm * 0.002), tuple(q + nrm * 0.003), 0.008, n)
    # Manchette : bracelet évasé au poignet, liseré au bord.
    plaque(manchette, TEINTE, [(-0.01, 0, 0.0, 0.072, 0.05), (0.06, 0, 0.0, 0.076, 0.056), (0.105, 0, 0.0, 0.082, 0.062)],
           -math.pi, math.pi, 0.008, 20)
    plaque(manchette, st['liseré'], [(0.1, 0, 0.0, 0.085, 0.065), (0.115, 0, 0.0, 0.085, 0.065)], -math.pi, math.pi, 0.006, 20)
    # Détails du palier.
    if p == 1:
        plaque(main, 'sac_cuir', [(-0.05, 0, 0.004, 0.096, 0.058), (-0.068, 0, 0.004, 0.097, 0.057)], -math.pi, math.pi, 0.004, 20)
        O._rond(main, 'boucle', (0.06, -0.059, 0.06), (0.06, -0.059, 0.03), 0.012, 0.004, 2, k=0.002)
        for t in (-0.9, 0.9):
            q, nrm = sur(0.03, 0.078, 0.054, t)
            rivet(manchette, q, nrm)
    elif p == 2:
        for t in (-1.0, 0.0, 1.0):
            q, nrm = sur(0.04, 0.076, 0.055, t)
            rivet(manchette, q, nrm)
    elif p == 3:
        pts = [sur(-0.04 - 0.11 * k / 6, 0.092, 0.05, 0.0, 0.004) for k in range(7)]
        ligne(main, 'composite_bande', pts, 0.012, 0.003)
        plaque(manchette, 'composite_bande', [(0.03, 0, 0.0, 0.0755, 0.0555), (0.045, 0, 0.0, 0.0758, 0.0558)],
               -math.pi, math.pi, 0.003, 20)
    elif p == 4:
        q, nrm = sur(-0.075, 0.098, 0.05, 0.0, 0.004)
        O._cyl(main, st['dessous'], tuple(q - nrm * 0.003), tuple(q + nrm * 0.01), 0.022, n + 1, k=0.004)
        O._cyl(main, 'lueur', tuple(q + nrm * 0.006), tuple(q + nrm * 0.013), 0.015, n + 1, k=0.004)
        for sx in (-1, 1):
            pts = [sur(0.01 + 0.08 * k / 5, 0.078, 0.057, sx * 1.4) for k in range(6)]
            ligne(manchette, 'lueur', pts, 0.004, 0.003)
    else:
        for sx in (-1, 1):
            pts = [sur(-0.04 - 0.12 * k / 6, 0.095, 0.049, sx * (0.35 + 0.25 * k / 6), 0.004) for k in range(7)]
            ligne(main, 'nano_lueur', pts, 0.004, 0.003)
        plaque(manchette, 'nano_lueur', [(0.05, 0, 0.0, 0.0765, 0.0565), (0.058, 0, 0.0, 0.0768, 0.0568)],
               -math.pi, math.pi, 0.003, 20)
    return [main, manchette]


def gantelet(coll, leger, p):
    for lot in plaques(coll, leger, p):
        lot.finir()
    T.adoucir(coll)


MODELES = {f'gantelet_armure{p}': (lambda c, leger=True, p=p: gantelet(c, leger, p)) for p in (1, 2, 3, 4, 5)}


def construire(noms=None):
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        fabrique(T.collection(nom), True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, False)
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter(noms=None):
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        if noms and nom not in noms:
            continue
        # Même échelle et même repère que la main gantée (`outils._export_hier`, 0,5) : le jeu accroche les pièces à ses nœuds.
        print('export web   :', O._export_hier(bpy.data.collections[nom], export, nom))
        print('export Unity :', O._export_hier(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'gantelets.blend'))


if __name__ == '__main__':
    main()
