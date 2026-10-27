import { describe, expect, it } from 'vitest';
import { TECHS, techStatus, treeParents } from '../core/data/techs';
import { NODE_H, NODE_W, layoutTree } from './techLayout';

describe('arbre des découvertes', () => {
  const layout = layoutTree(TECHS);

  it('place chaque découverte, sans chevauchement', () => {
    expect(layout.pos.size).toBe(TECHS.length);
    const boxes = [...layout.pos.values()];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.x < b.x + NODE_W && b.x < a.x + NODE_W && a.y < b.y + NODE_H && b.y < a.y + NODE_H;
        expect(overlap).toBe(false);
      }
  });

  it("met chaque prérequis plus haut que ce qu'il débloque", () => {
    for (const t of TECHS)
      for (const p of treeParents(t)) {
        const a = layout.pos.get(p);
        const b = layout.pos.get(t.id);
        expect((a?.y ?? 0) < (b?.y ?? 0)).toBe(true);
      }
  });

  it('ne trace pas les liens déjà impliqués par un autre prérequis', () => {
    const links = new Set(layout.edges.map((e) => `${e.from}>${e.to}`));
    const all = TECHS.reduce((n, t) => n + treeParents(t).length, 0);
    expect(links.size).toBeLessThan(all);
  });
});

describe("état d'une découverte", () => {
  const t = { id: 'x', cost: {}, requires: ['a', 'b'], tier: 1, unlocks: [] };
  it('distingue faite, à portée, proche et lointaine', () => {
    expect(techStatus(t, ['x'])).toBe('done');
    expect(techStatus(t, ['a', 'b'])).toBe('next');
    expect(techStatus(t, ['a'])).toBe('near');
    expect(techStatus(t, [])).toBe('far');
    expect(techStatus({ ...t, requires: [] }, [])).toBe('next');
  });
});
