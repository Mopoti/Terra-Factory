"""Famille « ferroviaire » : voies (rails) et trains, pour un futur réseau ferré (voie étroite industrielle).

Style low poly stylisé (voir blender/README.md). 1 unité = 1 case = 50 cm. L'avant est du côté -Y.

Voies — une tuile de 2 x 2 cases (1 m), comme les convoyeurs mais sans sens (un train y roule dans les deux sens) :
- `rail_droit` : tout droit le long de Y ;
- `rail_croisement` : tuile de 2 x 2 cases où deux voies droites se croisent à angle droit (rails coupés par les
  ornières, cœurs, contre-rails) ;
- `rail_virage` : 6 x 6 cases (3 m, pour que les wagons de 3 m passent) ; quart de cercle qui relie le milieu du
  bord -Y au milieu du bord +X (centre du cercle au coin (+3, -3), rayon 3 unités = 1,5 m au milieu de la voie). Sans
  sens, le virage à gauche et le virage à droite sont la même pièce tournée ;
- `rail_virage_large` (10 x 10 cases, rayon 5 unités) et `rail_virage_tres_large` (14 x 14 cases, rayon 7 unités) :
  mêmes virages, plus larges (rayons de 6,25 m et 8,75 m dans le jeu) ; `rail_virage_grand` (22 x 22, rayon 11) et
  `rail_virage_geant` (30 x 30, rayon 15) ;
- `rail_virage_45` / `rail_virage_45_b` : demi-virages (45°), les deux moitiés du virage très large dans son bloc de
  14 x 14 (de -Y jusqu'à la diagonale, puis de la diagonale jusqu'à +X) ;
- `rail_rampe` : 2 x 8 cases (4 m), monte de 2 unités (1 m, un niveau) de -Y vers +Y. Sans sens aussi : la descente
  est la même pièce tournée d'un demi-tour. Piliers dessous ;
- `rail_aiguillage_<d|g>_<droit|devie>` : aiguillage de 6 x 6 cases : pointe au milieu du bord -Y, voie directe vers
  le bord +Y, voie déviée en virage serré vers le bord +X (`d`, à droite) ou -X (`g`) ; un modèle par position des
  lames (`droit` : voie directe donnée, `devie` : voie déviée), levier près de la pointe ;
- pas de tunnel.
Écartement : 1,2 unité (60 cm) entre les rails, dessus des rails à `Z_RAIL` (0,24 unité = 12 cm).

Le jeu agrandit les voies ×2,5 (`RAIL_SCALE` de `src/core/rail/track.ts`) : écartement 1,5 m, rails à ±0,75 m,
dessus des rails à 0,3 m.

Trains — dessinés à l'échelle de la voie posée (voie normale) et du personnage (1,7 m) : bandes de roulement des roues
sur l'axe des rails (±1,5 unité), bas des roues à Z = 0 (le jeu le pose sur le dessus des rails), tampons et attelage
à 2,1 unités (1,05 m), caisses de 2,6 m de large ; origine au milieu des essieux ; roues en groupes (un par essieu,
tournent autour de X) ; nœud vide `siege` (coussin du conducteur) dans les locomotives.
Attelages automatiques à mâchoire (groupes `attelage_av` / `attelage_ar`, pivot vertical `pivot_attelage_*` sur la
traverse de tête) : longs bras qui écartent les caisses pour qu'elles ne se touchent pas en courbe ; le jeu les tourne
l'un vers l'autre et les véhicules restent à distance constante (voir `docs/trains.md`) :
- `locomotive_vapeur` : locomotive à combustible, locomotive-tender à vapeur type 030T, essieux à -1,5 / 0 / +1,5 m,
  tampons à l'avant (-3,6 m), attelage automatique à l'arrière (+3,9 m) : roues rouges à rayons, bielles et
  cylindres, chaudière, cheminée, dôme, caisses à eau, abri à deux vraies fenêtres frontales (le jeu y met une vitre)
  et deux à l'arrière, soute à charbon au fond de l'abri ;
- `locomotive_electrique` : locomotive électrique moderne, 8 m (encore à l'ancienne échelle de voie : à reprendre quand
  elle entrera dans le jeu, avec les caténaires) ;
- `wagon_fret` : wagon couvert à porte coulissante, caisse de 5 m, deux essieux à ±1,7 m, attelages automatiques
  aux deux bouts (points d'attelage à ±3,3 m : 6,6 m d'attelage à attelage) ;
- `wagon_citerne` : citerne pour liquides et gaz, mêmes châssis et attelages ; sa bande et son dôme sont de la
  teinte `teinte` (magenta dans le fichier) : le jeu les peindra de la couleur du fluide transporté.

Lancer :  blender --background --python blender/scripts/ferroviaire.py
Produit :  blender/ferroviaire.blend, export/<nom>.glb et export/unity/<nom>.glb
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
sys.path.insert(0, HERE)
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
    'quai': '#c9bca2',
    'quai_bord': '#e3d9c3',
    'quai_bande': '#e9b949',
    'abri': '#3f7f9e',
    'abri_toit': '#2f5f78',
    'abri_verre': '#9fd0e8',
    'banc': '#b5784a',
    'lampe': '#fff1b8',
    'gare_metal': '#4b4f56',
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


def _rail_segment(lot, a, b, mat='rail'):
    """Un bout de rail (champignon et patin) de `a` à `b` (points (x, y))."""
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    d = b - a
    rr = Matrix.Rotation(math.atan2(d.y, d.x) - math.pi / 2, 3, 'Z')
    m = (a + b) / 2
    lot.cube(mat, (0.07, d.length + 0.02, Z_RAIL - Z_TRAVERSE), tuple(m + Vector((0, 0, (Z_RAIL + Z_TRAVERSE) / 2))), 0,
             rr)
    lot.cube(mat, (0.13, d.length + 0.02, 0.025), tuple(m + Vector((0, 0, Z_TRAVERSE + 0.0125))), 0, rr)


def _arc(N, m=1):
    """Point de l'arc de rayon `r` (unités) à l'angle `t` (0 à pi/2), du milieu du bord -Y (0, -N) d'un bloc de
    2N x 2N unités au milieu du bord +X (N, 0) ; centre (N, -N). `m` = -1 : symétrique vers le bord -X."""
    c = Vector((m * N, -N, 0))

    def p(r, t):
        return c + Vector((-m * r * math.cos(t), r * math.sin(t), 0))
    return p


def _virage(lot, N, leger, m=1, ballast=True, traverses=True, rails=(-1, 1), t_min=0.0, dz_ballast=0.0,
            de=0.0, a=math.pi / 2):
    """Quart de cercle de rayon N unités (bloc de 2N x 2N) : ballast en secteurs, traverses rayonnantes, rails en
    segments. `rails` : côtés posés (-1 : rail intérieur, rayon N - écart ; 1 : extérieur). Traverses à partir de
    l'angle `t_min` (aiguillage : là où la voie déviée s'est écartée de la voie directe). `de`, `a` : seulement la
    partie de l'arc entre ces angles (demi-virages : de 0 à pi/4, ou de pi/4 à pi/2)."""
    p = _arc(N, m)
    n = max(8, round((12 if leger else 20) * N / 3))
    n += n % 2  # nombre pair : le milieu de l'arc (45°) tombe entre deux segments
    for k in range(n):
        t0, t1 = (math.pi / 2) * k / n, (math.pi / 2) * (k + 1) / n
        if t0 < de - 1e-6 or t1 > a + 1e-6:
            continue
        tm = (t0 + t1) / 2
        if ballast:
            # Secteur de ballast : sa longueur est celle de l'arc extérieur (pas de trou entre deux secteurs).
            lg = (N + 0.95) * (t1 - t0) + 0.02
            lot.cube('ballast', (1.9, lg, Z_BALLAST), tuple(p(N, tm) + Vector((0, 0, Z_BALLAST / 2 + dz_ballast))), 0,
                     Matrix.Rotation(-m * tm, 3, 'Z'))
        for s in rails:
            r = N + s * ECART
            _rail_segment(lot, p(r, t0), p(r, t1))
    if traverses:
        nt = round(N * math.pi / 2 / 0.52)  # traverses tous les ~50 cm sur l'arc
        for k in range(nt):
            t = (math.pi / 2) * (k + 0.5) / nt
            if t < t_min or t < de - 1e-6 or t >= a - 1e-6:
                continue
            lot.cube('traverse', (1.7, 0.2, Z_TRAVERSE - Z_BALLAST + 0.02),
                     tuple(p(N, t) + Vector((0, 0, (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01))), 0.01,
                     Matrix.Rotation(-m * t, 3, 'Z'))


def rail_croisement(coll, leger=True):
    """Croisement : tuile de 2 x 2 où deux voies droites se coupent à angle droit (le long de Y et le long de X).

    Les rails de chaque voie sont coupés par les ornières de l'autre (vides de 0,1 où passent les boudins des roues) ;
    aux quatre points de croisement, un cœur en fonte ; contre-rails à l'intérieur ; plaque d'acier sous le centre et
    traverses aux quatre bouts."""
    lot = T.Lot(coll, 'rail')
    h = 1.0
    lot.cube('ballast', (2.0, 2.0, Z_BALLAST), (0, 0, Z_BALLAST / 2), 0.02)
    lot.cube('ballast_sombre', (2.06, 2.06, Z_BALLAST * 0.5), (0, 0, Z_BALLAST * 0.25), 0)
    # Plaque d'acier sous le carré central, traverses aux quatre bouts (dans le sens de chaque voie).
    zt = (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01
    lot.cube('acier_sombre', (1.55, 1.55, Z_TRAVERSE - Z_BALLAST + 0.02), (0, 0, zt), 0.02)
    for s_ in (-1, 1):
        d = s_ * 0.86
        lot.cube('traverse', (1.56, 0.16, Z_TRAVERSE - Z_BALLAST + 0.02), (0, d, zt), 0.01)  # voie le long de Y
        lot.cube('traverse', (0.16, 1.56, Z_TRAVERSE - Z_BALLAST + 0.02), (d, 0, zt), 0.01)  # voie le long de X
    # Rails coupés aux croisements : morceaux entre les ornières (de -1 à 1, coupés à ±ECART ± 0,05).
    g = 0.05
    coupes = [-h, -ECART - g, -ECART + g, ECART - g, ECART + g, h]
    for s_ in (-1, 1):
        for i in range(0, len(coupes), 2):
            a, b = coupes[i], coupes[i + 1]
            _rail_segment(lot, (s_ * ECART, a), (s_ * ECART, b))  # voie le long de Y
            _rail_segment(lot, (a, s_ * ECART), (b, s_ * ECART))  # voie le long de X
    # Cœurs en fonte aux quatre croisements, contre-rails le long des ornières.
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.cube('fonte', (0.22, 0.22, 0.03), (sx * ECART, sy * ECART, Z_RAIL - 0.02), 0.01)
    for s_ in (-1, 1):
        x = s_ * (ECART - 0.12)
        _rail_segment(lot, (x, -0.42), (x, 0.42), 'acier')
        _rail_segment(lot, (-0.42, x), (0.42, x), 'acier')
    lot.finir()
    T.poser_au_sol(coll, 1.0)


def rail_virage(coll, leger=True):
    """Bloc de 6 x 6 (3 x 3 tuiles) : quart de cercle du milieu du bord -Y (0, -3) au milieu du bord +X (3, 0), centre
    (3, -3), rayon 3 unités (3,75 m dans le jeu)."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 3, leger)
    lot.finir()
    T.poser_au_sol(coll, 3.0)


def rail_virage_large(coll, leger=True):
    """Virage large : bloc de 10 x 10 (5 x 5 tuiles), rayon 5 unités (6,25 m dans le jeu)."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 5, leger)
    lot.finir()
    T.poser_au_sol(coll, 5.0)


def rail_virage_tres_large(coll, leger=True):
    """Virage très large : bloc de 14 x 14 (7 x 7 tuiles), rayon 7 unités (8,75 m dans le jeu)."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 7, leger)
    lot.finir()
    T.poser_au_sol(coll, 7.0)


def rail_virage_grand(coll, leger=True):
    """Grand virage : bloc de 22 x 22 (11 x 11 tuiles), rayon 11 unités (13,75 m dans le jeu)."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 11, leger)
    lot.finir()
    T.poser_au_sol(coll, 11.0)


def rail_virage_geant(coll, leger=True):
    """Virage géant : bloc de 30 x 30 (15 x 15 tuiles), rayon 15 unités (18,75 m dans le jeu)."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 15, leger)
    lot.finir()
    T.poser_au_sol(coll, 15.0)


def rail_virage_45(coll, leger=True):
    """Demi-virage (45°), première moitié du virage très large (bloc de 14 x 14, rayon 7 unités) : du milieu du bord
    -Y jusqu'au milieu de l'arc, sur la diagonale du bloc. Le jeu le pose dans le même bloc que `rail_virage_45_b`."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 7, leger, a=math.pi / 4)
    lot.finir()
    T.poser_au_sol(coll, 7.0)


def rail_virage_45_b(coll, leger=True):
    """Demi-virage (45°), seconde moitié : du milieu de l'arc (diagonale du bloc) au milieu du bord +X."""
    lot = T.Lot(coll, 'rail')
    _virage(lot, 7, leger, de=math.pi / 4)
    lot.finir()
    T.poser_au_sol(coll, 7.0)


def _aiguillage(coll, leger, m, devie):
    """Aiguillage dans un bloc de 6 x 6 (3 x 3 tuiles) : pointe au milieu du bord -Y (0, -3) ; voie directe jusqu'au
    bord +Y (0, 3) ; voie déviée en virage serré vers le bord +X (m = 1, à droite) ou -X (m = -1, à gauche).

    Rails : contre-aiguille droite (côté opposé à la branche) et contre-aiguille courbe (côté de la branche), continues ;
    aiguilles (les lames mobiles, 1,6 unité) puis rails intérieurs des deux voies, qui se croisent au cœur. `devie` :
    position des lames (voie déviée donnée) et du levier, sur le côté opposé à la branche, près de la pointe."""
    N = 3.0
    lot = T.Lot(coll, 'rail')
    p = _arc(N, m)
    # Voie directe : ballast et traverses ; les traverses de la zone des lames sont longues (elles portent les deux voies).
    lot.cube('ballast', (1.9, 2 * N, Z_BALLAST), (0, 0, Z_BALLAST / 2), 0.02)
    lot.cube('ballast_sombre', (2.0, 2 * N, Z_BALLAST * 0.5), (0, 0, Z_BALLAST * 0.25), 0)
    t_ecart = 0.0
    n = 12
    for k in range(n):
        y = -N + 2 * N * (k + 0.5) / n
        # Écart de la voie déviée à cette hauteur (tant qu'elle est sur les traverses de la voie directe).
        s_ = max(-1.0, min(1.0, (y + N) / N))
        t = math.asin(s_)
        ecart = N - N * math.cos(t)
        if ecart < 1.75:
            t_ecart = t
            lg = 1.7 + ecart
            lot.cube('traverse', (lg, 0.2, Z_TRAVERSE - Z_BALLAST + 0.02),
                     (m * ecart / 2, y, (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01), 0.01)
        else:
            lot.cube('traverse', (1.7, 0.2, Z_TRAVERSE - Z_BALLAST + 0.02),
                     (0, y, (Z_TRAVERSE + Z_BALLAST) / 2 - 0.01), 0.01)
    # Voie déviée : ballast un peu plus bas (pas de scintillement là où il recouvre celui de la voie directe), traverses
    # au-delà des traverses longues, rail extérieur (contre-aiguille courbe) continu.
    _virage(lot, N, leger, m, rails=(-1,), t_min=t_ecart + 0.05, dz_ballast=-0.004)
    # Contre-aiguille droite (côté opposé à la branche), continue.
    _rail_segment(lot, (-m * ECART, -N), (-m * ECART, N))
    # Lames : de la pointe sur 1,6 unité ; l'une appliquée contre sa contre-aiguille, l'autre écartée de 0,12.
    Lb = 1.6
    tb = Lb / (N + ECART)
    ouv = 0.12
    # Lame de la voie directe (le long de la contre-aiguille courbe, côté branche), fermée quand la voie est directe.
    dx = 0.0 if not devie else -m * ouv
    _rail_segment(lot, (m * ECART + dx, -N), (m * ECART + dx * 0.3, -N + Lb), 'acier')
    # Lame de la voie déviée (le long de la contre-aiguille droite), fermée quand la voie est déviée.
    q0, q1 = p(N + ECART, 0), p(N + ECART, tb)
    dxa = 0.0 if devie else m * ouv
    _rail_segment(lot, (q0.x + dxa, q0.y), (q1.x + dxa * 0.3, q1.y), 'acier')
    # Rails intérieurs, après les lames : voie directe (droit) et voie déviée (courbe), qui se croisent au cœur.
    _rail_segment(lot, (m * ECART, -N + Lb), (m * ECART, N))
    k0 = 6
    for k in range(k0 * 3):
        t0 = tb + (math.pi / 2 - tb) * k / (k0 * 3)
        t1 = tb + (math.pi / 2 - tb) * (k + 1) / (k0 * 3)
        _rail_segment(lot, p(N + ECART, t0), p(N + ECART, t1))
    # Tringle de manœuvre entre les lames, levier.
    lot.cube('acier_sombre', (2.2, 0.08, 0.05), (m * 0.0 - m * 0.5, -N + 0.25, Z_TRAVERSE + 0.04))
    xl, yl = -m * 1.5, -N + 0.75
    lot.cube('fonte', (0.3, 0.45, 0.2), (xl, yl, Z_BALLAST + 0.1), 0.02)  # socle
    a = 0.5 if devie else -0.5
    lot.barre('rouge', (xl, yl, Z_BALLAST + 0.2), (xl + m * 0.0, yl + a * 0.6, Z_BALLAST + 0.75), 0.05)  # levier
    lot.tube('blanc', (xl, yl + a * 0.6, Z_BALLAST + 0.75), (xl, yl + a * 0.6, Z_BALLAST + 0.8), 0.06, 8)
    lot.finir()
    T.poser_au_sol(coll, N)


def rail_aiguillage_d_droit(coll, leger=True):
    _aiguillage(coll, leger, 1, False)


def rail_aiguillage_d_devie(coll, leger=True):
    _aiguillage(coll, leger, 1, True)


def rail_aiguillage_g_droit(coll, leger=True):
    _aiguillage(coll, leger, -1, False)


def rail_aiguillage_g_devie(coll, leger=True):
    _aiguillage(coll, leger, -1, True)


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
    lot.cube('noir', (0.7, 0.6, 0.12), (0.8, yc + 0.9, 2.54), 0.03)
    lot.cube('panneau', (LARGE - 0.4, 0.5, 0.45), (0, yc + 0.2, 2.8), 0.02, Matrix.Rotation(-0.4, 3, 'X'))
    T.reperer(coll, 'siege', (0.8, yc + 0.9, 2.6))  # à gauche (+X : la gauche du conducteur qui regarde vers -Y)
    lot.finir()
    _fini(coll)


# --- Matériel à l'échelle de la voie posée dans le jeu --------------------------------------------------------------
# Le jeu agrandit les voies ×2,5 (`RAIL_SCALE`) : écartement 1,5 m, rails à ±0,75 m (±1,5 unité), dessus des rails
# à 0,3 m. Les véhicules ci-dessous sont dessinés directement à cette échelle (voie normale, ~1,5 m) : roues sur les
# rails, bandes de roulement au bas du modèle (Z = 0, posées par le jeu sur le dessus des rails), tampons et attelage
# à 2,1 unités (1,05 m), caisses de 2,6 m de large.

VOIE = 1.5  # demi-écartement des véhicules (unités) : milieu de la bande de roulement, sur l'axe du rail
Z_TAMPON = 2.1


def _roue_std(lot, x, y, r, sg, mat='acier_sombre', s=1, rayons=0):
    """Roue sur le rail : bande de roulement (bas à Z = 0), voile, moyeu ; `rayons` > 0 : roue à rayons (vapeur)."""
    lot.tube(mat, (x - 0.14, y, r), (x + 0.14, y, r), r, sg)  # bande de roulement
    lot.tube('fonte', (x - s * 0.14, y, r), (x - s * 0.17, y, r), r * 0.96, sg)  # boudin (côté intérieur, sans dépasser)
    lot.tube('acier', (x + s * 0.14, y, r), (x + s * 0.2, y, r), r * 0.3, sg)  # moyeu
    for k in range(rayons):
        a = 2 * math.pi * k / rayons
        lot.barre(mat, (x + s * 0.15, y, r), (x + s * 0.15, y + math.cos(a) * r * 0.85, r + math.sin(a) * r * 0.85),
                  0.07)


def _essieu(coll, y, nom, r, sg, mat='acier_sombre', rayons=0):
    g = T.Lot(coll, nom)
    for s in (-1, 1):
        _roue_std(g, s * VOIE, y, r, sg, mat, s, rayons)
    g.tube('acier_sombre', (-VOIE, y, r), (VOIE, y, r), 0.09, sg)
    g.finir()
    T.pivot(coll, 'pivot_' + nom, (0, y, r), (1, 0, 0))


def _tampons(lot, y_bout, s, sg, traverse='rouge'):
    """Traverse de tête, deux tampons (faces à ±(y_bout + 0,4)), crochet et attelage à vis."""
    lot.cube(traverse, (5.0, 0.2, 0.8), (0, s * y_bout, Z_TAMPON), 0.03)
    for b in (-1, 1):
        lot.tube('acier_sombre', (b * 1.75, s * y_bout, Z_TAMPON), (b * 1.75, s * (y_bout + 0.3), Z_TAMPON), 0.14, sg)
        lot.tube('acier', (b * 1.75, s * (y_bout + 0.3), Z_TAMPON), (b * 1.75, s * (y_bout + 0.4), Z_TAMPON), 0.34, sg)
    lot.cube('noir', (0.2, 0.36, 0.2), (0, s * (y_bout + 0.18), Z_TAMPON), 0.02)  # crochet
    lot.barre('noir', (0, s * (y_bout + 0.3), Z_TAMPON), (0, s * (y_bout + 0.3), Z_TAMPON - 0.5), 0.07)  # attelage


def _attelage(coll, lot, y0, y1, nom, sg, traverse='acier_sombre'):
    """Attelage automatique à mâchoire (type « knuckle ») au bout d'un véhicule : traverse de tête à `y0` et bras qui
    y pivote (groupe `nom`, nœud `pivot_<nom>`, axe vertical) jusqu'au point d'attelage `y1`, où sa tête rejoint celle
    du véhicule voisin. Le jeu tourne le bras vers le voisin en courbe (et l'allonge un peu) : les deux véhicules
    restent à la même distance, assez loin pour que les caisses ne se touchent pas dans les virages.

    La tête a son corps d'un côté et sa mâchoire de l'autre (côté opposé selon le sens du bras) : deux têtes face à
    face s'emboîtent."""
    s = 1 if y1 > y0 else -1
    z = Z_TAMPON
    # Traverse de tête (fixe), levier de dételage.
    lot.cube(traverse, (5.0, 0.2, 0.8), (0, y0, z), 0.03)
    lot.barre('acier', (-2.3, y0 + s * 0.16, z + 0.5), (0.2, y0 + s * 0.16, z + 0.5), 0.05)
    lot.barre('acier', (-2.3, y0 + s * 0.16, z + 0.5), (-2.3, y0 + s * 0.16, z + 0.2), 0.05)
    g = T.Lot(coll, nom)

    def X(a):  # côté du corps de la tête (a > 0) ou de la mâchoire (a < 0)
        return -s * a

    def bloc(mat, xa, xb, ya, yb, za, zb, bev=0.03):
        g.cube(mat, (abs(X(xb) - X(xa)), abs(yb - ya), zb - za), ((X(xa) + X(xb)) / 2, (ya + yb) / 2, (za + zb) / 2),
               bev)

    c = y1
    bloc('acier_sombre', -0.35, 0.35, y0 + s * 0.1, y0 + s * 0.42, z - 0.28, z + 0.28)  # boîte d'attelage
    bloc('noir', -0.15, 0.15, y0 + s * 0.42, c - s * 0.78, z - 0.15, z + 0.15, 0.02)  # bras (tige de traction)
    bloc('noir', 0.02, 0.62, c - s * 0.8, c + s * 0.3, z - 0.3, z + 0.3, 0.06)  # corps de la tête
    bloc('noir', -0.62, -0.02, c - s * 0.8, c - s * 0.34, z - 0.26, z + 0.26, 0.06)  # mâchoire (knuckle)
    bloc('noir', -0.62, -0.38, c - s * 0.36, c - s * 0.12, z - 0.2, z + 0.2, 0.04)  # bec de la mâchoire
    g.tube('acier', (X(-0.3), c - s * 0.6, z + 0.26), (X(-0.3), c - s * 0.6, z + 0.36), 0.08, sg)  # pivot de mâchoire
    g.cube('jaune', (0.06, 0.3, 0.06), (X(0.32), c - s * 0.2, z + 0.31))  # verrou
    g.finir()
    T.pivot(coll, 'pivot_' + nom, (0, y0, z), (0, 0, 1))


def _chassis_wagon(coll, lot, L, sg, couleur='acier_sombre'):
    """Wagon à deux essieux (empattement 3,4 m : essieux à ±3,4 unités) : longerons, boîtes d'essieu et ressorts à
    lames à l'extérieur des roues, plancher ; traverses de tête et attelages automatiques aux deux bouts (bras de 0,8 m
    : points d'attelage à ±6,6 unités, 3,3 m du centre)."""
    r = 0.9
    for y, nom in ((-3.4, 'roues_av'), (3.4, 'roues_ar')):
        _essieu(coll, y, nom, r, sg)
        for s in (-1, 1):
            x = s * (VOIE + 0.45)
            lot.cube('fonte', (0.28, 0.5, 0.5), (x, y, r), 0.03)  # boîte d'essieu
            for k in range(4):  # ressort à lames
                lot.cube('acier_sombre', (0.24, 1.6 - k * 0.3, 0.07), (x, y, r + 0.32 + k * 0.08))
            for dy in (-0.6, 0.6):  # plaques de garde
                lot.cube(couleur, (0.12, 0.12, 1.0), (x, y + dy, r + 0.3))
    for s in (-1, 1):
        lot.cube(couleur, (0.2, L, 0.6), (s * (VOIE + 0.45), 0, 2.0), 0.02)  # longerons
        _attelage(coll, lot, s * L / 2, s * (L / 2 + 1.6), 'attelage_av' if s < 0 else 'attelage_ar', sg,
                  traverse=couleur)
    lot.cube(couleur, (4.2, L, 0.2), (0, 0, 2.1))  # plancher (dessous)


def locomotive_vapeur(coll, leger=True):
    """Locomotive à combustible : locomotive-tender à vapeur à trois essieux moteurs (type 030T), voie normale :
    tampons à l'avant (3,6 m devant le milieu des essieux), attelage automatique `attelage_ar` à l'arrière (bras de
    1,1 m, point d'attelage à 3,9 m derrière ; 7,5 m d'attelage à attelage). Roues motrices rouges à rayons (un groupe par essieu : `roues_av`, `roues_motrices`, `roues_ar`) avec bielles et cylindres, longerons
    rouges, tablier noir ; chaudière noire à cerclages laiton, boîte à fumée et porte, cheminée, dôme, soupapes, sifflet,
    caisses à eau latérales, sablières ; abri du mécanicien avec deux vitres frontales (ouvertures réelles, de chaque
    côté de la chaudière : le jeu y pose une vitre translucide, `CAB_GLASS` de `trainView.ts`), portes latérales
    ouvertes, toit bombé, siège `siege` à gauche (+X, la gauche du mécanicien ; coussin à 2,25 m : les yeux passent au-dessus des caisses à eau,
    à côté de la chaudière) ; façade arrière à deux fenêtres, soute à charbon au fond de l'abri, lanternes."""
    _couleurs()
    sg = 10 if leger else 16
    seg = 16 if leger else 28
    lot = T.Lot(coll, 'pieces')
    yb = 6.8  # traverse avant à -6,8 unités, faces des tampons à -7,2 (3,6 m devant le milieu des essieux)
    yr = 5.6  # traverse arrière (2,8 m derrière), attelage automatique jusqu'à +7,8 (3,9 m)
    # Roues motrices (r 0,625 m), espacées de 1,5 m.
    rm = 1.25
    ys = (-3.0, 0.0, 3.0)
    # Un groupe par essieu (chacun tourne sur son axe) : avant, milieu, arrière.
    for y, nom in zip(ys, ('roues_av', 'roues_motrices', 'roues_ar')):
        g = T.Lot(coll, nom)
        for s in (-1, 1):
            _roue_std(g, s * VOIE, y, rm, seg, mat='loco_rouge', s=s, rayons=8 if leger else 12)
            g.cube('loco_noir', (0.08, 0.6, 0.45), (s * (VOIE + 0.18), y, rm - 0.6))  # contrepoids
        g.tube('acier_sombre', (-VOIE, y, rm), (VOIE, y, rm), 0.1, sg)
        g.finir()
        T.pivot(coll, 'pivot_' + nom, (0, y, rm), (1, 0, 0))
    # Longerons (à l'intérieur des roues), traverse et tampons à l'avant, attelage automatique à l'arrière.
    for s in (-1, 1):
        lot.cube('loco_rouge', (0.16, yb + yr - 0.4, 1.6), (s * 1.05, (yr - yb) / 2, 1.9), 0.02)
    _tampons(lot, yb, -1, sg, traverse='loco_rouge')
    _attelage(coll, lot, yr, yr + 2.2, 'attelage_ar', sg, traverse='loco_rouge')
    # Bielles d'accouplement et motrices, glissières, cylindres.
    for s in (-1, 1):
        x = s * (VOIE + 0.3)
        lot.barre('acier', (x, ys[0], rm - 0.45), (x, ys[2], rm - 0.45), 0.12)
        lot.barre('acier', (x + s * 0.08, -5.0, rm), (x + s * 0.08, ys[1], rm - 0.45), 0.12)
        lot.cube('acier', (0.1, 1.6, 0.12), (x + s * 0.08, -5.4, rm + 0.25))  # glissière
        lot.tube('loco_noir', (s * 2.0, -6.6, 1.75), (s * 2.0, -4.6, 1.75), 0.6, sg)  # cylindre
        lot.tube('laiton', (s * 2.0, -6.62, 1.75), (s * 2.0, -6.56, 1.75), 0.62, sg)
        lot.cube('loco_noir', (0.7, 1.6, 0.6), (s * 1.9, -5.6, 2.6), 0.04)  # boîte à tiroir
    # Tablier (passerelles) au-dessus des roues.
    lot.cube('loco_noir', (5.2, yb + yr, 0.14), (0, (yr - yb) / 2, 3.0))
    lot.cube('loco_rouge', (5.22, yb + yr, 0.12), (0, (yr - yb) / 2, 2.88))  # bord rouge
    # Chaudière, boîte à fumée, porte, cheminée, dôme, soupapes, sifflet, sablières.
    zc, rc = 4.6, 1.45
    lot.tube('loco_noir', (0, -5.6, zc), (0, 2.0, zc), rc, seg)
    for y in (-3.8, -1.5, 0.8):
        lot.tube('laiton', (0, y, zc), (0, y + 0.12, zc), rc + 0.03, seg)  # cerclages
    lot.tube('fonte', (0, -6.5, zc), (0, -5.6, zc), rc + 0.06, seg)  # boîte à fumée
    lot.tube('fonte', (0, -6.6, zc), (0, -6.5, zc), rc * 0.88, seg)  # porte
    lot.tube('laiton', (0, -6.66, zc), (0, -6.6, zc), 0.16, 8)  # poignée centrale
    lot.cube('loco_rouge', (1.1, 0.06, 0.32), (0, -6.62, zc - 0.85))  # plaque de numéro
    lot.cube('fonte', (2.6, 1.0, 1.6), (0, -6.05, 3.85), 0.04)  # selle de la boîte à fumée
    T.tour(coll, 'cheminee', [(0.5, zc + rc - 0.3), (0.42, zc + rc + 1.0), (0.5, zc + rc + 1.7), (0.6, zc + rc + 1.85),
                              (0.6, zc + rc + 1.98)], 'loco_noir', segments=sg, centre=(0, -5.6))
    lot.tube('noir', (0, -5.6, zc + rc + 1.98), (0, -5.6, zc + rc + 1.99), 0.45, sg)
    T.tour(coll, 'dome', [(0.7, zc + rc - 0.2), (0.62, zc + rc + 0.55), (0.5, zc + rc + 0.75), (0.15, zc + rc + 0.85)],
           'laiton', segments=sg, centre=(0, -1.6))
    for x in (-0.25, 0.25):  # soupapes
        lot.tube('laiton', (x, 1.2, zc + rc - 0.1), (x, 1.2, zc + rc + 0.45), 0.12, 8)
    lot.tube('laiton', (0.45, 1.6, zc + rc - 0.1), (0.45, 1.6, zc + rc + 0.7), 0.07, 8)  # sifflet
    for s in (-1, 1):
        lot.barre('laiton', (s * (rc + 0.12), -5.4, zc + 0.6), (s * (rc + 0.12), 1.8, zc + 0.6), 0.05)  # main courante
    # Caisses à eau latérales (le haut à 2,5 m : sous les yeux du mécanicien).
    for s in (-1, 1):
        lot.cube('loco_noir', (1.05, 5.4, 2.0), (s * 2.07, -0.7, 4.07), 0.05)
        lot.cube('laiton', (1.07, 5.42, 0.07), (s * 2.07, -0.7, 4.95))
        lot.cube('loco_rouge', (0.03, 1.8, 0.6), (s * 2.61, -0.7, 4.0))  # plaque
        lot.tube('laiton', (s * 2.07, -2.6, 5.07), (s * 2.07, -2.6, 5.2), 0.22, 8)  # bouchon de remplissage
    # Lanternes à l'avant (sur la traverse) et à l'arrière.
    for s, yl in ((-1, yb), (1, yr)):
        for x in (-1.6, 1.6):
            lot.cube('loco_noir', (0.36, 0.3, 0.4), (x, s * (yl - 0.2), Z_TAMPON + 0.75), 0.03)
            lot.cube('blanc' if s < 0 else 'rouge', (0.26, 0.04, 0.26), (x, s * (yl - 0.02), Z_TAMPON + 0.75))
    # Abri du mécanicien : de y 2,0 à 5,4 ; plancher à 3,0 (1,5 m), toit à 7,6 (3,8 m).
    y0, y1, zp, zt = 2.0, 5.4, 3.0, 7.6
    W = 2.6  # demi-largeur
    # Façade avant avec deux fenêtres (x de 1,25 à 2,35 de chaque côté, z de 5,6 à 6,8) : faite de morceaux autour des
    # ouvertures (vraies ouvertures, pas de vitre opaque).
    # La façade arrière (sans soute derrière l'abri) a les mêmes fenêtres : on voit l'attelage en reculant.
    fe = 0.12
    xa, xb, za, zb2 = 1.25, 2.35, 5.6, 6.8
    for fy in (y0, y1):
        lot.cube('loco_noir', (2 * W, fe, za - zp), (0, fy, (zp + za) / 2))  # bas, sous les fenêtres
        lot.cube('loco_noir', (2 * W, fe, zt - zb2), (0, fy, (zb2 + zt) / 2))  # haut, au-dessus
        lot.cube('loco_noir', (2 * xa, fe, zb2 - za), (0, fy, (za + zb2) / 2))  # entre les deux fenêtres
        for s in (-1, 1):
            lot.cube('loco_noir', (W - xb, fe, zb2 - za), (s * (xb + W) / 2, fy, (za + zb2) / 2))  # bords
            # Encadrement laiton de la fenêtre.
            for z in (za, zb2):
                lot.cube('laiton', (xb - xa + 0.1, fe + 0.04, 0.06), (s * (xa + xb) / 2, fy, z))
            for x in (xa, xb):
                lot.cube('laiton', (0.06, fe + 0.04, zb2 - za + 0.1), (s * x, fy, (za + zb2) / 2))
    # Flancs : bas jusqu'à 1,2 m au-dessus du plancher, porte ouverte (y 2,4 à 3,8), haut au-dessus.
    for s in (-1, 1):
        x = s * (W - 0.06)
        lot.cube('loco_noir', (0.12, 0.4, zt - zp), (x, y0 + 0.2, (zp + zt) / 2))
        lot.cube('loco_noir', (0.12, y1 - 3.8, zt - zp), (x, (3.8 + y1) / 2, (zp + zt) / 2))
        lot.cube('loco_noir', (0.12, 1.4, zt - 6.4), (x, 3.1, (6.4 + zt) / 2))
        lot.cube('laiton', (0.14, y1 - y0, 0.06), (x, (y0 + y1) / 2, 5.2))
        lot.barre('laiton', (s * (W + 0.05), 2.45, 3.3), (s * (W + 0.05), 2.45, 5.6), 0.05)  # mains montoires
        lot.barre('laiton', (s * (W + 0.05), 3.75, 3.3), (s * (W + 0.05), 3.75, 5.6), 0.05)
        lot.cube('acier_sombre', (0.5, 1.2, 0.08), (s * (W + 0.1), 3.1, 2.3))  # marchepied
    _toit(lot, 'loco_noir', y0 - 0.3, y1 + 0.3, zt, 2 * W + 0.3, 0.45, 5 if leger else 9)
    lot.cube('acier_sombre', (2 * W - 0.2, y1 - y0, 0.1), (0, (y0 + y1) / 2, zp + 0.05))  # plancher
    # Intérieur : foyer (porte rougeoyante), manomètres, régulateur, siège du mécanicien.
    lot.cube('loco_noir', (2.0, 0.8, 2.2), (0, y0 + 0.5, zp + 1.1), 0.03)
    lot.cube('braise', (0.6, 0.02, 0.4), (0, y0 + 0.91, zp + 0.8))
    for x in (-0.5, 0.5):
        lot.tube('blanc', (x, y0 + 0.14, 6.4), (x, y0 + 0.2, 6.4), 0.16, 10)  # manomètres (sous l'encadrement)
    lot.barre('laiton', (0.7, y0 + 0.5, 6.0), (1.2, y0 + 0.9, 5.6), 0.06)  # régulateur
    # Siège du mécanicien à gauche (+X : la gauche de qui regarde vers l'avant, -Y), coussin lu par le jeu.
    T.reperer(coll, 'siege', (1.7, 3.2, 4.5))
    lot.cube('noir', (0.8, 0.7, 0.14), (1.7, 3.2, 4.43), 0.03)
    lot.cube('noir', (0.8, 0.14, 0.9), (1.7, 3.6, 4.95), 0.03)
    lot.tube('acier_sombre', (1.7, 3.2, zp + 0.1), (1.7, 3.2, 4.36), 0.08, sg)
    # Soute à charbon au fond de l'abri, sous les fenêtres arrière.
    ys0 = 4.3
    lot.cube('loco_noir', (2 * W - 0.3, y1 - ys0 - 0.06, 1.3), (0, (ys0 + y1) / 2 - 0.03, zp + 0.65), 0.04)
    lot.cube('laiton', (2 * W - 0.28, 0.07, 0.07), (0, ys0, zp + 1.3))
    for k in range(8):
        lot.cube('charbon', (0.8, 0.5, 0.35), (-1.65 + (k % 4) * 1.1, ys0 + 0.35 + (k // 4) * 0.45,
                                              zp + 1.38 + (k % 2) * 0.1), 0.05, Matrix.Rotation(k * 0.7, 3, 'Z'))
    lot.finir()


def wagon_fret(coll, leger=True):
    """Wagon couvert (fret fermé), caisse de 5 m, attelages automatiques aux deux bouts, deux essieux sur la voie : caisse brun-rouge à
    montants, grande porte coulissante au milieu de chaque flanc, toit bombé, échelle, volant de frein."""
    _couleurs()
    sg = 8 if leger else 14
    L = 10.0
    lot = T.Lot(coll, 'pieces')
    _chassis_wagon(coll, lot, L, sg)
    W = 5.2
    zb, zh = 2.3, 6.6
    lot.cube('fret', (W, L, zh - zb), (0, 0, (zb + zh) / 2), 0.04)
    _toit(lot, 'gris_clair', -L / 2 - 0.1, L / 2 + 0.1, zh, W + 0.2, 0.5, 5 if leger else 9)
    for s in (-1, 1):  # pignons
        for k in range(4):
            za, zb2 = zh + 0.5 * k / 4, zh + 0.5 * (k + 1) / 4
            r = ((W + 0.2) ** 2 / 4 + 0.5 ** 2) / (2 * 0.5)
            hh = r - 0.5 + (za + zb2) / 2 - zh
            w = 2 * math.sqrt(max(0.0, r * r - hh * hh))
            lot.cube('fret', (w, 0.06, zb2 - za + 0.005), (0, s * (L / 2 - 0.08), (za + zb2) / 2))
    for sx in (-1, 1):
        xo = sx * (W / 2 + 0.03)
        for k in range(11):  # montants
            y = -4.5 + k * 0.9
            if abs(y) < 1.4:
                continue
            lot.cube('fret_sombre', (0.08, 0.12, zh - zb - 0.1), (xo, y, (zb + zh) / 2))
        lot.cube('fret_sombre', (0.08, 2.6, 3.8), (xo + sx * 0.03, 0, (zb + zh) / 2), 0.01)  # porte
        for y in (-0.62, 0.62):
            lot.cube('fret', (0.09, 1.15, 3.7), (xo + sx * 0.06, y, (zb + zh) / 2), 0.01)
        lot.cube('acier_sombre', (0.12, 5.6, 0.1), (xo + sx * 0.08, 0.7, zh - 0.15))  # rails de porte
        lot.cube('acier_sombre', (0.12, 5.6, 0.1), (xo + sx * 0.08, 0.7, zb + 0.15))
        lot.cube('acier', (0.1, 0.08, 0.7), (xo + sx * 0.12, 1.1, 4.4))  # poignée
        lot.cube('jaune', (0.1, 0.16, 0.16), (xo + sx * 0.12, 1.3, 3.5))  # verrou
        lot.cube('blanc', (0.04, 1.8, 0.45), (xo, -3.0, 5.8))  # plaque
    for k in range(7):  # échelle
        lot.barre('acier', (1.6, L / 2 + 0.06, 2.6 + k * 0.55), (2.2, L / 2 + 0.06, 2.6 + k * 0.55), 0.04)
    for x in (1.6, 2.2):
        lot.barre('acier', (x, L / 2 + 0.06, 2.4), (x, L / 2 + 0.06, 6.4), 0.045)
    lot.tube('acier_sombre', (-1.4, L / 2 + 0.03, 5.2), (-1.4, L / 2 + 0.12, 5.2), 0.35, 10)  # volant de frein
    lot.finir()


def wagon_citerne(coll, leger=True):
    """Wagon-citerne pour liquides et gaz, caisse de 5 m, attelages automatiques aux deux bouts, deux essieux sur la voie : cuve blanche, bande et
    dôme de la teinte du fluide (`teinte`), berceaux, passerelle et garde-corps, échelle, vanne de vidange."""
    _couleurs()
    sg = 8 if leger else 14
    seg = 16 if leger else 28
    L = 10.0
    lot = T.Lot(coll, 'pieces')
    _chassis_wagon(coll, lot, L, sg)
    r = 2.3
    zc = 2.3 + r
    ye = L / 2 - 0.5
    lot.tube('citerne', (0, -ye, zc), (0, ye, zc), r, seg)  # cuve
    for s in (-1, 1):
        lot.tube('citerne', (0, s * ye, zc), (0, s * (ye + 0.25), zc), r * 0.9, seg)  # fonds bombés
        lot.tube('citerne', (0, s * (ye + 0.25), zc), (0, s * (ye + 0.38), zc), r * 0.62, seg)
        lot.cube('acier_sombre', (3.6, 0.35, 0.8), (0, s * 3.0, 2.5), 0.03)  # berceaux
        lot.tube('acier_sombre', (0, s * 3.0, zc), (0, s * 3.08, zc), r + 0.04, seg)  # sangles
    lot.tube('teinte', (0, -0.9, zc), (0, 0.9, zc), r + 0.03, seg)  # bande de la teinte du fluide
    lot.tube('teinte', (0, 0, zc + r - 0.1), (0, 0, zc + r + 0.5), 0.6, sg)  # dôme
    lot.tube('acier_sombre', (0, 0, zc + r + 0.5), (0, 0, zc + r + 0.6), 0.52, sg)
    lot.cube('acier_sombre', (0.9, 3.8, 0.06), (0, 0, zc + r + 0.03))  # passerelle
    for s in (-1, 1):
        for y in (-1.9, 1.9):
            lot.barre('acier', (s * 0.5, y, zc + r + 0.03), (s * 0.5, y, zc + r + 0.9), 0.04)
        lot.barre('acier', (s * 0.5, -1.9, zc + r + 0.9), (s * 0.5, 1.9, zc + r + 0.9), 0.04)
    for k in range(9):  # échelle sur le côté
        lot.barre('acier', (2.5, -0.3, 2.5 + k * 0.5), (2.5, 0.3, 2.5 + k * 0.5), 0.04)
    for y in (-0.3, 0.3):
        lot.barre('acier', (2.55, y, 2.3), (2.2, y, zc + r - 0.3), 0.05)
    lot.tube('acier_sombre', (0, 0, zc - r + 0.1), (0, 0, 1.6), 0.18, sg)  # vanne de vidange
    lot.cube('rouge', (0.5, 0.1, 0.1), (0, 0, 1.65))
    lot.finir()


def gare(coll, leger=True):
    """Quai de gare au style doux, posé à droite de la voie : 4,8 × 18 × 0,64 (2,4 × 9 m, 32 cm de haut), centré.

    La voie est du côté -X (bord du quai à x = -2,4) ; le long de la voie (axe Y). Bordure claire et bande jaune côté
    voie, abri vitré à toit penché (montants, vitres, banc), deux lampadaires, une poubelle. Le panneau au nom de la
    station reste dessiné par le jeu (`stationView.ts`), à l'emplacement laissé libre au bout du quai (+Y).
    """
    import outils as O
    n = 3 if leger else 5
    lot = T.Lot(coll, 'gare')
    W, L, H = 4.8, 18.0, 0.64
    O._rond(lot, 'quai', (0, -L / 2, H / 2), (0, L / 2, H / 2), W / 2, H / 2, n, k=0.06, r=0.08)
    O._rond(lot, 'quai_bord', (-W / 2 + 0.2, -L / 2 + 0.02, H + 0.005), (-W / 2 + 0.2, L / 2 - 0.02, H + 0.005), 0.22, 0.03, n,
            k=0.02)
    O._rond(lot, 'quai_bande', (-W / 2 + 0.62, -L / 2 + 0.1, H + 0.01), (-W / 2 + 0.62, L / 2 - 0.1, H + 0.01), 0.09, 0.02,
            n, k=0.01)
    # Dalles du quai : joints discrets.
    for i in range(1, 9):
        y = -L / 2 + i * L / 9
        lot.cube('quai_bord', (W - 1.2, 0.04, 0.02), (0.55, y, H + 0.005), 0.005)
    # Abri : fond vitré, deux côtés, toit penché vers la voie, montants.
    y0, y1 = -5.0, 2.0
    xa = 1.8
    for y in (y0, y1, (y0 + y1) / 2):
        O._rond(lot, 'gare_metal', (xa, y, H), (xa, y, H + 4.6), 0.08, 0.08, n, k=0.02)
        O._rond(lot, 'gare_metal', (xa - 1.6, y, H), (xa - 1.6, y, H + 4.0), 0.07, 0.07, n, k=0.02)
    O._rond(lot, 'abri_verre', (xa + 0.02, y0, H + 2.3), (xa + 0.02, y1, H + 2.3), 0.03, 2.0, n, k=0.02)
    for y in (y0, y1):
        lot.cube('abri_verre', (1.5, 0.05, 3.2), (xa - 0.8, y, H + 2.3), 0.02)
    roof = Matrix.Rotation(-0.18, 3, 'Y')
    lot.cube('abri_toit', (2.6, y1 - y0 + 0.6, 0.18), (xa - 0.75, (y0 + y1) / 2, H + 4.45), 0.06, roof)
    lot.cube('abri', (2.7, y1 - y0 + 0.7, 0.08), (xa - 0.75, (y0 + y1) / 2, H + 4.33), 0.03, roof)
    # Banc sous l'abri.
    for y in (y0 + 1.2, y1 - 1.2):
        O._rond(lot, 'gare_metal', (xa - 0.45, y, H), (xa - 0.45, y, H + 0.9), 0.06, 0.06, n, k=0.02)
    for k in range(3):
        O._rond(lot, 'banc', (xa - 0.62 + k * 0.17, y0 + 0.8, H + 0.92), (xa - 0.62 + k * 0.17, y1 - 0.8, H + 0.92), 0.07, 0.04,
                n, k=0.015)
    for k in range(2):
        O._rond(lot, 'banc', (xa - 0.15, y0 + 0.8, H + 1.2 + k * 0.25), (xa - 0.15, y1 - 0.8, H + 1.2 + k * 0.25), 0.03,
                0.08, n, k=0.015)
    # Lampadaires.
    for y in (-7.6, 4.6):
        O._cyl(lot, 'gare_metal', (1.2, y, H), (1.2, y, H + 6.0), 0.08, n)
        O._rond(lot, 'gare_metal', (1.2, y, H + 6.0), (0.4, y, H + 6.25), 0.05, 0.05, n, k=0.015)
        O._rond(lot, 'gare_metal', (0.3, y, H + 6.1), (0.3, y, H + 6.35), 0.22, 0.22, n, k=0.05)
        O._rond(lot, 'lampe', (0.3, y, H + 5.98), (0.3, y, H + 6.1), 0.16, 0.16, n, k=0.04)
    # Poubelle.
    O._cyl(lot, 'abri', (1.9, 3.4, H), (1.9, 3.4, H + 1.4), 0.32, n)
    O._cyl(lot, 'gare_metal', (1.9, 3.4, H + 1.4), (1.9, 3.4, H + 1.5), 0.34, n)
    lot.finir()
    O._brillant()
    T.adoucir(coll)


MODELES = {
    'rail_droit': rail_droit,
    'rail_croisement': rail_croisement,
    'rail_virage': rail_virage,
    'rail_virage_large': rail_virage_large,
    'rail_virage_tres_large': rail_virage_tres_large,
    'rail_virage_grand': rail_virage_grand,
    'rail_virage_geant': rail_virage_geant,
    'rail_virage_45': rail_virage_45,
    'rail_virage_45_b': rail_virage_45_b,
    'rail_rampe': rail_rampe,
    'rail_aiguillage_d_droit': rail_aiguillage_d_droit,
    'rail_aiguillage_d_devie': rail_aiguillage_d_devie,
    'rail_aiguillage_g_droit': rail_aiguillage_g_droit,
    'rail_aiguillage_g_devie': rail_aiguillage_g_devie,
    'locomotive_vapeur': locomotive_vapeur,
    'locomotive_electrique': locomotive_electrique,
    'wagon_fret': wagon_fret,
    'wagon_citerne': wagon_citerne,
    'gare': gare,
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
