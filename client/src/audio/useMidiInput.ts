import { useCallback, useEffect, useRef, useState } from "react";

export type MidiStatus = "off" | "on" | "denied" | "unsupported";

/** Web MIDI: listens on all inputs once enabled. onNote(note, velocity, lagMs since the key was pressed). */
export function useMidiInput(onNote: (note: number, velocity: number, lagMs: number) => void) {
  const cb = useRef(onNote);
  cb.current = onNote;
  const access = useRef<MIDIAccess | null>(null);
  const [status, setStatus] = useState<MidiStatus>(typeof navigator !== "undefined" && "requestMIDIAccess" in navigator ? "off" : "unsupported");
  const [inputs, setInputs] = useState<string[]>([]);

  const attach = useCallback(() => {
    const a = access.current;
    if (!a) return;
    const names: string[] = [];
    a.inputs.forEach((input) => {
      names.push(input.name ?? input.id);
      input.onmidimessage = (e) => {
        const d = e.data;
        if (d && (d[0] & 0xf0) === 0x90 && d[2] > 0) cb.current(d[1], d[2], Math.max(0, performance.now() - e.timeStamp));
      };
    });
    setInputs(names);
  }, []);

  const connect = useCallback(async () => {
    try {
      access.current = await navigator.requestMIDIAccess();
      access.current.onstatechange = attach;
      attach();
      setStatus("on");
    } catch {
      setStatus("denied");
    }
  }, [attach]);

  useEffect(
    () => () => {
      access.current?.inputs.forEach((i) => (i.onmidimessage = null));
      if (access.current) access.current.onstatechange = null;
    },
    [],
  );

  return { status, inputs, connect };
}
