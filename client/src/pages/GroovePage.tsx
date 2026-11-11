import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Groove } from "../../../shared/groove";
import { api } from "../api";
import { usePlayer } from "../audio/usePlayer";
import { GrooveView, type ViewMode } from "../components/Bars";
import { PlayerBar } from "../components/PlayerBar";
import { useI18n, type Key } from "../i18n";
import { store } from "../storage";

export function GroovePage() {
  const { id = "" } = useParams();
  const [g, setG] = useState<Groove | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  useEffect(() => {
    setState("loading");
    api.get(id).then(
      (x) => (setG(x), setState("ok")),
      () => setState("missing"),
    );
  }, [id]);
  const { t } = useI18n();
  if (state === "loading") return <main className="container"><p className="muted">{t("loading")}</p></main>;
  if (state === "missing" || !g)
    return (
      <main className="container">
        <p>{t("notFound")}</p>
        <Link to="/" className="btn">{t("back")}</Link>
      </main>
    );
  return <Detail g={g} key={g.id} />;
}

function Detail({ g }: { g: Groove }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [bpm, setBpm] = useState(g.bpm);
  const [mode, setMode] = useState<ViewMode>("notes");
  const [likes, setLikes] = useState(g.likes);
  const [liked, setLiked] = useState(false);
  const [counted, setCounted] = useState(false);
  const token = store.getToken(g.id);
  const player = usePlayer(g.bars, bpm);

  useEffect(() => {
    api.myLikes().then((ids) => setLiked(ids.includes(g.id)), () => {});
  }, [g.id]);

  useEffect(() => {
    if (player.playing && !counted) {
      setCounted(true);
      api.play(g.id).catch(() => {});
    }
  }, [player.playing, counted, g.id]);

  const toggleLike = async () => {
    try {
      const r = await api.like(g.id, !liked);
      setLikes(r.likes);
      setLiked(!liked);
    } catch {
      /* ignore */
    }
  };
  const remove = async () => {
    if (!token || !confirm(t("confirmDelete"))) return;
    await api.remove(g.id, token);
    store.removeToken(g.id);
    nav("/");
  };

  return (
    <main className="container detail">
      <Link to="/" className="muted back">← {t("back")}</Link>
      <header className="detail-head">
        <div>
          <h1>{g.title}</h1>
          <p className="muted">
            {t("by")} {g.author || t("anonymous")} · {new Date(g.createdAt).toLocaleDateString()}
            {g.forkOf && (
              <>
                {" · "}
                {t("basedOn")} <Link to={`/g/${g.forkOf.id}`}>{g.forkOf.title}</Link>
              </>
            )}
            {token && <> · <b>{t("yours")}</b></>}
          </p>
        </div>
        <div className="head-actions">
          <button className={`btn${liked ? " active" : ""}`} onClick={toggleLike} aria-pressed={liked}>
            ♥ {liked ? t("liked") : t("like")} · {likes}
          </button>
          <Link className="btn" to={`/new?fork=${g.id}`}>{t("forkIt")}</Link>
          {token && <button className="btn danger" onClick={remove}>{t("deleteGroove")}</button>}
        </div>
      </header>

      <p className="meta">
        <span>{g.bpm} BPM</span>
        <span>{g.bars.length === 1 ? t("barCount1") : t("barsCount", { n: g.bars.length })}</span>
        <span className={`diff ${g.difficulty}`}>{t(g.difficulty as Key)}</span>
        <span>▶ {g.plays + (counted ? 1 : 0)} {t("plays")}</span>
      </p>
      <div className="chips static">
        {[...g.tags, ...g.focus].map((k) => (
          <span key={k} className="chip static">{t(k as Key)}</span>
        ))}
      </div>
      {g.description && <p className="desc">{g.description}</p>}

      <div className="seg view-switch" role="group">
        <button className={mode === "notes" ? "on" : ""} onClick={() => setMode("notes")}>{t("viewNotes")}</button>
        <button className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")}>{t("viewGrid")}</button>
      </div>

      <GrooveView bars={g.bars} mode={mode} playing={player.playing} getPosition={player.getPosition} />

      <div className="dock">
        <PlayerBar player={player} bpm={bpm} onBpm={setBpm} />
      </div>
    </main>
  );
}
