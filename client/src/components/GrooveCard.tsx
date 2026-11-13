import { Link } from "react-router-dom";
import type { Groove } from "../../../shared/groove";
import { getCardPosition, toggleCard } from "../audio/cardPlayback";
import { usePlayback } from "../audio/playback";
import { useI18n, type Key } from "../i18n";
import { usePlays } from "../audio/playCount";
import { useOptions } from "../options";
import { NotationPreview } from "./Bars";
import { Stat } from "./Stat";

export function GrooveCard({ g }: { g: Groove }) {
  const { t } = useI18n();
  const { focusLabel } = useOptions();
  const pb = usePlayback();
  const mine = pb.grooveId === g.id;
  const playing = mine && pb.playing;
  const plays = usePlays(g.id, g.plays);
  return (
    <article className={`card${playing ? " playing" : ""}`}>
      <div className="card-notes">
        <button className="card-play" onClick={() => void toggleCard(g)} aria-pressed={playing} aria-label={`${playing ? t("pause") : t("play")}: ${g.title}`}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h2.6v10H3zM8.4 2H11v10H8.4z" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5l9 5.5-9 5.5z" fill="currentColor" /></svg>
          )}
        </button>
        <Link to={`/g/${g.id}`} className="card-notes-link" aria-label={g.title}>
          <NotationPreview bars={g.bars} playing={mine && pb.active} getPosition={getCardPosition} />
        </Link>
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
          <Stat kind="likes" n={g.likes} label={t("like")} />
          <Stat kind="plays" n={plays} label={t("plays")} />
          <Stat kind="forks" n={g.forks} label={t("forks")} />
        </p>
      </Link>
    </article>
  );
}
