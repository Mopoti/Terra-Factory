"""Famille « végétation » : arbres et buissons de chaque biome (prairie, forêt, désert, toundra).

Style doux (comme la pioche-hache) : feuillage en boules et troncs à l'ombrage lissé (`T.adoucir`), bords des cônes
et des coupes nets, couleurs unies de la palette, pas de texture.
Deux niveaux de détail par modèle (collections `<nom>` et `<nom>_unity`), comme les machines.

Le jeu met chaque arbre à la taille voulue (hauteur d'un arbre moyen : 5,5 m) et chaque buisson à 0,6 m de haut : la
taille dessinée ici ne compte pas, seules les proportions comptent. Règles :
- arbre posé par le pied du tronc en (0, 0, 0), largeur <= 0,75 x hauteur, feuillage au-dessus de 40 % de la hauteur
  (le joueur passe sous les branches) ;
- buisson posé en (0, 0, 0), largeur <= 1,5 x hauteur ;
- pas de repères d'emprise (ce ne sont pas des machines).

Lancer :  blender --background --python blender/scripts/vegetation.py
Produit :  blender/vegetation.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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

# Finesse des boules de feuillage (subdivisions de l'icosphère) : 2 pour le web, 3 pour Unity (`construire`).
FINESSE = 2


class Lot(T.Lot):
    """Lot du style doux : boules de feuillage rondes (icosphère plus fine) et un peu aplaties, comme des nuages."""

    def boule(self, mat, p, r):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=FINESSE, radius=r)
        bmesh.ops.scale(tmp, vec=Vector((1, 1, 0.88)), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=Vector(p), verts=tmp.verts)
        T._verse(tmp, self.bms.setdefault(mat, bmesh.new()))


def _tronc(coll, nom, h, r0, r1, mat='ecorce', seg=9):
    T.cylinder(coll, nom, r0, h, (0, 0, h / 2), mat, segments=seg, radius_top=r1)


def _branche(lot, a, b, r, mat='ecorce'):
    lot.tube(mat, a, b, r, 7)


def _boule(lot, mat, c, r, rnd, ecrase=1.0):
    """Masse de feuillage : icosphère légèrement déformée (posée par Lot.boule puis aplatie si besoin)."""
    lot.boule(mat, c, r)


def _cone(coll, nom, r, h, z, mat, seg=12, rt=0.0, c=(0, 0)):
    T.cylinder(coll, nom, r, h, (c[0], c[1], z + h / 2), mat, segments=seg, radius_top=rt)


def _finir(coll):
    """Pose au sol (le plus bas à Z = 0), sans repères d'emprise."""
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


def _ramure(lot, rnd, p, d, l, r, n, mat, neige=None):
    """Branche de `p` dans la direction `d`, qui se divise `n` fois (branches nues, bouts enneigés si `neige`)."""
    q = p + d * l
    lot.tube(mat, p, q, r, 6)
    if neige is not None and n <= 1:
        neige.boule('neige', tuple(q), max(0.07, r * 2.2))
    if n == 0:
        return
    for _ in range(2 if n > 1 else 3):
        axe = d.cross(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.01))).normalized()
        nd = Matrix.Rotation(rnd.uniform(0.45, 0.85), 3, axe) @ d
        nd.z = max(nd.z, 0.2)
        _ramure(lot, rnd, q, nd.normalized(), l * 0.72, r * 0.66, n - 1, mat, neige)


# --- Prairie : feuillus ----------------------------------------------------------------------------------------------

def arbre_prairie_1(coll, leger=True):
    """Chêne de prairie : tronc épais, branches maîtresses, houppier rond en grappes de trois verts."""
    rnd = random.Random(101)
    lot = Lot(coll, 'feuillage')
    br = Lot(coll, 'branches')
    _tronc(coll, 'tronc', 4.6, 0.42, 0.26)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        _branche(br, (0, 0, 3.6), (1.3 * math.cos(a), 1.3 * math.sin(a), 5.2), 0.14)
    for k in range(9 if leger else 14):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.3, 1.5)
        lot.boule(rnd.choice(('feuille', 'feuille_claire', 'feuille_sombre')),
                  (d * math.cos(a), d * math.sin(a), rnd.uniform(5.2, 7.6)), rnd.uniform(1.05, 1.45))
    lot.boule('feuille_claire', (0, 0, 7.9), 1.2)
    for l in (lot, br):
        l.finir()
    _finir(coll)


def arbre_prairie_2(coll, leger=True):
    """Bouleau : tronc fin blanc tacheté de noir, houppier ovale clair et léger."""
    rnd = random.Random(102)
    lot, ta = Lot(coll, 'feuillage'), Lot(coll, 'taches')
    _tronc(coll, 'tronc', 7.5, 0.22, 0.12, 'ecorce_claire')
    for k in range(10):
        z = 0.5 + k * 0.65
        a = rnd.uniform(0, 2 * math.pi)
        r = 0.22 - 0.1 * z / 7.5 + 0.005
        ta.cube('noir', (0.12, 0.03, 0.05), (r * math.cos(a), r * math.sin(a), z), 0, Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    for k in range(11 if leger else 16):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.3, 1.0)
        lot.boule(rnd.choice(('feuille_claire', 'feuille_claire', 'feuille')),
                  (d * math.cos(a), d * math.sin(a), rnd.uniform(4.4, 8.2)), rnd.uniform(1.0, 1.3))
    for l in (lot, ta):
        l.finir()
    _finir(coll)


def arbre_prairie_3(coll, leger=True):
    """Pommier : tronc court et tordu, houppier large et bas (au-dessus de 40 %), pommes rouges."""
    rnd = random.Random(103)
    lot, fr, br = Lot(coll, 'feuillage'), Lot(coll, 'fruits'), Lot(coll, 'branches')
    _tronc(coll, 'tronc', 3.4, 0.3, 0.2)
    for k in range(3):
        a = k * 2 * math.pi / 3
        _branche(br, (0, 0, 3.0), (1.1 * math.cos(a), 1.1 * math.sin(a), 4.2), 0.12)
    pts = []
    for k in range(8 if leger else 12):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.4, 1.4)
        p = (d * math.cos(a), d * math.sin(a), rnd.uniform(4.0, 5.6))
        pts.append(p)
        lot.boule(rnd.choice(('feuille', 'feuille_sombre')), p, rnd.uniform(0.95, 1.25))
    for k in range(10):
        p = Vector(rnd.choice(pts))
        off = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 0.2))).normalized() * 1.0
        fr.boule('rouge', tuple(p + off), 0.13)
    for l in (lot, fr, br):
        l.finir()
    _finir(coll)


# --- Forêt : conifères et grands arbres ------------------------------------------------------------------------------

def _sapin(coll, nom, h, r, etages, mat_a, mat_b, neige=False, z0=None):
    """Conifère : tronc et cônes empilés (de plus en plus petits), un peu tournés les uns par rapport aux autres."""
    z0 = h * 0.38 if z0 is None else z0
    _tronc(coll, nom + '_tronc', z0 + 0.6, r * 0.16, r * 0.1)
    hh = (h - z0) / etages * 1.55
    for k in range(etages):
        t = k / max(1, etages - 1)
        rk = r * (1 - 0.62 * t)
        zk = z0 + k * (h - z0 - hh * 0.6) / max(1, etages - 1)
        o = T.cylinder(coll, f'{nom}_etage_{k}', rk, hh, (0, 0, zk + hh / 2), mat_a if k % 2 == 0 else mat_b, segments=12, radius_top=0.0)
        o.rotation_euler = (0, 0, k * 0.45)
        if neige:
            n = T.cylinder(coll, f'{nom}_neige_{k}', rk * 0.55, hh * 0.45, (0, 0, zk + hh * 0.55 + hh * 0.225), 'neige', segments=12, radius_top=0.0)
            n.rotation_euler = (0, 0, k * 0.45)
            bord = Lot(coll, f'{nom}_bord_{k}')
            for j in range(7):  # bordure de neige au bas de chaque étage
                a = 2 * math.pi * (j + 0.5) / 7 + k * 0.45
                rot = Matrix.Rotation(a, 3, 'Z') @ Matrix.Rotation(0.45, 3, 'Y')
                bord.cube('neige', (rk * 0.45, rk * 0.5, 0.1), (rk * 0.72 * math.cos(a), rk * 0.72 * math.sin(a), zk + hh * 0.14), 0, rot)
            bord.finir()


def arbre_foret_1(coll, leger=True):
    """Pin : grand conifère vert sombre à étages."""
    _sapin(coll, 'pin', 10.0, 2.6, 5 if leger else 7, 'pin', 'pin_sombre')
    _finir(coll)


def arbre_foret_2(coll, leger=True):
    """Épicéa élancé : étages nombreux et serrés, très étroit."""
    _sapin(coll, 'epicea', 11.0, 2.0, 7 if leger else 9, 'pin_sombre', 'pin', z0=3.6)
    _finir(coll)


def arbre_foret_3(coll, leger=True):
    """Grand hêtre de forêt : tronc haut et lisse, houppier sombre en hauteur, racines apparentes."""
    rnd = random.Random(203)
    lot, br = Lot(coll, 'feuillage'), Lot(coll, 'racines')
    _tronc(coll, 'tronc', 6.2, 0.38, 0.22, 'ecorce')
    for k in range(5):
        a = k * 2 * math.pi / 5
        br.tube('ecorce', (0.2 * math.cos(a), 0.2 * math.sin(a), 0.35), (0.75 * math.cos(a), 0.75 * math.sin(a), 0.0), 0.12, 6)
    for k in range(10 if leger else 15):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.2, 1.6)
        lot.boule(rnd.choice(('feuille_sombre', 'feuille_sombre', 'feuille')),
                  (d * math.cos(a), d * math.sin(a), rnd.uniform(6.2, 9.4)), rnd.uniform(1.0, 1.45))
    for l in (lot, br):
        l.finir()
    _finir(coll)


# --- Désert : arbres secs et cactus ----------------------------------------------------------------------------------

def arbre_desert_1(coll, leger=True):
    """Acacia : tronc tordu qui se divise, houppier plat en parasol."""
    rnd = random.Random(301)
    lot, br = Lot(coll, 'feuillage'), Lot(coll, 'branches')
    # Largeur <= 0,75 x hauteur (limite des arbres maison dans le jeu) : tronc haut, parasol de 5,4 de large.
    br.tube('bois_sec', (0, 0, 0), (0.3, 0, 4.4), 0.26, 7)
    for a, d in ((0.3, 1.3), (2.5, 1.2), (4.4, 1.1)):
        _branche(br, (0.3, 0, 4.3), (0.3 + d * math.cos(a), d * math.sin(a), 6.4), 0.13, 'bois_sec')
    for k in range(9 if leger else 14):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.0, 1.6)
        c = Vector((0.3 + d * math.cos(a), d * math.sin(a), rnd.uniform(6.5, 7.0)))
        lot.cube(rnd.choice(('feuille', 'feuille_claire', 'feuille_sombre')), (1.5, 1.3, 0.45), tuple(c), 0.08,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    for l in (lot, br):
        l.finir()
    _finir(coll)


def arbre_desert_2(coll, leger=True):
    """Arbre mort : tronc gris-brun et branches nues qui se ramifient."""
    rnd = random.Random(302)
    br = Lot(coll, 'branches')
    _tronc(coll, 'tronc', 3.0, 0.3, 0.18, 'bois_sec')
    for a, z, l in ((0.3, 2.9, 1.4), (2.4, 2.6, 1.3), (4.3, 2.8, 1.35)):
        d = Vector((math.cos(a), math.sin(a), 2.3)).normalized()  # branches qui montent (arbre pas trop large)
        _ramure(br, rnd, Vector((0, 0, z)), d, l, 0.13, 3 if leger else 4, 'bois_sec')
    _ramure(br, rnd, Vector((0, 0, 2.9)), Vector((0, 0, 1)), 1.6, 0.14, 3 if leger else 4, 'bois_sec')
    br.finir()
    _finir(coll)


def arbre_desert_3(coll, leger=True):
    """Cactus candélabre (saguaro) : fût côtelé et trois bras qui remontent, quelques fleurs."""
    lot = Lot(coll, 'cactus')
    seg = 8

    def bras(base, sx, h0, h1):
        x0, z0 = base
        lot.tube('cactus', (x0, 0, z0), (x0 + sx * 1.0, 0, z0), 0.32, seg)
        lot.boule('cactus', (x0 + sx * 1.0, 0, z0), 0.32)
        lot.tube('cactus', (x0 + sx * 1.0, 0, z0), (x0 + sx * 1.0, 0, h1), 0.32, seg)
        lot.boule('cactus', (x0 + sx * 1.0, 0, h1), 0.32)
    T.cylinder(coll, 'fut', 0.5, 8.0, (0, 0, 4.0), 'cactus', segments=seg)
    lot.boule('cactus', (0, 0, 8.0), 0.5)
    for k in range(seg):  # côtes
        a = 2 * math.pi * k / seg
        lot.cube('feuille_sombre', (0.06, 0.06, 7.6), (0.5 * math.cos(a), 0.5 * math.sin(a), 4.0))
    bras((0.4, 3.6), 1, 3.6, 6.2)
    bras((-0.4, 4.6), -1, 4.6, 6.8)
    for p in ((0.2, 0.35, 8.3), (-0.2, -0.3, 8.25), (1.4, 0, 6.5)):
        lot.boule('rose', p, 0.16)
    lot.finir()
    _finir(coll)


# --- Toundra : conifères enneigés et bouleaux givrés ------------------------------------------------------------------

def arbre_toundra_1(coll, leger=True):
    """Sapin enneigé : étages verts coiffés de neige et bordés de neige."""
    _sapin(coll, 'sapin', 9.5, 2.5, 5 if leger else 6, 'pin', 'pin_sombre', neige=True)
    _finir(coll)


def arbre_toundra_2(coll, leger=True):
    """Bouleau nu givré : tronc blanc, branches fines sans feuilles, neige sur les fourches."""
    rnd = random.Random(402)
    br, ne = Lot(coll, 'branches'), Lot(coll, 'neige')
    _tronc(coll, 'tronc', 4.0, 0.22, 0.12, 'ecorce_claire')
    for a, z in ((0.5, 3.0), (2.6, 3.4), (4.5, 3.8)):
        d = Vector((math.cos(a), math.sin(a), 1.3)).normalized()
        _ramure(br, rnd, Vector((0, 0, z)), d, 1.4, 0.1, 3 if leger else 4, 'ecorce_claire', ne)
    _ramure(br, rnd, Vector((0, 0, 3.9)), Vector((0, 0, 1)), 1.5, 0.11, 3 if leger else 4, 'ecorce_claire', ne)
    for l in (br, ne):
        l.finir()
    _finir(coll)


def arbre_toundra_3(coll, leger=True):
    """Pin tordu des neiges : tronc penché, quelques touffes d'aiguilles en plateaux couverts de neige."""
    rnd = random.Random(403)
    lot, br = Lot(coll, 'feuillage'), Lot(coll, 'branches')
    pts = [Vector((0, 0, 0)), Vector((0.4, 0, 2.5)), Vector((0.2, 0.3, 4.5)), Vector((0.6, 0.1, 6.8))]
    for a, b in zip(pts, pts[1:]):
        br.tube('ecorce', a, b, 0.25, 6)
    for k, p in enumerate(pts[1:]):
        for s in (-1, 1):
            q = p + Vector((s * rnd.uniform(1.0, 1.6), rnd.uniform(-0.4, 0.4), rnd.uniform(0.2, 0.6)))
            br.tube('ecorce', p, q, 0.1, 5)
            lot.cube('pin_sombre', (1.5, 1.2, 0.4), tuple(q), 0.06, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
            lot.cube('neige', (1.3, 1.0, 0.16), tuple(q + Vector((0, 0, 0.26))), 0.04, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    lot.cube('pin', (1.2, 1.0, 0.5), tuple(pts[-1] + Vector((0, 0, 0.2))), 0.06)
    lot.cube('neige', (1.0, 0.8, 0.18), tuple(pts[-1] + Vector((0, 0, 0.5))), 0.04)
    for l in (lot, br):
        l.finir()
    _finir(coll)


# --- Buissons ----------------------------------------------------------------------------------------------------------

def _touffe(lot, rnd, n, h, mats, rayon=0.5, z0=0.0):
    """Touffe d'herbes : brins plats inclinés en éventail."""
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-0.2, 0.2)
        d = rnd.uniform(0.05, rayon)
        hk = h * rnd.uniform(0.6, 1.0)
        incl = rnd.uniform(0.2, 0.5)
        rot = Matrix.Rotation(a, 3, 'Z') @ Matrix.Rotation(incl, 3, 'Y')
        p = Vector((d * math.cos(a), d * math.sin(a), z0)) + rot @ Vector((0, 0, hk / 2))
        lot.cube(rnd.choice(mats), (0.07, 0.02, hk), tuple(p), 0, rot)


def buisson_prairie_1(coll, leger=True):
    """Touffe d'herbes hautes avec des fleurs jaunes et blanches."""
    rnd = random.Random(501)
    lot = Lot(coll, 'herbe')
    _touffe(lot, rnd, 18 if leger else 28, 1.2, ('feuille', 'feuille_claire'), 0.45)
    for k in range(6):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.15, 0.5)
        z = rnd.uniform(0.8, 1.25)
        lot.tube('feuille_sombre', (d * math.cos(a), d * math.sin(a), 0), (d * math.cos(a), d * math.sin(a), z), 0.012, 4)
        lot.boule('jaune' if k % 2 else 'blanc', (d * math.cos(a), d * math.sin(a), z), 0.07)
    lot.finir()
    _finir(coll)


def buisson_prairie_2(coll, leger=True):
    """Buisson rond feuillu."""
    rnd = random.Random(502)
    lot = Lot(coll, 'feuillage')
    for k in range(7 if leger else 11):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.1, 0.55)
        lot.boule(rnd.choice(('feuille', 'feuille_claire', 'feuille_sombre')), (d * math.cos(a), d * math.sin(a), rnd.uniform(0.35, 0.75)), rnd.uniform(0.35, 0.5))
    lot.finir()
    _finir(coll)


def buisson_prairie_3(coll, leger=True):
    """Trèfles et fleurs roses en coussin bas."""
    rnd = random.Random(503)
    lot = Lot(coll, 'trefle')
    for k in range(14 if leger else 22):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, 0.45)
        lot.cube(rnd.choice(('feuille', 'feuille_claire')), (0.2, 0.2, 0.05), (d * math.cos(a), d * math.sin(a), rnd.uniform(0.1, 0.55 - 0.6 * d)), 0.02,
                 Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))
    for k in range(5):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, 0.35)
        z = rnd.uniform(0.5, 0.75)
        lot.tube('feuille_sombre', (d * math.cos(a), d * math.sin(a), 0), (d * math.cos(a), d * math.sin(a), z), 0.012, 4)
        lot.boule('rose', (d * math.cos(a), d * math.sin(a), z), 0.08)
    lot.finir()
    _finir(coll)


def buisson_foret_1(coll, leger=True):
    """Fougère : frondes vertes arquées en rosette."""
    rnd = random.Random(601)
    lot = Lot(coll, 'fougere')
    n = 8 if leger else 12
    for k in range(n):
        a = 2 * math.pi * k / n
        u = Vector((math.cos(a), math.sin(a), 0))
        p = Vector((0, 0, 0.05))
        pas = 6
        for j in range(pas):
            t = (j + 1) / pas
            q = u * (0.6 * t) + Vector((0, 0, 0.05 + 1.0 * math.sin(math.pi * 0.8 * t)))
            lot.barre('feuille_sombre', p, q, 0.03)
            w = u.cross(Vector((0, 0, 1))).normalized()
            lot.cube(rnd.choice(('feuille', 'feuille_claire')), (0.08, 0.34 * (1 - t * 0.6), 0.02), tuple(q), 0,
                     Matrix((u, w, Vector((0, 0, 1)))).transposed())
            p = q
    lot.finir()
    _finir(coll)


def buisson_foret_2(coll, leger=True):
    """Buisson à baies : feuillage sombre et baies rouges."""
    rnd = random.Random(602)
    lot = Lot(coll, 'feuillage')
    pts = []
    for k in range(6 if leger else 9):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.1, 0.45)
        p = (d * math.cos(a), d * math.sin(a), rnd.uniform(0.35, 0.7))
        pts.append(p)
        lot.boule(rnd.choice(('feuille_sombre', 'pin')), p, rnd.uniform(0.32, 0.45))
    for k in range(12):
        p = Vector(rnd.choice(pts)) + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.6))).normalized() * 0.4
        lot.boule('rouge', tuple(p), 0.06)
    lot.finir()
    _finir(coll)


def buisson_foret_3(coll, leger=True):
    """Champignons sur une souche moussue."""
    lot = Lot(coll, 'champignons')
    T.cylinder(coll, 'souche', 0.42, 0.45, (0, 0, 0.225), 'ecorce', segments=8, radius_top=0.38)
    lot.tube('bois', (0, 0, 0.45), (0, 0, 0.46), 0.36, 8)
    lot.boule('feuille_sombre', (0.25, 0.2, 0.42), 0.14)
    for (x, y, h, r, mat) in ((0.45, -0.1, 0.35, 0.18, 'rouge'), (0.6, 0.25, 0.25, 0.12, 'rouge'), (-0.45, 0.2, 0.3, 0.15, 'bois'),
                              (-0.3, -0.45, 0.2, 0.11, 'bois'), (0.1, 0.05, 0.75, 0.16, 'rouge')):
        lot.tube('blanc', (x, y, 0 if h < 0.6 else 0.45), (x, y, h), 0.035, 6)
        lot.tube(mat, (x, y, h), (x, y, h + 0.06), r, 8)
        lot.boule(mat, (x, y, h + 0.04), r * 0.8)
        if mat == 'rouge':
            lot.boule('blanc', (x + r * 0.3, y, h + 0.1), 0.03)
    lot.finir()
    _finir(coll)


def buisson_desert_1(coll, leger=True):
    """Buisson sec : touffe d'herbes jaunies raides."""
    rnd = random.Random(701)
    lot = Lot(coll, 'herbe')
    _touffe(lot, rnd, 20 if leger else 30, 1.0, ('herbe_seche', 'bois_sec', 'herbe_seche'), 0.4)
    lot.finir()
    _finir(coll)


def buisson_desert_2(coll, leger=True):
    """Petit groupe de cactus (cierges et boules) avec une fleur."""
    lot = Lot(coll, 'cactus')
    for (x, y, h, r) in ((0, 0, 1.0, 0.18), (0.32, 0.15, 0.6, 0.14), (-0.25, 0.2, 0.45, 0.13)):
        lot.tube('cactus', (x, y, 0), (x, y, h), r, 7)
        lot.boule('cactus', (x, y, h), r)
    lot.boule('cactus', (0.2, -0.35, 0.18), 0.22)
    lot.boule('cactus', (-0.4, -0.2, 0.13), 0.16)
    lot.boule('rose', (0, 0, 1.17), 0.08)
    lot.finir()
    _finir(coll)


def buisson_desert_3(coll, leger=True):
    """Virevoltant : boule de brindilles sèches."""
    rnd = random.Random(703)
    lot = Lot(coll, 'brindilles')
    c = Vector((0, 0, 0.5))
    for k in range(24 if leger else 40):
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        e = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        lot.barre(rnd.choice(('bois_sec', 'herbe_seche')), c + d * 0.48, c + e * 0.48, 0.025)
    lot.finir()
    _finir(coll)


def buisson_toundra_1(coll, leger=True):
    """Arbuste givré : petites masses sombres coiffées de neige."""
    rnd = random.Random(801)
    lot = Lot(coll, 'arbuste')
    for k in range(5 if leger else 8):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.1, 0.45)
        p = Vector((d * math.cos(a), d * math.sin(a), rnd.uniform(0.3, 0.6)))
        lot.boule('pin_sombre', tuple(p), rnd.uniform(0.3, 0.4))
        lot.boule('neige', tuple(p + Vector((0, 0, 0.2))), 0.24)
    lot.finir()
    _finir(coll)


def buisson_toundra_2(coll, leger=True):
    """Bruyère : coussin bas de petites touffes violettes et vertes."""
    rnd = random.Random(802)
    lot = Lot(coll, 'bruyere')
    for k in range(16 if leger else 26):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0, 0.4)
        lot.boule(rnd.choice(('violet', 'violet', 'feuille_sombre', 'rose')), (d * math.cos(a), d * math.sin(a), rnd.uniform(0.15, 0.65 - 0.8 * d)), rnd.uniform(0.1, 0.17))
    lot.finir()
    _finir(coll)


def buisson_toundra_3(coll, leger=True):
    """Touffe d'herbe gelée : brins vert pâle givrés de blanc."""
    rnd = random.Random(803)
    lot = Lot(coll, 'herbe')
    _touffe(lot, rnd, 16 if leger else 24, 1.0, ('feuille_claire', 'neige', 'herbe_seche'), 0.4)
    lot.boule('neige', (0, 0, 0.05), 0.3)
    lot.finir()
    _finir(coll)


MODELES = {}
for _b in ('prairie', 'foret', 'desert', 'toundra'):
    for _k in (1, 2, 3):
        MODELES[f'arbre_{_b}_{_k}'] = globals()[f'arbre_{_b}_{_k}']
        MODELES[f'buisson_{_b}_{_k}'] = globals()[f'buisson_{_b}_{_k}']


def construire(noms=None):
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        global FINESSE
        FINESSE = 2
        web = T.collection(nom)
        fabrique(web, leger=True)
        T.adoucir(web)
        FINESSE = 3
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        T.adoucir(unity)
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
    T.save(os.path.join(ROOT, 'blender', 'vegetation.blend'))


if __name__ == '__main__':
    main()
