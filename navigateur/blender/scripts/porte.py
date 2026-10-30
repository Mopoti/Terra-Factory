"""Famille « porté » : l'équipement tel qu'il se porte sur le personnage du joueur (style doux).

Chaque modèle est construit dans le repère du personnage (`personnage.py`, en mètres : Z en haut, l'avant vers -Y, pieds à
Z = 0, os aux mêmes places que dans `personnage_homme.glb`), puis agrandi de 2 pour l'export (`T.export_glb` divise par 2).
Ses pièces sont rangées par os : un objet `<os>__<pièce>_<teinte>` suit l'os `<os>` du squelette (`cuisse_g`,
`jambe_d`, `poitrine`, `tete`…) ; le jeu les accroche à ces os (`Avatar.wear`, `src/render/avatarModel.ts`). Les faces
magenta (`teinte`) prennent la couleur de l'objet porté.

Mesures du corps (coupes du modèle homme, m) : tronc ±0,20 en X, de -0,10 (devant) à +0,11 (dos) entre Z = 1,15 et 1,35 ;
tête ±0,125, de Z = 1,56 à 1,82, centre vers (0 ; 0 ; 1,69) ; jambe gauche centrée en X = 0,095, ±0,08 en X et ±0,07 en Y
à mi-cuisse ; pied de Y = -0,145 à +0,035 ; bras centré en X = ±0,25, ±0,05.

Lancer :  blender --background --python blender/scripts/porte.py
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
from mathutils import Vector  # noqa: E402

TEINTE = 'teinte'
TEINTES = {
    'teinte': '#ff00ff',
    'teinte_sombre': '#3a3f45',
    'sac_cuir': '#6b4528',
    'boucle': '#c9b27a',
    'couverture': '#4f7fae',
    'ficelle': '#d9c79a',
    'semelle': '#2c2a28',
    'fermeture': '#c7ccd2',
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
X, Y = Vector((1, 0, 0)), Vector((0, 1, 0))


def _tube(lot, mat, sections, n=3, bouts=(True, True)):
    """Manchon arrondi : sections horizontales (z, cx, cy, demi-largeur X, demi-profondeur Y)."""
    O._loft(lot, mat, [((cx, cy, z), X, Y, a, b, min(a, b) * 0.9) for z, cx, cy, a, b in sections], n, bouts)


def _coque(lot, mat, c, r, garder, finesse=3, interieur='teinte_sombre', ep=0.012):
    """Coque ellipsoïdale (centre c, rayons r) dont on ne garde que les faces où `garder(point)` est vrai ; doublée à
    l'intérieur (`interieur`, normales retournées) pour qu'on ne voie pas à travers par l'ouverture."""
    for mat_, k, retourner in ((mat, 1.0, False), (interieur, 1.0 - ep / min(r), True)):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=finesse, radius=1.0)
        for v in tmp.verts:
            v.co = Vector((c[0] + v.co.x * r[0] * k, c[1] + v.co.y * r[1] * k, c[2] + v.co.z * r[2] * k))
        jeter = [f for f in tmp.faces if not garder(f.calc_center_median())]
        bmesh.ops.delete(tmp, geom=jeter, context='FACES')
        for f in tmp.faces:
            f.smooth = True
        if retourner:
            bmesh.ops.reverse_faces(tmp, faces=list(tmp.faces))
        T._verse(tmp, lot.bms.setdefault(mat_, bmesh.new()))


def _boule_haut(lot, mat, c, r, n):
    """Demi-ellipsoïde (dôme vers le haut) centré en c, rayons r : épaules."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=2, radius=1.0)
    for v in tmp.verts:
        v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
    for f in tmp.faces:
        f.smooth = True
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def _fin(coll, *lots):
    for l in lots:
        l.finir()
    O._echelle(coll, 2.0)  # mètres -> unités du projet (l'export redivise par 2)
    T.adoucir(coll)


# --- Vêtements ---------------------------------------------------------------------------------------------------------


def porte_sac_a_dos(coll, leger=True):
    """Sac à dos porté : corps arrondi de la teinte dans le dos, rabat et poche de cuir, bretelles qui passent sur les
    épaules et descendent devant, couchage roulé au-dessus. Tout suit la poitrine."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'poitrine__sac')
    O._rond(lot, TEINTE, (0, 0.21, 0.98), (0, 0.21, 1.44), 0.16, 0.09, n, k=0.05, r=0.07)
    O._rond(lot, 'sac_cuir', (0, 0.255, 1.43), (0, 0.31, 1.27), 0.15, 0.03, n, k=0.02)  # rabat
    O._rond(lot, TEINTE, (0, 0.3, 1.02), (0, 0.3, 1.2), 0.11, 0.035, n, k=0.025)  # poche
    for sx in (-1, 1):
        x = sx * 0.11
        # Bretelle : du haut du sac, par-dessus l'épaule, puis devant jusqu'au bas des côtes.
        pts = [(x, 0.15, 1.42), (x, 0.06, 1.47), (x, -0.06, 1.44), (x, -0.115, 1.36), (x * 1.05, -0.12, 1.16)]
        for a, b in zip(pts, pts[1:]):
            O._rond(lot, 'sac_cuir', a, b, 0.024, 0.008, n, k=0.004)
        O._rond(lot, 'boucle', (x * 1.05, -0.128, 1.24), (x * 1.05, -0.128, 1.27), 0.03, 0.008, 2, k=0.003)
    O._cyl(lot, 'couverture', (-0.17, 0.2, 1.52), (0.17, 0.2, 1.52), 0.065, n + 1)
    for x in (-0.09, 0.09):
        O._cyl(lot, 'sac_cuir', (x - 0.012, 0.2, 1.52), (x + 0.012, 0.2, 1.52), 0.07, n + 1)
    _fin(coll, lot)


def porte_capuche(coll, leger=True):
    """Capuche portée : coque de la teinte autour de la tête, grande ouverture pour le visage, ourlet ; pèlerine sur les
    épaules (suit la poitrine)."""
    n = 3 if leger else 5
    tete = T.Lot(coll, 'tete__capuche')
    c, r = (0, 0.012, 1.69), (0.15, 0.165, 0.165)
    OX, OZ, OH = 0.138, 1.665, 0.15  # ouverture du visage : demi-largeur, centre et demi-hauteur (large, joues dégagées)

    def garder(p):
        # Ouverture du visage : ellipse sur l'avant (Y < 0), du menton au front.
        dx, dz = p.x / OX, (p.z - OZ) / OH
        return not (p.y < 0.0 and dx * dx + dz * dz < 1.0) and p.z > 1.52
    _coque(tete, TEINTE, c, r, garder)
    m = 40 if leger else 56
    pts = []
    for k in range(m + 1):
        a = 2 * math.pi * k / m
        x, z = OX * math.sin(a), OZ + OH * math.cos(a)
        # Le bord suit la coque : point de l'ellipsoïde au-dessus de (x, z), sur l'avant.
        q = 1 - (x / r[0]) ** 2 - ((z - c[2]) / r[2]) ** 2
        y = c[1] - r[1] * math.sqrt(max(0.0, q))
        if z > 1.53:
            pts.append((x, y, z))
    for a, b in zip(pts, pts[1:]):
        d = (Vector(b) - Vector(a)) * 0.15  # segments qui se chevauchent : ourlet continu
        O._cyl(tete, TEINTE, tuple(Vector(a) - d), tuple(Vector(b) + d), 0.019, 3, k=0.0)
    O._loft(tete, TEINTE, [((0, 0.17, 1.78), X, Y, 0.02, 0.02, 0.02), ((0, 0.19, 1.73), X, Y, 0.035, 0.03, 0.03),
                           ((0, 0.2, 1.67), X, Y, 0.03, 0.02, 0.02)], n)  # petite pointe à l'arrière
    pel = T.Lot(coll, 'poitrine__pelerine')
    _tube(pel, TEINTE, [(1.32, 0, 0.01, 0.23, 0.13), (1.4, 0, 0.01, 0.2, 0.115), (1.46, 0, 0.01, 0.1, 0.085),
                        (1.5, 0, 0.01, 0.075, 0.075)], n, (False, False))
    for sx in (-1, 1):
        O._cyl(pel, 'ficelle', (sx * 0.04, -0.1, 1.47), (sx * 0.05, -0.13, 1.33), 0.006, 2)
    _fin(coll, tete, pel)


def porte_veste(coll, leger=True):
    """Veste portée : buste de la teinte par-dessus la combinaison (ventre et poitrine), col relevé, fermeture éclair
    claire, deux poches ; manches sur le haut des bras et les avant-bras, poignets plus sombres."""
    n = 3 if leger else 5
    bas = T.Lot(coll, 'ventre__veste')
    haut = T.Lot(coll, 'poitrine__veste')
    _tube(bas, TEINTE, [(0.92, 0, 0.0, 0.185, 0.112), (0.95, 0, 0.0, 0.188, 0.115), (1.1, 0, 0.005, 0.2, 0.112),
                        (1.27, 0, 0.008, 0.215, 0.122)], n, (False, False))
    _tube(haut, TEINTE, [(1.26, 0, 0.008, 0.215, 0.122), (1.36, 0, 0.005, 0.218, 0.122), (1.43, 0, 0.0, 0.19, 0.1),
                         (1.46, 0, 0.0, 0.15, 0.088), (1.48, 0, 0.0, 0.08, 0.068)], n, (False, False))
    _tube(bas, 'teinte_sombre', [(0.9, 0, 0.0, 0.19, 0.117), (0.94, 0, 0.0, 0.19, 0.118)], n)  # bas côtelé
    _tube(haut, 'teinte_sombre', [(1.43, 0, 0.0, 0.1, 0.085), (1.52, 0, 0.003, 0.085, 0.075)], n, (False, False))  # col
    O._rond(bas, 'fermeture', (0, -0.118, 0.92), (0, -0.124, 1.26), 0.006, 0.004, 2, k=0.002)
    O._rond(haut, 'fermeture', (0, -0.124, 1.26), (0, -0.07, 1.46), 0.006, 0.004, 2, k=0.002)
    for sx in (-1, 1):
        O._rond(bas, 'teinte_sombre', (sx * 0.11, -0.116, 1.08), (sx * 0.11, -0.12, 0.99), 0.05, 0.005, 2, k=0.002)
        O._rond(bas, TEINTE, (sx * 0.11, -0.122, 1.09), (sx * 0.11, -0.124, 1.065), 0.055, 0.006, 2, k=0.002)
        # Manches : épaule (poitrine), haut du bras, avant-bras et poignet.
        x = sx * 0.25
        O._loft(haut, TEINTE, [((sx * 0.17, 0.0, 1.38), X, Y, 0.06, 0.07, 0.06), ((sx * 0.22, 0.0, 1.37), X, Y, 0.075, 0.075, 0.07),
                               ((x, 0.0, 1.32), X, Y, 0.07, 0.068, 0.065)], n)
        _boule_haut(haut, TEINTE, (sx * 0.215, 0.0, 1.385), (0.095, 0.092, 0.07), n)  # épaule qui couvre l'épaulette
        bras = T.Lot(coll, f'bras_{"g" if sx > 0 else "d"}__veste')
        _tube(bras, TEINTE, [(1.36, x, 0.0, 0.066, 0.064), (1.1, x + sx * 0.005, 0.0, 0.06, 0.059), (1.05, x + sx * 0.005, 0.0, 0.058, 0.057)], n, (False, False))
        avb = T.Lot(coll, f'avantbras_{"g" if sx > 0 else "d"}__veste')
        _boule_haut(avb, TEINTE, (x + sx * 0.005, 0.0, 1.1), (0.064, 0.064, 0.06), n)  # coude
        _tube(avb, TEINTE, [(1.15, x + sx * 0.005, -0.002, 0.06, 0.059), (1.11, x + sx * 0.005, -0.002, 0.06, 0.059), (0.9, x + sx * 0.01, -0.01, 0.056, 0.056)], n,
              (False, False))
        _tube(avb, 'teinte_sombre', [(0.92, x + sx * 0.01, -0.01, 0.06, 0.06), (0.85, x + sx * 0.01, -0.012, 0.057, 0.057)], n)
        bras.finir()
        avb.finir()
    _fin(coll, bas, haut)


def porte_pantalon(coll, leger=True):
    """Pantalon porté : ceinture sombre à passants sur le bassin, cuisses et jambes de la teinte, couture sur le côté,
    bas resserré au-dessus de la cheville."""
    n = 3 if leger else 5
    bassin = T.Lot(coll, 'bassin__pantalon')
    _tube(bassin, TEINTE, [(0.83, 0, 0.0, 0.185, 0.11), (0.96, 0, 0.0, 0.183, 0.112), (1.0, 0, 0.0, 0.183, 0.112)], n,
          (False, False))
    _tube(bassin, 'teinte_sombre', [(0.98, 0, 0.0, 0.188, 0.117), (1.02, 0, 0.0, 0.187, 0.116)], n)  # ceinture
    O._rond(bassin, 'boucle', (0, -0.118, 0.99), (0, -0.118, 1.01), 0.025, 0.006, 2, k=0.002)
    for sx in (-1, 1):
        x = sx * 0.095
        s = 'g' if sx > 0 else 'd'
        cuisse = T.Lot(coll, f'cuisse_{s}__pantalon')
        _tube(cuisse, TEINTE, [(0.9, x + sx * 0.004, 0.0, 0.1, 0.097), (0.7, x + sx * 0.004, 0.0, 0.1, 0.082), (0.5, x, 0.002, 0.08, 0.07),
                               (0.45, x, 0.002, 0.075, 0.068)], n,
              (False, False))
        O._rond(cuisse, 'teinte_sombre', (x + sx * 0.094, 0.0, 0.88), (x + sx * 0.076, 0.0, 0.52), 0.003, 0.004, 2, k=0.001)
        jambe = T.Lot(coll, f'jambe_{s}__pantalon')
        _boule_haut(jambe, TEINTE, (x, -0.006, 0.5), (0.082, 0.078, 0.075), n)  # genou : couvre la pliure
        _tube(jambe, TEINTE, [(0.55, x, 0.002, 0.078, 0.068), (0.51, x, 0.002, 0.078, 0.068), (0.35, x, 0.008, 0.068, 0.074), (0.17, x - sx * 0.004, 0.002,
                                                                                               0.058, 0.06)], n,
              (False, False))
        _tube(jambe, 'teinte_sombre', [(0.19, x - sx * 0.004, 0.002, 0.061, 0.063), (0.15, x - sx * 0.004, 0.002, 0.06,
                                                                                         0.062)], n)
        cuisse.finir()
        jambe.finir()
    _fin(coll, bassin)


def porte_bottes(coll, leger=True):
    """Bottes portées : pied et semelle épaisse sur l'os du pied, tige de la teinte sur le bas de la jambe, lacets."""
    n = 3 if leger else 5
    for sx in (-1, 1):
        x = sx * 0.09
        s = 'g' if sx > 0 else 'd'
        pied = T.Lot(coll, f'pied_{s}__bottes')
        O._rond(pied, TEINTE, (x, 0.05, 0.055), (x, -0.165, 0.055), 0.06, 0.056, n, k=0.03)
        O._rond(pied, 'semelle', (x, 0.06, 0.012), (x, -0.175, 0.012), 0.064, 0.014, n, k=0.008)
        for k in range(3):
            pied.cube('ficelle', (0.07, 0.01, 0.008), (x, -0.06 - k * 0.03, 0.11 - k * 0.013), 0.002)
        jambe = T.Lot(coll, f'jambe_{s}__bottes')
        _tube(jambe, TEINTE, [(0.06, x, 0.0, 0.066, 0.066), (0.22, x, 0.002, 0.066, 0.07), (0.25, x, 0.002, 0.07, 0.074)],
              n)
        pied.finir()
        jambe.finir()
    _fin(coll)


# --- Armures portées (paliers 1 à 5), exosquelette, propulseur -----------------------------------------------------
# Mêmes détails que les modèles d'objet (`equipement.py`) : 1 cuir et rivets, 2 bandes rivetées, 3 composite à bandes
# orange, 4 blindage lourd à visière et lignes lumineuses, 5 nano à visière bombée et liserés cyan.


def _anneau(lot, mat, z, cx, cy, a, b, h, n):
    """Bande horizontale (cerclage) autour d'un membre ou du tronc."""
    _tube(lot, mat, [(z - h / 2, cx, cy, a, b), (z + h / 2, cx, cy, a, b)], n)


def _visiere(lot, mat, c, r, angle, h, zc, ep=0.006, m=16):
    """Visière bombée posée sur la coque (centre c, rayons r) : bande horizontale de demi-hauteur h centrée à la hauteur
    zc, sur l'avant, de -angle à +angle (degrés), qui épouse la courbure du casque."""
    k = math.sqrt(max(0.0, 1 - ((zc - c[2]) / r[2]) ** 2))  # rayon de la coque à cette hauteur
    secs = []
    for i in range(m + 1):
        a = math.radians(-angle + 2 * angle * i / m)
        x, y = c[0] + (r[0] * k + ep) * math.sin(a), c[1] - (r[1] * k + ep) * math.cos(a)
        nrm = Vector((math.sin(a) / r[0], -math.cos(a) / r[1], 0)).normalized()
        secs.append(((x, y, zc), Vector((0, 0, 1)), nrm, h, ep, min(h, ep) * 0.9))
    O._loft(lot, mat, secs, 2)


def _casque_porte(coll, leger, p):
    import porte_armures as A
    _fin(coll, A.casque(coll, leger, p, _coque))


def _plastron_porte(coll, leger, p):
    import porte_armures as A
    _fin(coll, *A.plastron(coll, leger, p))


def _jambieres_porte(coll, leger, p):
    import porte_armures as A
    _fin(coll, *A.jambieres(coll, leger, p))


def _bottes_armure_porte(coll, leger, p):
    import porte_armures as A
    _fin(coll, *A.bottes(coll, leger, p))


def porte_exosquelette(coll, leger=True):
    """Exosquelette porté : ceinture et boîtier sur le bassin, barres métalliques de la teinte le long des cuisses et des
    jambes, moteurs verts aux genoux (sur la jambe), pistons, sangles, plaques sous les pieds."""
    n = 3 if leger else 5
    bassin = T.Lot(coll, 'bassin__exo')
    _anneau(bassin, 'sac_cuir', 0.96, 0, 0.0, 0.19, 0.118, 0.06, n)
    O._rond(bassin, 'exo_metal', (-0.09, 0.13, 0.96), (0.09, 0.13, 0.96), 0.03, 0.05, n, k=0.012)  # boîtier dorsal
    lots = [bassin]
    for sx in (-1, 1):
        x = sx * 0.095
        s = 'g' if sx > 0 else 'd'
        xo = x + sx * 0.105  # barres sur le côté extérieur
        cuisse = T.Lot(coll, f'cuisse_{s}__exo')
        jambe = T.Lot(coll, f'jambe_{s}__exo')
        pied = T.Lot(coll, f'pied_{s}__exo')
        O._cyl(bassin, 'exo_metal', (xo, 0.0, 0.96), (xo, 0.0, 0.9), 0.03, n)
        O._rond(cuisse, TEINTE, (xo, 0.0, 0.9), (xo - sx * 0.01, -0.01, 0.52), 0.016, 0.026, n, k=0.006)
        O._cyl(cuisse, 'rivet', (xo, 0.03, 0.86), (xo - sx * 0.01, 0.025, 0.6), 0.008, 2)  # piston
        O._cyl(cuisse, 'exo_metal', (xo, 0.03, 0.88), (xo, 0.03, 0.74), 0.013, 2)
        _anneau(cuisse, 'sac_cuir', 0.72, x, 0.0, 0.1, 0.088, 0.035, n)
        O._cyl(jambe, 'exo_vert', (xo - sx * 0.035, -0.01, 0.5), (xo + sx * 0.012, -0.01, 0.5), 0.034, n + 1)  # moteur du genou
        O._cyl(jambe, 'exo_metal', (xo - sx * 0.04, -0.01, 0.5), (xo + sx * 0.016, -0.01, 0.5), 0.018, n)
        O._rond(jambe, TEINTE, (xo - sx * 0.012, -0.01, 0.48), (xo - sx * 0.025, 0.0, 0.1), 0.015, 0.024, n, k=0.006)
        _anneau(jambe, 'sac_cuir', 0.3, x, 0.008, 0.076, 0.08, 0.03, n)
        O._rond(pied, 'exo_metal', (x, 0.05, 0.004), (x, -0.16, 0.004), 0.064, 0.008, n, k=0.004)
        O._rond(pied, TEINTE, (xo - sx * 0.035, 0.0, 0.008), (xo - sx * 0.035, 0.0, 0.1), 0.012, 0.02, n, k=0.005)
        lots += [cuisse, jambe, pied]
    _fin(coll, *lots)


def porte_propulseur(coll, leger=True):
    """Propulseur dorsal porté : plaque dans le dos, deux réservoirs de la teinte, tuyères et petite flamme en bas,
    bretelles qui passent sur les épaules, petit écran de charge. Tout suit la poitrine."""
    n = 3 if leger else 5
    lot = T.Lot(coll, 'poitrine__propulseur')
    O._rond(lot, 'exo_metal', (0, 0.14, 1.0), (0, 0.14, 1.44), 0.15, 0.025, n, k=0.012)  # plaque dorsale
    for sx in (-1, 1):
        x = sx * 0.085
        O._cyl(lot, TEINTE, (x, 0.22, 1.02), (x, 0.22, 1.44), 0.072, n + 1, k=0.03)
        O._cyl(lot, 'rivet', (x, 0.22, 1.44), (x, 0.22, 1.49), 0.028, n)
        O._cyl(lot, 'exo_metal', (x, 0.22, 1.02), (x, 0.22, 0.95), 0.048, n + 1, k=0.01)  # tuyère
        O._cyl(lot, 'semelle', (x, 0.22, 0.955), (x, 0.22, 0.94), 0.043, n)
        O._cyl(lot, 'flamme_jet', (x, 0.22, 0.94), (x, 0.22, 0.88), 0.028, n, k=0.012)
        xb = sx * 0.11
        pts = [(xb, 0.13, 1.42), (xb, 0.06, 1.47), (xb, -0.06, 1.44), (xb, -0.115, 1.36), (xb * 1.05, -0.12, 1.16)]
        for a, b in zip(pts, pts[1:]):
            O._rond(lot, 'sac_cuir', a, b, 0.024, 0.008, n, k=0.004)
    O._rond(lot, 'teinte_sombre', (0, 0.29, 1.24), (0, 0.29, 1.34), 0.035, 0.01, n, k=0.004)
    O._rond(lot, 'exo_vert', (0, 0.3, 1.26), (0, 0.3, 1.32), 0.022, 0.004, 2, k=0.002)
    _fin(coll, lot)


def _armures_portees():
    m = {}
    for p in (1, 2, 3, 4, 5):
        m[f'porte_armure{p}_casque'] = lambda c, leger, p=p: _casque_porte(c, leger, p)
        m[f'porte_armure{p}_plastron'] = lambda c, leger, p=p: _plastron_porte(c, leger, p)
        m[f'porte_armure{p}_jambieres'] = lambda c, leger, p=p: _jambieres_porte(c, leger, p)
        m[f'porte_armure{p}_bottes'] = lambda c, leger, p=p: _bottes_armure_porte(c, leger, p)
    return m


MODELES = {f.__name__: f for f in (porte_sac_a_dos, porte_capuche, porte_veste, porte_pantalon, porte_bottes,
                                       porte_exosquelette, porte_propulseur)}
MODELES.update(_armures_portees())


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
    T.save(os.path.join(ROOT, 'blender', 'porte.blend'))


if __name__ == '__main__':
    main()
