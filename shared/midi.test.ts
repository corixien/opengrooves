import { describe, expect, it } from "vitest";
import { emptyBar, getLevel, setLevel } from "./groove.ts";
import { locateStep, midiToBars, parseMidi } from "./midi.ts";

const vlq = (n: number) => (n < 128 ? [n] : [0x80 | (n >> 7), n & 0x7f]);
/** Format-0 file, 480 ppq, 120 bpm, 4/4, drum channel. */
function file(events: [number, number, number][]): Uint8Array {
  const body: number[] = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xff, 0x58, 4, 4, 2, 24, 8];
  let last = 0;
  for (const [tick, note, vel] of events) body.push(...vlq(tick - last), 0x99, note, vel), (last = tick);
  body.push(0, 0xff, 0x2f, 0);
  const hd = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0];
  const len = body.length;
  return new Uint8Array([...hd, 0x4d, 0x54, 0x72, 0x6b, 0, 0, len >> 8, len & 0xff, ...body]);
}

describe("midi", () => {
  it("imports a drum file into quantized bars", () => {
    // kick on 1, snare on 2 (accent), hat at an off-grid 16th (slightly late), second bar: one kick
    const m = midiToBars(parseMidi(file([[0, 36, 90], [1, 99, 90], [240 + 10, 42, 60], [480, 38, 120], [1920, 36, 90]])));
    expect(m.bpm).toBe(120);
    expect(m.bars).toHaveLength(2);
    expect(getLevel(m.bars[0], "kick", 0)).toBe(2);
    expect(getLevel(m.bars[0], "snare", 4)).toBe(3);
    expect(getLevel(m.bars[0], "hhClosed", 2)).toBe(2);
    expect(getLevel(m.bars[1], "kick", 0)).toBe(2);
    expect(m.dropped).toBe(1); // unmapped note 99
  });

  it("picks a triplet grid when the notes sit on thirds", () => {
    const m = midiToBars(parseMidi(file([0, 160, 320, 480, 640, 800].map((t) => [t, 42, 80] as [number, number, number]))));
    expect(m.bars[0].triplet).toBe(true);
  });

  it("quantizes live positions", () => {
    const bars = [emptyBar(), emptyBar()];
    expect(locateStep(bars, 0.26, "step")).toEqual({ bar: 0, step: 1 });
    expect(locateStep(bars, 0.6, "quarter")).toEqual({ bar: 0, step: 4 });
    expect(locateStep(bars, 3.9, "eighth")).toEqual({ bar: 1, step: 0 }); // rounds across the bar line
    expect(locateStep([setLevel(emptyBar(), "kick", 0, 2)], 3.95, "step")).toEqual({ bar: 0, step: 0 }); // wraps in the loop
  });
});
