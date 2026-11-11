import { Link } from "react-router-dom";
import type { Groove } from "../../../shared/groove";
import { getCardPosition, toggleCard, useCardPlaying } from "../audio/cardPlayback";
import { useI18n, type Key } from "../i18n";
import { useOptions } from "../options";
import { NotationPreview } from "./Bars";

export function GrooveCard({ g }: { g: Groove }) {
  const { t } = useI18n();
  const { focusLabel } = useOptions();
  const playing = useCardPlaying() === g.id;
  return (
    <article className={`card${playing ? " playing" : ""}`}>
      <div className="card-notes">
        <Link to={`/g/${g.id}`} className="card-notes-link" aria-label={g.title}>
          <NotationPreview bars={g.bars} playing={playing} getPosition={getCardPosition} />
        </Link>
        <button className="card-play" onClick={() => void toggleCard(g)} aria-pressed={playing} aria-label={`${playing ? t("stop") : t("play")}: ${g.title}`}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5l9 5.5-9 5.5z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
      <Link to={`/g/${g.id}`} className="card-body">
        <h3>{g.title}</h3>
        <p className="muted">
          {t("by")} {g.author || t("anonymous")}
          {g.forkOf ? ` · ${t("basedOn")} ${g.forkOf.title}` : ""}
        </p>
        <p className="meta">
          <span>{g.bpm} BPM</span>
          <span>{g.bars.length === 1 ? t("barCount1") : t("barsCount", { n: g.bars.length })}</span>
          <span className={`diff ${g.difficulty}`}>{t(g.difficulty as Key)}</span>
        </p>
        <div className="chips static">
          {[...g.tags.map((k) => t(k as Key)), ...g.focus.map(focusLabel)].map((label) => (
            <span key={label} className="chip static">
              {label}
            </span>
          ))}
        </div>
        <p className="stats muted">
          ♥ {g.likes} · ▶ {g.plays}
        </p>
      </Link>
    </article>
  );
}
