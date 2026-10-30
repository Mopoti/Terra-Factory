/**
 * Préréglages graphiques : bas, moyen, haut règlent d'un coup la qualité, les ombres et la distance de vue ; « adapté »
 * choisit lui-même le meilleur d'après l'ordinateur du joueur (carte graphique, processeur, mémoire, écran) et peut
 * descendre d'un cran si le jeu ne tient pas la cadence.
 */
import type { Quality, ShadowQuality } from './schema';

export type Tier = 'low' | 'medium' | 'high';
export type GraphicsPreset = Tier | 'adapted' | 'custom';
export const GRAPHICS_PRESETS: readonly GraphicsPreset[] = [
  'adapted',
  'low',
  'medium',
  'high',
  'custom',
];
export const TIERS: readonly Tier[] = ['low', 'medium', 'high'];

export interface GraphicsValues {
  quality: Quality;
  shadows: ShadowQuality;
  viewDistance: number;
}

/** Réglages de chaque niveau. */
export const TIER_VALUES: Record<Tier, GraphicsValues> = {
  low: { quality: 'low', shadows: 'off', viewDistance: 6 },
  medium: { quality: 'medium', shadows: 'normal', viewDistance: 8 },
  high: { quality: 'high', shadows: 'detailed', viewDistance: 12 },
};

export interface HardwareInfo {
  /** Nom de la carte graphique donné par le navigateur (vide si inconnu). */
  gpu: string;
  cores: number;
  /** Mémoire de l'appareil en Go (le navigateur plafonne à 8), ou null. */
  memoryGb: number | null;
  /** Pixels de l'écran (largeur × hauteur × ratio de pixels²). */
  pixels: number;
  touch: boolean;
}

const lower = (tier: Tier, steps = 1): Tier => TIERS[Math.max(0, TIERS.indexOf(tier) - steps)];
const cap = (tier: Tier, max: Tier): Tier =>
  TIERS.indexOf(tier) > TIERS.indexOf(max) ? max : tier;

/** Niveau que permet la carte graphique seule, d'après son nom. */
export function gpuTier(gpu: string): Tier {
  const g = gpu.toLowerCase().replace(/\((r|tm)\)/g, '');
  if (g === '') return 'medium';
  // Rendu par logiciel : aucune carte graphique utilisable.
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic|softpipe/.test(g)) return 'low';
  if (/apple/.test(g)) return /\bm\d|apple gpu/.test(g) && !/\ba\d/.test(g) ? 'high' : 'medium';
  const number = (re: RegExp): number => Number(re.exec(g)?.[1] ?? NaN);
  if (/nvidia|geforce/.test(g)) {
    const rtx = number(/rtx\s*(?:a|pro\s*)?(\d{4})/);
    if (!Number.isNaN(rtx)) return rtx >= 2060 ? 'high' : 'medium';
    const gtx = number(/gtx\s*(\d{3,4})/);
    if (!Number.isNaN(gtx)) {
      // 16xx, 9xx et 10xx : du milieu de gamme ; les petits modèles (xx50 et moins) sont à part.
      if (gtx >= 1060 && gtx < 1600) return 'high';
      if (gtx >= 1650 && gtx < 2000) return 'high';
      return 'medium';
    }
    const mx = number(/\bmx\s*(\d{3})/);
    return Number.isNaN(mx) ? 'medium' : 'low';
  }
  if (/radeon|amd|ati\b/.test(g)) {
    const rx = number(/rx\s*(\d{3,4})/);
    if (!Number.isNaN(rx)) return rx >= 5600 ? 'high' : rx >= 470 ? 'medium' : 'low';
    // « Radeon Graphics », « Vega » : cartes intégrées au processeur.
    return 'low';
  }
  if (/intel/.test(g)) {
    if (/\barc\b/.test(g)) return 'high';
    if (/iris xe|iris plus|iris pro/.test(g)) return 'medium';
    return 'low';
  }
  if (/mali|adreno|powervr|videocore/.test(g)) return 'low';
  return 'medium';
}

/** Niveau recommandé pour cet ordinateur. */
export function recommend(hw: HardwareInfo): Tier {
  let tier = gpuTier(hw.gpu);
  if (hw.touch) tier = cap(tier, 'low');
  if (hw.cores > 0 && hw.cores <= 2) tier = cap(tier, 'low');
  else if (hw.cores > 0 && hw.cores <= 4) tier = cap(tier, 'medium');
  if (hw.memoryGb !== null && hw.memoryGb <= 2) tier = cap(tier, 'low');
  else if (hw.memoryGb !== null && hw.memoryGb <= 4) tier = cap(tier, 'medium');
  // Un écran 4K demande quatre fois plus de pixels à dessiner : on descend d'un cran.
  if (hw.pixels > 8_000_000) tier = lower(tier);
  return tier;
}

/** Plus bas des deux niveaux. */
export const lowestTier = (a: Tier, b: Tier): Tier => cap(a, b);

/** Réglages d'un préréglage ; `adapted` demande le niveau recommandé (et celui, plus bas, où l'on est descendu). */
export function presetValues(preset: Tier | 'adapted', adaptedTier: Tier): GraphicsValues {
  return TIER_VALUES[preset === 'adapted' ? adaptedTier : preset];
}

/** Le niveau dont ces réglages sont exactement les valeurs, ou null (personnalisés). */
export function tierOf(values: GraphicsValues): Tier | null {
  return (
    TIERS.find((t) => {
      const v = TIER_VALUES[t];
      return (
        v.quality === values.quality &&
        v.shadows === values.shadows &&
        v.viewDistance === values.viewDistance
      );
    }) ?? null
  );
}

/** Lit le matériel de l'appareil (carte graphique via WebGL). Prudent : sans page ou sans WebGL, des valeurs neutres. */
export function detectHardware(): HardwareInfo {
  const info: HardwareInfo = { gpu: '', cores: 0, memoryGb: null, pixels: 0, touch: false };
  if (typeof navigator !== 'undefined') {
    info.cores = navigator.hardwareConcurrency || 0;
    info.memoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null;
    info.touch =
      navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  }
  if (typeof window !== 'undefined' && window.screen) {
    const ratio = window.devicePixelRatio || 1;
    info.pixels = Math.round(window.screen.width * ratio * window.screen.height * ratio);
  }
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') ??
        canvas.getContext('webgl')) as WebGLRenderingContext | null;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      if (gl && ext) info.gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* pas de WebGL : on garde les valeurs neutres */
    }
  }
  return info;
}

const STORAGE_KEY = 'terra.adaptedTier';

/** Niveau où le jeu est descendu sur cet ordinateur (il n'y remonte pas tout seul), ou null. */
export function storedDowngrade(): Tier | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return TIERS.find((t) => t === v) ?? null;
  } catch {
    return null;
  }
}

export function storeDowngrade(tier: Tier | null): void {
  try {
    if (tier) localStorage.setItem(STORAGE_KEY, tier);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/** Niveau « adapté » à utiliser : le recommandé, sans dépasser le niveau où l'on est descendu. */
export function adaptedTier(hw: HardwareInfo = detectHardware()): Tier {
  const best = recommend(hw);
  const down = storedDowngrade();
  return down ? lowestTier(best, down) : best;
}
