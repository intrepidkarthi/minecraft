// audio.js — procedural WebAudio sound effects (no asset files, fully offline)
"use strict";

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }
  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _noise(dur, filterFreq, type, gain, decay = true, freqEnd) {
    const ctx = this._ensure();
    const len = (ctx.sampleRate * dur) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.value = filterFreq;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = gain;
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }
  _tone(freq, dur, type, gain, freqEnd) {
    const ctx = this._ensure();
    const o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  play(name, opt) {
    if (this.muted) return;
    try { this['_' + name] ? this['_' + name](opt) : this._generic(name, opt); } catch (e) { }
  }

  _generic() { }
  _step(mat) {
    const f = { grass: 900, sand: 1500, wood: 600, stone: 1100, gravel: 1300, snow: 1800, cloth: 800, glass: 1400 }[mat] || 1000;
    this._noise(0.07, f, 'lowpass', 0.10);
  }
  _dig(mat) {
    const f = { grass: 700, sand: 1100, wood: 500, stone: 900, gravel: 1000, snow: 1500, cloth: 700, glass: 1200 }[mat] || 800;
    this._noise(0.09, f + Math.random() * 200, 'lowpass', 0.16);
  }
  _break(mat) {
    if (mat === 'glass') { this._noise(0.25, 3500, 'highpass', 0.25); return; }
    const f = { grass: 600, sand: 900, wood: 450, stone: 800, gravel: 900, snow: 1300, cloth: 600 }[mat] || 700;
    this._noise(0.18, f, 'lowpass', 0.3, true, f * 0.4);
  }
  _place() { this._noise(0.1, 700, 'lowpass', 0.22); this._tone(160, 0.08, 'triangle', 0.08); }
  _hurt() { this._tone(220, 0.18, 'sawtooth', 0.18, 130); }
  _fall() { this._noise(0.2, 500, 'lowpass', 0.3); }
  _mobHurt() { this._tone(160, 0.2, 'sawtooth', 0.14, 90); }
  _animalHurt() { this._tone(420, 0.18, 'square', 0.10, 300); }
  _mobDeath() { this._tone(180, 0.45, 'sawtooth', 0.16, 50); }
  _pop() { this._tone(520, 0.07, 'sine', 0.18, 900); }
  _click() { this._tone(800, 0.035, 'square', 0.08); }
  _eat() { this._noise(0.09, 1200, 'bandpass', 0.18); }
  _burp() { this._tone(140, 0.25, 'sawtooth', 0.15, 80); }
  _explosion() { this._noise(1.1, 900, 'lowpass', 0.8, true, 60); this._tone(70, 0.7, 'sine', 0.4, 30); }
  _fuse() { this._noise(1.4, 4000, 'highpass', 0.12, false); }
  _bow() { this._tone(300, 0.12, 'triangle', 0.14, 600); this._noise(0.08, 2000, 'bandpass', 0.1); }
  _splash() { this._noise(0.35, 1400, 'bandpass', 0.25, true, 500); }
  _jump() { }
  _levelup() { const n = [392, 523, 659, 784]; n.forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'triangle', 0.12), i * 90)); }
  _craft() { this._noise(0.12, 800, 'lowpass', 0.18); this._tone(440, 0.1, 'triangle', 0.08); }
  _open() { this._noise(0.15, 600, 'lowpass', 0.18); }
  _furnace() { this._noise(0.3, 500, 'lowpass', 0.1); }
}
