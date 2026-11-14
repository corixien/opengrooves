import type { Groove } from "../../../shared/groove";
import { store } from "../storage";
import { DEFAULT_SETTINGS, engine } from "./engine";
import { toggle } from "./playback";
import "./playCount";

export const getCardPosition = () => engine.getPosition();

/** List preview from the beginning: the shared volume, no metronome, looped. */
export async function playCard(g: Groove) {
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

/** Pauses a playing card or continues a paused one from where it stopped. */
export const pauseCard = toggle;
