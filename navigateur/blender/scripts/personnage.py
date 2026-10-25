"""Famille « personnage » : le personnage du joueur, homme et femme, sur un squelette commun (voir docs/personnage.md).

Style low poly détaillé, comme les machines : facettes visibles, couleurs unies (un matériau par teinte, que le jeu
recolore : `combinaison`, `bande`, `peau`, `cheveux`, `iris`), pas de texture.

Échelle : 1 unité Blender = 50 cm (comme le reste du projet) ; le personnage mesure 3,6 unités (1,80 m), pieds en Z = 0,
face vers -Y (l'avant du jeu). À l'export, le squelette est mis à l'échelle 0,5 (mètres).

Squelette commun (mêmes os, mêmes noms pour les deux silhouettes) : `bassin` (racine) → `ventre` → `poitrine` → `cou` →
`tete` ; `poitrine` → `epaule_g/d` → `bras_g/d` → `avantbras_g/d` → `main_g/d` ; `bassin` → `cuisse_g/d` → `jambe_g/d` →
`pied_g/d`. `_g` = gauche du personnage (+X, puisqu'il regarde vers -Y). Pose de repos : debout, bras le long du corps.
Chaque pièce du maillage suit un seul os (low poly à segments, articulations cachées par des rotules).

Coupes de cheveux : une pièce séparée par coupe (`<modèle>_coupe_<nom>`, voir `COUPES`), toutes exportées ; le jeu
n'en montre qu'une (ou aucune : chauve). La tête et les cheveux sont agrandis de `TETE_ECHELLE` autour du menton.

Lancer :  blender --background --python blender/scripts/personnage.py
Produit :  blender/personnage.blend, export/personnage_homme.glb, export/personnage_femme.glb (et export/unity/)
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

# Teintes du personnage (le jeu remplace combinaison, bande, peau, cheveux et iris par celles du profil).
TEINTES = {
    'combinaison': '#2f5f8f',
    'bande': '#e0b83a',
    'peau': '#e0b38a',
    'cheveux': '#4a3020',
    'iris': '#3f7a4f',
    'oeil': '#f2f2ee',
    'levres': '#b8705f',
    'semelle': '#24272b',
    'couture': '#24476b',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()

# Hauteur de 3,6 unités : repères verticaux (unités).
Z_CHEVILLE, Z_GENOU, Z_HANCHE = 0.16, 1.0, 1.8
Z_TAILLE, Z_POITRINE, Z_EPAULE = 2.15, 2.62, 2.84
Z_COU, Z_TETE = 2.96, 3.34


class Maillage:
    """Maillage d'un seul tenant, construit pièce par pièce : chaque pièce a sa teinte et son os."""

    def __init__(self):
        self.verts, self.faces, self.mats, self.os = [], [], [], []
        self.teintes = []

    def _teinte(self, mat):
        if mat not in self.teintes:
            self.teintes.append(mat)
        return self.teintes.index(mat)

    def ajouter(self, verts, faces, mat, os_):
        base = len(self.verts)
        self.verts += [tuple(v) for v in verts]
        self.os += [os_] * len(verts)
        m = self._teinte(mat)
        for f in faces:
            self.faces.append(tuple(base + i for i in f))
            self.mats.append(m)

    # --- Pièces ---------------------------------------------------------------------------------------------------

    def tronc(self, mat, os_, anneaux, seg=8, centre=(0.0, 0.0), fond=True, dessus=True, decal=0.0):
        """Pièce de révolution aplatie : `anneaux` = [(z, demi-largeur x, demi-profondeur y, décalage y)]."""
        verts, faces = [], []
        for z, rx, ry, dy in anneaux:
            for i in range(seg):
                a = 2 * math.pi * (i + 0.5) / seg + decal
                verts.append((centre[0] + rx * math.cos(a), centre[1] + dy + ry * math.sin(a), z))
        n = len(anneaux)
        for k in range(n - 1):
            for i in range(seg):
                j = (i + 1) % seg
                faces.append((k * seg + i, k * seg + j, (k + 1) * seg + j, (k + 1) * seg + i))
        if fond:
            faces.append(tuple(reversed(range(seg))))
        if dessus:
            faces.append(tuple(range((n - 1) * seg, n * seg)))
        self.ajouter(verts, faces, mat, os_)

    def membre(self, mat, os_, a, b, ra, rb, seg=7, aplati=1.0):
        """Segment de membre (tronc de cône) du point `a` au point `b`."""
        a, b = Vector(a), Vector(b)
        d = (b - a)
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
        verts, faces = [], []
        for c, r in ((a, ra), (b, rb)):
            for i in range(seg):
                t = 2 * math.pi * i / seg
                verts.append(c + rot @ Vector((r * math.cos(t), r * aplati * math.sin(t), 0)))
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((i, j, seg + j, seg + i))
        faces.append(tuple(reversed(range(seg))))
        faces.append(tuple(range(seg, 2 * seg)))
        self.ajouter(verts, faces, mat, os_)

    def boule(self, mat, os_, c, r, seg=8, anneaux=5, echelle=(1, 1, 1)):
        """Ellipsoïde à facettes."""
        verts = [(c[0], c[1], c[2] - r * echelle[2])]
        for k in range(1, anneaux):
            phi = math.pi * k / anneaux - math.pi / 2
            for i in range(seg):
                t = 2 * math.pi * i / seg
                verts.append((c[0] + r * echelle[0] * math.cos(phi) * math.cos(t),
                              c[1] + r * echelle[1] * math.cos(phi) * math.sin(t),
                              c[2] + r * echelle[2] * math.sin(phi)))
        verts.append((c[0], c[1], c[2] + r * echelle[2]))
        top = len(verts) - 1
        faces = [(0, 1 + (i + 1) % seg, 1 + i) for i in range(seg)]
        for k in range(anneaux - 2):
            for i in range(seg):
                j = (i + 1) % seg
                a0, a1 = 1 + k * seg, 1 + (k + 1) * seg
                faces.append((a0 + i, a0 + j, a1 + j, a1 + i))
        last = 1 + (anneaux - 2) * seg
        faces += [(last + i, last + (i + 1) % seg, top) for i in range(seg)]
        self.ajouter(verts, faces, mat, os_)

    def boite(self, mat, os_, c, taille, rot=None):
        sx, sy, sz = (t / 2 for t in taille)
        coins = [Vector((x, y, z)) for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
        if rot is not None:
            coins = [rot @ v for v in coins]
        verts = [Vector(c) + v for v in coins]
        faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        self.ajouter(verts, faces, mat, os_)

    def objet(self, coll, nom):
        mesh = bpy.data.meshes.new(nom)
        mesh.from_pydata(self.verts, [], self.faces)
        for mat in self.teintes:
            mesh.materials.append(T.material(mat))
        for poly, m in zip(mesh.polygons, self.mats):
            poly.material_index = m
        mesh.update()
        # Normales vers l'extérieur, pièce par pièce.
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(nom, mesh)
        coll.objects.link(obj)
        for os_ in sorted(set(self.os)):
            obj.vertex_groups.new(name=os_)
        for i, os_ in enumerate(self.os):
            obj.vertex_groups[os_].add([i], 1.0, 'REPLACE')
        return obj


# --- Squelette -------------------------------------------------------------------------------------------------------

def os_du_squelette(femme):
    """(nom, tête, queue, parent) de chaque os, en unités."""
    ep = 0.4 if femme else 0.46  # demi-largeur des épaules
    hx = 0.2 if femme else 0.18  # écart des hanches
    out = [
        ('bassin', (0, 0, Z_HANCHE), (0, 0, Z_TAILLE), None),
        ('ventre', (0, 0, Z_TAILLE), (0, 0, Z_POITRINE - 0.1), 'bassin'),
        ('poitrine', (0, 0, Z_POITRINE - 0.1), (0, 0, Z_COU - 0.06), 'ventre'),
        ('cou', (0, 0, Z_COU - 0.06), (0, 0, Z_COU + 0.12), 'poitrine'),
        ('tete', (0, 0, Z_COU + 0.12), (0, 0, 3.65), 'cou'),
    ]
    for s, cote in ((1, 'g'), (-1, 'd')):
        main_x = s * (ep + 0.06)
        out += [
            (f'epaule_{cote}', (s * 0.08, 0, Z_EPAULE - 0.06), (s * ep, 0, Z_EPAULE - 0.08), 'poitrine'),
            (f'bras_{cote}', (s * ep, 0, Z_EPAULE - 0.08), (s * (ep + 0.04), 0, 2.2), f'epaule_{cote}'),
            (f'avantbras_{cote}', (s * (ep + 0.04), 0, 2.2), (main_x, -0.02, 1.68), f'bras_{cote}'),
            (f'main_{cote}', (main_x, -0.02, 1.68), (main_x, -0.03, 1.46), f'avantbras_{cote}'),
            (f'cuisse_{cote}', (s * hx, 0, Z_HANCHE), (s * hx, 0, Z_GENOU), 'bassin'),
            (f'jambe_{cote}', (s * hx, 0, Z_GENOU), (s * hx, 0.02, Z_CHEVILLE), f'cuisse_{cote}'),
            (f'pied_{cote}', (s * hx, 0.02, Z_CHEVILLE), (s * hx, -0.4, 0.04), f'jambe_{cote}'),
        ]
    return out


def squelette(coll, nom, femme):
    arm = bpy.data.armatures.new(nom)
    obj = bpy.data.objects.new(nom, arm)
    coll.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bones = {}
    for name, tete, queue, parent in os_du_squelette(femme):
        b = arm.edit_bones.new(name)
        b.head, b.tail = Vector(tete), Vector(queue)
        b.roll = 0
        if parent:
            b.parent = bones[parent]
            b.use_connect = False
        bones[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


# --- Corps ---------------------------------------------------------------------------------------------------------

def corps(m, femme, leger):
    seg = 8 if leger else 12
    ep = 0.4 if femme else 0.46
    hx = 0.2 if femme else 0.18
    # Jambes : cuisse, genou, jambe, pied (botte de la combinaison, semelle sombre).
    for s, c in ((1, 'g'), (-1, 'd')):
        x = s * hx
        rc = 0.17 if femme else 0.16
        m.tronc('combinaison', f'cuisse_{c}', [(Z_HANCHE - 0.02, rc * 1.05, rc, 0), (1.45, rc * 0.9, rc * 0.88, 0),
                                               (Z_GENOU + 0.05, 0.11, 0.11, 0)], seg, centre=(x, 0))
        m.boule('combinaison', f'jambe_{c}', (x, -0.01, Z_GENOU), 0.115, seg, 4)
        m.tronc('combinaison', f'jambe_{c}', [(Z_GENOU - 0.02, 0.105, 0.11, 0), (0.62, 0.105, 0.12, 0.02),
                                             (Z_CHEVILLE + 0.06, 0.075, 0.08, 0)], seg, centre=(x, 0))
        m.tronc('combinaison', f'pied_{c}', [(0.04, 0.095, 0.2, -0.12), (Z_CHEVILLE + 0.06, 0.085, 0.12, -0.04)], seg,
                centre=(x, 0))
        m.tronc('semelle', f'pied_{c}', [(0.0, 0.1, 0.21, -0.12), (0.045, 0.1, 0.21, -0.12)], seg, centre=(x, 0))
    # Bassin, ventre, poitrine.
    hanche = 0.38 if femme else 0.36
    taille = 0.29 if femme else 0.33
    poit = 0.38 if femme else 0.44
    m.tronc('combinaison', 'bassin', [(Z_HANCHE - 0.14, hanche * 0.8, 0.17, 0), (Z_HANCHE + 0.05, hanche, 0.2, 0),
                                       (Z_TAILLE, taille, 0.18, 0)], seg)
    m.tronc('combinaison', 'ventre', [(Z_TAILLE - 0.02, taille, 0.18, 0), (Z_POITRINE - 0.12, poit * 0.92, 0.2, 0)],
            seg, fond=False)
    m.tronc('combinaison', 'poitrine', [(Z_POITRINE - 0.14, poit * 0.92, 0.2, 0), (Z_POITRINE + 0.08, poit, 0.22, 0),
                                         (Z_EPAULE - 0.02, poit * 0.86, 0.19, 0), (Z_COU - 0.04, 0.14, 0.11, 0)], seg)
    if femme:
        for s in (1, -1):
            m.boule('combinaison', 'poitrine', (s * 0.13, -0.15, Z_POITRINE - 0.05), 0.11, seg, 4, (1, 0.75, 0.85))
    # Bandes de couleur : épaules et flancs ; couture au milieu du dos.
    for s in (1, -1):
        m.boite('bande', 'poitrine', (s * poit * 0.62, 0, Z_EPAULE - 0.04), (0.16, 0.36, 0.03),
                Matrix.Rotation(-s * 0.35, 3, 'Y'))
        m.boite('bande', 'ventre', (s * (taille + poit) / 2 * 1.0, 0, (Z_TAILLE + Z_POITRINE) / 2 - 0.03),
                (0.025, 0.08, Z_POITRINE - Z_TAILLE + 0.1), Matrix.Rotation(s * 0.2, 3, 'Y'))
        m.boite('bande', f'cuisse_{"g" if s > 0 else "d"}', (s * (hx + 0.16), 0, 1.4), (0.025, 0.07, 0.7))
    m.boite('couture', 'ventre', (0, 0.205, Z_TAILLE + 0.25), (0.03, 0.02, 0.5))
    m.boite('couture', 'bassin', (0, -0.205, Z_TAILLE - 0.12), (0.2, 0.02, 0.05))  # ceinture
    # Bras : épaule (rotule), bras, coude, avant-bras, main (peau) avec pouce.
    rb = 0.095 if femme else 0.11
    for s, c in ((1, 'g'), (-1, 'd')):
        sh = Vector((s * ep, 0, Z_EPAULE - 0.08))
        el = Vector((s * (ep + 0.04), 0, 2.2))
        wr = Vector((s * (ep + 0.06), -0.02, 1.68))
        m.boule('combinaison', f'bras_{c}', tuple(sh), rb * 1.25, seg, 5)
        m.membre('combinaison', f'bras_{c}', sh, el, rb, rb * 0.85, seg)
        m.boule('combinaison', f'avantbras_{c}', tuple(el), rb * 0.85, seg, 4)
        m.membre('combinaison', f'avantbras_{c}', el, wr + Vector((0, 0, 0.04)), rb * 0.85, rb * 0.65, seg)
        m.boite('peau', f'main_{c}', (wr.x, wr.y - 0.01, 1.56), (0.08, 0.14, 0.2), Matrix.Rotation(s * 0.05, 3, 'Y'))
        m.boite('peau', f'main_{c}', (wr.x - s * 0.01, wr.y - 0.09, 1.6), (0.06, 0.06, 0.1),
                Matrix.Rotation(0.4, 3, 'X'))  # pouce
        m.boite('bande', f'avantbras_{c}', tuple(wr + Vector((0, 0, 0.06))), (rb * 1.4, rb * 1.4, 0.04))  # poignet


def tete(m, femme, leger):
    seg = 8 if leger else 12
    zc = Z_TETE
    m.membre('peau', 'cou', (0, 0.01, Z_COU - 0.06), (0, 0.01, Z_COU + 0.16), 0.075 if femme else 0.09,
             0.07 if femme else 0.085, seg)
    m.boite('combinaison', 'poitrine', (0, 0.01, Z_COU - 0.04), (0.24, 0.22, 0.08))  # col
    # Crâne : ellipsoïde, mâchoire plus étroite.
    m.boule('peau', 'tete', (0, 0.01, zc + 0.03), 0.23, seg + 2, 6, (0.86 if femme else 0.9, 1.0, 1.08))
    m.tronc('peau', 'tete', [(zc - 0.2, 0.09 if femme else 0.11, 0.1, -0.03), (zc - 0.02, 0.18, 0.18, -0.02)], seg)
    # Nez, yeux (blanc + iris), sourcils, bouche, oreilles.
    m.tronc('peau', 'tete', [(zc - 0.06, 0.035, 0.03, -0.24), (zc + 0.05, 0.018, 0.012, -0.21)], 4)
    for s in (1, -1):
        m.boite('oeil', 'tete', (s * 0.085, -0.19, zc + 0.06), (0.07, 0.02, 0.04))
        m.boite('iris', 'tete', (s * 0.085, -0.2, zc + 0.06), (0.032, 0.02, 0.036))
        m.boite('cheveux', 'tete', (s * 0.088, -0.195, zc + 0.11), (0.09, 0.025, 0.018), Matrix.Rotation(s * 0.12, 3, 'Y'))
        m.boule('peau', 'tete', (s * 0.2, 0.02, zc + 0.03), 0.045, 6, 4, (0.5, 1, 1.3))
    m.boite('levres', 'tete', (0, -0.19, zc - 0.1), (0.1 if femme else 0.09, 0.025, 0.028 if femme else 0.02))


# --- Tête plus grosse, cou plus court -------------------------------------------------------------------------------

#: Agrandissement de la tête (et des cheveux) autour du menton ; le menton descend un peu pour raccourcir le cou.
TETE_ECHELLE = 1.18
MENTON = (0.0, 0.0, Z_TETE - 0.2)
MENTON_NOUVEAU = (0.0, 0.0, Z_TETE - 0.27)


def agrandir_tete(m, debut):
    """Agrandit les sommets ajoutés depuis `debut` (tête, visage, cheveux) autour du menton."""
    c, a = Vector(MENTON), Vector(MENTON_NOUVEAU)
    for i in range(debut, len(m.verts)):
        m.verts[i] = tuple(a + (Vector(m.verts[i]) - c) * TETE_ECHELLE)


# --- Coupes de cheveux (pièces séparées, interchangeables dans le jeu) --------------------------------------------

def _calotte(m, femme, seg, bas=0.09, gonfle=1.0):
    """Calotte de cheveux sur le haut et l'arrière du crâne (`bas` : hauteur du centre, plus bas = couvre plus)."""
    zc = Z_TETE
    m.boule('cheveux', 'tete', (0, 0.03, zc + bas), 0.235 * gonfle, seg, 6,
            (0.92 if femme else 0.95, 1.03, 0.92))


def _frange(m, n=5, longueur=0.11):
    zc = Z_TETE
    for k in range(n):
        x = -0.12 + 0.24 * k / max(1, n - 1)
        m.tronc('cheveux', 'tete', [(zc + 0.24 - longueur, 0.04, 0.03, -0.19 + abs(x) * 0.4),
                                    (zc + 0.24, 0.05, 0.05, -0.15 + abs(x) * 0.4)], 4, centre=(x, 0), decal=0.3 * k)


def coupe_rase(m, femme, seg):
    """Rasée : une fine couche sur le crâne."""
    m.boule('cheveux', 'tete', (0, 0.02, Z_TETE + 0.05), 0.228, seg, 6, (0.9 if femme else 0.92, 1.01, 0.97))


def coupe_courte(m, femme, seg):
    """Courte avec frange."""
    _calotte(m, femme, seg)
    _frange(m)


def coupe_brosse(m, femme, seg):
    """En brosse : calotte et pointes dressées."""
    _calotte(m, femme, seg, bas=0.1)
    zc = Z_TETE
    for k in range(9):
        a = 2 * math.pi * k / 9
        r = 0.09 + 0.05 * (k % 2)
        x, y = r * math.cos(a), 0.03 + r * math.sin(a)
        m.tronc('cheveux', 'tete', [(zc + 0.22, 0.05, 0.05, 0), (zc + 0.34, 0.005, 0.005, 0)], 4, centre=(x, y), decal=a)
    m.tronc('cheveux', 'tete', [(zc + 0.24, 0.05, 0.05, 0), (zc + 0.37, 0.005, 0.005, 0)], 4, centre=(0, 0.02))


def coupe_iroquoise(m, femme, seg):
    """Crête iroquoise : côtés rasés, crête du front à la nuque."""
    coupe_rase(m, femme, seg)
    zc = Z_TETE
    for k in range(7):
        y = -0.16 + 0.055 * k
        h = 0.36 - 0.012 * abs(k - 2)
        z0 = zc + 0.2 - 0.06 * max(0, k - 3)
        m.tronc('cheveux', 'tete', [(z0, 0.025, 0.04, 0), (zc + h - 0.03 * max(0, k - 3), 0.008, 0.012, 0.03)], 4,
                centre=(0, y))


def coupe_mi_longue(m, femme, seg):
    """Mi-longue : cheveux jusqu'au menton, raie sur le côté."""
    _calotte(m, femme, seg, gonfle=1.03)
    _frange(m, 4, 0.13)
    zc = Z_TETE
    m.tronc('cheveux', 'tete', [(zc - 0.16, 0.23, 0.17, 0.07), (zc + 0.06, 0.25, 0.2, 0.04)], seg, fond=False)


def coupe_longue(m, femme, seg):
    """Longue : cheveux dans le dos, mèches devant les épaules."""
    coupe_mi_longue(m, femme, seg)
    zc = Z_TETE
    m.tronc('cheveux', 'tete', [(zc - 0.62, 0.17, 0.05, 0.2), (zc - 0.14, 0.23, 0.08, 0.16)], seg)
    for s in (1, -1):
        m.membre('cheveux', 'tete', (s * 0.19, -0.04, zc - 0.05), (s * 0.2, -0.08, zc - 0.42), 0.05, 0.035, 6)


def coupe_carre(m, femme, seg):
    """Carré : au ras de la mâchoire, frange droite."""
    _calotte(m, femme, seg, gonfle=1.04)
    _frange(m, 6, 0.12)
    zc = Z_TETE
    m.tronc('cheveux', 'tete', [(zc - 0.12, 0.25, 0.2, 0.05), (zc + 0.07, 0.25, 0.21, 0.04)], seg, fond=False)


def coupe_queue(m, femme, seg):
    """Queue de cheval."""
    _calotte(m, femme, seg)
    _frange(m)
    zc = Z_TETE
    m.boule('cheveux', 'tete', (0, 0.22, zc + 0.05), 0.07, 8, 4)
    m.membre('cheveux', 'tete', (0, 0.24, zc + 0.04), (0, 0.32, zc - 0.36), 0.07, 0.03, 6)


def coupe_chignon(m, femme, seg):
    """Chignon : cheveux tirés, boule à l'arrière du crâne."""
    _calotte(m, femme, seg, bas=0.07)
    zc = Z_TETE
    m.boule('cheveux', 'tete', (0, 0.24, zc + 0.14), 0.11, seg, 5)


def coupe_afro(m, femme, seg):
    """Afro : grand volume rond."""
    zc = Z_TETE
    m.boule('cheveux', 'tete', (0, 0.05, zc + 0.12), 0.33, seg + 2, 7, (1.0, 1.0, 0.92))


#: Coupes proposées (la première de chaque silhouette sert par défaut ; « chauve » = aucune pièce).
COUPES = {
    'courte': coupe_courte,
    'rase': coupe_rase,
    'brosse': coupe_brosse,
    'iroquoise': coupe_iroquoise,
    'mi_longue': coupe_mi_longue,
    'longue': coupe_longue,
    'carre': coupe_carre,
    'queue': coupe_queue,
    'chignon': coupe_chignon,
    'afro': coupe_afro,
}


def _attacher(obj, arm):
    obj.parent = arm
    mod = obj.modifiers.new('squelette', 'ARMATURE')
    mod.object = arm


def personnage(coll, femme, leger=True):
    nom = coll.name
    m = Maillage()
    corps(m, femme, leger)
    debut = len(m.verts)
    tete(m, femme, leger)
    agrandir_tete(m, debut)
    obj = m.objet(coll, f'{nom}_corps')
    arm = squelette(coll, f'{nom}_squelette', femme)
    _attacher(obj, arm)
    # Une pièce par coupe (le jeu n'en montre qu'une) ; dans Blender, seule la coupe par défaut reste visible.
    defaut = 'queue' if femme else 'courte'
    for cle, fabrique in COUPES.items():
        h = Maillage()
        fabrique(h, femme, 10 if leger else 14)
        agrandir_tete(h, 0)
        o = h.objet(coll, f'{nom}_coupe_{cle}')
        _attacher(o, arm)
        o.hide_viewport = cle != defaut
        o.hide_render = cle != defaut
    return arm


def personnage_homme(coll, leger=True):
    return personnage(coll, False, leger)


def personnage_femme(coll, leger=True):
    return personnage(coll, True, leger)


MODELES = {'personnage_homme': personnage_homme, 'personnage_femme': personnage_femme}


def construire(noms=None):
    _palette()
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter_un(coll, dossier, nom):
    """Export avec le squelette (peau), en mètres : le squelette est mis à l'échelle 0,5 le temps de l'export."""
    arm = next(o for o in coll.objects if o.type == 'ARMATURE')
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    cache = {o.name: o.hide_viewport for o in coll.objects}
    for o in coll.objects:
        o.hide_viewport = False
        o.hide_set(False)
        o.select_set(True)
    arm.scale = (T.CELL_M,) * 3
    bpy.context.view_layer.update()
    os.makedirs(dossier, exist_ok=True)
    chemin = os.path.join(dossier, nom + '.glb')
    bpy.ops.export_scene.gltf(filepath=chemin, export_format='GLB', use_selection=True, export_apply=False,
                              export_yup=True, export_skins=True, export_animations=False,
                              export_materials='EXPORT')
    arm.scale = (1, 1, 1)
    for o in coll.objects:
        o.hide_viewport = cache[o.name]
    return chemin


def exporter(noms=None):
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        if noms and nom not in noms:
            continue
        print('export web   :', exporter_un(bpy.data.collections[nom], export, nom))
        print('export Unity :', exporter_un(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'personnage.blend'))


if __name__ == '__main__':
    main()
