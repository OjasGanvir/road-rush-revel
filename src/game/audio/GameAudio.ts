/**
 * Lightweight WebAudio-synthesized game sounds. No asset downloads — keeps
 * the game fully offline. All nodes are created lazily after a user gesture
 * so browsers allow audio playback.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;

  // Engine drone
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Drift screech (filtered noise)
  private noiseSrc: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Nitro whoosh
  private nitroGain: GainNode | null = null;

  private started = false;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Must be called from a user gesture the first time. */
  ensureStarted() {
    if (this.started) {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(ctx.destination);

      // Engine
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 900;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 60;
      this.engineSub = ctx.createOscillator();
      this.engineSub.type = "triangle";
      this.engineSub.frequency.value = 30;
      this.engineOsc.connect(this.engineFilter);
      this.engineSub.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineSub.start();

      // Drift noise
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseSrc = ctx.createBufferSource();
      this.noiseSrc.buffer = buffer;
      this.noiseSrc.loop = true;
      this.driftFilter = ctx.createBiquadFilter();
      this.driftFilter.type = "bandpass";
      this.driftFilter.frequency.value = 2400;
      this.driftFilter.Q.value = 0.8;
      this.driftGain = ctx.createGain();
      this.driftGain.gain.value = 0;
      this.noiseSrc.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.master);
      this.noiseSrc.start();

      this.started = true;
    } catch {
      /* audio unavailable */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  /** speedNorm 0..1, throttle boolean. */
  engine(speedNorm: number, throttle: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    const freq = 55 + speedNorm * 220;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    if (this.engineSub) this.engineSub.frequency.setTargetAtTime(freq * 0.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(500 + speedNorm * 1600, t, 0.1);
    const target = 0.05 + speedNorm * 0.12 + (throttle ? 0.05 : 0);
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
  }

  drift(active: boolean, intensity: number) {
    if (!this.ctx || !this.driftGain) return;
    const t = this.ctx.currentTime;
    this.driftGain.gain.setTargetAtTime(active ? 0.08 + intensity * 0.12 : 0, t, 0.05);
  }

  coin() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  stunt() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.42);
  }

  nitro(active: boolean) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    if (active && !this.nitroGain) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 1200;
      o.type = "sawtooth";
      o.frequency.value = 240;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setTargetAtTime(0.12, t, 0.05);
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start(t);
      this.nitroGain = g;
      (g as unknown as { _osc: OscillatorNode })._osc = o;
    } else if (!active && this.nitroGain) {
      const g = this.nitroGain;
      g.gain.setTargetAtTime(0.0001, t, 0.08);
      const osc = (g as unknown as { _osc: OscillatorNode })._osc;
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* noop */
        }
      }, 200);
      this.nitroGain = null;
    }
  }

  dispose() {
    try {
      this.engineOsc?.stop();
      this.engineSub?.stop();
      this.noiseSrc?.stop();
    } catch {
      /* noop */
    }
    try {
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.started = false;
  }
}
