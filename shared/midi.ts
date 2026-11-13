import {
  MAX_BARS,
  MAX_BPM,
  MIN_BPM,
  DENOMINATORS,
  canTriplet,
  emptyBar,
  getLevel,
  barQuarters,
  maxBeats,
  setLevel,
  stepCount,
  stepsPerQuarter,
  type Bar,
  type Instrument,
  type Level,
} from "./groove";

/** General MIDI drum map (percussion channel) -> our instruments. */
export const GM_INSTRUMENT: Record<number, Instrument> = {
  35: "kick", 36: "kick",
  37: "sidestick",
  38: "snare", 40: "snare",
  42: "hhClosed",
  44: "hhPedal",
  46: "hhOpen",
  23: "hhHalf", // GM2 half-open hi-hat
  49: "crash",
  57: "crash2",
  51: "ride", 59: "ride",
  53: "rideBell",
  55: "splash",
  52: "china",
  50: "tomHigh", 48: "tomHigh",
  47: "tomMid", 45: "tomMid",
  43: "tomLow", 41: "tomLow",
};

export const velocityLevel = (vel: number): Level => (vel < 45 ? 1 : vel < 100 ? 2 : 3);

/** Live quantization: every step, every second step (eighths in sixteenth bars) or every beat. */
export type Quantize = "step" | "eighth" | "quarter";

const stepSize = (bar: Bar, q: Quantize) => {
  const spq = stepsPerQuarter(bar.triplet);
  return q === "step" ? 1 : q === "quarter" ? spq : spq % 2 === 0 ? spq / 2 : 1;
};

/** Maps a position (quarters from the pass start) to the nearest allowed step; rounding past a bar's end lands on the next bar. */
export function locateStep(bars: Bar[], pos: number, q: Quantize): { bar: number; step: number } | null {
  let start = 0;
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const quarters = barQuarters(bar);
    if (pos < start + quarters || i === bars.length - 1) {
      const size = stepSize(bar, q);
      const idx = Math.round((Math.max(0, pos - start) * stepsPerQuarter(bar.triplet)) / size) * size;
      return idx >= stepCount(bar) ? { bar: (i + 1) % bars.length, step: 0 } : { bar: i, step: idx };
    }
    start += quarters;
  }
  return null;
}

// ---------- Standard MIDI File ----------
export interface ParsedMidi {
  ppq: number;
  /** microseconds per quarter note */
  tempo: number;
  timeSig: { num: number; den: number };
  notes: { tick: number; note: number; vel: number }[];
}

export function parseMidi(data: Uint8Array): ParsedMidi {
  let p = 0;
  const u8 = () => data[p++];
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  const vlq = () => {
    let v = 0;
    for (let b = 0x80, n = 0; b & 0x80 && n < 4; n++) {
      b = u8();
      v = (v << 7) | (b & 0x7f);
    }
    return v;
  };
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());

  if (tag() !== "MThd") throw new Error("not a MIDI file");
  const headLen = u32();
  u16(); // format
  const tracks = u16();
  const division = u16();
  p += headLen - 6;
  if (division & 0x8000) throw new Error("SMPTE timing is not supported");

  let tempo: number | null = null;
  let timeSig: ParsedMidi["timeSig"] | null = null;
  const all: (ParsedMidi["notes"][number] & { ch: number })[] = [];
  for (let t = 0; t < tracks && p < data.length; t++) {
    if (tag() !== "MTrk") throw new Error("bad track");
    const end = p + u32();
    let tick = 0;
    let status = 0;
    while (p < end) {
      tick += vlq();
      let b = u8();
      if (b < 0x80) {
        p--; // running status
        b = status;
      } else if (b < 0xf0) status = b;
      if (b === 0xff) {
        const type = u8();
        const len = vlq();
        if (type === 0x51 && tempo === null && len === 3) tempo = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
        if (type === 0x58 && timeSig === null && len >= 2) timeSig = { num: data[p], den: 2 ** data[p + 1] };
        p += len;
      } else if (b === 0xf0 || b === 0xf7) {
        p += vlq();
      } else {
        const kind = b & 0xf0;
        const a = u8();
        const v = kind === 0xc0 || kind === 0xd0 ? 0 : u8();
        if (kind === 0x90 && v > 0) all.push({ tick, note: a, vel: v, ch: b & 0x0f });
      }
    }
    p = end;
  }
  // prefer the percussion channel (10) when the file has one
  const perc = all.filter((n) => n.ch === 9);
  const notes = (perc.length ? perc : all).map(({ tick, note, vel }) => ({ tick, note, vel }));
  return { ppq: division, tempo: tempo ?? 500000, timeSig: timeSig ?? { num: 4, den: 4 }, notes };
}

export interface MidiImport {
  bars: Bar[];
  bpm: number;
  /** notes that could not be used (not a drum we have, or beyond 20 bars) */
  dropped: number;
  imported: number;
}

/** Quantizes a parsed file into bars: the first time signature, 16th or triplet grid per bar (whichever fits better). */
export function midiToBars(m: ParsedMidi): MidiImport {
  let { num, den } = m.timeSig;
  if (!(DENOMINATORS as readonly number[]).includes(den) || num < 1 || num > maxBeats(den)) {
    num = 4;
    den = 4;
  }
  const barTicks = ((num * 4) / den) * m.ppq;
  const tolerance = 0.06 * m.ppq; // a note just before the bar line belongs to the next bar

  const mapped = m.notes.flatMap((n) => (GM_INSTRUMENT[n.note] ? [{ ...n, inst: GM_INSTRUMENT[n.note], level: velocityLevel(n.vel) }] : []));
  let dropped = m.notes.length - mapped.length;
  const perBar: { inst: Instrument; q: number; level: Level }[][] = [];
  for (const n of mapped) {
    const bi = Math.floor((n.tick + tolerance) / barTicks);
    if (bi >= MAX_BARS) {
      dropped++;
      continue;
    }
    (perBar[bi] ??= []).push({ inst: n.inst, q: Math.max(0, n.tick - bi * barTicks) / m.ppq, level: n.level });
  }

  const bars: Bar[] = [];
  let imported = 0;
  const count = Math.max(1, perBar.length);
  for (let i = 0; i < count; i++) {
    const notes = perBar[i] ?? [];
    const err = (spq: number) => notes.reduce((s, n) => s + Math.abs(n.q * spq - Math.round(n.q * spq)), 0);
    const triplet = canTriplet(den) && notes.length > 0 && err(3) < err(4) * 0.6;
    const spq = stepsPerQuarter(triplet);
    let bar = emptyBar(num, triplet, den as (typeof DENOMINATORS)[number]);
    const n = stepCount(bar);
    for (const note of notes) {
      const step = Math.min(n - 1, Math.round(note.q * spq));
      if (getLevel(bar, note.inst, step) >= note.level) continue; // keep the louder hit
      bar = setLevel(bar, note.inst, step, note.level);
      imported++;
    }
    bars.push(bar);
  }
  const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60_000_000 / m.tempo)));
  return { bars, bpm, dropped, imported };
}
