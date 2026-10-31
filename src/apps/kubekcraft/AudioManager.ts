/**
 * KubekCraft — Synthesized Web Audio API Sound Engine
 * Generates original procedural sound effects for mining, placing, footsteps,
 * pickups, crafting, combat, UI clicks, and calm ambient voxel chords.
 */

import type { SoundCategory } from './types';

export class KubekCraftAudioManager {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.75;
  private sfxVolume = 0.85;
  private musicVolume = 0.45;
  private muted = false;
  private ambientTimer: ReturnType<typeof setInterval> | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public configure(opts: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    muted: boolean;
  }) {
    this.masterVolume = opts.masterVolume;
    this.sfxVolume = opts.sfxVolume;
    this.musicVolume = opts.musicVolume;
    this.muted = opts.muted;
  }

  private getEffectiveSfxGain(base = 0.25): number {
    if (this.muted) return 0;
    return Math.max(0, Math.min(1, base * this.masterVolume * this.sfxVolume));
  }

  public playBlockSound(category: SoundCategory = 'STONE', action: 'BREAK' | 'PLACE' | 'STEP') {
    const ctx = this.ensureContext();
    const gainVal = this.getEffectiveSfxGain(action === 'STEP' ? 0.08 : 0.22);
    if (!ctx || gainVal <= 0.001) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreqMap: Record<SoundCategory, number> = {
      GRASS: 165,
      DIRT: 145,
      STONE: 210,
      WOOD: 185,
      SAND: 260,
      GLASS: 580,
      WATER: 290,
      CRYSTAL: 680,
    };

    const baseFreq = baseFreqMap[category] ?? 200;
    const jitter = 0.92 + Math.random() * 0.16;

    osc.type =
      category === 'GLASS' || category === 'CRYSTAL'
        ? 'sine'
        : category === 'STONE'
          ? 'triangle'
          : 'square';

    const startFreq =
      action === 'PLACE' ? baseFreq * 0.85 * jitter : baseFreq * 1.15 * jitter;
    const endFreq =
      action === 'PLACE' ? baseFreq * 1.2 * jitter : baseFreq * 0.65 * jitter;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + 0.09);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playPickupPop() {
    const ctx = this.ensureContext();
    const gainVal = this.getEffectiveSfxGain(0.2);
    if (!ctx || gainVal <= 0.001) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.075);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCraftChime() {
    const ctx = this.ensureContext();
    const gainVal = this.getEffectiveSfxGain(0.22);
    if (!ctx || gainVal <= 0.001) return;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    });
  }

  public playDamageHit() {
    const ctx = this.ensureContext();
    const gainVal = this.getEffectiveSfxGain(0.28);
    if (!ctx || gainVal <= 0.001) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    const gainVal = this.getEffectiveSfxGain(0.12);
    if (!ctx || gainVal <= 0.001) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public startAmbientLoop() {
    if (this.ambientTimer) return;
    const chordPool = [
      [261.63, 329.63, 392.0],
      [293.66, 369.99, 440.0],
      [220.0, 277.18, 329.63],
      [196.0, 246.94, 392.0],
    ];
    this.ambientTimer = setInterval(() => {
      if (this.muted || this.musicVolume <= 0.01) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const chord = chordPool[Math.floor(Math.random() * chordPool.length)]!;
      const note = chord[Math.floor(Math.random() * chord.length)]!;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const maxG = Math.max(0, Math.min(0.08, 0.06 * this.masterVolume * this.musicVolume));
      if (maxG <= 0.001) return;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(maxG, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 3.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 3.5);
    }, 6500);
  }

  public stopAll() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
