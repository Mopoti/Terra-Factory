"""Famille « logistique » : convoyeurs (droit, virage, rampe, tunnel, pilier), plus tard séparateurs, bras, coffres…

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Convoyeurs : une tuile = 2 x 2 cases = 2 unités Blender (1 m). Tous les éléments tiennent dans X, Y de -1 à 1 (repères
d'emprise aux coins). Le dessus du tapis (là où roulent les objets) est à Z = 0,4 (20 cm, `BELT_H` du jeu) : c'est aussi
le point le plus haut des modèles plats, pour que le jeu ne les écrase pas. Le tapis droit circule le long de X ; le
virage relie les côtés -X et -Y (centre de la courbe au coin (-1 ; -1)), comme les modèles du kit qu'il remplace.
Lames en forme de flèche sur la bande : elles montrent le sens du tapis. Tous les modèles font avancer les objets vers +X,
sauf les virages (de -X vers -Y, ou de -Y vers -X pour le virage inverse).
Palier T1 : châssis acier sombre, rives jaunes (T2 : bleues, T3 : blanches, à faire).

Lancer :  blender --background --python blender/scripts/logistique.py
Produit :  blender/logistique.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
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

# Coupe d'un convoyeur (Y = demi-largeur, Z = hauteur), commune à toutes les formes.
LARG_BANDE = 0.66   # demi-largeur de la bande
Y_LONG = 0.74       # axe des longerons
EP_LONG = 0.06      # épaisseur des longerons
Z_BANDE = (0.32, 0.37)    # bande porteuse (dessous, dessus)
Z_RETOUR = (0.15, 0.18)   # brin de retour
Z_LONG = (0.12, 0.36)     # longerons
Z_RIVE = (0.36, 0.40)     # rives (dessus = 0,4 = BELT_H)
RIVE = 'jaune'            # couleur du palier T1


def _lot(coll, nom, leger):
    lot = T.Lot(coll, nom)
    if leger:
        lot.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(lot.cube)
    return lot


def _secteur(coll, nom, r0, r1, z0, z1, mat, n, centre=(-1.0, -1.0), a0=0.0, a1=math.pi / 2):
    """Anneau en quart de cercle (de l'angle a0 à a1) entre les rayons r0 et r1, de z0 à z1 : pièce courbe du virage."""
    bm = bmesh.new()
    cx, cy = centre
    rings = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((cx + r * c, cy + r * s, z)) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return T._object(coll, nom, bm, mat)


def _prisme(coll, nom, profil, y0, y1, mat):
    """Profil convexe dans le plan (x, z), extrudé le long de Y de y0 à y1 (pièces de la rampe)."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in profil]
    b = [bm.verts.new((x, y1, z)) for x, z in profil]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(len(profil)):
        j = (i + 1) % len(profil)
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return T._object(coll, nom, bm, mat)


def _chevron(lot, centre, d, n, larg=0.56, fleche=0.13, ep=0.045, mat='acier'):
    """Lame en forme de flèche (chevron) posée sur la bande au point `centre` : pointe dans le sens `d` du mouvement,
    `n` = normale de la bande (vers le haut). Indique le sens du tapis ; elle défile avec la bande (groupe `bande_`)."""
    c, d, n = Vector(centre), Vector(d).normalized(), Vector(n).normalized()
    w = n.cross(d).normalized()
    pointe = c + d * fleche
    for s in (-1, 1):
        bout = c - d * fleche + w * (s * larg)
        u = (pointe - bout).normalized()
        L = (pointe - bout).length
        rot = Matrix((u, n.cross(u), n)).transposed()
        lot.cube(mat, (L + ep * 0.5, ep, 0.006), tuple((pointe + bout) / 2 + n * 0.003), 0, rot)


def _troncon(lot, bande, x0, x1, sg, pieds=True):
    """Tronçon droit de convoyeur le long de X, de x0 à x1 (même coupe que le tapis droit)."""
    L, xm = x1 - x0, (x0 + x1) / 2
    lot.cube('noir', (L, 2 * LARG_BANDE, Z_BANDE[1] - Z_BANDE[0]), (xm, 0, sum(Z_BANDE) / 2))
    lot.cube('noir', (L, 2 * LARG_BANDE - 0.08, Z_RETOUR[1] - Z_RETOUR[0]), (xm, 0, sum(Z_RETOUR) / 2))
    for s in (-1, 1):
        lot.cube('acier_sombre', (L, EP_LONG, Z_LONG[1] - Z_LONG[0]), (xm, s * Y_LONG, sum(Z_LONG) / 2))
        lot.cube(RIVE, (L, 0.1, Z_RIVE[1] - Z_RIVE[0]), (xm, s * Y_LONG, sum(Z_RIVE) / 2))
        lot.cube('acier_sombre', (L, 0.012, 0.03), (xm, s * (Y_LONG + 0.036), 0.17))  # nervure basse
    # Rouleaux (bouts d'axes sur les longerons) tous les 0,5.
    xs = [v for v in (-0.75, -0.25, 0.25, 0.75) if x0 + 0.05 < v < x1 - 0.05]
    for v in xs:
        for s in (-1, 1):
            lot.tube('acier', (v, s * (Y_LONG + 0.03), 0.3), (v, s * (Y_LONG + 0.05), 0.3), 0.035, sg)
    # Lames en flèche, vers +X (sens du tapis), qui défilent : groupe `bande_`.
    for v in (-0.75, -0.25, 0.25, 0.75):
        if x0 + 0.13 < v < x1 - 0.13:
            _chevron(bande, (v, 0, Z_BANDE[1]), (1, 0, 0), (0, 0, 1))
    if pieds and x0 < 0 < x1:  # une paire de pieds par tuile, au milieu (rien aux joints)
        for s in (-1, 1):
            lot.cube('acier_sombre', (0.08, 0.08, Z_LONG[0]), (0, s * Y_LONG, Z_LONG[0] / 2))
            lot.cube('acier', (0.18, 0.16, 0.02), (0, s * Y_LONG, 0.01))  # platine
        lot.cube('acier_sombre', (0.05, 2 * Y_LONG, 0.04), (0, 0, 0.06))  # entretoise


def convoyeur_t1(coll, leger=True):
    """Tapis droit T1 (`conveyor`, palier 1, forme `straight`) : une tuile, le long de X, dessus à Z = 0,4.
    Pièces mobiles : `bande_` (lames de la bande) défile le long de X (pas 0,5)."""
    sg = 8 if leger else 14
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    _troncon(lot, bande, -1.0, 1.0, sg)
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def _virage(coll, leger, inverse):
    """Quart de cercle de rayon 1 centré au coin (-1 ; -1), qui relie le milieu du côté -X au milieu du côté -Y. Mêmes
    hauteurs que le tapis droit. Sens : de -X vers -Y, ou de -Y vers -X si `inverse`."""
    n = 8 if leger else 16
    sg = 8 if leger else 14
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    R = 1.0
    _secteur(coll, 'bande_porteuse', R - LARG_BANDE, R + LARG_BANDE, *Z_BANDE, 'noir', n)
    _secteur(coll, 'bande_retour', R - LARG_BANDE + 0.04, R + LARG_BANDE - 0.04, *Z_RETOUR, 'noir', n)
    for s in (-1, 1):
        r = R + s * Y_LONG
        _secteur(coll, f'longeron_{s}', r - EP_LONG / 2, r + EP_LONG / 2, *Z_LONG, 'acier_sombre', n)
        _secteur(coll, f'rive_{s}', r - 0.05, r + 0.05, *Z_RIVE, RIVE, n)
        _secteur(coll, f'nervure_{s}', r + s * 0.03 - 0.006, r + s * 0.03 + 0.006, 0.155, 0.185, 'acier_sombre', n)
    C = Vector((-1.0, -1.0, 0.0))
    for k in range(3):  # lames en flèche (dans le sens du tapis), tous les 22,5°
        a = (k + 1) * math.pi / 8
        u = Vector((math.cos(a), math.sin(a), 0))
        t = Vector((math.sin(a), -math.cos(a), 0)) * (-1 if inverse else 1)  # de -X vers -Y : l'angle décroît
        _chevron(bande, C + u * R + Vector((0, 0, Z_BANDE[1])), t, (0, 0, 1), larg=0.54, fleche=0.11)
    for k in range(4):  # rouleaux
        a = (k + 0.5) * math.pi / 8
        u = Vector((math.cos(a), math.sin(a), 0))
        for s in (-1, 1):
            r = R + s * (Y_LONG + 0.04)
            lot.tube('acier', tuple(C + u * (r - 0.01) + Vector((0, 0, 0.3))), tuple(C + u * (r + 0.01) + Vector((0, 0, 0.3))), 0.035, sg)
    a = math.pi / 4  # pieds au milieu de la courbe
    u = Vector((math.cos(a), math.sin(a), 0))
    for s in (-1, 1):
        p = C + u * (R + s * Y_LONG)
        lot.cube('acier_sombre', (0.08, 0.08, Z_LONG[0]), (p.x, p.y, Z_LONG[0] / 2), 0, Matrix.Rotation(a, 3, 'Z'))
        lot.cube('acier', (0.16, 0.18, 0.02), (p.x, p.y, 0.01), 0, Matrix.Rotation(a, 3, 'Z'))
    p0, p1 = C + u * (R - Y_LONG), C + u * (R + Y_LONG)
    lot.barre('acier_sombre', (p0.x, p0.y, 0.06), (p1.x, p1.y, 0.06), 0.045)
    T.pivot(coll, 'pivot_bande', (-1.0, -1.0, Z_BANDE[1]), (0, 0, 1))
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def convoyeur_virage_t1(coll, leger=True):
    """Virage T1 (`conveyor`, palier 1, forme `corner`) : les objets entrent par le côté -X et sortent par le côté -Y.
    Pièces mobiles : `bande_` (lames en flèche) tourne autour de l'axe Z passant par (-1 ; -1), angle décroissant."""
    _virage(coll, leger, False)


def convoyeur_virage_inverse_t1(coll, leger=True):
    """Virage T1 dans l'autre sens (`conveyor`, palier 1, forme `cornerBack`) : même pièce que `convoyeur_virage_t1`,
    les objets entrent par le côté -Y et sortent par le côté -X (flèches retournées).
    Pièces mobiles : `bande_` tourne autour de l'axe Z passant par (-1 ; -1), angle croissant."""
    _virage(coll, leger, True)


def _rampe(coll, leger, descente):
    """Rampe d'un niveau (1 m = 2 unités) sur une tuile, à 45°. Les objets avancent toujours vers +X : la montée va du
    bas (-X, dessus à 0,4) au haut (+X, dessus à 2,4) ; la descente l'inverse."""
    sg = 8 if leger else 14
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    m = -1.0 if descente else 1.0  # sens de la pente le long de X

    def zx(x):  # hauteur gagnée au point x
        return 1.0 + m * x

    def para(zb, zh):
        return [(-1.0, zb + zx(-1.0)), (1.0, zb + zx(1.0)), (1.0, zh + zx(1.0)), (-1.0, zh + zx(-1.0))]
    _prisme(coll, 'bande_porteuse', para(*Z_BANDE), -LARG_BANDE, LARG_BANDE, 'noir')
    _prisme(coll, 'bande_retour', para(*Z_RETOUR), -LARG_BANDE + 0.04, LARG_BANDE - 0.04, 'noir')
    for s in (-1, 1):
        y = s * Y_LONG
        _prisme(coll, f'longeron_{s}', para(*Z_LONG), y - EP_LONG / 2, y + EP_LONG / 2, 'acier_sombre')
        _prisme(coll, f'rive_{s}', para(*Z_RIVE), y - 0.05, y + 0.05, RIVE)
    d = Vector((1, 0, m)).normalized()       # sens du mouvement, le long de la pente
    nrm = Vector((-m, 0, 1)).normalized()    # normale de la bande
    pente = Matrix.Rotation(-m * math.pi / 4, 3, 'Y')
    for k in range(5):  # lames en flèche et tasseaux
        x = -0.8 + k * 0.4
        p = Vector((x, 0, Z_BANDE[1] + zx(x)))
        _chevron(bande, p, d, nrm, larg=0.54, fleche=0.1)
        bande.cube('acier_sombre', (0.03, 2 * LARG_BANDE - 0.08, 0.05), tuple(p + nrm * 0.025 - d * 0.16), 0, pente)
    for x in (-0.5, 0.0, 0.5):  # rouleaux
        for s in (-1, 1):
            lot.tube('acier', (x, s * (Y_LONG + 0.03), 0.3 + zx(x)), (x, s * (Y_LONG + 0.05), 0.3 + zx(x)), 0.035, sg)
    pieds = (-0.45 * m, 0.55 * m)
    for x in pieds:  # pieds sous la pente, entretoises
        zt = Z_LONG[0] + zx(x)
        for s in (-1, 1):
            lot.cube('acier_sombre', (0.08, 0.08, zt), (x, s * Y_LONG, zt / 2))
            lot.cube('acier', (0.18, 0.16, 0.02), (x, s * Y_LONG, 0.01))
        lot.cube('acier_sombre', (0.05, 2 * Y_LONG, 0.04), (x, 0, min(zt - 0.1, 0.5)))
    for s in (-1, 1):  # contreventement
        lot.barre('acier', (pieds[0], s * Y_LONG, 0.1), (pieds[1], s * Y_LONG, Z_LONG[0] + zx(pieds[1]) - 0.1), 0.03)
    T.pivot(coll, 'pivot_bande', (-1.0, 0, Z_BANDE[1] + zx(-1.0)), tuple(d))
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def convoyeur_rampe_t1(coll, leger=True):
    """Rampe montante T1 (`conveyor`, formes 1 et 6) : de -X (dessus à 0,4) à +X (dessus à 2,4), objets vers +X.
    Tasseaux et lames en flèche. Pièces mobiles : `bande_` glisse vers le haut de la pente."""
    _rampe(coll, leger, False)


def convoyeur_rampe_descente_t1(coll, leger=True):
    """Rampe descendante T1 (`conveyor`, formes 3 et 8) : de -X (dessus à 2,4) à +X (dessus à 0,4), objets vers +X.
    Pièces mobiles : `bande_` glisse vers le bas de la pente."""
    _rampe(coll, leger, True)


def _tunnel(coll, leger, entree):
    """Entrée (objets vers +X, disparaissent dans la bouche) ou sortie (bouche côté -X, objets ressortent vers +X)."""
    sg = 8 if leger else 14
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    s_ = 1 if entree else -1   # côté de la bouche
    xb = 0.25 * s_             # façade de la bouche
    # Tapis jusque dans la bouche.
    if entree:
        _troncon(lot, bande, -1.0, xb + 0.1, sg, pieds=False)
    else:
        _troncon(lot, bande, xb - 0.1, 1.0, sg, pieds=False)
    xp = (-1.0 + xb) / 2 if entree else (xb + 1.0) / 2
    for s in (-1, 1):  # pieds au milieu du tapis visible
        lot.cube('acier_sombre', (0.08, 0.08, Z_LONG[0]), (xp, s * Y_LONG, Z_LONG[0] / 2))
        lot.cube('acier', (0.18, 0.16, 0.02), (xp, s * Y_LONG, 0.01))
    # Bouche : massif de béton qui plonge dans le sol, cadre et ouverture sombre.
    xf = 1.0 * s_
    prof = [(xb, 0.0), (xf, 0.0), (xf, 0.3), (xb + 0.12 * s_, 0.95), (xb, 0.95)]
    if not entree:
        prof = [(x, z) for x, z in reversed(prof)]
    _prisme(coll, 'bouche', prof, -0.92, 0.92, 'beton')
    lot.cube('noir', (0.012, 1.44, 0.5), (xb - 0.006 * s_, 0, 0.12 + 0.25))  # ouverture
    lot.cube('noir', (0.4, 1.44, 0.5), (xb + 0.2 * s_, 0, 0.37))  # fond (on ne voit pas à travers)
    for y in (-0.8, 0.8):  # piédroits
        lot.cube('acier_sombre', (0.06, 0.12, 0.66), (xb - 0.03 * s_, y, 0.33))
    for k in range(8):  # linteau rayé jaune et noir
        lot.cube('jaune' if k % 2 == 0 else 'noir', (0.065, 1.72 / 8, 0.14), (xb - 0.03 * s_, -0.86 + (k + 0.5) * 1.72 / 8, 0.72))
    lot.cube('acier_sombre', (0.16, 1.9, 0.05), (xb + 0.04 * s_, 0, 0.975))  # chaperon
    if not leger:
        for k in range(3):  # rideau à lanières
            lot.cube('acier_sombre', (0.006, 0.4, 0.2), (xb - 0.07 * s_, -0.45 + k * 0.45, 0.52))
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def convoyeur_tunnel_entree_t1(coll, leger=True):
    """Entrée de tunnel T1 (`conveyor`, forme 4) : les objets avancent vers +X et disparaissent dans la bouche (côté +X).
    Pièces mobiles : `bande_` défile le long de X."""
    _tunnel(coll, leger, True)


def convoyeur_tunnel_sortie_t1(coll, leger=True):
    """Sortie de tunnel T1 (`conveyor`, forme 5) : les objets ressortent de la bouche (côté -X) et avancent vers +X.
    Pièces mobiles : `bande_` défile le long de X."""
    _tunnel(coll, leger, False)


def pilier_convoyeur_t1(coll, leger=True):
    """Pilier T1 sous un tapis surélevé : de Z = 0 à Z = 2 (dessous d'un tapis du niveau 1, 1 m). Pour le niveau 2, en
    poser deux l'un sur l'autre (ou l'étirer en hauteur). Tête large qui porte les deux longerons."""
    lot = _lot(coll, 'pieces', leger)
    h = 2.0
    lot.cube('acier_sombre', (0.42, 0.42, 0.04), (0, 0, 0.02))  # platine
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.tube('acier', (sx * 0.16, sy * 0.16, 0.04), (sx * 0.16, sy * 0.16, 0.08), 0.02, 6)  # boulons
    lot.cube('acier', (0.2, 0.2, h - 0.1), (0, 0, 0.04 + (h - 0.1) / 2))  # fût
    lot.cube('jaune', (0.21, 0.21, 0.25), (0, 0, 0.4))  # bande de repérage
    lot.cube('noir', (0.212, 0.212, 0.05), (0, 0, 0.3))
    lot.cube('noir', (0.212, 0.212, 0.05), (0, 0, 0.5))
    lot.cube('acier_sombre', (0.24, 1.6, 0.08), (0, 0, h - 0.04))  # tête
    for s in (-1, 1):  # jambes de force sous la tête
        lot.barre('acier_sombre', (0, s * 0.1, h - 0.55), (0, s * 0.7, h - 0.08), 0.06)
    lot.finir()
    T.poser_au_sol(coll, 1.0)


MODELES = {
    'convoyeur_t1': convoyeur_t1,
    'convoyeur_virage_t1': convoyeur_virage_t1,
    'convoyeur_virage_inverse_t1': convoyeur_virage_inverse_t1,
    'convoyeur_rampe_t1': convoyeur_rampe_t1,
    'convoyeur_rampe_descente_t1': convoyeur_rampe_descente_t1,
    'convoyeur_tunnel_entree_t1': convoyeur_tunnel_entree_t1,
    'convoyeur_tunnel_sortie_t1': convoyeur_tunnel_sortie_t1,
    'pilier_convoyeur_t1': pilier_convoyeur_t1,
}


def construire():
    """Crée, pour chaque modèle, la collection web (légère) et la collection Unity (détaillée)."""
    for nom, fabrique in MODELES.items():
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter():
    export = os.path.join(ROOT, 'export')
    for nom in MODELES:
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'logistique.blend'))


if __name__ == '__main__':
    main()
