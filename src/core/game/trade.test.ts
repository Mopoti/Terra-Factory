import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { emptyMachine, Factory } from '../factory/factory';
import { GameState } from './state';
import { buyPrice, itemValue, sellPrice } from './trade';

describe('comptoir spatial', () => {
  it('tout objet a une valeur : on vend à la moitié et on achète à une fois et demie', () => {
    for (const item of ITEMS) {
      expect(itemValue(item.id), item.id).toBeGreaterThanOrEqual(1);
      expect(buyPrice(item.id), item.id).toBeGreaterThan(sellPrice(item.id));
    }
  });

  it('un objet fabriqué vaut plus que ses ingrédients', () => {
    expect(itemValue('iron_gear')).toBeGreaterThan(itemValue('iron_ingot'));
    expect(itemValue('machine_fusion_reactor')).toBeGreaterThan(itemValue('machine_accumulator'));
    expect(itemValue('uraninite')).toBeGreaterThan(itemValue('iron_ore'));
  });

  it('fermé avant la balise ; ensuite vente, achat, jamais de gain en achetant puis revendant', () => {
    const s = new GameState({ inventory: { iron_ore: 100 } });
    expect(s.sellItem('iron_ore', 10)).toBe(0);
    s.changes.beacon = true;
    const earned = s.sellItem('iron_ore', 10);
    expect(earned).toBe(10 * sellPrice('iron_ore'));
    expect(s.inventory.iron_ore).toBe(90);
    expect(s.changes.credits).toBe(earned);
    const bought = s.buyItem('uraninite', 1000);
    expect(bought).toBeLessThan(1000);
    expect(s.changes.credits).toBeLessThan(earned);
    s.changes.credits = 1000;
    expect(s.buyItem('copper_ore', 5)).toBe(5);
    const spent = 1000 - s.changes.credits;
    const back = s.sellItem('copper_ore', 5);
    expect(back).toBeLessThan(spent);
  });

  it('les crédits sont enregistrés avec la partie', () => {
    const s = new GameState({ inventory: {} });
    s.changes.beacon = true;
    s.changes.credits = 321;
    const copy = new GameState(JSON.parse(JSON.stringify(s.snapshot())));
    expect(copy.changes.credits).toBe(321);
    expect(copy.changes.beacon).toBe(true);
  });

  it('un tapis qui arrive au relais vend son contenu (seulement si le comptoir est ouvert)', () => {
    const relay = emptyMachine(1, 'relay', 4, 0, 0);
    const belt = emptyMachine(2, 'conveyor', 2, 0, 1); // vers +x, devant le relais
    belt.belt.push({ item: 'iron_ingot', pos: 1 });
    const f = new Factory([relay, belt], {
      oreAt: () => null,
      mineOre: () => 0,
    });
    for (let i = 0; i < 20; i++) f.tick(0.05);
    expect(f.takeSold()).toEqual([]);
    f.tradeOpen = true;
    for (let i = 0; i < 20; i++) f.tick(0.05);
    expect(f.takeSold()).toEqual([['iron_ingot', 1]]);
    const s = new GameState({ inventory: {} });
    s.changes.beacon = true;
    s.creditSale('iron_ingot', 1);
    expect(s.changes.credits).toBe(sellPrice('iron_ingot'));
  });
});
