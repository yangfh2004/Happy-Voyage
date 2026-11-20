/**
 * Tiny synthesised sound effects (no asset files): compass ticks, coins, flag
 * fanfare. The AudioContext starts on the first sound, which always follows a
 * click, so browsers allow it.
 */
const MUTE_KEY = 'happy-voyage:muted';

let ctx: AudioContext | null = null;
/** Storage can be missing or blocked (privacy modes); sound settings then last only for the page. */
function stored(): string | null {
  try {
    return localStorage.getItem(MUTE_KEY);
  } catch {
    return null;
  }
}

let muted = stored() === '1';

export const isMuted = () => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Not persisted; the choice still holds for this page.
  }
}

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'triangle', volume = 0.15) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration);
}

function click(start: number, volume = 0.25) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.03), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const gain = a.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain).connect(a.destination);
  src.start(t);
}

export const sfx = {
  spin() {
    for (let i = 0; i < 6; i++) click(i * 0.06 + Math.random() * 0.02, 0.2);
  },
  step() {
    tone(220 + Math.random() * 40, 0, 0.08, 'sine', 0.05);
  },
  coin() {
    tone(988, 0, 0.08, 'square', 0.06);
    tone(1319, 0.07, 0.25, 'square', 0.06);
  },
  pay() {
    tone(392, 0, 0.12, 'triangle', 0.12);
    tone(294, 0.1, 0.25, 'triangle', 0.12);
  },
  claim() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.13));
  },
  storm() {
    tone(110, 0, 0.5, 'sawtooth', 0.06);
    tone(82, 0.1, 0.6, 'sawtooth', 0.05);
  },
  win() {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35, 'triangle', 0.14));
  },
};
