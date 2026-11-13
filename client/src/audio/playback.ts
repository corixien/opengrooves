import { useEffect, useSyncExternalStore } from "react";
import { engine } from "./engine";

/** Global transport: works on every page, on whatever the engine currently holds. */
const DOUBLE_TAP_MS = 350;
let lastTap = 0;

const run = (p: Promise<void>) => void p.catch(() => {});

export function toggle() {
  if (engine.playing) engine.pause();
  else if (engine.hasBars) run(engine.start(engine.resumeAt));
}

export function restart() {
  if (!engine.hasBars) return;
  engine.stop();
  run(engine.start(0));
}

/** Play/pause button and Space: a quick second press starts over. */
export function tap() {
  const now = performance.now();
  if (now - lastTap < DOUBLE_TAP_MS) {
    lastTap = 0;
    restart();
  } else {
    lastTap = now;
    toggle();
  }
}

export function usePlayback() {
  useSyncExternalStore(engine.subscribe, () => engine.rev);
  return { playing: engine.playing, paused: engine.paused && engine.resumeAt > 0, active: engine.playing || engine.paused, grooveId: engine.grooveId };
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    !!el.closest(".select") ||
    (el instanceof HTMLInputElement && !["checkbox", "radio", "range", "button"].includes(el.type)));

/** Space anywhere except in text fields and dropdowns toggles playback. */
export function useSpaceHotkey() {
  useEffect(() => {
    const handled = (e: KeyboardEvent) => e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target);
    const down = (e: KeyboardEvent) => {
      if (!handled(e)) return;
      e.preventDefault();
      if (!e.repeat) tap();
    };
    const up = (e: KeyboardEvent) => handled(e) && e.preventDefault(); // a focused button must not also "click"
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
}
