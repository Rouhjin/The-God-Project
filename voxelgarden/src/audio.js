// All game audio, synthesized. Master gain -> lowpass (underwater muffle) -> out.
// The context starts on the first user gesture.

const FAMILY_FREQ = {
  stone: 200, dirt: 150, sand: 140, wood: 175, leaves: 320,
  glass: 520, snow: 170, metal: 260, water: 220, cloth: 240,
};

export function blockFamily(name) {
  if (/stone|cobble|ore|bedrock|furnace/.test(name)) return 'stone';
  if (/dirt|grass$/.test(name)) return 'dirt';
  if (/sand|cactus/.test(name)) return 'sand';
  if (/log|plank|craft|lantern/.test(name)) return 'wood';
  if (/leaves/.test(name)) return 'leaves';
  if (/glass/.test(name)) return 'glass';
  if (/snow/.test(name)) return 'snow';
  return 'stone';
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.cricketTimer = 0;
    this.muted = false;
  }

  ensure() {
    if (this.started) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.lowpass = this.ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.master.connect(this.lowpass).connect(this.ctx.destination);

    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // ambience: looped wind pad
    this.windSrc = this.ctx.createBufferSource();
    this.windSrc.buffer = this.noiseBuf;
    this.windSrc.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 320;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.windSrc.start();

    this.started = true;
  }

  setUnderwater(u) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setTargetAtTime(u ? 620 : 20000, t, 0.08);
  }

  tone(freq, dur, { type = 'square', gain = 0.12, slideTo = null, attack = 0.004, delay = 0 } = {}) {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, freq, { gain = 0.18, q = 0.9, type = 'bandpass', attack = 0.003, delay = 0, slideTo = null } = {}) {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ---- game events ----
  place(family) {
    const f = FAMILY_FREQ[family] || 200;
    this.tone(f * 1.6, 0.09, { type: 'square', gain: 0.08 });
  }
  breakBlock(family) {
    const f = FAMILY_FREQ[family] || 200;
    this.noise(0.16, f * 4.5, { gain: 0.22, q: 0.7, slideTo: f * 1.6 });
    this.tone(f * 0.9, 0.1, { type: 'triangle', gain: 0.07 });
  }
  breakTick(family) {
    const f = FAMILY_FREQ[family] || 200;
    this.noise(0.045, f * 5.5, { gain: 0.07, q: 1.4 });
  }
  footstep(family) {
    const f = FAMILY_FREQ[family] || 180;
    this.noise(0.05, f * (3.4 + Math.random() * 0.7), { gain: 0.055, q: 0.8 });
  }
  hurt() {
    this.tone(520, 0.22, { type: 'sawtooth', gain: 0.11, slideTo: 160 });
  }
  pickup() {
    this.tone(660, 0.07, { type: 'sine', gain: 0.1 });
    this.tone(990, 0.09, { type: 'sine', gain: 0.1, delay: 0.07 });
  }
  thump() {
    this.tone(95, 0.16, { type: 'sine', gain: 0.22, slideTo: 55 });
  }
  attackSwish() {
    this.noise(0.09, 1200, { gain: 0.05, q: 0.5, slideTo: 500 });
  }
  splash() {
    this.noise(0.3, 900, { gain: 0.2, q: 0.4, slideTo: 300 });
  }
  craft() {
    this.tone(240, 0.06, { type: 'square', gain: 0.08 });
    this.tone(320, 0.08, { type: 'square', gain: 0.08, delay: 0.06 });
  }
  smeltPop() {
    this.tone(180, 0.1, { type: 'triangle', gain: 0.09, slideTo: 320 });
  }
  click() {
    this.tone(880, 0.03, { type: 'square', gain: 0.045 });
  }
  poof() {
    this.noise(0.35, 500, { gain: 0.12, q: 0.5, slideTo: 120 });
  }
  death() {
    this.tone(330, 0.5, { type: 'sawtooth', gain: 0.12, slideTo: 60 });
  }

  // ---- ambience ----
  update(dt, { nightness = 0, underwater = false } = {}) {
    if (!this.started) return;
    const wind = underwater ? 0.008 : 0.028 * (1 - nightness * 0.5);
    this.windGain.gain.setTargetAtTime(wind, this.ctx.currentTime, 0.5);

    // crickets at night
    if (nightness > 0.6 && !underwater) {
      this.cricketTimer -= dt;
      if (this.cricketTimer <= 0) {
        this.cricketTimer = 1.2 + Math.random() * 2.4;
        const base = 3600 + Math.random() * 700;
        for (let i = 0; i < 3 + (Math.random() * 2 | 0); i++) {
          this.tone(base, 0.035, { type: 'sine', gain: 0.022, delay: i * 0.07 });
        }
      }
    }
  }
}
