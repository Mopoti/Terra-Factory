"""Famille « logistique » : convoyeurs (droit, virage, rampe, tunnel, pilier), séparateur, groupeur, trieur, bras T1 à T3.

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
Paliers (de plus en plus « chaud », de plus en plus rapide) : T1 = châssis acier sombre, rives jaunes, flèches simples ;
T2 (rapide) = châssis acier, rives orange vif, flèches doubles ; T3 (express) = châssis gris clair, rives rouges,
flèches triples.

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
# Style du palier en cours de construction (voir `PALIERS` et `_palier`).
PALIERS = {
    1: {'rive': 'rive_t1', 'chassis': 'acier_sombre', 'fleches': 1},  # T1 : tapis de base
    2: {'rive': 'rive_t2', 'chassis': 'acier', 'fleches': 2},    # T2 : tapis rapide, flèches doubles
    3: {'rive': 'rive_t3', 'chassis': 'gris_clair', 'fleches': 3},    # T3 : tapis express (rouge = vitesse), flèches triples
}
RIVE = 'rive_t1'
CHASSIS = 'acier_sombre'
FLECHES = 1


def _palier(n):
    """Choisit le style du palier `n` pour les modèles construits ensuite."""
    global RIVE, CHASSIS, FLECHES
    RIVE, CHASSIS, FLECHES = PALIERS[n]['rive'], PALIERS[n]['chassis'], PALIERS[n]['fleches']


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
    # Une flèche par palier (« > », « >> », « >>> ») autour du même centre : plus il y en a, plus le tapis est rapide.
    # Encombrement total (le long du tapis) borné, pour rester dans la tuile : `f` = demi-longueur d'une flèche.
    nb = FLECHES
    f = fleche * (1.0 if nb == 1 else 1.4) / (1 + 0.4 * (nb - 1))
    decalages = [0.8 * f * (k - (nb - 1) / 2) for k in range(nb)]
    for dc in decalages:
        pointe = c + d * (f + dc)
        for s in (-1, 1):
            bout = c + d * (dc - f) + w * (s * larg)
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
        lot.cube(CHASSIS, (L, EP_LONG, Z_LONG[1] - Z_LONG[0]), (xm, s * Y_LONG, sum(Z_LONG) / 2))
        lot.cube(RIVE, (L, 0.1, Z_RIVE[1] - Z_RIVE[0]), (xm, s * Y_LONG, sum(Z_RIVE) / 2))
        lot.cube(CHASSIS, (L, 0.012, 0.03), (xm, s * (Y_LONG + 0.036), 0.17))  # nervure basse
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
            lot.cube(CHASSIS, (0.08, 0.08, Z_LONG[0]), (0, s * Y_LONG, Z_LONG[0] / 2))
            lot.cube('acier', (0.18, 0.16, 0.02), (0, s * Y_LONG, 0.01))  # platine
        lot.cube(CHASSIS, (0.05, 2 * Y_LONG, 0.04), (0, 0, 0.06))  # entretoise


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
        _secteur(coll, f'longeron_{s}', r - EP_LONG / 2, r + EP_LONG / 2, *Z_LONG, CHASSIS, n)
        _secteur(coll, f'rive_{s}', r - 0.05, r + 0.05, *Z_RIVE, RIVE, n)
        _secteur(coll, f'nervure_{s}', r + s * 0.03 - 0.006, r + s * 0.03 + 0.006, 0.155, 0.185, CHASSIS, n)
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
        lot.cube(CHASSIS, (0.08, 0.08, Z_LONG[0]), (p.x, p.y, Z_LONG[0] / 2), 0, Matrix.Rotation(a, 3, 'Z'))
        lot.cube('acier', (0.16, 0.18, 0.02), (p.x, p.y, 0.01), 0, Matrix.Rotation(a, 3, 'Z'))
    p0, p1 = C + u * (R - Y_LONG), C + u * (R + Y_LONG)
    lot.barre(CHASSIS, (p0.x, p0.y, 0.06), (p1.x, p1.y, 0.06), 0.045)
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
        _prisme(coll, f'longeron_{s}', para(*Z_LONG), y - EP_LONG / 2, y + EP_LONG / 2, CHASSIS)
        _prisme(coll, f'rive_{s}', para(*Z_RIVE), y - 0.05, y + 0.05, RIVE)
    d = Vector((1, 0, m)).normalized()       # sens du mouvement, le long de la pente
    nrm = Vector((-m, 0, 1)).normalized()    # normale de la bande
    pente = Matrix.Rotation(-m * math.pi / 4, 3, 'Y')
    for k in range(5):  # lames en flèche et tasseaux
        x = -0.8 + k * 0.4
        p = Vector((x, 0, Z_BANDE[1] + zx(x)))
        _chevron(bande, p, d, nrm, larg=0.54, fleche=0.1)
        bande.cube(CHASSIS, (0.03, 2 * LARG_BANDE - 0.08, 0.05), tuple(p + nrm * 0.025 - d * 0.16), 0, pente)
    for x in (-0.5, 0.0, 0.5):  # rouleaux
        for s in (-1, 1):
            lot.tube('acier', (x, s * (Y_LONG + 0.03), 0.3 + zx(x)), (x, s * (Y_LONG + 0.05), 0.3 + zx(x)), 0.035, sg)
    pieds = (-0.45 * m, 0.55 * m)
    for x in pieds:  # pieds sous la pente, entretoises
        zt = Z_LONG[0] + zx(x)
        for s in (-1, 1):
            lot.cube(CHASSIS, (0.08, 0.08, zt), (x, s * Y_LONG, zt / 2))
            lot.cube('acier', (0.18, 0.16, 0.02), (x, s * Y_LONG, 0.01))
        lot.cube(CHASSIS, (0.05, 2 * Y_LONG, 0.04), (x, 0, min(zt - 0.1, 0.5)))
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
        lot.cube(CHASSIS, (0.08, 0.08, Z_LONG[0]), (xp, s * Y_LONG, Z_LONG[0] / 2))
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
        lot.cube(CHASSIS, (0.06, 0.12, 0.66), (xb - 0.03 * s_, y, 0.33))
    for k in range(8):  # linteau rayé jaune et noir
        lot.cube('jaune' if k % 2 == 0 else 'noir', (0.065, 1.72 / 8, 0.14), (xb - 0.03 * s_, -0.86 + (k + 0.5) * 1.72 / 8, 0.72))
    lot.cube(CHASSIS, (0.16, 1.9, 0.05), (xb + 0.04 * s_, 0, 0.975))  # chaperon
    if not leger:
        for k in range(3):  # rideau à lanières
            lot.cube(CHASSIS, (0.006, 0.4, 0.2), (xb - 0.07 * s_, -0.45 + k * 0.45, 0.52))
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
    lot.cube(CHASSIS, (0.42, 0.42, 0.04), (0, 0, 0.02))  # platine
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.tube('acier', (sx * 0.16, sy * 0.16, 0.04), (sx * 0.16, sy * 0.16, 0.08), 0.02, 6)  # boulons
    lot.cube('acier', (0.2, 0.2, h - 0.1), (0, 0, 0.04 + (h - 0.1) / 2))  # fût
    lot.cube('jaune', (0.21, 0.21, 0.25), (0, 0, 0.4))  # bande de repérage
    lot.cube('noir', (0.212, 0.212, 0.05), (0, 0, 0.3))
    lot.cube('noir', (0.212, 0.212, 0.05), (0, 0, 0.5))
    lot.cube(CHASSIS, (0.24, 1.6, 0.08), (0, 0, h - 0.04))  # tête
    for s in (-1, 1):  # jambes de force sous la tête
        lot.barre(CHASSIS, (0, s * 0.1, h - 0.55), (0, s * 0.7, h - 0.08), 0.06)
    lot.finir()
    T.poser_au_sol(coll, 1.0)


_FORMES_T1 = {
    'convoyeur_t1': convoyeur_t1,
    'convoyeur_virage_t1': convoyeur_virage_t1,
    'convoyeur_virage_inverse_t1': convoyeur_virage_inverse_t1,
    'convoyeur_rampe_t1': convoyeur_rampe_t1,
    'convoyeur_rampe_descente_t1': convoyeur_rampe_descente_t1,
    'convoyeur_tunnel_entree_t1': convoyeur_tunnel_entree_t1,
    'convoyeur_tunnel_sortie_t1': convoyeur_tunnel_sortie_t1,
    'pilier_convoyeur_t1': pilier_convoyeur_t1,
}


def _au_palier(fabrique, n):
    """Même forme, au style du palier `n` (couleur des rives et du châssis, flèches simples ou doubles)."""
    def f(coll, leger=True):
        _palier(n)
        try:
            fabrique(coll, leger)
        finally:
            _palier(1)
    return f


# Chaque forme existe pour chaque palier : `<forme>_t1` (jaune), `<forme>_t2` (rapide, orange, flèches doubles),
# `<forme>_t3` (express, rouge, flèches triples).
MODELES = {nom.replace('_t1', f'_t{n}'): _au_palier(fab, n) for n in (1, 2, 3) for nom, fab in _FORMES_T1.items()}


# ---------------------------------------------------------------------------------------------------------------------
# Séparateur, groupeur, trieur : une tuile (2 x 2 cases), raccordée aux tapis sur ses 4 côtés.
# Avant (sortie principale) = -Y. Séparateur et trieur : entrée derrière (+Y), sorties devant, à gauche et à droite.
# Groupeur : entrées derrière, à gauche et à droite, sortie devant.

def _bout(lot, bande, a, sortant, accent, sg, r0=0.74, r1=1.0):
    """Bout de tapis de r0 (côté centre) à r1 (bord de la tuile) dans la direction `a` (vecteur unitaire du plan),
    même coupe que les convoyeurs, avec une flèche vers l'extérieur (sortie) ou vers l'intérieur (entrée)."""
    a = Vector(a)
    w = Vector((-a.y, a.x, 0))
    rot = Matrix((a, w, Vector((0, 0, 1)))).transposed()
    c = a * ((r0 + r1) / 2)
    L = r1 - r0
    lot.cube('noir', (L, 2 * LARG_BANDE, Z_BANDE[1] - Z_BANDE[0]), tuple(c + Vector((0, 0, sum(Z_BANDE) / 2))), 0, rot)
    lot.cube('noir', (L, 2 * LARG_BANDE - 0.08, Z_RETOUR[1] - Z_RETOUR[0]), tuple(c + Vector((0, 0, sum(Z_RETOUR) / 2))), 0, rot)
    for s in (-1, 1):
        p = c + w * (s * Y_LONG)
        lot.cube(CHASSIS, (L, EP_LONG, Z_LONG[1] - Z_LONG[0]), tuple(p + Vector((0, 0, sum(Z_LONG) / 2))), 0, rot)
        lot.cube(accent, (L, 0.1, Z_RIVE[1] - Z_RIVE[0]), tuple(p + Vector((0, 0, sum(Z_RIVE) / 2))), 0, rot)
    _chevron(bande, c + Vector((0, 0, Z_BANDE[1])), a if sortant else -a, (0, 0, 1), larg=0.42, fleche=0.07, ep=0.05)


def _carrefour(coll, lot, bande, accent, sorties, entrees, leger):
    """Corps commun : plateau central, 4 bouts de tapis, 4 poteaux d'angle, cadre haut et capot du moteur au centre.
    `sorties` / `entrees` : listes de directions (vecteurs du plan)."""
    sg = 8 if leger else 14
    seg = 16 if leger else 32
    for a in sorties:
        _bout(lot, bande, a, True, accent, sg)
    for a in entrees:
        _bout(lot, bande, a, False, accent, sg)
    # Plateau central (rond, au niveau de la bande) dans un caisson carré.
    lot.cube(CHASSIS, (1.48, 1.48, Z_BANDE[0] - 0.06), (0, 0, (Z_BANDE[0] - 0.06) / 2 + 0.06))
    lot.cube('acier', (1.6, 1.6, 0.06), (0, 0, 0.03))  # semelle
    T.tour(coll, 'plateau_fond', [(0.7, Z_BANDE[0] - 0.02), (0.7, Z_BANDE[1] - 0.005)], 'noir', segments=seg)
    for k in range(4):  # poteaux d'angle, cadre haut
        a = math.pi / 4 + k * math.pi / 2
        x, y = 0.87 * math.copysign(1, math.cos(a)), 0.87 * math.copysign(1, math.sin(a))
        lot.cube(accent, (0.2, 0.2, 0.92), (x, y, 0.46 + 0.0))
        lot.cube('jaune', (0.205, 0.205, 0.06), (x, y, 0.62))  # repère
        lot.cube('noir', (0.205, 0.205, 0.03), (x, y, 0.575))
    for s in (-1, 1):
        lot.cube(CHASSIS, (1.94, 0.1, 0.08), (0, s * 0.87, 0.96))
        lot.cube(CHASSIS, (0.1, 1.94, 0.08), (s * 0.87, 0, 0.96))
    lot.cube(CHASSIS, (1.7, 0.1, 0.06), (0, 0, 0.99))  # traverse du capot
    lot.cube(accent, (0.46, 0.46, 0.2), (0, 0, 1.1), 0.02)  # capot du moteur
    lot.cube(CHASSIS, (0.5, 0.5, 0.04), (0, 0, 1.2), 0.005)
    lot.tube(CHASSIS, (0, 0, 0.42), (0, 0, 1.0), 0.04, sg)  # arbre vertical
    for j in range(4):  # ouïes du capot
        lot.cube('noir', (0.3, 0.012, 0.025), (0, -0.236, 1.05 + j * 0.035))


def _aiguillage(coll, lot, leger):
    """Volet tournant au centre (groupe `aiguillage_`) : moyeu et pale qui envoie les objets à tour de rôle à chaque sortie."""
    sg = 8 if leger else 14
    ai = _lot(coll, 'aiguillage', leger)
    ai.tube(CHASSIS, (0, 0, Z_BANDE[1]), (0, 0, Z_BANDE[1] + 0.14), 0.09, sg)
    ai.tube('jaune', (0, 0, Z_BANDE[1] + 0.14), (0, 0, Z_BANDE[1] + 0.17), 0.1, sg)
    ai.cube('acier', (0.6, 0.04, 0.12), (-0.3 + 0.0, 0, Z_BANDE[1] + 0.07), 0, Matrix.Rotation(math.pi / 2, 3, 'Z'))
    ai.cube('acier', (0.04, 0.6, 0.12), (0, -0.3, Z_BANDE[1] + 0.07))
    ai.finir()
    T.pivot(coll, 'pivot_aiguillage', (0, 0, Z_BANDE[1]), (0, 0, 1))


AV, AR, GA, DR = (0, -1, 0), (0, 1, 0), (-1, 0, 0), (1, 0, 0)  # devant, derrière, gauche, droite (vu de face)


def separateur(coll, leger=True):
    """Séparateur (`splitter`) : entrée derrière, trois sorties (devant, gauche, droite) servies à tour de rôle par le
    volet tournant. Pièces mobiles : `aiguillage_` tourne par tiers de tour autour de Z (pivot au centre)."""
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    _carrefour(coll, lot, bande, 'separateur', [AV, GA, DR], [AR], leger)
    _aiguillage(coll, lot, leger)
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def groupeur(coll, leger=True):
    """Groupeur (`merger`) : entrées derrière, à gauche et à droite, sortie devant. Au centre, un entonnoir à trois
    joues qui ramène les objets vers la sortie. Pièce mobile : `bande_` (flèches) seulement."""
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    _carrefour(coll, lot, bande, 'groupeur', [AV], [AR, GA, DR], leger)
    z = Z_BANDE[1]
    for s in (-1, 1):  # joues de l'entonnoir, du coin arrière vers la sortie
        lot.barre('acier', (s * 0.62, 0.45, z + 0.06), (s * 0.3, -0.62, z + 0.06), 0.06)
        lot.barre(CHASSIS, (s * 0.62, 0.45, z + 0.12), (s * 0.3, -0.62, z + 0.12), 0.03)
    lot.tube('jaune', (0, -0.1, z), (0, -0.1, z + 0.006), 0.12, 8)  # repère central
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


def trieur(coll, leger=True):
    """Trieur (`sorter`, électrique) : comme le séparateur, mais un portique à scanner (lumière cyan) lit chaque objet à
    l'entrée et un voyant de couleur marque chaque sortie (filtre). Écran et coffret électrique.
    Pièces mobiles : `aiguillage_` (pivote vers la sortie choisie), `scanner_` (nappe lumineuse, peut clignoter)."""
    sg = 8 if leger else 14
    lot, bande = _lot(coll, 'pieces', leger), _lot(coll, 'bande', leger)
    _carrefour(coll, lot, bande, 'trieur', [AV, GA, DR], [AR], leger)
    _aiguillage(coll, lot, leger)
    # Portique du scanner au-dessus de l'entrée (côté +Y).
    sc = _lot(coll, 'scanner', leger)
    for s in (-1, 1):
        lot.cube(CHASSIS, (0.08, 0.08, 0.5), (s * 0.6, 0.85, Z_RIVE[1] + 0.25))
    lot.cube('trieur', (1.3, 0.16, 0.12), (0, 0.85, Z_RIVE[1] + 0.52), 0.01)
    lot.cube('noir', (1.0, 0.1, 0.02), (0, 0.85, Z_RIVE[1] + 0.455))
    sc.cube('cyan', (0.9, 0.02, 0.24), (0, 0.85, Z_RIVE[1] + 0.31))  # nappe du scanner
    sc.cube('cyan', (0.96, 0.08, 0.012), (0, 0.85, Z_RIVE[1] + 0.448))
    # Voyant de filtre au-dessus de chaque sortie (rouge, vert, bleu).
    for a, mat in ((GA, 'rouge'), (AV, 'vert'), (DR, 'bleu')):
        p = Vector(a) * 0.87
        q = Vector((p.x, p.y, 0)) + Vector(a).cross(Vector((0, 0, 1))) * 0.0
        lot.cube(CHASSIS, (0.16, 0.16, 0.08), (q.x * 0.98, q.y * 0.98, 1.05))
        lot.boule(mat, (q.x * 0.98, q.y * 0.98, 1.12), 0.06)
    # Écran sur le capot (face avant) et coffret.
    lot.cube('panneau', (0.3, 0.012, 0.12), (0, -0.237, 1.12))
    lot.cube('cyan', (0.24, 0.006, 0.08), (0, -0.244, 1.12))
    lot.cube('acier', (0.2, 0.14, 0.26), (0.62, 0.62, 0.55 + 0.0))  # coffret électrique (sur le poteau)
    lot.cube('vert', (0.03, 0.01, 0.03), (0.58, 0.548, 0.62))
    lot.tube('noir', (0.62, 0.62, 0.42), (0.62, 0.62, 0.3), 0.02, 6)
    sc.finir()
    lot.finir()
    bande.finir()
    T.poser_au_sol(coll, 1.0)


# ---------------------------------------------------------------------------------------------------------------------
# Bras robotiques : une tuile (2 x 2 cases), axe de la tourelle au centre de la tuile. Ils prennent derrière (+Y) et
# posent devant (-Y). Le jeu fait pivoter le groupe `tourelle_` (tout ce qui tourne) autour du centre de la tuile
# (`MACHINE_ANIM`, « swing ») ; le reste (socle, foyer et trémie du T1) reste fixe. Ils occupent toute leur tuile.
# Hauteur totale <= 1,3 (machine de 50 cm de haut).

Z_SOCLE = 0.22
Z_TOUR = 0.28


def bras_t1(coll, leger=True):
    """Bras à combustible T1 (`arm`), grand format (il occupe toute sa tuile) : socle en fonte boulonné ; derrière, le
    foyer (porte à braises visible à l'arrière) surmonté d'une trémie dont la bouche, au bord arrière de la tuile et à la
    hauteur des tapis, reçoit le charbon d'un convoyeur ; tourelle portant une chaudière en cuivre et sa cheminée ; flèche
    rivetée orange relevée par un vérin, contrepoids, câble et griffe à trois crochets ; petit moteur thermique à volant
    dans le creux à droite du foyer.
    Pièces mobiles : `tourelle_` pivote (pivot au centre) ; `volant_` (volant du moteur) tourne autour de X."""
    sg = 8 if leger else 14
    seg = 14 if leger else 28
    lot, tr = _lot(coll, 'socle', leger), _lot(coll, 'tourelle', leger)
    # --- Socle (fixe) : platine boulonnée et embase.
    # La platine court sous tout le bras, foyer compris (de -0,55 à 0,97 en Y).
    yp0, yp1 = -0.55, 0.97
    lot.cube('fonte', (1.1, yp1 - yp0, 0.07), (0, (yp0 + yp1) / 2, 0.035))
    for sx in (-1, 1):
        for y in (yp0 + 0.08, 0.2, yp1 - 0.08):
            lot.tube('acier', (sx * 0.47, y, 0.07), (sx * 0.47, y, 0.1), 0.035, 6)
    # Embase : sous la tourelle et jusqu'au foyer, sans vide entre les deux.
    yf0, yf1 = 0.47, 0.93
    lot.cube('fonte', (0.72, 0.36 + yf0, Z_SOCLE - 0.07), (0, (yf0 - 0.36) / 2, 0.07 + (Z_SOCLE - 0.07) / 2))
    lot.cube('acier_sombre', (0.76, 0.38 + yf0, 0.03), (0, (yf0 - 0.38) / 2, Z_SOCLE - 0.015))
    # --- Foyer derrière (fixe), collé à l'embase, porte à braises à l'arrière, trémie dont la bouche reçoit le tapis au
    # bord de la tuile.
    lot.cube('fonte', (0.62, yf1 - yf0, 0.3), (0, (yf0 + yf1) / 2, 0.15))
    for z in (0.06, 0.27):  # cerclages rivetés
        lot.cube('acier_sombre', (0.64, yf1 - yf0 + 0.02, 0.03), (0, (yf0 + yf1) / 2, z))
    lot.cube('noir', (0.3, 0.012, 0.14), (0, yf1 + 0.006, 0.15))  # porte du foyer
    lot.cube('braise', (0.24, 0.014, 0.07), (0, yf1 + 0.008, 0.13))
    for k in range(3):
        lot.cube('acier', (0.27, 0.016, 0.014), (0, yf1 + 0.01, 0.1 + k * 0.035))  # grille
    lot.tube('acier', (0.17, yf1 + 0.01, 0.15), (0.17, yf1 + 0.05, 0.15), 0.02, 6)  # poignée
    # Trémie : entonnoir carré sur le foyer, bouche ouverte vers l'arrière à la hauteur du dessus des tapis.
    zb, zh = 0.3, 0.46
    for sx in (-1, 1):
        lot.cube('fonte', (0.03, yf1 - yf0, zh - zb), (sx * 0.29, (yf0 + yf1) / 2, (zb + zh) / 2))  # joues
    lot.cube('fonte', (0.6, 0.03, zh - zb), (0, yf0 + 0.015, (zb + zh) / 2))  # fond, côté tourelle
    lot.cube('noir', (0.55, yf1 - yf0 - 0.04, 0.02), (0, (yf0 + yf1) / 2, zb + 0.01))  # intérieur
    T.tour(coll, 'charbon_tremie', [(0.2, zb + 0.02), (0.05, zb + 0.09)], 'noir', segments=sg, centre=(0, 0.72))
    lot.cube('rive_t1', (0.62, 0.05, 0.03), (0, yf1, Z_BANDE[1] + 0.015))  # seuil jaune de la bouche (tapis T1)
    for sx in (-1, 1):
        lot.cube('rive_t1', (0.05, 0.05, zh - Z_BANDE[1]), (sx * 0.3, yf1, (zh + Z_BANDE[1]) / 2))
    # --- Petit moteur thermique (fixe) dans le creux à droite du foyer : bâti, cylindre à ailettes couché, culasse,
    # bielle et volant (groupe `volant_`), pot d'échappement ; il est hors de portée de la tourelle.
    xm, ym = 0.43, 0.7
    lot.cube('acier_sombre', (0.2, 0.42, 0.06), (xm, ym, 0.1))  # bâti
    lot.cube('fonte', (0.14, 0.18, 0.12), (xm - 0.01, ym - 0.08, 0.19))  # carter
    lot.tube('vert_fonce', (xm - 0.01, ym + 0.01, 0.22), (xm - 0.01, ym + 0.17, 0.22), 0.055, sg)  # cylindre
    for k in range(4):  # ailettes de refroidissement
        y = ym + 0.03 + k * 0.035
        lot.tube('acier_sombre', (xm - 0.01, y, 0.22), (xm - 0.01, y + 0.012, 0.22), 0.075, sg)
    lot.tube('fonte', (xm - 0.01, ym + 0.17, 0.22), (xm - 0.01, ym + 0.2, 0.22), 0.065, sg)  # culasse
    lot.tube('acier', (xm - 0.01, ym + 0.2, 0.22), (xm - 0.01, ym + 0.2, 0.32), 0.012, 6)  # bougie / soupape
    lot.tube('acier_sombre', (xm - 0.06, ym + 0.12, 0.22), (xm - 0.06, ym + 0.12, 0.42), 0.02, 6)  # échappement
    lot.tube('acier_sombre', (xm - 0.06, ym + 0.12, 0.4), (xm - 0.06, ym + 0.12, 0.45), 0.032, 6)
    lot.tube('acier', (xm + 0.06, ym - 0.08, 0.2), (xm + 0.09, ym - 0.08, 0.2), 0.015, 6)  # arbre
    vo = _lot(coll, 'volant', leger)
    vo.tube('fonte', (xm + 0.085, ym - 0.08, 0.2), (xm + 0.11, ym - 0.08, 0.2), 0.1, seg)  # volant
    vo.tube('acier', (xm + 0.11, ym - 0.08, 0.2), (xm + 0.115, ym - 0.08, 0.2), 0.03, sg)  # moyeu
    vo.cube('rouge', (0.008, 0.02, 0.07), (xm + 0.114, ym - 0.08, 0.24))  # repère (on le voit tourner)
    T.pivot(coll, 'pivot_volant', (xm + 0.1, ym - 0.08, 0.2), (1, 0, 0))
    lot.barre('acier', (xm - 0.01, ym - 0.08, 0.2), (xm - 0.01, ym + 0.05, 0.22), 0.025)  # bielle (dans le carter)
    lot.tube('noir', (xm - 0.08, ym - 0.12, 0.2), (0.31, ym - 0.12, 0.2), 0.015, 6)  # durite vers le foyer
    # --- Tourelle (pivote) : plateau, chaudière, cheminée.
    T.tour(coll, 'tourelle_plateau', [(0.45, Z_TOUR), (0.45, Z_TOUR + 0.08), (0.38, Z_TOUR + 0.12)], 'fonte', segments=seg)
    for k in range(8 if leger else 12):  # rivets du plateau
        a = 2 * math.pi * k / (8 if leger else 12)
        tr.boule('acier', (0.41 * math.cos(a), 0.41 * math.sin(a), Z_TOUR + 0.09), 0.018)
    yc = 0.2
    tr.tube('cuivre', (0, yc, Z_TOUR + 0.12), (0, yc, Z_TOUR + 0.56), 0.18, seg)  # chaudière
    for z in (Z_TOUR + 0.18, Z_TOUR + 0.47):
        tr.tube('fonte', (0, yc, z), (0, yc, z + 0.035), 0.19, seg)  # cerclages
    tr.tube('fonte', (0, yc, Z_TOUR + 0.56), (0, yc, Z_TOUR + 0.62), 0.12, sg)
    tr.tube('fonte', (0.07, yc + 0.07, Z_TOUR + 0.56), (0.07, yc + 0.07, 1.3), 0.05, sg)  # cheminée
    tr.tube('fonte', (0.07, yc + 0.07, 1.24), (0.07, yc + 0.07, 1.3), 0.075, sg)
    tr.tube('acier', (-0.17, yc - 0.06, Z_TOUR + 0.35), (-0.25, yc - 0.06, Z_TOUR + 0.35), 0.035, 6)  # manomètre
    tr.tube('blanc', (-0.25, yc - 0.06, Z_TOUR + 0.35), (-0.265, yc - 0.06, Z_TOUR + 0.35), 0.045, 8)
    tr.tube('acier', (0.15, yc - 0.1, Z_TOUR + 0.5), (0.22, yc - 0.1, Z_TOUR + 0.58), 0.02, 6)  # sifflet
    # Mât, flèche, vérin, contrepoids, câble et griffe.
    pied = Vector((0, -0.08, Z_TOUR + 0.12))
    epaule = Vector((0, -0.08, 0.9))
    bout = Vector((0, -0.9, 1.0))
    tr.cube('fonte', (0.18, 0.18, epaule.z - pied.z), tuple((pied + epaule) / 2))  # mât
    tr.tube('acier', epaule + Vector((-0.13, 0, 0)), epaule + Vector((0.13, 0, 0)), 0.05, sg)  # axe
    queue = epaule + Vector((0, 0.3, -0.04))
    for s_ in (-1, 1):  # flèche à deux flasques rivetés
        a, b = queue + Vector((s_ * 0.08, 0, 0)), bout + Vector((s_ * 0.08, 0, 0))
        tr.barre('orange', a, b, 0.07)
        if not leger:
            for k in range(1, 7):
                tr.boule('fonte', a + (b - a) * (k / 7) + Vector((s_ * 0.04, 0, 0)), 0.016)
    for k in range(5):  # entretoises
        tr.cube('fonte', (0.2, 0.035, 0.035), tuple(queue + (bout - queue) * (k / 4)))
    tr.cube('fonte', (0.24, 0.16, 0.18), tuple(queue + Vector((0, 0.02, -0.02))))  # contrepoids
    va, vb = pied + Vector((0, -0.07, 0.3)), epaule + (bout - epaule) * 0.45
    tr.barre('acier', va, vb, 0.04)  # vérin : tige et corps
    tr.barre('acier_sombre', va, va + (vb - va) * 0.55, 0.065)
    tr.tube('acier', bout + Vector((-0.1, 0, 0)), bout + Vector((0.1, 0, 0)), 0.045, sg)  # poulie
    g = bout + Vector((0, 0, -0.4))
    tr.tube('noir', bout + Vector((0, 0, -0.04)), g, 0.012, 4)  # câble
    tr.tube('fonte', g, g + Vector((0, 0, -0.07)), 0.065, sg)
    for k in range(3):  # griffe à trois crochets
        a = 2 * math.pi * k / 3 + math.pi / 2
        u = Vector((math.cos(a), math.sin(a), 0))
        tr.barre('acier', g + Vector((0, 0, -0.07)), g + u * 0.09 + Vector((0, 0, -0.18)), 0.025)
        tr.barre('acier', g + u * 0.09 + Vector((0, 0, -0.18)), g + u * 0.05 + Vector((0, 0, -0.25)), 0.025)
    T.pivot(coll, 'pivot_tourelle', (0, 0, Z_TOUR), (0, 0, 1))
    lot.finir()
    tr.finir()
    vo.finir()
    T.poser_au_sol(coll, 1.0)


def _bras_robot_tourelle(coll, leger, couleur, filtre):
    """Bras robot électrique (T2, et T3 avec `filtre`), grand format (il occupe toute sa tuile) : socle fixe, tourelle,
    épaule, bras, coude, avant-bras, poignet et pince à deux doigts, câbles. Le T3 ajoute une caméra de tri sur le
    poignet, un écran de filtre et un anneau lumineux."""
    sg = 8 if leger else 16
    seg = 16 if leger else 32
    lot, tr = _lot(coll, 'socle', leger), _lot(coll, 'tourelle', leger)
    # Socle (fixe) : embase ronde boulonnée, couronne rayée.
    T.tour(coll, 'socle_embase', [(0.58, 0.0), (0.58, 0.07), (0.46, 0.12), (0.42, Z_SOCLE)], CHASSIS, segments=seg)
    nb = 8 if leger else 12
    for k in range(nb):
        a = 2 * math.pi * (k + 0.5) / nb
        lot.tube('acier', (0.52 * math.cos(a), 0.52 * math.sin(a), 0.07), (0.52 * math.cos(a), 0.52 * math.sin(a), 0.1), 0.028, 6)
    for k in range(8):  # couronne jaune et noire
        a = 2 * math.pi * k / 8 + 0.39
        lot.cube('jaune' if k % 2 == 0 else 'noir', (0.17, 0.02, 0.06), (0.43 * math.cos(a), 0.43 * math.sin(a), 0.17), 0,
                 Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    # Tourelle (pivote).
    T.tour(coll, 'tourelle_corps', [(0.4, Z_TOUR), (0.4, Z_TOUR + 0.17), (0.32, Z_TOUR + 0.25)], couleur, segments=seg)
    tr.tube(CHASSIS, (0, 0, Z_TOUR + 0.25), (0, 0, Z_TOUR + 0.32), 0.22, seg)
    tr.cube(couleur, (0.3, 0.26, 0.28), (0, 0.22, Z_TOUR + 0.38), 0.02 if not leger else 0)  # moteur de l'épaule
    tr.cube(CHASSIS, (0.24, 0.012, 0.18), (0, 0.356, Z_TOUR + 0.38))
    for j in range(4):
        tr.cube('noir', (0.2, 0.014, 0.014), (0, 0.358, Z_TOUR + 0.32 + j * 0.035))  # ouïes
    tr.boule('vert', (0.12, 0.33, Z_TOUR + 0.53), 0.03)  # voyant de marche
    epaule = Vector((0, 0.03, Z_TOUR + 0.46))
    coude = Vector((0, -0.4, 1.18))
    poignet = Vector((0, -0.84, 0.94))
    n = Vector((1, 0, 0))
    for p, r in ((epaule, 0.13), (coude, 0.1)):
        tr.tube(CHASSIS, p - n * 0.14, p + n * 0.14, r, sg)  # articulations
        tr.tube('acier', p - n * 0.16, p + n * 0.16, r * 0.5, sg)
        tr.tube(couleur, p - n * 0.165, p - n * 0.14, r * 0.8, sg)  # capots
        tr.tube(couleur, p + n * 0.14, p + n * 0.165, r * 0.8, sg)
    tr.barre(couleur, epaule, coude, 0.17)  # bras
    tr.barre(couleur, coude, poignet, 0.125)  # avant-bras
    tr.barre(CHASSIS, epaule + (coude - epaule) * 0.2 + Vector((0.1, 0, 0)), epaule + (coude - epaule) * 0.75 + Vector((0.1, 0, 0)), 0.045)  # vérin
    tr.boule(CHASSIS, poignet, 0.09)
    tr.tube('acier', poignet, poignet + Vector((0, 0, -0.15)), 0.05, sg)
    pince = poignet + Vector((0, 0, -0.19))
    tr.cube(CHASSIS, (0.1, 0.22, 0.06), tuple(pince))
    for s_ in (-1, 1):  # doigts
        tr.cube('acier', (0.065, 0.04, 0.17), tuple(pince + Vector((0, s_ * 0.085, -0.1))))
        tr.cube(CHASSIS, (0.065, 0.045, 0.04), tuple(pince + Vector((0, s_ * 0.075, -0.19))))
    tr.tube('noir', epaule + Vector((-0.12, 0.08, -0.1)), coude + Vector((-0.12, 0.04, 0)), 0.022, 6)  # câbles
    tr.tube('noir', coude + Vector((-0.11, 0, 0)), poignet + Vector((-0.08, 0.04, 0.03)), 0.018, 6)
    if filtre:
        # Caméra de tri sur le côté du poignet (objectif cyan vers la pièce), écran de filtre, anneau lumineux.
        cam = poignet + Vector((0.12, 0.0, -0.04))
        tr.cube(CHASSIS, (0.08, 0.11, 0.09), tuple(cam))
        tr.tube('cyan', cam + Vector((0, 0, -0.045)), cam + Vector((0, 0, -0.065)), 0.03, sg)
        tr.cube('panneau', (0.26, 0.012, 0.16), (0, -0.31, Z_TOUR + 0.13))
        for k, mat in enumerate(('rouge', 'vert', 'bleu')):  # pastilles du filtre
            tr.cube(mat, (0.05, 0.006, 0.05), (-0.08 + k * 0.08, -0.318, Z_TOUR + 0.15))
        tr.cube('cyan', (0.2, 0.006, 0.025), (0, -0.318, Z_TOUR + 0.09))
        tr.tube('cyan', (0, 0, Z_TOUR + 0.32), (0, 0, Z_TOUR + 0.335), 0.23, seg)  # anneau lumineux
    T.pivot(coll, 'pivot_tourelle', (0, 0, Z_TOUR), (0, 0, 1))
    lot.finir()
    tr.finir()
    T.poser_au_sol(coll, 1.0)


def bras_t2(coll, leger=True):
    """Bras électrique T2 (`arm_electric`) : bras robot jaune articulé, comme ceux de l'assembleur, en plus détaillé."""
    _bras_robot_tourelle(coll, leger, 'jaune', False)


def bras_t3(coll, leger=True):
    """Bras filtrant T3 (`arm_filter`) : même bras, couleur sarcelle (celle du tri), caméra de tri au poignet, écran
    de filtre et anneau lumineux cyan sur la tourelle."""
    _bras_robot_tourelle(coll, leger, 'bras_t3', True)


MODELES.update({
    'separateur': separateur,
    'groupeur': groupeur,
    'trieur': trieur,
    'bras_t1': bras_t1,
    'bras_t2': bras_t2,
    'bras_t3': bras_t3,
})



# Emprises agrandies dans le jeu (content/machines.json) : ces modèles, dessinés pour l'ancienne emprise, sont agrandis
# (mêmes proportions) juste assez pour remplir la nouvelle (± demi-largeur en X, ± demi-profondeur en Y).
EMPRISES = {
    'bras_t1': (1.0, 1.5, False),
    'bras_t2': (1.0, 1.5, False),
    'bras_t3': (1.0, 1.5, False),
}


def _dans_emprise(fabrique, demi_x, demi_y, recentrer):
    def f(coll, leger=True):
        fabrique(coll, leger)
        T.agrandir_auto(coll, demi_x, demi_y, recentrer)
    return f


MODELES = {nom: (_dans_emprise(fab, *EMPRISES[nom]) if nom in EMPRISES else fab) for nom, fab in MODELES.items()}

def construire(noms=None):
    """Crée, pour chaque modèle (ou seulement ceux de `noms`), la collection web (légère) et la collection Unity."""
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        fabrique(T.collection(nom), leger=True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, leger=False)
        bpy.context.view_layer.layer_collection.children[unity.name].hide_viewport = True


def exporter(noms=None):
    export = os.path.join(ROOT, 'export')
    for nom in (noms or MODELES):
        print('export web   :', T.export_glb(bpy.data.collections[nom], export))
        print('export Unity :', T.export_glb(bpy.data.collections[nom + '_unity'], os.path.join(export, 'unity'), nom))


def main():
    T.reset()
    construire()
    exporter()
    T.save(os.path.join(ROOT, 'blender', 'logistique.blend'))


if __name__ == '__main__':
    main()
