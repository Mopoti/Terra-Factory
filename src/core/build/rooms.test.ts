import { describe, expect, it } from 'vitest';
import { normalizePieces, parseKey, pieceKey, posFor, type Pieces } from './pieces';
import { detectRooms, roomAt } from './rooms';

/** Construit une pièce rectangulaire w × h cases, à partir de la case (0,0), avec une porte au sud-ouest. */
function box(w: number, h: number, opts: { door?: boolean; ceiling?: boolean } = {}): Pieces {
  const p: Pieces = {};
  const put = (kind: Parameters<typeof posFor>[0], gx: number, gz: number, axis?: 'x' | 'z') => {
    p[pieceKey(posFor(kind, 0, gx, gz, axis))] = kind;
  };
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < h; z++) {
      put('floor', x, z);
      if (opts.ceiling !== false) put('ceiling', x, z);
    }
  }
  for (let x = 0; x < w; x++) {
    put('wall', x, 0, 'x');
    put('wall', x, h, 'x');
  }
  for (let z = 0; z < h; z++) {
    put('wall', 0, z, 'z');
    put('wall', w, z, 'z');
  }
  if (opts.door !== false) put('door', 0, 0, 'x');
  return p;
}

describe('clés de pièces', () => {
  it('aller-retour', () => {
    const pos = posFor('wall', 2, -3, 4, 'z');
    expect(parseKey(pieceKey(pos))).toEqual(pos);
    expect(parseKey(pieceKey(posFor('floor', 0, 1, 2)))).toEqual(posFor('floor', 0, 1, 2));
    expect(parseKey('x:0:1,1')).toBeNull();
    expect(parseKey('f:0:1,1:x')).toBeNull();
    expect(parseKey('e:0:1,1')).toBeNull();
  });
  it('ignore les données invalides', () => {
    const r = normalizePieces({
      'f:0:0,0': 'floor',
      'f:0:1,1': 'wall',
      bad: 'floor',
      'c:0:0,0': 'zzz',
    });
    expect(r).toEqual({ 'f:0:0,0': 'floor' });
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
    delete p[pieceKey(posFor('wall', 0, 2, 2, 'x'))];
    expect(detectRooms(p)).toHaveLength(0);
  });
  it('un sol manquant ouvre la pièce', () => {
    const p = box(3, 2);
    delete p[pieceKey(posFor('floor', 0, 1, 1))];
    expect(detectRooms(p)).toHaveLength(0);
  });
  it('une cloison avec porte sépare deux pièces', () => {
    const p = box(4, 2);
    for (const z of [0, 1]) p[pieceKey(posFor('wall', 0, 2, z, 'z'))] = 'wall';
    p[pieceKey(posFor('door', 0, 2, 1, 'z'))] = 'door';
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
});
