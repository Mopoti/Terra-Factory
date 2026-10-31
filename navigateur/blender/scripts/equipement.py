"""Famille « équipement » : objets portés et munitions, posés au sol ou en icône (formes `objet_<forme>`).

Style doux (comme la pioche-hache) : formes arrondies, ombrage lissé. Comme pour `objets.py`, les faces de la teinte
`teinte` (magenta pur dans le fichier) prennent la couleur de l'objet (`color` dans `content/items.json`) : une seule
forme de casque sert aux casques des trois armures, chacune à sa couleur ; les détails propres à chaque palier
(rivets, plaques, visière lumineuse) sont dessinés dans sa forme.

Formes : `objet_boussole`, `objet_sac_a_dos`, `objet_capuche`, `objet_pantalon`, `objet_bottes`, `objet_gants`,
`objet_sac_couchage`, `objet_lit`, `objet_chargeur_pistolet`, `objet_chargeur_fusil`, `objet_chargeur_sniper`, et pour
chaque armure (1, 2, 4) : `objet_armure<n>_casque`, `_plastron`, `_jambieres`, `_bottes`.

Taille : environ 0,7 unité de large (35 cm dans le jeu), posé au sol, centré en (0, 0).

Lancer :  blender --background --python blender/scripts/equipement.py
Produit :  blender/equipement.blend, export/objet_<forme>.glb et export/unity/objet_<forme>.glb
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
sys.path.insert(0, HERE)
import terra as T  # noqa: E402
import outils as O  # noqa: E402

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TEINTE = 'teinte'
TEINTES = {
    'teinte': '#ff00ff',
    'teinte_sombre': '#3a3f45',
    'sac_cuir': '#6b4528',
    'boucle': '#c9ccd1',
    'ficelle': '#d9c79a',
    'semelle': '#2c2a28',
    'interieur': '#d8cfb4',
    'couverture': '#4f7fb0',
    'drap': '#eef0f2',
    'laiton': '#d6a845',
    'verre_clair': '#cfe8f0',
    'aiguille_nord': '#d8443a',
    'aiguille_sud': '#f2f2f2',
    'rivet': '#c3c8ce',
    'visiere': '#5fd8ee',
    'lueur': '#7ff0ff',
    'composite_bande': '#e08a3a',
    'nano_lueur': '#5ff0d8',
    'exo_metal': '#5b616d',
    'exo_vert': '#7ad08a',
    'flamme_jet': '#ffb347',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def _boule(lot, mat, c, rx, ry, rz, finesse=2, coupe=None):
    """Ellipsoïde lisse (icosphère) ; `coupe` : on ne garde que ce qui est au-dessus de cette hauteur relative (dôme)."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=finesse, radius=1.0)
    if coupe is not None:
        bmesh.ops.delete(tmp, geom=[v for v in tmp.verts if v.co.z < coupe - 1e-4], context='VERTS')
    bmesh.ops.scale(tmp, vec=Vector((rx, ry, rz)), verts=tmp.verts)
    bmesh.ops.translate(tmp, vec=Vector(c), verts=tmp.verts)
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _finir(coll, *lots):
    for l in lots:
        l.finir()
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin
    O._brillant()
    T.adoucir(coll)


def _n(leger):
    return 3 if leger else 5


# --- Équipement ------------------------------------------------------------------------------------------------------

def objet_boussole(coll, leger=True):
    """Boussole de poche : boîtier rond de la teinte (laiton), verre, aiguille rouge et blanche, couvercle ouvert."""
    n = _n(leger)
    lot = T.Lot(coll, 'boussole')
    O._cyl(lot, TEINTE, (0, 0, 0), (0, 0, 0.09), 0.21, n + 1)
    O._cyl(lot, 'interieur', (0, 0, 0.088), (0, 0, 0.094), 0.17, n + 1)
    for k in range(8):  # graduations
        a = 2 * math.pi * k / 8
        lot.cube('semelle', (0.012, 0.035, 0.004), (0.14 * math.cos(a), 0.14 * math.sin(a), 0.096), 0.001,
                 Matrix.Rotation(a + math.pi / 2, 3, 'Z'))
    for mat, sgn in (('aiguille_nord', 1), ('aiguille_sud', -1)):
        O._rond(lot, mat, (0, 0, 0.1), (0, sgn * 0.13, 0.1), 0.02, 0.006, 2, k=0.004)
    O._cyl(lot, 'laiton', (0, 0, 0.098), (0, 0, 0.11), 0.02, 2)
    O._cyl(lot, 'verre_clair', (0, 0, 0.112), (0, 0, 0.118), 0.175, n + 1)
    # Couvercle ouvert (charnière à l'arrière), anneau.
    lid = T.Lot(coll, 'couvercle')
    O._cyl(lid, TEINTE, (0, 0.215, 0.06), (0, 0.24, 0.45), 0.2, n + 1)
    O._cyl(lot, 'laiton', (0, -0.23, 0.045), (0, -0.27, 0.045), 0.04, 2)
    _finir(coll, lot, lid)


def objet_sac_a_dos(coll, leger=True):
    """Sac à dos debout : corps arrondi de la teinte, rabat et poche de cuir, sangles, boucles, sac de couchage roulé."""
    n = _n(leger)
    lot = T.Lot(coll, 'sac')
    O._rond(lot, TEINTE, (0, 0, 0.0), (0, 0, 0.56), 0.22, 0.14, n, k=0.06, r=0.09)
    O._rond(lot, 'sac_cuir', (0, -0.05, 0.52), (0, -0.17, 0.36), 0.2, 0.05, n, k=0.03)  # rabat
    O._rond(lot, TEINTE, (0, -0.15, 0.08), (0, -0.15, 0.3), 0.15, 0.06, n, k=0.04)  # poche
    O._rond(lot, 'sac_cuir', (0, -0.21, 0.28), (0, -0.21, 0.3), 0.15, 0.012, n, k=0.005)
    for sx in (-1, 1):
        O._rond(lot, 'sac_cuir', (sx * 0.1, -0.165, 0.5), (sx * 0.1, -0.215, 0.25), 0.025, 0.01, n, k=0.005)
        O._rond(lot, 'boucle', (sx * 0.1, -0.22, 0.26), (sx * 0.1, -0.22, 0.29), 0.035, 0.01, n, k=0.005)
        O._rond(lot, 'sac_cuir', (sx * 0.12, 0.15, 0.52), (sx * 0.12, 0.15, 0.06), 0.035, 0.015, n, k=0.006)  # bretelles
    O._cyl(lot, 'couverture', (-0.24, 0.0, 0.64), (0.24, 0.0, 0.64), 0.085, n + 1)  # couchage roulé
    for x in (-0.13, 0.13):
        O._cyl(lot, 'sac_cuir', (x - 0.015, 0, 0.64), (x + 0.015, 0, 0.64), 0.092, n + 1)
    _finir(coll, lot)


def objet_capuche(coll, leger=True):
    """Capuche à pèlerine posée face au joueur : pèlerine arrondie sur les épaules, capuche haute de la teinte avec une
    grande ouverture sombre bordée d'un ourlet, petite pointe à l'arrière, cordons posés au sol devant."""
    n = _n(leger)
    lot = T.Lot(coll, 'capuche')
    _boule(lot, TEINTE, (0, 0.02, 0.0), 0.3, 0.24, 0.09, 2, coupe=0.0)  # pèlerine
    _boule(lot, TEINTE, (0, 0.04, 0.05), 0.17, 0.18, 0.3, 2, coupe=-0.1)  # capuche
    _boule(lot, TEINTE, (0, 0.17, 0.26), 0.05, 0.09, 0.06, 2)  # pointe arrière
    _boule(lot, 'teinte_sombre', (0, -0.1, 0.19), 0.115, 0.08, 0.15, 2)  # ouverture
    m = 14 if leger else 20
    pts = [(0.135 * math.cos(math.pi * k / m), -0.135, 0.06 + 0.32 * math.sin(math.pi * k / m)) for k in range(m + 1)]
    for p0, p1 in zip(pts, pts[1:]):  # ourlet
        O._cyl(lot, TEINTE, p0, p1, 0.024, 2)
    for sx in (-1, 1):
        O._cyl(lot, 'ficelle', (sx * 0.06, -0.2, 0.05), (sx * 0.1, -0.32, 0.01), 0.009, 2)
        _boule(lot, 'ficelle', (sx * 0.102, -0.325, 0.012), 0.016, 0.016, 0.012, 1)
    _finir(coll, lot)


def objet_veste(coll, leger=True):
    """Veste sur un cintre, debout face au joueur (-Y) : buste de la teinte en deux pans, manches qui tombent le long du
    corps, col relevé et poignets plus sombres, fermeture éclair claire, deux poches à rabat, bas côtelé ; cintre en bois
    et crochet de fer au-dessus, pied rond pour tenir debout."""
    n = _n(leger)
    lot = T.Lot(coll, 'veste')
    Z0, Z1 = 0.08, 0.5  # bas et haut du buste
    # Pied et tige qui tiennent le cintre.
    O._rond(lot, 'bois_sombre', (0, 0.03, 0), (0, 0.03, 0.03), 0.09, 0.07, n, k=0.01, r=0.03)
    O._cyl(lot, 'gris_clair', (0, 0.06, 0.03), (0, 0.06, Z1 + 0.08), 0.008, 2)
    # Buste : deux pans bombés, épaules arrondies.
    for sx in (-1, 1):
        O._rond(lot, TEINTE, (sx * 0.07, 0, Z0), (sx * 0.07, 0, Z1 - 0.02), 0.075, 0.045, n, k=0.02, r=0.03)
        O._rond(lot, TEINTE, (sx * 0.06, 0, Z1 - 0.03), (sx * 0.17, 0, Z1 - 0.06), 0.045, 0.04, n, k=0.02)  # épaule
        # Manche qui tombe en s'écartant un peu, poignet côtelé plus sombre.
        O._rond(lot, TEINTE, (sx * 0.17, 0.005, Z1 - 0.06), (sx * 0.2, 0.01, Z0 + 0.06), 0.045, 0.042, n, k=0.02)
        O._rond(lot, 'teinte_sombre', (sx * 0.2, 0.01, Z0 + 0.07), (sx * 0.205, 0.01, Z0 + 0.025), 0.042, 0.04, n, k=0.012)
        # Poche à rabat et son bouton.
        O._rond(lot, 'teinte_sombre', (sx * 0.075, -0.047, Z0 + 0.13), (sx * 0.075, -0.047, Z0 + 0.05), 0.045, 0.004, 2,
                k=0.002, r=0.01)
        O._rond(lot, TEINTE, (sx * 0.075, -0.052, Z0 + 0.14), (sx * 0.075, -0.052, Z0 + 0.115), 0.05, 0.006, 2, k=0.002,
                r=0.01)
        _boule(lot, 'sac_cuir', (sx * 0.075, -0.058, Z0 + 0.12), 0.009, 0.006, 0.009, 1)
        # Col relevé.
        O._rond(lot, 'teinte_sombre', (sx * 0.015, -0.01, Z1 - 0.02), (sx * 0.075, 0.0, Z1 + 0.035), 0.03, 0.035, n, k=0.012)
    # Bas côtelé et fermeture éclair.
    O._rond(lot, 'teinte_sombre', (-0.145, 0, Z0 + 0.012), (0.145, 0, Z0 + 0.012), 0.047, 0.022, n, k=0.01)
    O._rond(lot, 'gris_clair', (0, -0.046, Z0 + 0.01), (0, -0.046, Z1 - 0.01), 0.006, 0.005, 2, k=0.002)
    O._rond(lot, 'gris_clair', (0, -0.052, Z1 - 0.08), (0, -0.052, Z1 - 0.115), 0.01, 0.005, 2, k=0.002, r=0.004)
    # Cintre (barre de bois sur les épaules) et crochet de fer.
    O._rond(lot, 'bois', (-0.16, 0.035, Z1 - 0.04), (0, 0.035, Z1 + 0.02), 0.012, 0.012, n, k=0.004)
    O._rond(lot, 'bois', (0.16, 0.035, Z1 - 0.04), (0, 0.035, Z1 + 0.02), 0.012, 0.012, n, k=0.004)
    pts = [(0, 0.035, Z1 + 0.02), (0, 0.035, Z1 + 0.07), (0.015, 0.035, Z1 + 0.1), (0.04, 0.035, Z1 + 0.1),
           (0.045, 0.035, Z1 + 0.08)]
    for p0, p1 in zip(pts, pts[1:]):
        O._cyl(lot, 'gris_clair', p0, p1, 0.007, 2)
    _finir(coll, lot)


def objet_exosquelette(coll, leger=True):
    """Exosquelette posé debout : deux jambes articulées de barres métalliques (la teinte), genoux à moteur vert,
    ceinture rembourrée, pieds plats, pistons le long des cuisses."""
    n = _n(leger)
    lot = T.Lot(coll, 'exo')
    O._rond(lot, 'sac_cuir', (-0.17, 0, 0.5), (0.17, 0, 0.5), 0.06, 0.035, n, k=0.015)  # ceinture
    O._rond(lot, 'exo_metal', (-0.12, 0.05, 0.5), (0.12, 0.05, 0.5), 0.03, 0.06, n, k=0.012)  # boîtier dorsal
    for sx in (-1, 1):
        x = sx * 0.13
        hanche, genou, cheville = (x, 0, 0.47), (x, -0.03, 0.26), (x, 0.0, 0.06)
        O._cyl(lot, 'exo_metal', (x - sx * 0.03, 0, 0.5), hanche, 0.025, n)
        O._rond(lot, TEINTE, hanche, genou, 0.022, 0.03, n, k=0.008)
        O._rond(lot, TEINTE, genou, cheville, 0.02, 0.028, n, k=0.008)
        O._cyl(lot, 'exo_vert', (x - 0.035, -0.03, 0.26), (x + 0.035, -0.03, 0.26), 0.035, n + 1)  # moteur du genou
        O._cyl(lot, 'exo_metal', (x - 0.04, -0.03, 0.26), (x + 0.04, -0.03, 0.26), 0.02, n)
        O._cyl(lot, 'rivet', (x + sx * 0.03, 0.02, 0.44), (x + sx * 0.03, 0.0, 0.3), 0.01, 2)  # piston
        O._cyl(lot, 'exo_metal', (x + sx * 0.03, 0.02, 0.46), (x + sx * 0.03, 0.015, 0.38), 0.016, 2)
        for z in (0.38, 0.14):  # sangles de cuisse et de mollet
            O._rond(lot, 'sac_cuir', (x - 0.05, -0.01, z), (x + 0.05, -0.01, z), 0.035, 0.015, n, k=0.006)
        O._rond(lot, 'exo_metal', (x, 0.03, 0.015), (x, -0.12, 0.015), 0.045, 0.015, n, k=0.006)  # pied
    _finir(coll, lot)


def objet_propulseur(coll, leger=True):
    """Propulseur dorsal debout : deux réservoirs de la teinte côte à côte, tuyères sombres en bas avec une petite
    flamme, bretelles, plaque dorsale et petit écran de charge."""
    n = _n(leger)
    lot = T.Lot(coll, 'jetpack')
    O._rond(lot, 'exo_metal', (0, 0.06, 0.12), (0, 0.06, 0.6), 0.14, 0.03, n, k=0.012)  # plaque dorsale
    for sx in (-1, 1):
        x = sx * 0.085
        O._cyl(lot, TEINTE, (x, -0.02, 0.14), (x, -0.02, 0.58), 0.075, n + 1, k=0.03)
        O._cyl(lot, 'rivet', (x, -0.02, 0.58), (x, -0.02, 0.63), 0.03, n)
        O._cyl(lot, 'exo_metal', (x, -0.02, 0.14), (x, -0.02, 0.07), 0.05, n + 1, k=0.01)  # tuyère
        O._cyl(lot, 'semelle', (x, -0.02, 0.075), (x, -0.02, 0.06), 0.045, n)
        O._cyl(lot, 'flamme_jet', (x, -0.02, 0.06), (x, -0.02, 0.0), 0.03, n, k=0.012)
        O._rond(lot, 'sac_cuir', (sx * 0.1, 0.1, 0.58), (sx * 0.1, 0.1, 0.18), 0.03, 0.012, n, k=0.005)  # bretelles
    O._rond(lot, 'teinte_sombre', (0, -0.1, 0.38), (0, -0.1, 0.48), 0.035, 0.012, n, k=0.005)
    O._rond(lot, 'exo_vert', (0, -0.112, 0.4), (0, -0.112, 0.46), 0.022, 0.004, 2, k=0.002)
    _finir(coll, lot)


def objet_pantalon(coll, leger=True):
    """Pantalon plié : deux épaisseurs de la teinte, ceinture plus sombre à passants, couture du pli."""
    n = _n(leger)
    lot = T.Lot(coll, 'pantalon')
    O._rond(lot, TEINTE, (-0.3, 0, 0.04), (0.3, 0, 0.04), 0.2, 0.04, n, k=0.03)
    O._rond(lot, TEINTE, (-0.28, 0.0, 0.11), (0.26, 0.0, 0.11), 0.19, 0.035, n, k=0.03)
    O._rond(lot, 'teinte_sombre', (-0.27, 0.0, 0.15), (-0.2, 0.0, 0.15), 0.19, 0.012, n, k=0.008)  # ceinture
    for y in (-0.12, 0.0, 0.12):
        O._rond(lot, 'sac_cuir', (-0.25, y, 0.15), (-0.22, y, 0.15), 0.015, 0.016, 2, k=0.004)
    O._rond(lot, 'teinte_sombre', (-0.15, 0.0, 0.147), (0.24, 0.0, 0.147), 0.006, 0.004, 2, k=0.002)  # couture
    _finir(coll, lot)


def _botte(lot, x, n, mat_tige=TEINTE, rot=0.0, armure=0):
    m = Matrix.Rotation(rot, 3, 'Z')
    P = lambda v: tuple(m @ Vector(v) + Vector((x, 0, 0)))
    O._rond(lot, mat_tige, P((0, 0.04, 0.05)), P((0, 0.04, 0.34)), 0.085, 0.09, n, k=0.03)  # tige
    O._rond(lot, mat_tige, P((0, 0.07, 0.07)), P((0, -0.2, 0.07)), 0.085, 0.06, n, k=0.04)  # pied
    O._rond(lot, 'semelle', P((0, 0.12, 0.012)), P((0, -0.23, 0.012)), 0.09, 0.014, n, k=0.008)
    if armure == 0:
        for k in range(3):
            lot.cube('ficelle', (0.09, 0.012, 0.012), P((0, -0.05 - k * 0.04, 0.125 - k * 0.012)), 0.003, m)
    return P


def objet_bottes(coll, leger=True):
    """Paire de bottes de la teinte (cuir), semelles sombres, lacets."""
    n = _n(leger)
    lot = T.Lot(coll, 'bottes')
    _botte(lot, -0.12, n, rot=0.12)
    _botte(lot, 0.12, n, rot=-0.08)
    _finir(coll, lot)


def _gant(lot, c, rot, n):
    m = Matrix.Rotation(rot, 3, 'Z')
    P = lambda v: tuple(m @ Vector(v) + Vector(c))
    O._rond(lot, TEINTE, P((0, 0.08, 0.02)), P((0, -0.06, 0.02)), 0.065, 0.022, n, k=0.012)  # paume
    for k, (dx, L) in enumerate(((-0.045, 0.1), (-0.015, 0.115), (0.015, 0.11), (0.045, 0.09))):
        O._rond(lot, TEINTE, P((dx, -0.05, 0.02)), P((dx, -0.05 - L, 0.02)), 0.014, 0.014, 2, k=0.006)
    O._rond(lot, TEINTE, P((0.06, 0.0, 0.02)), P((0.11, -0.06, 0.02)), 0.016, 0.015, 2, k=0.006)  # pouce
    O._rond(lot, 'sac_cuir', P((0, 0.08, 0.02)), P((0, 0.15, 0.02)), 0.07, 0.026, n, k=0.01)  # manchette


def objet_gants(coll, leger=True):
    """Paire de gants posés à plat, de la teinte, manchettes de cuir."""
    n = _n(leger)
    lot = T.Lot(coll, 'gants')
    _gant(lot, (-0.1, 0.03, 0), 0.25, n)
    _gant(lot, (0.12, -0.02, 0.025), -0.35, n)
    _finir(coll, lot)


def objet_sac_couchage(coll, leger=True):
    """Sac de couchage roulé : rouleau de la teinte, bouts en spirale plus clairs, deux sangles."""
    n = _n(leger)
    lot = T.Lot(coll, 'couchage')
    O._cyl(lot, TEINTE, (-0.28, 0, 0.15), (0.28, 0, 0.15), 0.15, n + 1)
    for sx in (-1, 1):
        for k, r in enumerate((0.12, 0.085, 0.05, 0.02)):
            mat = 'interieur' if k % 2 == 0 else TEINTE
            O._cyl(lot, mat, (sx * (0.282 + 0.002 * k), 0, 0.15), (sx * (0.286 + 0.002 * k), 0, 0.15), r, n)
    for x in (-0.14, 0.14):
        O._cyl(lot, 'sac_cuir', (x - 0.02, 0, 0.15), (x + 0.02, 0, 0.15), 0.158, n + 1)
        O._rond(lot, 'boucle', (x, -0.16, 0.15), (x, -0.165, 0.15), 0.03, 0.025, 2, k=0.004)
    _finir(coll, lot)


def objet_lit(coll, leger=True):
    """Lit (miniature) : cadre de la teinte (métal), matelas, oreiller, couverture bleue repliée."""
    n = _n(leger)
    lot = T.Lot(coll, 'lit')
    for sx in (-1, 1):
        for sy in (-1, 1):
            O._cyl(lot, TEINTE, (sx * 0.32, sy * 0.16, 0), (sx * 0.32, sy * 0.16, 0.12 if sx < 0 else 0.24), 0.018, 2)
        O._rond(lot, TEINTE, (sx * 0.32, -0.17, 0.09), (sx * 0.32, 0.17, 0.09), 0.015, 0.015, 2, k=0.005)
    O._rond(lot, TEINTE, (0.32, -0.17, 0.22), (0.32, 0.17, 0.22), 0.016, 0.016, 2, k=0.005)  # tête de lit
    for sy in (-1, 1):
        O._rond(lot, TEINTE, (-0.33, sy * 0.165, 0.09), (0.33, sy * 0.165, 0.09), 0.012, 0.015, 2, k=0.005)
    O._rond(lot, 'drap', (-0.31, 0, 0.13), (0.31, 0, 0.13), 0.15, 0.04, n, k=0.03)  # matelas
    O._rond(lot, 'drap', (0.2, 0, 0.18), (0.29, 0, 0.18), 0.12, 0.025, n, k=0.02)  # oreiller
    O._rond(lot, 'couverture', (-0.31, 0, 0.165), (0.1, 0, 0.165), 0.158, 0.012, n, k=0.008)
    O._rond(lot, 'drap', (0.08, 0, 0.172), (0.12, 0, 0.172), 0.158, 0.012, n, k=0.006)  # revers
    _finir(coll, lot)


# --- Munitions -------------------------------------------------------------------------------------------------------

def _balle(lot, c, d, L, r, n):
    """Cartouche couchée : douille de laiton, ogive sombre."""
    c, d = Vector(c), Vector(d).normalized()
    O._cyl(lot, 'laiton', c, c + d * L * 0.68, r, 2)
    O._loft(lot, 'teinte_sombre', [(c + d * L * 0.66, X if abs(d.x) < 0.9 else Y, Z, r * 0.95, r * 0.95, r * 0.95),
                                   (c + d * L * 0.86, X if abs(d.x) < 0.9 else Y, Z, r * 0.7, r * 0.7, r * 0.7),
                                   (c + d * L, X if abs(d.x) < 0.9 else Y, Z, r * 0.15, r * 0.15, r * 0.15)], 2)


def objet_chargeur_pistolet(coll, leger=True):
    """Chargeur de pistolet couché, de la teinte : fin, semelle sombre, cartouche visible en haut ; deux balles."""
    n = _n(leger)
    lot = T.Lot(coll, 'chargeur')
    O._rond(lot, TEINTE, (-0.2, 0, 0.045), (0.16, 0.06, 0.045), 0.045, 0.03, n, k=0.01)
    O._rond(lot, 'teinte_sombre', (-0.22, -0.005, 0.045), (-0.19, 0.0, 0.045), 0.05, 0.038, n, k=0.008)
    _balle(lot, (0.15, 0.06, 0.06), (0.98, 0.18, 0), 0.09, 0.016, n)
    _balle(lot, (0.0, -0.17, 0.016), (0.4, -0.9, 0), 0.09, 0.016, n)
    _balle(lot, (0.12, -0.12, 0.016), (-0.7, -0.7, 0), 0.09, 0.016, n)
    _finir(coll, lot)


def objet_chargeur_fusil(coll, leger=True):
    """Chargeur courbe de fusil couché sur le flanc, de la teinte, nervures et semelle sombres ; deux balles."""
    n = _n(leger)
    lot = T.Lot(coll, 'chargeur')
    secs = []
    m = 6 if leger else 10
    for i in range(m + 1):
        t = i / m
        ang = 0.55 * t
        c = Vector((-0.25 + 0.48 * t, 0.12 * math.sin(ang) * 1.6 - 0.04, 0.04))
        d = Vector((math.cos(ang), math.sin(ang), 0)).normalized()
        secs.append((c, Z, d.cross(Z).normalized(), 0.04, 0.075, 0.03))
    O._loft(lot, TEINTE, secs, n)
    for i in (m // 3, 2 * m // 3):
        c, u, v, *_ = secs[i]
        lot.cube('teinte_sombre', (0.012, 0.155, 0.085), tuple(c), 0.004, Matrix.Rotation(0.55 * i / m, 3, 'Z'))
    _balle(lot, (-0.27, -0.04, 0.05), (-1, 0.05, 0), 0.12, 0.018, n)
    _balle(lot, (0.0, -0.2, 0.018), (0.9, -0.3, 0), 0.12, 0.018, n)
    _balle(lot, (0.1, 0.2, 0.018), (-0.8, 0.5, 0), 0.12, 0.018, n)
    _finir(coll, lot)


def objet_chargeur_sniper(coll, leger=True):
    """Chargeur boîte de sniper, de la teinte, lèvres et semelle sombres ; trois grosses cartouches couchées."""
    n = _n(leger)
    lot = T.Lot(coll, 'chargeur')
    O._rond(lot, TEINTE, (-0.15, 0, 0.0), (-0.15, 0, 0.3), 0.09, 0.045, n, k=0.015)
    O._rond(lot, 'teinte_sombre', (-0.15, 0, 0.0), (-0.15, 0, 0.03), 0.1, 0.055, n, k=0.01)
    O._rond(lot, 'teinte_sombre', (-0.15, 0, 0.29), (-0.15, 0, 0.31), 0.085, 0.04, n, k=0.006)
    _balle(lot, (-0.2, 0, 0.32), (1, 0, 0), 0.15, 0.022, n)
    for k, (x, y, a) in enumerate(((0.05, -0.12, 0.3), (0.12, 0.06, -0.5), (0.0, 0.16, 1.2))):
        _balle(lot, (x, y, 0.022), (math.cos(a), math.sin(a), 0), 0.17, 0.022, n)
    _finir(coll, lot)


# --- Armures (paliers 1, 2, 4) --------------------------------------------------------------------------------------
# Palier 1 « renforcée » : cuir de la teinte, bandes et rivets d'acier. Palier 2 : plaques d'acier de la teinte, joints
# clairs, fente de visière. Palier 4 : alliage sombre de la teinte, lignes et visière lumineuses (cyan).

def _rivets(lot, pts):
    for p in pts:
        _boule(lot, 'rivet', p, 0.014, 0.014, 0.014, 1)


def _casque(coll, leger, palier):
    n = _n(leger)
    lot = T.Lot(coll, 'casque')
    _boule(lot, TEINTE, (0, 0, 0.0), 0.2, 0.22, 0.24, 2, coupe=0.0)
    O._cyl(lot, TEINTE if palier != 1 else 'sac_cuir', (0, 0, 0.0), (0, 0, 0.03), 0.23, n + 1)  # bord
    if palier == 1:
        for a in range(0, 360, 45):
            r = math.radians(a)
            O._cyl(lot, 'rivet', (0.205 * math.cos(r), 0.225 * math.sin(r), 0.04), (0.215 * math.cos(r), 0.235 * math.sin(r), 0.04),
                   0.012, 2)
    elif palier == 2:
        O._rond(lot, 'teinte_sombre', (-0.12, -0.2, 0.11), (0.12, -0.2, 0.11), 0.012, 0.02, n, k=0.006)  # fente
        O._rond(lot, TEINTE, (0, -0.225, 0.14), (0, -0.245, 0.0), 0.022, 0.012, n, k=0.006)  # nasal
    elif palier == 3:
        # Composite : visière sombre large, bande orange en travers, ouïes latérales.
        O._rond(lot, 'teinte_sombre', (-0.16, -0.185, 0.1), (0.16, -0.185, 0.1), 0.035, 0.045, n, k=0.02)
        for sx in (-1, 1):
            for k in range(3):
                O._rond(lot, 'teinte_sombre', (sx * 0.205, -0.04 + k * 0.035, 0.07), (sx * 0.205, -0.04 + k * 0.035, 0.13),
                        0.006, 0.01, 2, k=0.003)
        O._cyl(lot, 'composite_bande', (0, 0, 0.03), (0, 0, 0.055), 0.215, n + 1)  # bandeau orange au-dessus du bord
    elif palier == 5:
        # Nano : casque intégral lisse, grande visière lumineuse, liserés lumineux.
        _boule(lot, 'nano_lueur', (0, -0.11, 0.11), 0.15, 0.13, 0.055, 2)  # visière bombée qui épouse le casque
    else:
        O._rond(lot, 'visiere', (-0.15, -0.19, 0.11), (0.15, -0.19, 0.11), 0.04, 0.05, n, k=0.02)
        O._rond(lot, 'lueur', (0.16, 0.0, 0.12), (0.22, 0.0, 0.12), 0.012, 0.012, 2, k=0.004)
        O._cyl(lot, 'teinte_sombre', (0.19, 0.06, 0.15), (0.19, 0.06, 0.34), 0.008, 2)  # antenne
    _finir(coll, lot)


def _plastron(coll, leger, palier):
    n = _n(leger)
    lot = T.Lot(coll, 'plastron')
    secs = [((0, 0, z), X, Y, a, b, min(a, b) * 0.8) for z, a, b in
            ((0.0, 0.16, 0.08), (0.05, 0.18, 0.1), (0.25, 0.21, 0.11), (0.4, 0.25, 0.1), (0.44, 0.22, 0.08))]
    O._loft(lot, TEINTE, secs, n)
    O._cyl(lot, 'teinte_sombre', (0, 0, 0.43), (0, 0, 0.445), 0.07, n)  # encolure
    for sx in (-1, 1):
        _boule(lot, TEINTE, (sx * 0.24, 0, 0.42), 0.09, 0.11, 0.06, 2)  # épaulières
    if palier == 1:
        for z in (0.12, 0.3):
            O._rond(lot, 'sac_cuir', (-0.2, -0.105, z), (0.2, -0.105, z), 0.012, 0.025, n, k=0.006)
        _rivets(lot, [(sx * 0.12, -0.115, z) for sx in (-1, 0, 1) for z in (0.12, 0.3)])
    elif palier == 2:
        for z in (0.1, 0.18, 0.26, 0.34):
            O._rond(lot, 'rivet', (-0.2, -0.108, z), (0.2, -0.108, z), 0.006, 0.008, 2, k=0.003)
        O._rond(lot, 'rivet', (0, -0.112, 0.05), (0, -0.104, 0.4), 0.008, 0.006, 2, k=0.003)
    elif palier == 3:
        # Composite : plaques en écailles (bandes sombres), bande orange en diagonale.
        for z in (0.1, 0.19, 0.28):
            O._rond(lot, 'teinte_sombre', (-0.19, -0.108, z), (0.19, -0.108, z), 0.005, 0.012, 2, k=0.003)
        O._rond(lot, 'composite_bande', (-0.17, -0.112, 0.38), (0.12, -0.112, 0.05), 0.03, 0.006, n, k=0.003)
        for sx in (-1, 1):
            O._rond(lot, 'composite_bande', (sx * 0.2, -0.04, 0.47), (sx * 0.28, 0.04, 0.44), 0.012, 0.008, 2, k=0.003)
    elif palier == 5:
        # Nano : lignes lumineuses fines qui partent du cœur, cœur hexagonal.
        _boule(lot, 'nano_lueur', (0, -0.11, 0.27), 0.04, 0.015, 0.04, 2)
        for a in (-1.1, -0.4, 0.4, 1.1, 2.4, -2.4):
            d = Vector((math.sin(a), 0, math.cos(a)))
            p0 = Vector((0, -0.11, 0.27)) + d * 0.05
            p1 = Vector((0, -0.105, 0.27)) + d * 0.16
            O._rond(lot, 'nano_lueur', tuple(p0), tuple(p1), 0.005, 0.004, 2, k=0.002)
    else:
        _boule(lot, 'lueur', (0, -0.11, 0.27), 0.05, 0.02, 0.05, 2)  # cœur lumineux
        for sx in (-1, 1):
            O._rond(lot, 'visiere', (sx * 0.06, -0.108, 0.24), (sx * 0.17, -0.1, 0.36), 0.008, 0.006, 2, k=0.003)
            O._rond(lot, 'visiere', (sx * 0.06, -0.108, 0.2), (sx * 0.15, -0.1, 0.08), 0.008, 0.006, 2, k=0.003)
    _finir(coll, lot)


def _jambieres(coll, leger, palier):
    n = _n(leger)
    lot = T.Lot(coll, 'jambieres')
    for sx in (-1, 1):
        x = sx * 0.12
        secs = [((x, 0, z), X, Y, a, a * 0.9, a) for z, a in ((0.0, 0.06), (0.18, 0.07), (0.3, 0.08), (0.42, 0.075))]
        O._loft(lot, TEINTE, secs, n)
        _boule(lot, TEINTE if palier != 1 else 'sac_cuir', (x, -0.06, 0.24), 0.06, 0.04, 0.06, 2)  # genouillère
        if palier == 1:
            for z in (0.08, 0.36):
                O._cyl(lot, 'sac_cuir', (x, 0, z - 0.012), (x, 0, z + 0.012), 0.078, n)
            _rivets(lot, [(x, -0.1, 0.24)])
        elif palier == 2:
            for z in (0.12, 0.33):
                O._cyl(lot, 'rivet', (x, 0, z - 0.004), (x, 0, z + 0.004), 0.082, n)
        elif palier == 3:
            O._rond(lot, 'composite_bande', (x, -0.072, 0.04), (x, -0.08, 0.18), 0.012, 0.006, 2, k=0.003)
            for z in (0.1, 0.36):
                O._cyl(lot, 'teinte_sombre', (x, 0, z - 0.006), (x, 0, z + 0.006), 0.08, n)
        elif palier == 5:
            O._rond(lot, 'nano_lueur', (x + sx * 0.065, -0.03, 0.03), (x + sx * 0.075, -0.03, 0.4), 0.004, 0.006, 2, k=0.002)
            _boule(lot, 'nano_lueur', (x, -0.1, 0.24), 0.02, 0.008, 0.02, 1)
        else:
            O._rond(lot, 'lueur', (x, -0.075, 0.05), (x, -0.08, 0.17), 0.008, 0.006, 2, k=0.003)
            O._rond(lot, 'lueur', (x, -0.085, 0.3), (x, -0.08, 0.4), 0.008, 0.006, 2, k=0.003)
    _finir(coll, lot)


def _bottes_armure(coll, leger, palier):
    n = _n(leger)
    lot = T.Lot(coll, 'bottes')
    for x, rot in ((-0.12, 0.12), (0.12, -0.08)):
        P = _botte(lot, x, n, rot=rot, armure=palier)
        if palier == 1:
            _boule(lot, 'rivet', P((0, -0.17, 0.08)), 0.07, 0.06, 0.05, 1)  # coque de l'orteil
            O._cyl(lot, 'sac_cuir', P((0, 0.04, 0.24)), P((0, 0.04, 0.27)), 0.093, n)
        elif palier == 2:
            _boule(lot, TEINTE, P((0, -0.16, 0.09)), 0.08, 0.07, 0.06, 2)
            O._rond(lot, 'rivet', P((0, -0.05, 0.15)), P((0, 0.02, 0.32)), 0.06, 0.012, n, k=0.006)  # plaque du tibia
        elif palier == 3:
            _boule(lot, 'teinte_sombre', P((0, -0.16, 0.09)), 0.08, 0.07, 0.055, 2)
            O._rond(lot, 'composite_bande', P((0, -0.04, 0.16)), P((0, 0.02, 0.3)), 0.05, 0.01, n, k=0.005)
        elif palier == 5:
            O._rond(lot, 'nano_lueur', P((0, 0.12, 0.03)), P((0, -0.23, 0.03)), 0.095, 0.008, n, k=0.004)
            O._rond(lot, 'nano_lueur', P((0.088, 0.04, 0.1)), P((0.088, 0.04, 0.3)), 0.004, 0.006, 2, k=0.002)
        else:
            O._rond(lot, 'lueur', P((0.087, 0.04, 0.08)), P((0.087, 0.04, 0.3)), 0.004, 0.008, 2, k=0.002)
            O._rond(lot, 'lueur', P((-0.087, 0.04, 0.08)), P((-0.087, 0.04, 0.3)), 0.004, 0.008, 2, k=0.002)
            O._rond(lot, 'semelle', P((0, 0.12, 0.03)), P((0, -0.23, 0.03)), 0.095, 0.02, n, k=0.01)
    _finir(coll, lot)


def _armure_icone(coll, leger, p, piece):
    """Pièce d'armure posée au sol : la même que celle portée (`porte_armures.py`), sortie du corps et posée debout.

    On construit la pièce portée (repère du personnage, m), on garde ce qui fait l'objet (le plastron sans les
    brassards, pour qu'il se lise comme un plastron ; les deux jambières ; la paire de bottes), puis on la recentre au
    sol et on la met à l'échelle des autres objets."""
    import porte as P
    import porte_armures as A
    if piece == 'casque':
        lots = [A.casque(coll, leger, p, P._coque)]
    else:
        lots = {'plastron': A.plastron, 'jambieres': A.jambieres, 'bottes': A.bottes}[piece](coll, leger, p)
    for l in lots:
        l.finir()
    if piece == 'plastron':
        for o in list(coll.objects):
            if o.name.startswith(('bras_', 'avantbras_')):
                bpy.data.objects.remove(o, do_unlink=True)
    pts = [o.matrix_world @ v.co for o in coll.objects if o.type == 'MESH' for v in o.data.vertices]
    c = Vector(((min(q.x for q in pts) + max(q.x for q in pts)) / 2, (min(q.y for q in pts) + max(q.y for q in pts)) / 2,
                min(q.z for q in pts)))
    k = {'casque': 1.45, 'plastron': 1.2, 'jambieres': 0.75, 'bottes': 1.5}[piece]
    # Casque relevé (on voit sa face d'en haut) ; jambières tournées pour qu'on voie les deux.
    rot = {'casque': Matrix.Rotation(0.8, 4, 'Z') @ Matrix.Rotation(-0.45, 4, 'X'),
           'jambieres': Matrix.Rotation(0.8, 4, 'Z')}.get(piece, Matrix())
    for o in coll.objects:
        if o.type == 'MESH':
            o.data.transform(Matrix.Translation(-c))
            o.data.transform(rot)
            o.data.transform(Matrix.Scale(k, 4))
    zmin = min((v.co.z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices))
    for o in coll.objects:
        if o.type == 'MESH':
            o.data.transform(Matrix.Translation((0, 0, -zmin)))
    O._brillant()
    T.adoucir(coll)


def _gantelet_icone(coll, leger, p):
    """Gantelet d'armure posé au sol : la main gantée du personnage (`outils.main_gantee`, doigts tendus) assombrie,
    avec les plaques du gantelet porté (`gantelets.py`), couchée paume en bas ; un second, en miroir, à côté."""
    import outils as OU
    import gantelets as G
    tmp = T.collection(coll.name + '_main')
    OU.main_gantee(tmp, leger)
    for lot in G.plaques(tmp, leger, p):
        lot.finir()
    # Pièces à plat (hiérarchie appliquée), gant assombri : le gantelet se lit à la couleur de l'armure.
    sombre = {'gant': 'teinte_sombre', 'gant_sangle': 'teinte_sombre', 'gant_sombre': 'teinte_sombre', 'peau_main': 'teinte_sombre'}
    objs = list(tmp.objects)
    bpy.context.view_layer.update()
    mondes = {o: o.matrix_world.copy() for o in objs}
    for o in objs:
        if o.type != 'MESH':
            continue
        o.data.transform(mondes[o])
        for i, m in enumerate(o.data.materials):
            nom = m.name.split('.')[0]
            if nom in sombre:
                o.data.materials[i] = T.material(sombre[nom])
    k = 1.25
    for sx, pos, rz in ((1, (0.07, 0.02, 0), 0.3), (-1, (-0.09, -0.03, 0), -0.25)):
        for o in objs:
            if o.type != 'MESH':
                continue
            c = o.copy()
            c.data = o.data.copy()
            c.parent = None
            c.matrix_world = Matrix()
            c.data.transform(Matrix.Diagonal((sx * k, k, k, 1)))
            if sx < 0:
                c.data.flip_normals()
            c.data.transform(Matrix.Rotation(rz, 4, 'Z'))
            c.data.transform(Matrix.Translation(pos))
            coll.objects.link(c)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(tmp)
    zmin = min((v.co.z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices))
    for o in coll.objects:
        if o.type == 'MESH':
            o.data.transform(Matrix.Translation((0, 0, -zmin)))
    O._brillant()
    T.adoucir(coll)


def _armures():
    m = {}
    for p in (1, 2, 3, 4, 5):
        for piece in ('casque', 'plastron', 'jambieres', 'bottes'):
            m[f'objet_armure{p}_{piece}'] = lambda c, leger, p=p, piece=piece: _armure_icone(c, leger, p, piece)
        m[f'objet_armure{p}_gants'] = lambda c, leger, p=p: _gantelet_icone(c, leger, p)
    return m


MODELES = {f.__name__: f for f in (
    objet_boussole, objet_sac_a_dos, objet_capuche, objet_veste, objet_pantalon, objet_bottes, objet_gants, objet_sac_couchage,
    objet_lit, objet_chargeur_pistolet, objet_chargeur_fusil, objet_chargeur_sniper, objet_exosquelette, objet_propulseur)}
MODELES.update(_armures())


def construire(noms=None):
    _palette()
    for nom, fabrique in MODELES.items():
        if noms and nom not in noms:
            continue
        fabrique(T.collection(nom), True)
        unity = T.collection(nom + '_unity')
        fabrique(unity, False)
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
    T.save(os.path.join(ROOT, 'blender', 'equipement.blend'))


if __name__ == '__main__':
    main()
