// Seeds a few demo grooves into the running local API (npm run dev). Usage: npx tsx scripts/seed.ts
import { emptyBar, resizeBar, setLevel, stepCount, type Bar, type Instrument, type Level } from "../shared/groove.ts";

const API = process.env.API ?? "http://localhost:3001/api";

function bar(beats: number, hits: Partial<Record<Instrument, Record<number, Level>>>, triplet = false): Bar {
  let b = resizeBar(emptyBar(4), beats, triplet);
  for (const [inst, steps] of Object.entries(hits) as [Instrument, Record<number, Level>][])
    for (const [s, l] of Object.entries(steps)) b = setLevel(b, inst, Number(s), l);
  return b;
}
const every = (n: number, total: number, l: Level = 2, from = 0) =>
  Object.fromEntries(Array.from({ length: Math.ceil((total - from) / n) }, (_, i) => [from + i * n, l]));

const rock = bar(4, { hhClosed: every(2, 16), kick: { 0: 2, 8: 2 }, snare: { 4: 3, 12: 3 } });
const rockFill = bar(4, { hhClosed: every(2, 8), kick: { 0: 2 }, snare: { 4: 3, 8: 2, 10: 2 }, tomHigh: { 12: 2 }, tomMid: { 13: 2 }, tomLow: { 14: 2 }, crash: { 15: 3 } });
const funk = bar(4, {
  hhClosed: every(1, 16, 2),
  kick: { 0: 3, 6: 2, 10: 2 },
  snare: { 4: 3, 12: 3, 7: 1, 9: 1, 15: 1 },
});
const shuffle = bar(4, { ride: { 0: 2, 2: 2, 3: 2, 5: 2, 6: 2, 8: 2, 9: 2, 11: 2 }, kick: { 0: 2, 6: 2 }, snare: { 3: 3, 9: 3 } }, true);
const sevenFour = bar(7, { ride: every(4, 28, 2), kick: { 0: 3, 12: 2, 20: 2 }, snare: { 8: 3, 16: 3 } });

const grooves = [
  { title: "Basic Rock Beat", author: "Mateo", difficulty: "beginner", bpm: 100, tags: ["rock"], focus: ["hihat", "snare"], description: "Der Klassiker: Achtel auf der Hihat, Kick auf 1 und 3, Snare auf 2 und 4.", bars: [rock, rock, rock, rockFill] },
  { title: "16th Funk Groove", author: "", difficulty: "intermediate", bpm: 92, tags: ["funk"], focus: ["ghostNotes", "hihat"], description: "16tel-Hihat mit Ghost Notes auf der Snare.", bars: [funk, funk] },
  { title: "Triplet Shuffle", author: "Sam", difficulty: "intermediate", bpm: 88, tags: ["shuffle", "blues"], focus: ["timing"], description: "", bars: [shuffle, shuffle] },
  { title: "Seven Four Ride", author: "Alex", difficulty: "advanced", bpm: 110, tags: ["oddMeter", "jazz"], focus: ["feet", "timing"], description: "Ungerader 7/4-Takt.", bars: [sevenFour, sevenFour] },
];

for (const g of grooves.filter((x) => !process.env.ONLY || x.title.includes(process.env.ONLY))) {
  const r = await fetch(`${API}/grooves`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(g) });
  console.log(g.title, r.status, stepCount(g.bars[0]));
}
