// Solmar Bay — procedural WebAudio: engine hum, sirens, gunshots, pickups.
// Everything is synthesised; no audio files, no network.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenTimer = 0;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: square wave, toggled high/low in update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  noiseBuffer(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  gunshot() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.14);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  crash() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  pickup() { this.blip(880, 0.1, 'sine', 0.3); this.blip(1320, 0.14, 'sine', 0.3, 0.09); }
  click() { this.blip(660, 0.05, 'square', 0.12); }
  sting() {
    this.blip(523, 0.12, 'triangle', 0.25);
    this.blip(659, 0.12, 'triangle', 0.25, 0.11);
    this.blip(784, 0.2, 'triangle', 0.3, 0.22);
  }
  update(dt, driving, speed01, sirenOn) {
    if (!this.ctx) return;
    if (this.engineGain) {
      const target = driving ? 0.05 + speed01 * 0.09 : 0.0;
      this.engineGain.gain.value += (target - this.engineGain.gain.value) * Math.min(1, dt * 6);
      this.engineOsc.frequency.value = 55 + speed01 * 165;
      this.engineFilter.frequency.value = 280 + speed01 * 900;
    }
    if (this.sirenGain) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenHigh = !this.sirenHigh;
        this.sirenTimer = 0.42;
        this.sirenOsc.frequency.value = this.sirenHigh ? 960 : 700;
      }
      const target = sirenOn && !this.muted ? 0.045 : 0;
      this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 4);
    }
  }
}
