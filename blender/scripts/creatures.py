"""Famille « créatures » : les ennemis (éclaireur, gardien, cracheur) et leurs nids.

Style low poly stylisé (voir blender/README.md) : carapaces à facettes (enveloppes convexes de points tirés sur un
ellipsoïde), pas d'image de texture. L'avant (la tête) est vers -Y, comme pour les machines.

Ennemis : un objet par groupe, pour que le jeu les anime (`src/render/enemyView.ts`) :
- `corps_*` : carapace, tête, yeux (le jeu le fait sautiller) ;
- `pattes_a_*` et `pattes_b_*` : les six pattes en deux trépieds alternés (avant gauche, milieu droite, arrière
  gauche / l'inverse), que le jeu fait balancer en sens contraires autour de la verticale pour la marche.
Tailles (1 unité = 50 cm) : éclaireur ~1,6 de long, cracheur ~2, gardien ~2,6.

Nid : `nid` — monticule organique de 4 unités de diamètre (2 m, l'emprise de départ de 4 cases), 1,4 de haut, avec
cheminées, œufs luisants et piquants ; le jeu l'agrandit selon la taille du nid.

Lancer :  blender --background --python blender/scripts/creatures.py
Produit :  blender/creatures.blend, export/<nom>.glb et export/unity/<nom>.glb
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TEINTES = {
    'carapace': '#7a2d3a',
    'carapace_claire': '#9a4050',
    'carapace_sombre': '#4e1c26',
    'chitine': '#3b1820',
    'oeil': '#ffd35a',
    'gardien': '#4a3330',
    'gardien_clair': '#6a4a40',
    'gardien_sombre': '#2c1e1c',
    'corne': '#c9b89a',
    'cracheur': '#5f9a3a',
    'cracheur_clair': '#86c24a',
    'cracheur_sombre': '#3c6426',
    'acide': '#b8f04a',
    'nid': '#4a3040',
    'nid_clair': '#6a4458',
    'nid_sombre': '#2e1e28',
    'oeuf': '#d9e86a',
    'chair': '#c86a78',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()


def _bloc(lot, mat, c, dims, rnd, n=12, rot=0.0, plat=None):
    """Volume à facettes : enveloppe convexe de `n` points sur un ellipsoïde de demi-axes `dims`, centré en `c`.
    `plat` : hauteur sous laquelle les points sont ramenés (base plate)."""
    tmp = bmesh.new()
    m = Matrix.Rotation(rot, 3, 'Z')
    pts = []
    for i in range(n):
        u = 1 - 2 * (i + 0.5) / n
        s = math.sqrt(max(0.0, 1 - u * u))
        a = i * math.pi * (3 - math.sqrt(5)) + rnd.uniform(-0.25, 0.25)
        k = 1 - rnd.uniform(0, 0.12)
        p = m @ Vector((s * math.cos(a) * dims[0] * k, s * math.sin(a) * dims[1] * k, u * dims[2] * k)) + Vector(c)
        if plat is not None:
            p.z = max(p.z, plat)
        pts.append(tmp.verts.new(p))
    res = bmesh.ops.convex_hull(tmp, input=pts)
    dedans = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if dedans:
        bmesh.ops.delete(tmp, geom=dedans, context='VERTS')
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _patte(lot, mat, hanche, cote, avant, longueur, haut, ep, griffe=None):
    """Patte en deux segments : de la hanche vers le genou (haut et dehors), puis jusqu'au sol (pointe)."""
    h = Vector(hanche)
    genou = h + Vector((cote * longueur * 0.55, avant * longueur * 0.25, haut))
    pied = Vector((h.x + cote * longueur, h.y + avant * longueur * 0.45, 0.0))
    lot.barre(mat, h, genou, ep)
    lot.barre(mat, genou, pied + Vector((0, 0, ep * 0.4)), ep * 0.75)
    lot.boule(mat, genou, ep * 0.75)
    if griffe:
        lot.barre(griffe, pied + Vector((0, 0, ep * 0.5)), pied, ep * 0.5)


def _pattes(coll, hanches, mat, longueur, haut, ep, griffe=None):
    """Six pattes : `hanches` = 3 positions (y, z, demi-largeur) d'avant en arrière. Deux trépieds alternés."""
    a, b = T.Lot(coll, 'pattes_a'), T.Lot(coll, 'pattes_b')
    for i, (y, z, dx) in enumerate(hanches):
        avant = (-1.0, 0.0, 1.0)[i]
        for cote in (-1, 1):
            groupe = a if (i % 2 == 0) == (cote < 0) else b
            _patte(groupe, mat, (cote * dx, y, z), cote, avant, longueur, haut, ep, griffe)
    return a, b


def _yeux(lot, pts, r):
    for p in pts:
        lot.boule('oeil', p, r)
        lot.boule('noir', (p[0], p[1] - r * 0.6, p[2]), r * 0.45)


def ennemi_eclaireur(coll, leger=True):
    """Éclaireur (`scout`) : punaise bordeaux rapide, ~1,6 unité de long. Trois plaques de carapace, tête basse,
    mandibules, deux gros yeux jaunes, six pattes fines."""
    rnd = random.Random(11)
    n = 12 if leger else 22
    corps = T.Lot(coll, 'corps')
    _bloc(corps, 'carapace', (0, 0.28, 0.42), (0.42, 0.5, 0.26), rnd, n)  # abdomen
    _bloc(corps, 'carapace_claire', (0, -0.08, 0.48), (0.36, 0.32, 0.22), rnd, n)  # thorax
    _bloc(corps, 'carapace_sombre', (0, 0.55, 0.36), (0.3, 0.3, 0.18), rnd, n)  # bout de l'abdomen
    _bloc(corps, 'chitine', (0, -0.42, 0.36), (0.24, 0.2, 0.16), rnd, n)  # tête
    for k in range(3):  # arête dorsale
        corps.cube('carapace_sombre', (0.06, 0.18, 0.08), (0, -0.05 + k * 0.25, 0.7 - abs(k - 1) * 0.05), 0.02)
    for s in (-1, 1):  # mandibules
        corps.barre('chitine', (s * 0.1, -0.52, 0.3), (s * 0.04, -0.72, 0.26), 0.05)
    _yeux(corps, [(s * 0.12, -0.55, 0.42) for s in (-1, 1)], 0.06)
    corps.finir()
    for g in _pattes(coll, [(-0.2, 0.36, 0.22), (0.05, 0.36, 0.26), (0.32, 0.34, 0.26)], 'chitine', 0.5, 0.24,
                     0.05):
        g.finir()


def ennemi_gardien(coll, leger=True):
    """Gardien (`guard`) : gros insecte blindé qui garde le nid, ~2,6 unités de long. Plaques épaisses à piquants
    couleur de corne, grosses pinces devant, pattes trapues."""
    rnd = random.Random(23)
    n = 14 if leger else 24
    corps = T.Lot(coll, 'corps')
    _bloc(corps, 'gardien', (0, 0.45, 0.72), (0.7, 0.8, 0.42), rnd, n)
    _bloc(corps, 'gardien_clair', (0, -0.15, 0.8), (0.62, 0.5, 0.38), rnd, n)
    _bloc(corps, 'gardien_sombre', (0, 0.95, 0.6), (0.5, 0.42, 0.3), rnd, n)
    _bloc(corps, 'gardien_sombre', (0, -0.72, 0.62), (0.4, 0.32, 0.28), rnd, n)  # tête
    for k in range(4):  # piquants dorsaux
        y = -0.3 + k * 0.38
        z = 1.15 - abs(k - 1.5) * 0.08
        for s in (-1, 1):
            corps.barre('corne', (s * 0.25, y, z - 0.1), (s * 0.45, y + 0.1, z + 0.18), 0.08)
        corps.barre('corne', (0, y, z - 0.05), (0, y + 0.08, z + 0.25), 0.09)
    for s in (-1, 1):  # pinces : bras, pince fixe, doigt
        base = Vector((s * 0.35, -0.8, 0.55))
        coude = Vector((s * 0.6, -1.05, 0.62))
        bout = Vector((s * 0.35, -1.3, 0.45))
        corps.barre('gardien_clair', base, coude, 0.14)
        corps.barre('gardien_clair', coude, bout, 0.16)
        corps.barre('corne', bout, bout + Vector((-s * 0.12, -0.12, 0.08)), 0.07)
        corps.barre('corne', bout, bout + Vector((-s * 0.1, -0.14, -0.08)), 0.06)
    _yeux(corps, [(s * 0.18, -0.95, 0.72) for s in (-1, 1)], 0.07)
    corps.finir()
    for g in _pattes(coll, [(-0.35, 0.6, 0.45), (0.15, 0.6, 0.55), (0.65, 0.55, 0.5)], 'gardien_sombre', 0.72,
                     0.4, 0.11, griffe='corne'):
        g.finir()


def ennemi_cracheur(coll, leger=True):
    """Cracheur (`spitter`) : insecte vert à gros sac d'acide luisant sur l'arrière, ~2 unités de long ; cou relevé
    terminé par une bouche en tube qui crache vers l'avant."""
    rnd = random.Random(37)
    n = 12 if leger else 22
    corps = T.Lot(coll, 'corps')
    _bloc(corps, 'cracheur', (0, -0.1, 0.5), (0.38, 0.38, 0.24), rnd, n)  # thorax
    _bloc(corps, 'acide', (0, 0.5, 0.62), (0.5, 0.55, 0.42), rnd, n + 4)  # sac d'acide
    for k in range(3):  # bandes de chitine sur le sac
        y = 0.25 + k * 0.25
        corps.cube('cracheur_sombre', (0.85 - abs(k - 1) * 0.15, 0.08, 0.06), (0, y, 1.0 - abs(k - 1) * 0.06), 0.02)
    _bloc(corps, 'cracheur_sombre', (0, -0.45, 0.62), (0.2, 0.2, 0.18), rnd, n)  # cou
    _bloc(corps, 'cracheur_clair', (0, -0.65, 0.8), (0.18, 0.18, 0.15), rnd, n)  # tête
    corps.tube('cracheur_sombre', (0, -0.72, 0.84), (0, -0.98, 0.92), 0.08, 8)  # bouche en tube
    corps.tube('acide', (0, -0.98, 0.92), (0, -1.0, 0.925), 0.055, 8)
    _yeux(corps, [(s * 0.12, -0.74, 0.92) for s in (-1, 1)], 0.05)
    corps.finir()
    for g in _pattes(coll, [(-0.3, 0.4, 0.24), (0.05, 0.4, 0.3), (0.4, 0.42, 0.34)], 'cracheur_sombre', 0.56, 0.28,
                     0.06):
        g.finir()


def nid(coll, leger=True):
    """Nid : monticule organique de 4 unités de diamètre, cheminées à bord épais, œufs luisants, piquants."""
    rnd = random.Random(53)
    n = 14 if leger else 26
    lot = T.Lot(coll, 'nid')
    _bloc(lot, 'nid', (0, 0, 0.0), (1.9, 1.9, 1.0), rnd, n + 8, plat=0.0)  # dôme
    for k in range(7):  # bosses tout autour
        a = k * 2 * math.pi / 7 + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(1.2, 1.55)
        _bloc(lot, rnd.choice(('nid_clair', 'nid_sombre')), (r * math.cos(a), r * math.sin(a), 0.0),
              (0.55, 0.5, rnd.uniform(0.45, 0.75)), rnd, n, rot=a, plat=0.0)
    for k in range(3):  # cheminées
        a = k * 2 * math.pi / 3 + 0.4
        c = Vector((0.75 * math.cos(a), 0.75 * math.sin(a), 0))
        T.tour(coll, f'cheminee_{k}', [(0.42, 0.5), (0.34, 1.0), (0.3, 1.25), (0.36, 1.35), (0.2, 1.36)],
               'nid_clair', segments=8 if leger else 14, centre=(c.x, c.y))
        lot.cube('noir', (0.3, 0.3, 0.02), (c.x, c.y, 1.37), 0.0, Matrix.Rotation(a, 3, 'Z'))
    for k in range(9):  # œufs luisants
        a = k * 2 * math.pi / 9 + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(1.3, 1.8)
        _bloc(lot, 'oeuf', (r * math.cos(a), r * math.sin(a), 0.12), (0.14, 0.14, 0.18), rnd, 8, plat=0.0)
    for k in range(12):  # piquants
        a = k * 2 * math.pi / 12 + rnd.uniform(-0.15, 0.15)
        r = rnd.uniform(0.9, 1.5)
        p = Vector((r * math.cos(a), r * math.sin(a), 0.55 - (r - 0.9) * 0.5))
        lot.barre('corne', p, p + Vector((math.cos(a) * 0.25, math.sin(a) * 0.25, 0.45)), 0.07)
    lot.finir()
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


MODELES = {
    'ennemi_eclaireur': ennemi_eclaireur,
    'ennemi_gardien': ennemi_gardien,
    'ennemi_cracheur': ennemi_cracheur,
    'nid': nid,
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
    T.save(os.path.join(ROOT, 'blender', 'creatures.blend'))


if __name__ == '__main__':
    main()
