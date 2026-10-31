"""Famille « clôtures » (style doux) : clôtures, barrières et portails, pas encore dans le jeu.

Dimensions proposées (à confirmer avec le PO), en unités Blender (1 unité = 1 case = 50 cm), le long de X comme les murs
de `construction.py` :
- `cloture_bois`, `barriere_beton`, `barriere_beton_arme` : un tronçon d'une case, 1,2 × 0,3 × 2 (1 m de haut ; on ne
  peut pas sauter par-dessus). Barrières (béton, béton armé, holographique) : les deux poteaux sont des groupes à part,
  `poteau_g_` (-X) et `poteau_d_` (+X), centrés sur le bord de la case ; le jeu cache le poteau d'un côté où touche un
  autre tronçon, pour qu'une rangée n'ait de poteaux qu'à ses deux bouts. Le panneau déborde de 2 cm de chaque côté pour
  que la rangée paraisse continue.
  Le béton et le béton armé ont trois états abîmés : `_abime1` (éclats), `_abime2` (fissures, morceaux tombés ; pour le
  béton armé, les fers apparaissent).
- `portail_bois`, `portail_beton`, `portail_beton_arme` : un portail de 3 m (6 × 0,4 × 3,4) entre deux piliers.
  Bois et béton : deux battants (groupes `battant_g_` et `battant_d_`, pivots `pivot_battant_g` / `pivot_battant_d`, axe
  vertical), que le jeu ouvre en les tournant de 90° vers l'intérieur (+Y). Béton armé : un vantail coulissant (groupe
  `vantail_`, `pivot_vantail` : il glisse vers -X le long de son axe) et un moteur visible sur le pilier, avec un voyant
  (`voyant_*`) qui s'allume quand le portail est en mode automatique.
- Holographique (palier 5) : `barriere_holographique` (tronçon d'une case), `portail_holographique` (3 m) et
  `projecteur_mur_holographique` (machine d'une case). Les nappes de lumière sont des maillages `holo_*` que le jeu
  dessine translucides ; l'anneau du projecteur (`anneau_`, `pivot_anneau`) tourne.

Lancer :  blender --background --python blender/scripts/clotures.py
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
sys.path.insert(0, HERE)
import terra as T  # noqa: E402
import outils as O  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TEINTES = {
    'planche_cl': '#b98a58',
    'planche_cl_claire': '#cc9d69',
    'planche_cl_sombre': '#8a6440',
    'poteau_bois': '#7a5636',
    'beton_cl': '#b3afa6',
    'beton_cl_clair': '#c6c2b9',
    'beton_cl_sombre': '#8c887f',
    'beton_cl_casse': '#77736b',
    'fer_beton': '#7a4a32',
    'acier_cl': '#6c737c',
    'acier_cl_clair': '#9aa2ac',
    'jaune_cl': '#e3b23c',
    'noir_cl': '#2c2e33',
    'voyant_cl': '#ff9a3c',
    'emetteur': '#3d4552',
    'emetteur_clair': '#7f8a99',
    'emetteur_bord': '#2a3039',
    'lentille': '#8eeaff',
    'holo_cyan': '#5fd8ff',
    'holo_clair': '#c9f5ff',
    'voyant_holo': '#7dffb0',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()
H = 2.0  # hauteur d'une clôture ou d'une barrière (1 m ; les portails gardent leur hauteur)


def _n(leger):
    return 3 if leger else 5


def _doux(coll):
    T.adoucir(coll)


# --- Clôtures et barrières -------------------------------------------------------------------------------------------


def cloture_bois(coll, leger=True):
    """Clôture en bois : deux poteaux aux bouts (moitié de poteau partagée avec le tronçon voisin), trois lisses
    horizontales, planches verticales à bout pointu serrées entre les lisses, chapeaux sur les poteaux."""
    n = _n(leger)
    lot = T.Lot(coll, 'cloture')
    for x in (-0.5, 0.5):  # poteaux sur les bords de la case (partagés avec le tronçon voisin)
        O._rond(lot, 'poteau_bois', (x, 0, 0), (x, 0, H + 0.1), 0.07, 0.07, n, k=0.02)
        O._rond(lot, 'planche_cl_sombre', (x, 0, H + 0.1), (x, 0, H + 0.18), 0.085, 0.085, n, k=0.03)
    for z in (0.35, 1.05, 1.7):
        O._rond(lot, 'planche_cl_sombre', (-0.52, -0.08, z), (0.52, -0.08, z), 0.04, 0.07, n, k=0.012)
    rnd = random.Random(4)
    for k in range(5):
        x = -0.4 + 0.2 * k
        h = H - 0.15 + rnd.uniform(-0.04, 0.04)
        teinte = ('planche_cl', 'planche_cl_claire', 'planche_cl', 'planche_cl_sombre', 'planche_cl_claire')[k]
        O._rond(lot, teinte, (x, -0.13, 0.08), (x, -0.13, h), 0.085, 0.022, n, k=0.012)
        O._loft(lot, teinte, [((x, -0.13, h - 0.01), O.X, O.Y, 0.085, 0.022, 0.01),
                              ((x, -0.13, h + 0.12), O.X, O.Y, 0.012, 0.018, 0.006)], 2)  # pointe
    for z in (0.35, 1.05, 1.7):  # clous
        for k in range(5):
            O._cyl(lot, 'noir_cl', (-0.4 + 0.2 * k, -0.155, z), (-0.4 + 0.2 * k, -0.16, z), 0.008, 2)
    lot.finir()
    _doux(coll)


def _panneau_beton(lot, n, mat, z0, z1, ep, etat, rnd, arme=False, L=0.58):
    """Panneau de béton coulé entre deux poteaux, avec éclats (état 1) puis fissures et trous (état 2)."""
    O._rond(lot, mat, (0, 0, z0), (0, 0, z1), L, ep, n, k=0.02, r=0.03)
    if etat >= 1:  # éclats : creux plus sombres sur les arêtes
        for k in range(5 if etat == 1 else 8):
            x = rnd.uniform(-0.5, 0.5)
            z = rnd.choice((z1 - 0.05, rnd.uniform(z0 + 0.2, z1 - 0.2)))
            s = rnd.uniform(0.05, 0.1)
            lot.cube('beton_cl_casse', (s, ep * 2 + 0.01, s * 0.8), (x, 0, z), 0.01,
                     Matrix.Rotation(rnd.uniform(0, 1.5), 3, 'Y'))
    if etat >= 2:  # fissures en zigzag sur la face avant, morceau manquant en haut
        for depart in ((-0.2, z1), (0.25, z0 + 0.3)):
            x, z = depart
            for k in range(6):
                nx, nz = x + rnd.uniform(-0.1, 0.1), z - 0.22 if depart[1] == z1 else z + 0.22
                lot.barre('noir_cl', (x, -ep - 0.004, z), (nx, -ep - 0.004, nz), 0.012)
                x, z = nx, nz
        lot.cube('beton_cl_casse', (0.3, ep * 2 + 0.02, 0.25), (0.3, 0, z1 - 0.1), 0.02, Matrix.Rotation(0.3, 3, 'Y'))
        if arme:  # les fers apparaissent dans le trou
            for k in range(3):
                O._cyl(lot, 'fer_beton', (0.18 + 0.08 * k, -0.02, z1 - 0.3), (0.18 + 0.08 * k, -0.02, z1 + 0.06), 0.012, 2)
            O._cyl(lot, 'fer_beton', (0.12, -0.02, z1 - 0.12), (0.42, -0.02, z1 - 0.12), 0.012, 2)
        for k in range(3):  # gravats au pied
            c = (rnd.uniform(-0.3, 0.5), rnd.uniform(-0.3, -0.18), 0.04)
            lot.cube('beton_cl_sombre', (0.09, 0.08, 0.07), c, 0.02, Matrix.Rotation(rnd.uniform(0, 3), 3, 'Z'))


def _poteaux(coll):
    """Lots des deux poteaux d'un tronçon (`poteau_g_` à -X, `poteau_d_` à +X) : le jeu cache celui d'un côté où un
    autre tronçon touche, pour qu'une rangée de barrières n'ait de poteaux qu'aux deux bouts."""
    return ((-1, T.Lot(coll, 'poteau_g')), (1, T.Lot(coll, 'poteau_d')))


def _barriere(coll, leger, arme, etat):
    n = _n(leger)
    lot = T.Lot(coll, 'barriere')
    rnd = random.Random(10 + etat)
    ep = 0.1 if not arme else 0.13
    L = 0.52  # demi-longueur du panneau : il chevauche un peu le tronçon voisin, la rangée paraît continue
    # Semelle, panneau, chaperon ; poteaux en béton aux bouts (cachables).
    O._rond(lot, 'beton_cl_sombre', (-L, 0, 0.09), (L, 0, 0.09), 0.2, 0.09, n, k=0.02, r=0.04)
    poteaux = _poteaux(coll)
    for s_, p in poteaux:
        x = s_ * 0.5
        O._rond(p, 'beton_cl_sombre', (x, 0, 0), (x, 0, 0.22), 0.12, 0.2 if arme else 0.18, n, k=0.03)
        O._rond(p, 'beton_cl_clair', (x, 0, 0.1), (x, 0, H + 0.1), 0.08, 0.15 if arme else 0.13, n, k=0.025)
        O._rond(p, 'beton_cl_clair', (x, 0, H + 0.06), (x, 0, H + 0.16), 0.1, 0.17 if arme else 0.15, n, k=0.03)
    _panneau_beton(lot, n, 'beton_cl', 0.18, H - 0.05, ep, etat, rnd, arme, L)
    O._rond(lot, 'beton_cl_clair', (-L, 0, H - 0.08), (L, 0, H - 0.08), 0.13 if not arme else 0.16, 0.07, n, k=0.02)
    if arme:
        # Béton armé : lisse d'acier sur le chaperon, plaques d'ancrage boulonnées, bande de danger en bas.
        O._rond(lot, 'acier_cl', (-L, 0, H + 0.0), (L, 0, H + 0.0), 0.05, 0.05, n, k=0.01)
        for s_, p in poteaux:
            x = s_ * 0.5
            O._rond(p, 'acier_cl', (x, -0.16, 0.5), (x, -0.16, 1.6), 0.06, 0.008, 2, k=0.003)
            for z in (0.7, 1.05, 1.4):
                O._cyl(p, 'acier_cl_clair', (x, -0.168, z), (x, -0.18, z), 0.018, 2)
        for k in range(5):
            x = -0.4 + 0.2 * k
            lot.cube('jaune_cl' if k % 2 == 0 else 'noir_cl', (0.2, 0.012, 0.12), (x, -ep - 0.005, 0.32), 0.0)
    else:
        for z in (0.7, 1.35):  # joints de coffrage
            lot.cube('beton_cl_sombre', (2 * L - 0.04, 0.01, 0.015), (0, -ep - 0.003, z))
    lot.finir()
    for _, p in poteaux:
        p.finir()
    _doux(coll)


# --- Portails --------------------------------------------------------------------------------------------------------


def _pilier(lot, n, x, mat, haut=3.4, large=0.22):
    O._rond(lot, mat, (x, 0, 0), (x, 0, haut), large, large, n, k=0.04, r=0.05)
    O._rond(lot, mat, (x, 0, haut - 0.02), (x, 0, haut + 0.12), large + 0.04, large + 0.04, n, k=0.04, r=0.06)


def portail_bois(coll, leger=True):
    """Portail en bois : deux poteaux massifs, deux battants (cadre, planches, écharpe en Z), loquet."""
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    for x in (-3.05, 3.05):
        _pilier(lot, n, x, 'poteau_bois', 3.3, 0.14)
    for s, nom in ((-1, 'g'), (1, 'd')):
        b = T.Lot(coll, f'battant_{nom}')
        x0, x1 = s * 2.9, s * 0.04  # du gond vers le milieu
        xa, xb = min(x0, x1), max(x0, x1)
        for z in (0.35, 1.6, 2.85):
            O._rond(b, 'planche_cl_sombre', (xa, 0, z), (xb, 0, z), 0.05, 0.08, n, k=0.015)
        for xx in (xa + 0.06, xb - 0.06):
            O._rond(b, 'planche_cl_sombre', (xx, 0, 0.25), (xx, 0, 2.95), 0.06, 0.06, n, k=0.015)
        m = 9
        for k in range(m):
            x = xa + 0.16 + (xb - xa - 0.32) * k / (m - 1)
            teinte = ('planche_cl', 'planche_cl_claire', 'planche_cl')[k % 3]
            O._rond(b, teinte, (x, -0.07, 0.2), (x, -0.07, 3.0), 0.14, 0.02, n, k=0.01)
        O._rond(b, 'planche_cl_sombre', (x0 - s * 0.08, -0.1, 0.4), (x1 + s * 0.1, -0.1, 2.8), 0.05, 0.02, n, k=0.01)  # écharpe
        for z in (0.6, 2.6):  # gonds
            O._cyl(b, 'noir_cl', (x0 + s * 0.12, -0.03, z), (x0 + s * 0.12, -0.03, z + 0.15), 0.035, n)
        T.pivot(coll, f'pivot_battant_{nom}', (s * 2.95, 0, 0), (0, 0, 1))
        b.finir()
    lot.cube('noir_cl', (0.3, 0.05, 0.08), (0.0, -0.12, 1.6), 0.01)  # loquet
    lot.finir()
    T.poser_au_sol(coll, 3.3, 0.3)
    _doux(coll)


def portail_beton(coll, leger=True):
    """Portail en béton : deux piliers en béton à chapeau, deux battants à cadre d'acier et barreaux, panneau bas plein."""
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    for x in (-3.1, 3.1):
        _pilier(lot, n, x, 'beton_cl_clair')
        O._rond(lot, 'beton_cl_sombre', (x, 0, 0), (x, 0, 0.25), 0.26, 0.26, n, k=0.03)
    for s, nom in ((-1, 'g'), (1, 'd')):
        b = T.Lot(coll, f'battant_{nom}')
        x0, x1 = s * 2.88, s * 0.03
        xa, xb = min(x0, x1), max(x0, x1)
        for z in (0.2, 1.0, 3.0):
            O._rond(b, 'acier_cl', (xa, 0, z), (xb, 0, z), 0.05, 0.05, n, k=0.015)
        for xx in (xa + 0.04, xb - 0.04):
            O._rond(b, 'acier_cl', (xx, 0, 0.15), (xx, 0, 3.05), 0.05, 0.05, n, k=0.015)
        O._rond(b, 'beton_cl', ((xa + xb) / 2, 0, 0.22), ((xa + xb) / 2, 0, 0.98), (xb - xa) / 2 - 0.08, 0.035, n, k=0.012)
        m = 11
        for k in range(m):
            x = xa + 0.18 + (xb - xa - 0.36) * k / (m - 1)
            O._cyl(b, 'acier_cl_clair', (x, 0, 1.0), (x, 0, 3.0), 0.022, n)
            O._loft(b, 'acier_cl', [((x, 0, 3.0), O.X, O.Y, 0.03, 0.03, 0.03), ((x, 0, 3.15), O.X, O.Y, 0.004, 0.004, 0.004)], 2)
        for z in (0.5, 2.6):
            O._cyl(b, 'noir_cl', (x0 + s * 0.08, 0, z), (x0 + s * 0.08, 0, z + 0.15), 0.04, n)
        T.pivot(coll, f'pivot_battant_{nom}', (s * 2.92, 0, 0), (0, 0, 1))
        b.finir()
    lot.finir()
    T.poser_au_sol(coll, 3.36, 0.3)
    _doux(coll)


def portail_beton_arme(coll, leger=True):
    """Portail en béton armé : piliers épais, vantail coulissant en acier plein (nervures, bande de danger) sur un rail au
    sol, moteur sur le pilier droit avec voyant orange (mode automatique)."""
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    for x in (-3.15, 3.15):
        _pilier(lot, n, x, 'beton_cl_clair', 3.5, 0.26)
        O._rond(lot, 'acier_cl', (x, -0.27, 0.6), (x, -0.27, 2.9), 0.12, 0.01, 2, k=0.004)
    O._rond(lot, 'acier_cl', (-3.0, -0.05, 0.02), (3.0, -0.05, 0.02), 0.04, 0.02, n, k=0.008)  # rail
    v = T.Lot(coll, 'vantail')
    O._rond(v, 'acier_cl', (-2.9, -0.05, 0.08), (2.9, -0.05, 0.08), 0.07, 0.05, n, k=0.015)
    O._rond(v, 'acier_cl', (0, -0.05, 0.12), (0, -0.05, 3.2), 2.88, 0.06, n, k=0.03, r=0.04)
    for k in range(9):  # nervures verticales
        x = -2.6 + 0.65 * k
        O._rond(v, 'acier_cl_clair', (x, -0.115, 0.4), (x, -0.115, 2.95), 0.05, 0.01, n, k=0.005)
    for k in range(14):  # bande de danger
        x = -2.73 + 0.42 * k
        v.cube('jaune_cl' if k % 2 == 0 else 'noir_cl', (0.42, 0.012, 0.18), (x, -0.118, 0.26))
    for x in (-2.4, 2.4):  # roues
        O._cyl(v, 'noir_cl', (x, -0.12, 0.08), (x, 0.02, 0.08), 0.07, n)
    T.pivot(coll, 'pivot_vantail', (0, -0.05, 0.12), (-1, 0, 0))
    # Moteur sur le pilier droit : boîtier, plaque, voyant.
    O._rond(lot, 'acier_cl', (2.75, -0.36, 0.1), (2.75, -0.36, 0.75), 0.2, 0.15, n, k=0.03)
    O._rond(lot, 'jaune_cl', (2.75, -0.52, 0.45), (2.75, -0.52, 0.65), 0.12, 0.008, 2, k=0.003)
    voy = T.Lot(coll, 'voyant_moteur')
    O._cyl(voy, 'voyant_cl', (2.75, -0.36, 0.75), (2.75, -0.36, 0.86), 0.05, n, k=0.012)
    for l in (lot, v, voy):
        l.finir()
    T.poser_au_sol(coll, 3.45, 0.55)
    _doux(coll)


# --- Holographique (palier 5) ----------------------------------------------------------------------------------------
# Le mur de lumière est un maillage à part (`holo_*`) : le jeu le dessine translucide et lumineux (et le cache quand le
# portail est ouvert ou que le courant manque). Le reste (émetteurs) est opaque comme d'habitude.


def _colonne_emettrice(lot, n, x, cote, haut, large=0.09):
    """Poteau émetteur : fût sombre à angles doux, fente de lentille tournée vers `cote` (+1 : +X, -1 : -X), bagues claires,
    chapeau et pied élargis."""
    O._rond(lot, 'emetteur_bord', (x, 0, 0), (x, 0, 0.16), large + 0.04, large + 0.06, n, k=0.03, r=0.03)
    O._rond(lot, 'emetteur', (x, 0, 0.14), (x, 0, haut), large, large + 0.02, n, k=0.025, r=0.03)
    O._rond(lot, 'emetteur_bord', (x, 0, haut - 0.02), (x, 0, haut + 0.1), large + 0.03, large + 0.05, n, k=0.03, r=0.03)
    for z in (0.5, haut - 0.35):
        O._rond(lot, 'emetteur_clair', (x, 0, z), (x, 0, z + 0.06), large + 0.012, large + 0.032, n, k=0.012)
    if cote:
        xf = x + cote * (large + 0.005)
        O._rond(lot, 'lentille', (xf, 0, 0.3), (xf, 0, haut - 0.15), 0.012, 0.035, 2, k=0.006)


def _mur_lumiere(coll, nom, x0, x1, z0, z1, maille=None):
    """Nappe de lumière entre deux émetteurs : voile mince, lignes de balayage horizontales et bords plus vifs."""
    h = T.Lot(coll, nom)
    xm, demi = (x0 + x1) / 2, (x1 - x0) / 2
    h.cube('holo_cyan', (x1 - x0, 0.02, z1 - z0), (xm, 0, (z0 + z1) / 2), 0.0)
    for z in (z0, z1):
        h.cube('holo_clair', (x1 - x0, 0.04, 0.04), (xm, 0, z), 0.0)
    k = max(2, int((z1 - z0) / 0.32))
    for i in range(1, k):
        z = z0 + (z1 - z0) * i / k
        h.cube('holo_clair', (x1 - x0, 0.03, 0.012), (xm, 0, z), 0.0)
    # Mailles verticales légères ; avec `maille`, elles tombent à intervalles fixes depuis le bord de la case, pour se
    # raccorder d'un tronçon à l'autre.
    if maille:
        xs = [x0 + maille * i for i in range(1, int(round((x1 - x0) / maille)))]
    else:
        m = max(2, int(demi * 2 / 0.6))
        xs = [x0 + (x1 - x0) * i / m for i in range(1, m)]
    for x in xs:
        h.cube('holo_clair', (0.01, 0.026, z1 - z0), (x, 0, (z0 + z1) / 2), 0.0)
    h.finir()


def barriere_holographique(coll, leger=True):
    """Barrière holographique : rail émetteur au sol, mur de lumière `holo_mur` d'un bout à l'autre de la case, poteau
    émetteur à chaque bout (`poteau_g_`, `poteau_d_`, cachés par le jeu quand un autre tronçon touche ce côté)."""
    n = _n(leger)
    lot = T.Lot(coll, 'barriere')
    L = 0.52
    O._rond(lot, 'emetteur_bord', (-L, 0, 0.07), (L, 0, 0.07), 0.13, 0.07, n, k=0.02, r=0.03)
    O._rond(lot, 'emetteur', (-L, 0, 0.16), (L, 0, 0.16), 0.08, 0.04, n, k=0.015)
    lot.cube('lentille', (1.0, 0.044, 0.02), (0, 0, 0.2), 0.0)
    for s_, p in _poteaux(coll):
        _colonne_emettrice(p, n, s_ * 0.5, -s_, H, 0.07)
        p.finir()
    lot.finir()
    _mur_lumiere(coll, 'holo_mur', -0.5, 0.5, 0.22, H - 0.12, maille=0.25)
    _doux(coll)


def portail_holographique(coll, leger=True):
    """Portail holographique de 3 m : deux piliers émetteurs, seuil à chevrons, mur de lumière `holo_portail` que le jeu
    éteint pour laisser passer, voyant d'état (`voyant_portail`) sur chaque pilier."""
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    for x in (-3.1, 3.1):
        _colonne_emettrice(lot, n, x, 1 if x < 0 else -1, 3.4, 0.2)
        O._rond(lot, 'emetteur_clair', (x, -0.25, 1.2), (x, -0.25, 2.2), 0.12, 0.012, 2, k=0.005)  # plaque
    O._rond(lot, 'emetteur_bord', (-2.95, 0, 0.03), (2.95, 0, 0.03), 0.24, 0.03, n, k=0.015, r=0.02)  # seuil
    for k in range(13):
        x = -2.7 + 0.45 * k
        lot.cube('jaune_cl' if k % 2 == 0 else 'noir_cl', (0.45, 0.16, 0.012), (x, -0.13, 0.062), 0.0)
    O._rond(lot, 'lentille', (-2.9, 0.0, 0.062), (2.9, 0.0, 0.062), 0.03, 0.008, 2, k=0.004)
    voy = T.Lot(coll, 'voyant_portail')
    for x in (-3.1, 3.1):
        O._cyl(voy, 'voyant_holo', (x, -0.262, 2.0), (x, -0.29, 2.0), 0.05, n)
    lot.finir()
    voy.finir()
    _mur_lumiere(coll, 'holo_portail', -2.88, 2.88, 0.08, 3.1)
    T.poser_au_sol(coll, 3.35, 0.3)
    _doux(coll)


def projecteur_mur_holographique(coll, leger=True):
    """Projecteur de mur holographique (machine d'une case) : socle à pieds, fût à ailettes, tête émettrice à lentille
    lumineuse (`holo_noyau`), anneau de focalisation qui tourne (`anneau_`, pivot vertical), boîtier d'alimentation et
    voyant (`voyant_projecteur`)."""
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'emetteur_bord', (0, 0, 0), (0, 0, 0.22), 0.44, 0.44, n, k=0.05, r=0.12)
    O._rond(lot, 'emetteur', (0, 0, 0.2), (0, 0, 0.36), 0.36, 0.36, n, k=0.05, r=0.1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            O._cyl(lot, 'emetteur_clair', (sx * 0.36, sy * 0.36, 0.22), (sx * 0.36, sy * 0.36, 0.25), 0.03, n)
    O._cyl(lot, 'emetteur', (0, 0, 0.34), (0, 0, 2.4), 0.15, n + 2)
    for k in range(6):  # ailettes de refroidissement
        a = k * math.pi / 3
        c, s_ = math.cos(a), math.sin(a)
        lot.cube('emetteur_clair', (0.16, 0.03, 1.5), (c * 0.2, s_ * 0.2, 1.2), 0.008, Matrix.Rotation(a, 3, 'Z'))
    for z in (0.4, 2.0, 2.25):
        O._cyl(lot, 'emetteur_bord', (0, 0, z), (0, 0, z + 0.07), 0.2, n + 2)
    # Tête : coupelle, lentille.
    O._loft(lot, 'emetteur', [((0, 0, 2.4), O.X, O.Y, 0.16, 0.16, 0.16), ((0, 0, 2.65), O.X, O.Y, 0.3, 0.3, 0.3),
                              ((0, 0, 2.72), O.X, O.Y, 0.3, 0.3, 0.3)], n + 2)
    O._cyl(lot, 'emetteur_bord', (0, 0, 2.68), (0, 0, 2.75), 0.32, n + 2)
    noyau = T.Lot(coll, 'holo_noyau')
    O._loft(noyau, 'lentille', [((0, 0, 2.66), O.X, O.Y, 0.22, 0.22, 0.22), ((0, 0, 2.82), O.X, O.Y, 0.17, 0.17, 0.17),
                                ((0, 0, 2.90), O.X, O.Y, 0.06, 0.06, 0.06)], n + 2)
    O._cyl(noyau, 'holo_clair', (0, 0, 2.90), (0, 0, 3.30), 0.025, n)  # faisceau
    # Anneau de focalisation sur trois bras.
    a_ = T.Lot(coll, 'anneau_focal')
    seg = 16
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1.1) / seg
        a_.barre('emetteur_clair', (0.36 * math.cos(a0), 0.36 * math.sin(a0), 2.95),
                 (0.36 * math.cos(a1), 0.36 * math.sin(a1), 2.95), 0.035)
    for k in range(3):
        a = 2 * math.pi * k / 3
        a_.barre('emetteur', (0.3 * math.cos(a), 0.3 * math.sin(a), 2.73), (0.36 * math.cos(a), 0.36 * math.sin(a), 2.95), 0.03)
        a_.cube('lentille', (0.06, 0.06, 0.04), (0.36 * math.cos(a), 0.36 * math.sin(a), 2.95), 0.01)
    T.pivot(coll, 'pivot_anneau', (0, 0, 2.95), (0, 0, 1))
    # Boîtier d'alimentation et voyant.
    O._rond(lot, 'emetteur_clair', (0, -0.3, 0.36), (0, -0.3, 0.8), 0.14, 0.06, n, k=0.02, r=0.03)
    O._cyl(lot, 'noir_cl', (0, -0.36, 0.5), (0, -0.42, 0.5), 0.045, n)
    voy = T.Lot(coll, 'voyant_projecteur')
    O._cyl(voy, 'voyant_holo', (0, -0.362, 0.7), (0, -0.375, 0.7), 0.03, n)
    for l in (lot, noyau, a_, voy):
        l.finir()
    _doux(coll)


MODELES = {
    'cloture_bois': cloture_bois,
    'barriere_beton': lambda c, leger=True: _barriere(c, leger, False, 0),
    'barriere_beton_abime1': lambda c, leger=True: _barriere(c, leger, False, 1),
    'barriere_beton_abime2': lambda c, leger=True: _barriere(c, leger, False, 2),
    'barriere_beton_arme': lambda c, leger=True: _barriere(c, leger, True, 0),
    'barriere_beton_arme_abime1': lambda c, leger=True: _barriere(c, leger, True, 1),
    'barriere_beton_arme_abime2': lambda c, leger=True: _barriere(c, leger, True, 2),
    'portail_bois': portail_bois,
    'portail_beton': portail_beton,
    'portail_beton_arme': portail_beton_arme,
    'barriere_holographique': barriere_holographique,
    'portail_holographique': portail_holographique,
    'projecteur_mur_holographique': projecteur_mur_holographique,
}


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
    T.save(os.path.join(ROOT, 'blender', 'clotures.blend'))


if __name__ == '__main__':
    main()
