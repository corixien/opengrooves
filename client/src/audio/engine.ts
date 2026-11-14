import { INSTRUMENTS, getLevel, barQuarters, stepCount, stepsPerQuarter, type Bar, type Instrument, type Level } from "../../../shared/groove";

export interface PlayerSettings {
  bpm: number;
  grooveOn: boolean;
  grooveVol: number;
  metroOn: boolean;
  metroVol: number;
  /** Metronome clicks per beat: 1 = quarter, 2 = eighth, 4 = sixteenth. */
  metroUnit: 1 | 2 | 4;
  countIn: boolean;
  /** Bars of count-in clicks (length of the first bar each). */
  countInBars: number;
  loop: boolean;
  /** Passes through the groove when looping; 0 = endless. */
  loopCount: number;
}

type Ev =
  | { beat: number; kind: "note"; inst: Instrument; level: Level }
  | { beat: number; kind: "click"; strength: 0 | 1 | 2 }
  | { beat: number; kind: "mark" };

interface KitEntry {
  buffers: AudioBuffer[];
  rate: number;
  gain: number;
}

/** Hats choke each other: open and half-open hats ring until the next hat hit. */
const HATS: Instrument[] = ["hhOpen", "hhHalf", "hhClosed", "hhPedal"];
const RINGING_HATS: Instrument[] = ["hhOpen", "hhHalf"];
const AHEAD = 0.2;
const TICK_MS = 25;

/** Events of one pass through the bars; beats are quarter notes local to the pass (0 = first downbeat). */
export function buildEvents(bars: Bar[], unit: 1 | 2 | 4): { events: Ev[]; length: number } {
  const events: Ev[] = [];
  let start = 0;
  for (const bar of bars) {
    const spq = stepsPerQuarter(bar.triplet);
    const n = stepCount(bar);
    const q = barQuarters(bar);
    for (let i = 0; i < n; i++) {
      for (const inst of INSTRUMENTS) {
        const level = getLevel(bar, inst, i);
        if (level) events.push({ beat: start + i / spq, kind: "note", inst, level });
      }
    }
    // metronome: one click per quarter / eighth / sixteenth (thirds of a quarter in triplet bars)
    const beatLen = 4 / bar.den;
    const clickLen = unit === 1 ? 1 : bar.triplet ? 1 / 3 : 1 / unit;
    const clicks = Math.round(q / clickLen);
    for (let k = 0; k < clicks; k++) {
      const t = k * clickLen;
      const onBeat = Math.abs(t / beatLen - Math.round(t / beatLen)) < 1e-9;
      events.push({ beat: start + t, kind: "click", strength: k === 0 ? 2 : onBeat ? 1 : 0 });
    }
    // position marks for the playhead: at least every quarter note
    const markLen = Math.min(1, beatLen);
    for (let t = 0; t < q - 1e-9; t += markLen) events.push({ beat: start + t, kind: "mark" });
    start += q;
  }
  events.push({ beat: start, kind: "mark" });
  events.sort((a, b) => a.beat - b.beat);
  return { events, length: start };
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  bpm: 100,
  grooveOn: true,
  grooveVol: 0.9,
  metroOn: true,
  metroVol: 0.5,
  metroUnit: 1,
  countIn: false,
  countInBars: 1,
  loop: true,
  loopCount: 0,
};

class Engine {
  settings: PlayerSettings = { ...DEFAULT_SETTINGS };
  /** Bumped on every play/pause/stop/seek; for useSyncExternalStore. */
  rev = 0;
  private subs = new Set<() => void>();
  subscribe = (cb: () => void) => (this.subs.add(cb), () => void this.subs.delete(cb));
  private bump() {
    this.rev++;
    this.subs.forEach((f) => f());
  }
  get hasBars() {
    return this.bars.length > 0;
  }
  onEnd: (() => void) | null = null;
  /** Id of the groove being played (null in the editor); reported with onFullPass. */
  grooveId: string | null = null;
  /** Called once per run when all bars have been played through from the start. */
  onFullPass: ((id: string) => void) | null = null;

  private ctx: AudioContext | null = null;
  private grooveGain!: GainNode;
  private metroGain!: GainNode;
  private kit: Partial<Record<Instrument, KitEntry>> = {};
  private loading: Promise<void> | null = null;
  private bars: Bar[] = [];

  private timer: number | null = null;
  private events: Ev[] = [];
  private idx = 0;
  private phase: "countin" | "main" = "main";
  private lastBeat = 0;
  private lastTime = 0;
  private ended = false;
  private pausedAt: number | null = null;
  private passes = 0;
  private passFull = true;
  private counted = false;
  private marks: { time: number; beat: number }[] = [];
  private live = new Set<AudioScheduledSourceNode>();
  private openHat: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private pauseTimer: number | null = null;

  setBars(bars: Bar[]) {
    this.bars = bars;
  }

  get playing() {
    return this.timer !== null;
  }

  /** Position (quarters in the pass) where a paused or seeked groove continues, or 0. */
  get resumeAt() {
    return this.pausedAt ?? 0;
  }

  get paused() {
    return this.timer === null && this.pausedAt !== null;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.grooveGain = ctx.createGain();
      this.metroGain = ctx.createGain();
      this.grooveGain.connect(comp);
      this.metroGain.connect(comp);
      this.ctx = ctx;
    }
    return this.ctx;
  }

  /** Fetches and decodes the kit described by /samples/manifest.json (once). */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    const ctx = this.ensureCtx();
    this.loading = (async () => {
      const manifest = (await (await fetch("/samples/manifest.json")).json()) as Record<
        string,
        { files: string[]; rate?: number; gain?: number }
      >;
      const cache = new Map<string, Promise<AudioBuffer>>();
      const decode = (file: string) => {
        let p = cache.get(file);
        if (!p) {
          p = fetch(`/samples/${file}`)
            .then((r) => r.arrayBuffer())
            .then((b) => ctx.decodeAudioData(b));
          cache.set(file, p);
        }
        return p;
      };
      await Promise.all(
        INSTRUMENTS.map(async (inst) => {
          const m = manifest[inst];
          if (!m) return;
          this.kit[inst] = {
            buffers: await Promise.all(m.files.map(decode)),
            rate: m.rate ?? 1,
            gain: m.gain ?? 1,
          };
        }),
      );
    })().catch((e) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  private spb() {
    return 60 / this.settings.bpm;
  }

  private playNote(inst: Instrument, level: Level, t: number) {
    const ctx = this.ctx!;
    const k = this.kit[inst];
    if (!k) return;
    const buf = k.buffers[Math.min(level, k.buffers.length) - 1] ?? k.buffers[0];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = k.rate;
    const g = ctx.createGain();
    g.gain.value = k.gain; // soft/medium/hard are separate recordings
    src.connect(g).connect(this.grooveGain);
    if (HATS.includes(inst)) this.chokeOpenHat(t);
    if (RINGING_HATS.includes(inst)) this.openHat = { src, gain: g };
    this.track(src);
    src.start(t);
  }

  private chokeOpenHat(t: number) {
    if (!this.openHat) return;
    const { src, gain } = this.openHat;
    gain.gain.setTargetAtTime(0, t, 0.015);
    try {
      src.stop(t + 0.15);
    } catch {
      /* already stopped */
    }
    this.openHat = null;
  }

  private click(strength: 0 | 1 | 2, t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = strength === 2 ? 1500 : strength === 1 ? 1000 : 700;
    const peak = strength === 2 ? 1 : strength === 1 ? 0.7 : 0.4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(g).connect(this.metroGain);
    this.track(osc);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  private track(src: AudioScheduledSourceNode) {
    this.live.add(src);
    src.addEventListener("ended", () => this.live.delete(src));
  }

  /** Plays one hit right away (editor feedback). */
  preview(inst: Instrument, level: Level) {
    if (!this.ctx || !this.loading) return;
    void this.ctx.resume();
    this.grooveGain.gain.value = this.settings.grooveVol;
    this.playNote(inst, level, this.ctx.currentTime);
  }

  /** Starts at `from` quarters into the groove (resume / seek); count-in only when starting from 0. */
  async start(from = 0) {
    if (this.playing) return;
    await this.load();
    const ctx = this.ensureCtx();
    await ctx.resume();
    if (this.playing) return; // another start() won the race while loading
    this.ended = false;
    this.marks = [];
    this.pausedAt = null;
    this.counted = false;
    if (from === 0) this.passes = 0;
    this.lastTime = ctx.currentTime + 0.12;
    this.lastBeat = 0;
    this.idx = 0;
    if (from === 0 && this.settings.countIn) {
      const perBar = Math.max(2, Math.round(this.bars[0] ? barQuarters(this.bars[0]) : 4));
      const total = perBar * Math.max(1, this.settings.countInBars);
      const events: Ev[] = [];
      for (let k = 0; k < total; k++) {
        events.push({ beat: k - total, kind: "mark" }, { beat: k - total, kind: "click", strength: k % perBar === 0 ? 2 : 1 });
      }
      events.push({ beat: 0, kind: "mark" });
      this.events = events;
      this.lastBeat = -total;
      this.phase = "countin";
    } else {
      this.beginMainPass(from);
    }
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.bump();
  }

  private beginMainPass(from = 0) {
    const { events } = buildEvents(this.bars, this.settings.metroUnit);
    this.events = from > 0 ? [{ beat: from, kind: "mark" }, ...events.filter((e) => e.beat >= from - 1e-9)] : events;
    this.idx = 0;
    this.lastBeat = from;
    this.phase = "main";
    this.passFull = from === 0;
  }

  /** A pass reached its end: counts as one play per run when it was played in full. */
  private completePass() {
    this.passes++;
    if (this.passFull && !this.counted) {
      this.counted = true;
      if (this.grooveId) this.onFullPass?.(this.grooveId);
    }
  }

  private tick() {
    const ctx = this.ctx!;
    const s = this.settings;
    this.grooveGain.gain.value = s.grooveVol;
    this.metroGain.gain.value = s.metroVol;

    if (this.ended) {
      if (ctx.currentTime >= this.lastTime + 0.4) this.stop(true);
      return;
    }
    for (;;) {
      const ev = this.events[this.idx];
      if (!ev) {
        if (this.phase === "countin") {
          this.beginMainPass();
          continue;
        }
        this.completePass();
        if (s.loop && (s.loopCount === 0 || this.passes < s.loopCount)) {
          this.beginMainPass();
          continue;
        }
        this.ended = true;
        return;
      }
      const t = this.lastTime + (ev.beat - this.lastBeat) * this.spb();
      if (t > ctx.currentTime + AHEAD) return;
      this.lastTime = t;
      this.lastBeat = ev.beat;
      this.idx++;
      if (ev.kind === "mark") this.marks.push({ time: t, beat: ev.beat });
      else if (ev.kind === "note") {
        if (s.grooveOn) this.playNote(ev.inst, ev.level, Math.max(t, ctx.currentTime));
      } else if (this.phase === "countin" || s.metroOn) this.click(ev.strength, Math.max(t, ctx.currentTime));
    }
  }

  private halt() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.pauseTimer !== null) window.clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
    for (const src of this.live) {
      try {
        src.stop();
      } catch {
        /* not started or already stopped */
      }
    }
    this.live.clear();
    this.openHat = null;
    this.marks = [];
  }

  stop(natural = false) {
    this.halt();
    this.pausedAt = null;
    if (natural) this.onEnd?.();
    this.bump();
  }

  /** Quarter positions of the step lines (16ths, or triplet steps) just before and after `pos`. */
  private stepsAround(pos: number): { prev: number; next: number } {
    let start = 0;
    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];
      const q = barQuarters(bar);
      if (pos < start + q || i === this.bars.length - 1) {
        const spq = stepsPerQuarter(bar.triplet);
        const k = Math.floor((pos - start) * spq + 1e-6);
        return { prev: start + k / spq, next: start + (k + 1) / spq };
      }
      start += q;
    }
    return { prev: pos, next: pos };
  }

  /**
   * Stops and remembers the position so start(resumeAt) continues from there. The position always
   * lies on a step line: just after one it goes back, otherwise playback runs on to the next one.
   */
  pause() {
    if (!this.playing || this.pauseTimer !== null) return;
    const pos = this.phase === "main" ? this.getPosition() : null;
    if (pos === null || pos <= 0) return this.settle(null);
    const { prev, next } = this.stepsAround(pos);
    const stepSec = this.spb() * (next - prev);
    const wait = (next - pos) * this.spb() - (this.ctx?.outputLatency || this.ctx?.baseLatency || 0) - 0.005;
    if (pos - prev < 0.3 * (next - prev) || wait <= 0 || wait > stepSec) return this.settle(prev);
    this.pauseTimer = window.setTimeout(() => this.settle(next), wait * 1000);
  }

  private settle(pos: number | null) {
    this.halt();
    const end = this.bars.reduce((q, b) => q + barQuarters(b), 0);
    this.pausedAt = pos !== null && pos > 0 && pos < end - 1e-9 ? pos : null;
    this.bump();
  }

  /** Jumps to `pos` quarters: continues playing from there, or just moves the resume point. */
  seek(pos: number) {
    const was = this.playing;
    this.halt();
    this.pausedAt = pos;
    this.bump();
    if (was) void this.start(pos);
  }

  /** Current position in beats within the pass (negative during count-in), or null when stopped. */
  getPosition(): number | null {
    if (this.timer === null) return this.pausedAt;
    if (!this.ctx) return null;
    const now = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    const m = this.marks;
    while (m.length > 2 && m[1].time <= now - 1) m.shift();
    let cur = -1;
    for (let i = 0; i < m.length && m[i].time <= now; i++) cur = i;
    if (cur < 0) return m[0]?.beat ?? null; // starting: already at the first position
    const a = m[cur];
    const b = m[cur + 1];
    // Marks are only scheduled ~AHEAD seconds early, so extrapolate with the current tempo
    // (capped at the next beat mark) to keep the playhead moving continuously.
    const span = b && b.beat > a.beat ? b.beat - a.beat : 1;
    return a.beat + Math.min(span, ((now - a.time) * this.settings.bpm) / 60);
  }
}

export const engine = new Engine();
