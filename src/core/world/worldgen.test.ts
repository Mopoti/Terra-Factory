import { describe, expect, it } from 'vitest';
import { CELL_SIZE_M, CHUNK_CELLS } from '../constants';
import { BIOME_IDS, biomeAt } from './biomes';
import { hashSeed } from './rng';
import {
  SPAWN_CLEAR_M,
  WorldGenerator,
  defaultWorldParams,
  type ChunkData,
  type WorldParams,
} from './worldgen';

const gen = (seed: string, tweak?: (p: WorldParams) => void): WorldGenerator => {
  const params = defaultWorldParams(seed);
  tweak?.(params);
  return new WorldGenerator(params);
};

function region(g: WorldGenerator, radiusChunks: number, cx0 = 0, cz0 = 0): ChunkData[] {
  const chunks: ChunkData[] = [];
  for (let cz = cz0 - radiusChunks; cz <= cz0 + radiusChunks; cz++) {
    for (let cx = cx0 - radiusChunks; cx <= cx0 + radiusChunks; cx++) chunks.push(g.chunk(cx, cz));
  }
  return chunks;
}

const distM = (gx: number, gz: number): number =>
  Math.hypot((gx + 0.5) * CELL_SIZE_M, (gz + 0.5) * CELL_SIZE_M);

describe('seed', () => {
  it('est stable : même texte, même nombre', () => {
    expect(hashSeed('terra')).toBe(hashSeed('terra'));
    expect(hashSeed('12345')).toBe(hashSeed('12345'));
    expect(hashSeed('terra')).not.toBe(hashSeed('Terra'));
  });
  it('ignore les espaces de bord', () => {
    expect(hashSeed('  terra ')).toBe(hashSeed('terra'));
  });
  it('valeur de référence (ne doit jamais changer, sinon les anciens mondes changent)', () => {
    expect(hashSeed('terra')).toMatchInlineSnapshot(`3676075189`);
  });
});

describe('déterminisme', () => {
  it('même seed = exactement le même monde', () => {
    const a = region(gen('monde'), 3);
    const b = region(gen('monde'), 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('seeds différentes = mondes différents', () => {
    const a = JSON.stringify(region(gen('monde'), 3));
    const b = JSON.stringify(region(gen('autre'), 3));
    expect(a).not.toBe(b);
  });
  it("ne dépend pas de l'ordre de découverte des chunks", () => {
    const forward = gen('ordre');
    const backward = gen('ordre');
    const coords: [number, number][] = [];
    for (let cz = -4; cz <= 4; cz++) for (let cx = -4; cx <= 4; cx++) coords.push([cx, cz]);
    const first = new Map(
      coords.map(([x, z]) => [`${x},${z}`, JSON.stringify(forward.chunk(x, z))]),
    );
    for (const [x, z] of [...coords].reverse()) {
      expect(JSON.stringify(backward.chunk(x, z))).toBe(first.get(`${x},${z}`));
    }
  });
  it('fonctionne très loin du départ (monde infini)', () => {
    const g = gen('loin');
    for (const [cx, cz] of [
      [100000, -100000],
      [-2000000, 3000000],
    ]) {
      const c = g.chunk(cx, cz);
      expect(JSON.stringify(c)).toBe(JSON.stringify(gen('loin').chunk(cx, cz)));
    }
  });
});

describe('contenu des chunks', () => {
  const chunks = region(gen('contenu'), 12);

  it('chaque élément est dans son chunk, sans doublon, sans minerai sous un étang', () => {
    const seen = new Set<string>();
    for (const c of chunks) {
      const inChunk = (gx: number, gz: number): boolean =>
        Math.floor(gx / CHUNK_CELLS) === c.cx && Math.floor(gz / CHUNK_CELLS) === c.cz;
      for (const o of c.ore) {
        expect(inChunk(o.gx, o.gz)).toBe(true);
        expect(seen.has(`${o.gx},${o.gz}`), 'case en double').toBe(false);
        seen.add(`${o.gx},${o.gz}`);
      }
      for (const w of c.water) {
        expect(inChunk(w.gx, w.gz)).toBe(true);
        expect(seen.has(`${w.gx},${w.gz}`), 'eau sur minerai').toBe(false);
        seen.add(`${w.gx},${w.gz}`);
      }
      for (const o of c.objects) expect(inChunk(o.gx, o.gz)).toBe(true);
    }
  });
  it("les objets n'occupent pas les cases de minerai ou d'eau", () => {
    const taken = new Set<string>();
    for (const c of chunks) {
      for (const o of c.ore) taken.add(`${o.gx},${o.gz}`);
      for (const w of c.water) taken.add(`${w.gx},${w.gz}`);
    }
    for (const c of chunks) {
      for (const o of c.objects) {
        for (let dx = 0; dx < o.cells; dx++) {
          for (let dz = 0; dz < o.cells; dz++) {
            expect(taken.has(`${o.gx + dx},${o.gz + dz}`), `${o.id} sur une ressource`).toBe(false);
          }
        }
      }
    }
  });
  it('contient bien des arbres, rochers, minerais et étangs', () => {
    const ids = new Set<string>();
    for (const c of chunks) {
      c.objects.forEach((o) => ids.add(o.id));
      c.ore.forEach((o) => ids.add(o.id));
      if (c.water.length > 0) ids.add('water');
    }
    for (const id of ['tree', 'rock', 'iron_ore', 'copper_ore', 'coal', 'water']) {
      expect(ids.has(id), id).toBe(true);
    }
  });
  it('les tas traversent les limites de chunks', () => {
    const cells = new Set<string>();
    for (const c of chunks) c.ore.forEach((o) => cells.add(`${o.gx},${o.gz}`));
    let crossing = 0;
    for (const c of chunks) {
      for (const o of c.ore) {
        if (o.gx % CHUNK_CELLS === CHUNK_CELLS - 1 && cells.has(`${o.gx + 1},${o.gz}`)) crossing++;
      }
    }
    expect(crossing).toBeGreaterThan(0);
  });
});

describe('minerais : quantités par case', () => {
  const g = gen('quantites');
  const iron = region(g, 14).flatMap((c) => c.ore.filter((o) => o.id === 'iron_ore'));

  it('les quantités sont des multiples de 5, positives', () => {
    expect(iron.length).toBeGreaterThan(100);
    for (const o of iron) {
      expect(o.amount).toBeGreaterThanOrEqual(5);
      expect(o.amount % 5).toBe(0);
    }
  });
  it('centre ≈ 3 500 max, bord ≈ 315 min (richesse ±20 %)', () => {
    const max = Math.max(...iron.map((o) => o.amount));
    const min = Math.min(...iron.map((o) => o.amount));
    expect(max).toBeLessThanOrEqual(3500 * 1.2 + 5);
    expect(max).toBeGreaterThan(2800);
    expect(min).toBeGreaterThanOrEqual(3500 * 0.8 * 0.09 - 5);
    expect(min).toBeLessThan(500);
  });
  it("plus on est au centre d'un tas, plus il y a de minerais", () => {
    // Plus grand tas connexe (voisinage à 4 cases).
    const byKey = new Map(iron.map((o) => [`${o.gx},${o.gz}`, o]));
    const visited = new Set<string>();
    let best: typeof iron = [];
    for (const start of iron) {
      const key = `${start.gx},${start.gz}`;
      if (visited.has(key)) continue;
      const comp: typeof iron = [];
      const stack = [start];
      visited.add(key);
      while (stack.length > 0) {
        const cur = stack.pop() as (typeof iron)[number];
        comp.push(cur);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const k = `${cur.gx + dx},${cur.gz + dz}`;
          const next = byKey.get(k);
          if (next && !visited.has(k)) {
            visited.add(k);
            stack.push(next);
          }
        }
      }
      if (comp.length > best.length) best = comp;
    }
    expect(best.length).toBeGreaterThan(150);
    const cx = best.reduce((s, o) => s + o.gx, 0) / best.length;
    const cz = best.reduce((s, o) => s + o.gz, 0) / best.length;
    const dist = (o: (typeof iron)[number]): number => Math.hypot(o.gx - cx, o.gz - cz);
    const sorted = [...best].sort((a, b) => dist(a) - dist(b));
    const third = Math.floor(sorted.length / 3);
    const mean = (a: typeof iron): number => a.reduce((s, o) => s + o.amount, 0) / a.length;
    expect(mean(sorted.slice(0, third))).toBeGreaterThan(2 * mean(sorted.slice(-third)));
  });
  it('la densité règle la quantité par case', () => {
    const high = gen('quantites', (p) => (p.families.ores.density = 2));
    const ironHigh = region(high, 14).flatMap((c) => c.ore.filter((o) => o.id === 'iron_ore'));
    const mean = (a: { amount: number }[]): number =>
      a.reduce((s, o) => s + o.amount, 0) / a.length;
    expect(ironHigh.length).toBe(iron.length); // même forme de tas
    expect(mean(ironHigh) / mean(iron)).toBeGreaterThan(1.8);
    expect(mean(ironHigh) / mean(iron)).toBeLessThan(2.2);
  });
});

describe('réglages fréquence / taille / densité', () => {
  const count = (g: WorldGenerator, what: (c: ChunkData) => number): number =>
    region(g, 14, 40, 40).reduce((s, c) => s + what(c), 0);
  const trees = (c: ChunkData): number => c.objects.filter((o) => o.id === 'tree').length;
  const ore = (c: ChunkData): number => c.ore.length;

  it('plus de densité = plus d’arbres', () => {
    const low = count(
      gen('reglages', (p) => (p.families.forests.density = 0.25)),
      trees,
    );
    const mid = count(gen('reglages'), trees);
    const high = count(
      gen('reglages', (p) => (p.families.forests.density = 3)),
      trees,
    );
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });
  it('plus de taille = plus de minerai', () => {
    const small = count(
      gen('reglages', (p) => (p.families.ores.size = 0.5)),
      ore,
    );
    const big = count(
      gen('reglages', (p) => (p.families.ores.size = 2)),
      ore,
    );
    expect(small).toBeLessThan(big);
  });
  it('plus de fréquence = plus de minerai', () => {
    const rare = count(
      gen('reglages', (p) => (p.families.ores.frequency = 0.25)),
      ore,
    );
    const common = count(
      gen('reglages', (p) => (p.families.ores.frequency = 3)),
      ore,
    );
    expect(rare).toBeLessThan(common);
  });
  it('les multiplicateurs hors limites sont ramenés dans ×0,25 – ×3', () => {
    const g = gen('reglages', (p) => (p.families.ores.density = 99));
    expect(g.params.families.ores.density).toBe(3);
  });
});

describe('zone de départ garantie', () => {
  const seeds = ['a', 'monde', '12345', 'Terra Factory', 'x', 'zéro', 'ñandú', '42', 'seed', 'δ'];
  for (const seed of seeds) {
    it(`seed « ${seed} » : tout le nécessaire à portée de marche`, () => {
      const g = gen(seed);
      const found: Record<string, number> = {};
      for (const c of region(g, 20)) {
        for (const o of c.objects) {
          if (distM(o.gx, o.gz) <= 150) found[o.id] = (found[o.id] ?? 0) + 1;
        }
        for (const o of c.ore) if (distM(o.gx, o.gz) <= 150) found[o.id] = (found[o.id] ?? 0) + 1;
        for (const w of c.water) if (distM(w.gx, w.gz) <= 150) found.water = (found.water ?? 0) + 1;
      }
      expect(found.tree ?? 0).toBeGreaterThan(0);
      expect(found.rock ?? 0).toBeGreaterThan(0);
      for (const id of ['iron_ore', 'copper_ore', 'coal', 'water']) {
        expect(found[id] ?? 0, id).toBeGreaterThanOrEqual(20);
      }
    });
  }
  it("rien n'est posé sur le point d'apparition", () => {
    for (const seed of seeds) {
      for (const c of region(gen(seed), 3)) {
        for (const o of c.objects)
          expect(distM(o.gx + 1, o.gz + 1)).toBeGreaterThan(SPAWN_CLEAR_M - 1.5);
        for (const o of c.ore) expect(distM(o.gx, o.gz)).toBeGreaterThanOrEqual(SPAWN_CLEAR_M);
        for (const w of c.water) expect(distM(w.gx, w.gz)).toBeGreaterThanOrEqual(SPAWN_CLEAR_M);
      }
    }
  });
  it('aucun nid à moins de 250 m, mais il y en a plus loin', () => {
    let farNests = 0;
    for (const seed of ['nids', 'monde', '12345']) {
      for (const c of region(gen(seed), 45)) {
        for (const o of c.objects) {
          if (o.id !== 'nest') continue;
          expect(distM(o.gx + o.cells / 2, o.gz + o.cells / 2)).toBeGreaterThanOrEqual(240);
          farNests++;
        }
      }
    }
    expect(farNests).toBeGreaterThan(0);
  });
});

describe('regroupement en tas / bosquets', () => {
  /** Part d'objets ayant moins de 2 voisins dans un rayon de 5 m. */
  function isolatedShare(id: string, seed: string): number {
    const slots = new Set<string>();
    for (const c of region(gen(seed), 12)) {
      for (const o of c.objects) if (o.id === id) slots.add(`${o.gx / 2},${o.gz / 2}`);
    }
    let isolated = 0;
    for (const k of slots) {
      const [x, z] = k.split(',').map(Number);
      let n = 0;
      for (let dx = -5; dx <= 5; dx++)
        for (let dz = -5; dz <= 5; dz++) if ((dx || dz) && slots.has(`${x + dx},${z + dz}`)) n++;
      if (n < 2) isolated++;
    }
    return slots.size === 0 ? 0 : isolated / slots.size;
  }
  for (const seed of ['terra', 'AB12CD34', 'K7M2Q9XZ']) {
    it(`arbres et rochers sont en bosquets / affleurements, pas éparpillés (seed ${seed})`, () => {
      expect(isolatedShare('tree', seed)).toBeLessThan(0.12);
      expect(isolatedShare('rock', seed)).toBeLessThan(0.18);
    });
  }
  it('le départ expose un bosquet et un affleurement garantis', () => {
    const sites = gen('terra')
      .starterSites()
      .map((s) => s.id);
    expect(sites).toEqual(
      expect.arrayContaining(['tree', 'rock', 'iron_ore', 'copper_ore', 'coal', 'water']),
    );
  });
});

describe('biomes', () => {
  it('les quatre biomes existent, aucun ne domine', () => {
    const seed = hashSeed('biomes');
    const counts = Object.fromEntries(BIOME_IDS.map((b) => [b, 0]));
    for (let i = 0; i < 6000; i++) {
      counts[biomeAt(seed, (i % 100) * 150 - 7500, Math.floor(i / 100) * 300 - 9000)]++;
    }
    for (const b of BIOME_IDS) {
      expect(counts[b] / 6000, b).toBeGreaterThan(0.08);
      expect(counts[b] / 6000, b).toBeLessThan(0.5);
    }
  });
  it('le point de départ est toujours en prairie', () => {
    for (const s of ['a', 'b', 'c', 'monde', '12345'])
      expect(biomeAt(hashSeed(s), 0, 0)).toBe('prairie');
  });
});

describe('performance', () => {
  it('génère un chunk en moins de 5 ms en moyenne', () => {
    const g = gen('perf');
    const t0 = performance.now();
    const chunks = region(g, 8, 77, -33);
    const per = (performance.now() - t0) / chunks.length;
    expect(per).toBeLessThan(5);
  });
});
