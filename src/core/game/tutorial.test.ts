import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS, Tutorial } from './tutorial';

const ctx = (
  over: Partial<Parameters<Tutorial['update']>[0]> = {},
): Parameters<Tutorial['update']>[0] => ({
  inventory: {},
  hasTool: false,
  machines: [],
  ...over,
});
const make = (
  enabled = true,
): { t: Tutorial; saved: { tutorialDone: string[]; tutorialSkipped: boolean } } => {
  const saved = { tutorialDone: [] as string[], tutorialSkipped: false };
  return { t: new Tutorial(saved, enabled), saved };
};

describe('tutoriel', () => {
  it('les étapes se valident dans l’ordre : un signal en avance ne compte pas', () => {
    const { t } = make();
    expect(t.current()?.id).toBe('move');
    t.signal('jump');
    expect(t.update(ctx())).toBeNull();
    t.signal('move');
    expect(t.update(ctx())?.id).toBe('move');
    expect(t.current()?.id).toBe('jump');
    // le signal « saut » reçu avant a été oublié à la validation de l'étape précédente
    expect(t.update(ctx())).toBeNull();
  });

  it('les étapes de récolte et de four se lisent dans le monde', () => {
    const { t, saved } = make();
    for (const s of ['move', 'jump', 'crouch', 'sprint', 'look', 'view', 'map']) {
      t.signal(s);
      t.update(ctx());
    }
    expect(t.current()?.id).toBe('wood');
    expect(t.update(ctx({ inventory: { wood: 2, stone: 1 } }))?.id).toBe('stone');
    expect(t.current()?.id).toBe('tool');
    t.update(ctx({ hasTool: true }));
    t.update(ctx({ machines: [{ type: 'furnace', fuelCount: 0, slots: [], stockItem: null }] }));
    expect(t.current()?.id).toBe('coal');
    t.update(ctx({ machines: [{ type: 'furnace', fuelCount: 3, slots: [], stockItem: null }] }));
    expect(t.current()?.id).toBe('iron');
    t.update(ctx({ inventory: { iron_ingot: 1 } }));
    expect(t.current()).toBeNull();
    expect(saved.tutorialDone).toHaveLength(TUTORIAL_STEPS.length);
  });

  it('on peut le passer, et il ne s’affiche pas s’il est désactivé', () => {
    const a = make();
    a.t.skip();
    expect(a.t.current()).toBeNull();
    expect(a.saved.tutorialSkipped).toBe(true);
    expect(make(false).t.current()).toBeNull();
  });

  it('la progression reprend là où elle s’est arrêtée', () => {
    const saved = { tutorialDone: ['move', 'jump'], tutorialSkipped: false };
    expect(new Tutorial(saved, true).current()?.id).toBe('crouch');
  });
});
