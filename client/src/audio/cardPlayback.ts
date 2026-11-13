import type { Groove } from "../../../shared/groove";
import { store } from "../storage";
import { DEFAULT_SETTINGS, engine } from "./engine";
import { toggle } from "./playback";
import "./playCount";

export const getCardPosition = () => engine.getPosition();

/** List preview: the shared volume, no metronome, looped. A second press pauses / resumes. */
export async function toggleCard(g: Groove) {
  if (engine.grooveId === g.id && (engine.playing || engine.paused)) return toggle();
  engine.stop();
  engine.settings = { ...DEFAULT_SETTINGS, ...store.getVolume(), bpm: g.bpm, metroOn: false };
  engine.setBars(g.bars);
  engine.grooveId = g.id;
  try {
    await engine.start();
  } catch {
    /* sounds failed to load; the button just stays in its idle state */
  }
}
