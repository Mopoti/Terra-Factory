"""Famille « chimie » : raffinerie (et plus tard presse à plastique, centrifugeuse, tour d'évaporation…).

Style low poly stylisé (voir blender/README.md) : relief et variations de teinte, pas d'image de texture.
Deux niveaux de détail par modèle, dans le même .blend :
- version web (navigateur, légère) : collection `<nom>` -> export/<nom>.glb (copiée dans le jeu) ;
- version Unity (détaillée) : collection `<nom>_unity` -> export/unity/<nom>.glb (non copiée dans le jeu).
Pièces mobiles séparées, avec leur pivot : voir blender/ANIMATIONS.md.

Lancer :  blender --background --python blender/scripts/chimie.py
Produit :  blender/chimie.blend, export/<modèle>.glb et export/unity/<modèle>.glb pour chaque modèle de MODELES
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'blender', 'lib'))
import terra as T  # noqa: E402

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def _tuyau(lot, pts, mat, r, sg, coudes=True):
    """Tuyau à coudes passant par les points `pts` (rayon `r` élargi de 60 % : tuyauterie bien visible en jeu)."""
    r *= 1.6
    pts = [Vector(p) for p in pts]
    for a, b in zip(pts, pts[1:]):
        lot.tube(mat, a, b, r, sg)
    if coudes:
        for p in pts[1:-1]:
            lot.boule(mat, p, r * 1.2)


def _colonne(coll, lot, nom, c, r, z0, z1, mat, seg, bandes, peau='acier_sombre'):
    """Colonne verticale : jupe, fût, bandes de calorifuge, dôme ; `c` = (x, y)."""
    T.tour(coll, f'{nom}_jupe', [(r + 0.02, 0.0), (r + 0.02, z0)], peau, seg, centre=c, dessus=False)
    T.tour(coll, nom, [(r * 0.85, z0 - 0.04), (r, z0 + 0.06), (r, z1), (r * 0.75, z1 + 0.14), (0.08, z1 + 0.22)],
           mat, seg, centre=c)
    for z in bandes:
        T.tour(coll, f'{nom}_bande_{z:.2f}', [(r + 0.012, z - 0.02), (r + 0.012, z + 0.02)], 'acier', seg, centre=c,
               fond=False, dessus=False)
    lot.cube('fonte', (0.5 * r, 0.06, 0.12), (c[0], c[1] - r - 0.02, 0.25), 0)  # trou d'homme de la jupe
    lot.cube('noir', (0.4 * r, 0.065, 0.09), (c[0], c[1] - r - 0.02, 0.25), 0)


def _plateforme(coll, lot, nom, c, r_in, r_out, z, seg, sg, n_poteaux):
    """Plateforme circulaire en caillebotis autour d'une colonne, avec garde-corps jaune."""
    T.tour(coll, f'{nom}', [(r_out, z - 0.04), (r_out, z)], 'acier_sombre', seg, centre=c)
    T.tour(coll, f'{nom}_lisse', [(r_out - 0.03, z + 0.4), (r_out - 0.03, z + 0.43)], 'jaune', seg, centre=c,
           fond=False, dessus=False)
    T.tour(coll, f'{nom}_sous_lisse', [(r_out - 0.03, z + 0.2), (r_out - 0.03, z + 0.22)], 'jaune', seg, centre=c,
           fond=False, dessus=False)
    for k in range(n_poteaux):
        a = 2 * math.pi * (k + 0.5) / n_poteaux
        p = (c[0] + (r_out - 0.03) * math.cos(a), c[1] + (r_out - 0.03) * math.sin(a))
        lot.cube('jaune', (0.03, 0.03, 0.43), (p[0], p[1], z + 0.215), 0)
        q = (c[0] + (r_in + 0.02) * math.cos(a), c[1] + (r_in + 0.02) * math.sin(a))
        lot.barre('acier_sombre', (q[0], q[1], z - 0.25), (p[0], p[1], z - 0.03), 0.04, 0)  # console


def raffinerie_t3(coll, leger=True):
    """Raffinerie T3 (électrique, alimentée en pétrole brut) : 3 x 3 cases, 5,2 unités max (2,6 m). Sortie devant (-Y).

    Grande colonne de distillation (jupe, bandes de calorifuge, deux plateformes à garde-corps jaunes, échelle à
    crinoline, feu de balisage) ; colonne de stripage plus fine derrière à droite, reliée par la ligne de tête ;
    four de chauffe en briques devant à droite (regards des brûleurs, flammes, zone de convection, cheminée) ; deux
    échangeurs horizontaux empilés devant à gauche ; bac de produit blanc à droite ; torchère rayée rouge et blanc au
    coin arrière gauche avec sa flamme. Pétrole brut amené par une bride à l'arrière, pompe, ligne vers le four, ligne
    de transfert du four à la colonne, soutirage vers les échangeurs, pompe et bride de produit devant. Armoire
    électrique à gauche.
    Pièces mobiles : flammes `flamme_` / `coeur_` (torchère et brûleurs du four, vacillent comme celles du fourneau).
    Tout reste dans l'emprise 3 x 3 (de -1,5 à 1,5) et entre Z = 0 et Z = 5,2.
    """
    rnd = random.Random(17)
    bv = 0.0 if leger else 1.0
    seg = 16 if leger else 32
    sg = 8 if leger else 14
    st = 6 if leger else 10  # tuyaux
    lot = T.Lot(coll, 'pieces')
    if leger:
        lot.cube = (lambda f: lambda mat, size, loc, bevel=0.0, rot=None: f(mat, size, loc, 0.0, rot))(lot.cube)

    # --- Châssis (poutrelles posées au sol).
    for y in (-1.15, 0.0, 1.15):
        lot.cube('acier_sombre', (2.9, 0.1, 0.08), (0, y, 0.04), 0)
    for x in (-1.4, 0.0, 1.4):
        lot.cube('acier_sombre', (0.1, 2.4, 0.06), (x, 0, 0.03), 0)

    # --- Colonne de distillation.
    c1, r1, z1 = (-0.45, 0.2), 0.4, 4.4
    _colonne(coll, lot, 'colonne', c1, r1, 0.55, z1, 'gris_clair', seg,
             [1.1, 1.65, 2.75, 3.3, 3.9] if leger else [0.9, 1.2, 1.5, 1.8, 2.5, 2.8, 3.1, 3.4, 4.0, 4.2])
    for z in (1.0, 2.0, 3.0, 4.0):  # piquages et brides
        lot.tube('acier', (c1[0] + r1, c1[1], z), (c1[0] + r1 + 0.1, c1[1], z), 0.08, st)
        lot.tube('acier_sombre', (c1[0] + r1 + 0.1, c1[1], z), (c1[0] + r1 + 0.13, c1[1], z), 0.12, st)
    _plateforme(coll, lot, 'plateforme_basse', c1, r1, 0.75, 2.2, seg, sg, 8)
    _plateforme(coll, lot, 'plateforme_haute', c1, r1, 0.66, 3.8, seg, sg, 7)
    lot.tube('acier', (c1[0], c1[1], z1 + 0.2), (c1[0], c1[1], z1 + 0.42), 0.04, st)  # évent
    lot.boule('rouge', (c1[0], c1[1], z1 + 0.46), 0.05)  # feu de balisage
    # Échelle à crinoline, devant la colonne.
    xe, ye = c1[0], c1[1] - r1 - 0.14
    for dx in (-0.12, 0.12):
        lot.cube('jaune', (0.03, 0.03, 4.0), (xe + dx, ye, 2.0), 0)
    for k in range(int(4.0 / (0.4 if leger else 0.25))):
        lot.cube('jaune', (0.24, 0.02, 0.02), (xe, ye, 0.3 + k * (0.4 if leger else 0.25)), 0)
    for k in range(6 if leger else 10):
        z = 1.0 + k * 3.0 / (5 if leger else 9)
        for a, b in (((-0.18, 0), (-0.18, -0.24)), ((-0.18, -0.24), (0.18, -0.24)), ((0.18, -0.24), (0.18, 0))):
            lot.barre('jaune', (xe + a[0], ye + a[1], z), (xe + b[0], ye + b[1], z), 0.025, 0)
    for dx in (-0.18, 0.18):
        lot.cube('jaune', (0.02, 0.02, 3.0), (xe + dx, ye - 0.24, 2.5), 0)

    # --- Colonne de stripage (derrière à droite) et ligne de tête depuis la grande colonne.
    c2, r2, z2 = (0.6, 0.85), 0.24, 3.2
    _colonne(coll, lot, 'stripeur', c2, r2, 0.45, z2, 'gris_clair', seg, [1.0, 1.8, 2.6] if leger else [0.8, 1.2, 1.6, 2.0, 2.4, 2.8])
    _tuyau(lot, [(c1[0] + r1 * 0.6, c1[1] + r1 * 0.6, 4.3), (c2[0], c1[1] + r1 * 0.6, 4.3), (c2[0], c2[1], 4.3),
                 (c2[0], c2[1], z2 + 0.2)], 'acier', 0.06, st, not leger)
    _tuyau(lot, [(c2[0] + r2, c2[1], 0.6), (1.2, c2[1], 0.6), (1.2, 0.66, 0.6)], 'acier', 0.05, st, not leger)  # vers le bac

    # --- Bac de produit (droite).
    cb = (1.2, 0.35)
    T.tour(coll, 'bac', [(0.28, 0.06), (0.28, 1.1), (0.2, 1.2)], 'blanc', seg, centre=cb)
    for z in (0.4, 0.8):
        T.tour(coll, f'bac_bande_{z}', [(0.29, z - 0.015), (0.29, z + 0.015)], 'gris_clair', seg, centre=cb,
               fond=False, dessus=False)
    lot.cube('rouge', (0.01, 0.2, 0.2), (cb[0] + 0.285, cb[1], 0.6), 0)  # logo de danger
    lot.cube('blanc', (0.012, 0.14, 0.14), (cb[0] + 0.288, cb[1], 0.6), 0, Matrix.Rotation(math.radians(45), 3, 'X'))

    # --- Four de chauffe (devant à droite) : briques, regards des brûleurs et flammes, convection, cheminée.
    cf = Vector((0.75, -0.55))
    T.box(coll, 'four', (0.8, 0.7, 1.3), (cf.x, cf.y, 0.65), 'brique', bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lot.cube('acier_sombre', (0.06, 0.06, 1.32), (cf.x + sx * 0.4, cf.y + sy * 0.35, 0.66), 0)  # cornières
    for z in (0.45, 0.95):
        lot.cube('acier_sombre', (0.84, 0.74, 0.04), (cf.x, cf.y, z), 0)
    for k, x in enumerate((-0.18, 0.18)):  # regards des brûleurs et flammes
        lot.cube('noir', (0.16, 0.02, 0.2), (cf.x + x, cf.y - 0.355, 0.3), 0)
        T.cylinder(coll, f'flamme_four_{k}', 0.05, 0.16, (cf.x + x, cf.y - 0.36, 0.3), 'braise', segments=5, radius_top=0.0)
        T.cylinder(coll, f'coeur_four_{k}', 0.025, 0.1, (cf.x + x, cf.y - 0.37, 0.27), 'flamme', segments=5, radius_top=0.0)
    T.box(coll, 'four_convection', (0.5, 0.45, 0.45), (cf.x, cf.y, 1.52), 'acier_sombre', bevel=0.015)
    T.cylinder(coll, 'four_cheminee', 0.11, 2.1, (cf.x, cf.y, 1.75 + 1.05), 'acier_sombre', segments=sg)
    for z in (2.3, 3.2):
        T.cylinder(coll, f'four_cheminee_bague_{z}', 0.125, 0.04, (cf.x, cf.y, z), 'acier', segments=sg)
    T.cylinder(coll, 'four_cheminee_bout', 0.13, 0.08, (cf.x, cf.y, 3.84), 'rouge', segments=sg)

    # --- Échangeurs horizontaux empilés (devant à gauche).
    for k, z in enumerate((0.32, 0.78)):
        a, b = Vector((-1.32, -0.95, z)), Vector((-0.42, -0.95, z))
        lot.tube('gris_clair', a, b, 0.17, sg)
        for p in (a, b):
            lot.tube('acier_sombre', p - Vector((0.04, 0, 0)) if p.x < -1 else p, p if p.x < -1 else p + Vector((0.04, 0, 0)), 0.2, sg)
        for x in (-1.15, -0.6):
            lot.cube('acier_sombre', (0.08, 0.32, z - 0.17 - (0.0 if k == 0 else 0.32 + 0.17)), (x, -0.95, (z - 0.17 + (0.0 if k == 0 else 0.32 + 0.17)) / 2), 0)  # selles
        lot.tube('acier', (-0.75, -0.95, z + 0.17), (-0.75, -0.95, z + 0.26), 0.07, st)
    # Soutirage de la colonne vers l'échangeur du haut.
    _tuyau(lot, [(c1[0] - 0.13, c1[1] - r1 + 0.02, 1.6), (c1[0] - 0.13 - 0.17, -0.55, 1.6), (-0.75, -0.95, 1.6),
                 (-0.75, -0.95, 1.04)], 'acier', 0.045, st, not leger)

    # --- Pompes, conduites de brut et de produit, brides de raccordement.
    def pompe(p, ax):
        p, ax = Vector(p), Vector(ax)
        lot.cube('acier_sombre', (0.3, 0.3, 0.05), (p.x, p.y, 0.025), 0)
        lot.tube('bleu', p + ax * 0.02 + Vector((0, 0, 0.17)), p + ax * 0.26 + Vector((0, 0, 0.17)), 0.09, sg)  # moteur
        lot.tube('acier_sombre', p - ax * 0.12 + Vector((0, 0, 0.17)), p + Vector((0, 0, 0.17)), 0.11, sg)  # volute
    pompe((0.15, 1.18, 0), (1, 0, 0))
    pompe((0.15, -1.12, 0), (1, 0, 0))

    def bride(p):  # bride ronde de raccordement en bord d'emprise (axe Y), sur un petit support
        p = Vector(p)
        lot.tube('fonte', p - Vector((0, 0.02, 0)), p + Vector((0, 0.02, 0)), 0.13, sg)
        lot.cube('acier_sombre', (0.12, 0.12, p.z - 0.07), (p.x, p.y + (0.06 if p.y < 0 else -0.06), (p.z - 0.07) / 2), 0)
    # Brut : bride à l'arrière -> aspiration de la pompe (côté de la volute) ; refoulement par le dessus -> four.
    bride((-0.06, 1.46, 0.17))
    _tuyau(lot, [(-0.06, 1.46, 0.17), (-0.06, 1.18, 0.17), (0.03, 1.18, 0.17)], 'noir', 0.05, st, not leger)
    _tuyau(lot, [(0.09, 1.18, 0.28), (0.09, 1.18, 1.2), (0.09, -0.72, 1.2), (cf.x - 0.4, -0.72, 1.2)], 'noir', 0.05, st,
           not leger)
    _tuyau(lot, [(cf.x - 0.4, -0.4, 0.9), (0.0, -0.4, 0.9), (c1[0] + 0.3, c1[1] - 0.25, 0.9)], 'acier', 0.07, st,
           not leger)  # ligne de transfert
    # Produit : échangeur -> aspiration de la pompe (côté de la volute) ; refoulement par le dessus -> bride devant.
    _tuyau(lot, [(-0.42, -0.95, 0.32), (-0.12, -0.95, 0.32), (-0.12, -1.12, 0.32), (-0.12, -1.12, 0.17), (0.03, -1.12, 0.17)],
           'acier', 0.045, st, not leger)
    _tuyau(lot, [(0.09, -1.12, 0.28), (0.09, -1.12, 0.45), (0.09, -1.46, 0.45)], 'acier', 0.045, st, not leger)
    bride((0.09, -1.46, 0.45))
    for p in ((0.09, 0.3, 1.2), (0.09, -0.3, 1.2)):  # supports de la conduite de brut
        lot.cube('acier_sombre', (0.06, 0.06, 1.12), (p[0], p[1], 0.56), 0)
    T.cylinder(coll, 'vanne_brut', 0.1, 0.03, (0.09, 0.8, 1.38), 'rouge', segments=sg)
    lot.tube('acier', (0.09, 0.8, 1.28), (0.09, 0.8, 1.38), 0.015, 6)

    # --- Torchère (coin arrière gauche) et sa flamme.
    xt, yt, zt = -1.25, 1.25, 4.75
    lot.cube('acier_sombre', (0.3, 0.3, 0.06), (xt, yt, 0.03), 0)
    n_b = 8
    for k in range(n_b):
        z0, z1_ = 0.06 + k * (zt - 0.06) / n_b, 0.06 + (k + 1) * (zt - 0.06) / n_b
        lot.tube('rouge' if k % 2 == 0 else 'blanc', (xt, yt, z0), (xt, yt, z1_), 0.07, st)
    lot.tube('acier_sombre', (xt, yt, zt), (xt, yt, zt + 0.1), 0.09, st)
    for sx, sy in ((1, -1), (1, 1), (-1, -1)):  # haubans
        lot.barre('acier_sombre', (xt, yt, 2.6), (xt + sx * 0.22, yt + sy * 0.22, 0.03), 0.015, 0)
    _tuyau(lot, [(c1[0] - r1 * 0.7, c1[1] + r1 * 0.7, 4.0), (xt, yt, 4.0)], 'acier', 0.04, st, False)
    T.cylinder(coll, 'flamme_torchere', 0.12, 0.32, (xt, yt, zt + 0.1 + 0.16), 'braise', segments=6, radius_top=0.0)
    T.cylinder(coll, 'coeur_torchere', 0.06, 0.2, (xt, yt, zt + 0.1 + 0.1), 'flamme', segments=6, radius_top=0.0)
    lot.boule('rouge', (xt + 0.1, yt, 3.0), 0.04)  # feu de balisage

    # --- Armoire électrique (gauche).
    xa, ya = -1.25, -0.3
    T.box(coll, 'armoire', (0.34, 0.4, 0.95), (xa, ya, 0.48), 'acier', bevel=0.02)
    T.box(coll, 'armoire_toit', (0.38, 0.44, 0.05), (xa, ya, 0.975), 'acier_sombre', bevel=0.01)
    T.borne_electrique(coll, lot, (xa, ya, 1.0), 0.45, sg)  # borne électrique : le câble du jeu s'accroche à sa boule
    for i, c in enumerate(('vert', 'jaune', 'rouge')):
        lot.cube(c, (0.04, 0.02, 0.04), (xa - 0.08 + i * 0.08, ya - 0.205, 0.8), 0)
    lot.cube('jaune', (0.12, 0.01, 0.12), (xa, ya - 0.203, 0.6), 0)

    lot.finir()
    T.poser_au_sol(coll, 1.5)


MODELES = {'raffinerie_t3': raffinerie_t3}



# Emprises agrandies dans le jeu (content/machines.json) : ces modèles, dessinés pour l'ancienne emprise, sont agrandis
# (mêmes proportions) juste assez pour remplir la nouvelle (± demi-largeur en X, ± demi-profondeur en Y).
EMPRISES = {
    'raffinerie_t3': (2.0, 2.0, False),
}


def _dans_emprise(fabrique, demi_x, demi_y, recentrer):
    def f(coll, leger=True):
        fabrique(coll, leger)
        T.agrandir_auto(coll, demi_x, demi_y, recentrer)
    return f


MODELES = {nom: (_dans_emprise(fab, *EMPRISES[nom]) if nom in EMPRISES else fab) for nom, fab in MODELES.items()}

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
    T.save(os.path.join(ROOT, 'blender', 'chimie.blend'))


if __name__ == '__main__':
    main()
