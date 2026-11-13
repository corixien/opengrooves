import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DIFFICULTIES,
  DENOMINATORS,
  MAX_BARS,
  canTriplet,
  maxBeats,
  MAX_FOCUS,
  MAX_BPM,
  MIN_BPM,
  TAGS,
  emptyBar,
  resizeBar,
  setLevel,
  type Bar,
  type Instrument,
  type Level,
} from "../../../shared/groove";
import { GM_INSTRUMENT, locateStep, midiToBars, parseMidi, velocityLevel, type Quantize } from "../../../shared/midi";
import { ApiError, api } from "../api";
import { usePlayer } from "../audio/usePlayer";
import { engine } from "../audio/engine";
import { useMidiInput } from "../audio/useMidiInput";
import { GrooveView } from "../components/Bars";
import { Chips } from "../components/Chips";
import { PlayerBar } from "../components/PlayerBar";
import { Select } from "../components/Select";
import { useOptions } from "../options";
import { useI18n, type Key } from "../i18n";
import { store, type Draft } from "../storage";

const BLANK: Draft = {
  title: "",
  author: "",
  description: "",
  tags: [],
  difficulty: "beginner",
  focus: [],
  bpm: 100,
  bars: [emptyBar()],
  forkOf: null,
};

export function EditorPage() {
  const { t } = useI18n();
  const { focus } = useOptions();
  const nav = useNavigate();
  const forkId = useSearchParams()[0].get("fork");
  const [form, setForm] = useState<Draft>(() => (forkId ? BLANK : (store.getDraft() ?? BLANK)));
  const [restored] = useState(() => !forkId && store.getDraft() !== null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const player = usePlayer(form.bars, form.bpm);
  const [recording, setRecording] = useState(false);
  const [quant, setQuant] = useState<Quantize>("step");
  const [midiMsg, setMidiMsg] = useState("");
  const [lit, setLit] = useState<ReadonlySet<Instrument>>(new Set());
  const litTimers = useRef(new Map<Instrument, number>());

  useEffect(() => {
    if (!forkId) return;
    api.get(forkId).then(
      (g) =>
        setForm({
          title: g.title,
          author: "",
          description: g.description,
          tags: g.tags,
          difficulty: g.difficulty,
          focus: g.focus,
          bpm: g.bpm,
          bars: g.bars,
          forkOf: g.id,
        }),
      () => setError(t("errGeneric")),
    );
  }, [forkId]);

  useEffect(() => {
    if (!forkId) store.setDraft(form);
  }, [form, forkId]);

  const patch = (p: Partial<Draft>) => setForm((f) => ({ ...f, ...p }));
  const setBars = (fn: (bars: Bar[]) => Bar[]) => setForm((f) => ({ ...f, bars: fn(f.bars) }));
  const editBar = (i: number, up: (b: Bar) => Bar) => setBars((bs) => bs.map((b, j) => (j === i ? up(b) : b)));
  const onHit = useMemo(() => (inst: Parameters<typeof engine.preview>[0], l: Level) => engine.preview(inst, l), []);

  const midi = useMidiInput((note, vel, lagMs) => {
    const inst = GM_INSTRUMENT[note];
    if (!inst) return;
    const level = velocityLevel(vel);
    engine.preview(inst, level);
    setLit((l) => new Set(l).add(inst));
    window.clearTimeout(litTimers.current.get(inst));
    litTimers.current.set(
      inst,
      window.setTimeout(
        () =>
          setLit((l) => {
            const n = new Set(l);
            n.delete(inst);
            return n;
          }),
        160,
      ),
    );
    if (!recording || !player.playing) return;
    const pos = engine.getPosition();
    if (pos === null || pos < 0) return; // count-in
    const hit = locateStep(form.bars, pos - (lagMs * form.bpm) / 60000, quant);
    if (hit) editBar(hit.bar, (b) => setLevel(b, inst, hit.step, level));
  });

  const importMidi = async (file: File) => {
    try {
      const m = midiToBars(parseMidi(new Uint8Array(await file.arrayBuffer())));
      if (form.bars.some((b) => Object.keys(b.rows).length) && !confirm(t("midiImportConfirm"))) return;
      player.stop();
      setForm((f) => ({ ...f, bars: m.bars, bpm: m.bpm, title: f.title || file.name.replace(/\.[^.]+$/, "").slice(0, 60) }));
      setMidiMsg(t("midiImportDone", { n: m.imported, bars: m.bars.length, bpm: m.bpm, skipped: m.dropped }));
    } catch {
      setMidiMsg(t("midiImportError"));
    }
  };

  const publish = async () => {
    setError("");
    if (!form.title.trim()) return setError(t("errTitle"));
    if (!form.bars.some((b) => Object.keys(b.rows).length)) return setError(t("errEmpty"));
    setBusy(true);
    try {
      const { groove, token } = await api.create(form);
      store.setToken(groove.id, token);
      if (!forkId) store.clearDraft();
      player.stop();
      nav(`/g/${groove.id}`);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? t("errRate") : t("errGeneric"));
      setBusy(false);
    }
  };

  const header = (i: number) => {
    const bar = form.bars[i];
    return (
      <div className="bar-head">
        <div className="bar-head-row">
          <span className="bar-no">{i + 1}</span>
          <Select
            className="beats"
            label={t("beatsPerBar")}
            value={bar.beats}
            onChange={(beats) => editBar(i, (b) => resizeBar(b, beats, b.triplet))}
            options={Array.from({ length: maxBeats(bar.den) }, (_, k) => ({ value: k + 1, label: String(k + 1) }))}
          />
          <span className="slash">/</span>
          <Select
            className="den"
            label={t("noteValue")}
            value={bar.den}
            onChange={(den) => editBar(i, (b) => resizeBar(b, Math.min(b.beats, maxBeats(den)), b.triplet && canTriplet(den), den))}
            options={DENOMINATORS.map((d) => ({ value: d, label: String(d) }))}
          />
          <span className="spacer" />
          <button
            className="btn icon"
            title={t("duplicateBar")}
            aria-label={t("duplicateBar")}
            disabled={form.bars.length >= MAX_BARS}
            onClick={() => setBars((bs) => [...bs.slice(0, i + 1), structuredClone(bs[i]), ...bs.slice(i + 1)])}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4.5" y="4.5" width="8" height="8" /><path d="M9.5 4.5v-3h-8v8h3" /></svg>
          </button>
          <button className="btn icon" title={t("clearBar")} aria-label={t("clearBar")} onClick={() => editBar(i, (b) => ({ ...b, rows: {} }))}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7h10" /></svg>
          </button>
          <button className="btn icon danger" title={t("deleteBar")} aria-label={t("deleteBar")} disabled={form.bars.length <= 1} onClick={() => setBars((bs) => bs.filter((_, j) => j !== i))}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
        <div className="seg" role="group">
          <button className={!bar.triplet ? "on" : ""} onClick={() => editBar(i, (b) => resizeBar(b, b.beats, false))}>
            {t("gridSixteenth")}
          </button>
          <button className={bar.triplet ? "on" : ""} disabled={!canTriplet(bar.den)} onClick={() => editBar(i, (b) => resizeBar(b, b.beats, true))}>
            {t("gridTriplet")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
    <main className="container editor">
      <h1>{forkId ? t("editorFork") : t("editorTitle")}</h1>
      {restored && form !== BLANK && (
        <p className="notice">
          {t("draftRestored")}{" "}
          <button
            className="link"
            onClick={() => {
              store.clearDraft();
              setForm(BLANK);
            }}
          >
            {t("discardDraft")}
          </button>
        </p>
      )}

      <div className="panels">
        <section className="panel">
          <header className="panel-head">
            <span className="step">1</span>
            <h2>{t("sectionBasics")}</h2>
          </header>
          <div className="form">
            <label className="field wide">
              <span>{t("fieldTitle")}</span>
              <input value={form.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("fieldAuthor")}</span>
              <input value={form.author} maxLength={30} onChange={(e) => patch({ author: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("fieldBpm")}</span>
              <input
                type="number"
                min={MIN_BPM}
                max={MAX_BPM}
                value={form.bpm}
                onChange={(e) => patch({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, Number(e.target.value) || MIN_BPM)) })}
              />
            </label>
            <label className="field wide grow">
              <span>{t("fieldDescription")}</span>
              <textarea rows={3} maxLength={300} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <span className="step">2</span>
            <h2>{t("sectionClassify")}</h2>
          </header>
          <div className="form single">
            <div className="field">
              <span>{t("difficulty")}</span>
              <Select
                label={t("difficulty")}
                value={form.difficulty}
                onChange={(difficulty) => patch({ difficulty })}
                options={DIFFICULTIES.map((d) => ({ value: d, label: t(d as Key) }))}
              />
            </div>
            <div className="field">
              <span>{t("tags")}</span>
              <Chips options={TAGS.map((id) => ({ id, label: t(id as Key) }))} value={form.tags} onChange={(tags) => patch({ tags: tags as Draft["tags"] })} max={6} />
            </div>
            <div className="field">
              <span>{t("focus")}</span>
              <Chips options={focus} value={form.focus} onChange={(f) => patch({ focus: f })} max={MAX_FOCUS} />
            </div>
          </div>
        </section>
      </div>

      <section className="panel pattern">
        <header className="panel-head">
          <span className="step">3</span>
          <h2>{t("sectionPattern")}</h2>
        </header>
        <p className="muted hint">{t("brushHint")}</p>

        <div className="midi-bar">
          <label className="btn">
            {t("midiImport")}
            <input
              type="file"
              accept=".mid,.midi,audio/midi"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importMidi(f);
              }}
            />
          </label>
          <button
            className={`toggle${midi.status === "on" ? " on" : ""}`}
            disabled={midi.status === "unsupported"}
            aria-pressed={midi.status === "on"}
            onClick={midi.connect}
          >
            {midi.status === "on" ? t("midiInputOn") : t("midiInput")}
          </button>
          {midi.status === "on" && (
            <>
              <button className={`toggle rec${recording ? " on" : ""}`} aria-pressed={recording} onClick={() => setRecording((r) => !r)}>
                {t("midiRecord")}
              </button>
              <span className="field-inline">
                {t("quantize")}
                <Select
                  label={t("quantize")}
                  value={quant}
                  onChange={setQuant}
                  options={[
                    { value: "step" as Quantize, label: t("quantStep") },
                    { value: "eighth" as Quantize, label: t("quantEighth") },
                    { value: "quarter" as Quantize, label: t("quantQuarter") },
                  ]}
                />
              </span>
            </>
          )}
        </div>
        <p className="midi-note">
          {midi.status === "unsupported"
            ? t("midiUnsupported")
            : midi.status === "denied"
              ? t("midiDenied")
              : midi.status === "on"
                ? `${midi.inputs.join(", ") || t("midiNone")}${recording ? " · " + t("midiRecordHint") : ""}`
                : midiMsg || ""}
          {midi.status === "on" && midiMsg ? ` · ${midiMsg}` : ""}
        </p>

        <GrooveView
          bars={form.bars}
          mode="grid"
          editable
          playing={player.active}
          getPosition={player.getPosition}
          onSeek={player.seek}
          lit={lit}
          onEdit={editBar}
          onHit={onHit}
          renderHeader={header}
          trailing={
            <button
              className="add-bar"
              disabled={form.bars.length >= MAX_BARS}
              onClick={() => setBars((bs) => [...bs, emptyBar(bs[bs.length - 1]?.beats ?? 4, bs[bs.length - 1]?.triplet ?? false, bs[bs.length - 1]?.den ?? 4)])}
            >
              <span className="plus">+</span>
              {t("addBar")}
              <small>
                {form.bars.length}/{MAX_BARS}
              </small>
            </button>
          }
        />
      </section>

      <div className="publish">
        {error && <span className="notice error inline">{error}</span>}
        <button className="btn primary big" disabled={busy} onClick={publish}>
          {busy ? t("publishing") : t("publish")}
        </button>
      </div>

    </main>
    <div className="dock">
      <PlayerBar player={player} bpm={form.bpm} onBpm={(bpm) => patch({ bpm })} />
    </div>
    </>
  );
}
