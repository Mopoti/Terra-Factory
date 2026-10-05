import { getSettings } from '../settings/store';

export type SoundCategory = 'music' | 'ambience' | 'interaction' | 'machines' | 'alerts';

let ctx: AudioContext | null = null;

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

/** Volume réel (0 à 1) d'une catégorie : volume général × volume de la catégorie, 0 si muet. */
export function effectiveVolume(category: SoundCategory | 'master'): number {
  const { sound } = getSettings();
  if (sound.mute.master) return 0;
  const master = sound.master / 100;
  if (category === 'master') return master;
  return sound.mute[category] ? 0 : master * (sound[category] / 100);
}

const TEST_FREQUENCY: Record<SoundCategory | 'master', number> = {
  master: 440,
  music: 330,
  ambience: 262,
  interaction: 523,
  machines: 196,
  alerts: 660,
};

/** Joue un bip court au volume réglé (en attendant les vrais sons). */
export function playTestTone(category: SoundCategory | 'master'): void {
  const audio = context();
  if (!audio) return;
  const volume = effectiveVolume(category);
  if (volume <= 0) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = TEST_FREQUENCY[category];
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.3), now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

/** Coupe le son quand l'onglet passe en arrière-plan (si le réglage est activé). */
export function watchVisibility(): void {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden && getSettings().sound.muteInBackground) void ctx.suspend();
    else void ctx.resume();
  });
}
