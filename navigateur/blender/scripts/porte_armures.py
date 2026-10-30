"""Armures portées, paliers 1 à 5 (appelé par `porte.py`, mêmes conventions : repère du personnage homme en mètres, Z en
haut, avant vers -Y ; pièces rangées par os `<os>__<pièce>_<teinte>` ; faces `teinte` = couleur de l'objet).

Les armures sont faites de plaques superposées posées sur une sous-couche sombre :
- tronc : gorgerin en deux lames, plastron bombé à arête centrale, ventre en lames qui se chevauchent, plaques de flanc,
  dossière à lames, ceinture ; épaulières à plusieurs lames ;
- bras : canon de bras, cubitière (coude) à ailette, avant-bras effilé à arête, manchette ;
- jambes : tassettes qui pendent de la ceinture, cuissot, genouillère à ailette, grève à arête, mollet sombre ;
- pieds : solerets en lames sur le dessus du pied, talon, semelle épaisse ;
- casque : coque, nervure, oreillettes, protège-nuque en lames, et une face propre au palier.
Le palier change les finitions : 1 cuir et rivets, 2 acier à liserés clairs et rivets, 3 composite à bandes orange,
4 blindage lourd à lumières bleues, 5 nano à lignes lumineuses cyan.
"""

import math

import bmesh
from mathutils import Vector

import outils as O
import terra as T

TEINTE = 'teinte'
T.PALETTE.setdefault('acier_lisere', '#7c8591')
X = Vector((1, 0, 0))
Z = Vector((0, 0, 1))

#: Finitions par palier : liseré des plaques, sous-couche, accent, lumière (None : pas de lumière), rivets.
STYLE = {
    1: dict(liseré='sac_cuir', dessous='sac_cuir', accent='sac_cuir', lumiere=None, rivets=True, lames=2, epaule=2),
    2: dict(liseré='rivet', dessous='teinte_sombre', accent='rivet', lumiere=None, rivets=True, lames=3, epaule=3),
    3: dict(liseré='teinte_sombre', dessous='teinte_sombre', accent='composite_bande', lumiere=None, rivets=False, lames=3,
            epaule=2),
    4: dict(liseré='acier_lisere', dessous='teinte_sombre', accent='rivet', lumiere='lueur', rivets=True, lames=3, epaule=3),
    5: dict(liseré='nano_lueur', dessous='teinte_sombre', accent='nano_lueur', lumiere='nano_lueur', rivets=False, lames=4,
            epaule=2),
}


# --- Outils de forme -------------------------------------------------------------------------------------------------


def coquille(lot, mat, sections, a0, a1, ep=0.008, m=10):
    """Plaque courbe (une part de manchon) : sections horizontales (z, cx, cy, demi-largeur X, demi-profondeur Y), entre
    les angles a0 et a1 (radians ; 0 = devant -Y, positif vers +X, pi = dos), épaisseur ep vers l'intérieur.

    Bords nets (le style doux arrondit les faces, les arêtes de plaque restent visibles)."""
    tmp = bmesh.new()
    rangs_ext, rangs_int = [], []
    for z, cx, cy, a, b in sections:
        ext, inn = [], []
        for i in range(m + 1):
            t = a0 + (a1 - a0) * i / m
            ext.append(tmp.verts.new((cx + a * math.sin(t), cy - b * math.cos(t), z)))
            inn.append(tmp.verts.new((cx + (a - ep) * math.sin(t), cy - (b - ep) * math.cos(t), z)))
        rangs_ext.append(ext)
        rangs_int.append(inn)
    for r0, r1, q0, q1 in zip(rangs_ext, rangs_ext[1:], rangs_int, rangs_int[1:]):
        for i in range(m):
            tmp.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i])).smooth = True
            tmp.faces.new((q0[i + 1], q0[i], q1[i], q1[i + 1])).smooth = True
    for rang_e, rang_i in ((rangs_ext[0], rangs_int[0]), (rangs_ext[-1], rangs_int[-1])):  # bords haut et bas
        for i in range(m):
            tmp.faces.new((rang_e[i], rang_e[i + 1], rang_i[i + 1], rang_i[i]))
    for i in (0, m):  # bords des côtés
        for k in range(len(sections) - 1):
            tmp.faces.new((rangs_ext[k][i], rangs_ext[k + 1][i], rangs_int[k + 1][i], rangs_int[k][i]))
    bmesh.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def manchon(lot, mat, sections, n=3, bouts=(False, False)):
    """Manchon à section elliptique (comme les plaques : il ne dépasse jamais d'une plaque de mêmes rayons), épais de
    2 cm vers l'intérieur : sections (z, cx, cy, a, b). `n`, `bouts` : gardés pour la compatibilité."""
    coquille(lot, mat, sections, -math.pi, math.pi, 0.02, 24)


def dome(lot, mat, c, r, coupe=None, finesse=2):
    """Ellipsoïde (centre c, rayons r) ; `coupe` : ne garde que le dessus (z relatif > coupe, de -1 à 1)."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=finesse, radius=1.0)
    if coupe is not None:
        bmesh.ops.delete(tmp, geom=[v for v in tmp.verts if v.co.z < coupe], context='VERTS')
    for v in tmp.verts:
        v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
    for f in tmp.faces:
        f.smooth = True
    T._verse(tmp, lot.bms.setdefault(mat, bmesh.new()))


def rivet(lot, p, normale, r=0.007):
    """Rivet (petit dôme clair) posé en p, tourné vers `normale`."""
    p, nrm = Vector(p), Vector(normale).normalized()
    O._cyl(lot, 'rivet', tuple(p - nrm * 0.002), tuple(p + nrm * 0.004), r, 2, k=r * 0.4)


def point_sur(cx, cy, a, b, t, z):
    """Point de l'ellipse (cx, cy, a, b) à l'angle t, et sa normale horizontale."""
    p = Vector((cx + a * math.sin(t), cy - b * math.cos(t), z))
    nrm = Vector((math.sin(t) / a, -math.cos(t) / b, 0)).normalized()
    return p, nrm


def ligne(lot, mat, pts, larg, ep):
    """Ligne posée à plat sur une surface : suite de points (position, normale), largeur `larg`, épaisseur `ep`."""
    secs = []
    for i, (p, nrm) in enumerate(pts):
        q = pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]
        u = q.cross(nrm).normalized()
        secs.append((p, u, nrm, larg, ep, min(larg, ep) * 0.9))
    O._loft(lot, mat, secs, 2)


# --- Casque ---------------------------------------------------------------------------------------------------------


def casque(coll, leger, p, coque_ouverte):
    """Casque du palier p. `coque_ouverte(lot, mat, c, r, garder, ...)` : la coque ellipsoïdale de `porte.py`."""
    st = STYLE[p]
    n = 3 if leger else 5
    tete = T.Lot(coll, 'tete__casque')
    ouvert = p <= 3
    c, r = ((0, 0.008, 1.7), (0.16, 0.172, 0.168)) if ouvert else ((0, 0.0, 1.69), (0.168, 0.19, 0.182))
    ox, oz, oh = 0.125, 1.655, 0.125

    def garder(q):
        if not ouvert:
            return q.z > 1.55
        dx, dz = q.x / ox, (q.z - oz) / oh
        return not (q.y < 0.0 and dx * dx + dz * dz < 1.0) and q.z > 1.57
    coque_ouverte(tete, TEINTE, c, r, garder)
    if ouvert:
        # Bord roulé autour de l'ouverture du visage (cache la découpe de la coque).
        bord = []
        for k in range(41):
            a = 2 * math.pi * k / 40
            x, z = ox * math.sin(a), oz + oh * math.cos(a)
            q = 1 - (x / r[0]) ** 2 - ((z - c[2]) / r[2]) ** 2
            if z > 1.575 and q > 0:
                bord.append(Vector((x, c[1] - r[1] * math.sqrt(q), z)))
        for a_, b_ in zip(bord, bord[1:]):
            d = (b_ - a_) * 0.15
            O._cyl(tete, st['liseré'] if p != 1 else TEINTE, tuple(a_ - d), tuple(b_ + d), 0.011, 3, k=0.0)
    # Nervure du front à la nuque (à plat, pas de crête).
    pts = []
    for k in range(17):
        t = math.radians(50 + 125 * k / 16)
        pts.append((Vector((0, c[1] - (r[1] + 0.002) * math.cos(t), c[2] + (r[2] + 0.002) * math.sin(t))),
                    Vector((0, -math.cos(t) / r[1], math.sin(t) / r[2])).normalized()))
    ligne(tete, st['accent'] if p == 3 else (st['liseré'] if p != 1 else TEINTE), pts, 0.018 if p != 3 else 0.026,
          0.006 if p != 5 else 0.003)
    # Protège-nuque : lames qui descendent derrière.
    for k in range(2 if p != 5 else 1):
        z0 = 1.6 - k * 0.045
        coquille(tete, TEINTE, [(z0 - 0.05, c[0], c[1] + 0.012, r[0] * 0.92 + 0.01 * k, r[1] * 0.9 + 0.01 * k),
                                (z0, c[0], c[1], r[0] * 0.95 + 0.006 * k, r[1] * 0.95 + 0.006 * k)],
                 math.radians(110), math.radians(250), 0.008, 12)
        coquille(tete, st['liseré'], [(z0 - 0.056, c[0], c[1] + 0.012, r[0] * 0.92 + 0.012 * k, r[1] * 0.9 + 0.012 * k),
                                      (z0 - 0.046, c[0], c[1] + 0.011, r[0] * 0.92 + 0.012 * k, r[1] * 0.9 + 0.012 * k)],
                 math.radians(112), math.radians(248), 0.004, 12)
    # Oreillettes rondes.
    for sx in (-1, 1):
        x = sx * (r[0] + 0.004)
        O._cyl(tete, st['dessous'] if p != 1 else 'sac_cuir', (x - sx * 0.012, 0.01, 1.65), (x + sx * 0.012, 0.01, 1.65),
               0.045, n + 1, k=0.006)
        O._cyl(tete, TEINTE, (x + sx * 0.008, 0.01, 1.65), (x + sx * 0.016, 0.01, 1.65), 0.032, n + 1, k=0.004)
        if st['lumiere']:
            O._cyl(tete, st['lumiere'], (x + sx * 0.014, 0.01, 1.65), (x + sx * 0.019, 0.01, 1.65), 0.012, n)
        elif st['rivets']:
            rivet(tete, (x + sx * 0.016, 0.01, 1.65), (sx, 0, 0), 0.008)
    if p == 1:
        # Calotte de cuir : bandes croisées rivetées, jugulaire sous le menton.
        for a in range(-40, 221, 26):
            t = math.radians(a)
            q, nrm = point_sur(c[0], c[1], r[0], r[1], t + math.pi, 1.6)
            if q.y < -0.05:
                continue
            rivet(tete, q + nrm * 0.002, nrm, 0.008)
        for sx in (-1, 1):
            O._cyl(tete, 'sac_cuir', (sx * 0.13, 0.0, 1.62), (sx * 0.07, -0.09, 1.52), 0.008, 2)
        O._rond(tete, 'sac_cuir', (-0.07, -0.09, 1.52), (0.07, -0.09, 1.52), 0.008, 0.006, 2, k=0.002)
    elif p == 2:
        # Bassinet : visière relevée au-dessus du front (fentes), joues articulées.
        coquille(tete, TEINTE, [(1.765, 0, 0.004, r[0] + 0.01, r[1] + 0.012), (1.81, 0, 0.004, r[0] * 0.86, r[1] * 0.86)],
                 math.radians(-80), math.radians(80), 0.008, 14)
        for k in range(2):
            z = 1.775 + k * 0.018
            pts = [point_sur(0, 0.004, r[0] + 0.012 - k * 0.02, r[1] + 0.014 - k * 0.022, math.radians(a), z)
                   for a in range(-55, 56, 10)]
            ligne(tete, 'teinte_sombre', [(q + nn * 0.002, nn) for q, nn in pts], 0.004, 0.003)
        for sx in (-1, 1):
            coquille(tete, TEINTE, [(1.53, sx * 0.015, 0.0, r[0] - 0.005, r[1] - 0.01),
                                    (1.66, 0, 0.004, r[0] + 0.006, r[1] + 0.008)],
                     math.radians(sx * 40) if sx > 0 else math.radians(-95), math.radians(95) if sx > 0 else math.radians(-40),
                     0.008, 8)
            rivet(tete, (sx * (r[0] + 0.008), -0.06, 1.66), (sx, -0.3, 0), 0.008)
    elif p == 3:
        # Composite : garde de mâchoire autour du bas du visage, visière fumée relevée, bande orange.
        coquille(tete, TEINTE, [(1.53, 0, -0.005, r[0] * 0.9, r[1] * 0.92), (1.585, 0, 0.0, r[0] + 0.006, r[1] + 0.008)],
                 math.radians(-120), math.radians(120), 0.009, 18)
        coquille(tete, 'composite_bande', [(1.583, 0, 0.0, r[0] + 0.007, r[1] + 0.009), (1.592, 0, 0.0, r[0] + 0.007,
                                                                                      r[1] + 0.009)],
                 math.radians(-118), math.radians(118), 0.004, 18)
        coquille(tete, 'visiere', [(1.775, 0, 0.004, r[0] + 0.012, r[1] + 0.014), (1.82, 0, 0.004, r[0] * 0.85, r[1] * 0.85)],
                 math.radians(-70), math.radians(70), 0.006, 14)
    else:
        # Casques fermés : plaque de visage, deux yeux, grille de respiration (4) / fentes lumineuses (5).
        face = [(1.58, 0, -0.01, r[0] * 0.82, r[1] * 0.9), (1.66, 0, 0.0, r[0] + 0.008, r[1] + 0.01),
                (1.74, 0, 0.0, r[0] + 0.006, r[1] + 0.008)]
        coquille(tete, st['dessous'] if p == 4 else TEINTE, face, math.radians(-75), math.radians(75), 0.01, 16)
        if p == 4:
            for sx in (-1, 1):
                q, nrm = point_sur(0, 0.0, r[0] + 0.012, r[1] + 0.014, math.radians(sx * 24), 1.69)
                O._cyl(tete, TEINTE, tuple(q - nrm * 0.01), tuple(q + nrm * 0.012), 0.036, n + 1, k=0.006)  # bague
                O._cyl(tete, 'visiere', tuple(q + nrm * 0.008), tuple(q + nrm * 0.016), 0.026, n + 1, k=0.004)  # verre
                O._cyl(tete, 'lueur', tuple(q + nrm * 0.016), tuple(q + nrm * 0.018), 0.01, n)
            # Grille de respiration : museau avancé, fentes horizontales, deux filtres sur les côtés.
            O._loft(tete, TEINTE, [((0, -0.19, 1.575), X, Z, 0.045, 0.02, 0.018), ((0, -0.205, 1.61), X, Z, 0.055, 0.03, 0.025),
                                   ((0, -0.19, 1.645), X, Z, 0.04, 0.02, 0.018)], n)
            for k in range(3):
                z = 1.595 + k * 0.016
                O._rond(tete, 'teinte_sombre', (-0.035, -0.234, z), (0.035, -0.234, z), 0.004, 0.004, 2, k=0.0015)
            for sx in (-1, 1):
                O._cyl(tete, st['dessous'], (sx * 0.06, -0.18, 1.6), (sx * 0.1, -0.15, 1.585), 0.022, n + 1, k=0.005)
                O._cyl(tete, 'rivet', (sx * 0.098, -0.152, 1.586), (sx * 0.104, -0.147, 1.584), 0.016, n)
        else:
            # Nano : visage lisse et sombre, deux fentes lumineuses en amande inclinées, liserés qui filent vers l'arrière.
            for sx in (-1, 1):
                pts = []
                for k in range(6):
                    a = math.radians(sx * (9 + 30 * k / 5))
                    z = 1.68 + 0.016 * (k / 5)  # fente droite qui remonte vers l'extérieur
                    q, nrm = point_sur(0, 0.0, r[0] + 0.012, r[1] + 0.014, a, z)
                    pts.append((q, nrm))
                ligne(tete, 'nano_lueur', pts, 0.013, 0.004)
                pts = [point_sur(0, 0.0, r[0] + 0.004, r[1] + 0.004, math.radians(sx * (60 + 80 * k / 8)), 1.63 + 0.04 * k / 8)
                       for k in range(9)]
                ligne(tete, 'nano_lueur', pts, 0.005, 0.003)
            for k in range(2):
                z = 1.6 + k * 0.02
                pts = [point_sur(0, 0.0, r[0] + 0.012, r[1] + 0.012, math.radians(a), z)
                       for a in range(-22, 23, 11)]
                ligne(tete, 'teinte_sombre', pts, 0.004, 0.003)
    return tete


# --- Plastron (tronc et bras) ------------------------------------------------------------------------------------------


def _epauliere(lot, sx, st, n):
    """Épaulière en lames superposées : dôme sur l'épaule, puis des lames qui descendent sur le haut du bras."""
    x = sx * 0.225
    dome(lot, st['dessous'], (x, 0.0, 1.385), (0.1, 0.1, 0.075))  # dessous : cache l'épaule de la combinaison
    dome(lot, TEINTE, (x, 0.0, 1.39), (0.105, 0.105, 0.08), coupe=-0.2)
    for k in range(st['epaule']):
        z1 = 1.38 - k * 0.04
        a, b = 0.095 - 0.004 * k, 0.098 - 0.004 * k
        coquille(lot, TEINTE, [(z1 - 0.05, x + sx * 0.025, 0.0, a, b), (z1, x + sx * 0.008, 0.0, a - 0.012, b - 0.012)],
                 -math.pi * 0.9, math.pi * 0.9, 0.008, 18)
        coquille(lot, st['liseré'], [(z1 - 0.056, x + sx * 0.025, 0.0, a + 0.002, b + 0.002),
                                     (z1 - 0.046, x + sx * 0.025, 0.0, a + 0.002, b + 0.002)],
                 -math.pi * 0.88, math.pi * 0.88, 0.004, 18)
    if st['lumiere']:
        q = (x + sx * 0.06, -0.06, 1.42)
        O._cyl(lot, st['lumiere'], q, (x + sx * 0.066, -0.066, 1.424), 0.012, n)
    elif st['rivets']:
        for t in (-0.6, 0.0, 0.6):
            rivet(lot, (x + sx * 0.085 * math.cos(t), 0.085 * math.sin(t) - 0.0, 1.44), (sx * math.cos(t), math.sin(t), 0.5))


def plastron(coll, leger, p):
    st = STYLE[p]
    n = 3 if leger else 5
    bas = T.Lot(coll, 'ventre__plastron')
    haut = T.Lot(coll, 'poitrine__plastron')
    lots = [bas, haut]
    # Sous-couche (gambison) sur tout le tronc.
    manchon(bas, st['dessous'], [(0.95, 0, 0.0, 0.192, 0.115), (1.1, 0, 0.005, 0.205, 0.117), (1.27, 0, 0.008, 0.218, 0.127)],
            n, (True, False))
    manchon(haut, st['dessous'], [(1.26, 0, 0.008, 0.218, 0.127), (1.37, 0, 0.005, 0.222, 0.127), (1.44, 0, 0.0, 0.186, 0.102),
                                  (1.47, 0, 0.0, 0.11, 0.084)], n)
    # Gorgerin : deux lames autour du cou.
    for k, (z0, z1, a, b) in enumerate(((1.44, 1.49, 0.12, 0.1), (1.48, 1.56, 0.088, 0.078))):
        coquille(haut, TEINTE, [(z0, 0, 0.0, a + 0.03, b + 0.02), (z1, 0, 0.0, a, b)], -math.pi, math.pi, 0.008, 20)
        coquille(haut, st['liseré'], [(z0 - 0.004, 0, 0.0, a + 0.034, b + 0.024), (z0 + 0.006, 0, 0.0, a + 0.033, b + 0.023)],
                 -math.pi, math.pi, 0.004, 20)
    # Plastron bombé, en deux moitiés autour d'une arête centrale.
    for sx in (-1, 1):
        a0, a1 = (0.02, 1.25) if sx > 0 else (-1.25, -0.02)
        coquille(haut, TEINTE, [(1.22, 0, 0.0, 0.228, 0.142), (1.32, 0, -0.004, 0.232, 0.15), (1.4, 0, -0.002, 0.222, 0.14),
                                (1.45, 0, 0.0, 0.16, 0.115)], a0, a1, 0.01, 12)
        coquille(haut, st['liseré'], [(1.214, 0, 0.0, 0.23, 0.144), (1.226, 0, 0.0, 0.23, 0.144)],
                 a0, a1, 0.004, 12)
    coquille(haut, st['liseré'] if p != 3 else st['accent'], [(1.25, 0, -0.004, 0.23, 0.145), (1.32, 0, -0.008, 0.236, 0.156),
                                                            (1.42, 0, -0.004, 0.222, 0.14)],
             -0.06, 0.06, 0.006, 2)  # arête
    # Ventre : lames qui se chevauchent (la plus haute par-dessus).
    zl = [1.25 - k * (0.27 / st['lames']) for k in range(st['lames'] + 1)]
    for k in range(st['lames']):
        z1, z0 = zl[k] + 0.012, zl[k + 1]
        g = 0.006 * (st['lames'] - k)
        coquille(bas, TEINTE, [(z0, 0, 0.0, 0.2 + g, 0.122 + g), (z1, 0, 0.002, 0.212 + g, 0.13 + g)], -1.15, 1.15, 0.009, 14)
        coquille(bas, st['liseré'], [(z0 - 0.004, 0, 0.0, 0.202 + g, 0.124 + g), (z0 + 0.006, 0, 0.0, 0.202 + g, 0.124 + g)],
                 -1.14, 1.14, 0.004, 14)
        if st['rivets']:
            for t in (-0.9, 0.9):
                q, nrm = point_sur(0, 0.0, 0.206 + g, 0.127 + g, t, (z0 + z1) / 2)
                rivet(bas, q, nrm)
    # Plaques de flanc et dossière à lames.
    for sx in (-1, 1):
        a0, a1 = (1.15, 1.95) if sx > 0 else (-1.95, -1.15)
        coquille(bas, TEINTE, [(0.99, 0, 0.0, 0.206, 0.128), (1.27, 0, 0.006, 0.228, 0.138)], a0, a1, 0.008, 8)
    for k in range(4):
        z1 = 1.44 - k * 0.11
        g = 0.004 * (3 - k)
        coquille(haut if z1 > 1.27 else bas, TEINTE, [(z1 - 0.12, 0, 0.006, 0.226 + g, 0.136 + g),
                                                       (z1, 0, 0.008, 0.232 + g, 0.142 + g)],
                 math.pi - 1.25, math.pi + 1.25, 0.008, 14)
        coquille(haut if z1 > 1.27 else bas, st['liseré'], [(z1 - 0.124, 0, 0.006, 0.228 + g, 0.138 + g),
                                                             (z1 - 0.114, 0, 0.006, 0.228 + g, 0.138 + g)],
                 math.pi - 1.23, math.pi + 1.23, 0.004, 14)
    # Ceinture.
    manchon(bas, 'sac_cuir' if p <= 2 else 'teinte_sombre', [(0.95, 0, 0.0, 0.198, 0.122), (0.99, 0, 0.0, 0.198, 0.122)], n,
            (True, True))
    O._rond(bas, 'boucle' if p <= 2 else (st['lumiere'] or st['accent']), (-0.03, -0.124, 0.97), (0.03, -0.124, 0.97),
            0.004, 0.022, 2, k=0.002)
    # Détails propres au palier sur le plastron.
    if p == 1:
        for sx in (-1, 1):  # sangles croisées
            pts = [point_sur(0, 0.0, 0.234, 0.152, t, 1.42 - 0.14 * (t * sx + 1.0) / 2.0) for t in
                   [sx * (-1.0 + 2.0 * k / 10) for k in range(11)]]
            ligne(haut, 'sac_cuir', pts, 0.012, 0.004)
    elif p == 2:
        for t in (-0.9, -0.5, 0.5, 0.9):
            q, nrm = point_sur(0, -0.004, 0.233, 0.152, t, 1.33)
            rivet(haut, q, nrm)
    elif p == 3:
        for sx in (-1, 1):
            pts = [point_sur(0, -0.004, 0.235, 0.153, sx * (0.25 + 0.8 * k / 8), 1.38 - 0.06 * k / 8) for k in range(9)]
            ligne(haut, 'composite_bande', pts, 0.012, 0.003)
    elif p == 4:
        q, nrm = point_sur(0, -0.004, 0.234, 0.154, 0.0, 1.33)
        O._cyl(haut, st['dessous'], tuple(q - nrm * 0.004), tuple(q + nrm * 0.012), 0.038, n + 2, k=0.005)
        O._cyl(haut, 'lueur', tuple(q + nrm * 0.008), tuple(q + nrm * 0.016), 0.026, n + 2, k=0.005)
        for sx in (-1, 1):
            pts = [point_sur(0, -0.004, 0.234, 0.153, sx * (0.32 + 0.7 * k / 8), 1.36 + 0.05 * k / 8) for k in range(9)]
            ligne(haut, 'lueur', pts, 0.005, 0.003)
    else:
        q, nrm = point_sur(0, -0.004, 0.234, 0.154, 0.0, 1.33)
        dome(haut, 'nano_lueur', tuple(q), (0.026, 0.012, 0.03))
        for sx in (-1, 1):
            for dz, a1 in ((0.05, 1.0), (-0.04, 0.9)):
                pts = [point_sur(0, -0.004, 0.235, 0.154, sx * (0.12 + a1 * k / 8), 1.33 + dz * k / 8) for k in range(9)]
                ligne(haut, 'nano_lueur', pts, 0.004, 0.003)
    # Épaulières et bras.
    for sx in (-1, 1):
        _epauliere(haut, sx, st, n)
        x = sx * 0.25
        s_ = 'g' if sx > 0 else 'd'
        bras = T.Lot(coll, f'bras_{s_}__plastron')
        avb = T.Lot(coll, f'avantbras_{s_}__plastron')
        manchon(bras, st['dessous'], [(1.34, x, 0.0, 0.064, 0.062), (1.05, x + sx * 0.005, 0.0, 0.058, 0.057)], n)
        coquille(bras, TEINTE, [(1.12, x + sx * 0.004, 0.0, 0.068, 0.066), (1.3, x, 0.0, 0.072, 0.07)], -math.pi * 0.85,
                 math.pi * 0.85, 0.008, 14)  # canon de bras
        coquille(bras, st['liseré'], [(1.114, x + sx * 0.004, 0.0, 0.07, 0.068), (1.124, x + sx * 0.004, 0.0, 0.07, 0.068)],
                 -math.pi * 0.83, math.pi * 0.83, 0.004, 14)
        # Cubitière : dôme au coude et ailette sur l'extérieur.
        dome(avb, st['dessous'], (x + sx * 0.005, 0.0, 1.1), (0.062, 0.062, 0.058))
        dome(avb, TEINTE, (x + sx * 0.008, 0.02, 1.1), (0.066, 0.05, 0.062))
        coquille(avb, TEINTE, [(1.06, x + sx * 0.01, 0.01, 0.072, 0.07), (1.14, x + sx * 0.01, 0.01, 0.074, 0.072)],
                 math.radians(sx * 50) if sx > 0 else math.radians(-130), math.radians(130) if sx > 0 else math.radians(-50),
                 0.007, 8)
        # Avant-bras effilé à arête, manchette.
        manchon(avb, st['dessous'], [(1.1, x + sx * 0.005, -0.002, 0.058, 0.057), (0.88, x + sx * 0.01, -0.01, 0.054, 0.054)], n)
        coquille(avb, TEINTE, [(0.9, x + sx * 0.01, -0.01, 0.06, 0.06), (1.06, x + sx * 0.006, -0.004, 0.068, 0.066)],
                 -math.pi * 0.95, math.pi * 0.95, 0.008, 16)
        pts = [point_sur(x + sx * 0.008, -0.007, 0.064 + 0.006 * k / 6, 0.063 + 0.005 * k / 6, sx * math.pi / 2, 0.9 + 0.16 * k / 6)
               for k in range(7)]
        ligne(avb, st['liseré'] if p != 3 else st['accent'], pts, 0.006, 0.004)
        coquille(avb, st['liseré'], [(0.865, x + sx * 0.01, -0.012, 0.064, 0.064), (0.9, x + sx * 0.01, -0.01, 0.064, 0.064)],
                 -math.pi, math.pi, 0.006, 16)
        if st['lumiere']:
            q, nrm = point_sur(x + sx * 0.008, -0.006, 0.066, 0.065, sx * math.pi / 2 - sx * 0.6, 0.98)
            O._cyl(avb, st['lumiere'], tuple(q - nrm * 0.003), tuple(q + nrm * 0.004), 0.011, n)
        lots += [bras, avb]
    return lots


# --- Jambières ----------------------------------------------------------------------------------------------------------


def jambieres(coll, leger, p):
    st = STYLE[p]
    n = 3 if leger else 5
    bassin = T.Lot(coll, 'bassin__jambieres')
    lots = [bassin]
    manchon(bassin, st['dessous'], [(0.84, 0, 0.0, 0.186, 0.112), (0.99, 0, 0.0, 0.184, 0.114)], n)
    manchon(bassin, 'sac_cuir' if p <= 2 else 'teinte_sombre', [(0.95, 0, 0.0, 0.192, 0.12), (0.99, 0, 0.0, 0.192, 0.12)], n,
            (True, True))
    # Braconnière (plaque de bas-ventre) et tassettes qui pendent de la ceinture.
    coquille(bassin, TEINTE, [(0.86, 0, 0.0, 0.17, 0.12), (0.95, 0, 0.0, 0.196, 0.126)], -0.5, 0.5, 0.008, 8)
    coquille(bassin, st['liseré'], [(0.855, 0, 0.0, 0.172, 0.122), (0.865, 0, 0.0, 0.172, 0.122)], -0.49, 0.49, 0.004, 8)
    for sx in (-1, 1):
        x = sx * 0.095
        s = 'g' if sx > 0 else 'd'
        cuisse = T.Lot(coll, f'cuisse_{s}__jambieres')
        jambe = T.Lot(coll, f'jambe_{s}__jambieres')
        # Tassettes : deux lames sur le devant et le côté de la cuisse (suivent la cuisse).
        for k in range(2):
            z1 = 0.95 - k * 0.07
            coquille(cuisse, TEINTE, [(z1 - 0.09, x + sx * 0.006, 0.0, 0.112 + 0.004 * (1 - k), 0.105),
                                      (z1, x + sx * 0.004, 0.0, 0.112 + 0.004 * (1 - k), 0.106)],
                     math.radians(-60) if sx > 0 else math.radians(-110), math.radians(110) if sx > 0 else math.radians(60),
                     0.008, 10)
            coquille(cuisse, st['liseré'], [(z1 - 0.096, x + sx * 0.006, 0.0, 0.114 + 0.004 * (1 - k), 0.107),
                                            (z1 - 0.086, x + sx * 0.006, 0.0, 0.114 + 0.004 * (1 - k), 0.107)],
                     math.radians(-58) if sx > 0 else math.radians(-108), math.radians(108) if sx > 0 else math.radians(58),
                     0.004, 10)
        manchon(cuisse, st['dessous'], [(0.9, x + sx * 0.004, 0.0, 0.1, 0.096), (0.45, x, 0.002, 0.076, 0.07)], n)
        # Cuissot : plaque sur le devant de la cuisse.
        coquille(cuisse, TEINTE, [(0.56, x, 0.0, 0.088, 0.08), (0.78, x + sx * 0.004, 0.0, 0.104, 0.09)], -2.5, 2.5, 0.008, 18)
        coquille(cuisse, st['liseré'], [(0.553, x, 0.0, 0.09, 0.082), (0.563, x, 0.0, 0.09, 0.082)], -2.48, 2.48, 0.004, 18)
        # Genouillère : dôme et ailette extérieure.
        dome(jambe, st['dessous'], (x, -0.01, 0.5), (0.074, 0.07, 0.07))
        dome(jambe, TEINTE, (x, -0.035, 0.5), (0.07, 0.05, 0.068))
        coquille(jambe, TEINTE, [(0.46, x + sx * 0.01, 0.0, 0.082, 0.076), (0.55, x + sx * 0.01, 0.0, 0.084, 0.078)],
                 math.radians(sx * 40) if sx > 0 else math.radians(-130), math.radians(130) if sx > 0 else math.radians(-40),
                 0.007, 8)
        if st['rivets']:
            rivet(jambe, (x, -0.087, 0.5), (0, -1, 0), 0.009)
        elif st['lumiere']:
            O._cyl(jambe, st['lumiere'], (x, -0.083, 0.5), (x, -0.09, 0.5), 0.012, n)
        # Grève : plaque de tibia à arête, mollet sombre derrière.
        manchon(jambe, st['dessous'], [(0.5, x, 0.004, 0.078, 0.074), (0.35, x, 0.01, 0.074, 0.08), (0.16, x, 0.004, 0.062,
                                                                                                    0.066)], n)
        coquille(jambe, TEINTE, [(0.17, x, 0.0, 0.066, 0.066), (0.32, x, 0.004, 0.076, 0.08), (0.45, x, 0.002, 0.08, 0.074)],
                 -2.4, 2.4, 0.008, 18)
        pts = [point_sur(x, 0.0, 0.068 + 0.012 * k / 6, 0.068 + 0.012 * k / 6, 0.0, 0.18 + 0.25 * k / 6) for k in range(7)]
        ligne(jambe, st['liseré'] if p != 3 else st['accent'], pts, 0.006, 0.004)
        if p == 3:
            pts = [point_sur(x, 0.0, 0.1, 0.086, sx * 1.3, 0.6 + 0.16 * k / 6) for k in range(7)]
            ligne(cuisse, 'composite_bande', pts, 0.012, 0.003)
        elif st['lumiere']:
            pts = [point_sur(x, 0.0, 0.1, 0.086, sx * 1.35, 0.6 + 0.15 * k / 6) for k in range(7)]
            ligne(cuisse, st['lumiere'], pts, 0.005, 0.003)
            pts = [point_sur(x, 0.004, 0.078, 0.078, sx * 1.5, 0.22 + 0.18 * k / 6) for k in range(7)]
            ligne(jambe, st['lumiere'], pts, 0.005, 0.003)
        elif p == 1:
            for z, lot, a, b in ((0.82, cuisse, 0.104, 0.1), (0.3, jambe, 0.08, 0.084)):
                manchon(lot, 'sac_cuir', [(z - 0.012, x, 0.0, a, b), (z + 0.012, x, 0.0, a, b)], n, (True, True))
        lots += [cuisse, jambe]
    return lots


# --- Bottes -------------------------------------------------------------------------------------------------------------


def bottes(coll, leger, p):
    st = STYLE[p]
    n = 3 if leger else 5
    lots = []
    for sx in (-1, 1):
        x = sx * 0.09
        s = 'g' if sx > 0 else 'd'
        pied = T.Lot(coll, f'pied_{s}__bottes_armure')
        jambe = T.Lot(coll, f'jambe_{s}__bottes_armure')
        O._rond(pied, st['dessous'], (x, 0.05, 0.05), (x, -0.165, 0.05), 0.062, 0.054, n, k=0.03)
        O._rond(pied, 'semelle' if p != 5 else 'teinte_sombre', (x, 0.065, 0.015), (x, -0.185, 0.015), 0.07, 0.016, n, k=0.008)
        if p == 5:
            O._rond(pied, 'nano_lueur', (x, 0.066, 0.032), (x, -0.186, 0.032), 0.071, 0.003, 2, k=0.001)
        # Solerets : lames sur le dessus du pied, de la cheville aux orteils.
        nl = 4 if p >= 2 else 3
        for k in range(nl):
            y0 = -0.02 - k * 0.04
            secs = [-1.4 + 2.8 * j / 8 for j in range(9)]
            # Lame : arc au-dessus du pied, dans le plan XZ, posé à la profondeur y0.
            tmp_secs = [(y0, 0.066 - 0.003 * k), (y0 - 0.048, 0.062 - 0.004 * k)]
            for (yy0, r0), (yy1, r1) in zip(tmp_secs, tmp_secs[1:]):
                pts0 = [Vector((x + r0 * math.sin(t), yy0, 0.03 + r0 * 0.95 * math.cos(t))) for t in secs]
                pts1 = [Vector((x + r1 * math.sin(t), yy1, 0.03 + r1 * 0.95 * math.cos(t))) for t in secs]
                bm = bmesh.new()
                v0 = [bm.verts.new(q) for q in pts0]
                v1 = [bm.verts.new(q) for q in pts1]
                w0 = [bm.verts.new(q - (q - Vector((x, yy0, 0.03))).normalized() * 0.008) for q in pts0]
                w1 = [bm.verts.new(q - (q - Vector((x, yy1, 0.03))).normalized() * 0.008) for q in pts1]
                for i in range(len(secs) - 1):
                    bm.faces.new((v0[i], v0[i + 1], v1[i + 1], v1[i])).smooth = True
                    bm.faces.new((w0[i + 1], w0[i], w1[i], w1[i + 1]))
                    bm.faces.new((v0[i + 1], v0[i], w0[i], w0[i + 1]))
                    bm.faces.new((v1[i], v1[i + 1], w1[i + 1], w1[i]))
                for i in (0, len(secs) - 1):
                    bm.faces.new((v0[i], v1[i], w1[i], w0[i]))
                bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
                T._verse(bm, pied.bms.setdefault(TEINTE, bmesh.new()))
            if p != 1:
                ligne(pied, st['liseré'], [(Vector((x + (0.067 - 0.004 * k) * math.sin(t), y0 - 0.047, 0.03 + (0.064 - 0.004 * k) * 0.95 * math.cos(t))),
                                            Vector((math.sin(t), 0, math.cos(t)))) for t in [-1.3 + 2.6 * j / 8 for j in range(9)]], 0.003, 0.003)
        dome(pied, TEINTE, (x, 0.045, 0.06), (0.066, 0.05, 0.05))  # talon
        # Tige : jambière basse à arête, revers en haut.
        manchon(jambe, st['dessous'], [(0.06, x, 0.0, 0.068, 0.068), (0.27, x, 0.002, 0.07, 0.074)], n, (True, False))
        coquille(jambe, TEINTE, [(0.06, x, 0.0, 0.074, 0.074), (0.24, x, 0.002, 0.076, 0.08)], -math.pi, math.pi, 0.008, 18)
        coquille(jambe, st['liseré'], [(0.24, x, 0.002, 0.08, 0.084), (0.28, x, 0.002, 0.082, 0.086)], -math.pi, math.pi, 0.008, 18)
        if st['rivets']:
            for t in (-1.2, 1.2):
                q, nrm = point_sur(x, 0.0, 0.075, 0.076, t, 0.15)
                rivet(jambe, q, nrm)
        if st['lumiere']:
            pts = [point_sur(x, 0.0, 0.076, 0.078, sx * 1.57, 0.08 + 0.14 * k / 6) for k in range(7)]
            ligne(jambe, st['lumiere'], pts, 0.005, 0.003)
        if p == 3:
            pts = [point_sur(x, 0.0, 0.077, 0.079, 0.0, 0.1 + 0.12 * k / 6) for k in range(7)]
            ligne(jambe, 'composite_bande', pts, 0.016, 0.003)
        lots += [pied, jambe]
    return lots
