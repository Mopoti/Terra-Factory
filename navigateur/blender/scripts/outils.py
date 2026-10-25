"""Famille « outils » : ce que le joueur tient en main (pioches, armes).

Style low poly stylisé (voir blender/README.md). Conventions (1 unité = 50 cm) :
- pioches : debout, le manche de Z = 0 vers le haut, la tête en haut, la pointe vers -Y ; le jeu les couche et les met
  à 0,75 m (`src/render/toolModel.ts`) ;
- armes : le canon vers l'avant (-Y), la crosse ou la poignée vers le bas ; origine au milieu de la poignée. Le jeu
  les tient dans la main droite. Pistolet ~0,2 m de long, fusil automatique ~1 m, sniper ~1,3 m. En pièces
  animées (culasse ou levier, chargeur, détente, bipied) et repères `bouche` / `ejection`.

Lancer :  blender --background --python blender/scripts/outils.py
Produit :  blender/outils.blend, export/<nom>.glb et export/unity/<nom>.glb
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import math  # noqa: E402

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TEINTES = {
    'manche': '#9a7348',
    'manche_sombre': '#6e4f2e',
    'ficelle': '#d9c79a',
    'silex': '#7e7a74',
    'silex_clair': '#a39d94',
    'fer_outil': '#9aa3ad',
    'fer_sombre': '#5b636c',
    'arme': '#3d4248',
    'arme_claire': '#5a6068',
    'crosse': '#6b4528',
    # Style « doux » (pioche-hache) : formes arrondies, ombrage lisse, teintes claires et chaudes.
    'acier_lavande': '#b9b7ca',
    'acier_ombre': '#5f5d6d',
    'acier_fil': '#e2e1ee',
    'acier_bague': '#8d909b',
    'bois_orange': '#de8a5e',
    'bois_veine': '#f0a77c',
    'bois_bout': '#b9663f',
    'pierre_outil': '#9b9087',
    'pierre_outil_clair': '#bdb3a8',
    'pierre_outil_ombre': '#6a5f57',
    'cuir_outil': '#8a5b3a',
    # Main gantée (vue subjective) : doigts nus, gant sans doigts gris, sangle cuir au poignet.
    'peau_main': '#e9a27c',
    'ongle': '#f4cdb6',
    'gant': '#8e8e9a',
    'gant_sombre': '#686874',
    'gant_sangle': '#b56a3f',
    # Manche de la combinaison (vue subjective) : mêmes noms de teintes que le personnage, recolorées en jeu.
    'combinaison': '#d9822b',
    'bande': '#f0b26a',
    'couture': '#9c5a1c',
    # Armes au style doux : acier gris bleuté, noir mat, bois orangé comme le manche de la pioche-hache.
    'arme_acier': '#5b616d',
    'arme_acier_clair': '#8b93a0',
    'arme_noir': '#2e3138',
    'arme_bois': '#c4743f',
    'arme_bois_clair': '#dc9361',
    'arme_sable': '#b3a274',
    'arme_sable_sombre': '#8a7c55',
    'arme_cuivre': '#d9a441',
    'verre_lunette': '#7fc1e6',
}

# Teintes qui brillent un peu (métal poli) : rugosité plus faible que le reste de la palette.
BRILLANTS = {'acier_lavande': 0.42, 'acier_fil': 0.32, 'acier_bague': 0.4, 'acier_ombre': 0.55,
             'arme_acier': 0.45, 'arme_acier_clair': 0.38, 'arme_noir': 0.6, 'verre_lunette': 0.15, 'arme_cuivre': 0.35}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()


def _brillant():
    for nom, rugosite in BRILLANTS.items():
        m = bpy.data.materials.get(nom)
        if m:
            bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Roughness'].default_value = rugosite


def _anneau(c, u, v, a, b, r, n):
    """Points d'un rectangle arrondi centré en `c`, demi-côtés `a` (selon `u`) et `b` (selon `v`), coins de rayon `r`."""
    r = max(0.0, min(r, a, b))
    pts = []
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy = sx * (a - r), sy * (b - r)
        for i in range(n + 1):
            ang = (k + i / n) * math.pi / 2
            pts.append(c + u * (cx + r * math.cos(ang)) + v * (cy + r * math.sin(ang)))
    return pts


def _loft(lot, mat, sections, n=3, bouts=(True, True)):
    """Volume lisse passant par des sections en rectangle arrondi : (centre, u, v, a, b, rayon) chacune.

    Les flancs sont lissés (ombrage doux du style « cartoon »), les bouts sont des faces planes à arête vive.
    """
    tmp = bmesh.new()
    anneaux = []
    for c, u, v, a, b, r in sections:
        anneaux.append([tmp.verts.new(p) for p in _anneau(Vector(c), Vector(u), Vector(v), a, b, r, n)])
    m = len(anneaux[0])
    for r0, r1 in zip(anneaux, anneaux[1:]):
        for i in range(m):
            j = (i + 1) % m
            tmp.faces.new((r0[i], r0[j], r1[j], r1[i])).smooth = True
    for anneau, garder, sens in ((anneaux[0], bouts[0], -1), (anneaux[-1], bouts[1], 1)):
        if garder:
            dup = [tmp.verts.new(vt.co) for vt in anneau]
            tmp.faces.new(dup[::-1] if sens < 0 else dup).smooth = False
    bmesh.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


class Piece(T.Lot):
    """Une pièce séparée d'un modèle : un seul objet (plusieurs teintes), pivot à `origine`, accrochée à un parent.

    Les pièces gardent leur hiérarchie à l'export (`_export_hier`) : le code du jeu peut tourner un doigt ou une partie
    d'outil autour de son pivot.
    """

    def __init__(self):
        super().__init__(None, '')

    def finir(self, coll, nom, origine, parent=None):
        origine = Vector(origine)
        tout = bmesh.new()
        mats = []
        for i, (mat, bm) in enumerate(self.bms.items()):
            for f in bm.faces:
                f.material_index = i
            mats.append(mat)
            T._verse(bm, tout)
        bmesh.ops.translate(tout, vec=-origine, verts=tout.verts)
        mesh = bpy.data.meshes.new(nom)
        tout.to_mesh(mesh)
        tout.free()
        for mat in mats:
            mesh.materials.append(T.material(mat))
        obj = bpy.data.objects.new(nom, mesh)
        coll.objects.link(obj)
        obj['origine'] = list(origine)
        if parent is not None:
            obj.parent = parent
            obj.location = origine - Vector(parent['origine'])
        else:
            obj.location = origine
        self.bms = {}
        return obj


def _export_hier(coll, folder, name):
    """Exporte la collection en gardant les pièces et leur hiérarchie (pivots), à l'échelle 0,5 (cases -> mètres)."""
    import re
    temp = bpy.data.collections.new(name + '_export')
    bpy.context.scene.collection.children.link(temp)
    noms = {o: re.sub(r'\.\d+$', '', o.name) for o in coll.objects}
    anciens = {o: o.name for o in bpy.data.objects}
    for o in anciens:  # libère les noms propres (sans « .001 ») pour les copies
        o.name = o.name + '~src'
    copies = {}
    for o in coll.objects:
        c = o.copy()
        if o.data:
            c.data = o.data.copy()
            c.data.transform(Matrix.Scale(T.CELL_M, 4))
        c.parent = None
        c.location = o.location * T.CELL_M
        temp.objects.link(c)
        c.name = noms[o]
        copies[o] = c
    for o, c in copies.items():
        if o.parent in copies:
            c.parent = copies[o.parent]
            c.matrix_parent_inverse.identity()
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for c in copies.values():
        c.select_set(True)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_materials='EXPORT')
    for c in copies.values():
        bpy.data.objects.remove(c)
    bpy.data.collections.remove(temp)
    for o, n in anciens.items():
        o.name = n
    return path


def _cylindre_doux(lot, mat, z0, z1, rayon, chanfrein, n):
    """Bague ronde le long de Z, bords adoucis."""
    k = chanfrein
    _loft(lot, mat, [((0, 0, z0), X, Y, rayon - k, rayon - k, rayon),
                     ((0, 0, z0 + k), X, Y, rayon, rayon, rayon),
                     ((0, 0, z1 - k), X, Y, rayon, rayon, rayon),
                     ((0, 0, z1), X, Y, rayon - k, rayon - k, rayon)], n)


def pioche_hache(coll, leger=True, pierre=False):
    """Pioche-hache au style doux : pic recourbé d'un côté (-Y), lame de hache de l'autre (+Y).

    Formes lisses à coins arrondis, métal clair un peu brillant, plaque sombre boulonnée sur l'œil, bague sous la tête,
    manche orangé veiné. `pierre` : même forme, tête en pierre taillée et ligature de cuir (outil de pierre).
    """
    n = 3 if leger else 5
    manche, bague, oeil, pic, lame_p = (Piece() for _ in range(5))
    tete, clair, ombre = (('pierre_outil', 'pierre_outil_clair', 'pierre_outil_ombre') if pierre
                          else ('acier_lavande', 'acier_fil', 'acier_ombre'))
    h = 1.5
    zc = 1.36  # centre de la tête

    # Manche : section ovale, renflé au pommeau, aminci au milieu, élargi sous la tête.
    profil = [(0.0, 0.052, 0.060), (0.035, 0.062, 0.072), (0.08, 0.054, 0.062), (0.3, 0.047, 0.054),
              (0.75, 0.044, 0.050), (1.1, 0.048, 0.056), (1.26, 0.054, 0.064), (zc + 0.06, 0.054, 0.064)]
    secs = [((0, 0, z), X, Y, a, b, min(a, b)) for z, a, b in profil]
    _loft(manche, 'bois_orange', secs, n)
    _loft(manche, 'bois_bout', [((0, 0, -0.012), X, Y, 0.046, 0.054, 0.046), ((0, 0, 0.004), X, Y, 0.053, 0.061, 0.053)], n,
          (True, False))
    # Veines claires (un peu en saillie, très fines) sur les flancs du manche.
    for cote, decal, z0, z1 in ((1, 0.012, 0.18, 1.05), (-1, -0.014, 0.3, 1.15), (1, -0.02, 0.55, 1.2)):
        pts = []
        for i in range(6):
            t = i / 5
            z = z0 + (z1 - z0) * t
            a = 0.0475 - 0.004 * math.sin(math.pi * t)
            pts.append(((cote * (a + 0.0015), decal + 0.006 * math.sin(3 * t), z), Y, X, 0.006 * math.sin(math.pi * t) + 0.002,
                        0.002, 0.002))
        _loft(manche, 'bois_veine', pts, 1)

    # Bague (douille) sous la tête, liseré clair en haut.
    if pierre:
        for k in range(3):
            _cylindre_doux(bague, 'cuir_outil', zc - 0.2 + k * 0.045, zc - 0.165 + k * 0.045, 0.072, 0.008, n + 1)
    else:
        _cylindre_doux(bague, 'acier_bague', zc - 0.21, zc - 0.1, 0.078, 0.012, n + 1)
        _cylindre_doux(bague, 'acier_fil', zc - 0.105, zc - 0.088, 0.072, 0.005, n + 1)

    # Œil : bloc central arrondi, allongé selon Y.
    a, b, e = 0.068, 0.085, 0.14
    _loft(oeil, tete, [((0, -e, zc), X, Z, a - 0.012, b - 0.012, 0.04), ((0, -e + 0.015, zc), X, Z, a, b, 0.045),
                      ((0, e - 0.015, zc), X, Z, a, b, 0.045), ((0, e, zc), X, Z, a - 0.012, b - 0.012, 0.04)], n)
    # Plaque sombre de chaque côté, deux boulons octogonaux.
    for sx in (1, -1):
        x0 = sx * (a - 0.004)
        x1 = sx * (a + 0.012)
        _loft(oeil, clair, [((x0, 0, zc), Y, Z, 0.115, 0.05, 0.03), ((x1 - sx * 0.006, 0, zc), Y, Z, 0.115, 0.05, 0.03),
                           ((x1, 0, zc), Y, Z, 0.108, 0.043, 0.026)], n)
        _loft(oeil, ombre, [((x1 - sx * 0.004, 0, zc), Y, Z, 0.095, 0.032, 0.02),
                           ((x1 + sx * 0.003, 0, zc), Y, Z, 0.095, 0.032, 0.02)], n)
        for y in (-0.06, 0.06):
            oeil.tube(clair, (x1, y, zc), (x1 + sx * 0.016, y, zc), 0.024, 8)
            oeil.tube(ombre, (x1 + sx * 0.015, y, zc), (x1 + sx * 0.02, y, zc), 0.014, 8)

    # Pic recourbé vers le bas (-Y), qui s'effile jusqu'à la pointe.
    pts = 9 if leger else 14
    secs = []
    for i in range(pts):
        s = i / (pts - 1)
        y = -0.11 - 0.52 * s
        z = zc + 0.01 * s - 0.17 * s ** 2.2
        dy, dz = -0.52, 0.01 - 0.17 * 2.2 * s ** 1.2 if s > 0 else 0.01
        tng = Vector((0, dy, dz)).normalized()
        v = tng.cross(X).normalized()
        if v.z < 0:
            v = -v
        bb = 0.07 * (1 - s) ** 0.85 + 0.004
        aa = 0.052 * (1 - s) ** 0.75 + 0.003
        secs.append(((0, y, z), X, v, aa, bb, min(aa, bb) * 0.7))
    _loft(pic, tete, secs, n)

    # Lame de hache (+Y) : s'évase vers le bas et s'amincit jusqu'au fil, qui est plus clair.
    lame = [(0.11, zc, 0.06, 0.08), (0.2, zc - 0.01, 0.045, 0.09), (0.28, zc - 0.035, 0.032, 0.14),
            (0.36, zc - 0.05, 0.02, 0.19), (0.405, zc - 0.055, 0.013, 0.21)]
    _loft(lame_p, tete, [((0, y, z), X, Z, aa, bb, min(aa, bb) * 0.8) for y, z, aa, bb in lame], n)
    _loft(lame_p, clair, [((0, 0.4, zc - 0.055), X, Z, 0.0135, 0.208, 0.012), ((0, 0.445, zc - 0.055), X, Z, 0.004, 0.212, 0.004)],
          n)
    # Pièces séparées (nœuds du .glb), chacune avec son pivot : manche (pied du manche) > bague, œil (centre de la
    # tête) > pic, lame. Le code peut les animer ou les changer une à une.
    racine = manche.finir(coll, 'manche', (0, 0, 0))
    bague.finir(coll, 'bague', (0, 0, zc - 0.15), racine)
    tete_o = oeil.finir(coll, 'oeil', (0, 0, zc), racine)
    pic.finir(coll, 'pic', (0, -0.11, zc), tete_o)
    lame_p.finir(coll, 'lame', (0, 0.11, zc), tete_o)
    _brillant()


def _repere(d):
    """Repère d'une pièce allongée selon `d` : (côté, dessus)."""
    d = Vector(d).normalized()
    u = d.cross(Z)
    if u.length < 1e-4:
        u = X.copy()
    u.normalize()
    return u, u.cross(d).normalized()


def _phalange(piece, base, d, longueur, r0, r1, n, ongle=False, gant=0.0, mat='peau_main'):
    """Segment de doigt arrondi de `base` le long de `d` ; `ongle` sur le dessus du bout ; `gant` : part couverte."""
    base, d = Vector(base), Vector(d).normalized()
    u, v = _repere(d)
    secs = []
    for t, k in ((0.0, 0.78), (0.1, 0.97), (0.3, 1.0), (0.75, 1.0), (0.9, 0.9), (1.0, 0.55)):
        r = (r0 + (r1 - r0) * t) * k
        secs.append((base + d * (longueur * t), u, v, r, r * 0.86, r))
    _loft(piece, mat, secs, n)
    if gant > 0:
        g = longueur * gant
        _loft(piece, 'gant', [(base + d * (-0.004), u, v, r0 * 1.05, r0 * 0.93, r0),
                              (base + d * g, u, v, r0 * 1.1, r0 * 0.97, r0 * 1.05)], n)
        _loft(piece, 'gant_sombre', [(base + d * (g - 0.004), u, v, r0 * 1.12, r0 * 0.99, r0),
                                     (base + d * (g + 0.004), u, v, r0 * 1.1, r0 * 0.97, r0)], n)
    if ongle:
        r = r1
        c = base + d * (longueur * 0.62) + v * (r * 0.62)
        _loft(piece, 'ongle', [(c - d * (longueur * 0.24), u, v, r * 0.5, 0.004, 0.003),
                               (c - d * (longueur * 0.18), u, v, r * 0.66, 0.007, 0.006),
                               (c + d * (longueur * 0.26), u, v, r * 0.62, 0.006, 0.006)], n)


def main_gantee(coll, leger=True):
    """Main droite gantée pour la vue subjective, au style doux, en pièces séparées et articulées.

    Repère : poignet à l'origine, doigts vers l'avant (-Y), dos de la main en haut (+Z), paume en bas, pouce à gauche
    (+X). Pièces : `main` (paume, gant sans doigts, sangle) > `manchette` (pivot au poignet), `index_1` > `index_2` > `index_3` (idem
    `majeur`, `annulaire`, `auriculaire`) et `pouce_1` > `pouce_2` > `pouce_3`. Chaque pièce a son pivot à
    l'articulation : une rotation positive autour de son axe X (local) referme le doigt vers la paume.
    """
    n = 3 if leger else 5
    main = Piece()
    # Paume et dos : gant gris, plus large aux jointures.
    _loft(main, 'gant', [((0, 0.0, 0), X, Z, 0.066, 0.04, 0.035), ((0, -0.05, 0), X, Z, 0.078, 0.037, 0.034),
                         ((0, -0.15, 0.002), X, Z, 0.088, 0.031, 0.029), ((0, -0.198, 0.002), X, Z, 0.09, 0.029, 0.027),
                         ((0, -0.214, 0.001), X, Z, 0.08, 0.022, 0.02)], n)
    # Sangle de cuir sur le dos de la main, coutures plus sombres.
    _loft(main, 'gant_sangle', [((0, -0.018, 0), X, Z, 0.074, 0.044, 0.036), ((0, -0.022, 0), X, Z, 0.077, 0.046, 0.038),
                                ((0, -0.058, 0), X, Z, 0.082, 0.042, 0.036), ((0, -0.062, 0), X, Z, 0.079, 0.04, 0.034)], n)
    main.cube('gant_sombre', (0.03, 0.03, 0.012), (0, -0.04, 0.045), 0.004)  # boucle
    racine = main.finir(coll, 'main', (0, 0, 0))
    # Manchette au poignet, liseré sombre : pièce à part (pivot au poignet), elle plie avec l'avant-bras.
    manchette = Piece()
    _loft(manchette, 'gant', [((0, -0.012, 0), X, Z, 0.064, 0.04, 0.034), ((0, 0.085, 0), X, Z, 0.062, 0.047, 0.04)], n,
          (False, False))
    _loft(manchette, 'gant_sombre', [((0, 0.08, 0), X, Z, 0.066, 0.051, 0.043), ((0, 0.098, 0), X, Z, 0.066, 0.051, 0.043)],
          n)
    manchette.finir(coll, 'manchette', (0, 0, 0), racine)

    doigts = (('index', 0.06, -0.196, 0.004, 0.021, (0.085, 0.05, 0.042)),
              ('majeur', 0.02, -0.206, 0.006, 0.022, (0.095, 0.056, 0.046)),
              ('annulaire', -0.02, -0.201, 0.004, 0.0205, (0.09, 0.053, 0.043)),
              ('auriculaire', -0.057, -0.186, -0.002, 0.0175, (0.068, 0.042, 0.037)))
    for nom, x, y, z, r, longs in doigts:
        d = Vector((x * 0.22, -1, 0)).normalized()
        p = Vector((x, y, z))
        parent = racine
        for k, L in enumerate(longs):
            piece = Piece()
            r0, r1 = r * 0.92 ** k, r * 0.92 ** (k + 1)
            _phalange(piece, p, d, L, r0, r1, n, ongle=k == 2, gant=0.42 if k == 0 else 0.0)
            parent = piece.finir(coll, f'{nom}_{k + 1}', p, parent)
            p = p + d * L

    # Pouce : part du côté de la paume, vers l'avant et l'extérieur.
    p = Vector((0.06, -0.045, -0.014))
    parent = racine
    for k, (dv, L, r0, r1) in enumerate((((0.55, -0.75, -0.28), 0.075, 0.027, 0.025),
                                          ((0.36, -0.9, -0.2), 0.06, 0.023, 0.021),
                                          ((0.22, -0.95, -0.15), 0.05, 0.021, 0.019))):
        piece = Piece()
        d = Vector(dv).normalized()
        _phalange(piece, p, d, L, r0, r1, n, ongle=k == 2, gant=0.45 if k == 1 else 0.0,
                  mat='gant' if k == 0 else 'peau_main')
        parent = piece.finir(coll, f'pouce_{k + 1}', p, parent)
        p = p + d * L


def avant_bras(coll, leger=True):
    """Avant-bras de la vue subjective : manche de combinaison au style doux, du coude (origine) au poignet (-Y).

    Longueur nominale 0,5 (25 cm) : le jeu l'étire à la longueur de l'avant-bras du personnage. Teintes `combinaison`,
    `bande`, `couture` recolorées comme la combinaison du joueur ; la manchette du gant recouvre le bout.
    """
    n = 4 if leger else 6
    piece = Piece()
    prof = [(0.03, 0.07, 0.066), (0.0, 0.088, 0.082), (-0.06, 0.092, 0.086), (-0.2, 0.084, 0.078),
            (-0.33, 0.074, 0.068), (-0.4, 0.07, 0.064)]
    _loft(piece, 'combinaison', [((0, y, 0), X, Z, a, b, min(a, b)) for y, a, b in prof], n, (True, False))
    # Bande claire autour du bras, coutures sombres de part et d'autre.
    for y0, y1, mat, k in ((-0.14, -0.2, 'bande', 1.035), (-0.135, -0.142, 'couture', 1.045),
                           (-0.198, -0.205, 'couture', 1.045)):
        a0 = 0.088 + (0.084 - 0.088) * (y0 + 0.06) / -0.14
        _loft(piece, mat, [((0, y0, 0), X, Z, a0 * k, a0 * k * 0.93, a0 * k), ((0, y1, 0), X, Z, a0 * k * 0.99,
                                                                             a0 * k * 0.92, a0 * k)], n)
    # Manchette retroussée au poignet : un bourrelet arrondi.
    _loft(piece, 'combinaison', [((0, -0.38, 0), X, Z, 0.072, 0.066, 0.066), ((0, -0.395, 0), X, Z, 0.083, 0.077, 0.077),
                                 ((0, -0.45, 0), X, Z, 0.085, 0.079, 0.079), ((0, -0.47, 0), X, Z, 0.078, 0.072, 0.072),
                                 ((0, -0.48, 0), X, Z, 0.066, 0.06, 0.06)], n)
    _loft(piece, 'couture', [((0, -0.418, 0), X, Z, 0.0865, 0.0805, 0.08), ((0, -0.424, 0), X, Z, 0.0865, 0.0805, 0.08)], n)
    piece.finir(coll, 'avant_bras', (0, 0, 0))


def pioche_hache_pierre(coll, leger=True):
    """Variante en pierre de la pioche-hache (outil de pierre)."""
    pioche_hache(coll, leger, pierre=True)


def _manche(lot, h, sg):
    lot.tube('manche', (0, 0, 0), (0, 0, h), 0.045, sg)
    lot.tube('manche_sombre', (0, 0, 0.0), (0, 0, 0.32), 0.052, sg)  # poignée
    lot.tube('manche_sombre', (0, 0, 0.0), (0, 0, 0.03), 0.06, sg)


def pioche_pierre(coll, leger=True):
    """Pioche de pierre : manche de bois, tête en silex taillé (pointe devant, talon derrière) ligaturée."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'pioche')
    h = 1.5
    _manche(lot, h, sg)
    z = h - 0.12
    lot.cube('silex', (0.12, 0.34, 0.14), (0, -0.12, z), 0.02)
    lot.cube('silex_clair', (0.09, 0.2, 0.1), (0, -0.36, z - 0.02), 0.015, Matrix.Rotation(-0.25, 3, 'X'))  # pointe
    lot.cube('silex', (0.11, 0.18, 0.12), (0, 0.14, z), 0.02)  # talon
    for k in range(3):  # ligature
        lot.cube('ficelle', (0.13, 0.03, 0.17), (0, -0.04 + k * 0.05, z), 0.005,
                 Matrix.Rotation(0.3 * (k - 1), 3, 'X'))
    lot.finir()


def pioche_fer(coll, leger=True):
    """Pioche de fer : manche de bois cerclé, tête en fer forgé (pic recourbé devant, panne plate derrière)."""
    sg = 6 if leger else 10
    lot = T.Lot(coll, 'pioche')
    h = 1.5
    _manche(lot, h, sg)
    z = h - 0.1
    lot.tube('fer_sombre', (0, 0, z - 0.14), (0, 0, z + 0.1), 0.06, sg)  # douille
    lot.cube('fer_outil', (0.1, 0.24, 0.12), (0, -0.1, z), 0.015)
    lot.cube('fer_outil', (0.08, 0.2, 0.09), (0, -0.3, z - 0.04), 0.012, Matrix.Rotation(-0.3, 3, 'X'))
    lot.cube('fer_outil', (0.05, 0.12, 0.05), (0, -0.44, z - 0.12), 0.008, Matrix.Rotation(-0.6, 3, 'X'))  # pointe
    lot.cube('fer_outil', (0.1, 0.22, 0.1), (0, 0.12, z), 0.015)
    lot.cube('fer_outil', (0.18, 0.06, 0.12), (0, 0.24, z - 0.02), 0.012)  # panne
    lot.tube('fer_sombre', (0, 0, 0.32), (0, 0, 0.36), 0.056, sg)  # bague
    lot.finir()


def _rond(piece, mat, a, b, ax, az, n, k=None, r=None):
    """Boîte arrondie (style doux) de `a` à `b` : demi-largeur `ax` (côté), demi-hauteur `az`, bouts chanfreinés `k`."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u, v = _repere(d)
    k = min(ax, az) * 0.35 if k is None else k
    r = min(ax, az) * 0.45 if r is None else r
    L = (b - a).length
    k = min(k, L * 0.3)
    _loft(piece, mat, [(a, u, v, ax - k, az - k, r - k * 0.5), (a + d * k, u, v, ax, az, r),
                       (b - d * k, u, v, ax, az, r), (b, u, v, ax - k, az - k, r - k * 0.5)], n)


def _cyl(piece, mat, a, b, r, n, k=None):
    """Cylindre aux bords adoucis de `a` à `b` (canon, lunette, goupille)."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u, v = _repere(d)
    k = r * 0.2 if k is None else k
    _loft(piece, mat, [(a, u, v, r - k, r - k, r), (a + d * k, u, v, r, r, r), (b - d * k, u, v, r, r, r),
                       (b, u, v, r - k, r - k, r)], n + 1)


def _point(coll, nom, pos, parent):
    """Repère vide (bout du canon, fenêtre d'éjection) accroché à une pièce, pour le code du jeu."""
    o = bpy.data.objects.new(nom, None)
    coll.objects.link(o)
    o.parent = parent
    o.location = Vector(pos) - Vector(parent['origine'])
    return o


def _echelle(coll, k):
    """Met tout le modèle (pièces et repères, autour de l'origine) à l'échelle `k`."""
    for o in coll.objects:
        if o.data:
            o.data.transform(Matrix.Scale(k, 4))
        o.location *= k


def pistolet(coll, leger=True):
    """Pistolet simple (semi-automatique classique) au style doux, en pièces animées. Canon vers l'avant (-Y), origine
    au milieu de la poignée.

    Culasse longue et fine en acier, carcasse noire, poignée courte et inclinée à plaquettes de bois, chargeur caché dans
    la poignée (seule la semelle dépasse). Pièces : `corps` (carcasse, poignée, pontet, chien) > `culasse` (recule au
    tir), `chargeur` (sort par le bas de la poignée, le long de son axe), `detente` ; repères `bouche` et `ejection`.
    Environ 20 cm de long.
    """
    n = 3 if leger else 5
    corps, culasse, chargeur, detente = Piece(), Piece(), Piece(), Piece()
    zb = 0.175  # axe du canon
    # Poignée courte et inclinée (vers l'arrière en bas), plaquettes de bois.
    haut, bas = Vector((0, -0.02, 0.115)), Vector((0, 0.055, -0.105))
    ax = (bas - haut).normalized()
    _rond(corps, 'arme_noir', haut, bas, 0.032, 0.047, n, k=0.012)
    for sx in (1, -1):
        _rond(corps, 'arme_bois', haut + ax * 0.05 + Vector((sx * 0.022, 0, 0)), bas - ax * 0.035 + Vector((sx * 0.022, 0, 0)),
              0.013, 0.037, n, k=0.006)
    # Carcasse sous la culasse, pontet arrondi, petit chien à l'arrière.
    _rond(corps, 'arme_noir', (0, 0.045, 0.12), (0, -0.27, 0.12), 0.03, 0.025, n, k=0.01)
    _loft(corps, 'arme_noir', [((0, -0.055, 0.1), Y, Z, 0.016, 0.008, 0.006), ((0, -0.1, 0.055), Y, Z, 0.016, 0.008, 0.006),
                               ((0, -0.16, 0.05), Y, Z, 0.016, 0.008, 0.006), ((0, -0.185, 0.08), Y, Z, 0.016, 0.008, 0.006),
                               ((0, -0.19, 0.105), Y, Z, 0.016, 0.008, 0.006)], n)
    _cyl(corps, 'arme_acier_clair', (0, -0.3, zb), (0, -0.345, zb), 0.016, n)  # bout du canon
    _rond(corps, 'arme_acier', (0, 0.055, zb + 0.005), (0, 0.085, zb + 0.03), 0.014, 0.016, n, k=0.005)  # chien
    racine = corps.finir(coll, 'corps', (0, 0, 0))
    # Culasse : longue et fine, stries à l'arrière, guidon et hausse.
    _rond(culasse, 'arme_acier', (0, 0.07, zb), (0, -0.335, zb), 0.032, 0.04, n, k=0.012)
    for i in range(3):
        y = 0.04 - i * 0.018
        for sx in (1, -1):
            culasse.cube('arme_noir', (0.006, 0.006, 0.05), (sx * 0.032, y, zb), 0.0015)
    culasse.cube('arme_noir', (0.022, 0.06, 0.004), (0, -0.12, zb + 0.04), 0.001)  # fenêtre d'éjection
    _rond(culasse, 'arme_noir', (0, -0.3, zb + 0.038), (0, -0.315, zb + 0.05), 0.006, 0.009, n, k=0.003)  # guidon
    _rond(culasse, 'arme_noir', (0, 0.035, zb + 0.038), (0, 0.055, zb + 0.052), 0.022, 0.009, n, k=0.003)  # hausse
    culasse.finir(coll, 'culasse', (0, 0, zb), racine)
    # Chargeur caché dans la poignée : seule la semelle dépasse en bas.
    _rond(chargeur, 'arme_acier_clair', haut + ax * 0.04, bas, 0.024, 0.036, n, k=0.008)
    _rond(chargeur, 'arme_noir', bas - ax * 0.004, bas + ax * 0.018, 0.034, 0.05, n, k=0.007)
    chargeur.finir(coll, 'chargeur', tuple(bas), racine)
    _rond(detente, 'arme_acier', (0, -0.1, 0.105), (0, -0.115, 0.065), 0.007, 0.009, n, k=0.003)
    detente.finir(coll, 'detente', (0, -0.1, 0.105), racine)
    _point(coll, 'bouche', (0, -0.35, zb), racine)
    _point(coll, 'ejection', (0, -0.12, zb + 0.045), racine)
    _brillant()


def fusil(coll, leger=True):
    """Fusil automatique (fusil d'assaut) au style doux, en pièces animées. Canon vers l'avant (-Y), origine au milieu
    de la poignée.

    Bois orangé (crosse, garde-main), boîtier gris acier, chargeur courbe, guidon et hausse. Pièces : `corps` >
    `levier` (levier d'armement à droite, recule au tir), `chargeur` (se décroche vers le bas et l'avant), `detente` ;
    repères `bouche` et `ejection`. Environ 1 m de long.
    """
    n = 3 if leger else 5
    corps, levier, chargeur, detente = Piece(), Piece(), Piece(), Piece()
    zb = 0.3  # axe du canon
    # Poignée pistolet.
    haut, bas = Vector((0, -0.03, 0.2)), Vector((0, 0.07, -0.13))
    _rond(corps, 'arme_noir', haut, bas, 0.042, 0.058, n)
    # Boîtier, couvercle et rail.
    _rond(corps, 'arme_acier', (0, 0.25, zb - 0.01), (0, -0.48, zb - 0.01), 0.055, 0.085, n, k=0.02)
    _rond(corps, 'arme_acier_clair', (0, 0.22, zb + 0.08), (0, -0.4, zb + 0.08), 0.045, 0.02, n, k=0.01)
    _rond(corps, 'arme_noir', (0, -0.36, zb - 0.03), (0, -0.4, zb - 0.09), 0.05, 0.018, n, k=0.006)  # arrêtoir
    # Garde-main en bois avec fentes, canon, tube de gaz, guidon, cache-flamme.
    _rond(corps, 'arme_bois', (0, -0.48, zb - 0.02), (0, -0.98, zb - 0.02), 0.062, 0.07, n, k=0.02)
    for i in range(4):
        y = -0.58 - i * 0.1
        for sx in (1, -1):
            corps.cube('arme_noir', (0.006, 0.05, 0.022), (sx * 0.062, y, zb - 0.02), 0.004)
    _cyl(corps, 'arme_acier', (0, -0.98, zb), (0, -1.66, zb), 0.026, n)
    _cyl(corps, 'arme_acier', (0, -0.98, zb + 0.06), (0, -1.28, zb + 0.06), 0.018, n)
    _rond(corps, 'arme_acier', (0, -1.26, zb - 0.01), (0, -1.31, zb + 0.13), 0.022, 0.028, n, k=0.008)
    _rond(corps, 'arme_noir', (0, -1.57, zb + 0.03), (0, -1.6, zb + 0.13), 0.01, 0.014, n, k=0.004)
    _cyl(corps, 'arme_noir', (0, -1.62, zb), (0, -1.76, zb), 0.04, n)
    for i in range(3):
        corps.cube('arme_acier_clair', (0.084, 0.012, 0.012), (0, -1.66 - i * 0.035, zb + 0.026), 0.003)
    _rond(corps, 'arme_noir', (0, 0.06, zb + 0.11), (0, 0.13, zb + 0.11), 0.035, 0.02, n, k=0.006)  # hausse
    # Crosse en bois : du boîtier à la plaque de couche, plus haute à l'arrière.
    _loft(corps, 'arme_bois', [((0, 0.24, zb - 0.02), X, Z, 0.05, 0.075, 0.04), ((0, 0.3, zb - 0.035), X, Z, 0.055, 0.085, 0.045),
                               ((0, 0.6, zb - 0.08), X, Z, 0.058, 0.13, 0.05), ((0, 0.92, zb - 0.11), X, Z, 0.06, 0.17, 0.05)],
          n, (True, False))
    _loft(corps, 'arme_noir', [((0, 0.915, zb - 0.11), X, Z, 0.062, 0.172, 0.05), ((0, 0.96, zb - 0.11), X, Z, 0.058, 0.165, 0.048)],
          n)
    # Pontet.
    _rond(corps, 'arme_noir', (0, -0.04, 0.12), (0, -0.2, 0.12), 0.02, 0.01, n, k=0.005)
    _rond(corps, 'arme_noir', (0, -0.2, 0.12), (0, -0.22, 0.22), 0.02, 0.01, n, k=0.005)
    racine = corps.finir(coll, 'corps', (0, 0, 0))
    # Levier d'armement, côté droit (-X) du boîtier.
    _rond(levier, 'arme_acier_clair', (-0.05, -0.2, zb + 0.03), (-0.05, -0.32, zb + 0.03), 0.01, 0.014, n, k=0.004)
    _rond(levier, 'arme_noir', (-0.055, -0.3, zb + 0.03), (-0.11, -0.31, zb + 0.03), 0.018, 0.018, n, k=0.006)
    levier.finir(coll, 'levier', (-0.05, -0.3, zb + 0.03), racine)
    # Chargeur courbe (banane), nervures.
    secs = []
    for i in range(7 if leger else 11):
        t = i / (6 if leger else 10)
        ang = 0.55 * t
        c = Vector((0, -0.23 - 0.42 * math.sin(ang) * 0.9, zb - 0.06 - 0.5 * t))
        dz = Vector((0, -math.sin(ang), -math.cos(ang)))
        u, v = X, dz.cross(X).normalized()
        if v.y > 0:
            v = -v
        secs.append((c, u, v, 0.04, 0.075, 0.03))
    _loft(chargeur, 'arme_noir', secs, n)
    c_bas = secs[-1][0]
    chargeur.cube('arme_acier', (0.09, 0.17, 0.03), tuple(c_bas + Vector((0, -0.01, -0.012))), 0.01,
                  Matrix.Rotation(-0.55, 3, 'X'))
    m = len(secs) - 1
    for i in (m // 3, 2 * m // 3):
        cc = secs[i][0]
        chargeur.cube('arme_acier', (0.085, 0.155, 0.012), tuple(cc), 0.004, Matrix.Rotation(-0.55 * i / m, 3, 'X'))
    chargeur.finir(coll, 'chargeur', (0, -0.23, zb - 0.06), racine)
    _rond(detente, 'arme_acier', (0, -0.1, 0.2), (0, -0.115, 0.14), 0.009, 0.012, n, k=0.004)
    detente.finir(coll, 'detente', (0, -0.1, 0.2), racine)
    _point(coll, 'bouche', (0, -1.77, zb), racine)
    _point(coll, 'ejection', (-0.06, -0.15, zb + 0.04), racine)
    _echelle(coll, 0.74)  # environ 1 m
    _brillant()


def sniper(coll, leger=True):
    """Fusil de précision (sniper) à verrou au style doux, en pièces animées. Canon vers l'avant (-Y), origine au milieu
    de la poignée.

    Crosse et fût sable à appui-joue, long canon, frein de bouche, grosse lunette (verre bleuté), bipied replié sous le
    canon. Pièces : `corps` > `culasse` (verrou à levier boule à droite : se lève puis recule, pivot sur son axe),
    `chargeur` (boîte, sort par le bas), `detente`, `bipied_g` et `bipied_d` (pivot à la charnière, rotation pour les
    déplier) ; repères `bouche` et `ejection`. Environ 1,3 m de long.
    """
    n = 3 if leger else 5
    corps, culasse, chargeur, detente, bg, bd = Piece(), Piece(), Piece(), Piece(), Piece(), Piece()
    zb = 0.3
    haut, bas = Vector((0, -0.02, 0.21)), Vector((0, 0.08, -0.12))
    _rond(corps, 'arme_sable', haut, bas, 0.044, 0.06, n)
    # Fût et crosse sable (une pièce), appui-joue, plaque de couche.
    _rond(corps, 'arme_sable', (0, -0.3, zb - 0.06), (0, -1.0, zb - 0.06), 0.06, 0.06, n, k=0.025)
    _loft(corps, 'arme_sable', [((0, -0.3, zb - 0.06), X, Z, 0.06, 0.06, 0.05), ((0, 0.15, zb - 0.07), X, Z, 0.058, 0.08, 0.05),
                                ((0, 0.4, zb - 0.1), X, Z, 0.055, 0.1, 0.045), ((0, 0.75, zb - 0.1), X, Z, 0.058, 0.15, 0.05),
                                ((0, 1.12, zb - 0.1), X, Z, 0.06, 0.18, 0.05)], n, (False, False))
    _rond(corps, 'arme_sable_sombre', (0, 0.5, zb + 0.06), (0, 0.95, zb + 0.06), 0.05, 0.03, n, k=0.012)  # appui-joue
    _loft(corps, 'arme_noir', [((0, 1.115, zb - 0.1), X, Z, 0.062, 0.182, 0.05), ((0, 1.16, zb - 0.1), X, Z, 0.058, 0.175, 0.048)], n)
    # Boîtier acier et canon, frein de bouche.
    _cyl(corps, 'arme_acier', (0, 0.2, zb), (0, -0.36, zb), 0.05, n)
    _cyl(corps, 'arme_acier', (0, -0.36, zb), (0, -1.9, zb), 0.03, n)
    _rond(corps, 'arme_noir', (0, -1.9, zb), (0, -2.04, zb), 0.045, 0.045, n, k=0.012)
    for i in range(3):
        for sx in (1, -1):
            corps.cube('arme_acier_clair', (0.01, 0.022, 0.05), (sx * 0.045, -1.93 - i * 0.035, zb), 0.003)
    # Lunette : tube, bague avant évasée, oculaire, tourelles, colliers.
    zs = zb + 0.17
    _cyl(corps, 'arme_noir', (0, 0.2, zs), (0, -0.42, zs), 0.042, n + 1)
    _loft(corps, 'arme_noir', [((0, -0.36, zs), X, Z, 0.042, 0.042, 0.042), ((0, -0.46, zs), X, Z, 0.068, 0.068, 0.068),
                               ((0, -0.55, zs), X, Z, 0.07, 0.07, 0.07)], n + 1, (False, False))
    _loft(corps, 'verre_lunette', [((0, -0.548, zs), X, Z, 0.06, 0.06, 0.06), ((0, -0.556, zs), X, Z, 0.058, 0.058, 0.058)], n + 1)
    _loft(corps, 'arme_noir', [((0, 0.18, zs), X, Z, 0.042, 0.042, 0.042), ((0, 0.24, zs), X, Z, 0.058, 0.058, 0.058),
                               ((0, 0.3, zs), X, Z, 0.056, 0.056, 0.056)], n + 1, (False, True))
    _loft(corps, 'verre_lunette', [((0, 0.298, zs), X, Z, 0.046, 0.046, 0.046), ((0, 0.305, zs), X, Z, 0.044, 0.044, 0.044)], n + 1)
    _cyl(corps, 'arme_noir', (0, -0.1, zs + 0.03), (0, -0.1, zs + 0.085), 0.03, n)
    _cyl(corps, 'arme_noir', (-0.03, -0.1, zs), (-0.085, -0.1, zs), 0.026, n)
    for y in (0.08, -0.25):
        _rond(corps, 'arme_acier', (0, y, zb + 0.03), (0, y, zs - 0.03), 0.03, 0.022, n, k=0.006)
        _cyl(corps, 'arme_acier', (0, y + 0.025, zs), (0, y - 0.025, zs), 0.05, n)
    # Pontet, charnière du bipied.
    _rond(corps, 'arme_noir', (0, -0.02, 0.13), (0, -0.18, 0.13), 0.02, 0.01, n, k=0.005)
    _rond(corps, 'arme_noir', (0, -0.18, 0.13), (0, -0.2, 0.22), 0.02, 0.01, n, k=0.005)
    _rond(corps, 'arme_noir', (0, -0.88, zb - 0.12), (0, -0.96, zb - 0.12), 0.05, 0.025, n, k=0.008)
    racine = corps.finir(coll, 'corps', (0, 0, 0))
    # Verrou : cylindre dans le boîtier, levier coudé à boule à droite (-X).
    _cyl(culasse, 'arme_acier_clair', (0, 0.22, zb), (0, 0.06, zb), 0.032, n)
    _rond(culasse, 'arme_acier_clair', (-0.02, 0.15, zb), (-0.15, 0.17, zb - 0.05), 0.016, 0.016, n, k=0.005)
    culasse.boule('arme_noir', (-0.16, 0.172, zb - 0.055), 0.038)
    culasse.finir(coll, 'culasse', (0, 0.15, zb), racine)
    # Chargeur boîte.
    _rond(chargeur, 'arme_noir', (0, -0.08, zb - 0.06), (0, -0.08, zb - 0.26), 0.04, 0.075, n, k=0.012)
    chargeur.finir(coll, 'chargeur', (0, -0.08, zb - 0.26), racine)
    _rond(detente, 'arme_acier', (0, -0.08, 0.21), (0, -0.095, 0.15), 0.009, 0.012, n, k=0.004)
    detente.finir(coll, 'detente', (0, -0.08, 0.21), racine)
    # Bipied replié vers l'avant le long du canon (pieds écartés de part et d'autre).
    for piece, sx, nom in ((bg, 1, 'bipied_g'), (bd, -1, 'bipied_d')):
        pivot = Vector((sx * 0.04, -0.92, zb - 0.13))
        _rond(piece, 'arme_noir', pivot, pivot + Vector((sx * 0.01, -0.42, 0.0)), 0.014, 0.014, n, k=0.004)
        _rond(piece, 'arme_acier_clair', pivot + Vector((sx * 0.01, -0.3, 0)), pivot + Vector((sx * 0.012, -0.5, 0)), 0.011,
              0.011, n, k=0.004)
        piece.boule('arme_noir', tuple(pivot + Vector((sx * 0.012, -0.52, 0))), 0.02)
        piece.finir(coll, nom, tuple(pivot), racine)
    _point(coll, 'bouche', (0, -2.05, zb), racine)
    _point(coll, 'ejection', (-0.05, 0.1, zb + 0.04), racine)
    _echelle(coll, 0.8)  # environ 1,3 m
    _brillant()


MODELES = {
    'pioche_pierre': pioche_pierre,
    'pioche_fer': pioche_fer,
    'pioche_hache': pioche_hache,
    'pioche_hache_pierre': pioche_hache_pierre,
    'main_gantee': main_gantee,
    'avant_bras': avant_bras,
    'pistolet': pistolet,
    'fusil': fusil,
    'sniper': sniper,
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


# Modèles en pièces séparées (hiérarchie et pivots gardés à l'export).
EN_PIECES = {'pioche_hache', 'pioche_hache_pierre', 'main_gantee', 'avant_bras', 'pistolet', 'fusil', 'sniper'}


def exporter(noms=None):
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        if noms and nom not in noms:
            continue
        if nom in EN_PIECES:
            print('export web   :', _export_hier(bpy.data.collections[nom], export, nom))
            print('export Unity :', _export_hier(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))
            continue
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'outils.blend'))


if __name__ == '__main__':
    main()
