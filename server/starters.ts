import { randomBytes } from "node:crypto";
import { grooveInputSchema, stepCount, type Bar, type Den, type GrooveInput, type Instrument } from "../shared/groove.ts";
import type { Db } from "./db.ts";

/**
 * Row from a position list: "0 4 8:3 *2" = steps 0, 4 and 8 (level 3), then every 2nd step.
 * Levels: 1 ghost, 2 normal (default), 3 accent.
 */
function row(n: number, spec: string): string {
  const out = Array<string>(n).fill("-");
  for (const tok of spec.split(/\s+/).filter(Boolean)) {
    const [pos, level = "2"] = tok.split(":");
    if (pos.startsWith("*")) for (let i = 0; i < n; i += Number(pos.slice(1))) out[i] = level;
    else out[Number(pos)] = level;
  }
  return out.join("");
}

type Spec = Partial<Record<Instrument, string>>;

/** One bar; `beats`/`den` set the time signature, `triplet` switches the grid to triplets. */
function bar(rows: Spec, beats = 4, den: Den = 4, triplet = false): Bar {
  const n = stepCount({ beats, den, triplet });
  const filled = Object.entries(rows).filter(([, v]) => v);
  return { beats, den, triplet, rows: Object.fromEntries(filled.map(([k, v]) => [k, row(n, v)])) };
}
const trip = (rows: Spec) => bar(rows, 4, 4, true);

const g = (
  title: string,
  bpm: number,
  difficulty: GrooveInput["difficulty"],
  tags: GrooveInput["tags"],
  focus: string[],
  description: string,
  bars: Bar[],
): GrooveInput => ({ title, author: "Opengrooves", description, tags, difficulty, focus, bpm, bars, forkOf: null });

const rockHat = "*2";

export const STARTERS: GrooveInput[] = [
  // ---- rock / pop ----
  g("Basic Rock Beat", 100, "beginner", ["rock"], ["hihat", "snare"], "The classic: eighth notes on the hi-hat, kick on 1 and 3, snare on 2 and 4.", [
    bar({ hhClosed: rockHat, kick: "0 8", snare: "4:3 12:3" }),
  ]),
  g("Rock Beat with Syncopated Kick", 105, "beginner", ["rock"], ["kick", "hihat"], "Eighth-note hi-hat with an extra kick on the 'and' of 2.", [
    bar({ hhClosed: rockHat, kick: "0 6 8", snare: "4:3 12:3" }),
  ]),
  g("Half-Time Rock Beat", 80, "beginner", ["rock"], ["snare", "timing"], "The snare lands on beat 3 only, which makes the groove feel twice as slow.", [
    bar({ hhClosed: rockHat, kick: "0 10", snare: "8:3" }),
  ]),
  g("16th-Note Hi-Hat Rock", 90, "intermediate", ["rock", "pop"], ["hihat", "dynamics"], "Sixteenth notes on the hi-hat with soft notes between the accented ones.", [
    bar({ hhClosed: "*1:1 *2:2 *4:3", kick: "0 8", snare: "4:3 12:3" }),
  ]),
  g("Rock Groove with Fill", 100, "intermediate", ["rock", "fill"], ["fills", "tomPatterns"], "Three bars of rock beat, then a tom fill into the crash.", [
    bar({ crash: "0:3", hhClosed: "2 4 6 8 10 12 14", kick: "0 8", snare: "4:3 12:3" }),
    bar({ hhClosed: rockHat, kick: "0 8", snare: "4:3 12:3" }),
    bar({ hhClosed: rockHat, kick: "0 8", snare: "4:3 12:3" }),
    bar({ hhClosed: "*2", kick: "0", snare: "4:3 8 10", tomHigh: "12", tomMid: "13", tomLow: "14" }),
  ]),
  g("Pop Rock with Open Hi-Hat", 110, "intermediate", ["pop", "rock"], ["openHihat", "hihat"], "Backbeat with an open hi-hat on the 'and' of 4.", [
    bar({ hhClosed: "0 2 4 6 8 10 12", hhOpen: "14", kick: "0 8 10", snare: "4:3 12:3" }),
  ]),
  g("Disco Beat (Four on the Floor)", 120, "beginner", ["pop"], ["feet", "openHihat"], "Kick on every beat, open hi-hat on the offbeats, snare on 2 and 4.", [
    bar({ hhClosed: "0 4 8 12", hhOpen: "2 6 10 14", kick: "0 4 8 12", snare: "4:3 12:3" }),
  ]),
  g("Pop Ballad with Side Stick", 70, "beginner", ["pop"], ["dynamics", "timing"], "Slow eighth-note hi-hat with side stick on 2 and 4.", [
    bar({ hhClosed: "*2:1 *4:2", kick: "0 10", sidestick: "4:2 12:2" }),
  ]),
  g("Bo Diddley Beat", 110, "intermediate", ["rock", "blues"], ["tomPatterns", "independence"], "The 3-2 clave rhythm on the floor tom over a steady hi-hat.", [
    bar({ tomLow: "0 3 6 10 12", hhClosed: rockHat, kick: "0 8" }),
  ]),
  g("6/8 Rock Groove", 70, "intermediate", ["rock", "oddMeter"], ["timing", "hihat"], "Compound time: two groups of three eighths, kick on 1, snare on 4.", [
    bar({ hhClosed: "0 2 4 6 8 10", kick: "0", snare: "6:3" }, 6, 8),
  ]),

  // ---- metal ----
  g("Double Bass Metal Groove", 170, "advanced", ["metal"], ["doubleKick", "speed", "endurance"], "Sixteenth-note double kick under a steady snare backbeat.", [
    bar({ hhClosed: rockHat, kick: "*1", snare: "4:3 12:3", crash: "0:3" }),
    bar({ hhClosed: rockHat, kick: "*1", snare: "4:3 12:3" }),
  ]),
  g("Metal Gallop", 160, "intermediate", ["metal"], ["kick", "speed"], "The gallop: an eighth and two sixteenths on the kick, again and again.", [
    bar({ hhClosed: rockHat, kick: "0 2 3 4 6 7 8 10 11 12 14 15", snare: "4:3 12:3" }),
  ]),
  g("Blast Beat", 180, "advanced", ["metal"], ["speed", "endurance"], "Kick and snare alternate on sixteenths while the ride keeps playing.", [
    bar({ ride: "*1", kick: "*2", snare: "1 3 5 7 9 11 13 15" }),
  ]),
  g("Half-Time Breakdown", 90, "intermediate", ["metal"], ["kick", "doubleKick"], "Heavy half-time feel: snare on 3, kick in short bursts, china on the beat.", [
    bar({ china: "0:3 4 8 12", kick: "0 2 3 6 10 11", snare: "8:3" }),
  ]),

  // ---- jazz / blues ----
  g("Jazz Swing Ride Pattern", 130, "intermediate", ["jazz", "shuffle"], ["ride", "independence"], "The 'spang-a-lang': ride on every beat plus the swung skip note, hi-hat foot on 2 and 4.", [
    trip({ ride: "0 3 5 6 9 11", hhPedal: "3 9", kick: "0:1 3:1 6:1 9:1" }),
  ]),
  g("Jazz Waltz", 140, "intermediate", ["jazz", "oddMeter"], ["ride", "timing"], "Swing ride pattern in 3/4 with the hi-hat foot on 2 and 3.", [
    bar({ ride: "0 3 5 6 8", hhPedal: "3 6", kick: "0:1" }, 3, 4, true),
  ]),
  g("Blues Shuffle", 100, "beginner", ["blues", "shuffle"], ["timing", "hihat"], "Triplet feel: hi-hat on the first and third triplet, snare on 2 and 4.", [
    trip({ hhClosed: "0 2 3 5 6 8 9 11", kick: "0 6", snare: "3:3 9:3" }),
  ]),
  g("12/8 Slow Blues", 60, "intermediate", ["blues", "oddMeter"], ["timing", "dynamics"], "Slow 12/8 feel (four beats of three): every eighth on the hi-hat, snare on 2 and 4.", [
    trip({ hhClosed: "*1:1 *3:2", kick: "0 6", snare: "3:3 9:3" }),
  ]),

  // ---- funk ----
  g("16th Funk Groove", 92, "intermediate", ["funk"], ["ghostNotes", "hihat"], "Sixteenth-note hi-hat with ghost notes around the snare backbeat.", [
    bar({ hhClosed: "*1", kick: "0:3 6 10", snare: "4:3 7:1 9:1 12:3 15:1" }),
  ]),
  g("Linear Funk Groove", 95, "advanced", ["funk"], ["linear", "ghostNotes", "independence"], "No two limbs hit at the same time: kick, snare and hi-hat share the sixteenths.", [
    bar({ kick: "0 6 10 14", snare: "3:1 4:3 9:1 12:3", hhClosed: "1 2 5 7 8 11 13 15" }),
  ]),
  g("Half-Time Shuffle", 90, "advanced", ["funk", "shuffle"], ["ghostNotes", "timing", "independence"], "Shuffle hi-hat with the backbeat on 3, softly filled with ghost notes.", [
    trip({ hhClosed: "0 2 3 5 6 8 9 11", kick: "0 7", snare: "6:3 2:1 8:1" }),
  ]),

  // ---- latin ----
  g("Bossa Nova", 130, "intermediate", ["latin", "jazz"], ["independence", "timing"], "Straight hi-hat eighths, side-stick bossa clave and the typical 'boom-boom' bass drum.", [
    bar({ hhClosed: rockHat, sidestick: "0 3 6 10 13", kick: "0 6 8 14", hhPedal: "4 12" }),
  ]),
  g("Samba", 100, "advanced", ["latin"], ["independence", "hihat", "timing"], "Samba on the drum set in 2/4: steady sixteenth hi-hat like a shaker, bass drum on the beat plus the 'a' (surdo feel), hi-hat foot on the beats.", [
    bar({ hhClosed: "*1:1 *2:2", kick: "0 3 4 7", hhPedal: "0 4" }, 2, 4),
  ]),
  g("Son Clave 3-2 Groove", 110, "advanced", ["latin"], ["independence", "timing"], "Son clave 3-2 on the side stick with a simple foot pattern and cowbell quarters.", [
    bar({ sidestick: "0 3 6 10 12", rideBell: "0 4 8 12", hhPedal: "4 12", kick: "0 8" }),
  ]),
  g("Afro-Cuban 6/8", 100, "advanced", ["latin", "oddMeter"], ["polyrhythm", "independence"], "The standard 12/8 bell pattern with hi-hat foot and a two-feel kick.", [
    trip({ rideBell: "0 2 4 5 7 9 11", hhPedal: "3 9", kick: "0 6" }),
  ]),
  g("Reggaeton Dembow", 95, "beginner", ["latin", "hiphop"], ["kick", "snare"], "Kick on every beat with the typical 3-3-2 snare rhythm.", [
    bar({ kick: "0 4 8 12", snare: "3:3 6:3 11:3 14:3", hhClosed: rockHat }),
  ]),

  // ---- hip-hop / reggae ----
  g("Boom Bap Beat", 90, "beginner", ["hiphop"], ["kick", "snare"], "Old-school hip-hop: laid-back kick pattern, snare on 2 and 4.", [
    bar({ hhClosed: rockHat, kick: "0 10", snare: "4:3 12:3" }),
    bar({ hhClosed: rockHat, kick: "0 7 10", snare: "4:3 12:3" }),
  ]),
  g("Trap Beat", 140, "intermediate", ["hiphop"], ["hihat", "speed"], "Half-time snare on 3 with a hi-hat roll at the end of the bar.", [
    bar({ hhClosed: "0 2 4 6 8 10 12 13 14 15", kick: "0 10", snare: "8:3" }),
  ]),
  g("Reggae One Drop", 75, "beginner", ["reggae"], ["timing", "feet"], "Beat 1 is left empty: kick and rim shot land together on beat 3.", [
    bar({ hhClosed: rockHat, kick: "8", sidestick: "8" }),
  ]),
  g("Reggae Steppers", 85, "intermediate", ["reggae"], ["feet", "timing"], "Kick on every beat, rim shot on 3, hi-hat eighths.", [
    bar({ hhClosed: rockHat, kick: "0 4 8 12", sidestick: "8" }),
  ]),

  // ---- odd meter / fills ----
  g("5/4 Groove (3+2)", 120, "advanced", ["oddMeter", "rock"], ["timing", "independence"], "Five beats grouped as 3+2: kick on the start of each group.", [
    bar({ hhClosed: rockHat, kick: "0 12", snare: "8:3 16:3" }, 5, 4),
  ]),
  g("7/8 Groove (2+2+3)", 130, "advanced", ["oddMeter"], ["timing", "accents"], "Seven eighths grouped 2+2+3 with accents on the group starts.", [
    bar({ hhClosed: "0:3 2 4:3 6 8:3 10 12", kick: "0 8", snare: "4" }, 7, 8),
  ]),
  g("Seven Four Ride", 110, "advanced", ["oddMeter", "jazz"], ["feet", "timing"], "Odd 7/4 meter with ride quarters, kick on 1 and snare on 3 and 5.", [
    bar({ ride: "*4", kick: "0:3 12 20", snare: "8:3 16:3" }, 7, 4),
  ]),
  g("Basic Tom Fill", 100, "beginner", ["fill"], ["fills", "tomPatterns"], "A one-bar fill: snare backbeat, then toms running down into the next downbeat.", [
    bar({ hhClosed: "0 2 4 6", kick: "0", snare: "4:3 8 9", tomHigh: "10 11", tomMid: "12 13", tomLow: "14 15" }),
  ]),
];

/** Inserts the starter grooves once per database (a marker row keeps admin deletions deleted). */
export async function seedStarters(db: Db) {
  const done = await db.query("select 1 from app_state where key = 'starters'");
  if (done[0]) return;
  for (const raw of STARTERS) {
    const s = grooveInputSchema.parse(raw);
    await db.query(
      `insert into grooves (id,title,author,description,tags,difficulty,focus,bpm,bars,bar_count,owner_hash)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9::jsonb,$10,$11)`,
      [randomBytes(5).toString("base64url"), s.title, s.author, s.description, JSON.stringify(s.tags), s.difficulty, JSON.stringify(s.focus), s.bpm, JSON.stringify(s.bars), s.bars.length, randomBytes(32).toString("hex")],
    );
  }
  await db.query("insert into app_state (key, value) values ('starters', '1')");
}
