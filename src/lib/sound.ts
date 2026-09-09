// ALMOST CHOSEN — Sound Design System (Web Audio, no external assets).
//
// One designed sequence per event, not scattered beeps. Signal chain:
//   sources → per-cue gain → [dry + reverb send] → busGain → compressor/limiter
//           → master (volume) → destination
//
// Loudness hierarchy (relative, before master volume):
//   CHOSEN 1.00 · ALMOST CHOSEN 0.72 · REGISTERED 0.58 · NOT THIS TIME 0.55
//   PROCESSING 0.42 (rising) · INPUT SUBMITTED 0.35
//
// Audio only unlocks on the first user gesture (submit). Processing is a
// single continuous sequence covering the full four-stage animation; it is
// tracked so it can be crossfaded/stopped cleanly before any result cue and
// never overlaps or double-triggers.

import type { Outcome } from './engine';

type OscType = OscillatorType;

interface LevelState {
  master: number;
  muted: boolean;
  processing: number; // PROCESSING LEVEL
  chosen: number; // CHOSEN LEVEL
  otherResults: number; // OTHER RESULTS LEVEL (almost/registered/not-this-time)
  reverb: number; // REVERB AMOUNT 0..1
}

// Relative loudness targets (multiplied by their level control + master).
const REL = {
  CHOSEN: 1.0,
  ALMOST: 0.72,
  REGISTERED: 0.58,
  NOT_THIS_TIME: 0.55,
  PROCESSING: 0.42,
  SUBMIT: 0.35,
} as const;

// Real processing-animation timing (must track ProcessingSequence STAGE_MS
// [1600, 2200, 1800, 2200] + 500ms tail before the reveal). We build a
// continuous ~7.8s bed and let the tail breathe into the result.
const STAGE_S = [1.6, 2.2, 1.8, 2.2] as const;
const PROCESSING_TOTAL_S = STAGE_S[0] + STAGE_S[1] + STAGE_S[2] + STAGE_S[3]; // 7.8

const LEVELS_KEY = 'almost-chosen/levels/v2';
const LEGACY_VOL_KEY = 'almost-chosen/volume/v1';

class SoundEngine {
  private ctx: AudioContext | null = null;

  // Graph nodes.
  private master: GainNode | null = null; // master volume (post limiter)
  private limiter: DynamicsCompressorNode | null = null;
  private bus: GainNode | null = null; // dry+wet sum feeding the limiter
  private reverbSend: GainNode | null = null; // wet send level (REVERB AMOUNT)
  private convolver: ConvolverNode | null = null;

  private lv: LevelState = {
    master: 0.7,
    muted: false,
    processing: 1.0,
    chosen: 1.0,
    otherResults: 1.0,
    reverb: 0.28,
  };

  // Active-processing bookkeeping so we never overlap/duplicate the bed.
  private procNodes: AudioScheduledSourceNode[] = [];
  private procGain: GainNode | null = null;
  private procToken = 0; // increments on every start/stop to invalidate stale schedules
  private procEndsAt = 0;

  // Guard so a single logical result never double-fires.
  private lastResultToken = 0;

  constructor() {
    this.loadLevels();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  private loadLevels(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LEVELS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<LevelState>;
        this.lv = { ...this.lv, ...p };
        return;
      }
      // migrate legacy master-only key
      const legacy = localStorage.getItem(LEGACY_VOL_KEY);
      if (legacy) {
        const p = JSON.parse(legacy) as { volume?: number; muted?: boolean };
        if (typeof p.volume === 'number') this.lv.master = p.volume;
        if (typeof p.muted === 'boolean') this.lv.muted = p.muted;
      }
    } catch {
      /* ignore */
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LEVELS_KEY, JSON.stringify(this.lv));
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------------------
  // Graph setup / unlock
  // ---------------------------------------------------------------------------
  /** Must be called from a user gesture (submit) to unlock audio. */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();

    // master volume
    this.master = this.ctx.createGain();
    this.master.gain.value = this.effectiveMaster();
    this.master.connect(this.ctx.destination);

    // limiter / compressor — protects exhibition playback from clipping
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    this.limiter.connect(this.master);

    // bus (dry + wet meet here before the limiter)
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.limiter);

    // reverb (short algorithmic impulse) with a controllable wet send
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this.buildImpulse(1.8, 2.4);
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = this.lv.reverb;
    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.bus);
  }

  private effectiveMaster(): number {
    return this.lv.muted ? 0 : this.lv.master;
  }

  /** Short exponential-decay stereo-ish impulse response for subtle reverb. */
  private buildImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------------------------------------------------------------------------
  // Level controls (Admin panel)
  // ---------------------------------------------------------------------------
  getVolume(): number {
    return this.lv.master;
  }
  isMuted(): boolean {
    return this.lv.muted;
  }
  getProcessingLevel(): number {
    return this.lv.processing;
  }
  getChosenLevel(): number {
    return this.lv.chosen;
  }
  getOtherResultsLevel(): number {
    return this.lv.otherResults;
  }
  getReverb(): number {
    return this.lv.reverb;
  }

  setVolume(v: number): void {
    this.lv.master = clamp01(v);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.effectiveMaster(), this.ctx.currentTime, 0.02);
    }
    this.persist();
  }

  setMuted(m: boolean): void {
    this.lv.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.effectiveMaster(), this.ctx.currentTime, 0.02);
    }
    this.persist();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.lv.muted);
    return this.lv.muted;
  }

  setProcessingLevel(v: number): void {
    this.lv.processing = clamp01(v);
    this.persist();
  }
  setChosenLevel(v: number): void {
    this.lv.chosen = clamp01(v);
    this.persist();
  }
  setOtherResultsLevel(v: number): void {
    this.lv.otherResults = clamp01(v);
    this.persist();
  }
  setReverb(v: number): void {
    this.lv.reverb = clamp01(v);
    if (this.reverbSend && this.ctx) {
      this.reverbSend.gain.setTargetAtTime(this.lv.reverb, this.ctx.currentTime, 0.03);
    }
    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Low-level voice: a shaped tone routed dry + into the reverb send.
  // `bus` picks the per-cue gain node so an entire cue can be scaled/stopped.
  // ---------------------------------------------------------------------------
  private voice(
    dest: GainNode,
    freq: number,
    start: number,
    dur: number,
    opts: {
      type?: OscType;
      peak?: number;
      glideTo?: number;
      attack?: number;
      pan?: number; // -1..1
      wet?: number; // 0..1 extra reverb send for this voice
      filter?: { type: BiquadFilterType; freq: number };
    } = {},
  ): void {
    if (!this.ctx || !this.reverbSend) return;
    const { type = 'sine', peak = 0.6, glideTo, attack = 0.012, pan = 0, wet = 1, filter } = opts;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), start + dur);
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(attack, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    let head: AudioNode = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      osc.connect(f);
      head = f;
    }
    head.connect(g);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(panner);
    // dry → per-cue bus
    panner.connect(dest);
    // wet → reverb send (scaled per voice)
    const wetGain = this.ctx.createGain();
    wetGain.gain.value = wet;
    panner.connect(wetGain).connect(this.reverbSend);

    osc.start(start);
    osc.stop(start + dur + 0.05);
    if (dest === this.procGain) this.procNodes.push(osc);
  }

  /** Filtered noise burst (write/scan texture). */
  private noise(
    dest: GainNode,
    start: number,
    dur: number,
    opts: { peak?: number; type?: BiquadFilterType; freq?: number; q?: number; pan?: number } = {},
  ): void {
    if (!this.ctx) return;
    const { peak = 0.2, type = 'bandpass', freq = 2400, q = 0.8, pan = 0 } = opts;
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(panner).connect(dest);
    src.start(start);
    src.stop(start + dur);
    if (dest === this.procGain) this.procNodes.push(src);
  }

  /** Create a fresh per-cue gain node scaled to a relative target level. */
  private cueBus(relative: number, level: number): GainNode {
    const g = this.ctx!.createGain();
    // headroom base 0.5 so summed voices stay under the limiter comfortably
    g.gain.value = 0.5 * relative * clamp01(level);
    g.connect(this.bus!);
    return g;
  }

  // ---------------------------------------------------------------------------
  // INPUT SUBMITTED — one short, quiet, functional confirm (0.25–0.45s)
  // ---------------------------------------------------------------------------
  submit(): void {
    this.init();
    if (!this.ctx) return;
    const bus = this.cueBus(REL.SUBMIT, this.lv.otherResults);
    const t = this.now();
    this.voice(bus, 720, t, 0.12, { type: 'square', peak: 0.6, attack: 0.004, wet: 0.3 });
    this.voice(bus, 1080, t + 0.06, 0.14, { type: 'triangle', peak: 0.5, attack: 0.004, wet: 0.3 });
    this.noise(bus, t + 0.01, 0.05, { peak: 0.15, freq: 3200, q: 1.2 });
  }

  // ---------------------------------------------------------------------------
  // PROCESSING — one continuous sequence across all four stages.
  // Stops/crossfades cleanly before the result. Never overlaps itself.
  // ---------------------------------------------------------------------------
  /** Backwards-compatible name; `durationMs` is ignored — timing follows the
   *  real animation. Use startProcessingSequence() going forward. */
  scanning(_durationMs?: number): void {
    this.startProcessingSequence();
  }

  startProcessingSequence(): void {
    this.init();
    if (!this.ctx) return;
    // hard-stop any previous bed so loops never stack
    this.stopProcessingSound(0.02);

    const token = ++this.procToken;
    const t0 = this.now() + 0.02;
    const bus = this.ctx.createGain();
    bus.gain.value = 0.5 * REL.PROCESSING * clamp01(this.lv.processing);
    bus.connect(this.bus!);
    this.procGain = bus;
    this.procNodes = [];
    this.procEndsAt = t0 + PROCESSING_TOTAL_S;

    const s1 = t0;
    const s2 = s1 + STAGE_S[0];
    const s3 = s2 + STAGE_S[1];
    const s4 = s3 + STAGE_S[2];
    const end = s4 + STAGE_S[3];

    // A quiet sustained low drone threads the whole sequence for cohesion.
    this.voice(bus, 110, s1, PROCESSING_TOTAL_S, {
      type: 'sine',
      peak: 0.14,
      attack: 0.4,
      wet: 0.6,
      filter: { type: 'lowpass', freq: 420 },
    });

    // STAGE 1 — NUMBERS ASSIGNED: confirmation pulse + two digital tones.
    this.voice(bus, 523.25, s1 + 0.05, 0.14, { type: 'triangle', peak: 0.32, pan: -0.5, wet: 0.4 });
    this.voice(bus, 659.25, s1 + 0.5, 0.16, { type: 'triangle', peak: 0.32, pan: 0.5, wet: 0.4 });
    this.voice(bus, 392, s1 + 1.0, 0.2, { type: 'sine', peak: 0.26, wet: 0.5 });

    // STAGE 2 — BOTH PATHS MEASURED: repeating scan rhythm, alternating stereo,
    // gradual density increase (suspense without loudness).
    {
      const steps = 12;
      const step = STAGE_S[1] / steps;
      for (let i = 0; i < steps; i++) {
        const p = i / steps;
        const st = s2 + i * step;
        const freq = 300 + Math.sin(p * Math.PI * 3) * 90 + p * 160;
        this.voice(bus, freq, st, step * 0.7, {
          type: 'triangle',
          peak: 0.12 + p * 0.14,
          pan: i % 2 === 0 ? -0.6 : 0.6,
          wet: 0.5,
        });
        if (i % 2 === 0) this.noise(bus, st, step * 0.35, { peak: 0.05 + p * 0.05, freq: 2600, pan: i % 4 === 0 ? -0.4 : 0.4 });
      }
    }

    // STAGE 3 — SHORTEST PATH SELECTED: remove a layer, focus into one clear
    // rising tone (the system commits).
    this.voice(bus, 440, s3, STAGE_S[2] * 0.85, {
      type: 'sine',
      peak: 0.3,
      glideTo: 660,
      attack: 0.05,
      wet: 0.6,
    });
    this.noise(bus, s3 + 0.05, 0.08, { peak: 0.1, freq: 1800, q: 1.2 });

    // STAGE 4 — OUTCOME RANGE: settle, then a short near-silence pocket before
    // the result cue. The bed fades out ~250ms before `end`.
    this.voice(bus, 392, s4, 0.5, { type: 'sine', peak: 0.2, wet: 0.6 });
    bus.gain.setValueAtTime(bus.gain.value, end - 0.6);
    bus.gain.exponentialRampToValueAtTime(0.0006, end - 0.25);

    // auto-clear bookkeeping if it runs to completion naturally
    window.setTimeout(
      () => {
        if (this.procToken === token) {
          this.procGain = null;
          this.procNodes = [];
        }
      },
      (PROCESSING_TOTAL_S + 0.3) * 1000,
    );
  }

  /** Stop the processing bed cleanly (short fade to avoid clicks). */
  stopProcessingSound(fade = 0.08): void {
    if (!this.ctx) return;
    this.procToken++; // invalidate any pending auto-clear
    const g = this.procGain;
    const nodes = this.procNodes;
    this.procGain = null;
    this.procNodes = [];
    this.procEndsAt = 0;
    if (g) {
      const t = this.now();
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0004, t + fade);
      } catch {
        /* ignore */
      }
    }
    window.setTimeout(() => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      if (g) {
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      }
    }, Math.ceil(fade * 1000) + 30);
  }

  // ---------------------------------------------------------------------------
  // RESULT CUES — each a distinct musical identity. Dispatch guards single-fire.
  // ---------------------------------------------------------------------------
  outcome(result: Outcome): void {
    switch (result) {
      case 'CHOSEN':
        return this.playChosenSound();
      case 'ALMOST CHOSEN':
        return this.playAlmostChosenSound();
      case 'REGISTERED':
        return this.playRegisteredSound();
      case 'NOT THIS TIME':
        return this.playNotThisTimeSound();
    }
  }

  /**
   * CHOSEN — strong celebratory arrival. Three-part upward fanfare → bright
   * sustained major chord + shimmer + low/mid impact + long decay.
   * Louder than every other cue (via REL + CHOSEN LEVEL) but limiter-safe.
   * ~2.5–3.5s. A brief silence pocket precedes the impact for suspense.
   */
  playChosenSound(): void {
    this.init();
    if (!this.ctx) return;
    // ensure no bed underneath the reveal
    this.stopProcessingSound(0.05);
    const bus = this.cueBus(REL.CHOSEN, this.lv.chosen);
    const t = this.now() + 0.18; // 180ms suspense pocket

    // low/mid impact at the reveal
    this.voice(bus, 130.81, t, 0.6, { type: 'sine', peak: 0.7, attack: 0.006, wet: 0.5 });
    this.voice(bus, 261.63, t, 0.5, { type: 'triangle', peak: 0.5, attack: 0.006, wet: 0.4 });
    this.noise(bus, t, 0.06, { peak: 0.18, freq: 5200, q: 0.7 }); // transient sparkle

    // three-part rising fanfare (C5 → E5 → G5)
    this.voice(bus, 523.25, t + 0.02, 0.22, { type: 'triangle', peak: 0.55, pan: -0.3, wet: 0.5 });
    this.voice(bus, 659.25, t + 0.2, 0.24, { type: 'triangle', peak: 0.58, pan: 0.0, wet: 0.5 });
    this.voice(bus, 783.99, t + 0.4, 0.3, { type: 'triangle', peak: 0.62, pan: 0.3, wet: 0.6 });

    // final bright sustained major chord (C major, C5-E5-G5-C6) with long tail
    const chordStart = t + 0.66;
    this.voice(bus, 523.25, chordStart, 1.9, { type: 'sine', peak: 0.5, attack: 0.02, wet: 0.8 });
    this.voice(bus, 659.25, chordStart, 1.9, { type: 'sine', peak: 0.42, attack: 0.02, wet: 0.8 });
    this.voice(bus, 783.99, chordStart, 1.9, { type: 'triangle', peak: 0.4, attack: 0.02, wet: 0.8 });
    this.voice(bus, 1046.5, chordStart, 2.0, { type: 'sine', peak: 0.38, attack: 0.02, wet: 0.9 });

    // shimmering high-frequency sparkle over the chord
    const sparkle = [1568, 2093, 2637, 3136];
    sparkle.forEach((f, i) => {
      this.voice(bus, f, chordStart + 0.1 + i * 0.12, 0.5 + i * 0.15, {
        type: 'sine',
        peak: 0.12,
        attack: 0.02,
        pan: i % 2 === 0 ? -0.5 : 0.5,
        wet: 1,
      });
    });
  }

  /**
   * ALMOST CHOSEN — rise, near arrival, withheld resolution, slight fall,
   * soft unresolved tail. Does NOT reuse the full CHOSEN chord. ~2.0–2.8s.
   */
  playAlmostChosenSound(): void {
    this.init();
    if (!this.ctx) return;
    this.stopProcessingSound(0.05);
    const bus = this.cueBus(REL.ALMOST, this.lv.otherResults);
    const t = this.now();

    // confident rise toward selection (G4 → C5 → E5 → approaching G5)
    this.voice(bus, 392, t, 0.22, { type: 'sawtooth', peak: 0.4, glideTo: 523.25, wet: 0.4, filter: { type: 'lowpass', freq: 2600 } });
    this.voice(bus, 523.25, t + 0.22, 0.24, { type: 'triangle', peak: 0.46, glideTo: 659.25, wet: 0.5 });
    this.voice(bus, 659.25, t + 0.46, 0.26, { type: 'triangle', peak: 0.5, glideTo: 740, wet: 0.55 });

    // approach the expected final note (G5 ~784) but hold just under it...
    this.voice(bus, 740, t + 0.74, 0.2, { type: 'triangle', peak: 0.52, pan: 0.1, wet: 0.6 });
    // ...delay/withhold — a tense held tone that does not resolve up
    this.voice(bus, 760, t + 0.94, 0.24, { type: 'sine', peak: 0.44, wet: 0.7 });

    // the slight, aching fall + soft unresolved tail (settles on a non-tonic)
    this.voice(bus, 698.46, t + 1.2, 0.7, { type: 'sine', peak: 0.42, glideTo: 622.25, wet: 0.85 });
    this.voice(bus, 466.16, t + 1.35, 0.6, { type: 'sine', peak: 0.22, wet: 0.8 }); // soft dissonant undertone
  }

  /**
   * REGISTERED — calm, procedural "record written" confirmation.
   * Compact pulses + digital write gesture + low confirmation note. ~1.4–2.0s.
   * Not celebratory, not rejection.
   */
  playRegisteredSound(): void {
    this.init();
    if (!this.ctx) return;
    this.stopProcessingSound(0.05);
    const bus = this.cueBus(REL.REGISTERED, this.lv.otherResults);
    const t = this.now();

    // two–three compact confirmation pulses (steady, equal — procedural).
    // Fuller envelopes so each pulse is clearly audible (was too short/quiet):
    // longer duration + higher peak + a triangle body under the square edge.
    const pulse = (at: number) => {
      this.voice(bus, 587.33, at, 0.16, { type: 'square', peak: 0.6, attack: 0.006, wet: 0.3, filter: { type: 'lowpass', freq: 3200 } });
      this.voice(bus, 587.33, at, 0.18, { type: 'triangle', peak: 0.5, attack: 0.008, wet: 0.3 });
    };
    pulse(t);
    pulse(t + 0.22);
    pulse(t + 0.44);

    // short digital write / save texture
    this.noise(bus, t + 0.6, 0.16, { peak: 0.2, type: 'highpass', freq: 1600, q: 0.6 });

    // subtle low confirmation note + clean ending
    this.voice(bus, 220, t + 0.64, 0.7, { type: 'sine', peak: 0.62, attack: 0.02, wet: 0.5 });
    this.voice(bus, 330, t + 0.66, 0.6, { type: 'triangle', peak: 0.4, attack: 0.02, wet: 0.5 });
  }

  /**
   * NOT THIS TIME — clear descending closure. Darker/lower, definite stop,
   * little/no shimmer. Not an error/alarm. ~1.4–2.0s.
   */
  playNotThisTimeSound(): void {
    this.init();
    if (!this.ctx) return;
    this.stopProcessingSound(0.05);
    const bus = this.cueBus(REL.NOT_THIS_TIME, this.lv.otherResults);
    const t = this.now();

    // descending three-note phrase (A4 → F4 → C4), darker sine/triangle
    this.voice(bus, 440, t, 0.26, { type: 'triangle', peak: 0.42, wet: 0.35, filter: { type: 'lowpass', freq: 1600 } });
    this.voice(bus, 349.23, t + 0.28, 0.28, { type: 'triangle', peak: 0.4, wet: 0.4, filter: { type: 'lowpass', freq: 1400 } });
    this.voice(bus, 261.63, t + 0.58, 0.36, { type: 'sine', peak: 0.42, wet: 0.45, filter: { type: 'lowpass', freq: 1200 } });

    // low final closure tone — a quiet, dry, definite stop
    this.voice(bus, 130.81, t + 0.94, 0.7, { type: 'sine', peak: 0.4, attack: 0.02, glideTo: 110, wet: 0.3 });
  }

  // ---------------------------------------------------------------------------
  // Admin composite tests
  // ---------------------------------------------------------------------------
  /** Full processing sequence alone (Admin: TEST FULL PROCESSING SEQUENCE). */
  playFullProcessingSequence(): void {
    this.startProcessingSequence();
  }

  /**
   * TEST FULL DRAW AUDIO — Input Submitted → complete Processing → chosen
   * result cue, timed exactly like the live flow (result fires at the same
   * offset the animation reveals: PROCESSING_TOTAL_S + 500ms).
   */
  playFullDrawAudio(result: Outcome): void {
    this.init();
    if (!this.ctx) return;
    this.submit();
    window.setTimeout(() => this.startProcessingSequence(), 150);
    const revealMs = (0.15 + PROCESSING_TOTAL_S) * 1000 + 500;
    window.setTimeout(() => this.outcome(result), revealMs);
  }

  /** Stop everything immediately (Admin: STOP ALL AUDIO / reset). */
  stopAll(): void {
    // Stop the continuous processing bed. In-flight one-shot result cues are
    // short and ride their own gain envelopes to silence, so we do NOT duck
    // the shared master bus here — ducking it briefly muted a result cue
    // (e.g. REGISTERED) that was triggered right after a reset.
    this.stopProcessingSound(0.03);
  }

  // ---------------------------------------------------------------------------
  // Print pipeline cues (unchanged behaviour, routed through the new graph)
  // ---------------------------------------------------------------------------
  printSent(): void {
    this.init();
    if (!this.ctx) return;
    const bus = this.cueBus(REL.SUBMIT, this.lv.otherResults);
    const t = this.now();
    this.voice(bus, 880, t, 0.06, { type: 'square', peak: 0.5, attack: 0.004, wet: 0.3 });
    this.voice(bus, 1174.66, t + 0.06, 0.1, { type: 'square', peak: 0.5, attack: 0.004, wet: 0.3 });
    this.noise(bus, t + 0.02, 0.03, { peak: 0.12, freq: 3200 });
  }

  printFailed(): void {
    this.init();
    if (!this.ctx) return;
    const bus = this.cueBus(REL.NOT_THIS_TIME, this.lv.otherResults);
    const t = this.now();
    this.voice(bus, 311.13, t, 0.16, { type: 'sawtooth', peak: 0.45, glideTo: 233.08, wet: 0.3 });
    this.voice(bus, 233.08, t + 0.18, 0.3, { type: 'sine', peak: 0.4, glideTo: 174.61, wet: 0.3 });
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export const sound = new SoundEngine();
