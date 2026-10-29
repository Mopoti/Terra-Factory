import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_CATEGORIES, categoryOf, itemById } from './items';
import { RECIPES } from './recipes';
import {
  discoveriesFromLegacy,
  isTechVisible,
  labPackSeconds,
  labResearchLevel,
  scienceCost,
  techById,
  techFor,
  TECHS,
} from './techs';

/** Machines et équipements : seuls objets comptés dans la limite de 2 par technologie (les matériaux sont libres). */
const counted = (item: string): boolean =>
  item.startsWith('machine_') ||
  !!itemById(item).equip ||
  item === 'sleeping_bag' ||
  item === 'bed';

describe('technologies', () => {
  it('chaque découverte débloque 5 machines ou équipements au plus (les vêtements sont groupés)', () => {
    for (const tech of TECHS) {
      expect(tech.unlocks.filter(counted).length, tech.id).toBeLessThanOrEqual(5);
    }
  });

  it('un objet n’est débloqué que par une seule technologie, et les prérequis existent', () => {
    const seen = new Map<string, string>();
    const ids = new Set(TECHS.map((t) => t.id));
    for (const tech of TECHS) {
      for (const r of tech.requires) expect(ids.has(r), `${tech.id} → ${r}`).toBe(true);
      for (const u of tech.unlocks) {
        expect(seen.get(u), u).toBeUndefined();
        seen.set(u, tech.id);
      }
    }
  });

  it("une ancienne sauvegarde garde ce qu'elle savait fabriquer", () => {
    // Anciennes technologies : Logistique (découpée en Manutention et Aiguillage), Électricité, Métallurgie.
    const got = discoveriesFromLegacy(['logistics', 'electricity', 'metallurgy']);
    for (const id of [
      'conveyor',
      'splitter',
      'merger',
      'waypoint',
      'chest_iron',
      'electricity',
      'stamper',
    ])
      expect(got, id).toContain(id);
    // Pas de Textile ni de Vapeur dans cette partie.
    expect(got).not.toContain('clothing');
    expect(got).not.toContain('boiler');
    // Les prérequis suivent : un objet acquis n'arrive jamais sans son prérequis.
    for (const id of got)
      for (const r of techById(id).requires) expect(got, `${id} → ${r}`).toContain(r);
  });
});

describe('onglets de fabrication', () => {
  it('chaque objet fabricable a un onglet, et aucun onglet n’est vide ni trop chargé', () => {
    const counts = new Map<string, number>();
    for (const item of ITEMS.filter((i) => i.recipe !== null)) {
      expect(categoryOf(item), item.id).not.toBeNull();
      counts.set(categoryOf(item)!, (counts.get(categoryOf(item)!) ?? 0) + 1);
    }
    for (const c of ITEM_CATEGORIES) {
      expect(counts.get(c) ?? 0, c).toBeGreaterThan(0);
      // L'onglet « Ressources » du mode Créatif tient les cases de ressources du monde (13) et les objets bruts (11) ; 16 par onglet au plus.
      expect(counts.get(c) ?? 0, c).toBeLessThanOrEqual(
        c === 'resources'
          ? 30
          : c === 'armor'
            ? 24
            : c === 'industrial' || c === 'buildings'
              ? 24
              : c === 'energy'
                ? 24
                : 16,
      );
    }
  });
});

describe('visibilité des technologies', () => {
  const vis = (id: string, done: string[], creative = false): boolean =>
    isTechVisible(techById(id), done, creative);

  it('paliers 0 et 1 toujours visibles ; paliers supérieurs cachés jusqu’à leurs prérequis', () => {
    expect(vis('cast_iron', [])).toBe(true);
    expect(vis('conveyor', [])).toBe(true);
    expect(vis('bessemer', [])).toBe(false);
    expect(vis('bessemer', ['gears', 'laboratory', 'pack_2'])).toBe(true);
    expect(vis('fusion', [])).toBe(false);
  });

  it('le mode Créatif montre tout', () => {
    expect(TECHS.every((t) => isTechVisible(t, [], true))).toBe(true);
  });

  it('le palier 0 se paie en ressources, le palier 1 en paquets T1 (et de combat)', () => {
    for (const t of TECHS.filter((x) => x.tier === 0)) expect(scienceCost(t), t.id).toBe(0);
    for (const t of TECHS.filter((x) => x.tier === 1))
      expect(
        Object.keys(t.cost).every((k) => k === 'science_pack' || k === 'combat_pack'),
        t.id,
      ).toBe(true);
  });
});

describe('technologies Recherche', () => {
  it('raccourcissent la consommation des paquets palier par palier', () => {
    const secs = (level: number): number[] =>
      ['science_pack', 'science_pack_2', 'science_pack_3', 'science_pack_4', 'science_pack_5'].map(
        (p) => labPackSeconds(p, level),
      );
    expect(secs(0)).toEqual([5, 5, 5, 5, 5]);
    expect(secs(1)).toEqual([4, 5, 5, 5, 5]);
    expect(secs(2)).toEqual([3, 4, 5, 5, 5]);
    expect(secs(3)).toEqual([2, 3, 4, 5, 5]);
    expect(secs(4)).toEqual([1, 2, 3, 4, 5]);
    expect(labPackSeconds('combat_pack', 4)).toBe(5);
  });

  it('le niveau suit les technologies dans l’ordre', () => {
    expect(labResearchLevel([])).toBe(0);
    expect(labResearchLevel(['research_1', 'research_2'])).toBe(2);
    expect(labResearchLevel(['research_2'])).toBe(0);
  });
});

describe('objets intermédiaires des paliers 3 à 5', () => {
  const NEW = [
    'aluminium_rod',
    'glass',
    'graphite',
    'lithium_salt',
    'carbon_fiber',
    'kit_circuit',
    'chassis_simple',
    'chassis_steel',
    'chassis_alu',
    'chassis_composite',
    'circuit_advanced',
    'microcontroller',
    'solar_cell',
    'battery_lithium',
    'graphite_filter',
    'armored_glass',
    'fusion_capsule',
    'supra_magnet',
    'quantum_crystal',
    'deuterium',
    'tritium',
    'liquid_nitrogen',
  ];
  it('ont une recette (à la main ou en machine) et une découverte', () => {
    for (const id of NEW) {
      const hand = ITEMS.find((i) => i.id === id)?.recipe;
      const machine = RECIPES.some((r) => r.out[id] !== undefined);
      expect(!!hand || machine, `${id} sans recette`).toBe(true);
      expect(techFor(id), `${id} sans découverte`).not.toBeNull();
    }
  });
  it('respectent la règle des 4 types d’ingrédients au plus', () => {
    for (const id of NEW) {
      const hand = ITEMS.find((i) => i.id === id)?.recipe;
      if (hand) expect(Object.keys(hand).length, id).toBeLessThanOrEqual(4);
    }
  });
});

describe('règle des types d’ingrédients et assembleurs', () => {
  const types = (id: string): number => Object.keys(itemById(id).recipe ?? {}).length;
  const tierOf = (id: string): number => techFor(id)?.tier ?? 0;

  it('une recette a 4 types d’ingrédients au plus, 3 avant le palier 3', () => {
    for (const item of ITEMS.filter((i) => i.recipe && !i.creativeOnly)) {
      const n = types(item.id);
      expect(n, item.id).toBeLessThanOrEqual(4);
      if (tierOf(item.id) < 3)
        expect(n, `${item.id} (palier ${tierOf(item.id)})`).toBeLessThanOrEqual(3);
    }
  });

  it('l’assembleur simple refuse une recette à 4 types, l’avancé l’accepte', async () => {
    const { GameState } = await import('../game/state');
    const { emptyMachine } = await import('../factory/factory');
    const four = ITEMS.find((i) => i.recipe && Object.keys(i.recipe).length === 4)!;
    const three = ITEMS.find(
      (i) => i.recipe && Object.keys(i.recipe).length === 3 && !i.creativeOnly,
    )!;
    const s = new GameState();
    s.creative = true;
    for (const id of [four.id, three.id]) {
      const tech = techFor(id);
      if (tech) s.changes.unlocked.push(tech.id);
    }
    const simple = emptyMachine(1, 'assembler', 0, 0, 0);
    const advanced = emptyMachine(2, 'assembler_advanced', 8, 0, 0);
    expect(s.setRecipe(simple, four.id)).toBe(false);
    expect(s.setRecipe(simple, three.id)).toBe(true);
    expect(s.setRecipe(advanced, four.id)).toBe(true);
  });

  it('un paquet de science fait à la main prend 5 s par palier', async () => {
    const { GameState } = await import('../game/state');
    const s = new GameState({ inventory: { stone: 10, iron_ore: 10 } });
    expect(s.craftSeconds('science_pack')).toBeGreaterThanOrEqual(5 - 1e-9);
    expect(s.craftSeconds('science_pack_3')).toBeGreaterThan(s.craftSeconds('science_pack'));
  });
});
