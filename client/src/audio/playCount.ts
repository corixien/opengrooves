import { useRef, useSyncExternalStore } from "react";
import { api } from "../api";
import { engine } from "./engine";

/** Full play-throughs counted in this session, so counters update before the next fetch. */
const bumps = new Map<string, number>();
const subs = new Set<() => void>();

engine.onFullPass = (id) => {
  bumps.set(id, (bumps.get(id) ?? 0) + 1);
  subs.forEach((f) => f());
  api.play(id).catch(() => {});
};

/** `base` (from the server at load time) plus the plays counted since this component appeared. */
export function usePlays(id: string, base: number): number {
  const baseline = useRef(bumps.get(id) ?? 0);
  const now = useSyncExternalStore(
    (cb) => (subs.add(cb), () => void subs.delete(cb)),
    () => bumps.get(id) ?? 0,
  );
  return base + now - baseline.current;
}
