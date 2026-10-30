import { describe, expect, it } from 'vitest';
import { itemLabel } from './gauge';

describe('nom d’un objet suivi pour l’info-bulle', () => {
  it('montre le pourcentage, y compris pour une batterie vide ou un objet neuf', () => {
    expect(itemLabel('battery_portable')).toContain('(0 %)');
    expect(itemLabel('battery_portable~6')).toContain('(60 %)');
    expect(itemLabel('repair_kit')).toContain('(100 %)');
  });

  it('ne change pas le nom des autres objets', () => {
    expect(itemLabel('iron_plate')).not.toContain('%');
  });
});
