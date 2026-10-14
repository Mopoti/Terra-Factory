"""Outils communs des modèles 3D de Terra Factory (Blender, Python).

Conventions (voir blender/README.md) :
- 1 unité Blender = 1 case du jeu = 50 cm x 50 cm. Une foreuse de 4 x 4 cases mesure donc 4 x 4 unités.
- Z est le haut. Le modèle est centré sur (0, 0) et posé sur Z = 0.
- L'AVANT (la sortie de la machine) est du côté -Y de Blender (vue de face, touche 1) : à l'export (Y haut) c'est +Z,
  c'est-à-dire l'orientation 0 du jeu (sortie vers +z).
- Un modèle = une collection Blender, nommée comme le fichier exporté (minuscules, sans accents : foreuse_t1).
- À l'export, le modèle est mis à l'échelle 0,5 : le .glb est en mètres (1 unité du .glb = 1 m), comme Unity et three.js.
"""

import math
import os
import random

import bpy  # doit venir avant bmesh quand bpy est installé comme module Python
import bmesh
from mathutils import Matrix, Vector

CELL_M = 0.5  # taille d'une case du jeu, en mètres

# Palette commune : tous les modèles s'y servent, pour garder un style cohérent.
PALETTE = {
    'acier': '#8a929c',
    'acier_sombre': '#4a5058',
    'fonte': '#2f3338',
    'cuivre': '#c4743b',
    'orange': '#c98a2d',
    'rouge': '#b8403a',
    'jaune': '#e0b83a',
    'bleu': '#3f78b5',
    'vert': '#4f9a5b',
    'blanc': '#dfe3e8',
    'noir': '#18191c',
    'brique': '#8c4a38',
    'brique_claire': '#a85d42',
    'brique_sombre': '#6a372b',
    'pierre': '#6e6862',
    'pierre_claire': '#8a837b',
    'pierre_sombre': '#4e4a46',
    'bois_sombre': '#5e4630',
    'braise': '#f0701e',
    'flamme': '#ffc93c',
    'beton': '#9a958c',
    'gris_clair': '#b4bcc6',
    'cyan': '#46d9e0',
    'panneau': '#243a5e',
    'verre': '#7fb7d4',
    'bois': '#8a6a45',
    'vert_fonce': '#3f5a45',  # fonte peinte des machines à vapeur
    'eau': '#4f97c0',
    'boue': '#6d5a44',
    'rive_t1': '#f5d21e',     # rives des convoyeurs T1 (jaune franc)
    'rive_t2': '#f39200',     # rives des convoyeurs rapides T2 (orange franc)
    'rive_t3': '#c9302c',     # rives des convoyeurs express T3 (rouge)
    'separateur': '#5b7fa6',  # séparateur (bleu acier)
    'groupeur': '#8a6aa0',    # groupeur (mauve)
    'trieur': '#2a8f8a',      # trieur (sarcelle : couleur du tri, comme le bras filtrant)
    'bras_t3': '#22a397',     # bras filtrant T3 (sarcelle)
}


def reset() -> None:
    """Scène vide (unités en mètres, échelle 1 : l'échelle 0,5 est appliquée seulement à l'export)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def _linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name: str) -> bpy.types.Material:
    """Matériau uni de la palette (créé une fois)."""
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    hexa = PALETTE[name].lstrip('#')
    r, g, b = (int(hexa[i : i + 2], 16) / 255 for i in (0, 2, 4))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    # Par type, pas par nom : le nom du nœud est traduit selon la langue de Blender (« BSDF guidée » en français).
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (_linear(r), _linear(g), _linear(b), 1.0)
    bsdf.inputs['Roughness'].default_value = 0.75
    bsdf.inputs['Metallic'].default_value = 0.0
    m.diffuse_color = (_linear(r), _linear(g), _linear(b), 1.0)
    return m


def collection(name: str) -> bpy.types.Collection:
    """Collection d'un modèle (une collection = un .glb exporté)."""
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def _object(coll: bpy.types.Collection, name: str, bm: bmesh.types.BMesh, mat: str) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material(mat))
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def _cube(bm, size, loc, bevel=0.0, rot=None):
    """Ajoute à `bm` un cube de `size` centré en `loc`, arêtes biseautées de `bevel` (style low poly), tourné par `rot`."""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
    if bevel > 0:
        bevel = min(bevel, min(size) * 0.45)
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bevel, segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    if rot is not None:
        bmesh.ops.rotate(tmp, cent=Vector((0, 0, 0)), matrix=rot, verts=tmp.verts)
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    mesh = bpy.data.meshes.new('_tmp')
    tmp.to_mesh(mesh)
    tmp.free()
    bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def box(coll, name, size, loc, mat, bevel=0.0):
    """Boîte de `size` (x, y, z) dont le CENTRE est en `loc` ; `bevel` > 0 biseaute les arêtes."""
    bm = bmesh.new()
    _cube(bm, size, loc, bevel)
    return _object(coll, name, bm, mat)


def _verse(tmp, bm):
    """Ajoute le contenu du bmesh `tmp` dans `bm`, puis libère `tmp`."""
    mesh = bpy.data.meshes.new('_tmp')
    tmp.to_mesh(mesh)
    tmp.free()
    bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


class Lot:
    """Regroupe beaucoup de petites pièces par teinte : un objet par teinte au lieu d'un objet par pièce."""

    def __init__(self, coll, name):
        self.coll, self.name, self.bms = coll, name, {}

    def cube(self, mat, size, loc, bevel=0.0, rot=None):
        _cube(self.bms.setdefault(mat, bmesh.new()), size, loc, bevel, rot)

    def tube(self, mat, a, b, r, seg=8):
        """Tube rond de rayon `r` du point `a` au point `b` (tuyaux)."""
        a, b = Vector(a), Vector(b)
        d = b - a
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=d.length)
        bmesh.ops.rotate(tmp, cent=Vector((0, 0, 0)), matrix=Vector((0, 0, 1)).rotation_difference(d).to_matrix(), verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=(a + b) / 2, verts=tmp.verts)
        _verse(tmp, self.bms.setdefault(mat, bmesh.new()))

    def boule(self, mat, p, r):
        """Petite sphère à facettes (coudes de tuyaux, rotules)."""
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=r)
        bmesh.ops.translate(tmp, vec=Vector(p), verts=tmp.verts)
        _verse(tmp, self.bms.setdefault(mat, bmesh.new()))

    def barre(self, mat, a, b, ep, bevel=0.0):
        """Pièce droite de section carrée `ep` allant du point `a` au point `b` (câble, tuyau, poutre)."""
        a, b = Vector(a), Vector(b)
        d = b - a
        rot = Vector((1, 0, 0)).rotation_difference(d).to_matrix()
        self.cube(mat, (d.length, ep, ep), (a + b) / 2, bevel, rot)

    def finir(self):
        for mat, bm in self.bms.items():
            _object(self.coll, f'{self.name}_{mat}', bm, mat)
        self.bms = {}


BRIQUES = (('brique', 5), ('brique_claire', 3), ('brique_sombre', 3), ('pierre', 1))
PIERRES = (('pierre', 4), ('pierre_claire', 2), ('pierre_sombre', 3))


def parement(lot, faces, rangs, seed=1, densite=0.65, teintes=BRIQUES, long=(0.32, 0.44), haut=(0.14, 0.17), bevel=0.012):
    """Briques ou pierres en relief, en quinconce et de teintes variées, posées sur des faces verticales.

    `faces` : liste de (axe, position, debut, fin, sens). axe 'x' = face perpendiculaire à X placée en x = position,
    les pièces allant de `debut` à `fin` le long de Y (axe 'y' : l'inverse) ; `sens` = +1 ou -1 (côté où elles dépassent).
    `rangs` : hauteurs (centres) des rangées. Reproductible grâce à `seed`.
    """
    rnd = random.Random(seed)
    noms, poids = zip(*teintes)
    for axe, pos, debut, fin, sens in faces:
        for r, z in enumerate(rangs):
            u = debut + (0.0 if r % 2 == 0 else (long[0] + long[1]) / 4)
            while u < fin - 0.12:
                ln = min(rnd.uniform(*long), fin - u)
                if rnd.random() < densite:
                    h = rnd.uniform(*haut)
                    ep = rnd.uniform(0.03, 0.06)
                    a, zc = u + ln / 2, z + rnd.uniform(-0.01, 0.01)
                    if axe == 'x':
                        taille, centre, ax = (ep, ln - 0.04, h), (pos + sens * ep / 2, a, zc), 'X'
                    else:
                        taille, centre, ax = (ln - 0.04, ep, h), (a, pos + sens * ep / 2, zc), 'Y'
                    rot = Matrix.Rotation(rnd.uniform(-0.05, 0.05), 3, ax)
                    lot.cube(rnd.choices(noms, poids)[0], taille, centre, bevel, rot)
                u += ln


def cylinder(coll, name, radius, height, loc, mat, segments=12, radius_top=None):
    """Cylindre (ou tronc de cône si `radius_top`) vertical, centré en `loc`."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=height,
    )
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return _object(coll, name, bm, mat)


def carre_arrondi(demi, rayon, z, n_coin=4):
    """Points (x, y, z) d'un carré arrondi : demi-largeur `demi`, coins de rayon `rayon`, `n_coin` segments par coin."""
    rayon = min(rayon, demi)
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy = sx * (demi - rayon), sy * (demi - rayon)
        for i in range(n_coin + 1):
            a = math.radians(90 * k + 90 * i / n_coin)
            pts.append((cx + rayon * math.cos(a), cy + rayon * math.sin(a), z))
    return pts


def lissage(coll, name, anneaux, mat, fond=False, dessus=True, n_coin=4):
    """Forme lissée : empile des carrés arrondis `anneaux` = [(demi, rayon, z), ...] (de bas en haut) et les relie.

    Sert aux dômes, cloches, socles aux angles arrondis. `fond` / `dessus` ferment le bas / le haut.
    """
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in carre_arrondi(d, r, z, n_coin)] for d, r, z in anneaux]
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if dessus:
        bm.faces.new(rings[-1])
    if fond:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def convoyeur(lot, a, b, largeur=0.36, rp=0.08, rouleaux=2, sg=8, tambours=True):
    """Convoyeur à bande COMMUN à tous les modèles, de l'axe du tambour `a` à celui du tambour `b` (pente libre).

    Provisoire : il sera remplacé par le modèle commun du convoyeur du jeu. Tout convoyeur d'un modèle doit passer par
    cette fonction (même aspect partout, un seul endroit à changer). Pose dans `lot` : brin porteur et brin de retour
    (noir), longerons (acier sombre), rives jaunes, `rouleaux` rouleaux porteurs, tambours aux deux bouts.
    Retourne (d, w, n, rot) : direction de la bande, côté, normale (vers le haut) et rotation des pièces
    (X local = sens de la bande, Y = largeur, Z = normale), pour poser tasseaux et marchandises dessus.
    """
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    w = d.cross(Vector((0, 0, 1)))
    w = w.normalized() if w.length > 1e-6 else Vector((1, 0, 0))
    n = w.cross(d).normalized()
    if n.z < 0:
        n, w = -n, -w
    rot = Matrix((d, w, n)).transposed()
    lg = (b - a).length
    m = (a + b) / 2
    lot.cube('noir', (lg, largeur, 0.02), tuple(m + n * rp), 0, rot)  # brin porteur
    lot.cube('noir', (lg, largeur, 0.02), tuple(m - n * rp), 0, rot)  # brin de retour
    for s in (-1, 1):
        c = m + w * (s * (largeur / 2 + 0.05))
        lot.cube('acier_sombre', (lg + 0.1, 0.04, 0.12), tuple(c), 0, rot)  # longerons
        lot.cube('jaune', (lg - 0.1, 0.045, 0.03), tuple(c + n * 0.07), 0, rot)  # rives
    for k in range(rouleaux):  # rouleaux porteurs
        p = a + d * (0.2 + (lg - 0.4) * (k + 0.5) / rouleaux) + n * (rp - 0.035)
        lot.tube('acier', p - w * (largeur / 2), p + w * (largeur / 2), 0.03, 6)
    if tambours:
        for c in (a, b):
            lot.tube('acier_sombre', c - w * (largeur / 2 + 0.02), c + w * (largeur / 2 + 0.02), rp, sg)
            lot.tube('acier', c - w * (largeur / 2 + 0.06), c + w * (largeur / 2 + 0.06), 0.025, 6)
    return d, w, n, rot


def poteau_electrique(lot, pied, niveau=2, hauteur=2.3, sg=8):
    """Poteau électrique (« antenne ») COMMUN à tous les modèles, posé au point `pied` (x, y, z du sol).

    Provisoire : il sera remplacé par le vrai modèle des poteaux T1 / T2 du jeu. Toute machine qui montre son
    raccordement électrique doit passer par cette fonction (même aspect partout, un seul endroit à changer).
    `niveau` 1 = poteau en bois à une traverse ; 2 = mât en acier, traverse, isolateurs et feu cyan au sommet.
    Pose les pièces dans `lot` et retourne la liste des points d'accroche des câbles (haut des isolateurs).
    """
    x, y, z = pied
    h = hauteur
    if niveau <= 1:
        lot.cube('bois', (0.1, 0.1, h), (x, y, z + h / 2))
        lot.cube('bois', (0.5, 0.07, 0.07), (x, y, z + h - 0.15))
        for dx in (-0.2, 0.2):
            lot.tube('blanc', (dx + x, y, z + h - 0.115), (dx + x, y, z + h - 0.04), 0.025, sg)
        return [Vector((x + dx, y, z + h - 0.04)) for dx in (-0.2, 0.2)]
    lot.cube('acier_sombre', (0.24, 0.24, 0.04), (x, y, z + 0.02))  # platine
    lot.cube('acier', (0.09, 0.09, h - 0.04), (x, y, z + 0.04 + (h - 0.04) / 2))  # mât
    for k in range(4):  # goussets
        a = math.pi / 2 * k
        lot.cube('acier', (0.07, 0.015, 0.12), (x + 0.07 * math.cos(a), y + 0.07 * math.sin(a), z + 0.1), 0.0,
                 Matrix.Rotation(a, 3, 'Z'))
    lot.cube('jaune', (0.095, 0.095, 0.3), (x, y, z + 0.6))  # bande de repérage
    zt = z + h - 0.25
    yt = y - 0.08  # traverse fixée devant le mât (côté -Y)
    lot.cube('acier_sombre', (0.6, 0.07, 0.06), (x, yt, zt))
    lot.cube('acier_sombre', (0.04, 0.04, 0.07), (x, y - 0.05, zt))  # attache
    for dx in (-0.25, 0.0, 0.25):  # isolateurs empilés
        for k in range(3):
            lot.tube('blanc', (x + dx, yt, zt + 0.03 + k * 0.035), (x + dx, yt, zt + 0.05 + k * 0.035), 0.03, sg)
    lot.tube('acier_sombre', (x, y, z + h - 0.04), (x, y, z + h), 0.05, sg)
    lot.boule('cyan', (x, y, z + h + 0.03), 0.045)  # feu du niveau 2
    return [Vector((x + dx, yt, zt + 0.12)) for dx in (-0.25, 0.0, 0.25)]


def tour(coll, name, profil, mat, segments=16, centre=(0.0, 0.0), fond=True, dessus=True):
    """Pièce de révolution autour d'un axe vertical (cornue, poche de coulée, bagues) : `profil` = [(rayon, z), ...] de
    bas en haut. `fond` / `dessus` ferment le bas / le haut."""
    bm = bmesh.new()
    rings = [[bm.verts.new((centre[0] + r * math.cos(2 * math.pi * i / segments),
                            centre[1] + r * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)]
             for r, z in profil]
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if dessus:
        bm.faces.new(rings[-1])
    if fond:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def helice(coll, name, centre, z0, z1, r_in, r_out, tours, ep, mat, pas_par_tour=16, phase=0.0):
    """Spirale (vis, foret, tarière) : ruban hélicoïdal d'épaisseur `ep` autour de l'axe vertical passant par `centre`
    (x, y), du rayon `r_in` au rayon `r_out`, de z0 à z1, en `tours` tours. `phase` (radians) décale le départ
    (deux hélices décalées d'un demi-tour = foret de perceuse)."""
    bm = bmesh.new()
    n = max(2, int(tours * pas_par_tour))
    cx, cy = centre
    prev = None
    for i in range(n + 1):
        t = i / n
        a = 2 * math.pi * tours * t + phase
        z = z0 + (z1 - z0) * t
        c, s = math.cos(a), math.sin(a)
        cur = (bm.verts.new((cx + r_in * c, cy + r_in * s, z)), bm.verts.new((cx + r_out * c, cy + r_out * s, z)))
        if prev:
            bm.faces.new((prev[0], prev[1], cur[1], cur[0]))
        prev = cur
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=ep)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def foret(coll, name, centre, z0, z1, rayon, profondeur, tours, mat, n_angle=16, n_z=12, pointe=0.0):
    """Foret de perceuse : un seul bloc torsadé. Sa coupe = deux parties pleines (listels) séparées par deux rainures de
    `profondeur` ; la coupe tourne de `tours` tours entre z0 et z1. `pointe` > 0 ajoute une pointe conique sous z0."""
    bm = bmesh.new()
    cx, cy = centre
    rings = []
    for j in range(n_z + 1):
        t = j / n_z
        z = z0 + (z1 - z0) * t
        tw = 2 * math.pi * tours * t
        ring = []
        for i in range(n_angle):
            a = 2 * math.pi * i / n_angle
            rainure = max(0.0, -math.cos(2 * a)) ** 0.7  # deux rainures (vers 90° et 270°)
            r = rayon - profondeur * rainure
            ring.append(bm.verts.new((cx + r * math.cos(a + tw), cy + r * math.sin(a + tw), z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(n_angle):
            k = (i + 1) % n_angle
            bm.faces.new((a[i], a[k], b[k], b[i]))
    bm.faces.new(rings[-1])
    if pointe > 0:
        bout = bm.verts.new((cx, cy, z0 - pointe))
        for i in range(n_angle):
            bm.faces.new((rings[0][(i + 1) % n_angle], rings[0][i], bout))
    else:
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def courroie(coll, name, x, c1, r1, c2, r2, largeur, ep, mat, n1=16, n2=8):
    """Courroie fermée dans le plan vertical X = `x` : s'enroule sur la roue (centre c1 = (y, z), rayon r1) et sur la
    poulie (c2, r2), avec ses deux brins droits tangents. `largeur` le long de X, `ep` = épaisseur (vers l'intérieur)."""
    c1, c2 = Vector(c1), Vector(c2)
    d = c2 - c1
    D = d.length
    phi = math.atan2(d.y, d.x)
    alpha = math.acos(max(-1.0, min(1.0, (r1 - r2) / D)))

    def pt(c, r, a):
        return Vector((c.x + r * math.cos(a), c.y + r * math.sin(a)))

    chemin = []
    # Arc sur la poulie (côté roue opposé), de phi + alpha à phi - alpha en passant par phi.
    for i in range(n2 + 1):
        chemin.append(pt(c2, r2, phi + alpha - 2 * alpha * i / n2))
    # Arc sur la roue, de phi - alpha à phi + alpha - 2 pi en passant par phi + pi.
    for i in range(n1 + 1):
        chemin.append(pt(c1, r1, phi - alpha - (2 * math.pi - 2 * alpha) * i / n1))
    centre = sum(chemin, Vector((0, 0))) / len(chemin)
    bm = bmesh.new()
    rings = []
    n = len(chemin)
    for i, p in enumerate(chemin):
        t = chemin[(i + 1) % n] - chemin[i - 1]
        nrm = Vector((t.y, -t.x)).normalized()
        if nrm.dot(p - centre) < 0:
            nrm = -nrm
        q = p - nrm * ep
        rings.append([bm.verts.new((x - largeur / 2, p.x, p.y)), bm.verts.new((x + largeur / 2, p.x, p.y)),
                      bm.verts.new((x + largeur / 2, q.x, q.y)), bm.verts.new((x - largeur / 2, q.x, q.y))])
    for i in range(n):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def percer(obj, rayon, z0, z1, centre=(0.0, 0.0), segments=24):
    """Perce un trou cylindrique vertical (rayon `rayon`, de z0 à z1) dans `obj` (booléen « différence » appliqué).
    L'objet doit être fermé (ex. `lissage(..., fond=True)`)."""
    cut = cylinder(obj.users_collection[0], obj.name + '_trou', rayon, z1 - z0,
                   (centre[0], centre[1], (z0 + z1) / 2), obj.data.materials[0].name, segments)
    mod = obj.modifiers.new('trou', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cut
    dg = bpy.context.evaluated_depsgraph_get()
    neuf = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    ancien = obj.data
    obj.modifiers.remove(mod)
    obj.data = neuf
    bpy.data.meshes.remove(ancien)
    m = cut.data
    bpy.data.objects.remove(cut)
    bpy.data.meshes.remove(m)
    return obj


def extrusion(coll, name, profil, x0, x1, mat):
    """Extrude le long de X (de x0 à x1) un profil convexe donné dans le plan (y, z) : liste de points (y, z) dans l'ordre
    du contour. Sert aux formes courbes vues de côté (tête de cheval d'un chevalet de pompage, cames…)."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profil]
    b = [bm.verts.new((x1, y, z)) for y, z in profil]
    n = len(profil)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(coll, name, bm, mat)


def cylinder_at(coll, name, radius, height, loc, mat, segments=12, radius_top=None, x=0.0, y=0.0, z=0.0):
    """Cylindre tourné de (x, y, z) degrés autour de son propre centre, puis placé en `loc`."""
    obj = cylinder(coll, name, radius, height, (0, 0, 0), mat, segments, radius_top)
    rotate(obj, x, y, z)
    obj.location = loc
    return obj


def poser_au_sol(coll, demi_x, demi_y=None):
    """Modèle sans sol : le descend pour que sa pièce la plus basse touche Z = 0 (pivots compris), puis ajoute aux
    4 coins de l'emprise (± demi_x, ± demi_y) des repères minuscules (triangles de 4 mm, invisibles en jeu).

    Le jeu cadre chaque modèle sur son enveloppe (il le centre et l'agrandit jusqu'à remplir les cases) : sans ces
    repères, un modèle sans dalle serait agrandi et décalé. Avec eux, il garde l'échelle et la place voulues ici.
    """
    demi_y = demi_x if demi_y is None else demi_y
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * demi_x, sy * demi_y
            a = bm.verts.new((x, y, 0))
            b = bm.verts.new((x - sx * 0.004, y, 0))
            c = bm.verts.new((x, y - sy * 0.004, 0))
            bm.faces.new((a, b, c) if sx * sy > 0 else (a, c, b))
    return _object(coll, 'repere_emprise', bm, 'noir')


def pivot(coll, name, loc, axe=(0, 0, 1)):
    """Pivot d'animation : objet vide nommé `pivot_<groupe>` (voir blender/ANIMATIONS.md), placé en `loc`.

    Il n'a pas de forme (le jeu l'ignore au rendu) : il donne au code du jeu le point autour duquel tournent (ou à partir
    duquel bougent) les pièces du groupe, et son axe Z local suit `axe` (axe de rotation, dans le repère Blender).
    """
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = 'ARROWS'
    obj.empty_display_size = 0.3
    obj.location = loc
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axe))
    coll.objects.link(obj)
    return obj


def rotate(obj, x=0.0, y=0.0, z=0.0):
    """Tourne un objet (degrés) autour de son centre."""
    obj.rotation_euler = tuple(math.radians(a) for a in (x, y, z))
    return obj


def _export_copy(coll):
    """Copies mises à l'échelle 0,5 (cases -> mètres) dans une collection temporaire."""
    temp = bpy.data.collections.new(coll.name + '_export')
    bpy.context.scene.collection.children.link(temp)
    for obj in coll.objects:
        # matrix_basis plutôt que matrix_world : juste même si la collection est masquée (pas encore recalculée).
        monde = obj.matrix_basis if obj.parent is None else obj.matrix_world
        if obj.type == 'EMPTY':
            # Pivot d'animation : un nœud vide placé (en mètres) et orienté comme dans Blender, sans maillage.
            copy = bpy.data.objects.new(obj.name, None)
            loc, rot, _ = monde.decompose()
            copy.location = loc * CELL_M
            copy.rotation_mode = 'QUATERNION'
            copy.rotation_quaternion = rot
        else:
            mesh = obj.data.copy()
            mesh.transform(Matrix.Scale(CELL_M, 4) @ monde)
            copy = bpy.data.objects.new(obj.name, mesh)
        temp.objects.link(copy)
    return temp


def export_glb(coll, folder, name=None) -> str:
    """Exporte la collection en `folder/<name>.glb` (mètres, Y haut) ; `name` = nom de la collection par défaut."""
    temp = _export_copy(coll)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in temp.objects:
        o.select_set(True)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, (name or coll.name) + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
    )
    for o in list(temp.objects):
        bpy.data.objects.remove(o)
    bpy.data.collections.remove(temp)
    return path


def save(path) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=path)
