import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DIFFICULTIES,
  FOCUS,
  MAX_BARS,
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
        <label className="field inline">
          <span>{t("beatsPerBar")}</span>
          <select value={bar.beats} onChange={(e) => editBar(i, (b) => resizeBar(b, Number(e.target.value), b.triplet))}>
            {Array.from({ length: 8 }, (_, k) => (
              <option key={k + 1} value={k + 1}>
                {k + 1}
              </option>
            ))}
          </select>
        </label>
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

      <section className="form">
        <label className="field wide">
          <span>{t("fieldTitle")}</span>
          <input value={form.title} maxLength={60} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label className="field">
          <span>{t("fieldAuthor")}</span>
          <input value={form.author} maxLength={30} onChange={(e) => patch({ author: e.target.value })} />
        </label>
        <label className="field">
          <span>{t("difficulty")}</span>
          <select value={form.difficulty} onChange={(e) => patch({ difficulty: e.target.value as Draft["difficulty"] })}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(d as Key)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("fieldBpm")}</span>
          <input type="number" min={MIN_BPM} max={MAX_BPM} value={form.bpm} onChange={(e) => patch({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, Number(e.target.value) || MIN_BPM)) })} />
        </label>
        <div className="field wide">
          <span>{t("tags")}</span>
          <Chips options={TAGS} value={form.tags} onChange={(tags) => patch({ tags })} max={6} />
        </div>
        <div className="field wide">
          <span>{t("focus")}</span>
          <Chips options={FOCUS} value={form.focus} onChange={(focus) => patch({ focus })} max={4} />
        </div>
        <label className="field wide">
          <span>{t("fieldDescription")}</span>
          <textarea rows={2} maxLength={300} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
        </label>
      </section>

      <section className="brushbar">
        <span className="label-strong">{t("brush")}</span>
        <div className="seg" role="group">
          {([1, 2, 3] as Level[]).map((l) => (
            <button key={l} className={brush === l ? "on" : ""} onClick={() => setBrush(l)}>
              <i className={`dot l${l}`} /> {t(l === 1 ? "levelGhost" : l === 2 ? "levelNormal" : "levelAccent")}
            </button>
          ))}
        </div>
        <span className="muted hint">{t("brushHint")}</span>
      </section>

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

      <div className="actions">
        <button
          className="btn"
          disabled={form.bars.length >= MAX_BARS}
          onClick={() => setBars((bs) => [...bs, emptyBar(bs[bs.length - 1]?.beats ?? 4, bs[bs.length - 1]?.triplet ?? false)])}
        >
          + {t("addBar")} ({form.bars.length}/{MAX_BARS})
        </button>
        <span className="spacer" />
        {error && <span className="notice error inline">{error}</span>}
        <button className="btn primary" disabled={busy} onClick={publish}>
          {busy ? t("publishing") : t("publish")}
        </button>
      </div>

      <div className="dock">
        <PlayerBar player={player} bpm={form.bpm} onBpm={(bpm) => patch({ bpm })} />
      </div>
    </main>
  );
}
