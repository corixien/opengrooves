import { useEffect, useRef, useState } from "react";
import { MAX_BPM, MIN_BPM } from "../../../shared/groove";

const clamp = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

/** Free text entry (commits on blur/Enter, applies live while the number is valid); optional -/+ buttons that repeat while held. */
export function BpmInput({ value, onChange, stepper = false }: { value: number; onChange: (bpm: number) => void; stepper?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cur = useRef(value);
  cur.current = value;
  const timer = useRef<number>(0);
  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
  };
  useEffect(() => stop, []);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
    setDraft(null);
  };
  const step = (d: number) => {
    setDraft(null);
    onChange(clamp(cur.current + d));
  };
  const hold = (d: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    stop();
    step(d);
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => step(d), 70);
    }, 400);
  };
  const btn = (d: number, label: string, text: string) => (
    <button
      type="button"
      className="btn small"
      aria-label={label}
      onPointerDown={hold(d)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !e.repeat && (e.preventDefault(), step(d))}
      onContextMenu={(e) => e.preventDefault()}
    >
      {text}
    </button>
  );

  const input = (
    <input
      type="text"
      inputMode="numeric"
      value={draft ?? String(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 3);
        setDraft(v);
        const n = Number(v);
        if (v !== "" && n >= MIN_BPM && n <= MAX_BPM) onChange(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          step(e.key === "ArrowUp" ? 1 : -1);
        }
      }}
    />
  );
  return stepper ? (
    <div className="tempo-row">
      {btn(-1, "-1", "−")}
      {input}
      {btn(1, "+1", "+")}
    </div>
  ) : (
    input
  );
}
