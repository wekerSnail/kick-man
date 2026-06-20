// WebAudio synthesized SFX — no asset files needed.
// Lightweight, procedural sound effects for game events.

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  enabled = true;
  private bgGain: GainNode | null = null;
  private bgNodes: { osc: OscillatorNode; lfo: OscillatorNode } | null = null;

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.5,
    freqEnd?: number
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        ctx.currentTime + dur
      );
    }
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4, filterFreq = 1000) {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain || !this.enabled) return;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  // ===== SFX =====
  kickHit() {
    this.blip(220, 0.12, "square", 0.5, 80);
    this.noise(0.08, 0.25, 600);
  }
  // combo hit — pitch rises with combo count
  kickHitCombo(combo: number) {
    const baseFreq = 220 + Math.min(combo, 20) * 30; // rises up to 20 combos
    this.blip(baseFreq, 0.1, "square", 0.5, baseFreq * 0.5);
    this.noise(0.06, 0.2, 700);
    if (combo >= 5) {
      // add a high chime for satisfying feedback
      setTimeout(() => this.blip(baseFreq * 2, 0.08, "sine", 0.3), 40);
    }
  }
  kickMiss() {
    this.blip(180, 0.08, "sine", 0.2, 120);
  }
  detected() {
    this.blip(440, 0.1, "sawtooth", 0.5, 880);
    setTimeout(() => this.blip(660, 0.15, "sawtooth", 0.5, 220), 90);
  }
  pickup() {
    this.blip(660, 0.08, "sine", 0.4);
    setTimeout(() => this.blip(880, 0.1, "sine", 0.4), 70);
  }
  throwCharge() {
    this.blip(300, 0.04, "sine", 0.15);
  }
  throwRelease() {
    this.blip(500, 0.1, "square", 0.4, 200);
  }
  stun() {
    this.blip(800, 0.05, "sine", 0.3);
    setTimeout(() => this.blip(600, 0.05, "sine", 0.3), 50);
    setTimeout(() => this.blip(400, 0.05, "sine", 0.3), 100);
  }
  meetingStart() {
    this.blip(330, 0.2, "triangle", 0.4, 440);
  }
  patrolStart() {
    this.blip(200, 0.15, "sawtooth", 0.4, 400);
    this.noise(0.1, 0.2, 800);
  }
  patrolEnd() {
    this.blip(400, 0.15, "sawtooth", 0.4, 200);
  }
  block() {
    this.noise(0.12, 0.4, 1200);
    this.blip(150, 0.1, "square", 0.3, 80);
  }
  levelComplete() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.18, "sine", 0.4), i * 120)
    );
  }
  gameOver() {
    [440, 349, 262, 196].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.3, "sawtooth", 0.4), i * 180)
    );
  }
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.25, "triangle", 0.4), i * 140)
    );
  }
  // FPS mode
  laserShot() {
    this.blip(1200, 0.06, "sawtooth", 0.3, 400);
  }
  rocketShot() {
    this.noise(0.3, 0.4, 600);
    this.blip(120, 0.25, "sawtooth", 0.4, 60);
  }
  grenadeThrow() {
    this.blip(200, 0.1, "sine", 0.3);
  }
  explosion() {
    this.noise(0.5, 0.7, 400);
    this.blip(80, 0.4, "sawtooth", 0.5, 30);
  }
  phone() {
    this.blip(880, 0.08, "sine", 0.3);
    setTimeout(() => this.blip(660, 0.08, "sine", 0.3), 100);
  }

  startBgMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain || this.bgNodes) return;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.06;
    bgGain.connect(this.masterGain);
    this.bgGain = bgGain;
    // ambient pad
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 110;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(bgGain);
    osc.start();
    lfo.start();
    this.bgNodes = { osc, lfo };
  }

  stopBgMusic() {
    if (this.bgNodes) {
      try {
        this.bgNodes.osc.stop();
        this.bgNodes.lfo.stop();
      } catch {
        /* noop */
      }
      this.bgNodes = null;
    }
    if (this.bgGain) {
      this.bgGain.disconnect();
      this.bgGain = null;
    }
  }

  // Toggle tense music (higher pitch + faster LFO) when boss is alert
  setTense(tense: boolean) {
    if (!this.bgNodes || !this.ctx) return;
    const target = tense ? 165 : 110; // higher pitch when tense
    const lfoTarget = tense ? 0.6 : 0.2; // faster wobble when tense
    this.bgNodes.osc.frequency.linearRampToValueAtTime(target, this.ctx.currentTime + 0.5);
    this.bgNodes.lfo.frequency.linearRampToValueAtTime(lfoTarget, this.ctx.currentTime + 0.5);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.masterGain) this.masterGain.gain.value = v ? 0.35 : 0;
  }
}

// singleton
export const audio = new AudioManager();
