import { memo, useEffect, useRef, type ReactNode } from "react";
import {
  INSTRUMENTS,
  getLevel,
  setLevel,
  barQuarters,
  stepCount,
  stepsPerQuarter,
  type Bar,
  type Instrument,
  type Level,
} from "../../../shared/groove";
import { engine } from "../audio/engine";
import { useI18n } from "../i18n";

// ---------- notation geometry (SVG units) ----------
const LEAD = 14; // space between the bar line and the first note step
const BEAT_W = 72;
const H = 116;
const LINE_Y0 = 84; // y of bottom staff line (E4)
/** Bar line to bar line; time maps linearly onto it (from LEAD), so the playhead crosses bars without jumping. */
const barWidth = (bar: Bar) => Math.max(barQuarters(bar) * BEAT_W, stepCount(bar) * 18);

/** Diatonic step above the bottom staff line and head style per instrument; foot instruments get downward stems. */
type Head = "x" | "o" | "xo" | "xh" | "xb" | "d";
const NOTE: Record<Instrument, { step: number; head: Head; foot?: true }> = {
  splash: { step: 13, head: "x" },
  china: { step: 12, head: "xb" },
  crash2: { step: 11, head: "x" },
  crash: { step: 10, head: "x" },
  rideBell: { step: 8, head: "d" },
  ride: { step: 8, head: "x" },
  hhOpen: { step: 9, head: "xo" },
  hhHalf: { step: 9, head: "xh" },
  hhClosed: { step: 9, head: "x" },
  hhPedal: { step: -1, head: "x", foot: true },
  tomHigh: { step: 7, head: "o" },
  tomMid: { step: 6, head: "o" },
  tomLow: { step: 3, head: "o" },
  snare: { step: 5, head: "o" },
  sidestick: { step: 5, head: "x" },
  kick: { step: 1, head: "o", foot: true },
};
const yOf = (step: number) => LINE_Y0 - step * 4;

function NotationContent({ bar, x0 }: { bar: Bar; x0: number }) {
  const spb = stepsPerQuarter(bar.triplet); // beam group = one quarter note
  const n = stepCount(bar);
  const w = barWidth(bar);
  const xOf = (i: number) => x0 + LEAD + (i / n) * w;
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
      const { step, head, foot } = NOTE[inst];
      const y = yOf(step);
      const cls = `note l${level}`;
      if (!foot) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (head === "o") {
        els.push(<ellipse key={`${inst}${i}`} cx={x} cy={y} rx={5} ry={3.6} className={cls} transform={`rotate(-18 ${x} ${y})`} />);
      } else if (head === "d") {
        els.push(<path key={`${inst}${i}`} d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`} className={`${cls} cross`} />);
      } else {
        els.push(
          <path key={`${inst}${i}`} d={`M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`} className={`${cls} cross`} />,
        );
        if (head === "xo") els.push(<circle key={`${inst}${i}o`} cx={x} cy={y - 9} r={2.6} className={`${cls} ring`} />);
        if (head === "xh") els.push(<path key={`${inst}${i}h`} d={`M${x - 2.6} ${y - 9}h5.2M${x} ${y - 11.6}v5.2`} className={`${cls} ring`} />);
        if (head === "xb") els.push(<rect key={`${inst}${i}b`} x={x - 6} y={y - 6} width={12} height={12} className={`${cls} ring`} />);
      }
      if (level === 3) els.push(<path key={`${inst}${i}a`} d={`M${x - 4} ${y - 15}L${x + 4} ${y - 12}L${x - 4} ${y - 9}`} className="accent-mark" />);
      if (level === 1) els.push(<text key={`${inst}${i}g`} x={x} y={y + 3.5} className="ghost-paren" textAnchor="middle">{"( )"}</text>);
    }
    if (minY !== Infinity) handStemTop[i] = Math.min(minY - 26, yOf(8) - 4);
    // stems
    if (minY !== Infinity) {
      els.push(<line key={`s${i}`} x1={x + 5} x2={x + 5} y1={maxY} y2={handStemTop[i]} className="stem" data-stem={i} />);
    }
    for (const inst of INSTRUMENTS) {
      if (!NOTE[inst].foot || !getLevel(bar, inst, i)) continue;
      const fy = yOf(NOTE[inst].step);
      els.push(<line key={`k${inst}${i}`} x1={x - 5} x2={x - 5} y1={fy} y2={fy + 26} className="stem" />);
    }
  }

  // beams for hand notes per beat
  for (let b = 0; b < Math.ceil(n / spb); b++) {
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

/**
 * Card preview: all bars in one SVG, the viewport shows the first two bars. While playing, the
 * viewport follows the playhead (viewBox shifts) when there are more than two bars.
 */
export function NotationPreview({ bars, playing = false, getPosition }: { bars: Bar[]; playing?: boolean; getPosition?: () => number | null }) {
  const svg = useRef<SVGSVGElement>(null);
  const head = useRef<SVGLineElement>(null);
  const widths = bars.map(barWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  const viewW = widths[0] + (widths[1] ?? 0);
  let x = 0;
  const parts = bars.map((bar, i) => {
    const el = <NotationContent key={i} bar={bar} x0={x} />;
    x += widths[i];
    return el;
  });

  useEffect(() => {
    const reset = () => {
      svg.current?.setAttribute("viewBox", `0 0 ${viewW} ${H}`);
      head.current?.setAttribute("visibility", "hidden");
    };
    if (!playing || !getPosition) return reset();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const pos = getPosition();
      if (pos === null || pos < 0) return head.current?.setAttribute("visibility", "hidden");
      let start = 0;
      let off = 0;
      for (let i = 0; i < bars.length; i++) {
        const q = barQuarters(bars[i]);
        if (pos < start + q || i === bars.length - 1) {
          const frac = Math.min(1, Math.max(0, (pos - start) / q));
          const px = off + LEAD + frac * widths[i];
          const vx = Math.min(Math.max(0, px - viewW * 0.3), Math.max(0, total - viewW));
          svg.current?.setAttribute("viewBox", `${vx} 0 ${viewW} ${H}`);
          head.current?.setAttribute("x1", String(px));
          head.current?.setAttribute("x2", String(px));
          head.current?.setAttribute("visibility", "visible");
          return;
        }
        start += q;
        off += widths[i];
      }
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      reset();
    };
  }, [playing, getPosition, viewW, total]);

  return (
    <svg ref={svg} className="notation preview" viewBox={`0 0 ${viewW} ${H}`} preserveAspectRatio="xMinYMid meet" role="img" aria-hidden="true">
      {parts}
      <line ref={head} className="svg-playhead" x1={0} x2={0} y1={4} y2={H - 4} visibility="hidden" />
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
  const n = stepCount(bar);
  const perBeat = n / bar.beats; // steps per beat of the time signature
  const paint = useRef<Level | null>(null);
  const visited = useRef(new Set<string>()); // cells already handled in the current stroke

  const apply = (el: Element | null) => {
    const cell = el?.closest<HTMLElement>("[data-cell]");
    if (!cell || paint.current === null || !onEdit) return;
    const inst = cell.dataset.inst as Instrument;
    const step = Number(cell.dataset.step);
    const key = `${inst}:${step}`;
    if (visited.current.has(key)) return;
    visited.current.add(key);
    const target = paint.current;
    if (getLevel(bar, inst, step) === target) return;
    onEdit((b) => setLevel(b, inst, step, target));
    if (target > 0) onHit?.(inst, target); // sound only for newly placed notes
  };

  const down = (e: React.PointerEvent) => {
    if (!editable || (e.button !== 0 && e.button !== 2)) return;
    const cell = (e.target as Element).closest<HTMLElement>("[data-cell]");
    if (!cell) return;
    visited.current.clear();
    // left click cycles the level, right click erases (also while dragging)
    paint.current = e.button === 2 ? 0 : NEXT_LEVEL[getLevel(bar, cell.dataset.inst as Instrument, Number(cell.dataset.step))];
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
      onContextMenu={editable ? (e) => e.preventDefault() : undefined}
    >
      <div className="grid-head">
        {Array.from({ length: bar.beats }, (_, b) => (
          <span key={b} className="beat-num" style={{ flex: `${perBeat} 1 0` }}>
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
                className={`cell${(i * bar.beats) % n === 0 ? " beat-start" : ""}${level ? ` l${level}` : ""}`}
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
        const end = start + barQuarters(bs[i]);
        if (pos < end || i === bs.length - 1) {
          const frac = Math.min(1, Math.max(0, (pos - start) / barQuarters(bs[i])));
          const ph = heads.current[i];
          const sc = scroller.current;
          if (ph) {
            ph.style.display = "block";
            ph.style.left = `calc(var(--lead) + 100% * ${frac})`;
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
    <div className={`rhythm view-${mode}${renderHeader ? " with-head" : ""}`}>
      {mode === "grid" && (
        <div className="labels">
          {INSTRUMENTS.map((inst) => (
            <button key={inst} type="button" onClick={() => (onHit ?? engine.preview.bind(engine))(inst, 2)}>
              {t(`inst_${inst}`)}
            </button>
          ))}
        </div>
      )}
      <div className="bars" ref={scroller}>
        {bars.map((bar, i) => {
          const w = mode === "grid" ? `calc(var(--cell) * ${stepCount(bar)})` : `${barWidth(bar)}px`;
          return (
            <div key={i} className="bar-block" style={{ ["--w" as string]: w, ["--lead" as string]: mode === "grid" ? "0px" : `${LEAD}px` }}>
              {renderHeader ? renderHeader(i) : <span className="bar-no">{i + 1}</span>}
              <div className="bar-inner">
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
