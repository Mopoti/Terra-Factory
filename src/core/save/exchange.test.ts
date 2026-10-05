import { describe, expect, it } from 'vitest';
import {
  EXCHANGE_FORMAT,
  EXCHANGE_VERSION,
  buildExchange,
  decodeExchange,
  encodeExchange,
  exchangeFileName,
  parseExchange,
} from './exchange';
import { SaveLibrary } from './library';
import { DEFAULT_PLAYER_STATE } from './saveIndex';
import { MemoryStorage } from './storage';

function sampleGame() {
  const lib = SaveLibrary.empty(new MemoryStorage());
  const g = lib.create('Ma base à l’été', 'terra', {
    families: {
      ...lib.create('t', 'x').world.families,
      ores: { frequency: 2, size: 1.5, density: 0.5 },
    },
  });
  lib.saveSlot(
    g.id,
    {
      name: 'Départ',
      kind: 'manual',
      player: { ...DEFAULT_PLAYER_STATE, x: 12 },
      inventory: { wood: 3 },
    },
    5,
    1000,
  );
  return lib.get(g.id)!;
}

describe('export / import d’une partie', () => {
  it('aller-retour : la partie retrouvée est identique', async () => {
    const game = sampleGame();
    const blob = await encodeExchange(buildExchange(game, 5));
    const text = await decodeExchange(await blob.arrayBuffer());
    const result = parseExchange(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.game).toEqual(game);
  });
  it('le fichier est compressé (gzip) quand le navigateur le permet', async () => {
    const blob = await encodeExchange(buildExchange(sampleGame()));
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect([head[0], head[1]]).toEqual([0x1f, 0x8b]);
  });
  it('lit aussi un fichier non compressé', async () => {
    const plain = JSON.stringify(buildExchange(sampleGame()));
    const text = await decodeExchange(new TextEncoder().encode(plain).buffer as ArrayBuffer);
    expect(parseExchange(text).ok).toBe(true);
  });
  it('refuse un fichier vide, illisible ou qui n’est pas une partie', () => {
    expect(parseExchange('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseExchange('pas du json')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseExchange('42')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseExchange('{"format":"autre","version":1}')).toEqual({
      ok: false,
      reason: 'format',
    });
  });
  it('refuse un fichier d’une version plus récente que le jeu', () => {
    const text = JSON.stringify({ ...buildExchange(sampleGame()), version: EXCHANGE_VERSION + 1 });
    expect(parseExchange(text)).toEqual({ ok: false, reason: 'newer' });
  });
  it('refuse une partie sans seed (on ne devine pas un monde)', () => {
    const file = buildExchange(sampleGame()) as unknown as { game: { world: { seed?: string } } };
    delete file.game.world.seed;
    expect(parseExchange(JSON.stringify(file))).toEqual({ ok: false, reason: 'invalid' });
  });
  it('nettoie les données abîmées au lieu de les recopier', () => {
    const file = JSON.parse(JSON.stringify(buildExchange(sampleGame())));
    file.game.world.families.ores.frequency = 9999;
    file.game.saves[0].inventory = { wood: -5, inconnu: 3, coal: 2 };
    file.game.options = { realism: 'ultra' };
    const result = parseExchange(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.game.world.families.ores.frequency).toBe(3);
      expect(result.game.saves[0].inventory).toEqual({ coal: 2 });
      expect(result.game.options.realism).toBe('balanced');
    }
  });
  it('importer crée toujours une nouvelle partie (jamais d’écrasement)', () => {
    const lib = SaveLibrary.empty(new MemoryStorage());
    const game = sampleGame();
    const a = lib.importGame(game);
    const b = lib.importGame(game);
    expect(a.id).not.toBe(game.id);
    expect(a.id).not.toBe(b.id);
    expect(lib.list()).toHaveLength(2);
    expect(a.saves[0].inventory).toEqual({ wood: 3 });
  });
  it('un fichier trop gros est refusé', () => {
    expect(parseExchange('x'.repeat(80 * 1024 * 1024 + 1))).toEqual({
      ok: false,
      reason: 'tooBig',
    });
  });
  it('propose un nom de fichier propre', () => {
    expect(exchangeFileName({ ...sampleGame(), name: 'Ma base à l’été !' })).toBe(
      'terra-factory-ma-base-a-l-ete.terra',
    );
    expect(exchangeFileName({ ...sampleGame(), name: '???' })).toBe('terra-factory-partie.terra');
  });
  it('le marqueur de format est stable', () => {
    expect(buildExchange(sampleGame()).format).toBe(EXCHANGE_FORMAT);
    expect(EXCHANGE_FORMAT).toBe('terra-factory-game');
  });
});
