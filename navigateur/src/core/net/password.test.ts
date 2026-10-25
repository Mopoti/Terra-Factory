import { describe, expect, it } from 'vitest';
import { hashPassword, passwordMatches, sha256 } from './password';

describe('mot de passe', () => {
  it('SHA-256 : valeurs de référence', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('é'.repeat(100))).toHaveLength(64);
  });

  it('l’empreinte n’est pas le mot de passe, change avec le sel, et le valide', () => {
    const a = hashPassword('secret');
    const b = hashPassword('secret');
    expect(a).not.toContain('secret');
    expect(a).not.toBe(b);
    expect(passwordMatches(a, 'secret')).toBe(true);
    expect(passwordMatches(a, 'Secret')).toBe(false);
    expect(passwordMatches(a, undefined)).toBe(false);
    expect(hashPassword(a)).toBe(a); // déjà une empreinte
  });

  it('sans mot de passe tout le monde entre ; un ancien mot de passe en clair reste valable', () => {
    expect(hashPassword('')).toBe('');
    expect(passwordMatches('', undefined)).toBe(true);
    expect(passwordMatches('vieux', 'vieux')).toBe(true);
    expect(passwordMatches('vieux', 'autre')).toBe(false);
  });
});
