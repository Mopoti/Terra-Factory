import { describe, expect, it } from 'vitest';
import { posFor } from '../build/pieces';
import { BAG_LIMITS, itemById } from '../data/items';
import { RESOURCES } from '../data/resources';
import { WorldGenerator, defaultWorldParams } from '../world/worldgen';
import { add, maxAddable, normalizeInventory, remove, totals } from './inventory';
import { distanceToFootprint, isWithinReach } from './reach';
import { GameState } from './state';
import { applyChanges, cellKey, emptyChanges, normalizeChanges } from './worldChanges';

describe('objets et sac', () => {
  it('le sac de départ fait 50 kg et 60 L', () => {
    expect(BAG_LIMITS).toEqual({ maxWeightG: 50_000, maxVolumeMl: 60_000 });
  });
  it('100 minerais de fer tiennent dans le sac (40 kg, 30 L)', () => {
    const inv = add({}, 'iron_ore', 100);
    expect(totals(inv)).toEqual({ weightG: 40_000, volumeMl: 30_000 });
    expect(maxAddable(inv, 'iron_ore', BAG_LIMITS)).toBe(25); // limité par le poids : 10 kg restants
  });
  it('le volume peut limiter avant le poids (bois : 3 L pour 0,8 kg)', () => {
    expect(maxAddable({}, 'wood', BAG_LIMITS)).toBe(20); // 60 L / 3 L
    expect(maxAddable({}, 'stone', BAG_LIMITS)).toBe(41); // 50 kg / 1,2 kg
  });
  it('un sac plein ne reçoit plus rien', () => {
    expect(maxAddable(add({}, 'wood', 20), 'wood', BAG_LIMITS)).toBe(0);
    expect(maxAddable(add({}, 'wood', 20), 'coal', BAG_LIMITS)).toBe(0); // volume épuisé
  });
  it('retire sans passer sous zéro et efface les lignes vides', () => {
    const { inventory, removed } = remove({ wood: 3 }, 'wood', 10);
    expect(removed).toBe(3);
    expect(inventory).toEqual({});
    expect(remove({ wood: 3 }, 'wood', 1).inventory).toEqual({ wood: 2 });
  });
  it('lit un sac enregistré en ignorant les objets inconnus et les quantités invalides', () => {
    expect(normalizeInventory({ wood: 2.9, nope: 4, coal: -1, stone: 'x' })).toEqual({ wood: 2 });
    expect(normalizeInventory(null)).toEqual({});
  });
  it('toutes les ressources récoltables donnent un objet qui existe', () => {
    for (const r of RESOURCES) {
      if (r.kind === 'object' || r.kind === 'deposit') {
        expect(() => itemById(r.harvest.item), r.id).not.toThrow();
        expect(r.harvest.secondsPerUnit).toBeGreaterThan(0);
      }
    }
  });
});

describe('récolte (commandes)', () => {
  it('récolter ajoute au sac et enregistre ce qui a été pris', () => {
    const s = new GameState();
    const r = s.harvest('4,6', 4, 'wood', 1);
    expect(r).toEqual({ gained: 1, left: 3, bagFull: false });
    expect(s.inventory).toEqual({ wood: 1 });
    expect(s.changes.taken['4,6']).toBe(1);
  });
  it('on ne peut pas prendre plus que ce que contient la ressource', () => {
    const s = new GameState();
    expect(s.harvest('0,0', 4, 'wood', 10).gained).toBe(4);
    expect(s.harvest('0,0', 4, 'wood', 1)).toEqual({ gained: 0, left: 0, bagFull: false });
    expect(s.inventory).toEqual({ wood: 4 });
  });
  it('sac plein : la récolte s’arrête et le reste demeure dans la ressource', () => {
    const s = new GameState({ inventory: { wood: 19 } });
    const r = s.harvest('1,1', 4, 'wood', 4);
    expect(r).toEqual({ gained: 1, left: 3, bagFull: true });
    expect(s.harvest('1,1', 4, 'wood', 1).gained).toBe(0);
    expect(s.remaining('1,1', 4)).toBe(3);
  });
  it('sait si le sac peut encore recevoir un objet', () => {
    expect(new GameState().hasRoomFor('wood')).toBe(true);
    expect(new GameState({ inventory: { wood: 20 } }).hasRoomFor('wood')).toBe(false);
    expect(new GameState({ inventory: { wood: 20 } }).hasRoomFor('coal')).toBe(false); // volume plein
    expect(new GameState({ inventory: { stone: 41 } }).hasRoomFor('stone')).toBe(false); // poids plein
  });
  it('émet un événement à chaque récolte', () => {
    const s = new GameState();
    const seen: string[] = [];
    s.onChange((e) => seen.push(e.type));
    s.harvest('0,0', 4, 'wood', 1);
    s.harvest('0,0', 4, 'wood', 0);
    expect(seen).toEqual(['harvest']);
  });
});

describe('objets jetés au sol', () => {
  it('jeter retire du sac et pose une pile au sol', () => {
    const s = new GameState({ inventory: { stone: 10 } });
    const stack = s.drop('stone', 4, 2.5, -1);
    expect(stack).toMatchObject({ item: 'stone', count: 4, x: 2.5, z: -1 });
    expect(s.inventory).toEqual({ stone: 6 });
    expect(s.changes.drops).toHaveLength(1);
  });
  it('on ne jette pas plus que ce qu’on a, ni ce qu’on n’a pas', () => {
    const s = new GameState({ inventory: { stone: 2 } });
    expect(s.drop('stone', 9, 0, 0)?.count).toBe(2);
    expect(s.drop('stone', 1, 0, 0)).toBeNull();
    expect(s.drop('coal', 1, 0, 0)).toBeNull();
  });
  it('ramasser remet la pile dans le sac', () => {
    const s = new GameState({ inventory: { coal: 5 } });
    const stack = s.drop('coal', 5, 0, 0);
    const r = s.pickUp(stack!.id);
    expect(r).toEqual({ gained: 5, left: 0, bagFull: false });
    expect(s.inventory).toEqual({ coal: 5 });
    expect(s.changes.drops).toHaveLength(0);
  });
  it('ramasser en partie si le sac n’a pas assez de place', () => {
    const s = new GameState({ inventory: { wood: 20 } });
    s.changes.drops.push({ id: 'drop-9', item: 'wood', count: 5, x: 0, z: 0 });
    s.inventory = { wood: 18 }; // place pour 2 bois seulement
    const r = s.pickUp('drop-9');
    expect(r).toEqual({ gained: 2, left: 3, bagFull: true });
    expect(s.changes.drops[0].count).toBe(3);
  });
  it('les identifiants de piles ne se répètent pas, même après rechargement', () => {
    const s = new GameState({ inventory: { coal: 9 } });
    s.drop('coal', 1, 0, 0);
    s.drop('coal', 1, 1, 0);
    const reloaded = new GameState(s.snapshot());
    const next = reloaded.drop('coal', 1, 2, 0);
    expect(new Set([...reloaded.changes.drops.map((d) => d.id)]).size).toBe(3);
    expect(next?.id).not.toBe(s.changes.drops[0].id);
  });
});

describe('le monde garde la trace des actions', () => {
  const gen = new WorldGenerator(defaultWorldParams('trace'));
  const chunk = (() => {
    for (let cx = -14; cx <= 14; cx++) {
      for (let cz = -14; cz <= 14; cz++) {
        const c = gen.chunk(cx, cz);
        if (c.objects.some((o) => o.id === 'tree') && c.ore.length > 0) return c;
      }
    }
    throw new Error('aucun chunk adapté');
  })();

  it('sans changement, le chunk est identique', () => {
    expect(applyChanges(chunk, emptyChanges())).toBe(chunk);
  });
  it('un arbre entièrement récolté disparaît, un arbre entamé reste avec moins de bois', () => {
    const trees = chunk.objects.filter((o) => o.id === 'tree');
    const [a, b] = trees;
    const changes = emptyChanges();
    changes.taken[cellKey(a.gx, a.gz)] = 4;
    if (b) changes.taken[cellKey(b.gx, b.gz)] = 1;
    const after = applyChanges(chunk, changes);
    expect(after.objects.find((o) => o.gx === a.gx && o.gz === a.gz)).toBeUndefined();
    if (b) expect(after.objects.find((o) => o.gx === b.gx && o.gz === b.gz)?.amount).toBe(3);
    expect(after.objects.length).toBe(chunk.objects.length - 1);
  });
  it('les nids ne sont jamais touchés par les changements', () => {
    const nest = { id: 'nest', gx: 0, gz: 0, cells: 4, scale: 1, rotation: 0, amount: 0 };
    const changes = emptyChanges();
    changes.taken['0,0'] = 99;
    expect(applyChanges({ ...chunk, objects: [nest] }, changes).objects).toEqual([nest]);
  });
  it('une case de minerai perd ses minerais puis disparaît quand elle est vide', () => {
    const cell = chunk.ore[0];
    const changes = emptyChanges();
    changes.taken[cellKey(cell.gx, cell.gz)] = 5;
    const part = applyChanges(chunk, changes).ore.find((o) => o.gx === cell.gx && o.gz === cell.gz);
    expect(part?.amount).toBe(cell.amount - 5);
    changes.taken[cellKey(cell.gx, cell.gz)] = cell.amount;
    expect(applyChanges(chunk, changes).ore.some((o) => o.gx === cell.gx && o.gz === cell.gz)).toBe(
      false,
    );
  });
  it('le monde d’origine n’est pas modifié (la même seed redonne le même chunk)', () => {
    const changes = emptyChanges();
    changes.taken[cellKey(chunk.ore[0].gx, chunk.ore[0].gz)] = 3;
    applyChanges(chunk, changes);
    expect(JSON.stringify(gen.chunk(chunk.cx, chunk.cz))).toBe(JSON.stringify(chunk));
  });
  it('lit des changements enregistrés en ignorant les données invalides', () => {
    const c = normalizeChanges({
      taken: { '1,2': 3, bad: 4, '5,6': -1, '7,8': 'x' },
      drops: [{ id: 'drop-4', item: 'coal', count: 2, x: 1, z: 2 }, { id: 3 }, null],
      nextDropId: 1,
    });
    expect(c.taken).toEqual({ '1,2': 3 });
    expect(c.drops).toHaveLength(1);
    expect(c.nextDropId).toBe(5); // jamais en dessous du plus grand identifiant existant
  });
  it('une sauvegarde reproduit exactement l’état (sac et changements)', () => {
    const s = new GameState();
    s.harvest('3,4', 4, 'wood', 2);
    s.drop('wood', 1, 1, 1);
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.inventory).toEqual(s.inventory);
    expect(copy.changes).toEqual(s.changes);
  });
});

describe('portée de la récolte', () => {
  // Un arbre de 2 × 2 cases (1 m) dont le coin est la case (12, 10) occupe x 6 à 7 m, z 5 à 6 m.
  it('0 si le joueur est dessus', () => {
    expect(distanceToFootprint({ x: 6.5, z: 5.5 }, 12, 10, 2)).toBe(0);
  });
  it('se mesure jusqu’au bord, pas jusqu’au centre', () => {
    expect(distanceToFootprint({ x: 6.5, z: 8 }, 12, 10, 2)).toBeCloseTo(2, 6);
    expect(distanceToFootprint({ x: 9, z: 5.5 }, 12, 10, 2)).toBeCloseTo(2, 6);
  });
  it('en diagonale, mesure jusqu’au coin', () => {
    expect(distanceToFootprint({ x: 9, z: 9 }, 12, 10, 2)).toBeCloseTo(Math.hypot(2, 3), 6);
  });
  it('3 m de portée : à 3 m on peut, à 3,01 m non', () => {
    expect(isWithinReach(distanceToFootprint({ x: 6.5, z: 9 }, 12, 10, 2), 3)).toBe(true);
    expect(isWithinReach(distanceToFootprint({ x: 6.5, z: 9.01 }, 12, 10, 2), 3)).toBe(false);
  });
  it('un nid ou un grand objet est mesuré à son bord', () => {
    expect(distanceToFootprint({ x: 0, z: 10 }, -2, -2, 4)).toBeCloseTo(9, 6);
  });
});

describe('construction', () => {
  it('pose consomme des matériaux, démonter les rend', () => {
    const s = new GameState({ inventory: { stone: 5 } });
    const pos = posFor('wall', 0, 1, 1, 'x');
    expect(s.place('wall', pos)).toBe('ok');
    expect(s.inventory.stone).toBe(1);
    expect(s.place('wall', pos)).toBe('occupied');
    expect(s.place('door', posFor('door', 0, 2, 2, 'x'))).toBe('missing');
    expect(s.place('wall', posFor('floor', 0, 1, 1))).toBe('invalid');
    expect(s.removePiece(pos, { x: 0, z: 0 })).toBe('wall');
    expect(s.inventory.stone).toBe(5);
    expect(s.removePiece(pos, { x: 0, z: 0 })).toBeNull();
  });
  it('les pièces survivent à la sauvegarde', () => {
    const s = new GameState({ inventory: { wood: 4 } });
    s.place('floor', posFor('floor', 0, 0, 0));
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.pieces).toEqual(s.changes.pieces);
  });
  it('les pièces fermées sont recalculées après chaque modification', () => {
    const s = new GameState({ inventory: { wood: 20, stone: 40 } });
    s.place('floor', posFor('floor', 0, 0, 0));
    s.place('ceiling', posFor('ceiling', 0, 0, 0));
    s.place('door', posFor('door', 0, 0, 0, 'x'));
    expect(s.rooms()).toHaveLength(0);
    s.place('wall', posFor('wall', 0, 0, 1, 'x'));
    s.place('wall', posFor('wall', 0, 0, 0, 'z'));
    s.place('wall', posFor('wall', 0, 1, 0, 'z'));
    expect(s.rooms()).toHaveLength(1);
    s.removePiece(posFor('wall', 0, 0, 1, 'x'), { x: 0, z: 0 });
    expect(s.rooms()).toHaveLength(0);
  });
});
