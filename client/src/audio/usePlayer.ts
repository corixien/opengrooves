import { useCallback, useEffect, useState } from "react";
import type { Bar } from "../../../shared/groove";
import { store } from "../storage";
import { engine, type PlayerSettings } from "./engine";

export type PlayerState = ReturnType<typeof usePlayer>;

export function usePlayer(bars: Bar[], bpm: number) {
  const [settings, setSettings] = useState<Omit<PlayerSettings, "bpm">>(() => {
    const { bpm: _bpm, ...rest } = engine.settings;
    return { ...rest, ...store.getPlayer() };
  });
  const [playing, setPlaying] = useState(false);
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
    engine.load().then(
      () => alive && setStatus("ready"),
      () => alive && setStatus("error"),
    );
    engine.onEnd = () => setPlaying(false);
    return () => {
      alive = false;
      engine.onEnd = null;
      engine.stop();
    };
  }, []);

  const start = useCallback(async () => {
    engine.settings = { ...settings, bpm };
    engine.setBars(bars);
    try {
      await engine.start();
      setPlaying(engine.playing);
    } catch {
      setStatus("error");
    }
  }, [settings, bpm, bars]);

  const stop = useCallback(() => {
    engine.stop();
    setPlaying(false);
  }, []);

  const getPosition = useCallback(() => engine.getPosition(), []);
  const update = useCallback((patch: Partial<Omit<PlayerSettings, "bpm">>) => setSettings((s) => ({ ...s, ...patch })), []);

  return { settings, update, playing, status, start, stop, getPosition };
}
