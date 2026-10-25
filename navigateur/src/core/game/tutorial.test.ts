import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS, Tutorial } from './tutorial';

const ctx = (
  over: Partial<Parameters<Tutorial['update']>[0]> = {},
): Parameters<Tutorial['update']>[0] => ({
  inventory: {},
  hasTool: false,
  toolEquipped: false,
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
    for (const d of ['forward', 'left', 'backward', 'right']) t.signal(d);
    expect(t.update(ctx())?.id).toBe('move');
    expect(t.current()?.id).toBe('jump');
    // le signal « saut » reçu avant a été oublié à la validation de l'étape précédente
    expect(t.update(ctx())).toBeNull();
  });

  it('les étapes de récolte et de four se lisent dans le monde', () => {
    const { t, saved } = make();
    for (const s of [
      ['forward', 'left', 'backward', 'right'],
      ['jump'],
      ['crouch'],
      ['sprint'],
      ['lookLeft', 'lookRight', 'lookUp', 'lookDown'],
      ['view:first', 'view:third', 'view:top'],
      ['map'],
    ]) {
      for (const sig of s) t.signal(sig);
      t.update(ctx());
    }
    expect(t.current()?.id).toBe('wood');
    expect(t.update(ctx({ inventory: { wood: 6, stone: 4 } }))?.id).toBe('stone');
    expect(t.current()?.id).toBe('tool');
    t.update(ctx({ hasTool: true }));
    // L'outil fabriqué ne suffit pas : il faut le ranger dans la case d'outils.
    expect(t.current()?.id).toBe('equip');
    t.update(ctx({ hasTool: true }));
    expect(t.current()?.id).toBe('equip');
    t.update(ctx({ hasTool: true, toolEquipped: true }));
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

  it('la barre de progression compte les gestes faits (touches, sens de la caméra, vues, unités récoltées)', () => {
    const { t } = make();
    expect(t.progress()).toEqual({ have: 0, total: 4 });
    t.signal('forward');
    t.signal('forward'); // le même geste ne compte qu'une fois
    t.signal('left');
    t.update(ctx());
    expect(t.progress()).toEqual({ have: 2, total: 4 });
    t.signal('backward');
    t.signal('right');
    t.update(ctx());
    expect(t.current()?.id).toBe('jump');
    expect(t.progress()).toEqual({ have: 0, total: 1 });
    for (const s of ['jump', 'crouch', 'sprint']) {
      t.signal(s);
      t.update(ctx());
    }
    expect(t.progress()).toEqual({ have: 0, total: 4 }); // regarder
    t.signal('lookLeft');
    t.signal('lookRight');
    t.update(ctx());
    expect(t.progress()).toEqual({ have: 2, total: 4 });
    for (const s of ['lookUp', 'lookDown', 'view:first', 'view:third', 'view:top', 'map']) {
      t.signal(s);
      t.update(ctx());
    }
    expect(t.current()?.id).toBe('wood');
    t.update(ctx({ inventory: { wood: 2 } }));
    expect(t.progress()).toEqual({ have: 2, total: 6 });
  });
});
