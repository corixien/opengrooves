import { describe, expect, it } from "vitest";
import { buildEvents } from "../client/src/audio/engine.ts";
import { barSchema, emptyBar, getLevel, resizeBar, setLevel, stepCount } from "./groove.ts";

describe("groove model", () => {
  it("sets and clears cells, dropping empty rows", () => {
    let b = setLevel(emptyBar(), "kick", 4, 3);
    expect(getLevel(b, "kick", 4)).toBe(3);
    b = setLevel(b, "kick", 4, 0);
    expect(b.rows).toEqual({});
  });

  it("resizes keeping beat-aligned notes and validates", () => {
    let b = setLevel(setLevel(emptyBar(4), "snare", 4, 2), "snare", 5, 2);
    const tri = resizeBar(b, 3, true);
    expect(stepCount(tri)).toBe(9);
    expect(tri.rows.snare).toBe("---2-----");
    expect(barSchema.safeParse(tri).success).toBe(true);
    expect(barSchema.safeParse({ ...tri, beats: 9 }).success).toBe(false);
  });

  it("supports other time signatures", () => {
    const six8 = emptyBar(6, false, 8);
    expect(stepCount(six8)).toBe(12); // 3 quarters * 4
    expect(barSchema.safeParse(six8).success).toBe(true);
    expect(barSchema.safeParse({ ...emptyBar(17, false, 8) }).success).toBe(false);
    expect(barSchema.safeParse({ ...emptyBar(9, false, 4) }).success).toBe(false);
    expect(barSchema.safeParse({ ...emptyBar(4, true, 8) }).success).toBe(false);
    expect(barSchema.safeParse({ beats: 4, triplet: false, rows: {} }).data?.den).toBe(4);
    const kicked = setLevel(six8, "kick", 4, 2);
    const wide = resizeBar(kicked, 3, false, 4); // 3/4 -> 12 steps, same grid
    expect(wide.rows.kick?.[4]).toBe("2");
    expect(resizeBar(setLevel(emptyBar(4), "kick", 4, 2), 2, true).rows.kick).toBe("---2--");
    const { length } = buildEvents([emptyBar(3, false, 16), emptyBar(2, false, 2)], 1);
    expect(length).toBe(0.75 + 4);
  });

  it("builds ordered events with a closing mark", () => {
    const b = setLevel(emptyBar(2), "kick", 0, 2);
    const { events, length } = buildEvents([b, b], 1);
    expect(length).toBe(4);
    expect(events[events.length - 1]).toEqual({ beat: 4, kind: "mark" });
    expect(events.filter((e) => e.kind === "note")).toHaveLength(2);
    expect(events.filter((e) => e.kind === "click")).toHaveLength(4);
  });
});
