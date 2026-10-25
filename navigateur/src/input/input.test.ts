import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('commandes à l’écran (tactile)', () => {
  it('une action virtuelle maintenue compte comme une touche, jusqu’au relâchement', () => {
    const input = new Input({} as HTMLElement);
    expect(input.isActionActive('jump')).toBe(false);
    input.setVirtual('jump', true);
    expect(input.isActionActive('jump')).toBe(true);
    expect(input.isActionActive('crouch')).toBe(false);
    input.setVirtual('jump', false);
    expect(input.isActionActive('jump')).toBe(false);
  });
});
