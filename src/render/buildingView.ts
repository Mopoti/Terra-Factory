import * as THREE from 'three';
import { CELL_SIZE_M } from '../core/constants';
import { doorOpenKey, parseKey, pieceKey, type PiecePos, type Pieces } from '../core/build/pieces';
import {
  LAYERS_PER_STOREY,
  LAYER_HEIGHT_M,
  RISE_DIR,
  STOREY_HEIGHT_M,
  THICKNESS_M,
  pieceDef,
  slotOf,
  type PieceKind,
} from '../core/data/buildings';
import { SLAB_LIFT_M } from '../core/game/physics';
import { aimCeiling, aimEdge, aimFloor, aimStairs } from '../core/build/aim';
import type { PlanItem } from '../core/build/plan';
import { propsMaterial } from './chunkMesh';
import { MeshBuilder, hexToRgb, shade, type Rgb } from './meshBuilder';

const DOOR_WIDTH_M = 0.5;
const DOOR_HEIGHT_M = 2.0;
/** Léger retrait pour éviter que le haut des murs se superpose au plafond (scintillement). */
const EPS = 0.01;
/** Débord de la dalle au-delà de la face du mur (2 mm), pour éviter que deux faces se confondent. */
const JOIN_M = 0.002;
const GREEN: Rgb = { r: 0.33, g: 0.88, b: 0.48 };
const RED: Rgb = { r: 1, g: 0.35, b: 0.3 };

/** Ajoute le volume d'une pièce au maillage. Les positions sont en mètres. */
export function addPiece(
  mb: MeshBuilder,
  kind: PieceKind,
  pos: PiecePos,
  tint?: Rgb,
  pieces?: Pieces,
): void {
  const def = pieceDef(kind);
  const color = tint ?? hexToRgb(def.color);
  const y0 = pos.level * STOREY_HEIGHT_M;
  const cx = (pos.gx + 0.5) * CELL_SIZE_M;
  const cz = (pos.gz + 0.5) * CELL_SIZE_M;
  const T = THICKNESS_M;
  // Aperçu : chaque dalle / bloc est un peu rétréci pour qu'on voie les carreaux de 50 cm.
  const gap = tint ? 0.04 : 0;
  if (def.type === 'stairs') {
    addStairs(mb, pos, color, gap);
    return;
  }
  if (def.type === 'floor') {
    mb.box(cx, y0, cz, CELL_SIZE_M - gap, T, CELL_SIZE_M - gap, color, true);
    return;
  }
  if (def.type === 'ceiling') {
    // La dalle est posée sur la tranche haute d'un mur : sa face supérieure est au sommet du bloc `layer`.
    const layer = pos.layer ?? LAYERS_PER_STOREY - 1;
    const topY = y0 + (layer + 1) * LAYER_HEIGHT_M + SLAB_LIFT_M;
    // Là où la dalle touche un mur dont la dalle voisine ne recouvre pas l'autre moitié, elle déborde
    // jusqu'à la face extérieure du mur : dalle et mur ne font alors qu'une seule surface.
    const over = (axis: 'x' | 'z', gx: number, gz: number, nx: number, nz: number): number => {
      const wall = pieces?.[pieceKey({ slot: 'edge', level: pos.level, gx, gz, axis, layer })];
      if (!wall?.startsWith('wall') || tint) return 0;
      const neighbour =
        pieces?.[pieceKey({ slot: 'ceiling', level: pos.level, gx: nx, gz: nz, layer })];
      return neighbour ? 0 : T / 2 + JOIN_M;
    };
    const west = over('z', pos.gx, pos.gz, pos.gx - 1, pos.gz);
    const east = over('z', pos.gx + 1, pos.gz, pos.gx + 1, pos.gz);
    const north = over('x', pos.gx, pos.gz, pos.gx, pos.gz - 1);
    const south = over('x', pos.gx, pos.gz + 1, pos.gx, pos.gz + 1);
    const w = CELL_SIZE_M - gap + west + east;
    const d = CELL_SIZE_M - gap + north + south;
    mb.box(cx + (east - west) / 2, topY - T, cz + (south - north) / 2, w, T, d, color, true);
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
      LAYER_HEIGHT_M - gap,
      sz - (alongX ? 0 : gap),
      color,
      true,
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
      true,
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
    true,
  );
  // Battant : fermé, il remplit le passage ; ouvert, il pivote à angle droit sur son côté gauche.
  const leafColor = shade(color, 1.18);
  const open = !!pieces?.[doorOpenKey(pos)];
  const th = 0.04;
  if (!open) {
    mb.box(
      mx,
      y0,
      mz,
      alongX ? DOOR_WIDTH_M : th,
      DOOR_HEIGHT_M,
      alongX ? th : DOOR_WIDTH_M,
      leafColor,
      true,
    );
  } else {
    const hinge = -DOOR_WIDTH_M / 2 + th / 2;
    const across = DOOR_WIDTH_M / 2;
    mb.box(
      alongX ? mx + hinge : mx + across,
      y0,
      alongX ? mz + across : mz + hinge,
      alongX ? th : DOOR_WIDTH_M,
      DOOR_HEIGHT_M,
      alongX ? DOOR_WIDTH_M : th,
      leafColor,
      true,
    );
  }
}

/** Une marche : un coin de 50 cm de haut sur sa case, qui monte dans le sens de son orientation. */
function addStairs(mb: MeshBuilder, pos: PiecePos, color: Rgb, gap: number): void {
  const [dx, dz] = RISE_DIR[pos.rot ?? 0];
  const h = LAYER_HEIGHT_M;
  const half = CELL_SIZE_M / 2 - gap / 2;
  const cx = (pos.gx + 0.5) * CELL_SIZE_M;
  const cz = (pos.gz + 0.5) * CELL_SIZE_M;
  const y0 = pos.level * STOREY_HEIGHT_M + (pos.layer ?? 0) * h;
  // a : le long de la montée (-1 bas, +1 haut), b : en travers. Sommets en mètres.
  const pt = (a: number, b: number, up: number): [number, number, number] => [
    cx + (dx * a - dz * b) * half,
    y0 + up,
    cz + (dz * a + dx * b) * half,
  ];
  const center: [number, number, number] = [cx, y0 + h / 2, cz];
  /** Face dont les sommets sont ordonnés de façon à ce que sa normale regarde vers l'extérieur. */
  const face = (pts: [number, number, number][], shadeBy: number): void => {
    const [p0, p1, p2] = pts;
    const n = [
      (p1[1] - p0[1]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[1] - p0[1]),
      (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]),
      (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]),
    ];
    const out =
      (p0[0] - center[0]) * n[0] + (p0[1] - center[1]) * n[1] + (p0[2] - center[2]) * n[2];
    const ordered = out >= 0 ? pts : [...pts].reverse();
    const c = shade(color, shadeBy);
    if (ordered.length === 3) mb.tri(ordered[0], ordered[1], ordered[2], c);
    else mb.quad(ordered[0], ordered[1], ordered[2], ordered[3], c);
  };
  face([pt(-1, -1, 0), pt(-1, 1, 0), pt(1, 1, h), pt(1, -1, h)], 1); // pente
  face([pt(1, -1, 0), pt(1, 1, 0), pt(1, 1, h), pt(1, -1, h)], 0.85); // dos (côté haut)
  face([pt(-1, -1, 0), pt(1, -1, 0), pt(1, -1, h)], 0.75); // flanc
  face([pt(-1, 1, 0), pt(1, 1, 0), pt(1, 1, h)], 0.75); // flanc
  face([pt(-1, -1, 0), pt(-1, 1, 0), pt(1, 1, 0), pt(1, -1, 0)], 0.6); // dessous
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
      addPiece(pos.slot === 'ceiling' ? mbs.ceilings : mbs.main, kind, pos, undefined, pieces);
    }
    const make = (mb: MeshBuilder): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometryOf(mb), propsMaterial);
      mesh.castShadow = true;
      // Pas d'ombres reçues : les dalles et blocs ne se zèbrent pas d'ombres en escalier de près.
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
    lockAxis?: 'x' | 'z',
    /** Escalier : sens de montée imposé (quarts de tour), sinon dans le sens du regard. */
    forcedRot?: number | null,
  ): BuildAim | null {
    const def = pieceDef(kind);
    if (def.type === 'slab') {
      // Une dalle : plafond si le curseur touche le haut d'un mur / d'une dalle, sinon sol.
      const ceiling = aimCeiling(
        origin,
        dir,
        pieces,
        `ceiling_${def.material}`,
        level,
        maxDist,
        mode,
        true,
      );
      if (ceiling) {
        return {
          pos: ceiling.pos,
          key: pieceKey(ceiling.pos),
          cell: ceiling.cell,
          x: (ceiling.pos.gx + 0.5) * CELL_SIZE_M,
          z: (ceiling.pos.gz + 0.5) * CELL_SIZE_M,
        };
      }
      return this.aim(
        origin,
        dir,
        `floor_${def.material}`,
        level,
        pieces,
        maxDist,
        mode,
        lockAxis,
        forcedRot,
      );
    }
    const slot = slotOf(def.type);
    if (slot === 'edge') {
      const hit = aimEdge(origin, dir, pieces, kind, level, maxDist, mode, lockAxis);
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
    if (slot === 'stairs') {
      const hit = aimStairs(origin, dir, pieces, kind, level, maxDist, mode, forcedRot);
      if (!hit) return null;
      return {
        pos: hit.pos,
        key: pieceKey(hit.pos),
        cell: hit.cell,
        x: (hit.pos.gx + 0.5) * CELL_SIZE_M,
        z: (hit.pos.gz + 0.5) * CELL_SIZE_M,
      };
    }
    if (slot === 'ceiling') {
      const hit = aimCeiling(origin, dir, pieces, kind, level, maxDist, mode);
      if (!hit) return null;
      return {
        pos: hit.pos,
        key: pieceKey(hit.pos),
        cell: hit.cell,
        x: (hit.pos.gx + 0.5) * CELL_SIZE_M,
        z: (hit.pos.gz + 0.5) * CELL_SIZE_M,
      };
    }
    // Sol : s'accroche au premier objet touché (dalle, mur) ou au sol sous le curseur.
    const hit = aimFloor(origin, dir, pieces, kind, level, maxDist, mode);
    if (!hit) return null;
    return {
      pos: hit.pos,
      key: pieceKey(hit.pos),
      cell: hit.cell,
      x: (hit.pos.gx + 0.5) * CELL_SIZE_M,
      z: (hit.pos.gz + 0.5) * CELL_SIZE_M,
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
