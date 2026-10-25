"""Famille « construction » : les pièces que le joueur pose pour bâtir (murs, sols, portes, escaliers, piliers).

Quatre matériaux : bois, pierre, béton (pas de porte) et aluminium (plus l'icône de la porte de garage). Les dimensions suivent exactement les pièces du jeu (`content/buildings.json`,
`src/render/buildingView.ts`) ; en unités Blender (1 unité = 1 case = 50 cm) :

- `mur_<mat>` : un bloc de mur de 50 cm de haut (5 par étage), le long de X : 1,2 × 0,2 × 1 (0,6 m : la longueur
  d'un bloc isolé, qui déborde de l'épaisseur du mur à chaque bout). Le jeu le raccourcit (étirement en X) pour qu'il
  s'arrête au bord de la case quand un mur continue ou dans un angle : deux blocs ne se recouvrent jamais.
- `dalle_<mat>` : sol ou plafond d'une case, 1 × 1 × 0,2 (étirée par le jeu quand un plafond déborde sur un mur).
- `porte_<mat>` : cadre sur tout l'étage, 1,2 × 0,2 × 5, passage de 1 × 4 ; `porte_<mat>_battant` : le battant seul
  (1 × 0,08 × 4, poignée en plus), que le jeu tourne quand la porte est ouverte.
- `escalier_<mat>` : une marche de 50 cm (1 × 1 × 1) qui monte vers +X.
- `pilier_<mat>_bas` / `_fut` / `_haut` / `_seul` : tronçons de 1 de haut, 0,6 de côté, empilés par le jeu
  (bas = avec socle, haut = avec chapiteau, seul = pilier d'un seul tronçon).

Lancer :  blender --background --python blender/scripts/construction.py
Produit :  blender/construction.blend, export/<nom>.glb et export/unity/<nom>.glb
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

TEINTES = {
    'planche': '#b58a5b',
    'planche_claire': '#c49a68',
    'planche_sombre': '#8e6a43',
    'moellon': '#7d8288',
    'moellon_clair': '#959aa0',
    'moellon_sombre': '#6c7076',
    'mortier': '#a8a49c',
    'fer_noir': '#2e3134',
    'beton': '#a9a69f',
    'beton_clair': '#bdbab3',
    'beton_sombre': '#8e8b84',
    'beton_joint': '#77746e',
    'alu': '#c3c9d0',
    'alu_clair': '#dfe4e9',
    'alu_sombre': '#9aa1a9',
    'alu_joint': '#6c737b',
    'alu_vitre': '#a9d4ea',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()

#: Jeu de teintes par matériau : (principale, claire, sombre, joint).
BOIS = ('planche', 'planche_claire', 'planche_sombre', 'bois_sombre')
PIERRE = ('moellon', 'moellon_clair', 'moellon_sombre', 'mortier')
BETON = ('beton', 'beton_clair', 'beton_sombre', 'beton_joint')
ALU = ('alu', 'alu_clair', 'alu_sombre', 'alu_joint')
MATS = {'bois': BOIS, 'pierre': PIERRE, 'beton': BETON, 'aluminium': ALU}
#: Matériaux sans porte dans le jeu (pas de modèle de porte).
SANS_PORTE = {'beton'}

EP = 0.2  # épaisseur d'un mur (10 cm)
JOINT = 0.03  # largeur d'un joint


def _bv(leger, b):
    return b * (0.6 if leger else 1.0)


# --- Murs -------------------------------------------------------------------------------------------------


def _parement_bois(lot, t, x0, x1, z0, z1, leger, rangs=2):
    """Planches horizontales sur toute la longueur (teinte selon le rang), sur une âme sombre."""
    lot.cube(t[3], (x1 - x0 - 0.02, EP * 0.7, z1 - z0), ((x0 + x1) / 2, 0, (z0 + z1) / 2))
    h = (z1 - z0) / rangs
    for i in range(rangs):
        z = z0 + h * (i + 0.5)
        lot.cube(t[0] if i % 2 == 0 else t[1], (x1 - x0, EP, h - JOINT), ((x0 + x1) / 2, 0, z), _bv(leger, 0.02))


def _parement_pierre(lot, t, x0, x1, z0, z1, leger, joints=((0.0,), (-0.3, 0.3)), centre=True):
    """Moellons en rangs décalés sur une âme de mortier ; `joints` : abscisses des joints verticaux par rang."""
    lot.cube(t[3], (x1 - x0 - 0.02, EP * 0.7, z1 - z0), ((x0 + x1) / 2, 0, (z0 + z1) / 2))
    rangs = len(joints)
    h = (z1 - z0) / rangs
    for i, js in enumerate(joints):
        z = z0 + h * (i + 0.5)
        bords = [x0, *js, x1]
        for k in range(len(bords) - 1):
            a, b = bords[k], bords[k + 1]
            # Les moellons des bouts gardent la teinte du rang ; ceux du milieu varient.
            bout = k == 0 or k == len(bords) - 2
            teinte = (t[0] if i % 2 == 0 else t[1]) if bout or not centre else t[2]
            ga = 0 if k == 0 else JOINT / 2
            gb = 0 if k == len(bords) - 2 else JOINT / 2
            lot.cube(teinte, (b - a - ga - gb, EP, h - JOINT), ((a + ga + b - gb) / 2, 0, z), _bv(leger, 0.025))


def _parement_beton(lot, t, x0, x1, z0, z1, leger):
    """Béton banché : un seul bloc lisse, une ligne de reprise au milieu, trous des tiges de coffrage."""
    lot.cube(t[0], (x1 - x0, EP, z1 - z0), ((x0 + x1) / 2, 0, (z0 + z1) / 2), _bv(leger, 0.02))
    zm = (z0 + z1) / 2
    lot.cube(t[3], (x1 - x0 - 0.02, EP + 0.006, 0.012), ((x0 + x1) / 2, 0, zm))
    for x in (x0 + 0.3, x1 - 0.3):
        for z in (z0 + 0.25, z1 - 0.25):
            lot.cube(t[3], (0.05, EP + 0.008, 0.05), (x, 0, z), 0.01)


def _parement_alu(lot, t, x0, x1, z0, z1, leger):
    """Bardage d'aluminium : panneau à nervures verticales sur une âme sombre, lisses haute et basse rivetées."""
    lot.cube(t[3], (x1 - x0 - 0.02, EP * 0.7, z1 - z0), ((x0 + x1) / 2, 0, (z0 + z1) / 2))
    lot.cube(t[0], (x1 - x0, EP * 0.85, z1 - z0 - 0.02), ((x0 + x1) / 2, 0, (z0 + z1) / 2), _bv(leger, 0.01))
    n = 6
    for k in range(n):
        x = x0 + (k + 0.5) * (x1 - x0) / n
        for sy in (-1, 1):
            lot.cube(t[1], (0.06, 0.03, z1 - z0 - 0.08), (x, sy * EP * 0.44, (z0 + z1) / 2), 0.01)
    for z in (z0 + 0.06, z1 - 0.06):
        for sy in (-1, 1):
            lot.cube(t[2], (x1 - x0, 0.03, 0.08), ((x0 + x1) / 2, sy * EP * 0.46, z), 0.008)
            for k in range(4):
                x = x0 + (k + 0.5) * (x1 - x0) / 4
                lot.cube(t[3], (0.025, 0.04, 0.025), (x, sy * EP * 0.47, z), 0.005)


def mur(coll, mat, leger=True):
    t = MATS[mat]
    lot = T.Lot(coll, f'mur_{mat}')
    if mat == 'bois':
        _parement_bois(lot, t, -0.6, 0.6, 0, 1, leger)
    elif mat == 'beton':
        _parement_beton(lot, t, -0.6, 0.6, 0, 1, leger)
    elif mat == 'aluminium':
        _parement_alu(lot, t, -0.6, 0.6, 0, 1, leger)
    else:
        _parement_pierre(lot, t, -0.6, 0.6, 0, 1, leger)
    lot.finir()


# --- Sols / plafonds ---------------------------------------------------------------------------------------


def dalle(coll, mat, leger=True):
    t = MATS[mat]
    lot = T.Lot(coll, f'dalle_{mat}')
    H = 0.2
    lot.cube(t[3], (0.95, 0.95, H * 0.8), (0, 0, H * 0.4))
    if mat == 'bois':
        # 4 lames le long de X, une sur deux plus claire, une un peu plus sombre.
        for i in range(4):
            y = -0.375 + 0.25 * i
            lot.cube((t[0], t[1], t[0], t[2])[i], (1.0, 0.25 - 0.02, H), (0, y, H / 2), _bv(leger, 0.015))
    elif mat == 'beton':
        # Dalle coulée d'une pièce, chanfreinée, un joint de dilatation au milieu.
        lot.cube(t[0], (1.0, 1.0, H), (0, 0, H / 2), _bv(leger, 0.02))
        lot.cube(t[3], (1.0 - 0.04, 0.012, 0.006), (0, 0, H + 0.002))
    elif mat == 'aluminium':
        # Tôle larmée : plaque et petits reliefs en losange.
        lot.cube(t[0], (1.0, 1.0, H), (0, 0, H / 2), _bv(leger, 0.012))
        m = 4 if leger else 6
        for i in range(m):
            for j in range(m):
                x = -0.5 + (i + 0.5) / m
                y = -0.5 + (j + 0.5) / m
                ang = 0.785 if (i + j) % 2 == 0 else -0.785
                lot.cube(t[1], (0.1, 0.025, 0.012), (x, y, H + 0.004), 0.004, Matrix.Rotation(ang, 3, 'Z'))
    else:
        # 2 × 2 dalles de pierre.
        for i in range(2):
            for j in range(2):
                teinte = (t[0], t[1], t[1], t[2])[i * 2 + j]
                lot.cube(teinte, (0.5 - JOINT, 0.5 - JOINT, H), (-0.25 + 0.5 * i, -0.25 + 0.5 * j, H / 2),
                         _bv(leger, 0.025))
    lot.finir()


# --- Portes ------------------------------------------------------------------------------------------------


def porte(coll, mat, leger=True):
    """Cadre : deux montants de 0,1 et un linteau au-dessus du passage (0 à 4), habillé comme le mur."""
    t = MATS[mat]
    lot = T.Lot(coll, f'porte_{mat}')
    # Montants (x de ±0,5 à ±0,6) sur toute la hauteur, un peu plus épais que le mur : ils dépassent dans la case
    # voisine et recouvrent le bout du mur d'à côté sans que leurs faces se confondent.
    for s in (-1, 1):
        if mat in ('bois', 'aluminium'):
            lot.cube(t[2], (0.1, EP * 1.15, 5.0), (s * 0.55, 0, 2.5), _bv(leger, 0.015))
        else:
            # Montants de pierre en blocs empilés.
            for k in range(5):
                lot.cube(t[0] if k % 2 == 0 else t[1], (0.1, EP * 1.15, 1 - JOINT), (s * 0.55, 0, k + 0.5),
                         _bv(leger, 0.015))
    # Linteau (4 à 5) : comme un bloc de mur, plus une poutre ou une pierre de linteau au bas.
    if mat == 'bois':
        _parement_bois(lot, t, -0.5, 0.5, 4.15, 5, leger, rangs=2)
        lot.cube(t[2], (1.2, EP * 1.15, 0.15), (0, 0, 4.075), _bv(leger, 0.015))
    elif mat == 'aluminium':
        _parement_alu(lot, t, -0.5, 0.5, 4.15, 5, leger)
        lot.cube(t[2], (1.2, EP * 1.15, 0.15), (0, 0, 4.075), _bv(leger, 0.015))
    else:
        _parement_pierre(lot, t, -0.5, 0.5, 4.2, 5, leger, joints=((0.0,),), centre=False)
        lot.cube(t[2], (1.2, EP * 1.1, 0.2), (0, 0, 4.1), _bv(leger, 0.02))
    # Seuil discret au sol.
    lot.cube(t[2], (1.0, EP * 1.1, 0.04), (0, 0, 0.02))
    lot.finir()


def _battant_alu(lot, leger):
    """Battant d'aluminium : cadre, panneau plein en bas, vitre en haut, barre de poussée, poignées."""
    t = ALU
    E = 0.08
    for x in (-0.46, 0.46):
        lot.cube(t[2], (0.08, E + 0.01, 3.96), (x, 0, 2.0), _bv(leger, 0.01))
    for z in (0.06, 2.1, 3.94):
        lot.cube(t[2], (0.96, E + 0.01, 0.1), (0, 0, z), _bv(leger, 0.01))
    lot.cube(t[0], (0.86, E * 0.8, 1.98), (0, 0, 1.08), _bv(leger, 0.008))
    for z in (0.5, 1.0, 1.5):
        lot.cube(t[1], (0.8, E * 0.85, 0.04), (0, 0, z), 0.005)
    lot.cube('alu_vitre', (0.86, E * 0.4, 1.76), (0, 0, 3.02), 0.01)
    for s in (-1, 1):
        lot.cube('fer_noir', (0.05, 0.05, 0.22), (0.38, s * (E / 2 + 0.035), 2.0))
        lot.cube(t[1], (0.7, 0.04, 0.05), (0, s * (E / 2 + 0.05), 1.7), 0.01)


def battant(coll, mat, leger=True):
    """Battant de 1 × 4 : planches verticales, traverses et écharpe, poignée de fer (pierre : ferrures de fer)."""
    t = MATS['bois']
    lot = T.Lot(coll, f'porte_{mat}_battant')
    if mat == 'aluminium':
        _battant_alu(lot, leger)
        lot.finir()
        return
    E = 0.08
    for i in range(4):
        x = -0.375 + 0.25 * i
        lot.cube((t[0], t[1], t[0], t[1])[i], (0.25 - 0.012, E, 3.96), (x, 0, 2.0), _bv(leger, 0.01))
    ferrure = 'fer_noir' if mat == 'pierre' else t[2]
    for z in (0.6, 3.4):
        lot.cube(ferrure, (0.96, E + 0.03, 0.14 if mat == 'bois' else 0.1), (0, 0, z))
    if mat == 'bois':
        lot.barre(t[2], (-0.4, 0, 0.7), (0.4, 0, 3.3), 0.1)
    else:
        lot.cube('fer_noir', (0.96, E + 0.03, 0.1), (0, 0, 2.0))
        for x in (-0.4, 0.4):
            for z in (0.6, 2.0, 3.4):
                lot.cube('fer_noir', (0.05, E + 0.05, 0.05), (x, 0, z))
    # Poignée des deux côtés, côté opposé aux gonds (gonds à x = -0,5).
    for s in (-1, 1):
        lot.cube('fer_noir', (0.05, 0.05, 0.22), (0.38, s * (E / 2 + 0.035), 2.0))
        lot.cube('fer_noir', (0.04, 0.04, 0.04), (0.38, s * (E / 2 + 0.015), 2.08))
        lot.cube('fer_noir', (0.04, 0.04, 0.04), (0.38, s * (E / 2 + 0.015), 1.92))
    lot.finir()


# --- Escaliers ---------------------------------------------------------------------------------------------


def escalier(coll, mat, leger=True):
    """Trois marches qui montent vers +X, dans le cube de la pièce (le jeu marche sur la pente)."""
    t = MATS[mat]
    lot = T.Lot(coll, f'escalier_{mat}')
    n = 3
    for i in range(n):
        x0 = -0.5 + i / n
        h = (i + 1) / n
        # Corps de la marche (du bas au palier de la marche), puis le dessus (nez qui déborde un peu).
        # Bois : marches entre les limons (un peu moins larges, pour que leurs flancs ne touchent pas les limons).
        large = 0.88 if mat in ('bois', 'aluminium') else 1.0
        if mat == 'aluminium':
            # Marches en caillebotis (plaques nervurées) entre deux limons ; pas de corps plein.
            lot.cube(t[0], (1 / n + 0.02, large, 0.05), (x0 + 0.5 / n - 0.01, 0, h - 0.025), _bv(leger, 0.008))
            for k in range(4):
                lot.cube(t[3], (1 / n - 0.04, 0.03, 0.052), (x0 + 0.5 / n, -0.33 + k * 0.22, h - 0.025))
            continue
        corps = t[3] if mat == 'bois' else (t[0] if mat == 'beton' else (t[0] if i % 2 == 0 else t[1]))
        lot.cube(corps, (0.5 - x0 - 0.01, large - 0.02, h - 0.06), ((x0 + 0.5) / 2 - 0.005, 0, (h - 0.06) / 2))
        lot.cube(t[0] if (i % 2 == 0 or mat == 'beton') else t[1], (1 / n + 0.03, large, 0.06),
                 (x0 + 0.5 / n - 0.015, 0, h - 0.03), _bv(leger, 0.012))
    if mat == 'aluminium':
        for s in (-1, 1):
            lot.barre(t[2], (-0.5, s * 0.47, 0.02), (0.5, s * 0.47, 0.98), 0.07, 0.01)
            lot.cube(t[2], (0.06, 0.06, 0.98), (0.47, s * 0.47, 0.49))
    if mat == 'bois':
        # Limons sur les côtés.
        for s in (-1, 1):
            lot.cube(t[2], (1.0, 0.06, 0.5), (0, s * 0.47, 0.25))
    lot.finir()


# --- Piliers -----------------------------------------------------------------------------------------------


def pilier(coll, mat, partie, leger=True):
    t = MATS[mat]
    lot = T.Lot(coll, f'pilier_{mat}_{partie}')
    S = 0.6
    socle = partie in ('bas', 'seul')
    chapiteau = partie in ('haut', 'seul')
    z0 = 0.18 if socle else 0.0
    z1 = 0.82 if chapiteau else 1.0
    if mat == 'bois':
        lot.cube(t[0], (S * 0.8, S * 0.8, z1 - z0), (0, 0, (z0 + z1) / 2), _bv(leger, 0.04))
        if socle:
            lot.cube('moellon_sombre', (S, S, 0.18), (0, 0, 0.09), _bv(leger, 0.03))
        if chapiteau:
            lot.cube(t[2], (S, S, 0.18), (0, 0, 0.91), _bv(leger, 0.02))
    elif mat == 'beton':
        # Poteau de béton lisse aux arêtes chanfreinées, semelle et chapiteau plus larges.
        lot.cube(t[0], (S * 0.78, S * 0.78, z1 - z0), (0, 0, (z0 + z1) / 2), _bv(leger, 0.05))
        if socle:
            lot.cube(t[2], (S, S, 0.18), (0, 0, 0.09), _bv(leger, 0.03))
        if chapiteau:
            lot.cube(t[1], (S, S, 0.18), (0, 0, 0.91), _bv(leger, 0.03))
    elif mat == 'aluminium':
        # Profilé en H d'aluminium boulonné sur platines.
        lot.cube(t[0], (S * 0.75, 0.08, z1 - z0), (0, 0, (z0 + z1) / 2), _bv(leger, 0.01))
        for sy in (-1, 1):
            lot.cube(t[1], (S * 0.75, 0.06, z1 - z0), (0, sy * S * 0.34, (z0 + z1) / 2), _bv(leger, 0.01))
        for z, ok in ((0.04, socle), (0.96, chapiteau)):
            if ok:
                lot.cube(t[2], (S, S, 0.08), (0, 0, z), _bv(leger, 0.015))
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        lot.cube(t[3], (0.06, 0.06, 0.05), (sx * S * 0.4, sy * S * 0.4, z + (0.05 if z < 0.5 else -0.05)),
                                 0.01)
    else:
        # Tambours de pierre alternés.
        n = 2
        h = (z1 - z0) / n
        for k in range(n):
            lot.cube(t[0] if k % 2 == 0 else t[1], (S * 0.82, S * 0.82, h - JOINT * 0.6),
                     (0, 0, z0 + h * (k + 0.5)), _bv(leger, 0.03))
        lot.cube(t[3], (S * 0.7, S * 0.7, z1 - z0), (0, 0, (z0 + z1) / 2))
        if socle:
            lot.cube(t[2], (S, S, 0.18), (0, 0, 0.09), _bv(leger, 0.03))
        if chapiteau:
            lot.cube(t[2], (S, S, 0.18), (0, 0, 0.91), _bv(leger, 0.03))
    lot.finir()


# --- Liste et export ---------------------------------------------------------------------------------------

def _modeles():
    m = {}
    for mat in MATS:
        m[f'mur_{mat}'] = lambda c, leger, mat=mat: mur(c, mat, leger)
        m[f'dalle_{mat}'] = lambda c, leger, mat=mat: dalle(c, mat, leger)
        if mat not in SANS_PORTE:
            m[f'porte_{mat}'] = lambda c, leger, mat=mat: porte(c, mat, leger)
            m[f'porte_{mat}_battant'] = lambda c, leger, mat=mat: battant(c, mat, leger)
        m[f'escalier_{mat}'] = lambda c, leger, mat=mat: escalier(c, mat, leger)
        for partie in ('bas', 'fut', 'haut', 'seul'):
            m[f'pilier_{mat}_{partie}'] = lambda c, leger, mat=mat, p=partie: pilier(c, mat, p, leger)
    m['porte_garage_aluminium'] = porte_garage
    return m


def porte_garage(coll, leger=True):
    """Icône de la porte de garage en aluminium (le jeu dessine la vraie, par segments) : cadre, tablier à lattes à
    moitié levé, caisson d'enroulement en haut, poignée. 2 × 0,2 × 2,4 (unités)."""
    t = ALU
    lot = T.Lot(coll, 'porte_garage_aluminium')
    for s in (-1, 1):
        lot.cube(t[2], (0.12, EP * 1.2, 2.4), (s * 1.0, 0, 1.2), _bv(leger, 0.015))
    lot.cube(t[2], (2.12, EP * 1.6, 0.36), (0, 0, 2.22), _bv(leger, 0.03))  # caisson
    for k in range(7):
        lot.cube(t[0] if k % 2 == 0 else t[1], (1.88, EP * 0.6, 0.22), (0, 0, 0.62 + k * 0.215), _bv(leger, 0.012))
    lot.cube('fer_noir', (0.3, 0.06, 0.05), (0, -EP * 0.4, 0.68))
    lot.finir()


MODELES = _modeles()


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
    T.save(os.path.join(ROOT, 'blender', 'construction.blend'))


if __name__ == '__main__':
    main()
