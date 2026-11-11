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
export const DENOMINATORS = [1, 2, 4, 8, 16] as const;
export type Den = (typeof DENOMINATORS)[number];
/** A bar is at most 8 quarter notes long and has at most 16 beats. */
export const maxBeats = (den: number) => Math.min(16, 2 * den);
/** Triplets only for denominators whose beat is a multiple of a quarter note. */
export const canTriplet = (den: number) => den <= 4;
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
/** Focus options live in the DB (table focus_options, admin-editable); ids look like "hihat". */
export const FOCUS_ID = /^[a-z][a-zA-Z0-9-]{0,29}$/;
export const MAX_FOCUS = 4;

export type Tag = (typeof TAGS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export function barQuarters(bar: { beats: number; den: Den }): number {
  return (bar.beats * 4) / bar.den;
}

/** Grid resolution: 16th notes (4 per quarter) or triplet eighths (3 per quarter). */
export function stepsPerQuarter(triplet: boolean): number {
  return triplet ? 3 : 4;
}

export function stepCount(bar: { beats: number; den: Den; triplet: boolean }): number {
  return Math.round(barQuarters(bar) * stepsPerQuarter(bar.triplet));
}

export interface Bar {
  /** Time signature numerator (beats) and denominator. */
  beats: number;
  den: Den;
  triplet: boolean;
  /** Only non-empty instruments are present. Each string has stepCount(bar) chars. */
  rows: Partial<Record<Instrument, string>>;
}

export const barSchema = z
  .object({
    beats: z.number().int().min(1).max(16),
    den: z.union(DENOMINATORS.map((d) => z.literal(d)) as unknown as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>, z.ZodLiteral<16>]).default(4),
    triplet: z.boolean(),
    rows: z.partialRecord(z.enum(INSTRUMENTS), z.string()),
  })
  .superRefine((bar, ctx) => {
    if (bar.beats > maxBeats(bar.den)) ctx.addIssue({ code: "custom", message: "too long" });
    if (bar.triplet && !canTriplet(bar.den)) ctx.addIssue({ code: "custom", message: "no triplets" });
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
  focus: z.array(z.string().regex(FOCUS_ID)).max(MAX_FOCUS).default([]),
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

export function emptyBar(beats = 4, triplet = false, den: Den = 4): Bar {
  return { beats, den, triplet, rows: {} };
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

/** Change time signature / grid; notes are kept where their position exists on the new grid. */
export function resizeBar(bar: Bar, beats: number, triplet: boolean, den: Den = bar.den): Bar {
  const next = { beats, den, triplet };
  const oldSpq = stepsPerQuarter(bar.triplet);
  const newSpq = stepsPerQuarter(triplet);
  const n = stepCount(next);
  const rows: Bar["rows"] = {};
  for (const [inst, row] of Object.entries(bar.rows) as [Instrument, string][]) {
    const out = "-".repeat(n).split("");
    for (let i = 0; i < row.length; i++) {
      if (row[i] === "-") continue;
      const ns = (i / oldSpq) * newSpq;
      if (Math.abs(ns - Math.round(ns)) < 1e-9 && Math.round(ns) < n) out[Math.round(ns)] = row[i];
    }
    const joined = out.join("");
    if (!/^-+$/.test(joined)) rows[inst] = joined;
  }
  return { ...next, rows };
}
