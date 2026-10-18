"""Famille « ferroviaire » : voies (rails) et trains, pour un futur réseau ferré (voie étroite industrielle).

Style low poly stylisé (voir blender/README.md). 1 unité = 1 case = 50 cm. L'avant est du côté -Y.

Voies — une tuile de 2 x 2 cases (1 m), comme les convoyeurs mais sans sens (un train y roule dans les deux sens) :
- `rail_droit` : tout droit le long de Y ;
- `rail_virage` : 6 x 6 cases (3 m, pour que les wagons de 3 m passent) ; quart de cercle qui relie le milieu du
  bord -Y au milieu du bord +X (centre du cercle au coin (+3, -3), rayon 3 unités = 1,5 m au milieu de la voie). Sans
  sens, le virage à gauche et le virage à droite sont la même pièce tournée ;
- `rail_rampe` : 2 x 8 cases (4 m), monte de 2 unités (1 m, un niveau) de -Y vers +Y. Sans sens aussi : la descente
  est la même pièce tournée d'un demi-tour. Piliers dessous ;
- pas de tunnel.
Écartement : 1,2 unité (60 cm) entre les rails, dessus des rails à `Z_RAIL` (0,24 unité = 12 cm).

Trains — à l'échelle du personnage (1,7 m) ; roues posées à Z = 0 (le jeu les pose sur le dessus des rails), attelages
à 0,9 unité (45 cm), tampons et traverses de tête ; roues en groupes (`roues_av`, `roues_ar`, `roues_motrices`,
tournent autour de X) ; nœud vide `siege` (coussin du conducteur) dans les locomotives :
- `locomotive_vapeur` : locomotive à combustible (vapeur), 6 m : chaudière noire et laiton, cheminée, trois roues
  motrices rouges par côté avec bielle, abri du mécanicien, soute à charbon ;
- `locomotive_electrique` : locomotive électrique moderne, 8 m : caisse lisse gris clair à bandeau bleu, deux cabines
  à nez incliné, pantographes à un bras ;
- `wagon_fret` : wagon couvert à porte coulissante, 5 m, sur bogies ;
- `wagon_citerne` : citerne pour liquides et gaz, 5 m, sur bogies ; sa bande et son dôme sont de la teinte `teinte`
  (magenta dans le fichier) : le jeu les peindra de la couleur du fluide transporté.

Lancer :  blender --background --python blender/scripts/ferroviaire.py
Produit :  blender/ferroviaire.blend, export/<nom>.glb et export/unity/<nom>.glb
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

TEINTES = {
    'ballast': '#7d776e',
    'ballast_sombre': '#5f5a53',
    'traverse': '#6b5038',
    'rail': '#8e969e',
    'loco': '#c9572e',
    'loco_sombre': '#8e3a1e',
    'wagon': '#5a6b4a',
    'wagon_sombre': '#3f4b34',
    'citerne': '#d8dde3',
    'teinte': '#ff00ff',
}


def _palette():
    for k, v in TEINTES.items():
        T.PALETTE.setdefault(k, v)


_palette()

ECART = 0.6  # demi-écartement (unités)
Z_BALLAST = 0.1
Z_TRAVERSE = 0.16
Z_RAIL = 0.24


def _voie_droite(lot, a, b, z0=0.0, traverses=True, ballast=True):
    """Voie droite de `a` à `b` (points (x, y) au milieu de la voie), posée à la hauteur z0 (inclinée si besoin)."""
    a, b = Vector((a[0], a[1], z0 if len(a) == 2 else a[2])), Vector((b[0], b[1], z0 if len(b) == 2 else b[2]))
    d = b - a
    lg = d.length
    u = d.normalized()
    w = Vector((-u.y, u.x, 0)).normalized()
    pente = math.atan2(d.z, Vector((d.x, d.y)).length)
    rot = Matrix.Rotation(math.atan2(u.y, u.x) - math.pi / 2, 3, 'Z') @ Matrix.Rotation(pente, 3, 'X')
    m = (a + b) / 2
    if ballast:
        lot.cube('ballast', (1.9, lg, Z_BALLAST), tuple(m + Vector((0, 0, Z_BALLAST / 2))), 0.02, rot)
        lot.cube('ballast_sombre', (2.0, lg, Z_BALLAST * 0.5), tuple(m + Vector((0, 0, Z_BALLAST * 0.25))), 0, rot)
    if traverses:
        n = max(1, round(lg / 0.5))
        for k in range(n):
            p = a + d * ((k + 0.5) / n)
            lot.cube('traverse', (1.7, 0.2, Z_TRAVERSE - Z_BALLAST + 0.02),
                     tuple(p + Vector((0, 0, (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01))), 0.01, rot)
    for s in (-1, 1):
        q = m + w * (s * ECART)
        lot.cube('rail', (0.07, lg, Z_RAIL - Z_TRAVERSE), tuple(q + Vector((0, 0, (Z_RAIL + Z_TRAVERSE) / 2))), 0, rot)
        lot.cube('rail', (0.13, lg, 0.025), tuple(q + Vector((0, 0, Z_TRAVERSE + 0.0125))), 0, rot)  # patin


def rail_droit(coll, leger=True):
    lot = T.Lot(coll, 'rail')
    _voie_droite(lot, (0, -1), (0, 1))
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def rail_virage(coll, leger=True):
    """Tuile 6 x 6 : quart de cercle du milieu du bord -Y (0, -3) au milieu du bord +X (3, 0), centre (3, -3)."""
    lot = T.Lot(coll, 'rail')
    c = Vector((3.0, -3.0, 0))
    n = 12 if leger else 20
    r0 = 3.0

    def p(r, t):
        return c + Vector((-r * math.cos(t), r * math.sin(t), 0))

    # Ballast en secteurs, traverses rayonnantes, rails en segments.
    for k in range(n):
        t0, t1 = (math.pi / 2) * k / n, (math.pi / 2) * (k + 1) / n
        tm = (t0 + t1) / 2
        # Secteur de ballast : sa longueur est celle de l'arc extérieur (pas de trou entre deux secteurs).
        lg = (r0 + 0.95) * (t1 - t0) + 0.02
        lot.cube('ballast', (1.9, lg, Z_BALLAST), tuple(p(r0, tm) + Vector((0, 0, Z_BALLAST / 2))), 0,
                 Matrix.Rotation(-tm, 3, 'Z'))
        for s in (-1, 1):
            r = r0 + s * ECART
            a, b = p(r, t0), p(r, t1)
            d = b - a
            rr = Matrix.Rotation(math.atan2(d.y, d.x) - math.pi / 2, 3, 'Z')
            m = (a + b) / 2
            lot.cube('rail', (0.07, d.length + 0.02, Z_RAIL - Z_TRAVERSE),
                     tuple(m + Vector((0, 0, (Z_RAIL + Z_TRAVERSE) / 2))), 0, rr)
            lot.cube('rail', (0.13, d.length + 0.02, 0.025), tuple(m + Vector((0, 0, Z_TRAVERSE + 0.0125))), 0, rr)
    nt = 9  # traverses tous les ~50 cm sur l'arc
    for k in range(nt):
        t = (math.pi / 2) * (k + 0.5) / nt
        lot.cube('traverse', (1.7, 0.2, Z_TRAVERSE - Z_BALLAST + 0.02),
                 tuple(p(r0, t) + Vector((0, 0, (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01))), 0.01,
                 Matrix.Rotation(-t, 3, 'Z'))
    lot.finir()
    T.poser_au_sol(coll, 3.0)


def rail_rampe(coll, leger=True):
    """2 x 8 cases : monte de 2 unités de -Y vers +Y, sur piliers."""
    lot = T.Lot(coll, 'rail')
    h = 2.0
    L = 8.0
    pente = math.atan2(h, L)
    # Tablier incliné (sous la voie), voie inclinée posée dessus.
    ep = 0.2
    rot = Matrix.Rotation(pente, 3, 'X')
    lot.cube('beton', (2.0, L / math.cos(pente), ep), (0, 0, h / 2 - ep / 2 / math.cos(pente)), 0.02, rot)
    _voie_droite(lot, (0, -L / 2, 0.0), (0, L / 2, h), ballast=False)
    for y in (-1.0, 1.4, 3.6):
        z = h * (y + L / 2) / L - ep
        for s in (-1, 1):
            lot.cube('beton', (0.25, 0.25, z), (s * 0.75, y, z / 2), 0.02)
        lot.cube('beton', (1.8, 0.3, 0.15), (0, y, z - 0.07), 0.02)
    lot.finir()
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin
    T.poser_au_sol(coll, 1.0, 4.0)


# --- Trains -----------------------------------------------------------------------------------------------------------

R_ROUE = 0.5
Z_ATTELAGE = 0.9
LARGE = 3.6  # largeur des caisses (1,8 m)


def _fini(coll):
    zmin = min((o.matrix_basis @ v.co).z for o in coll.objects if o.type == 'MESH' for v in o.data.vertices)
    for o in coll.objects:
        o.location.z -= zmin


def _roue(lot, x, y, r, sg, mat='acier_sombre', moyeu='acier', s=1):
    """Roue à boudin sur le rail (x = ±ECART), moyeu côté extérieur."""
    lot.tube(mat, (x - 0.07, y, r), (x + 0.07, y, r), r, sg)
    lot.tube(mat, (x - s * 0.07, y, r), (x - s * 0.09, y, r), r * 1.08, sg)  # boudin (côté intérieur)
    lot.tube(moyeu, (x + s * 0.07, y, r), (x + s * 0.1, y, r), r * 0.35, sg)


def _bogie(coll, lot_fixe, y, nom, sg, r=R_ROUE, empattement=1.1, flasque='acier_sombre'):
    """Bogie à deux essieux (roues en groupe `nom`) ; châssis du bogie (longerons, ressorts) dans `lot_fixe`."""
    g = T.Lot(coll, nom)
    for dy in (-empattement / 2, empattement / 2):
        for s in (-1, 1):
            _roue(g, s * ECART, y + dy, r, sg, s=s)
        g.tube('acier_sombre', (-ECART, y + dy, r), (ECART, y + dy, r), 0.06, sg)
    g.finir()
    T.pivot(coll, 'pivot_' + nom, (0, y, r), (1, 0, 0))
    for s in (-1, 1):
        x = s * (ECART + 0.22)
        lot_fixe.cube(flasque, (0.1, empattement + 2 * r + 0.1, 0.32), (x, y, r + 0.05), 0.02)  # longeron
        for dy in (-empattement / 2, empattement / 2):
            lot_fixe.cube('fonte', (0.14, 0.3, 0.24), (x, y + dy, r), 0.02)  # boîte d'essieu
        lot_fixe.cube('jaune', (0.12, 0.3, 0.16), (x, y, r + 0.3), 0.01)  # ressort
    lot_fixe.cube(flasque, (2 * (ECART + 0.22), 0.4, 0.14), (0, y, r + 0.32), 0.01)  # traverse


def _chassis(lot, longueur, sg, z=1.15, couleur='acier_sombre', tampon='rouge'):
    """Châssis : longerons, traverses de tête (teinte `tampon`), tampons et attelages aux deux bouts."""
    lot.cube(couleur, (LARGE - 0.4, longueur, 0.3), (0, 0, z), 0.02)
    for s in (-1, 1):
        lot.cube(tampon, (LARGE - 0.3, 0.16, 0.5), (0, s * (longueur / 2 + 0.02), Z_ATTELAGE + 0.05), 0.02)
        for b in (-1, 1):
            lot.tube('acier', (b * 1.05, s * longueur / 2, Z_ATTELAGE + 0.1),
                     (b * 1.05, s * (longueur / 2 + 0.25), Z_ATTELAGE + 0.1), 0.08, sg)
            lot.tube('acier_sombre', (b * 1.05, s * (longueur / 2 + 0.25), Z_ATTELAGE + 0.1),
                     (b * 1.05, s * (longueur / 2 + 0.3), Z_ATTELAGE + 0.1), 0.17, sg)
        lot.cube('noir', (0.22, 0.4, 0.16), (0, s * (longueur / 2 + 0.18), Z_ATTELAGE), 0.02)  # attelage
        lot.barre('noir', (0, s * (longueur / 2 + 0.38), Z_ATTELAGE), (0, s * (longueur / 2 + 0.38), Z_ATTELAGE - 0.15),
                  0.06)


def _toit(lot, mat, y0, y1, z0, larg, fleche=0.4, n=5):
    """Toit bombé le long de Y : `n` lattes inclinées qui suivent un arc (flèche `fleche` au milieu)."""
    r = (larg ** 2 / 4 + fleche ** 2) / (2 * fleche)
    a_max = math.asin(larg / 2 / r)
    for k in range(n):
        a0 = -a_max + 2 * a_max * k / n
        a1 = -a_max + 2 * a_max * (k + 1) / n
        am = (a0 + a1) / 2
        x = r * math.sin(am)
        z = z0 + r * math.cos(am) - (r - fleche)
        w = 2 * r * math.sin((a1 - a0) / 2) + 0.02
        lot.cube(mat, (w, y1 - y0, 0.08), (x, (y0 + y1) / 2, z), 0.0, Matrix.Rotation(am, 3, 'Y'))


def _vitre(lot, c, taille, rot=None):
    lot.cube('verre_sombre', taille, c, 0.0, rot)


def _couleurs():
    for k, v in {'loco_noir': '#26282c', 'loco_rouge': '#a8322a', 'creme': '#e8d9a8', 'verre_sombre': '#22303c',
                 'moderne': '#d9dde2', 'moderne_bleu': '#1f5fa8', 'moderne_sombre': '#3a4048', 'fret': '#8a3b28',
                 'fret_sombre': '#5e2719', 'charbon': '#26262b'}.items():
        T.PALETTE.setdefault(k, v)


def locomotive_vapeur(coll, leger=True):
    """Locomotive à combustible (vapeur, locomotive-tender), 6 m : chaudière noire à cerclages laiton, boîte à fumée et
    porte ronde, haute cheminée, dômes, sifflet, lanterne ; caisses à eau sur les côtés ; trois grandes roues motrices
    rouges par côté (groupe `roues_motrices`) reliées par une bielle, bissel avant (groupe `roues_av`), cylindres et
    tiroirs à l'avant ; traverse avant rouge et chasse-pierres ; abri du mécanicien (siège `siege` à 1,3 m) et soute à
    charbon à l'arrière ; essieu porteur arrière (groupe `roues_ar`)."""
    _couleurs()
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    L = 12.0
    lot = T.Lot(coll, 'pieces')
    _chassis(lot, L, sg, z=1.25, couleur='loco_noir', tampon='loco_rouge')
    # Roues motrices (3 essieux, r 0,62) et bielle d'accouplement.
    rm = 0.62
    ys = (-1.0, 0.45, 1.9)
    g = T.Lot(coll, 'roues_motrices')
    for y in ys:
        for s in (-1, 1):
            _roue(g, s * ECART, y, rm, seg, mat='loco_rouge', moyeu='laiton', s=s)
            g.cube('loco_noir', (0.05, 0.35, 0.25), (s * (ECART + 0.09), y, rm - 0.3))  # contrepoids
        g.tube('acier_sombre', (-ECART, y, rm), (ECART, y, rm), 0.07, sg)
    g.finir()
    T.pivot(coll, 'pivot_roues_motrices', (0, ys[1], rm), (1, 0, 0))
    for s in (-1, 1):
        x = s * (ECART + 0.14)
        lot.barre('acier', (x, ys[0], rm + 0.25), (x, ys[2], rm + 0.25), 0.07)  # bielle d'accouplement
        lot.barre('acier', (x + s * 0.04, -3.4, rm + 0.12), (x + s * 0.04, ys[0], rm + 0.25), 0.07)  # bielle motrice
        lot.cube('loco_noir', (0.1, 4.6, 0.3), (s * (ECART + 0.26), 0.45, rm + 0.62), 0.02)  # longeron
    # Bissel avant (petites roues) et essieu porteur arrière.
    for nom, y, r in (('roues_av', -4.3, 0.36), ('roues_ar', 4.4, 0.4)):
        gp = T.Lot(coll, nom)
        for s in (-1, 1):
            _roue(gp, s * ECART, y, r, sg, mat='loco_rouge', moyeu='laiton', s=s)
        gp.tube('acier_sombre', (-ECART, y, r), (ECART, y, r), 0.06, sg)
        gp.finir()
        T.pivot(coll, 'pivot_' + nom, (0, y, r), (1, 0, 0))
    # Cylindres à vapeur à l'avant.
    for s in (-1, 1):
        lot.tube('loco_noir', (s * 1.2, -4.0, 1.1), (s * 1.2, -2.8, 1.1), 0.32, sg)
        lot.tube('laiton', (s * 1.2, -4.02, 1.1), (s * 1.2, -3.98, 1.1), 0.33, sg)
        lot.cube('loco_noir', (0.4, 0.9, 0.35), (s * 1.15, -3.4, 1.55), 0.03)  # tiroir
    # Chaudière, boîte à fumée, porte.
    zc, rc = 2.55, 0.95
    lot.tube('loco_noir', (0, -5.0, zc), (0, 1.4, zc), rc, seg)
    for y in (-3.3, -1.6, 0.1):
        lot.tube('laiton', (0, y, zc), (0, y + 0.08, zc), rc + 0.02, seg)  # cerclages
    lot.tube('fonte', (0, -5.5, zc), (0, -5.0, zc), rc + 0.04, seg)  # boîte à fumée
    lot.tube('fonte', (0, -5.58, zc), (0, -5.5, zc), rc * 0.85, seg)  # porte
    lot.tube('laiton', (0, -5.62, zc), (0, -5.58, zc), 0.1, 8)  # poignée
    lot.cube('loco_rouge', (0.7, 0.06, 0.22), (0, -5.6, zc - 0.55))  # plaque de numéro
    lot.tube('blanc', (0, -5.45, zc + rc + 0.25), (0, -5.6, zc + rc + 0.25), 0.15, 10)  # lanterne
    lot.cube('loco_noir', (0.36, 0.3, 0.36), (0, -5.35, zc + rc + 0.25), 0.02)
    T.tour(coll, 'cheminee', [(0.3, zc + rc - 0.2), (0.24, zc + rc + 0.6), (0.3, zc + rc + 0.95), (0.36, zc + rc + 1.05),
                              (0.36, zc + rc + 1.12)], 'loco_noir', segments=sg, centre=(0, -4.5))
    lot.tube('noir', (0, -4.5, zc + rc + 1.12), (0, -4.5, zc + rc + 1.13), 0.26, sg)
    for y, h in ((-2.4, 0.5), (-0.6, 0.42)):  # dômes
        T.tour(coll, f'dome_{y}', [(0.42, zc + rc - 0.15), (0.38, zc + rc + h - 0.15), (0.3, zc + rc + h),
                                   (0.1, zc + rc + h + 0.08)], 'laiton' if y > -1 else 'loco_noir', segments=sg,
               centre=(0, y))
    lot.tube('laiton', (0.25, 0.9, zc + rc), (0.25, 0.9, zc + rc + 0.45), 0.05, 8)  # sifflet
    for s in (-1, 1):
        lot.barre('laiton', (s * (rc + 0.08), -4.8, zc + 0.3), (s * (rc + 0.08), 1.3, zc + 0.3), 0.035)  # main courante
    lot.cube('acier_sombre', (LARGE - 1.0, 0.4, 0.6), (0, -6.2, 0.45), 0.02, Matrix.Rotation(0.5, 3, 'X'))  # chasse-pierres
    # Caisses à eau sur les côtés de la chaudière.
    for s in (-1, 1):
        lot.cube('loco_noir', (0.62, 4.6, 1.5), (s * 1.42, -0.9, 2.15), 0.04)
        lot.cube('laiton', (0.64, 4.62, 0.06), (s * 1.42, -0.9, 2.92))
        lot.cube('loco_rouge', (0.02, 1.2, 0.4), (s * 1.74, -0.9, 2.2))  # plaque
    lot.cube('loco_noir', (LARGE - 0.2, 6.9, 0.12), (0, -1.6, 1.42))  # tablier
    # Abri du mécanicien.
    yc0, yc1 = 1.4, 4.0
    lot.cube('acier_sombre', (LARGE, yc1 - yc0, 0.1), (0, (yc0 + yc1) / 2, 1.6))  # plancher
    for s in (-1, 1):
        lot.cube('loco_noir', (0.1, yc1 - yc0, 1.4), (s * (LARGE / 2 - 0.05), (yc0 + yc1) / 2, 2.3), 0.02)
        lot.cube('loco_noir', (0.1, 0.4, 2.2), (s * (LARGE / 2 - 0.05), yc0 + 0.2, 4.0), 0.02)  # montants
        lot.cube('loco_noir', (0.1, 0.4, 2.2), (s * (LARGE / 2 - 0.05), yc1 - 0.2, 4.0), 0.02)
        lot.cube('laiton', (0.12, yc1 - yc0, 0.06), (s * (LARGE / 2 - 0.05), (yc0 + yc1) / 2, 3.0))
    lot.cube('loco_noir', (LARGE, 0.12, 3.6), (0, yc0, 3.2), 0.02)  # façade avant de l'abri
    for s in (-1, 1):
        lot.tube('verre_sombre', (s * 0.95, yc0 - 0.07, 4.1), (s * 0.95, yc0 + 0.07, 4.1), 0.28, 10)  # hublots
        lot.tube('laiton', (s * 0.95, yc0 - 0.08, 4.1), (s * 0.95, yc0 - 0.06, 4.1), 0.32, 10)
    _toit(lot, 'loco_noir', yc0 - 0.2, yc1 + 0.2, 5.0, LARGE + 0.2, 0.35, 5 if leger else 9)
    lot.cube('acier_sombre', (0.8, 0.5, 0.9), (0, yc0 + 0.35, 2.1), 0.02)  # foyer (porte)
    lot.cube('braise', (0.4, 0.02, 0.25), (0, yc0 + 0.61, 2.15))
    T.reperer(coll, 'siege', (-1.05, yc0 + 1.0, 2.6))  # coussin du mécanicien (lu par le jeu)
    lot.cube('noir', (0.6, 0.6, 0.12), (-1.05, yc0 + 1.0, 2.54), 0.03)
    lot.tube('acier_sombre', (-1.05, yc0 + 1.0, 1.65), (-1.05, yc0 + 1.0, 2.48), 0.07, sg)
    # Soute à charbon à l'arrière.
    lot.cube('loco_noir', (LARGE - 0.2, 1.9, 1.7), (0, 5.0, 2.45), 0.03)
    lot.cube('laiton', (LARGE - 0.18, 1.92, 0.06), (0, 5.0, 3.0))
    for k in range(7):
        lot.cube('charbon', (0.6, 0.5, 0.35), (-1.1 + (k % 4) * 0.7, 4.6 + (k // 4) * 0.7, 3.35 + (k % 2) * 0.1), 0.05,
                 Matrix.Rotation(k * 0.7, 3, 'Z'))
    lot.finir()
    _fini(coll)


def locomotive_electrique(coll, leger=True):
    """Locomotive électrique moderne, 8 m : longue caisse lisse gris clair, bandeau bleu, deux cabines à nez incliné
    (grand pare-brise sombre, face jaune, feux à diodes), jupes sur les bogies, grilles, deux pantographes à un bras
    sur le toit. Deux bogies à deux essieux (`roues_av`, `roues_ar`). Siège `siege` (1,3 m) dans la cabine avant."""
    _couleurs()
    sg = 10 if leger else 16
    L = 16.0
    lot = T.Lot(coll, 'pieces')
    _chassis(lot, L, sg, z=1.3, couleur='moderne_sombre', tampon='moderne_sombre')
    for y, nom in ((-4.8, 'roues_av'), (4.8, 'roues_ar')):
        _bogie(coll, lot, y, nom, sg, r=0.55, empattement=1.5, flasque='moderne_sombre')
    zb, zh = 1.45, 4.7
    lc = L - 2.4  # caisse entre les deux nez
    lot.cube('moderne', (LARGE, lc, zh - zb), (0, 0, (zb + zh) / 2), 0.06)
    lot.cube('moderne_sombre', (LARGE + 0.02, lc + 0.02, 0.45), (0, 0, zb + 0.2))  # jupe basse
    lot.cube('moderne_bleu', (LARGE + 0.02, lc + 0.02, 0.35), (0, 0, 2.55))  # bandeau
    _toit(lot, 'moderne', -lc / 2, lc / 2, zh, LARGE, 0.3, 5 if leger else 9)
    for s in (-1, 1):
        y = s * lc / 2
        # Nez : bas vertical, haut incliné (pare-brise), face jaune.
        lot.cube('moderne', (LARGE, 1.2, 1.4), (0, y + s * 0.6, zb + 0.7), 0.06)
        lot.cube('jaune', (LARGE + 0.01, 0.06, 1.0), (0, y + s * 1.2, zb + 0.75))
        lot.cube('moderne_bleu', (LARGE + 0.02, 1.22, 0.35), (0, y + s * 0.6, 2.55))
        incl = Matrix.Rotation(s * 0.55, 3, 'X')
        lot.cube('moderne', (LARGE, 0.9, 2.1), (0, y + s * 0.65, zb + 1.35 + 1.0), 0.06, incl)
        # Pare-brise posé sur la face inclinée (centre de la face + 0,48 le long de sa normale).
        _vitre(lot, (0, y + s * 1.06, 4.05), (LARGE - 0.3, 0.06, 1.3), incl)
        for x in (-1.35, 1.35):  # feux à diodes
            lot.cube('blanc', (0.5, 0.05, 0.12), (x, y + s * 1.22, 2.0))
            lot.cube('rouge', (0.2, 0.05, 0.1), (x * 0.7, y + s * 1.22, 2.0))
        lot.cube('acier_sombre', (LARGE - 0.6, 0.15, 0.55), (0, y + s * 1.3, 0.8), 0.02,
                 Matrix.Rotation(-s * 0.3, 3, 'X'))  # chasse-obstacles
        for sx in (-1, 1):  # vitre latérale et porte de cabine
            xo = sx * (LARGE / 2 + 0.01)
            _vitre(lot, (xo, y - s * 0.5, 3.75), (0.04, 0.9, 0.75))
            lot.cube('moderne_sombre', (0.04, 0.75, 2.5), (xo, y - s * 1.5, 2.95), 0.0)
            _vitre(lot, (xo + sx * 0.005, y - s * 1.5, 3.85), (0.04, 0.5, 0.55))
            lot.cube('acier_sombre', (0.3, 0.6, 0.05), (sx * (LARGE / 2 + 0.08), y - s * 1.5, 1.0))  # marchepied
    for sx in (-1, 1):
        xo = sx * (LARGE / 2 + 0.01)
        for k in range(3):  # grilles de ventilation (claires : elles ne doivent pas passer pour des fenêtres)
            y = -2.6 + k * 2.6
            lot.cube('gris_clair', (0.04, 1.6, 0.7), (xo, y, 3.8))
            for j in range(4):
                lot.cube('acier', (0.05, 1.55, 0.05), (xo, y, 3.56 + j * 0.16))
        for y in (-4.8, 4.8):  # jupes de bogies
            lot.cube('moderne_sombre', (0.08, 2.6, 0.5), (sx * (LARGE / 2 - 0.1), y, 1.25), 0.02)
    # Pantographes à un bras et équipements de toit.
    zt = zh + 0.3
    for y, sens in ((-3.5, 1), (3.5, -1)):
        lot.cube('moderne_sombre', (1.4, 1.0, 0.12), (0, y, zt + 0.05))
        for x in (-0.5, 0.5):
            lot.tube('blanc', (x, y, zt), (x, y, zt + 0.2), 0.07, 8)
        lot.barre('acier', (0, y, zt + 0.15), (0, y + sens * 0.9, zt + 0.7), 0.05)
        lot.barre('acier', (0, y + sens * 0.9, zt + 0.7), (0, y + sens * 0.1, zt + 1.3), 0.04)
        lot.cube('acier', (1.5, 0.1, 0.05), (0, y + sens * 0.1, zt + 1.32))
    lot.cube('moderne_sombre', (1.6, 3.0, 0.3), (0, 0, zt + 0.1), 0.03)
    yc = -lc / 2
    lot.cube('noir', (0.7, 0.6, 0.12), (-0.8, yc + 0.9, 2.54), 0.03)
    lot.cube('panneau', (LARGE - 0.4, 0.5, 0.45), (0, yc + 0.2, 2.8), 0.02, Matrix.Rotation(-0.4, 3, 'X'))
    T.reperer(coll, 'siege', (-0.8, yc + 0.9, 2.6))
    lot.finir()
    _fini(coll)


def wagon_fret(coll, leger=True):
    """Wagon couvert (fret fermé), 5 m : caisse brun-rouge à nervures, grande porte coulissante au milieu de chaque
    flanc (rails, poignée, verrou), toit bombé, échelle et volant de frein à un bout, bogies."""
    _couleurs()
    sg = 8 if leger else 14
    L = 10.0
    lot = T.Lot(coll, 'pieces')
    _chassis(lot, L, sg)
    _bogie(coll, lot, -3.4, 'roues_av', sg)
    _bogie(coll, lot, 3.4, 'roues_ar', sg)
    zb, zh = 1.3, 4.3
    lot.cube('fret', (LARGE, L - 0.1, zh - zb), (0, 0, (zb + zh) / 2), 0.03)
    _toit(lot, 'gris_clair', -(L - 0.1) / 2 - 0.05, (L - 0.1) / 2 + 0.05, zh, LARGE + 0.1, 0.35, 5 if leger else 9)
    for s in (-1, 1):  # pignons (ferment l'arc du toit)
        for k in range(4):
            za, zb2 = zh + 0.35 * k / 4, zh + 0.35 * (k + 1) / 4
            r = ((LARGE + 0.1) ** 2 / 4 + 0.35 ** 2) / (2 * 0.35)
            hh = r - 0.35 + (za + zb2) / 2 - zh
            w = 2 * math.sqrt(max(0.0, r * r - hh * hh))
            lot.cube('fret', (w, 0.06, zb2 - za + 0.005), (0, s * (L / 2 - 0.08), (za + zb2) / 2))
    for sx in (-1, 1):
        xo = sx * (LARGE / 2 + 0.02)
        for k in range(15):  # nervures
            y = -4.55 + k * 0.65
            if abs(y) < 1.0:
                continue
            lot.cube('fret_sombre', (0.06, 0.08, zh - zb - 0.1), (xo, y, (zb + zh) / 2))
        lot.cube('fret_sombre', (0.06, 2.0, 2.7), (xo + sx * 0.03, 0, (zb + zh) / 2), 0.01)  # porte
        for y in (-0.48, 0.48):
            lot.cube('fret', (0.07, 0.9, 2.6), (xo + sx * 0.05, y, (zb + zh) / 2), 0.01)
        lot.cube('acier_sombre', (0.1, 4.2, 0.08), (xo + sx * 0.06, 0.5, zh - 0.12))
        lot.cube('acier_sombre', (0.1, 4.2, 0.08), (xo + sx * 0.06, 0.5, zb + 0.12))
        lot.cube('acier', (0.08, 0.06, 0.5), (xo + sx * 0.1, 0.85, 2.7))
        lot.cube('jaune', (0.08, 0.12, 0.12), (xo + sx * 0.1, 1.0, 2.1))
        lot.cube('blanc', (0.03, 1.4, 0.35), (xo, -3.2, 3.7))  # plaque
    for k in range(6):  # échelle
        lot.barre('acier', (1.2, L / 2 + 0.05, 1.6 + k * 0.42), (1.6, L / 2 + 0.05, 1.6 + k * 0.42), 0.03)
    for x in (1.2, 1.6):
        lot.barre('acier', (x, L / 2 + 0.05, 1.4), (x, L / 2 + 0.05, 4.1), 0.035)
    lot.tube('acier_sombre', (-1.0, L / 2 + 0.02, 3.3), (-1.0, L / 2 + 0.1, 3.3), 0.25, 10)  # volant de frein
    lot.finir()
    _fini(coll)


def wagon_citerne(coll, leger=True):
    """Citerne pour liquides et gaz, 5 m : cuve cylindrique blanche, bande et dôme de la teinte du fluide (`teinte`),
    échelle, passerelle, vanne de vidange, bogies."""
    _couleurs()
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    L = 10.0
    lot = T.Lot(coll, 'pieces')
    _chassis(lot, L, sg)
    _bogie(coll, lot, -3.4, 'roues_av', sg)
    _bogie(coll, lot, 3.4, 'roues_ar', sg)
    r = 1.25
    zc = 1.35 + r
    ye = L / 2 - 0.45
    lot.tube('citerne', (0, -ye, zc), (0, ye, zc), r, seg)  # cuve
    for s in (-1, 1):
        lot.tube('citerne', (0, s * ye, zc), (0, s * (ye + 0.18), zc), r * 0.9, seg)  # fonds bombés
        lot.tube('citerne', (0, s * (ye + 0.18), zc), (0, s * (ye + 0.26), zc), r * 0.65, seg)
        lot.cube('acier_sombre', (2.4, 0.25, 0.5), (0, s * 3.4, 1.45), 0.02)  # berceaux
        lot.tube('acier_sombre', (0, s * 2.0, zc), (0, s * 2.06, zc), r + 0.03, seg)  # cerclages
    lot.tube('teinte', (0, -0.6, zc), (0, 0.6, zc), r + 0.02, seg)  # bande de la teinte du fluide
    lot.tube('teinte', (0, 0, zc + r - 0.05), (0, 0, zc + r + 0.32), 0.38, sg)  # dôme
    lot.tube('acier_sombre', (0, 0, zc + r + 0.32), (0, 0, zc + r + 0.38), 0.33, sg)
    lot.cube('acier_sombre', (0.5, 2.6, 0.05), (0, 0, zc + r + 0.02))  # passerelle
    for s in (-1, 1):
        for y in (-1.3, 1.3):
            lot.barre('acier', (s * 0.3, y, zc + r + 0.02), (s * 0.3, y, zc + r + 0.5), 0.03)
        lot.barre('acier', (s * 0.3, -1.3, zc + r + 0.5), (s * 0.3, 1.3, zc + r + 0.5), 0.03)
    for k in range(7):  # échelle
        lot.barre('acier', (1.3, -0.2, 1.4 + k * 0.32), (1.3, 0.2, 1.4 + k * 0.32), 0.03)
    for y in (-0.2, 0.2):
        lot.barre('acier', (1.3, y, 1.35), (1.2, y, zc + r), 0.04)
    lot.tube('acier_sombre', (0, 0, 1.25), (0, 0, 0.95), 0.1, sg)  # vanne de vidange
    lot.cube('rouge', (0.25, 0.06, 0.06), (0, 0, 0.97))
    lot.finir()
    _fini(coll)


MODELES = {
    'rail_droit': rail_droit,
    'rail_virage': rail_virage,
    'rail_rampe': rail_rampe,
    'locomotive_vapeur': locomotive_vapeur,
    'locomotive_electrique': locomotive_electrique,
    'wagon_fret': wagon_fret,
    'wagon_citerne': wagon_citerne,
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
    T.save(os.path.join(ROOT, 'blender', 'ferroviaire.blend'))


if __name__ == '__main__':
    main()
