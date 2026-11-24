/**
 * Synthesised audio (no asset files): a looping 6/8 sea-shanty soundtrack, rolling
 * ocean waves, cannon fire, coin and trading sounds. Everything is built from
 * Web Audio oscillators and noise, mixed through per-channel volume buses.
 * The AudioContext starts on the first user gesture, so browsers allow it.
 */
import { SHANTY, SHANTY_EIGHTH_SECONDS, midiToHz } from './shanty';

export type SoundChannel = 'music' | 'waves' | 'effects';
export interface SoundSettings {
  muted: boolean;
  music: number;
  waves: number;
  effects: number;
}
export const SOUND_CHANNELS: { id: SoundChannel; label: string }[] = [
  { id: 'music', label: 'Music' },
  { id: 'waves', label: 'Waves' },
  { id: 'effects', label: 'Effects' },
];
export const DEFAULT_SOUND: SoundSettings = { muted: false, music: 0.6, waves: 0.5, effects: 0.8 };

const SETTINGS_KEY = 'happy-voyage:sound';
/** Older builds stored only the mute switch here. */
const MUTE_KEY = 'happy-voyage:muted';

const clamp01 = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** Reads stored settings, tolerating missing, legacy or corrupt values. */
export function parseSoundSettings(raw: string | null, legacyMuted: string | null = null): SoundSettings {
  let saved: Partial<Record<keyof SoundSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') saved = parsed as typeof saved;
  } catch {}
  return {
    muted: typeof saved.muted === 'boolean' ? saved.muted : legacyMuted === '1',
    music: clamp01(saved.music, DEFAULT_SOUND.music),
    waves: clamp01(saved.waves, DEFAULT_SOUND.waves),
    effects: clamp01(saved.effects, DEFAULT_SOUND.effects),
  };
}

/** Storage can be missing or blocked (privacy modes); sound settings then last only for the page. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let settings = parseSoundSettings(read(SETTINGS_KEY), read(MUTE_KEY));

function save(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; the choice still holds for this page.
  }
}

export const soundSettings = (): SoundSettings => ({ ...settings });
export const isMuted = () => settings.muted;

export function setMuted(value: boolean): void {
  settings = { ...settings, muted: value };
  save();
  applyMix();
}

export function setVolume(channel: SoundChannel, value: number): void {
  settings = { ...settings, [channel]: clamp01(value, settings[channel]) };
  save();
  applyMix();
}

interface Mixer {
  ctx: AudioContext;
  master: GainNode;
  buses: Record<SoundChannel, GainNode>;
}
let mixer: Mixer | null = null;
let wanted = false;
let scheduler: ReturnType<typeof setInterval> | undefined;
let waves: AudioNode[] = [];

/** Perceived loudness grows roughly with the square of the slider. */
const level = (value: number) => value * value;

function applyMix(): void {
  if (!mixer) {
    if (!settings.muted && wanted) startSoundtrack();
    return;
  }
  const { ctx, master, buses } = mixer;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
  for (const { id } of SOUND_CHANNELS) buses[id].gain.setTargetAtTime(level(settings[id]), t, 0.05);
  if (settings.muted) {
    stopMusic();
    // Let the fade finish before freezing the clock.
    setTimeout(() => { if (settings.muted && ctx.state === 'running') void ctx.suspend(); }, 150);
  } else {
    if (ctx.state === 'suspended') void ctx.resume();
    if (wanted) startMusic(mixer);
  }
}

function mix(): Mixer | null {
  if (settings.muted || typeof AudioContext === 'undefined') return null;
  if (!mixer) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    master.connect(compressor).connect(ctx.destination);
    const bus = (value: number) => {
      const gain = ctx.createGain();
      gain.gain.value = level(value);
      gain.connect(master);
      return gain;
    };
    mixer = { ctx, master, buses: { music: bus(settings.music), waves: bus(settings.waves), effects: bus(settings.effects) } };
  }
  if (mixer.ctx.state === 'suspended') void mixer.ctx.resume();
  return mixer;
}

/** Starts the soundtrack and ocean waves; call from a user gesture. Safe to call repeatedly. */
export function startSoundtrack(): void {
  wanted = true;
  const m = mix();
  if (m) startMusic(m);
}

export function listenForSoundtrackStart(target: EventTarget, start: () => void): () => void {
  const events = ['pointerdown', 'pointerup', 'keydown'];
  const options = { capture: true };
  const onInput = (event: Event) => {
    const isMouse = (event as PointerEvent).pointerType === 'mouse';
    // Touch and pen grant browser activation on release, not press.
    if ((event.type === 'pointerdown' && !isMouse) || (event.type === 'pointerup' && isMouse)) return;
    if (navigator.userActivation?.isActive === false) return;
    start();
  };
  for (const event of events) target.addEventListener(event, onInput, options);
  return () => {
    for (const event of events) target.removeEventListener(event, onInput, options);
  };
}

function startMusic(m: Mixer): void {
  if (!waves.length) waves = startWaves(m);
  if (scheduler) return;
  let eighth = 0;
  let next = m.ctx.currentTime + 0.1;
  const total = SHANTY.length * 6;
  const tick = () => {
    while (next < m.ctx.currentTime + 0.5) {
      playEighth(m, eighth, next);
      eighth = (eighth + 1) % total;
      next += SHANTY_EIGHTH_SECONDS;
    }
  };
  tick();
  scheduler = setInterval(tick, 120);
}

function stopMusic(): void {
  clearInterval(scheduler);
  scheduler = undefined;
}

function playEighth(m: Mixer, index: number, t: number): void {
  const bar = SHANTY[Math.floor(index / 6)];
  const beat = index % 6;
  const bus = m.buses.music;
  let at = 0;
  for (const [note, length] of bar.melody) {
    if (at === beat && note !== null) whistle(m, bus, midiToHz(note), t, length * SHANTY_EIGHTH_SECONDS);
    at += length;
  }
  const [root, third, fifth] = bar.chord;
  if (beat === 0 || beat === 3) {
    pluck(m, bus, midiToHz((beat === 0 ? root : fifth) - 24), t, SHANTY_EIGHTH_SECONDS * 2);
    drum(m, bus, t, beat === 0 ? 0.35 : 0.2);
  } else {
    for (const note of [root, third, fifth]) squeeze(m, bus, midiToHz(note - 12), t, SHANTY_EIGHTH_SECONDS * 0.8);
  }
}

/** Tin-whistle lead: triangle with a soft vibrato and breathy attack. */
function whistle(m: Mixer, out: AudioNode, freq: number, t: number, duration: number) {
  const { ctx } = m;
  const osc = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const depth = ctx.createGain();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  vibrato.frequency.value = 5.5;
  depth.gain.value = freq * 0.006;
  vibrato.connect(depth).connect(osc.frequency);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
  gain.gain.setTargetAtTime(0.11, t + 0.05, 0.1);
  gain.gain.setTargetAtTime(0, t + duration * 0.85, 0.04);
  osc.connect(gain).connect(out);
  osc.start(t);
  vibrato.start(t);
  osc.stop(t + duration + 0.2);
  vibrato.stop(t + duration + 0.2);
}

/** Plucked bass for the "oom". */
function pluck(m: Mixer, out: AudioNode, freq: number, t: number, duration: number) {
  envelopeTone(m, out, freq, t, duration, 'sine', 0.28);
  envelopeTone(m, out, freq * 2, t, duration * 0.5, 'triangle', 0.05);
}

/** Accordion-like chord stab for the "pa-pa". */
function squeeze(m: Mixer, out: AudioNode, freq: number, t: number, duration: number) {
  const { ctx } = m;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  osc.detune.value = (Math.random() - 0.5) * 8;
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.025, t + 0.02);
  gain.gain.setTargetAtTime(0, t + duration * 0.7, 0.03);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.2);
}

/** Soft frame drum. */
function drum(m: Mixer, out: AudioNode, t: number, volume: number) {
  const { ctx } = m;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  gain.gain.setValueAtTime(volume * 0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.2);
}

function envelopeTone(m: Mixer, out: AudioNode, freq: number, t: number, duration: number, type: OscillatorType, volume: number) {
  const osc = m.ctx.createOscillator();
  const gain = m.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();
/** Two seconds of brown-ish noise, shared by waves, cannon smoke and splashes. */
function noise(ctx: AudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx);
  if (buffer) return buffer;
  buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

/** Two layers of filtered noise whose loudness and brightness swell slowly, like surf. */
function startWaves(m: Mixer): AudioNode[] {
  const { ctx } = m;
  const nodes: AudioNode[] = [];
  for (const [rate, cutoff, volume] of [[0.09, 420, 0.5], [0.13, 900, 0.25]] as const) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.6;
    const swell = ctx.createOscillator();
    swell.frequency.value = rate;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = volume * 0.4;
    swell.connect(swellDepth).connect(gain.gain);
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = cutoff * 0.5;
    swell.connect(sweepDepth).connect(filter.frequency);
    src.connect(filter).connect(gain).connect(m.buses.waves);
    src.start();
    swell.start();
    nodes.push(src, swell);
  }
  return nodes;
}

function effects(): { m: Mixer; out: AudioNode; now: number } | null {
  const m = mix();
  return m && { m, out: m.buses.effects, now: m.ctx.currentTime };
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'triangle', volume = 0.15) {
  const e = effects();
  if (e) envelopeTone(e.m, e.out, freq, e.now + start, duration, type, volume);
}

function burst(start: number, duration: number, filterType: BiquadFilterType, from: number, to: number, volume: number) {
  const e = effects();
  if (!e) return;
  const { ctx } = e.m;
  const t = e.now + start;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.playbackRate.value = filterType === 'highpass' ? 2 : 1;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(e.out);
  src.start(t, Math.random());
  src.stop(t + duration + 0.05);
}

function sweep(from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const e = effects();
  if (!e) return;
  const t = e.now + start;
  const osc = e.m.ctx.createOscillator();
  const gain = e.m.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(e.out);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function click(start: number, volume = 0.25) {
  const e = effects();
  if (!e) return;
  const { ctx } = e.m;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain).connect(e.out);
  src.start(e.now + start);
}

/** Metallic clinks of coins tumbling together. */
function jingle(count: number, start = 0, spread = 0.05) {
  for (let i = 0; i < count; i++) {
    const at = start + i * spread + Math.random() * 0.02;
    const freq = 2600 + Math.random() * 1600;
    tone(freq, at, 0.12, 'sine', 0.05);
    tone(freq * 1.51, at, 0.07, 'sine', 0.02);
  }
}

/** One cannon shot: a pitch-dropping thump under a burst of smoke. */
function boom(start: number, volume = 1) {
  sweep(130, 38, start, 0.5, 0.6 * volume);
  burst(start, 0.9, 'lowpass', 1800, 120, 0.9 * volume);
  burst(start, 0.08, 'highpass', 3000, 1500, 0.25 * volume);
}

function splash(start: number) {
  burst(start, 0.6, 'highpass', 900, 3000, 0.35);
  burst(start + 0.05, 0.5, 'lowpass', 600, 200, 0.3);
}

const fanfare = (notes: number[], step: number, start = 0, volume = 0.13) =>
  notes.forEach((f, i) => tone(f, start + i * step, 0.35, 'triangle', volume));

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
    fanfare([523, 659, 784, 1047], 0.09);
  },
  storm() {
    tone(110, 0, 0.5, 'sawtooth', 0.06);
    tone(82, 0.1, 0.6, 'sawtooth', 0.05);
  },
  win() {
    fanfare([523, 659, 784, 659, 784, 1047], 0.13, 0, 0.14);
  },
  /** A volley of cannon fire, splashes for sunk ships, then the outcome's call. */
  battle(rounds: number, sunk: number, outcome: 'victory' | 'defeat' | 'draw' | 'loss') {
    const shots = Math.min(6, Math.max(2, rounds * 2));
    for (let i = 0; i < shots; i++) boom(i * 0.38 + Math.random() * 0.06, i % 2 ? 0.7 : 1);
    const after = shots * 0.38;
    for (let i = 0; i < Math.min(sunk, 3); i++) splash(after + i * 0.25);
    const end = after + Math.min(sunk, 3) * 0.25 + 0.2;
    if (outcome === 'victory') fanfare([523, 659, 784, 1047], 0.11, end);
    else fanfare([392, 349, 311, 262], 0.16, end, 0.1);
  },
  /** A single broadside, e.g. pirates or monsters. */
  cannon() {
    boom(0);
    boom(0.3, 0.6);
  },
  /** Cash-register bell and coins: selling goods or ships. */
  sell() {
    tone(2093, 0, 0.6, 'sine', 0.08);
    tone(2637, 0.01, 0.5, 'sine', 0.05);
    jingle(6, 0.12);
  },
  /** Coins counted out onto the counter, then the crate thuds aboard. */
  buy() {
    jingle(4, 0, 0.09);
    sweep(180, 70, 0.4, 0.18, 0.35, 'triangle');
  },
  /** Native barter: hand drum knocks and a bright chime as goods change hands. */
  barter() {
    sweep(260, 120, 0, 0.12, 0.3, 'triangle');
    sweep(300, 140, 0.15, 0.12, 0.3, 'triangle');
    fanfare([784, 988, 1175], 0.08, 0.32, 0.1);
  },
  /** Cargo swung aboard or ashore. */
  cargo() {
    sweep(150, 60, 0, 0.15, 0.3, 'triangle');
    burst(0, 0.12, 'lowpass', 500, 150, 0.2);
  },
  /** Ship's bell, two strokes: a new ship joins the fleet. */
  bell() {
    for (const at of [0, 0.35]) {
      tone(880, at, 1.2, 'sine', 0.1);
      tone(2217, at, 0.6, 'sine', 0.04);
    }
  },
  splash() {
    splash(0);
  },
};
