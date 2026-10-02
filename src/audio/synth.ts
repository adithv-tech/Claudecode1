/**
 * Tiny procedural synth: renders short mono 16-bit WAVs into data URIs so the
 * game ships with zero binary audio assets. Each voice is a function of time.
 */
const RATE = 22050;

type Voice = (t: number, dur: number) => number;

function noiseGen(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

const sine = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);
const square = (f: number, t: number) => (sine(f, t) >= 0 ? 1 : -1);
const tri = (f: number, t: number) => (2 / Math.PI) * Math.asin(sine(f, t));
const decay = (t: number, k: number) => Math.exp(-t * k);

function render(dur: number, voice: Voice, gain = 0.5): string {
  const n = Math.floor(dur * RATE);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // 5ms fade in/out avoids clicks
    const edge = Math.min(1, t / 0.005, (dur - t) / 0.005);
    const sample = Math.max(-1, Math.min(1, voice(t, dur) * gain * edge));
    v.setInt16(44 + i * 2, sample * 32767, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const noise = noiseGen(7);

export const VOICES = {
  click: () => render(0.04, (t) => square(1400, t) * decay(t, 90), 0.25),
  draw: () => render(0.09, (t) => (noise() * 0.6 + sine(900 + t * 6000, t) * 0.4) * decay(t, 35), 0.35),
  play: () => render(0.14, (t) => square(380 + t * 4200, t) * decay(t, 18), 0.22),
  hit: () => render(0.22, (t) => (noise() * decay(t, 25) + sine(110 - t * 200, t) * decay(t, 12)) * 0.9, 0.6),
  heavyHit: () => render(0.38, (t) => noise() * decay(t, 10) * 0.7 + sine(70 - t * 60, t) * decay(t, 7), 0.75),
  block: () => render(0.22, (t) => (tri(620, t) + tri(930, t) * 0.6) * decay(t, 16), 0.35),
  shield: () => render(0.35, (t) => sine(220, t) * (0.6 + 0.4 * sine(18, t)) * decay(t, 6) + sine(440, t) * 0.3 * decay(t, 9), 0.4),
  poison: () => render(0.3, (t) => sine(300 + 120 * sine(22, t), t) * decay(t, 8), 0.35),
  stun: () => render(0.3, (t) => square(1200 - t * 3000, t) * decay(t, 9) * (sine(40, t) > 0 ? 1 : 0.4), 0.2),
  buff: () =>
    render(0.32, (t) => {
      const step = Math.min(3, Math.floor(t / 0.08));
      return tri([440, 554, 659, 880][step], t) * decay(t - step * 0.08, 10);
    }, 0.35),
  debuff: () => render(0.3, (t) => square(300 - t * 500, t) * decay(t, 8), 0.18),
  heal: () => render(0.4, (t) => (sine(523, t) + sine(784, t) * 0.5) * Math.sin(Math.PI * (t / 0.4)), 0.3),
  energy: () => render(0.2, (t) => sine(660 + t * 2400, t) * decay(t, 12), 0.3),
  death: () => render(0.6, (t) => (noise() * 0.5 + square(180 - t * 250, t) * 0.5) * decay(t, 5), 0.45),
  error: () => render(0.14, (t) => square(110, t) * decay(t, 14), 0.2),
  turn: () => render(0.35, (t) => (sine(784, t) * decay(t, 9) + sine(1175, t) * decay(t, 12) * 0.5), 0.3),
  victory: () =>
    render(1.0, (t) => {
      const notes = [523, 659, 784, 1047];
      const step = Math.min(3, Math.floor(t / 0.14));
      return (tri(notes[step], t) + sine(notes[step] * 2, t) * 0.3) * decay(t - step * 0.14, step === 3 ? 3 : 9);
    }, 0.4),
  defeat: () =>
    render(1.1, (t) => {
      const notes = [392, 330, 262, 196];
      const step = Math.min(3, Math.floor(t / 0.22));
      return tri(notes[step], t) * decay(t - step * 0.22, step === 3 ? 2.5 : 6);
    }, 0.4),
} as const;

export type SfxName = keyof typeof VOICES;
