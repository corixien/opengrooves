import { useState } from "react";
import { MAX_BPM, MIN_BPM } from "../../../shared/groove";
import type { PlayerState } from "../audio/usePlayer";
import { useI18n } from "../i18n";
import { Select } from "./Select";

interface Props {
  player: PlayerState;
  bpm: number;
  onBpm: (bpm: number) => void;
}

export function PlayerBar({ player, bpm, onBpm }: Props) {
  const { t } = useI18n();
  const { settings: s, update, playing, paused, status } = player;
  const [more, setMore] = useState(false); // phones: sliders and options fold away
  const clamp = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v) || MIN_BPM));
  return (
    <div className={`player${more ? " open" : ""}`}>
      <button
        className="btn primary play"
        onClick={player.tap}
        disabled={status !== "ready"}
        aria-pressed={playing}
        title={t("playHint")}
      >
        {status === "loading" ? t("loadingSounds") : status === "error" ? t("soundsError") : playing ? `❚❚ ${t("pause")}` : paused ? `▶ ${t("resume")}` : `▶ ${t("play")}`}
      </button>

      <label className="field tempo">
        <span>{t("tempo")}</span>
        <div className="tempo-row">
          <button className="btn small" onClick={() => onBpm(clamp(bpm - 1))} aria-label="-1">−</button>
          <input type="number" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => onBpm(clamp(Number(e.target.value)))} />
          <button className="btn small" onClick={() => onBpm(clamp(bpm + 1))} aria-label="+1">+</button>
        </div>
        <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => onBpm(Number(e.target.value))} />
      </label>

      <div className="mixer">
        <div className="mix">
          <button className={`toggle${s.grooveOn ? " on" : ""}`} aria-pressed={s.grooveOn} onClick={() => update({ grooveOn: !s.grooveOn })}>
            {t("groove")}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={s.grooveVol} onChange={(e) => update({ grooveVol: Number(e.target.value) })} aria-label={`${t("groove")} ${t("volume")}`} />
        </div>
        <div className="mix">
          <button className={`toggle${s.metroOn ? " on" : ""}`} aria-pressed={s.metroOn} onClick={() => update({ metroOn: !s.metroOn })}>
            {t("metronome")}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={s.metroVol} onChange={(e) => update({ metroVol: Number(e.target.value) })} aria-label={`${t("metronome")} ${t("volume")}`} />
        </div>
      </div>

      <div className="opts">
        <div className="opt">
          <label className="check">
            <input type="checkbox" checked={s.countIn} onChange={(e) => update({ countIn: e.target.checked })} />
            {t("countIn")}
          </label>
          <Select
            className="num"
            label={t("countInBars")}
            disabled={!s.countIn}
            value={s.countInBars}
            onChange={(countInBars) => update({ countInBars })}
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? t("barCount1") : t("barsCount", { n }) }))}
          />
        </div>
        <div className="opt">
          <label className="check">
            <input type="checkbox" checked={s.loop} onChange={(e) => update({ loop: e.target.checked })} />
            {t("loop")}
          </label>
          <Select
            className="num"
            label={t("loopCount")}
            disabled={!s.loop}
            value={s.loopCount}
            onChange={(loopCount) => update({ loopCount })}
            options={[0, 2, 3, 4, 6, 8, 12, 16, 32].map((n) => ({ value: n, label: n === 0 ? "∞" : `${n}×` }))}
          />
        </div>
        <div className="field inline">
          <span>{t("clickUnit")}</span>
          <Select
            className="unit"
            label={t("clickUnit")}
            value={s.metroUnit}
            onChange={(metroUnit) => update({ metroUnit })}
            options={[
              { value: 1, label: t("unitQuarter") },
              { value: 2, label: t("unitEighth") },
              { value: 4, label: t("unitSixteenth") },
            ]}
          />
        </div>
      </div>
      <button className="btn icon more" onClick={() => setMore(!more)} aria-expanded={more} aria-label={t("moreOptions")} title={t("moreOptions")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
          <circle cx="10.5" cy="4.5" r="1.5" />
          <circle cx="5.5" cy="11.5" r="1.5" />
        </svg>
      </button>
    </div>
  );
}
