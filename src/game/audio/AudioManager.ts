// WebAudio synthesized SFX — no asset files needed.
// Lightweight, procedural sound effects for game events.
// Supports 3 independent volume channels: SFX, music, ambient.

export type AudioChannel = "sfx" | "music" | "ambient";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  // per-channel gain nodes (SFX, music, ambient)
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  enabled = true;
  private volume = 0.35;
  // per-channel volume (0..1), multiplied with master
  private channelVolume: Record<AudioChannel, number> = {
    sfx: 1,
    music: 0.6,
    ambient: 0.5,
  };
  private bgGain: GainNode | null = null;
  private bgNodes: { osc: OscillatorNode; lfo: OscillatorNode } | null = null;
  // variant-specific ambient loop nodes (coffee/headphones)
  private variantGain: GainNode | null = null;
  private variantNodes: { osc: OscillatorNode; lfo: OscillatorNode } | null = null;
  private currentVariant: "normal" | "glasses" | "coffee" | "headphones" | "rage" = "normal";

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      // create channel gains
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.channelVolume.sfx;
      this.sfxGain.connect(this.masterGain);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.channelVolume.music;
      this.musicGain.connect(this.masterGain);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.channelVolume.ambient;
      this.ambientGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
  }

  getVolume() {
    return this.volume;
  }

  // per-channel volume control (0..1)
  setChannelVolume(channel: AudioChannel, v: number) {
    this.channelVolume[channel] = Math.max(0, Math.min(1, v));
    const gain = this.getGainForChannel(channel);
    if (gain) gain.gain.value = this.channelVolume[channel];
  }

  getChannelVolume(channel: AudioChannel): number {
    return this.channelVolume[channel];
  }

  private getGainForChannel(channel: AudioChannel): GainNode | null {
    if (channel === "sfx") return this.sfxGain;
    if (channel === "music") return this.musicGain;
    if (channel === "ambient") return this.ambientGain;
    return null;
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.5,
    freqEnd?: number,
    channel: AudioChannel = "sfx"
  ) {
    const ctx = this.ensure();
    const gain = this.getGainForChannel(channel);
    if (!ctx || !gain || !this.enabled) return;
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
    g.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4, filterFreq = 1000, channel: AudioChannel = "sfx") {
    const ctx = this.ensure();
    const gain = this.getGainForChannel(channel);
    if (!ctx || !gain || !this.enabled) return;
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
    g.connect(gain);
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

  // ===== Variant-specific one-shot SFX =====
  // glasses: bright shimmer when boss "flashes" reflection
  glassesGlare() {
    this.blip(1800, 0.18, "sine", 0.18, 2600);
    setTimeout(() => this.blip(2400, 0.1, "sine", 0.12), 90);
  }
  // coffee: short liquid slurp
  coffeeSip() {
    this.noise(0.18, 0.18, 500);
    this.blip(180, 0.18, "sine", 0.2, 90);
  }
  // headphones: muffled bass thump
  headphoneBeat() {
    this.blip(90, 0.12, "sine", 0.32, 50);
    this.noise(0.05, 0.1, 200);
  }
  // rage: aggressive roar (low growl + noise)
  rageRoar() {
    this.blip(110, 0.5, "sawtooth", 0.45, 70);
    this.noise(0.4, 0.3, 350);
    setTimeout(() => this.blip(85, 0.3, "sawtooth", 0.35, 55), 200);
  }
  // tutorial / banner popup
  uiPopup() {
    this.blip(660, 0.08, "sine", 0.25);
    setTimeout(() => this.blip(990, 0.12, "sine", 0.25), 60);
  }
  // achievement-style chime for tutorial close
  uiDismiss() {
    this.blip(440, 0.06, "sine", 0.2);
    setTimeout(() => this.blip(330, 0.08, "sine", 0.2), 50);
  }

  // ===== Variant ambient loop (continuous background characterization) =====
  // Call setVariantAmbient when entering a level; pass "normal" to stop.
  setVariantAmbient(variant: "normal" | "glasses" | "coffee" | "headphones" | "rage") {
    const ctx = this.ensure();
    if (!ctx || !this.masterGain) return;
    if (this.currentVariant === variant && this.variantNodes) return;
    // stop previous
    this.stopVariantAmbient();
    this.currentVariant = variant;
    if (variant === "normal") return;

    const vg = ctx.createGain();
    vg.gain.value = 0;
    vg.connect(this.ambientGain);
    this.variantGain = vg;

    if (variant === "coffee") {
      // gentle bubbling: low-freq oscillator with slow LFO
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 80;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 15;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(vg);
      osc.start();
      lfo.start();
      this.variantNodes = { osc, lfo };
      vg.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.6);
    } else if (variant === "headphones") {
      // muffled rhythmic beat: ~2Hz pulse on low sine
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 65;
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 2; // 120 BPM
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(vg.gain);
      osc.connect(vg);
      osc.start();
      lfo.start();
      this.variantNodes = { osc, lfo };
      vg.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.6);
    } else if (variant === "rage") {
      // ominous low rumble
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(vg);
      osc.start();
      lfo.start();
      this.variantNodes = { osc, lfo };
      vg.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.6);
    } else if (variant === "glasses") {
      // very subtle high air (no continuous tone, but a faint breath)
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 220;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(vg);
      osc.start();
      lfo.start();
      this.variantNodes = { osc, lfo };
      vg.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.6);
    }
  }

  stopVariantAmbient() {
    if (this.variantNodes) {
      try {
        this.variantNodes.osc.stop();
        this.variantNodes.lfo.stop();
      } catch {
        /* noop */
      }
      this.variantNodes = null;
    }
    if (this.variantGain) {
      try {
        this.variantGain.disconnect();
      } catch {
        /* noop */
      }
      this.variantGain = null;
    }
  }

  startBgMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.musicGain || this.bgNodes) return;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.06;
    bgGain.connect(this.musicGain);
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
    // Use setTargetAtTime for smoother, more browser-compatible transitions
    // (linearRampToValueAtTime can cause artifacts when called rapidly)
    const t = this.ctx.currentTime;
    this.bgNodes.osc.frequency.setTargetAtTime(target, t, 0.3);
    this.bgNodes.lfo.frequency.setTargetAtTime(lfoTarget, t, 0.3);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.masterGain) this.masterGain.gain.value = v ? this.volume : 0;
  }
}

// singleton
export const audio = new AudioManager();
