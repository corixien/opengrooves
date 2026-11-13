import { useCallback, useEffect, useState } from "react";
import type { Bar } from "../../../shared/groove";
import { store } from "../storage";
import { DEFAULT_SETTINGS, engine, type PlayerSettings } from "./engine";
import { tap, usePlayback } from "./playback";
import "./playCount";

export type PlayerState = ReturnType<typeof usePlayer>;

/**
 * Player of one page. Only the volumes are remembered across grooves; everything else starts
 * from the defaults. `grooveId` is null in the editor (the draft stops when leaving). A groove
 * keeps playing when its page is left; opening the page of the groove that is playing adopts it.
 */
export function usePlayer(bars: Bar[], bpm: number, grooveId: string | null = null) {
  const [settings, setSettings] = useState<Omit<PlayerSettings, "bpm">>(() => {
    const { bpm: _bpm, ...rest } = DEFAULT_SETTINGS;
    return { ...rest, ...store.getVolume() };
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const pb = usePlayback();
  const mine = pb.grooveId === grooveId;

  useEffect(() => {
    engine.settings = { ...settings, bpm };
  }, [settings, bpm]);

  useEffect(() => {
    store.setVolume({ grooveVol: settings.grooveVol, metroVol: settings.metroVol });
  }, [settings.grooveVol, settings.metroVol]);

  useEffect(() => {
    engine.setBars(bars);
  }, [bars]);

  useEffect(() => {
    const adopt = grooveId !== null && engine.grooveId === grooveId && (engine.playing || engine.paused);
    if (!adopt) engine.stop();
    engine.grooveId = grooveId;
    engine.setBars(bars);
    let alive = true;
    engine.load().then(
      () => alive && setStatus("ready"),
      () => alive && setStatus("error"),
    );
    return () => {
      alive = false;
      if (grooveId === null) engine.stop();
    };
  }, [grooveId]);

  const stop = useCallback(() => engine.stop(), []);
  const seek = useCallback((pos: number) => {
    engine.seek(pos);
  }, []);
  const getPosition = useCallback(() => engine.getPosition(), []);
  const update = useCallback((patch: Partial<Omit<PlayerSettings, "bpm">>) => setSettings((s) => ({ ...s, ...patch })), []);

  return {
    settings,
    update,
    playing: mine && pb.playing,
    paused: mine && pb.paused,
    active: mine && pb.active,
    status,
    tap,
    stop,
    seek,
    getPosition,
  };
}
