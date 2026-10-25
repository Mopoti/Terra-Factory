/**
 * Bruit de moteur des véhicules (Web Audio, fabriqué à la volée) : un ronronnement continu dont la hauteur suit la
 * vitesse et l'effort, et pour la locomotive à vapeur des « chuffs » au rythme des roues. Appelé à chaque image tant
 * qu'on conduit ; `null` coupe le moteur. Suit le volume « Machines » des réglages.
 */
import { effectiveVolume } from './audio';

export type EngineKind = 'quad' | 'buggy' | 'tank' | 'steam';

interface Profile {
  /** Fréquence du ronflement au ralenti et à pleine vitesse (Hz). */
  idle: number;
  top: number;
  wave: OscillatorType;
  /** Coupure (Hz) du filtre passe-bas : plus bas = plus sourd. */
  cutoff: number;
  gain: number;
}

const PROFILES: Record<EngineKind, Profile> = {
  // Petit moteur nerveux, aigu.
  quad: { idle: 48, top: 150, wave: 'sawtooth', cutoff: 900, gain: 0.5 },
  // Moteur de buggy plus rond.
  buggy: { idle: 38, top: 105, wave: 'sawtooth', cutoff: 650, gain: 0.55 },
  // Diesel lourd, grave.
  tank: { idle: 24, top: 52, wave: 'square', cutoff: 380, gain: 0.6 },
  // Locomotive : grondement de fond (les chuffs viennent par-dessus).
  steam: { idle: 20, top: 34, wave: 'triangle', cutoff: 260, gain: 0.35 },
};

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let live: {
  kind: EngineKind;
  osc: OscillatorNode;
  osc2: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  nextChuff: number;
} | null = null;

function context(): AudioContext | null {
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

function stop(): void {
  if (!live || !ctx) return;
  const { osc, osc2, gain } = live;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(0.0001, t, 0.08);
  osc.stop(t + 0.4);
  osc2.stop(t + 0.4);
  live = null;
}

/** Un « chuff » de vapeur : rafale de bruit filtrée, courte. */
function chuff(a: AudioContext, volume: number, strength: number): void {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 420 + 500 * strength;
  filter.Q.value = 0.9;
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, volume * (0.25 + 0.5 * strength)),
    t + 0.012,
  );
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.2);
}

/**
 * À appeler à chaque image : `kind` du moteur (null : arrêté), `speed` de 0 à 1 (vitesse / vitesse maximale) et
 * `effort` de 0 à 1 (accélérateur enfoncé).
 */
export function setEngine(kind: EngineKind | null, speed: number, effort: number): void {
  if (kind === null) return stop();
  const volume = effectiveVolume('machines');
  if (volume <= 0) return stop();
  const a = context();
  if (!a) return;
  if (live && live.kind !== kind) stop();
  const p = PROFILES[kind];
  if (!live) {
    const osc = a.createOscillator();
    const osc2 = a.createOscillator();
    osc.type = p.wave;
    osc2.type = 'sine';
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoff;
    const gain = a.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(a.destination);
    osc.start();
    osc2.start();
    live = { kind, osc, osc2, filter, gain, nextChuff: 0 };
  }
  const s = Math.max(0, Math.min(1, speed));
  const e = Math.max(0, Math.min(1, effort));
  const t = a.currentTime;
  // Le régime monte avec la vitesse et un peu avec l'effort ; léger vibrato pour ne pas sonner comme un diapason.
  const freq = p.idle + (p.top - p.idle) * Math.min(1, s * 0.8 + e * 0.25);
  const wobble = 1 + 0.02 * Math.sin(t * 23);
  live.osc.frequency.setTargetAtTime(freq * wobble, t, 0.05);
  live.osc2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
  live.filter.frequency.setTargetAtTime(p.cutoff * (0.8 + 0.7 * Math.max(s, e)), t, 0.1);
  const level = volume * p.gain * (0.35 + 0.4 * e + 0.25 * s) * 0.5;
  live.gain.gain.setTargetAtTime(Math.max(0.0002, level), t, 0.08);
  if (kind === 'steam' && (s > 0.02 || e > 0.05)) {
    // Quatre chuffs par tour de roue : plus la locomotive va vite, plus ils sont rapprochés.
    if (t >= live.nextChuff) {
      chuff(a, volume, Math.max(e, s));
      live.nextChuff = t + 0.62 / (0.4 + 3.2 * s + e);
    }
  }
}
