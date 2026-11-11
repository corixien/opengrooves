import { memo, useEffect, useRef, type ReactNode } from "react";
import {
  INSTRUMENTS,
  getLevel,
  setLevel,
  stepCount,
  stepsPerBeat,
  type Bar,
  type Instrument,
  type Level,
} from "../../../shared/groove";
import { useI18n } from "../i18n";

// ---------- notation geometry (SVG units) ----------
const PAD = 16;
const BEAT_W = 72;
const H = 104;
const LINE_Y0 = 70; // y of bottom staff line (E4)
const barWidth = (bar: Bar) => PAD * 2 + bar.beats * BEAT_W;

/** Diatonic step above the bottom staff line and head style per instrument. */
const NOTE: Record<Instrument, { step: number; head: "x" | "o" | "xo" }> = {
  crash: { step: 10, head: "x" },
  ride: { step: 8, head: "x" },
  hhOpen: { step: 9, head: "xo" },
  hhClosed: { step: 9, head: "x" },
  tomHigh: { step: 7, head: "o" },
  tomMid: { step: 6, head: "o" },
  tomLow: { step: 3, head: "o" },
  snare: { step: 5, head: "o" },
  kick: { step: 1, head: "o" },
};
const yOf = (step: number) => LINE_Y0 - step * 4;

function NotationContent({ bar, x0 }: { bar: Bar; x0: number }) {
  const spb = stepsPerBeat(bar.triplet);
  const n = stepCount(bar);
  const w = barWidth(bar);
  const xOf = (i: number) => x0 + PAD + ((i + 0.5) / n) * (w - PAD * 2);
  const els: ReactNode[] = [];

  // staff lines + bar lines
  for (let k = 0; k < 5; k++) {
    els.push(<line key={`l${k}`} x1={x0} x2={x0 + w} y1={yOf(k * 2)} y2={yOf(k * 2)} className="staff" />);
  }
  els.push(<line key="b0" x1={x0} x2={x0} y1={yOf(0)} y2={yOf(8)} className="staff" />);
  els.push(<line key="b1" x1={x0 + w} x2={x0 + w} y1={yOf(0)} y2={yOf(8)} className="staff" />);

  // columns
  const handStemTop: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    const x = xOf(i);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const inst of INSTRUMENTS) {
      const level = getLevel(bar, inst, i);
      if (!level) continue;
      const { step, head } = NOTE[inst];
      const y = yOf(step);
      const cls = `note l${level}`;
      if (inst !== "kick") {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (head === "o") {
        els.push(<ellipse key={`${inst}${i}`} cx={x} cy={y} rx={5} ry={3.6} className={cls} transform={`rotate(-18 ${x} ${y})`} />);
      } else {
        els.push(
          <path key={`${inst}${i}`} d={`M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`} className={`${cls} cross`} />,
        );
        if (head === "xo") els.push(<circle key={`${inst}${i}o`} cx={x} cy={y - 9} r={2.6} className={`${cls} ring`} />);
      }
      if (level === 3) els.push(<path key={`${inst}${i}a`} d={`M${x - 4} ${y - 15}L${x + 4} ${y - 12}L${x - 4} ${y - 9}`} className="accent-mark" />);
      if (level === 1) els.push(<text key={`${inst}${i}g`} x={x} y={y + 3.5} className="ghost-paren" textAnchor="middle">{"( )"}</text>);
    }
    if (minY !== Infinity) handStemTop[i] = Math.min(minY - 26, yOf(8) - 4);
    // stems
    if (minY !== Infinity) {
      els.push(<line key={`s${i}`} x1={x + 5} x2={x + 5} y1={maxY} y2={handStemTop[i]} className="stem" data-stem={i} />);
    }
    const kl = getLevel(bar, "kick", i);
    if (kl) {
      const ky = yOf(NOTE.kick.step);
      els.push(<line key={`k${i}`} x1={x - 5} x2={x - 5} y1={ky} y2={ky + 26} className="stem" />);
    }
  }

  // beams for hand notes per beat
  for (let b = 0; b < bar.beats; b++) {
    const cols: number[] = [];
    for (let s = 0; s < spb; s++) if (handStemTop[b * spb + s] !== undefined) cols.push(b * spb + s);
    if (cols.length < 2) continue;
    const top = Math.min(...cols.map((c) => handStemTop[c]));
    // stems were drawn to their own top; extend them to the beam via an overlay line
    for (const c of cols) els.push(<line key={`e${c}`} x1={xOf(c) + 5} x2={xOf(c) + 5} y1={handStemTop[c]} y2={top} className="stem" />);
    els.push(<rect key={`beam${b}`} x={xOf(cols[0]) + 4} y={top} width={xOf(cols[cols.length - 1]) - xOf(cols[0]) + 2} height={3} className="beam" />);
    if (bar.triplet) {
      const mid = (xOf(cols[0]) + xOf(cols[cols.length - 1])) / 2 + 5;
      els.push(<text key={`t${b}`} x={mid} y={top - 4} className="tuplet" textAnchor="middle">3</text>);
    }
  }
  return <g>{els}</g>;
}

export function NotationBar({ bar }: { bar: Bar }) {
  const w = barWidth(bar);
  return (
    <svg className="notation" viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-hidden="true">
      <NotationContent bar={bar} x0={0} />
    </svg>
  );
}

/** First bars in one compact SVG for cards. */
export function NotationPreview({ bars, max = 2 }: { bars: Bar[]; max?: number }) {
  const shown = bars.slice(0, max);
  let x = 0;
  const parts = shown.map((bar, i) => {
    const el = <NotationContent key={i} bar={bar} x0={x} />;
    x += barWidth(bar);
    return el;
  });
  return (
    <svg className="notation preview" viewBox={`0 0 ${x} ${H}`} preserveAspectRatio="xMinYMid meet" role="img" aria-hidden="true">
      {parts}
    </svg>
  );
}

// ---------- grid ----------
/** Click cycle: empty -> normal -> accent -> ghost -> empty. */
const NEXT_LEVEL: Level[] = [2, 0, 3, 1]; // indexed by current level (0 empty, 1 ghost, 2 normal, 3 accent)

interface GridProps {
  bar: Bar;
  editable: boolean;
  onEdit?: (update: (b: Bar) => Bar) => void;
  onHit?: (inst: Instrument, level: Level) => void;
}

const BarGrid = memo(function BarGrid({ bar, editable, onEdit, onHit }: GridProps) {
  const spb = stepsPerBeat(bar.triplet);
  const n = stepCount(bar);
  const paint = useRef<Level | null>(null);

  const apply = (el: Element | null) => {
    const cell = el?.closest<HTMLElement>("[data-cell]");
    if (!cell || paint.current === null || !onEdit) return;
    const inst = cell.dataset.inst as Instrument;
    const step = Number(cell.dataset.step);
    const target = paint.current;
    onEdit((b) => (getLevel(b, inst, step) === target ? b : setLevel(b, inst, step, target)));
    if (target > 0) onHit?.(inst, target);
  };

  const down = (e: React.PointerEvent) => {
    if (!editable || e.button !== 0) return;
    const cell = (e.target as Element).closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    const cur = getLevel(bar, cell.dataset.inst as Instrument, Number(cell.dataset.step));
    paint.current = NEXT_LEVEL[cur];
    apply(cell);
    if (e.pointerType === "mouse") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (paint.current === null || e.pointerType !== "mouse") return;
    apply(document.elementFromPoint(e.clientX, e.clientY));
  };
  const up = () => {
    paint.current = null;
  };

  return (
    <div
      className={`grid${editable ? " editable" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="grid-head">
        {Array.from({ length: bar.beats }, (_, b) => (
          <span key={b} className="beat-num" style={{ width: `calc(var(--cell) * ${spb})` }}>
            {b + 1}
          </span>
        ))}
      </div>
      {INSTRUMENTS.map((inst) => (
        <div key={inst} className="grid-row">
          {Array.from({ length: n }, (_, i) => {
            const level = getLevel(bar, inst, i);
            return (
              <span
                key={i}
                data-cell
                data-inst={inst}
                data-step={i}
                className={`cell${i % spb === 0 ? " beat-start" : ""}${level ? ` l${level}` : ""}`}
              >
                {level ? <i /> : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
});

// ---------- view with playhead ----------
export type ViewMode = "grid" | "notes";

interface ViewProps {
  bars: Bar[];
  mode: ViewMode;
  playing: boolean;
  getPosition: () => number | null;
  editable?: boolean;
  onEdit?: (barIndex: number, update: (b: Bar) => Bar) => void;
  onHit?: (inst: Instrument, level: Level) => void;
  /** Fixed-height controls above each bar (editor). */
  renderHeader?: (barIndex: number) => ReactNode;
  /** Rendered after the last bar inside the scroller (e.g. add-bar button). */
  trailing?: ReactNode;
}

/** Bars side by side in one horizontal scroller; the scroller follows the playhead. */
export function GrooveView({ bars, mode, playing, getPosition, editable = false, onEdit, onHit, renderHeader, trailing }: ViewProps) {
  const { t } = useI18n();
  const heads = useRef<(HTMLElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const barsRef = useRef(bars);
  barsRef.current = bars;

  useEffect(() => {
    const hide = () => heads.current.forEach((h) => h && (h.style.display = "none"));
    if (!playing) {
      hide();
      return;
    }
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const pos = getPosition();
      hide();
      if (pos === null || pos < 0) return;
      let start = 0;
      const bs = barsRef.current;
      for (let i = 0; i < bs.length; i++) {
        const end = start + bs[i].beats;
        if (pos < end || i === bs.length - 1) {
          const frac = Math.min(1, Math.max(0, (pos - start) / bs[i].beats));
          const ph = heads.current[i];
          const sc = scroller.current;
          if (ph) {
            ph.style.display = "block";
            ph.style.left = `calc(var(--label) + var(--w) * ${frac})`;
            if (sc) {
              const x = ph.getBoundingClientRect().left - sc.getBoundingClientRect().left + sc.scrollLeft;
              const target = Math.max(0, x - sc.clientWidth * 0.3);
              if (Math.abs(target - sc.scrollLeft) > 0.5) sc.scrollLeft = target;
            }
          }
          return;
        }
        start = end;
      }
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [playing, getPosition]);

  return (
    <div className={`rhythm ${mode}${renderHeader ? " with-head" : ""}`}>
      {mode === "grid" && (
        <div className="labels" aria-hidden="true">
          {INSTRUMENTS.map((inst) => (
            <span key={inst}>{t(`inst_${inst}`)}</span>
          ))}
        </div>
      )}
      <div className="bars" ref={scroller}>
        {bars.map((bar, i) => {
          const w = mode === "grid" ? `calc(var(--cell) * ${stepCount(bar)})` : `${barWidth(bar) - PAD * 2}px`;
          return (
            <div key={i} className="bar-block">
              {renderHeader ? renderHeader(i) : <span className="bar-no">{i + 1}</span>}
              <div className="bar-inner" style={{ ["--w" as string]: w, ["--label" as string]: mode === "grid" ? "0px" : `${PAD}px` }}>
                {mode === "grid" ? (
                  <BarGrid bar={bar} editable={editable} onEdit={onEdit ? (u) => onEdit(i, u) : undefined} onHit={onHit} />
                ) : (
                  <NotationBar bar={bar} />
                )}
                <div className="playhead" ref={(el) => void (heads.current[i] = el)} />
              </div>
            </div>
          );
        })}
        {trailing}
      </div>
    </div>
  );
}
