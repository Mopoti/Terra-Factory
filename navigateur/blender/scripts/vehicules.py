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

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

sys.path.insert(0, HERE)
import outils as O  # noqa: E402  (formes du style doux : _rond, _cyl, _loft)

TEINTES = {
    'camion': '#d9603b',
    'camion_clair': '#ec8a5f',
    'benne': '#8d939c',
    'benne_sombre': '#5f646c',
    'pneu': '#2a2b2f',
    'jante': '#c9ccd1',
    'phare': '#fff2c4',
    'feu': '#e04a3a',
    'planche_charrette': '#b9814e',
    'planche_charrette_claire': '#cf9a63',
    'bois_roue': '#8d5f37',
}
for _k, _v in TEINTES.items():
    T.PALETTE.setdefault(_k, _v)


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
    # Volant à gauche (+X : la gauche du conducteur, qui regarde vers -Y).
    lot.barre('acier_sombre', (0.27, -0.45, 0.9), (0.27, -0.2, 1.15), 0.04)  # colonne
    lot.tube('noir', (0.27, -0.21, 1.14), (0.27, -0.17, 1.2), 0.15, 12)  # volant
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
    lot.cube('rouge', (0.12, 0.3, 0.38), (-0.62, 0.6, 0.85), 0.02)  # jerrican (côté passager)
    lot.cube('acier_sombre', (0.06, 0.08, 0.06), (-0.62, 0.55, 1.07))
    # Roues (une par groupe, pour qu'elles tournent chacune sur son axe).
    for nom, x, y in (('roue_avg', -xr, -yr), ('roue_avd', xr, -yr), ('roue_arg', -xr, yr), ('roue_ard', xr, yr)):
        _roue(coll, nom, (x, y, zr), r, larg, sg, seg)
    T.reperer(coll, 'siege', (0.27, 0.25, Z_SIEGE))  # coussin du conducteur, à gauche (lu par le jeu)
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


def _ajouter(lot, mat, bm_src):
    """Verse le maillage `bm_src` dans le lot (teinte `mat`), normales recalculées."""
    bmesh.ops.recalc_face_normals(bm_src, faces=bm_src.faces)
    mesh = bpy.data.meshes.new('_tmp')
    bm_src.to_mesh(mesh)
    bm_src.free()
    lot.bms.setdefault(mat, bmesh.new()).from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def _prisme(lot, mat, profil, x0, x1):
    """Profil convexe (points (y, z) dans l'ordre du contour) extrudé le long de X, de x0 à x1 : plaques inclinées,
    caisses à pans coupés vues de côté."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profil]
    b = [bm.verts.new((x1, y, z)) for y, z in profil]
    n = len(profil)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], b[i], b[j], a[j]))
    _ajouter(lot, mat, bm)


def _tronc(lot, mat, bas, z0, haut, z1):
    """Tronc à pans : polygone convexe `bas` (points (x, y)) à la hauteur z0 relié au polygone `haut` (même nombre de
    points) à z1 : tourelles, carénages aux flancs inclinés."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in bas]
    b = [bm.verts.new((x, y, z1)) for x, y in haut]
    n = len(bas)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    _ajouter(lot, mat, bm)


def _enveloppe(points):
    """Enveloppe convexe (chaîne monotone) de points (y, z), dans le sens trigonométrique."""
    pts = sorted(set((round(p[0], 5), round(p[1], 5)) for p in points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    bas, haut = [], []
    for p in pts:
        while len(bas) >= 2 and cross(bas[-2], bas[-1], p) <= 0:
            bas.pop()
        bas.append(p)
    for p in reversed(pts):
        while len(haut) >= 2 and cross(haut[-2], haut[-1], p) <= 0:
            haut.pop()
        haut.append(p)
    return bas[:-1] + haut[:-1]


def _chemin_chenille(cercles, ep):
    """Contour extérieur d'une chenille qui s'enroule autour de `cercles` [(y, z, r)] : enveloppe des cercles grossis de
    l'épaisseur `ep`, rééchantillonnée régulièrement (points (y, z)) ; renvoie aussi sa longueur."""
    pts = []
    for y, z, r in cercles:
        for k in range(48):
            a = 2 * math.pi * k / 48
            pts.append((y + (r + ep) * math.cos(a), z + (r + ep) * math.sin(a)))
    env = _enveloppe(pts)
    n = len(env)
    seg = [math.dist(env[i], env[(i + 1) % n]) for i in range(n)]
    return env, sum(seg), seg


def _chenille(coll, lot, x, cercles, larg, ep, sg, leger):
    """Chenille de char le long de Y, autour des roues `cercles` [(y, z, r)] : bande continue (épaisseur `ep`, vers
    l'intérieur), patins à crampons tout autour et guides centraux."""
    env, total, seg = _chemin_chenille(cercles, ep)
    n = len(env)
    centre = (sum(p[0] for p in env) / n, sum(p[1] for p in env) / n)
    # Bande : anneau de quads entre le contour et le contour décalé vers l'intérieur.
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(env):
        q0, q1 = env[i - 1], env[(i + 1) % n]
        t = (q1[0] - q0[0], q1[1] - q0[1])
        lg = math.hypot(*t) or 1
        nrm = (t[1] / lg, -t[0] / lg)
        if nrm[0] * (p[0] - centre[0]) + nrm[1] * (p[1] - centre[1]) < 0:
            nrm = (-nrm[0], -nrm[1])
        q = (p[0] - nrm[0] * ep, p[1] - nrm[1] * ep)
        rings.append([bm.verts.new((x - larg / 2, p[0], p[1])), bm.verts.new((x + larg / 2, p[0], p[1])),
                      bm.verts.new((x + larg / 2, q[0], q[1])), bm.verts.new((x - larg / 2, q[0], q[1]))])
    for i in range(n):
        a_, b_ = rings[i], rings[(i + 1) % n]
        for k in range(4):
            bm.faces.new((a_[k], a_[(k + 1) % 4], b_[(k + 1) % 4], b_[k]))
    _ajouter(lot, 'fonte', bm)
    # Patins : un tous les ~0,32 unité le long du contour, posés à plat sur la bande.
    pas = 0.32
    nb = max(8, int(total / pas))
    pas = total / nb
    acc, i, d = 0.0, 0, 0.0
    for k in range(nb):
        cible = k * pas + pas / 2
        while acc + seg[i] < cible:
            acc += seg[i]
            i = (i + 1) % n
        f = (cible - acc) / seg[i]
        p0, p1 = env[i], env[(i + 1) % n]
        y = p0[0] + (p1[0] - p0[0]) * f
        z = p0[1] + (p1[1] - p0[1]) * f
        ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
        rot = Matrix.Rotation(ang, 3, 'X')
        lot.cube('acier_sombre', (larg + 0.04, pas * 0.82, 0.07), (x, y, z), 0 if leger else 0.012, rot)  # patin
        if not leger or k % 2 == 0:
            lot.cube('fonte', (larg * 0.5, pas * 0.3, 0.04), (x, y, z) , 0, rot)  # crampon
        # Guide central (côté intérieur), entre les deux moitiés des galets.
        inner = Vector((0, -math.sin(ang), math.cos(ang)))
        c = Vector((x, y, z))
        if inner.dot(Vector((0, centre[0] - y, centre[1] - z))) < 0:
            inner = -inner
        lot.cube('acier', (0.08, pas * 0.4, 0.14), tuple(c + inner * (ep + 0.07)), 0, rot)


def _galet(coll, nom, x, y, z, r, sg, seg):
    """Galet porteur double (deux disques de part et d'autre du guide de la chenille), bandage de caoutchouc, moyeu à
    boulons ; groupe `nom` qui tourne autour de X (le jeu le fait rouler)."""
    g = T.Lot(coll, nom)
    for s in (-1, 1):
        xa, xb = x + s * 0.08, x + s * 0.3
        g.tube('noir', (xa, y, z), (xb, y, z), r, seg)  # bandage
        g.tube('kaki_sombre', (xb, y, z), (xb + s * 0.02, y, z), r * 0.82, seg)  # flasque
        g.tube('acier_sombre', (xb + s * 0.02, y, z), (xb + s * 0.06, y, z), r * 0.3, sg)  # moyeu
        for k in range(6):
            a = 2 * math.pi * k / 6
            g.cube('acier', (0.04, 0.05, 0.05), (xb + s * 0.03, y + r * 0.55 * math.cos(a), z + r * 0.55 * math.sin(a)))
    g.finir()
    T.pivot(coll, 'pivot_' + nom, (x, y, z), (1, 0, 0))


def _roue_quad(coll, nom, c, r, larg, sg, seg, cote):
    """Roue de quad (groupe `nom`, pivot sur son axe X) : pneu ballon aux flancs arrondis, crampons en chevrons
    alternés, jante à cinq branches et moyeu. `cote` : +1 / -1 selon le côté (la jante regarde vers l'extérieur)."""
    g = T.Lot(coll, nom)
    x, y, z = c
    s = cote
    g.tube('noir', (x - larg / 2 + 0.05, y, z), (x + larg / 2 - 0.05, y, z), r, seg)  # bande de roulement
    for d in (-1, 1):  # flancs arrondis
        g.tube('noir', (x + d * (larg / 2 - 0.05), y, z), (x + d * larg / 2, y, z), r * 0.93, seg)
    n = 18 if seg < 20 else 24
    for k in range(n):  # crampons en chevrons
        a = 2 * math.pi * k / n
        for d in (-1, 1):
            dx = d * larg * 0.2
            g.cube('fonte', (larg * 0.34, 0.07, 0.045), (x + dx, y + (r + 0.012) * math.cos(a), z + (r + 0.012) * math.sin(a)),
                   0 if seg < 20 else 0.008, Matrix.Rotation(a + math.pi / 2, 3, 'X') @ Matrix.Rotation(d * 0.4, 3, 'Z'))
    xo = x + s * larg / 2
    g.tube('acier', (xo - s * 0.04, y, z), (xo + s * 0.01, y, z), r * 0.62, seg)  # jante
    g.tube('acier_sombre', (xo, y, z), (xo + s * 0.015, y, z), r * 0.5, seg)  # creux de la jante
    for k in range(5):  # branches
        a = 2 * math.pi * k / 5 + 0.3
        g.barre('acier', (xo + s * 0.02, y, z), (xo + s * 0.02, y + r * 0.5 * math.cos(a), z + r * 0.5 * math.sin(a)),
                0.07)
    g.tube('acier_sombre', (xo, y, z), (xo + s * 0.06, y, z), r * 0.18, sg)  # moyeu
    g.tube('jaune', (xo + s * 0.06, y, z), (xo + s * 0.075, y, z), r * 0.1, sg)  # cache-écrou
    g.finir()
    T.pivot(coll, 'pivot_' + nom, c, (1, 0, 0))


def _amortisseur(lot, a, b, sg):
    """Combiné ressort-amortisseur de `a` (bas) à `b` (haut) : corps, tige chromée, spires du ressort."""
    a, b = Vector(a), Vector(b)
    d = b - a
    lot.tube('acier_sombre', tuple(a), tuple(a + d * 0.55), 0.045, sg)
    lot.tube('acier', tuple(a + d * 0.5), tuple(b), 0.025, sg)
    for k in range(6):
        p = a + d * (0.2 + 0.12 * k)
        lot.tube('rouge', tuple(p - d.normalized() * 0.015), tuple(p + d.normalized() * 0.015), 0.085, sg)


def quad(coll, leger=True, electrique=False):
    """Quad : 1,9 m de long, 1,2 m de large ; selle à 0,85 m (le pilote est à califourchon), poignées à 1,04 m.

    Carrosserie verte en coques à pans (carénage avant à phares, garde-boues enveloppants, réservoir, coque arrière),
    selle longue rembourrée, châssis tubulaire apparent, moteur à ailettes et échappement à silencieux, suspension avant
    à doubles triangles et amortisseurs à ressort rouges, bras oscillant arrière, porte-bagages tubulaires avant et
    arrière (caisse), pare-buffle, marchepieds, feu arrière ; pneus ballon à crampons en chevrons.
    Pièces mobiles : `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard` (tournent autour de X).
    """
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    T.PALETTE.setdefault('vert_clair', '#62b46e')
    lot = T.Lot(coll, 'pieces')
    r, larg = 0.6, 0.46
    xr, yr = 0.9, 1.3
    # Châssis tubulaire : deux longerons, berceau moteur, montants de selle.
    for sx in (-1, 1):
        x = sx * 0.28
        lot.barre('acier_sombre', (x, -1.3, 0.85), (x, 1.3, 0.85), 0.07)
        lot.barre('acier_sombre', (x, -1.3, 0.85), (x * 0.8, -1.55, 1.25), 0.06)
        lot.barre('acier_sombre', (x, 1.3, 0.85), (x * 0.9, 1.55, 1.3), 0.06)
        lot.barre('acier_sombre', (x, 0.5, 0.85), (x * 0.9, 0.55, 1.45), 0.06)
        lot.barre('acier_sombre', (x, -0.45, 0.85), (x * 0.8, -0.55, 1.4), 0.06)
    for y in (-1.3, -0.45, 0.5, 1.3):
        lot.barre('acier_sombre', (-0.28, y, 0.85), (0.28, y, 0.85), 0.06)
    lot.cube('acier_sombre', (0.6, 0.9, 0.05), (0, -0.05, 0.6), 0.01)  # sabot de protection
    if not electrique:
        # Moteur à ailettes (monocylindre), carter, échappement vers l'arrière à droite (−X), silencieux.
        lot.cube('acier', (0.42, 0.55, 0.3), (0, -0.05, 0.78), 0.04)  # carter
        for k in range(6):
            lot.cube('acier', (0.36 - k * 0.02, 0.36, 0.035), (0, -0.15, 0.97 + k * 0.06), 0.008)  # ailettes du cylindre
        lot.tube('acier_sombre', (0, -0.15, 0.92), (0, -0.15, 1.3), 0.12, sg)
        lot.tube('acier', (-0.1, -0.35, 1.05), (-0.42, -0.2, 0.95), 0.05, sg)  # collecteur
        lot.tube('acier', (-0.42, -0.2, 0.95), (-0.42, 1.0, 1.05), 0.05, sg)
        lot.tube('fonte', (-0.42, 1.0, 1.05), (-0.42, 1.55, 1.2), 0.11, sg)  # silencieux
        lot.tube('acier', (-0.42, 1.55, 1.2), (-0.42, 1.62, 1.22), 0.06, sg)
    else:
        # Électrique : bloc batterie sous la selle (bandeau lumineux de charge), moteur-roue arrière, prise de charge.
        T.PALETTE.setdefault('quad_batterie', '#3a3f47')
        T.PALETTE.setdefault('quad_lueur', '#4fe0e8')
        lot.cube('quad_batterie', (0.5, 0.95, 0.42), (0, -0.05, 0.86), 0.05)
        for k in range(4):
            lot.cube('acier_sombre', (0.52, 0.04, 0.38), (0, -0.4 + k * 0.23, 0.86), 0.01)  # ailettes de refroidissement
        for sx in (-1, 1):
            lot.cube('quad_lueur', (0.012, 0.7, 0.05), (sx * 0.256, -0.05, 0.98), 0.004)
        lot.tube('acier_sombre', (-0.36, 1.3, 0.6), (0.36, 1.3, 0.6), 0.16, sg)  # moteur sur l'essieu arrière
        lot.tube('quad_lueur', (-0.37, 1.3, 0.6), (-0.39, 1.3, 0.6), 0.06, sg)
        lot.cube('acier_sombre', (0.04, 0.14, 0.12), (0.56, 0.4, 1.12), 0.01)  # trappe de la prise
        lot.cube('quad_lueur', (0.02, 0.06, 0.06), (0.585, 0.4, 1.12), 0.005)
    # Carénage avant : capot à pans coupés, nez qui plonge, deux phares encastrés.
    _tronc(lot, 'vert', [(-0.55, -1.75), (0.55, -1.75), (0.6, -0.75), (-0.6, -0.75)], 1.05,
           [(-0.42, -1.6), (0.42, -1.6), (0.48, -0.85), (-0.48, -0.85)], 1.45)
    _prisme(lot, 'vert_fonce', [(-1.82, 0.95), (-1.72, 1.08), (-1.6, 1.12), (-1.6, 0.95)], -0.5, 0.5)  # bec
    for sx in (-1, 1):
        lot.cube('fonte', (0.26, 0.06, 0.15), (sx * 0.28, -1.69, 1.25), 0.02, Matrix.Rotation(0.35, 3, 'X'))
        lot.cube('blanc', (0.2, 0.04, 0.1), (sx * 0.28, -1.715, 1.25), 0.015, Matrix.Rotation(0.35, 3, 'X'))  # phare
    # Garde-boues : larges coques qui partent de la caisse et couvrent le haut de chaque roue (de côté un arc de plaques,
    # retombant devant et derrière), rebord sombre à l'extérieur.
    for sx in (-1, 1):
        for yc in (-yr, yr):
            xa, xb = sx * 0.42, sx * (xr + larg / 2 + 0.07)
            prof = []
            for k in range(8):
                a = math.radians(28 + 124 * k / 7)
                prof.append((yc + (r + 0.13) * math.cos(a), r + (r + 0.13) * math.sin(a)))
            for k in range(7):
                (y0, z0), (y1, z1) = prof[k], prof[k + 1]
                rot = Matrix.Rotation(math.atan2(z1 - z0, y1 - y0), 3, 'X')
                lot.cube('vert', (abs(xb - xa), math.hypot(y1 - y0, z1 - z0) + 0.03, 0.07),
                         ((xa + xb) / 2, (y0 + y1) / 2, (z0 + z1) / 2), 0.015, rot)
                lot.cube('vert_fonce', (0.05, math.hypot(y1 - y0, z1 - z0) + 0.03, 0.12),
                         (xb, (y0 + y1) / 2, (z0 + z1) / 2 - 0.02), 0.01, rot)  # rebord
    # Réservoir entre la selle et le guidon, bouchon.
    _tronc(lot, 'vert', [(-0.32, -0.75), (0.32, -0.75), (0.34, -0.1), (-0.34, -0.1)], 1.3,
           [(-0.24, -0.68), (0.24, -0.68), (0.26, -0.15), (-0.26, -0.15)], 1.62)
    lot.tube('acier', (0, -0.45, 1.62), (0, -0.45, 1.67), 0.07, sg)
    # Coque arrière sous la selle, feu arrière.
    _tronc(lot, 'vert', [(-0.5, -0.1), (0.5, -0.1), (0.55, 1.75), (-0.55, 1.75)], 1.15,
           [(-0.38, -0.05), (0.38, -0.05), (0.42, 1.68), (-0.42, 1.68)], 1.45)
    lot.cube('rouge', (0.3, 0.04, 0.1), (0, 1.76, 1.32), 0.015)
    # Selle rembourrée en deux pans (assise et bossage), passepoil.
    _tronc(lot, 'noir', [(-0.27, -0.1), (0.27, -0.1), (0.29, 1.15), (-0.29, 1.15)], 1.45,
           [(-0.22, 0.0), (0.22, 0.0), (0.24, 1.05), (-0.24, 1.05)], 1.7)
    lot.cube('fonte', (0.5, 1.2, 0.03), (0, 0.52, 1.46))
    # Marchepieds (repose-pieds striés) et protège-pieds.
    for sx in (-1, 1):
        lot.cube('acier_sombre', (0.36, 0.75, 0.05), (sx * 0.52, -0.05, 0.92), 0.01)
        for k in range(5):
            lot.cube('fonte', (0.34, 0.03, 0.02), (sx * 0.52, -0.35 + k * 0.15, 0.955))
        lot.cube('vert_fonce', (0.06, 0.75, 0.25), (sx * 0.71, -0.05, 1.03), 0.01)
    # Suspension avant : doubles triangles et amortisseurs ; arrière : bras oscillant et amortisseurs.
    for sx in (-1, 1):
        xw = sx * (xr - larg / 2 - 0.02)
        for dz, z0 in ((0.12, 0.8), (-0.1, 0.62)):
            lot.barre('acier_sombre', (sx * 0.28, -yr - 0.18, z0), (xw, -yr, r + dz), 0.05)
            lot.barre('acier_sombre', (sx * 0.28, -yr + 0.18, z0), (xw, -yr, r + dz), 0.05)
        lot.cube('acier_sombre', (0.1, 0.12, 0.34), (xw, -yr, r), 0.02)  # porte-moyeu
        _amortisseur(lot, (xw * 0.85, -yr + 0.05, r + 0.1), (sx * 0.3, -yr + 0.15, 1.3), sg)
        lot.barre('acier_sombre', (sx * 0.28, 0.5, 0.75), (xw, yr, r), 0.07)  # bras oscillant
        _amortisseur(lot, (xw * 0.8, yr - 0.25, r + 0.15), (sx * 0.3, 0.9, 1.35), sg)
    lot.tube('acier_sombre', (-(xr - larg / 2), yr, r), (xr - larg / 2, yr, r), 0.06, sg)  # essieu arrière
    # Guidon : colonne, té, cintre, poignées, leviers, petit tableau de bord à compteur.
    lot.barre('acier_sombre', (0, -0.62, 1.2), (0, -0.62, 1.9), 0.08)
    lot.cube('acier_sombre', (0.24, 0.12, 0.08), (0, -0.62, 1.92), 0.02)
    for sx in (-1, 1):
        lot.barre('acier', (sx * 0.08, -0.62, 1.95), (sx * 0.22, -0.66, 2.05), 0.05)
        lot.barre('acier', (sx * 0.22, -0.66, 2.05), (sx * 0.44, -0.62, 2.08), 0.05)
        lot.tube('noir', (sx * 0.36, -0.62, 2.08), (sx * 0.5, -0.62, 2.08), 0.045, sg)  # poignée
        lot.tube('noir', (sx * 0.5, -0.62, 2.08), (sx * 0.52, -0.62, 2.08), 0.055, sg)
        lot.barre('acier_sombre', (sx * 0.3, -0.64, 2.1), (sx * 0.46, -0.72, 2.07), 0.025)  # levier
    lot.cube('fonte', (0.26, 0.16, 0.12), (0, -0.7, 2.0), 0.03, Matrix.Rotation(-0.5, 3, 'X'))  # tableau de bord
    lot.tube('blanc', (0, -0.76, 2.04), (0, -0.78, 2.03), 0.045, 10)  # compteur
    # Porte-bagages tubulaires (avant et arrière), caisse arrière, sangles ; pare-buffle avant.
    for yc, l, z in ((-1.25, 0.6, 1.5), (1.25, 0.75, 1.5)):
        y0, y1 = yc - l / 2, yc + l / 2
        for x in (-0.45, 0.45):
            lot.barre('acier_sombre', (x, y0, z), (x, y1, z), 0.04)
        for y in (y0, yc, y1):
            lot.barre('acier_sombre', (-0.45, y, z), (0.45, y, z), 0.04)
        for y in (y0 + 0.1, y1 - 0.1):
            for x in (-0.45, 0.45):
                lot.barre('acier_sombre', (x, y, z), (x * 0.7, y, z - 0.25), 0.035)
    lot.cube('bois', (0.62, 0.45, 0.32), (0, 1.3, 1.68), 0.02)
    lot.cube('bois_sombre', (0.65, 0.48, 0.05), (0, 1.3, 1.85), 0.01)
    lot.cube('fonte', (0.67, 0.04, 0.36), (0, 1.3, 1.68))  # sangle
    for sx in (-1, 1):
        lot.barre('acier_sombre', (sx * 0.38, -1.75, 0.8), (sx * 0.36, -1.95, 1.2), 0.06)
    lot.barre('acier_sombre', (-0.36, -1.95, 1.2), (0.36, -1.95, 1.2), 0.06)
    lot.barre('acier_sombre', (-0.38, -1.9, 0.85), (0.38, -1.9, 0.85), 0.06)
    # Roues : le côté +X est à gauche du pilote (le nom des groupes reste celui du jeu).
    for nom, x, y in (('roue_avg', -xr, -yr), ('roue_avd', xr, -yr), ('roue_arg', -xr, yr), ('roue_ard', xr, yr)):
        _roue_quad(coll, nom, (x, y, r), r, larg, sg, seg, 1 if x > 0 else -1)
    T.reperer(coll, 'siege', (0, 0.35, 1.7))
    lot.finir()
    _au_sol(coll)
    if electrique:
        # Carrosserie blanche et bleue au lieu du vert.
        T.PALETTE.setdefault('quad_blanc', '#e2e8ee')
        T.PALETTE.setdefault('quad_bleu', '#2f73b0')
        for o in coll.objects:
            if o.type == 'MESH':
                for i, m in enumerate(o.data.materials):
                    nom = m.name.split('.')[0]
                    if nom in ('vert', 'vert_clair'):
                        o.data.materials[i] = T.material('quad_blanc')
                    elif nom == 'vert_fonce':
                        o.data.materials[i] = T.material('quad_bleu')



def tank(coll, leger=True):
    """Char léger : 4,4 m de long (canon compris 6,2 m), 2,5 m de large, 2,4 m de haut. Le pilote se tient dans la
    tourelle du chef (le haut du corps dépasse de la trappe ouverte).

    Caisse à plaques inclinées (glacis, plaque de nez, flancs, arrière), garde-boues, phares grillagés, crochets de
    remorquage, chenilles à patins autour de cinq galets doubles par côté (groupes `roue_g1`… `roue_g5`, `roue_d1`…
    `roue_d5`, qui roulent), barbotin denté à l'arrière, roue tendeuse à l'avant, rouleaux porteurs, jupes ; trappe du
    pilote (à gauche, épiscopes), plage moteur grillagée, échappements à silencieux, outils et maillons de rechange.
    Tourelle (groupe `tourelle`, pivot vertical) à flancs inclinés : masque, canon à évacuateur de fumée et frein de
    bouche, tourelleau du chef (trappe ouverte) avec mitrailleuse, trappe du chargeur, lance-pots fumigènes, panier
    arrière avec bâche et jerricans, antenne.
    """
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    T.PALETTE.setdefault('kaki', '#6b6b3a')
    T.PALETTE.setdefault('kaki_clair', '#85854a')
    T.PALETTE.setdefault('kaki_sombre', '#4a4a28')
    T.PALETTE.setdefault('bache', '#7a7356')
    lot = T.Lot(coll, 'pieces')
    # --- Train de roulement ---------------------------------------------------------------------------------------
    xc, larg, ep = 1.95, 0.8, 0.12
    rg = 0.5  # rayon des galets
    zg = ep + rg
    ys = (-2.7, -1.35, 0.0, 1.35, 2.7)
    for sx, c in ((-1, 'd'), (1, 'g')):  # +X : la gauche du pilote
        x = sx * xc
        cercles = [(y, zg, rg) for y in ys]
        cercles += [(-3.75, 0.95, 0.38), (3.65, 1.0, 0.45)]  # roue tendeuse (avant), barbotin (arrière)
        cercles += [(y, 1.32, 0.13) for y in (-1.9, 0.0, 1.9)]  # rouleaux porteurs
        _chenille(coll, lot, x, cercles, larg, ep, sg, leger)
        for k, y in enumerate(ys):
            _galet(coll, f'roue_{c}{k + 1}', x, y, zg, rg, sg, seg)
            lot.barre('kaki_sombre', (x - sx * 0.35, y + 0.35, zg + 0.35), (x - sx * 0.35, y, zg), 0.12)  # bras
        # Roue tendeuse, barbotin denté, rouleaux porteurs (fixes).
        lot.tube('acier_sombre', (x - 0.32, -3.75, 0.95), (x + 0.32, -3.75, 0.95), 0.36, seg)
        lot.tube('acier', (x - 0.36, -3.75, 0.95), (x + 0.36, -3.75, 0.95), 0.12, sg)
        lot.tube('kaki_sombre', (x - 0.3, 3.65, 1.0), (x + 0.3, 3.65, 1.0), 0.38, seg)
        nd = 12
        for k in range(nd):
            a = 2 * math.pi * k / nd
            lot.cube('acier_sombre', (0.5, 0.1, 0.14), (x, 3.65 + 0.42 * math.cos(a), 1.0 + 0.42 * math.sin(a)), 0,
                     Matrix.Rotation(a + math.pi / 2, 3, 'X'))
        lot.tube('acier', (x - 0.34, 3.65, 1.0), (x + 0.34, 3.65, 1.0), 0.13, sg)
        for y in (-1.9, 0.0, 1.9):
            lot.tube('acier_sombre', (x - 0.25, y, 1.32), (x + 0.25, y, 1.32), 0.12, sg)
        # Jupe : plaques boulonnées au-dessus de la chenille, du garde-boue au haut des galets.
        for k in range(5):
            y0 = -3.4 + k * 1.38
            lot.cube('kaki', (0.05, 1.32, 0.5), (sx * (xc + larg / 2 + 0.08), y0 + 0.66, 1.42), 0.015)
            for dy in (0.15, 1.17):
                lot.tube('acier_sombre', (sx * (xc + larg / 2 + 0.105), y0 + dy, 1.58),
                         (sx * (xc + larg / 2 + 0.125), y0 + dy, 1.58), 0.03, 6)
    # --- Caisse ---------------------------------------------------------------------------------------------------
    # Partie basse entre les chenilles : plaque de nez inclinée, ventre, arrière incliné.
    _prisme(lot, 'kaki_sombre', [(-3.95, 1.68), (-3.45, 0.72), (-3.0, 0.5), (3.35, 0.5), (3.8, 0.95), (3.9, 1.68)],
            -1.45, 1.45)
    # Partie haute sur toute la largeur : glacis, toit, arrière.
    _prisme(lot, 'kaki', [(-3.98, 1.66), (-2.65, 2.22), (3.45, 2.22), (3.9, 1.95), (3.9, 1.66)], -2.45, 2.45)
    lot.cube('kaki_sombre', (4.98, 0.08, 0.06), (0, -2.65, 2.22), 0.01)  # arête du glacis
    # Garde-boues avant et arrière (au-delà de la caisse) et leurs pattes.
    for sx in (-1, 1):
        lot.cube('kaki', (larg + 0.2, 0.55, 0.05), (sx * xc, -4.22, 1.55), 0.01, Matrix.Rotation(-0.35, 3, 'X'))
        lot.cube('kaki', (larg + 0.2, 0.35, 0.05), (sx * xc, 4.05, 1.62), 0.01)
    # Phares grillagés, crochets de remorquage, maillons de rechange sur le glacis.
    for sx in (-1, 1):
        x = sx * 1.85
        lot.tube('acier_sombre', (x, -3.55, 2.0), (x, -3.68, 2.0), 0.13, 10)
        lot.tube('blanc', (x, -3.68, 2.0), (x, -3.7, 2.0), 0.1, 10)
        for k in range(3):
            lot.barre('acier_sombre', (x - 0.14 + k * 0.14, -3.72, 1.88), (x - 0.14 + k * 0.14, -3.72, 2.13), 0.025)
        lot.tube('fonte', (sx * 0.9, -3.75, 0.95), (sx * 0.9, -3.98, 0.95), 0.08, 8)  # crochets
        lot.cube('fonte', (0.08, 0.25, 0.08), (sx * 0.9, -4.0, 0.9), 0.01)
        lot.tube('fonte', (sx * 0.9, 3.85, 1.1), (sx * 0.9, 4.08, 1.1), 0.08, 8)
    for k in range(4):
        lot.cube('acier_sombre', (0.75, 0.2, 0.06), (-0.75, -3.6 + k * 0.22, 1.86 + k * 0.095), 0.01,
                 Matrix.Rotation(0.4, 3, 'X'))
    # Trappe du pilote (à gauche, +X) et épiscopes.
    lot.cube('kaki_sombre', (0.75, 0.6, 0.07), (0.8, -2.2, 2.25), 0.02)
    lot.tube('acier_sombre', (0.8, -2.2, 2.28), (0.8, -2.2, 2.32), 0.12, sg)
    for dx in (-0.25, 0.0, 0.25):
        lot.cube('fonte', (0.16, 0.1, 0.1), (0.8 + dx, -2.55, 2.27), 0.01)
        lot.cube('verre', (0.12, 0.02, 0.05), (0.8 + dx, -2.61, 2.28))
    # Plage moteur : grilles, bouchons de réservoir ; échappements et silencieux à l'arrière.
    for sx in (-1, 1):
        for k in range(6):
            lot.cube('fonte', (0.9, 0.08, 0.04), (sx * 0.75, 2.2 + k * 0.2, 2.24))
        lot.cube('kaki_sombre', (1.0, 1.25, 0.03), (sx * 0.75, 2.7, 2.225))
        lot.tube('acier_sombre', (sx * 1.9, 2.0, 2.22), (sx * 1.9, 2.0, 2.27), 0.1, sg)
        lot.tube('fonte', (sx * 0.6, 3.95, 1.45), (sx * 1.4, 3.95, 1.45), 0.16, sg)  # silencieux
        lot.tube('acier', (sx * 1.4, 3.95, 1.45), (sx * 1.55, 4.05, 1.52), 0.06, sg)
    # Outils sur l'aile gauche : pelle, pioche ; rondin de désembourbage à l'arrière ; jerricans sur l'aile droite.
    lot.barre('bois', (2.05, -1.4, 2.27), (2.05, 0.1, 2.27), 0.06)
    lot.cube('acier_sombre', (0.28, 0.32, 0.03), (2.05, 0.3, 2.27), 0.01)
    lot.barre('bois', (2.25, -1.2, 2.27), (2.25, 0.6, 2.27), 0.06)
    lot.cube('acier_sombre', (0.1, 0.55, 0.06), (2.25, 0.65, 2.27), 0.01)
    lot.cube('bois', (2.8, 0.22, 0.22), (0, 3.62, 2.36), 0.03)
    for y in (-1.0, -0.45):
        lot.cube('rouge', (0.4, 0.3, 0.45), (-2.05, y, 2.45), 0.03)
        lot.cube('acier_sombre', (0.06, 0.1, 0.06), (-2.05, y - 0.08, 2.7))
    # --- Tourelle -------------------------------------------------------------------------------------------------
    tr = T.Lot(coll, 'tourelle')
    zt = 2.22
    yt = 0.35
    tr.tube('kaki_sombre', (0, yt, zt), (0, yt, zt + 0.12), 1.35, seg)  # couronne
    bas = [(-1.0, -1.25), (1.0, -1.25), (1.5, -0.45), (1.5, 1.35), (1.15, 1.9), (-1.15, 1.9), (-1.5, 1.35),
           (-1.5, -0.45)]
    haut = [(x * 0.82, y * 0.85 + 0.12) for x, y in bas]
    z0, z1 = zt + 0.1, zt + 0.95
    _tronc(tr, 'kaki', [(x, y + yt) for x, y in bas], z0, [(x, y + yt) for x, y in haut], z1)
    # Masque du canon, canon (tube en deux sections), évacuateur de fumée, frein de bouche.
    ym = yt - 1.3
    tr.cube('kaki_clair', (1.15, 0.45, 0.6), (0, ym, zt + 0.52), 0.1)
    tr.tube('kaki_sombre', (0, ym - 0.2, zt + 0.52), (0, ym - 0.55, zt + 0.52), 0.22, sg)
    tr.tube('acier_sombre', (0, ym - 0.55, zt + 0.52), (0, ym - 2.2, zt + 0.52), 0.1, sg)
    tr.tube('kaki_sombre', (0, ym - 2.2, zt + 0.52), (0, ym - 2.75, zt + 0.52), 0.15, sg)  # évacuateur
    tr.tube('acier_sombre', (0, ym - 2.75, zt + 0.52), (0, ym - 3.7, zt + 0.52), 0.085, sg)
    tr.cube('acier_sombre', (0.36, 0.34, 0.22), (0, ym - 3.85, zt + 0.52), 0.03)  # frein de bouche
    for dy in (-0.08, 0.08):
        tr.cube('fonte', (0.38, 0.05, 0.14), (0, ym - 3.85 + dy, zt + 0.52))
    tr.tube('acier_sombre', (0.4, ym - 0.1, zt + 0.55), (0.4, ym - 0.35, zt + 0.55), 0.04, 8)  # mitrailleuse coaxiale
    # Tourelleau du chef (trappe ouverte, le pilote y est debout) et mitrailleuse sur pivot.
    xh, yh = 0.55, yt + 0.55
    zr = z1 + 0.18  # bord de la trappe
    tr.tube('kaki_sombre', (xh, yh, z1 - 0.02), (xh, yh, zr), 0.48, seg)
    for k in range(5):
        a = math.pi * 0.2 + 2 * math.pi * k / 6
        tr.cube('verre', (0.1, 0.04, 0.06), (xh + 0.47 * math.cos(a), yh + 0.47 * math.sin(a), zr - 0.08), 0,
                Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    tr.tube('noir', (xh, yh, zr), (xh, yh, zr + 0.01), 0.38, seg)
    tr.cube('kaki', (0.7, 0.08, 0.7), (xh, yh + 0.52, zr + 0.33), 0.02, Matrix.Rotation(-0.25, 3, 'X'))  # couvercle
    tr.barre('acier_sombre', (xh - 0.55, yh - 0.1, zr - 0.1), (xh - 0.55, yh - 0.1, zr + 0.25), 0.06)
    tr.tube('acier_sombre', (xh - 0.55, yh, zr + 0.3), (xh - 0.55, yh - 1.0, zr + 0.3), 0.035, sg)
    tr.cube('acier_sombre', (0.12, 0.45, 0.16), (xh - 0.55, yh - 0.1, zr + 0.28), 0.01)
    tr.cube('kaki_sombre', (0.1, 0.18, 0.2), (xh - 0.62, yh - 0.05, zr + 0.24), 0.01)  # caisse à munitions
    # Trappe du chargeur (fermée), épiscope, crochets de levage.
    tr.cube('kaki_sombre', (0.6, 0.55, 0.06), (-0.6, yt + 0.5, z1 + 0.02), 0.02)
    tr.cube('fonte', (0.18, 0.1, 0.1), (-0.6, yt + 0.15, z1 + 0.06), 0.01)
    for x, y in ((1.0, yt - 0.8), (-1.0, yt - 0.8), (1.0, yt + 1.4), (-1.0, yt + 1.4)):
        tr.barre('acier_sombre', (x, y - 0.1, z1 + 0.02), (x, y + 0.1, z1 + 0.02), 0.04)
    # Lance-pots fumigènes de chaque côté.
    for sx in (-1, 1):
        for k in range(3):
            tr.tube('acier_sombre', (sx * 1.38, yt - 0.55 + k * 0.17, zt + 0.55),
                    (sx * 1.62, yt - 0.65 + k * 0.17, zt + 0.72), 0.06, 8)
    # Panier arrière : cadre, bâche roulée, jerricans ; antenne.
    yb = yt + 2.15
    tr.cube('fonte', (2.1, 0.5, 0.04), (0, yb, zt + 0.45))
    for x in (-1.05, 1.05):
        tr.barre('acier_sombre', (x, yb - 0.25, zt + 0.47), (x, yb + 0.25, zt + 0.47), 0.04)
        tr.barre('acier_sombre', (x, yb + 0.25, zt + 0.47), (x, yb + 0.25, zt + 0.75), 0.04)
    tr.barre('acier_sombre', (-1.05, yb + 0.25, zt + 0.75), (1.05, yb + 0.25, zt + 0.75), 0.04)
    tr.tube('bache', (-0.9, yb, zt + 0.62), (0.3, yb, zt + 0.62), 0.17, sg)
    tr.cube('rouge', (0.4, 0.3, 0.42), (0.7, yb, zt + 0.68), 0.03)
    tr.barre('acier_sombre', (-0.95, yt + 1.6, z1), (-1.0, yt + 1.7, z1 + 1.4), 0.03)  # antenne
    tr.finir()
    T.pivot(coll, 'pivot_tourelle', (0, yt, zt), (0, 0, 1))
    # Pilote debout dans le tourelleau : « siège » placé pour que ses hanches soient sous le bord de la trappe.
    T.reperer(coll, 'siege', (xh, yh, zr - 0.76))
    lot.finir()
    _au_sol(coll)


def _roue_douce(coll, nom, c, r, larg, n, seg):
    """Roue de camionnette (groupe `nom`) au style doux : pneu arrondi, jante claire, moyeu ; pivot sur son axe (X)."""
    g = T.Lot(coll, nom)
    x, y, z = c
    s = 1 if x > 0 else -1
    secs = []
    for k, (dx, rr) in enumerate(((-0.5, 0.82), (-0.42, 0.97), (-0.2, 1.0), (0.2, 1.0), (0.42, 0.97), (0.5, 0.82))):
        secs.append(((x + dx * larg, y, z), Vector((0, 1, 0)), Vector((0, 0, 1)), r * rr, r * rr, r * rr))
    O._loft(g, 'pneu', secs, max(3, seg // 4))
    O._cyl(g, 'jante', (x + s * larg * 0.38, y, z), (x + s * larg * 0.52, y, z), r * 0.58, max(3, seg // 4))
    O._cyl(g, 'benne_sombre', (x + s * larg * 0.5, y, z), (x + s * larg * 0.58, y, z), r * 0.22, 2)
    for k in range(5):
        a = 2 * math.pi * k / 5
        g.cube('benne_sombre', (0.04, 0.05, 0.05), (x + s * larg * 0.53, y + r * 0.4 * math.cos(a), z + r * 0.4 * math.sin(a)))
    g.finir()
    T.pivot(coll, 'pivot_' + nom, c, (1, 0, 0))


def camionnette(coll, leger=True):
    """Camionnette à benne (camion benne) au style doux : environ 1,7 m de large, 4 m de long (avant = -Y).

    Cabine orangée arrondie (vitres, rétroviseurs, phares, calandre, pare-chocs), châssis sombre, benne basculante en
    acier gris à nervures et ridelles, feux rouges à l'arrière. Volant à gauche (+X), siège du conducteur `siege`.
    Pièces mobiles : `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard`. Plateau de la benne (lu par le jeu pour poser les
    icônes du chargement) : centre à Y = +1,3, hauteur 1,42, 2,3 × 3,3 (unités).
    """
    n = 3 if leger else 5
    seg = 14 if leger else 24
    lot = T.Lot(coll, 'carrosserie')
    r, larg = 0.78, 0.5
    xr, yav, yar = 1.42, -2.35, 2.0
    # Châssis.
    for sx in (-1, 1):
        O._rond(lot, 'benne_sombre', (sx * 0.75, -3.1, 1.0), (sx * 0.75, 3.15, 1.0), 0.14, 0.18, n)
    O._rond(lot, 'benne_sombre', (0, 3.1, 0.95), (0, 3.3, 0.95), 1.6, 0.16, n, k=0.04)  # pare-chocs arrière
    # Capot et avant.
    O._rond(lot, 'camion', (0, -2.35, 1.75), (0, -3.45, 1.7), 1.48, 0.52, n, k=0.12)
    O._rond(lot, 'benne_sombre', (0, -3.4, 1.55), (0, -3.5, 1.55), 1.05, 0.3, n, k=0.04)  # calandre
    for i in range(4):
        lot.cube('benne', (1.9, 0.04, 0.05), (0, -3.52, 1.36 + i * 0.13), 0.01)
    O._rond(lot, 'benne_sombre', (0, -3.45, 1.02), (0, -3.68, 1.02), 1.62, 0.2, n, k=0.05)  # pare-chocs avant
    for sx in (-1, 1):
        O._cyl(lot, 'benne', (sx * 1.15, -3.42, 1.72), (sx * 1.15, -3.5, 1.72), 0.2, n)
        O._cyl(lot, 'phare', (sx * 1.15, -3.5, 1.72), (sx * 1.15, -3.52, 1.72), 0.15, n)
    # Cabine : grande boîte arrondie, vitres, toit.
    O._rond(lot, 'camion', (0, -0.6, 2.25), (0, -2.45, 2.25), 1.52, 1.1, n, k=0.18)
    O._rond(lot, 'camion_clair', (0, -0.75, 3.38), (0, -2.25, 3.38), 1.4, 0.06, n, k=0.04)  # toit
    O._rond(lot, 'verre', (0, -2.43, 2.75), (0, -2.47, 2.75), 1.3, 0.42, n, k=0.02)  # pare-brise
    for sx in (-1, 1):
        O._rond(lot, 'verre', (sx * 1.52, -1.0, 2.75), (sx * 1.52, -2.15, 2.75), 0.03, 0.4, n, k=0.02)  # vitres latérales
        O._rond(lot, 'benne_sombre', (sx * 1.6, -2.3, 2.7), (sx * 1.85, -2.3, 2.7), 0.04, 0.04, n, k=0.01)  # bras
        O._rond(lot, 'benne_sombre', (sx * 1.88, -2.25, 2.7), (sx * 1.88, -2.35, 2.7), 0.1, 0.22, n, k=0.03)  # rétro
        lot.cube('benne_sombre', (0.06, 0.4, 0.05), (sx * 1.53, -1.5, 2.2), 0.01)  # poignée
    # Garde-boue.
    for sx in (-1, 1):
        for y in (yav, yar):
            O._rond(lot, 'benne_sombre', (sx * xr, y - 0.95, r + 0.95), (sx * xr, y + 0.95, r + 0.95), larg * 0.62, 0.06, n,
                    k=0.03)
    # Volant à gauche, sièges (vus par les vitres).
    O._cyl(lot, 'pneu', (0.62, -1.95, 2.55), (0.62, -1.88, 2.62), 0.26, n)
    for sx in (-1, 1):
        O._rond(lot, 'pneu', (sx * 0.62, -1.15, 2.0), (sx * 0.62, -1.55, 2.0), 0.36, 0.1, n, k=0.04)
        O._rond(lot, 'pneu', (sx * 0.62, -0.9, 2.0), (sx * 0.62, -0.9, 2.8), 0.36, 0.08, n, k=0.04)
    # Échappement vertical derrière la cabine.
    O._cyl(lot, 'benne', (-1.35, -0.45, 1.6), (-1.35, -0.45, 3.6), 0.08, n)
    # Benne : fond, ridelles, panneau avant haut (protège la cabine), hayon, nervures.
    lot_b = T.Lot(coll, 'benne')
    O._rond(lot_b, 'benne', (0, -0.35, 1.32), (0, 2.95, 1.32), 1.2, 0.1, n, k=0.03)
    for sx in (-1, 1):
        O._rond(lot_b, 'benne', (sx * 1.2, -0.35, 1.85), (sx * 1.2, 2.95, 1.85), 0.06, 0.5, n, k=0.03)
        for y in (0.2, 0.9, 1.6, 2.3):
            O._rond(lot_b, 'benne_sombre', (sx * 1.27, y, 1.4), (sx * 1.27, y, 2.32), 0.03, 0.05, n, k=0.01)
        O._rond(lot_b, 'benne_sombre', (sx * 1.25, -0.35, 2.36), (sx * 1.25, 2.95, 2.36), 0.07, 0.04, n, k=0.02)
    O._rond(lot_b, 'benne', (0, -0.38, 2.15), (0, -0.28, 2.15), 1.26, 0.82, n, k=0.03)  # panneau avant
    O._rond(lot_b, 'benne', (0, 2.92, 1.85), (0, 2.99, 1.85), 1.26, 0.5, n, k=0.02)  # hayon
    for sx in (-1, 1):
        O._rond(lot_b, 'feu', (sx * 1.35, 3.28, 1.18), (sx * 1.35, 3.33, 1.18), 0.16, 0.08, n, k=0.02)
    # Roues.
    for nom, x, y in (('roue_avg', xr, yav), ('roue_avd', -xr, yav), ('roue_arg', xr, yar), ('roue_ard', -xr, yar)):
        _roue_douce(coll, nom, (x, y, r), r, larg, n, seg)
    T.reperer(coll, 'siege', (0.62, -1.35, 2.05))
    lot.finir()
    lot_b.finir()
    O._brillant()
    T.adoucir(coll)
    _au_sol(coll)


def _roue_bois(coll, nom, c, r, larg, n, rayons):
    """Roue de charrette en bois (groupe `nom`) : jante, rayons, moyeu ; pivot sur son axe (X)."""
    g = T.Lot(coll, nom)
    x, y, z = c
    # Jante : un anneau de segments de bois (on voit les rayons au travers).
    m = 16 if n <= 3 else 24
    for k in range(m):
        a0, a1 = 2 * math.pi * k / m, 2 * math.pi * (k + 1.08) / m
        rr = r * 0.91
        g.barre('bois_roue', (x, y + rr * math.cos(a0), z + rr * math.sin(a0)), (x, y + rr * math.cos(a1), z + rr * math.sin(a1)),
                r * 0.17, 0.02)
    for k in range(rayons):
        a = 2 * math.pi * k / rayons
        g.barre('bois_roue', (x, y, z), (x, y + r * 0.86 * math.cos(a), z + r * 0.86 * math.sin(a)), 0.07, 0.015)
    O._cyl(g, 'bois_sombre', (x - larg * 0.9, y, z), (x + larg * 0.9, y, z), r * 0.18, 2)
    g.finir()
    T.pivot(coll, 'pivot_' + nom, c, (1, 0, 0))


def charrette(coll, leger=True):
    """Charrette à bras en bois (poussée à pied), environ 1,1 m de large (avant = -Y, brancards vers l'arrière +Y).

    Caisse en planches sur deux grandes roues en bois à rayons, ridelles basses, béquille à l'avant, deux brancards qui
    finissent en poignées à hauteur de main. Pièces mobiles : `roue_g`, `roue_d`. Plateau (lu par le jeu pour poser les
    icônes du chargement) : centre à Y = -0,3, hauteur 1,2, 1,6 × 2,2 (unités).
    """
    n = 3 if leger else 5
    lot = T.Lot(coll, 'caisse')
    r, larg = 0.68, 0.12
    xr, yr = 1.02, 0.0
    # Fond en planches.
    for i in range(5):
        x = -0.72 + i * 0.36
        O._rond(lot, 'planche_charrette' if i % 2 == 0 else 'planche_charrette_claire', (x, -1.4, 1.1), (x, 0.8, 1.1),
                0.17, 0.05, n, k=0.02)
    for y in (-1.25, -0.3, 0.65):
        O._rond(lot, 'bois_roue', (-0.95, y, 0.99), (0.95, y, 0.99), 0.08, 0.07, n, k=0.02)
    # Ridelles basses : deux planches de chaque côté, devant et derrière.
    for sx in (-1, 1):
        for z, t in ((1.28, 'planche_charrette'), (1.5, 'planche_charrette_claire')):
            O._rond(lot, t, (sx * 0.86, -1.42, z), (sx * 0.86, 0.82, z), 0.04, 0.1, n, k=0.02)
        for y in (-1.38, -0.3, 0.78):
            O._rond(lot, 'bois_roue', (sx * 0.9, y, 1.12), (sx * 0.9, y, 1.66), 0.05, 0.05, n, k=0.015)
    for y, sgn in ((-1.44, 1), (0.84, -1)):
        for z, t in ((1.28, 'planche_charrette_claire'), (1.5, 'planche_charrette')):
            O._rond(lot, t, (-0.86, y, z), (0.86, y, z), 0.04, 0.1, n, k=0.02)
    # Essieu, béquille avant.
    O._cyl(lot, 'bois_sombre', (-1.05, yr, r), (1.05, yr, r), 0.06, n)
    for sx in (-1, 1):
        O._rond(lot, 'bois_roue', (sx * 0.6, yr, r), (sx * 0.6, yr, 1.0), 0.06, 0.08, n, k=0.02)
    O._rond(lot, 'bois_roue', (0, -1.2, 1.0), (0, -1.3, 0.0), 0.07, 0.07, n, k=0.02)
    # Brancards et poignées (vers l'arrière, à hauteur de main).
    for sx in (-1, 1):
        O._rond(lot, 'bois_roue', (sx * 0.62, -1.3, 0.97), (sx * 0.62, 0.95, 0.97), 0.06, 0.07, n, k=0.02)  # sous la caisse
        O._rond(lot, 'bois_roue', (sx * 0.62, 0.88, 0.97), (sx * 0.68, 2.4, 1.72), 0.06, 0.07, n, k=0.02)  # vers les mains
        O._cyl(lot, 'bois_sombre', (sx * 0.69, 2.3, 1.7), (sx * 0.71, 2.65, 1.78), 0.075, n)
    O._rond(lot, 'bois_roue', (-0.66, 1.9, 1.6), (0.66, 1.9, 1.6), 0.04, 0.05, n, k=0.015)  # traverse
    for nom, x in (('roue_g', xr), ('roue_d', -xr)):
        _roue_bois(coll, nom, (x, yr, r), r, larg, n, 8 if leger else 10)
    lot.finir()
    T.adoucir(coll)
    _au_sol(coll)


MODELES = {
    'quad_electrique': lambda c, leger=True: quad(c, leger, electrique=True),
    'buggy': buggy,
    'quad': quad,
    'tank': tank,
    'camionnette': camionnette,
    'charrette': charrette,
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
