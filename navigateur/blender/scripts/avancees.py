"""Famille « machines avancées » (style doux) : machines pas encore dans le jeu (nouveaux chantiers).

Dimensions proposées (à confirmer avec le PO), en unités Blender (1 unité = 1 case = 50 cm), façade vers -Y :
- `borne_recharge` : 1 x 1 case, 1,6 m. Fût arrondi, écran (`voyant_ecran`), bandeau lumineux de charge
  (`voyant_charge`), pistolet de recharge accroché sur le flanc avec son câble.
- `compresseur_air` : 2 x 2 cases, 0,9 m. Réservoir couché sur un châssis, compresseur à ailettes et moteur sur le
  dessus, volant entraîné par courroie (groupe `volant_`, `pivot_volant` axe X : il tourne quand la machine marche),
  manomètre, vanne de sortie, voyant `voyant_compresseur`.
- `purificateur_air` : 2 x 2 cases, 1,75 m. Caisson à grande grille d'aspiration en façade, cartouches filtrantes sur
  le flanc droit, pupitre sur le flanc gauche, deux ventilateurs sur le toit (groupes `helice_g_` / `helice_d_`,
  pivots verticaux), bandeau lumineux `voyant_air`.
- `bras_industriel` : 2 x 2 cases, robot à six axes (dépasse vers l'avant). Groupes en chaîne : `tourelle_`
  (`pivot_tourelle`, Z), `epaule_` (`pivot_epaule`, X), `coude_` (`pivot_coude`, X), `poignet_` (`pivot_poignet`, axe de
  l'outil) ; colonne lumineuse `voyant_bras`.
- `foreuse_plasma` : 4 x 4 cases, 1,9 m. Variante de la foreuse : lance à bobines, dard de plasma lumineux `plasma_`,
  condensateurs, radiateur, goulotte devant, écran `voyant_ecran`.
- `electrolyseur` : 3 x 3 cases, 1,6 m. Empilement de cellules (fenêtre `voyant_electrolyse`), réservoirs d'hydrogène et
  d'oxygène, arrivée d'eau.
- `fabricateur_universel` : 3 x 3 cases, 1,6 m. Chambre vitrée `vitre_chambre` (translucide en jeu), plateau tournant
  `plateau_` (`pivot_plateau`), objet en cours d'impression `voyant_impression`, bandeau `voyant_fab`.
- `pile_combustible` : 2 x 2 cases, 1,4 m. Modules de cellules (`voyant_modules`), ventilateur `helice_pile_`, bornes
  (`accroche_cable`), bouteilles d'hydrogène.
- `coffre_quantique` : 2 x 2 cases. Couvercle `couvercle_` (`pivot_couvercle`, comme les coffres), cristal `cristal_`
  (`pivot_cristal`), lumières `voyant_quantique`.
- `tourelle_rail` : 3 x 2 cases comme les autres tourelles. Tourelle `tourelle_` (`pivot_tourelle`), rail lumineux
  `voyant_rail`.

Lancer :  blender --background --python blender/scripts/avancees.py
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

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

TEINTES = {
    'av_socle': '#b9b2a4',
    'av_socle_sombre': '#958e80',
    'av_blanc': '#dfe3e7',
    'av_gris': '#8c97a3',
    'av_sombre': '#566170',
    'av_fonce': '#363d47',
    'av_vert': '#3fae8c',
    'av_vert_fonce': '#2c7f66',
    'av_bleu': '#3f7fc4',
    'av_rouge': '#c8553d',
    'av_cuivre': '#c98a4b',
    'av_cable': '#25282d',
    'av_grille': '#2b3037',
    'av_filtre': '#ece3c6',
    'av_filtre_pli': '#cfc4a2',
    'av_cadran': '#f3f0e6',
    'av_ecran': '#7fe6ff',
    'av_voyant_vert': '#6be08f',
    'av_voyant_ambre': '#f2b33d',
    'av_orange': '#e58a2e',
    'av_orange_fonce': '#b8661c',
    'av_violet': '#8a5cc8',
    'av_violet_fonce': '#5e3d92',
    'av_plasma': '#d9a8ff',
    'av_plasma_coeur': '#f6e8ff',
    'av_bleu_clair': '#9cc8ee',
    'av_jaune': '#e3b23c',
    'av_vitre': '#bfe9f2',
    'av_nuit': '#2a2340',
    'av_nuit_clair': '#463a68',
    'av_quantique': '#7ff3ff',
}
BRILLANTS = {'av_orange': 0.4, 'av_violet': 0.35, 'av_blanc': 0.45, 'av_bleu': 0.4, 'av_rouge': 0.35, 'av_cuivre': 0.3, 'av_ecran': 0.2}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()


def _n(leger):
    return 3 if leger else 5


def _doux(coll):
    """Finition du style doux : métal un peu brillant, ombrage lisse."""
    for nom, rugosite in BRILLANTS.items():
        m = bpy.data.materials.get(nom)
        if m and m.node_tree:
            bsdf = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
            if bsdf:
                bsdf.inputs['Roughness'].default_value = rugosite
    T.adoucir(coll)


def _polyligne(lot, mat, pts, ep):
    for a, b in zip(pts, pts[1:]):
        lot.barre(mat, a, b, ep)


def _eclair(lot, mat, x, y, z, h, ep):
    """Petit éclair sur une face tournée vers -Y, centré en (x, z), de hauteur h."""
    w = h * 0.3
    pts = [(x + w * 0.5, y, z + h / 2), (x - w * 0.6, y, z + h * 0.02), (x + w * 0.6, y, z - h * 0.02),
           (x - w * 0.5, y, z - h / 2)]
    _polyligne(lot, mat, pts, ep)


# --- Borne de recharge -----------------------------------------------------------------------------------------------


def borne_recharge(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_socle_sombre', (0, 0, 0), (0, 0, 0.06), 0.48, 0.44, n, k=0.02, r=0.1)
    O._rond(lot, 'av_socle', (0, 0, 0.04), (0, 0, 0.16), 0.44, 0.4, n, k=0.04, r=0.12)
    # Fût, pied plus sombre, chapeau vert.
    O._rond(lot, 'av_sombre', (0, 0.05, 0.14), (0, 0.05, 0.45), 0.3, 0.19, n, k=0.04, r=0.1)
    O._rond(lot, 'av_blanc', (0, 0.05, 0.42), (0, 0.05, 2.95), 0.31, 0.2, n, k=0.06, r=0.12)
    O._rond(lot, 'av_vert', (0, 0.03, 2.98), (0, 0.03, 3.16), 0.37, 0.26, n, k=0.06, r=0.14)
    # Bandeau vertical vert sur les arêtes avant, cadre d'écran, éclair.
    for x in (-0.27, 0.27):
        O._rond(lot, 'av_vert', (x, -0.135, 0.5), (x, -0.135, 2.9), 0.025, 0.02, 2, k=0.008)
    O._rond(lot, 'av_fonce', (0, -0.152, 1.95), (0, -0.152, 2.72), 0.22, 0.012, n, k=0.006, r=0.04)
    _eclair(lot, 'av_vert', 0, -0.158, 1.55, 0.36, 0.035)
    # Bandeau de charge (anneau lumineux sous le chapeau) et écran.
    vo = T.Lot(coll, 'voyant_charge')
    O._rond(vo, 'av_voyant_vert', (0, 0.05, 2.9), (0, 0.05, 2.97), 0.325, 0.215, n, k=0.01, r=0.12)
    ec = T.Lot(coll, 'voyant_ecran')
    O._rond(ec, 'av_ecran', (0, -0.166, 2.03), (0, -0.166, 2.64), 0.18, 0.005, 2, k=0.003, r=0.025)
    # Support du pistolet sur le flanc +X, pistolet, câble qui pend jusqu'au sol.
    O._rond(lot, 'av_fonce', (0.34, -0.02, 1.25), (0.34, -0.02, 1.62), 0.05, 0.08, n, k=0.02)
    O._rond(lot, 'av_cable', (0.42, -0.06, 1.62), (0.42, -0.06, 1.22), 0.04, 0.045, n, k=0.015)  # poignée
    O._cyl(lot, 'av_cable', (0.42, -0.06, 1.6), (0.42, -0.17, 1.7), 0.05, n)  # tête
    O._cyl(lot, 'av_vert', (0.42, -0.165, 1.695), (0.42, -0.19, 1.72), 0.04, n)
    O._cyl(lot, 'av_fonce', (0.3, 0.12, 0.62), (0.36, 0.12, 0.62), 0.05, n)  # presse-étoupe
    pts = []
    for i in range(9):
        t = i / 8
        x = 0.36 + 0.08 * t
        y = 0.12 - 0.18 * t
        z = 0.62 * (1 - t) + 1.22 * t - 0.5 * math.sin(math.pi * t)
        pts.append((x, y, max(z, 0.2)))
    _polyligne(lot, 'av_cable', pts, 0.045)
    # Dos : trappe de service et grille d'aération.
    O._rond(lot, 'av_gris', (0, 0.255, 0.7), (0, 0.255, 1.9), 0.2, 0.01, n, k=0.005, r=0.03)
    for k in range(5):
        lot.cube('av_fonce', (0.26, 0.012, 0.025), (0, 0.264, 2.15 + k * 0.08))
    for l in (lot, vo, ec):
        l.finir()
    T.poser_au_sol(coll, 0.5)
    _doux(coll)


# --- Compresseur d'air -----------------------------------------------------------------------------------------------


def compresseur_air(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.12), 0.96, 0.82, n, k=0.03, r=0.08)  # châssis
    # Réservoir couché (fonds bombés), selles.
    yt, zt, rt = 0.22, 0.66, 0.45
    sec = lambda x, r: ((x, yt, zt), O.Y, O.Z, r, r, r)  # noqa: E731
    O._loft(lot, 'av_rouge', [sec(-0.9, 0.12), sec(-0.86, 0.3), sec(-0.78, 0.41), sec(-0.68, rt), sec(0.68, rt),
                              sec(0.78, 0.41), sec(0.86, 0.3), sec(0.9, 0.12)], n + 2)
    for x in (-0.5, 0.5):
        O._rond(lot, 'av_sombre', (x, yt, 0.1), (x, yt, 0.34), 0.08, 0.32, n, k=0.03)
        O._cyl(lot, 'av_sombre', (x - 0.03, yt, zt), (x + 0.03, yt, zt), rt + 0.015, n + 2)  # cerclage
    # Plateau sur le réservoir.
    O._rond(lot, 'av_sombre', (-0.78, yt, 1.1), (0.78, yt, 1.1), 0.3, 0.04, n, k=0.015)
    for x in (-0.6, 0.6):
        O._rond(lot, 'av_sombre', (x, yt, 0.98), (x, yt, 1.1), 0.05, 0.2, n, k=0.015)
    # Moteur électrique bleu (couché selon X) à ailettes, boîte à bornes, poulie.
    zm = 1.4
    O._cyl(lot, 'av_bleu', (0.1, yt, zm), (0.68, yt, zm), 0.24, n + 2, k=0.05)
    for k in range(6):
        x = 0.2 + k * 0.08
        O._cyl(lot, 'av_sombre', (x, yt, zm), (x + 0.025, yt, zm), 0.255, n + 2)
    for x in (0.2, 0.58):
        O._rond(lot, 'av_sombre', (x, yt, 1.12), (x, yt, 1.22), 0.05, 0.2, n, k=0.015)
    O._rond(lot, 'av_bleu', (0.4, yt - 0.05, zm + 0.22), (0.4, yt - 0.05, zm + 0.34), 0.1, 0.08, n, k=0.02)
    O._cyl(lot, 'av_gris', (0.02, yt, zm), (0.1, yt, zm), 0.09, n + 1)  # poulie
    # Bloc compresseur à ailettes (vertical) et culasse.
    xc = -0.45
    O._cyl(lot, 'av_sombre', (xc, yt, 1.12), (xc, yt, 1.3), 0.17, n + 2)
    for k in range(6):
        z = 1.3 + k * 0.06
        O._cyl(lot, 'av_gris', (xc, yt, z), (xc, yt, z + 0.03), 0.25, n + 2, k=0.008)
        O._cyl(lot, 'av_sombre', (xc, yt, z + 0.03), (xc, yt, z + 0.06), 0.16, n + 2)
    O._rond(lot, 'av_fonce', (xc, yt, 1.66), (xc, yt, 1.8), 0.2, 0.2, n, k=0.04, r=0.08)
    O._cyl(lot, 'av_gris', (xc, yt, 1.8), (xc, yt, 1.9), 0.09, n + 1)  # filtre d'aspiration
    O._cyl(lot, 'av_fonce', (xc, yt, 1.9), (xc, yt, 1.94), 0.1, n + 1)
    # Volant (groupe animé) et courroie vers la poulie du moteur.
    xv, rv = -0.12, 0.3
    vol = T.Lot(coll, 'volant')
    O._cyl(vol, 'av_gris', (xv - 0.03, yt, zm), (xv + 0.03, yt, zm), rv, n + 3, k=0.01)
    O._cyl(vol, 'av_fonce', (xv - 0.035, yt, zm), (xv + 0.035, yt, zm), 0.06, n + 1)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        vol.barre('av_sombre', (xv - 0.035, yt + 0.08 * math.cos(a), zm + 0.08 * math.sin(a)),
                  (xv - 0.035, yt + 0.24 * math.cos(a), zm + 0.24 * math.sin(a)), 0.035)
    T.pivot(coll, 'pivot_volant', (xv, yt, zm), (1, 0, 0))
    for s in (-1, 1):
        lot.barre('av_cable', (xv + 0.02, yt + s * (rv + 0.01), zm), (0.06, yt + s * 0.1, zm), 0.025)
    # Tuyau de refoulement en cuivre vers le réservoir, soupape, manomètre, vanne de sortie et purge.
    _polyligne(lot, 'av_cuivre', [(xc + 0.12, yt - 0.12, 1.72), (xc + 0.12, yt - 0.32, 1.72), (xc + 0.12, yt - 0.32, 1.25),
                                  (xc + 0.12, yt - 0.34, 0.92)], 0.05)
    O._cyl(lot, 'av_cuivre', (0.0, yt, 1.1), (0.0, yt, 1.2), 0.03, n)
    O._cyl(lot, 'av_cuivre', (0.0, yt, 1.2), (0.0, yt, 1.26), 0.05, n)  # soupape
    O._cyl(lot, 'av_cuivre', (0.5, yt - 0.42, 0.9), (0.5, yt - 0.5, 0.9), 0.025, n)
    O._cyl(lot, 'av_fonce', (0.5, yt - 0.5, 0.9), (0.5, yt - 0.55, 0.9), 0.11, n + 1)
    O._cyl(lot, 'av_cadran', (0.5, yt - 0.545, 0.9), (0.5, yt - 0.56, 0.9), 0.09, n + 1)
    lot.barre('av_rouge', (0.5, yt - 0.565, 0.9), (0.55, yt - 0.565, 0.95), 0.012)
    O._cyl(lot, 'av_cuivre', (-0.9, yt, zt), (-0.98, yt, zt), 0.045, n)
    O._cyl(lot, 'av_rouge', (-0.95, yt, zt), (-0.97, yt, zt), 0.1, n + 1)  # volant de vanne
    for k in range(3):
        a = k * math.pi * 2 / 3
        lot.barre('av_rouge', (-0.96, yt, zt), (-0.96, yt + 0.09 * math.cos(a), zt + 0.09 * math.sin(a)), 0.02)
    O._cyl(lot, 'av_cuivre', (0.0, yt - 0.2, 0.24), (0.0, yt - 0.2, 0.12), 0.03, n)  # purge
    # Coffret électrique avec voyant, à l'avant droit du châssis.
    O._rond(lot, 'av_gris', (0.72, -0.62, 0.12), (0.72, -0.62, 0.62), 0.16, 0.1, n, k=0.03, r=0.04)
    O._cyl(lot, 'av_fonce', (0.72, -0.72, 0.36), (0.72, -0.74, 0.36), 0.05, n)
    vo = T.Lot(coll, 'voyant_compresseur')
    O._cyl(vo, 'av_voyant_vert', (0.72, -0.72, 0.52), (0.72, -0.735, 0.52), 0.035, n)
    for l in (lot, vol, vo):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Purificateur d'air ----------------------------------------------------------------------------------------------


def _ventilateur(coll, n, nom, x, y, z, r):
    """Hélice à 5 pales (groupe `helice_<nom>_`), moyeu, pivot vertical."""
    h = T.Lot(coll, f'helice_{nom}')
    O._cyl(h, 'av_fonce', (x, y, z - 0.04), (x, y, z + 0.06), 0.07, n + 1)
    for k in range(5):
        a = 2 * math.pi * k / 5
        c, s = math.cos(a), math.sin(a)
        m = Matrix.Rotation(a, 3, 'Z') @ Matrix.Rotation(0.45, 3, 'X')
        h.cube('av_gris', (r - 0.08, 0.11, 0.015), (x + c * (r / 2 + 0.03), y + s * (r / 2 + 0.03), z), 0.006, m)
    T.pivot(coll, f'pivot_helice_{nom}', (x, y, z), (0, 0, 1))
    h.finir()


def purificateur_air(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.15), 0.96, 0.96, n, k=0.04, r=0.12)
    O._rond(lot, 'av_blanc', (0, 0, 0.13), (0, 0, 3.15), 0.86, 0.86, n, k=0.1, r=0.24)
    O._rond(lot, 'av_vert', (0, 0, 3.1), (0, 0, 3.22), 0.9, 0.9, n, k=0.04, r=0.26)  # rebord du toit
    # Façade : grande grille d'aspiration à lames, cadre vert, bandeau lumineux.
    O._rond(lot, 'av_vert', (0, -0.855, 0.45), (0, -0.855, 2.55), 0.66, 0.02, n, k=0.01, r=0.08)
    O._rond(lot, 'av_grille', (0, -0.87, 0.55), (0, -0.87, 2.45), 0.58, 0.012, n, k=0.005, r=0.05)
    for k in range(13):
        z = 0.65 + k * 0.145
        O._rond(lot, 'av_sombre', (-0.55, -0.89, z), (0.55, -0.89, z), 0.02, 0.035, 2, k=0.008)
    vo = T.Lot(coll, 'voyant_air')
    O._rond(vo, 'av_voyant_vert', (-0.5, -0.865, 2.8), (0.5, -0.865, 2.8), 0.012, 0.04, 2, k=0.006)
    # Flanc droit (+X) : fenêtre et trois cartouches filtrantes plissées.
    O._rond(lot, 'av_sombre', (0.86, 0, 0.5), (0.86, 0, 2.55), 0.02, 0.6, n, k=0.01, r=0.06)
    for y in (-0.38, 0.0, 0.38):
        O._cyl(lot, 'av_filtre', (0.86, y, 0.62), (0.86, y, 2.42), 0.14, n + 1, k=0.02)
        for k in range(6):
            z = 0.8 + k * 0.28
            O._cyl(lot, 'av_filtre_pli', (0.86, y, z), (0.86, y, z + 0.04), 0.155, n + 1, k=0.01)
        for z in (0.6, 2.4):
            O._cyl(lot, 'av_vert_fonce', (0.86, y, z - 0.03), (0.86, y, z + 0.04), 0.16, n + 1)
    # Flanc gauche (-X) : pupitre (écran, boutons).
    O._rond(lot, 'av_fonce', (-0.875, -0.15, 1.5), (-0.875, -0.15, 2.2), 0.012, 0.32, n, k=0.005, r=0.04)
    ec = T.Lot(coll, 'voyant_ecran')
    O._rond(ec, 'av_ecran', (-0.888, -0.15, 1.82), (-0.888, -0.15, 2.12), 0.004, 0.25, 2, k=0.002, r=0.02)
    for k, mat in enumerate(('av_voyant_vert', 'av_voyant_ambre', 'av_rouge')):
        O._cyl(lot, mat, (-0.885, -0.33 + k * 0.18, 1.62), (-0.9, -0.33 + k * 0.18, 1.62), 0.035, n)
    # Dos : bouche de refoulement ronde.
    O._cyl(lot, 'av_sombre', (0, 0.85, 1.9), (0, 0.98, 1.9), 0.3, n + 2, k=0.03)
    O._cyl(lot, 'av_grille', (0, 0.975, 1.9), (0, 0.985, 1.9), 0.24, n + 2)
    # Toit : deux buses de ventilateur (fond, couronne, grille de protection), hélices animées.
    for nom, x in (('g', -0.42), ('d', 0.42)):
        O._cyl(lot, 'av_grille', (x, 0, 3.2), (x, 0, 3.26), 0.36, n + 2)
        seg = 18
        for k in range(seg):  # couronne
            a = 2 * math.pi * (k + 0.5) / seg
            lot.cube('av_sombre', (0.06, 0.14, 0.18), (x + 0.38 * math.cos(a), 0.38 * math.sin(a), 3.31), 0.01,
                     Matrix.Rotation(a, 3, 'Z'))
        for k in range(4):
            a = k * math.pi / 4
            lot.barre('av_fonce', (x - 0.37 * math.cos(a), -0.37 * math.sin(a), 3.42),
                      (x + 0.37 * math.cos(a), 0.37 * math.sin(a), 3.42), 0.018)
        O._cyl(lot, 'av_fonce', (x, 0, 3.4), (x, 0, 3.44), 0.06, n)
        _ventilateur(coll, n, nom, x, 0, 3.32, 0.34)
    for l in (lot, vo, ec):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Bras industriel -------------------------------------------------------------------------------------------------


def bras_industriel(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    # Socle fixe : platine à bandes de danger, fût orange, colonne lumineuse.
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.14), 0.95, 0.95, n, k=0.04, r=0.12)
    for k in range(8):
        x = -0.79 + k * 0.226
        for y in (-0.88, 0.88):
            lot.cube('av_jaune' if k % 2 == 0 else 'av_cable', (0.226, 0.1, 0.012), (x, y, 0.146))
    O._cyl(lot, 'av_sombre', (0, 0, 0.12), (0, 0, 0.24), 0.56, n + 2, k=0.03)
    O._cyl(lot, 'av_orange', (0, 0, 0.22), (0, 0, 0.62), 0.44, n + 2, k=0.05)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        O._cyl(lot, 'av_gris', (0.5 * math.cos(a), 0.5 * math.sin(a), 0.24), (0.5 * math.cos(a), 0.5 * math.sin(a), 0.27), 0.035, n)
    O._cyl(lot, 'av_sombre', (0.75, 0.75, 0.14), (0.75, 0.75, 0.7), 0.035, n)
    vo = T.Lot(coll, 'voyant_bras')
    O._cyl(vo, 'av_voyant_vert', (0.75, 0.75, 0.7), (0.75, 0.75, 0.82), 0.06, n)
    O._cyl(lot, 'av_voyant_ambre', (0.75, 0.75, 0.82), (0.75, 0.75, 0.94), 0.06, n)
    O._cyl(lot, 'av_sombre', (0.75, 0.75, 0.94), (0.75, 0.75, 0.98), 0.065, n)
    # Tourelle (pivote autour de Z) : plateau, carter d'épaule, moteurs latéraux.
    tr = T.Lot(coll, 'tourelle')
    O._cyl(tr, 'av_sombre', (0, 0, 0.62), (0, 0, 0.78), 0.5, n + 2, k=0.03)
    O._rond(tr, 'av_orange', (0, 0.05, 0.76), (0, 0.05, 1.45), 0.34, 0.4, n, k=0.08, r=0.16)
    for s_ in (-1, 1):
        O._cyl(tr, 'av_gris', (s_ * 0.34, 0, 1.25), (s_ * 0.44, 0, 1.25), 0.2, n + 2, k=0.03)
        O._cyl(tr, 'av_sombre', (s_ * 0.44, 0, 1.25), (s_ * 0.47, 0, 1.25), 0.12, n + 1)
    O._rond(tr, 'av_gris', (0, 0.4, 0.85), (0, 0.4, 1.3), 0.2, 0.08, n, k=0.03)  # moteur de rotation, au dos
    T.pivot(coll, 'pivot_tourelle', (0, 0, 0.62), (0, 0, 1))
    # Épaule (pivote autour de X) : bras supérieur jusqu'au coude.
    ep = T.Lot(coll, 'epaule')
    pe, pc = (0, 0, 1.25), (0, -0.45, 2.6)
    for s_ in (-1, 1):
        O._rond(ep, 'av_orange', (s_ * 0.2, pe[1], pe[2]), (s_ * 0.2, pc[1], pc[2]), 0.07, 0.2, n, k=0.04)
    O._rond(ep, 'av_orange_fonce', (0, pe[1] - 0.06, pe[2] + 0.25), (0, pc[1] + 0.03, pc[2] - 0.25), 0.15, 0.12, n, k=0.04)
    O._cyl(ep, 'av_sombre', (-0.3, 0, 1.25), (0.3, 0, 1.25), 0.15, n + 1)
    T.pivot(coll, 'pivot_epaule', pe, (1, 0, 0))
    # Coude (pivote autour de X) : articulation, avant-bras, moteur de coude.
    co = T.Lot(coll, 'coude')
    O._cyl(co, 'av_gris', (-0.29, pc[1], pc[2]), (0.29, pc[1], pc[2]), 0.19, n + 2, k=0.03)
    O._cyl(co, 'av_sombre', (-0.31, pc[1], pc[2]), (0.31, pc[1], pc[2]), 0.1, n + 1)
    pw = (0, -1.3, 2.35)
    O._loft(co, 'av_orange', [((0, pc[1] + 0.1, pc[2] + 0.02), O.X, O.Z, 0.17, 0.17, 0.12),
                              ((0, pc[1] - 0.3, pc[2]), O.X, O.Z, 0.16, 0.16, 0.12),
                              ((0, pw[1] + 0.15, pw[2] + 0.04), O.X, O.Z, 0.11, 0.11, 0.08)], n + 1)
    O._cyl(co, 'av_gris', (0, pc[1] + 0.12, pc[2] + 0.02), (0, pc[1] + 0.32, pc[2] + 0.02), 0.13, n + 1)  # moteur
    T.pivot(coll, 'pivot_coude', pc, (1, 0, 0))
    # Poignet (tourne autour de son axe) : bride, outil à deux doigts.
    po = T.Lot(coll, 'poignet')
    d = (0, -1, -0.25)
    O._cyl(po, 'av_sombre', (0, pw[1] + 0.16, pw[2] + 0.04), (0, pw[1] - 0.02, pw[2] - 0.005), 0.11, n + 1)
    O._cyl(po, 'av_gris', (0, pw[1] - 0.02, pw[2] - 0.005), (0, pw[1] - 0.1, pw[2] - 0.025), 0.13, n + 1)
    O._rond(po, 'av_fonce', (0, pw[1] - 0.1, pw[2] - 0.025), (0, pw[1] - 0.18, pw[2] - 0.045), 0.15, 0.06, n, k=0.02)
    for s_ in (-1, 1):
        a = (s_ * 0.1, pw[1] - 0.17, pw[2] - 0.045)
        b = (s_ * 0.08, pw[1] - 0.38, pw[2] - 0.1)
        O._rond(po, 'av_gris', a, b, 0.025, 0.05, n, k=0.012)
        O._rond(po, 'av_cable', b, (s_ * 0.05, pw[1] - 0.44, pw[2] - 0.115), 0.025, 0.045, n, k=0.012)
    T.pivot(coll, 'pivot_poignet', pw, d)
    for l in (lot, vo, tr, ep, co, po):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Foreuse à plasma ------------------------------------------------------------------------------------------------


def foreuse_plasma(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    # Socle blanc à bande violette, ouverture au centre.
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.2), 1.92, 1.92, n, k=0.05, r=0.2)
    O._rond(lot, 'av_blanc', (0, 0, 0.18), (0, 0, 0.62), 1.75, 1.75, n, k=0.08, r=0.3)
    O._rond(lot, 'av_violet', (0, 0, 0.3), (0, 0, 0.38), 1.77, 1.77, n, k=0.02, r=0.31)
    O._cyl(lot, 'av_gris', (0, 0, 0.6), (0, 0, 0.66), 0.7, n + 2, k=0.02)
    O._cyl(lot, 'av_grille', (0, 0, 0.6), (0, 0, 0.665), 0.55, n + 2)
    # Quatre pieds effilés à manchons violets, collier, plateau.
    zh = 3.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            a, b = (sx * 1.3, sy * 1.3, 0.6), (sx * 0.6, sy * 0.6, zh)
            O._rond(lot, 'av_blanc', a, b, 0.11, 0.11, n, k=0.03)
            m = (sx * 1.21, sy * 1.21, 0.9)
            O._rond(lot, 'av_violet', (sx * 1.27, sy * 1.27, 0.7), m, 0.14, 0.14, n, k=0.03)
            O._rond(lot, 'av_fonce', (a[0], a[1], 0.6), (a[0], a[1], 0.68), 0.2, 0.2, n, k=0.02)
    O._rond(lot, 'av_sombre', (0, 0, zh - 0.02), (0, 0, zh + 0.14), 0.78, 0.78, n, k=0.04, r=0.12)
    # Générateur de plasma sur le plateau : capsule, bande violette, ailettes, dôme, bornes.
    zm = zh + 0.14
    O._cyl(lot, 'av_blanc', (0, 0, zm), (0, 0, zm + 0.5), 0.5, n + 2, k=0.06)
    O._cyl(lot, 'av_violet', (0, 0, zm + 0.28), (0, 0, zm + 0.36), 0.515, n + 2)
    O._loft(lot, 'av_gris', [((0, 0, zm + 0.48), O.X, O.Y, 0.46, 0.46, 0.46), ((0, 0, zm + 0.62), O.X, O.Y, 0.32, 0.32, 0.32),
                             ((0, 0, zm + 0.7), O.X, O.Y, 0.12, 0.12, 0.12)], n + 2)
    for k in range(8):
        a = 2 * math.pi * k / 8
        lot.cube('av_gris', (0.08, 0.03, 0.24), (0.52 * math.cos(a), 0.52 * math.sin(a), zm + 0.14), 0.008,
                 Matrix.Rotation(a, 3, 'Z'))
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        x, y = 0.22 * math.cos(a), 0.22 * math.sin(a)
        O._cyl(lot, 'av_violet_fonce', (x, y, zm + 0.62), (x, y, zm + 0.8), 0.04, n)
        O._cyl(lot, 'av_cuivre', (x, y, zm + 0.8), (x, y, zm + 0.86), 0.06, n)
    # Lance : tube central, bobines de confinement en cuivre, dard de plasma (groupe `plasma_`, lumineux).
    O._cyl(lot, 'av_gris', (0, 0, 1.05), (0, 0, zh), 0.1, n + 1)
    O._cyl(lot, 'av_fonce', (0, 0, 0.95), (0, 0, 1.1), 0.16, n + 1)  # buse
    for z in (1.35, 1.75, 2.15, 2.55):
        O._cyl(lot, 'av_cuivre', (0, 0, z), (0, 0, z + 0.12), 0.3, n + 2, k=0.03)
        O._cyl(lot, 'av_fonce', (0, 0, z + 0.02), (0, 0, z + 0.1), 0.32, n + 2)
    for sx in (-1, 1):  # glissières du chariot de la lance
        O._rond(lot, 'av_sombre', (sx * 0.36, 0, 1.2), (sx * 0.36, 0, zh), 0.03, 0.05, n, k=0.012)
    pl = T.Lot(coll, 'plasma')
    O._cyl(pl, 'av_plasma', (0, 0, 0.67), (0, 0, 0.95), 0.08, n + 1)
    O._cyl(pl, 'av_plasma_coeur', (0, 0, 0.66), (0, 0, 0.96), 0.04, n)
    O._cyl(pl, 'av_plasma', (0, 0, 0.665), (0, 0, 0.69), 0.4, n + 2)
    # Condensateurs violets sur le socle (gauche, droite, arrière).
    for x, y in ((-1.4, 0), (1.4, 0), (0, 1.4)):
        O._cyl(lot, 'av_violet', (x, y, 0.6), (x, y, 1.35), 0.2, n + 1, k=0.04)
        O._cyl(lot, 'av_blanc', (x, y, 1.35), (x, y, 1.45), 0.21, n + 1, k=0.03)
        O._cyl(lot, 'av_cuivre', (x, y, 1.45), (x, y, 1.52), 0.06, n)
        for z in (0.8, 1.15):
            O._cyl(lot, 'av_violet_fonce', (x, y, z), (x, y, z + 0.04), 0.21, n + 1)
    # Refroidissement : tuyaux bleus du générateur vers un radiateur à l'arrière droit.
    _polyligne(lot, 'av_bleu', [(0.45, 0.3, zm + 0.1), (0.68, 0.68, zh - 0.1), (1.1, 1.1, 1.3), (1.2, 1.2, 0.8)], 0.07)
    O._rond(lot, 'av_gris', (1.35, 0.95, 0.62), (1.35, 0.95, 1.2), 0.2, 0.32, n, k=0.03)
    for k in range(5):
        lot.cube('av_fonce', (0.012, 0.56, 0.035), (1.556, 0.95, 0.72 + k * 0.1))
    # Sortie devant : bouche, goulotte, minerai fondu (gouttes vitrifiées).
    lot.cube('av_grille', (0.7, 0.04, 0.26), (0, -1.755, 0.4), 0.0)
    O._rond(lot, 'av_violet', (0, -1.78, 0.56), (0, -1.78, 0.62), 0.42, 0.03, n, k=0.01)
    pente = Matrix.Rotation(math.radians(-16), 3, 'X')
    lot.cube('av_blanc', (0.66, 0.4, 0.05), (0, -1.94, 0.22), 0.01, pente)
    for x in (-0.33, 0.33):
        lot.cube('av_gris', (0.04, 0.4, 0.08), (x, -1.94, 0.26), 0.005, pente)
    # Armoire de commande à l'avant droit.
    O._rond(lot, 'av_blanc', (0.8, -1.5, 0.62), (0.8, -1.5, 1.3), 0.2, 0.15, n, k=0.03, r=0.05)
    O._rond(lot, 'av_fonce', (0.8, -1.655, 0.95), (0.8, -1.655, 1.2), 0.15, 0.01, 2, k=0.004)
    ec = T.Lot(coll, 'voyant_ecran')
    O._rond(ec, 'av_plasma', (0.8, -1.666, 0.98), (0.8, -1.666, 1.17), 0.12, 0.004, 2, k=0.002)
    for l in (lot, pl, ec):
        l.finir()
    T.poser_au_sol(coll, 2.0)
    _doux(coll)


# --- Électrolyseur ---------------------------------------------------------------------------------------------------


def _citerne(lot, n, mat, x, y, z0, z1, r):
    """Réservoir vertical à fonds bombés."""
    sec = lambda z, rr: ((x, y, z), O.X, O.Y, rr, rr, rr)  # noqa: E731
    O._loft(lot, mat, [sec(z0, r * 0.85), sec(z0 + 0.08, r), sec(z1 - 0.22, r), sec(z1 - 0.08, r * 0.7),
                       sec(z1, r * 0.25)], n + 2)


def electrolyseur(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.15), 1.45, 1.45, n, k=0.04, r=0.14)
    # Empilement de cellules (devant), couché selon X : plaques de bout, cellules alternées, tirants, fenêtre.
    yc, zc, h = -0.45, 0.75, 0.48
    for x in (-0.72, 0.72):
        O._rond(lot, 'av_sombre', (x - 0.06, yc, zc), (x + 0.06, yc, zc), 0.52, h + 0.06, n, k=0.02, r=0.06)
    m = 13
    for k in range(m):
        x = -0.6 + 1.2 * k / (m - 1)
        O._rond(lot, 'av_blanc' if k % 2 == 0 else 'av_bleu_clair', (x - 0.04, yc, zc), (x + 0.04, yc, zc), 0.46, h,
                n, k=0.012, r=0.05)
    for y in (yc - 0.42, yc + 0.42):
        for z in (zc - h, zc + h):
            O._cyl(lot, 'av_gris', (-0.82, y, z), (0.82, y, z), 0.03, n)
            for x in (-0.84, 0.84):
                O._cyl(lot, 'av_fonce', (x, y, z), (x + (0.03 if x > 0 else -0.03), y, z), 0.05, n)
    for x in (-0.72, 0.72):
        lot.cube('av_sombre', (0.2, 0.3, 0.15), (x, yc, 0.22), 0.02)  # pieds
    vo = T.Lot(coll, 'voyant_electrolyse')
    O._rond(vo, 'av_ecran', (-0.72, yc - 0.525, zc), (-0.72, yc - 0.535, zc), 0.08, 0.2, 2, k=0.004)
    # Barres de cuivre sur le dessus vers un coffret, câble d'alimentation (borne).
    for x in (-0.72, 0.72):
        _polyligne(lot, 'av_cuivre', [(x, yc, zc + h + 0.06), (x, yc, zc + h + 0.22), (x * 0.25, yc, zc + h + 0.22)], 0.06)
    O._rond(lot, 'av_gris', (0, yc, zc + h + 0.1), (0, yc, zc + h + 0.42), 0.22, 0.16, n, k=0.03)
    _panneau = lambda x, y, z: O._rond(lot, 'av_jaune', (x, y, z - 0.07), (x, y, z + 0.07), 0.07, 0.008, 2, k=0.003)  # noqa: E731
    _panneau(0, yc - 0.165, zc + h + 0.26)
    # Deux réservoirs derrière : hydrogène (blanc, grand), oxygène (bleu, plus petit), bandes et manomètres.
    yt = 0.72
    for x, r, ztop, mat, bande in ((-0.68, 0.48, 3.0, 'av_blanc', 'av_rouge'), (0.68, 0.4, 2.5, 'av_bleu', 'av_blanc')):
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.3
            O._rond(lot, 'av_sombre', (x + 0.38 * math.cos(a) * r / 0.48, yt + 0.38 * math.sin(a) * r / 0.48, 0.15),
                    (x + 0.38 * math.cos(a) * r / 0.48, yt + 0.38 * math.sin(a) * r / 0.48, 0.45), 0.05, 0.05, n, k=0.015)
        _citerne(lot, n, mat, x, yt, 0.4, ztop, r)
        O._cyl(lot, bande, (x, yt, 1.2), (x, yt, 1.38), r + 0.012, n + 2)
        O._cyl(lot, 'av_gris', (x, yt - r + 0.02, 1.8), (x, yt - r - 0.06, 1.8), 0.025, n)
        O._cyl(lot, 'av_fonce', (x, yt - r - 0.06, 1.8), (x, yt - r - 0.1, 1.8), 0.09, n + 1)
        O._cyl(lot, 'av_cadran', (x, yt - r - 0.095, 1.8), (x, yt - r - 0.11, 1.8), 0.075, n + 1)
        O._cyl(lot, 'av_gris', (x, yt, ztop - 0.02), (x, yt, ztop + 0.12), 0.05, n)
        O._cyl(lot, 'av_fonce', (x, yt, ztop + 0.12), (x, yt, ztop + 0.18), 0.08, n)
    # Tuyaux de gaz des cellules vers les réservoirs, arrivée d'eau à gauche avec vanne.
    _polyligne(lot, 'av_gris', [(-0.4, yc + 0.2, zc + h), (-0.4, yc + 0.2, 1.6), (-0.4, yt - 0.3, 1.6), (-0.6, yt - 0.42, 1.6)], 0.06)
    _polyligne(lot, 'av_gris', [(0.4, yc + 0.2, zc + h), (0.4, yc + 0.2, 1.45), (0.4, yt - 0.25, 1.45), (0.55, yt - 0.36, 1.45)], 0.06)
    _polyligne(lot, 'av_bleu', [(-1.4, -0.9, 0.3), (-1.1, -0.9, 0.3), (-1.1, yc, 0.3), (-0.8, yc, 0.4)], 0.07)
    O._cyl(lot, 'av_bleu', (-1.25, -0.9, 0.3), (-1.25, -0.9, 0.48), 0.03, n)
    O._cyl(lot, 'av_rouge', (-1.25, -0.9, 0.48), (-1.25, -0.9, 0.51), 0.09, n + 1)
    for l in (lot, vo):
        l.finir()
    T.poser_au_sol(coll, 1.5)
    _doux(coll)


# --- Fabricateur universel -------------------------------------------------------------------------------------------


def fabricateur_universel(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.15), 1.45, 1.45, n, k=0.04, r=0.3)
    # Podium rond à bande violette, chambre de fabrication vitrée, couronne supérieure.
    O._cyl(lot, 'av_blanc', (0, 0, 0.13), (0, 0, 0.6), 1.12, n + 3, k=0.06)
    O._cyl(lot, 'av_violet', (0, 0, 0.32), (0, 0, 0.4), 1.13, n + 3)
    O._cyl(lot, 'av_sombre', (0, 0, 0.58), (0, 0, 0.64), 0.92, n + 3)
    zc0, zc1 = 0.62, 2.55
    for k in range(6):
        a = 2 * math.pi * k / 6 + math.pi / 6
        O._rond(lot, 'av_sombre', (0.93 * math.cos(a), 0.93 * math.sin(a), zc0), (0.93 * math.cos(a), 0.93 * math.sin(a), zc1),
                0.06, 0.06, n, k=0.02)
    vi = T.Lot(coll, 'vitre_chambre')
    O._cyl(vi, 'av_vitre', (0, 0, zc0), (0, 0, zc1), 0.9, n + 3, k=0.0)
    O._cyl(lot, 'av_blanc', (0, 0, zc1), (0, 0, 2.95), 1.12, n + 3, k=0.06)
    O._loft(lot, 'av_gris', [((0, 0, 2.93), O.X, O.Y, 1.0, 1.0, 1.0), ((0, 0, 3.15), O.X, O.Y, 0.6, 0.6, 0.6),
                             ((0, 0, 3.22), O.X, O.Y, 0.25, 0.25, 0.25)], n + 3)
    vo = T.Lot(coll, 'voyant_fab')
    O._cyl(vo, 'av_plasma', (0, 0, 2.7), (0, 0, 2.78), 1.13, n + 3)
    # Plateau tournant (groupe `plateau_`), objet en cours d'impression (lumineux), tête d'impression sous la couronne.
    pt = T.Lot(coll, 'plateau')
    O._cyl(pt, 'av_gris', (0, 0, 0.64), (0, 0, 0.72), 0.5, n + 2, k=0.02)
    for k in range(6):
        a = 2 * math.pi * k / 6
        pt.cube('av_fonce', (0.3, 0.02, 0.01), (0.25 * math.cos(a), 0.25 * math.sin(a), 0.725), 0, Matrix.Rotation(a, 3, 'Z'))
    T.pivot(coll, 'pivot_plateau', (0, 0, 0.64), (0, 0, 1))
    im = T.Lot(coll, 'voyant_impression')
    O._cyl(im, 'av_plasma_coeur', (0, 0, 0.72), (0, 0, 0.95), 0.2, n + 1, k=0.03)
    for k in range(8):
        a = 2 * math.pi * k / 8
        im.cube('av_plasma_coeur', (0.08, 0.06, 0.2), (0.22 * math.cos(a), 0.22 * math.sin(a), 0.83), 0.01, Matrix.Rotation(a, 3, 'Z'))
    O._cyl(lot, 'av_fonce', (0, 0, 2.3), (0, 0, 2.55), 0.3, n + 2, k=0.04)
    O._loft(lot, 'av_gris', [((0, 0, 2.3), O.X, O.Y, 0.14, 0.14, 0.14), ((0, 0, 2.1), O.X, O.Y, 0.05, 0.05, 0.05)], n + 1)
    O._cyl(lot, 'av_plasma', (0, 0, 2.02), (0, 0, 2.1), 0.03, n)
    for k in range(3):
        a = 2 * math.pi * k / 3
        lot.barre('av_gris', (0.28 * math.cos(a), 0.28 * math.sin(a), 2.42), (0.88 * math.cos(a), 0.88 * math.sin(a), 2.5), 0.05)
    # Trémies d'entrée sur les côtés, trappe de sortie devant, câble.
    for sx in (-1, 1):
        x = sx * 1.22
        O._rond(lot, 'av_sombre', (x, 0, 0.15), (x, 0, 0.9), 0.18, 0.4, n, k=0.03)
        O._loft(lot, 'av_violet', [((x, 0, 0.88), O.X, O.Y, 0.18, 0.36, 0.06), ((x, 0, 1.15), O.X, O.Y, 0.24, 0.46, 0.08)], n)
        lot.cube('av_grille', (0.36, 0.78, 0.02), (x, 0, 1.15))
    O._rond(lot, 'av_sombre', (0, -1.12, 0.15), (0, -1.12, 0.55), 0.4, 0.1, n, k=0.03)
    O._rond(lot, 'av_grille', (0, -1.22, 0.2), (0, -1.22, 0.5), 0.32, 0.01, 2, k=0.004)
    O._rond(lot, 'av_violet', (0, -1.23, 0.53), (0, -1.23, 0.57), 0.34, 0.01, 2, k=0.004)
    for l in (lot, vi, vo, pt, im):
        l.finir()
    T.poser_au_sol(coll, 1.5)
    _doux(coll)


# --- Pile à combustible ----------------------------------------------------------------------------------------------


def pile_combustible(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.13), 0.96, 0.9, n, k=0.04, r=0.1)
    # Armoire principale, quatre modules de cellules en façade (chacun son voyant).
    O._rond(lot, 'av_blanc', (-0.15, 0.05, 0.12), (-0.15, 0.05, 2.5), 0.72, 0.72, n, k=0.08, r=0.18)
    O._rond(lot, 'av_bleu', (-0.15, 0.05, 2.45), (-0.15, 0.05, 2.6), 0.78, 0.78, n, k=0.04, r=0.2)
    vo = T.Lot(coll, 'voyant_modules')
    for k in range(4):
        z = 0.4 + k * 0.5
        O._rond(lot, 'av_sombre', (-0.15, -0.67, z), (-0.15, -0.67, z + 0.42), 0.6, 0.02, n, k=0.01, r=0.04)
        for j in range(9):
            x = -0.62 + j * 0.1
            lot.cube('av_bleu_clair' if j % 2 == 0 else 'av_blanc', (0.06, 0.02, 0.32), (x, -0.69, z + 0.21))
        O._rond(lot, 'av_gris', (0.33, -0.7, z + 0.08), (0.33, -0.7, z + 0.34), 0.05, 0.015, 2, k=0.005)  # poignée
        O._cyl(vo, 'av_voyant_vert', (0.25, -0.69, z + 0.36), (0.25, -0.705, z + 0.36), 0.025, n)
    # Toit : grille et ventilateur (groupe `helice_`), bornes en cuivre (câble).
    O._cyl(lot, 'av_grille', (-0.15, 0.05, 2.6), (-0.15, 0.05, 2.64), 0.42, n + 2)
    seg = 16
    for k in range(seg):
        a = 2 * math.pi * (k + 0.5) / seg
        lot.cube('av_sombre', (0.05, 0.18, 0.12), (-0.15 + 0.44 * math.cos(a), 0.05 + 0.44 * math.sin(a), 2.66), 0.008,
                 Matrix.Rotation(a, 3, 'Z'))
    _ventilateur(coll, n, 'pile', -0.15, 0.05, 2.66, 0.38)
    for x in (0.35, 0.5):
        O._cyl(lot, 'av_sombre', (x, -0.5, 2.6), (x, -0.5, 2.66), 0.06, n)
        O._cyl(lot, 'av_cuivre', (x, -0.5, 2.66), (x, -0.5, 2.82), 0.035, n)
    T.reperer(coll, 'accroche_cable', (0.35, -0.5, 2.84))
    # Râtelier de bouteilles d'hydrogène sur le flanc droit, détendeur, tuyau vers l'armoire.
    for y in (-0.42, 0.05, 0.52):
        O._cyl(lot, 'av_blanc', (0.78, y, 0.15), (0.78, y, 1.55), 0.17, n + 1, k=0.05)
        O._loft(lot, 'av_blanc', [((0.78, y, 1.55), O.X, O.Y, 0.17, 0.17, 0.17), ((0.78, y, 1.7), O.X, O.Y, 0.07, 0.07, 0.07)], n + 1)
        O._cyl(lot, 'av_rouge', (0.78, y, 1.25), (0.78, y, 1.38), 0.175, n + 1)
        O._cyl(lot, 'av_gris', (0.78, y, 1.7), (0.78, y, 1.8), 0.035, n)
    for z in (0.5, 1.2):
        lot.barre('av_sombre', (0.96, -0.6, z), (0.96, 0.7, z), 0.04)
    _polyligne(lot, 'av_gris', [(0.78, -0.42, 1.8), (0.78, -0.42, 1.92), (0.78, 0.52, 1.92), (0.78, 0.52, 1.8)], 0.035)
    _polyligne(lot, 'av_gris', [(0.78, 0.05, 1.92), (0.6, 0.05, 1.92), (0.6, 0.05, 1.7)], 0.04)
    # Rejet d'eau : petit tuyau bleu sur le flanc gauche et bac.
    _polyligne(lot, 'av_bleu', [(-0.87, -0.2, 0.9), (-0.97, -0.2, 0.9), (-0.97, -0.2, 0.3)], 0.045)
    O._rond(lot, 'av_sombre', (-0.92, -0.2, 0.13), (-0.92, -0.2, 0.25), 0.07, 0.14, n, k=0.02)
    lot.cube('av_bleu_clair', (0.1, 0.24, 0.01), (-0.92, -0.2, 0.25))
    for l in (lot, vo):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Coffre quantique ------------------------------------------------------------------------------------------------


def coffre_quantique(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.12), 0.92, 0.8, n, k=0.04, r=0.12)
    O._rond(lot, 'av_nuit', (0, 0, 0.1), (0, 0, 1.1), 0.82, 0.68, n, k=0.06, r=0.16)
    O._rond(lot, 'av_nuit_clair', (0, 0, 0.6), (0, 0, 0.66), 0.83, 0.69, n, k=0.01, r=0.16)
    # Coins : quatre piliers à nœud lumineux.
    vo = T.Lot(coll, 'voyant_quantique')
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 0.78, sy * 0.64
            O._rond(lot, 'av_gris', (x, y, 0.1), (x, y, 1.1), 0.09, 0.09, n, k=0.03)
            O._cyl(vo, 'av_quantique', (x - sx * 0.01, y - sy * 0.01, 0.55), (x - sx * 0.01, y - sy * 0.01, 0.7), 0.1, n)
    # Façade : serrure ronde lumineuse, bandes lumineuses.
    O._cyl(lot, 'av_gris', (0, -0.68, 0.85), (0, -0.74, 0.85), 0.16, n + 2, k=0.02)
    O._cyl(vo, 'av_quantique', (0, -0.73, 0.85), (0, -0.75, 0.85), 0.1, n + 2)
    O._cyl(lot, 'av_nuit', (0, -0.745, 0.85), (0, -0.755, 0.85), 0.05, n + 1)
    for x in (-0.45, 0.45):
        O._rond(vo, 'av_quantique', (x, -0.685, 0.25), (x, -0.685, 0.5), 0.12, 0.008, 2, k=0.003)
    # Couvercle (groupe `couvercle_`, s'ouvre vers l'arrière) : dalle bombée, anneau et cristal flottant au centre.
    cv = T.Lot(coll, 'couvercle')
    O._rond(cv, 'av_nuit_clair', (0, 0, 1.1), (0, 0, 1.24), 0.86, 0.72, n, k=0.05, r=0.18)
    O._rond(cv, 'av_nuit', (0, 0, 1.22), (0, 0, 1.32), 0.66, 0.52, n, k=0.05, r=0.16)
    O._cyl(cv, 'av_gris', (0, 0, 1.3), (0, 0, 1.36), 0.3, n + 2, k=0.02)
    O._cyl(cv, 'av_violet', (0, 0, 1.33), (0, 0, 1.38), 0.22, n + 2)
    cr = T.Lot(coll, 'cristal')
    O._loft(cr, 'av_quantique', [((0, 0, 1.45), O.X, O.Y, 0.01, 0.01, 0.0), ((0, 0, 1.6), O.X, O.Y, 0.1, 0.1, 0.0),
                                 ((0, 0, 1.78), O.X, O.Y, 0.01, 0.01, 0.0)], 1)
    T.pivot(coll, 'pivot_cristal', (0, 0, 1.6), (0, 0, 1))
    T.pivot(coll, 'pivot_couvercle', (0, 0.72, 1.1), (-1, 0, 0))
    for l in (lot, vo, cv, cr):
        l.finir()
    T.poser_au_sol(coll, 1.0)
    _doux(coll)


# --- Tourelle à rail -------------------------------------------------------------------------------------------------


def tourelle_rail(coll, leger=True):
    n = _n(leger)
    lot = T.Lot(coll, 'pieces')
    # Dalle 3 x 2 à bandes de danger, batteries de condensateurs sur les côtés, couronne.
    O._rond(lot, 'av_fonce', (0, 0, 0), (0, 0, 0.22), 1.46, 0.96, n, k=0.05, r=0.12)
    for k in range(9):
        x = -1.2 + k * 0.3
        lot.cube('av_jaune' if k % 2 == 0 else 'av_cable', (0.3, 0.08, 0.012), (x, -0.9, 0.226))
    for sx in (-1, 1):
        for y in (-0.35, 0.3):
            O._cyl(lot, 'av_sombre', (sx * 1.15, y, 0.22), (sx * 1.15, y, 0.85), 0.2, n + 1, k=0.04)
            for z in (0.4, 0.6):
                O._cyl(lot, 'av_bleu', (sx * 1.15, y, z), (sx * 1.15, y, z + 0.06), 0.21, n + 1)
            O._cyl(lot, 'av_cuivre', (sx * 1.15, y, 0.85), (sx * 1.15, y, 0.92), 0.07, n)
    O._cyl(lot, 'av_sombre', (0, 0.1, 0.22), (0, 0.1, 0.9), 0.42, n + 2, k=0.04)
    O._cyl(lot, 'av_jaune', (0, 0.1, 0.36), (0, 0.1, 0.42), 0.43, n + 2)
    O._cyl(lot, 'av_gris', (0, 0.1, 0.86), (0, 0.1, 0.95), 0.55, n + 2, k=0.02)
    # Tourelle (groupe `tourelle_`) : caisson, deux longs rails parallèles, bobines d'accélération, rail lumineux.
    zt = 0.95
    tr = T.Lot(coll, 'tourelle')
    O._cyl(tr, 'av_sombre', (0, 0.1, zt), (0, 0.1, zt + 0.1), 0.62, n + 2, k=0.02)
    O._rond(tr, 'av_blanc', (0, 0.3, zt + 0.1), (0, 0.3, zt + 0.7), 0.5, 0.5, n, k=0.08, r=0.16)
    O._rond(tr, 'av_bleu', (0, 0.3, zt + 0.66), (0, 0.3, zt + 0.74), 0.42, 0.42, n, k=0.02, r=0.12)
    zr = zt + 0.42
    O._rond(tr, 'av_sombre', (0, 0.0, zr - 0.18), (0, -0.5, zr - 0.18), 0.1, 0.06, n, k=0.02)  # berceau
    for sx in (-1, 1):  # les deux rails
        tr.cube('av_sombre', (0.07, 1.85, 0.26), (sx * 0.15, -0.88, zr), 0.02)
        tr.cube('av_cuivre', (0.02, 1.8, 0.14), (sx * 0.11, -0.88, zr), 0.004)
    for k in range(4):  # bobines d'accélération
        y = -0.25 - k * 0.4
        O._cyl(tr, 'av_gris', (0, y, zr), (0, y - 0.1, zr), 0.25, n + 2, k=0.02)
        O._cyl(tr, 'av_bleu', (0, y - 0.035, zr), (0, y - 0.065, zr), 0.265, n + 2)
    O._cyl(tr, 'av_fonce', (0, -1.78, zr), (0, -1.84, zr), 0.19, n + 2, k=0.02)  # bouche
    ra = T.Lot(coll, 'voyant_rail')
    ra.cube('av_quantique', (0.06, 1.75, 0.06), (0, -0.92, zr), 0.0)
    # Viseur et radiateurs à l'arrière du caisson.
    O._rond(tr, 'av_gris', (0.3, 0.0, zt + 0.74), (0.3, 0.0, zt + 0.86), 0.08, 0.12, n, k=0.02)
    O._cyl(tr, 'av_ecran', (0.3, -0.12, zt + 0.8), (0.3, -0.135, zt + 0.8), 0.04, n)
    for k in range(5):
        tr.cube('av_gris', (0.8, 0.03, 0.4), (0, 0.82 + k * 0.05, zt + 0.4), 0.006)
    T.pivot(coll, 'pivot_tourelle', (0, 0.1, zt), (0, 0, 1))
    for l in (lot, tr, ra):
        l.finir()
    T.poser_au_sol(coll, 1.5, 1.0)
    _doux(coll)


MODELES = {
    'borne_recharge': borne_recharge,
    'compresseur_air': compresseur_air,
    'purificateur_air': purificateur_air,
    'bras_industriel': bras_industriel,
    'foreuse_plasma': foreuse_plasma,
    'electrolyseur': electrolyseur,
    'fabricateur_universel': fabricateur_universel,
    'pile_combustible': pile_combustible,
    'coffre_quantique': coffre_quantique,
    'tourelle_rail': tourelle_rail,
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
    T.save(os.path.join(ROOT, 'blender', 'avancees.blend'))


if __name__ == '__main__':
    main()
