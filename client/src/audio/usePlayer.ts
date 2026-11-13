import { useCallback, useEffect, useRef, useState } from "react";
import type { Bar } from "../../../shared/groove";
import { store } from "../storage";
import { releaseCard } from "./cardPlayback";
import { engine, type PlayerSettings } from "./engine";
import "./playCount";

export type PlayerState = ReturnType<typeof usePlayer>;

const DOUBLE_TAP_MS = 350;
let stopTimer: number | undefined;

/** `grooveId`: the groove being shown (counts plays; lets a list preview of it keep playing). */
export function usePlayer(bars: Bar[], bpm: number, grooveId: string | null = null) {
  const [settings, setSettings] = useState<Omit<PlayerSettings, "bpm">>(() => {
    const { bpm: _bpm, ...rest } = engine.settings;
    return { ...rest, ...store.getPlayer() };
  });
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    engine.settings = { ...settings, bpm };
    store.setPlayer(settings);
  }, [settings, bpm]);

  useEffect(() => {
    engine.setBars(bars);
  }, [bars]);

  useEffect(() => {
    let alive = true;
    window.clearTimeout(stopTimer); // StrictMode remount / handover from the previous page
    if (grooveId && engine.playing && engine.grooveId === grooveId) setPlaying(true); // keep playing what the list started
    else engine.stop();
    releaseCard();
    engine.grooveId = grooveId;
    engine.load().then(
      () => alive && setStatus("ready"),
      () => alive && setStatus("error"),
    );
    engine.onEnd = () => {
      setPlaying(false);
      setPaused(false);
    };
    return () => {
      alive = false;
      engine.onEnd = null;
      // deferred so a remount in the same tick (StrictMode) does not cut the sound
      stopTimer = window.setTimeout(() => engine.stop(), 0);
    };
  }, [grooveId]);

  const sync = () => {
    setPlaying(engine.playing);
    setPaused(engine.paused);
  };

  const play = useCallback(
    async (from: number) => {
      engine.settings = { ...settings, bpm };
      engine.setBars(bars);
      try {
        await engine.start(from);
        sync();
      } catch {
        setStatus("error");
      }
    },
    [settings, bpm, bars],
  );

  const pause = useCallback(() => {
    engine.pause();
    sync();
  }, []);

  const stop = useCallback(() => {
    engine.stop();
    sync();
  }, []);

  /** Play / pause at the current position. */
  const toggle = useCallback(() => (engine.playing ? pause() : void play(engine.resumeAt)), [play, pause]);
  /** From the beginning. */
  const restart = useCallback(() => {
    engine.stop();
    void play(0);
  }, [play]);
  /** Play/pause button and Space: a quick second press starts over. */
  const lastTap = useRef(0);
  const tap = useCallback(() => {
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      restart();
    } else {
      lastTap.current = now;
      toggle();
    }
  }, [toggle, restart]);
  const seek = useCallback(
    (pos: number) => {
      engine.settings = { ...settings, bpm };
      engine.setBars(bars);
      engine.seek(pos);
      sync();
    },
    [settings, bpm, bars],
  );

  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    const textual = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && !["checkbox", "radio", "range", "button"].includes(el.type)));
    const handled = (e: KeyboardEvent) => e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey && !textual(e.target);
    const down = (e: KeyboardEvent) => {
      if (!handled(e)) return;
      e.preventDefault();
      if (!e.repeat) tapRef.current();
    };
    const up = (e: KeyboardEvent) => handled(e) && e.preventDefault(); // stops a focused button from also "clicking"
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const getPosition = useCallback(() => engine.getPosition(), []);
  const update = useCallback((patch: Partial<Omit<PlayerSettings, "bpm">>) => setSettings((s) => ({ ...s, ...patch })), []);

  return { settings, update, playing, paused, active: playing || paused, status, tap, stop, seek, getPosition };
}
