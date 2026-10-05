import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { parseKey, pieceKey, posFor, type PiecePos, type Pieces } from '../core/build/pieces';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  STOREY_HEIGHT_M,
  THICKNESS_M,
  pieceDef,
  slotOf,
  type PieceKind,
} from '../core/data/buildings';
import { aimEdge } from '../core/build/aim';
import type { PlanItem } from '../core/build/plan';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb, type Rgb } from './meshBuilder';

const DOOR_WIDTH_M = 0.5;
const DOOR_HEIGHT_M = 2.0;
/** Blocs de mur qui arrêtent le personnage (1,75 m de haut = les 4 premiers blocs). */
const BODY_LAYERS = 4;
/** Léger retrait pour éviter que le haut des murs se superpose au plafond (scintillement). */
const EPS = 0.01;
const GREEN: Rgb = { r: 0.33, g: 0.88, b: 0.48 };
const RED: Rgb = { r: 1, g: 0.35, b: 0.3 };

/** Ajoute le volume d'une pièce au maillage. Les positions sont en mètres. */
export function addPiece(mb: MeshBuilder, kind: PieceKind, pos: PiecePos, tint?: Rgb): void {
  const def = pieceDef(kind);
  const color = tint ?? hexToRgb(def.color);
  const y0 = pos.level * STOREY_HEIGHT_M;
  const cx = (pos.gx + 0.5) * CELL_SIZE_M;
  const cz = (pos.gz + 0.5) * CELL_SIZE_M;
  const T = THICKNESS_M;
  // Aperçu : chaque dalle / bloc est un peu rétréci pour qu'on voie les carreaux de 50 cm.
  const gap = tint ? 0.04 : 0;
  if (def.type === 'floor') {
    mb.box(cx, y0, cz, CELL_SIZE_M - gap, T, CELL_SIZE_M - gap, color);
    return;
  }
  if (def.type === 'ceiling') {
    mb.box(cx, y0 + STOREY_HEIGHT_M - T, cz, CELL_SIZE_M - gap, T - EPS, CELL_SIZE_M - gap, color);
    return;
  }
  // Bord de case : le centre du mur est sur la ligne du bord ; on déborde de T pour fermer les angles.
  const alongX = pos.axis === 'x';
  const mx = alongX ? cx : pos.gx * CELL_SIZE_M;
  const mz = alongX ? pos.gz * CELL_SIZE_M : cz;
  const sx = alongX ? CELL_SIZE_M + T : T;
  const sz = alongX ? T : CELL_SIZE_M + T;
  if (def.type === 'wall') {
    // Un bloc de 50 cm de haut.
    const layer = pos.layer ?? 0;
    mb.box(
      mx,
      y0 + layer * LAYER_HEIGHT_M + gap / 2,
      mz,
      sx - (alongX ? gap : 0),
      LAYER_HEIGHT_M - (layer === LAYERS_PER_STOREY - 1 ? EPS : 0) - gap,
      sz - (alongX ? 0 : gap),
      color,
    );
    return;
  }
  // Porte : cadre avec un passage libre de 50 cm au milieu, sur tout l'étage.
  const H = STOREY_HEIGHT_M - EPS;
  const side = (CELL_SIZE_M + T - DOOR_WIDTH_M) / 2;
  const off = (DOOR_WIDTH_M + side) / 2;
  const post = (d: number): void =>
    mb.box(
      alongX ? mx + d : mx,
      y0,
      alongX ? mz : mz + d,
      alongX ? side : T,
      H,
      alongX ? T : side,
      color,
    );
  post(-off);
  post(off);
  mb.box(
    mx,
    y0 + DOOR_HEIGHT_M,
    mz,
    alongX ? DOOR_WIDTH_M : T,
    H - DOOR_HEIGHT_M,
    alongX ? T : DOOR_WIDTH_M,
    color,
  );
}

function geometryOf(mb: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(mb.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(mb.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(mb.colors, 3));
  return g;
}

/** Ce que le joueur vise en mode construction. */
export interface BuildAim {
  pos: PiecePos;
  key: string;
  /** Case du sol sous le rayon. */
  cell: { gx: number; gz: number };
  /** Centre de la pièce visée (m), pour la portée. */
  x: number;
  z: number;
}

/**
 * Affiche les pièces posées (un maillage par étage, masquable) et l'aperçu de pose.
 * Le maillage est refait en entier à chaque modification : le nombre de pièces reste modeste.
 */
export class BuildingView {
  private readonly root = new THREE.Group();
  /** Par étage : les murs/portes/sols, et les plafonds (masqués quand on est dessous). */
  private readonly levels = new Map<number, { main: THREE.Mesh; ceilings: THREE.Mesh }>();
  private readonly ghost = new THREE.Mesh();
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  private ghostKey = '';

  constructor(private readonly scene: THREE.Scene) {
    this.ghost.material = this.ghostMaterial;
    this.ghost.visible = false;
    this.ghost.renderOrder = 5;
    scene.add(this.root, this.ghost);
  }

  /** Refait les maillages à partir des pièces posées. */
  rebuild(pieces: Pieces): void {
    this.disposeLevels();
    const byLevel = new Map<number, { main: MeshBuilder; ceilings: MeshBuilder }>();
    for (const [key, kind] of Object.entries(pieces)) {
      const pos = parseKey(key);
      if (!pos) continue;
      let mbs = byLevel.get(pos.level);
      if (!mbs)
        byLevel.set(pos.level, (mbs = { main: new MeshBuilder(), ceilings: new MeshBuilder() }));
      addPiece(pos.slot === 'ceiling' ? mbs.ceilings : mbs.main, kind, pos);
    }
    const make = (mb: MeshBuilder): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometryOf(mb), propsMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    for (const [level, mbs] of byLevel) {
      this.levels.set(level, { main: make(mbs.main), ceilings: make(mbs.ceilings) });
    }
  }

  private disposeLevels(): void {
    for (const { main, ceilings } of this.levels.values()) {
      this.root.remove(main, ceilings);
      main.geometry.dispose();
      ceilings.geometry.dispose();
    }
    this.levels.clear();
  }

  /**
   * Les étages au-dessus de `maxLevel` sont masqués. Si `roofLevel` est donné (le joueur est dans une
   * pièce de cet étage), le plafond de cet étage est masqué aussi.
   */
  setVisibility(maxLevel: number, roofLevel: number | null): void {
    for (const [level, { main, ceilings }] of this.levels) {
      main.visible = level <= maxLevel;
      ceilings.visible = level <= maxLevel && (roofLevel === null || level < roofLevel);
    }
  }

  /** Emplacement visé par un rayon, pour poser une pièce de ce type à cet étage. */
  aim(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    kind: PieceKind,
    level: number,
    pieces: Pieces,
    maxDist: number,
    mode: 'place' | 'remove' = 'place',
  ): BuildAim | null {
    const slot = slotOf(pieceDef(kind).type);
    if (slot === 'edge') {
      const hit = aimEdge(origin, dir, pieces, kind, level, maxDist, mode);
      if (!hit) return null;
      const alongX = hit.pos.axis === 'x';
      return {
        pos: hit.pos,
        key: pieceKey(hit.pos),
        cell: hit.cell,
        x: alongX ? (hit.pos.gx + 0.5) * CELL_SIZE_M : hit.pos.gx * CELL_SIZE_M,
        z: alongX ? hit.pos.gz * CELL_SIZE_M : (hit.pos.gz + 0.5) * CELL_SIZE_M,
      };
    }
    // Sol ou plafond : la case sous le rayon, dans le plan du sol ou du plafond de l'étage.
    const y0 = level * STOREY_HEIGHT_M;
    const planeY = slot === 'ceiling' ? y0 + STOREY_HEIGHT_M : y0;
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = (planeY - origin.y) / dir.y;
    if (t < 0 || t > 200) return null;
    const gx = Math.floor((origin.x + dir.x * t) / CELL_SIZE_M);
    const gz = Math.floor((origin.z + dir.z * t) / CELL_SIZE_M);
    const pos = posFor(kind, level, gx, gz);
    return {
      pos,
      key: pieceKey(pos),
      cell: { gx, gz },
      x: (gx + 0.5) * CELL_SIZE_M,
      z: (gz + 0.5) * CELL_SIZE_M,
    };
  }

  /** Aperçu des pièces à poser : vert si elles seront posées, rouge si elles ne peuvent pas l'être. */
  showGhosts(items: PlanItem[], kind: PieceKind): void {
    const shown = items.filter((i) => i.status !== 'occupied');
    if (shown.length === 0) {
      this.ghost.visible = false;
      this.ghostKey = '';
      return;
    }
    const key = `${kind}|${shown.map((i) => `${pieceKey(i.pos)}${i.status === 'ok' ? '+' : '-'}`).join(';')}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      const mb = new MeshBuilder();
      for (const item of shown) {
        addPiece(mb, kind, item.pos, item.status === 'ok' ? GREEN : RED);
      }
      this.ghost.geometry.dispose();
      this.ghost.geometry = geometryOf(mb);
    }
    this.ghost.visible = true;
  }

  hideGhost(): void {
    this.ghost.visible = false;
    this.ghostKey = '';
  }

  dispose(): void {
    this.scene.remove(this.root, this.ghost);
    this.disposeLevels();
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();
  }
}

/** Un mur bloque-t-il ce point au rez-de-chaussée ? (un bloc de mur à hauteur du corps suffit ; les portes laissent passer) */
export function wallBlocks(pieces: Pieces, x: number, z: number): boolean {
  const margin = THICKNESS_M / 2 + 0.02;
  const solid = (axis: 'x' | 'z', gx: number, gz: number): boolean => {
    for (let layer = 0; layer < BODY_LAYERS; layer++) {
      const kind = pieces[pieceKey({ slot: 'edge', level: 0, gx, gz, axis, layer })];
      if (kind?.startsWith('wall')) return true;
    }
    return false;
  };
  const gxn = Math.round(x / CELL_SIZE_M);
  if (Math.abs(x - gxn * CELL_SIZE_M) <= margin && solid('z', gxn, Math.floor(z / CELL_SIZE_M))) {
    return true;
  }
  const gzn = Math.round(z / CELL_SIZE_M);
  return Math.abs(z - gzn * CELL_SIZE_M) <= margin && solid('x', Math.floor(x / CELL_SIZE_M), gzn);
}
