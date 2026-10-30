import { describe, expect, it } from 'vitest';
import { TIER_VALUES, gpuTier, lowestTier, recommend, tierOf, type HardwareInfo } from './graphics';

const pc = (gpu: string, extra: Partial<HardwareInfo> = {}): HardwareInfo => ({
  gpu,
  cores: 8,
  memoryGb: 8,
  pixels: 1920 * 1080,
  touch: false,
  ...extra,
});

describe('niveau recommandé selon le matériel', () => {
  it('rendu logiciel et cartes intégrées : bas', () => {
    expect(gpuTier('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))')).toBe('low');
    expect(gpuTier('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)')).toBe('low');
    expect(gpuTier('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)')).toBe('low');
    expect(gpuTier('Mali-G78')).toBe('low');
  });
  it('milieu de gamme : moyen ; cartes récentes : haut', () => {
    expect(gpuTier('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)')).toBe('medium');
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce GTX 750 Ti)')).toBe('medium');
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce GTX 970 (0x000013C2) Direct3D11)')).toBe(
      'medium',
    );
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB)')).toBe('high');
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)')).toBe('high');
    expect(gpuTier('ANGLE (NVIDIA, NVIDIA GeForce RTX 2050)')).toBe('medium');
    expect(gpuTier('ANGLE (AMD, AMD Radeon RX 6700 XT)')).toBe('high');
    expect(gpuTier('ANGLE (Apple, ANGLE Metal Renderer: Apple M2)')).toBe('high');
    expect(gpuTier('')).toBe('medium');
  });
  it('un petit processeur, peu de mémoire, un écran tactile ou un écran 4K font baisser le niveau', () => {
    const rtx = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)';
    expect(recommend(pc(rtx))).toBe('high');
    expect(recommend(pc(rtx, { cores: 4 }))).toBe('medium');
    expect(recommend(pc(rtx, { cores: 2 }))).toBe('low');
    expect(recommend(pc(rtx, { memoryGb: 4 }))).toBe('medium');
    expect(recommend(pc(rtx, { touch: true }))).toBe('low');
    expect(recommend(pc(rtx, { pixels: 3840 * 2160 }))).toBe('medium');
  });
  it('le niveau le plus bas des deux, et la reconnaissance d’un niveau par ses réglages', () => {
    expect(lowestTier('high', 'low')).toBe('low');
    expect(lowestTier('low', 'high')).toBe('low');
    expect(tierOf(TIER_VALUES.medium)).toBe('medium');
    expect(tierOf({ ...TIER_VALUES.medium, viewDistance: 9 })).toBeNull();
  });
});
