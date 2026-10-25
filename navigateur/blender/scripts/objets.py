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


MODELES = {f.__name__: f for f in (
    objet_bois, objet_caillou, objet_minerai, objet_sable, objet_lingot, objet_plaque, objet_engrenage, objet_bobine,
    objet_fibre, objet_tissu, objet_baril, objet_science, objet_puce, objet_bloc, objet_conteneur, objet_verre,
    objet_caisse, objet_carapace, objet_tissu_vivant, objet_caoutchouc, objet_tige, objet_moteur, objet_moteur_renforce, objet_eau)}


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
