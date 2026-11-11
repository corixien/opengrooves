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

  it("builds ordered events with a closing mark", () => {
    const b = setLevel(emptyBar(2), "kick", 0, 2);
    const { events, length } = buildEvents([b, b], 1);
    expect(length).toBe(4);
    expect(events[events.length - 1]).toEqual({ beat: 4, kind: "mark" });
    expect(events.filter((e) => e.kind === "note")).toHaveLength(2);
    expect(events.filter((e) => e.kind === "click")).toHaveLength(4);
  });
});
