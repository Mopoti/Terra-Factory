"""Famille « minéraux » : rochers de chaque biome et amas de minerai des gisements.

Style low poly stylisé (voir blender/README.md) : facettes, couleurs unies de la palette, pas de texture.
Deux niveaux de détail par modèle (collections `<nom>` et `<nom>_unity`), comme les machines.

Rochers (`rocher_<biome>_<n>`, biomes prairie, foret, desert, toundra) : le jeu les met à la taille voulue (largeur d'un
rocher moyen : 0,95 m, plus petits ou plus gros selon le tas) ; seules les proportions comptent. Posés au sol, centrés
en (0, 0), pas de repères d'emprise.

Minerai (`minerai_<gisement>_<n>`) : décor d'une case de gisement (1 unité = 1 case = 50 cm), posé sur la texture du sol.
Minerais solides : 3 (`_2`) ou 4 (`_1`) gros cailloux qui couvrent toute la case, chaque minerai avec sa couleur et son
effet (hématite à éclats métalliques, malachite en bandes, pierre mouchetée, charbon à facettes brillantes, blende à
cristaux, bauxite à billes, pechblende à veines). Sable : la case couverte de petits cailloux. Pétrole : une flaque.
Emprise ±0,5 autour de (0, 0), hauteur ≤ 0,45 (≈ 22 cm) pour rester sous le plancher des foreuses.

Les blocs sont des enveloppes convexes de points tirés sur un ellipsoïde (facettes irrégulières, base plate au sol).

Lancer :  blender --background --python blender/scripts/mineraux.py
Produit :  blender/mineraux.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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


# --- Briques communes ------------------------------------------------------------------------------------------------

def _points(rnd, n, dims, irreg=0.18):
    """`n` points répartis sur un ellipsoïde de demi-axes `dims` (spirale dorée), un peu bousculés."""
    pts = []
    or_ = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        u = 1 - 2 * (i + 0.5) / n
        s = math.sqrt(max(0.0, 1 - u * u))
        a = i * or_ + rnd.uniform(-0.3, 0.3)
        k = 1 - rnd.uniform(0, irreg)
        pts.append(Vector((s * math.cos(a) * dims[0] * k, s * math.sin(a) * dims[1] * k, u * dims[2] * k)))
    return pts


def _coque(bm_cible, pts):
    """Enveloppe convexe des points `pts`, ajoutée à `bm_cible`."""
    tmp = bmesh.new()
    vs = [tmp.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(tmp, input=vs)
    interieur = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if interieur:
        bmesh.ops.delete(tmp, geom=interieur, context='VERTS')
    T._verse(tmp, bm_cible)


def _bloc(lot, mat, c, dims, rnd, n=14, rot=0.0, sol=0.0, irreg=0.18, penche=(0.0, 0.0)):
    """Bloc de pierre : centre `c`, demi-axes `dims`, tourné de `rot` (rad) autour de Z, coupé à plat sous Z = `sol`.

    Renvoie les points de l'enveloppe (repère du monde) pour poser une calotte (mousse, neige) par-dessus.
    """
    m = Matrix.Rotation(rot, 3, 'Z') @ Matrix.Rotation(penche[0], 3, 'X') @ Matrix.Rotation(penche[1], 3, 'Y')
    pts = [m @ p + Vector(c) for p in _points(rnd, n, dims, irreg)]
    for p in pts:
        p.z = max(p.z, sol)
    _coque(lot.bms.setdefault(mat, bmesh.new()), pts)
    return pts


def _calotte(lot, mat, pts, seuil=0.5, ep=0.04):
    """Calotte (mousse, neige, lichen) sur les faces du bloc tournées vers le haut (normale.z > `seuil`).

    Les faces sont reprises de l'enveloppe des points `pts` et extrudées de `ep` vers l'extérieur : la calotte épouse le
    bloc, facette par facette ; son dessous est collé au bloc.
    """
    tmp = bmesh.new()
    vs = [tmp.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(tmp, input=vs)
    interieur = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if interieur:
        bmesh.ops.delete(tmp, geom=interieur, context='VERTS')
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    bas = [f for f in tmp.faces if f.normal.z <= seuil]
    if len(bas) == len(tmp.faces):
        tmp.free()
        return
    bmesh.ops.delete(tmp, geom=bas, context='FACES')
    ext = bmesh.ops.extrude_face_region(tmp, geom=list(tmp.faces))
    for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]:
        n = Vector()
        for f in v.link_faces:
            n += f.normal
        v.co += (n.normalized() if n.length > 0 else Vector((0, 0, 1))) * ep
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _cristal(lot, mat, pied, direction, longueur, r, seg=5):
    """Cristal : prisme pointu de `longueur` partant de `pied` vers `direction`."""
    d = Vector(direction).normalized()
    tmp = bmesh.new()
    corps = longueur * 0.72
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=seg, radius1=r, radius2=r * 0.9, depth=corps)
    bmesh.ops.translate(tmp, vec=Vector((0, 0, corps / 2)), verts=tmp.verts)
    pointe = bmesh.new()
    bmesh.ops.create_cone(pointe, cap_ends=True, segments=seg, radius1=r * 0.9, radius2=0.0, depth=longueur - corps)
    bmesh.ops.translate(pointe, vec=Vector((0, 0, corps + (longueur - corps) / 2)), verts=pointe.verts)
    T._verse(pointe, tmp)
    bmesh.ops.rotate(tmp, cent=Vector((0, 0, 0)), matrix=Vector((0, 0, 1)).rotation_difference(d).to_matrix(), verts=tmp.verts)
    bmesh.ops.translate(tmp, vec=Vector(pied), verts=tmp.verts)
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _brins(lot, rnd, c, n, h, mats, r=0.12):
    """Touffe d'herbe au pied d'un rocher."""
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, r)
        p = Vector((c[0] + d * math.cos(a), c[1] + d * math.sin(a), 0))
        q = p + Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, h * rnd.uniform(0.7, 1.1)))
        lot.barre(rnd.choice(mats), p, q, 0.035)


def _finir(coll, *lots):
    for l in lots:
        l.finir()
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


def _n(leger, n):
    """Nombre de points d'un bloc : plus de facettes dans la version Unity."""
    return round(n * 1.25) if leger else int(n * 2.2)


# --- Rochers de la prairie : granite gris, herbe au pied -------------------------------------------------------------

def rocher_prairie_1(coll, leger=True):
    """Gros bloc gris arrondi, un petit à côté, touffes d'herbe au pied."""
    rnd = random.Random(1101)
    lot, h = T.Lot(coll, 'roche'), T.Lot(coll, 'herbe')
    _bloc(lot, 'pierre', (0, 0, 0.45), (1.0, 0.8, 0.75), rnd, _n(leger, 16), rot=0.3)
    _bloc(lot, 'pierre_claire', (0.85, -0.55, 0.15), (0.38, 0.32, 0.3), rnd, _n(leger, 10))
    for c in ((-0.9, 0.4), (0.4, 0.75), (0.95, 0.1)):
        _brins(h, rnd, c, 5 if leger else 8, 0.3, ('feuille', 'feuille_claire'))
    _finir(coll, lot, h)


def rocher_prairie_2(coll, leger=True):
    """Trois galets serrés, du gris clair au gris sombre."""
    rnd = random.Random(1102)
    lot, h = T.Lot(coll, 'roche'), T.Lot(coll, 'herbe')
    _bloc(lot, 'pierre', (-0.35, 0.1, 0.35), (0.65, 0.55, 0.6), rnd, _n(leger, 14), rot=0.8)
    _bloc(lot, 'pierre_sombre', (0.5, 0.25, 0.25), (0.48, 0.42, 0.4), rnd, _n(leger, 12), rot=-0.4)
    _bloc(lot, 'pierre_claire', (0.15, -0.55, 0.18), (0.4, 0.33, 0.28), rnd, _n(leger, 10))
    _brins(h, rnd, (0.05, 0.75), 6 if leger else 9, 0.28, ('feuille', 'feuille_sombre'))
    _finir(coll, lot, h)


def rocher_prairie_3(coll, leger=True):
    """Dalle plate un peu penchée, taches de lichen."""
    rnd = random.Random(1103)
    lot, li = T.Lot(coll, 'roche'), T.Lot(coll, 'lichen')
    pts = _bloc(lot, 'pierre_claire', (0, 0, 0.25), (1.05, 0.75, 0.32), rnd, _n(leger, 14), penche=(0.12, -0.08))
    _calotte(li, 'lichen', [p for p in pts if p.x > -0.2], seuil=0.55, ep=0.025)
    _bloc(lot, 'pierre', (-0.7, 0.55, 0.12), (0.3, 0.25, 0.2), rnd, _n(leger, 9))
    _finir(coll, lot, li)


# --- Rochers de la forêt : blocs moussus ------------------------------------------------------------------------------

def rocher_foret_1(coll, leger=True):
    """Bloc sombre coiffé d'un épais tapis de mousse."""
    rnd = random.Random(1201)
    lot, mo = T.Lot(coll, 'roche'), T.Lot(coll, 'mousse')
    pts = _bloc(lot, 'pierre_sombre', (0, 0, 0.5), (0.95, 0.85, 0.75), rnd, _n(leger, 16), rot=0.5)
    _calotte(mo, 'mousse', pts, seuil=0.4, ep=0.06)
    _finir(coll, lot, mo)


def rocher_foret_2(coll, leger=True):
    """Bloc fendu en deux, mousse sur chaque moitié, fougère dans la fente."""
    rnd = random.Random(1202)
    lot, mo, fo = T.Lot(coll, 'roche'), T.Lot(coll, 'mousse'), T.Lot(coll, 'fougere')
    a = _bloc(lot, 'pierre', (-0.42, 0, 0.45), (0.5, 0.75, 0.7), rnd, _n(leger, 13), penche=(0, -0.12))
    b = _bloc(lot, 'pierre_sombre', (0.45, 0.05, 0.42), (0.48, 0.7, 0.65), rnd, _n(leger, 13), penche=(0, 0.14))
    _calotte(mo, 'mousse', a, seuil=0.55, ep=0.05)
    _calotte(mo, 'mousse_claire', b, seuil=0.55, ep=0.05)
    for k in range(5 if leger else 8):
        ang = -0.9 + k * 1.8 / (4 if leger else 7)
        fo.barre('feuille_sombre', (0.02, 0, 0.05), (0.02 + 0.08 * math.sin(ang), 0.55 * math.sin(ang), 0.6 + 0.2 * math.cos(ang)), 0.05)
    _finir(coll, lot, mo, fo)


def rocher_foret_3(coll, leger=True):
    """Tas bas de pierres, mousse et lichen, deux champignons."""
    rnd = random.Random(1203)
    lot, mo, ch = T.Lot(coll, 'roche'), T.Lot(coll, 'mousse'), T.Lot(coll, 'champignons')
    for (x, y, r, mat) in ((0, 0, 0.6, 'pierre_sombre'), (0.7, 0.3, 0.38, 'pierre'), (-0.65, 0.35, 0.4, 'pierre'),
                           (0.2, -0.6, 0.35, 'pierre_sombre')):
        pts = _bloc(lot, mat, (x, y, r * 0.55), (r, r * 0.85, r * 0.75), rnd, _n(leger, 11))
        _calotte(mo, rnd.choice(('mousse', 'mousse_claire', 'lichen')), pts, seuil=0.55, ep=0.035)
    for (x, y) in ((-0.3, -0.55), (-0.15, -0.68)):
        ch.tube('ecorce_claire', (x, y, 0), (x, y, 0.16), 0.03, 6)
        T.cylinder(coll, f'chapeau_{x}', 0.09, 0.05, (x, y, 0.18), 'rouge', segments=8, radius_top=0.02)
    _finir(coll, lot, mo, ch)


# --- Rochers du désert : grès rouge en strates ------------------------------------------------------------------------

def _strates(lot, rnd, c, r, hauteurs, mats, n, rot=0.0):
    """Pile de couches de grès, chacune un bloc aplati un peu décalé et de largeur variable."""
    z = 0.0
    tops = []
    for k, (h, rr) in enumerate(zip(hauteurs, r)):
        dx, dy = rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06)
        tops = _bloc(lot, mats[k % len(mats)], (c[0] + dx, c[1] + dy, z + h / 2), (rr[0], rr[1], h / 2 + 0.02), rnd, n,
                     rot=rot + rnd.uniform(-0.15, 0.15), sol=z, irreg=0.1)
        z += h
    return tops


def rocher_desert_1(coll, leger=True):
    """Bloc de grès en strates claires et sombres."""
    rnd = random.Random(1301)
    lot = T.Lot(coll, 'roche')
    _strates(lot, rnd, (0, 0), [(1.0, 0.8), (0.95, 0.75), (0.85, 0.7), (0.7, 0.55)], [0.3, 0.25, 0.3, 0.22],
             ('gres', 'gres_clair', 'gres_sombre'), _n(leger, 12), rot=0.2)
    _finir(coll, lot)


def rocher_desert_2(coll, leger=True):
    """Rocher en équilibre : pied de grès en strates étroit, gros bloc posé dessus."""
    rnd = random.Random(1302)
    lot = T.Lot(coll, 'roche')
    _strates(lot, rnd, (0, 0), [(0.55, 0.5), (0.42, 0.38), (0.32, 0.3)], [0.3, 0.3, 0.3], ('gres_sombre', 'gres'),
             _n(leger, 10))
    _bloc(lot, 'gres_clair', (0.05, 0, 1.2), (0.75, 0.6, 0.4), rnd, _n(leger, 14), rot=0.4)
    _bloc(lot, 'gres', (0.65, -0.35, 0.14), (0.25, 0.2, 0.17), rnd, _n(leger, 8))
    _finir(coll, lot)


def rocher_desert_3(coll, leger=True):
    """Galets ronds de grès rouge à moitié ensablés."""
    rnd = random.Random(1303)
    lot = T.Lot(coll, 'roche')
    _bloc(lot, 'sable', (0, 0, 0.0), (1.05, 0.85, 0.14), rnd, _n(leger, 12), irreg=0.05)
    _bloc(lot, 'gres', (-0.25, 0.1, 0.35), (0.6, 0.5, 0.45), rnd, _n(leger, 13), rot=0.6)
    _bloc(lot, 'gres_sombre', (0.5, -0.2, 0.22), (0.4, 0.35, 0.3), rnd, _n(leger, 11))
    _bloc(lot, 'gres_clair', (0.3, 0.55, 0.15), (0.25, 0.22, 0.2), rnd, _n(leger, 9))
    _finir(coll, lot)


# --- Rochers de la toundra : granite enneigé --------------------------------------------------------------------------

def rocher_toundra_1(coll, leger=True):
    """Bloc de granite coiffé de neige."""
    rnd = random.Random(1401)
    lot, ne = T.Lot(coll, 'roche'), T.Lot(coll, 'neige')
    pts = _bloc(lot, 'granite', (0, 0, 0.5), (0.95, 0.8, 0.72), rnd, _n(leger, 16), rot=0.1)
    _calotte(ne, 'neige', pts, seuil=0.45, ep=0.07)
    _bloc(ne, 'neige', (0.7, 0.55, 0.0), (0.45, 0.35, 0.1), rnd, _n(leger, 9), irreg=0.05)
    _finir(coll, lot, ne)


def rocher_toundra_2(coll, leger=True):
    """Deux blocs enneigés, cristaux de glace dans le creux."""
    rnd = random.Random(1402)
    lot, ne, gl = T.Lot(coll, 'roche'), T.Lot(coll, 'neige'), T.Lot(coll, 'glace')
    a = _bloc(lot, 'granite', (-0.4, 0.05, 0.42), (0.6, 0.55, 0.62), rnd, _n(leger, 14), rot=0.7)
    b = _bloc(lot, 'pierre_sombre', (0.5, -0.1, 0.3), (0.5, 0.45, 0.45), rnd, _n(leger, 12))
    _calotte(ne, 'neige', a, seuil=0.5, ep=0.06)
    _calotte(ne, 'neige', b, seuil=0.55, ep=0.05)
    for (d, l) in (((0.2, 0.5, 1), 0.45), ((-0.3, 0.4, 1), 0.35), ((0.5, 0.2, 1), 0.3)):
        _cristal(gl, 'glace', (0.08, 0.45, 0.02), d, l, 0.06)
    _finir(coll, lot, ne, gl)


def rocher_toundra_3(coll, leger=True):
    """Dalles de granite empilées, neige sur le dessus et au pied."""
    rnd = random.Random(1403)
    lot, ne = T.Lot(coll, 'roche'), T.Lot(coll, 'neige')
    a = _bloc(lot, 'granite', (0, 0, 0.2), (1.0, 0.8, 0.24), rnd, _n(leger, 12), rot=0.2, irreg=0.1)
    b = _bloc(lot, 'pierre', (0.1, 0.05, 0.55), (0.7, 0.55, 0.2), rnd, _n(leger, 11), rot=0.9, sol=0.38, irreg=0.1)
    _calotte(ne, 'neige', b, seuil=0.4, ep=0.06)
    _calotte(ne, 'neige', [p for p in a if p.x < -0.3], seuil=0.35, ep=0.05)
    _bloc(ne, 'neige', (-0.5, -0.6, 0.0), (0.5, 0.3, 0.09), rnd, _n(leger, 9), irreg=0.05)
    _finir(coll, lot, ne)


# --- Minerai : cailloux qui couvrent la case ---------------------------------------------------------------------------

def _amas(lot, rnd, n, mats, r=(0.08, 0.16), zone=0.36, pts=9, haut=0.7, rot=True, irreg=0.15):
    """`n` éclats posés au hasard dans la case, à moitié enfoncés (base plate au sol)."""
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        d = zone * math.sqrt(rnd.random())
        rr = rnd.uniform(*r)
        c = (d * math.cos(a), d * math.sin(a), rr * 0.25)
        _bloc(lot, rnd.choice(mats), c, (rr, rr * rnd.uniform(0.7, 1.0), rr * haut), rnd, pts,
              rot=rnd.uniform(0, math.pi) if rot else 0.0, irreg=irreg)


def _galet(c, dims, rnd, n, rot):
    """Caillou à facettes (enveloppe convexe, base plate au sol), dans un bmesh à part : renvoie ce bmesh."""
    m = Matrix.Rotation(rot, 3, 'Z')
    pts = [m @ p + Vector(c) for p in _points(rnd, n, dims, 0.08)]
    for p in pts:
        p.z = max(p.z, 0.0)
    tmp = bmesh.new()
    vs = [tmp.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(tmp, input=vs)
    interieur = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if interieur:
        bmesh.ops.delete(tmp, geom=interieur, context='VERTS')
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    return tmp


def _trancher(tmp, normale, pas, phase=0.0):
    """Coupe le caillou par des plans parallèles (normale `normale`, tous les `pas`) : de vraies bandes de facettes."""
    n = Vector(normale).normalized()
    ds = [v.co.dot(n) for v in tmp.verts]
    d = min(ds) + phase % pas
    while d < max(ds):
        geom = list(tmp.verts) + list(tmp.edges) + list(tmp.faces)
        bmesh.ops.bisect_plane(tmp, geom=geom, plane_co=n * d, plane_no=n)
        d += pas
    return n


def _repartir(lot, tmp, choix):
    """Range chaque facette du caillou dans la teinte que lui donne `choix(facette)`, puis libère le caillou."""
    tmp.faces.index_update()
    groupes = {}
    for f in tmp.faces:
        groupes.setdefault(choix(f), set()).add(f.index)
    for mat, garder in groupes.items():
        cp = tmp.copy()
        cp.faces.index_update()
        jeter = [f for f in cp.faces if f.index not in garder]
        if jeter:
            bmesh.ops.delete(cp, geom=jeter, context='FACES')
        T._verse(cp, lot.bms.setdefault(mat, bmesh.new()))
    tmp.free()


def _places(nb, rnd):
    """Centre et demi-largeur de `nb` cailloux (3 ou 4) qui se partagent la case (de -0,5 à 0,5)."""
    if nb == 4:
        base = [(-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)]
        r = 0.34
    else:
        base = [(0.24 * math.cos(a), 0.24 * math.sin(a)) for a in (math.pi / 2, 7 * math.pi / 6, 11 * math.pi / 6)]
        r = 0.39
    return [((x + rnd.uniform(-0.03, 0.03), y + rnd.uniform(-0.03, 0.03)), r * rnd.uniform(0.92, 1.05)) for x, y in base]


# Effet de chaque minerai : `choix(rnd, facette, caillou)` donne la teinte d'une facette ; `avant` découpe le caillou
# (bandes, veines) ; `apres` ajoute des reliefs (grains, cristaux).

def _effet_fer(lot, rnd, tmp, c, r, leger):
    """Hématite : rouge sang sombre, facettes rouille et quelques éclats métalliques."""
    _repartir(lot, tmp, lambda f: rnd.choices(('hematite', 'rouille', 'fer_metal'), (5, 3, 2))[0])


def _effet_cuivre(lot, rnd, tmp, c, r, leger):
    """Malachite : bandes parallèles de verts (sombre, moyen, clair), comme une pierre polie."""
    n = _trancher(tmp, (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), 1), 0.045, rnd.uniform(0, 0.045))
    d0 = min(v.co.dot(n) for v in tmp.verts)
    teintes = ('malachite_sombre', 'malachite', 'malachite_claire', 'malachite')
    _repartir(lot, tmp, lambda f: teintes[int((f.calc_center_median().dot(n) - d0) / 0.045) % 4])


def _effet_pierre(lot, rnd, tmp, c, r, leger):
    """Pierre : gris aux facettes de trois nuances, mouchetée de petits grains clairs et sombres."""
    faces = list(tmp.faces)
    hauts = [f.calc_center_median().copy() + f.normal * 0.004 for f in faces if f.normal.z > 0.2]
    _repartir(lot, tmp, lambda f: rnd.choices(('pierre', 'pierre_claire', 'pierre_sombre'), (5, 2, 2))[0])
    for p in rnd.sample(hauts, min(len(hauts), 6 if leger else 10)):
        _bloc(lot, rnd.choice(('blanc', 'blanc', 'noir')), p, (0.035, 0.03, 0.014), rnd, 5,
              rot=rnd.uniform(0, math.pi), sol=-1)


def _effet_charbon(lot, rnd, tmp, c, r, leger):
    """Charbon : noir mat, facettes brillantes comme du verre et quelques reflets presque blancs."""
    _repartir(lot, tmp, lambda f: rnd.choices(('charbon', 'charbon_brillant', 'gris_clair'),
                                              (5, 3, 0.5 if f.normal.z > 0.5 else 0.1))[0])


def _effet_zinc(lot, rnd, tmp, c, r, leger):
    """Blende (zinc) : roche ocre à facettes miel, hérissée de petits cristaux gris acier."""
    faces = list(tmp.faces)
    hauts = [(f.calc_center_median().copy(), f.normal.copy()) for f in faces if f.normal.z > 0.45]
    _repartir(lot, tmp, lambda f: rnd.choices(('zinc_roche', 'zinc_miel'), (3, 2))[0])
    for p, n in rnd.sample(hauts, min(len(hauts), 2 if leger else 4)):
        for _ in range(2):
            d = n + Vector((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 0.3))
            _cristal(lot, rnd.choice(('zinc_metal', 'gris_clair')), p - n * 0.01, d, rnd.uniform(0.08, 0.13),
                     rnd.uniform(0.018, 0.026), seg=4)


def _effet_bauxite(lot, rnd, tmp, c, r, leger):
    """Bauxite : argile rouge brique, couverte de petites billes rondes (pisolithes) orangées."""
    faces = list(tmp.faces)
    hauts = [f.calc_center_median().copy() for f in faces if f.normal.z > 0.1]
    _repartir(lot, tmp, lambda f: rnd.choices(('bauxite', 'brique_sombre'), (4, 1))[0])
    for p in rnd.sample(hauts, min(len(hauts), 5 if leger else 9)):
        _bloc(lot, rnd.choice(('bauxite_clair', 'gres_clair', 'bauxite_clair')), p, (0.035,) * 3, rnd, 8, sol=-1,
              irreg=0.05)


def _effet_uraninite(lot, rnd, tmp, c, r, leger):
    """Uraninite (pechblende) : noir de poix luisant, traversé de veines jaune-vert vif."""
    veines = []
    for _ in range(2):
        a = rnd.uniform(0, math.pi)
        n = Vector((math.cos(a), math.sin(a), rnd.uniform(-0.4, 0.4))).normalized()
        d0 = Vector(c).dot(n) + rnd.uniform(-0.6, 0.6) * r
        for d in (d0, d0 + 0.035):
            geom = list(tmp.verts) + list(tmp.edges) + list(tmp.faces)
            bmesh.ops.bisect_plane(tmp, geom=geom, plane_co=n * d, plane_no=n)
        veines.append((n, d0))

    def choix(f):
        p = f.calc_center_median()
        if any(d < p.dot(n) < d + 0.035 for n, d in veines):
            return 'autunite'
        return rnd.choices(('pechblende', 'charbon_brillant'), (5, 1))[0]
    _repartir(lot, tmp, choix)


EFFETS = {
    'fer': _effet_fer,
    'cuivre': _effet_cuivre,
    'pierre': _effet_pierre,
    'charbon': _effet_charbon,
    'zinc': _effet_zinc,
    'bauxite': _effet_bauxite,
    'uraninite': _effet_uraninite,
}


def _minerai(nom, graine, nb):
    """Case de minerai : `nb` (3 ou 4) gros cailloux qui couvrent la case, chacun avec l'effet du minerai."""
    effet = EFFETS[nom]

    def fabrique(coll, leger=True):
        rnd = random.Random(graine)
        lot = T.Lot(coll, 'minerai')
        for (x, y), r in _places(nb, rnd):
            h = r * rnd.uniform(0.55, 0.75)
            tmp = _galet((x, y, 0.03), (r, r * rnd.uniform(0.85, 1.0), h), rnd, 10 if leger else 18,
                         rnd.uniform(0, math.pi))
            effet(lot, rnd, tmp, (x, y, 0.03), r, leger)
        _finir(coll, lot)
        # Hauteur bornée (les foreuses se posent par-dessus).
        zmax = max((o.matrix_basis @ v.co).z for o in coll.objects for v in o.data.vertices)
        if zmax > 0.45:
            k = 0.45 / zmax
            for o in coll.objects:
                o.data.transform(Matrix.Diagonal((1, 1, k, 1)))
    fabrique.__name__ = nom
    fabrique.__doc__ = f'Case de minerai « {nom} » ({nb} cailloux).'
    return fabrique


def _sable(graine):
    def fabrique(coll, leger=True):
        """Sable : la case couverte de petits cailloux et de grains, du blond au rosé."""
        rnd = random.Random(graine)
        lot = T.Lot(coll, 'sable')
        cote = 6 if leger else 8
        pas = 0.94 / cote
        for i in range(cote):
            for j in range(cote):
                x = -0.47 + (i + 0.5) * pas + rnd.uniform(-0.3, 0.3) * pas
                y = -0.47 + (j + 0.5) * pas + rnd.uniform(-0.3, 0.3) * pas
                r = pas * rnd.uniform(0.6, 0.85)
                _bloc(lot, rnd.choices(('sable', 'sable_clair', 'gres_clair', 'pierre_claire', 'gres'), (5, 4, 2, 1, 1))[0],
                      (x, y, 0.0), (r, r * rnd.uniform(0.7, 1.0), r * rnd.uniform(0.5, 0.8)), rnd, 6 if leger else 9,
                      rot=rnd.uniform(0, math.pi), irreg=0.15)
        _finir(coll, lot)
    return fabrique


def _petrole(graine):
    def fabrique(coll, leger=True):
        """Suintement de pétrole : flaque noire bombée, bulles et reflets irisés."""
        rnd = random.Random(graine)
        lot = T.Lot(coll, 'petrole')
        _bloc(lot, 'petrole', (0, 0, 0.0), (0.4, 0.34, 0.05), rnd, 12, irreg=0.06, rot=rnd.uniform(0, math.pi))
        _bloc(lot, 'irise', (rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), 0.0), (0.18, 0.12, 0.062), rnd, 9,
              irreg=0.06, rot=rnd.uniform(0, math.pi))
        for _ in range(4 if leger else 7):
            a = rnd.uniform(0, 2 * math.pi)
            d = 0.28 * math.sqrt(rnd.random())
            r = rnd.uniform(0.03, 0.07)
            lot.boule(rnd.choice(('petrole', 'petrole', 'irise')), (d * math.cos(a), d * math.sin(a), 0.03), r)
        _amas(lot, rnd, 3, ('pierre_sombre',), r=(0.05, 0.08), pts=7, zone=0.42)
        _finir(coll, lot)
    return fabrique


MODELES = {}
for _b in ('prairie', 'foret', 'desert', 'toundra'):
    for _k in (1, 2, 3):
        MODELES[f'rocher_{_b}_{_k}'] = globals()[f'rocher_{_b}_{_k}']
# Deux variantes par minerai : 4 cailloux (_1) et 3 cailloux (_2).
for _i, _nom in enumerate(EFFETS):
    for _k in (1, 2):
        MODELES[f'minerai_{_nom}_{_k}'] = _minerai(_nom, 2000 + 10 * _i + _k, 4 if _k == 1 else 3)
for _k in (1, 2):
    MODELES[f'minerai_sable_{_k}'] = _sable(2100 + _k)
    MODELES[f'minerai_petrole_{_k}'] = _petrole(2110 + _k)


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
    T.save(os.path.join(ROOT, 'blender', 'mineraux.blend'))


if __name__ == '__main__':
    main()
