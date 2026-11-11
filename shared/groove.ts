import { z } from "zod";

export const INSTRUMENTS = [
  "crash",
  "ride",
  "hhOpen",
  "hhClosed",
  "tomHigh",
  "tomMid",
  "tomLow",
  "snare",
  "kick",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** Step characters: '-' empty, '1' ghost, '2' normal, '3' accent. */
export const STEP_CHARS = "-123";
export type Level = 0 | 1 | 2 | 3;

export const MAX_BARS = 20;
export const MIN_BEATS = 1;
export const MAX_BEATS = 8;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

export const TAGS = [
  "rock",
  "pop",
  "funk",
  "jazz",
  "blues",
  "latin",
  "metal",
  "hiphop",
  "reggae",
  "shuffle",
  "fill",
  "oddMeter",
] as const;
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const FOCUS = [
  "hihat",
  "kick",
  "snare",
  "feet",
  "ghostNotes",
  "fills",
  "dynamics",
  "timing",
] as const;

export type Tag = (typeof TAGS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Focus = (typeof FOCUS)[number];

export function stepsPerBeat(triplet: boolean): number {
  return triplet ? 3 : 4;
}

export function stepCount(bar: { beats: number; triplet: boolean }): number {
  return bar.beats * stepsPerBeat(bar.triplet);
}

export interface Bar {
  beats: number;
  triplet: boolean;
  /** Only non-empty instruments are present. Each string has stepCount(bar) chars. */
  rows: Partial<Record<Instrument, string>>;
}

export const barSchema = z
  .object({
    beats: z.number().int().min(MIN_BEATS).max(MAX_BEATS),
    triplet: z.boolean(),
    rows: z.partialRecord(z.enum(INSTRUMENTS), z.string()),
  })
  .superRefine((bar, ctx) => {
    const n = stepCount(bar);
    for (const [inst, row] of Object.entries(bar.rows)) {
      if (row.length !== n || !/^[-123]+$/.test(row)) {
        ctx.addIssue({ code: "custom", message: `invalid row ${inst}` });
      }
    }
  });

const text = (max: number) => z.string().trim().max(max);

export const grooveInputSchema = z.object({
  title: text(60).min(1),
  author: text(30).default(""),
  description: text(300).default(""),
  tags: z.array(z.enum(TAGS)).max(6).default([]),
  difficulty: z.enum(DIFFICULTIES),
  focus: z.array(z.enum(FOCUS)).max(4).default([]),
  bpm: z.number().int().min(MIN_BPM).max(MAX_BPM),
  bars: z.array(barSchema).min(1).max(MAX_BARS),
  forkOf: z.string().max(40).nullable().default(null),
});
export type GrooveInput = z.infer<typeof grooveInputSchema>;

export interface Groove extends Omit<GrooveInput, "forkOf"> {
  id: string;
  createdAt: string;
  plays: number;
  likes: number;
  forkOf: { id: string; title: string } | null;
}

export function emptyBar(beats = 4, triplet = false): Bar {
  return { beats, triplet, rows: {} };
}

export function getLevel(bar: Bar, inst: Instrument, step: number): Level {
  const c = bar.rows[inst]?.[step];
  return (c && c !== "-" ? Number(c) : 0) as Level;
}

/** Immutable update of one cell; drops rows that become empty. */
export function setLevel(bar: Bar, inst: Instrument, step: number, level: Level): Bar {
  const n = stepCount(bar);
  const row = (bar.rows[inst] ?? "-".repeat(n)).split("");
  row[step] = level === 0 ? "-" : String(level);
  const joined = row.join("");
  const rows = { ...bar.rows };
  if (/^-+$/.test(joined)) delete rows[inst];
  else rows[inst] = joined;
  return { ...bar, rows };
}

/** Change beats/triplet; notes are kept where the step still exists, mapped by beat position. */
export function resizeBar(bar: Bar, beats: number, triplet: boolean): Bar {
  const oldSpb = stepsPerBeat(bar.triplet);
  const newSpb = stepsPerBeat(triplet);
  const rows: Bar["rows"] = {};
  for (const [inst, row] of Object.entries(bar.rows) as [Instrument, string][]) {
    const out = "-".repeat(beats * newSpb).split("");
    for (let i = 0; i < row.length; i++) {
      if (row[i] === "-") continue;
      const beat = Math.floor(i / oldSpb);
      const sub = i % oldSpb;
      // keep downbeat-aligned positions: sub 0 stays, others only when the grid matches
      const ns = triplet === bar.triplet ? sub : sub === 0 ? 0 : -1;
      if (beat < beats && ns >= 0) out[beat * newSpb + ns] = row[i];
    }
    const joined = out.join("");
    if (!/^-+$/.test(joined)) rows[inst] = joined;
  }
  return { beats, triplet, rows };
}
