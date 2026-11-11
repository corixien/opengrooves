import { useSyncExternalStore } from "react";
import type { Groove } from "../../../shared/groove";
import { engine } from "./engine";

/** One-at-a-time preview playback for the groove list: default volume, no metronome, looped. */
let current: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const getCardPosition = () => engine.getPosition();

export function useCardPlaying(): string | null {
  return useSyncExternalStore(
    (cb) => (subs.add(cb), () => void subs.delete(cb)),
    () => current,
  );
}

export function stopCard() {
  if (current === null) return;
  engine.stop();
  current = null;
  emit();
}

export async function toggleCard(g: Groove) {
  if (current === g.id) return stopCard();
  engine.stop();
  engine.settings = {
    bpm: g.bpm,
    grooveOn: true,
    grooveVol: 0.9,
    metroOn: false,
    metroVol: 0.5,
    metroUnit: 1,
    countIn: false,
    loop: true,
  };
  engine.setBars(g.bars);
  current = g.id;
  emit();
  try {
    await engine.start();
  } catch {
    if (current === g.id) {
      current = null;
      emit();
    }
  }
}
