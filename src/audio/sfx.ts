import { effectiveVolume } from './audio';

/**
 * Bruitages du jeu, fabriqués à la volée avec Web Audio (aucun fichier son à charger) : des rafales de
 * bruit filtrées et des notes courtes. Ils suivent le volume « Interactions » des réglages.
 */
export type SfxId =
  | 'stoneHit'
  | 'rockBreak'
  | 'woodChop'
  | 'treeFall'
  | 'oreHit'
  | 'oreBreak'
  | 'pickup'
  | 'drop'
  | 'stepGrass'
  | 'stepSand'
  | 'stepSnow'
  | 'stepStone'
  | 'stepWood'
  | 'jump'
  | 'land'
  | 'placeWood'
  | 'placeStone'
  | 'placeStairs'
  | 'demolish'
  | 'pipeBurst'
  | 'craft'
  | 'doorOpen'
  | 'doorClose'
  | 'select'
  | 'deny'
  | 'shot'
  | 'reload'
  | 'enemyHurt';

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<SfxId, number>();

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface NoiseSpec {
  /** Début (s) après maintenant. */
  at?: number;
  dur: number;
  vol: number;
  filter: BiquadFilterType;
  freq: number;
  /** Fréquence de fin du filtre (balayage). */
  freqEnd?: number;
  q?: number;
  attack?: number;
}

interface ToneSpec {
  at?: number;
  dur: number;
  vol: number;
  freq: number;
  freqEnd?: number;
  wave?: OscillatorType;
}

const pitch = (): number => 0.92 + Math.random() * 0.16;

function playNoise(a: AudioContext, out: AudioNode, spec: NoiseSpec, rate: number): void {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.playbackRate.value = rate;
  const filter = a.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 1;
  const gain = a.createGain();
  const t0 = a.currentTime + (spec.at ?? 0);
  filter.frequency.setValueAtTime(spec.freq * rate, t0);
  if (spec.freqEnd)
    filter.frequency.exponentialRampToValueAtTime(spec.freqEnd * rate, t0 + spec.dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.vol), t0 + (spec.attack ?? 0.004));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + spec.dur + 0.02);
}

function playTone(a: AudioContext, out: AudioNode, spec: ToneSpec, rate: number): void {
  const osc = a.createOscillator();
  osc.type = spec.wave ?? 'sine';
  const gain = a.createGain();
  const t0 = a.currentTime + (spec.at ?? 0);
  osc.frequency.setValueAtTime(spec.freq * rate, t0);
  if (spec.freqEnd) osc.frequency.exponentialRampToValueAtTime(spec.freqEnd * rate, t0 + spec.dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.vol), t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + spec.dur + 0.02);
}

type Recipe = { noise?: NoiseSpec[]; tones?: ToneSpec[]; minGap?: number };

const RECIPES: Record<SfxId, Recipe> = {
  // Pioche sur la pierre : claquement sec + petit « tac » aigu + un grave.
  stoneHit: {
    noise: [
      { dur: 0.09, vol: 0.5, filter: 'bandpass', freq: 2400, q: 1.2 },
      { dur: 0.16, vol: 0.35, filter: 'lowpass', freq: 900 },
    ],
    tones: [{ dur: 0.1, vol: 0.28, freq: 160, freqEnd: 70 }],
    minGap: 0.05,
  },
  // Le rocher s'effondre : éboulement qui s'éteint, plusieurs claquements.
  rockBreak: {
    noise: [
      { dur: 0.7, vol: 0.55, filter: 'lowpass', freq: 1800, freqEnd: 250, attack: 0.01 },
      { at: 0.06, dur: 0.07, vol: 0.4, filter: 'bandpass', freq: 3000 },
      { at: 0.17, dur: 0.07, vol: 0.35, filter: 'bandpass', freq: 2200 },
      { at: 0.3, dur: 0.08, vol: 0.3, filter: 'bandpass', freq: 1500 },
    ],
    tones: [{ dur: 0.45, vol: 0.4, freq: 90, freqEnd: 40 }],
  },
  // Coup de hache dans le bois : « toc » creux.
  woodChop: {
    noise: [
      { dur: 0.07, vol: 0.45, filter: 'bandpass', freq: 1100, q: 0.9 },
      { dur: 0.12, vol: 0.25, filter: 'lowpass', freq: 600 },
    ],
    tones: [{ dur: 0.16, vol: 0.5, freq: 240, freqEnd: 95 }],
    minGap: 0.05,
  },
  // L'arbre tombe : craquement puis gros bruit sourd.
  treeFall: {
    noise: [
      { dur: 0.35, vol: 0.5, filter: 'bandpass', freq: 3200, freqEnd: 700, q: 2, attack: 0.01 },
      { at: 0.1, dur: 0.12, vol: 0.5, filter: 'bandpass', freq: 1800, q: 3 },
      { at: 0.55, dur: 0.6, vol: 0.6, filter: 'lowpass', freq: 500, freqEnd: 120, attack: 0.02 },
    ],
    tones: [{ at: 0.55, dur: 0.5, vol: 0.6, freq: 80, freqEnd: 35 }],
  },
  // Minerai : choc métallique.
  oreHit: {
    noise: [{ dur: 0.05, vol: 0.4, filter: 'highpass', freq: 3500 }],
    tones: [
      { dur: 0.22, vol: 0.28, freq: 1250, wave: 'triangle' },
      { dur: 0.3, vol: 0.18, freq: 1870, wave: 'triangle' },
      { dur: 0.1, vol: 0.2, freq: 140, freqEnd: 80 },
    ],
    minGap: 0.05,
  },
  oreBreak: {
    noise: [{ dur: 0.35, vol: 0.45, filter: 'lowpass', freq: 2200, freqEnd: 300 }],
    tones: [
      { dur: 0.35, vol: 0.25, freq: 1250, wave: 'triangle' },
      { dur: 0.2, vol: 0.3, freq: 110, freqEnd: 50 },
    ],
  },
  shot: {
    noise: [
      { dur: 0.12, vol: 0.7, filter: 'bandpass', freq: 1800, q: 0.7 },
      { dur: 0.25, vol: 0.45, filter: 'lowpass', freq: 600 },
    ],
    tones: [{ dur: 0.12, vol: 0.3, freq: 260, freqEnd: 70, wave: 'square' }],
    minGap: 0.05,
  },
  reload: {
    noise: [
      { dur: 0.05, vol: 0.4, filter: 'bandpass', freq: 3000, q: 2 },
      { at: 0.18, dur: 0.06, vol: 0.5, filter: 'bandpass', freq: 2200, q: 2 },
    ],
    tones: [{ at: 0.18, dur: 0.05, vol: 0.2, freq: 420, freqEnd: 300, wave: 'square' }],
  },
  enemyHurt: {
    noise: [{ dur: 0.1, vol: 0.35, filter: 'bandpass', freq: 900, q: 1.5 }],
    tones: [{ dur: 0.12, vol: 0.2, freq: 330, freqEnd: 160, wave: 'sawtooth' }],
    minGap: 0.06,
  },
  pickup: {
    tones: [
      { dur: 0.09, vol: 0.28, freq: 520, freqEnd: 780 },
      { at: 0.07, dur: 0.12, vol: 0.22, freq: 780, freqEnd: 1040 },
    ],
    minGap: 0.04,
  },
  drop: {
    noise: [{ dur: 0.1, vol: 0.3, filter: 'lowpass', freq: 700 }],
    tones: [{ dur: 0.1, vol: 0.3, freq: 150, freqEnd: 80 }],
  },
  stepGrass: {
    noise: [{ dur: 0.1, vol: 0.12, filter: 'lowpass', freq: 650, freqEnd: 300, attack: 0.012 }],
    minGap: 0.12,
  },
  stepSand: {
    noise: [{ dur: 0.14, vol: 0.12, filter: 'bandpass', freq: 1800, freqEnd: 900, attack: 0.02 }],
    minGap: 0.12,
  },
  stepSnow: {
    noise: [
      { dur: 0.12, vol: 0.14, filter: 'highpass', freq: 2200, attack: 0.015 },
      { at: 0.03, dur: 0.1, vol: 0.08, filter: 'bandpass', freq: 3500 },
    ],
    minGap: 0.12,
  },
  stepStone: {
    noise: [{ dur: 0.05, vol: 0.2, filter: 'bandpass', freq: 2000, q: 1.5 }],
    tones: [{ dur: 0.07, vol: 0.12, freq: 190, freqEnd: 120 }],
    minGap: 0.12,
  },
  stepWood: {
    noise: [{ dur: 0.06, vol: 0.14, filter: 'bandpass', freq: 900 }],
    tones: [{ dur: 0.1, vol: 0.2, freq: 210, freqEnd: 120 }],
    minGap: 0.12,
  },
  jump: {
    noise: [{ dur: 0.18, vol: 0.12, filter: 'bandpass', freq: 500, freqEnd: 1400, q: 0.6 }],
    minGap: 0.1,
  },
  land: {
    noise: [{ dur: 0.14, vol: 0.28, filter: 'lowpass', freq: 800, freqEnd: 250 }],
    tones: [{ dur: 0.12, vol: 0.28, freq: 120, freqEnd: 55 }],
    minGap: 0.1,
  },
  // Poser du bois : toc creux ; de la pierre : choc lourd et sec.
  placeWood: {
    noise: [{ dur: 0.08, vol: 0.4, filter: 'bandpass', freq: 1000 }],
    tones: [
      { dur: 0.18, vol: 0.5, freq: 200, freqEnd: 100 },
      { at: 0.03, dur: 0.12, vol: 0.18, freq: 420, freqEnd: 300, wave: 'triangle' },
    ],
    minGap: 0.04,
  },
  placeStone: {
    noise: [
      { dur: 0.06, vol: 0.5, filter: 'bandpass', freq: 2600, q: 1.4 },
      { dur: 0.22, vol: 0.4, filter: 'lowpass', freq: 700, freqEnd: 250 },
    ],
    tones: [{ dur: 0.22, vol: 0.55, freq: 110, freqEnd: 55 }],
    minGap: 0.04,
  },
  placeStairs: {
    noise: [{ dur: 0.07, vol: 0.35, filter: 'bandpass', freq: 1400 }],
    tones: [
      { dur: 0.12, vol: 0.4, freq: 170, freqEnd: 90 },
      { at: 0.06, dur: 0.12, vol: 0.4, freq: 210, freqEnd: 110 },
    ],
    minGap: 0.04,
  },
  pipeBurst: {
    noise: [
      { dur: 0.15, vol: 0.5, filter: 'lowpass', freq: 900, freqEnd: 200 },
      { at: 0.05, dur: 0.9, vol: 0.3, filter: 'highpass', freq: 3500, freqEnd: 2500 },
    ],
    tones: [{ dur: 0.18, vol: 0.35, freq: 160, freqEnd: 55 }],
    minGap: 0.5,
  },
  demolish: {
    noise: [
      { dur: 0.3, vol: 0.45, filter: 'lowpass', freq: 1600, freqEnd: 300 },
      { at: 0.03, dur: 0.06, vol: 0.35, filter: 'bandpass', freq: 2800 },
    ],
    tones: [{ dur: 0.2, vol: 0.3, freq: 120, freqEnd: 60 }],
    minGap: 0.08,
  },
  craft: {
    noise: [{ dur: 0.04, vol: 0.25, filter: 'highpass', freq: 3000 }],
    tones: [
      { dur: 0.08, vol: 0.2, freq: 660, wave: 'triangle' },
      { at: 0.08, dur: 0.16, vol: 0.22, freq: 990, wave: 'triangle' },
    ],
  },
  // Porte : grincement qui monte à l'ouverture, claquement sourd à la fermeture.
  doorOpen: {
    noise: [{ dur: 0.35, vol: 0.12, filter: 'bandpass', freq: 500, freqEnd: 1400, q: 3 }],
    tones: [{ dur: 0.35, vol: 0.14, freq: 110, freqEnd: 190, wave: 'sawtooth' }],
    minGap: 0.1,
  },
  doorClose: {
    noise: [{ dur: 0.12, vol: 0.4, filter: 'lowpass', freq: 900 }],
    tones: [
      { dur: 0.15, vol: 0.45, freq: 140, freqEnd: 70 },
      { dur: 0.25, vol: 0.1, freq: 190, freqEnd: 110, wave: 'sawtooth' },
    ],
    minGap: 0.1,
  },
  select: { tones: [{ dur: 0.04, vol: 0.12, freq: 880, wave: 'square' }], minGap: 0.03 },
  deny: {
    tones: [{ dur: 0.14, vol: 0.18, freq: 150, freqEnd: 110, wave: 'sawtooth' }],
    minGap: 0.15,
  },
};

/** Joue un bruitage (légèrement différent à chaque fois). Sans effet si le son est coupé. */
export function playSfx(id: SfxId, intensity = 1): void {
  const volume = effectiveVolume('interaction');
  if (volume <= 0) return;
  const a = audio();
  if (!a) return;
  const recipe = RECIPES[id];
  const now = a.currentTime;
  if (now - (lastPlayed.get(id) ?? -1) < (recipe.minGap ?? 0)) return;
  lastPlayed.set(id, now);
  const out = a.createGain();
  out.gain.value = Math.min(1, volume * intensity);
  out.connect(a.destination);
  const rate = pitch();
  for (const n of recipe.noise ?? []) playNoise(a, out, n, rate);
  for (const t of recipe.tones ?? []) playTone(a, out, t, rate);
}
