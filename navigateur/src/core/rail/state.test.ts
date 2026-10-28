import { describe, expect, it } from 'vitest';
import { CARS, carIdOfWindow, locoWindowId } from '../data/trains';
import { emptyMachine } from '../factory/factory';
import { GameState } from '../game/state';
import { candidatesFrom } from './place';
import { placeAt, placeLine } from './testTrack';
import { TILE_M, portsOf } from './track';

const free = (): boolean => false;

describe('voies et trains dans la partie', () => {
  const start = (): GameState => {
    const s = new GameState({
      inventory: {
        rail: 200,
        train_locomotive: 1,
        train_wagon_freight: 2,
        coal: 30,
      },
    });
    s.creative = true; // sac sans limite de poids : les véhicules sont lourds
    return s;
  };
  const laidLine = (s: GameState, n: number): void => {
    placeLine(s, n);
    expect(s.changes.rails).toHaveLength(n);
  };

  it('poser une voie consomme l’objet et refuse de recouvrir une autre pièce', () => {
    const s = start();
    expect(s.placeRail('straight', 0, 0, 4, 0, free)).toBe('ok');
    expect(s.inventory.rail).toBe(199);
    expect(s.placeRail('straight', 0.5, 0, 4, 0, free)).toBe('blocked'); // recouvre des cases
    expect(s.placeRail('straight', 0, 0, 4, 0, free)).toBe('blocked'); // même pièce, au même endroit
    expect(s.placeRail('straight', 40, 0, 4, 0, () => true)).toBe('blocked'); // terrain bloqué
    s.inventory.rail = 2;
    expect(s.placeRail('ramp', 80, 0, 4, 0, free)).toBe('missing'); // une rampe coûte 4 rails
    expect(s.removeRail(s.changes.rails[0].id, { x: 0, z: 0 })).toBe(true);
    expect(s.inventory.rail).toBe(3); // 2 en stock + 1 rendu
  });

  it('on pose une locomotive et des wagons sur la voie, sans qu’ils se chevauchent', () => {
    const s = start();
    laidLine(s, 30);
    const graph = s.railGraph();
    expect(graph.neighbour(s.changes.rails[0].id, 1)).not.toBeNull();
    const loco = s.placeCar('locomotive_steam', { piece: s.changes.rails[20].id, u: 0.5, dir: 1 });
    expect(loco).not.toBeNull();
    expect(
      s.placeCar('wagon_freight', { piece: s.changes.rails[20].id, u: 0.5, dir: 1 }),
    ).toBeNull();
    const wagon = s.placeCar('wagon_freight', { piece: s.changes.rails[10].id, u: 0.5, dir: 1 });
    expect(wagon).not.toBeNull();
    expect(s.inventory.train_wagon_freight).toBe(1);
    expect(s.pickUpCar(wagon!.id)).toBe('ok');
    expect(s.inventory.train_wagon_freight).toBe(2);
  });

  it('un véhicule se démonte même attelé, le convoi se scinde', () => {
    const s = start();
    laidLine(s, 40);
    const loco = s.placeCar('locomotive_steam', { piece: s.changes.rails[10].id, u: 0.5, dir: 1 })!;
    const graph = s.railGraph();
    const rear = graph.advance(
      { ...loco.head, dir: -1 },
      CARS.locomotive_steam.lengthM + 1.0 + CARS.wagon_freight.frontM,
    ).pos;
    s.placeCar('wagon_freight', { piece: rear.piece, u: rear.u, dir: -1 });
    s.coupleTrain(loco.id);
    expect(s.changes.trains[0].cars).toHaveLength(2);
    const wagonId = s.changes.trains[0].cars[1].id;
    const before = s.inventory.train_wagon_freight ?? 0;
    expect(s.removeCar(wagonId)).toBe(true);
    expect(s.changes.trains).toHaveLength(1);
    expect(s.changes.trains[0].cars).toHaveLength(1);
    expect(s.inventory.train_wagon_freight).toBe(before + 1);
    expect(s.removeCar(s.changes.trains[0].cars[0].id)).toBe(true);
    expect(s.changes.trains).toHaveLength(0);
  });

  it('une voie sous un convoi ne se démonte pas', () => {
    const s = start();
    laidLine(s, 40);
    const piece = s.changes.rails[10];
    s.placeCar('locomotive_steam', { piece: piece.id, u: 0.5, dir: 1 });
    expect(s.removeRail(piece.id, { x: 0, z: 0 })).toBe(false);
    expect(s.changes.rails).toContain(piece);
    const far = s.changes.rails[s.changes.rails.length - 1];
    expect(s.removeRail(far.id, { x: 0, z: 0 })).toBe(true);
  });

  it('la fenêtre de la locomotive charge la soute jusqu’à 50 pièces', () => {
    const s = start();
    s.creative = true;
    s.inventory.coal = 80;
    const car = { id: 7, kind: 'locomotive_steam', rev: false, heatKJ: 0, fuel: null } as never as {
      fuel: { item: string; count: number } | null;
    };
    const m = emptyMachine(locoWindowId(7), 'chest_wood', 0, 0, 0);
    Object.defineProperty(m, 'fuel', { get: () => car.fuel, set: (x) => (car.fuel = x) });
    expect(carIdOfWindow(m.id)).toBe(7);
    expect(s.loadMachine(m, 'fuel', 'coal', 80)).toBe(50);
    expect(car.fuel).toEqual({ item: 'coal', count: 50 });
    expect(s.loadMachine(m, 'fuel', 'coal', 10)).toBe(0);
    expect(s.loadMachine(m, 'fuel', 'iron_ingot', 1)).toBe(0);
  });

  it('la locomotive se ravitaille depuis le sac, s’attelle à un wagon et se dételle', () => {
    const s = start();
    laidLine(s, 40);
    const loco = s.placeCar('locomotive_steam', { piece: s.changes.rails[10].id, u: 0.5, dir: 1 })!;
    expect(s.refuelLocomotive(loco.cars[0])).toBe(20);
    expect(loco.cars[0].fuel).toEqual({ item: 'coal', count: 20 });
    expect(s.inventory.coal).toBe(10);
    // Un wagon à 1 m de l'arrière de la locomotive : attelage.
    const graph = s.railGraph();
    const rear = graph.advance(
      { ...loco.head, dir: -1 },
      CARS.locomotive_steam.lengthM + 1.0 + CARS.wagon_freight.frontM,
    ).pos;
    const wagon = s.placeCar('wagon_freight', { piece: rear.piece, u: rear.u, dir: -1 })!;
    expect(s.coupleTrain(loco.id)).not.toBeNull();
    expect(s.changes.trains).toHaveLength(1);
    const train = s.changes.trains[0];
    expect(train.cars).toHaveLength(2);
    expect(s.pickUpCar(train.id)).toBe('coupled');
    const rest = s.uncoupleTrain(train.id, 1)!;
    expect(s.changes.trains).toHaveLength(2);
    expect(rest.cars.map((c) => c.id)).toContain(wagon.cars[0].id);
  });

  it('un virage ne prend que les cases de son arc : un obstacle loin de la voie ne gêne pas', () => {
    const s = start();
    s.inventory.rail = 10;
    // Cases de l'arc : le virage part de l'origine vers +z et tourne vers +x ; un obstacle sur la voie le bloque.
    const onArc = (c: { gx: number; gz: number }): boolean => c.gx === 0 && c.gz === 2;
    expect(s.placeRail('curve_l', 0, 0, 0, 0, onArc)).toBe('blocked');
    // Un obstacle de l'autre côté de l'origine, à plusieurs mètres de l'arc, ne le gêne pas.
    const away = (c: { gx: number; gz: number }): boolean => c.gx === -12 && c.gz === 8;
    expect(s.placeRail('curve_l', 0, 0, 0, 0, away)).toBe('ok');
  });

  it('huit virages de 45° se posent bout à bout et le cercle se referme', () => {
    const s = start();
    s.inventory.rail = 100;
    // Le premier virage part de l'origine vers +z (le port libre regarde vers +z).
    let port = { x: 0, y: 0, z: 0, dx: 0, dz: 1 };
    for (let k = 0; k < 8; k++) {
      const c = candidatesFrom(port, 0).find((m) => m.kind === 'curve_l')!;
      expect(s.placeRail(c.kind, c.x, c.z, c.h, c.level, free), `virage ${k + 1}`).toBe('ok');
      port = portsOf(s.changes.rails[s.changes.rails.length - 1])[1];
    }
    expect(s.changes.rails).toHaveLength(8);
    // Le dernier bout retombe sur le premier : la voie est un anneau sans bout libre.
    const g = s.railGraph();
    expect(g.neighbour(s.changes.rails[7].id, 1)?.piece).toBe(s.changes.rails[0].id);
    expect(g.neighbour(s.changes.rails[0].id, 0)?.piece).toBe(s.changes.rails[7].id);
  });

  it('l’état se relit sans erreur et ignore ce qui est invalide', () => {
    const s = start();
    laidLine(s, 5);
    s.placeCar('locomotive_steam', { piece: s.changes.rails[2].id, u: 0.5, dir: 1 });
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.rails).toHaveLength(5);
    expect(copy.changes.trains).toHaveLength(1);
    const broken = new GameState({
      changes: {
        rails: [{ id: 1, kind: 'monorail', x: 0, z: 0, h: 0 }],
        trains: [{ id: 1, head: { piece: 9, u: 0 }, cars: [] }],
      },
    });
    expect(broken.changes.rails).toEqual([]);
    expect(broken.changes.trains).toEqual([]);
  });
});

describe('embranchements et croisements dans la partie', () => {
  const start = (): GameState => {
    const s = new GameState({ inventory: { rail: 60, train_wagon_freight: 1 } });
    s.creative = true;
    placeLine(s, 10);
    return s;
  };

  it('une pièce reposée par-dessus la voie existante est refusée, sans rien dépenser', () => {
    const s = start();
    const before = s.changes.rails.length;
    const stock = s.inventory.rail ?? 0;
    const mid = s.changes.rails[3];
    expect(s.placeRail(mid.kind, mid.x, mid.z, mid.h, mid.level, free)).toBe('blocked');
    expect(s.placeRail('ramp', mid.x, mid.z, mid.h, mid.level, free)).toBe('blocked');
    expect(s.changes.rails).toHaveLength(before);
    expect(s.inventory.rail ?? 0).toBe(stock);
  });

  it.each(['curve_l', 'curve_r'] as const)(
    'un virage %s posé au bout d’une pièce qui en a déjà une suite en fait un embranchement',
    (kind) => {
      const s = start();
      const line = s.changes.rails.slice(0, 10);
      // Joint entre le droit 3 et le droit 4 : la ligne va vers −z, le port avant du droit 3 y est.
      const joint = portsOf(line[2]).find((p) => p.dz === -1)!;
      const before = s.changes.rails.length;
      const curve = placeAt(s, kind, joint);
      expect(curve).not.toBeNull();
      // Rien n'a été remplacé : la ligne reste, le virage s'y ajoute.
      expect(s.changes.rails).toHaveLength(before + 1);
      // Sans consigne, tout droit.
      const g = s.railGraph();
      expect(g.neighbour(line[2].id, 1)?.piece).toBe(line[3].id);
      // Le train qui choisit la voie qui tourne (gauche / droite, ou itinéraire) la prend.
      const turned = g.advance({ piece: line[2].id, u: 0, dir: 1 }, 4, new Set([curve!.id]));
      expect(turned.pos.piece).toBe(curve!.id);
      const straight = g.advance({ piece: line[2].id, u: 0, dir: 1 }, 4);
      expect(straight.pos.piece).toBe(line[3].id);
      // La pointe est un choix de voie pour le train qui arrive.
      expect(s.railGraph().choiceAhead({ piece: line[1].id, u: 0, dir: 1 }, 60)).not.toBeNull();
    },
  );

  it('deux voies droites se croisent à niveau : chacune traverse l’autre, dans les deux sens', () => {
    const s = start();
    // La ligne verticale (10 droits) est posée ; on pose une ligne horizontale qui la coupe au droit 6.
    const mid = s.changes.rails[5];
    const zc = mid.z - TILE_M / 2;
    const before = s.changes.rails.length;
    for (let k = -3; k <= 3; k++)
      expect(s.placeRail('straight', k * TILE_M - TILE_M / 2, zc, 2, 0, free)).toBe('ok');
    // Rien n'a été remplacé : 7 pièces de plus, la ligne verticale est entière.
    expect(s.changes.rails).toHaveLength(before + 7);
    const g = s.railGraph();
    const vertical = s.changes.rails.slice(0, 10).map((p) => p.id);
    const horizontal = s.changes.rails.slice(before).map((p) => p.id);
    for (const [line, len] of [
      [vertical, 24],
      [horizontal, 16],
    ] as const) {
      // Depuis chacun des deux bouts, vers l'intérieur : on traverse le croisement sans être arrêté.
      for (const end of [line[0], line[line.length - 1]]) {
        const ok = ([1, -1] as const).some((dir) =>
          [0.2, TILE_M - 0.2].some((u) => !g.advance({ piece: end, u, dir }, len).blocked),
        );
        expect(ok).toBe(true);
      }
    }
    // Une seconde droite de même axe au même endroit est un doublon, pas un croisement.
    expect(s.placeRail('straight', mid.x, mid.z, mid.h, 0, free)).toBe('blocked');
  });
});

describe('anciennes parties et sauvegarde des pièces', () => {
  it('une partie d’avant la refonte des rails n’est plus jouable', async () => {
    const { normalizeChanges, slotPlayable } = await import('../game/worldChanges');
    expect(slotPlayable(normalizeChanges({ railVersion: 2, rails: [{ id: 1 }] }))).toBe(false);
    expect(slotPlayable(normalizeChanges({}))).toBe(false);
    expect(slotPlayable(normalizeChanges(new GameState().snapshot().changes))).toBe(true);
  });

  it('les pièces se relisent au millimètre près et les caps restent entre 0 et 7', () => {
    const s = new GameState({ inventory: { rail: 50 } });
    s.creative = true;
    s.placeRail('straight', 12.3456, -7.0004, 11, 0, () => false);
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.rails).toEqual([
      { id: 1, kind: 'straight', x: 12.346, z: -7, h: 3, level: 0 },
    ]);
  });
});
