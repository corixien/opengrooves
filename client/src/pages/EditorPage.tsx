import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DIFFICULTIES,
  MAX_BARS,
  MAX_FOCUS,
  MAX_BPM,
  MIN_BPM,
  TAGS,
  emptyBar,
  resizeBar,
  type Bar,
  type Level,
} from "../../../shared/groove";
import { ApiError, api } from "../api";
import { usePlayer } from "../audio/usePlayer";
import { engine } from "../audio/engine";
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
  const [brush, setBrush] = useState<Level>(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const player = usePlayer(form.bars, form.bpm);

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
        <span className="bar-no">
          {t("bar")} {i + 1}
        </span>
        <div className="field inline">
          <span>{t("beatsPerBar")}</span>
          <Select
            className="beats"
            label={t("beatsPerBar")}
            value={bar.beats}
            onChange={(beats) => editBar(i, (b) => resizeBar(b, beats, b.triplet))}
            options={Array.from({ length: 8 }, (_, k) => ({ value: k + 1, label: String(k + 1) }))}
          />
        </div>
        <div className="seg" role="group">
          <button className={!bar.triplet ? "on" : ""} onClick={() => editBar(i, (b) => resizeBar(b, b.beats, false))}>
            {t("gridSixteenth")}
          </button>
          <button className={bar.triplet ? "on" : ""} onClick={() => editBar(i, (b) => resizeBar(b, b.beats, true))}>
            {t("gridTriplet")}
          </button>
        </div>
        <span className="spacer" />
        <button
          className="btn small"
          disabled={form.bars.length >= MAX_BARS}
          onClick={() => setBars((bs) => [...bs.slice(0, i + 1), structuredClone(bs[i]), ...bs.slice(i + 1)])}
        >
          {t("duplicateBar")}
        </button>
        <button className="btn small" onClick={() => editBar(i, (b) => ({ ...b, rows: {} }))}>
          {t("clearBar")}
        </button>
        <button className="btn small danger" disabled={form.bars.length <= 1} onClick={() => setBars((bs) => bs.filter((_, j) => j !== i))}>
          {t("deleteBar")}
        </button>
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
            <label className="field wide">
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
          <span className="spacer" />
          <div className="brushbar">
            <span className="label-strong">{t("brush")}</span>
            <div className="seg" role="group">
              {([1, 2, 3] as Level[]).map((l) => (
                <button key={l} className={brush === l ? "on" : ""} onClick={() => setBrush(l)}>
                  <i className={`dot l${l}`} /> {t(l === 1 ? "levelGhost" : l === 2 ? "levelNormal" : "levelAccent")}
                </button>
              ))}
            </div>
          </div>
        </header>
        <p className="muted hint">{t("brushHint")}</p>

        <GrooveView
          bars={form.bars}
          mode="grid"
          editable
          brush={brush}
          playing={player.playing}
          getPosition={player.getPosition}
          onEdit={editBar}
          onHit={onHit}
          renderHeader={header}
        />

        <button
          className="btn add-bar"
          disabled={form.bars.length >= MAX_BARS}
          onClick={() => setBars((bs) => [...bs, emptyBar(bs[bs.length - 1]?.beats ?? 4, bs[bs.length - 1]?.triplet ?? false)])}
        >
          + {t("addBar")} ({form.bars.length}/{MAX_BARS})
        </button>
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
