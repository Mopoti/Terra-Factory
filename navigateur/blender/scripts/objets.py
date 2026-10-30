"""Famille « objets » : les objets posés au sol (piles jetées par le joueur, butin), une forme par sorte d'objet.

Style low poly stylisé (voir blender/README.md). Chaque forme sert à plusieurs objets du jeu : les faces de la teinte
`teinte` (magenta pur dans le fichier) prennent la couleur de l'objet (`color` dans `content/items.json`) ; les
autres teintes restent. Exemple : `objet_lingot` sert aux lingots de fer, de cuivre, de zinc, d'acier…

Taille : environ 0,7 unité de large (35 cm dans le jeu), posé au sol, centré en (0, 0). Les machines posées au sol
n'ont pas de forme ici : le jeu montre leur propre modèle en miniature.

Lancer :  blender --background --python blender/scripts/objets.py
Produit :  blender/objets.blend, export/objet_<forme>.glb et export/unity/objet_<forme>.glb
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

sys.path.insert(0, HERE)
import outils as O  # noqa: E402  (formes du style doux)

#: Teinte remplacée par la couleur de l'objet dans le jeu (magenta pur : impossible à confondre).
TEINTE = 'teinte'
T.PALETTE.setdefault(TEINTE, '#ff00ff')
T.PALETTE.setdefault('teinte_sombre', '#3a3f45')
T.PALETTE.setdefault('carton', '#b48a58')
T.PALETTE.setdefault('ficelle', '#d9c79a')
T.PALETTE.setdefault('verre_clair', '#cfe8f0')


def _palette():
    T.PALETTE.setdefault(TEINTE, '#ff00ff')
    T.PALETTE.setdefault('teinte_sombre', '#3a3f45')
    T.PALETTE.setdefault('carton', '#b48a58')
    T.PALETTE.setdefault('ficelle', '#d9c79a')
    T.PALETTE.setdefault('verre_clair', '#cfe8f0')


def _finir(coll, *lots):
    for l in lots:
        l.finir()
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


def _galet(lot, mat, c, dims, rnd, n=9, rot=0.0):
    """Petit bloc à facettes (enveloppe convexe de points sur un ellipsoïde), base plate."""
    tmp = bmesh.new()
    m = Matrix.Rotation(rot, 3, 'Z')
    pts = []
    for i in range(n):
        u = 1 - 2 * (i + 0.5) / n
        s = math.sqrt(max(0.0, 1 - u * u))
        a = i * math.pi * (3 - math.sqrt(5)) + rnd.uniform(-0.3, 0.3)
        k = 1 - rnd.uniform(0, 0.15)
        p = m @ Vector((s * math.cos(a) * dims[0] * k, s * math.sin(a) * dims[1] * k, u * dims[2] * k)) + Vector(c)
        p.z = max(p.z, 0.0)
        pts.append(tmp.verts.new(p))
    res = bmesh.ops.convex_hull(tmp, input=pts)
    dedans = list({v for v in res['geom_interior'] + res['geom_unused'] if isinstance(v, bmesh.types.BMVert)})
    if dedans:
        bmesh.ops.delete(tmp, geom=dedans, context='VERTS')
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _tas(lot, rnd, n, mats, r=(0.08, 0.13), zone=0.24, haut=0.7, pts=8):
    """Petit tas d'éclats, plus haut au milieu."""
    for k in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        d = zone * math.sqrt(rnd.random())
        rr = rnd.uniform(*r)
        z = rr * 0.4 + (zone - d) * 0.5
        _galet(lot, rnd.choice(mats), (d * math.cos(a), d * math.sin(a), z), (rr, rr * 0.85, rr * haut), rnd, pts,
               rnd.uniform(0, math.pi))


# --- Formes ----------------------------------------------------------------------------------------------------------

def objet_bois(coll, leger=True):
    """Bûches empilées (2 + 1), écorce et bout clair."""
    lot = T.Lot(coll, 'bois')
    sg = 7 if leger else 12
    for (y, z) in ((-0.11, 0.1), (0.11, 0.1), (0, 0.28)):
        lot.tube('ecorce', (-0.32, y, z), (0.32, y, z), 0.1, sg)
        for x in (-0.325, 0.325):
            lot.tube('bois', (x - 0.004, y, z), (x + 0.004, y, z), 0.085, sg)
    _finir(coll, lot)


def objet_caillou(coll, leger=True):
    """Pierres (pierre, pierre concassée, scories) : tas de cailloux de la teinte."""
    rnd = random.Random(31)
    lot = T.Lot(coll, 'cailloux')
    _tas(lot, rnd, 10 if leger else 15, (TEINTE, TEINTE, 'pierre_sombre'), zone=0.2)
    _finir(coll, lot)


def objet_minerai(coll, leger=True):
    """Minerais : gros éclats de la teinte, quelques facettes brillantes."""
    rnd = random.Random(32)
    lot = T.Lot(coll, 'minerai')
    _tas(lot, rnd, 8 if leger else 12, (TEINTE, TEINTE, TEINTE, 'gris_clair'), r=(0.09, 0.14), zone=0.2, pts=7)
    _finir(coll, lot)


def objet_sable(coll, leger=True):
    """Sable, poudres : petit tas conique de la teinte."""
    lot = T.Lot(coll, 'sable')
    T.cylinder(coll, 'tas', 0.3, 0.2, (0, 0, 0.1), TEINTE, segments=9 if leger else 16, radius_top=0.05)
    rnd = random.Random(33)
    _tas(lot, rnd, 4, (TEINTE,), r=(0.04, 0.06), zone=0.3, haut=0.6, pts=6)
    _finir(coll, lot)


def objet_lingot(coll, leger=True):
    """Lingots : pile de trois barres trapézoïdales."""
    lot = T.Lot(coll, 'lingots')

    def barre(c, rot):
        tmp = bmesh.new()
        bas = [(-0.24, -0.08), (0.24, -0.08), (0.24, 0.08), (-0.24, 0.08)]
        haut = [(-0.2, -0.055), (0.2, -0.055), (0.2, 0.055), (-0.2, 0.055)]
        vb = [tmp.verts.new((x, y, 0)) for x, y in bas]
        vh = [tmp.verts.new((x, y, 0.09)) for x, y in haut]
        tmp.faces.new(list(reversed(vb)))
        tmp.faces.new(vh)
        for i in range(4):
            j = (i + 1) % 4
            tmp.faces.new((vb[i], vb[j], vh[j], vh[i]))
        bmesh.ops.rotate(tmp, cent=Vector(), matrix=Matrix.Rotation(rot, 3, 'Z'), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=Vector(c), verts=tmp.verts)
        T._verse(tmp, lot.bms.setdefault(TEINTE, bmesh.new()))

    barre((0, -0.1, 0), 0)
    barre((0, 0.1, 0), 0)
    barre((0, 0, 0.09), math.pi / 2)
    _finir(coll, lot)


def objet_plaque(coll, leger=True):
    """Plaques : pile de tôles légèrement décalées."""
    lot = T.Lot(coll, 'plaques')
    for k in range(4):
        lot.cube(TEINTE, (0.56, 0.42, 0.035), (0.01 * (k % 2), -0.01 * k, 0.02 + 0.04 * k), 0.006,
                 Matrix.Rotation(0.06 * (k - 1.5), 3, 'Z'))
    _finir(coll, lot)


def objet_engrenage(coll, leger=True):
    """Engrenages : une roue dentée couchée, une autre appuyée."""
    lot = T.Lot(coll, 'engrenages')
    sg = 10 if leger else 16

    def roue(c, r, rot):
        tmp_lot = T.Lot(coll, '_tmp')
        tmp_lot.tube(TEINTE, (0, 0, -0.035), (0, 0, 0.035), r, sg)
        for k in range(sg):
            a = 2 * math.pi * k / sg
            tmp_lot.cube(TEINTE, (0.06, 0.05, 0.07), (math.cos(a) * (r + 0.02), math.sin(a) * (r + 0.02), 0), 0,
                         Matrix.Rotation(a, 3, 'Z'))
        tmp_lot.tube('teinte_sombre', (0, 0, -0.04), (0, 0, 0.04), r * 0.3, 8)
        for mat, bm in tmp_lot.bms.items():
            bmesh.ops.rotate(bm, cent=Vector(), matrix=rot, verts=bm.verts)
            bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
            T._verse(bm, lot.bms.setdefault(mat, bmesh.new()))
        tmp_lot.bms = {}

    roue((0, 0, 0.035), 0.2, Matrix.Identity(3))
    roue((0.12, 0.05, 0.16), 0.13, Matrix.Rotation(1.2, 3, 'X'))
    _finir(coll, lot)


def objet_bobine(coll, leger=True):
    """Fils et câbles : bobine de fil de la teinte sur un touret en bois."""
    lot = T.Lot(coll, 'bobine')
    sg = 10 if leger else 16
    for x in (-0.16, 0.16):
        lot.tube('bois', (x - 0.02, 0, 0.2), (x + 0.02, 0, 0.2), 0.2, sg)
    lot.tube(TEINTE, (-0.14, 0, 0.2), (0.14, 0, 0.2), 0.15, sg)
    for k in range(4 if leger else 7):
        x = -0.12 + 0.24 * k / (3 if leger else 6)
        lot.tube(TEINTE, (x - 0.012, 0, 0.2), (x + 0.012, 0, 0.2), 0.16, sg)  # spires
    _finir(coll, lot)


def objet_fibre(coll, leger=True):
    """Fibres : botte de brins liée par deux ficelles."""
    rnd = random.Random(35)
    lot = T.Lot(coll, 'fibre')
    for k in range(10 if leger else 18):
        y = rnd.uniform(-0.08, 0.08)
        z = 0.05 + rnd.uniform(0, 0.12)
        lot.barre(TEINTE, (-0.3, y + rnd.uniform(-0.04, 0.04), z), (0.3, y + rnd.uniform(-0.04, 0.04), z), 0.035)
    for x in (-0.14, 0.14):
        lot.tube('ficelle', (x - 0.02, 0, 0.11), (x + 0.02, 0, 0.11), 0.11, 8)
    _finir(coll, lot)


def objet_tissu(coll, leger=True):
    """Tissu : rouleau et coupon plié."""
    lot = T.Lot(coll, 'tissu')
    sg = 10 if leger else 16
    lot.tube(TEINTE, (-0.28, -0.08, 0.1), (0.28, -0.08, 0.1), 0.1, sg)
    lot.tube('teinte_sombre', (-0.3, -0.08, 0.1), (0.3, -0.08, 0.1), 0.025, 6)
    lot.cube(TEINTE, (0.4, 0.22, 0.08), (0, 0.15, 0.04), 0.02)
    _finir(coll, lot)


def objet_baril(coll, leger=True):
    """Barils : fût debout en acier, bande et couvercle de la teinte (vide, eau, pétrole…)."""
    sg = 10 if leger else 16
    T.cylinder(coll, 'fut', 0.22, 0.6, (0, 0, 0.3), 'acier', segments=sg)
    lot = T.Lot(coll, 'baril')
    for z in (0.15, 0.45):
        lot.tube('acier_sombre', (0, 0, z - 0.015), (0, 0, z + 0.015), 0.235, sg)
    lot.tube(TEINTE, (0, 0, 0.24), (0, 0, 0.36), 0.226, sg)
    lot.tube(TEINTE, (0, 0, 0.6), (0, 0, 0.615), 0.2, sg)
    lot.tube('acier_sombre', (0.1, 0, 0.61), (0.1, 0, 0.64), 0.035, 8)  # bouchon
    _finir(coll, lot)


def objet_science(coll, leger=True):
    """Paquets de science : fiole au liquide de la teinte dans un petit casier en bois."""
    sg = 8 if leger else 14
    lot = T.Lot(coll, 'science')
    lot.cube('bois', (0.36, 0.36, 0.05), (0, 0, 0.025))
    for x in (-0.16, 0.16):
        for y in (-0.16, 0.16):
            lot.cube('bois_sombre', (0.04, 0.04, 0.24), (x, y, 0.12))
    lot.cube('bois', (0.36, 0.04, 0.04), (0, -0.16, 0.22))
    lot.cube('bois', (0.36, 0.04, 0.04), (0, 0.16, 0.22))
    lot.boule(TEINTE, (0, 0, 0.16), 0.12)  # fiole pleine du liquide
    lot.tube('verre_clair', (0, 0, 0.18), (0, 0, 0.21), 0.122, sg)  # reflet du verre
    lot.tube('verre_clair', (0, 0, 0.24), (0, 0, 0.36), 0.035, sg)
    lot.tube('bois', (0, 0, 0.36), (0, 0, 0.4), 0.04, sg)  # bouchon
    _finir(coll, lot)


def objet_puce(coll, leger=True):
    """Puces, isolants, petites pièces : deux puces à pattes de la teinte sur une plaque."""
    lot = T.Lot(coll, 'puce')
    lot.cube('vert_fonce', (0.46, 0.34, 0.03), (0, 0, 0.015))
    for (x, y) in ((-0.1, 0), (0.12, 0.02)):
        lot.cube(TEINTE, (0.16, 0.14, 0.05), (x, y, 0.055))
        for k in range(4):
            for s in (1, -1):
                lot.cube('acier', (0.02, 0.04, 0.015), (x - 0.06 + 0.04 * k, y + s * 0.085, 0.035))
    _finir(coll, lot)


def objet_bloc(coll, leger=True):
    """Blocs (béton…) : trois parpaings empilés."""
    lot = T.Lot(coll, 'blocs')
    for (x, z, r) in ((-0.13, 0.07, 0.0), (0.13, 0.07, 0.05), (0.0, 0.21, 0.4)):
        lot.cube(TEINTE, (0.24, 0.36, 0.14), (x, 0, z), 0.012, Matrix.Rotation(r, 3, 'Z'))
        lot.cube('teinte_sombre', (0.06, 0.2, 0.142), (x, 0, z), 0, Matrix.Rotation(r, 3, 'Z'))
    _finir(coll, lot)


def objet_conteneur(coll, leger=True):
    """Matières nucléaires : conteneur blindé à bandes jaunes, hublot de la teinte."""
    sg = 10 if leger else 16
    T.cylinder(coll, 'corps', 0.17, 0.46, (0, 0, 0.23), 'acier_sombre', segments=sg)
    lot = T.Lot(coll, 'conteneur')
    for z in (0.08, 0.38):
        lot.tube('jaune', (0, 0, z - 0.025), (0, 0, z + 0.025), 0.18, sg)
    lot.tube(TEINTE, (0, -0.15, 0.23), (0, -0.19, 0.23), 0.07, 8)
    lot.tube('acier', (0, 0, 0.46), (0, 0, 0.5), 0.1, sg)
    _finir(coll, lot)


def objet_verre(coll, leger=True):
    """Verre : blocs de verre teinté."""
    rnd = random.Random(37)
    lot = T.Lot(coll, 'verre')
    _tas(lot, rnd, 7 if leger else 10, (TEINTE, 'verre_clair'), r=(0.08, 0.12), zone=0.18, pts=6, haut=0.9)
    _finir(coll, lot)


def objet_caisse(coll, leger=True):
    """Tout le reste (vêtements, armes, outils, pièces) : caisse en bois, étiquette de la teinte."""
    lot = T.Lot(coll, 'caisse')
    lot.cube('bois', (0.46, 0.4, 0.34), (0, 0, 0.17), 0.015)
    for z in (0.04, 0.3):
        lot.cube('bois_sombre', (0.47, 0.41, 0.04), (0, 0, z))
    for x in (-0.21, 0.21):
        lot.cube('bois_sombre', (0.04, 0.41, 0.34), (x, 0, 0.17))
    lot.cube(TEINTE, (0.2, 0.01, 0.12), (0, -0.206, 0.17))
    lot.cube(TEINTE, (0.2, 0.16, 0.01), (0, 0, 0.346))
    _finir(coll, lot)


def objet_carapace(coll, leger=True):
    """Carapace d'ennemi (butin) : demi-coque bombée à plaques, bordeaux, arête et piquants couleur de corne."""
    rnd = random.Random(41)
    lot = T.Lot(coll, 'carapace')
    T.PALETTE.setdefault('carapace', '#7a2d3a')
    T.PALETTE.setdefault('carapace_sombre', '#4e1c26')
    T.PALETTE.setdefault('corne', '#c9b89a')
    for k, (y, r, h) in enumerate(((-0.14, 0.2, 0.13), (0.0, 0.25, 0.17), (0.15, 0.22, 0.14))):
        _galet(lot, 'carapace' if k != 1 else 'carapace_sombre', (0, y, 0.0), (r, 0.16, h), rnd, 14 if leger else 22)
    for y in (-0.12, 0.02, 0.16):
        lot.barre('corne', (0, y, 0.14), (0, y + 0.04, 0.22), 0.035)
    _finir(coll, lot)


def objet_tissu_vivant(coll, leger=True):
    """Tissu vivant (butin) : masse de chair rose luisante, quelques nodules plus clairs."""
    rnd = random.Random(43)
    T.PALETTE.setdefault('chair', '#c86a78')
    T.PALETTE.setdefault('chair_claire', '#e89aa4')
    lot = T.Lot(coll, 'tissu_vivant')
    _galet(lot, 'chair', (0, 0, 0.0), (0.2, 0.17, 0.16), rnd, 14 if leger else 24)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        _galet(lot, 'chair_claire', (0.14 * math.cos(a), 0.12 * math.sin(a), 0.08), (0.07, 0.06, 0.06), rnd, 8)
    _finir(coll, lot)


# --- Matériaux au style doux (caoutchouc, tiges, moteurs) ------------------------------------------------------------

def objet_caoutchouc(coll, leger=True):
    """Caoutchouc : un rouleau de feuille de la teinte (bout en spirale plus clair) et deux pains arrondis."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'caoutchouc')
    O._cyl(lot, TEINTE, (-0.26, 0.06, 0.13), (0.26, 0.06, 0.13), 0.13, n + 1)
    for sx in (-1, 1):
        for k, r in enumerate((0.1, 0.065, 0.03)):
            O._cyl(lot, 'teinte_sombre', (sx * (0.262 + 0.002 * k), 0.06, 0.13), (sx * (0.266 + 0.002 * k), 0.06, 0.13), r, n)
    O._rond(lot, TEINTE, (-0.12, -0.13, 0.05), (0.12, -0.13, 0.05), 0.1, 0.05, n, k=0.03)
    O._rond(lot, TEINTE, (0.0, -0.17, 0.14), (0.2, -0.12, 0.14), 0.08, 0.04, n, k=0.025)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_tige(coll, leger=True):
    """Tiges (fer, acier) : fagot de barres rondes de la teinte, serré par deux liens sombres."""
    n = 2 if leger else 3
    lot = T.Lot(coll, 'tiges')
    rows = ((-0.075, 0.035), (0.0, 0.035), (0.075, 0.035), (-0.0375, 0.1), (0.0375, 0.1), (0.0, 0.165))
    for i, (y, z) in enumerate(rows):
        dx = 0.02 * ((i * 7) % 3 - 1)
        O._cyl(lot, TEINTE, (-0.34 + dx, y, z), (0.34 + dx, y, z), 0.034, n)
    for x in (-0.18, 0.18):
        O._rond(lot, 'teinte_sombre', (x - 0.02, 0, 0.1), (x + 0.02, 0, 0.1), 0.135, 0.11, n + 1, k=0.006, r=0.08)
    _finir(coll, lot)
    T.adoucir(coll)


def _moteur(coll, leger, renforce):
    n = 3 if leger else 5
    lot = T.Lot(coll, 'moteur')
    r = 0.15 if not renforce else 0.17
    z = r + 0.05
    # Carcasse à ailettes (teinte), flasques, arbre, pattes de fixation, boîte à bornes.
    O._cyl(lot, TEINTE, (-0.2, 0, z), (0.18, 0, z), r, n + 1)
    m = 12 if leger else 18
    for k in range(m):
        a = 2 * math.pi * k / m
        lot.cube(TEINTE, (0.34, 0.025, 0.03), (-0.01, (r + 0.01) * math.cos(a), z + (r + 0.01) * math.sin(a)), 0.005,
                 Matrix.Rotation(a + math.pi / 2, 3, 'X'))
    for x in (-0.22, 0.2):
        O._cyl(lot, 'teinte_sombre', (x - 0.03, 0, z), (x + 0.03, 0, z), r * 0.95, n + 1)
    O._cyl(lot, 'gris_clair', (0.23, 0, z), (0.34, 0, z), 0.03, n)
    lot.cube('teinte_sombre', (0.06, 0.03, 0.025), (0.3, 0, z + 0.035), 0.005)  # clavette
    for x in (-0.12, 0.1):
        O._rond(lot, 'teinte_sombre', (x, -r * 0.9, 0.02), (x, r * 0.9, 0.02), 0.04, 0.02, n, k=0.008)
        O._rond(lot, 'teinte_sombre', (x, 0, 0.02), (x, 0, z - r * 0.6), 0.03, 0.08, n, k=0.008)
    O._rond(lot, 'teinte_sombre', (-0.05, 0, z + r), (-0.05, 0, z + r + 0.07), 0.06, 0.05, n, k=0.012)
    if renforce:
        # Moteur renforcé : flasques épaisses boulonnées, bande orange, ventilateur arrière.
        for x in (-0.22, 0.2):
            for k in range(6):
                a = 2 * math.pi * k / 6
                O._cyl(lot, 'gris_clair', (x + 0.03, (r * 0.8) * math.cos(a), z + (r * 0.8) * math.sin(a)),
                       (x + 0.045, (r * 0.8) * math.cos(a), z + (r * 0.8) * math.sin(a)), 0.012, 2)
        O._cyl(lot, 'orange', (-0.04, 0, z), (0.02, 0, z), r + 0.045, n + 1)
        O._cyl(lot, 'teinte_sombre', (-0.3, 0, z), (-0.24, 0, z), r * 0.9, n + 1)
    _finir(coll, lot)
    O._brillant()
    T.adoucir(coll)


def objet_moteur(coll, leger=True):
    """Moteur électrique : carcasse à ailettes de la teinte, flasques, arbre, pattes, boîte à bornes."""
    _moteur(coll, leger, False)


def objet_moteur_renforce(coll, leger=True):
    """Moteur renforcé : plus gros, flasques boulonnées, bande orange, ventilateur à l'arrière."""
    _moteur(coll, leger, True)


def objet_eau(coll, leger=True):
    """Eau (ressource du monde, icône) : flaque bombée de la teinte, reflets clairs, quelques galets au bord."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'eau')
    O._loft(lot, 'pierre_sombre', [((0, 0, 0.0), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.34, 0.27, 0.25),
                                   ((0, 0, 0.03), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.33, 0.26, 0.24)], n + 1)
    O._loft(lot, TEINTE, [((0, 0, 0.02), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.3, 0.23, 0.22),
                          ((0, 0, 0.05), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.28, 0.21, 0.2),
                          ((0, 0, 0.06), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.2, 0.14, 0.14)], n + 1)
    for x, y, r in ((-0.08, 0.04, 0.05), (0.1, -0.06, 0.03)):
        O._loft(lot, 'verre_clair', [((x, y, 0.061), Vector((1, 0, 0)), Vector((0, 1, 0)), r, r * 0.5, r * 0.5),
                                     ((x, y, 0.064), Vector((1, 0, 0)), Vector((0, 1, 0)), r * 0.8, r * 0.4, r * 0.4)], 2)
    rnd = random.Random(41)
    for k in range(6):
        a = k * 1.05 + 0.3
        _galet(lot, 'pierre', (0.32 * math.cos(a), 0.25 * math.sin(a), 0.0), (0.05, 0.045, 0.04), rnd, 8)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Paquets de science : un visuel par palier (octobre 2026, style doux). -----------------------------------------
# Le liquide est de la teinte de l'objet (couleur du palier, `content/items.json`) ; la forme du flacon et son support
# changent à chaque palier, du plus simple (T1, ballon dans un casier en bois) au plus avancé (T5, capsule lumineuse).
T.PALETTE.setdefault('laiton', '#d9a441')
T.PALETTE.setdefault('verre_flacon', '#d7eef5')
T.PALETTE.setdefault('liege', '#c9a06a')
T.PALETTE.setdefault('metal_sci', '#8b93a0')
T.PALETTE.setdefault('metal_sci_sombre', '#4b505a')
T.PALETTE.setdefault('lueur_sci', '#e9fbff')


def _anneau_z(lot, mat, c, r, ep, h, n):
    """Bague ronde horizontale (cerclage) centrée en `c`."""
    x, y, z = c
    O._cyl(lot, mat, (x, y, z - h / 2), (x, y, z + h / 2), r + ep, n + 1, k=min(ep, h) * 0.4)


def _profil(lot, mat, x, y, prof, n):
    """Volume de révolution : `prof` = liste de (z, rayon) de bas en haut."""
    O._loft(lot, mat, [((x, y, z), O.X, O.Y, r, r, r) for z, r in prof], n + 1)


def _fiole(lot, x, y, z0, prof_verre, niveau, col, n):
    """Flacon de verre clair (profil `prof_verre`), rempli de la teinte jusqu'à `niveau` (fraction du profil)."""
    zs = [p[0] for p in prof_verre]
    zl = zs[0] + (zs[-1] - zs[0]) * niveau
    liq = [(z + z0, r * 0.93) for z, r in prof_verre if z <= zl]
    if liq and liq[-1][0] < zl + z0:
        rr = next(r for z, r in prof_verre if z >= zl) * 0.93
        liq.append((zl + z0, rr))
    _profil(lot, TEINTE, x, y, [(liq[0][0] + 0.004, liq[0][1] * 0.9)] + liq, n)
    haut = [(z + z0, r) for z, r in prof_verre if z >= zl - 0.001]
    _profil(lot, 'verre_flacon', x, y, [(zl + z0 - 0.002, haut[0][1] * 0.98)] + haut, n)
    if col:
        top = prof_verre[-1]
        O._cyl(lot, col, (x, y, top[0] + z0 - 0.005), (x, y, top[0] + z0 + 0.05), top[1] * 1.25, n)


def objet_science_1(coll, leger=True):
    """Paquet de science T1 : ballon à fond rond dans un petit casier en bois, bouchon de liège."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    O._rond(lot, 'bois', (0, 0, 0), (0, 0, 0.06), 0.2, 0.2, n, k=0.015, r=0.04)
    for x in (-0.16, 0.16):
        for y in (-0.16, 0.16):
            O._rond(lot, 'bois_sombre', (x, y, 0.06), (x, y, 0.24), 0.025, 0.025, n, k=0.008)
    for y in (-0.16, 0.16):
        O._rond(lot, 'bois', (-0.19, y, 0.22), (0.19, y, 0.22), 0.025, 0.025, n, k=0.008)
    prof = [(0.0, 0.03), (0.03, 0.09), (0.09, 0.13), (0.16, 0.13), (0.22, 0.09), (0.26, 0.04), (0.36, 0.035)]
    _fiole(lot, 0, 0, 0.06, prof, 0.55, 'liege', n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_science_2(coll, leger=True):
    """Paquet de science T2 : fiole conique (erlenmeyer) sur un trépied de fer, capsule métallique."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    _anneau_z(lot, 'metal_sci_sombre', (0, 0, 0.1), 0.14, 0.02, 0.025, n)
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.4
        O._cyl(lot, 'metal_sci_sombre', (0.2 * math.cos(a), 0.2 * math.sin(a), 0), (0.15 * math.cos(a), 0.15 * math.sin(a), 0.1),
               0.015, n)
    prof = [(0.0, 0.1), (0.015, 0.16), (0.05, 0.155), (0.2, 0.06), (0.25, 0.045), (0.34, 0.045)]
    _fiole(lot, 0, 0, 0.1, prof, 0.45, 'metal_sci', n)
    O._rond(lot, 'blanc', (0, -0.11, 0.17), (0, -0.11, 0.24), 0.05, 0.004, 2, k=0.002, r=0.01)  # étiquette
    _finir(coll, lot)
    T.adoucir(coll)


def objet_science_3(coll, leger=True):
    """Paquet de science T3 : un grand tube à essai tenu par une pince sur un petit support métallique, bouchon sombre."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    O._rond(lot, 'metal_sci', (0, 0, 0), (0, 0, 0.04), 0.16, 0.12, n, k=0.012, r=0.04)
    O._cyl(lot, 'metal_sci_sombre', (-0.11, 0.05, 0.04), (-0.11, 0.05, 0.36), 0.018, n)  # tige du support
    for z in (0.12, 0.3):  # pince : bras et collier autour du tube
        O._rond(lot, 'metal_sci_sombre', (-0.11, 0.05, z), (-0.02, 0.0, z), 0.015, 0.015, n, k=0.005)
        _anneau_z(lot, 'metal_sci', (0.02, 0, z), 0.07, 0.014, 0.03, n)
    O._cyl(lot, 'metal_sci_sombre', (-0.11, 0.05, 0.36), (-0.11, 0.05, 0.38), 0.025, n)
    prof = [(0.0, 0.015), (0.02, 0.055), (0.05, 0.068), (0.36, 0.068), (0.38, 0.058)]
    _fiole(lot, 0.02, 0, 0.05, prof, 0.65, 'metal_sci_sombre', n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_science_4(coll, leger=True):
    """Paquet de science T4 : grande fiole hexagonale tenue dans une armature de laiton, bouchon à facettes."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    O._loft(lot, 'laiton', [((0, 0, 0), O.X, O.Y, 0.15, 0.15, 0.06), ((0, 0, 0.04), O.X, O.Y, 0.17, 0.17, 0.07),
                            ((0, 0, 0.06), O.X, O.Y, 0.15, 0.15, 0.06)], 1)
    # Corps à six pans : loft à sections hexagonales (coins nets, sans arrondi).
    import bmesh as _bm
    h0, h1, r = 0.06, 0.36, 0.11

    def hexa(mat, za, zb, rr):
        tmp = _bm.new()
        _bm.ops.create_cone(tmp, cap_ends=True, segments=6, radius1=rr, radius2=rr, depth=zb - za)
        _bm.ops.translate(tmp, vec=(0, 0, (za + zb) / 2), verts=tmp.verts)
        T._verse(tmp, lot.bms.setdefault(mat, _bm.new()))
    hexa(TEINTE, h0, h0 + (h1 - h0) * 0.7, r * 0.94)
    hexa('verre_flacon', h0 + (h1 - h0) * 0.7, h1, r)
    _profil(lot, 'verre_flacon', 0, 0, [(h1, r * 0.8), (h1 + 0.03, 0.05), (h1 + 0.08, 0.045)], n)
    for k in range(3):  # montants de l'armature
        a = k * 2 * math.pi / 3
        O._cyl(lot, 'laiton', (0.125 * math.cos(a), 0.125 * math.sin(a), 0.05), (0.125 * math.cos(a), 0.125 * math.sin(a), h1),
               0.015, n)
    for z in (0.12, h1 - 0.02):
        _anneau_z(lot, 'laiton', (0, 0, z), 0.12, 0.018, 0.025, n)
    O._loft(lot, 'metal_sci_sombre', [((0, 0, h1 + 0.07), O.X, O.Y, 0.05, 0.05, 0.02),
                                      ((0, 0, h1 + 0.12), O.X, O.Y, 0.06, 0.06, 0.02),
                                      ((0, 0, h1 + 0.16), O.X, O.Y, 0.02, 0.02, 0.01)], 1)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_science_5(coll, leger=True):
    """Paquet de science T5 : capsule sphérique lumineuse de la teinte, tenue par deux anneaux sur un socle sombre."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    _profil(lot, 'metal_sci_sombre', 0, 0, [(0.0, 0.12), (0.03, 0.16), (0.07, 0.15), (0.1, 0.07)], n)
    zc, R = 0.25, 0.13
    prof = [(zc + R * math.sin(a), R * math.cos(a)) for a in [(-90 + k * 22.5) * math.pi / 180 for k in range(9)]]
    prof[0] = (prof[0][0], 0.01)
    prof[-1] = (prof[-1][0], 0.01)
    _profil(lot, TEINTE, 0, 0, prof, n + 1)
    _profil(lot, 'lueur_sci', 0, 0, [(zc - 0.03, 0.01), (zc, 0.05), (zc + 0.03, 0.01)], n)
    # Deux anneaux croisés autour de la capsule.
    for rot in (0.0, math.pi / 2):
        m = 16 if leger else 24
        for k in range(m):
            a0, a1 = 2 * math.pi * k / m, 2 * math.pi * (k + 1) / m
            p = lambda a: Vector((R * 1.18 * math.cos(a) * math.cos(rot), R * 1.18 * math.cos(a) * math.sin(rot),  # noqa: E731
                                  zc + R * 1.18 * math.sin(a)))
            O._cyl(lot, 'metal_sci', tuple(p(a0)), tuple(p(a1) + (p(a1) - p(a0)) * 0.1), 0.014, 2, k=0.002)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_science_combat(coll, leger=True):
    """Paquet de science de combat : fiole en forme d'obus (pointe de laiton) dans un étui de cartouches, croix claire."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'science')
    O._rond(lot, 'metal_sci_sombre', (0, 0, 0), (0, 0, 0.16), 0.17, 0.12, n, k=0.02, r=0.04)
    O._rond(lot, 'teinte_sombre', (0, -0.121, 0.03), (0, -0.121, 0.13), 0.13, 0.004, 2, k=0.002, r=0.01)
    for (a, b) in (((-0.04, 0.08), (0.04, 0.08)), ((0, 0.045), (0, 0.115))):  # croix
        O._rond(lot, 'blanc', (a[0], -0.126, a[1]), (b[0], -0.126, b[1]), 0.012, 0.004, 2, k=0.002, r=0.004)
    for x in (-0.09, 0.09):  # deux cartouches couchées dans l'étui
        O._cyl(lot, 'laiton', (x, -0.06, 0.17), (x, 0.08, 0.17), 0.03, n)
    prof = [(0.0, 0.05), (0.02, 0.07), (0.2, 0.07), (0.26, 0.055), (0.31, 0.03)]
    _fiole(lot, 0, 0, 0.16, prof, 0.7, None, n)
    _profil(lot, 'laiton', 0, 0, [(0.47, 0.032), (0.51, 0.025), (0.55, 0.008)], n)
    _anneau_z(lot, 'laiton', (0, 0, 0.18), 0.07, 0.01, 0.03, n)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Moules (octobre 2026, style doux) : bloc d'acier bleuté, empreinte creuse de la forme produite. ----------
T.PALETTE.setdefault('moule_creux', '#17181b')
T.PALETTE.setdefault('moule_acier', '#c9d1da')
T.PALETTE.setdefault('moule_corps', '#5f86a8')


def _bloc_moule(lot, n, L=0.42, W=0.32, H=0.12):
    """Bloc de moule : corps de la teinte aux arêtes adoucies, poignées et goupilles de centrage claires ; renvoie le dessus."""
    O._rond(lot, 'moule_corps', (0, 0, 0), (0, 0, H), L / 2, W / 2, n, k=0.02, r=0.03)
    for s in (-1, 1):  # poignées sur les petits côtés
        O._rond(lot, 'moule_acier', (s * L / 2, -0.06, H * 0.55), (s * (L / 2 + 0.04), -0.06, H * 0.55), 0.012, 0.012, n, k=0.004)
        O._rond(lot, 'moule_acier', (s * L / 2, 0.06, H * 0.55), (s * (L / 2 + 0.04), 0.06, H * 0.55), 0.012, 0.012, n, k=0.004)
        O._rond(lot, 'moule_acier', (s * (L / 2 + 0.04), -0.07, H * 0.55), (s * (L / 2 + 0.04), 0.07, H * 0.55), 0.014, 0.014, n,
                k=0.004)
    for sx in (-1, 1):  # goupilles de centrage aux coins
        for sy in (-1, 1):
            O._cyl(lot, 'moule_acier', (sx * (L / 2 - 0.035), sy * (W / 2 - 0.035), H - 0.005),
                   (sx * (L / 2 - 0.035), sy * (W / 2 - 0.035), H + 0.025), 0.014, n)
    return H


def _creux(lot, pts, z, n_mat='moule_creux', bord='moule_acier'):
    """Empreinte : surface sombre de contour `pts` (polygone XY) juste au-dessus du dessus `z`, liseré clair autour."""
    import bmesh as _bm
    tmp = _bm.new()
    vs = [tmp.verts.new((x, y, z + 0.002)) for x, y in pts]
    tmp.faces.new(vs)
    T._verse(tmp, lot.bms.setdefault(n_mat, _bm.new()))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        lot.barre(bord, (x0, y0, z + 0.003), (x1, y1, z + 0.003), 0.008)


def objet_moule_plaque(coll, leger=True):
    """Moule de plaque : bloc d'acier, empreinte rectangulaire peu profonde, rainure de coulée."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'moule')
    z = _bloc_moule(lot, n)
    _creux(lot, [(-0.14, -0.1), (0.14, -0.1), (0.14, 0.1), (-0.14, 0.1)], z)
    lot.cube('moule_creux', (0.06, 0.03, 0.004), (0.17, 0, z + 0.002))  # canal de coulée
    _finir(coll, lot)
    T.adoucir(coll)


def objet_moule_engrenage(coll, leger=True):
    """Moule d'engrenage : bloc d'acier, empreinte en forme de roue dentée (dents, moyeu clair au centre)."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'moule')
    z = _bloc_moule(lot, n, L=0.36, W=0.36)
    dents, r0, r1 = 10, 0.105, 0.14
    pts = []
    for k in range(dents):
        a = 2 * math.pi * k / dents
        for da, r in ((-0.2, r0), (-0.12, r1), (0.12, r1), (0.2, r0)):
            b = a + da * 2 * math.pi / dents
            pts.append((r * math.cos(b), r * math.sin(b)))
    _creux(lot, pts, z)
    O._cyl(lot, 'moule_acier', (0, 0, z), (0, 0, z + 0.012), 0.035, n)  # noyau du moyeu
    _finir(coll, lot)
    T.adoucir(coll)


def objet_moule_fil(coll, leger=True):
    """Moule de fil (filière) : disque d'acier serti dans un bloc, trou conique au centre d'où sort un bout de fil de cuivre."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'moule')
    z = _bloc_moule(lot, n, L=0.36, W=0.3)
    O._cyl(lot, 'moule_acier', (0, 0, z - 0.01), (0, 0, z + 0.02), 0.1, n + 1, k=0.008)
    O._loft(lot, 'moule_creux', [((0, 0, z + 0.021), O.X, O.Y, 0.06, 0.06, 0.06), ((0, 0, z + 0.022), O.X, O.Y, 0.02, 0.02, 0.02)],
            n + 1)
    for k in range(4):  # vis de serrage
        a = math.pi / 4 + k * math.pi / 2
        O._cyl(lot, 'moule_corps', (0.08 * math.cos(a), 0.08 * math.sin(a), z + 0.02), (0.08 * math.cos(a), 0.08 * math.sin(a), z + 0.03),
               0.012, n)
    # Bout de fil qui sort et se courbe.
    pts = [(0, 0, z + 0.02), (0, 0, z + 0.07), (0.03, 0, z + 0.11), (0.09, 0, z + 0.13), (0.16, 0, z + 0.12)]
    for a, b in zip(pts, pts[1:]):
        O._cyl(lot, 'cuivre', a, b, 0.012, n, k=0.002)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Intermédiaires des paliers 3 à 5, lot 1 (octobre 2026, style doux) : châssis, vitres, graphite, sel de lithium. --
T.PALETTE.setdefault('soudure', '#3b3e44')
T.PALETTE.setdefault('boulon', '#c9d1da')
T.PALETTE.setdefault('bois_cale', '#b98a58')
T.PALETTE.setdefault('reflet', '#f2fbff')
T.PALETTE.setdefault('trame', '#4a4d55')


def _cadre(lot, mat, L, W, z, r, n, k=None):
    """Cadre rectangulaire de tubes arrondis (demi-côtés L, W), à la hauteur z ; renvoie les quatre coins."""
    coins = [(-L, -W), (L, -W), (L, W), (-L, W)]
    for (x0, y0), (x1, y1) in zip(coins, coins[1:] + coins[:1]):
        O._rond(lot, mat, (x0, y0, z), (x1, y1, z), r, r, n, k=k if k is not None else r * 0.3)
    return coins


def objet_chassis_simple(coll, leger=True):
    """Châssis simple : cadre de tubes carrés de la teinte, deux traverses, soudures sombres aux nœuds."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'chassis')
    L, W, r = 0.34, 0.2, 0.03
    z = r
    coins = _cadre(lot, TEINTE, L, W, z, r, n)
    for x in (-0.12, 0.12):
        O._rond(lot, TEINTE, (x, -W, z), (x, W, z), r * 0.85, r * 0.85, n)
        for y in (-W, W):
            _boule_lot(lot, 'soudure', (x, y, z), r * 1.15)
    for x, y in coins:
        _boule_lot(lot, 'soudure', (x, y, z), r * 1.2)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_chassis_renforce(coll, leger=True):
    """Châssis renforcé : cadre plus épais, croix de renfort, goussets triangulaires boulonnés aux coins."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'chassis')
    L, W, r = 0.34, 0.21, 0.036
    z = r
    coins = _cadre(lot, TEINTE, L, W, z, r, n)
    O._rond(lot, TEINTE, (-L, -W, z), (L, W, z), r * 0.7, r * 0.7, n)
    O._rond(lot, TEINTE, (-L, W, z), (L, -W, z), r * 0.7, r * 0.7, n)
    O._rond(lot, 'teinte_sombre', (0, 0, z - r * 0.7), (0, 0, z + r * 0.9), 0.06, 0.06, n, k=0.01)  # plaque centrale
    for x, y in coins:
        sx, sy = (1 if x > 0 else -1), (1 if y > 0 else -1)
        tri = [(x, y), (x - sx * 0.1, y), (x, y - sy * 0.1)]
        import bmesh as _bm
        tmp = _bm.new()
        bas = [tmp.verts.new((px, py, z + r * 0.95)) for px, py in tri]
        haut = [tmp.verts.new((px, py, z + r * 0.95 + 0.012)) for px, py in tri]
        tmp.faces.new(bas[::-1])
        tmp.faces.new(haut)
        for i in range(3):
            j = (i + 1) % 3
            tmp.faces.new((bas[i], bas[j], haut[j], haut[i]))
        _bm.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
        T._verse(tmp, lot.bms.setdefault('teinte_sombre', _bm.new()))
        for (bx, by) in ((x - sx * 0.035, y - sy * 0.012), (x - sx * 0.012, y - sy * 0.035)):
            O._cyl(lot, 'boulon', (bx, by, z + r + 0.012), (bx, by, z + r + 0.024), 0.008, 2)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_chassis_leger(coll, leger=True):
    """Châssis léger : longerons plats et fins de la teinte percés de trous d'allègement, trois traverses."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'chassis')
    L, W = 0.34, 0.19
    for y in (-W, W):
        O._rond(lot, TEINTE, (-L, y, 0.04), (L, y, 0.04), 0.012, 0.04, n, k=0.006, r=0.012)
        for k in range(5):
            x = -0.24 + k * 0.12
            O._cyl(lot, 'teinte_sombre', (x, y - 0.014, 0.04), (x, y + 0.014, 0.04), 0.022, n)
    for x in (-0.3, 0.0, 0.3):
        O._rond(lot, TEINTE, (x, -W, 0.04), (x, W, 0.04), 0.03, 0.012, n, k=0.005, r=0.01)
        O._cyl(lot, 'teinte_sombre', (x, 0, 0.034), (x, 0, 0.046), 0.018, n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_chassis_composite(coll, leger=True):
    """Châssis composite : coque moulée d'une pièce (noir de la teinte), bords relevés, trame tissée claire, inserts."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'chassis')
    O._rond(lot, TEINTE, (0, 0, 0), (0, 0, 0.03), 0.34, 0.21, n, k=0.012, r=0.08)
    for s in (-1, 1):  # bords relevés
        O._rond(lot, TEINTE, (-0.31, s * 0.19, 0.02), (0.31, s * 0.19, 0.02), 0.025, 0.05, n, k=0.012, r=0.02)
    for k in range(-5, 6):  # trame tissée : diagonales croisées claires
        x = k * 0.055
        lot.barre('trame', (x - 0.06, -0.15, 0.032), (x + 0.06, 0.15, 0.032), 0.006)
        lot.barre('trame', (x + 0.06, -0.15, 0.032), (x - 0.06, 0.15, 0.032), 0.006)
    for x in (-0.24, 0.24):
        for y in (-0.1, 0.1):
            O._cyl(lot, 'boulon', (x, y, 0.028), (x, y, 0.042), 0.016, n)
    _finir(coll, lot)
    T.adoucir(coll)


def _boule_lot(lot, mat, c, r):
    O._loft(lot, mat, [((c[0], c[1], c[2] - r), O.X, O.Y, r * 0.3, r * 0.3, r * 0.3),
                       ((c[0], c[1], c[2] - r * 0.5), O.X, O.Y, r * 0.85, r * 0.85, r * 0.85),
                       ((c[0], c[1], c[2] + r * 0.5), O.X, O.Y, r * 0.85, r * 0.85, r * 0.85),
                       ((c[0], c[1], c[2] + r), O.X, O.Y, r * 0.3, r * 0.3, r * 0.3)], 2)


def _vitre(lot, ep, n, cadre=None):
    """Vitre debout dans deux cales en bois : plaque de la teinte, reflets clairs ; `cadre` = teinte d'un cadre boulonné."""
    W, H, z0 = 0.3, 0.38, 0.03
    for x in (-0.2, 0.2):
        O._rond(lot, 'bois_cale', (x, -0.07, 0), (x, 0.07, 0), 0.05, 0.04, n, k=0.01, r=0.015)
    O._rond(lot, TEINTE, (-W, 0, z0 + H), (W, 0, z0 + H), ep, H, n, k=min(ep, 0.01), r=min(ep, 0.012))
    m = Matrix.Rotation(0.7, 3, 'Y')
    for dx, L in ((-0.12, 0.18), (-0.04, 0.1)):
        c = Vector((dx, -ep - 0.002, z0 + H * 1.3))
        lot.cube('reflet', (0.025, 0.004, L), tuple(c), 0.002, m)
    if cadre:
        for y in (-1, 1):
            yy = y * (ep + 0.01)
            for (a, b) in (((-W, yy, z0), (W, yy, z0)), ((-W, yy, z0 + 2 * H - 0.02), (W, yy, z0 + 2 * H - 0.02)),
                           ((-W, yy, z0), (-W, yy, z0 + 2 * H - 0.02)), ((W, yy, z0), (W, yy, z0 + 2 * H - 0.02))):
                O._rond(lot, cadre, a, b, 0.025, 0.012, n, k=0.006)
            O._rond(lot, cadre, (-W, yy, z0 + H), (W, yy, z0 + H), 0.014, 0.01, n, k=0.004)  # croisillon
            O._rond(lot, cadre, (0, yy, z0), (0, yy, z0 + 2 * H - 0.02), 0.014, 0.01, n, k=0.004)
            for x in (-W, W):
                for z in (z0, z0 + H, z0 + 2 * H - 0.02):
                    O._cyl(lot, 'boulon', (x, yy, z), (x, yy + y * 0.016, z), 0.011, 2)


def objet_vitre(coll, leger=True):
    """Vitre : plaque de verre fine de la teinte, debout dans deux cales en bois, reflets clairs."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'vitre')
    _vitre(lot, 0.012, n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_vitre_blindee(coll, leger=True):
    """Vitre blindée : verre épais de la teinte dans un cadre d'acier boulonné à croisillons."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'vitre')
    _vitre(lot, 0.03, n, cadre='trame')
    _finir(coll, lot)
    T.adoucir(coll)


def objet_graphite(coll, leger=True):
    """Graphite : deux pains de graphite noir brillant aux arêtes adoucies, empilés en travers, éclats sur le côté."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'graphite')
    O._rond(lot, TEINTE, (-0.2, -0.04, 0.07), (0.2, -0.04, 0.07), 0.1, 0.07, n, k=0.02, r=0.025)
    m = Matrix.Rotation(0.5, 3, 'Z')
    a, b = m @ Vector((-0.16, 0, 0)), m @ Vector((0.16, 0, 0))
    O._rond(lot, TEINTE, tuple(a + Vector((0.02, 0.06, 0.2))), tuple(b + Vector((0.02, 0.06, 0.2))), 0.08, 0.06, n, k=0.02,
            r=0.02)
    rnd = random.Random(5)
    for k in range(4):
        x, y = 0.22 + rnd.uniform(-0.05, 0.05), -0.12 + k * 0.07
        _boule_lot(lot, TEINTE, (x, y, 0.02), 0.025 + 0.01 * (k % 2))
    lot.cube('reflet', (0.25, 0.006, 0.01), (-0.02, -0.142, 0.11), 0.002)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_sel_lithium(coll, leger=True):
    """Sel de lithium : petit tas arrondi de la teinte, couvert de cristaux cubiques plus clairs et plus sombres."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'sel')
    O._loft(lot, TEINTE, [((0, 0, 0), O.X, O.Y, 0.25, 0.22, 0.2), ((0, 0, 0.06), O.X, O.Y, 0.21, 0.18, 0.17),
                          ((0, 0, 0.13), O.X, O.Y, 0.12, 0.1, 0.09), ((0, 0, 0.17), O.X, O.Y, 0.03, 0.03, 0.03)], n + 1)
    rnd = random.Random(11)
    for k in range(18 if leger else 28):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.02, 0.22)
        h = max(0.01, 0.17 * (1 - (d / 0.24) ** 1.6))
        e = rnd.uniform(0.035, 0.06)
        c = (d * math.cos(a), d * math.sin(a) * 0.85, h + e * 0.25)
        m = Matrix.Rotation(rnd.uniform(0, 1.5), 3, 'Z') @ Matrix.Rotation(rnd.uniform(-0.4, 0.4), 3, 'X')
        lot.cube('reflet' if k % 3 == 0 else ('teinte_sombre' if k % 7 == 0 else TEINTE), (e, e, e), c, 0.004, m)
    _finir(coll, lot)


# --- Intermédiaires des paliers 3 à 5, lot 2 : fibre de carbone, circuits, cellule, filtre, batterie. -------------
T.PALETTE.setdefault('pcb_vert', '#2f7a4f')
T.PALETTE.setdefault('piste_or', '#d9b25a')
T.PALETTE.setdefault('composant', '#2b2e33')
T.PALETTE.setdefault('composant_clair', '#c7ccd2')
T.PALETTE.setdefault('led_rouge', '#e0533f')
T.PALETTE.setdefault('carton_tube', '#c9a26e')


def _carte(lot, L, W, mat, n, z=0.0, ep=0.02):
    """Carte de circuit arrondie de demi-côtés L, W (épaisseur ep), posée à z ; renvoie le dessus."""
    O._rond(lot, mat, (0, 0, z), (0, 0, z + ep), L, W, n, k=0.006, r=0.02)
    return z + ep


def _puce_carree(lot, c, a, n, broches=4, mat='composant'):
    """Puce carrée de demi-côté a centrée en c (dessus de la carte), broches sur les quatre côtés."""
    x, y, z = c
    O._rond(lot, mat, (x, y, z), (x, y, z + 0.025), a, a, n, k=0.005, r=0.006)
    for k in range(broches):
        t = -a + (k + 0.5) * 2 * a / broches
        for (bx, by, ux, uy) in ((t, -a, 0, -1), (t, a, 0, 1), (-a, t, -1, 0), (a, t, 1, 0)):
            lot.cube('composant_clair', (0.012 if ux == 0 else 0.03, 0.03 if ux == 0 else 0.012, 0.008),
                     (x + bx + ux * 0.012, y + by + uy * 0.012, z + 0.006))


def objet_fibre_carbone(coll, leger=True):
    """Fibre de carbone : rouleau de tissu noir tressé (la teinte) sur un mandrin en carton, bout de tissu déroulé."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'fibre')
    r, z = 0.12, 0.12
    O._cyl(lot, TEINTE, (-0.24, 0, z), (0.24, 0, z), r, n + 2, k=0.01)
    O._cyl(lot, 'carton_tube', (-0.27, 0, z), (0.27, 0, z), 0.035, n)
    O._cyl(lot, 'composant', (-0.275, 0, z), (0.275, 0, z), 0.02, n)
    # Tressage : bandes claires en losange sur le rouleau et sur la partie déroulée.
    m = 10 if leger else 14
    for k in range(m):
        a = 2 * math.pi * k / m
        p0 = Vector((-0.22, (r + 0.002) * math.cos(a), z + (r + 0.002) * math.sin(a)))
        a2 = a + 2 * math.pi / m
        p1 = Vector((0.22, (r + 0.002) * math.cos(a2), z + (r + 0.002) * math.sin(a2)))
        lot.barre('trame', tuple(p0), tuple(p1), 0.008)
    O._rond(lot, TEINTE, (0, -0.05, 0.006), (0, -0.32, 0.006), 0.24, 0.006, n, k=0.003, r=0.004)
    for k in range(-4, 5):
        x = k * 0.05
        lot.barre('trame', (x - 0.03, -0.08, 0.013), (x + 0.03, -0.3, 0.013), 0.007)
        lot.barre('trame', (x + 0.03, -0.08, 0.013), (x - 0.03, -0.3, 0.013), 0.007)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_kit_circuit(coll, leger=True):
    """Kit circuit : petite carte verte de la teinte, une puce, des condensateurs, une rangée de broches, pistes dorées."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'circuit')
    z = _carte(lot, 0.24, 0.17, TEINTE, n)
    for y in (-0.1, -0.03, 0.04):
        lot.barre('piste_or', (-0.2, y, z + 0.002), (0.05, y, z + 0.002), 0.012)
    _puce_carree(lot, (0.1, 0.03, z), 0.06, n, 3)
    for x, y in ((-0.12, 0.08), (-0.04, 0.09)):
        O._cyl(lot, 'composant_clair', (x, y, z), (x, y, z + 0.07), 0.025, n)
        O._cyl(lot, 'composant', (x, y, z + 0.07), (x, y, z + 0.075), 0.022, n)
    for k in range(6):
        O._cyl(lot, 'piste_or', (-0.18 + k * 0.05, -0.15, z), (-0.18 + k * 0.05, -0.15, z + 0.05), 0.008, 2)
    O._rond(lot, 'composant', (-0.18, -0.15, z), (0.08, -0.15, z), 0.018, 0.015, 2, k=0.004)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_circuit_avance(coll, leger=True):
    """Circuit avancé : carte plus dense (la teinte) à liseré doré, gros processeur à radiateur, rangées de puces, LED."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'circuit')
    z = _carte(lot, 0.27, 0.19, TEINTE, n)
    for s in (-1, 1):
        lot.barre('piste_or', (-0.26, s * 0.18, z + 0.002), (0.26, s * 0.18, z + 0.002), 0.012)
    for k in range(6):
        y = -0.15 + k * 0.06
        lot.barre('piste_or', (-0.25, y, z + 0.002), (-0.02, y, z + 0.002), 0.008)
    _puce_carree(lot, (0.11, 0.0, z), 0.09, n, 5)
    for k in range(5):  # radiateur à ailettes sur le processeur
        x = 0.04 + k * 0.035
        O._rond(lot, 'composant_clair', (x, -0.07, z + 0.025), (x, 0.07, z + 0.025), 0.008, 0.035, 2, k=0.003)
    for k in range(3):
        _puce_carree(lot, (-0.15 + k * 0.08, 0.1, z), 0.03, n, 2)
    O._cyl(lot, 'led_rouge', (-0.22, -0.13, z), (-0.22, -0.13, z + 0.02), 0.014, n)
    O._cyl(lot, 'pcb_vert', (-0.18, -0.13, z), (-0.18, -0.13, z + 0.02), 0.014, n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_microcontroleur(coll, leger=True):
    """Microcontrôleur : grosse puce carrée de la teinte, broches tout autour, repère rond et marquage clair."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'puce')
    a = 0.16
    O._rond(lot, TEINTE, (0, 0, 0.012), (0, 0, 0.056), a, a, n, k=0.008, r=0.012)
    lot.cube(TEINTE, (2 * a - 0.03, 2 * a - 0.03, 0.008), (0, 0, 0.056), 0.003)
    m = 7
    for k in range(m):
        t = -a + (k + 0.5) * 2 * a / m
        for (bx, by, ux, uy) in ((t, -a, 0, -1), (t, a, 0, 1), (-a, t, -1, 0), (a, t, 1, 0)):
            p0 = Vector((bx, by, 0.035))
            p1 = p0 + Vector((ux, uy, 0)) * 0.035 + Vector((0, 0, -0.012))
            p2 = p1 + Vector((ux, uy, 0)) * 0.02 + Vector((0, 0, -0.02))
            lot.barre('composant_clair', tuple(p0), tuple(p1), 0.014)
            lot.barre('composant_clair', tuple(p1), tuple(p2), 0.014)
    O._cyl(lot, 'composant_clair', (-0.1, -0.1, 0.06), (-0.1, -0.1, 0.063), 0.02, n)
    for k in range(3):
        lot.cube('composant_clair', (0.12 - k * 0.03, 0.012, 0.004), (0.02, 0.02 - k * 0.04, 0.062))
    _finir(coll, lot)
    T.adoucir(coll)


def objet_cellule_solaire(coll, leger=True):
    """Cellule photovoltaïque : plaque carrée de la teinte (bleu), quadrillage de fils clairs, deux barres collectrices."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'cellule')
    O._rond(lot, 'composant_clair', (0, 0, 0), (0, 0, 0.018), 0.22, 0.22, n, k=0.005, r=0.02)
    lot.cube(TEINTE, (0.41, 0.41, 0.011), (0, 0, 0.0205), 0.003)
    for k in range(-6, 7):
        y = k * 0.03
        lot.cube('composant_clair', (0.39, 0.003, 0.002), (0, y, 0.027))
    for x in (-0.07, 0.07):
        lot.cube('composant_clair', (0.02, 0.4, 0.004), (x, 0, 0.028))
    _finir(coll, lot)
    T.adoucir(coll)


def objet_filtre_graphite(coll, leger=True):
    """Filtre en graphite : cartouche ronde à cerclages clairs, face avant en nid d'abeille sombre (la teinte)."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'filtre')
    r, h = 0.17, 0.24
    O._cyl(lot, 'composant_clair', (0, 0, 0), (0, 0, h), r, n + 2, k=0.01)
    O._cyl(lot, TEINTE, (0, 0, h - 0.005), (0, 0, h + 0.012), r - 0.02, n + 2, k=0.004)
    for z in (0.05, h - 0.05):
        _anneau_z(lot, 'trame', (0, 0, z), r, 0.008, 0.025, n)
    # Nid d'abeille : alvéoles hexagonales en relief.
    import bmesh as _bm
    a = 0.026
    for i in range(-4, 5):
        for j in range(-4, 5):
            x = i * a * 1.75 + (j % 2) * a * 0.875
            y = j * a * 1.52
            if math.hypot(x, y) > r - 0.04:
                continue
            tmp = _bm.new()
            _bm.ops.create_cone(tmp, cap_ends=True, segments=6, radius1=a * 0.82, radius2=a * 0.82, depth=0.008)
            _bm.ops.translate(tmp, vec=(x, y, h + 0.014), verts=tmp.verts)
            T._verse(tmp, lot.bms.setdefault('composant', _bm.new()))
    _finir(coll, lot)
    T.adoucir(coll)


def objet_batterie_lithium(coll, leger=True):
    """Batterie lithium : bloc de la teinte aux coins arrondis, deux bornes (+ rouge, - noire), poignée, jauge verte."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'batterie')
    O._rond(lot, TEINTE, (0, 0, 0), (0, 0, 0.2), 0.22, 0.14, n, k=0.02, r=0.04)
    O._rond(lot, 'teinte_sombre', (0, 0, 0.19), (0, 0, 0.23), 0.2, 0.12, n, k=0.012, r=0.035)
    for x, mat in ((-0.12, 'led_rouge'), (0.12, 'composant')):
        O._cyl(lot, mat, (x, 0, 0.23), (x, 0, 0.27), 0.03, n)
        O._cyl(lot, 'composant_clair', (x, 0, 0.27), (x, 0, 0.285), 0.02, n)
    O._rond(lot, 'composant', (-0.05, 0.0, 0.29), (0.05, 0.0, 0.29), 0.018, 0.014, n, k=0.005)
    for x in (-0.05, 0.05):
        O._rond(lot, 'composant', (x, 0, 0.23), (x, 0, 0.29), 0.012, 0.012, 2, k=0.004)
    O._rond(lot, 'composant', (0, -0.142, 0.06), (0, -0.142, 0.14), 0.11, 0.004, 2, k=0.002, r=0.012)
    for k in range(4):
        lot.cube('pcb_vert' if k < 3 else 'composant_clair', (0.035, 0.006, 0.05), (-0.06 + k * 0.042, -0.146, 0.1), 0.004)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Intermédiaires des paliers 3 à 5, lot 3 : kit de réparation, fusion, aimant, cristal, gaz, azote liquide. -----
T.PALETTE.setdefault('givre', '#eef7fb')
T.PALETTE.setdefault('etiquette', '#f1ece0')
T.PALETTE.setdefault('lueur_rose', '#ffd6e4')


def _lettre(lot, mat, c, lettre, h, y):
    """Lettre D ou T en baguettes sur une face tournée vers -Y (centre c = (x, z)), hauteur h."""
    x, z = c
    w = h * 0.6
    e = h * 0.16
    if lettre == 'T':
        segs = [((x - w / 2, z + h / 2), (x + w / 2, z + h / 2)), ((x, z + h / 2), (x, z - h / 2))]
    else:  # D : barre verticale et une boucle de quatre segments
        segs = [((x - w / 2, z - h / 2), (x - w / 2, z + h / 2)), ((x - w / 2, z + h / 2), (x + w * 0.15, z + h / 2)),
                ((x + w * 0.15, z + h / 2), (x + w / 2, z + h * 0.2)), ((x + w / 2, z + h * 0.2), (x + w / 2, z - h * 0.2)),
                ((x + w / 2, z - h * 0.2), (x + w * 0.15, z - h / 2)), ((x + w * 0.15, z - h / 2), (x - w / 2, z - h / 2))]
    for (a, b) in segs:
        lot.barre(mat, (a[0], y, a[1]), (b[0], y, b[1]), e)


def objet_kit_reparation(coll, leger=True):
    """Kit de réparation : boîte à outils de la teinte (orange) à poignée, fermoirs, clé et tournevis posés dessus."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'kit')
    O._rond(lot, TEINTE, (0, 0, 0), (0, 0, 0.16), 0.26, 0.15, n, k=0.02, r=0.035)
    lot.cube('teinte_sombre', (0.5, 0.28, 0.035), (0, 0, 0.165), 0.008)  # couvercle
    lot.cube(TEINTE, (0.47, 0.25, 0.02), (0, 0, 0.19), 0.006)
    for x in (-0.13, 0.13):  # poignée
        O._rond(lot, 'composant', (x, 0, 0.2), (x, 0, 0.26), 0.014, 0.014, 2, k=0.004)
    O._rond(lot, 'composant', (-0.14, 0, 0.26), (0.14, 0, 0.26), 0.018, 0.016, n, k=0.006)
    for x in (-0.16, 0.16):  # fermoirs
        lot.cube('composant_clair', (0.05, 0.012, 0.05), (x, -0.155, 0.15), 0.004)
    lot.cube('etiquette', (0.06, 0.008, 0.06), (0, -0.152, 0.08), 0.004)  # croix blanche de réparation
    lot.cube('led_rouge', (0.04, 0.01, 0.012), (0, -0.157, 0.08))
    lot.cube('led_rouge', (0.012, 0.01, 0.04), (0, -0.157, 0.08))
    # Clé plate couchée sur le couvercle, tournevis à côté.
    m = Matrix.Rotation(0.35, 3, 'Z')
    a, b = m @ Vector((-0.17, 0, 0)), m @ Vector((0.1, 0, 0))
    lot.barre('composant_clair', tuple(a + Vector((0, -0.05, 0.207))), tuple(b + Vector((0, -0.05, 0.207))), 0.018)
    O._cyl(lot, 'composant_clair', tuple(a + Vector((0, -0.05, 0.2))), tuple(a + Vector((0, -0.05, 0.215))), 0.035, n)
    O._cyl(lot, 'led_rouge', (0.0, 0.07, 0.212), (0.12, 0.07, 0.212), 0.018, n)
    O._cyl(lot, 'composant_clair', (0.12, 0.07, 0.212), (0.22, 0.07, 0.212), 0.007, 2)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_capsule_fusion(coll, leger=True):
    """Capsule de fusion : sphère brillante de la teinte (cœur lumineux), deux demi-coques métalliques, bague et socle."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'capsule')
    _profil(lot, 'metal_sci_sombre', 0, 0, [(0.0, 0.11), (0.03, 0.13), (0.06, 0.1), (0.08, 0.05)], n)
    zc, R = 0.22, 0.14
    prof = [(zc + R * math.sin(a), max(0.01, R * math.cos(a))) for a in [(-90 + k * 22.5) * math.pi / 180 for k in range(9)]]
    _profil(lot, TEINTE, 0, 0, prof, n + 1)
    # Demi-coques : calottes métalliques en haut et en bas, fenêtre lumineuse au milieu.
    for s in (-1, 1):
        cal = [(zc + s * R * math.sin(a) * 1.04, max(0.01, R * 1.04 * math.cos(a))) for a in
               [(25 + k * 16.25) * math.pi / 180 for k in range(5)]]
        _profil(lot, 'metal_sci', 0, 0, cal if s > 0 else cal[::-1], n + 1)
    _anneau_z(lot, 'laiton', (0, 0, zc), R, 0.02, 0.03, n)
    _profil(lot, 'lueur_rose', 0, 0, [(zc - 0.04, 0.01), (zc, 0.06), (zc + 0.04, 0.01)], n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_aimant_supra(coll, leger=True):
    """Aimant supraconducteur : gros aimant en U de la teinte, pôles argentés, bobinages de cuivre, givre aux pôles."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'aimant')
    R, r, z = 0.15, 0.055, 0.06
    m = 10 if leger else 14
    pts = [Vector((R * math.cos(math.pi * k / m), 0.08 - R * math.sin(math.pi * k / m) * 0 + R * math.sin(math.pi * k / m), z))
           for k in range(m + 1)]
    for a, b in zip(pts, pts[1:]):
        O._cyl(lot, TEINTE, tuple(a), tuple(b + (b - a).normalized() * 0.01), r, n, k=0.004)
    for x in (-R, R):
        O._cyl(lot, TEINTE, (x, 0.08, z), (x, -0.12, z), r, n, k=0.004)
        O._cyl(lot, 'composant_clair', (x, -0.12, z), (x, -0.2, z), r * 1.02, n, k=0.01)
        for k in range(4):  # bobinage
            yy = 0.04 - k * 0.04
            O._cyl(lot, 'cuivre', (x, yy, z), (x, yy - 0.025, z), r * 1.12, n, k=0.006)
        for k in range(3):  # givre
            _boule_lot(lot, 'givre', (x + (k - 1) * 0.02, -0.2, z + 0.03 - k * 0.02), 0.015)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_cristal_quantique(coll, leger=True):
    """Cristal quantique : cristal violet facetté (la teinte), deux petits éclats, sur une pierre sombre, cœur clair."""
    import bmesh as _bm
    lot = T.Lot(coll, 'cristal')
    O._loft(lot, 'composant', [((0, 0, 0), O.X, O.Y, 0.16, 0.13, 0.08), ((0, 0, 0.05), O.X, O.Y, 0.14, 0.11, 0.07),
                               ((0, 0, 0.07), O.X, O.Y, 0.08, 0.06, 0.04)], 2)

    def prisme(mat, base, h, r, rot):
        tmp = _bm.new()
        _bm.ops.create_cone(tmp, cap_ends=True, segments=6, radius1=r, radius2=r * 0.9, depth=h)
        _bm.ops.translate(tmp, vec=(0, 0, h / 2), verts=tmp.verts)
        tmp2 = _bm.new()
        _bm.ops.create_cone(tmp2, cap_ends=True, segments=6, radius1=r * 0.9, radius2=0.0, depth=r * 1.6)
        _bm.ops.translate(tmp2, vec=(0, 0, h + r * 0.8), verts=tmp2.verts)
        for t in (tmp, tmp2):
            _bm.ops.rotate(t, cent=(0, 0, 0), matrix=rot, verts=t.verts)
            _bm.ops.translate(t, vec=base, verts=t.verts)
            T._verse(t, lot.bms.setdefault(mat, _bm.new()))
    prisme(TEINTE, (0, 0, 0.05), 0.2, 0.07, Matrix.Rotation(0.1, 3, 'X'))
    prisme(TEINTE, (0.08, 0.02, 0.04), 0.09, 0.04, Matrix.Rotation(0.6, 3, 'Y'))
    prisme(TEINTE, (-0.07, -0.03, 0.04), 0.07, 0.035, Matrix.Rotation(-0.55, 3, 'Y') @ Matrix.Rotation(0.3, 3, 'X'))
    prisme('lueur_sci', (0, 0, 0.1), 0.1, 0.025, Matrix.Rotation(0.1, 3, 'X'))
    _finir(coll, lot)
    T.adoucir(coll, angle_vif=0.5)


def _bonbonne(lot, n, lettre=None, cryo=False):
    """Bonbonne debout : corps de la teinte, ogive, robinet et volant ; étiquette à lettre ou givre (cryogénique)."""
    r, h = 0.11, 0.38
    if cryo:
        r, h = 0.13, 0.32
    _profil(lot, TEINTE, 0, 0, [(0.0, r * 0.85), (0.02, r), (h, r), (h + 0.06, r * 0.7), (h + 0.09, 0.035)], n + 1)
    _anneau_z(lot, 'teinte_sombre', (0, 0, 0.03), r, 0.008, 0.03, n)
    O._cyl(lot, 'composant_clair', (0, 0, h + 0.09), (0, 0, h + 0.14), 0.025, n)  # robinet
    O._cyl(lot, 'composant_clair', (0, 0, h + 0.12), (0.06, 0, h + 0.12), 0.012, 2)
    O._cyl(lot, 'led_rouge' if not cryo else 'metal_sci_sombre', (0, 0, h + 0.14), (0, 0, h + 0.155), 0.04, n)
    if lettre:
        lot.cube('etiquette', (0.12, 0.012, 0.14), (0, -r + 0.004, h * 0.55), 0.006)
        _lettre(lot, 'composant', (0, h * 0.55), lettre, 0.09, -r - 0.004)
    if cryo:
        rnd = random.Random(3)
        for k in range(16 if n == 3 else 24):  # givre
            a = rnd.uniform(0, 2 * math.pi)
            zz = rnd.uniform(0.04, h * 0.7)
            _boule_lot(lot, 'givre', (r * math.cos(a), r * math.sin(a), zz), rnd.uniform(0.012, 0.022))
        for k in range(3):  # vapeur froide qui s'échappe
            _boule_lot(lot, 'givre', (0.02 * k, -0.01 * k, h + 0.2 + 0.05 * k), 0.03 + 0.01 * k)


def objet_deuterium(coll, leger=True):
    """Deutérium : bonbonne de gaz de la teinte, étiquette claire marquée D, robinet à volant rouge."""
    lot = T.Lot(coll, 'bonbonne')
    _bonbonne(lot, 3 if leger else 5, 'D')
    _finir(coll, lot)
    T.adoucir(coll)


def objet_tritium(coll, leger=True):
    """Tritium : bonbonne de gaz de la teinte, étiquette claire marquée T, robinet à volant rouge."""
    lot = T.Lot(coll, 'bonbonne')
    _bonbonne(lot, 3 if leger else 5, 'T')
    _finir(coll, lot)
    T.adoucir(coll)


def objet_azote_liquide(coll, leger=True):
    """Azote liquide : bonbonne cryogénique trapue de la teinte, couverte de givre, petit nuage froid au robinet."""
    lot = T.Lot(coll, 'bonbonne')
    _bonbonne(lot, 3 if leger else 5, cryo=True)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Formes qui étaient partagées (octobre 2026, style doux) : lingots, câble, isolant, barils, matières nucléaires. --
T.PALETTE.setdefault('acier_doux', '#9aa3ad')
T.PALETTE.setdefault('acier_doux_sombre', '#5d646c')
T.PALETTE.setdefault('etiquette_claire', '#efe9da')
T.PALETTE.setdefault('symbole_noir', '#24262a')
T.PALETTE.setdefault('nucleaire_jaune', '#e8c23a')
T.PALETTE.setdefault('nucleaire_lueur', '#b6ff5a')
T.PALETTE.setdefault('petrole', '#2a2016')
T.PALETTE.setdefault('rouille', '#8a4a2a')


def _lingot_doux(lot, mat, c, rot, L=0.22, W=0.075, H=0.085, k=0.025):
    """Lingot trapézoïdal aux arêtes adoucies (loft de rectangles arrondis), centré en c, tourné de rot."""
    m = Matrix.Rotation(rot, 3, 'Z')
    u = m @ Vector((0, 1, 0))
    d = m @ Vector((1, 0, 0))
    c = Vector(c)
    O._loft(lot, mat, [(c + Vector((0, 0, 0.002)), d, u, L, W, k),
                       (c + Vector((0, 0, H)), d, u, L * 0.85, W * 0.72, k * 0.8)],
            3)


def objet_lingot_alu(coll, leger=True):
    """Lingot d'aluminium : trois lingots clairs et adoucis, poinçon carré en creux sur le dessus de chacun."""
    lot = T.Lot(coll, 'lingots')
    for c, rot in (((0, -0.09, 0), 0.0), ((0, 0.09, 0), 0.0), ((0, 0, 0.085), math.pi / 2)):
        _lingot_doux(lot, TEINTE, c, rot)
        m = Matrix.Rotation(rot, 3, 'Z')
        q = Vector(c) + Vector((0, 0, 0.086)) + m @ Vector((0.07, 0, 0))
        lot.cube('teinte_sombre', (0.06, 0.04, 0.004), tuple(q), 0.001, m)
        lot.cube(TEINTE, (0.035, 0.012, 0.005), tuple(q + Vector((0, 0, 0.001))), 0.001, m)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_lingot_zamak(coll, leger=True):
    """Lingot de zamak : barres crantées (quatre blocs reliés par des entailles), en tas croisé."""
    lot = T.Lot(coll, 'lingots')
    for c, rot in (((0, -0.08, 0), 0.0), ((0, 0.08, 0), 0.0), ((0, 0, 0.075), math.pi / 2)):
        m = Matrix.Rotation(rot, 3, 'Z')
        d = m @ Vector((1, 0, 0))
        for k in range(4):
            q = Vector(c) + d * (-0.18 + 0.12 * k)
            O._loft(lot, TEINTE, [(q, d, m @ Vector((0, 1, 0)), 0.052, 0.065, 0.02),
                                  (q + Vector((0, 0, 0.075)), d, m @ Vector((0, 1, 0)), 0.042, 0.05, 0.016)], 3)
        O._rond(lot, 'teinte_sombre', tuple(Vector(c) - d * 0.23 + Vector((0, 0, 0.02))),
                tuple(Vector(c) + d * 0.23 + Vector((0, 0, 0.02))), 0.03, 0.02, 2, k=0.005)  # âme qui relie les blocs
    _finir(coll, lot)
    T.adoucir(coll)


def objet_cable(coll, leger=True):
    """Câble isolé : touret en bois, câble épais à gaine de la teinte enroulé, bout coupé où l'âme de cuivre dépasse."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'cable')
    z = 0.2
    for x in (-0.17, 0.17):
        O._cyl(lot, 'bois', (x - 0.02, 0, z), (x + 0.02, 0, z), 0.2, n + 2, k=0.008)
    O._cyl(lot, 'bois_sombre', (-0.15, 0, z), (0.15, 0, z), 0.07, n + 1)
    m = 5
    for k in range(m):  # spires de câble, bien rondes
        x = -0.12 + 0.24 * k / (m - 1)
        O._cyl(lot, TEINTE, (x - 0.026, 0, z), (x + 0.026, 0, z), 0.15, n + 2, k=0.022)
    # Bout libre : le câble descend au sol et s'arrête net, l'âme de cuivre dépasse.
    pts = [(0.12, -0.14, z - 0.05), (0.13, -0.2, 0.05), (0.15, -0.3, 0.03), (0.17, -0.38, 0.03)]
    for a, b in zip(pts, pts[1:]):
        O._cyl(lot, TEINTE, a, b, 0.026, n, k=0.004)
    O._cyl(lot, 'teinte_sombre', pts[-1], (0.172, -0.385, 0.03), 0.027, n)
    O._cyl(lot, 'cuivre', (0.172, -0.385, 0.03), (0.178, -0.41, 0.03), 0.013, n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_isolant(coll, leger=True):
    """Isolant plastique : trois manchons creux de la teinte (un debout, deux couchés), bouts plus clairs."""
    import bmesh as _bm
    n = 3 if leger else 5
    lot = T.Lot(coll, 'isolant')

    def manchon(a, b, r, ri):
        a, b = Vector(a), Vector(b)
        dz = b - a
        tmp = _bm.new()
        _bm.ops.create_cone(tmp, cap_ends=False, segments=16, radius1=r, radius2=r, depth=dz.length)
        inner = _bm.new()
        _bm.ops.create_cone(inner, cap_ends=False, segments=16, radius1=ri, radius2=ri, depth=dz.length)
        _bm.ops.reverse_faces(inner, faces=list(inner.faces))
        for t in (tmp, inner):
            _bm.ops.rotate(t, cent=(0, 0, 0), matrix=Vector((0, 0, 1)).rotation_difference(dz).to_matrix(), verts=t.verts)
            _bm.ops.translate(t, vec=(a + b) / 2, verts=t.verts)
            for f in t.faces:
                f.smooth = True
            T._verse(t, lot.bms.setdefault(TEINTE, _bm.new()))
        for p0 in (a, b):  # bagues claires aux bouts (cachent les bords du tube)
            dn = dz.normalized() * (0.006 if p0 is b else -0.006)
            O._cyl(lot, 'acier_doux', tuple(p0 - dn), tuple(p0 + dn), r + 0.004, n + 2, k=0.002)
    manchon((-0.1, 0.02, 0.0), (-0.1, 0.02, 0.22), 0.07, 0.04)
    manchon((-0.02, -0.12, 0.055), (0.24, -0.08, 0.055), 0.055, 0.03)
    manchon((0.05, 0.1, 0.05), (0.27, 0.06, 0.05), 0.05, 0.028)
    _finir(coll, lot)
    T.adoucir(coll)


def _fut_doux(lot, n, corps, bande, haut_ouvert=False):
    """Fût debout au style doux : corps `corps`, deux cerclages, bande `bande` ; renvoie la hauteur du dessus."""
    R, H = 0.2, 0.56
    O._cyl(lot, corps, (0, 0, 0), (0, 0, H), R, n + 3, k=0.02)
    for z in (0.15, 0.41):
        O._cyl(lot, 'acier_doux_sombre', (0, 0, z - 0.013), (0, 0, z + 0.013), R + 0.008, n + 3, k=0.004)
    O._cyl(lot, bande, (0, 0, 0.22), (0, 0, 0.34), R + 0.003, n + 3, k=0.004)
    O._cyl(lot, 'acier_doux_sombre', (0, 0, H - 0.008), (0, 0, H + 0.012), R + 0.004, n + 3, k=0.005)  # rebord
    if haut_ouvert:
        O._cyl(lot, 'symbole_noir', (0, 0, H + 0.006), (0, 0, H + 0.013), R - 0.02, n + 3)
    else:
        O._cyl(lot, corps, (0, 0, H + 0.004), (0, 0, H + 0.014), R - 0.012, n + 3, k=0.003)
        O._cyl(lot, 'acier_doux_sombre', (0.09, 0, H + 0.01), (0.09, 0, H + 0.035), 0.03, n, k=0.006)  # bouchon
    return H


def _symbole_goutte(lot, mat, y, z, h):
    """Goutte (symbole de liquide) dessinée en relief sur une face tournée vers -Y."""
    secs = []
    for k in range(9):
        t = k / 8
        zz = z + h * (0.5 - t)
        w = h * (0.03 + 0.32 * math.sin(math.pi * min(1.0, t * 1.25)) ** 0.8) if t < 0.95 else h * 0.08
        secs.append(((0, y, zz), O.X, Vector((0, -1, 0)), max(0.002, w), 0.004, 0.002))
    O._loft(lot, mat, secs, 2)


def objet_baril_vide(coll, leger=True):
    """Baril vide : fût gris de la teinte, couvercle posé contre lui, intérieur sombre visible."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'baril')
    H = _fut_doux(lot, n, TEINTE, 'acier_doux_sombre', haut_ouvert=True)
    m = Matrix.Rotation(-1.25, 3, 'X')
    c = Vector((0.0, -0.27, 0.19))
    O._cyl(lot, TEINTE, tuple(c - m @ Vector((0, 0, 0.008))), tuple(c + m @ Vector((0, 0, 0.008))), 0.19, n + 3, k=0.004)
    O._cyl(lot, 'acier_doux_sombre', tuple(c + m @ Vector((0, 0, 0.006))), tuple(c + m @ Vector((0, 0, 0.016))), 0.03, n)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_baril_eau(coll, leger=True):
    """Baril d'eau : fût de la teinte (bleu), bande claire avec une goutte bleue, bouchon."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'baril')
    _fut_doux(lot, n, TEINTE, 'etiquette_claire')
    _symbole_goutte(lot, TEINTE, -0.207, 0.28, 0.1)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_baril_petrole(coll, leger=True):
    """Baril de pétrole : fût sombre de la teinte, bande jaune avec une goutte noire, coulure sur le côté."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'baril')
    H = _fut_doux(lot, n, TEINTE, 'nucleaire_jaune')
    _symbole_goutte(lot, 'symbole_noir', -0.207, 0.28, 0.1)
    for (x, y, l) in ((0.15, -0.13, 0.12), (0.18, -0.08, 0.07)):  # coulures noires sous le bouchon
        O._rond(lot, 'petrole', (x, y, H), (x * 1.02, y * 1.02, H - l), 0.012, 0.006, 2, k=0.003)
    _finir(coll, lot)
    T.adoucir(coll)


def objet_petrole_brut(coll, leger=True):
    """Pétrole brut : fût rouillé ouvert, rempli à ras bord de pétrole noir luisant qui déborde et fait une flaque."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'baril')
    H = _fut_doux(lot, n, 'rouille', 'acier_doux_sombre', haut_ouvert=True)
    O._cyl(lot, TEINTE, (0, 0, H + 0.005), (0, 0, H + 0.016), 0.19, n + 3, k=0.004)  # surface du pétrole
    for a in (0.4, 2.2, 4.0):
        d = Vector((math.cos(a), math.sin(a), 0))
        O._rond(lot, TEINTE, tuple(d * 0.2 + Vector((0, 0, H + 0.01))), tuple(d * 0.21 + Vector((0, 0, H - 0.18))), 0.02, 0.008,
                2, k=0.004)
    O._loft(lot, TEINTE, [((0.12, -0.18, 0.0), O.X, O.Y, 0.16, 0.1, 0.09), ((0.12, -0.18, 0.008), O.X, O.Y, 0.15, 0.09, 0.085)],
            n)  # flaque
    _finir(coll, lot)
    T.adoucir(coll)


def objet_barre_uranium(coll, leger=True):
    """Barre d'uranium : longue gaine métallique posée sur deux cales, fenêtre où l'on voit les pastilles de la teinte
    (vert lumineux), embouts sombres."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'barre')
    z = 0.075
    for x in (-0.2, 0.2):
        O._rond(lot, 'acier_doux_sombre', (x, -0.07, 0), (x, 0.07, 0), 0.025, 0.03, n, k=0.008)
    O._cyl(lot, 'acier_doux', (-0.34, 0, z), (0.34, 0, z), 0.045, n + 2, k=0.01)
    for x in (-0.34, 0.34):
        a = x - 0.03 if x > 0 else x - 0.004
        O._cyl(lot, 'acier_doux_sombre', (a, 0, z), (a + 0.034, 0, z), 0.05, n + 2, k=0.01)
    # Fenêtre : pastilles empilées visibles par une découpe sur le dessus.
    for k in range(7):
        x = -0.15 + 0.05 * k
        O._cyl(lot, TEINTE, (x - 0.021, 0, z + 0.006), (x + 0.021, 0, z + 0.006), 0.04, n + 1, k=0.006)
    for x in (-0.19, 0.19):
        O._cyl(lot, 'acier_doux_sombre', (x - 0.012, 0, z), (x + 0.012, 0, z), 0.048, n + 2, k=0.004)
    _finir(coll, lot)
    T.adoucir(coll)


def _trefle(lot, mat, c, r, u, v):
    """Trèfle radioactif (trois secteurs et un rond) en relief sur un plan (u, v) centré en c."""
    c = Vector(c)
    nrm = u.cross(v).normalized()
    O._cyl(lot, mat, tuple(c), tuple(c + nrm * 0.004), r * 0.2, 3)
    for k in range(3):
        a0 = math.radians(90 + k * 120 - 30)
        secs = []
        for j in range(5):
            a = a0 + math.radians(60) * j / 4
            d = u * math.cos(a) + v * math.sin(a)
            secs.append((c + d * r * 0.62, d.cross(nrm).normalized(), nrm, r * 0.36, 0.002, 0.001))
        O._loft(lot, mat, secs, 2)


def objet_dechets_nucleaires(coll, leger=True):
    """Déchets nucléaires : fût jaune cabossé avec trèfle noir, couvercle de travers, matière lumineuse de la teinte qui
    déborde et coule."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'dechets')
    H = _fut_doux(lot, n, 'nucleaire_jaune', 'symbole_noir', haut_ouvert=True)
    _trefle(lot, 'nucleaire_jaune', (0, -0.205, 0.28), 0.05, Vector((1, 0, 0)), Vector((0, 0, 1)))
    O._cyl(lot, TEINTE, (0, 0, H + 0.006), (0, 0, H + 0.02), 0.18, n + 3, k=0.006)  # matière lumineuse
    m = Matrix.Rotation(0.35, 3, 'Y')
    c = Vector((0.06, 0.02, H + 0.05))
    O._cyl(lot, 'nucleaire_jaune', tuple(c - m @ Vector((0, 0, 0.008))), tuple(c + m @ Vector((0, 0, 0.008))), 0.19, n + 3,
           k=0.004)  # couvercle de travers
    for a in (1.0, 3.6):
        d = Vector((math.cos(a), math.sin(a), 0))
        O._rond(lot, TEINTE, tuple(d * 0.2 + Vector((0, 0, H + 0.01))), tuple(d * 0.212 + Vector((0, 0, H - 0.2))), 0.022,
                0.008, 2, k=0.004)
    O._loft(lot, TEINTE, [((-0.16, 0.12, 0.0), O.X, O.Y, 0.1, 0.07, 0.06), ((-0.16, 0.12, 0.008), O.X, O.Y, 0.09, 0.06, 0.055)],
            n)
    _finir(coll, lot)
    T.adoucir(coll)


# --- Batterie portable (équipement) ----------------------------------------------------------------------------------


def objet_batterie_portable(coll, leger=True):
    """Batterie portable : pile de poche plate de la teinte, flancs gris à prises, face avant sombre avec un éclair et une
    jauge de quatre barres (la jauge réelle de charge sera dessinée par-dessus l'icône), clip de ceinture au dos."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'batterie')
    O._rond(lot, TEINTE, (0, 0, 0), (0, 0, 0.5), 0.17, 0.08, n, k=0.03, r=0.05)
    for z in (0.0, 0.47):  # embouts gris
        O._rond(lot, 'composant', (0, 0, z), (0, 0, z + 0.05), 0.18, 0.09, n, k=0.02, r=0.055)
    O._rond(lot, 'teinte_sombre', (0, -0.075, 0.08), (0, -0.075, 0.44), 0.13, 0.012, n, k=0.006, r=0.03)
    # Éclair.
    for a, b in (((0.03, 0.39), (-0.035, 0.3)), ((-0.035, 0.3), (0.035, 0.3)), ((0.035, 0.3), (-0.03, 0.21))):
        lot.barre('jaune', (a[0], -0.09, a[1]), (b[0], -0.09, b[1]), 0.022)
    for k in range(4):  # jauge
        lot.cube('pcb_vert' if k < 3 else 'composant_clair', (0.045, 0.01, 0.022), (-0.075 + k * 0.05, -0.088, 0.13), 0.004)
    # Prises en haut, bouton sur le flanc, clip au dos.
    O._rond(lot, 'composant_clair', (0, 0, 0.52), (0, 0, 0.535), 0.05, 0.018, 2, k=0.004)
    O._cyl(lot, 'composant_clair', (0.09, 0, 0.52), (0.09, 0, 0.535), 0.015, n)
    O._cyl(lot, 'composant_clair', (0.18, -0.02, 0.36), (0.19, -0.02, 0.36), 0.02, n)
    O._rond(lot, 'composant', (0, 0.09, 0.18), (0, 0.09, 0.44), 0.06, 0.012, n, k=0.006)
    _finir(coll, lot)
    T.adoucir(coll)


MODELES = {f.__name__: f for f in (
    objet_bois, objet_caillou, objet_minerai, objet_sable, objet_lingot, objet_plaque, objet_engrenage, objet_bobine,
    objet_fibre, objet_tissu, objet_baril, objet_science, objet_puce, objet_bloc, objet_conteneur, objet_verre,
    objet_caisse, objet_carapace, objet_tissu_vivant, objet_caoutchouc, objet_tige, objet_moteur, objet_moteur_renforce, objet_eau,
    objet_science_1, objet_science_2, objet_science_3, objet_science_4, objet_science_5, objet_science_combat,
    objet_moule_plaque, objet_moule_engrenage, objet_moule_fil,
    objet_chassis_simple, objet_chassis_renforce, objet_chassis_leger, objet_chassis_composite, objet_vitre,
    objet_vitre_blindee, objet_graphite, objet_sel_lithium, objet_fibre_carbone, objet_kit_circuit,
    objet_circuit_avance, objet_microcontroleur, objet_cellule_solaire, objet_filtre_graphite, objet_batterie_lithium,
    objet_kit_reparation, objet_capsule_fusion, objet_aimant_supra, objet_cristal_quantique, objet_deuterium, objet_tritium,
    objet_azote_liquide, objet_lingot_alu, objet_lingot_zamak, objet_cable, objet_isolant, objet_baril_vide, objet_baril_eau,
    objet_baril_petrole, objet_petrole_brut, objet_barre_uranium, objet_dechets_nucleaires, objet_batterie_portable)}


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
    T.save(os.path.join(ROOT, 'blender', 'objets.blend'))


if __name__ == '__main__':
    main()
