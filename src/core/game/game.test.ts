import { describe, expect, it } from 'vitest';
import { Factory } from '../factory/factory';
import { aimCeiling, aimEdge, aimFloor, aimStairs, riseFromDirection } from '../build/aim';
import { evaluatePlan, planLine, planRect, planWall, rayOnEdgePlane } from '../build/plan';
import {
  edgeKeysToRemove,
  edgeState,
  isSupported,
  pieceKey,
  posFor,
  type Pieces,
} from '../build/pieces';
import { BAG_LIMITS, itemById } from '../data/items';
import { RESOURCES } from '../data/resources';
import { WorldGenerator, defaultWorldParams } from '../world/worldgen';
import { add, maxAddable, normalizeInventory, remove, totals } from './inventory';
import { distanceToFootprint, isWithinReach } from './reach';
import { GameState } from './state';
import { applyChanges, cellKey, emptyChanges, normalizeChanges } from './worldChanges';

describe('objets et sac', () => {
  it('le sac de départ fait 50 kg et 60 L', () => {
    expect(BAG_LIMITS).toEqual({
      maxWeightG: 50_000,
      maxVolumeMl: 60_000,
      maxSlots: 30,
      stackMax: 100,
    });
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
    expect(seen).toEqual(['harvest', 'inventory']);
  });
  it('jeter et ramasser préviennent aussi le sac (barre de raccourcis à jour)', () => {
    const s = new GameState({ inventory: { stone: 10 } });
    const seen: string[] = [];
    s.onChange((e) => seen.push(e.type));
    const stack = s.drop('stone', 4, 0, 0);
    expect(seen).toContain('inventory');
    seen.length = 0;
    s.pickUp(stack!.id);
    expect(seen).toContain('inventory');
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
  it('pose consomme 1 objet, démolir rend la pièce', () => {
    const s = new GameState({ inventory: { piece_wall_stone: 2 } });
    const pos = posFor('wall_stone', 0, 1, 1, 'x', 0);
    expect(s.place('wall_stone', pos)).toBe('ok');
    expect(s.inventory.piece_wall_stone).toBe(1);
    expect(s.place('wall_stone', pos)).toBe('occupied');
    expect(s.place('door_wood', posFor('door_wood', 0, 2, 2, 'x'))).toBe('missing');
    expect(s.place('wall_stone', posFor('floor_wood', 0, 1, 1))).toBe('invalid');
    expect(s.removeKeys([pieceKey(pos)], { x: 0, z: 0 })).toBe(1);
    // Démolir rend la pièce elle-même, pas ses ressources de fabrication.
    expect(s.inventory).toEqual({ piece_wall_stone: 2 });
    expect(s.removeKeys([pieceKey(pos)], { x: 0, z: 0 })).toBe(0);
  });
  it('les pièces survivent à la sauvegarde', () => {
    const s = new GameState({ inventory: { piece_floor_wood: 4 } });
    s.place('floor_wood', posFor('floor_wood', 0, 0, 0));
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.pieces).toEqual(s.changes.pieces);
  });
  it('les anciens objets de construction sont convertis', () => {
    const s = new GameState({ inventory: { piece_wall: 3, piece_door: 1 } });
    expect(s.inventory).toEqual({ piece_wall_stone: 3, piece_door_wood: 1 });
  });
  it('les pièces fermées sont recalculées après chaque modification', () => {
    const s = new GameState({
      inventory: {
        piece_floor_wood: 2,
        piece_ceiling_wood: 2,
        piece_door_wood: 2,
        piece_wall_stone: 20,
      },
    });
    s.place('floor_wood', posFor('floor_wood', 0, 0, 0));
    s.place('door_wood', posFor('door_wood', 0, 0, 0, 'x'));
    expect(s.rooms()).toHaveLength(0);
    s.placeMany('wall_stone', planLine('wall_stone', 0, 'x', 1, 0, 0, null));
    s.placeMany('wall_stone', planLine('wall_stone', 0, 'z', 0, 0, 0, null));
    s.placeMany('wall_stone', planLine('wall_stone', 0, 'z', 1, 0, 0, null));
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 0))).toBe('ok');
    expect(s.rooms()).toHaveLength(1);
    s.removeKeys([pieceKey(posFor('wall_stone', 0, 0, 1, 'x', 4))], { x: 0, z: 0 });
    expect(s.rooms()).toHaveLength(0);
  });
});

describe('pose par glisser', () => {
  const at = { x: 0, z: 0 };
  it("un rectangle de sols : vert tant qu'il y a du stock, rouge ensuite", () => {
    const plan = planRect('floor_wood', 0, { gx: 0, gz: 0 }, { gx: 2, gz: 1 });
    expect(plan).toHaveLength(6);
    const res = evaluatePlan('floor_wood', plan, {}, 4, at, 6);
    expect(res.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'lack', 'lack']);
    expect(res[0].pos).toMatchObject({ gx: 0, gz: 0 }); // on commence près du point de départ
  });
  it('les cases occupées et hors de portée ne sont pas comptées', () => {
    const p: Pieces = { [pieceKey(posFor('floor_wood', 0, 1, 0))]: 'floor_wood' };
    const res = evaluatePlan(
      'floor_wood',
      planRect('floor_wood', 0, { gx: 0, gz: 0 }, { gx: 30, gz: 0 }),
      p,
      100,
      at,
      3,
    );
    expect(res[1].status).toBe('occupied');
    expect(res.filter((r) => r.status === 'far').length).toBeGreaterThan(20);
  });
  it('un mur en ligne : 5 blocs par colonne, ou un seul niveau pour faire fenêtres et trous', () => {
    expect(planLine('wall_stone', 0, 'x', 3, 2, 5, null)).toHaveLength(20);
    expect(planLine('wall_stone', 0, 'x', 3, 5, 2, [2])).toHaveLength(4);
    expect(planLine('door_wood', 0, 'x', 3, 2, 5, null)).toHaveLength(1);
  });
  it("placeMany s'arrête faute de stock", () => {
    const s = new GameState({ inventory: { piece_floor_wood: 3 } });
    expect(
      s.placeMany('floor_wood', planRect('floor_wood', 0, { gx: 0, gz: 0 }, { gx: 4, gz: 0 })),
    ).toBe(3);
    expect(s.inventory.piece_floor_wood).toBeUndefined();
  });
  it("retirer un seul bloc d'un mur fait une fenêtre", () => {
    const s = new GameState({ inventory: { piece_wall_stone: 5 } });
    s.placeMany('wall_stone', planLine('wall_stone', 0, 'x', 0, 0, 0, null));
    const pos = posFor('wall_stone', 0, 0, 0, 'x');
    expect(edgeKeysToRemove(s.changes.pieces, pos, [2])).toEqual([pieceKey({ ...pos, layer: 2 })]);
    expect(edgeKeysToRemove(s.changes.pieces, pos, null)).toHaveLength(5);
    s.removeKeys(edgeKeysToRemove(s.changes.pieces, pos, [2]), at);
    expect(edgeState(s.changes.pieces, pos)).toBe('open');
  });
});

describe('fabrication et cases du sac', () => {
  it('fabrique 1 ou 5 unités selon les ressources', () => {
    const s = new GameState({ inventory: { stone: 6 } });
    expect(s.craft('piece_wall_stone', 1)).toEqual({ made: 1, stopped: null });
    expect(s.inventory).toEqual({ stone: 5, piece_wall_stone: 1 });
    expect(s.craft('piece_wall_stone', 8)).toEqual({ made: 5, stopped: 'resources' });
    expect(s.inventory).toEqual({ piece_wall_stone: 6 });
  });
  it('ne fabrique pas une ressource brute ni sans ingrédients', () => {
    const s = new GameState({ inventory: {} });
    expect(s.craft('stone', 1).made).toBe(0);
    expect(s.craft('piece_door_wood', 1)).toEqual({ made: 0, stopped: 'resources' });
  });
  it('une pile fait 100 au plus et les cases du sac sont limitées', () => {
    const limits = { maxWeightG: 1e9, maxVolumeMl: 1e9, maxSlots: 2, stackMax: 100 };
    expect(maxAddable({}, 'coal', limits)).toBe(200);
    expect(maxAddable(add({}, 'coal', 150), 'coal', limits)).toBe(50);
    expect(maxAddable(add({}, 'coal', 150), 'wood', limits)).toBe(0); // les 2 cases sont prises
  });
});

describe('murs en plan vertical', () => {
  it('un rectangle de blocs entre deux coins', () => {
    const plan = planWall('wall_stone', 0, 'x', 3, { i: 2, layer: 0 }, { i: 4, layer: 1 });
    expect(plan).toHaveLength(6);
    expect(plan[0]).toMatchObject({ gx: 2, gz: 3, layer: 0 }); // on part du bloc de départ
    expect(planWall('door_wood', 0, 'x', 3, { i: 2, layer: 0 }, { i: 5, layer: 4 })).toHaveLength(
      1,
    );
  });
  it('trouve le bloc visé dans le plan du mur', () => {
    // Œil à 1,6 m, 2 m devant le mur z = 1,5 m (ligne 3), regard légèrement vers le bas.
    const hit = rayOnEdgePlane({ x: 0.2, y: 1.6, z: -0.5 }, { x: 0, y: -0.2, z: 0.98 }, 'x', 3, 0);
    expect(hit).toEqual({ i: 0, layer: 2 });
    expect(
      rayOnEdgePlane({ x: 0, y: 1.6, z: -0.5 }, { x: 1, y: 0, z: 0.05 }, 'x', 3, 0),
    ).toBeNull(); // rasant
    expect(
      rayOnEdgePlane({ x: 0, y: 1.6, z: -0.5 }, { x: 0, y: 0.9, z: 0.4 }, 'x', 3, 0),
    ).toBeNull(); // trop haut
  });
});

describe('murs soutenus', () => {
  it('un bloc ne se pose pas dans le vide, mais au sol ou contre un autre mur', () => {
    const s = new GameState({ inventory: { piece_wall_stone: 20 } });
    expect(s.place('wall_stone', posFor('wall_stone', 0, 3, 3, 'x', 2))).toBe('unsupported');
    expect(s.place('wall_stone', posFor('wall_stone', 0, 3, 3, 'x', 0))).toBe('ok'); // au sol
    expect(s.place('wall_stone', posFor('wall_stone', 0, 3, 3, 'x', 2))).toBe('unsupported'); // trou entre les deux
    expect(s.place('wall_stone', posFor('wall_stone', 0, 3, 3, 'x', 1))).toBe('ok'); // au-dessus
    expect(s.place('wall_stone', posFor('wall_stone', 0, 4, 3, 'x', 1))).toBe('ok'); // à côté
    expect(s.place('wall_stone', posFor('wall_stone', 0, 5, 3, 'z', 1))).toBe('ok'); // dans l'angle
    expect(s.place('wall_stone', posFor('wall_stone', 0, 9, 9, 'z', 3))).toBe('unsupported');
  });
  it("l'aperçu : un pan de mur partant du sol est entièrement posable, un pan en l'air non", () => {
    const away = { x: 0, z: 0 };
    const grounded = planWall('wall_stone', 0, 'x', 1, { i: 0, layer: 0 }, { i: 2, layer: 4 });
    expect(
      evaluatePlan('wall_stone', grounded, {}, 100, away, 6).every((i) => i.status === 'ok'),
    ).toBe(true);
    const floating = planWall('wall_stone', 0, 'x', 1, { i: 0, layer: 2 }, { i: 2, layer: 4 });
    expect(
      evaluatePlan('wall_stone', floating, {}, 100, away, 6).every(
        (i) => i.status === 'unsupported',
      ),
    ).toBe(true);
  });
  it("un encadrement : un pan en hauteur est posable à côté d'un mur existant", () => {
    const s = new GameState({ inventory: { piece_wall_stone: 30 } });
    s.placeMany(
      'wall_stone',
      planWall('wall_stone', 0, 'x', 1, { i: 0, layer: 0 }, { i: 0, layer: 4 }),
    );
    const frame = planWall('wall_stone', 0, 'x', 1, { i: 1, layer: 3 }, { i: 2, layer: 4 });
    const plan = evaluatePlan('wall_stone', frame, s.changes.pieces, 30, { x: 0, z: 0 }, 6);
    expect(plan.every((i) => i.status === 'ok')).toBe(true);
    expect(s.placeMany('wall_stone', frame)).toBe(4);
  });
});

describe('visée assistée des murs', () => {
  const eye = { x: 0.2, y: 1.6, z: -2 };
  it('regard vers le sol : le bloc du bas du bord le plus proche', () => {
    const hit = aimEdge(eye, { x: 0, y: -0.5, z: 0.866 }, {}, 'wall_stone', 0, 10);
    expect(hit?.pos.layer).toBe(0);
  });
  it("regard en l'air loin de tout mur : retombe au sol, jamais dans le vide", () => {
    const hit = aimEdge(eye, { x: 0, y: 0.3, z: 0.95 }, {}, 'wall_stone', 0, 10);
    expect(hit?.pos.layer).toBe(0);
  });
  it('colle à un mur existant : le bloc au-dessus est proposé', () => {
    const pieces: Pieces = {};
    for (let l = 0; l < 2; l++)
      pieces[pieceKey(posFor('wall_stone', 0, 0, 1, 'x', l))] = 'wall_stone';
    // Regard vers le bord z = 0,5 m à ~1,2 m de haut, juste au-dessus des 2 blocs posés (1 m).
    const o = { x: 0.25, y: 1.2, z: -1 };
    const hit = aimEdge(o, { x: 0, y: 0, z: 1 }, pieces, 'wall_stone', 0, 10);
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 1, axis: 'x', layer: 2 });
  });
  it('en mode démolition, ne vise que ce qui existe', () => {
    const pieces: Pieces = { [pieceKey(posFor('wall_stone', 0, 0, 1, 'x', 0))]: 'wall_stone' };
    expect(
      aimEdge(
        { ...eye, x: 1.7 },
        { x: 0, y: -0.5, z: 0.866 },
        pieces,
        'wall_stone',
        0,
        10,
        'remove',
      ),
    ).toBeNull();
    const o = { x: 0.25, y: 0.25, z: -1 };
    expect(aimEdge(o, { x: 0, y: 0, z: 1 }, pieces, 'wall_stone', 0, 10, 'remove')?.pos.layer).toBe(
      0,
    );
  });
});

describe('plafonds accrochés aux murs', () => {
  const walls = (s: GameState): void => {
    // Un carré de 3 x 3 cases de murs pleins (4 côtés).
    for (let i = 0; i < 3; i++) {
      s.placeMany(
        'wall_stone',
        planWall('wall_stone', 0, 'x', 0, { i, layer: 0 }, { i, layer: 4 }),
      );
      s.placeMany(
        'wall_stone',
        planWall('wall_stone', 0, 'x', 3, { i, layer: 0 }, { i, layer: 4 }),
      );
      s.placeMany(
        'wall_stone',
        planWall('wall_stone', 0, 'z', 0, { i, layer: 0 }, { i, layer: 4 }),
      );
      s.placeMany(
        'wall_stone',
        planWall('wall_stone', 0, 'z', 3, { i, layer: 0 }, { i, layer: 4 }),
      );
    }
  };
  it("pas de plafond dans le vide, mais contre le haut d'un mur", () => {
    const s = new GameState({ inventory: { piece_ceiling_wood: 20, piece_wall_stone: 60 } });
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 1, 1))).toBe('unsupported');
    walls(s);
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 0))).toBe('ok'); // coin : touche 2 murs
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 1, 1))).toBe('unsupported'); // le centre touche seulement en diagonale
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 1, 0))).toBe('ok');
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 1, 1))).toBe('ok'); // prolonge la dalle
  });
  it('un mur trop bas ne porte pas de plafond', () => {
    const s = new GameState({ inventory: { piece_ceiling_wood: 5, piece_wall_stone: 20 } });
    s.placeMany(
      'wall_stone',
      planWall('wall_stone', 0, 'x', 0, { i: 0, layer: 0 }, { i: 0, layer: 3 }),
    );
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 0))).toBe('unsupported');
  });
  it("le tracé : vert jusqu'à 3 cases d'un mur, rouge au-delà", () => {
    const s = new GameState({ inventory: { piece_wall_stone: 60 } });
    walls(s);
    const plan = evaluatePlan(
      'ceiling_wood',
      planRect('ceiling_wood', 0, { gx: 0, gz: 0 }, { gx: 9, gz: 0 }),
      s.changes.pieces,
      100,
      { x: 0, z: 0 },
      12,
    );
    const status = plan.map((p) => p.status);
    expect(status.slice(0, 4)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(status[9]).toBe('unsupported');
  });
});

describe('visée des plafonds', () => {
  const wall = (): Pieces => {
    const p: Pieces = {};
    for (let l = 0; l < 5; l++) p[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
    return p;
  };
  it('viser la face du mur, près du haut, accroche la dalle de son côté', () => {
    // Œil à 1,6 m, 2 m devant le mur (z = 1 m), qui monte à 2,5 m : regard vers le haut du mur.
    const o = { x: 0.25, y: 1.6, z: -1 };
    const d = { x: 0, y: 0.3, z: 0.954 }; // coupe z=1 m à y ≈ 2,4 m
    const hit = aimCeiling(o, d, wall(), 'ceiling_wood', 0, 10);
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 1 }); // la dalle côté œil, contre le mur
    expect(isSupported(wall(), 'ceiling_wood', hit!.pos)).toBe(true);
  });
  it('sans mur à portée : retombe sur la case du plan du plafond', () => {
    const hit = aimCeiling(
      { x: 0, y: 1.6, z: 0 },
      { x: 0, y: 0.5, z: 0.866 },
      {},
      'ceiling_wood',
      0,
      10,
    );
    expect(hit?.pos.slot).toBe('ceiling');
  });
});

describe('plafond sur un mur bas', () => {
  it("se pose sur la tranche haute d'un mur d'un seul bloc, à sa hauteur", () => {
    const s = new GameState({ inventory: { piece_wall_stone: 3, piece_ceiling_wood: 6 } });
    s.place('wall_stone', posFor('wall_stone', 0, 0, 2, 'x', 0));
    // Dalle sur le bloc 0 : de chaque côté du mur.
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 1, undefined, 0))).toBe('ok');
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 2, undefined, 0))).toBe('ok');
    // Pas à une autre hauteur, ni deux dalles dans la même case.
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 1, undefined, 3))).toBe('occupied');
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 5, 5, undefined, 0))).toBe(
      'unsupported',
    );
  });
  it('un mur plus haut ne porte pas une dalle posée à mi-hauteur', () => {
    const s = new GameState({ inventory: { piece_wall_stone: 3, piece_ceiling_wood: 2 } });
    s.placeMany(
      'wall_stone',
      planWall('wall_stone', 0, 'x', 2, { i: 0, layer: 0 }, { i: 0, layer: 1 }),
    );
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 1, undefined, 0))).toBe(
      'unsupported',
    );
    expect(s.place('ceiling_wood', posFor('ceiling_wood', 0, 0, 1, undefined, 1))).toBe('ok');
  });
  it('la visée choisit la hauteur du mur visé', () => {
    const pieces: Pieces = { [pieceKey(posFor('wall_stone', 0, 0, 2, 'x', 0))]: 'wall_stone' };
    const hit = aimCeiling(
      { x: 0.25, y: 0.5, z: -1 },
      { x: 0, y: 0.05, z: 1 },
      pieces,
      'ceiling_wood',
      0,
      10,
    );
    expect(hit?.pos).toMatchObject({ gz: 1, layer: 0 });
  });
});

describe('barre de raccourcis et orientation', () => {
  it('une case vide ne se sélectionne pas, une case pleine se bascule', () => {
    const s = new GameState({ inventory: {} });
    s.selectSlot(0);
    expect(s.selectedSlot).toBeNull();
    s.assignSlot(0, 'piece_wall_stone');
    s.selectSlot(0);
    expect(s.selectedItem()).toBe('piece_wall_stone');
    s.selectSlot(0);
    expect(s.selectedSlot).toBeNull();
  });
  it("un objet n'occupe qu'une case ; vider la case sélectionnée la désélectionne", () => {
    const s = new GameState({ inventory: {} });
    s.assignSlot(0, 'stone');
    s.assignSlot(3, 'stone');
    expect(s.changes.hotbar.slice(0, 4)).toEqual([null, null, null, 'stone']);
    s.selectSlot(3);
    s.assignSlot(3, null);
    expect(s.selectedSlot).toBeNull();
  });
  it('fabriquer une pièce la range dans la première case libre', () => {
    const s = new GameState({ inventory: { stone: 3 } });
    s.assignSlot(0, 'coal');
    s.craft('piece_wall_stone', 1);
    expect(s.changes.hotbar[1]).toBe('piece_wall_stone');
  });
  it('la barre et les orientations sont enregistrées', () => {
    const s = new GameState({ inventory: { piece_wall_stone: 2 } });
    s.assignSlot(2, 'piece_wall_stone');
    const pos = posFor('wall_stone', 0, 0, 0, 'z', 0);
    s.place('wall_stone', pos, 3);
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.hotbar[2]).toBe('piece_wall_stone');
    expect(copy.changes.rotations[pieceKey(pos)]).toBe(3);
    copy.removeKeys([pieceKey(pos)], { x: 0, z: 0 });
    expect(copy.changes.rotations).toEqual({});
  });
  it("l'orientation imposée limite la visée aux bords de cet axe", () => {
    const eye = { x: 0.3, y: 1.6, z: -2 };
    const down = { x: 0.1, y: -0.5, z: 0.85 };
    expect(aimEdge(eye, down, {}, 'wall_stone', 0, 10, 'place', 'x')?.pos.axis).toBe('x');
    expect(aimEdge(eye, down, {}, 'wall_stone', 0, 10, 'place', 'z')?.pos.axis).toBe('z');
  });
});

describe('pose contre le mur visé', () => {
  const wall = (): Pieces => {
    const p: Pieces = {};
    for (let l = 0; l < 2; l++) p[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
    return p;
  };
  // Mur le long de x à z = 1 m, 2 blocs de haut (1 m), colonne x ∈ [0 ; 0,5].
  it("viser le haut d'un bloc pose le bloc au-dessus, pas au sol derrière le mur", () => {
    const eye = { x: 0.25, y: 1.6, z: -2 };
    // Le rayon descend et touche le mur vers y = 0,9 m (haut du bloc 2).
    const dir = { x: 0, y: -0.7 / 3, z: 1 };
    const hit = aimEdge(eye, dir, wall(), 'wall_stone', 0, 12, 'place', 'x');
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 2, axis: 'x', layer: 2 });
  });
  it('viser le bord latéral pose le bloc voisin', () => {
    const eye = { x: 0.45, y: 1.6, z: -2 };
    const hit = aimEdge(eye, { x: 0, y: -0.45, z: 1 }, wall(), 'wall_stone', 0, 12, 'place', 'x');
    expect(hit?.pos).toMatchObject({ gx: 1, gz: 2, layer: 0 });
  });
  it("orientation perpendiculaire : un bloc d'angle au bout du mur", () => {
    const eye = { x: 0.45, y: 1.6, z: -2 };
    const hit = aimEdge(eye, { x: 0, y: -0.45, z: 1 }, wall(), 'wall_stone', 0, 12, 'place', 'z');
    expect(hit?.pos.axis).toBe('z');
    expect(hit?.pos.gx).toBe(1);
  });
});

describe('orientation automatique', () => {
  it('vu de face, un mur le long de z reçoit le bloc au-dessus même sans orientation choisie', () => {
    const pieces: Pieces = {};
    for (let l = 0; l < 2; l++)
      pieces[pieceKey(posFor('wall_stone', 0, 2, 0, 'z', l))] = 'wall_stone';
    // Mur à x = 1 m, colonne z ∈ [0 ; 0,5], vu depuis x = -2 (de face), haut du bloc 2.
    const hit = aimEdge(
      { x: -2, y: 1.6, z: 0.25 },
      { x: 1, y: -0.23, z: 0 },
      pieces,
      'wall_stone',
      0,
      12,
    );
    expect(hit?.pos).toMatchObject({ gx: 2, gz: 0, axis: 'z', layer: 2 });
  });
});

describe('escaliers', () => {
  it('une marche se pose au sol ; la suivante, dans son prolongement un bloc plus haut', () => {
    const s = new GameState({ inventory: { piece_stairs_wood: 5 } });
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 0, undefined, 0, 0))).toBe('ok');
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 3, 3, undefined, 1, 0))).toBe(
      'unsupported',
    ); // dans le vide
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 1, undefined, 1, 0))).toBe('ok'); // suite de la volée
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 1, undefined, 1, 0))).toBe(
      'occupied',
    );
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 1, 1, undefined, 1, 0))).toBe(
      'unsupported',
    ); // pas dans l\'axe
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 2, undefined, 2, 2))).toBe(
      'unsupported',
    ); // sens contraire
  });
  it('les marches se sauvegardent avec leur sens', () => {
    const s = new GameState({ inventory: { piece_stairs_stone: 1 } });
    s.place('stairs_stone', posFor('stairs_stone', 0, 2, 2, undefined, 0, 3));
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(Object.keys(copy.changes.pieces)).toEqual(['s:0:2,2:0:3']);
  });
  it('la visée : sens du regard, prolongement de la volée, démolition', () => {
    expect(riseFromDirection(0, 1)).toBe(0);
    expect(riseFromDirection(-1, 0.1)).toBe(3);
    const eye = { x: 0.25, y: 1.6, z: -2 };
    const down = { x: 0, y: -0.5, z: 1 };
    const first = aimStairs(eye, down, {}, 'stairs_wood', 0, 10);
    expect(first?.pos).toMatchObject({ layer: 0, rot: 0 });
    const flight: Pieces = { [pieceKey(first!.pos)]: 'stairs_wood' };
    // Un regard qui tombe juste après le haut de la marche prolonge la volée.
    const next = aimStairs(
      { x: first!.pos.gx * 0.5 + 0.25, y: 1.6, z: (first!.pos.gz + 1.5) * 0.5 - 3.2 },
      { x: 0, y: -0.5, z: 1 },
      flight,
      'stairs_wood',
      0,
      10,
    );
    expect(next?.pos).toMatchObject({ gz: first!.pos.gz + 1, layer: 1, rot: 0 });
    // En démolition, on vise la marche touchée (et seulement elle).
    const removed = aimStairs(
      { x: 0.25, y: 0.2, z: -1 },
      { x: 0, y: 0, z: 1 },
      flight,
      'stairs_wood',
      0,
      10,
      'remove',
    );
    expect(removed?.pos).toMatchObject(first!.pos);
    expect(
      aimStairs(
        { x: 3.25, y: 0.2, z: -1 },
        { x: 0, y: 0, z: 1 },
        flight,
        'stairs_wood',
        0,
        10,
        'remove',
      ),
    ).toBeNull();
  });
});

describe('accrocher au premier objet visé', () => {
  const down = { x: 0, y: -0.5, z: 1 };
  it('sol : sur le terrain, la case sous le curseur', () => {
    const hit = aimFloor({ x: 0.25, y: 1.6, z: -2 }, down, {}, 'floor_wood', 0, 12);
    expect(hit?.pos).toMatchObject({ slot: 'floor', gx: 0, gz: 2 });
  });
  it('sol : sur une dalle existante, on la prolonge du côté visé', () => {
    const pieces: Pieces = { [pieceKey(posFor('floor_wood', 0, 0, 2))]: 'floor_wood' };
    // Le rayon tombe tout près du bord z = 1,5 m de la case (0,2) : on prolonge vers la case (0,3).
    const hit = aimFloor({ x: 0.25, y: 1.6, z: -1.6 }, down, pieces, 'floor_wood', 0, 12);
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 3 });
  });
  it("sol : contre un mur visé, du côté de l'œil, pas derrière", () => {
    const pieces: Pieces = {};
    for (let l = 0; l < 5; l++)
      pieces[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
    // Rayon quasi horizontal qui touche le mur (z = 1 m) à 1,4 m de haut.
    const hit = aimFloor(
      { x: 0.25, y: 1.6, z: -2 },
      { x: 0, y: -0.07, z: 1 },
      pieces,
      'floor_wood',
      0,
      12,
    );
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 1 }); // case devant le mur (z de 0,5 à 1 m)
  });
  it('mur : sur une dalle de plafond touchée, le bloc se pose dessus', () => {
    const pieces: Pieces = {};
    pieces[pieceKey(posFor('ceiling_wood', 0, 5, 4, undefined, 1))] = 'ceiling_wood';
    // Rayon qui descend sur le dessus de la dalle (haut à 1,003 m), cellule (5, 4) : x 2,5-3, z 2-2,5.
    const hit = aimEdge(
      { x: 2.75, y: 2.2, z: 1.0 },
      { x: 0, y: -1.2, z: 1 },
      pieces,
      'wall_stone',
      0,
      12,
    );
    expect(hit?.pos.layer).toBe(2);
  });
  it('escalier : viser une marche prolonge la volée', () => {
    const pieces: Pieces = {
      [pieceKey(posFor('stairs_wood', 0, 0, 2, undefined, 0, 0))]: 'stairs_wood',
    };
    // Œil à 0,3 m de haut, regard horizontal sur la marche (z 1-1,5 m).
    const hit = aimStairs(
      { x: 0.25, y: 0.3, z: -1 },
      { x: 0, y: 0, z: 1 },
      pieces,
      'stairs_wood',
      0,
      12,
    );
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 3, layer: 1, rot: 0 });
  });
});

describe('escalier contre un mur visé', () => {
  it('se pose au pied du mur, côté œil, et monte vers lui', () => {
    const pieces: Pieces = {};
    for (let l = 0; l < 5; l++)
      pieces[pieceKey(posFor('wall_stone', 0, 0, 4, 'x', l))] = 'wall_stone'; // z = 2 m
    const hit = aimStairs(
      { x: 0.25, y: 1.6, z: -2 },
      { x: 0, y: -0.15, z: 1 },
      pieces,
      'stairs_wood',
      0,
      12,
    );
    expect(hit?.pos).toMatchObject({ gx: 0, gz: 3, layer: 0, rot: 0 }); // case devant le mur, monte vers +z
    const back = aimStairs(
      { x: 0.25, y: 1.6, z: 6 },
      { x: 0, y: -0.15, z: -1 },
      pieces,
      'stairs_wood',
      0,
      12,
    );
    expect(back?.pos).toMatchObject({ gx: 0, gz: 4, rot: 2 }); // de l\'autre côté, monte vers -z
  });
});

describe('dalle : un seul objet pour sol et plafond', () => {
  it('posée au sol elle fait un sol, sur un mur un plafond', () => {
    const s = new GameState({ inventory: { piece_slab_wood: 3, piece_wall_stone: 5 } });
    expect(s.place('slab_wood', posFor('floor_wood', 0, 0, 0))).toBe('ok');
    s.placeMany(
      'wall_stone',
      planWall('wall_stone', 0, 'x', 0, { i: 2, layer: 0 }, { i: 2, layer: 4 }),
    );
    expect(s.place('slab_wood', posFor('ceiling_wood', 0, 2, 0))).toBe('ok');
    expect(Object.values(s.changes.pieces)).toContain('floor_wood');
    expect(Object.values(s.changes.pieces)).toContain('ceiling_wood');
    expect(s.inventory.piece_slab_wood).toBe(1);
    // Démolir rend la dalle.
    s.removeKeys([pieceKey(posFor('floor_wood', 0, 0, 0))], { x: 0, z: 0 });
    expect(s.inventory.piece_slab_wood).toBe(2);
  });
  it('les anciens sols et plafonds du sac et de la barre deviennent des dalles', () => {
    const s = new GameState({
      inventory: { piece_floor_wood: 2, piece_ceiling_wood: 3, piece_floor_stone: 1 },
      changes: { hotbar: ['piece_ceiling_wood', 'piece_floor_wood', null] },
    });
    expect(s.inventory).toEqual({ piece_slab_wood: 5, piece_slab_stone: 1 });
    expect(s.changes.hotbar.slice(0, 3)).toEqual(['piece_slab_wood', null, null]);
  });
  it("la visée : plafond sur le haut d'un mur, sinon sol", () => {
    const wall: Pieces = {};
    for (let l = 0; l < 5; l++)
      wall[pieceKey(posFor('wall_stone', 0, 0, 2, 'x', l))] = 'wall_stone';
    expect(
      aimCeiling(
        { x: 0.25, y: 1.6, z: -1 },
        { x: 0, y: 0.3, z: 0.954 },
        wall,
        'ceiling_wood',
        0,
        10,
        'place',
        true,
      )?.pos.slot,
    ).toBe('ceiling');
    expect(
      aimCeiling(
        { x: 0.25, y: 1.6, z: -1 },
        { x: 0, y: -0.6, z: 0.8 },
        {},
        'ceiling_wood',
        0,
        10,
        'place',
        true,
      ),
    ).toBeNull();
  });
});

describe('machines et tapis dans la partie', () => {
  const none = (): boolean => false;
  const noWorld = { oreAt: () => null, mineOre: () => 0 };
  it("poser consomme l'objet, démolir rend la machine et le contenu", () => {
    const s = new GameState({ inventory: { machine_furnace: 1, coal: 2, iron_ore: 3 } });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'furnace', 4, 4, 0, none)).toBe('ok');
    expect(s.placeMachine(f, 'furnace', 8, 8, 0, none)).toBe('missing');
    const m = s.changes.machines[0];
    expect(s.loadMachine(m, 'fuel', 'coal', 5)).toBe(2);
    expect(s.loadMachine(m, 'input', 'iron_ore', 3)).toBe(3);
    expect(s.loadMachine(m, 'input', 'coal', 1)).toBe(0); // le charbon ne se cuit pas
    expect(s.inventory).toEqual({});
    expect(s.removeMachine(f, m.id, { x: 0, z: 0 })).toBe(true);
    // la machine + 2 charbon + 3 minerais
    expect(s.inventory).toEqual({ machine_furnace: 1, coal: 2, iron_ore: 3 });
    expect(s.changes.machines).toHaveLength(0);
  });
  it('on ne pose pas deux machines au même endroit ; reprendre le stock', () => {
    const s = new GameState({ inventory: { machine_conveyor: 2 } });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'conveyor', 1, 1, 0, none)).toBe('ok');
    expect(s.placeMachine(f, 'conveyor', 1, 1, 2, none)).toBe('blocked');
    const m = s.changes.machines[0];
    m.stock = { item: 'iron_ingot', count: 4 };
    expect(s.unloadMachine(m, 'stock')).toBe(4);
    expect(s.inventory.iron_ingot).toBe(4);
    expect(m.stock).toBeNull();
  });
  it('les machines sont enregistrées avec la partie', () => {
    const s = new GameState({ inventory: { machine_drill: 1 } });
    const f = new Factory(s.changes.machines, noWorld);
    s.placeMachine(f, 'drill', 0, 0, 1, none);
    s.changes.machines[0].fuel = { item: 'coal', count: 3 };
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.machines).toEqual(s.changes.machines);
    expect(copy.changes.nextMachineId).toBe(2);
  });
  it("l'usine épuise vraiment les cases du monde", () => {
    const s = new GameState({ inventory: {} });
    expect(s.takeFromWorld('3,4', 5, 2)).toBe(2);
    expect(s.takeFromWorld('3,4', 5, 9)).toBe(3);
    expect(s.takeFromWorld('3,4', 5, 1)).toBe(0);
  });
});

describe('coffre dans la partie', () => {
  it('on y range du sac, on reprend, et démolir rend le contenu', () => {
    const noWorld = { oreAt: () => null, mineOre: () => 0 };
    const s = new GameState({ inventory: { machine_chest_wood: 1, stone: 30, wood: 5 } });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'chest_wood', 2, 2, 0, () => false)).toBe('ok');
    const c = s.changes.machines[0];
    expect(s.putInChest(c, 'stone', 100)).toBe(30);
    expect(s.inventory).toEqual({ wood: 5 });
    expect(s.takeFromChest(c, 0)).toBe(30);
    expect(c.slots).toHaveLength(0);
    s.putInChest(c, 'wood', 3);
    expect(s.removeMachine(f, c.id, { x: 0, z: 0 })).toBe(true);
    expect(s.inventory.stone).toBe(30);
    expect(s.inventory.machine_chest_wood).toBe(1);
    expect(s.inventory.wood).toBe(5); // 2 restants + 3 rangés
  });
});

describe('battant de porte', () => {
  it("s'ouvre et se ferme, est enregistré, et disparaît avec la porte", () => {
    const s = new GameState({ inventory: { piece_door_wood: 1 } });
    const pos = posFor('door_wood', 0, 1, 1, 'z');
    s.place('door_wood', pos);
    const key = pieceKey(pos);
    expect(s.toggleDoor(key)).toBe(true);
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.pieces['o:0:1,1:z']).toBe('door_wood');
    expect(copy.toggleDoor(key)).toBe(false);
    expect(copy.changes.pieces['o:0:1,1:z']).toBeUndefined();
    s.removeKeys([key], { x: 0, z: 0 });
    expect(Object.keys(s.changes.pieces)).toEqual([]);
    expect(s.toggleDoor(key)).toBeNull();
  });
  it("une marque d'ouverture sans porte est ignorée", () => {
    const s = new GameState({ changes: { pieces: { 'o:0:5,5:x': 'door_wood' } } });
    expect(s.changes.pieces).toEqual({});
  });
});

describe('prendre une quantité', () => {
  it('reprendre une partie d’un coffre ou d’une machine', () => {
    const noWorld = { oreAt: () => null, mineOre: () => 0 };
    const s = new GameState({ inventory: { machine_chest_wood: 1, stone: 30 } });
    const f = new Factory(s.changes.machines, noWorld);
    s.placeMachine(f, 'chest_wood', 2, 2, 0, () => false);
    const c = s.changes.machines[0];
    s.putInChest(c, 'stone', 30);
    expect(s.takeFromChest(c, 0, 15)).toBe(15);
    expect(c.slots[0].count).toBe(15);
    expect(s.inventory.stone).toBe(15);
    expect(s.takeFromChest(c, 0)).toBe(15);
  });
});

describe('pile au bout du curseur', () => {
  it('prendre, ranger, déposer dans une machine (le reste reste en main) et sauvegarder', () => {
    const s = new GameState({ inventory: { coal: 40, machine_furnace: 1 } });
    expect(s.takeToHand('coal', 20)).toBe(20);
    expect(s.inventory.coal).toBe(20);
    expect(s.hand).toEqual({ item: 'coal', count: 20 });
    // la pile tenue fait partie du sac dans la sauvegarde
    expect(s.snapshot().inventory.coal).toBe(40);
    expect(s.returnHand()).toBe(20);
    expect(s.inventory.coal).toBe(40);
    expect(s.hand).toBeNull();

    const f = new Factory(s.changes.machines, { oreAt: () => null, mineOre: () => 0 });
    s.placeMachine(f, 'furnace', 4, 4, 0, () => false);
    const m = s.changes.machines[0];
    s.takeToHand('coal', 40);
    // la case de combustible accepte 100 : tout passe
    expect(s.useHand((item, n) => s.loadMachine(m, 'fuel', item, n))).toBe(40);
    expect(s.hand).toBeNull();
    expect(m.fuel?.count).toBe(40);
    // un objet refusé reste en main
    s.inventory = { iron_ingot: 5 };
    s.takeToHand('iron_ingot', 5);
    expect(s.useHand((item, n) => s.loadMachine(m, 'fuel', item, n))).toBe(0);
    expect(s.hand).toEqual({ item: 'iron_ingot', count: 5 });
    expect(s.inventory.iron_ingot ?? 0).toBe(0);
  });
});

describe('assembleur dans la partie', () => {
  it('choisir une recette, charger des ingrédients, changer de recette rend tout au sac', () => {
    const noWorld = { oreAt: () => null, mineOre: () => 0 };
    const s = new GameState({
      inventory: { machine_assembler: 1, iron_ingot: 10, copper_ingot: 4 },
    });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'assembler', 4, 4, 0, () => false)).toBe('ok');
    const m = s.changes.machines[0];
    expect(s.loadIngredient(m, 'iron_ingot', 5)).toBe(0); // pas de recette
    expect(s.setRecipe(m, 'machine_conveyor')).toBe(true);
    expect(s.loadIngredient(m, 'copper_ingot', 4)).toBe(0); // pas un ingrédient
    expect(s.loadIngredient(m, 'iron_ingot', 100)).toBe(10); // plafonné à 10 pour 1 par objet
    expect(s.inventory.iron_ingot ?? 0).toBe(0);
    expect(s.setRecipe(m, 'stone')).toBe(false); // une matière brute ne se fabrique pas
    expect(s.setRecipe(m, null)).toBe(true);
    expect(s.inventory.iron_ingot).toBe(10);
  });
});

describe('équipement et sac à dos', () => {
  it('équiper un sac à dos agrandit le sac, le retirer le rend (si le sac tient encore)', () => {
    const s = new GameState({ inventory: { backpack: 1, stone: 40 } });
    const base = s.limits.maxSlots;
    expect(s.equip('backpack')).toBe('ok');
    expect(s.inventory.backpack ?? 0).toBe(0);
    expect(s.limits.maxSlots).toBe(base + 10);
    expect(s.limits.maxWeightG).toBeGreaterThan(s.baseLimitsView().maxWeightG);
    // On remplit au-delà de la capacité de base : le sac à dos ne peut plus être retiré.
    s.inventory = { stone: 48 };
    expect(s.unequip('torso')).toBe('bagFull');
    expect(s.changes.equipment.torso).toBe('backpack');
    s.inventory = { stone: 10 };
    expect(s.unequip('torso')).toBe('ok');
    expect(s.inventory.backpack).toBe(1);
    expect(s.limits.maxSlots).toBe(base);
  });

  it('un équipement va sur son emplacement ; l’ancien revient au sac ; sauvegardé', () => {
    const s = new GameState({ inventory: { hood: 2, wood: 1 } });
    expect(s.equip('wood')).toBe('notEquipment');
    expect(s.equip('hood')).toBe('ok');
    expect(s.equip('hood')).toBe('ok');
    expect(s.inventory.hood).toBe(1);
    expect(s.changes.equipment.head).toBe('hood');
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.equipment.head).toBe('hood');
  });

  it('une sauvegarde ne peut pas mettre un objet sur le mauvais emplacement', () => {
    const s = new GameState({ changes: { equipment: { head: 'backpack', legs: 'trousers' } } });
    expect(s.changes.equipment).toEqual({ legs: 'trousers' });
  });
});

describe('technologies', () => {
  it('fabriquer un objet verrouillé est refusé tant que la technologie n’est pas recherchée', () => {
    const s = new GameState({ inventory: { iron_ingot: 25 } });
    expect(s.isUnlocked('machine_splitter')).toBe(false);
    expect(s.craft('machine_splitter', 1)).toEqual({ made: 0, stopped: 'locked' });
    expect(s.isUnlocked('machine_conveyor')).toBe(true);
    expect(s.research('logistics')).toBe('ok');
    expect(s.inventory.iron_ingot).toBe(5);
    expect(s.research('logistics')).toBe('done');
    expect(s.craft('machine_splitter', 1).made).toBe(1);
  });

  it('prérequis et coût sont vérifiés ; la recherche est enregistrée', () => {
    const s = new GameState({ inventory: { iron_ingot: 100, copper_ingot: 100 } });
    expect(s.research('automation')).toBe('locked');
    expect(s.research('logistics')).toBe('ok');
    expect(s.research('electricity')).toBe('ok');
    expect(s.research('automation')).toBe('ok');
    expect(s.research('textile')).toBe('missing');
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.isUnlocked('machine_assembler')).toBe(true);
  });

  it('une ancienne sauvegarde (sans recherche) garde tout débloqué', () => {
    const s = new GameState({ inventory: {}, changes: { taken: {} } });
    expect(s.isUnlocked('machine_assembler')).toBe(true);
  });
});
