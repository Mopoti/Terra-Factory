import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { parseKey, pieceKey, posFor, type PiecePos, type Pieces } from '../core/build/pieces';
import { STOREY_HEIGHT_M, THICKNESS_M, pieceDef, type PieceKind } from '../core/data/buildings';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb } from './meshBuilder';

const DOOR_WIDTH_M = 0.4;
const DOOR_HEIGHT_M = 2.0;
/** Léger retrait pour éviter que le haut des murs se superpose au plafond (scintillement). */
const EPS = 0.01;

/** Ajoute le volume d'une pièce au maillage. Les positions sont en mètres. */
export function addPiece(mb: MeshBuilder, kind: PieceKind, pos: PiecePos): void {
  const color = hexToRgb(pieceDef(kind).color);
  const y0 = pos.level * STOREY_HEIGHT_M;
  const cx = (pos.gx + 0.5) * CELL_SIZE_M;
  const cz = (pos.gz + 0.5) * CELL_SIZE_M;
  const T = THICKNESS_M;
  if (kind === 'floor') {
    mb.box(cx, y0, cz, CELL_SIZE_M, T, CELL_SIZE_M, color);
    return;
  }
  if (kind === 'ceiling') {
    mb.box(cx, y0 + STOREY_HEIGHT_M - T, cz, CELL_SIZE_M, T - EPS, CELL_SIZE_M, color);
    return;
  }
  // Bord de case : le centre du mur est sur la ligne du bord ; on déborde de T pour fermer les angles.
  const alongX = pos.axis === 'x';
  const mx = alongX ? cx : pos.gx * CELL_SIZE_M;
  const mz = alongX ? pos.gz * CELL_SIZE_M : cz;
  const sx = alongX ? CELL_SIZE_M + T : T;
  const sz = alongX ? T : CELL_SIZE_M + T;
  const H = STOREY_HEIGHT_M - EPS;
  if (kind === 'wall') {
    mb.box(mx, y0, mz, sx, H, sz, color);
    return;
  }
  // Porte : cadre en bois avec un passage libre au milieu.
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
    vertexColors: false,
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
      addPiece(kind === 'ceiling' ? mbs.ceilings : mbs.main, kind, pos);
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
  aim(origin: THREE.Vector3, dir: THREE.Vector3, kind: PieceKind, level: number): BuildAim | null {
    const slot = pieceDef(kind).slot;
    const y0 = level * STOREY_HEIGHT_M;
    const planeY = slot === 'ceiling' ? y0 + STOREY_HEIGHT_M : slot === 'floor' ? y0 : y0 + 1.2;
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = (planeY - origin.y) / dir.y;
    if (t < 0 || t > 200) return null;
    const x = origin.x + dir.x * t;
    const z = origin.z + dir.z * t;
    const gx = Math.floor(x / CELL_SIZE_M);
    const gz = Math.floor(z / CELL_SIZE_M);
    let pos: PiecePos;
    if (slot === 'edge') {
      const fx = x / CELL_SIZE_M - gx;
      const fz = z / CELL_SIZE_M - gz;
      const nearest = Math.min(fx, 1 - fx, fz, 1 - fz);
      if (nearest === fx) pos = posFor(kind, level, gx, gz, 'z');
      else if (nearest === 1 - fx) pos = posFor(kind, level, gx + 1, gz, 'z');
      else if (nearest === fz) pos = posFor(kind, level, gx, gz, 'x');
      else pos = posFor(kind, level, gx, gz + 1, 'x');
    } else {
      pos = posFor(kind, level, gx, gz);
    }
    const alongX = pos.axis === 'x';
    return {
      pos,
      key: pieceKey(pos),
      x: slot === 'edge' && !alongX ? pos.gx * CELL_SIZE_M : (pos.gx + 0.5) * CELL_SIZE_M,
      z: slot === 'edge' && alongX ? pos.gz * CELL_SIZE_M : (pos.gz + 0.5) * CELL_SIZE_M,
    };
  }

  /** Affiche (ou masque) l'aperçu de la pièce visée, vert si on peut la poser, rouge sinon. */
  showGhost(aim: BuildAim | null, kind: PieceKind, ok: boolean): void {
    if (!aim) {
      this.ghost.visible = false;
      return;
    }
    const key = `${kind}|${aim.key}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      const mb = new MeshBuilder();
      addPiece(mb, kind, aim.pos);
      this.ghost.geometry.dispose();
      this.ghost.geometry = geometryOf(mb);
    }
    this.ghostMaterial.color.set(ok ? 0x55e07a : 0xff5a4d);
    this.ghost.visible = true;
  }

  dispose(): void {
    this.scene.remove(this.root, this.ghost);
    this.disposeLevels();
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();
  }
}

/** Un mur plein bloque-t-il ce point au rez-de-chaussée ? (les portes laissent passer) */
export function wallBlocks(pieces: Pieces, x: number, z: number): boolean {
  const margin = THICKNESS_M / 2 + 0.02;
  const gxn = Math.round(x / CELL_SIZE_M);
  if (Math.abs(x - gxn * CELL_SIZE_M) <= margin) {
    const gz = Math.floor(z / CELL_SIZE_M);
    if (pieces[pieceKey({ slot: 'edge', level: 0, gx: gxn, gz, axis: 'z' })] === 'wall')
      return true;
  }
  const gzn = Math.round(z / CELL_SIZE_M);
  if (Math.abs(z - gzn * CELL_SIZE_M) <= margin) {
    const gx = Math.floor(x / CELL_SIZE_M);
    if (pieces[pieceKey({ slot: 'edge', level: 0, gx, gz: gzn, axis: 'x' })] === 'wall')
      return true;
  }
  return false;
}
