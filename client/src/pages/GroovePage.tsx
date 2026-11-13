import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Groove } from "../../../shared/groove";
import { api } from "../api";
import { engine } from "../audio/engine";
import { usePlays } from "../audio/playCount";
import { usePlayer } from "../audio/usePlayer";
import { GrooveView, type ViewMode } from "../components/Bars";
import { Stat } from "../components/Stat";
import { PlayerBar } from "../components/PlayerBar";
import { useI18n, type Key } from "../i18n";
import { useOptions } from "../options";
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
  const { focusLabel } = useOptions();
  useEffect(() => {
    if (state === "missing") engine.stop();
  }, [state]);
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
  const { focusLabel } = useOptions();
  const nav = useNavigate();
  const [bpm, setBpm] = useState(g.bpm);
  const [mode, setMode] = useState<ViewMode>("notes");
  const [likes, setLikes] = useState(g.likes);
  const [liked, setLiked] = useState(false);
  const token = store.getToken(g.id);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const player = usePlayer(g.bars, bpm, g.id);
  const plays = usePlays(g.id, g.plays);

  useEffect(() => {
    api.myLikes().then((ids) => setLiked(ids.includes(g.id)), () => {});
  }, [g.id]);

  const toggleLike = async () => {
    try {
      const r = await api.like(g.id, !liked);
      setLikes(r.likes);
      setLiked(!liked);
    } catch {
      /* ignore */
    }
  };
  const sendRequest = async () => {
    try {
      await api.requestDelete(g.id, reason);
      setSent(true);
      setAsking(false);
    } catch {
      /* shown as not sent: the form stays open */
    }
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  const remove = async () => {
    if (!token || !confirm(t("confirmDelete"))) return;
    await api.remove(g.id, token);
    store.removeToken(g.id);
    nav("/");
  };

  return (
    <>
    <main className="container detail">
      <Link to="/" className="muted back">← {t("back")}</Link>
      <section className="panel">
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
          <button className="btn" onClick={copyLink}>{copied ? t("linkCopied") : t("copyLink")}</button>
          {token && <Link className="btn" to={`/edit/${g.id}`}>{t("editGroove")}</Link>}
          {token ? (
            <button className="btn danger" onClick={remove}>{t("deleteGroove")}</button>
          ) : (
            <button className="btn danger" onClick={() => setAsking(!asking)} disabled={sent}>
              {sent ? t("requestSent") : t("requestDelete")}
            </button>
          )}
        </div>
      </header>

      {asking && !token && (
        <div className="request">
          <p>{t("requestInfo")}</p>
          <textarea rows={2} maxLength={300} value={reason} placeholder={t("requestReason")} onChange={(e) => setReason(e.target.value)} />
          <div className="request-actions">
            <button className="btn primary" onClick={sendRequest}>{t("requestSend")}</button>
            <button className="btn" onClick={() => setAsking(false)}>{t("cancel")}</button>
          </div>
        </div>
      )}

      <p className="meta">
        <span>{g.bpm} BPM</span>
        <span>{g.bars.length === 1 ? t("barCount1") : t("barsCount", { n: g.bars.length })}</span>
        <span className={`diff ${g.difficulty}`}>{t(g.difficulty as Key)}</span>
        <Stat kind="likes" n={likes} label={t("like")} />
        <Stat kind="plays" n={plays} label={t("plays")} />
        <Stat kind="forks" n={g.forks} label={t("forks")} />
      </p>
      <div className="chips static">
        {[...g.tags.map((k) => t(k as Key)), ...g.focus.map(focusLabel)].map((label) => (
          <span key={label} className="chip static">{label}</span>
        ))}
      </div>
      {g.description && <p className="desc">{g.description}</p>}
      </section>

      <section className="panel">

      <div className="seg view-switch" role="group">
        <button className={mode === "notes" ? "on" : ""} onClick={() => setMode("notes")}>{t("viewNotes")}</button>
        <button className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")}>{t("viewGrid")}</button>
      </div>

      <GrooveView bars={g.bars} mode={mode} playing={player.active}
          running={player.playing} getPosition={player.getPosition} onSeek={player.seek} />
      </section>

    </main>
    <div className="dock">
      <PlayerBar player={player} bpm={bpm} onBpm={setBpm} />
    </div>
    </>
  );
}
