import { Link } from "react-router-dom";
import type { Groove } from "../../../shared/groove";
import { useI18n, type Key } from "../i18n";
import { NotationPreview } from "./Bars";

export function GrooveCard({ g }: { g: Groove }) {
  const { t } = useI18n();
  return (
    <Link to={`/g/${g.id}`} className="card">
      <div className="card-notes">
        <NotationPreview bars={g.bars} />
      </div>
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
        {[...g.tags, ...g.focus].map((k) => (
          <span key={k} className="chip static">
            {t(k as Key)}
          </span>
        ))}
      </div>
      <p className="stats muted">
        ♥ {g.likes} · ▶ {g.plays}
      </p>
    </Link>
  );
}
