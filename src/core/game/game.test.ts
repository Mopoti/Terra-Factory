import { describe, expect, it } from 'vitest';
import { Factory, emptyMachine } from '../factory/factory';
import { aimBuild, aimExisting, riseFromDirection } from '../build/aim';
import { evaluatePlan, planLine, planRect, planWall, rayOnEdgePlane } from '../build/plan';
import { edgeKeysToRemove, edgeState, pieceKey, posFor, type Pieces } from '../build/pieces';
import { BAG_LIMITS, itemById } from '../data/items';
import { DISCOVERIES } from '../data/discoveries';
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
    expect(s.inventory).toEqual({ stone: 4, piece_wall_stone: 1 });
    expect(s.craft('piece_wall_stone', 8)).toEqual({ made: 2, stopped: 'resources' });
    expect(s.inventory).toEqual({ piece_wall_stone: 3 });
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
    expect(aimBuild(eye, down, {}, 'wall_stone', 0, 10, 'x')?.pos.axis).toBe('x');
    expect(aimBuild(eye, down, {}, 'wall_stone', 0, 10, 'z')?.pos.axis).toBe('z');
  });
});

describe('escaliers', () => {
  it('une marche se pose n’importe où, y compris dans le vide ; une seule par cube', () => {
    const s = new GameState({ inventory: { piece_stairs_wood: 5 } });
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 0, undefined, 0, 0))).toBe('ok');
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 3, 3, undefined, 1, 0))).toBe('ok');
    expect(s.place('stairs_wood', posFor('stairs_wood', 0, 0, 0, undefined, 0, 2))).toBe(
      'occupied',
    );
  });
  it('les marches se sauvegardent avec leur sens', () => {
    const s = new GameState({ inventory: { piece_stairs_stone: 1 } });
    s.place('stairs_stone', posFor('stairs_stone', 0, 2, 2, undefined, 0, 3));
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(Object.keys(copy.changes.pieces)).toEqual(['s:0:2,2:0:3']);
  });
  it('la visée : sens du regard, puis démolition de la marche touchée', () => {
    expect(riseFromDirection(0, 1)).toBe(0);
    expect(riseFromDirection(-1, 0.1)).toBe(3);
    const eye = { x: 0.25, y: 1.6, z: -2 };
    const down = { x: 0, y: -0.5, z: 1 };
    const first = aimBuild(eye, down, {}, 'stairs_wood', 0, 10);
    expect(first?.pos).toMatchObject({ layer: 0, rot: 0 });
    const flight: Pieces = { [pieceKey(first!.pos)]: 'stairs_wood' };
    const removed = aimExisting({ x: 0.25, y: 0.2, z: -1 }, { x: 0, y: 0, z: 1 }, flight, 10);
    expect(removed?.pos).toMatchObject(first!.pos);
    expect(aimExisting({ x: 3.25, y: 0.2, z: -1 }, { x: 0, y: 0, z: 1 }, flight, 10)).toBeNull();
  });
});

describe('machines et tapis dans la partie', () => {
  const none = (): boolean => false;
  const noWorld = { oreAt: () => null, mineOre: () => 0 };
  it("poser consomme l'objet, démolir rend la machine et le contenu", () => {
    const s = new GameState({ inventory: { machine_furnace: 1, coal: 3, iron_ore: 3 } });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'furnace', 4, 4, 0, none)).toBe('ok');
    expect(s.placeMachine(f, 'furnace', 8, 8, 0, none)).toBe('missing');
    const m = s.changes.machines[0];
    expect(s.loadMachine(m, 'fuel', 'coal', 2)).toBe(2);
    expect(s.loadIngredient(m, 'iron_ore', 3)).toBe(0); // pas de recette choisie : rien ne s'accepte
    expect(s.setRecipe(m, 'iron')).toBe(true);
    expect(s.loadIngredient(m, 'iron_ore', 3)).toBe(3);
    expect(s.loadIngredient(m, 'coal', 1)).toBe(1); // le réactif de la recette
    expect(s.loadIngredient(m, 'stone', 1)).toBe(0);
    expect(s.inventory).toEqual({});
    expect(s.removeMachine(f, m.id, { x: 0, z: 0 })).toBe(true);
    // la machine + 3 charbon + 3 minerais
    expect(s.inventory).toEqual({ machine_furnace: 1, coal: 3, iron_ore: 3 });
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
  it('un tapis surélevé reçoit un pilier automatique ; au sol, rien', () => {
    const s = new GameState({ inventory: { machine_conveyor: 3 } });
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'conveyor', 1, 1, 0, none, 0)).toBe('ok');
    expect(Object.keys(s.changes.pieces)).toHaveLength(0);
    expect(s.placeMachine(f, 'conveyor', 5, 5, 0, none, 2)).toBe('ok');
    expect(Object.keys(s.changes.pieces).length).toBeGreaterThan(0);
    const n = Object.keys(s.changes.pieces).length;
    expect(s.placeMachine(f, 'conveyor', 7, 5, 0, none, 2)).toBe('ok'); // déjà soutenu à moins de 2,5 m
    expect(Object.keys(s.changes.pieces)).toHaveLength(n);
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
    const s = new GameState({ inventory: { iron_ingot: 35 } });
    expect(s.isUnlocked('machine_splitter')).toBe(false);
    expect(s.craft('machine_splitter', 1)).toEqual({ made: 0, stopped: 'locked' });
    expect(s.isUnlocked('machine_conveyor')).toBe(true);
    expect(s.research('logistics')).toBe('ok');
    expect(s.inventory.iron_ingot).toBe(15);
    expect(s.research('logistics')).toBe('done');
    expect(s.craft('machine_splitter', 1).made).toBe(1);
  });

  it('prérequis et coût sont vérifiés ; la recherche est enregistrée', () => {
    const s = new GameState({ inventory: { iron_ingot: 100, copper_ingot: 100 } });
    expect(s.research('automation')).toBe('lab');
    expect(s.study('automation')).toBe('locked');
    expect(s.research('logistics')).toBe('ok');
    expect(s.research('electricity')).toBe('ok');
    expect(s.study('automation')).toBe('ok');
    s.addStudy({ science_pack: 20 });
    expect(s.research('textile')).toBe('missing');
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.isUnlocked('machine_assembler')).toBe(true);
  });

  it('l’étude en laboratoire avance par paquets, se débloque à la fin et se sauvegarde', () => {
    const s = new GameState({ inventory: { iron_ingot: 100, copper_ingot: 100 } });
    s.research('logistics');
    s.research('electricity');
    expect(s.studyRemaining()).toBe(0);
    expect(s.study('textile')).toBe('notLab');
    expect(s.study('automation')).toBe('ok');
    expect(s.studyRemaining()).toBe(20);
    s.addStudy({ science_pack: 8 });
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.researching).toBe('automation');
    expect(copy.studyRemaining()).toBe(12);
    copy.addStudy({ science_pack: 30 });
    expect(copy.isUnlocked('machine_assembler')).toBe(true);
    expect(copy.changes.researching).toBeNull();
  });

  it('une technologie T3 réclame des paquets T2 : les autres paquets ne comptent pas', () => {
    const s = new GameState({ inventory: {} });
    for (const id of ['logistics', 'electricity', 'metallurgy', 'metallurgy_2', 'manufacturing_2'])
      s.changes.unlocked.push(id);
    s.changes.unlocked.push('construction_2');
    expect(s.study('heavy_press_3')).toBe('ok');
    expect(s.studyNeeds()).toEqual({ science_pack_2: 100 });
    s.addStudy({ science_pack: 50 });
    expect(s.studyRemaining()).toBe(100);
    s.addStudy({ science_pack_2: 60 });
    expect(s.studyNeeds()).toEqual({ science_pack_2: 40 });
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.studyNeeds()).toEqual({ science_pack_2: 40 });
    copy.addStudy({ science_pack_2: 99 });
    expect(copy.isUnlocked('machine_heavy_press')).toBe(true);
  });

  it('une ancienne sauvegarde (sans recherche) garde tout débloqué', () => {
    const s = new GameState({ inventory: {}, changes: { taken: {} } });
    expect(s.isUnlocked('machine_assembler')).toBe(true);
  });
});

describe('anciennes parties : emprises des machines', () => {
  it('les tapis se recalent sur des tuiles de 2 x 2, les machines qui se chevauchent sont posées au sol', () => {
    const machines = [
      { id: 1, type: 'conveyor', gx: 5, gz: 7, rot: 0, belt: [], slots: [] },
      { id: 2, type: 'conveyor', gx: 5, gz: 6, rot: 0, belt: [], slots: [] },
      { id: 3, type: 'furnace', gx: 20, gz: 20, rot: 0, belt: [], slots: [] },
    ];
    const s = new GameState({ inventory: {}, changes: { machines } });
    // les deux tapis (1 case chacun avant) tombent sur la même tuile : le 2e est retiré
    expect(s.changes.machines.map((m) => m.id)).toEqual([1, 3]);
    expect(s.changes.machines[0]).toMatchObject({ gx: 4, gz: 6 });
    expect(s.changes.drops).toHaveLength(1);
    expect(s.changes.drops[0].item).toBe('machine_conveyor');
    // une partie déjà à la nouvelle version n'est pas touchée
    const t = new GameState({
      inventory: {},
      changes: { machines: [{ ...machines[0], gx: 5, gz: 7 }], footprintVersion: 2 },
    });
    expect(t.changes.machines[0]).toMatchObject({ gx: 5, gz: 7 });
  });
});

describe('piles du sac, objet en main et outils', () => {
  it('on peut avoir plusieurs piles du même objet, déplacées et jetées au choix', () => {
    const s = new GameState({ inventory: { stone: 40 } });
    expect(s.bagSlots().filter(Boolean)).toEqual([{ item: 'stone', count: 40 }]);
    s.takeToHand('stone', 20, 0);
    expect(s.bagSlots()[0]).toEqual({ item: 'stone', count: 20 });
    expect(s.placeHand(5)).toBe(1);
    expect(s.hand).toBeNull();
    expect(s.bagSlots()[5]).toEqual({ item: 'stone', count: 20 });
    expect(s.inventory.stone).toBe(40);
    s.moveBagSlot(5, 7);
    expect(s.bagSlots()[7]?.count).toBe(20);
    s.moveBagSlot(7, 0); // fusion
    expect(s.bagSlots()[0]?.count).toBe(40);
    const cleared = s.clearBagSlot(0);
    expect(cleared?.count).toBe(40);
    s.drop('stone', 40, 0, 0);
    expect(s.bagSlots().filter(Boolean)).toHaveLength(0);
  });

  it("l'objet posable tenu en main passe avant la barre, jusqu'à ce qu'on le range", () => {
    const s = new GameState({ inventory: { machine_conveyor: 3 } });
    expect(s.selectedItem()).toBeNull();
    s.setHeld('machine_conveyor');
    expect(s.selectedItem()).toBe('machine_conveyor');
    s.setHeld(null);
    expect(s.selectedItem()).toBeNull();
  });

  it("l'outil de la case d'outils change la récolte ; seuls outils et pistolet y vont", () => {
    const s = new GameState({ inventory: { tool_stone: 1, tool_iron: 1, stone: 1 } });
    expect(s.harvestTool()).toBeNull();
    expect(s.assignTool(0, 'stone')).toBe(false);
    expect(s.assignTool(0, 'tool_stone')).toBe(true);
    expect(s.harvestTool()?.speed).toBe(2);
    s.assignTool(0, 'tool_iron');
    expect(s.harvestTool()?.yield).toBe(2);
    expect(s.snapshot().changes.tools[0]).toBe('tool_iron');
  });
});

describe('visée libre : une seule règle pour toutes les pièces', () => {
  const eye = { x: 0.25, y: 1.6, z: -1.5 };
  const ahead = (tx: number, ty: number, tz: number): { x: number; y: number; z: number } => {
    const d = { x: tx - eye.x, y: ty - eye.y, z: tz - eye.z };
    const len = Math.hypot(d.x, d.y, d.z);
    return { x: d.x / len, y: d.y / len, z: d.z / len };
  };
  it('un mur se pose sur le bord le plus proche du point visé au sol', () => {
    const hit = aimBuild(eye, ahead(0.3, 0, 0.05), {}, 'wall_stone', 0, 12);
    expect(hit?.pos).toMatchObject({ slot: 'edge', level: 0, layer: 0 });
  });
  it('une dalle se pose sur le haut d’un mur visé, à sa hauteur, sans autre condition', () => {
    const pieces: Pieces = { [pieceKey(posFor('wall_stone', 0, 0, 0, 'x', 0))]: 'wall_stone' };
    const hit = aimBuild(eye, ahead(0.25, 0.5, 0.0), pieces, 'slab_stone', 0, 12);
    expect(hit?.pos).toMatchObject({ slot: 'ceiling', level: 0, layer: 0 });
  });
  it('un mur visé par le haut reçoit un bloc au-dessus, dans la même ligne', () => {
    const pieces: Pieces = { [pieceKey(posFor('wall_stone', 0, 0, 0, 'x', 0))]: 'wall_stone' };
    const hit = aimBuild(eye, ahead(0.25, 0.5, 0.0), pieces, 'wall_wood', 0, 12);
    expect(hit?.pos).toMatchObject({ slot: 'edge', axis: 'x', gx: 0, gz: 0, layer: 1 });
  });
  it('le bois et la pierre se mélangent : mêmes emplacements, même règle', () => {
    const pieces: Pieces = { [pieceKey(posFor('wall_stone', 0, 0, 0, 'x', 0))]: 'wall_stone' };
    const stone = aimBuild(eye, ahead(0.25, 0.5, 0.0), pieces, 'wall_stone', 0, 12);
    const wood = aimBuild(eye, ahead(0.25, 0.5, 0.0), pieces, 'wall_wood', 0, 12);
    expect(wood?.pos).toEqual(stone?.pos);
  });
  it('dans le vide, la pièce se pose sur le plan de construction choisi (étage 1 = 2,5 m)', () => {
    const high = { x: 0.25, y: 4, z: -1 };
    const hit = aimBuild(high, { x: 0, y: -0.6, z: 0.8 }, {}, 'slab_wood', 2.5, 12);
    expect(hit?.pos).toMatchObject({ slot: 'floor', level: 1 });
  });
  it('un escalier se pose contre un autre, à n’importe quelle hauteur', () => {
    const s = new GameState({ inventory: { piece_stairs_stone: 2 } });
    s.place('stairs_stone', posFor('stairs_stone', 0, 5, 5, undefined, 0, 0));
    const hit = aimBuild(
      { x: 2.75, y: 1.6, z: 1.5 },
      ahead(2.75, 0.3, 2.85),
      s.changes.pieces,
      'stairs_stone',
      0,
      12,
      undefined,
      0,
    );
    expect(hit?.pos.slot).toBe('stairs');
    expect(`${hit?.pos.gx},${hit?.pos.gz}`).not.toBe('5,5,0');
  });
  it('une dalle du sol d’un étage et le plafond du dernier bloc de l’étage du dessous sont la même face', () => {
    const s = new GameState({ inventory: { piece_slab_stone: 3 } });
    expect(s.place('slab_stone', posFor('floor_stone', 1, 0, 0))).toBe('ok');
    expect(s.place('slab_stone', posFor('ceiling_stone', 0, 0, 0, undefined, 4))).toBe('occupied');
  });
});

describe('ennemis et temps enregistrés', () => {
  it('les ennemis, le temps et les véhicules passent par la sauvegarde', () => {
    const c = normalizeChanges({
      enemies: [
        {
          id: 3,
          x: 10,
          z: 20,
          hp: 12,
          cooldown: 1,
          idle: 2,
          target: 'player',
          home: { x: 1, z: 2 },
        },
        { id: 3, x: 0, z: 0, hp: 5 }, // identifiant en double
        { id: 4, x: 0, z: 0, hp: 0 }, // mort
        { id: 'x' },
      ],
      time: 125.5,
      vehicles: [{ id: 1, x: 2, z: 3, yaw: 1, fuel: 40 }, { id: 'a' }],
    });
    expect(c.enemies).toHaveLength(1);
    expect(c.enemies[0].home).toEqual({ x: 1, z: 2 });
    expect(c.time).toBe(125.5);
    expect(c.vehicles).toEqual([
      { id: 1, x: 2, z: 3, yaw: 1, fuel: 40, fuelStack: null, slots: [] },
    ]);
  });
});

describe('carburant du buggy', () => {
  it('le buggy consomme d’abord sa case de carburant, puis son coffre, puis le sac', () => {
    const s = new GameState({ inventory: { vehicle_buggy: 1, coal: 1, wood: 1 } });
    const v = s.placeVehicle(0, 0, 0)!;
    v.fuelStack = { item: 'coal', count: 1 };
    v.slots.push({ item: 'wood', count: 1 });
    expect(s.refuelVehicle(v)).toBeGreaterThan(0); // la case de carburant (charbon)
    expect(v.fuelStack).toBeNull();
    const second = s.refuelVehicle(v); // le coffre (bois)
    expect(second).toBeGreaterThan(0);
    expect(v.slots).toHaveLength(0);
    expect(s.refuelVehicle(v)).toBeGreaterThan(0); // le sac (charbon, puis bois)
    expect(s.refuelVehicle(v)).toBeGreaterThan(0);
    expect(s.refuelVehicle(v)).toBe(0);
  });
});

describe('mort, corps à récupérer, duvet et lit', () => {
  const newState = (): GameState => {
    const s = new GameState({ inventory: { coal: 30, wood: 10, sleeping_bag: 1, bed: 1 } });
    s.changes.equipment.torso = 'backpack';
    return s;
  };

  it('à la mort tout reste sur le corps ; on le récupère d’un coup', () => {
    const s = newState();
    const corpse = s.dieAt(5, 6, 0.5);
    expect(s.inventory).toEqual({});
    expect(s.changes.equipment).toEqual({});
    expect(corpse.inventory.coal).toBe(30);
    expect(corpse.equipment.torso).toBe('backpack');
    expect(s.recoverCorpse(corpse.id)).toBe('recovered');
    expect(s.inventory.coal).toBe(30);
    expect(s.inventory.bed).toBe(1);
    expect(s.changes.equipment.torso).toBe('backpack');
    expect(s.changes.corpses).toHaveLength(0);
  });

  it('si le sac est plein, le reste attend sur le corps', () => {
    const s = new GameState({ inventory: { stone: 4000 } }); // bien au-delà de ce que le sac peut porter
    const corpse = s.dieAt(0, 0, 0);
    corpse.inventory.wood = 2000;
    expect(s.recoverCorpse(corpse.id)).toBe('partial');
    expect(s.changes.corpses).toHaveLength(1);
    expect(
      Object.values(s.changes.corpses[0].inventory).reduce((a, b) => a + b, 0),
    ).toBeGreaterThan(0);
  });

  it('deux morts : deux corps, chacun avec ses affaires', () => {
    const s = newState();
    s.dieAt(1, 1, 0);
    s.inventory = { stone: 3 };
    s.dieAt(9, 9, 0);
    expect(s.changes.corpses.map((c) => Object.keys(c.inventory).length)).toEqual([4, 1]);
  });

  it('un duvet est consommé à la réapparition, un lit reste ; sans rien posé : point de départ', () => {
    const s = newState();
    expect(s.consumeRespawn()).toBeNull();
    expect(s.placeSpawn('bed', 10, 10)).not.toBeNull();
    expect(s.placeSpawn('bag', 50, 50)).not.toBeNull();
    expect(s.inventory.bed ?? 0).toBe(0);
    expect(s.consumeRespawn()).toEqual({ x: 50, z: 50 }); // le dernier posé : le duvet, détruit
    expect(s.changes.spawns).toHaveLength(1);
    expect(s.consumeRespawn()).toEqual({ x: 10, z: 10 }); // le lit
    expect(s.consumeRespawn()).toEqual({ x: 10, z: 10 }); // toujours là
  });

  it('on range un lit : il revient dans le sac', () => {
    const s = newState();
    const bed = s.placeSpawn('bed', 3, 3)!;
    expect(s.pickUpSpawn(bed.id, { x: 3, z: 3 })).toBe(true);
    expect(s.inventory.bed).toBe(1);
    expect(s.changes.spawns).toHaveLength(0);
  });
});

describe('découvertes : la roue à aubes se débloque en fabriquant 10 plaques de cuivre', () => {
  it('compte les fabrications et débloque l’objet au seuil, une seule fois', () => {
    const s = new GameState();
    const seen: string[] = [];
    s.onChange((e) => {
      if (e.type === 'discovery') seen.push(e.id);
    });
    expect(s.isUnlocked('machine_waterwheel')).toBe(false);
    s.countProduced('copper_plate', 6);
    expect(s.isUnlocked('machine_waterwheel')).toBe(false);
    s.countProduced('iron_plate', 50); // une autre plaque ne compte pas
    s.harvest('1,1', 100, 'copper_ore', 50); // récolter ne compte pas : il faut fabriquer
    expect(s.isUnlocked('machine_waterwheel')).toBe(false);
    expect(s.discoveryProgress(DISCOVERIES[0])).toBe(6);
    s.countProduced('copper_plate', 4);
    expect(s.isUnlocked('machine_waterwheel')).toBe(true);
    s.countProduced('copper_plate', 4);
    expect(seen).toEqual(['waterwheel']);
    expect(s.discoveryProgress(DISCOVERIES[0])).toBe(10); // plafonné
    // enregistré avec la partie
    const back = new GameState(s.snapshot());
    expect(back.isUnlocked('machine_waterwheel')).toBe(true);
    expect(back.changes.produced.copper_plate).toBe(14);
  });
});

describe('tuyau de cuivre, recettes verrouillées', () => {
  it('1 plaque de cuivre donne 2 tuyaux (fabrication à la main)', () => {
    const s = new GameState({ inventory: { copper_plate: 3 } });
    s.changes.unlocked.push('steam');
    expect(s.craft('machine_pipe', 2)).toEqual({ made: 2, stopped: null }); // 1 fabrication = 2 tuyaux
    expect(s.inventory.machine_pipe).toBe(2);
    expect(s.inventory.copper_plate).toBe(2);
    expect(s.craft('machine_pipe', 4).made).toBe(4);
    expect(s.inventory.machine_pipe).toBe(6);
    expect(s.craft('machine_pipe', 2).made).toBe(0); // plus de plaques
  });

  it('le zinc n’est choisissable qu’une fois « Métallurgie T2 » recherchée', () => {
    const s = new GameState({ inventory: {} });
    const furnace = emptyMachine(1, 'furnace', 0, 0, 0);
    expect(s.setRecipe(furnace, 'zinc')).toBe(false);
    expect(s.setRecipe(furnace, 'iron')).toBe(true);
    s.changes.unlocked.push('metallurgy_2');
    expect(s.setRecipe(furnace, 'zinc')).toBe(true);
    expect(furnace.recipe).toBe('zinc');
  });
});

describe('amélioration d’un tapis (palier supérieur posé par-dessus)', () => {
  const noWorld = { oreAt: () => null, mineOre: () => 0 };
  const none = (): boolean => false;
  it('remplace l’ancien tapis, qui revient dans le sac, en gardant les objets qui roulent dessus', () => {
    const s = new GameState({ inventory: { machine_conveyor: 1, machine_conveyor_2: 1 } });
    s.changes.unlocked.push('logistics_2');
    const f = new Factory(s.changes.machines, noWorld);
    expect(s.placeMachine(f, 'conveyor', 4, 4, 0, none)).toBe('ok');
    f.machines[0].belt.push({ item: 'iron_ore', pos: 0.4 });
    expect(s.placeMachine(f, 'conveyor', 4, 4, 0, none, 0, 2)).toBe('ok');
    expect(f.machines).toHaveLength(1);
    expect(f.machines[0].tier).toBe(2);
    expect(f.machines[0].belt).toEqual([{ item: 'iron_ore', pos: 0.4 }]);
    expect(s.inventory.machine_conveyor).toBe(1); // l'ancien est revenu
    expect(s.inventory.machine_conveyor_2 ?? 0).toBe(0);
    // démolir rend l'objet du bon palier
    s.removeMachine(f, f.machines[0].id, { x: 0, z: 0 });
    expect(s.inventory.machine_conveyor_2).toBe(1);
  });
});

describe('mode Créatif', () => {
  it('fabrication et recherche gratuites, sac sans limite de poids ni de volume', () => {
    const s = new GameState({ inventory: {} });
    expect(s.craft('machine_splitter', 1).stopped).toBe('locked');
    s.creative = true;
    expect(s.research('logistics')).toBe('ok'); // aucun objet demandé
    expect(s.craft('machine_splitter', 2).made).toBe(2); // aucun ingrédient demandé
    expect(s.inventory.iron_ingot ?? 0).toBe(0);
    expect(s.limits.maxWeightG).toBe(Infinity);
    expect(s.limits.maxVolumeMl).toBe(Infinity);
  });
  it('une technologie à paquets de science se débloque directement', () => {
    const s = new GameState({ inventory: {} });
    expect(s.research('automation')).toBe('lab');
    s.creative = true;
    s.changes.unlocked.push('logistics', 'electricity');
    expect(s.research('automation')).toBe('ok');
    expect(s.isUnlocked('machine_assembler')).toBe(true);
  });
});

describe('réparation du réacteur', () => {
  it('exige 30 plaques d’acier, 10 câbles isolés et 5 puces', () => {
    const m = emptyMachine(1, 'fission_reactor', 0, 0, 0);
    m.broken = true;
    const s = new GameState({
      inventory: { steel_plate: 30, cable_insulated: 9, silicon_chip: 5 },
    });
    expect(s.repairReactor(m)).toBe('missing');
    s.inventory.cable_insulated = 10;
    expect(s.repairReactor(m)).toBe('ok');
    expect(m.broken).toBe(false);
    expect(s.inventory.steel_plate ?? 0).toBe(0);
    expect(s.repairReactor(m)).toBe('notBroken');
  });
});
