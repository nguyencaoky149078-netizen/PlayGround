/* Tiny procedural sound engine. No external assets. */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.started = false;
    this.nextPulse = 0;
    this.nextTick = 0;
    this.drone = [];
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.68;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.38;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // noise buffer reused for impacts and wind
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.startAmbient();
    this.started = true;
  }

  startAmbient() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low, breathing city drone.
    for (const [freq, gain, detune] of [[55, 0.055, 0], [82.41, 0.032, 4], [110, 0.018, -5]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      filter.Q.value = 2;
      const g = ctx.createGain();
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06 + Math.random() * 0.08;
      lfoGain.gain.value = gain * 0.55;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      osc.connect(filter).connect(g).connect(this.musicGain);
      osc.start();
      this.drone.push({ osc, g, lfo });
    }

    // Wind / distant traffic hiss.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;
    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.value = 0.08;
    windLfoGain.gain.value = 0.02;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    windLfo.start();
    wind.connect(windFilter).connect(windGain).connect(this.musicGain);
    wind.start();
    this.drone.push({ osc: wind, g: windGain, lfo: windLfo });

    // A distant, lonely bell.
    this.bell(now + 0.4, 146.83, 0.09, 5.5);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.68, this.ctx.currentTime, 0.08);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  envGain(level, attack, decay, time = this.now()) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    return g;
  }

  tone({ freq = 220, end = freq, type = 'sine', dur = 0.25, gain = 0.15, delay = 0, filter = 0, q = 1 }) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + dur);
    const g = this.envGain(gain, 0.005, dur, t);
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      osc.connect(f).connect(g).connect(this.sfxGain);
    } else {
      osc.connect(g).connect(this.sfxGain);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.08, freq = 900, endFreq = freq, type = 'bandpass', q = 0.8, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    f.Q.value = q;
    const g = this.envGain(gain, 0.004, dur, t);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  bell(time, freq = 220, gain = 0.06, dur = 4) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.35;
    osc.connect(g).connect(this.musicGain);
    osc2.connect(g2).connect(g);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + dur);
    osc2.stop(time + dur);
  }

  whoosh(pitch = 1) {
    this.noise({ dur: 0.16, gain: 0.1, freq: 400 * pitch, endFreq: 2400 * pitch, type: 'bandpass', q: 1.4 });
  }

  hit(heavy = false) {
    this.tone({ freq: heavy ? 160 : 210, end: heavy ? 42 : 66, type: 'sine', dur: heavy ? 0.42 : 0.2, gain: heavy ? 0.36 : 0.22 });
    this.noise({ dur: heavy ? 0.22 : 0.1, gain: heavy ? 0.16 : 0.09, freq: 1400, endFreq: 200, type: 'lowpass', q: 0.8 });
    if (heavy) this.tone({ freq: 90, end: 32, type: 'triangle', dur: 0.5, gain: 0.25, delay: 0.02 });
  }

  blackFlash() {
    if (!this.ctx || this.muted) return;
    this.tone({ freq: 68, end: 23, type: 'sine', dur: 1.8, gain: 0.55 });
    this.tone({ freq: 320, end: 38, type: 'sawtooth', dur: 0.7, gain: 0.16, filter: 880 });
    this.noise({ dur: 0.9, gain: 0.3, freq: 5000, endFreq: 90, type: 'lowpass', q: 0.7 });
    this.noise({ dur: 0.16, gain: 0.34, freq: 6000, endFreq: 1800, type: 'bandpass', q: 0.5 });
    this.bell(this.now() + 0.03, 73.42, 0.16, 5.5);
  }

  hurt() {
    this.tone({ freq: 120, end: 48, type: 'triangle', dur: 0.35, gain: 0.28 });
    this.noise({ dur: 0.16, gain: 0.1, freq: 500, endFreq: 120, type: 'lowpass' });
  }

  enemyDie() {
    this.noise({ dur: 0.5, gain: 0.12, freq: 1800, endFreq: 120, type: 'bandpass', q: 1.1 });
    this.tone({ freq: 140, end: 35, type: 'sawtooth', dur: 0.45, gain: 0.1, filter: 500 });
  }

  waveStart() {
    this.bell(this.now(), 110, 0.18, 6);
    this.tone({ freq: 55, end: 55, type: 'triangle', dur: 2.2, gain: 0.2 });
    this.noise({ dur: 1.2, gain: 0.12, freq: 300, endFreq: 90, type: 'lowpass' });
  }

  victory() {
    if (!this.ctx || this.muted) return;
    [130.81, 164.81, 196, 261.63].forEach((f, i) => {
      this.bell(this.now() + i * 0.45, f, 0.12, 5);
    });
  }

  gameOver() {
    if (!this.ctx || this.muted) return;
    [110, 98, 82.41, 55].forEach((f, i) => {
      this.bell(this.now() + i * 0.42, f, 0.13, 4);
    });
  }

  dash() {
    this.noise({ dur: 0.2, gain: 0.1, freq: 300, endFreq: 1200, type: 'bandpass', q: 1.8 });
  }

  update(dt) {
    if (!this.ctx || !this.started) return;
    const t = this.now();
    if (t > this.nextPulse) {
      this.nextPulse = t + 2.35;
      // deep war drum
      this.tone({ freq: 82, end: 44, type: 'sine', dur: 0.65, gain: 0.12 });
      this.noise({ dur: 0.18, gain: 0.045, freq: 240, endFreq: 80, type: 'lowpass' });
    }
    if (t > this.nextTick) {
      this.nextTick = t + 1.1;
      this.noise({ dur: 0.06, gain: 0.012, freq: 3200, endFreq: 2400, type: 'bandpass', q: 2.5 });
    }
  }
}
