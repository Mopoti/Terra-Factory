import { describe, expect, it } from 'vitest';
import type { PieceKind } from '../data/buildings';
import {
  edgeState,
  isFree,
  normalizePieces,
  parseKey,
  pieceKey,
  posFor,
  type Pieces,
} from './pieces';
import { detectRooms, roomAt } from './rooms';

/** Construit une pièce rectangulaire w × h cases, à partir de la case (0,0), avec une porte au sud-ouest. */
function put(
  p: Pieces,
  type: 'wall' | 'door' | 'floor' | 'ceiling',
  gx: number,
  gz: number,
  axis?: 'x' | 'z',
  level = 0,
): void {
  const kind = `${type}_${type === 'wall' ? 'stone' : 'wood'}` as PieceKind;
  const layers = type === 'wall' ? [0, 1, 2, 3, 4] : [undefined];
  for (const l of layers) p[pieceKey(posFor(kind, level, gx, gz, axis, l))] = kind;
}

function box(w: number, h: number, opts: { door?: boolean; ceiling?: boolean } = {}): Pieces {
  const p: Pieces = {};
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < h; z++) {
      put(p, 'floor', x, z);
      if (opts.ceiling !== false) put(p, 'ceiling', x, z);
    }
  }
  for (let x = 0; x < w; x++) {
    put(p, 'wall', x, 0, 'x');
    put(p, 'wall', x, h, 'x');
  }
  for (let z = 0; z < h; z++) {
    put(p, 'wall', 0, z, 'z');
    put(p, 'wall', w, z, 'z');
  }
  if (opts.door !== false) {
    for (let l = 0; l < 5; l++) delete p[pieceKey(posFor('wall_stone', 0, 0, 0, 'x', l))];
    put(p, 'door', 0, 0, 'x');
  }
  return p;
}

describe('clés de pièces', () => {
  it('aller-retour', () => {
    const pos = posFor('wall_stone', 2, -3, 4, 'z', 3);
    expect(parseKey(pieceKey(pos))).toEqual(pos);
    expect(parseKey(pieceKey(posFor('floor_wood', 0, 1, 2)))).toEqual(
      posFor('floor_wood', 0, 1, 2),
    );
    expect(parseKey('x:0:1,1')).toBeNull();
    expect(parseKey('f:0:1,1:x:0')).toBeNull();
    expect(parseKey('e:0:1,1:x')).toBeNull();
    expect(parseKey('e:0:1,1:x:5')).toBeNull();
  });
  it("ignore les données invalides et convertit l'ancien format", () => {
    const r = normalizePieces({
      'f:0:0,0': 'floor_wood',
      'f:0:1,1': 'wall_stone',
      bad: 'floor_wood',
      'c:0:0,0': 'zzz',
      'f:0:2,2': 'floor', // ancien type
      'e:0:3,3:z': 'wall', // ancien mur : 5 blocs de pierre
    });
    expect(r['f:0:0,0']).toBe('floor_wood');
    expect(r['f:0:2,2']).toBe('floor_wood');
    expect(Object.keys(r).filter((k) => k.startsWith('e:0:3,3:z'))).toHaveLength(5);
    expect(Object.keys(r)).toHaveLength(7);
  });
});

describe('détection des pièces', () => {
  it('une boîte fermée avec porte est une pièce', () => {
    const rooms = detectRooms(box(3, 2));
    expect(rooms).toHaveLength(1);
    expect(rooms[0].cells).toHaveLength(6);
    expect(rooms[0].doors).toBe(1);
    expect(roomAt(rooms, 0, 1, 1)?.id).toBe(rooms[0].id);
    expect(roomAt(rooms, 0, 5, 5)).toBeNull();
  });
  it("sans porte, ce n'est pas une pièce", () => {
    expect(detectRooms(box(3, 2, { door: false }))).toHaveLength(0);
  });
  it("sans plafond ou avec un trou dans les murs, ce n'est pas une pièce", () => {
    expect(detectRooms(box(3, 2, { ceiling: false }))).toHaveLength(0);
    const p = box(3, 2);
    delete p[pieceKey(posFor('wall_stone', 0, 2, 2, 'x', 2))];
    expect(detectRooms(p)).toHaveLength(0);
  });
  it('un sol manquant ouvre la pièce', () => {
    const p = box(3, 2);
    delete p[pieceKey(posFor('floor_wood', 0, 1, 1))];
    expect(detectRooms(p)).toHaveLength(0);
  });
  it('une cloison avec porte sépare deux pièces', () => {
    const p = box(4, 2);
    put(p, 'wall', 2, 0, 'z');
    for (let l = 0; l < 5; l++) put(p, 'wall', 2, 1, 'z');
    for (let l = 0; l < 5; l++) delete p[pieceKey(posFor('wall_stone', 0, 2, 1, 'z', l))];
    put(p, 'door', 2, 1, 'z');
    const rooms = detectRooms(p);
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.cells.length).sort()).toEqual([4, 4]);
  });
  it('un grand espace fermé dépasse la taille maximale', () => {
    expect(detectRooms(box(30, 30))).toHaveLength(0);
  });
  it('les étages sont indépendants', () => {
    const p = box(2, 2);
    const up: Pieces = {};
    for (const [k, v] of Object.entries(p)) up[k.replace(/^(.):0:/, '$1:1:')] = v;
    expect(
      detectRooms({ ...p, ...up })
        .map((r) => r.level)
        .sort(),
    ).toEqual([0, 1]);
  });

  it('un trou dans un mur (fenêtre) ouvre la pièce', () => {
    const p = box(3, 2);
    delete p[pieceKey(posFor('wall_stone', 0, 2, 2, 'x', 2))];
    expect(edgeState(p, posFor('wall_stone', 0, 2, 2, 'x'))).toBe('open');
    expect(detectRooms(p)).toHaveLength(0);
  });
});

describe('emplacements', () => {
  it('une porte ne se pose pas sur un mur et inversement', () => {
    const p: Pieces = {};
    put(p, 'wall', 0, 0, 'x');
    expect(isFree(p, 'door_wood', posFor('door_wood', 0, 0, 0, 'x'))).toBe(false);
    const q: Pieces = {};
    put(q, 'door', 0, 0, 'x');
    expect(isFree(q, 'wall_wood', posFor('wall_wood', 0, 0, 0, 'x', 2))).toBe(false);
    expect(isFree({}, 'wall_wood', posFor('wall_wood', 0, 0, 0, 'x', 2))).toBe(true);
  });
});
