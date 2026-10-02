import { Howl, Howler } from 'howler';
import { VOICES, type SfxName } from './synth';

const MUTE_KEY = 'overclock.muted';
const cache = new Map<SfxName, Howl>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();
Howler.mute(muted);
Howler.volume(0.7);

function howl(name: SfxName): Howl {
  let h = cache.get(name);
  if (!h) {
    h = new Howl({ src: [VOICES[name]()], format: ['wav'] });
    cache.set(name, h);
  }
  return h;
}

/** Plays a synthesized effect. `rate` adds pitch variation so repeated hits don't sound robotic. */
export function sfx(name: SfxName, rate = 1) {
  if (muted) return;
  const h = howl(name);
  const id = h.play();
  if (rate !== 1) h.rate(rate, id);
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  Howler.mute(value);
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // storage unavailable (private mode); mute still applies for this session
  }
}
