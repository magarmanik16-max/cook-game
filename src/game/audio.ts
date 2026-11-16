import type { SoundCue } from './types';

class KitchenAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private sizzleGain: GainNode | null = null;
  private sizzleActive = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
    if (next) {
      this.setSizzling(false);
    }
    if (next && this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    } else if (!next && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (!this.muted && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public silence(): void {
    this.setSizzling(false);
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  private ensureSizzleLoop(): void {
    if (!this.ctx || this.sizzleGain) return;
    const bufferLen = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) {
      // Soft crackly sizzle texture
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.94 ? 1.0 : 0.35);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3400;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.sizzleGain = gain;
  }

  public setSizzling(active: boolean): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') {
      if (this.sizzleGain && this.ctx) {
        this.sizzleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
      this.sizzleActive = false;
      return;
    }

    if (active === this.sizzleActive) return;
    this.sizzleActive = active;
    if (active) this.ensureSizzleLoop();
    if (this.sizzleGain) {
      this.sizzleGain.gain.setTargetAtTime(
        active ? 0.022 : 0.0001,
        this.ctx.currentTime,
        0.08,
      );
    }
  }

  public play(cue: SoundCue, combo = 1): void {
    if (this.muted || typeof window === 'undefined') return;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    switch (cue) {
      case 'footstep':
        this.tone(110 * jitter, 72, 0.035, 'sine', 0.03, now);
        break;
      case 'pickup':
        this.tone(440 * jitter, 620 * jitter, 0.08, 'triangle', 0.11, now);
        break;
      case 'place':
        this.tone(330 * jitter, 250 * jitter, 0.07, 'sine', 0.1, now);
        break;
      case 'chop':
        this.noiseBurst(0.045, 1450 * jitter, 0.14, now);
        this.tone(195 * jitter, 98, 0.055, 'triangle', 0.14, now);
        break;
      case 'chop_done':
        this.tone(523.25, 783.99, 0.11, 'triangle', 0.14, now);
        this.tone(783.99, 1046.5, 0.12, 'sine', 0.1, now + 0.05);
        break;
      case 'sear_start':
        this.noiseBurst(0.24, 2400, 0.1, now);
        this.tone(240, 340, 0.09, 'sine', 0.08, now);
        break;
      case 'perfect_ready':
        this.tone(659.25, 880, 0.13, 'sine', 0.13, now);
        this.tone(987.77, 1318.5, 0.18, 'triangle', 0.1, now + 0.06);
        break;
      case 'perfect_grab':
        this.tone(587.33, 880, 0.12, 'triangle', 0.14, now);
        this.tone(880, 1174.66, 0.16, 'sine', 0.12, now + 0.06);
        break;
      case 'warning_tick':
      case 'skillet_alert':
        this.tone(880, 660, 0.08, 'triangle', 0.08, now);
        this.tone(980, 740, 0.08, 'triangle', 0.07, now + 0.1);
        break;
      case 'alarm_urgent':
        // Double kitchen timer ring for expiring order!
        this.tone(987.77, 987.77, 0.08, 'sine', 0.11, now);
        this.tone(1318.51, 1318.51, 0.1, 'sine', 0.11, now + 0.11);
        break;
      case 'burnt':
        this.noiseBurst(0.28, 700, 0.14, now);
        this.tone(180, 90, 0.25, 'sawtooth', 0.1, now);
        break;
      case 'serve': {
        const step = Math.min(6, Math.max(0, combo - 1));
        const root = 784 * Math.pow(1.06, step);
        this.tone(root, root * 1.005, 0.36, 'sine', 0.17, now);
        this.tone(root * 2.0, root * 2.01, 0.24, 'triangle', 0.09, now);
        this.tone(root * 1.25, root * 1.5, 0.22, 'sine', 0.11, now + 0.09);
        break;
      }
      case 'coin':
        this.tone(1318.5, 1567.98, 0.09, 'sine', 0.09, now + 0.12);
        this.tone(1567.98, 2093.0, 0.14, 'sine', 0.08, now + 0.2);
        break;
      case 'dash':
        this.noiseBurst(0.11, 950, 0.09, now);
        this.tone(280, 140, 0.1, 'sine', 0.08, now);
        break;
      case 'trash':
        this.tone(210, 130, 0.12, 'triangle', 0.11, now);
        break;
      case 'error':
        this.tone(185, 145, 0.13, 'sawtooth', 0.08, now);
        break;
      case 'ticket_new':
        this.tone(523.25, 659.25, 0.09, 'sine', 0.08, now);
        break;
      case 'vip_arrive':
        this.tone(587.33, 880, 0.12, 'sine', 0.12, now);
        this.tone(880, 1174.66, 0.16, 'triangle', 0.1, now + 0.08);
        break;
      case 'ticket_expired':
        this.tone(330, 196, 0.28, 'sawtooth', 0.1, now);
        break;
      case 'upgrade':
        this.tone(523.25, 659.25, 0.1, 'triangle', 0.12, now);
        this.tone(659.25, 783.99, 0.12, 'triangle', 0.12, now + 0.08);
        this.tone(783.99, 1046.5, 0.2, 'sine', 0.14, now + 0.16);
        break;
      case 'achievement':
        this.tone(659.25, 659.25, 0.1, 'sine', 0.12, now);
        this.tone(783.99, 783.99, 0.1, 'sine', 0.12, now + 0.09);
        this.tone(1046.5, 1046.5, 0.28, 'triangle', 0.15, now + 0.18);
        break;
      case 'victory':
        this.tone(523.25, 523.25, 0.14, 'triangle', 0.15, now);
        this.tone(659.25, 659.25, 0.14, 'triangle', 0.15, now + 0.11);
        this.tone(783.99, 783.99, 0.16, 'triangle', 0.16, now + 0.22);
        this.tone(1046.5, 1046.5, 0.4, 'sine', 0.18, now + 0.34);
        break;
      case 'defeat':
        this.tone(392, 349.23, 0.18, 'triangle', 0.14, now);
        this.tone(349.23, 293.66, 0.22, 'triangle', 0.14, now + 0.18);
        this.tone(261.63, 196, 0.38, 'sine', 0.15, now + 0.36);
        break;
    }
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private noiseBurst(duration: number, filterFreq: number, volume: number, startTime: number): void {
    if (!this.ctx) return;
    const sampleCount = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(1.4, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(startTime);
  }
}

export const kitchenAudio = new KitchenAudioEngine();
