"""Outils communs des modèles 3D de Terra Factory (Blender, Python).

Conventions (voir blender/README.md) :
- 1 unité Blender = 1 case du jeu = 50 cm x 50 cm. Une foreuse de 4 x 4 cases mesure donc 4 x 4 unités.
- Z est le haut. Le modèle est centré sur (0, 0) et posé sur Z = 0.
- L'AVANT (la sortie de la machine) est du côté -Y de Blender (vue de face, touche 1) : à l'export (Y haut) c'est +Z,
  c'est-à-dire l'orientation 0 du jeu (sortie vers +z).
- Un modèle = une collection Blender, nommée comme le fichier exporté (minuscules, sans accents : foreuse_t1).
- À l'export, le modèle est mis à l'échelle 0,5 : le .glb est en mètres (1 unité du .glb = 1 m), comme Unity et three.js.
"""

import math
import os
import random

import bpy  # doit venir avant bmesh quand bpy est installé comme module Python
import bmesh
from mathutils import Matrix, Vector

CELL_M = 0.5  # taille d'une case du jeu, en mètres

# Palette commune : tous les modèles s'y servent, pour garder un style cohérent.
PALETTE = {
    'acier': '#8a929c',
    'acier_sombre': '#4a5058',
    'fonte': '#2f3338',
    'cuivre': '#c4743b',
    'orange': '#c98a2d',
    'rouge': '#b8403a',
    'jaune': '#e0b83a',
    'bleu': '#3f78b5',
    'vert': '#4f9a5b',
    'blanc': '#dfe3e8',
    'noir': '#18191c',
    'brique': '#8c4a38',
    'brique_claire': '#a85d42',
    'brique_sombre': '#6a372b',
    'pierre': '#6e6862',
    'pierre_claire': '#8a837b',
    'pierre_sombre': '#4e4a46',
    'bois_sombre': '#5e4630',
    'braise': '#f0701e',
    'flamme': '#ffc93c',
    'verre': '#7fb7d4',
    'bois': '#8a6a45',
}


def reset() -> None:
    """Scène vide (unités en mètres, échelle 1 : l'échelle 0,5 est appliquée seulement à l'export)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def _linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name: str) -> bpy.types.Material:
    """Matériau uni de la palette (créé une fois)."""
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    hexa = PALETTE[name].lstrip('#')
    r, g, b = (int(hexa[i : i + 2], 16) / 255 for i in (0, 2, 4))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    # Par type, pas par nom : le nom du nœud est traduit selon la langue de Blender (« BSDF guidée » en français).
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (_linear(r), _linear(g), _linear(b), 1.0)
    bsdf.inputs['Roughness'].default_value = 0.75
    bsdf.inputs['Metallic'].default_value = 0.0
    m.diffuse_color = (_linear(r), _linear(g), _linear(b), 1.0)
    return m


def collection(name: str) -> bpy.types.Collection:
    """Collection d'un modèle (une collection = un .glb exporté)."""
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def _object(coll: bpy.types.Collection, name: str, bm: bmesh.types.BMesh, mat: str) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material(mat))
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def _cube(bm, size, loc, bevel=0.0, rot=None):
    """Ajoute à `bm` un cube de `size` centré en `loc`, arêtes biseautées de `bevel` (style low poly), tourné par `rot`."""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
    if bevel > 0:
        bevel = min(bevel, min(size) * 0.45)
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bevel, segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    if rot is not None:
        bmesh.ops.rotate(tmp, cent=Vector((0, 0, 0)), matrix=rot, verts=tmp.verts)
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    mesh = bpy.data.meshes.new('_tmp')
    tmp.to_mesh(mesh)
    tmp.free()
    bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def box(coll, name, size, loc, mat, bevel=0.0):
    """Boîte de `size` (x, y, z) dont le CENTRE est en `loc` ; `bevel` > 0 biseaute les arêtes."""
    bm = bmesh.new()
    _cube(bm, size, loc, bevel)
    return _object(coll, name, bm, mat)


class Lot:
    """Regroupe beaucoup de petites pièces par teinte : un objet par teinte au lieu d'un objet par pièce."""

    def __init__(self, coll, name):
        self.coll, self.name, self.bms = coll, name, {}

    def cube(self, mat, size, loc, bevel=0.0, rot=None):
        _cube(self.bms.setdefault(mat, bmesh.new()), size, loc, bevel, rot)

    def finir(self):
        for mat, bm in self.bms.items():
            _object(self.coll, f'{self.name}_{mat}', bm, mat)
        self.bms = {}


BRIQUES = (('brique', 5), ('brique_claire', 3), ('brique_sombre', 3), ('pierre', 1))
PIERRES = (('pierre', 4), ('pierre_claire', 2), ('pierre_sombre', 3))


def parement(lot, faces, rangs, seed=1, densite=0.65, teintes=BRIQUES, long=(0.32, 0.44), haut=(0.14, 0.17), bevel=0.012):
    """Briques ou pierres en relief, en quinconce et de teintes variées, posées sur des faces verticales.

    `faces` : liste de (axe, position, debut, fin, sens). axe 'x' = face perpendiculaire à X placée en x = position,
    les pièces allant de `debut` à `fin` le long de Y (axe 'y' : l'inverse) ; `sens` = +1 ou -1 (côté où elles dépassent).
    `rangs` : hauteurs (centres) des rangées. Reproductible grâce à `seed`.
    """
    rnd = random.Random(seed)
    noms, poids = zip(*teintes)
    for axe, pos, debut, fin, sens in faces:
        for r, z in enumerate(rangs):
            u = debut + (0.0 if r % 2 == 0 else (long[0] + long[1]) / 4)
            while u < fin - 0.12:
                ln = min(rnd.uniform(*long), fin - u)
                if rnd.random() < densite:
                    h = rnd.uniform(*haut)
                    ep = rnd.uniform(0.03, 0.06)
                    a, zc = u + ln / 2, z + rnd.uniform(-0.01, 0.01)
                    if axe == 'x':
                        taille, centre, ax = (ep, ln - 0.04, h), (pos + sens * ep / 2, a, zc), 'X'
                    else:
                        taille, centre, ax = (ln - 0.04, ep, h), (a, pos + sens * ep / 2, zc), 'Y'
                    rot = Matrix.Rotation(rnd.uniform(-0.05, 0.05), 3, ax)
                    lot.cube(rnd.choices(noms, poids)[0], taille, centre, bevel, rot)
                u += ln


def cylinder(coll, name, radius, height, loc, mat, segments=12, radius_top=None):
    """Cylindre (ou tronc de cône si `radius_top`) vertical, centré en `loc`."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=height,
    )
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    return _object(coll, name, bm, mat)


def rotate(obj, x=0.0, y=0.0, z=0.0):
    """Tourne un objet (degrés) autour de son centre."""
    obj.rotation_euler = tuple(math.radians(a) for a in (x, y, z))
    return obj


def _export_copy(coll):
    """Copies mises à l'échelle 0,5 (cases -> mètres) dans une collection temporaire."""
    temp = bpy.data.collections.new(coll.name + '_export')
    bpy.context.scene.collection.children.link(temp)
    for obj in coll.objects:
        mesh = obj.data.copy()
        # matrix_basis plutôt que matrix_world : juste même si la collection est masquée (pas encore recalculée).
        monde = obj.matrix_basis if obj.parent is None else obj.matrix_world
        mesh.transform(Matrix.Scale(CELL_M, 4) @ monde)
        copy = bpy.data.objects.new(obj.name, mesh)
        temp.objects.link(copy)
    return temp


def export_glb(coll, folder, name=None) -> str:
    """Exporte la collection en `folder/<name>.glb` (mètres, Y haut) ; `name` = nom de la collection par défaut."""
    temp = _export_copy(coll)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in temp.objects:
        o.select_set(True)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, (name or coll.name) + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
    )
    for o in list(temp.objects):
        bpy.data.objects.remove(o)
    bpy.data.collections.remove(temp)
    return path


def save(path) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=path)
