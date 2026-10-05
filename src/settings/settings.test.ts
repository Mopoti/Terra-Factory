import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTION_IDS,
  defaultControls,
  findConflict,
  setLayoutForTests,
  type ControlsSettings,
} from './controls';
import { ROW_BY_PATH } from './rows';
import { sanitize } from './store';
import { defaultSettings } from './schema';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';

beforeEach(() => setLayoutForTests(null));

function leafPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe('touches par défaut', () => {
  it('ZQSD en français = positions physiques W A S D', () => {
    const c = defaultControls(true);
    expect([c.forward[0], c.left[0], c.backward[0], c.right[0]]).toEqual([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
    ]);
  });
  it('WASD hors français', () => {
    const c = defaultControls(false);
    expect([c.forward[0], c.left[0]]).toEqual(['KeyW', 'KeyA']);
  });
  it('les lettres mnémotechniques suivent la disposition AZERTY (M = point-virgule physique)', () => {
    expect(defaultControls(true).map[0]).toBe('Semicolon');
    expect(defaultControls(false).map[0]).toBe('KeyM');
  });
  it('utilise la vraie disposition du clavier quand elle est connue', () => {
    setLayoutForTests({
      entries: () =>
        new Map([
          ['KeyW', 'z'],
          ['Semicolon', 'm'],
          ['KeyA', 'q'],
        ]).entries(),
    });
    const c = defaultControls(true);
    expect(c.forward[0]).toBe('KeyW');
    expect(c.map[0]).toBe('Semicolon');
  });
  for (const french of [true, false]) {
    it(`aucune touche en double par défaut (${french ? 'fr' : 'en'})`, () => {
      const c = defaultControls(french);
      const seen = new Map<string, string>();
      for (const id of ACTION_IDS) {
        for (const code of c[id]) {
          if (!code) continue;
          expect(seen.get(code), `${code} utilisé par ${seen.get(code)} et ${id}`).toBeUndefined();
          seen.set(code, id);
        }
      }
    });
  }
});

describe('conflits de touches', () => {
  it('détecte une touche déjà prise', () => {
    const c = defaultControls(true);
    expect(findConflict(c, 'Space', { action: 'sprint', slot: 0 })?.action).toBe('jump');
  });
  it("ignore l'emplacement en cours de modification", () => {
    const c = defaultControls(true);
    expect(findConflict(c, 'Space', { action: 'jump', slot: 0 })).toBeNull();
  });
});

describe('sanitize (lecture des réglages enregistrés)', () => {
  it('sans données : valeurs par défaut', () => {
    expect(sanitize(null, true)).toEqual(defaultSettings(true));
  });
  it('borne les curseurs et rejette les valeurs invalides', () => {
    const s = sanitize(
      { data: { display: { gamma: 99, quality: 'ultra', showFps: 'oui' }, sound: { master: -5 } } },
      true,
    );
    expect(s.display.gamma).toBe(2);
    expect(s.display.quality).toBe('medium');
    expect(s.display.showFps).toBe(false);
    expect(s.sound.master).toBe(0);
  });
  it('garde les valeurs valides et complète les réglages manquants (ancienne sauvegarde)', () => {
    const s = sanitize({ version: 0, data: { display: { gamma: 1.5 } } }, true);
    expect(s.display.gamma).toBe(1.5);
    expect(s.views.first.fov).toBe(90);
  });
  it('garde les touches personnalisées valides et ignore les autres', () => {
    const s = sanitize(
      { data: { controls: { jump: ['KeyJ', null], sprint: 'oups', pause: ['KeyP', null] } } },
      true,
    );
    expect(s.controls.jump).toEqual(['KeyJ', null]);
    expect(s.controls.sprint[0]).toBe('ShiftLeft');
    expect(s.controls.pause[0]).toBe('Escape');
  });
  it('ignore les clés inconnues', () => {
    const s = sanitize({ data: { inconnu: 1, display: { truc: 2 } } }, true) as unknown as Record<
      string,
      unknown
    >;
    expect(s.inconnu).toBeUndefined();
  });
});

describe('lignes de réglages', () => {
  it("chaque réglage de l'écran existe dans les valeurs par défaut et a un texte fr/en", () => {
    const defaults = new Set(leafPaths({ ...defaultSettings(true), controls: undefined }));
    for (const [path, row] of ROW_BY_PATH) {
      expect(defaults.has(path), `chemin inconnu : ${path}`).toBe(true);
      expect(`set.${path}` in fr, `traduction fr manquante : set.${path}`).toBe(true);
      expect(`set.${path}` in en, `traduction en manquante : set.${path}`).toBe(true);
      if (row.kind === 'select') {
        for (const o of row.options) {
          if (o.label) expect(o.label in fr, `option fr : ${o.label}`).toBe(true);
          if (o.label) expect(o.label in en, `option en : ${o.label}`).toBe(true);
        }
      }
    }
  });
  it('chaque liste déroulante propose sa valeur par défaut', () => {
    const d = defaultSettings(true);
    for (const [path, row] of ROW_BY_PATH) {
      if (row.kind !== 'select') continue;
      const value = path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], d);
      expect(
        row.options.some((o) => o.value === value),
        `${path} : la valeur par défaut ${String(value)} n'est pas proposée`,
      ).toBe(true);
    }
  });
  it('chaque action a un nom fr/en', () => {
    for (const id of ACTION_IDS) {
      expect(`action.${id}` in fr, id).toBe(true);
      expect(`action.${id}` in en, id).toBe(true);
    }
  });
  it('les valeurs par défaut sont dans les bornes', () => {
    const d = defaultSettings(true);
    expect(sanitize({ data: d }, true)).toEqual(d);
  });
  it('type ControlsSettings utilisé', () => {
    const c: ControlsSettings = defaultControls(true);
    expect(Object.keys(c).length).toBe(ACTION_IDS.length);
  });
});
